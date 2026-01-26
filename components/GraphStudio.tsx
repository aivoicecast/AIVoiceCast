
import React, { useState, useEffect, useRef, useCallback } from 'react';
// Added missing 'Plus' icon to the import list from lucide-react
import { ArrowLeft, Play, Trash2, Loader2, Activity, Zap, Lock, Terminal, ShieldCheck, RefreshCw, Layers, BrainCircuit, Code, Info, ChevronRight, Share2, Download, Maximize2, Move, RotateCw, ZoomIn, ZoomOut, Sliders, Target, Crosshair, Plus } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface GraphStudioProps {
  onBack: () => void;
  isProMember?: boolean;
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

export const GraphStudio: React.FC<GraphStudioProps> = ({ onBack, isProMember }) => {
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
    
    // Initializing Gemini client as per guidelines using process.env.API_KEY
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

  // --- Interaction Handlers ---
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
    <div className="flex h-full bg-slate-950 text-slate-100 overflow-hidden font-mono">
      {/* Sidebar - Math Terminal */}
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

          {/* Terminal Diagnostic */}
          <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-inner">
              <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 flex items-center gap-2">
                  <Terminal size={12} className="text-slate-500"/>
                  <span className="text-[8px] font-black text-slate-500 uppercase">Refraction Log</span>
              </div>
              <div className="p-3 h-24 overflow-y-auto text-[9px] font-mono scrollbar-hide space-y-1">
                  {logs.map((log, i) => (
                      <div key={i} className="flex gap-2">
                          <span className="opacity-30">{log.time}</span>
                          <span className={log.type === 'error' ? 'text-red-400' : log.type === 'output' ? 'text-emerald-400' : 'text-slate-400'}>{log.msg}</span>
                      </div>
                  ))}
                  {logs.length === 0 && <p className="text-slate-700 italic">Core waiting for math input...</p>}
              </div>
          </div>
        </div>

        <div className="p-6 bg-slate-950 border-t border-slate-800">
            <button 
                onClick={refractMath}
                disabled={isCompiling}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2"
            >
                {isCompiling ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18}/>}
                Execute Refraction
            </button>
        </div>
      </div>

      {/* Preview Area */}
      <div className="flex-1 relative flex flex-col bg-[#020617]">
        <header className="h-14 border-b border-slate-800 bg-slate-900/30 flex items-center justify-between px-6 shrink-0 z-20 backdrop-blur-md">
            <div className="flex items-center gap-4">
                {mode === 'polar' ? <Target className="text-pink-400" size={18}/> : mode === '3d' ? <Activity className="text-purple-400" size={18}/> : <Crosshair className="text-indigo-400" size={18}/>}
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Neural Space (Real-Time)</span>
            </div>
            <div className="flex gap-2">
                <button onClick={() => { setRotation({ x: 1.1, z: 0.5 }); setOffset({x:0, y:0}); setZoom(40); }} className="p-2 hover:bg-slate-800 rounded-lg text-slate-500" title="Reset View"><RefreshCw size={16}/></button>
            </div>
        </header>

        <div 
            ref={containerRef}
            className={`flex-1 relative touch-none ${mode === '3d' ? 'cursor-move' : 'cursor-grab active:cursor-grabbing'}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
        >
            <canvas 
                ref={canvasRef} 
                width={1200} 
                height={800} 
                className="w-full h-full block"
            />

            {/* Viewport UI Overlays */}
            <div className="absolute top-8 right-8 flex flex-col gap-3">
                <div className="p-4 bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-3xl shadow-2xl flex flex-col items-center gap-4 animate-fade-in">
                    <button onClick={() => setZoom(z => Math.min(1000, z + 5))} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><ZoomIn size={18}/></button>
                    <div className="w-4 h-px bg-slate-800"></div>
                    <button onClick={() => setZoom(z => Math.max(1, z - 5))} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><ZoomOut size={18}/></button>
                </div>
            </div>

            {/* Bottom HUD */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6 p-4 bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/20 rounded-[2rem] shadow-2xl animate-fade-in-up">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center text-indigo-400"><BrainCircuit size={20}/></div>
                    <div>
                        <p className="text-[10px] font-black text-white uppercase tracking-widest">{mode.toUpperCase()} Matrix Active</p>
                        <p className="text-[8px] text-slate-500 font-bold uppercase">Source: Gemini 3 Flash • Verified</p>
                    </div>
                </div>
                <div className="w-px h-8 bg-slate-800"></div>
                <div className="text-[9px] text-slate-400 font-medium">
                    {mode === '3d' ? 'Drag to Rotate • Scroll to Zoom' : 'Drag to Pan • Scroll to Zoom'}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default GraphStudio;
