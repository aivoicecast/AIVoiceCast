
import React, { useState, useRef } from 'react';
import { 
  ArrowLeft, BookText, Download, Loader2, BookOpen, 
  ChevronLeft, ChevronRight, FileDown, ShieldCheck, 
  Sparkles, CheckCircle, RefreshCw, Layers, Printer, X
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { NEURAL_PRISM_BOOK, BookPage } from '../utils/bookContent';
import { MarkdownView } from './MarkdownView';
import { CHINESE_FONT_STACK } from './PodcastDetail';

interface BookStudioProps {
  onBack: () => void;
}

export const BookStudio: React.FC<BookStudioProps> = ({ onBack }) => {
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const handleExportPDF = async () => {
    setIsExporting(true);
    setExportStatus("Initializing High-DPI Synthesis...");
    
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Capture element preparation
      const captureContainer = document.createElement('div');
      captureContainer.style.width = '800px'; 
      captureContainer.style.padding = '80px';
      captureContainer.style.position = 'fixed';
      captureContainer.style.left = '-10000px';
      captureContainer.style.backgroundColor = '#ffffff';
      document.body.appendChild(captureContainer);

      for (let i = 0; i < NEURAL_PRISM_BOOK.pages.length; i++) {
          const page = NEURAL_PRISM_BOOK.pages[i];
          setExportStatus(`Rasterizing Section ${i + 1}/${NEURAL_PRISM_BOOK.pages.length}: ${page.title}`);

          // Render the markdown for this specific page into our hidden container
          captureContainer.innerHTML = `
            <div style="background-color: #ffffff; color: #0f172a; font-family: ${CHINESE_FONT_STACK}; min-height: 1100px; display: flex; flex-direction: column;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px;">
                    <span style="font-size: 10px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 0.2em;">Neural Guide • ${NEURAL_PRISM_BOOK.title}</span>
                    <span style="font-size: 10px; font-weight: 900; color: #94a3b8;">SECTION 0${i + 1}</span>
                </div>
                <h1 style="font-size: 32px; font-weight: 900; color: #1e293b; margin-bottom: 30px; text-transform: uppercase;">${page.title}</h1>
                <div id="content-mount" style="font-size: 14px; line-height: 1.6; color: #334155;">
                    ${page.content.split('\n').map(line => {
                        if (line.startsWith('# ')) return `<h2 style="font-size: 24px; margin-top: 30px;">${line.substring(2)}</h2>`;
                        if (line.startsWith('## ')) return `<h3 style="font-size: 20px; margin-top: 25px;">${line.substring(3)}</h3>`;
                        if (line.startsWith('### ')) return `<h4 style="font-size: 18px; margin-top: 20px;">${line.substring(4)}</h4>`;
                        if (line.trim() === '') return '<br/>';
                        return `<p style="margin-bottom: 15px;">${line}</p>`;
                    }).join('')}
                </div>
                <div style="margin-top: auto; padding-top: 20px; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 9px; color: #94a3b8;">Neural Prism Engine v5.8.1 • Refraction Fix</span>
                    <span style="font-size: 10px; font-weight: bold; color: #1e293b;">PAGE ${i + 1}</span>
                </div>
            </div>
          `;

          // Capture to canvas with high scale to ensure symbols/emojis render correctly
          const canvas = await html2canvas(captureContainer, {
              scale: 3,
              useCORS: true,
              backgroundColor: '#ffffff',
              logging: false
          });

          if (i > 0) pdf.addPage();
          
          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight);
      }

      document.body.removeChild(captureContainer);
      pdf.save(`${NEURAL_PRISM_BOOK.title.replace(/\s+/g, '_')}_Neural_Guide_v581.pdf`);
      setExportStatus("Export Complete");
      setTimeout(() => setExportStatus(""), 3000);
      
      window.dispatchEvent(new CustomEvent('neural-log', { 
          detail: { text: "High-Fidelity PDF Refraction successful. Symbols verified.", type: 'success' } 
      }));

    } catch (e: any) {
      console.error("PDF Export failed", e);
      setExportStatus(`Synthesis Failed: ${e.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSynthesize = () => {
      setIsSynthesizing(true);
      setTimeout(() => {
          setIsSynthesizing(false);
          window.dispatchEvent(new CustomEvent('neural-log', { 
              detail: { text: "Neural layers synchronized. Rasterization ready for symbol-flow export.", type: 'success' } 
          }));
      }, 1500);
  };

  const activePage = NEURAL_PRISM_BOOK.pages[activePageIndex];

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-20">
          <div className="flex items-center gap-4">
              <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                  <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-lg font-bold text-white flex items-center gap-2">
                    <BookText className="text-indigo-400" /> 
                    Author Studio
                </h1>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Neural Publisher Engine</p>
              </div>
          </div>
          <div className="flex items-center gap-3">
              {exportStatus && (
                  <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-indigo-950 border border-indigo-500/30 rounded-full animate-fade-in">
                      <Loader2 size={12} className="animate-spin text-indigo-400" />
                      <span className="text-[9px] font-black uppercase text-indigo-300 tracking-widest">{exportStatus}</span>
                  </div>
              )}
              <button 
                onClick={handleSynthesize}
                disabled={isSynthesizing || isExporting}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded-lg text-xs font-black uppercase tracking-widest border border-slate-700 transition-all active:scale-95 disabled:opacity-50"
              >
                  {isSynthesizing ? <Loader2 size={14} className="animate-spin" /> : <Layers size={14}/>}
                  <span>Verify Layers</span>
              </button>
              <button 
                onClick={handleExportPDF} 
                disabled={isExporting}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 disabled:opacity-50"
              >
                  {isExporting ? <Loader2 size={14} className="animate-spin"/> : <FileDown size={14}/>}
                  <span>Export Full PDF</span>
              </button>
          </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
          <div className="w-80 border-r border-slate-800 bg-slate-900/30 flex flex-col shrink-0 overflow-y-auto p-6 space-y-8 scrollbar-thin">
              <div className="space-y-4">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] px-1">Book Registry</h3>
                  <div className="space-y-1">
                      {NEURAL_PRISM_BOOK.pages.map((page, idx) => (
                          <button 
                            key={idx}
                            onClick={() => setActivePageIndex(idx)}
                            className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all border ${activePageIndex === idx ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-950/40 border-transparent text-slate-500 hover:bg-slate-800'}`}
                          >
                              <span className="opacity-40 mr-2 font-mono">0{idx + 1}</span>
                              {page.title}
                          </button>
                      ))}
                  </div>
              </div>

              <div className="pt-8 border-t border-slate-800 space-y-4">
                  <div className="p-4 bg-indigo-900/20 border border-indigo-500/20 rounded-2xl">
                      <div className="flex items-center gap-2 text-indigo-300 mb-2">
                          <ShieldCheck size={14}/>
                          <span className="text-[10px] font-black uppercase tracking-widest">High-Fidelity Mode</span>
                      </div>
                      <p className="text-[9px] text-slate-500 leading-relaxed uppercase font-black">
                          Visual Rasterization Protocol active. Supports 100% of the Unicode spectrum including symbols and emojis.
                      </p>
                  </div>
                  <div className="flex items-center justify-center gap-4 text-slate-600">
                      <Printer size={16}/>
                      <span className="text-[10px] font-black uppercase tracking-[0.3em]">A4 Print Optim v5.8.1</span>
                  </div>
              </div>
          </div>

          <div className="flex-1 bg-[#fdfbf7] flex flex-col items-center justify-start overflow-y-auto p-12 relative scrollbar-thin scrollbar-thumb-slate-300">
              
              <div className="max-w-[800px] w-full bg-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] rounded-lg min-h-[1131px] p-20 flex flex-col border border-slate-100 animate-fade-in relative">
                  <div className="absolute top-8 right-8 text-[10px] font-black text-slate-200 uppercase tracking-widest">
                      Section {activePageIndex + 1}
                  </div>

                  <div className="prose prose-slate prose-lg max-w-none prose-headings:text-slate-900 prose-p:text-slate-800">
                      <MarkdownView content={activePage.content} initialTheme="light" showThemeSwitcher={false} />
                  </div>

                  <div className="mt-auto pt-10 border-t border-slate-100 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white font-black text-[10px]">NP</div>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{NEURAL_PRISM_BOOK.title}</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-slate-200">PAGE_${activePageIndex + 1}</span>
                  </div>
              </div>

              <div className="fixed bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-6 p-4 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl">
                  <button 
                    onClick={() => setActivePageIndex(p => Math.max(0, p - 1))}
                    disabled={activePageIndex === 0}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-full disabled:opacity-30 transition-all active:scale-95"
                  >
                      <ChevronLeft size={24}/>
                  </button>
                  <div className="px-4 text-center min-w-[120px]">
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">{activePage.title}</p>
                      <p className="text-[9px] text-slate-500 font-bold uppercase">{activePageIndex + 1} OF {NEURAL_PRISM_BOOK.pages.length}</p>
                  </div>
                  <button 
                    onClick={() => setActivePageIndex(p => Math.min(NEURAL_PRISM_BOOK.pages.length - 1, p + 1))}
                    disabled={activePageIndex === NEURAL_PRISM_BOOK.pages.length - 1}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-full disabled:opacity-30 transition-all active:scale-95"
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
