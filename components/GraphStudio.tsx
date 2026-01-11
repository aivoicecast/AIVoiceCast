
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Sparkles, Wand2, Plus, Trash2, Maximize2, Settings2, RefreshCw, Loader2, Info, ChevronRight, Share2, Grid3X3, Circle, Activity, Play, Check, AlertCircle, ShieldAlert, RefreshCcw, Terminal, Zap, CloudDownload, Globe, CheckCircle } from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";

interface GraphStudioProps {
  onBack: () => void;
}

interface Equation {
  id: string;
  expression: string;
  visible: boolean;
  color: string;
}

type GraphMode = '2d' | '3d' | 'polar';

export const GraphStudio: React.FC<GraphStudioProps> = ({ onBack }) => {
  const [mode, setMode] = useState<GraphMode>('2d');
  const [equations, setEquations] = useState<Equation[]>([
    { id: '1', expression: 'sin(x)', visible: true, color: '#00f2ff' } 
  ]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isPlotting, setIsPlotting] = useState(false);
  
  // Handshake Statuses
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
      console.log(`[GraphStudio] ${msg}`);
  }, []);

  const injectScript = useCallback((id: string, src: string, onReady: () => void, onError: (err: any) => void) => {
    const existing = document.getElementById(id);
    if (existing) {
        addLog(`Re-verifying existing script node: ${id}`, "info");
        // If it's already there, just wait for the global to appear
        return;
    }

    addLog(`Cache miss. Initiating network request for ${id}...`, "network");
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = () => {
        addLog(`Neural handshake successful for ${id}.`, "info");
        onReady();
    };
    script.onerror = (e) => {
        addLog(`Network protocol error on ${id}. Endpoint might be unreachable.`, "error");
        onError(e);
    };
    document.head.appendChild(script);
  }, [addLog]);

  const initializeEngine = useCallback(() => {
    const Plotly = (window as any).Plotly;
    const math = (window as any).math || (window as any).mathjs;

    // 1. Check Plotly (Aligned with index.html)
    if (Plotly) {
        setPlotlyStatus('ready');
        addLog("Plotly Engine verified in cache.", "info");
    } else {
        setPlotlyStatus('loading');
        injectScript(
            'plotly-cdn-runtime', 
            'https://cdn.plot.ly/plotly-2.27.0.min.js', 
            () => setPlotlyStatus('ready'),
            () => setPlotlyStatus('error')
        );
    }

    // 2. Check Math.js (Aligned with index.html cdnjs)
    if (math) {
        setMathStatus('ready');
        addLog("Math Parser verified in cache.", "info");
    } else {
        setMathStatus('loading');
        injectScript(
            'mathjs-cdn-runtime', 
            'https://cdnjs.cloudflare.com/ajax/libs/mathjs/12.2.1/math.all.min.js', 
            () => setMathStatus('ready'),
            () => {
                setMathStatus('error');
                addLog("Primary Math.js failed. Trying unpkg fallback...", "error");
                injectScript('mathjs-fallback', 'https://unpkg.com/mathjs@12.2.1/lib/browser/math.js', () => setMathStatus('ready'), () => setMathStatus('error'));
            }
        );
    }
  }, [addLog, injectScript]);

  useEffect(() => {
    let mounted = true;
    
    // Give index.html scripts 500ms to register before doing anything
    const timer = setTimeout(() => {
        if (mounted) initializeEngine();
    }, 500);

    // Aggressive polling for 30 seconds
    const interval = setInterval(() => {
        if (!mounted) return;
        const Plotly = (window as any).Plotly;
        const math = (window as any).math || (window as any).mathjs;

        if (Plotly && plotlyStatus !== 'ready') {
            setPlotlyStatus('ready');
            addLog("Async detection: Plotly active.", "info");
        }
        if (math && mathStatus !== 'ready') {
            setMathStatus('ready');
            addLog("Async detection: Math.js active.", "info");
        }

        if (Plotly && math) {
            clearInterval(interval);
        } else {
            setRetryCount(c => c + 1);
        }
    }, 1000);

    return () => { 
        mounted = false;
        clearTimeout(timer);
        clearInterval(interval);
    };
  }, [initializeEngine, addLog, plotlyStatus, mathStatus]);

  const handleForceHandshake = () => {
      addLog("User-initiated emergency handshake restart.", "info");
      setPlotlyStatus('waiting');
      setMathStatus('waiting');
      setRetryCount(0);
      initializeEngine();
  };

  const handleResize = () => {
    if (graphRef.current && (window as any).Plotly) {
      (window as any).Plotly.Plots.resize(graphRef.current);
    }
  };

  const renderGraph = useCallback(() => {
    if (!graphRef.current || !libsReady) return;
    
    const Plotly = (window as any).Plotly;
    const math = (window as any).math || (window as any).mathjs;

    if (graphRef.current.clientWidth === 0 || graphRef.current.clientHeight === 0) {
        setTimeout(renderGraph, 300);
        return;
    }

    setIsPlotting(true);
    const data: any[] = [];
    const errors = new Set<string>();

    equations.forEach((eq) => {
      if (!eq.expression.trim() || !eq.visible) return;
      try {
        const compiled = math.compile(eq.expression);
        if (mode === '2d') {
          const RANGE = 10;
          const POINTS = 800;
          const xValues = Array.from({ length: POINTS }, (_, i) => -RANGE + (i / (POINTS - 1)) * 2 * RANGE);
          const yValues = xValues.map(x => {
            try { 
                const val = compiled.evaluate({ x }); 
                return (typeof val === 'number' && isFinite(val)) ? val : null;
            } catch { return null; }
          });
          data.push({ x: xValues, y: yValues, type: 'scatter', mode: 'lines', name: eq.expression, line: { color: eq.color, width: 4, shape: 'spline' } });
        } 
        else if (mode === '3d') {
          const RANGE = 5;
          const POINTS = 45;
          const xValues = Array.from({ length: POINTS }, (_, i) => -RANGE + (i / (POINTS - 1)) * 2 * RANGE);
          const yValues = Array.from({ length: POINTS }, (_, i) => -RANGE + (i / (POINTS - 1)) * 2 * RANGE);
          const zValues: number[][] = [];
          for (let i = 0; i < yValues.length; i++) {
            const row: number[] = [];
            for (let j = 0; j < xValues.length; j++) {
              try {
                const val = compiled.evaluate({ x: xValues[j], y: yValues[i] });
                row.push((typeof val === 'number' && isFinite(val)) ? val : 0);
              } catch { row.push(0); }
            }
            zValues.push(row);
          }
          data.push({ z: zValues, x: xValues, y: yValues, type: 'surface', colorscale: 'Viridis', showscale: false });
        }
        else if (mode === 'polar') {
          const POINTS = 800;
          const thetaValues = Array.from({ length: POINTS }, (_, i) => (i / (POINTS - 1)) * 360);
          const rValues = thetaValues.map(theta => {
            try { 
                const val = compiled.evaluate({ theta: (theta * Math.PI) / 180 }); 
                return (typeof val === 'number' && isFinite(val)) ? val : null;
            } catch { return null; }
          });
          data.push({ type: 'scatterpolar', r: rValues, theta: thetaValues, mode: 'lines', line: { color: eq.color, width: 3 } });
        }
      } catch (err) { errors.add(eq.id); }
    });

    const layout = {
      autosize: true, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
      margin: { t: 40, r: 40, b: 60, l: 60 },
      showlegend: mode !== '3d' && data.length > 1,
      font: { color: '#94a3b8', family: 'Inter, sans-serif', size: 11 },
      xaxis: { gridcolor: '#334155', zerolinecolor: '#ffffff', zerolinewidth: 2 },
      yaxis: { gridcolor: '#334155', zerolinecolor: '#ffffff', zerolinewidth: 2 },
      scene: {
        xaxis: { backgroundcolor: '#020617', gridcolor: '#334155', showbackground: true, zerolinecolor: '#ffffff' },
        yaxis: { backgroundcolor: '#020617', gridcolor: '#334155', showbackground: true, zerolinecolor: '#ffffff' },
        zaxis: { backgroundcolor: '#020617', gridcolor: '#334155', showbackground: true, zerolinecolor: '#ffffff' }
      },
      polar: { bgcolor: 'rgba(0,0,0,0)', angularaxis: { gridcolor: '#334155', linecolor: '#94a3b8' }, radialaxis: { gridcolor: '#334155', linecolor: '#94a3b8' } }
    };

    Plotly.react(graphRef.current, data, layout, { responsive: true, displayModeBar: false }).finally(() => {
        setIsPlotting(false);
    });
  }, [equations, mode, libsReady]);

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    if (libsReady) renderGraph();
    return () => window.removeEventListener('resize', handleResize);
  }, [libsReady, equations, mode, renderGraph]);

  const handleAiAssist = async () => {
    if (!aiPrompt.trim() || isAiThinking) return;
    setIsAiThinking(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const promptText = `Convert this math request into an expression for math.js. Return ONLY JSON: { "expression": "string", "mode": "2d" | "3d" | "polar" }
      Request: "${aiPrompt}"`;
      const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: promptText, config: { responseMimeType: 'application/json' } });
      const result = JSON.parse(response.text || '{}');
      if (result.expression) {
        setMode(result.mode);
        setEquations([{ id: Date.now().toString(), expression: result.expression, visible: true, color: '#00f2ff' }]);
        setAiPrompt('');
      }
    } catch (e) { console.error(e); } finally { setIsAiThinking(false); }
  };

  return (
    <div className="flex h-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <div className="w-80 border-r border-slate-800 bg-slate-900/50 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"><ArrowLeft size={20} /></button>
          <h2 className="font-black uppercase tracking-tighter italic text-indigo-400">Neural Graph</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Coordinate System</label>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800">
              {(['2d', '3d', 'polar'] as GraphMode[]).map(m => (
                <button key={m} onClick={() => setMode(m)} className={`py-2 rounded-lg text-[10px] font-black uppercase transition-all ${mode === m ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>{m}</button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Expressions</label>
              <button onClick={() => setEquations([...equations, { id: Date.now().toString(), expression: '', visible: true, color: '#f472b6' }])} className="p-1 hover:bg-slate-800 rounded text-indigo-400"><Plus size={16}/></button>
            </div>
            <div className="space-y-3">
              {equations.map((eq) => (
                <div key={eq.id} className="group relative bg-slate-950 border border-slate-800 rounded-xl p-3 transition-all focus-within:border-indigo-500/50">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: eq.color }}></div>
                    <span className="text-[9px] font-mono text-slate-600 uppercase tracking-tighter">f({mode === 'polar' ? 'θ' : mode === '3d' ? 'x,y' : 'x'})</span>
                    <button onClick={() => setEquations(equations.filter(e => e.id !== eq.id))} className="ml-auto opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400"><Trash2 size={12}/></button>
                  </div>
                  <input
                    type="text" value={eq.expression}
                    onChange={(e) => setEquations(equations.map(ex => ex.id === eq.id ? { ...ex, expression: e.target.value } : ex))}
                    onKeyDown={(e) => e.key === 'Enter' && renderGraph()}
                    className="w-full bg-transparent text-sm font-mono text-indigo-200 outline-none placeholder-slate-800"
                    placeholder="y = sin(x)/x"
                  />
                </div>
              ))}
            </div>
            <button onClick={renderGraph} disabled={isPlotting || !libsReady} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white text-[10px] font-black uppercase rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2">
              {isPlotting ? <Loader2 size={12} className="animate-spin"/> : <Play size={12} fill="currentColor"/>} Plot Equations
            </button>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-3 block">Neural Assistant</label>
            <div className="relative group">
              <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Describe a function..." className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 outline-none focus:border-indigo-500 resize-none h-24 shadow-inner" />
              <button onClick={handleAiAssist} disabled={!aiPrompt.trim() || isAiThinking} className="absolute bottom-3 right-3 p-2 bg-indigo-600 text-white rounded-xl shadow-lg disabled:opacity-30">
                {isAiThinking ? <Loader2 size={16} className="animate-spin"/> : <Wand2 size={16}/>}
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-950/50">
            <div className="flex items-center gap-3 p-3 bg-indigo-600/10 border border-indigo-500/20 rounded-xl">
                <Info size={16} className="text-indigo-400 shrink-0"/>
                <p className="text-[9px] text-indigo-300 leading-tight">Variables: <b>x</b>, <b>y</b>, <b>theta</b>. Supports <b>sin</b>, <b>abs</b>, <b>^2</b>.</p>
            </div>
        </div>
      </div>

      <div className="flex-1 relative flex flex-col bg-slate-950">
        {!libsReady ? (
            <div className="absolute inset-0 z-50 bg-slate-950 flex items-center justify-center p-8">
                <div className="max-w-md w-full space-y-10 animate-fade-in text-center">
                    <div className="relative inline-block">
                        <div className="w-32 h-32 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin"></div>
                        <Activity className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-400" size={40}/>
                    </div>
                    
                    <div className="space-y-3">
                        <h3 className="text-2xl font-black text-white italic uppercase tracking-widest">Waking Neural Core</h3>
                        <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">Establishing handshake with Plotly WebGL Engine & Math.js Parser</p>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-12 bg-indigo-500/5 blur-3xl rounded-full pointer-events-none"></div>
                        
                        <div className="flex justify-between items-center px-2 relative z-10">
                            <div className="flex items-center gap-4">
                                <div className={`w-3 h-3 rounded-full shadow-lg ${plotlyStatus === 'ready' ? 'bg-emerald-500 shadow-emerald-500/40' : plotlyStatus === 'error' ? 'bg-red-500' : 'bg-slate-700 animate-pulse'}`}></div>
                                <div className="text-left">
                                    <span className="text-[10px] font-black uppercase text-slate-300 tracking-widest block">Plotly Engine</span>
                                    <span className="text-[9px] text-slate-500 font-bold">~3.5MB Binary</span>
                                </div>
                            </div>
                            <div className="text-right">
                                {plotlyStatus === 'loading' && <div className="flex items-center gap-2 text-[10px] text-indigo-400 font-bold italic animate-pulse"><CloudDownload size={12}/> Syncing...</div>}
                                {plotlyStatus === 'ready' && <div className="text-[10px] text-emerald-400 font-black flex items-center gap-1"><CheckCircle size={12}/> VERIFIED</div>}
                            </div>
                        </div>

                        <div className="flex justify-between items-center px-2 relative z-10">
                            <div className="flex items-center gap-4">
                                <div className={`w-3 h-3 rounded-full shadow-lg ${mathStatus === 'ready' ? 'bg-emerald-500 shadow-emerald-500/40' : mathStatus === 'error' ? 'bg-red-500' : 'bg-slate-700 animate-pulse'}`}></div>
                                <div className="text-left">
                                    <span className="text-[10px] font-black uppercase text-slate-300 tracking-widest block">Math Parser</span>
                                    <span className="text-[9px] text-slate-500 font-bold">~1.2MB Logic</span>
                                </div>
                            </div>
                            <div className="text-right">
                                {mathStatus === 'loading' && <div className="flex items-center gap-2 text-[10px] text-indigo-400 font-bold italic animate-pulse"><CloudDownload size={12}/> Syncing...</div>}
                                {mathStatus === 'ready' && <div className="text-[10px] text-emerald-400 font-black flex items-center gap-1"><CheckCircle size={12}/> VERIFIED</div>}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={handleForceHandshake} className="py-3.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 border border-slate-700 transition-all active:scale-95 shadow-xl">
                                <RefreshCcw size={16}/> Neural Handshake
                            </button>
                            <button onClick={() => setShowDebug(!showDebug)} className={`py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 border transition-all active:scale-95 shadow-xl ${showDebug ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                                <Terminal size={16}/> Handshake Logs
                            </button>
                        </div>
                        <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">Handshake Attempt #{retryCount}</p>
                    </div>

                    {showDebug && (
                        <div className="bg-black/90 rounded-[2rem] p-6 text-left border border-slate-800 max-h-48 overflow-y-auto scrollbar-hide shadow-inner animate-fade-in-up">
                            {initLogs.length === 0 ? (
                                <p className="text-slate-700 text-[10px] italic">No event history yet...</p>
                            ) : initLogs.map((log, i) => (
                                <div key={i} className={`font-mono text-[10px] mb-2 flex gap-3 ${log.type === 'error' ? 'text-red-400' : log.type === 'network' ? 'text-amber-400' : 'text-slate-500'}`}>
                                    <span className="opacity-40 shrink-0">[{log.time}]</span> 
                                    <span className="break-words leading-relaxed">{log.type === 'network' && <Globe size={10} className="inline mr-1 mb-0.5"/>}{log.msg}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        ) : (
            <>
                <div className="p-6 flex items-center justify-between z-10 shrink-0">
                    <div>
                        <h3 className="text-xl font-black text-white italic tracking-tighter uppercase">Visualizing {mode.toUpperCase()} Reality</h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1 flex items-center gap-2"><Activity size={10} className="text-emerald-500"/> Interactive WebGL Engine Active</p>
                    </div>
                    <button onClick={handleResize} className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-all"><RefreshCw size={18}/></button>
                </div>
                <div className="flex-1 z-10 p-6 pt-0 flex flex-col">
                    <div className="flex-1 bg-slate-900/60 backdrop-blur-md rounded-[3rem] border border-slate-800/50 shadow-2xl overflow-hidden relative">
                        <div ref={graphRef} className="w-full h-full" />
                        <div className="absolute bottom-8 right-8 bg-slate-900/90 backdrop-blur-md p-3 px-5 rounded-2xl border border-slate-700 shadow-2xl flex items-center gap-4">
                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest"><Grid3X3 size={14}/> {mode === '3d' ? '3D Proj' : '2D Plane'}</div>
                            <div className="w-px h-4 bg-slate-700"></div>
                            <div className="flex items-center gap-2 text-[10px] font-black text-emerald-400 uppercase tracking-widest"><Circle size={10} fill="currentColor" className="animate-pulse"/> Sync Active</div>
                        </div>
                    </div>
                </div>
            </>
        )}
      </div>
    </div>
  );
};

export default GraphStudio;
