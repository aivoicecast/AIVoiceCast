
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Sparkles, Wand2, Plus, Trash2, Maximize2, Settings2, RefreshCw, Loader2, Info, ChevronRight, Share2, Grid3X3, Circle, Activity, Play, Check, AlertCircle, ShieldAlert, RefreshCcw } from 'lucide-react';
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
  const [libsReady, setLibsReady] = useState(false);
  const [libError, setLibError] = useState<string | null>(null);
  const [errorIds, setErrorIds] = useState<Set<string>>(new Set());
  const graphRef = useRef<HTMLDivElement>(null);
  const detectionRetryRef = useRef<number>(0);

  // Robust Library Detection with Debugging
  useEffect(() => {
    let mounted = true;
    console.log("[GraphStudio] Initializing Neural Engine Detection...");
    
    const detect = () => {
        if (!mounted) return;
        const Plotly = (window as any).Plotly;
        const math = (window as any).math;
        
        const hasPlotly = !!Plotly;
        const hasMath = !!math;

        if (hasPlotly && hasMath) {
            console.log("[GraphStudio] Engine components verified. Plotly & Math.js ACTIVE.");
            setLibsReady(true);
            setLibError(null);
            return;
        }

        // Diagnostic Logging
        if (detectionRetryRef.current % 5 === 0) {
            console.warn(`[GraphStudio] Detection Poll #${detectionRetryRef.current}: Plotly=${hasPlotly}, Math=${hasMath}`);
        }

        if (detectionRetryRef.current < 60) {
            detectionRetryRef.current++;
            setTimeout(detect, 200);
        } else {
            console.error("[GraphStudio] Engine timed out. Libraries failed to attach to window.");
            const missing = !hasPlotly && !hasMath ? "Plotly & Math.js" : !hasPlotly ? "Plotly" : "Math.js";
            setLibError(`Critical Failure: ${missing} not found after 12s.`);
        }
    };

    detect();
    return () => { mounted = false; };
  }, []);

  const handleForceReload = () => {
      window.location.reload();
  };

  const handleResize = () => {
    if (graphRef.current && (window as any).Plotly) {
      (window as any).Plotly.Plots.resize(graphRef.current);
    }
  };

  const renderGraph = useCallback(() => {
    if (!graphRef.current || !libsReady) return;
    
    const Plotly = (window as any).Plotly;
    const math = (window as any).math;

    if (!Plotly || !math) {
        console.error("[GraphStudio] Libraries lost mid-render. Re-detecting...");
        setLibsReady(false);
        return;
    }

    // Defensive check for zero-size container
    if (graphRef.current.clientWidth === 0 || graphRef.current.clientHeight === 0) {
        console.warn("[GraphStudio] Container has zero dimensions. Waiting for layout stability...");
        setTimeout(() => {
            if (graphRef.current && graphRef.current.clientWidth > 0) renderGraph();
        }, 200);
        return;
    }

    setIsPlotting(true);
    const data: any[] = [];
    const newErrorIds = new Set<string>();

    equations.forEach((eq) => {
      if (!eq.expression.trim() || !eq.visible) return;
      try {
        const compiled = math.compile(eq.expression);

        if (mode === '2d') {
          const RANGE_2D = 10;
          const POINTS_2D = 800;
          const xValues = Array.from({ length: POINTS_2D }, (_, i) => -RANGE_2D + (i / (POINTS_2D - 1)) * 2 * RANGE_2D);
          const yValues = xValues.map(x => {
            try { 
                const val = compiled.evaluate({ x }); 
                return (typeof val === 'number' && isFinite(val)) ? val : null;
            } catch { return null; }
          });
          data.push({
            x: xValues,
            y: yValues,
            type: 'scatter',
            mode: 'lines',
            name: eq.expression,
            line: { color: eq.color, width: 4, shape: 'spline' },
            hoverinfo: 'x+y'
          });
        } 
        else if (mode === '3d') {
          const RANGE_3D = 5;
          const POINTS_3D = 45;
          const xValues = Array.from({ length: POINTS_3D }, (_, i) => -RANGE_3D + (i / (POINTS_3D - 1)) * 2 * RANGE_3D);
          const yValues = Array.from({ length: POINTS_3D }, (_, i) => -RANGE_3D + (i / (POINTS_3D - 1)) * 2 * RANGE_3D);
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

          data.push({
            z: zValues, x: xValues, y: yValues,
            type: 'surface',
            name: eq.expression,
            colorscale: 'Viridis',
            showscale: false,
            opacity: 0.9
          });
        }
        else if (mode === 'polar') {
          const POINTS_2D = 800;
          const thetaValues = Array.from({ length: POINTS_2D }, (_, i) => (i / (POINTS_2D - 1)) * 2 * Math.PI);
          const rValues = thetaValues.map(theta => {
            try { 
                const val = compiled.evaluate({ theta }); 
                return (typeof val === 'number' && isFinite(val)) ? val : null;
            } catch { return null; }
          });
          data.push({
            type: 'scatterpolar',
            r: rValues,
            theta: thetaValues.map(t => (t * 180) / Math.PI),
            mode: 'lines',
            name: eq.expression,
            line: { color: eq.color, width: 3 }
          });
        }
      } catch (err) {
        newErrorIds.add(eq.id);
      }
    });

    if (newErrorIds.size !== errorIds.size) setErrorIds(newErrorIds);

    const layout = {
      autosize: true,
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      margin: { t: 40, r: 40, b: 60, l: 60 },
      showlegend: mode !== '3d' && data.length > 1,
      font: { color: '#94a3b8', family: 'Inter, sans-serif', size: 11 },
      xaxis: { 
          gridcolor: '#334155', 
          zerolinecolor: '#ffffff', 
          zerolinewidth: 2,
          tickcolor: '#64748b'
      },
      yaxis: { 
          gridcolor: '#334155', 
          zerolinecolor: '#ffffff', 
          zerolinewidth: 2,
          tickcolor: '#64748b'
      },
      scene: {
        xaxis: { backgroundcolor: '#020617', gridcolor: '#334155', showbackground: true, zerolinecolor: '#ffffff' },
        yaxis: { backgroundcolor: '#020617', gridcolor: '#334155', showbackground: true, zerolinecolor: '#ffffff' },
        zaxis: { backgroundcolor: '#020617', gridcolor: '#334155', showbackground: true, zerolinecolor: '#ffffff' }
      },
      polar: {
        bgcolor: 'rgba(0,0,0,0)',
        angularaxis: { gridcolor: '#334155', linecolor: '#94a3b8' },
        radialaxis: { gridcolor: '#334155', linecolor: '#94a3b8' }
      }
    };

    const config = { 
        responsive: true, 
        displayModeBar: false
    };

    Plotly.react(graphRef.current, data, layout, config).finally(() => {
        setIsPlotting(false);
    });
  }, [equations, mode, libsReady, errorIds]);

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    if (libsReady) {
        renderGraph();
    }
    return () => window.removeEventListener('resize', handleResize);
  }, [libsReady, equations, mode, renderGraph]);

  const handleAiAssist = async () => {
    if (!aiPrompt.trim() || isAiThinking) return;
    setIsAiThinking(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const promptText = `Convert this natural language request for a math graph into a pure mathematical expression that math.js can evaluate. 
      For 2D, use 'x' as variable. For 3D, use 'x' and 'y'. For Polar, use 'theta'.
      Return ONLY a JSON object: { "expression": "string", "mode": "2d" | "3d" | "polar", "explanation": "string" }
      Request: "${aiPrompt}"`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: promptText,
        config: { responseMimeType: 'application/json' }
      });

      const result = JSON.parse(response.text || '{}');
      if (result.expression) {
        setMode(result.mode);
        const newEq: Equation = {
          id: Date.now().toString(),
          expression: result.expression,
          visible: true,
          color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')
        };
        setEquations([newEq]); 
        setAiPrompt('');
      }
    } catch (e) {
      console.error("AI Math Assist Error", e);
    } finally {
      setIsAiThinking(false);
    }
  };

  const addEquation = () => {
    const randomColors = ['#00f2ff', '#f472b6', '#38bdf8', '#fbbf24', '#a78bfa', '#4ade80'];
    setEquations([...equations, { id: Date.now().toString(), expression: '', visible: true, color: randomColors[equations.length % randomColors.length] }]);
  };

  const updateEquation = (id: string, expression: string) => {
    setEquations(equations.map(e => e.id === id ? { ...e, expression } : e));
  };

  const removeEquation = (id: string) => {
    if (equations.length > 1) {
      setEquations(equations.filter(e => e.id !== id));
    }
  };

  return (
    <div className="flex h-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <div className="w-80 border-r border-slate-800 bg-slate-900/50 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h2 className="font-black uppercase tracking-tighter italic text-indigo-400">Neural Graph</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Coordinate System</label>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800">
              {(['2d', '3d', 'polar'] as GraphMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`py-2 rounded-lg text-[10px] font-black uppercase transition-all ${mode === m ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Expressions</label>
              <button onClick={addEquation} className="p-1 hover:bg-slate-800 rounded text-indigo-400">
                <Plus size={16}/>
              </button>
            </div>
            <div className="space-y-3">
              {equations.map((eq) => (
                <div key={eq.id} className={`group relative bg-slate-950 border rounded-xl p-3 transition-all ${errorIds.has(eq.id) ? 'border-red-500' : 'border-slate-800 focus-within:border-indigo-500/50'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: eq.color }}></div>
                    <span className="text-[9px] font-mono text-slate-600 uppercase tracking-tighter">f({mode === 'polar' ? 'θ' : mode === '3d' ? 'x,y' : 'x'})</span>
                    {errorIds.has(eq.id) && <AlertCircle size={10} className="text-red-500 animate-pulse"/>}
                    <button onClick={() => removeEquation(eq.id)} className="ml-auto opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400">
                      <Trash2 size={12}/>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={eq.expression}
                    onChange={(e) => updateEquation(eq.id, e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && renderGraph()}
                    className="w-full bg-transparent text-sm font-mono text-indigo-200 outline-none placeholder-slate-800"
                    placeholder={mode === 'polar' ? "r = sin(3*theta)" : mode === '3d' ? "z = x^2 - y^2" : "y = sin(x)/x"}
                  />
                </div>
              ))}
            </div>
            <button 
              onClick={renderGraph}
              disabled={isPlotting || !libsReady}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {isPlotting ? <Loader2 size={12} className="animate-spin"/> : <Play size={12} fill="currentColor"/>}
              Plot Equations
            </button>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-3 block">Neural Assistant</label>
            <div className="relative group">
              <textarea
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder="Describe a function... (e.g., 'A hyperbolic paraboloid')"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 outline-none focus:border-indigo-500 resize-none h-24 transition-all shadow-inner"
              />
              <button
                onClick={handleAiAssist}
                disabled={!aiPrompt.trim() || isAiThinking}
                className="absolute bottom-3 right-3 p-2 bg-indigo-600 text-white rounded-xl shadow-lg disabled:opacity-30"
              >
                {isAiThinking ? <Loader2 size={16} className="animate-spin"/> : <Wand2 size={16}/>}
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-950/50">
            {libError ? (
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[9px] text-red-400 font-bold uppercase tracking-widest">
                        <AlertCircle size={10}/> {libError}
                    </div>
                    <button 
                        onClick={handleForceReload}
                        className="w-full py-2 bg-red-950/30 border border-red-500/30 rounded-lg text-[9px] font-black text-red-200 uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-900/50"
                    >
                        <RefreshCcw size={10}/> Force Script Recovery
                    </button>
                </div>
            ) : !libsReady ? (
                <div className="flex items-center gap-2 text-[9px] text-amber-400 font-bold uppercase tracking-widest">
                    <Loader2 size={10} className="animate-spin"/> Initializing Engine...
                </div>
            ) : (
                <div className="flex items-center gap-3 p-3 bg-indigo-600/10 border border-indigo-500/20 rounded-xl">
                    <Info size={16} className="text-indigo-400 shrink-0"/>
                    <p className="text-[9px] text-indigo-300 leading-tight">
                        Variables supported: <b>x</b>, <b>y</b>, <b>theta</b>. Use standard notation like <b>^2</b>, <b>sin()</b>, <b>abs()</b>.
                    </p>
                </div>
            )}
        </div>
      </div>

      <div className="flex-1 relative flex flex-col bg-slate-950">
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-600/20 blur-[120px] rounded-full"></div>
        </div>

        <div className="p-6 flex items-center justify-between z-10 shrink-0">
           <div>
               <h3 className="text-xl font-black text-white italic tracking-tighter uppercase">Visualizing {mode.toUpperCase()} Reality</h3>
               <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1 flex items-center gap-2">
                   <Activity size={10} className="text-emerald-500"/> Interactive WebGL Engine Active
               </p>
           </div>
           <div className="flex gap-2">
               <button onClick={handleResize} className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-all"><RefreshCw size={18}/></button>
           </div>
        </div>

        <div className="flex-1 z-10 p-6 pt-0 flex flex-col">
            <div className="flex-1 bg-slate-900/60 backdrop-blur-md rounded-[3rem] border border-slate-800/50 shadow-2xl overflow-hidden relative">
                <div ref={graphRef} className="w-full h-full" />
                
                <div className="absolute bottom-8 right-8 flex flex-col gap-2">
                    <div className="bg-slate-900/90 backdrop-blur-md p-3 px-5 rounded-2xl border border-slate-700 shadow-2xl flex items-center gap-4">
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            <Grid3X3 size={14}/> {mode === '3d' ? '3D Proj' : '2D Plane'}
                        </div>
                        <div className="w-px h-4 bg-slate-700"></div>
                        <div className="flex items-center gap-2 text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                            <Circle size={10} fill="currentColor" className={libsReady ? 'animate-pulse' : ''}/> {libsReady ? 'Sync Active' : 'Waiting...'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default GraphStudio;
