import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Share2, Trash2, Undo, PenTool, Eraser, Download, Square, Circle, Minus, ArrowRight, Type, ZoomIn, ZoomOut, MousePointer2, Move, MoreHorizontal, Lock, Eye, Edit3, GripHorizontal, Brush, ChevronDown, Feather, Highlighter, Wind, Droplet, Cloud, Edit2, Pen, Copy, Clipboard, BringToFront, SendToBack, Sparkles, Send, Loader2, X, RotateCw, Triangle, Star, Spline, Maximize, Scissors, Shapes, Palette, Settings2, Languages, ArrowUpLeft, ArrowDownRight, HardDrive, Check, Sliders, CloudDownload, Save } from 'lucide-react';
import { auth, db } from '../services/firebaseConfig';
import { saveWhiteboardSession, subscribeToWhiteboard, updateWhiteboardElement, deleteWhiteboardElements } from '../services/firestoreService';
import { WhiteboardElement, ToolType, LineStyle, BrushType } from '../types';
import { GoogleGenAI } from '@google/genai';
import { generateSecureId } from '../utils/idUtils';
import { getDriveToken, connectGoogleDrive } from '../services/authService';
import { ensureFolder, uploadToDrive, readDriveFile } from '../services/googleDriveService';
import { ShareModal } from './ShareModal';
import { doc, getDoc } from 'firebase/firestore';

interface WhiteboardProps {
  onBack?: () => void;
  sessionId?: string;
  driveId?: string; 
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
    { label: 'Dotted', value: 'dotted', dash: [2, 6] },
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
  driveId: propDriveId,
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
  const [isLoading, setIsLoading] = useState(false);
  
  const [tool, setTool] = useState<ToolType>('pen');
  const [color, setColor] = useState(initialColor);
  const [lineWidth, setLineWidth] = useState(6);
  const [lineStyle, setLineStyle] = useState<LineStyle>('solid');
  const [brushType, setBrushType] = useState<BrushType>('standard');
  const [borderRadius, setBorderRadius] = useState(0); 
  const [fontSize, setFontSize] = useState(24);
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  
  // Fix: Defined missing state variables startArrow and endArrow to prevent ReferenceErrors on lines 155-156
  const [startArrow, setStartArrow] = useState(false);
  const [endArrow, setEndArrow] = useState(false);
  
  const [sessionId, setSessionId] = useState<string>(propSessionId || '');
  const [isReadOnly, setIsReadOnly] = useState(propReadOnly);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const isDarkBackground = backgroundColor !== 'transparent' && backgroundColor !== '#ffffff';

  // Load state from Firestore (ID) or Google Drive (driveId)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const driveId = params.get('driveId') || propDriveId;

    if (id) {
        setSessionId(id);
        loadFromFirestore(id);
    } else if (driveId) {
        loadFromDrive(driveId);
    }
  }, [propDriveId]);

  const loadFromFirestore = async (id: string) => {
      setIsLoading(true);
      try {
          if (!db) return;
          const docRef = doc(db, 'whiteboards', id);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
              const data = snap.data();
              if (Array.isArray(data.elements)) {
                  setElements(data.elements);
                  if (onDataChange) onDataChange(JSON.stringify(data.elements));
              }
          }
      } catch (e) {
          console.error("Firestore load failed", e);
      } finally {
          setIsLoading(false);
      }
  };

  const loadFromDrive = async (fileId: string) => {
      setIsLoading(true);
      try {
          const token = getDriveToken() || await connectGoogleDrive();
          const content = await readDriveFile(token, fileId);
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
              setElements(parsed);
              if (onDataChange) onDataChange(content);
          }
      } catch (e: any) {
          console.error("Drive load failed", e);
          alert("Could not load from Drive. Private files require creator permissions.");
      } finally {
          setIsLoading(false);
      }
  };

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
          // Fix: Now uses the correctly defined state variables startArrow and endArrow
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
          
          if (sessionId && !sessionId.startsWith('local-')) {
              await updateWhiteboardElement(sessionId, finalized);
          }
          setCurrentElement(null);
          setIsDrawing(false);
      }
  };

  const handleShare = async () => {
      setIsSyncing(true);
      try {
          const sid = sessionId || generateSecureId();
          await saveWhiteboardSession(sid, elements);
          setSessionId(sid);
          const url = `${window.location.origin}?view=whiteboard&id=${sid}&mode=view`;
          setShareUrl(url);
          setShowShareModal(true);
      } catch (e: any) {
          alert("Sharing failed: " + e.message);
      } finally {
          setIsSyncing(false);
      }
  };

  const handleArchiveToDrive = async () => {
      if (!auth.currentUser) return alert("Sign in to save archives to Google Drive.");
      setIsSyncing(true);
      try {
          const token = getDriveToken() || await connectGoogleDrive();
          const studioFolderId = await ensureFolder(token, 'CodeStudio');
          const boardsFolderId = await ensureFolder(token, 'Whiteboards', studioFolderId);
          const fileName = `Whiteboard_Archive_${new Date().toISOString().slice(0,10)}.draw`;
          await uploadToDrive(token, boardsFolderId, fileName, new Blob([JSON.stringify(elements)], { type: 'application/json' }));
          alert("Successfully archived to your Google Drive!");
      } catch (e: any) {
          alert("Drive sync failed: " + e.message);
      } finally {
          setIsSyncing(false);
      }
  };

  const handleExportPNG = async () => {
    if (!canvasRef.current) return;
    const blob = await new Promise<Blob>((resolve) => canvasRef.current!.toBlob(b => resolve(b!), 'image/png'));
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `whiteboard_${Date.now()}.png`;
    a.click();
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
      
      const renderElement = (el: WhiteboardElement) => {
          ctx.save(); 
          ctx.beginPath(); 
          ctx.strokeStyle = el.color; 
          ctx.lineCap = 'round'; 
          ctx.lineJoin = 'round';
          const styleConfig = LINE_STYLES.find(s => s.value === (el.lineStyle || 'solid'));
          ctx.setLineDash(styleConfig?.dash || []);

          if (el.type === 'pen' || el.type === 'eraser') {
              if (el.points?.length) {
                  ctx.lineWidth = el.strokeWidth / scale;
                  ctx.moveTo(el.points[0].x, el.points[0].y);
                  el.points.forEach(p => ctx.lineTo(p.x, p.y));
                  ctx.stroke();
              }
          } else if (el.type === 'rect') { 
              ctx.lineWidth = el.strokeWidth / scale;
              ctx.strokeRect(el.x, el.y, el.width || 0, el.height || 0);
          } else if (el.type === 'circle') { 
              ctx.lineWidth = el.strokeWidth / scale; 
              ctx.ellipse(el.x + (el.width||0)/2, el.y + (el.height||0)/2, Math.abs((el.width||0)/2), Math.abs((el.height||0)/2), 0, 0, 2*Math.PI); 
              ctx.stroke(); 
          } else if (el.type === 'line' || el.type === 'arrow') { 
              ctx.lineWidth = el.strokeWidth / scale; 
              ctx.moveTo(el.x, el.y); 
              ctx.lineTo(el.endX || el.x, el.endY || el.y); 
              ctx.stroke(); 
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
                </div>
            </div>

            <div className="flex items-center gap-2">
                <button onClick={handleArchiveToDrive} disabled={isSyncing} className={`flex items-center gap-2 px-3 py-1.5 ${isDarkBackground ? 'bg-slate-800 hover:bg-slate-700 text-indigo-400 border-slate-700' : 'bg-white hover:bg-slate-100 text-indigo-600 border-slate-200'} text-xs font-bold rounded-lg border shadow-sm`}>
                    <CloudDownload size={14}/>
                    <span className="hidden sm:inline">Archive to Drive</span>
                </button>
                <button onClick={handleShare} disabled={isSyncing} className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-indigo-500/20 disabled:opacity-50">
                    {isSyncing ? <Loader2 size={14} className="animate-spin"/> : <Share2 size={14}/>}
                    <span className="hidden sm:inline">Share URI</span>
                </button>
                <div className={`w-px h-6 ${isDarkBackground ? 'bg-slate-800' : 'bg-slate-200'} mx-1`}></div>
                <button onClick={() => setElements([])} className={`p-1.5 rounded transition-colors ${isDarkBackground ? 'hover:bg-slate-800 text-slate-400 hover:text-red-400' : 'hover:bg-slate-200 text-slate-600 hover:text-red-600'}`} title="Clear Canvas"><Trash2 size={16} /></button>
            </div>
        </div>
        
        <div className={`flex-1 relative overflow-hidden ${isDarkBackground ? 'bg-slate-950' : 'bg-white'} touch-none`}>
            {isLoading && (
                <div className="absolute inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                    <Loader2 size={32} className="animate-spin text-indigo-500"/>
                    <span className="text-xs font-bold text-indigo-200 uppercase tracking-widest">Syncing Whiteboard...</span>
                </div>
            )}
            <canvas 
                ref={canvasRef} 
                onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
                onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing}
                className="block w-full h-full cursor-crosshair" 
            />
        </div>

        {showShareModal && (
            <ShareModal 
                isOpen={true} onClose={() => setShowShareModal(false)} link={shareUrl} title="Collaborative Whiteboard"
                onShare={async (selectedUids, isPublic, permission) => {}}
                currentUserUid={auth?.currentUser?.uid}
            />
        )}
    </div>
  );
};
