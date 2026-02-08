
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
  FileText, Ghost, Eye
} from 'lucide-react';
import { getGlobalAudioContext, warmUpAudioContext, registerAudioOwner, connectOutput, getGlobalMediaStreamDest } from '../utils/audioUtils';
import { getDriveToken, signInWithGoogle, connectGoogleDrive, isJudgeSession } from '../services/authService';
import { ensureCodeStudioFolder, ensureFolder, uploadToDrive, getDriveFileStreamUrl } from '../services/googleDriveService';
import { uploadToYouTube, getYouTubeVideoUrl, getYouTubeEmbedUrl } from '../services/youtubeService';

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
  shadowAudit?: string; // New: Specific audit from the shadow agent
  sourceCode?: CodeFile[];
  transcript?: TranscriptItem[];
  videoUrl?: string; 
  videoBlob?: Blob;
  videoSize?: number; 
}

interface ApiLog {
    time: string;
    msg: string;
    type: 'input' | 'output' | 'error' | 'success' | 'warn' | 'info' | 'shadow';
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
        id: 'dyad-lead', 
        name: 'DyadAI: Lead Interviewer', 
        icon: UserCheck, 
        desc: 'Adaptive, emotive interaction layer powered by the Shadow Critic.',
        instruction: 'You are the Lead Interviewer for DyadAI. Your goal is to conduct a high-fidelity technical interview. You are being watched by the Shadow Critic (Agent 2). If you receive a [SHADOW_WHISPER], you MUST adjust your behavior, tone, or difficulty level immediately based on the whisper. Introduce yourself as the Dyad Lead.'
    },
    { 
        id: 'software-interview', 
        name: 'Senior Staff Interrogator', 
        icon: GraduationCap, 
        desc: 'Hard algorithmic evaluation. Socratic focus.',
        instruction: 'You are a Senior Staff Engineer at Google. You conduct hard technical interviews. You are the Lead Agent in a DyadAI system. The Shadow Critic will monitor your logic. If you receive a [SHADOW_WHISPER], follow it strictly.'
    },
    { 
        id: 'linux-kernel', 
        name: 'Kernel Maintainer', 
        icon: Cpu, 
        desc: 'Systems engineering and memory safety audit.',
        instruction: 'You are a Linux Kernel Maintainer. You evaluate code for race conditions and architectural elegance. You are the Lead Agent in a DyadAI system. The Shadow Critic watches for missed signals.'
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
  description: "Modify the active code file. Use this ONLY for adding TODO comments, function stubs, or high-level boilerplate. NEVER use this to provide a full working solution.",
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
  description: "Generate a new problem file in the workspace containing ONLY the problem description and basic setup.",
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
        const a = document.createElement('a');
        a.href = stableVideoUrl;
        a.download = `DyadAI_Archive_${report.id.substring(0,8)}.webm`;
        a.click();
    };

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
                    <p className="text-sm text-slate-300 leading-relaxed font-medium">{report.technicalSkills || 'Evaluating...'}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-xl hover:border-pink-500/30 transition-all group">
                    <div className="w-10 h-10 rounded-xl bg-pink-900/30 text-pink-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                        <Presentation size={20}/>
                    </div>
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Communication Density</h4>
                    <p className="text-sm text-slate-300 leading-relaxed font-medium">{report.communication || 'Evaluating...'}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-xl hover:border-emerald-500/30 transition-all group">
                    <div className="w-10 h-10 rounded-xl bg-emerald-900/30 text-emerald-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                        <HeartHandshake size={20}/>
                    </div>
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Culture Add Signal</h4>
                    <p className="text-sm text-slate-300 leading-relaxed font-medium">{report.collaboration || 'Evaluating...'}</p>
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

            <div className="flex justify-center gap-4">
                <button onClick={onSyncYouTube} disabled={isSyncing} className="px-8 py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center gap-3 transition-all hover:bg-red-500 active:scale-95 disabled:opacity-30">
                    {isSyncing ? <Loader2 size={20} className="animate-spin"/> : <Youtube size={20}/>}
                    {report.videoUrl?.includes('youtube') ? 'Securely Archived' : 'Sync to Neural Archive'}
                </button>
                <button onClick={handleDownload} className="p-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl border border-slate-700 transition-all"><Download size={24}/></button>
            </div>
        </div>
    );
};

export const MockInterview: React.FC<MockInterviewProps> = ({ onBack, userProfile, onStartLiveSession, isProMember, onOpenManual }) => {
  const [view, setView] = useState<'selection' | 'setup' | 'active' | 'feedback' | 'archive'>('selection');
  const [interviewMode, setInterviewMode] = useState<'coding' | 'system_design' | 'behavioral' | 'quick_screen'>('coding');
  const [interviewLanguage, setInterviewLanguage] = useState<'c++' | 'python' | 'javascript' | 'java'>('c++');
  const [jobDescription, setJobDescription] = useState('');
  const [selectedPersona, setSelectedPersona] = useState(PERSONAS[0]);
  const [sessionUuid, setSessionUuid] = useState('');
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
  const [volume, setVolume] = useState(0);

  const [apiLogs, setApiLogs] = useState<ApiLog[]>([]);

  const [interviewDuration, setInterviewDuration] = useState(15); 
  const [timeLeft, setTimeLeft] = useState(15 * 60); 
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rotationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const renderIntervalRef = useRef<any>(null);
  const autoReconnectAttempts = useRef(0);
  const maxAutoRetries = 20; 
  const isEndingRef = useRef(false);

  // DyadAI Simulation Refs
  const shadowWhisperTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  // Recording State
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const mirrorVideoRef = useRef<HTMLVideoElement>(null);
  const [isRecordingActive, setIsRecordingActive] = useState(false);
  const [isUploadingRecording, setIsUploadingRecording] = useState(false);
  
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
      window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: `[DyadAI] ${msg}`, type } }));
  }, []);

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
    
    // Simulate Shadow reasoning and whispering to the Lead
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
      
      setIsLoading(true);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (rotationTimerRef.current) clearInterval(rotationTimerRef.current);
      if (shadowWhisperTimerRef.current) clearInterval(shadowWhisperTimerRef.current);
      if (renderIntervalRef.current) clearInterval(renderIntervalRef.current);
      if (timerRef.current) clearInterval(timerRef.current);

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
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
          const finalFilesStr = filesRef.current.map(f => `FILE: ${f.name}\nCONTENT:\n${f.content}`).join('\n\n');
          
          addApiLog("Shadow Agent compiling high-dimensional logic audit...", "info");

          const prompt = `Perform a comprehensive technical evaluation of this DyadAI mock interview. 
          
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
          addApiLog("Dyad report synthesized. Archive secure.", "success");
          
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
          addApiLog("Refraction error: " + e.message, "error");
          setView('selection');
      } finally {
          setIsLoading(false);
          isEndingRef.current = false;
      }
  }, [sessionUuid, interviewMode, jobDescription, interviewLanguage, currentUser, addApiLog]);

  const initializePersistentRecorder = useCallback(async () => {
    try {
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
            if (stream) { v.srcObject = stream; document.body.appendChild(v); v.play().catch(console.warn); }
            return v;
        };

        const screenVideo = createCaptureVideo(screenStreamRef.current, 'screen');
        const cameraVideo = createCaptureVideo(cameraStreamRef.current, 'camera');

        const renderLoop = () => {
            drawCtx.fillStyle = '#020617';
            drawCtx.fillRect(0, 0, canvas.width, canvas.height);
            if (screenStreamRef.current && screenVideo.readyState >= 2) {
                const scale = Math.min(canvas.width / screenVideo.videoWidth, canvas.height / screenVideo.videoHeight);
                const w = screenVideo.videoWidth * scale;
                const h = screenVideo.videoHeight * scale;
                drawCtx.drawImage(screenVideo, (canvas.width - w)/2, (canvas.height - h)/2, w, h);
            }
            if (cameraStreamRef.current && cameraVideo.readyState >= 2) {
                const size = pipSize === 'compact' ? 220 : 440; 
                const px = canvas.width - size - 40;
                const py = canvas.height - size - 40;
                drawCtx.save();
                drawCtx.beginPath(); drawCtx.arc(px + size/2, py + size/2, size/2, 0, Math.PI * 2); drawCtx.clip();
                const camScale = Math.max(size / cameraVideo.videoWidth, size / cameraVideo.videoHeight);
                drawCtx.drawImage(cameraVideo, px + size/2 - (cameraVideo.videoWidth*camScale)/2, py + size/2 - (cameraVideo.videoHeight*camScale)/2, cameraVideo.videoWidth*camScale, cameraVideo.videoHeight*camScale);
                drawCtx.restore();
                drawCtx.beginPath(); drawCtx.arc(px + size/2, py + size/2, size/2, 0, Math.PI * 2);
                drawCtx.strokeStyle = '#ef4444'; drawCtx.lineWidth = 10; drawCtx.stroke();
            }
        };

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
    } catch(e: any) { addApiLog("Scribe Init failed: " + e.message, "error"); }
  }, [pipSize, addApiLog]);

  const connect = useCallback(async (reconnect = false) => {
    if (isEndingRef.current) return;
    const service = new GeminiLiveService();
    serviceRef.current = service;
    
    try {
      await service.initializeAudio();
      const systemInstruction = `${selectedPersona.instruction}\n\n[MODE]: ${interviewMode}\n[CONTEXT]: ${jobDescription}\n[LANG]: ${interviewLanguage}`;

      await service.connect(selectedPersona.name, systemInstruction, {
          onOpen: () => {
              setIsLive(true); setIsRecovering(false); setIsAiConnected(true);
              autoReconnectAttempts.current = 0;
              if (reconnect) service.sendText(`[RECONNECTION_PROTOCOL_ACTIVE] Neural link recovered. Continuing evaluation.`);
              else service.sendText("DyadAI Handshake Verified. Candidate is ready. Begin the evaluation.");
              
              // Start Shadow-Critic loop
              shadowWhisperTimerRef.current = setInterval(triggerShadowWhisper, 90000); // Whisper every 90s
          },
          onClose: () => {
              setIsAiConnected(false);
              if (autoReconnectAttempts.current < maxAutoRetries && !isEndingRef.current) {
                  autoReconnectAttempts.current++;
                  setIsRecovering(true);
                  reconnectTimeoutRef.current = setTimeout(() => connect(true), 1500);
              } else if (!isEndingRef.current) setIsLive(false);
          },
          onError: (err) => { addApiLog(`Failure: ${err}`, "error"); setIsAiConnected(false); },
          onVolumeUpdate: (v) => setVolume(v),
          onTranscript: (text, isUser) => {
              const role = isUser ? 'user' : 'ai';
              setTranscript(prev => {
                  if (prev.length > 0 && prev[prev.length - 1].role === role) return [...prev.slice(0, -1), { ...prev[prev.length - 1], text: prev[prev.length - 1].text + text }];
                  return [...prev, { role, text, timestamp: Date.now() }];
              });
          },
          onToolCall: async (toolCall) => {
              for (const fc of toolCall.functionCalls) {
                  addApiLog(`Dyad Tool: ${fc.name}`, 'input');
                  if (fc.name === 'get_current_code') {
                      const result = filesRef.current.map(f => `${f.name}:\n${f.content}`).join('\n\n');
                      service.sendToolResponse({ id: fc.id, name: fc.name, response: { result } });
                  } else if (fc.name === 'create_interview_file') {
                      const args = fc.args as any;
                      const newFile: CodeFile = { name: args.filename, path: args.filename, language: getLanguageFromExt(args.filename), content: args.content, loaded: true };
                      setFiles(prev => [...prev, newFile]);
                      setActiveFileIndex(filesRef.current.length);
                      service.sendToolResponse({ id: fc.id, name: fc.name, response: { result: "File created." } });
                  } else if (fc.name === 'update_active_file') {
                      const args = fc.args as any;
                      if (activeFileIndexRef.current >= 0 && filesRef.current[activeFileIndexRef.current]) {
                          const updated = { ...filesRef.current[activeFileIndexRef.current], content: args.content };
                          setFiles(prev => prev.map((f, i) => i === activeFileIndexRef.current ? updated : f));
                          service.sendToolResponse({ id: fc.id, name: fc.name, response: { result: "Updated." } });
                      }
                  }
              }
          }
      }, [{ functionDeclarations: [getCodeTool, updateActiveFileTool, createInterviewFileTool] }]);
    } catch (e: any) { addApiLog("Fault: " + e.message, "error"); setIsLive(false); }
  }, [jobDescription, interviewMode, interviewLanguage, selectedPersona, triggerShadowWhisper, addApiLog]);

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
        screenStreamRef.current = await navigator.mediaDevices.getDisplayMedia({ video: { width: 1920, height: 1080 }, audio: true } as any);
        cameraStreamRef.current = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
        if (mirrorVideoRef.current && cameraStreamRef.current) mirrorVideoRef.current.srcObject = cameraStreamRef.current;
        initializePersistentRecorder();
        await connect();
        setTimeLeft(interviewDuration * 60);
        timerRef.current = setInterval(() => { setTimeLeft(prev => { if (prev <= 1) { handleEndInterview(); return 0; } return prev - 1; }); }, 1000);
        setView('active');
    } catch (e: any) { alert("Permissions refused."); } finally { setIsLoading(false); }
  };

  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);
  const [resolvedMediaUrl, setResolvedMediaUrl] = useState<string | null>(null);
  const [activeRecording, setActiveRecording] = useState<MockInterviewRecording | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  return (
    <div className="h-full bg-slate-950 flex flex-col font-sans overflow-hidden relative">
        <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-30">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"><ArrowLeft size={20} /></button>
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
                        <div className="absolute inset-0 flex items-center justify-center"><Zap size={32} className="text-indigo-400 animate-pulse" /></div>
                    </div>
                    <div className="text-center space-y-2"><h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Initializing Dyad Link</h3><p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Handshaking Lead & Shadow Agents...</p></div>
                </div>
            )}

            {view === 'selection' && (
                <div className="max-w-4xl w-full p-8 md:p-16 h-full flex flex-col justify-center gap-12 animate-fade-in-up">
                    <div className="text-center space-y-4">
                        <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">DyadAI</h2>
                        <p className="text-lg text-slate-400 font-medium max-w-xl mx-auto leading-relaxed">High-fidelity talent filtering using the Shadow-Critic multi-agent architecture.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {PERSONAS.map(p => (
                            <button key={p.id} onClick={() => setSelectedPersona(p)} className={`p-8 rounded-[3rem] border transition-all text-left flex flex-col gap-4 relative overflow-hidden group ${selectedPersona.id === p.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-2xl scale-[1.02]' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-indigo-500/40'}`}>
                                <div className={`p-4 rounded-3xl w-fit ${selectedPersona.id === p.id ? 'bg-indigo-500' : 'bg-slate-950'} transition-colors`}><p.icon size={32} className={selectedPersona.id === p.id ? 'text-white' : 'text-indigo-500'} /></div>
                                <div><h3 className="text-lg font-black uppercase tracking-tight leading-none mb-2">{p.name}</h3><p className="text-xs font-medium opacity-60 leading-relaxed">{p.desc}</p></div>
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
                        <button onClick={() => setView('setup')} className="px-12 py-5 bg-white text-slate-950 font-black uppercase tracking-[0.3em] rounded-2xl shadow-2xl shadow-indigo-900/40 transition-transform hover:scale-105 active:scale-95 flex items-center gap-3"><span>Configure Dyad</span><ChevronRight size={20}/></button>
                    </div>
                </div>
            )}

            {view === 'setup' && (
                <div className="max-w-xl w-full p-8 md:p-12 h-full flex flex-col justify-center gap-10 animate-fade-in-up">
                    <div className="space-y-2">
                        <button onClick={() => setView('selection')} className="flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-white transition-colors mb-4"><ArrowLeft size={14}/> Back to Selection</button>
                        <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">Interrogation Config</h2>
                        <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Refining Evaluation Metadata</p>
                    </div>
                    <div className="space-y-8 bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden">
                        <div className="space-y-3"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Target Language</label><div className="grid grid-cols-2 gap-2">{(['c++', 'python', 'javascript', 'java'] as const).map(l => (<button key={l} onClick={() => setInterviewLanguage(l)} className={`py-3 rounded-xl border text-xs font-black uppercase transition-all ${interviewLanguage === l ? 'bg-red-600 border-red-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-600'}`}>{l}</button>))}</div></div>
                        <div className="space-y-3"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Job Context</label><textarea value={jobDescription} onChange={e => setJobDescription(e.target.value)} rows={4} placeholder="Paste JD or Seniority Level..." className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white outline-none focus:ring-2 focus:ring-red-500 shadow-inner resize-none leading-relaxed"/></div>
                        <button onClick={handleStartInterview} className="w-full py-5 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-red-900/40 transition-all active:scale-95 flex items-center justify-center gap-3"><Play size={20} fill="currentColor"/> Begin Interrogation</button>
                    </div>
                </div>
            )}

            {view === 'active' && (
                <div className="h-full w-full flex animate-fade-in relative">
                    <div className={`fixed bottom-24 right-6 z-[100] transition-all duration-500 transform ${isMirrorMinimized ? 'translate-x-20 scale-50 opacity-20' : 'translate-x-0 scale-100'}`}>
                        <div className={`relative group ${pipSize === 'compact' ? 'w-32 h-32' : 'w-56 h-56'}`}>
                            <div className="absolute -inset-1 bg-gradient-to-r from-red-500 to-indigo-600 rounded-full blur opacity-40 group-hover:opacity-100 transition duration-1000"></div>
                            <div className="relative w-full h-full bg-slate-900 rounded-full border-4 border-red-500/50 overflow-hidden shadow-2xl">
                                <video ref={mirrorVideoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-110"/>
                                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
                                <div className="absolute top-2 left-1/2 -translate-x-1/2"><div className="bg-red-600 text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-full shadow-lg border border-red-400/50 whitespace-nowrap">Neural Mirror</div></div>
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-1/2 h-1 overflow-hidden rounded-full"><Visualizer volume={volume} isActive={isLive} color="#ffffff" /></div>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <CodeStudio 
                            onBack={() => {}} currentUser={currentUser} userProfile={userProfile} isProMember={true} isInterviewerMode={true} initialFiles={files} onFileChange={(f) => setFiles(prev => prev.map(p => p.path === f.path ? f : p))} externalChatContent={transcript} isAiThinking={!isAiConnected && isLive}
                            onSyncCodeWithAi={(f) => { addApiLog(`Forced Code Sync: ${f.name}`, 'info'); serviceRef.current?.sendText(`NEURAL_SNAPSHOT_SYNC: Code updated for ${f.name}.`); }}
                            onSessionStart={() => {}} onSessionStop={() => {}} onStartLiveSession={(chan, ctx) => onStartLiveSession(chan, ctx)}
                        />
                    </div>
                    {showDebugPanel && (
                        <div className="w-80 border-l border-slate-800 bg-slate-950 flex flex-col shrink-0 animate-fade-in-right">
                             <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
                                 <div className="flex items-center gap-2"><Ghost size={16} className="text-purple-400"/><span className="text-[10px] font-black uppercase tracking-widest">Shadow Monitor</span></div>
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
        </main>
    </div>
  );
};

export default MockInterview;
