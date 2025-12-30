
import React, { useState, useEffect, useMemo } from 'react';
import { Channel, ViewState, UserProfile, TranscriptItem, SubscriptionTier } from './types';
import { 
  Podcast, Mic, Layout, Search, Sparkles, LogOut, 
  Settings, Menu, X, Plus, Github, Database, Cloud, Globe, 
  Calendar, Briefcase, Users, Disc, FileText, AlertTriangle, List, BookOpen, ChevronDown, Table as TableIcon, LayoutGrid, Rocket, Code, Wand2, PenTool, Rss, Loader2, MessageSquare,
  Home, Video as VideoIcon, Inbox, User, PlusSquare, ArrowLeft, Play, Book, Gift, Square, Shield, RefreshCw, AppWindow
} from 'lucide-react';
import { LiveSession } from './components/LiveSession';
import { PodcastDetail } from './components/PodcastDetail';
import { ChannelCard } from './components/ChannelCard';
import { UserAuth } from './components/UserAuth';
import { CreateChannelModal } from './components/CreateChannelModal';
import { VoiceCreateModal } from './components/VoiceCreateModal';
import { DataSyncModal } from './components/DataSyncModal';
import { FirebaseConfigModal } from './components/FirebaseConfigModal';
import { DebugView } from './components/DebugView';
import { CloudDebugView } from './components/CloudDebugView';
import { PublicChannelInspector } from './components/PublicChannelInspector';
import { MyChannelInspector } from './components/MyChannelInspector';
import { FirestoreInspector } from './components/FirestoreInspector';
import { StudioMenu } from './components/StudioMenu';
import { ChannelSettingsModal } from './components/ChannelSettingsModal';
import { CommentsModal } from './components/CommentsModal';
import { Notifications } from './components/Notifications';
import { GroupManager } from './components/GroupManager';
import { MentorBooking } from './components/MentorBooking';
import { RecordingList } from './components/RecordingList';
import { DocumentList } from './components/DocumentList';
import { CalendarView } from './components/CalendarView';
import { PodcastListTable, SortKey } from './components/PodcastListTable';
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

import { auth, isFirebaseConfigured } from './services/firebaseConfig';
import { 
  voteChannel, publishChannelToFirestore, updateCommentInChannel, 
  deleteCommentFromChannel, addCommentToChannel, getPublicChannels, 
  subscribeToPublicChannels, getGroupChannels, getUserProfile,
  setupSubscriptionListener, createOrGetDMChannel, subscribeToAllChannelsAdmin
} from './services/firestoreService';
import { getUserChannels, saveUserChannel, deleteUserChannel } from './utils/db';
import { HANDCRAFTED_CHANNELS, CATEGORY_STYLES, TOPIC_CATEGORIES } from './utils/initialData';
import { OFFLINE_CHANNEL_ID } from './utils/offlineContent';
import { warmUpAudioContext, stopAllPlatformAudio, isAnyAudioPlaying } from './utils/audioUtils';

const APP_VERSION = "v3.85.1"; 

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

type ExtendedViewState = ViewState | 'firestore_debug' | 'my_channel_debug' | 'card_viewer';

const App: React.FC = () => {
  const [language, setLanguage] = useState<'en' | 'zh'>('en');
  const t = UI_TEXT[language];
  const [viewState, setViewState] = useState<ExtendedViewState>('directory');
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isAppsMenuOpen, setIsAppsMenuOpen] = useState(false);
  const [isDesktopAppsOpen, setIsDesktopAppsOpen] = useState(false);
  
  // Mobile Navigation State
  const [mobileFeedTab, setMobileFeedTab] = useState<'foryou' | 'following'>('foryou');
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [mobileSearchQuery, setMobileSearchQuery] = useState('');
  
  // Audio State UI
  const [audioIsPlaying, setAudioIsPlaying] = useState(false);

  // Auth State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Privacy Policy Public View
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);

  const [activeTab, setActiveTab] = useState('categories');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Layout & Sorting
  const [layoutMode, setLayoutMode] = useState<'grid' | 'table'>('grid');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'createdAt', direction: 'desc' });

  // Data State
  const [channels, setChannels] = useState<Channel[]>(HANDCRAFTED_CHANNELS);
  const [publicChannels, setPublicChannels] = useState<Channel[]>([]);
  const [userChannels, setUserChannels] = useState<Channel[]>([]);
  const [groupChannels, setGroupChannels] = useState<Channel[]>([]);
  
  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createModalDate, setCreateModalDate] = useState<Date | null>(null);
  
  const [isVoiceCreateOpen, setIsVoiceCreateOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isFirebaseModalOpen, setIsFirebaseModalOpen] = useState(false);
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false); 
  const [isPricingOpen, setIsPricingOpen] = useState(false); 
  
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [channelToEdit, setChannelToEdit] = useState<Channel | null>(null);
  const [isCommentsModalOpen, setIsCommentsModalOpen] = useState(false);
  const [commentsChannel, setCommentsChannel] = useState<Channel | null>(null);

  // Collaboration State
  const [sharedSessionId, setSharedSessionId] = useState<string | undefined>(undefined);
  const [accessKey, setAccessKey] = useState<string | undefined>(undefined);
  
  // Card Viewer State
  const [viewCardId, setViewCardId] = useState<string | undefined>(undefined);

  // Live Session Config
  const [liveConfig, setLiveConfig] = useState<{
    context?: string;
    bookingId?: string;
    recording?: boolean;
    video?: boolean;
    camera?: boolean;
    segment?: { index: number, lectureId: string };
    initialTranscript?: TranscriptItem[];
  }>({});

  // Ad-hoc Meeting Channel (Ephemeral)
  const [tempChannel, setTempChannel] = useState<Channel | null>(null);

  const [globalVoice, setGlobalVoice] = useState('Auto');
  
  // Messaging Target
  const [chatTargetId, setChatTargetId] = useState<string | null>(null);

  const allApps = [
    { id: 'podcasts', label: t.podcasts, icon: Podcast, action: () => { handleSetViewState('directory'); setActiveTab('categories'); }, color: 'text-indigo-400' },
    { id: 'icon_lab', label: t.icons, icon: AppWindow, action: () => handleSetViewState('icon_generator'), color: 'text-cyan-400' },
    { id: 'mission', label: t.mission, icon: Rocket, action: () => handleSetViewState('mission'), color: 'text-orange-500' },
    { id: 'code_studio', label: t.code, icon: Code, action: () => handleSetViewState('code_studio'), color: 'text-blue-400' },
    { id: 'notebook_viewer', label: t.notebooks, icon: Book, action: () => handleSetViewState('notebook_viewer'), color: 'text-orange-300' },
    { id: 'whiteboard', label: t.whiteboard, icon: PenTool, action: () => handleSetViewState('whiteboard'), color: 'text-pink-400' },
    { id: 'chat', label: t.chat, icon: MessageSquare, action: () => handleSetViewState('chat'), color: 'text-indigo-400' },
    { id: 'calendar', label: t.calendar, icon: Calendar, action: () => { handleSetViewState('directory'); setActiveTab('calendar'); }, color: 'text-emerald-400' },
    { id: 'careers', label: t.careers, icon: Briefcase, action: () => handleSetViewState('careers'), color: 'text-yellow-400' },
    { id: 'blog', label: t.blog, icon: Rss, action: () => handleSetViewState('blog'), color: 'text-orange-400' },
    { id: 'card_workshop', label: t.cards, icon: Gift, action: () => handleSetViewState('card_workshop'), color: 'text-red-400' },
    { id: 'mentorship', label: t.mentorship, icon: Users, action: () => { handleSetViewState('directory'); setActiveTab('mentorship'); }, color: 'text-purple-400' },
    { id: 'groups', label: t.groups, icon: Users, action: () => { handleSetViewState('directory'); setActiveTab('groups'); }, color: 'text-cyan-400' },
    { id: 'recordings', label: t.recordings, icon: Disc, action: () => { handleSetViewState('directory'); setActiveTab('recordings'); }, color: 'text-red-400' },
    { id: 'docs', label: t.docs, icon: FileText, action: () => { handleSetViewState('directory'); setActiveTab('docs'); }, color: 'text-gray-400' },
  ];

  const handleSetViewState = (newState: ExtendedViewState) => {
    stopAllPlatformAudio(`Navigation:${viewState}->${newState}`);
    setViewState(newState);
  };

  useEffect(() => {
    const updateAudioState = () => setAudioIsPlaying(isAnyAudioPlaying());
    window.addEventListener('audio-audit-updated', updateAudioState);
    return () => window.removeEventListener('audio-audit-updated', updateAudioState);
  }, []);

  useEffect(() => {
      const handlePopState = () => {
          stopAllPlatformAudio("BrowserNavigation");
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
      const handleFirstInteraction = () => {
          const audioCtx = (window as any).sharedAudioContext;
          if (audioCtx) {
              warmUpAudioContext(audioCtx);
          }
          window.removeEventListener('touchstart', handleFirstInteraction);
          window.removeEventListener('click', handleFirstInteraction);
      };

      window.addEventListener('touchstart', handleFirstInteraction);
      window.addEventListener('click', handleFirstInteraction);
      
      return () => {
          window.removeEventListener('touchstart', handleFirstInteraction);
          window.removeEventListener('click', handleFirstInteraction);
      };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const session = params.get('session');
    const keyParam = params.get('key'); 
    const mode = params.get('mode');
    const view = params.get('view');
    const id = params.get('id');

    if (view === 'card' && id) {
        setViewCardId(id);
        handleSetViewState('card_viewer');
    } else if (view === 'card_workshop') {
        if (id) setViewCardId(id);
        handleSetViewState('card_workshop');
    } else if (view === 'card_explorer') {
        handleSetViewState('card_explorer');
    } else if (view === 'code') {
        handleSetViewState('code_studio');
    } else if (view === 'whiteboard') {
        handleSetViewState('whiteboard');
    } else if (view === 'blog') {
        handleSetViewState('blog');
    } else if (view === 'chat') {
        handleSetViewState('chat');
    } else if (view === 'careers') {
        handleSetViewState('careers');
    } else if (view === 'guide') {
        handleSetViewState('user_guide');
    } else if (view === 'mission') {
        handleSetViewState('mission');
    } else if (view === 'notebooks') {
        handleSetViewState('notebook_viewer');
    } else if (view === 'icons') {
        handleSetViewState('icon_generator');
    } else if (view === 'podcast' && id) {
        setActiveChannelId(id);
        handleSetViewState('podcast_detail');
    } else if (view === 'calendar') {
        handleSetViewState('directory');
        setActiveTab('calendar');
    } else if (view === 'membership') {
        handleSetViewState('directory');
        setActiveTab('mentorship');
    } else if (view === 'group') {
        handleSetViewState('directory');
        setActiveTab('groups');
    } else if (view === 'recording') {
        handleSetViewState('directory');
        setActiveTab('recordings');
    } else if (view === 'document') {
        handleSetViewState('directory');
        setActiveTab('docs');
    } else if (view === 'debug_local') {
        handleSetViewState('debug');
    } else if (view === 'debug_firestore') {
        handleSetViewState('firestore_debug');
    } else if (view === 'debug_storage') {
        handleSetViewState('cloud_debug');
    } else if (view === 'debug_registry') {
        handleSetViewState('public_debug');
    } else if (view === 'debug_my_channels') {
        handleSetViewState('my_channel_debug');
    }

    if (session) {
        setSharedSessionId(session);
        if (keyParam) setAccessKey(keyParam);
        
        if (!view) {
            if (mode === 'whiteboard') handleSetViewState('whiteboard');
            else handleSetViewState('code_studio');
        }
    }

    let unsubscribeAuth = () => {};

    if (isFirebaseConfigured) {
        unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
          setCurrentUser(user);
          if (user) {
            try {
              const profile = await getUserProfile(user.uid);
              setUserProfile(profile);
            } catch (e) {
              console.error("Profile fetch error", e);
            }
          } else {
            setUserProfile(null);
            setGroupChannels([]);
          }
          setAuthLoading(false); 
        });
    } else {
        setIsFirebaseModalOpen(true);
        setAuthLoading(false);
    }

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
      if (!currentUser) return;

      const url = new URL(window.location.href);
      const params = url.searchParams;

      let viewParam: string | null = null;
      
      if (viewState === 'directory') {
          switch(activeTab) {
              case 'calendar': viewParam = 'calendar'; break;
              case 'mentorship': viewParam = 'membership'; break;
              case 'groups': viewParam = 'group'; break;
              case 'recordings': viewParam = 'recording'; break;
              case 'docs': viewParam = 'document'; break;
              default: viewParam = 'directory';
          }
      } else {
          switch(viewState) {
              case 'code_studio': viewParam = 'code'; break;
              case 'whiteboard': viewParam = 'whiteboard'; break;
              case 'blog': viewParam = 'blog'; break;
              case 'chat': viewParam = 'chat'; break;
              case 'careers': viewParam = 'careers'; break;
              case 'user_guide': viewParam = 'guide'; break;
              case 'mission': viewParam = 'mission'; break;
              case 'notebook_viewer': viewParam = 'notebooks'; break;
              case 'card_workshop': viewParam = 'card_workshop'; break;
              case 'card_explorer': viewParam = 'card_explorer'; break;
              case 'card_viewer': viewParam = 'card'; break;
              case 'icon_generator': viewParam = 'icons'; break;
              case 'podcast_detail': viewParam = 'podcast'; break;
              case 'debug': viewParam = 'debug_local'; break;
              case 'firestore_debug': viewParam = 'debug_firestore'; break;
              case 'cloud_debug': viewParam = 'debug_storage'; break;
              case 'public_debug': viewParam = 'debug_registry'; break;
              case 'my_channel_debug': viewParam = 'debug_my_channels'; break;
              default: viewParam = null;
          }
      }

      if (viewParam) {
          params.set('view', viewParam);
          if (viewState === 'podcast_detail' && activeChannelId) {
              params.set('id', activeChannelId);
          } else if (viewState === 'card_workshop' && viewCardId) {
              params.set('id', viewCardId);
          } else if (viewState === 'card_viewer' && viewCardId) {
              params.set('id', viewCardId);
          } else if (viewState !== 'podcast_detail' && viewState !== 'card_viewer' && viewState !== 'card_workshop') {
              params.delete('id');
          }
      } else {
          params.delete('view');
          params.delete('id');
      }

      window.history.replaceState({}, '', url.toString());
  }, [viewState, activeChannelId, viewCardId, activeTab, currentUser]);

  useEffect(() => {
      if (currentUser && isFirebaseConfigured) {
          const unsub = setupSubscriptionListener(currentUser.uid, (newTier) => {
              console.log("Subscription status updated:", newTier);
              setUserProfile(prev => prev ? { ...prev, subscriptionTier: newTier } : prev);
          });
          return () => unsub();
      }
  }, [currentUser]);

  useEffect(() => {
    getUserChannels().then(setUserChannels);
  }, []);

  useEffect(() => {
    if (isFirebaseConfigured && currentUser) {
        if (currentUser.email === 'shengliang.song@gmail.com') {
             const unsubAdmin = subscribeToAllChannelsAdmin(
                 (data) => setPublicChannels(data), 
                 (err) => console.error("Admin sub error", err)
             );
             return () => unsubAdmin();
        }

        const unsubPublic = subscribeToPublicChannels(
          (data) => setPublicChannels(data),
          (err: any) => {
              if (err.code === 'permission-denied' || err.message?.includes('permission')) {
                  console.warn("Public channels access denied. Waiting for authentication.");
              } else {
                  console.error("Public channels error", err);
              }
          }
        );
        return () => { unsubPublic(); };
    }
  }, [currentUser]);

  useEffect(() => {
    if (userProfile && userProfile.groups && userProfile.groups.length > 0) {
       getGroupChannels(userProfile.groups).then(setGroupChannels);
    }
  }, [userProfile]);

  useEffect(() => {
    const all = [...HANDCRAFTED_CHANNELS, ...userChannels, ...publicChannels, ...groupChannels];
    const unique = Array.from(new Map(all.map(item => [item.id, item])).values());
    
    unique.sort((a, b) => {
        const isAHand = HANDCRAFTED_CHANNELS.some(h => h.id === a.id);
        const isBHand = HANDCRAFTED_CHANNELS.some(h => h.id === b.id);
        if (isAHand && !isBHand) return -1;
        if (!isAHand && isBHand) return 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
    });
    
    setChannels(unique);
  }, [userChannels, publicChannels, groupChannels]);

  const activeChannel = useMemo(() => {
      return tempChannel || channels.find(c => c.id === activeChannelId);
  }, [channels, activeChannelId, tempChannel]);

  const handleVote = async (id: string, type: 'like' | 'dislike', e: React.MouseEvent) => {
    e.stopPropagation();
    
    setChannels(prev => prev.map(c => {
      if (c.id === id) {
        return type === 'like' ? { ...c, likes: c.likes + 1 } : { ...c, dislikes: c.dislikes + 1 };
      }
      return c;
    }));

    const channel = channels.find(c => c.id === id);
    if (channel) {
        await voteChannel(channel, type);
        if (currentUser && userProfile) {
            const currentLikes = userProfile.likedChannelIds || [];
            let newLikesList = [...currentLikes];
            
            if (type === 'like') {
                if (!newLikesList.includes(id)) newLikesList.push(id);
            } else {
                newLikesList = newLikesList.filter(lid => lid !== id);
            }
            
            setUserProfile({ ...userProfile, likedChannelIds: newLikesList });
        }
    }
  };

  const handleCreateChannel = async (newChannel: Channel) => {
    try {
        const channelToSave = {
            ...newChannel,
            createdAt: newChannel.createdAt || Date.now()
        };

        setUserChannels(prev => {
             const exists = prev.find(c => c.id === channelToSave.id);
             if (exists) return prev.map(c => c.id === channelToSave.id ? channelToSave : c);
             return [channelToSave, ...prev];
        });
        
        await saveUserChannel(channelToSave);
        
        if (channelToSave.visibility === 'public' || channelToSave.visibility === 'group') {
            await publishChannelToFirestore(channelToSave);
        }
    } catch (error: any) {
        console.error("Failed to create channel:", error);
        alert(`Failed to create podcast: ${error.message}`);
    }
  };

  const handleSchedulePodcast = (date: Date) => {
      setCreateModalDate(date);
      setIsCreateModalOpen(true);
  };

  const handleUpdateChannel = async (updatedChannel: Channel) => {
      try {
          if (updatedChannel.visibility === 'public' || updatedChannel.visibility === 'group') {
              await publishChannelToFirestore(updatedChannel);
          } else {
              await saveUserChannel(updatedChannel);
              setUserChannels(prev => prev.map(c => c.id === updatedChannel.id ? updatedChannel : c));
          }
          setChannels(prev => prev.map(c => {
              if (c.id === updatedChannel.id) return updatedChannel;
              return c;
          }));
      } catch (error: any) {
          console.error("Failed to update channel:", error);
          alert(`Failed to update podcast: ${error.message}`);
      }
  };

  const handleDeleteChannel = async () => {
      if (!channelToEdit) return;
      if (channelToEdit.visibility === 'public' || channelToEdit.visibility === 'group') {
          alert("Public channels must be deleted via the Inspector for now."); 
      } else {
          await deleteUserChannel(channelToEdit.id);
          setUserChannels(prev => prev.filter(c => c.id !== channelToEdit.id));
      }
      setChannelToEdit(null);
  };

  const handleCommentClick = (channel: Channel) => {
      setCommentsChannel(channel);
      setIsCommentsModalOpen(true);
  };

  const handleAddComment = async (text: string, attachments: any[]) => {
      if (!commentsChannel || !currentUser) return;
      
      const newComment = {
          id: crypto.randomUUID(),
          userId: currentUser.uid,
          user: currentUser.displayName || 'Anonymous',
          text,
          timestamp: Date.now(),
          attachments
      };
      
      const updatedChannel = { 
          ...commentsChannel, 
          comments: [...commentsChannel.comments, newComment] 
      };
      
      setCommentsChannel(updatedChannel);
      setChannels(prev => prev.map(c => c.id === commentsChannel.id ? updatedChannel : c));
      
      if (commentsChannel.visibility === 'public' || commentsChannel.visibility === 'group') {
          await addCommentToChannel(commentsChannel.id, newComment);
      } else {
          await saveUserChannel(updatedChannel);
          setUserChannels(prev => prev.map(c => c.id === updatedChannel.id ? updatedChannel : c));
      }
  };

  const handleStartLiveSession = (channel: Channel, context?: string, recordingEnabled?: boolean, bookingId?: string, videoEnabled?: boolean, cameraEnabled?: boolean) => {
      const existing = channels.find(c => c.id === channel.id);
      
      if (!existing) {
          setTempChannel(channel); 
      } else {
          setTempChannel(null);
      }
      
      setActiveChannelId(channel.id);
      setLiveConfig({
          context,
          bookingId: bookingId, 
          recording: recordingEnabled,
          video: videoEnabled,
          camera: cameraEnabled
      });
      handleSetViewState('live_session');
  };

  const handleMobileQuickStart = () => {
      const quickChannel: Channel = {
          id: 'quick-session',
          title: 'Quick Session',
          description: 'Ad-hoc voice session',
          author: 'You',
          ownerId: currentUser?.uid,
          visibility: 'private',
          voiceName: globalVoice === 'Auto' ? 'Puck' : globalVoice,
          systemInstruction: 'You are a helpful AI assistant. Answer questions and help with tasks.',
          likes: 0, 
          dislikes: 0, 
          comments: [],
          tags: [],
          imageUrl: 'https://images.unsplash.com/photo-1624969862644-791f3dc98927?w=600&q=80',
          createdAt: Date.now()
      };
      setTempChannel(quickChannel);
      setActiveChannelId(quickChannel.id);
      setLiveConfig({ recording: false }); 
      handleSetViewState('live_session');
  };

  const handleSessionStart = (id: string) => {
      setSharedSessionId(id);
      setAccessKey(undefined);
      
      const url = new URL(window.location.href);
      url.searchParams.set('session', id);
      window.history.replaceState({}, '', url.toString());
  };

  const handleSessionStop = () => {
      setSharedSessionId(undefined);
      setAccessKey(undefined);
      const url = new URL(window.location.href);
      url.searchParams.delete('session');
      url.searchParams.delete('key');
      window.history.replaceState({}, '', url.toString());
  };

  const handleMessageCreator = async (creatorId: string, creatorName: string) => {
      if (!currentUser) { 
          alert("Please sign in to message creators.");
          return;
      }
      
      try {
          const dmId = await createOrGetDMChannel(creatorId, creatorName);
          setChatTargetId(dmId);
          handleSetViewState('chat');
      } catch(e) {
          console.error("Failed to create DM:", e);
          alert("Could not start chat.");
      }
  };

  const handleSort = (key: SortKey) => {
      setSortConfig(current => ({
          key,
          direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
      }));
  };

  const feedChannels = useMemo(() => {
      let data = [...channels];
      
      if (mobileFeedTab === 'following') {
          if (userProfile) {
              const followingIds = userProfile.following || [];
              const likedIds = userProfile.likedChannelIds || [];
              
              if (followingIds.length > 0 || likedIds.length > 0) {
                  data = data.filter(c => 
                      (c.ownerId && followingIds.includes(c.ownerId)) || 
                      likedIds.includes(c.id)
                  );
              } else {
                  data = [];
              }
          } else {
              data = [];
          }
      }

      if (searchQuery) {
          const lowerQ = searchQuery.toLowerCase();
          data = data.filter(c => 
              c.title.toLowerCase().includes(lowerQ) || 
              c.description.toLowerCase().includes(lowerQ) ||
              c.tags.some(t => t.toLowerCase().includes(lowerQ))
          );
      }
      
      return data;
  }, [channels, searchQuery, mobileFeedTab, userProfile]);

  const handleRefreshFeed = () => {
      setChannels(prev => [...prev.sort(() => 0.5 - Math.random())]);
  };

  const handleUpgradeSuccess = async (newTier: SubscriptionTier) => {
      if (userProfile) {
          setUserProfile({ ...userProfile, subscriptionTier: newTier });
      }
      if (currentUser) {
        try {
            const fresh = await getUserProfile(currentUser.uid);
            if (fresh) setUserProfile(fresh);
        } catch(e) {}
      }
  };
  
  const safeUserProfile = useMemo(() => {
      if (userProfile) return userProfile;
      if (currentUser) {
          return {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName || 'User',
              photoURL: currentUser.photoURL,
              groups: []
          } as UserProfile;
      }
      return null;
  }, [userProfile, currentUser]);

  if (authLoading) {
      return (
          <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-indigo-400">
              <Loader2 size={48} className="animate-spin mb-4" />
              <p className="text-sm font-bold tracking-widest uppercase">Initializing AIVoiceCast...</p>
          </div>
      );
  }

  if (isPrivacyOpen) {
      return <PrivacyPolicy onBack={() => setIsPrivacyOpen(false)} />;
  }

  if (viewState === 'mission') {
      return <MissionManifesto onBack={() => handleSetViewState('directory')} />;
  }

  if (viewState === 'card_viewer') {
      return <CardWorkshop onBack={() => { handleSetViewState('directory'); setViewCardId(undefined); }} cardId={viewCardId} isViewer={true} />;
  }

  if (!currentUser) {
      return <LoginPage 
        onPrivacyClick={() => setIsPrivacyOpen(true)} 
        onMissionClick={() => handleSetViewState('mission')} 
      />;
  }

  const MobileBottomNav = () => {
    const quickAppId = userProfile?.preferredMobileQuickApp || 'code_studio';
    const quickApp = allApps.find(a => a.id === quickAppId) || allApps[1]; // Default to Code Studio
    
    return (
      <div className="md:hidden fixed bottom-0 left-0 w-full bg-slate-950/90 backdrop-blur-md border-t border-slate-800 z-50 px-6 py-2 flex justify-between items-center safe-area-bottom">
          <button 
              onClick={() => { handleSetViewState('directory'); setActiveTab('categories'); setIsAppsMenuOpen(false); setIsUserMenuOpen(false); }}
              className={`flex flex-col items-center gap-1 ${viewState === 'directory' && activeTab === 'categories' && !isAppsMenuOpen && !isUserMenuOpen ? 'text-white' : 'text-slate-500'}`}
          >
              <Home size={24} fill={viewState === 'directory' && activeTab === 'categories' && !isAppsMenuOpen && !isUserMenuOpen ? "currentColor" : "none"} />
              <span className="text-[10px]">Home</span>
          </button>
          
          <button 
              onClick={() => { quickApp.action(); setIsAppsMenuOpen(false); setIsUserMenuOpen(false); }}
              className={`flex flex-col items-center gap-1 ${viewState === quickAppId ? 'text-white' : 'text-slate-500'}`}
          >
              <quickApp.icon size={24} fill={viewState === quickAppId ? "currentColor" : "none"} />
              <span className="text-[10px]">{quickApp.label}</span>
          </button>

          <button 
              onClick={() => setIsVoiceCreateOpen(true)}
              className="flex flex-col items-center justify-center -mt-6"
          >
              <div className="bg-gradient-to-r from-blue-500 to-red-500 p-0.5 rounded-xl w-12 h-8 flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
                  <div className="bg-black w-full h-full rounded-lg flex items-center justify-center">
                      <Plus size={20} className="text-white"/>
                  </div>
              </div>
          </button>

          <button 
              onClick={() => { setIsAppsMenuOpen(true); setIsUserMenuOpen(false); }}
              className={`flex flex-col items-center gap-1 ${isAppsMenuOpen ? 'text-white' : 'text-slate-500'}`}
          >
              <LayoutGrid size={24} fill={isAppsMenuOpen ? "currentColor" : "none"} />
              <span className="text-[10px]">Apps</span>
          </button>

          <button 
              onClick={() => { setIsUserMenuOpen(true); setIsAppsMenuOpen(false); }}
              className={`flex-col items-center gap-1 ${isUserMenuOpen ? 'text-white' : 'text-slate-500'} flex`}
          >
              <User size={24} fill={isUserMenuOpen ? "currentColor" : "none"} />
              <span className="text-[10px]">Profile</span>
          </button>
      </div>
    );
  };

  const MobileTopNav = () => {
      if (viewState !== 'directory' || activeTab !== 'categories') return null;
      return (
          <div className="md:hidden fixed top-0 left-0 w-full z-40 bg-gradient-to-b from-black/80 to-transparent p-4 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-3 pointer-events-auto">
                  <button onClick={handleMobileQuickStart} className="text-white/80 hover:text-white" title="Quick Session">
                      <VideoIcon size={24} />
                  </button>
                  <button onClick={() => window.location.reload()} className="text-white/80 hover:text-white" title="Reload App">
                      <RefreshCw size={22} />
                  </button>
                  {audioIsPlaying && (
                    <button 
                        onClick={() => stopAllPlatformAudio("MobileGlobalStop")}
                        className="p-2 bg-red-600 rounded-full text-white shadow-lg animate-pulse"
                    >
                        <Square size={16} fill="white" />
                    </button>
                  )}
                  <button 
                      onClick={() => setLanguage(prev => prev === 'en' ? 'zh' : 'en')}
                      className="w-8 h-8 rounded-full bg-black/40 border border-white/20 flex items-center justify-center text-[10px] font-bold text-white transition-all active:scale-95"
                      title="Switch Language"
                  >
                      {language === 'en' ? '中' : 'EN'}
                  </button>
              </div>
              
              <div className="flex gap-4 font-bold text-base pointer-events-auto">
                  <button 
                      onClick={() => setMobileFeedTab('following')}
                      className={`${mobileFeedTab === 'following' ? 'text-white border-b-2 border-white pb-1' : 'text-white/60'}`}
                  >
                      Following
                  </button>
                  <span className="text-white/20">|</span>
                  <button 
                      onClick={() => setMobileFeedTab('foryou')}
                      className={`${mobileFeedTab === 'foryou' ? 'text-white border-b-2 border-white pb-1' : 'text-white/60'}`}
                  >
                      For You
                  </button>
              </div>

              <button onClick={() => setIsMobileSearchOpen(true)} className="pointer-events-auto text-white/80 hover:text-white">
                  <Search size={24} />
              </button>
          </div>
      );
  };

  const MobileSearchOverlay = () => {
      if (!isMobileSearchOpen) return null;
      
      const filteredChannels = channels.filter(c => 
          c.title.toLowerCase().includes(mobileSearchQuery.toLowerCase()) || 
          c.description.toLowerCase().includes(mobileSearchQuery.toLowerCase()) ||
          c.tags.some(t => t.toLowerCase().includes(mobileSearchQuery.toLowerCase()))
      );

      return (
          <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col animate-fade-in">
              <div className="flex items-center gap-4 p-4 border-b border-slate-800 bg-slate-900">
                  <button onClick={() => setIsMobileSearchOpen(false)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400">
                      <ArrowLeft size={24} />
                  </button>
                  <div className="flex-1 relative">
                      <input 
                          autoFocus
                          type="text" 
                          placeholder="Search podcasts..." 
                          value={mobileSearchQuery}
                          onChange={(e) => setMobileSearchQuery(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-full py-2 pl-4 pr-10 text-white focus:outline-none focus:border-indigo-500"
                      />
                      {mobileSearchQuery && (
                          <button onClick={() => setMobileSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                              <X size={16} />
                          </button>
                      )}
                  </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4">
                  {mobileSearchQuery ? (
                      <div className="space-y-4">
                          <p className="text-xs font-bold text-slate-500 uppercase">Results</p>
                          {filteredChannels.length === 0 ? (
                              <p className="text-center text-slate-500 py-8">No results found.</p>
                          ) : (
                              filteredChannels.map(channel => (
                                  <div 
                                      key={channel.id} 
                                      onClick={() => {
                                          setActiveChannelId(channel.id);
                                          handleSetViewState('podcast_detail');
                                          setIsMobileSearchOpen(false);
                                      }}
                                      className="flex items-center gap-4 p-3 bg-slate-900 border border-slate-800 rounded-xl animate-fade-in group active:scale-95 transition-transform"
                                  >
                                      <img src={channel.imageUrl} className="w-12 h-12 rounded-lg object-cover" alt="" />
                                      <div className="flex-1 min-w-0">
                                          <h4 className="font-bold text-white truncate">{channel.title}</h4>
                                          <p className="text-xs text-slate-400 truncate">{channel.author}</p>
                                      </div>
                                      <button className="p-2 bg-indigo-600 rounded-full text-white">
                                          <Play size={12} fill="currentColor"/>
                                      </button>
                                  </div>
                              ))
                          )}
                      </div>
                  ) : (
                      <div className="text-center text-slate-500 mt-20">
                          <Search size={48} className="mx-auto mb-4 opacity-20" />
                          <p>Type to search podcasts</p>
                      </div>
                  )}
              </div>
          </div>
      );
  };

  return (
    <div className="min-h-screen supports-[min-height:100dvh]:min-h-[100dvh] bg-slate-950 text-slate-100 font-sans overflow-hidden">
      
      {viewState !== 'live_session' && (
      <nav className="hidden md:block sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center cursor-pointer" onClick={() => { handleSetViewState('directory'); setActiveTab('categories'); }}>
              <div className="bg-gradient-to-tr from-indigo-600 to-purple-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
                <Podcast className="text-white w-6 h-6" />
              </div>
              <span className="ml-3 text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                {t.appTitle}
              </span>
            </div>
            
            <div className="flex flex-1 max-w-md mx-8 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-500" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-slate-700 rounded-full leading-5 bg-slate-800/50 text-slate-300 placeholder-slate-500 focus:outline-none bg-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm transition-all"
                placeholder={t.search}
                value={searchQuery}
                onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (e.target.value && viewState !== 'directory') handleSetViewState('directory');
                }}
              />
            </div>

            <div className="flex items-center space-x-2 sm:space-x-4">
              
              <div className="hidden lg:flex items-center space-x-2 mr-2">
                  <button 
                      onClick={() => window.location.reload()}
                      className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                      title="Reload Page"
                  >
                      <RefreshCw size={18} />
                  </button>
                  <button
                      onClick={() => setIsCreateModalOpen(true)}
                      className="flex items-center space-x-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                  >
                      <Plus size={14} />
                      <span>New Podcast</span>
                  </button>
                  <button
                      onClick={() => setIsVoiceCreateOpen(true)}
                      className="flex items-center space-x-2 px-3 py-1.5 bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                  >
                      <Sparkles size={14} />
                      <span>Magic Create</span>
                  </button>
              </div>

              <div className="relative">
                  <button 
                    onClick={() => setIsDesktopAppsOpen(!isDesktopAppsOpen)}
                    className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg transition-colors ${isDesktopAppsOpen ? 'bg-slate-800 text-white' : 'bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white'}`}
                  >
                    <LayoutGrid size={16}/><span>Apps</span>
                  </button>
                  
                  {isDesktopAppsOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsDesktopAppsOpen(false)}></div>
                        <div className="absolute top-full right-0 mt-2 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 grid grid-cols-3 gap-3 z-50 animate-fade-in-up origin-top-right">
                            {allApps.map(app => (
                                <button
                                    key={app.label}
                                    onClick={() => { app.action(); setIsDesktopAppsOpen(false); }}
                                    className="flex flex-col items-center justify-center gap-2 p-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-xl transition-all group"
                                >
                                    <div className={`p-2 bg-slate-800 rounded-lg group-hover:scale-110 transition-transform ${app.color}`}>
                                        <app.icon size={20} />
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-300 group-hover:text-white">{app.label}</span>
                                </button>
                            ))}
                        </div>
                      </>
                  )}
              </div>

              <button 
                onClick={() => setLanguage(prev => prev === 'en' ? 'zh' : 'en')}
                className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 hover:text-white hover:border-slate-500 transition-all"
                title="Switch Language"
              >
                {language === 'en' ? '中' : 'EN'}
              </button>

              {!isFirebaseConfigured && (
                  <button onClick={() => setIsFirebaseModalOpen(true)} className="p-2 text-amber-500 bg-amber-900/20 rounded-full hover:bg-amber-900/40 border border-amber-900/50 animate-pulse">
                      <AlertTriangle size={18} />
                  </button>
              )}

              {currentUser && (
                  <div className="hidden sm:block">
                      <Notifications />
                  </div>
              )}
              
              <UserAuth />
              
              <div className="relative">
                <button 
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <Menu size={24} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>
      )}

      <MobileTopNav />
      <MobileSearchOverlay />

      <div className="flex-1 overflow-hidden h-[calc(100vh-64px)] md:h-[calc(100vh-64px)] pb-16 md:pb-0">
        {/* viewState === 'mission' handled via early return above */}
        {viewState === 'user_guide' && <UserManual onBack={() => handleSetViewState('directory')} />}
        {viewState === 'notebook_viewer' && <NotebookViewer onBack={() => handleSetViewState('directory')} currentUser={currentUser} />}
        {viewState === 'card_workshop' && <CardWorkshop onBack={() => handleSetViewState('directory')} cardId={viewCardId} />}
        {viewState === 'card_explorer' && (
            <CardExplorer 
                onBack={() => handleSetViewState('directory')}
                onOpenCard={(id) => { setViewCardId(id); handleSetViewState('card_workshop'); }}
                onCreateNew={() => { setViewCardId(undefined); handleSetViewState('card_workshop'); }}
            />
        )}
        
        {viewState === 'code_studio' && (
            <CodeStudio 
                onBack={() => { handleSetViewState('directory'); }} 
                currentUser={currentUser} 
                userProfile={userProfile}
                sessionId={sharedSessionId}
                accessKey={accessKey}
                onSessionStart={handleSessionStart} 
                onSessionStop={handleSessionStop} 
                onStartLiveSession={(channel, context) => handleStartLiveSession(channel, context)} 
            />
        )}

        {viewState === 'icon_generator' && (
            <IconGenerator 
                onBack={() => { handleSetViewState('directory'); }}
                currentUser={currentUser}
            />
        )}
        
        {viewState === 'whiteboard' && (
            <Whiteboard 
                onBack={() => { handleSetViewState('directory'); }}
                sessionId={sharedSessionId}
                accessKey={accessKey}
                onSessionStart={handleSessionStart} 
            />
        )}
        
        {viewState === 'blog' && <BlogView onBack={() => handleSetViewState('directory')} currentUser={currentUser} />}
        {viewState === 'chat' && <WorkplaceChat onBack={() => handleSetViewState('directory')} currentUser={currentUser} initialChannelId={chatTargetId} />}
        {viewState === 'careers' && <CareerCenter onBack={() => handleSetViewState('directory')} currentUser={currentUser} />}

        {viewState === 'directory' && (
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-hidden relative">
               {activeTab === 'categories' && (
                   <PodcastFeed 
                       channels={feedChannels}
                       onChannelClick={(id) => { setActiveChannelId(id); handleSetViewState('podcast_detail'); }}
                       onStartLiveSession={(channel) => handleStartLiveSession(channel)}
                       userProfile={userProfile}
                       globalVoice={globalVoice}
                       onRefresh={handleRefreshFeed}
                       t={t}
                       currentUser={currentUser}
                       setChannelToEdit={setChannelToEdit}
                       setIsSettingsModalOpen={setIsSettingsModalOpen}
                       onCommentClick={handleCommentClick}
                       handleVote={handleVote}
                       onMessageCreator={handleMessageCreator}
                       filterMode={mobileFeedTab}
                       isFeedActive={viewState === 'directory'}
                   />
               )}

               {activeTab !== 'categories' && (
                   <div className="h-full overflow-y-auto p-4 md:p-8 animate-fade-in max-w-7xl mx-auto w-full pb-20">
                       {activeTab === 'calendar' && (
                          <CalendarView 
                             channels={channels}
                             handleChannelClick={(id) => { setActiveChannelId(id); handleSetViewState('podcast_detail'); }}
                             handleVote={handleVote}
                             currentUser={currentUser}
                             setChannelToEdit={setChannelToEdit}
                             setIsSettingsModalOpen={setIsSettingsModalOpen}
                             globalVoice={globalVoice}
                             t={t}
                             onCommentClick={handleCommentClick}
                             onStartLiveSession={handleStartLiveSession}
                             onCreateChannel={handleCreateChannel}
                             onSchedulePodcast={handleSchedulePodcast}
                          />
                       )}

                       {activeTab === 'mentorship' && (
                          <MentorBooking 
                             currentUser={currentUser} 
                             channels={channels}
                             onStartLiveSession={handleStartLiveSession}
                          />
                       )}

                       {activeTab === 'groups' && <GroupManager />}
                       {activeTab === 'recordings' && <RecordingList onStartLiveSession={handleStartLiveSession} />}
                       {activeTab === 'docs' && <DocumentList />}
                   </div>
               )}
            </div>
          </div>
        )}

        {viewState === 'podcast_detail' && activeChannel && (
          <PodcastDetail 
            channel={activeChannel} 
            onBack={() => handleSetViewState('directory')}
            onStartLiveSession={(context, lectureId, recordingEnabled, videoEnabled, activeSegment, cameraEnabled) => {
               setLiveConfig({
                   context,
                   bookingId: lectureId, 
                   recording: recordingEnabled,
                   video: videoEnabled,
                   camera: cameraEnabled,
                   segment: activeSegment
               });
               handleSetViewState('live_session');
            }}
            language={language}
            onEditChannel={() => {
                setChannelToEdit(activeChannel);
                setIsSettingsModalOpen(true);
            }}
            onViewComments={() => handleCommentClick(activeChannel)}
            currentUser={currentUser}
          />
        )}

        {viewState === 'live_session' && activeChannel && (
          <div className="fixed inset-0 z-[100] bg-slate-950">
             <LiveSession 
               channel={activeChannel}
               initialContext={liveConfig.context}
               lectureId={liveConfig.bookingId}
               recordingEnabled={liveConfig.recording}
               videoEnabled={liveConfig.video}
               cameraEnabled={liveConfig.camera}
               activeSegment={liveConfig.segment}
               initialTranscript={liveConfig.initialTranscript}
               onEndSession={() => {
                   if (tempChannel) {
                       setTempChannel(null);
                       setActiveChannelId(null);
                       handleSetViewState('directory');
                       setActiveTab('recordings');
                   } else {
                       handleSetViewState('podcast_detail');
                   }
               }}
               language={language}
             />
          </div>
        )}

        {viewState === 'debug' && <DebugView onBack={() => handleSetViewState('directory')} />}
        {viewState === 'cloud_debug' && <CloudDebugView onBack={() => handleSetViewState('directory')} />}
        {viewState === 'public_debug' && <PublicChannelInspector onBack={() => handleSetViewState('directory')} />}
        {viewState === 'my_channel_debug' && <MyChannelInspector onBack={() => handleSetViewState('directory')} />}
        {viewState === 'firestore_debug' && <FirestoreInspector onBack={() => handleSetViewState('directory')} />}
      </div>

      {isAppsMenuOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-950/95 backdrop-blur-md flex flex-col animate-fade-in md:hidden">
            <div className="p-4 flex justify-between items-center border-b border-slate-800 bg-slate-900/50">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <LayoutGrid size={20} className="text-indigo-400" />
                    All Apps
                </h2>
                <button onClick={() => setIsAppsMenuOpen(false)} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white">
                    <X size={20} />
                </button>
            </div>
            <div className="p-6 grid grid-cols-3 gap-4 overflow-y-auto pb-24">
                {allApps.map((app) => (
                    <button 
                        key={app.label}
                        onClick={() => {
                            app.action();
                            setIsAppsMenuOpen(false);
                        }}
                        className="flex flex-col items-center justify-center gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl hover:bg-slate-800 active:scale-95 transition-all aspect-square shadow-lg"
                    >
                        <div className={`p-3 bg-slate-800 rounded-xl ${app.color} shadow-inner`}>
                            <app.icon size={28} />
                        </div>
                        <span className="text-xs font-bold text-slate-300">{app.label}</span>
                    </button>
                ))}
            </div>
        </div>
      )}

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
           setIsSyncModalOpen={setIsSyncModalOpen}
           setIsSettingsModalOpen={setIsAccountSettingsOpen}
           onOpenUserGuide={() => handleSetViewState('user_guide')}
           onNavigate={(view: any) => handleSetViewState(view)}
           onOpenPrivacy={() => setIsPrivacyOpen(true)}
           t={t}
           className="fixed bottom-24 right-4 md:bottom-auto md:top-16 md:right-4 z-[100] shadow-2xl border-slate-700"
           channels={channels}
           language={language}
           setLanguage={setLanguage}
           allApps={allApps}
        />
      )}

      <MobileBottomNav />

      <CreateChannelModal isOpen={isCreateModalOpen} onClose={() => { setIsCreateModalOpen(false); setCreateModalDate(null); }} onCreate={handleCreateChannel} initialDate={createModalDate} />
      <VoiceCreateModal isOpen={isVoiceCreateOpen} onClose={() => setIsVoiceCreateOpen(false)} onCreate={handleCreateChannel} />
      <DataSyncModal isOpen={isSyncModalOpen} onClose={() => setIsSyncModalOpen(false)} />
      <FirebaseConfigModal isOpen={isFirebaseModalOpen} onClose={() => setIsFirebaseModalOpen(false)} onConfigUpdate={(valid) => { if(valid) window.location.reload(); }} />

      {isAccountSettingsOpen && safeUserProfile && (
          <SettingsModal 
             isOpen={true} 
             onClose={() => setIsAccountSettingsOpen(false)} 
             user={safeUserProfile} 
             onUpdateProfile={(updated) => setUserProfile(updated)}
             onUpgradeClick={() => setIsPricingOpen(true)}
          />
      )}

      {isPricingOpen && safeUserProfile && (
          <PricingModal 
             isOpen={true} 
             onClose={() => setIsPricingOpen(false)} 
             user={safeUserProfile} 
             onSuccess={handleUpgradeSuccess}
          />
      )}

      {channelToEdit && (
        <ChannelSettingsModal 
           isOpen={isSettingsModalOpen}
           onClose={() => { setIsSettingsModalOpen(false); setChannelToEdit(null); }}
           channel={channelToEdit}
           onUpdate={handleUpdateChannel}
           onDelete={handleDeleteChannel}
        />
      )}

      {commentsChannel && (
         <CommentsModal 
            isOpen={isCommentsModalOpen}
            onClose={() => { setIsCommentsModalOpen(false); setCommentsChannel(null); }}
            channel={commentsChannel}
            onAddComment={handleAddComment}
            currentUser={currentUser}
         />
      )}

    </div>
  );
};

export default App;
