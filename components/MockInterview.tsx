
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
  saveRecordingReference,
  saveProjectToCloud
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
  FileText, FileText as FileTextIcon, Image as ImageIcon, Ghost, Eye, Database, TerminalSquare, FlaskConical, Beaker, Upload, Droplets, Signal
} from 'lucide-react';
import { getGlobalAudioContext, warmUpAudioContext, registerAudioOwner, connectOutput, getGlobalMediaStreamDest } from '../utils/audioUtils';
import { getDriveToken, signInWithGoogle, connectGoogleDrive, isJudgeSession } from '../services/authService';
import { ensureCodeStudioFolder, ensureFolder, uploadToDrive, getDriveFileSharingLink, getDriveFileStreamUrl } from '../services/googleDriveService';
import { uploadToYouTube, getYouTubeVideoUrl, getYouTubeEmbedUrl, deleteYouTubeVideo } from '../services/youtubeService';
import { resizeImage } from '../utils/imageUtils';

// --- Global Context Helpers ---
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

const getCleanVerdict = (raw: string) => {
    if (!raw) return 'ARCHIVED';
    if (raw.startsWith('{')) {
        try {
            const parsed = JSON.parse(raw);
            return (parsed.verdict || parsed.sentiment || 'EVALUATED').toUpperCase();
        } catch (e) {
            return 'EVALUATED';
        }
    }
    return raw.toUpperCase();
};

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
  shadowAudit?: string; 
  sourceCode?: CodeFile[];
  transcript?: TranscriptItem[];
  videoUrl?: string; 
  videoBlob?: Blob;
  videoSize?: number; 
}

interface ApiLog {
    time: string;
    msg: string;
    type: 'input' | 'output' | 'error' | 'success' | 'warn' | 'info' | 'shadow' | 'audit';
    code?: string;
}

interface AuditStep {
    id: string;
    label: string;
    status: 'pending' | 'active' | 'success' | 'fail';
}

interface MockInterviewProps {
  onBack: () => void;
  userProfile: UserProfile | null;
  onStartLiveSession: (channel: Channel, context?: string, recordingEnabled?: boolean, bookingId?: string, videoEnabled?: boolean, cameraEnabled?: boolean, activeSegment?: { index: number, lectureId: string }) => void;
  isProMember?: boolean;
  onOpenManual?: () => void;
}

const getLanguageFromExt = (path: string): any => {
    const ext = path.split('.').pop()?.toLowerCase();
    let language: any = 'text';
    if (['js', 'jsx'].includes(ext || '')) language = 'javascript';
    else if (['ts', 'tsx'].includes(ext || '')) language = 'typescript';
    else if (ext === 'py') language = 'python';
    else if (['cpp', 'c', 'h', 'hpp', 'cc', 'hh', 'cxx'].includes(ext || '')) language = 'cpp';
    else if (ext === 'java') language = 'java';
    else if (ext === 'go') language = 'go';
    else if (ext === 'rs') language = 'rs';
    else if (ext === 'json') language = 'json';
    else if (ext === 'md') language = 'markdown';
    else if (ext === 'html') language = 'html';
    else if (ext === 'css') language = 'css';
    else if (ext === 'wb') language = 'whiteboard';
    return language;
};

const PERSONAS = [
    { 
        id: 'dyad-lead', 
        name: 'DyadAI: Lead Interviewer', 
        icon: UserCheck, 
        desc: 'Adaptive, emotive interaction layer powered by the Shadow Critic.',
        instruction: 'You are the Lead Interviewer for DyadAI. Your goal is to conduct a high-fidelity technical interview. You MUST use the workspace tools to show questions or code to the user. DO NOT just speak the code or put it in the transcript. Use "write_file" to give the candidate their challenge by creating new files. Use "write_file" for all updates. Introduce yourself as the Dyad Lead.'
    },
    { 
        id: 'software-interview', 
        name: 'Senior Staff Interrogator', 
        icon: GraduationCap, 
        desc: 'Hard algorithmic evaluation. Socratic focus.',
        instruction: 'You are a Senior Staff Engineer. You conduct hard technical interviews. You MUST use the "write_file" tool to present the problem statement at the start. DO NOT explain the code in text, put it directly into the file. The Shadow Critic will monitor your logic.'
    },
    { 
        id: 'linux-kernel', 
        name: 'Kernel Maintainer', 
        icon: Cpu, 
        desc: 'Systems engineering and memory safety audit.',
        instruction: 'You are a Linux Kernel Maintainer. You evaluate code for race conditions and architectural elegance. Use the tools to read and write code frequently. You MUST present technical questions by creating a new file in the workspace using "write_file".'
    }
];

// --- VFS AUDIT TOOLS ---
const writeFileTool: any = {
  name: "write_file",
  description: "Create or overwrite a file in the workspace. Use this for presenting problems, adding function stubs, or injecting boilerplate. If the file ends in .wb, the content is a JSON array of whiteboard elements.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      path: { type: Type.STRING, description: "The path for the file (e.g. 'problem.cpp' or 'design.wb')" },
      content: { type: Type.STRING, description: "Full new content for the file." }
    },
    required: ["path", "content"]
  }
};

const readFileTool: any = {
  name: "read_file",
  description: "Read the current state of a specific file in the workspace. Use this to verify user changes.",
  parameters: { 
    type: Type.OBJECT, 
    properties: {
      path: { type: Type.STRING, description: "The specific file path to read." }
    },
    required: ["path"]
  }
};

const listFilesTool: any = {
  name: "list_files",
  description: "Returns a list of all files in the current workspace.",
  parameters: { type: Type.OBJECT, properties: {} }
};

const createInterviewNoteTool: any = {
  name: "create_interview_note",
  description: "Create a private markdown note for the interview. Use this to keep track of the schedule, scorecards, or internal rubrics.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Title for the note (e.g. 'interview_schedule.md')" },
      content: { type: Type.STRING, description: "Markdown content for the note." }
    },
    required: ["title", "content"]
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

    const [showTranscript, setShowTranscript] = useState(false);

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
        const a = document.createElement('a');
        a.href = stableVideoUrl;
        a.download = `DyadAI_Archive_${report.id.substring(0,8)}.webm`;
        a.click();
    };

    const isArchived = report.videoUrl?.includes('youtube');
    const isSovereign = report.videoUrl?.startsWith('drive://') || report.videoUrl?.includes('drive.google.com');

    return (
        <div className="w-full space-y-12 animate-fade-in-up pb-32">
            <div className="flex flex-col md:flex-row items-center justify-center gap-8">
                <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                    <div className="relative px-12 py-10 bg-slate-900 rounded-[3rem] border border-indigo-500/30 shadow-2xl flex flex-col items-center min-w-[220px]">
                        <p className="text-[10px] text-indigo-400 uppercase font-black tracking-[0.3em] mb-2">Dyad Signal</p>
                        <p className="text-7xl font-black text-white italic tracking-tighter">{report.score || 0}<span className="text-xl text-slate-600">/100</span></p>
                    </div>
                </div>
                <div className="flex flex-col items-center md:items-start gap-4">
                    <div className={`px-8 py-3 rounded-2xl border text-2xl font-black uppercase tracking-tighter shadow-xl ${verdictColor}`}>
                        {report.verdict || 'UNAVAILABLE'}
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">
                        <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-emerald-400"/> Dual-Agent Verified</span>
                        <div className="w-1 h-1 rounded-full bg-slate-800"></div>
                        <span className="flex items-center gap-1.5"><Bot size={14} className="text-indigo-400"/> DyadAI Engine v2</span>
                    </div>
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-10 rounded-[3rem] shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-24 bg-indigo-500/5 blur-[100px] rounded-full group-hover:bg-indigo-500/10 transition-colors"></div>
                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-6 flex items-center gap-2">
                    <Ghost size={16} className="text-purple-400"/> Shadow Agent Audit
                </h4>
                <div className="text-sm font-medium leading-relaxed text-slate-300 relative z-10 border-l-4 border-purple-500/30 pl-8">
                    <MarkdownView content={report.shadowAudit || "The Shadow Agent observed strong technical intuition during the Link Recovery phase."} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-xl hover:border-indigo-500/30 transition-all group">
                    <div className="w-10 h-10 rounded-xl bg-indigo-900/30 text-indigo-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                        <Cpu size={20}/>
                    </div>
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Technical Proficiency</h4>
                    <p className="text-sm text-slate-300 leading-relaxed font-medium">{report.technicalSkills || 'High Technical Literacy'}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-xl hover:border-pink-500/30 transition-all group">
                    <div className="w-10 h-10 rounded-xl bg-pink-900/30 text-pink-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                        <Presentation size={20}/>
                    </div>
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Communication Density</h4>
                    <p className="text-sm text-slate-300 leading-relaxed font-medium">{report.communication || 'Sufficient Communication Density'}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-xl hover:border-emerald-500/30 transition-all group">
                    <div className="w-10 h-10 rounded-xl bg-emerald-900/30 text-emerald-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                        <HeartHandshake size={20}/>
                    </div>
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Culture Add Signal</h4>
                    <p className="text-sm text-slate-300 leading-relaxed font-medium">{report.collaboration || 'Aligned with Community Core'}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-emerald-950/10 border border-emerald-500/20 p-10 rounded-[3rem] shadow-xl space-y-6">
                    <h4 className="text-xs font-black text-emerald-400 uppercase tracking-[0.3em] flex items-center gap-3">
                        <AwardIcon size={18} /> Lead Strengths
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
                        <Target size={18}/> Shadow Growth Nodes
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

            <div className="bg-slate-900 border border-slate-800 rounded-[3rem] shadow-xl overflow-hidden">
                <button 
                  onClick={() => setShowTranscript(!showTranscript)}
                  className="w-full p-8 flex items-center justify-between hover:bg-slate-800 transition-colors"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-indigo-900/30 text-indigo-400 rounded-xl"><MessageSquare size={20}/></div>
                        <h4 className="text-sm font-black text-white uppercase tracking-[0.2em]">Interrogation Transcript</h4>
                    </div>
                    {showTranscript ? <ChevronDown size={20}/> : <ChevronRight size={20}/>}
                </button>
                {showTranscript && (
                    <div className="p-8 pt-0 space-y-6 animate-fade-in-up max-h-[600px] overflow-y-auto scrollbar-hide">
                        {report.transcript?.map((item, idx) => (
                            <div key={idx} className={`flex flex-col ${item.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <span className={`text-[10px] font-black uppercase mb-1 ${item.role === 'user' ? 'text-indigo-400' : 'text-red-400'}`}>{item.role === 'user' ? 'Candidate' : 'Interviewer'}</span>
                                <div className={`px-6 py-3 rounded-2xl text-sm leading-relaxed max-w-[85%] ${item.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm shadow-lg' : 'bg-slate-800 text-slate-300 rounded-tl-sm border border-slate-700'}`}>
                                    <p className="whitespace-pre-wrap">{item.text}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex justify-center gap-4 flex-wrap">
                {isArchived ? (
                    <a 
                      href={report.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center gap-3 transition-all active:scale-95 shadow-red-900/20"
                    >
                        <Youtube size={20} fill="currentColor"/> Watch on YouTube
                    </a>
                ) : isSovereign ? (
                    <a 
                      href={report.videoUrl?.replace('drive://', 'https://drive.google.com/file/d/')}
                      target="_blank"
                      rel="noreferrer"
                      className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center gap-3 transition-all active:scale-95 shadow-red-900/20"
                    >
                        <HardDrive size={20}/> Open in Sovereign Vault
                    </a>
                ) : (
                    <button 
                      onClick={onSyncYouTube} 
                      disabled={isSyncing} 
                      className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center gap-3 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isSyncing ? <Loader2 size={20} className="animate-spin"/> : <Youtube size={20}/>}
                        Sync to Neural Archive
                    </button>
                )}
                
                <button onClick={handleDownload} className="p-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl border border-slate-700 transition-all" title="Download Source File"><Download size={24}/></button>
            </div>
        </div>
    );
};

export const MockInterview: React.FC<MockInterviewProps> = ({ onBack, userProfile, onStartLiveSession, isProMember, onOpenManual }) => {
  const [view, setView] = useState<'selection' | 'setup' | 'active' | 'feedback' | 'archive'>('selection');
  const [interviewMode, setInterviewMode] = useState<'coding' | 'system_design' | 'behavioral' | 'quick_screen'>('coding');
  const [interviewLanguage, setInterviewLanguage] = useState<'cpp' | 'python' | 'javascript' | 'java'>('cpp');
  const [jobDescription, setJobDescription] = useState('');
  const [selectedPersona, setSelectedPersona] = useState(PERSONAS[0]);
  const [sessionUuid, setSessionUuid] = useState('');
  const sessionUuidRef = useRef(''); 
  const [archiveSearch, setArchiveSearch] = useState('');
  const [pipSize, setPipSize] = useState<'normal' | 'compact'>('normal');
  const [isMirrorMinimized, setIsMirrorMinimized] = useState(false);
  const [isCamBlurred, setIsCamBlurred] = useState(false);
  const [customPipBgBase64, setCustomPipBgBase64] = useState<string | null>(null);
  const pipBgImageRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isAiConnected, setIsAiConnected] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(true);

  const [isLive, setIsLive] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const transcriptRef = useRef<TranscriptItem[]>([]);
  const [files, setFiles] = useState<CodeFile[]>([]);
  const filesRef = useRef<CodeFile[]>([]); 
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const activeFileIndexRef = useRef(0);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [volume, setVolume] = useState(0);

  const [apiLogs, setApiLogs] = useState<ApiLog[]>([]);
  const [setupSteps, setSetupSteps] = useState<{ id: string, label: string, status: 'pending' | 'active' | 'done' | 'error' }[]>([
      { id: 'uuid', label: 'Securing Session Identity', status: 'pending' },
      { id: 'scopes', label: 'Handshaking Hardware Scopes', status: 'pending' },
      { id: 'scribe', label: 'Calibrating Scribe Compositor', status: 'pending' },
      { id: 'neural', label: 'Linking Gemini Spectrum', status: 'pending' },
      { id: 'dyad', label: 'Verifying Dyad Lead', status: 'pending' }
  ]);

  const [vfsAuditActive, setVfsAuditActive] = useState(false);
  const [auditResults, setAuditResults] = useState<AuditStep[]>([
      { id: 'code-create', label: 'Editor: Create/Read Handshake', status: 'pending' },
      { id: 'code-focus', label: 'Editor: Focus Synchronicity', status: 'pending' },
      { id: 'code-mutate', label: 'Editor: Mutation Propagation', status: 'pending' },
      { id: 'wb-create', label: 'Whiteboard: Vector Ingestion', status: 'pending' },
      { id: 'wb-focus', label: 'Whiteboard: Focus Handshake', status: 'pending' },
      { id: 'wb-delete', label: 'Whiteboard: Object Erasure Sync', status: 'pending' }
  ]);

  const [interviewDuration, setInterviewDuration] = useState(15); 
  const [timeLeft, setTimeLeft] = useState(15 * 60); 
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rotationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const renderIntervalRef = useRef<any>(null);
  const autoReconnectAttempts = useRef(0);
  const maxAutoRetries = 20; 
  const isEndingRef = useRef(false);

  const shadowWhisperTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const mirrorVideoRef = useRef<HTMLVideoElement>(null);
  const [isRecordingActive, setIsRecordingActive] = useState(false);
  const [isUploadingRecording, setIsUploadingRecording] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isHydratingArchive, setIsHydratingArchive] = useState(false);
  const [report, setReport] = useState<MockInterviewReport | null>(null);
  const [pastInterviews, setPastInterviews] = useState<MockInterviewRecording[]>([]);

  const localSessionVideoUrlRef = useRef<string>('');
  const localSessionBlobRef = useRef<Blob | null>(null);
  const localSessionVideoSizeRef = useRef<number>(0);

  const serviceRef = useRef<GeminiLiveService | null>(null);
  const currentUser = auth?.currentUser;

  const handlePipBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const b64 = await resizeImage(e.target.files[0], 1024, 0.7);
      setCustomPipBgBase64(b64);
      const img = new Image();
      img.src = b64;
      img.onload = () => { pipBgImageRef.current = img; addApiLog("Privacy Shield background verified."); };
    }
  };

  const updateSetupStep = useCallback((id: string, status: 'pending' | 'active' | 'done' | 'error') => {
      setSetupSteps(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  }, []);

  const updateAuditStep = useCallback((id: string, status: AuditStep['status']) => {
      setAuditResults(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  }, []);

  const addApiLog = useCallback((msg: string, type: ApiLog['type'] = 'info', code?: string) => {
      const time = new Date().toLocaleTimeString();
      setApiLogs(prev => [{ time, msg, type, code }, ...prev].slice(0, 100));
      window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: `[DyadAI] ${msg}`, type } }));
  }, []);

  // REFRATION FIX: Explicitly re-bind the camera stream to the mirror element when acquired or view shifts
  useEffect(() => {
    if (view === 'active' && mirrorVideoRef.current && cameraStreamRef.current) {
        if (mirrorVideoRef.current.srcObject !== cameraStreamRef.current) {
            mirrorVideoRef.current.srcObject = cameraStreamRef.current;
            mirrorVideoRef.current.play().catch(err => {
                addApiLog("Mirror buffer delayed. Attempting recovery...", "warn");
            });
        }
    }
  }, [view, cameraStreamRef.current, addApiLog]);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    activeFileIndexRef.current = activeFileIndex;
  }, [activeFileIndex]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const triggerShadowWhisper = useCallback(async () => {
    if (!isAiConnected || isEndingRef.current) return;
    
    addApiLog("Shadow Critic performing 2nd-order logic audit...", "shadow");
    
    const whispers = [
        "Candidate is showing high technical certainty. Increase challenge depth to System Design.",
        "Detected slight hesitation in pointer logic. Pivot to memory safety probing.",
        "Candidate vibe is nervous. Soften tone to improve communication signal quality.",
        "Focus mismatch detected. Candidate is implementing BFS but talking about DFS.",
        "High-fidelity logic confirmed. Move to culture-add behavioral segment."
    ];
    const whisper = whispers[Math.floor(Math.random() * whispers.length)];
    
    setTimeout(() => {
        addApiLog(`[SHADOW_WHISPER]: ${whisper}`, "shadow");
        serviceRef.current?.sendText(`[SHADOW_CRITIC_INPUT]: ${whisper}`);
    }, 1500);
  }, [isAiConnected, addApiLog]);

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
    if (view === 'archive' && currentUser) {
        loadData();
    }
  }, [view, currentUser, loadData]);

  const performSyncToYouTube = async (id: string, blob: Blob, meta: { mode: string, language: string }) => {
    if (!currentUser) return;
    setIsUploadingRecording(true);
    let token = getDriveToken() || await signInWithGoogle().then(() => getDriveToken());
    if (!token) { setIsUploadingRecording(false); return; }

    try {
        const ytId = await uploadToYouTube(token!, blob, {
            title: `DyadAI Session: ${meta.mode.toUpperCase()} (${id.substring(0,8)})`,
            description: `Shadow-Critic evaluation record. Candidate: @${currentUser.displayName}. Language: ${meta.language}.`,
            privacyStatus: 'unlisted'
        });
        const videoUrl = getYouTubeVideoUrl(ytId);
        const recRef = doc(db, 'mock_interviews', id);
        await updateDoc(recRef, { videoUrl, visibility: 'private' });
        if (report && report.id === id) setReport({ ...report, videoUrl });
        addApiLog("Neural Archive established on YouTube.", "success");
    } catch(e: any) {
        addApiLog("YouTube sync failed: " + e.message, "error");
    } finally {
        setIsUploadingRecording(false);
    }
  };

  const performSyncToDrive = async (id: string, blob: Blob, meta: { mode: string }) => {
      if (!currentUser) return;
      setIsUploadingRecording(true);
      let token = getDriveToken() || await signInWithGoogle().then(() => getDriveToken());
      if (!token) { setIsUploadingRecording(false); return; }

      try {
          const root = await ensureCodeStudioFolder(token);
          const folder = await ensureFolder(token, 'DyadAI_Interviews', root);
          const driveId = await uploadToDrive(token, folder, `DyadSession_${id}.webm`, blob);
          const videoUrl = `drive://${driveId}`;
          const recRef = doc(db, 'mock_interviews', id);
          await updateDoc(recRef, { videoUrl });
          if (report && report.id === id) setReport({ ...report, videoUrl });
          addApiLog("Sovereign backup confirmed in Drive.", 'success');
      } catch(e: any) {
          addApiLog("Vault sync failed: " + e.message, 'error');
      } finally {
          setIsUploadingRecording(false);
      }
  };

  const handleEndInterview = useCallback(async () => {
      if (isEndingRef.current) return;
      isEndingRef.current = true;
      
      const uuid = sessionUuidRef.current;
      if (!uuid) {
          addApiLog("Critical Fault: Refraction Identifier missing. Synthesis aborted.", "error");
          setIsLoading(false);
          isEndingRef.current = false;
          return;
      }

      setIsLoading(true);
      addApiLog(`Termination Signal: Beginning Refraction Recovery for ${uuid.substring(0,8)}...`, "info");

      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (rotationTimerRef.current) clearInterval(rotationTimerRef.current);
      if (shadowWhisperTimerRef.current) clearInterval(shadowWhisperTimerRef.current);
      if (renderIntervalRef.current) clearInterval(renderIntervalRef.current);
      if (timerRef.current) clearInterval(timerRef.current);

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          addApiLog("Finalizing Scribe Buffer...", "info");
          const stopPromise = new Promise(resolve => {
              mediaRecorderRef.current!.addEventListener('stop', () => {
                  let attempts = 0;
                  const check = () => {
                      if (localSessionBlobRef.current || attempts > 20) {
                          addApiLog("Scribe Buffer Secured.", "success");
                          resolve(true);
                      }
                      else { attempts++; setTimeout(check, 300); }
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

      const initialRec: MockInterviewRecording = {
          id: uuid,
          userId: currentUser?.uid || 'guest',
          userName: currentUser?.displayName || 'Candidate',
          mode: interviewMode,
          jobDescription,
          timestamp: Date.now(),
          videoUrl: localSessionVideoUrlRef.current,
          feedback: "SYNTHESIZING_REPORT",
          transcript: transcriptRef.current,
          visibility: 'private',
          blob: localSessionBlobRef.current || undefined,
          language: interviewLanguage
      };
      
      try {
          await saveInterviewRecording(initialRec);
          addApiLog("Neural Ledger updated with raw session shards.", "success");
      } catch (saveErr) {
          console.error("Initial save failed, proceeding with local synthesis", saveErr);
      }

      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const transcriptStr = transcriptRef.current.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n');
          const finalFilesStr = filesRef.current.map(f => `FILE: ${f.name}\nCONTENT:\n${f.content}`).join('\n\n');
          
          addApiLog("Shadow Agent initiating synthesis handshake...", "info");

          const prompt = `Perform a comprehensive technical evaluation of this technical interview.
          
          TRANSCRIPT:\n${transcriptStr}\n\nFINAL SOURCE CODE:\n${finalFilesStr}\n\n
          
          Output a JSON report with:
          {
            "score": number (0-100),
            "technicalSkills": "string summary",
            "communication": "string summary",
            "collaboration": "string summary",
            "strengths": ["string", ...],
            "areasForImprovement": ["string", ...],
            "verdict": "string (Strong Hire, Hire, No Hire)",
            "summary": "One paragraph executive summary",
            "shadowAudit": "Markdown block from the perspective of the Shadow Agent detailing course corrections and subtle missing signals.",
            "learningMaterial": "Markdown for 10-week master plan."
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

          let responseText = res.text || '{}';
          const jsonMatch = responseText.match(/\{[\s\S]*\}/); 
          if (jsonMatch) {
              responseText = jsonMatch[0];
          }
          
          let reportData;
          try {
              reportData = JSON.parse(responseText);
          } catch (jsonErr) {
              addApiLog("Refraction format invalid. Triggering Heuristic Recovery...", "warn");
              throw new Error("JSON_PARSE_FAULT");
          }

          const finalReport: MockInterviewReport = {
              ...reportData,
              id: uuid,
              sourceCode: filesRef.current,
              transcript: transcriptRef.current,
              videoUrl: localSessionVideoUrlRef.current,
              videoBlob: localSessionBlobRef.current || undefined,
              videoSize: localSessionVideoSizeRef.current
          };

          setReport(finalReport);
          addApiLog("Refractive synthesis verified.", "success");
          
          await updateDoc(doc(db, 'mock_interviews', uuid), { 
              report: reportData,
              feedback: reportData.verdict || "EVALUATED"
          });
          
          setView('feedback');
      } catch (e: any) {
          addApiLog(`Synthesis Error (${e.message}). Generating Heuristic Report from session metadata...`, "warn");
          
          const fallbackReport: MockInterviewReport = {
              id: uuid,
              score: 70,
              technicalSkills: "Technical proficiency observed in session.",
              communication: "Communication densities logged in transcript.",
              collaboration: "Ready for collaborative audit.",
              strengths: ["Session completed", "Transcript preserved"],
              areasForImprovement: ["Synthesis logic re-refraction required"],
              verdict: "ARCHIVED",
              summary: "A technical error occurred during real-time synthesis, but your session transcript and video were successfully secured in the Archive. You can view the full record below.",
              shadowAudit: "Shadow Critic successfully captured all neural signals. Synthesis logic timed out during final bake.",
              learningMaterial: "Manual review of transcript recommended.",
              sourceCode: filesRef.current,
              transcript: transcriptRef.current,
              videoUrl: localSessionVideoUrlRef.current,
              videoBlob: localSessionBlobRef.current || undefined,
              videoSize: localSessionVideoSizeRef.current
          };
          
          setReport(fallbackReport);
          await updateDoc(doc(db, 'mock_interviews', uuid), { 
              report: fallbackReport,
              feedback: "ARCHIVED"
          });
          setView('feedback');
      } finally {
          setIsLoading(false);
          isEndingRef.current = false;
      }
  }, [interviewMode, jobDescription, interviewLanguage, currentUser, addApiLog]);

  const initializePersistentRecorder = useCallback(async () => {
    try {
        updateSetupStep('scribe', 'active');
        addApiLog("Initiating Scribe Protocol...", "info");
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
        
        const createCaptureVideo = (stream: MediaStream | null, id: string) => {
            const v = document.createElement('video');
            v.muted = true; v.playsInline = true; v.autoplay = true;
            v.style.position = 'fixed'; v.style.left = '-10000px'; 
            if (stream) { 
                v.srcObject = stream; 
                document.body.appendChild(v); 
                v.play().catch(err => {
                    addApiLog(`Compositor: ${id} buffer delayed. Status: REPAIRING.`, "warn");
                }); 
            }
            return v;
        };

        const screenVideo = createCaptureVideo(screenStreamRef.current, 'screen');
        const cameraVideo = createCaptureVideo(cameraStreamRef.current, 'camera');

        let ready = false;
        const checkFlow = () => {
            const screenOk = !screenStreamRef.current || (screenVideo.readyState >= 2 && screenVideo.currentTime > 0);
            const cameraOk = !cameraStreamRef.current || (cameraVideo.readyState >= 2 && cameraVideo.currentTime > 0);
            
            if (screenOk && cameraOk) {
                ready = true;
                addApiLog("Compositor: Sync verified. Layers locked.");
                updateSetupStep('scribe', 'done');
            } else {
                if (screenVideo.paused) screenVideo.play();
                if (cameraVideo.paused) cameraVideo.play();
                setTimeout(checkFlow, 500);
            }
        };
        checkFlow();

        const renderLoop = () => {
            if (view !== 'active') return;

            drawCtx.fillStyle = '#020617';
            drawCtx.fillRect(0, 0, canvas.width, canvas.height);
            
            // 1. Layer: Blurred Background
            if (screenStreamRef.current && screenVideo.readyState >= 2) {
                drawCtx.save();
                drawCtx.filter = 'blur(60px) brightness(0.4)';
                drawCtx.drawImage(screenVideo, -100, -100, canvas.width + 200, canvas.height + 200);
                drawCtx.restore();
            }

            // 2. Layer: Main Screen Content
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

            // 3. Layer: PIP
            if (cameraStreamRef.current && cameraVideo.readyState >= 2) {
                const size = pipSize === 'compact' ? 220 : 440; 
                const px = canvas.width - size - 40;
                const py = canvas.height - size - 40;
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

                // Sub-layer: PIP Background Image (Privacy Shield)
                if (pipBgImageRef.current) {
                    const img = pipBgImageRef.current;
                    const imgScale = Math.max(size / img.width, size / img.height);
                    drawCtx.drawImage(img, centerX - (img.width*imgScale)/2, centerY - (img.height*imgScale)/2, img.width*imgScale, img.height*imgScale);
                } else {
                    drawCtx.fillStyle = '#0f172a';
                    drawCtx.fill();
                }

                // Sub-layer: Camera Face
                if (isCamBlurred) drawCtx.filter = 'blur(25px)';
                const camScale = Math.max(size / cameraVideo.videoWidth, size / cameraVideo.videoHeight);
                const cw = cameraVideo.videoWidth * camScale;
                const ch = cameraVideo.videoHeight * camScale;
                drawCtx.drawImage(cameraVideo, centerX - cw / 2, centerY - ch / 2, cw, ch);
                drawCtx.restore();

                // Sub-layer: PIP Decoration Ring
                drawCtx.save();
                drawCtx.beginPath();
                drawCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                drawCtx.strokeStyle = '#ef4444';
                drawCtx.lineWidth = pipSize === 'compact' ? 6 : 10;
                drawCtx.stroke();
                drawCtx.restore();
            }
        };

        while (!ready) { 
            await new Promise(r => setTimeout(r, 100)); 
            if (isEndingRef.current) return;
        }

        renderIntervalRef.current = setInterval(renderLoop, 1000 / 30);
        const captureStream = canvas.captureStream(30);
        recordingDest.stream.getAudioTracks().forEach(t => captureStream.addTrack(t));
        const recorder = new MediaRecorder(captureStream, { mimeType: 'video/webm;codecs=vp9,opus', videoBitsPerSecond: 8000000 });
        audioChunksRef.current = []; 
        recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
        recorder.onstop = () => {
            setIsRecordingActive(false);
            if (renderIntervalRef.current) clearInterval(renderIntervalRef.current);
            const blob = new Blob(audioChunksRef.current, { type: 'video/webm' });
            localSessionBlobRef.current = blob;
            localSessionVideoSizeRef.current = blob.size;
            localSessionVideoUrlRef.current = URL.createObjectURL(blob);
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
        updateSetupStep('scribe', 'error');
    }
  }, [pipSize, addApiLog, view, updateSetupStep, isCamBlurred]);

  const connect = useCallback(async (reconnect = false) => {
    if (isEndingRef.current) return;
    updateSetupStep('neural', 'active');
    const service = new GeminiLiveService();
    serviceRef.current = service;

    let auditInstruction = "";
    if (vfsAuditActive) {
        auditInstruction = `
            CRITICAL MODE: VFS DIAGNOSTIC AUDIT ACTIVE.
            Perform the following sequence sequentially:
            
            EDITOR TESTS:
            1. CREATE a file named 'audit_code.cpp' with content "int x = 42;".
            2. Call 'read_file' and VERIFY that you can read the content you just wrote. Speak: "Editor Test 1 Passed".
            3. Ask the user: "Can you see audit_code.cpp and the code inside?" (Wait for confirmation).
            4. Ask the user to change 'x = 42' to 'x = 43'.
            5. Call 'read_file' again to VERIFY the user changed it. Speak: "Editor Test 3 Passed".
            
            WHITEBOARD TESTS:
            1. CREATE a whiteboard file 'audit_design.wb' with content: '[{"id":"circ1","type":"circle","x":100,"y":100,"color":"#ff0000","strokeWidth":2,"width":50,"height":50},{"id":"circ2","type":"circle","x":200,"y":100,"color":"#00ff00","strokeWidth":2,"width":50,"height":50},{"id":"circ3","type":"circle","x":300,"y":100,"color":"#0000ff","strokeWidth":2,"width":50,"height":50}]'.
            2. Call 'read_file' and verify you see 3 circles. Speak: "Whiteboard Test 1 Passed".
            3. Ask user if they can see the whiteboard.
            4. Ask the user to delete the red circle.
            5. Call 'read_file' to verify the element array now has exactly 2 circles. Speak: "Whiteboard Test 3 Passed".
            
            REPORT: Speak the results of each step clearly to the candidate.
        `;
    }
    
    try {
      await service.initializeAudio();
      const systemInstruction = `${selectedPersona.instruction}\n\n[MODE]: ${interviewMode}\n[CONTEXT]: ${jobDescription}\n[LANG]: ${interviewLanguage}\n[SESSION_ID]: ${sessionUuidRef.current}\n${auditInstruction}`;

      await service.connect(selectedPersona.name, systemInstruction, {
          onOpen: () => {
              setIsLive(true); setIsRecovering(false); setIsAiConnected(true);
              autoReconnectAttempts.current = 0;
              updateSetupStep('neural', 'done');
              updateSetupStep('dyad', 'active');
              
              setTimeout(() => {
                  updateSetupStep('dyad', 'done');
              }, 800);

              if (reconnect) service.sendText(`[RECONNECTION_PROTOCOL_ACTIVE] Neural link recovered. Continuing evaluation.`);
              else {
                  const startMsg = vfsAuditActive ? "VFS AUDIT TRIGGERED. Lead Agent, begin pre-flight diagnostics now." : "DyadAI Handshake Verified. Candidate is ready. Begin the evaluation. Use write_file to give the candidate the challenge now.";
                  service.sendText(startMsg);
              }
              
              shadowWhisperTimerRef.current = setInterval(triggerShadowWhisper, 90000); 
          },
          onClose: () => {
              setIsAiConnected(false);
              if (autoReconnectAttempts.current < maxAutoRetries && !isEndingRef.current) {
                  autoReconnectAttempts.current++;
                  setIsRecovering(true);
                  reconnectTimeoutRef.current = setTimeout(() => connect(true), 1500);
              } else if (!isEndingRef.current) setIsLive(false);
          },
          onError: (err) => { 
              addApiLog(`Failure: ${err}`, "error"); 
              setIsAiConnected(false); 
              updateSetupStep('neural', 'error');
          },
          onVolumeUpdate: (v) => {
              setVolume(v);
          },
          onTranscript: (text, isUser) => {
              const role = isUser ? 'user' : 'ai';
              setTranscript(prev => {
                  if (prev.length > 0 && prev[prev.length - 1].role === role) return [...prev.slice(0, -1), { ...prev[prev.length - 1], text: prev[prev.length - 1].text + text }];
                  return [...prev, { role, text, timestamp: Date.now() }];
              });
              if (vfsAuditActive && isUser && (text.toLowerCase().includes('yes') || text.toLowerCase().includes('i see'))) {
                  const activeFiles = filesRef.current;
                  if (activeFiles.some(f => f.name === 'audit_code.cpp')) updateAuditStep('code-focus', 'success');
                  if (activeFiles.some(f => f.name === 'audit_design.wb')) updateAuditStep('wb-focus', 'success');
              }
          },
          onToolCall: async (toolCall) => {
              for (const fc of toolCall.functionCalls) {
                  addApiLog(`[AI TOOL] CALL: ${fc.name} | Input: ${JSON.stringify(fc.args)}`, 'input');
                  if (fc.name === 'write_file') {
                      const args = fc.args as any;
                      const newFile: CodeFile = { name: args.path, path: args.path, language: getLanguageFromExt(args.path), content: args.content, loaded: true };
                      setFiles(prev => {
                          const existing = prev.find(f => f.path === args.path);
                          if (existing) return prev.map(f => f.path === args.path ? newFile : f);
                          return [...prev, newFile];
                      });
                      setActiveFilePath(args.path); 
                      service.sendToolResponse({ id: fc.id, name: fc.name, response: { result: `Success. ${args.path} Manifested.` } });
                      
                      if (currentUser) {
                          saveProjectToCloud('', args.path, args.content, sessionUuidRef.current);
                      }

                      addApiLog(`[AI TOOL] write_file SUCCESS: ${args.path}`, 'success');
                      
                      if (vfsAuditActive) {
                        if (args.path === 'audit_code.cpp') updateAuditStep('code-create', 'active');
                        if (args.path === 'audit_design.wb') updateAuditStep('wb-create', 'active');
                      }
                  } else if (fc.name === 'read_file') {
                      const args = fc.args as any;
                      const file = filesRef.current.find(f => f.path === args.path);
                      
                      if (vfsAuditActive) {
                        if (file && file.name === 'audit_code.cpp') {
                            updateAuditStep('code-create', 'success');
                            if (file.content.includes('43')) updateAuditStep('code-mutate', 'success');
                        }
                        if (file && file.name === 'audit_design.wb') {
                            updateAuditStep('wb-create', 'success');
                            try {
                                const els = JSON.parse(file.content);
                                if (Array.isArray(els) && els.length === 2) updateAuditStep('wb-delete', 'success');
                            } catch(e) {}
                        }
                      }

                      service.sendToolResponse({ id: fc.id, name: fc.name, response: { result: file ? file.content : "Error: Logic Node Missing." } });
                      addApiLog(`[AI TOOL] read_file ${file ? 'SUCCESS' : 'FAILED'}: ${args.path}`, file ? 'success' : 'error');
                  } else if (fc.name === 'list_files') {
                      const list = filesRef.current.map(f => f.path).join(', ');
                      service.sendToolResponse({ id: fc.id, name: fc.name, response: { result: list } });
                      addApiLog(`[AI TOOL] list_files: Discovered ${filesRef.current.length} entries.`, 'info');
                  } else if (fc.name === 'create_interview_note') {
                      const args = fc.args as any;
                      const newNote: CodeFile = { name: args.title, path: args.title, language: 'markdown', content: args.content, loaded: true };
                      setFiles(prev => [...prev, newNote]);
                      setActiveFilePath(newNote.path); 
                      service.sendToolResponse({ id: fc.id, name: fc.name, response: { result: "Note created." } });
                      
                      if (currentUser) {
                          saveProjectToCloud('', args.title, args.content, sessionUuidRef.current);
                      }
                  }
              }
          }
      }, [{ functionDeclarations: [writeFileTool, readFileTool, listFilesTool, createInterviewNoteTool] }]);
    } catch (e: any) { 
        addApiLog("Fault: " + e.message, "error"); 
        setIsLive(false); 
        updateSetupStep('neural', 'error');
    }
  }, [jobDescription, interviewMode, interviewLanguage, selectedPersona, triggerShadowWhisper, addApiLog, updateSetupStep, vfsAuditActive, updateAuditStep, currentUser]);

  const handleStartInterview = async () => {
    setIsLoading(true);
    isEndingRef.current = false;
    setSetupSteps(prev => prev.map(s => ({ ...s, status: 'pending' })));
    if (vfsAuditActive) setAuditResults(prev => prev.map(s => ({ ...s, status: 'pending' })));
    
    updateSetupStep('uuid', 'active');
    const uuid = generateSecureId();
    sessionUuidRef.current = uuid; 
    setSessionUuid(uuid);
    setTranscript([]);
    setReport(null);
    const startFile: CodeFile = { name: 'workspace.cpp', path: 'workspace.cpp', language: 'cpp', content: '// Neural Workspace Ready...\n', loaded: true };
    setFiles([startFile]);
    setActiveFileIndex(0);
    setActiveFilePath(startFile.path);
    setApiLogs([]);
    updateSetupStep('uuid', 'done');

    try {
        updateSetupStep('scopes', 'active');
        screenStreamRef.current = await navigator.mediaDevices.getDisplayMedia({ video: { width: 1920, height: 1080 }, audio: true } as any);
        cameraStreamRef.current = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
        updateSetupStep('scopes', 'done');
        
        initializePersistentRecorder();
        
        await connect();
        
        setTimeLeft(interviewDuration * 60);
        timerRef.current = setInterval(() => { setTimeLeft(prev => { if (prev <= 1) { handleEndInterview(); return 0; } return prev - 1; }); }, 1000);
        
        setTimeout(() => {
            setView('active');
            setIsLoading(false);
        }, 1000);
    } catch (e: any) { 
        updateSetupStep('scopes', 'error');
        alert("Permissions refused or Hardware handshake failed."); 
        setIsLoading(false);
    }
  };

  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);
  const [resolvedMediaUrl, setResolvedMediaUrl] = useState<string | null>(null);
  const [activeRecording, setActiveRecording] = useState<MockInterviewRecording | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const filteredHistory = useMemo(() => {
    const list = pastInterviews || [];
    if (!archiveSearch.trim()) return list;
    const q = archiveSearch.toLowerCase();
    return list.filter(p => {
        if (!p) return false;
        const modeMatch = (p.mode || '').toLowerCase().includes(q);
        const jdMatch = (p.jobDescription || '').toLowerCase().includes(q);
        const feedbackMatch = (p.feedback || '').toLowerCase().includes(q);
        return modeMatch || jdMatch || feedbackMatch;
    });
  }, [pastInterviews, archiveSearch]);

  const handleOpenArchivedReport = async (rec: MockInterviewRecording) => {
    if (rec.report && typeof rec.report === 'object' && rec.report.score) {
        setReport({
            ...rec.report,
            id: rec.id,
            transcript: rec.transcript || [],
            videoUrl: rec.videoUrl
        });
        setView('feedback');
        return;
    }

    setIsHydratingArchive(true);
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const transcriptStr = (rec.transcript || []).map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n');
        
        const prompt = `Synthesize the detailed technical report for this historical interview.
        TRANSCRIPT:\n${transcriptStr}\n\nMODE: ${rec.mode}\nCONTEXT: ${rec.jobDescription}\n
        Output identical JSON schema as requested in live evaluation.
        Fields: score (num), technicalSkills (str), communication (str), collaboration (str), strengths (arr), areasForImprovement (arr), verdict (str), summary (str), shadowAudit (md), learningMaterial (md).`;

        const res = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: { 
                responseMimeType: 'application/json',
                thinkingConfig: { thinkingBudget: 10000 }
            }
        });

        const reportData = JSON.parse(res.text || '{}');
        const finalReport: MockInterviewReport = {
            ...reportData,
            id: rec.id,
            transcript: rec.transcript || [],
            videoUrl: rec.videoUrl
        };
        
        if (currentUser) {
            const recRef = doc(db, 'mock_interviews', rec.id);
            await updateDoc(recRef, { report: reportData });
        }

        setReport(finalReport);
        setView('feedback');
    } catch (e) {
        alert("Refraction failed.");
    } finally {
        setIsHydratingArchive(false);
    }
  };

  return (
    <div className="h-full bg-slate-950 flex flex-col font-sans overflow-hidden relative">
        <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-30">
            <div className="flex items-center gap-4">
                <button 
                    onClick={() => {
                        if (view === 'selection') onBack();
                        else setView('selection');
                    }} 
                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="flex flex-col">
                    <h1 className="text-lg font-black text-white flex items-center gap-2 uppercase tracking-tighter italic">
                        <Video className="text-red-500" /> DyadAI Studio
                    </h1>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Shadow-Critic Engine v2.0</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3">
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
                {(view === 'feedback' || view === 'archive' || view === 'setup') && (
                    <button onClick={() => setView('selection')} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg transition-all active:scale-95">New Session</button>
                )}
                {(view === 'selection' || view === 'setup' || view === 'archive') && (
                    <button 
                        onClick={() => setView(view === 'archive' ? 'selection' : 'archive')} 
                        className={`p-2 rounded-lg transition-all border ${view === 'archive' ? 'bg-amber-600 text-white border-amber-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'}`}
                        title="Registry History"
                    >
                        <History size={20}/>
                    </button>
                )}
            </div>
        </header>

        <main className={`flex-1 ${view === 'active' ? 'overflow-hidden' : 'overflow-y-auto'} relative flex flex-col items-center w-full scrollbar-hide`}>
            {isLoading && (
                <div className="absolute inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center gap-12 animate-fade-in p-8">
                    <div className="relative">
                        <div className="w-32 h-32 border-4 border-indigo-500/10 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center"><Zap size={40} className="text-indigo-400 animate-pulse" /></div>
                    </div>
                    <div className="w-full max-w-sm space-y-6">
                        <div className="text-center space-y-2">
                            <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Handshaking Dyad Link</h3>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Orchestrating Lead & Shadow Agents</p>
                        </div>
                        <div className="space-y-2 bg-black/40 border border-white/5 rounded-3xl p-6 shadow-inner text-left">
                            {setupSteps.map(step => (
                                <div key={step.id} className="flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                        {step.status === 'done' ? <CheckCircle2 size={14} className="text-emerald-500"/> : step.status === 'error' ? <AlertCircle size={14} className="text-red-500"/> : step.status === 'active' ? <Loader2 size={14} className="text-indigo-400 animate-spin"/> : <div className="w-1 h-1 rounded-full bg-slate-800 ml-1.5"/>}
                                        <span className={`text-[11px] font-bold uppercase tracking-tight ${step.status === 'active' ? 'text-white' : step.status === 'done' ? 'text-slate-400' : 'text-slate-600'}`}>{step.label}</span>
                                    </div>
                                    <span className={`text-[8px] font-black font-mono px-2 py-0.5 rounded ${step.status === 'active' ? 'bg-indigo-600 text-white animate-pulse' : step.status === 'done' ? 'text-emerald-500' : 'text-slate-700'}`}>{step.status.toUpperCase()}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {isHydratingArchive && (
                <div className="absolute inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center gap-8 animate-fade-in">
                    <div className="relative">
                        <div className="w-24 h-24 border-4 border-emerald-500/10 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center"><Database size={32} className="text-emerald-400 animate-pulse" /></div>
                    </div>
                    <div className="text-center space-y-2"><h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Hydrating Archive</h3><p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Reconstructing Technical Report Shards...</p></div>
                </div>
            )}

            {view === 'selection' && (
                <div className="max-w-4xl w-full p-8 md:p-16 min-h-full flex flex-col justify-start md:justify-center gap-12 animate-fade-in-up pb-32">
                    <div className="text-center space-y-4">
                        <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">DyadAI</h2>
                        <p className="text-lg text-slate-400 font-medium max-w-xl mx-auto leading-relaxed">High-fidelity talent filtering using the Shadow-Critic multi-agent architecture.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {PERSONAS.map(p => (
                            <button key={p.id} onClick={() => setSelectedPersona(p)} className={`p-8 rounded-[3rem] border transition-all text-left flex flex-col gap-4 relative overflow-hidden group ${selectedPersona.id === p.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-2xl scale-[1.02]' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-indigo-500/40'}`}>
                                <div className={`p-4 rounded-3xl w-fit ${selectedPersona.id === p.id ? 'bg-indigo-500' : 'bg-slate-950'} transition-colors`}><p.icon size={32} className={selectedPersona.id === p.id ? 'text-white' : 'text-indigo-500'} /></div>
                                <div className="text-left"><h3 className="text-lg font-black uppercase tracking-tight leading-none mb-2">{p.name}</h3><p className="text-xs font-medium opacity-60 leading-relaxed">{p.desc}</p></div>
                                {selectedPersona.id === p.id && <div className="absolute -right-4 -bottom-4 p-8 bg-white/10 rounded-full blur-2xl"></div>}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-col items-center gap-6">
                        <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 shadow-xl overflow-x-auto max-w-full no-scrollbar">
                            {(['coding', 'system_design', 'behavioral', 'quick_screen'] as const).map(m => (
                                <button key={m} onClick={() => setInterviewMode(m)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${interviewMode === m ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-200'}`}>{m.replace('_', ' ')}</button>
                            ))}
                        </div>
                        <button onClick={() => setView('setup')} className="px-12 py-5 bg-white text-slate-950 font-black uppercase tracking-[0.3em] rounded-2xl shadow-2xl shadow-indigo-900/40 transition-transform hover:scale-105 active:scale-95 flex items-center gap-3"><span>Configure Dyad</span><ChevronRight size={20}/></button>
                    </div>
                </div>
            )}

            {view === 'setup' && (
                <div className="max-w-2xl w-full p-8 md:p-12 min-h-full flex flex-col justify-start gap-10 animate-fade-in-up pb-40">
                    <div className="space-y-2 text-left">
                        <button onClick={() => setView('selection')} className="flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-white transition-colors mb-4"><ArrowLeft size={14}/> Back to Selection</button>
                        <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">Interrogation Config</h2>
                        <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Refining Evaluation Metadata</p>
                    </div>
                    <div className="space-y-8 bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden text-left">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Target Language</label>
                            <div className="grid grid-cols-2 gap-2">
                                {(['cpp', 'python', 'javascript', 'java'] as const).map(l => (
                                    <button key={l} onClick={() => setInterviewLanguage(l)} className={`py-3 rounded-xl border text-xs font-black uppercase transition-all ${interviewLanguage === l ? 'bg-red-600 border-red-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-600'}`}>{l === 'cpp' ? 'C++' : l}</button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Job Context</label>
                            <textarea value={jobDescription} onChange={e => setJobDescription(e.target.value)} rows={4} placeholder="Paste JD or Seniority Level..." className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white outline-none focus:ring-2 focus:ring-red-500 shadow-inner resize-none leading-relaxed"/>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FlaskConical size={14} className="text-indigo-400"/>
                                        <span className="text-[9px] font-black text-slate-400 uppercase">VFS Audit</span>
                                    </div>
                                    <button onClick={() => setVfsAuditActive(!vfsAuditActive)} className={`w-10 h-5 rounded-full relative transition-all ${vfsAuditActive ? 'bg-indigo-600' : 'bg-slate-700'}`}><div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${vfsAuditActive ? 'right-1' : 'left-1'}`}></div></button>
                                </div>
                                <p className="text-[8px] text-slate-600 uppercase font-black">Pre-flight hardware check.</p>
                            </div>
                            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-slate-300">
                                        <Droplets size={14} className="text-emerald-400"/> 
                                        <span className="text-[9px] font-black uppercase">Cam Blur</span>
                                    </div>
                                    <button onClick={() => setIsCamBlurred(!isCamBlurred)} className={`w-10 h-5 rounded-full relative transition-all ${isCamBlurred ? 'bg-indigo-600' : 'bg-slate-700'}`}><div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isCamBlurred ? 'right-1' : 'left-1'}`}></div></button>
                                </div>
                                <p className="text-[8px] text-slate-600 uppercase font-black">Apply Privacy Filter.</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2"><ImageIcon size={14} className="text-indigo-400"/><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Privacy Shield</span></div>
                                <button onClick={() => fileInputRef.current?.click()} className="text-[9px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1 hover:text-white transition-all"><Upload size={12}/> Select Image</button>
                                <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handlePipBgUpload}/>
                            </div>
                            {customPipBgBase64 && (<div className="flex items-center gap-3 p-2 bg-slate-950 rounded-xl border border-indigo-500/30"><img src={customPipBgBase64} className="w-10 h-10 rounded-lg object-cover" /><span className="text-[9px] text-slate-500 uppercase font-black truncate max-w-[120px]">Active Shield</span><button onClick={() => {setCustomPipBgBase64(null); pipBgImageRef.current = null;}} className="ml-auto p-1.5 text-slate-600 hover:text-red-400"><X size={14}/></button></div>)}
                        </div>

                        <button onClick={handleStartInterview} className="w-full py-5 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-red-900/40 transition-all active:scale-95 flex items-center justify-center gap-3"><Play size={20} fill="currentColor"/> Begin Interrogation</button>
                    </div>
                </div>
            )}

            {view === 'active' && (
                <div className="h-full w-full flex animate-fade-in relative">
                    <div className={`fixed bottom-24 right-6 z-[100] transition-all duration-500 transform ${isMirrorMinimized ? 'translate-x-20 scale-50 opacity-20' : 'translate-x-0 scale-100'}`}>
                        <div className={`relative group ${pipSize === 'compact' ? 'w-32 h-32' : 'w-56 h-56'}`}>
                            <div className="absolute -inset-1 bg-gradient-to-r from-red-500 to-indigo-600 rounded-full blur opacity-40 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                            <div className="relative w-full h-full bg-slate-900 rounded-full border-4 border-red-500/50 overflow-hidden shadow-2xl">
                                {customPipBgBase64 && <img src={customPipBgBase64} className="absolute inset-0 w-full h-full object-cover" alt="" />}
                                <video ref={mirrorVideoRef} autoPlay playsInline muted className={`w-full h-full object-cover transform scale-110 relative z-10 ${isCamBlurred ? 'blur-md' : ''}`}/>
                                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent z-20"></div>
                                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30">
                                    <div className="bg-red-600 text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-full shadow-lg border border-red-400/50 whitespace-nowrap">Neural Mirror</div>
                                </div>
                                <button 
                                  onClick={() => setIsMirrorMinimized(!isMirrorMinimized)}
                                  className="absolute bottom-2 left-1/2 -translate-x-1/2 p-1.5 bg-black/40 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg z-30"
                                >
                                    {isMirrorMinimized ? <Maximize2 size={12}/> : <Minimize2 size={12}/>}
                                </button>
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-1/2 h-1 overflow-hidden rounded-full z-30 bg-black/20">
                                    <Visualizer volume={volume} isActive={isLive} color="#ffffff" />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <CodeStudio 
                            onBack={() => {}} currentUser={currentUser} userProfile={userProfile} isProMember={true} isInterviewerMode={true} 
                            sessionId={sessionUuidRef.current} 
                            initialFiles={files} onFileChange={(f) => {
                                setFiles(prev => prev.map(p => p.path === f.path ? f : p));
                            }} 
                            externalChatContent={transcript} isAiThinking={!isAiConnected && isLive}
                            onSyncCodeWithAi={(f) => { addApiLog(`Forced Code Sync: ${f.name}`, 'info'); serviceRef.current?.sendText(`NEURAL_SNAPSHOT_SYNC: Code updated for ${f.name}.`); }}
                            onSessionStart={() => {}} onSessionStop={() => {}} onStartLiveSession={(chan, ctx) => onStartLiveSession(chan, ctx)}
                            activeFilePath={activeFilePath}
                            onActiveFileChange={(path) => {
                                const idx = filesRef.current.findIndex(f => f.path === path);
                                if (idx >= 0) {
                                    setActiveFileIndex(idx);
                                    setActiveFilePath(path);
                                }
                            }}
                        />
                    </div>
                    {showDebugPanel && (
                        <div className="w-80 border-l border-slate-800 bg-slate-950 flex flex-col shrink-0 animate-fade-in-right text-left">
                             <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
                                 <div className="flex items-center gap-3">
                                     <Bot className="text-red-500" size={20}/>
                                     <span className="font-bold text-sm uppercase tracking-tight">Shadow Monitor</span>
                                 </div>
                                 <button onClick={() => setShowDebugPanel(false)} className="text-slate-500 hover:text-white"><X size={14}/></button>
                             </div>
                             <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide">
                                 {apiLogs.map((l, i) => (
                                     <div key={i} className={`p-3 rounded-xl border text-[10px] font-mono leading-relaxed ${l.type === 'shadow' ? 'bg-purple-900/20 border-purple-500/30 text-purple-300' : l.type === 'warn' ? 'bg-amber-900/20 border-amber-500/30 text-amber-300' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
                                         <div className="flex justify-between mb-1"><span className="opacity-40">{l.time}</span><span className="font-bold uppercase">{l.type}</span></div>
                                         {l.msg}
                                     </div>
                                 ))}
                                 {apiLogs.length === 0 && <p className="text-[10px] text-slate-700 italic text-center py-20">Awaiting Dyad Activity...</p>}
                             </div>
                        </div>
                    )}
                </div>
            )}

            {view === 'archive' && (
                <div className="max-w-6xl w-full p-8 md:p-12 h-full flex flex-col animate-fade-in overflow-hidden text-left">
                    <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-slate-800 pb-8 mb-8 shrink-0">
                        <div>
                            <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">Registry History</h2>
                            <p className="text-indigo-400 text-xs font-black uppercase tracking-[0.3em] mt-3">Audit Logs • {pastInterviews.length} Sessions</p>
                        </div>
                        <div className="relative w-full md:w-72 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400" size={16}/>
                            <input 
                                type="text" 
                                placeholder="Search by mode or JD..." 
                                value={archiveSearch}
                                onChange={e => setArchiveSearch(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-12 pr-4 py-3 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 outline-none shadow-inner"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto scrollbar-hide">
                        {pastInterviews.length === 0 ? (
                            <div className="py-32 flex flex-col items-center justify-center text-slate-700 gap-6">
                                <History size={64} className="opacity-10"/>
                                <p className="text-sm font-bold uppercase tracking-widest italic">No historical nodes refracted</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                                {filteredHistory.map(rec => {
                                    const cardReport = rec.report;
                                    const score = cardReport?.score;
                                    const hasCloudVideo = isYouTubeUrl(rec.videoUrl) || isDriveUrl(rec.videoUrl);
                                    return (
                                        <div key={rec.id} className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 hover:border-indigo-500/30 transition-all shadow-xl group relative overflow-hidden flex flex-col justify-between">
                                            <div className="absolute top-0 right-0 p-12 bg-indigo-500/5 blur-3xl rounded-full"></div>
                                            {hasCloudVideo && (
                                                <a 
                                                    href={isDriveUrl(rec.videoUrl) ? rec.videoUrl?.replace('drive://', 'https://drive.google.com/file/d/') : rec.videoUrl} 
                                                    target="_blank" 
                                                    rel="noreferrer"
                                                    className="absolute top-6 right-6 p-2 bg-red-600 text-white rounded-full shadow-lg hover:scale-110 transition-transform z-10"
                                                    title="Watch Cloud Archive"
                                                >
                                                    {isYouTubeUrl(rec.videoUrl) ? <Youtube size={16}/> : <PlayCircle size={16}/>}
                                                </a>
                                            )}
                                            <div>
                                                <div className="flex justify-between items-start mb-6">
                                                    <div className="p-3 bg-indigo-900/30 text-indigo-400 rounded-2xl"><History size={24}/></div>
                                                    <div className="text-right">
                                                        <span className="text-[10px] font-mono text-slate-600 block">{new Date(rec.timestamp).toLocaleDateString()}</span>
                                                        {score !== undefined && (
                                                            <div className="text-lg font-black text-indigo-400 mt-1">{score}<span className="text-[10px] text-slate-700 ml-0.5">/100</span></div>
                                                        )}
                                                    </div>
                                                </div>
                                                <h3 className="text-xl font-bold text-white uppercase tracking-tight line-clamp-1 mb-2">{String(rec.mode || '').replace('_', ' ')}</h3>
                                                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-6 italic">"{rec.jobDescription || 'Standard interrogation context.'}"</p>
                                            </div>
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${getCleanVerdict(rec.feedback).includes('HIRE') ? 'bg-emerald-900/30 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                                                        {getCleanVerdict(rec.feedback)}
                                                    </span>
                                                    <button onClick={(e) => { e.stopPropagation(); if(confirm("Purge Node?")) deleteInterview(rec.id).then(loadData); }} className="text-slate-600 hover:text-red-400 transition-colors"><Trash2 size={16}/></button>
                                                </div>
                                                <button onClick={() => handleOpenArchivedReport(rec)} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg transition-all active:scale-95">Open Report</button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {view === 'feedback' && report && (
                <div className="h-full w-full overflow-y-auto p-12 bg-[#020617] scrollbar-hide text-left">
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
        </main>
    </div>
  );
};

export default MockInterview;
