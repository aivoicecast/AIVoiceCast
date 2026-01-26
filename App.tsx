
import React, { useState, useEffect, useMemo, useCallback, ErrorInfo, ReactNode, Component, useRef } from 'react';
import { 
  Podcast, Search, LayoutGrid, RefreshCw, 
  Home, Video, User, ArrowLeft, Play, Gift, 
  Calendar, Briefcase, Users, Disc, FileText, Code, Wand2, PenTool, Rss, Loader2, MessageSquare, AppWindow, Square, Menu, X, Shield, Plus, Rocket, Book, AlertTriangle, Terminal, Trash2, LogOut, Truck, Maximize2, Minimize2, Wallet, Sparkles, Coins, Cloud, ChevronDown, Command, Activity, BookOpen, Scroll, GraduationCap, Cpu, Star, Lock, Crown, ShieldCheck, Flame, Zap, RefreshCcw, Bug, ChevronUp, Fingerprint, Database, CheckCircle, Pause, PlayCircle as PlayIcon, Copy, BookText
} from 'lucide-react';

import { Channel, UserProfile, ViewID, TranscriptItem, CodeFile } from './types';

import { Dashboard } from './components/Dashboard';
import { LiveSession } from './components/LiveSession';
import { PodcastDetail } from './components/PodcastDetail';
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
import { IconGenerator } from './components/IconGenerator';
import { ShippingLabelApp } from './components/ShippingLabelApp';
import { CheckDesigner } from './components/CheckDesigner';
import { FirestoreInspector } from './components/FirestoreInspector';
import { BrandLogo } from './components/BrandLogo';
import { CoinWallet } from './components/CoinWallet';
import { MockInterview } from './components/MockInterview';
import { GraphStudio } from './components/GraphStudio';
import { ProjectStory } from './components/ProjectStory';
import { ScriptureSanctuary } from './components/ScriptureSanctuary';
import { BookStudio } from './components/BookStudio';

import { auth, db } from './services/firebaseConfig';
import { onAuthStateChanged } from '@firebase/auth';
import { onSnapshot, doc } from '@firebase/firestore';
import { getUserChannels, saveUserChannel } from './utils/db';
import { HANDCRAFTED_CHANNELS } from './utils/initialData';
import { stopAllPlatformAudio } from './utils/audioUtils';
import { subscribeToPublicChannels, voteChannel, addCommentToChannel, deleteCommentFromChannel, updateCommentInChannel, getUserProfile, syncUserProfile, publishChannelToFirestore, isUserAdmin, updateUserProfile } from './services/firestoreService';
import { getSovereignSession, isJudgeSession } from './services/authService';

interface ErrorBoundaryProps { children?: ReactNode; }
interface ErrorBoundaryState { hasError: boolean; error: Error | null; }

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare props: ErrorBoundaryProps;
  state: ErrorBoundaryState = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error): ErrorBoundaryState { return { hasError: true, error }; }
  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
            <div className="max-w-md">
                <AlertTriangle className="text-red-500 mx-auto mb-4" size={48} />
                <h1 className="text-2xl font-bold text-white mb-2">Neural Prism Halted</h1>
                <p className="text-slate-400 mb-6">{this.state.error?.toString()}</p>
                <button onClick={() => window.location.reload()} className="bg-indigo-600 px-8 py-3 rounded-xl font-bold text-white">Restart Engine</button>
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
    directory: "Discovery", 
    search: "Search for activities...",
    magic: "AI VoiceCast",
    podcasts: "Activity Hub",
    mission: "Vision",
    code: "Builder Studio",
    whiteboard: "Visual Canvas",
    chat: "Team Space",
    careers: "Talent Hub",
    notebooks: "Research Lab",
    cards: "Gift Workshop",
    icons: "Brand Lab",
    shipping: "Logistics Lab",
    checks: "Finance Lab",
    wallet: "Neural Assets",
    mockInterview: "Mock Interview",
    graph: "Logic Visualizer",
    story: "Project Story",
    bible: "Scripture Sanctuary",
    mentorship: "Experts",
    docs: "Documents",
    bookStudio: "Author Studio",
    proRequired: "Pro Access Required",
    upgradeNow: "Unlock Full Spectrum",
    proDesc: "Access to 20+ specialized neural tools is reserved for Pro members.",
    standardHub: "Standard Hub",
    lockedSpectrum: "Locked Neural Spectrum",
    fullSpectrum: "Full Neural Spectrum",
    verifiedMember: "Pro Member Verified",
    upgradeBtn: "Upgrade to Unlock 24 Apps",
    interviewExp: "Software Interview",
    kernelExp: "Linux Kernel Audit",
    geminiExp: "Gemini Expert",
    dashboard: "Prism Home",
    systemLog: "System Log Trace (RAW)",
    diagnosticConsole: "Neural Diagnostics Console (PROBE ACTIVE)",
    awaitingActivity: "Awaiting neural activity...",
    manifest: "Feature Integrity Manifest",
    pause: "Pause",
    resume: "Resume",
    copyTop10: "Copy Top 10"
  },
  zh: {
    appTitle: "神经棱镜",
    directory: "发现",
    search: "搜索活动...",
    magic: "智能语音",
    podcasts: "活动中心",
    mission: "愿景",
    code: "构建者工作室",
    whiteboard: "视觉画布",
    chat: "团队空间",
    careers: "人才中心",
    notebooks: "研究实验室",
    cards: "礼物工坊",
    icons: "品牌实验室",
    shipping: "物流实验室",
    checks: "财务实验室",
    wallet: "神经资产",
    mockInterview: "模拟面试",
    graph: "逻辑可视化",
    story: "项目故事",
    bible: "经文圣所",
    mentorship: "专家导师",
    docs: "文档空间",
    bookStudio: "作家工作室",
    proRequired: "需要 Pro 权限",
    upgradeNow: "解锁全光谱",
    proDesc: "20+ 专业神经工具仅限 Pro 会员使用。",
    standardHub: "标准中心",
    lockedSpectrum: "已锁定的神经光谱",
    fullSpectrum: "全神经光谱",
    verifiedMember: "Pro 会员已验证",
    upgradeBtn: "升级解锁 24 个应用",
    interviewExp: "软件工程师面试",
    kernelExp: "Linux 内核审计",
    geminiExp: "Gemini 专家",
    dashboard: "棱镜主页",
    systemLog: "系统日志追踪 (RAW)",
    diagnosticConsole: "神经诊断控制台 (探测器活跃)",
    awaitingActivity: "等待神经 activity...",
    manifest: "功能完整性清单",
    pause: "暂停",
    resume: "恢复",
    copyTop10: "复制前10条"
  }
};

const PUBLIC_VIEWS: ViewID[] = ['mission', 'story', 'privacy', 'user_guide', 'check_viewer']; 
const FREE_VIEWS: ViewID[] = ['directory', 'podcast_detail', 'dashboard', 'groups'];

const isRestrictedView = (v: string): boolean => {
    const safeSet = [...PUBLIC_VIEWS, ...FREE_VIEWS];
    return !safeSet.includes(v as any);
};

interface SystemLogMsg {
    id: string;
    time: string;
    text: string;
    type: 'info' | 'error' | 'success' | 'warn';
}

const App: React.FC = () => {
  const [language, setLanguage] = useState<'en' | 'zh'>('en');
  const t = UI_TEXT[language];
  
  const [activeViewID, setActiveViewID] = useState<ViewID>(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get('view') as ViewID;
    return v || 'dashboard';
  });

  const [activeChannelId, setActiveChannelId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('channelId'));
  const [activeItemId, setActiveItemId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('id'));
  const [isAppsMenuOpen, setIsAppsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // --- STABILITY CORE: Throttled Neural Log Buffer ---
  const [showConsole, setShowConsole] = useState(false);
  const [isLogPaused, setIsLogPaused] = useState(false);
  const [visibleLogs, setVisibleLogs] = useState<SystemLogMsg[]>([]);
  const logBufferRef = useRef<SystemLogMsg[]>([]);
  const lastUpdateRef = useRef<number>(0);

  // Log Batcher: Decouples neural activity from the render cycle
  useEffect(() => {
    const interval = setInterval(() => {
        const now = Date.now();
        if (isLogPaused || logBufferRef.current.length === 0) return;
        if (now - lastUpdateRef.current < 800) return;

        setVisibleLogs(prev => {
            const combined = [...logBufferRef.current, ...prev].slice(0, 100);
            logBufferRef.current = [];
            lastUpdateRef.current = now;
            return combined;
        });
    }, 800);
    return () => clearInterval(interval);
  }, [isLogPaused]);

  const addSystemLog = useCallback((text: string, type: SystemLogMsg['type'] = 'info') => {
      // De-duplication at ingestion
      if (logBufferRef.current.length > 0 && logBufferRef.current[0].text === text) return;
      
      logBufferRef.current.unshift({ 
          id: Math.random().toString(), 
          time: new Date().toLocaleTimeString(), 
          text, 
          type 
      });
  }, []);

  useEffect(() => {
    const handleGlobalLog = (e: any) => {
        const { text, type } = e.detail || {};
        if (text) addSystemLog(text, type || 'info');
    };
    window.addEventListener('neural-log', handleGlobalLog);
    return () => window.removeEventListener('neural-log', handleGlobalLog);
  }, [addSystemLog]);

  const [currentUser, setCurrentUser] = useState<any>(() => getSovereignSession().user);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => getSovereignSession().profile);
  const [authLoading, setAuthLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [publicChannels, setPublicChannels] = useState<Channel[]>([]);
  const [userChannels, setUserChannels] = useState<Channel[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isVoiceCreateOpen, setIsVoiceCreateOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [channelToComment, setChannelToComment] = useState<Channel | null>(null);
  const [channelToEdit, setChannelToEdit] = useState<Channel | null>(null);

  const isSuperAdmin = useMemo(() => {
      if (!currentUser) return false;
      return currentUser.email?.toLowerCase() === 'shengliang.song.ai@gmail.com' || isUserAdmin(userProfile);
  }, [userProfile, currentUser]);

  const isProMember = useMemo(() => {
    if (isSuperAdmin) return true;
    return userProfile?.subscriptionTier === 'pro';
  }, [userProfile, isSuperAdmin]);

  const handleSetViewState = useCallback((target: ViewID, params: Record<string, string> = {}) => {
    if (isRestrictedView(target) && !isProMember) {
        setIsAppsMenuOpen(false);
        setIsPricingModalOpen(true);
        addSystemLog(`Clearance Denied: View ${target} requires Pro membership.`, 'warn');
        return;
    }

    addSystemLog(`Navigation Transit: ${activeViewID} -> ${target}`, 'info');
    stopAllPlatformAudio(`Nav:${activeViewID}->${target}`);
    setActiveViewID(target);
    setActiveChannelId(params.channelId || null);
    setActiveItemId(params.id || null);
    setIsAppsMenuOpen(false); 
    setIsUserMenuOpen(false);
    
    const url = new URL(window.location.href);
    url.searchParams.forEach((_, k) => url.searchParams.delete(k));
    if (target !== 'dashboard') url.searchParams.set('view', target);
    Object.keys(params).forEach(k => url.searchParams.set(k, params[k]));
    window.history.pushState({}, '', url.toString());
  }, [activeViewID, isProMember, addSystemLog]);

  const handleUpdateLanguage = useCallback(async (newLang: 'en' | 'zh') => {
      setLanguage(newLang);
      addSystemLog(`Spectrum linguistic shift: ${newLang.toUpperCase()}`, 'info');
      if (currentUser && !isJudgeSession()) {
          try {
              await updateUserProfile(currentUser.uid, { languagePreference: newLang });
          } catch(e) {}
      }
  }, [currentUser, addSystemLog]);

  useEffect(() => {
    const guard = () => {
        const params = new URLSearchParams(window.location.search);
        const urlView = (params.get('view') as ViewID) || 'dashboard';
        
        if (isRestrictedView(urlView) && !isProMember && !authLoading && currentUser && userProfile) {
            setActiveViewID('dashboard');
            window.history.replaceState({}, '', window.location.origin + '?view=dashboard');
        }
    };
    guard();
    window.addEventListener('popstate', guard);
    return () => window.removeEventListener('popstate', guard);
  }, [isProMember, authLoading, currentUser, userProfile]);

  const handleStartLiveSession = useCallback((channel: Channel, context?: string, recordingEnabled?: boolean, bookingId?: string) => {
    const isSpecialized = ['1', '2', 'default-gem'].includes(channel.id);
    if (isSpecialized && !isProMember) {
        setIsPricingModalOpen(true);
        return;
    }
    addSystemLog(`Neural Link Initializing: Channel [${channel.title}]`, 'success');
    setLiveSessionParams({ channel, context, recordingEnabled, bookingId, returnTo: activeViewID });
    handleSetViewState('live_session');
  }, [activeViewID, handleSetViewState, isProMember, addSystemLog]);

  const [liveSessionParams, setLiveSessionParams] = useState<any>(null);

  const appsByTier = useMemo(() => {
    const list = [
        { id: 'dashboard', label: t.dashboard, icon: LayoutGrid, action: () => handleSetViewState('dashboard'), color: 'text-indigo-400', restricted: false },
        { id: 'directory', label: t.podcasts, icon: Podcast, action: () => handleSetViewState('directory'), color: 'text-indigo-400', restricted: false },
        { id: 'bible_study', label: t.bible, icon: Scroll, action: () => handleSetViewState('bible_study'), color: 'text-amber-500', restricted: false },
        { id: 'mission', label: t.mission, icon: Rocket, action: () => handleSetViewState('mission'), color: 'text-orange-500', restricted: false },
        { id: 'story', label: t.story, icon: BookOpen, action: () => handleSetViewState('story'), color: 'text-cyan-400', restricted: false },
        { id: 'book_studio', label: t.bookStudio, icon: BookText, action: () => handleSetViewState('book_studio'), color: 'text-indigo-500', restricted: false },
        { id: 'interview_expert', label: t.interviewExp, icon: GraduationCap, action: () => { const ch = HANDCRAFTED_CHANNELS.find(c => c.id === '1'); if (ch) handleStartLiveSession(ch); }, color: 'text-red-400', restricted: true },
        { id: 'kernel_expert', label: t.kernelExp, icon: Cpu, action: () => { const ch = HANDCRAFTED_CHANNELS.find(c => c.id === '2'); if (ch) handleStartLiveSession(ch); }, color: 'text-indigo-400', restricted: true },
        { id: 'gemini_expert', label: t.geminiExp, icon: Star, action: () => { const ch = HANDCRAFTED_CHANNELS.find(c => c.id === 'default-gem'); if (ch) handleStartLiveSession(ch); }, color: 'text-emerald-400', restricted: true },
        { id: 'mock_interview', label: t.mockInterview, icon: Video, action: () => handleSetViewState('mock_interview'), color: 'text-red-500', restricted: true },
        { id: 'graph_studio', label: t.graph, icon: Activity, action: () => handleSetViewState('graph_studio'), color: 'text-emerald-400', restricted: true },
        { id: 'coin_wallet', label: t.wallet, icon: Coins, action: () => handleSetViewState('coin_wallet'), color: 'text-amber-400', restricted: true },
        { id: 'docs', label: t.docs, icon: FileText, action: () => handleSetViewState('docs'), color: 'text-emerald-400', restricted: true },
        { id: 'check_designer', label: t.checks, icon: Wallet, action: () => handleSetViewState('check_designer'), color: 'text-orange-400', restricted: true },
        { id: 'chat', label: t.chat, icon: MessageSquare, action: () => handleSetViewState('chat'), color: 'text-blue-400', restricted: true },
        { id: 'mentorship', label: t.mentorship, icon: Users, action: () => handleSetViewState('mentorship'), color: 'text-emerald-400', restricted: true },
        { id: 'shipping_labels', label: t.shipping, icon: Truck, action: () => handleSetViewState('shipping_labels'), color: 'text-emerald-400', restricted: true },
        { id: 'icon_generator', label: t.icons, icon: AppWindow, action: () => handleSetViewState('icon_generator'), color: 'text-cyan-400', restricted: true },
        { id: 'code_studio', label: t.code, icon: Code, action: () => handleSetViewState('code_studio'), color: 'text-blue-400', restricted: true },
        { id: 'notebook_viewer', label: t.notebooks, icon: Book, action: () => handleSetViewState('notebook_viewer'), color: 'text-orange-300', restricted: true },
        { id: 'whiteboard', label: t.whiteboard, icon: PenTool, action: () => handleSetViewState('whiteboard'), color: 'text-pink-400', restricted: true },
    ];
    return {
        free: list.filter(a => !a.restricted),
        pro: list.filter(a => a.restricted)
    };
  }, [t, handleStartLiveSession, handleSetViewState]);

  useEffect(() => {
    addSystemLog("Initializing Sovereignty Protocols...", "info");
    const unsub = onAuthStateChanged(auth, async (u) => {
        if (u) {
            setCurrentUser(u);
            addSystemLog(`Identity Verified: ${u.email}`, "success");
            syncUserProfile(u).catch(console.error);
            onSnapshot(doc(db, 'users', u.uid), s => { 
                if(s.exists()) {
                    const profile = s.data() as UserProfile;
                    setUserProfile(profile);
                    if (profile.languagePreference && profile.languagePreference !== language) {
                        setLanguage(profile.languagePreference);
                    }
                }
            });
        } else { 
            if (isJudgeSession()) {
                const { user, profile } = getSovereignSession();
                if (user) {
                    setCurrentUser(user);
                    if (profile) setUserProfile(profile);
                    addSystemLog("Security Override: Judge Session Active.", "success");
                }
            } else {
                setCurrentUser(null);
                setUserProfile(null);
                addSystemLog("Anonymous Probe Active.", "warn");
            }
        }
        setAuthLoading(false);
    });
    return () => unsub();
  }, [language, addSystemLog]);

  useEffect(() => {
    subscribeToPublicChannels(setPublicChannels);
    getUserChannels().then(setUserChannels);
  }, []);

  const allChannels = useMemo(() => {
      const map = new Map<string, Channel>();
      HANDCRAFTED_CHANNELS.forEach(c => map.set(c.id, c));
      publicChannels.forEach(c => map.set(c.id, c));
      userChannels.forEach(c => map.set(c.id, c));
      return Array.from(map.values());
  }, [publicChannels, userChannels]);

  const handleUpdateChannel = useCallback(async (updated: Channel) => {
      await saveUserChannel(updated);
      setUserChannels(prev => prev.map(c => c.id === updated.id ? updated : c));
      if (updated.visibility === 'public') await publishChannelToFirestore(updated);
      addSystemLog(`Registry updated for: ${updated.title}`, 'info');
  }, [addSystemLog]);

  const handleCreateChannel = async (newChannel: Channel) => {
      await saveUserChannel(newChannel);
      setUserChannels(prev => [newChannel, ...prev]);
      setActiveChannelId(newChannel.id);
      addSystemLog(`New activity synthesized: ${newChannel.title}`, 'success');
      handleSetViewState('podcast_detail', { channelId: newChannel.id });
  };

  const handleCopyTop10 = () => {
    const top10 = visibleLogs.slice(0, 10).map(log => `[${log.time}] [${log.type.toUpperCase()}] ${log.text}`).join('\n');
    navigator.clipboard.writeText(top10);
    addSystemLog("Top 10 trace copied to clipboard.", "success");
  };

  const activeChannel = useMemo(() => 
    allChannels.find(c => c.id === activeChannelId),
    [allChannels, activeChannelId]
  );

  const handleDetailBack = useCallback(() => handleSetViewState('directory'), [handleSetViewState]);

  const GuardedView = ({ id, children }: { id: ViewID; children?: ReactNode }) => {
      if (isRestrictedView(id) && !isProMember) {
          return (
            <div className="h-full w-full flex items-center justify-center bg-slate-950 p-6">
                <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-[3.5rem] p-12 text-center shadow-2xl relative overflow-hidden animate-fade-in-up">
                    <div className="absolute top-0 right-0 p-32 bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none"></div>
                    <div className="w-20 h-20 bg-slate-950 rounded-3xl border border-indigo-500/30 flex items-center justify-center mx-auto mb-8 shadow-inner">
                        <Lock size={40} className="text-indigo-500" />
                    </div>
                    <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-4">{t.proRequired}</h2>
                    <p className="text-slate-400 text-sm mb-10 leading-relaxed font-medium">{t.proDesc}</p>
                    <button onClick={() => setIsPricingModalOpen(true)} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-95">{t.upgradeNow}</button>
                </div>
            </div>
          );
      }
      return <div className="h-full w-full relative flex flex-col">
          {isSuperAdmin && isRestrictedView(id) && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none bg-indigo-600 text-white px-3 py-1 rounded-full border border-indigo-400 text-[9px] font-black uppercase tracking-[0.2em] shadow-2xl flex items-center gap-2">
                  <ShieldCheck size={12}/> Root Bypass Active
              </div>
          )}
          {children}
      </div>;
  };

  const showMagicCreator = activeViewID === 'directory' || activeViewID === 'podcast_detail';

  if (authLoading) return <div className="h-screen bg-slate-950 flex flex-col items-center justify-center gap-4"><Loader2 className="animate-spin text-indigo-500" size={32} /><span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Initializing Spectrum...</span></div>;
  if (!currentUser && !PUBLIC_VIEWS.includes(activeViewID)) return <LoginPage onMissionClick={() => handleSetViewState('mission')} onStoryClick={() => handleSetViewState('story')} onPrivacyClick={() => handleSetViewState('privacy')} />;

  return (
    <ErrorBoundary>
      <div className="h-screen flex flex-col bg-slate-950 text-slate-50 overflow-hidden relative">
        <header className="min-h-[4rem] pt-[env(safe-area-inset-top)] border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-4 shrink-0 z-50 backdrop-blur-xl">
           <div className="flex items-center gap-3">
              <div className="relative">
                <button onClick={() => setIsAppsMenuOpen(!isAppsMenuOpen)} className={`p-1.5 rounded-lg transition-all ${isAppsMenuOpen ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`} aria-label="Launcher"><LayoutGrid size={20} /></button>
                {isAppsMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-[100]" onClick={() => setIsAppsMenuOpen(false)}></div>
                    <div className="absolute left-0 top-full mt-3 w-80 md:w-[480px] bg-slate-900 border border-slate-700 rounded-[2.5rem] shadow-2xl overflow-hidden animate-fade-in-up z-[110] flex flex-col border-indigo-500/20">
                      
                      {!isProMember && (
                          <>
                            <div className="p-4 bg-slate-950/50 border-b border-slate-800 flex justify-between items-center">
                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t.standardHub}</h3>
                                <span className="text-[9px] font-black bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">FREE</span>
                            </div>
                            <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-1">
                                {appsByTier.free.map(app => (
                                    <button key={app.id} onClick={() => { app.action(); setIsAppsMenuOpen(false); }} className="flex items-center gap-3 p-3 rounded-xl hover:bg-indigo-600/10 transition-all group">
                                        <div className="p-2 rounded-lg bg-slate-800 border border-slate-700 group-hover:border-indigo-500/30"><app.icon size={16} className={app.color}/></div>
                                        <span className="text-xs font-bold text-slate-300 group-hover:text-white">{app.label}</span>
                                    </button>
                                ))}
                            </div>
                            
                            <div className="m-3 p-5 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl shadow-xl relative overflow-hidden group/upgrade">
                                <div className="absolute top-0 right-0 p-12 bg-white/10 blur-3xl rounded-full group-hover/upgrade:scale-110 transition-transform"></div>
                                <div className="relative z-10">
                                    <h4 className="text-white font-black uppercase italic tracking-tighter text-lg">{t.upgradeBtn}</h4>
                                    <p className="text-indigo-100 text-[10px] mt-1 font-medium">Unlock Builder Studio, Interview Lab, and more.</p>
                                    <button onClick={() => { setIsPricingModalOpen(true); setIsAppsMenuOpen(false); }} className="mt-4 w-full py-2 bg-white text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:scale-[1.02] transition-transform active:scale-95">Upgrade Membership Now</button>
                                </div>
                            </div>

                            <div className="px-4 py-2 bg-slate-950/50 border-y border-slate-800 flex items-center gap-2">
                                <Lock size={10} className="text-slate-600"/>
                                <h3 className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{t.lockedSpectrum}</h3>
                            </div>
                            <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-1 opacity-40 grayscale pointer-events-none">
                                {appsByTier.pro.slice(0, 4).map(app => (
                                    <div key={app.id} className="flex items-center gap-3 p-3">
                                        <div className="p-2 rounded-lg bg-slate-900 border border-slate-800"><app.icon size={16} className="text-slate-600"/></div>
                                        <span className="text-xs font-bold text-slate-600">{app.label}</span>
                                    </div>
                                ))}
                            </div>
                          </>
                      )}

                      {isProMember && (
                          <>
                            <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">{t.fullSpectrum}</h3>
                                    <Sparkles size={12} className="text-indigo-400 animate-pulse" />
                                </div>
                                <div className="flex items-center gap-1.5 bg-indigo-600 text-white px-2 py-0.5 rounded-full shadow-lg border border-indigo-400/50">
                                    <Crown size={10} fill="currentColor"/>
                                    <span className="text-[8px] font-black uppercase">Refracted</span>
                                </div>
                            </div>
                            <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-1 max-h-[60vh] overflow-y-auto scrollbar-hide">
                                {[...appsByTier.free, ...appsByTier.pro].map(app => (
                                    <button key={app.id} onClick={() => { app.action(); setIsAppsMenuOpen(false); }} className="flex items-center gap-3 p-3 rounded-xl hover:bg-indigo-600/10 transition-all group border border-transparent hover:border-indigo-500/10">
                                        <div className={`p-2 rounded-lg bg-slate-800 border border-slate-700 group-hover:border-indigo-500/30 group-hover:shadow-lg transition-all`}><app.icon size={16} className={app.color}/></div>
                                        <span className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors">{app.label}</span>
                                    </button>
                                ))}
                            </div>
                            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-center">
                                <span className="text-[8px] font-black text-emerald-500 uppercase tracking-[0.3em] flex items-center gap-1.5"><ShieldCheck size={12}/> {t.verifiedMember}</span>
                            </div>
                          </>
                      )}
                    </div>
                  </>
                )}
              </div>
              <div 
                className="flex items-center gap-3 cursor-pointer group" 
                onClick={() => window.location.assign(window.location.origin)}
                title="Reload Site (Get Latest Version)"
              >
                 <BrandLogo size={32} />
                 <h1 className="text-xl font-black italic uppercase tracking-tighter hidden sm:block group-hover:text-indigo-400 transition-colors">Neural Prism</h1>
              </div>
           </div>

           <div className="flex items-center gap-3 sm:gap-4">
              <button 
                  onClick={() => setShowConsole(!showConsole)} 
                  className={`p-2 transition-all rounded-lg ${showConsole ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                  title="Neural Diagnostics (Pulse Monitoring)"
              >
                  <Bug size={18} className={!showConsole ? 'animate-pulse text-red-500' : ''} />
              </button>
              <button 
                  onClick={() => window.location.reload()} 
                  className="p-2 text-slate-400 hover:text-white transition-colors"
                  title="Reload Web App"
              >
                  <RefreshCcw size={18} />
              </button>
              {userProfile && (
                  <button onClick={() => handleSetViewState('coin_wallet')} className="flex items-center gap-2 px-3 py-1.5 bg-amber-900/20 hover:bg-amber-900/40 text-amber-400 rounded-full border border-amber-500/30 transition-all hidden sm:flex">
                      <Coins size={16}/><span className="font-black text-xs">{userProfile.coinBalance || 0}</span>
                  </button>
              )}
              {showMagicCreator && (
                <button onClick={() => isProMember ? setIsVoiceCreateOpen(true) : setIsPricingModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all active:scale-95">
                    {!isProMember && <Lock size={12} className="mr-0.5 text-indigo-300"/>}
                    <span>{t.magic}</span>
                </button>
              )}
              <div className="relative">
                 <button onClick={() => { setIsUserMenuOpen(!isUserMenuOpen); setIsAppsMenuOpen(false); }} className="w-10 h-10 rounded-full border-2 border-slate-700 overflow-hidden hover:border-indigo-500 transition-colors">
                    <img src={currentUser?.photoURL || `https://ui-avatars.com/api/?name=${currentUser?.displayName}`} alt="Profile" className="w-full h-full object-cover" />
                 </button>
                 <StudioMenu isUserMenuOpen={isUserMenuOpen} setIsUserMenuOpen={setIsUserMenuOpen} currentUser={currentUser} userProfile={userProfile} setUserProfile={setUserProfile} globalVoice="Auto" setGlobalVoice={()=>{}} setIsCreateModalOpen={setIsCreateModalOpen} setIsVoiceCreateOpen={setIsVoiceCreateOpen} onUpgradeClick={() => setIsPricingModalOpen(true)} setIsSyncModalOpen={()=>{}} setIsSettingsModalOpen={setIsSettingsModalOpen} onOpenUserGuide={() => handleSetViewState('user_guide')} onNavigate={(v) => handleSetViewState(v as any)} onOpenPrivacy={() => handleSetViewState('privacy')} t={t} language={language} setLanguage={handleUpdateLanguage} channels={allChannels} isSuperAdmin={isSuperAdmin} isProMember={isProMember} />
              </div>
           </div>
        </header>

        <main className="flex-1 overflow-hidden relative flex flex-col pb-10">
            <GuardedView id={activeViewID}>
                {activeViewID === 'dashboard' && ( <Dashboard userProfile={userProfile} isProMember={isProMember} onNavigate={handleSetViewState} language={language} /> )}
                {activeViewID === 'directory' && ( <PodcastFeed channels={allChannels} onChannelClick={(id) => { setActiveChannelId(id); handleSetViewState('podcast_detail', { channelId: id }); }} onStartLiveSession={handleStartLiveSession} userProfile={userProfile} globalVoice="Auto" currentUser={currentUser} t={t} setChannelToEdit={setChannelToEdit} setIsSettingsModalOpen={setIsSettingsModalOpen} onCommentClick={setChannelToComment} handleVote={()=>{}} searchQuery={searchQuery} setSearchQuery={setSearchQuery} onNavigate={(v) => handleSetViewState(v as any)} onUpdateChannel={handleUpdateChannel} onOpenPricing={() => setIsPricingModalOpen(true)} language={language} /> )}
                {activeViewID === 'podcast_detail' && activeChannel && ( <PodcastDetail channel={activeChannel} onBack={handleDetailBack} onStartLiveSession={handleStartLiveSession} language={language} currentUser={currentUser} userProfile={userProfile} onUpdateChannel={handleUpdateChannel} isProMember={isProMember} /> )}
                {activeViewID === 'live_session' && liveSessionParams && ( <LiveSession channel={liveSessionParams.channel} onEndSession={() => handleSetViewState(liveSessionParams.returnTo || 'directory')} language={language} initialContext={liveSessionParams.context} recordingEnabled={liveSessionParams.recordingEnabled} lectureId={liveSessionParams.bookingId} /> )}
                {activeViewID === 'docs' && ( <div className="p-8 max-w-5xl mx-auto h-full overflow-y-auto"><DocumentList onBack={() => handleSetViewState('dashboard')} /></div> )}
                {activeViewID === 'code_studio' && ( <CodeStudio onBack={() => handleSetViewState('dashboard')} currentUser={currentUser} userProfile={userProfile} onSessionStart={()=>{}} onSessionStop={()=>{}} onStartLiveSession={()=>{}} isProMember={isProMember}/> )}
                {activeViewID === 'whiteboard' && ( <Whiteboard onBack={() => handleSetViewState('dashboard')} /> )}
                {activeViewID === 'blog' && ( <BlogView currentUser={currentUser} onBack={() => handleSetViewState('dashboard')} /> )}
                {activeViewID === 'chat' && ( <WorkplaceChat onBack={() => handleSetViewState('dashboard')} currentUser={currentUser} /> )}
                {activeViewID === 'careers' && ( <CareerCenter onBack={() => handleSetViewState('dashboard')} currentUser={currentUser} jobId={activeItemId || undefined} /> )}
                {activeViewID === 'calendar' && ( <CalendarView channels={allChannels} handleChannelClick={(id) => { setActiveChannelId(id); handleSetViewState('podcast_detail', { channelId: id }); }} handleVote={()=>{}} currentUser={currentUser} setChannelToEdit={setChannelToEdit} setIsSettingsModalOpen={setIsSettingsModalOpen} globalVoice="Auto" t={t} onCommentClick={setChannelToComment} onStartLiveSession={handleStartLiveSession} onCreateChannel={handleCreateChannel} onSchedulePodcast={() => setIsCreateModalOpen(true)} /> )}
                {activeViewID === 'mentorship' && ( <div className="h-full overflow-y-auto"><MentorBooking currentUser={currentUser} userProfile={userProfile} channels={allChannels} onStartLiveSession={handleStartLiveSession} /></div> )}
                {activeViewID === 'recordings' && ( <div className="p-8 max-w-5xl mx-auto h-full overflow-y-auto"><RecordingList onBack={() => handleSetViewState('dashboard')} onStartLiveSession={handleStartLiveSession} /></div> )}
                {(activeViewID === 'check_designer' || activeViewID === 'check_viewer') && ( <CheckDesigner onBack={() => handleSetViewState('dashboard')} currentUser={currentUser} userProfile={userProfile} isProMember={isProMember} /> )}
                {activeViewID === 'shipping_labels' && ( <ShippingLabelApp onBack={() => handleSetViewState('dashboard')} /> )}
                {activeViewID === 'icon_generator' && ( <IconGenerator onBack={() => handleSetViewState('dashboard')} currentUser={currentUser} iconId={activeItemId || undefined} isProMember={isProMember} /> )}
                {activeViewID === 'notebook_viewer' && ( <NotebookViewer onBack={() => handleSetViewState('dashboard')} currentUser={currentUser} notebookId={activeItemId || undefined} /> )}
                {(activeViewID === 'card_workshop' || activeViewID === 'card_viewer') && ( <CardWorkshop onBack={() => handleSetViewState('dashboard')} cardId={activeItemId || undefined} isViewer={activeViewID === 'card_viewer' || !!activeItemId} /> )}
                {activeViewID === 'mission' && ( <MissionManifesto onBack={() => handleSetViewState('dashboard')} /> )}
                {activeViewID === 'firestore_debug' && ( <FirestoreInspector onBack={() => handleSetViewState('dashboard')} userProfile={userProfile} /> )}
                {activeViewID === 'coin_wallet' && ( <CoinWallet onBack={() => handleSetViewState('dashboard')} user={userProfile} /> )}
                {activeViewID === 'mock_interview' && ( <MockInterview onBack={() => handleSetViewState('dashboard')} userProfile={userProfile} onStartLiveSession={handleStartLiveSession} isProMember={isProMember} /> )}
                {activeViewID === 'graph_studio' && ( <GraphStudio onBack={() => handleSetViewState('dashboard')} isProMember={isProMember} /> )}
                {activeViewID === 'story' && ( <ProjectStory onBack={() => handleSetViewState('dashboard')} /> )}
                {activeViewID === 'privacy' && ( <PrivacyPolicy onBack={() => handleSetViewState('dashboard')} /> )}
                {activeViewID === 'user_guide' && ( <UserManual onBack={() => handleSetViewState('dashboard')} /> )}
                {activeViewID === 'bible_study' && ( <ScriptureSanctuary onBack={() => handleSetViewState('dashboard')} language={language} isProMember={isProMember} /> )}
                {activeViewID === 'groups' && ( <GroupManager currentUser={currentUser} userProfile={userProfile} /> )}
                {activeViewID === 'book_studio' && ( <BookStudio onBack={() => handleSetViewState('dashboard')} /> )}
            </GuardedView>
        </main>

        <div className={`fixed bottom-0 left-0 right-0 z-[1000] transition-all duration-500 transform ${showConsole ? 'translate-y-0' : 'translate-y-[calc(100%-40px)]'}`}>
            <div className="bg-slate-950 border-t-2 border-red-500 shadow-[0_-20px_100px_-10px_rgba(239,68,68,0.4)] backdrop-blur-3xl">
                <button 
                    onClick={() => setShowConsole(!showConsole)}
                    className="w-full h-10 flex items-center justify-center gap-3 bg-slate-900 border-b border-slate-800 hover:bg-slate-800 transition-colors group"
                >
                    <Bug size={14} className={showConsole ? 'text-red-400' : 'text-slate-50'} />
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 group-hover:text-white transition-colors">{t.diagnosticConsole}</span>
                    {showConsole ? <ChevronDown size={14} className="text-slate-500"/> : <ChevronUp size={14} className="text-slate-500"/>}
                </button>
                
                <div className="h-96 overflow-hidden flex flex-col md:flex-row">
                    <div className="w-full md:w-80 border-r border-white/5 p-6 space-y-6 overflow-y-auto shrink-0 bg-black/60 scrollbar-hide">
                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-2">
                                <Fingerprint size={12}/> Neural Fingerprint
                            </h4>
                            <div className="space-y-2 text-[10px] font-mono text-left">
                                <div className="flex justify-between items-center py-1 border-b border-white/5">
                                    <span className="text-slate-500 uppercase">Status:</span>
                                    <span className={currentUser ? 'text-emerald-400' : 'text-red-400'}>{currentUser ? 'VERIFIED' : 'ANONYMOUS'}</span>
                                </div>
                                <div className="flex flex-col gap-1 py-1 border-b border-white/5">
                                    <span className="text-slate-500">ID:</span>
                                    <span className="text-white break-all text-[8px]">{currentUser?.uid || 'GUEST_PROBE'}</span>
                                </div>
                                <div className="flex justify-between items-center py-1 border-b border-white/5">
                                    <span className="text-slate-500 uppercase">Clearance:</span>
                                    <span className="text-indigo-400 font-bold uppercase">{userProfile?.subscriptionTier || 'LEVEL_0'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                <Database size={12}/> {t.manifest}
                            </h4>
                            <div className="space-y-1 max-h-32 overflow-y-auto pr-2 scrollbar-thin">
                                {[
                                    'Builder Studio', 'Finance Lab', 'Logistics Lab', 'Activity Hub', 
                                    'Scripture Sanctuary', 'Gift Workshop', 'Brand Lab', 'Career Center',
                                    'Mock Interview', 'Logic Visualizer', 'Research Lab', 'Team Space',
                                    'Voice Feed', 'Member Hub', 'Sovereign Vault', 'VoiceCoin Ledger'
                                ].map(f => (
                                    <div key={f} className="flex items-center gap-2 text-[9px] text-slate-400">
                                        <CheckCircle size={8} className="text-emerald-500"/>
                                        <span className="uppercase font-bold tracking-tighter">{f}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="pt-4 flex flex-col gap-2">
                            <button onClick={() => { logBufferRef.current = []; setVisibleLogs([]); addSystemLog("Neural Log Buffer Purged.", "info"); }} className="w-full py-2 bg-slate-800 text-slate-400 text-[9px] font-black uppercase rounded-lg border border-slate-700 hover:text-white transition-all shadow-lg active:scale-95">
                                Clear Buffer
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col min-w-0 bg-black/80">
                        <div className="px-6 py-3 border-b border-white/5 flex items-center justify-between bg-slate-900/40">
                            <div className="flex items-center gap-2">
                                <Terminal size={14} className="text-red-400"/>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.systemLog}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => setIsLogPaused(!isLogPaused)} 
                                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${isLogPaused ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'}`}
                                >
                                    {isLogPaused ? <PlayIcon size={12}/> : <Pause size={12}/>}
                                    {isLogPaused ? t.resume : t.pause}
                                </button>
                                <button 
                                    onClick={handleCopyTop10}
                                    className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white border border-slate-700 rounded-md text-[9px] font-black uppercase tracking-widest transition-all"
                                >
                                    <Copy size={12}/>
                                    {t.copyTop10}
                                </button>
                                <span className="text-[8px] font-mono text-slate-600 animate-pulse uppercase ml-2">Diagnostic Probe Stream</span>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-2 scrollbar-thin scrollbar-thumb-white/10 text-left">
                            {visibleLogs.length === 0 && (
                                <p className="text-slate-700 italic text-xs">{t.awaitingActivity}</p>
                            )}
                            {visibleLogs.map(log => (
                                <div key={log.id} className={`flex gap-4 text-[11px] font-mono p-2 rounded ${
                                    log.type === 'error' ? 'bg-red-950/40 text-red-200 border border-red-500/30 shadow-[0_0_10px_rgba(255,0,0,0.1)]' :
                                    log.type === 'success' ? 'bg-emerald-950/20 text-emerald-400' :
                                    log.type === 'warn' ? 'bg-amber-950/20 text-amber-400' :
                                    'text-slate-400'
                                }`}>
                                    <span className="opacity-40 shrink-0">[{log.time}]</span>
                                    <span className="flex-1 whitespace-pre-wrap">{log.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <CreateChannelModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onCreate={handleCreateChannel} currentUser={currentUser} />
        <VoiceCreateModal isOpen={isVoiceCreateOpen} onClose={() => setIsVoiceCreateOpen(false)} onCreate={handleCreateChannel} />
        <PricingModal isOpen={isPricingModalOpen} onClose={() => setIsPricingModalOpen(false)} user={userProfile} onSuccess={(tier) => { if(userProfile) setUserProfile({...userProfile, subscriptionTier: tier}); }} />
        {currentUser && ( <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} user={userProfile || { uid: currentUser.uid, email: currentUser.email, displayName: currentUser.displayName, photoURL: currentUser.photoURL, groups: [], coinBalance: 0, createdAt: Date.now(), lastLogin: Date.now(), subscriptionTier: 'free', apiUsageCount: 0 } as UserProfile} onUpdateProfile={setUserProfile} onUpgradeClick={() => setIsPricingModalOpen(true)} isSuperAdmin={isSuperAdmin} onNavigateAdmin={() => handleSetViewState('firestore_debug')} /> )}
        {channelToComment && ( <CommentsModal isOpen={true} onClose={() => setChannelToComment(null)} channel={channelToComment} onAddComment={()=>{}} currentUser={currentUser} /> )}
        {channelToEdit && ( <ChannelSettingsModal isOpen={true} onClose={() => setChannelToEdit(null)} channel={channelToEdit} onUpdate={handleUpdateChannel} /> )}
      </div>
    </ErrorBoundary>
  );
};

export default App;
