
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { 
  ArrowLeft, FileUp, Loader2, Database, ShieldCheck, Zap, 
  RefreshCw, BrainCircuit, ListOrdered, Layers,
  CloudCheck, X, CloudDownload, RefreshCcw, Search, Grid3X3, Speaker, Volume2, Bookmark, Headphones, FileText, File,
  Check, CheckCircle, ChevronRight, Sparkles, Play, Pause, Music, AlertTriangle, HardDrive, Globe, Coins, ZapOff
} from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';
import { saveScriptureToLedger, saveAudioToLedger, getScriptureFromLedger, getScriptureAudioUrl } from '../services/firestoreService';
import { collection, query, where, getDocs } from '@firebase/firestore';
import { db } from '../services/firebaseConfig';
import { DualVerse } from '../types';
import { synthesizeSpeech, TtsProvider } from '../services/tts';
import { getCachedAudioBuffer, cacheAudioBuffer } from '../utils/db';
import { getGlobalAudioContext, warmUpAudioContext, registerAudioOwner, decodeRawPcm, connectOutput, base64ToBytes } from '../utils/audioUtils';
import { Visualizer } from './Visualizer';

interface ScriptureIngestProps {
  onBack: () => void;
}

interface BatchChapterResult {
    chapter: string;
    genStatus: 'pending' | 'success' | 'error' | 'skipped' | 'repairing' | 'processing';
    audioStatus: 'pending' | 'processing' | 'success' | 'error' | 'skipped';
    saveStatus: 'pending' | 'success' | 'error' | 'skipped' | 'processing';
    verses?: DualVerse[];
    error?: string;
}

const BIBLE_CHAPTER_COUNTS: Record<string, number> = {
    'Genesis': 50, 'Exodus': 40, 'Leviticus': 27, 'Numbers': 36, 'Deuteronomy': 34,
    'Joshua': 24, 'Judges': 21, 'Ruth': 4, '1 Samuel': 31, '2 Samuel': 24,
    '1 Kings': 22, '2 Kings': 25, '1 Chronicles': 29, '2 Chronicles': 36,
    'Ezra': 10, 'Nehemiah': 13, 'Esther': 10, 'Job': 42, 'Psalms': 150,
    'Proverbs': 31, 'Ecclesiastes': 12, 'Song of Solomon': 8, 'Isaiah': 66,
    'Jeremiah': 52, 'Lamentations': 5, 'Ezekiel': 48, 'Daniel': 12,
    'Hosea': 14, 'Joel': 3, 'Amos': 9, 'Obadiah': 1, 'Jonah': 4,
    'Micah': 7, 'Nahum': 3, 'Habakkuk': 3, 'Zephaniah': 3, 'Haggai': 2,
    'Zechariah': 14, 'Malachi': 4,
    'Matthew': 28, 'Mark': 16, 'Luke': 24, 'John': 21, 'Acts': 28,
    'Romans': 16, '1 Corinthians': 16, '2 Corinthians': 13, 'Galatians': 6,
    'Ephesians': 6, 'Philippians': 4, 'Colossians': 4, '1 Thessalonians': 5,
    '2 Thessalonians': 3, '1 Timothy': 6, '2 Timothy': 4, 'Titus': 3,
    'Philemon': 1, 'Hebrews': 13, 'James': 5, '1 Peter': 5, '2 Peter': 3,
    '1 John': 5, '2 John': 1, '3 John': 1, 'Jude': 1, 'Revelation': 22
};

const OLD_TESTAMENT = [
    'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth', 
    '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 
    'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon', 
    'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 
    'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi'
];

const NEW_TESTAMENT = [
    'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians', 
    'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', 
    '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter', 
    '1 John', '2 John', '3 John', 'Jude', 'Revelation'
];

export const ScriptureIngest: React.FC<ScriptureIngestProps> = ({ onBack }) => {
  const [activeTestament, setActiveTestament] = useState<'OT' | 'NT'>('NT');
  const [selectedBook, setSelectedBook] = useState('John');
  const [selectedChapter, setSelectedChapter] = useState<string>('HUB'); 
  const [isProcessing, setIsProcessing] = useState(false);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const isBatchActiveRef = useRef(false); 
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [batchSummary, setBatchSummary] = useState<BatchChapterResult[]>([]);
  const [parsedVerses, setParsedVerses] = useState<DualVerse[]>([]);
  const [vaultStatus, setVaultStatus] = useState<Record<string, { text: boolean, audio: boolean, checking: boolean }>>({});
  const [isRegistryRefreshing, setIsRegistryRefreshing] = useState(false);
  
  const [generateAudio, setGenerateAudio] = useState(false);
  const [audioVoice, setAudioVoice] = useState('en-US-Wavenet-D');
  const [voiceTier, setVoiceTier] = useState<'standard' | 'wavenet' | 'gemini' | 'openai'>('gemini');

  // Playback State
  const [playingVerseNum, setPlayingVerseNum] = useState<string | null>(null);
  const [isBufferingAudio, setIsBufferingAudio] = useState(false);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const dispatchLog = useCallback((text: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
      window.dispatchEvent(new CustomEvent('neural-log', { 
          detail: { text: `[Scripture Ingest] ${text}`, type } 
      }));
  }, []);

  const totalChaptersInBook = useMemo(() => BIBLE_CHAPTER_COUNTS[selectedBook] || 1, [selectedBook]);
  const chaptersGrid = useMemo(() => Array.from({ length: totalChaptersInBook }, (_, i) => (i + 1).toString()), [totalChaptersInBook]);

  const scanBookVault = useCallback(async (book: string) => {
    if (!db) return;
    setIsRegistryRefreshing(true);
    const bookStatus: Record<string, { text: boolean, audio: boolean, checking: boolean }> = {};
    const count = BIBLE_CHAPTER_COUNTS[book] || 0;
    for (let i = 1; i <= count; i++) bookStatus[i] = { text: false, audio: false, checking: true };
    setVaultStatus(bookStatus);
    
    try {
        const bibleLedgerRef = collection(db, 'bible_ledger');
        const q = query(bibleLedgerRef, where('book', '==', book));
        const snap = await getDocs(q);
        
        const finalStatus: Record<string, { text: boolean, audio: boolean, checking: boolean }> = {};
        for (let i = 1; i <= count; i++) {
            const docData = snap.docs.find(d => d.data().chapter === i.toString())?.data();
            const hasVerses = !!docData && Array.isArray(docData.verses) && docData.verses.length > 0;
            finalStatus[i] = {
                text: hasVerses,
                audio: !!docData?.hasAudio,
                checking: false
            };
        }
        setVaultStatus(finalStatus);
    } catch (e) {
        console.error("Ledger scan failed", e);
    } finally {
        setIsRegistryRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (selectedChapter === 'HUB') {
        scanBookVault(selectedBook);
    }
  }, [selectedBook, selectedChapter, scanBookVault]);

  const stopAudio = useCallback(() => {
      activeSourcesRef.current.forEach(s => { try { s.stop(); s.disconnect(); } catch(e) {} });
      activeSourcesRef.current.clear();
      setPlayingVerseNum(null);
      setIsBufferingAudio(false);
  }, []);

  const handlePlayVerse = async (v: DualVerse) => {
      if (playingVerseNum === v.number) {
          stopAudio();
          return;
      }

      stopAudio();
      setPlayingVerseNum(v.number);
      
      const MY_TOKEN = `IngestPlay:${v.uid}`;
      registerAudioOwner(MY_TOKEN, stopAudio);

      const ctx = getGlobalAudioContext();
      await warmUpAudioContext(ctx);

      const playAudioPart = async (text: string, voice: string, lang: 'en' | 'zh'): Promise<void> => {
          if (playingVerseNum !== v.number) return; 
          
          setIsBufferingAudio(true);
          const provider = voiceTier === 'gemini' ? 'gemini' : voiceTier === 'openai' ? 'openai' : 'google';
          const cacheKey = `${provider}:${voice}:${lang}:${text.replace(/`/g, '').trim()}`;
          
          const cachedBuffer = await getCachedAudioBuffer(cacheKey);
          if (cachedBuffer) {
              dispatchLog(`[${v.number}] ${lang.toUpperCase()} Cache Hit.`, 'success');
              const audioBuffer = await ctx.decodeAudioData(cachedBuffer.slice(0)).catch(() => decodeRawPcm(new Uint8Array(cachedBuffer), ctx, 24000, 1));
              setIsBufferingAudio(false);
              return new Promise((resolve) => {
                  const source = ctx.createBufferSource();
                  source.buffer = audioBuffer;
                  connectOutput(source, ctx);
                  source.onended = () => resolve();
                  activeSourcesRef.current.add(source);
                  source.start(0);
              });
          }

          dispatchLog(`[${v.number}] ${lang.toUpperCase()} Cache Miss. Handshaking Cloud Registry...`, 'info');
          const url = await getScriptureAudioUrl(selectedBook, selectedChapter, v.number, lang);
          if (!url) {
              dispatchLog(`[${v.number}] ${lang.toUpperCase()} Cloud Node missing.`, 'warn');
              setIsBufferingAudio(false);
              return;
          }

          let arrayBuffer: ArrayBuffer;
          if (url.startsWith('data:')) {
              arrayBuffer = base64ToBytes(url.split(',')[1]).buffer;
          } else {
              arrayBuffer = await fetch(url).then(r => r.arrayBuffer());
          }
          
          await cacheAudioBuffer(cacheKey, arrayBuffer);
          
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0)).catch(() => decodeRawPcm(new Uint8Array(arrayBuffer), ctx, 24000, 1));
          setIsBufferingAudio(false);
          
          return new Promise((resolve) => {
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              connectOutput(source, ctx);
              source.onended = () => resolve();
              activeSourcesRef.current.add(source);
              source.start(0);
          });
      };

      try {
          await playAudioPart(v.en, audioVoice, 'en');
          if (playingVerseNum === v.number) {
              await playAudioPart(v.zh, 'Kore', 'zh');
          }
          setPlayingVerseNum(null);
      } catch (e: any) {
          console.error("Playback failed", e);
          dispatchLog(`[${v.number}] Handshake failed: ${e.message}`, 'error');
          stopAudio();
      }
  };

  const synthesizeChapter = async (book: string, chapter: string): Promise<DualVerse[]> => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Generate all verses of ${book} chapter ${chapter}. Return the complete text. Ensure accuracy. Output as JSON array of objects with keys: number, en, zh.`;
      
      dispatchLog(`[${chapter}] Handshaking Neural Core...`, 'info');

      try {
          const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { 
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        verses: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    number: { type: Type.STRING, description: "Verse number" },
                                    en: { type: Type.STRING, description: "English text" },
                                    zh: { type: Type.STRING, description: "Simplified Chinese text" }
                                },
                                required: ["number", "en", "zh"]
                            }
                        }
                    },
                    required: ["verses"]
                }
            }
          });

          if (!response.text) throw new Error("Null Refraction from core.");

          const data = JSON.parse(response.text);
          const parsed = data.verses;
          if (!Array.isArray(parsed)) throw new Error("Response is not an array.");

          const finalVerses: DualVerse[] = parsed.map(v => ({
              number: String(v.number), 
              en: v.en,
              zh: v.zh,
              uid: `bible_${book.toLowerCase().replace(/\s+/g, '_')}_${chapter}_v${v.number}`
          }));

          if (finalVerses.length === 0) throw new Error("Empty array synthesized.");
          
          return finalVerses;
      } catch (e: any) {
          throw new Error(`TEXT FAULT: ${e.message}`);
      }
  };

  const handleStartBatch = async (startCh: number, endCh: number) => {
    if (isBatchRunning) return;
    setIsBatchRunning(true);
    isBatchActiveRef.current = true;
    
    setBatchProgress({ current: 0, total: endCh - startCh + 1 });
    setBatchSummary([]);

    for (let i = startCh; i <= endCh; i++) {
        if (!isBatchActiveRef.current) break;
        
        const chStr = i.toString();
        const currentResult: BatchChapterResult = {
            chapter: chStr,
            genStatus: 'processing',
            audioStatus: 'pending',
            saveStatus: 'pending'
        };
        setBatchSummary(prev => [...prev, currentResult]);

        try {
            const existingResult = await getScriptureFromLedger(selectedBook, chStr);
            let needsAudio = generateAudio;
            let needsSave = false;

            if (existingResult && Array.isArray(existingResult.verses) && existingResult.verses.length > 0) {
                currentResult.genStatus = 'skipped';
                currentResult.verses = existingResult.verses;
                
                if (generateAudio && !existingResult.hasAudio) {
                    dispatchLog(`[${chStr}] Deep Hydration: Text found, but audio missing. Backfilling...`, 'info');
                    needsAudio = true;
                    needsSave = true; 
                } else {
                    needsAudio = false; 
                    dispatchLog(`[${chStr}] Registry Hit: Content fully hydrated.`, 'success');
                }
            } else {
                dispatchLog(`[${chStr}] Registry Miss. Initializing synthesis...`, 'info');
                const verses = await synthesizeChapter(selectedBook, chStr);
                currentResult.verses = verses;
                currentResult.genStatus = 'success';
                needsSave = true;
            }

            if (needsAudio && currentResult.verses) {
                currentResult.audioStatus = 'processing';
                setBatchSummary(prev => prev.map(r => r.chapter === chStr ? { ...currentResult } : r));
                
                const ctx = getGlobalAudioContext();
                await warmUpAudioContext(ctx);
                
                let successCount = 0;
                for (const v of currentResult.verses) {
                    if (!isBatchActiveRef.current) break;
                    
                    let voiceToUse = audioVoice;
                    let chineseVoice = 'Kore';
                    let provider: TtsProvider = 'google';

                    if (voiceTier === 'standard') {
                        voiceToUse = audioVoice.replace('Wavenet', 'Standard');
                        chineseVoice = 'cmn-CN-Standard-A';
                        provider = 'google';
                    } else if (voiceTier === 'gemini') {
                        voiceToUse = 'Puck'; 
                        chineseVoice = 'Kore';
                        provider = 'gemini';
                    } else if (voiceTier === 'openai') {
                        voiceToUse = 'nova'; 
                        chineseVoice = 'nova'; 
                        provider = 'openai';
                    } else {
                        provider = 'google';
                    }

                    // --- RESILIENT TTS RETRY LOOP ---
                    const synthesizeWithRetry = async (text: string, voice: string, lang: 'en' | 'zh', prov: TtsProvider): Promise<any> => {
                        let attempts = 0;
                        while (attempts < 3) {
                            try {
                                const res = await synthesizeSpeech(text, voice, ctx, prov, lang, { 
                                    channelId: selectedBook, 
                                    topicId: chStr, 
                                    nodeId: `node_${selectedBook}_${chStr}_${v.number}_${lang}` 
                                });
                                if (res.buffer) return res;
                                throw new Error("Null Buffer Result");
                            } catch (e) {
                                attempts++;
                                if (attempts >= 3) throw e;
                                setBatchSummary(prev => prev.map(r => r.chapter === chStr ? { ...r, genStatus: 'repairing' } : r));
                                dispatchLog(`[${chStr}:${v.number}] Neural Backoff (Attempt ${attempts})...`, 'warn');
                                await new Promise(r => setTimeout(r, 2000));
                            }
                        }
                    };

                    try {
                        dispatchLog(`[${chStr}:${v.number}] Syncing English (${voiceTier})...`, 'info');
                        await synthesizeWithRetry(v.en, voiceToUse, 'en', provider);
                        
                        if (!isBatchActiveRef.current) break;
                        dispatchLog(`[${chStr}:${v.number}] Syncing Chinese (${voiceTier})...`, 'info');
                        await synthesizeWithRetry(v.zh, chineseVoice, 'zh', provider);
                        
                        successCount++;
                    } catch (verseErr) {
                        dispatchLog(`[${chStr}:${v.number}] Node synthesis failed. Skipping to preserve batch flow.`, 'error');
                    }
                    
                    await new Promise(r => setTimeout(r, 600)); 
                }
                currentResult.audioStatus = successCount === currentResult.verses.length ? 'success' : (successCount > 0 ? 'error' : 'error');
                
                if (currentResult.audioStatus === 'success') {
                    needsSave = true; 
                    currentResult.genStatus = 'success';
                }
            } else if (existingResult?.hasAudio) {
                currentResult.audioStatus = 'skipped';
            } else {
                currentResult.audioStatus = 'skipped';
            }

            if (currentResult.verses && needsSave) {
                currentResult.saveStatus = 'processing';
                setBatchSummary(prev => prev.map(r => r.chapter === chStr ? { ...currentResult } : r));
                
                const hasAudioFinal = currentResult.audioStatus === 'success' || (existingResult?.hasAudio ?? false);
                await saveScriptureToLedger(selectedBook, chStr, currentResult.verses, hasAudioFinal);
                currentResult.saveStatus = 'success';
            } else {
                currentResult.saveStatus = 'skipped';
            }

        } catch (e: any) {
            currentResult.genStatus = 'error';
            currentResult.error = e.message;
            dispatchLog(`[${chStr}] Non-Critical Fault: ${e.message}. Moving to next chapter.`, 'warn');
        }

        setBatchSummary(prev => prev.map(r => r.chapter === chStr ? { ...currentResult } : r));
        setBatchProgress(prev => ({ ...prev, current: prev.current + 1 }));
        
        if (isBatchActiveRef.current) {
            await new Promise(r => setTimeout(r, 1200));
        }
    }

    setIsBatchRunning(false);
    isBatchActiveRef.current = false;
    scanBookVault(selectedBook);
  };

  const stopBatch = () => {
      isBatchActiveRef.current = false;
      setIsBatchRunning(false);
      dispatchLog("Batch process termination requested.", "warn");
  };

  const handlePreview = async (ch: string) => {
      setSelectedChapter(ch);
      setIsProcessing(true);
      stopAudio();
      try {
          const data = await getScriptureFromLedger(selectedBook, ch);
          if (data && Array.isArray(data.verses) && data.verses.length > 0) {
              setParsedVerses(data.verses);
              dispatchLog(`Previewing ${selectedBook} ${ch}`, 'success');
          } else {
              setParsedVerses([]);
              const verses = await synthesizeChapter(selectedBook, ch);
              setParsedVerses(verses);
              dispatchLog(`Synthesized preview for ${selectedBook} ${ch}`, 'info');
          }
      } catch (e: any) {
          alert(e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 font-sans overflow-hidden">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md px-6 flex items-center justify-between shrink-0 z-50">
        <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"><ArrowLeft size={20} /></button>
            <div>
              <h1 className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-widest"><FileUp className="text-indigo-400" size={16} /> Scripture Ingest</h1>
              <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{selectedBook} Registry Management</p>
            </div>
        </div>
        <div className="flex items-center gap-3">
            {isBatchRunning && (
                <button onClick={stopBatch} className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white text-[10px] font-black uppercase rounded-lg shadow-lg animate-pulse">Terminate Batch</button>
            )}
            <button onClick={() => scanBookVault(selectedBook)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 transition-all"><RefreshCw size={18} className={isRegistryRefreshing ? 'animate-spin' : ''} /></button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 border-r border-slate-800 bg-slate-900/30 flex flex-col shrink-0">
            <div className="p-4 bg-slate-950/50 border-b border-slate-800 flex gap-1">
                <button onClick={() => setActiveTestament('OT')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTestament === 'OT' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-slate-100'}`}>Old Testament</button>
                <button onClick={() => setActiveTestament('NT')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTestament === 'NT' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-slate-100'}`}>New Testament</button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hide">
                {(activeTestament === 'OT' ? OLD_TESTAMENT : NEW_TESTAMENT).map(b => (
                    <button key={b} onClick={() => setSelectedBook(b)} className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${selectedBook === b ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}>
                        {b}
                        {selectedBook === b && <ChevronRight size={14}/>}
                    </button>
                ))}
            </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden relative">
            <div className="flex-1 overflow-y-auto p-8 lg:p-12 scrollbar-hide bg-slate-950">
                {selectedChapter === 'HUB' ? (
                    <div className="max-w-5xl mx-auto space-y-12 animate-fade-in-up">
                        <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-slate-800 pb-8">
                            <div>
                                <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">{selectedBook} Hub</h2>
                                <p className="text-indigo-400 text-xs font-black uppercase tracking-[0.3em] mt-3">Vault Status & Batch Control</p>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex flex-col gap-2">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <div onClick={() => setGenerateAudio(!generateAudio)} className={`w-10 h-5 rounded-full transition-all relative ${generateAudio ? 'bg-emerald-600' : 'bg-slate-800'}`}>
                                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${generateAudio ? 'right-1' : 'left-1'}`}></div>
                                        </div>
                                        <span className="text-[10px] font-black uppercase text-slate-500 group-hover:text-white transition-colors">Neural Audio Ingest</span>
                                    </label>
                                    {generateAudio && (
                                        <div className="flex flex-col gap-2">
                                            <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-700">
                                                <button onClick={() => setVoiceTier('standard')} title="Standard voices ($4/1M chars)" className={`flex-1 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${voiceTier === 'standard' ? 'bg-slate-700 text-white shadow' : 'text-slate-500'}`}>Economy</button>
                                                <button onClick={() => setVoiceTier('wavenet')} title="Neural voices ($16/1M chars)" className={`flex-1 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${voiceTier === 'wavenet' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500'}`}>Neural</button>
                                                <button onClick={() => setVoiceTier('openai')} title="OpenAI Multilingual ($15/1M chars)" className={`flex-1 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${voiceTier === 'openai' ? 'bg-emerald-600 text-white shadow' : 'text-slate-500'}`}>OpenAI</button>
                                                <button onClick={() => setVoiceTier('gemini')} title="Gemini Preview voices (Free/Token based)" className={`flex-1 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${voiceTier === 'gemini' ? 'bg-indigo-600 text-white shadow' : 'text-slate-50'}`}>Gemini</button>
                                            </div>
                                            {voiceTier !== 'gemini' && voiceTier !== 'openai' && (
                                                <select value={audioVoice} onChange={e => setAudioVoice(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[10px] text-indigo-300 outline-none">
                                                    <option value="en-US-Wavenet-D">Male D (Deep)</option>
                                                    <option value="en-US-Wavenet-B">Male B (Firm)</option>
                                                    <option value="en-US-Neural2-F">Female F (Clear)</option>
                                                </select>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => handleStartBatch(1, totalChaptersInBook)} disabled={isBatchRunning} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50">
                                    {isBatchRunning ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>}
                                    Refract Entire Book
                                </button>
                            </div>
                        </div>

                        {isBatchRunning && (
                            <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl p-8 space-y-6 shadow-2xl animate-fade-in-up">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <div className="relative">
                                            <div className="w-12 h-12 border-4 border-indigo-500/10 rounded-full"></div>
                                            <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white uppercase">Active Refraction</h3>
                                            <p className="text-[10px] text-slate-500 uppercase font-black">Chapter {batchProgress.current} / {batchProgress.total}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-2xl font-black text-white italic">{Math.round((batchProgress.current / batchProgress.total) * 100)}%</span>
                                        <p className="text-[8px] font-black text-slate-500 uppercase flex items-center gap-1"><Coins size={10}/> {voiceTier.toUpperCase()} Mode Active</p>
                                    </div>
                                </div>
                                <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden shadow-inner">
                                    <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}></div>
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto scrollbar-hide">
                                    {batchSummary.slice().reverse().map(res => (
                                        <div key={res.chapter} className={`bg-slate-950 border p-4 rounded-2xl flex items-center justify-between transition-colors ${res.genStatus === 'repairing' ? 'border-amber-500/40' : 'border-slate-800'}`}>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-indigo-400">CH {res.chapter}</span>
                                                {res.genStatus === 'repairing' && <span className="text-[8px] font-black text-amber-500 uppercase animate-pulse">Neural Backoff...</span>}
                                            </div>
                                            <div className="flex gap-2">
                                                <div title="Synthesis Status" className={`w-2.5 h-2.5 rounded-full shadow-lg ${res.genStatus === 'success' ? 'bg-emerald-500 shadow-emerald-500/20' : res.genStatus === 'repairing' ? 'bg-amber-500 animate-pulse' : res.genStatus === 'skipped' ? 'bg-indigo-500' : res.genStatus === 'error' ? 'bg-red-500' : 'bg-slate-700 animate-pulse'}`}></div>
                                                {/* Fixed: audioStatus type comparison to exclude invalid provider strings */}
                                                <div title="Audio Status" className={`w-2.5 h-2.5 rounded-full ${res.audioStatus === 'success' ? 'bg-emerald-500' : res.audioStatus === 'error' ? 'bg-red-500' : res.audioStatus === 'skipped' ? 'bg-slate-800' : res.audioStatus === 'processing' ? 'bg-slate-700 animate-pulse' : 'bg-slate-800'}`}></div>
                                                <div title="Save Status" className={`w-2.5 h-2.5 rounded-full ${res.saveStatus === 'success' ? 'bg-emerald-500' : res.saveStatus === 'error' ? 'bg-red-500' : res.saveStatus === 'skipped' ? 'bg-slate-800' : res.saveStatus === 'processing' ? 'bg-slate-700 animate-pulse' : 'bg-slate-800'}`}></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
                            {chaptersGrid.map(ch => {
                                const status = vaultStatus[ch];
                                return (
                                    <button 
                                        key={ch}
                                        onClick={() => handlePreview(ch)}
                                        className={`aspect-square flex flex-col items-center justify-center rounded-2xl border transition-all relative overflow-hidden group ${status?.text ? 'bg-indigo-900/10 border-indigo-500/40 text-white' : 'bg-slate-900/40 border-slate-800 text-slate-700 hover:border-indigo-500'}`}
                                    >
                                        {status?.checking ? <Loader2 size={12} className="animate-spin text-slate-800"/> : (
                                            <>
                                                <span className={`text-lg font-black ${status?.text ? 'text-indigo-200' : ''}`}>{ch}</span>
                                                <div className="flex gap-1 mt-1">
                                                    {status?.text && <div className="w-1 h-1 rounded-full bg-emerald-500"></div>}
                                                    {status?.audio && <div className="w-1 h-1 rounded-full bg-amber-500"></div>}
                                                </div>
                                            </>
                                        )}
                                        <div className="absolute inset-0 bg-indigo-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Search size={18} className="text-white"/>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="max-w-4xl mx-auto space-y-12 pb-32">
                        <div className="flex items-center justify-between">
                            <button onClick={() => setSelectedChapter('HUB')} className="flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-white transition-colors">
                                <ArrowLeft size={14}/> Back to Book Hub
                            </button>
                            <div className="flex gap-3">
                                <button onClick={() => synthesizeChapter(selectedBook, selectedChapter).then(v => setParsedVerses(v))} className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-black uppercase text-slate-400 hover:text-white hover:border-indigo-500 transition-all shadow-lg">
                                    <RefreshCcw size={14}/> Force Re-synthesis
                                </button>
                                <button onClick={() => saveScriptureToLedger(selectedBook, selectedChapter, parsedVerses, false)} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-xl hover:bg-indigo-500 active:scale-95 transition-all">
                                    <Database size={14}/> Commit to Ledger
                                </button>
                            </div>
                        </div>

                        <div className="text-center space-y-4">
                            <h2 className="text-6xl font-black text-white italic tracking-tighter uppercase leading-none">{selectedBook} {selectedChapter}</h2>
                            <div className="w-16 h-1 bg-indigo-500 mx-auto rounded-full"></div>
                        </div>

                        {isProcessing ? (
                             <div className="py-24 flex flex-col items-center justify-center gap-6 text-center animate-pulse">
                                <div className="relative">
                                    <div className="w-20 h-20 border-4 border-indigo-500/10 rounded-full"></div>
                                    <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                    <div className="absolute inset-0 flex items-center justify-center"><Zap size={24} className="text-indigo-400" /></div>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-black uppercase text-white tracking-widest">Neural Refraction Active</p>
                                    <p className="text-[10px] text-slate-500 font-mono">Parsing linguistic logic gates...</p>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {parsedVerses.map(v => {
                                    const isPlaying = playingVerseNum === v.number;
                                    return (
                                        <div key={v.number} className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] hover:border-indigo-500/40 transition-all shadow-xl group relative overflow-hidden">
                                            <div className="absolute top-6 left-8 flex items-center gap-4">
                                                <span className="text-[10px] font-black text-slate-700 group-hover:text-indigo-400 transition-colors uppercase tracking-widest">Node {v.number}</span>
                                                {isPlaying && (
                                                    <div className="w-12 h-4 overflow-hidden"><Visualizer volume={0.6} isActive={true} color="#818cf8"/></div>
                                                )}
                                            </div>
                                            
                                            <div className="absolute top-6 right-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => handlePlayVerse(v)}
                                                    className={`p-3 rounded-2xl transition-all shadow-lg active:scale-95 ${isPlaying ? 'bg-red-600 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}
                                                >
                                                    {isBufferingAudio && isPlaying ? <Loader2 size={18} className="animate-spin"/> : isPlaying ? <Pause size={18} fill="currentColor"/> : <Play size={18} fill="currentColor" className="ml-0.5"/>}
                                                </button>
                                            </div>

                                            <div className="space-y-6 pt-4">
                                                <div className="flex items-start gap-4">
                                                    <div className="p-1 bg-slate-800 rounded mt-1.5 shrink-0"><HardDrive size={10} className="text-indigo-400"/></div>
                                                    <p className="text-xl md:text-2xl font-serif text-slate-200 leading-relaxed italic pr-12">"{v.en}"</p>
                                                </div>
                                                <div className="h-px bg-slate-800 w-12 group-hover:w-full transition-all duration-700"></div>
                                                <div className="flex items-start gap-4">
                                                    <div className="p-1 bg-slate-800 rounded mt-1.5 shrink-0"><Globe size={10} className="text-emerald-400"/></div>
                                                    <p className="text-xl md:text-2xl font-serif text-indigo-200/80 leading-relaxed pr-12">{v.zh}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {parsedVerses.length === 0 && (
                                    <div className="py-20 text-center text-slate-600 border-2 border-dashed border-slate-800 rounded-[3rem] flex flex-col items-center justify-center gap-4">
                                        <BrainCircuit size={64} className="opacity-10"/>
                                        <div className="space-y-1">
                                            <p className="font-black uppercase tracking-widest">Registry empty or unreachable.</p>
                                            <p className="text-xs text-slate-700">Attempting automatic node recovery if available.</p>
                                        </div>
                                        <button onClick={() => handlePreview(selectedChapter)} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all">Manual Retry</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default ScriptureIngest;
