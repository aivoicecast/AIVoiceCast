import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Channel, UserProfile, GeneratedLecture } from '../types';
import { Play, MessageSquare, Heart, Share2, Bookmark, Music, Plus, Pause, Loader2, Volume2, VolumeX, GraduationCap, ChevronRight, Mic, AlignLeft, BarChart3, User, AlertCircle, Zap, Radio, Square, Sparkles } from 'lucide-react';
import { ChannelCard } from './ChannelCard';
import { CreatorProfileModal } from './CreatorProfileModal';
import { followUser, unfollowUser } from '../services/firestoreService';
import { generateLectureScript } from '../services/lectureGenerator';
import { synthesizeSpeech } from '../services/tts';
import { getCachedLectureScript, cacheLectureScript, getUserChannels } from '../utils/db';
import { GEMINI_API_KEY, OPENAI_API_KEY } from '../services/private_keys';
import { SPOTLIGHT_DATA } from '../utils/spotlightContent';
import { OFFLINE_CHANNEL_ID, OFFLINE_CURRICULUM, OFFLINE_LECTURES } from '../utils/offlineContent';
import { warmUpAudioContext, getGlobalAudioContext, stopAllPlatformAudio, registerAudioOwner, logAudioEvent, isAudioOwner, getGlobalAudioGeneration } from '../utils/audioUtils';

interface PodcastFeedProps {
  channels: Channel[];
  onChannelClick: (id: string) => void;
  onStartLiveSession: (channel: Channel) => void; 
  userProfile: UserProfile | null;
  globalVoice: string;
  onRefresh?: () => void;
  onMessageCreator?: (creatorId: string, creatorName: string) => void;
  
  t?: any;
  currentUser?: any;
  setChannelToEdit?: (channel: Channel) => void;
  setIsSettingsModalOpen?: (open: boolean) => void;
  onCommentClick?: (channel: Channel) => void;
  handleVote?: (id: string, type: 'like' | 'dislike', e: React.MouseEvent) => void;
  
  filterMode?: 'foryou' | 'following' | 'mine';
  isFeedActive?: boolean; // Controls whether logic/playback is enabled
}

const MobileFeedCard = ({ 
    channel, 
    isActive, 
    onToggleLike, 
    isLiked, 
    isBookmarked, 
    isFollowed, 
    onToggleBookmark, 
    onToggleFollow, 
    onShare, 
    onComment, 
    onProfileClick, 
    onChannelClick, 
    onChannelFinish 
}: any) => {
    const MY_TOKEN = useMemo(() => `MobileFeed:${channel.id}`, [channel.id]);
    
    const [playbackState, setPlaybackState] = useState<'idle' | 'buffering' | 'playing' | 'error'>('idle');
    const [statusMessage, setStatusMessage] = useState('');
    const [transcriptHistory, setTranscriptHistory] = useState<{speaker: string, text: string, id: string}[]>([]);
    const [activeTranscriptId, setActiveTranscriptId] = useState<string | null>(null);
    const [isAutoplayBlocked, setIsAutoplayBlocked] = useState(false);
    
    const [provider, setProvider] = useState<'system' | 'gemini' | 'openai'>(() => {
        const hasOpenAI = !!(localStorage.getItem('openai_api_key') || process.env.OPENAI_API_KEY);
        if (hasOpenAI) return 'openai';
        const hasGemini = !!(localStorage.getItem('gemini_api_key') || process.env.API_KEY);
        return hasGemini ? 'gemini' : 'system';
    });
    
    const [trackIndex, setTrackIndex] = useState(-1); 
    const mountedRef = useRef(true);
    const isLoopingRef = useRef(false);
    const localSessionIdRef = useRef(0); 
    const isActiveRef = useRef(isActive); 
    const preloadedScriptRef = useRef<Promise<GeneratedLecture | null> | null>(null);
    const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const transcriptScrollRef = useRef<HTMLDivElement>(null);

    const isBusy = playbackState === 'playing' || playbackState === 'buffering' || statusMessage !== "";

    useEffect(() => { isActiveRef.current = isActive; }, [isActive]);

    useEffect(() => {
        if (transcriptScrollRef.current) {
            const container = transcriptScrollRef.current;
            container.scrollTo({
                top: container.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [transcriptHistory]);

    /**
     * CLEAN STOP - Completely resets local and global state
     */
    const stopAudioInternal = useCallback((source: string = "Local") => {
        localSessionIdRef.current++; 
        isLoopingRef.current = false;
        
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
        
        activeSourcesRef.current.forEach(source => {
            try { source.stop(); source.disconnect(); } catch(e) {}
        });
        activeSourcesRef.current.clear();
        
        setPlaybackState('idle');
        setStatusMessage("");
        logAudioEvent(MY_TOKEN, 'STOP', `Session Reset to ${localSessionIdRef.current} via ${source}`);
    }, [MY_TOKEN]);

    // External wrapper that informs the global manager
    const stopAudioGlobal = useCallback(() => {
        stopAllPlatformAudio(`CardAction:${channel.id}`);
    }, [channel.id]);

    const flatCurriculum = useMemo(() => {
        let chapters = channel.chapters;
        if (!chapters || chapters.length === 0) {
            if (channel.id === OFFLINE_CHANNEL_ID) chapters = OFFLINE_CURRICULUM;
            else if (SPOTLIGHT_DATA[channel.id]) chapters = SPOTLIGHT_DATA[channel.id].curriculum;
        }
        if (!chapters) return [];
        return chapters.flatMap((ch: any, cIdx: number) => 
            (ch.subTopics || []).map((sub: any, lIdx: number) => ({
                chapterIndex: cIdx,
                lessonIndex: lIdx,
                title: sub.title,
                id: sub.id,
                chapterTitle: ch.title
            }))
        );
    }, [channel]);

    const totalLessons = flatCurriculum.length;

    useEffect(() => {
        mountedRef.current = true;
        return () => { 
            mountedRef.current = false;
            if (isAudioOwner(MY_TOKEN)) {
                stopAllPlatformAudio(`MobileFeedUnmount:${channel.id}`);
            } else {
                stopAudioInternal("Unmount");
            }
        };
    }, [stopAudioInternal, MY_TOKEN, channel.id]);

    useEffect(() => {
        if (isActive) {
            const introText = channel.welcomeMessage || channel.description || `Welcome to ${channel.title}.`;
            setTranscriptHistory([{ speaker: 'Host', text: introText, id: 'intro' }]);
            setActiveTranscriptId('intro');
            setTrackIndex(-1);
            
            const ctx = getGlobalAudioContext();
            if (ctx.state === 'suspended' || (ctx.state as any) === 'interrupted') {
                setIsAutoplayBlocked(true);
            } else {
                const timer = setTimeout(() => { 
                    if (isActiveRef.current && mountedRef.current) attemptAutoPlay(); 
                }, 400); 
                return () => {
                    clearTimeout(timer);
                    stopAudioInternal("Deactivation");
                };
            }
        } else {
            stopAudioInternal("Inactive");
            preloadedScriptRef.current = null;
            setIsAutoplayBlocked(false);
        }
    }, [isActive, channel.id, stopAudioInternal]);

    const attemptAutoPlay = async () => {
        if (!isActiveRef.current || isLoopingRef.current || !mountedRef.current) return;
        
        const ctx = getGlobalAudioContext();
        if (provider !== 'system' && (ctx.state === 'suspended' || (ctx.state as any) === 'interrupted')) {
            setIsAutoplayBlocked(true);
            return;
        }

        const localSessionId = ++localSessionIdRef.current;
        const targetGen = registerAudioOwner(MY_TOKEN, () => stopAudioInternal("GlobalReset"));
        
        runTrackSequence(-1, localSessionId, targetGen);
    };

    const handleTogglePlay = async (e: React.MouseEvent) => {
        e.stopPropagation();
        
        // Navigation case
        if (!isActive) { 
            stopAllPlatformAudio(`NavigationTransition:${channel.id}`);
            onChannelClick(channel.id); 
            return; 
        }
        
        const ctx = getGlobalAudioContext();
        
        // Critical for iPhone: Resume on user gesture
        if (ctx.state === 'suspended' || (ctx.state as any) === 'interrupted' || isAutoplayBlocked) {
            try {
                await warmUpAudioContext(ctx);
                setIsAutoplayBlocked(false);
            } catch(err) {
                console.error("Context activation failed", err);
            }
        }

        // Logical Toggle
        if (isBusy || isLoopingRef.current) { 
            stopAudioGlobal(); // Reset global lock and increment gen
            return; 
        }
        
        const localSessionId = ++localSessionIdRef.current;
        const targetGen = registerAudioOwner(MY_TOKEN, () => stopAudioInternal("GlobalReset"));
        runTrackSequence(trackIndex >= totalLessons ? -1 : trackIndex, localSessionId, targetGen);
    };

    const toggleTtsMode = (e: React.MouseEvent) => {
        e.stopPropagation();
        let newMode: 'system' | 'gemini' | 'openai' = 'system';
        if (provider === 'gemini') newMode = 'openai';
        else if (provider === 'openai') newMode = 'system';
        else newMode = 'gemini';
        
        setProvider(newMode);
        
        if (isLoopingRef.current) {
            stopAudioGlobal();
            setTimeout(() => { 
                if (isActiveRef.current && mountedRef.current) {
                    const localSessionId = ++localSessionIdRef.current;
                    const targetGen = registerAudioOwner(MY_TOKEN, () => stopAudioInternal("GlobalReset"));
                    runTrackSequence(trackIndex === -1 ? -1 : trackIndex, localSessionId, targetGen); 
                }
            }, 150);
        }
    };

    const playAudioBuffer = (buffer: AudioBuffer, localSessionId: number, targetGen: number): Promise<void> => {
        return new Promise(async (resolve) => {
            const ctx = getGlobalAudioContext();
            
            const isAborted = () => !mountedRef.current || !isActiveRef.current || localSessionId !== localSessionIdRef.current || targetGen !== getGlobalAudioGeneration() || !isAudioOwner(MY_TOKEN) || ctx.state === 'suspended';

            if (isAborted()) { 
                resolve(); 
                return; 
            }

            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);
            activeSourcesRef.current.add(source);
            source.onended = () => { 
                activeSourcesRef.current.delete(source);
                resolve(); 
            };
            source.start(0);
        });
    };

    const playSystemAudio = (text: string, voiceName: string, localSessionId: number, targetGen: number): Promise<void> => {
        return new Promise((resolve) => {
            const isAborted = () => !mountedRef.current || !isActiveRef.current || localSessionId !== localSessionIdRef.current || targetGen !== getGlobalAudioGeneration() || !isAudioOwner(MY_TOKEN);
            
            if (isAborted()) { resolve(); return; }
            if (window.speechSynthesis) window.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(text);
            const voices = window.speechSynthesis.getVoices();
            const v = voices.find(v => v.name.includes(voiceName)) || voices.find(v => v.lang.startsWith('en'));
            if (v) utterance.voice = v;
            utterance.rate = 1.1; 
            utterance.onend = () => resolve();
            utterance.onerror = () => resolve();
            window.speechSynthesis.speak(utterance);
        });
    };

    const runTrackSequence = async (startIndex: number, localSessionId: number, targetGen: number) => {
        const isAborted = () => !mountedRef.current || !isActiveRef.current || localSessionId !== localSessionIdRef.current || targetGen !== getGlobalAudioGeneration() || !isAudioOwner(MY_TOKEN);

        if (isAborted()) return;
        
        isLoopingRef.current = true;
        setPlaybackState('playing');
        
        let currentIndex = startIndex;
        
        while (!isAborted()) {
            try {
                setTrackIndex(currentIndex); 
                let textParts: {speaker: string, text: string, voice: string, id: string}[] = [];
                let hostVoice = channel.voiceName || 'Puck';
                let studentVoice = 'Zephyr';
                
                if (provider === 'openai') { hostVoice = 'Alloy'; studentVoice = 'Echo'; }

                if (currentIndex === -1) {
                    const introText = channel.welcomeMessage || channel.description || `Welcome to ${channel.title}.`;
                    textParts = [{ speaker: 'Host', text: introText, voice: hostVoice, id: 'intro' }];
                    if (flatCurriculum.length > 0) preloadedScriptRef.current = fetchLectureData(flatCurriculum[0]);
                } else {
                    if (currentIndex >= totalLessons) { 
                        setPlaybackState('idle'); 
                        isLoopingRef.current = false;
                        if (onChannelFinish) onChannelFinish(); 
                        break; 
                    }
                    
                    const lessonMeta = flatCurriculum[currentIndex];
                    let lecture = null;
                    
                    if (preloadedScriptRef.current) { 
                        setStatusMessage(`Preparing...`); 
                        lecture = await preloadedScriptRef.current; 
                        preloadedScriptRef.current = null; 
                    } else { 
                        setStatusMessage(`Preparing...`); 
                        setPlaybackState('buffering'); 
                        lecture = await fetchLectureData(lessonMeta); 
                    }
                    
                    if (isAborted()) break;

                    if (!lecture || !lecture.sections || lecture.sections.length === 0) { currentIndex++; continue; }
                    
                    setPlaybackState('playing');
                    setStatusMessage("Playing");
                    
                    textParts = lecture.sections.map((s: any, sIdx: number) => ({
                        speaker: s.speaker === 'Teacher' ? lecture.professorName : lecture.studentName,
                        text: s.text,
                        voice: s.speaker === 'Teacher' ? hostVoice : studentVoice,
                        id: `lec-${currentIndex}-sec-${sIdx}`
                    }));
                    
                    if (currentIndex + 1 < totalLessons) {
                        preloadedScriptRef.current = fetchLectureData(flatCurriculum[currentIndex + 1]);
                    }
                }

                for (let i = 0; i < textParts.length; i++) {
                    if (isAborted()) break;
                    
                    const part = textParts[i];
                    
                    setTranscriptHistory(prev => {
                        if (prev.some(p => p.id === part.id)) return prev;
                        return [...prev, { speaker: part.speaker, text: part.text, id: part.id }].slice(-50);
                    });
                    setActiveTranscriptId(part.id);
                    
                    if (provider === 'system') {
                        await playSystemAudio(part.text, part.voice, localSessionId, targetGen);
                    } else {
                        setStatusMessage(`Synthesizing...`);
                        const audioResult = await synthesizeSpeech(part.text, part.voice, getGlobalAudioContext());
                        
                        if (isAborted()) break;

                        if (audioResult && audioResult.buffer) {
                            setStatusMessage("Playing");
                            await playAudioBuffer(audioResult.buffer, localSessionId, targetGen);
                        } else {
                            await playSystemAudio(part.text, part.voice, localSessionId, targetGen);
                        }
                    }
                    
                    if (isAborted()) break;
                    await new Promise(r => setTimeout(r, 250));
                }
                currentIndex++;
            } catch (e) { break; }
        }
        
        isLoopingRef.current = false;
        if (localSessionId === localSessionIdRef.current) {
            setPlaybackState('idle');
            setStatusMessage("");
        }
    };

    const fetchLectureData = async (meta: any) => {
        if (OFFLINE_LECTURES[meta.title]) return OFFLINE_LECTURES[meta.title];
        if (SPOTLIGHT_DATA[channel.id]?.lectures?.[meta.title]) return SPOTLIGHT_DATA[channel.id].lectures[meta.title];
        
        const cacheKey = `lecture_${channel.id}_${meta.id}_en`;
        let data = await getCachedLectureScript(cacheKey);
        if (!data) {
            const apiKey = localStorage.getItem('gemini_api_key') || process.env.API_KEY;
            if (apiKey) {
                data = await generateLectureScript(meta.title, `Podcast: ${channel.title}. ${channel.description}`, 'en');
                if (data) await cacheLectureScript(cacheKey, data);
            }
        }
        return data;
    };

    const handleCardClick = (e: React.MouseEvent) => {
        stopAudioGlobal();
        onChannelClick(channel.id);
    };

    return (
        <div className="h-full w-full snap-start relative flex flex-col justify-center bg-slate-900 border-b border-slate-800 overflow-hidden">
            <div className="absolute inset-0">
                <img src={channel.imageUrl} alt={channel.title} className="w-full h-full object-cover opacity-60" loading={isActive ? "eager" : "lazy"} />
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/90"></div>
                
                {isAutoplayBlocked && isActive && (
                    <div className="absolute inset-0 z-40 bg-black/50 backdrop-blur-md flex flex-col items-center justify-center animate-fade-in">
                        <button 
                            onClick={handleTogglePlay}
                            className="w-20 h-20 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-2xl transition-transform active:scale-95"
                        >
                            <Play size={40} fill="currentColor" className="ml-1" />
                        </button>
                        <p className="text-white font-bold mt-4 tracking-wide uppercase text-sm">Tap to Start AI Audio</p>
                    </div>
                )}

                <div className="absolute top-20 right-4 z-30 flex flex-col items-end gap-2">
                    <button 
                        onClick={handleTogglePlay}
                        className={`backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2 border text-xs font-black shadow-lg transition-all active:scale-95 ${isBusy ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-white border-slate-200 text-black'}`}
                    >
                        {playbackState === 'buffering' || statusMessage === "Synthesizing..." || statusMessage === "Preparing..." ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : isBusy ? (
                            <Pause size={16} fill="currentColor" />
                        ) : (
                            <Play size={16} fill="currentColor" />
                        )}
                        <span>{isBusy ? 'PAUSE' : 'PLAY'}</span>
                    </button>

                    <button onClick={toggleTtsMode} className={`backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border text-[10px] font-bold shadow-lg transition-all ${provider === 'openai' ? 'bg-emerald-900/60 border-emerald-500/50 text-emerald-300' : provider === 'gemini' ? 'bg-indigo-900/60 border-indigo-500/50 text-indigo-300' : 'bg-slate-800/60 border-slate-600 text-slate-300'}`}>
                        {provider === 'openai' ? <Sparkles size={12} fill="currentColor"/> : provider === 'gemini' ? <Zap size={12} fill="currentColor"/> : <Radio size={12} />}
                        <span>{provider === 'openai' ? 'OpenAI' : provider === 'gemini' ? 'Gemini' : 'System'}</span>
                    </button>
                    
                    {statusMessage && (
                        <div className={`backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border shadow-lg bg-black/60 border-white/10 animate-fade-in`}>
                            {statusMessage === "Synthesizing..." || statusMessage === "Preparing..." ? <Loader2 size={10} className="animate-spin text-indigo-400" /> : <Music size={10} className="text-slate-400" />}
                            <span className="text-[9px] font-bold text-white uppercase tracking-wider">{statusMessage}</span>
                        </div>
                    )}
                </div>

                <div 
                    className="absolute top-[10%] bottom-[18%] left-4 right-16 z-20 flex flex-col justify-end overflow-hidden pointer-events-none"
                    style={{ maskImage: 'linear-gradient(to bottom, transparent, black 8%, black 92%, transparent)' }}
                >
                    <div 
                        ref={transcriptScrollRef}
                        className="flex flex-col gap-4 overflow-y-auto scrollbar-hide py-10 pointer-events-auto touch-pan-y overscroll-contain"
                    >
                        {transcriptHistory.map((item) => {
                            const isCurrent = activeTranscriptId === item.id;
                            return (
                                <div 
                                    key={item.id} 
                                    className={`bg-black/30 backdrop-blur-sm p-4 rounded-2xl border-l-4 transition-all duration-500 ${isCurrent ? 'border-indigo-500 bg-black/50 scale-100 opacity-100 shadow-xl' : 'border-slate-700/30 scale-95 opacity-50'}`}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-[9px] font-bold uppercase tracking-wider ${item.speaker === 'Host' ? 'text-emerald-400' : 'text-indigo-400'}`}>
                                            {item.speaker}
                                        </span>
                                        {isCurrent && playbackState === 'playing' && <div className="flex gap-0.5"><div className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce"></div><div className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]"></div><div className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]"></div></div>}
                                    </div>
                                    <p className={`text-lg font-medium leading-tight text-white drop-shadow-md`}>
                                        {item.text}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="absolute right-2 bottom-40 flex flex-col items-center gap-6 z-30">
                <div className="relative mb-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); onProfileClick(e, channel); }}>
                    <img src={channel.imageUrl} className={`w-12 h-12 rounded-full border-2 object-cover ${isActive && playbackState === 'playing' ? 'animate-spin-slow' : ''}`} alt="Creator" />
                    {!isFollowed && channel.ownerId && (
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-500 rounded-full p-0.5 border border-white" onClick={(e) => onToggleFollow(e, channel.id, channel.ownerId)}><Plus size={12} color="white" strokeWidth={4} /></div>
                    )}
                </div>
                <button onClick={(e) => onToggleLike(e, channel.id)} className="flex flex-col items-center gap-1"><Heart size={32} fill={isLiked ? "#ef4444" : "rgba(255,255,255,0.9)"} className={isLiked ? "text-red-500" : "text-white"} /><span className="text-white text-xs font-bold shadow-black drop-shadow-md">{channel.likes}</span></button>
                <button onClick={(e) => onComment(e, channel)} className="flex flex-col items-center gap-1"><MessageSquare size={32} fill="white" className="text-white" /><span className="text-white text-xs font-bold shadow-black drop-shadow-md">{channel.comments?.length || 0}</span></button>
                <button onClick={(e) => onShare(e, channel)} className="flex flex-col items-center gap-1"><Share2 size={32} fill="rgba(255,255,255,0.9)" className="text-white" /><span className="text-white text-xs font-bold shadow-black drop-shadow-md">Share</span></button>
            </div>
            
            <div className="absolute left-0 bottom-0 w-full p-4 pb-6 bg-gradient-to-t from-black via-black/80 to-transparent z-30 pr-20">
                <div onClick={handleCardClick} className="inline-flex items-center gap-2 mb-3 bg-slate-800/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700 cursor-pointer active:scale-95 transition-transform">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase flex items-center gap-1"><GraduationCap size={10} /> {trackIndex === -1 ? 'Introduction' : `Lesson ${trackIndex + 1}/${totalLessons}`}</span>
                    <ChevronRight size={12} className="text-slate-500" />
                </div>
                <div className="flex items-center gap-3 mb-2">
                    <div onClick={handleCardClick} className="cursor-pointer">
                        <div className="flex items-center gap-1.5 text-white font-bold text-lg drop-shadow-md hover:underline"><User size={14} className="text-indigo-400" /><span>@{channel.author}</span></div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Host</p>
                    </div>
                </div>
                <p className="text-white/80 text-sm mb-3 line-clamp-2 leading-relaxed drop-shadow-sm">{channel.description}</p>
                <div className="flex items-center gap-2 text-white/60 text-xs font-medium overflow-hidden whitespace-nowrap">
                    <Music size={12} className={playbackState === 'playing' ? "animate-pulse text-emerald-400" : ""} />
                    <div className="flex gap-4 animate-marquee"><span>Voice: {channel.voiceName} ({provider})</span><span>•</span>{channel.tags.map((t: string) => <span key={t}>#{t}</span>)}</div>
                </div>
            </div>
        </div>
    );
};

export const PodcastFeed: React.FC<PodcastFeedProps> = ({ 
  channels, onChannelClick, onStartLiveSession, userProfile, globalVoice, onRefresh, onMessageCreator,
  t, currentUser, setChannelToEdit, setIsSettingsModalOpen, onCommentClick, handleVote, filterMode = 'foryou',
  isFeedActive = true 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 768 : true);

  useEffect(() => {
      const handleResize = () => setIsDesktop(window.innerWidth >= 768);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const [likedChannels, setLikedChannels] = useState<Set<string>>(new Set());
  const [bookmarkedChannels, setBookmarkedChannels] = useState<Set<string>>(new Set());
  const [followedChannels, setFollowedChannels] = useState<Set<string>>(new Set());
  const [viewingCreator, setViewingCreator] = useState<Channel | null>(null);

  useEffect(() => {
      if (userProfile?.likedChannelIds) setLikedChannels(new Set(userProfile.likedChannelIds));
      if (userProfile?.following) {
          const followedOwners = new Set(userProfile.following);
          const channelIds = channels.filter(c => c.ownerId && followedOwners.has(c.ownerId)).map(c => c.id);
          setFollowedChannels(new Set(channelIds));
      }
  }, [userProfile, channels]);

  const recommendedChannels = useMemo(() => {
      if (!isFeedActive) return []; 
      if (filterMode === 'mine') return channels.filter(c => currentUser && c.ownerId === currentUser.uid).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      if (filterMode === 'following') return [...channels].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      const scored = channels.map(ch => {
          let score = 0;
          if (currentUser && ch.ownerId === currentUser.uid) score += 100000;
          if (userProfile?.interests?.length) { if (userProfile.interests.some(i => ch.tags.includes(i))) score += 20; }
          if (ch.createdAt) { const ageHours = (Date.now() - ch.createdAt) / (1000 * 60 * 60); if (ageHours < 1) score += 50; }
          score += (ch.likes / 100); 
          return { channel: ch, score };
      });
      scored.sort((a, b) => b.score - a.score);
      return scored.map(s => s.channel);
  }, [channels, userProfile, filterMode, currentUser, isFeedActive]);

  useEffect(() => { 
      if (!isFeedActive) return; 
      if (!isDesktop && recommendedChannels.length > 0 && !activeChannelId) setActiveChannelId(recommendedChannels[0].id); 
  }, [recommendedChannels, isDesktop, activeChannelId, isFeedActive]);

  useEffect(() => {
      const container = containerRef.current;
      if (!container || isDesktop || !isFeedActive) return;
      const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => { if (entry.isIntersecting) { const id = entry.target.getAttribute('data-id'); if (id) setActiveChannelId(id); } });
      }, { root: container, threshold: 0.5 });
      const cards = container.querySelectorAll('.feed-card');
      cards.forEach(c => observer.observe(c));
      return () => observer.disconnect();
  }, [recommendedChannels, isDesktop, isFeedActive]);

  const toggleLike = (e: React.MouseEvent, channelId: string) => { e.stopPropagation(); if (!currentUser) return alert("Please sign in."); const newSet = new Set(likedChannels); if (newSet.has(channelId)) { newSet.delete(channelId); handleVote?.(channelId, 'dislike', e); } else { newSet.add(channelId); handleVote?.(channelId, 'like', e); } setLikedChannels(newSet); };
  const toggleBookmark = (e: React.MouseEvent, channelId: string) => { e.stopPropagation(); const newSet = new Set(bookmarkedChannels); if (newSet.has(channelId)) newSet.delete(channelId); else newSet.add(channelId); setBookmarkedChannels(newSet); };
  const toggleFollow = async (e: React.MouseEvent, channelId: string, ownerId?: string) => { e.stopPropagation(); if (!currentUser) return alert("Sign in to follow."); if (!ownerId) return alert("No owner profile."); const newSet = new Set(followedChannels); const isFollowing = newSet.has(channelId); if (isFollowing) { newSet.delete(channelId); setFollowedChannels(newSet); try { await unfollowUser(currentUser.uid, ownerId); } catch(err) { setFollowedChannels(new Set(newSet.add(channelId))); } } else { newSet.add(channelId); setFollowedChannels(newSet); try { await followUser(currentUser.uid, ownerId); } catch(err) { setFollowedChannels(prev => { prev.delete(channelId); return new Set(prev); }); } } };
  const handleShare = async (e: React.MouseEvent, channel: Channel) => { e.stopPropagation(); if (navigator.share) { try { await navigator.share({ title: channel.title, text: channel.description, url: window.location.href }); } catch (err) {} } else { alert("Link copied!"); } };
  const handleComment = (e: React.MouseEvent, channel: Channel) => { e.stopPropagation(); if(onCommentClick) onCommentClick(channel); };
  const handleScrollToNext = (currentChannelId: string) => { const idx = recommendedChannels.findIndex(c => c.id === currentChannelId); if (idx !== -1 && idx < recommendedChannels.length - 1) { const nextId = recommendedChannels[idx + 1].id; const nextEl = document.querySelector(`[data-id="${nextId}"]`); if (nextEl) nextEl.scrollIntoView({ behavior: 'smooth' }); } };

  if (!isFeedActive) return null;

  if (isDesktop) {
      return (
        <>
        <div className="h-full overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-800">
            <div className="max-w-7xl mx-auto">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2"><span className="bg-indigo-600 w-2 h-8 rounded-full"></span> Explore Podcasts</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {recommendedChannels.map(channel => (
                        <ChannelCard key={channel.id} channel={channel} handleChannelClick={onChannelClick} handleVote={handleVote || (() => {})} currentUser={currentUser} setChannelToEdit={setChannelToEdit || (() => {})} setIsSettingsModalOpen={setIsSettingsModalOpen || (() => {})} globalVoice={globalVoice} t={t || { host: 'Host' }} onCommentClick={onCommentClick || (() => {})} isLiked={userProfile?.likedChannelIds?.includes(channel.id)} onCreatorClick={(e) => { e.stopPropagation(); setViewingCreator(channel); }} />
                    ))}
                </div>
            </div>
        </div>
        {viewingCreator && <CreatorProfileModal isOpen={true} onClose={() => setViewingCreator(null)} channel={viewingCreator} onMessage={() => { if (onMessageCreator && viewingCreator.ownerId) onMessageCreator(viewingCreator.ownerId, viewingCreator.author); setViewingCreator(null); }} onChannelClick={(id) => { setViewingCreator(null); onChannelClick(id); }} currentUser={currentUser} />}
        </>
      );
  }

  return (
    <>
    <div ref={containerRef} className="h-[calc(100vh-64px)] w-full bg-black overflow-y-scroll snap-y snap-mandatory scroll-smooth no-scrollbar relative">
        {recommendedChannels.length === 0 ? (
             <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center space-y-6"><div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center"><Heart size={32} className="text-slate-600" /></div><div><h3 className="text-xl font-bold text-white mb-2">No Podcasts Here Yet</h3><p className="text-slate-400 text-sm max-w-xs mx-auto">{filterMode === 'following' ? "Follow creators or like channels to build your personal feed." : filterMode === 'mine' ? "You haven't created any podcasts yet." : "We couldn't find any podcasts matching your criteria."}</p></div>{filterMode === 'following' && <button onClick={onRefresh} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-full transition-colors border border-slate-700">Discover Content</button>}</div>
        ) : (
            recommendedChannels.map((channel) => (
                <div key={channel.id} data-id={channel.id} className="feed-card h-full w-full snap-start">
                    <MobileFeedCard 
                        channel={channel} 
                        isActive={activeChannelId === channel.id && isFeedActive} 
                        isLiked={likedChannels.has(channel.id)} 
                        isBookmarked={bookmarkedChannels.has(channel.id)} 
                        isFollowed={followedChannels.has(channel.id) || (userProfile?.following?.includes(channel.ownerId || ''))} 
                        onToggleLike={toggleLike} 
                        onToggleBookmark={toggleBookmark} 
                        onToggleFollow={toggleFollow} 
                        onShare={handleShare} 
                        onComment={handleComment} 
                        onProfileClick={(e: any, ch: any) => { e.stopPropagation(); setViewingCreator(ch); }} 
                        onChannelClick={onChannelClick} 
                        onChannelFinish={() => handleScrollToNext(channel.id)} 
                    />
                </div>
            ))
        )}
    </div>
    {viewingCreator && <CreatorProfileModal isOpen={true} onClose={() => setViewingCreator(null)} channel={viewingCreator} onMessage={() => { if (onMessageCreator && viewingCreator.ownerId) onMessageCreator(viewingCreator.ownerId, viewingCreator.author); setViewingCreator(null); }} onChannelClick={(id) => { setViewingCreator(null); onChannelClick(id); }} currentUser={currentUser} />}
    </>
  );
};
