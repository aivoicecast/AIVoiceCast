import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, BookText, Download, Loader2, BookOpen, 
  ChevronLeft, ChevronRight, FileDown, ShieldCheck, 
  Sparkles, CheckCircle, RefreshCw, Layers, Printer, X, Barcode, QrCode,
  Palette, Type, AlignLeft, Hash, Fingerprint, Activity, Terminal, Shield, Check, Library, Search, Filter, Grid, Book, Clock, Zap, Upload, Cloud, Save, Trash2, Image as ImageIcon
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { SYSTEM_BOOKS, BookPage, BookData, BookCategory } from '../utils/bookContent';
import { CHINESE_FONT_STACK, SERIF_FONT_STACK } from '../utils/bookSynthesis';
import { generateSecureId } from '../utils/idUtils';
import { BookStyle } from '../types';
import { MarkdownView } from './MarkdownView';
import { saveCustomBook, getCustomBooks, deleteCustomBook, isUserAdmin, getSystemBookMetadata, saveSystemBookMetadata } from '../services/firestoreService';
import { auth } from '../services/firebaseConfig';
import { GoogleGenAI } from "@google/genai";

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

const processMarkdownForPdf = (text: string, currentStyle: BookStyle) => {
    if (!text) return '';
    const style = STYLE_CONFIGS[currentStyle];
    let html = text.replace(/\$\$([\s\S]+?)\$\$/g, (match, tex) => {
        try {
            return `<div style="margin: 30px 0; text-align: center; color: #4338ca;">${(window as any).katex.renderToString(tex, { displayMode: true, throwOnError: false })}</div>`;
        } catch (e) { return `<pre>${tex}</pre>`; }
    });
    html = html.replace(/\$([^\$\n]+?)\$/g, (match, tex) => {
        try {
            return `<span style="color: #4338ca;">${(window as any).katex.renderToString(tex, { displayMode: false, throwOnError: false })}</span>`;
        } catch (e) { return tex; }
    });
    return html.split('\n').map(line => {
        const trimmed = line.trim();
        if (line.startsWith('# ')) return `<h2 style="font-size: 26px; margin-top: 30px; font-weight: 900; color: #000; border-left: 5px solid #6366f1; padding-left: 15px; text-transform: uppercase;">${line.substring(2)}</h2>`;
        if (line.startsWith('## ')) return `<h3 style="font-size: 22px; margin-top: 25px; font-weight: 800; color: #1e293b;">${line.substring(3)}</h3>`;
        if (line.startsWith('### ')) return `<h4 style="font-size: 18px; margin-top: 20px; font-weight: 700; color: #475569;">${line.substring(4)}</h4>`;
        if (trimmed.startsWith('- ')) return `<li style="margin-left: 20px; margin-bottom: 8px; list-style-type: disc;">${trimmed.substring(2)}</li>`;
        if (trimmed === '') return '<div style="height: 15px;"></div>';
        return `<p style="margin-bottom: 18px; font-size: 15px; line-height: 1.7;">${line}</p>`;
    }).join('');
};

export const BookStudio: React.FC<BookStudioProps> = ({ onBack }) => {
  const [viewState, setViewState] = useState<'shelf' | 'studio'>('shelf');
  const [customBooks, setCustomBooks] = useState<BookData[]>([]);
  const [systemBooksState, setSystemBooksState] = useState<BookData[]>(SYSTEM_BOOKS);
  const [activeBook, setActiveBook] = useState<BookData | null>(null);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isSavingToCloud, setIsSavingToCloud] = useState(false);
  const [currentStyle, setCurrentStyle] = useState<BookStyle>('academic');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<BookCategory | 'All'>('All');
  const [synthesisSteps, setSynthesisSteps] = useState<string[]>([]);
  const [generatingCovers, setGeneratingCovers] = useState<Set<string>>(new Set());
  const [isHydrating, setIsHydrating] = useState(true);
  
  // Local processing lock to prevent multi-trigger in SAME render session
  const processingRef = useRef<Set<string>>(new Set());
  const localImageCache = useRef<Map<string, string>>(new Map());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentUser = auth?.currentUser;

  const allBooks = useMemo(() => [...systemBooksState, ...customBooks], [systemBooksState, customBooks]);

  const categories = useMemo(() => {
    const set = new Set<BookCategory>();
    allBooks.forEach(b => set.add(b.category));
    return ['All', ...Array.from(set)] as const;
  }, [allBooks]);

  const filteredBooks = useMemo(() => {
    return allBooks.filter(b => {
      const matchesSearch = b.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          b.subtitle.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'All' || b.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, activeCategory, allBooks]);

  const style = STYLE_CONFIGS[currentStyle];

  const handleBookSelect = (book: BookData) => {
      setActiveBook(book);
      setActivePageIndex(0);
      setViewState('studio');
      setSynthesisSteps([]);
  };

  /**
   * Internal generator with strict "exactly once per session" logic.
   */
  const generateCoverInternal = useCallback(async (book: BookData) => {
    // 1. Check local session processing lock (active memory)
    if (processingRef.current.has(book.id)) return null;
    
    // 2. Check SessionStorage to see if we already tried and failed this session (e.g. quota)
    // This satisfies the "retry one time on page load only" requirement.
    if (sessionStorage.getItem(`cover_attempted_${book.id}`)) {
        window.dispatchEvent(new CustomEvent('neural-log', { 
            detail: { text: `Synthesis skipped for ${book.title}: Already attempted this session.`, type: 'info' } 
        }));
        return null;
    }
    
    // 3. Double check memory cache
    if (localImageCache.current.has(book.id)) return localImageCache.current.get(book.id);

    // 4. Mark as processing IMMEDIATELY
    processingRef.current.add(book.id);
    setGeneratingCovers(prev => new Set(prev).add(book.id));

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `Professional, high-quality, artistic book cover art for a technical volume titled "${book.title}". 
        Subtitle: "${book.subtitle}". 
        Artistic Style: Modern, clean, conceptual, 8k resolution, cinematic lighting. 
        Requirements: NO TEXT, no words, centered composition, striking visual metaphor for the topic. 
        Category: ${book.category}.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: prompt,
            config: {
                imageConfig: {
                    aspectRatio: "3:4"
                }
            }
        });

        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    const base64 = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    
                    // Update session memory cache
                    localImageCache.current.set(book.id, base64);
                    
                    // Update LocalStorage for permanent cache
                    try {
                        localStorage.setItem(`cover_hotcache_${book.id}`, base64);
                    } catch (e) {
                        console.warn("Local storage write skipped (likely quota or private mode)");
                    }

                    // Update local component state
                    if (book.isCustom) {
                        setCustomBooks(prev => prev.map(b => b.id === book.id ? { ...b, coverImage: base64 } : b));
                        if (currentUser) {
                            await saveCustomBook({ ...book, coverImage: base64 });
                        }
                    } else {
                        setSystemBooksState(prev => prev.map(b => b.id === book.id ? { ...b, coverImage: base64 } : b));
                        await saveSystemBookMetadata(book.id, { coverImage: base64 });
                    }
                    
                    if (activeBook?.id === book.id) setActiveBook(prev => prev ? ({ ...prev, coverImage: base64 }) : null);

                    window.dispatchEvent(new CustomEvent('neural-log', { 
                        detail: { text: `Neural Cover refracted for ${book.title}`, type: 'success' } 
                    }));
                    return base64;
                }
            }
        }
    } catch (err: any) {
        console.error(err);
        // CRITICAL: Mark as attempted in SessionStorage so we DON'T try again until full page refresh
        sessionStorage.setItem(`cover_attempted_${book.id}`, 'true');
        
        const isQuota = err.message?.includes('quota') || err.message?.includes('429');
        window.dispatchEvent(new CustomEvent('neural-log', { 
            detail: { 
                text: isQuota 
                    ? `Cover synthesis paused for ${book.title}: API Quota Exceeded. Will retry on next page load.` 
                    : `Cover synthesis failed for ${book.title}: ${err.message}`, 
                type: 'error' 
            } 
        }));
    } finally {
        setGeneratingCovers(prev => {
            const next = new Set(prev);
            next.delete(book.id);
            return next;
        });
        // Note: We leave it in processingRef even if it fails to avoid redundant attempts in current mount
    }
    return null;
  }, [activeBook, currentUser]);

  const autoRefractCovers = useCallback(async (books: BookData[]) => {
      // Background sequential processing to avoid rate limit
      for (const book of books) {
          // Verify it's truly a dark node (missing everywhere)
          if (!book.coverImage && !localImageCache.current.has(book.id) && !processingRef.current.has(book.id)) {
              // Check session attempt flag before bothering the API service
              if (!sessionStorage.getItem(`cover_attempted_${book.id}`)) {
                  window.dispatchEvent(new CustomEvent('neural-log', { 
                      detail: { text: `Background Refraction: Requesting logic for ${book.title}...`, type: 'info' } 
                  }));
                  await generateCoverInternal(book);
                  // Artificial delay to respect API burst limits
                  await new Promise(resolve => setTimeout(resolve, 1000));
              }
          }
      }
  }, [generateCoverInternal]);

  const loadBooks = useCallback(async () => {
    setIsHydrating(true);
    
    // Phase 1: Try Local & Memory hydration first
    const hydratedSystem = await Promise.all(SYSTEM_BOOKS.map(async (book) => {
        // 1. Session Memory
        if (localImageCache.current.has(book.id)) {
            return { ...book, coverImage: localImageCache.current.get(book.id) };
        }
        // 2. LocalStorage (Permanent cache)
        const hotload = localStorage.getItem(`cover_hotcache_${book.id}`);
        if (hotload) {
            localImageCache.current.set(book.id, hotload);
            return { ...book, coverImage: hotload };
        }
        // 3. Authority Cloud Registry Check
        const metadata = await getSystemBookMetadata(book.id);
        if (metadata?.coverImage) {
            localImageCache.current.set(book.id, metadata.coverImage);
            try { localStorage.setItem(`cover_hotcache_${book.id}`, metadata.coverImage); } catch(e) {}
            return { ...book, coverImage: metadata.coverImage };
        }
        return book;
    }));
    setSystemBooksState(hydratedSystem);

    // Phase 2: Load Custom Books
    const custom = await getCustomBooks();
    setCustomBooks(custom);
    custom.forEach(b => {
        if (b.coverImage) {
            localImageCache.current.set(b.id, b.coverImage);
            try { localStorage.setItem(`cover_hotcache_${b.id}`, b.coverImage); } catch(e) {}
        }
    });

    setIsHydrating(false);

    // Phase 3: Trigger refraction for any remaining dark nodes
    const combined = [...hydratedSystem, ...custom];
    autoRefractCovers(combined);
  }, [autoRefractCovers]);

  useEffect(() => {
    loadBooks();
  }, []); // Only once on mount

  const handleManualRefract = (e: React.MouseEvent, book: BookData) => {
      e.stopPropagation();
      // Manual bypass: Clear session flags to allow another try if user specifically asks
      sessionStorage.removeItem(`cover_attempted_${book.id}`);
      processingRef.current.delete(book.id);
      generateCoverInternal(book);
  };

  const handleSaveToCloud = async () => {
      if (!activeBook || !currentUser) return;
      setIsSavingToCloud(true);
      try {
          const id = await saveCustomBook(activeBook);
          setActiveBook({ ...activeBook, id, ownerId: currentUser.uid, isCustom: true });
          await loadBooks();
          window.dispatchEvent(new CustomEvent('neural-log', { 
            detail: { text: `Book persistent in cloud registry: ${activeBook.title}`, type: 'success' } 
          }));
      } catch (e: any) {
          alert("Cloud sync failed: " + e.message);
      } finally {
          setIsSavingToCloud(false);
      }
  };

  const handleDeleteBook = async (book: BookData) => {
      if (!confirm(`Permanently delete ${book.title} from cloud?`)) return;
      try {
          await deleteCustomBook(book.id);
          localStorage.removeItem(`cover_hotcache_${book.id}`);
          sessionStorage.removeItem(`cover_attempted_${book.id}`);
          setCustomBooks(prev => prev.filter(b => b.id !== book.id));
          if (activeBook?.id === book.id) setViewState('shelf');
      } catch (e) { alert("Delete failed"); }
  };

  const handleExportJSON = () => {
      if (!activeBook) return;
      const data = JSON.stringify(activeBook, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeBook.title.replace(/\s+/g, '_')}_NeuralBook.json`;
      a.click();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
          try {
              const book: BookData = JSON.parse(event.target?.result as string);
              if (book.title && book.pages) {
                  if (currentUser && confirm(`Found book "${book.title}". Save to your Cloud Vault?`)) {
                      const id = await saveCustomBook({ ...book, id: generateSecureId() });
                      await loadBooks();
                      handleBookSelect({ ...book, id, isCustom: true, ownerId: currentUser.uid });
                  } else {
                      handleBookSelect({ ...book, isCustom: false });
                  }
              }
          } catch (err) { alert("Invalid book file."); }
      };
      reader.readAsText(file);
  };

  const handleExportPDF = async () => {
    if (!activeBook) return;
    setIsExporting(true);
    setSynthesisSteps([]);
    const addStep = (msg: string) => setSynthesisSteps(prev => [...prev, msg].slice(-4));
    addStep(`Initializing High-DPI Matrix for ${activeBook.title}...`);
    
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const sessionHash = generateSecureId().substring(0, 12).toUpperCase();

      const captureContainer = document.createElement('div');
      captureContainer.style.width = '800px'; 
      captureContainer.style.position = 'fixed';
      captureContainer.style.left = '-10000px';
      captureContainer.style.top = '0';
      captureContainer.style.backgroundColor = '#ffffff';
      document.body.appendChild(captureContainer);

      // --- PHASE 1: COVER PAGE ---
      addStep("Synthesizing Cinematic Front Cover...");
      const coverHtml = `
        <div style="width: 800px; height: 1131px; background: #020617; color: white; padding: 120px 80px; font-family: ${style.font}; display: flex; flex-direction: column; justify-content: space-between; position: relative; border: 30px solid #0f172a;">
            ${activeBook.coverImage ? `<img src="${activeBook.coverImage}" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.4;" />` : ''}
            <div style="position: absolute; top: 0; right: 0; bottom: 0; width: 300px; background: linear-gradient(to left, rgba(99, 102, 241, 0.1), transparent); pointer-events: none;"></div>
            <div style="position: relative; z-index: 10;">
                <p style="text-transform: uppercase; letter-spacing: 0.6em; font-size: 14px; font-weight: 900; color: #818cf8; margin-bottom: 25px;">NEURAL PRISM PUBLICATION</p>
                <h1 style="font-size: 72px; font-weight: 900; margin: 0; line-height: 1.1; text-transform: uppercase; letter-spacing: -0.05em; font-style: italic;">${activeBook.title}</h1>
                <p style="font-size: 24px; color: #94a3b8; margin-top: 30px; font-weight: 500; max-width: 500px;">${activeBook.subtitle}</p>
                <div style="width: 150px; height: 12px; background: #6366f1; margin-top: 50px; border-radius: 6px;"></div>
            </div>
            <div style="display: flex; align-items: flex-end; justify-content: space-between; position: relative; z-index: 10;">
                <div>
                    <p style="text-transform: uppercase; letter-spacing: 0.2em; font-size: 12px; color: #64748b; font-weight: 900; margin-bottom: 5px;">AUTHOR REGISTERED AS</p>
                    <p style="font-size: 38px; font-weight: 900; margin: 0; color: #fff;">@${activeBook.author}</p>
                    <p style="font-size: 12px; color: #475569; font-mono: true; margin-top: 10px;">VERSION: ${activeBook.version} // HASH: ${sessionHash}</p>
                </div>
                <div style="text-align: right; background: white; padding: 20px; border-radius: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=NP-${activeBook.id}" style="width: 100px; height: 100px;" />
                </div>
            </div>
        </div>
      `;
      captureContainer.innerHTML = coverHtml;
      const coverCanvas = await html2canvas(captureContainer, { scale: 3.5, useCORS: true });
      pdf.addImage(coverCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageWidth, pageHeight);

      // --- PHASE 2: CONTENT PAGES ---
      for (let i = 0; i < activeBook.pages.length; i++) {
          const page = activeBook.pages[i];
          addStep(`Rasterizing Section ${i + 1}/${activeBook.pages.length}...`);
          const bodyHtml = processMarkdownForPdf(page.content, currentStyle);
          captureContainer.innerHTML = `
            <div style="padding: 100px; font-family: ${currentStyle === 'academic' ? SERIF_FONT_STACK : (currentStyle === 'brutalist' ? 'monospace' : 'sans-serif')}; background: white; width: 800px; height: 1131px; display: flex; flex-direction: column;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px;">
                    <span style="font-size: 10px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 0.2em;">${activeBook.title}</span>
                    <span style="font-size: 10px; font-weight: 900; color: #94a3b8;">SECTOR 0${i + 1}</span>
                </div>
                <h1 style="font-size: 36px; font-weight: 900; color: #1e293b; margin-bottom: 30px; text-transform: uppercase;">${page.title}</h1>
                <div style="font-size: 17px; line-height: 1.8; color: #334155; flex: 1;">${bodyHtml}</div>
                <div style="margin-top: auto; padding-top: 20px; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
                    <p style="font-size: 8px; color: #cbd5e1; font-weight: 900; letter-spacing: 0.2em; margin: 0;">NP MANUSCRIPT // ${sessionHash}</p>
                    <p style="font-size: 10px; color: #64748b; font-weight: 900; margin: 0;">PAGE ${i + 2}</p>
                </div>
            </div>
          `;
          pdf.addPage();
          const canvas = await html2canvas(captureContainer, { scale: 3.5, useCORS: true, backgroundColor: '#ffffff' });
          pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageWidth, pageHeight);
      }

      // --- PHASE 3: END PAGE ---
      addStep("Generating Verification Artifact Page...");
      const barcodeUrl = `https://barcodeapi.org/api/128/NP-${sessionHash}`;
      captureContainer.innerHTML = `
        <div style="width: 800px; height: 1131px; background-color: #020617; color: #ffffff; font-family: ${CHINESE_FONT_STACK}; display: flex; flex-direction: column; justify-content: space-between; padding: 120px 100px;">
            <div style="position: absolute; top: -100px; left: -100px; width: 400px; height: 400px; background: radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%);"></div>
            <div>
                <div style="width: 60px; height: 6px; background: #6366f1; margin-bottom: 30px; border-radius: 3px;"></div>
                <h2 style="font-size: 42px; font-weight: 900; text-transform: uppercase; font-style: italic;">Neural Artifact</h2>
                <p style="font-size: 20px; color: #94a3b8; line-height: 1.8; margin-top: 30px;">
                    This document is a sovereign technical refraction synthesized via the ${style.label} engine. 
                    Integrity verified against the global community ledger and archived in the sovereign vault.
                </p>
                <div style="margin-top: 50px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 40px; border-radius: 30px;">
                    <p style="font-size: 14px; font-weight: 900; color: #6366f1; text-transform: uppercase; letter-spacing: 0.3em; margin-bottom: 15px;">Registry Trace</p>
                    <div style="display: flex; gap: 40px;">
                        <div><p style="font-size: 10px; color: #475569; margin: 0;">BOOK_ID</p><p style="font-size: 14px; font-mono: true; margin: 5px 0 0 0;">${activeBook.id.substring(0,24)}</p></div>
                        <div><p style="font-size: 10px; color: #475569; margin: 0;">ISSUED</p><p style="font-size: 14px; font-mono: true; margin: 5px 0 0 0;">${new Date().toLocaleDateString()}</p></div>
                    </div>
                </div>
            </div>
            <div style="background: white; color: black; padding: 60px; border-radius: 40px; display: flex; justify-content: space-between; align-items: flex-end;">
                <div>
                    <p style="font-size: 24px; font-weight: 900; margin: 0; letter-spacing: -0.02em;">NEURAL PRISM PUBLISHING</p>
                    <p style="font-size: 12px; color: #64748b; margin-top: 10px; font-weight: 600;">Refraction System v6.8.5 // Activity-Centric</p>
                </div>
                <div style="text-align: right;">
                    <img src="${barcodeUrl}" style="height: 60px; width: 180px; margin-bottom: 10px;" />
                    <p style="font-size: 10px; font-weight: 900; color: #000; letter-spacing: 0.2em; margin: 0;">VERIFIED BINDING</p>
                </div>
            </div>
        </div>
      `;
      pdf.addPage();
      const backCanvas = await html2canvas(captureContainer, { scale: 3.5, useCORS: true });
      pdf.addImage(backCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageWidth, pageHeight);

      document.body.removeChild(captureContainer);
      pdf.save(`${activeBook.title.replace(/\s+/g, '_')}_Neural_Artifact.pdf`);
      addStep("Handshake finalized. PDF Dispatched.");
      setTimeout(() => setSynthesisSteps([]), 5000);
    } catch (e: any) {
      addStep(`ERROR: ${e.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const Sidebar = () => (
    <div className="w-80 border-r border-slate-800 bg-slate-900/30 flex flex-col shrink-0 overflow-y-auto p-6 space-y-10 scrollbar-hide">
        <div className="space-y-4">
            <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input 
                    type="text" 
                    placeholder="Search library..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner"
                />
            </div>
            <div className="space-y-1">
                {filteredBooks.map(book => (
                    <button 
                      key={book.id} 
                      onClick={() => handleBookSelect(book)}
                      className={`w-full p-3 rounded-xl text-left border transition-all flex flex-col gap-0.5 ${activeBook?.id === book.id ? 'bg-indigo-600 border-indigo-400 text-white shadow-xl' : 'bg-slate-950/40 border-transparent text-slate-500 hover:bg-slate-800'}`}
                    >
                        <span className="text-[10px] font-black uppercase tracking-wider line-clamp-1">{book.title}</span>
                        <div className="flex justify-between items-center">
                            <span className={`text-[8px] font-medium leading-relaxed line-clamp-1 ${activeBook?.id === book.id ? 'text-indigo-100' : 'opacity-60'}`}>{book.subtitle}</span>
                            {book.isCustom && <Cloud size={10} className={activeBook?.id === book.id ? 'text-white' : 'text-indigo-400'}/>}
                        </div>
                    </button>
                ))}
            </div>
        </div>

        {viewState === 'studio' && (
            <>
                <div className="space-y-4 pt-6 border-t border-slate-800">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Refractive Style</label>
                    <div className="grid grid-cols-1 gap-2">
                        {(Object.keys(STYLE_CONFIGS) as BookStyle[]).map(s => (
                            <button 
                              key={s} 
                              onClick={() => setCurrentStyle(s)}
                              className={`p-3 rounded-xl text-left border transition-all flex flex-col gap-0.5 ${currentStyle === s ? 'bg-indigo-600 border-indigo-400 text-white shadow-xl' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600'}`}
                            >
                                <span className="text-[10px] font-black uppercase tracking-wider">{STYLE_CONFIGS[s].label}</span>
                                <span className="text-[8px] font-medium opacity-60 leading-relaxed">{STYLE_CONFIGS[s].desc}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] px-1">Sections</h3>
                    <div className="space-y-1">
                        {activeBook?.pages.map((page, idx) => (
                            <button 
                              key={idx}
                              onClick={() => setActivePageIndex(idx)}
                              className={`w-full text-left px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${activePageIndex === idx ? 'bg-slate-800 border-indigo-500 text-indigo-300' : 'border-transparent text-slate-600 hover:text-slate-300'}`}
                            >
                                <span className="opacity-30 mr-2">0{idx + 1}</span>
                                {page.title.split('. ')[1] || page.title}
                            </button>
                        ))}
                    </div>
                </div>
            </>
        )}
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-20">
          <div className="flex items-center gap-4">
              <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"><ArrowLeft size={20} /></button>
              <div>
                <h1 className="text-lg font-bold text-white flex items-center gap-2 italic uppercase tracking-tighter">
                    <BookText className="text-indigo-400" /> 
                    Author Studio
                </h1>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Library Scale v6.8.5</p>
              </div>
          </div>
          <div className="flex items-center gap-3">
              <button 
                onClick={() => setViewState('shelf')}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewState === 'shelf' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
              >
                  Library
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-700 transition-all active:scale-95"
              >
                  <Upload size={14}/> <span>Import JSON</span>
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImportJSON}/>
              
              {viewState === 'studio' && activeBook && (
                  <div className="flex items-center gap-2">
                      <button 
                        onClick={handleExportJSON}
                        className="p-2 bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white rounded-lg transition-colors border border-slate-700"
                        title="Download Book Data"
                      >
                          <Download size={18}/>
                      </button>
                      <button 
                        onClick={handleSaveToCloud}
                        disabled={isSavingToCloud}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-indigo-600 text-slate-300 rounded-lg text-xs font-bold transition-all border border-slate-700"
                      >
                          {isSavingToCloud ? <Loader2 size={14} className="animate-spin"/> : <Cloud size={14}/>}
                          <span>Cloud Sync</span>
                      </button>
                      <button 
                        onClick={handleExportPDF} 
                        disabled={isExporting}
                        className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-2xl transition-all active:scale-95 disabled:opacity-50"
                      >
                          {isExporting ? <Loader2 size={16} className="animate-spin"/> : <FileDown size={16}/>}
                          <span>Synthesize PDF</span>
                      </button>
                  </div>
              )}
          </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
          <Sidebar />

          <main className="flex-1 bg-[#0f172a] overflow-y-auto scrollbar-hide relative">
              {viewState === 'shelf' ? (
                  <div className="p-10 md:p-16 max-w-6xl mx-auto space-y-12 animate-fade-in">
                      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-800 pb-8">
                          <div className="space-y-2">
                              <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">Neural Registry</h2>
                              <p className="text-slate-500 text-sm font-medium">Explore and refract {allBooks.length} high-dimensional volumes.</p>
                          </div>
                          <div className="flex gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
                              {categories.map(cat => (
                                  <button 
                                      key={cat}
                                      onClick={() => setActiveCategory(cat as any)}
                                      className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeCategory === cat ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                  >
                                      {cat}
                                  </button>
                              ))}
                          </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                          {filteredBooks.map(book => (
                              <div 
                                key={book.id}
                                onClick={() => handleBookSelect(book)}
                                className="group relative bg-slate-900/50 border border-slate-800 rounded-[2.5rem] overflow-hidden hover:border-indigo-500/50 hover:bg-indigo-900/10 transition-all cursor-pointer shadow-xl flex flex-col items-center text-center"
                              >
                                  {book.isCustom && (
                                      <div className="absolute top-6 left-6 z-20">
                                          <div className="flex items-center gap-1.5 bg-indigo-600 text-white px-2 py-0.5 rounded-full shadow-lg border border-indigo-400/50">
                                              <Cloud size={10} fill="currentColor"/>
                                              <span className="text-[8px] font-black uppercase tracking-widest">Sovereign Vault</span>
                                          </div>
                                      </div>
                                  )}
                                  
                                  {book.ownerId === currentUser?.uid && (
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handleDeleteBook(book); }}
                                        className="absolute top-6 right-6 z-20 p-2 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-xl transition-all opacity-0 group-hover:opacity-100 shadow-lg"
                                      >
                                          <Trash2 size={16}/>
                                      </button>
                                  )}

                                  <div className="w-full aspect-[3/4] relative bg-slate-950 overflow-hidden">
                                      {book.coverImage ? (
                                          <img src={book.coverImage} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-80 group-hover:opacity-100" crossOrigin="anonymous"/>
                                      ) : (
                                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-800 gap-4 bg-gradient-to-br from-slate-900 to-indigo-950/20 p-8">
                                              <div className="relative">
                                                <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full animate-pulse"></div>
                                                <Book size={48} className="opacity-10 relative z-10" />
                                              </div>
                                              <div className="flex flex-col items-center gap-2">
                                                  <div className="flex items-center gap-2 px-3 py-1 bg-indigo-900/40 border border-indigo-500/20 rounded-full animate-pulse">
                                                      <RefreshCw size={10} className="animate-spin text-indigo-400" />
                                                      <span className="text-[8px] font-black uppercase text-indigo-300 tracking-widest">Neural Ingest...</span>
                                                  </div>
                                                  <button 
                                                    onClick={(e) => handleManualRefract(e, book)}
                                                    disabled={generatingCovers.has(book.id)}
                                                    className="px-6 py-2 bg-indigo-600/10 hover:bg-indigo-600 border border-indigo-500/30 text-indigo-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                                                  >
                                                    {generatingCovers.has(book.id) ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>}
                                                    Force Refraction
                                                  </button>
                                              </div>
                                          </div>
                                      )}
                                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent"></div>
                                      <div className="absolute bottom-6 left-6 right-6 text-left">
                                          <span className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[8px] font-black uppercase tracking-widest">{book.category}</span>
                                          <h3 className="text-xl font-black text-white leading-tight uppercase italic mt-2 drop-shadow-lg">{book.title}</h3>
                                      </div>
                                  </div>
                                  
                                  <div className="p-8 pt-4 w-full text-left space-y-4">
                                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed h-8">{book.subtitle}</p>
                                      <div className="pt-4 border-t border-slate-800/50 flex justify-between items-center text-slate-600">
                                          <div className="flex items-center gap-2"><Clock size={12}/> <span className="text-[9px] font-bold">{book.pages.length} Sectors</span></div>
                                          <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>

                      {filteredBooks.length === 0 && !isHydrating && (
                          <div className="py-32 flex flex-col items-center justify-center text-slate-600 gap-4">
                              <Search size={64} className="opacity-10"/>
                              <p className="text-sm font-bold uppercase tracking-[0.4em]">No Refractions Found</p>
                          </div>
                      )}

                      {isHydrating && (
                          <div className="py-32 flex flex-col items-center justify-center text-indigo-400 gap-4 animate-pulse">
                              <Loader2 size={48} className="animate-spin"/>
                              <p className="text-[10px] font-black uppercase tracking-widest">Hydrating Registry...</p>
                          </div>
                      )}
                  </div>
              ) : activeBook && (
                  <div className="h-full flex flex-col items-center justify-start p-12 lg:p-20 relative scrollbar-thin scrollbar-thumb-slate-600">
                      <div className="relative group">
                          <div className="absolute -left-12 top-2 bottom-2 w-12 bg-slate-900 rounded-l-3xl shadow-2xl z-0 transform translate-x-4"></div>
                          <div className={`max-w-[800px] w-full ${style.coverBg} shadow-[0_50px_100px_-20px_rgba(0,0,0,0.4)] rounded-lg min-h-[1131px] p-24 flex flex-col ${style.border} animate-fade-in relative z-10 transition-all duration-700`}>
                              <div className="absolute top-10 right-10 flex flex-col items-end opacity-20">
                                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Registry Page</span>
                                  <span className="text-4xl font-black text-slate-900">0{activePageIndex + 1}</span>
                              </div>
                              <div className={`prose prose-lg max-w-none prose-headings:text-slate-900 prose-p:text-slate-800 ${style.font} leading-relaxed antialiased`}>
                                  <MarkdownView content={activeBook.pages[activePageIndex].content} initialTheme="light" showThemeSwitcher={false} />
                                  <div className="mt-20 py-10 border-2 border-dashed border-slate-100 rounded-3xl text-center bg-slate-50/50">
                                      <div className="flex flex-col items-center gap-4">
                                          <QrCode size={48} className="text-slate-200" />
                                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em] m-0">[ END OF SECTION ]</p>
                                      </div>
                                  </div>
                              </div>
                              <div className="mt-auto pt-10 border-t border-slate-100 flex justify-between items-center opacity-60">
                                  <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-lg">NP</div>
                                      <div className="flex flex-col">
                                          <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{activeBook.title}</span>
                                          <span className="text-[8px] font-bold text-slate-400 uppercase">{activeBook.version}</span>
                                      </div>
                                  </div>
                                  <span className="text-[10px] font-mono font-bold text-slate-300 tracking-tighter">NEURAL_TRACE_NODE_${activePageIndex + 1}</span>
                              </div>
                          </div>
                      </div>

                      {/* Navigation HUD */}
                      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-6 p-4 bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/20 rounded-[2.5rem] shadow-2xl z-50">
                          <button onClick={() => setActivePageIndex(p => Math.max(0, p - 1))} disabled={activePageIndex === 0} className="p-3 bg-slate-800 hover:bg-indigo-600 text-white rounded-full disabled:opacity-20 transition-all shadow-lg active:scale-95"><ChevronLeft size={24}/></button>
                          <div className="flex flex-col items-center min-w-[180px]">
                              <div className="flex items-center gap-2 mb-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div><span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Typesetting Node</span></div>
                              <p className="text-sm font-black text-white italic tracking-tight truncate max-w-[200px]">{activeBook.pages[activePageIndex].title}</p>
                              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{activePageIndex + 1} OF {activeBook.pages.length} SECTIONS</p>
                          </div>
                          <button onClick={() => setActivePageIndex(p => Math.min(activeBook.pages.length - 1, p + 1))} disabled={activePageIndex === activeBook.pages.length - 1} className="p-3 bg-slate-800 hover:bg-indigo-600 text-white rounded-full disabled:opacity-20 transition-all shadow-lg active:scale-95"><ChevronRight size={24}/></button>
                      </div>

                      {/* Real-time Synthesis Log Overlays */}
                      {isExporting && (
                          <div className="fixed top-20 right-10 w-64 bg-slate-950 border border-indigo-500/30 rounded-2xl p-4 shadow-2xl animate-fade-in-right z-[100] space-y-4">
                              <div className="flex items-center gap-3"><Activity size={16} className="text-indigo-400 animate-pulse"/><span className="text-[10px] font-black text-white uppercase tracking-widest">Export Pipeline</span></div>
                              <div className="bg-black/60 rounded-xl p-3 font-mono text-[8px] space-y-1 h-32 overflow-hidden shadow-inner">
                                  {synthesisSteps.map((step, i) => <div key={i} className="text-indigo-300/80">> {step}</div>)}
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