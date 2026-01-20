
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Sparkles, Wand2, Plus, Trash2, Maximize2, Settings2, RefreshCw, Loader2, Info, ChevronRight, Share2, Grid3X3, Circle, Activity, Play, Check, AlertCircle, ShieldAlert, RefreshCcw, Terminal, Zap, CloudDownload, Globe, CheckCircle, Lock } from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";

interface GraphStudioProps {
  onBack: () => void;
  isProMember?: boolean;
}

interface Equation {
  id: string;
  expression: string;
  visible: boolean;
  color: string;
}

type GraphMode = '2d' | '3d' | 'polar';

export const GraphStudio: React.FC<GraphStudioProps> = ({ onBack, isProMember }) => {
  if (isProMember === false) {
    return (
        <div className="h-full flex items-center justify-center p-6 bg-slate-950">
            <div className="max-w-md w-full bg-slate-900 border border-indigo-500/30 rounded-[3rem] p-12 text-center shadow-2xl">
                <Lock size={48} className="text-indigo-400 mx-auto mb-6" />
                <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-4">Pro Access Required</h2>
                <p className="text-slate-400 text-sm mb-10 font-medium">Neural Graph Studio requires an active Pro Membership to handle high-performance mathematical refractions.</p>
                <button onClick={onBack} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest rounded-2xl transition-all">Back to Hub</button>
            </div>
        </div>
    );
  }

  const [mode, setMode] = useState<GraphMode>('2d');
  const [equations, setEquations] = useState<Equation[]>([
    { id: '1', expression: 'sin(x)', visible: true, color: '#00f2ff' } 
  ]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isPlotting, setIsPlotting] = useState(false);
  
  const [plotlyStatus, setPlotlyStatus] = useState<'waiting' | 'loading' | 'ready' | 'error'>('waiting');
  const [mathStatus, setMathStatus] = useState<'waiting' | 'loading' | 'ready' | 'error'>('waiting');
  const [initLogs, setInitLogs] = useState<{time: string, msg: string, type: 'info' | 'error' | 'network'}[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const graphRef = useRef<HTMLDivElement>(null);
  const libsReady = plotlyStatus === 'ready' && mathStatus === 'ready';

  const addLog = useCallback((msg: string, type: 'info' | 'error' | 'network' = 'info') => {
      const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setInitLogs(prev => [{ time, msg, type }, ...prev].slice(0, 30));
  }, []);

  const injectScript = useCallback((id: string, src: string, onReady: () => void, onError: (err: any) => void) => {
    const existing = document.getElementById(id);
    if (existing) return;
    const script = document.createElement('script');
    script.id = id; script.src = src; script.async = true;
    script.onload = onReady; script.onerror = onError;
    document.head.appendChild(script);
  }, []);

  const initializeEngine = useCallback(() => {
    const Plotly = (window as any).Plotly;
    const math = (window as any).math || (window as any).mathjs;
    if (Plotly) setPlotlyStatus('ready');
    else {
        setPlotlyStatus('loading');
        injectScript('plotly-cdn-runtime', 'https://cdn.plot.ly/plotly-2.27.0.min.js', () => setPlotlyStatus('ready'), () => setPlotlyStatus('error'));
    }
    if (math) setMathStatus('ready');
    else {
        setMathStatus('loading');
        injectScript('mathjs-cdn-runtime', 'https://cdnjs.cloudflare.com/ajax/libs/mathjs/12.2.1/math.all.min.js', () => setMathStatus('ready'), () => setMathStatus('error'));
    }
  }, [injectScript]);

  useEffect(() => {
    let mounted = true;
    const timer = setTimeout(() => { if (mounted) initializeEngine(); }, 500);
    const interval = setInterval(() => {
        if (!mounted) return;
        const Plotly = (window as any).Plotly;
        const math = (window as any).math || (window as any).mathjs;
        if (Plotly && plotlyStatus !== 'ready') setPlotlyStatus('ready');
        if (math && mathStatus !== 'ready') setMathStatus('ready');
        if (Plotly && math) clearInterval(interval);
        else setRetryCount(c => c + 1);
    }, 1000);
    return () => { mounted = false; clearTimeout(timer); clearInterval(interval); };
  }, [initializeEngine, plotlyStatus, mathStatus]);

  const renderGraph = useCallback(() => {
    if (!graphRef.current || !libsReady) return;
    const Plotly = (window as any).Plotly;
    const math = (window as any).math || (window as any).mathjs;
    setIsPlotting(true);
    const data: any[] = [];
    equations.forEach((eq) => {
      if (!eq.expression.trim() || !eq.visible) return;
      try {
        const compiled = math.compile(eq.expression);
        if (mode === '2d') {
          const RANGE = 10; const POINTS = 800;
          const xValues = Array.from({ length: POINTS }, (_, i) => -RANGE + (i / (POINTS - 1)) * 2 * RANGE);
          const yValues = xValues.map(x => { try { const val = compiled.evaluate({ x }); return (typeof val === 'number' && isFinite(val)) ? val : null; } catch { return null; } });
          data.push({ x: xValues, y: yValues, type: 'scatter', mode: 'lines', name: eq.expression, line: { color: eq.color, width: 4, shape: 'spline' } });
        } else if (mode === '3d') {
          const RANGE = 5; const POINTS = 45;
          const xValues = Array.from({ length: POINTS }, (_, i) => -RANGE + (i / (POINTS - 1)) * 2 * RANGE);
          const yValues = Array.from({ length: POINTS }, (_, i) => -RANGE + (i / (POINTS - 1)) * 2 * RANGE);
          const zValues: number[][] = [];
          for (let i = 0; i < yValues.length; i++) {
            const row: number[] = [];
            for (let j = 0; j < xValues.length; j++) { try { const val = compiled.evaluate({ x: xValues[j], y: yValues[i] }); row.push(isFinite(val) ? val : 0); } catch { row.push(0); } }
            zValues.push(row);
          }
          data.push({ z: zValues, x: xValues, y: yValues, type: 'surface', colorscale: 'Viridis', showscale: false });
        }
      } catch (err) {}
    });
    Plotly.react(graphRef.current, data, { autosize: true, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', margin: { t: 40, r: 40, b: 60, l: 60 }, font: { color: '#94a3b8' } }).finally(() => setIsPlotting(false));
  }, [equations, mode, libsReady]);

  useEffect(() => { if (libsReady) renderGraph(); }, [libsReady, equations, mode, renderGraph]);

  return (
    <div className="flex h-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <div className="w-80 border-r border-slate-800 bg-slate-900/50 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-800 flex items-center gap-3"><button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"><ArrowLeft size={20} /></button><h2 className="font-black uppercase tracking-tighter italic text-indigo-400">Neural Graph</h2></div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
          <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">System</label><div className="grid grid-cols-3 gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800">{(['2d', '3d', 'polar'] as GraphMode[]).map(m => (<button key={m} onClick={() => setMode(m)} className={`py-2 rounded-lg text-[10px] font-black uppercase transition-all ${mode === m ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>{m}</button>))}</div></div>
          <div className="space-y-4"><div className="flex items-center justify-between"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Equations</label><button onClick={() => setEquations([...equations, { id: Date.now().toString(), expression: '', visible: true, color: '#f472b6' }])} className="p-1 text-indigo-400"><Plus size={16}/></button></div><div className="space-y-3">{equations.map((eq) => (<div key={eq.id} className="group bg-slate-950 border border-slate-800 rounded-xl p-3"><input type="text" value={eq.expression} onChange={(e) => setEquations(equations.map(ex => ex.id === eq.id ? { ...ex, expression: e.target.value } : ex))} onKeyDown={(e) => e.key === 'Enter' && renderGraph()} className="w-full bg-transparent text-sm font-mono text-indigo-200 outline-none" placeholder="y = sin(x)/x"/></div>))}</div><button onClick={renderGraph} disabled={isPlotting || !libsReady} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase rounded-xl transition-all">{isPlotting ? <Loader2 size={12} className="animate-spin"/> : <Play size={12} fill="currentColor"/>} Plot</button></div>
        </div>
      </div>
      <div className="flex-1 relative flex flex-col bg-slate-950">
        {!libsReady ? (<div className="absolute inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-8 text-center space-y-10"><div className="relative"><div className="w-32 h-32 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin"></div><Activity className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-400" size={40}/></div><h3 className="text-2xl font-black text-white italic uppercase tracking-widest">Waking Neural Core</h3></div>) : (
            <div className="flex-1 z-10 p-6 flex flex-col"><div className="flex-1 bg-slate-900/60 rounded-[3rem] border border-slate-800/50 relative"><div ref={graphRef} className="w-full h-full" /></div></div>
        )}
      </div>
    </div>
  );
};

export default GraphStudio;
