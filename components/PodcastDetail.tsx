import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Channel, GeneratedLecture, Chapter, SubTopic, Attachment, UserProfile, AgentMemory } from '../types';
import { 
  ArrowLeft, BookOpen, FileText, Download, Loader2, ChevronDown, ChevronRight, ChevronLeft, 
  Check, Printer, FileDown, Info, Sparkles, Book, CloudDownload, Music, Package, 
  FileAudio, Zap, Radio, CheckCircle, ListTodo, Share2, Play, Pause, Square, Volume2, 
  RefreshCw, RefreshCcw, Wand2, Edit3, Save, ShieldCheck, ImageIcon, Lock, Cloud, 
  BookText, Languages, X, AlertTriangle, Database, Terminal, SkipBack, SkipForward, 
  QrCode, Activity, Image as ImageIconLucide, VolumeX, BookMarked, FileOutput, 
  User, MessageSquare, Bookmark 
} from 'lucide-react';
import { generateLectureScript } from '../services/lectureGenerator';
import { generateChannelCoverArt } from '../services/channelGenerator';
import { synthesizeSpeech } from '../services/tts';
import { cacheLectureScript, getCachedLectureScript, getAudioKeys, getLocalAsset, saveLocalAsset } from '../utils/db';
import { getGlobalAudioContext, registerAudioOwner, warmUpAudioContext, connectOutput } from '../utils/audioUtils';
import { MarkdownView } from './MarkdownView';
import { auth, db } from '../services/firebaseConfig';
import { getCloudCachedLecture, uploadFileToStorage, isUserAdmin } from '../services/firestoreService';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { generateSecureId } from '../utils/idUtils';
import { Visualizer } from './Visualizer';
import { collection, query, where, getDocs } from '@firebase/firestore';
import { GoogleGenAI } from '@google/genai';
import { SPOTLIGHT_DATA } from '../utils/spotlightContent';

export const CHINESE_FONT_STACK = '"Microsoft YaHei", "PingFang SC", "STHeiti", sans-serif';
export const SERIF_FONT_STACK = 'Georgia, "Times New Roman", STSong, "SimSun", serif';

interface PodcastDetailProps {
  channel: Channel;
  onBack: () => void;
  onStartLiveSession: (channel: Channel, context?: string, recordingEnabled?: boolean, bookingId?: string, videoEnabled?: boolean, cameraEnabled?: boolean, activeSegment?: { index: number, lectureId: string }) => void;
  language: 'en' | 'zh';
  currentUser: any;
  userProfile: UserProfile | null;
  onUpdateChannel: (updated: Channel) => Promise<void>;
  isProMember: boolean;
}

interface NodeStatus {
    script: boolean;
    audioCloud: boolean;
    audioLocal: boolean;
    isChecking: boolean;
}

export const PodcastDetail: React.FC<PodcastDetailProps> = ({ 
  channel, onBack, onStartLiveSession, language, currentUser, userProfile, onUpdateChannel, isProMember 
}) => {
  const [isAuditing, setIsAuditing] = useState(false);
  const [ledgerStatus, setLedgerStatus] = useState<Record<string, NodeStatus>>({});
  const [isGeneratingArt, setIsGeneratingArt] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [localArtPreview, setLocalArtPreview] = useState<string | null>(null);
  const [activeReadingSubTopicId, setActiveReadingSubTopicId] = useState<string | null>(null);
  const [activeLecture, setActiveLecture] = useState<GeneratedLecture | null>(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(-1);
  const [isReadingSequentially, setIsReadingSequentially] = useState(false);
  const [bufferingSubTopicId, setBufferingSubTopicId] = useState<string | null>(null);
  const [isGeneratingBook, setIsGeneratingBook] = useState(false);
  const [bookProgress, setBookProgress] = useState("");
  const [playedSubTopicIds, setPlayedSubTopicIds] = useState<Set<string>>(new Set());
  const [liveVolume, setLiveVolume] = useState(0);
  
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const playbackSessionRef = useRef(0);
  const sectionRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const chapters = useMemo(() => {
      if (channel.chapters && channel.chapters.length > 0) return channel.chapters;
      const spotlight = SPOTLIGHT_DATA[channel.id];
      if (spotlight && spotlight.curriculum) return spotlight.curriculum;
      return [];
  }, [channel.id, channel.chapters]);

  const flatCurriculum = useMemo(() => chapters.flatMap(c => c.subTopics), [chapters]);
  
  const t = { 
      generateArt: language === 'zh' ? '重构封面艺术' : 'Refract Cover Art',
      synthesizeBook: language === 'zh' ? '合成神经书籍' : 'Synthesize Book',
      host: language === 'zh' ? '主持人' : 'Host'
  };

  const dispatchLog = (msg: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
      window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: msg, type } }));
  };

  const stopSequentialPlayback = useCallback(() => {
      playbackSessionRef.current++;
      setIsReadingSequentially(false);
      setActiveReadingSubTopicId(null);
      setActiveLecture(null);
      setCurrentSectionIndex(-1);
      setBufferingSubTopicId(null);
      setLiveVolume(0);
      activeSourcesRef.current.forEach(s => { try { s.stop(); s.disconnect(); } catch(e) {} });
      activeSourcesRef.current.clear();
      sectionRefs.current = {};
      if (window.speechSynthesis) window.speechSynthesis.cancel();
  }, []);

  const handlePlaySubTopic = async (sub: SubTopic) => {
    if (activeReadingSubTopicId === sub.id) {
        stopSequentialPlayback();
        return;
    }

    stopSequentialPlayback();
    setActiveReadingSubTopicId(sub.id);
    setBufferingSubTopicId(sub.id);
    setIsReadingSequentially(true);

    const MY_TOKEN = `Sequential:${channel.id}:${sub.id}`;
    const localSession = ++playbackSessionRef.current;
    registerAudioOwner(MY_TOKEN, stopSequentialPlayback);

    const ctx = getGlobalAudioContext();
    await warmUpAudioContext(ctx);

    try {
        const cacheKey = `lecture_${channel.id}_${sub.id}_${language}`;
        let lecture = await getCachedLectureScript(cacheKey);
        if (!lecture) {
            lecture = await getCloudCachedLecture(channel.id, sub.id, language);
            if (lecture) await cacheLectureScript(cacheKey, lecture);
        }
        if (!lecture) {
            lecture = await generateLectureScript(sub.title, channel.description, language, channel.id, channel.voiceName);
            if (lecture) await cacheLectureScript(cacheKey, lecture);
        }

        if (lecture && localSession === playbackSessionRef.current) {
            setActiveLecture(lecture);
            setBufferingSubTopicId(null);
            for (let i = 0; i < lecture.sections.length; i++) {
                if (localSession !== playbackSessionRef.current) break;
                setCurrentSectionIndex(i); 
                const section = lecture.sections[i];
                const voice = section.speaker === 'Teacher' ? (channel.voiceName || 'Zephyr') : 'Puck';
                const result = await synthesizeSpeech(section.text, voice, ctx, 'gemini', language, {
                    channelId: channel.id, topicId: sub.id, nodeId: `node_${channel.id}_${sub.id}_${i}_${language}`
                });
                if (result.buffer && localSession === playbackSessionRef.current) {
                    setLiveVolume(0.8);
                    await new Promise<void>((resolve) => {
                        const source = ctx.createBufferSource();
                        source.buffer = result.buffer;
                        connectOutput(source, ctx);
                        activeSourcesRef.current.add(source);
                        source.onended = () => { activeSourcesRef.current.delete(source); setLiveVolume(0); resolve(); };
                        source.start(0);
                    });
                }
                if (localSession !== playbackSessionRef.current) break;
                await new Promise(r => setTimeout(r, 800));
            }
        }
    } catch (e: any) { stopSequentialPlayback(); }
  };

  const generateChapterSummary = async (ch: Chapter): Promise<string> => {
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const langText = language === 'zh' ? '使用简体中文输出。' : 'Output in English.';
          const prompt = `Write a technical 2-sentence executive summary for a book chapter titled "${ch.title}". ${langText} Focus on the core architectural or logical takeaways.`;
          const res = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: prompt,
              config: { thinkingConfig: { thinkingBudget: 0 } }
          });
          return res.text || "Summary pending.";
      } catch (e) { return "Summary unavailable."; }
  };

  const handleDownloadFullBook = async () => {
      setIsGeneratingBook(true);
      setBookProgress("Initializing Publishing Engine...");
      
      try {
          const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' });
          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();
          const sessionHash = generateSecureId().substring(0, 12).toUpperCase();
          const channelUrl = `${window.location.origin}?view=podcast_detail&channelId=${channel.id}`;
          const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(channelUrl)}`;

          const captureContainer = document.createElement('div');
          captureContainer.style.width = '750px'; 
          captureContainer.style.position = 'fixed';
          captureContainer.style.left = '-10000px';
          captureContainer.style.backgroundColor = '#ffffff';
          document.body.appendChild(captureContainer);

          const renderToPdf = async (html: string, addPageBefore = true) => {
              if (addPageBefore) pdf.addPage();
              captureContainer.innerHTML = html;
              const canvas = await html2canvas(captureContainer, { scale: 2.2, useCORS: true, backgroundColor: '#ffffff', logging: false });
              const imgData = canvas.toDataURL('image/jpeg', 0.85);
              pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, (canvas.height * pageWidth) / canvas.width);
          };

          // --- 1. FRONT COVER ---
          setBookProgress("Printing Front Cover...");
          await renderToPdf(`
            <div style="width: 750px; height: 1050px; background: #020617; color: white; padding: 120px 100px; font-family: ${CHINESE_FONT_STACK}; display: flex; flex-direction: column; justify-content: space-between; position: relative; border: 25px solid #0f172a;">
                <div style="position: absolute; top: 0; right: 0; width: 400px; height: 400px; background: radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, transparent 70%);"></div>
                <div>
                    <p style="text-transform: uppercase; letter-spacing: 0.6em; font-size: 14px; font-weight: 900; color: #818cf8; margin-bottom: 25px;">Neural Prism Technical Publication</p>
                    <h1 style="font-size: 64px; font-weight: 900; italic: true; margin: 0; line-height: 1.1; text-transform: uppercase; letter-spacing: -0.02em;">${channel.title}</h1>
                    <div style="width: 120px; height: 10px; background: #6366f1; margin-top: 45px; border-radius: 5px;"></div>
                </div>
                <div style="display: flex; align-items: flex-end; justify-content: space-between;">
                    <div>
                        <p style="text-transform: uppercase; letter-spacing: 0.2em; font-size: 12px; color: #64748b; font-weight: 900; margin-bottom: 5px;">Compiled by Neural Host</p>
                        <p style="font-size: 32px; font-weight: 900; margin: 0; color: #fff;">@${channel.author}</p>
                    </div>
                    <div style="text-align: right;">
                        <p style="font-size: 10px; color: #475569; font-mono: true;">TRACE ID: ${sessionHash}</p>
                    </div>
                </div>
            </div>
          `, false);

          // --- 2. TABLE OF CONTENTS ---
          setBookProgress("Generating Index...");
          await renderToPdf(`
            <div style="width: 750px; height: 1050px; background: #ffffff; color: #0f172a; padding: 120px 100px; font-family: ${CHINESE_FONT_STACK};">
                <h1 style="font-size: 42px; font-weight: 900; margin-bottom: 60px; text-transform: uppercase; border-bottom: 5px solid #020617; padding-bottom: 20px;">Refractive Index</h1>
                <div style="display: flex; flex-direction: column; gap: 16px;">
                    ${chapters.map((ch, idx) => `
                        <div style="display: flex; justify-content: space-between; border-bottom: 1px dotted #cbd5e1; padding-bottom: 8px; align-items: baseline;">
                            <span style="font-weight: 900; color: #1e293b; font-size: 18px;">Section 0${idx+1}: ${ch.title}</span>
                            <span style="color: #64748b; font-size: 12px; font-weight: bold;">NODE ${idx+1}</span>
                        </div>
                    `).join('')}
                </div>
                <div style="margin-top: 100px; padding: 40px; background: #f8fafc; border-radius: 30px; border: 1px solid #e2e8f0; font-style: italic; color: #64748b; font-size: 14px; line-height: 1.6;">
                    This manuscript represents a deterministic refraction of the "${channel.title}" learning path. Total sections: ${chapters.length}.
                </div>
            </div>
          `);

          // --- 3. CHAPTERS & CONTENT ---
          for (let cIdx = 0; cIdx < chapters.length; cIdx++) {
              const ch = chapters[cIdx];
              setBookProgress(`Binding Node ${cIdx+1}...`);
              
              const summary = await generateChapterSummary(ch);
              
              // Chapter Cover
              await renderToPdf(`
                <div style="width: 750px; height: 1050px; background: #1e293b; color: white; padding: 80px 100px; font-family: ${CHINESE_FONT_STACK}; display: flex; flex-direction: column; justify-content: center; position: relative;">
                    <div style="font-size: 200px; font-weight: 900; color: rgba(255,255,255,0.03); position: absolute; top: 80px; right: 100px;">0${cIdx+1}</div>
                    <p style="font-size: 14px; font-weight: 900; color: #818cf8; text-transform: uppercase; letter-spacing: 0.6em; margin-bottom: 25px;">Registry Segment</p>
                    <h1 style="font-size: 56px; font-weight: 900; text-transform: uppercase; margin: 0; line-height: 1.1;">${ch.title}</h1>
                    <div style="width: 80px; height: 5px; background: #6366f1; margin-top: 45px; margin-bottom: 60px;"></div>
                    <div style="max-width: 500px; font-size: 22px; color: #cbd5e1; line-height: 1.8; background: rgba(255,255,255,0.05); padding: 45px; border-radius: 32px; border: 1px solid rgba(255,255,255,0.1); italic: true; box-shadow: 0 30px 60px -12px rgba(0,0,0,0.3);">
                        "${summary}"
                    </div>
                </div>
              `);

              // Body Content (Strict 36-line governance per page)
              const maxLinesPerPage = 36;
              let currentLines = 0;
              let currentPageHtml = "";

              for (const sub of ch.subTopics) {
                  const cacheKey = `lecture_${channel.id}_${sub.id}_${language}`;
                  let lecture = await getCachedLectureScript(cacheKey) || await generateLectureScript(sub.title, channel.description, language, channel.id, channel.voiceName);
                  
                  if (lecture) {
                      const subHeader = `<h2 style="font-size: 16px; font-weight: 900; color: #6366f1; margin-top: 40px; margin-bottom: 20px; text-transform: uppercase; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px;">${sub.title}</h2>`;
                      
                      // Check if new sub-topic needs fresh page
                      if (currentLines > 28) {
                          await renderToPdf(wrapContent(currentPageHtml, ch.title, sessionHash));
                          currentPageHtml = subHeader;
                          currentLines = 4;
                      } else {
                          currentPageHtml += subHeader;
                          currentLines += 4;
                      }

                      for (const s of lecture.sections) {
                          const isTeacher = s.speaker === 'Teacher';
                          const speakerName = isTeacher ? (lecture.professorName || 'Host') : (lecture.studentName || 'Student');
                          const textLines = Math.ceil(s.text.length / 95) + 1; // 95 chars per line approx at 12px
                          
                          if (currentLines + textLines > maxLinesPerPage) {
                              await renderToPdf(wrapContent(currentPageHtml, ch.title, sessionHash));
                              currentPageHtml = "";
                              currentLines = 0;
                          }

                          currentPageHtml += `
                            <div style="margin-bottom: 15px; font-family: ${SERIF_FONT_STACK}; font-size: 12px; line-height: 1.5; color: #334155;">
                                <span style="font-weight: 900; color: ${isTeacher ? '#4338ca' : '#475569'}; text-transform: uppercase; margin-right: 8px;">${speakerName}:</span>
                                <span>${s.text}</span>
                            </div>
                          `;
                          currentLines += textLines + 1;
                      }
                  }
              }
              if (currentPageHtml) {
                  await renderToPdf(wrapContent(currentPageHtml, ch.title, sessionHash));
              }
          }

          // --- 4. BACK COVER WITH SCAN CODE ---
          setBookProgress("Finalizing Publication...");
          await renderToPdf(`
            <div style="width: 750px; height: 1050px; background: #020617; color: white; padding: 120px 100px; font-family: ${CHINESE_FONT_STACK}; display: flex; flex-direction: column; justify-content: center; text-align: center; border: 25px solid #0f172a;">
                <div style="margin-bottom: 80px;">
                    <div style="width: 60px; height: 4px; background: #6366f1; margin: 0 auto 35px auto;"></div>
                    <h2 style="font-size: 38px; font-weight: 900; letter-spacing: -0.02em; text-transform: uppercase; italic: true; margin-bottom: 25px;">Synthesized Intelligence</h2>
                    <p style="color: #94a3b8; font-size: 20px; max-width: 550px; margin: 0 auto; line-height: 1.8;">
                        This technical manuscript is a sovereign refraction of the "${channel.title}" activity ledger.
                    </p>
                </div>

                <div style="background: white; padding: 40px; border-radius: 50px; width: fit-content; margin: 0 auto; box-shadow: 0 40px 100px -20px rgba(99, 102, 241, 0.4); border: 8px solid #6366f1;">
                    <img src="${qrCodeUrl}" style="width: 250px; height: 250px;" />
                    <p style="color: #020617; font-size: 12px; font-weight: 900; margin-top: 25px; text-transform: uppercase; letter-spacing: 0.25em;">Scan to Access Live Registry</p>
                </div>

                <div style="margin-top: 100px;">
                    <p style="font-size: 13px; font-weight: 900; color: #6366f1; text-transform: uppercase; letter-spacing: 0.3em; margin-bottom: 12px;">NEURAL PRISM PUBLISHING</p>
                    <p style="font-size: 10px; color: #475569; font-mono: true;">Verified via Protocol v6.1.2 // Ledger Node: ${generateSecureId().substring(0, 16)}</p>
                </div>
            </div>
          `);

          document.body.removeChild(captureContainer);
          pdf.save(`${channel.title.replace(/\s+/g, '_')}_Neural_Manuscript.pdf`);
          dispatchLog(`Manuscript Compiled. 36-line safety frame verified.`, 'success');
      } catch (e: any) { dispatchLog(`Synthesis Failed: ${e.message}`, 'error'); } finally { setIsGeneratingBook(false); setBookProgress(""); }
  };

  const wrapContent = (html: string, chapterTitle: string, hash: string) => `
    <div style="width: 750px; height: 1050px; background: #ffffff; color: #0f172a; padding: 80px 100px; font-family: ${CHINESE_FONT_STACK}; display: flex; flex-direction: column; position: relative;">
        <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px; margin-bottom: 40px;">
            <span style="font-size: 10px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.15em;">${chapterTitle}</span>
            <span style="font-size: 10px; font-weight: 900; color: #cbd5e1;">NEURAL PRISM MANUSCRIPT</span>
        </div>
        <div style="flex: 1; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-start;">
            ${html}
        </div>
        <div style="margin-top: auto; padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center;">
            <p style="font-size: 9px; color: #cbd5e1; font-weight: 900; letter-spacing: 0.4em; margin: 0;">BOUND BY NEURAL PRISM // TRACE: ${hash}</p>
        </div>
    </div>
  `;

  const handleGenerateArt = async () => {
    setIsGeneratingArt(true);
    try {
        const b64 = await generateChannelCoverArt(channel.title, channel.description);
        if (b64) {
            setLocalArtPreview(b64);
            await saveLocalAsset(`cover_${channel.id}`, b64);
            await onUpdateChannel({ ...channel, imageUrl: b64 });
        }
    } finally { setIsGeneratingArt(false); }
  };

  if (activeLecture) {
      return (
          <div className="h-full flex flex-col bg-slate-950 animate-fade-in">
              <header className="p-6 border-b border-white/5 bg-slate-900/50 flex items-center justify-between backdrop-blur-xl shrink-0 z-20">
                  <div className="flex items-center gap-4">
                      <button onClick={stopSequentialPlayback} className="p-2 hover:bg-white/10 rounded-xl text-slate-400"><ArrowLeft/></button>
                      <h2 className="text-sm font-black text-white uppercase tracking-widest">{activeLecture.topic}</h2>
                  </div>
                  <div className="flex items-center gap-6">
                      <div className="w-32 h-10 overflow-hidden rounded-full bg-slate-950/50 border border-white/5 flex items-center justify-center">
                        <Visualizer volume={liveVolume} isActive={true} color="#818cf8"/>
                      </div>
                      <button onClick={stopSequentialPlayback} className="px-6 py-2 bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Close Focus</button>
                  </div>
              </header>
              <div className="flex-1 overflow-y-auto p-10 scrollbar-hide bg-slate-950">
                  <div className="max-w-3xl mx-auto space-y-12 pb-[50vh]">
                      {activeLecture.sections.map((section, idx) => {
                          const isCurrent = idx === currentSectionIndex;
                          const isTeacher = section.speaker === 'Teacher';
                          return (
                              <div key={idx} ref={el => { sectionRefs.current[idx] = el; }} className={`flex flex-col ${isTeacher ? 'items-start' : 'items-end'} transition-all duration-700 ${isCurrent ? 'opacity-100 scale-100' : 'opacity-40 scale-95'}`}>
                                  <span className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isTeacher ? 'text-indigo-400' : 'text-slate-50'}`}>{isTeacher ? activeLecture.professorName : activeLecture.studentName}</span>
                                  <div className={`max-w-[85%] px-8 py-6 rounded-[2rem] text-xl leading-relaxed shadow-2xl relative transition-all duration-500 ${isCurrent ? 'ring-2 ring-indigo-500 bg-slate-900' : 'bg-slate-900/40'} ${isTeacher ? 'text-slate-100 rounded-tl-sm' : 'text-indigo-50 rounded-tr-sm'}`}>
                                      <p className="whitespace-pre-wrap">{section.text}</p>
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="h-full flex flex-col bg-slate-950 p-10 overflow-y-auto scrollbar-hide">
        <div className="max-w-4xl mx-auto w-full space-y-10">
            <header className="flex items-center justify-between">
                <button onClick={onBack} className="p-3 hover:bg-slate-900 rounded-2xl text-slate-400 transition-all"><ArrowLeft/></button>
                <div className="flex gap-4">
                    {isGeneratingBook ? (
                        <div className="px-6 py-3 bg-indigo-950 border border-indigo-500/30 rounded-2xl flex items-center gap-3 shadow-xl">
                            <Loader2 className="animate-spin text-indigo-400" size={16}/>
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">{bookProgress}</span>
                        </div>
                    ) : (
                        <button onClick={handleDownloadFullBook} className="px-8 py-3 bg-slate-900 border border-slate-800 text-indigo-400 hover:border-indigo-500 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2">
                            <FileOutput size={16}/> {t.synthesizeBook}
                        </button>
                    )}
                    <button onClick={() => onStartLiveSession(channel)} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-900/40 transition-all active:scale-95 flex items-center gap-2">
                        <Play size={16} fill="currentColor"/> Launch Studio
                    </button>
                </div>
            </header>

            <div className="flex flex-col md:flex-row gap-10">
                <div className="relative group shrink-0">
                    {!imageError && (localArtPreview || channel.imageUrl) ? (
                        <img src={localArtPreview || channel.imageUrl} className="w-64 h-64 rounded-[3rem] object-cover shadow-2xl border-4 border-slate-900" onError={() => setImageError(true)} />
                    ) : (
                        <div className="w-64 h-64 rounded-[3rem] bg-slate-900 border-4 border-dashed border-slate-800 flex flex-col items-center justify-center text-slate-700 gap-4">
                            <ImageIconLucide size={40} className="opacity-20" />
                        </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950/40 rounded-[3rem]">
                        <button onClick={handleGenerateArt} disabled={isGeneratingArt} className="p-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl shadow-2xl">
                            {isGeneratingArt ? <Loader2 className="animate-spin" size={24}/> : <Sparkles size={24}/>}
                        </button>
                    </div>
                </div>
                <div className="flex-1 space-y-4">
                    <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">{channel.title}</h1>
                    <p className="text-slate-400 text-lg font-medium leading-relaxed">{channel.description}</p>
                    <div className="flex items-center gap-6 pt-4">
                        <div className="flex flex-col"><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t.host}</span><span className="text-sm font-bold text-indigo-400">{channel.voiceName}</span></div>
                        <div className="w-px h-8 bg-slate-800"></div>
                        <div className="flex flex-col"><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Chapters</span><span className="text-sm font-bold text-white">{chapters.length} Segments</span></div>
                    </div>
                </div>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
                {chapters.map((ch, idx) => (
                    <div key={ch.id} className="bg-slate-900/40 border border-slate-800/50 p-6 rounded-3xl">
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Registry 0{idx+1}: {ch.title}</h3>
                        <div className="space-y-2">
                            {ch.subTopics.map(sub => {
                                const isReading = activeReadingSubTopicId === sub.id;
                                const isPlayed = playedSubTopicIds.has(sub.id);
                                return (
                                    <div key={sub.id} className="flex gap-2">
                                        <div className={`flex-1 flex items-center gap-2 group ${isReading ? 'bg-indigo-600/20 border-indigo-500 rounded-2xl' : 'bg-slate-950/50 border border-transparent hover:bg-slate-800 rounded-2xl'} transition-all pr-4`}>
                                            <button onClick={() => handlePlaySubTopic(sub)} className={`flex-1 text-left px-5 py-4 text-sm font-bold flex justify-between items-center ${isReading ? 'text-white' : 'text-slate-300'}`}>
                                                <div className="flex items-center gap-4">
                                                    <div className={`p-2 rounded-xl transition-all ${isReading ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                                                        {isReading ? <Pause size={16} fill="currentColor"/> : <Play size={16} fill="currentColor"/>}
                                                    </div>
                                                    <span className="truncate">{sub.title}</span>
                                                </div>
                                                {isReading && <Visualizer volume={liveVolume} isActive={true} color="#818cf8"/>}
                                                {isPlayed && !isReading && <CheckCircle size={14} className="text-emerald-500"/>}
                                            </button>
                                        </div>
                                        <button onClick={() => onStartLiveSession(channel, `Q&A for: ${sub.title}`, true)} disabled={!isPlayed} className={`px-5 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${isPlayed ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400 hover:bg-indigo-600 hover:text-white' : 'bg-slate-900 border-slate-800 text-slate-700 opacity-40'}`}>
                                            {isPlayed ? <MessageSquare size={14}/> : <Lock size={14}/>}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};
