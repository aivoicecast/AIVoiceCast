
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Channel, GeneratedLecture, Chapter, SubTopic, Attachment, UserProfile } from '../types';
import { ArrowLeft, BookOpen, FileText, Download, Loader2, ChevronDown, ChevronRight, ChevronLeft, Check, Printer, FileDown, Info, Sparkles, Book, CloudDownload, Music, Package, FileAudio, Zap, Radio, CheckCircle, ListTodo, Share2, Play, Pause, Square, Volume2, RefreshCcw, Wand2, Edit3, Save, ShieldCheck, ImageIcon, Lock, Cloud } from 'lucide-react';
import { generateLectureScript } from '../services/lectureGenerator';
import { generateCurriculum } from '../services/curriculumGenerator';
import { synthesizeSpeech } from '../services/tts';
import { OFFLINE_CHANNEL_ID, OFFLINE_CURRICULUM, OFFLINE_LECTURES } from '../utils/offlineContent';
import { SPOTLIGHT_DATA } from '../utils/spotlightContent';
import { cacheLectureScript, getCachedLectureScript, saveUserChannel } from '../utils/db';
import { getGlobalAudioContext, registerAudioOwner, stopAllPlatformAudio, getGlobalAudioGeneration, warmUpAudioContext, decodeRawPcm } from '../utils/audioUtils';
import { MarkdownView } from './MarkdownView';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { ShareModal } from './ShareModal';
import { auth } from '../services/firebaseConfig';
import { isUserAdmin, getCloudCachedLecture, saveCloudCachedLecture } from '../services/firestoreService';

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
    back: "Back", curriculum: "Curriculum", selectTopic: "Select a lesson to begin reading",
    generating: "Preparing Material...", genDesc: "Our AI is drafting the lecture script.",
    lectureTitle: "Lecture Script", downloadPdf: "Download PDF",
    playAudio: "Listen to Lecture", stopAudio: "Stop Audio",
    buffering: "Neural Synthesis...", regenerate: "Neural Re-synthesis",
    regenerating: "Re-synthesizing...",
    regenCurriculum: "Re-structure Curriculum",
    regenCurriculumDesc: "AI is re-mapping the entire curriculum...",
    regenLecture: "Re-synthesize Selected Lecture",
    editScript: "Edit Script Manually",
    saveScript: "Save Script Override",
    editChannel: "Edit Channel Settings",
    proToRefract: "Pro Required to Refract",
    cloudSync: "Syncing with Cloud Vault...",
    foundInVault: "Restored from Sanctuary Vault"
  },
  zh: {
    back: "返回", curriculum: "课程大纲", selectTopic: "选择一个课程开始阅读",
    generating: "正在准备材料...", genDesc: "AI 正在编写讲座脚本。",
    lectureTitle: "讲座文稿", downloadPdf: "下载 PDF",
    playAudio: "播放讲座音频", stopAudio: "停止朗读",
    buffering: "神经合成中...", regenerate: "神经重构",
    regenerating: "正在重构...",
    regenCurriculum: "重构课程大纲",
    regenCurriculumDesc: "AI 正在重新规划整个课程大纲...",
    regenLecture: "重新合成当前讲座",
    editScript: "手动编辑文稿",
    saveScript: "保存文稿修改",
    editChannel: "编辑频道设置",
    proToRefract: "需要 Pro 权限进行重构",
    cloudSync: "正在同步云端金库...",
    foundInVault: "已从圣所金库恢复"
  }
};

export const PodcastDetail: React.FC<PodcastDetailProps> = ({ 
    channel, onBack, language, currentUser, onStartLiveSession, userProfile, onUpdateChannel, onEditChannel, isProMember
}) => {
  const t = UI_TEXT[language];
  const [activeLecture, setActiveLecture] = useState<GeneratedLecture | null>(null);
  const [isLoadingLecture, setIsLoadingLecture] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isRegeneratingCurriculum, setIsRegeneratingCurriculum] = useState(false);
  const [activeSubTopicId, setActiveSubTopicId] = useState<string | null>(null);
  const [activeSubTopicTitle, setActiveSubTopicTitle] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [loadingStatus, setLoadingStatus] = useState<string>(t.generating);
  const [dataSource, setDataSource] = useState<'vault' | 'ai' | null>(null);

  // Manual Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [editBuffer, setEditBuffer] = useState('');

  // Audio Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(-1);
  const playbackSessionRef = useRef(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const MY_TOKEN = useMemo(() => `PodcastDetail:${channel.id}:${activeSubTopicId}`, [channel.id, activeSubTopicId]);

  const isAdmin = isUserAdmin(userProfile || null);
  const isOwner = currentUser && (channel.ownerId === currentUser.uid || isAdmin);

  const isThirdParty = useCallback((url?: string) => {
    if (!url) return true;
    const lowUrl = url.toLowerCase();
    return (
        lowUrl.includes('ui-avatars.com') || 
        lowUrl.includes('placehold.co') || 
        lowUrl.includes('placeholder') || 
        lowUrl.includes('dummyimage.com') ||
        lowUrl.includes('pravatar.cc')
    );
  }, []);

  const [chapters, setChapters] = useState<Chapter[]>(() => {
    if (channel.chapters && channel.chapters.length > 0) return channel.chapters;
    if (channel.id === OFFLINE_CHANNEL_ID) return OFFLINE_CURRICULUM;
    if (SPOTLIGHT_DATA[channel.id]) return SPOTLIGHT_DATA[channel.id].curriculum;
    return [];
  });
  
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);

  const stopPlaybackInternal = useCallback(() => {
    playbackSessionRef.current++;
    setIsPlaying(false);
    setIsBuffering(false);
    setCurrentSectionIndex(-1);
    
    activeSourcesRef.current.forEach(source => {
        try { source.stop(); source.disconnect(); } catch(e) {}
    });
    activeSourcesRef.current.clear();
    
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
  }, []);

  useEffect(() => {
    return () => {
        stopPlaybackInternal();
    };
  }, [stopPlaybackInternal]);

  const handleTopicClick = useCallback(async (topicTitle: string, subTopicId?: string) => {
    stopPlaybackInternal();
    setIsEditing(false);
    const sid = subTopicId || 'default';
    setActiveSubTopicId(sid);
    setActiveSubTopicTitle(topicTitle);
    setActiveLecture(null);
    setIsLoadingLecture(true);
    setLoadingStatus(t.generating);
    setDataSource(null);

    try {
        const cacheKey = `lecture_${channel.id}_${sid}_${language}`;
        
        // 1. Try Local IndexedDB Cache
        const cachedLocal = await getCachedLectureScript(cacheKey);
        if (cachedLocal) { 
            setActiveLecture(cachedLocal); 
            setEditBuffer(JSON.stringify(cachedLocal, null, 2));
            setIsLoadingLecture(false);
            setDataSource('vault');
            return; 
        }

        // 2. Try Cloud Firestore Cache
        setLoadingStatus(t.cloudSync);
        const cachedCloud = await getCloudCachedLecture(channel.id, sid, language);
        if (cachedCloud) {
            setActiveLecture(cachedCloud);
            setEditBuffer(JSON.stringify(cachedCloud, null, 2));
            // Backfill local cache
            await cacheLectureScript(cacheKey, cachedCloud);
            setIsLoadingLecture(false);
            setDataSource('vault');
            return;
        }
        
        // 3. AUTO-REFRACT CHECK: Only pro members can trigger initial generation for custom content
        if (!isProMember && channel.id !== OFFLINE_CHANNEL_ID && !SPOTLIGHT_DATA[channel.id]) {
            alert(t.proToRefract);
            setIsLoadingLecture(false);
            return;
        }

        // 4. AI Generation Fallback
        setLoadingStatus(t.generating);
        const script = await generateLectureScript(topicTitle, channel.description, language, channel.id, channel.voiceName);
        if (script) { 
            setActiveLecture(script); 
            setEditBuffer(JSON.stringify(script, null, 2));
            setDataSource('ai');
            // Save to both caches
            await cacheLectureScript(cacheKey, script); 
            if (auth.currentUser) {
                await saveCloudCachedLecture(channel.id, sid, language, script);
            }
        }
    } catch (e) {
        console.error("Lecture retrieval failed", e);
    } finally { 
        setIsLoadingLecture(false); 
    }
  }, [channel.id, channel.description, channel.voiceName, language, stopPlaybackInternal, t, isProMember]);

  // AUTO-SELECT FIRST TOPIC ON MOUNT
  useEffect(() => {
    if (chapters.length > 0 && !activeSubTopicId && !isLoadingLecture) {
        const firstChapter = chapters[0];
        if (firstChapter.subTopics.length > 0) {
            const firstSub = firstChapter.subTopics[0];
            handleTopicClick(firstSub.title, firstSub.id);
            setExpandedChapterId(firstChapter.id);
        }
    }
  }, [chapters, activeSubTopicId, isLoadingLecture, handleTopicClick]);

  const handleRegenerateLecture = async () => {
    if (!activeSubTopicId || !activeSubTopicTitle) return;
    if (!isProMember) return alert(t.proToRefract);
    
    const confirmMsg = language === 'zh' 
        ? "确定要重新生成当前选中的讲座内容吗？这将会覆盖现有的缓存。" 
        : "Are you sure you want to re-synthesize the selected lecture script? This will bypass the cache.";
        
    if (!confirm(confirmMsg)) return;

    stopPlaybackInternal();
    setIsEditing(false);
    setIsRegenerating(true);
    try {
        const script = await generateLectureScript(activeSubTopicTitle, channel.description, language, channel.id, channel.voiceName);
        if (script) {
            const cacheKey = `lecture_${channel.id}_${activeSubTopicId}_${language}`;
            await cacheLectureScript(cacheKey, script);
            if (auth.currentUser) {
                await saveCloudCachedLecture(channel.id, activeSubTopicId, language, script);
            }
            setActiveLecture(script);
            setEditBuffer(JSON.stringify(script, null, 2));
            setDataSource('ai');
        }
    } catch (e) {
        console.error("Regeneration failed", e);
    } finally {
        setIsRegenerating(false);
    }
  };

  const handleSaveManualEdit = async () => {
      if (!activeSubTopicId) return;
      try {
          const parsed = JSON.parse(editBuffer);
          setActiveLecture(parsed);
          const cacheKey = `lecture_${channel.id}_${activeSubTopicId}_${language}`;
          await cacheLectureScript(cacheKey, parsed);
          if (auth.currentUser) {
              await saveCloudCachedLecture(channel.id, activeSubTopicId, language, parsed);
          }
          setIsEditing(false);
          setDataSource('vault');
          alert("Lecture script manually updated.");
      } catch (e) {
          alert("Invalid JSON format. Please ensure the script matches the expected structure.");
      }
  };

  const handleRegenerateCurriculum = async () => {
    if (!isProMember) return alert(t.proToRefract);
    const confirmMsg = language === 'zh'
        ? "确定要重新生成整个课程大纲吗？这将会彻底改变现有的章节结构并清除现有脚本缓存。"
        : "Are you sure you want to re-synthesize the entire curriculum? This will completely rebuild the chapter structure.";
    
    if (!confirm(confirmMsg)) return;

    setIsRegeneratingCurriculum(true);
    stopPlaybackInternal();
    setIsEditing(false);
    setActiveSubTopicId(null);
    setActiveSubTopicTitle(null);
    setActiveLecture(null);

    try {
        const newChapters = await generateCurriculum(channel.title, channel.description, language);
        if (newChapters && newChapters.length > 0) {
            setChapters(newChapters);
            const updatedChannel = { ...channel, chapters: newChapters };
            if (onUpdateChannel) {
                onUpdateChannel(updatedChannel);
            } else {
                await saveUserChannel(updatedChannel);
            }

            // AUTO-SELECT FIRST TOPIC FROM NEW CURRICULUM
            const firstSub = newChapters[0].subTopics[0];
            if (firstSub) {
                handleTopicClick(firstSub.title, firstSub.id);
                setExpandedChapterId(newChapters[0].id);
            }
        }
    } catch (e) {
        console.error("Curriculum regeneration failed", e);
    } finally {
        setIsRegeneratingCurriculum(false);
    }
  };

  const handlePlayLecture = async () => {
    if (!activeLecture) return;
    if (isPlaying) {
        stopAllPlatformAudio(`ManualPauseDetail:${channel.id}`);
        return;
    }

    const ctx = getGlobalAudioContext();
    if (ctx.state === 'suspended') {
        await warmUpAudioContext(ctx);
    }

    const localSessionId = ++playbackSessionRef.current;
    const targetGen = registerAudioOwner(MY_TOKEN, stopPlaybackInternal);
    
    setIsPlaying(true);
    setIsBuffering(true);

    try {
        const hostVoice = channel.voiceName || 'Puck';
        const studentVoice = 'Zephyr';

        for (let i = 0; i < activeLecture.sections.length; i++) {
            if (localSessionId !== playbackSessionRef.current || targetGen !== getGlobalAudioGeneration()) break;
            
            const section = activeLecture.sections[i];
            const voice = section.speaker === 'Teacher' ? hostVoice : studentVoice;
            
            setCurrentSectionIndex(i);
            setIsBuffering(true);
            
            const result = await synthesizeSpeech(section.text, voice, ctx);
            
            if (localSessionId !== playbackSessionRef.current || targetGen !== getGlobalAudioGeneration()) break;
            setIsBuffering(false);

            if (result.buffer) {
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
            } else {
                await new Promise<void>((resolve) => {
                    const utterance = new SpeechSynthesisUtterance(section.text);
                    utterance.onend = () => resolve();
                    utterance.onerror = () => resolve();
                    window.speechSynthesis.speak(utterance);
                });
            }
            
            await new Promise(r => setTimeout(r, 400));
        }
    } catch (e) {
        console.error("Lecture playback failed", e);
    } finally {
        if (localSessionId === playbackSessionRef.current) {
            setIsPlaying(false);
            setIsBuffering(false);
            setCurrentSectionIndex(-1);
        }
    }
  };

  const handleShareLecture = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!activeSubTopicId) return;
      const url = `${window.location.origin}?view=podcast_detail&channelId=${channel.id}&lectureId=${activeSubTopicId}`;
      setShareUrl(url);
      setShowShareModal(true);
  };

  const hasValidHeaderImage = channel.imageUrl && !isThirdParty(channel.imageUrl);

  return (
    <div className="h-full bg-slate-950 text-slate-100 flex flex-col relative overflow-y-auto pb-24">
      <div className="relative h-48 md:h-64 w-full shrink-0">
        <div className="absolute inset-0">
            {hasValidHeaderImage ? (
                <img src={channel.imageUrl} className="w-full h-full object-cover opacity-40" alt={channel.title}/>
            ) : (
                <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-800">
                    <ImageIcon size={64} className="opacity-10"/>
                </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
        </div>
        <div className="absolute top-4 left-4 z-20 flex items-center gap-3">
            <button onClick={onBack} className="flex items-center space-x-2 px-4 py-2 bg-black/40 backdrop-blur-md rounded-full hover:bg-white/10 transition-colors border border-white/10 text-sm font-medium"><ArrowLeft size={16} /><span>{t.back}</span></button>
            {isAdmin && (
                <div className="px-4 py-2 bg-indigo-600/30 backdrop-blur-md rounded-full border border-indigo-500/30 text-[10px] font-black uppercase tracking-widest text-indigo-300 flex items-center gap-2 shadow-xl">
                    <ShieldCheck size={14}/> Neural Architect Mode Active
                </div>
            )}
        </div>
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
            {isOwner && onEditChannel && (
                <button 
                  onClick={() => onEditChannel(channel)}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-900/40 transition-all active:scale-95 border border-indigo-400/50"
                >
                    <Edit3 size={16}/>
                    <span className="hidden sm:inline">{t.editChannel}</span>
                </button>
            )}
        </div>
      </div>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-800 bg-indigo-900/10 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <BookOpen size={16} className="text-indigo-400" />
                      {t.curriculum}
                    </h3>
                    <div className="flex items-center gap-2">
                        {isOwner && activeSubTopicId && (
                            <button 
                              onClick={handleRegenerateLecture}
                              disabled={isRegenerating || !isProMember}
                              className={`p-1.5 bg-indigo-600 text-white hover:bg-indigo-500 rounded-lg border border-indigo-400 shadow-lg transition-all ${isRegenerating ? 'animate-pulse' : ''} ${!isProMember ? 'opacity-40 grayscale cursor-not-allowed' : ''}`}
                              title={isProMember ? t.regenLecture : t.proToRefract}
                            >
                              {!isProMember ? <Lock size={16}/> : isRegenerating ? <Loader2 size={16} className="animate-spin"/> : <Wand2 size={16}/>}
                            </button>
                        )}
                        {isOwner && (
                            <button 
                              onClick={handleRegenerateCurriculum}
                              disabled={isRegeneratingCurriculum || !isProMember}
                              className={`p-1.5 bg-indigo-600 text-white hover:bg-indigo-500 rounded-lg border border-indigo-400 shadow-lg transition-all ${isRegeneratingCurriculum ? 'animate-pulse opacity-50' : ''} ${!isProMember ? 'opacity-40 grayscale cursor-not-allowed' : ''}`}
                              title={isProMember ? t.regenCurriculum : t.proToRefract}
                            >
                              {!isProMember ? <Lock size={16}/> : isRegeneratingCurriculum ? <Loader2 size={16} className="animate-spin"/> : <RefreshCcw size={16}/>}
                            </button>
                        )}
                    </div>
                </div>
                <div className="divide-y divide-slate-800">
                    {isRegeneratingCurriculum ? (
                      <div className="p-12 text-center space-y-4 bg-slate-950/50">
                        <Loader2 size={32} className="text-indigo-500 animate-spin mx-auto" />
                        <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest leading-relaxed px-4">{t.regenCurriculumDesc}</p>
                      </div>
                    ) : (
                      chapters.map((ch) => (
                        <div key={ch.id}>
                            <button onClick={() => setExpandedChapterId(expandedChapterId === ch.id ? null : ch.id)} className="w-full flex items-center justify-between p-4 hover:bg-slate-800 transition-colors text-left font-semibold text-sm text-slate-200">{ch.title}{expandedChapterId === ch.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
                            {expandedChapterId === ch.id && (<div className="bg-slate-950/50 py-1">{ch.subTopics.map((sub) => (<button key={sub.id} onClick={() => handleTopicClick(sub.title, sub.id)} className={`w-full flex items-start space-x-3 px-6 py-3 text-left transition-colors ${activeSubTopicId === sub.id ? 'bg-indigo-900/30 border-l-4 border-indigo-500' : 'hover:bg-slate-800'}`}><span className={`text-sm ${activeSubTopicId === sub.id ? 'text-indigo-200 font-bold' : 'text-slate-400'}`}>{sub.title}</span></button>))}</div>)}
                        </div>
                      ))
                    )}
                </div>
            </div>
        </div>
        <div className="col-span-12 lg:col-span-8">
          {isLoadingLecture ? (
            <div className="h-64 flex flex-col items-center justify-center p-12 text-center bg-slate-900/50 rounded-2xl animate-pulse">
                <Loader2 size={40} className="text-indigo-500 animate-spin mb-4" />
                <h3 className="text-lg font-bold text-white">{loadingStatus}</h3>
                <p className="text-xs text-slate-500 uppercase font-black tracking-widest mt-2">{t.genDesc}</p>
            </div>
          ) : activeLecture ? (
            <div className="space-y-6 animate-fade-in">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <h2 className="text-xl font-bold text-white truncate">{activeLecture.topic}</h2>
                        <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mt-1 flex items-center gap-2">
                            {isPlaying && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>}
                            {t.lectureTitle} 
                            {isPlaying && <span className="text-indigo-400">• Session Active</span>}
                            {dataSource === 'vault' && <span className="text-emerald-500 ml-2">Verified Cache</span>}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button 
                            onClick={handlePlayLecture}
                            className={`px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg active:scale-95 ${isPlaying ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
                        >
                            {isBuffering ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : isPlaying ? (
                                <Square size={16} fill="currentColor" />
                            ) : (
                                <Play size={16} fill="currentColor" />
                            )}
                            <span>{isBuffering ? t.buffering : isPlaying ? t.stopAudio : t.playAudio}</span>
                        </button>
                        
                        {isOwner && (
                            <button 
                                onClick={() => setIsEditing(!isEditing)}
                                className={`p-2.5 rounded-xl border transition-all shadow-lg ${isEditing ? 'bg-indigo-600 text-white border-indigo-400' : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'}`}
                                title={t.editScript}
                            >
                                <Edit3 size={18}/>
                            </button>
                        )}

                        <button onClick={handleShareLecture} className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition-all shadow-lg" title="Share URI"><Share2 size={18}/></button>
                    </div>
                </div>
                
                {isRegenerating && (
                    <div className="bg-indigo-900/30 border border-indigo-500/30 rounded-xl p-6 flex flex-col items-center justify-center gap-4 animate-fade-in">
                        <div className="relative">
                            <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                            <Wand2 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-400" size={24} />
                        </div>
                        <p className="text-sm font-bold text-white uppercase tracking-widest">{t.regenerating}</p>
                    </div>
                )}

                {isPlaying && currentSectionIndex >= 0 && (
                    <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-2xl p-4 flex items-center gap-4 animate-fade-in">
                        <div className="p-3 bg-indigo-600 rounded-xl text-white shadow-lg">
                            <Volume2 size={24} className="animate-pulse"/>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">Now Speaking</p>
                            <p className="text-sm font-bold text-white truncate">
                                {activeLecture.sections[currentSectionIndex].speaker === 'Teacher' ? activeLecture.professorName : activeLecture.studentName}
                            </p>
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">
                            {currentSectionIndex + 1} / {activeLecture.sections.length}
                        </div>
                    </div>
                )}

                {isEditing ? (
                    <div className="space-y-4 animate-fade-in">
                        <div className="flex items-center justify-between px-2">
                            <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Manual Script Overwrite (JSON)</label>
                            <button onClick={handleSaveManualEdit} className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-lg transition-all active:scale-95">
                                <Save size={14}/> {t.saveScript}
                            </button>
                        </div>
                        <textarea 
                            value={editBuffer}
                            onChange={(e) => setEditBuffer(e.target.value)}
                            className="w-full h-[600px] bg-slate-900 border border-slate-700 rounded-xl p-6 text-sm font-mono text-indigo-200 outline-none focus:ring-2 focus:ring-indigo-500/30 leading-relaxed shadow-inner"
                        />
                    </div>
                ) : !isRegenerating && (
                    <div className="rounded-xl overflow-hidden shadow-2xl">
                        <MarkdownView 
                            content={`# ${activeLecture.topic}\n\n${activeLecture.sections.map((s, idx) => `**${s.speaker === 'Teacher' ? activeLecture.professorName : activeLecture.studentName}**: ${s.text} ${idx === currentSectionIndex ? '  🔊' : ''}`).join('\n\n')}`}
                            initialTheme={userProfile?.preferredReaderTheme || 'slate'}
                            showThemeSwitcher={true}
                        />
                    </div>
                )}
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-800 rounded-2xl bg-slate-900/30">
              <Info size={32} className="mb-2 opacity-20" />
              <h3 className="text-lg font-bold text-slate-400">{t.selectTopic}</h3>
            </div>
          )}
        </div>
      </main>

      {showShareModal && (
          <ShareModal isOpen={true} onClose={() => setShowShareModal(false)} link={shareUrl} title={activeLecture?.topic || 'Lecture'} onShare={async () => {}} currentUserUid={currentUser?.uid}/>
      )}
    </div>
  );
};
