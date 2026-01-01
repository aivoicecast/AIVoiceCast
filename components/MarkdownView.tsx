import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check, Image as ImageIcon, Loader2, Code as CodeIcon, ExternalLink, Sigma } from 'lucide-react';
import { encodePlantUML } from '../utils/plantuml';

interface MarkdownViewProps {
  content: string;
}

const LatexRenderer: React.FC<{ tex: string }> = ({ tex }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (containerRef.current && (window as any).katex) {
            try {
                (window as any).katex.render(tex, containerRef.current, {
                    throwOnError: false,
                    displayMode: true
                });
            } catch (err) {
                console.error("KaTeX error:", err);
            }
        }
    }, [tex]);

    return (
        <div className="my-6 p-6 bg-slate-100/50 rounded-xl border border-slate-200 flex justify-center items-center overflow-x-auto shadow-inner">
            <div ref={containerRef} className="text-indigo-900 text-lg"></div>
        </div>
    );
};

const PlantUMLRenderer: React.FC<{ code: string }> = ({ code }) => {
    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [showCode, setShowCode] = useState(false);
    const [copied, setCopied] = useState(false);

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
        <div className="my-6 border border-slate-200 rounded-xl overflow-hidden bg-slate-50 shadow-lg group">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-100 border-b border-slate-200">
                <div className="flex items-center gap-2">
                    <ImageIcon size={14} className="text-pink-600" />
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">System Diagram</span>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setShowCode(!showCode)}
                        className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition-colors"
                    >
                        {showCode ? <ImageIcon size={12}/> : <CodeIcon size={12}/>}
                        {showCode ? 'View Diagram' : 'View Source'}
                    </button>
                    <button 
                        onClick={handleCopyUrl}
                        className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition-colors"
                    >
                        {copied ? <Check size={12} className="text-emerald-600"/> : <ExternalLink size={12}/>}
                        {copied ? 'Copied' : 'Copy SVG'}
                    </button>
                </div>
            </div>

            <div className="p-6 bg-white flex justify-center min-h-[100px] relative">
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
                        className="max-w-full h-auto py-4 transition-transform duration-500 hover:scale-[1.01]"
                        onLoad={() => setLoading(false)}
                    />
                ) : !loading && (
                    <div className="p-8 text-slate-400 text-sm italic">Failed to load diagram.</div>
                )}
            </div>
        </div>
    );
};

export const MarkdownView: React.FC<MarkdownViewProps> = ({ content }) => {
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const formatInline = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|\$.*?\$)/g);
    return parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**')) {
            return <strong key={i} className="text-slate-950 font-black">{p.slice(2, -2)}</strong>;
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
        const content = part.replace(/^```\w*\n?/, '').replace(/```$/, '');
        const langMatch = part.match(/^```(\w+)/);
        const language = langMatch ? langMatch[1].toLowerCase() : 'code';
        
        if (language === 'plantuml' || language === 'puml') {
            return <PlantUMLRenderer key={index} code={content} />;
        }

        return (
          <div key={index} className="my-4 rounded-xl overflow-hidden border border-slate-200 bg-slate-900 shadow-sm">
             <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
               <span className="text-[10px] font-black font-mono text-slate-400 uppercase tracking-widest">{language}</span>
               <button 
                 onClick={() => handleCopy(content, index)} 
                 className="flex items-center space-x-1 text-[10px] font-bold text-slate-500 hover:text-indigo-400 transition-colors"
               >
                 {copiedIndex === index ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                 <span>{copiedIndex === index ? 'Copied' : 'Copy'}</span>
               </button>
             </div>
             <pre className="p-4 text-xs font-mono text-indigo-100 overflow-x-auto whitespace-pre-wrap">{content}</pre>
          </div>
        );
      } else if (part.startsWith('$$')) {
          const tex = part.slice(2, -2).trim();
          return <LatexRenderer key={index} tex={tex} />;
      } else {
        const lines = part.split('\n');
        const renderedElements: React.ReactNode[] = [];
        let tableBuffer: string[] = [];

        const processTableBuffer = () => {
            if (tableBuffer.length < 2) {
                tableBuffer.forEach((line, i) => {
                    renderedElements.push(<p key={`tbl-fail-${index}-${renderedElements.length}-${i}`} className="mb-4 text-slate-700">{formatInline(line)}</p>);
                });
            } else {
                const headers = tableBuffer[0].split('|').filter(c => c.trim() !== '').map(c => c.trim());
                const bodyRows = tableBuffer.slice(2).map(row => row.split('|').filter(c => c.trim() !== '').map(c => c.trim()));
                renderedElements.push(
                    <div key={`tbl-${index}-${renderedElements.length}`} className="overflow-x-auto my-6 border-2 border-slate-200 rounded-xl shadow-sm">
                        <table className="min-w-full text-xs text-left text-slate-800">
                            <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-500 tracking-wider">
                                <tr>
                                    {headers.map((h, i) => <th key={i} className="px-6 py-4 border-b-2 border-slate-200">{formatInline(h)}</th>)}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {bodyRows.map((row, rI) => (
                                    <tr key={rI} className="hover:bg-slate-50 transition-colors">
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
                if (!trimmed) { renderedElements.push(<div key={`${index}-${lineIdx}`} className="h-2" />); return; }
                if (line.startsWith('# ')) {
                    renderedElements.push(<h1 key={`${index}-${lineIdx}`} className="text-3xl font-black text-slate-950 mt-10 mb-4 border-b-2 border-slate-100 pb-2 uppercase tracking-tight">{formatInline(line.substring(2))}</h1>);
                } else if (line.startsWith('## ')) {
                    renderedElements.push(<h2 key={`${index}-${lineIdx}`} className="text-xl font-black text-indigo-900 mt-8 mb-3 uppercase tracking-wide">{formatInline(line.substring(3))}</h2>);
                } else if (line.startsWith('### ')) {
                    renderedElements.push(<h3 key={`${index}-${lineIdx}`} className="text-lg font-bold text-slate-800 mt-6 mb-2">{formatInline(line.substring(4))}</h3>);
                } else if (trimmed.startsWith('- ')) {
                    renderedElements.push(<li key={`${index}-${lineIdx}`} className="ml-4 list-disc text-slate-700 my-2 pl-2 marker:text-indigo-600 text-sm leading-relaxed">{formatInline(trimmed.substring(2))}</li>);
                } else {
                    renderedElements.push(<p key={`${index}-${lineIdx}`} className="mb-4 text-slate-700 leading-relaxed text-sm antialiased">{formatInline(line)}</p>);
                }
            }
        });
        if (tableBuffer.length > 0) processTableBuffer();
        return <React.Fragment key={index}>{renderedElements}</React.Fragment>;
      }
    });
  };

  return <div className="markdown-view font-sans">{renderContent(content)}</div>;
};