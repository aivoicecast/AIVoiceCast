
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Channel, GeneratedLecture, Chapter, SubTopic, UserProfile, TtsProvider } from '../types';
import { 
  ArrowLeft, BookOpen, Loader2, ChevronDown, ChevronRight,
  Sparkles, Play, Pause, Volume2, 
  RefreshCw, X, AlertTriangle, PlayCircle, 
  CheckCircle, Gauge, Speaker, Zap, BrainCircuit, SkipBack, SkipForward,
  Database, Languages, FileDown, ShieldCheck, Printer, Bookmark, CloudDownload, CloudCheck, HardDrive, BookText, CloudUpload, Archive, FileText, FileOutput, QrCode, Activity, Terminal, Check, Trash2
} from 'lucide-react';
import { generateLectureScript } from '../services/lectureGenerator';
import { synthesizeSpeech, speakSystem } from '../services/tts';
import { getCachedLectureScript, cacheLectureScript, deleteDebugEntry } from '../utils/db';
import { getGlobalAudioContext, registerAudioOwner, warmUpAudioContext, connectOutput, syncPrimeSpeech, SPEECH_REGISTRY } from '../utils/audioUtils';
import { getCloudCachedLecture, saveCloudCachedLecture, updateUserProfile } from '../services/firestoreService';
import { Visualizer } from './Visualizer';
import { SPOTLIGHT_DATA } from '../utils/spotlightContent';
import { generateSecureId, generateContentUid } from '../utils/idUtils';
import { synthesizePodcastBook } from '../utils/bookSynthesis';

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

type NodeStatus = 'local' | 'cloud' | 'none' | 'checking' | 'static';

export const PodcastDetail: React.FC<PodcastDetailProps> = ({ 
  channel, onBack, onStartLiveSession, language, currentUser, userProfile, onUpdateChannel, isProMember 
}) => {
  const [activeSubTopicId, setActiveSubTopicId] = useState<string | null>(null);
  const [activeLecture, setActiveLecture] = useState<GeneratedLecture | null>(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isSyncingContent, setIsSyncingContent] = useState(false);
  const [playedSubTopicIds, setPlayedSubTopicIds] = useState<Set<string>>(new Set());
  const [liveVolume, setLiveVolume] = useState(0);
  
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, NodeStatus>>({});
  const [currentProvider, setCurrentProvider] = useState<TtsProvider>(userProfile?.preferredTtsProvider || 'system');
  const [showProviderMenu, setShowProviderMenu] = useState(false);

  // Export/Batch State
  const [isBatchSynthesizing, setIsBatchSynthesizing] = useState(false);
  const [isExportingBook, setIsExportingBook] = useState(false);
  const [bookProgress, setBookProgress] = useState("");
  const [isExportingText, setIsExportingText] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  const dispatchLog = useCallback((text: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
      window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: text, type } }));
  }, []);

  // Sync provider with user profile changes
  useEffect(() => {
    if (userProfile?.preferredTtsProvider) {
        setCurrentProvider(userProfile.preferredTtsProvider);
    }
  }, [userProfile?.preferredTtsProvider]);

  const chapters = useMemo(() => {
      if (channel.chapters && channel.chapters.length > 0) return channel.chapters;
      const spotlight = SPOTLIGHT_DATA[channel.id];
      if (spotlight && spotlight.curriculum) return spotlight.curriculum;
      return [];
  }, [channel.id, channel.chapters]);

  const flatCurriculum = useMemo(() => chapters.flatMap(c => c.subTopics), [chapters]);
  const currentSubTopicIndex = useMemo(() => flatCurriculum.findIndex(s => s.id === activeSubTopicId), [flatCurriculum, activeSubTopicId]);

  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const playbackSessionRef = useRef(0);
  const mountedRef = useRef(true);
  const sectionRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const checkRegistryNode = async (sub: SubTopic): Promise<NodeStatus> => {
    const spotlight = SPOTLIGHT_DATA[channel.id];
    if (spotlight && spotlight.lectures[sub.title]) return 'static';
    const cacheKey = `lecture_${channel.id}_${sub.id}_${language}`;
    if (await getCachedLectureScript(cacheKey)) return 'local';
    const contentUid = await generateContentUid(sub.title, channel.description, language);
    if (await getCloudCachedLecture(channel.id, contentUid, language)) return 'cloud';
    return 'none';
  };

  const updateRegistryStatus = useCallback(async () => {
    const statuses: Record<string, NodeStatus> = {};
    for (const sub of flatCurriculum) {
        statuses[sub.id] = await checkRegistryNode(sub);
    }
    setNodeStatuses(statuses);
  }, [channel.id, flatCurriculum, language]);

  useEffect(() => {
    mountedRef.current = true;
    updateRegistryStatus();
    return () => { mountedRef.current = false; stopAllAudio('Unmount'); };
  }, [updateRegistryStatus]);

  useEffect(() => {
    if (activeLecture && currentSectionIndex >= 0) {
        sectionRefs.current[currentSectionIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentSectionIndex, activeLecture]);

  const stopAllAudio = useCallback((context: string = 'User') => {
      playbackSessionRef.current++;
      setIsPlaying(false);
      setIsBuffering(false);
      setLiveVolume(0);
      activeSourcesRef.current.forEach(s => { try { s.stop(); s.disconnect(); } catch(e) {} });
      activeSourcesRef.current.clear();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      dispatchLog(`[Playback] Stopped (${context}).`, 'info');
  }, [dispatchLog]);

  const hydrateLectureLean = useCallback(async (sub: SubTopic, force: boolean = false): Promise<GeneratedLecture | null> => {
      const spotlight = SPOTLIGHT_DATA[channel.id];
      const cacheKey = `lecture_${channel.id}_${sub.id}_${language}`;
      
      const BANNED_TERMS = /BERT|GPT-4o|Claude|Llama-3|Groq/i;
      const containsBanned = (text: string) => BANNED_TERMS.test(text);

      // 1. Force Eviction
      if (force) {
          dispatchLog(`[Security] Evicting node ${sub.id} from local/cloud cache for re-synthesis...`, 'warn');
          await deleteDebugEntry('lecture_scripts', cacheKey);
      }

      // 2. Static Priority
      if (spotlight && spotlight.lectures[sub.title]) return spotlight.lectures[sub.title];
      
      try {
          // 3. Local Cache Verification
          let lecture = force ? null : await getCachedLectureScript(cacheKey);
          
          if (lecture) {
              const fullText = lecture.sections.map((s: any) => s.text).join(' ');
              if (containsBanned(fullText)) {
                  dispatchLog(`[Security] Stale artifact detected in local vault. Purging node ${sub.id}...`, 'warn');
                  await deleteDebugEntry('lecture_scripts', cacheKey);
                  lecture = null;
              }
          }

          if (!lecture) {
              // 4. Cloud Handshake
              const contentUid = await generateContentUid(sub.title, channel.description, language);
              lecture = force ? null : await getCloudCachedLecture(channel.id, contentUid, language);
              
              if (lecture) {
                  const fullText = lecture.sections.map((s: any) => s.text).join(' ');
                  if (containsBanned(fullText)) {
                      dispatchLog(`[Security] Stale artifact detected in cloud ledger. Forcing re-synthesis...`, 'warn');
                      lecture = null;
                  }
              }

              if (!lecture) {
                  // 5. Final Neural Refraction
                  lecture = await generateLectureScript(sub.title, channel.description, language, channel.id, channel.voiceName);
              }
              if (lecture) await cacheLectureScript(cacheKey, lecture);
          }
          return lecture;
      } catch (e) { return null; }
  }, [channel.id, channel.description, channel.voiceName, language, dispatchLog]);

  const handleSelectSubTopic = async (sub: SubTopic, shouldStop = true, force: boolean = false) => {
      if (!force && activeSubTopicId === sub.id && activeLecture) return activeLecture;
      if (shouldStop) stopAllAudio('Switch Topic');
      
      setActiveSubTopicId(sub.id);
      setIsSyncingContent(true);
      try {
          const lecture = await hydrateLectureLean(sub, force);
          if (lecture && mountedRef.current) {
              setActiveLecture(lecture);
              setCurrentSectionIndex(-1);
              updateRegistryStatus();
              return lecture;
          }
      } finally { setIsSyncingContent(false); }
      return null;
  };

  const handlePurgeNode = async () => {
      if (!activeSubTopicId) return;
      const sub = flatCurriculum.find(s => s.id === activeSubTopicId);
      if (!sub) return;
      
      if (confirm(`Permanently purge node "${sub.title}" from local/cloud ledger? This forces immediate neural re-synthesis.`)) {
          stopAllAudio('Node Purge');
          await handleSelectSubTopic(sub, true, true);
          dispatchLog(`[Purge] Node ${sub.id} destroyed and refracted.`, 'success');
      }
  };

  const handlePlayActiveLecture = async (startIndex = 0) => {
    syncPrimeSpeech();
    if (isPlaying) { stopAllAudio('User Pause'); return; }
    setIsPlaying(true);
    const localSession = ++playbackSessionRef.current;
    registerAudioOwner(`GlobalPodcastStream`, () => {
        if (playbackSessionRef.current === localSession) stopAllAudio('Eviction');
    });

    try {
        let currentIndex = currentSubTopicIndex < 0 ? 0 : currentSubTopicIndex;
        const ctx = getGlobalAudioContext();

        while (currentIndex < flatCurriculum.length && localSession === playbackSessionRef.current) {
            const currentSub = flatCurriculum[currentIndex];
            const currentLecture: GeneratedLecture | null = await hydrateLectureLean(currentSub);
            
            if (!currentLecture) {
                dispatchLog(`[Engine] Node ${currentSub.title} unreachable. Skipping.`, 'warn');
                currentIndex++; continue;
            }

            setActiveSubTopicId(currentSub.id);
            setActiveLecture(currentLecture);
            setPlayedSubTopicIds(prev => new Set(prev).add(currentSub.id));
            
            for (let i = startIndex; i < currentLecture.sections.length; i++) {
                if (localSession !== playbackSessionRef.current || !mountedRef.current) break;
                
                await warmUpAudioContext(ctx);
                setCurrentSectionIndex(i);
                const section = currentLecture.sections[i];

                if (currentProvider === 'system') {
                    setLiveVolume(0.8);
                    await speakSystem(section.text, language);
                    setLiveVolume(0);
                } else {
                    setIsBuffering(true);
                    const voice = section.speaker === 'Teacher' ? (channel.voiceName || 'Zephyr') : 'Puck';
                    const res = await synthesizeSpeech(section.text, voice, ctx, currentProvider, language, {
                        channelId: channel.id, topicId: currentSub.id, 
                        nodeId: `node_${channel.id}_${currentSub.id}_${i}_${language}`
                    });
                    setIsBuffering(false);

                    if (res.buffer && localSession === playbackSessionRef.current) {
                        setLiveVolume(0.8);
                        await new Promise<void>((resolve) => {
                            const source = ctx.createBufferSource();
                            source.buffer = res.buffer!;
                            connectOutput(source, ctx);
                            activeSourcesRef.current.add(source);
                            source.onended = () => { 
                                activeSourcesRef.current.delete(source); 
                                setLiveVolume(0); 
                                resolve(); 
                            };
                            source.start(0);
                        });
                    } else if (localSession === playbackSessionRef.current) {
                        dispatchLog(`[API Fault] Audio buffer missing. Advancing text.`, 'warn');
                        await new Promise(r => setTimeout(r, 2000));
                    }
                }
                
                if (localSession !== playbackSessionRef.current) break;
                await new Promise(r => setTimeout(r, 800));
            }

            if (localSession === playbackSessionRef.current && mountedRef.current) {
                currentIndex++; 
                startIndex = 0;
                syncPrimeSpeech();
                await warmUpAudioContext(ctx);
                await new Promise(r => setTimeout(r, 1200));
            } else { break; }
        }

        if (localSession === playbackSessionRef.current) {
            setIsPlaying(false);
            dispatchLog(`[Session] Curriculum refraction complete.`, 'success');
        }
    } catch (e: any) { 
        dispatchLog(`[Engine Fault] ${e.message}`, 'error'); 
        stopAllAudio('Error Trace'); 
    }
  };

  const handleGenerateBook = async () => {
    setIsExportingBook(true);
    setBookProgress("Initializing Publishing Engine...");
    try {
        await synthesizePodcastBook(
            channel, 
            chapters, 
            language, 
            hydrateLectureLean, 
            setBookProgress, 
            dispatchLog
        );
    } catch (e: any) { 
        dispatchLog(`Book failure: ${e.message}`, 'error'); 
    } finally { 
        setIsExportingBook(false); 
        setBookProgress(""); 
    }
  };

  const handleBatchSynthesize = async () => {
    if (isBatchSynthesizing) return;
    setIsBatchSynthesizing(true);
    setBatchProgress({ current: 0, total: flatCurriculum.length });
    try {
        for (let i = 0; i < flatCurriculum.length; i++) {
            const sub = flatCurriculum[i];
            dispatchLog(`Synthesizing Manuscript Segment ${i+1}/${flatCurriculum.length}: ${sub.title}`, 'info');
            await hydrateLectureLean(sub);
            setBatchProgress({ current: i + 1, total: flatCurriculum.length });
        }
        dispatchLog(`Batch Refraction Complete.`, 'success');
        updateRegistryStatus();
    } catch (e: any) { 
        dispatchLog(`Batch failed: ${e.message}`, 'error'); 
    } finally { 
        setIsBatchSynthesizing(false); 
    }
  };

  const handleDownloadTextScript = async () => {
    setIsExportingText(true);
    dispatchLog("Collating Text Manuscript...", "info");
    try {
        let fullScript = `# ${channel.title}\n\n> ${channel.description}\n\n--- \n\n`;
        for (let i = 0; i < flatCurriculum.length; i++) {
            const sub = flatCurriculum[i];
            const lecture = await hydrateLectureLean(sub);
            if (lecture) {
                fullScript += `## SECTION ${i + 1}: ${sub.title}\n\n`;
                lecture.sections.forEach(s => {
                    fullScript += `**${s.speaker}**: ${s.text}\n\n`;
                });
                fullScript += `\n`;
            }
        }
        const blob = new Blob([fullScript], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `${channel.title.replace(/\s+/g, '_')}_Script.md`; a.click();
        URL.revokeObjectURL(url);
        dispatchLog("Text Manuscript Downloaded.", "success");
    } finally { setIsExportingText(false); }
  };

  const handleNext = () => currentSubTopicIndex < flatCurriculum.length - 1 && handleSelectSubTopic(flatCurriculum[currentSubTopicIndex + 1]);
  const handlePrev = () => currentSubTopicIndex > 0 && handleSelectSubTopic(flatCurriculum[currentSubTopicIndex - 1]);

  return (
    <div className="h-full flex bg-slate-950 overflow-hidden font-sans relative">
      <aside className="w-[340px] border-r border-slate-800 bg-slate-900/30 flex flex-col shrink-0">
          <div className="p-6 border-b border-slate-800 bg-slate-950/40 space-y-6">
              <div className="flex items-center justify-between">
                  <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"><ArrowLeft size={20} /></button>
                  <div className="relative">
                    <button onClick={() => setShowProviderMenu(!showProviderMenu)} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-[9px] font-black uppercase text-indigo-400 hover:border-indigo-500 transition-all shadow-lg">
                        <Speaker size={12}/>
                        <span>{currentProvider}</span>
                        <ChevronDown size={10}/>
                    </button>
                    {showProviderMenu && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowProviderMenu(false)}></div>
                            <div className="absolute top-full mt-2 right-0 w-48 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 p-2 animate-fade-in-up flex flex-col gap-1">
                                {(['gemini', 'google', 'openai', 'system'] as TtsProvider[]).map(p => (
                                    <button 
                                        key={p} 
                                        onClick={() => { setCurrentProvider(p); setShowProviderMenu(false); }}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${currentProvider === p ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                                    >
                                        <span>{p}</span>
                                        {currentProvider === p && <Check size={12}/>}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                  </div>
              </div>
              <div className="flex gap-4">
                  <img src={channel.imageUrl || "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=200&q=80"} className="w-16 h-16 rounded-2xl object-cover shadow-xl border border-white/5" />
                  <div className="flex-1 min-w-0">
                      <h2 className="text-white font-black uppercase tracking-tighter italic text-xl leading-none truncate">{channel.title}</h2>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Audit Registry</p>
                  </div>
              </div>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-6">
              {chapters.map((ch, idx) => (
                  <div key={ch.id} className="space-y-2">
                      <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] px-2">Sector 0${idx+1}: {ch.title}</h3>
                      <div className="space-y-1">
                          {ch.subTopics.map(sub => {
                              const isSelected = activeSubTopicId === sub.id;
                              const status = nodeStatuses[sub.id] || 'none';
                              return (
                                  <button key={sub.id} onClick={() => handleSelectSubTopic(sub)} className={`w-full flex items-center justify-between px-3 py-3 rounded-xl transition-all border ${isSelected ? 'bg-indigo-600 border-indigo-400 text-white shadow-xl' : 'bg-slate-900/40 border-transparent text-slate-400 hover:bg-slate-800'}`}>
                                      <div className="flex items-center gap-3 min-w-0">
                                          {isSelected && isPlaying ? <Pause size={14} fill="currentColor"/> : isSelected ? <BookOpen size={14}/> : <div className="w-1.5 h-1.5 rounded-full border border-current opacity-40"></div>}
                                          <span className="text-[11px] font-bold truncate tracking-tight">{sub.title}</span>
                                      </div>
                                      <div className={`w-1.5 h-1.5 rounded-full ${status === 'local' ? 'bg-emerald-500' : status === 'cloud' ? 'bg-indigo-400' : status === 'static' ? 'bg-amber-400' : 'bg-slate-700 opacity-20'}`}></div>
                                  </button>
                              );
                          })}
                      </div>
                  </div>
              ))}
          </div>
          <div className="p-4 border-t border-slate-800 bg-slate-950/40 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                  <button onClick={handleBatchSynthesize} disabled={isBatchSynthesizing} className="py-3 bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border border-slate-700 flex items-center justify-center gap-2">
                      {isBatchSynthesizing ? <Loader2 size={14} className="animate-spin" /> : <CloudUpload size={14}/>}
                      {isBatchSynthesizing ? `Refracting ${batchProgress.current}` : 'Refract Vault'}
                  </button>
                  <button onClick={handleDownloadTextScript} disabled={isExportingText} className="py-3 bg-slate-800 hover:bg-blue-600 text-slate-400 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border border-slate-700 flex items-center justify-center gap-2">
                      {isExportingText ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14}/>}
                      Export Text
                  </button>
                  <button onClick={handleGenerateBook} disabled={isExportingBook} className="col-span-2 py-3 bg-slate-800 hover:bg-emerald-600 text-slate-400 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border border-slate-700 flex items-center justify-center gap-2">
                      {isExportingBook ? <Loader2 size={14} className="animate-spin" /> : <BookText size={14}/>}
                      {isExportingBook ? bookProgress : 'Synthesize Full PDF Book'}
                  </button>
              </div>
              <button onClick={() => handlePlayActiveLecture(currentSectionIndex === -1 ? 0 : currentSectionIndex)} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2">
                  {isPlaying ? <Pause size={18} fill="currentColor"/> : <PlayCircle size={18}/>} 
                  {isPlaying ? 'Pause Session' : 'Begin Audit'}
              </button>
          </div>
      </aside>

      <main className="flex-1 flex flex-col min-0 relative bg-slate-950">
          {isSyncingContent && (
               <div className="absolute inset-0 z-[100] bg-slate-950/60 backdrop-blur-md flex flex-col items-center justify-center gap-6 animate-fade-in">
                  <div className="relative">
                      <div className="w-16 h-16 border-4 border-indigo-500/10 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <span className="text-xs font-black text-indigo-400 uppercase tracking-[0.3em] animate-pulse">Syncing Knowledge Node...</span>
               </div>
          )}

          {activeLecture ? (
              <div className="h-full flex flex-col animate-fade-in pb-32">
                  <header className="h-16 border-b border-white/5 bg-slate-900/50 flex items-center justify-between px-8 backdrop-blur-xl shrink-0 z-20">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-600/10 rounded-lg"><BrainCircuit size={20} className="text-indigo-400" /></div>
                        <div>
                            <h2 className="text-sm font-black text-white uppercase tracking-widest">{activeLecture.topic}</h2>
                            <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-[0.2em]">Node 0${currentSubTopicIndex + 1} • Handshake Active</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => activeSubTopicId && handleSelectSubTopic(flatCurriculum[currentSubTopicIndex], true, true)} className="p-2 hover:bg-indigo-600/20 text-slate-500 hover:text-indigo-400 rounded-xl transition-all" title="Force Node Refresh"><RefreshCw size={18}/></button>
                        <button onClick={handlePurgeNode} className="p-2 hover:bg-red-600/20 text-slate-500 hover:text-red-400 rounded-xl transition-all" title="Purge Stale Cache"><Trash2 size={18}/></button>
                        <button onClick={() => stopAllAudio('Close View')} className="p-2 hover:bg-red-600/20 text-slate-500 hover:text-red-400 rounded-xl transition-all"><X size={20}/></button>
                    </div>
                  </header>
                  <div className="flex-1 overflow-y-auto p-10 scrollbar-hide">
                      <div className="max-w-3xl mx-auto space-y-16 pb-[30vh]">
                          {activeLecture.sections.map((section, idx) => {
                              const isCurrent = idx === currentSectionIndex;
                              const isTeacher = section.speaker === 'Teacher';
                              return (
                                  <div key={idx} ref={el => { sectionRefs.current[idx] = el; }} className={`flex flex-col ${isTeacher ? 'items-start' : 'items-end'} transition-all duration-1000 ${currentSectionIndex === -1 || isCurrent ? 'opacity-100 scale-100' : 'opacity-20 scale-95 blur-[1px]'}`}>
                                      <div className="flex items-center gap-2 mb-3 px-6"><span className={`text-[10px] font-black uppercase tracking-widest ${isTeacher ? 'text-indigo-400' : 'text-slate-400'}`}>{isTeacher ? activeLecture.professorName : activeLecture.studentName}</span>{isCurrent && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"></div>}</div>
                                      <div className={`max-w-[90%] px-10 py-8 rounded-[3rem] text-2xl leading-relaxed shadow-2xl relative transition-all duration-700 ${isCurrent ? 'ring-2 ring-indigo-500/50 bg-slate-900 border border-indigo-500/20' : 'bg-slate-900/40'} ${isTeacher ? 'text-slate-100 rounded-tl-sm' : 'text-indigo-50 rounded-tr-sm'}`}><p className="whitespace-pre-wrap font-medium">{section.text}</p></div>
                                  </div>
                              );
                          })}
                      </div>
                  </div>
                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 z-50">
                      <div className="bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-4 flex items-center justify-between shadow-2xl">
                          <div className="flex items-center gap-4">
                              <button onClick={handlePrev} disabled={currentSubTopicIndex <= 0} className="p-3 hover:bg-white/10 rounded-full text-slate-400 disabled:opacity-20 transition-all"><SkipBack size={20}/></button>
                              <button onClick={() => handlePlayActiveLecture(currentSectionIndex === -1 ? 0 : currentSectionIndex)} className="w-14 h-14 bg-white text-slate-950 rounded-full flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all">{isBuffering ? <Loader2 size={24} className="animate-spin" /> : isPlaying ? <Pause size={24} fill="currentColor"/> : <Play size={24} fill="currentColor" className="ml-1"/>}</button>
                              <button onClick={handleNext} disabled={currentSubTopicIndex >= flatCurriculum.length - 1} className="p-3 hover:bg-white/10 rounded-full text-slate-400 disabled:opacity-20 transition-all"><SkipForward size={20}/></button>
                          </div>
                          <div className="flex-1 px-6 min-w-0 text-center">
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest truncate">{flatCurriculum[currentSubTopicIndex]?.title}</p>
                                <div className="flex items-center gap-2 mt-1.5"><div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 transition-all duration-700" style={{ width: `${((currentSectionIndex + 1) / (activeLecture?.sections.length || 1)) * 100}%` }}/></div><span className="text-[9px] font-mono text-slate-500">{currentSectionIndex + 1}/{activeLecture?.sections.length || 0}</span></div>
                          </div>
                          <div className="w-20 h-10 overflow-hidden rounded-full bg-slate-950/60 flex items-center justify-center shrink-0 ml-2"><Visualizer volume={isPlaying ? 0.6 : 0} isActive={isPlaying} color="#818cf8"/></div>
                      </div>
                  </div>
              </div>
          ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-10 space-y-8 bg-slate-950">
                  <div className="relative">
                    <div className="w-24 h-24 bg-indigo-600/10 rounded-[2.5rem] border border-indigo-500/20 flex items-center justify-center">
                        {isSyncingContent ? <Loader2 className="animate-spin text-indigo-500" size={40}/> : <ShieldCheck className="text-indigo-400" size={40}/>}
                    </div>
                  </div>
                  <div className="max-w-md space-y-4">
                      <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">{channel.title}</h2>
                      <p className="text-slate-400 text-lg leading-relaxed">{channel.description}</p>
                  </div>
                  <div className="flex flex-col items-center gap-4">
                      <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em]">Select a node from the sidebar to begin audit</p>
                      <button onClick={() => handleSelectSubTopic(flatCurriculum[0])} className="px-12 py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest rounded-3xl shadow-2xl flex items-center gap-3 transition-transform hover:scale-105 active:scale-95">
                          <Zap size={20} fill="currentColor"/> Initial Node Refraction
                      </button>
                  </div>
              </div>
          )}
      </main>
    </div>
  );
};

export default PodcastDetail;
