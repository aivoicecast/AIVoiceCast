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
  disableAI?: boolean; // New prop to hide internal AI if parent handles it
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
  
  // Active Curve State (For "Click-Click" drawing)
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

  // Text Input State
  const [textInput, setTextInput] = useState<{ id: string; x: number; y: number; text: string; width?: number; height?: number; rotation?: number } | null>(null);
  const [textDragStart, setTextDragStart] = useState<{x: number, y: number} | null>(null);
  const [textDragCurrent, setTextDragCurrent] = useState<{x: number, y: number} | null>(null);

  const [writeToken, setWriteToken] = useState<string | undefined>(undefined);

  // AI Assistant State (Internal)
  const [showAIPrompt, setShowAIPrompt] = useState(false);
  const [aiPromptText, setAiPromptText] = useState('');
  const [isAIGenerating, setIsAIGenerating] = useState(false);

  // Initialize from Props (Embedded Mode)
  useEffect(() => {
      if (initialData) {
          try {
              const parsed = JSON.parse(initialData);
              if (Array.isArray(parsed)) {
                  setElements(parsed);
              }
          } catch (e) {
              console.warn("Failed to parse whiteboard data", e);
          }
      }
  }, [initialData]); 

  // Initialize from Firebase (Standalone Mode)
  useEffect(() => {
    if (sessionId) {
        setIsSharedSession(true);
        currentSessionIdRef.current = sessionId;
        const unsubscribe = subscribeToWhiteboard(sessionId, (remoteData: any) => {
            let remoteElements: WhiteboardElement[] = [];
            if (Array.isArray(remoteData)) {
                remoteElements = remoteData;
            }
            setElements(remoteElements);
        });
        
        const hasKey = !!accessKey;
        if (accessKey) {
            setWriteToken(accessKey);
            setIsReadOnly(false);
        } else {
            if (!writeToken) {
                 setIsReadOnly(true);
            }
        }

        return () => unsubscribe();
    }
  }, [sessionId, accessKey]);

  useEffect(() => {
      setIsReadOnly(propReadOnly);
  }, [propReadOnly]);

  // Force tool reset if read-only
  useEffect(() => {
      if (isReadOnly && tool !== 'pan' && tool !== 'select') {
          setTool('pan');
      }
  }, [isReadOnly, tool]);

  // Recenter Viewport Function
  const handleRecenter = () => {
      if (elements.length === 0 || !canvasRef.current) {
          setOffset({ x: 0, y: 0 });
          setScale(1);
          return;
      }

      // 1. Calculate Bounding Box of all elements
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

      elements.forEach(el => {
          const bounds = getElementBounds(el);
          minX = Math.min(minX, bounds.x);
          minY = Math.min(minY, bounds.y);
          maxX = Math.max(maxX, bounds.x + bounds.w);
          maxY = Math.max(maxY, bounds.y + bounds.h);
      });

      // Add padding
      const padding = 50;
      minX -= padding;
      minY -= padding;
      maxX += padding;
      maxY += padding;

      const contentWidth = maxX - minX;
      const contentHeight = maxY - minY;
      const canvasWidth = canvasRef.current.parentElement?.clientWidth || 800;
      const canvasHeight = canvasRef.current.parentElement?.clientHeight || 600;

      // 2. Determine Scale to fit
      const scaleX = canvasWidth / contentWidth;
      const scaleY = canvasHeight / contentHeight;
      const newScale = Math.min(scaleX, scaleY, 1); // Don't zoom in more than 100% automatically

      // 3. Center it
      const newOffsetX = (canvasWidth - contentWidth * newScale) / 2 - minX * newScale;
      const newOffsetY = (canvasHeight - contentHeight * newScale) / 2 - minY * newScale;

      setScale(newScale);
      setOffset({ x: newOffsetX, y: newOffsetY });
  };

  // Helper for Finalizing Curve (Needed for Keyboard Shortcut)
  const finalizeCurve = () => {
      if (activeCurvePoints.length > 1) {
          const id = crypto.randomUUID();
          const newEl: WhiteboardElement = {
              id,
              type: 'curve',
              x: 0, y: 0, // Points are absolute for curves/pens
              width: 0, height: 0,
              points: activeCurvePoints,
              color: color,
              strokeWidth: lineWidth,
              lineStyle: lineStyle,
              rotation: 0,
              startArrow: startArrow,
              endArrow: endArrow
          };
          const next = [...elements, newEl];
          setElements(next);
          if (onDataChange) emitChange(next);
          syncUpdate(newEl);
      }
      setActiveCurvePoints([]);
      setCurveMousePos(null);
  };

  // Keyboard Shortcuts (Copy/Paste + Curve Finish)
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          // Finish Curve on Enter or Escape
          if (tool === 'curve' && activeCurvePoints.length > 0) {
              if (e.key === 'Enter' || e.key === 'Escape') {
                  e.preventDefault();
                  finalizeCurve();
              }
              return;
          }

          // Ignore if user is typing in a text area (like the whiteboard text tool)
          if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;

          const isCtrl = e.ctrlKey || e.metaKey;

          if (isCtrl && e.key === 'c') {
              e.preventDefault();
              copySelection();
          }
          if (isCtrl && e.key === 'v') {
              e.preventDefault();
              pasteFromClipboard();
          }
          if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
              handleDeleteSelected();
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, elements, clipboard, isReadOnly, tool, activeCurvePoints, startArrow, endArrow]);

  const copySelection = () => {
      if (selectedIds.length === 0) return;
      const toCopy = elements.filter(el => selectedIds.includes(el.id));
      // Deep copy to disconnect reference
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
              ...item,
              id: newId,
              x: item.x + offsetPx,
              y: item.y + offsetPx,
              // Offset endpoints for lines/arrows
              endX: item.endX !== undefined ? item.endX + offsetPx : undefined,
              endY: item.endY !== undefined ? item.endY + offsetPx : undefined,
              // Offset all points for pen/curve strokes
              points: item.points ? item.points.map(p => ({ x: p.x + offsetPx, y: p.y + offsetPx })) : undefined
          };
          newElements.push(newItem);
      });

      const nextElements = [...elements, ...newElements];
      setElements(nextElements);
      setSelectedIds(newIds);
      
      // Update clipboard to the newly pasted items (allows cascading paste)
      setClipboard(newElements);

      if (onDataChange) emitChange(nextElements);
      newElements.forEach(el => syncUpdate(el));
  };

  // Layer Management
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
      if (onDataChange) {
          onDataChange(JSON.stringify(newElements));
      }
  };

  const handleShare = async (mode: 'read' | 'edit') => {
      if (!auth.currentUser) {
          alert("Please sign in to share.");
          return;
      }
      
      let boardId = currentSessionIdRef.current;
      let token = writeToken;
      
      if (!sessionId && !isSharedSession) {
          boardId = crypto.randomUUID();
          currentSessionIdRef.current = boardId;
          token = crypto.randomUUID();
          setWriteToken(token);
      }
      
      if (!token) {
          token = crypto.randomUUID();
          setWriteToken(token);
      }
      
      try {
        await saveWhiteboardSession(boardId, elements);
        
        if (onSessionStart && !sessionId) {
            onSessionStart(boardId);
        }
        
        const url = new URL(window.location.href);
        url.searchParams.set('session', boardId);
        
        if (mode === 'edit') {
            url.searchParams.set('key', token);
        } else {
            url.searchParams.delete('key');
        }

        url.searchParams.delete('whiteboard_session');
        url.searchParams.delete('code_session');
        url.searchParams.delete('view');
        url.searchParams.delete('mode');
        
        const link = url.toString();
        
        await navigator.clipboard.writeText(link);
        alert(`${mode === 'edit' ? 'Edit' : 'Read-Only'} Link Copied!\n\nLink: ${link}`);
        
        setIsSharedSession(true);
        setShowShareDropdown(false);
        setIsReadOnly(false);
      } catch(e: any) {
          console.error(e);
          alert(`Failed to share: ${e.message}`);
      }
  };

  useEffect(() => {
      if (selectedIds.length === 1) {
          const el = elements.find(e => e.id === selectedIds[0]);
          if (el) {
              setColor(el.color);
              setLineWidth(el.strokeWidth);
              if (['line','arrow','rect','circle','triangle','star','curve'].includes(el.type)) {
                  setLineStyle(el.lineStyle || 'solid');
              }
              if (el.type === 'text') {
                  setFontSize(el.fontSize || 24);
                  setFontFamily(el.fontFamily || 'sans-serif');
              }
              if (el.type === 'pen') {
                  setBrushType(el.brushType || 'standard');
              }
              if (el.type === 'rect') {
                  setBorderRadius(el.borderRadius || 0);
              }
              if (el.type === 'curve') {
                  setStartArrow(!!el.startArrow);
                  setEndArrow(!!el.endArrow);
              }
          }
      }
  }, [selectedIds, elements]);

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

  // --- AI GENERATION LOGIC ---
  const handleAIGenerate = async () => {
      if (!aiPromptText.trim()) return;
      setIsAIGenerating(true);

      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          
          // Contextualize with current elements (limited to last 20 to avoid token limits, prioritizing text and shapes)
          const contextElements = elements.length > 20 
              ? elements.filter(e => e.type === 'text' || e.type === 'rect' || e.type === 'circle').slice(-20) 
              : elements;

          const prompt = `
            You are an AI Assistant for an infinite canvas whiteboard.
            
            User Request: "${aiPromptText}"
            
            Context (Current Elements on Board):
            ${JSON.stringify(contextElements)}
            
            Canvas Center Viewport: X=${-offset.x}, Y=${-offset.y} (Scale: ${scale})
            
            Task: Generate a JSON array of NEW WhiteboardElement objects to satisfy the user request.
            - If the user asks to "fill in" or "label" something existing, assume the context elements provided are the target.
            - Use relative coordinates near the existing elements or center of viewport.
            - Ensure 'id' is a unique string (you can use 'gen-1', 'gen-2').
            - 'type' can be: 'text', 'rect', 'circle', 'line', 'arrow', 'triangle', 'star'. (Avoid 'pen'/'curve' points as they are heavy).
            - For 'text', provide 'text', 'fontSize', 'color'.
            - For shapes, provide 'x', 'y', 'width', 'height', 'color', 'strokeWidth'.
            - For 'line'/'arrow', provide 'x', 'y', 'endX', 'endY'.
            
            Return ONLY valid JSON array. No markdown formatting.
          `;

          const response = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: prompt,
              config: { responseMimeType: 'application/json' }
          });

          const jsonStr = response.text || "[]";
          const newItemsRaw = JSON.parse(jsonStr);
          
          if (Array.isArray(newItemsRaw)) {
              const newElements: WhiteboardElement[] = newItemsRaw.map((item: any) => ({
                  ...item,
                  id: crypto.randomUUID(), // Regenerate ID to be safe
                  strokeWidth: item.strokeWidth || 3,
                  color: item.color || '#ffffff',
                  fontSize: item.fontSize || 24,
                  fontFamily: 'sans-serif'
              }));

              const next = [...elements, ...newElements];
              setElements(next);
              if (onDataChange) emitChange(next);
              newElements.forEach(el => syncUpdate(el));
              
              // Select the new items
              setSelectedIds(newElements.map(e => e.id));
          }

          setAiPromptText('');
          setShowAIPrompt(false);

      } catch (e: any) {
          console.error("AI Gen Failed", e);
          alert("AI Generation Failed: " + e.message);
      } finally {
          setIsAIGenerating(false);
      }
  };

  // Helper Functions
  const drawArrowHead = (ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number, color: string) => {
      const headLength = 15; 
      const angle = Math.atan2(toY - fromY, toX - fromX);
      ctx.beginPath();
      ctx.moveTo(toX, toY);
      ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6));
      ctx.lineTo(toX, toY);
      ctx.fillStyle = color;
      ctx.fill();
  };

  const drawStar = (ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number) => {
      const spikes = 5;
      const outerRadius = Math.min(Math.abs(w), Math.abs(h)) / 2;
      const innerRadius = outerRadius / 2.5;
      let rot = Math.PI / 2 * 3;
      let x = cx;
      let y = cy;
      const step = Math.PI / spikes;

      ctx.beginPath();
      ctx.moveTo(cx, cy - outerRadius); // Start top center relative to center
      
      for (let i = 0; i < spikes; i++) {
          x = cx + Math.cos(rot) * outerRadius;
          y = cy + Math.sin(rot) * outerRadius;
          ctx.lineTo(x, y);
          rot += step;

          x = cx + Math.cos(rot) * innerRadius;
          y = cy + Math.sin(rot) * innerRadius;
          ctx.lineTo(x, y);
          rot += step;
      }
      ctx.lineTo(cx, cy - outerRadius);
      ctx.closePath();
      ctx.stroke();
  };

  const drawWrappedText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
      const paragraphs = text.split('\n');
      let cursorY = y;
      for (const paragraph of paragraphs) {
          const words = paragraph.split(' ');
          let line = '';
          for (let n = 0; n < words.length; n++) {
              const testLine = line + words[n] + ' ';
              const metrics = ctx.measureText(testLine);
              const testWidth = metrics.width;
              if (testWidth > maxWidth && n > 0) {
                  ctx.fillText(line, x, cursorY);
                  line = words[n] + ' ';
                  cursorY += lineHeight;
              } else {
                  line = testLine;
              }
          }
          ctx.fillText(line, x, cursorY);
          cursorY += lineHeight;
      }
  };

  // Calculate rotated point for hit detection
  const rotatePoint = (x: number, y: number, cx: number, cy: number, angleDeg: number) => {
      const rad = (angleDeg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const nx = (cos * (x - cx)) + (sin * (y - cy)) + cx;
      const ny = (cos * (y - cy)) - (sin * (x - cx)) + cy;
      return { x: nx, y: ny };
  };

  // Improved bounds calculation for text wrapping
  const getElementBounds = (el: WhiteboardElement) => {
      if (el.type === 'pen' || el.type === 'eraser' || el.type === 'curve') {
          if (!el.points || el.points.length === 0) return { x: el.x, y: el.y, w: 0, h: 0 };
          const xs = el.points.map(p => p.x); const ys = el.points.map(p => p.y);
          const minX = Math.min(...xs); const maxX = Math.max(...xs);
          const minY = Math.min(...ys); const maxY = Math.max(...ys);
          return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
      } else if (el.type === 'line' || el.type === 'arrow') {
          const minX = Math.min(el.x, el.endX || el.x);
          const maxX = Math.max(el.x, el.endX || el.x);
          const minY = Math.min(el.y, el.endY || el.y);
          const maxY = Math.max(el.y, el.endY || el.y);
          return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
      } else if (el.type === 'text') {
          const fs = el.fontSize || 24; 
          
          // Estimate dimensions
          let w = el.width || 0;
          let h = el.height || 0;

          if (!w) {
              // Estimate width if not fixed
              const lines = (el.text || '').split('\n');
              const maxLineLen = Math.max(...lines.map(l => l.length));
              w = maxLineLen * fs * 0.6; // Approximation
          }
          
          if (!h) {
              const lines = (el.text || '').split('\n');
              if (el.width) {
                  // If fixed width, estimate wrapped lines
                  // Simplified: char width approx fs * 0.6
                  const charPerLine = Math.floor(el.width / (fs * 0.6));
                  let totalLines = 0;
                  lines.forEach(line => {
                      totalLines += Math.ceil(line.length / charPerLine) || 1;
                  });
                  h = totalLines * fs * 1.2;
              } else {
                  h = lines.length * fs * 1.2;
              }
          }
          
          return { x: el.x, y: el.y, w, h };
      }
      return { x: el.x, y: el.y, w: el.width || 0, h: el.height || 0 };
  };

  const isPointInElement = (x: number, y: number, el: WhiteboardElement): boolean => {
      const tolerance = 10 / scale;
      
      let testX = x;
      let testY = y;

      // Handle Rotation for Point Check (except lines/pens/curves which are harder to reverse-map easily without bounds)
      if (el.rotation && el.rotation !== 0 && ['rect', 'text', 'circle', 'triangle', 'star'].includes(el.type)) {
          const bounds = getElementBounds(el); // Get unrotated bounds center
          const cx = bounds.x + bounds.w / 2;
          const cy = bounds.y + bounds.h / 2;
          const rotated = rotatePoint(x, y, cx, cy, el.rotation); // Inverse rotate point
          testX = rotated.x;
          testY = rotated.y;
      }

      switch (el.type) {
          case 'rect': return testX >= el.x && testX <= el.x + (el.width || 0) && testY >= el.y && testY <= el.y + (el.height || 0);
          case 'circle': {
              const rx = Math.abs(el.width || 0) / 2;
              const ry = Math.abs(el.height || 0) / 2;
              const cx = el.x + (el.width || 0) / 2;
              const cy = el.y + (el.height || 0) / 2;
              const normX = (testX - cx) / rx;
              const normY = (testY - cy) / ry;
              return (normX * normX + normY * normY) <= 1;
          }
          case 'triangle': {
              // Bounding box approximation for click (Simpler) or point-in-polygon
              // Using bounding box for now for simplicity/performance
              return testX >= el.x && testX <= el.x + (el.width || 0) && testY >= el.y && testY <= el.y + (el.height || 0);
          }
          case 'star': {
              return testX >= el.x && testX <= el.x + (el.width || 0) && testY >= el.y && testY <= el.y + (el.height || 0);
          }
          case 'text': {
              const bounds = getElementBounds(el);
              return testX >= bounds.x && testX <= bounds.x + bounds.w && testY >= bounds.y && testY <= bounds.y + bounds.h;
          }
          case 'line':
          case 'arrow': {
              const x1 = el.x, y1 = el.y;
              const x2 = el.endX || x1, y2 = el.endY || y1;
              const A = x - x1; const B = y - y1; const C = x2 - x1; const D = y2 - y1;
              const dot = A * C + B * D; const len_sq = C * C + D * D;
              let param = -1; if (len_sq !== 0) param = dot / len_sq;
              let xx, yy;
              if (param < 0) { xx = x1; yy = y1; } else if (param > 1) { xx = x2; yy = y2; } else { xx = x1 + param * C; yy = y1 + param * D; }
              const dx = x - xx; const dy = y - yy;
              return (dx * dx + dy * dy) < tolerance * tolerance;
          }
          case 'pen':
          case 'eraser': 
          case 'curve': {
              if (!el.points) return false;
              const bounds = getElementBounds(el);
              if (x < bounds.x - tolerance || x > bounds.x + bounds.w + tolerance || y < bounds.y - tolerance || y > bounds.y + bounds.h + tolerance) return false;
              // Simple dist check to any point
              return el.points.some(p => { const dist = Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2); return dist < tolerance; });
          }
          default: return false;
      }
  };

  const isElementIntersectingBox = (el: WhiteboardElement, box: {x: number, y: number, w: number, h: number}): boolean => {
      // Rotation ignores box select for simplicity, checks center approx or AABB
      const bx = Math.min(box.x, box.x + box.w);
      const by = Math.min(box.y, box.y + box.h);
      const bw = Math.abs(box.w);
      const bh = Math.abs(box.h);
      const eb = getElementBounds(el);
      // Normalize eb
      const ebx = Math.min(eb.x, eb.x + eb.w);
      const eby = Math.min(eb.y, eb.y + eb.h);
      const ebw = Math.abs(eb.w);
      const ebh = Math.abs(eb.h);
      
      return (bx < ebx + ebw && bx + bw > ebx && by < eby + ebh && by + bh > eby);
  };

  const getWorldCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
      if (!canvasRef.current) return { x: 0, y: 0 };
      const rect = canvasRef.current.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      return { x: (clientX - rect.left - offset.x) / scale, y: (clientY - rect.top - offset.y) / scale };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
      if (textInput) { handleTextComplete(); return; }
      if (tool === 'pan') {
          setIsPanning(true);
          const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
          const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
          lastPanPoint.current = { x: clientX, y: clientY };
          return;
      }
      if (isReadOnly) return;
      const { x, y } = getWorldCoordinates(e);

      // --- Curve Tool Interaction (Click-to-Plot) ---
      if (tool === 'curve') {
          // If this is the start or continuation of a curve
          const newPoints = [...activeCurvePoints, { x, y }];
          setActiveCurvePoints(newPoints);
          setCurveMousePos({ x, y }); // Update cursor hint
          
          // DO NOT set isDrawing=true for standard drag behavior
          return;
      }

      // Check for Handles on Selected Element (Resize or Rotate)
      if (selectedIds.length === 1) {
          const el = elements.find(e => e.id === selectedIds[0]);
          if (el) {
              const bounds = getElementBounds(el);
              const padding = 8 / scale;
              const handleSize = 10 / scale;
              
              // Helper to transform handle check if rotated
              const checkPoint = (targetX: number, targetY: number) => {
                  if (el.rotation) {
                      const cx = bounds.x + bounds.w/2;
                      const cy = bounds.y + bounds.h/2;
                      const p = rotatePoint(x, y, cx, cy, el.rotation);
                      return Math.abs(p.x - targetX) < handleSize && Math.abs(p.y - targetY) < handleSize;
                  }
                  return Math.abs(x - targetX) < handleSize && Math.abs(y - targetY) < handleSize;
              };

              // Rotation Handle Check (Top Center + offset)
              const rotX = bounds.x + bounds.w / 2;
              const rotY = bounds.y - 30 / scale; // 30px above
              if (checkPoint(rotX, rotY)) {
                  setIsRotating(true);
                  setIsDrawing(true); // Hijack drawing state for drag loop
                  dragStartPos.current = { x, y };
                  initialSelectionStates.current.clear();
                  initialSelectionStates.current.set(el.id, JSON.parse(JSON.stringify(el)));
                  return;
              }

              // Resize Handle Check (BR only for simplicity for now, or Width for text)
              const brX = bounds.x + bounds.w;
              const brY = bounds.y + bounds.h;
              if (checkPoint(brX, brY)) {
                  setIsResizing(true);
                  setIsDrawing(true);
                  setResizeHandle('br');
                  dragStartPos.current = { x, y };
                  initialSelectionStates.current.clear();
                  initialSelectionStates.current.set(el.id, JSON.parse(JSON.stringify(el)));
                  return;
              }
          }
      }

      if (tool === 'text') { setIsDrawing(true); setTextDragStart({ x, y }); setTextDragCurrent({ x, y }); return; }
      if (tool === 'select') {
          let hitId = null;
          // Reverse iteration to select top-most element first
          for (let i = elements.length - 1; i >= 0; i--) { if (isPointInElement(x, y, elements[i])) { hitId = elements[i].id; break; } }
          const isCtrl = (e as React.MouseEvent).ctrlKey || (e as React.MouseEvent).metaKey;
          if (hitId) {
              if (isCtrl) { if (selectedIds.includes(hitId)) setSelectedIds(prev => prev.filter(id => id !== hitId)); else setSelectedIds(prev => [...prev, hitId]); } 
              else { if (!selectedIds.includes(hitId)) setSelectedIds([hitId]); }
              setIsDraggingSelection(true); dragStartPos.current = { x, y }; initialSelectionStates.current.clear();
              const idsToDrag = (!isCtrl && !selectedIds.includes(hitId)) ? [hitId] : (isCtrl && selectedIds.includes(hitId)) ? selectedIds.filter(id => id !== hitId) : (isCtrl && !selectedIds.includes(hitId)) ? [...selectedIds, hitId] : selectedIds;
              elements.forEach(el => { if (idsToDrag.includes(el.id)) initialSelectionStates.current.set(el.id, JSON.parse(JSON.stringify(el))); });
          } else {
              if (!isCtrl) setSelectedIds([]);
              setSelectionBox({ startX: x, startY: y, currX: x, currY: y });
          }
          return;
      }
      setIsDrawing(true); setSelectedIds([]); 
      const id = crypto.randomUUID();
      const newEl: WhiteboardElement = {
          id, type: tool, x, y, color: tool === 'eraser' ? '#0f172a' : color, strokeWidth: tool === 'eraser' ? 20 : lineWidth, lineStyle: tool === 'eraser' ? 'solid' : lineStyle, brushType: brushType, points: tool === 'pen' || tool === 'eraser' ? [{ x, y }] : undefined, width: 0, height: 0, endX: x, endY: y,
          borderRadius: tool === 'rect' ? borderRadius : undefined,
          rotation: 0
      };
      setCurrentElement(newEl);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
      if (isPanning) {
          const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
          const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
          const dx = clientX - lastPanPoint.current.x; const dy = clientY - lastPanPoint.current.y;
          setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy })); lastPanPoint.current = { x: clientX, y: clientY }; return;
      }
      if (isReadOnly) return;
      const { x, y } = getWorldCoordinates(e);
      
      // Curve Tool Ghost Line
      if (tool === 'curve') {
          setCurveMousePos({ x, y });
          return;
      }

      if (tool === 'text' && isDrawing && textDragStart) { setTextDragCurrent({ x, y }); return; }
      if (selectionBox) { setSelectionBox(prev => prev ? ({ ...prev, currX: x, currY: y }) : null); return; }
      
      // ROTATION LOGIC
      if (isRotating && selectedIds.length === 1) {
          const elId = selectedIds[0];
          const initEl = initialSelectionStates.current.get(elId);
          if (initEl) {
              const bounds = getElementBounds(initEl);
              const cx = bounds.x + bounds.w / 2;
              const cy = bounds.y + bounds.h / 2;
              const angleRad = Math.atan2(y - cy, x - cx);
              let angleDeg = angleRad * (180 / Math.PI) + 90; // Adjust so top is 0
              
              setElements(prev => prev.map(el => {
                  if (el.id === elId) {
                      return { ...el, rotation: angleDeg };
                  }
                  return el;
              }));
          }
          return;
      }

      // RESIZE LOGIC
      if (isResizing && selectedIds.length === 1) {
          const elId = selectedIds[0];
          const initEl = initialSelectionStates.current.get(elId);
          if (initEl && resizeHandle === 'br') {
              // Rotate mouse point back to local space to calc width/height change
              let lx = x;
              let ly = y;
              if (initEl.rotation) {
                  const bounds = getElementBounds(initEl);
                  const cx = bounds.x + bounds.w / 2;
                  const cy = bounds.y + bounds.h / 2;
                  const p = rotatePoint(x, y, cx, cy, initEl.rotation);
                  lx = p.x;
                  ly = p.y;
              }

              const newW = lx - initEl.x;
              const newH = ly - initEl.y;
              
              setElements(prev => prev.map(el => {
                  if (el.id === elId) {
                      if (el.type === 'text') {
                          // For text, resizing width is primary, height auto-adjusts or is irrelevant for wrapped
                          return { ...el, width: Math.max(20, newW) }; 
                      }
                      return { ...el, width: newW, height: newH };
                  }
                  return el;
              }));
          }
          return;
      }

      if (isDraggingSelection && dragStartPos.current) {
          const dx = x - dragStartPos.current.x; const dy = y - dragStartPos.current.y;
          setElements(prev => prev.map(el => {
              if (initialSelectionStates.current.has(el.id)) {
                  const init = initialSelectionStates.current.get(el.id)!; const newEl = { ...el }; newEl.x = init.x + dx; newEl.y = init.y + dy;
                  if (init.type === 'line' || init.type === 'arrow') { newEl.endX = (init.endX || 0) + dx; newEl.endY = (init.endY || 0) + dy; } else if (init.type === 'pen' || init.type === 'eraser') { newEl.points = init.points?.map(p => ({ x: p.x + dx, y: p.y + dy })); }
                  return newEl;
              }
              return el;
          }));
          return;
      }
      if (!isDrawing || !currentElement) return;
      if (tool === 'pen' || tool === 'eraser') { setCurrentElement(prev => prev ? ({ ...prev, points: [...(prev.points || []), { x, y }] }) : null); }
      else if (tool === 'rect' || tool === 'circle' || tool === 'triangle' || tool === 'star') { setCurrentElement(prev => prev ? ({ ...prev, width: x - prev.x, height: y - prev.y }) : null); }
      else if (tool === 'line' || tool === 'arrow') { setCurrentElement(prev => prev ? ({ ...prev, endX: x, endY: y }) : null); }
  };

  const stopDrawing = () => {
      if (isPanning) { setIsPanning(false); return; }
      if (isReadOnly) return;
      
      // Special: Curve uses click-click interaction, so mouseUp doesn't stop it unless we force it (we don't here)
      if (tool === 'curve') return;

      if (isRotating || isResizing) {
          setIsRotating(false);
          setIsResizing(false);
          setResizeHandle(null);
          setIsDrawing(false);
          if (onDataChange) emitChange(elements);
          if (isSharedSession && selectedIds.length === 1) {
              const el = elements.find(e => e.id === selectedIds[0]);
              if (el) syncUpdate(el);
          }
          return;
      }

      if (tool === 'text' && isDrawing && textDragStart && textDragCurrent) {
          setIsDrawing(false);
          const rawW = textDragCurrent.x - textDragStart.x; const rawH = textDragCurrent.y - textDragStart.y;
          const width = Math.abs(rawW); const height = Math.abs(rawH);
          const x = Math.min(textDragStart.x, textDragCurrent.x); const y = Math.min(textDragStart.y, textDragCurrent.y);
          const isBox = width > 20 && height > 20;
          const id = crypto.randomUUID();
          setTextInput({ id, x: isBox ? x : textDragStart.x, y: isBox ? y : textDragStart.y, text: '', width: isBox ? width : undefined, height: isBox ? height : undefined });
          setTextDragStart(null); setTextDragCurrent(null); return;
      }
      if (selectionBox) {
          const box = { x: selectionBox.startX, y: selectionBox.startY, w: selectionBox.currX - selectionBox.startX, h: selectionBox.currY - selectionBox.startY };
          const hitIds = elements.filter(el => isElementIntersectingBox(el, box)).map(el => el.id);
          setSelectedIds(hitIds); setSelectionBox(null); return;
      }
      if (isDraggingSelection) {
          // Emit Change
          if (onDataChange) emitChange(elements);
          
          if (isSharedSession) { const movedElements = elements.filter(el => initialSelectionStates.current.has(el.id)); movedElements.forEach(el => syncUpdate(el)); }
          setIsDraggingSelection(false); dragStartPos.current = null; initialSelectionStates.current.clear(); return;
      }
      if (isDrawing && currentElement) {
          const next = [...elements, currentElement];
          setElements(next);
          if (onDataChange) emitChange(next);
          
          syncUpdate(currentElement);
          setCurrentElement(null); setIsDrawing(false);
      }
  };

  // Robust Rounded Rectangle Drawer
  const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
      ctx.beginPath();
      // Ensure radius is positive and doesn't exceed dimensions
      const r = Math.min(radius, Math.min(Math.abs(width), Math.abs(height)) / 2);
      
      // Standardize coordinates to top-left
      let tlX = x;
      let tlY = y;
      let w = width;
      let h = height;
      
      if (w < 0) { tlX += w; w = Math.abs(w); }
      if (h < 0) { tlY += h; h = Math.abs(h); }

      ctx.moveTo(tlX + r, tlY);
      ctx.lineTo(tlX + w - r, tlY);
      ctx.arcTo(tlX + w, tlY, tlX + w, tlY + r, r);
      ctx.lineTo(tlX + w, tlY + h - r);
      ctx.arcTo(tlX + w, tlY + h, tlX + w - r, tlY + h, r);
      ctx.lineTo(tlX + r, tlY + h);
      ctx.arcTo(tlX, tlY, tlX, tlY + h - r, r);
      ctx.lineTo(tlX, tlY + r);
      ctx.arcTo(tlX, tlY, tlX + r, tlY, r);
      ctx.closePath();
      ctx.stroke();
  };

  useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = canvas.parentElement?.clientWidth || 800;
      canvas.height = canvas.parentElement?.clientHeight || 600;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.save(); ctx.translate(offset.x, offset.y); ctx.scale(scale, scale);

      const renderElement = (el: WhiteboardElement) => {
          if (textInput && el.id === textInput.id) return;
          ctx.save();
          
          // Rotation Support
          if (el.rotation) {
              const bounds = getElementBounds(el);
              const cx = bounds.x + bounds.w / 2;
              const cy = bounds.y + bounds.h / 2;
              ctx.translate(cx, cy);
              ctx.rotate(el.rotation * Math.PI / 180);
              ctx.translate(-cx, -cy);
          }

          ctx.beginPath(); ctx.strokeStyle = el.color; ctx.lineWidth = el.strokeWidth / scale;
          ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = 1.0; ctx.shadowBlur = 0;
          ctx.globalCompositeOperation = 'source-over'; // Default

          // Enhanced Brush Styles
          if (el.brushType === 'pencil') { 
              ctx.lineWidth = 1 / scale; 
              ctx.globalAlpha = 0.7; 
              ctx.shadowBlur = 0;
          }
          else if (el.brushType === 'marker') { 
              ctx.globalAlpha = 0.5; 
              ctx.lineCap = 'square'; 
              ctx.lineJoin = 'bevel'; 
              ctx.lineWidth = Math.max(el.strokeWidth, 8) / scale; 
              ctx.globalCompositeOperation = 'source-over'; 
          }
          else if (el.brushType === 'calligraphy-pen') { 
              ctx.lineCap = 'square'; 
              ctx.lineJoin = 'bevel'; 
              // Simulate flat nib by drawing wide
              ctx.lineWidth = Math.max(el.strokeWidth, 4) / scale;
          }
          else if (el.brushType === 'writing-brush') { 
              // Chinese Brush style: soft edges, NO SHADOW (User Request)
              ctx.lineCap = 'round'; 
              ctx.shadowBlur = 0; // Removed shadow
              ctx.lineWidth = Math.max(el.strokeWidth, 5) / scale;
          }
          else if (el.brushType === 'airbrush') { 
              ctx.lineCap = 'round'; 
              ctx.shadowBlur = 20; 
              ctx.shadowColor = el.color; 
              ctx.globalAlpha = 0.5; 
              ctx.lineWidth = Math.max(el.strokeWidth, 10) / scale;
          }
          else if (el.brushType === 'oil') {
              ctx.globalAlpha = 1.0;
              ctx.shadowBlur = 0;
              ctx.lineWidth = Math.max(el.strokeWidth, 6) / scale;
              ctx.lineCap = 'round';
          }
          else if (el.brushType === 'watercolor') {
              ctx.globalAlpha = 0.3;
              ctx.shadowBlur = 5;
              ctx.shadowColor = el.color;
              ctx.lineWidth = Math.max(el.strokeWidth, 8) / scale;
          }
          else if (el.brushType === 'crayon') {
              ctx.setLineDash([2, 4]); // Stippled look
              ctx.lineCap = 'round';
              ctx.lineWidth = Math.max(el.strokeWidth, 4) / scale;
              ctx.globalAlpha = 0.8;
          }
          
          // Line Styles (Override dash if not crayon)
          if (el.brushType !== 'crayon') {
              if (el.lineStyle === 'dashed') ctx.setLineDash([15, 10]); 
              else if (el.lineStyle === 'dotted') ctx.setLineDash([3, 8]); 
              else if (el.lineStyle === 'dash-dot') ctx.setLineDash([15, 5, 3, 5]); 
              else if (el.lineStyle === 'long-dash') ctx.setLineDash([30, 10]); 
              else ctx.setLineDash([]);
          }

          if (el.type === 'pen' || el.type === 'eraser') {
              if (el.points && el.points.length > 0) {
                  ctx.beginPath(); ctx.moveTo(el.points[0].x, el.points[0].y);
                  for (let i = 1; i < el.points.length; i++) ctx.lineTo(el.points[i].x, el.points[i].y);
                  ctx.stroke();
              }
          } else if (el.type === 'curve') {
              if (el.points && el.points.length > 1) {
                  ctx.beginPath();
                  ctx.moveTo(el.points[0].x, el.points[0].y);
                  // Catmull-Rom like smoothing
                  for (let i = 1; i < el.points.length - 1; i++) {
                      const xc = (el.points[i].x + el.points[i+1].x) / 2;
                      const yc = (el.points[i].y + el.points[i+1].y) / 2;
                      ctx.quadraticCurveTo(el.points[i].x, el.points[i].y, xc, yc);
                  }
                  ctx.lineTo(el.points[el.points.length-1].x, el.points[el.points.length-1].y);
                  ctx.stroke();
                  
                  // Draw Arrows if enabled
                  ctx.setLineDash([]); // Ensure arrows are solid
                  if (el.startArrow) {
                      const p0 = el.points[0];
                      const p1 = el.points[1];
                      // Arrow at p0, pointing backwards from p1 direction
                      if (p0 && p1) drawArrowHead(ctx, p1.x, p1.y, p0.x, p0.y, el.color);
                  }
                  if (el.endArrow) {
                      const pn = el.points[el.points.length - 1];
                      const pn_1 = el.points[el.points.length - 2];
                      // Arrow at pn, pointing forwards from pn_1 direction
                      if (pn && pn_1) drawArrowHead(ctx, pn_1.x, pn_1.y, pn.x, pn.y, el.color);
                  }
              }
          } else if (el.type === 'rect') {
              const w = el.width || 0;
              const h = el.height || 0;
              if (el.borderRadius && el.borderRadius > 0) {
                  drawRoundedRect(ctx, el.x, el.y, w, h, el.borderRadius);
              } else {
                  ctx.strokeRect(el.x, el.y, w, h);
              }
          }
          else if (el.type === 'circle') {
              const w = el.width || 0; const h = el.height || 0; const centerX = el.x + w / 2; const centerY = el.y + h / 2;
              ctx.ellipse(centerX, centerY, Math.abs(w / 2), Math.abs(h / 2), 0, 0, 2 * Math.PI); ctx.stroke();
          }
          else if (el.type === 'triangle') {
              const w = el.width || 0; const h = el.height || 0;
              ctx.beginPath();
              ctx.moveTo(el.x + w/2, el.y); // Top Center
              ctx.lineTo(el.x + w, el.y + h); // Bottom Right
              ctx.lineTo(el.x, el.y + h); // Bottom Left
              ctx.closePath();
              ctx.stroke();
          }
          else if (el.type === 'star') {
              const w = el.width || 0; const h = el.height || 0;
              drawStar(ctx, el.x + w/2, el.y + h/2, w, h);
          }
          else if (el.type === 'line') { ctx.moveTo(el.x, el.y); ctx.lineTo(el.endX || el.x, el.endY || el.y); ctx.stroke(); }
          else if (el.type === 'arrow') { const ex = el.endX || el.x; const ey = el.endY || el.y; ctx.moveTo(el.x, el.y); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]); drawArrowHead(ctx, el.x, el.y, ex, ey, el.color); }
          else if (el.type === 'text' && el.text) {
              ctx.font = `${el.fontSize || 24}px ${el.fontFamily || 'sans-serif'}`; ctx.textBaseline = 'top'; ctx.fillStyle = el.color;
              if (el.width) drawWrappedText(ctx, el.text, el.x, el.y, el.width, (el.fontSize || 24) * 1.2);
              else { const lines = el.text.split('\n'); lines.forEach((line, i) => ctx.fillText(line, el.x, el.y + i * (el.fontSize || 24) * 1.2)); }
          }
          ctx.restore();
      };

      // 1. Render all elements
      elements.forEach(renderElement);
      if (currentElement) renderElement(currentElement);

      // 2. Render Active Curve (Being Drawn)
      if (tool === 'curve' && activeCurvePoints.length > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.strokeStyle = color;
          ctx.lineWidth = lineWidth / scale;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          
          if (lineStyle === 'dashed') ctx.setLineDash([15, 10]);
          else if (lineStyle === 'dotted') ctx.setLineDash([3, 8]);
          
          ctx.moveTo(activeCurvePoints[0].x, activeCurvePoints[0].y);
          
          // Draw existing points
          for (let i = 1; i < activeCurvePoints.length; i++) {
              ctx.lineTo(activeCurvePoints[i].x, activeCurvePoints[i].y);
          }
          
          // Draw ghost line to cursor
          if (curveMousePos) {
              ctx.lineTo(curveMousePos.x, curveMousePos.y);
          }
          
          ctx.stroke();
          
          // Draw dots at points
          ctx.fillStyle = '#3b82f6';
          activeCurvePoints.forEach(p => {
              ctx.beginPath();
              ctx.arc(p.x, p.y, 4/scale, 0, 2 * Math.PI);
              ctx.fill();
          });
          
          if (curveMousePos) {
              ctx.beginPath();
              ctx.arc(curveMousePos.x, curveMousePos.y, 4/scale, 0, 2*Math.PI);
              ctx.fillStyle = color;
              ctx.fill();
          }
          ctx.restore();
      }

      // 3. Render Selection Overlay on TOP
      if (selectedIds.length > 0) {
          ctx.save();
          selectedIds.forEach(id => {
              const el = elements.find(e => e.id === id);
              if (el) {
                  const bounds = getElementBounds(el);
                  
                  // Apply rotation to selection context if needed
                  if (el.rotation) {
                      const cx = bounds.x + bounds.w / 2;
                      const cy = bounds.y + bounds.h / 2;
                      ctx.translate(cx, cy);
                      ctx.rotate(el.rotation * Math.PI / 180);
                      ctx.translate(-cx, -cy);
                  }

                  const padding = 8 / scale;
                  
                  // Handle negative width/height normalization for drawing selection
                  const bx = Math.min(bounds.x, bounds.x + bounds.w) - padding;
                  const by = Math.min(bounds.y, bounds.y + bounds.h) - padding;
                  const bw = Math.abs(bounds.w) + padding * 2;
                  const bh = Math.abs(bounds.h) + padding * 2;

                  // Draw Selection Box
                  ctx.strokeStyle = '#3b82f6'; // Blue-500
                  ctx.lineWidth = 1 / scale;
                  ctx.setLineDash([]); // Solid line
                  ctx.strokeRect(bx, by, bw, bh);

                  // Draw Resize Handle (Bottom Right)
                  const handleSize = 8 / scale;
                  const halfHandle = handleSize / 2;
                  ctx.fillStyle = '#ffffff';
                  ctx.strokeStyle = '#3b82f6';
                  ctx.lineWidth = 1 / scale;

                  // Only show resize for rect/text/circle for now
                  if (['rect', 'text', 'circle', 'triangle', 'star'].includes(el.type)) {
                      ctx.fillRect(bx + bw - halfHandle, by + bh - halfHandle, handleSize, handleSize);
                      ctx.strokeRect(bx + bw - halfHandle, by + bh - halfHandle, handleSize, handleSize);
                  }

                  // Draw Rotation Handle (Top Center)
                  if (['rect', 'text', 'circle', 'triangle', 'star'].includes(el.type)) {
                      const rotY = by - 30 / scale;
                      const rotX = bx + bw / 2;
                      ctx.beginPath();
                      ctx.moveTo(rotX, by);
                      ctx.lineTo(rotX, rotY);
                      ctx.strokeStyle = '#3b82f6';
                      ctx.stroke();
                      
                      ctx.beginPath();
                      ctx.arc(rotX, rotY, handleSize/1.5, 0, 2 * Math.PI);
                      ctx.fillStyle = '#ffffff';
                      ctx.fill();
                      ctx.stroke();
                  }
              }
          });
          ctx.restore();
      }

      if (selectionBox) { ctx.save(); ctx.setLineDash([5, 5]); ctx.fillStyle = 'rgba(59, 130, 246, 0.1)'; ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1 / scale; const w = selectionBox.currX - selectionBox.startX; const h = selectionBox.currY - selectionBox.startY; ctx.fillRect(selectionBox.startX, selectionBox.startY, w, h); ctx.strokeRect(selectionBox.startX, selectionBox.startY, w, h); ctx.restore(); }
      if (tool === 'text' && isDrawing && textDragStart && textDragCurrent) { ctx.save(); ctx.setLineDash([5, 5]); ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 1 / scale; const w = textDragCurrent.x - textDragStart.x; const h = textDragCurrent.y - textDragStart.y; ctx.strokeRect(textDragStart.x, textDragStart.y, w, h); ctx.restore(); }
      ctx.restore();
  }, [elements, currentElement, scale, offset, selectedIds, selectionBox, tool, isDrawing, textDragStart, textDragCurrent, textInput, activeCurvePoints, curveMousePos]);

  const handleTextComplete = () => {
      if (isReadOnly) { setTextInput(null); return; }
      if (textInput) {
          if (textInput.text.trim()) {
              const fs = fontSize; const lineCount = textInput.text.split('\n').length;
              const newEl: WhiteboardElement = { 
                  id: textInput.id, 
                  type: 'text', 
                  x: textInput.x, 
                  y: textInput.y, 
                  text: textInput.text, 
                  color: color, 
                  strokeWidth: 1, 
                  fontSize: fontSize, 
                  fontFamily: fontFamily, 
                  width: textInput.width, 
                  height: textInput.height || (fs * lineCount * 1.2),
                  rotation: textInput.rotation || 0
              };
              const next = [...elements];
              const idx = next.findIndex(e => e.id === newEl.id);
              if (idx >= 0) next[idx] = newEl; else next.push(newEl);
              
              setElements(next);
              if (onDataChange) emitChange(next);
              syncUpdate(newEl);
          }
          setTextInput(null);
      }
  };

  const handleClear = () => { if(isReadOnly) return; if(confirm("Clear whiteboard?")) { setElements([]); if (onDataChange) emitChange([]); if (isSharedSession) saveWhiteboardSession(currentSessionIdRef.current, []); } };
  const handleDeleteSelected = () => { if(isReadOnly) return; if (selectedIds.length > 0) { const idsToDelete = [...selectedIds]; const next = elements.filter(el => !selectedIds.includes(el.id)); setElements(next); if (onDataChange) emitChange(next); setSelectedIds([]); if (isSharedSession) deleteWhiteboardElements(currentSessionIdRef.current, idsToDelete); } };
  const handleDownload = () => { const canvas = canvasRef.current; if(canvas) { const url = canvas.toDataURL('image/png'); const a = document.createElement('a'); a.href = url; a.download = 'whiteboard.png'; a.click(); } };
  
  const handleDoubleClick = (e: React.MouseEvent) => { 
      if (isReadOnly || tool === 'pan') return; 
      const { x, y } = getWorldCoordinates(e); 
      let hitElement: WhiteboardElement | null = null; 
      // Need to find text with rotation support
      for (let i = elements.length - 1; i >= 0; i--) { 
          if (elements[i].type === 'text' && isPointInElement(x, y, elements[i])) { 
              hitElement = elements[i]; 
              break; 
          } 
      } 
      if (hitElement) { 
          setTextInput({ 
              id: hitElement.id, 
              x: hitElement.x, 
              y: hitElement.y, 
              text: hitElement.text || '', 
              width: hitElement.width, 
              height: hitElement.height,
              rotation: hitElement.rotation || 0
          }); 
          setColor(hitElement.color); 
          if (hitElement.fontSize) setFontSize(hitElement.fontSize); 
          if (hitElement.fontFamily) setFontFamily(hitElement.fontFamily); 
      } else { 
          const id = crypto.randomUUID(); 
          setTool('text'); 
          setTextInput({ id, x, y, text: '' }); 
      } 
  };

  // Helper for brush selection buttons
  const BrushButton = ({ type, icon: Icon, label }: { type: BrushType, icon: any, label: string }) => (
      <button 
          onClick={() => { setBrushType(type); updateSelectedElements({ brushType: type }); }}
          className={`p-1.5 rounded-md transition-colors group relative ${brushType === type ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
          title={label}
      >
          <Icon size={14} />
      </button>
  );

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden relative">
        {/* Header - Show only if NOT embedded */}
        {!onDataChange && (
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900 shrink-0 z-10">
            <div className="flex items-center gap-4">
                {onBack && <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"><ArrowLeft size={20} /></button>}
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                    <PenTool className="text-pink-400" /> Whiteboard
                    {isSharedSession && <span className="text-xs bg-indigo-600 px-2 py-0.5 rounded text-white animate-pulse">LIVE</span>}
                    {isReadOnly && <span className="text-xs bg-amber-900/50 text-amber-400 px-2 py-0.5 rounded flex items-center gap-1 border border-amber-500/30"><Lock size={10}/> Read Only</span>}
                </h1>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={handleDownload} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300" title="Download Image"><Download size={18} /></button>
                <div className="relative">
                    <button onClick={() => setShowShareDropdown(!showShareDropdown)} className={`p-2 rounded-lg text-white font-bold flex items-center gap-2 ${isSharedSession ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-700 hover:bg-slate-600'}`}>
                        <Share2 size={18} />
                        <span className="hidden sm:inline">{isSharedSession ? 'Share' : 'Share'}</span>
                    </button>
                    {showShareDropdown && (
                        <>
                        <div className="fixed inset-0 z-30" onClick={() => setShowShareDropdown(false)}></div>
                        <div className="absolute top-full right-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-40 overflow-hidden py-1">
                            <button onClick={() => handleShare('read')} className="w-full text-left px-4 py-2 hover:bg-slate-800 text-xs text-slate-300 hover:text-white flex items-center gap-2"><Eye size={12} /> Copy Read-Only Link</button>
                            <button onClick={() => handleShare('edit')} className="w-full text-left px-4 py-2 hover:bg-slate-800 text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-2"><Edit3 size={12} /> Copy Edit Link</button>
                        </div>
                        </>
                    )}
                </div>
            </div>
        </div>
        )}

        {/* Toolbar - Slightly more compact if embedded */}
        <div className={`bg-slate-900 border-b border-slate-800 p-2 flex flex-wrap justify-center gap-2 shrink-0 z-10 items-center ${isReadOnly ? 'opacity-50 pointer-events-none' : ''}`}>
            {/* Zoom Controls */}
            <div className="flex bg-slate-800 rounded-lg p-1 mr-2">
                <button onClick={handleRecenter} className="p-1.5 hover:bg-slate-700 rounded text-slate-400" title="Zoom to Fit / Recenter"><Maximize size={16}/></button>
                <div className="w-px bg-slate-700 mx-1"></div>
                <button onClick={() => setScale(s => Math.min(s + 0.1, 3))} className="p-1.5 hover:bg-slate-700 rounded text-slate-400"><ZoomIn size={16}/></button>
                <span className="text-[10px] flex items-center px-1 text-slate-400 font-mono w-8 justify-center">{Math.round(scale * 100)}%</span>
                <button onClick={() => setScale(s => Math.max(s - 0.1, 0.5))} className="p-1.5 hover:bg-slate-700 rounded text-slate-400"><ZoomOut size={16}/></button>
            </div>

            <div className="flex bg-slate-800 rounded-lg p-1">
                <button onClick={() => { setTool('select'); setIsDrawing(false); }} className={`p-1.5 rounded ${tool === 'select' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`} title="Select"><MousePointer2 size={16}/></button>
                <button onClick={() => setTool('pan')} className={`p-1.5 rounded ${tool === 'pan' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'} ${isReadOnly ? 'pointer-events-auto opacity-100' : ''}`} title="Pan"><Move size={16}/></button>
                <div className="w-px bg-slate-700 mx-1"></div>
                <button onClick={() => setTool('pen')} className={`p-1.5 rounded ${tool === 'pen' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`} title="Pen"><PenTool size={16}/></button>
                <button onClick={() => setTool('eraser')} className={`p-1.5 rounded ${tool === 'eraser' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`} title="Eraser"><Eraser size={16}/></button>
                <button onClick={() => setTool('text')} className={`p-1.5 rounded ${tool === 'text' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`} title="Text"><Type size={16}/></button>
                <div className="w-px bg-slate-700 mx-1"></div>
                <button onClick={() => setTool('curve')} className={`p-1.5 rounded ${tool === 'curve' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`} title="Curve Line"><Spline size={16}/></button>
                <button onClick={() => setTool('line')} className={`p-1.5 rounded ${tool === 'line' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`} title="Line"><Minus size={16}/></button>
                <button onClick={() => setTool('arrow')} className={`p-1.5 rounded ${tool === 'arrow' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`} title="Arrow"><ArrowRight size={16}/></button>
                <button onClick={() => setTool('rect')} className={`p-1.5 rounded ${tool === 'rect' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`} title="Rectangle"><Square size={16}/></button>
                <button onClick={() => setTool('circle')} className={`p-1.5 rounded ${tool === 'circle' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`} title="Circle"><Circle size={16}/></button>
                <button onClick={() => setTool('triangle')} className={`p-1.5 rounded ${tool === 'triangle' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`} title="Triangle"><Triangle size={16}/></button>
                <button onClick={() => setTool('star')} className={`p-1.5 rounded ${tool === 'star' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`} title="Star"><Star size={16}/></button>
            </div>
            
            {/* AI Assistant Button - Only shown if not disabled by parent */}
            {!disableAI && (
                <div className="flex bg-gradient-to-r from-purple-900/50 to-pink-900/50 rounded-lg p-1 border border-purple-500/30">
                    <button 
                        onClick={() => setShowAIPrompt(!showAIPrompt)} 
                        className={`p-1.5 rounded transition-all ${showAIPrompt ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/50' : 'text-pink-300 hover:text-white hover:bg-white/10'}`} 
                        title="AI Assistant (Magic)"
                    >
                        <Sparkles size={16} />
                    </button>
                </div>
            )}

            <div className="flex items-center gap-1 px-2 bg-slate-800 rounded-lg">
                {['#ffffff', '#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6'].map(c => (
                    <button key={c} onClick={() => { setColor(c); if(tool==='eraser') setTool('pen'); updateSelectedElements({ color: c }); }} className={`w-4 h-4 rounded-full border ${color === c && tool !== 'eraser' ? 'border-white scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                ))}
            </div>

            <div className="w-px h-8 bg-slate-800 mx-2"></div>

            {/* Properties */}
            <div className="flex items-center gap-2">
                {/* Stroke Width */}
                <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-2 py-1" title="Stroke Width">
                   <div className="w-1 h-1 rounded-full bg-slate-400"></div>
                   <input 
                     type="range" min="1" max="20" step="1" 
                     value={lineWidth} 
                     onChange={(e) => { 
                         const val = parseInt(e.target.value); 
                         setLineWidth(val); 
                         updateSelectedElements({ strokeWidth: val }); 
                     }}
                     className="w-16 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                   />
                   <div className="w-2.5 h-2.5 rounded-full bg-slate-400"></div>
                </div>

                {/* Corner Radius (Only for Rect) */}
                {(tool === 'rect' || (selectedIds.length === 1 && elements.find(e => e.id === selectedIds[0])?.type === 'rect')) && (
                    <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-2 py-1" title="Corner Radius">
                        <div className="w-4 h-4 border-2 border-slate-400 rounded-md"></div>
                        <input
                            type="range" min="0" max="50" step="1"
                            value={borderRadius}
                            onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setBorderRadius(val);
                                updateSelectedElements({ borderRadius: val });
                            }}
                            className="w-16 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                    </div>
                )}

                {/* Line Style Icons */}
                <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1">
                    <button onClick={() => { setLineStyle('solid'); updateSelectedElements({ lineStyle: 'solid' }); }} className={`p-1.5 rounded-md transition-colors ${lineStyle === 'solid' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`} title="Solid">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="2" y1="12" x2="22" y2="12" /></svg>
                    </button>
                    <button onClick={() => { setLineStyle('dashed'); updateSelectedElements({ lineStyle: 'dashed' }); }} className={`p-1.5 rounded-md transition-colors ${lineStyle === 'dashed' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`} title="Dashed">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="2" y1="12" x2="22" y2="12" strokeDasharray="6 4" /></svg>
                    </button>
                    <button onClick={() => { setLineStyle('dotted'); updateSelectedElements({ lineStyle: 'dotted' }); }} className={`p-1.5 rounded-md transition-colors ${lineStyle === 'dotted' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`} title="Dotted">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="2" y1="12" x2="22" y2="12" strokeDasharray="1 5" /></svg>
                    </button>
                    <button onClick={() => { setLineStyle('dash-dot'); updateSelectedElements({ lineStyle: 'dash-dot' }); }} className={`p-1.5 rounded-md transition-colors ${lineStyle === 'dash-dot' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`} title="Dash-Dot">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="2" y1="12" x2="22" y2="12" strokeDasharray="8 4 2 4" /></svg>
                    </button>
                </div>
                
                {/* Curve Arrow Options */}
                {(tool === 'curve' || (selectedIds.length === 1 && elements.find(e => e.id === selectedIds[0])?.type === 'curve')) && (
                    <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1" title="Arrow Heads">
                        <button 
                            onClick={() => { setStartArrow(!startArrow); updateSelectedElements({ startArrow: !startArrow }); }}
                            className={`p-1.5 rounded-md transition-colors ${startArrow ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                            title="Start Arrow"
                        >
                            <ArrowLeft size={14} /> 
                        </button>
                        <button 
                            onClick={() => { setEndArrow(!endArrow); updateSelectedElements({ endArrow: !endArrow }); }}
                            className={`p-1.5 rounded-md transition-colors ${endArrow ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                            title="End Arrow"
                        >
                            <ArrowRight size={14} />
                        </button>
                    </div>
                )}
                
                {/* Brush Type Icons (Replacing Dropdown) */}
                {(tool === 'pen' || (selectedIds.length === 1 && elements.find(e => e.id === selectedIds[0])?.type === 'pen')) && (
                     <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1">
                        <BrushButton type="standard" icon={Pen} label="Standard Pen" />
                        <BrushButton type="pencil" icon={Edit2} label="Pencil" />
                        <BrushButton type="marker" icon={Highlighter} label="Marker" />
                        <BrushButton type="calligraphy-pen" icon={Feather} label="Calligraphy Pen" />
                        <BrushButton type="writing-brush" icon={Brush} label="Chinese Brush" />
                        <BrushButton type="airbrush" icon={Wind} label="Airbrush" />
                        <BrushButton type="oil" icon={Droplet} label="Oil Brush" />
                        <BrushButton type="watercolor" icon={Cloud} label="Watercolor" />
                        <BrushButton type="crayon" icon={Edit3} label="Crayon" />
                     </div>
                )}

                {/* Font Size (Only for Text) */}
                {(tool === 'text' || (selectedIds.length === 1 && elements.find(e => e.id === selectedIds[0])?.type === 'text')) && (
                     <select 
                        value={fontSize} 
                        onChange={(e) => { 
                            const val = parseInt(e.target.value); 
                            setFontSize(val); 
                            updateSelectedElements({ fontSize: val }); 
                        }}
                        className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1.5 outline-none focus:border-indigo-500"
                     >
                        <option value="16">16px</option>
                        <option value="24">24px</option>
                        <option value="32">32px</option>
                        <option value="48">48px</option>
                        <option value="64">64px</option>
                     </select>
                )}
            </div>

            {/* Layer Controls */}
            {selectedIds.length > 0 && (
                <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1 ml-2">
                    <button onClick={handleBringToFront} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white" title="Bring to Front">
                        <BringToFront size={16} />
                    </button>
                    <button onClick={handleSendToBack} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white" title="Send to Back">
                        <SendToBack size={16} />
                    </button>
                </div>
            )}

            <div className="flex gap-1 ml-auto">
                <button onClick={copySelection} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white" title="Copy (Ctrl+C)"><Copy size={16} /></button>
                <button onClick={pasteFromClipboard} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white" title="Paste (Ctrl+V)"><Clipboard size={16} /></button>
                <div className="w-px h-4 bg-slate-700 mx-1"></div>
                <button onClick={() => setElements(prev => prev.slice(0, -1))} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white"><Undo size={16} /></button>
                <button onClick={selectedIds.length > 0 ? handleDeleteSelected : handleClear} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-red-400"><Trash2 size={16} /></button>
            </div>
        </div>

        {/* Canvas Area */}
        <div className={`flex-1 relative overflow-hidden bg-slate-950 touch-none ${isReadOnly && tool !== 'pan' ? 'cursor-default' : 'cursor-crosshair'}`}>
            <canvas ref={canvasRef} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onDoubleClick={handleDoubleClick} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} className="block w-full h-full" style={{ cursor: tool === 'pan' ? (isPanning ? 'grabbing' : 'grab') : (isReadOnly ? 'default' : (tool === 'select' ? 'default' : 'crosshair')) }} />
            {textInput && !isReadOnly && (
                <textarea autoFocus value={textInput.text} onChange={(e) => setTextInput(prev => prev ? ({ ...prev, text: e.target.value }) : null)} onBlur={handleTextComplete} onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTextComplete(); } }}
                    style={{ position: 'absolute', left: textInput.x * scale + offset.x, top: textInput.y * scale + offset.y, fontSize: `${fontSize * scale}px`, fontFamily: fontFamily, color: color, background: 'transparent', border: '1px dashed #64748b', outline: 'none', width: textInput.width ? textInput.width * scale : 'auto', minWidth: '50px', height: textInput.height ? textInput.height * scale : 'auto', overflow: 'hidden', resize: 'both', whiteSpace: textInput.width ? 'pre-wrap' : 'pre', zIndex: 20, padding: 0, margin: 0, lineHeight: 1.2, transform: textInput.rotation ? `rotate(${textInput.rotation}deg)` : undefined }} placeholder="Type..." />
            )}
            
            {/* Helper Text for Curve Tool */}
            {tool === 'curve' && !isReadOnly && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-800/80 backdrop-blur px-4 py-2 rounded-full text-xs text-white shadow-lg border border-slate-700 pointer-events-none">
                    {activeCurvePoints.length === 0 ? "Click to start curve" : "Click to add points • Press Enter/Esc to finish"}
                </div>
            )}
            
            {/* AI Prompt Input Overlay (Only if not disabled) */}
            {showAIPrompt && !disableAI && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 flex items-center gap-2 animate-fade-in-up z-50">
                    <div className="p-2 bg-pink-900/30 rounded-lg text-pink-400">
                        <Sparkles size={20} />
                    </div>
                    <input 
                        type="text" 
                        autoFocus
                        value={aiPromptText} 
                        onChange={e => setAiPromptText(e.target.value)} 
                        onKeyDown={e => e.key === 'Enter' && handleAIGenerate()}
                        placeholder="Describe what to draw (e.g. 'Flowchart for login process')..." 
                        className="flex-1 bg-transparent text-white outline-none text-sm placeholder-slate-500"
                        disabled={isAIGenerating}
                    />
                    <button 
                        onClick={handleAIGenerate} 
                        disabled={!aiPromptText.trim() || isAIGenerating}
                        className="p-2 bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white rounded-lg transition-colors"
                    >
                        {isAIGenerating ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>}
                    </button>
                    <button onClick={() => setShowAIPrompt(false)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white">
                        <X size={16} />
                    </button>
                </div>
            )}
        </div>
    </div>
  );
};