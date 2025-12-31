
import React, { useState, useEffect, useMemo } from 'react';
import { Channel, ViewState, UserProfile, TranscriptItem, SubscriptionTier } from './types';
import { 
  Podcast, Search, LayoutGrid, RefreshCw, 
  Home, Video as VideoIcon, User, ArrowLeft, Play, Gift, 
  Calendar, Briefcase, Users, Disc, FileText, Code, Wand2, PenTool, Rss, Loader2, MessageSquare, AppWindow, Square, Menu, X, Shield, Plus, Rocket, Book
} from 'lucide-react';
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
import { FirestoreInspector } from './components/FirestoreInspector';

import { getCurrentUser, getDriveToken } from './services/authService';
import { ensureCodeStudioFolder, loadAppStateFromDrive, saveAppStateToDrive } from './services/googleDriveService';
import { getUserChannels, saveUserChannel, deleteUserChannel } from './utils/db';
import { HANDCRAFTED_CHANNELS } from './utils/initialData';
import { OFFLINE_CHANNEL_ID } from './utils/offlineContent';
import { warmUpAudioContext, stopAllPlatformAudio, isAnyAudioPlaying, getGlobalAudioContext } from './utils/audioUtils';

const APP_VERSION = "v4.1.0-FIX"; 

const UI_TEXT = {
  en: {
    appTitle: "AIVoiceCast",
    directory: "Explore", 
    myFeed: "My Feed",
    live: "Live Studio",
    search: "Search topics...",
    create: "New Podcast",
    host: "Host",
    listeners: "Listeners",
    featured: "Featured",
    categories: "Categories",
    all: "All Podcasts",
    calendar: "Calendar",
    mentorship: "Mentorship",
    groups: "Groups",
    recordings: "Recordings",
    docs: "Documents",
    lectures: "Lectures",
    podcasts: "Podcasts",
    mission: "Mission & Manifesto",
    code: "Code Studio",
    whiteboard: "Whiteboard",
    blog: "Community Blog",
    chat: "Team Chat",
    careers: "Careers",
    notebooks: "LLM Notebooks",
    cards: "Card Workshop",
    icons: "Icon Lab"
  },
  zh: {
    appTitle: "AI 播客",
    directory: "探索",
    myFeed: "我的订阅",
    live: "直播中",
    search: "搜索主题...",
    create: "创建播客",
    host: "主播",
    listeners: "听众",
    featured: "精选",
    categories: "分类",
    all: "全部播客",
    calendar: "日历",
    mentorship: "导师",
    groups: "群组",
    recordings: "录音",
    docs: "文档",
    lectures: "课程",
    podcasts: "播客",
    mission: "使命与宣言",
    code: "代码工作室",
    whiteboard: "白板",
    blog: "社区博客",
    chat: "团队聊天",
    careers: "职业发展",
    notebooks: "LLM 笔记本",
    cards: "贺卡工坊",
    icons: "图标生成器"
  }
};

const App: React.FC = () => {
  const [language, setLanguage] = useState<'en' | 'zh'>('en');
  const t = UI_TEXT[language];
  const [viewState, setViewState] = useState<ViewState | 'firestore_debug'>('directory');
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isAppsMenuOpen, setIsAppsMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('categories');
  const [searchQuery, setSearchQuery] = useState('');
  const [channels, setChannels] = useState<Channel[]>(HANDCRAFTED_CHANNELS);
  const [userChannels, setUserChannels] = useState<Channel[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isVoiceCreateOpen, setIsVoiceCreateOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [globalVoice, setGlobalVoice] = useState('Auto');

  // Add state for live session parameters to enable session transitions
  const [liveSessionParams, setLiveSessionParams] = useState<{
    channel: Channel;
    context?: string;
    recordingEnabled?: boolean;
    videoEnabled?: boolean;
    cameraEnabled?: boolean;
  } | null>(null);

  const allApps = [
    { id: 'podcasts', label: t.podcasts, icon: Podcast, action: () => { handleSetViewState('directory'); setActiveTab('categories'); }, color: 'text-indigo-400' },
    { id: 'icon_lab', label: t.icons, icon: AppWindow, action: () => handleSetViewState('icon_generator'), color: 'text-cyan-400' },
    { id: 'mission', label: t.mission, icon: Rocket, action: () => handleSetViewState('mission'), color: 'text-orange-500' },
    { id: 'code_studio', label: t.code, icon: Code, action: () => handleSetViewState('code_studio'), color: 'text-blue-400' },
    { id: 'notebook_viewer', label: t.notebooks, icon: Book, action: () => handleSetViewState('notebook_viewer'), color: 'text-orange-300' },
    { id: 'whiteboard', label: t.whiteboard, icon: PenTool, action: () => handleSetViewState('whiteboard'), color: 'text-pink-400' },
    { id: 'calendar', label: t.calendar, icon: Calendar, action: () => { handleSetViewState('directory'); setActiveTab('calendar'); }, color: 'text-emerald-400' },
    { id: 'careers', label: t.careers, icon: Briefcase, action: () => handleSetViewState('careers'), color: 'text-yellow-400' },
    { id: 'blog', label: t.blog, icon: Rss, action: () => handleSetViewState('blog'), color: 'text-orange-400' },
    { id: 'card_workshop', label: t.cards, icon: Gift, action: () => handleSetViewState('card_workshop'), color: 'text-red-400' },
    { id: 'recordings', label: t.recordings, icon: Disc, action: () => { handleSetViewState('directory'); setActiveTab('recordings'); }, color: 'text-red-400' },
    { id: 'docs', label: t.docs, icon: FileText, action: () => { handleSetViewState('directory'); setActiveTab('docs'); }, color: 'text-gray-400' },
  ];

  const handleSetViewState = (newState: any) => {
    stopAllPlatformAudio(`Navigation:${viewState}->${newState}`);
    setViewState(newState);
    setIsAppsMenuOpen(false);
    setIsUserMenuOpen(false);
  };

  // Define handleStartLiveSession to fix the undefined name error and manage transition to LiveSession component
  const handleStartLiveSession = (
    channel: Channel, 
    context?: string, 
    recordingEnabled?: boolean, 
    bookingId?: string, 
    videoEnabled?: boolean, 
    cameraEnabled?: boolean
  ) => {
    setLiveSessionParams({
      channel,
      context,
      recordingEnabled,
      videoEnabled,
      cameraEnabled
    });
    handleSetViewState('live_session');
  };

  // Sync Logic: Auto-save to Drive
  useEffect(() => {
    if (currentUser) {
        const token = getDriveToken();
        if (token) {
            const state = { userProfile, userChannels, timestamp: Date.now() };
            ensureCodeStudioFolder(token).then(fid => {
                saveAppStateToDrive(token, fid, state).catch(e => console.error("Drive sync failed", e));
            });
        }
    }
  }, [userProfile, userChannels, currentUser]);

  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
        setCurrentUser(user);
        const token = getDriveToken();
        if (token) {
            ensureCodeStudioFolder(token).then(fid => {
                loadAppStateFromDrive(token, fid).then(data => {
                    if (data) {
                        if (data.userProfile) setUserProfile(data.userProfile);
                        if (data.userChannels) {
                            setUserChannels(data.userChannels);
                            data.userChannels.forEach((ch: any) => saveUserChannel(ch));
                        }
                    }
                }).catch(() => console.warn("Could not load state from Drive."));
            }).catch(() => console.warn("Drive folder initialization failed."));
        }
    }
    getUserChannels().then(setUserChannels).catch(() => console.warn("Local DB inaccessible."));
    setAuthLoading(false);

    const updateAudioState = () => {};
    window.addEventListener('audio-audit-updated', updateAudioState);
    return () => window.removeEventListener('audio-audit-updated', updateAudioState);
  }, []);

  useEffect(() => {
    const all = [...HANDCRAFTED_CHANNELS, ...userChannels];
    const unique = Array.from(new Map(all.map(item => [item.id, item])).values());
    unique.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    setChannels(unique);
  }, [userChannels]);

  const activeChannel = useMemo(() => channels.find(c => c.id === activeChannelId), [channels, activeChannelId]);

  const handleCreateChannel = async (newChannel: Channel) => {
    const channelToSave = { ...newChannel, createdAt: newChannel.createdAt || Date.now() };
    setUserChannels(prev => [channelToSave, ...prev]);
    await saveUserChannel(channelToSave);
  };

  if (authLoading) return <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-indigo-400"><Loader2 size={48} className="animate-spin mb-4" /><p className="text-sm font-bold uppercase tracking-widest">Initializing Environment...</p></div>;
  if (isPrivacyOpen) return <PrivacyPolicy onBack={() => setIsPrivacyOpen(false)} />;
  if (viewState === 'mission') return <MissionManifesto onBack={() => handleSetViewState('directory')} />;

  const MobileBottomNav = () => {
    const quickApp = allApps[1]; 
    return (
      <div className="md:hidden fixed bottom-0 left-0 w-full bg-slate-950/90 backdrop-blur-md border-t border-slate-800 z-50 px-6 py-2 flex justify-between items-center safe-area-bottom">
          <button onClick={() => { handleSetViewState('directory'); setActiveTab('categories'); }} className={`flex flex-col items-center gap-1 ${viewState === 'directory' ? 'text-white' : 'text-slate-500'}`}><Home size={24}/><span className="text-[10px]">Home</span></button>
          <button onClick={() => quickApp.action()} className={`flex flex-col items-center gap-1 ${viewState === quickApp.id ? 'text-white' : 'text-slate-500'}`}><quickApp.icon size={24}/><span className="text-[10px]">{quickApp.label}</span></button>
          <button onClick={() => setIsVoiceCreateOpen(true)} className="flex flex-col items-center justify-center -mt-6"><div className="bg-gradient-to-r from-blue-500 to-red-500 p-0.5 rounded-xl w-12 h-8 flex items-center justify-center shadow-lg"><div className="bg-black w-full h-full rounded-lg flex items-center justify-center"><Plus size={20} className="text-white"/></div></div></button>
          <button onClick={() => setIsAppsMenuOpen(true)} className={`flex flex-col items-center gap-1 ${isAppsMenuOpen ? 'text-white' : 'text-slate-500'}`}><LayoutGrid size={24}/><span className="text-[10px]">Apps</span></button>
          <button onClick={() => setIsUserMenuOpen(true)} className={`flex flex-col items-center gap-1 ${isUserMenuOpen ? 'text-white' : 'text-slate-500'}`}><User size={24}/><span className="text-[10px]">Profile</span></button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      <nav className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 h-16 flex items-center">
        <div className="max-w-7xl mx-auto px-4 w-full flex justify-between items-center">
            <div className="flex items-center cursor-pointer" onClick={() => { handleSetViewState('directory'); setActiveTab('categories'); }}>
              <div className="bg-indigo-600 p-2 rounded-xl"><Podcast className="text-white w-6 h-6" /></div>
              <span className="ml-3 text-xl font-bold">AIVoiceCast</span>
            </div>
            <div className="flex items-center space-x-4">
              <button onClick={() => setLanguage(prev => prev === 'en' ? 'zh' : 'en')} className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold">{language === 'en' ? '中' : 'EN'}</button>
              <UserAuth />
              {currentUser && <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className="p-2 rounded-full hover:bg-slate-800"><Menu size={24}/></button>}
            </div>
        </div>
      </nav>

      {!currentUser && <LoginPage onPrivacyClick={() => setIsPrivacyOpen(false)} onMissionClick={() => handleSetViewState('mission')} />}

      {currentUser && (
        <>
            <div className="flex-1 overflow-hidden h-[calc(100vh-64px)] pb-16 md:pb-0">
                {viewState === 'directory' && (
                    <div className="h-full flex flex-col">
                        {activeTab === 'categories' && (
                            <PodcastFeed 
                                channels={channels.filter(c => !searchQuery || c.title.toLowerCase().includes(searchQuery.toLowerCase()))} 
                                onChannelClick={(id) => { setActiveChannelId(id); handleSetViewState('podcast_detail'); }} 
                                onStartLiveSession={handleStartLiveSession} 
                                userProfile={userProfile} 
                                globalVoice={globalVoice} 
                                currentUser={currentUser} 
                            />
                        )}
                        {activeTab !== 'categories' && (
                             <div className="h-full overflow-y-auto p-4 max-w-7xl mx-auto w-full">
                                {activeTab === 'calendar' && <CalendarView channels={channels} handleChannelClick={(id) => { setActiveChannelId(id); handleSetViewState('podcast_detail'); }} handleVote={()=>{}} currentUser={currentUser} setChannelToEdit={()=>{}} setIsSettingsModalOpen={()=>{}} globalVoice={globalVoice} t={t} onCommentClick={()=>{}} onStartLiveSession={handleStartLiveSession} onCreateChannel={handleCreateChannel} onSchedulePodcast={()=>{}} />}
                                {activeTab === 'recordings' && <RecordingList onStartLiveSession={handleStartLiveSession} />}
                                {activeTab === 'docs' && <DocumentList />}
                             </div>
                        )}
                    </div>
                )}
                {viewState === 'podcast_detail' && activeChannelId && activeChannel && <PodcastDetail channel={activeChannel} onBack={() => handleSetViewState('directory')} onStartLiveSession={handleStartLiveSession} language={language} currentUser={currentUser} />}
                {/* Fixed: Render LiveSession component when viewState is live_session */}
                {viewState === 'live_session' && liveSessionParams && (
                    <LiveSession 
                        channel={liveSessionParams.channel} 
                        initialContext={liveSessionParams.context} 
                        recordingEnabled={liveSessionParams.recordingEnabled}
                        videoEnabled={liveSessionParams.videoEnabled}
                        cameraEnabled={liveSessionParams.cameraEnabled}
                        onEndSession={() => handleSetViewState('directory')}
                        language={language}
                    />
                )}
                {viewState === 'code_studio' && <CodeStudio onBack={() => handleSetViewState('directory')} currentUser={currentUser} userProfile={userProfile} onSessionStart={()=>{}} onSessionStop={()=>{}} onStartLiveSession={handleStartLiveSession} />}
                {viewState === 'whiteboard' && <Whiteboard onBack={() => handleSetViewState('directory')} />}
                {viewState === 'blog' && <BlogView currentUser={currentUser} onBack={() => handleSetViewState('directory')} />}
                {viewState === 'chat' && <WorkplaceChat currentUser={currentUser} onBack={() => handleSetViewState('directory')} />}
                {viewState === 'careers' && <CareerCenter currentUser={currentUser} onBack={() => handleSetViewState('directory')} />}
                {viewState === 'notebook_viewer' && <NotebookViewer currentUser={currentUser} onBack={() => handleSetViewState('directory')} />}
                {viewState === 'card_workshop' && <CardWorkshop onBack={() => handleSetViewState('directory')} />}
                {viewState === 'card_explorer' && <CardExplorer onBack={() => handleSetViewState('directory')} onOpenCard={(id) => handleSetViewState('card_workshop')} onCreateNew={() => handleSetViewState('card_workshop')} />}
                {viewState === 'user_guide' && <UserManual onBack={() => handleSetViewState('directory')} />}
                {viewState === 'icon_generator' && <IconGenerator onBack={() => handleSetViewState('directory')} currentUser={currentUser} />}
                {viewState === 'firestore_debug' && <FirestoreInspector onBack={() => handleSetViewState('directory')} />}
            </div>

            <MobileBottomNav />

            {isUserMenuOpen && (
                <StudioMenu 
                    isUserMenuOpen={isUserMenuOpen} 
                    setIsUserMenuOpen={setIsUserMenuOpen} 
                    userProfile={userProfile} 
                    setUserProfile={setUserProfile} 
                    currentUser={currentUser} 
                    globalVoice={globalVoice} 
                    setGlobalVoice={setGlobalVoice} 
                    setIsCreateModalOpen={setIsCreateModalOpen} 
                    setIsVoiceCreateOpen={setIsVoiceCreateOpen} 
                    setIsSyncModalOpen={()=>{}} 
                    setIsSettingsModalOpen={setIsSettingsModalOpen} 
                    onOpenUserGuide={() => handleSetViewState('user_guide')} 
                    onNavigate={handleSetViewState} 
                    onOpenPrivacy={() => setIsPrivacyOpen(true)} 
                    t={t} 
                    className="fixed top-16 right-4 z-[100] w-72" 
                    channels={channels} 
                    language={language} 
                    setLanguage={setLanguage} 
                />
            )}

            {isAppsMenuOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
                    <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg p-6 animate-fade-in-up">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white">Application Suite</h2>
                            <button onClick={() => setIsAppsMenuOpen(false)} className="text-slate-400 hover:text-white"><X/></button>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            {allApps.map(app => (
                                <button key={app.id} onClick={() => { app.action(); setIsAppsMenuOpen(false); }} className="flex flex-col items-center gap-2 p-4 rounded-2xl hover:bg-slate-800 transition-all border border-transparent hover:border-slate-700 group">
                                    <div className={`p-3 rounded-2xl bg-slate-800 group-hover:scale-110 transition-transform ${app.color}`}>
                                        <app.icon size={24} />
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{app.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <CreateChannelModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onCreate={handleCreateChannel} />
            <VoiceCreateModal isOpen={isVoiceCreateOpen} onClose={() => setIsVoiceCreateOpen(false)} onCreate={handleCreateChannel} />
        </>
      )}
    </div>
  );
};

export default App;
