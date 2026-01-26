
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Channel, GeneratedLecture, Chapter, SubTopic, Attachment, UserProfile, AgentMemory } from '../types';
import { ArrowLeft, BookOpen, FileText, Download, Loader2, ChevronDown, ChevronRight, ChevronLeft, Check, Printer, FileDown, Info, Sparkles, Book, CloudDownload, Music, Package, FileAudio, Zap, Radio, CheckCircle, ListTodo, Share2, Play, Pause, Square, Volume2, RefreshCw, RefreshCcw, Wand2, Edit3, Save, ShieldCheck, ImageIcon, Lock, Cloud, BookText, Languages, X, AlertTriangle, Database, Terminal, SkipBack, SkipForward, QrCode, Activity } from 'lucide-react';
import { generateLectureScript } from '../services/lectureGenerator';
import { synthesizeSpeech } from '../services/tts';
import { generateCardImage } from '../services/cardGen';
import { OFFLINE_CHANNEL_ID, OFFLINE_CURRICULUM } from '../utils/offlineContent';
import { SPOTLIGHT_DATA } from '../utils/spotlightContent';
import { cacheLectureScript, getCachedLectureScript, getAudioKeys, getCachedAudioBuffer } from '../utils/db';
import { getGlobalAudioContext, registerAudioOwner, stopAllPlatformAudio, getGlobalAudioGeneration, warmUpAudioContext } from '../utils/audioUtils';
import { MarkdownView } from './MarkdownView';
import { auth } from '../services/firebaseConfig';
import { isUserAdmin, getCloudCachedLecture, saveCloudCachedLecture, uploadFileToStorage } from '../services/firestoreService';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { generateSecureId } from '../utils/idUtils';

// --- NEURAL PERSISTENCE LAYER (Module Scope) ---
const GLOBAL_BOOT_LOCK = new Set<string>();
const GLOBAL_LECTURE_BUFFER = new Map<string, GeneratedLecture>();
const GLOBAL_INDEX_BUFFER = new Map<string, number>(); 
const GLOBAL_STATUS_REGISTRY = new Map<string, 'loading' | 'ready' | 'error'>();
const GLOBAL_LOGGED_STALE_HASHES = new Set<string>();

interface PodcastDetailProps {
  channel: Channel;
  onBack: () => void;
  onStartLiveSession: (
    channel: Channel, 
    context?: string, 
    recordingEnabled?: boolean, 
    bookingId?: string, 
    videoEnabled?: boolean, 
    cameraEnabled?: boolean, 
    activeSegment?: { index: number, lectureId: string }
  ) => void;
  language: 'en' | 'zh';
  onEditChannel?: (channel: Channel) => void; 
  onViewComments?: () => void;
  onUpdateChannel?: (updated: Channel) => void;
  currentUser: any;
  userProfile?: UserProfile | null;
  isProMember?: boolean;
}

const UI_TEXT = {
  en: {
    back: "Back", curriculum: "Curriculum", 
    generating: "Neural Synthesis...", genDesc: "AI is drafting the next lesson.",
    lectureTitle: "Lecture Script", downloadPdf: "Download PDF",
    playAudio: "Listen to Lecture", stopAudio: "Stop Audio",
    buffering: "Neural Synthesis...", regenerate: "Neural Re-synthesis",
    regenerating: "Re-synthesizing...",
    fatalError: "Neural Core Halted",
    retry: "Manual Re-Link",
    cloudSync: "Syncing with Vault...",
    proToRefract: "Pro Required to Refract",
    downloadBook: "Download Full Book",
    updateBook: "Update & Download Book",
    establishing: "Establishing Neural Link...",
    synthesizingBook: "Synthesizing Full Book...",
    nextLesson: "Auto-paging to next node...",
    speedCheck: "Speed Health Check",
    cachedStatus: "Hydration Status",
    fullyHydrated: "100% Hydrated (0 API Cost)",
    quotaHalt: "Quota Halted. Checkpoint saved.",
    resumeAudit: "Resume Audit",
    synthesizingChapter: "Synthesizing Chapter Illustration...",
    readyToDownload: "Finalizing and ready to download...",
    staleDetected: "Content mismatch detected. New book required.",
    hardRegen: "Hard Re-synthesis from AI"
  },
  zh: {
    back: "返回", curriculum: "课程大纲", 
    generating: "神经合成中...", genDesc: "AI 正在编写下一课。",
    lectureTitle: "讲座文稿", downloadPdf: "下载 PDF",
    playAudio: "播放讲座音频", stopAudio: "停止朗读",
    buffering: "神经合成中...", regenerate: "神经重构",
    regenerating: "正在重构...",
    fatalError: "神经核心已停机",
    retry: "手动重连",
    usingSystemVoice: "神经通路繁忙：正在切换系统语音",
    cloudSync: "正在同步金库...",
    proToRefract: "需要 Pro 权限进行重构",
    downloadBook: "下载完整书籍",
    updateBook: "更新并下载书籍",
    establishing: "正在建立神经连接...",
    synthesizingBook: "正在合成完整书籍...",
    nextLesson: "正在自动跳转到下一课...",
    speedCheck: "快速健康体检",
    cachedStatus: "预热状态",
    fullyHydrated: "100% 已预热 (零 API 成本)",
    quotaHalt: "配额受限。已保存检查点。",
    resumeAudit: "继续审计",
    synthesizingChapter: "正在合成章节插图...",
    readyToDownload: "正在最后整理并准备下载...",
    staleDetected: "检测到内容更改。需要重新合成书籍。",
    hardRegen: "从 AI 强制重新合成"
  }
};

const PodcastDetail: React.FC<PodcastDetailProps> = ({ 
    channel, onBack, language, currentUser, onStartLiveSession, userProfile, onUpdateChannel, onEditChannel, isProMember
}) => {
  const t = useMemo(() => UI_TEXT[language], [language]);
  
  // -- Local UI States --
  const [activeLecture, setActiveLecture] = useState<GeneratedLecture | null>(() => {
      const cached = GLOBAL_LECTURE_BUFFER.get(channel.id);
      return cached || null;
  });
  
  const [isLoadingLecture, setIsLoadingLecture] = useState(() => GLOBAL_STATUS_REGISTRY.get(channel.id) === 'loading');
  const [currentSectionIndex, setCurrentSectionIndex] = useState(() => GLOBAL_INDEX_BUFFER.get(channel.id) ?? -1);
  
  const [isExportingBook, setIsExportingBook] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const [activeSubTopicId, setActiveSubTopicId] = useState<string | null>(null);
  const [activeSubTopicTitle, setActiveSubTopicTitle] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<string>(t.generating);
  const [dataSource, setDataSource] = useState<'vault' | 'ai' | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);

  // --- HEALTH CHECK ENGINE STATES ---
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditProgress, setAuditProgress] = useState(0); 
  const [isFullyHydrated, setIsFullyHydrated] = useState(false);
  const [showStatusPill, setShowStatusPill] = useState(false);
  const [auditCheckpoint, setAuditCheckpoint] = useState<number>(() => {
      return parseInt(localStorage.getItem(`audit_checkpoint_${channel.id}_${language}`) || "0");
  });

  const activeLectureRef = useRef<GeneratedLecture | null>(GLOBAL_LECTURE_BUFFER.get(channel.id) || null);
  const isPlayingRef = useRef(false);
  const playbackSessionRef = useRef(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const isTransitioningRef = useRef(false);
  const activeSubTopicIdRef = useRef<string | null>(null);
  const chaptersRef = useRef<Chapter[]>([]);
  const sectionRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const nextLessonTimerRef = useRef<any>(null);

  const MY_TOKEN = useMemo(() => `PodcastDetail:${channel.id}`, [channel.id]);
  const isAdmin = isUserAdmin(userProfile || null);

  const chapters = useMemo(() => {
      let list: Chapter[] = [];
      if (channel.chapters && channel.chapters.length > 0) list = channel.chapters;
      else if (channel.id === OFFLINE_CHANNEL_ID) list = OFFLINE_CURRICULUM;
      else if (SPOTLIGHT_DATA[channel.id]) list = SPOTLIGHT_DATA[channel.id].curriculum;
      chaptersRef.current = list;
      return list;
  }, [channel.id, channel.chapters]);

  const getCurriculumHash = useCallback(async () => {
    const rawData = chapters.map(c => `${c.title}:${c.subTopics.map(s => s.title).join(',')}`).join('|');
    const msgBuffer = new TextEncoder().encode(rawData + (channel.title || '') + (channel.description || ''));
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }, [chapters, channel.title, channel.description]);

  const [bookStatus, setBookStatus] = useState<'ready' | 'stale' | 'none'>('none');
  const [cachedBookUrl, setCachedBookUrl] = useState<string | null>(null);
  
  const lastStateCheckRef = useRef<string>("");

  const dispatchLog = useCallback((text: string, type: 'info' | 'error' | 'success' | 'warn' = 'info') => {
      window.dispatchEvent(new CustomEvent('neural-log', { detail: { text, type } }));
  }, []);

  useEffect(() => {
      let isSubscribed = true;
      const checkStaleStatus = async () => {
          const liveHash = await getCurriculumHash();
          const checkKey = `${channel.id}:${liveHash}:${language}:${channel.fullBookUrl || ''}`;
          
          if (lastStateCheckRef.current === checkKey) return;
          lastStateCheckRef.current = checkKey;

          const cachedHash = localStorage.getItem(`book_hash_${channel.id}_${language}`);
          const storedUrl = channel.fullBookUrl || localStorage.getItem(`book_url_${channel.id}_${language}`);
          
          if (!isSubscribed) return;

          if (!storedUrl) {
              setBookStatus('none');
              setCachedBookUrl(null);
          } else if (cachedHash !== liveHash) {
              setBookStatus('stale');
              setCachedBookUrl(storedUrl);
              
              if (!GLOBAL_LOGGED_STALE_HASHES.has(liveHash)) {
                  GLOBAL_LOGGED_STALE_HASHES.add(liveHash);
                  dispatchLog(t.staleDetected, 'warn');
              }
          } else {
              setBookStatus('ready');
              setCachedBookUrl(storedUrl);
          }
      };
      checkStaleStatus();
      return () => { isSubscribed = false; };
  }, [channel.id, channel.fullBookUrl, language, getCurriculumHash, dispatchLog, t.staleDetected]);

  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(chapters[0]?.id || null);

  useEffect(() => {
    if (currentSectionIndex >= 0 && sectionRefs.current[currentSectionIndex]) {
        sectionRefs.current[currentSectionIndex]?.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
    }
  }, [currentSectionIndex]);

  const checkGlobalCacheStatus = useCallback(async () => {
    const allSubTopics = chapters.flatMap(c => c.subTopics);
    if (allSubTopics.length === 0) return 0;

    let cachedCount = 0;
    for (const sub of allSubTopics) {
        const cacheKey = `lecture_${channel.id}_${sub.id}_${language}`;
        const lecture = await getCachedLectureScript(cacheKey);
        if (lecture) {
            cachedCount++;
        }
    }
    const percent = Math.round((cachedCount / allSubTopics.length) * 100);
    setAuditProgress(percent);
    setIsFullyHydrated(percent === 100);
    return percent;
  }, [chapters, channel.id, language]);

  useEffect(() => {
      checkGlobalCacheStatus();
  }, [checkGlobalCacheStatus]);

  const stopReading = useCallback(() => {
    playbackSessionRef.current++;
    setIsPlaying(false);
    isPlayingRef.current = false;
    setIsBuffering(false);
    setCurrentSectionIndex(-1);
    GLOBAL_INDEX_BUFFER.set(channel.id, -1);
    if (nextLessonTimerRef.current) clearTimeout(nextLessonTimerRef.current);
    
    activeSourcesRef.current.forEach(source => {
        try { source.stop(); source.disconnect(); } catch(e) {}
    });
    activeSourcesRef.current.clear();
    
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
  }, [channel.id]);

  const handlePlayLecture = useCallback(async (forcedLecture?: GeneratedLecture) => {
    const lectureToPlay = forcedLecture || activeLectureRef.current;
    if (!lectureToPlay) {
        dispatchLog("[Playback] Aborted: No content in buffer.", "warn");
        return;
    }

    if (isPlayingRef.current && !forcedLecture) {
        stopReading();
        return;
    }

    const ctx = getGlobalAudioContext();
    if (ctx.state === 'suspended') await warmUpAudioContext(ctx);

    const localSessionId = ++playbackSessionRef.current;
    registerAudioOwner(MY_TOKEN, stopReading);
    
    setIsPlaying(true);
    isPlayingRef.current = true;

    try {
        const hostVoice = channel.voiceName || 'Puck';
        for (let i = 0; i < lectureToPlay.sections.length; i++) {
            if (localSessionId !== playbackSessionRef.current) return;
            
            const section = lectureToPlay.sections[i];
            const voice = section.speaker === 'Teacher' ? hostVoice : 'Zephyr';
            
            setCurrentSectionIndex(i);
            GLOBAL_INDEX_BUFFER.set(channel.id, i);
            setIsBuffering(true);
            
            const result = await synthesizeSpeech(section.text, voice, ctx, 'gemini', language);
            
            if (localSessionId !== playbackSessionRef.current) return;
            setIsBuffering(false);

            if (result.buffer && localSessionId === playbackSessionRef.current) {
                await new Promise<void>((resolve) => {
                    const source = ctx.createBufferSource();
                    source.buffer = result.buffer;
                    source.connect(ctx.destination);
                    activeSourcesRef.current.add(source);
                    source.onended = () => {
                        activeSourcesRef.current.delete(source);
                        resolve();
                    };
                    source.start(0);
                });
            }
            if (localSessionId === playbackSessionRef.current) {
                await new Promise(r => setTimeout(r, 600));
            }
        }
        
        if (localSessionId !== playbackSessionRef.current) return;
        
        dispatchLog(`[Progression] ${t.nextLesson}`, "info");
        nextLessonTimerRef.current = setTimeout(handleNextTopic, 1500);

    } catch (e) {
        console.error("Playback interruption", e);
    } finally {
        if (localSessionId === playbackSessionRef.current) {
            setIsPlaying(false);
            isPlayingRef.current = false;
            setIsBuffering(false);
        }
    }
  }, [channel.id, channel.voiceName, language, stopReading, MY_TOKEN, dispatchLog, t.nextLesson]);

  const handleTopicClick = useCallback(async (topicTitle: string, subTopicId: string, autoPlay = false) => {
    if (isTransitioningRef.current && autoPlay) return;
    
    isTransitioningRef.current = true;
    activeSubTopicIdRef.current = subTopicId;

    stopReading();
    setFatalError(null);
    setActiveSubTopicId(subTopicId);
    setActiveSubTopicTitle(topicTitle);
    
    setIsLoadingLecture(true);
    GLOBAL_STATUS_REGISTRY.set(channel.id, 'loading');
    setDataSource(null);

    try {
        dispatchLog(`[Registry] Handshaking node: "${topicTitle}"...`, 'info');
        let found: GeneratedLecture | null = null;

        const spotlight = SPOTLIGHT_DATA[channel.id];
        if (spotlight && spotlight.lectures[topicTitle]) {
            found = spotlight.lectures[topicTitle];
            setDataSource('vault');
        }

        if (!found) {
            const cachedLocal = await getCachedLectureScript(`lecture_${channel.id}_${subTopicId}_${language}`);
            if (cachedLocal) { 
                found = cachedLocal;
                setDataSource('vault');
            }
        }

        if (!found) {
            const cachedCloud = await getCloudCachedLecture(channel.id, subTopicId, language);
            if (cachedCloud) {
                found = cachedCloud;
                setDataSource('vault');
                await cacheLectureScript(`lecture_${channel.id}_${subTopicId}_${language}`, cachedCloud);
            }
        }
        
        if (!found) {
            if (!isProMember && channel.id !== OFFLINE_CHANNEL_ID && !SPOTLIGHT_DATA[channel.id]) {
                dispatchLog(`[Clearance] ${t.proToRefract}`, 'warn');
                setIsLoadingLecture(false);
                GLOBAL_STATUS_REGISTRY.set(channel.id, 'ready');
                isTransitioningRef.current = false;
                return;
            }
            setLoadingStatus(t.generating);
            found = await generateLectureScript(topicTitle, channel.description, language, channel.id, channel.voiceName);
            if (found) setDataSource('ai');
        }

        if (found) {
            setActiveLecture(found);
            activeLectureRef.current = found;
            GLOBAL_LECTURE_BUFFER.set(channel.id, found); 
            GLOBAL_STATUS_REGISTRY.set(channel.id, 'ready');
            setIsLoadingLecture(false);
            if (autoPlay) {
                requestAnimationFrame(() => handlePlayLecture(found!));
            }
        }
    } catch (e: any) {
        setFatalError(e.message || String(e));
        GLOBAL_STATUS_REGISTRY.set(channel.id, 'error');
        dispatchLog(`[Registry] Node failed to load.`, 'error');
    } finally { 
        setIsLoadingLecture(false); 
        isTransitioningRef.current = false;
    }
  }, [channel.id, channel.description, channel.voiceName, language, stopReading, t, isProMember, dispatchLog, handlePlayLecture]);

  const handleNextTopic = useCallback(() => {
      const currentList = chaptersRef.current;
      const currentSubId = activeSubTopicIdRef.current;
      if (!currentSubId || currentList.length === 0) return;

      let foundNext = false;
      for (let i = 0; i < currentList.length; i++) {
          const ch = currentList[i];
          const subIdx = ch.subTopics.findIndex(s => s.id === currentSubId);
          if (subIdx !== -1) {
              if (subIdx < ch.subTopics.length - 1) {
                  const next = ch.subTopics[subIdx + 1];
                  dispatchLog(`[Progression] Transitioning to: "${next.title}"`, 'info');
                  handleTopicClick(next.title, next.id, true); // Force play on next
                  foundNext = true;
                  break;
              } else if (i < currentList.length - 1) {
                  const nextCh = currentList[i + 1];
                  const next = nextCh.subTopics[0];
                  dispatchLog(`[Progression] Chapter complete. Opening: "${nextCh.title}"`, 'info');
                  setExpandedChapterId(nextCh.id);
                  handleTopicClick(next.title, next.id, true); // Force play on next chapter start
                  foundNext = true;
                  break;
              }
          }
      }
      
      if (!foundNext) {
          dispatchLog("[Progression] Neural course finalized. All nodes processed.", "success");
      }
  }, [dispatchLog, channel.id, handleTopicClick]);

  const handlePrevTopic = useCallback(() => {
    const currentList = chaptersRef.current;
    const currentSubId = activeSubTopicIdRef.current;
    if (!currentSubId || currentList.length === 0) return;

    let foundPrev = false;
    for (let i = 0; i < currentList.length; i++) {
        const ch = currentList[i];
        const subIdx = ch.subTopics.findIndex(s => s.id === currentSubId);
        if (subIdx !== -1) {
            if (subIdx > 0) {
                const prev = ch.subTopics[subIdx - 1];
                dispatchLog(`[Progression] Regressing to: "${prev.title}"`, 'info');
                handleTopicClick(prev.title, prev.id, true); // Force play on prev
                foundPrev = true;
                break;
            } else if (i > 0) {
                const prevCh = currentList[i - 1];
                const prev = prevCh.subTopics[prevCh.subTopics.length - 1];
                dispatchLog(`[Progression] Moving back to Chapter: "${prevCh.title}"`, 'info');
                setExpandedChapterId(prevCh.id);
                handleTopicClick(prev.title, prev.id, true); // Force play on prev chapter end
                foundPrev = true;
                break;
            }
        }
    }
    
    if (!foundPrev) {
        dispatchLog("[Progression] Reached the first node.", "warn");
    }
  }, [dispatchLog, channel.id, handleTopicClick]);

  // --- NEURAL PRE-HEATING ENGINE (SEQUENTIAL) ---
  const handleSpeedHealthCheck = async () => {
    if (isAuditing || isFullyHydrated) return;
    setIsAuditing(true);
    dispatchLog(`[Audit] Initializing Sequential Health Check...`, 'info');

    const allSubTopics = chapters.flatMap(c => c.subTopics);
    const checkpointKey = `audit_checkpoint_${channel.id}_${language}`;
    
    try {
        const ctx = getGlobalAudioContext();
        for (let i = auditCheckpoint; i < allSubTopics.length; i++) {
            const sub = allSubTopics[i];
            dispatchLog(`[Audit] Processing Node ${i+1}/${allSubTopics.length}: "${sub.title}"`, 'info');

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

            if (lecture) {
                for (const section of lecture.sections) {
                    const voice = section.speaker === 'Teacher' ? (channel.voiceName || 'Puck') : 'Zephyr';
                    const result = await synthesizeSpeech(section.text, voice, ctx, 'gemini', language);
                    if (result.errorType === 'quota') {
                        setAuditCheckpoint(i);
                        localStorage.setItem(checkpointKey, i.toString());
                        throw new Error(t.quotaHalt);
                    }
                }
            }

            const newPercent = Math.round(((i + 1) / allSubTopics.length) * 100);
            setAuditProgress(newPercent);
            
            await new Promise(r => setTimeout(r, 1000));
        }

        setIsFullyHydrated(true);
        setAuditProgress(100);
        setAuditCheckpoint(0);
        localStorage.removeItem(checkpointKey);
        dispatchLog(`[Audit] Spectrum fully hydrated. 0 API cost ready.`, 'success');
    } catch (e: any) {
        dispatchLog(`[Audit] ${e.message}`, 'warn');
    } finally {
        setIsAuditing(false);
    }
  };

  const handleDownloadFullBook = async (force: boolean = false) => {
      if (!isProMember) {
          dispatchLog(`[Clearance] ${t.proToRefract}`, 'warn');
          return;
      }
      
      const liveHash = await getCurriculumHash();
      const cachedBookKey = `book_url_${channel.id}_${language}`;
      const cachedHashKey = `book_hash_${channel.id}_${language}`;
      
      const existingUrl = channel.fullBookUrl || localStorage.getItem(cachedBookKey);
      const existingHash = localStorage.getItem(cachedHashKey);
      
      const isStale = existingHash !== liveHash;

      if (existingUrl && !force && !isStale) {
          setExportStatus(t.readyToDownload);
          dispatchLog(`[Synthesis] Sovereign Record found. Retrieving existing book...`, 'success');
          window.open(existingUrl, '_blank');
          return;
      }

      setIsExportingBook(true);
      setExportStatus(t.synthesizingBook);
      dispatchLog(force ? `[Synthesis] FORCED RE-SYNTHESIS ACTIVE. Drafting everything from scratch...` : isStale ? `[Synthesis] STALE CONTENT DETECTED. Re-synthesizing Full Book...` : `[Synthesis] Initializing Formal Book Synthesis...`, 'info');
      
      try {
          const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' });
          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();
          let pageCount = 0;

          const sanitizeText = (str: string) => (str || '').replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|\u200D|\uFE0F/g, '');
          const sanitizedTitle = sanitizeText(channel.title);

          const drawHeaderFooter = (current: number) => {
              pdf.setFontSize(8);
              pdf.setTextColor(148, 163, 184); 
              pdf.text(`Neural Prism | ${sanitizedTitle}`, 60, 30); 
              
              pdf.setDrawColor(226, 232, 240); 
              pdf.line(60, pageHeight - 40, pageWidth - 60, pageHeight - 40);
              pdf.text(`Neural Archive • Jan 25, 2026`, 60, pageHeight - 25);
              pdf.text(`Page ${current}`, pageWidth - 60, pageHeight - 25, { align: 'right' });
          };

          const addPageIfOverflow = (currentY: number, neededHeight: number) => {
              const bottomMargin = 80;
              if (currentY + neededHeight > pageHeight - bottomMargin) {
                  pdf.addPage();
                  pageCount++;
                  drawHeaderFooter(pageCount);
                  // CRITICAL: Force reset to dark body text color after drawing light gray header/footer
                  pdf.setFont('helvetica', 'normal');
                  pdf.setFontSize(11);
                  pdf.setTextColor(30, 41, 59); // Dark slate body color
                  return 80; // Reset Y to top margin
              }
              return currentY;
          };

          // 1. FRONT COVER (Graphic Atom)
          setExportStatus("Generating Front Cover...");
          const coverDiv = document.createElement('div');
          coverDiv.style.width = '800px'; coverDiv.style.padding = '80px'; coverDiv.style.position = 'fixed'; coverDiv.style.left = '-10000px';
          coverDiv.innerHTML = `
              <div style="height: 1000px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; background: #ffffff; color: #020617; border: 20px solid #4338ca; position: relative;">
                  ${channel.imageUrl ? `<img src="${channel.imageUrl}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.08;" />` : ''}
                  <div style="position: relative; z-index: 10; padding: 60px;">
                      <p style="font-size: 14px; font-weight: 900; color: #4338ca; text-transform: uppercase; letter-spacing: 0.5em; margin-bottom: 20px;">Neural Prism Archive</p>
                      <h1 style="font-size: 64px; font-weight: 900; text-transform: uppercase; margin-bottom: 20px; line-height: 1; letter-spacing: -0.05em; color: #0f172a;">${sanitizedTitle}</h1>
                      <div style="width: 80px; height: 6px; background: #4338ca; margin: 40px auto;"></div>
                      <p style="font-size: 20px; line-height: 1.6; max-width: 600px; color: #334155; font-style: italic;">"${sanitizeText(channel.description)}"</p>
                      <div style="margin-top: 100px;">
                          <p style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.2em;">Architect Registry</p>
                          <p style="font-size: 24px; font-weight: 700; color: #4338ca;">@${sanitizeText(channel.author)}</p>
                      </div>
                  </div>
              </div>
          `;
          document.body.appendChild(coverDiv);
          const coverCanvas = await html2canvas(coverDiv, { scale: 2 });
          pdf.addPage(); pageCount++; drawHeaderFooter(pageCount);
          pdf.addImage(coverCanvas.toDataURL('image/jpeg', 0.92), 'JPEG', 60, 60, pageWidth - 120, (coverCanvas.height / 2) * ((pageWidth - 120) / 800));
          document.body.removeChild(coverDiv);

          // 2. TEXT FLOW START
          let currentY = 80;
          const LINE_HEIGHT = 16;
          const MAX_LINES_PER_PAGE = 27; // Content-focused limit
          let currentLinesOnPage = 0;

          const resetPage = () => {
              pdf.addPage();
              pageCount++;
              drawHeaderFooter(pageCount);
              currentY = 80;
              currentLinesOnPage = 0;
              // CRITICAL: Force reset to dark body text color after drawing light gray header/footer
              pdf.setFont('helvetica', 'normal');
              pdf.setFontSize(11);
              pdf.setTextColor(30, 41, 59); // Dark slate body color
          };

          for (let cIdx = 0; cIdx < chapters.length; cIdx++) {
              const chapter = chapters[cIdx];
              setExportStatus(`Synthesizing Chapter: ${chapter.title}`);
              
              resetPage();
              
              // Chapter Title
              pdf.setFont('helvetica', 'bold');
              pdf.setFontSize(32);
              pdf.setTextColor(15, 23, 42);
              const chTitleLines = pdf.splitTextToSize(chapter.title.toUpperCase(), pageWidth - 120);
              pdf.text(chTitleLines, 60, currentY);
              currentY += (chTitleLines.length * 35) + 20;

              for (const subTopic of chapter.subTopics) {
                  setExportStatus(`Refracting: "${sanitizeText(subTopic.title)}"...`);
                  let lecture: GeneratedLecture | null = null;
                  
                  if (!force) lecture = await getCachedLectureScript(`lecture_${channel.id}_${subTopic.id}_${language}`);
                  if (!lecture) lecture = await generateLectureScript(subTopic.title, channel.description, language, channel.id, channel.voiceName, force);

                  if (lecture) {
                      // Subtopic Header
                      currentY = addPageIfOverflow(currentY, 60);
                      pdf.setFont('helvetica', 'bold');
                      pdf.setFontSize(18);
                      pdf.setTextColor(67, 56, 202);
                      pdf.text(sanitizeText(lecture.topic), 60, currentY);
                      currentY += 25;
                      
                      // Flow Section Text
                      pdf.setFont('helvetica', 'normal');
                      pdf.setFontSize(11);
                      pdf.setTextColor(30, 41, 59);

                      for (const section of lecture.sections) {
                          const speakerLabel = `${section.speaker === 'Teacher' ? (lecture.professorName || 'Teacher') : (lecture.studentName || 'Student')}: `;
                          const fullText = speakerLabel + section.text;
                          const wrappedLines = pdf.splitTextToSize(fullText, pageWidth - 140);

                          for (const line of wrappedLines) {
                              if (currentLinesOnPage >= MAX_LINES_PER_PAGE || currentY > pageHeight - 80) {
                                  resetPage();
                              }
                              
                              if (line.startsWith(speakerLabel)) {
                                  pdf.setFont('helvetica', 'bold');
                                  pdf.setTextColor(30, 41, 59); // Ensure dark color reset for label
                                  pdf.text(speakerLabel, 70, currentY);
                                  pdf.setFont('helvetica', 'normal');
                                  pdf.text(line.substring(speakerLabel.length), 70 + pdf.getTextWidth(speakerLabel), currentY);
                              } else {
                                  pdf.setFont('helvetica', 'normal');
                                  pdf.setTextColor(30, 41, 59); // Ensure dark color reset for body
                                  pdf.text(line, 70, currentY);
                              }
                              
                              currentY += LINE_HEIGHT;
                              currentLinesOnPage++;
                          }
                          currentY += 10; // Paragraph spacing
                      }
                      currentY += 20; // Section spacing
                  }
              }
          }

          setExportStatus(t.readyToDownload);
          const pdfBlob = pdf.output('blob');
          const fileName = `books/${channel.id}_${language}_v${Date.now()}.pdf`; 
          const storageUrl = await uploadFileToStorage(fileName, pdfBlob);
          
          localStorage.setItem(cachedBookKey, storageUrl);
          localStorage.setItem(cachedHashKey, liveHash);
          if (onUpdateChannel) onUpdateChannel({ ...channel, fullBookUrl: storageUrl });

          pdf.save(`${sanitizedTitle.replace(/\s+/g, '_')}_Neural_Book.pdf`);
          dispatchLog(`[Synthesis] Book finalized. Searchable text flow confirmed.`, 'success');
          setBookStatus('ready');
          setCachedBookUrl(storageUrl);
          window.open(storageUrl, '_blank');
      } catch (e: any) {
          dispatchLog(`[Synthesis] Fatal Error: ${e.message}`, 'error');
          setExportStatus(`Failed: ${e.message}`);
      } finally { setIsExportingBook(false); }
  };

  useEffect(() => {
    const sessionKey = `${channel.id}:initial_boot`;
    if (chapters.length > 0 && !GLOBAL_BOOT_LOCK.has(sessionKey)) {
      const firstTopic = chapters[0].subTopics[0];
      if (firstTopic) {
        GLOBAL_BOOT_LOCK.add(sessionKey);
        handleTopicClick(firstTopic.title, firstTopic.id, true);
      }
    }
    
    return () => {
        if (nextLessonTimerRef.current) clearTimeout(nextLessonTimerRef.current);
    };
  }, [chapters, handleTopicClick, channel.id]);

  return (
    <div className="h-full bg-slate-950 text-slate-100 flex flex-row relative overflow-hidden">
      <aside className="w-80 lg:w-96 flex flex-col border-r border-slate-800 bg-slate-900/50 shrink-0 z-30">
          <div className="bg-slate-900 border-b border-slate-800 flex flex-col h-full overflow-hidden">
              <div className="p-6 border-b border-slate-800 bg-indigo-900/10 flex items-center justify-between gap-2 relative z-30">
                  <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 -ml-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors" title={t.back}><ArrowLeft size={18} /></button>
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white flex items-center gap-2">
                        <BookOpen size={16} className="text-indigo-400" />
                        {t.curriculum}
                    </h3>
                  </div>
                  
                  <div className="relative flex items-center gap-2">
                       <div className="relative group">
                          <button 
                              onClick={handleSpeedHealthCheck}
                              onMouseEnter={() => setShowStatusPill(true)}
                              onMouseLeave={() => setShowStatusPill(false)}
                              disabled={isAuditing}
                              className={`p-2 rounded-xl transition-all duration-300 border flex items-center justify-center gap-2 ${
                                  isFullyHydrated ? 'bg-emerald-600/20 border-emerald-500/30 text-emerald-400' : 
                                  isAuditing ? 'bg-indigo-600 text-white animate-pulse' : 
                                  'bg-slate-800 border-slate-700 text-indigo-400 hover:border-indigo-500 shadow-lg active:scale-95'
                              }`}
                              title={t.speedCheck}
                          >
                              {isFullyHydrated ? <CheckCircle size={18} /> : isAuditing ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} fill="currentColor" />}
                          </button>

                          {showStatusPill && (
                              <div className="absolute top-full right-0 mt-3 px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl animate-fade-in-up z-50 whitespace-nowrap">
                                  <div className="flex flex-col gap-1">
                                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t.cachedStatus}</p>
                                      <div className="flex items-center gap-3">
                                          <span className={`text-sm font-black ${isFullyHydrated ? 'text-emerald-400' : 'text-indigo-400'}`}>{auditProgress}%</span>
                                          <div className="w-24 h-1.5 bg-slate-950 rounded-full overflow-hidden">
                                              <div className={`h-full transition-all duration-1000 ${isFullyHydrated ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${auditProgress}%` }}></div>
                                          </div>
                                      </div>
                                      {isFullyHydrated && <p className="text-[8px] font-bold text-emerald-500/80 uppercase">{t.fullyHydrated}</p>}
                                  </div>
                              </div>
                          )}
                       </div>

                       {auditCheckpoint > 0 && !isAuditing && !isFullyHydrated && (
                           <button 
                              onClick={handleSpeedHealthCheck}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-black uppercase rounded-lg shadow-lg animate-fade-in flex items-center gap-1.5"
                           >
                               <RefreshCcw size={10} /> {t.resumeAudit}
                           </button>
                       )}
                  </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-800 scrollbar-hide relative z-10">
                  {chapters.map((ch) => (
                      <div key={ch.id}>
                          <button onClick={() => setExpandedChapterId(expandedChapterId === ch.id ? null : ch.id)} className="w-full flex items-center justify-between p-5 hover:bg-slate-800 transition-colors text-left font-black uppercase tracking-tight text-xs text-slate-200">
                              {ch.title}
                              {expandedChapterId === ch.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                          {expandedChapterId === ch.id && (
                              <div className="bg-slate-950/50 py-1 border-y border-white/5">
                                  {ch.subTopics.map((sub) => (
                                      <button 
                                          key={sub.id} 
                                          onClick={() => handleTopicClick(sub.title, sub.id)} 
                                          className={`w-full flex items-start space-x-3 px-8 py-4 text-left transition-all ${activeSubTopicId === sub.id ? 'bg-indigo-900/30 border-l-4 border-indigo-500' : 'hover:bg-slate-800'}`}
                                      >
                                          <span className={`text-[11px] font-bold uppercase tracking-tight ${activeSubTopicId === sub.id ? 'text-indigo-200' : 'text-slate-50'}`}>{sub.title}</span>
                                      </button>
                                  ))}
                              </div>
                          )}
                      </div>
                  ))}
              </div>
              
              <div className="p-6 border-t border-slate-800 shrink-0 space-y-3">
                  <div className="flex gap-2">
                      <button 
                          onClick={() => handleDownloadFullBook()}
                          disabled={isExportingBook}
                          className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 border ${
                              bookStatus === 'stale' 
                              ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 animate-pulse' 
                              : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-indigo-600 hover:text-white'
                          }`}
                      >
                          {isExportingBook ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16}/>}
                          <span>{isExportingBook ? (exportStatus || t.synthesizingBook) : bookStatus === 'stale' ? t.updateBook : t.downloadBook}</span>
                      </button>
                      
                      {bookStatus !== 'none' && (
                          <div className="relative group/more">
                              <button 
                                  onClick={() => handleDownloadFullBook(true)}
                                  disabled={isExportingBook}
                                  title={t.hardRegen}
                                  className="p-4 bg-slate-800 border border-slate-700 rounded-2xl text-slate-400 hover:text-indigo-400 hover:border-indigo-500 transition-all active:rotate-180 duration-500 shadow-lg"
                              >
                                  <RefreshCw size={16} />
                              </button>
                              <div className="absolute bottom-full right-0 mb-2 hidden group-hover/more:block bg-slate-800 border border-slate-700 rounded-lg p-2 shadow-2xl whitespace-nowrap z-50 animate-fade-in">
                                  <span className="text-[9px] font-black uppercase tracking-widest text-indigo-300">{t.hardRegen}</span>
                              </div>
                          </div>
                      )}
                  </div>
                  {isExportingBook && (
                      <div className="mt-2 text-center">
                          <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest animate-pulse">{exportStatus}</p>
                      </div>
                  )}
              </div>
          </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex-1 overflow-y-auto scrollbar-hide">
            <div className="max-w-4xl mx-auto w-full px-6 py-8">
              {fatalError ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-red-900/10 border border-red-500/30 rounded-[3rem] animate-fade-in">
                    <AlertTriangle size={40} className="text-red-500 mb-4" />
                    <h3 className="text-lg font-bold text-white">{t.fatalError}</h3>
                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-2 leading-relaxed">{fatalError}</p>
                    <button onClick={() => { handleTopicClick(activeSubTopicTitle || '', activeSubTopicId || ''); }} className="mt-6 px-10 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg active:scale-95">
                        {t.retry}
                    </button>
                </div>
              ) : (
                <div className="flex-1 flex flex-col space-y-6 animate-fade-in overflow-hidden h-full">
                    <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 md:px-10 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6 shrink-0 relative">
                        <div className="flex-1 min-w-0">
                            <h2 className="text-2xl font-black italic tracking-tighter text-white uppercase leading-none truncate">{activeSubTopicTitle || t.establishing}</h2>
                            <div className="flex items-center gap-4 mt-2">
                                 <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest flex items-center gap-1.5">
                                    {isPlaying && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>}
                                    {isLoadingLecture ? t.generating : isPlaying ? "Stream Active" : "Registry Sync Ready"}
                                </p>
                                {dataSource === 'vault' && <div className="px-2 py-0.5 bg-emerald-900/30 text-emerald-400 text-[8px] font-black uppercase rounded border border-emerald-500/20 flex items-center gap-1"><Database size={10}/> Ledger</div>}
                                {isAdmin && <div className="px-2 py-0.5 bg-indigo-900/30 text-indigo-400 text-[8px] font-black uppercase rounded border border-indigo-500/20 flex items-center gap-1"><ShieldCheck size={10}/> Architect</div>}
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2 shrink-0 bg-slate-950/50 p-1.5 rounded-3xl border border-white/5 shadow-inner">
                            <button 
                                onClick={handlePrevTopic}
                                className="p-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-2xl transition-all"
                                title="Previous Node"
                            >
                                <SkipBack size={20} fill="currentColor" />
                            </button>
                            
                            <button 
                                onClick={() => handlePlayLecture()}
                                className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 transition-all shadow-2xl active:scale-95 ${isPlaying ? 'bg-indigo-600/50 text-indigo-200 border border-indigo-500/30' : 'bg-indigo-600 text-white'}`}
                                disabled={isBuffering}
                            >
                                {isBuffering ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : isPlaying ? (
                                    <Volume2 size={18} className="animate-pulse" />
                                ) : (
                                    <Play size={18} fill="currentColor" />
                                )}
                                <span>{isBuffering ? t.buffering : isPlaying ? 'Streaming' : 'Listen'}</span>
                            </button>

                            <button 
                                onClick={stopReading}
                                disabled={!isPlaying}
                                className={`p-3 rounded-2xl transition-all ${isPlaying ? 'text-red-400 hover:bg-red-900/20' : 'text-slate-700 opacity-20 cursor-not-allowed'}`}
                                title="Stop Core"
                            >
                                <Square size={20} fill="currentColor" />
                            </button>

                            <button 
                                onClick={handleNextTopic}
                                className="p-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-2xl transition-all"
                                title="Next Node"
                            >
                                <SkipForward size={20} fill="currentColor" />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 rounded-[3rem] overflow-hidden shadow-2xl relative bg-slate-900 border border-slate-800 min-h-[600px]">
                        <div className="absolute inset-0 overflow-y-auto scrollbar-hide">
                            {!activeLecture && !isLoadingLecture && (
                                <div className="h-full flex flex-col items-center justify-center p-12 text-center animate-pulse">
                                    <Database size={48} className="text-slate-800 mb-4" />
                                    <h3 className="text-lg font-black text-slate-700 uppercase tracking-[0.3em]">Awaiting Neural Link</h3>
                                </div>
                            )}

                            {isLoadingLecture && !activeLecture && (
                                <div className="p-20 space-y-10 animate-pulse">
                                    <div className="h-12 w-3/4 bg-slate-800 rounded-2xl"></div>
                                    <div className="space-y-4">
                                        <div className="h-4 w-full bg-slate-800 rounded-full"></div>
                                        <div className="h-4 w-full bg-slate-800 rounded-full"></div>
                                        <div className="h-4 w-2/3 bg-slate-800 rounded-full"></div>
                                    </div>
                                    <div className="h-48 w-full bg-slate-800/50 rounded-[2rem] border border-white/5"></div>
                                </div>
                            )}

                            {activeLecture && (
                                <div className="p-10 md:p-20 space-y-16 pb-96">
                                    <h1 className="text-5xl md:text-6xl font-black uppercase italic tracking-tighter text-white mb-20 border-b border-white/10 pb-10">
                                        {activeLecture.topic}
                                    </h1>
                                    
                                    {activeLecture.sections.map((section, idx) => {
                                        const isCurrent = idx === currentSectionIndex;
                                        const speakerName = section.speaker === 'Teacher' ? activeLecture.professorName : activeLecture.studentName;
                                        
                                        return (
                                            <div 
                                                key={idx}
                                                ref={el => sectionRefs.current[idx] = el}
                                                className={`transition-all duration-700 ease-in-out origin-left flex flex-col gap-4 ${
                                                    isCurrent 
                                                    ? 'opacity-100 scale-105' 
                                                    : 'opacity-20 blur-[0.2px] scale-95 pointer-events-none'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className={`text-[10px] font-black uppercase tracking-[0.4em] ${section.speaker === 'Teacher' ? 'text-indigo-400' : 'text-emerald-400'}`}>
                                                        {speakerName}
                                                    </span>
                                                    {isCurrent && (
                                                        <div className="flex gap-1">
                                                            <div className="w-1 h-1 rounded-full bg-indigo-500 animate-ping"></div>
                                                            <div className="w-1 h-1 rounded-full bg-indigo-500 animate-ping [animation-delay:0.2s]"></div>
                                                            <div className="w-1 h-1 rounded-full bg-indigo-500 animate-ping [animation-delay:0.4s]"></div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className={`text-2xl md:text-3xl leading-relaxed font-medium ${isCurrent ? 'text-white' : 'text-slate-400'}`}>
                                                    {section.text}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        
                        {isLoadingLecture && activeLecture && (
                            <div className="absolute top-6 right-6 z-10 bg-indigo-600 text-white px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 shadow-2xl animate-fade-in-up">
                                <RefreshCcw size={12} className="animate-spin"/> {loadingStatus}
                            </div>
                        )}
                    </div>
                </div>
              )}
            </div>
        </div>
      </main>
    </div>
  );
};

export { PodcastDetail };
