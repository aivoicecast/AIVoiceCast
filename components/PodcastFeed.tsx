// Fixed: Wrapped named React hooks in curly braces for correct ES6 module import.
import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Channel, UserProfile, GeneratedLecture } from '../types';
import { Play, MessageSquare, Heart, Share2, Bookmark, Music, Plus, Pause, Loader2, Volume2, VolumeX, GraduationCap, ChevronRight, Mic, AlignLeft, BarChart3, User, AlertCircle, Zap, Radio, Square, Sparkles, LayoutGrid, List, SearchX, Activity, Video, Terminal, RefreshCw, Scroll, Lock, Crown, Settings2, Globe, Cpu, Speaker, Search, X } from 'lucide-react';
import { ChannelCard } from './ChannelCard';
import { CreatorProfileModal } from './CreatorProfileModal';
// Fixed typo: removed ')' from 'PodcastListTable' import
import { PodcastListTable, SortKey } from './PodcastListTable';
import { followUser, unfollowUser, isUserAdmin } from '../services/firestoreService';
import { generateLectureScript } from '../services/lectureGenerator';
import { generateCurriculum } from '../services/curriculumGenerator';
import { synthesizeSpeech } from '../services/tts';
import { getCachedLectureScript, cacheLectureScript, getUserChannels } from '../utils/db';
import { SPOTLIGHT_DATA } from '../utils/spotlightContent';
import { OFFLINE_CHANNEL_ID, OFFLINE_CURRICULUM, OFFLINE_LECTURES } from '../utils/offlineContent';
import { warmUpAudioContext, getGlobalAudioContext, stopAllPlatformAudio, registerAudioOwner, logAudioEvent, isAudioOwner, getGlobalAudioGeneration } from '../utils/audioUtils';
import { Visualizer } from './Visualizer';

interface PodcastFeedProps {
  channels: Channel[];
  onChannelClick: (id: string) => void;
  onStartLiveSession: (channel: Channel) => void; 
  userProfile: UserProfile | null;
  globalVoice: string;
  onRefresh?: () => void;
  onMessageCreator?: (creatorId: string, creatorName: string) => void;
  onUpdateChannel?: (updated: Channel) => Promise<void>;
  
  t?: any;
  currentUser?: any;
  setChannelToEdit?: (channel: Channel) => void;
  setIsSettingsModalOpen?: (open: boolean) => void;
  onCommentClick?: (channel: Channel) => void;
  handleVote?: (id: string, type: 'like' | 'dislike', e: React.MouseEvent) => void;
  
  filterMode?: 'foryou' | 'following' | 'mine';
  isFeedActive?: boolean; 
  searchQuery?: string;
  setSearchQuery?: (q: string) => void;
  onNavigate?: (view: string) => void;
  onOpenPricing?: () => void;
  language?: 'en' | 'zh';
}

const MobileFeedCard = ({ channel, isActive, onChannelClick, language }: any) => {
    const MY_TOKEN = useMemo(() => `MobileFeed:${channel.id}`, [channel.id]);
    const [playbackState, setPlaybackState] = useState<'idle' | 'buffering' | 'playing' | 'error'>('idle');
    const [statusMessage, setStatusMessage] = useState('');
    const [lastError, setLastError] = useState<string | null>(null);
    const [ttsProvider, setTtsProvider] = useState<'gemini' | 'openai' | 'system'>('gemini');
    const [showTtsMenu, setshowTtsMenu] = useState(false);
    
    const [transcriptHistory, setTranscriptHistory] = useState<{speaker: string, text: string, id: string}[]>([]);
    const [activeTranscriptId, setActiveTranscriptId] = useState<string | null>(null);
    const [isAutoplayBlocked, setIsAutoplayBlocked] = useState(false);
    
    const mountedRef = useRef(true);
    const localSessionIdRef = useRef(0);
    const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const transcriptScrollRef = useRef<HTMLDivElement>(null);

    const stopAudioInternal = useCallback(() => { 
        localSessionIdRef.current++; 
        if (window.speechSynthesis) window.speechSynthesis.cancel(); 
        activeSourcesRef.current.forEach(s => { try { s.stop(); s.disconnect(); } catch(e) {} }); 
        activeSourcesRef.current.clear(); 
        setPlaybackState('idle'); 
        setStatusMessage(""); 
        setLastError(null);
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            stopAudioInternal();
        };
    }, [stopAudioInternal]);

    const runPlaybackSequence = async (localSessionId: number, targetGen: number) => {
        if (!mountedRef.current || localSessionId !== localSessionIdRef.current) return;
        
        const ctx = getGlobalAudioContext();
        setPlaybackState('playing');
        setLastError(null);
        
        try {
            // 1. Play Welcome Message
            const welcomeText = channel.welcomeMessage || channel.description || "Welcome to this neural channel.";
            setTranscriptHistory([{ speaker: 'Host', text: welcomeText, id: 'intro' }]);
            setActiveTranscriptId('intro');
            
            const introRes = await synthesizeSpeech(welcomeText, channel.voiceName, ctx, ttsProvider);
            if (introRes.errorMessage) {
                setLastError(`Intro Error: ${introRes.errorMessage}`);
            }

            if (introRes.buffer && mountedRef.current && localSessionId === localSessionIdRef.current) {
                await new Promise<void>((resolve) => {
                    const source = ctx.createBufferSource();
                    source.buffer = introRes.buffer;
                    source.connect(ctx.destination);
                    activeSourcesRef.current.add(source);
                    source.onended = () => { activeSourcesRef.current.delete(source); resolve(); };
                    source.start(0);
                });
            }

            // 2. Generation Phase
            setPlaybackState('buffering');
            setStatusMessage("Refracting Lecture...");
            
            let lecture: GeneratedLecture | null = null;
            const firstSubTopic = channel.chapters?.[0]?.subTopics?.[0];
            const cacheKey = `lecture_${channel.id}_${firstSubTopic?.id || 'default'}_${language || 'en'}`;
            
            const cached = await getCachedLectureScript(cacheKey);
            if (cached) {
                lecture = cached;
            } else {
                const topic = firstSubTopic?.title || channel.title;
                lecture = await generateLectureScript(topic, channel.description, language || 'en', channel.id, channel.voiceName);
                if (lecture) await cacheLectureScript(cacheKey, lecture);
            }

            if (!lecture || !mountedRef.current || localSessionId !== localSessionIdRef.current) {
                if (!lecture) throw new Error("Could not refract lecture script. Check API quota.");
                return;
            }

            // --- DISPLAY LECTURE CONTENT FIRST ---
            // Populate the entire transcript history as soon as the script is available
            const fullTranscript = [
                { speaker: 'Host', text: welcomeText, id: 'intro' },
                ...lecture.sections.map((s, i) => ({
                    speaker: s.speaker === 'Teacher' ? (lecture!.professorName || 'Host') : (lecture!.studentName || 'Guest'),
                    text: s.text,
                    id: `section-${i}`
                }))
            ];
            setTranscriptHistory(fullTranscript);

            // 3. Sequential Audio Sections
            setPlaybackState('playing');
            setStatusMessage("");
            
            for (let i = 0; i < lecture.sections.length; i++) {
                if (!mountedRef.current || localSessionId !== localSessionIdRef.current || targetGen !== getGlobalAudioGeneration()) break;
                
                const section = lecture.sections[i];
                const voice = section.speaker === 'Teacher' ? channel.voiceName : 'Zephyr';
                const sid = `section-${i}`;
                
                setActiveTranscriptId(sid);
                setPlaybackState('buffering');
                
                const res = await synthesizeSpeech(section.text, voice, ctx, ttsProvider);
                setPlaybackState('playing');
                
                if (res.errorMessage) {
                    setLastError(`Sync Error: ${res.errorMessage}`);
                }

                if (res.buffer && mountedRef.current && localSessionId === localSessionIdRef.current) {
                    await new Promise<void>((resolve) => {
                        const source = ctx.createBufferSource();
                        source.buffer = res.buffer;
                        source.connect(ctx.destination);
                        activeSourcesRef.current.add(source);
                        source.onended = () => { activeSourcesRef.current.delete(source); resolve(); };
                        source.start(0);
                    });
                }
                
                await new Promise(r => setTimeout(r, 600));
            }
        } catch (e: any) {
            console.error("Sequence Error", e);
            setPlaybackState('error');
            setLastError(e.message || "Unknown neural processing error.");
        } finally {
            if (localSessionId === localSessionIdRef.current) {
                setPlaybackState('idle');
            }
        }
    };

    useEffect(() => {
        if (isActive) {
            const ctx = getGlobalAudioContext();
            if (ctx.state === 'suspended') {
                setIsAutoplayBlocked(true);
            } else {
                setIsAutoplayBlocked(false);
                const targetGen = registerAudioOwner(MY_TOKEN, stopAudioInternal);
                runPlaybackSequence(++localSessionIdRef.current, targetGen);
            }
        } else {
            stopAudioInternal();
        }
    }, [isActive, MY_TOKEN, stopAudioInternal, channel.id, language, ttsProvider]);

    const handleRetryUnmute = async () => {
        const ctx = getGlobalAudioContext();
        await warmUpAudioContext(ctx);
        setIsAutoplayBlocked(false);
        const targetGen = registerAudioOwner(MY_TOKEN, stopAudioInternal);
        runPlaybackSequence(++localSessionIdRef.current, targetGen);
    };

    useEffect(() => {
        if (transcriptScrollRef.current) {
            transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
        }
    }, [transcriptHistory]);

    return (
        <div className="h-full w-full snap-start relative flex flex-col bg-slate-950 overflow-hidden">
            <div className="absolute inset-0 z-0">
                {channel.imageUrl ? (
                    <img src={channel.imageUrl} className="w-full h-full object-cover opacity-20 blur-sm" alt="" />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-900 to-indigo-950"></div>
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/60 to-slate-950"></div>
            </div>

            {/* TTS Selection Menu - Top Right */}
            <div className="absolute top-[calc(1rem+env(safe-area-inset-top))] right-4 z-50 flex flex-col items-end gap-2">
                <button 
                    onClick={() => setshowTtsMenu(!showTtsMenu)}
                    className="p-3 bg-slate-900/60 backdrop-blur-md rounded-full border border-white/10 text-white hover:bg-indigo-600 transition-all shadow-xl active:scale-95"
                    title="TTS Settings"
                >
                    {ttsProvider === 'gemini' ? <Zap size={20} className="text-indigo-400" /> : 
                     ttsProvider === 'openai' ? <Cpu size={20} className="text-emerald-400" /> : 
                     <Speaker size={20} className="text-amber-400" />}
                </button>
                
                {showTtsMenu && (
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2 animate-fade-in-up flex flex-col min-w-[140px] gap-1">
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-3 py-1">Engine Select</p>
                        <button onClick={() => { setTtsProvider('gemini'); setshowTtsMenu(false); }} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold uppercase transition-all ${ttsProvider === 'gemini' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
                            <Zap size={14}/> Gemini
                        </button>
                        <button onClick={() => { setTtsProvider('openai'); setshowTtsMenu(false); }} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold uppercase transition-all ${ttsProvider === 'openai' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
                            <Cpu size={14}/> OpenAI
                        </button>
                        <button onClick={() => { setTtsProvider('system'); setshowTtsMenu(false); }} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold uppercase transition-all ${ttsProvider === 'system' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
                            <Speaker size={14}/> System
                        </button>
                    </div>
                )}
            </div>

            <div className="relative z-10 flex-1 flex flex-col h-full pt-[calc(2.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                <div className="px-8 text-center shrink-0">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-600/20 border border-indigo-500/30 rounded-full text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4">
                        <Radio size={12} /> Neural Broadcast
                    </div>
                    <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-tight line-clamp-2">{channel.title}</h2>
                    <p className="text-slate-400 text-xs mt-2 font-medium opacity-60">@{channel.author}</p>
                </div>

                <div className="flex-1 flex flex-col justify-end px-6 overflow-hidden">
                    <div ref={transcriptScrollRef} className="max-h-[85%] overflow-y-auto space-y-4 py-4 scrollbar-hide">
                        {transcriptHistory.map((item) => (
                            <div key={item.id} className={`flex flex-col transition-all duration-500 ${item.id === activeTranscriptId ? 'opacity-100 scale-105 origin-left' : 'opacity-30 scale-100'}`}>
                                <span className={`text-[9px] font-black uppercase tracking-widest mb-1 ${item.id === activeTranscriptId ? 'text-indigo-400' : 'text-slate-600'}`}>{item.speaker}</span>
                                <p className={`text-sm leading-relaxed font-medium ${item.id === activeTranscriptId ? 'text-white' : 'text-slate-400'}`}>{item.text}</p>
                            </div>
                        ))}
                    </div>

                    <div className="h-12 w-full flex items-center justify-center py-2">
                        {playbackState === 'buffering' ? (
                            <div className="flex flex-col items-center gap-1">
                                <Loader2 className="animate-spin text-indigo-500" size={16}/>
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{statusMessage}</span>
                            </div>
                        ) : (
                            <Visualizer volume={isActive ? 0.5 : 0} isActive={playbackState === 'playing'} color="#6366f1" />
                        )}
                    </div>
                </div>

                <div className="px-8 py-6 flex flex-col gap-4 shrink-0">
                    {isAutoplayBlocked && (
                        <button 
                            onClick={handleRetryUnmute}
                            className="w-full py-4 bg-white text-slate-950 font-black uppercase tracking-widest rounded-2xl shadow-2xl animate-bounce flex items-center justify-center gap-3"
                        >
                            <Volume2 size={20}/> Tap to Unmute
                        </button>
                    )}
                    
                    {/* Error Display Area */}
                    {lastError && (
                        <div className="w-full p-3 bg-red-900/40 border border-red-500/30 rounded-xl animate-fade-in flex items-center gap-3">
                            <AlertCircle size={16} className="text-red-400 shrink-0" />
                            <p className="text-[9px] font-bold text-red-200 uppercase tracking-widest line-clamp-2">
                                System Alert: {lastError}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-6 items-center">
                <button className="flex flex-col items-center gap-1 group">
                    <div className="p-3 bg-slate-900/60 backdrop-blur-md rounded-full border border-white/10 group-hover:bg-red-600 transition-all">
                        <Heart size={24} className="text-white" />
                    </div>
                    <span className="text-[10px] font-black text-white drop-shadow-md">{channel.likes}</span>
                </button>
                <button className="flex flex-col items-center gap-1 group">
                    <div className="p-3 bg-slate-900/60 backdrop-blur-md rounded-full border border-white/10 group-hover:bg-indigo-600 transition-all">
                        <MessageSquare size={24} className="text-white" />
                    </div>
                    <span className="text-[10px] font-black text-white drop-shadow-md">{channel.comments.length}</span>
                </button>
            </div>
        </div>
    );
};

export const PodcastFeed: React.FC<PodcastFeedProps> = ({ 
  channels, onChannelClick, onStartLiveSession, userProfile, globalVoice, currentUser, t, onCommentClick, handleVote, searchQuery = '', setSearchQuery, onNavigate, onOpenPricing, onUpdateChannel, language
}) => {
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 768 : true);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey, direction: 'asc' | 'desc' }>({ key: 'likes', direction: 'desc' });
  const [activeMobileId, setActiveMobileId] = useState<string | null>(null);
  
  const isSuperAdmin = useMemo(() => currentUser && (currentUser.email === 'shengliang.song.ai@gmail.com' || isUserAdmin(userProfile)), [userProfile, currentUser]);
  const isProMember = useMemo(() => isSuperAdmin || userProfile?.subscriptionTier === 'pro', [userProfile, isSuperAdmin]);

  useEffect(() => { 
      const handleResize = () => setIsDesktop(window.innerWidth >= 768); 
      window.addEventListener('resize', handleResize); 
      return () => window.removeEventListener('resize', handleResize); 
  }, []);

  const handleSort = (key: SortKey) => {
      setSortConfig(prev => ({
          key,
          direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
      }));
  };

  const sortedChannels = useMemo(() => {
      const q = (searchQuery || '').toLowerCase();
      let filtered = channels.filter(c => 
          (c.title || '').toLowerCase().includes(q) || 
          (c.description || '').toLowerCase().includes(q)
      );
      
      return filtered.sort((a, b) => {
          let valA: any = a[sortConfig.key] || 0;
          let valB: any = b[sortConfig.key] || 0;
          
          if (typeof valA === 'string') {
              return sortConfig.direction === 'asc' 
                  ? valA.localeCompare(valB) 
                  : valB.localeCompare(valA);
          }
          
          return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
      });
  }, [channels, searchQuery, sortConfig]);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      if (isDesktop || !containerRef.current) return;
      
      observerRef.current = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
              if (entry.isIntersecting) {
                  setActiveMobileId(entry.target.getAttribute('data-id'));
              }
          });
      }, { threshold: 0.8 });

      const children = containerRef.current.children;
      for (let i = 0; i < children.length; i++) {
          observerRef.current.observe(children[i]);
      }

      return () => observerRef.current?.disconnect();
  }, [isDesktop, sortedChannels]);

  if (isDesktop) {
      return (
        <div className="h-full overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-800">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Search Bar Section */}
                <div className="animate-fade-in-up">
                    <div className="relative group max-w-2xl mx-auto">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Search size={20} className="text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                        </div>
                        <input 
                            type="text" 
                            placeholder="Search activities, lessons, or neural labs..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery?.(e.target.value)}
                            className="block w-full bg-slate-900 border border-slate-800 rounded-[2rem] pl-12 pr-12 py-5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 shadow-2xl transition-all text-lg font-medium"
                        />
                        {searchQuery && (
                            <button 
                                onClick={() => setSearchQuery?.('')}
                                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        )}
                    </div>
                </div>

                <div className="space-y-4 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                    <div className="flex items-center justify-between px-2"><h3 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em]">Specialized AI Intelligence Suite</h3></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { id: 'bible_study', label: 'Scripture', sub: 'Neural Sanctuary', icon: Scroll, color: 'text-amber-400', bg: 'bg-amber-950/40', restricted: false },
                            { id: 'graph_studio', label: 'Neural Graph', sub: 'Visual Math', icon: Activity, color: 'text-emerald-400', bg: 'bg-emerald-950/40', restricted: true },
                            { id: 'mock_interview', label: 'Mock Interview', sub: 'Career Eval', icon: Video, color: 'text-red-500', bg: 'bg-red-950/40', restricted: true },
                            { id: 'code_studio', label: 'Builder Studio', sub: 'Cloud Engineering', icon: Terminal, color: 'text-indigo-400', bg: 'bg-indigo-900/30', restricted: true }
                        ].map(app => (
                            <button 
                                key={app.id} 
                                onClick={() => isProMember ? onNavigate?.(app.id) : onOpenPricing?.()} 
                                className="flex items-center gap-4 p-5 bg-slate-900 border border-slate-800 rounded-2xl hover:border-indigo-500/50 hover:bg-indigo-900/10 transition-all text-left group shadow-xl relative overflow-hidden"
                            >
                                {!isProMember && app.restricted && (
                                    <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[4px] flex flex-col items-center justify-center z-20 transition-all group-hover:bg-slate-950/50">
                                        <div className="p-2 bg-slate-900 border border-amber-500/50 rounded-xl shadow-2xl mb-2">
                                            <Lock size={20} className="text-amber-500" />
                                        </div>
                                        <div className="bg-amber-500 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase shadow-lg flex items-center gap-1">
                                            <Crown size={10} fill="currentColor"/> Unlock Suite
                                        </div>
                                    </div>
                                )}
                                <div className={`p-3 ${app.bg} rounded-xl border border-white/5 ${app.color} group-hover:scale-110 transition-transform`}><app.icon size={24}/></div>
                                <div><h4 className="font-bold text-white group-hover:text-indigo-400 transition-colors">{app.label}</h4><p className="text-[10px] text-slate-500 uppercase font-black">{app.sub}</p></div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex justify-between items-center pt-4">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2"><span className="bg-indigo-600 w-2 h-8 rounded-full"></span> Knowledge Registry</h2>
                </div>
                
                {/* Fixed typo in PodcastListTable usage and corrected import */}
                <PodcastListTable 
                    channels={sortedChannels}
                    onChannelClick={onChannelClick}
                    sortConfig={sortConfig}
                    onSort={handleSort}
                    globalVoice={globalVoice}
                    currentUser={currentUser}
                    userProfile={userProfile}
                    onUpdateChannel={onUpdateChannel}
                />
            </div>
        </div>
      );
  }

  return (
    <div ref={containerRef} className="h-[calc(100vh-64px)] w-full bg-black overflow-y-scroll snap-y snap-mandatory no-scrollbar relative">
        {/* Mobile Search Overlay Toggle */}
        <div className="fixed top-[calc(1rem+env(safe-area-inset-top))] left-4 z-50">
            <button 
                onClick={() => {
                    const q = prompt("Search activities:", searchQuery);
                    if (q !== null) setSearchQuery?.(q);
                }}
                className="p-3 bg-slate-900/60 backdrop-blur-md rounded-full border border-white/10 text-white shadow-xl"
            >
                <Search size={20} />
            </button>
        </div>

        {sortedChannels.length === 0 ? (
            <div className="h-full w-full flex flex-col items-center justify-center bg-slate-950 p-8 text-center">
                <SearchX size={64} className="text-slate-700 mb-4 opacity-20" />
                <h3 className="text-xl font-bold text-white mb-2">No activities found</h3>
                <p className="text-sm text-slate-500 mb-8">Try adjusting your neural search filters.</p>
                <button 
                    onClick={() => setSearchQuery?.('')}
                    className="px-8 py-3 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-xl shadow-lg"
                >
                    Clear Search
                </button>
            </div>
        ) : (
            sortedChannels.map((channel) => (
                <div key={channel.id} data-id={channel.id} className="h-full w-full snap-start">
                    <MobileFeedCard 
                        channel={channel} 
                        isActive={activeMobileId === channel.id} 
                        onChannelClick={onChannelClick} 
                        language={language}
                    />
                </div>
            ))
        )}
    </div>
  );
};