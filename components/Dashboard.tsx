import React, { useMemo, useState, useEffect } from 'react';
import { 
  Terminal, Code, Video, LayoutGrid, FileText, Wallet, MessageSquare, 
  Briefcase, Truck, AppWindow, Book, PenTool, Rss, Gift, Rocket, BookOpen, 
  Activity, Scroll, GraduationCap, Cpu, Star, Coins, Zap, ShieldCheck,
  Globe, Users, Clock, Sparkles, ChevronRight, Crown, Lock, Radio,
  Disc, Calendar, History, FolderOpen, BookText, FileUp, FileSignature, IdCard, Info, TrendingUp, BarChart3, Binary, Github, Scale, Thermometer, Shield, Play, Layout, UserCircle, Target, Beaker, Database, Repeat, Ghost
} from 'lucide-react';
import { ViewID, UserProfile, PlatformMetrics } from '../types';
import { Visualizer } from './Visualizer';

interface DashboardProps {
  userProfile: UserProfile | null;
  isProMember: boolean;
  onNavigate: (view: ViewID, params?: Record<string, string>) => void;
  language: 'en' | 'zh';
  handleVote?: (id: string, type: 'like' | 'dislike', e: React.MouseEvent) => void;
  onOpenManual?: () => void;
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
    unlockCta: "Unlock Pro",
    pulseTitle: "Network Propagation",
    metricsTotal: "Global Refractions",
    metricsHumanoid: "VRAM Efficiency",
    metricsEfficiency: "Harmony Ratio (H)",
    thermoFloor: "Cost-to-Zero Floor",
    judgeHeroTitle: "🔭 Neural Lens: Verification Node",
    judgeHeroDesc: "Instrumentation for frontier reasoning and intelligence observability. Deploying the 1.0 Harmony Ratio.",
    judgeAction: "Run Audit",
    pitchAction: "Startup Pitch",
    judgePitchAction: "The Manifest",
    visionAction: "2036 Vision",
    techBookAction: "Tech Book",
    featuredTitle: "Featured Lab",
    featuredDesc: "Active Sector",
    reasoningAction: "Reasoning",
    verificationAction: "Verify",
    watchAction: "Watch Archive"
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
    unlockCta: "解锁专业版",
    pulseTitle: "网络传播",
    metricsTotal: "全球折射总数",
    metricsHumanoid: "VRAM 效率",
    metricsEfficiency: "和谐率 (H)",
    thermoFloor: "成本归零底线",
    judgeHeroTitle: "🔭 神经透镜：验证节点",
    judgeHeroDesc: "前沿推理与智能观测仪器。部署 1.0 和谐率。",
    judgeAction: "运行审计",
    pitchAction: "启动推介",
    judgePitchAction: "宣言",
    visionAction: "愿景",
    techBookAction: "技术书籍",
    featuredTitle: "精选实验室",
    featuredDesc: "活跃扇区",
    reasoningAction: "推理",
    verificationAction: "验证",
    watchAction: "查看存档"
  }
};

export const Dashboard: React.FC<DashboardProps> = ({ userProfile, isProMember, onNavigate, language, handleVote, onOpenManual }) => {
  const t = UI_TEXT[language];
  const [metrics, setMetrics] = useState<PlatformMetrics>({
      globalRefractions: 1284052,
      voiceCoinVelocity: 842.5,
      computeEfficiency: '18x',
      humanoidCapacity: 0.992, 
      distributedIndex: 1.12 // Target Harmony Ratio
  });

  const [thermoCost, setThermoCost] = useState(299.00);

  useEffect(() => {
    const interval = setInterval(() => {
        setMetrics(prev => {
            const jitter = (Math.random() - 0.5) * 0.01;
            return {
                ...prev,
                globalRefractions: prev.globalRefractions + Math.floor(Math.random() * 3),
                humanoidCapacity: Math.min(1.0, Math.max(0.98, prev.humanoidCapacity + jitter)),
                distributedIndex: 1.12 + (Math.random() * 0.05)
            };
        });
        setThermoCost(c => Math.max(0.01, c - 0.0001));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const appSectors = useMemo(() => [
    {
      title: t.discoverySector,
      apps: [
        { id: 'directory', label: 'Knowledge Hub', sub: 'Podcast Stream', description: 'Interactive AI-guided learning sessions with real-time Q&A.', icon: Radio, color: 'text-indigo-400', bg: 'bg-indigo-900/30', restricted: false },
        { id: 'bible_study', label: 'Scripture', sub: 'Ancient Text', description: 'Dual-language scripture study and cinematic visualizations.', icon: Scroll, color: 'text-amber-500', bg: 'bg-amber-950/40', restricted: false },
        { id: 'scripture_ingest', label: 'Scripture Ingest', sub: 'Data Refraction', description: 'Deep-hydration tool for synthesizing scripture into the ledger.', icon: FileUp, color: 'text-amber-400', bg: 'bg-amber-900/20', restricted: true },
        { id: 'book_studio', label: 'Author Studio', sub: 'Neural Books', description: 'Synthesize full-length technical books into high-fidelity PDFs.', icon: BookText, color: 'text-indigo-500', bg: 'bg-indigo-900/30', restricted: false }
      ]
    },
    {
      title: t.logicSector,
      apps: [
        { id: 'code_studio', label: 'Builder Studio', sub: 'Neural IDE', description: 'Advanced IDE with heuristic code simulation. Execute C++, Python.', icon: Terminal, color: 'text-indigo-400', bg: 'bg-indigo-900/30', restricted: true },
        { id: 'neural_lens', label: 'Neural Lens', sub: 'Observability', description: 'Dedicated instrumentation for AI reasoning and logic drift audit.', icon: ShieldCheck, color: 'text-indigo-400', bg: 'bg-indigo-900/30', restricted: false },
        { id: 'notebook_viewer', label: 'Research Lab', sub: 'Interactive Docs', description: 'Experiment with complex prompts in a specialized AI scratchpad.', icon: Book, color: 'text-orange-400', bg: 'bg-orange-900/30', restricted: true },
        { id: 'target_studio', label: 'Logic Visualizer', sub: 'Math Rendering', description: 'Convert complex math into hardware-accelerated 3D visualizations.', icon: Activity, color: 'text-emerald-400', bg: 'bg-emerald-900/30', restricted: true }
      ]
    },
    {
      title: t.financeSector,
      apps: [
        { id: 'pdf_signer', label: 'Sovereign Signer', sub: 'PDF Authority', description: 'Sign any PDF from Google Drive with neural validation.', icon: FileSignature, color: 'text-indigo-400', bg: 'bg-indigo-900/30', restricted: true },
        { id: 'check_designer', label: 'Finance Lab', sub: 'Asset Refraction', description: 'Design banking documents with secure neural signatures.', icon: Wallet, color: 'text-amber-400', bg: 'bg-amber-950/40', restricted: true },
        { id: 'shipping_labels', label: 'Logistics Lab', sub: 'Postal Protocol', description: 'Neural address parsing and professional label generation.', icon: Truck, color: 'text-emerald-400', bg: 'bg-indigo-900/30', restricted: true },
        { id: 'coin_wallet', label: 'Wallet', sub: 'Neural Ledger', description: 'Manage VoiceCoin assets and signed peer-to-peer transfers.', icon: Coins, color: 'text-amber-500', bg: 'bg-amber-950/40', restricted: true }
      ]
    },
    {
      title: t.creativeSector,
      apps: [
        { id: 'card_workshop', label: 'Gift Workshop', sub: 'Holiday Synthesis', description: 'Generative studio for custom cards and AI-composed music.', icon: Gift, color: 'text-red-400', bg: 'bg-red-900/30', restricted: true },
        { id: 'icon_generator', label: 'Brand Lab', sub: 'Visual Identity', description: 'Transform concepts into high-resolution app icons.', icon: AppWindow, color: 'text-cyan-400', bg: 'bg-cyan-900/30', restricted: true },
        { id: 'whiteboard', label: 'Visual Canvas', sub: 'Freeform Flow', description: 'Limitless whiteboard for architectural mapping.', icon: PenTool, color: 'text-pink-400', bg: 'bg-pink-900/30', restricted: true },
        { id: 'badge_studio', label: 'Badge Studio', sub: 'Digital ID', description: 'Digital ID with biometric capture and neural watermarking.', icon: IdCard, color: 'text-indigo-400', bg: 'bg-indigo-900/30', restricted: true }
      ]
    },
    {
      title: t.careerSector,
      apps: [
        { id: 'mock_interview', label: 'DyadAI Hub', sub: 'Staff Eval', description: 'Staff-level technical evaluation using the Shadow-Critic Dyad pattern.', icon: Video, color: 'text-red-500', bg: 'bg-red-900/30', restricted: true },
        { id: 'mentorship', label: 'Expert Hub', sub: 'Knowledge Match', description: 'Book 1-on-1 sessions with human domain experts.', icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-900/30', restricted: true },
        { id: 'careers', label: 'Talent Hub', sub: 'Hiring Registry', description: 'Showcase your portfolio and browse roles in the community.', icon: Briefcase, color: 'text-yellow-400', bg: 'bg-yellow-900/30', restricted: true }
      ]
    },
    {
      title: t.archiveSector,
      apps: [
        { id: 'recordings', label: 'Refraction Archive', sub: 'Verified Video', description: 'Sovereign vault for verifiable video logs and neural artifacts.', icon: Video, color: 'text-red-400', bg: 'bg-red-900/30', restricted: false },
        { id: 'scribe_studio', label: 'Neural Scribe', sub: 'Audio to MD', description: 'Minimalist real-time audio-to-markdown transcription.', icon: Disc, color: 'text-red-500', bg: 'bg-red-900/30', restricted: true },
        { id: 'chat', label: 'Team Space', sub: 'Neural Messaging', description: 'Secure real-time workspace messaging and code sharing.', icon: MessageSquare, color: 'text-blue-400', bg: 'bg-blue-900/30', restricted: true },
        { id: 'blog', label: 'Voice Feed', sub: 'Community Blog', description: 'Publish technical insights to the community stream.', icon: Rss, color: 'text-orange-400', bg: 'bg-blue-900/30', restricted: true },
        { id: 'docs', label: 'Paperwork', sub: 'Docs', description: 'Professional specification registry for managing design docs.', icon: FileText, color: 'text-emerald-400', bg: 'bg-emerald-900/30', restricted: true },
        { id: 'calendar', label: 'Schedule', sub: 'Activity', description: 'Scheduler for bookings and platform activities.', icon: Calendar, color: 'text-cyan-400', bg: 'bg-cyan-900/30', restricted: true },
        { id: 'groups', label: 'Communities', sub: 'Member Hub', description: 'Collaborative groups for focused research.', icon: Users, color: 'text-purple-400', bg: 'bg-purple-900/30', restricted: true }
      ]
    }
  ], [t]);

  return (
    <div className="h-full overflow-y-auto bg-slate-950 scrollbar-hide">
      <div className="max-w-7xl mx-auto p-6 md:p-12 space-y-8 pb-32">
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <section className="lg:col-span-2 bg-gradient-to-br from-indigo-900/60 to-slate-900 border border-slate-800 rounded-[3rem] p-8 md:p-12 shadow-2xl relative overflow-hidden group flex flex-col justify-center border-indigo-500/20">
                <div className="absolute top-0 right-0 p-32 bg-indigo-500/20 blur-[100px] rounded-full group-hover:scale-110 transition-transform duration-1000"></div>
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="flex items-center gap-6">
                        <div className="relative">
                            {userProfile?.photoURL ? (
                                <img src={userProfile.photoURL} className="w-20 h-20 rounded-3xl border-4 border-slate-800 shadow-2xl object-cover" alt="Profile" />
                            ) : (
                                <div className="w-20 h-20 rounded-3xl bg-slate-800 border-4 border-slate-800 flex items-center justify-center text-3xl font-black text-indigo-400 shadow-2xl uppercase">
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
                                    <Activity size={12} className="text-emerald-500" /> {t.status}
                                </span>
                                <div className="h-3 w-px bg-slate-800"></div>
                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${isProMember ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                                    {isProMember ? t.proBadge : t.freeBadge}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 bg-slate-950/50 p-6 rounded-[2.5rem] border border-slate-800 shadow-inner">
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

            <section className="bg-slate-900 border border-slate-800 rounded-[3rem] p-8 shadow-xl relative overflow-hidden flex flex-col justify-between group/pulse">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        <Globe size={14}/> {t.pulseTitle}
                    </h3>
                    <div className="flex items-center gap-2">
                        <Thermometer size={12} className="text-orange-500 animate-pulse"/>
                        <span className="text-[10px] font-bold text-orange-400 uppercase tracking-tighter tabular-nums">${thermoCost.toFixed(2)}/yr</span>
                    </div>
                </div>
                
                <div className="flex-1 min-h-[80px]">
                    <Visualizer volume={metrics.distributedIndex - 1.0} isActive={true} color="#6366f1" />
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6">
                    <div className="space-y-1">
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{t.metricsHumanoid}</p>
                        <p className="text-lg font-black text-white font-mono">{metrics.computeEfficiency}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{t.metricsEfficiency}</p>
                        <p className="text-lg font-black text-emerald-400 font-mono">{metrics.distributedIndex.toFixed(3)}</p>
                    </div>
                </div>
                <div className="mt-2 text-center border-t border-slate-800 pt-3 opacity-0 group-hover/pulse:opacity-100 transition-opacity">
                    <p className="text-[7px] font-black text-slate-600 uppercase tracking-[0.3em]">{t.thermoFloor} Target: $0.00</p>
                </div>
            </section>
        </div>

        <div className="flex items-center gap-4 py-3 bg-slate-900/40 border border-white/5 rounded-3xl px-8 shadow-inner animate-fade-in">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 shrink-0">
                <Zap size={14} className="text-amber-500" /> Quick Access:
            </span>
            <div className="flex flex-wrap gap-3 overflow-hidden">
                <button onClick={() => onNavigate('neural_lens')} className="flex items-center gap-2 px-4 py-1.5 bg-indigo-900/30 border border-indigo-500/20 text-indigo-400 hover:text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all hover:bg-indigo-600 shadow-lg active:scale-95">
                    <ShieldCheck size={14}/> Neural Lens
                </button>
                <button onClick={() => onNavigate('recordings')} className="flex items-center gap-2 px-4 py-1.5 bg-indigo-900/30 border border-indigo-500/20 text-indigo-400 hover:text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all hover:bg-indigo-600 shadow-lg active:scale-95">
                    <Video size={14}/> Watch Archive
                </button>
                <button onClick={() => onNavigate('code_studio')} className="flex items-center gap-2 px-4 py-1.5 bg-indigo-900/30 border border-indigo-500/20 text-indigo-400 hover:text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all hover:bg-indigo-600 shadow-lg active:scale-95">
                    <Terminal size={14}/> Builder Studio
                </button>
                <button onClick={() => onNavigate('book_studio')} className="flex items-center gap-2 px-4 py-1.5 bg-indigo-900/30 border border-indigo-500/20 text-indigo-400 hover:text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all hover:bg-indigo-600 shadow-lg active:scale-95">
                    <BookText size={14}/> Author Studio
                </button>
            </div>
        </div>

        <section className="bg-gradient-to-r from-emerald-900/40 via-indigo-900/40 to-slate-900 border border-emerald-500/30 rounded-[3.5rem] p-10 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-32 bg-emerald-500/10 blur-[100px] rounded-full group-hover:scale-110 transition-transform duration-1000"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
                <div className="space-y-4 text-center md:text-left flex-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-emerald-400 text-[9px] font-black uppercase tracking-widest">
                        <Shield size={10} fill="currentColor"/> v12.1.0-INTEGRITY
                    </div>
                    <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">{t.judgeHeroTitle}</h2>
                    <p className="text-slate-400 text-lg leading-relaxed font-medium">{t.judgeHeroDesc}</p>
                </div>
                <div className="flex flex-wrap gap-4 shrink-0 justify-center">
                    <button onClick={() => onNavigate('recordings')} className="px-8 py-5 bg-red-600 text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl transition-all hover:bg-red-500 active:scale-95 flex items-center justify-center gap-3">
                        <Video size={20} fill="currentColor"/> {t.watchAction}
                    </button>
                    <button onClick={() => onNavigate('story', { section: 'reasoning' })} className="px-8 py-5 bg-cyan-600 text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl transition-all hover:bg-cyan-500 active:scale-95 flex items-center justify-center gap-3">
                        <Beaker size={20} fill="currentColor"/> {t.reasoningAction}
                    </button>
                    <button onClick={() => onNavigate('neural_lens')} className="px-8 py-5 bg-indigo-600 text-white font-black uppercase tracking-[0.2em] rounded-2xl border border-white/10 shadow-xl transition-all hover:bg-indigo-50 active:scale-95 flex items-center justify-center gap-3">
                        <Activity size={20} /> {t.judgeAction}
                    </button>
                </div>
            </div>
        </section>

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
                            className="flex flex-col items-center p-6 bg-slate-900 border border-slate-800 rounded-[2.5rem] hover:border-indigo-500/50 hover:bg-indigo-900/10 transition-all text-center group shadow-xl relative overflow-hidden h-full"
                        >
                            {!isProMember && app.restricted && (
                                <div className="absolute top-4 right-4 z-20 pointer-events-none">
                                    <div className="p-1.5 bg-slate-900/90 border border-amber-500/50 rounded-lg shadow-2xl backdrop-blur-md">
                                        <Lock size={12} className="text-amber-500" />
                                    </div>
                                </div>
                            )}

                            <div className="absolute inset-0 bg-indigo-900/95 backdrop-blur-md flex flex-col items-center justify-center p-6 z-30 transition-all duration-300 opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0">
                                <p className="text-[10px] font-bold text-white leading-relaxed mb-4">{app.description}</p>
                                <div className="flex items-center gap-1 text-[8px] font-black uppercase tracking-[0.2em] text-white bg-indigo-600 px-4 py-2 rounded-xl shadow-lg">
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

        <footer className="pt-20 flex flex-col items-center gap-8 border-t border-slate-800/50">
            <div className="flex flex-wrap justify-center items-center gap-12 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                <button onClick={() => onNavigate('mission')} className="flex items-center gap-2 hover:text-indigo-400 transition-colors"><Rocket size={16}/> Vision</button>
                <button onClick={() => onNavigate('story')} className="flex items-center gap-2 hover:text-indigo-400 transition-colors"><BookOpen size={16}/> Story</button>
                <button onClick={() => onNavigate('resume')} className="flex items-center gap-2 hover:text-indigo-400 transition-colors"><UserCircle size={16}/> Architect</button>
                <a href="https://github.com/aivoicecast/AIVoiceCast" target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-indigo-400 transition-colors"><Github size={16}/> Source</a>
                <button onClick={() => onNavigate('privacy')} className="flex items-center gap-2 hover:text-indigo-400 transition-colors"><Shield size={16}/> Privacy</button>
            </div>
            <div className="text-center space-y-2">
                <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.5em]">Sovereign 2036 Hub • 10:1 Resident/Hub Ratio Enabled</p>
                <p className="text-[8px] text-slate-800 uppercase font-bold tracking-widest">Designed for Humanity. Balanced for Thermodynamics.</p>
            </div>
        </footer>
      </div>
    </div>
  );
};

export default Dashboard;