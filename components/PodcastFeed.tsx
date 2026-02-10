
import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Channel, UserProfile, GeneratedLecture, TtsProvider } from '../types';
// Added MarkdownView import
import { Play, MessageSquare, Heart, Share2, Bookmark, Music, Plus, Pause, Loader2, Volume2, VolumeX, GraduationCap, ChevronRight, Mic, AlignLeft, BarChart3, User, AlertCircle, Zap, Radio, Square, Sparkles, LayoutGrid, List, SearchX, Activity, Video, Terminal, RefreshCw, Scroll, Lock, Crown, Settings2, Globe, Cpu, Speaker, Search, X, ArrowLeft, Smartphone, Wand2, ShieldCheck, BookText, Type, Check, RotateCcw, Sliders, Palette } from 'lucide-react';
import { ChannelCard } from './ChannelCard';
import { CreatorProfileModal } from './CreatorProfileModal';
import { PodcastListTable, SortKey } from './PodcastListTable';
import { followUser, unfollowUser, isUserAdmin, voteChannel } from '../services/firestoreService';
import { generateLectureScript } from '../services/lectureGenerator';
import { generateChannelFromPrompt } from '../services/channelGenerator';
import { synthesizeSpeech, speakSystem } from '../services/tts';
import { getCachedLectureScript, cacheLectureScript } from '../utils/db';
import { SPOTLIGHT_DATA } from '../utils/spotlightContent';
import { warmUpAudioContext, getGlobalAudioContext, stopAllPlatformAudio, registerAudioOwner, getGlobalAudioGeneration, primeNeuralAudio, getSystemVoicesAsync, syncPrimeSpeech, SPEECH_REGISTRY } from '../utils/audioUtils';
import { Visualizer } from './Visualizer';
import { MarkdownView } from './MarkdownView';

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
  onOpenManual?: () => void;
  onUpdateChannel?: (channel: Channel) => Promise<void>;
  language?: 'en' | 'zh';
  onMagicCreate?: () => void;
  t: any;
}

type FeedTheme = 'obsidian' | 'parchment' | 'matrix';
type FontChoice = 'sans' | 'serif' | 'mono' | 'futurist' | 'readable';

interface ThemeConfig {
    bg: string;
    text: string;
    secondaryText: string;
    accent: string;
    cardBg: string;
    border: string;
}

const FEED_THEMES: Record<FeedTheme, ThemeConfig> = {
    obsidian: {
        bg: 'bg-slate-950',
        text: 'text-white',
        secondaryText: 'text-slate-500',
        accent: 'text-indigo-400',
        cardBg: 'bg-indigo-900/10',
        border: 'border-indigo-500/30'
    },
    parchment: {
        bg: 'bg-[#fdfbf7]',
        text: 'text-slate-900',
        secondaryText: 'text-slate-600',
        accent: 'text-indigo-600',
        cardBg: 'bg-white/40',
        border: 'border-slate-200'
    },
    matrix: {
        bg: 'bg-black',
        text: 'text-emerald-400',
        secondaryText: 'text-emerald-900',
        accent: 'text-emerald-500',
        cardBg: 'bg-emerald-900/5',
        border: 'border-emerald-500/20'
    }
};

const FONT_CLASSES: Record<FontChoice, string> = {
    sans: 'font-sans',
    serif: 'font-serif',
    mono: 'font-mono',
    futurist: 'tracking-tight font-sans', 
    readable: 'font-sans' 
};

const FONT_LABELS: Record<FontChoice, string> = {
    sans: 'Inter UI',
    serif: 'Georgia',
    mono: 'JetBrains',
    futurist: 'Space G',
    readable: 'Lexend UI'
};

const MobileFeedCard = ({ channel, isActive, onChannelClick, language, preferredProvider, onFinish, handleVote, handleBookmarkToggle, onCommentClick, currentUser, userProfile, onUpdateChannel }: any) => {
    const MY_TOKEN = useMemo(() => `MobileFeed:${channel.id}`, [channel.id]);
    const [playbackState, setPlaybackState] = useState<'idle' | 'buffering' | 'playing' | 'error'>('idle');
    const [isPaused, setIsPaused] = useState(false);
    const isPausedRef = useRef(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [ttsProvider, setTtsProvider] = useState<TtsProvider>(preferredProvider || 'gemini');
    const [showSettingsMenu, setShowSettingsMenu] = useState(false);
    const [theme, setTheme] = useState<FeedTheme>(() => (localStorage.getItem('mobile_feed_theme') as FeedTheme) || 'obsidian');
    const [fontChoice, setFontChoice] = useState<FontChoice>(() => (localStorage.getItem('mobile_feed_font') as FontChoice) || 'sans');
    const [fontSize, setFontSize] = useState<number>(() => parseInt(localStorage.getItem('mobile_feed_size') || '30'));
    
    const themeConfig = FEED_THEMES[theme];
    const fontClass = FONT_CLASSES[fontChoice];
    
    const [transcriptHistory, setTranscriptHistory] = useState<{speaker: string, text: string, id: string}[]>([]);
    const [activeTranscriptId, setActiveTranscriptId] = useState<string | null>(null);
    const [isAutoplayBlocked, setIsAutoplayBlocked] = useState(false);
    
    const mountedRef = useRef(true);
    const localSessionIdRef = useRef(0);
    const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const transcriptRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const isLiked = useMemo(() => userProfile?.likedChannelIds?.includes(channel.id) || false, [userProfile, channel.id]);
    const isBookmarked = useMemo(() => userProfile?.bookmarkedChannelIds?.includes(channel.id) || false, [userProfile, channel.id]);

    const handleLike = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (handleVote) handleVote(channel.id, isLiked ? 'dislike' : 'like', e);
    };

    const handleBookmark = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (handleBookmarkToggle) handleBookmarkToggle(channel.id, e);
    };

    const handleTogglePause = (e: React.MouseEvent) => {
        e.stopPropagation();
        const next = !isPaused;
        setIsPaused(next);
        isPausedRef.current = next;
        if (next) {
            activeSourcesRef.current.forEach(s => { try { s.stop(); } catch(err){} });
            if (window.speechSynthesis) window.speechSynthesis.cancel();
        }
    };

    const handleReplay = (e: React.MouseEvent) => {
        e.stopPropagation();
        stopAudioInternal();
        setIsPaused(false);
        isPausedRef.current = false;
        setTranscriptHistory([]);
        setActiveTranscriptId(null);
        runPlaybackSequence(++localSessionIdRef.current);
    };

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
            await speakSystem(text, language);
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
        setPlaybackState('playing');
        try {
            const welcomeText = channel.welcomeMessage || channel.description || "Welcome to this neural channel.";
            setTranscriptHistory([{ speaker: 'Host', text: welcomeText, id: 'intro' }]);
            setActiveTranscriptId('intro');
            await playSingleAudioSegment(welcomeText, channel.voiceName, localSession);

            let chaptersToPlay = (SPOTLIGHT_DATA[channel.id]?.curriculum || channel.chapters || []);
            if (chaptersToPlay.length === 0) {
                setPlaybackState('buffering');
                setStatusMessage("Synthesis Phase...");
                const generated = await generateChannelFromPrompt(channel.description, currentUser, language || 'en');
                if (generated && generated.chapters) {
                    chaptersToPlay = generated.chapters;
                    if (onUpdateChannel) onUpdateChannel({ ...channel, chapters: generated.chapters });
                } else {
                    onFinish?.();
                    return;
                }
            }

            for (const chapter of chaptersToPlay) {
                if (localSession !== localSessionIdRef.current) break;
                for (const sub of chapter.subTopics) {
                    if (localSession !== localSessionIdRef.current) break;
                    setPlaybackState('buffering');
                    setStatusMessage(`Sector: ${sub.title}`);
                    const cacheKey = `lecture_${channel.id}_${sub.id}_${language || 'en'}`;
                    let lecture = await getCachedLectureScript(cacheKey) || SPOTLIGHT_DATA[channel.id]?.lectures[sub.title];
                    if (!lecture) lecture = await generateLectureScript(sub.title, channel.description, language || 'en', channel.id, channel.voiceName);

                    if (lecture && mountedRef.current && localSession === localSessionIdRef.current) {
                        setTranscriptHistory(prev => [
                            ...prev,
                            { speaker: 'System', text: `### Sector 0${chapter.id}: ${sub.title}`, id: `head-${sub.id}` },
                            ...lecture!.sections.map((s, i) => ({ 
                                speaker: s.speaker === 'Teacher' ? 'Host' : 'Guest', 
                                text: s.text, 
                                id: `s-${sub.id}-${i}` 
                            }))
                        ]);

                        setPlaybackState('playing');
                        for (let i = 0; i < lecture.sections.length; i++) {
                            if (localSession !== localSessionIdRef.current) break;
                            while (isPausedRef.current) {
                                if (localSession !== localSessionIdRef.current) return;
                                await new Promise(r => setTimeout(r, 250));
                            }
                            const section = lecture.sections[i];
                            setActiveTranscriptId(`s-${sub.id}-${i}`);
                            const voice = section.speaker === 'Teacher' ? channel.voiceName : 'Zephyr';
                            await playSingleAudioSegment(section.text, voice, localSession);
                            if (localSession === localSessionIdRef.current) {
                                while (isPausedRef.current) {
                                    if (localSession !== localSessionIdRef.current) return;
                                    await new Promise(r => setTimeout(r, 250));
                                }
                                await new Promise(r => setTimeout(r, 600));
                            }
                        }
                    }
                }
            }
            if (localSession === localSessionIdRef.current && mountedRef.current) onFinish?.();
        } catch (e: any) {
            setPlaybackState('error');
            onFinish?.(); 
        }
    };

    const [liveVolume, setLiveVolume] = useState(0);

    useEffect(() => {
        if (isActive) {
            const ctx = getGlobalAudioContext();
            if (ctx.state === 'suspended') {
                setIsAutoplayBlocked(true);
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

    useEffect(() => {
        if (activeTranscriptId && transcriptRefs.current[activeTranscriptId]) {
            transcriptRefs.current[activeTranscriptId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [activeTranscriptId]);

    const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value);
        setFontSize(val);
        localStorage.setItem('mobile_feed_size', val.toString());
    };

    const handleFontChoice = (f: FontChoice) => {
        setFontChoice(f);
        localStorage.setItem('mobile_feed_font', f);
    };

    return (
        <div className={`h-full w-full snap-start relative flex flex-col ${themeConfig.bg} overflow-hidden transition-colors duration-700`}>
            <div className="absolute inset-0 z-0">
                {channel.imageUrl && theme !== 'matrix' ? (
                    <img src={channel.imageUrl} className="w-full h-full object-cover opacity-20 blur-xl" alt="" />
                ) : (
                    <div className={`w-full h-full ${theme === 'matrix' ? 'bg-black' : 'bg-gradient-to-br from-slate-900 to-indigo-950 opacity-20'}`}></div>
                )}
                <div className={`absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20`}></div>
            </div>

            <div className="absolute top-[calc(1rem+env(safe-area-inset-top))] right-4 z-[100] flex flex-col items-end gap-3">
                <button onClick={() => setShowSettingsMenu(!showSettingsMenu)} className="p-3 bg-slate-900/60 backdrop-blur-md rounded-full border border-white/10 text-white shadow-2xl active:scale-95">
                    <Type size={20} className={themeConfig.accent} />
                </button>
                {showSettingsMenu && (
                    <div className="bg-slate-900 border border-slate-700 rounded-[2rem] shadow-2xl p-5 animate-fade-in-up flex flex-col w-[260px] gap-6 max-h-[80vh] overflow-y-auto scrollbar-hide">
                        <div className="space-y-3">
                            <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] px-1 flex items-center gap-2"><Palette size={12}/> Color Schema</p>
                            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-xl border border-white/5">
                                {(['obsidian', 'parchment', 'matrix'] as FeedTheme[]).map(t => (
                                    <button key={t} onClick={() => { setTheme(t); localStorage.setItem('mobile_feed_theme', t); }} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${theme === t ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>
                                        {t.substring(0, 3)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center px-1">
                                <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] flex items-center gap-2"><Type size={12}/> Typeface</p>
                                <span className="text-[9px] font-mono text-indigo-400 uppercase">{fontChoice}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {(['sans', 'serif', 'mono', 'futurist', 'readable'] as FontChoice[]).map(f => (
                                    <button 
                                        key={f} 
                                        onClick={() => handleFontChoice(f)} 
                                        className={`px-3 py-2.5 rounded-xl border text-[10px] font-bold transition-all relative overflow-hidden ${fontChoice === f ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600'}`}
                                    >
                                        <span className={FONT_CLASSES[f]}>{FONT_LABELS[f]}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center px-1">
                                <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] flex items-center gap-2"><Sliders size={12}/> Scale</p>
                                <span className="text-[10px] font-mono font-black text-white">{fontSize}px</span>
                            </div>
                            <input 
                                type="range" min="18" max="48" step="1" 
                                value={fontSize} 
                                onChange={handleFontSizeChange}
                                className="w-full h-1 bg-slate-800 rounded-full appearance-none cursor-pointer accent-indigo-500"
                            />
                            <div className="flex justify-between text-[8px] font-black text-slate-600 uppercase tracking-widest px-1"><span>Compact</span><span>Ultra</span></div>
                        </div>

                        <div className="space-y-3 border-t border-white/5 pt-5">
                            <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] px-1 flex items-center gap-2"><Speaker size={12}/> Voice Core</p>
                            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-xl border border-white/5">
                                {(['gemini', 'google', 'openai', 'system'] as const).map(p => (
                                    <button key={p} onClick={() => { setTtsProvider(p); }} className={`py-2 rounded-lg text-[9px] font-black uppercase transition-all ${ttsProvider === p ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <button onClick={() => setShowSettingsMenu(false)} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-colors mt-2">Close Matrix</button>
                    </div>
                )}
            </div>

            <div className="relative z-10 flex-1 flex flex-col h-full pt-[calc(2.5rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
                <div className="px-10 text-center shrink-0">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 ${themeConfig.cardBg} border ${themeConfig.border} rounded-full ${themeConfig.accent} text-[8px] font-black uppercase tracking-[0.3em] mb-4`}><Radio size={10} className="animate-pulse" /> Neural Ingest</div>
                    <h2 className={`text-2xl font-black italic tracking-tighter uppercase leading-tight line-clamp-2 ${themeConfig.text} ${fontClass}`}>{channel.title}</h2>
                    <p className={`${themeConfig.secondaryText} text-[10px] mt-2 font-black uppercase tracking-widest`}>@{channel.author}</p>
                </div>

                <div className="flex-1 flex flex-col justify-end px-10 overflow-hidden relative">
                    <div className="max-h-[80%] overflow-y-auto space-y-12 py-20 scrollbar-hide mask-fade-edges">
                        {transcriptHistory.map((item) => {
                            const isCurrent = item.id === activeTranscriptId;
                            const isSystem = item.speaker === 'System';
                            return (
                                <div 
                                    key={item.id} 
                                    ref={el => { transcriptRefs.current[item.id] = el; }}
                                    className={`flex flex-col transition-all duration-1000 ease-out ${isCurrent ? 'opacity-100 scale-100' : 'opacity-40 scale-95'}`}
                                >
                                    <span className={`text-[9px] font-black uppercase tracking-[0.3em] mb-4 ${isCurrent ? themeConfig.accent : themeConfig.secondaryText}`}>{item.speaker}</span>
                                    <div 
                                        className={`leading-[1.15] transition-all duration-500 ${fontClass}`}
                                    >
                                        <MarkdownView 
                                            content={item.text} 
                                            compact={true} 
                                            fontSize={fontSize}
                                            initialTheme={theme === 'parchment' ? 'light' : theme === 'matrix' ? 'dark' : 'slate'} 
                                            showThemeSwitcher={false}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="h-16 w-full flex items-center justify-center py-4 shrink-0">
                        {playbackState === 'buffering' ? (
                            <div className="flex flex-col items-center gap-2"><Loader2 className={`animate-spin ${themeConfig.accent}`} size={16}/><span className={`text-[8px] font-black uppercase tracking-widest ${themeConfig.secondaryText}`}>{statusMessage}</span></div>
                        ) : (
                            <div className="w-1/2 h-full"><Visualizer volume={isActive && !isPaused ? liveVolume : 0} isActive={playbackState === 'playing' && !isPaused} color={theme === 'matrix' ? '#10b981' : theme === 'parchment' ? '#6366f1' : '#818cf8'} /></div>
                        )}
                    </div>
                </div>

                {isAutoplayBlocked && (
                    <div className="px-10 py-2 flex flex-col gap-3 shrink-0">
                        <button onClick={handleRetryUnmute} className="w-full py-5 bg-white text-slate-950 font-black uppercase tracking-[0.2em] rounded-3xl shadow-[0_20px_50px_rgba(255,255,255,0.2)] animate-pulse flex items-center justify-center gap-3 text-sm">
                            <Volume2 size={20}/> Initialize Neural Link
                        </button>
                    </div>
                )}
            </div>

            <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-8 items-center">
                <div className="flex flex-col gap-3 items-center mb-4">
                    <button onClick={handleTogglePause} className={`p-3 bg-slate-900/60 backdrop-blur-xl rounded-full border border-white/10 transition-all shadow-2xl ${isPaused ? 'bg-indigo-600 border-indigo-400 animate-pulse' : 'hover:bg-indigo-600'}`}>
                        {isPaused ? <Play size={20} fill="currentColor"/> : <Pause size={20} fill="currentColor"/>}
                    </button>
                    <button onClick={handleReplay} className="p-3 bg-slate-900/60 backdrop-blur-xl rounded-full border border-white/10 hover:bg-amber-600 transition-all shadow-2xl">
                        <RotateCcw size={20} />
                    </button>
                </div>
                
                <button onClick={handleLike} className="flex flex-col items-center gap-1.5 group">
                    <div className={`p-3 bg-slate-900/60 backdrop-blur-xl rounded-full border border-white/10 transition-all shadow-2xl ${isLiked ? 'bg-red-600 border-red-500 scale-110' : 'hover:bg-red-600'}`}>
                        <Heart size={24} className="text-white" fill={isLiked ? 'currentColor' : 'none'} />
                    </div>
                    <span className="text-[10px] font-black text-white drop-shadow-2xl">{channel.likes}</span>
                </button>
                <button onClick={handleBookmark} className="flex flex-col items-center gap-1.5 group">
                    <div className={`p-3 bg-slate-900/60 backdrop-blur-xl rounded-full border border-white/10 transition-all shadow-2xl ${isBookmarked ? 'bg-amber-500 border-amber-400 scale-110' : 'hover:bg-amber-500'}`}>
                        <Bookmark size={24} className="text-white" fill={isBookmarked ? "currentColor" : "none"} />
                    </div>
                </button>
                <button onClick={(e) => { e.stopPropagation(); onCommentClick?.(channel); }} className="flex flex-col items-center gap-1.5 group">
                    <div className="p-3 bg-slate-900/60 backdrop-blur-xl rounded-full border border-white/10 hover:bg-indigo-600 transition-all shadow-2xl">
                        <MessageSquare size={24} className="text-white" />
                    </div>
                    <span className="text-[10px] font-black text-white drop-shadow-2xl">{channel.comments.length}</span>
                </button>
                <button onClick={() => onChannelClick(channel.id)} className="p-3 bg-slate-900/60 backdrop-blur-xl rounded-full border border-white/10 hover:bg-emerald-600 transition-all shadow-2xl">
                    <AlignLeft size={24} className="text-white" />
                </button>
            </div>
        </div>
    );
};

export const PodcastFeed: React.FC<PodcastFeedProps> = ({ 
  channels, onChannelClick, onStartLiveSession, userProfile, globalVoice, onRefresh, currentUser, setChannelToEdit, setIsSettingsModalOpen, onCommentClick, handleVote, handleBookmarkToggle, searchQuery, setSearchQuery, onNavigate, onUpdateChannel, onOpenPricing, language, t, onMagicCreate, onOpenManual
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'mobile'>(() => window.innerWidth < 768 ? 'mobile' : 'grid');
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
            c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.author.toLowerCase().includes(q)
        );
    }
    if (activeCategory !== 'All') filtered = filtered.filter(c => c.tags.includes(activeCategory));

    return [...filtered].sort((a, b) => {
        const aVal = a[sortConfig.key] ?? 0;
        const bVal = b[sortConfig.key] ?? 0;
        if (aVal === bVal) return 0;
        const multiplier = sortConfig.direction === 'asc' ? 1 : -1;
        return aVal < bVal ? -1 * multiplier : 1 * multiplier;
    });
  }, [channels, sortConfig, searchQuery, activeCategory]);

  const handleSort = (key: SortKey) => {
      setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc' }));
  };

  const [activeMobileIndex, setActiveMobileIndex] = useState(0);

  const handleMobileFinish = useCallback(() => {
    if (viewMode !== 'mobile' || !mobileContainerRef.current) return;
    const nextIndex = activeMobileIndex + 1;
    if (nextIndex < sortedChannels.length) {
        mobileContainerRef.current.scrollTo({ top: nextIndex * mobileContainerRef.current.clientHeight, behavior: 'smooth' });
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
            <div className="absolute top-4 left-4 z-[110]">
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
                        onUpdateChannel={onUpdateChannel}
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
