import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Channel, UserProfile, GeneratedLecture, TtsProvider } from '../types';
// Added BookText to lucide-react imports
import { Play, MessageSquare, Heart, Share2, Bookmark, Music, Plus, Pause, Loader2, Volume2, VolumeX, GraduationCap, ChevronRight, Mic, AlignLeft, BarChart3, User, AlertCircle, Zap, Radio, Square, Sparkles, LayoutGrid, List, SearchX, Activity, Video, Terminal, RefreshCw, Scroll, Lock, Crown, Settings2, Globe, Cpu, Speaker, Search, X, ArrowLeft, Smartphone, Wand2, ShieldCheck, BookText } from 'lucide-react';
import { ChannelCard } from './ChannelCard';
import { CreatorProfileModal } from './CreatorProfileModal';
import { PodcastListTable, SortKey } from './PodcastListTable';
import { followUser, unfollowUser, isUserAdmin, voteChannel } from '../services/firestoreService';
import { generateLectureScript } from '../services/lectureGenerator';
import { synthesizeSpeech, speakSystem } from '../services/tts';
import { getCachedLectureScript, cacheLectureScript } from '../utils/db';
import { SPOTLIGHT_DATA } from '../utils/spotlightContent';
import { warmUpAudioContext, getGlobalAudioContext, stopAllPlatformAudio, registerAudioOwner, getGlobalAudioGeneration, primeNeuralAudio, getSystemVoicesAsync, syncPrimeSpeech, SPEECH_REGISTRY } from '../utils/audioUtils';
import { Visualizer } from './Visualizer';

interface PodcastFeedProps {
  channels: Channel[];
  onChannelClick: (id: string) => void;
  onStartLiveSession: (channel: Channel) => void; 
  userProfile: UserProfile | null;
  globalVoice: string;
  onRefresh?: () => void;
  currentUser?: any;
  setChannelToEdit?: (channel: Channel) => void;
  setIsSettingsModalOpen?: (open: boolean) => void;
  onCommentClick?: (channel: Channel) => void;
  handleVote?: (id: string, type: 'like' | 'dislike', e: React.MouseEvent) => void;
  handleBookmarkToggle?: (id: string, e: React.MouseEvent) => void;
  searchQuery?: string;
  setSearchQuery?: (q: string) => void;
  onNavigate?: (view: string) => void;
  onOpenPricing?: () => void;
  onUpdateChannel?: (channel: Channel) => Promise<void>;
  language?: 'en' | 'zh';
  onMagicCreate?: () => void;
  onOpenManual?: () => void;
  t: any;
}

const MobileFeedCard = ({ channel, isActive, onChannelClick, language, preferredProvider, onFinish, handleVote, handleBookmarkToggle, onCommentClick, currentUser, userProfile }: any) => {
    const MY_TOKEN = useMemo(() => `MobileFeed:${channel.id}`, [channel.id]);
    const [playbackState, setPlaybackState] = useState<'idle' | 'buffering' | 'playing' | 'error'>('idle');
    const [statusMessage, setStatusMessage] = useState('');
    const [ttsProvider, setTtsProvider] = useState<TtsProvider>(preferredProvider || 'gemini');
    const [showTtsMenu, setshowTtsMenu] = useState(false);
    
    const [transcriptHistory, setTranscriptHistory] = useState<{speaker: string, text: string, id: string}[]>([]);
    const [activeTranscriptId, setActiveTranscriptId] = useState<string | null>(null);
    const [isAutoplayBlocked, setIsAutoplayBlocked] = useState(false);
    
    const mountedRef = useRef(true);
    const localSessionIdRef = useRef(0);
    const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const transcriptRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const isLiked = useMemo(() => {
        return userProfile?.likedChannelIds?.includes(channel.id) || false;
    }, [userProfile, channel.id]);

    const isBookmarked = useMemo(() => {
        return userProfile?.bookmarkedChannelIds?.includes(channel.id) || false;
    }, [userProfile, channel.id]);

    const dispatchLog = useCallback((text: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
        window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: `[Feed:${channel.id.substring(0,6)}] ${text}`, type } }));
    }, [channel.id]);

    const stopAudioInternal = useCallback(() => { 
        localSessionIdRef.current++; 
        if (window.speechSynthesis) window.speechSynthesis.cancel(); 
        activeSourcesRef.current.forEach(s => { try { s.stop(); s.disconnect(); } catch(e) {} }); 
        activeSourcesRef.current.clear(); 
        setPlaybackState('idle'); 
        setStatusMessage(""); 
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; stopAudioInternal(); };
    }, [stopAudioInternal]);

    const playSingleAudioSegment = async (text: string, voice: string, localSession: number): Promise<void> => {
        if (!mountedRef.current || localSession !== localSessionIdRef.current) return;
        const ctx = getGlobalAudioContext();
        
        if (ttsProvider === 'system') {
            setLiveVolume(0.8);
            await speakSystem(text, language);
            setLiveVolume(0);
        } else {
            const res = await synthesizeSpeech(text, voice, ctx, ttsProvider, language);
            if (res.buffer && mountedRef.current && localSession === localSessionIdRef.current) {
                setLiveVolume(0.8);
                await new Promise<void>((resolve) => {
                    const source = ctx.createBufferSource();
                    source.buffer = res.buffer!;
                    source.connect(ctx.destination);
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
    };

    const runPlaybackSequence = async (localSession: number) => {
        if (!mountedRef.current || localSession !== localSessionIdRef.current) return;
        
        const ctx = getGlobalAudioContext();
        setPlaybackState('playing');
        
        try {
            // 1. Initial Welcome
            const welcomeText = channel.welcomeMessage || channel.description || "Welcome to this neural channel.";
            setTranscriptHistory([{ speaker: 'Host', text: welcomeText, id: 'intro' }]);
            setActiveTranscriptId('intro');
            await playSingleAudioSegment(welcomeText, channel.voiceName, localSession);

            // 2. Resolve Curriculum
            const chaptersToPlay = (SPOTLIGHT_DATA[channel.id]?.curriculum || channel.chapters || []);
            
            // 3. Iterate Chapters -> SubTopics
            for (const chapter of chaptersToPlay) {
                // Fix: Replace non-existent playbackSessionRef with localSessionIdRef
                if (localSession !== localSessionIdRef.current) break;

                for (const sub of chapter.subTopics) {
                    // Fix: Replace non-existent playbackSessionRef with localSessionIdRef
                    if (localSession !== localSessionIdRef.current) break;

                    setPlaybackState('buffering');
                    setStatusMessage(`Syncing: ${sub.title}`);

                    const cacheKey = `lecture_${channel.id}_${sub.id}_${language || 'en'}`;
                    let lecture = await getCachedLectureScript(cacheKey) || SPOTLIGHT_DATA[channel.id]?.lectures[sub.title];
                    
                    if (!lecture) {
                        lecture = await generateLectureScript(sub.title, channel.description, language || 'en', channel.id, channel.voiceName);
                    }

                    if (lecture && mountedRef.current && localSession === localSessionIdRef.current) {
                        setTranscriptHistory(prev => [
                            ...prev,
                            { speaker: 'System', text: `Entering: ${chapter.title} - ${sub.title}`, id: `head-${sub.id}` },
                            ...lecture!.sections.map((s, i) => ({ 
                                speaker: s.speaker === 'Teacher' ? 'Host' : 'Guest', 
                                text: s.text, 
                                id: `s-${sub.id}-${i}` 
                            }))
                        ]);

                        setPlaybackState('playing');
                        for (let i = 0; i < lecture.sections.length; i++) {
                            // Fix: Replace non-existent playbackSessionRef with localSessionIdRef
                            if (localSession !== localSessionIdRef.current) break;
                            
                            const section = lecture.sections[i];
                            setActiveTranscriptId(`s-${sub.id}-${i}`);
                            
                            const voice = section.speaker === 'Teacher' ? channel.voiceName : 'Zephyr';
                            await playSingleAudioSegment(section.text, voice, localSession);
                            
                            if (localSession === localSessionIdRef.current) {
                                await new Promise(r => setTimeout(r, 600));
                            }
                        }
                    }
                }
                // Fix: Replace non-existent playbackSessionRef with localSessionIdRef
                if (localSession !== localSessionIdRef.current) break;
            }

            // Fix: Replace non-existent playbackSessionRef with localSessionIdRef
            if (localSession === localSessionIdRef.current && mountedRef.current) {
                dispatchLog(`Channel sequence finalized. Transitioning to next node.`, 'success');
                onFinish?.();
            }
        } catch (e: any) {
            setPlaybackState('error');
            dispatchLog(`Sequence fault: ${e.message}`, 'error');
        }
    };

    const [liveVolume, setLiveVolume] = useState(0);

    useEffect(() => {
        if (isActive) {
            const ctx = getGlobalAudioContext();
            if (ctx.state === 'suspended') {
                setIsAutoplayBlocked(true);
                dispatchLog(`Browser Handshake required for audio engine.`, 'warn');
            } else {
                setIsAutoplayBlocked(false);
                registerAudioOwner(MY_TOKEN, stopAudioInternal);
                runPlaybackSequence(++localSessionIdRef.current);
            }
        } else {
            stopAudioInternal();
        }
    }, [isActive, MY_TOKEN, stopAudioInternal, channel.id, language, ttsProvider]);

    const handleRetryUnmute = () => {
        syncPrimeSpeech();
        setIsAutoplayBlocked(false);
        registerAudioOwner(MY_TOKEN, stopAudioInternal);
        runPlaybackSequence(++localSessionIdRef.current);
    };

    // --- SCRIPT AUTO FOCUS LOGIC (REFINED) ---
    useEffect(() => {
        if (activeTranscriptId && transcriptRefs.current[activeTranscriptId]) {
            const target = transcriptRefs.current[activeTranscriptId];
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }
        }
    }, [activeTranscriptId]);

    const handleLike = (e: React.MouseEvent) => {
        if (handleVote) handleVote(channel.id, isLiked ? 'dislike' : 'like', e);
    };

    const handleBookmark = (e: React.MouseEvent) => {
        if (handleBookmarkToggle) handleBookmarkToggle(channel.id, e);
    };

    return (
        <div className="h-full w-full snap-start relative flex flex-col bg-slate-950 overflow-hidden">
            <div className="absolute inset-0 z-0">
                {channel.imageUrl ? (
                    <img src={channel.imageUrl} className="w-full h-full object-cover opacity-20 blur-md" alt="" />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-900 to-indigo-950"></div>
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/40 to-slate-950"></div>
            </div>

            <div className="absolute top-[calc(1rem+env(safe-area-inset-top))] right-4 z-50 flex flex-col items-end gap-2">
                <button onClick={() => setshowTtsMenu(!showTtsMenu)} className="p-3 bg-slate-900/60 backdrop-blur-md rounded-full border border-white/10 text-white hover:bg-indigo-600 transition-all shadow-xl active:scale-95">
                    <Speaker size={20} className={ttsProvider === 'system' ? 'text-slate-400' : 'text-indigo-400'} />
                </button>
                {showTtsMenu && (
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2 animate-fade-in-up flex flex-col min-w-[140px] gap-1">
                        {(['gemini', 'google', 'openai', 'system'] as const).map(p => (
                            <button key={p} onClick={() => { setTtsProvider(p); setshowTtsMenu(false); }} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold uppercase transition-all ${ttsProvider === p ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
                                <Zap size={14}/> {p}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="relative z-10 flex-1 flex flex-col h-full pt-[calc(3rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
                <div className="px-8 text-center shrink-0">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-600/20 border border-indigo-500/30 rounded-full text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em] mb-4"><Radio size={12} /> Broadcast Active</div>
                    <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-tight line-clamp-2">{channel.title}</h2>
                    <p className="text-slate-500 text-xs mt-2 font-black uppercase tracking-widest opacity-60">@{channel.author}</p>
                </div>

                <div className="flex-1 flex flex-col justify-end px-8 overflow-hidden relative">
                    <div className="max-h-[75%] overflow-y-auto space-y-12 py-32 scrollbar-hide mask-fade-edges">
                        {transcriptHistory.map((item) => {
                            const isCurrent = item.id === activeTranscriptId;
                            return (
                                <div 
                                    key={item.id} 
                                    ref={el => { transcriptRefs.current[item.id] = el; }}
                                    className={`flex flex-col transition-all duration-1000 ease-out ${isCurrent ? 'opacity-100 scale-100' : 'opacity-10 scale-95 blur-[1px]'}`}
                                >
                                    <span className={`text-[10px] font-black uppercase tracking-[0.4em] mb-4 ${isCurrent ? 'text-indigo-400' : 'text-slate-700'}`}>{item.speaker}</span>
                                    <p className={`text-4xl leading-[1.1] font-black tracking-tighter ${isCurrent ? 'text-white' : 'text-slate-600'}`}>{item.text}</p>
                                </div>
                            );
                        })}
                    </div>

                    <div className="h-16 w-full flex items-center justify-center py-4 shrink-0">
                        {playbackState === 'buffering' ? (
                            <div className="flex flex-col items-center gap-1"><Loader2 className="animate-spin text-indigo-500" size={16}/><span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{statusMessage}</span></div>
                        ) : (
                            <Visualizer volume={isActive ? liveVolume : 0} isActive={playbackState === 'playing'} color="#6366f1" />
                        )}
                    </div>
                </div>

                {isAutoplayBlocked && (
                    <div className="px-8 py-6 flex flex-col gap-4 shrink-0">
                        {/* Fixed typo in handleRetryUnmute call */}
                        <button onClick={handleRetryUnmute} className="w-full py-6 bg-white text-slate-950 font-black uppercase tracking-[0.3em] rounded-3xl shadow-[0_20px_50px_rgba(255,255,255,0.2)] animate-pulse flex items-center justify-center gap-3">
                            <Volume2 size={24}/> Initialize Neural Fabric
                        </button>
                    </div>
                )}
            </div>

            <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-10 items-center">
                <button onClick={handleLike} className="flex flex-col items-center gap-2 group">
                    <div className={`p-4 bg-slate-900/60 backdrop-blur-md rounded-full border border-white/10 transition-all shadow-2xl ${isLiked ? 'bg-red-600 border-red-500 scale-110' : 'hover:bg-red-600'}`}>
                        <Heart size={28} className="text-white" fill={isLiked ? 'currentColor' : 'none'} />
                    </div>
                    <span className="text-xs font-black text-white drop-shadow-lg">{channel.likes}</span>
                </button>
                <button onClick={handleBookmark} className="flex flex-col items-center gap-2 group">
                    <div className={`p-4 bg-slate-900/60 backdrop-blur-md rounded-full border border-white/10 transition-all shadow-2xl ${isBookmarked ? 'bg-amber-500 border-amber-400 scale-110' : 'hover:bg-amber-500'}`}>
                        <Bookmark size={28} className="text-white" fill={isBookmarked ? "currentColor" : "none"} />
                    </div>
                </button>
                <button onClick={(e) => { e.stopPropagation(); onCommentClick?.(channel); }} className="flex flex-col items-center gap-2 group">
                    <div className="p-4 bg-slate-900/60 backdrop-blur-md rounded-full border border-white/10 hover:bg-indigo-600 transition-all shadow-2xl">
                        <MessageSquare size={28} className="text-white" />
                    </div>
                    <span className="text-xs font-black text-white drop-shadow-lg">{channel.comments.length}</span>
                </button>
            </div>
        </div>
    );
};

export const PodcastFeed: React.FC<PodcastFeedProps> = ({ 
  channels, onChannelClick, onStartLiveSession, userProfile, globalVoice, onRefresh, currentUser, setChannelToEdit, setIsSettingsModalOpen, onCommentClick, handleVote, handleBookmarkToggle, searchQuery, setSearchQuery, onNavigate, onUpdateChannel, onOpenPricing, language, t, onMagicCreate, onOpenManual
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'mobile'>(() => 
      window.innerWidth < 768 ? 'mobile' : 'grid'
  );
  const lastNonMobileMode = useRef<'grid' | 'table'>('grid');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey, direction: 'asc' | 'desc' }>({ key: 'createdAt', direction: 'desc' });
  const [activeCategory, setActiveCategory] = useState('All');
  const [showCreator, setShowCreator] = useState<{ channel: Channel } | null>(null);
  const mobileContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
        const isSmall = window.innerWidth < 768;
        if (isSmall && viewMode !== 'mobile') {
            lastNonMobileMode.current = viewMode;
            setViewMode('mobile');
        } else if (!isSmall && viewMode === 'mobile') {
            setViewMode(lastNonMobileMode.current);
        }
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [viewMode]);

  const categories = useMemo(() => {
      const cats = ['All'];
      channels.forEach(c => c.tags.forEach(tag => { if (!cats.includes(tag)) cats.push(tag); }));
      return cats;
  }, [channels]);

  const sortedChannels = useMemo(() => {
    let filtered = channels;
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(c => 
            c.title.toLowerCase().includes(q) || 
            c.description.toLowerCase().includes(q) || 
            c.author.toLowerCase().includes(q)
        );
    }
    if (activeCategory !== 'All') {
        filtered = filtered.filter(c => c.tags.includes(activeCategory));
    }

    return [...filtered].sort((a, b) => {
        const aVal = a[sortConfig.key] ?? 0;
        const bVal = b[sortConfig.key] ?? 0;
        
        if (aVal === bVal) return 0;
        const multiplier = sortConfig.direction === 'asc' ? 1 : -1;
        return aVal < bVal ? -1 * multiplier : 1 * multiplier;
    });
  }, [channels, sortConfig, searchQuery, activeCategory]);

  const handleSort = (key: SortKey) => {
      setSortConfig(prev => ({
          key,
          direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
      }));
  };

  const [activeMobileIndex, setActiveMobileIndex] = useState(0);

  const handleMobileFinish = useCallback(() => {
    if (viewMode !== 'mobile' || !mobileContainerRef.current) return;
    const nextIndex = activeMobileIndex + 1;
    if (nextIndex < sortedChannels.length) {
        mobileContainerRef.current.scrollTo({
            top: nextIndex * mobileContainerRef.current.clientHeight,
            behavior: 'smooth'
        });
        setActiveMobileIndex(nextIndex);
    }
  }, [viewMode, activeMobileIndex, sortedChannels.length]);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-950">
      {(viewMode as string) !== 'mobile' ? (
        <>
          <div className="p-6 md:p-8 space-y-6 shrink-0 border-b border-slate-800 bg-slate-900/50">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                      <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase flex items-center gap-3">
                        <Sparkles className="text-indigo-400" /> {t.directory}
                      </h2>
                      <p className="text-slate-400 text-sm mt-1">Explore {channels.length} activity nodes in the neural spectrum.</p>
                  </div>
                  <div className="flex items-center gap-3">
                      {onNavigate && (
                          <button 
                            onClick={() => onNavigate('neural_lens')}
                            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-900/40 to-slate-800 border border-indigo-500/30 text-indigo-400 hover:text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 group relative overflow-hidden"
                          >
                            <div className="absolute inset-0 bg-indigo-500/5 group-hover:bg-indigo-500/10 transition-colors animate-pulse"></div>
                            <ShieldCheck size={16} className="relative z-10" />
                            <span className="relative z-10">Neural Lens</span>
                          </button>
                      )}
                      {onMagicCreate && (
                          <button 
                            onClick={onMagicCreate}
                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg transition-all active:scale-95 group"
                          >
                            <Wand2 size={16} className="group-hover:rotate-12 transition-transform" />
                            <span>{t.magic}</span>
                          </button>
                      )}
                      <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-inner">
                          <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`} title="Grid View"><LayoutGrid size={18}/></button>
                          <button onClick={() => setViewMode('table')} className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`} title="Table View"><List size={18}/></button>
                          <button onClick={() => setViewMode('mobile')} className={`p-2 rounded-lg transition-all ${viewMode === 'mobile' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`} title="Mobile Feed"><Smartphone size={18}/></button>
                      </div>
                  </div>
              </div>

              {/* QUICK SHORTCUT ROW */}
              <div className="flex items-center gap-4 py-2 border-y border-slate-800/50 bg-slate-950/30 -mx-8 px-8">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 shrink-0">
                    <Zap size={10} className="text-amber-500" /> Specialized Nodes:
                  </span>
                  <button onClick={() => onNavigate?.('neural_lens')} className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 hover:text-white transition-colors bg-indigo-900/10 px-3 py-1 rounded-full border border-indigo-500/20">
                    <ShieldCheck size={12}/> Neural Lens Audit
                  </button>
                  <button onClick={() => onNavigate?.('code_studio')} className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 hover:text-white transition-colors bg-emerald-900/10 px-3 py-1 rounded-full border border-indigo-500/20">
                    <Terminal size={12}/> Builder Studio
                  </button>
                  <button onClick={() => onNavigate?.('book_studio')} className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400 hover:text-white transition-colors bg-amber-900/10 px-3 py-1 rounded-full border border-indigo-500/20">
                    <BookText size={12}/> Author Studio
                  </button>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                  <div className="relative flex-1 max-w-md group">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400" size={16}/>
                      <input 
                        type="text" 
                        placeholder={t.search} 
                        value={searchQuery} 
                        onChange={(e) => setSearchQuery?.(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 outline-none shadow-inner"
                      />
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
                      {categories.map(cat => (
                          <button 
                            key={cat} 
                            onClick={() => setActiveCategory(cat)}
                            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${activeCategory === cat ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-600'}`}
                          >
                              {cat}
                          </button>
                      ))}
                  </div>
              </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 md:p-8 scrollbar-hide">
              {sortedChannels.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-700 space-y-4">
                      <SearchX size={64} className="opacity-10"/>
                      <p className="text-sm font-bold uppercase tracking-widest">No activities match your refraction</p>
                  </div>
              ) : viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
                      {sortedChannels.map(channel => (
                          <ChannelCard 
                            key={channel.id} 
                            channel={channel} 
                            handleChannelClick={onChannelClick} 
                            handleVote={handleVote || (()=>{})} 
                            onBookmarkToggle={handleBookmarkToggle}
                            isBookmarked={userProfile?.bookmarkedChannelIds?.includes(channel.id)}
                            currentUser={currentUser} 
                            userProfile={userProfile}
                            setChannelToEdit={setChannelToEdit || (()=>{})}
                            setIsSettingsModalOpen={setIsSettingsModalOpen || (()=>{})}
                            globalVoice={globalVoice}
                            t={t}
                            onCommentClick={onCommentClick || (()=>{})}
                            onCreatorClick={(e) => { e.stopPropagation(); setShowCreator({ channel }); }}
                          />
                      ))}
                  </div>
              ) : (
                  <PodcastListTable 
                    channels={sortedChannels} 
                    onChannelClick={onChannelClick} 
                    sortConfig={sortConfig} 
                    onSort={handleSort} 
                    globalVoice={globalVoice}
                    currentUser={currentUser}
                    userProfile={userProfile}
                    onEdit={setChannelToEdit}
                  />
              )}
          </div>
        </>
      ) : (
        <div className="h-full w-full relative">
            <div className="absolute top-4 left-4 z-50">
                <button onClick={() => setViewMode(lastNonMobileMode.current)} className="p-3 bg-slate-900/60 backdrop-blur-md rounded-full border border-white/10 text-white shadow-xl"><ArrowLeft size={20}/></button>
            </div>
            <div 
              ref={mobileContainerRef}
              className="h-full w-full overflow-y-auto snap-y snap-mandatory scrollbar-hide bg-black" 
              onScroll={(e) => {
                const el = e.currentTarget;
                const index = Math.round(el.scrollTop / el.clientHeight);
                if (index !== activeMobileIndex) setActiveMobileIndex(index);
              }}
            >
                {sortedChannels.map((channel, idx) => (
                    <MobileFeedCard 
                        key={channel.id} 
                        channel={channel} 
                        isActive={idx === activeMobileIndex} 
                        onChannelClick={onChannelClick}
                        language={language}
                        preferredProvider={userProfile?.preferredTtsProvider}
                        onFinish={handleMobileFinish}
                        handleVote={handleVote}
                        handleBookmarkToggle={handleBookmarkToggle}
                        onCommentClick={onCommentClick}
                        currentUser={currentUser}
                        userProfile={userProfile}
                    />
                ))}
            </div>
        </div>
      )}

      {showCreator && (
          <CreatorProfileModal 
            isOpen={true} 
            onClose={() => setShowCreator(null)} 
            channel={showCreator.channel} 
            onMessage={() => { onNavigate?.('chat'); setShowCreator(null); }} 
            onChannelClick={(id) => { onChannelClick(id); setShowCreator(null); }}
            currentUser={currentUser}
            userProfile={userProfile}
          />
      )}
    </div>
  );
};

export default PodcastFeed;