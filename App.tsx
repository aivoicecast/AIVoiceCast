
import React, { useState, useEffect, useMemo, ErrorInfo, ReactNode, Component } from 'react';
import { 
  Podcast, Search, LayoutGrid, RefreshCw, 
  Home, Video, User, ArrowLeft, Play, Gift, 
  Calendar, Briefcase, Users, Disc, FileText, Code, Wand2, PenTool, Rss, Loader2, MessageSquare, AppWindow, Square, Menu, X, Shield, Plus, Rocket, Book, AlertTriangle, Terminal, Trash2, LogOut, Truck, Maximize2, Minimize2, Wallet, Sparkles, Coins, Cloud, ChevronDown, Command, Activity, BookOpen
} from 'lucide-react';

import { Channel, UserProfile, ViewState, TranscriptItem, CodeFile } from './types';

import { LiveSession } from './components/LiveSession';
import { PodcastDetail } from './components/PodcastDetail';
import { UserAuth } from './components/UserAuth';
import { CreateChannelModal } from './components/CreateChannelModal';
import { VoiceCreateModal } from './components/VoiceCreateModal';
import { StudioMenu } from './components/StudioMenu';
import { ChannelSettingsModal } from './components/ChannelSettingsModal';
import { CommentsModal } from './components/CommentsModal';
import { Notifications } from './components/Notifications';
import { GroupManager } from './components/GroupManager';
import { MentorBooking } from './components/MentorBooking';
import { RecordingList } from './components/RecordingList';
import { DocumentList } from './components/DocumentList';
import { CalendarView } from './components/CalendarView';
import { PodcastFeed } from './components/PodcastFeed'; 
import { MissionManifesto } from './components/MissionManifesto';
import { CodeStudio } from './components/CodeStudio';
import { Whiteboard } from './components/Whiteboard';
import { BlogView } from './components/BlogView';
import { WorkplaceChat } from './components/WorkplaceChat';
import { LoginPage } from './components/LoginPage'; 
import { SettingsModal } from './components/SettingsModal'; 
import { PricingModal } from './components/PricingModal'; 
import { CareerCenter } from './components/CareerCenter';
import { UserManual } from './components/UserManual'; 
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { NotebookViewer } from './components/NotebookViewer'; 
import { CardWorkshop } from './components/CardWorkshop';
import { CardExplorer } from './components/CardExplorer';
import { IconGenerator } from './components/IconGenerator';
import { ShippingLabelApp } from './components/ShippingLabelApp';
import { CheckDesigner } from './components/CheckDesigner';
import { FirestoreInspector } from './components/FirestoreInspector';
import { BrandLogo } from './components/BrandLogo';
import { CoinWallet } from './components/CoinWallet';
import { MockInterview } from './components/MockInterview';
import { GraphStudio } from './components/GraphStudio';
import { ProjectStory } from './components/ProjectStory';

import { getCurrentUser, getDriveToken } from './services/authService';
import { auth, db } from './services/firebaseConfig';
import { onAuthStateChanged } from '@firebase/auth';
import { onSnapshot, doc } from '@firebase/firestore';
import { ensureCodeStudioFolder, loadAppStateFromDrive, saveAppStateToDrive } from './services/googleDriveService';
import { getUserChannels, saveUserChannel } from './utils/db';
import { HANDCRAFTED_CHANNELS } from './utils/initialData';
import { stopAllPlatformAudio } from './utils/audioUtils';
import { subscribeToPublicChannels, voteChannel, addCommentToChannel, deleteCommentFromChannel, updateCommentInChannel, getUserProfile, claimCoinCheck, syncUserProfile, publishChannelToFirestore, isUserAdmin } from './services/firestoreService';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };
  declare props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState { 
    return { hasError: true, error }; 
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) { 
    console.error("Uncaught runtime error:", error, errorInfo); 
  }
  
  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
          <div className="max-w-2xl w-full bg-slate-900 border border-red-500/50 rounded-3xl p-8 shadow-2xl animate-fade-in-up">
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-6 border border-red-500/20">
              <AlertTriangle className="text-red-500" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Application Crash Detected</h1>
            <p className="text-slate-400 mb-6">A runtime error occurred in the UI component tree.</p>
            <div className="bg-black/50 rounded-xl p-4 font-mono text-xs text-red-300 overflow-x-auto border border-slate-800">
              {this.state.error?.toString()}
            </div>
            <div className="flex gap-4 mt-8">
              <button onClick={() => window.location.reload()} className="flex-1 bg-white text-slate-950 font-bold py-3 rounded-xl hover:bg-slate-200 transition-colors">Reload Application</button>
              <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="flex-1 bg-slate-800 text-white font-bold py-3 rounded-xl hover:bg-slate-700 transition-colors">Clear Cache & Reset</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const UI_TEXT = {
  en: {
    appTitle: "Neural Prism",
    directory: "Explore Hub", 
    myFeed: "Personal Stream",
    live: "Interactive Studio",
    search: "Search for activities...",
    create: "Craft Tool",
    magic: "Neural Magic",
    host: "Guide",
    featured: "Spotlight",
    categories: "Activities",
    all: "All Experience",
    calendar: "Schedule",
    mentorship: "Experts",
    groups: "Communities",
    recordings: "Recordings",
    docs: "Paperwork",
    lectures: "Guided Learning",
    podcasts: "Knowledge Hub",
    mission: "Vision & Prism",
    code: "Builder Studio",
    whiteboard: "Visual Canvas",
    blog: "Community Voice",
    chat: "Team Space",
    careers: "Talent Hub",
    notebooks: "Research Lab",
    cards: "Gift Workshop",
    icons: "Brand Lab",
    shipping: "Logistics Lab",
    checks: "Finance Lab",
    fullscreen: "Toggle Immersion",
    wallet: "Neural Assets",
    mockInterview: "Career Prep",
    graph: "Logic Visualizer",
    story: "Project Story"
  },
  zh: {
    appTitle: "神经棱镜",
    directory: "探索中心",
    myFeed: "个人动态",
    live: "互动空间",
    search: "搜索活动...",
    create: "创建工具",
    magic: "神经魔法",
    host: "向导",
    featured: "焦点",
    categories: "活动分类",
    all: "全部体验",
    calendar: "日程安排",
    mentorship: "专家导师",
    groups: "社区群组",
    recordings: "录音存档",
    docs: "文档空间",
    lectures: "引导式学习",
    podcasts: "知识中心",
    mission: "愿景与棱镜",
    code: "构建者工作室",
    whiteboard: "视觉画布",
    blog: "社区声音",
    chat: "团队空间",
    careers: "人才中心",
    notebooks: "研究实验室",
    cards: "礼物工坊",
    icons: "品牌实验室",
    shipping: "物流实验室",
    checks: "财务实验室",
    fullscreen: "沉浸模式",
    wallet: "神经资产",
    mockInterview: "职业准备",
    graph: "逻辑可视化",
    story: "项目故事"
  }
};

const App: React.FC = () => {
  const [language, setLanguage] = useState<'en' | 'zh'>('en');
  const t = UI_TEXT[language];
  
  const getInitialView = (): ViewState => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    if (params.get('claim') || params.get('pay')) return 'coin_wallet'; 
    if (view === 'card' && params.get('id')) return 'card_workshop';
    if (view === 'icon' && params.get('id')) return 'icon_generator';
    if (view === 'shipping' && params.get('id')) return 'shipping_viewer';
    if (view === 'check' && params.get('id')) return 'check_viewer';
    if (view === 'notebook_viewer' && params.get('id')) return 'notebook_viewer';
    if (view === 'careers' && params.get('id')) return 'careers';
    return (view as any) || 'directory';
  };

  const [viewState, setViewState] = useState<ViewState>(getInitialView());
  const [activeChannelId, setActiveChannelId] = useState<string | null>(() => {
      return new URLSearchParams(window.location.search).get('channelId');
  });
  const [activeItemId, setActiveItemId] = useState<string | null>(() => {
      return new URLSearchParams(window.location.search).get('id');
  });
  
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isAppsMenuOpen, setIsAppsMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isDriveSyncing, setIsDriveSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [publicChannels, setPublicChannels] = useState<Channel[]>([]);
  const [userChannels, setUserChannels] = useState<Channel[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createModalInitialDate, setCreateModalInitialDate] = useState<Date | null>(null);
  const [isVoiceCreateOpen, setIsVoiceCreateOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [globalVoice, setGlobalVoice] = useState('Auto');
  const [channelToComment, setChannelToComment] = useState<Channel | null>(null);
  const [channelToEdit, setChannelToEdit] = useState<Channel | null>(null);
  const [initialStudioFiles, setInitialStudioFiles] = useState<CodeFile[]>([]);

  // Memoized Admin Status with Strict Developer Email Bypass
  const isSuperAdmin = useMemo(() => {
      if (!currentUser) return false;
      // 1. Hardcoded Owner Bypass (The Ultimate Root)
      const ownerEmails = ['shengliang.song.ai@gmail.com'];
      if (ownerEmails.includes(currentUser.email)) return true;
      // 2. Check Firestore Profile (Group Membership admin_neural_prism)
      if (isUserAdmin(userProfile)) return true;
      // 3. Local Override for debugging
      if (localStorage.getItem('debug_admin_override') === 'true') return true;
      return false;
  }, [userProfile, currentUser]);

  const [liveSessionParams, setLiveSessionParams] = useState<{
    channel: Channel;
    context?: string;
    recordingEnabled?: boolean;
    videoEnabled?: boolean;
    cameraEnabled?: boolean;
    bookingId?: string;
    activeSegment?: { index: number, lectureId: string };
    initialTranscript?: TranscriptItem[];
    existingDiscussionId?: string;
    returnTo?: ViewState;
  } | null>(null);

  const allApps = useMemo(() => {
    const baseApps = [
        { id: 'podcasts', label: t.podcasts, icon: Podcast, action: () => { handleSetViewState('directory'); }, color: 'text-indigo-400' },
        { id: 'mock_interview', label: t.mockInterview, icon: Video, action: () => handleSetViewState('mock_interview'), color: 'text-red-500' },
        { id: 'graph_studio', label: t.graph, icon: Activity, action: () => handleSetViewState('graph_studio'), color: 'text-emerald-400' },
        { id: 'wallet', label: t.wallet, icon: Coins, action: () => handleSetViewState('coin_wallet'), color: 'text-amber-400' },
        { id: 'docs', label: t.docs, icon: FileText, action: () => handleSetViewState('docs'), color: 'text-emerald-400' },
        { id: 'check_designer', label: t.checks, icon: Wallet, action: () => handleSetViewState('check_designer'), color: 'text-orange-400' },
        { id: 'chat', label: t.chat, icon: MessageSquare, action: () => handleSetViewState('chat'), color: 'text-blue-400' },
        { id: 'mentorship', label: t.mentorship, icon: Briefcase, action: () => handleSetViewState('mentorship'), color: 'text-emerald-400' },
        { id: 'shipping_labels', label: t.shipping, icon: Truck, action: () => handleSetViewState('shipping_labels'), color: 'text-emerald-400' },
        { id: 'icon_lab', label: t.icons, icon: AppWindow, action: () => handleSetViewState('icon_generator'), color: 'text-cyan-400' },
        { id: 'code_studio', label: t.code, icon: Code, action: () => handleSetViewState('code_studio'), color: 'text-blue-400' },
        { id: 'notebook_viewer', label: t.notebooks, icon: Book, action: () => handleSetViewState('notebook_viewer'), color: 'text-orange-300' },
        { id: 'whiteboard', label: t.whiteboard, icon: PenTool, action: () => handleSetViewState('whiteboard'), color: 'text-pink-400' },
        { id: 'groups', label: t.groups, icon: Users, action: () => handleSetViewState('groups'), color: 'text-purple-400' },
        { id: 'recordings', label: t.recordings, icon: Disc, action: () => handleSetViewState('recordings'), color: 'text-red-400' },
        { id: 'calendar', label: t.calendar, icon: Calendar, action: () => handleSetViewState('calendar'), color: 'text-emerald-400' },
        { id: 'careers', label: t.careers, icon: Briefcase, action: () => handleSetViewState('careers'), color: 'text-yellow-400' },
        { id: 'blog', label: t.blog, icon: Rss, action: () => handleSetViewState('blog'), color: 'text-orange-400' },
        { id: 'card_workshop', label: t.cards, icon: Gift, action: () => handleSetViewState('card_workshop'), color: 'text-red-400' },
        { id: 'mission', label: t.mission, icon: Rocket, action: () => handleSetViewState('mission'), color: 'text-orange-500' },
        { id: 'story', label: t.story, icon: BookOpen, action: () => handleSetViewState('story'), color: 'text-cyan-400' },
    ];

    if (isSuperAdmin) {
        baseApps.push({ 
            id: 'firestore_debug', 
            label: 'Admin Inspector', 
            icon: Terminal, 
            action: () => handleSetViewState('firestore_debug'), 
            color: 'text-red-500' 
        });
    }

    return baseApps;
  }, [t, isSuperAdmin]);

  const handleSetViewState = (newState: ViewState, params: Record<string, string> = {}) => {
    stopAllPlatformAudio(`NavigationTransition:${viewState}->${newState}`);
    setViewState(newState);
    setIsAppsMenuOpen(false);
    setIsUserMenuOpen(false);
    const url = new URL(window.location.href);
    if (newState === 'directory') url.searchParams.delete('view');
    else url.searchParams.set('view', newState as string);
    Object.keys(params).forEach(k => url.searchParams.set(k, params[k]));
    if (!params.channelId) url.searchParams.delete('channelId');
    if (!params.id) url.searchParams.delete('id');
    window.history.replaceState({}, '', url.toString());
  };

  const handleStartLiveSession = (channel: Channel, context?: string, recordingEnabled?: boolean, bookingId?: string, videoEnabled?: boolean, cameraEnabled?: boolean, activeSegment?: { index: number, lectureId: string }, initialTranscript?: TranscriptItem[], existingDiscussionId?: string) => {
    setLiveSessionParams({ channel, context, recordingEnabled, videoEnabled, cameraEnabled, bookingId, activeSegment, initialTranscript, existingDiscussionId, returnTo: viewState });
    handleSetViewState('live_session');
  };

  useEffect(() => {
    if (currentUser?.uid && db) {
        const unsubscribeProfile = onSnapshot(doc(db, 'users', currentUser.uid), snapshot => {
            if (snapshot.exists()) setUserProfile(snapshot.data() as UserProfile);
        });
        return () => unsubscribeProfile();
    }
  }, [currentUser?.uid]);

  useEffect(() => {
    const activeAuth = auth;
    if (!activeAuth) {
        setAuthLoading(false);
        return;
    }

    const unsubscribe = onAuthStateChanged(activeAuth, async (user) => {
        if (user) {
            setCurrentUser(user);
            syncUserProfile(user).catch(console.error);
            const params = new URLSearchParams(window.location.search);
            const claimId = params.get('claim');
            if (claimId) {
                claimCoinCheck(claimId).then(amount => {
                    alert(`Check Claimed! ${amount} coins added.`);
                    const url = new URL(window.location.href);
                    url.searchParams.delete('claim');
                    window.history.replaceState({}, '', url.toString());
                }).catch(e => console.warn("Claim background fail", e));
            }
        } else {
            setCurrentUser(null);
            setUserProfile(null);
        }
        setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (currentUser) {
        const token = getDriveToken();
        if (token) {
            setIsDriveSyncing(true);
            (async () => {
                try {
                    const fid = await ensureCodeStudioFolder(token);
                    const data = await loadAppStateFromDrive(token, fid);
                    if (data && data.userChannels) {
                        setUserChannels(data.userChannels);
                        data.userChannels.forEach((ch: any) => saveUserChannel(ch));
                    }
                } catch(e) { console.warn("Lazy Drive sync failed", e); }
                finally { setIsDriveSyncing(false); }
            })();
        }
    }
  }, [currentUser]);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    const initializeChannels = async () => {
        const localChannels = await getUserChannels();
        setUserChannels(localChannels);
        const maybeUnsub = await subscribeToPublicChannels((channels) => { setPublicChannels(channels); });
        if (typeof maybeUnsub === 'function') unsub = maybeUnsub;
    };
    initializeChannels();
    return () => { if (unsub) unsub(); };
  }, []);

  const allChannels = useMemo(() => {
      const map = new Map<string, Channel>();
      HANDCRAFTED_CHANNELS.forEach(c => map.set(c.id, c));
      publicChannels.forEach(c => map.set(c.id, c));
      userChannels.forEach(c => map.set(c.id, c));
      return Array.from(map.values());
  }, [publicChannels, userChannels]);

  const handleVote = async (id: string, type: 'like' | 'dislike') => {
      const ch = allChannels.find(c => c.id === id);
      if (ch) await voteChannel(ch, type);
  };

  const handleAddComment = async (text: string, attachments: any[]) => {
      if (channelToComment && currentUser) {
          await addCommentToChannel(channelToComment.id, { id: crypto.randomUUID(), userId: currentUser.uid, user: currentUser.displayName, text, timestamp: Date.now(), attachments });
      }
  };

  const handleCreateChannel = async (newChannel: Channel) => {
      await saveUserChannel(newChannel);
      setUserChannels(prev => [newChannel, ...prev]);
      setActiveChannelId(newChannel.id);
      handleSetViewState('podcast_detail', { channelId: newChannel.id });
  };

  const handleUpdateChannel = async (updated: Channel) => {
      await saveUserChannel(updated);
      setUserChannels(prev => prev.map(c => c.id === updated.id ? updated : c));
      if (updated.visibility === 'public') {
          await publishChannelToFirestore(updated);
      }
  };

  const handleSchedulePodcast = (date: Date) => {
      setCreateModalInitialDate(date);
      setIsCreateModalOpen(true);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            document.getElementById('main-search-input')?.focus();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (authLoading) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-6">
            <BrandLogo size={80} className="animate-pulse" />
            <div className="flex flex-col items-center gap-2">
                <Loader2 className="animate-spin text-indigo-500" size={32} />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-[0.3em]">Igniting Neural Prism</span>
            </div>
        </div>
      );
  }

  const isPublicView = ['mission', 'careers', 'user_guide', 'card_workshop', 'card_viewer', 'icon_viewer', 'shipping_viewer', 'check_viewer', 'story', 'privacy', 'user_guide'].includes(viewState as string);

  if (!currentUser && !isPublicView) {
      return <LoginPage 
        onMissionClick={() => handleSetViewState('mission')} 
        onStoryClick={() => handleSetViewState('story')} 
        onPrivacyClick={() => handleSetViewState('privacy')} 
      />;
  }

  const activeChannel = allChannels.find(c => c.id === activeChannelId);

  return (
    <ErrorBoundary>
      <div className="h-screen flex flex-col bg-slate-950 text-slate-50 overflow-hidden">
        <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-4 sm:px-6 shrink-0 z-50 backdrop-blur-xl">
           <div className="flex items-center gap-3">
              <div className="relative">
                <button 
                  onClick={() => { setIsAppsMenuOpen(!isAppsMenuOpen); setIsUserMenuOpen(false); }} 
                  className={`p-1.5 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1 ${isAppsMenuOpen ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  aria-label="Activity Launcher"
                >
                  <LayoutGrid size={20} />
                  <ChevronDown size={14} className={`transition-transform duration-200 ${isAppsMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isAppsMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-[100]" onClick={() => setIsAppsMenuOpen(false)}></div>
                    <div className="absolute left-0 top-full mt-2 w-72 md:w-[480px] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up z-[110] flex flex-col border-indigo-500/20">
                      <div className="p-3 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Neural Prism Tools ({allApps.length})</span>
                      </div>
                      <div className="max-h-[80vh] md:max-h-none overflow-y-auto p-1 grid grid-cols-1 md:grid-cols-2 gap-0.5 scrollbar-hide">
                        {allApps.map((app, idx) => (
                          <button 
                            key={app.id} 
                            onClick={() => { app.action(); setIsAppsMenuOpen(false); }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-indigo-600/10 text-left transition-all group"
                          >
                            <span className="text-[10px] font-mono text-slate-600 w-4 group-hover:text-indigo-400 transition-colors">{idx + 1}</span>
                            <div className={`p-1.5 rounded-lg bg-slate-800 border border-slate-700 group-hover:border-indigo-500/30 transition-colors`}>
                              <app.icon className={`${app.color}`} size={16} />
                            </div>
                            <span className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors">{app.label}</span>
                          </button>
                        ))}
                      </div>
                      <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-center">
                        <p className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em]">Neural Prism v5.0.0</p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3 cursor-pointer group" onClick={() => handleSetViewState('directory')}>
                 <BrandLogo size={32} />
                 <h1 className="text-xl font-black italic uppercase tracking-tighter hidden sm:block group-hover:text-indigo-400 transition-colors">Neural Prism</h1>
              </div>
           </div>

           <div className="flex-1 max-w-xl mx-8 hidden md:block">
              <div className="relative group/search">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/search:text-indigo-400 transition-colors" size={18} />
                 <input 
                    id="main-search-input"
                    type="text" 
                    placeholder={t.search} 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)} 
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-10 pr-12 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all focus:bg-slate-900 shadow-inner" 
                 />
                 <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {searchQuery ? (
                        <button onClick={() => setSearchQuery('')} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-all"><X size={14}/></button>
                    ) : (
                        <div className="hidden lg:flex items-center gap-1 px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-[9px] font-black text-slate-500 uppercase select-none">
                            <Command size={10}/>K
                        </div>
                    )}
                 </div>
              </div>
           </div>

           <div className="flex items-center gap-2 sm:gap-4">
              {isDriveSyncing && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-900/20 text-indigo-400 rounded-full border border-indigo-500/30 animate-pulse">
                      <Cloud size={14}/><span className="text-[10px] font-bold uppercase hidden lg:inline">Syncing Hub...</span>
                  </div>
              )}
              {userProfile && (
                  <button onClick={() => handleSetViewState('coin_wallet')} className="flex items-center gap-2 px-3 py-1.5 bg-amber-900/20 hover:bg-amber-900/40 text-amber-400 rounded-full border border-amber-500/30 transition-all hidden sm:flex">
                      <Coins size={16}/><span className="font-black text-xs">{userProfile.coinBalance || 0}</span>
                  </button>
              )}
              <Notifications />
              <button onClick={() => setIsVoiceCreateOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all active:scale-95 group overflow-hidden relative">
                  <span className="relative z-10">{t.magic}</span>
              </button>
              <div className="relative">
                 <button onClick={() => { setIsUserMenuOpen(!isUserMenuOpen); setIsAppsMenuOpen(false); }} className="w-10 h-10 rounded-full border-2 border-slate-700 overflow-hidden hover:border-indigo-500 transition-colors">
                    <img src={currentUser?.photoURL || `https://ui-avatars.com/api/?name=Guest`} alt="Profile" className="w-full h-full object-cover" />
                 </button>
                 <StudioMenu isUserMenuOpen={isUserMenuOpen} setIsUserMenuOpen={setIsUserMenuOpen} currentUser={currentUser} userProfile={userProfile} setUserProfile={setUserProfile} globalVoice={globalVoice} setGlobalVoice={setGlobalVoice} setIsCreateModalOpen={setIsCreateModalOpen} setIsVoiceCreateOpen={setIsVoiceCreateOpen} onUpgradeClick={() => setIsPricingModalOpen(true)} setIsSyncModalOpen={() => {}} setIsSettingsModalOpen={setIsSettingsModalOpen} onOpenUserGuide={() => handleSetViewState('user_guide')} onNavigate={(v) => handleSetViewState(v as any)} onOpenPrivacy={() => handleSetViewState('privacy')} t={t} language={language} setLanguage={setLanguage} channels={allChannels} isSuperAdmin={isSuperAdmin} />
              </div>
           </div>
        </header>

        <main className="flex-1 overflow-hidden relative">
            {viewState === 'directory' && ( <PodcastFeed channels={allChannels} onChannelClick={(id) => { setActiveChannelId(id); handleSetViewState('podcast_detail', { channelId: id }); }} onStartLiveSession={handleStartLiveSession} userProfile={userProfile} globalVoice={globalVoice} currentUser={currentUser} t={t} setChannelToEdit={setChannelToEdit} setIsSettingsModalOpen={setIsSettingsModalOpen} onCommentClick={setChannelToComment} handleVote={handleVote} searchQuery={searchQuery} onNavigate={(v) => handleSetViewState(v as any)} onUpdateChannel={handleUpdateChannel} /> )}
            {viewState === 'podcast_detail' && activeChannel && ( <PodcastDetail channel={activeChannel} onBack={() => handleSetViewState('directory')} onStartLiveSession={handleStartLiveSession} language={language} currentUser={currentUser} userProfile={userProfile} onUpdateChannel={handleUpdateChannel} /> )}
            {viewState === 'live_session' && liveSessionParams && ( 
              <LiveSession 
                channel={liveSessionParams.channel} 
                onEndSession={() => handleSetViewState(liveSessionParams.returnTo || 'directory')} 
                language={language} 
                recordingEnabled={liveSessionParams.recordingEnabled}
                videoEnabled={liveSessionParams.videoEnabled}
                cameraEnabled={liveSessionParams.cameraEnabled}
                initialContext={liveSessionParams.context}
                lectureId={liveSessionParams.bookingId || liveSessionParams.activeSegment?.lectureId}
                activeSegment={liveSessionParams.activeSegment}
                initialTranscript={liveSessionParams.initialTranscript}
                existingDiscussionId={liveSessionParams.existingDiscussionId}
              /> 
            )}
            {viewState === 'docs' && ( <div className="p-8 max-w-5xl mx-auto h-full overflow-y-auto scrollbar-hide"><DocumentList onBack={() => handleSetViewState('directory')} /></div> )}
            {viewState === 'code_studio' && ( <CodeStudio onBack={() => handleSetViewState('directory')} currentUser={currentUser} userProfile={userProfile} onSessionStart={() => {}} onSessionStop={() => {}} onStartLiveSession={handleSetViewState as any} initialFiles={initialStudioFiles}/> )}
            {viewState === 'whiteboard' && ( <Whiteboard onBack={() => handleSetViewState('directory')} /> )}
            {viewState === 'blog' && ( <BlogView currentUser={currentUser} onBack={() => handleSetViewState('directory')} /> )}
            {viewState === 'chat' && ( <WorkplaceChat onBack={() => handleSetViewState('directory')} currentUser={currentUser} /> )}
            {viewState === 'careers' && ( <CareerCenter onBack={() => handleSetViewState('directory')} currentUser={currentUser} jobId={activeItemId || undefined} /> )}
            {viewState === 'calendar' && ( <CalendarView channels={allChannels} handleChannelClick={(id) => { setActiveChannelId(id); handleSetViewState('podcast_detail', { channelId: id }); }} handleVote={handleVote} currentUser={currentUser} setChannelToEdit={setChannelToEdit} setIsSettingsModalOpen={setIsSettingsModalOpen} globalVoice={globalVoice} t={t} onCommentClick={setChannelToComment} onStartLiveSession={handleStartLiveSession} onCreateChannel={handleCreateChannel} onSchedulePodcast={handleSchedulePodcast} /> )}
            {viewState === 'groups' && ( <div className="p-8 max-w-4xl mx-auto h-full overflow-y-auto scrollbar-hide"><GroupManager /></div> )}
            {viewState === 'mentorship' && ( <MentorBooking currentUser={currentUser} userProfile={userProfile} channels={allChannels} onStartLiveSession={handleStartLiveSession} /> )}
            {viewState === 'recordings' && ( <div className="p-8 max-w-5xl mx-auto h-full overflow-y-auto scrollbar-hide"><RecordingList onBack={() => handleSetViewState('directory')} onStartLiveSession={handleStartLiveSession} /></div> )}
            {(viewState === 'check_designer' || viewState === 'check_viewer') && ( <CheckDesigner onBack={() => handleSetViewState('directory')} currentUser={currentUser} userProfile={userProfile} /> )}
            {(viewState === 'shipping_labels' || viewState === 'shipping_viewer') && ( <ShippingLabelApp onBack={() => handleSetViewState('directory')} /> )}
            {(viewState === 'icon_generator' || viewState === 'icon_viewer') && ( <IconGenerator onBack={() => handleSetViewState('directory')} currentUser={currentUser} iconId={activeItemId || undefined} /> )}
            {viewState === 'notebook_viewer' && ( <NotebookViewer onBack={() => handleSetViewState('directory')} currentUser={currentUser} notebookId={activeItemId || undefined} /> )}
            {(viewState === 'card_workshop' || viewState === 'card_viewer') && ( <CardWorkshop onBack={() => handleSetViewState('directory')} cardId={activeItemId || undefined} isViewer={viewState === 'card_viewer' || !!activeItemId} /> )}
            {viewState === 'mission' && ( <MissionManifesto onBack={() => handleSetViewState('directory')} /> )}
            {viewState === 'firestore_debug' && ( <FirestoreInspector onBack={() => handleSetViewState('directory')} userProfile={userProfile} /> )}
            {viewState === 'coin_wallet' && ( <CoinWallet onBack={() => handleSetViewState('directory')} user={userProfile} /> )}
            {viewState === 'mock_interview' && ( <MockInterview onBack={() => handleSetViewState('directory')} userProfile={userProfile} onStartLiveSession={handleStartLiveSession} /> )}
            {viewState === 'graph_studio' && ( <GraphStudio onBack={() => handleSetViewState('directory')} /> )}
            {viewState === 'story' && ( <ProjectStory onBack={() => handleSetViewState('directory')} /> )}
            {viewState === 'privacy' && ( <PrivacyPolicy onBack={() => handleSetViewState('directory')} /> )}
            {viewState === 'user_guide' && ( <UserManual onBack={() => handleSetViewState('directory')} /> )}
        </main>

        <CreateChannelModal isOpen={isCreateModalOpen} onClose={() => { setIsCreateModalOpen(false); setCreateModalInitialDate(null); }} onCreate={handleCreateChannel} currentUser={currentUser} initialDate={createModalInitialDate} />
        <VoiceCreateModal isOpen={isVoiceCreateOpen} onClose={() => setIsVoiceCreateOpen(false)} onCreate={handleCreateChannel} />
        {currentUser && ( <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} user={userProfile || { uid: currentUser.uid, email: currentUser.email, displayName: currentUser.displayName, photoURL: currentUser.photoURL, groups: [], coinBalance: 0, createdAt: Date.now(), lastLogin: Date.now(), subscriptionTier: 'free', apiUsageCount: 0 } as UserProfile} onUpdateProfile={setUserProfile} onUpgradeClick={() => setIsPricingModalOpen(true)} isSuperAdmin={isSuperAdmin} onNavigateAdmin={() => handleSetViewState('firestore_debug')} /> )}
        {channelToComment && ( <CommentsModal isOpen={true} onClose={() => setChannelToComment(null)} channel={channelToComment} onAddComment={handleAddComment} onDeleteComment={(cid) => deleteCommentFromChannel(channelToComment.id, cid)} onEditComment={(cid, txt, att) => updateCommentInChannel(channelToComment.id, { id: cid, userId: currentUser.uid, user: currentUser.displayName || 'Anonymous', text: txt, timestamp: Date.now(), attachments: att })} currentUser={currentUser} /> )}
        {channelToEdit && ( <ChannelSettingsModal isOpen={true} onClose={() => setChannelToEdit(null)} channel={channelToEdit} onUpdate={handleUpdateChannel} /> )}
        <PricingModal isOpen={isPricingModalOpen} onClose={() => setIsPricingModalOpen(false)} user={userProfile} onSuccess={(tier) => { if(userProfile) setUserProfile({...userProfile, subscriptionTier: tier}); }} />
      </div>
    </ErrorBoundary>
  );
};

export default App;
