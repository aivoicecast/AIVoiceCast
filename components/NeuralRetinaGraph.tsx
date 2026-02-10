
import React, { useEffect, useRef, useState, useMemo } from 'react';
// Added Activity to imports to fix compilation error on line 152
import { Loader2, AlertCircle, Maximize2, RefreshCw, ZoomIn, ZoomOut, Download, Activity } from 'lucide-react';

export interface AuditNode {
  id: string;
  type: 'document' | 'claim' | 'verification' | 'evidence';
  label: string;
  status: 'PASS' | 'FAIL' | 'WARN';
}

export interface AuditEdge {
  source: string;
  target: string;
  label?: string;
}

export interface AuditData {
  audit_id: string;
  timestamp: string;
  nodes: AuditNode[];
  edges: AuditEdge[];
}

interface NeuralRetinaGraphProps {
  data: AuditData;
  className?: string;
}

/**
 * Neural Retina Graph:
 * A high-fidelity observability component that refracts structured JSON 
 * into verifiable logic meshes using Mermaid.js.
 */
export const NeuralRetinaGraph: React.FC<NeuralRetinaGraphProps> = ({ data, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [zoom, setZoom] = useState(1);

  // --- Programmatic Logic Refraction ---
  const jsonToMermaid = (audit: AuditData): string => {
    const sanitizeId = (id: string) => id.replace(/[^a-zA-Z0-9]/g, '_');
    const escapeLabel = (label: string) => {
      if (!label) return '';
      return label.replace(/"/g, "'").replace(/[\n\r]/g, ' ').trim();
    };

    let lines = ['graph TD'];

    // Node definitions with semantic shapes
    audit.nodes.forEach(node => {
      const id = sanitizeId(node.id);
      const label = escapeLabel(node.label);
      
      let open = '[', close = ']';
      if (node.type === 'claim') { open = '{{'; close = '}}'; }
      else if (node.type === 'verification') { open = '{'; close = '}'; }
      else if (node.type === 'evidence') { open = '[('; close = ')]'; }

      lines.push(`${id}${open}"${label}"${close}`);
      
      // Class assignment for styling
      lines.push(`class ${id} ${node.type}`);
      if (node.status) {
        lines.push(`class ${id} status_${node.status.toLowerCase()}`);
      }
    });

    // Edge definitions
    audit.edges.forEach(edge => {
      const src = sanitizeId(edge.source);
      const tgt = sanitizeId(edge.target);
      const label = edge.label ? `|"${escapeLabel(edge.label)}"` : '';
      lines.push(`${src} -->${label} ${tgt}`);
    });

    // Style Matrix (Refractive Specification)
    lines.push('  classDef document fill:#e1f5fe,stroke:#01579b,stroke-width:2px,color:#01579b');
    lines.push('  classDef claim fill:#fff9c4,stroke:#fbc02d,stroke-width:2px,color:#9a7b0d');
    lines.push('  classDef evidence fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px,color:#7b1fa2');
    
    // Status Overrides
    lines.push('  classDef status_pass fill:#e8f5e9,stroke:#2e7d32,stroke-width:3px,color:#1b5e20');
    lines.push('  classDef status_fail fill:#ffebee,stroke:#c62828,stroke-width:3px,color:#b71c1c');
    lines.push('  classDef status_warn fill:#fff3e0,stroke:#ef6c00,stroke-width:3px,color:#e65100');

    return lines.join('\n');
  };

  const mermaidCode = useMemo(() => jsonToMermaid(data), [data]);

  useEffect(() => {
    const renderDiagram = async () => {
      const mermaid = (window as any).mermaid;
      if (!mermaid) return;

      setIsRendering(true);
      setError(null);

      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: 'neutral',
          securityLevel: 'loose',
          flowchart: { useMaxWidth: false, htmlLabels: true }
        });

        const id = `retina-graph-${generateSecureId().substring(0, 8)}`;
        const { svg } = await mermaid.render(id, mermaidCode);
        setSvg(svg);
      } catch (err: any) {
        console.error("[RetinaGraph] Refraction Fault:", err);
        setError(err.message || "Logic synthesis breach.");
      } finally {
        setIsRendering(false);
      }
    };

    renderDiagram();
  }, [mermaidCode]);

  const handleDownloadSVG = () => {
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NeuralAudit_${data.audit_id.substring(0, 8)}.svg`;
      a.click();
      URL.revokeObjectURL(url);
  };

  if (error) {
    return (
      <div className={`p-8 bg-red-950/20 border border-red-500/30 rounded-[2.5rem] flex flex-col items-center gap-4 text-center ${className}`}>
        <AlertCircle className="text-red-500" size={48} />
        <div>
            <h3 className="text-lg font-black text-white uppercase italic">Logic Structure Breach</h3>
            <p className="text-xs text-slate-500 font-mono mt-2">{error}</p>
        </div>
        <div className="w-full bg-black/40 rounded-2xl p-4 overflow-x-auto text-left">
            <pre className="text-[10px] font-mono text-indigo-300 leading-relaxed">{mermaidCode}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative flex flex-col bg-slate-900 border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl transition-all ${className}`}>
      {/* Header UI */}
      <div className="p-5 border-b border-slate-800 bg-slate-950/40 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600/20 rounded-xl text-indigo-400">
                  <Activity size={18}/>
              </div>
              <div>
                  <h4 className="text-[11px] font-black text-white uppercase tracking-[0.2em]">Neural Retina Graph</h4>
                  <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">ID: {data.audit_id.substring(0, 16)}...</p>
              </div>
          </div>
          <div className="flex items-center gap-2">
              <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="p-2 text-slate-500 hover:text-white transition-colors"><ZoomOut size={16}/></button>
              <span className="text-[9px] font-mono font-bold text-slate-600 w-8 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-2 text-slate-500 hover:text-white transition-colors"><ZoomIn size={16}/></button>
              <div className="w-px h-4 bg-slate-800 mx-1"></div>
              <button onClick={handleDownloadSVG} className="p-2 text-slate-400 hover:text-indigo-400 transition-all"><Download size={16}/></button>
              <button onClick={() => setZoom(1)} className="p-2 text-slate-400 hover:text-white transition-all"><RefreshCw size={16}/></button>
          </div>
      </div>

      <div className="flex-1 relative overflow-hidden bg-white/5 shadow-inner flex items-center justify-center p-8">
          {isRendering ? (
              <div className="flex flex-col items-center gap-4 animate-pulse">
                  <Loader2 className="animate-spin text-indigo-500" size={32} />
                  <span className="text-[10px] font-black uppercase text-slate-600 tracking-widest">Rasterizing Logic Mesh...</span>
              </div>
          ) : (
              <div 
                className="transition-transform duration-300 ease-out cursor-grab active:cursor-grabbing"
                style={{ transform: `scale(${zoom})` }}
                dangerouslySetInnerHTML={{ __html: svg }}
              />
          )}
      </div>

      <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex justify-between items-center shrink-0">
          <div className="flex gap-4">
              <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-sky-400"></div><span className="text-[8px] font-black uppercase text-slate-500">Document</span></div>
              <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-yellow-400"></div><span className="text-[8px] font-black uppercase text-slate-500">Claim</span></div>
              <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div><span className="text-[8px] font-black uppercase text-slate-500">Verification</span></div>
              <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div><span className="text-[8px] font-black uppercase text-slate-500">Evidence</span></div>
          </div>
          <p className="text-[8px] font-black text-slate-700 uppercase tracking-[0.4em]">Sovereignty Verified // {new Date(data.timestamp).toLocaleTimeString()}</p>
      </div>
    </div>
  );
};

function generateSecureId(): string {
  const array = new Uint8Array(16);
  window.crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}
