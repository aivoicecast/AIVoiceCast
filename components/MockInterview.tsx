
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
  Play, Link, CloudUpload, HardDriveDownload, List, Table as TableIcon, FileVideo, Calendar, Download, Maximize2, Maximize, Info, Minimize2,
  FileText
} from 'lucide-react';
import { getGlobalAudioContext, warmUpAudioContext, registerAudioOwner, connectOutput, getGlobalMediaStreamDest } from '../utils/audioUtils';
import { getDriveToken, signInWithGoogle, connectGoogleDrive, isJudgeSession } from '../services/authService';
import { ensureCodeStudioFolder, uploadToDrive, ensureFolder, downloadDriveFileAsBlob, getDriveFileStreamUrl } from '../services/googleDriveService';
import { uploadToYouTube, getYouTubeVideoUrl, getYouTubeEmbedUrl } from '../services/youtubeService';
import { saveLocalRecording, getLocalRecordings } from '../utils/db';

const isYouTubeUrl = (url?: string) => !!url && (url.includes('youtube.com') || url.includes('youtu.be'));
const isDriveUrl = (url?: string) => !!url && (url.startsWith('drive://') || url.includes('drive.google.com'));

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
    type: 'input' | 'output' | 'error' | 'success' | 'warn' | 'info';
    code?: string;
}

interface MockInterviewProps {
  onBack: () => void;
  userProfile: UserProfile | null;
  onStartLiveSession: (channel: Channel, context?: string, recordingEnabled?: boolean, bookingId?: string, videoEnabled?: boolean, cameraEnabled?: boolean, activeSegment?: { index: number, lectureId: string }) => void;
  isProMember?: boolean;
  onOpenManual?: () => void;
}

const PERSONAS = [
    { 
        id: 'software-interview', 
        name: 'Software Interview Expert', 
        icon: GraduationCap, 
        desc: 'Rigorous algorithmic & system design specialist.',
        instruction: 'You are a Senior Staff Engineer at Google. You are conducting a hard technical interview. Your tone is professional and slightly intimidating. You demand complexity analysis (Big-O) for every suggestion. If you receive a [RECONNECTION_PROTOCOL_ACTIVE] block, immediately acknowledge the link recovery, summarize your current understanding of the problem and progress, and ask the user to confirm if anything was missed before proceeding.'
    },
    { 
        id: 'linux-kernel', 
        name: 'Linux Kernel Architect', 
        icon: Cpu, 
        desc: 'Memory safety, drivers, and scheduler audit.',
        instruction: 'You are a Linux Kernel Maintainer. You evaluate C code for race conditions, memory leaks, and architectural elegance. You have zero tolerance for sloppy abstractions. If you receive a [RECONNECTION_PROTOCOL_ACTIVE] block, immediately acknowledge the link recovery, summarize your current understanding of the problem and progress, and ask the user to confirm if anything was missed before proceeding.'
    },
    { 
        id: 'default-gem', 
        name: 'Neural Prism Designer', 
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
    const [showPlayer, setshowPlayer] = useState(false);

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
                                    setshowPlayer(!showPlayer);
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

export const MockInterview: React.FC<MockInterviewProps> = ({ onBack, userProfile, onStartLiveSession, isProMember, onOpenManual }) => {
  const [view, setView] = useState<'selection' | 'setup' | 'active' | 'feedback' | 'archive'>('selection');
  const [interviewMode, setInterviewMode] = useState<'coding' | 'system_design' | 'behavioral' | 'quick_screen' | 'assessment_30' | 'assessment_60'>('coding');
  const [interviewLanguage, setInterviewLanguage] = useState<'c++' | 'python' | 'javascript' | 'java'>('c++');
  const [jobDescription, setJobDescription] = useState('');
  const [selectedPersona, setSelectedPersona] = useState(PERSONAS[0]);
  const [sessionUuid, setSessionUuid] = useState('');
  const [archiveSearch, setArchiveSearch] = useState('');
  const [pipSize, setPipSize] = useState<'normal' | 'compact'>('normal');
  const [isMirrorMinimized, setIsMirrorMinimized] = useState(false);

  const [isAiConnected, setIsAiConnected] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);

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
  const mirrorVideoRef = useRef<HTMLVideoElement>(null);
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
      if (renderIntervalRef.current) clearInterval(rotationTimerRef.current);
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
          const transcriptStr = transcriptRef.current.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n');
          const finalFilesStr = filesRef.current.map(f => `FILE: ${f.name}\nLANGUAGE: ${f.language}\nCONTENT:\n${f.content}`).join('\n\n');
          
          addApiLog("Initiating high-dimensional logic audit (PRO)...", "info");

          const prompt = `Perform a comprehensive technical evaluation of this mock interview session. 
          
          TRANSCRIPT:\n${transcriptStr}\n\nFINAL SOURCE CODE:\n${finalFilesStr}\n\n
          
          Output a JSON report with:
          {
            "score": number (0-100),
            "technicalSkills": "string summary",
            "communication": "string summary",
            "collaboration": "string summary",
            "strengths": ["string", ...],
            "areasForImprovement": ["string", ...],
            "verdict": "string (Hire, No Hire, Strong Hire, etc)",
            "summary": "One paragraph executive summary of the performance",
            "learningMaterial": "Markdown content for a 10-week master-level refraction plan based on weaknesses."
          }
          `;

          const res = await ai.models.generateContent({
              model: 'gemini-3-pro-preview',
              contents: prompt,
              config: { 
                  responseMimeType: 'application/json',
                  thinkingConfig: { thinkingBudget: 15000 }
              }
          });

          const reportData = JSON.parse(res.text || '{}');
          const finalReport: MockInterviewReport = {
              ...reportData,
              id: sessionUuid,
              sourceCode: filesRef.current,
              transcript: transcriptRef.current,
              videoUrl: localSessionVideoUrlRef.current,
              videoBlob: localSessionBlobRef.current || undefined,
              videoSize: localSessionVideoSizeRef.current
          };

          setReport(finalReport);
          addApiLog("Neural report synthesized. Registry updated.", "success");
          
          const rec: MockInterviewRecording = {
              id: sessionUuid,
              userId: currentUser?.uid || 'guest',
              userName: currentUser?.displayName || 'Candidate',
              mode: interviewMode,
              jobDescription,
              timestamp: Date.now(),
              videoUrl: localSessionVideoUrlRef.current,
              feedback: reportData.verdict,
              transcript: transcriptRef.current,
              visibility: 'private',
              language: interviewLanguage,
              blob: localSessionBlobRef.current || undefined
          };
          await saveInterviewRecording(rec);

          setView('feedback');
      } catch (e: any) {
          console.error(e);
          addApiLog("Evaluation synthesis interrupted: " + e.message, "error");
          setView('selection');
      } finally {
          setIsLoading(false);
          isEndingRef.current = false;
      }
  }, [sessionUuid, interviewMode, jobDescription, interviewLanguage, currentUser, addApiLog, report]);

  const initializePersistentRecorder = useCallback(async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') return;

    try {
        addApiLog("Initializing Scribe Compositor Protocol...", "info");
        const ctx = getGlobalAudioContext();
        const recordingDest = getGlobalMediaStreamDest();
        
        if (ctx.state !== 'running') await ctx.resume();

        addApiLog("Handshaking Audio Hub for Scribe...", "info");
        const userStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const userSource = ctx.createMediaStreamSource(userStream); 
        userSource.connect(recordingDest);

        if (screenStreamRef.current && screenStreamRef.current.getAudioTracks().length > 0) {
            const screenAudioSource = ctx.createMediaStreamSource(screenStreamRef.current);
            screenAudioSource.connect(recordingDest);
        }

        const canvas = document.createElement('canvas');
        canvas.width = 1920; 
        canvas.height = 1080;
        const drawCtx = canvas.getContext('2d', { alpha: false })!;
        
        const createCaptureVideo = (stream: MediaStream | null, id: string) => {
            const v = document.createElement('video');
            v.muted = true; v.playsInline = true; v.autoplay = true;
            v.style.position = 'fixed'; v.style.left = '-10000px'; 
            if (stream) { 
                v.srcObject = stream; 
                document.body.appendChild(v); 
                v.play().catch(err => {
                    console.warn(`[Scribe] Stream play interrupted for ${id}:`, err);
                    addApiLog(`Compositor: ${id} buffer delayed. Attempting recovery...`, "warn");
                }); 
            }
            return v;
        };

        const screenVideo = createCaptureVideo(screenStreamRef.current, 'screen');
        const cameraVideo = createCaptureVideo(cameraStreamRef.current, 'camera');

        let firstFrameLogged = false;
        let flowVerified = false;

        const checkFlow = () => {
            const screenOk = !screenStreamRef.current || (screenVideo.readyState >= 2 && screenVideo.currentTime > 0);
            const cameraOk = !cameraStreamRef.current || (cameraVideo.readyState >= 2 && cameraVideo.currentTime > 0);
            if (screenOk && cameraOk) {
                if (!flowVerified) {
                    flowVerified = true;
                    addApiLog("Frame flow verified. Recorder engaged.", "success");
                }
            } else {
                if (screenVideo.paused) screenVideo.play();
                if (cameraVideo.paused) cameraVideo.play();
                
                if (!cameraOk && cameraStreamRef.current) {
                    addApiLog(`Compositor: Camera buffer pending (ReadyState: ${cameraVideo.readyState})...`, "warn");
                }
                
                setTimeout(checkFlow, 500);
            }
        };
        checkFlow();

        const renderLoop = () => {
            drawCtx.fillStyle = '#020617';
            drawCtx.fillRect(0, 0, canvas.width, canvas.height);
            
            if (screenVideo.readyState >= 2) {
                drawCtx.save();
                drawCtx.filter = 'blur(60px) brightness(0.4)';
                drawCtx.drawImage(screenVideo, -100, -100, canvas.width + 200, canvas.height + 200);
                drawCtx.restore();
            }

            if (screenStreamRef.current && screenVideo.readyState >= 2) {
                const scale = Math.min(canvas.width / screenVideo.videoWidth, canvas.height / screenVideo.videoHeight);
                const w = screenVideo.videoWidth * scale;
                const h = screenVideo.videoHeight * scale;
                drawCtx.save();
                drawCtx.shadowColor = 'rgba(0,0,0,0.8)';
                drawCtx.shadowBlur = 40;
                drawCtx.drawImage(screenVideo, (canvas.width - w)/2, (canvas.height - h)/2, w, h);
                drawCtx.restore();
            }

            if (cameraStreamRef.current && cameraVideo.readyState >= 2) {
                const size = pipSize === 'compact' ? 220 : 440; 
                const margin = pipSize === 'compact' ? 30 : 40; 
                const px = canvas.width - size - margin;
                const py = canvas.height - size - margin;
                const centerX = px + size / 2;
                const centerY = py + size / 2;
                const radius = size / 2;
                
                drawCtx.save();
                drawCtx.shadowColor = 'rgba(0,0,0,0.9)';
                drawCtx.shadowBlur = 50;
                drawCtx.beginPath();
                drawCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                drawCtx.closePath();
                drawCtx.clip();

                const camScale = Math.max(size / cameraVideo.videoWidth, size / cameraVideo.videoHeight);
                const cw = cameraVideo.videoWidth * camScale;
                const ch = cameraVideo.videoHeight * camScale;
                drawCtx.drawImage(cameraVideo, centerX - cw / 2, centerY - ch / 2, cw, ch);
                drawCtx.restore();

                drawCtx.save();
                drawCtx.beginPath();
                drawCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                drawCtx.strokeStyle = '#ef4444'; 
                drawCtx.lineWidth = pipSize === 'compact' ? 6 : 12;
                drawCtx.stroke();
                drawCtx.restore();

                if (!firstFrameLogged) {
                    firstFrameLogged = true;
                    addApiLog("Compositor: First PiP frame rasterized successfully.", "success");
                }
            } else if (cameraStreamRef.current && !firstFrameLogged) {
                addApiLog(`Compositor: Camera buffer pending (State: ${cameraVideo.readyState})...`, "warn");
            }
        };

        renderIntervalRef.current = setInterval(renderLoop, 1000 / 30);

        const captureStream = canvas.captureStream(30);
        recordingDest.stream.getAudioTracks().forEach(t => captureStream.addTrack(t));
        const mimeType = 'video/webm;codecs=vp9,opus';
        const recorder = new MediaRecorder(captureStream, { 
            mimeType, 
            videoBitsPerSecond: 8000000 
        });

        audioChunksRef.current = []; 
        recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
        
        recorder.onstop = () => {
            setIsRecordingActive(false);
            if (renderIntervalRef.current) clearInterval(renderIntervalRef.current);
            const blob = new Blob(audioChunksRef.current, { type: 'video/webm' });
            localSessionBlobRef.current = blob;
            localSessionVideoSizeRef.current = blob.size;
            localSessionVideoUrlRef.current = URL.createObjectURL(blob);
            addApiLog(`Scribe: Neural artifact assembled (${formatMass(blob.size)}).`, "info");
            
            userStream.getTracks().forEach(t => t.stop());
            if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach(t => t.stop());
            if (cameraStreamRef.current) cameraStreamRef.current.getTracks().forEach(t => t.stop());
            screenVideo.remove(); cameraVideo.remove();
        };
        
        mediaRecorderRef.current = recorder;
        recorder.start(1000);
        setIsRecordingActive(true);
    } catch(e: any) { 
        addApiLog("Scribe Init failed: " + e.message, "error");
    }
  }, [pipSize, addApiLog]);

  const connect = useCallback(async (reconnect = false) => {
    if (isEndingRef.current) return;
    
    if (serviceRef.current && !reconnect) return;
    const service = new GeminiLiveService();
    serviceRef.current = service;
    
    try {
      await service.initializeAudio();
      
      const contextBlock = `
        JOB DESCRIPTION: ${jobDescription || 'Senior Software Engineer'}
        INTERVIEW MODE: ${interviewMode}
        PREFERRED LANGUAGE: ${interviewLanguage}
        CANDIDATE NAME: ${currentUser?.displayName || 'Unknown'}
        SESSION ID: ${sessionUuid}
      `;

      const systemInstruction = `
        ${selectedPersona.instruction}
        ${contextBlock}
        
        GOAL: Evaluate the candidate rigorously.
        - coding: Provide a difficult algorithmic problem. DO NOT solve it. Use the 'create_interview_file' tool.
        - system_design: Present a high-scale architectural scenario (e.g. Design TikTok or Spanner).
        - behavioral: Deep-dive into a past technical failure.
        
        TOOLS:
        - Use 'get_current_code' to see the candidate's work.
        - Use 'update_active_file' to add TODOs or comments (never full solutions).
        - Use 'create_interview_file' to initialize the problem file.
      `;

      await service.connect(selectedPersona.name, systemInstruction, {
          onOpen: () => {
              setIsLive(true);
              setIsRecovering(false);
              setIsAiConnected(true);
              autoReconnectAttempts.current = 0;
              if (reconnect) {
                  service.sendText(`[RECONNECTION_PROTOCOL_ACTIVE] Connection restored. I am back. Workspace: ${activeFileIndexRef.current >= 0 ? filesRef.current[activeFileIndexRef.current]?.name : 'None'}.`);
              } else {
                  service.sendText("Neural Link Established. Candidate is ready. Introduce yourself and begin the interrogation.");
              }
          },
          onClose: () => {
              setIsAiConnected(false);
              if (autoReconnectAttempts.current < maxAutoRetries && !isEndingRef.current) {
                  autoReconnectAttempts.current++;
                  setIsRecovering(true);
                  reconnectTimeoutRef.current = setTimeout(() => connect(true), 1500);
              } else if (!isEndingRef.current) {
                  setIsLive(false);
              }
          },
          onError: (err) => {
              addApiLog(`Neural Link Failure: ${err}`, "error");
              setIsAiConnected(false);
              if (err.includes('429')) {
                  addApiLog("Gemini Rate Limit (429) hit. Entering extended backoff.", "warn");
                  autoReconnectAttempts.current = maxAutoRetries; 
              }
          },
          onVolumeUpdate: (v) => setVolume(v),
          onTranscript: (text, isUser) => {
              const role = isUser ? 'user' : 'ai';
              setTranscript(prev => {
                  if (prev.length > 0 && prev[prev.length - 1].role === role) {
                      return [...prev.slice(0, -1), { ...prev[prev.length - 1], text: prev[prev.length - 1].text + text }];
                  }
                  return [...prev, { role, text, timestamp: Date.now() }];
              });
          },
          onToolCall: async (toolCall) => {
              for (const fc of toolCall.functionCalls) {
                  addApiLog(`Executing Tool: ${fc.name}`, 'input');
                  if (fc.name === 'get_current_code') {
                      const result = filesRef.current.map(f => `${f.name}:\n${f.content}`).join('\n\n');
                      service.sendToolResponse({ id: fc.id, name: fc.name, response: { result } });
                      addApiLog("Registry Refraction: Snapshot shared with host.", 'success');
                  } else if (fc.name === 'create_interview_file') {
                      const args = fc.args as any;
                      const newFile: CodeFile = {
                          name: args.filename,
                          path: args.filename,
                          language: getLanguageFromExt(args.filename),
                          content: args.content,
                          loaded: true
                      };
                      setFiles(prev => [...prev, newFile]);
                      setActiveFileIndex(filesRef.current.length);
                      service.sendToolResponse({ id: fc.id, name: fc.name, response: { result: `File '${args.filename}' manifested in workspace.` } });
                      addApiLog(`Logic Partition Created: ${args.filename}`, 'success');
                  } else if (fc.name === 'update_active_file') {
                      const args = fc.args as any;
                      if (activeFileIndexRef.current >= 0 && filesRef.current[activeFileIndexRef.current]) {
                          const updated = { ...filesRef.current[activeFileIndexRef.current], content: args.content };
                          setFiles(prev => prev.map((f, i) => i === activeFileIndexRef.current ? updated : f));
                          service.sendToolResponse({ id: fc.id, name: fc.name, response: { result: "Workspace updated successfully." } });
                          addApiLog("Interviewer applied TODO refraction.", 'info');
                      }
                  }
              }
          }
      }, [{ functionDeclarations: [getCodeTool, updateActiveFileTool, createInterviewFileTool] }]);
    } catch (e: any) {
        addApiLog("Connection Fault: " + e.message, "error");
        setIsLive(false);
    }
  }, [jobDescription, interviewMode, interviewLanguage, selectedPersona, sessionUuid, currentUser, addApiLog]);

  const handleStartInterview = async () => {
    setIsLoading(true);
    isEndingRef.current = false;
    const uuid = generateSecureId();
    setSessionUuid(uuid);
    setTranscript([]);
    setReport(null);
    setFiles([{ name: 'workspace.cpp', path: 'workspace.cpp', language: 'c++', content: '// Neural Workspace Ready...\n', loaded: true }]);
    setActiveFileIndex(0);
    setApiLogs([]);

    try {
        addApiLog("Requesting Screen Share for Scribe Protocol...", "info");
        screenStreamRef.current = await navigator.mediaDevices.getDisplayMedia({ 
            video: { width: { ideal: 1920 }, height: { ideal: 1080 } }, 
            audio: true 
        } as any);
        
        addApiLog("Requesting Camera Access for PiP Portal...", "info");
        cameraStreamRef.current = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 1280, height: 720 }, 
            audio: false 
        });

        if (mirrorVideoRef.current && cameraStreamRef.current) {
            mirrorVideoRef.current.srcObject = cameraStreamRef.current;
        }

        initializePersistentRecorder();
        await connect();
        
        setTimeLeft(interviewDuration * 60);
        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) { handleEndInterview(); return 0; }
                return prev - 1;
            });
        }, 1000);

        rotationTimerRef.current = setInterval(() => {
            if (isAiConnected && !isEndingRef.current) {
                addApiLog("Neural Rotation Pulse: Context stabilized.", "info");
                serviceRef.current?.sendText("NEURAL_PULSE_STABLE: Continuing interrogation.");
            }
        }, 300000);

        setView('active');
    } catch (e: any) {
        addApiLog("Permission Error: " + e.message, "error");
        alert("Audio, Screen, and Camera permissions are mandatory for the Interrogation Protocol.");
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="h-full bg-slate-950 flex flex-col font-sans overflow-hidden relative">
        <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-30">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <div className="flex flex-col">
                    <h1 className="text-lg font-black text-white flex items-center gap-2 italic uppercase tracking-tighter">
                        <Video className="text-red-500" /> Interrogation Studio
                    </h1>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Evaluator Cycle v8.0.0</span>
                        {onOpenManual && <button onClick={onOpenManual} className="p-1 text-slate-600 hover:text-white transition-colors" title="Interrogation Manual"><Info size={12}/></button>}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3">
                {view === 'selection' && (
                    <button 
                        onClick={() => setView('archive')}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-[10px] font-black uppercase border border-slate-700 transition-all flex items-center gap-2 shadow-lg"
                    >
                        <History size={16}/> <span>Archive</span>
                    </button>
                )}
                {view === 'active' && (
                    <div className="flex items-center gap-4 bg-slate-950/80 px-5 py-2 rounded-2xl border border-red-500/30 shadow-xl">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Neural Link Time</span>
                            <span className="text-xl font-mono font-black text-white">{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
                        </div>
                        <div className="w-px h-8 bg-slate-800"></div>
                        <button onClick={handleEndInterview} className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg active:scale-95 transition-all">TERMINATE</button>
                    </div>
                )}
                {(view === 'feedback' || view === 'archive') && (
                    <button onClick={() => setView('selection')} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg transition-all active:scale-95">New Session</button>
                )}
            </div>
        </header>

        <main className="flex-1 overflow-hidden relative flex flex-col items-center">
            {isLoading && (
                <div className="absolute inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center gap-8 animate-fade-in">
                    <div className="relative">
                        <div className="w-24 h-24 border-4 border-indigo-500/10 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Zap size={32} className="text-indigo-400 animate-pulse" />
                        </div>
                    </div>
                    <div className="text-center space-y-2">
                        <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Initializing Refraction</h3>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Provisioning Socratic Environment...</p>
                    </div>
                </div>
            )}

            {view === 'selection' && (
                <div className="max-w-4xl w-full p-8 md:p-16 h-full flex flex-col justify-center gap-12 animate-fade-in-up">
                    <div className="text-center space-y-4">
                        <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">The Interrogator</h2>
                        <p className="text-lg text-slate-400 font-medium max-w-xl mx-auto leading-relaxed">Refining engineering talent through technical friction and Staff-level peer evaluation.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {PERSONAS.map(p => (
                            <button 
                                key={p.id}
                                onClick={() => setSelectedPersona(p)}
                                className={`p-8 rounded-[3rem] border transition-all text-left flex flex-col gap-4 relative overflow-hidden group ${selectedPersona.id === p.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-2xl scale-[1.02]' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-indigo-500/40'}`}
                            >
                                <div className={`p-4 rounded-3xl w-fit ${selectedPersona.id === p.id ? 'bg-indigo-500' : 'bg-slate-950'} transition-colors`}>
                                    <p.icon size={32} className={selectedPersona.id === p.id ? 'text-white' : 'text-indigo-500'} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black uppercase tracking-tight leading-none mb-2">{p.name}</h3>
                                    <p className="text-xs font-medium opacity-60 leading-relaxed">{p.desc}</p>
                                </div>
                                {selectedPersona.id === p.id && <div className="absolute -right-4 -bottom-4 p-8 bg-white/10 rounded-full blur-2xl"></div>}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-col items-center gap-6">
                        <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 shadow-xl">
                            {(['coding', 'system_design', 'behavioral', 'quick_screen'] as const).map(m => (
                                <button key={m} onClick={() => setInterviewMode(m)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${interviewMode === m ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-200'}`}>{m.replace('_', ' ')}</button>
                            ))}
                        </div>
                        <button onClick={() => setView('setup')} className="px-12 py-5 bg-white text-slate-950 font-black uppercase tracking-[0.3em] rounded-2xl shadow-2xl shadow-indigo-900/40 transition-transform hover:scale-105 active:scale-95 flex items-center gap-3">
                            <span>Proceed to Setup</span>
                            <ChevronRight size={20}/>
                        </button>
                    </div>
                </div>
            )}

            {view === 'setup' && (
                <div className="max-w-xl w-full p-8 md:p-12 h-full flex flex-col justify-center gap-10 animate-fade-in-up">
                    <div className="space-y-2">
                        <button onClick={() => setView('selection')} className="flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-white transition-colors mb-4"><ArrowLeft size={14}/> Back to Selection</button>
                        <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">Environmental Config</h2>
                        <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Establishing Socratic Context</p>
                    </div>

                    <div className="space-y-8 bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-16 bg-red-500/5 blur-[80px] rounded-full pointer-events-none"></div>
                        
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Primary Code Refraction (Language)</label>
                            <div className="grid grid-cols-2 gap-2">
                                {(['c++', 'python', 'javascript', 'java'] as const).map(l => (
                                    <button key={l} onClick={() => setInterviewLanguage(l)} className={`py-3 rounded-xl border text-xs font-black uppercase transition-all ${interviewLanguage === l ? 'bg-red-600 border-red-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-600'}`}>{l}</button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Job Context (Target Narrative)</label>
                            <textarea 
                                value={jobDescription} 
                                onChange={e => setJobDescription(e.target.value)} 
                                rows={4}
                                placeholder="Paste job requirements or 'L6 Staff Engineer at Amazon'..."
                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white outline-none focus:ring-2 focus:ring-red-500 shadow-inner resize-none leading-relaxed"
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Temporal Shift (Duration)</label>
                            <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
                                {[15, 30, 45, 60].map(m => (
                                    <button key={m} onClick={() => setInterviewDuration(m)} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${interviewDuration === m ? 'bg-red-600 text-white shadow-lg' : 'text-slate-50'}`}>{m}m</button>
                                ))}
                            </div>
                        </div>

                        <button onClick={handleStartInterview} className="w-full py-5 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-red-900/40 transition-all active:scale-95 flex items-center justify-center gap-3">
                            <Play size={20} fill="currentColor"/> Begin Interrogation
                        </button>
                    </div>
                </div>
            )}

            {view === 'active' && (
                <div className="h-full w-full flex animate-fade-in relative">
                    <div className={`fixed bottom-24 right-6 z-[100] transition-all duration-500 transform ${isMirrorMinimized ? 'translate-x-20 scale-50 opacity-20' : 'translate-x-0 scale-100'}`}>
                        <div className={`relative group ${pipSize === 'compact' ? 'w-32 h-32' : 'w-56 h-56'}`}>
                            <div className="absolute -inset-1 bg-gradient-to-r from-red-500 to-indigo-600 rounded-full blur opacity-40 group-hover:opacity-100 transition duration-1000"></div>
                            <div className="relative w-full h-full bg-slate-900 rounded-full border-4 border-red-500/50 overflow-hidden shadow-2xl">
                                <video 
                                    ref={mirrorVideoRef}
                                    autoPlay 
                                    playsInline 
                                    muted 
                                    className="w-full h-full object-cover transform scale-110"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
                                <div className="absolute top-2 left-1/2 -translate-x-1/2">
                                    <div className="bg-red-600 text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-full shadow-lg border border-red-400/50 whitespace-nowrap">Neural Mirror</div>
                                </div>
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-1/2 h-1 overflow-hidden rounded-full"><Visualizer volume={volume} isActive={isLive} color="#ffffff" /></div>
                                <button 
                                    onClick={() => setIsMirrorMinimized(!isMirrorMinimized)}
                                    className="absolute bottom-2 left-1/2 -translate-x-1/2 p-1.5 bg-black/40 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                                >
                                    {isMirrorMinimized ? <Maximize2 size={12}/> : <Minimize2 size={12}/>}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 min-w-0">
                        <CodeStudio 
                            onBack={() => {}} 
                            currentUser={currentUser} 
                            userProfile={userProfile} 
                            isProMember={true} 
                            isInterviewerMode={true}
                            initialFiles={files}
                            onFileChange={(f) => setFiles(prev => prev.map(p => p.path === f.path ? f : p))}
                            externalChatContent={transcript}
                            isAiThinking={!isAiConnected && isLive}
                            onSyncCodeWithAi={(f) => {
                                addApiLog(`Forced Code Sync: ${f.name}`, 'info');
                                serviceRef.current?.sendText(`NEURAL_SNAPSHOT_SYNC: User forced a code update for ${f.name}. CONTENT: \n\`\`\`\n${f.content}\n\`\`\``);
                            }}
                            onSessionStart={() => {}}
                            onSessionStop={() => {}}
                            onStartLiveSession={(chan, ctx) => onStartLiveSession(chan, ctx)}
                        />
                    </div>
                </div>
            )}

            {view === 'feedback' && report && (
                <div className="h-full w-full overflow-y-auto p-12 bg-[#020617] scrollbar-hide">
                    <div className="max-w-4xl mx-auto space-y-16">
                        <div className="text-center space-y-4">
                            <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">Evaluation Refraction</h2>
                            <p className="text-slate-500 font-bold uppercase tracking-[0.4em] pt-2">Session Integrity: 100% Validated</p>
                        </div>
                        <EvaluationReportDisplay 
                            report={report} 
                            onSyncYouTube={() => performSyncToYouTube(report.id, report.videoBlob!, { mode: interviewMode, language: interviewLanguage })}
                            onSyncDrive={() => performSyncToDrive(report.id, report.videoBlob!, { mode: interviewMode })}
                            isSyncing={isUploadingRecording}
                        />
                    </div>
                </div>
            )}

            {view === 'archive' && (
                <div className="max-w-6xl w-full p-8 md:p-12 h-full flex flex-col animate-fade-in pb-32">
                    <div className="flex flex-col sm:flex-row items-center justify-between mb-10 gap-6">
                        <div className="space-y-2">
                             <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">Artifact Registry</h2>
                             <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Sovereign Interrogation History</p>
                        </div>
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                            <input 
                                type="text" 
                                placeholder="Search sessions..." 
                                value={archiveSearch}
                                onChange={e => setArchiveSearch(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-12 pr-6 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-4 scrollbar-hide">
                        {isLoading && pastInterviews.length === 0 ? (
                            <div className="py-20 flex flex-col items-center gap-4 text-indigo-400">
                                <Loader2 className="animate-spin" size={32}/>
                                <p className="text-[10px] font-black uppercase tracking-widest">Paging Registry...</p>
                            </div>
                        ) : pastInterviews.length === 0 ? (
                            <div className="py-20 flex flex-col items-center justify-center text-slate-700 gap-4 opacity-40">
                                <SearchX size={64}/>
                                <p className="text-sm font-bold uppercase tracking-widest">No artifacts located</p>
                            </div>
                        ) : (
                            pastInterviews.filter(i => i.mode.includes(archiveSearch) || i.jobDescription.includes(archiveSearch)).map(rec => (
                                <div key={rec.id} className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 flex flex-col md:flex-row items-center justify-between gap-8 hover:border-indigo-500/30 transition-all shadow-xl group">
                                    <div className="flex items-center gap-6 flex-1 min-w-0">
                                        <div className="w-20 h-14 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center text-slate-700 relative overflow-hidden shrink-0 group-hover:border-indigo-500/20 transition-colors">
                                             <FileVideo size={24}/>
                                             <button onClick={() => handlePlayback(rec)} disabled={resolvingId === rec.id} className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                 {resolvingId === rec.id ? <Loader2 className="animate-spin text-white" size={16}/> : <Play size={20} fill="white" className="text-white"/>}
                                             </button>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="text-lg font-bold text-white truncate">{rec.mode.toUpperCase()} SCREEN</h3>
                                                <span className="text-[8px] font-black text-indigo-400 bg-indigo-900/30 px-2 py-0.5 rounded border border-indigo-500/20 uppercase">{rec.language}</span>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                                                <span className="flex items-center gap-1.5"><Calendar size={14} className="text-indigo-400"/> {new Date(rec.timestamp).toLocaleDateString()}</span>
                                                <span className="flex items-center gap-1.5 font-mono text-[10px] text-slate-600">ID: {rec.id.substring(0,12)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border shadow-lg ${
                                            rec.feedback.toLowerCase().includes('strong hire') ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 
                                            rec.feedback.toLowerCase().includes('hire') ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30' : 'bg-red-900/20 text-red-400 border-red-500/30'
                                        }`}>
                                            {rec.feedback || 'Incomplete'}
                                        </div>
                                        {isYouTubeUrl(rec.videoUrl) ? (
                                            <a href={rec.videoUrl} target="_blank" rel="noreferrer" className="p-3 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-xl transition-all border border-red-500/20" title="Watch on YouTube"><Youtube size={20}/></a>
                                        ) : isDriveUrl(rec.videoUrl) ? (
                                            <button onClick={() => handlePlayback(rec)} className="p-3 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-xl transition-all border border-indigo-500/20" title="Stream from Drive"><HardDrive size={20}/></button>
                                        ) : null}
                                        <button onClick={() => { if(confirm("Purge artifact?")) deleteInterview(rec.id).then(loadData) }} className="p-3 bg-slate-800 hover:bg-red-600 text-slate-500 hover:text-white rounded-xl transition-all"><Trash2 size={20}/></button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </header>

        <main className="flex-1 overflow-hidden relative flex flex-col items-center">
            {isLoading && (
                <div className="absolute inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center gap-8 animate-fade-in">
                    <div className="relative">
                        <div className="w-24 h-24 border-4 border-indigo-500/10 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Zap size={32} className="text-indigo-400 animate-pulse" />
                        </div>
                    </div>
                    <div className="text-center space-y-2">
                        <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Initializing Refraction</h3>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Provisioning Socratic Environment...</p>
                    </div>
                </div>
            )}

            {view === 'selection' && (
                <div className="max-w-4xl w-full p-8 md:p-16 h-full flex flex-col justify-center gap-12 animate-fade-in-up">
                    <div className="text-center space-y-4">
                        <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">The Interrogator</h2>
                        <p className="text-lg text-slate-400 font-medium max-w-xl mx-auto leading-relaxed">Refining engineering talent through technical friction and Staff-level peer evaluation.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {PERSONAS.map(p => (
                            <button 
                                key={p.id}
                                onClick={() => setSelectedPersona(p)}
                                className={`p-8 rounded-[3rem] border transition-all text-left flex flex-col gap-4 relative overflow-hidden group ${selectedPersona.id === p.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-2xl scale-[1.02]' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-indigo-500/40'}`}
                            >
                                <div className={`p-4 rounded-3xl w-fit ${selectedPersona.id === p.id ? 'bg-indigo-500' : 'bg-slate-950'} transition-colors`}>
                                    <p.icon size={32} className={selectedPersona.id === p.id ? 'text-white' : 'text-indigo-500'} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black uppercase tracking-tight leading-none mb-2">{p.name}</h3>
                                    <p className="text-xs font-medium opacity-60 leading-relaxed">{p.desc}</p>
                                </div>
                                {selectedPersona.id === p.id && <div className="absolute -right-4 -bottom-4 p-8 bg-white/10 rounded-full blur-2xl"></div>}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-col items-center gap-6">
                        <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 shadow-xl">
                            {(['coding', 'system_design', 'behavioral', 'quick_screen'] as const).map(m => (
                                <button key={m} onClick={() => setInterviewMode(m)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${interviewMode === m ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-200'}`}>{m.replace('_', ' ')}</button>
                            ))}
                        </div>
                        <button onClick={() => setView('setup')} className="px-12 py-5 bg-white text-slate-950 font-black uppercase tracking-[0.3em] rounded-2xl shadow-2xl shadow-indigo-900/40 transition-transform hover:scale-105 active:scale-95 flex items-center gap-3">
                            <span>Proceed to Setup</span>
                            <ChevronRight size={20}/>
                        </button>
                    </div>
                </div>
            )}

            {view === 'setup' && (
                <div className="max-w-xl w-full p-8 md:p-12 h-full flex flex-col justify-center gap-10 animate-fade-in-up">
                    <div className="space-y-2">
                        <button onClick={() => setView('selection')} className="flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-white transition-colors mb-4"><ArrowLeft size={14}/> Back to Selection</button>
                        <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">Environmental Config</h2>
                        <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Establishing Socratic Context</p>
                    </div>

                    <div className="space-y-8 bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-16 bg-red-500/5 blur-[80px] rounded-full pointer-events-none"></div>
                        
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Primary Code Refraction (Language)</label>
                            <div className="grid grid-cols-2 gap-2">
                                {(['c++', 'python', 'javascript', 'java'] as const).map(l => (
                                    <button key={l} onClick={() => setInterviewLanguage(l)} className={`py-3 rounded-xl border text-xs font-black uppercase transition-all ${interviewLanguage === l ? 'bg-red-600 border-red-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-600'}`}>{l}</button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Job Context (Target Narrative)</label>
                            <textarea 
                                value={jobDescription} 
                                onChange={e => setJobDescription(e.target.value)} 
                                rows={4}
                                placeholder="Paste job requirements or 'L6 Staff Engineer at Amazon'..."
                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white outline-none focus:ring-2 focus:ring-red-500 shadow-inner resize-none leading-relaxed"
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Temporal Shift (Duration)</label>
                            <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
                                {[15, 30, 45, 60].map(m => (
                                    <button key={m} onClick={() => setInterviewDuration(m)} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${interviewDuration === m ? 'bg-red-600 text-white shadow-lg' : 'text-slate-50'}`}>{m}m</button>
                                ))}
                            </div>
                        </div>

                        <button onClick={handleStartInterview} className="w-full py-5 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-red-900/40 transition-all active:scale-95 flex items-center justify-center gap-3">
                            <Play size={20} fill="currentColor"/> Begin Interrogation
                        </button>
                    </div>
                </div>
            )}

            {view === 'active' && (
                <div className="h-full w-full flex animate-fade-in relative">
                    <div className={`fixed bottom-24 right-6 z-[100] transition-all duration-500 transform ${isMirrorMinimized ? 'translate-x-20 scale-50 opacity-20' : 'translate-x-0 scale-100'}`}>
                        <div className={`relative group ${pipSize === 'compact' ? 'w-32 h-32' : 'w-56 h-56'}`}>
                            <div className="absolute -inset-1 bg-gradient-to-r from-red-500 to-indigo-600 rounded-full blur opacity-40 group-hover:opacity-100 transition duration-1000"></div>
                            <div className="relative w-full h-full bg-slate-900 rounded-full border-4 border-red-500/50 overflow-hidden shadow-2xl">
                                <video 
                                    ref={mirrorVideoRef}
                                    autoPlay 
                                    playsInline 
                                    muted 
                                    className="w-full h-full object-cover transform scale-110"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
                                <div className="absolute top-2 left-1/2 -translate-x-1/2">
                                    <div className="bg-red-600 text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-full shadow-lg border border-red-400/50 whitespace-nowrap">Neural Mirror</div>
                                </div>
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-1/2 h-1 overflow-hidden rounded-full"><Visualizer volume={volume} isActive={isLive} color="#ffffff" /></div>
                                <button 
                                    onClick={() => setIsMirrorMinimized(!isMirrorMinimized)}
                                    className="absolute bottom-2 left-1/2 -translate-x-1/2 p-1.5 bg-black/40 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                                >
                                    {isMirrorMinimized ? <Maximize2 size={12}/> : <Minimize2 size={12}/>}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 min-w-0">
                        <CodeStudio 
                            onBack={() => {}} 
                            currentUser={currentUser} 
                            userProfile={userProfile} 
                            isProMember={true} 
                            isInterviewerMode={true}
                            initialFiles={files}
                            onFileChange={(f) => setFiles(prev => prev.map(p => p.path === f.path ? f : p))}
                            externalChatContent={transcript}
                            isAiThinking={!isAiConnected && isLive}
                            onSyncCodeWithAi={(f) => {
                                addApiLog(`Forced Code Sync: ${f.name}`, 'info');
                                serviceRef.current?.sendText(`NEURAL_SNAPSHOT_SYNC: User forced a code update for ${f.name}. CONTENT: \n\`\`\`\n${f.content}\n\`\`\``);
                            }}
                            onSessionStart={() => {}}
                            onSessionStop={() => {}}
                            onStartLiveSession={(chan, ctx) => onStartLiveSession(chan, ctx)}
                        />
                    </div>
                </div>
            )}

            {view === 'feedback' && report && (
                <div className="h-full w-full overflow-y-auto p-12 bg-[#020617] scrollbar-hide">
                    <div className="max-w-4xl mx-auto space-y-16">
                        <div className="text-center space-y-4">
                            <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">Evaluation Refraction</h2>
                            <p className="text-slate-500 font-bold uppercase tracking-[0.4em] pt-2">Session Integrity: 100% Validated</p>
                        </div>
                        <EvaluationReportDisplay 
                            report={report} 
                            onSyncYouTube={() => performSyncToYouTube(report.id, report.videoBlob!, { mode: interviewMode, language: interviewLanguage })}
                            onSyncDrive={() => performSyncToDrive(report.id, report.videoBlob!, { mode: interviewMode })}
                            isSyncing={isUploadingRecording}
                        />
                    </div>
                </div>
            )}

            {view === 'archive' && (
                <div className="max-w-6xl w-full p-8 md:p-12 h-full flex flex-col animate-fade-in pb-32">
                    <div className="flex flex-col sm:flex-row items-center justify-between mb-10 gap-6">
                        <div className="space-y-2">
                             <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">Artifact Registry</h2>
                             <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Sovereign Interrogation History</p>
                        </div>
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                            <input 
                                type="text" 
                                placeholder="Search sessions..." 
                                value={archiveSearch}
                                onChange={e => setArchiveSearch(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-12 pr-6 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-4 scrollbar-hide">
                        {isLoading && pastInterviews.length === 0 ? (
                            <div className="py-20 flex flex-col items-center gap-4 text-indigo-400">
                                <Loader2 className="animate-spin" size={32}/>
                                <p className="text-[10px] font-black uppercase tracking-widest">Paging Registry...</p>
                            </div>
                        ) : pastInterviews.length === 0 ? (
                            <div className="py-20 flex flex-col items-center justify-center text-slate-700 gap-4 opacity-40">
                                <SearchX size={64}/>
                                <p className="text-sm font-bold uppercase tracking-widest">No artifacts located</p>
                            </div>
                        ) : (
                            pastInterviews.filter(i => i.mode.includes(archiveSearch) || i.jobDescription.includes(archiveSearch)).map(rec => (
                                <div key={rec.id} className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 flex flex-col md:flex-row items-center justify-between gap-8 hover:border-indigo-500/30 transition-all shadow-xl group">
                                    <div className="flex items-center gap-6 flex-1 min-w-0">
                                        <div className="w-20 h-14 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center text-slate-700 relative overflow-hidden shrink-0 group-hover:border-indigo-500/20 transition-colors">
                                             <FileVideo size={24}/>
                                             <button onClick={() => handlePlayback(rec)} disabled={resolvingId === rec.id} className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                 {resolvingId === rec.id ? <Loader2 className="animate-spin text-white" size={16}/> : <Play size={20} fill="white" className="text-white"/>}
                                             </button>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="text-lg font-bold text-white truncate">{rec.mode.toUpperCase()} SCREEN</h3>
                                                <span className="text-[8px] font-black text-indigo-400 bg-indigo-900/30 px-2 py-0.5 rounded border border-indigo-500/20 uppercase">{rec.language}</span>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                                                <span className="flex items-center gap-1.5"><Calendar size={14} className="text-indigo-400"/> {new Date(rec.timestamp).toLocaleDateString()}</span>
                                                <span className="flex items-center gap-1.5 font-mono text-[10px] text-slate-600">ID: {rec.id.substring(0,12)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border shadow-lg ${
                                            rec.feedback.toLowerCase().includes('strong hire') ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 
                                            rec.feedback.toLowerCase().includes('hire') ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30' : 'bg-red-900/20 text-red-400 border-red-500/30'
                                        }`}>
                                            {rec.feedback || 'Incomplete'}
                                        </div>
                                        {isYouTubeUrl(rec.videoUrl) ? (
                                            <a href={rec.videoUrl} target="_blank" rel="noreferrer" className="p-3 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-xl transition-all border border-red-500/20" title="Watch on YouTube"><Youtube size={20}/></a>
                                        ) : isDriveUrl(rec.videoUrl) ? (
                                            <button onClick={() => handlePlayback(rec)} className="p-3 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-xl transition-all border border-indigo-500/20" title="Stream from Drive"><HardDrive size={20}/></button>
                                        ) : null}
                                        <button onClick={() => { if(confirm("Purge artifact?")) deleteInterview(rec.id).then(loadData) }} className="p-3 bg-slate-800 hover:bg-red-600 text-slate-500 hover:text-white rounded-xl transition-all"><Trash2 size={20}/></button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </header>

        <main className="flex-1 overflow-hidden relative flex flex-col items-center">
            {isLoading && (
                <div className="absolute inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center gap-8 animate-fade-in">
                    <div className="relative">
                        <div className="w-24 h-24 border-4 border-indigo-500/10 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Zap size={32} className="text-indigo-400 animate-pulse" />
                        </div>
                    </div>
                    <div className="text-center space-y-2">
                        <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Initializing Refraction</h3>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Provisioning Socratic Environment...</p>
                    </div>
                </div>
            )}

            {view === 'selection' && (
                <div className="max-w-4xl w-full p-8 md:p-16 h-full flex flex-col justify-center gap-12 animate-fade-in-up">
                    <div className="text-center space-y-4">
                        <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">The Interrogator</h2>
                        <p className="text-lg text-slate-400 font-medium max-w-xl mx-auto leading-relaxed">Refining engineering talent through technical friction and Staff-level peer evaluation.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {PERSONAS.map(p => (
                            <button 
                                key={p.id}
                                onClick={() => setSelectedPersona(p)}
                                className={`p-8 rounded-[3rem] border transition-all text-left flex flex-col gap-4 relative overflow-hidden group ${selectedPersona.id === p.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-2xl scale-[1.02]' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-indigo-500/40'}`}
                            >
                                <div className={`p-4 rounded-3xl w-fit ${selectedPersona.id === p.id ? 'bg-indigo-500' : 'bg-slate-950'} transition-colors`}>
                                    <p.icon size={32} className={selectedPersona.id === p.id ? 'text-white' : 'text-indigo-500'} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black uppercase tracking-tight leading-none mb-2">{p.name}</h3>
                                    <p className="text-xs font-medium opacity-60 leading-relaxed">{p.desc}</p>
                                </div>
                                {selectedPersona.id === p.id && <div className="absolute -right-4 -bottom-4 p-8 bg-white/10 rounded-full blur-2xl"></div>}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-col items-center gap-6">
                        <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 shadow-xl">
                            {(['coding', 'system_design', 'behavioral', 'quick_screen'] as const).map(m => (
                                <button key={m} onClick={() => setInterviewMode(m)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${interviewMode === m ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-200'}`}>{m.replace('_', ' ')}</button>
                            ))}
                        </div>
                        <button onClick={() => setView('setup')} className="px-12 py-5 bg-white text-slate-950 font-black uppercase tracking-[0.3em] rounded-2xl shadow-2xl shadow-indigo-900/40 transition-transform hover:scale-105 active:scale-95 flex items-center gap-3">
                            <span>Proceed to Setup</span>
                            <ChevronRight size={20}/>
                        </button>
                    </div>
                </div>
            )}

            {view === 'setup' && (
                <div className="max-w-xl w-full p-8 md:p-12 h-full flex flex-col justify-center gap-10 animate-fade-in-up">
                    <div className="space-y-2">
                        <button onClick={() => setView('selection')} className="flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-white transition-colors mb-4"><ArrowLeft size={14}/> Back to Selection</button>
                        <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">Environmental Config</h2>
                        <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Establishing Socratic Context</p>
                    </div>

                    <div className="space-y-8 bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-16 bg-red-500/5 blur-[80px] rounded-full pointer-events-none"></div>
                        
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Primary Code Refraction (Language)</label>
                            <div className="grid grid-cols-2 gap-2">
                                {(['c++', 'python', 'javascript', 'java'] as const).map(l => (
                                    <button key={l} onClick={() => setInterviewLanguage(l)} className={`py-3 rounded-xl border text-xs font-black uppercase transition-all ${interviewLanguage === l ? 'bg-red-600 border-red-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-600'}`}>{l}</button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Job Context (Target Narrative)</label>
                            <textarea 
                                value={jobDescription} 
                                onChange={e => setJobDescription(e.target.value)} 
                                rows={4}
                                placeholder="Paste job requirements or 'L6 Staff Engineer at Amazon'..."
                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white outline-none focus:ring-2 focus:ring-red-500 shadow-inner resize-none leading-relaxed"
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Temporal Shift (Duration)</label>
                            <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
                                {[15, 30, 45, 60].map(m => (
                                    <button key={m} onClick={() => setInterviewDuration(m)} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${interviewDuration === m ? 'bg-red-600 text-white shadow-lg' : 'text-slate-50'}`}>{m}m</button>
                                ))}
                            </div>
                        </div>

                        <button onClick={handleStartInterview} className="w-full py-5 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-red-900/40 transition-all active:scale-95 flex items-center justify-center gap-3">
                            <Play size={20} fill="currentColor"/> Begin Interrogation
                        </button>
                    </div>
                </div>
            )}

            {view === 'active' && (
                <div className="h-full w-full flex animate-fade-in relative">
                    <div className={`fixed bottom-24 right-6 z-[100] transition-all duration-500 transform ${isMirrorMinimized ? 'translate-x-20 scale-50 opacity-20' : 'translate-x-0 scale-100'}`}>
                        <div className={`relative group ${pipSize === 'compact' ? 'w-32 h-32' : 'w-56 h-56'}`}>
                            <div className="absolute -inset-1 bg-gradient-to-r from-red-500 to-indigo-600 rounded-full blur opacity-40 group-hover:opacity-100 transition duration-1000"></div>
                            <div className="relative w-full h-full bg-slate-900 rounded-full border-4 border-red-500/50 overflow-hidden shadow-2xl">
                                <video 
                                    ref={mirrorVideoRef}
                                    autoPlay 
                                    playsInline 
                                    muted 
                                    className="w-full h-full object-cover transform scale-110"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
                                <div className="absolute top-2 left-1/2 -translate-x-1/2">
                                    <div className="bg-red-600 text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-full shadow-lg border border-red-400/50 whitespace-nowrap">Neural Mirror</div>
                                </div>
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-1/2 h-1 overflow-hidden rounded-full"><Visualizer volume={volume} isActive={isLive} color="#ffffff" /></div>
                                <button 
                                    onClick={() => setIsMirrorMinimized(!isMirrorMinimized)}
                                    className="absolute bottom-2 left-1/2 -translate-x-1/2 p-1.5 bg-black/40 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                                >
                                    {isMirrorMinimized ? <Maximize2 size={12}/> : <Minimize2 size={12}/>}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 min-w-0">
                        <CodeStudio 
                            onBack={() => {}} 
                            currentUser={currentUser} 
                            userProfile={userProfile} 
                            isProMember={true} 
                            isInterviewerMode={true}
                            initialFiles={files}
                            onFileChange={(f) => setFiles(prev => prev.map(p => p.path === f.path ? f : p))}
                            externalChatContent={transcript}
                            isAiThinking={!isAiConnected && isLive}
                            onSyncCodeWithAi={(f) => {
                                addApiLog(`Forced Code Sync: ${f.name}`, 'info');
                                serviceRef.current?.sendText(`NEURAL_SNAPSHOT_SYNC: User forced a code update for ${f.name}. CONTENT: \n\`\`\`\n${f.content}\n\`\`\``);
                            }}
                            onSessionStart={() => {}}
                            onSessionStop={() => {}}
                            onStartLiveSession={(chan, ctx) => onStartLiveSession(chan, ctx)}
                        />
                    </div>
                </div>
            )}

            {view === 'feedback' && report && (
                <div className="h-full w-full overflow-y-auto p-12 bg-[#020617] scrollbar-hide">
                    <div className="max-w-4xl mx-auto space-y-16">
                        <div className="text-center space-y-4">
                            <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">Evaluation Refraction</h2>
                            <p className="text-slate-500 font-bold uppercase tracking-[0.4em] pt-2">Session Integrity: 100% Validated</p>
                        </div>
                        <EvaluationReportDisplay 
                            report={report} 
                            onSyncYouTube={() => performSyncToYouTube(report.id, report.videoBlob!, { mode: interviewMode, language: interviewLanguage })}
                            onSyncDrive={() => performSyncToDrive(report.id, report.videoBlob!, { mode: interviewMode })}
                            isSyncing={isUploadingRecording}
                        />
                    </div>
                </div>
            )}

            {view === 'archive' && (
                <div className="max-w-6xl w-full p-8 md:p-12 h-full flex flex-col animate-fade-in pb-32">
                    <div className="flex flex-col sm:flex-row items-center justify-between mb-10 gap-6">
                        <div className="space-y-2">
                             <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">Artifact Registry</h2>
                             <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Sovereign Interrogation History</p>
                        </div>
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                            <input 
                                type="text" 
                                placeholder="Search sessions..." 
                                value={archiveSearch}
                                onChange={e => setArchiveSearch(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-12 pr-6 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-4 scrollbar-hide">
                        {isLoading && pastInterviews.length === 0 ? (
                            <div className="py-20 flex flex-col items-center gap-4 text-indigo-400">
                                <Loader2 className="animate-spin" size={32}/>
                                <p className="text-[10px] font-black uppercase tracking-widest">Paging Registry...</p>
                            </div>
                        ) : pastInterviews.length === 0 ? (
                            <div className="py-20 flex flex-col items-center justify-center text-slate-700 gap-4 opacity-40">
                                <SearchX size={64}/>
                                <p className="text-sm font-bold uppercase tracking-widest">No artifacts located</p>
                            </div>
                        ) : (
                            pastInterviews.filter(i => i.mode.includes(archiveSearch) || i.jobDescription.includes(archiveSearch)).map(rec => (
                                <div key={rec.id} className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 flex flex-col md:flex-row items-center justify-between gap-8 hover:border-indigo-500/30 transition-all shadow-xl group">
                                    <div className="flex items-center gap-6 flex-1 min-w-0">
                                        <div className="w-20 h-14 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center text-slate-700 relative overflow-hidden shrink-0 group-hover:border-indigo-500/20 transition-colors">
                                             <FileVideo size={24}/>
                                             <button onClick={() => handlePlayback(rec)} disabled={resolvingId === rec.id} className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                 {resolvingId === rec.id ? <Loader2 className="animate-spin text-white" size={16}/> : <Play size={20} fill="white" className="text-white"/>}
                                             </button>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="text-lg font-bold text-white truncate">{rec.mode.toUpperCase()} SCREEN</h3>
                                                <span className="text-[8px] font-black text-indigo-400 bg-indigo-900/30 px-2 py-0.5 rounded border border-indigo-500/20 uppercase">{rec.language}</span>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                                                <span className="flex items-center gap-1.5"><Calendar size={14} className="text-indigo-400"/> {new Date(rec.timestamp).toLocaleDateString()}</span>
                                                <span className="flex items-center gap-1.5 font-mono text-[10px] text-slate-600">ID: {rec.id.substring(0,12)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border shadow-lg ${
                                            rec.feedback.toLowerCase().includes('strong hire') ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 
                                            rec.feedback.toLowerCase().includes('hire') ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30' : 'bg-red-900/20 text-red-400 border-red-500/30'
                                        }`}>
                                            {rec.feedback || 'Incomplete'}
                                        </div>
                                        {isYouTubeUrl(rec.videoUrl) ? (
                                            <a href={rec.videoUrl} target="_blank" rel="noreferrer" className="p-3 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-xl transition-all border border-red-500/20" title="Watch on YouTube"><Youtube size={20}/></a>
                                        ) : isDriveUrl(rec.videoUrl) ? (
                                            <button onClick={() => handlePlayback(rec)} className="p-3 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-xl transition-all border border-indigo-500/20" title="Stream from Drive"><HardDrive size={20}/></button>
                                        ) : null}
                                        <button onClick={() => { if(confirm("Purge artifact?")) deleteInterview(rec.id).then(loadData) }} className="p-3 bg-slate-800 hover:bg-red-600 text-slate-500 hover:text-white rounded-xl transition-all"><Trash2 size={20}/></button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </header>

        <main className="flex-1 overflow-hidden relative flex flex-col items-center">
            {isLoading && (
                <div className="absolute inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center gap-8 animate-fade-in">
                    <div className="relative">
                        <div className="w-24 h-24 border-4 border-indigo-500/10 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Zap size={32} className="text-indigo-400 animate-pulse" />
                        </div>
                    </div>
                    <div className="text-center space-y-2">
                        <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Initializing Refraction</h3>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Provisioning Socratic Environment...</p>
                    </div>
                </div>
            )}

            {view === 'selection' && (
                <div className="max-w-4xl w-full p-8 md:p-16 h-full flex flex-col justify-center gap-12 animate-fade-in-up">
                    <div className="text-center space-y-4">
                        <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">The Interrogator</h2>
                        <p className="text-lg text-slate-400 font-medium max-w-xl mx-auto leading-relaxed">Refining engineering talent through technical friction and Staff-level peer evaluation.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {PERSONAS.map(p => (
                            <button 
                                key={p.id}
                                onClick={() => setSelectedPersona(p)}
                                className={`p-8 rounded-[3rem] border transition-all text-left flex flex-col gap-4 relative overflow-hidden group ${selectedPersona.id === p.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-2xl scale-[1.02]' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-indigo-500/40'}`}
                            >
                                <div className={`p-4 rounded-3xl w-fit ${selectedPersona.id === p.id ? 'bg-indigo-500' : 'bg-slate-950'} transition-colors`}>
                                    <p.icon size={32} className={selectedPersona.id === p.id ? 'text-white' : 'text-indigo-500'} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black uppercase tracking-tight leading-none mb-2">{p.name}</h3>
                                    <p className="text-xs font-medium opacity-60 leading-relaxed">{p.desc}</p>
                                </div>
                                {selectedPersona.id === p.id && <div className="absolute -right-4 -bottom-4 p-8 bg-white/10 rounded-full blur-2xl"></div>}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-col items-center gap-6">
                        <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 shadow-xl">
                            {(['coding', 'system_design', 'behavioral', 'quick_screen'] as const).map(m => (
                                <button key={m} onClick={() => setInterviewMode(m)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${interviewMode === m ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-200'}`}>{m.replace('_', ' ')}</button>
                            ))}
                        </div>
                        <button onClick={() => setView('setup')} className="px-12 py-5 bg-white text-slate-950 font-black uppercase tracking-[0.3em] rounded-2xl shadow-2xl shadow-indigo-900/40 transition-transform hover:scale-105 active:scale-95 flex items-center gap-3">
                            <span>Proceed to Setup</span>
                            <ChevronRight size={20}/>
                        </button>
                    </div>
                </div>
            )}

            {view === 'setup' && (
                <div className="max-w-xl w-full p-8 md:p-12 h-full flex flex-col justify-center gap-10 animate-fade-in-up">
                    <div className="space-y-2">
                        <button onClick={() => setView('selection')} className="flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-white transition-colors mb-4"><ArrowLeft size={14}/> Back to Selection</button>
                        <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">Environmental Config</h2>
                        <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Establishing Socratic Context</p>
                    </div>

                    <div className="space-y-8 bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-16 bg-red-500/5 blur-[80px] rounded-full pointer-events-none"></div>
                        
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Primary Code Refraction (Language)</label>
                            <div className="grid grid-cols-2 gap-2">
                                {(['c++', 'python', 'javascript', 'java'] as const).map(l => (
                                    <button key={l} onClick={() => setInterviewLanguage(l)} className={`py-3 rounded-xl border text-xs font-black uppercase transition-all ${interviewLanguage === l ? 'bg-red-600 border-red-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-600'}`}>{l}</button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Job Context (Target Narrative)</label>
                            <textarea 
                                value={jobDescription} 
                                onChange={e => setJobDescription(e.target.value)} 
                                rows={4}
                                placeholder="Paste job requirements or 'L6 Staff Engineer at Amazon'..."
                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white outline-none focus:ring-2 focus:ring-red-500 shadow-inner resize-none leading-relaxed"
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Temporal Shift (Duration)</label>
                            <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
                                {[15, 30, 45, 60].map(m => (
                                    <button key={m} onClick={() => setInterviewDuration(m)} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${interviewDuration === m ? 'bg-red-600 text-white shadow-lg' : 'text-slate-50'}`}>{m}m</button>
                                ))}
                            </div>
                        </div>

                        <button onClick={handleStartInterview} className="w-full py-5 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-red-900/40 transition-all active:scale-95 flex items-center justify-center gap-3">
                            <Play size={20} fill="currentColor"/> Begin Interrogation
                        </button>
                    </div>
                </div>
            )}

            {view === 'active' && (
                <div className="h-full w-full flex animate-fade-in relative">
                    <div className={`fixed bottom-24 right-6 z-[100] transition-all duration-500 transform ${isMirrorMinimized ? 'translate-x-20 scale-50 opacity-20' : 'translate-x-0 scale-100'}`}>
                        <div className={`relative group ${pipSize === 'compact' ? 'w-32 h-32' : 'w-56 h-56'}`}>
                            <div className="absolute -inset-1 bg-gradient-to-r from-red-500 to-indigo-600 rounded-full blur opacity-40 group-hover:opacity-100 transition duration-1000"></div>
                            <div className="relative w-full h-full bg-slate-900 rounded-full border-4 border-red-500/50 overflow-hidden shadow-2xl">
                                <video 
                                    ref={mirrorVideoRef}
                                    autoPlay 
                                    playsInline 
                                    muted 
                                    className="w-full h-full object-cover transform scale-110"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
                                <div className="absolute top-2 left-1/2 -translate-x-1/2">
                                    <div className="bg-red-600 text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-full shadow-lg border border-red-400/50 whitespace-nowrap">Neural Mirror</div>
                                </div>
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-1/2 h-1 overflow-hidden rounded-full"><Visualizer volume={volume} isActive={isLive} color="#ffffff" /></div>
                                <button 
                                    onClick={() => setIsMirrorMinimized(!isMirrorMinimized)}
                                    className="absolute bottom-2 left-1/2 -translate-x-1/2 p-1.5 bg-black/40 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                                >
                                    {isMirrorMinimized ? <Maximize2 size={12}/> : <Minimize2 size={12}/>}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 min-w-0">
                        <CodeStudio 
                            onBack={() => {}} 
                            currentUser={currentUser} 
                            userProfile={userProfile} 
                            isProMember={true} 
                            isInterviewerMode={true}
                            initialFiles={files}
                            onFileChange={(f) => setFiles(prev => prev.map(p => p.path === f.path ? f : p))}
                            externalChatContent={transcript}
                            isAiThinking={!isAiConnected && isLive}
                            onSyncCodeWithAi={(f) => {
                                addApiLog(`Forced Code Sync: ${f.name}`, 'info');
                                serviceRef.current?.sendText(`NEURAL_SNAPSHOT_SYNC: User forced a code update for ${f.name}. CONTENT: \n\`\`\`\n${f.content}\n\`\`\``);
                            }}
                            onSessionStart={() => {}}
                            onSessionStop={() => {}}
                            onStartLiveSession={(chan, ctx) => onStartLiveSession(chan, ctx)}
                        />
                    </div>
                </div>
            )}

            {view === 'feedback' && report && (
                <div className="h-full w-full overflow-y-auto p-12 bg-[#020617] scrollbar-hide">
                    <div className="max-w-4xl mx-auto space-y-16">
                        <div className="text-center space-y-4">
                            <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">Evaluation Refraction</h2>
                            <p className="text-slate-500 font-bold uppercase tracking-[0.4em] pt-2">Session Integrity: 100% Validated</p>
                        </div>
                        <EvaluationReportDisplay 
                            report={report} 
                            onSyncYouTube={() => performSyncToYouTube(report.id, report.videoBlob!, { mode: interviewMode, language: interviewLanguage })}
                            onSyncDrive={() => performSyncToDrive(report.id, report.videoBlob!, { mode: interviewMode })}
                            isSyncing={isUploadingRecording}
                        />
                    </div>
                </div>
            )}

            {view === 'archive' && (
                <div className="max-w-6xl w-full p-8 md:p-12 h-full flex flex-col animate-fade-in pb-32">
                    <div className="flex flex-col sm:flex-row items-center justify-between mb-10 gap-6">
                        <div className="space-y-2">
                             <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">Artifact Registry</h2>
                             <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Sovereign Interrogation History</p>
                        </div>
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                            <input 
                                type="text" 
                                placeholder="Search sessions..." 
                                value={archiveSearch}
                                onChange={e => setArchiveSearch(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-12 pr-6 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-4 scrollbar-hide">
                        {isLoading && pastInterviews.length === 0 ? (
                            <div className="py-20 flex flex-col items-center gap-4 text-indigo-400">
                                <Loader2 className="animate-spin" size={32}/>
                                <p className="text-[10px] font-black uppercase tracking-widest">Paging Registry...</p>
                            </div>
                        ) : pastInterviews.length === 0 ? (
                            <div className="py-20 flex flex-col items-center justify-center text-slate-700 gap-4 opacity-40">
                                <SearchX size={64}/>
                                <p className="text-sm font-bold uppercase tracking-widest">No artifacts located</p>
                            </div>
                        ) : (
                            pastInterviews.filter(i => i.mode.includes(archiveSearch) || i.jobDescription.includes(archiveSearch)).map(rec => (
                                <div key={rec.id} className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 flex flex-col md:flex-row items-center justify-between gap-8 hover:border-indigo-500/30 transition-all shadow-xl group">
                                    <div className="flex items-center gap-6 flex-1 min-w-0">
                                        <div className="w-20 h-14 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center text-slate-700 relative overflow-hidden shrink-0 group-hover:border-indigo-500/20 transition-colors">
                                             <FileVideo size={24}/>
                                             <button onClick={() => handlePlayback(rec)} disabled={resolvingId === rec.id} className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                 {resolvingId === rec.id ? <Loader2 className="animate-spin text-white" size={16}/> : <Play size={20} fill="white" className="text-white"/>}
                                             </button>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="text-lg font-bold text-white truncate">{rec.mode.toUpperCase()} SCREEN</h3>
                                                <span className="text-[8px] font-black text-indigo-400 bg-indigo-900/30 px-2 py-0.5 rounded border border-indigo-500/20 uppercase">{rec.language}</span>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                                                <span className="flex items-center gap-1.5"><Calendar size={14} className="text-indigo-400"/> {new Date(rec.timestamp).toLocaleDateString()}</span>
                                                <span className="flex items-center gap-1.5 font-mono text-[10px] text-slate-600">ID: {rec.id.substring(0,12)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border shadow-lg ${
                                            rec.feedback.toLowerCase().includes('strong hire') ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 
                                            rec.feedback.toLowerCase().includes('hire') ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30' : 'bg-red-900/20 text-red-400 border-red-500/30'
                                        }`}>
                                            {rec.feedback || 'Incomplete'}
                                        </div>
                                        {isYouTubeUrl(rec.videoUrl) ? (
                                            <a href={rec.videoUrl} target="_blank" rel="noreferrer" className="p-3 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-xl transition-all border border-red-500/20" title="Watch on YouTube"><Youtube size={20}/></a>
                                        ) : isDriveUrl(rec.videoUrl) ? (
                                            <button onClick={() => handlePlayback(rec)} className="p-3 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-xl transition-all border border-indigo-500/20" title="Stream from Drive"><HardDrive size={20}/></button>
                                        ) : null}
                                        <button onClick={() => { if(confirm("Purge artifact?")) deleteInterview(rec.id).then(loadData) }} className="p-3 bg-slate-800 hover:bg-red-600 text-slate-500 hover:text-white rounded-xl transition-all"><Trash2 size={20}/></button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </header>

        <main className="flex-1 overflow-hidden relative flex flex-col items-center">
            {isLoading && (
                <div className="absolute inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center gap-8 animate-fade-in">
                    <div className="relative">
                        <div className="w-24 h-24 border-4 border-indigo-500/10 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Zap size={32} className="text-indigo-400 animate-pulse" />
                        </div>
                    </div>
                    <div className="text-center space-y-2">
                        <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Initializing Refraction</h3>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Provisioning Socratic Environment...</p>
                    </div>
                </div>
            )}

            {view === 'selection' && (
                <div className="max-w-4xl w-full p-8 md:p-16 h-full flex flex-col justify-center gap-12 animate-fade-in-up">
                    <div className="text-center space-y-4">
                        <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">The Interrogator</h2>
                        <p className="text-lg text-slate-400 font-medium max-w-xl mx-auto leading-relaxed">Refining engineering talent through technical friction and Staff-level peer evaluation.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {PERSONAS.map(p => (
                            <button 
                                key={p.id}
                                onClick={() => setSelectedPersona(p)}
                                className={`p-8 rounded-[3rem] border transition-all text-left flex flex-col gap-4 relative overflow-hidden group ${selectedPersona.id === p.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-2xl scale-[1.02]' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-indigo-500/40'}`}
                            >
                                <div className={`p-4 rounded-3xl w-fit ${selectedPersona.id === p.id ? 'bg-indigo-500' : 'bg-slate-950'} transition-colors`}>
                                    <p.icon size={32} className={selectedPersona.id === p.id ? 'text-white' : 'text-indigo-500'} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black uppercase tracking-tight leading-none mb-2">{p.name}</h3>
                                    <p className="text-xs font-medium opacity-60 leading-relaxed">{p.desc}</p>
                                </div>
                                {selectedPersona.id === p.id && <div className="absolute -right-4 -bottom-4 p-8 bg-white/10 rounded-full blur-2xl"></div>}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-col items-center gap-6">
                        <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 shadow-xl">
                            {(['coding', 'system_design', 'behavioral', 'quick_screen'] as const).map(m => (
                                <button key={m} onClick={() => setInterviewMode(m)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${interviewMode === m ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-200'}`}>{m.replace('_', ' ')}</button>
                            ))}
                        </div>
                        <button onClick={() => setView('setup')} className="px-12 py-5 bg-white text-slate-950 font-black uppercase tracking-[0.3em] rounded-2xl shadow-2xl shadow-indigo-900/40 transition-transform hover:scale-105 active:scale-95 flex items-center gap-3">
                            <span>Proceed to Setup</span>
                            <ChevronRight size={20}/>
                        </button>
                    </div>
                </div>
            )}

            {view === 'setup' && (
                <div className="max-w-xl w-full p-8 md:p-12 h-full flex flex-col justify-center gap-10 animate-fade-in-up">
                    <div className="space-y-2">
                        <button onClick={() => setView('selection')} className="flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-white transition-colors mb-4"><ArrowLeft size={14}/> Back to Selection</button>
                        <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">Environmental Config</h2>
                        <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Establishing Socratic Context</p>
                    </div>

                    <div className="space-y-8 bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-16 bg-red-500/5 blur-[80px] rounded-full pointer-events-none"></div>
                        
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Primary Code Refraction (Language)</label>
                            <div className="grid grid-cols-2 gap-2">
                                {(['c++', 'python', 'javascript', 'java'] as const).map(l => (
                                    <button key={l} onClick={() => setInterviewLanguage(l)} className={`py-3 rounded-xl border text-xs font-black uppercase transition-all ${interviewLanguage === l ? 'bg-red-600 border-red-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-600'}`}>{l}</button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Job Context (Target Narrative)</label>
                            <textarea 
                                value={jobDescription} 
                                onChange={e => setJobDescription(e.target.value)} 
                                rows={4}
                                placeholder="Paste job requirements or 'L6 Staff Engineer at Amazon'..."
                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white outline-none focus:ring-2 focus:ring-red-500 shadow-inner resize-none leading-relaxed"
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Temporal Shift (Duration)</label>
                            <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
                                {[15, 30, 45, 60].map(m => (
                                    <button key={m} onClick={() => setInterviewDuration(m)} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${interviewDuration === m ? 'bg-red-600 text-white shadow-lg' : 'text-slate-50'}`}>{m}m</button>
                                ))}
                            </div>
                        </div>

                        <button onClick={handleStartInterview} className="w-full py-5 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-red-900/40 transition-all active:scale-95 flex items-center justify-center gap-3">
                            <Play size={20} fill="currentColor"/> Begin Interrogation
                        </button>
                    </div>
                </div>
            )}

            {view === 'active' && (
                <div className="h-full w-full flex animate-fade-in relative">
                    <div className={`fixed bottom-24 right-6 z-[100] transition-all duration-500 transform ${isMirrorMinimized ? 'translate-x-20 scale-50 opacity-20' : 'translate-x-0 scale-100'}`}>
                        <div className={`relative group ${pipSize === 'compact' ? 'w-32 h-32' : 'w-56 h-56'}`}>
                            <div className="absolute -inset-1 bg-gradient-to-r from-red-500 to-indigo-600 rounded-full blur opacity-40 group-hover:opacity-100 transition duration-1000"></div>
                            <div className="relative w-full h-full bg-slate-900 rounded-full border-4 border-red-500/50 overflow-hidden shadow-2xl">
                                <video 
                                    ref={mirrorVideoRef}
                                    autoPlay 
                                    playsInline 
                                    muted 
                                    className="w-full h-full object-cover transform scale-110"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
                                <div className="absolute top-2 left-1/2 -translate-x-1/2">
                                    <div className="bg-red-600 text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-full shadow-lg border border-red-400/50 whitespace-nowrap">Neural Mirror</div>
                                </div>
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-1/2 h-1 overflow-hidden rounded-full"><Visualizer volume={volume} isActive={isLive} color="#ffffff" /></div>
                                <button 
                                    onClick={() => setIsMirrorMinimized(!isMirrorMinimized)}
                                    className="absolute bottom-2 left-1/2 -translate-x-1/2 p-1.5 bg-black/40 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                                >
                                    {isMirrorMinimized ? <Maximize2 size={12}/> : <Minimize2 size={12}/>}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 min-w-0">
                        <CodeStudio 
                            onBack={() => {}} 
                            currentUser={currentUser} 
                            userProfile={userProfile} 
                            isProMember={true} 
                            isInterviewerMode={true}
                            initialFiles={files}
                            onFileChange={(f) => setFiles(prev => prev.map(p => p.path === f.path ? f : p))}
                            externalChatContent={transcript}
                            isAiThinking={!isAiConnected && isLive}
                            onSyncCodeWithAi={(f) => {
                                addApiLog(`Forced Code Sync: ${f.name}`, 'info');
                                serviceRef.current?.sendText(`NEURAL_SNAPSHOT_SYNC: User forced a code update for ${f.name}. CONTENT: \n\`\`\`\n${f.content}\n\`\`\``);
                            }}
                            onSessionStart={() => {}}
                            onSessionStop={() => {}}
                            onStartLiveSession={(chan, ctx) => onStartLiveSession(chan, ctx)}
                        />
                    </div>
                </div>
            )}

            {view === 'feedback' && report && (
                <div className="h-full w-full overflow-y-auto p-12 bg-[#020617] scrollbar-hide">
                    <div className="max-w-4xl mx-auto space-y-16">
                        <div className="text-center space-y-4">
                            <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">Evaluation Refraction</h2>
                            <p className="text-slate-500 font-bold uppercase tracking-[0.4em] pt-2">Session Integrity: 100% Validated</p>
                        </div>
                        <EvaluationReportDisplay 
                            report={report} 
                            onSyncYouTube={() => performSyncToYouTube(report.id, report.videoBlob!, { mode: interviewMode, language: interviewLanguage })}
                            onSyncDrive={() => performSyncToDrive(report.id, report.videoBlob!, { mode: interviewMode })}
                            isSyncing={isUploadingRecording}
                        />
                    </div>
                </div>
            )}

            {view === 'archive' && (
                <div className="max-w-6xl w-full p-8 md:p-12 h-full flex flex-col animate-fade-in pb-32">
                    <div className="flex flex-col sm:flex-row items-center justify-between mb-10 gap-6">
                        <div className="space-y-2">
                             <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">Artifact Registry</h2>
                             <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Sovereign Interrogation History</p>
                        </div>
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                            <input 
                                type="text" 
                                placeholder="Search sessions..." 
                                value={archiveSearch}
                                onChange={e => setArchiveSearch(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-12 pr-6 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-4 scrollbar-hide">
                        {isLoading && pastInterviews.length === 0 ? (
                            <div className="py-20 flex flex-col items-center gap-4 text-indigo-400">
                                <Loader2 className="animate-spin" size={32}/>
                                <p className="text-[10px] font-black uppercase tracking-widest">Paging Registry...</p>
                            </div>
                        ) : pastInterviews.length === 0 ? (
                            <div className="py-20 flex flex-col items-center justify-center text-slate-700 gap-4 opacity-40">
                                <SearchX size={64}/>
                                <p className="text-sm font-bold uppercase tracking-widest">No artifacts located</p>
                            </div>
                        ) : (
                            pastInterviews.filter(i => i.mode.includes(archiveSearch) || i.jobDescription.includes(archiveSearch)).map(rec => (
                                <div key={rec.id} className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 flex flex-col md:flex-row items-center justify-between gap-8 hover:border-indigo-500/30 transition-all shadow-xl group">
                                    <div className="flex items-center gap-6 flex-1 min-w-0">
                                        <div className="w-20 h-14 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center text-slate-700 relative overflow-hidden shrink-0 group-hover:border-indigo-500/20 transition-colors">
                                             <FileVideo size={24}/>
                                             <button onClick={() => handlePlayback(rec)} disabled={resolvingId === rec.id} className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                 {resolvingId === rec.id ? <Loader2 className="animate-spin text-white" size={16}/> : <Play size={20} fill="white" className="text-white"/>}
                                             </button>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="text-lg font-bold text-white truncate">{rec.mode.toUpperCase()} SCREEN</h3>
                                                <span className="text-[8px] font-black text-indigo-400 bg-indigo-900/30 px-2 py-0.5 rounded border border-indigo-500/20 uppercase">{rec.language}</span>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                                                <span className="flex items-center gap-1.5"><Calendar size={14} className="text-indigo-400"/> {new Date(rec.timestamp).toLocaleDateString()}</span>
                                                <span className="flex items-center gap-1.5 font-mono text-[10px] text-slate-600">ID: {rec.id.substring(0,12)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border shadow-lg ${
                                            rec.feedback.toLowerCase().includes('strong hire') ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 
                                            rec.feedback.toLowerCase().includes('hire') ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30' : 'bg-red-900/20 text-red-400 border-red-500/30'
                                        }`}>
                                            {rec.feedback || 'Incomplete'}
                                        </div>
                                        {isYouTubeUrl(rec.videoUrl) ? (
                                            <a href={rec.videoUrl} target="_blank" rel="noreferrer" className="p-3 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-xl transition-all border border-red-500/20" title="Watch on YouTube"><Youtube size={20}/></a>
                                        ) : isDriveUrl(rec.videoUrl) ? (
                                            <button onClick={() => handlePlayback(rec)} className="p-3 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-xl transition-all border border-indigo-500/20" title="Stream from Drive"><HardDrive size={20}/></button>
                                        ) : null}
                                        <button onClick={() => { if(confirm("Purge artifact?")) deleteInterview(rec.id).then(loadData) }} className="p-3 bg-slate-800 hover:bg-red-600 text-slate-500 hover:text-white rounded-xl transition-all"><Trash2 size={20}/></button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </header>

        <main className="flex-1 overflow-hidden relative flex flex-col items-center">
            {isLoading && (
                <div className="absolute inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center gap-8 animate-fade-in">
                    <div className="relative">
                        <div className="w-24 h-24 border-4 border-indigo-500/10 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Zap size={32} className="text-indigo-400 animate-pulse" />
                        </div>
                    </div>
                    <div className="text-center space-y-2">
                        <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Initializing Refraction</h3>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Provisioning Socratic Environment...</p>
                    </div>
                </div>
            )}

            {view === 'selection' && (
                <div className="max-w-4xl w-full p-8 md:p-16 h-full flex flex-col justify-center gap-12 animate-fade-in-up">
                    <div className="text-center space-y-4">
                        <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">The Interrogator</h2>
                        <p className="text-lg text-slate-400 font-medium max-w-xl mx-auto leading-relaxed">Refining engineering talent through technical friction and Staff-level peer evaluation.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {PERSONAS.map(p => (
                            <button 
                                key={p.id}
                                onClick={() => setSelectedPersona(p)}
                                className={`p-8 rounded-[3rem] border transition-all text-left flex flex-col gap-4 relative overflow-hidden group ${selectedPersona.id === p.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-2xl scale-[1.02]' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-indigo-500/40'}`}
                            >
                                <div className={`p-4 rounded-3xl w-fit ${selectedPersona.id === p.id ? 'bg-indigo-500' : 'bg-slate-950'} transition-colors`}>
                                    <p.icon size={32} className={selectedPersona.id === p.id ? 'text-white' : 'text-indigo-500'} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black uppercase tracking-tight leading-none mb-2">{p.name}</h3>
                                    <p className="text-xs font-medium opacity-60 leading-relaxed">{p.desc}</p>
                                </div>
                                {selectedPersona.id === p.id && <div className="absolute -right-4 -bottom-4 p-8 bg-white/10 rounded-full blur-2xl"></div>}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-col items-center gap-6">
                        <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 shadow-xl">
                            {(['coding', 'system_design', 'behavioral', 'quick_screen'] as const).map(m => (
                                <button key={m} onClick={() => setInterviewMode(m)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${interviewMode === m ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-200'}`}>{m.replace('_', ' ')}</button>
                            ))}
                        </div>
                        <button onClick={() => setView('setup')} className="px-12 py-5 bg-white text-slate-950 font-black uppercase tracking-[0.3em] rounded-2xl shadow-2xl shadow-indigo-900/40 transition-transform hover:scale-105 active:scale-95 flex items-center gap-3">
                            <span>Proceed to Setup</span>
                            <ChevronRight size={20}/>
                        </button>
                    </div>
                </div>
            )}

            {view === 'setup' && (
                <div className="max-w-xl w-full p-8 md:p-12 h-full flex flex-col justify-center gap-10 animate-fade-in-up">
                    <div className="space-y-2">
                        <button onClick={() => setView('selection')} className="flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-white transition-colors mb-4"><ArrowLeft size={14}/> Back to Selection</button>
                        <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">Environmental Config</h2>
                        <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Establishing Socratic Context</p>
                    </div>

                    <div className="space-y-8 bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-16 bg-red-500/5 blur-[80px] rounded-full pointer-events-none"></div>
                        
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Primary Code Refraction (Language)</label>
                            <div className="grid grid-cols-2 gap-2">
                                {(['c++', 'python', 'javascript', 'java'] as const).map(l => (
                                    <button key={l} onClick={() => setInterviewLanguage(l)} className={`py-3 rounded-xl border text-xs font-black uppercase transition-all ${interviewLanguage === l ? 'bg-red-600 border-red-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-600'}`}>{l}</button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Job Context (Target Narrative)</label>
                            <textarea 
                                value={jobDescription} 
                                onChange={e => setJobDescription(e.target.value)} 
                                rows={4}
                                placeholder="Paste job requirements or 'L6 Staff Engineer at Amazon'..."
                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white outline-none focus:ring-2 focus:ring-red-500 shadow-inner resize-none leading-relaxed"
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Temporal Shift (Duration)</label>
                            <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
                                {[15, 30, 45, 60].map(m => (
                                    <button key={m} onClick={() => setInterviewDuration(m)} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${interviewDuration === m ? 'bg-red-600 text-white shadow-lg' : 'text-slate-50'}`}>{m}m</button>
                                ))}
                            </div>
                        </div>

                        <button onClick={handleStartInterview} className="w-full py-5 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-red-900/40 transition-all active:scale-95 flex items-center justify-center gap-3">
                            <Play size={20} fill="currentColor"/> Begin Interrogation
                        </button>
                    </div>
                </div>
            )}

            {view === 'active' && (
                <div className="h-full w-full flex animate-fade-in relative">
                    <div className={`fixed bottom-24 right-6 z-[100] transition-all duration-500 transform ${isMirrorMinimized ? 'translate-x-20 scale-50 opacity-20' : 'translate-x-0 scale-100'}`}>
                        <div className={`relative group ${pipSize === 'compact' ? 'w-32 h-32' : 'w-56 h-56'}`}>
                            <div className="absolute -inset-1 bg-gradient-to-r from-red-500 to-indigo-600 rounded-full blur opacity-40 group-hover:opacity-100 transition duration-1000"></div>
                            <div className="relative w-full h-full bg-slate-900 rounded-full border-4 border-red-500/50 overflow-hidden shadow-2xl">
                                <video 
                                    ref={mirrorVideoRef}
                                    autoPlay 
                                    playsInline 
                                    muted 
                                    className="w-full h-full object-cover transform scale-110"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
                                <div className="absolute top-2 left-1/2 -translate-x-1/2">
                                    <div className="bg-red-600 text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-full shadow-lg border border-red-400/50 whitespace-nowrap">Neural Mirror</div>
                                </div>
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-1/2 h-1 overflow-hidden rounded-full"><Visualizer volume={volume} isActive={isLive} color="#ffffff" /></div>
                                <button 
                                    onClick={() => setIsMirrorMinimized(!isMirrorMinimized)}
                                    className="absolute bottom-2 left-1/2 -translate-x-1/2 p-1.5 bg-black/40 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                                >
                                    {isMirrorMinimized ? <Maximize2 size={12}/> : <Minimize2 size={12}/>}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 min-w-0">
                        <CodeStudio 
                            onBack={() => {}} 
                            currentUser={currentUser} 
                            userProfile={userProfile} 
                            isProMember={true} 
                            isInterviewerMode={true}
                            initialFiles={files}
                            onFileChange={(f) => setFiles(prev => prev.map(p => p.path === f.path ? f : p))}
                            externalChatContent={transcript}
                            isAiThinking={!isAiConnected && isLive}
                            onSyncCodeWithAi={(f) => {
                                addApiLog(`Forced Code Sync: ${f.name}`, 'info');
                                serviceRef.current?.sendText(`NEURAL_SNAPSHOT_SYNC: User forced a code update for ${f.name}. CONTENT: \n\`\`\`\n${f.content}\n\`\`\``);
                            }}
                            onSessionStart={() => {}}
                            onSessionStop={() => {}}
                            onStartLiveSession={(chan, ctx) => onStartLiveSession(chan, ctx)}
                        />
                    </div>
                </div>
            )}

            {view === 'feedback' && report && (
                <div className="h-full w-full overflow-y-auto p-12 bg-[#020617] scrollbar-hide">
                    <div className="max-w-4xl mx-auto space-y-16">
                        <div className="text-center space-y-4">
                            <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">Evaluation Refraction</h2>
                            <p className="text-slate-500 font-bold uppercase tracking-[0.4em] pt-2">Session Integrity: 100% Validated</p>
                        </div>
                        <EvaluationReportDisplay 
                            report={report} 
                            onSyncYouTube={() => performSyncToYouTube(report.id, report.videoBlob!, { mode: interviewMode, language: interviewLanguage })}
                            onSyncDrive={() => performSyncToDrive(report.id, report.videoBlob!, { mode: interviewMode })}
                            isSyncing={isUploadingRecording}
                        />
                    </div>
                </div>
            )}

            {view === 'archive' && (
                <div className="max-w-6xl w-full p-8 md:p-12 h-full flex flex-col animate-fade-in pb-32">
                    <div className="flex flex-col sm:flex-row items-center justify-between mb-10 gap-6">
                        <div className="space-y-2">
                             <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">Artifact Registry</h2>
                             <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Sovereign Interrogation History</p>
                        </div>
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                            <input 
                                type="text" 
                                placeholder="Search sessions..." 
                                value={archiveSearch}
                                onChange={e => setArchiveSearch(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-12 pr-6 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-4 scrollbar-hide">
                        {isLoading && pastInterviews.length === 0 ? (
                            <div className="py-20 flex flex-col items-center gap-4 text-indigo-400">
                                <Loader2 className="animate-spin" size={32}/>
                                <p className="text-[10px] font-black uppercase tracking-widest">Paging Registry...</p>
                            </div>
                        ) : pastInterviews.length === 0 ? (
                            <div className="py-20 flex flex-col items-center justify-center text-slate-700 gap-4 opacity-40">
                                <SearchX size={64}/>
                                <p className="text-sm font-bold uppercase tracking-widest">No artifacts located</p>
                            </div>
                        ) : (
                            pastInterviews.filter(i => i.mode.includes(archiveSearch) || i.jobDescription.includes(archiveSearch)).map(rec => (
                                <div key={rec.id} className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 flex flex-col md:flex-row items-center justify-between gap-8 hover:border-indigo-500/30 transition-all shadow-xl group">
                                    <div className="flex items-center gap-6 flex-1 min-w-0">
                                        <div className="w-20 h-14 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center text-slate-700 relative overflow-hidden shrink-0 group-hover:border-indigo-500/20 transition-colors">
                                             <FileVideo size={24}/>
                                             <button onClick={() => handlePlayback(rec)} disabled={resolvingId === rec.id} className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                 {resolvingId === rec.id ? <Loader2 className="animate-spin text-white" size={16}/> : <Play size={20} fill="white" className="text-white"/>}
                                             </button>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="text-lg font-bold text-white truncate">{rec.mode.toUpperCase()} SCREEN</h3>
                                                <span className="text-[8px] font-black text-indigo-400 bg-indigo-900/30 px-2 py-0.5 rounded border border-indigo-500/20 uppercase">{rec.language}</span>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                                                <span className="flex items-center gap-1.5"><Calendar size={14} className="text-indigo-400"/> {new Date(rec.timestamp).toLocaleDateString()}</span>
                                                <span className="flex items-center gap-1.5 font-mono text-[10px] text-slate-600">ID: {rec.id.substring(0,12)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border shadow-lg ${
                                            rec.feedback.toLowerCase().includes('strong hire') ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 
                                            rec.feedback.toLowerCase().includes('hire') ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30' : 'bg-red-900/20 text-red-400 border-red-500/30'
                                        }`}>
                                            {rec.feedback || 'Incomplete'}
                                        </div>
                                        {isYouTubeUrl(rec.videoUrl) ? (
                                            <a href={rec.videoUrl} target="_blank" rel="noreferrer" className="p-3 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-xl transition-all border border-red-500/20" title="Watch on YouTube"><Youtube size={20}/></a>
                                        ) : isDriveUrl(rec.videoUrl) ? (
                                            <button onClick={() => handlePlayback(rec)} className="p-3 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-xl transition-all border border-indigo-500/20" title="Stream from Drive"><HardDrive size={20}/></button>
                                        ) : null}
                                        <button onClick={() => { if(confirm("Purge artifact?")) deleteInterview(rec.id).then(loadData) }} className="p-3 bg-slate-800 hover:bg-red-600 text-slate-500 hover:text-white rounded-xl transition-all"><Trash2 size={20}/></button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </header>

        <main className="flex-1 overflow-hidden relative flex flex-col items-center">
            {isLoading && (
                <div className="absolute inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center gap-8 animate-fade-in">
                    <div className="relative">
                        <div className="w-24 h-24 border-4 border-indigo-500/10 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Zap size={32} className="text-indigo-400 animate-pulse" />
                        </div>
                    </div>
                    <div className="text-center space-y-2">
                        <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Initializing Refraction</h3>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Provisioning Socratic Environment...</p>
                    </div>
                </div>
            )}

            {view === 'selection' && (
                <div className="max-w-4xl w-full p-8 md:p-16 h-full flex flex-col justify-center gap-12 animate-fade-in-up">
                    <div className="text-center space-y-4">
                        <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">The Interrogator</h2>
                        <p className="text-lg text-slate-400 font-medium max-w-xl mx-auto leading-relaxed">Refining engineering talent through technical friction and Staff-level peer evaluation.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {PERSONAS.map(p => (
                            <button 
                                key={p.id}
                                onClick={() => setSelectedPersona(p)}
                                className={`p-8 rounded-[3rem] border transition-all text-left flex flex-col gap-4 relative overflow-hidden group ${selectedPersona.id === p.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-2xl scale-[1.02]' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-indigo-500/40'}`}
                            >
                                <div className={`p-4 rounded-3xl w-fit ${selectedPersona.id === p.id ? 'bg-indigo-500' : 'bg-slate-950'} transition-colors`}>
                                    <p.icon size={32} className={selectedPersona.id === p.id ? 'text-white' : 'text-indigo-500'} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black uppercase tracking-tight leading-none mb-2">{p.name}</h3>
                                    <p className="text-xs font-medium opacity-60 leading-relaxed">{p.desc}</p>
                                </div>
                                {selectedPersona.id === p.id && <div className="absolute -right-4 -bottom-4 p-8 bg-white/10 rounded-full blur-2xl"></div>}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-col items-center gap-6">
                        <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 shadow-xl">
                            {(['coding', 'system_design', 'behavioral', 'quick_screen'] as const).map(m => (
                                <button key={m} onClick={() => setInterviewMode(m)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${interviewMode === m ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-200'}`}>{m.replace('_', ' ')}</button>
                            ))}
                        </div>
                        <button onClick={() => setView('setup')} className="px-12 py-5 bg-white text-slate-950 font-black uppercase tracking-[0.3em] rounded-2xl shadow-2xl shadow-indigo-900/40 transition-transform hover:scale-105 active:scale-95 flex items-center gap-3">
                            <span>Proceed to Setup</span>
                            <ChevronRight size={20}/>
                        </button>
                    </div>
                </div>
            )}

            {view === 'setup' && (
                <div className="max-w-xl w-full p-8 md:p-12 h-full flex flex-col justify-center gap-10 animate-fade-in-up">
                    <div className="space-y-2">
                        <button onClick={() => setView('selection')} className="flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-white transition-colors mb-4"><ArrowLeft size={14}/> Back to Selection</button>
                        <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">Environmental Config</h2>
                        <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Establishing Socratic Context</p>
                    </div>

                    <div className="space-y-8 bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-16 bg-red-500/5 blur-[80px] rounded-full pointer-events-none"></div>
                        
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Primary Code Refraction (Language)</label>
                            <div className="grid grid-cols-2 gap-2">
                                {(['c++', 'python', 'javascript', 'java'] as const).map(l => (
                                    <button key={l} onClick={() => setInterviewLanguage(l)} className={`py-3 rounded-xl border text-xs font-black uppercase transition-all ${interviewLanguage === l ? 'bg-red-600 border-red-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-600'}`}>{l}</button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Job Context (Target Narrative)</label>
                            <textarea 
                                value={jobDescription} 
                                onChange={e => setJobDescription(e.target.value)} 
                                rows={4}
                                placeholder="Paste job requirements or 'L6 Staff Engineer at Amazon'..."
                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white outline-none focus:ring-2 focus:ring-red-500 shadow-inner resize-none leading-relaxed"
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Temporal Shift (Duration)</label>
                            <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
                                {[15, 30, 45, 60].map(m => (
                                    <button key={m} onClick={() => setInterviewDuration(m)} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${interviewDuration === m ? 'bg-red-600 text-white shadow-lg' : 'text-slate-50'}`}>{m}m</button>
                                ))}
                            </div>
                        </div>

                        <button onClick={handleStartInterview} className="w-full py-5 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-red-900/40 transition-all active:scale-95 flex items-center justify-center gap-3">
                            <Play size={20} fill="currentColor"/> Begin Interrogation
                        </button>
                    </div>
                </div>
            )}

            {view === 'active' && (
                <div className="h-full w-full flex animate-fade-in relative">
                    <div className={`fixed bottom-24 right-6 z-[100] transition-all duration-500 transform ${isMirrorMinimized ? 'translate-x-20 scale-50 opacity-20' : 'translate-x-0 scale-100'}`}>
                        <div className={`relative group ${pipSize === 'compact' ? 'w-32 h-32' : 'w-56 h-56'}`}>
                            <div className="absolute -inset-1 bg-gradient-to-r from-red-500 to-indigo-600 rounded-full blur opacity-40 group-hover:opacity-100 transition duration-1000"></div>
                            <div className="relative w-full h-full bg-slate-900 rounded-full border-4 border-red-500/50 overflow-hidden shadow-2xl">
                                <video 
                                    ref={mirrorVideoRef}
                                    autoPlay 
                                    playsInline 
                                    muted 
                                    className="w-full h-full object-cover transform scale-110"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
                                <div className="absolute top-2 left-1/2 -translate-x-1/2">
                                    <div className="bg-red-600 text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-full shadow-lg border border-red-400/50 whitespace-nowrap">Neural Mirror</div>
                                </div>
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-1/2 h-1 overflow-hidden rounded-full"><Visualizer volume={volume} isActive={isLive} color="#ffffff" /></div>
                                <button 
                                    onClick={() => setIsMirrorMinimized(!isMirrorMinimized)}
                                    className="absolute bottom-2 left-1/2 -translate-x-1/2 p-1.5 bg-black/40 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                                >
                                    {isMirrorMinimized ? <Maximize2 size={12}/> : <Minimize2 size={12}/>}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 min-w-0">
                        <CodeStudio 
                            onBack={() => {}} 
                            currentUser={currentUser} 
                            userProfile={userProfile} 
                            isProMember={true} 
                            isInterviewerMode={true}
                            initialFiles={files}
                            onFileChange={(f) => setFiles(prev => prev.map(p => p.path === f.path ? f : p))}
                            externalChatContent={transcript}
                            isAiThinking={!isAiConnected && isLive}
                            onSyncCodeWithAi={(f) => {
                                addApiLog(`Forced Code Sync: ${f.name}`, 'info');
                                serviceRef.current?.sendText(`NEURAL_SNAPSHOT_SYNC: User forced a code update for ${f.name}. CONTENT: \n\`\`\`\n${f.content}\n\`\`\``);
                            }}
                            onSessionStart={() => {}}
                            onSessionStop={() => {}}
                            onStartLiveSession={(chan, ctx) => onStartLiveSession(chan, ctx)}
                        />
                    </div>
                </div>
            )}

            {view === 'feedback' && report && (
                <div className="h-full w-full overflow-y-auto p-12 bg-[#020617] scrollbar-hide">
                    <div className="max-w-4xl mx-auto space-y-16">
                        <div className="text-center space-y-4">
                            <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">Evaluation Refraction</h2>
                            <p className="text-slate-500 font-bold uppercase tracking-[0.4em] pt-2">Session Integrity: 100% Validated</p>
                        </div>
                        <EvaluationReportDisplay 
                            report={report} 
                            onSyncYouTube={() => performSyncToYouTube(report.id, report.videoBlob!, { mode: interviewMode, language: interviewLanguage })}
                            onSyncDrive={() => performSyncToDrive(report.id, report.videoBlob!, { mode: interviewMode })}
                            isSyncing={isUploadingRecording}
                        />
                    </div>
                </div>
            )}

            {view === 'archive' && (
                <div className="max-w-6xl w-full p-8 md:p-12 h-full flex flex-col animate-fade-in pb-32">
                    <div className="flex flex-col sm:flex-row items-center justify-between mb-10 gap-6">
                        <div className="space-y-2">
                             <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">Artifact Registry</h2>
                             <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Sovereign Interrogation History</p>
                        </div>
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                            <input 
                                type="text" 
                                placeholder="Search sessions..." 
                                value={archiveSearch}
                                onChange={e => setArchiveSearch(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-12 pr-6 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-4 scrollbar-hide">
                        {isLoading && pastInterviews.length === 0 ? (
                            <div className="py-20 flex flex-col items-center gap-4 text-indigo-400">
                                <Loader2 className="animate-spin" size={32}/>
                                <p className="text-[10px] font-black uppercase tracking-widest">Paging Registry...</p>
                            </div>
                        ) : pastInterviews.length === 0 ? (
                            <div className="py-20 flex flex-col items-center justify-center text-slate-700 gap-4 opacity-40">
                                <SearchX size={64}/>
                                <p className="text-sm font-bold uppercase tracking-widest">No artifacts located</p>
                            </div>
                        ) : (
                            pastInterviews.filter(i => i.mode.includes(archiveSearch) || i.jobDescription.includes(archiveSearch)).map(rec => (
                                <div key={rec.id} className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 flex flex-col md:flex-row items-center justify-between gap-8 hover:border-indigo-500/30 transition-all shadow-xl group">
                                    <div className="flex items-center gap-6 flex-1 min-w-0">
                                        <div className="w-20 h-14 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center text-slate-700 relative overflow-hidden shrink-0 group-hover:border-indigo-500/20 transition-colors">
                                             <FileVideo size={24}/>
                                             <button onClick={() => handlePlayback(rec)} disabled={resolvingId === rec.id} className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                 {resolvingId === rec.id ? <Loader2 className="animate-spin text-white" size={16}/> : <Play size={20} fill="white" className="text-white"/>}
                                             </button>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="text-lg font-bold text-white truncate">{rec.mode.toUpperCase()} SCREEN</h3>
                                                <span className="text-[8px] font-black text-indigo-400 bg-indigo-900/30 px-2 py-0.5 rounded border border-indigo-500/20 uppercase">{rec.language}</span>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                                                <span className="flex items-center gap-1.5"><Calendar size={14} className="text-indigo-400"/> {new Date(rec.timestamp).toLocaleDateString()}</span>
                                                <span className="flex items-center gap-1.5 font-mono text-[10px] text-slate-600">ID: {rec.id.substring(0,12)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border shadow-lg ${
                                            rec.feedback.toLowerCase().includes('strong hire') ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 
                                            rec.feedback.toLowerCase().includes('hire') ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30' : 'bg-red-900/20 text-red-400 border-red-500/30'
                                        }`}>
                                            {rec.feedback || 'Incomplete'}
                                        </div>
                                        {isYouTubeUrl(rec.videoUrl) ? (
                                            <a href={rec.videoUrl} target="_blank" rel="noreferrer" className="p-3 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-xl transition-all border border-red-500/20" title="Watch on YouTube"><Youtube size={20}/></a>
                                        ) : isDriveUrl(rec.videoUrl) ? (
                                            <button onClick={() => handlePlayback(rec)} className="p-3 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-xl transition-all border border-indigo-500/20" title="Stream from Drive"><HardDrive size={20}/></button>
                                        ) : null}
                                        <button onClick={() => { if(confirm("Purge artifact?")) deleteInterview(rec.id).then(loadData) }} className="p-3 bg-slate-800 hover:bg-red-600 text-slate-500 hover:text-white rounded-xl transition-all"><Trash2 size={20}/></button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </header>

        <main className="flex-1 overflow-hidden relative flex flex-col items-center">
            {isLoading && (
                <div className="absolute inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center gap-8 animate-fade-in">
                    <div className="relative">
                        <div className="w-24 h-24 border-4 border-indigo-500/10 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Zap size={32} className="text-indigo-400 animate-pulse" />
                        </div>
                    </div>
                    <div className="text-center space-y-2">
                        <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Initializing Refraction</h3>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Provisioning Socratic Environment...</p>
                    </div>
                </div>
            )}

            {view === 'selection' && (
                <div className="max-w-4xl w-full p-8 md:p-16 h-full flex flex-col justify-center gap-12 animate-fade-in-up">
                    <div className="text-center space-y-4">
                        <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">The Interrogator</h2>
                        <p className="text-lg text-slate-400 font-medium max-w-xl mx-auto leading-relaxed">Refining engineering talent through technical friction and Staff-level peer evaluation.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {PERSONAS.map(p => (
                            <button 
                                key={p.id}
                                onClick={() => setSelectedPersona(p)}
                                className={`p-8 rounded-[3rem] border transition-all text-left flex flex-col gap-4 relative overflow-hidden group ${selectedPersona.id === p.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-2xl scale-[1.02]' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-indigo-500/40'}`}
                            >
                                <div className={`p-4 rounded-3xl w-fit ${selectedPersona.id === p.id ? 'bg-indigo-500' : 'bg-slate-950'} transition-colors`}>
                                    <p.icon size={32} className={selectedPersona.id === p.id ? 'text-white' : 'text-indigo-500'} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black uppercase tracking-tight leading-none mb-2">{p.name}</h3>
                                    <p className="text-xs font-medium opacity-60 leading-relaxed">{p.desc}</p>
                                </div>
                                {selectedPersona.id === p.id && <div className="absolute -right-4 -bottom-4 p-8 bg-white/10 rounded-full blur-2xl"></div>}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-col items-center gap-6">
                        <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 shadow-xl">
                            {(['coding', 'system_design', 'behavioral', 'quick_screen'] as const).map(m => (
                                <button key={m} onClick={() => setInterviewMode(m)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${interviewMode === m ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-200'}`}>{m.replace('_', ' ')}</button>
                            ))}
                        </div>
                        <button onClick={() => setView('setup')} className="px-12 py-5 bg-white text-slate-950 font-black uppercase tracking-[0.3em] rounded-2xl shadow-2xl shadow-indigo-900/40 transition-transform hover:scale-105 active:scale-95 flex items-center gap-3">
                            <span>Proceed to Setup</span>
                            <ChevronRight size={20}/>
                        </button>
                    </div>
                </div>
            )}

            {view === 'setup' && (
                <div className="max-w-xl w-full p-8 md:p-12 h-full flex flex-col justify-center gap-10 animate-fade-in-up">
                    <div className="space-y-2">
                        <button onClick={() => setView('selection')} className="flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-white transition-colors mb-4"><ArrowLeft size={14}/> Back to Selection</button>
                        <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">Environmental Config</h2>
                        <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Establishing Socratic Context</p>
                    </div>

                    <div className="space-y-8 bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-16 bg-red-500/5 blur-[80px] rounded-full pointer-events-none"></div>
                        
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Primary Code Refraction (Language)</label>
                            <div className="grid grid-cols-2 gap-2">
                                {(['c++', 'python', 'javascript', 'java'] as const).map(l => (
                                    <button key={l} onClick={() => setInterviewLanguage(l)} className={`py-3 rounded-xl border text-xs font-black uppercase transition-all ${interviewLanguage === l ? 'bg-red-600 border-red-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-600'}`}>{l}</button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Job Context (Target Narrative)</label>
                            <textarea 
                                value={jobDescription} 
                                onChange={e => setJobDescription(e.target.value)} 
                                rows={4}
                                placeholder="Paste job requirements or 'L6 Staff Engineer at Amazon'..."
                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white outline-none focus:ring-2 focus:ring-red-500 shadow-inner resize-none leading-relaxed"
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Temporal Shift (Duration)</label>
                            <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
                                {[15, 30, 45, 60].map(m => (
                                    <button key={m} onClick={() => setInterviewDuration(m)} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${interviewDuration === m ? 'bg-red-600 text-white shadow-lg' : 'text-slate-50'}`}>{m}m</button>
                                ))}
                            </div>
                        </div>

                        <button onClick={handleStartInterview} className="w-full py-5 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-red-900/40 transition-all active:scale-95 flex items-center justify-center gap-3">
                            <Play size={20} fill="currentColor"/> Begin Interrogation
                        </button>
                    </div>
                </div>
            )}

            {view === 'active' && (
                <div className="h-full w-full flex animate-fade-in relative">
                    <div className={`fixed bottom-24 right-6 z-[100] transition-all duration-500 transform ${isMirrorMinimized ? 'translate-x-20 scale-50 opacity-20' : 'translate-x-0 scale-100'}`}>
                        <div className={`relative group ${pipSize === 'compact' ? 'w-32 h-32' : 'w-56 h-56'}`}>
                            <div className="absolute -inset-1 bg-gradient-to-r from-red-500 to-indigo-600 rounded-full blur opacity-40 group-hover:opacity-100 transition duration-1000"></div>
                            <div className="relative w-full h-full bg-slate-900 rounded-full border-4 border-red-500/50 overflow-hidden shadow-2xl">
                                <video 
                                    ref={mirrorVideoRef}
                                    autoPlay 
                                    playsInline 
                                    muted 
                                    className="w-full h-full object-cover transform scale-110"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
                                <div className="absolute top-2 left-1/2 -translate-x-1/2">
                                    <div className="bg-red-600 text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-full shadow-lg border border-red-400/50 whitespace-nowrap">Neural Mirror</div>
                                </div>
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-1/2 h-1 overflow-hidden rounded-full"><Visualizer volume={volume} isActive={isLive} color="#ffffff" /></div>
                                <button 
                                    onClick={() => setIsMirrorMinimized(!isMirrorMinimized)}
                                    className="absolute bottom-2 left-1/2 -translate-x-1/2 p-1.5 bg-black/40 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                                >
                                    {isMirrorMinimized ? <Maximize2 size={12}/> : <Minimize2 size={12}/>}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 min-w-0">
                        <CodeStudio 
                            onBack={() => {}} 
                            currentUser={currentUser} 
                            userProfile={userProfile} 
                            isProMember={true} 
                            isInterviewerMode={true}
                            initialFiles={files}
                            onFileChange={(f) => setFiles(prev => prev.map(p => p.path === f.path ? f : p))}
                            externalChatContent={transcript}
                            isAiThinking={!isAiConnected && isLive}
                            onSyncCodeWithAi={(f) => {
                                addApiLog(`Forced Code Sync: ${f.name}`, 'info');
                                serviceRef.current?.sendText(`NEURAL_SNAPSHOT_SYNC: User forced a code update for ${f.name}. CONTENT: \n\`\`\`\n${f.content}\n\`\`\``);
                            }}
                            onSessionStart={() => {}}
                            onSessionStop={() => {}}
                            onStartLiveSession={(chan, ctx) => onStartLiveSession(chan, ctx)}
                        />
                    </div>
                </div>
            )}

            {view === 'feedback' && report && (
                <div className="h-full w-full overflow-y-auto p-12 bg-[#020617] scrollbar-hide">
                    <div className="max-w-4xl mx-auto space-y-16">
                        <div className="text-center space-y-4">
                            <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">Evaluation Refraction</h2>
                            <p className="text-slate-500 font-bold uppercase tracking-[0.4em] pt-2">Session Integrity: 100% Validated</p>
                        </div>
                        <EvaluationReportDisplay 
                            report={report} 
                            onSyncYouTube={() => performSyncToYouTube(report.id, report.videoBlob!, { mode: interviewMode, language: interviewLanguage })}
                            onSyncDrive={() => performSyncToDrive(report.id, report.videoBlob!, { mode: interviewMode })}
                            isSyncing={isUploadingRecording}
                        />
                    </div>
                </div>
            )}

            {view === 'archive' && (
                <div className="max-w-6xl w-full p-8 md:p-12 h-full flex flex-col animate-fade-in pb-32">
                    <div className="flex flex-col sm:flex-row items-center justify-between mb-10 gap-6">
                        <div className="space-y-2">
                             <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">Artifact Registry</h2>
                             <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Sovereign Interrogation History</p>
                        </div>
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                            <input 
                                type="text" 
                                placeholder="Search sessions..." 
                                value={archiveSearch}
                                onChange={e => setArchiveSearch(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-12 pr-6 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-4 scrollbar-hide">
                        {isLoading && pastInterviews.length === 0 ? (
                            <div className="py-20 flex flex-col items-center gap-4 text-indigo-400">
                                <Loader2 className="animate-spin" size={32}/>
                                <p className="text-[10px] font-black uppercase tracking-widest">Paging Registry...</p>
                            </div>
                        ) : pastInterviews.length === 0 ? (
                            <div className="py-20 flex flex-col items-center justify-center text-slate-700 gap-4 opacity-40">
                                <SearchX size={64}/>
                                <p className="text-sm font-bold uppercase tracking-widest">No artifacts located</p>
                            </div>
                        ) : (
                            pastInterviews.filter(i => i.mode.includes(archiveSearch) || i.jobDescription.includes(archiveSearch)).map(rec => (
                                <div key={rec.id} className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 flex flex-col md:flex-row items-center justify-between gap-8 hover:border-indigo-500/30 transition-all shadow-xl group">
                                    <div className="flex items-center gap-6 flex-1 min-w-0">
                                        <div className="w-20 h-14 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center text-slate-700 relative overflow-hidden shrink-0 group-hover:border-indigo-500/20 transition-colors">
                                             <FileVideo size={24}/>
                                             <button onClick={() => handlePlayback(rec)} disabled={resolvingId === rec.id} className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                 {resolvingId === rec.id ? <Loader2 className="animate-spin text-white" size={16}/> : <Play size={20} fill="white" className="text-white"/>}
                                             </button>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="text-lg font-bold text-white truncate">{rec.mode.toUpperCase()} SCREEN</h3>
                                                <span className="text-[8px] font-black text-indigo-400 bg-indigo-900/30 px-2 py-0.5 rounded border border-indigo-500/20 uppercase">{rec.language}</span>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                                                <span className="flex items-center gap-1.5"><Calendar size={14} className="text-indigo-400"/> {new Date(rec.timestamp).toLocaleDateString()}</span>
                                                <span className="flex items-center gap-1.5 font-mono text-[10px] text-slate-600">ID: {rec.id.substring(0,12)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border shadow-lg ${
                                            rec.feedback.toLowerCase().includes('strong hire') ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 
                                            rec.feedback.toLowerCase().includes('hire') ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30' : 'bg-red-900/20 text-red-400 border-red-500/30'
                                        }`}>
                                            {rec.feedback || 'Incomplete'}
                                        </div>
                                        {isYouTubeUrl(rec.videoUrl) ? (
                                            <a href={rec.videoUrl} target="_blank" rel="noreferrer" className="p-3 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-xl transition-all border border-red-500/20" title="Watch on YouTube"><Youtube size={20}/></a>
                                        ) : isDriveUrl(rec.videoUrl) ? (
                                            <button onClick={() => handlePlayback(rec)} className="p-3 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-xl transition-all border border-indigo-500/20" title="Stream from Drive"><HardDrive size={20}/></button>
                                        ) : null}
                                        <button onClick={() => { if(confirm("Purge artifact?")) deleteInterview(rec.id).then(loadData) }} className="p-3 bg-slate-800 hover:bg-red-600 text-slate-500 hover:text-white rounded-xl transition-all"><Trash2 size={20}/></button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </header>

        <main className="flex-1 overflow-hidden relative flex flex-col items-center">
            {isLoading && (
                <div className="absolute inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center gap-8 animate-fade-in">
                    <div className="relative">
                        <div className="w-24 h-24 border-4 border-indigo-500/10 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Zap size={32} className="text-indigo-400 animate-pulse" />
                        </div>
                    </div>
                    <div className="text-center space-y-2">
                        <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Initializing Refraction</h3>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Provisioning Socratic Environment...</p>
                    </div>
                </div>
            )}

            {view === 'selection' && (
                <div className="max-w-4xl w-full p-8 md:p-16 h-full flex flex-col justify-center gap-12 animate-fade-in-up">
                    <div className="text-center space-y-4">
                        <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">The Interrogator</h2>
                        <p className="text-lg text-slate-400 font-medium max-w-xl mx-auto leading-relaxed">Refining engineering talent through technical friction and Staff-level peer evaluation.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {PERSONAS.map(p => (
                            <button 
                                key={p.id}
                                onClick={() => setSelectedPersona(p)}
                                className={`p-8 rounded-[3rem] border transition-all text-left flex flex-col gap-4 relative overflow-hidden group ${selectedPersona.id === p.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-2xl scale-[1.02]' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-indigo-500/40'}`}
                            >
                                <div className={`p-4 rounded-3xl w-fit ${selectedPersona.id === p.id ? 'bg-indigo-500' : 'bg-slate-950'} transition-colors`}>
                                    <p.icon size={32} className={selectedPersona.id === p.id ? 'text-white' : 'text-indigo-500'} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black uppercase tracking-tight leading-none mb-2">{p.name}</h3>
                                    <p className="text-xs font-medium opacity-60 leading-relaxed">{p.desc}</p>
                                </div>
                                {selectedPersona.id === p.id && <div className="absolute -right-4 -bottom-4 p-8 bg-white/10 rounded-full blur-2xl"></div>}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-col items-center gap-6">
                        <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 shadow-xl">
                            {(['coding', 'system_design', 'behavioral', 'quick_screen'] as const).map(m => (
                                <button key={m} onClick={() => setInterviewMode(m)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${interviewMode === m ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-200'}`}>{m.replace('_', ' ')}</button>
                            ))}
                        </div>
                        <button onClick={() => setView('setup')} className="px-12 py-5 bg-white text-slate-950 font-black uppercase tracking-[0.3em] rounded-2xl shadow-2xl shadow-indigo-900/40 transition-transform hover:scale-105 active:scale-95 flex items-center gap-3">
                            <span>Proceed to Setup</span>
                            <ChevronRight size={20}/>
                        </button>
                    </div>
                </div>
            )}

            {view === 'setup' && (
                <div className="max-w-xl w-full p-8 md:p-12 h-full flex flex-col justify-center gap-10 animate-fade-in-up">
                    <div className="space-y-2">
                        <button onClick={() => setView('selection')} className="flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-white transition-colors mb-4"><ArrowLeft size={14}/> Back to Selection</button>
                        <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">Environmental Config</h2>
                        <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Establishing Socratic Context</p>
                    </div>

                    <div className="space-y-8 bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-16 bg-red-500/5 blur-[80px] rounded-full pointer-events-none"></div>
                        
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Primary Code Refraction (Language)</label>
                            <div className="grid grid-cols-2 gap-2">
                                {(['c++', 'python', 'javascript', 'java'] as const).map(l => (
                                    <button key={l} onClick={() => setInterviewLanguage(l)} className={`py-3 rounded-xl border text-xs font-black uppercase transition-all ${interviewLanguage === l ? 'bg-red-600 border-red-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-600'}`}>{l}</button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Job Context (Target Narrative)</label>
                            <textarea 
                                value={jobDescription} 
                                onChange={e => setJobDescription(e.target.value)} 
                                rows={4}
                                placeholder="Paste job requirements or 'L6 Staff Engineer at Amazon'..."
                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white outline-none focus:ring-2 focus:ring-red-500 shadow-inner resize-none leading-relaxed"
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Temporal Shift (Duration)</label>
                            <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
                                {[15, 30, 45, 60].map(m => (
                                    <button key={m} onClick={() => setInterviewDuration(m)} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${interviewDuration === m ? 'bg-red-600 text-white shadow-lg' : 'text-slate-50'}`}>{m}m</button>
                                ))}
                            </div>
                        </div>

                        <button onClick={handleStartInterview} className="w-full py-5 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-red-900/40 transition-all active:scale-95 flex items-center justify-center gap-3">
                            <Play size={20} fill="currentColor"/> Begin Interrogation
                        </button>
                    </div>
                </div>
            )}

            {view === 'active' && (
                <div className="h-full w-full flex animate-fade-in relative">
                    <div className={`fixed bottom-24 right-6 z-[100] transition-all duration-500 transform ${isMirrorMinimized ? 'translate-x-20 scale-50 opacity-20' : 'translate-x-0 scale-100'}`}>
                        <div className={`relative group ${pipSize === 'compact' ? 'w-32 h-32' : 'w-56 h-56'}`}>
                            <div className="absolute -inset-1 bg-gradient-to-r from-red-500 to-indigo-600 rounded-full blur opacity-40 group-hover:opacity-100 transition duration-1000"></div>
                            <div className="relative w-full h-full bg-slate-900 rounded-full border-4 border-red-500/50 overflow-hidden shadow-2xl">
                                <video 
                                    ref={mirrorVideoRef}
                                    autoPlay 
                                    playsInline 
                                    muted 
                                    className="w-full h-full object-cover transform scale-110"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
                                <div className="absolute top-2 left-1/2 -translate-x-1/2">
                                    <div className="bg-red-600 text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-full shadow-lg border border-red-400/50 whitespace-nowrap">Neural Mirror</div>
                                </div>
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-1/2 h-1 overflow-hidden rounded-full"><Visualizer volume={volume} isActive={isLive} color="#ffffff" /></div>
                                <button 
                                    onClick={() => setIsMirrorMinimized(!isMirrorMinimized)}
                                    className="absolute bottom-2 left-1/2 -translate-x-1/2 p-1.5 bg-black/40 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                                >
                                    {isMirrorMinimized ? <Maximize2 size={12}/> : <Minimize2 size={12}/>}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 min-w-0">
                        <CodeStudio 
                            onBack={() => {}} 
                            currentUser={currentUser} 
                            userProfile={userProfile} 
                            isProMember={true} 
                            isInterviewerMode={true}
                            initialFiles={files}
                            onFileChange={(f) => setFiles(prev => prev.map(p => p.path === f.path ? f : p))}
                            externalChatContent={transcript}
                            isAiThinking={!isAiConnected && isLive}
                            onSyncCodeWithAi={(f) => {
                                addApiLog(`Forced Code Sync: ${f.name}`, 'info');
                                serviceRef.current?.sendText(`NEURAL_SNAPSHOT_SYNC: User forced a code update for ${f.name}. CONTENT: \n\`\`\`\n${f.content}\n\`\`\``);
                            }}
                            onSessionStart={() => {}}
                            onSessionStop={() => {}}
                            onStartLiveSession={(chan, ctx) => onStartLiveSession(chan, ctx)}
                        />
                    </div>
                </div>
            )}

            {view === 'feedback' && report && (
                <div className="h-full w-full overflow-y-auto p-12 bg-[#020617] scrollbar-hide">
                    <div className="max-w-4xl mx-auto space-y-16">
                        <div className="text-center space-y-4">
                            <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">Evaluation Refraction</h2>
                            <p className="text-slate-500 font-bold uppercase tracking-[0.4em] pt-2">Session Integrity: 100% Validated</p>
                        </div>
                        <EvaluationReportDisplay 
                            report={report} 
                            onSyncYouTube={() => performSyncToYouTube(report.id, report.videoBlob!, { mode: interviewMode, language: interviewLanguage })}
                            onSyncDrive={() => performSyncToDrive(report.id, report.videoBlob!, { mode: interviewMode })}
                            isSyncing={isUploadingRecording}
                        />
                    </div>
                </div>
            )}

            {view === 'archive' && (
                <div className="max-w-6xl w-full p-8 md:p-12 h-full flex flex-col animate-fade-in pb-32">
                    <div className="flex flex-col sm:flex-row items-center justify-between mb-10 gap-6">
                        <div className="space-y-2">
                             <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">Artifact Registry</h2>
                             <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Sovereign Interrogation History</p>
                        </div>
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                            <input 
                                type="text" 
                                placeholder="Search sessions..." 
                                value={archiveSearch}
                                onChange={e => setArchiveSearch(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-12 pr-6 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-4 scrollbar-hide">
                        {isLoading && pastInterviews.length === 0 ? (
                            <div className="py-20 flex flex-col items-center gap-4 text-indigo-400">
                                <Loader2 className="animate-spin" size={32}/>
                                <p className="text-[10px] font-black uppercase tracking-widest">Paging Registry...</p>
                            </div>
                        ) : pastInterviews.length === 0 ? (
                            <div className="py-20 flex flex-col items-center justify-center text-slate-700 gap-4 opacity-40">
                                <SearchX size={64}/>
                                <p className="text-sm font-bold uppercase tracking-widest">No artifacts located</p>
                            </div>
                        ) : (
                            pastInterviews.filter(i => i.mode.includes(archiveSearch) || i.jobDescription.includes(archiveSearch)).map(rec => (
                                <div key={rec.id} className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 flex flex-col md:flex-row items-center justify-between gap-8 hover:border-indigo-500/30 transition-all shadow-xl group">
                                    <div className="flex items-center gap-6 flex-1 min-w-0">
                                        <div className="w-20 h-14 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center text-slate-700 relative overflow-hidden shrink-0 group-hover:border-indigo-500/20 transition-colors">
                                             <FileVideo size={24}/>
                                             <button onClick={() => handlePlayback(rec)} disabled={resolvingId === rec.id} className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                 {resolvingId === rec.id ? <Loader2 className="animate-spin text-white" size={16}/> : <Play size={20} fill="white" className="text-white"/>}
                                             </button>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="text-lg font-bold text-white truncate">{rec.mode.toUpperCase()} SCREEN</h3>
                                                <span className="text-[8px] font-black text-indigo-400 bg-indigo-900/30 px-2 py-0.5 rounded border border-indigo-500/20 uppercase">{rec.language}</span>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                                                <span className="flex items-center gap-1.5"><Calendar size={14} className="text-indigo-400"/> {new Date(rec.timestamp).toLocaleDateString()}</span>
                                                <span className="flex items-center gap-1.5 font-mono text-[10px] text-slate-600">ID: {rec.id.substring(0,12)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border shadow-lg ${
                                            rec.feedback.toLowerCase().includes('strong hire') ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 
                                            rec.feedback.toLowerCase().includes('hire') ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30' : 'bg-red-900/20 text-red-400 border-red-500/30'
                                        }`}>
                                            {rec.feedback || 'Incomplete'}
                                        </div>
                                        {isYouTubeUrl(rec.videoUrl) ? (
                                            <a href={rec.videoUrl} target="_blank" rel="noreferrer" className="p-3 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-xl transition-all border border-red-500/20" title="Watch on YouTube"><Youtube size={20}/></a>
                                        ) : isDriveUrl(rec.videoUrl) ? (
                                            <button onClick={() => handlePlayback(rec)} className="p-3 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-xl transition-all border border-indigo-500/20" title="Stream from Drive"><HardDrive size={20}/></button>
                                        ) : null}
                                        <button onClick={() => { if(confirm("Purge artifact?")) deleteInterview(rec.id).then(loadData) }} className="p-3 bg-slate-800 hover:bg-red-600 text-slate-500 hover:text-white rounded-xl transition-all"><Trash2 size={20}/></button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </header>

        <main className="flex-1 overflow-hidden relative flex flex-col items-center">
            {isLoading && (
                <div className="absolute inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center gap-8 animate-fade-in">
                    <div className="relative">
                        <div className="w-24 h-24 border-4 border-indigo-500/10 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Zap size={32} className="text-indigo-400 animate-pulse" />
                        </div>
                    </div>
                    <div className="text-center space-y-2">
                        <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Initializing Refraction</h3>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Provisioning Socratic Environment...</p>
                    </div>
                </div>
            )}

            {view === 'selection' && (
                <div className="max-w-4xl w-full p-8 md:p-16 h-full flex flex-col justify-center gap-12 animate-fade-in-up">
                    <div className="text-center space-y-4">
                        <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">The Interrogator</h2>
                        <p className="text-lg text-slate-400 font-medium max-w-xl mx-auto leading-relaxed">Refining engineering talent through technical friction and Staff-level peer evaluation.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {PERSONAS.map(p => (
                            <button 
                                key={p.id}
                                onClick={() => setSelectedPersona(p)}
                                className={`p-8 rounded-[3rem] border transition-all text-left flex flex-col gap-4 relative overflow-hidden group ${selectedPersona.id === p.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-2xl scale-[1.02]' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-indigo-500/40'}`}
                            >
                                <div className={`p-4 rounded-3xl w-fit ${selectedPersona.id === p.id ? 'bg-indigo-500' : 'bg-slate-950'} transition-colors`}>
                                    <p.icon size={32} className={selectedPersona.id === p.id ? 'text-white' : 'text-indigo-500'} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black uppercase tracking-tight leading-none mb-2">{p.name}</h3>
                                    <p className="text-xs font-medium opacity-60 leading-relaxed">{p.desc}</p>
                                </div>
                                {selectedPersona.id === p.id && <div className="absolute -right-4 -bottom-4 p-8 bg-white/10 rounded-full blur-2xl"></div>}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-col items-center gap-6">
                        <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 shadow-xl">
                            {(['coding', 'system_design', 'behavioral', 'quick_screen'] as const).map(m => (
                                <button key={m} onClick={() => setInterviewMode(m)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${interviewMode === m ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-200'}`}>{m.replace('_', ' ')}</button>
                            ))}
                        </div>
                        <button onClick={() => setView('setup')} className="px-12 py-5 bg-white text-slate-950 font-black uppercase tracking-[0.3em] rounded-2xl shadow-2xl shadow-indigo-900/40 transition-transform hover:scale-105 active:scale-95 flex items-center gap-3">
                            <span>Proceed to Setup</span>
                            <ChevronRight size={20}/>
                        </button>
                    </div>
                </div>
            )}

            {view === 'setup' && (
                <div className="max-w-xl w-full p-8 md:p-12 h-full flex flex-col justify-center gap-10 animate-fade-in-up">
                    <div className="space-y-2">
                        <button onClick={() => setView('selection')} className="flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-white transition-colors mb-4"><ArrowLeft size={14}/> Back to Selection</button>
                        <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">Environmental Config</h2>
                        <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Establishing Socratic Context</p>
                    </div>

                    <div className="space-y-8 bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-16 bg-red-500/5 blur-[80px] rounded-full pointer-events-none"></div>
                        
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Primary Code Refraction (Language)</label>
                            <div className="grid grid-cols-2 gap-2">
                                {(['c++', 'python', 'javascript', 'java'] as const).map(l => (
                                    <button key={l} onClick={() => setInterviewLanguage(l)} className={`py-3 rounded-xl border text-xs font-black uppercase transition-all ${interviewLanguage === l ? 'bg-red-600 border-red-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-600'}`}>{l}</button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Job Context (Target Narrative)</label>
                            <textarea 
                                value={jobDescription} 
                                onChange={e => setJobDescription(e.target.value)} 
                                rows={4}
                                placeholder="Paste job requirements or 'L6 Staff Engineer at Amazon'..."
                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white outline-none focus:ring-2 focus:ring-red-500 shadow-inner resize-none leading-relaxed"
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-[1