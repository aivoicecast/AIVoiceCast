
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Play, Trash2, Loader2, Activity, Zap, Lock, Terminal, ShieldCheck, RefreshCw, Layers, BrainCircuit, Code, Info, ChevronRight, Share2, Download, Maximize2, Move, RotateCw, ZoomIn, ZoomOut, Sliders, Target, Crosshair, Plus } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface GraphStudioProps {
  onBack: () => void;
  isProMember?: boolean;
  // Added onOpenManual prop to fix type error in App.tsx
  onOpenManual?: () => void;
}

interface CommandLog {
  time: string;
  msg: string;
  type: 'input' | 'output' | 'error' | 'info';
}

type GraphMode = '2d' | '3d' | 'polar';

interface Equation {
  id: string;
  expression: string;
  color: string;
  visible: boolean;
  fn: any | null; // Can be (x)=>y, (x,y)=>z, or (theta)=>r
}

export const GraphStudio: React.FC<GraphStudioProps> = ({ onBack, isProMember, onOpenManual }) => {
  if (isProMember === false) {
    return (
        <div className="h-full flex items-center justify-center p-6 bg-slate-950">
            <div className="max-w-md w-full bg-slate-900 border border-indigo-500/30 rounded-[3rem] p-12 text-center shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-32 bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none"></div>
                <Lock size={48} className="text-indigo-400 mx-auto mb-6 relative z-10" />
                <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-4 relative z-10">Pro Access Required</h2>
                <p className="text-slate-400 text-sm mb-10 font-medium relative z-10">Neural 3D Studio requires an active Pro Membership to handle high-performance mathematical refractions and multi-system coordinate simulation.</p>
                <button onClick={onBack} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest rounded-2xl transition-all relative z-10">Back to Hub</button>
            </div>
        </div>
    );
  }

  // --- State ---
  const [mode, setMode] = useState<GraphMode>('2d');
  const [equations, setEquations] = useState<Equation[]>([
    { id: '1', expression: 'sin(x)', color: '#00f2ff', visible: true, fn: null }
  ]);
  const [isCompiling, setIsCompiling] = useState(false);
  const [logs, setLogs] = useState<CommandLog[]>([]);
  
  // --- Viewport State ---
  const [rotation, setRotation] = useState({ x: 1.1, z: 0.5 });
  const [zoom, setZoom] = useState(40);
  const [range, setRange] = useState(10);
  const [resolution, setResolution] = useState(30); 
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const addLog = useCallback((msg: string, type: CommandLog['type'] = 'info') => {
    const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [{ time, msg, type }, ...prev].slice(0, 10));
  }, []);

  // Update default expression when mode changes
  useEffect(() => {
      if (mode === '3d') setEquations([{ id: '1', expression: 'sin(sqrt(x^2 + y^2))', color: '#a855f7', visible: true, fn: null }]);
      else if (mode === 'polar') setEquations([{ id: '1', expression: '4 * sin(4 * theta)', color: '#f472b6', visible: true, fn: null }]);
      else setEquations([{ id: '1', expression: 'sin(x)', color: '#00f2ff', visible: true, fn: null }]);
      setOffset({ x: 0, y: 0 });
  }, [mode]);

  // --- Neural Math Compiler ---
  const refractMath = async () => {
    setIsCompiling(true);
    addLog(`Initializing ${mode.toUpperCase()} Compiler...`, "info");
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const updated = [...equations];

    for (let i = 0; i < updated.length; i++) {
        const eq = updated[i];
        if (!eq.expression.trim()) continue;

        try {
            addLog(`Refracting: ${eq.expression}`, "input");
            
            let signature = " (x) => numeric value ";
            if (mode === '3d') signature = " (x, y) => numeric z value ";
            if (mode === 'polar') signature = " (theta) => numeric r value ";

            const prompt = `Convert this ${mode.toUpperCase()} math expression to a valid JavaScript arrow function using the 'Math' object. 
            The function signature MUST be: ${signature}
            Expression: "${eq.expression}"
            Return ONLY the code string. Example: " (x) => Math.sin(x) "`;

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: { thinkingConfig: { thinkingBudget: 0 } }
            });

            const code = response.text?.trim() || "() => 0";
            const fn = new Function('return ' + code)();
            updated[i] = { ...eq, fn };
            addLog(`${mode.toUpperCase()} Logic verified.`, "output");
        } catch (e: any) {
            addLog(`Refraction Error: ${e.message}`, "error");
        }
    }

    setEquations(updated);
    setIsCompiling(false);
  };

  // --- Multi-System Rendering Engine ---
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const cx = width / 2 + offset.x;
    const cy = height / 2 + offset.y;

    // Projection Logic
    const project = (x: number, y: number, z: number = 0) => {
        if (mode === '2d' || mode === 'polar') {
            return { px: cx + x * zoom, py: cy - y * zoom, depth: 0 };
        }
        // 3D Matrix
        let x1 = x * Math.cos(rotation.z) - y * Math.sin(rotation.z);
        let y1 = x * Math.sin(rotation.z) + y * Math.cos(rotation.z);
        let y2 = y1 * Math.cos(rotation.x) - z * Math.sin(rotation.x);
        let z2 = y1 * Math.sin(rotation.x) + z * Math.cos(rotation.x);
        return { px: cx + x1 * zoom, py: cy + y2 * zoom, depth: z2 };
    };

    // Draw Grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    if (mode === 'polar') {
        // Polar Grid
        for (let r = 2; r <= range; r += 2) {
            ctx.moveTo(cx + r * zoom, cy);
            ctx.arc(cx, cy, r * zoom, 0, Math.PI * 2);
        }
        for (let a = 0; a < 360; a += 30) {
            const rad = (a * Math.PI) / 180;
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(rad) * range * zoom, cy + Math.sin(rad) * range * zoom);
        }
    } else {
        // Cartesian Grid
        for (let i = -range; i <= range; i += 2) {
            const p1 = project(i, -range, 0); const p2 = project(i, range, 0);
            ctx.moveTo(p1.px, p1.py); ctx.lineTo(p2.px, p2.py);
            const p3 = project(-range, i, 0); const p4 = project(range, i, 0);
            ctx.moveTo(p3.px, p3.py); ctx.lineTo(p4.px, p4.py);
        }
    }
    ctx.stroke();

    // Draw Axis
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const origin = project(0, 0, 0);
    const xMax = project(range, 0, 0); const yMax = project(0, range, 0);
    ctx.moveTo(origin.px, origin.py); ctx.lineTo(xMax.px, xMax.py);
    ctx.moveTo(origin.px, origin.py); ctx.lineTo(yMax.px, yMax.py);
    if (mode === '3d') {
        const zMax = project(0, 0, range);
        ctx.moveTo(origin.px, origin.py); ctx.lineTo(zMax.px, zMax.py);
    }
    ctx.stroke();

    // Draw Equations
    equations.forEach(eq => {
        if (!eq.visible || !eq.fn) return;
        ctx.strokeStyle = eq.color;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 10;
        ctx.shadowColor = eq.color;
        ctx.beginPath();

        if (mode === '2d') {
            const points = 400;
            const step = (range * 2) / points;
            let first = true;
            for (let i = 0; i <= points; i++) {
                const x = -range + i * step;
                const y = eq.fn(x);
                if (!isFinite(y)) { first = true; continue; }
                const p = project(x, y);
                if (first) ctx.moveTo(p.px, p.py); else ctx.lineTo(p.px, p.py);
                first = false;
            }
        } else if (mode === 'polar') {
            const points = 600;
            const step = (Math.PI * 2) / points;
            let first = true;
            for (let i = 0; i <= points; i++) {
                const theta = i * step;
                const r = eq.fn(theta);
                if (!isFinite(r)) { first = true; continue; }
                const x = r * Math.cos(theta);
                const y = r * Math.sin(theta);
                const p = project(x, y);
                if (first) ctx.moveTo(p.px, p.py); else ctx.lineTo(p.px, p.py);
                first = false;
            }
        } else if (mode === '3d') {
            const step = (range * 2) / resolution;
            ctx.lineWidth = 0.5;
            for (let iy = 0; iy < resolution; iy++) {
                for (let ix = 0; ix < resolution; ix++) {
                    const x = -range + ix * step; const y = -range + iy * step;
                    const z1 = eq.fn(x, y); const z2 = eq.fn(x + step, y);
                    const z3 = eq.fn(x + step, y + step); const z4 = eq.fn(x, y + step);
                    if ([z1, z2, z3, z4].some(z => !isFinite(z))) continue;
                    const p1 = project(x, y, z1); const p2 = project(x + step, y, z2);
                    const p3 = project(x + step, y + step, z3); const p4 = project(x, y + step, z4);
                    const avgDepth = (p1.depth + p2.depth + p3.depth + p4.depth) / 4;
                    ctx.globalAlpha = Math.min(1, Math.max(0.2, (avgDepth + range) / (range * 2)));
                    ctx.moveTo(p1.px, p1.py); ctx.lineTo(p2.px, p2.py); ctx.lineTo(p3.px, p3.py); ctx.lineTo(p4.px, p4.py); ctx.closePath();
                }
            }
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
    });

  }, [equations, rotation, zoom, range, resolution, mode, offset]);

  useEffect(() => {
      const anim = requestAnimationFrame(render);
      return () => cancelAnimationFrame(anim);
  }, [render]);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    
    if (mode === '3d') {
        setRotation(prev => ({ x: prev.x + dy * 0.01, z: prev.z + dx * 0.01 }));
    } else {
        setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    }
    
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => { isDragging.current = false; };

  const handleWheel = (e: React.WheelEvent) => {
      setZoom(prev => Math.min(1000, Math.max(1, prev - e.deltaY * 0.05)));
  };

  return (
    <div className="flex h-full w-full bg-slate-950 text-slate-100 overflow-hidden font-mono">
      <div className="w-[350px] border-r border-slate-800 bg-slate-900/50 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-800 flex items-center gap-3 bg-slate-950/40">
            <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
                <ArrowLeft size={20} />
            </button>
            <div className="flex flex-col">
                <h2 className="font-black uppercase tracking-tighter italic text-indigo-400">Neural Graph</h2>
                <span className="text-[8px] font-bold text-slate-600 uppercase tracking-[0.2em]">Logic Spectrum Engine</span>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
          <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Dimension Mode</label>
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800">
                  {(['2d', '3d', 'polar'] as GraphMode[]).map(m => (
                      <button key={m} onClick={() => setMode(m)} className={`py-2 rounded-lg text-[10px] font-black uppercase transition-all ${mode === m ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>{m}</button>
                  ))}
              </div>
          </div>

          <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Equations</label>
                  <button onClick={() => setEquations([...equations, { id: Date.now().toString(), expression: '', color: '#f472b6', visible: true, fn: null }])} className="p-1 text-indigo-400 hover:text-white"><Plus size={16}/></button>
              </div>
              <div className="space-y-3">
                  {equations.map(eq => (
                      <div key={eq.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-3 shadow-inner group">
                          <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: eq.color }} />
                              <input 
                                value={eq.expression}
                                onChange={e => setEquations(equations.map(x => x.id === eq.id ? { ...x, expression: e.target.value } : x))}
                                onKeyDown={e => e.key === 'Enter' && refractMath()}
                                className="bg-transparent text-sm text-indigo-200 outline-none flex-1 font-mono"
                                placeholder={mode === '3d' ? "z=f(x,y)" : mode === 'polar' ? "r=f(theta)" : "y=f(x)"}
                              />
                              <button onClick={() => setEquations(equations.filter(x => x.id !== eq.id))} className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all"><Trash2 size={14}/></button>
                          </div>
                      </div>
                  ))}
              </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-800">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Parameters</label>
              <div className="space-y-4 px-1">
                  {mode === '3d' && (
                    <div className="animate-fade-in">
                        <div className="flex justify-between text-[10px] mb-2"><span>Mesh Density</span><span>{resolution}x{resolution}</span></div>
                        <input type="range" min="10" max="60" value={resolution} onChange={e => setResolution(parseInt(e.target.value))} className="w-full h-1 bg-slate-800 appearance-none rounded-full accent-indigo-500"/>
                    </div>
                  )}
                  <div>
                      <div className="flex justify-between text-[10px] mb-2"><span>Viewing Range</span><span>±{range}</span></div>
                      <input type="range" min="2" max="100" value={range} onChange={e => setRange(parseInt(e.target.value))} className="w-full h-1 bg-slate-800 appearance-none rounded-full accent-indigo-500"/>
                  </div>
              </div>
          </div>

          <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-inner">
              <div className="px-3 py-1.5 border-b border-slate-800 bg-slate-900 flex items-center gap-2"><Terminal size={12} className="text-red-400"/><span className="text-[9px] font-black uppercase text-slate-500">Trace Logs</span></div>
              <div className="p-4 h-48 overflow-y-auto space-y-1.5 scrollbar-hide text-left">
                  {logs.map((l, i) => (
                      <div key={i} className={`text-[10px] flex gap-2 ${l.type === 'error' ? 'text-red-400' : l.type === 'input' ? 'text-indigo-400' : l.type === 'output' ? 'text-emerald-400' : 'text-slate-500'}`}>
                          <span className="opacity-30">[{l.time}]</span>
                          <span className="flex-1 break-words">{l.msg}</span>
                      </div>
                  ))}
                  {logs.length === 0 && <p className="text-[10px] text-slate-800 italic">Awaiting neural input...</p>}
              </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-800 bg-slate-950/40">
            <button onClick={refractMath} disabled={isCompiling} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-900/40 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50">
                {isCompiling ? <Loader2 size={18} className="animate-spin"/> : <Zap size={18} fill="currentColor"/>}
                Refract All
            </button>
        </div>
      </div>

      <div className="flex-1 relative cursor-crosshair group" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onWheel={handleWheel}>
          <div className="absolute top-6 left-6 flex items-center gap-2 px-3 py-1.5 bg-slate-900/60 backdrop-blur-md rounded-full border border-white/5 z-20 text-[10px] font-bold text-slate-400 pointer-events-none uppercase tracking-widest">
              <Activity size={12} className="text-emerald-500 animate-pulse"/> 
              <span>Heuristic Frame Trace</span>
          </div>
          <canvas ref={canvasRef} width={window.innerWidth - 350} height={window.innerHeight} className="block w-full h-full" />
          <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => setZoom(prev => prev * 1.2)} className="p-3 bg-slate-900/80 backdrop-blur-md rounded-xl border border-white/5 hover:bg-indigo-600 text-white shadow-xl transition-all"><ZoomIn size={20}/></button>
              <button onClick={() => setZoom(prev => prev / 1.2)} className="p-3 bg-slate-900/80 backdrop-blur-md rounded-xl border border-white/5 hover:bg-indigo-600 text-white shadow-xl transition-all"><ZoomOut size={20}/></button>
              <div className="h-px bg-slate-800 my-1"></div>
              <button onClick={() => { if (onOpenManual) onOpenManual(); }} className="p-3 bg-slate-900/80 backdrop-blur-md rounded-xl border border-white/5 hover:bg-indigo-600 text-white shadow-xl transition-all" title="Graph Manual"><Info size={20}/></button>
              <button onClick={() => setRotation({ x: 1.1, z: 0.5 })} className="p-3 bg-slate-900/80 backdrop-blur-md rounded-xl border border-white/5 hover:bg-indigo-600 text-white shadow-xl transition-all"><RefreshCw size={20}/></button>
          </div>
      </div>
    </div>
  );
};

export default GraphStudio;
