// FIXED: Using namespace import for React to ensure JSX intrinsic elements are recognized correctly
import * as React from 'react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ArrowLeft, Share2, Trash2, Undo, PenTool, Eraser, Download, Square, Circle, Minus, ArrowRight, Type, ZoomIn, ZoomOut, MousePointer2, Move, MoreHorizontal, Lock, Eye, Edit3, GripHorizontal, Brush, ChevronDown, Feather, Highlighter, Wind, Droplet, Cloud, Edit2, Pen, Copy, Clipboard, BringToFront, SendToBack, Sparkles, Send, Loader2, X, RotateCw, RotateCcw, Triangle, Star, Spline, Maximize, Scissors, Shapes, Palette, Settings2, Languages, ArrowUpLeft, ArrowDownRight, HardDrive, Check, Sliders, CloudDownload, Save, Activity, RefreshCcw, Type as TypeIcon } from 'lucide-react';
import { auth, db } from '../services/firebaseConfig';
import { saveWhiteboardSession, subscribeToWhiteboard, updateWhiteboardElement, deleteWhiteboardElements } from '../services/firestoreService';
import { WhiteboardElement, ToolType, LineStyle, BrushType } from '../types';
import { generateSecureId } from '../utils/idUtils';
import { getDriveToken, connectGoogleDrive } from '../services/authService';
import { ensureFolder, uploadToDrive, readDriveFile } from '../services/googleDriveService';
import { ShareModal } from './ShareModal';

interface WhiteboardProps {
  onBack?: () => void;
  sessionId?: string;
  driveId?: string; 
  onSessionStart?: (id: string) => void;
  isReadOnly?: boolean;
  initialColor?: string;
  backgroundColor?: string;
  initialData?: string; 
  onDataChange?: (data: string) => void; 
}

const LINE_STYLES: { label: string; value: LineStyle; dash: number[] }[] = [
    { label: 'Solid', value: 'solid', dash: [] },
    { label: 'Dashed', value: 'dashed', dash: [15, 10] },
    { label: 'Dotted', value: 'dotted', dash: [2, 6] },
    { label: 'Dash-Dot', value: 'dash-dot', dash: [15, 5, 2, 5] },
    { label: 'Long Dash', value: 'long-dash', dash: [30, 10] }
];

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'end' | null;

export const Whiteboard: React.FC<WhiteboardProps> = ({ 
  onBack, 
  sessionId: propSessionId, 
  driveId: propDriveId,
  isReadOnly: propReadOnly = false,
  initialColor = '#ffffff',
  backgroundColor = '#0f172a',
  initialData,
  onDataChange
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [elements, setElements] = useState<WhiteboardElement[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentElement, setCurrentElement] = useState<WhiteboardElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);
  
  const [tool, setTool] = useState<ToolType>('pen');
  const [color, setColor] = useState(initialColor);
  const [lineWidth, setLineWidth] = useState(6);
  const [lineStyle, setLineStyle] = useState<LineStyle>('solid');
  const [brushType, setBrushType] = useState<BrushType>('standard');
  const [borderRadius, setBorderRadius] = useState(0); 
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [boardRotation, setBoardRotation] = useState(0); 
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [activeResizeHandle, setActiveResizeHandle] = useState<ResizeHandle>(null);

  const [textInput, setTextInput] = useState({ x: 0, y: 0, value: '', visible: false, editingId: null as string | null });
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  const [sessionId, setSessionId] = useState<string>(propSessionId || '');
  const [isReadOnly, setIsReadOnly] = useState(propReadOnly);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  const isDarkBackground = backgroundColor !== 'transparent' && backgroundColor !== '#ffffff';

  useEffect(() => {
    if (initialData) {
        try {
            const parsed = JSON.parse(initialData);
            if (Array.isArray(parsed)) {
                const currentDataStr = JSON.stringify(elements);
                if (initialData !== currentDataStr) {
                    setElements(parsed);
                }
            }
        } catch (e) {
            console.warn("Failed to parse initial whiteboard data", e);
        }
    }
  }, [initialData]);

  useEffect(() => {
      if (!sessionId || sessionId.startsWith('local-')) {
          setIsLive(false);
          return;
      }
      setIsLoading(true);
      const unsubscribe = subscribeToWhiteboard(sessionId, (remoteElements) => {
          setElements(remoteElements);
          setIsLoading(false);
          setIsLive(true);
      });
      return () => {
          unsubscribe();
          setIsLive(false);
      };
  }, [sessionId]);

  const getWorldCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
      if (!canvasRef.current) return { x: 0, y: 0 }; 
      const rect = canvasRef.current.getBoundingClientRect();
      const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
      
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      let x = clientX - rect.left - cx;
      let y = clientY - rect.top - cy;

      const rad = -(boardRotation * Math.PI) / 180;
      const rx = x * Math.cos(rad) - y * Math.sin(rad);
      const ry = x * Math.sin(rad) + y * Math.cos(rad);

      return { 
          x: (rx + cx - offset.x) / scale, 
          y: (ry + cy - offset.y) / scale 
      };
  };

  const getScreenCoordinates = (x: number, y: number) => {
      if (!canvasRef.current) return { x: 0, y: 0 };
      const rect = canvasRef.current.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      
      let wx = x * scale + offset.x;
      let wy = y * scale + offset.y;

      let rx = wx - cx;
      let ry = wy - cy;

      const rad = (boardRotation * Math.PI) / 180;
      const sx = rx * Math.cos(rad) - ry * Math.sin(rad);
      const sy = rx * Math.sin(rad) + ry * Math.cos(rad);

      return { x: sx + cx, y: sy + cy };
  };

  const getElementBounds = (el: WhiteboardElement) => {
      if (el.type === 'pen' || el.type === 'eraser') {
          const xs = el.points?.map(p => p.x) || [el.x];
          const ys = el.points?.map(p => p.y) || [el.y];
          return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
      }
      if (el.type === 'line' || el.type === 'arrow') {
          return { minX: Math.min(el.x, el.endX || el.x), minY: Math.min(el.y, el.endY || el.y), maxX: Math.max(el.x, el.endX || el.x), maxY: Math.max(el.y, el.endY || el.y) };
      }
      const w = el.width || 0;
      const h = el.height || 0;
      if (el.type === 'type') {
          const lines = el.text?.split('\n') || [];
          const fontSize = el.fontSize || 16;
          const maxWidth = Math.max(...lines.map(l => l.length)) * fontSize * 0.6;
          const height = lines.length * fontSize * 1.2;
          return { minX: el.x, minY: el.y, maxX: el.x + maxWidth, maxY: el.y + height };
      }
      return { minX: Math.min(el.x, el.x + w), minY: Math.min(el.y, el.y + h), maxX: Math.max(el.x, el.x + w), maxY: Math.max(el.y, el.y + h) };
  };

  const isPointInElement = (x: number, y: number, el: WhiteboardElement) => {
      const margin = 12 / scale;
      if (el.type === 'pen' || el.type === 'eraser') {
          return el.points?.some(p => Math.sqrt((p.x - x)**2 + (p.y - y)**2) < (el.strokeWidth / scale) + margin);
      }
      const bounds = getElementBounds(el);
      return x >= bounds.minX - margin && x <= bounds.maxX + margin && y >= bounds.minY - margin && y <= bounds.maxY + margin;
  };

  const getResizeHandleAt = (x: number, y: number, el: WhiteboardElement): ResizeHandle => {
      const handleSize = 10 / scale;
      const bounds = getElementBounds(el);
      if (el.type === 'line' || el.type === 'arrow') {
          if (Math.sqrt((x - (el.endX || el.x))**2 + (y - (el.endY || el.y))**2) < handleSize * 2) return 'end';
          return null;
      }
      const handles: { id: ResizeHandle, x: number, y: number }[] = [
          { id: 'nw', x: bounds.minX, y: bounds.minY },
          { id: 'ne', x: bounds.maxX, y: bounds.minY },
          { id: 'sw', x: bounds.minX, y: bounds.maxY },
          { id: 'se', x: bounds.maxX, y: bounds.maxY }
      ];
      const found = handles.find(h => Math.sqrt((x - h.x)**2 + (y - h.y)**2) < handleSize * 2);
      return found ? found.id : null;
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
      if (isReadOnly || textInput.visible) return;
      const { x, y } = getWorldCoordinates(e);

      if (tool === 'type') {
          setTextInput({ x, y, value: '', visible: true, editingId: null });
          setTimeout(() => textInputRef.current?.focus(), 50);
          return;
      }

      if (tool === 'move') {
          if (selectedElementId) {
              const el = elements.find(e => e.id === selectedElementId);
              if (el) {
                  const handle = getResizeHandleAt(x, y, el);
                  if (handle) {
                      setActiveResizeHandle(handle);
                      setDragStartPos({ x, y });
                      setIsDrawing(true);
                      return;
                  }
              }
          }

          const found = [...elements].reverse().find(el => isPointInElement(x, y, el));
          if (found) {
              setSelectedElementId(found.id);
              setDragStartPos({ x, y });
              setIsDrawing(true);
          } else {
              setSelectedElementId(null);
          }
          return;
      }

      setIsDrawing(true);
      const id = crypto.randomUUID();
      // FIXED: Defined startArrow and endArrow values for standard initialization
      const newEl: WhiteboardElement = { 
          id, type: tool, x, y, 
          color: tool === 'eraser' ? (backgroundColor === 'transparent' ? '#ffffff' : backgroundColor) : color, 
          strokeWidth: tool === 'eraser' ? 20 : lineWidth, 
          lineStyle: tool === 'eraser' ? 'solid' : lineStyle,
          brushType: tool === 'eraser' ? 'standard' : brushType, 
          points: tool === 'pen' || tool === 'eraser' ? [{ x, y }] : undefined, 
          width: 0, height: 0, endX: x, endY: y, borderRadius: tool === 'rect' ? borderRadius : undefined, rotation: 0,
          startArrow: ['line', 'arrow'].includes(tool) ? (tool === 'arrow' ? true : false) : undefined,
          endArrow: ['line', 'arrow'].includes(tool) ? (tool === 'arrow' ? true : false) : undefined
      };
      setCurrentElement(newEl);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing) return;
      const { x, y } = getWorldCoordinates(e);

      if (tool === 'move' && selectedElementId) {
          const dx = x - dragStartPos.x;
          const dy = y - dragStartPos.y;
          setElements(prev => prev.map(el => {
              if (el.id === selectedElementId) {
                  if (activeResizeHandle) {
                      const updated = { ...el };
                      if (activeResizeHandle === 'end') {
                          updated.endX = (updated.endX || updated.x) + dx;
                          updated.endY = (updated.endY || updated.y) + dy;
                      } else if (el.type === 'pen' || el.type === 'eraser') {
                          const bounds = getElementBounds(el);
                          const center = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
                          const scaleX = 1 + (dx / (bounds.maxX - bounds.minX || 1));
                          const scaleY = 1 + (dy / (bounds.maxY - bounds.minY || 1));
                          updated.points = el.points?.map(p => ({
                              x: center.x + (p.x - center.x) * scaleX,
                              y: center.y + (p.y - center.y) * scaleY
                          }));
                      } else {
                          if (activeResizeHandle.includes('e')) updated.width = (updated.width || 0) + dx;
                          if (activeResizeHandle.includes('s')) updated.height = (updated.height || 0) + dy;
                          if (activeResizeHandle.includes('w')) { updated.x += dx; updated.width = (updated.width || 0) - dx; }
                          if (activeResizeHandle.includes('n')) { updated.y += dy; updated.height = (updated.height || 0) - dy; }
                          if (el.type === 'type') {
                              const scaleFactor = 1 + (dy / 100);
                              updated.fontSize = Math.max(8, (updated.fontSize || 16) * scaleFactor);
                          }
                      }
                      return updated;
                  } else {
                      const updated = { ...el, x: el.x + dx, y: el.y + dy };
                      if (el.points) updated.points = el.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
                      if (el.endX !== undefined) updated.endX = el.endX + dx;
                      if (el.endY !== undefined) updated.endY = el.endY + dy;
                      return updated;
                  }
              }
              return el;
          }));
          setDragStartPos({ x, y });
          return;
      }

      if (!currentElement) return;
      if (tool === 'pen' || tool === 'eraser') { 
          setCurrentElement(prev => prev ? ({ ...prev, points: [...(prev.points || []), { x, y }] }) : null); 
      }
      else if (['rect','circle','triangle','star'].includes(tool)) { 
          setCurrentElement(prev => prev ? ({ ...prev, width: x - prev.x, height: y - prev.y }) : null); 
      }
      else if (tool === 'line' || tool === 'arrow') { 
          setCurrentElement(prev => prev ? ({ ...prev, endX: x, endY: y }) : null); 
      }
  };

  const stopDrawing = async () => {
      if (!isDrawing) return;
      if (tool === 'move' && selectedElementId) {
          const currentElements = [...elements];
          if (sessionId && !sessionId.startsWith('local-')) {
              await saveWhiteboardSession(sessionId, currentElements);
          }
          if (onDataChange) {
              onDataChange(JSON.stringify(currentElements));
          }
          setIsDrawing(false);
          setActiveResizeHandle(null);
          return;
      }
      if (currentElement) {
          const finalized = { ...currentElement };
          const nextElements = [...elements, finalized];
          setElements(nextElements);
          if (sessionId && !sessionId.startsWith('local-')) {
              await updateWhiteboardElement(sessionId, finalized);
          }
          if (onDataChange) {
              onDataChange(JSON.stringify(nextElements));
          }
          setCurrentElement(null);
          setIsDrawing(false);
      }
  };

  const handleTextCommit = async () => {
      if (!textInput.value.trim()) {
          setTextInput({ ...textInput, visible: false, editingId: null });
          return;
      }

      let nextElements = [...elements];
      if (textInput.editingId) {
          nextElements = elements.map(el => {
              if (el.id === textInput.editingId) {
                  return { ...el, text: textInput.value };
              }
              return el;
          });
          setElements(nextElements);
          if (sessionId && !sessionId.startsWith('local-')) {
              await saveWhiteboardSession(sessionId, nextElements);
          }
      } else {
          const id = crypto.randomUUID();
          const textEl: WhiteboardElement = {
              id, type: 'type', x: textInput.x, y: textInput.y,
              color, strokeWidth: lineWidth, text: textInput.value,
              fontSize: 24
          };
          nextElements = [...elements, textEl];
          setElements(nextElements);
          if (sessionId && !sessionId.startsWith('local-')) {
              await updateWhiteboardElement(sessionId, textEl);
          }
      }
      if (onDataChange) onDataChange(JSON.stringify(nextElements));
      setTextInput({ ...textInput, visible: false, value: '', editingId: null });
  };

  useEffect(() => {
      const canvas = canvasRef.current; if (!canvas) return; 
      const ctx = canvas.getContext('2d'); if (!ctx) return;
      
      canvas.width = canvas.parentElement?.clientWidth || 800; 
      canvas.height = canvas.parentElement?.clientHeight || 600;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height); 
      
      if (backgroundColor !== 'transparent') {
          ctx.fillStyle = backgroundColor; 
          ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.save(); 
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      ctx.translate(cx, cy);
      ctx.rotate((boardRotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);
      
      ctx.translate(offset.x, offset.y); 
      ctx.scale(scale, scale);
      
      const drawArrowHead = (x1: number, y1: number, x2: number, y2: number, size: number, color: string) => {
          const angle = Math.atan2(y2 - y1, x2 - x1);
          ctx.save(); ctx.translate(x2, y2); ctx.rotate(angle); ctx.beginPath(); 
          ctx.moveTo(0, 0); ctx.lineTo(-size, -size / 2); ctx.lineTo(-size, size / 2); 
          ctx.closePath(); ctx.fillStyle = color; ctx.fill(); ctx.restore();
      };

      const renderElement = (el: WhiteboardElement) => {
          ctx.save(); 
          ctx.beginPath(); 
          ctx.strokeStyle = el.color; 
          ctx.lineCap = 'round'; 
          ctx.lineJoin = 'round';
          
          const styleConfig = LINE_STYLES.find(s => s.value === (el.lineStyle || 'solid'));
          ctx.setLineDash(styleConfig?.dash || []);

          if (el.id === selectedElementId && tool === 'move') {
              const bounds = getElementBounds(el);
              ctx.save();
              ctx.strokeStyle = '#6366f1'; 
              ctx.lineWidth = 1 / scale; 
              ctx.setLineDash([5, 5]);
              ctx.strokeRect(bounds.minX - 5, bounds.minY - 5, (bounds.maxX - bounds.minX) + 10, (bounds.maxY - bounds.minY) + 10);
              ctx.restore();
          }

          if (el.type === 'type' && el.text) {
              ctx.fillStyle = el.color;
              ctx.font = `${(el.fontSize || 16)}px 'JetBrains Mono', monospace`;
              ctx.textBaseline = 'top';
              const lines = el.text.split('\n');
              lines.forEach((line, i) => {
                  ctx.fillText(line, el.x, el.y + (i * (el.fontSize || 16) * 1.2));
              });
          } else if (el.type === 'pen' || el.type === 'eraser') {
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
              const x1 = el.x; const y1 = el.y; const x2 = el.endX || el.x; const y2 = el.endY || el.y;
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
  }, [elements, currentElement, scale, offset, boardRotation, backgroundColor, selectedElementId, tool]);

  const overlayPos = textInput.visible ? getScreenCoordinates(textInput.x, textInput.y) : { x: 0, y: 0 };

  // FIXED: Explicit usage of standard HTML tags under React namespace to resolve intrinsic elements
  return (
    <div className={`flex flex-col h-full ${isDarkBackground ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'} overflow-hidden relative`}>
        <div className={`${isDarkBackground ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'} border-b p-2 flex flex-wrap justify-between gap-2 shrink-0 z-10 items-center px-4`}>
            <div className="flex items-center gap-2">
                {onBack && <button onClick={onBack} className={`p-2 rounded-lg ${isDarkBackground ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-200 text-slate-600'} mr-2`}><ArrowLeft size={20}/></button>}
                
                <div className={`flex ${isDarkBackground ? 'bg-slate-800' : 'bg-slate-200'} rounded-lg p-1 mr-2`}>
                    <button onClick={() => setTool('pen')} className={`p-1.5 rounded ${tool === 'pen' ? 'bg-indigo-600 text-white shadow-lg' : (isDarkBackground ? 'text-slate-400' : 'text-slate-600')}`} title="Pen"><PenTool size={16}/></button>
                    <button onClick={() => setTool('type')} className={`p-1.5 rounded ${tool === 'type' ? 'bg-indigo-600 text-white shadow-lg' : (isDarkBackground ? 'text-slate-400' : 'text-slate-600')}`} title="Text"><TypeIcon size={16}/></button>
                    <button onClick={() => setTool('move')} className={`p-1.5 rounded ${tool === 'move' ? 'bg-indigo-600 text-white shadow-lg' : (isDarkBackground ? 'text-slate-400' : 'text-slate-600')}`} title="Move"><MousePointer2 size={16}/></button>
                    <button onClick={() => setTool('eraser')} className={`p-1.5 rounded ${tool === 'eraser' ? 'bg-indigo-600 text-white shadow-lg' : (isDarkBackground ? 'text-slate-400' : 'text-slate-600')}`} title="Eraser"><Eraser size={16}/></button>
                </div>

                <div className={`flex ${isDarkBackground ? 'bg-slate-800' : 'bg-slate-200'} rounded-lg p-1 mr-2`}>
                    <button onClick={() => setTool('rect')} className={`p-1.5 rounded ${tool === 'rect' ? 'bg-indigo-600 text-white' : (isDarkBackground ? 'text-slate-400' : 'text-slate-600')}`} title="Rectangle"><Square size={16}/></button>
                    <button onClick={() => setTool('circle')} className={`p-1.5 rounded ${tool === 'circle' ? 'bg-indigo-600 text-white' : (isDarkBackground ? 'text-slate-400' : 'text-slate-600')}`} title="Circle"><Circle size={16}/></button>
                    <button onClick={() => setTool('line')} className={`p-1.5 rounded ${tool === 'line' ? 'bg-indigo-600 text-white' : (isDarkBackground ? 'text-slate-400' : 'text-slate-600')}`} title="Line"><Minus size={16}/></button>
                    <button onClick={() => setTool('arrow')} className={`p-1.5 rounded ${tool === 'arrow' ? 'bg-indigo-600 text-white' : (isDarkBackground ? 'text-slate-400' : 'text-slate-600')}`} title="Arrow"><ArrowRight size={16}/></button>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border border-slate-700 bg-transparent" title="Stroke Color"/>
                <div className="h-4 w-px bg-slate-800 mx-2"/>
                <button onClick={() => setScale(s => s * 1.1)} className="p-2 hover:bg-slate-800 rounded text-slate-400"><ZoomIn size={16}/></button>
                <button onClick={() => setScale(s => s * 0.9)} className="p-2 hover:bg-slate-800 rounded text-slate-400"><ZoomOut size={16}/></button>
                <button onClick={() => setElements([])} className="p-2 hover:bg-red-900/30 text-red-400 rounded transition-colors" title="Clear All"><Trash2 size={18}/></button>
            </div>
        </div>

        <div className="flex-1 relative overflow-hidden touch-none cursor-crosshair">
            <canvas 
                ref={canvasRef} 
                onMouseDown={startDrawing} 
                onMouseMove={draw} 
                onMouseUp={stopDrawing} 
                onTouchStart={startDrawing} 
                onTouchMove={draw} 
                onTouchEnd={stopDrawing}
                className="w-full h-full block"
            />
            {textInput.visible && (
                <div style={{ position: 'absolute', left: overlayPos.x, top: overlayPos.y, zIndex: 100 }} className="animate-fade-in">
                    <textarea 
                        ref={textInputRef} 
                        value={textInput.value} 
                        onChange={e => setTextInput({ ...textInput, value: e.target.value })} 
                        onBlur={handleTextCommit}
                        className="bg-slate-900 border-2 border-indigo-500 text-white p-2 rounded-lg shadow-2xl min-w-[200px] min-h-[40px] outline-none"
                    />
                </div>
            )}
        </div>
    </div>
  );
};