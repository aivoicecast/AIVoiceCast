
import React, { useState, useRef, useMemo } from 'react';
import { 
  ArrowLeft, BookText, Download, Loader2, BookOpen, 
  ChevronLeft, ChevronRight, FileDown, ShieldCheck, 
  Sparkles, CheckCircle, RefreshCw, Layers, Printer, X, Barcode, QrCode,
  Palette, Type, AlignLeft, Hash, Fingerprint, Activity, Terminal, Shield, Check
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { NEURAL_PRISM_BOOK, BookPage } from '../utils/bookContent';
import { MarkdownView } from './MarkdownView';
import { CHINESE_FONT_STACK, SERIF_FONT_STACK } from './PodcastDetail';
import { generateSecureId } from '../utils/idUtils';
import { BookStyle } from '../types';

interface BookStudioProps {
  onBack: () => void;
}

const STYLE_CONFIGS: Record<BookStyle, { 
    label: string, 
    desc: string, 
    font: string, 
    coverBg: string, 
    accent: string,
    border: string 
}> = {
    brutalist: { 
        label: 'Technical Brutalist', 
        desc: 'High contrast, bold mono lines.',
        font: 'font-mono-tech', 
        coverBg: 'bg-black', 
        accent: 'bg-indigo-600',
        border: 'border-white border-8' 
    },
    academic: { 
        label: 'Academic Classic', 
        desc: 'Traditional serif typography.',
        font: 'font-serif', 
        coverBg: 'bg-[#1e293b]', 
        accent: 'bg-amber-600',
        border: 'border-indigo-500/20 border-2'
    },
    minimal: { 
        label: 'Minimalist Modern', 
        desc: 'Clean sans-serif, wide margins.',
        font: 'font-sans', 
        coverBg: 'bg-slate-50', 
        accent: 'bg-emerald-500',
        border: 'border-slate-200 border'
    }
};

export const BookStudio: React.FC<BookStudioProps> = ({ onBack }) => {
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const [currentStyle, setCurrentStyle] = useState<BookStyle>('academic');
  const [synthesisSteps, setSynthesisSteps] = useState<string[]>([]);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  const style = STYLE_CONFIGS[currentStyle];

  const handleExportPDF = async () => {
    setIsExporting(true);
    setSynthesisSteps([]);
    const addStep = (msg: string) => setSynthesisSteps(prev => [...prev, msg].slice(-4));

    addStep("Initializing High-DPI Matrix...");
    setExportStatus("Initializing Multi-Page Slicing...");
    
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const sliceOverlap = 2; 

      const captureContainer = document.createElement('div');
      captureContainer.style.width = '800px'; 
      captureContainer.style.position = 'fixed';
      captureContainer.style.left = '-10000px';
      captureContainer.style.top = '0';
      captureContainer.style.backgroundColor = currentStyle === 'minimal' ? '#ffffff' : '#f8fafc';
      captureContainer.style.color = '#0f172a';
      document.body.appendChild(captureContainer);

      const sessionHash = generateSecureId().substring(0, 12).toUpperCase();

      for (let i = 0; i < NEURAL_PRISM_BOOK.pages.length; i++) {
          const page = NEURAL_PRISM_BOOK.pages[i];
          addStep(`Rasterizing Section ${i + 1}: ${page.title.substring(0, 15)}...`);
          setExportStatus(`Refracting Section ${i + 1}/${NEURAL_PRISM_BOOK.pages.length}...`);

          captureContainer.innerHTML = `
            <div style="padding: 80px; font-family: ${currentStyle === 'academic' ? SERIF_FONT_STACK : (currentStyle === 'brutalist' ? 'monospace' : 'sans-serif')};">
                <div style="display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 2px solid ${style.accent.includes('indigo') ? '#e0e7ff' : '#f1f5f9'}; padding-bottom: 10px;">
                    <span style="font-size: 10px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 0.2em;">${NEURAL_PRISM_BOOK.title} // REF_NODE_0${i+1}</span>
                    <span style="font-size: 10px; font-weight: 900; color: #94a3b8;">${style.label.toUpperCase()}</span>
                </div>
                <h1 style="font-size: 32px; font-weight: 900; color: #1e293b; margin-bottom: 30px; text-transform: uppercase; letter-spacing: -0.02em;">${page.title}</h1>
                <div style="font-size: 16px; line-height: 1.8; color: #334155;">
                    ${page.content.split('\n').map(line => {
                        if (line.startsWith('# ')) return `<h2 style="font-size: 26px; margin-top: 30px; color: #000; border-left: 5px solid #6366f1; padding-left: 15px;">${line.substring(2)}</h2>`;
                        if (line.startsWith('## ')) return `<h3 style="font-size: 22px; margin-top: 25px; color: #1e293b;">${line.substring(3)}</h3>`;
                        if (line.startsWith('### ')) return `<h4 style="font-size: 18px; margin-top: 20px; color: #475569;">${line.substring(4)}</h4>`;
                        if (line.trim() === '') return '<div style="height: 15px;"></div>';
                        return `<p style="margin-bottom: 18px;">${line}</p>`;
                    }).join('')}
                </div>
                
                <div style="margin-top: 60px; padding: 25px; border: 2px dashed #cbd5e1; border-radius: 20px; text-align: center; background: #fdfbf7;">
                    <p style="font-size: 10px; font-weight: 900; color: #94a3b8; letter-spacing: 0.5em; margin: 0;">
                        NEURAL INTEGRITY VERIFIED // TRACE: ${sessionHash}
                    </p>
                </div>
            </div>
          `;

          const canvas = await html2canvas(captureContainer, {
              scale: 3.5, 
              useCORS: true,
              backgroundColor: currentStyle === 'minimal' ? '#ffffff' : '#f8fafc'
          });

          const imgData = canvas.toDataURL('image/jpeg', 0.92);
          const imgWidth = pageWidth;
          const imgHeight = (canvas.height * pageWidth) / canvas.width;
          
          let heightLeft = imgHeight;
          let position = 0;

          if (i > 0) pdf.addPage();
          
          while (heightLeft > 0) {
              pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
              heightLeft -= pageHeight;
              position -= pageHeight - sliceOverlap;
              if (heightLeft > 0) pdf.addPage();
          }
      }

      addStep("Binding Verification Seals...");
      pdf.addPage();
      const timestamp = new Date().toLocaleString();
      const barcodeUrl = `https://barcodeapi.org/api/128/NP-${sessionHash}`;

      captureContainer.innerHTML = `
        <div style="width: 800px; height: 1131px; background-color: #020617; color: #ffffff; font-family: ${CHINESE_FONT_STACK}; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; position: relative;">
            <div style="position: absolute; top: -100px; right: -100px; width: 400px; height: 400px; background: radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, transparent 70%);"></div>
            
            <div style="z-index: 10; padding: 120px 100px;">
                <div style="width: 60px; height: 6px; background: #6366f1; margin-bottom: 30px; border-radius: 3px;"></div>
                <h2 style="font-size: 42px; font-weight: 900; letter-spacing: -0.03em; text-transform: uppercase; italic: true;">Neural Artifact</h2>
                <p style="font-size: 20px; color: #94a3b8; max-width: 550px; line-height: 1.8; margin-top: 30px;">
                    This document is a sovereign technical refraction. 
                    Generated by the ${style.label} engine of the Neural Prism.
                </p>
            </div>

            <div style="z-index: 10; padding: 80px 100px; background-color: #ffffff; color: #020617; display: flex; justify-content: space-between; align-items: flex-end;">
                <div>
                    <p style="font-size: 14px; font-weight: 900; color: #6366f1; text-transform: uppercase; letter-spacing: 0.3em; margin-bottom: 15px;">Official Registry</p>
                    <p style="font-size: 22px; font-weight: 900; margin: 0;">NEURAL PRISM PUBLISHING</p>
                    <p style="font-size: 14px; font-weight: 700; color: #64748b; margin-top: 5px; font-mono: true;">REF_ID: ${sessionHash}</p>
                    <p style="font-size: 12px; font-weight: 600; color: #94a3b8; margin-top: 20px;">BEYOND LLM // ACTIVITY CENTRIC INTERFACE</p>
                </div>
                <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
                    <img src="${barcodeUrl}" style="height: 70px; margin-bottom: 15px;" />
                    <p style="font-size: 12px; font-weight: bold; color: #000; letter-spacing: 0.2em;">VERIFIED BINDING</p>
                </div>
            </div>
        </div>
      `;

      const backCanvas = await html2canvas(captureContainer, { scale: 3.5, useCORS: true });
      pdf.addImage(backCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageWidth, pageHeight);

      document.body.removeChild(captureContainer);
      pdf.save(`${NEURAL_PRISM_BOOK.title.replace(/\s+/g, '_')}_${currentStyle}.pdf`);
      setExportStatus("Export Complete");
      addStep("Handshake finalized. PDF Dispatched.");
      setTimeout(() => { setExportStatus(""); setSynthesisSteps([]); }, 5000);
      
    } catch (e: any) {
      console.error("PDF Export failed", e);
      setExportStatus(`Synthesis Failed`);
      addStep(`ERROR: ${e.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-50">
          <div className="flex items-center gap-4">
              <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                  <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-lg font-bold text-white flex items-center gap-2 italic uppercase tracking-tighter">
                    <BookText className="text-indigo-400" /> 
                    Author Studio
                </h1>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Protocol v6.2.0 • Symbol Integrity Engine</p>
              </div>
          </div>
          <div className="flex items-center gap-3">
              <button 
                onClick={handleExportPDF} 
                disabled={isExporting}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-2xl transition-all active:scale-95 disabled:opacity-50"
              >
                  {isExporting ? <Loader2 size={16} className="animate-spin"/> : <FileDown size={16}/>}
                  <span>Synthesize Full Book</span>
              </button>
          </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
          {/* Controls Sidebar */}
          <div className="w-80 border-r border-slate-800 bg-slate-900/30 flex flex-col shrink-0 overflow-y-auto p-6 space-y-10 scrollbar-hide">
              
              <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Refractive Style</label>
                  <div className="grid grid-cols-1 gap-2">
                      {(Object.keys(STYLE_CONFIGS) as BookStyle[]).map(s => (
                          <button 
                            key={s} 
                            onClick={() => setCurrentStyle(s)}
                            className={`p-4 rounded-2xl text-left border transition-all flex flex-col gap-1 ${currentStyle === s ? 'bg-indigo-600 border-indigo-500 text-white shadow-xl scale-[1.02]' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600'}`}
                          >
                              <span className="text-xs font-black uppercase tracking-wider">{STYLE_CONFIGS[s].label}</span>
                              <span className="text-[9px] font-medium opacity-60 leading-relaxed">{STYLE_CONFIGS[s].desc}</span>
                          </button>
                      ))}
                  </div>
              </div>

              <div className="space-y-4">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] px-1">Manuscript Sections</h3>
                  <div className="space-y-1">
                      {NEURAL_PRISM_BOOK.pages.map((page, idx) => (
                          <button 
                            key={idx}
                            onClick={() => setActivePageIndex(idx)}
                            className={`w-full text-left px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${activePageIndex === idx ? 'bg-slate-800 border-indigo-500 text-indigo-300' : 'border-transparent text-slate-600 hover:text-slate-300'}`}
                          >
                              <span className="opacity-30 mr-2">0{idx + 1}</span>
                              {page.title.split('. ')[1] || page.title}
                          </button>
                      ))}
                  </div>
              </div>

              {/* Real-time Synthesis Log */}
              {isExporting && (
                  <div className="pt-6 border-t border-slate-800 space-y-4 animate-fade-in">
                      <div className="flex items-center gap-3">
                          <Activity size={18} className="text-indigo-400 animate-pulse"/>
                          <span className="text-[10px] font-black text-white uppercase tracking-widest">Synthesis Pipeline</span>
                      </div>
                      <div className="bg-black/60 rounded-xl p-4 border border-indigo-500/20 font-mono text-[9px] space-y-2 h-40 overflow-hidden shadow-inner">
                          {synthesisSteps.map((step, i) => (
                              <div key={i} className="flex gap-2 text-indigo-300/80">
                                  <span className="text-indigo-500">></span>
                                  <span className="animate-fade-in">{step}</span>
                              </div>
                          ))}
                          <div className="flex gap-2">
                              <span className="text-indigo-500 animate-pulse">_</span>
                          </div>
                      </div>
                  </div>
              )}

              {!isExporting && (
                  <div className="pt-8 border-t border-slate-800 space-y-4">
                      <div className="p-4 bg-emerald-900/10 border border-emerald-500/20 rounded-2xl">
                          <div className="flex items-center gap-2 text-emerald-400 mb-2">
                              <ShieldCheck size={14}/>
                              <span className="text-[10px] font-black uppercase tracking-widest">A4 Certified</span>
                          </div>
                          <p className="text-[9px] text-slate-500 leading-relaxed uppercase font-black">
                              Symbol-Flow Integrity ensures 100% preservation of math glyphs and architecture diagrams.
                          </p>
                      </div>
                  </div>
              )}
          </div>

          {/* Book Preview Area */}
          <div className="flex-1 bg-[#1e293b] flex flex-col items-center justify-start overflow-y-auto p-12 lg:p-20 relative scrollbar-thin scrollbar-thumb-slate-600">
              
              <div className="relative group">
                  {/* Spine Effect */}
                  <div className="absolute -left-12 top-2 bottom-2 w-12 bg-slate-900 rounded-l-3xl shadow-2xl z-0 transform translate-x-4"></div>
                  
                  <div className={`max-w-[800px] w-full ${style.coverBg} shadow-[0_50px_100px_-20px_rgba(0,0,0,0.4)] rounded-lg min-h-[1131px] p-24 flex flex-col ${style.border} animate-fade-in relative z-10 transition-all duration-700`}>
                      
                      <div className="absolute top-10 right-10 flex flex-col items-end opacity-20">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Registry Page</span>
                          <span className="text-4xl font-black text-slate-900">0{activePageIndex + 1}</span>
                      </div>

                      <div className={`prose prose-lg max-w-none prose-headings:text-slate-900 prose-p:text-slate-800 ${style.font} leading-relaxed antialiased`}>
                          <MarkdownView content={NEURAL_PRISM_BOOK.pages[activePageIndex].content} initialTheme="light" showThemeSwitcher={false} />
                          
                          <div className="mt-20 py-10 border-2 border-dashed border-slate-100 rounded-3xl text-center bg-slate-50/50">
                              <div className="flex flex-col items-center gap-4">
                                  <QrCode size={48} className="text-slate-200" />
                                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em] m-0">
                                      [ END OF SECTION ]
                                  </p>
                              </div>
                          </div>
                      </div>

                      <div className="mt-auto pt-10 border-t border-slate-100 flex justify-between items-center opacity-60">
                          <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-lg">NP</div>
                              <div className="flex flex-col">
                                  <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{NEURAL_PRISM_BOOK.title}</span>
                                  <span className="text-[8px] font-bold text-slate-400 uppercase">{NEURAL_PRISM_BOOK.version}</span>
                              </div>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-slate-300 tracking-tighter">NEURAL_TRACE_NODE_${activePageIndex + 1}</span>
                      </div>
                  </div>
              </div>

              {/* Navigation HUD */}
              <div className="fixed bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-6 p-4 bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/20 rounded-[2.5rem] shadow-2xl z-50">
                  <button 
                    onClick={() => setActivePageIndex(p => Math.max(0, p - 1))}
                    disabled={activePageIndex === 0}
                    className="p-3 bg-slate-800 hover:bg-indigo-600 text-white rounded-full disabled:opacity-20 transition-all active:scale-95 shadow-lg"
                  >
                      <ChevronLeft size={24}/>
                  </button>
                  
                  <div className="flex flex-col items-center min-w-[180px]">
                      <div className="flex items-center gap-2 mb-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                          <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Typesetting Node</span>
                      </div>
                      <p className="text-sm font-black text-white italic tracking-tight">{NEURAL_PRISM_BOOK.pages[activePageIndex].title.substring(0, 20)}...</p>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">{activePageIndex + 1} OF {NEURAL_PRISM_BOOK.pages.length} SECTIONS</p>
                  </div>

                  <button 
                    onClick={() => setActivePageIndex(p => Math.min(NEURAL_PRISM_BOOK.pages.length - 1, p + 1))}
                    disabled={activePageIndex === NEURAL_PRISM_BOOK.pages.length - 1}
                    className="p-3 bg-slate-800 hover:bg-indigo-600 text-white rounded-full disabled:opacity-20 transition-all active:scale-95 shadow-lg"
                  >
                      <ChevronRight size={24}/>
                  </button>
              </div>
          </div>
      </div>
    </div>
  );
};

export default BookStudio;
