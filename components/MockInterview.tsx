
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MockInterviewRecording, TranscriptItem, CodeFile, UserProfile, Channel } from '../types';
import { ArrowLeft, Video, Mic, Monitor, Play, Save, Loader2, Search, Trash2, CheckCircle, X, Download, ShieldCheck, User, Users, Building, FileText, ChevronRight, Zap, SidebarOpen, SidebarClose, Code, MessageSquare, Sparkles, Languages, Clock, Camera, Bot, CloudUpload, Trophy, BarChart3, ClipboardCheck, Star, Upload, FileUp, Linkedin, FileCheck, Edit3, BookOpen, Lightbulb, Target, ListChecks, MessageCircleCode, GraduationCap, Lock, Globe } from 'lucide-react';
import { auth } from '../services/firebaseConfig';
import { saveInterviewRecording, getPublicInterviews, deleteInterview, updateUserProfile, uploadFileToStorage, getUserInterviews, updateInterviewMetadata } from '../services/firestoreService';
import { getDriveToken, connectGoogleDrive } from '../services/authService';
import { ensureCodeStudioFolder, uploadToDrive } from '../services/googleDriveService';
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
  learningMaterial: string; // Markdown
  todoList: string[];
}

export const MockInterview: React.FC<MockInterviewProps> = ({ onBack, userProfile, onStartLiveSession }) => {
  const [view, setView] = useState<'hub' | 'prep' | 'interview' | 'report' | 'archive'>('hub');
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
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  
  // Feedback Session State
  const [isFeedbackSessionActive, setIsFeedbackSessionActive] = useState(false);

  const liveServiceRef = useRef<GeminiLiveService | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoBlobRef = useRef<Blob | null>(null);
  const interviewIdRef = useRef(generateSecureId());
  
  // Ref for local camera stream to fix black box issue
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);

  const currentUser = auth?.currentUser;

  // Ensure camera feed is attached when view changes to 'interview'
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
      videoBlobRef.current = null;
      interviewIdRef.current = generateSecureId();

      try {
          // 1. Generate Problem First
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

          // 2. Setup Recording & Video Feedback
          const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          
          activeStreamRef.current = camStream;

          const canvas = document.createElement('canvas');
          canvas.width = 1920; canvas.height = 1080;
          const ctx = canvas.getContext('2d')!;
          
          const camVideo = document.createElement('video');
          camVideo.srcObject = camStream; 
          camVideo.muted = true;
          camVideo.play();
          
          const screenVideo = document.createElement('video');
          screenVideo.srcObject = screenStream; 
          screenVideo.muted = true;
          screenVideo.play();
          
          const drawFrame = () => {
              // Only draw if we're in interview view or starting
              if (!isRecording && !isStarting) return;
              ctx.fillStyle = '#020617';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(screenVideo, 0, 0, 1920, 1080);
              
              // Floating cam overlay
              ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 10;
              ctx.strokeRect(1500, 750, 380, 280);
              ctx.drawImage(camVideo, 1500, 750, 380, 280);
              
              requestAnimationFrame(drawFrame);
          };
          
          const combinedStream = canvas.captureStream(30);
          camStream.getAudioTracks().forEach(track => combinedStream.addTrack(track));
          
          const recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm' });
          const chunks: Blob[] = [];
          recorder.ondataavailable = e => chunks.push(e.data);
          recorder.onstop = () => { videoBlobRef.current = new Blob(chunks, { type: 'video/webm' }); };
          mediaRecorderRef.current = recorder;
          
          // Switch to interview view first so element exists
          setView('interview');
          recorder.start();
          setIsRecording(true);
          requestAnimationFrame(drawFrame);
          
          // 3. Connect AI with ACTIVE LISTENING protocols
          const persona = mode === 'coding' ? 'Senior Technical Interviewer' : mode === 'system_design' ? 'Principal System Architect' : 'Hiring Manager';
          const prompt = `You are a world-class ${persona}. 
          MISSION: Conduct a team-collaboration mock interview.
          
          ACTIVE LISTENING PROTOCOL:
          - DO NOT let the conversation go cold. If the user stops talking for a few seconds, provide a short verbal acknowledgment like "I see," "Go on," or "Okay, that makes sense."
          - If the user is silent for more than 7 seconds, ask a checking question: "Are you still working through that logic?" or "Would you like a hint on this part?"
          - Explicitly check for completion: "Are you done with this part, or should we keep refining it before moving on?"
          - NEVER repeat the same filler word twice in a row.
          
          PHASES:
          1. INTRO: Start with a quick mutual introduction. Mention you are here as a peer/team-mate.
          2. PROBLEM: Tell the candidate you have pre-filled the problem in their Code Studio. Briefly summarize it.
          3. COLLABORATE: Act as a peer. Monitor their progress.
          4. WRAP UP: Thank them at the end.
          
          GUIDELINES:
          - DO NOT output one word per line. Use natural, complete sentences.
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
          setView('prep');
      } finally {
          setIsStarting(false);
      }
  };

  const handleEndInterview = async () => {
      mediaRecorderRef.current?.stop();
      liveServiceRef.current?.disconnect();
      setIsRecording(false);
      
      // Stop stream tracks
      activeStreamRef.current?.getTracks().forEach(t => t.stop());
      activeStreamRef.current = null;
      
      setIsGeneratingReport(true);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const transcriptText = transcript.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n');
          
          const reportPrompt = `
            Analyze this mock interview transcript and generate a detailed performance report.
            
            JOB CONTEXT: ${jobDesc}
            TRANSCRIPT:
            ${transcriptText}
            
            RESPOND ONLY IN JSON FORMAT with this schema:
            {
              "score": number,
              "technicalSkills": "string",
              "communication": "string",
              "collaboration": "string",
              "strengths": ["string"],
              "areasForImprovement": ["string"],
              "verdict": "Strong Hire" | "Hire" | "No Hire" | "Strong No Hire",
              "summary": "string",
              "idealAnswers": [
                { "question": "Key question asked", "expectedAnswer": "A strong model answer", "rationale": "Why this is good" }
              ],
              "learningMaterial": "Markdown content explaining technical topics and gaps",
              "todoList": ["Action item 1", "Action item 2"]
            }
          `;

          const response = await ai.models.generateContent({
              model: 'gemini-3-pro-preview',
              contents: reportPrompt,
              config: { responseMimeType: 'application/json' }
          });

          const reportData = JSON.parse(response.text || '{}') as InterviewReport;
          setReport(reportData);
          setView('report');

          // Wait for video blob to finalize
          let attempts = 0;
          while (!videoBlobRef.current && attempts < 50) {
              await new Promise(r => setTimeout(r, 100));
              attempts++;
          }
          await finalizeAndSave(videoBlobRef.current || new Blob([], { type: 'video/webm' }), reportData);
      } catch (e) {
          console.error("Report generation failed", e);
          setView('hub');
      } finally {
          setIsGeneratingReport(false);
      }
  };

  const startCoachingSession = async () => {
      if (!report) return;
      setIsFeedbackSessionActive(true);
      
      const coachPrompt = `
        You are now the "Neural Career Coach". 
        CONTEXT: You just finished a mock interview for the user. 
        PERFORMANCE SUMMARY: ${report.summary}
        SCORE: ${report.score}/100
        VERDICT: ${report.verdict}
        STRENGTHS: ${report.strengths.join(', ')}
        IMPROVEMENTS: ${report.areasForImprovement.join(', ')}
        LEARNING PATH: ${report.learningMaterial}
        
        MISSION:
        1. Vocally walk the user through their report. 
        2. Congratulate them on their strengths.
        3. TEACH them how to perform better next time. Specifically explain the concepts in the "Learning Path".
        4. Answer their questions about the feedback.
        5. Stay encouraging and professional.
        
        GUIDELINES:
        - Speak naturally. No "one word per line".
        - Be a mentor, not just a judge.
      `;

      try {
          const service = new GeminiLiveService();
          liveServiceRef.current = service;
          await service.connect('Zephyr', coachPrompt, {
              onOpen: () => {},
              onClose: () => setIsFeedbackSessionActive(false),
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
      } catch (e) {
          alert("Coaching session failed to start.");
          setIsFeedbackSessionActive(false);
      }
  };

  const finalizeAndSave = async (videoBlob: Blob, finalReport: InterviewReport) => {
      setIsUploading(true);
      try {
          const token = getDriveToken() || await connectGoogleDrive();
          const folderId = await ensureCodeStudioFolder(token);
          const driveId = await uploadToDrive(token, folderId, `Interview_${new Date().toISOString()}.webm`, videoBlob);
          
          // CRITICAL: Ensure only plain data is sent to save function to avoid circular errors
          const recording: MockInterviewRecording = {
              id: interviewIdRef.current,
              userId: currentUser?.uid || 'guest',
              userName: currentUser?.displayName || 'Candidate',
              userPhoto: currentUser?.photoURL || '',
              mode, language, jobDescription: jobDesc,
              timestamp: Date.now(),
              videoUrl: `drive://${driveId}`,
              transcript: transcript.map(t => ({ role: t.role, text: t.text, timestamp: t.timestamp })),
              feedback: JSON.stringify(finalReport),
              visibility: visibility
          };
          
          await saveInterviewRecording(recording);
          loadInterviews();
      } catch (e: any) {
          console.error("Sync failed", e);
      } finally {
          setIsUploading(false);
      }
  };

  const handleDeleteRecording = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (!confirm("Permanently delete this interview recording?")) return;
      try {
          await deleteInterview(id);
          setInterviews(prev => prev.filter(i => i.id !== id));
      } catch (err) {
          alert("Delete failed.");
      }
  };

  const handleToggleVisibility = async (e: React.MouseEvent, rec: MockInterviewRecording) => {
      e.stopPropagation();
      const newVisibility = rec.visibility === 'private' ? 'public' : 'private';
      try {
          await updateInterviewMetadata(rec.id, { visibility: newVisibility });
          setInterviews(prev => prev.map(i => i.id === rec.id ? { ...i, visibility: newVisibility } : i));
      } catch (err) {
          alert("Update failed.");
      }
  };

  const filteredInterviews = interviews.filter(i => 
    i.userName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    i.mode.includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden relative">
      {/* Header */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-20">
          <div className="flex items-center gap-4">
              <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                  <ArrowLeft size={20} />
              </button>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                  <Video className="text-red-500" />
                  Mock Interview Center
              </h1>
          </div>
          <div className="flex items-center gap-3">
              {view === 'hub' && (
                  <button onClick={() => setView('prep')} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-lg transition-all active:scale-95">
                      <Zap size={14}/>
                      <span>Start New Session</span>
                  </button>
              )}
              {view === 'interview' && (
                  <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 px-3 py-1 bg-red-900/20 text-red-400 border border-red-500/20 rounded-full animate-pulse">
                          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                          <span className="text-xs font-black uppercase tracking-widest">LIVE RECORDING</span>
                      </div>
                      <button onClick={handleEndInterview} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold shadow-lg">
                          End Interview
                      </button>
                  </div>
              )}
              {view === 'report' && (
                  <button onClick={() => setView('hub')} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold">
                      Back to Dashboard
                  </button>
              )}
          </div>
      </header>

      <main className="flex-1 overflow-y-auto scrollbar-hide">
          {view === 'hub' && (
              <div className="max-w-6xl mx-auto p-8 space-y-10 animate-fade-in">
                  <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-slate-800 pb-8">
                      <div>
                          <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase mb-2">Interview Archives</h2>
                          <p className="text-slate-400 max-w-xl">Review past performance metrics and AI generated growth paths.</p>
                      </div>
                      <div className="relative w-full md:w-80">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16}/>
                          <input 
                            type="text" 
                            placeholder="Search by candidate or mode..." 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                          />
                      </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {loading ? <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin mx-auto text-indigo-400" size={40}/></div> : filteredInterviews.length === 0 ? (
                          <div className="col-span-full py-32 text-center text-slate-500 bg-slate-900/20 border-2 border-dashed border-slate-800 rounded-[3rem] space-y-4">
                              <Video size={48} className="mx-auto opacity-20"/>
                              <p>No interviews in the archive yet.</p>
                          </div>
                      ) : filteredInterviews.map(rec => {
                          const isMine = currentUser && rec.userId === currentUser.uid;
                          return (
                          <div key={rec.id} className="bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden hover:border-indigo-500/50 transition-all group flex flex-col shadow-xl">
                              <div className="aspect-video relative bg-black">
                                  <div className="absolute inset-0 flex items-center justify-center">
                                      <Play size={40} className="text-white opacity-40 group-hover:opacity-100 transition-opacity" fill="white" />
                                  </div>
                                  <div className="absolute bottom-4 right-4 flex gap-2">
                                      {isMine && (
                                          <button 
                                            onClick={(e) => handleToggleVisibility(e, rec)}
                                            className={`bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black uppercase border border-white/10 tracking-widest flex items-center gap-1.5 transition-all hover:bg-white hover:text-black ${rec.visibility === 'private' ? 'text-amber-400' : 'text-emerald-400'}`}
                                          >
                                              {rec.visibility === 'private' ? <Lock size={10}/> : <Globe size={10}/>}
                                              {rec.visibility || 'public'}
                                          </button>
                                      )}
                                      <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black text-white uppercase border border-white/10 tracking-widest">VERIFIED</div>
                                  </div>
                                  {isMine && (
                                      <button 
                                        onClick={(e) => handleDeleteRecording(e, rec.id)}
                                        className="absolute top-4 right-4 p-2 bg-slate-900/80 rounded-lg text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                      >
                                          <Trash2 size={16}/>
                                      </button>
                                  )}
                              </div>
                              <div className="p-6 space-y-4 flex-1 flex flex-col">
                                  <div className="flex items-center gap-3">
                                      <img src={rec.userPhoto || `https://ui-avatars.com/api/?name=${rec.userName}`} className="w-10 h-10 rounded-full border-2 border-slate-800" />
                                      <div>
                                          <h3 className="font-bold text-white text-sm">@{rec.userName}</h3>
                                          <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{new Date(rec.timestamp).toLocaleDateString()}</p>
                                      </div>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                      <span className="text-[9px] font-black uppercase bg-indigo-900/20 text-indigo-400 px-3 py-1 rounded-full border border-indigo-500/30">{rec.mode.replace('_', ' ')}</span>
                                  </div>
                                  <div className="flex-1">
                                      <p className="text-xs text-slate-400 line-clamp-2 italic">"{rec.jobDescription}"</p>
                                  </div>
                                  <button onClick={() => {
                                      if (rec.feedback) {
                                          setReport(JSON.parse(rec.feedback));
                                          setView('report');
                                          interviewIdRef.current = rec.id;
                                      } else {
                                          alert("No report available for this recording.");
                                      }
                                  }} className="w-full py-3 bg-slate-800 hover:bg-indigo-600 text-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Review Report</button>
                              </div>
                          </div>
                      )})}
                  </div>
              </div>
          )}

          {view === 'prep' && (
              <div className="max-w-5xl mx-auto p-8 lg:p-20 animate-fade-in-up">
                  <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl space-y-10">
                      <div className="text-center">
                          <div className="w-16 h-16 bg-indigo-500/10 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-6"><Bot size={32}/></div>
                          <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">Interview Simulation Setup</h2>
                          <p className="text-slate-400 mt-2">Personalize the simulation to your target role and stack.</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                          <div className="space-y-6">
                              <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-6">
                                  <div className="flex items-center justify-between">
                                      <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2"><User size={14}/> Candidate Context</h3>
                                      {currentUser && (
                                          <button 
                                            onClick={handleLoadResumeFromProfile}
                                            className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600/10 text-indigo-300 border border-indigo-500/20 rounded-full text-[10px] font-black uppercase tracking-tighter hover:bg-indigo-600 hover:text-white transition-all"
                                          >
                                            <Linkedin size={10}/> From Profile
                                          </button>
                                      )}
                                  </div>

                                  <div className="flex gap-2">
                                      {['text', 'upload'].map((src) => (
                                          <button 
                                            key={src} 
                                            onClick={() => setResumeSource(src as any)}
                                            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase border transition-all ${resumeSource === src ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-500'}`}
                                          >
                                              {src === 'text' ? <Edit3 size={12} className="inline mr-1"/> : <FileUp size={12} className="inline mr-1"/>}
                                              {src} Resume
                                          </button>
                                      ))}
                                  </div>

                                  {resumeSource === 'text' || resumeSource === 'profile' ? (
                                      <textarea 
                                          value={resumeText} 
                                          onChange={e => { setResumeText(e.target.value); setResumeSource('text'); }} 
                                          placeholder="Summary of your experience..." 
                                          className="w-full h-40 bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                                      />
                                  ) : (
                                      <div 
                                        onClick={() => (document.getElementById('resume-input') as HTMLInputElement).click()}
                                        className={`w-full h-40 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-3 transition-all cursor-pointer ${isParsingFile === 'resume' ? 'border-indigo-500 bg-indigo-950/20' : 'border-slate-800 hover:border-indigo-500 bg-slate-900/50'}`}
                                      >
                                          {isParsingFile === 'resume' ? <Loader2 className="animate-spin text-indigo-400" size={32}/> : <Upload className="text-slate-600" size={32}/>}
                                          <p className="text-[10px] font-black text-slate-500 uppercase">Select PDF or TXT</p>
                                      </div>
                                  )}
                                  <input id="resume-input" type="file" className="hidden" accept=".pdf,.txt" onChange={e => handleFileUpload(e, 'resume')} />
                              </div>

                              <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-4">
                                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><ListChecks size={14}/> Interview Track</h3>
                                  <div className="grid grid-cols-1 gap-2">
                                      {['coding', 'system_design', 'behavioral'].map(m => (
                                          <button key={m} onClick={() => setMode(m as any)} className={`p-4 rounded-2xl border text-left flex items-center justify-between transition-all ${mode === m ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                                              <span className="text-xs font-bold uppercase tracking-wide">{m.replace('_', ' ')}</span>
                                              {mode === m && <CheckCircle size={16}/>}
                                          </button>
                                      ))}
                                  </div>
                              </div>
                          </div>

                          <div className="space-y-6">
                              <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-6">
                                  <div className="flex items-center justify-between">
                                      <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2"><Building size={14}/> Job Description</h3>
                                      <button onClick={() => (document.getElementById('jd-input') as HTMLInputElement).click()} className="text-[10px] font-black text-emerald-400 uppercase hover:underline">
                                          <FileUp size={10} className="inline mr-1"/> Upload
                                      </button>
                                  </div>
                                  <textarea 
                                      value={jobDesc} 
                                      onChange={e => setJobDesc(e.target.value)} 
                                      placeholder="Paste target JD here..." 
                                      className="w-full h-40 bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 focus:ring-1 focus:ring-emerald-500 outline-none resize-none"
                                  />
                                  <input id="jd-input" type="file" className="hidden" accept=".pdf,.txt" onChange={e => handleFileUpload(e, 'jd')} />

                                  {mode === 'coding' && (
                                      <div className="pt-2">
                                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">Preferred Language</label>
                                          <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 text-sm text-white outline-none focus:border-indigo-500">
                                              {['TypeScript', 'Python', 'C++', 'Java', 'Rust', 'Go'].map(l => <option key={l} value={l}>{l}</option>)}
                                          </select>
                                      </div>
                                  )}
                              </div>

                              <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-4">
                                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                      <Globe size={14}/> Archive Visibility
                                  </h3>
                                  <div className="grid grid-cols-2 gap-2">
                                      <button onClick={() => setVisibility('public')} className={`p-4 rounded-2xl border text-left flex items-center justify-between transition-all ${visibility === 'public' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                                          <div className="flex flex-col">
                                              <span className="text-xs font-bold uppercase">Public Gallery</span>
                                              <span className="text-[8px] opacity-60">Visible to all users</span>
                                          </div>
                                          {visibility === 'public' && <CheckCircle size={16}/>}
                                      </button>
                                      <button onClick={() => setVisibility('private')} className={`p-4 rounded-2xl border text-left flex items-center justify-between transition-all ${visibility === 'private' ? 'bg-amber-600 border-amber-500 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                                          <div className="flex flex-col">
                                              <span className="text-xs font-bold uppercase">Private Solo</span>
                                              <span className="text-[8px] opacity-60">Visible only to me</span>
                                          </div>
                                          {visibility === 'private' && <CheckCircle size={16}/>}
                                      </button>
                                  </div>
                              </div>

                              <div className="p-6 bg-indigo-900/10 border border-indigo-500/20 rounded-3xl flex gap-4">
                                  <Sparkles className="text-indigo-400 shrink-0" size={24}/>
                                  <p className="text-xs text-indigo-200 leading-relaxed">
                                      <strong>Collaborative Engine:</strong> The AI will present a specific problem in your Code Studio. Use the editor to code while explaining your thoughts vocally.
                                  </p>
                              </div>
                          </div>
                      </div>

                      <div className="pt-8 border-t border-slate-800 flex justify-end">
                          <button 
                            onClick={handleStartInterview} 
                            disabled={isStarting || !jobDesc.trim()} 
                            className="px-12 py-5 bg-gradient-to-r from-red-600 to-indigo-600 text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl transition-all hover:scale-105 active:scale-95 disabled:opacity-30"
                          >
                              {isStarting ? <Loader2 className="animate-spin" /> : 'Enter Studio & Start Recording'}
                          </button>
                      </div>
                  </div>
              </div>
          )}

          {view === 'interview' && (
              <div className="h-full flex overflow-hidden relative">
                  <div className={`flex flex-col border-r border-slate-800 transition-all ${isCodeStudioOpen ? 'w-[400px]' : 'flex-1'}`}>
                      <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                              <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400"><Bot size={20}/></div>
                              <span className="font-bold text-white uppercase tracking-tighter">AI Interviewer</span>
                          </div>
                          <button onClick={() => setIsCodeStudioOpen(!isCodeStudioOpen)} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                              <Code size={16}/>
                              <span>{isCodeStudioOpen ? 'Video Only' : 'Open Workspace'}</span>
                          </button>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                          {transcript.map((item, idx) => (
                              <div key={idx} className={`flex flex-col ${item.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in-up`}>
                                  <span className={`text-[9px] uppercase font-black tracking-widest mb-1 ${item.role === 'user' ? 'text-emerald-400' : 'text-indigo-400'}`}>
                                      {item.role === 'user' ? 'Candidate' : 'Interviewer'}
                                  </span>
                                  <div className={`max-w-[90%] px-5 py-3 rounded-2xl text-sm leading-relaxed shadow-lg ${item.role === 'user' ? 'bg-emerald-600 text-white rounded-tr-sm' : 'bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700'}`}>
                                      {item.text}
                                  </div>
                              </div>
                          ))}
                      </div>

                      <div className="p-6 bg-slate-900 border-t border-slate-800 flex items-center gap-4">
                          <div className="flex-1 bg-slate-950 rounded-2xl border border-slate-800 p-4 flex items-center gap-3">
                              <Mic size={20} className="text-red-500 animate-pulse"/>
                              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Voice Linked • Active Listening Enabled</p>
                          </div>
                      </div>
                  </div>

                  {isCodeStudioOpen && (
                      <div className="flex-1 flex flex-col bg-slate-950 animate-fade-in">
                          <CodeStudio 
                            onBack={() => setIsCodeStudioOpen(false)} 
                            currentUser={currentUser} 
                            userProfile={userProfile} 
                            onSessionStart={() => {}} 
                            onSessionStop={() => {}} 
                            onStartLiveSession={onStartLiveSession}
                            initialFiles={initialStudioFiles}
                          />
                      </div>
                  )}

                  {/* Camera Feedback: Fixed with useRef and playsInline */}
                  <div className="absolute bottom-24 right-8 w-64 aspect-video rounded-3xl overflow-hidden border-4 border-slate-800 shadow-2xl z-50 group bg-black">
                      <video 
                        ref={localVideoRef}
                        autoPlay 
                        muted 
                        playsInline 
                        className="w-full h-full object-cover" 
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <Camera size={24} className="text-white opacity-60"/>
                      </div>
                  </div>
              </div>
          )}

          {view === 'report' && report && (
              <div className="max-w-4xl mx-auto p-8 animate-fade-in-up space-y-8 pb-32">
                  {/* Report Header */}
                  <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl text-center relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-20 bg-indigo-500/10 blur-[100px] rounded-full"></div>
                      <div className="relative z-10 flex flex-col items-center">
                          <Trophy className="text-amber-500 mb-4" size={64}/>
                          <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-2">Performance Report</h2>
                          <div className="flex flex-wrap items-center justify-center gap-4 mt-6">
                              <div className="px-6 py-3 bg-slate-950 rounded-2xl border border-slate-800">
                                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Global Score</p>
                                  <p className="text-3xl font-black text-indigo-400">{report.score}/100</p>
                              </div>
                              <div className="px-6 py-3 bg-slate-950 rounded-2xl border border-slate-800">
                                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Neural Verdict</p>
                                  <p className={`text-xl font-black uppercase tracking-widest ${report.verdict.includes('Strong') ? 'text-emerald-400' : 'text-amber-400'}`}>{report.verdict}</p>
                              </div>
                          </div>
                          
                          {/* Neural Coaching Toggle */}
                          <div className="mt-8">
                             <button 
                                onClick={isFeedbackSessionActive ? () => liveServiceRef.current?.disconnect() : startCoachingSession}
                                className={`px-8 py-4 rounded-2xl font-black uppercase tracking-widest flex items-center gap-3 transition-all shadow-2xl active:scale-95 ${isFeedbackSessionActive ? 'bg-red-600 text-white animate-pulse' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
                             >
                                {isFeedbackSessionActive ? <X size={20}/> : <MessageCircleCode size={20} />}
                                <span>{isFeedbackSessionActive ? 'Stop Coaching Session' : 'Voice Coaching: Review Feedback'}</span>
                             </button>
                             <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-3">Let the AI explain the gaps and teach you the missed concepts</p>
                          </div>
                      </div>
                  </div>

                  {/* Coaching Transcript (If active) */}
                  {isFeedbackSessionActive && (
                      <div className="bg-slate-900/50 border border-emerald-500/30 rounded-[2.5rem] p-8 animate-fade-in shadow-xl space-y-4">
                           <div className="flex items-center gap-2 mb-4">
                               <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
                               <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">Live Feedback Session Active</span>
                           </div>
                           <div className="max-h-64 overflow-y-auto space-y-4 scrollbar-hide">
                                {transcript.slice(-5).map((item, idx) => (
                                    <div key={idx} className={`flex flex-col ${item.role === 'user' ? 'items-end' : 'items-start'}`}>
                                        <span className={`text-[9px] uppercase font-bold mb-1 ${item.role === 'user' ? 'text-indigo-400' : 'text-emerald-400'}`}>{item.role === 'user' ? 'You' : 'Neural Coach'}</span>
                                        <div className={`max-w-[80%] px-4 py-2 rounded-xl text-sm ${item.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'}`}>{item.text}</div>
                                    </div>
                                ))}
                           </div>
                      </div>
                  )}

                  {/* Reference Answers Section */}
                  <div className="space-y-6">
                      <div className="flex items-center gap-2 px-2">
                          <Lightbulb className="text-amber-400" size={20}/>
                          <h3 className="text-xl font-bold text-white uppercase tracking-tight">Model Answers & Rationale</h3>
                      </div>
                      <div className="grid grid-cols-1 gap-6">
                          {report.idealAnswers?.map((item, i) => (
                              <div key={i} className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-4 hover:border-amber-500/30 transition-colors">
                                  <div>
                                      <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Question</span>
                                      <p className="text-white font-bold text-lg mt-1">{item.question}</p>
                                  </div>
                                  <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800">
                                      <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Strong Candidate Sample</span>
                                      <div className="text-slate-300 text-sm mt-3 leading-relaxed whitespace-pre-wrap italic">
                                          "{item.expectedAnswer}"
                                      </div>
                                  </div>
                                  <div className="flex gap-3 items-start px-2">
                                      <Target size={16} className="text-indigo-400 mt-1 shrink-0"/>
                                      <div>
                                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Why it works</span>
                                          <p className="text-slate-400 text-xs mt-1 leading-relaxed">{item.rationale}</p>
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>

                  {/* Growth Path & Material */}
                  <div className="space-y-6">
                      <div className="flex items-center gap-2 px-2">
                          <GraduationCap className="text-indigo-400" size={20}/>
                          <h3 className="text-xl font-bold text-white uppercase tracking-tight">Neural Growth Path</h3>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 md:p-12 shadow-2xl">
                          <div className="prose prose-invert prose-indigo max-w-none antialiased">
                              <MarkdownView content={report.learningMaterial} />
                          </div>
                      </div>
                  </div>

                  {/* Summary & Key Points */}
                  <div className="bg-white rounded-[3rem] p-12 text-slate-950 shadow-2xl space-y-10">
                      <div>
                          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Executive Summary</h3>
                          <p className="text-xl font-serif leading-relaxed text-slate-800 italic">"{report.summary}"</p>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                          <div>
                              <h3 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><Star size={12} fill="currentColor"/> Key Strengths</h3>
                              <ul className="space-y-3">
                                  {report.strengths.map((s, i) => (
                                      <li key={i} className="flex gap-3 text-sm font-bold text-slate-700"><CheckCircle className="text-emerald-500 shrink-0" size={18}/> <span>{s}</span></li>
                                  ))}
                              </ul>
                          </div>
                          <div>
                              <h3 className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><BarChart3 size={12}/> Growth Areas</h3>
                              <ul className="space-y-3">
                                  {report.areasForImprovement.map((a, i) => (
                                      <li key={i} className="flex gap-3 text-sm font-bold text-slate-700"><Zap className="text-amber-500 shrink-0" size={18}/> <span>{a}</span></li>
                                  ))}
                              </ul>
                          </div>
                      </div>

                      {report.todoList?.length > 0 && (
                          <div className="pt-8 border-t border-slate-100">
                              <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-4 flex items-center gap-2"><ListChecks size={14}/> Recommended Actions</h3>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  {report.todoList.map((todo, i) => (
                                      <div key={i} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 font-bold text-sm text-slate-700">
                                          <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center border border-slate-200 text-[10px]">{i+1}</div>
                                          {todo}
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>

                  {/* Archive Action */}
                  <div className="flex justify-center pt-8">
                      <div className="bg-slate-900 border border-slate-800 px-6 py-4 rounded-2xl flex items-center gap-4">
                          <div className="text-left">
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Share Verification UUID</p>
                              <code className="text-xs text-indigo-300 font-mono">{interviewIdRef.current}</code>
                          </div>
                          <button onClick={() => {
                              navigator.clipboard.writeText(interviewIdRef.current);
                              alert("UUID Copied to Clipboard");
                          }} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"><ClipboardCheck size={20}/></button>
                      </div>
                  </div>
              </div>
          )}
      </main>

      {(isUploading || isGeneratingReport) && (
          <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center gap-4 animate-fade-in">
              <div className="relative">
                  <div className="w-24 h-24 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                  {isGeneratingReport ? (
                      <BarChart3 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-400" size={32}/>
                  ) : (
                      <CloudUpload className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-400" size={32}/>
                  )}
              </div>
              <h3 className="text-xl font-bold text-white uppercase tracking-tighter">
                  {isGeneratingReport ? 'Analyzing Session' : 'Syncing Record'}
              </h3>
              <p className="text-sm text-slate-400">
                  {isGeneratingReport ? 'Generating performance metrics and growth path...' : 'Moving verified simulation to Google Drive...'}
              </p>
          </div>
      )}
    </div>
  );
};
