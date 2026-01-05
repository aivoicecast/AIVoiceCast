
import React, { useState, useEffect, useMemo, ErrorInfo, ReactNode, Component } from 'react';
import { 
  Podcast, Search, LayoutGrid, RefreshCw, 
  Home, Video as VideoIcon, User, ArrowLeft, Play, Gift, 
  Calendar, Briefcase, Users, Disc, FileText, Code, Wand2, PenTool, Rss, Loader2, MessageSquare, AppWindow, Square, Menu, X, Shield, Plus, Rocket, Book, AlertTriangle, Terminal, Trash2, LogOut, Truck, Maximize2, Minimize2, Wallet, Sparkles, Coins, Cloud, Video
} from 'lucide-react';

import { Channel, UserProfile, ViewState, TranscriptItem } from './types';

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

import { getCurrentUser, getDriveToken } from './services/authService';
import { auth, db } from './services/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { onSnapshot, doc } from 'firebase/firestore';
import { ensureCodeStudioFolder, loadAppStateFromDrive, saveAppStateToDrive } from './services/googleDriveService';
import { getUserChannels, saveUserChannel } from './utils/db';
import { HANDCRAFTED_CHANNELS } from './utils/initialData';
import { stopAllPlatformAudio } from './utils/audioUtils';
import { subscribeToPublicChannels, voteChannel, addCommentToChannel, deleteCommentFromChannel, updateCommentInChannel, getUserProfile, claimCoinCheck, syncUserProfile } from './services/firestoreService';

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
            <p className="text-slate-400 mb-6">A runtime error occurred in the UI component tree. This is often caused by missing data or a browser incompatibility.</p>
            <div className="bg-black/50 rounded-xl p-4 mb-8 font-mono text-xs text-red-300 overflow-x-auto border border-slate-800">
              {this.state.error?.toString()}
            </div>
            <div className="flex gap-4">
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
    appTitle: "AIVoiceCast",
    directory: "Explore", 
    myFeed: "My Feed",
    live: "Live Studio",
    search: "Search topics...",
    create: "New Podcast",
    magic: "Magic Creator",
    host: "Host",
    listeners: "Listeners",
    featured: "Featured",
    categories: "Categories",
    all: "All Podcasts",
    calendar: "Calendar",
    mentorship: "Mentorship",
    groups: "Groups",
    recordings: "Recordings",
    docs: "Document Studio",
    lectures: "Lectures",
    podcasts: "Podcasts",
    mission: "Mission & Manifesto",
    code: "Code Studio",
    whiteboard: "Whiteboard",
    blog: "Community Blog",
    chat: "Team Chat",
    careers: "Careers",
    notebooks: "Neural Lab",
    cards: "Card Workshop",
    icons: "Icon Lab",
    shipping: "Shipping Lab",
    checks: "Check Designer",
    fullscreen: "Toggle Fullscreen",
    wallet: "Coin Wallet",
    mockInterview: "Mock Interview"
  },
  zh: {
    appTitle: "AI 播客",
    directory: "探索",
    myFeed: "我的订阅",
    live: "直播中",
    search: "搜索主题...",
    create: "创建播客",
    magic: "魔法创建",
    host: "主播",
    listeners: "听众",
    featured: "精选",
    categories: "分类",
    all: "全部播客",
    calendar: "日历",
    mentorship: "导师",
    groups: "群组",
    recordings: "录音",
    docs: "文档工作室",
    lectures: "课程",
    podcasts: "播客",
    mission: "使命与宣言",
    code: "代码工作室",
    whiteboard: "白板",
    blog: "社区博客",
    chat: "团队聊天",
    careers: "职业发展",
    notebooks: "神经实验室",
    cards: "贺卡工坊",
    icons: "图标生成器",
    shipping: "物流实验室",
    checks: "支票设计器",
    fullscreen: "全屏切换",
    wallet: "虚拟钱包",
    mockInterview: "模拟面试"
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
  const [activeTab, setActiveTab] = useState('categories');
  const [searchQuery, setSearchQuery] = useState('');
  const [publicChannels, setPublicChannels] = useState<Channel[]>([]);
  const [userChannels, setUserChannels] = useState<Channel[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createModalInitialDate, setCreateModalInitialDate] = useState<Date | null>(null);
  const [isVoiceCreateOpen, setIsVoiceCreateOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isUserGuideOpen, setIsUserGuideOpen] = useState(false);
  const [globalVoice, setGlobalVoice] = useState('Auto');
  const [channelToComment, setChannelToComment] = useState<Channel | null>(null);
  const [channelToEdit, setChannelToEdit] = useState<Channel | null>(null);

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

  const allApps = [
    { id: 'podcasts', label: t.podcasts, icon: Podcast, action: () => { handleSetViewState('directory'); setActiveTab('categories'); }, color: 'text-indigo-400' },
    { id: 'mock_interview', label: t.mockInterview, icon: Video, action: () => handleSetViewState('mock_interview'), color: 'text-red-500' },
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
  ];

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
    // Store current viewState as returnTo context
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
    if (!activeAuth) return;

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
  };

  const handleSchedulePodcast = (date: Date) => {
      setCreateModalInitialDate(date);
      setIsCreateModalOpen(true);
  };

  if (authLoading) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-6">
            <BrandLogo size={80} className="animate-pulse" />
            <div className="flex flex-col items-center gap-2">
                <Loader2 className="animate-spin text-indigo-500" size={32} />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-[0.3em]">Initializing OS</span>
            </div>
        </div>
      );
  }

  const isPublicView = ['mission', 'careers', 'user_guide', 'card_workshop', 'icon_viewer', 'shipping_viewer', 'check_viewer'].includes(viewState as string);

  if (!currentUser && !isPublicView) {
      return <LoginPage onMissionClick={() => handleSetViewState('mission')} onPrivacyClick={() => setIsPrivacyOpen(true)} />;
  }

  const activeChannel = allChannels.find(c => c.id === activeChannelId);

  return (
    <ErrorBoundary>
      <div className="h-screen flex flex-col bg-slate-950 text-slate-50 overflow-hidden">
        <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-4 sm:px-6 shrink-0 z-50 backdrop-blur-xl">
           <div className="flex items-center gap-4">
              <button onClick={() => setIsAppsMenuOpen(!isAppsMenuOpen)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                 <LayoutGrid size={22} />
              </button>
              <div className="flex items-center gap-3 cursor-pointer group" onClick={() => window.location.href = window.location.origin}>
                 <BrandLogo size={32} />
                 <h1 className="text-xl font-black italic uppercase tracking-tighter hidden sm:block group-hover:text-indigo-400 transition-colors">AIVoiceCast</h1>
              </div>
           </div>

           <div className="flex-1 max-w-xl mx-8 hidden md:block">
              <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                 <input type="text" placeholder={t.search} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all" />
              </div>
           </div>

           <div className="flex items-center gap-2 sm:gap-4">
              {isDriveSyncing && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-900/20 text-indigo-400 rounded-full border border-indigo-500/30 animate-pulse">
                      <Cloud size={14}/><span className="text-[10px] font-bold uppercase hidden lg:inline">Syncing Drive...</span>
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
                 <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className="w-10 h-10 rounded-full border-2 border-slate-700 overflow-hidden hover:border-indigo-500 transition-colors">
                    <img src={currentUser?.photoURL || `https://ui-avatars.com/api/?name=Guest`} alt="Profile" className="w-full h-full object-cover" />
                 </button>
                 <StudioMenu isUserMenuOpen={isUserMenuOpen} setIsUserMenuOpen={setIsUserMenuOpen} currentUser={currentUser} userProfile={userProfile} setUserProfile={setUserProfile} globalVoice={globalVoice} setGlobalVoice={setGlobalVoice} setIsCreateModalOpen={setIsCreateModalOpen} setIsVoiceCreateOpen={setIsVoiceCreateOpen} setIsSyncModalOpen={() => {}} setIsSettingsModalOpen={setIsSettingsModalOpen} onOpenUserGuide={() => setIsUserGuideOpen(true)} onNavigate={(v) => handleSetViewState(v as any)} onOpenPrivacy={() => setIsPrivacyOpen(true)} t={t} channels={allChannels} language={language} setLanguage={setLanguage} />
              </div>
           </div>
        </header>

        {isAppsMenuOpen && (
            <div className="fixed inset-0 z-[100] animate-fade-in">
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsAppsMenuOpen(false)}></div>
                <div className="absolute left-4 sm:left-6 top-20 w-[calc(100vw-2rem)] md:w-[640px] lg:w-[850px] bg-slate-900 border border-slate-700 rounded-[2.5rem] shadow-2xl overflow-hidden p-6 md:p-8 animate-fade-in-up">
                    <div className="flex justify-between items-center mb-6 md:mb-8">
                        <div className="flex flex-col">
                            <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Neural OS</h3>
                            <p className="text-lg font-bold text-white">App Launcher</p>
                        </div>
                        <button onClick={() => setIsAppsMenuOpen(false)} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                            <X size={20} className="text-slate-500 hover:text-white"/>
                        </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
                        {allApps.map(app => ( 
                            <button 
                                key={app.id} 
                                onClick={app.action} 
                                className="flex flex-col items-center gap-3 p-5 md:p-6 bg-slate-800/40 hover:bg-indigo-600/10 border border-slate-800 hover:border-indigo-500/40 rounded-3xl transition-all group relative overflow-hidden"
                            > 
                                <div className="absolute top-0 right-0 p-8 bg-white/5 blur-3xl rounded-full group-hover:bg-white/10 transition-colors pointer-events-none"></div>
                                <app.icon className={`${app.color} group-hover:scale-110 transition-transform relative z-10`} size={28} /> 
                                <span className="text-[10px] md:text-[11px] font-black text-slate-400 group-hover:text-white uppercase tracking-widest relative z-10 text-center">{app.label}</span> 
                            </button> 
                        ))}
                    </div>
                    <div className="mt-8 pt-6 border-t border-slate-800 flex justify-center">
                        <p className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.3em]">AIVoiceCast Platform v4.2.0</p>
                    </div>
                </div>
            </div>
        )}

        <main className="flex-1 overflow-hidden relative">
            {viewState === 'directory' && ( <PodcastFeed channels={allChannels} onChannelClick={(id) => { setActiveChannelId(id); handleSetViewState('podcast_detail', { channelId: id }); }} onStartLiveSession={handleStartLiveSession} userProfile={userProfile} globalVoice={globalVoice} currentUser={currentUser} t={t} setChannelToEdit={setChannelToEdit} setIsSettingsModalOpen={setIsSettingsModalOpen} onCommentClick={setChannelToComment} handleVote={handleVote} /> )}
            {viewState === 'podcast_detail' && activeChannel && ( <PodcastDetail channel={activeChannel} onBack={() => handleSetViewState('directory')} onStartLiveSession={handleStartLiveSession} language={language} currentUser={currentUser} userProfile={userProfile} /> )}
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
            {viewState === 'code_studio' && ( <CodeStudio onBack={() => handleSetViewState('directory')} currentUser={currentUser} userProfile={userProfile} onSessionStart={() => {}} onSessionStop={() => {}} onStartLiveSession={handleStartLiveSession} /> )}
            {viewState === 'whiteboard' && ( <Whiteboard onBack={() => handleSetViewState('directory')} /> )}
            {viewState === 'blog' && ( <BlogView currentUser={currentUser} onBack={() => handleSetViewState('directory')} /> )}
            {viewState === 'chat' && ( <WorkplaceChat onBack={() => handleSetViewState('directory')} currentUser={currentUser} /> )}
            {viewState === 'careers' && ( <CareerCenter onBack={() => handleSetViewState('directory')} currentUser={currentUser} jobId={activeItemId || undefined} /> )}
            {viewState === 'calendar' && ( <CalendarView channels={allChannels} handleChannelClick={(id) => { setActiveChannelId(id); handleSetViewState('podcast_detail', { channelId: id }); }} handleVote={handleVote} currentUser={currentUser} setChannelToEdit={setChannelToEdit} setIsSettingsModalOpen={setIsSettingsModalOpen} globalVoice={globalVoice} t={t} onCommentClick={setChannelToComment} onStartLiveSession={handleStartLiveSession} onCreateChannel={handleCreateChannel} onSchedulePodcast={handleSchedulePodcast} /> )}
            {viewState === 'groups' && ( <div className="p-8 max-w-4xl mx-auto h-full overflow-y-auto scrollbar-hide"><GroupManager /></div> )}
            {viewState === 'mentorship' && ( <MentorBooking currentUser={currentUser} channels={allChannels} onStartLiveSession={handleStartLiveSession} /> )}
            {viewState === 'recordings' && ( <div className="p-8 max-w-5xl mx-auto h-full overflow-y-auto scrollbar-hide"><RecordingList onBack={() => handleSetViewState('directory')} onStartLiveSession={handleStartLiveSession} /></div> )}
            {(viewState === 'check_designer' || viewState === 'check_viewer') && ( <CheckDesigner onBack={() => handleSetViewState('directory')} currentUser={currentUser} userProfile={userProfile} /> )}
            {(viewState === 'shipping_labels' || viewState === 'shipping_viewer') && ( <ShippingLabelApp onBack={() => handleSetViewState('directory')} /> )}
            {(viewState === 'icon_generator' || viewState === 'icon_viewer') && ( <IconGenerator onBack={() => handleSetViewState('directory')} currentUser={currentUser} iconId={activeItemId || undefined} /> )}
            {viewState === 'notebook_viewer' && ( <NotebookViewer onBack={() => handleSetViewState('directory')} currentUser={currentUser} notebookId={activeItemId || undefined} /> )}
            {(viewState === 'card_workshop' || viewState === 'card_viewer') && ( <CardWorkshop onBack={() => handleSetViewState('directory')} cardId={activeItemId || undefined} isViewer={viewState === 'card_viewer' || !!activeItemId} /> )}
            {viewState === 'mission' && ( <MissionManifesto onBack={() => handleSetViewState('directory')} /> )}
            {viewState === 'firestore_debug' && ( <FirestoreInspector onBack={() => handleSetViewState('directory')} /> )}
            {viewState === 'coin_wallet' && ( <CoinWallet onBack={() => handleSetViewState('directory')} user={userProfile} /> )}
            {viewState === 'mock_interview' && ( <MockInterview onBack={() => handleSetViewState('directory')} userProfile={userProfile} onStartLiveSession={handleStartLiveSession} /> )}
        </main>

        <CreateChannelModal isOpen={isCreateModalOpen} onClose={() => { setIsCreateModalOpen(false); setCreateModalInitialDate(null); }} onCreate={handleCreateChannel} currentUser={currentUser} initialDate={createModalInitialDate} />
        <VoiceCreateModal isOpen={isVoiceCreateOpen} onClose={() => setIsVoiceCreateOpen(false)} onCreate={handleCreateChannel} />
        {currentUser && ( <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} user={userProfile || { uid: currentUser.uid, email: currentUser.email, displayName: currentUser.displayName, photoURL: currentUser.photoURL, groups: [], coinBalance: 0, createdAt: Date.now(), lastLogin: Date.now(), subscriptionTier: 'free', apiUsageCount: 0 } as UserProfile} onUpdateProfile={setUserProfile} /> )}
        {channelToComment && ( <CommentsModal isOpen={true} onClose={() => setChannelToComment(null)} channel={channelToComment} onAddComment={handleAddComment} onDeleteComment={(cid) => deleteCommentFromChannel(channelToComment.id, cid)} onEditComment={(cid, txt, att) => updateCommentInChannel(channelToComment.id, { id: cid, userId: currentUser.uid, user: currentUser.displayName || 'Anonymous', text: txt, timestamp: Date.now(), attachments: att })} currentUser={currentUser} /> )}
        {channelToEdit && ( <ChannelSettingsModal isOpen={true} onClose={() => setChannelToEdit(null)} channel={channelToEdit} onUpdate={handleUpdateChannel} /> )}
        {isPrivacyOpen && ( <div className="fixed inset-0 z-[100] animate-fade-in"> <PrivacyPolicy onBack={() => setIsPrivacyOpen(false)} /> </div> )}
        {isUserGuideOpen && ( <div className="fixed inset-0 z-[100] animate-fade-in"> <UserManual onBack={() => setIsUserGuideOpen(false)} /> </div> )}
      </div>
    </ErrorBoundary>
  );
};

export default App;
