
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MockInterviewRecording, TranscriptItem, CodeFile, UserProfile, Channel, CodeProject } from '../types';
import { auth } from '../services/firebaseConfig';
import { saveInterviewRecording, getPublicInterviews, deleteInterview, updateUserProfile, uploadFileToStorage, getUserInterviews, updateInterviewMetadata, saveCodeProject, getCodeProject, getUserProfile } from '../services/firestoreService';
import { getDriveToken, signInWithGoogle } from '../services/authService';
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
import { getGlobalAudioContext, getGlobalMediaStreamDest, warmUpAudioContext } from '../utils/audioUtils';

interface MockInterviewProps {
  onBack: () => void;
  userProfile: UserProfile | null;
  onStartLiveSession: (channel: Channel, context?: string) => void;
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
  idealAnswers: { question: string, expectedAnswer: string, rationale: string }[];
  learningMaterial: string; 
  todoList: string[];
  fitStatus?: 'underfit' | 'overfit' | 'match';
  missingKnowledge?: string[];
}

const getCodeTool: any = {
  name: "get_current_code",
  description: "Read the content of the solution file currently in the editor. Use this to evaluate the candidate's code.",
  parameters: { type: Type.OBJECT, properties: {} }
};

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
  const [initialStudioFiles, setInitialStudioFiles] = useState<CodeFile[]>([]);
  const activeCodeFileRef = useRef<CodeFile | null>(null);

  const [activeRecording, setActiveRecording] = useState<MockInterviewRecording | null>(null);
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [videoPlaybackUrl, setVideoPlaybackUrl] = useState<string | null>(null);
  const [generatedProblemMd, setGeneratedProblemMd] = useState('');

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

  const handleSendTextMessage = (text: string) => {
    if (liveServiceRef.current && isAiConnected) {
        liveServiceRef.current.sendText(text);
        setTranscript(prev => [...prev, { role: 'user', text, timestamp: Date.now() }]);
    }
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
      const prompt = `RESUMING INTERVIEW SESSION. Role: Senior Interviewer. Mode: ${mode}. History recap: ${historyText.substring(historyText.length - 2000)}`;
      const service = new GeminiLiveService();
      activeServiceIdRef.current = service.id;
      liveServiceRef.current = service;

      try {
        logApi(`Re-linking AI...`);
        await service.connect('Software Interview Voice', prompt, {
          onOpen: () => {
            if (activeServiceIdRef.current !== service.id) return;
            setIsAiConnected(true);
            reconnectAttemptsRef.current = 0;
            logApi("Link Active.");
          },
          onClose: (r) => {
            if (activeServiceIdRef.current !== service.id) return;
            setIsAiConnected(false);
            if (!isEndingRef.current && isAuto && reconnectAttemptsRef.current < 5) {
              reconnectAttemptsRef.current++;
              handleReconnectAi(true);
            }
          },
          onError: (e: any) => { if (activeServiceIdRef.current === service.id) handleReconnectAi(true); },
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
          },
          onToolCall: async (toolCall) => {
              for (const fc of toolCall.functionCalls) {
                  if (fc.name === 'get_current_code') {
                      const code = activeCodeFileRef.current?.content || "// No code written yet.";
                      service.sendToolResponse([{ id: fc.id, name: fc.name, response: { result: code } }]);
                      logApi("AI Read Candidate Code");
                  }
              }
          }
        }, [{ functionDeclarations: [getCodeTool] }]);
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
    
    let camStream: MediaStream | null = null;
    let screenStream: MediaStream | null = null;
    
    try {
        logApi("Capturing Screen...");
        screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    } catch(e) { logApi("Screen capture declined.", "warn"); }

    try {
        camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true });
    } catch(e) { alert("Camera/Mic mandatory."); setIsStarting(false); return; }

    const audioCtx = getGlobalAudioContext();
    await warmUpAudioContext(audioCtx);

    reconnectAttemptsRef.current = 0;
    setTranscript([]);
    setReport(null);
    setApiLogs([]);
    videoChunksRef.current = [];
    interviewIdRef.current = generateSecureId();

    const duration = getDurationSeconds(mode);
    setTimeLeft(duration);

    try {
      const recordingDest = getGlobalMediaStreamDest();
      const micSource = audioCtx.createMediaStreamSource(camStream);
      micSource.connect(recordingDest);
      activeStreamRef.current = camStream;
      activeScreenStreamRef.current = screenStream;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const jobContext = jobDesc.trim() ? `Job: ${jobDesc}` : "Job: Senior developer role";
      const problemPrompt = `Generate a unique coding challenge for ${mode} in ${language}. ${jobContext}. Respond with Markdown.`;
      const probResponse = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: problemPrompt });
      setGeneratedProblemMd(probResponse.text || "Introduction needed.");

      const ext = language.toLowerCase() === 'python' ? 'py' : (language.toLowerCase().includes('java') ? 'java' : 'cpp');
      const solutionFile: CodeFile = {
          name: `solution.${ext}`, path: `solution.${ext}`, language: language.toLowerCase() as any,
          content: `/* \n * Interview Challenge: ${mode}\n */\n\n`,
          loaded: true, isDirectory: false, isModified: false
      };
      activeCodeFileRef.current = solutionFile;
      setInitialStudioFiles([solutionFile]);

      // Recording logic
      const isPortrait = window.innerHeight > window.innerWidth;
      const canvas = document.createElement('canvas');
      canvas.width = isPortrait ? 720 : 1280; canvas.height = isPortrait ? 1280 : 720;
      const drawCtx = canvas.getContext('2d', { alpha: false })!;
      const camVideo = document.createElement('video'); camVideo.srcObject = camStream; camVideo.muted = true; camVideo.play();
      const screenVideo = document.createElement('video'); if (screenStream) { screenVideo.srcObject = screenStream; screenVideo.muted = true; screenVideo.play(); }

      const drawFrame = () => {
        if (isEndingRef.current) return;
        if (screenStream && screenVideo.readyState >= 2) {
            drawCtx.fillStyle = '#020617'; drawCtx.fillRect(0, 0, canvas.width, canvas.height);
            const scale = Math.min(canvas.width / screenVideo.videoWidth, canvas.height / screenVideo.videoHeight);
            const w = screenVideo.videoWidth * scale; const h = screenVideo.videoHeight * scale;
            drawCtx.drawImage(screenVideo, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
        } else { drawCtx.fillStyle = '#020617'; drawCtx.fillRect(0, 0, canvas.width, canvas.height); }
        if (camVideo.readyState >= 2) {
          const pipW = isPortrait ? canvas.width * 0.5 : 320;
          const pipH = (pipW * camVideo.videoHeight) / camVideo.videoWidth;
          const pipX = isPortrait ? (canvas.width - pipW) / 2 : canvas.width - pipW - 24;
          const pipY = isPortrait ? canvas.height - pipH - 120 : canvas.height - pipH - 24;
          drawCtx.strokeStyle = '#6366f1'; drawCtx.lineWidth = 4; drawCtx.strokeRect(pipX, pipY, pipW, pipH); 
          drawCtx.drawImage(camVideo, pipX, pipY, pipW, pipH);
        }
        requestAnimationFrame(drawFrame);
      };
      drawFrame();

      const combinedStream = canvas.captureStream(30);
      recordingDest.stream.getAudioTracks().forEach(t => combinedStream.addTrack(t));
      const recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm;codecs=vp8,opus', videoBitsPerSecond: 2500000 });
      recorder.ondataavailable = e => { if (e.data.size > 0) videoChunksRef.current.push(e.data); };
      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setIsRecording(true);

      const service = new GeminiLiveService();
      activeServiceIdRef.current = service.id;
      liveServiceRef.current = service;
      const prompt = `Role: Senior Interviewer. Mode: ${mode}. Candidate: ${currentUser?.displayName}. Resume: ${resumeText}. GOAL: Start the interview by introducing yourself and the challenge.`;
      
      await service.connect(mode === 'behavioral' ? 'Zephyr' : 'Software Interview Voice', prompt, {
        onOpen: () => {
          setIsAiConnected(true);
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = setInterval(() => {
            setTimeLeft(prev => { if (prev <= 1) { handleEndInterview(); return 0; } return prev - 1; });
          }, 1000);
        },
        onClose: (r) => { if (activeServiceIdRef.current === service.id) { setIsAiConnected(false); handleReconnectAi(true); } },
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
        },
        onToolCall: async (toolCall) => {
          for (const fc of toolCall.functionCalls) {
              if (fc.name === 'get_current_code') {
                  const code = activeCodeFileRef.current?.content || "// No code written yet.";
                  service.sendToolResponse([{ id: fc.id, name: fc.name, response: { result: code } }]);
              }
          }
        }
      }, [{ functionDeclarations: [getCodeTool] }]);
      
      setView('interview');
    } catch (e: any) { alert("Startup failed."); setView('hub'); } finally { setIsStarting(false); }
  };

  const handleEndInterview = async () => {
    if (isEndingRef.current) return;
    isEndingRef.current = true;
    setIsGeneratingReport(true);
    startSmoothProgress();
    if (timerRef.current) clearInterval(timerRef.current);

    setSynthesisStep('Closing neural link...');
    liveServiceRef.current?.disconnect();
    setIsRecording(false);

    setSynthesisStep('Compiling archives...');
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      const blob = await new Promise<Blob>((resolve) => {
        const rec = mediaRecorderRef.current!;
        rec.onstop = () => resolve(new Blob(videoChunksRef.current, { type: 'video/webm' }));
        rec.stop();
      });
      videoBlobRef.current = blob;
    }

    activeStreamRef.current?.getTracks().forEach(t => t.stop());
    activeScreenStreamRef.current?.getTracks().forEach(t => t.stop());

    setSynthesisStep('AI Evaluation...');
    let reportData: InterviewReport | null = null;
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const transcriptText = transcript.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n');
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `Analyze: ${transcriptText}. Return valid JSON: score, technicalSkills, communication, collaboration, strengths, areasForImprovement, verdict, summary, learningMaterial.`,
            config: { responseMimeType: 'application/json' }
        });
        reportData = JSON.parse(response.text || "{}");
    } catch (e: any) { setReportError("Metrics failed."); }

    if (reportData) {
      setReport(reportData);
      const rec: MockInterviewRecording = {
        id: interviewIdRef.current, userId: currentUser?.uid || 'guest', userName: currentUser?.displayName || 'Guest',
        mode, language, jobDescription: jobDesc, timestamp: Date.now(), videoUrl: "",
        transcript: transcript.map(t => ({ role: t.role, text: t.text, timestamp: t.timestamp })),
        feedback: JSON.stringify(reportData), visibility
      };
      await saveInterviewRecording(rec);
      setActiveRecording(rec);
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
          <button onClick={() => view === 'hub' ? onBack() : setView('hub')} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"><ArrowLeft size={20} /></button>
          <h1 className="text-lg font-bold text-white flex items-center gap-2"><Video className="text-red-500" /> Mock Interview</h1>
        </div>
        {view === 'interview' && (
          <div className="flex items-center gap-4">
            <div className={`px-4 py-1.5 rounded-2xl border bg-slate-950/50 flex items-center gap-2 ${timeLeft < 300 ? 'border-red-500/50 text-red-400 animate-pulse' : 'border-indigo-500/30 text-indigo-400'}`}>
                <Timer size={14}/><span className="font-mono text-base font-black tabular-nums">{formatTime(timeLeft)}</span>
            </div>
            <button onClick={handleEndInterview} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold">End Session</button>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-hidden relative">
        {view === 'hub' && (
          <div className="max-w-6xl mx-auto p-8 space-y-12 animate-fade-in overflow-y-auto h-full scrollbar-hide">
            <div className="bg-indigo-600 rounded-[3rem] p-12 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center gap-10">
              <div className="absolute top-0 right-0 p-32 bg-white/10 blur-[100px] rounded-full"></div>
              <div className="relative z-10 flex-1 space-y-6">
                <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">Simulate your<br/>Success.</h2>
                <p className="text-indigo-100 text-lg max-w-sm">Rigorous AI-driven technical evaluations for senior software engineering roles.</p>
                <button onClick={() => setView('prep')} className="px-10 py-5 bg-white text-indigo-600 font-black uppercase tracking-widest rounded-2xl shadow-2xl hover:scale-105 transition-all flex items-center gap-3"><Zap size={20} fill="currentColor"/> Begin Preparation</button>
              </div>
              <div className="relative z-10 hidden lg:block"><div className="w-64 h-64 bg-slate-950 rounded-[3rem] border-8 border-indigo-400/30 flex items-center justify-center rotate-3 shadow-2xl"><Bot size={100} className="text-indigo-400 animate-pulse"/></div></div>
            </div>
            <div className="space-y-6">
              <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Session History</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin mx-auto text-indigo-400" size={32}/></div> : interviews.length === 0 ? <div className="col-span-full py-20 text-center text-slate-500 border border-dashed border-slate-800 rounded-3xl">No archived sessions.</div> : interviews.map(rec => (
                  <div key={rec.id} onClick={() => { setActiveRecording(rec); setReport(JSON.parse(rec.feedback || '{}')); setView('report'); }} className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 hover:border-indigo-500/50 transition-all group cursor-pointer shadow-xl relative overflow-hidden">
                    <div className="flex items-center gap-3"><div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-bold">{rec.userName[0]}</div><div><h4 className="font-bold text-white text-sm">@{rec.userName}</h4><p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{new Date(rec.timestamp).toLocaleDateString()}</p></div></div>
                    <div className="mt-4"><span className="text-[9px] font-black uppercase bg-indigo-900/20 text-indigo-400 px-3 py-1 rounded-full border border-indigo-500/30">{rec.mode.replace('_', ' ')}</span></div>
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
                    <textarea value={resumeText} onChange={e => setResumeText(e.target.value)} placeholder="Paste resume details for context..." className="w-full h-48 bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 outline-none resize-none"/>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-4">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Interview Mode</h3>
                    <div className="grid grid-cols-1 gap-2">
                      {[{ id: 'coding', icon: Code, label: 'Algorithm & DS' }, { id: 'system_design', icon: Layers, label: 'System Design' }, { id: 'behavioral', icon: MessageSquare, label: 'Behavioral' }].map(m => (<button key={m.id} onClick={() => setMode(m.id as any)} className={`p-4 rounded-2xl border text-left flex items-center justify-between transition-all ${mode === m.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-500'}`}><div className="flex items-center gap-2"><m.icon size={14}/><span className="text-[10px] font-bold uppercase">{m.label}</span></div>{mode === m.id && <CheckCircle size={14}/>}</button>))}
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={handleStartInterview} disabled={isStarting} className="w-full py-5 bg-gradient-to-r from-red-600 to-indigo-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-2xl transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30">{isStarting ? <Loader2 className="animate-spin" /> : 'Start Mock Interview'}</button>
            </div>
          </div>
        )}

        {view === 'interview' && (
          <div className="h-full flex flex-col overflow-hidden relative">
            <div className="flex-1 bg-slate-950 relative flex flex-col md:flex-row overflow-hidden">
                <div className="w-full md:w-80 bg-slate-900 border-r border-slate-800 overflow-y-auto p-6 space-y-6 shrink-0 scrollbar-hide">
                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800"><h2 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-3">Challenge Description</h2><div className="prose prose-invert prose-xs"><MarkdownView content={generatedProblemMd} /></div></div>
                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800"><h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Interviewer Notes</h2><p className="text-[10px] text-slate-400 italic">"Focus on time complexity and clean modular code. I am monitoring your solution file in real-time."</p></div>
                </div>
                <div className="flex-1 overflow-hidden relative flex flex-col bg-slate-950">
                    <CodeStudio 
                        onBack={() => {}} 
                        currentUser={currentUser} 
                        userProfile={userProfile} 
                        onSessionStart={() => {}} 
                        onSessionStop={() => {}} 
                        onStartLiveSession={() => {}} 
                        initialFiles={initialStudioFiles}
                        externalChatContent={transcript.map(t => ({ role: t.role, text: t.text }))}
                        onSendExternalMessage={handleSendTextMessage}
                        isInterviewerMode={true}
                        isAiThinking={!isAiConnected}
                        onFileChange={(f) => { activeCodeFileRef.current = f; }}
                    />
                </div>
            </div>
            <div className="absolute bottom-20 right-4 w-64 aspect-video rounded-3xl overflow-hidden border-4 border-indigo-500/50 shadow-2xl z-[100] bg-black group">
                <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                <div className="absolute top-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[8px] font-black uppercase text-white">Candidate Feed</div>
            </div>
          </div>
        )}

        {view === 'report' && (
          <div className="max-w-4xl mx-auto p-8 animate-fade-in-up space-y-12 pb-32">
            <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 flex flex-col items-center text-center space-y-6 shadow-2xl">
              <Trophy className="text-amber-500" size={64}/><h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">Evaluation Result</h2>
              {report ? (
                <div className="flex flex-col items-center gap-6">
                    <div className="flex gap-4"><div className="px-8 py-4 bg-slate-950 rounded-2xl border border-slate-800"><p className="text-[10px] text-slate-500 font-bold uppercase">Score</p><p className="text-4xl font-black text-indigo-400">{report.score}/100</p></div><div className="px-8 py-4 bg-slate-950 rounded-2xl border border-slate-800"><p className="text-[10px] text-slate-500 font-bold uppercase">Verdict</p><p className={`text-xl font-black uppercase ${report.verdict.includes('Hire') ? 'text-emerald-400' : 'text-red-400'}`}>{report.verdict}</p></div></div>
                    <div className="text-left w-full bg-slate-950 p-8 rounded-[2rem] border border-slate-800"><h3 className="font-bold text-white mb-4 flex items-center gap-2"><Sparkles className="text-indigo-400" size={18}/> Summary</h3><p className="text-sm text-slate-400 leading-relaxed">{report.summary}</p></div>
                </div>
              ) : <Loader2 size={32} className="animate-spin text-indigo-400" />}
            </div>
          </div>
        )}
      </main>

      {isGeneratingReport && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center gap-8">
            <div className="relative">
                <div className="w-32 h-32 border-4 border-indigo-500/10 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" style={{ clipPath: `conic-gradient(from 0deg, white ${synthesisPercent}%, transparent ${synthesisPercent}%)` }} />
                <Activity className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-400" size={40}/>
                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-3xl font-black text-white">{Math.round(synthesisPercent)}%</div>
            </div>
            <div className="text-center space-y-2"><h3 className="text-xl font-black text-white uppercase tracking-widest">{synthesisStep}</h3></div>
        </div>
      )}
    </div>
  );
};

export default MockInterview;
