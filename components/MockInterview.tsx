import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MockInterviewRecording, TranscriptItem, CodeFile, UserProfile, Channel } from '../types';
import { auth } from '../services/firebaseConfig';
import { saveInterviewRecording, getPublicInterviews, deleteInterview, updateUserProfile, uploadFileToStorage, getUserInterviews, updateInterviewMetadata } from '../services/firestoreService';
import { getDriveToken, connectGoogleDrive } from '../services/authService';
import { ensureFolder, uploadToDrive, getDriveFileSharingLink, readPublicDriveFile } from '../services/googleDriveService';
import { GeminiLiveService } from '../services/geminiLive';
import { GoogleGenAI } from '@google/genai';
import { generateSecureId } from '../utils/idUtils';
import CodeStudio from './CodeStudio';
import { MarkdownView } from './MarkdownView';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
// Added StopCircle to the lucide-react imports to fix line 572 error
import { ArrowLeft, Video, Mic, Monitor, Play, Save, Loader2, Search, Trash2, CheckCircle, X, Download, ShieldCheck, User, Users, Building, FileText, ChevronRight, Zap, SidebarOpen, SidebarClose, Code, MessageSquare, Sparkles, Languages, Clock, Camera, Bot, CloudUpload, Trophy, BarChart3, ClipboardCheck, Star, Upload, FileUp, Linkedin, FileCheck, Edit3, BookOpen, Lightbulb, Target, ListChecks, MessageCircleCode, GraduationCap, Lock, Globe, ExternalLink, PlayCircle, RefreshCw, FileDown, Briefcase, Package, Code2, StopCircle } from 'lucide-react';

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
  verdict: 'Strong Hire' | 'Hire' | 'No Hire' | 'Strong No Hire';
  summary: string;
  idealAnswers: IdealAnswer[];
  learningMaterial: string; 
  todoList: string[];
}

const LANGUAGES = ['TypeScript', 'JavaScript', 'Python', 'C++', 'Java', 'Rust', 'Go', 'C#', 'Swift'];

export const MockInterview: React.FC<MockInterviewProps> = ({ onBack, userProfile, onStartLiveSession }) => {
  const [view, setView] = useState<'hub' | 'prep' | 'interview' | 'report'>('hub');
  const [interviews, setInterviews] = useState<MockInterviewRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAiConnected, setIsAiConnected] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  
  // Prep State
  const [mode, setMode] = useState<'coding' | 'system_design' | 'behavioral'>('coding');
  const [language, setLanguage] = useState(userProfile?.defaultLanguage || 'TypeScript');
  const [jobDesc, setJobDesc] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  
  // Interview Logic
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [coachingTranscript, setCoachingTranscript] = useState<TranscriptItem[]>([]);
  const [isCodeStudioOpen, setIsCodeStudioOpen] = useState(false);
  const [initialStudioFiles, setInitialStudioFiles] = useState<CodeFile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // PDF Export Node Refs
  const reportRef = useRef<HTMLDivElement>(null);
  const problemRef = useRef<HTMLDivElement>(null);
  const bundleRef = useRef<HTMLDivElement>(null);

  // Active Session State
  const [activeRecording, setActiveRecording] = useState<MockInterviewRecording | null>(null);
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [videoPlaybackUrl, setVideoPlaybackUrl] = useState<string | null>(null);
  const [generatedProblemMd, setGeneratedProblemMd] = useState('');
  const [isFeedbackSessionActive, setIsFeedbackSessionActive] = useState(false);
  const [isExportingBundle, setIsExportingBundle] = useState(false);

  const liveServiceRef = useRef<GeminiLiveService | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoBlobRef = useRef<Blob | null>(null);
  const interviewIdRef = useRef(generateSecureId());
  
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);

  const currentUser = auth?.currentUser;

  useEffect(() => {
      if (view === 'interview' && activeStreamRef.current && localVideoRef.current) {
          localVideoRef.current.srcObject = activeStreamRef.current;
      }
  }, [view]);

  useEffect(() => {
    loadInterviews();
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
    } catch (e) {
        console.error("Load failed", e);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadResumeFromProfile = () => {
    if (userProfile?.resumeText) {
      setResumeText(userProfile.resumeText);
    } else {
      alert("No resume summary found in your profile.");
    }
  };

  const handleDownloadPdf = async (ref: React.RefObject<HTMLDivElement>, filename: string) => {
      if (!ref.current) return;
      try {
          const canvas = await html2canvas(ref.current, { scale: 2, useCORS: true, backgroundColor: '#020617' });
          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          const pdf = new jsPDF('p', 'mm', 'a4');
          const imgProps = pdf.getImageProperties(imgData);
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
          pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
          pdf.save(filename);
      } catch (e) {
          console.error("PDF generation failed", e);
          alert("Failed to generate PDF.");
      }
  };

  const handleDownloadCareerBundle = async () => {
      if (!bundleRef.current) return;
      setIsExportingBundle(true);
      try {
          const canvas = await html2canvas(bundleRef.current, { 
              scale: 2, 
              useCORS: true, 
              backgroundColor: '#020617',
              windowWidth: 1200
          });
          const imgData = canvas.toDataURL('image/jpeg', 0.9);
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const imgProps = pdf.getImageProperties(imgData);
          const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
          
          let heightLeft = pdfHeight;
          let position = 0;
          const pageHeight = pdf.internal.pageSize.getHeight();

          pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
          heightLeft -= pageHeight;

          while (heightLeft >= 0) {
              position = heightLeft - pdfHeight;
              pdf.addPage();
              pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
              heightLeft -= pageHeight;
          }

          pdf.save(`Neural_Career_Bundle_${activeRecording?.id || 'session'}.pdf`);
      } catch (e) {
          console.error(e);
          alert("Bundle generation failed.");
      } finally {
          setIsExportingBundle(false);
      }
  };

  const handleReconnectAi = async () => {
      if (liveServiceRef.current) liveServiceRef.current.disconnect();
      setIsAiConnected(false);
      
      const historyText = transcript.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n');
      const persona = mode === 'coding' ? 'Senior Technical Interviewer' : mode === 'system_design' ? 'Principal System Architect' : 'Hiring Manager';
      const prompt = `You are a world-class ${persona}. RESUMING MID-SESSION. HISTORY:\n${historyText}\nMISSION: Pick up exactly where we left off. Context: Job: ${jobDesc}, Candidate: ${resumeText}, Stack: ${language}.`;

      const service = new GeminiLiveService();
      liveServiceRef.current = service;
      try {
          await service.connect(mode === 'behavioral' ? 'Zephyr' : 'Software Interview Voice gen-lang-client-0648937375', prompt, {
              onOpen: () => setIsAiConnected(true),
              onClose: () => { setIsAiConnected(false); },
              onError: (e) => { console.error(e); setIsAiConnected(false); },
              onVolumeUpdate: () => {},
              onTranscript: (text, isUser) => {
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
      } catch (err) { alert("Reconnection failed."); }
  };

  const startCoachingSession = async () => {
    if (!report || !activeRecording) return;
    
    // Resume logic: if already active and AI dropped, reconnect
    if (isFeedbackSessionActive && !isAiConnected) {
        // Fall through to initialization logic
    } else if (isFeedbackSessionActive) {
        // End session manually
        if (liveServiceRef.current) liveServiceRef.current.disconnect();
        // Save coaching history to the interview record
        if (activeRecording.id !== 'error') {
            await updateInterviewMetadata(activeRecording.id, { coachingTranscript });
        }
        setIsFeedbackSessionActive(false);
        return;
    }

    const coachingHistoryText = coachingTranscript.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n');
    const systemPrompt = `You are an expert Executive Search Consultant and Interview Coach. 
    MISSION: Provide actionable voice coaching based on the previous interview session.
    
    INTERVIEW DATA:
    REPORT: ${JSON.stringify(report)}
    HISTORY: ${activeRecording.transcript?.map(t => `${t.role}: ${t.text}`).join('\n').substring(0, 3000)}
    
    PREVIOUS COACHING LOGS:
    ${coachingHistoryText}

    GUIDELINES:
    - If history exists, pick up from the last coaching point.
    - Focus on technical improvements and the "Areas for Improvement" section.
    - Act as a mentor who wants them to land a $500k/year senior role.`;

    const service = new GeminiLiveService();
    liveServiceRef.current = service;
    setIsFeedbackSessionActive(true);

    try {
        await service.connect('Kore', systemPrompt, {
            onOpen: () => setIsAiConnected(true),
            onClose: () => { setIsAiConnected(false); },
            onError: (e) => { console.error(e); setIsAiConnected(false); },
            onVolumeUpdate: () => {},
            onTranscript: (text, isUser) => {
                setCoachingTranscript(prev => {
                    const role = isUser ? 'user' : 'ai';
                    if (prev.length > 0 && prev[prev.length - 1].role === role) {
                        const last = prev[prev.length - 1];
                        return [...prev.slice(0, -1), { ...last, text: last.text + text }];
                    }
                    return [...prev, { role, text, timestamp: Date.now() }];
                });
            }
        });
    } catch(e) { alert("Coaching session failed to initialize."); }
  };

  const handleStartInterview = async () => {
      setIsStarting(true);
      setTranscript([]);
      setCoachingTranscript([]);
      setReport(null);
      setActiveRecording(null);
      setVideoPlaybackUrl(null);
      videoBlobRef.current = null;
      interviewIdRef.current = generateSecureId();

      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const problemPrompt = `Job Context: ${jobDesc}. 
          Mode: ${mode}. 
          Programming Language: ${language}. 
          
          TASK: Generate a challenging senior-level ${mode} question. 
          CRITICAL: You MUST provide code examples and any expected API interfaces in ${language}.
          Format the entire problem as clean Markdown.`;

          const probResponse = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: problemPrompt });
          const problemMarkdown = probResponse.text || "Problem loading...";
          setGeneratedProblemMd(problemMarkdown);

          const ext = language.toLowerCase().includes('py') ? 'py' : language.toLowerCase().includes('c++') ? 'cpp' : language.toLowerCase().includes('rust') ? 'rs' : 'ts';
          
          const files: CodeFile[] = [
              { name: 'Problem.md', path: 'mock://problem', content: problemMarkdown, language: 'markdown', loaded: true, isDirectory: false, isModified: false },
              { name: mode === 'coding' ? `solution.${ext}` : 'architecture.draw', path: 'mock://work', content: '', language: mode === 'coding' ? (language.toLowerCase() as any) : 'whiteboard', loaded: true, isDirectory: false, isModified: false }
          ];
          setInitialStudioFiles(files);

          const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          activeStreamRef.current = camStream;

          const canvas = document.createElement('canvas');
          canvas.width = 1920; canvas.height = 1080;
          const ctx = canvas.getContext('2d', { alpha: false })!;
          const camVideo = document.createElement('video'); camVideo.srcObject = camStream; camVideo.muted = true; camVideo.playsInline = true;
          const screenVideo = document.createElement('video'); screenVideo.srcObject = screenStream; screenVideo.muted = true; screenVideo.playsInline = true;

          await Promise.all([
              new Promise((resolve) => { camVideo.onloadedmetadata = () => { camVideo.play().then(resolve); }; }),
              new Promise((resolve) => { screenVideo.onloadedmetadata = () => { screenVideo.play().then(resolve); }; })
          ]);
          
          const drawFrame = () => {
              if (view !== 'interview' && !isStarting) return;
              ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, canvas.width, canvas.height);
              if (screenVideo.readyState >= 2) ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
              if (camVideo.readyState >= 2) {
                  ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 10;
                  ctx.strokeRect(1500, 750, 380, 280); ctx.drawImage(camVideo, 1500, 750, 380, 280);
              }
              requestAnimationFrame(drawFrame);
          };
          requestAnimationFrame(drawFrame);
          
          const combinedStream = canvas.captureStream(30);
          camStream.getAudioTracks().forEach(track => combinedStream.addTrack(track));
          const recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm;codecs=vp9,opus', videoBitsPerSecond: 2500000 });
          const chunks: Blob[] = [];
          recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
          recorder.onstop = () => { videoBlobRef.current = new Blob(chunks, { type: 'video/webm' }); };
          mediaRecorderRef.current = recorder;
          
          setView('interview');
          recorder.start(1000); 
          setIsRecording(true);
          
          const persona = mode === 'coding' ? 'Senior Technical Interviewer' : mode === 'system_design' ? 'Principal System Architect' : 'Hiring Manager';
          const prompt = `You are a world-class ${persona}. MISSION: Conduct mock interview. Context: Job: ${jobDesc}, Candidate: ${resumeText}, Stack: ${language}.`;
          const service = new GeminiLiveService();
          liveServiceRef.current = service;
          await service.connect(mode === 'behavioral' ? 'Zephyr' : 'Software Interview Voice gen-lang-client-0648937375', prompt, {
              onOpen: () => setIsAiConnected(true),
              onClose: () => { setIsAiConnected(false); },
              onError: (e) => { console.error(e); setIsAiConnected(false); },
              onVolumeUpdate: () => {},
              onTranscript: (text, isUser) => {
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
          setIsCodeStudioOpen(true);
      } catch (e) {
          alert("Permissions required (Camera + Screen).");
          setView('hub');
      } finally { setIsStarting(false); }
  };

  const handleEndInterview = async () => {
      mediaRecorderRef.current?.stop();
      liveServiceRef.current?.disconnect();
      setIsRecording(false);
      activeStreamRef.current?.getTracks().forEach(t => t.stop());
      activeStreamRef.current = null;
      setIsGeneratingReport(true);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const transcriptText = transcript.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n');
          const reportPrompt = `Analyze interview. Respond ONLY JSON: { "score": number, "technicalSkills": "string", "communication": "string", "collaboration": "string", "strengths": ["string"], "areasForImprovement": ["string"], "verdict": "Strong Hire", "summary": "string", "idealAnswers": [], "learningMaterial": "Markdown", "todoList": [] } Transcript: ${transcriptText}`;
          const response = await ai.models.generateContent({ model: 'gemini-3-pro-preview', contents: reportPrompt, config: { responseMimeType: 'application/json' } });
          const reportData = JSON.parse(response.text || '{}') as InterviewReport;
          setReport(reportData);
          
          let attempts = 0;
          while (!videoBlobRef.current && attempts < 50) { await new Promise(r => setTimeout(r, 100)); attempts++; }
          const blob = videoBlobRef.current || new Blob([], { type: 'video/webm' });
          const savedRec = await finalizeAndSave(blob, reportData);
          setActiveRecording(savedRec);
          if (blob.size > 0) setVideoPlaybackUrl(URL.createObjectURL(blob));
          setView('report');
      } catch (e) { setView('hub'); } finally { setIsGeneratingReport(false); }
  };

  const finalizeAndSave = async (videoBlob: Blob, finalReport: InterviewReport): Promise<MockInterviewRecording> => {
      setIsUploading(true);
      try {
          const token = getDriveToken() || await connectGoogleDrive();
          const studioFolderId = await ensureFolder(token, 'CodeStudio');
          const interviewsFolderId = await ensureFolder(token, 'Interviews', studioFolderId);
          const driveId = await uploadToDrive(token, interviewsFolderId, `Interview_${new Date().toISOString()}.webm`, videoBlob);
          const webViewUrl = await getDriveFileSharingLink(token, driveId);
          const recording: MockInterviewRecording = {
              id: interviewIdRef.current, userId: currentUser?.uid || 'guest', userName: currentUser?.displayName || 'Candidate', userPhoto: currentUser?.photoURL || '',
              mode, language, jobDescription: jobDesc, timestamp: Date.now(), videoUrl: webViewUrl || `drive://${driveId}`,
              transcript: transcript.map(t => ({ role: t.role, text: t.text, timestamp: t.timestamp })),
              feedback: JSON.stringify(finalReport), visibility: visibility
          };
          await saveInterviewRecording(recording);
          await loadInterviews();
          return recording;
      } catch (e) { return { id: 'error', userId: 'error', userName: 'Error', mode, jobDescription: jobDesc, timestamp: Date.now(), videoUrl: '' }; }
      finally { setIsUploading(false); }
  };

  const handleViewArchiveItem = async (rec: MockInterviewRecording) => {
      setActiveRecording(rec);
      setReport(JSON.parse(rec.feedback || '{}'));
      setVideoPlaybackUrl(rec.videoUrl);
      setTranscript(rec.transcript || []);
      setCoachingTranscript(rec.coachingTranscript || []);
      setView('report');
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden relative">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-20">
          <div className="flex items-center gap-4">
              <button onClick={() => view === 'hub' ? onBack() : setView('hub')} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400">
                  <ArrowLeft size={20} />
              </button>
              <h1 className="text-lg font-bold text-white flex items-center gap-2"><Video className="text-red-500" /> Mock Interview</h1>
          </div>
          {view === 'interview' && (
              <div className="flex items-center gap-3">
                  {!isAiConnected && <button onClick={handleReconnectAi} className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold shadow-lg animate-pulse"><RefreshCw size={14}/>Resume AI</button>}
                  <button onClick={handleEndInterview} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold shadow-lg">End & Report</button>
              </div>
          )}
          {view === 'report' && report && (
              <div className="flex items-center gap-2">
                  <button onClick={handleDownloadCareerBundle} disabled={isExportingBundle} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-black shadow-lg transition-all uppercase tracking-widest">{isExportingBundle ? <Loader2 size={14} className="animate-spin"/> : <Package size={14}/>}Export Career Bundle</button>
                  <button onClick={() => handleDownloadPdf(reportRef, `Report_${activeRecording?.id}.pdf`)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400"><FileDown size={18}/></button>
              </div>
          )}
      </header>

      <main className="flex-1 overflow-y-auto scrollbar-hide">
          {view === 'hub' && (
              <div className="max-w-6xl mx-auto p-8 space-y-12 animate-fade-in">
                  <div className="bg-indigo-600 rounded-[3rem] p-12 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center gap-10">
                      <div className="absolute top-0 right-0 p-32 bg-white/10 blur-[100px] rounded-full"></div>
                      <div className="relative z-10 flex-1 space-y-6">
                          <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">Ready for your<br/>Next Big Step?</h2>
                          <button onClick={() => setView('prep')} className="px-10 py-5 bg-white text-indigo-600 font-black uppercase tracking-widest rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3"><Zap size={20} fill="currentColor"/> Start Simulation</button>
                      </div>
                      <div className="relative z-10 hidden lg:block"><div className="w-64 h-64 bg-slate-950 rounded-[3rem] border-8 border-indigo-400/30 flex items-center justify-center rotate-3 shadow-2xl"><Bot size={100} className="text-indigo-400 animate-pulse"/></div></div>
                  </div>

                  <div className="space-y-6">
                      <div className="flex justify-between items-end px-2">
                          <div><h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Recent Sessions</h3></div>
                          <div className="relative w-72"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16}/><input type="text" placeholder="Search archive..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none"/></div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {loading ? <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin mx-auto text-indigo-400" size={32}/></div> : interviews.filter(i => i.userName.toLowerCase().includes(searchQuery.toLowerCase())).map(rec => (
                              <div key={rec.id} onClick={() => handleViewArchiveItem(rec)} className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 hover:border-indigo-500/50 transition-all group cursor-pointer shadow-xl relative overflow-hidden">
                                  <div className="flex justify-between items-start mb-6">
                                      <div className="flex items-center gap-3"><img src={rec.userPhoto || `https://ui-avatars.com/api/?name=${rec.userName}`} className="w-12 h-12 rounded-2xl object-cover border-2 border-slate-800" /><div><h4 className="font-bold text-white text-sm">@{rec.userName}</h4><p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{new Date(rec.timestamp).toLocaleDateString()}</p></div></div>
                                      <div className="p-2 bg-slate-950 rounded-xl text-indigo-400 group-hover:scale-110 transition-transform"><FileCheck size={20}/></div>
                                  </div>
                                  <div className="space-y-4">
                                      <span className="text-[9px] font-black uppercase bg-indigo-900/20 text-indigo-400 px-3 py-1 rounded-full border border-indigo-500/30">{rec.mode}</span>
                                      <p className="text-xs text-slate-400 line-clamp-2 italic leading-relaxed">"{rec.jobDescription}"</p>
                                      <div className="pt-4 border-t border-slate-800 flex items-center justify-between"><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Review Report</span><ChevronRight size={16} className="text-slate-500 group-hover:translate-x-1 transition-transform" /></div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          )}

          {view === 'prep' && (
              <div className="max-w-4xl mx-auto p-12 animate-fade-in-up">
                  <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl space-y-10">
                      <div className="text-center"><h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">Simulation Setup</h2></div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                          <div className="space-y-6">
                              <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-4">
                                  <div className="flex items-center justify-between"><h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2"><User size={14}/> Candidate</h3><button onClick={handleLoadResumeFromProfile} className="text-[10px] font-black text-indigo-400 uppercase hover:underline">From Profile</button></div>
                                  <textarea value={resumeText} onChange={e => setResumeText(e.target.value)} placeholder="Paste resume summary..." className="w-full h-40 bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"/>
                              </div>
                              <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-4">
                                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Coding Language</h3>
                                  <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs font-bold text-white focus:ring-2 focus:ring-indigo-500 outline-none">
                                      {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                                  </select>
                              </div>
                          </div>
                          <div className="space-y-6">
                              <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-4"><h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2"><Building size={14}/> Job Context</h3><textarea value={jobDesc} onChange={e => setJobDesc(e.target.value)} placeholder="Paste Job Description..." className="w-full h-40 bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 focus:ring-1 focus:ring-emerald-500 outline-none resize-none"/></div>
                              <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-4">
                                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Interview Mode</h3>
                                  <div className="grid grid-cols-1 gap-2">{['coding', 'system_design', 'behavioral'].map(m => (<button key={m} onClick={() => setMode(m as any)} className={`p-4 rounded-2xl border text-left flex items-center justify-between transition-all ${mode === m ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-500'}`}><span className="text-xs font-bold uppercase">{m.replace('_', ' ')}</span>{mode === m && <CheckCircle size={16}/>}</button>))}</div>
                              </div>
                          </div>
                      </div>
                      <div className="pt-8 border-t border-slate-800 flex justify-end"><button onClick={handleStartInterview} disabled={isStarting || !jobDesc.trim()} className="px-12 py-5 bg-gradient-to-r from-red-600 to-indigo-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-2xl transition-all hover:scale-105 active:scale-95 disabled:opacity-30">{isStarting ? <Loader2 className="animate-spin" /> : 'Enter Simulation & Record'}</button></div>
                  </div>
              </div>
          )}

          {view === 'interview' && (
              <div className="h-full flex overflow-hidden relative">
                  <div className={`flex flex-col border-r border-slate-800 transition-all ${isCodeStudioOpen ? 'w-[400px]' : 'flex-1'}`}>
                      <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between"><span className="font-bold text-white uppercase tracking-tighter flex items-center gap-2"><Bot size={20} className="text-indigo-400"/> AI Panel</span><div className="flex gap-2"><button onClick={() => handleDownloadPdf(problemRef, 'Problem.pdf')} className="p-2 bg-slate-800 rounded-lg text-xs font-bold uppercase flex items-center gap-1"><FileDown size={14}/> PDF</button><button onClick={() => setIsCodeStudioOpen(!isCodeStudioOpen)} className="p-2 bg-slate-800 rounded-lg text-xs font-bold uppercase">{isCodeStudioOpen ? 'Hide' : 'Show'} Studio</button></div></div>
                      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                          <div ref={problemRef} className="bg-[#020617] p-8 rounded-2xl border border-slate-800 mb-8"><h1 className="text-2xl font-black text-indigo-400 mb-4 uppercase">Coding Challenge</h1><MarkdownView content={generatedProblemMd} /></div>
                          <div className="space-y-4">
                              {transcript.map((item, idx) => (
                                  <div key={idx} className={`flex flex-col ${item.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in-up`}><span className={`text-[9px] uppercase font-black mb-1 ${item.role === 'user' ? 'text-emerald-400' : 'text-indigo-400'}`}>{item.role === 'user' ? 'You' : 'Interviewer'}</span><div className={`max-w-[90%] px-5 py-3 rounded-2xl text-sm leading-relaxed ${item.role === 'user' ? 'bg-emerald-600 text-white rounded-tr-sm' : 'bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700'}`}>{item.text}</div></div>
                              ))}
                          </div>
                      </div>
                  </div>
                  {isCodeStudioOpen && <div className="flex-1 bg-slate-950"><CodeStudio onBack={() => setIsCodeStudioOpen(false)} currentUser={currentUser} userProfile={userProfile} onSessionStart={() => {}} onSessionStop={() => {}} onStartLiveSession={onStartLiveSession} initialFiles={initialStudioFiles}/></div>}
                  <div className="absolute bottom-12 right-8 w-64 aspect-video rounded-3xl overflow-hidden border-4 border-slate-800 shadow-2xl z-50 bg-black"><video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" /></div>
              </div>
          )}

          {view === 'report' && report && (
              <div className="max-w-4xl mx-auto p-8 animate-fade-in-up space-y-12 pb-32">
                  {/* HIDDEN BUNDLE CONTENT FOR PDF EXPORT */}
                  <div className="hidden">
                    <div ref={bundleRef} className="bg-[#020617] text-white p-20 space-y-20">
                        <div className="text-center border-b border-white/10 pb-10">
                            <h1 className="text-6xl font-black italic uppercase tracking-tighter">Neural Career Bundle</h1>
                            <p className="text-slate-500 text-sm mt-4 uppercase tracking-[0.4em]">Verified Neural Simulation Results • ID: {activeRecording?.id}</p>
                        </div>
                        <div>
                            <h2 className="text-3xl font-black uppercase text-indigo-400 mb-6">1. Resume Context</h2>
                            <div className="bg-slate-900/50 p-10 rounded-2xl border border-white/5 text-sm text-slate-300 whitespace-pre-wrap">{resumeText || "No resume provided."}</div>
                        </div>
                        <div>
                            <h2 className="text-3xl font-black uppercase text-indigo-400 mb-6">2. AI Assessment Report</h2>
                            <div className="grid grid-cols-2 gap-10">
                                <div className="bg-slate-900/50 p-10 rounded-[3rem] border border-white/10 text-center"><p className="text-xs text-slate-500 font-bold uppercase mb-2">Simulation Score</p><p className="text-7xl font-black text-indigo-400">{report.score}</p></div>
                                <div className="bg-slate-900/50 p-10 rounded-[3rem] border border-white/10 text-center"><p className="text-xs text-slate-500 font-bold uppercase mb-2">Final Verdict</p><p className="text-3xl font-black text-emerald-400">{report.verdict}</p></div>
                            </div>
                            <p className="mt-10 text-xl font-serif italic text-slate-400 leading-relaxed">"{report.summary}"</p>
                        </div>
                        <div>
                            <h2 className="text-3xl font-black uppercase text-emerald-400 mb-6">3. Interview Logs</h2>
                            <div className="space-y-6">{transcript.map((t,i) => (<div key={i} className="text-sm border-l-2 border-white/5 pl-6 py-2"><p className="text-[10px] font-black uppercase text-slate-600 mb-1">{t.role}</p><p className="text-slate-300">{t.text}</p></div>))}</div>
                        </div>
                        {coachingTranscript.length > 0 && (
                            <div>
                                <h2 className="text-3xl font-black uppercase text-amber-400 mb-6">4. Voice Coaching Session</h2>
                                <div className="space-y-6">{coachingTranscript.map((t,i) => (<div key={i} className="text-sm border-l-2 border-white/5 pl-6 py-2"><p className="text-[10px] font-black uppercase text-slate-600 mb-1">{t.role}</p><p className="text-slate-300">{t.text}</p></div>))}</div>
                            </div>
                        )}
                        <div className="pt-20 border-t border-white/5 text-center text-[10px] text-slate-600 uppercase tracking-widest font-black">AIVoiceCast Platform v4.2.0 • End of Bundle</div>
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl">
                      <div className="aspect-video bg-black relative group">{videoPlaybackUrl ? <video src={videoPlaybackUrl} controls className="w-full h-full object-contain" /> : <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 gap-4"><PlayCircle size={64} className="opacity-20"/><p className="text-sm font-bold uppercase tracking-widest">Video Recording Saved</p></div>}</div>
                      <div className="p-10 flex flex-col items-center text-center space-y-6" ref={reportRef}>
                          <Trophy className="text-amber-500" size={64}/><h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">Simulation Report</h2>
                          <div className="flex gap-4"><div className="px-8 py-4 bg-slate-950 rounded-2xl border border-slate-800"><p className="text-[10px] text-slate-500 font-bold uppercase">Score</p><p className="text-4xl font-black text-indigo-400">{report.score}/100</p></div><div className="px-8 py-4 bg-slate-950 rounded-2xl border border-slate-800"><p className="text-[10px] text-slate-500 font-bold uppercase">Verdict</p><p className={`text-xl font-black uppercase text-emerald-400`}>{report.verdict}</p></div></div>
                          <div className="flex flex-col gap-3 w-full max-w-sm">
                              <button onClick={startCoachingSession} className={`px-10 py-5 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all ${isFeedbackSessionActive ? (isAiConnected ? 'bg-indigo-600' : 'bg-red-600 animate-pulse') : 'bg-emerald-600 hover:bg-emerald-500'} text-white shadow-2xl`}>
                                  {isFeedbackSessionActive ? (isAiConnected ? <><StopCircle size={24}/> End Coaching</> : <><RefreshCw size={24} className="animate-spin"/> Resume AI</>) : <><MessageCircleCode size={24}/> Start Voice Coaching</>}
                              </button>
                          </div>
                      </div>
                  </div>

                  <div className="bg-white rounded-[3rem] p-12 text-slate-950 shadow-2xl space-y-10">
                      <div><h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Summary</h3><p className="text-xl font-serif leading-relaxed text-slate-800 italic">"{report.summary}"</p></div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                          <div><h3 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><Star size={12} fill="currentColor"/> Strengths</h3><ul className="space-y-3">{report.strengths.map((s, i) => (<li key={i} className="flex gap-3 text-sm font-bold text-slate-700"><CheckCircle className="text-emerald-500 shrink-0" size={18}/><span>{s}</span></li>))}</ul></div>
                          <div><h3 className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><BarChart3 size={12}/> Growth</h3><ul className="space-y-3">{report.areasForImprovement.map((a, i) => (<li key={i} className="flex gap-3 text-sm font-bold text-slate-700"><Zap className="text-amber-500 shrink-0" size={18}/><span>{a}</span></li>))}</ul></div>
                      </div>
                  </div>
                  
                  {coachingTranscript.length > 0 && (
                      <div className="space-y-6 animate-fade-in-up">
                          <h3 className="text-xl font-bold text-white uppercase flex items-center gap-2 px-2"><MessageSquare className="text-amber-400"/> Coaching History</h3>
                          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-6">
                              {coachingTranscript.map((t,i) => (
                                  <div key={i} className={`flex flex-col ${t.role === 'user' ? 'items-end' : 'items-start'}`}>
                                      <span className="text-[9px] font-black uppercase text-slate-500 mb-1">{t.role === 'user' ? 'You' : 'Coach'}</span>
                                      <div className={`max-w-[90%] px-4 py-2 rounded-xl text-sm ${t.role === 'user' ? 'bg-indigo-600' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}>{t.text}</div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}

                  <div className="space-y-6"><h3 className="text-xl font-bold text-white uppercase flex items-center gap-2 px-2"><GraduationCap className="text-indigo-400"/> Neural Growth Path</h3><div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl"><MarkdownView content={report.learningMaterial} initialTheme={userProfile?.preferredReaderTheme || 'slate'} /></div></div>
              </div>
          )}
      </main>

      {(isUploading || isGeneratingReport) && (
          <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center gap-4">
              <div className="relative"><div className="w-24 h-24 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div><CloudUpload className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-400" size={32}/></div>
              <h3 className="text-xl font-bold text-white uppercase">{isGeneratingReport ? 'Synthesizing Metrics' : 'Sovereign Sync'}</h3>
              <p className="text-sm text-slate-400">{isGeneratingReport ? 'Processing session transcript...' : 'Moving recording to Google Drive...'}</p>
          </div>
      )}
    </div>
  );
};
