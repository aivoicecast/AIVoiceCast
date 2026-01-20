import React, { useState, useEffect, useMemo, useCallback, ErrorInfo, ReactNode, Component } from 'react';
import { 
  Podcast, Search, LayoutGrid, RefreshCw, 
  Home, Video, User, ArrowLeft, Play, Gift, 
  Calendar, Briefcase, Users, Disc, FileText, Code, Wand2, PenTool, Rss, Loader2, MessageSquare, AppWindow, Square, Menu, X, Shield, Plus, Rocket, Book, AlertTriangle, Terminal, Trash2, LogOut, Truck, Maximize2, Minimize2, Wallet, Sparkles, Coins, Cloud, ChevronDown, Command, Activity, BookOpen, Scroll, GraduationCap, Cpu, Star, Radio, Lock, Crown
} from 'lucide-react';

import { Channel, UserProfile, ViewState, TranscriptItem, CodeFile } from '../types';

import { LiveSession } from './LiveSession';
import { PodcastDetail } from './PodcastDetail';
import { UserAuth } from './UserAuth';
import { CreateChannelModal } from './CreateChannelModal';
import { VoiceCreateModal } from './VoiceCreateModal';
import { StudioMenu } from './StudioMenu';
import { ChannelSettingsModal } from './ChannelSettingsModal';
import { CommentsModal } from './CommentsModal';
import { Notifications } from './Notifications';
import { GroupManager } from './GroupManager';
import { MentorBooking } from './MentorBooking';
import { RecordingList } from './RecordingList';
import { DocumentList } from './DocumentList';
import { CalendarView } from './CalendarView';
import { PodcastFeed } from './PodcastFeed'; 
import { MissionManifesto } from './MissionManifesto';
import { CodeStudio } from './CodeStudio';
import { Whiteboard } from './Whiteboard';
import { BlogView } from './BlogView';
import { WorkplaceChat } from './WorkplaceChat';
import { LoginPage } from './LoginPage'; 
import { SettingsModal } from './SettingsModal'; 
import { PricingModal } from './PricingModal'; 
import { CareerCenter } from './CareerCenter';
import { UserManual } from './UserManual'; 
import { PrivacyPolicy } from './PrivacyPolicy';
import { NotebookViewer } from './NotebookViewer'; 
import { CardWorkshop } from './CardWorkshop';
import { CardExplorer } from './CardExplorer';
import { IconGenerator } from './IconGenerator';
import { ShippingLabelApp } from './ShippingLabelApp';
import { CheckDesigner } from './CheckDesigner';
import { FirestoreInspector } from './FirestoreInspector';
import { BrandLogo } from './BrandLogo';
import { CoinWallet } from './CoinWallet';
import { MockInterview } from './MockInterview';
import { GraphStudio } from './GraphStudio';
import { ProjectStory } from './ProjectStory';
import { ScriptureSanctuary } from './ScriptureSanctuary';

import { getCurrentUser, getDriveToken } from '../services/authService';
import { auth, db } from '../services/firebaseConfig';
import { onAuthStateChanged } from '@firebase/auth';
import { onSnapshot, doc } from '@firebase/firestore';
import { ensureCodeStudioFolder, loadAppStateFromDrive, saveAppStateToDrive } from '../services/googleDriveService';
import { getUserChannels, saveUserChannel } from '../utils/db';
import { HANDCRAFTED_CHANNELS } from '../utils/initialData';
import { stopAllPlatformAudio } from '../utils/audioUtils';
import { subscribeToPublicChannels, voteChannel, addCommentToChannel, deleteCommentFromChannel, updateCommentInChannel, getUserProfile, claimCoinCheck, syncUserProfile, publishChannelToFirestore, isUserAdmin } from '../services/firestoreService';

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
    directory: "Knowledge Hub", 
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
    story: "Project Story",
    bible: "Scripture Sanctuary",
    proRequired: "Pro Membership Required",
    proDesc: "Access to this advanced tool is reserved for Pro members. Join the elite spectrum to unlock 20+ specialized AI utilities.",
    upgradeNow: "Upgrade to Pro",
    unlockEverything: "Unlock the full spectrum of AI super-intelligence.",
    interviewExp: "Software Interview",
    kernelExp: "Linux Kernel Audit",
    geminiExp: "Gemini Expert"
  },
  zh: {
    appTitle: "神经棱镜",
    directory: "知识中心",
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
    story: "项目故事",
    bible: "经文圣所",
    proRequired: "需要 Pro 会员权限",
    proDesc: "访问此高级工具仅限 Pro 会员。加入精英光谱以解锁 20 多个专业 AI 实用程序。",
    upgradeNow: "立即升级 Pro",
    unlockEverything: "解锁 AI 超级智能的完整光谱。",
    interviewExp: "软件工程师面试",
    kernelExp: "Linux 内核审计",
    geminiExp: "Gemini 专家"
  }
};

const PUBLIC_VIEWS: ViewState[] = ['directory', 'podcast_detail', 'mission', 'story', 'privacy', 'user_guide'];
const LANDING_VIEWS: ViewState[] = ['mission', 'story', 'privacy', 'user_guide'];

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

  const isSuperAdmin = useMemo(() => {
      if (!currentUser) return false;
      const ownerEmails = ['shengliang.song.ai@gmail.com'];
      if (ownerEmails.includes(currentUser.email)) return true;
      if (isUserAdmin(userProfile)) return true;
      return false;
  }, [userProfile, currentUser]);

  const isProMember = useMemo(() => {
    if (isSuperAdmin) return true;
    return userProfile?.subscriptionTier === 'pro';
  }, [userProfile, isSuperAdmin]);

  const handleSetViewState = useCallback((newState: ViewState, params: Record<string, string> = {}) => {
    const isPublic = PUBLIC_VIEWS.includes(newState);
    
    if (!isPublic && !isProMember) {
        setIsPricingModalOpen(true);
        setIsAppsMenuOpen(false);
        setIsUserMenuOpen(false);
        if (viewState !== 'directory') {
            setViewState('directory');
            window.history.replaceState({}, '', window.location.origin);
        }
        return;
    }

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
  }, [viewState, isProMember]);

  const handleStartLiveSession = useCallback((channel: Channel, context?: string, recordingEnabled?: boolean, bookingId?: string, videoEnabled?: boolean, cameraEnabled?: boolean, activeSegment?: { index: number, lectureId: string }, initialTranscript?: TranscriptItem[], existingDiscussionId?: string) => {
    if (!isProMember) {
        setIsPricingModalOpen(true);
        return;
    }
    setLiveSessionParams({ channel, context, recordingEnabled, videoEnabled, cameraEnabled, bookingId, activeSegment, initialTranscript, existingDiscussionId, returnTo: viewState });
    handleSetViewState('live_session');
  }, [viewState, handleSetViewState, isProMember]);

  const ProGate = useCallback(({ children, view }: { children: ReactNode, view: ViewState }) => {
    const isPublic = PUBLIC_VIEWS.includes(view);
    if (isPublic || isSuperAdmin) return <>{children}</>;

    if (!authLoading && currentUser && !userProfile) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center gap-6 bg-slate-950">
                <Loader2 className="animate-spin text-indigo-500" size={32} />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Verifying Neural Clearance...</span>
            </div>
        );
    }

    if (isProMember) return <>{children}</>;

    return (
        <div className="h-full w-full flex items-center justify-center p-6 bg-slate-950 overflow-y-auto">
            <div className="max-w-xl w-full bg-slate-900 border border-indigo-500/30 rounded-[3rem] p-10 text-center shadow-2xl relative overflow-hidden animate-fade-in-up">
                <div className="absolute top-0 right-0 p-32 bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none"></div>
                <div className="relative z-10 space-y-8">
                    <div className="flex justify-center">
                        <div className="relative">
                            <div className="w-24 h-24 bg-indigo-600/10 rounded-[2rem] border border-indigo-500/20 flex items-center justify-center">
                                <Lock size={48} className="text-indigo-400" />
                            </div>
                            <div className="absolute -top-3 -right-3 bg-amber-500 text-white p-2 rounded-xl shadow-lg ring-4 ring-slate-900">
                                <Crown size={20} fill="currentColor"/>
                            </div>
                        </div>
                    </div>
                    
                    <div className="space-y-3">
                        <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">{t.proRequired}</h2>
                        <p className="text-slate-400 font-medium leading-relaxed">{t.proDesc}</p>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-inner">
                        <div className="flex items-center gap-4 text-left">
                            <div className="p-2 bg-indigo-900/30 rounded-lg text-indigo-400"><Sparkles size={18}/></div>
                            <p className="text-xs text-slate-300 font-bold">{t.unlockEverything}</p>
                        </div>
                        <button 
                            onClick={() => setIsPricingModalOpen(true)}
                            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-95"
                        >
                            {t.upgradeNow}
                        </button>
                    </div>

                    <button onClick={() => handleSetViewState('directory')} className="text-xs font-bold text-slate-500 hover:text-white uppercase tracking-widest transition-colors flex items-center gap-2 mx-auto">
                        <ArrowLeft size={14}/> Back to {t.directory}
                    </button>
                </div>
            </div>
        </div>
    );
  }, [isProMember, isSuperAdmin, userProfile, authLoading, currentUser, t, setIsPricingModalOpen, handleSetViewState]);

  const allApps = useMemo(() => {
    const baseApps = [
        { id: 'directory', label: t.podcasts, icon: Podcast, action: () => { handleSetViewState('directory'); }, color: 'text-indigo-400' },
        { id: 'bible_study', label: t.bible, icon: Scroll, action: () => handleSetViewState('bible_study'), color: 'text-amber-500' },
        { id: 'interview_expert', label: t.interviewExp, icon: GraduationCap, action: () => { const ch = HANDCRAFTED_CHANNELS.find(c => c.id === '1'); if (ch) handleStartLiveSession(ch); }, color: 'text-red-400' },
        { id: 'kernel_expert', label: t.kernelExp, icon: Cpu, action: () => { const ch = HANDCRAFTED_CHANNELS.find(c => c.id === '2'); if (ch) handleStartLiveSession(ch); }, color: 'text-indigo-400' },
        { id: 'gemini_expert', label: t.geminiExp, icon: Star, action: () => { const ch = HANDCRAFTED_CHANNELS.find(c => c.id === 'default-gem'); if (ch) handleStartLiveSession(ch); }, color: 'text-emerald-400' },
        { id: 'mock_interview', label: t.mockInterview, icon: Video, action: () => handleSetViewState('mock_interview'), color: 'text-red-500' },
        { id: 'graph_studio', label: t.graph, icon: Activity, action: () => handleSetViewState('graph_studio'), color: 'text-emerald-400' },
        { id: 'coin_wallet', label: t.wallet, icon: Coins, action: () => handleSetViewState('coin_wallet'), color: 'text-amber-400' },
        { id: 'docs', label: t.docs, icon: FileText, action: () => handleSetViewState('docs'), color: 'text-emerald-400' },
        { id: 'check_designer', label: t.checks, icon: Wallet, action: () => handleSetViewState('check_designer'), color: 'text-orange-400' },
        { id: 'chat', label: t.chat, icon: MessageSquare, action: () => handleSetViewState('chat'), color: 'text-blue-400' },
        { id: 'mentorship', label: t.mentorship, icon: Briefcase, action: () => handleSetViewState('mentorship'), color: 'text-emerald-400' },
        { id: 'shipping_labels', label: t.shipping, icon: Truck, action: () => handleSetViewState('shipping_labels'), color: 'text-emerald-400' },
        { id: 'icon_generator', label: t.icons, icon: AppWindow, action: () => handleSetViewState('icon_generator'), color: 'text-cyan-400' },
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
  }, [t, isSuperAdmin, handleStartLiveSession, handleSetViewState]);

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
        } else {
            setCurrentUser(null);
            setUserProfile(null);
        }
        setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

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

  if (!currentUser && !LANDING_VIEWS.includes(viewState)) {
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
                  <LayoutGrid size(20} />
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
                        {allApps.map((app, idx) => {
                          const isAppPublic = PUBLIC_VIEWS.includes(app.id as any);
                          const isLocked = !isAppPublic && !isProMember;
                          return (
                            <button 
                              key={app.id} 
                              onClick={() => { 
                                if (isLocked) {
                                    setIsPricingModalOpen(true);
                                } else {
                                    app.action(); 
                                }
                                setIsAppsMenuOpen(false); 
                              }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group relative overflow-hidden ${isLocked ? 'grayscale opacity-60' : 'hover:bg-indigo-600/10'}`}
                            >
                              {isLocked && <div className="absolute inset-0 bg-slate-950/10 backdrop-blur-[1px] pointer-events-none z-10"></div>}
                              <span className="text-[10px] font-mono text-slate-600 w-4 group-hover:text-indigo-400 transition-colors z-20">{idx + 1}</span>
                              <div className={`p-1.5 rounded-lg bg-slate-800 border border-slate-700 group-hover:border-indigo-500/30 transition-colors z-20`}>
                                <app.icon className={`${app.color}`} size={16} />
                              </div>
                              <span className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors z-20">{app.label}</span>
                              {isLocked && (
                                  <div className="ml-auto flex items-center gap-1.5 z-20">
                                      <Lock size={12} className="text-slate-600 group-hover:text-indigo-400 transition-colors"/>
                                      <span className="text-[8px] font-black uppercase text-amber-500 hidden group-hover:block">Upgrade</span>
                                  </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-center">
                        <p className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em]">Neural Prism v5.5.5</p>
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
              </div>
           </div>

           <div className="flex items-center gap-2 sm:gap-4">
              {userProfile && (
                  <button onClick={() => handleSetViewState('coin_wallet')} className="flex items-center gap-2 px-3 py-1.5 bg-amber-900/20 hover:bg-amber-900/40 text-amber-400 rounded-full border border-amber-500/30 transition-all hidden sm:flex">
                      <Coins size={16}/><span className="font-black text-xs">{userProfile.coinBalance || 0}</span>
                  </button>
              )}
              <Notifications />
              <button onClick={() => isProMember ? setIsVoiceCreateOpen(true) : setIsPricingModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all active:scale-95 group overflow-hidden relative">
                  {!isProMember && <Lock size={12} className="relative z-10 mr-1 text-indigo-200"/>}
                  <span className="relative z-10">{t.magic}</span>
              </button>
              <div className="relative">
                 <button onClick={() => { setIsUserMenuOpen(!isUserMenuOpen); setIsAppsMenuOpen(false); }} className="w-10 h-10 rounded-full border-2 border-slate-700 overflow-hidden hover:border-indigo-500 transition-colors">
                    {currentUser?.photoURL ? (
                        <img src={currentUser.photoURL} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-slate-800 flex items-center justify-center text-xs font-black text-indigo-400">
                            {(currentUser?.displayName || 'Guest').substring(0, 1).toUpperCase()}
                        </div>
                    )}
                 </button>
                 <StudioMenu isUserMenuOpen={isUserMenuOpen} setIsUserMenuOpen={setIsUserMenuOpen} currentUser={currentUser} userProfile={userProfile} setUserProfile={setUserProfile} globalVoice={globalVoice} setGlobalVoice={setGlobalVoice} setIsCreateModalOpen={setIsCreateModalOpen} setIsVoiceCreateOpen={setIsVoiceCreateOpen} onUpgradeClick={() => setIsPricingModalOpen(true)} setIsSyncModalOpen={() => {}} setIsSettingsModalOpen={setIsSettingsModalOpen} onOpenUserGuide={() => handleSetViewState('user_guide')} onNavigate={(v) => handleSetViewState(v as any)} onOpenPrivacy={() => handleSetViewState('privacy')} t={t} language={language} setLanguage={setLanguage} channels={allChannels} isSuperAdmin={isSuperAdmin} />
              </div>
           </div>
        </header>

        <main className="flex-1 overflow-hidden relative">
            <ProGate view={viewState}>
                {viewState === 'directory' && ( <PodcastFeed channels={allChannels} onChannelClick={(id) => { setActiveChannelId(id); handleSetViewState('podcast_detail', { channelId: id }); }} onStartLiveSession={handleStartLiveSession} userProfile={userProfile} globalVoice={globalVoice} currentUser={currentUser} t={t} setChannelToEdit={setChannelToEdit} setIsSettingsModalOpen={setIsSettingsModalOpen} onCommentClick={setChannelToComment} handleVote={handleVote} searchQuery={searchQuery} onNavigate={(v) => handleSetViewState(v as any)} onUpdateChannel={handleUpdateChannel} onOpenPricing={() => setIsPricingModalOpen(true)} /> )}
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
                {viewState === 'code_studio' && ( <CodeStudio onBack={() => handleSetViewState('directory')} currentUser={currentUser} userProfile={userProfile} onSessionStart={() => {}} onSessionStop={() => {}} onStartLiveSession={handleSetViewState as any} initialFiles={initialStudioFiles} isProMember={isProMember}/> )}
                {viewState === 'whiteboard' && ( <Whiteboard onBack={() => handleSetViewState('directory')} /> )}
                {viewState === 'blog' && ( <BlogView currentUser={currentUser} onBack={() => handleSetViewState('directory')} /> )}
                {viewState === 'chat' && ( <WorkplaceChat onBack={() => handleSetViewState('directory')} currentUser={currentUser} /> )}
                {viewState === 'careers' && ( <CareerCenter onBack={() => handleSetViewState('directory')} currentUser={currentUser} jobId={activeItemId || undefined} /> )}
                {viewState === 'calendar' && ( <CalendarView channels={allChannels} handleChannelClick={(id) => { setActiveChannelId(id); handleSetViewState('podcast_detail', { channelId: id }); }} handleVote={handleVote} currentUser={currentUser} setChannelToEdit={setChannelToEdit} setIsSettingsModalOpen={setIsSettingsModalOpen} globalVoice={globalVoice} t={t} onCommentClick={setChannelToComment} onStartLiveSession={handleStartLiveSession} onCreateChannel={handleCreateChannel} onSchedulePodcast={handleSchedulePodcast} /> )}
                {viewState === 'groups' && ( <div className="p-8 max-w-4xl mx-auto h-full overflow-y-auto scrollbar-hide"><GroupManager /></div> )}
                {viewState === 'mentorship' && ( <div className="h-full overflow-y-auto scrollbar-hide"><MentorBooking currentUser={currentUser} userProfile={userProfile} channels={allChannels} onStartLiveSession={handleStartLiveSession} /></div> )}
                {viewState === 'recordings' && ( <div className="p-8 max-w-5xl mx-auto h-full overflow-y-auto scrollbar-hide"><RecordingList onBack={() => handleSetViewState('directory')} onStartLiveSession={handleStartLiveSession} /></div> )}
                {(viewState === 'check_designer' || viewState === 'check_viewer') && ( <CheckDesigner onBack={() => handleSetViewState('directory')} currentUser={currentUser} userProfile={userProfile} isProMember={isProMember} /> )}
                {(viewState === 'shipping_labels' || viewState === 'shipping_viewer') && ( <ShippingLabelApp onBack={() => handleSetViewState('directory')} /> )}
                {(viewState === 'icon_generator' || viewState === 'icon_viewer') && ( <IconGenerator onBack={() => handleSetViewState('directory')} currentUser={currentUser} iconId={activeItemId || undefined} isProMember={isProMember} /> )}
                {viewState === 'notebook_viewer' && ( <NotebookViewer onBack={() => handleSetViewState('directory')} currentUser={currentUser} notebookId={activeItemId || undefined} /> )}
                {(viewState === 'card_workshop' || viewState === 'card_viewer') && ( <CardWorkshop onBack={() => handleSetViewState('directory')} cardId={activeItemId || undefined} isViewer={viewState === 'card_viewer' || !!activeItemId} /> )}
                {viewState === 'mission' && ( <MissionManifesto onBack={() => handleSetViewState('directory')} /> )}
                {viewState === 'firestore_debug' && ( <FirestoreInspector onBack={() => handleSetViewState('directory')} userProfile={userProfile} /> )}
                {viewState === 'coin_wallet' && ( <CoinWallet onBack={() => handleSetViewState('directory')} user={userProfile} /> )}
                {viewState === 'mock_interview' && ( <MockInterview onBack={() => handleSetViewState('directory')} userProfile={userProfile} onStartLiveSession={handleStartLiveSession} isProMember={isProMember} /> )}
                {viewState === 'graph_studio' && ( <GraphStudio onBack={() => handleSetViewState('directory')} isProMember={isProMember} /> )}
                {viewState === 'story' && ( <ProjectStory onBack={() => handleSetViewState('directory')} /> )}
                {viewState === 'privacy' && ( <PrivacyPolicy onBack={() => handleSetViewState('directory')} /> )}
                {viewState === 'user_guide' && ( <UserManual onBack={() => handleSetViewState('directory')} /> )}
                {viewState === 'bible_study' && ( <ScriptureSanctuary onBack={() => handleSetViewState('directory')} language={language} isProMember={isProMember} /> )}
            </ProGate>
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
