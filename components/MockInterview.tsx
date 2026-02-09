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
  FileText, Ghost, Eye, Database, TerminalSquare, FlaskConical, Beaker, User as UserIcon, ArrowLeftRight
} from 'lucide-react';
import { getGlobalAudioContext, warmUpAudioContext, registerAudioOwner, connectOutput, getGlobalMediaStreamDest } from '../utils/audioUtils';
import { getDriveToken, signInWithGoogle, connectGoogleDrive, isJudgeSession } from '../services/authService';
import { ensureCodeStudioFolder, ensureFolder, uploadToDrive, getDriveFileSharingLink, getDriveFileStreamUrl } from '../services/googleDriveService';
import { uploadToYouTube, getYouTubeVideoUrl, getYouTubeEmbedUrl, deleteYouTubeVideo } from '../services/youtubeService';

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
                    <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
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
  const [userRole, setUserRole] = useState<'candidate' | 'interviewer'>('candidate');
  const [interviewLanguage, setInterviewLanguage] = useState<'cpp' | 'python' | 'javascript' | 'java'>('cpp');
  const [jobDescription, setJobDescription] = useState('');
  const [selectedPersona, setSelectedPersona] = useState(PERSONAS[0]);
  const [sessionUuid, setSessionUuid] = useState('');
  const sessionUuidRef = useRef(''); 
  const [archiveSearch, setArchiveSearch] = useState('');
  const [pipSize, setPipSize] = useState<'normal' | 'compact'>('normal');
  const [isMirrorMinimized, setIsMirrorMinimized] = useState(false);

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

  const [interviewDuration] = useState(15); 
  const [timeLeft, setTimeLeft] = useState(15 * 60); 
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
        Output identical JSON schema as requested in live evaluation.`;

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

  const localSessionVideoUrlRef = useRef<string>('');
  const localSessionBlobRef = useRef<Blob | null>(null);
  const localSessionVideoSizeRef = useRef<number>(0);

  const serviceRef = useRef<GeminiLiveService | null>(null);
  const currentUser = auth?.currentUser;

  const updateSetupStep = useCallback((id: string, status: 'pending' | 'active' | 'done' | 'error') => {
      setSetupSteps(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  }, []);

  const addApiLog = useCallback((msg: string, type: ApiLog['type'] = 'info', code?: string) => {
      const time = new Date().toLocaleTimeString();
      setApiLogs(prev => [{ time, msg, type, code }, ...prev].slice(0, 100));
      window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: `[DyadAI] ${msg}`, type } }));
  }, []);

  useEffect(() => {
    if (view === 'active' && mirrorVideoRef.current && cameraStreamRef.current) {
        mirrorVideoRef.current.srcObject = cameraStreamRef.current;
        mirrorVideoRef.current.play().catch(() => addApiLog("Mirror buffer delayed.", "warn"));
    }
  }, [view, addApiLog]);

  useEffect(() => {
    filesRef.current = files;
    activeFileIndexRef.current = activeFileIndex;
    transcriptRef.current = transcript;
  }, [files, activeFileIndex, transcript]);

  const triggerShadowWhisper = useCallback(async () => {
    if (!isAiConnected || isEndingRef.current) return;
    const whispers = ["Increase challenge depth.", "Pivot to memory safety.", "Soften tone for better signal."];
    const whisper = whispers[Math.floor(Math.random() * whispers.length)];
    addApiLog(`[SHADOW_WHISPER]: ${whisper}`, "shadow");
    serviceRef.current?.sendText(`[SHADOW_CRITIC_INPUT]: ${whisper}`);
  }, [isAiConnected, addApiLog]);

  const loadData = useCallback(async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
        const data = await getUserInterviews(currentUser.uid);
        setPastInterviews(data.sort((a, b) => b.timestamp - a.timestamp));
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  }, [currentUser]);

  useEffect(() => {
    if (view === 'archive' && currentUser) loadData();
  }, [view, currentUser, loadData]);

  const performSyncToYouTube = async (id: string, blob: Blob, meta: { mode: string, language: string }) => {
    if (!currentUser) return;
    let token = getDriveToken() || await signInWithGoogle().then(() => getDriveToken());
    if (!token) return;
    try {
        const ytId = await uploadToYouTube(token!, blob, {
            title: `DyadAI Session: ${meta.mode.toUpperCase()}`,
            description: `Shadow-Critic evaluation record.`,
            privacyStatus: 'unlisted'
        });
        const videoUrl = getYouTubeVideoUrl(ytId);
        await updateDoc(doc(db, 'mock_interviews', id), { videoUrl, visibility: 'private' });
        if (report && report.id === id) setReport({ ...report, videoUrl });
    } catch(e: any) { addApiLog("YouTube sync failed", "error"); }
  };

  const performSyncToDrive = async (id: string, blob: Blob) => {
      if (!currentUser) return;
      let token = getDriveToken() || await signInWithGoogle().then(() => getDriveToken());
      if (!token) return;
      try {
          const root = await ensureCodeStudioFolder(token);
          const folder = await ensureFolder(token, 'DyadAI_Interviews', root);
          const driveId = await uploadToDrive(token, folder, `DyadSession_${id}.webm`, blob);
          const videoUrl = `drive://${driveId}`;
          await updateDoc(doc(db, 'mock_interviews', id), { videoUrl });
          if (report && report.id === id) setReport({ ...report, videoUrl });
      } catch(e: any) { addApiLog("Vault sync failed", "error"); }
  };

  const handleEndInterview = useCallback(async () => {
      if (isEndingRef.current) return;
      isEndingRef.current = true;
      const uuid = sessionUuidRef.current;
      if (!uuid) return;
      setIsLoading(true);

      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (shadowWhisperTimerRef.current) clearInterval(shadowWhisperTimerRef.current);
      if (renderIntervalRef.current) clearInterval(renderIntervalRef.current);
      if (timerRef.current) clearInterval(timerRef.current);

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          const stopPromise = new Promise(resolve => {
              mediaRecorderRef.current!.addEventListener('stop', () => resolve(true), { once: true });
              mediaRecorderRef.current!.stop();
          });
          await stopPromise;
      }

      if (serviceRef.current) await serviceRef.current.disconnect();
      setIsLive(false);

      const initialRec: MockInterviewRecording = {
          id: uuid, userId: currentUser?.uid || 'guest', userName: currentUser?.displayName || 'Candidate',
          mode: interviewMode, jobDescription, timestamp: Date.now(),
          videoUrl: localSessionVideoUrlRef.current, feedback: "SYNTHESIZING",
          transcript: transcriptRef.current, visibility: 'private',
          blob: localSessionBlobRef.current || undefined, language: interviewLanguage
      };
      
      try {
          await saveInterviewRecording(initialRec);
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const transcriptStr = transcriptRef.current.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n');
          const res = await ai.models.generateContent({
              model: 'gemini-3-pro-preview',
              contents: `Perform a comprehensive technical evaluation. Output JSON report. TRANSCRIPT:\n${transcriptStr}`,
              config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 15000 } }
          });
          const reportData = JSON.parse(res.text || '{}');
          const finalReport: MockInterviewReport = { ...reportData, id: uuid, sourceCode: filesRef.current, transcript: transcriptRef.current, videoUrl: localSessionVideoUrlRef.current, videoBlob: localSessionBlobRef.current || undefined };
          setReport(finalReport);
          await updateDoc(doc(db, 'mock_interviews', uuid), { report: reportData, feedback: reportData.verdict || "EVALUATED" });
          setView('feedback');
      } catch (e: any) {
          setView('feedback');
      } finally { setIsLoading(false); isEndingRef.current = false; }
  }, [interviewMode, jobDescription, interviewLanguage, currentUser]);

  const initializePersistentRecorder = useCallback(async () => {
    try {
        updateSetupStep('scribe', 'active');
        const ctx = getGlobalAudioContext();
        const recordingDest = getGlobalMediaStreamDest();
        const userStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        ctx.createMediaStreamSource(userStream).connect(recordingDest);

        const canvas = document.createElement('canvas');
        canvas.width = 1920; canvas.height = 1080;
        const drawCtx = canvas.getContext('2d', { alpha: false })!;
        const screenVideo = document.createElement('video');
        screenVideo.muted = true; screenVideo.playsInline = true; screenVideo.autoplay = true;
        if (screenStreamRef.current) screenVideo.srcObject = screenStreamRef.current;
        
        const cameraVideo = document.createElement('video');
        cameraVideo.muted = true; cameraVideo.playsInline = true; cameraVideo.autoplay = true;
        if (cameraStreamRef.current) cameraVideo.srcObject = cameraStreamRef.current;

        renderIntervalRef.current = setInterval(() => {
            if (view !== 'active') return;
            drawCtx.fillStyle = '#020617'; drawCtx.fillRect(0, 0, 1920, 1080);
            if (screenVideo.readyState >= 2) drawCtx.drawImage(screenVideo, 0, 0, 1920, 1080);
            if (cameraVideo.readyState >= 2) {
                const size = pipSize === 'compact' ? 220 : 440;
                drawCtx.save();
                drawCtx.beginPath(); drawCtx.arc(1920 - size - 40 + size/2, 1080 - size - 40 + size/2, size/2, 0, Math.PI*2);
                drawCtx.closePath(); drawCtx.clip();
                drawCtx.drawImage(cameraVideo, 1920 - size - 40, 1080 - size - 40, size, size);
                drawCtx.restore();
            }
        }, 1000/30);

        const recorder = new MediaRecorder(canvas.captureStream(30), { mimeType: 'video/webm' });
        audioChunksRef.current = [];
        recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
        recorder.onstop = () => {
            const blob = new Blob(audioChunksRef.current, { type: 'video/webm' });
            localSessionBlobRef.current = blob;
            localSessionVideoUrlRef.current = URL.createObjectURL(blob);
        };
        mediaRecorderRef.current = recorder;
        recorder.start(1000);
        updateSetupStep('scribe', 'done');
    } catch(e) { updateSetupStep('scribe', 'error'); }
  }, [pipSize, view, updateSetupStep]);

  const connect = useCallback(async (reconnect = false) => {
    if (isEndingRef.current) return;
    updateSetupStep('neural', 'active');
    const service = new GeminiLiveService();
    serviceRef.current = service;

    let instruction = selectedPersona.instruction;
    if (userRole === 'interviewer') {
        instruction = `${selectedPersona.instruction}\nROLE SWAP: You are the interviewee (the candidate). The user is the interviewer. Act like a FAANG Staff Engineer. Think out loud while you solve coding problems using 'write_file'.`;
    }

    try {
      await service.initializeAudio();
      await service.connect(selectedPersona.name, instruction, {
          onOpen: () => {
              setIsLive(true); setIsAiConnected(true);
              updateSetupStep('neural', 'done'); updateSetupStep('dyad', 'done');
              if (!reconnect) service.sendText(userRole === 'interviewer' ? "Ready for your challenge." : "Ready to begin the evaluation.");
              shadowWhisperTimerRef.current = setInterval(triggerShadowWhisper, 90000); 
          },
          onClose: () => setIsAiConnected(false),
          onError: () => updateSetupStep('neural', 'error'),
          onVolumeUpdate: (v) => setVolume(v),
          onTranscript: (text, isUser) => {
              const role = isUser ? 'user' : 'ai';
              setTranscript(prev => [...prev, { role, text, timestamp: Date.now() }]);
          },
          onToolCall: async (toolCall) => {
              for (const fc of toolCall.functionCalls) {
                  if (fc.name === 'write_file') {
                      const args = fc.args as any;
                      const file: CodeFile = { name: args.path, path: args.path, language: getLanguageFromExt(args.path), content: args.content, loaded: true };
                      setFiles(prev => [...prev.filter(f => f.path !== args.path), file]);
                      setActiveFilePath(args.path);
                      service.sendToolResponse({ id: fc.id, name: fc.name, response: { result: "File updated." } });
                  }
              }
          }
      }, [{ functionDeclarations: [writeFileTool, readFileTool, listFilesTool, createInterviewNoteTool] }]);
    } catch (e) { updateSetupStep('neural', 'error'); }
  }, [userRole, selectedPersona, triggerShadowWhisper, updateSetupStep, interviewMode, jobDescription, interviewLanguage]);

  const handleStartInterview = async () => {
    setIsLoading(true);
    const uuid = generateSecureId();
    sessionUuidRef.current = uuid;
    setSessionUuid(uuid);
    setFiles([{ name: 'workspace.cpp', path: 'workspace.cpp', language: 'cpp', content: '// Start coding...\n', loaded: true }]);
    try {
        screenStreamRef.current = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true } as any);
        cameraStreamRef.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        initializePersistentRecorder();
        await connect();
        setView('active');
    } catch (e) { setIsLoading(false); }
  };

  return (
    <div className="h-full bg-slate-950 flex flex-col overflow-hidden relative">
        <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 shrink-0 z-30">
            <div className="flex items-center gap-4">
                <button onClick={() => view === 'selection' ? onBack() : setView('selection')} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"><ArrowLeft size={20} /></button>
                <h1 className="text-lg font-bold text-white flex items-center gap-2 uppercase italic"><Video className="text-red-500" /> DyadAI Studio</h1>
            </div>
            {view === 'active' && (
                <div className="flex items-center gap-4 bg-slate-950/80 px-5 py-2 rounded-2xl border border-red-500/30">
                    <span className="text-xl font-mono text-white">{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
                    <button onClick={handleEndInterview} className="px-5 py-2 bg-red-600 text-white text-[10px] font-black uppercase rounded-lg">TERMINATE</button>
                </div>
            )}
        </header>

        <main className="flex-1 overflow-hidden relative w-full">
            {isLoading && <div className="absolute inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={48}/></div>}

            {view === 'selection' && (
                <div className="max-w-4xl mx-auto p-16 h-full flex flex-col justify-center gap-12 animate-fade-in-up">
                    <div className="text-center space-y-4">
                        <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase">DyadAI</h2>
                        <p className="text-lg text-slate-400 font-medium max-w-xl mx-auto">Sovereign talent filtering via Shadow-Critic agents.</p>
                    </div>
                    <div className="flex bg-slate-900 border border-slate-800 p-1.5 rounded-[2.5rem] shadow-2xl max-w-md mx-auto w-full">
                        <button onClick={() => setUserRole('candidate')} className={`flex-1 py-4 rounded-[2rem] text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${userRole === 'candidate' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}><UserIcon size={14}/> Candidate</button>
                        <button onClick={() => setUserRole('interviewer')} className={`flex-1 py-4 rounded-[2rem] text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${userRole === 'interviewer' ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}><ArrowLeftRight size={14}/> Interviewer</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {PERSONAS.map(p => (
                            <button key={p.id} onClick={() => setSelectedPersona(p)} className={`p-8 rounded-[3rem] border transition-all text-left ${selectedPersona.id === p.id ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
                                <p.icon size={32} className="mb-4" />
                                <h3 className="text-lg font-black uppercase mb-2">{p.name}</h3>
                                <p className="text-xs opacity-60">{p.desc}</p>
                            </button>
                        ))}
                    </div>
                    <button onClick={() => setView('setup')} className="mx-auto px-12 py-5 bg-white text-slate-950 font-black uppercase tracking-[0.3em] rounded-2xl shadow-2xl flex items-center gap-3">Configure Dyad <ChevronRight/></button>
                </div>
            )}

            {view === 'setup' && (
                <div className="max-w-2xl mx-auto p-12 h-full flex flex-col justify-center gap-10 animate-fade-in-up">
                    <h2 className="text-3xl font-black text-white uppercase italic">{userRole === 'interviewer' ? 'AI Candidate Config' : 'Interrogation Setup'}</h2>
                    <div className="space-y-6 bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl">
                        <div className="grid grid-cols-2 gap-2">{(['cpp', 'python', 'javascript', 'java'] as const).map(l => (<button key={l} onClick={() => setInterviewLanguage(l)} className={`py-3 rounded-xl border text-xs font-black uppercase ${interviewLanguage === l ? 'bg-red-600 text-white' : 'bg-slate-950 text-slate-600'}`}>{l}</button>))}</div>
                        <textarea value={jobDescription} onChange={e => setJobDescription(e.target.value)} rows={4} placeholder={userRole === 'interviewer' ? "Describe the challenge for the AI..." : "Describe the role or challenge..."} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white outline-none focus:ring-2 focus:ring-red-500"/>
                        <button onClick={handleStartInterview} className="w-full py-5 bg-red-600 text-white font-black uppercase rounded-2xl shadow-xl flex items-center justify-center gap-3"><Play size={20} fill="currentColor"/> Begin Session</button>
                    </div>
                </div>
            )}

            {view === 'active' && (
                <div className="h-full w-full flex animate-fade-in relative">
                    <CodeStudio 
                        onBack={() => {}} currentUser={currentUser} userProfile={userProfile} isProMember={true} 
                        initialFiles={files} onFileChange={f => setFiles(prev => [...prev.filter(x => x.path !== f.path), f])} 
                        externalChatContent={transcript} activeFilePath={activeFilePath || undefined} onActiveFileChange={(path) => setActiveFilePath(path)}
                        onSessionStart={() => {}} onSessionStop={() => {}} onStartLiveSession={() => {}}
                    />
                    {showDebugPanel && (
                        <div className="w-80 border-l border-slate-800 bg-slate-950 flex flex-col shrink-0 animate-fade-in-right">
                             <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900"><div className="flex items-center gap-2"><Ghost size={14} className="text-indigo-400"/><span className="font-black text-[10px] uppercase tracking-widest">Shadow Monitor</span></div><button onClick={() => setShowDebugPanel(false)}><X size={14}/></button></div>
                             <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                 {apiLogs.map((l, i) => (<div key={i} className={`p-3 rounded-xl border text-[10px] font-mono ${l.type === 'shadow' ? 'bg-purple-900/20 text-purple-300' : 'bg-slate-900 text-slate-400'}`}>{l.msg}</div>))}
                             </div>
                        </div>
                    )}
                </div>
            )}

            {view === 'archive' && (
                <div className="max-w-6xl mx-auto p-12 h-full flex flex-col animate-fade-in overflow-hidden">
                    <h2 className="text-4xl font-black text-white italic uppercase mb-8">Registry History</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto">
                        {pastInterviews.map(rec => (
                            <div key={rec.id} className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 flex flex-col justify-between">
                                <h3 className="text-xl font-bold text-white uppercase mb-2">{rec.mode}</h3>
                                <p className="text-xs text-slate-500 mb-6 italic line-clamp-2">"{rec.jobDescription}"</p>
                                <button onClick={() => handleOpenArchivedReport(rec)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs">Open Report</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {view === 'feedback' && report && (
                <div className="h-full w-full overflow-y-auto p-12 bg-[#020617] text-left">
                    <div className="max-w-4xl mx-auto space-y-16">
                        <h2 className="text-5xl font-black text-white italic uppercase text-center">Evaluation Refraction</h2>
                        <EvaluationReportDisplay report={report} onSyncYouTube={() => performSyncToYouTube(report.id, report.videoBlob!, { mode: interviewMode, language: interviewLanguage })} onSyncDrive={() => performSyncToDrive(report.id, report.videoBlob!)} isSyncing={false} />
                    </div>
                </div>
            )}
        </main>
    </div>
  );
};

export default MockInterview;
