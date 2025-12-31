
import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Share2, Trash2, Undo, PenTool, Eraser, Download, Square, Circle, Minus, ArrowRight, Type, ZoomIn, ZoomOut, MousePointer2, Move, MoreHorizontal, Lock, Eye, Edit3, GripHorizontal, Brush, ChevronDown, Feather, Highlighter, Wind, Droplet, Cloud, Edit2, Pen, Copy, Clipboard, BringToFront, SendToBack, Sparkles, Send, Loader2, X, RotateCw, Triangle, Star, Spline, Maximize } from 'lucide-react';
import { auth } from '../services/firebaseConfig';
import { saveWhiteboardSession, subscribeToWhiteboard, updateWhiteboardElement, deleteWhiteboardElements } from '../services/firestoreService';
import { WhiteboardElement, ToolType, LineStyle, BrushType } from '../types';
import { GoogleGenAI } from '@google/genai';

interface WhiteboardProps {
  onBack?: () => void;
  sessionId?: string;
  accessKey?: string; // Secret write token from URL
  onSessionStart?: (id: string) => void;
  // Embedded Props (For Code Studio)
  initialData?: string; 
  onDataChange?: (data: string) => void;
  isReadOnly?: boolean;
  disableAI?: boolean; 
}

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
  
  // Active Curve State
  const [activeCurvePoints, setActiveCurvePoints] = useState<{x: number, y: number}[]>([]);
  const [curveMousePos, setCurveMousePos] = useState<{x: number, y: number} | null>(null);

  // Tool State
  const [tool, setTool] = useState<ToolType>('pen');
  const [color, setColor] = useState('#ffffff');
  const [lineWidth, setLineWidth] = useState(3);
  const [lineStyle, setLineStyle] = useState<LineStyle>('solid');
  const [brushType, setBrushType] = useState<BrushType>('standard');
  const [fontSize, setFontSize] = useState(24);
  const [fontFamily, setFontFamily] = useState('sans-serif');
  const [borderRadius, setBorderRadius] = useState(0); 
  const [showShareDropdown, setShowShareDropdown] = useState(false);
  
  // Curve Arrow Settings
  const [startArrow, setStartArrow] = useState(false);
  const [endArrow, setEndArrow] = useState(false);
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ startX: number, startY: number, currX: number, currY: number } | null>(null);
  const [clipboard, setClipboard] = useState<WhiteboardElement[]>([]);
  
  const dragStartPos = useRef<{x: number, y: number} | null>(null);
  const initialSelectionStates = useRef<Map<string, WhiteboardElement>>(new Map());

  // Viewport State
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const lastPanPoint = useRef({ x: 0, y: 0 });
  
  // Shared Session
  const [isSharedSession, setIsSharedSession] = useState(!!sessionId);
  const [isReadOnly, setIsReadOnly] = useState(propReadOnly);
  const currentSessionIdRef = useRef<string>(sessionId || crypto.randomUUID());

  const [textInput, setTextInput] = useState<{ id: string; x: number; y: number; text: string; width?: number; height?: number; rotation?: number } | null>(null);
  const [writeToken, setWriteToken] = useState<string | undefined>(accessKey);

  // AI Assistant State
  const [showAIPrompt, setShowAIPrompt] = useState(false);
  const [aiPromptText, setAiPromptText] = useState('');
  const [isAIGenerating, setIsAIGenerating] = useState(false);

  // Initialize from Props (Embedded Mode)
  useEffect(() => {
      if (initialData && !isSharedSession) {
          try {
              const parsed = JSON.parse(initialData);
              if (Array.isArray(parsed)) {
                  setElements(parsed);
              }
          } catch (e) {
              console.warn("Failed to parse whiteboard data", e);
          }
      }
  }, [initialData, isSharedSession]); 

  // Initialize from Firebase (Standalone Mode)
  useEffect(() => {
    if (sessionId) {
        setIsSharedSession(true);
        currentSessionIdRef.current = sessionId;
        const unsubscribe = subscribeToWhiteboard(sessionId, (remoteElements: any) => {
            // For shared boards, we solely rely on remote updates for global state
            if (Array.isArray(remoteElements)) {
                setElements(remoteElements);
            }
        });
        
        if (accessKey) {
            setWriteToken(accessKey);
            setIsReadOnly(false);
        } else if (!writeToken) {
            setIsReadOnly(true);
        }

        return () => unsubscribe();
    }
  }, [sessionId, accessKey]);

  useEffect(() => {
      setIsReadOnly(propReadOnly);
  }, [propReadOnly]);

  const handleRecenter = () => {
      if (elements.length === 0 || !canvasRef.current) {
          setOffset({ x: 0, y: 0 });
          setScale(1);
          return;
      }
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      elements.forEach(el => {
          const bounds = getElementBounds(el);
          minX = Math.min(minX, bounds.x);
          minY = Math.min(minY, bounds.y);
          maxX = Math.max(maxX, bounds.x + bounds.w);
          maxY = Math.max(maxY, bounds.y + bounds.h);
      });
      const padding = 50;
      minX -= padding; minY -= padding; maxX += padding; maxY += padding;
      const contentWidth = maxX - minX;
      const contentHeight = maxY - minY;
      const canvasWidth = canvasRef.current.parentElement?.clientWidth || 800;
      const canvasHeight = canvasRef.current.parentElement?.clientHeight || 600;
      const scaleX = canvasWidth / contentWidth;
      const scaleY = canvasHeight / contentHeight;
      const newScale = Math.min(scaleX, scaleY, 1);
      const newOffsetX = (canvasWidth - contentWidth * newScale) / 2 - minX * newScale;
      const newOffsetY = (canvasHeight - contentHeight * newScale) / 2 - minY * newScale;
      setScale(newScale);
      setOffset({ x: newOffsetX, y: newOffsetY });
  };

  const finalizeCurve = () => {
      if (activeCurvePoints.length > 1) {
          const id = crypto.randomUUID();
          const newEl: WhiteboardElement = {
              id, type: 'curve', x: 0, y: 0, width: 0, height: 0,
              points: activeCurvePoints, color, strokeWidth: lineWidth,
              lineStyle, rotation: 0, startArrow, endArrow
          };
          const next = [...elements, newEl];
          setElements(next);
          if (onDataChange) emitChange(next);
          syncUpdate(newEl);
      }
      setActiveCurvePoints([]);
      setCurveMousePos(null);
  };

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (tool === 'curve' && activeCurvePoints.length > 0) {
              if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); finalizeCurve(); }
              return;
          }
          if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
          const isCtrl = e.ctrlKey || e.metaKey;
          if (isCtrl && e.key === 'c') { e.preventDefault(); copySelection(); }
          if (isCtrl && e.key === 'v') { e.preventDefault(); pasteFromClipboard(); }
          if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) { handleDeleteSelected(); }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, elements, clipboard, isReadOnly, tool, activeCurvePoints, startArrow, endArrow]);

  const copySelection = () => {
      if (selectedIds.length === 0) return;
      const toCopy = elements.filter(el => selectedIds.includes(el.id));
      setClipboard(JSON.parse(JSON.stringify(toCopy)));
  };

  const pasteFromClipboard = () => {
      if (clipboard.length === 0 || isReadOnly) return;
      const offsetPx = 20;
      const newIds: string[] = [];
      const newElements: WhiteboardElement[] = [];
      clipboard.forEach(item => {
          const newId = crypto.randomUUID();
          newIds.push(newId);
          const newItem: WhiteboardElement = {
              ...item, id: newId, x: item.x + offsetPx, y: item.y + offsetPx,
              endX: item.endX !== undefined ? item.endX + offsetPx : undefined,
              endY: item.endY !== undefined ? item.endY + offsetPx : undefined,
              points: item.points ? item.points.map(p => ({ x: p.x + offsetPx, y: p.y + offsetPx })) : undefined
          };
          newElements.push(newItem);
      });
      const nextElements = [...elements, ...newElements];
      setElements(nextElements);
      setSelectedIds(newIds);
      setClipboard(newElements);
      if (onDataChange) emitChange(nextElements);
      newElements.forEach(el => syncUpdate(el));
  };

  const handleBringToFront = () => {
      if (selectedIds.length === 0 || isReadOnly) return;
      const selected = elements.filter(el => selectedIds.includes(el.id));
      const others = elements.filter(el => !selectedIds.includes(el.id));
      const next = [...others, ...selected];
      setElements(next);
      if (onDataChange) emitChange(next);
      if (isSharedSession) saveWhiteboardSession(currentSessionIdRef.current, next);
  };

  const handleSendToBack = () => {
      if (selectedIds.length === 0 || isReadOnly) return;
      const selected = elements.filter(el => selectedIds.includes(el.id));
      const others = elements.filter(el => !selectedIds.includes(el.id));
      const next = [...selected, ...others];
      setElements(next);
      if (onDataChange) emitChange(next);
      if (isSharedSession) saveWhiteboardSession(currentSessionIdRef.current, next);
  };

  const emitChange = (newElements: WhiteboardElement[]) => {
      if (onDataChange) onDataChange(JSON.stringify(newElements));
  };

  const handleShare = async (mode: 'read' | 'edit') => {
      if (!auth.currentUser) { alert("Please sign in to share."); return; }
      let boardId = currentSessionIdRef.current;
      let token = writeToken;
      if (!sessionId && !isSharedSession) { boardId = crypto.randomUUID(); currentSessionIdRef.current = boardId; token = crypto.randomUUID(); setWriteToken(token); }
      if (!token) { token = crypto.randomUUID(); setWriteToken(token); }
      try {
        await saveWhiteboardSession(boardId, elements);
        if (onSessionStart && !sessionId) onSessionStart(boardId);
        const url = new URL(window.location.href);
        url.searchParams.set('session', boardId);
        if (mode === 'edit') url.searchParams.set('key', token); else url.searchParams.delete('key');
        url.searchParams.delete('whiteboard_session'); url.searchParams.delete('code_session'); url.searchParams.delete('view'); url.searchParams.delete('mode');
        const link = url.toString();
        await navigator.clipboard.writeText(link);
        alert(`${mode === 'edit' ? 'Edit' : 'Read-Only'} Link Copied!\n\nLink: ${link}`);
        setIsSharedSession(true); setShowShareDropdown(false); setIsReadOnly(false);
      } catch(e: any) { alert(`Failed to share: ${e.message}`); }
  };

  const syncUpdate = (el: WhiteboardElement) => {
      if (isSharedSession && !isReadOnly && !onDataChange) {
          updateWhiteboardElement(currentSessionIdRef.current, el);
      }
  };

  const updateSelectedElements = (updates: Partial<WhiteboardElement>) => {
      if (selectedIds.length === 0 || isReadOnly) return;
      const updatedElementsList: WhiteboardElement[] = [];
      setElements(prev => {
          const next = prev.map(el => {
            if (selectedIds.includes(el.id)) {
                const updated = { ...el, ...updates };
                updatedElementsList.push(updated);
                return updated;
            }
            return el;
          });
          if (onDataChange) emitChange(next);
          return next;
      });
      updatedElementsList.forEach(el => syncUpdate(el));
  };

  const handleAIGenerate = async () => {
      if (!aiPromptText.trim()) return;
      setIsAIGenerating(true);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const contextElements = elements.length > 20 ? elements.filter(e => e.type === 'text' || e.type === 'rect' || e.type === 'circle').slice(-20) : elements;
          const prompt = `Generate a JSON array of NEW WhiteboardElement objects to satisfy the user request: "${aiPromptText}". Return ONLY valid JSON array.`;
          const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt, config: { responseMimeType: 'application/json' } });
          const newItemsRaw = JSON.parse(response.text || "[]");
          if (Array.isArray(newItemsRaw)) {
              const newElements: WhiteboardElement[] = newItemsRaw.map((item: any) => ({ ...item, id: crypto.randomUUID(), strokeWidth: item.strokeWidth || 3, color: item.color || '#ffffff', fontSize: item.fontSize || 24, fontFamily: 'sans-serif' }));
              const next = [...elements, ...newElements];
              setElements(next);
              if (onDataChange) emitChange(next);
              newElements.forEach(el => syncUpdate(el));
              setSelectedIds(newElements.map(e => e.id));
          }
          setAiPromptText(''); setShowAIPrompt(false);
      } catch (e: any) { alert("AI Generation Failed: " + e.message); } finally { setIsAIGenerating(false); }
  };

  const drawArrowHead = (ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number, color: string) => {
      const headLength = 15; const angle = Math.atan2(toY - fromY, toX - fromX);
      ctx.beginPath(); ctx.moveTo(toX, toY);
      ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6));
      ctx.lineTo(toX, toY); ctx.fillStyle = color; ctx.fill();
  };

  const drawStar = (ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number) => {
      const spikes = 5; const outerRadius = Math.min(Math.abs(w), Math.abs(h)) / 2;
      const innerRadius = outerRadius / 2.5; let rot = Math.PI / 2 * 3; let x = cx; let y = cy; const step = Math.PI / spikes;
      ctx.beginPath(); ctx.moveTo(cx, cy - outerRadius);
      for (let i = 0; i < spikes; i++) {
          x = cx + Math.cos(rot) * outerRadius; y = cy + Math.sin(rot) * outerRadius; ctx.lineTo(x, y); rot += step;
          x = cx + Math.cos(rot) * innerRadius; y = cy + Math.sin(rot) * innerRadius; ctx.lineTo(x, y); rot += step;
      }
      ctx.lineTo(cx, cy - outerRadius); ctx.closePath(); ctx.stroke();
  };

  const drawWrappedText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
      const paragraphs = text.split('\n'); let cursorY = y;
      for (const paragraph of paragraphs) {
          const words = paragraph.split(' '); let line = '';
          for (let n = 0; n < words.length; n++) {
              const testLine = line + words[n] + ' '; const metrics = ctx.measureText(testLine); const testWidth = metrics.width;
              if (testWidth > maxWidth && n > 0) { ctx.fillText(line, x, cursorY); line = words[n] + ' '; cursorY += lineHeight; } else { line = testLine; }
          }
          ctx.fillText(line, x, cursorY); cursorY += lineHeight;
      }
  };

  const rotatePoint = (x: number, y: number, cx: number, cy: number, angleDeg: number) => {
      const rad = (angleDeg * Math.PI) / 180; const cos = Math.cos(rad); const sin = Math.sin(rad);
      return { x: (cos * (x - cx)) + (sin * (y - cy)) + cx, y: (cos * (y - cy)) - (sin * (x - cx)) + cy };
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
          const fs = el.fontSize || 24; let w = el.width || (el.text?.split('\n').sort((a,b)=>b.length-a.length)[0].length || 0) * fs * 0.6;
          let h = el.height || (el.text?.split('\n').length || 1) * fs * 1.2;
          return { x: el.x, y: el.y, w, h };
      }
      return { x: el.x, y: el.y, w: el.width || 0, h: el.height || 0 };
  };

  const isPointInElement = (x: number, y: number, el: WhiteboardElement): boolean => {
      const tolerance = 10 / scale; let testX = x, testY = y;
      if (el.rotation && el.rotation !== 0 && ['rect', 'text', 'circle', 'triangle', 'star'].includes(el.type)) {
          const bounds = getElementBounds(el); const cx = bounds.x + bounds.w / 2, cy = bounds.y + bounds.h / 2;
          const rotated = rotatePoint(x, y, cx, cy, el.rotation); testX = rotated.x; testY = rotated.y;
      }
      switch (el.type) {
          case 'rect': case 'triangle': case 'star': case 'text': const b = getElementBounds(el); return testX >= b.x && testX <= b.x + b.w && testY >= b.y && testY <= b.y + b.h;
          case 'circle': const rx = Math.abs(el.width || 0) / 2, ry = Math.abs(el.height || 0) / 2, cx = el.x + (el.width || 0) / 2, cy = el.y + (el.height || 0) / 2;
              return ((testX - cx) / rx) ** 2 + ((testY - cy) / ry) ** 2 <= 1;
          case 'line': case 'arrow': const x1 = el.x, y1 = el.y, x2 = el.endX || x1, y2 = el.endY || y1;
              const A = x - x1, B = y - y1, C = x2 - x1, D = y2 - y1, dot = A * C + B * D, len_sq = C * C + D * D, param = len_sq !== 0 ? dot / len_sq : -1;
              let xx, yy; if (param < 0) { xx = x1; yy = y1; } else if (param > 1) { xx = x2; yy = y2; } else { xx = x1 + param * C; yy = y1 + param * D; }
              return (x - xx) ** 2 + (y - yy) ** 2 < tolerance * tolerance;
          case 'pen': case 'eraser': case 'curve': return el.points?.some(p => Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2) < tolerance) || false;
          default: return false;
      }
  };

  const isElementIntersectingBox = (el: WhiteboardElement, box: {x: number, y: number, w: number, h: number}): boolean => {
      const bx = Math.min(box.x, box.x + box.w), by = Math.min(box.y, box.y + box.h), bw = Math.abs(box.w), bh = Math.abs(box.h);
      const eb = getElementBounds(el), ebx = Math.min(eb.x, eb.x + eb.w), eby = Math.min(eb.y, eb.y + eb.h), ebw = Math.abs(eb.w), ebh = Math.abs(eb.h);
      return (bx < ebx + ebw && bx + bw > ebx && by < eby + ebh && by + bh > eby);
  };

  const getWorldCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
      if (!canvasRef.current) return { x: 0, y: 0 }; const rect = canvasRef.current.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      return { x: (clientX - rect.left - offset.x) / scale, y: (clientY - rect.top - offset.y) / scale };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
      if (textInput) { handleTextComplete(); return; }
      if (tool === 'pan') { setIsPanning(true); const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX, clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY; lastPanPoint.current = { x: clientX, y: clientY }; return; }
      if (isReadOnly) return; const { x, y } = getWorldCoordinates(e);
      if (tool === 'curve') { const newPoints = [...activeCurvePoints, { x, y }]; setActiveCurvePoints(newPoints); setCurveMousePos({ x, y }); return; }
      if (selectedIds.length === 1) {
          const el = elements.find(e => e.id === selectedIds[0]);
          if (el) {
              const bounds = getElementBounds(el), handleSize = 10 / scale;
              const checkPoint = (tx: number, ty: number) => {
                  if (el.rotation) { const p = rotatePoint(x, y, bounds.x + bounds.w/2, bounds.y + bounds.h/2, el.rotation); return Math.abs(p.x - tx) < handleSize && Math.abs(p.y - ty) < handleSize; }
                  return Math.abs(x - tx) < handleSize && Math.abs(y - ty) < handleSize;
              };
              if (checkPoint(bounds.x + bounds.w / 2, bounds.y - 30 / scale)) { setIsRotating(true); setIsDrawing(true); dragStartPos.current = { x, y }; initialSelectionStates.current.set(el.id, JSON.parse(JSON.stringify(el))); return; }
              if (checkPoint(bounds.x + bounds.w, bounds.y + bounds.h)) { setIsResizing(true); setIsDrawing(true); setResizeHandle('br'); dragStartPos.current = { x, y }; initialSelectionStates.current.set(el.id, JSON.parse(JSON.stringify(el))); return; }
          }
      }
      if (tool === 'text') { setIsDrawing(true); setTextDragStart({ x, y }); setTextDragCurrent({ x, y }); return; }
      if (tool === 'select') {
          let hitId = null; for (let i = elements.length - 1; i >= 0; i--) { if (isPointInElement(x, y, elements[i])) { hitId = elements[i].id; break; } }
          const isCtrl = (e as React.MouseEvent).ctrlKey || (e as React.MouseEvent).metaKey;
          if (hitId) {
              if (isCtrl) { if (selectedIds.includes(hitId)) setSelectedIds(prev => prev.filter(id => id !== hitId)); else setSelectedIds(prev => [...prev, hitId]); } 
              else { if (!selectedIds.includes(hitId)) setSelectedIds([hitId]); }
              setIsDraggingSelection(true); dragStartPos.current = { x, y };
              const idsToDrag = (!isCtrl && !selectedIds.includes(hitId)) ? [hitId] : selectedIds;
              elements.forEach(el => { if (idsToDrag.includes(el.id)) initialSelectionStates.current.set(el.id, JSON.parse(JSON.stringify(el))); });
          } else { if (!isCtrl) setSelectedIds([]); setSelectionBox({ startX: x, startY: y, currX: x, currY: y }); } return;
      }
      setIsDrawing(true); setSelectedIds([]); const id = crypto.randomUUID();
      const newEl: WhiteboardElement = { id, type: tool, x, y, color: tool === 'eraser' ? '#0f172a' : color, strokeWidth: tool === 'eraser' ? 20 : lineWidth, lineStyle: tool === 'eraser' ? 'solid' : lineStyle, brushType, points: tool === 'pen' || tool === 'eraser' ? [{ x, y }] : undefined, width: 0, height: 0, endX: x, endY: y, borderRadius: tool === 'rect' ? borderRadius : undefined, rotation: 0 };
      setCurrentElement(newEl);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
      if (isPanning) {
          const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX, clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
          const dx = clientX - lastPanPoint.current.x, dy = clientY - lastPanPoint.current.y;
          setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy })); lastPanPoint.current = { x: clientX, y: clientY }; return;
      }
      if (isReadOnly) return; const { x, y } = getWorldCoordinates(e);
      if (tool === 'curve') { setCurveMousePos({ x, y }); return; }
      if (tool === 'text' && isDrawing) { setTextDragCurrent({ x, y }); return; }
      if (selectionBox) { setSelectionBox(prev => prev ? ({ ...prev, currX: x, currY: y }) : null); return; }
      if (isRotating && selectedIds.length === 1) {
          const elId = selectedIds[0], initEl = initialSelectionStates.current.get(elId);
          if (initEl) { const bounds = getElementBounds(initEl), cx = bounds.x + bounds.w / 2, cy = bounds.y + bounds.h / 2;
              setElements(prev => prev.map(el => el.id === elId ? { ...el, rotation: Math.atan2(y - cy, x - cx) * (180 / Math.PI) + 90 } : el));
          } return;
      }
      if (isResizing && selectedIds.length === 1) {
          const elId = selectedIds[0], initEl = initialSelectionStates.current.get(elId);
          if (initEl && resizeHandle === 'br') {
              let lx = x, ly = y; if (initEl.rotation) { const b = getElementBounds(initEl), p = rotatePoint(x, y, b.x + b.w / 2, b.y + b.h / 2, initEl.rotation); lx = p.x; ly = p.y; }
              setElements(prev => prev.map(el => el.id === elId ? { ...el, width: el.type === 'text' ? Math.max(20, lx - initEl.x) : lx - initEl.x, height: ly - initEl.y } : el));
          } return;
      }
      if (isDraggingSelection && dragStartPos.current) {
          const dx = x - dragStartPos.current.x, dy = y - dragStartPos.current.y;
          setElements(prev => prev.map(el => {
              if (initialSelectionStates.current.has(el.id)) { const init = initialSelectionStates.current.get(el.id)!; const newEl = { ...el, x: init.x + dx, y: init.y + dy };
                  if (init.type === 'line' || init.type === 'arrow') { newEl.endX = (init.endX || 0) + dx; newEl.endY = (init.endY || 0) + dy; } else if (init.type === 'pen' || init.type === 'eraser') { newEl.points = init.points?.map(p => ({ x: p.x + dx, y: p.y + dy })); }
                  return newEl;
              } return el;
          })); return;
      }
      if (!isDrawing || !currentElement) return;
      if (tool === 'pen' || tool === 'eraser') { setCurrentElement(prev => prev ? ({ ...prev, points: [...(prev.points || []), { x, y }] }) : null); }
      else if (['rect','circle','triangle','star'].includes(tool)) { setCurrentElement(prev => prev ? ({ ...prev, width: x - prev.x, height: y - prev.y }) : null); }
      else if (tool === 'line' || tool === 'arrow') { setCurrentElement(prev => prev ? ({ ...prev, endX: x, endY: y }) : null); }
  };

  const stopDrawing = () => {
      if (isPanning) { setIsPanning(false); return; }
      if (isReadOnly || tool === 'curve') return;
      if (isRotating || isResizing) { setIsRotating(false); setIsResizing(false); setResizeHandle(null); setIsDrawing(false); if (onDataChange) emitChange(elements); if (isSharedSession && selectedIds.length === 1) { const el = elements.find(e => e.id === selectedIds[0]); if (el) syncUpdate(el); } return; }
      if (tool === 'text' && isDrawing && textDragStart && textDragCurrent) {
          setIsDrawing(false); const w = Math.abs(textDragCurrent.x - textDragStart.x), h = Math.abs(textDragCurrent.y - textDragStart.y), x = Math.min(textDragStart.x, textDragCurrent.x), y = Math.min(textDragStart.y, textDragCurrent.y);
          setTextInput({ id: crypto.randomUUID(), x: w > 20 ? x : textDragStart.x, y: h > 20 ? y : textDragStart.y, text: '', width: w > 20 ? w : undefined, height: h > 20 ? h : undefined });
          setTextDragStart(null); setTextDragCurrent(null); return;
      }
      if (selectionBox) { const box = { x: selectionBox.startX, y: selectionBox.startY, w: selectionBox.currX - selectionBox.startX, h: selectionBox.currY - selectionBox.startY }; setSelectedIds(elements.filter(el => isElementIntersectingBox(el, box)).map(el => el.id)); setSelectionBox(null); return; }
      if (isDraggingSelection) { if (onDataChange) emitChange(elements); if (isSharedSession) elements.filter(el => initialSelectionStates.current.has(el.id)).forEach(syncUpdate); setIsDraggingSelection(false); dragStartPos.current = null; initialSelectionStates.current.clear(); return; }
      if (isDrawing && currentElement) { const next = [...elements, currentElement]; setElements(next); if (onDataChange) emitChange(next); syncUpdate(currentElement); setCurrentElement(null); setIsDrawing(false); }
  };

  const [textDragStart, setTextDragStart] = useState<{x: number, y: number} | null>(null);
  const [textDragCurrent, setTextDragCurrent] = useState<{x: number, y: number} | null>(null);

  useEffect(() => {
      const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return;
      canvas.width = canvas.parentElement?.clientWidth || 800; canvas.height = canvas.parentElement?.clientHeight || 600;
      ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.save(); ctx.translate(offset.x, offset.y); ctx.scale(scale, scale);
      const renderElement = (el: WhiteboardElement) => {
          if (textInput && el.id === textInput.id) return;
          ctx.save();
          if (el.rotation) { const b = getElementBounds(el), cx = b.x + b.w / 2, cy = b.y + b.h / 2; ctx.translate(cx, cy); ctx.rotate(el.rotation * Math.PI / 180); ctx.translate(-cx, -cy); }
          ctx.beginPath(); ctx.strokeStyle = el.color; ctx.lineWidth = el.strokeWidth / scale; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          if (el.lineStyle === 'dashed') ctx.setLineDash([15, 10]); else if (el.lineStyle === 'dotted') ctx.setLineDash([3, 8]); else ctx.setLineDash([]);
          if (el.type === 'pen' || el.type === 'eraser') { if (el.points?.length) { ctx.moveTo(el.points[0].x, el.points[0].y); el.points.forEach(p => ctx.lineTo(p.x, p.y)); ctx.stroke(); } }
          else if (el.type === 'curve') { if (el.points?.length! > 1) { ctx.moveTo(el.points![0].x, el.points![0].y); for (let i = 1; i < el.points!.length - 1; i++) { const xc = (el.points![i].x + el.points![i+1].x) / 2, yc = (el.points![i].y + el.points![i+1].y) / 2; ctx.quadraticCurveTo(el.points![i].x, el.points![i].y, xc, yc); } ctx.lineTo(el.points![el.points!.length-1].x, el.points![el.points!.length-1].y); ctx.stroke(); } }
          else if (el.type === 'rect') { const w = el.width || 0, h = el.height || 0; if (el.borderRadius) { const r = Math.min(el.borderRadius, Math.min(Math.abs(w), Math.abs(h)) / 2); ctx.roundRect(el.x, el.y, w, h, r); ctx.stroke(); } else ctx.strokeRect(el.x, el.y, w, h); }
          else if (el.type === 'circle') { ctx.ellipse(el.x + (el.width||0)/2, el.y + (el.height||0)/2, Math.abs((el.width||0)/2), Math.abs((el.height||0)/2), 0, 0, 2*Math.PI); ctx.stroke(); }
          else if (el.type === 'triangle') { const w = el.width || 0, h = el.height || 0; ctx.moveTo(el.x + w/2, el.y); ctx.lineTo(el.x + w, el.y + h); ctx.lineTo(el.x, el.y + h); ctx.closePath(); ctx.stroke(); }
          else if (el.type === 'star') drawStar(ctx, el.x + (el.width||0)/2, el.y + (el.height||0)/2, el.width||0, el.height||0);
          else if (el.type === 'line') { ctx.moveTo(el.x, el.y); ctx.lineTo(el.endX||el.x, el.endY||el.y); ctx.stroke(); }
          else if (el.type === 'arrow') { const ex = el.endX||el.x, ey = el.endY||el.y; ctx.moveTo(el.x, el.y); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]); drawArrowHead(ctx, el.x, el.y, ex, ey, el.color); }
          else if (el.type === 'text' && el.text) { ctx.font = `${el.fontSize || 24}px ${el.fontFamily || 'sans-serif'}`; ctx.fillStyle = el.color; if (el.width) drawWrappedText(ctx, el.text, el.x, el.y, el.width, (el.fontSize || 24) * 1.2); else el.text.split('\n').forEach((l, i) => ctx.fillText(l, el.x, el.y + i * (el.fontSize || 24) * 1.2)); }
          ctx.restore();
      };
      elements.forEach(renderElement); if (currentElement) renderElement(currentElement);
      if (tool === 'curve' && activeCurvePoints.length > 0) { ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = lineWidth / scale; ctx.moveTo(activeCurvePoints[0].x, activeCurvePoints[0].y); activeCurvePoints.forEach(p => ctx.lineTo(p.x, p.y)); if (curveMousePos) ctx.lineTo(curveMousePos.x, curveMousePos.y); ctx.stroke(); }
      if (selectedIds.length > 0) {
          ctx.save(); selectedIds.forEach(id => {
              const el = elements.find(e => e.id === id); if (el) {
                  const b = getElementBounds(el); if (el.rotation) { const cx = b.x + b.w/2, cy = b.y + b.h/2; ctx.translate(cx, cy); ctx.rotate(el.rotation * Math.PI / 180); ctx.translate(-cx, -cy); }
                  const p = 8 / scale; ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1 / scale; ctx.setLineDash([]); ctx.strokeRect(b.x - p, b.y - p, b.w + p*2, b.h + p*2);
                  if (['rect','text','circle','triangle','star'].includes(el.type)) {
                      ctx.fillStyle = '#ffffff'; ctx.fillRect(b.x + b.w + p - 4/scale, b.y + b.h + p - 4/scale, 8/scale, 8/scale);
                      ctx.beginPath(); ctx.moveTo(b.x + b.w/2, b.y - p); ctx.lineTo(b.x + b.w/2, b.y - p - 30/scale); ctx.stroke(); ctx.arc(b.x + b.w/2, b.y - p - 30/scale, 5/scale, 0, 2*Math.PI); ctx.fill();
                  }
              }
          }); ctx.restore();
      }
      if (selectionBox) { ctx.fillStyle = 'rgba(59, 130, 246, 0.1)'; ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1/scale; ctx.fillRect(selectionBox.startX, selectionBox.startY, selectionBox.currX - selectionBox.startX, selectionBox.currY - selectionBox.startY); ctx.strokeRect(selectionBox.startX, selectionBox.startY, selectionBox.currX - selectionBox.startX, selectionBox.currY - selectionBox.startY); }
      ctx.restore();
  }, [elements, currentElement, scale, offset, selectedIds, selectionBox, tool, isDrawing, textDragStart, textDragCurrent, textInput, activeCurvePoints, curveMousePos]);

  const handleTextComplete = () => {
      if (isReadOnly) { setTextInput(null); return; }
      if (textInput && textInput.text.trim()) {
          const newEl: WhiteboardElement = { id: textInput.id, type: 'text', x: textInput.x, y: textInput.y, text: textInput.text, color, strokeWidth: 1, fontSize, fontFamily, width: textInput.width, rotation: textInput.rotation || 0 };
          const next = [...elements]; const idx = next.findIndex(e => e.id === newEl.id); if (idx >= 0) next[idx] = newEl; else next.push(newEl);
          setElements(next); if (onDataChange) emitChange(next); syncUpdate(newEl);
      } setTextInput(null);
  };

  const handleClear = () => { if(isReadOnly) return; if(confirm("Clear whiteboard?")) { setElements([]); if (onDataChange) emitChange([]); if (isSharedSession) saveWhiteboardSession(currentSessionIdRef.current, []); } };
  const handleDeleteSelected = () => { if(isReadOnly) return; if (selectedIds.length > 0) { const ids = [...selectedIds], next = elements.filter(el => !selectedIds.includes(el.id)); setElements(next); if (onDataChange) emitChange(next); setSelectedIds([]); if (isSharedSession) deleteWhiteboardElements(currentSessionIdRef.current, ids); } };
  const handleDownload = () => { const c = canvasRef.current; if(c) { const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = 'whiteboard.png'; a.click(); } };
  const handleDoubleClick = (e: React.MouseEvent) => { if (isReadOnly || tool === 'pan') return; const { x, y } = getWorldCoordinates(e); let hit = null; for (let i = elements.length - 1; i >= 0; i--) { if (elements[i].type === 'text' && isPointInElement(x, y, elements[i])) { hit = elements[i]; break; } }
      if (hit) { setTextInput({ id: hit.id, x: hit.x, y: hit.y, text: hit.text || '', width: hit.width, height: hit.height, rotation: hit.rotation || 0 }); setColor(hit.color); if (hit.fontSize) setFontSize(hit.fontSize); } else { setTool('text'); setTextInput({ id: crypto.randomUUID(), x, y, text: '' }); } };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden relative">
        {!onDataChange && (
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900 shrink-0 z-10">
            <div className="flex items-center gap-4">
                {onBack && <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"><ArrowLeft size={20} /></button>}
                <h1 className="text-xl font-bold text-white flex items-center gap-2"><PenTool className="text-pink-400" /> Whiteboard {isSharedSession && <span className="text-xs bg-indigo-600 px-2 py-0.5 rounded text-white animate-pulse">LIVE</span>}</h1>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={handleDownload} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300"><Download size={18} /></button>
                <div className="relative">
                    <button onClick={() => setShowShareDropdown(!showShareDropdown)} className={`p-2 rounded-lg text-white font-bold flex items-center gap-2 ${isSharedSession ? 'bg-indigo-600' : 'bg-slate-700'}`}><Share2 size={18} /> Share</button>
                    {showShareDropdown && (
                        <div className="absolute top-full right-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-40 overflow-hidden py-1">
                            <button onClick={() => handleShare('read')} className="w-full text-left px-4 py-2 hover:bg-slate-800 text-xs text-slate-300 flex items-center gap-2"><Eye size={12} /> Copy Read-Only</button>
                            <button onClick={() => handleShare('edit')} className="w-full text-left px-4 py-2 hover:bg-slate-800 text-xs text-emerald-400 flex items-center gap-2"><Edit3 size={12} /> Copy Edit Link</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
        )}
        <div className={`bg-slate-900 border-b border-slate-800 p-2 flex flex-wrap justify-center gap-2 shrink-0 z-10 items-center ${isReadOnly ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex bg-slate-800 rounded-lg p-1 mr-2">
                <button onClick={handleRecenter} className="p-1.5 hover:bg-slate-700 rounded text-slate-400"><Maximize size={16}/></button>
                <button onClick={() => setScale(s => Math.min(s + 0.1, 3))} className="p-1.5 hover:bg-slate-700 rounded text-slate-400"><ZoomIn size={16}/></button>
                <button onClick={() => setScale(s => Math.max(s - 0.1, 0.5))} className="p-1.5 hover:bg-slate-700 rounded text-slate-400"><ZoomOut size={16}/></button>
            </div>
            <div className="flex bg-slate-800 rounded-lg p-1">
                <button onClick={() => { setTool('select'); setIsDrawing(false); }} className={`p-1.5 rounded ${tool === 'select' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><MousePointer2 size={16}/></button>
                <button onClick={() => setTool('pan')} className={`p-1.5 rounded ${tool === 'pan' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><Move size={16}/></button>
                <button onClick={() => setTool('pen')} className={`p-1.5 rounded ${tool === 'pen' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><PenTool size={16}/></button>
                <button onClick={() => setTool('eraser')} className={`p-1.5 rounded ${tool === 'eraser' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><Eraser size={16}/></button>
                <button onClick={() => setTool('text')} className={`p-1.5 rounded ${tool === 'text' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><Type size={16}/></button>
                <button onClick={() => setTool('rect')} className={`p-1.5 rounded ${tool === 'rect' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><Square size={16}/></button>
                <button onClick={() => setTool('circle')} className={`p-1.5 rounded ${tool === 'circle' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><Circle size={16}/></button>
                <button onClick={() => setTool('line')} className={`p-1.5 rounded ${tool === 'line' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><Minus size={16}/></button>
                <button onClick={() => setTool('arrow')} className={`p-1.5 rounded ${tool === 'arrow' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><ArrowRight size={16}/></button>
            </div>
            {!disableAI && (
                <button onClick={() => setShowAIPrompt(!showAIPrompt)} className={`p-1.5 rounded bg-gradient-to-r from-purple-900/50 to-pink-900/50 border border-purple-500/30 ${showAIPrompt ? 'bg-pink-500 text-white' : 'text-pink-300'}`}><Sparkles size={16} /></button>
            )}
            <div className="flex gap-1 px-2 bg-slate-800 rounded-lg">
                {['#ffffff', '#ef4444', '#22c55e', '#3b82f6', '#f59e0b'].map(c => <button key={c} onClick={() => { setColor(c); updateSelectedElements({ color: c }); }} className="w-4 h-4 rounded-full" style={{ backgroundColor: c }} />)}
            </div>
            <div className="flex gap-1 ml-auto">
                <button onClick={() => setElements(prev => prev.slice(0, -1))} className="p-1.5 hover:bg-slate-800 rounded text-slate-400"><Undo size={16} /></button>
                <button onClick={selectedIds.length > 0 ? handleDeleteSelected : handleClear} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-red-400"><Trash2 size={16} /></button>
            </div>
        </div>
        <div className={`flex-1 relative overflow-hidden bg-slate-950 touch-none ${isReadOnly ? 'cursor-default' : 'cursor-crosshair'}`}>
            <canvas ref={canvasRef} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onDoubleClick={handleDoubleClick} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} className="block w-full h-full" style={{ cursor: tool === 'pan' ? (isPanning ? 'grabbing' : 'grab') : (isReadOnly ? 'default' : 'crosshair') }} />
            {textInput && !isReadOnly && (
                <textarea autoFocus value={textInput.text} onChange={e => setTextInput(prev => prev ? ({ ...prev, text: e.target.value }) : null)} onBlur={handleTextComplete} style={{ position: 'absolute', left: textInput.x * scale + offset.x, top: textInput.y * scale + offset.y, fontSize: `${fontSize * scale}px`, color, background: 'transparent', border: '1px dashed #64748b', outline: 'none', width: 'auto', minWidth: '50px', zIndex: 20 }} placeholder="..." />
            )}
            {showAIPrompt && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 flex items-center gap-2 z-50 animate-fade-in-up">
                    <input autoFocus value={aiPromptText} onChange={e => setAiPromptText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAIGenerate()} placeholder="AI Assistant (e.g. 'Draw a cloud architecture diagram')..." className="flex-1 bg-transparent text-white outline-none text-sm p-2" />
                    <button onClick={handleAIGenerate} disabled={isAIGenerating} className="p-2 bg-indigo-600 text-white rounded-lg">{isAIGenerating ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>}</button>
                </div>
            )}
        </div>
    </div>
  );
};
