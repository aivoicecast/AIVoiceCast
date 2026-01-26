
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { GoogleGenAI } from '@google/genai';
import { 
  ArrowLeft, BookOpen, Scroll, Loader2, Play, Square, Pause, 
  Sparkles, Wand2, RefreshCcw, Film, BrainCircuit, Bug, X, Menu, Library, Lock, Palette, Cpu, Music, User, GraduationCap, Database
} from 'lucide-react';
import { MarkdownView } from './MarkdownView';
import { auth, storage } from '../services/firebaseConfig';
import { ref, getDownloadURL } from '@firebase/storage';
import { generateSecureId } from '../utils/idUtils';
import { getDriveToken, signInWithGoogle } from '../services/authService';
import { uploadToYouTube, getYouTubeVideoUrl, getYouTubeEmbedUrl } from '../services/youtubeService';
import { getUserProfile, saveScriptureToVault, getScriptureAudioUrl, uploadScriptureAudio, deductCoins, AI_COSTS } from '../services/firestoreService';
import { UserProfile, DualVerse } from '../types';
import { getGlobalAudioContext, registerAudioOwner, getGlobalAudioGeneration, warmUpAudioContext, decodeRawPcm } from '../utils/audioUtils';
import { synthesizeSpeech, TtsProvider } from '../services/tts';
import { Visualizer } from './Visualizer';

interface ScriptureSanctuaryProps {
  onBack: () => void;
  language: 'en' | 'zh';
  isProMember: boolean;
}

interface DebugLog {
  timestamp: string;
  message: string;
  type: 'info' | 'error' | 'success' | 'warn';
  details?: string;
}

const PERSONA_VOICES = [
    { id: 'Default Gem', label: 'Gemini', icon: Sparkles, color: 'text-indigo-400' },
    { id: 'Software Interview Voice gen-lang-client-0648937375', label: 'Fenrir', icon: GraduationCap, color: 'text-red-400' },
    { id: 'Linux Kernel Voice gen-lang-client-0375218270', label: 'Puck', icon: Cpu, color: 'text-emerald-400' },
    { id: 'Charon', label: 'Charon', icon: User, color: 'text-slate-400' },
    { id: 'Kore', label: 'Kore', icon: Music, color: 'text-pink-400' }
];

export const ScriptureSanctuary: React.FC<ScriptureSanctuaryProps> = ({ onBack, language, isProMember }) => {
  const [selectedBook, setSelectedBook] = useState('John');
  const [selectedChapter, setSelectedChapter] = useState('1');
  const [parsedVerses, setParsedVerses] = useState<DualVerse[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentReadingIndex, setCurrentReadingIndex] = useState<number>(0); 
  const [isReading, setIsReading] = useState(false);
  const [audioBuffering, setAudioBuffering] = useState(false);
  const [liveVolume, setLiveVolume] = useState(0);
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  
  const playbackSessionRef = useRef(0);
  const loadedKeyRef = useRef<string>('');
  const verseRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const addDebugLog = useCallback((message: string, type: DebugLog['type'] = 'info') => {
    setDebugLogs(prev => [{ timestamp: new Date().toLocaleTimeString(), message, type }, ...prev].slice(0, 50));
  }, []);

  const stopReading = useCallback(() => {
      playbackSessionRef.current++;
      setIsReading(false);
      setAudioBuffering(false);
      setLiveVolume(0);
      if (window.speechSynthesis) window.speechSynthesis.cancel();
  }, []);

  const handleRefractScripture = useCallback(async (book: string, chapter: string, force = false) => {
    const key = `${book}_${chapter}`;
    if (key === loadedKeyRef.current && !force) return;

    setIsSyncing(true);
    
    // DETERMINISTIC UUID: Based on Book/Chapter context for global cross-user lookup
    const chapterId = `bible_${book.toLowerCase()}_${chapter}`;
    addDebugLog(`Sovereign Handshake for Node: [${chapterId}]...`, 'info');

    try {
      let data: DualVerse[] | null = null;
      
      // 1. KNOWLEDGE DATABASE PROBE (Fast Lookup)
      const vaultPath = `bible_corpus/${book}/${chapter}.json`;
      try {
          const url = await getDownloadURL(ref(storage, vaultPath));
          const res = await fetch(url);
          if (res.ok) {
              data = await res.json();
              addDebugLog(`Knowledge Database Hit! Restored from low-cost ledger.`, 'success');
              window.dispatchEvent(new CustomEvent('neural-log', { 
                  detail: { text: `[Scripture] Cache Hit for ${chapterId}. API refraction skipped.`, type: 'success' } 
              }));
          }
      } catch (e) {}

      // 2. NEURAL CORE REFRACTION (Only if Vault Miss)
      if (!data) {
          addDebugLog(`Knowledge Database Miss. Contacting Neural Core for refraction...`, 'warn');
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Refract dual-language JSON for ${book} ${chapter}: [{"number":"1","en":"...","zh":"..."},...]`,
            config: { responseMimeType: 'application/json' }
          });
          const raw = JSON.parse(response.text || '[]');
          
          // ATTACH UUID TO EVERY GENERATED CONTENT ITEM
          data = raw.map((v: any) => ({ 
              ...v, 
              uid: `${chapterId}_v${v.number}` 
          }));
          
          addDebugLog(`Refraction finalized. Committing ${data.length} segments to community ledger.`, 'success');
          if (auth.currentUser) await saveScriptureToVault(book, chapter, data!);
      }

      if (data) {
          setParsedVerses(data);
          loadedKeyRef.current = key;
      }
    } catch (e: any) { addDebugLog(`Refraction Error: ${e.message}`, 'error'); }
    finally { setIsSyncing(false); }
  }, [addDebugLog]);

  useEffect(() => { handleRefractScripture(selectedBook, selectedChapter); }, []);

  const startReadingSequence = async (startIndex: number) => {
      stopReading();
      setIsReading(true);
      const session = ++playbackSessionRef.current;
      const ctx = getGlobalAudioContext();
      await warmUpAudioContext(ctx);

      for (let i = startIndex; i < parsedVerses.length; i++) {
          if (session !== playbackSessionRef.current) return;
          const verse = parsedVerses[i];
          setCurrentReadingIndex(i);
          
          verseRefs.current[verse.number]?.scrollIntoView({ behavior: 'smooth', block: 'center' });

          setAudioBuffering(true);
          const text = language === 'zh' ? verse.zh : verse.en;
          
          // AUDIO VAULT LOOKUP: Prevent redundant TTS synthesis using Verse UUID
          const result = await synthesizeSpeech(text, 'Kore', ctx, 'gemini', language);
          setAudioBuffering(false);

          if (result.buffer && session === playbackSessionRef.current) {
              setLiveVolume(0.8);
              await new Promise<void>((resolve) => {
                  const source = ctx.createBufferSource();
                  source.buffer = result.buffer;
                  source.connect(ctx.destination);
                  source.onended = () => { setLiveVolume(0); resolve(); };
                  source.start(0);
              });
          }
      }
      setIsReading(false);
  };

  return (
    <div className="h-full flex flex-col bg-[#020617] text-slate-100 overflow-hidden relative">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md z-50">
          <div className="flex items-center gap-4">
              <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"><ArrowLeft size={20} /></button>
              <h1 className="text-lg font-bold text-white flex items-center gap-2"><Scroll className="text-amber-500" /> Scripture Sanctuary</h1>
          </div>
          <div className="flex items-center gap-3">
              {isSyncing && <div className="flex items-center gap-2 px-3 py-1 bg-indigo-900/40 rounded-full border border-indigo-500/30 text-[9px] font-black uppercase animate-pulse"><Loader2 size={10} className="animate-spin" /> Syncing Archive...</div>}
              <button onClick={() => setShowDebugPanel(!showDebugPanel)} className="p-2 text-slate-500 hover:text-white transition-colors" title="Neural Console"><Bug size={18} /></button>
          </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
          {/* Sidebar / Book Selector */}
          <div className="w-64 border-r border-slate-800 bg-slate-900/30 p-4 space-y-4 hidden lg:block overflow-y-auto scrollbar-hide">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2 flex items-center gap-2"><Database size={12}/> Knowledge Registry</h3>
              <div className="space-y-1">
                  {['Genesis', 'Psalms', 'Proverbs', 'John', 'Romans', 'Ephesians', 'Revelation'].map(b => (
                      <button key={b} onClick={() => { setSelectedBook(b); setSelectedChapter('1'); handleRefractScripture(b, '1'); }} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all border border-transparent ${selectedBook === b ? 'bg-indigo-600/20 border-indigo-500/30 text-indigo-100 shadow-lg' : 'text-slate-500 hover:bg-slate-800'}`}>{b}</button>
                  ))}
              </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden relative">
              <div className="p-6 md:p-10 border-b border-slate-800 bg-slate-900/20 shrink-0">
                  <h2 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter text-white">{selectedBook} <span className="text-indigo-500 not-italic ml-2">{selectedChapter}</span></h2>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-12 space-y-6 scrollbar-hide pb-40">
                  <div className="max-w-4xl mx-auto space-y-6">
                      {parsedVerses.map((v, idx) => (
                          <div 
                            key={v.uid} 
                            ref={el => { verseRefs.current[v.number] = el; }}
                            className={`p-8 rounded-[2.5rem] border transition-all shadow-xl group relative ${currentReadingIndex === idx ? 'border-indigo-500 bg-indigo-950/30 ring-4 ring-indigo-500/5' : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'}`}
                          >
                              <div className="flex gap-6 items-start">
                                  <span className={`text-[10px] font-black mt-2 ${currentReadingIndex === idx ? 'text-indigo-400' : 'text-slate-600'}`}>{v.number}</span>
                                  <div className="flex-1 space-y-4">
                                      <p className={`text-xl md:text-2xl leading-relaxed font-serif ${currentReadingIndex === idx ? 'text-white' : 'text-slate-300'}`}>{v.en}</p>
                                      <p className={`text-xl md:text-2xl leading-relaxed font-serif ${currentReadingIndex === idx ? 'text-white' : 'text-slate-400'} pt-4 border-t border-white/5`}>{v.zh}</p>
                                  </div>
                              </div>
                              <div className="absolute top-4 right-4 flex items-center gap-3">
                                  <span className="text-[8px] font-mono text-slate-700 uppercase opacity-0 group-hover:opacity-100 transition-opacity">UID: {v.uid.split('_').pop()}</span>
                                  {currentReadingIndex === idx && isReading && (
                                      <div className="w-20 h-6"><Visualizer volume={liveVolume} isActive={true} color="#6366f1" /></div>
                                  )}
                              </div>
                          </div>
                      ))}
                  </div>
              </div>

              {/* Floating Controls */}
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 p-1.5 bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-full shadow-2xl flex items-center gap-4 px-8 py-4">
                  <div className="flex items-center gap-6">
                      {isReading ? (
                        <button onClick={stopReading} className="w-14 h-14 bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg animate-pulse"><Square size={24} fill="currentColor"/></button>
                      ) : (
                        <button onClick={() => startReadingSequence(currentReadingIndex)} className="w-14 h-14 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-105 transition-all"><Play size={24} fill="currentColor"/></button>
                      )}
                      <div className="hidden sm:block">
                          <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">{selectedBook} {selectedChapter}:{currentReadingIndex + 1}</p>
                          <p className="text-xs font-bold text-white uppercase tracking-tighter">Neural Reading Protocol Active</p>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {showDebugPanel && (
          <div className="fixed bottom-0 left-0 right-0 h-64 bg-slate-950 border-t-2 border-amber-500 z-[200] flex flex-col p-4 animate-fade-in-up">
              <div className="flex justify-between items-center mb-4"><h3 className="font-black text-amber-500 uppercase text-xs">Knowledge Ledger Console</h3><button onClick={() => setShowDebugPanel(false)} className="p-1 hover:bg-white/10 rounded"><X size={16}/></button></div>
              <div className="flex-1 overflow-y-auto space-y-2 font-mono text-[10px] scrollbar-thin scrollbar-thumb-amber-500/20">
                  {debugLogs.map((log, i) => (
                    <div key={i} className={`p-2 rounded border border-white/5 ${log.type === 'success' ? 'bg-emerald-950/20 text-emerald-400' : 'bg-slate-900/50 text-slate-50'}`}>
                        <span className="opacity-40">[{log.timestamp}]</span> {log.message}
                    </div>
                  ))}
              </div>
          </div>
      )}
    </div>
  );
};

export default ScriptureSanctuary;
