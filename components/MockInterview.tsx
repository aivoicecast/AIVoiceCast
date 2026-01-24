
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MockInterviewRecording, TranscriptItem, CodeFile, UserProfile, Channel, CodeProject, RecordingSession } from '../types';
import { auth } from '../services/firebaseConfig';
import { saveInterviewRecording, getPublicInterviews, deleteInterview, updateUserProfile, uploadFileToStorage, getUserInterviews, updateInterviewMetadata, saveCodeProject, getCodeProject, getUserProfile, saveRecordingReference, deductCoins, AI_COSTS } from '../services/firestoreService';
import { GeminiLiveService } from '../services/geminiLive';
import { GoogleGenAI, Type } from "@google/genai";
import { generateSecureId } from '../utils/idUtils';
import { CodeStudio } from './CodeStudio';
import { MarkdownView } from './MarkdownView';
import { Visualizer } from './Visualizer';
import { 
  ArrowLeft, Video, Mic, Monitor, Play, Save, Loader2, Search, Trash2, CheckCircle, X, 
  Download, ShieldCheck, User, Users, Building, FileText, ChevronRight, Zap, SidebarOpen, 
  SidebarClose, Code, MessageSquare, Sparkles, Languages, Clock, Camera, Bot, CloudUpload, 
  Trophy, BarChart3, ClipboardCheck, Star, Upload, FileUp, Linkedin, FileCheck, Edit3, 
  BookOpen, Lightbulb, Target, ListChecks, MessageCircleCode, GraduationCap, Lock, Globe, 
  ExternalLink, PlayCircle, RefreshCw, FileDown, Briefcase, Package, Code2, StopCircle, 
  Youtube, AlertCircle, Eye, EyeOff, SaveAll, Wifi, WifiOff, Activity, ShieldAlert, 
  Timer, FastForward, ClipboardList, Layers, Bug, Flag, Minus, Fingerprint, FileSearch, 
  RefreshCcw, HeartHandshake, Speech, Send, History, Compass, Square, CheckSquare, 
  Cloud, Award, Terminal, CodeSquare, Quote, ImageIcon, LayoutPanelTop, 
  TerminalSquare, FolderOpen, HardDrive, Shield, Database, Link as LinkIcon, UserCircle, 
  Calendar, Palette, Award as AwardIcon, CheckCircle2, AlertTriangle, TrendingUp, Presentation, Rocket, Flame, ShieldOff, RefreshCw as RefreshIcon,
  FolderPlus, Share2, Crown, Terminal as TerminalIcon, FileCode, ExternalLink as ExternalLinkIcon, CodeSquare as CodeIcon, ChevronDown
} from 'lucide-react';
import { getGlobalAudioContext, getGlobalMediaStreamDest, warmUpAudioContext, stopAllPlatformAudio } from '../utils/audioUtils';
import { getDriveToken, signInWithGoogle, connectGoogleDrive } from '../services/authService';
import { ensureFolder, uploadToDrive, downloadDriveFileAsBlob, deleteDriveFile, ensureCodeStudioFolder, getDrivePreviewUrl } from '../services/googleDriveService';

interface OptimizedStarStory {
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  coachTip: string;
}

interface MockInterviewReport {
  score: number;
  technicalSkills: string;
  communication: string;
  collaboration: string;
  strengths: string[];
  areasForImprovement: string[];
  verdict: 'Strong Hire' | 'Hire' | 'No Hire' | 'Strong No Hire' | 'Move Forward' | 'Reject';
  summary: string;
  optimizedStarStories?: OptimizedStarStory[];
  idealAnswers?: { question: string, expectedAnswer: string, rationale: string }[];
  learningMaterial: string; 
  todoList?: string[];
  sourceCode?: CodeFile[];
  transcript?: TranscriptItem[];
}

interface ApiLog {
    time: string;
    msg: string;
    type: 'info' | 'error' | 'warn';
    code?: string;
}

interface MockInterviewProps {
  onBack: () => void;
  userProfile: UserProfile | null;
  onStartLiveSession: (channel: Channel, context?: string, recordingEnabled?: boolean, bookingId?: string, videoEnabled?: boolean, cameraEnabled?: boolean, activeSegment?: { index: number, lectureId: string }) => void;
  isProMember?: boolean;
}

function getLanguageFromExt(filename: string): CodeFile['language'] {
    if (!filename) return 'c++';
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'youtube' || filename.includes('youtube.com') || filename.includes('youtu.be')) return 'youtube';
    if (['mp4', 'mov', 'm4v', 'webm'].includes(ext || '')) return 'video';
    if (['mp3', 'wav', 'm4a', 'ogg'].includes(ext || '')) return 'audio';
    if (ext === 'jsx') return 'javascript (react)';
    if (ext === 'tsx') return 'typescript (react)';
    if (ext === 'js') return 'javascript';
    if (ext === 'sh') return 'shell';
    if (ext === 'ts') return 'typescript';
    if (ext === 'py') return 'python';
    if (['cpp', 'hpp', 'cc', 'cxx'].includes(ext || '')) return 'c++';
    if (ext === 'c' || ext === 'h') return 'c';
    if (ext === 'java') return 'java';
    if (ext === 'rs') return 'rs';
    if (ext === 'go') return 'go';
    if (ext === 'cs') return 'c#';
    if (ext === 'html') return 'html';
    if (ext === 'css') return 'css';
    if (ext === 'json') return 'json';
    if (ext === 'md') return 'markdown';
    if (['puml', 'plantuml'].includes(ext || '')) return 'plantuml';
    if (['draw', 'whiteboard', 'wb'].includes(ext || '')) return 'whiteboard';
    if (ext === 'pdf') return 'pdf';
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
  description: "Modify the active code file. Use this for adding comments, hints, or boilerplate.",
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
  description: "Generate a new problem file in the workspace.",
  parameters: {
    type: Type.OBJECT, 
    properties: {
      filename: { type: Type.STRING, description: "Descriptive name (e.g. 'binary_tree_sum.cpp')." },
      content: { type: Type.STRING, description: "Initial file content." }
    },
    required: ["filename", "content"]
  }
};

const EvaluationReportDisplay = ({ report }: { report: MockInterviewReport }) => {
    if (!report) return null;

    const [expandedFileIndex, setExpandedFileIndex] = useState<number | null>(null);
    const [showTranscript, setShowTranscript] = useState(false);

    return (
        <div className="w-full space-y-8 animate-fade-in-up">
            <div className="flex flex-wrap justify-center gap-6">
                <div className="px-10 py-6 bg-slate-900 rounded-[2rem] border border-indigo-500/30 shadow-2xl flex flex-col items-center min-w-[180px]">
                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Neural Score</p>
                    <p className="text-6xl font-black text-white italic tracking-tighter">{report.score}</p>
                    <div className="w-12 h-1 bg-indigo-500 mt-2 rounded-full"></div>
                </div>
                <div className="px-10 py-6 bg-slate-900 rounded-[2rem] border border-slate-800 shadow-2xl flex flex-col items-center min-w-[220px] justify-center">
                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-2">Verdict</p>
                    <div className={`px-6 py-2 rounded-xl border text-lg font-black uppercase tracking-tighter ${String(report.verdict).toLowerCase().includes('hire') ? 'bg-emerald-900/20 border-emerald-500/30 text-emerald-400' : 'bg-red-900/20 border-red-500/30 text-red-400'}`}>
                        {report.verdict}
                    </div>
                </div>
            </div>

            {/* Source Code Artifacts Section */}
            {report.sourceCode && report.sourceCode.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-xl">
                    <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <FileCode size={18} /> Neural Source Artifacts
                    </h4>
                    <div className="space-y-4">
                        {report.sourceCode.map((file, idx) => {
                            const driveUrl = file.driveId ? getDrivePreviewUrl(file.driveId) : null;
                            const isExpanded = expandedFileIndex === idx;

                            return (
                                <div key={idx} className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/50">
                                    <div 
                                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/50 transition-colors"
                                        onClick={() => setExpandedFileIndex(isExpanded ? null : idx)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-indigo-600/20 rounded-lg text-indigo-400">
                                                <CodeIcon size={14} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-white uppercase tracking-tight">{file.name}</p>
                                                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{file.language}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {driveUrl && (
                                                <a 
                                                    href={driveUrl} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="p-2 bg-slate-800 hover:bg-indigo-600 rounded-lg text-slate-400 hover:text-white transition-all border border-slate-700"
                                                    title="Open in Google Drive"
                                                >
                                                    <ExternalLinkIcon size={14} />
                                                </a>
                                            )}
                                            {isExpanded ? <ChevronDown size={18} className="text-slate-600 rotate-180 transition-transform" /> : <ChevronDown size={18} className="text-slate-600 transition-transform" />}
                                        </div>
                                    </div>
                                    {isExpanded && (
                                        <div className="p-4 border-t border-slate-800 animate-fade-in-up">
                                            <pre className="p-6 bg-black/40 rounded-xl text-xs font-mono text-indigo-200 overflow-x-auto leading-relaxed max-h-[400px]">
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

            {/* Chat Transcript Section */}
            {report.transcript && report.transcript.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-xl overflow-hidden">
                    <div 
                        className="flex items-center justify-between cursor-pointer group"
                        onClick={() => setShowTranscript(!showTranscript)}
                    >
                        <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                            <MessageCircleCode size={18} /> Interview Chat Record
                        </h4>
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 group-hover:text-indigo-400 transition-colors">
                            {showTranscript ? 'Hide History' : 'View History'}
                            <ChevronDown size={16} className={`transition-transform duration-300 ${showTranscript ? 'rotate-180' : ''}`} />
                        </div>
                    </div>
                    
                    {showTranscript && (
                        <div className="mt-8 space-y-4 max-h-[500px] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-slate-800">
                            {report.transcript.map((msg, i) => (
                                <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in-up`}>
                                    <span className={`text-[8px] font-black uppercase mb-1 tracking-widest ${msg.role === 'user' ? 'text-indigo-400' : 'text-red-400'}`}>
                                        {msg.role === 'user' ? 'Candidate' : 'Interviewer'}
                                    </span>
                                    <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-slate-800 text-slate-300 rounded-tl-sm border border-slate-700'}`}>
                                        {msg.text}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2.5rem] shadow-xl">
                    <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Code size={14}/> Technical Skills</h4>
                    <p className="text-sm text-slate-300 leading-relaxed italic">"{report.technicalSkills}"</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2.5rem] shadow-xl">
                    <h4 className="text-[10px] font-black text-pink-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Presentation size={14}/> Communication</h4>
                    <p className="text-sm text-slate-300 leading-relaxed italic">"{report.communication}"</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2.5rem] shadow-xl">
                    <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Users size={14}/> Collaboration</h4>
                    <p className="text-sm text-slate-300 leading-relaxed italic">"{report.collaboration}"</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-emerald-900/5 border border-emerald-500/20 p-8 rounded-[2.5rem] shadow-xl">
                    <h4 className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-6 flex items-center gap-2"><CheckCircle2 size={18}/> Key Strengths</h4>
                    <ul className="space-y-4">
                        {report.strengths?.map((s, i) => (
                            <li key={i} className="flex items-start gap-3 text-sm text-slate-200">
                                <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={16}/>
                                <span>{s}</span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="bg-red-900/5 border border-red-500/20 p-8 rounded-[2.5rem] shadow-xl">
                    <h4 className="text-xs font-black text-red-400 uppercase tracking-widest mb-6 flex items-center gap-2"><AlertTriangle size={18}/> Improvement Areas</h4>
                    <ul className="space-y-4">
                        {report.areasForImprovement?.map((a, i) => (
                            <li key={i} className="flex items-start gap-3 text-sm text-slate-200">
                                <div className="mt-2 w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></div>
                                <span>{a}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-xl">
                <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-6 flex items-center gap-2"><BookOpen size={18}/> Suggested Learning Path</h4>
                <div className="prose prose-invert prose-sm max-w-none">
                    <MarkdownView content={report.learningMaterial || ''} />
                </div>
            </div>
        </div>
    );
};

export const MockInterview: React.FC<MockInterviewProps> = ({ onBack, userProfile, onStartLiveSession, isProMember }) => {
  if (isProMember === false) {
      return (
          <div className="h-full flex items-center justify-center p-6 bg-slate-950">
              <div className="max-w-md w-full bg-slate-900 border border-indigo-500/30 rounded-[3rem] p-12 text-center shadow-2xl">
                  <Lock size={48} className="text-indigo-400 mx-auto mb-6" />
                  <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-4">Pro Access Required</h2>
                  <p className="text-slate-400 text-sm mb-10 font-medium">Technical Mock Interviews require an active Pro Membership to handle specialized neural evaluation logic.</p>
                  <button onClick={onBack} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest rounded-2xl transition-all">Back to Hub</button>
              </div>
          </div>
      );
  }

  const [view, setView] = useState<'selection' | 'setup' | 'active' | 'feedback' | 'archive'>('selection');
  const [interviewMode, setInterviewMode] = useState<'coding' | 'system_design' | 'behavioral' | 'quick_screen'>('coding');
  const [interviewLanguage, setInterviewLanguage] = useState<'c++' | 'python' | 'javascript' | 'java'>('c++');
  const [jobDescription, setJobDescription] = useState('');
  const [interviewerPersona, setInterviewerPersona] = useState('Senior Staff Engineer at Google. Rigorous but fair. Focuses on scalability and data structures.');
  
  const [isLive, setIsLive] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const transcriptRef = useRef<TranscriptItem[]>([]);
  const [files, setFiles] = useState<CodeFile[]>([]);
  const filesRef = useRef<CodeFile[]>([]); 
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const activeFileIndexRef = useRef(0);
  const [volume, setVolume] = useState(0);

  const [apiLogs, setApiLogs] = useState<ApiLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  const [interviewDuration, setInterviewDuration] = useState(15); 
  const [timeLeft, setTimeLeft] = useState(15 * 60); 
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoReconnectAttempts = useRef(0);
  const maxAutoRetries = 10;
  
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<MockInterviewReport | null>(null);
  const [pastInterviews, setPastInterviews] = useState<MockInterviewRecording[]>([]);

  const serviceRef = useRef<GeminiLiveService | null>(null);
  const sessionFolderIdRef = useRef<string | null>(null);
  const currentUser = auth?.currentUser;

  const addApiLog = useCallback((msg: string, type: ApiLog['type'] = 'info', code?: string) => {
      const time = new Date().toLocaleTimeString();
      setApiLogs(prev => [{ time, msg, type, code }, ...prev].slice(0, 100));
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

  useEffect(() => {
    if (view === 'archive' && auth.currentUser) {
        getUserInterviews(auth.currentUser.uid).then(setPastInterviews);
    }
  }, [view]);

  useEffect(() => {
    if (isLive && view === 'active' && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isLive, view, timeLeft]);

  const handleFileChange = (updated: CodeFile) => {
      setFiles(prev => {
          const next = prev.map(f => f.path === updated.path ? updated : f);
          filesRef.current = next;
          return next;
      });
  };

  const handleSyncCodeWithAi = useCallback((file: CodeFile) => {
    if (serviceRef.current) {
        const syncMessage = `NEURAL SNAPSHOT: I have updated the code in "${file.name}". Please review the current state:\n\n\`\`\`${file.language}\n${file.content}\n\`\`\``;
        serviceRef.current.sendText(syncMessage);
        addApiLog("Manually synced code to AI context", "info");
    }
  }, [addApiLog]);

  const connectToAI = useCallback(async (isAutoRetry = false) => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    
    if (isAutoRetry) {
        setIsRecovering(true);
        addApiLog(`Attempting reconnection ${autoReconnectAttempts.current + 1}/${maxAutoRetries}...`, "warn");
        if (serviceRef.current) await serviceRef.current.disconnect();
    } else {
        setIsLive(false);
        setIsRecovering(false);
        autoReconnectAttempts.current = 0;
        addApiLog("Starting fresh AI connection handshake", "info");
    }

    const service = new GeminiLiveService();
    serviceRef.current = service;

    const isResuming = isAutoRetry || transcriptRef.current.length > 0;

    const systemInstruction = `
        You are conducting a professional technical mock interview. 
        MODE: ${interviewMode.toUpperCase()}
        PROGRAMMING LANGUAGE: ${interviewLanguage.toUpperCase()}
        INTERVIEWER PERSONA: ${interviewerPersona}
        JOB DESCRIPTION: ${jobDescription || 'General Software Engineering'}
        CANDIDATE: ${userProfile?.displayName || 'Candidate'}
        TIME LIMIT: ${interviewDuration} minutes

        CRITICAL RECOVERY RULES:
        1. IF YOU ARE RESUMING (Check first message): You MUST continue exactly where you left off. 
        2. DO NOT greet the candidate again. 
        3. DO NOT ask a new question if the candidate was already working on a problem.
        4. YOU MUST use 'get_current_code' immediately after resuming to see the latest progress.
        5. If you see code in the snapshot, acknowledge it briefly and resume the dialogue.
    `;

    try {
        await service.initializeAudio();
        await service.connect('Software Interview Voice', systemInstruction, {
            onOpen: () => {
                setIsLive(true);
                setIsRecovering(false);
                addApiLog("Neural Link established", "info");
                
                if (isResuming) {
                    const active = filesRef.current[activeFileIndexRef.current] || filesRef.current[0];
                    const recentTranscript = transcriptRef.current.slice(-6).map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n');
                    
                    const snapshot = `[NEURAL_SNAPSHOT - RECOVERY HANDSHAKE]
                    RECOVERY MODE: ON
                    We are resuming an active interview. 
                    TIME REMAINING: ${Math.floor(timeLeft / 60)} minutes.
                    
                    CURRENT ACTIVE FILE: "${active?.name || 'Untitled'}"
                    LATEST CODE STATE:
                    \`\`\`${active?.language || 'c++'}
                    ${active?.content || ""}
                    \`\`\`
                    
                    CONVERSATION CONTEXT (Last few turns):
                    ${recentTranscript}
                    
                    INSTRUCTION: Resume immediately. Do NOT introduce yourself. Acknowledge the code above and continue your interrogation.`;
                    
                    serviceRef.current.sendText(snapshot);
                    addApiLog("Context snapshot dispatched for recovery", "info");
                }
            },
            onClose: (reason, code) => {
                setIsLive(false);
                addApiLog(`Connection lost: ${reason}`, "error", String(code));
                if (autoReconnectAttempts.current < maxAutoRetries) {
                    autoReconnectAttempts.current++;
                    const delay = 1000 + (autoReconnectAttempts.current * 1500);
                    addApiLog(`Scheduling retry in ${delay}ms`, "info");
                    reconnectTimeoutRef.current = setTimeout(() => connectToAI(true), delay);
                } else {
                    setIsRecovering(false);
                    addApiLog("Maximum reconnection attempts reached.", "error");
                }
            },
            onError: (err, code) => {
                setIsLive(false);
                addApiLog(`API Error: ${err}`, "error", code);
                if (code === 'RATE_LIMIT') {
                    addApiLog("Rate limit hit. Cooling down for 10s...", "warn");
                    reconnectTimeoutRef.current = setTimeout(() => connectToAI(true), 10000);
                } else if (autoReconnectAttempts.current < maxAutoRetries) {
                    autoReconnectAttempts.current++;
                    reconnectTimeoutRef.current = setTimeout(() => connectToAI(true), 3000);
                }
            },
            onVolumeUpdate: (v) => setVolume(v),
            onTranscript: (text, isUser) => {
                setTranscript(prev => {
                    const role = isUser ? 'user' : 'ai';
                    if (text.includes('[NEURAL_SNAPSHOT')) return prev;

                    if (prev.length > 0 && prev[prev.length - 1].role === role) {
                        return [...prev.slice(0, -1), { ...prev[prev.length - 1], text: prev[prev.length - 1].text + text }];
                    }
                    return [...prev, { role, text, timestamp: Date.now() }];
                });
            },
            onToolCall: async (toolCall) => {
                for (const fc of toolCall.functionCalls) {
                    const args = fc.args as any;
                    addApiLog(`Tool Call: ${fc.name}`, "info");
                    if (fc.name === 'create_interview_file') {
                        const filename = args.filename;
                        const content = args.content;
                        const drivePath = `drive://${generateSecureId()}`;
                        
                        const newFile: CodeFile = {
                            name: filename,
                            path: drivePath,
                            content: content,
                            language: getLanguageFromExt(filename),
                            loaded: true, isDirectory: false
                        };

                        const token = getDriveToken();
                        if (token && sessionFolderIdRef.current) {
                            try {
                                const fileId = await uploadToDrive(token, sessionFolderIdRef.current, filename, content);
                                newFile.driveId = fileId;
                            } catch(e) { addApiLog("Drive sync failed for new file", "warn"); }
                        }

                        setFiles(prev => {
                            const next = [...prev, newFile];
                            filesRef.current = next;
                            return next;
                        });
                        const newIndex = filesRef.current.length - 1;
                        setActiveFileIndex(newIndex);
                        activeFileIndexRef.current = newIndex;
                        service.sendToolResponse({ id: fc.id, name: fc.name, response: { result: "File created and focused in workspace." } });
                    } else if (fc.name === 'get_current_code') {
                        const active = filesRef.current[activeFileIndexRef.current];
                        service.sendToolResponse({ id: fc.id, name: fc.name, response: { code: active?.content || "" } });
                    } else if (fc.name === 'update_active_file') {
                        const newContent = args.content || args.new_content || args.code;
                        if (newContent !== undefined) {
                            const active = filesRef.current[activeFileIndexRef.current];
                            handleFileChange({ ...active, content: newContent });
                            
                            const token = getDriveToken();
                            if (token && sessionFolderIdRef.current && !active.path.startsWith('local-')) {
                                uploadToDrive(token, sessionFolderIdRef.current, active.name, newContent).then(fid => {
                                    handleFileChange({ ...active, content: newContent, driveId: fid });
                                }).catch(console.warn);
                            }
                        }
                        service.sendToolResponse({ id: fc.id, name: fc.name, response: { result: "File updated." } });
                    }
                }
            }
        }, [{ functionDeclarations: [getCodeTool, createInterviewFileTool, updateActiveFileTool] }]);
    } catch(e: any) {
        setIsLive(false);
        setIsRecovering(false);
        addApiLog(`Connection Exception: ${e.message}`, "error");
    }
  }, [interviewMode, interviewLanguage, interviewerPersona, jobDescription, userProfile, interviewDuration, timeLeft, addApiLog]);

  const handleStartInterview = async () => {
    setIsLoading(true);
    setApiLogs([]);
    const sid = generateSecureId().substring(0, 8);
    addApiLog("Initializing workspace and Drive folders...", "info");
    
    try {
        const token = getDriveToken() || await connectGoogleDrive();
        if (token) {
            const root = await ensureCodeStudioFolder(token);
            const interviewsFolder = await ensureFolder(token, 'MockInterviews', root);
            sessionFolderIdRef.current = await ensureFolder(token, `Session_${sid}_${interviewLanguage}`, interviewsFolder);
            addApiLog("Drive vault secured.", "info");
        }
    } catch(e) {
        addApiLog("Drive integration disabled for this session.", "warn");
    }

    const welcomeFile: CodeFile = {
        name: 'interview_notes.md',
        path: 'drive://welcome',
        content: `# Welcome to your ${interviewMode.toUpperCase()} Interview\n\n**Interviewer:** ${interviewerPersona}\n**Role Context:** ${jobDescription || 'Software Engineer'}\n**Language:** ${interviewLanguage.toUpperCase()}\n**Duration:** ${interviewDuration} minutes\n\nWaiting for the interviewer to join the session...`,
        language: 'markdown',
        loaded: true,
        isDirectory: false
    };
    
    setFiles([welcomeFile]);
    filesRef.current = [welcomeFile];
    setActiveFileIndex(0);
    activeFileIndexRef.current = 0;
    setTimeLeft(interviewDuration * 60);

    setTranscript([]);
    transcriptRef.current = [];
    setReport(null);
    setView('active');
    
    await connectToAI(false);
    setIsLoading(false);
  };

  const handleEndInterview = async () => {
      setIsLoading(true);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      autoReconnectAttempts.current = maxAutoRetries;
      addApiLog("Interview ended by user. Generating technical evaluation...", "info");

      if (serviceRef.current) {
          try {
              await serviceRef.current.disconnect();
          } catch(e) {
              console.warn("Service disconnect failed", e);
          }
      }
      setIsLive(false);

      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const fullTranscript = transcript.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n\n');
          const finalCodeStr = files.map(f => `FILE: ${f.name}\nCONTENT:\n${f.content}`).join('\n\n---\n\n');
          
          const prompt = `Perform a comprehensive technical evaluation of this mock interview. 
          Language: ${interviewLanguage.toUpperCase()}. 
          Mode: ${interviewMode.toUpperCase()}.
          
          TRANSCRIPT:
          ${fullTranscript}
          
          FINAL CODE:
          ${finalCodeStr}`;

          const response = await ai.models.generateContent({ 
            model: 'gemini-3-flash-preview', 
            contents: prompt, 
            config: { 
                thinkingConfig: { thinkingBudget: 0 },
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        score: { type: Type.NUMBER },
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
          
          // Inject code and transcript artifacts into report
          reportData.sourceCode = [...files];
          reportData.transcript = [...transcript];
          setReport(reportData);

          if (auth.currentUser) {
              const recordingId = generateSecureId();
              await saveInterviewRecording({ 
                id: recordingId, 
                userId: auth.currentUser.uid, 
                userName: auth.currentUser.displayName || 'Candidate', 
                mode: interviewMode, 
                jobDescription, 
                timestamp: Date.now(), 
                videoUrl: '', 
                feedback: JSON.stringify(reportData), 
                transcript: transcript, 
                visibility: 'private',
                language: interviewLanguage
              });
              
              await deductCoins(auth.currentUser.uid, AI_COSTS.TECHNICAL_EVALUATION);
              
              const token = getDriveToken();
              if (token && sessionFolderIdRef.current) {
                  const reportBlob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
                  await uploadToDrive(token, sessionFolderIdRef.current, 'evaluation_report.json', reportBlob);
                  
                  const transcriptText = transcript.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n\n');
                  const transcriptBlob = new Blob([transcriptText], { type: 'text/plain' });
                  await uploadToDrive(token, sessionFolderIdRef.current, 'interview_transcript.txt', transcriptBlob);
              }
          }
          
          setView('feedback');
      } catch (e: any) { 
          console.error("Evaluation failed", e);
          addApiLog("Evaluation synthesis failed.", "error");
          alert("Neural Evaluation failed to synthesize. Returning to main menu.");
          setView('selection');
      } finally { 
          setIsLoading(false); 
      }
  };

  const formatTimeLeft = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full bg-slate-950 text-slate-100 flex flex-col overflow-hidden animate-fade-in relative">
        {isLoading && view === 'active' && (
            <div className="absolute inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-10 text-center space-y-8 animate-fade-in">
                <div className="relative">
                    <div className="w-32 h-32 border-4 border-indigo-500/10 rounded-full" />
                    <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center"><Sparkles className="text-indigo-400 animate-pulse" size={40} /></div>
                </div>
                <div className="space-y-4">
                    <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">Synthesizing Feedback</h2>
                    <p className="text-indigo-300 font-bold uppercase tracking-[0.2em] text-sm animate-pulse">generating interview reporting in progress.....</p>
                </div>
            </div>
        )}

        {view === 'selection' && (
            <div className="flex-1 overflow-y-auto p-6 md:p-12 scrollbar-hide">
                <div className="max-w-6xl mx-auto space-y-12">
                    <div className="flex flex-col md:flex-row justify-between items-end gap-6">
                        <div className="space-y-3">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-red-900/30 border border-red-500/30 rounded-full text-red-400 text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">
                                <Activity size={14}/> Career Evaluation Mode
                            </div>
                            <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">Mock Interview Studio</h1>
                            <p className="text-slate-400 text-lg max-w-xl">Master your technical presence. Practice with specialized AI personas in a live coding environment.</p>
                        </div>
                        <div className="flex gap-2">
                             <button onClick={() => setView('archive')} className="px-6 py-3 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2">
                                <History size={18}/> My Archive
                             </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { id: 'coding', label: 'Algorithmic Coding', icon: Code, color: 'text-indigo-400', desc: 'Focus on LeetCode-style DSA problems.' },
                            { id: 'system_design', label: 'System Design', icon: Layers, color: 'text-emerald-400', desc: 'Architecture, scalability, and distributed systems.' },
                            { id: 'behavioral', label: 'Behavioral Prep', icon: MessageSquare, color: 'text-pink-400', desc: 'STAR method and cultural fit evaluation.' },
                            { id: 'quick_screen', label: 'Quick Screening', icon: Zap, color: 'text-amber-400', desc: 'Fast-paced 15-min technical rapid fire.' }
                        ].map(m => (
                            <button key={m.id} onClick={() => { setInterviewMode(m.id as any); setView('setup'); }} className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] hover:border-indigo-500 transition-all text-left group flex flex-col h-full shadow-xl">
                                <div className={`p-4 rounded-2xl bg-slate-950 border border-slate-800 mb-6 group-hover:scale-110 transition-transform ${m.color}`}><m.icon size={32}/></div>
                                <h3 className="text-xl font-bold text-white mb-2">{m.label}</h3>
                                <p className="text-sm text-slate-500 leading-relaxed flex-1">{m.desc}</p>
                                <ChevronRight className="mt-6 text-slate-700 group-hover:text-indigo-400 group-hover:translate-x-2 transition-all" size={24}/>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {view === 'setup' && (
            <div className="flex-1 flex items-center justify-center p-6 animate-fade-in-up">
                <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl space-y-10">
                    <div className="flex items-center gap-6">
                        <button onClick={() => setView('selection')} className="p-3 hover:bg-slate-800 rounded-2xl text-slate-400 transition-colors"><ArrowLeft size={24}/></button>
                        <div>
                            <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">Configure Session</h2>
                            <p className="text-indigo-400 text-[10px] font-black uppercase tracking-widest mt-1">{interviewMode} Interview</p>
                        </div>
                    </div>
                    <div className="space-y-8">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Programming Language</label>
                            <div className="flex gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
                                {['c++', 'python', 'javascript', 'java'].map(lang => (
                                    <button key={lang} onClick={() => setInterviewLanguage(lang as any)} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all ${interviewLanguage === lang ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>{lang}</button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Job Description</label>
                            <textarea value={jobDescription} onChange={e => setJobDescription(e.target.value)} placeholder="e.g. Senior Backend Engineer..." className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner h-32"/>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Interviewer Persona</label>
                            <input type="text" value={interviewerPersona} onChange={e => setInterviewerPersona(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-4 text-white text-sm outline-none shadow-inner"/>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Session Duration</label>
                            <div className="flex gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
                                {[15, 30, 45].map(d => (
                                    <button key={d} onClick={() => setInterviewDuration(d)} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all ${interviewDuration === d ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>{d} MIN</button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <button onClick={handleStartInterview} disabled={isLoading} className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-indigo-900/40 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50">
                        {isLoading ? <Loader2 className="animate-spin" size={24}/> : <Sparkles size={24}/>}
                        Initialize Sovereign Session
                    </button>
                </div>
            </div>
        )}

        {view === 'active' && (
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
                <div className="flex-1 flex flex-col bg-slate-950 relative overflow-hidden">
                    <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]' : isRecovering ? 'bg-amber-500' : 'bg-slate-700'}`}></div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                {isRecovering ? 'Neural Link Interrupted' : 'Live Recording Studio'}
                            </span>
                            <div className="flex items-center gap-2 px-3 py-1 bg-slate-950 border border-slate-800 rounded-lg shadow-inner">
                                <Clock size={14} className={timeLeft < 120 ? 'text-red-500 animate-pulse' : 'text-indigo-400'}/>
                                <span className={`text-xs font-mono font-black ${timeLeft < 120 ? 'text-red-400' : 'text-white'}`}>{formatTimeLeft(timeLeft)}</span>
                            </div>
                            <button onClick={() => setShowLogs(!showLogs)} className={`p-2 rounded-lg transition-colors ${showLogs ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
                                <TerminalIcon size={16}/>
                            </button>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-32 h-6 overflow-hidden rounded-full"><Visualizer volume={volume} isActive={isLive} color={isRecovering ? "#f59e0b" : "#ef4444"} /></div>
                                {isRecovering && (
                                    <div className="flex items-center gap-1 animate-pulse">
                                        <RefreshCcw size={10} className="text-amber-500 animate-spin"/>
                                        <span className="text-[8px] font-black uppercase text-amber-500 whitespace-nowrap">Recovering...</span>
                                    </div>
                                )}
                            </div>
                            <button onClick={handleEndInterview} disabled={isLoading} className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white text-[10px] font-black uppercase rounded-lg shadow-lg active:scale-95 transition-all disabled:opacity-50">{isLoading ? <Loader2 size={12} className="animate-spin" /> : 'End & Evaluate'}</button>
                        </div>
                    </header>
                    <div className="flex-1 overflow-hidden">
                        {files.length > 0 && (
                            <CodeStudio onBack={() => {}} currentUser={currentUser} userProfile={userProfile} onSessionStart={() => {}} onSessionStop={() => {}} onStartLiveSession={() => {}} initialFiles={files} isInterviewerMode={true} onFileChange={handleFileChange} externalChatContent={transcript} isAiThinking={isThinking} onSyncCodeWithAi={handleSyncCodeWithAi} />
                        )}
                    </div>

                    {/* API Logs Overlay */}
                    {showLogs && (
                        <div className="absolute top-14 left-0 w-80 h-[400px] bg-slate-900/95 border-r border-b border-indigo-500/30 shadow-2xl z-[150] flex flex-col animate-fade-in-up backdrop-blur-md">
                            <div className="p-3 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Neural Diagnostic Matrix</span>
                                <button onClick={() => setShowLogs(false)} className="text-slate-500 hover:text-white"><X size={14}/></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 font-mono text-[10px] space-y-3 scrollbar-hide">
                                {apiLogs.length === 0 ? (
                                    <p className="text-slate-600 italic">No events recorded.</p>
                                ) : (
                                    apiLogs.map((log, i) => (
                                        <div key={i} className={`p-2 rounded-lg border ${log.type === 'error' ? 'bg-red-950/20 border-red-900/50 text-red-300' : log.type === 'warn' ? 'bg-amber-950/20 border-amber-900/50 text-amber-300' : 'bg-slate-950/50 border-slate-800 text-slate-300'}`}>
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="opacity-40">{log.time}</span>
                                                {log.code && <span className="px-1.5 py-0.5 bg-black/40 rounded text-[8px] font-black">{log.code}</span>}
                                            </div>
                                            <p className="break-words leading-relaxed">{log.msg}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="p-3 bg-slate-950/50 border-t border-slate-800 text-center">
                                <button onClick={() => setApiLogs([])} className="text-[9px] font-bold text-slate-500 hover:text-white uppercase tracking-widest transition-colors">Clear Ledger</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}

        {view === 'feedback' && (
            <div className="flex-1 overflow-y-auto p-6 md:p-12 scrollbar-hide">
                <div className="max-w-4xl mx-auto space-y-12 pb-20">
                    <div className="text-center space-y-4">
                        <div className="inline-flex p-4 bg-indigo-600/10 rounded-full text-indigo-400 border border-indigo-500/20 mb-2"><Trophy size={40}/></div>
                        <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">Evaluation Ready</h1>
                        <p className="text-slate-400 text-lg font-medium">Your session has been analyzed and archived to your Ledger & Drive.</p>
                    </div>
                    {report && <EvaluationReportDisplay report={report} />}
                    <div className="flex justify-center gap-4"><button onClick={() => setView('selection')} className="px-10 py-4 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all active:scale-95">Main Menu</button></div>
                </div>
            </div>
        )}

        {view === 'archive' && (
            <div className="flex-1 overflow-y-auto p-6 md:p-12 scrollbar-hide">
                <div className="max-w-6xl mx-auto space-y-8">
                    <div className="flex items-center gap-6 mb-10"><button onClick={() => setView('selection')} className="p-3 hover:bg-slate-800 rounded-2xl text-slate-400 transition-colors"><ArrowLeft size={24}/></button><h1 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">Neural Archives</h1></div>
                    {pastInterviews.length === 0 ? (<div className="py-32 text-center text-slate-500 border-2 border-dashed border-slate-800 rounded-[3rem] space-y-6"><History size={64} className="mx-auto opacity-10"/><p className="text-lg font-bold">Empty Ledger</p></div>) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {pastInterviews.map(iv => (
                                <div key={iv.id} className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 hover:border-indigo-500/50 transition-all flex flex-col gap-6 shadow-xl relative overflow-hidden group">
                                    <div className="relative z-10">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-indigo-400"><Video size={24}/></div>
                                            <button onClick={(e) => { e.stopPropagation(); deleteInterview(iv.id).then(() => setPastInterviews(p => p.filter(x => x.id !== iv.id))); }} className="p-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={18}/></button>
                                        </div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-xl font-bold text-white uppercase tracking-tight">{iv.mode.replace('_', ' ')}</h3>
                                            <span className="bg-indigo-900/40 text-indigo-400 px-2 py-0.5 rounded text-[8px] font-black border border-indigo-500/20">{iv.language?.toUpperCase() || 'C++'}</span>
                                        </div>
                                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{new Date(iv.timestamp).toLocaleDateString()}</p>
                                        <button onClick={() => { try { const fb = JSON.parse(iv.feedback || '{}'); setReport(fb); setView('feedback'); } catch(e) { alert("Archive corrupted."); } }} className="mt-8 text-xs font-black text-indigo-400 uppercase tracking-widest hover:underline flex items-center gap-1">View Full Report <ChevronRight size={14}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}
    </div>
  );
};

export default MockInterview;
