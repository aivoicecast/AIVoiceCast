import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Channel, UserProfile, GeneratedLecture } from '../types';
import { Play, MessageSquare, Heart, Share2, Bookmark, Music, Plus, Pause, Loader2, Volume2, VolumeX, GraduationCap, ChevronRight, Mic, AlignLeft, BarChart3, User, AlertCircle, Zap, Radio, Square, Sparkles, LayoutGrid, List, SearchX, Activity, Video, Terminal, RefreshCw, Scroll, Lock, Crown } from 'lucide-react';
import { ChannelCard } from './ChannelCard';
import { CreatorProfileModal } from './CreatorProfileModal';
import { PodcastListTable, SortKey } from './PodcastListTable';
import { followUser, unfollowUser, isUserAdmin } from '../services/firestoreService';
import { generateLectureScript } from '../services/lectureGenerator';
import { generateCurriculum } from '../services/curriculumGenerator';
import { synthesizeSpeech } from '../services/tts';
import { getCachedLectureScript, cacheLectureScript, getUserChannels } from '../utils/db';
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
  onNavigate?: (view: string) => void;
  onOpenPricing?: () => void;
}

const MobileFeedCard = ({ channel, isActive, onToggleLike, isLiked, isBookmarked, isFollowed, onToggleBookmark, onToggleFollow, onShare, onComment, onProfileClick, onChannelClick, onChannelFinish }: any) => {
    const MY_TOKEN = useMemo(() => `MobileFeed:${channel.id}`, [channel.id]);
    const [playbackState, setPlaybackState] = useState<'idle' | 'buffering' | 'playing' | 'error'>('idle');
    const [statusMessage, setStatusMessage] = useState('');
    const [transcriptHistory, setTranscriptHistory] = useState<{speaker: string, text: string, id: string}[]>([]);
    const [activeTranscriptId, setActiveTranscriptId] = useState<string | null>(null);
    const [isAutoplayBlocked, setIsAutoplayBlocked] = useState(false);
    const [provider, setProvider] = useState<'system' | 'gemini' | 'openai'>(() => !!(localStorage.getItem('openai_api_key') || process.env.OPENAI_API_KEY) ? 'openai' : 'system');
    const [trackIndex, setTrackIndex] = useState(-1); 
    const mountedRef = useRef(true);
    const isLoopingRef = useRef(false);
    const localSessionIdRef = useRef(0);
    const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const transcriptScrollRef = useRef<HTMLDivElement>(null);

    const stopAudioInternal = useCallback(() => { localSessionIdRef.current++; isLoopingRef.current = false; if (window.speechSynthesis) window.speechSynthesis.cancel(); activeSourcesRef.current.forEach(s => { s.stop(); s.disconnect(); }); activeSourcesRef.current.clear(); setPlaybackState('idle'); setStatusMessage(""); }, []);

    useEffect(() => {
        if (isActive) {
            const introText = channel.welcomeMessage || channel.description || `Welcome.`;
            setTranscriptHistory([{ speaker: 'Host', text: introText, id: 'intro' }]);
            setActiveTranscriptId('intro');
            const ctx = getGlobalAudioContext();
            if (ctx.state === 'suspended') setIsAutoplayBlocked(true);
            else setTimeout(() => { if (isActive && mountedRef.current) runTrackSequence(-1, ++localSessionIdRef.current, registerAudioOwner(MY_TOKEN, stopAudioInternal)); }, 400);
        } else stopAudioInternal();
    }, [isActive, MY_TOKEN, stopAudioInternal]);

    const runTrackSequence = async (startIndex: number, localSessionId: number, targetGen: number) => {
        isLoopingRef.current = true; setPlaybackState('playing'); let currentIndex = startIndex;
        while (mountedRef.current && localSessionId === localSessionIdRef.current) {
            setTrackIndex(currentIndex);
            let text = currentIndex === -1 ? (channel.welcomeMessage || channel.description) : "Synthesizing...";
            setTranscriptHistory(prev => [...prev, { speaker: 'AI', text, id: `track-${currentIndex}` }]);
            setActiveTranscriptId(`track-${currentIndex}`);
            await new Promise(r => setTimeout(r, 2000));
            currentIndex++;
            if (currentIndex > 5) break;
        }
    };

    return (
        <div className="h-full w-full snap-start relative flex flex-col justify-center bg-slate-900 border-b border-slate-800 overflow-hidden">
            <div className="absolute inset-0 bg-slate-950"></div>
            <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/10 via-transparent to-black/90"></div>
            <div className="relative z-10 p-10 text-center space-y-6">
                <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">{channel.title}</h2>
                <div className="flex justify-center"><button onClick={() => onChannelClick(channel.id)} className="px-10 py-3 bg-indigo-600 text-white rounded-full font-black uppercase tracking-widest shadow-xl active:scale-95">Open Channel</button></div>
            </div>
        </div>
    );
};

export const PodcastFeed: React.FC<PodcastFeedProps> = ({ 
  channels, onChannelClick, onStartLiveSession, userProfile, globalVoice, currentUser, t, onCommentClick, handleVote, searchQuery = '', onNavigate, onOpenPricing, onUpdateChannel
}) => {
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 768 : true);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey, direction: 'asc' | 'desc' }>({ key: 'likes', direction: 'desc' });
  
  const isSuperAdmin = useMemo(() => currentUser && (currentUser.email === 'shengliang.song.ai@gmail.com' || isUserAdmin(userProfile)), [userProfile, currentUser]);
  const isProMember = useMemo(() => isSuperAdmin || userProfile?.subscriptionTier === 'pro', [userProfile, isSuperAdmin]);

  useEffect(() => { const handleResize = () => setIsDesktop(window.innerWidth >= 768); window.addEventListener('resize', handleResize); return () => window.removeEventListener('resize', handleResize); }, []);

  const handleProtectedNavigate = (view: string) => {
      if (!isProMember) { 
          if (onOpenPricing) onOpenPricing(); 
          return; 
      }
      if (onNavigate) onNavigate(view);
  };

  const handleSort = (key: SortKey) => {
      setSortConfig(prev => ({
          key,
          direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
      }));
  };

  const sortedChannels = useMemo(() => {
      const q = searchQuery.toLowerCase();
      let filtered = channels.filter(c => c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
      
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

  if (isDesktop) {
      return (
        <div className="h-full overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-800">
            <div className="max-w-7xl mx-auto space-y-8">
                <div className="space-y-4 animate-fade-in-up">
                    <div className="flex items-center justify-between px-2"><h3 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em]">Specialized AI Intelligence Suite</h3></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { id: 'bible_study', label: 'Scripture', sub: 'Neural Sanctuary', icon: Scroll, color: 'text-amber-400', bg: 'bg-amber-950/40' },
                            { id: 'graph_studio', label: 'Neural Graph', sub: 'Visual Math', icon: Activity, color: 'text-emerald-400', bg: 'bg-emerald-950/40' },
                            { id: 'mock_interview', label: 'Mock Interview', sub: 'Career Eval', icon: Video, color: 'text-red-500', bg: 'bg-red-950/40' },
                            { id: 'code_studio', label: 'Builder Studio', sub: 'Cloud Engineering', icon: Terminal, color: 'text-indigo-400', bg: 'bg-indigo-950/40' }
                        ].map(app => (
                            <button key={app.id} onClick={() => handleProtectedNavigate(app.id)} className="flex items-center gap-4 p-5 bg-slate-900 border border-slate-800 rounded-2xl hover:border-indigo-500/50 hover:bg-indigo-900/10 transition-all text-left group shadow-xl relative overflow-hidden">
                                {!isProMember && (
                                    <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-[1px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                        <div className="bg-amber-500 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase shadow-lg flex items-center gap-1">
                                            <Crown size={10} fill="currentColor"/> Upgrade to Unlock
                                        </div>
                                    </div>
                                )}
                                {!isProMember && <div className="absolute top-3 right-3 text-slate-700 group-hover:text-indigo-400 transition-colors"><Lock size={12}/></div>}
                                <div className={`p-3 ${app.bg} rounded-xl border border-white/5 ${app.color} group-hover:scale-110 transition-transform`}><app.icon size={24}/></div>
                                <div><h4 className="font-bold text-white group-hover:text-indigo-400 transition-colors">{app.label}</h4><p className="text-[10px] text-slate-500 uppercase font-black">{app.sub}</p></div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex justify-between items-center pt-4">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2"><span className="bg-indigo-600 w-2 h-8 rounded-full"></span> Knowledge Registry</h2>
                </div>
                
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
    <div className="h-[calc(100vh-64px)] w-full bg-black overflow-y-scroll snap-y snap-mandatory no-scrollbar relative">
        {sortedChannels.map((channel) => (
            <div key={channel.id} data-id={channel.id} className="h-full w-full snap-start">
                <MobileFeedCard channel={channel} isActive={true} onChannelClick={onChannelClick} />
            </div>
        ))}
    </div>
  );
};