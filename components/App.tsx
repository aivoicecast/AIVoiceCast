import React, { useState, useEffect, useMemo, useCallback, ErrorInfo, ReactNode, Component, useRef } from 'react';
import { 
  Podcast, Search, LayoutGrid, RefreshCw, 
  Home, Video, User, ArrowLeft, Play, Gift, 
  Calendar, Briefcase, Users, Disc, FileText, Code, Wand2, PenTool, Rss, Loader2, MessageSquare, AppWindow, Square, Menu, X, Shield, Plus, Rocket, Book, AlertTriangle, Terminal, Trash2, LogOut, Truck, Maximize2, Minimize2, Wallet, Sparkles, Coins, Cloud, ChevronDown, Command, Activity, BookOpen, Scroll, GraduationCap, Cpu, Star, Lock, Crown, ShieldCheck, Flame, Zap, RefreshCcw, Bug, ChevronUp, Fingerprint, Database, CheckCircle, Pause, PlayCircle as PlayIcon, Copy, BookText, Send, MessageCircle, FileUp, FileSignature, IdCard, Info, BarChart3, Target, Beaker, Ghost, Signal,
  ShieldAlert, ChevronRight, ChevronLeft, ArrowDownRight, ArrowUpRight, Clock, ArrowRight,
  Repeat, FileDown
} from 'lucide-react';

import { Channel, UserProfile, ViewID, TranscriptItem, CodeFile, UserFeedback, Comment, Attachment } from '../types';

import { Dashboard } from './Dashboard';
import { LiveSession } from './LiveSession';
import { PodcastDetail } from './PodcastDetail';
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
import { IconGenerator } from './IconGenerator';
import { ShippingLabelApp } from './ShippingLabelApp';
import { CheckDesigner } from './CheckDesigner';
import { FirestoreInspector } from './FirestoreInspector';
import { PublicChannelInspector } from './PublicChannelInspector';
import { MyChannelInspector } from './MyChannelInspector';
import { CloudDebugView } from './CloudDebugView';
import { DebugView } from './DebugView';
import { BrandLogo } from './BrandLogo';
import { CoinWallet } from './CoinWallet';
import { MockInterview } from './MockInterview';
import { GraphStudio } from './GraphStudio';
import { ProjectStory } from './ProjectStory';
import { ScriptureSanctuary } from './ScriptureSanctuary';
import { ScriptureIngest } from './ScriptureIngest';
import { BookStudio } from './BookStudio';
import { FeedbackManager } from './FeedbackManager';
import { PdfSigner } from './PdfSigner';
import { BadgeStudio } from './BadgeStudio';
import { BadgeViewer } from './BadgeViewer';
import { ManualModal } from './ManualModal';
import { ResumeView } from './ResumeView';
import { ScribeStudio } from './ScribeStudio';
import { NeuralLens } from './NeuralLens';

import { auth, db } from '../services/firebaseConfig';
import { onAuthStateChanged } from '@firebase/auth';
import { onSnapshot, doc } from '@firebase/firestore';
import { getUserChannels, saveUserChannel } from '../utils/db';
import { HANDCRAFTED_CHANNELS } from '../utils/initialData';
import { stopAllPlatformAudio } from '../utils/audioUtils';
import { subscribeToPublicChannels, getUserProfile, syncUserProfile, publishChannelToFirestore, isUserAdmin, updateUserProfile, saveUserFeedback, voteChannel, addCommentToChannel, deleteCommentFromChannel, updateCommentInChannel } from '../services/firestoreService';
import { getSovereignSession } from '../services/authService';
import { generateSecureId, safeJsonStringify } from '../utils/idUtils';

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
    bible: "Scripture",
    bibleIngest: "Scripture Ingest",
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
    dashboard: "Prism Home",
    systemLog: "System Log Trace (RAW)",
    diagnosticConsole: "Neural Diagnostics Console (PROBE ACTIVE)",
    awaitingActivity: "Awaiting neural activity...",
    featureRequest: "Request Refraction",
    submitFeedback: "Dispatch to AI Studio",
    feedbackSuccess: "Feedback Refracted to AI Studio. Self-Enhancement in progress."
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
    bible: "经文",
    bibleIngest: "经文录入",
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
    dashboard: "棱镜主页",
    systemLog: "系统日志追踪 (RAW)",
    diagnosticConsole: "神经诊断控制台 (探测器活跃)",
    awaitingActivity: "等待神经 activity...",
    featureRequest: "请求重构",
    submitFeedback: "派遣至 AI 工作室",
    feedbackSuccess: "反馈已折射至 AI 工作室。自我提升进行中。"
  }
};

const PUBLIC_VIEWS: ViewID[] = ['mission', 'story', 'privacy', 'user_guide', 'check_viewer', 'badge_viewer', 'resume']; 
const FREE_VIEWS: ViewID[] = ['directory', 'podcast_detail', 'dashboard', 'groups'];

const isRestrictedView = (v: string): boolean => {
    const safeSet = [...PUBLIC_VIEWS, ...FREE_VIEWS];
    return !safeSet.includes(v as any);
};

const GuardedView = ({ id, children, isProMember, isSuperAdmin, t, onUpgradeClick }: { 
    id: ViewID; 
    children?: ReactNode, 
    isProMember: boolean, 
    isSuperAdmin: boolean, 
    t: any, 
    onUpgradeClick: () => void 
}) => {
    if (isRestrictedView(id) && !isProMember) return (
      <div className="h-full w-full flex items-center justify-center bg-slate-950 p-6">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-[3.5rem] p-12 text-center shadow-2xl relative overflow-hidden animate-fade-in-up">
              <div className="absolute top-0 right-0 p-32 bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none"></div>
              <div className="w-20 h-20 bg-slate-950 rounded-3xl border border-indigo-500/30 flex items-center justify-center mx-auto mb-8 shadow-inner"><Lock size={40} className="text-indigo-500" /></div>
              <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-4">{t.proRequired}</h2>
              <p className="text-slate-400 text-sm mb-10 leading-relaxed font-medium">{t.proDesc}</p>
              <button onClick={onUpgradeClick} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all active:scale-95">{t.upgradeNow}</button>
          </div>
      </div>
    );
    return (
      <div className="h-full w-full relative flex flex-col">
        {isSuperAdmin && isRestrictedView(id) && (
            <div className="absolute bottom-12 left-4 z-50 pointer-events-none bg-indigo-600/40 text-white px-2 py-0.5 rounded-lg border border-indigo-400/20 text-[7px] font-black uppercase tracking-[0.1em] shadow-2xl flex items-center gap-1.5 backdrop-blur-sm opacity-60 hover:opacity-100 transition-opacity">
                <ShieldCheck size={10}/> Bypass Active
            </div>
        )}
        {children}
      </div>
    );
};

interface SystemLogMsg {
    id: string;
    time: string;
    text: string;
    type: 'info' | 'error' | 'success' | 'warn' | 'shadow' | 'audit' | 'input' | 'output' | 'trace' | 'loop';
    meta?: any;
}

const App: React.FC = () => {
  const [language, setLanguage] = useState<'en' | 'zh'>('en');
  const t = UI_TEXT[language];
  
  const [activeViewID, setActiveViewID] = useState<ViewID>(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get('view') as ViewID;
    if (v) return v;
    if (params.get('session')) return 'code_studio';
    return 'dashboard';
  });

  const [activeChannelId, setActiveChannelId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('channelId'));
  const [activeItemId, setActiveItemId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('id'));
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('session'));
  const [activeAccessKey, setActiveAccessKey] = useState<string | null>(() => new URLSearchParams(window.location.search).get('key'));

  const [isAppsMenuOpen, setIsAppsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const [showConsole, setShowConsole] = useState(false);
  const [consoleTab, setConsoleTab] = useState<'trace' | 'loop' | 'feedback'>('trace');
  const [isLogPaused, setIsLogPaused] = useState(false);
  const [visibleLogs, setVisibleLogs] = useState<SystemLogMsg[]>([]);
  const logBufferRef = useRef<SystemLogMsg[]>([]);
  const lastUpdateRef = useRef<number>(0);

  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackType, setFeedbackType] = useState<'bug' | 'feature' | 'general'>('general');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  const [manualViewId, setManualViewId] = useState<ViewID | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
        const now = Date.now();
        if (isLogPaused || logBufferRef.current.length === 0) return;
        if (now - lastUpdateRef.current < 400) return;

        setVisibleLogs(prev => {
            const combined = [...logBufferRef.current, ...prev].slice(0, 150);
            logBufferRef.current = [];
            lastUpdateRef.current = now;
            return combined;
        });
    }, 400);
    return () => clearInterval(interval);
  }, [isLogPaused]);

  const addSystemLog = useCallback((text: any, type: SystemLogMsg['type'] = 'info', meta?: any) => {
      let cleanText = "";
      try {
          if (typeof text === 'string') {
              cleanText = text;
          } else if (text instanceof Error) {
              cleanText = `ERROR: ${text.message}\nSTACK: ${text.stack || 'No stack.'}`;
          } else if (text !== null && typeof text === 'object') {
              cleanText = safeJsonStringify(text); 
          } else {
              cleanText = String(text);
          }
      } catch (e) { 
          cleanText = "[Internal Log Processing Failure - Logic Gated]"; 
      }

      let safeMeta = null;
      if (meta) {
          try {
              safeMeta = JSON.parse(safeJsonStringify(meta));
          } catch(e) {
              safeMeta = { error: "Meta sanitization failure" };
          }
      }

      if (logBufferRef.current.length > 0 && logBufferRef.current[0].text === cleanText && type !== 'loop') return;
      logBufferRef.current.unshift({ id: Math.random().toString(), time: new Date().toLocaleTimeString(), text: cleanText, type, meta: safeMeta });
  }, []);

  useEffect(() => {
    const handleGlobalLog = (e: any) => {
        const { text, type, meta } = e.detail || {};
        if (text) addSystemLog(text, type || 'info', meta);
    };
    window.addEventListener('neural-log', handleGlobalLog);
    return () => window.removeEventListener('neural-log', handleGlobalLog);
  }, [addSystemLog]);

  const handleExportLogs = () => {
    if (visibleLogs.length === 0) return;
    let md = `# Neural Diagnostics Audit Trace\n`;
    md += `**Registry Context:** v12.9.5-LOOP\n`;
    md += `**Extraction Date:** ${new Date().toLocaleString()}\n`;
    md += `**Client ID:** ${currentUser?.uid || 'GUEST_PROBE'}\n\n`;
    md += `---\n\n`;

    visibleLogs.forEach(log => {
        const icon = log.type === 'error' ? '❌' : log.type === 'warn' ? '⚠️' : log.type === 'success' ? '✅' : log.type === 'loop' ? '🔄' : 'ℹ️';
        md += `### [${log.time}] ${icon} ${log.type.toUpperCase()}\n`;
        md += `**Description:** ${log.text}\n`;
        if (log.meta) {
            md += `\n**Handshake Metadata:**\n\`\`\`json\n${safeJsonStringify(log.meta)}\n\`\`\`\n`;
        }
        md += `\n---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Neural_Prism_Diagnostic_Trace_${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addSystemLog("Registry Trace exported to local drive.", "success");
  };

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
  
  const [commentChannelId, setCommentChannelId] = useState<string | null>(null);
  const [editChannelId, setEditChannelId] = useState<string | null>(null);

  const [observedChannel, setObservedChannel] = useState<Channel | null>(null);

  useEffect(() => {
    const idToObserve = commentChannelId || editChannelId || activeChannelId;
    if (!idToObserve || !db) {
        setObservedChannel(null);
        return;
    }
    const unsub = onSnapshot(doc(db, 'channels', idToObserve), (snap) => {
        if (snap.exists()) {
            const data = snap.data() as Channel;
            setObservedChannel(data);
        }
    });
    return () => unsub();
  }, [commentChannelId, editChannelId, activeChannelId]);

  const isSuperAdmin = useMemo(() => {
      if (!currentUser) return false;
      return currentUser.email?.toLowerCase() === 'shengliang.song.ai@gmail.com' || isUserAdmin(userProfile);
  }, [userProfile, currentUser]);

  const isProMember = useMemo(() => {
    if (isSuperAdmin) return true;
    if (userProfile?.subscriptionTier === 'pro') return true;
    if (userProfile?.createdAt) {
      if (Date.now() - userProfile.createdAt < 30 * 24 * 60 * 60 * 1000) return true;
    }
    return false;
  }, [userProfile, isSuperAdmin]);

  const handleSetViewState = useCallback((target: ViewID, params: Record<string, string> = {}) => {
    if (isRestrictedView(target) && !isProMember) {
        setIsPricingModalOpen(true);
        return;
    }
    stopAllPlatformAudio(`Nav:${activeViewID}->${target}`);
    setActiveViewID(target);
    setActiveChannelId(params.channelId || null);
    setActiveItemId(params.id || null);
    setActiveSessionId(params.session || null);
    setActiveAccessKey(params.key || null);
    setIsAppsMenuOpen(false); 
    setIsUserMenuOpen(false);
    
    try {
        if (window.location.protocol !== 'blob:') {
            const url = new URL(window.location.href);
            url.searchParams.forEach((_, k) => url.searchParams.delete(k));
            if (target !== 'dashboard') url.searchParams.set('view', target);
            Object.keys(params).forEach(k => url.searchParams.set(k, params[k]));
            window.history.pushState({}, '', url.toString());
        }
    } catch (historyErr) {
        console.warn("History push blocked by environment security policy:", historyErr);
    }
  }, [activeViewID, isProMember]);

  useEffect(() => {
    const handleGlobalResize = () => {
        const isSmall = window.innerWidth < 768;
        if (isSmall && activeViewID === 'dashboard' && !activeSessionId) {
            handleSetViewState('directory');
            addSystemLog("Mobile Refraction Triggered: Switching to Podcast Feed Layout.", "info");
        }
    };
    window.addEventListener('resize', handleGlobalResize);
    handleGlobalResize();
    return () => window.removeEventListener('resize', handleGlobalResize);
  }, [activeViewID, activeSessionId, handleSetViewState, addSystemLog]);

  const handleVote = useCallback(async (id: string, type: 'like' | 'dislike', e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return;
    try {
        await voteChannel(id, type);
        const currentLiked = userProfile?.likedChannelIds || [];
        let nextLiked = [...currentLiked];
        if (type === 'like' && !nextLiked.includes(id)) nextLiked.push(id);
        else if (type === 'dislike') nextLiked = nextLiked.filter(cid => cid !== id);
        await updateUserProfile(currentUser.uid, { likedChannelIds: nextLiked });
        addSystemLog(`Refraction Vote Registered: ${type.toUpperCase()} for ${id.substring(0, 8)}`, "success");
    } catch (err: any) { addSystemLog(`Vote Handshake Refused: ${err.message}`, "error"); }
  }, [currentUser, userProfile, addSystemLog]);

  const handleBookmarkToggle = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return;
    try {
        const currentBookmarked = userProfile?.bookmarkedChannelIds || [];
        let nextBookmarked = [...currentBookmarked];
        const isBookmarking = !nextBookmarked.includes(id);
        if (isBookmarking) {
            nextBookmarked.push(id);
            addSystemLog(`Activity Secured: ${id.substring(0, 8)} added to vault.`, "success");
        } else {
            nextBookmarked = nextBookmarked.filter(cid => cid !== id);
            addSystemLog(`Activity Refracted: ${id.substring(0, 8)} removed from vault.`, "info");
        }
        await updateUserProfile(currentUser.uid, { bookmarkedChannelIds: nextBookmarked });
    } catch (err: any) { addSystemLog(`Vault Update Refused: ${err.message}`, "error"); }
  }, [currentUser, userProfile, addSystemLog]);

  const handleAddComment = useCallback(async (text: string, attachments: Attachment[]) => {
    if (!currentUser || !commentChannelId) return;
    try {
        const newComment: Comment = { id: generateSecureId(), userId: currentUser.uid, user: currentUser.displayName || 'Anonymous', text, timestamp: Date.now(), attachments };
        await addCommentToChannel(commentChannelId, newComment);
        addSystemLog(`Neural Reflection Shared. Local state syncing...`, "success");
    } catch (err: any) { addSystemLog(`Reflection Sync Refused: ${err.message}`, "error"); }
  }, [currentUser, commentChannelId, addSystemLog]);

  const handleDeleteComment = useCallback(async (commentId: string) => {
      if (!currentUser || !commentChannelId) return;
      try {
          await deleteCommentFromChannel(commentChannelId, commentId);
          addSystemLog(`Neural Reflection Purged.`, "info");
      } catch (err: any) { addSystemLog(`Purge Handshake Refused: ${err.message}`, "error"); }
  }, [currentUser, commentChannelId, addSystemLog]);

  const handleEditComment = useCallback(async (commentId: string, text: string, attachments: Attachment[]) => {
      if (!currentUser || !commentChannelId) return;
      try {
          await updateCommentInChannel(commentChannelId, commentId, text, attachments);
          addSystemLog(`Neural Reflection Modified.`, "success");
      } catch (err: any) { addSystemLog(`Modification Handshake Refused: ${err.message}`, "error"); }
  }, [currentUser, commentChannelId, addSystemLog]);

  const [liveSessionParams, setLiveSessionParams] = useState<any>(null);

  const handleDetailBack = useCallback(() => {
    handleSetViewState('directory');
  }, [handleSetViewState]);

  const handleStartLiveSession = useCallback((
    channel: Channel, 
    context?: string, 
    recordingEnabled?: boolean, 
    bookingId?: string, 
    recordScreen?: boolean, 
    recordCamera?: boolean, 
    activeSegment?: any, 
    recordingDuration?: number, 
    interactionEnabled?: boolean,
    recordingTarget?: 'drive' | 'youtube',
    sessionTitle?: string
  ) => {
    const isSpecialized = ['1', '2', 'default-gem', 'judge-deep-dive'].includes(channel.id);
    if (isSpecialized && !isProMember) {
        setIsPricingModalOpen(true);
        return;
    }
    setLiveSessionParams({ channel, context, recordingEnabled, bookingId, recordScreen, recordCamera, activeSegment, recordingDuration, interactionEnabled, recordingTarget, sessionTitle, returnTo: activeViewID });
    handleSetViewState('live_session');
  }, [activeViewID, handleSetViewState, isProMember]);

  const handleUpdateLanguage = useCallback(async (newLang: 'en' | 'zh') => {
      setLanguage(newLang);
      if (currentUser) {
          try { await updateUserProfile(currentUser.uid, { languagePreference: newLang }); } catch(e) {}
      }
  }, [currentUser]);

  useEffect(() => {
    addSystemLog("Sovereignty Protocols Active (v12.9.0-LOOP).", "info");
    if (!auth) { setAuthLoading(false); return; }
    const unsub = onAuthStateChanged(auth, async (u) => {
        if (u) { 
            addSystemLog(`Identity Handshake: @${u.displayName || 'User'} verified.`, 'success');
            setCurrentUser(u); 
            syncUserProfile(u).catch(console.error); 
        }
        else { setCurrentUser(null); setUserProfile(null); }
        setAuthLoading(false);
    });
    return () => unsub();
  }, [addSystemLog]);

  useEffect(() => {
      if (!currentUser?.uid || !db) return;
      const unsub = onSnapshot(doc(db, 'users', currentUser.uid), s => { 
          if(s.exists()) {
              const profile = s.data() as UserProfile;
              setUserProfile(prev => {
                  if (!prev) return profile;
                  const arraysMatch = (a?: string[], b?: string[]) => {
                      if (!a || !b) return a === b;
                      if (a.length !== b.length) return false;
                      return a.every((v, i) => v === b[i]);
                  };
                  const hasChanged = prev.coinBalance !== profile.coinBalance || prev.subscriptionTier !== profile.subscriptionTier || !arraysMatch(prev.likedChannelIds, profile.likedChannelIds) || !arraysMatch(prev.bookmarkedChannelIds, profile.bookmarkedChannelIds);
                  return hasChanged ? profile : prev;
              });
              if (profile.languagePreference && profile.languagePreference !== language) setLanguage(profile.languagePreference);
          }
      });
      return () => unsub();
  }, [currentUser?.uid, language]);

  useEffect(() => {
    subscribeToPublicChannels(setPublicChannels);
    getUserChannels().then(setUserChannels);
  }, []);

  const allChannels = useMemo(() => {
      const map = new Map<string, Channel>();
      HANDCRAFTED_CHANNELS.forEach(c => map.set(c.id, c));
      publicChannels.forEach(c => map.set(c.id, c));
      userChannels.forEach(c => map.set(c.id, c));
      if (observedChannel) map.set(observedChannel.id, observedChannel);
      return Array.from(map.values());
  }, [publicChannels, userChannels, observedChannel]);

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

  const activeChannel = useMemo(() => allChannels.find(c => c.id === activeChannelId), [allChannels, activeChannelId]);
  const commentChannel = useMemo(() => allChannels.find(c => c.id === commentChannelId), [allChannels, commentChannelId]);
  const editChannel = useMemo(() => allChannels.find(c => c.id === editChannelId), [allChannels, editChannelId]);

  const handleSendFeedback = async () => {
    if (!feedbackText.trim() || isSubmittingFeedback) return;
    setIsSubmittingFeedback(true);
    try {
        const feedback: UserFeedback = { id: generateSecureId(), userId: currentUser?.uid || 'anonymous', userName: currentUser?.displayName || 'Anonymous User', viewId: activeViewID, message: feedbackText, type: feedbackType, logs: visibleLogs.slice(0, 20), timestamp: Date.now(), status: 'open' };
        await saveUserFeedback(feedback);
        setFeedbackText('');
        setFeedbackSuccess(true);
        setTimeout(() => setFeedbackSuccess(false), 5000);
    } catch (e: any) { addSystemLog(`Feedback sync failed: ${e.message}`, "error"); } 
    finally { setIsSubmittingFeedback(false); }
  };

  const appsByTier = useMemo(() => {
    const list = [
        { id: 'dashboard', label: 'Home', icon: LayoutGrid, action: () => handleSetViewState('dashboard'), color: 'text-indigo-400', restricted: false },
        { id: 'directory', label: 'Hub', icon: Podcast, action: () => handleSetViewState('directory'), color: 'text-indigo-400', restricted: false },
        { id: 'bible_study', label: 'Scripture', icon: Scroll, action: () => handleSetViewState('bible_study'), color: 'text-amber-500', restricted: false },
        { id: 'scripture_ingest', label: 'Scripture Ingest', icon: FileUp, action: () => handleSetViewState('scripture_ingest'), color: 'text-amber-400', restricted: true },
        { id: 'mission', label: 'Vision', icon: Rocket, action: () => handleSetViewState('mission'), color: 'text-orange-500', restricted: false },
        { id: 'story', label: 'Story', icon: BookOpen, action: () => handleSetViewState('story'), color: 'text-cyan-400', restricted: false },
        { id: 'book_studio', label: 'Author', icon: BookText, action: () => handleSetViewState('book_studio'), color: 'text-indigo-500', restricted: false },
        { id: 'neural_lens', label: 'Neural Lens', icon: ShieldCheck, action: () => handleSetViewState('neural_lens'), color: 'text-indigo-400', restricted: false },
        { id: 'mock_interview', label: 'Career', icon: Video, action: () => handleSetViewState('mock_interview'), color: 'text-red-500', restricted: true },
        { id: 'coin_wallet', label: 'Wallet', icon: Coins, action: () => handleSetViewState('coin_wallet'), color: 'text-amber-400', restricted: true },
        { id: 'docs', label: 'Docs', icon: FileText, action: () => handleSetViewState('docs'), color: 'text-emerald-400', restricted: true },
        { id: 'chat', label: 'Team Space', icon: MessageSquare, action: () => handleSetViewState('chat'), color: 'text-blue-400', restricted: true },
        { id: 'code_studio', label: 'Builder', icon: Code, action: () => handleSetViewState('code_studio'), color: 'text-blue-400', restricted: true },
        { id: 'whiteboard', label: 'Canvas', icon: PenTool, action: () => handleSetViewState('whiteboard'), color: 'text-pink-400', restricted: true },
        { id: 'pdf_signer', label: 'Signer', icon: FileSignature, action: () => handleSetViewState('pdf_signer'), color: 'text-indigo-400', restricted: true },
        { id: 'badge_studio', label: 'Badge', icon: IdCard, action: () => handleSetViewState('badge_studio'), color: 'text-indigo-400', restricted: true },
        { id: 'scribe_studio', label: 'Scribe', icon: Disc, action: () => handleSetViewState('scribe_studio'), color: 'text-red-500', restricted: true },
    ];
    return { free: list.filter(a => !a.restricted), pro: list.filter(a => a.restricted) };
  }, [handleSetViewState, t]);

  const handleMagicCreate = useCallback(() => {
    if (isProMember) setIsVoiceCreateOpen(true);
    else setIsPricingModalOpen(true);
  }, [isProMember]);

  if (authLoading) return <div className="h-screen bg-slate-950 flex flex-col items-center justify-center gap-4"><Loader2 className="animate-spin text-indigo-500" size={32} /><span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Initializing Spectrum (v9.0.0)...</span></div>;
  if (!currentUser && !PUBLIC_VIEWS.includes(activeViewID)) return <LoginPage onMissionClick={() => handleSetViewState('mission')} onStoryClick={() => handleSetViewState('story')} onPrivacyClick={() => handleSetViewState('privacy')} onResumeClick={() => handleSetViewState('resume')} />;

  const getLogColor = (type: SystemLogMsg['type']) => {
      switch(type) {
          case 'error': return 'text-red-400 bg-red-950/20 border-red-500/20';
          case 'success': return 'text-emerald-400 bg-emerald-950/20 border-emerald-500/20';
          case 'warn': return 'text-amber-400 bg-amber-950/20 border-amber-500/20';
          case 'shadow': return 'text-purple-400 bg-purple-950/20 border-purple-500/20';
          case 'audit': return 'text-cyan-400 bg-cyan-950/20 border-cyan-500/20';
          case 'loop': return 'text-indigo-100 bg-indigo-900/40 border-indigo-400/30';
          case 'input': return 'text-indigo-400 bg-indigo-950/10 border-indigo-500/10';
          case 'output': return 'text-blue-300 bg-blue-950/10 border-blue-500/10';
          default: return 'text-slate-400 bg-slate-900/40 border-slate-800/40';
      }
  };

  const getLogIcon = (type: SystemLogMsg['type']) => {
      switch(type) {
          case 'error': return <ShieldAlert size={10}/>;
          case 'success': return <CheckCircle size={10}/>;
          case 'shadow': return <Ghost size={10}/>;
          case 'audit': return <ShieldCheck size={10}/>;
          case 'loop': return <Repeat size={10} className="animate-spin-slow"/>;
          case 'input': return <ChevronRight size={10}/>;
          case 'output': return <ChevronLeft size={10}/>;
          default: return <Info size={10}/>;
      }
  };

  return (
    <ErrorBoundary>
      <div className="h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden relative border-b border-white/5">
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
                            <div className="p-4 bg-slate-950/50 border-b border-slate-800 flex justify-between items-center"><h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Standard Hub</h3><span className="text-[9px] font-black bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">FREE</span></div>
                            <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-1">{appsByTier.free.map(app => (<button key={app.id} onClick={() => { app.action(); setIsAppsMenuOpen(false); }} className="flex items-center gap-3 p-3 rounded-xl hover:bg-indigo-600/10 transition-all group"><div className="p-2 rounded-lg bg-slate-800 border border-slate-700 group-hover:border-indigo-500/30"><app.icon size={16} className={app.color}/></div><span className="text-xs font-bold text-slate-300 group-hover:text-white">{app.label}</span></button>))}</div>
                            <div className="m-3 p-5 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl shadow-xl relative overflow-hidden group/upgrade"><div className="absolute top-0 right-0 p-12 bg-white/10 blur-3xl rounded-full group-hover/upgrade:scale-110 transition-transform"></div><div className="relative z-10"><h4 className="text-white font-black uppercase italic tracking-tighter text-lg">{t.upgradeBtn}</h4><button onClick={() => { setIsPricingModalOpen(true); setIsAppsMenuOpen(false); }} className="mt-4 w-full py-2 bg-white text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:scale-[1.02] transition-transform active:scale-95">Upgrade Now</button></div></div>
                          </>
                      )}
                      {isProMember && (
                          <>
                            <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex justify-between items-center"><div className="flex items-center gap-2"><h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Full Spectrum</h3><Sparkles size={12} className="text-indigo-400" /></div><div className="flex items-center gap-1.5 bg-indigo-600 text-white px-2 py-0.5 rounded-full shadow-lg border border-indigo-400/50"><Crown size={10} fill="currentColor"/><span className="text-[8px] font-black uppercase">Refracted</span></div></div>
                            <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-1 max-h-[60vh] overflow-y-auto scrollbar-hide">{[...appsByTier.free, ...appsByTier.pro].map(app => (<button key={app.id} onClick={() => { app.action(); setIsAppsMenuOpen(false); }} className="flex items-center gap-3 p-3 rounded-xl hover:bg-indigo-600/10 transition-all group border border-transparent hover:border-indigo-500/10"><div className={`p-2 rounded-lg bg-slate-800 border border-slate-700 group-hover:border-indigo-500/30 transition-all`}><app.icon size={16} className={app.color}/></div><span className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors">{app.label}</span></button>))}</div>
                          </>
                      )}
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3 cursor-pointer group" onClick={() => window.location.assign(window.location.origin)} title="Reload Site"><BrandLogo size={32} /><h1 className="text-xl font-black italic uppercase tracking-tighter hidden sm:block group-hover:text-indigo-400 transition-colors">Neural Prism</h1></div>
           </div>
           <div className="flex items-center gap-3 sm:gap-4">
              <Notifications />
              <button 
                onClick={() => setManualViewId(activeViewID)} 
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all" 
                title="Application Manual"
              >
                  <BookOpen size={18} />
              </button>
              <button onClick={() => setShowConsole(!showConsole)} className={`p-2 transition-all rounded-lg ${showConsole ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`} title="Neural Diagnostics"><Bug size={18} className={!showConsole ? 'animate-pulse text-red-500' : ''} /></button>
              <button onClick={() => window.location.reload()} className="p-2 text-slate-400 hover:text-white transition-colors" title="Reload Web App"><RefreshCcw size={18} /></button>
              {userProfile && (<button onClick={() => handleSetViewState('coin_wallet')} className="flex items-center gap-2 px-3 py-1.5 bg-amber-900/20 hover:bg-amber-900/40 text-amber-400 rounded-full border border-amber-500/30 transition-all hidden sm:flex"><Coins size={16}/><span className="font-black text-xs">{userProfile.coinBalance || 0}</span></button>)}
              <div className="relative"><button onClick={() => { setIsUserMenuOpen(!isUserMenuOpen); setIsAppsMenuOpen(false); }} className="w-10 h-10 rounded-full border-2 border-slate-700 overflow-hidden hover:border-indigo-500 transition-colors"><img src={currentUser?.photoURL || `https://ui-avatars.com/api/?name=${currentUser?.displayName}`} alt="Profile" className="w-full h-full object-cover" /></button><StudioMenu isUserMenuOpen={isUserMenuOpen} setIsUserMenuOpen={setIsUserMenuOpen} currentUser={currentUser} userProfile={userProfile} setUserProfile={setUserProfile} globalVoice="Auto" setGlobalVoice={()=>{}} setIsCreateModalOpen={setIsCreateModalOpen} setIsVoiceCreateOpen={setIsVoiceCreateOpen} onNavigate={(v, p) => handleSetViewState(v as any, p)} onUpgradeClick={() => setIsPricingModalOpen(true)} setIsSyncModalOpen={()=>{}} setIsSettingsModalOpen={setIsSettingsModalOpen} onOpenUserGuide={() => handleSetViewState('user_guide')} onOpenPrivacy={() => handleSetViewState('privacy')} t={t} language={language} setLanguage={handleUpdateLanguage} channels={allChannels} isSuperAdmin={isSuperAdmin} isProMember={isProMember} /></div>
           </div>
        </header>

        <main className="flex-1 overflow-hidden relative flex flex-col pb-10">
            <GuardedView id={activeViewID} isProMember={isProMember} isSuperAdmin={isSuperAdmin} t={t} onUpgradeClick={() => setIsPricingModalOpen(true)}>
                {activeViewID === 'dashboard' && ( <Dashboard userProfile={userProfile} isProMember={isProMember} onNavigate={handleSetViewState} language={language} handleVote={handleVote} onOpenManual={() => setManualViewId('dashboard')} /> )}
                {activeViewID === 'directory' && ( <PodcastFeed channels={allChannels} onChannelClick={(id) => { setActiveChannelId(id); handleSetViewState('podcast_detail', { channelId: id }); }} onStartLiveSession={handleStartLiveSession} userProfile={userProfile} globalVoice="Auto" currentUser={currentUser} t={t} setChannelToEdit={(c) => setEditChannelId(c.id)} setIsSettingsModalOpen={setIsSettingsModalOpen} onCommentClick={(c) => setCommentChannelId(c.id)} handleVote={handleVote} handleBookmarkToggle={handleBookmarkToggle} searchQuery={searchQuery} setSearchQuery={setSearchQuery} onNavigate={(v) => handleSetViewState(v as any)} onUpdateChannel={handleUpdateChannel} onOpenPricing={() => setIsPricingModalOpen(true)} language={language} onMagicCreate={handleMagicCreate} onOpenManual={() => setManualViewId('directory')} /> )}
                {activeViewID === 'podcast_detail' && activeChannel && ( <PodcastDetail channel={activeChannel} onBack={handleDetailBack} onStartLiveSession={handleStartLiveSession} language={language} currentUser={currentUser} userProfile={userProfile} onUpdateChannel={handleUpdateChannel} isProMember={isProMember} /> )}
                {activeViewID === 'live_session' && liveSessionParams && ( <LiveSession channel={liveSessionParams.channel} onEndSession={() => handleSetViewState(liveSessionParams.returnTo || 'directory')} language={language} initialContext={liveSessionParams.context} recordingEnabled={liveSessionParams.recordingEnabled} lectureId={liveSessionParams.bookingId} recordScreen={liveSessionParams.recordScreen} recordCamera={liveSessionParams.recordCamera} activeSegment={liveSessionParams.activeSegment} recordingDuration={liveSessionParams.recordingDuration} interactionEnabled={liveSessionParams.interactionEnabled} recordingTarget={liveSessionParams.recordingTarget} sessionTitle={liveSessionParams.sessionTitle} /> )}
                {activeViewID === 'docs' && ( <div className="p-8 max-w-5xl mx-auto h-full overflow-y-auto"><DocumentList onBack={() => handleSetViewState('dashboard')} onOpenManual={() => setManualViewId('docs')} /></div> )}
                {activeViewID === 'code_studio' && ( 
                  <CodeStudio 
                    key={activeSessionId || 'new'}
                    onBack={() => handleSetViewState('dashboard')} 
                    currentUser={currentUser} 
                    userProfile={userProfile} 
                    onSessionStart={(id) => setActiveSessionId(id)} 
                    onSessionStop={() => setActiveSessionId(null)} 
                    onStartLiveSession={(chan, ctx) => handleStartLiveSession(chan, ctx)} 
                    isProMember={isProMember} 
                    onOpenManual={() => setManualViewId('code_studio')}
                    sessionId={activeSessionId || undefined}
                    accessKey={activeAccessKey || undefined}
                  /> 
                )}
                {activeViewID === 'whiteboard' && ( <div className="h-full overflow-hidden flex flex-col"><div className="flex-1"><Whiteboard onBack={() => handleSetViewState('dashboard')} onOpenManual={() => setManualViewId('whiteboard')} /></div></div> )}
                {activeViewID === 'blog' && ( <div className="h-full overflow-y-auto"><BlogView currentUser={currentUser} onBack={() => handleSetViewState('dashboard')} onOpenManual={() => setManualViewId('blog')} /></div> )}
                {activeViewID === 'chat' && ( <WorkplaceChat onBack={() => handleSetViewState('dashboard')} currentUser={currentUser} onOpenManual={() => setManualViewId('chat')} /> )}
                {activeViewID === 'careers' && ( <div className="h-full overflow-y-auto"><CareerCenter onBack={() => handleSetViewState('dashboard')} currentUser={currentUser} jobId={activeItemId || undefined} onOpenManual={() => setManualViewId('careers')} /></div> )}
                {activeViewID === 'calendar' && ( <CalendarView channels={allChannels} handleChannelClick={(id) => { setActiveChannelId(id); handleSetViewState('podcast_detail', { channelId: id }); }} handleVote={handleVote} currentUser={currentUser} setChannelToEdit={(c) => setEditChannelId(c.id)} setIsSettingsModalOpen={setIsSettingsModalOpen} globalVoice="Auto" t={t} onCommentClick={(c) => setCommentChannelId(c.id)} onStartLiveSession={handleStartLiveSession} onCreateChannel={handleCreateChannel} onSchedulePodcast={() => setIsCreateModalOpen(true)} onOpenManual={() => setManualViewId('calendar')} /> )}
                {activeViewID === 'mentorship' && ( <div className="h-full overflow-y-auto"><MentorBooking currentUser={currentUser} userProfile={userProfile} channels={allChannels} onStartLiveSession={handleStartLiveSession} onOpenManual={() => setManualViewId('mentorship')} /></div> )}
                {activeViewID === 'recordings' && ( <div className="p-8 max-w-5xl mx-auto h-full overflow-y-auto"><RecordingList onBack={() => handleSetViewState('dashboard')} onStartLiveSession={handleStartLiveSession} onOpenManual={() => setManualViewId('recordings')} /></div> )}
                {(activeViewID === 'check_designer' || activeViewID === 'check_viewer') && ( <CheckDesigner onBack={() => handleSetViewState('dashboard')} currentUser={currentUser} userProfile={userProfile} isProMember={isProMember} onOpenManual={() => setManualViewId('check_designer')} /> )}
                {activeViewID === 'shipping_labels' && ( <ShippingLabelApp onBack={() => handleSetViewState('dashboard')} onOpenManual={() => setManualViewId('shipping_labels')} /> )}
                {activeViewID === 'icon_generator' && ( <IconGenerator onBack={() => handleSetViewState('dashboard')} currentUser={currentUser} iconId={activeItemId || undefined} isProMember={isProMember} onOpenManual={() => setManualViewId('icon_generator')} /> )}
                {activeViewID === 'notebook_viewer' && ( <NotebookViewer onBack={() => handleSetViewState('dashboard')} currentUser={currentUser} notebookId={activeItemId || undefined} onOpenManual={() => setManualViewId('notebook_viewer')} /> )}
                {(activeViewID === 'card_workshop' || activeViewID === 'card_viewer') && ( <CardWorkshop onBack={() => handleSetViewState('dashboard')} cardId={activeItemId || undefined} isViewer={activeViewID === 'card_viewer' || !!activeItemId} onOpenManual={() => setManualViewId('card_workshop')} /> )}
                {activeViewID === 'mission' && ( <div className="h-full overflow-y-auto"><MissionManifesto onBack={() => handleSetViewState('dashboard')} /></div> )}
                {activeViewID === 'firestore_debug' && ( <FirestoreInspector onBack={() => handleSetViewState('dashboard')} userProfile={userProfile} /> )}
                {activeViewID === 'coin_wallet' && ( <CoinWallet onBack={() => handleSetViewState('dashboard')} user={userProfile} onOpenManual={() => setManualViewId('coin_wallet')} /> )}
                {activeViewID === 'mock_interview' && ( <MockInterview onBack={() => handleSetViewState('dashboard')} userProfile={userProfile} onStartLiveSession={handleStartLiveSession} isProMember={isProMember} onOpenManual={() => setManualViewId('mock_interview')} /> )}
                {activeViewID === 'firestore_inspector' && ( <FirestoreInspector onBack={() => handleSetViewState('dashboard')} userProfile={userProfile} /> )}
                {activeViewID === 'public_channel_inspector' && ( <PublicChannelInspector onBack={() => handleSetViewState('dashboard')} /> )}
                {activeViewID === 'my_channel_inspector' && ( <MyChannelInspector onBack={() => handleSetViewState('dashboard')} /> )}
                {activeViewID === 'cloud_debug' && ( <CloudDebugView onBack={() => handleSetViewState('dashboard')} /> )}
                {activeViewID === 'debug_view' && ( <DebugView onBack={() => handleSetViewState('dashboard')} /> )}
                {activeViewID === 'graph_studio' && ( <GraphStudio onBack={() => handleSetViewState('dashboard')} isProMember={isProMember} onOpenManual={() => setManualViewId('graph_studio')} /> )}
                {activeViewID === 'story' && ( <ProjectStory onBack={() => handleSetViewState('dashboard')} /> )}
                {activeViewID === 'privacy' && ( <PrivacyPolicy onBack={() => handleSetViewState('dashboard')} /> )}
                {activeViewID === 'user_guide' && ( <UserManual onBack={() => handleSetViewState('dashboard')} /> )}
                {activeViewID === 'bible_study' && ( <ScriptureSanctuary onBack={() => handleSetViewState('dashboard')} language={language} isProMember={isProMember} onOpenManual={() => setManualViewId('bible_study')} /> )}
                {activeViewID === 'scripture_ingest' && ( <ScriptureIngest onBack={() => handleSetViewState('bible_study')} /> )}
                {activeViewID === 'groups' && ( <GroupManager currentUser={currentUser} userProfile={userProfile} onOpenManual={() => setManualViewId('groups')} /> )}
                {activeViewID === 'book_studio' && ( <BookStudio onBack={() => handleSetViewState('dashboard')} onOpenManual={() => setManualViewId('book_studio')} /> )}
                {activeViewID === 'feedback_manager' && ( <FeedbackManager onBack={() => handleSetViewState('dashboard')} userProfile={userProfile} /> )}
                {activeViewID === 'pdf_signer' && ( <PdfSigner onBack={() => handleSetViewState('dashboard')} currentUser={currentUser} userProfile={userProfile} onOpenManual={() => setManualViewId('pdf_signer')} /> )}
                {activeViewID === 'badge_studio' && ( <BadgeStudio onBack={() => handleSetViewState('dashboard')} userProfile={userProfile} onOpenManual={() => setManualViewId('badge_studio')} /> )}
                {activeViewID === 'badge_viewer' && ( <BadgeViewer onBack={() => handleSetViewState('dashboard')} badgeId={activeItemId} /> )}
                {activeViewID === 'resume' && ( <ResumeView onBack={() => handleSetViewState('dashboard')} currentUser={currentUser} userProfile={userProfile} /> )}
                {activeViewID === 'scribe_studio' && ( <ScribeStudio onBack={() => handleSetViewState('dashboard')} currentUser={currentUser} userProfile={userProfile} onOpenManual={() => setManualViewId('scribe_studio')} /> )}
                {activeViewID === 'neural_lens' && ( <NeuralLens onBack={() => handleSetViewState('dashboard')} userProfile={userProfile} onOpenManual={() => setManualViewId('neural_lens')} /> )}
            </GuardedView>
        </main>

        <div className={`fixed bottom-0 left-0 right-0 z-[1000] transition-all duration-500 transform ${showConsole ? 'translate-y-0' : 'translate-y-[calc(100%-40px)]'}`}>
            <div className="bg-slate-950 border-t-2 border-red-500 shadow-[0_-20px_100px_-10px_rgba(239,68,68,0.4)] backdrop-blur-3xl">
                <button onClick={() => setShowConsole(!showConsole)} className="w-full h-10 flex items-center justify-center gap-3 bg-slate-900 border-b border-slate-800 hover:bg-slate-800 transition-colors group">
                    <Bug size={14} className={showConsole ? 'text-red-400' : 'text-slate-50'} />
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 group-hover:text-white transition-colors">Neural Diagnostics Console</span>
                    {showConsole ? <ChevronDown size={14} className="text-slate-500"/> : <ChevronUp size={14} className="text-slate-500"/>}
                </button>
                <div className="h-96 overflow-hidden flex flex-col md:flex-row">
                    <div className="w-full md:w-80 border-r border-white/5 p-6 space-y-6 overflow-y-auto shrink-0 bg-black/60 scrollbar-hide">
                        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                            <button onClick={() => setConsoleTab('trace')} className={`flex-1 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${consoleTab === 'trace' ? 'bg-red-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>Trace</button>
                            <button onClick={() => setConsoleTab('loop')} className={`flex-1 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${consoleTab === 'loop' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>Loop</button>
                            <button onClick={() => setConsoleTab('feedback')} className={`flex-1 py-1.5 rounded-md text-[9px] font-black uppercase rounded-lg transition-all ${consoleTab === 'feedback' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>Feedback</button>
                        </div>
                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-2"><Fingerprint size={12}/> Neural Fingerprint</h4>
                            <div className="space-y-2 text-[10px] font-mono text-left">
                                <div className="flex justify-between items-center py-1 border-b border-white/5"><span className="text-slate-500 uppercase">Status:</span><span className={currentUser ? 'text-emerald-400' : 'text-red-400'}>{currentUser ? 'VERIFIED' : 'ANONYMOUS'}</span></div>
                                <div className="flex flex-col gap-1 py-1 border-b border-white/5"><span className="text-slate-500">ID:</span><span className="text-white break-all text-[8px]">{currentUser?.uid || 'GUEST_PROBE'}</span></div>
                                <div className="flex justify-between items-center py-1 border-b border-white/5"><span className="text-slate-500 uppercase">Clearance:</span><span className="text-indigo-400 font-bold uppercase">{userProfile?.subscriptionTier || 'LEVEL_0'}</span></div>
                            </div>
                        </div>
                        <div className="pt-4 flex flex-col gap-2">
                            <button onClick={handleExportLogs} className="w-full py-2 bg-indigo-900/40 text-indigo-300 text-[9px] font-black uppercase rounded-lg border border-indigo-500/30 hover:bg-indigo-600 hover:text-white transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2">
                                <FileDown size={14}/> Dump Logs
                            </button>
                            <button onClick={() => { logBufferRef.current = []; setVisibleLogs([]); }} className="w-full py-2 bg-slate-800 text-slate-400 text-[9px] font-black uppercase rounded-lg border border-slate-700 hover:text-white transition-all shadow-lg active:scale-95">Clear Buffer</button>
                        </div>
                    </div>
                    <div className="flex-1 flex flex-col min-w-0 bg-black/80">
                        {consoleTab === 'trace' ? (
                            <>
                                <div className="px-6 py-3 border-b border-white/5 flex items-center justify-between bg-slate-900/40">
                                    <div className="flex items-center gap-2"><Terminal size={14} className="text-red-400"/><span className="text-[10px] font-black uppercase tracking-widest text-slate-400">System Log Trace (RAW)</span></div>
                                    <button onClick={() => setIsLogPaused(!isLogPaused)} className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${isLogPaused ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'}`}>{isLogPaused ? <PlayIcon size={12}/> : <Pause size={12}/>}{isLogPaused ? 'Resume' : 'Pause'}</button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 space-y-3 scrollbar-thin scrollbar-thumb-white/10 text-left">
                                    {visibleLogs.filter(l => l.type !== 'loop').length === 0 && (<p className="text-slate-700 italic text-xs">Awaiting neural activity...</p>)}
                                    {visibleLogs.filter(l => l.type !== 'loop').map(log => (
                                        <div key={log.id} className={`flex flex-col gap-2 p-3 rounded-2xl border transition-all hover:border-white/10 ${getLogColor(log.type)}`}>
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex items-start gap-3">
                                                    <div className="mt-1 shrink-0">{getLogIcon(log.type)}</div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-[8px] font-black uppercase tracking-widest opacity-40">[{log.time}]</span>
                                                            <span className="text-[9px] font-black uppercase tracking-widest">{log.type}</span>
                                                            {log.meta?.category && <span className="px-1.5 py-0.5 bg-black/20 rounded text-[7px] font-black uppercase tracking-tighter">{log.meta.category}</span>}
                                                            {log.meta?.model && <span className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 rounded text-[7px] font-mono">{log.meta.model}</span>}
                                                        </div>
                                                        <p className="text-[11px] font-mono whitespace-pre-wrap leading-relaxed selection:bg-indigo-500/30">{log.text}</p>
                                                    </div>
                                                </div>
                                                {log.meta?.latency !== undefined && (
                                                    <div className="text-right shrink-0">
                                                        <div className="flex items-center gap-1 text-[8px] font-black text-slate-500 uppercase">
                                                            <Clock size={8}/> {log.meta.latency}ms
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {log.meta && (log.meta.inputTokens || log.meta.outputTokens || log.meta.postBalance !== undefined) && (
                                                <div className="mt-2 pt-2 border-t border-current/10 grid grid-cols-2 sm:grid-cols-4 gap-4">
                                                    {(log.meta.inputTokens || log.meta.outputTokens) && (
                                                        <div className="space-y-1">
                                                            <p className="text-[7px] font-black uppercase opacity-40">Token Density</p>
                                                            <div className="flex items-center gap-2 font-mono text-[9px] font-bold">
                                                                <span title="Input" className="text-indigo-400">IN: {log.meta.inputTokens || 0}</span>
                                                                <span className="opacity-20">|</span>
                                                                <span title="Completion" className="text-emerald-400">OUT: {log.meta.outputTokens || 0}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {log.meta.inputSizeBytes && (
                                                        <div className="space-y-1">
                                                            <p className="text-[7px] font-black uppercase opacity-40">I/O Payload</p>
                                                            <p className="font-mono text-[9px] font-bold uppercase tracking-tighter">
                                                                {Math.round(log.meta.inputSizeBytes / 1024)}KB -> {Math.round((log.meta.outputSizeBytes || 0) / 1024)}KB
                                                            </p>
                                                        </div>
                                                    )}
                                                    {log.meta.postBalance !== undefined && (
                                                        <div className="space-y-1">
                                                            <p className="text-[7px] font-black uppercase opacity-40">Neural Assets (VC)</p>
                                                            <div className="flex items-center gap-1.5 font-mono text-[9px] font-black">
                                                                <span className="text-slate-400">{log.meta.preBalance}</span>
                                                                <ArrowRight size={8} className="opacity-30"/>
                                                                <span className="text-emerald-400">{log.meta.postBalance}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {log.meta.cost && (
                                                        <div className="space-y-1">
                                                            <p className="text-[7px] font-black uppercase opacity-40">Refraction Tax</p>
                                                            <p className="font-mono text-[9px] font-black text-red-400">-{log.meta.cost} VC</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : consoleTab === 'loop' ? (
                            <div className="flex-1 flex flex-col min-w-0 bg-black/80 animate-fade-in">
                                <div className="px-6 py-3 border-b border-white/5 flex items-center justify-between bg-indigo-900/20">
                                    <div className="flex items-center gap-2"><Repeat size={14} className="text-indigo-400 animate-spin-slow"/><span className="text-[10px] font-black uppercase tracking-widest text-indigo-100">Dyad Self-Feedback Loop</span></div>
                                    <button onClick={handleExportLogs} className="p-1.5 text-indigo-300 hover:text-white" title="Export Loop Logs"><FileDown size={14}/></button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
                                    {visibleLogs.filter(l => l.type === 'loop').length === 0 && (
                                        <div className="h-full flex flex-col items-center justify-center opacity-20 gap-4">
                                            <Repeat size={48}/>
                                            <p className="text-xs font-black uppercase tracking-widest">Awaiting Machine Handshake</p>
                                        </div>
                                    )}
                                    {visibleLogs.filter(l => l.type === 'loop').map(log => (
                                        <div key={log.id} className="bg-slate-900 border border-indigo-500/20 rounded-3xl p-6 space-y-4 shadow-xl">
                                            <div className="flex justify-between items-center border-b border-white/5 pb-3">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[8px] font-black text-indigo-400 uppercase bg-indigo-500/10 px-2 py-0.5 rounded">FROM: {log.meta?.senderTool}</span>
                                                    <ArrowRight size={10} className="text-slate-600"/>
                                                    <span className="text-[8px] font-black text-emerald-400 uppercase bg-emerald-500/10 px-2 py-0.5 rounded">TO: {log.meta?.receiverTool}</span>
                                                </div>
                                                <span className="text-[9px] font-mono text-slate-500">{log.time}</span>
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-xs text-white font-bold">{log.text}</p>
                                                <div className="bg-black rounded-2xl p-4 border border-white/5 font-mono text-[10px] text-indigo-300 overflow-x-auto">
                                                    <pre>{safeJsonStringify(log.meta?.machineContent)}</pre>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col p-8 space-y-6 animate-fade-in">
                                <div className="flex justify-between items-center"><h3 className="text-lg font-black text-white italic uppercase tracking-widest flex items-center gap-3"><MessageCircle className="text-indigo-400"/> Human Feedback</h3>{feedbackSuccess && (<div className="flex items-center gap-2 text-emerald-400 text-[10px] font-black uppercase bg-emerald-950/30 px-3 py-1.5 rounded-lg border border-emerald-500/30 animate-fade-in"><CheckCircle size={14}/> {t.feedbackSuccess}</div>)}</div>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['general', 'bug', 'feature'] as const).map(type => (
                                        <button key={type} onClick={() => setFeedbackType(type)} className={`py-2 rounded-xl text-[10px] font-black uppercase border transition-all ${feedbackType === type ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-900 border-slate-800 text-slate-50'}`}>{type}</button>
                                    ))}
                                </div>
                                <textarea value={feedbackText} onChange={e => setFeedbackText(e.target.value)} className="flex-1 bg-slate-950 border border-slate-800 rounded-[2rem] p-6 text-sm text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none shadow-inner leading-relaxed" placeholder="Report a bug, suggest a feature, or request a new Neural Lab..."/>
                                <div className="flex justify-between items-center gap-4"><div className="flex items-center gap-2 px-4 py-2 bg-slate-950 border border-slate-800 rounded-full text-[9px] font-black text-slate-500 uppercase"><Activity size={12} className="text-indigo-400"/> Trace Bundling Enabled</div><button onClick={handleSendFeedback} disabled={!feedbackText.trim() || isSubmittingFeedback} className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3">{isSubmittingFeedback ? <Loader2 size={18} className="animate-spin"/> : <Send size={18}/>}<span>{t.submitFeedback}</span></button></div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="bg-black/90 p-2 text-center border-t border-white/5"><p className="text-[8px] font-black text-slate-700 uppercase tracking-[0.4em]">Neural Handshake Protocol v12.9.0-LOOP</p></div>
            </div>
        </div>

        <CreateChannelModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onCreate={handleCreateChannel} currentUser={currentUser} />
        <VoiceCreateModal isOpen={isVoiceCreateOpen} onClose={() => setIsVoiceCreateOpen(false)} onCreate={handleCreateChannel} />
        <PricingModal isOpen={isPricingModalOpen} onClose={() => setIsPricingModalOpen(false)} user={userProfile} onSuccess={(tier) => { if(userProfile) setUserProfile({...userProfile, subscriptionTier: tier}); }} />
        {currentUser && ( <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} user={userProfile || { uid: currentUser.uid, email: currentUser.email, displayName: currentUser.displayName, photoURL: currentUser.photoURL, groups: [], coinBalance: 0, createdAt: Date.now(), lastLogin: Date.now(), subscriptionTier: 'free', apiUsageCount: 0 } as UserProfile} onUpdateProfile={setUserProfile} onUpgradeClick={() => setIsPricingModalOpen(true)} isSuperAdmin={isSuperAdmin} onNavigateAdmin={() => handleSetViewState('firestore_debug')} /> )}
        
        {commentChannelId && ( <CommentsModal isOpen={true} onClose={() => setCommentChannelId(null)} channel={commentChannel!} onAddComment={handleAddComment} onDeleteComment={handleDeleteComment} onEditComment={handleEditComment} currentUser={currentUser} /> )}
        {editChannelId && ( <ChannelSettingsModal isOpen={true} onClose={() => setEditChannelId(null)} channel={editChannel!} onUpdate={handleUpdateChannel} /> )}
        
        {manualViewId && ( <ManualModal isOpen={true} onClose={() => setManualViewId(null)} viewId={manualViewId} /> )}
      </div>
    </ErrorBoundary>
  );
};

export default App;