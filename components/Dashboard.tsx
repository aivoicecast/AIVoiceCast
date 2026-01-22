
import React, { useMemo } from 'react';
import { 
  Terminal, Code, Video, LayoutGrid, FileText, Wallet, MessageSquare, 
  Briefcase, Truck, AppWindow, Book, PenTool, Rss, Gift, Rocket, BookOpen, 
  Activity, Scroll, GraduationCap, Cpu, Star, Coins, Zap, ShieldCheck,
  Globe, Users, Clock, Sparkles, ChevronRight, Crown, Lock, Radio,
  Disc, Calendar, History, FolderOpen
} from 'lucide-react';
import { ViewID, UserProfile } from '../types';

interface DashboardProps {
  userProfile: UserProfile | null;
  isProMember: boolean;
  onNavigate: (view: ViewID, params?: Record<string, string>) => void;
  language: 'en' | 'zh';
}

const UI_TEXT = {
  en: {
    greeting: "Welcome to the Hub,",
    status: "Neural Link Status: Active",
    balance: "Assets",
    discoverySector: "Discovery & Knowledge",
    logicSector: "Logic & Development",
    financeSector: "Finance & Logistics",
    creativeSector: "Creative Studio",
    careerSector: "Career & Growth",
    archiveSector: "Archives & Community",
    proBadge: "Elite Access",
    freeBadge: "Standard",
    launch: "Launch",
    unlockCta: "Unlock Pro"
  },
  zh: {
    greeting: "欢迎回来，",
    status: "神经连接状态：活跃",
    balance: "资产",
    discoverySector: "发现与知识",
    logicSector: "逻辑与开发",
    financeSector: "财务与物流",
    creativeSector: "创意工作室",
    careerSector: "职业与成长",
    archiveSector: "存档与社区",
    proBadge: "精英权限",
    freeBadge: "标准",
    launch: "启动",
    unlockCta: "解锁专业版"
  }
};

export const Dashboard: React.FC<DashboardProps> = ({ userProfile, isProMember, onNavigate, language }) => {
  const t = UI_TEXT[language];

  const appSectors = useMemo(() => [
    {
      title: t.discoverySector,
      apps: [
        { id: 'directory', label: 'Knowledge Hub', sub: 'Podcast Stream', description: 'Interactive AI-guided learning sessions with real-time Q&A and screen-sharing support.', icon: Radio, color: 'text-indigo-400', bg: 'bg-indigo-900/30', restricted: false },
        { id: 'bible_study', label: 'Scripture', sub: 'Ancient Text', description: 'A sacred digital space for dual-language scripture study and cinematic AI visualizations.', icon: Scroll, color: 'text-amber-500', bg: 'bg-amber-950/40', restricted: false }
      ]
    },
    {
      title: t.logicSector,
      apps: [
        { id: 'code_studio', label: 'Builder Studio', sub: 'Neural IDE', description: 'Advanced IDE with heuristic code simulation. Execute C++, Python, and more without a server.', icon: Terminal, color: 'text-indigo-400', bg: 'bg-indigo-900/30', restricted: true },
        { id: 'notebook_viewer', label: 'Research Lab', sub: 'Interactive Docs', description: 'Experiment with complex prompts and multi-step reasoning in a specialized AI scratchpad.', icon: Book, color: 'text-orange-400', bg: 'bg-orange-900/30', restricted: true },
        { id: 'graph_studio', label: 'Logic Visualizer', sub: 'Math Rendering', description: 'Convert complex mathematical expressions into hardware-accelerated 3D neural visualizations.', icon: Activity, color: 'text-emerald-400', bg: 'bg-emerald-900/30', restricted: true }
      ]
    },
    {
      title: t.financeSector,
      apps: [
        { id: 'check_designer', label: 'Finance Lab', sub: 'Asset Refraction', description: 'Design high-fidelity banking documents with secure neural signatures and printable PDF output.', icon: Wallet, color: 'text-amber-400', bg: 'bg-amber-900/30', restricted: true },
        { id: 'shipping_labels', label: 'Logistics Lab', sub: 'Postal Protocol', description: 'Neural address parsing and professional thermal label generation for streamlined global shipping.', icon: Truck, color: 'text-emerald-400', bg: 'bg-emerald-900/30', restricted: true },
        { id: 'coin_wallet', label: 'Wallet', sub: 'Neural Ledger', description: 'Manage your VoiceCoin assets and participate in cryptographically signed peer-to-peer transfers.', icon: Coins, color: 'text-amber-500', bg: 'bg-amber-950/40', restricted: true }
      ]
    },
    {
      title: t.creativeSector,
      apps: [
        { id: 'card_workshop', label: 'Gift Workshop', sub: 'Holiday Synthesis', description: 'Generative studio for custom holiday cards, AI-composed music, and personalized voice greetings.', icon: Gift, color: 'text-red-400', bg: 'bg-red-900/30', restricted: true },
        { id: 'icon_generator', label: 'Brand Lab', sub: 'Visual Identity', description: 'Transform concepts into professional high-resolution app icons using advanced neural art models.', icon: AppWindow, color: 'text-cyan-400', bg: 'bg-cyan-900/30', restricted: true },
        { id: 'whiteboard', label: 'Visual Canvas', sub: 'Freeform Flow', description: 'A limitless collaborative whiteboard for architectural mapping and group neural brainstorming.', icon: PenTool, color: 'text-pink-400', bg: 'bg-pink-900/30', restricted: true }
      ]
    },
    {
      title: t.careerSector,
      apps: [
        { id: 'mock_interview', label: 'Career Eval', sub: 'Simulation Lab', description: 'Practice with rigorous AI interviewer personas. Receive deep technical feedback and scoring.', icon: Video, color: 'text-red-500', bg: 'bg-red-950/40', restricted: true },
        { id: 'mentorship', label: 'Expert Hub', sub: 'Knowledge Match', description: 'Book 1-on-1 sessions with human domain experts or specialized AI technical mentors.', icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-900/30', restricted: true },
        { id: 'careers', label: 'Talent Pool', sub: 'Hiring Registry', description: 'Showcase your AI-augmented portfolio and browse high-level roles in the Prism community.', icon: Briefcase, color: 'text-yellow-400', bg: 'bg-yellow-900/30', restricted: true }
      ]
    },
    {
      title: t.archiveSector,
      apps: [
        { id: 'chat', label: 'Team Space', sub: 'Neural Messaging', description: 'Secure real-time workspace messaging with deep integration for code sharing and attachments.', icon: MessageSquare, color: 'text-blue-400', bg: 'bg-blue-900/30', restricted: true },
        { id: 'blog', label: 'Voice Feed', sub: 'Community Blog', description: 'Publish technical insights and platform updates to the community thought stream.', icon: Rss, color: 'text-orange-400', bg: 'bg-orange-900/30', restricted: true },
        { id: 'recordings', label: 'Recordings', sub: 'Session Archive', description: 'A sovereign vault for all your live session video logs, transcripts, and neural artifacts.', icon: Disc, color: 'text-red-400', bg: 'bg-red-900/30', restricted: true },
        { id: 'docs', label: 'Paperwork', sub: 'Managed Docs', description: 'Professional specification registry for managing technical design documents and specifications.', icon: FileText, color: 'text-emerald-400', bg: 'bg-emerald-900/30', restricted: true },
        { id: 'calendar', label: 'Schedule', sub: 'Activity Flow', description: 'AI-integrated scheduler for managing mentorship bookings and platform-wide activities.', icon: Calendar, color: 'text-cyan-400', bg: 'bg-cyan-900/30', restricted: true },
        { id: 'groups', label: 'Communities', sub: 'Member Hub', description: 'Join or create collaborative groups for focused research and project development.', icon: Users, color: 'text-purple-400', bg: 'bg-purple-900/30', restricted: true }
      ]
    }
  ], [t]);

  return (
    <div className="h-full overflow-y-auto bg-slate-950 scrollbar-hide">
      <div className="max-w-7xl mx-auto p-6 md:p-12 space-y-12 pb-32">
        
        {/* User Hero Section */}
        <section className="bg-gradient-to-br from-indigo-900/40 to-slate-900 border border-slate-800 rounded-[3rem] p-8 md:p-12 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-32 bg-indigo-500/10 blur-[100px] rounded-full group-hover:scale-110 transition-transform duration-1000"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex items-center gap-6">
                    <div className="relative">
                        {userProfile?.photoURL ? (
                            <img src={userProfile.photoURL} className="w-20 h-20 rounded-3xl border-4 border-slate-800 shadow-2xl object-cover" />
                        ) : (
                            <div className="w-20 h-20 rounded-3xl bg-slate-800 border-4 border-slate-800 flex items-center justify-center text-3xl font-black text-indigo-400 shadow-2xl">
                                {userProfile?.displayName?.[0] || 'U'}
                            </div>
                        )}
                        <div className="absolute -bottom-2 -right-2 bg-emerald-500 p-1.5 rounded-xl border-4 border-slate-900 shadow-lg">
                            <ShieldCheck size={16} className="text-white" />
                        </div>
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">
                            {t.greeting} <span className="text-indigo-400">{userProfile?.displayName?.split(' ')[0]}</span>
                        </h2>
                        <div className="flex items-center gap-3 mt-2">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                <Activity size={12} className="text-emerald-500 animate-pulse" /> {t.status}
                            </span>
                            <div className="h-3 w-px bg-slate-800"></div>
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${isProMember ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                                {isProMember ? t.proBadge : t.freeBadge}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-4 bg-slate-950/50 p-6 rounded-[2rem] border border-slate-800 shadow-inner">
                    <div className="text-right">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{t.balance}</p>
                        <p className="text-3xl font-black text-white tracking-tighter tabular-nums">{userProfile?.coinBalance?.toLocaleString() || 0}</p>
                    </div>
                    <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-xl shadow-amber-900/20">
                        <Coins size={24} fill="currentColor" />
                    </div>
                </div>
            </div>
        </section>

        {/* Dashboard Grids */}
        {appSectors.map((sector, sIdx) => (
            <section key={sIdx} className="space-y-6 animate-fade-in-up" style={{ animationDelay: `${sIdx * 100}ms` }}>
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
                        <Zap size={14} className="text-indigo-500" />
                        {sector.title}
                    </h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                    {sector.apps.map(app => (
                        <button 
                            key={app.id} 
                            onClick={() => onNavigate(app.id as ViewID)} 
                            className="flex flex-col items-center p-6 bg-slate-900 border border-slate-800 rounded-[2.5rem] hover:border-indigo-500/50 hover:bg-indigo-900/10 transition-all text-center group shadow-xl relative overflow-hidden"
                        >
                            {/* Pro-only Badge - Corner Positioned, Non-intrusive */}
                            {!isProMember && app.restricted && (
                                <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-1 pointer-events-none">
                                    <div className="p-1.5 bg-slate-900/90 border border-amber-500/50 rounded-lg shadow-2xl backdrop-blur-md">
                                        <Lock size={12} className="text-amber-500" />
                                    </div>
                                </div>
                            )}

                            {/* Hover Description Overlay */}
                            <div className="absolute inset-0 bg-indigo-900/90 backdrop-blur-md flex flex-col items-center justify-center p-4 z-30 transition-all duration-300 opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0">
                                <p className="text-[10px] font-bold text-white leading-relaxed mb-3">{app.description}</p>
                                <div className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-indigo-200">
                                    {!isProMember && app.restricted ? t.unlockCta : t.launch} <ChevronRight size={10}/>
                                </div>
                            </div>

                            <div className={`mb-4 p-5 ${app.bg} rounded-[1.5rem] border border-white/5 ${app.color} group-hover:scale-90 transition-transform duration-500 shadow-lg`}>
                                <app.icon size={32}/>
                            </div>
                            <div className="min-w-0 transition-opacity group-hover:opacity-0">
                                <h4 className="font-black text-white uppercase tracking-tight text-[11px] leading-tight mb-1">{app.label}</h4>
                                <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest opacity-60">{app.sub}</p>
                            </div>
                        </button>
                    ))}
                </div>
            </section>
        ))}

        <footer className="pt-12 text-center">
            <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.4em]">Neural Prism v5.6.0-SYN • Sovereign Activity Hub</p>
        </footer>
      </div>
    </div>
  );
};
