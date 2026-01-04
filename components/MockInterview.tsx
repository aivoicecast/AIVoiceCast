
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MockInterviewRecording, TranscriptItem, CodeFile, UserProfile, Channel } from '../types';
import { ArrowLeft, Video, Mic, Monitor, Play, Save, Loader2, Search, Trash2, CheckCircle, X, Download, ShieldCheck, User, Users, Building, FileText, ChevronRight, Zap, SidebarOpen, SidebarClose, Code, MessageSquare, Sparkles, Languages, Clock, Camera, Bot, CloudUpload, Trophy, BarChart3, ClipboardCheck, Star, Upload, FileUp, Linkedin, FileCheck, Edit3, BookOpen, Lightbulb } from 'lucide-react';
import { auth } from '../services/firebaseConfig';
import { saveInterviewRecording, getPublicInterviews, deleteInterview, updateUserProfile, uploadFileToStorage } from '../services/firestoreService';
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
  learningMaterial: string; // Markdown formatted
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

  const liveServiceRef = useRef<GeminiLiveService | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoBlobRef = useRef<Blob | null>(null);
  const interviewIdRef = useRef(generateSecureId());

  const currentUser = auth?.currentUser;

  useEffect(() => {
    loadInterviews();
  }, []);

  const loadInterviews = async () => {
    setLoading(true);
    try {
      const data = await getPublicInterviews();
      setInterviews(data);
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
                  { text: "Extract and summarize the text from this document. If it is a resume, provide a technical summary of skills and experience. If it is a job description, provide the core requirements and responsibilities. Respond with text ONLY." }
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
          if (type === 'resume') {
              setResumeText(text);
          } else {
              setJobDesc(text);
          }
      } catch (err) {
          alert("Neural parsing failed for this file type. Please try pasting the text manually.");
      } finally {
          setIsParsingFile(null);
      }
  };

  const handleLoadResumeFromProfile = () => {
      if (userProfile?.resumeText) {
          setResumeText(userProfile.resumeText);
          setResumeSource('profile');
      } else {
          alert("No resume found in your profile. Please go to Settings to upload one.");
      }
  };

  const handleStartInterview = async () => {
      setIsStarting(true);
      setTranscript([]);
      setReport(null);
      videoBlobRef.current = null;
      interviewIdRef.current = generateSecureId();

      try {
          const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          
          const videoFeedback = document.getElementById('local-camera-feedback') as HTMLVideoElement;
          if (videoFeedback) videoFeedback.srcObject = camStream;

          const canvas = document.createElement('canvas');
          canvas.width = 1920; canvas.height = 1080;
          const ctx = canvas.getContext('2d')!;
          
          const camVideo = document.createElement('video');
          camVideo.srcObject = camStream; camVideo.play();
          const screenVideo = document.createElement('video');
          screenVideo.srcObject = screenStream; screenVideo.play();
          
          const drawFrame = () => {
              if (view !== 'interview' && !isStarting) return;
              ctx.fillStyle = '#020617';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(screenVideo, 0, 0, 1920, 1080);
              ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 10;
              ctx.strokeRect(1500, 750, 380, 280);
              ctx.drawImage(camVideo, 1500, 750, 380, 280);
              if (view === 'interview' || isStarting) requestAnimationFrame(drawFrame);
          };
          requestAnimationFrame(drawFrame);
          
          const combinedStream = canvas.captureStream(30);
          camStream.getAudioTracks().forEach(track => combinedStream.addTrack(track));
          
          const recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm' });
          const chunks: Blob[] = [];
          recorder.ondataavailable = e => chunks.push(e.data);
          recorder.onstop = () => {
              videoBlobRef.current = new Blob(chunks, { type: 'video/webm' });
          };
          mediaRecorderRef.current = recorder;
          recorder.start();
          setIsRecording(true);

          // Prepare Initial Files for CodeStudio
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const questionPrompt = `Generate a technical ${mode} question based on this job description: ${jobDesc}. Return ONLY the Markdown text of the question.`;
          const questionResponse = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: questionPrompt });
          const questionMarkdown = questionResponse.text || "Loading question...";

          const files: CodeFile[] = [
              { name: 'Question.md', path: 'mock://question', content: questionMarkdown, language: 'markdown', loaded: true, isDirectory: false, isModified: false },
              { name: mode === 'coding' ? `solution.${language.toLowerCase()}` : 'design.draw', path: 'mock://work', content: '', language: mode === 'coding' ? language.toLowerCase() as any : 'whiteboard', loaded: true, isDirectory: false, isModified: false }
          ];
          setInitialStudioFiles(files);
          
          const persona = mode === 'coding' ? 'Senior Technical Interviewer' : mode === 'system_design' ? 'Principal System Architect' : 'Strategic Hiring Manager';
          const modeInstruction = mode === 'coding' 
            ? `Your goal is a CODING INTERVIEW. Present a specific data structure or algorithm problem. Refer them to the "Question.md" file I just opened in the Code Studio. Tell them to write code in the solution file.`
            : mode === 'system_design' 
            ? "Your goal is a SYSTEM DESIGN INTERVIEW. Refer them to the " + (mode === 'coding' ? 'Solution' : 'Design') + " tab and explain the scenario. Use the " + (mode === 'coding' ? 'Question.md' : 'Question.md') + " as a guide."
            : "Your goal is a BEHAVIORAL INTERVIEW. Focus on leadership and soft skills.";

          const prompt = `You are a world-class ${persona}. 
          MISSION: Conduct a peer-collaboration mock interview.
          ${modeInstruction}
          
          PHASES:
          1. INTRO: Start with a quick mutual introduction. Mention you are here as a peer/team-mate.
          2. PROBLEM: The problem is already visible in their Code Studio. Briefly introduce it vocally.
          3. COLLABORATE: Act as a peer. If the candidate is stuck, give a subtle hint. Test their learning capability.
          4. DEEP DIVE: Ask adaptive follow-up questions to test the limits of their knowledge.
          5. WRAP UP: At the end, thank them.
          
          GUIDELINES:
          - DO NOT print one word per line. Speak in full natural sentences. 
          - Be a peer. Collaborate.
          - Context: Job: ${jobDesc}, Candidate: ${resumeText}, Stack: ${language}.`;

          const service = new GeminiLiveService();
          liveServiceRef.current = service;
          // Specialized Voice Mapping: Interview uses Fenrir, Linux uses Puck
          const voiceToUse = mode === 'coding' ? 'Software Interview Voice gen-lang-client-0648937375' : 'Puck';

          await service.connect(voiceToUse, prompt, {
              onOpen: () => {},
              onClose: () => { if (view === 'interview') handleEndInterview(); },
              onError: (e) => console.error(e),
              onVolumeUpdate: () => {},
              onTranscript: (text, isUser) => {
                  setTranscript(prev => {
                      const role = isUser ? 'user' : 'ai';
                      if (prev.length > 0 && prev[prev.length - 1].role === role) {
                          const last = prev[prev.length - 1];
                          // Group text fragments into the same bubble for natural chat flow
                          return [...prev.slice(0, -1), { ...last, text: last.text + text }];
                      }
                      return [...prev, { role, text, timestamp: Date.now() }];
                  });
              }
          });

          setIsCodeStudioOpen(true);
          setView('interview');
      } catch (e) {
          console.error(e);
          alert("Permissions required for Mock Interview.");
      } finally {
          setIsStarting(false);
      }
  };

  const handleEndInterview = async () => {
      mediaRecorderRef.current?.stop();
      liveServiceRef.current?.disconnect();
      setIsRecording(false);
      
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
              "score": number (0-100),
              "technicalSkills": "string analysis of tech depth",
              "communication": "string analysis of communication",
              "collaboration": "string analysis of team work",
              "strengths": ["string", "string"],
              "areasForImprovement": ["string", "string"],
              "verdict": "Strong Hire" | "Hire" | "No Hire" | "Strong No Hire",
              "summary": "Detailed executive summary",
              "idealAnswers": [
                { "question": "Key question asked", "expectedAnswer": "A strong reference answer", "rationale": "Why this answer is considered strong" }
              ],
              "learningMaterial": "Markdown content explaining technical concepts they missed, with external references"
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

          // Wait for video blob to finalize and save to Firestore
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

  const finalizeAndSave = async (videoBlob: Blob, finalReport: InterviewReport) => {
      setIsUploading(true);
      try {
          const token = getDriveToken() || await connectGoogleDrive();
          const folderId = await ensureCodeStudioFolder(token);
          const driveId = await uploadToDrive(token, folderId, `Interview_${new Date().toISOString()}.webm`, videoBlob);
          
          const recording: MockInterviewRecording = {
              id: interviewIdRef.current,
              userId: currentUser?.uid || 'guest',
              userName: currentUser?.displayName || 'Candidate',
              userPhoto: currentUser?.photoURL || '',
              mode, language, jobDescription: jobDesc,
              timestamp: Date.now(),
              videoUrl: `drive://${driveId}`,
              transcript,
              feedback: JSON.stringify(finalReport)
          };
          
          await saveInterviewRecording(recording);
          loadInterviews();
      } catch (e: any) {
          console.error("Archive sync failed", e);
      } finally {
          setIsUploading(false);
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

      <main className="flex-1 overflow-y-auto">
          {view === 'hub' && (
              <div className="max-w-6xl mx-auto p-8 space-y-10 animate-fade-in">
                  <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-slate-800 pb-8">
                      <div>
                          <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase mb-2">Interview Archives</h2>
                          <p className="text-slate-400 max-w-xl">Watch and learn from community sessions. Use UUID for sharing specific reviews.</p>
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
                      ) : filteredInterviews.map(rec => (
                          <div key={rec.id} className="bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden hover:border-indigo-500/50 transition-all group flex flex-col shadow-xl">
                              <div className="aspect-video relative bg-black">
                                  <div className="absolute inset-0 flex items-center justify-center">
                                      <Play size={40} className="text-white opacity-40 group-hover:opacity-100 transition-opacity" fill="white" />
                                  </div>
                                  <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black text-white uppercase border border-white/10 tracking-widest">VERIFIED</div>
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
                                      {rec.language && <span className="text-[9px] font-black uppercase bg-emerald-900/20 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/30">{rec.language}</span>}
                                  </div>
                                  <div className="flex-1">
                                      <p className="text-xs text-slate-400 line-clamp-2 italic">"{rec.jobDescription}"</p>
                                      <code className="text-[9px] text-slate-600 block mt-2 font-mono">ID: {rec.id}</code>
                                  </div>
                                  <button onClick={() => {
                                      if (rec.feedback) {
                                          setReport(JSON.parse(rec.feedback));
                                          setView('report');
                                          interviewIdRef.current = rec.id;
                                      } else {
                                          alert("No report available for this older recording.");
                                      }
                                  }} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Review Report</button>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          )}

          {view === 'prep' && (
              <div className="max-w-5xl mx-auto p-8 lg:p-20 animate-fade-in-up">
                  <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl space-y-10">
                      <div className="text-center">
                          <div className="w-16 h-16 bg-indigo-500/10 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-6"><Bot size={32}/></div>
                          <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">Interview Simulation Setup</h2>
                          <p className="text-slate-400 mt-2">AI and Candidate will work as a team to solve problems. Peer mode enabled.</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                          <div className="space-y-6">
                              <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-6">
                                  <div className="flex items-center justify-between">
                                      <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2"><User size={14}/> Candidate Info</h3>
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
                                          placeholder="Brief summary of your experience or paste full resume text..." 
                                          className="w-full h-40 bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                                      />
                                  ) : (
                                      <div 
                                        onClick={() => (document.getElementById('prep-resume-upload') as HTMLInputElement).click()}
                                        className={`w-full h-40 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-3 transition-all cursor-pointer ${isParsingFile === 'resume' ? 'border-indigo-500 bg-indigo-950/20' : 'border-slate-800 hover:border-indigo-500 bg-slate-900/50'}`}
                                      >
                                          {isParsingFile === 'resume' ? (
                                              <Loader2 className="animate-spin text-indigo-400" size={32}/>
                                          ) : (
                                              <>
                                                <Upload className="text-slate-600" size={32}/>
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Select PDF or TXT</p>
                                              </>
                                          )}
                                      </div>
                                  )}
                                  <input id="prep-resume-upload" type="file" className="hidden" accept=".pdf,.txt" onChange={e => handleFileUpload(e, 'resume')} />
                              </div>

                              <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-4">
                                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                      <Settings2 size={14}/> Simulation Mode
                                  </h3>
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
                                      <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2"><Building size={14}/> Target Role</h3>
                                      <button 
                                        onClick={() => (document.getElementById('prep-jd-upload') as HTMLInputElement).click()}
                                        className="text-[10px] font-black text-emerald-400 uppercase hover:underline"
                                      >
                                          <FileUp size={10} className="inline mr-1"/> Upload JD
                                      </button>
                                  </div>

                                  {isParsingFile === 'jd' ? (
                                      <div className="w-full h-40 bg-slate-900 rounded-2xl flex flex-col items-center justify-center gap-2 border border-slate-800">
                                          <Loader2 className="animate-spin text-emerald-400" size={32}/>
                                          <span className="text-[10px] font-black text-slate-500 uppercase">Reading File...</span>
                                      </div>
                                  ) : (
                                      <textarea 
                                          value={jobDesc} 
                                          onChange={e => setJobDesc(e.target.value)} 
                                          placeholder="Paste the job description or specific role details here..." 
                                          className="w-full h-40 bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 focus:ring-1 focus:ring-emerald-500 outline-none resize-none"
                                      />
                                  )}
                                  <input id="prep-jd-upload" type="file" className="hidden" accept=".pdf,.txt" onChange={e => handleFileUpload(e, 'jd')} />

                                  {mode === 'coding' && (
                                      <div className="pt-2">
                                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">Preferred Stack</label>
                                          <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-sm text-white outline-none focus:border-indigo-500">
                                              {['TypeScript', 'Python', 'C++', 'Java', 'Rust', 'Go'].map(l => <option key={l} value={l}>{l}</option>)}
                                          </select>
                                      </div>
                                  )}
                              </div>

                              <div className="p-6 bg-indigo-900/10 border border-indigo-500/20 rounded-3xl">
                                  <div className="flex gap-4">
                                      <Sparkles className="text-indigo-400 shrink-0" size={24}/>
                                      <p className="text-xs text-indigo-200 leading-relaxed">
                                          <strong>Collaborative Mode:</strong> AI will open a shared workspace. You can code or draw together while communicating vocally.
                                      </p>
                                  </div>
                              </div>
                          </div>
                      </div>

                      <div className="pt-8 border-t border-slate-800 flex justify-end items-center gap-6">
                          <button 
                            onClick={handleStartInterview} 
                            disabled={isStarting || !jobDesc.trim()} 
                            className="px-12 py-5 bg-gradient-to-r from-red-600 to-indigo-600 text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:grayscale"
                          >
                              {isStarting ? <Loader2 className="animate-spin" /> : 'Authorize & Start Simulation'}
                          </button>
                      </div>
                  </div>
              </div>
          )}

          {view === 'interview' && (
              <div className="h-full flex overflow-hidden">
                  {/* Left: Communication Area */}
                  <div className={`flex flex-col border-r border-slate-800 transition-all ${isCodeStudioOpen ? 'w-[400px]' : 'flex-1'}`}>
                      <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                              <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400"><Bot size={20}/></div>
                              <span className="font-bold text-white uppercase tracking-tighter">Peer AI Interviewer</span>
                          </div>
                          <button onClick={() => setIsCodeStudioOpen(!isCodeStudioOpen)} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                              <Code size={16}/>
                              <span>{isCodeStudioOpen ? 'Show Video' : 'Workspace'}</span>
                          </button>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                          {transcript.map((item, idx) => (
                              <div key={idx} className={`flex flex-col ${item.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in-up`}>
                                  <span className={`text-[9px] uppercase font-black tracking-widest mb-1 ${item.role === 'user' ? 'text-emerald-400' : 'text-indigo-400'}`}>
                                      {item.role === 'user' ? 'You' : 'Interviewer'}
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
                              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Voice Linked • Collaborate Now</p>
                          </div>
                      </div>
                  </div>

                  {/* Right: CodeStudio Integration */}
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

                  {/* Overlay Video Feedback */}
                  <div className="absolute bottom-24 right-8 w-64 aspect-video rounded-3xl overflow-hidden border-4 border-slate-800 shadow-2xl z-50 group">
                      <video id="local-camera-feedback" autoPlay muted playsInline className="w-full h-full object-cover bg-black" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
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
                      <div className="relative z-10">
                          <Trophy className="mx-auto text-amber-500 mb-4" size={64}/>
                          <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-2">Performance Report</h2>
                          <div className="flex items-center justify-center gap-4 mt-6">
                              <div className="px-6 py-3 bg-slate-950 rounded-2xl border border-slate-800">
                                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Overall Score</p>
                                  <p className="text-3xl font-black text-indigo-400">{report.score}/100</p>
                              </div>
                              <div className="px-6 py-3 bg-slate-950 rounded-2xl border border-slate-800">
                                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Hiring Verdict</p>
                                  <p className={`text-xl font-black uppercase tracking-widest ${report.verdict.includes('Strong') ? 'text-emerald-400' : 'text-amber-400'}`}>{report.verdict}</p>
                              </div>
                          </div>
                      </div>
                  </div>

                  {/* Skills Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
                          <div className="flex items-center gap-3 text-indigo-400"><Code size={20}/><h3 className="font-bold uppercase tracking-widest text-xs">Technical Depth</h3></div>
                          <p className="text-sm text-slate-300 leading-relaxed">{report.technicalSkills}</p>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
                          <div className="flex items-center gap-3 text-emerald-400"><MessageSquare size={20}/><h3 className="font-bold uppercase tracking-widest text-xs">Communication</h3></div>
                          <p className="text-sm text-slate-300 leading-relaxed">{report.communication}</p>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
                          <div className="flex items-center gap-3 text-purple-400"><Users size={20}/><h3 className="font-bold uppercase tracking-widest text-xs">Collaboration</h3></div>
                          <p className="text-sm text-slate-300 leading-relaxed">{report.collaboration}</p>
                      </div>
                  </div>

                  {/* Reference Answers Section */}
                  <div className="space-y-6">
                      <div className="flex items-center gap-2 px-2">
                          <Lightbulb className="text-amber-400" size={20}/>
                          <h3 className="text-xl font-bold text-white uppercase tracking-tight">Reference Answers</h3>
                      </div>
                      <div className="grid grid-cols-1 gap-6">
                          {report.idealAnswers?.map((item, i) => (
                              <div key={i} className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-4 hover:border-amber-500/30 transition-colors">
                                  <div className="flex flex-col gap-1">
                                      <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Question</span>
                                      <p className="text-white font-bold">{item.question}</p>
                                  </div>
                                  <div className="flex flex-col gap-1 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                                      <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Model Candidate Answer</span>
                                      <p className="text-slate-300 text-sm italic">"{item.expectedAnswer}"</p>
                                  </div>
                                  <div className="flex flex-col gap-1">
                                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Rationale</span>
                                      <p className="text-slate-400 text-xs leading-relaxed">{item.rationale}</p>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>

                  {/* Learning & Reading Material */}
                  <div className="space-y-6">
                      <div className="flex items-center gap-2 px-2">
                          <BookOpen className="text-indigo-400" size={20}/>
                          <h3 className="text-xl font-bold text-white uppercase tracking-tight">Personalized Learning Path</h3>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-8 md:p-12 shadow-2xl">
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
                  {isGeneratingReport ? 'Analyzing Performance' : 'Syncing Simulation'}
              </h3>
              <p className="text-sm text-slate-400">
                  {isGeneratingReport ? 'Generating neural report and feedback scores...' : 'Moving verified session to your Google Drive...'}
              </p>
          </div>
      )}
    </div>
  );
};

interface Settings2IconProps { size?: number, className?: string }
const Settings2 = ({ size = 20, className = "" }: Settings2IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></svg>
);
