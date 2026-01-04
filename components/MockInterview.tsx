
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MockInterviewRecording, TranscriptItem, CodeFile, UserProfile, Channel } from '../types';
import { ArrowLeft, Video, Mic, Monitor, Play, Save, Loader2, Search, Trash2, CheckCircle, X, Download, ShieldCheck, User, Users, Building, FileText, ChevronRight, Zap, SidebarOpen, SidebarClose, Code, MessageSquare, Sparkles, Languages, Clock, Camera, Bot, CloudUpload, Trophy, BarChart3, ClipboardCheck, Star, Upload, FileUp, Linkedin, FileCheck, Edit3, BookOpen, Lightbulb, Target, ListChecks, MessageCircleCode, GraduationCap, Lock, Globe, ExternalLink, PlayCircle } from 'lucide-react';
import { auth } from '../services/firebaseConfig';
import { saveInterviewRecording, getPublicInterviews, deleteInterview, updateUserProfile, uploadFileToStorage, getUserInterviews, updateInterviewMetadata } from '../services/firestoreService';
import { getDriveToken, connectGoogleDrive } from '../services/authService';
import { ensureFolder, uploadToDrive, getDriveFileSharingLink, readPublicDriveFile } from '../services/googleDriveService';
import { GeminiLiveService } from '../services/geminiLive';
import { GoogleGenAI } from '@google/genai';
import { generateSecureId } from '../utils/idUtils';
import CodeStudio from './CodeStudio';
import { MarkdownView } from './MarkdownView';

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

export const MockInterview: React.FC<MockInterviewProps> = ({ onBack, userProfile, onStartLiveSession }) => {
  const [view, setView] = useState<'hub' | 'prep' | 'interview' | 'report'>('hub');
  const [interviews, setInterviews] = useState<MockInterviewRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Prep State
  const [mode, setMode] = useState<'coding' | 'system_design' | 'behavioral'>('coding');
  const [language, setLanguage] = useState('TypeScript');
  const [jobDesc, setJobDesc] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  
  // File Upload State
  const [isParsingFile, setIsParsingFile] = useState<string | null>(null);
  const [resumeSource, setResumeSource] = useState<'text' | 'profile' | 'upload'>('text');

  const [isStarting, setIsStarting] = useState(false);
  
  // Interview Logic
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [isCodeStudioOpen, setIsCodeStudioOpen] = useState(false);
  const [initialStudioFiles, setInitialStudioFiles] = useState<CodeFile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Active Report State
  const [activeRecording, setActiveRecording] = useState<MockInterviewRecording | null>(null);
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [videoPlaybackUrl, setVideoPlaybackUrl] = useState<string | null>(null);
  
  // Feedback Session State
  const [isFeedbackSessionActive, setIsFeedbackSessionActive] = useState(false);

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

  const parseFileToText = async (file: File): Promise<string> => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
      });

      const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: {
              parts: [
                  { inlineData: { data: base64, mimeType: file.type } },
                  { text: "Extract and summarize the technical experience from this document. Respond with text ONLY." }
              ]
          }
      });
      return response.text || "";
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'resume' | 'jd') => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      setIsParsingFile(type);
      try {
          const text = await parseFileToText(file);
          if (type === 'resume') setResumeText(text);
          else setJobDesc(text);
      } catch (err) {
          alert("Neural parsing failed. Please try pasting the text manually.");
      } finally {
          setIsParsingFile(null);
      }
  };

  const handleLoadResumeFromProfile = () => {
      if (userProfile?.resumeText) {
          setResumeText(userProfile.resumeText);
          setResumeSource('profile');
      } else {
          alert("No resume found in your profile.");
      }
  };

  const handleStartInterview = async () => {
      setIsStarting(true);
      setTranscript([]);
      setReport(null);
      setActiveRecording(null);
      setVideoPlaybackUrl(null);
      videoBlobRef.current = null;
      interviewIdRef.current = generateSecureId();

      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const problemPrompt = `
            Context: Job Description: ${jobDesc}. Mode: ${mode}. Language: ${language}.
            Task: Generate a challenging, senior-level ${mode} question. 
            Include requirements, example inputs/outputs, and edge cases. 
            Format as clean Markdown.
          `;
          const probResponse = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: problemPrompt
          });
          const problemMarkdown = probResponse.text || "Loading problem...";

          const files: CodeFile[] = [
              { name: 'Problem.md', path: 'mock://problem', content: problemMarkdown, language: 'markdown', loaded: true, isDirectory: false, isModified: false },
              { name: mode === 'coding' ? `solution.${language.toLowerCase() === 'typescript' ? 'ts' : 'py'}` : 'architecture.draw', path: 'mock://work', content: '', language: mode === 'coding' ? language.toLowerCase() as any : 'whiteboard', loaded: true, isDirectory: false, isModified: false }
          ];
          setInitialStudioFiles(files);

          // REQUEST PERMISSIONS
          const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          
          activeStreamRef.current = camStream;

          const canvas = document.createElement('canvas');
          canvas.width = 1920; 
          canvas.height = 1080;
          const ctx = canvas.getContext('2d', { alpha: false })!;
          
          const camVideo = document.createElement('video');
          camVideo.srcObject = camStream; 
          camVideo.muted = true;
          camVideo.playsInline = true;
          
          const screenVideo = document.createElement('video');
          screenVideo.srcObject = screenStream; 
          screenVideo.muted = true;
          screenVideo.playsInline = true;

          // CRITICAL: Ensure both videos are actually ready to play before recording starts
          await Promise.all([
              new Promise((resolve) => { camVideo.onloadedmetadata = () => { camVideo.play().then(resolve); }; }),
              new Promise((resolve) => { screenVideo.onloadedmetadata = () => { screenVideo.play().then(resolve); }; })
          ]);
          
          const drawFrame = () => {
              // The draw loop should continue as long as we are starting or recording
              if (view !== 'interview' && !isStarting) return;
              
              ctx.fillStyle = '#020617';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              
              // Draw Screen (Background)
              if (screenVideo.readyState >= 2) {
                  ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
              }
              
              // Draw Camera (Overlay)
              if (camVideo.readyState >= 2) {
                  ctx.strokeStyle = '#6366f1'; 
                  ctx.lineWidth = 10;
                  ctx.strokeRect(1500, 750, 380, 280);
                  ctx.drawImage(camVideo, 1500, 750, 380, 280);
              }
              
              requestAnimationFrame(drawFrame);
          };
          
          // Start drawing before starting recorder to ensure stream is warm
          requestAnimationFrame(drawFrame);
          
          const combinedStream = canvas.captureStream(30);
          camStream.getAudioTracks().forEach(track => combinedStream.addTrack(track));
          
          const recorder = new MediaRecorder(combinedStream, { 
              mimeType: 'video/webm;codecs=vp9,opus',
              videoBitsPerSecond: 2500000 // 2.5 Mbps
          });
          
          const chunks: Blob[] = [];
          recorder.ondataavailable = e => {
              if (e.data.size > 0) chunks.push(e.data);
          };
          recorder.onstop = () => { 
              videoBlobRef.current = new Blob(chunks, { type: 'video/webm' }); 
          };
          mediaRecorderRef.current = recorder;
          
          setView('interview');
          recorder.start(1000); // Capture in 1s slices for robustness
          setIsRecording(true);
          
          const persona = mode === 'coding' ? 'Senior Technical Interviewer' : mode === 'system_design' ? 'Principal System Architect' : 'Hiring Manager';
          const prompt = `You are a world-class ${persona}. 
          MISSION: Conduct a mock interview.
          PROTOCOL:
          - If the user is silent for more than 7 seconds, ask a checking question.
          - Context: Job: ${jobDesc}, Candidate: ${resumeText}, Stack: ${language}.`;

          const service = new GeminiLiveService();
          liveServiceRef.current = service;
          await service.connect(mode === 'behavioral' ? 'Zephyr' : 'Software Interview Voice gen-lang-client-0648937375', prompt, {
              onOpen: () => {},
              onClose: () => { if (view === 'interview') handleEndInterview(); },
              onError: (e) => console.error(e),
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
          console.error(e);
          alert("Permissions required for Mock Interview (Camera + Screen Share).");
          setView('hub');
      } finally {
          setIsStarting(false);
      }
  };

  const handleEndInterview = async () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
      }
      
      liveServiceRef.current?.disconnect();
      setIsRecording(false);
      activeStreamRef.current?.getTracks().forEach(t => t.stop());
      activeStreamRef.current = null;
      
      setIsGeneratingReport(true);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const transcriptText = transcript.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n');
          const reportPrompt = `Analyze interview transcript. Respond ONLY in JSON format: { "score": number, "technicalSkills": "string", "communication": "string", "collaboration": "string", "strengths": ["string"], "areasForImprovement": ["string"], "verdict": "Strong Hire", "summary": "string", "idealAnswers": [], "learningMaterial": "Markdown", "todoList": [] } Transcript: ${transcriptText}`;

          const response = await ai.models.generateContent({
              model: 'gemini-3-pro-preview',
              contents: reportPrompt,
              config: { responseMimeType: 'application/json' }
          });

          const reportData = JSON.parse(response.text || '{}') as InterviewReport;
          setReport(reportData);
          
          // Allow some time for MediaRecorder onstop to finish processing chunks
          let attempts = 0;
          while (!videoBlobRef.current && attempts < 50) {
              await new Promise(r => setTimeout(r, 100));
              attempts++;
          }
          
          const blob = videoBlobRef.current || new Blob([], { type: 'video/webm' });
          const savedRec = await finalizeAndSave(blob, reportData);
          
          setActiveRecording(savedRec);
          if (blob.size > 0) setVideoPlaybackUrl(URL.createObjectURL(blob));
          setView('report');
      } catch (e) {
          console.error("Report failed", e);
          setView('hub');
      } finally {
          setIsGeneratingReport(false);
      }
  };

  const finalizeAndSave = async (videoBlob: Blob, finalReport: InterviewReport): Promise<MockInterviewRecording> => {
      setIsUploading(true);
      try {
          const token = getDriveToken() || await connectGoogleDrive();
          const studioFolderId = await ensureFolder(token, 'CodeStudio');
          const interviewsFolderId = await ensureFolder(token, 'Interviews', studioFolderId);
          
          // Generate a filename with local timestamp
          const timestampStr = new Date().toISOString();
          const driveId = await uploadToDrive(token, interviewsFolderId, `Interview_${timestampStr}.webm`, videoBlob);
          const webViewUrl = await getDriveFileSharingLink(token, driveId);

          const recording: MockInterviewRecording = {
              id: interviewIdRef.current,
              userId: currentUser?.uid || 'guest',
              userName: currentUser?.displayName || 'Candidate',
              userPhoto: currentUser?.photoURL || '',
              mode, language, jobDescription: jobDesc,
              timestamp: Date.now(),
              videoUrl: webViewUrl || `drive://${driveId}`,
              transcript: transcript.map(t => ({ role: t.role, text: t.text, timestamp: t.timestamp })),
              feedback: JSON.stringify(finalReport),
              visibility: visibility
          };
          
          await saveInterviewRecording(recording);
          await loadInterviews();
          return recording;
      } catch (e: any) {
          console.error("Sync failed", e);
          return { id: 'error', userId: 'error', userName: 'Error', mode, jobDescription: jobDesc, timestamp: Date.now(), videoUrl: '' };
      } finally {
          setIsUploading(false);
      }
  };

  const handleViewArchiveItem = async (rec: MockInterviewRecording) => {
      setActiveRecording(rec);
      setReport(JSON.parse(rec.feedback || '{}'));
      setVideoPlaybackUrl(rec.videoUrl);
      setView('report');
  };

  const startCoachingSession = () => {
    if (!report || !activeRecording) return;

    const feedbackChannel: Channel = {
        id: `feedback-${activeRecording.id}`,
        title: `Coaching: ${activeRecording.mode}`,
        description: `Voice coaching for your ${activeRecording.mode} interview based on neural simulation report.`,
        author: 'AI Headhunter',
        voiceName: 'Kore',
        systemInstruction: `You are an expert Executive Search Consultant and Interview Coach. 
        MISSION: Provide actionable voice coaching based on the previous interview session.
        
        INTERVIEW DATA:
        REPORT: ${JSON.stringify(report)}
        TRANSCRIPT SUMMARY: ${activeRecording.transcript?.map(t => `${t.role}: ${t.text}`).join('\n').substring(0, 5000)}
        
        GUIDELINES:
        - Be encouraging but provide specific technical critiques.
        - Focus on the "Areas for Improvement" mentioned in the report.
        - Offer to practice specific questions where the user fell short.
        - Act as a mentor who wants them to land a $500k/year senior role.`,
        likes: 0,
        dislikes: 0,
        comments: [],
        tags: ['Coaching', 'Feedback', 'Growth'],
        imageUrl: activeRecording.userPhoto || 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600&q=80',
        createdAt: Date.now()
    };

    setIsFeedbackSessionActive(true);
    onStartLiveSession(feedbackChannel, `Feedback for ${activeRecording.mode} session`);
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
              <button onClick={handleEndInterview} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold shadow-lg">End & Generate Report</button>
          )}
      </header>

      <main className="flex-1 overflow-y-auto scrollbar-hide">
          {view === 'hub' && (
              <div className="max-w-6xl mx-auto p-8 space-y-12 animate-fade-in">
                  <div className="bg-indigo-600 rounded-[3rem] p-12 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center gap-10">
                      <div className="absolute top-0 right-0 p-32 bg-white/10 blur-[100px] rounded-full"></div>
                      <div className="relative z-10 flex-1 space-y-6">
                          <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">Ready for your<br/>Next Big Step?</h2>
                          <p className="text-indigo-100 text-lg font-medium opacity-90 max-w-lg">Run high-fidelity technical simulations with senior-level AI personas. Get real-time feedback, code reviews, and a detailed growth path.</p>
                          <button onClick={() => setView('prep')} className="px-10 py-5 bg-white text-indigo-600 font-black uppercase tracking-widest rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3">
                              <Zap size={20} fill="currentColor"/> Start Simulation
                          </button>
                      </div>
                      <div className="relative z-10 hidden lg:block"><div className="w-64 h-64 bg-slate-950 rounded-[3rem] border-8 border-indigo-400/30 flex items-center justify-center rotate-3 shadow-2xl"><Bot size={100} className="text-indigo-400 animate-pulse"/></div></div>
                  </div>

                  <div className="space-y-6">
                      <div className="flex justify-between items-end px-2">
                          <div><h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Recent Sessions</h3><p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Review your growth trajectory</p></div>
                          <div className="relative w-72"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16}/><input type="text" placeholder="Search archive..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"/></div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {loading ? <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin mx-auto text-indigo-400" size={32}/></div> : interviews.length === 0 ? (
                              <div className="col-span-full py-32 text-center text-slate-500 border-2 border-dashed border-slate-800 rounded-[3rem]"><p>No sessions recorded yet.</p></div>
                          ) : interviews.filter(i => i.userName.toLowerCase().includes(searchQuery.toLowerCase())).map(rec => (
                              <div key={rec.id} onClick={() => handleViewArchiveItem(rec)} className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 hover:border-indigo-500/50 transition-all group cursor-pointer shadow-xl relative overflow-hidden">
                                  <div className="flex justify-between items-start mb-6">
                                      <div className="flex items-center gap-3">
                                          <img src={rec.userPhoto || `https://ui-avatars.com/api/?name=${rec.userName}`} className="w-12 h-12 rounded-2xl object-cover border-2 border-slate-800" />
                                          <div><h4 className="font-bold text-white text-sm">@{rec.userName}</h4><p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{new Date(rec.timestamp).toLocaleDateString()}</p></div>
                                      </div>
                                      <div className="p-2 bg-slate-950 rounded-xl text-indigo-400 group-hover:scale-110 transition-transform"><FileCheck size={20}/></div>
                                  </div>
                                  <div className="space-y-4">
                                      <div className="flex gap-2">
                                          <span className="text-[9px] font-black uppercase bg-indigo-900/20 text-indigo-400 px-3 py-1 rounded-full border border-indigo-500/30">{rec.mode}</span>
                                          <span className="text-[9px] font-black uppercase bg-emerald-900/20 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/30">Verified</span>
                                      </div>
                                      <p className="text-xs text-slate-400 line-clamp-2 italic leading-relaxed">"{rec.jobDescription}"</p>
                                      <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Review Report</span>
                                          <ChevronRight size={16} className="text-slate-500 group-hover:translate-x-1 transition-transform" />
                                      </div>
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
                      <div className="text-center">
                          <div className="w-16 h-16 bg-indigo-500/10 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-6"><Bot size={32}/></div>
                          <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">Simulation Setup</h2>
                          <p className="text-slate-400">Target your role and customize the interviewer personality.</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                          <div className="space-y-6">
                              <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-4">
                                  <div className="flex items-center justify-between"><h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2"><User size={14}/> Candidate</h3>{currentUser && <button onClick={handleLoadResumeFromProfile} className="text-[10px] font-black text-indigo-400 uppercase hover:underline">From Profile</button>}</div>
                                  <textarea value={resumeText} onChange={e => setResumeText(e.target.value)} placeholder="Paste resume summary..." className="w-full h-40 bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"/>
                              </div>
                              <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-4">
                                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Track</h3>
                                  <div className="grid grid-cols-1 gap-2">
                                      {['coding', 'system_design', 'behavioral'].map(m => (
                                          <button key={m} onClick={() => setMode(m as any)} className={`p-4 rounded-2xl border text-left flex items-center justify-between transition-all ${mode === m ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-500'}`}><span className="text-xs font-bold uppercase">{m.replace('_', ' ')}</span>{mode === m && <CheckCircle size={16}/>}</button>
                                      ))}
                                  </div>
                              </div>
                          </div>
                          <div className="space-y-6">
                              <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-4">
                                  <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2"><Building size={14}/> Job Context</h3>
                                  <textarea value={jobDesc} onChange={e => setJobDesc(e.target.value)} placeholder="Paste Job Description..." className="w-full h-40 bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 focus:ring-1 focus:ring-emerald-500 outline-none resize-none"/>
                              </div>
                              <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-4">
                                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Visibility</h3>
                                  <div className="grid grid-cols-2 gap-2">
                                      <button onClick={() => setVisibility('public')} className={`p-4 rounded-2xl border transition-all ${visibility === 'public' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-500'}`}><span className="text-xs font-bold uppercase">Public</span></button>
                                      <button onClick={() => setVisibility('private')} className={`p-4 rounded-2xl border transition-all ${visibility === 'private' ? 'bg-amber-600 border-amber-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-500'}`}><span className="text-xs font-bold uppercase">Private</span></button>
                                  </div>
                              </div>
                          </div>
                      </div>

                      <div className="pt-8 border-t border-slate-800 flex justify-end">
                          <button onClick={handleStartInterview} disabled={isStarting || !jobDesc.trim()} className="px-12 py-5 bg-gradient-to-r from-red-600 to-indigo-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-2xl transition-all hover:scale-105 active:scale-95 disabled:opacity-30">
                              {isStarting ? <Loader2 className="animate-spin" /> : 'Enter Simulation & Record'}
                          </button>
                      </div>
                  </div>
              </div>
          )}

          {view === 'interview' && (
              <div className="h-full flex overflow-hidden relative">
                  <div className={`flex flex-col border-r border-slate-800 transition-all ${isCodeStudioOpen ? 'w-[400px]' : 'flex-1'}`}>
                      <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                          <span className="font-bold text-white uppercase tracking-tighter flex items-center gap-2"><Bot size={20} className="text-indigo-400"/> AI Panel</span>
                          <button onClick={() => setIsCodeStudioOpen(!isCodeStudioOpen)} className="p-2 bg-slate-800 rounded-lg text-xs font-bold uppercase">{isCodeStudioOpen ? 'Hide Workspace' : 'Show Workspace'}</button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                          {transcript.map((item, idx) => (
                              <div key={idx} className={`flex flex-col ${item.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in-up`}>
                                  <span className={`text-[9px] uppercase font-black mb-1 ${item.role === 'user' ? 'text-emerald-400' : 'text-indigo-400'}`}>{item.role === 'user' ? 'You' : 'Interviewer'}</span>
                                  <div className={`max-w-[90%] px-5 py-3 rounded-2xl text-sm leading-relaxed ${item.role === 'user' ? 'bg-emerald-600 text-white rounded-tr-sm' : 'bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700'}`}>{item.text}</div>
                              </div>
                          ))}
                      </div>
                  </div>
                  {isCodeStudioOpen && <div className="flex-1 bg-slate-950"><CodeStudio onBack={() => setIsCodeStudioOpen(false)} currentUser={currentUser} userProfile={userProfile} onSessionStart={() => {}} onSessionStop={() => {}} onStartLiveSession={onStartLiveSession} initialFiles={initialStudioFiles}/></div>}
                  <div className="absolute bottom-12 right-8 w-64 aspect-video rounded-3xl overflow-hidden border-4 border-slate-800 shadow-2xl z-50 bg-black"><video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" /></div>
              </div>
          )}

          {view === 'report' && report && (
              <div className="max-w-4xl mx-auto p-8 animate-fade-in-up space-y-12 pb-32">
                  <div className="bg-slate-900 border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl">
                      <div className="aspect-video bg-black relative group">
                          {videoPlaybackUrl ? (
                              <video src={videoPlaybackUrl} controls className="w-full h-full object-contain" />
                          ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 gap-4">
                                  <PlayCircle size={64} className="opacity-20"/>
                                  <p className="text-sm font-bold uppercase tracking-widest">Video Recording Saved to Drive</p>
                              </div>
                          )}
                          <div className="absolute top-6 left-6 z-10"><div className="bg-emerald-500 text-white px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-xl"><ShieldCheck size={14}/> Verified Session</div></div>
                      </div>
                      <div className="p-10 flex flex-col items-center text-center space-y-6">
                          <Trophy className="text-amber-500" size={64}/>
                          <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">Simulation Report</h2>
                          <div className="flex gap-4">
                              <div className="px-8 py-4 bg-slate-950 rounded-2xl border border-slate-800"><p className="text-[10px] text-slate-500 font-bold uppercase">Overall Score</p><p className="text-4xl font-black text-indigo-400">{report.score}/100</p></div>
                              <div className="px-8 py-4 bg-slate-950 rounded-2xl border border-slate-800"><p className="text-[10px] text-slate-500 font-bold uppercase">Verdict</p><p className={`text-xl font-black uppercase ${report.verdict.includes('Strong') ? 'text-emerald-400' : 'text-amber-400'}`}>{report.verdict}</p></div>
                          </div>
                          <button onClick={startCoachingSession} className={`px-10 py-5 rounded-2xl font-black uppercase tracking-widest flex items-center gap-3 transition-all ${isFeedbackSessionActive ? 'bg-red-600 animate-pulse' : 'bg-emerald-600 hover:bg-emerald-500'} text-white shadow-2xl`}><MessageCircleCode size={24}/><span>{isFeedbackSessionActive ? 'End Coaching' : 'Start Voice Coaching'}</span></button>
                      </div>
                  </div>

                  <div className="bg-white rounded-[3rem] p-12 text-slate-950 shadow-2xl space-y-10">
                      <div><h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Summary</h3><p className="text-xl font-serif leading-relaxed text-slate-800 italic">"{report.summary}"</p></div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                          <div><h3 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><Star size={12} fill="currentColor"/> Strengths</h3><ul className="space-y-3">{report.strengths.map((s, i) => (<li key={i} className="flex gap-3 text-sm font-bold text-slate-700"><CheckCircle className="text-emerald-500 shrink-0" size={18}/><span>{s}</span></li>))}</ul></div>
                          <div><h3 className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><BarChart3 size={12}/> Growth</h3><ul className="space-y-3">{report.areasForImprovement.map((a, i) => (<li key={i} className="flex gap-3 text-sm font-bold text-slate-700"><Zap className="text-amber-500 shrink-0" size={18}/><span>{a}</span></li>))}</ul></div>
                      </div>
                  </div>

                  <div className="space-y-6"><h3 className="text-xl font-bold text-white uppercase flex items-center gap-2 px-2"><GraduationCap className="text-indigo-400"/> Neural Growth Path</h3><MarkdownView content={report.learningMaterial} initialTheme={userProfile?.preferredReaderTheme || 'slate'} /></div>
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
