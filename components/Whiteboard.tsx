
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Share2, Trash2, Undo, PenTool, Eraser, Download, Square, Circle, Minus, ArrowRight, Type, ZoomIn, ZoomOut, MousePointer2, Move, MoreHorizontal, Lock, Eye, Edit3, GripHorizontal, Brush, ChevronDown, Feather, Highlighter, Wind, Droplet, Cloud, Edit2, Pen, Copy, Clipboard, BringToFront, SendToBack, Sparkles, Send, Loader2, X, RotateCw, Triangle, Star, Spline, Maximize, Scissors, Shapes, Palette, Settings2, Languages } from 'lucide-react';
import { auth } from '../services/firebaseConfig';
import { saveWhiteboardSession, subscribeToWhiteboard, updateWhiteboardElement, deleteWhiteboardElements } from '../services/firestoreService';
import { WhiteboardElement, ToolType, LineStyle, BrushType } from '../types';
import { GoogleGenAI } from '@google/genai';

interface WhiteboardProps {
  onBack?: () => void;
  sessionId?: string;
  accessKey?: string;
  onSessionStart?: (id: string) => void;
  initialData?: string; 
  onDataChange?: (data: string) => void;
  isReadOnly?: boolean;
  disableAI?: boolean; 
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
  sessionId, 
  accessKey, 
  onSessionStart,
  initialData, 
  onDataChange,
  isReadOnly: propReadOnly = false,
  disableAI = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [elements, setElements] = useState<WhiteboardElement[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentElement, setCurrentElement] = useState<WhiteboardElement | null>(null);
  
  const [tool, setTool] = useState<ToolType>('pen');
  const [color, setColor] = useState('#ffffff');
  const [lineWidth, setLineWidth] = useState(6); // Default thicker for brush
  const [lineStyle, setLineStyle] = useState<LineStyle>('solid');
  const [brushType, setBrushType] = useState<BrushType>('writing-brush');
  const [fontSize, setFontSize] = useState(24);
  const [fontFamily, setFontFamily] = useState('sans-serif');
  const [borderRadius, setBorderRadius] = useState(0); 
  const [showShareDropdown, setShowShareDropdown] = useState(false);
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  
  const [activeCurvePoints, setActiveCurvePoints] = useState<{x: number, y: number}[]>([]);
  const [curveMousePos, setCurveMousePos] = useState<{x: number, y: number} | null>(null);
  const [startArrow, setStartArrow] = useState(false);
  const [endArrow, setEndArrow] = useState(false);
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ startX: number, startY: number, currX: number, currY: number } | null>(null);
  const [clipboard, setClipboard] = useState<WhiteboardElement[]>([]);
  
  const dragStartPos = useRef<{x: number, y: number} | null>(null);
  const initialSelectionStates = useRef<Map<string, WhiteboardElement>>(new Map());

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const lastPanPoint = useRef({ x: 0, y: 0 });
  
  const [isSharedSession, setIsSharedSession] = useState(!!sessionId);
  const [isReadOnly, setIsReadOnly] = useState(propReadOnly);
  const currentSessionIdRef = useRef<string>(sessionId || crypto.randomUUID());

  const [textInput, setTextInput] = useState<{ id: string; x: number; y: number; text: string; width?: number; height?: number; rotation?: number } | null>(null);
  const [writeToken, setWriteToken] = useState<string | undefined>(accessKey);

  const [showAIPrompt, setShowAIPrompt] = useState(false);
  const [aiPromptText, setAiPromptText] = useState('');
  const [isAIGenerating, setIsAIGenerating] = useState(false);

  useEffect(() => {
    if (sessionId) {
        setIsSharedSession(true);
        currentSessionIdRef.current = sessionId;
        const unsubscribe = subscribeToWhiteboard(sessionId, (remoteElements: any) => {
            if (Array.isArray(remoteElements)) setElements(remoteElements);
        });
        if (accessKey) { setWriteToken(accessKey); setIsReadOnly(false); }
        else if (!writeToken) setIsReadOnly(true);
        return () => unsubscribe();
    }
  }, [sessionId, accessKey]);

  const sharpenStroke = (points: {x: number, y: number}[]): {x: number, y: number}[] => {
      if (points.length < 3) return points;
      const last = points[points.length - 1];
      const prev = points[points.length - 2];
      
      const dx = last.x - prev.x;
      const dy = last.y - prev.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 2) return points; // Too slow to sharpen
      
      // Add 3 fading points in same trajectory to create the sharp tip
      const sharpened = [...points];
      for (let i = 1; i <= 3; i++) {
          sharpened.push({
              x: last.x + (dx / dist) * (i * 4),
              y: last.y + (dy / dist) * (i * 4)
          });
      }
      return sharpened;
  };

  const getElementBounds = (el: WhiteboardElement) => {
      if (el.type === 'pen' || el.type === 'eraser' || el.type === 'curve') {
          if (!el.points || el.points.length === 0) return { x: el.x, y: el.y, w: 0, h: 0 };
          const xs = el.points.map(p => p.x); const ys = el.points.map(p => p.y);
          const minX = Math.min(...xs); const maxX = Math.max(...xs);
          const minY = Math.min(...ys); const maxY = Math.max(...ys);
          return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
      } else if (el.type === 'line' || el.type === 'arrow') {
          return { x: Math.min(el.x, el.endX || el.x), y: Math.min(el.y, el.endY || el.y), w: Math.abs((el.endX || el.x) - el.x), h: Math.abs((el.endY || el.y) - el.y) };
      } else if (el.type === 'text') {
          const fs = el.fontSize || 24; let w = el.width || (el.text?.length || 0) * fs * 0.6;
          let h = el.height || (el.text?.split('\n').length || 1) * fs * 1.2;
          return { x: el.x, y: el.y, w, h };
      }
      return { x: el.x, y: el.y, w: el.width || 0, h: el.height || 0 };
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
          id, type: tool, x, y, color: tool === 'eraser' ? '#0f172a' : color, 
          strokeWidth: tool === 'eraser' ? 20 : lineWidth, 
          brushType: tool === 'eraser' ? 'standard' : brushType, 
          points: tool === 'pen' || tool === 'eraser' ? [{ x, y }] : undefined, 
          width: 0, height: 0, endX: x, endY: y, rotation: 0 
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

  const stopDrawing = () => {
      if (isDrawing && currentElement) {
          let finalized = { ...currentElement };
          // Apply sharpening to Chinese brush strokes on finish
          if (finalized.brushType === 'writing-brush' && finalized.points) {
              finalized.points = sharpenStroke(finalized.points);
          }
          const next = [...elements, finalized];
          setElements(next);
          if (onDataChange) onDataChange(JSON.stringify(next));
          if (isSharedSession && !isReadOnly) updateWhiteboardElement(currentSessionIdRef.current, finalized);
          setCurrentElement(null);
          setIsDrawing(false);
      }
  };

  useEffect(() => {
      const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return;
      canvas.width = canvas.parentElement?.clientWidth || 800; canvas.height = canvas.parentElement?.clientHeight || 600;
      ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.save(); ctx.translate(offset.x, offset.y); ctx.scale(scale, scale);
      
      const renderElement = (el: WhiteboardElement) => {
          ctx.save();
          ctx.beginPath(); ctx.strokeStyle = el.color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          
          if (el.type === 'pen' || el.type === 'eraser') {
              if (el.points?.length) {
                  if (el.brushType === 'writing-brush' && el.type !== 'eraser') {
                      // Calligraphy Engine
                      for (let i = 1; i < el.points.length; i++) {
                          const p1 = el.points[i - 1];
                          const p2 = el.points[i];
                          const d = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
                          
                          // Sharp End Heuristics:
                          // As we approach the end of the point array, we start tapering more aggressively
                          const isNearEnd = i > el.points.length - 5;
                          const endTaper = isNearEnd ? (el.points.length - i) / 5 : 1.0;
                          
                          // Velocity-based pressure (Fast = Thin)
                          const speedPressure = Math.max(0.1, 2.0 - (d / 8));
                          const finalPressure = speedPressure * endTaper;
                          
                          ctx.lineWidth = (el.strokeWidth * finalPressure) / scale;
                          ctx.globalAlpha = Math.min(1.0, Math.max(0.3, finalPressure));
                          
                          ctx.beginPath();
                          if (i > 1) {
                              const p0 = el.points[i - 2];
                              const mx1 = (p0.x + p1.x) / 2; const my1 = (p0.y + p1.y) / 2;
                              const mx2 = (p1.x + p2.x) / 2; const my2 = (p1.y + p2.y) / 2;
                              ctx.moveTo(mx1, my1);
                              ctx.quadraticCurveTo(p1.x, p1.y, mx2, my2);
                          } else {
                              ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
                          }
                          ctx.stroke();
                      }
                  } else {
                      ctx.lineWidth = el.strokeWidth / scale;
                      ctx.moveTo(el.points[0].x, el.points[0].y);
                      el.points.forEach(p => ctx.lineTo(p.x, p.y));
                      ctx.stroke();
                  }
              }
          } else if (el.type === 'rect') { ctx.lineWidth = el.strokeWidth / scale; ctx.strokeRect(el.x, el.y, el.width || 0, el.height || 0); }
          else if (el.type === 'circle') { ctx.lineWidth = el.strokeWidth / scale; ctx.ellipse(el.x + (el.width||0)/2, el.y + (el.height||0)/2, Math.abs((el.width||0)/2), Math.abs((el.height||0)/2), 0, 0, 2*Math.PI); ctx.stroke(); }
          else if (el.type === 'line' || el.type === 'arrow') { ctx.lineWidth = el.strokeWidth / scale; ctx.moveTo(el.x, el.y); ctx.lineTo(el.endX||el.x, el.endY||el.y); ctx.stroke(); }
          ctx.restore();
      };

      elements.forEach(renderElement);
      if (currentElement) renderElement(currentElement);
      ctx.restore();
  }, [elements, currentElement, scale, offset]);

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden relative">
        <div className={`bg-slate-900 border-b border-slate-800 p-2 flex flex-wrap justify-center gap-2 shrink-0 z-10 items-center`}>
            <div className="flex bg-slate-800 rounded-lg p-1 mr-2">
                <button onClick={() => setTool('pen')} className={`p-1.5 rounded ${tool === 'pen' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><PenTool size={16}/></button>
                <button onClick={() => setTool('eraser')} className={`p-1.5 rounded ${tool === 'eraser' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><Eraser size={16}/></button>
            </div>

            <div className="flex bg-slate-800 rounded-lg p-1">
                {BRUSH_TYPES.map(bt => (
                    <button 
                        key={bt.value} 
                        onClick={() => setBrushType(bt.value)}
                        className={`p-1.5 rounded transition-all ${brushType === bt.value ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}
                        title={bt.label}
                    >
                        <bt.icon size={16}/>
                    </button>
                ))}
            </div>

            <div className="flex bg-slate-800 rounded-lg p-1">
                <button onClick={() => setTool('rect')} className={`p-1.5 rounded ${tool === 'rect' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><Square size={16}/></button>
                <button onClick={() => setTool('circle')} className={`p-1.5 rounded ${tool === 'circle' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><Circle size={16}/></button>
                <button onClick={() => setTool('line')} className={`p-1.5 rounded ${tool === 'line' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><Minus size={16}/></button>
            </div>
            
            <div className="flex gap-1 px-2 bg-slate-800 rounded-lg py-1 items-center">
                {['#ffffff', '#ef4444', '#22c55e', '#3b82f6', '#f59e0b'].map(c => <button key={c} onClick={() => setColor(c)} className={`w-4 h-4 rounded-full border border-black/20 ${color === c ? 'ring-2 ring-white/50' : ''}`} style={{ backgroundColor: c }} />)}
            </div>
            
            <div className="flex gap-1 ml-auto">
                <button onClick={() => setElements(prev => prev.slice(0, -1))} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 transition-colors"><Undo size={16} /></button>
                <button onClick={() => setElements([])} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-red-400 transition-colors"><Trash2 size={16} /></button>
            </div>
        </div>
        <div className={`flex-1 relative overflow-hidden bg-slate-950 touch-none`}>
            <canvas 
                ref={canvasRef} 
                onMouseDown={startDrawing} 
                onMouseMove={draw} 
                onMouseUp={stopDrawing} 
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="block w-full h-full cursor-crosshair" 
            />
        </div>
    </div>
  );
};
