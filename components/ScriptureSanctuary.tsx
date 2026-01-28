
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { GoogleGenAI } from '@google/genai';
import { 
  ArrowLeft, BookOpen, Scroll, Loader2, Play, Square, Pause, 
  Sparkles, Wand2, RefreshCw, RefreshCcw, BrainCircuit, Library, Lock, Palette, Cpu, Music, User, GraduationCap, Database, ChevronRight, ChevronDown, Bookmark, Search,
  AlertTriangle, Terminal, Maximize2, Minimize2, Volume2,
  LayoutGrid, ChevronLeft, Hash, Grid3X3, Info, SkipBack, SkipForward, Zap, Speaker, Settings2, Check, Globe, CloudCheck, CloudOff, CloudDownload, Radio,
  Bug, Film, X
} from 'lucide-react';
import { auth, storage } from '../services/firebaseConfig';
import { ref, listAll, getDownloadURL } from '@firebase/storage';
import { saveScriptureToLedger, getScriptureFromLedger, getScriptureAudioUrl } from '../services/firestoreService';
import { DualVerse } from '../types';
import { getGlobalAudioContext, warmUpAudioContext, registerAudioOwner, connectOutput } from '../utils/audioUtils';
import { synthesizeSpeech, TtsProvider } from '../services/tts';
import { Visualizer } from './Visualizer';

// --- SESSION CACHE LAYER ---
const SESSION_CHAPTER_CACHE = new Map<string, DualVerse[]>();

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

const NEURAL_PERSONAS = [
    { name: 'Default Gem', id: 'Default Gem', icon: Zap },
    { name: 'Software Interviewer', id: 'Software Interview Voice gen-lang-client-0648937375', icon: GraduationCap },
    { name: 'Kernel Architect', id: 'Linux Kernel Voice gen-lang-client-0375218270', icon: Cpu },
    { name: 'Puck (Classic)', id: 'Puck', icon: Music },
    { name: 'Fenrir (Deep)', id: 'Fenrir', icon: Radio }
];

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

const BIBLE_NAMES_ZH: Record<string, string> = {
    'Genesis': '创世记', 'Exodus': '出埃及记', 'Leviticus': '利未记', 'Numbers': '民数记', 'Deuteronomy': '申命记',
    'Joshua': '约书亚记', 'Judges': '士师记', 'Ruth': '路得记', '1 Samuel': '撒母耳记上', '2 Samuel': '撒耳记下',
    '1 Kings': '列王纪上', '2 Kings': '列王纪下', '1 Chronicles': '历代志上', '2 Chronicles': '历代志下',
    'Ezra': '以斯拉记', 'Nehemiah': '尼希米记', 'Esther': '以斯帖记', 'Job': '约伯记', 'Psalms': '诗篇',
    'Proverbs': '箴言', 'Ecclesiastes': '传道书', 'Song of Solomon': '雅歌', 'Isaiah': '以赛亚书',
    'Jeremiah': '耶利米书', 'Lamentations': '耶利米哀歌', 'Ezekiel': '以西结书', 'Daniel': '但以理书',
    'Hosea': '何西阿书', 'Joel': '约珥书', 'Amos': '阿摩司书', 'Obadiah': '俄底亚书', 'Jonah': '约拿书',
    'Micah': '弥迦书', 'Nahum': '那鸿书', 'Habakkuk': '哈巴谷书', 'Zephaniah': '西番雅书', 'Haggai': '哈该书',
    'Zechariah': '撒迦利亚书', 'Malachi': '玛拉基书',
    'Matthew': '马太福音', 'Mark': '马可福音', 'Luke': '路加福音', 'John': '约翰福音', 'Acts': '使徒行传',
    'Romans': '罗马书', '1 Corinthians': '哥林多前书', '2 Corinthians': '哥林多后书', 'Galatians': '加拉太书',
    'Ephesians': '以弗所书', 'Philippians': '腓立比书', 'Colossians': '歌罗西书', '1 Thessalonians': '帖撒罗尼迦前书',
    '2 Thessalonians': '帖撒罗尼迦后书', '1 Timothy': '提摩太前书', '2 Timothy': '提摩太后书', 'Titus': '提多书',
    'Philemon': '腓门书', 'Hebrews': '希伯来书', 'James': '雅各书', '1 Peter': '彼得前书', '2 Peter': '彼得后书',
    '1 John': '约翰一书', '2 John': '约翰二书', '3 John': '约翰三书', 'Jude': '犹大书', 'Revelation': '启示录'
};

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

export const ScriptureSanctuary: React.FC<ScriptureSanctuaryProps> = ({ onBack, language, isProMember }) => {
  const [activeTestament, setActiveTestament] = useState<'OT' | 'NT'>(() => (localStorage.getItem('last_bible_testament') as any) || 'NT');
  const [selectedBook, setSelectedBook] = useState(() => localStorage.getItem('last_bible_book') || 'John');
  const [selectedChapter, setSelectedChapter] = useState(() => localStorage.getItem('last_bible_chapter') || '1');
  const [viewMode, setViewMode] = useState<'chapters' | 'verses'>(() => (localStorage.getItem('last_bible_view_mode') as any) || 'chapters');
  const [parsedVerses, setParsedVerses] = useState<DualVerse[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentReadingIndex, setCurrentReadingIndex] = useState<number>(-1); 
  const [isReading, setIsReading] = useState(false);
  const [audioBuffering, setAudioBuffering] = useState(false);
  const [liveVolume, setLiveVolume] = useState(0);
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCinemaMode, setIsCinemaMode] = useState(true);
  const [dataSource, setDataSource] = useState<'archive' | 'neural' | 'syncing' | 'repair'>('syncing');
  const [ttsProvider, setTtsProvider] = useState<TtsProvider>(() => (localStorage.getItem('bible_tts_provider') as TtsProvider) || 'gemini');
  const [neuralPersona, setNeuralPersona] = useState(() => localStorage.getItem('bible_neural_persona') || 'Default Gem');
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [systemVoices, setSystemVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedSystemVoiceURI, setSelectedSystemVoiceURI] = useState(() => localStorage.getItem('bible_system_voice_uri') || '');
  const [vaultStatus, setVaultStatus] = useState<Record<string, 'exists' | 'missing' | 'checking' | 'corrupted'>>({});

  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const playbackSessionRef = useRef(0);
  const loadedKeyRef = useRef<string>('');
  const lastInitiatedKeyRef = useRef<string>(''); 
  const verseRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const MY_TOKEN = useMemo(() => `ScriptureSanctuary:${selectedBook}:${selectedChapter}`, [selectedBook, selectedChapter]);

  const dispatchLog = useCallback((text: string, type: 'info' | 'error' | 'success' | 'warn' = 'info') => {
      setDebugLogs(prev => [{ timestamp: new Date().toLocaleTimeString(), message: text, type }, ...prev].slice(0, 50));
      window.dispatchEvent(new CustomEvent('neural-log', { 
          detail: { text: `[Scripture] ${text}`, type } 
      }));
  }, []);

  const scanBookVault = useCallback(async (book: string) => {
    if (!storage) return;
    const bookStatus: Record<string, 'exists' | 'missing' | 'checking' | 'corrupted'> = {};
    const count = BIBLE_CHAPTER_COUNTS[book] || 0;
    for (let i = 1; i <= count; i++) bookStatus[i] = 'checking';
    setVaultStatus(bookStatus);
    
    dispatchLog(`Vault Handshake: Scanning ${book} registry...`, 'info');
    
    try {
        const folderRef = ref(storage, `bible_corpus/${book}`);
        const listRes = await listAll(folderRef);
        const existingChapters = listRes.items.map(item => item.name.replace('.json', ''));
        
        const finalStatus: Record<string, 'exists' | 'missing' | 'checking' | 'corrupted'> = {};
        for (let i = 1; i <= count; i++) {
            finalStatus[i] = existingChapters.includes(i.toString()) ? 'exists' : 'missing';
        }
        setVaultStatus(finalStatus);
        dispatchLog(`Vault Scan Complete for ${book}.`, 'success');
    } catch (e: any) {
        console.error("Vault scan failed", e);
        const failStatus: Record<string, 'exists' | 'missing' | 'checking' | 'corrupted'> = {};
        for (let i = 1; i <= count; i++) failStatus[i] = 'missing';
        setVaultStatus(failStatus);
    }
  }, [dispatchLog]);

  useEffect(() => {
    if (viewMode === 'chapters') {
        scanBookVault(selectedBook);
    }
  }, [selectedBook, viewMode, scanBookVault]);

  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      const filtered = voices.filter(v => v.lang.startsWith('zh') || v.lang.startsWith('en'));
      setSystemVoices(filtered);
    };
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const stopReading = useCallback(() => {
      playbackSessionRef.current++;
      setIsReading(false);
      setAudioBuffering(false);
      setCurrentReadingIndex(-1);
      setLiveVolume(0);
      activeSourcesRef.current.forEach(s => { try { s.stop(); s.disconnect(); } catch(e) {} });
      activeSourcesRef.current.clear();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
  }, []);

  const handleRefractScripture = useCallback(async (book: string, chapter: string, force = false) => {
    const key = `${book}_${chapter}`;
    
    if (!force && SESSION_CHAPTER_CACHE.has(key)) {
        dispatchLog(`Local Refraction Hit: Resuming ${key} from session cache.`, 'success');
        setParsedVerses(SESSION_CHAPTER_CACHE.get(key)!);
        setDataSource('archive');
        setViewMode('verses');
        loadedKeyRef.current = key;
        return;
    }

    setIsSyncing(true);
    setViewMode('verses');
    setParsedVerses([]); 
    setDataSource('syncing');
    
    const normalizedBookLocal = book.trim().charAt(0).toUpperCase() + book.trim().slice(1).toLowerCase();
    
    dispatchLog(`Handshaking Ledger for ${normalizedBookLocal} ${chapter}...`, 'info');

    localStorage.setItem('last_bible_book', book);
    localStorage.setItem('last_bible_chapter', chapter);
    localStorage.setItem('last_bible_view_mode', 'verses');

    try {
      const dataFound = await getScriptureFromLedger(normalizedBookLocal, chapter);

      if (dataFound && dataFound.verses && dataFound.verses.length > 0) {
          setParsedVerses(dataFound.verses); 
          SESSION_CHAPTER_CACHE.set(key, dataFound.verses);
          loadedKeyRef.current = key;
          setDataSource('archive');
          setIsSyncing(false);
          dispatchLog(`Ledger Hit: Hydrated ${dataFound.verses.length} nodes from database.`, 'success');
          return;
      }

      dispatchLog(`Ledger Miss. Activating Neural Core for ${book} ${chapter}...`, 'info');

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContentStream({
        model: 'gemini-3-flash-preview',
        contents: `Generate all verses of ${book} chapter ${chapter}. Output format strictly: VerseNumber | EnglishText | ChineseText. One verse per line. No headers.`,
      });

      let buffer = '';
      let streamVerses: DualVerse[] = [];
      let isFirstCommit = true;
      
      for await (const chunk of response) {
          buffer += chunk.text;
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; 
          
          const newBatch = lines.map(line => {
              const parts = line.split('|').map(p => p.trim());
              if (parts.length >= 3) {
                  return {
                      number: parts[0],
                      en: parts[1],
                      zh: parts[2],
                      uid: `bible_${book.toLowerCase().replace(/\s+/g, '_')}_${chapter}_v${parts[0]}`
                  };
              }
              return null;
          }).filter(v => v !== null) as DualVerse[];

          if (newBatch.length > 0) {
              setParsedVerses(prev => {
                  const base = isFirstCommit ? [] : prev;
                  isFirstCommit = false;
                  const existingNumbers = new Set(base.map(v => v.number));
                  const unique = newBatch.filter(v => !existingNumbers.has(v.number));
                  const result = [...base, ...unique];
                  streamVerses = result; 
                  return result;
              });
          }
      }
      
      if (streamVerses.length > 0) {
          setDataSource('neural');
          SESSION_CHAPTER_CACHE.set(key, streamVerses);
          saveScriptureToLedger(normalizedBookLocal, chapter, streamVerses);
          loadedKeyRef.current = key;
          dispatchLog(`Neural Synthesis finalized. Ledger entry updated.`, 'success');
      }

    } catch (e: any) { 
        dispatchLog(`Neural Core Interrupted: ${e.message}`, 'error'); 
    }
    finally { 
        setIsSyncing(false);
    }
  }, [dispatchLog]);

  useEffect(() => {
    const currentKey = `${selectedBook}_${selectedChapter}_${viewMode}`;
    if (lastInitiatedKeyRef.current === currentKey) return;
    lastInitiatedKeyRef.current = currentKey;
    if (viewMode === 'verses') {
      handleRefractScripture(selectedBook, selectedChapter);
    }
  }, [selectedBook, selectedChapter, viewMode, handleRefractScripture]);

  const startReadingSequence = async (startIndex: number) => {
      const actualStart = startIndex < 0 ? 0 : startIndex;
      stopReading();
      setIsReading(true);
      
      const localSession = ++playbackSessionRef.current;
      registerAudioOwner(MY_TOKEN, stopReading);

      const ctx = getGlobalAudioContext();
      await warmUpAudioContext(ctx);

      dispatchLog(`Bilingual Sync Active: @ Node ${actualStart + 1}`, 'info');

      for (let i = actualStart; i < parsedVerses.length; i++) {
          if (localSession !== playbackSessionRef.current) return;
          const verse = parsedVerses[i];
          setCurrentReadingIndex(i);
          
          requestAnimationFrame(() => {
            const el = verseRefs.current[verse.number];
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          });

          // 1. English Part
          setAudioBuffering(true);
          try {
              if (ttsProvider === 'system') {
                  setAudioBuffering(false);
                  setLiveVolume(0.8);
                  await new Promise<void>((resolve, reject) => {
                      const utterance = new SpeechSynthesisUtterance(verse.en);
                      utterance.lang = 'en-US';
                      const voices = window.speechSynthesis.getVoices();
                      const chosenVoice = voices.find(v => v.lang.startsWith('en'));
                      if (chosenVoice) utterance.voice = chosenVoice;
                      utterance.onend = () => { setLiveVolume(0); resolve(); };
                      utterance.onerror = (e) => reject(new Error(e.error));
                      window.speechSynthesis.speak(utterance);
                  });
              } else {
                  // CRITICAL: Fixed metadata key mapping to match TtsResult expectation
                  const resultEn = await synthesizeSpeech(verse.en, neuralPersona, ctx, ttsProvider, 'en', {
                      channelId: selectedBook, topicId: selectedChapter, nodeId: `node_${selectedBook}_${selectedChapter}_${verse.number}_en`
                  });
                  setAudioBuffering(false);
                  if (resultEn.buffer && localSession === playbackSessionRef.current) {
                      setLiveVolume(0.8);
                      await new Promise<void>((resolve) => {
                          const source = ctx.createBufferSource();
                          source.buffer = resultEn.buffer;
                          connectOutput(source, ctx);
                          activeSourcesRef.current.add(source);
                          source.onended = () => { activeSourcesRef.current.delete(source); setLiveVolume(0); resolve(); };
                          source.start(0);
                      });
                  } else if (!resultEn.buffer) {
                      dispatchLog(`Node ${verse.number} EN: Ledger miss & API empty.`, 'warn');
                  }
              }
          } catch (err: any) {
              setAudioBuffering(false);
              dispatchLog(`Node ${verse.number} EN Error: ${err.message}`, 'warn');
          }

          if (localSession !== playbackSessionRef.current) return;
          await new Promise(r => setTimeout(r, 600));

          // 2. Chinese Part
          setAudioBuffering(true);
          try {
              if (ttsProvider === 'system') {
                  setAudioBuffering(false);
                  setLiveVolume(0.8);
                  await new Promise<void>((resolve, reject) => {
                      const utterance = new SpeechSynthesisUtterance(verse.zh);
                      utterance.lang = 'zh-CN';
                      const voices = window.speechSynthesis.getVoices();
                      const chosenVoice = voices.find(v => v.lang.startsWith('zh'));
                      if (chosenVoice) utterance.voice = chosenVoice;
                      utterance.onend = () => { setLiveVolume(0); resolve(); };
                      utterance.onerror = (e) => reject(new Error(e.error));
                      window.speechSynthesis.speak(utterance);
                  });
              } else {
                  // CRITICAL: Fixed metadata key mapping to match TtsResult expectation
                  const resultZh = await synthesizeSpeech(verse.zh, 'Kore', ctx, ttsProvider, 'zh', {
                      channelId: selectedBook, topicId: selectedChapter, nodeId: `node_${selectedBook}_${selectedChapter}_${verse.number}_zh`
                  });
                  setAudioBuffering(false);
                  if (resultZh.buffer && localSession === playbackSessionRef.current) {
                      setLiveVolume(0.8);
                      await new Promise<void>((resolve) => {
                          const source = ctx.createBufferSource();
                          source.buffer = resultZh.buffer;
                          connectOutput(source, ctx);
                          activeSourcesRef.current.add(source);
                          source.onended = () => { activeSourcesRef.current.delete(source); setLiveVolume(0); resolve(); };
                          source.start(0);
                      });
                  }
              }
          } catch (err: any) {
              setAudioBuffering(false);
              dispatchLog(`Node ${verse.number} ZH Error: ${err.message}`, 'warn');
          }
          
          if (localSession !== playbackSessionRef.current) return;
          await new Promise(r => setTimeout(r, 1000));
      }
      setIsReading(false);
      setCurrentReadingIndex(-1);
  };

  const filteredBooks = useMemo(() => {
      const list = activeTestament === 'OT' ? OLD_TESTAMENT : NEW_TESTAMENT;
      if (!searchQuery) return list;
      const q = searchQuery.toLowerCase();
      return list.filter(b => b.toLowerCase().includes(q) || (BIBLE_NAMES_ZH[b] || '').includes(q));
  }, [activeTestament, searchQuery]);

  return (
    <div className={`h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans ${isCinemaMode ? 'cinema-bg' : ''}`}>
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-50">
        <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"><ArrowLeft size={20} /></button>
            <div>
              <h1 className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-widest"><Scroll className="text-amber-500" size={16} /> Scripture Sanctuary</h1>
              <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{selectedBook} {viewMode === 'verses' ? `Chapter ${selectedChapter}` : ''}</p>
            </div>
        </div>
        <div className="flex items-center gap-2">
            <button onClick={() => setShowDebugPanel(!showDebugPanel)} className={`p-2 rounded-lg transition-colors ${showDebugPanel ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`} title="Registry Log"><Bug size={18}/></button>
            <button onClick={() => setShowVoiceSettings(!showVoiceSettings)} className={`p-2 rounded-lg transition-colors ${showVoiceSettings ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`} title="Neural Voice Settings"><Settings2 size={18}/></button>
            <button onClick={() => setIsCinemaMode(!isCinemaMode)} className={`p-2 rounded-lg transition-colors ${isCinemaMode ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`} title="Cinema Mode"><Film size={18}/></button>
            <div className="w-px h-6 bg-slate-800 mx-2"></div>
            {viewMode === 'verses' && (
                <button onClick={() => setViewMode('chapters')} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Close Chapter</button>
            )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar: Library Navigator */}
        <div className="w-80 border-r border-slate-800 bg-slate-900/30 flex flex-col shrink-0">
            <div className="p-4 bg-slate-950/50 border-b border-slate-800 flex flex-col gap-3">
                <div className="flex gap-1">
                    <button onClick={() => setActiveTestament('OT')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTestament === 'OT' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Old Testament</button>
                    <button onClick={() => setActiveTestament('NT')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTestament === 'NT' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>New Testament</button>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14}/>
                    <input type="text" placeholder="Search books..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"/>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hide">
                {filteredBooks.map(b => (
                    <button 
                        key={b} 
                        onClick={() => { setSelectedBook(b); setViewMode('chapters'); stopReading(); }} 
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition-all ${selectedBook === b ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}
                    >
                        <div className="flex flex-col items-start">
                            <span className="uppercase tracking-tight">{b}</span>
                            <span className="text-[9px] font-black text-white/40 mt-0.5">{BIBLE_NAMES_ZH[b]}</span>
                        </div>
                        {selectedBook === b && <ChevronRight size={14}/>}
                    </button>
                ))}
            </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
            {showDebugPanel && (
                <div className="absolute top-0 left-0 right-0 h-64 bg-slate-950/95 border-b border-indigo-500/30 shadow-2xl z-40 flex flex-col animate-fade-in-up backdrop-blur-md">
                    <div className="p-3 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Neural Diagnostic Matrix</span>
                        <button onClick={() => setShowDebugPanel(false)} className="text-slate-500 hover:text-white"><X size={14}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 font-mono text-[9px] space-y-1 scrollbar-hide">
                        {debugLogs.map((log, i) => (
                            <div key={i} className="flex gap-4 p-1 rounded hover:bg-white/5">
                                <span className="opacity-30 shrink-0">{log.timestamp}</span>
                                <span className={`flex-1 ${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-emerald-400' : log.type === 'warn' ? 'text-amber-400' : 'text-slate-400'}`}>{log.message}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {showVoiceSettings && (
                <div className="absolute top-0 right-0 w-80 h-full bg-slate-900 border-l border-slate-800 shadow-2xl z-[60] flex flex-col animate-fade-in-right p-6 space-y-8">
                    <div className="flex justify-between items-center"><h3 className="font-bold text-white uppercase tracking-widest text-sm flex items-center gap-2"><Speaker size={18} className="text-indigo-400"/> Voice Engine</h3><button onClick={() => setShowVoiceSettings(false)} className="text-slate-500 hover:text-white"><X/></button></div>
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Provider Spectrum</label>
                        <div className="flex p-1 bg-slate-950 rounded-xl border border-slate-800 shadow-inner">
                            <button onClick={() => { setTtsProvider('gemini'); localStorage.setItem('bible_tts_provider', 'gemini'); }} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${ttsProvider === 'gemini' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>Gemini</button>
                            <button onClick={() => { setTtsProvider('openai'); localStorage.setItem('bible_tts_provider', 'openai'); }} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${ttsProvider === 'openai' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>OpenAI</button>
                            <button onClick={() => { setTtsProvider('system'); localStorage.setItem('bible_tts_provider', 'system'); }} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${ttsProvider === 'system' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-50'}`}>System</button>
                        </div>
                    </div>
                    {ttsProvider !== 'system' ? (
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Neural Persona</label>
                            <div className="space-y-2">
                                {NEURAL_PERSONAS.map(p => (
                                    <button key={p.id} onClick={() => { setNeuralPersona(p.id); localStorage.setItem('bible_neural_persona', p.id); }} className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-3 ${neuralPersona === p.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'}`}>
                                        <p.icon size={14}/>
                                        <span className="text-xs font-bold">{p.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                             <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Local Voice Engine</label>
                             <select value={selectedSystemVoiceURI} onChange={e => { setSelectedSystemVoiceURI(e.target.value); localStorage.setItem('bible_system_voice_uri', e.target.value); }} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500">
                                 {systemVoices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
                             </select>
                        </div>
                    )}
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-8 lg:p-16 scrollbar-hide bg-slate-950">
                {viewMode === 'chapters' ? (
                    <div className="max-w-5xl mx-auto space-y-12 animate-fade-in-up">
                        <div className="flex items-end justify-between border-b border-slate-800 pb-8">
                            <div>
                                <h2 className="text-6xl font-black text-white italic tracking-tighter uppercase leading-none">{selectedBook}</h2>
                                <p className="text-indigo-400 text-sm font-bold uppercase tracking-[0.3em] mt-3">Registry Index • {BIBLE_CHAPTER_COUNTS[selectedBook]} Chapters</p>
                            </div>
                            <div className="flex gap-4">
                                <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div>
                                    <span className="text-[10px] font-black uppercase text-slate-400">Vault Connected</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
                            {Array.from({ length: BIBLE_CHAPTER_COUNTS[selectedBook] || 0 }, (_, i) => (i + 1).toString()).map(ch => {
                                const status = vaultStatus[ch];
                                return (
                                    <button 
                                        key={ch}
                                        onClick={() => { setSelectedChapter(ch); setViewMode('verses'); }}
                                        className={`aspect-square flex flex-col items-center justify-center rounded-2xl border transition-all relative overflow-hidden group ${selectedChapter === ch ? 'bg-indigo-600 border-indigo-500 text-white shadow-xl scale-105' : 'bg-slate-900/40 border-slate-800 text-slate-500 hover:border-indigo-500'}`}
                                    >
                                        <span className="text-lg font-black">{ch}</span>
                                        {status === 'exists' && (
                                            <div className="mt-1 flex gap-0.5">
                                                <div className="w-1 h-1 rounded-full bg-emerald-500"></div>
                                                <div className="w-1 h-1 rounded-full bg-amber-500 opacity-40"></div>
                                            </div>
                                        )}
                                        {status === 'checking' && <Loader2 size={10} className="animate-spin mt-1 opacity-20"/>}
                                        <div className="absolute inset-0 bg-indigo-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Play size={18} fill="currentColor"/>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="max-w-4xl mx-auto space-y-12 pb-40">
                        {/* Verses Control Bar */}
                        <div className="flex items-center justify-between sticky top-0 z-30 py-4 bg-slate-950/80 backdrop-blur-md px-2 -mx-2 rounded-b-3xl border-b border-white/5">
                            <div className="flex items-center gap-4">
                                <div className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-4 shadow-xl">
                                    <button 
                                        onClick={() => startReadingSequence(currentReadingIndex)}
                                        className={`p-3 rounded-xl transition-all shadow-lg active:scale-95 ${isReading ? 'bg-red-600 text-white shadow-red-900/20' : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-900/20'}`}
                                    >
                                        {audioBuffering ? <Loader2 size={18} className="animate-spin"/> : isReading ? <Pause size={18} fill="currentColor"/> : <Play size={18} fill="currentColor" className="ml-0.5"/>}
                                    </button>
                                    <button onClick={stopReading} disabled={!isReading} className={`p-3 rounded-xl transition-colors ${isReading ? 'text-slate-400 hover:text-white bg-slate-800' : 'text-slate-700 bg-slate-900'}`}><Square size={18} fill="currentColor"/></button>
                                    <div className="w-px h-6 bg-slate-800 mx-1"></div>
                                    <div className="flex items-center gap-4">
                                        <div className="w-24 h-6 rounded-full overflow-hidden bg-slate-950"><Visualizer volume={liveVolume} isActive={isReading} color="#fbbf24"/></div>
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">{isReading ? 'Syncing Neural Audio' : 'Audio Engine Ready'}</span>
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{neuralPersona.split(' gen-')[0]} • {ttsProvider.toUpperCase()}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-3">
                                {dataSource === 'archive' && <div className="px-3 py-1.5 bg-emerald-900/20 text-emerald-400 text-[9px] font-black uppercase rounded-lg border border-emerald-500/20 flex items-center gap-1.5 shadow-lg"><Database size={12}/> Community Ledger</div>}
                                {dataSource === 'neural' && <div className="px-3 py-1.5 bg-indigo-900/20 text-indigo-400 text-[9px] font-black uppercase rounded-lg border border-emerald-500/20 flex items-center gap-1.5 shadow-lg"><Zap size={12} fill="currentColor"/> Neural Synthesis</div>}
                                <button onClick={() => handleRefractScripture(selectedBook, selectedChapter, true)} className="p-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 hover:text-white transition-all shadow-xl" title="Force Refraction"><RefreshCcw size={18}/></button>
                            </div>
                        </div>

                        <div className="text-center space-y-4 py-10">
                            <h2 className="text-7xl font-black text-white italic tracking-tighter uppercase leading-none">{selectedBook} {selectedChapter}</h2>
                            <div className="w-24 h-1.5 bg-amber-500 mx-auto rounded-full shadow-[0_0_15px_rgba(245,158,11,0.4)]"></div>
                            <p className="text-[10px] text-slate-500 uppercase font-black tracking-[0.4em] pt-2">{BIBLE_NAMES_ZH[selectedBook]} • 第 {selectedChapter} 章</p>
                        </div>

                        {isSyncing && parsedVerses.length === 0 ? (
                            <div className="py-24 flex flex-col items-center justify-center gap-8 text-center animate-pulse">
                                <div className="relative">
                                    <div className="w-24 h-24 border-4 border-indigo-500/10 rounded-full"></div>
                                    <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                    <div className="absolute inset-0 flex items-center justify-center"><Wand2 size={32} className="text-indigo-400" /></div>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-sm font-black uppercase text-white tracking-[0.2em]">Paging Neural Record</p>
                                    <p className="text-[10px] text-slate-500 font-mono">Initializing handshake with knowledge database...</p>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-12">
                                {parsedVerses.map((v, i) => {
                                    const isCurrent = i === currentReadingIndex;
                                    return (
                                        <div 
                                            key={v.number} 
                                            ref={el => { verseRefs.current[v.number] = el; }}
                                            className={`transition-all duration-1000 ease-in-out flex flex-col gap-8 relative ${isCurrent ? 'opacity-100 scale-100 translate-x-4' : 'opacity-40 scale-95 hover:opacity-100 translate-x-0'}`}
                                        >
                                            {isCurrent && <div className="absolute -left-8 top-0 bottom-0 w-1 bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)] animate-pulse"></div>}
                                            
                                            <div className="flex items-start gap-8">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black shrink-0 transition-all ${isCurrent ? 'bg-amber-500 text-black shadow-2xl scale-110' : 'bg-slate-900 text-slate-700 border border-slate-800'}`}>
                                                    {v.number}
                                                </div>
                                                <div className="space-y-6 flex-1">
                                                    <p className={`text-2xl md:text-3xl font-serif leading-relaxed italic transition-colors duration-700 ${isCurrent ? 'text-white' : 'text-slate-300'}`}>
                                                        "{v.en}"
                                                    </p>
                                                    <div className={`h-px bg-gradient-to-r from-slate-800 via-slate-700 to-transparent w-full transition-all duration-700 ${isCurrent ? 'opacity-100' : 'opacity-30'}`}></div>
                                                    <p className={`text-2xl md:text-3xl font-serif leading-relaxed transition-colors duration-700 ${isCurrent ? 'text-indigo-200' : 'text-slate-500'}`}>
                                                        {v.zh}
                                                    </p>
                                                </div>
                                                <div className="flex flex-col gap-2 pt-1 opacity-0 hover:opacity-100 transition-opacity">
                                                    <button onClick={() => startReadingSequence(i)} className="p-2 bg-slate-800 hover:bg-indigo-600 rounded-lg text-slate-400 hover:text-white transition-all"><Play size={16}/></button>
                                                    <button className="p-2 bg-slate-800 hover:bg-amber-600 rounded-lg text-slate-400 hover:text-white transition-all"><Bookmark size={16}/></button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {isSyncing && parsedVerses.length > 0 && (
                            <div className="py-20 flex flex-col items-center gap-4 animate-pulse border-t border-slate-800/50">
                                <RefreshCw className="animate-spin text-indigo-500" size={32}/>
                                <p className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">Streaming Neural Artifacts...</p>
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

export default ScriptureSanctuary;
