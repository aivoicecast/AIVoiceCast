
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
import { ArrowLeft, Video, Mic, Monitor, Play, Save, Loader2, Search, Trash2, CheckCircle, X, Download, ShieldCheck, User, Users, Building, FileText, ChevronRight, Zap, SidebarOpen, SidebarClose, Code, MessageSquare, Sparkles, Languages, Clock, Camera, Bot, CloudUpload, Trophy, BarChart3, ClipboardCheck, Star, Upload, FileUp, Linkedin, FileCheck, Edit3, BookOpen, Lightbulb, Target, ListChecks, MessageCircleCode, GraduationCap, Lock, Globe, ExternalLink, PlayCircle, RefreshCw, FileDown, Briefcase, Package, Code2, StopCircle, Youtube, AlertCircle, Eye, EyeOff, SaveAll, Wifi, WifiOff, Activity, ShieldAlert, Timer, FastForward, ClipboardList, Layers } from 'lucide-react';

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
  const [view, setView] = useState<'hub' | 'prep' | 'interview' | 'report'>('hub');
  const [interviews, setInterviews] = useState<MockInterviewRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAiConnected, setIsAiConnected] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);
  const [snapshotSaved, setSnapshotSaved] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);
  
  // Synthesis Progress State
  const [synthesisStep, setSynthesisStep] = useState<string>('');
  const [synthesisPercent, setSynthesisPercent] = useState(0);
  const synthesisIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Prep State
  const [mode, setMode] = useState<'coding' | 'system_design' | 'behavioral' | 'quick_screen' | 'assessment_30' | 'assessment_60'>('coding');
  const [language, setLanguage] = useState(userProfile?.defaultLanguage || 'TypeScript');
  const [jobDesc, setJobDesc] = useState('');
  const [resumeText, setResumeText] = useState(userProfile?.resumeText || '');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [youtubePrivacy, setYoutubePrivacy] = useState<'private' | 'unlisted' | 'public'>('unlisted');
  
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
  const [reportError, setReportError] = useState<string | null>(null);
  const [videoPlaybackUrl, setVideoPlaybackUrl] = useState<string | null>(null);
  const [generatedProblemMd, setGeneratedProblemMd] = useState('');
  const [isFeedbackSessionActive, setIsFeedbackSessionActive] = useState(false);
  const [isExportingBundle, setIsExportingBundle] = useState(false);

  const liveServiceRef = useRef<GeminiLiveService | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoBlobRef = useRef<Blob | null>(null);
  const interviewIdRef = useRef(generateSecureId());
  const isEndingRef = useRef(false);
  
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const activeScreenStreamRef = useRef<MediaStream | null>(null);

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

  const handleReconnectAi = async (isAuto = false) => {
      if (liveServiceRef.current) liveServiceRef.current.disconnect();
      setIsAiConnected(false);
      
      const historyText = transcript.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n');
      const persona = mode === 'coding' ? 'Senior Technical Interviewer' : mode === 'system_design' ? 'Principal System Architect' : mode === 'quick_screen' ? 'Technical Recruiter' : 'Hiring Manager';
      
      let timingInstruction = '';
      if (mode === 'coding') {
          timingInstruction = `
          STRICT INTERVIEW TIMELINE (45 Minutes Total):
          - 0-5m: Introduction.
          - 5-20m: PROBLEM 1 (LeetCode Medium). Get to coding immediately.
          - 20-40m: PROBLEM 2 or Complex Follow-up.
          - 40-45m: Closing & Q&A.
          `;
      } else if (mode === 'system_design') {
          timingInstruction = `
          STRICT SYSTEM DESIGN TIMELINE (45 Minutes Total):
          - 0-5m: Technical Introduction.
          - 5-20m: Clarifying Requirements & High-Level Design (APIs, DB Schema).
          - 20-30m: Deep Dive - Area 1 (e.g. Scaling, Concurrency).
          - 30-40m: Deep Dive - Area 2 (e.g. Failure Modes, Data Consistency).
          - 40-45m: Pros/Cons Trade-offs & Closing Summary.
          `;
      } else if (mode === 'quick_screen') {
          timingInstruction = `
          STRICT SCREENING TIMELINE (15 Minutes Total):
          - 0-3m: Fast Intro & Context.
          - 3-12m: Technical Capability & Fit Validation. Deeply probe experience matching the JD.
          - 12-15m: Conclusion. 
          `;
      } else if (mode === 'assessment_30') {
          timingInstruction = `
          STRICT ASSESSMENT PROCTORING (30 Minutes Total):
          - 0-5m: Rules & Problem Setup.
          - 5-25m: Independent Coding. You are an observer.
          - 25-30m: Final Review.
          `;
      } else if (mode === 'assessment_60') {
          timingInstruction = `
          STRICT ASSESSMENT PROCTORING (60 Minutes Total):
          - 0-5m: Rules & Problem Setup.
          - 5-55m: Independent Coding. Answer only procedural questions.
          - 55-60m: Final Review.
          `;
      }

      const prompt = `You are a world-class ${persona}. ${timingInstruction} MISSION: Pick up exactly where we left off. RESUMING MID-SESSION. Check the clock and transition immediately to the next phase based on history. Context: Job: ${jobDesc}, Candidate: ${resumeText}, Stack: ${language}.\n\nSESSION HISTORY:\n${historyText}`;

      const service = new GeminiLiveService();
      liveServiceRef.current = service;
      try {
          await service.connect(mode === 'behavioral' ? 'Zephyr' : 'Software Interview Voice gen-lang-client-0648937375', prompt, {
              onOpen: () => {
                  setIsAiConnected(true);
                  if (isAuto) setReconnectCount(prev => prev + 1);
              },
              onClose: () => { 
                  setIsAiConnected(false); 
                  if (!isEndingRef.current) setTimeout(() => handleReconnectAi(true), 2000);
              },
              onError: (e) => { 
                  console.error(e); 
                  setIsAiConnected(false); 
                  if (!isEndingRef.current) setTimeout(() => handleReconnectAi(true), 3000);
              },
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
      } catch (err) { 
          if (!isAuto) alert("Reconnection failed."); 
      }
  };

  const startCoachingSession = async () => {
    if (!report || !activeRecording) return;
    
    if (isFeedbackSessionActive && !isAiConnected) {
        // Reconnect logic
    } else if (isFeedbackSessionActive) {
        if (liveServiceRef.current) liveServiceRef.current.disconnect();
        if (activeRecording.id !== 'error') {
            await updateInterviewMetadata(activeRecording.id, { coachingTranscript });
        }
        setIsFeedbackSessionActive(false);
        return;
    }

    const coachingHistoryText = coachingTranscript.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n');
    const isAssessment = activeRecording.mode.startsWith('assessment');
    const coachingMission = isAssessment 
        ? "Conduct a focused 10-minute follow-up coaching session. Help the candidate improve their solution from the assessment."
        : "Act as a mentor based on this report.";

    const systemPrompt = `You are an expert Interview Coach. MISSION: ${coachingMission}
    REPORT: ${JSON.stringify(report)}
    PREVIOUS COACHING: ${coachingHistoryText}`;

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
    } catch(e) { alert("Coaching failed."); }
  };

  const handleStartInterview = async () => {
      setIsStarting(true);
      isEndingRef.current = false;
      setTranscript([]);
      setCoachingTranscript([]);
      setReport(null);
      setReportError(null);
      setActiveRecording(null);
      setVideoPlaybackUrl(null);
      videoBlobRef.current = null;
      interviewIdRef.current = generateSecureId();

      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          
          let scheduleMd = '';
          if (mode === 'coding') {
              scheduleMd = `
### 🕒 Coding Interview Timeline (45m)
- **00:00 - 05:00**: Technical Introduction & Background.
- **05:00 - 20:00**: **Problem 1: Algorithmic Logic (Medium)**.
- **20:00 - 40:00**: **Problem 2 or Optimization Follow-up**.
- **40:00 - 45:00**: Closing & Architecture Summary.
---
          `;
          } else if (mode === 'system_design') {
              scheduleMd = `
### 🕒 System Design Timeline (45m)
- **00:00 - 05:00**: Technical Introduction & Experience Overview.
- **05:00 - 20:00**: **Requirement Clarification & High-Level Architecture**.
- **20:00 - 30:00**: **Deep Dive: Primary Component/Area**.
- **30:00 - 40:00**: **Deep Dive: Secondary Component/Bottlenecks**.
- **40:00 - 45:00**: Trade-off Analysis & Summary.
---
          `;
          } else if (mode === 'quick_screen') {
              scheduleMd = `
### 🕒 Quick Screen Timeline (15m)
- **00:00 - 03:00**: Experience Context & High-Level Match.
- **03:00 - 12:00**: **Deep Strength Validation & Fit Probing**.
- **12:00 - 15:00**: Result Summary & Stage Conclusion.
---
              `;
          } else if (mode === 'assessment_30') {
              scheduleMd = `
### 🕒 Quick Assessment (30m)
- **00:00 - 05:00**: Context & Problem Rules.
- **05:00 - 25:00**: **Problem 1: Focused Implementation**.
- **25:00 - 30:00**: Final Code Review.
---
              `;
          } else if (mode === 'assessment_60') {
              scheduleMd = `
### 🕒 Technical Assessment (60m)
- **Problem Set 1**: Algorithm Challenge (25m).
- **Problem Set 2**: Practical Implementation (25m).
- **Final Sync**: Code Quality Review (10m).
---
              `;
          }

          const problemPrompt = `Job: ${jobDesc}. Mode: ${mode}. Language: ${language}. 
          Generate a challenging senior question in Markdown. 
          If CODING mode: Include a clear function interface in ${language}. Ensure the problems are LeetCode Medium/Hard level.
          If ASSESSMENT_30 mode: Provide EXACTLY ONE focused problem in the Problem.md.
          If ASSESSMENT_60 mode: Provide 2-3 problems in the Problem.md.
          If SYSTEM_DESIGN mode: Ask for a complete end-to-end design of a scalable service relevant to the job context.
          If QUICK_SCREEN mode: Provide a list of 5 targeted "hard-hitting" screening questions relevant to the Job Description and Resume.
          DO NOT include the timeline in your generation, I will add it manually.`;

          const probResponse = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: problemPrompt });
          const problemMarkdown = scheduleMd + (probResponse.text || "Problem loading...");
          setGeneratedProblemMd(problemMarkdown);

          const ext = language.toLowerCase().includes('py') ? 'py' : language.toLowerCase().includes('c++') ? 'cpp' : language.toLowerCase().includes('rust') ? 'rs' : 'ts';
          
          const files: CodeFile[] = [
              { name: 'Problem.md', path: 'mock://problem', content: problemMarkdown, language: 'markdown', loaded: true, isDirectory: false, isModified: false },
              { name: mode === 'coding' || mode.startsWith('assessment') ? `solution.${ext}` : 'architecture.draw', path: 'mock://work', content: '', language: mode === 'coding' || mode.startsWith('assessment') ? (language.toLowerCase() as any) : 'whiteboard', loaded: true, isDirectory: false, isModified: false }
          ];
          setInitialStudioFiles(files);

          const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          
          activeStreamRef.current = camStream;
          activeScreenStreamRef.current = screenStream;

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
          
          const recordingFinished = new Promise<Blob>((resolve) => {
              recorder.onstop = () => {
                  const blob = new Blob(chunks, { type: 'video/webm' });
                  videoBlobRef.current = blob;
                  resolve(blob);
              };
          });
          
          mediaRecorderRef.current = recorder;
          
          setView('interview');
          recorder.start(1000); 
          setIsRecording(true);
          
          const persona = mode === 'coding' ? 'Senior Technical Interviewer' : mode === 'system_design' ? 'Principal System Architect' : mode === 'quick_screen' ? 'High-Velocity Technical Recruiter' : mode.startsWith('assessment') ? 'Objective Technical Proctor' : 'Hiring Manager';
          
          let timingInstruction = '';
          if (mode === 'coding') {
              timingInstruction = `
              STRICT INTERVIEW TIMELINE (45 Minutes Total):
              - 0-5m: Introduction. Show the timeline to the user immediately in your first response.
              - 5-20m: PROBLEM 1 (LeetCode Medium). DO NOT spend more than 5 minutes on background. Pivot to the IDE.
              - 20-40m: PROBLEM 2 or follow-up.
              - 40-45m: Closing.`;
          } else if (mode === 'system_design') {
              timingInstruction = `
              STRICT SYSTEM DESIGN TIMELINE (45 Minutes Total):
              - 0-5m: Introduction. Mention the 45-minute schedule immediately.
              - 5-20m: Requirements Clarification & High-Level Design (API/Schema).
              - 20-30m: Deep Dive Area 1 (e.g. Scalability, Database choice).
              - 30-40m: Deep Dive Area 2 (e.g. Resiliency, Monitoring).
              - 40-45m: Trade-offs & Closing.`;
          } else if (mode === 'quick_screen') {
              timingInstruction = `
              STRICT 15-MINUTE SCREENING MISSION:
              - Goal: Validate if the candidate is underfit or overfit for the JD.
              - 0-3m: Quick experience pitch.
              - 3-12m: Probe specific high-impact moments from resume. Validate technical claims.
              - 12-15m: Wrap up.
              BE AGGRESSIVE WITH THE CLOCK. If they ramble, interrupt politely to stay on track.`;
          } else if (mode === 'assessment_30') {
              timingInstruction = `
              STRICT 30-MINUTE ASSESSMENT PROCTOR:
              - Present the 1 problem in the Problem.md. 
              - Inform the user that a 10-minute follow-up coaching session will follow the automated report.
              - Only speak for technical clarification or 10m/5m/1m time warnings.`;
          } else if (mode === 'assessment_60') {
              timingInstruction = `
              STRICT 60-MINUTE ASSESSMENT PROCTOR:
              - You are quiet. Present the 2-3 problems in the Problem.md. 
              - Tell the user to begin coding in the Solution file.
              - Inform the user that a 10-minute follow-up coaching session will follow the automated report.
              - Only speak to clarify ambiguity or warn about time remaining.`;
          }

          const prompt = `You are a world-class ${persona}. ${timingInstruction} MISSION: Conduct mock interview. Context: Job: ${jobDesc}, Candidate: ${resumeText}, Stack: ${language}.`;
          
          const service = new GeminiLiveService();
          liveServiceRef.current = service;
          await service.connect(mode === 'behavioral' ? 'Zephyr' : 'Software Interview Voice gen-lang-client-0648937375', prompt, {
              onOpen: () => setIsAiConnected(true),
              onClose: () => { 
                setIsAiConnected(false); 
                if (!isEndingRef.current) handleReconnectAi(true);
              },
              onError: (e) => { 
                console.error(e); 
                setIsAiConnected(false); 
                if (!isEndingRef.current) handleReconnectAi(true);
              },
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
          setIsCodeStudioOpen(mode !== 'quick_screen');
      } catch (e) {
          alert("Permissions required (Camera + Screen).");
          setView('hub');
      } finally { setIsStarting(false); }
  };

  const handleSaveSnapshot = async () => {
      if (transcript.length === 0) return;
      setIsSavingSnapshot(true);
      try {
          const recording: MockInterviewRecording = {
              id: interviewIdRef.current, 
              userId: currentUser?.uid || 'guest', 
              userName: currentUser?.displayName || 'Candidate', 
              userPhoto: currentUser?.photoURL || '',
              mode, language, jobDescription: jobDesc, timestamp: Date.now(), videoUrl: '',
              transcript: transcript.map(t => ({ role: t.role, text: t.text, timestamp: t.timestamp })),
              visibility: visibility
          };
          await saveInterviewRecording(recording);
          setSnapshotSaved(true);
          setTimeout(() => setSnapshotSaved(false), 2000);
      } catch (e) {
          console.error("Snapshot save failed", e);
      } finally {
          setIsSavingSnapshot(false);
      }
  };

  const startSmoothProgress = () => {
      if (synthesisIntervalRef.current) clearInterval(synthesisIntervalRef.current);
      setSynthesisPercent(0);
      synthesisIntervalRef.current = setInterval(() => {
          setSynthesisPercent(prev => {
              if (prev >= 98) return 98; // Stay near end until finalized
              return prev + (prev < 30 ? 2 : prev < 70 ? 1 : 0.5);
          });
      }, 150);
  };

  const handleEndInterview = async () => {
      if (transcript.length < 3) {
          alert("Not enough conversation captured to generate a report.");
          setView('hub');
          return;
      }

      isEndingRef.current = true;
      setIsGeneratingReport(true);
      setReportError(null);
      startSmoothProgress();
      
      // 1. Terminate Hardware Immediately
      setSynthesisStep('Shutting down neural link...');
      liveServiceRef.current?.disconnect();
      setIsRecording(false);
      activeStreamRef.current?.getTracks().forEach(t => t.stop());
      activeScreenStreamRef.current?.getTracks().forEach(t => t.stop());

      // 2. Finalize Video and Save Locally First (Safety Checkpoint)
      setSynthesisStep('Finalizing local video buffer...');
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          const blobPromise = new Promise<Blob>((resolve) => {
              const recorder = mediaRecorderRef.current!;
              recorder.onstop = () => {
                  const chunks = (recorder as any)._chunks || [];
                  resolve(new Blob(chunks, { type: 'video/webm' }));
              };
              recorder.stop();
          });
          videoBlobRef.current = await blobPromise;
          
          try {
              await saveLocalRecording({
                  id: interviewIdRef.current,
                  userId: currentUser?.uid || 'guest',
                  channelId: 'mock-interview',
                  channelTitle: `Mock Interview: ${jobDesc}`,
                  timestamp: Date.now(),
                  mediaUrl: URL.createObjectURL(videoBlobRef.current),
                  mediaType: 'video/webm',
                  transcriptUrl: '', 
                  blob: videoBlobRef.current
              });
          } catch (e) { console.warn("Local checkpoint failed."); }
      }
      
      setSynthesisStep('Synthesizing performance metrics...');
      
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const transcriptText = transcript.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n');
          
          let reportPrompt = `Analyze this interview transcript and provide a senior hiring panel report. 
          Respond with valid JSON only. 
          TRANSCRIPT: ${transcriptText}`;

          if (mode === 'quick_screen') {
              reportPrompt += `
              SPECIAL INSTRUCTION FOR QUICK SCREEN:
              1. Evaluate if candidate is 'underfit', 'overfit', or 'match' for the Job Description.
              2. Identify specific missing domain knowledge.
              3. Grade must be 'Move Forward' or 'Reject'.`;
          }

          const responsePromise = ai.models.generateContent({
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
                          collaboration: { type: Type.STRING },
                          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                          areasForImprovement: { type: Type.ARRAY, items: { type: Type.STRING } },
                          verdict: { type: Type.STRING },
                          summary: { type: Type.STRING },
                          idealAnswers: { 
                              type: Type.ARRAY, 
                              items: {
                                  type: Type.OBJECT,
                                  properties: {
                                      question: { type: Type.STRING },
                                      expectedAnswer: { type: Type.STRING },
                                      rationale: { type: Type.STRING }
                                  }
                              }
                          },
                          learningMaterial: { type: Type.STRING },
                          todoList: { type: Type.ARRAY, items: { type: Type.STRING } },
                          fitStatus: { type: Type.STRING },
                          missingKnowledge: { type: Type.ARRAY, items: { type: Type.STRING } }
                      },
                      required: ["score", "verdict", "summary", "strengths", "learningMaterial"]
                  }
              }
          });

          // UX Protection: Timeout after 45s
          const timeoutPromise = new Promise((_, r) => setTimeout(() => r(new Error("Analysis timeout")), 45000));
          const response = await Promise.race([responsePromise, timeoutPromise]) as any;

          setSynthesisStep('Finalizing neural growth path...');

          let jsonStr = (response.text || "{}").trim();
          if (jsonStr.includes('```')) jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();

          const reportData = JSON.parse(jsonStr) as InterviewReport;
          setReport(reportData);
          
          const recording: MockInterviewRecording = {
            id: interviewIdRef.current, userId: currentUser?.uid || 'guest', userName: currentUser?.displayName || 'Candidate', userPhoto: currentUser?.photoURL || '',
            mode, language, jobDescription: jobDesc, timestamp: Date.now(), videoUrl: '',
            transcript: transcript.map(t => ({ role: t.role, text: t.text, timestamp: t.timestamp })),
            feedback: JSON.stringify(reportData), visibility: visibility
          };
          
          // Background Broadcast
          if (videoBlobRef.current) {
            backgroundBroadcast(videoBlobRef.current, reportData, recording);
          } else {
            await saveInterviewRecording(recording);
          }

          setActiveRecording(recording);
          if (videoBlobRef.current) setVideoPlaybackUrl(URL.createObjectURL(videoBlobRef.current));
          
          if (synthesisIntervalRef.current) clearInterval(synthesisIntervalRef.current);
          setSynthesisPercent(100);
          setView('report');
      } catch (e: any) {
          console.error("Synthesis failed:", e);
          setReportError(e.message || "Unknown error during analysis.");
          if (synthesisIntervalRef.current) clearInterval(synthesisIntervalRef.current);
          
          const fallbackRec: MockInterviewRecording = {
            id: interviewIdRef.current, userId: currentUser?.uid || 'guest', userName: currentUser?.displayName || 'Candidate', userPhoto: currentUser?.photoURL || '',
            mode, language, jobDescription: jobDesc, timestamp: Date.now(), videoUrl: '',
            transcript: transcript.map(t => ({ role: t.role, text: t.text, timestamp: t.timestamp })),
            visibility: visibility
          };
          setActiveRecording(fallbackRec);
          if (videoBlobRef.current) setVideoPlaybackUrl(URL.createObjectURL(videoBlobRef.current));
          setView('report');
      } finally {
          setIsGeneratingReport(false);
      }
  };

  const backgroundBroadcast = async (blob: Blob, finalReport: InterviewReport, recording: MockInterviewRecording) => {
      setIsUploading(true);
      try {
          const token = getDriveToken() || await connectGoogleDrive();
          const videoId = await uploadToYouTube(token, blob, {
              title: `Mock Interview: ${jobDesc.substring(0, 50)}...`,
              description: `Automated Mock Interview Session.\nVerdict: ${finalReport.verdict}`,
              privacyStatus: youtubePrivacy
          });
          recording.videoUrl = getYouTubeVideoUrl(videoId);
          await saveInterviewRecording(recording);
          await deleteLocalRecording(recording.id);
      } catch (e) { 
          await saveInterviewRecording(recording);
      } finally {
          setIsUploading(false);
          loadInterviews();
      }
  };

  const handleViewArchiveItem = async (rec: MockInterviewRecording) => {
      setActiveRecording(rec);
      setReport(rec.feedback ? JSON.parse(rec.feedback) : null);
      setVideoPlaybackUrl(rec.videoUrl);
      setTranscript(rec.transcript || []);
      setCoachingTranscript(rec.coachingTranscript || []);
      setReportError(null);
      setView('report');
  };

  const renderVideoPlayer = () => {
    if (!videoPlaybackUrl) return (
        <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 gap-4">
            <PlayCircle size={64} className="opacity-20"/>
            <p className="text-sm font-bold uppercase tracking-widest">Local Buffer Ready</p>
        </div>
    );
    if (videoPlaybackUrl.includes('youtube.com')) {
        const videoId = videoPlaybackUrl.split('v=')[1];
        return <iframe src={getYouTubeEmbedUrl(videoId)} className="w-full h-full border-none" allowFullScreen />;
    }
    return <video src={videoPlaybackUrl} controls className="w-full h-full object-contain" />;
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden relative">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-20">
          <div className="flex items-center gap-4">
              <button onClick={() => view === 'hub' ? onBack() : setView('hub')} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                  <ArrowLeft size={20} />
              </button>
              <h1 className="text-lg font-bold text-white flex items-center gap-2"><Video className="text-red-500" /> Mock Interview</h1>
          </div>
          {view === 'interview' && (
              <div className="flex items-center gap-3">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${isAiConnected ? 'bg-emerald-900/20 border-emerald-500/30 text-emerald-400' : 'bg-red-900/20 border-red-500/30 text-red-400 animate-pulse'}`}>
                      {isAiConnected ? <Wifi size={14}/> : <WifiOff size={14}/>}
                      <span className="text-[10px] font-black uppercase tracking-widest">{isAiConnected ? 'Link Active' : 'Link Lost'}</span>
                  </div>
                  <button onClick={handleEndInterview} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold shadow-lg">End Session</button>
              </div>
          )}
          {view === 'report' && (
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
                          <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Recent Sessions</h3>
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
                                      <span className="text-[9px] font-black uppercase bg-indigo-900/20 text-indigo-400 px-3 py-1 rounded-full border border-indigo-500/30">{rec.mode.replace('_', ' ')}</span>
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
              <div className="max-w-5xl mx-auto p-12 animate-fade-in-up">
                  <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl space-y-10">
                      <div className="text-center"><h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">Simulation Setup</h2></div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                          <div className="space-y-6">
                              <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-4">
                                  <div className="flex items-center justify-between"><h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2"><User size={14}/> Candidate</h3><button onClick={handleLoadResumeFromProfile} className="text-[10px] font-black text-indigo-400 uppercase hover:underline">From Profile</button></div>
                                  <textarea value={resumeText} onChange={e => setResumeText(e.target.value)} placeholder="Paste resume summary..." className="w-full h-40 bg-slate-900 border border-slate-700 rounded-2xl p-4 text-xs text-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"/>
                              </div>
                              <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-4">
                                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Coding Language</h3>
                                  <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 text-xs font-bold text-white focus:ring-2 focus:ring-indigo-500 outline-none">
                                      {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                                  </select>
                              </div>
                          </div>
                          <div className="space-y-6">
                              <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-4"><h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2"><Building size={14}/> Job Context</h3><textarea value={jobDesc} onChange={e => setJobDesc(e.target.value)} placeholder="Paste Job Description..." className="w-full h-40 bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 focus:ring-1 focus:ring-emerald-500 outline-none resize-none"/></div>
                              <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-4">
                                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Interview Mode</h3>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {[
                                          { id: 'coding', icon: Code, label: 'Coding (45m)' },
                                          { id: 'system_design', icon: Layers, label: 'Sys Design (45m)' },
                                          { id: 'behavioral', icon: MessageSquare, label: 'Behavioral (30m)' },
                                          { id: 'quick_screen', icon: FastForward, label: 'Quick Screen (15m)' },
                                          { id: 'assessment_30', icon: ClipboardList, label: 'Assess (30m/1 Prob)' },
                                          { id: 'assessment_60', icon: ClipboardList, label: 'Assess (1hr/Multi)' }
                                      ].map(m => (
                                          <button key={m.id} onClick={() => setMode(m.id as any)} className={`p-4 rounded-2xl border text-left flex items-center justify-between transition-all ${mode === m.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                                              <div className="flex items-center gap-2">
                                                  <m.icon size={14}/>
                                                  <span className="text-[10px] font-bold uppercase">{m.label}</span>
                                              </div>
                                              {mode === m.id && <CheckCircle size={14}/>}
                                          </button>
                                      ))}
                                  </div>
                              </div>
                          </div>
                      </div>
                      <div className="pt-8 border-t border-slate-800 flex justify-end"><button onClick={handleStartInterview} disabled={isStarting || !jobDesc.trim()} className="px-12 py-5 bg-gradient-to-r from-red-600 to-indigo-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-2xl transition-all hover:scale-105 active:scale-95 disabled:opacity-30">{isStarting ? <Loader2 className="animate-spin" /> : 'Enter Simulation & Record'}</button></div>
                  </div>
              </div>
          )}

          {view === 'interview' && (
              <div className="h-full flex overflow-hidden relative">
                  {!isAiConnected && (
                      <div className="absolute inset-0 z-[100] bg-slate-950/60 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center animate-fade-in">
                          <div className="w-20 h-20 bg-amber-600/20 text-amber-500 rounded-3xl flex items-center justify-center mb-6 animate-pulse border border-amber-500/30">
                              <WifiOff size={40}/>
                          </div>
                          <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">Neural Link Interrupted</h2>
                          <p className="text-slate-300 mt-2 max-w-sm">The simulation is paused. We are automatically attempting to restore the link. Please wait before responding.</p>
                          <div className="flex items-center gap-2 mt-6 text-indigo-400">
                             <Loader2 size={16} className="animate-spin"/>
                             <span className="text-xs font-black uppercase tracking-widest">Restoring Signal...</span>
                          </div>
                      </div>
                  )}
                  <div className={`flex flex-col border-r border-slate-800 transition-all ${isCodeStudioOpen ? 'w-[400px]' : 'flex-1'}`}>
                      <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0"><span className="font-bold text-white uppercase tracking-tighter flex items-center gap-2"><Bot size={20} className="text-indigo-400"/> AI Panel</span><div className="flex gap-2">
                          <button onClick={handleSaveSnapshot} disabled={isSavingSnapshot} className={`p-2 rounded-lg text-xs font-bold uppercase flex items-center gap-1 transition-all ${snapshotSaved ? 'bg-emerald-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-indigo-400'}`}>
                              {isSavingSnapshot ? <Loader2 size={14} className="animate-spin"/> : snapshotSaved ? <CheckCircle size={14}/> : <SaveAll size={14}/>} 
                              {snapshotSaved ? 'Saved' : 'Snapshot'}
                          </button>
                          <button onClick={() => handleDownloadPdf(problemRef, 'Problem.pdf')} className="p-2 bg-slate-800 rounded-lg text-xs font-bold uppercase flex items-center gap-1"><FileDown size={14}/> PDF</button>
                          {mode !== 'quick_screen' && <button onClick={() => setIsCodeStudioOpen(!isCodeStudioOpen)} className="p-2 bg-slate-800 rounded-lg text-xs font-bold uppercase">{isCodeStudioOpen ? 'Hide' : 'Show'} Studio</button>}
                      </div></div>
                      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                          <div ref={problemRef} className="bg-[#020617] p-8 rounded-2xl border border-slate-800 mb-8"><h1 className="text-2xl font-black text-indigo-400 mb-4 uppercase">Challenge Overview</h1><MarkdownView content={generatedProblemMd} /></div>
                          <div className="space-y-4">
                              {transcript.map((item, idx) => (
                                  <div key={idx} className={`flex flex-col ${item.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in-up`}><span className={`text-[9px] uppercase font-black mb-1 ${item.role === 'user' ? 'text-emerald-400' : 'text-indigo-400'}`}>{item.role === 'user' ? 'You' : 'Interviewer'}</span><div className={`max-w-[90%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${item.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700'}`}>{item.text}</div></div>
                              ))}
                          </div>
                      </div>
                  </div>
                  {isCodeStudioOpen && <div className="flex-1 bg-slate-950"><CodeStudio onBack={() => setIsCodeStudioOpen(false)} currentUser={currentUser} userProfile={userProfile} onSessionStart={() => {}} onSessionStop={() => {}} onStartLiveSession={onStartLiveSession} initialFiles={initialStudioFiles}/></div>}
                  <div className="absolute bottom-12 right-8 w-64 aspect-video rounded-3xl overflow-hidden border-4 border-slate-800 shadow-2xl z-50 bg-black"><video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" /></div>
              </div>
          )}

          {view === 'report' && (
              <div className="max-w-4xl mx-auto p-8 animate-fade-in-up space-y-12 pb-32">
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
                            {report ? (
                                <>
                                    <div className="grid grid-cols-2 gap-10">
                                        <div className="bg-slate-900/50 p-10 rounded-[3rem] border border-white/10 text-center"><p className="text-xs text-slate-500 font-bold uppercase mb-2">Simulation Score</p><p className="text-7xl font-black text-indigo-400">{report.score}</p></div>
                                        <div className="bg-slate-900/50 p-10 rounded-[3rem] border border-white/10 text-center"><p className="text-xs text-slate-500 font-bold uppercase mb-2">Final Verdict</p><p className="text-3xl font-black text-emerald-400">{report.verdict}</p></div>
                                    </div>
                                    <p className="mt-10 text-xl font-serif italic text-slate-400 leading-relaxed">"{report.summary}"</p>
                                </>
                            ) : <p className="text-amber-400">Metrics not available.</p>}
                        </div>
                        <div className="pt-20 border-t border-white/5 text-center text-[10px] text-slate-600 uppercase tracking-widest font-black">AIVoiceCast Platform v4.2.0 • End of Bundle</div>
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl relative">
                      {isUploading && (
                          <div className="absolute top-4 right-4 z-10 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-full border border-indigo-500/30 flex items-center gap-2 animate-fade-in shadow-xl">
                              <Loader2 size={14} className="animate-spin text-indigo-400"/>
                              <Youtube className="text-red-500" size={14}/>
                              <span className="text-[10px] font-black text-white uppercase tracking-widest">YouTube Broadcast in Progress</span>
                          </div>
                      )}
                      <div className="aspect-video bg-black relative group">
                          {renderVideoPlayer()}
                      </div>
                      <div className="p-10 flex flex-col items-center text-center space-y-6" ref={reportRef}>
                          <Trophy className="text-amber-500" size={64}/><h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">Simulation Results</h2>
                          
                          {report ? (
                              <div className="flex gap-4">
                                <div className="px-8 py-4 bg-slate-950 rounded-2xl border border-slate-800">
                                    <p className="text-[10px] text-slate-500 font-bold uppercase">Score</p>
                                    <p className="text-4xl font-black text-indigo-400">{report.score}/100</p>
                                </div>
                                <div className="px-8 py-4 bg-slate-950 rounded-2xl border border-slate-800">
                                    <p className="text-[10px] text-slate-500 font-bold uppercase">Verdict</p>
                                    <p className={`text-xl font-black uppercase ${report.verdict.includes('Hire') || report.verdict.includes('Forward') ? 'text-emerald-400' : 'text-red-400'}`}>{report.verdict}</p>
                                </div>
                              </div>
                          ) : reportError ? (
                              <div className="bg-red-900/20 border border-red-900/50 p-6 rounded-2xl text-center">
                                  <ShieldAlert size={32} className="mx-auto text-red-500 mb-2"/>
                                  <p className="text-sm text-red-300 font-bold">Metrics Synthesis Error</p>
                                  <p className="text-xs text-slate-500 mt-1 max-w-xs">{reportError}</p>
                                  <button onClick={handleEndInterview} className="mt-4 px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-black uppercase">Retry Generation</button>
                              </div>
                          ) : (
                             <div className="flex flex-col items-center gap-3">
                                <Loader2 size={32} className="animate-spin text-indigo-500"/>
                                <p className="text-xs text-slate-500 font-black uppercase tracking-widest animate-pulse">Computing Score...</p>
                             </div>
                          )}

                          <div className="flex flex-col gap-3 w-full max-w-sm">
                              <button onClick={startCoachingSession} disabled={!report && !reportError} className={`px-10 py-5 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all ${isFeedbackSessionActive ? (isAiConnected ? 'bg-indigo-600' : 'bg-red-600 animate-pulse') : 'bg-emerald-600 hover:bg-emerald-500'} text-white shadow-2xl disabled:opacity-30`}>
                                  {isFeedbackSessionActive ? (isAiConnected ? <><StopCircle size={24}/> End Coaching</> : <><RefreshCw size={24} className="animate-spin"/> Resume AI</>) : <><MessageCircleCode size={24}/> {activeRecording?.mode.startsWith('assessment') ? 'Start 10m Follow-up Coaching' : 'Start Voice Coaching'}</>}
                              </button>
                          </div>
                      </div>
                  </div>

                  {report && (
                    <>
                        <div className="bg-white rounded-[3rem] p-12 text-slate-950 shadow-2xl space-y-10">
                            <div><h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Summary</h3><p className="text-xl font-serif leading-relaxed text-slate-800 italic">"{report.summary}"</p></div>
                            
                            {report.fitStatus && (
                                <div className="flex items-center gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                                    <div className={`p-3 rounded-xl ${report.fitStatus === 'match' ? 'bg-emerald-100 text-emerald-600' : report.fitStatus === 'overfit' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
                                        <Target size={24}/>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Position Fit Analysis</p>
                                        <p className={`text-xl font-bold uppercase ${report.fitStatus === 'match' ? 'text-emerald-600' : 'text-slate-700'}`}>{report.fitStatus}</p>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div><h3 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><Star size={12} fill="currentColor"/> Strengths</h3><ul className="space-y-3">{report.strengths.map((s, i) => (<li key={i} className="flex gap-3 text-sm font-bold text-slate-700"><CheckCircle className="text-emerald-500 shrink-0" size={18}/><span>{s}</span></li>))}</ul></div>
                                <div><h3 className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><BarChart3 size={12}/> Growth</h3><ul className="space-y-3">{report.areasForImprovement.map((a, i) => (<li key={i} className="flex gap-3 text-sm font-bold text-slate-700"><Zap className="text-amber-500 shrink-0" size={18}/><span>{a}</span></li>))}</ul></div>
                            </div>

                            {report.missingKnowledge && report.missingKnowledge.length > 0 && (
                                <div className="p-6 bg-red-50 rounded-2xl border border-red-100">
                                    <h3 className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><ShieldAlert size={14}/> Missing Domain Knowledge</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {report.missingKnowledge.map((k, i) => (
                                            <span key={i} className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold">{k}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="space-y-6"><h3 className="text-xl font-bold text-white uppercase flex items-center gap-2 px-2"><GraduationCap className="text-indigo-400"/> Neural Growth Path</h3><div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl"><MarkdownView content={report.learningMaterial} initialTheme={userProfile?.preferredReaderTheme || 'slate'} /></div></div>
                    </>
                  )}
                  
                  <div className="space-y-6">
                      <h3 className="text-xl font-bold text-white uppercase flex items-center gap-2 px-2"><FileText className="text-slate-400"/> Session Transcript</h3>
                      <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-4">
                          {transcript.map((t,i) => (<div key={i} className="text-sm border-l-2 border-slate-800 pl-4 py-1"><p className="text-[10px] font-black uppercase text-slate-600 mb-1">{t.role}</p><p className="text-slate-400">{t.text}</p></div>))}
                      </div>
                  </div>
              </div>
          )}
      </main>

      {isGeneratingReport && (
          <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center gap-8">
              <div className="relative">
                <div className="w-32 h-32 border-4 border-indigo-500/10 rounded-full"></div>
                <div 
                    className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full"
                    style={{ 
                        clipPath: `conic-gradient(white ${synthesisPercent}%, transparent 0)`,
                        transform: 'rotate(-90deg)'
                    }}
                ></div>
                <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full animate-pulse"></div>
                <Activity className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-400" size={40}/>
                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-3xl font-black text-white">{Math.round(synthesisPercent)}%</div>
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-black text-white uppercase tracking-widest">{synthesisStep}</h3>
                <p className="text-sm text-slate-400">Processing session metrics with high-fidelity logic...</p>
              </div>
          </div>
      )}
    </div>
  );
};
