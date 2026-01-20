
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { GoogleGenAI, Modality, Type } from '@google/genai';
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
  Lock
} from 'lucide-react';
import { MarkdownView } from './MarkdownView';
import { db, auth, storage } from '../services/firebaseConfig';
import { doc, setDoc, getDoc, collection } from '@firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from '@firebase/storage';
import { generateSecureId } from '../utils/idUtils';
import { getDriveToken, signInWithGoogle } from '../services/authService';
import { uploadToYouTube, getYouTubeVideoUrl, getYouTubeEmbedUrl } from '../services/youtubeService';
import { getUserProfile } from '../services/firestoreService';
import { UserProfile } from '../types';

interface ScriptureSanctuaryProps {
  onBack: () => void;
  language: 'en' | 'zh';
  isProMember: boolean;
}

interface DualVerse {
  number: string;
  en: string;
  zh: string;
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
    readText: "Passage Reader",
    stopAudio: "Stop Reading",
    videoStatus: [
        "Initializing Veo Core...",
        "Simulating Light Particles...",
        "Encoding Neural Frames...",
        "Finalizing Video Stream..."
    ],
    videoSuccess: "Video Ready",
    forceRegen: "Force Neural Refraction",
    proRequired: "Pro Membership Required",
    waiting: "Buffering Neural Stream..."
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
    readText: "整章朗读",
    stopAudio: "停止朗读",
    videoStatus: [
        "正在初始化 Veo 核心...",
        "正在模拟光影粒子...",
        "正在编码神经帧...",
        "正在完成视频流..."
    ],
    videoSuccess: "视频已就绪",
    forceRegen: "强制神经折射",
    proRequired: "需要 Pro 会员权限",
    waiting: "正在加载神经流..."
  }
};

const BIBLE_BOOKS_EN = ["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi", "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"];
const BIBLE_BOOKS_ZH = ["创世记", "出埃及记", "利未记", "民数记", "申命记", "约书亚记", "士师记", "路得记", "撒母耳记上", "撒母耳记下", "列王纪上", "列王纪下", "历代志上", "历代志下", "以斯拉记", "尼希米记", "以斯帖记", "约伯记", "诗篇", "箴言", "传道书", "雅歌", "以赛亚书", "耶利米书", "耶利米哀歌", "以世结书", "但以理书", "何西阿书", "约珥书", "阿摩司书", "俄巴底亚书", "约拿书", "弥迦书", "那鸿书", "哈巴谷书", "西番雅书", "哈该书", "撒迦利亚书", "玛拉基书", "马太福音", "马太福音", "路加福音", "约翰福音", "使徒行传", "罗马书", "哥林多前书", "哥林多后书", "加拉太书", "以弗所书", "腓立比书", "歌罗西书", "帖撒罗尼迦前书", "帖撒罗尼迦后书", "提摩太前书", "提摩太后书", "提多书", "腓利门书", "希伯来书", "雅各书", "彼得前书", "彼得后书", "约翰一书", "约翰二书", "约翰三书", "犹大书", "启示录"];

const TRANSLATIONS = [
    { id: 'niv', name: 'NIV', label: 'New International Version', zh: '新国际版' },
    { id: 'cuv', name: 'CUV', label: 'Chinese Union Version', zh: '和合本' }
];

export const ScriptureSanctuary: React.FC<ScriptureSanctuaryProps> = ({ onBack, language, isProMember }) => {
  const t = UI_TEXT[language];
  const isZh = language === 'zh';
  const books = isZh ? BIBLE_BOOKS_ZH : BIBLE_BOOKS_EN;

  const [selectedBook, setSelectedBook] = useState(books[39]); // Matthew
  const [selectedChapter, setSelectedChapter] = useState('1');
  const [selectedTranslation, setSelectedTranslation] = useState(TRANSLATIONS[0]);
  const [parsedVerses, setParsedVerses] = useState<DualVerse[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [labResult, setLabResult] = useState<{ type: string, content: any, title: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRefractScripture = useCallback(async () => {
    setIsSyncing(true);
    setStatusMsg(t.openPassage);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Refract full dual-language text for ${selectedBook} ${selectedChapter}. 
      JSON format: [{"number": "1", "en": "...", "zh": "..."}, ...]`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });
      
      setParsedVerses(JSON.parse(response.text || '[]'));
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  }, [selectedBook, selectedChapter, t]);

  useEffect(() => { handleRefractScripture(); }, []);

  const runLabAction = async (action: 'explain' | 'video') => {
      setIsProcessing(true);
      setLabResult(null);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      try {
          if (action === 'explain') {
              setStatusMsg(t.explain);
              const response = await ai.models.generateContent({
                  model: 'gemini-3-flash-preview',
                  contents: `Explain the meaning of ${selectedBook} ${selectedChapter} in ${language}.`,
              });
              setLabResult({ type: 'markdown', content: response.text || '', title: t.explain });
          } else if (action === 'video') {
              // Strictly following Veo Video Generation rules
              const aistudio = (window as any).aistudio;
              if (aistudio && !(await aistudio.hasSelectedApiKey())) {
                  await aistudio.openSelectKey();
              }

              setStatusMsg(t.videoStatus[0]);
              let operation = await ai.models.generateVideos({
                  model: 'veo-3.1-fast-generate-preview',
                  prompt: `Cinematic visualization of ${selectedBook} ${selectedChapter}`,
                  config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
              });

              while (!operation.done) {
                  await new Promise(r => setTimeout(r, 10000));
                  operation = await ai.operations.getVideosOperation({ operation });
                  const step = Math.min(t.videoStatus.length - 1, Math.floor(Math.random() * t.videoStatus.length));
                  setStatusMsg(t.videoStatus[step]);
              }

              const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
              if (downloadLink) {
                  const finalUri = `${downloadLink}&key=${process.env.API_KEY}`;
                  setLabResult({ type: 'video', content: finalUri, title: t.generateVideo });
              }
          }
      } catch (e) {
          console.error(e);
      } finally {
          setIsProcessing(false);
          setStatusMsg('');
      }
  };

  return (
    <div className="h-full flex flex-col bg-[#020617] text-slate-100 overflow-hidden font-sans">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-4">
              <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"><ArrowLeft size={20} /></button>
              <h1 className="text-lg font-bold text-white flex items-center gap-2"><Scroll className="text-amber-500" /> {t.appTitle}</h1>
          </div>
      </header>

      <div className="flex-1 flex overflow-hidden flex-col lg:flex-row">
          <div className="w-full lg:w-[350px] border-r border-slate-800 bg-slate-900/30 p-4 space-y-6 shrink-0 overflow-y-auto">
              <div className="space-y-4 bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
                  <select value={selectedBook} onChange={e => setSelectedBook(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white">
                      {books.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <input type="number" value={selectedChapter} onChange={e => setSelectedChapter(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white" placeholder="Chapter"/>
                  <button onClick={handleRefractScripture} className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-black uppercase rounded-xl transition-all shadow-lg">{t.openPassage}</button>
              </div>

              <div className="grid grid-cols-1 gap-2">
                  <button onClick={() => runLabAction('explain')} className="p-4 bg-indigo-600/10 border border-indigo-500/20 rounded-xl hover:bg-indigo-600 transition-all text-xs font-bold flex items-center gap-3"><BrainCircuit size={18}/> {t.explain}</button>
                  <button onClick={() => runLabAction('video')} className="p-4 bg-pink-600/10 border border-pink-500/20 rounded-xl hover:bg-pink-600 transition-all text-xs font-bold flex items-center gap-3"><Film size={18}/> {t.generateVideo}</button>
              </div>
          </div>

          <div className="flex-1 overflow-y-auto p-8 relative scrollbar-hide">
              <div className="max-w-4xl mx-auto space-y-12 pb-32">
                  {(isSyncing || isProcessing) ? (
                      <div className="py-40 flex flex-col items-center justify-center gap-6 text-indigo-400">
                          <Loader2 className="animate-spin" size={64} />
                          <span className="text-sm font-black uppercase tracking-widest">{statusMsg}</span>
                      </div>
                  ) : (
                      <div className="space-y-8">
                          {labResult && (
                              <div className="bg-slate-900 border border-indigo-500/30 p-8 rounded-[2rem] shadow-2xl animate-fade-in-up">
                                  <div className="flex justify-between items-center mb-6">
                                      <h3 className="font-black uppercase tracking-tighter text-indigo-400">{labResult.title}</h3>
                                      <button onClick={() => setLabResult(null)}><X size={20}/></button>
                                  </div>
                                  {labResult.type === 'markdown' && <MarkdownView content={labResult.content} />}
                                  {labResult.type === 'video' && <video src={labResult.content} controls className="w-full rounded-2xl" />}
                              </div>
                          )}
                          
                          {parsedVerses.map(v => (
                              <div key={v.number} className="p-6 bg-slate-900/40 rounded-[2rem] border border-slate-800 hover:border-indigo-500/30 transition-all">
                                  <div className="flex gap-4 items-start">
                                      <span className="text-xs font-black text-indigo-500 pt-1">{v.number}</span>
                                      <div className="space-y-4">
                                          <p className="text-lg text-slate-200 leading-relaxed font-serif">{v.en}</p>
                                          <p className="text-xl text-slate-300 leading-relaxed font-serif border-t border-slate-800 pt-4">{v.zh}</p>
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          </div>
      </div>
    </div>
  );
};

export default ScriptureSanctuary;
