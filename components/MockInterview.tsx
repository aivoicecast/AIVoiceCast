import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MockInterviewRecording, TranscriptItem, CodeFile, UserProfile, Channel } from '../types';
import { auth } from '../services/firebaseConfig';
import { saveInterviewRecording, getPublicInterviews, deleteInterview, updateUserProfile, uploadFileToStorage, getUserInterviews, updateInterviewMetadata } from '../services/firestoreService';
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
  problem?: string;
  solution?: string;
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

  const [apiLogs, setApiLogs] = useState<{timestamp: number, msg: string, type: 'info' | 'error'}[]>([]);
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
  
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [isCodeStudioOpen, setIsCodeStudioOpen] = useState(false);
  const [sessionFiles, setSessionFiles] = useState<(CodeFile | null)[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
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

  const logApi = (msg: string, type: 'info' | 'error' = 'info') => {
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

  const handleDownloadPdf = async (ref: React.RefObject<HTMLDivElement>, filename: string) => {
    if (!ref.current) return;
    try {
      setIsExportingBundle(true);
      const element = ref.current;
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#020617', windowWidth: 1200 });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save(filename);
    } catch (e) { alert("PDF generation failed."); } finally { setIsExportingBundle(false); }
  };

  const handleReconnectAi = async (isAuto = false) => {
    if (isEndingRef.current) return;
    setIsAiConnected(false);
    if (liveServiceRef.current) liveServiceRef.current.disconnect();
    const backoffTime = isAuto ? Math.min(2000 * Math.pow(2, reconnectAttemptsRef.current), 10000) : 0;
    setTimeout(async () => {
      if (isEndingRef.current) return;
      const historyText = transcript.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n');
      const prompt = `RESUMING ${mode.toUpperCase()} SESSION. Time: ${formatTime(timeLeft)}. History:\n${historyText}`;
      const service = new GeminiLiveService();
      activeServiceIdRef.current = service.id;
      liveServiceRef.current = service;
      try {
        await service.connect(mode === 'behavioral' ? 'Zephyr' : 'Software Interview Voice', prompt, {
          onOpen: () => { if (activeServiceIdRef.current === service.id) { setIsAiConnected(true); reconnectAttemptsRef.current = 0; } },
          onClose: () => { if (activeServiceIdRef.current === service.id) { setIsAiConnected(false); if (isAuto) handleReconnectAi(true); } },
          onError: () => { if (activeServiceIdRef.current === service.id) { setIsAiConnected(false); if (isAuto) handleReconnectAi(true); } },
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
      } catch (err: any) {}
    }, backoffTime);
  };

  const startSmoothProgress = useCallback(() => {
    setSynthesisPercent(0);
    if (synthesisIntervalRef.current) clearInterval(synthesisIntervalRef.current);
    synthesisIntervalRef.current = setInterval(() => {
      setSynthesisPercent(prev => (prev >= 98 ? prev : prev + (100 - prev) * 0.1));
    }, 400);
  }, []);

  const handleStartInterview = async () => {
    setIsStarting(true);
    isEndingRef.current = false;
    setTranscript([]);
    setReport(null);
    videoChunksRef.current = [];
    interviewIdRef.current = generateSecureId();
    const duration = getDurationSeconds(mode);
    setTimeLeft(duration);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const probResponse = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: `Generate interview problem for ${mode} - ${language} - ${jobDesc}` });
      setGeneratedProblemMd(probResponse.text || "");
      const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      activeStreamRef.current = camStream;
      activeScreenStreamRef.current = screenStream;
      const canvas = document.createElement('canvas');
      canvas.width = 1280; canvas.height = 720;
      const ctx = canvas.getContext('2d', { alpha: false })!;
      const camVideo = document.createElement('video'); camVideo.srcObject = camStream; camVideo.muted = true; camVideo.playsInline = true;
      const screenVideo = document.createElement('video'); screenVideo.srcObject = screenStream; screenVideo.muted = true; screenVideo.playsInline = true;
      await Promise.all([
        new Promise(r => { camVideo.onloadedmetadata = () => { camVideo.play().then(r); }; }),
        new Promise(r => { screenVideo.onloadedmetadata = () => { screenVideo.play().then(r); }; })
      ]);
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
      const recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm;codecs=vp8,opus' });
      recorder.ondataavailable = e => { if (e.data.size > 0) videoChunksRef.current.push(e.data); };
      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setIsRecording(true);
      const service = new GeminiLiveService();
      activeServiceIdRef.current = service.id;
      liveServiceRef.current = service;
      await service.connect(mode === 'behavioral' ? 'Zephyr' : 'Software Interview Voice', `Mode: ${mode}. Job: ${jobDesc}.`, {
        onOpen: () => {
          setIsAiConnected(true);
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) { handleEndInterview(); return 0; }
                return prev - 1;
            });
          }, 1000);
        },
        onClose: () => { if (activeServiceIdRef.current === service.id) { setIsAiConnected(false); handleReconnectAi(true); } },
        onError: () => { if (activeServiceIdRef.current === service.id) { setIsAiConnected(false); handleReconnectAi(true); } },
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
      setView('interview');
      setIsCodeStudioOpen(mode !== 'quick_screen');
    } catch (e) { setView('hub'); } finally { setIsStarting(false); }
  };

  const handleEndInterview = async () => {
    isEndingRef.current = true;
    setIsGeneratingReport(true);
    startSmoothProgress();
    if (timerRef.current) clearInterval(timerRef.current);
    setSynthesisStep('Deactivating neural link...');
    liveServiceRef.current?.disconnect();
    setIsRecording(false);
    activeStreamRef.current?.getTracks().forEach(t => t.stop());
    activeScreenStreamRef.current?.getTracks().forEach(t => t.stop());
    setSynthesisStep('Finalizing session capture...');
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      const blob = await new Promise<Blob>((resolve) => {
        const rec = mediaRecorderRef.current!;
        rec.onstop = () => resolve(new Blob(videoChunksRef.current, { type: 'video/webm' }));
        rec.stop();
      });
      videoBlobRef.current = blob;
      if (blob) setVideoPlaybackUrl(URL.createObjectURL(blob));
    }
    setSynthesisStep('Synthesizing metrics...');
    
    // Capture candidate solution
    const solutionCode = sessionFiles
        .filter(f => f && f.content && !f.isDirectory)
        .map(f => `FILE: ${f!.name}\n\`\`\`${f!.language}\n${f!.content}\n\`\`\``)
        .join('\n\n');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const transcriptText = transcript.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n');
      const reportPrompt = `
      JOB DESCRIPTION: ${jobDesc}
      INTERVIEW PROBLEM: ${generatedProblemMd}
      CANDIDATE SOLUTION CODE:
      ${solutionCode || 'No code provided.'}
      
      TRANSCRIPT:
      ${transcriptText}
      
      TASK: Generate a comprehensive interview report. Return JSON ONLY.
      `;
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: reportPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.NUMBER },
              technicalSkills: { type: Type.STRING },
              communication: { type: Type.STRING },
              strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
              areasForImprovement: { type: Type.ARRAY, items: { type: Type.STRING } },
              verdict: { type: Type.STRING },
              summary: { type: Type.STRING },
              learningMaterial: { type: Type.STRING },
              problem: { type: Type.STRING },
              solution: { type: Type.STRING }
            },
            required: ["score", "verdict", "summary", "learningMaterial"]
          }
        }
      });
      const reportData = JSON.parse(response.text || "{}");
      // Inject problem/solution if AI failed to echo them
      if (!reportData.problem) reportData.problem = generatedProblemMd;
      if (!reportData.solution) reportData.solution = solutionCode;
      
      setReport(reportData);
      const rec: MockInterviewRecording = {
        id: interviewIdRef.current, userId: currentUser?.uid || 'guest', userName: currentUser?.displayName || 'Guest',
        mode, language, jobDescription: jobDesc, timestamp: Date.now(), videoUrl: '',
        transcript: transcript.map(t => ({ role: t.role, text: t.text, timestamp: t.timestamp })),
        feedback: JSON.stringify(reportData), visibility
      };
      setActiveRecording(rec);
      setView('report');
    } catch (e) { setView('report'); } finally { 
      setIsGeneratingReport(false); 
      if (synthesisIntervalRef.current) clearInterval(synthesisIntervalRef.current);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden relative">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-20">
        <div className="flex items-center gap-4">
          <button onClick={() => view === 'hub' ? onBack() : setView('hub')} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"><ArrowLeft size={20} /></button>
          <h1 className="text-lg font-bold text-white flex items-center gap-2"><Video className="text-red-500" /> Mock Interview</h1>
        </div>
        {view === 'interview' && (
          <div className="flex items-center gap-6">
            <div className={`flex items-center gap-3 px-6 py-2 rounded-2xl border bg-slate-950/50 ${timeLeft < 300 ? 'border-red-500/50 text-red-400 animate-pulse' : 'border-indigo-500/30 text-indigo-400'}`}>
                <Timer size={18}/><span className="font-mono text-xl font-black">{formatTime(timeLeft)}</span>
            </div>
            <div className="flex items-center gap-3">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${isAiConnected ? 'bg-emerald-900/20 text-emerald-400 border-emerald-500/30' : 'bg-red-900/20 text-red-400 animate-pulse'}`}>
                <Wifi size={14}/><span className="text-[10px] font-black uppercase">{isAiConnected ? 'Link Active' : 'Interrupted'}</span>
                </div>
                <button onClick={handleEndInterview} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold">End Session</button>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto scrollbar-hide relative">
        {view === 'hub' && (
          <div className="max-w-6xl mx-auto p-8 space-y-12 animate-fade-in">
            <div className="bg-indigo-600 rounded-[3rem] p-12 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center gap-10">
              <div className="absolute top-0 right-0 p-32 bg-white/10 blur-[100px] rounded-full"></div>
              <div className="relative z-10 flex-1 space-y-6">
                <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase">Ready for your<br/>Next Big Step?</h2>
                <button onClick={() => setView('prep')} className="px-10 py-5 bg-white text-indigo-600 font-black uppercase tracking-widest rounded-2xl shadow-2xl hover:scale-105 transition-all flex items-center gap-3"><Zap size={20} fill="currentColor"/> Start Simulation</button>
              </div>
              <div className="relative z-10 hidden lg:block"><Bot size={100} className="text-indigo-400 animate-pulse"/></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin mx-auto text-indigo-400" size={32}/></div> : interviews.map(rec => (
                  <div key={rec.id} onClick={() => { setActiveRecording(rec); setReport(JSON.parse(rec.feedback || '{}')); setView('report'); }} className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 hover:border-indigo-500/50 transition-all group cursor-pointer shadow-xl">
                    <div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold">{rec.userName[0]}</div><div><h4 className="font-bold text-white text-sm">@{rec.userName}</h4><p className="text-[10px] text-slate-500 uppercase">{new Date(rec.timestamp).toLocaleDateString()}</p></div></div>
                    <p className="text-xs text-slate-400 line-clamp-2 italic">"{rec.jobDescription}"</p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {view === 'prep' && (
          <div className="max-w-3xl mx-auto p-12 animate-fade-in-up">
            <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl space-y-8">
              <h2 className="text-3xl font-black text-white text-center uppercase tracking-tighter">Simulation Setup</h2>
              <textarea value={jobDesc} onChange={e => setJobDesc(e.target.value)} placeholder="Paste Job Description..." className="w-full h-40 bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500"/>
              <div className="grid grid-cols-2 gap-4">
                  <select value={mode} onChange={e => setMode(e.target.value as any)} className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white"><option value="coding">Coding (45m)</option><option value="system_design">Sys Design (45m)</option><option value="behavioral">Behavioral (30m)</option></select>
                  <select value={language} onChange={e => setLanguage(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white">{LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}</select>
              </div>
              <button onClick={handleStartInterview} disabled={isStarting || !jobDesc.trim()} className="w-full py-5 bg-indigo-600 text-white font-black uppercase rounded-2xl shadow-xl">{isStarting ? <Loader2 className="animate-spin" /> : 'Enter Simulation'}</button>
            </div>
          </div>
        )}

        {view === 'interview' && (
          <div className="h-full flex overflow-hidden">
            <div className={`flex flex-col border-r border-slate-800 transition-all ${isCodeStudioOpen ? 'w-[400px]' : 'flex-1'}`}>
              <div className="p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center"><span className="font-bold text-white uppercase tracking-tighter flex items-center gap-2"><Bot size={20} className="text-indigo-400"/> AI Panel</span><button onClick={() => setIsCodeStudioOpen(!isCodeStudioOpen)} className="p-2 bg-slate-800 rounded-lg text-xs font-bold">{isCodeStudioOpen ? 'Hide' : 'Show'} Studio</button></div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide"><div className="bg-[#020617] p-6 rounded-2xl border border-slate-800"><h1 className="text-lg font-black text-indigo-400 mb-4 uppercase">Challenge</h1><MarkdownView content={generatedProblemMd} /></div><div className="space-y-4 pb-32">{transcript.map((item, idx) => (<div key={idx} className={`flex flex-col ${item.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in-up`}><span className={`text-[9px] uppercase font-black mb-1 ${item.role === 'user' ? 'text-emerald-400' : 'text-indigo-400'}`}>{item.role === 'user' ? 'You' : 'Interviewer'}</span><div className={`max-w-[90%] px-4 py-3 rounded-2xl text-sm ${item.role === 'user' ? 'bg-emerald-600 text-white rounded-tr-sm' : 'bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700'}`}>{item.text}</div></div>))}</div></div>
            </div>
            {isCodeStudioOpen && <div className="flex-1 bg-slate-950"><CodeStudio onBack={() => setIsCodeStudioOpen(false)} currentUser={currentUser} userProfile={userProfile} onSessionStart={() => {}} onSessionStop={() => {}} onStartLiveSession={onStartLiveSession} onFilesChange={setSessionFiles}/></div>}
            <div className="absolute bottom-12 right-8 w-64 aspect-video rounded-3xl overflow-hidden border-4 border-slate-800 shadow-2xl z-50 bg-black"><video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" /></div>
          </div>
        )}

        {view === 'report' && (
          <div className="max-w-4xl mx-auto p-8 animate-fade-in-up space-y-12 pb-32">
            <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 flex flex-col items-center text-center space-y-6">
              <Trophy className="text-amber-500" size={64}/><h2 className="text-4xl font-black text-white uppercase tracking-tighter">Simulation Report</h2>
              {report ? (
                <div className="flex gap-4"><div className="px-8 py-4 bg-slate-950 rounded-2xl border border-slate-800"><p className="text-[10px] text-slate-500 font-bold uppercase">Score</p><p className="text-4xl font-black text-indigo-400">{report.score}/100</p></div><div className="px-8 py-4 bg-slate-950 rounded-2xl border border-slate-800"><p className="text-[10px] text-slate-500 font-bold uppercase">Verdict</p><p className={`text-xl font-black uppercase ${report.verdict.includes('Hire') ? 'text-emerald-400' : 'text-red-400'}`}>{report.verdict}</p></div></div>
              ) : <Loader2 size={32} className="animate-spin text-indigo-500"/>}
            </div>
            
            {videoPlaybackUrl && (
                <div className="space-y-6">
                    <h3 className="text-xl font-bold text-white uppercase flex items-center gap-2 px-2"><PlayCircle className="text-red-500"/> Session Recording</h3>
                    <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-xl aspect-video bg-black">
                        <video src={videoPlaybackUrl} controls className="w-full h-full" />
                    </div>
                </div>
            )}

            {report?.problem && (
                <div className="space-y-6">
                    <h3 className="text-xl font-bold text-white uppercase flex items-center gap-2 px-2"><FileText className="text-indigo-400"/> Problem Description</h3>
                    <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem]">
                        <MarkdownView content={report.problem} />
                    </div>
                </div>
            )}

            {report?.solution && (
                <div className="space-y-6">
                    <h3 className="text-xl font-bold text-white uppercase flex items-center gap-2 px-2"><Code2 className="text-emerald-400"/> Candidate Solution</h3>
                    <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem]">
                        <MarkdownView content={`\`\`\`${language.toLowerCase()}\n${report.solution}\n\`\`\``} />
                    </div>
                </div>
            )}

            {report && (
              <div className="bg-white rounded-[3rem] p-12 text-slate-950 shadow-2xl space-y-10">
                <div><h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Executive Summary</h3><p className="text-xl font-serif italic">"{report.summary}"</p></div>
                <div className="grid grid-cols-2 gap-10">
                    <div><h3 className="text-[10px] font-black text-emerald-600 uppercase mb-4 flex items-center gap-2"><Star size={12}/> Strengths</h3><ul className="space-y-3">{report.strengths.map((s, i) => (<li key={i} className="flex gap-3 text-sm font-bold text-slate-700"><CheckCircle className="text-emerald-500 shrink-0" size={18}/><span>{s}</span></li>))}</ul></div>
                    <div><h3 className="text-[10px] font-black text-red-600 uppercase mb-4 flex items-center gap-2"><Zap size={12}/> Improvements</h3><ul className="space-y-3">{report.areasForImprovement.map((a, i) => (<li key={i} className="flex gap-3 text-sm font-bold text-slate-700"><AlertCircle className="text-amber-500 shrink-0" size={18}/><span>{a}</span></li>))}</ul></div>
                </div>
              </div>
            )}
            {report?.learningMaterial && (
                <div className="space-y-6">
                    <h3 className="text-xl font-bold text-white uppercase flex items-center gap-2 px-2"><GraduationCap className="text-indigo-400"/> Learning Path</h3>
                    <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl"><MarkdownView content={report.learningMaterial} /></div>
                </div>
            )}
          </div>
        )}
      </main>

      {isGeneratingReport && (<div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center gap-8">
          <div className="relative"><Activity className="animate-pulse text-indigo-400" size={48}/><div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-3xl font-black text-white">{Math.round(synthesisPercent)}%</div></div>
          <div className="text-center space-y-2"><h3 className="text-xl font-black text-white uppercase tracking-widest">{synthesisStep}</h3></div>
      </div>)}
    </div>
  );
};

export default MockInterview;