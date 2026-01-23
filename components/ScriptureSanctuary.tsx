
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { GoogleGenAI } from '@google/genai';
import { 
  ArrowLeft, Book, Sparkles, Wand2, Search, Loader2, Play, Share2, Info, 
  ChevronRight, ChevronLeft, BookOpen, Quote, Library, Scroll, Zap, 
  ImageIcon, Camera, RefreshCw, Send, BrainCircuit, ShieldCheck, Heart, 
  Bookmark, MessageCircleCode, Volume2, History, Link2, Presentation, 
  Music, Film, Video, Download, X, MoreVertical, Star, CheckCircle, ExternalLink,
  List, Copy, Check, Save, Globe, AlertTriangle, Youtube, HelpCircle,
  ShieldAlert, RefreshCcw, CreditCard, ShieldX, Key, Square, ArrowRight, Database,
  Languages, Pause, Activity, ClipboardList, Timer, ZapOff, Cpu, ChevronDown, Speech,
  ZapOff as CircuitBreaker, Cloud, ShieldAlert as GcpError, Settings, ExternalLink as LinkIcon,
  Lock, Youtube as YoutubeIcon, FileVideo, SaveAll, HardDrive, AlertCircle as Warning,
  VolumeX, Headphones, BookCheck, Type as TypeIcon, Palette, Terminal, Bug, Trash2,
  Columns, Layers, Layout, Settings2, Monitor, Speaker, Menu, User, GraduationCap
} from 'lucide-react';
import { MarkdownView } from './MarkdownView';
import { db, auth, storage } from '../services/firebaseConfig';
import { doc, setDoc, getDoc, collection } from '@firebase/firestore';
import { ref, getDownloadURL } from '@firebase/storage';
import { generateSecureId } from '../utils/idUtils';
import { getDriveToken, signInWithGoogle } from '../services/authService';
import { uploadToYouTube, getYouTubeVideoUrl, getYouTubeEmbedUrl } from '../services/youtubeService';
import { getUserProfile, isUserAdmin, saveScriptureToVault, getScriptureAudioUrl, uploadScriptureAudio } from '../services/firestoreService';
import { UserProfile, DualVerse } from '../types';
import { getGlobalAudioContext, registerAudioOwner, stopAllPlatformAudio, getGlobalAudioGeneration, warmUpAudioContext, decodeRawPcm } from '../utils/audioUtils';
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

const UI_TEXT = {
  en: {
    appTitle: "Scripture Sanctuary",
    book: "Book",
    chapter: "Chapter",
    translation: "Translation",
    openPassage: "Open Passage",
    quickActions: "Quick Refraction",
    explain: "Explain Verses",
    generateVideo: "Cinematic Film",
    readText: "Audio Reader",
    stopAudio: "Stop Reading",
    videoStatus: [
        "Initializing Veo Core...",
        "Simulating Light Particles...",
        "Encoding Neural Frames...",
        "Finalizing Video Stream...",
        "Syndicating to Sovereign Vault (YouTube)..."
    ],
    videoSuccess: "Video Ready",
    forceRegen: "Force Neural Refraction",
    proRequired: "Pro Membership Required",
    waiting: "Buffering Neural Stream...",
    youtubeSync: "Syndicating to YouTube...",
    bakeTitle: "Bake to Sanctuary Vault",
    bakeDesc: "Persist AI-generated text for instant community loading.",
    vaultVerified: "Vault Verified",
    neuralFallback: "Neural Fallback",
    bakingInProgress: "Synchronizing with Vault...",
    selectKey: "Select Veo API Key",
    keyNotice: "A paid Google Cloud project key with Vertex AI enabled is required for video generation.",
    viewMode: "Linguistic Mode",
    audioLang: "Audio Language",
    dual: "Bilingual",
    enOnly: "English Only",
    zhOnly: "Chinese Only",
    bufferingAudio: "Synthesizing Voice...",
    nowReading: "Now Reading Verse",
    generatingArt: "Painting Neural Scene...",
    verseArt: "Verse Visualization",
    debugTitle: "Neural Debug Console",
    oldTestament: "Old Testament",
    newTestament: "New Testament",
    selectBook: "Select a Book",
    selectChapter: "Select Chapter",
    engine: "Neural Voice Engine",
    browse: "Browse Library",
    nextChapter: "Next Chapter",
    prevChapter: "Prev Chapter",
    persona: "Voice Persona",
    quotaExhausted: "AI Quota Exhausted. Falling back to system voice.",
    dailyLimitReached: "DAILY QUOTA REACHED: Gemini TTS limit (100) exceeded. Switching to Google Cloud Engine.",
    voiceNotFound: "Voice Config Error: All fallback GCP voices are disabled in your project. Using System Fallback. Please check Cloud Console.",
    resume: "Resume Reading"
  },
  zh: {
    appTitle: "经文圣所",
    book: "卷",
    chapter: "章",
    translation: "译本",
    openPassage: "开启经文",
    quickActions: "快速折射",
    explain: "解释经文",
    generateVideo: "电影短片",
    readText: "语音朗读",
    stopAudio: "停止朗读",
    videoStatus: [
        "正在初始化 Veo 核心...",
        "正在模拟光影粒子...",
        "正在编码神经帧...",
        "正在完成视频流...",
        "正在同步至主权库 (YouTube)..."
    ],
    videoSuccess: "视频已就绪",
    forceRegen: "强制神经折射",
    proRequired: "需要 Pro 会员权限",
    waiting: "正在加载神经流...",
    youtubeSync: "正在发布到 YouTube...",
    bakeTitle: "持久化到圣所金库",
    bakeDesc: "将 AI 生成的文本保存到金库，供社区秒级加载。",
    vaultVerified: "金库已验证",
    neuralFallback: "神经生成",
    bakingInProgress: "正在同步金库...",
    selectKey: "选择 Veo API 密钥",
    keyNotice: "视频生成需要启用了 Vertex AI 的付费 Google Cloud 项目密钥。",
    viewMode: "语言模式",
    audioLang: "朗读语言",
    dual: "双语",
    enOnly: "仅英文",
    zhOnly: "仅中文",
    bufferingAudio: "语音合成中...",
    nowReading: "正在朗读第",
    generatingArt: "正在绘制神经场景...",
    verseArt: "经文可视化",
    debugTitle: "神经调试控制台",
    oldTestament: "旧约",
    newTestament: "新约",
    selectBook: "选择书卷",
    selectChapter: "选择章节",
    engine: "神经语音引擎",
    browse: "浏览书库",
    nextChapter: "下一章",
    prevChapter: "上一章",
    persona: "语音人格",
    quotaExhausted: "AI 配额已耗尽。正在切换到系统语音。",
    dailyLimitReached: "每日配额已达上限：Gemini TTS 每日限制 (100) 已超出。切换至 Google Cloud 引擎。",
    voiceNotFound: "语音配置错误：所有后备 GCP 语音在您的项目中均未启用。已切换到系统默认语音。请检查 Cloud 控制台设置。",
    resume: "继续朗读"
  }
};

const PERSONA_VOICES = [
    { id: 'Default Gem', icon: Sparkles },
    { id: 'Software Interview Voice gen-lang-client-0648937375', label: 'Senior Interviewer', icon: GraduationCap },
    { id: 'Linux Kernel Voice gen-lang-client-0375218270', label: 'Kernel Maintainer', icon: Cpu },
    { id: 'Charon', icon: User },
    { id: 'Kore', icon: Music },
    { id: 'Puck', icon: Zap }
];

const BIBLE_BOOKS_OT_EN = ["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi"];
const BIBLE_BOOKS_NT_EN = ["Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"];

const BIBLE_BOOKS_OT_ZH = ["创世记", "出埃及记", "利未记", "民数记", "申命记", "约书亚记", "士师记", "路得记", "撒母耳记上", "撒母耳记下", "列王纪上", "列王纪下", "历代志上", "历代志下", "以斯拉记", "尼希米记", "以斯帖记", "约伯记", "诗篇", "箴言", "传道书", "雅歌", "以赛亚书", "耶利米书", "耶利米哀歌", "以世结书", "但以理书", "和休阿书", "约珥书", "阿摩司书", "俄巴底亚书", "约拿书", "弥迦书", "那鸿书", "哈巴谷书", "西番雅书", "哈该书", "撒迦利亚书", "玛拉基书"];
const BIBLE_BOOKS_NT_ZH = ["马太福音", "马可福音", "路加福音", "约翰福音", "使徒行传", "罗马书", "哥林多前书", "哥林多后书", "加拉太书", "以弗所书", "腓立比书", "歌罗西书", "帖撒罗尼迦前书", "帖撒罗尼迦后书", "提摩太前书", "提摩太后书", "提多书", "腓利门书", "希伯来书", "雅各书", "彼得前书", "彼得后书", "约翰一书", "约翰二书", "约翰三书", "犹大书", "启示录"];

const ALL_BOOKS_EN = [...BIBLE_BOOKS_OT_EN, ...BIBLE_BOOKS_NT_EN];
const ALL_BOOKS_ZH = [...BIBLE_BOOKS_OT_ZH, ...BIBLE_BOOKS_NT_ZH];

const CHAPTER_COUNTS: Record<string, number> = {
  "Genesis": 50, "Exodus": 40, "Leviticus": 27, "Numbers": 36, "Deuteronomy": 34, "Joshua": 24, "Judges": 21, "Ruth": 4, "1 Samuel": 31, "2 Samuel": 24, "1 Kings": 22, "2 Kings": 25, "1 Chronicles": 29, "2 Chronicles": 36, "Ezra": 10, "Nehemiah": 13, "Esther": 10, "Job": 42, "Psalms": 150, "Proverbs": 31, "Ecclesiastes": 12, "Song of Solomon": 8, "Isaiah": 66, "Jeremiah": 52, "Lamentations": 5, "Ezekiel": 48, "Daniel": 12, "Hosea": 14, "Joel": 3, "Amos": 9, "Obadiah": 1, "Jonah": 4, "Micah": 7, "Nahum": 3, "Habakkuk": 3, "Zephaniah": 3, "Haggai": 2, "Zechariah": 14, "Malachi": 4,
  "Matthew": 28, "Mark": 16, "Luke": 24, "John": 21, "Acts": 28, "Romans": 16, "1 Corinthians": 16, "2 Corinthians": 13, "Galatians": 6, "Ephesians": 6, "Philippians": 4, "Colossians": 4, "1 Thessalonians": 5, "2 Thessalonians": 3, "1 Timothy": 6, "2 Timothy": 4, "Titus": 3, "Philemon": 1, "Hebrews": 13, "James": 5, "1 Peter": 5, "2 Peter": 3, "1 John": 5, "2 John": 1, "3 John": 1, "Jude": 1, "Revelation": 22
};

export const ScriptureSanctuary: React.FC<ScriptureSanctuaryProps> = ({ onBack, language, isProMember }) => {
  const t = UI_TEXT[language];
  const [testament, setTestament] = useState<'ot' | 'nt'>('nt');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 1024 : false);
  
  const booksEn = testament === 'ot' ? BIBLE_BOOKS_OT_EN : BIBLE_BOOKS_NT_EN;
  const currentBooks = language === 'zh' ? (testament === 'ot' ? BIBLE_BOOKS_OT_ZH : BIBLE_BOOKS_NT_ZH) : booksEn;

  const sessionKey = useMemo(() => `sanctuary_session_${auth.currentUser?.uid || 'guest'}`, []);
  
  const [selectedBook, setSelectedBook] = useState(() => {
      const saved = localStorage.getItem(`${sessionKey}_book`);
      return saved && (ALL_BOOKS_EN.includes(saved) || ALL_BOOKS_ZH.includes(saved)) ? saved : currentBooks[0];
  });
  
  const [selectedChapter, setSelectedChapter] = useState(() => {
      return localStorage.getItem(`${sessionKey}_chapter`) || '1';
  });

  const [parsedVerses, setParsedVerses] = useState<DualVerse[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [labResult, setLabResult] = useState<{ type: string, content: any, title: string, youtubeUrl?: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  const [viewMode, setViewMode] = useState<'dual' | 'en' | 'zh'>('dual');
  const [readingLang, setReadingLang] = useState<'en' | 'zh'>(language);
  const [ttsProvider, setTtsProvider] = useState<TtsProvider>('google'); 
  const [selectedPersona, setSelectedPersona] = useState<string>('Default Gem');
  
  const [isReading, setIsReading] = useState(false);
  const [currentReadingIndex, setCurrentReadingIndex] = useState<number>(0); 
  const [audioBuffering, setAudioBuffering] = useState(false);
  
  const playbackSessionRef = useRef(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const verseRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [dataSource, setDataSource] = useState<'vault' | 'ai' | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Added ref to break circular dependency between reading functions
  const startReadingSequenceRef = useRef<any>(null);

  /**
   * Helper to resolve the English storage key for a book name in either language.
   * This ensures consistent lookup in CHAPTER_COUNTS.
   */
  const getStorageBookName = useCallback((book: string) => {
    let idx = ALL_BOOKS_EN.indexOf(book);
    if (idx !== -1) return ALL_BOOKS_EN[idx];
    
    idx = ALL_BOOKS_ZH.indexOf(book);
    if (idx !== -1) return ALL_BOOKS_EN[idx];
    
    return book;
  }, []);

  const addDebugLog = useCallback((message: string, type: DebugLog['type'] = 'info', details?: string) => {
    const log: DebugLog = {
      timestamp: new Date().toLocaleTimeString(),
      message,
      type,
      details
    };
    setDebugLogs(prev => [log, ...prev].slice(0, 100));
  }, []);

  const stopReading = useCallback(() => {
      playbackSessionRef.current++;
      setIsReading(false);
      setAudioBuffering(false);
      activeSourcesRef.current.forEach(s => { try { s.stop(); s.disconnect(); } catch(e) {} });
      activeSourcesRef.current.clear();
      if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
  }, []);

  const resetPlaybackState = useCallback(() => {
      stopReading();
      setCurrentReadingIndex(0);
  }, [stopReading]);

  const getNextPath = useCallback((bookName: string, chapterNum: string) => {
      const storageBookName = getStorageBookName(bookName);
      const chCount = CHAPTER_COUNTS[storageBookName] || 1;
      const currentChInt = parseInt(chapterNum);

      if (currentChInt < chCount) {
          return { nextBook: bookName, nextChapter: (currentChInt + 1).toString() };
      } else {
          const globalIdx = ALL_BOOKS_EN.indexOf(storageBookName);
          if (globalIdx !== -1 && globalIdx < ALL_BOOKS_EN.length - 1) {
              const nextBookDisplay = language === 'zh' ? ALL_BOOKS_ZH[globalIdx + 1] : ALL_BOOKS_EN[globalIdx + 1];
              return { nextBook: nextBookDisplay, nextChapter: '1' };
          }
      }
      return { nextBook: null, nextChapter: null };
  }, [getStorageBookName, language]);

  const handleRefractScripture = useCallback(async (book?: string, chapter?: string, autoPlay: boolean = false) => {
    const targetBook = book || selectedBook;
    const targetChapter = chapter || selectedChapter;

    resetPlaybackState(); 
    setIsSyncing(true);
    setStatusMsg(t.openPassage);
    setDataSource(null);
    setParsedVerses([]);
    
    try {
      const storageBookName = getStorageBookName(targetBook);
      let data: DualVerse[] | null = null;

      if (storage) {
          try {
              const path = `bible_corpus/${storageBookName}/${targetChapter}.json`;
              const storageRef = ref(storage, path);
              const url = await getDownloadURL(storageRef);
              const res = await fetch(url);
              if (res.ok) {
                  const jsonData = await res.json();
                  if (Array.isArray(jsonData)) {
                      data = jsonData;
                      setDataSource('vault');
                      addDebugLog(`Vault Stream: ${storageBookName}/${targetChapter}`, 'success');
                  }
              }
          } catch (storageErr) {
              addDebugLog(`Vault Miss. Initializing Refraction...`, 'info');
          }
      }

      if (!data) {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const prompt = `Refract full dual-language text for ${targetBook} ${targetChapter}. Return JSON only: [{"number": "1", "en": "...", "zh": "..."}, ...]`;
          
          const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
          });
          
          data = JSON.parse(response.text || '[]');
          setDataSource('ai');

          if (auth.currentUser && data) {
              saveScriptureToVault(storageBookName, targetChapter, data).catch(console.error);
          }
      }

      if (data) {
          setParsedVerses(data);
          if (autoPlay && startReadingSequenceRef.current) {
              startReadingSequenceRef.current(data, targetBook, targetChapter, 0);
          }
      }
    } catch (e: any) {
      addDebugLog(`Refraction failure: ${e.message}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  }, [selectedBook, selectedChapter, t, addDebugLog, resetPlaybackState, getStorageBookName]);

  const startReadingSequence = useCallback(async (verses: DualVerse[], bookName: string, chapterNum: string, startIndex: number = 0) => {
      stopReading();
      
      const localSessionId = ++playbackSessionRef.current;
      const targetGen = registerAudioOwner(`ScriptureReader`, stopReading);
      
      setIsReading(true);
      setCurrentReadingIndex(startIndex);
      addDebugLog(`Neural Sequence Active: ${bookName} Ch ${chapterNum} @ Verse ${startIndex + 1}`);
      
      try {
          const storageBookName = getStorageBookName(bookName);
          const ctx = getGlobalAudioContext();
          await warmUpAudioContext(ctx);

          for (let i = startIndex; i < verses.length; i++) {
              if (localSessionId !== playbackSessionRef.current || targetGen !== getGlobalAudioGeneration()) {
                  addDebugLog(`Sequence ${localSessionId} terminated.`, 'info');
                  return;
              }
              
              const verse = verses[i];
              const textToRead = readingLang === 'zh' ? verse.zh : verse.en;
              const voice = selectedPersona; 

              setCurrentReadingIndex(i);
              setAudioBuffering(true);
              
              if (verseRefs.current[verse.number]) {
                  verseRefs.current[verse.number]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }

              const playSystemFallback = async (txt: string) => {
                  setAudioBuffering(false);
                  await new Promise<void>((resolve) => {
                      const utterance = new SpeechSynthesisUtterance(txt);
                      utterance.lang = readingLang === 'zh' ? 'zh-CN' : 'en-US';
                      utterance.onend = () => resolve();
                      utterance.onerror = () => resolve();
                      window.speechSynthesis.speak(utterance);
                  });
              };

              if (ttsProvider === 'system') {
                  await playSystemFallback(textToRead);
              } else {
                  const isStandardPersona = selectedPersona === 'Default Gem' || selectedPersona === 'Kore' || selectedPersona === 'Puck';
                  let audioUrl = (ttsProvider === 'gemini' && isStandardPersona) ? await getScriptureAudioUrl(storageBookName, chapterNum, verse.number, readingLang) : null;
                  let audioBuffer: AudioBuffer | null = null;
                  let result: any = null;

                  if (audioUrl) {
                      try {
                          const res = await fetch(audioUrl);
                          if (!res.ok) throw new Error(`Fetch failed`);
                          const arrayBuf = await res.arrayBuffer();
                          try {
                              audioBuffer = await ctx.decodeAudioData(arrayBuf.slice(0));
                          } catch (decodeErr: any) {
                              audioBuffer = await decodeRawPcm(new Uint8Array(arrayBuf), ctx, 24000);
                          }
                      } catch (fetchErr: any) {
                          addDebugLog(`Vault fetch missed. Real-time required.`, 'info');
                      }
                  } 
                  
                  if (!audioBuffer) {
                      result = await synthesizeSpeech(textToRead, voice, ctx, ttsProvider, readingLang, userProfile?.cloudTtsApiKey);
                      
                      if (result.errorType !== 'none') {
                          addDebugLog(`Sync Error [${verse.number}]: ${result.errorMessage}`, 'error');
                          if (result.errorType === 'daily_limit') {
                              setTtsProvider('google'); 
                              result = await synthesizeSpeech(textToRead, voice, ctx, 'google', readingLang, userProfile?.cloudTtsApiKey);
                              if (result.buffer) audioBuffer = result.buffer;
                              else await playSystemFallback(textToRead);
                          } else {
                              await playSystemFallback(textToRead);
                          }
                      } else {
                          audioBuffer = result.buffer;
                          if (ttsProvider === 'gemini' && auth.currentUser && result.buffer && isStandardPersona) {
                              const { audioBufferToWavBlob } = await import('../utils/audioUtils');
                              const blob = audioBufferToWavBlob(result.buffer);
                              uploadScriptureAudio(storageBookName, chapterNum, verse.number, readingLang, blob).catch(console.error);
                          }
                      }
                  }

                  if (localSessionId !== playbackSessionRef.current || targetGen !== getGlobalAudioGeneration()) return;
                  setAudioBuffering(false);

                  if (audioBuffer) {
                      await new Promise<void>((resolve) => {
                          const source = ctx.createBufferSource();
                          source.buffer = audioBuffer;
                          source.connect(ctx.destination);
                          activeSourcesRef.current.add(source);
                          source.onended = () => { 
                              activeSourcesRef.current.delete(source); 
                              resolve(); 
                          };
                          source.start(0);
                      });
                  }
              }
              if (i < verses.length - 1) {
                  await new Promise(r => setTimeout(r, 600));
              }
          }

          if (localSessionId === playbackSessionRef.current && targetGen === getGlobalAudioGeneration()) {
              const { nextBook, nextChapter } = getNextPath(bookName, chapterNum);
              if (nextBook && nextChapter) {
                  addDebugLog(`Advancing to ${nextBook} Ch ${nextChapter}...`, 'success');
                  setSelectedBook(nextBook);
                  setSelectedChapter(nextChapter);
                  handleRefractScripture(nextBook, nextChapter, isReading);
              } else {
                  stopReading();
                  setCurrentReadingIndex(0);
                  addDebugLog("Neural Read Cycle Complete.", 'success');
              }
          }
      } catch (e: any) {
          addDebugLog(`Pipeline Crash: ${e.message}`, 'error');
          setIsReading(false);
      }
  }, [readingLang, ttsProvider, addDebugLog, stopReading, userProfile, getNextPath, selectedPersona, getStorageBookName, handleRefractScripture, isReading]);

  // Link ref to current instance of the callback
  startReadingSequenceRef.current = startReadingSequence;

  useEffect(() => {
      if (auth?.currentUser) {
          getUserProfile(auth.currentUser.uid).then(profile => {
              if (profile) {
                  setUserProfile(profile);
                  if (profile.languagePreference) setReadingLang(profile.languagePreference);
                  if (profile.preferredScriptureView) setViewMode(profile.preferredScriptureView);
              }
          });
      }
  }, []);

  useEffect(() => {
      setReadingLang(language);
  }, [language]);

  useEffect(() => {
      const handleResize = () => setIsMobile(window.innerWidth < 1024);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
      localStorage.setItem(`${sessionKey}_book`, selectedBook);
      localStorage.setItem(`${sessionKey}_chapter`, selectedChapter);
  }, [selectedBook, selectedChapter, sessionKey]);

  useEffect(() => {
      handleRefractScripture(selectedBook, selectedChapter, false);
  }, []);

  const handleBookChange = (b: string) => {
    setSelectedBook(b);
    setSelectedChapter('1');
    handleRefractScripture(b, '1', false); 
    if (isMobile) setIsSidebarOpen(false);
  };

  const handleChapterChange = (c: string) => {
    setSelectedChapter(c);
    handleRefractScripture(selectedBook, c, true); 
  };

  const handleVerseAction = (verse: DualVerse, index: number) => {
      if (isReading && currentReadingIndex === index) {
          stopReading();
      } else {
          startReadingSequence(parsedVerses, selectedBook, selectedChapter, index);
      }
  };

  const handleGenerateVerseArt = async (verse: DualVerse) => {
      setIsProcessing(true);
      setLabResult(null);
      stopReading();
      setStatusMsg(t.generatingArt);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const prompt = `Cinematic biblical scene: "${verse.en}". 8k, divine light.`;
          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash-image',
              contents: prompt,
              config: { imageConfig: { aspectRatio: "16:9" } }
          });
          if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    setLabResult({ type: 'image', content: `data:image/png;base64,${part.inlineData.data}`, title: `${selectedBook} ${selectedChapter}:${verse.number}` });
                    break;
                }
            }
          }
      } catch (e: any) { addDebugLog(`Art failed: ${e.message}`, 'error'); } finally { setIsProcessing(false); }
  };

  const runLabAction = async (action: 'explain' | 'video') => {
      setIsProcessing(true);
      setLabResult(null);
      stopReading();
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          if (action === 'explain') {
              setStatusMsg(t.explain);
              const response = await ai.models.generateContent({
                  model: 'gemini-3-flash-preview',
                  contents: `Explain ${selectedBook} ${selectedChapter} in ${language}.`,
              });
              setLabResult({ type: 'markdown', content: response.text || '', title: t.explain });
          } else if (action === 'video') {
              const aistudio = (window as any).aistudio;
              if (aistudio && !(await aistudio.hasSelectedApiKey())) { setIsProcessing(false); return; }
              setStatusMsg(t.videoStatus[0]);
              let operation = await ai.models.generateVideos({
                  model: 'veo-3.1-fast-generate-preview',
                  prompt: `Cinematic scriptural epic: ${selectedBook} ${selectedChapter}. 720p.`,
                  config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
              });
              while (!operation.done) {
                  await new Promise(r => setTimeout(r, 10000));
                  operation = await ai.operations.getVideosOperation({ operation: operation });
                  setStatusMsg(t.videoStatus[Math.floor(Math.random() * 4)]);
              }
              const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
              if (downloadLink) {
                  const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
                  const videoBlob = await response.blob();
                  let token = getDriveToken() || await signInWithGoogle().then(() => getDriveToken());
                  if (token) {
                      const youtubeId = await uploadToYouTube(token, videoBlob, { title: `${selectedBook} Ch ${selectedChapter}`, description: 'Neural Script', privacyStatus: 'unlisted' });
                      setLabResult({ type: 'youtube', content: youtubeId, title: t.generateVideo, youtubeUrl: getYouTubeVideoUrl(youtubeId) });
                  } else {
                      setLabResult({ type: 'video', content: URL.createObjectURL(videoBlob), title: t.generateVideo });
                  }
              }
          }
      } catch (e: any) { addDebugLog(`Neural Error: ${e.message}`, 'error'); } finally { setIsProcessing(false); }
  };

  const getChapterList = () => {
    const storageBookName = getStorageBookName(selectedBook);
    const count = CHAPTER_COUNTS[storageBookName] || 50;
    return Array.from({ length: count }, (_, i) => (i + 1).toString());
  };

  const handleNextChapter = () => {
      const { nextBook, nextChapter } = getNextPath(selectedBook, selectedChapter);
      if (nextBook && nextChapter) {
          if (nextBook !== selectedBook) setSelectedBook(nextBook);
          setSelectedChapter(nextChapter);
          handleRefractScripture(nextBook, nextChapter, isReading);
      }
  };

  const handlePrevChapter = () => {
      const currentChInt = parseInt(selectedChapter);
      if (currentChInt > 1) {
          const prevCh = (currentChInt - 1).toString();
          setSelectedChapter(prevCh);
          handleRefractScripture(selectedBook, prevCh, isReading);
      } else {
          const storageBookName = getStorageBookName(selectedBook);
          const globalIdx = ALL_BOOKS_EN.indexOf(storageBookName);
          if (globalIdx > 0) {
              const prevBookEn = ALL_BOOKS_EN[globalIdx - 1];
              const prevBookDisplay = language === 'zh' ? ALL_BOOKS_ZH[globalIdx - 1] : prevBookEn;
              const prevChCount = (CHAPTER_COUNTS[prevBookEn] || 1).toString();
              setSelectedBook(prevBookDisplay);
              setSelectedChapter(prevChCount);
              handleRefractScripture(prevBookDisplay, prevChCount, isReading);
          }
      }
  };

  return (
    <div className="h-full flex flex-col bg-[#020617] text-slate-100 overflow-hidden relative">
      {isSidebarOpen && isMobile && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setIsSidebarOpen(false)}>
              <div className="absolute left-0 top-0 bottom-0 w-80 bg-slate-900 border-r border-slate-800 flex flex-col animate-fade-in-right" onClick={e => e.stopPropagation()}>
                  <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50 pt-[calc(1.5rem+env(safe-area-inset-top))]">
                      <h3 className="font-black uppercase tracking-widest text-indigo-400">{t.browse}</h3>
                      <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-slate-800 rounded-full"><X/></button>
                  </div>
                  <div className="p-4 bg-slate-900 flex bg-slate-900 p-1 rounded-xl m-4 border border-slate-800">
                      <button onClick={() => setTestament('ot')} className={`flex-1 py-2.5 text-xs font-black uppercase rounded-lg ${testament === 'ot' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-50'}`}>{t.oldTestament}</button>
                      <button onClick={() => setTestament('nt')} className={`flex-1 py-2.5 text-xs font-black uppercase rounded-lg ${testament === 'nt' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-50'}`}>{t.newTestament}</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 scrollbar-hide space-y-2">
                      {currentBooks.map(b => (<button key={b} onClick={() => handleBookChange(b)} className={`w-full text-left px-5 py-4 rounded-2xl text-base font-bold border transition-all ${selectedBook === b ? 'bg-indigo-600 border-indigo-500 text-white shadow-xl' : 'border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white'}`}>{b}</button>))}
                  </div>
              </div>
          </div>
      )}

      <header className="min-h-[4rem] pt-[env(safe-area-inset-top)] border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-4 md:px-6 backdrop-blur-md shrink-0 z-50">
          <div className="flex items-center gap-2 md:gap-4">
              <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all"><ArrowLeft size={20} /></button>
              <div className="flex items-center gap-2">
                  {isMobile && <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-indigo-600/10 text-indigo-400 rounded-lg border border-indigo-500/20"><Menu size={20}/></button>}
                  <h1 className="text-sm md:text-lg font-bold text-white flex items-center gap-2"><Scroll className="text-amber-500" size={18} /> <span className="hidden sm:inline">{t.appTitle}</span></h1>
              </div>
          </div>
          <div className="flex items-center gap-1 md:gap-3">
              <button 
                  onClick={() => window.location.reload()} 
                  className="p-2 text-slate-500 hover:text-indigo-400 transition-colors"
                  title="Reload Workspace"
              >
                  <RefreshCcw size={18} />
              </button>
              {dataSource && <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${dataSource === 'vault' ? t.vaultVerified : t.neuralFallback}`}>{dataSource === 'vault' ? t.vaultVerified : t.neuralFallback}</div>}
              <button onClick={() => setShowDebugPanel(!showDebugPanel)} className="p-2 text-slate-500 hover:text-white transition-colors"><Bug size={18} /></button>
          </div>
      </header>

      <div className="flex-1 flex overflow-hidden flex-col lg:flex-row relative">
          {!isMobile && (
              <div className="w-[300px] border-r border-slate-800 bg-slate-900/30 flex flex-col shrink-0 overflow-hidden">
                  <div className="p-4 border-b border-slate-800 flex bg-slate-900 p-1 rounded-xl m-4 border border-slate-800">
                      <button onClick={() => setTestament('ot')} className={`flex-1 py-2.5 text-[10px] font-black uppercase rounded-lg ${testament === 'ot' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-50'}`}>{t.oldTestament}</button>
                      <button onClick={() => setTestament('nt')} className={`flex-1 py-2.5 text-[10px] font-black uppercase rounded-lg ${testament === 'nt' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-50'}`}>{t.newTestament}</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 scrollbar-hide space-y-1">
                      {currentBooks.map(b => (<button key={b} onClick={() => handleBookChange(b)} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${selectedBook === b ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-200' : 'border-transparent text-slate-500 hover:bg-slate-800 hover:text-white'}`}>{b}</button>))}
                  </div>
                  <div className="p-4 border-t border-slate-800 space-y-4">
                      <div>
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block px-1">{t.engine}</label>
                          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 shadow-inner">
                              <button onClick={() => setTtsProvider('google')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${ttsProvider === 'google' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400'}`}>Standard</button>
                              <button onClick={() => setTtsProvider('gemini')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${ttsProvider === 'gemini' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>Preview</button>
                              <button onClick={() => setTtsProvider('system')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${ttsProvider === 'system' ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-400'}`}>Sys</button>
                          </div>
                      </div>
                      
                      <div>
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block px-1">{t.persona}</label>
                          <div className="grid grid-cols-3 gap-1">
                              {PERSONA_VOICES.map(pv => (
                                  <button 
                                    key={pv.id}
                                    onClick={() => setSelectedPersona(pv.id)}
                                    className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${selectedPersona === pv.id ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-600 hover:text-white'}`}
                                    title={pv.id}
                                  >
                                      <pv.icon size={14}/>
                                      <span className="text-[7px] font-black uppercase truncate w-full text-center">{pv.label || pv.id.split(' ')[0]}</span>
                                  </button>
                              ))}
                          </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block px-1">{t.viewMode}</label>
                        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                            <button onClick={() => setViewMode('dual')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase ${viewMode === 'dual' ? 'bg-slate-700 text-white' : 'text-slate-50'}`}>{t.dual}</button>
                            <button onClick={() => setViewMode('en')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase ${viewMode === 'en' ? 'bg-slate-700 text-white' : 'text-slate-50'}`}>EN</button>
                            <button onClick={() => setViewMode('zh')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase ${viewMode === 'zh' ? 'bg-slate-700 text-white' : 'text-slate-50'}`}>ZH</button>
                        </div>
                      </div>
                  </div>
              </div>
          )}

          <div className="flex-1 flex flex-col overflow-hidden relative">
              <div className="bg-slate-900/50 border-b border-slate-800 p-4 md:p-6 space-y-4 shrink-0">
                  <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <BookOpen className="text-indigo-400 hidden md:block" size={32}/>
                        <h2 className="text-3xl md:text-6xl font-black uppercase italic tracking-tighter text-white">
                            {selectedBook} <span className="text-indigo-500 not-italic ml-2">{selectedChapter}</span>
                        </h2>
                      </div>
                      <div className="flex gap-2">
                          <button onClick={() => runLabAction('explain')} className="p-2 md:p-3 bg-indigo-600/10 hover:bg-indigo-600 rounded-xl text-indigo-400 border border-indigo-500/20 transition-all active:scale-95"><BrainCircuit size={20}/></button>
                          <button onClick={() => runLabAction('video')} className="p-2 md:p-3 bg-pink-600/10 hover:bg-pink-600 rounded-xl text-pink-400 border border-pink-500/20 transition-all active:scale-95"><Film size={20}/></button>
                      </div>
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-24 md:max-h-40 overflow-y-auto scrollbar-hide pr-2">
                      {getChapterList().map(ch => (<button key={ch} onClick={() => handleChapterChange(ch)} className={`w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl font-mono text-sm md:text-lg font-black border transition-all ${selectedChapter === ch ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg scale-105' : 'bg-slate-950/50 border-slate-800 text-slate-500 hover:text-white'}`}>{ch}</button>))}
                  </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-hide pb-40">
                  <div className="max-w-4xl mx-auto space-y-4 md:space-y-8">
                      {isSyncing || isProcessing ? (
                          <div className="py-40 flex flex-col items-center justify-center gap-8 text-indigo-400 animate-pulse">
                              <div className="w-20 h-20 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin" />
                              <span className="text-[10px] font-black uppercase tracking-[0.3em]">{statusMsg}</span>
                          </div>
                      ) : (
                          <div className="space-y-4 md:space-y-8">
                              {labResult && (
                                  <div className="bg-slate-900 border border-indigo-500/30 p-6 md:p-8 rounded-[2rem] shadow-2xl animate-fade-in-up relative overflow-hidden">
                                      <div className="flex justify-between items-center mb-6 relative z-10"><h3 className="font-black uppercase text-indigo-400 text-xs">{labResult.title}</h3><button onClick={() => setLabResult(null)} className="p-2 hover:bg-slate-800 rounded-xl text-slate-500"><X size={20}/></button></div>
                                      <div className="relative z-10 flex justify-center">
                                          {labResult.type === 'markdown' && <MarkdownView content={labResult.content} />}
                                          {labResult.type === 'youtube' && <div className="aspect-video w-full rounded-2xl overflow-hidden border-2 border-indigo-500/20 shadow-2xl"><iframe src={getYouTubeEmbedUrl(labResult.content)} className="w-full h-full border-none" allowFullScreen /></div>}
                                          {labResult.type === 'image' && <img src={labResult.content} className="w-full rounded-2xl shadow-2xl border border-white/5" />}
                                      </div>
                                  </div>
                              )}
                              {parsedVerses.map((v, idx) => (
                                  <div 
                                    key={v.number} 
                                    ref={el => { verseRefs.current[v.number] = el; }} 
                                    onClick={() => !isReading && setCurrentReadingIndex(idx)}
                                    className={`p-6 md:p-8 bg-slate-900/40 rounded-[2rem] md:rounded-[2.5rem] border transition-all shadow-lg relative group/verse cursor-pointer ${currentReadingIndex === idx ? 'border-indigo-500/60 bg-indigo-950/20 ring-4 ring-indigo-500/5' : 'border-slate-800 hover:border-slate-700'}`}
                                  >
                                      <div className="flex gap-4 md:gap-6 items-start">
                                          <div className="flex flex-col items-center gap-3 shrink-0 pt-1">
                                              <span className={`text-[10px] font-black transition-colors ${currentReadingIndex === idx ? 'text-indigo-400' : 'text-slate-600'}`}>{v.number}</span>
                                              <div className={`flex flex-col gap-1 transition-opacity ${currentReadingIndex === idx || isReading ? 'opacity-100' : 'opacity-0 group-hover/verse:opacity-100'}`}>
                                                  <button 
                                                    onClick={(e) => { e.stopPropagation(); handleVerseAction(v, idx); }} 
                                                    className={`p-2 rounded-xl transition-all ${currentReadingIndex === idx && isReading ? 'bg-red-600 text-white shadow-lg' : 'bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600 hover:text-white'}`}
                                                  >
                                                      {currentReadingIndex === idx && isReading ? <Pause size={14}/> : <Play size={14} fill="currentColor"/>}
                                                  </button>
                                                  <button onClick={(e) => { e.stopPropagation(); handleGenerateVerseArt(v); }} className="p-2 text-slate-600 hover:text-pink-400 hover:bg-slate-800 rounded-xl transition-all"><Palette size={14}/></button>
                                              </div>
                                          </div>
                                          <div className="space-y-4 md:space-y-6 flex-1">
                                              {(viewMode === 'dual' || viewMode === 'en') && <p className={`text-lg md:text-xl leading-relaxed font-serif ${currentReadingIndex === idx ? 'text-white' : 'text-slate-300'}`}>{v.en}</p>}
                                              {(viewMode === 'dual' || viewMode === 'zh') && <p className={`text-xl md:text-2xl leading-relaxed font-serif ${currentReadingIndex === idx ? 'text-white' : 'text-slate-400'} ${viewMode === 'dual' ? 'border-t border-slate-800/50 pt-4 md:pt-6' : ''}`}>{v.zh}</p>}
                                          </div>
                                      </div>
                                      {currentReadingIndex === idx && audioBuffering && (
                                          <div className="absolute top-2 right-4 flex items-center gap-2 text-indigo-400 animate-pulse">
                                              <Loader2 size={10} className="animate-spin" />
                                              <span className="text-[8px] font-black uppercase tracking-widest">{t.bufferingAudio}</span>
                                          </div>
                                      )}
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              </div>

              {/* STICKY BOTTOM PLAYER */}
              <div className={`fixed bottom-0 left-0 right-0 z-40 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] transition-transform duration-500 ${parsedVerses.length > 0 ? 'translate-y-0' : 'translate-y-full'}`}>
                  <div className="max-w-xl mx-auto bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-4 shadow-2xl flex items-center gap-4">
                      <div className="shrink-0">
                        {isReading ? (
                          <button onClick={stopReading} className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center text-white shadow-lg active:scale-95 transition-all"><Square size={24} fill="currentColor"/></button>
                        ) : (
                          <button 
                            onClick={() => startReadingSequence(parsedVerses, selectedBook, selectedChapter, currentReadingIndex)} 
                            className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg active:scale-95 transition-all flex flex-col items-center gap-0.5"
                          >
                            <Play size={24} fill="currentColor"/>
                            <span className="text-[6px] font-black uppercase tracking-widest leading-none">{currentReadingIndex > 0 ? t.resume : t.readText}</span>
                          </button>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest truncate">{selectedBook} {selectedChapter}:{currentReadingIndex + 1}</p>
                              <p className="text-[10px] font-mono text-slate-500 uppercase">{currentReadingIndex + 1} / {parsedVerses.length}</p>
                          </div>
                          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-2">
                             <div 
                                className="h-full bg-indigo-500 transition-all duration-1000" 
                                style={{ width: `${((currentReadingIndex + 1) / parsedVerses.length) * 100}%` }}
                             />
                          </div>
                          <div className="flex items-center justify-between">
                              <div className="w-24 h-4 overflow-hidden rounded-full"><Visualizer volume={isReading ? 0.6 : 0} isActive={isReading} color="#6366f1" /></div>
                              <div className="flex gap-2">
                                  <button onClick={handlePrevChapter} className="p-2 text-slate-500 hover:text-white transition-colors" title={t.prevChapter}><ChevronLeft size={16}/></button>
                                  <button onClick={handleNextChapter} className="p-2 text-slate-500 hover:text-white transition-colors" title={t.nextChapter}><ChevronRight size={16}/></button>
                              </div>
                          </div>
                      </div>
                      {isMobile && (
                          <button 
                            onClick={() => setIsSidebarOpen(true)}
                            className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl transition-all border border-slate-700"
                          >
                            <Library size={20}/>
                          </button>
                      )}
                  </div>
              </div>
          </div>
      </div>

      {showDebugPanel && (
          <div className="fixed bottom-0 left-0 right-0 h-64 bg-slate-950 border-t-2 border-amber-500 shadow-2xl z-[200] flex flex-col p-4 overflow-hidden animate-fade-in-up">
              <div className="flex justify-between items-center mb-4"><h3 className="font-black uppercase text-amber-500 text-xs">Neural Console</h3><button onClick={() => setShowDebugPanel(false)} className="p-1 hover:bg-white/10 rounded"><X size={16}/></button></div>
              <div className="flex-1 overflow-y-auto space-y-2 font-mono text-[10px] scrollbar-thin scrollbar-thumb-amber-500/20">
                  {debugLogs.map((log, i) => (
                    <div key={i} className={`p-2 rounded border border-white/5 ${log.type === 'error' ? 'bg-red-950/20 text-red-400' : log.type === 'success' ? 'bg-emerald-950/20 text-emerald-400' : log.type === 'warn' ? 'bg-amber-950/20 text-amber-400' : 'bg-slate-900/50 text-slate-50'}`}>
                        <span className="opacity-40">[{log.timestamp}]</span> <span className="font-bold">{log.message}</span>
                        {log.details && <p className="mt-1 opacity-60 pl-4 border-l border-current">Trace: {log.details}</p>}
                    </div>
                  ))}
              </div>
          </div>
      )}
    </div>
  );
};

export default ScriptureSanctuary;
