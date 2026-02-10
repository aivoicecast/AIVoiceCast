
import React, { useState, useEffect, useRef, useMemo } from 'react';
// Added AlertCircle to imports
import { Copy, Check, Image as ImageIcon, Loader2, Code as CodeIcon, ExternalLink, Sigma, Palette, Sun, Moon, Coffee, Maximize2, AlertCircle } from 'lucide-react';
import { encodePlantUML } from '../utils/plantuml';
import { ReaderTheme } from '../types';

interface MarkdownViewProps {
  content: string;
  initialTheme?: ReaderTheme;
  showThemeSwitcher?: boolean;
  compact?: boolean;
  fontSize?: number;
}

const THEME_CONFIG: Record<ReaderTheme, { container: string, prose: string, icon: any, label: string, textColor: string }> = {
    slate: { 
        container: 'bg-slate-900 text-slate-200', 
        prose: 'prose-invert prose-indigo', 
        icon: Palette, 
        label: 'Slate',
        textColor: 'text-slate-200'
    },
    light: { 
        container: 'bg-transparent text-slate-900', 
        prose: 'prose-slate prose-lg', 
        icon: Sun, 
        label: 'Paper',
        textColor: 'text-slate-900'
    },
    dark: { 
        container: 'bg-black text-white', 
        prose: 'prose-invert prose-blue', 
        icon: Moon, 
        label: 'Night',
        textColor: 'text-white'
    },
    sepia: { 
        container: 'bg-[#f4ecd8] text-[#5b4636]', 
        prose: 'prose-sepia', 
        icon: Coffee, 
        label: 'Sepia',
        textColor: 'text-[#5b4636]'
    }
};

const LatexRenderer: React.FC<{ tex: string, theme: ReaderTheme }> = ({ theme, tex }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (containerRef.current && (window as any).katex) {
            try {
                (window as any).katex.render(tex, containerRef.current, {
                    throwOnError: false,
                    displayMode: true,
                    trust: true,
                    strict: false
                });
            } catch (err) {
                console.error("KaTeX error:", err);
            }
        }
    }, [tex]);

    return (
        <div className={`my-4 p-6 rounded-2xl border flex flex-col justify-center items-center overflow-x-auto shadow-lg relative group/math ${
            theme === 'light' ? 'bg-slate-50 border-slate-200' : 
            theme === 'sepia' ? 'bg-[#ebe3cf] border-[#dcd2ba]' : 
            'bg-slate-900/50 border-white/10'
        }`}>
            <div className="absolute top-2 left-4 flex items-center gap-2 opacity-30">
                <Sigma size={10} className="text-indigo-500" />
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Theorem</span>
            </div>
            <div ref={containerRef} className={`${theme === 'sepia' ? 'text-[#5b4636]' : theme === 'light' ? 'text-indigo-900' : 'text-indigo-300'} text-base py-2`}></div>
        </div>
    );
};

const MermaidRenderer: React.FC<{ code: string, theme: ReaderTheme }> = ({ code, theme }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [svg, setSvg] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const render = async () => {
            if (typeof window !== 'undefined' && (window as any).mermaid) {
                const mermaid = (window as any).mermaid;
                mermaid.initialize({
                    startOnLoad: false,
                    theme: theme === 'light' || theme === 'sepia' ? 'default' : 'dark',
                    securityLevel: 'loose',
                });

                // SELF-HEALING REPAIR LOGIC
                // Attempt 1: Standard Render
                try {
                    const id = `mermaid-${Math.random().toString(36).substring(7)}`;
                    const { svg } = await mermaid.render(id, code);
                    setSvg(svg);
                    setError(null);
                    return;
                } catch (e: any) {
                    console.warn("[Mermaid] Initial render failed. Attempting heuristic repair...", e.message);
                }

                // Attempt 2: Heuristic Repair
                try {
                    // Repair Strategy A: Wrap unquoted labels in brackets with double quotes
                    // Identifies NodeID[Label with spaces or (brackets)] and changes to NodeID["Label..."]
                    let repaired = code.replace(/(\w+)\s*\[([^"\]]+)\]/g, (match, id, label) => {
                        const trimmed = label.trim();
                        if (trimmed.length > 0) {
                            return `${id}["${trimmed}"]`;
                        }
                        return match;
                    });

                    // Repair Strategy B: Fix naked multi-word targets in connections
                    repaired = repaired.replace(/([\w_]+)\s*-->\s*([^|\[\(\s\n]+[^|\[\(\n]*)/g, (match, id1, label2) => {
                        const trimmedLabel = label2.trim();
                        if (trimmedLabel.includes(' ') && !trimmedLabel.startsWith('[') && !trimmedLabel.startsWith('(')) {
                            const safeId = trimmedLabel.replace(/[^a-zA-Z0-9_]/g, '_');
                            return `${id1} --> ${safeId}["${trimmedLabel}"]`;
                        }
                        return match;
                    });

                    if (repaired !== code) {
                        const id2 = `mermaid-fix-${Math.random().toString(36).substring(7)}`;
                        const { svg: fixedSvg } = await mermaid.render(id2, repaired);
                        setSvg(fixedSvg);
                        setError(null);
                        return;
                    }
                } catch (e2: any) {
                    console.error("[Mermaid] Repair attempt failed:", e2.message);
                    setError(e2.message || "Final syntax check refused.");
                }
            }
        };
        render();
    }, [code, theme]);

    const handleOpenInNewWindow = () => {
        const win = window.open('', '_blank');
        if (!win) return;
        
        const title = "Neural Lens Diagram Zoom";
        win.document.write(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>${title}</title>
                    <style>
                        body { 
                            background: #020617; 
                            color: white; 
                            margin: 0; 
                            display: flex; 
                            flex-direction: column;
                            justify-content: center; 
                            align-items: center; 
                            min-height: 100vh; 
                            font-family: sans-serif; 
                            overflow: auto;
                        }
                        .container {
                            padding: 60px;
                            width: 100%;
                            display: flex;
                            justify-content: center;
                        }
                        .controls {
                            position: fixed;
                            top: 20px;
                            right: 20px;
                            background: rgba(255,255,255,0.05);
                            padding: 10px 20px;
                            border-radius: 12px;
                            font-size: 12px;
                            color: #6366f1;
                            font-weight: 800;
                            text-transform: uppercase;
                            letter-spacing: 0.1em;
                            border: 1px solid rgba(255,255,255,0.1);
                        }
                    </style>
                </head>
                <body>
                    <div class="controls">Pinch or Ctrl+/- to Zoom</div>
                    <div class="container">
                        <div class="mermaid">
                            ${code}
                        </div>
                    </div>
                    <script type="module">
                        import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
                        mermaid.initialize({ startOnLoad: true, theme: 'dark' });
                    </script>
                </body>
            </html>
        `);
        win.document.close();
    };

    if (error) return (
        <div className="p-4 bg-red-950/20 border border-red-500/30 rounded-xl space-y-2">
            <p className="text-red-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <AlertCircle size={12}/> Mermaid Logic Breach
            </p>
            <p className="text-[9px] text-slate-500 font-mono italic">{error}</p>
            <div className="mt-4 p-4 bg-black/40 rounded-lg overflow-x-auto">
                <pre className="text-[9px] text-indigo-300 font-mono leading-relaxed">{code}</pre>
            </div>
        </div>
    );

    return (
        <div className="my-4 relative group/mermaid">
            <div className="absolute top-4 right-4 z-10 opacity-0 group-hover/mermaid:opacity-100 transition-opacity">
                <button 
                    onClick={handleOpenInNewWindow}
                    className="p-2 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-lg text-indigo-400 hover:text-white hover:bg-indigo-600 transition-all shadow-xl"
                    title="Open in Zoomable Window"
                >
                    <Maximize2 size={16}/>
                </button>
            </div>
            <div className="flex justify-center bg-white/5 p-4 rounded-xl overflow-x-auto shadow-inner" dangerouslySetInnerHTML={{ __html: svg }} />
        </div>
    );
};

const PlantUMLRenderer: React.FC<{ code: string, theme: ReaderTheme }> = ({ code, theme }) => {
    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [showCode, setShowCode] = useState(false);
    const isDark = theme === 'slate' || theme === 'dark';

    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        encodePlantUML(code).then(encoded => {
            if (isMounted) {
                setUrl(`https://www.plantuml.com/plantuml/svg/${encoded}`);
                setLoading(false);
            }
        }).catch(err => {
            console.error("PlantUML encoding failed", err);
            if (isMounted) setLoading(false);
        });
        return () => { isMounted = false; };
    }, [code]);

    return (
        <div className={`my-4 border rounded-xl overflow-hidden shadow-md group ${
            theme === 'light' ? 'border-slate-200 bg-white' : 
            theme === 'sepia' ? 'border-[#dcd2ba] bg-[#f4ecd8]' : 
            'border-white/10 bg-slate-900'
        }`}>
            <div className={`flex items-center justify-between px-3 py-1.5 border-b ${
                theme === 'light' ? 'bg-slate-50 border-slate-200' : 
                theme === 'sepia' ? 'bg-[#ebe3cf] border-[#dcd2ba]' : 
                'bg-slate-800 border-white/5'
            }`}>
                <div className="flex items-center gap-2">
                    <ImageIcon size={12} className="text-pink-600" />
                    <span className={`text-[9px] font-black uppercase tracking-wider ${theme === 'sepia' ? 'text-[#8a7565]' : 'text-slate-500'}`}>System Diagram</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowCode(!showCode)} className="text-[9px] font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition-colors">
                        {showCode ? <ImageIcon size={12}/> : <CodeIcon size={12}/>}
                        {showCode ? 'View Diagram' : 'View Source'}
                    </button>
                </div>
            </div>

            <div className="p-4 flex justify-center min-h-[80px] relative bg-white">
                {loading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10 text-slate-900">
                        <Loader2 size={18} className="animate-spin text-indigo-600" />
                    </div>
                )}
                
                {showCode ? (
                    <pre className="w-full p-3 bg-slate-900 text-indigo-200 text-[10px] font-mono overflow-x-auto whitespace-pre rounded-lg">
                        {code}
                    </pre>
                ) : url ? (
                    <img 
                        src={url} 
                        alt="PlantUML Diagram" 
                        className={`max-w-full h-auto transition-transform duration-500 hover:scale-[1.01] ${isDark ? 'invert brightness-150' : ''}`}
                        onLoad={() => setLoading(false)}
                    />
                ) : !loading && (
                    <div className="p-4 text-slate-400 text-xs italic">Failed to load diagram.</div>
                )}
            </div>
        </div>
    );
};

export const MarkdownView: React.FC<MarkdownViewProps> = ({ content, initialTheme = 'slate', showThemeSwitcher = true, compact = false, fontSize }) => {
  const [theme, setTheme] = useState<ReaderTheme>(initialTheme);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
      setTheme(initialTheme);
  }, [initialTheme]);

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const formatInline = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|\$.*?\$)/g);
    return parts.map((p, i) => {
        if (!p) return null;
        if (p.startsWith('**') && p.endsWith('**')) {
            return <strong key={i} className="font-black text-inherit">{p.slice(2, -2)}</strong>;
        }
        if (p.startsWith('*') && p.endsWith('*')) {
            return <em key={i} className="italic opacity-90">{p.slice(1, -1)}</em>;
        }
        if (p.startsWith('`') && p.endsWith('`')) {
            return <code key={i} className={`px-1 py-0.5 rounded font-mono text-[0.9em] ${theme === 'light' ? 'bg-slate-100 text-indigo-600' : 'bg-white/10 text-indigo-300'}`}>{p.slice(1, -1)}</code>;
        }
        if (p.startsWith('$') && p.endsWith('$')) {
            const math = p.slice(1, -1);
            return (
                <span key={i} className="inline-block px-0.5 font-serif italic" dangerouslySetInnerHTML={{
                    __html: (window as any).katex ? (window as any).katex.renderToString(math, { throwOnError: false }) : math
                }} />
            );
        }
        return p;
    });
  };

  const renderContent = (text: string) => {
    const parts = text.split(/(```[\s\S]*?```|\$\$[\s\S]*?\$$)/g);
    return parts.map((part, index) => {
      if (part.startsWith('```')) {
        const codeContent = part.replace(/^```\w*\s*\n?/, '').replace(/```\s*$/, '');
        const langMatch = part.match(/^```(\w+)/);
        const language = langMatch ? langMatch[1].toLowerCase() : 'code';
        
        if (language === 'plantuml' || language === 'puml') {
            return <PlantUMLRenderer key={index} code={codeContent} theme={theme} />;
        }

        if (language === 'mermaid') {
            return <MermaidRenderer key={index} code={codeContent} theme={theme} />;
        }

        return (
          <div key={index} className={`my-3 rounded-lg overflow-hidden border ${
              theme === 'light' ? 'border-slate-200 bg-slate-900' : 
              theme === 'sepia' ? 'border-[#dcd2ba] bg-[#3e342b]' : 
              'border-white/10 bg-black'
          }`}>
             <div className="flex items-center justify-between px-3 py-1 bg-slate-800/50 border-b border-white/5">
               <span className="text-[9px] font-black font-mono text-slate-400 uppercase tracking-widest">{language}</span>
               <button 
                 onClick={() => handleCopy(codeContent, index)} 
                 className="p-1 text-slate-500 hover:text-indigo-400 transition-colors"
               >
                 {copiedIndex === index ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
               </button>
             </div>
             <pre className="p-3 text-[11px] font-mono text-indigo-100 overflow-x-auto whitespace-pre leading-relaxed">{codeContent}</pre>
          </div>
        );
      } else if (part.startsWith('$$')) {
          const tex = part.slice(2, -2).trim();
          return <LatexRenderer key={index} tex={tex} theme={theme} />;
      } else {
        const lines = part.split('\n');
        const renderedElements: React.ReactNode[] = [];
        let tableBuffer: string[] = [];

        const processTableBuffer = () => {
            if (tableBuffer.length < 2) {
                tableBuffer.forEach((line, i) => {
                    renderedElements.push(<p key={`tbl-fail-${index}-${renderedElements.length}-${i}`} className={compact ? "mb-2" : "mb-4"}>{formatInline(line)}</p>);
                });
            } else {
                const headers = tableBuffer[0].split('|').filter(c => c.trim() !== '').map(c => c.trim());
                const bodyRows = tableBuffer.slice(2).map(row => row.split('|').filter(c => c.trim() !== '').map(c => c.trim()));
                renderedElements.push(
                    <div key={`tbl-${index}-${renderedElements.length}`} className={`overflow-x-auto my-4 border rounded-xl shadow-sm ${
                        theme === 'light' ? 'border-slate-300 bg-white' : 
                        theme === 'sepia' ? 'border-[#dcd2ba] bg-[#f8f1e3]' : 
                        'border-white/10 bg-slate-900/40'
                    }`}>
                        <table className="min-w-full text-xs text-left">
                            <thead className={`uppercase font-black tracking-wider ${
                                theme === 'light' ? 'bg-slate-100 text-slate-900 border-b border-slate-300' : 
                                theme === 'sepia' ? 'bg-[#ebe3cf] text-[#423328] border-b border-[#dcd2ba]' : 
                                'bg-slate-800 text-slate-100 border-b border-white/5'
                            }`}>
                                <tr>
                                    {headers.map((h, i) => <th key={i} className="px-4 py-3">{formatInline(h)}</th>)}
                                </tr>
                            </thead>
                            <tbody className={`divide-y ${theme === 'light' ? 'divide-slate-200 text-slate-950' : 'divide-slate-100/10'}`}>
                                {bodyRows.map((row, rI) => (
                                    <tr key={rI} className={`${theme === 'light' ? 'hover:bg-slate-50' : 'hover:bg-black/5'} transition-colors`}>
                                        {row.map((cell, cI) => <td key={cI} className={`px-4 py-3 align-top leading-relaxed font-medium ${theme === 'light' ? 'text-slate-900' : ''}`}>{formatInline(cell)}</td>)}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            }
            tableBuffer = [];
        };

        lines.forEach((line, lineIdx) => {
            const trimmed = line.trim();
            if (trimmed.startsWith('|')) {
                tableBuffer.push(trimmed);
            } else {
                if (tableBuffer.length > 0) processTableBuffer();
                if (!trimmed) return;
                
                if (line.startsWith('# ')) {
                    renderedElements.push(<h1 key={`${index}-${lineIdx}`} className={`font-black mt-6 mb-3 pb-1 uppercase tracking-tight border-b ${compact ? 'text-lg' : 'text-3xl'} ${theme === 'light' ? 'border-slate-100 text-slate-950' : theme === 'sepia' ? 'border-[#dcd2ba] text-[#423328]' : 'border-white/5 text-white'}`}>{formatInline(line.substring(2))}</h1>);
                } else if (line.startsWith('## ')) {
                    renderedElements.push(<h2 key={`${index}-${lineIdx}`} className={`font-black mt-4 mb-2 uppercase tracking-wide ${compact ? 'text-base' : 'text-xl'} ${theme === 'sepia' ? 'text-[#5b4636]' : theme === 'light' ? 'text-indigo-950' : 'text-indigo-100'}`}>{formatInline(line.substring(3))}</h2>);
                } else if (line.startsWith('### ')) {
                    renderedElements.push(<h3 key={`${index}-${lineIdx}`} className={`font-bold mt-3 mb-2 ${compact ? 'text-sm' : 'text-lg'} ${theme === 'sepia' ? 'text-[#6d5644]' : theme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>{formatInline(line.substring(4))}</h3>);
                } else if (trimmed.startsWith('- ')) {
                    renderedElements.push(<li key={`${index}-${lineIdx}`} className="ml-4 list-disc my-1 pl-1 text-sm leading-relaxed">{formatInline(trimmed.substring(2))}</li>);
                } else {
                    // Fix: Suppress Tailwind's fixed font size classes if a custom fontSize prop is provided
                    const textSizeClass = fontSize ? '' : (compact ? 'text-sm' : 'text-base');
                    renderedElements.push(<p key={`${index}-${lineIdx}`} className={`leading-relaxed antialiased font-medium ${compact ? 'mb-2' : 'mb-4'} ${textSizeClass} ${THEME_CONFIG[theme].textColor}`}>{formatInline(line)}</p>);
                }
            }
        });
        if (tableBuffer.length > 0) processTableBuffer();
        return <React.Fragment key={index}>{renderedElements}</React.Fragment>;
      }
    });
  };

  const config = THEME_CONFIG[theme];

  return (
    <div className={`relative rounded-xl transition-all duration-300 ${compact ? 'bg-transparent' : config.container}`} style={fontSize ? { fontSize: `${fontSize}px` } : undefined}>
        {showThemeSwitcher && !compact && (
            <div className="absolute top-3 right-3 z-20 flex gap-1 p-1 bg-black/10 backdrop-blur-md rounded-full border border-white/10 group-hover:opacity-100 transition-opacity">
                {(Object.keys(THEME_CONFIG) as ReaderTheme[]).map(t => {
                    const TIcon = THEME_CONFIG[t].icon;
                    return (
                        <button 
                            key={t}
                            onClick={() => setTheme(t)}
                            className={`p-1.5 rounded-full transition-all ${theme === t ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-white/10 text-slate-500 hover:text-white'}`}
                            title={THEME_CONFIG[t].label}
                        >
                            <TIcon size={12} />
                        </button>
                    );
                })}
            </div>
        )}
        <div className={`markdown-view ${compact ? 'p-0' : 'p-6 md:p-10'} prose max-w-none antialiased ${config.prose}`}>
            {renderContent(content)}
        </div>
    </div>
  );
};
