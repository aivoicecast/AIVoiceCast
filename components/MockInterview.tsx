import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MockInterviewRecording, TranscriptItem, CodeFile, UserProfile, Channel, CodeProject, RecordingSession } from '../types';
import { auth } from '../services/firebaseConfig';
import { saveInterviewRecording, getPublicInterviews, deleteInterview, updateUserProfile, uploadFileToStorage, getUserInterviews, updateInterviewMetadata, saveCodeProject, getCodeProject, getUserProfile, saveRecordingReference } from '../services/firestoreService';
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
  FolderPlus, Share2
} from 'lucide-react';
import { getGlobalAudioContext, getGlobalMediaStreamDest, warmUpAudioContext, stopAllPlatformAudio } from '../utils/audioUtils';
import { getDriveToken, signInWithGoogle, connectGoogleDrive } from '../services/authService';
import { ensureFolder, uploadToDrive, downloadDriveFileAsBlob, deleteDriveFile, ensureCodeStudioFolder } from '../services/googleDriveService';

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
}

interface MockInterviewProps {
  onBack: () => void;
  userProfile: UserProfile | null;
  onStartLiveSession: (channel: Channel, context?: string, recordingEnabled?: boolean, bookingId?: string, videoEnabled?: boolean, cameraEnabled?: boolean, activeSegment?: { index: number, lectureId: string }) => void;
}

// Added missing helper to determine language from filename extension
function getLanguageFromExt(filename: string): CodeFile['language'] {
    if (!filename) return 'text';
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
    return 'text';
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
      new_content: { type: Type.STRING, description: "Full new content for the file." }
    },
    required: ["new_content"]
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] shadow-xl">
                    <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Code size={14}/> Technical Skills</h4>
                    <p className="text-sm text-slate-300 leading-relaxed italic">"{report.technicalSkills}"</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] shadow-xl">
                    <h4 className="text-[10px] font-black text-pink-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Presentation size={14}/> Communication</h4>
                    <p className="text-sm text-slate-300 leading-relaxed italic">"{report.communication}"</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] shadow-xl">
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
                    <MarkdownView content={report.learningMaterial} />
                </div>
            </div>
        </div>
    );
};

export const MockInterview: React.FC<MockInterviewProps> = ({ onBack, userProfile, onStartLiveSession }) => {
  const [view, setView] = useState<'selection' | 'setup' | 'active' | 'feedback' | 'archive'>('selection');
  const [interviewMode, setInterviewMode] = useState<'coding' | 'system_design' | 'behavioral' | 'quick_screen'>('coding');
  const [jobDescription, setJobDescription] = useState('');
  const [interviewerPersona, setInterviewerPersona] = useState('Senior Staff Engineer at Google. Rigorous but fair. Focuses on scalability and data structures.');
  
  const [isLive, setIsLive] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [files, setFiles] = useState<CodeFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<MockInterviewReport | null>(null);
  const [pastInterviews, setPastInterviews] = useState<MockInterviewRecording[]>([]);
  const [activeArchiveId, setActiveArchiveId] = useState<string | null>(null);

  const serviceRef = useRef<GeminiLiveService | null>(null);
  const sessionFolderIdRef = useRef<string | null>(null);
  // Defined currentUser from auth for components that need it
  const currentUser = auth?.currentUser;

  useEffect(() => {
    if (view === 'archive' && auth.currentUser) {
        getUserInterviews(auth.currentUser.uid).then(setPastInterviews);
    }
  }, [view]);

  const handleStartInterview = async () => {
    setIsLoading(true);
    const sid = generateSecureId();
    
    // 1. Create Workspace in Drive
    try {
        const token = getDriveToken() as string;
        if (token) {
            const root = await ensureCodeStudioFolder(token);
            sessionFolderIdRef.current = await ensureFolder(token, `Interview_${sid.substring(0,8)}`, root);
        }
    } catch(e) {}

    // 2. Prep Interview State
    const welcomeFile: CodeFile = {
        name: 'interview_notes.md',
        path: 'drive://welcome',
        content: `# Welcome to your ${interviewMode.toUpperCase()} Interview\n\n**Interviewer:** ${interviewerPersona}\n**Role Context:** ${jobDescription || 'Software Engineer'}\n\nWaiting for the interviewer to join the session...`,
        language: 'markdown',
        loaded: true,
        isDirectory: false
    };
    setFiles([welcomeFile]);
    setTranscript([]);
    setReport(null);
    setView('active');
    
    // 3. Connect Live
    const service = new GeminiLiveService();
    serviceRef.current = service;

    const systemInstruction = `
        You are conducting a professional mock interview. 
        MODE: ${interviewMode.toUpperCase()}
        INTERVIEWER PERSONA: ${interviewerPersona}
        JOB DESCRIPTION: ${jobDescription || 'General Software Engineering'}
        CANDIDATE: ${userProfile?.displayName || 'Candidate'}

        INSTRUCTIONS:
        1. Start by introducing yourself and the problem.
        2. For CODING: Create a problem file using 'create_interview_file'.
        3. For SYSTEM DESIGN: Use the whiteboard if available, or markdown files.
        4. YOU MUST use 'get_current_code' periodically to see what the candidate is typing.
        5. Be conversational. Don't just lecture.
        6. If the candidate gets stuck, provide subtle hints.
    `;

    try {
        await service.connect('Software Interview Voice', systemInstruction, {
            onOpen: () => setIsLive(true),
            onClose: () => { setIsLive(false); },
            onError: (err) => { setIsLive(false); alert("Neural link failed: " + err); },
            onVolumeUpdate: () => {},
            onTranscript: (text, isUser) => {
                setTranscript(prev => {
                    const role = isUser ? 'user' : 'ai';
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
                        const newFile: CodeFile = {
                            name: args.filename,
                            path: `drive://${generateSecureId()}`,
                            content: args.content,
                            language: getLanguageFromExt(args.filename),
                            loaded: true, isDirectory: false
                        };
                        setFiles(prev => [...prev, newFile]);
                        setActiveFileIndex(prev => prev + 1);
                        service.sendToolResponse([{ id: fc.id, name: fc.name, response: { result: "File created and focused." } }]);
                    } else if (fc.name === 'get_current_code') {
                        const activeCode = files[activeFileIndex]?.content || "";
                        service.sendToolResponse([{ id: fc.id, name: fc.name, response: { code: activeCode } }]);
                    } else if (fc.name === 'update_active_file') {
                        handleFileChange({ ...files[activeFileIndex], content: args.new_content });
                        service.sendToolResponse([{ id: fc.id, name: fc.name, response: { result: "File updated." } }]);
                    }
                }
            }
        }, [{ functionDeclarations: [getCodeTool, createInterviewFileTool, updateActiveFileTool] }]);
    } catch(e) {
        setIsLive(false);
    } finally {
        setIsLoading(false);
    }
  };

  const handleEndInterview = async () => {
      if (!confirm("Are you sure you want to end the interview and generate feedback?")) return;
      
      setIsLoading(true);
      if (serviceRef.current) await serviceRef.current.disconnect();
      
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const fullTranscript = transcript.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n\n');
          const finalCode = files.map(f => `FILE: ${f.name}\nCONTENT:\n${f.content}`).join('\n\n---\n\n');

          const prompt = `
            Analyze this mock interview session.
            TRANSCRIPT:
            ${fullTranscript}

            FINAL CODE STATE:
            ${finalCode}

            TASK: Generate a comprehensive evaluation report in JSON format.
            {
              "score": number (0-100),
              "technicalSkills": "string summary",
              "communication": "string summary",
              "collaboration": "string summary",
              "strengths": ["string"],
              "areasForImprovement": ["string"],
              "verdict": "Strong Hire" | "Hire" | "No Hire" | "Reject",
              "summary": "overall concluding paragraph",
              "learningMaterial": "Markdown links and resources for their weak points"
            }
          `;

          const response = await ai.models.generateContent({
              model: 'gemini-3-pro-preview',
              contents: prompt,
              config: { responseMimeType: 'application/json' }
          });

          const reportData = JSON.parse(response.text || '{}');
          setReport(reportData);
          setView('feedback');

          // Save to Archive
          if (auth.currentUser) {
              await saveInterviewRecording({
                  id: generateSecureId(),
                  userId: auth.currentUser.uid,
                  userName: auth.currentUser.displayName || 'Candidate',
                  mode: interviewMode,
                  jobDescription,
                  timestamp: Date.now(),
                  videoUrl: '',
                  feedback: response.text,
                  transcript: transcript,
                  visibility: 'private'
              });
          }
      } catch (e) {
          alert("Feedback generation failed.");
      } finally {
          setIsLoading(false);
      }
  };

  const handleFileChange = (updated: CodeFile) => {
      setFiles(prev => prev.map(f => f.path === updated.path ? updated : f));
  };

  return (
    <div className="h-full bg-slate-950 text-slate-100 flex flex-col overflow-hidden animate-fade-in">
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
                            <button 
                                key={m.id}
                                onClick={() => { setInterviewMode(m.id as any); setView('setup'); }}
                                className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] hover:border-indigo-500 transition-all text-left group flex flex-col h-full shadow-xl"
                            >
                                <div className={`p-4 rounded-2xl bg-slate-950 border border-slate-800 mb-6 group-hover:scale-110 transition-transform ${m.color}`}>
                                    <m.icon size={32}/>
                                </div>
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
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Job Description or Target Role</label>
                            <textarea 
                                value={jobDescription} 
                                onChange={e => setJobDescription(e.target.value)} 
                                placeholder="e.g. Senior Backend Engineer at Netflix, focus on Java/Spring..."
                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white placeholder-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner h-32"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Interviewer Persona Override</label>
                            <input 
                                type="text" 
                                value={interviewerPersona}
                                onChange={e => setInterviewerPersona(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-4 text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                            />
                        </div>
                    </div>

                    <button 
                        onClick={handleStartInterview} 
                        disabled={isLoading}
                        className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-indigo-900/40 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={24}/> : <Sparkles size={24}/>}
                        Initialize Evaluation Link
                    </button>
                </div>
            </div>
        )}

        {view === 'active' && (
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                <div className="flex-1 flex flex-col bg-slate-950 relative overflow-hidden">
                    <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'bg-slate-700'}`}></div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Live Recording Studio</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                                {files.map((f, i) => (
                                    <button key={f.path} onClick={() => setActiveFileIndex(i)} className={`px-3 py-1 text-[10px] font-bold rounded transition-all ${activeFileIndex === i ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>{f.name}</button>
                                ))}
                            </div>
                            <button onClick={handleEndInterview} className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white text-[10px] font-black uppercase rounded-lg shadow-lg active:scale-95 transition-all">End & Evaluate</button>
                        </div>
                    </header>
                    
                    <div className="flex-1 overflow-hidden">
                        {files.length > 0 && (
                            <CodeStudio 
                                onBack={() => {}} 
                                currentUser={currentUser} 
                                userProfile={userProfile} 
                                onSessionStart={() => {}} 
                                onSessionStop={() => {}} 
                                onStartLiveSession={() => {}}
                                initialFiles={files}
                                isInterviewerMode={true}
                                onFileChange={handleFileChange}
                                externalChatContent={transcript}
                                isAiThinking={isThinking}
                            />
                        )}
                    </div>
                </div>
            </div>
        )}

        {view === 'feedback' && (
            <div className="flex-1 overflow-y-auto p-6 md:p-12 scrollbar-hide">
                <div className="max-w-4xl mx-auto space-y-12 pb-20">
                    <div className="text-center space-y-4">
                        <div className="inline-flex p-4 bg-indigo-600/10 rounded-full text-indigo-400 border border-indigo-500/20 mb-2">
                            <Trophy size={40}/>
                        </div>
                        <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">Evaluation Ready</h1>
                        <p className="text-slate-400 text-lg font-medium">Your session has been analyzed by the Neural Evaluation Engine.</p>
                    </div>

                    {report && <EvaluationReportDisplay report={report} />}

                    <div className="flex justify-center gap-4">
                        <button onClick={() => setView('selection')} className="px-10 py-4 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all active:scale-95">Main Menu</button>
                        <button className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-indigo-900/40 transition-all active:scale-95 flex items-center gap-2"><Share2 size={20}/> Share Report</button>
                    </div>
                </div>
            </div>
        )}

        {view === 'archive' && (
            <div className="flex-1 overflow-y-auto p-6 md:p-12 scrollbar-hide">
                <div className="max-w-6xl mx-auto space-y-8">
                    <div className="flex items-center gap-6 mb-10">
                        <button onClick={() => setView('selection')} className="p-3 hover:bg-slate-800 rounded-2xl text-slate-400 transition-colors"><ArrowLeft size={24}/></button>
                        <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">Neural Archives</h1>
                    </div>

                    {pastInterviews.length === 0 ? (
                        <div className="py-32 text-center text-slate-500 border-2 border-dashed border-slate-800 rounded-[3rem] space-y-6">
                            <History size={64} className="mx-auto opacity-10"/>
                            <p className="text-lg font-bold">Empty Ledger</p>
                            <p className="text-sm">Complete your first evaluation to start your performance history.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {pastInterviews.map(iv => (
                                <div key={iv.id} className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 hover:border-indigo-500/50 transition-all flex flex-col gap-6 shadow-xl relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-12 bg-indigo-500/5 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <div className="relative z-10">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className={`p-3 rounded-2xl bg-slate-950 border border-slate-800 text-indigo-400`}>
                                                <Video size={24}/>
                                            </div>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); deleteInterview(iv.id).then(() => setPastInterviews(p => p.filter(x => x.id !== iv.id))); }}
                                                className="p-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                            >
                                                <Trash2 size={18}/>
                                            </button>
                                        </div>
                                        <h3 className="text-xl font-bold text-white mb-1">{iv.mode.toUpperCase()}</h3>
                                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{new Date(iv.timestamp).toLocaleDateString()}</p>
                                        <p className="mt-4 text-sm text-slate-400 line-clamp-2 italic">"{iv.jobDescription}"</p>
                                        
                                        <div className="mt-8 pt-6 border-t border-slate-800 flex items-center justify-between">
                                            <button onClick={() => { setReport(JSON.parse(iv.feedback || '{}')); setView('feedback'); }} className="text-xs font-black text-indigo-400 uppercase tracking-widest hover:underline flex items-center gap-1">View Full Report <ChevronRight size={14}/></button>
                                            <span className="text-[10px] text-slate-600 font-mono">ID: {iv.id.substring(0,8)}</span>
                                        </div>
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