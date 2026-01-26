
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Share2, Trash2, Undo, PenTool, Pen, Eraser, Download, Square, Circle, Minus, ArrowRight, Type, ZoomIn, ZoomOut, MousePointer2, Move, MoreHorizontal, Lock, Eye, Edit3, GripHorizontal, Brush, ChevronDown, Feather, Highlighter, Wind, Droplet, Cloud, Edit2, Copy, Clipboard, BringToFront, SendToBack, Sparkles, Send, Loader2, X, RotateCw, RotateCcw, Triangle, Star, Spline, Maximize, Scissors, Shapes, Palette, Settings2, Languages, ArrowUpLeft, ArrowDownRight, HardDrive, Check, Sliders, CloudDownload, Save, Activity, RefreshCcw, Type as TypeIcon, Hand } from 'lucide-react';
import { auth, db } from '../services/firebaseConfig';
import { subscribeToWhiteboard, updateWhiteboardElement, deleteWhiteboardElements, saveWhiteboardSession } from '../services/firestoreService';
import { WhiteboardElement, ToolType, LineStyle, BrushType, CapStyle } from '../types';
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
  initialContent?: string;
  initialImage?: string; 
  onChange?: (content: string) => void;
}

const LINE_STYLES: { label: string; value: LineStyle; dash: number[] }[] = [
    { label: 'Solid', value: 'solid', dash: [] },
    { label: 'Dashed', value: 'dashed', dash: [12, 8] },
    { label: 'Dotted', value: 'dotted', dash: [2, 6] },
    { label: 'Dash-Dot', value: 'dash-dot', dash: [12, 5, 2, 5] },
    { label: 'Long Dash', value: 'long-dash', dash: [24, 12] }
];

const BRUSH_TYPES: { label: string; value: BrushType; icon: any }[] = [
    { label: 'Standard', value: 'standard', icon: PenTool },
    { label: 'Pencil', value: 'pencil', icon: Feather },
    { label: 'Marker', value: 'marker', icon: Highlighter },
    { label: 'Airbrush', value: 'airbrush', icon: Wind },
    { label: 'Calligraphy', value: 'calligraphy-pen', icon: Edit2 },
    { label: 'Chinese Ink', value: 'writing-brush', icon: Languages }
];

const CAP_STYLES: { label: string; value: CapStyle; icon: any }[] = [
    { label: 'None', value: 'none', icon: Minus },
    { label: 'Arrow', value: 'arrow', icon: ArrowRight },
    { label: 'Circle', value: 'circle', icon: Circle }
];

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'end' | null;

export const Whiteboard: React.FC<WhiteboardProps> = ({ 
  onBack, 
  sessionId: propSessionId, 
  driveId: propDriveId,
  isReadOnly: propReadOnly = false,
  initialColor = '#ffffff',
  backgroundColor = '#000000', 
  initialContent,
  initialImage,
  onChange
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const [elements, setElements] = useState<WhiteboardElement[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentElement, setCurrentElement] = useState<WhiteboardElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);
  
  const [tool, setTool] = useState<ToolType>('pen');
  const [color, setColor] = useState(initialColor);
  const [currentBgColor, setCurrentBgColor] = useState(backgroundColor); 
  const [lineWidth, setLineWidth] = useState(2); 
  const [lineStyle, setLineStyle] = useState<LineStyle>('solid');
  const [brushType, setBrushType] = useState<BrushType>('standard');
  const [startCap, setStartCap] = useState<CapStyle>('none');
  const [endCap, setEndCap] = useState<CapStyle>('none');
  const [borderRadius, setBorderRadius] = useState(0); 
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [boardRotation, setBoardRotation] = useState(0); 
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [activeResizeHandle, setActiveResizeHandle] = useState<ResizeHandle>(null);
  const [clipboardBuffer, setClipboardBuffer] = useState<WhiteboardElement[]>([]);
  const [selectionRect, setSelectionRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);

  const lastKnownContentRef = useRef<string>('');
  const [partialPoints, setPartialPoints] = useState<{x: number, y: number}[]>([]);
  const [mousePos, setMousePos] = useState<{x: number, y: number}>({x:0, y:0});
  const [textInput, setTextInput] = useState({ x: 0, y: 0, value: '', visible: false, editingId: null as string | null });
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  const [sessionId, setSessionId] = useState<string>(propSessionId || '');
  const [isReadOnly, setIsReadOnly] = useState(propReadOnly);

  const isDarkBackground = currentBgColor !== 'transparent' && currentBgColor !== '#ffffff';

  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const [bgImageReady, setBgImageReady] = useState(false);

  useEffect(() => {
    if (initialImage) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            bgImageRef.current = img;
            setBgImageReady(true);
        };
        img.onerror = () => {
            bgImageRef.current = null;
            setBgImageReady(false);
        };
        img.src = initialImage;
    } else {
        bgImageRef.current = null;
        setBgImageReady(false);
    }
  }, [initialImage]);

  const finalizeCurve = useCallback(async () => {
    if (partialPoints.length < 2) {
        setPartialPoints([]);
        return;
    }
    const id = crypto.randomUUID();
    const newEl: WhiteboardElement = {
        id, type: 'curve', x: partialPoints[0].x, y: partialPoints[0].y,
        color, strokeWidth: lineWidth, lineStyle, brushType,
        points: [...partialPoints],
        startCap, endCap
    };
    const nextElements = [...elements, newEl];
    setElements(nextElements);
    setPartialPoints([]);
    if (sessionId && !sessionId.startsWith('local-')) {
        await updateWhiteboardElement(sessionId, newEl);
    }
  }, [partialPoints, color, lineWidth, lineStyle, brushType, startCap, endCap, elements, sessionId]);

  const handleCopy = useCallback(() => {
    if (selectedElementIds.length === 0) return;
    const selected = elements.filter(e => selectedElementIds.includes(e.id));
    setClipboardBuffer(JSON.parse(JSON.stringify(selected)));
  }, [selectedElementIds, elements]);

  const handlePaste = useCallback(async () => {
    if (clipboardBuffer.length === 0 || isReadOnly) return;
    
    const pasteOffset = 20;
    const newElements: WhiteboardElement[] = [];
    const newIds: string[] = [];

    clipboardBuffer.forEach(item => {
        const newId = crypto.randomUUID();
        const pasted: WhiteboardElement = {
            ...JSON.parse(JSON.stringify(item)),
            id: newId,
            x: item.x + pasteOffset,
            y: item.y + pasteOffset
        };

        if (pasted.points) {
            pasted.points = pasted.points.map(p => ({ x: p.x + pasteOffset, y: p.y + pasteOffset }));
        }
        if (pasted.endX !== undefined) pasted.endX += pasteOffset;
        if (pasted.endY !== undefined) pasted.endY += pasteOffset;

        newElements.push(pasted);
        newIds.push(newId);
    });

    const nextElements = [...elements, ...newElements];
    setElements(nextElements);
    setSelectedElementIds(newIds);
    setClipboardBuffer(newElements); 

    if (sessionId && !sessionId.startsWith('local-')) {
        for (const el of newElements) {
            await updateWhiteboardElement(sessionId, el);
        }
    }
  }, [clipboardBuffer, elements, isReadOnly, sessionId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isReadOnly || textInput.visible) return;

      if ((e.ctrlKey || e.metaKey)) {
          if (e.key === 'c' || e.key === 'C') { e.preventDefault(); handleCopy(); }
          if (e.key === 'v' || e.key === 'V') { e.preventDefault(); handlePaste(); }
      }

      if (selectedElementIds.length > 0 && (e.key === 'Delete' || e.key === 'Backspace')) {
        handleDeleteSelected();
      }
      if (e.key === 'Escape') {
          if (tool === 'curve' && partialPoints.length > 0) { finalizeCurve(); }
          setSelectedElementIds([]);
          setSelectionRect(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementIds, isReadOnly, textInput.visible, tool, partialPoints, finalizeCurve, handleCopy, handlePaste]);

  useEffect(() => {
    if (initialContent !== undefined && initialContent !== lastKnownContentRef.current) {
        try {
            const parsed = initialContent === '' ? [] : JSON.parse(initialContent);
            if (Array.isArray(parsed)) {
                setElements(parsed);
                lastKnownContentRef.current = initialContent;
            }
        } catch (e) {
            console.warn("Could not parse whiteboard content");
        }
    }
  }, [initialContent]);

  useEffect(() => {
      if (onChange && elements.length >= 0) {
          const content = JSON.stringify(elements);
          if (content !== lastKnownContentRef.current) {
              lastKnownContentRef.current = content;
              onChange(content);
          }
      }
  }, [elements, onChange]);

  useEffect(() => {
      if (!sessionId || sessionId.startsWith('local-')) {
          setIsLive(false);
          return;
      }
      setIsLoading(true);
      const unsubscribe = subscribeToWhiteboard(sessionId, (remoteElements) => {
          const content = JSON.stringify(remoteElements);
          if (content !== lastKnownContentRef.current) {
              setElements(remoteElements);
              lastKnownContentRef.current = content;
          }
          setIsLoading(false);
          setIsLive(true);
      });
      return () => { unsubscribe(); setIsLive(false); };
  }, [sessionId]);

  const getWorldCoordinates = (e: any) => {
      if (!canvasRef.current || !canvasWrapperRef.current) return { x: 0, y: 0 }; 
      const rect = canvasRef.current.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      const cx = rect.width / 2;
      const cy = rect.height / 2;
      
      let dx = x - cx;
      let dy = y - cy;

      const rad = -(boardRotation * Math.PI) / 180;
      const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
      const ry = dx * Math.sin(rad) + dy * Math.cos(rad);

      return { 
          x: (rx + cx - offset.x) / scale, 
          y: (ry + cy - offset.y) / scale 
      };
  };

  const getElementBounds = (el: WhiteboardElement) => {
      if (el.type === 'pen' || el.type === 'eraser' || el.type === 'curve') {
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
          const width = 200 * (el.fontSize || 16) / 16; 
          const height = lines.length * (el.fontSize || 16) * 1.2;
          return { minX: el.x, minY: el.y, maxX: el.x + width, maxY: el.y + height };
      }
      return { minX: Math.min(el.x, el.x + w), minY: Math.min(el.y, el.y + h), maxX: Math.max(el.x, el.x + w), maxY: Math.max(el.y, el.y + h) };
  };

  const isPointInElement = (x: number, y: number, el: WhiteboardElement) => {
      const margin = 12 / scale;
      if (el.type === 'pen' || el.type === 'eraser' || el.type === 'curve') {
          return el.points?.some(p => Math.sqrt((p.x - x)**2 + (p.y - y)**2) < (el.strokeWidth / scale) + margin);
      }
      const bounds = getElementBounds(el);
      return x >= bounds.minX - margin && x <= bounds.maxX + margin && y >= bounds.minY - margin && y <= bounds.maxY + margin;
  };

  const startDrawing = (e: any) => {
      if (isReadOnly || textInput.visible) return;
      const { x, y } = getWorldCoordinates(e);

      if (tool === 'hand') {
        setIsDrawing(true);
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        setDragStartPos({ x: clientX, y: clientY });
        return;
      }

      if (tool === 'curve') {
          setPartialPoints(prev => [...prev, { x, y }]);
          return;
      }

      if (tool === 'type') {
          setTextInput({ x, y, value: '', visible: true, editingId: null });
          setTimeout(() => textInputRef.current?.focus(), 50);
          return;
      }

      if (tool === 'move') {
          const isShift = e.shiftKey;
          
          if (selectedElementIds.length === 1 && !isShift) {
              const el = elements.find(e => e.id === selectedElementIds[0]);
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

          const hitElement = [...elements].reverse().find(el => isPointInElement(x, y, el));
          if (hitElement) {
              if (isShift) {
                  setSelectedElementIds(prev => prev.includes(hitElement.id) ? prev.filter(id => id !== hitElement.id) : [...prev, hitElement.id]);
              } else {
                  if (!selectedElementIds.includes(hitElement.id)) {
                      setSelectedElementIds([hitElement.id]);
                  }
              }
              setDragStartPos({ x, y });
              setIsDrawing(true);
          } else {
              if (!isShift) {
                  setSelectedElementIds([]);
              }
              setSelectionRect({ x, y, w: 0, h: 0 });
              setIsDrawing(true);
          }
          return;
      }

      setIsDrawing(true);
      const id = crypto.randomUUID();
      const newEl: WhiteboardElement = { 
          id, type: tool, x, y, 
          color: tool === 'eraser' ? (currentBgColor === 'transparent' ? '#ffffff' : currentBgColor) : color, 
          strokeWidth: tool === 'eraser' ? 20 : lineWidth, 
          lineStyle: tool === 'eraser' ? 'solid' : lineStyle,
          brushType: tool === 'eraser' ? 'standard' : brushType, 
          points: tool === 'pen' || tool === 'eraser' ? [{ x, y }] : undefined, 
          width: 0, height: 0, endX: x, endY: y, borderRadius: tool === 'rect' ? borderRadius : undefined, rotation: 0,
          startCap: ['line', 'arrow'].includes(tool) ? (tool === 'arrow' ? 'arrow' : startCap) : 'none',
          endCap: ['line', 'arrow'].includes(tool) ? (tool === 'arrow' ? 'arrow' : endCap) : 'none'
      };
      setCurrentElement(newEl);
  };

  const draw = (e: any) => {
      const coords = getWorldCoordinates(e);
      setMousePos(coords);
      if (!isDrawing && tool !== 'curve') return;

      if (tool === 'hand' && isDrawing) {
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const dx = clientX - dragStartPos.x;
        const dy = clientY - dragStartPos.y;
        setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        setDragStartPos({ x: clientX, y: clientY });
        return;
      }

      if (tool === 'move' && isDrawing) {
          if (selectionRect) {
              setSelectionRect(prev => prev ? ({ ...prev, w: coords.x - prev.x, h: coords.y - prev.y }) : null);
              return;
          }

          if (selectedElementIds.length > 0) {
              const dx = coords.x - dragStartPos.x;
              const dy = coords.y - dragStartPos.y;
              
              setElements(prev => prev.map(el => {
                  if (selectedElementIds.includes(el.id)) {
                      if (activeResizeHandle && selectedElementIds.length === 1) {
                          const updated = { ...el };
                          if (activeResizeHandle === 'end') {
                              updated.endX = (updated.endX || updated.x) + dx;
                              updated.endY = (updated.endY || updated.y) + dy;
                          } else if (el.type === 'pen' || el.type === 'eraser' || el.type === 'curve') {
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
              setDragStartPos({ x: coords.x, y: coords.y });
          }
          return;
      }

      if (!currentElement) return;
      if (tool === 'pen' || tool === 'eraser') { 
          setCurrentElement(prev => prev ? ({ ...prev, points: [...(prev.points || []), { x: coords.x, y: coords.y }] }) : null); 
      }
      else if (['rect','circle','triangle','star'].includes(tool)) { 
          setCurrentElement(prev => prev ? ({ ...prev, width: coords.x - prev.x, height: coords.y - prev.y }) : null); 
      }
      else if (tool === 'line' || tool === 'arrow') { 
          setCurrentElement(prev => prev ? ({ ...prev, endX: coords.x, endY: coords.y }) : null); 
      }
  };

  const stopDrawing = async () => {
      if (!isDrawing) return;
      if (tool === 'hand') { setIsDrawing(false); return; }

      if (tool === 'move') {
          if (selectionRect) {
              const minX = Math.min(selectionRect.x, selectionRect.x + selectionRect.w);
              const maxX = Math.max(selectionRect.x, selectionRect.x + selectionRect.w);
              const minY = Math.min(selectionRect.y, selectionRect.y + selectionRect.h);
              const maxY = Math.max(selectionRect.y, selectionRect.y + selectionRect.h);

              const hit = elements.filter(el => {
                  const bounds = getElementBounds(el);
                  return bounds.maxX >= minX && bounds.minX <= maxX && bounds.maxY >= minY && bounds.minY <= maxY;
              }).map(el => el.id);
              
              setSelectedElementIds(prev => Array.from(new Set([...prev, ...hit])));
              setSelectionRect(null);
          } else if (selectedElementIds.length > 0) {
              if (sessionId && !sessionId.startsWith('local-')) {
                  await saveWhiteboardSession(sessionId, elements);
              }
          }
          setIsDrawing(false);
          setActiveResizeHandle(null);
          return;
      }

      if (currentElement) {
          const finalized = { ...currentElement };
          setElements(prev => [...prev, finalized]);
          if (sessionId && !sessionId.startsWith('local-')) { await updateWhiteboardElement(sessionId, finalized); }
          setCurrentElement(null);
          setIsDrawing(false);
      }
  };

  const handleDeleteSelected = async () => {
      if (selectedElementIds.length === 0) return;
      const nextElements = elements.filter(el => !selectedElementIds.includes(el.id));
      setElements(nextElements);
      setSelectedElementIds([]);
      if (sessionId && !sessionId.startsWith('local-')) { await saveWhiteboardSession(sessionId, nextElements); }
  };

  const handleTextCommit = async () => {
      if (!textInput.value.trim()) { setTextInput({ ...textInput, visible: false, editingId: null }); return; }
      if (textInput.editingId) {
          const nextElements = elements.map(el => el.id === textInput.editingId ? { ...el, text: textInput.value } : el);
          setElements(nextElements);
          if (sessionId && !sessionId.startsWith('local-')) { await saveWhiteboardSession(sessionId, nextElements); }
      } else {
          const id = crypto.randomUUID();
          const textEl: WhiteboardElement = { id, type: 'type', x: textInput.x, y: textInput.y, color, strokeWidth: lineWidth, text: textInput.value, fontSize: 16 };
          setElements(prev => [...prev, textEl]);
          if (sessionId && !sessionId.startsWith('local-')) { await updateWhiteboardElement(sessionId, textEl); }
      }
      setTextInput({ ...textInput, visible: false, value: '', editingId: null });
  };

  const getResizeHandleAt = (x: number, y: number, el: WhiteboardElement): ResizeHandle => {
      const handleSize = 10 / scale;
      const bounds = getElementBounds(el);
      if (el.type === 'line' || el.type === 'arrow') { if (Math.sqrt((x - (el.endX || el.x))**2 + (y - (el.endY || el.y))**2) < handleSize * 2) return 'end'; return null; }
      const handles: { id: ResizeHandle, x: number, y: number }[] = [
          { id: 'nw', x: bounds.minX, y: bounds.minY }, { id: 'ne', x: bounds.maxX, y: bounds.minY },
          { id: 'sw', x: bounds.minX, y: bounds.maxY }, { id: 'se', x: bounds.maxX, y: bounds.maxY }
      ];
      const found = handles.find(h => Math.sqrt((x - h.x)**2 + (y - h.y)**2) < handleSize * 2);
      return found ? found.id : null;
  };

  useEffect(() => {
      const canvas = canvasRef.current;
      const wrapper = canvasWrapperRef.current;
      if (!canvas || !wrapper) return; 
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const width = wrapper.clientWidth;
      const height = wrapper.clientHeight;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
          canvas.width = width * dpr;
          canvas.height = height * dpr;
      }
      
      ctx.setTransform(1, 0, 0, 1, 0, 0); 
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height); 

      if (currentBgColor !== 'transparent') { 
          ctx.fillStyle = currentBgColor; 
          ctx.fillRect(0, 0, width, height); 
      }

      if (bgImageRef.current && bgImageReady) {
          const img = bgImageRef.current;
          const padding = 20;
          const availableWidth = width - (padding * 2);
          const availableHeight = height - (padding * 2);
          const scaleFactor = Math.min(availableWidth / img.width, availableHeight / img.height, 1);
          const dw = img.width * scaleFactor;
          const dh = img.height * scaleFactor;
          ctx.drawImage(img, (width - dw) / 2, (height - dh) / 2, dw, dh);
      }

      ctx.save(); 
      const cx = width / 2;
      const cy = height / 2;
      
      ctx.translate(cx, cy); 
      ctx.rotate((boardRotation * Math.PI) / 180); 
      ctx.translate(-cx, -cy);
      
      ctx.translate(offset.x, offset.y); 
      ctx.scale(scale, scale);
      
      const drawCap = (x1: number, y1: number, x2: number, y2: number, size: number, color: string, style?: CapStyle) => {
          if (!style || style === 'none') return;
          const angle = Math.atan2(y2 - y1, x2 - x1);
          ctx.save(); ctx.translate(x2, y2); ctx.rotate(angle); ctx.beginPath(); 
          if (style === 'arrow') { ctx.moveTo(0, 0); ctx.lineTo(-size, -size / 2); ctx.lineTo(-size, size / 2); ctx.closePath(); ctx.fillStyle = color; ctx.fill(); } 
          else if (style === 'circle') { ctx.arc(-size/2, 0, size/2, 0, 2 * Math.PI); ctx.fillStyle = color; ctx.fill(); }
          ctx.restore();
      };

      const renderCurve = (points: {x: number, y: number}[], el: WhiteboardElement | { strokeWidth: number, color: string, lineStyle: any, brushType?: string }) => {
          if (points.length < 2) return;
          ctx.save(); ctx.beginPath(); ctx.lineWidth = el.strokeWidth / scale; ctx.strokeStyle = el.color;
          const styleConfig = LINE_STYLES.find(s => s.value === (('lineStyle' in el) ? (el as any).lineStyle : 'solid'));
          ctx.setLineDash(styleConfig?.dash || []);
          
          if ('brushType' in el) {
              if (el.brushType === 'pencil') { ctx.globalAlpha = 0.6; ctx.setLineDash([2, 1]); }
              else if (el.brushType === 'marker') { ctx.globalAlpha = 0.4; ctx.lineCap = 'square'; }
              else if (el.brushType === 'airbrush') { ctx.shadowBlur = el.strokeWidth; ctx.shadowColor = el.color; }
          }

          ctx.moveTo(points[0].x, points[0].y);
          if (points.length === 2) { ctx.lineTo(points[1].x, points[1].y); } else {
              for (let i = 1; i < points.length - 2; i++) {
                  const xc = (points[i].x + points[i + 1].x) / 2; const yc = (points[i].y + points[i + 1].y) / 2;
                  ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
              }
              ctx.quadraticCurveTo(points[points.length - 2].x, points[points.length - 2].y, points[points.length - 1].x, points[points.length - 1].y);
          }
          ctx.stroke();
          ctx.restore();
      };

      const renderElement = (el: WhiteboardElement) => {
          ctx.save(); ctx.beginPath(); ctx.strokeStyle = el.color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          const styleConfig = LINE_STYLES.find(s => s.value === (el.lineStyle || 'solid'));
          ctx.setLineDash(styleConfig?.dash || []);

          if (el.brushType === 'pencil') ctx.globalAlpha = 0.6;
          else if (el.brushType === 'marker') ctx.globalAlpha = 0.4;

          if (selectedElementIds.includes(el.id) && tool === 'move') {
              const bounds = getElementBounds(el);
              ctx.save(); ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 1 / scale; ctx.setLineDash([5, 5]);
              ctx.strokeRect(bounds.minX - 5, bounds.minY - 5, (bounds.maxX - bounds.minX) + 10, (bounds.maxY - bounds.minY) + 10);
              if (selectedElementIds.length === 1) {
                  ctx.fillStyle = '#6366f1'; const hSize = 8 / scale;
                  const handles = (el.type === 'line' || el.type === 'arrow') ? [{x: el.endX || el.x, y: el.endY || el.y}] :
                     [{x: bounds.minX, y: bounds.minY}, {x: bounds.maxX, y: bounds.minY}, {x: bounds.minX, y: bounds.maxY}, {x: bounds.maxX, y: bounds.maxY}];
                  handles.forEach(h => ctx.fillRect(h.x - hSize/2, h.y - hSize/2, hSize, hSize));
              }
              ctx.restore();
          }

          if (el.type === 'type' && el.text) {
              ctx.fillStyle = el.color; ctx.font = `${(el.fontSize || 16)}px 'JetBrains Mono', monospace`; ctx.textBaseline = 'top';
              const lines = el.text.split('\n'); lines.forEach((line, i) => { ctx.fillText(line, el.x, el.y + (i * (el.fontSize || 16) * 1.2)); });
          } else if (el.type === 'curve' && el.points) { renderCurve(el.points, el); } 
          else if (el.type === 'pen' || el.type === 'eraser') {
              if (el.points?.length) { ctx.lineWidth = el.strokeWidth / scale; ctx.moveTo(el.points[0].x, el.points[0].y); el.points.forEach(p => ctx.lineTo(p.x, p.y)); ctx.stroke(); }
          } else if (el.type === 'rect') { 
              ctx.lineWidth = el.strokeWidth / scale;
              if (ctx.roundRect) { ctx.roundRect(el.x, el.y, el.width || 0, el.height || 0, (el.borderRadius || 0)); ctx.stroke(); } 
              else { ctx.strokeRect(el.x, el.y, el.width || 0, el.height || 0); }
          } else if (el.type === 'circle') { 
              ctx.lineWidth = el.strokeWidth / scale; ctx.ellipse(el.x + (el.width||0)/2, el.y + (el.height||0)/2, Math.abs((el.width||0)/2), Math.abs((el.height||0)/2), 0, 0, 2*Math.PI); ctx.stroke(); 
          } else if (el.type === 'triangle') {
              ctx.lineWidth = el.strokeWidth / scale;
              ctx.moveTo(el.x + (el.width||0)/2, el.y);
              ctx.lineTo(el.x + (el.width||0), el.y + (el.height||0));
              ctx.lineTo(el.x, el.y + (el.height||0));
              ctx.closePath();
              ctx.stroke();
          } else if (el.type === 'star') {
              ctx.lineWidth = el.strokeWidth / scale;
              const cx = el.x + (el.width||0)/2; const cy = el.y + (el.height||0)/2;
              const spikes = 5; const outerRadius = Math.abs((el.width||0)/2); const innerRadius = outerRadius/2;
              let rot = Math.PI / 2 * 3; let x = cx; let y = cy; const step = Math.PI / spikes;
              ctx.moveTo(cx, cy - outerRadius);
              for (let i = 0; i < spikes; i++) {
                  x = cx + Math.cos(rot) * outerRadius; y = cy + Math.sin(rot) * outerRadius; ctx.lineTo(x, y); rot += step;
                  x = cx + Math.cos(rot) * innerRadius; y = cy + Math.sin(rot) * innerRadius; ctx.lineTo(x, y); rot += step;
              }
              ctx.lineTo(cx, cy - outerRadius); ctx.closePath(); ctx.stroke();
          } else if (el.type === 'line' || el.type === 'arrow') { 
              ctx.lineWidth = el.strokeWidth / scale; const x1 = el.x; const y1 = el.y; const x2 = el.endX || el.x; const y2 = el.endY || el.y;
              ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); 
              const capSize = Math.max(12, el.strokeWidth * 3) / scale;
              if (el.startCap) drawCap(x2, y2, x1, y1, capSize, el.color, el.startCap);
              if (el.endCap) drawCap(x1, y1, x2, y2, capSize, el.color, el.endCap);
          }
          ctx.restore();
      };

      elements.forEach(renderElement);
      if (currentElement) renderElement(currentElement);
      if (tool === 'curve' && partialPoints.length > 0) { renderCurve([...partialPoints, mousePos], { strokeWidth: lineWidth, color, lineStyle, brushType: brushType as any }); }
      
      if (selectionRect) {
          ctx.save(); ctx.strokeStyle = 'rgba(99, 102, 241, 0.5)'; ctx.fillStyle = 'rgba(99, 102, 241, 0.1)';
          ctx.lineWidth = 1 / scale; ctx.setLineDash([5, 5]);
          ctx.fillRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h);
          ctx.strokeRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h);
          ctx.restore();
      }
      ctx.restore();
  }, [elements, currentElement, scale, offset, boardRotation, currentBgColor, selectedElementIds, tool, partialPoints, mousePos, selectionRect, color, lineWidth, lineStyle, brushType, bgImageReady]);

  return (
    <div className={`flex flex-col h-full w-full ${isDarkBackground ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'} overflow-hidden relative`}>
        <div className={`${isDarkBackground ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'} border-b p-2 flex flex-wrap justify-between gap-2 shrink-0 z-10 items-center px-4`}>
            <div className="flex items-center gap-2">
                {onBack && <button onClick={onBack} className={`p-2 rounded-lg ${isDarkBackground ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-200 text-slate-600'} mr-2`}><ArrowLeft size={20}/></button>}
                
                <div className={`flex ${isDarkBackground ? 'bg-slate-800' : 'bg-slate-200'} rounded-lg p-1 mr-2`}>
                    <button onClick={() => setTool('pen')} className={`p-1.5 rounded ${tool === 'pen' ? 'bg-indigo-600 text-white shadow-lg' : (isDarkBackground ? 'text-slate-400' : 'text-slate-600')}`} title="Pen"><PenTool size={16}/></button>
                    <button onClick={() => setTool('hand')} className={`p-1.5 rounded ${tool === 'hand' ? 'bg-indigo-600 text-white shadow-lg' : (isDarkBackground ? 'text-slate-400' : 'text-slate-600')}`} title="Hand Pan"><Hand size={16}/></button>
                    <button onClick={() => setTool('curve')} className={`p-1.5 rounded ${tool === 'curve' ? 'bg-indigo-600 text-white shadow-lg' : (isDarkBackground ? 'text-slate-400' : 'text-slate-600')}`} title="Spline Curve (ESC to stop)"><Spline size={16}/></button>
                    <button onClick={() => setTool('type')} className={`p-1.5 rounded ${tool === 'type' ? 'bg-indigo-600 text-white shadow-lg' : (isDarkBackground ? 'text-slate-400' : 'text-slate-600')}`} title="Markdown Text"><TypeIcon size={16}/></button>
                    <button onClick={() => setTool('move')} className={`p-1.5 rounded ${tool === 'move' ? 'bg-indigo-600 text-white shadow-lg' : (isDarkBackground ? 'text-slate-400' : 'text-slate-600')}`} title="Select/Move/Resize"><MousePointer2 size={16}/></button>
                    <button onClick={() => setTool('eraser')} className={`p-1.5 rounded ${tool === 'eraser' ? 'bg-indigo-600 text-white shadow-lg' : (isDarkBackground ? 'text-slate-400' : 'text-slate-600')}`} title="Eraser"><Eraser size={16}/></button>
                </div>

                <div className={`flex ${isDarkBackground ? 'bg-slate-800' : 'bg-slate-200'} rounded-lg p-1 mr-2`}>
                    <button onClick={() => setTool('rect')} className={`p-1.5 rounded ${tool === 'rect' ? 'bg-indigo-600 text-white shadow-lg' : (isDarkBackground ? 'text-slate-400' : 'text-slate-600')}`} title="Rectangle"><Square size={16}/></button>
                    <button onClick={() => setTool('circle')} className={`p-1.5 rounded ${tool === 'circle' ? 'bg-indigo-600 text-white shadow-lg' : (isDarkBackground ? 'text-slate-400' : 'text-slate-600')}`} title="Circle"><Circle size={16}/></button>
                    <button onClick={() => setTool('line')} className={`p-1.5 rounded ${tool === 'line' ? 'bg-indigo-600 text-white shadow-lg' : (isDarkBackground ? 'text-slate-400' : 'text-slate-600')}`} title="Line"><Minus size={16}/></button>
                    <button onClick={() => setTool('triangle')} className={`p-1.5 rounded ${tool === 'triangle' ? 'bg-indigo-600 text-white shadow-lg' : (isDarkBackground ? 'text-slate-400' : 'text-slate-600')}`} title="Triangle"><Triangle size={16}/></button>
                    <button onClick={() => setTool('star')} className={`p-1.5 rounded ${tool === 'star' ? 'bg-indigo-600 text-white shadow-lg' : (isDarkBackground ? 'text-slate-400' : 'text-slate-600')}`} title="Star"><Star size={16}/></button>
                </div>

                <div className="flex gap-1 mr-2">
                    {selectedElementIds.length > 0 && (
                        <>
                            <button onClick={handleCopy} className={`p-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 shadow-lg transition-all active:scale-95 flex items-center gap-2`} title="Copy Group (Ctrl+C)">
                                <Copy size={16}/> <span className="text-xs font-bold uppercase hidden sm:inline">Copy</span>
                            </button>
                            <button onClick={handleDeleteSelected} className={`p-2 rounded-lg bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 shadow-lg transition-all active:scale-95 flex items-center gap-2`} title="Delete Group (Del)">
                                <Trash2 size={16}/> <span className="text-xs font-bold uppercase hidden sm:inline">Delete</span>
                            </button>
                        </>
                    )}
                    {clipboardBuffer.length > 0 && (
                        <button onClick={handlePaste} className={`p-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 shadow-lg transition-all active:scale-95 flex items-center gap-2`} title="Paste Group (Ctrl+V)">
                            <Clipboard size={16}/> <span className="text-xs font-bold uppercase hidden sm:inline">Paste</span>
                        </button>
                    )}
                </div>

                <div className="relative ml-2">
                    <button onClick={() => setShowStyleMenu(!showStyleMenu)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${isDarkBackground ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                        <Sliders size={16}/>
                        <span className="text-xs font-bold uppercase hidden sm:inline">Refract Styles</span>
                        <ChevronDown size={14}/>
                    </button>
                    {showStyleMenu && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowStyleMenu(false)}></div>
                            <div className={`absolute top-full left-0 mt-2 w-80 max-h-[80vh] overflow-y-auto ${isDarkBackground ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200 shadow-2xl'} border rounded-xl z-50 p-4 space-y-6 animate-fade-in-up scrollbar-hide`}>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Canvas Background</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {[ { id: '#000000', label: 'Black' }, { id: '#ffffff', label: 'White' }, { id: '#0f172a', label: 'Slate' }, { id: '#1e293b', label: 'Navy' }, { id: 'transparent', label: 'Clear' } ].map(bg => (
                                            <button key={bg.id} onClick={() => setCurrentBgColor(bg.id)} className={`w-8 h-8 rounded-lg border-2 transition-all ${currentBgColor === bg.id ? 'border-indigo-500 scale-110 shadow-lg' : 'border-slate-700 hover:border-slate-500'}`} style={{ backgroundColor: bg.id === 'transparent' ? 'transparent' : bg.id, backgroundImage: bg.id === 'transparent' ? 'repeating-conic-gradient(#555 0% 25%, #333 0% 50%)' : 'none', backgroundSize: '8px 8px' }} title={bg.label} />
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-3">Brush Texture</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {BRUSH_TYPES.map(b => (
                                            <button key={b.value} onClick={() => setBrushType(b.value)} className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all ${brushType === b.value ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}>
                                                <b.icon size={16}/>
                                                <span className="text-[8px] font-bold uppercase">{b.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-3">Line Style</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {LINE_STYLES.map(s => (
                                            <button key={s.value} onClick={() => setLineStyle(s.value)} className={`flex items-center gap-3 px-3 py-2 rounded border transition-all ${lineStyle === s.value ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}>
                                                <div className="flex-1 h-px border-t-2" style={{ borderStyle: s.value === 'solid' ? 'solid' : s.value === 'dotted' ? 'dotted' : 'dashed', borderColor: 'currentColor', borderImage: s.value === 'dash-dot' ? 'none' : 'none' }}>
                                                    {s.value === 'dash-dot' && <div className="h-0.5 w-full" style={{ backgroundImage: 'linear-gradient(to right, currentColor 12px, transparent 12px, transparent 17px, currentColor 17px, currentColor 20px, transparent 20px)', backgroundSize: '25px 100%' }}></div>}
                                                    {s.value === 'long-dash' && <div className="h-0.5 w-full" style={{ backgroundImage: 'linear-gradient(to right, currentColor 20px, transparent 20px)', backgroundSize: '30px 100%' }}></div>}
                                                    {s.value === 'dashed' && <div className="h-0.5 w-full" style={{ backgroundImage: 'linear-gradient(to right, currentColor 10px, transparent 10px)', backgroundSize: '18px 100%' }}></div>}
                                                    {s.value === 'dotted' && <div className="h-0.5 w-full" style={{ backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)', backgroundSize: '6px 100%' }}></div>}
                                                    {s.value === 'solid' && <div className="h-0.5 w-full bg-current"></div>}
                                                </div>
                                                <span className="text-[9px] font-bold uppercase min-w-[60px] text-right">{s.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <div className="flex justify-between mb-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Thickness</label><span className="text-[10px] font-mono text-indigo-400">{lineWidth}px</span></div>
                                        <input type="range" min="1" max="50" value={lineWidth} onChange={(e) => setLineWidth(parseInt(e.target.value))} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                                    </div>
                                    
                                    {tool === 'rect' && (
                                        <div className="animate-fade-in">
                                            <div className="flex justify-between mb-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Corner Radius</label><span className="text-[10px] font-mono text-indigo-400">{borderRadius}px</span></div>
                                            <input type="range" min="0" max="100" value={borderRadius} onChange={(e) => setBorderRadius(parseInt(e.target.value))} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Start Cap</label>
                                        <div className="flex gap-1">
                                            {CAP_STYLES.map(c => (
                                                <button key={c.value} onClick={() => setStartCap(c.value)} className={`p-2 rounded-lg border transition-all ${startCap === c.value ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`} title={c.label}>
                                                    <c.icon size={14} className="rotate-180"/>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">End Cap</label>
                                        <div className="flex gap-1">
                                            {CAP_STYLES.map(c => (
                                                <button key={c.value} onClick={() => setEndCap(c.value)} className={`p-2 rounded-lg border transition-all ${endCap === c.value ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`} title={c.label}>
                                                    <c.icon size={14}/>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className={`flex gap-1 px-2 ${isDarkBackground ? 'bg-slate-800' : 'bg-slate-200'} rounded-lg py-1 items-center ml-2`}>
                    {['#000000', '#ffffff', '#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#a855f7'].map(c => <button key={c} onClick={() => setColor(c)} className={`w-4 h-4 rounded-full border border-black/20 ${color === c ? 'ring-2 ring-indigo-500 scale-110' : 'hover:scale-105'} transition-all`} style={{ backgroundColor: c }} />)}
                </div>
            </div>

            <div className="flex items-center gap-2">
                <button onClick={() => setScale(prev => Math.min(prev * 1.2, 5))} className={`p-1.5 rounded ${isDarkBackground ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-200 text-slate-600'} mr-1`} title="Zoom In"><ZoomIn size={16}/></button>
                <button onClick={() => setScale(prev => Math.max(prev / 1.2, 0.2))} className={`p-1.5 rounded ${isDarkBackground ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-200 text-slate-600'} mr-1`} title="Zoom Out"><ZoomOut size={16}/></button>
                <button onClick={() => setElements(prev => prev.slice(0, -1))} className={`p-1.5 rounded transition-colors ${isDarkBackground ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-200 text-slate-600'}`} title="Undo"><Undo size={16} /></button>
                <button onClick={() => { setElements([]); if(sessionId) deleteWhiteboardElements(sessionId); }} className={`p-1.5 rounded transition-colors ${isDarkBackground ? 'hover:bg-slate-800 text-slate-400 hover:text-red-400' : 'hover:bg-slate-200 text-slate-600 hover:text-red-600'}`} title="Clear Canvas"><Trash2 size={16} /></button>
            </div>
        </div>
        
        <div ref={canvasWrapperRef} className={`flex-1 relative overflow-hidden ${isDarkBackground ? 'bg-slate-950' : 'bg-white'} touch-none`}>
            {isLoading && (
                <div className="absolute inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                    <Loader2 size={32} className="animate-spin text-indigo-500"/><span className="text-xs font-bold text-indigo-200 uppercase tracking-widest">Hydrating Session...</span>
                </div>
            )}
            <canvas 
                id="whiteboard-canvas-core"
                ref={canvasRef} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
                onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing}
                className={`block w-full h-full ${tool === 'move' ? 'cursor-move' : tool === 'hand' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`} 
            />

            {textInput.visible && (
                <div className="absolute z-40 bg-slate-900/90 border-2 border-indigo-500 rounded-xl p-3 shadow-2xl animate-fade-in" style={{ left: (textInput.x * scale + offset.x) + 'px', top: (textInput.y * scale + offset.y) + 'px', minWidth: '400px' }}>
                    <textarea ref={textInputRef} value={textInput.value} onChange={e => setTextInput({ ...textInput, value: e.target.value })} className="bg-transparent border-none outline-none text-white font-mono text-sm w-full h-48 resize-both placeholder-slate-600" placeholder="Type markdown / text..." onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { handleTextCommit(); } }} />
                    <div className="flex justify-between items-center mt-2 border-t border-slate-800 pt-2"><span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Ctrl+Enter to Save</span><div className="flex gap-2"><button onClick={() => setTextInput({...textInput, visible: false, editingId: null})} className="p-1 hover:bg-red-900/20 text-red-500 rounded"><X size={14}/></button><button onClick={handleTextCommit} className="p-1 hover:bg-emerald-900/20 text-emerald-500 rounded"><Check size={14}/></button></div></div>
                </div>
            )}
        </div>
    </div>
  );
};

export default Whiteboard;
