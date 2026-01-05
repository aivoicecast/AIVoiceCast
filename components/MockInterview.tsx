
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MockInterviewRecording, TranscriptItem, CodeFile, UserProfile, Channel, CodeProject } from '../types';
import { auth } from '../services/firebaseConfig';
import { saveInterviewRecording, getPublicInterviews, deleteInterview, updateUserProfile, uploadFileToStorage, getUserInterviews, updateInterviewMetadata, saveCodeProject, getCodeProject } from '../services/firestoreService';
import { getDriveToken, connectGoogleDrive } from '../services/authService';
import { uploadToYouTube, getYouTubeVideoUrl, getYouTubeEmbedUrl } from '../services/youtubeService';
import { GeminiLiveService } from '../services/geminiLive';
import { GoogleGenAI, Type } from '@google/genai';
import { generateSecureId } from '../utils/idUtils';
import { saveLocalRecording, deleteLocalRecording, getLocalRecordings } from '../utils/db';
import CodeStudio from './CodeStudio';
import { MarkdownView } from './MarkdownView';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { ArrowLeft, Video, Mic, Monitor, Play, Save, Loader2, Search, Trash2, CheckCircle, X, Download, ShieldCheck, User, Users, Building, FileText, ChevronRight, Zap, SidebarOpen, SidebarClose, Code, MessageSquare, Sparkles, Languages, Clock, Camera, Bot, CloudUpload, Trophy, BarChart3, ClipboardCheck, Star, Upload, FileUp, Linkedin, FileCheck, Edit3, BookOpen, Lightbulb, Target, ListChecks, MessageCircleCode, GraduationCap, Lock, Globe, ExternalLink, PlayCircle, RefreshCw, FileDown, Briefcase, Package, Code2, StopCircle, Youtube, AlertCircle, Eye, EyeOff, SaveAll, Wifi, WifiOff, Activity, ShieldAlert, Timer, FastForward, ClipboardList, Layers, Bug } from 'lucide-react';

interface MockInterviewProps {
  onBack: () => void;
  userProfile: UserProfile | null;
  onStartLiveSession: (channel: Channel, context?: string) => void;
}

interface IdealAnswer {
  question: string;
  expectedAnswer: string;
  rationale: string;
}

interface InterviewReport {
  score: number;
  technicalSkills: string;
  communication: string;
  collaboration: string;
  strengths: string[];
  areasForImprovement: string[];
  verdict: 'Strong Hire' | 'Hire' | 'No Hire' | 'Strong No Hire' | 'Move Forward' | 'Reject';
  summary: string;
  idealAnswers: IdealAnswer[];
  learningMaterial: string; 
  todoList: string[];
  fitStatus?: 'underfit' | 'overfit' | 'match';
  missingKnowledge?: string[];
}

const LANGUAGES = ['TypeScript', 'JavaScript', 'Python', 'C++', 'Java', 'Rust', 'Go', 'C#', 'Swift'];

export const MockInterview: React.FC<MockInterviewProps> = ({ onBack, userProfile, onStartLiveSession }) => {
  const currentUser = auth?.currentUser;

  const [view, setView] = useState<'hub' | 'prep' | 'interview' | 'report'>('hub');
  const [interviews, setInterviews] = useState<MockInterviewRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAiConnected, setIsAiConnected] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  
  const [timeLeft, setTimeLeft] = useState<number>(0); 
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [apiLogs, setApiLogs] = useState<{timestamp: number, msg: string, type: 'info' | 'error' | 'warn'}[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const reconnectAttemptsRef = useRef(0);
  const activeServiceIdRef = useRef<string | null>(null);
  const isEndingRef = useRef(false);

  const [synthesisStep, setSynthesisStep] = useState<string>('');
  const [synthesisPercent, setSynthesisPercent] = useState(0);
  const synthesisIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [mode, setMode] = useState<'coding' | 'system_design' | 'behavioral' | 'quick_screen' | 'assessment_30' | 'assessment_60'>('coding');
  const [language, setLanguage] = useState(userProfile?.defaultLanguage || 'C++');
  const [jobDesc, setJobDesc] = useState('');
  const [resumeText, setResumeText] = useState(userProfile?.resumeText || '');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [youtubePrivacy, setYoutubePrivacy] = useState<'private' | 'unlisted' | 'public'>('unlisted');
  
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [isCodeStudioOpen, setIsCodeStudioOpen] = useState(false);
  const [initialStudioFiles, setInitialStudioFiles] = useState<CodeFile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCodeProjectId, setActiveCodeProjectId] = useState<string | null>(null);
  
  const reportRef = useRef<HTMLDivElement>(null);
  const problemRef = useRef<HTMLDivElement>(null);

  const [activeRecording, setActiveRecording] = useState<MockInterviewRecording | null>(null);
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [videoPlaybackUrl, setVideoPlaybackUrl] = useState<string | null>(null);
  const [generatedProblemMd, setGeneratedProblemMd] = useState('');
  const [isExportingBundle, setIsExportingBundle] = useState(false);

  const liveServiceRef = useRef<GeminiLiveService | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const videoBlobRef = useRef<Blob | null>(null);
  const interviewIdRef = useRef(generateSecureId());
  
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const activeScreenStreamRef = useRef<MediaStream | null>(null);

  const logApi = (msg: string, type: 'info' | 'error' | 'warn' = 'info') => {
    setApiLogs(prev => [{timestamp: Date.now(), msg, type}, ...prev].slice(0, 50));
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getDurationSeconds = (m: string) => {
    if (m === 'quick_screen') return 15 * 60;
    if (m === 'behavioral') return 30 * 60;
    if (m === 'assessment_30') return 30 * 60;
    if (m === 'assessment_60') return 60 * 60;
    return 45 * 60; 
  };

  useEffect(() => {
    if (view === 'interview' && activeStreamRef.current && localVideoRef.current) {
      localVideoRef.current.srcObject = activeStreamRef.current;
    }
  }, [view]);

  useEffect(() => {
    loadInterviews();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [currentUser]);

  const loadInterviews = async () => {
    setLoading(true);
    try {
      const [publicData, userData] = await Promise.all([
        getPublicInterviews(),
        currentUser ? getUserInterviews(currentUser.uid) : Promise.resolve([])
      ]);
      const combined = [...publicData, ...userData];
      const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
      setInterviews(unique.sort((a, b) => b.timestamp - a.timestamp));
    } catch (e) {} finally { setLoading(false); }
  };

  const handleReconnectAi = async (isAuto = false) => {
    if (isEndingRef.current) return;
    
    setIsAiConnected(false);
    if (liveServiceRef.current) liveServiceRef.current.disconnect();

    const backoffTime = isAuto ? Math.min(2000 * Math.pow(2, reconnectAttemptsRef.current), 10000) : 0;
    if (isAuto) logApi(`Neural Link Retrying in ${backoffTime}ms...`, "warn");

    setTimeout(async () => {
      if (isEndingRef.current) return;
      const historyText = transcript.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n');
      const persona = mode.startsWith('assessment') ? 'Objective Technical Proctor' : 'Senior Software Interviewer';
      const jobContext = jobDesc.trim() ? `Job: ${jobDesc}` : "Job: A general senior software engineering role";
      const prompt = `RESUMING SESSION. History recap: ${historyText.substring(historyText.length - 2000)}`;
      const service = new GeminiLiveService();
      activeServiceIdRef.current = service.id;
      liveServiceRef.current = service;

      try {
        logApi(`Initiating WebSocket Handshake...`);
        await service.connect(mode === 'behavioral' ? 'Zephyr' : 'Software Interview Voice', prompt, {
          onOpen: () => {
            if (activeServiceIdRef.current !== service.id) return;
            setIsAiConnected(true);
            reconnectAttemptsRef.current = 0;
            logApi("Handshake Complete. Link Active.");
          },
          onClose: (r) => {
            if (activeServiceIdRef.current !== service.id) return;
            setIsAiConnected(false);
            logApi(`WebSocket closed: ${r}`, "warn");
            if (!isEndingRef.current && isAuto && reconnectAttemptsRef.current < 5) {
              reconnectAttemptsRef.current++;
              handleReconnectAi(true);
            }
          },
          onError: (e: any) => {
             logApi(`Link Error: ${e}`, "error");
          },
          onVolumeUpdate: () => {},
          onTranscript: (text, isUser) => {
            if (activeServiceIdRef.current !== service.id) return;
            setTranscript(prev => {
              const role = isUser ? 'user' : 'ai';
              if (prev.length > 0 && prev[prev.length - 1].role === role) {
                const last = prev[prev.length - 1];
                return [...prev.slice(0, -1), { ...last, text: last.text + text }];
              }
              return [...prev, { role, text, timestamp: Date.now() }];
            });
          }
        });
      } catch (err: any) { logApi(`Init Failure: ${err.message}`, "error"); }
    }, backoffTime);
  };

  const startSmoothProgress = useCallback(() => {
    setSynthesisPercent(0);
    if (synthesisIntervalRef.current) clearInterval(synthesisIntervalRef.current);
    synthesisIntervalRef.current = setInterval(() => {
      setSynthesisPercent(prev => {
        if (prev >= 98) return prev;
        return prev + (100 - prev) * 0.05;
      });
    }, 500);
  }, []);

  const handleStartInterview = async () => {
    setIsStarting(true);
    isEndingRef.current = false;
    reconnectAttemptsRef.current = 0;
    setTranscript([]);
    setReport(null);
    setApiLogs([]);
    videoChunksRef.current = [];
    interviewIdRef.current = generateSecureId();

    const duration = getDurationSeconds(mode);
    setTimeLeft(duration);

    try {
      logApi("Acquiring hardware locks...");
      const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      activeStreamRef.current = camStream;
      activeScreenStreamRef.current = screenStream;

      setView('interview');

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      logApi("Synthesizing problem metadata...");
      
      const isAssessment = mode.startsWith('assessment');
      const assessmentRules = isAssessment ? `STRICT PROCTOR MODE: No hints.` : '';
      const jobContext = jobDesc.trim() ? `Job: ${jobDesc}` : "Job: Senior dev role";
      const problemPrompt = `Generate a coding problem for ${mode} in ${language}. ${jobContext}. ${assessmentRules}`;
      const probResponse = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: problemPrompt });
      setGeneratedProblemMd(probResponse.text || "Introduction needed.");

      const projectId = generateSecureId();
      const ext = language.toLowerCase() === 'python' ? 'py' : (language.toLowerCase().includes('java') ? 'java' : 'cpp');
      const solutionFile: CodeFile = {
          name: `solution.${ext}`, path: `solution.${ext}`, language: language.toLowerCase() as any,
          content: `/* \n * Interview Challenge: ${mode}\n */\n\n`,
          loaded: true, isDirectory: false, isModified: false
      };
      await saveCodeProject({ id: projectId, name: `Interview - ${currentUser?.displayName}`, files: [solutionFile], lastModified: Date.now(), accessLevel: 'restricted', allowedUserIds: currentUser ? [currentUser.uid] : [] });
      setActiveCodeProjectId(projectId);
      setInitialStudioFiles([solutionFile]);

      logApi("Flushing recorder pipeline...");
      const canvas = document.createElement('canvas');
      canvas.width = 1280; canvas.height = 720;
      const ctx = canvas.getContext('2d', { alpha: false })!;
      const camVideo = document.createElement('video'); camVideo.srcObject = camStream; camVideo.muted = true; camVideo.play();
      const screenVideo = document.createElement('video'); screenVideo.srcObject = screenStream; screenVideo.muted = true; screenVideo.play();

      const drawFrame = () => {
        if (isEndingRef.current) return;
        ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (screenVideo.readyState >= 2) ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
        if (camVideo.readyState >= 2) {
          ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 4;
          ctx.strokeRect(940, 520, 320, 180); ctx.drawImage(camVideo, 940, 520, 320, 180);
        }
        requestAnimationFrame(drawFrame);
      };
      drawFrame();

      const combinedStream = canvas.captureStream(30);
      camStream.getAudioTracks().forEach(t => combinedStream.addTrack(t));
      const recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm;codecs=vp8,opus', videoBitsPerSecond: 2500000 });
      recorder.ondataavailable = e => { if (e.data.size > 0) videoChunksRef.current.push(e.data); };
      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setIsRecording(true);

      logApi("Linking Neural Engine...");
      const service = new GeminiLiveService();
      activeServiceIdRef.current = service.id;
      liveServiceRef.current = service;
      
      const persona = isAssessment ? 'Objective Technical Proctor' : 'Senior Software Interviewer';
      const prompt = `Role: ${persona}. ${jobContext}. Project URI: ${projectId}. Resume: ${resumeText}`;
      
      await service.connect(mode === 'behavioral' ? 'Zephyr' : 'Software Interview Voice', prompt, {
        onOpen: () => {
          setIsAiConnected(true);
          logApi("Live connection established.");
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) { handleEndInterview(); return 0; }
                return prev - 1;
            });
          }, 1000);
        },
        onClose: (r) => { if (activeServiceIdRef.current === service.id) { setIsAiConnected(false); logApi(`Link dropped: ${r}`, "warn"); handleReconnectAi(true); } },
        onError: (e) => { if (activeServiceIdRef.current === service.id) { setIsAiConnected(false); handleReconnectAi(true); } },
        onVolumeUpdate: () => {},
        onTranscript: (text, isUser) => {
          if (activeServiceIdRef.current !== service.id) return;
          setTranscript(prev => {
            const role = isUser ? 'user' : 'ai';
            if (prev.length > 0 && prev[prev.length - 1].role === role) {
              const last = prev[prev.length - 1];
              return [...prev.slice(0, -1), { ...last, text: last.text + text }];
            }
            return [...prev, { role, text, timestamp: Date.now() }];
          });
        }
      });
      setIsCodeStudioOpen(mode !== 'quick_screen');
    } catch (e: any) { 
        alert("Startup failed: " + e.message); 
        setView('hub'); 
    } finally { setIsStarting(false); }
  };

  const handleEndInterview = async () => {
    if (isEndingRef.current) return;
    isEndingRef.current = true;
    setIsGeneratingReport(true);
    setReportError(null);
    startSmoothProgress();
    if (timerRef.current) clearInterval(timerRef.current);

    setSynthesisStep('Disconnecting neural link...');
    liveServiceRef.current?.disconnect();
    setIsRecording(false);

    setSynthesisStep('Finalizing multi-GB video buffers...');
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      const blob = await new Promise<Blob>((resolve) => {
        const rec = mediaRecorderRef.current!;
        rec.onstop = () => {
            const finalBlob = new Blob(videoChunksRef.current, { type: 'video/webm' });
            resolve(finalBlob);
        };
        rec.stop();
      });
      videoBlobRef.current = blob;
    }

    activeStreamRef.current?.getTracks().forEach(t => t.stop());
    activeScreenStreamRef.current?.getTracks().forEach(t => t.stop());

    setSynthesisStep('Syncing to Global Cloud & YouTube...');
    let videoUrl = "";
    if (videoBlobRef.current && currentUser) {
        try {
            const token = getDriveToken();
            if (token) {
                const ytId = await uploadToYouTube(token, videoBlobRef.current, {
                    title: `Mock Interview: ${mode} - ${currentUser.displayName}`,
                    description: `Automated Simulation via AIVoiceCast. Mode: ${mode}, Language: ${language}.`,
                    privacyStatus: youtubePrivacy
                });
                videoUrl = getYouTubeVideoUrl(ytId);
                logApi(`YouTube Upload Complete: ${videoUrl}`);
            }
        } catch (e) { logApi("Cloud sync failed. Video stored in local cache.", "warn"); }
    }

    setSynthesisStep('Synthesizing technical metrics...');
    let reportData: InterviewReport | null = null;
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const transcriptText = transcript.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n');
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `Analyze this interview transcript: ${transcriptText}. Return valid JSON with: score (0-100), technischeSkills, communication, collaboration, strengths (list), areasForImprovement (list), verdict, summary, learningMaterial.`,
            config: { responseMimeType: 'application/json' }
        });
        reportData = JSON.parse(response.text || "{}");
    } catch (e: any) { setReportError("Metrics generation failed."); }

    if (reportData) {
      setReport(reportData);
      const rec: MockInterviewRecording = {
        id: interviewIdRef.current, userId: currentUser?.uid || 'guest', userName: currentUser?.displayName || 'Guest',
        mode, language, jobDescription: jobDesc, timestamp: Date.now(), videoUrl: videoUrl,
        transcript: transcript.map(t => ({ role: t.role, text: t.text, timestamp: t.timestamp })),
        feedback: JSON.stringify(reportData), visibility
      };
      await saveInterviewRecording(rec);
      setActiveRecording(rec);
      if (videoBlobRef.current) setVideoPlaybackUrl(URL.createObjectURL(videoBlobRef.current));
      setSynthesisPercent(100);
      setView('report');
    }
    setIsGeneratingReport(false);
    if (synthesisIntervalRef.current) clearInterval(synthesisIntervalRef.current);
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden relative">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-20">
        <div className="flex items-center gap-4">
          <button onClick={() => view === 'hub' ? onBack() : setView('hub')} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"><ArrowLeft size={20} /></button>
          <h1 className="text-lg font-bold text-white flex items-center gap-2"><Video className="text-red-500" /> Mock Interview</h1>
        </div>
        
        {view === 'interview' && (
          <div className="flex items-center gap-4">
            <div className={`px-4 py-1.5 rounded-2xl border bg-slate-950/50 shadow-inner flex items-center gap-2 ${timeLeft < 300 ? 'border-red-500/50 text-red-400 animate-pulse' : 'border-indigo-500/30 text-indigo-400'}`}>
                <Timer size={14}/>
                <span className="font-mono text-base font-black tabular-nums">{formatTime(timeLeft)}</span>
            </div>
            <button onClick={() => setShowDebug(!showDebug)} className={`p-2 rounded-lg transition-colors ${showDebug ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`} title="Diagnostics"><Activity size={18}/></button>
            <button onClick={handleEndInterview} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold shadow-lg">End Session</button>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto scrollbar-hide relative">
        {showDebug && (
          <div className="absolute top-4 right-4 w-80 max-h-[300px] z-[200] bg-slate-900/95 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-fade-in backdrop-blur-md">
            <div className="p-3 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center"><span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2"><Bug size={14}/> Link Debugger</span><button onClick={() => setShowDebug(false)} className="text-slate-500 hover:text-white"><X size={16}/></button></div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-[9px]">
              {apiLogs.length === 0 ? <p className="text-slate-600 italic">Listening for events...</p> : apiLogs.map((log, i) => (<div key={i} className={`flex gap-2 ${log.type === 'error' ? 'text-red-400' : log.type === 'warn' ? 'text-amber-400' : 'text-slate-400'}`}><span className="opacity-40 shrink-0">[{new Date(log.timestamp).toLocaleTimeString()}]</span><span>{log.msg}</span></div>))}
            </div>
          </div>
        )}

        {view === 'hub' && (
          <div className="max-w-6xl mx-auto p-8 space-y-12 animate-fade-in">
            <div className="bg-indigo-600 rounded-[3rem] p-12 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center gap-10">
              <div className="absolute top-0 right-0 p-32 bg-white/10 blur-[100px] rounded-full"></div>
              <div className="relative z-10 flex-1 space-y-6">
                <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">Practice your<br/>Potential.</h2>
                <p className="text-indigo-100 text-lg max-w-sm">Professional AI-driven mock interviews with visual reasoning and real-time coaching.</p>
                <button onClick={() => setView('prep')} className="px-10 py-5 bg-white text-indigo-600 font-black uppercase tracking-widest rounded-2xl shadow-2xl hover:scale-105 transition-all flex items-center gap-3"><Zap size={20} fill="currentColor"/> Begin Preparation</button>
              </div>
              <div className="relative z-10 hidden lg:block"><div className="w-64 h-64 bg-slate-950 rounded-[3rem] border-8 border-indigo-400/30 flex items-center justify-center rotate-3 shadow-2xl"><Bot size={100} className="text-indigo-400 animate-pulse"/></div></div>
            </div>
            <div className="space-y-6">
              <div className="flex justify-between items-end px-2"><h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Simulation History</h3></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin mx-auto text-indigo-400" size={32}/></div> : interviews.length === 0 ? <div className="col-span-full py-20 text-center text-slate-500 border border-dashed border-slate-800 rounded-3xl">No archived sessions.</div> : interviews.map(rec => (
                  <div key={rec.id} onClick={() => { setActiveRecording(rec); setReport(JSON.parse(rec.feedback || '{}')); setView('report'); }} className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 hover:border-indigo-500/50 transition-all group cursor-pointer shadow-xl relative overflow-hidden">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-3"><div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-bold">{rec.userName[0]}</div><div><h4 className="font-bold text-white text-sm">@{rec.userName}</h4><p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{new Date(rec.timestamp).toLocaleDateString()}</p></div></div>
                      <div className="p-2 bg-slate-950 rounded-xl text-indigo-400 group-hover:scale-110 transition-transform"><ShieldCheck size={20}/></div>
                    </div>
                    <div className="space-y-4">
                      <span className="text-[9px] font-black uppercase bg-indigo-900/20 text-indigo-400 px-3 py-1 rounded-full border border-indigo-500/30">{rec.mode.replace('_', ' ')}</span>
                      {rec.videoUrl && <span className="text-[9px] font-black uppercase bg-red-900/20 text-red-500 px-3 py-1 rounded-full border border-red-500/30 ml-2">YouTube Archive</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === 'prep' && (
          <div className="max-w-4xl mx-auto p-12 animate-fade-in-up">
            <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-4">
                    <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest">Candidate Resume</h3>
                    <textarea value={resumeText} onChange={e => setResumeText(e.target.value)} placeholder="Paste resume for better questions..." className="w-full h-48 bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"/>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-4">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Interview Mode</h3>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { id: 'coding', icon: Code, label: 'Algorithm & DS' },
                        { id: 'system_design', icon: Layers, label: 'System Design' },
                        { id: 'behavioral', icon: MessageSquare, label: 'Behavioral' }
                      ].map(m => (<button key={m.id} onClick={() => setMode(m.id as any)} className={`p-4 rounded-2xl border text-left flex items-center justify-between transition-all ${mode === m.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-500'}`}><div className="flex items-center gap-2"><m.icon size={14}/><span className="text-[10px] font-bold uppercase">{m.label}</span></div>{mode === m.id && <CheckCircle size={14}/>}</button>))}
                    </div>
                  </div>
                  <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-4">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Stack</h3>
                    <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-xs font-bold text-white focus:ring-2 focus:ring-indigo-500 outline-none">{LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}</select>
                  </div>
                </div>
              </div>
              <div className="pt-8 border-t border-slate-800 flex justify-end">
                  <button onClick={handleStartInterview} disabled={isStarting} className="px-12 py-5 bg-gradient-to-r from-red-600 to-indigo-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-2xl transition-all hover:scale-105 active:scale-95 disabled:opacity-30">{isStarting ? <Loader2 className="animate-spin" /> : 'Start Simulation & Record'}</button>
              </div>
            </div>
          </div>
        )}

        {view === 'interview' && (
          <div className="h-full flex overflow-hidden relative">
            <div className={`flex flex-col border-r border-slate-800 transition-all ${isCodeStudioOpen ? 'w-[400px]' : 'flex-1'}`}>
              <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0"><span className="font-bold text-white uppercase tracking-tighter flex items-center gap-2"><Bot size={20} className="text-indigo-400"/> AI Agent</span><button onClick={() => setIsCodeStudioOpen(!isCodeStudioOpen)} className="p-2 bg-slate-800 rounded-lg text-xs font-bold uppercase">{isCodeStudioOpen ? 'Hide' : 'Show'} IDE</button></div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide"><div ref={problemRef} className="bg-[#020617] p-8 rounded-2xl border border-slate-800 mb-8"><h1 className="text-2xl font-black text-indigo-400 mb-4 uppercase">Challenge</h1><MarkdownView content={generatedProblemMd} /></div><div className="space-y-4 pb-32">{transcript.map((item, idx) => (<div key={idx} className={`flex flex-col ${item.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in-up`}><span className={`text-[9px] uppercase font-black mb-1 ${item.role === 'user' ? 'text-emerald-400' : 'text-indigo-400'}`}>{item.role === 'user' ? 'You' : 'Interviewer'}</span><div className={`max-w-[90%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${item.role === 'user' ? 'bg-emerald-600 text-white rounded-tr-sm' : 'bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700'}`}>{item.text}</div></div>))}</div></div>
            </div>
            {isCodeStudioOpen && <div className="flex-1 bg-slate-950"><CodeStudio onBack={() => setIsCodeStudioOpen(false)} currentUser={currentUser} userProfile={userProfile} onSessionStart={() => {}} onSessionStop={() => {}} onStartLiveSession={onStartLiveSession} initialFiles={initialStudioFiles}/></div>}
            <div className="absolute bottom-12 right-8 w-64 aspect-video rounded-3xl overflow-hidden border-4 border-slate-800 shadow-2xl z-50 bg-black"><video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" /></div>
          </div>
        )}

        {view === 'report' && (
          <div className="max-w-4xl mx-auto p-8 animate-fade-in-up space-y-12 pb-32">
            <div className="bg-slate-900 border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl p-10 flex flex-col items-center text-center space-y-6">
              <Trophy className="text-amber-500" size={64}/><h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">Feedback Report</h2>
              {report ? (
                <div className="flex flex-col items-center gap-6">
                    <div className="flex gap-4"><div className="px-8 py-4 bg-slate-950 rounded-2xl border border-slate-800"><p className="text-[10px] text-slate-500 font-bold uppercase">Score</p><p className="text-4xl font-black text-indigo-400">{report.score}/100</p></div><div className="px-8 py-4 bg-slate-950 rounded-2xl border border-slate-800"><p className="text-[10px] text-slate-500 font-bold uppercase">Verdict</p><p className={`text-xl font-black uppercase ${report.verdict.includes('Hire') ? 'text-emerald-400' : 'text-red-400'}`}>{report.verdict}</p></div></div>
                    <div className="flex gap-2">
                        {activeRecording?.videoUrl && <a href={activeRecording.videoUrl} target="_blank" rel="noreferrer" className="px-6 py-2 bg-red-600 text-white font-bold rounded-lg text-xs uppercase flex items-center gap-2"><Youtube size={16}/> YouTube Archive</a>}
                        {videoPlaybackUrl && <button onClick={() => window.open(videoPlaybackUrl)} className="px-6 py-2 bg-slate-800 text-white font-bold rounded-lg text-xs uppercase flex items-center gap-2"><PlayCircle size={16}/> Local Playback</button>}
                    </div>
                </div>
              ) : <Loader2 size={32} className="animate-spin text-indigo-400" />}
            </div>
            {report && (
              <div className="bg-white rounded-[3rem] p-12 text-slate-950 shadow-2xl space-y-10">
                <div><h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Summary</h3><p className="text-xl font-serif leading-relaxed text-slate-800 italic">"{report.summary}"</p></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div><h3 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><Star size={12} fill="currentColor"/> Strengths</h3><ul className="space-y-3">{report.strengths.map((s, i) => (<li key={i} className="flex gap-3 text-sm font-bold text-slate-700"><CheckCircle className="text-emerald-500 shrink-0" size={18}/><span>{s}</span></li>))}</ul></div>
                    <div><h3 className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><Zap size={12}/> Areas for Growth</h3><ul className="space-y-3">{report.areasForImprovement.map((a, i) => (<li key={i} className="flex gap-3 text-sm font-bold text-slate-700"><AlertCircle className="text-amber-500 shrink-0" size={18}/><span>{a}</span></li>))}</ul></div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {isGeneratingReport && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center gap-8">
            <div className="relative">
                <div className="w-32 h-32 border-4 border-indigo-500/10 rounded-full"></div>
                <div 
                    className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" 
                    style={{ clipPath: `conic-gradient(from 0deg, white ${synthesisPercent}%, transparent ${synthesisPercent}%)` }}
                />
                <Activity className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-400" size={40}/>
                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-3xl font-black text-white">{Math.round(synthesisPercent)}%</div>
            </div>
            <div className="text-center space-y-2">
                <h3 className="text-xl font-black text-white uppercase tracking-widest">{synthesisStep}</h3>
                <p className="text-xs text-slate-400 max-w-xs leading-relaxed">Processing 232MB+ video data. Finalizing headers and syncing with Google Cloud...</p>
            </div>
        </div>
      )}
    </div>
  );
};
