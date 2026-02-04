import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Share2, Trash2, Undo, PenTool, Pen, Eraser, Download, Square, Circle, Minus, ArrowRight, Type, ZoomIn, ZoomOut, MousePointer2, Move, MoreHorizontal, Lock, Eye, Edit3, GripHorizontal, Brush, ChevronDown, Feather, Highlighter, Wind, Droplet, Cloud, Edit2, Copy, Clipboard, BringToFront, SendToBack, Sparkles, Send, Loader2, X, RotateCw, RotateCcw, Triangle, Star, Spline, Maximize, Scissors, Shapes, Palette, Settings2, Languages, ArrowUpLeft, ArrowDownRight, HardDrive, Check, Sliders, CloudDownload, Save, Activity, RefreshCcw, Type as TypeIcon, Hand, Info } from 'lucide-react';
import { auth, db } from '../services/firebaseConfig';
import { subscribeToWhiteboard, updateWhiteboardElement, deleteWhiteboardElements, saveWhiteboardSession } from '../services/firestoreService';
import { WhiteboardElement, ToolType, LineStyle, BrushType, CapStyle } from '../types';
import { generateSecureId } from '../utils/idUtils';
import { getDriveToken, signInWithGoogle, connectGoogleDrive } from '../services/authService';
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
  onOpenManual?: () => void;
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
  onChange,
  onOpenManual
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
      const found = handles.find(h => Math.sqrt((x - h.x)**2 + (h.y - y)**2) < handleSize * 2);
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
          const scaleFactor = Math.min(availableWidth / img.width, availableHeight / img.height);
          
          const x = (width - img.width * scaleFactor) / 2;
          const y = (height - img.height * scaleFactor) / 2;
          
          ctx.save();
          ctx.translate(offset.x + width/2, offset.y + height/2);
          ctx.rotate(boardRotation * Math.PI / 180);
          ctx.scale(scale, scale);
          ctx.translate(-width/2, -height/2);
          ctx.drawImage(img, x, y, img.width * scaleFactor, img.height * scaleFactor);
          ctx.restore();
      }

      ctx.save();
      ctx.translate(offset.x + width/2, offset.y + height/2);
      ctx.rotate(boardRotation * Math.PI / 180);
      ctx.scale(scale, scale);
      ctx.translate(-width/2, -height/2);

      const renderEl = (el: WhiteboardElement) => {
          ctx.strokeStyle = el.color;
          ctx.fillStyle = el.color;
          ctx.lineWidth = el.strokeWidth;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          
          const config = LINE_STYLES.find(s => s.value === el.lineStyle);
          ctx.setLineDash(config?.dash || []);

          if (el.type === 'pen' || el.type === 'eraser' || el.type === 'curve') {
              if (!el.points || el.points.length < 2) return;
              ctx.beginPath();
              ctx.moveTo(el.points[0].x, el.points[0].y);
              for (let i = 1; i < el.points.length; i++) {
                  ctx.lineTo(el.points[i].x, el.points[i].y);
              }
              ctx.stroke();
          } else if (el.type === 'rect') {
              if (el.borderRadius) {
                  ctx.beginPath();
                  ctx.roundRect(el.x, el.y, el.width || 0, el.height || 0, el.borderRadius);
                  ctx.stroke();
              } else {
                  ctx.strokeRect(el.x, el.y, el.width || 0, el.height || 0);
              }
          } else if (el.type === 'circle') {
              ctx.beginPath();
              const rx = (el.width || 0) / 2;
              const ry = (el.height || 0) / 2;
              ctx.ellipse(el.x + rx, el.y + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
              ctx.stroke();
          } else if (el.type === 'line' || el.type === 'arrow') {
              ctx.beginPath();
              ctx.moveTo(el.x, el.y);
              ctx.lineTo(el.endX || el.x, el.endY || el.y);
              ctx.stroke();
              
              if (el.type === 'arrow' || el.endCap === 'arrow') {
                  const angle = Math.atan2((el.endY || el.y) - el.y, (el.endX || el.x) - el.x);
                  ctx.save();
                  ctx.translate(el.endX || el.x, el.endY || el.y);
                  ctx.rotate(angle);
                  ctx.beginPath();
                  ctx.moveTo(-15, -8);
                  ctx.lineTo(0, 0);
                  ctx.lineTo(-15, 8);
                  ctx.stroke();
                  ctx.restore();
              }
          } else if (el.type === 'type') {
              ctx.font = `${el.fontSize || 16}px font-sans`;
              ctx.textBaseline = 'top';
              const lines = el.text?.split('\n') || [];
              lines.forEach((line, i) => ctx.fillText(line, el.x, el.y + i * (el.fontSize || 16) * 1.2));
          } else if (el.type === 'triangle') {
              ctx.beginPath();
              ctx.moveTo(el.x + (el.width || 0) / 2, el.y);
              ctx.lineTo(el.x + (el.width || 0), el.y + (el.height || 0));
              ctx.lineTo(el.x, el.y + (el.height || 0));
              ctx.closePath();
              ctx.stroke();
          }
      };

      elements.forEach(renderEl);
      if (currentElement) renderEl(currentElement);

      if (partialPoints.length > 0) {
          ctx.strokeStyle = color;
          ctx.lineWidth = lineWidth;
          ctx.setLineDash(LINE_STYLES.find(s => s.value === lineStyle)?.dash || []);
          ctx.beginPath();
          ctx.moveTo(partialPoints[0].x, partialPoints[0].y);
          partialPoints.forEach(p => ctx.lineTo(p.x, p.y));
          ctx.stroke();
          const last = partialPoints[partialPoints.length-1];
          ctx.lineTo(mousePos.x, mousePos.y);
          ctx.stroke();
      }

      if (tool === 'move') {
          selectedElementIds.forEach(id => {
              const el = elements.find(e => e.id === id);
              if (el) {
                  const b = getElementBounds(el);
                  ctx.setLineDash([5, 5]);
                  ctx.strokeStyle = '#6366f1';
                  ctx.lineWidth = 1 / scale;
                  ctx.strokeRect(b.minX - 4, b.minY - 4, b.maxX - b.minX + 8, b.maxY - b.minY + 8);
                  
                  if (selectedElementIds.length === 1) {
                      const handleSize = 8 / scale;
                      ctx.fillStyle = '#ffffff';
                      ctx.setLineDash([]);
                      const handles = el.type === 'line' || el.type === 'arrow' 
                        ? [{ x: el.endX || el.x, y: el.endY || el.y }]
                        : [{ x: b.minX, y: b.minY }, { x: b.maxX, y: b.minY }, { x: b.minX, y: b.maxY }, { x: b.maxX, y: b.maxY }];
                      handles.forEach(h => {
                          ctx.fillRect(h.x - handleSize/2, h.y - handleSize/2, handleSize, handleSize);
                          ctx.strokeRect(h.x - handleSize/2, h.y - handleSize/2, handleSize, handleSize);
                      });
                  }
              }
          });
          if (selectionRect) {
              ctx.setLineDash([5, 5]);
              ctx.strokeStyle = 'rgba(99, 102, 241, 0.5)';
              ctx.fillStyle = 'rgba(99, 102, 241, 0.1)';
              ctx.strokeRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h);
              ctx.fillRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h);
          }
      }

      ctx.restore();
  }, [elements, currentElement, offset, scale, boardRotation, currentBgColor, selectedElementIds, selectionRect, partialPoints, mousePos, bgImageReady]);

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans relative">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-20">
          <div className="flex items-center gap-4">
              {onBack && <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"><ArrowLeft size={20} /></button>}
              <div className="flex flex-col">
                  <h1 className="text-lg font-bold text-white flex items-center gap-2 italic uppercase tracking-tighter">
                      <PenTool className="text-pink-400" /> Neural Canvas
                  </h1>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{isLive ? 'Live Sync' : 'Local Draft'}</span>
                    {onOpenManual && <button onClick={onOpenManual} className="p-1 text-slate-600 hover:text-white transition-colors" title="Canvas Manual"><Info size={12}/></button>}
                  </div>
              </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-inner">
              <button onClick={() => setTool('move')} className={`p-2 rounded-lg transition-all ${tool === 'move' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`} title="Selection (V)"><MousePointer2 size={18}/></button>
              <button onClick={() => setTool('hand')} className={`p-2 rounded-lg transition-all ${tool === 'hand' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`} title="Pan (H)"><Hand size={18}/></button>
              <div className="w-px h-6 bg-slate-800 mx-1"></div>
              <button onClick={() => setTool('pen')} className={`p-2 rounded-lg transition-all ${tool === 'pen' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-50'}`} title="Pen (P)"><Pen size={18}/></button>
              <button onClick={() => setTool('curve')} className={`p-2 rounded-lg transition-all ${tool === 'curve' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-50'}`} title="Path (C)"><Spline size={18}/></button>
              <button onClick={() => setTool('rect')} className={`p-2 rounded-lg transition-all ${tool === 'rect' ? 'bg-indigo-600 text-white' : 'text-slate-50'}`} title="Rectangle (R)"><Square size={18}/></button>
              <button onClick={() => setTool('circle')} className={`p-2 rounded-lg transition-all ${tool === 'circle' ? 'bg-indigo-600 text-white' : 'text-slate-50'}`} title="Circle (O)"><Circle size={18}/></button>
              <button onClick={() => setTool('arrow')} className={`p-2 rounded-lg transition-all ${tool === 'arrow' ? 'bg-indigo-600 text-white' : 'text-slate-50'}`} title="Arrow (A)"><ArrowRight size={18}/></button>
              <button onClick={() => setTool('type')} className={`p-2 rounded-lg transition-all ${tool === 'type' ? 'bg-indigo-600 text-white' : 'text-slate-50'}`} title="Text (T)"><Type size={18}/></button>
              <button onClick={() => setTool('eraser')} className={`p-2 rounded-lg transition-all ${tool === 'eraser' ? 'bg-indigo-600 text-white' : 'text-slate-50'}`} title="Eraser (E)"><Eraser size={18}/></button>
          </div>

          <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl shadow-inner">
                  <button onClick={() => setScale(s => s / 1.1)} className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-white transition-colors"><ZoomOut size={16}/></button>
                  <span className="text-[10px] font-mono font-black text-indigo-400 min-w-[40px] text-center">{Math.round(scale * 100)}%</span>
                  <button onClick={() => setScale(s => s * 1.1)} className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-white transition-colors"><ZoomIn size={16}/></button>
              </div>
              <button onClick={() => { setElements([]); setSelectedElementIds([]); }} className="p-2.5 bg-slate-800 hover:bg-red-900/30 hover:text-red-400 text-slate-400 border border-slate-700 rounded-xl transition-all"><Trash2 size={18}/></button>
          </div>
      </header>

      <div className="flex-1 relative overflow-hidden bg-slate-950 flex" ref={canvasWrapperRef}>
          {/* Floating Style Panel */}
          <div className="absolute top-6 left-6 z-30 flex flex-col gap-4">
              <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-[2rem] p-4 shadow-2xl space-y-6">
                  <div className="space-y-3">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Neural Style</label>
                      <div className="grid grid-cols-5 gap-2">
                        {['#ffffff', '#ef4444', '#10b981', '#6366f1', '#f59e0b'].map(c => (
                            <button key={c} onClick={() => setColor(c)} className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? 'border-white scale-110 shadow-lg shadow-white/10' : 'border-transparent opacity-60'}`} style={{ backgroundColor: c }} />
                        ))}
                      </div>
                  </div>
                  <div className="space-y-2">
                      <div className="flex justify-between items-center text-[9px] font-black uppercase text-slate-600 px-1"><span>Mass</span><span>{lineWidth}px</span></div>
                      <input type="range" min="1" max="50" value={lineWidth} onChange={e => setLineWidth(parseInt(e.target.value))} className="w-full h-1 bg-slate-800 appearance-none rounded-full accent-indigo-500" />
                  </div>
                  <div className="flex gap-2">
                      <button onClick={() => setLineStyle('solid')} className={`flex-1 py-1.5 rounded-lg border transition-all ${lineStyle === 'solid' ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-500'}`}><Minus size={14} className="mx-auto"/></button>
                      <button onClick={() => setLineStyle('dashed')} className={`flex-1 py-1.5 rounded-lg border transition-all ${lineStyle === 'dashed' ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-500'}`}><GripHorizontal size={14} className="mx-auto"/></button>
                  </div>
              </div>
          </div>

          <canvas 
            id="whiteboard-canvas-core"
            ref={canvasRef} 
            className="block h-full w-full touch-none"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />

          {textInput.visible && (
              <div className="absolute z-50 pointer-events-none" style={{ left: textInput.x * scale + offset.x + (canvasRef.current?.width || 0)/2/window.devicePixelRatio, top: textInput.y * scale + offset.y + (canvasRef.current?.height || 0)/2/window.devicePixelRatio }}>
                <textarea
                  ref={textInputRef}
                  value={textInput.value}
                  onChange={e => setTextInput({ ...textInput, value: e.target.value })}
                  onBlur={handleTextCommit}
                  className="bg-transparent text-white outline-none border-b-2 border-indigo-500 pointer-events-auto resize-none font-sans"
                  style={{ fontSize: `${16 * scale}px`, minWidth: '100px' }}
                />
              </div>
          )}
      </div>

      <footer className="p-3 bg-slate-950 border-t border-slate-800 flex justify-between items-center px-6 shrink-0">
          <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest"><RotateCw size={14}/><span>Rotation: {boardRotation}°</span></div>
          </div>
          <div className="flex items-center gap-2 text-[9px] font-black text-slate-700 uppercase tracking-[0.4em]">Neural Prism v7.0.0-ULTRA</div>
      </footer>
    </div>
  );
};

export default Whiteboard;
