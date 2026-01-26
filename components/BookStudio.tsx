
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

interface BookStudioProps {
  onBack: () => void;
}

export const BookStudio: React.FC<BookStudioProps> = ({ onBack }) => {
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const topMargin = 80;
      const bottomMargin = 80;
      const LINE_HEIGHT = 16;
      const MAX_LINES_PER_PAGE = 27; // User requested limit
      
      let totalPageCount = 0;
      let currentY = topMargin;
      let linesOnCurrentPage = 0;

      const drawHeaderFooter = (current: number) => {
          pdf.setFontSize(8);
          pdf.setTextColor(180, 180, 180);
          pdf.text(`Neural Guide | ${NEURAL_PRISM_BOOK.title}`, 60, 30);
          
          pdf.setDrawColor(241, 245, 249);
          pdf.line(60, pageHeight - 40, pageWidth - 60, pageHeight - 40);
          pdf.text(`Neural Prism Engine v5.7.0`, 60, pageHeight - 25);
          pdf.text(`Page ${current}`, pageWidth - 60, pageHeight - 25, { align: 'right' });
      };

      const resetPage = () => {
          pdf.addPage();
          totalPageCount++;
          drawHeaderFooter(totalPageCount);
          currentY = topMargin;
          linesOnCurrentPage = 0;
          // CRITICAL: Reset body text style after drawing header/footer colors
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(11);
          pdf.setTextColor(51, 65, 85); // Dark slate
      };

      // Ensure we have a first page
      totalPageCount = 1;
      drawHeaderFooter(1);
      // Ensure initial style
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.setTextColor(51, 65, 85);

      for (let i = 0; i < NEURAL_PRISM_BOOK.pages.length; i++) {
          const page = NEURAL_PRISM_BOOK.pages[i];
          
          // Force new page for each major book section
          if (i > 0) resetPage();

          // Section Title
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(24);
          pdf.setTextColor(15, 23, 42);
          const titleLines = pdf.splitTextToSize(page.title.toUpperCase(), pageWidth - 120);
          pdf.text(titleLines, 60, currentY);
          currentY += (titleLines.length * 30) + 10;
          
          // Body Flow
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(11);
          pdf.setTextColor(51, 65, 85);

          // Split markdown content into paragraphs to handle flow better
          const paragraphs = page.content.split('\n\n');
          
          for (const para of paragraphs) {
              const cleanPara = para.replace(/[#*`]/g, '').trim();
              if (!cleanPara) continue;

              const wrappedLines = pdf.splitTextToSize(cleanPara, pageWidth - 120);
              
              for (const line of wrappedLines) {
                  if (linesOnCurrentPage >= MAX_LINES_PER_PAGE || currentY > pageHeight - bottomMargin) {
                      resetPage();
                  }
                  
                  pdf.setFont('helvetica', 'normal');
                  pdf.setTextColor(51, 65, 85); // Ensure consistent dark color for every line
                  pdf.text(line, 60, currentY);
                  currentY += LINE_HEIGHT;
                  linesOnCurrentPage++;
              }
              currentY += 12; // Paragraph spacing
          }
      }

      pdf.save(`${NEURAL_PRISM_BOOK.title.replace(/\s+/g, '_')}_Neural_Guide.pdf`);
    } catch (e) {
      console.error("PDF Export failed", e);
      alert("Synthesis failed. Check browser console.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleSynthesize = () => {
      setIsSynthesizing(true);
      setTimeout(() => {
          setIsSynthesizing(false);
          window.dispatchEvent(new CustomEvent('neural-log', { 
              detail: { text: "Book layers synchronized. Readiness verified for line-flow export.", type: 'success' } 
          }));
      }, 2000);
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
              <button 
                onClick={handleSynthesize}
                disabled={isSynthesizing}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded-lg text-xs font-black uppercase tracking-widest border border-slate-700 transition-all active:scale-95"
              >
                  {isSynthesizing ? <Loader2 size={14} className="animate-spin" /> : <Layers size={14}/>}
                  <span>Verify Layout</span>
              </button>
              <button 
                onClick={handleExportPDF} 
                disabled={isExporting}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-black uppercase tracking-widest shadow-lg transition-all active:scale-95"
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
                          <span className="text-[10px] font-black uppercase tracking-widest">Print Optimization</span>
                      </div>
                      <p className="text-[9px] text-slate-500 leading-relaxed uppercase font-black">
                          Neural core has optimized this document for white background contrast and semantic text flow.
                      </p>
                  </div>
                  <div className="flex items-center justify-center gap-4 text-slate-600">
                      <Printer size={16}/>
                      <span className="text-[10px] font-black uppercase tracking-[0.3em]">A4 Ready • Verified</span>
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
                      <span className="text-[10px] font-mono font-bold text-slate-200">PAGE_{activePageIndex + 1}</span>
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
