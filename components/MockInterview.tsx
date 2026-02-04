import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MockInterviewRecording, TranscriptItem, CodeFile, UserProfile, Channel, RecordingSession } from '../types';
import { auth, db } from '../services/firebaseConfig';
import { 
  saveInterviewRecording, 
  deleteInterview, 
  getUserInterviews, 
  deductCoins, 
  AI_COSTS,
  uploadFileToStorage,
  saveRecordingReference
} from '../services/firestoreService';
import { doc, updateDoc } from '@firebase/firestore';
import { GeminiLiveService } from '../services/geminiLive';
import { GoogleGenAI, Type } from "@google/genai";
import { generateSecureId, safeJsonStringify } from '../utils/idUtils';
import { CodeStudio } from './CodeStudio';
import { MarkdownView } from './MarkdownView';
import { Visualizer } from './Visualizer';
import { 
  ArrowLeft, Video, Loader2, Search, Trash2, X, 
  ChevronRight, Zap, Code, MessageSquare, MessageCircle, Sparkles, 
  Clock, Bot, Trophy, Star, History, Terminal, 
  Quote, CheckCircle2, AlertCircle, Presentation, 
  Cpu, HeartHandshake, ChevronDown, Check, Scissors,
  FileCode, ExternalLink as ExternalLinkIcon, CodeSquare as CodeIcon,
  ShieldCheck, Target, Award as AwardIcon,
  Lock, Activity, Layers, RefreshCw, Monitor, Camera, Youtube, HardDrive,
  UserCheck, Shield, GraduationCap, PlayCircle, ExternalLink, Copy, Share2, SearchX,
  Play, Link, CloudUpload, HardDriveDownload, List, Table as TableIcon, FileVideo, Calendar, Download, Maximize2, Maximize
} from 'lucide-react';
import { getGlobalAudioContext, warmUpAudioContext, registerAudioOwner, connectOutput, getGlobalMediaStreamDest } from '../utils/audioUtils';
import { getDriveToken, signInWithGoogle, connectGoogleDrive } from '../services/authService';
import { ensureCodeStudioFolder, uploadToDrive, ensureFolder, downloadDriveFileAsBlob, getDriveFileStreamUrl } from '../services/googleDriveService';
import { uploadToYouTube, getYouTubeVideoUrl, getYouTubeEmbedUrl } from '../services/youtubeService';
import { saveLocalRecording, getLocalRecordings } from '../utils/db';

interface MockInterviewReport {
  id: string;
  score: number;
  technicalSkills: string;
  communication: string;
  collaboration: string;
  strengths: string[];
  areasForImprovement: string[];
  verdict: string;
  summary: string;
  learningMaterial: string; 
  sourceCode?: CodeFile[];
  transcript?: TranscriptItem[];
  videoUrl?: string; 
  videoBlob?: Blob;
  videoSize?: number; 
}

interface ApiLog {
    time: string;
    msg: string;
    /**
     * Fix: Added 'info' to the type union to allow it as a valid log level for UI tracking
     */
    type: 'input' | 'output' | 'error' | 'success' | 'warn' | 'info';
    code?: string;
}

interface MockInterviewProps {
  onBack: () => void;
  userProfile: UserProfile | null;
  onStartLiveSession: (channel: Channel, context?: string, recordingEnabled?: boolean, bookingId?: string, videoEnabled?: boolean, cameraEnabled?: boolean, activeSegment?: { index: number, lectureId: string }) => void;
  isProMember?: boolean;
}

const PERSONAS = [
    { 
        id: 'software-interview', 
        name: 'Software Interview Expert', 
        modelId: 'gen-lang-client-0648937375', 
        icon: GraduationCap, 
        desc: 'Rigorous algorithmic & system design specialist.',
        instruction: 'You are a Senior Staff Engineer at Google. You are conducting a hard technical interview. Your tone is professional and slightly intimidating. You demand complexity analysis (Big-O) for every suggestion. If you receive a [RECONNECTION_PROTOCOL_ACTIVE] block, immediately acknowledge the link recovery, summarize your current understanding of the problem and progress, and ask the user to confirm if anything was missed before proceeding.'
    },
    { 
        id: 'linux-kernel', 
        name: 'Linux Kernel Architect', 
        modelId: 'gen-lang-client-0375218270', 
        icon: Cpu, 
        desc: 'Memory safety, drivers, and scheduler audit.',
        instruction: 'You are a Linux Kernel Maintainer. You evaluate C code for race conditions, memory leaks, and architectural elegance. You have zero tolerance for sloppy abstractions. If you receive a [RECONNECTION_PROTOCOL_ACTIVE] block, immediately acknowledge the link recovery, summarize your current understanding of the problem and progress, and ask the user to confirm if anything was missed before proceeding.'
    },
    { 
        id: 'default-gem', 
        name: 'Neural Prism Designer', 
        modelId: 'Default Gem', 
        icon: Zap, 
        desc: 'General technical evaluation and coaching.',
        instruction: 'You are the project lead of Neural Prism. You are evaluating a contributor. You focus on clean code, documentation, and feature parity. If you receive a [RECONNECTION_PROTOCOL_ACTIVE] block, immediately acknowledge the link recovery, summarize your current understanding of the problem and progress, and ask the candidate to confirm if your understanding is correct. Then proceed with the interview.'
    }
];

const formatMass = (bytes?: number) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

function getLanguageFromExt(filename: string): CodeFile['language'] {
    if (!filename) return 'c++';
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'js') return 'javascript';
    if (ext === 'py') return 'python';
    if (['cpp', 'hpp', 'cc', 'cxx'].includes(ext || '')) return 'c++';
    if (ext === 'java') return 'java';
    if (ext === 'rs') return 'rs';
    if (ext === 'go') return 'go';
    if (ext === 'cs') return 'c#';
    if (ext === 'json') return 'json';
    if (ext === 'md') return 'markdown';
    return 'c++';
}

const getCodeTool: any = {
  name: "get_current_code",
  description: "Read the current state of the workspace. ALWAYS use this before judging code or providing specific line-by-line feedback.",
  parameters: { 
    type: Type.OBJECT, 
    properties: {
      filename: { type: Type.STRING, description: "Optional: The specific file to read." }
    }
  }
};

const updateActiveFileTool: any = {
  name: "update_active_file",
  description: "Modify the active code file. Use this ONLY for adding TODO comments, function stubs, or high-level boilerplate. NEVER use this to provide a full working solution or implement the candidate's idea for them. If the candidate describes a plan, your job is to CRITIQUE it, not implement it.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      content: { type: Type.STRING, description: "Full new content for the file." }
    },
    required: ["content"]
  }
};

const createInterviewFileTool: any = {
  name: "create_interview_file",
  description: "Generate a new problem file in the workspace containing ONLY the problem description and basic setup. DO NOT include the solution.",
  parameters: {
    type: Type.OBJECT, 
    properties: {
      filename: { type: Type.STRING, description: "Descriptive name (e.g. 'binary_tree_sum.cpp')." },
      content: { type: Type.STRING, description: "Problem description and boilerplate code." }
    },
    required: ["filename", "content"]
  }
};

const EvaluationReportDisplay = ({ 
    report, 
    onSyncYouTube, 
    onSyncDrive, 
    isSyncing 
}: { 
    report: MockInterviewReport, 
    onSyncYouTube: () => void, 
    onSyncDrive: () => void, 
    isSyncing: boolean 
}) => {
    if (!report) return null;

    const [expandedFileIndex, setExpandedFileIndex] = useState<number | null>(null);
    const [showPlayer, setShowPlayer] = useState(false);

    const stableVideoUrl = useMemo(() => {
        if (report.videoBlob && report.videoBlob.size > 0) {
            return URL.createObjectURL(report.videoBlob);
        }
        return report.videoUrl || '';
    }, [report.videoBlob, report.videoUrl]);

    useEffect(() => {
        return () => {
            if (stableVideoUrl.startsWith('blob:')) {
                URL.revokeObjectURL(stableVideoUrl);
            }
        };
    }, [stableVideoUrl]);

    const verdictColor = useMemo(() => {
        const v = String(report?.verdict || '').toLowerCase();
        if (v.includes('strong hire')) return 'bg-emerald-500 text-white shadow-emerald-500/20';
        if (v.includes('hire')) return 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30';
        if (v.includes('move forward')) return 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30';
        if (v.includes('reject') || v.includes('no hire')) return 'bg-red-900/20 text-red-400 border-red-500/30';
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }, [report?.verdict]);

    const handleDownload = () => {
        if (!stableVideoUrl) return;
        if (report.videoBlob && report.videoBlob.size === 0) {
            alert("Local artifact has zero size. Playback unavailable.");
            return;
        }
        const a = document.createElement('a');
        a.href = stableVideoUrl;
        a.download = `Mock_Interview_Archive_${report.id.substring(0,8)}.webm`;
        a.click();
    };

    return (
        <div className="w-full space-y-12 animate-fade-in-up pb-32">
            <div className="flex flex-col md:flex-row items-center justify-center gap-8">
                <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                    <div className="relative px-12 py-10 bg-slate-900 rounded-[3rem] border border-indigo-500/30 shadow-2xl flex flex-col items-center min-w-[220px]">
                        <p className="text-[10px] text-indigo-400 uppercase font-black tracking-[0.3em] mb-2">Neural Index</p>
                        <p className="text-7xl font-black text-white italic tracking-tighter">{report.score || 0}<span className="text-xl text-slate-600">/100</span></p>
                    </div>
                </div>
                <div className="flex flex-col items-center md:items-start gap-4">
                    <div className={`px-8 py-3 rounded-2xl border text-2xl font-black uppercase tracking-tighter shadow-xl ${verdictColor}`}>
                        {report.verdict || 'UNAVAILABLE'}
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">
                        <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-emerald-400"/> Verified Result</span>
                        <div className="w-1 h-1 rounded-full bg-slate-800"></div>
                        <span className="flex items-center gap-1.5"><Bot size={14} className="text-indigo-400"/> Refracted by Gemini 3 Pro</span>
                    </div>
                </div>
            </div>

            {stableVideoUrl || report.videoSize === 0 ? (
                <div className="space-y-4">
                    <div className="bg-slate-900 border border-indigo-500/30 p-8 rounded-[3rem] shadow-xl flex flex-col lg:flex-row items-center justify-between gap-6 animate-fade-in">
                        <div className="flex items-center gap-6">
                            <div className="p-4 bg-red-600 rounded-3xl shadow-lg shadow-red-900/20">
                                <Video size={32} className="text-white" />
                            </div>
                            <div>
                                <h4 className="text-white font-black uppercase tracking-tighter italic text-xl">Session Artifact</h4>
                                <div className="flex items-center gap-3 mt-1">
                                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">1080p Neural Archive Secured</p>
                                    <div className="w-1 h-1 rounded-full bg-slate-800"></div>
                                    <p className={`text-xs font-black font-mono ${report.videoSize === 0 ? 'text-red-500' : 'text-indigo-400'}`}>
                                        MASS: {formatMass(report.videoSize)}
                                        {report.videoSize === 0 && ' (EMPTY)'}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-3 justify-center">
                            <button 
                                onClick={() => {
                                    if (report.videoSize === 0) {
                                        alert("Neural artifact is empty (0 bytes). Check microphone/screen permissions.");
                                        return;
                                    }
                                    setShowPlayer(!showPlayer);
                                }}
                                className="px-6 py-3 bg-white text-slate-950 rounded-xl font-black uppercase tracking-widest shadow-lg hover:bg-indigo-50 transition-all flex items-center gap-2 active:scale-95 whitespace-nowrap text-[10px]"
                            >
                                {showPlayer ? <X size={16}/> : <PlayCircle size={16}/>}
                                {showPlayer ? 'Close Player' : 'Watch Local'}
                            </button>

                            <button 
                                onClick={onSyncYouTube}
                                disabled={isSyncing || report.videoUrl?.includes('youtube') || report.videoSize === 0}
                                className={`px-6 py-3 rounded-xl font-black uppercase tracking-widest shadow-lg transition-all flex items-center gap-2 active:scale-95 whitespace-nowrap text-[10px] ${report.videoUrl?.includes('youtube') ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/20' : 'bg-red-600 text-white hover:bg-red-500'} ${report.videoSize === 0 ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                            >
                                {isSyncing ? <Loader2 size={16} className="animate-spin"/> : <Youtube size={16}/>}
                                {report.videoUrl?.includes('youtube') ? 'Synced to YT' : 'Sync to YouTube'}
                            </button>

                            <button 
                                onClick={onSyncDrive}
                                disabled={isSyncing || report.videoUrl?.includes('drive') || report.videoSize === 0}
                                className={`px-6 py-3 rounded-xl font-black uppercase tracking-widest shadow-lg transition-all flex items-center gap-2 active:scale-95 whitespace-nowrap text-[10px] ${report.videoUrl?.includes('drive') ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/20' : 'bg-indigo-600 text-white hover:bg-indigo-500'} ${report.videoSize === 0 ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                            >
                                {isSyncing ? <Loader2 size={16} className="animate-spin"/> : <HardDrive size={16}/>}
                                {report.videoUrl?.includes('drive') ? 'Synced to Drive' : 'Sync to Drive'}
                            </button>

                            <button 
                                onClick={handleDownload}
                                disabled={report.videoSize === 0}
                                className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-all active:scale-95 disabled:opacity-50"
                                title="Download Local Artifact"
                            >
                                <Download size={16}/>
                            </button>
                        </div>
                    </div>
                    
                    {showPlayer && report.videoSize && report.videoSize > 0 && (
                        <div className="bg-black border border-slate-800 rounded-[2.5rem] overflow-hidden aspect-video shadow-2xl animate-fade-in relative group/player">
                            <video 
                                src={stableVideoUrl} 
                                controls 
                                autoPlay 
                                playsInline
                                className="w-full h-full object-contain"
                            />
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-slate-900/50 border border-indigo-500/30 p-8 rounded-[3rem] flex items-center justify-center gap-4 text-slate-600 animate-pulse">
                    <Loader2 size={20} className="animate-spin" />
                    <span className="text-xs font-black uppercase tracking-widest">Neural Artifact Syncing...</span>
                </div>
            )}

            <div className="bg-slate-900/50 border border-slate-800 p-10 rounded-[3rem] shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-24 bg-indigo-500/5 blur-[100px] rounded-full group-hover:bg-indigo-500/10 transition-colors"></div>
                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-6 flex items-center gap-2">
                    <Quote size={16} fill="currentColor"/> Executive Assessment
                </h4>
                <p className="text-xl font-medium leading-relaxed text-slate-200 italic border-l-4 border-indigo-500/30 pl-8 relative z-10">
                    "{report.summary || 'Analytical synthesis in progress...'}"
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-xl hover:border-indigo-500/30 transition-all group">
                    <div className="w-10 h-10 rounded-xl bg-indigo-900/30 text-indigo-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                        <Cpu size={20}/>
                    </div>
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Technical Proficiency</h4>
                    <p className="text-sm text-slate-300 leading-relaxed font-medium">{report.technicalSkills || 'Evaluating...'}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-xl hover:border-pink-500/30 transition-all group">
                    <div className="w-10 h-10 rounded-xl bg-pink-900/30 text-pink-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                        <Presentation size={20}/>
                    </div>
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Communication Flow</h4>
                    <p className="text-sm text-slate-300 leading-relaxed font-medium">{report.communication || 'Evaluating...'}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-xl hover:border-emerald-500/30 transition-all group">
                    <div className="w-10 h-10 rounded-xl bg-emerald-900/30 text-emerald-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                        <HeartHandshake size={20}/>
                    </div>
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Collaboration / Signal</h4>
                    <p className="text-sm text-slate-300 leading-relaxed font-medium">{report.collaboration || 'Evaluating...'}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-emerald-950/10 border border-emerald-500/20 p-10 rounded-[3rem] shadow-xl space-y-6">
                    <h4 className="text-xs font-black text-emerald-400 uppercase tracking-[0.3em] flex items-center gap-3">
                        <AwardIcon size={18} /> Core Strengths
                    </h4>
                    <div className="space-y-3">
                        {report.strengths?.map((s, i) => (
                            <div key={i} className="flex items-start gap-4 p-4 bg-slate-900/50 rounded-2xl border border-emerald-500/10 group">
                                <div className="p-1 bg-emerald-500 rounded text-black mt-0.5 group-hover:scale-110 transition-transform"><Check size={12} strokeWidth={4}/></div>
                                <span className="text-sm font-bold text-slate-200">{s}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-red-950/10 border border-red-500/20 p-10 rounded-[3rem] shadow-xl space-y-6">
                    <h4 className="text-xs font-black text-red-400 uppercase tracking-[0.3em] flex items-center gap-3">
                        <Target size={18}/> Expansion Areas
                    </h4>
                    <div className="space-y-3">
                        {report.areasForImprovement?.map((a, i) => (
                            <div key={i} className="flex items-start gap-4 p-4 bg-slate-900/50 rounded-2xl border border-red-500/10 group">
                                <div className="p-1 bg-red-500 rounded text-white mt-0.5 group-hover:rotate-12 transition-transform"><Scissors size={12} strokeWidth={3}/></div>
                                <span className="text-sm font-bold text-slate-200">{a}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-10 rounded-[3rem] shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-32 bg-indigo-500/10 blur-[120px] rounded-full"></div>
                <h4 className="text-xs font-black text-indigo-400 uppercase tracking-[0.4em] mb-8 flex items-center gap-3">
                    <Zap size={18} fill="currentColor"/> 10-Week Master-Level Refraction Plan
                </h4>
                <div className="prose prose-invert prose-sm max-w-none relative z-10 bg-black/30 p-8 rounded-[2rem] border border-white/5">
                    <MarkdownView content={report.learningMaterial || ''} />
                </div>
            </div>

            {report.sourceCode && report.sourceCode.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 p-10 rounded-[3rem] shadow-xl">
                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-[0.4em] mb-8 flex items-center gap-3">
                        <Terminal size={18} /> Logic Artifact Ledger
                    </h4>
                    <div className="space-y-4">
                        {report.sourceCode.map((file, idx) => {
                            const isExpanded = expandedFileIndex === idx;
                            return (
                                <div key={idx} className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/50 hover:border-indigo-500/30 transition-all">
                                    <div 
                                        className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-800/50 transition-colors"
                                        onClick={() => setExpandedFileIndex(isExpanded ? null : idx)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2.5 rounded-xl transition-colors ${isExpanded ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800 text-slate-50'}`}>
                                                <CodeIcon size={16} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-black text-white uppercase tracking-tight">{file.name}</p>
                                                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{file.language}</p>
                                            </div>
                                        </div>
                                        <ChevronDown size={20} className={`text-slate-600 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-indigo-400' : ''}`} />
                                    </div>
                                    {isExpanded && (
                                        <div className="p-6 border-t border-slate-800 animate-fade-in-up bg-black/40">
                                            <pre className="p-6 bg-black/40 rounded-2xl text-[12px] font-mono text-indigo-100 overflow-x-auto leading-relaxed max-h-[500px] shadow-inner border border-white/5">
                                                <code>{file.content}</code>
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export const MockInterview: React.FC<MockInterviewProps> = ({ onBack, userProfile, onStartLiveSession, isProMember }) => {
  const [view, setView] = useState<'selection' | 'setup' | 'active' | 'feedback' | 'archive'>('selection');
  const [interviewMode, setInterviewMode] = useState<'coding' | 'system_design' | 'behavioral' | 'quick_screen' | 'assessment_30' | 'assessment_60'>('coding');
  const [interviewLanguage, setInterviewLanguage] = useState<'c++' | 'python' | 'javascript' | 'java'>('c++');
  const [jobDescription, setJobDescription] = useState('');
  const [selectedPersona, setSelectedPersona] = useState(PERSONAS[0]);
  const [sessionUuid, setSessionUuid] = useState('');
  const [archiveSearch, setArchiveSearch] = useState('');
  const [pipSize, setPipSize] = useState<'normal' | 'compact'>('normal');

  const [isLive, setIsLive] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const transcriptRef = useRef<TranscriptItem[]>([]);
  const [files, setFiles] = useState<CodeFile[]>([]);
  const filesRef = useRef<CodeFile[]>([]); 
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const activeFileIndexRef = useRef(0);
  const [volume, setVolume] = useState(0);

  const [apiLogs, setApiLogs] = useState<ApiLog[]>([]);

  const [interviewDuration, setInterviewDuration] = useState(15); 
  const [timeLeft, setTimeLeft] = useState(15 * 60); 
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rotationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const renderIntervalRef = useRef<any>(null);
  const autoReconnectAttempts = useRef(0);
  const maxAutoRetries = 20; 
  const isEndingRef = useRef(false);

  // Recording State
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [isRecordingActive, setIsRecordingActive] = useState(false);
  const [isUploadingRecording, setIsUploadingRecording] = useState(false);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);
  const [resolvedMediaUrl, setResolvedMediaUrl] = useState<string | null>(null);
  const [activeRecording, setActiveRecording] = useState<MockInterviewRecording | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<MockInterviewReport | null>(null);
  const [pastInterviews, setPastInterviews] = useState<MockInterviewRecording[]>([]);

  const localSessionVideoUrlRef = useRef<string>('');
  const localSessionBlobRef = useRef<Blob | null>(null);
  const localSessionVideoSizeRef = useRef<number>(0);

  const serviceRef = useRef<GeminiLiveService | null>(null);
  const currentUser = auth?.currentUser;

  /**
   * Fix: Updated type to allow 'info' log level and added comment
   */
  const addApiLog = useCallback((msg: string, type: ApiLog['type'] = 'info', code?: string) => {
      const time = new Date().toLocaleTimeString();
      setApiLogs(prev => [{ time, msg, type, code }, ...prev].slice(0, 100));
      window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: `[Interrogation] ${msg}`, type } }));
  }, []);

  const loadData = useCallback(async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
        const data = await getUserInterviews(currentUser.uid);
        setPastInterviews(data.sort((a, b) => b.timestamp - a.timestamp));
    } catch (e) {
        console.error("Archive load failed", e);
    } finally {
        setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    activeFileIndexRef.current = activeFileIndex;
  }, [activeFileIndex]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    if (view === 'archive' && currentUser) {
        loadData();
    }
  }, [view, currentUser, loadData]);

  const isYouTubeUrl = (url?: string) => !!url && (url.includes('youtube.com') || url.includes('youtu.be'));
  const isDriveUrl = (url?: string) => !!url && (url.startsWith('drive://') || url.includes('drive.google.com'));

  const extractYouTubeId = (url: string): string | null => {
      try {
          const urlObj = new URL(url);
          if (urlObj.hostname.includes('youtube.com')) return urlObj.searchParams.get('v');
          else if (urlObj.hostname.includes('youtu.be')) return urlObj.pathname.slice(1);
      } catch (e: any) {
          const match = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
          return match ? match[1] : null;
      }
      return null;
  };

  const handlePlayback = async (rec: MockInterviewRecording) => {
      if (resolvedMediaUrl?.startsWith('blob:')) { URL.revokeObjectURL(resolvedMediaUrl); }
      if (isYouTubeUrl(rec.videoUrl)) {
          setResolvedMediaUrl(rec.videoUrl); setActiveMediaId(rec.id); setActiveRecording(rec);
          return;
      }
      if (isDriveUrl(rec.videoUrl)) {
          setResolvingId(rec.id);
          try {
              const token = getDriveToken() || await connectGoogleDrive();
              const driveUri = rec.videoUrl!;
              const fileId = driveUri.replace('drive://', '').split('&')[0];
              const streamUrl = getDriveFileStreamUrl(token, fileId);
              setResolvedMediaUrl(streamUrl); setActiveMediaId(rec.id); setActiveRecording(rec);
          } catch (e: any) {
              window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: "Drive Access Denied: " + e.message, type: 'error' } }));
          } finally {
              setResolvingId(null);
          }
      } else {
          if ((rec as any).blob instanceof Blob) {
              const freshUrl = URL.createObjectURL((rec as any).blob);
              setResolvedMediaUrl(freshUrl); setActiveMediaId(rec.id); setActiveRecording(rec);
          } else {
              setResolvedMediaUrl(rec.videoUrl); setActiveMediaId(rec.id); setActiveRecording(rec);
          }
      }
  };

  const closePlayer = () => {
    if (resolvedMediaUrl?.startsWith('blob:')) URL.revokeObjectURL(resolvedMediaUrl);
    setActiveMediaId(null); setResolvedMediaUrl(null); setActiveRecording(null);
  };

  const performSyncToYouTube = async (id: string, blob: Blob, meta: { mode: string, language: string }) => {
    if (!currentUser) return;
    if (!blob || blob.size === 0) {
        addApiLog("YouTube Sync aborted: Local artifact is empty.", "warn");
        return;
    }
    
    setIsUploadingRecording(true);
    setRecordingId(id);
    addApiLog(`Syncing session ${id.substring(0,8)} to YouTube Registry...`, 'info');
    
    let token = getDriveToken() || await signInWithGoogle().then(() => getDriveToken());
    if (!token) { setIsUploadingRecording(false); return; }

    try {
        const ytId = await uploadToYouTube(token!, blob, {
            title: `Mock Interview: ${meta.mode.toUpperCase()} (${id.substring(0,8)})`,
            description: `Neural evaluation artifact. Candidate: @${currentUser.displayName}. Language: ${meta.language}.`,
            privacyStatus: 'unlisted'
        });
        const videoUrl = getYouTubeVideoUrl(ytId);
        
        const recRef = doc(db, 'mock_interviews', id);
        await updateDoc(recRef, { videoUrl, visibility: 'private' });
        
        if (report && report.id === id) {
            setReport({ ...report, videoUrl });
        }
        setPastInterviews(prev => prev.map(p => p.id === id ? { ...p, videoUrl, visibility: 'private' } : p));
        addApiLog("YouTube Sync finalized. Archive unlisted and secure.", "success");
    } catch(e: any) {
        addApiLog("YouTube sync interrupted: " + e.message, "error");
    } finally {
        setIsUploadingRecording(false);
        setRecordingId(null);
    }
  };

  const performSyncToDrive = async (id: string, blob: Blob, meta: { mode: string }) => {
      if (!currentUser) return;
      if (!blob || blob.size === 0) {
          addApiLog("Drive Sync aborted: Local artifact is empty.", "warn");
          return;
      }
      
      setIsUploadingRecording(true);
      setRecordingId(id);
      addApiLog(`Backing up session ${id.substring(0,8)} to Google Drive...`, 'info');
      
      let token = getDriveToken() || await signInWithGoogle().then(() => getDriveToken());
      if (!token) { setIsUploadingRecording(false); return; }

      try {
          const root = await ensureCodeStudioFolder(token);
          const folder = await ensureFolder(token, 'Interviews', root);
          const driveId = await uploadToDrive(token, folder, `Interview_${id}.webm`, blob);
          const videoUrl = `drive://${driveId}`;

          const recRef = doc(db, 'mock_interviews', id);
          await updateDoc(recRef, { videoUrl });
          
          if (report && report.id === id) {
              setReport({ ...report, videoUrl });
          }
          setPastInterviews(prev => prev.map(p => p.id === id ? { ...p, videoUrl } : p));
          addApiLog("Drive backup successful.", 'success');
      } catch(e: any) {
          addApiLog("Vault sync failed: " + e.message, 'error');
      } finally {
          setIsUploadingRecording(false);
          setRecordingId(null);
      }
  };

  const handleEndInterview = useCallback(async () => {
      if (isEndingRef.current) return;
      isEndingRef.current = true;
      
      setIsLoading(true);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (rotationTimerRef.current) clearInterval(rotationTimerRef.current);
      if (renderIntervalRef.current) clearInterval(renderIntervalRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      autoReconnectAttempts.current = maxAutoRetries;

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          addApiLog("Closing Scribe Protocol and finalizing stream...", "info");
          const stopPromise = new Promise(resolve => {
              mediaRecorderRef.current!.addEventListener('stop', () => {
                  let attempts = 0;
                  const check = () => {
                      if (localSessionBlobRef.current || attempts > 10) resolve(true);
                      else { attempts++; setTimeout(check, 200); }
                  };
                  check();
              }, { once: true });
              mediaRecorderRef.current!.stop();
          });
          await stopPromise;
      }

      if (serviceRef.current) {
          try { await serviceRef.current.disconnect(); } catch(e) {}
      }
      setIsLive(false);

      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const currentTranscript = transcriptRef.current;
          const currentFiles = filesRef.current;
          const fullTranscript = currentTranscript.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n\n');
          const finalCodeStr = currentFiles.map(f => `FILE: ${f.name}\nCONTENT:\n${f.content}`).join('\n\n---\n\n');
          
          const prompt = `Perform a MASTER-LEVEL technical evaluation of this mock interview. 
          Language: ${interviewLanguage.toUpperCase()}. 
          Mode: ${interviewMode.toUpperCase()}.
          Persona: ${selectedPersona.name}`;

          const response = await ai.models.generateContent({ 
            model: 'gemini-3-pro-preview', 
            contents: prompt + `\n\nTRANSCRIPT:\n${fullTranscript}\n\nFINAL CODE:\n${finalCodeStr}`, 
            config: { 
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        score: { type: Type.INTEGER },
                        technicalSkills: { type: Type.STRING },
                        communication: { type: Type.STRING },
                        collaboration: { type: Type.STRING },
                        strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                        areasForImprovement: { type: Type.ARRAY, items: { type: Type.STRING } },
                        verdict: { type: Type.STRING },
                        summary: { type: Type.STRING },
                        learningMaterial: { type: Type.STRING }
                    },
                    required: ["score", "technicalSkills", "communication", "collaboration", "strengths", "areasForImprovement", "verdict", "summary", "learningMaterial"]
                }
            } 
          });

          if (!response.text) throw new Error("Empty response from evaluation engine.");
          const reportData: MockInterviewReport = JSON.parse(response.text);
          const currentId = sessionUuid || generateSecureId();
          
          reportData.id = currentId;
          reportData.sourceCode = [...currentFiles];
          reportData.transcript = [...currentTranscript];
          reportData.videoUrl = localSessionVideoUrlRef.current || '';
          reportData.videoBlob = localSessionBlobRef.current || undefined;
          reportData.videoSize = localSessionVideoSizeRef.current || 0;
          
          setReport(reportData);

          if (auth.currentUser) {
              await saveInterviewRecording({ 
                id: currentId, userId: auth.currentUser.uid, 
                userName: auth.currentUser.displayName || 'Candidate', 
                mode: interviewMode, jobDescription, timestamp: Date.now(), 
                videoUrl: reportData.videoUrl, feedback: safeJsonStringify(reportData), 
                transcript: currentTranscript, visibility: 'private', language: interviewLanguage,
                blob: reportData.videoBlob
              });
              await deductCoins(auth.currentUser.uid, AI_COSTS.TECHNICAL_EVALUATION);
          }
          setView('feedback');
      } catch (e: any) { 
          addApiLog("Evaluation synthesis fault: " + e.message, "error");
          alert("Neural Evaluation failed to synthesize.");
          setView('selection');
      } finally { 
          setIsLoading(false); 
          isEndingRef.current = false;
      }
  }, [interviewLanguage, interviewMode, jobDescription, sessionUuid, addApiLog, selectedPersona.name]);

  useEffect(() => {
    if (isLive && view === 'active' && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) { 
              clearInterval(timerRef.current!); 
              handleEndInterview(); 
              return 0; 
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isLive, view, handleEndInterview]);

  const handleFileChange = (updated: CodeFile) => {
      setFiles(prev => {
          const next = prev.map(f => f.path === updated.path ? updated : f);
          filesRef.current = next;
          return next;
      });
  };

  const handleSyncCodeWithAi = useCallback((file: CodeFile) => {
    if (serviceRef.current) {
        const syncMessage = `NEURAL_SYNC_UPDATE: The candidate has manually updated "${file.name}". Current logic:\n\n\`\`\`${file.language}\n${file.content}\n\`\`\``;
        serviceRef.current.sendText(syncMessage);
        addApiLog("Manually pushed code delta to AI", "info");
    }
  }, [addApiLog]);

  const initializeRecordingProtocol = useCallback(async (sid: string) => {
    if (!currentUser) return;
    try {
        addApiLog("Requesting screen capture permissions for Scribe Protocol...", "info");
        screenStreamRef.current = await navigator.mediaDevices.getDisplayMedia({ 
            video: { width: { ideal: 1920 }, height: { ideal: 1080 } }, 
            audio: true 
        } as any);

        addApiLog("Requesting camera access...", "info");
        cameraStreamRef.current = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 1280, height: 720 }, 
            audio: false 
        });

        const ctx = getGlobalAudioContext();
        const recordingDest = getGlobalMediaStreamDest();
        if (ctx.state !== 'running') await ctx.resume();

        const userStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const userSource = ctx.createMediaStreamSource(userStream); 
        userSource.connect(recordingDest);

        if (screenStreamRef.current && screenStreamRef.current.getAudioTracks().length > 0) {
            const screenAudioSource = ctx.createMediaStreamSource(screenStreamRef.current);
            screenAudioSource.connect(recordingDest);
        }

        const canvas = document.createElement('canvas');
        canvas.width = 1920; canvas.height = 1080;
        const drawCtx = canvas.getContext('2d', { alpha: false })!;
        
        const createCaptureVideo = (stream: MediaStream | null) => {
            const v = document.createElement('video');
            v.muted = true; v.playsInline = true; v.autoplay = true;
            if (stream) { v.srcObject = stream; v.play().catch(console.warn); }
            return v;
        };

        const screenVideo = createCaptureVideo(screenStreamRef.current);
        const cameraVideo = createCaptureVideo(cameraStreamRef.current);

        let ready = false;
        const checkFlow = () => {
            const screenOk = !screenStreamRef.current || (screenVideo.readyState >= 2 && screenVideo.currentTime > 0);
            const cameraOk = !cameraStreamRef.current || (cameraVideo.readyState >= 2 && cameraVideo.currentTime > 0);
            if (screenOk && cameraOk) {
                ready = true;
                addApiLog("Scribe frame-flow verified.", "success");
            } else {
                if (screenVideo.paused) screenVideo.play().catch(() => {});
                if (cameraVideo.paused) cameraVideo.play().catch(() => {});
                setTimeout(checkFlow, 100);
            }
        };
        checkFlow();

        while (!ready) { 
            await new Promise(r => setTimeout(r, 100)); 
        }

        renderIntervalRef.current = setInterval(() => {
            if (!isRecordingActive && !isUploadingRecording) return;
            drawCtx.fillStyle = '#020617';
            drawCtx.fillRect(0, 0, canvas.width, canvas.height);
            
            if (screenVideo.readyState >= 2) {
                drawCtx.save();
                drawCtx.filter = 'blur(40px) brightness(0.3)';
                drawCtx.drawImage(screenVideo, -100, -100, canvas.width + 200, canvas.height + 200);
                drawCtx.restore();
                
                const scale = Math.min(canvas.width / screenVideo.videoWidth, canvas.height / screenVideo.videoHeight);
                const w = screenVideo.videoWidth * scale; const h = screenVideo.videoHeight * scale;
                drawCtx.save(); drawCtx.shadowColor = 'rgba(0,0,0,0.8)'; drawCtx.shadowBlur = 40;
                drawCtx.drawImage(screenVideo, (canvas.width - w)/2, (canvas.height - h)/2, w, h); drawCtx.restore();
            }
            
            if (cameraVideo.readyState >= 2) {
                // DYNAMIC PIP SIZE
                const size = pipSize === 'compact' ? 190 : 380; 
                const margin = pipSize === 'compact' ? 30 : 40; 
                const px = canvas.width - size - margin; const py = canvas.height - size - margin;
                const radius = size / 2;
                drawCtx.save(); drawCtx.beginPath(); drawCtx.arc(px + radius, py + radius, radius, 0, Math.PI * 2); drawCtx.clip();
                const camScale = Math.max(size / cameraVideo.videoWidth, size / cameraVideo.videoHeight);
                const cw = cameraVideo.videoWidth * camScale; const ch = cameraVideo.videoHeight * camScale;
                drawCtx.drawImage(cameraVideo, px + radius - cw/2, py + radius - ch/2, cw, ch); drawCtx.restore();
                drawCtx.save(); drawCtx.beginPath(); drawCtx.arc(px + radius, py + radius, radius, 0, Math.PI * 2);
                drawCtx.strokeStyle = '#ef4444'; drawCtx.lineWidth = pipSize === 'compact' ? 4 : 8; drawCtx.stroke(); drawCtx.restore();
            }
        }, 1000 / 30);

        const captureStream = canvas.captureStream(30);
        recordingDest.stream.getAudioTracks().forEach(t => captureStream.addTrack(t));
        
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') 
            ? 'video/webm;codecs=vp9,opus' 
            : MediaRecorder.isTypeSupported('video/webm') 
                ? 'video/webm' 
                : 'video/mp4';

        const recorder = new MediaRecorder(captureStream, { mimeType, videoBitsPerSecond: 8000000 });
        
        audioChunksRef.current = []; 
        recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
        recorder.onstop = async () => {
            setIsRecordingActive(false);
            if (renderIntervalRef.current) clearInterval(renderIntervalRef.current);
            
            const videoBlob = new Blob(audioChunksRef.current, { type: mimeType });
            const mediaUrl = URL.createObjectURL(videoBlob);
            localSessionVideoUrlRef.current = mediaUrl;
            localSessionBlobRef.current = videoBlob;
            localSessionVideoSizeRef.current = videoBlob.size;

            try {
                await saveLocalRecording({
                    id: sid, userId: currentUser.uid, channelId: 'mock-interview',
                    channelTitle: `Mock Interview: ${interviewMode.toUpperCase()}`,
                    channelImage: selectedPersona.id === 'software-interview' ? 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3' : 'https://images.unsplash.com/photo-1518770660439-4636190af475',
                    timestamp: Date.now(), mediaUrl, mediaType: 'video/webm', transcriptUrl: '',
                    blob: videoBlob, size: videoBlob.size
                });
            } catch(e: any) {}
            
            userStream.getTracks().forEach(t => t.stop());
            if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach(t => t.stop());
            if (cameraStreamRef.current) cameraStreamRef.current.getTracks().forEach(t => t.stop());
            screenVideo.remove(); cameraVideo.remove();
        };
        mediaRecorderRef.current = recorder;
        recorder.start(1000);
        setIsRecordingActive(true);
    } catch(e: any) { addApiLog("Recording initialization failed: " + e.message, "error"); }
  }, [currentUser, interviewMode, addApiLog, selectedPersona, isRecordingActive, isUploadingRecording, pipSize]);

  const connectToAI = useCallback(async (isAutoRetry = false) => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    if (isAutoRetry) {
        setIsRecovering(true);
        if (serviceRef.current) await serviceRef.current.disconnect();
    } else {
        setIsLive(false); setIsRecovering(false); autoReconnectAttempts.current = 0;
        addApiLog(`Handshaking with interrogator: ${selectedPersona.name}...`, "info");
    }
    const service = new GeminiLiveService();
    serviceRef.current = service;
    try {
        await service.initializeAudio();
        await service.connect(selectedPersona.modelId, `${selectedPersona.instruction}\nUUID: ${sessionUuid}`, {
            onOpen: () => {
                setIsLive(true); setIsRecovering(false);
                const allFilesText = filesRef.current.map(f => `FILE: ${f.name}\nCONTENT:\n${f.content}`).join('\n\n---\n\n');
                const recentTranscript = transcriptRef.current.slice(-5).map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n');
                
                const contextMessage = `[RECONNECTION_PROTOCOL_ACTIVE]
                SYSTEM_STATUS: Re-established.
                INTERVIEW_CONTEXT:
                - Mode: ${interviewMode.toUpperCase()}
                - Job: ${jobDescription || 'Not provided'}
                - Language: ${interviewLanguage.toUpperCase()}
                - Current Workspace Content:
                ${allFilesText}
                
                - Recent Dialogue Summary:
                ${recentTranscript}

                ACTION: Acknowledge the reconnection. Tell the candidate you have recovered the link. Summarize your current understanding of the problem and the candidate's progress. Ask the candidate to confirm if your understanding is correct. Then proceed with the interview.`;
                
                serviceRef.current?.sendText(contextMessage);
            },
            onClose: () => {
                setIsLive(false);
                if (autoReconnectAttempts.current < maxAutoRetries && !isEndingRef.current) {
                    autoReconnectAttempts.current++;
                    reconnectTimeoutRef.current = setTimeout(() => connectToAI(true), 2000);
                }
            },
            onError: (err) => { setIsLive(false); addApiLog(`Neural Link Fault: ${err}`, "error"); },
            onVolumeUpdate: (v) => setVolume(v),
            onTranscript: (text, isUser) => {
                setTranscript(prev => {
                    const role = isUser ? 'user' : 'ai';
                    if (text.includes('[NEURAL_SNAPSHOT') || text.includes('[RECONNECTION_PROTOCOL_ACTIVE]')) return prev;
                    if (prev.length > 0 && prev[prev.length - 1].role === role) {
                        return [...prev.slice(0, -1), { ...prev[prev.length - 1], text: prev[prev.length - 1].text + text }];
                    }
                    return [...prev, { role, text, timestamp: Date.now() }];
                });
            },
            onToolCall: async (toolCall) => {
                for (const fc of toolCall.functionCalls) {
                    const args = fc.args as any;
                    if (fc.name === 'create_interview_file') {
                        const newFile: CodeFile = { name: args.filename, path: `local-${sessionUuid}-${Date.now()}`, content: args.content, language: getLanguageFromExt(args.filename), loaded: true, isDirectory: false };
                        setFiles(prev => { const next = [...prev, newFile]; filesRef.current = next; return next; });
                        setActiveFileIndex(filesRef.current.length - 1);
                        service.sendToolResponse({ id: fc.id, name: fc.name, response: { result: "File created." } });
                    } else if (fc.name === 'get_current_code') {
                        const active = filesRef.current[activeFileIndexRef.current];
                        service.sendToolResponse({ id: fc.id, name: fc.name, response: { code: active?.content || "" } });
                    } else if (fc.name === 'update_active_file') {
                        const active = filesRef.current[activeFileIndexRef.current];
                        handleFileChange({ ...active, content: args.content });
                        service.sendToolResponse({ id: fc.id, name: fc.name, response: { result: "Logic updated." } });
                    }
                }
            }
        }, { functionDeclarations: [getCodeTool, createInterviewFileTool, updateActiveFileTool] });
    } catch(e: any) { setIsLive(false); setIsRecovering(false); }
  }, [interviewMode, interviewLanguage, sessionUuid, selectedPersona, addApiLog, jobDescription]);

  const handleStartInterview = async () => {
    setIsLoading(true);
    const sid = generateSecureId().substring(0, 12);
    setSessionUuid(sid);
    localSessionVideoUrlRef.current = '';
    localSessionBlobRef.current = null;
    localSessionVideoSizeRef.current = 0;
    const initialFile: CodeFile = { name: 'interview_notes.md', path: `local-${sid}-notes`, content: `# Session Artifact: ${sid}\n**Mode:** ${interviewMode}\n**Language:** ${interviewLanguage}\n**Persona:** ${selectedPersona.name}\n\nWaiting for interrogator logic...`, language: 'markdown', loaded: true, isDirectory: false };
    setFiles([initialFile]); filesRef.current = [initialFile];
    setActiveFileIndex(0); activeFileIndexRef.current = 0;
    setTimeLeft(interviewDuration * 60);
    setTranscript([]); setReport(null); setView('active');
    await initializeRecordingProtocol(sid);
    await connectToAI(false);
    setIsLoading(false);
  };

  const filteredArchive = useMemo(() => {
      if (!archiveSearch.trim()) return pastInterviews;
      const q = archiveSearch.toLowerCase();
      return pastInterviews.filter(iv => (iv.mode || '').toLowerCase().includes(q) || (iv.jobDescription || '').toLowerCase().includes(q));
  }, [pastInterviews, archiveSearch]);

  const formatTimeLeft = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
        {isLoading && view === 'active' && (
            <div className="absolute inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-10 text-center space-y-8 animate-fade-in">
                <Loader2 className="animate-spin text-indigo-500" size={48} />
                <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">Synthesizing Session</h2>
            </div>
        )}

        {view === 'selection' && (
            <div className="flex-1 overflow-y-auto p-6 md:p-12 scrollbar-hide">
                <div className="max-w-6xl mx-auto space-y-12">
                    <div className="flex flex-col md:flex-row justify-between items-end gap-6">
                        <div className="space-y-3">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-red-900/30 border border-red-500/30 rounded-full text-red-400 text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">
                                <Activity size={14}/> Simulation Active
                            </div>
                            <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">Mock Interview Studio</h1>
                            <p className="text-slate-400 text-lg max-w-xl">Master your technical presence via Socratic Interrogation.</p>
                        </div>
                        <button onClick={() => setView('archive')} className="px-6 py-3 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2">
                            <History size={18}/> My Archive
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[{ id: 'coding', label: 'Algorithmic Coding', icon: Code, color: 'text-indigo-400' }, { id: 'system_design', label: 'System Design', icon: Layers, color: 'text-emerald-400' }, { id: 'behavioral', label: 'Behavioral Prep', icon: MessageSquare, color: 'text-pink-400' }, { id: 'quick_screen', label: 'Quick Screening', icon: Zap, color: 'text-amber-400' }].map(m => (
                            <button key={m.id} onClick={() => { setInterviewMode(m.id as any); setView('setup'); }} className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] hover:border-indigo-500 transition-all text-left group h-full shadow-xl">
                                <div className={`p-4 rounded-2xl bg-slate-950 border border-slate-800 mb-6 group-hover:scale-110 transition-transform ${m.color}`}><m.icon size={32}/></div>
                                <h3 className="text-xl font-bold text-white mb-2">{m.label}</h3>
                                <ChevronRight className="mt-6 text-slate-700 group-hover:text-indigo-400 group-hover:translate-x-2 transition-all" size={24}/>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {view === 'setup' && (
            <div className="flex-1 flex items-center justify-center p-6 animate-fade-in-up">
                <div className="max-w-2xl w-full bg-slate-900 border border-slate-700 rounded-[3rem] p-10 shadow-2xl space-y-10 overflow-y-auto max-h-full scrollbar-hide">
                    <div className="flex items-center gap-6">
                        <button onClick={() => setView('selection')} className="p-3 hover:bg-slate-800 rounded-2xl text-slate-400 transition-colors"><ArrowLeft size={24}/></button>
                        <div><h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">Setup Session</h2><p className="text-indigo-400 text-[10px] font-black uppercase tracking-widest">{(interviewMode || '').toUpperCase()} Interrogation</p></div>
                    </div>
                    <div className="space-y-8">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block px-1">Interrogator Persona</label>
                            <div className="grid grid-cols-1 gap-2">
                                {PERSONAS.map(p => (
                                    <button key={p.id} onClick={() => setSelectedPersona(p)} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all text-left group ${selectedPersona.id === p.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-950 border border-slate-800 text-slate-400 hover:border-slate-700'}`}>
                                        <div className={`p-2.5 rounded-xl ${selectedPersona.id === p.id ? 'bg-indigo-500' : 'bg-slate-900 border border-slate-800'}`}><p.icon size={20}/></div>
                                        <div className="flex-1"><p className="text-xs font-black uppercase tracking-widest">{p.name}</p><p className="text-[9px] opacity-60 font-medium uppercase mt-0.5">{p.desc}</p></div>
                                        {selectedPersona.id === p.id && <CheckCircle2 size={20}/>}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* NEW: PIP SIZE SELECTOR */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block px-1">Recording PIP Size</label>
                            <div className="flex gap-2 p-1.5 bg-slate-950 border border-slate-800 rounded-2xl shadow-inner">
                                {(['normal', 'compact'] as const).map(sz => (
                                    <button 
                                        key={sz} 
                                        onClick={() => setPipSize(sz)} 
                                        className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all ${pipSize === sz ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        {sz}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest px-1">Compact is 2x smaller for maximized workspace visibility.</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Target Language</label>
                            <div className="flex gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
                                {['c++', 'python', 'javascript', 'java'].map(lang => (
                                    <button key={lang} onClick={() => setInterviewLanguage(lang as any)} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all ${interviewLanguage === lang ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>{lang}</button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Job Description</label>
                            <textarea value={jobDescription} onChange={e => setJobDescription(e.target.value)} placeholder="Copy job details here for context..." className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500 h-32 shadow-inner"/>
                        </div>
                    </div>
                    <button onClick={handleStartInterview} disabled={isLoading} className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3"><Sparkles size={24}/> Initialize Neural Interface</button>
                </div>
            </div>
        )}

        {view === 'active' && (
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
                <div className="flex-1 flex flex-col bg-slate-950 relative overflow-hidden">
                    <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'bg-slate-700'}`}></div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{isRecovering ? 'RECOVERY ACTIVE' : 'LIVE STUDIO'}</span>
                            <div className="flex items-center gap-2 px-3 py-1 bg-slate-950 border border-slate-800 rounded-lg">
                                <Clock size={14} className="text-indigo-400"/><span className="text-xs font-mono font-black">{formatTimeLeft(timeLeft)}</span>
                            </div>
                            {isRecordingActive && (
                                <div className="flex items-center gap-2 bg-red-600/20 px-3 py-1 rounded-lg border border-red-500/30 shadow-lg animate-pulse">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                                    <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Scribe Protocol Syncing</span>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-32 h-6 overflow-hidden rounded-full"><Visualizer volume={volume} isActive={isLive} color="#ef4444" /></div>
                            <button onClick={handleEndInterview} className="px-4 py-1.5 bg-red-600 hover:bg-red-600/80 text-white text-[10px] font-black uppercase rounded-lg shadow-lg">Evaluate</button>
                        </div>
                    </header>
                    <div className="flex-1 overflow-hidden relative">
                        {isUploadingRecording && (
                             <div className="absolute inset-0 z-[110] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center gap-6 animate-fade-in text-center">
                                <Loader2 className="animate-spin text-red-500" size={48} />
                                <div className="space-y-1">
                                    <h3 className="text-xl font-black text-white italic uppercase tracking-widest">Archiving Session</h3>
                                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Syncing 1080p stream to YouTube/Drive Registry...</p>
                                </div>
                             </div>
                        )}
                        {files.length > 0 && (
                            <CodeStudio onBack={() => {}} currentUser={currentUser} userProfile={userProfile} onSessionStart={() => {}} onSessionStop={() => {}} onStartLiveSession={() => {}} initialFiles={files} isInterviewerMode={true} onFileChange={handleFileChange} externalChatContent={transcript} onSyncCodeWithAi={handleSyncCodeWithAi} />
                        )}
                    </div>
                </div>
            </div>
        )}

        {view === 'feedback' && report && (
            <div className="flex-1 overflow-y-auto p-6 md:p-12 scrollbar-hide">
                <div className="max-w-4xl mx-auto space-y-12 pb-40 relative">
                    {isUploadingRecording && (
                         <div className="fixed top-24 right-8 z-[120] bg-slate-900 border border-indigo-500/30 rounded-2xl p-4 shadow-2xl animate-fade-in-right flex items-center gap-4 border-l-4 border-l-indigo-500">
                            <Loader2 className="animate-spin text-indigo-500" size={24} />
                            <div><p className="text-[10px] font-black text-white uppercase tracking-widest">Cloud Sync In-Progress</p><p className="text-[8px] text-slate-500 uppercase font-bold tracking-tighter">Updating Neural Vault...</p></div>
                         </div>
                    )}
                    <div className="text-center space-y-4">
                        <Trophy size={48} className="mx-auto text-indigo-400 mb-2"/>
                        <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">Evaluation Report</h1>
                    </div>
                    <EvaluationReportDisplay 
                        report={report} 
                        isSyncing={isUploadingRecording}
                        onSyncYouTube={() => report.videoBlob && performSyncToYouTube(report.id, report.videoBlob, { mode: interviewMode, language: interviewLanguage })}
                        onSyncDrive={() => report.videoBlob && performSyncToDrive(report.id, report.videoBlob, { mode: interviewMode })}
                    />
                    <div className="flex justify-center pb-20"><button onClick={() => setView('selection')} className="px-10 py-4 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-black uppercase tracking-widest rounded-2xl transition-all">Main Menu</button></div>
                </div>
            </div>
        )}

        {view === 'archive' && (
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-8 md:p-12 border-b border-slate-800 bg-slate-900/50 shrink-0">
                    <div className="max-w-6xl mx-auto space-y-8">
                        <div className="flex items-center gap-6">
                            <button onClick={() => setView('selection')} className="p-3 hover:bg-slate-800 rounded-2xl text-slate-400 transition-colors"><ArrowLeft size={24}/></button>
                            <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">Session Archive</h1>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18}/>
                            <input type="text" placeholder="Search by mode or job context..." value={archiveSearch} onChange={e => setArchiveSearch(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-3xl pl-12 pr-6 py-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-inner"/>
                        </div>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 md:p-12 scrollbar-hide">
                    <div className="max-w-6xl mx-auto">
                        {isLoading ? (
                             <div className="py-24 flex flex-col items-center justify-center gap-6 text-center animate-pulse">
                                <Loader2 className="animate-spin text-indigo-500" size={48} />
                                <p className="text-sm font-black uppercase text-slate-500 tracking-widest">Paging Neural Archive...</p>
                            </div>
                        ) : filteredArchive.length === 0 ? (
                            <div className="py-32 flex flex-col items-center justify-center text-slate-700 gap-6">
                                <SearchX size={64} className="opacity-10"/>
                                <p className="text-sm font-bold uppercase tracking-widest">No matching artifacts found</p>
                            </div>
                        ) : (
                            <div className="bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden shadow-2xl">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-950 border-b border-slate-800">
                                            <tr>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Session Artifact</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Logic Mode</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Refraction Date</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Status</th>
                                                <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/50">
                                            {filteredArchive.map(iv => (
                                                <tr key={iv.id} className="hover:bg-slate-800/40 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-12 h-8 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                                                                {iv.videoUrl ? (
                                                                    isYouTubeUrl(iv.videoUrl) ? <Youtube size={16} className="text-red-500" /> : <HardDrive size={16} className="text-indigo-400" />
                                                                ) : <FileVideo size={16} className="text-slate-600" />}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-black text-white truncate max-w-[250px] uppercase tracking-tight">{iv.jobDescription || 'Neural Interrogation'}</p>
                                                                <p className="text-[10px] text-slate-500 font-mono tracking-tighter">ID: {iv.id.substring(0,12)}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="px-2 py-1 bg-slate-950 rounded text-[9px] font-black text-indigo-400 border border-indigo-500/20 uppercase">{iv.mode}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-bold text-slate-300">{new Date(iv.timestamp).toLocaleDateString()}</span>
                                                            <span className="text-[9px] text-slate-600 uppercase font-bold">{new Date(iv.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-1.5">
                                                            <div className={`w-1.5 h-1.5 rounded-full ${iv.videoUrl ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500'}`}></div>
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{iv.videoUrl ? 'Secured' : 'Local Only'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => handlePlayback(iv)} className="p-2 bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white rounded-xl transition-all" title="Playback"><Play size={16}/></button>
                                                            <button onClick={() => { setReport(JSON.parse(iv.feedback)); setView('feedback'); }} className="p-2 bg-slate-800 hover:bg-emerald-600 text-slate-400 hover:text-white rounded-xl transition-all" title="Review Evaluation"><MessageCircle size={16}/></button>
                                                            <button onClick={() => deleteInterview(iv.id).then(loadData)} className="p-2 bg-slate-800 hover:bg-red-600 text-slate-400 hover:text-white rounded-xl transition-all" title="Purge Artifact"><Trash2 size={16}/></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* Video Artifact Player Overlay */}
        {activeMediaId && activeRecording && (
          <div className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 sm:p-10 animate-fade-in">
              <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl flex flex-col h-full max-h-[85vh]">
                  <div className="p-6 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center shrink-0">
                      <div className="flex items-center gap-4">
                          <div className="p-3 bg-red-600 rounded-2xl text-white shadow-lg shadow-red-900/20"><Video size={24}/></div>
                          <div>
                              <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">{activeRecording.mode.toUpperCase()} ARCHIVE</h2>
                              <div className="flex items-center gap-4 mt-1 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                  <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(activeRecording.timestamp).toLocaleDateString()}</span>
                                  <span className="flex items-center gap-1"><History size={12}/> ID: {activeRecording.id.substring(0,12)}</span>
                              </div>
                          </div>
                      </div>
                      <button onClick={closePlayer} className="p-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl transition-all active:scale-95 shadow-lg"><X size={24}/></button>
                  </div>
                  <div className="flex-1 bg-black relative flex items-center justify-center">
                    {resolvedMediaUrl ? (
                        isYouTubeUrl(resolvedMediaUrl) ? (
                            <iframe src={getYouTubeEmbedUrl(extractYouTubeId(resolvedMediaUrl)!)} className="w-full h-full border-none" allowFullScreen title="YouTube Archive" />
                        ) : (
                            <video src={resolvedMediaUrl} controls autoPlay playsInline className="w-full h-full object-contain" />
                        )
                    ) : (
                        <div className="flex flex-col items-center gap-4">
                            <Loader2 size={48} className="animate-spin text-red-500" />
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Decrypting Neural Shards...</span>
                        </div>
                    )}
                  </div>
                  <div className="p-6 bg-slate-950 border-t border-slate-800 flex justify-center items-center gap-6 shrink-0">
                      <button onClick={() => { setReport(JSON.parse(activeRecording.feedback)); setView('feedback'); closePlayer(); }} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-3 shadow-lg"><MessageCircle size={18}/> View Evaluation</button>
                      {isYouTubeUrl(activeRecording.videoUrl) && (
                          <a href={activeRecording.videoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-red-500 transition-colors">
                              <ExternalLink size={16}/> External Vault
                          </a>
                      )}
                  </div>
              </div>
          </div>
        )}
    </div>
  );
};

export default MockInterview;