
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Channel, GeneratedLecture, Chapter, SubTopic, UserProfile, TtsProvider } from '../types';
import { 
  ArrowLeft, BookOpen, Loader2, ChevronDown, ChevronRight,
  Sparkles, Play, Pause, Volume2, 
  RefreshCw, X, AlertTriangle, PlayCircle, 
  CheckCircle, Gauge, Speaker, Zap, BrainCircuit, SkipBack, SkipForward,
  // Fixed: ShieldSearch does not exist in lucide-react, replaced with SearchCheck
  Database, Languages, FileDown, ShieldCheck, Printer, Bookmark, CloudDownload, CloudCheck, HardDrive, BookText, CloudUpload, Archive, FileText, FileOutput, QrCode, Activity, Terminal, Check, Trash2, Network, Target, Shield, Ghost, BarChart3, Download, SearchCheck
} from 'lucide-react';
import { generateLectureScript } from '../services/lectureGenerator';
import { synthesizeSpeech, speakSystem } from '../services/tts';
import { getCloudCachedLecture } from '../services/firestoreService';
import { getCachedLectureScript, cacheLectureScript, deleteDebugEntry } from '../utils/db';
import { getGlobalAudioContext, registerAudioOwner, warmUpAudioContext, connectOutput, syncPrimeSpeech, SPEECH_REGISTRY } from '../utils/audioUtils';
import { Visualizer } from './Visualizer';
import { SPOTLIGHT_DATA } from '../utils/spotlightContent';
import { generateContentUid } from '../utils/idUtils';
import { synthesizePodcastBook } from '../utils/bookSynthesis';
import { MarkdownView } from './MarkdownView';

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
type ContentTab = 'transcript' | 'audit' | 'notes';

export const PodcastDetail: React.FC<PodcastDetailProps> = ({ 
  channel, onBack, onStartLiveSession, language, currentUser, userProfile, onUpdateChannel, isProMember 
}) => {
  const [activeSubTopicId, setActiveSubTopicId] = useState<string | null>(null);
  const [activeLecture, setActiveLecture] = useState<GeneratedLecture | null>(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isSyncingContent, setIsSyncingContent] = useState(false);
  const [liveVolume, setLiveVolume] = useState(0);
  const [activeTab, setActiveTab] = useState<ContentTab>('transcript');
  
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, NodeStatus>>({});
  const [currentProvider, setCurrentProvider] = useState<TtsProvider>(userProfile?.preferredTtsProvider || 'system');
  const [showProviderMenu, setShowProviderMenu] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Export/Batch State
  const [isBatchSynthesizing, setIsBatchSynthesizing] = useState(false);
  const [isExportingBook, setIsExportingBook] = useState(false);
  const [bookProgress, setBookProgress] = useState("");
  const [isExportingText, setIsExportingText] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  const dispatchLog = useCallback((text: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
      window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: text, type } }));
  }, []);

  useEffect(() => {
    setImageError(false);
  }, [channel.id]);

  useEffect(() => {
    if (userProfile?.preferredTtsProvider) {
        setCurrentProvider(userProfile.preferredTtsProvider);
    }
  }, [userProfile?.preferredTtsProvider]);

  const chapters = useMemo(() => {
      const spotlight = SPOTLIGHT_DATA[channel.id];
      if (spotlight && spotlight.curriculum) return spotlight.curriculum;
      if (channel.chapters && channel.chapters.length > 0) return channel.chapters;
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
    for (const sub of flatCurriculum) {
        const status = await checkRegistryNode(sub);
        setNodeStatuses(prev => ({ ...prev, [sub.id]: status }));
    }
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
  }, []);

  const hydrateLectureLean = useCallback(async (sub: SubTopic, force: boolean = false): Promise<GeneratedLecture | null> => {
      const spotlight = SPOTLIGHT_DATA[channel.id];
      const cacheKey = `lecture_${channel.id}_${sub.id}_${language}`;
      
      if (spotlight && spotlight.lectures[sub.title]) {
          return spotlight.lectures[sub.title];
      }

      if (force) await deleteDebugEntry('lecture_scripts', cacheKey);
      
      try {
          let lecture = force ? null : await getCachedLectureScript(cacheKey);
          
          if (!lecture) {
              const contentUid = await generateContentUid(sub.title, channel.description, language);
              lecture = force ? null : await getCloudCachedLecture(channel.id, contentUid, language);
              
              if (!lecture) {
                  lecture = await generateLectureScript(sub.title, channel.description, language, channel.id, channel.voiceName, force, channel.systemInstruction);
              }
              if (lecture) await cacheLectureScript(cacheKey, lecture);
          }
          return lecture;
      } catch (e) { return null; }
  }, [channel.id, channel.description, channel.voiceName, channel.systemInstruction, language]);

  const handleSelectSubTopic = async (sub: SubTopic, shouldStop = true, force: boolean = false) => {
      if (!force && activeSubTopicId === sub.id && activeLecture) return activeLecture;
      if (shouldStop) stopAllAudio(`Switch Topic`);
      
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
            const currentLecture = await hydrateLectureLean(currentSub);
            
            if (!currentLecture) {
                currentIndex++; continue;
            }

            setActiveSubTopicId(currentSub.id);
            setActiveLecture(currentLecture);
            
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
                    const res = await synthesizeSpeech(section.text, voice, ctx, currentProvider, language);
                    setIsBuffering(false);

                    if (res.errorType === 'auth') {
                        dispatchLog(`[Engine Alert] Invalid API Key detected. Falling back to local system voice for continuity.`, 'warn');
                        setLiveVolume(0.8);
                        await speakSystem(section.text, language);
                        setLiveVolume(0);
                    } else if (res.buffer && localSession === playbackSessionRef.current) {
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
                    }
                }
                
                if (localSession !== playbackSessionRef.current) break;
                await new Promise(r => setTimeout(r, 800));
            }

            if (localSession === playbackSessionRef.current) {
                currentIndex++; 
                startIndex = 0;
                await new Promise(r => setTimeout(r, 1200));
            } else { break; }
        }

        if (localSession === playbackSessionRef.current) {
            setIsPlaying(false);
        }
    } catch (e: any) { 
        stopAllAudio('Error Trace'); 
    }
  };

  const handleDownloadFullTranscript = async () => {
    setIsExportingText(true);
    dispatchLog(`Aggregating full technical corpus for "${channel.title}"...`, 'info');
    
    try {
        let fullMarkdown = `# ${channel.title}\n\n`;
        fullMarkdown += `**Author:** @${channel.author}\n`;
        fullMarkdown += `**Description:** ${channel.description}\n\n`;
        fullMarkdown += `--- \n\n`;

        for (let i = 0; i < chapters.length; i++) {
            const chapter = chapters[i];
            fullMarkdown += `## Sector 0${i + 1}: ${chapter.title}\n\n`;
            
            for (const sub of chapter.subTopics) {
                dispatchLog(`Syncing Sector Fragment: ${sub.title}`, 'info');
                const lecture = await hydrateLectureLean(sub);
                if (lecture) {
                    fullMarkdown += `### ${sub.title}\n\n`;
                    lecture.sections.forEach(s => {
                        const name = s.speaker === 'Teacher' ? lecture.professorName : lecture.studentName;
                        fullMarkdown += `**${name}**: ${s.text}\n\n`;
                    });
                }
            }
            fullMarkdown += `---\n\n`;
        }

        const blob = new Blob([fullMarkdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${channel.title.replace(/\s+/g, '_')}_Complete_Manifest.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        dispatchLog(`Corpus aggregation successful. Artifact dispatched.`, 'success');
    } catch (e: any) {
        dispatchLog(`Export interrupted: ${e.message}`, 'error');
    } finally {
        setIsExportingText(false);
    }
  };

  const handleGenerateBookPdf = async () => {
    if (isExportingBook) return;
    setIsExportingBook(true);
    setBookProgress("Mapping Full Curriculum...");
    try {
        await synthesizePodcastBook(
            channel,
            chapters, // Pass all chapters for full synthesis
            language,
            async (sub) => await hydrateLectureLean(sub),
            (msg) => setBookProgress(msg),
            (msg, type) => dispatchLog(msg, type)
        );
    } catch (e) {
        dispatchLog("Book synthesis failed.", "error");
    } finally {
        setIsExportingBook(false);
        setBookProgress("");
    }
  };

  const renderAuditPanel = () => {
    const auditToDisplay = activeLecture?.audit || channel.sourceAudit;

    if (!auditToDisplay) return (
        <div className="flex flex-col items-center justify-center p-20 text-slate-500 opacity-40">
            <ShieldCheck size={48} className="mb-4" />
            <p className="text-sm font-black uppercase tracking-widest">Awaiting Verification Shards</p>
        </div>
    );

    const audit = auditToDisplay;
    const isSourceAudit = audit === channel.sourceAudit;
    const formatScore = (s: number) => (s < 1 ? Math.round(s * 100) : Math.round(s)).toString();
    
    return (
        <div className="space-y-10 animate-fade-in pb-20">
            {isSourceAudit && (
                <div className="bg-indigo-600/20 border border-indigo-500/30 p-4 rounded-2xl flex items-center gap-4 shadow-lg animate-fade-in">
                    {/* Fixed: Replaced non-existent ShieldSearch with SearchCheck */}
                    <SearchCheck className="text-indigo-400" size={24}/>
                    <div>
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Source Document Verified</p>
                        <p className="text-xs text-slate-300 font-medium">This audit shard represents the original PDF/URL quality verification during ingestion.</p>
                    </div>
                </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] flex flex-col items-center text-center shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-12 bg-indigo-500/5 blur-3xl rounded-full"></div>
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4">Structural Coherence</span>
                    <div className="text-6xl font-black text-white italic tracking-tighter">{formatScore(audit.coherenceScore)}<span className="text-xl text-slate-600">%</span></div>
                    <div className="w-full h-1 bg-slate-800 rounded-full mt-6 overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{ width: `${formatScore(audit.coherenceScore)}%` }}></div>
                    </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] flex flex-col items-center text-center shadow-xl">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">Logical Drift Risk</span>
                    <div className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest border ${
                        audit.driftRisk === 'Low' ? 'bg-emerald-950/20 text-emerald-400 border-emerald-500/30' : 
                        audit.driftRisk === 'Medium' ? 'bg-amber-950/20 text-amber-400 border-amber-500/30' : 'bg-red-950/20 text-red-400 border-red-500/30'
                    }`}>{audit.driftRisk} Risk</div>
                    <p className="text-[9px] text-slate-600 mt-4 leading-relaxed font-bold uppercase">Consistency: Outline → Conversation → PDF</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] flex flex-col items-center text-center shadow-xl">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">Adversarial Robustness</span>
                    <div className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest border ${
                        audit.robustness === 'High' ? 'bg-emerald-950/20 text-emerald-400 border-emerald-500/30' : 
                        audit.robustness === 'Medium' ? 'bg-amber-950/20 text-amber-400 border-amber-500/30' : 'bg-red-950/20 text-red-400 border-red-500/30'
                    }`}>{audit.robustness} Defense</div>
                    <p className="text-[9px] text-slate-600 mt-4 leading-relaxed font-bold uppercase">Boundary condition stability verified.</p>
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-24 bg-indigo-500/5 blur-[100px] rounded-full group-hover:bg-indigo-500/10 transition-colors"></div>
                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-8 flex items-center gap-2">
                    <Network size={16} className="text-indigo-400"/> Refractive Logic Mesh
                </h4>
                <div className="flex flex-wrap gap-8 justify-center items-center py-10">
                    {audit.graph?.nodes?.map(node => (
                        <div key={node.id} className="relative group/node">
                            <div className="absolute -inset-2 bg-indigo-500 opacity-0 group-hover/node:opacity-10 blur-xl rounded-full transition-opacity"></div>
                            <div className="bg-slate-950 border border-slate-800 px-6 py-4 rounded-[1.5rem] shadow-xl flex flex-col items-center relative z-10 hover:border-indigo-500/50 transition-all">
                                <span className="text-[8px] font-black text-slate-600 uppercase mb-1 tracking-widest">{node.type}</span>
                                <span className="text-xs font-bold text-white uppercase">{node.label}</span>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="border-t border-slate-800 pt-8 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {audit.graph?.links?.map((link, i) => (
                            <div key={i} className="flex items-center gap-3 text-[10px] font-bold text-slate-500 bg-black/20 p-3 rounded-xl border border-white/5">
                                <span className="text-indigo-400 uppercase">{link.source}</span>
                                <ChevronRight size={10}/>
                                <span className="px-2 py-0.5 bg-slate-800 text-[8px] rounded uppercase">{link.label}</span>
                                <ChevronRight size={10}/>
                                <span className="text-emerald-400 uppercase">{link.target}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] flex items-center gap-2 px-2">
                    <Ghost size={16} className="text-purple-500"/> Adversarial Boundary Audit
                </h4>
                <div className="grid grid-cols-1 gap-4">
                    {audit.probes?.map((probe, i) => (
                        <div key={i} className="bg-slate-900 border border-slate-800 rounded-[2rem] p-8 flex flex-col gap-4 shadow-xl group">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-red-900/20 text-red-500 rounded-xl"><Target size={16}/></div>
                                    <h5 className="text-sm font-black text-white uppercase tracking-tight leading-relaxed">{probe.question}</h5>
                                </div>
                                <div className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase ${
                                    probe.status === 'passed' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-amber-900/30 text-amber-400'
                                }`}>{probe.status}</div>
                            </div>
                            <p className="text-sm text-slate-400 italic leading-relaxed border-l-2 border-slate-800 pl-4 py-2 group-hover:border-indigo-500 transition-colors">
                                "{probe.answer}"
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
  };

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
                  <div className="w-16 h-16 shrink-0 relative">
                    {!imageError && channel.imageUrl ? (
                        <img src={channel.imageUrl} onError={() => setImageError(true)} className="w-full h-full rounded-2xl object-cover shadow-xl border border-white/5" alt="" />
                    ) : (
                        <div className="w-full h-full rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-indigo-400 font-black text-xl shadow-xl">
                            {channel.title.substring(0, 1).toUpperCase()}
                        </div>
                    )}
                  </div>
                  <div className="flex-1 min-0">
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
                  <button onClick={handleDownloadFullTranscript} disabled={isExportingText} className="flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-30">
                    {isExportingText ? <Loader2 size={14} className="animate-spin"/> : <Download size={14}/>} Text
                  </button>
                  <button onClick={handleGenerateBookPdf} disabled={isExportingBook} className="flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-30">
                    {isExportingBook ? <Loader2 size={14} className="animate-spin"/> : <FileDown size={14}/>} Book
                  </button>
              </div>
              <button onClick={() => handlePlayActiveLecture(currentSectionIndex === -1 ? 0 : currentSectionIndex)} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2">
                  {isPlaying ? <Pause size={18} fill="currentColor"/> : <PlayCircle size={18}/>} 
                  {isPlaying ? 'Pause Session' : 'Begin Audit'}
              </button>
          </div>
      </aside>

      <main className="flex-1 flex flex-col min-0 relative bg-slate-950">
          {(isSyncingContent || isExportingText) && (
               <div className="absolute inset-0 z-[100] bg-slate-950/60 backdrop-blur-md flex flex-col items-center justify-center gap-6 animate-fade-in">
                  <div className="relative">
                      <div className="w-16 h-16 border-4 border-indigo-500/10 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <span className="text-xs font-black text-indigo-400 uppercase tracking-[0.3em] animate-pulse">{isExportingText ? "Aggregating Corpus..." : "Syncing Knowledge Node..."}</span>
               </div>
          )}

          {isExportingBook && (
              <div className="absolute inset-0 z-[110] bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-center gap-8 animate-fade-in text-center p-10">
                  <div className="relative">
                      <div className="w-32 h-32 border-4 border-indigo-500/10 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center"><BookText size={48} className="text-indigo-400 animate-pulse" /></div>
                  </div>
                  <div className="space-y-4">
                      <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Manifesting Neural Book</h3>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-[0.2em] animate-pulse">{bookProgress || 'Synchronizing Sector Fragments...'}</p>
                      <div className="max-w-xs mx-auto text-[9px] text-slate-600 font-black uppercase leading-relaxed mt-4">
                          Protocol: DO NOT CLOSE TAB. Binding deep technical dialogue shards into high-fidelity PDF manuscript.
                      </div>
                  </div>
              </div>
          )}

          {activeLecture || channel.sourceAudit ? (
              <div className="h-full flex flex-col animate-fade-in pb-32">
                  <header className="h-16 border-b border-white/5 bg-slate-900/50 flex items-center justify-between px-8 backdrop-blur-xl shrink-0 z-20">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-600/10 rounded-lg"><BrainCircuit size={20} className="text-indigo-400" /></div>
                            <div>
                                <h2 className="text-sm font-black text-white uppercase tracking-widest">{activeLecture?.topic || 'Source Document Audit'}</h2>
                                <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-[0.2em]">
                                    {activeLecture ? `Node 0${currentSubTopicIndex + 1} • Handshake Active` : 'Registry Manifest Verification'}
                                </p>
                            </div>
                        </div>
                        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-inner">
                            <button onClick={() => setActiveTab('transcript')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${activeTab === 'transcript' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>Dialogue</button>
                            <button onClick={() => setActiveTab('audit')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${activeTab === 'audit' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Neural Lens</button>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {activeSubTopicId && (
                            <button onClick={() => handleSelectSubTopic(flatCurriculum[currentSubTopicIndex], true, true)} className="p-2 hover:bg-indigo-600/20 text-slate-500 hover:text-indigo-400 rounded-xl transition-all" title="Force Node Refresh"><RefreshCw size={18}/></button>
                        )}
                        <button onClick={() => stopAllAudio('Close View')} className="p-2 hover:bg-red-600/20 text-slate-500 hover:text-red-400 rounded-xl transition-all"><X size={20}/></button>
                    </div>
                  </header>
                  
                  <div className="flex-1 overflow-y-auto p-10 scrollbar-hide">
                      {activeTab === 'transcript' && activeLecture ? (
                        <div className="max-w-3xl mx-auto space-y-8 pb-[30vh]">
                            {activeLecture.sections.map((section, idx) => {
                                const isCurrent = idx === currentSectionIndex;
                                const isTeacher = section.speaker === 'Teacher';
                                return (
                                    <div key={idx} className={`flex flex-col ${isTeacher ? 'items-start' : 'items-end'} transition-all duration-1000 ${currentSectionIndex === -1 || isCurrent ? 'opacity-100 scale-100' : 'opacity-40 scale-95'}`}>
                                        <div className="flex items-center gap-2 mb-2 px-4"><span className={`text-[10px] font-black uppercase tracking-widest ${isTeacher ? 'text-indigo-400' : 'text-slate-400'}`}>{isTeacher ? activeLecture.professorName : activeLecture.studentName}</span>{isCurrent && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"></div>}</div>
                                        <div className={`max-w-[90%] px-8 py-6 rounded-3xl shadow-xl relative transition-all duration-700 ${isCurrent ? 'ring-1 ring-indigo-500/50 bg-slate-900 border border-indigo-500/20' : 'bg-slate-900/40'} ${isTeacher ? 'text-white rounded-tl-sm' : 'text-indigo-100 rounded-tr-sm bg-slate-800/20'}`}>
                                            <MarkdownView content={section.text} compact={true} initialTheme={isTeacher ? 'slate' : 'dark'} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                      ) : activeTab === 'transcript' ? (
                          <div className="h-full flex flex-col items-center justify-center p-20 text-slate-500 opacity-40">
                              <AlertTriangle size={48} className="mb-4" />
                              <p className="text-sm font-black uppercase tracking-widest">No active dialogue node selected</p>
                          </div>
                      ) : renderAuditPanel()}
                  </div>

                  {activeLecture && (
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 z-50">
                        <div className="bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-4 flex items-center justify-between shadow-2xl">
                            <div className="flex items-center gap-4">
                                <button onClick={() => currentSubTopicIndex > 0 && handleSelectSubTopic(flatCurriculum[currentSubTopicIndex - 1])} disabled={currentSubTopicIndex <= 0} className="p-3 hover:bg-white/10 rounded-full text-slate-400 disabled:opacity-20 transition-all"><SkipBack size={20}/></button>
                                <button onClick={() => handlePlayActiveLecture(currentSectionIndex === -1 ? 0 : currentSectionIndex)} className="w-14 h-14 bg-white text-slate-950 rounded-full flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all">{isBuffering ? <Loader2 size={24} className="animate-spin" /> : isPlaying ? <Pause size={24} fill="currentColor"/> : <Play size={24} fill="currentColor" className="ml-1"/>}</button>
                                <button onClick={() => currentSubTopicIndex < flatCurriculum.length - 1 && handleSelectSubTopic(flatCurriculum[currentSubTopicIndex + 1])} disabled={currentSubTopicIndex >= flatCurriculum.length - 1} className="p-3 hover:bg-white/10 rounded-full text-slate-400 disabled:opacity-20 transition-all"><SkipForward size={20}/></button>
                            </div>
                            <div className="flex-1 px-6 min-w-0 text-center">
                                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest truncate">{flatCurriculum[currentSubTopicIndex]?.title}</p>
                                  <div className="flex items-center gap-2 mt-1.5"><div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 transition-all duration-700" style={{ width: `${((currentSectionIndex + 1) / (activeLecture?.sections.length || 1)) * 100}%` }}/></div><span className="text-[9px] font-mono text-slate-500">{currentSectionIndex + 1}/{activeLecture?.sections.length || 0}</span></div>
                            </div>
                            <div className="w-20 h-10 overflow-hidden rounded-full bg-slate-950/60 flex items-center justify-center shrink-0 ml-2"><Visualizer volume={isPlaying ? 0.6 : 0} isActive={isPlaying} color="#818cf8"/></div>
                        </div>
                    </div>
                  )}
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
