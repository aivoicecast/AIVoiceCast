
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Share2, Trash2, Undo, PenTool, Eraser, Download, Square, Circle, Minus, ArrowRight, Type, ZoomIn, ZoomOut, MousePointer2, Move, MoreHorizontal, Lock, Eye, Edit3, GripHorizontal, Brush, ChevronDown, Feather, Highlighter, Wind, Droplet, Cloud, Edit2, Pen, Copy, Clipboard, BringToFront, SendToBack, Sparkles, Send, Loader2, X, RotateCw, Triangle, Star, Spline, Maximize, Scissors, Shapes, Palette, Settings2, Languages, ArrowUpLeft, ArrowDownRight, HardDrive, Check } from 'lucide-react';
import { auth } from '../services/firebaseConfig';
import { saveWhiteboardSession, subscribeToWhiteboard, updateWhiteboardElement, deleteWhiteboardElements } from '../services/firestoreService';
import { WhiteboardElement, ToolType, LineStyle, BrushType } from '../types';
import { GoogleGenAI } from '@google/genai';
import { generateSecureId } from '../utils/idUtils';
import { getDriveToken, connectGoogleDrive } from '../services/authService';
import { ensureCodeStudioFolder, uploadToDrive } from '../services/googleDriveService';
import { ShareModal } from './ShareModal';

interface WhiteboardProps {
  onBack?: () => void;
  sessionId?: string;
  accessKey?: string;
  onSessionStart?: (id: string) => void;
  initialData?: string; 
  onDataChange?: (data: string) => void;
  isReadOnly?: boolean;
  disableAI?: boolean; 
  initialColor?: string;
  backgroundColor?: string;
}

const LINE_STYLES: { label: string; value: LineStyle; dash: number[] }[] = [
    { label: 'Solid', value: 'solid', dash: [] },
    { label: 'Dashed', value: 'dashed', dash: [15, 10] },
    { label: 'Dotted', value: 'dotted', dash: [3, 8] },
    { label: 'Dash-Dot', value: 'dash-dot', dash: [15, 5, 2, 5] },
    { label: 'Long Dash', value: 'long-dash', dash: [30, 10] }
];

const BRUSH_TYPES: { label: string; value: BrushType; icon: any }[] = [
    { label: 'Standard', value: 'standard', icon: PenTool },
    { label: 'Pencil', value: 'pencil', icon: Feather },
    { label: 'Marker', value: 'marker', icon: Highlighter },
    { label: 'Airbrush', value: 'airbrush', icon: Wind },
    { label: 'Calligraphy', value: 'calligraphy-pen', icon: Edit2 },
    { label: 'Chinese Ink', value: 'writing-brush', icon: Languages }
];

export const Whiteboard: React.FC<WhiteboardProps> = ({ 
  onBack, 
  sessionId: propSessionId, 
  accessKey, 
  onSessionStart,
  initialData, 
  onDataChange,
  isReadOnly: propReadOnly = false,
  disableAI = false,
  initialColor = '#ffffff',
  backgroundColor = '#0f172a'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [elements, setElements] = useState<WhiteboardElement[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentElement, setCurrentElement] = useState<WhiteboardElement | null>(null);
  
  const [tool, setTool] = useState<ToolType>('pen');
  const [color, setColor] = useState(initialColor);
  const [lineWidth, setLineWidth] = useState(6);
  const [lineStyle, setLineStyle] = useState<LineStyle>('solid');
  const [brushType, setBrushType] = useState<BrushType>('writing-brush');
  const [borderRadius, setBorderRadius] = useState(0); 
  const [fontSize, setFontSize] = useState(24);
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  
  // Sharing & Cloud State
  const [sessionId, setSessionId] = useState<string>(propSessionId || '');
  const [isSharedSession, setIsSharedSession] = useState(!!propSessionId);
  const [isReadOnly, setIsReadOnly] = useState(propReadOnly);
  const [isSavingToDrive, setIsSavingToDrive] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  // Arrow Options
  const [startArrow, setStartArrow] = useState(false);
  const [endArrow, setEndArrow] = useState(false);
  
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const isDarkBackground = backgroundColor !== 'transparent' && backgroundColor !== '#ffffff';

  useEffect(() => {
    if (propSessionId) {
        setIsSharedSession(true);
        setSessionId(propSessionId);
        const unsubscribe = subscribeToWhiteboard(propSessionId, (remoteElements: any) => {
            if (Array.isArray(remoteElements)) setElements(remoteElements);
        });
        setIsReadOnly(propReadOnly);
        return () => unsubscribe();
    }
  }, [propSessionId, propReadOnly]);

  useEffect(() => {
    if (tool === 'arrow') { setStartArrow(false); setEndArrow(true); } 
    else if (tool === 'line') { setStartArrow(false); setEndArrow(false); }
  }, [tool]);

  const getWorldCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
      if (!canvasRef.current) return { x: 0, y: 0 }; const rect = canvasRef.current.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      return { x: (clientX - rect.left - offset.x) / scale, y: (clientY - rect.top - offset.y) / scale };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
      if (isReadOnly) return;
      const { x, y } = getWorldCoordinates(e);
      setIsDrawing(true);
      const id = crypto.randomUUID();
      const newEl: WhiteboardElement = { 
          id, type: tool, x, y, color: tool === 'eraser' ? (backgroundColor === 'transparent' ? '#ffffff' : backgroundColor) : color, 
          strokeWidth: tool === 'eraser' ? 20 : lineWidth, 
          lineStyle: tool === 'eraser' ? 'solid' : lineStyle,
          brushType: tool === 'eraser' ? 'standard' : brushType, 
          points: tool === 'pen' || tool === 'eraser' ? [{ x, y }] : undefined, 
          width: 0, height: 0, endX: x, endY: y, borderRadius: tool === 'rect' ? borderRadius : undefined, rotation: 0,
          startArrow: ['line', 'arrow'].includes(tool) ? startArrow : undefined,
          endArrow: ['line', 'arrow'].includes(tool) ? endArrow : undefined
      };
      setCurrentElement(newEl);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing || !currentElement) return;
      const { x, y } = getWorldCoordinates(e);
      if (tool === 'pen' || tool === 'eraser') { 
          setCurrentElement(prev => prev ? ({ ...prev, points: [...(prev.points || []), { x, y }] }) : null); 
      }
      else if (['rect','circle','triangle','star'].includes(tool)) { setCurrentElement(prev => prev ? ({ ...prev, width: x - prev.x, height: y - prev.y }) : null); }
      else if (tool === 'line' || tool === 'arrow') { setCurrentElement(prev => prev ? ({ ...prev, endX: x, endY: y }) : null); }
  };

  const stopDrawing = async () => {
      if (isDrawing && currentElement) {
          const finalized = { ...currentElement };
          const next = [...elements, finalized];
          setElements(next);
          if (onDataChange) onDataChange(JSON.stringify(next));
          
          if (!sessionId) {
              const newId = generateSecureId();
              setSessionId(newId);
              setIsSharedSession(true);
              if (onSessionStart) onSessionStart(newId);
              await saveWhiteboardSession(newId, next);
          } else {
              await updateWhiteboardElement(sessionId, finalized);
          }
          setCurrentElement(null);
          setIsDrawing(false);
      }
  };

  const handleSaveToDrive = async () => {
      if (!canvasRef.current) return;
      setIsSavingToDrive(true);
      try {
          const token = getDriveToken() || await connectGoogleDrive();
          const folderId = await ensureCodeStudioFolder(token);
          
          // Generate PNG blob
          const blob = await new Promise<Blob>((resolve) => canvasRef.current!.toBlob(b => resolve(b!), 'image/png'));
          const fileName = `Drawing_${new Date().toISOString().slice(0,10)}_${generateSecureId().substring(0,6)}.png`;
          
          await uploadToDrive(token, folderId, fileName, blob);
          alert(`Saved to Google Drive as ${fileName}`);
      } catch (e: any) {
          alert("Drive Save failed: " + e.message);
      } finally {
          setIsSavingToDrive(false);
      }
  };

  const handleShare = () => {
      const id = sessionId || generateSecureId();
      if (!sessionId) setSessionId(id);
      const url = `${window.location.origin}?view=whiteboard&id=${id}`;
      setShareUrl(url);
      setShowShareModal(true);
  };

  useEffect(() => {
      const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return;
      canvas.width = canvas.parentElement?.clientWidth || 800; canvas.height = canvas.parentElement?.clientHeight || 600;
      ctx.clearRect(0, 0, canvas.width, canvas.height); 
      
      if (backgroundColor !== 'transparent') {
          ctx.fillStyle = backgroundColor; 
          ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.save(); ctx.translate(offset.x, offset.y); ctx.scale(scale, scale);
      
      const drawArrowHead = (x1: number, y1: number, x2: number, y2: number, size: number, color: string) => {
          const angle = Math.atan2(y2 - y1, x2 - x1);
          ctx.save(); ctx.translate(x2, y2); ctx.rotate(angle); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-size, -size / 2); ctx.lineTo(-size, size / 2); ctx.closePath(); ctx.fillStyle = color; ctx.fill(); ctx.restore();
      };

      const renderElement = (el: WhiteboardElement) => {
          ctx.save(); ctx.beginPath(); ctx.strokeStyle = el.color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          const lStyle = el.lineStyle || 'solid';
          if (lStyle === 'dashed') ctx.setLineDash([15, 10]); else if (lStyle === 'dotted') ctx.setLineDash([3, 8]); else ctx.setLineDash([]);
          if (el.type === 'pen' || el.type === 'eraser') {
              if (el.points?.length) {
                  ctx.lineWidth = el.strokeWidth / scale;
                  ctx.moveTo(el.points[0].x, el.points[0].y);
                  el.points.forEach(p => ctx.lineTo(p.x, p.y));
                  ctx.stroke();
              }
          } else if (el.type === 'rect') { ctx.lineWidth = el.strokeWidth / scale; ctx.strokeRect(el.x, el.y, el.width || 0, el.height || 0); }
          else if (el.type === 'circle') { ctx.lineWidth = el.strokeWidth / scale; ctx.ellipse(el.x + (el.width||0)/2, el.y + (el.height||0)/2, Math.abs((el.width||0)/2), Math.abs((el.height||0)/2), 0, 0, 2*Math.PI); ctx.stroke(); }
          else if (el.type === 'line' || el.type === 'arrow') { 
              ctx.lineWidth = el.strokeWidth / scale; const x1 = el.x; const y1 = el.y; const x2 = el.endX || el.x; const y2 = el.endY || el.y;
              ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); 
              const headSize = Math.max(12, el.strokeWidth * 2) / scale;
              if (el.startArrow) drawArrowHead(x2, y2, x1, y1, headSize, el.color);
              if (el.endArrow) drawArrowHead(x1, y1, x2, y2, headSize, el.color);
          }
          ctx.restore();
      };

      elements.forEach(renderElement);
      if (currentElement) renderElement(currentElement);
      ctx.restore();
  }, [elements, currentElement, scale, offset, backgroundColor]);

  return (
    <div className={`flex flex-col h-full ${isDarkBackground ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'} overflow-hidden relative`}>
        <div className={`${isDarkBackground ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'} border-b p-2 flex flex-wrap justify-between gap-2 shrink-0 z-10 items-center px-4`}>
            <div className="flex items-center gap-2">
                {onBack && <button onClick={onBack} className={`p-2 rounded-lg ${isDarkBackground ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-200 text-slate-600'} mr-2`}><ArrowLeft size={20}/></button>}
                <div className={`flex ${isDarkBackground ? 'bg-slate-800' : 'bg-slate-200'} rounded-lg p-1 mr-2`}>
                    <button onClick={() => setTool('pen')} className={`p-1.5 rounded ${tool === 'pen' ? 'bg-indigo-600 text-white' : (isDarkBackground ? 'text-slate-400' : 'text-slate-600')}`}><PenTool size={16}/></button>
                    <button onClick={() => setTool('eraser')} className={`p-1.5 rounded ${tool === 'eraser' ? 'bg-indigo-600 text-white' : (isDarkBackground ? 'text-slate-400' : 'text-slate-600')}`}><Eraser size={16}/></button>
                </div>
                <div className={`flex ${isDarkBackground ? 'bg-slate-800' : 'bg-slate-200'} rounded-lg p-1`}>
                    <button onClick={() => setTool('rect')} className={`p-1.5 rounded ${tool === 'rect' ? 'bg-indigo-600 text-white' : (isDarkBackground ? 'text-slate-400' : 'text-slate-600')}`}><Square size={16}/></button>
                    <button onClick={() => setTool('circle')} className={`p-1.5 rounded ${tool === 'circle' ? 'bg-indigo-600 text-white' : (isDarkBackground ? 'text-slate-400' : 'text-slate-600')}`}><Circle size={16}/></button>
                    <button onClick={() => setTool('line')} className={`p-1.5 rounded ${tool === 'line' ? 'bg-indigo-600 text-white' : (isDarkBackground ? 'text-slate-400' : 'text-slate-600')}`}><Minus size={16}/></button>
                    <button onClick={() => setTool('arrow')} className={`p-1.5 rounded ${tool === 'arrow' ? 'bg-indigo-600 text-white' : (isDarkBackground ? 'text-slate-400' : 'text-slate-600')}`}><ArrowRight size={16}/></button>
                </div>
                <div className={`flex gap-1 px-2 ${isDarkBackground ? 'bg-slate-800' : 'bg-slate-200'} rounded-lg py-1 items-center ml-2`}>
                    {['#000000', '#ffffff', '#ef4444', '#22c55e', '#3b82f6', '#f59e0b'].map(c => <button key={c} onClick={() => setColor(c)} className={`w-4 h-4 rounded-full border border-black/20 ${color === c ? 'ring-2 ring-indigo-500' : ''}`} style={{ backgroundColor: c }} />)}
                </div>
            </div>

            <div className="flex items-center gap-2">
                <button onClick={handleSaveToDrive} disabled={isSavingToDrive} className={`flex items-center gap-2 px-3 py-1.5 ${isDarkBackground ? 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'} text-xs font-bold rounded-lg border shadow-sm`}>
                    {isSavingToDrive ? <Loader2 size={14} className="animate-spin"/> : <HardDrive size={14}/>}
                    <span>Sync Drive</span>
                </button>
                <button onClick={handleShare} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-indigo-500/20">
                    <Share2 size={14}/>
                    <span>Share URI</span>
                </button>
                <div className={`w-px h-6 ${isDarkBackground ? 'bg-slate-800' : 'bg-slate-200'} mx-1`}></div>
                <button onClick={() => setElements(prev => prev.slice(0, -1))} className={`p-1.5 rounded transition-colors ${isDarkBackground ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-200 text-slate-600'}`}><Undo size={16} /></button>
                <button onClick={() => setElements([])} className={`p-1.5 rounded transition-colors ${isDarkBackground ? 'hover:bg-slate-800 text-slate-400 hover:text-red-400' : 'hover:bg-slate-200 text-slate-600 hover:text-red-600'}`}><Trash2 size={16} /></button>
            </div>
        </div>
        <div className={`flex-1 relative overflow-hidden ${isDarkBackground ? 'bg-slate-950' : 'bg-white'} touch-none`}>
            <canvas 
                ref={canvasRef} 
                onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
                onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing}
                className="block w-full h-full cursor-crosshair" 
            />
        </div>

        {showShareModal && (
            <ShareModal 
                isOpen={true} onClose={() => setShowShareModal(false)} link={shareUrl} title="Drawing Session"
                onShare={async (uids, isPublic) => {}}
                currentUserUid={auth?.currentUser?.uid}
            />
        )}
    </div>
  );
};
