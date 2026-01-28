
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Copy, Check, Image as ImageIcon, Loader2, Code as CodeIcon, ExternalLink, Sigma, Palette, Sun, Moon, Coffee } from 'lucide-react';
import { encodePlantUML } from '../utils/plantuml';
import { ReaderTheme } from '../types';

interface MarkdownViewProps {
  content: string;
  initialTheme?: ReaderTheme;
  showThemeSwitcher?: boolean;
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
        container: 'bg-white text-slate-900 border border-slate-200', 
        prose: 'prose-slate', 
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

const LatexRenderer: React.FC<{ tex: string, theme: ReaderTheme }> = ({ tex, theme }) => {
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
        <div className={`my-8 p-8 rounded-3xl border flex flex-col justify-center items-center overflow-x-auto shadow-2xl relative group/math ${
            theme === 'light' ? 'bg-slate-50 border-slate-200' : 
            theme === 'sepia' ? 'bg-[#ebe3cf] border-[#dcd2ba]' : 
            'bg-slate-900/50 border-white/10'
        }`}>
            <div className="absolute top-4 left-6 flex items-center gap-2 opacity-30 group-hover/math:opacity-100 transition-opacity">
                <Sigma size={12} className="text-indigo-500" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Neural Theorem</span>
            </div>
            <div ref={containerRef} className={`${theme === 'sepia' ? 'text-[#5b4636]' : theme === 'light' ? 'text-indigo-900' : 'text-indigo-300'} text-xl py-4`}></div>
            <div className="absolute bottom-4 right-6 w-8 h-1 bg-indigo-500/20 rounded-full"></div>
        </div>
    );
};

const PlantUMLRenderer: React.FC<{ code: string, theme: ReaderTheme }> = ({ code, theme }) => {
    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [showCode, setShowCode] = useState(false);
    const [copied, setCopied] = useState(false);
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

    const handleCopyUrl = () => {
        if (url) {
            navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className={`my-6 border rounded-xl overflow-hidden shadow-lg group ${
            theme === 'light' ? 'border-slate-200 bg-white' : 
            theme === 'sepia' ? 'border-[#dcd2ba] bg-[#f4ecd8]' : 
            'border-white/10 bg-slate-900'
        }`}>
            <div className={`flex items-center justify-between px-4 py-2 border-b ${
                theme === 'light' ? 'bg-slate-50 border-slate-200' : 
                theme === 'sepia' ? 'bg-[#ebe3cf] border-[#dcd2ba]' : 
                'bg-slate-800 border-white/5'
            }`}>
                <div className="flex items-center gap-2">
                    <ImageIcon size={14} className="text-pink-600" />
                    <span className={`text-[10px] font-black uppercase tracking-wider ${theme === 'sepia' ? 'text-[#8a7565]' : 'text-slate-500'}`}>System Diagram</span>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => setShowCode(!showCode)} className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition-colors">
                        {showCode ? <ImageIcon size={12}/> : <CodeIcon size={12}/>}
                        {showCode ? 'View Diagram' : 'View Source'}
                    </button>
                    <button onClick={handleCopyUrl} className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition-colors">
                        {copied ? <Check size={12} className="text-emerald-600"/> : <ExternalLink size={12}/>}
                        {copied ? 'Copied' : 'Copy SVG'}
                    </button>
                </div>
            </div>

            <div className="p-6 flex justify-center min-h-[100px] relative bg-white">
                {loading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10 text-slate-900 gap-2">
                        <Loader2 size={24} className="animate-spin text-indigo-600" />
                        <span className="text-[10px] font-bold uppercase">Rendering...</span>
                    </div>
                )}
                
                {showCode ? (
                    <pre className="w-full p-4 bg-slate-900 text-indigo-200 text-xs font-mono overflow-x-auto whitespace-pre rounded-lg">
                        {code}
                    </pre>
                ) : url ? (
                    <img 
                        src={url} 
                        alt="PlantUML Diagram" 
                        className={`max-w-full h-auto py-4 transition-transform duration-500 hover:scale-[1.01] ${isDark ? 'invert brightness-150' : ''}`}
                        onLoad={() => setLoading(false)}
                    />
                ) : !loading && (
                    <div className="p-8 text-slate-400 text-sm italic">Failed to load diagram.</div>
                )}
            </div>
        </div>
    );
};

export const MarkdownView: React.FC<MarkdownViewProps> = ({ content, initialTheme = 'slate', showThemeSwitcher = true }) => {
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
    const parts = text.split(/(\*\*.*?\*\*|\$.*?\$)/g);
    return parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**')) {
            return <strong key={i} className="font-black text-inherit opacity-100">{p.slice(2, -2)}</strong>;
        }
        if (p.startsWith('$') && p.endsWith('$')) {
            const math = p.slice(1, -1);
            return (
                <span key={i} className="inline-block px-1 font-serif italic text-indigo-700" dangerouslySetInnerHTML={{
                    __html: (window as any).katex ? (window as any).katex.renderToString(math, { throwOnError: false }) : math
                }} />
            );
        }
        return p;
    });
  };

  const renderContent = (text: string) => {
    const parts = text.split(/(```[\s\S]*?```|\$\$[\s\S]*?\$\$)/g);
    return parts.map((part, index) => {
      if (part.startsWith('```')) {
        const codeContent = part.replace(/^```\w*\n?/, '').replace(/```$/, '');
        const langMatch = part.match(/^```(\w+)/);
        const language = langMatch ? langMatch[1].toLowerCase() : 'code';
        
        if (language === 'plantuml' || language === 'puml') {
            return <PlantUMLRenderer key={index} code={codeContent} theme={theme} />;
        }

        return (
          <div key={index} className={`my-6 rounded-xl overflow-hidden border shadow-sm ${
              theme === 'light' ? 'border-slate-200 bg-slate-900' : 
              theme === 'sepia' ? 'border-[#dcd2ba] bg-[#3e342b]' : 
              'border-white/10 bg-black'
          }`}>
             <div className="flex items-center justify-between px-4 py-2 bg-slate-800/50 border-b border-white/5">
               <span className="text-[10px] font-black font-mono text-slate-400 uppercase tracking-widest">{language}</span>
               <button 
                 onClick={() => handleCopy(codeContent, index)} 
                 className="flex items-center space-x-1 text-[10px] font-bold text-slate-500 hover:text-indigo-400 transition-colors"
               >
                 {copiedIndex === index ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                 <span>{copiedIndex === index ? 'Copied' : 'Copy'}</span>
               </button>
             </div>
             <pre className="p-5 text-sm font-mono text-indigo-100 overflow-x-auto whitespace-pre leading-relaxed">{codeContent}</pre>
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
                    renderedElements.push(<p key={`tbl-fail-${index}-${renderedElements.length}-${i}`} className="mb-4">{formatInline(line)}</p>);
                });
            } else {
                const headers = tableBuffer[0].split('|').filter(c => c.trim() !== '').map(c => c.trim());
                const bodyRows = tableBuffer.slice(2).map(row => row.split('|').filter(c => c.trim() !== '').map(c => c.trim()));
                renderedElements.push(
                    <div key={`tbl-${index}-${renderedElements.length}`} className={`overflow-x-auto my-8 border-2 rounded-xl shadow-md ${
                        theme === 'light' ? 'border-slate-200 bg-white' : 
                        theme === 'sepia' ? 'border-[#dcd2ba] bg-[#f8f1e3]' : 
                        'border-white/10 bg-slate-900/40'
                    }`}>
                        <table className="min-w-full text-sm text-left">
                            <thead className={`text-[10px] uppercase font-black tracking-wider ${
                                theme === 'light' ? 'bg-slate-50 text-slate-500 border-b-2 border-slate-200' : 
                                theme === 'sepia' ? 'bg-[#ebe3cf] text-[#8a7565] border-b-2 border-[#dcd2ba]' : 
                                'bg-slate-800 text-slate-400 border-b-2 border-white/5'
                            }`}>
                                <tr>
                                    {headers.map((h, i) => <th key={i} className="px-6 py-4">{formatInline(h)}</th>)}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100/10">
                                {bodyRows.map((row, rI) => (
                                    <tr key={rI} className="hover:bg-black/5 transition-colors">
                                        {row.map((cell, cI) => <td key={cI} className="px-6 py-4 align-top leading-relaxed">{formatInline(cell)}</td>)}
                                        {Array.from({ length: Math.max(0, headers.length - row.length) }).map((_, i) => <td key={`empty-${i}`} className="px-6 py-4"></td>)}
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
                if (!trimmed) { renderedElements.push(<div key={`${index}-${lineIdx}`} className="h-4" />); return; }
                if (line.startsWith('# ')) {
                    renderedElements.push(<h1 key={`${index}-${lineIdx}`} className={`text-4xl font-black mt-12 mb-6 pb-2 uppercase tracking-tight border-b-2 ${theme === 'light' ? 'border-slate-100 text-slate-950' : theme === 'sepia' ? 'border-[#dcd2ba] text-[#423328]' : 'border-white/5 text-white'}`}>{formatInline(line.substring(2))}</h1>);
                } else if (line.startsWith('## ')) {
                    renderedElements.push(<h2 key={`${index}-${lineIdx}`} className={`text-2xl font-black mt-10 mb-4 uppercase tracking-wide ${theme === 'sepia' ? 'text-[#5b4636]' : theme === 'light' ? 'text-indigo-950' : 'text-indigo-100'}`}>{formatInline(line.substring(3))}</h2>);
                } else if (line.startsWith('### ')) {
                    renderedElements.push(<h3 key={`${index}-${lineIdx}`} className={`text-xl font-bold mt-8 mb-3 ${theme === 'sepia' ? 'text-[#6d5644]' : theme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>{formatInline(line.substring(4))}</h3>);
                } else if (trimmed.startsWith('- ')) {
                    renderedElements.push(<li key={`${index}-${lineIdx}`} className="ml-4 list-disc my-3 pl-2 marker:text-indigo-500 text-base leading-relaxed">{formatInline(trimmed.substring(2))}</li>);
                } else {
                    renderedElements.push(<p key={`${index}-${lineIdx}`} className={`mb-5 leading-relaxed text-lg antialiased ${THEME_CONFIG[theme].textColor}`}>{formatInline(line)}</p>);
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
    <div className={`relative rounded-2xl transition-all duration-300 ${config.container}`}>
        {showThemeSwitcher && (
            <div className="absolute top-4 right-4 z-20 flex gap-1 p-1 bg-black/10 backdrop-blur-md rounded-full border border-white/10 group-hover:opacity-100 transition-opacity">
                {(Object.keys(THEME_CONFIG) as ReaderTheme[]).map(t => {
                    const TIcon = THEME_CONFIG[t].icon;
                    return (
                        <button 
                            key={t}
                            onClick={() => setTheme(t)}
                            className={`p-2 rounded-full transition-all ${theme === t ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-white/10 text-slate-500 hover:text-white'}`}
                            title={THEME_CONFIG[t].label}
                        >
                            <TIcon size={14} />
                        </button>
                    );
                })}
            </div>
        )}
        <div className={`markdown-view p-8 md:p-12 prose max-w-none antialiased ${config.prose}`}>
            {renderContent(content)}
        </div>
    </div>
  );
};
