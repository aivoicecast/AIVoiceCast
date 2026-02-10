
import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, BookText, Download, Loader2, BookOpen, 
  ChevronLeft, ChevronRight, FileDown, ShieldCheck, 
  Sparkles, CheckCircle, RefreshCw, RefreshCcw, Layers, Printer, X, Barcode, QrCode,
  Palette, Type, AlignLeft, Hash, Fingerprint, Activity, Terminal, Shield, Check, Library, Search, Filter, Grid, Book, Clock, Zap, Upload, Cloud, Save, Trash2, Image as ImageIcon, Info, FileText
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { SYSTEM_BOOKS, BookPage, BookData, BookData as BookDataType, BookCategory } from '../utils/bookContent';
import { CHINESE_FONT_STACK, SERIF_FONT_STACK } from '../utils/bookSynthesis';
import { generateSecureId } from '../utils/idUtils';
import { BookStyle } from '../types';
import { MarkdownView } from './MarkdownView';
import { saveCustomBook, getCustomBooks, deleteCustomBook, isUserAdmin, getSystemBookMetadata, saveSystemBookMetadata, uploadFileToStorage } from '../services/firestoreService';
import { auth } from '../services/firebaseConfig';
import { GoogleGenAI } from "@google/genai";

interface BookStudioProps {
  onBack: () => void;
  onOpenManual?: () => void;
}

// Keeping only Minimalist Modern as requested
const STYLE_CONFIGS: Partial<Record<BookStyle, { 
    label: string, 
    desc: string, 
    font: string, 
    coverBg: string, 
    accent: string,
    border: string 
}>> = {
    minimal: { 
        label: 'Minimalist Modern', 
        desc: 'Clean sans-serif, wide margins, pure white background.',
        font: 'font-sans', 
        coverBg: 'bg-white', 
        accent: 'bg-indigo-600',
        border: 'border-slate-100 border'
    }
};

const processMarkdownForPdf = (text: string, currentStyle: BookStyle) => {
    if (!text) return '';
    
    let html = text.replace(/\$$([\s\S]+?)\$\$/g, (match, tex) => {
        try {
            return `<div class="pdf-atomic" style="margin: 15px 0; text-align: center; color: #4338ca;">${(window as any).katex.renderToString(tex, { displayMode: true, throwOnError: false })}</div>`;
        } catch (e) { return `<pre>${tex}</pre>`; }
    });

    html = html.replace(/\$([^\$\n]+?)\$/g, (match, tex) => {
        try {
            return `<span style="color: #4338ca;">${(window as any).katex.renderToString(tex, { displayMode: false, throwOnError: false })}</span>`;
        } catch (e) { return tex; }
    });

    const codeBlocks: string[] = [];
    html = html.replace(/```(\w*)\n([\s\S]+?)```/g, (match, lang, code) => {
        const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
        const styledBlock = `
            <div class="pdf-atomic" style="background: #f8fafc; color: #1e293b; padding: 15px 20px; border-radius: 12px; margin: 15px 0; font-family: 'JetBrains Mono', monospace; font-size: 11px; line-height: 1.5; white-space: pre-wrap; border: 1px solid #e2e8f0; overflow: hidden;">
                <div style="font-size: 8px; font-weight: 900; color: #94a3b8; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.2em; display: flex; align-items: center; gap: 4px;">
                    <div style="width: 5px; height: 5px; border-radius: 50%; background: #6366f1;"></div>
                    <span>LOGIC ARTIFACT // ${lang || 'SOURCE'}</span>
                </div>
                ${code.trim().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
            </div>
        `;
        codeBlocks.push(styledBlock);
        return placeholder;
    });

    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/`([^`]+)`/g, '<code style="background: #f1f5f9; padding: 2px 5px; border-radius: 4px; font-family: monospace; font-size: 0.95em; color: #4338ca;">$1</code>');

    let finalHtml = html.split('\n').map(line => {
        const trimmed = line.trim();
        if (line.startsWith('# ')) return `<h2 class="pdf-atomic" style="font-size: 24px; margin-top: 30px; margin-bottom: 15px; font-weight: 800; color: #000; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; text-transform: uppercase; letter-spacing: -0.01em;">${line.substring(2)}</h2>`;
        if (line.startsWith('## ')) return `<h3 class="pdf-atomic" style="font-size: 18px; margin-top: 25px; margin-bottom: 12px; font-weight: 700; color: #1e293b;">${line.substring(3)}</h3>`;
        if (trimmed.startsWith('- ')) return `<li class="pdf-atomic" style="margin-left: 24px; margin-bottom: 6px; list-style-type: disc; color: #334155; font-size: 14px; line-height: 1.6;">${trimmed.substring(2)}</li>`;
        if (trimmed === '') return '<div class="pdf-spacer" style="height: 8px;"></div>';
        if (trimmed.startsWith('__CODE_BLOCK_')) return trimmed;
        return `<p class="pdf-atomic" style="margin-bottom: 12px; font-size: 14px; line-height: 1.6; color: #334155; text-align: justify; widows: 3; orphans: 3;">${line}</p>`;
    }).join('');

    codeBlocks.forEach((block, i) => {
        finalHtml = finalHtml.replace(`__CODE_BLOCK_${i}__`, block);
    });

    return finalHtml;
};

export const BookStudio: React.FC<BookStudioProps> = ({ onBack, onOpenManual }) => {
  const [viewState, setViewState] = useState<'shelf' | 'studio'>('shelf');
  const [customBooks, setCustomBooks] = useState<BookData[]>([]);
  const [systemBooksState, setSystemBooksState] = useState<BookData[]>(SYSTEM_BOOKS);
  const [activeBook, setActiveBook] = useState<BookData | null>(null);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isSavingToCloud, setIsSavingToCloud] = useState(false);
  const [currentStyle] = useState<BookStyle>('minimal');
  const [searchQuery, setSearchQuery] = useState('');
  const [synthesisSteps, setSynthesisSteps] = useState<string[]>([]);
  const [generatingCovers, setGeneratingCovers] = useState<Set<string>>(new Set());
  const [isHydrating, setIsHydrating] = useState(true);
  
  const currentUser = auth?.currentUser;
  const allBooks = useMemo(() => [...systemBooksState, ...customBooks], [systemBooksState, customBooks]);
  const style = STYLE_CONFIGS.minimal!;

  const loadBooks = useCallback(async () => {
    setIsHydrating(true);
    const hydratedSystem = await Promise.all(SYSTEM_BOOKS.map(async (book) => {
        const metadata = await getSystemBookMetadata(book.id);
        if (metadata?.coverImage) return { ...book, coverImage: metadata.coverImage };
        return book;
    }));
    setSystemBooksState(hydratedSystem);
    const custom = await getCustomBooks();
    setCustomBooks(custom);
    setIsHydrating(false);
  }, []);

  // Neural Prism Deep Link Support
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bookId = params.get('id');
    if (bookId && !isHydrating) {
        const target = allBooks.find(b => b.id === bookId);
        if (target) {
            setActiveBook(target);
            setViewState('studio');
            setActivePageIndex(0);
        }
    }
  }, [isHydrating, allBooks]);

  useEffect(() => { loadBooks(); }, [loadBooks]);

  const handleGenerateCover = async (e: React.MouseEvent, book: BookData) => {
    e.stopPropagation();
    if (generatingCovers.has(book.id)) return;
    setGeneratingCovers(prev => new Set(prev).add(book.id));
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `Professional minimal book cover for "${book.title}". Subtitle: "${book.subtitle}". Clean white background, high-end technical publication style, 8k. No text.`;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: prompt,
            config: { imageConfig: { aspectRatio: "3:4" } }
        });
        let imageUrl = '';
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    const base64 = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    const blob = await (await fetch(base64)).blob();
                    imageUrl = await uploadFileToStorage(`book_covers/${book.id}/${Date.now()}.jpg`, blob);
                    break;
                }
            }
        }
        if (imageUrl) {
            if (book.isCustom) {
                const updated = { ...book, coverImage: imageUrl };
                await saveCustomBook(updated);
                setCustomBooks(prev => prev.map(b => b.id === book.id ? updated : b));
            } else {
                await saveSystemBookMetadata(book.id, { coverImage: imageUrl });
                setSystemBooksState(prev => prev.map(b => b.id === book.id ? { ...b, coverImage: imageUrl } : b));
            }
        }
    } catch (e: any) {
        console.error("Cover failed", e);
    } finally {
        setGeneratingCovers(prev => { const next = new Set(prev); next.delete(book.id); return next; });
    }
  };

  const handleBookSelect = (book: BookData) => {
      setActiveBook(book);
      setActivePageIndex(0);
      setViewState('studio');
      setSynthesisSteps([]);
      
      // Update URL without reload to support browser back button and deep linking
      const url = new URL(window.location.href);
      url.searchParams.set('id', book.id);
      window.history.pushState({}, '', url.toString());
  };

  const handleExportPDF = async () => {
    if (!activeBook) return;
    setIsExporting(true);
    setSynthesisSteps([]);
    const addStep = (msg: string) => setSynthesisSteps(prev => [...prev, msg].slice(-4));
    
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const sessionHash = generateSecureId().substring(0, 12).toUpperCase();
      let pdfPageCounter = 1;

      const captureHost = document.createElement('div');
      captureHost.style.cssText = 'position:fixed; left:-5000px; top:0; width:800px;';
      document.body.appendChild(captureHost);

      const fontStack = 'sans-serif';

      addStep("Synthesizing Cover...");
      const coverHtml = `
        <div style="width: 800px; height: 1131px; background: #ffffff; color: #0f172a; padding: 140px 100px; font-family: ${fontStack}; display: flex; flex-direction: column; justify-content: space-between; border: 1px solid #f1f5f9; box-sizing: border-box; position: relative;">
            ${activeBook.coverImage ? `<img src="${activeBook.coverImage}" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.1;" />` : ''}
            <div style="position: relative; z-index: 10;">
                <p style="text-transform: uppercase; letter-spacing: 0.8em; font-size: 14px; font-weight: 900; color: #6366f1; margin-bottom: 30px;">NEURAL PRISM PUBLICATION</p>
                <h1 style="font-size: 60px; font-weight: 900; margin: 0; line-height: 1.1; text-transform: uppercase; letter-spacing: -0.04em;">${activeBook.title}</h1>
                <p style="font-size: 20px; color: #64748b; margin-top: 25px; font-weight: 500;">${activeBook.subtitle}</p>
                <div style="width: 100px; height: 4px; background: #6366f1; margin-top: 40px;"></div>
            </div>
            <div style="display: flex; align-items: flex-end; justify-content: space-between; position: relative; z-index: 10;">
                <div>
                    <p style="text-transform: uppercase; letter-spacing: 0.2em; font-size: 12px; color: #94a3b8; font-weight: 900; margin-bottom: 8px;">AUTHOR REGISTERED AS</p>
                    <p style="font-size: 28px; font-weight: 900; margin: 0; color: #0f172a;">@${activeBook.author}</p>
                </div>
                <div style="text-align: right; background: white; padding: 15px; border: 1px solid #f1f5f9; border-radius: 12px;">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=NP-${activeBook.id}" style="width: 60px; height: 60px;" />
                </div>
            </div>
        </div>
      `;
      captureHost.innerHTML = coverHtml;
      const coverCanvas = await html2canvas(captureHost, { scale: 3, useCORS: true });
      pdf.addImage(coverCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageWidth, pageHeight);

      for (let i = 0; i < activeBook.pages.length; i++) {
          const pageData = activeBook.pages[i];
          addStep(`Printing Sector ${i + 1}: ${pageData.title.substring(0, 20)}...`);
          
          pdf.addPage();
          pdfPageCounter++;

          const contentHtml = processMarkdownForPdf(pageData.content, currentStyle);
          const pageContainer = document.createElement('div');
          pageContainer.style.cssText = `width: 800px; height: 1131px; padding: 70px 80px; box-sizing: border-box; background: white; font-family: ${fontStack}; display: flex; flex-direction: column; overflow: hidden;`;
          
          const header = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px; shrink: 0;">
                <span style="font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em;">${activeBook.title}</span>
                <span style="font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">CHAPTER ${i+1}</span>
            </div>
          `;
          
          const footer = `
            <div style="margin-top: auto; padding-top: 15px; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; shrink: 0;">
                <p style="font-size: 8px; color: #cbd5e1; font-weight: 800; letter-spacing: 0.1em; margin: 0;">NP MANUSCRIPT // ${sessionHash}</p>
                <p style="font-size: 9px; color: #94a3b8; font-weight: 800; margin: 0;">${pdfPageCounter}</p>
            </div>
          `;

          pageContainer.innerHTML = header;
          const contentArea = document.createElement('div');
          contentArea.style.cssText = 'flex: 1; overflow: hidden;';
          contentArea.innerHTML = contentHtml;
          pageContainer.appendChild(contentArea);
          pageContainer.insertAdjacentHTML('beforeend', footer);
          
          captureHost.innerHTML = '';
          captureHost.appendChild(pageContainer);
          const canvas = await html2canvas(captureHost, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });
          pdf.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, pageWidth, pageHeight);
      }

      addStep("Generating Artifact Summary...");
      const barcodeUrl = `https://barcodeapi.org/api/128/NP-${sessionHash}`;
      captureHost.innerHTML = `
        <div style="width: 800px; height: 1131px; background-color: #ffffff; color: #0f172a; font-family: ${fontStack}; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 200px; box-sizing: border-box; border: 1px solid #f1f5f9; position: relative; text-align: center;">
            <div style="position: relative; z-index: 10; display: flex; flex-direction: column; align-items: center;">
                <div style="width: 60px; height: 4px; background: #6366f1; margin-bottom: 40px;"></div>
                <h2 style="font-size: 36px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.02em; margin-bottom: 25px;">Neural Artifact</h2>
                <p style="font-size: 18px; color: #64748b; line-height: 1.6; max-width: 450px;">
                    This document is a sovereign technical refraction synthesized via the Minimalist Modern engine. All content is stored and verified on the community ledger.
                </p>
            </div>
            <div style="margin-top: 80px; background: white; color: black; padding: 40px; border: 1px solid #f1f5f9; border-radius: 24px; display: flex; flex-direction: column; align-items: center; gap: 25px; width: 100%;">
                <div style="text-align: center;">
                    <p style="font-size: 20px; font-weight: 900; margin: 0; color: #0f172a; letter-spacing: -0.01em;">NEURAL PRISM PUBLISHING</p>
                    <p style="font-size: 9px; font-weight: 800; color: #94a3b8; margin-top: 8px; text-transform: uppercase; letter-spacing: 0.1em;">Authenticated Refraction System</p>
                </div>
                <div style="text-align: center; border-top: 1px solid #f1f5f9; padding-top: 25px; width: 100%;">
                    <img src="${barcodeUrl}" style="height: 40px; width: 180px; margin-bottom: 12px;" />
                    <p style="font-size: 9px; font-weight: 900; color: #0f172a; letter-spacing: 0.2em; margin: 0;">VERIFIED BINDING</p>
                </div>
            </div>
        </div>
      `;
      pdf.addPage();
      const backCanvas = await html2canvas(captureHost, { scale: 3, useCORS: true });
      pdf.addImage(backCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageWidth, pageHeight);

      document.body.removeChild(captureHost);
      pdf.save(`${activeBook.title.replace(/\s+/g, '_')}.pdf`);
      addStep("Dispatch Complete.");
    } catch (e: any) { addStep(`ERROR: ${e.message}`); } finally { setIsExporting(false); }
  };

  const handleExportMarkdown = () => {
    if (!activeBook) return;
    let md = `# ${activeBook.title}\n\n`;
    md += `**${activeBook.subtitle}**\n\n`;
    md += `*Author: ${activeBook.author}*\n`;
    md += `*Version: ${activeBook.version}*\n\n`;
    md += `---\n\n`;
    
    activeBook.pages.forEach((page, idx) => {
        md += `## Section ${idx + 1}: ${page.title}\n\n`;
        md += `${page.content}\n\n`;
        md += `---\n\n`;
    });
    
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeBook.title.replace(/\s+/g, '_')}_Manifest.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSaveToCloud = async () => {
      if (!activeBook || !currentUser) return;
      setIsSavingToCloud(true);
      try {
          const id = await saveCustomBook(activeBook);
          setActiveBook({ ...activeBook, id, ownerId: currentUser.uid, isCustom: true });
          await loadBooks();
      } catch (e: any) { alert("Cloud sync failed: " + e.message); } finally { setIsSavingToCloud(false); }
  };

  const handleDeleteBook = async (book: BookData) => {
      if (!confirm(`Permanently delete ${book.title}?`)) return;
      try {
          await deleteCustomBook(book.id);
          setCustomBooks(prev => prev.filter(b => b.id !== book.id));
          if (activeBook?.id === book.id) setViewState('shelf');
      } catch (e) { alert("Delete failed"); }
  };

  const handleExportJSON = () => {
    if (!activeBook) return;
    const jsonString = JSON.stringify(activeBook, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeBook.title.replace(/\s+/g, '_')}_data.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-20">
          <div className="flex items-center gap-4">
              <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"><ArrowLeft size={20} /></button>
              <div>
                <h1 className="text-lg font-bold text-white flex items-center gap-2 uppercase tracking-tighter italic">
                    <BookText className="text-indigo-400" /> Author Studio
                </h1>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Library Scale v6.8.5</p>
              </div>
          </div>
          <div className="flex items-center gap-3">
              <button onClick={() => setViewState('shelf')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewState === 'shelf' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:text-white'}`} > Library </button>
              {viewState === 'studio' && activeBook && (
                  <div className="flex items-center gap-2">
                      <button onClick={handleExportJSON} className="p-2 bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white rounded-lg transition-colors border border-slate-700" title="Download Book Data" > <Download size={18}/> </button>
                      <button onClick={handleExportMarkdown} className="p-2 bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white rounded-lg transition-colors border border-slate-700" title="Download Markdown" > <FileText size={18}/> </button>
                      <button onClick={handleSaveToCloud} disabled={isSavingToCloud} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-indigo-600 text-slate-300 rounded-lg text-xs font-bold transition-all border border-slate-700" >
                          {isSavingToCloud ? <Loader2 size={14} className="animate-spin"/> : <Cloud size={14}/>}
                          <span>Cloud Sync</span>
                      </button>
                      <button onClick={handleExportPDF} disabled={isExporting} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-50 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-2xl transition-all active:scale-95 disabled:opacity-50" >
                          {isExporting ? <Loader2 size={16} className="animate-spin"/> : <FileDown size={16}/>}
                          <span>Synthesize PDF</span>
                      </button>
                      {onOpenManual && <button onClick={onOpenManual} className="p-2 text-slate-400 hover:text-white" title="Author Manual"><Info size={18}/></button>}
                  </div>
              )}
          </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
          <aside className="w-80 border-r border-slate-800 bg-slate-900/30 flex flex-col shrink-0 overflow-y-auto p-6 space-y-10 scrollbar-hide">
              <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type="text" placeholder="Search library..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner" />
              </div>
              
              {viewState === 'studio' && activeBook && (
                  <>
                    <div className="space-y-4">
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] px-1">Sectors</h3>
                        <div className="space-y-1">
                            {activeBook.pages.map((page, idx) => (
                                <button key={idx} onClick={() => setActivePageIndex(idx)} className={`w-full text-left px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activePageIndex === idx ? 'bg-slate-800 text-indigo-300' : 'text-slate-600 hover:text-slate-300'}`}>
                                    0{idx + 1} {page.title}
                                </button>
                            ))}
                        </div>
                    </div>
                  </>
              )}
          </aside>

          <main className="flex-1 bg-[#0f172a] overflow-y-auto scrollbar-hide relative">
              {viewState === 'shelf' ? (
                  <div className="p-10 md:p-16 max-w-6xl mx-auto space-y-12">
                      <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase border-b border-slate-800 pb-8">Neural Registry</h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                          {allBooks.filter(b => b.title.toLowerCase().includes(searchQuery.toLowerCase())).map(book => {
                              const isGenerating = generatingCovers.has(book.id);
                              return (
                                <div key={book.id} onClick={() => handleBookSelect(book)} className="group relative bg-slate-900/50 border border-slate-800 rounded-[2.5rem] overflow-hidden hover:border-indigo-500/50 transition-all cursor-pointer shadow-xl" >
                                    {book.ownerId === currentUser?.uid && (
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteBook(book); }} className="absolute top-6 right-6 z-20 p-2 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all"> <Trash2 size={16}/> </button>
                                    )}
                                    <div className="w-full aspect-[3/4] relative bg-slate-950">
                                        {book.coverImage ? (
                                            <img src={book.coverImage} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" crossOrigin="anonymous"/>
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-800 gap-4 relative">
                                                <Book size={48} className="opacity-10" />
                                                <button 
                                                    onClick={(e) => handleGenerateCover(e, book)}
                                                    disabled={isGenerating}
                                                    className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                                >
                                                    {isGenerating ? <Loader2 size={32} className="animate-spin text-indigo-400" /> : <Sparkles size={32} className="text-indigo-400" />}
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 mt-4">{isGenerating ? 'Synthesizing...' : 'Refract Cover'}</span>
                                                </button>
                                            </div>
                                        )}
                                        {isGenerating && (
                                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
                                                <div className="flex flex-col items-center gap-4">
                                                    <Loader2 size={32} className="animate-spin text-indigo-500" />
                                                    <span className="text-[10px] font-black uppercase text-indigo-400 tracking-widest animate-pulse">Syncing Shards...</span>
                                                </div>
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent"></div>
                                        <div className="absolute bottom-6 left-6 right-6">
                                            <span className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[8px] font-black uppercase tracking-widest">{book.category}</span>
                                            <h3 className="text-xl font-black text-white leading-tight uppercase italic mt-2">{book.title}</h3>
                                        </div>
                                    </div>
                                    <div className="p-8 pt-4 space-y-4">
                                        <p className="text-xs text-slate-500 line-clamp-2 h-8">{book.subtitle}</p>
                                        <div className="pt-4 border-t border-slate-800/50 flex justify-between items-center text-slate-600">
                                            <div className="flex items-center gap-2"><Clock size={12}/> <span className="text-[9px] font-bold">{book.pages.length} Sectors</span></div>
                                            <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </div>
                                </div>
                              );
                          })}
                      </div>
                  </div>
              ) : activeBook && (
                  <div className="h-full flex flex-col items-center justify-start p-12 lg:p-20 relative overflow-y-auto scrollbar-hide">
                      <div className={`max-w-[800px] w-full ${style.coverBg} shadow-[0_50px_100px_-20px_rgba(0,0,0,0.4)] rounded-lg min-h-[1131px] p-24 flex flex-col ${style.border} animate-fade-in relative z-10 transition-all duration-700`}>
                          <div className="absolute top-10 right-10 flex flex-col items-end opacity-20">
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Registry Page</span>
                              <span className="text-4xl font-black text-slate-900">0{activePageIndex + 1}</span>
                          </div>
                          <div className={`prose prose-lg max-w-none prose-headings:text-slate-900 prose-p:text-slate-800 ${style.font} leading-relaxed antialiased`}>
                              <MarkdownView content={activeBook.pages[activePageIndex].content} initialTheme="light" showThemeSwitcher={false} />
                          </div>
                          <div className="mt-auto pt-10 border-t border-slate-100 flex justify-between items-center opacity-60">
                              <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-lg">NP</div>
                                  <div className="flex flex-col">
                                      <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{activeBook.title}</span>
                                  </div>
                              </div>
                          </div>
                      </div>

                      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-6 p-4 bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/20 rounded-[2.5rem] shadow-2xl z-50">
                          <button onClick={() => setActivePageIndex(p => Math.max(0, p - 1))} disabled={activePageIndex === 0} className="p-3 bg-slate-800 hover:bg-indigo-600 text-white rounded-full disabled:opacity-20 transition-all shadow-lg active:scale-95"><ChevronLeft size={24}/></button>
                          <div className="flex flex-col items-center min-w-[180px]">
                              <p className="text-sm font-black text-white italic tracking-tight truncate max-w-[200px]">{activeBook.pages[activePageIndex].title}</p>
                              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{activePageIndex + 1} OF {activeBook.pages.length} SECTIONS</p>
                          </div>
                          <button onClick={() => setActivePageIndex(p => Math.min(activeBook.pages.length - 1, p + 1))} disabled={activePageIndex === activeBook.pages.length - 1} className="p-3 bg-slate-800 hover:bg-indigo-600 text-white rounded-full disabled:opacity-20 transition-all shadow-lg active:scale-95"><ChevronRight size={24}/></button>
                      </div>

                      {isExporting && (
                          <div className="fixed top-20 right-10 w-64 bg-slate-950 border border-indigo-500/30 rounded-2xl p-4 shadow-2xl animate-fade-in-right z-[100] space-y-4">
                              <div className="flex items-center gap-3"><Activity size={16} className="text-indigo-400 animate-pulse"/><span className="text-[10px] font-black text-white uppercase tracking-widest">Exporting...</span></div>
                              <div className="bg-black/60 rounded-xl p-3 font-mono text-[8px] space-y-1 h-32 overflow-hidden">
                                  {synthesisSteps.map((step, i) => <div key={i} className="text-indigo-300/80">{' > '} {step}</div>)}
                                  <div className="text-indigo-500 animate-pulse">_</div>
                              </div>
                          </div>
                      )}
                  </div>
              )}
          </main>
      </div>
    </div>
  );
};

export default BookStudio;
