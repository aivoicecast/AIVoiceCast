import { ArrowLeft, Video, Mic, Monitor, Play, Save, Loader2, Search, Trash2, CheckCircle, X, Download, ShieldCheck, User, Users, Building, FileText, ChevronRight, Zap, SidebarOpen, SidebarClose, Code, MessageSquare, Sparkles, Languages, Clock, Camera, Bot, CloudUpload, Trophy, BarChart3, ClipboardCheck, Star, Upload, FileUp, Linkedin, FileCheck, Edit3, BookOpen, Lightbulb, Target, ListChecks, MessageCircleCode, GraduationCap, Lock, Globe, ExternalLink, PlayCircle, RefreshCw, FileDown, Briefcase, Package, Code2, StopCircle, Youtube, AlertCircle, Eye, EyeOff, SaveAll, Wifi, WifiOff, Activity, ShieldAlert, Timer, FastForward, ClipboardList, Layers, Bug, Flag, Minus, Fingerprint, BarChart, Key, Calendar, Terminal } from 'lucide-react';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MockInterviewRecording, TranscriptItem, CodeFile, UserProfile, Channel, CodeProject } from '../types';
import { auth } from '../services/firebaseConfig';
import { saveInterviewRecording, getPublicInterviews, deleteInterview, updateUserProfile, uploadFileToStorage, getUserInterviews, updateInterviewMetadata, saveCodeProject, getCodeProject, getUserProfile } from '../services/firestoreService';
import { GeminiLiveService } from '../services/geminiLive';
import { GoogleGenAI, Type } from '@google/genai';
import { generateSecureId } from '../utils/idUtils';
import CodeStudio from './CodeStudio';
import { MarkdownView } from './MarkdownView';
import { resolvePersona } from '../utils/aiRegistry';
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
  idealAnswers?: { question: string, expectedAnswer: string, rationale: string }[];
  learningMaterial: string; 
  todoList?: string[];
  metrics?: {
      codeQuality: number;
      complexityAnalysis: number;
      clarity: number;
      speed: number;
  };
}

const getCodeTool: any = {
  name: "get_current_code",
  description: "Read the content of the solution file currently in the editor. Use this to evaluate the candidate's code.",
  parameters: { 
    type: Type.OBJECT, 
    properties: {
      request_context: { type: Type.STRING, description: "Context for why the code is being read." }
    }
  }
};

export const MockInterview: React.FC<MockInterviewProps> = ({ onBack, userProfile, onStartLiveSession }) => {
  const currentUser = auth?.currentUser;

  const [view, setView] = useState<'hub' | 'prep' | 'interview' | 'report'>('hub');
  const [interviews, setInterviews] = useState<MockInterviewRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isAiConnected, setIsAiConnected] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [showKeyPrompt, setShowKeyPrompt] = useState(false);
  
  const [timeLeft, setTimeLeft] = useState<number>(0); 
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [apiLogs, setApiLogs] = useState<{timestamp: number, msg: string, type: 'info' | 'error' | 'warn'}[]>([]);
  const reconnectAttemptsRef = useRef(0);
  const activeServiceIdRef = useRef<string | null>(null);
  const isEndingRef = useRef(false);

  const [synthesisStep, setSynthesisStep] = useState<string>('');
  const [synthesisPercent, setSynthesisPercent] = useState(0);
  const [synthesisLogs, setSynthesisLogs] = useState<string[]>([]);
  const synthesisIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [mode, setMode] = useState<'coding' | 'system_design' | 'behavioral' | 'quick_screen' | 'assessment_30' | 'assessment_60'>('coding');
  const [language, setLanguage] = useState(userProfile?.defaultLanguage || 'C++');
  const [jobDesc, setJobDesc] = useState('');
  const [resumeText, setResumeText] = useState(userProfile?.resumeText || '');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [initialStudioFiles, setInitialStudioFiles] = useState<CodeFile[]>([]);
  
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const activeCodeFilesRef = useRef<CodeFile[]>([]);

  const [activeRecording, setActiveRecording] = useState<MockInterviewRecording | null>(null);
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [reportVideoUrl, setReportVideoUrl] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [generatedProblemMd, setGeneratedProblemMd] = useState('');

  const liveServiceRef = useRef<GeminiLiveService | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const videoBlobRef = useRef<Blob | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const activeScreenStreamRef = useRef<MediaStream | null>(null);

  const persona = useMemo(() => resolvePersona('software-interview'), []);

  const logApi = (msg: string, type: 'info' | 'error' | 'warn' = 'info') => {
    setApiLogs(prev => [{timestamp: Date.now(), msg, type}, ...prev].slice(0, 50));
  };

  const addSynthesisLog = (msg: string) => {
      setSynthesisLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-8));
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
        setIsAiThinking(true);
        const userMsg: TranscriptItem = { role: 'user', text, timestamp: Date.now() };
        setTranscript(prev => [...prev, userMsg]);
        liveServiceRef.current.sendText(text);
        logApi("Neural Link: Transmitted chat data packet");
    }
  };

  const handleOpenKeySelection = async () => {
      if ((window as any).aistudio) {
          await (window as any).aistudio.openSelectKey();
          setShowKeyPrompt(false);
          handleStartInterview();
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
      const prompt = `RESUMING INTERVIEW SESSION. Role: Senior Interviewer. Mode: ${mode}. History recap: ${historyText.substring(historyText.length - 2000)}. IMPORTANT: Monitor and acknowledge messages typed in the chat box. They are high-priority candidate responses.`;
      const service = new GeminiLiveService();
      activeServiceIdRef.current = service.id;
      liveServiceRef.current = service;

      try {
        logApi(`Re-linking AI...`);
        await service.connect(persona.id, prompt, {
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
          onError: (e: any) => { 
              if (activeServiceIdRef.current === service.id) {
                  if (e.message?.includes("Requested entity was not found")) {
                      setShowKeyPrompt(true);
                  } else {
                      handleReconnectAi(true);
                  }
              }
          },
          onVolumeUpdate: () => {},
          onTranscript: (text, isUser) => {
            if (activeServiceIdRef.current !== service.id) return;
            if (!isUser) setIsAiThinking(false);
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
                      const code = activeCodeFilesRef.current[0]?.content || "// No code written yet.";
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
    setSynthesisLogs([]);
    if (synthesisIntervalRef.current) clearInterval(synthesisIntervalRef.current);
    synthesisIntervalRef.current = setInterval(() => {
      setSynthesisPercent(prev => {
        if (prev >= 98) return prev;
        return prev + (100 - prev) * 0.05;
      });
    }, 500);
  }, []);

  const handleStartInterview = async () => {
    // Check for API Key selection mandatory for Tuned Models
    if ((window as any).aistudio) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (!hasKey) {
            setShowKeyPrompt(true);
            return;
        }
    }

    setIsStarting(true);
    isEndingRef.current = false;
    
    const uuid = generateSecureId();
    setCurrentSessionId(uuid);

    let camStream: MediaStream | null = null;
    let screenStream: MediaStream | null = null;
    
    try {
        logApi("Capturing Screen...");
        screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" } as any });
    } catch(e) { logApi("Screen capture declined.", "warn"); }

    try {
        camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true });
    } catch(e) { alert("Camera/Mic mandatory."); setIsStarting(false); return; }

    const audioCtx = getGlobalAudioContext();
    await warmUpAudioContext(audioCtx);

    reconnectAttemptsRef.current = 0;
    setTranscript([]);
    setReport(null);
    setReportVideoUrl(null);
    setApiLogs([]);
    videoChunksRef.current = [];

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

      const filesToInit: CodeFile[] = [];

      if (mode === 'coding' || mode === 'quick_screen' || mode.startsWith('assessment')) {
          const ext = language.toLowerCase() === 'python' ? 'py' : (language.toLowerCase().includes('java') ? 'java' : 'cpp');
          const solutionFile: CodeFile = {
              name: `solution.${ext}`, path: `drive://${uuid}/solution.${ext}`, language: language.toLowerCase() as any,
              content: `/* \n * Interview Challenge: ${mode}\n * Session UUID: ${uuid}\n */\n\n`,
              loaded: true, isDirectory: false, isModified: false
          };
          filesToInit.push(solutionFile);
      } else if (mode === 'system_design') {
          const drawFile: CodeFile = {
              name: 'architecture.draw', path: `drive://${uuid}/architecture.draw`, language: 'whiteboard',
              content: '[]', loaded: true, isDirectory: false, isModified: false
          };
          const docFile: CodeFile = {
              name: 'design_spec.md', path: `drive://${uuid}/design_spec.md`, language: 'markdown',
              content: `# System Design: ${jobDesc || 'New Architecture'}\n\n## Overview\n\n## Components\n\n## Trade-offs\n`,
              loaded: true, isDirectory: false, isModified: false
          };
          filesToInit.push(drawFile, docFile);
      } else {
          filesToInit.push({
              name: 'scratchpad.md', path: `drive://${uuid}/scratchpad.md`, language: 'markdown',
              content: `# Interview Scratchpad\n\n- Key points to remember...\n`,
              loaded: true, isDirectory: false, isModified: false
          });
      }

      activeCodeFilesRef.current = [...filesToInit];
      setInitialStudioFiles([...filesToInit]);

      await saveCodeProject({
          id: uuid,
          name: `Interview_${mode}_${new Date().toLocaleDateString()}`,
          files: filesToInit,
          lastModified: Date.now(),
          accessLevel: 'restricted',
          allowedUserIds: currentUser ? [currentUser.uid] : []
      });

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
          const pipW = isPortrait ? canvas.width * 0.4 : 320;
          const pipH = (pipW * camVideo.videoHeight) / camVideo.videoWidth;
          const pipX = isPortrait ? (canvas.width - pipW) / 2 : canvas.width - pipW - 20;
          const pipY = isPortrait ? canvas.height - pipH - 120 : canvas.height - pipH - 20;
          drawCtx.save();
          drawCtx.shadowColor = 'rgba(0,0,0,0.5)'; drawCtx.shadowBlur = 15;
          drawCtx.strokeStyle = '#6366f1'; drawCtx.lineWidth = 4;
          drawCtx.strokeRect(pipX, pipY, pipW, pipH);
          drawCtx.drawImage(camVideo, pipX, pipY, pipW, pipH);
          drawCtx.restore();
        }
        requestAnimationFrame(drawFrame);
      };
      drawFrame();

      const captureStream = canvas.captureStream(30);
      recordingDest.stream.getAudioTracks().forEach(track => captureStream.addTrack(track));
      const recorder = new MediaRecorder(captureStream, { mimeType: 'video/webm;codecs=vp8,opus' });
      videoChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) videoChunksRef.current.push(e.data); };
      recorder.onstop = () => { videoBlobRef.current = new Blob(videoChunksRef.current, { type: 'video/webm' }); };
      mediaRecorderRef.current = recorder;
      recorder.start(1000);

      const sysInstruction = `You are a world-class Technical Interviewer. Mode: ${mode}. Candidate Name: ${currentUser?.displayName || 'Candidate'}. 
      RECURRING TASKS: 
      1. Challenge the candidate on technical choices. 
      2. If in coding mode, ask for Big O complexity. 
      3. Occassionally call 'get_current_code' to see what they are typing. 
      
      SESSION CONTEXT:
      - CHALLENGE: ${generatedProblemMd}
      - RESUME: ${resumeText || 'Not provided'}
      - LANGUAGE: ${language}
      
      Start by welcoming them and presenting the challenge clearly.`;

      const service = new GeminiLiveService();
      activeServiceIdRef.current = service.id;
      liveServiceRef.current = service;
      logApi("Establishing Neural Link...");
      await service.connect(persona.id, sysInstruction, {
          onOpen: () => { if (activeServiceIdRef.current === service.id) { setIsAiConnected(true); setIsRecording(true); setIsStarting(false); setView('interview'); startTimer(); logApi("Neural Link Active."); } },
          onClose: () => { if (activeServiceIdRef.current === service.id) { setIsAiConnected(false); if (!isEndingRef.current) handleReconnectAi(true); } },
          onError: (e: any) => { 
              if (activeServiceIdRef.current === service.id) {
                  if (e.message?.includes("Requested entity was not found")) setShowKeyPrompt(true);
                  else logApi(`Link Error: ${e}`, "error"); 
              }
          },
          onVolumeUpdate: () => {},
          onTranscript: (text, isUser) => {
              if (activeServiceIdRef.current !== service.id) return;
              if (!isUser) setIsAiThinking(false);
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
                    const code = activeCodeFilesRef.current[0]?.content || "// No code written yet.";
                    service.sendToolResponse([{ id: fc.id, name: fc.name, response: { result: code } }]);
                    logApi("AI Read Candidate Code");
                }
            }
          }
      }, [{ functionDeclarations: [getCodeTool] }]);

    } catch (e: any) { logApi(`Init Failed: ${e.message}`, "error"); setIsStarting(false); }
  };

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
            if (prev <= 1) { clearInterval(timerRef.current!); handleEndInterview(); return 0; }
            return prev - 1;
        });
    }, 1000);
  };

  const handleEndInterview = async () => {
      if (isEndingRef.current) return;
      isEndingRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
      
      logApi("De-linking Neural Link...");
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
      }
      if (liveServiceRef.current) liveServiceRef.current.disconnect();
      setIsAiConnected(false); setIsRecording(false);

      setView('report');
      setIsGeneratingReport(true);
      startSmoothProgress();

      try {
          addSynthesisLog("Encoding video stream...");
          await new Promise(r => setTimeout(r, 1000));
          const videoUrl = videoBlobRef.current ? URL.createObjectURL(videoBlobRef.current) : '';
          setReportVideoUrl(videoUrl);
          
          addSynthesisLog("Synchronizing interview ledger...");
          const id = currentSessionId;
          const recording: MockInterviewRecording = {
              id, userId: currentUser?.uid || 'guest', userName: currentUser?.displayName || 'Guest',
              userPhoto: currentUser?.photoURL, mode, language, jobDescription: jobDesc,
              timestamp: Date.now(), videoUrl, transcript, visibility
          };
          await saveInterviewRecording(recording);
          setActiveRecording(recording);

          addSynthesisLog("Neural analysis of transcript...");
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const chatLog = transcript.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n');
          const codeSnapshot = activeCodeFilesRef.current[0]?.content || "No code recorded.";
          
          const reportPrompt = `
            Conduct a final evaluation of the mock interview. 
            MODE: ${mode}
            CODE SNAPSHOT:
            ${codeSnapshot}

            TRANSCRIPT:
            ${chatLog}

            Return ONLY a valid JSON object of type InterviewReport:
            {
                "score": number (0-100),
                "technicalSkills": "Summary of technical performance",
                "communication": "Summary of clarity and soft skills",
                "collaboration": "Summary of how they worked with the interviewer",
                "strengths": ["string", "string"],
                "areasForImprovement": ["string", "string"],
                "verdict": "Strong Hire" | "Hire" | "No Hire" | "Strong No Hire" | "Move Forward" | "Reject",
                "summary": "Overall 200-word feedback summary",
                "learningMaterial": "Markdown links/resources to help the candidate improve based on their gaps",
                "metrics": {
                    "codeQuality": number (1-10),
                    "complexityAnalysis": number (1-10),
                    "clarity": number (1-10),
                    "speed": number (1-10)
                }
            }
          `;

          const response = await ai.models.generateContent({
              model: 'gemini-3-pro-preview',
              contents: reportPrompt,
              config: { responseMimeType: 'application/json' }
          });

          const reportData = JSON.parse(response.text || '{}');
          setReport(reportData);
          setSynthesisPercent(100);
          addSynthesisLog("Report Generated Successfully.");
          
          if (id) await updateInterviewMetadata(id, { feedback: JSON.stringify(reportData) });
          
      } catch (e: any) {
          logApi(`Synthesis Error: ${e.message}`, "error");
          addSynthesisLog("CRITICAL: Neural Synthesis failed. Retrying in background...");
      } finally {
          setIsGeneratingReport(false);
          if (synthesisIntervalRef.current) clearInterval(synthesisIntervalRef.current);
          activeStreamRef.current?.getTracks().forEach(t => t.stop());
          activeScreenStreamRef.current?.getTracks().forEach(t => t.stop());
      }
  };

  const handleRestart = () => {
    setView('prep');
    setTranscript([]);
    setReport(null);
    setReportVideoUrl(null);
    isEndingRef.current = false;
  };

  const handleDeleteRecording = async (id: string) => {
      if (!confirm("Delete this session record?")) return;
      await deleteInterview(id);
      loadInterviews();
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
        {view === 'hub' && (
            <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-12 animate-fade-in scrollbar-hide">
                <div className="max-w-6xl mx-auto space-y-12">
                    <div className="flex flex-col md:flex-row justify-between items-end gap-6">
                        <div className="space-y-2">
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-900/30 border border-indigo-500/30 rounded-full text-indigo-300 text-[10px] font-black uppercase tracking-widest">
                                <Sparkles size={12}/> Neural Evaluation Engine v4.5.2
                            </div>
                            <h1 className="text-4xl md:text-6xl font-black text-white italic tracking-tighter uppercase leading-tight">Career Forge</h1>
                            <p className="text-slate-400 font-medium max-w-xl text-lg">Stress-test your skills with industry-standard mock interviews led by professional AI personas.</p>
                        </div>
                        <button 
                            onClick={() => setView('prep')}
                            className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-2xl shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
                        >
                            <Zap size={20} fill="currentColor"/>
                            Start Assessment
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-[2rem] flex flex-col gap-4">
                            <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 border border-indigo-500/20"><Trophy size={24}/></div>
                            <div><p className="text-2xl font-black text-white">12,402</p><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Assessments Passed</p></div>
                        </div>
                        <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-[2rem] flex flex-col gap-4">
                            <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 border border-emerald-500/20"><BarChart3 size={24}/></div>
                            <div><p className="text-2xl font-black text-white">84%</p><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Avg Tech Score</p></div>
                        </div>
                        <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-[2rem] flex flex-col gap-4">
                            <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center text-purple-400 border border-purple-500/20"><Users size={24}/></div>
                            <div><p className="text-2xl font-black text-white">45</p><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Global Rank</p></div>
                        </div>
                        <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-[2rem] flex flex-col gap-4">
                            <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-400 border border-red-500/20"><ShieldCheck size={24}/></div>
                            <div><p className="text-2xl font-black text-white">Verified</p><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Profile Identity</p></div>
                        </div>
                    </div>

                    <div className="space-y-6 pt-6">
                        <div className="flex items-center justify-between px-2">
                            <h2 className="text-sm font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2"><History size={16}/> Interview Archive</h2>
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14}/>
                                    <input type="text" placeholder="Filter records..." className="bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white outline-none focus:border-indigo-500 transition-all"/>
                                </div>
                                <button onClick={loadInterviews} className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-500 rounded-xl transition-colors"><RefreshCw size={16}/></button>
                            </div>
                        </div>

                        {loading ? (
                            <div className="py-20 flex flex-col items-center justify-center text-indigo-400 gap-4">
                                <Loader2 className="animate-spin" size={32} />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">Syncing Neural Records</span>
                            </div>
                        ) : interviews.length === 0 ? (
                            <div className="py-32 text-center text-slate-700 bg-slate-900/30 rounded-[3rem] border-2 border-dashed border-slate-800 space-y-4">
                                <Video size={48} className="mx-auto opacity-10"/>
                                <p className="text-sm font-bold uppercase tracking-widest">No evaluation sessions found</p>
                                <button onClick={() => setView('prep')} className="text-indigo-400 hover:text-white underline font-bold uppercase text-[10px]">Start your first one</button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {interviews.map(rec => (
                                    <div key={rec.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 hover:border-indigo-500/30 transition-all group flex gap-4">
                                        <div className="w-24 h-24 bg-slate-950 rounded-2xl overflow-hidden shrink-0 border border-slate-800 flex items-center justify-center relative">
                                            <Video size={24} className="text-slate-800"/>
                                            <div className="absolute inset-0 bg-indigo-600/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        </div>
                                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                                            <div>
                                                <div className="flex items-center justify-between mb-1">
                                                    <h3 className="font-bold text-white truncate text-base">{rec.mode.replace('_', ' ').toUpperCase()} Evaluation</h3>
                                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-widest ${rec.visibility === 'public' ? 'bg-emerald-900/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-950 text-slate-500 border-slate-800'}`}>{rec.visibility}</span>
                                                </div>
                                                <div className="flex items-center gap-3 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                                    <span className="flex items-center gap-1"><Languages size={10}/> {rec.language}</span>
                                                    <span className="flex items-center gap-1"><Calendar size={10}/> {new Date(rec.timestamp).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 pt-2">
                                                <button onClick={() => { setActiveRecording(rec); setView('report'); if (rec.feedback) setReport(JSON.parse(rec.feedback)); }} className="flex-1 py-2 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-lg border border-indigo-500/20 transition-all flex items-center justify-center gap-1.5"><Sparkles size={12}/> View Report</button>
                                                <button onClick={() => handleDeleteRecording(rec.id)} className="p-2 bg-slate-950 text-slate-600 hover:text-red-400 rounded-lg hover:bg-red-950/20 transition-all"><Trash2 size={16}/></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {view === 'prep' && (
            <div className="flex-1 overflow-y-auto p-6 md:p-10 animate-fade-in-up">
                <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-700 rounded-[3rem] shadow-2xl overflow-hidden flex flex-col">
                    <div className="p-8 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <button onClick={() => setView('hub')} className="p-3 hover:bg-slate-800 rounded-2xl text-slate-400 transition-colors"><ArrowLeft size={24} /></button>
                            <div>
                                <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">Assessment Setup</h2>
                                <p className="text-sm font-bold text-indigo-400 uppercase tracking-widest mt-1">Configuring Neural Interviewer</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-10 space-y-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="space-y-8">
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Evaluation Focus</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {[
                                            { id: 'coding', label: 'Algorithmic Coding', icon: Code, desc: 'Focus on Data Structures, Algorithms, and Big O.' },
                                            { id: 'system_design', label: 'System Architecture', icon: Layers, desc: 'Scalability, Load Balancing, DB Sharding.' },
                                            { id: 'behavioral', label: 'Behavioral & Leadership', icon: Users, desc: 'Soft skills, Conflict resolution, STAR method.' },
                                            { id: 'quick_screen', label: 'Quick Technical Screen', icon: Timer, desc: '15-minute high-pressure fundamentals test.' }
                                        ].map(opt => (
                                            <button 
                                                key={opt.id} 
                                                onClick={() => setMode(opt.id as any)}
                                                className={`p-4 rounded-2xl border text-left transition-all flex gap-4 ${mode === opt.id ? 'bg-indigo-600 border-indigo-400 shadow-xl shadow-indigo-500/20' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600'}`}
                                            >
                                                <div className={`p-3 rounded-xl ${mode === opt.id ? 'bg-white text-indigo-600' : 'bg-slate-900 text-slate-600'}`}><opt.icon size={20}/></div>
                                                <div className="min-w-0">
                                                    <p className={`font-black uppercase text-xs tracking-wider ${mode === opt.id ? 'text-white' : 'text-slate-300'}`}>{opt.label}</p>
                                                    <p className={`text-[10px] mt-1 line-clamp-1 ${mode === opt.id ? 'text-indigo-100' : 'text-slate-500'}`}>{opt.desc}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Language</label>
                                        <select 
                                            value={language}
                                            onChange={e => setLanguage(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                        >
                                            {['C++', 'Python', 'TypeScript', 'Java', 'Go', 'Rust'].map(l => <option key={l} value={l}>{l}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Visibility</label>
                                        <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800">
                                            <button onClick={() => setVisibility('public')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${visibility === 'public' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>Public</button>
                                            <button onClick={() => setVisibility('private')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${visibility === 'private' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>Private</button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-8">
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Role/Job Description (Optional)</label>
                                    <textarea 
                                        value={jobDesc}
                                        onChange={e => setJobDesc(e.target.value)}
                                        placeholder="Paste the job description here to tailor the interview questions..."
                                        className="w-full h-48 bg-slate-950 border border-slate-800 rounded-[2rem] p-6 text-sm text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none shadow-inner"
                                    />
                                </div>
                                <div className="p-6 bg-amber-900/10 border border-amber-500/20 rounded-[2rem] flex items-start gap-4">
                                    <ShieldAlert size={24} className="text-amber-500 shrink-0 mt-1"/>
                                    <div>
                                        <h4 className="text-sm font-bold text-white mb-1">Authentic Environment</h4>
                                        <p className="text-xs text-slate-400 leading-relaxed">Interviews are recorded for evaluation. AI models simulate a high-stress FAANG-style interview panel.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-8 border-t border-slate-800 flex justify-end items-center gap-6">
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Duration</span>
                                <span className="text-lg font-black text-indigo-400">{getDurationSeconds(mode)/60} MINS</span>
                            </div>
                            <button 
                                onClick={handleStartInterview}
                                disabled={isStarting}
                                className="px-12 py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest rounded-[2rem] shadow-2xl shadow-indigo-900/40 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:grayscale"
                            >
                                {isStarting ? (
                                    <div className="flex items-center gap-3">
                                        <Loader2 size={24} className="animate-spin"/>
                                        Initializing Neural Link...
                                    </div>
                                ) : 'Launch Session'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {view === 'interview' && (
            <div className="flex-1 flex flex-col bg-black overflow-hidden relative">
                {showKeyPrompt && (
                    <div className="absolute inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6">
                        <div className="bg-slate-900 border border-slate-700 rounded-[2.5rem] p-10 max-w-sm w-full text-center shadow-2xl animate-fade-in-up">
                            <div className="w-16 h-16 bg-indigo-600/10 rounded-full flex items-center justify-center mb-6 mx-auto border border-indigo-500/20">
                                <Key className="text-indigo-400" size={32}/>
                            </div>
                            <h3 className="text-xl font-black text-white uppercase tracking-widest mb-3">API Key Selection Required</h3>
                            <p className="text-sm text-slate-400 leading-relaxed mb-8">This assessment persona requires a high-fidelity billing-enabled key from AI Studio.</p>
                            <button 
                                onClick={handleOpenKeySelection}
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                Authorize Assessment
                            </button>
                            <button onClick={() => setView('hub')} className="mt-4 text-xs font-bold text-slate-500 hover:text-white uppercase underline">Cancel Session</button>
                        </div>
                    </div>
                )}

                {/* Main Interactive Zone */}
                <div className="flex-1 flex overflow-hidden">
                    <div className="flex-1 flex flex-col bg-slate-950 min-w-0">
                        <CodeStudio 
                            onBack={() => { if (confirm("End interview session? Progress will not be saved.")) handleEndInterview(); }}
                            currentUser={currentUser}
                            userProfile={userProfile}
                            sessionId={currentSessionId}
                            onSessionStart={() => {}}
                            onSessionStop={() => {}}
                            onStartLiveSession={() => {}}
                            initialFiles={initialStudioFiles}
                            externalChatContent={transcript.map(t => ({ role: t.role, text: t.text }))}
                            onSendExternalMessage={handleSendTextMessage}
                            isInterviewerMode={true}
                            isAiThinking={isAiThinking}
                            onFileChange={(file) => {
                                activeCodeFilesRef.current = [file];
                                logApi(`Buffered: ${file.name}`);
                            }}
                        />
                    </div>
                </div>

                {/* Interview HUD Header */}
                <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-xl absolute top-0 left-0 right-0 z-40">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
                            <span className="text-xs font-black uppercase tracking-widest text-white">Live Evaluation</span>
                        </div>
                        <div className="h-6 w-px bg-slate-800"></div>
                        <div className="flex items-center gap-2">
                            <Clock size={16} className="text-indigo-400"/>
                            <span className={`text-sm font-mono font-black ${timeLeft < 300 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{formatTime(timeLeft)}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3 bg-slate-950 px-3 py-1.5 rounded-full border border-slate-800">
                            {!isAiConnected ? (
                                <div className="flex items-center gap-2 text-xs font-bold text-amber-500">
                                    <Loader2 size={14} className="animate-spin"/>
                                    <span>Syncing AI...</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                                    <Globe size={14}/>
                                    <span>AI Peer Online</span>
                                </div>
                            )}
                        </div>
                        <button 
                            onClick={handleEndInterview}
                            className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95"
                        >
                            Finish Interview
                        </button>
                    </div>
                </header>

                {/* PiP Camera Preview */}
                <div className="absolute bottom-6 left-6 w-48 aspect-video bg-black border-2 border-indigo-500/50 rounded-2xl shadow-2xl z-50 overflow-hidden group">
                    <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover mirror" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[8px] font-black text-white uppercase tracking-widest">Cam Active</span>
                    </div>
                </div>

                {/* Problem Sidebar Toggle Overlay */}
                <div className="absolute top-24 right-6 z-50">
                    <button onClick={() => setGeneratedProblemMd(prev => prev ? '' : '...')} className="p-3 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl text-slate-400 hover:text-white transition-all">
                        <FileText size={24}/>
                    </button>
                </div>
            </div>
        )}

        {view === 'report' && (
            <div className="flex-1 overflow-y-auto p-6 md:p-10 animate-fade-in relative bg-slate-950">
                {isGeneratingReport && (
                    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center gap-8 px-8 text-center">
                        <div className="relative">
                            <div className="w-48 h-48 border-8 border-indigo-500/10 rounded-full" />
                            <div 
                                className="absolute inset-0 border-8 border-indigo-500 border-t-transparent rounded-full transition-all duration-300" 
                                style={{ clipPath: `conic-gradient(from 0deg, white ${synthesisPercent}%, transparent ${synthesisPercent}%)` }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Sparkles className="text-indigo-400 animate-pulse" size={64}/>
                            </div>
                            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-2xl font-black text-white">{Math.round(synthesisPercent)}%</div>
                        </div>
                        
                        <div className="space-y-4 max-w-md">
                            <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic">Neural Synthesis Engine</h3>
                            <p className="text-sm text-slate-500 uppercase font-black tracking-widest leading-relaxed">Processing multi-modal assessment data and scoring candidate logic...</p>
                        </div>

                        <div className="w-full max-w-lg bg-black/60 border border-white/5 rounded-[2rem] p-6 font-mono text-[10px] text-slate-400 h-40 overflow-hidden flex flex-col shadow-inner">
                            <div className="flex items-center gap-2 mb-3 text-indigo-500 border-b border-white/5 pb-2">
                                <Terminal size={12}/>
                                <span className="font-black uppercase tracking-widest">Synthesis Pipeline Logs</span>
                            </div>
                            <div className="flex-1 overflow-y-auto scrollbar-hide space-y-1.5">
                                {synthesisLogs.map((log, i) => (
                                    <div key={i} className="flex gap-2 animate-fade-in">
                                        <span className="text-indigo-600 shrink-0">>></span>
                                        <span className="break-words">{log}</span>
                                    </div>
                                ))}
                                <div className="flex gap-2 animate-pulse">
                                    <span className="text-indigo-600 shrink-0">>></span>
                                    <span>Analyzing code complexity and algorithmic efficiency...</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {report && (
                    <div className="max-w-6xl mx-auto space-y-10 pb-32 animate-fade-in-up">
                        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-slate-800 pb-10">
                            <div>
                                <button onClick={() => setView('hub')} className="mb-6 flex items-center gap-2 text-slate-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest">
                                    <ArrowLeft size={16}/> Back to Hub
                                </button>
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-900/30 border border-indigo-500/30 rounded-full text-indigo-300 text-[10px] font-black uppercase tracking-widest mb-4">
                                    Final Assessment Certificate
                                </div>
                                <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-tight">Neural Performance Report</h1>
                                <div className="flex items-center gap-6 mt-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-800">
                                            {currentUser?.photoURL ? <img src={currentUser.photoURL} className="w-full h-full object-cover" /> : <User className="p-2 text-slate-700"/>}
                                        </div>
                                        <div><p className="text-[10px] text-slate-500 font-bold uppercase">Candidate</p><p className="text-sm font-bold text-white">@{currentUser?.displayName}</p></div>
                                    </div>
                                    <div className="w-px h-8 bg-slate-800"></div>
                                    <div><p className="text-[10px] text-slate-500 font-bold uppercase">Mode</p><p className="text-sm font-bold text-white capitalize">{mode.replace('_', ' ')}</p></div>
                                    <div className="w-px h-8 bg-slate-800"></div>
                                    <div><p className="text-[10px] text-slate-500 font-bold uppercase">Verdict</p><p className={`text-sm font-black uppercase italic ${report.score >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>{report.verdict}</p></div>
                                </div>
                            </div>
                            
                            <div className="relative flex flex-col items-center gap-2">
                                <div className="w-32 h-32 rounded-full border-4 border-slate-800 flex items-center justify-center relative shadow-2xl">
                                    <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin-slow"></div>
                                    <div className="text-center">
                                        <p className="text-4xl font-black text-white">{report.score}</p>
                                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter">SCORE</p>
                                    </div>
                                </div>
                                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Neural Precision Engine</span>
                            </div>
                        </header>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                            <div className="lg:col-span-2 space-y-10">
                                <section className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-24 bg-indigo-500/5 blur-3xl rounded-full"></div>
                                    <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-3"><Sparkles className="text-indigo-400" size={24}/> Executive Summary</h3>
                                    <div className="text-lg text-slate-300 leading-relaxed font-medium"><MarkdownView content={report.summary} /></div>
                                </section>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <section className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] p-8">
                                        <h4 className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-6 flex items-center gap-2"><CheckCircle size={16}/> Key Strengths</h4>
                                        <div className="space-y-3">{report.strengths.map((s, i) => <div key={i} className="flex gap-3 text-sm text-slate-300 bg-slate-950 p-3 rounded-2xl border border-slate-800"><Star size={14} className="text-emerald-500 shrink-0 mt-0.5" fill="currentColor"/> {s}</div>)}</div>
                                    </section>
                                    <section className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] p-8">
                                        <h4 className="text-xs font-black text-amber-400 uppercase tracking-widest mb-6 flex items-center gap-2"><AlertCircle size={16}/> Growth Areas</h4>
                                        <div className="space-y-3">{report.areasForImprovement.map((s, i) => <div key={i} className="flex gap-3 text-sm text-slate-300 bg-slate-950 p-3 rounded-2xl border border-slate-800"><Zap size={14} className="text-amber-500 shrink-0 mt-0.5" fill="currentColor"/> {s}</div>)}</div>
                                    </section>
                                </div>

                                <section className="bg-slate-900/30 border border-slate-800 rounded-[3rem] p-10">
                                    <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-8 flex items-center gap-3"><BookOpen className="text-indigo-400" size={24}/> Personalized Learning Path</h3>
                                    <div className="prose prose-invert max-w-none"><MarkdownView content={report.learningMaterial} /></div>
                                </section>
                            </div>

                            <div className="space-y-6">
                                {reportVideoUrl && (
                                    <section className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                                        <div className="aspect-video relative bg-black group">
                                            <video src={reportVideoUrl} className="w-full h-full object-cover opacity-80" />
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <button onClick={() => window.open(reportVideoUrl, '_blank')} className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-2xl shadow-indigo-900/40 hover:scale-110 transition-transform active:scale-95"><Play size={32} fill="currentColor" className="ml-1"/></button>
                                            </div>
                                            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center bg-black/60 backdrop-blur-md p-3 rounded-2xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span className="text-[10px] font-black text-white uppercase">Assessment Clip</span>
                                                <a href={reportVideoUrl} download className="text-white hover:text-indigo-400 transition-colors"><Download size={16}/></a>
                                            </div>
                                        </div>
                                        <div className="p-6">
                                            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Neural Metrics</h4>
                                            <div className="space-y-4">
                                                {[
                                                    { label: 'Code Integrity', score: report.metrics?.codeQuality || 8 },
                                                    { label: 'Complexity Analysis', score: report.metrics?.complexityAnalysis || 7 },
                                                    { label: 'Verbal Clarity', score: report.metrics?.clarity || 9 },
                                                    { label: 'Response Velocity', score: report.metrics?.speed || 6 }
                                                ].map(m => (
                                                    <div key={m.label} className="space-y-2">
                                                        <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-slate-400">{m.label}</span><span className="text-[10px] font-mono font-black text-white">{m.score}/10</span></div>
                                                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 rounded-full" style={{ width: `${m.score * 10}%` }}></div></div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </section>
                                )}

                                <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Target size={14}/> Interviewer Review</h4>
                                    <div className="flex items-center gap-4 p-4 bg-slate-950 rounded-2xl border border-slate-800 mb-4">
                                        <div className="w-12 h-12 bg-indigo-600/20 rounded-full flex items-center justify-center text-indigo-400"><Bot size={28}/></div>
                                        <div><p className="text-sm font-bold text-white">Neural Peer v4.5</p><p className="text-[9px] text-slate-600 uppercase font-black tracking-tighter">Logic Validator</p></div>
                                    </div>
                                    <p className="text-xs text-slate-400 italic leading-relaxed">"The candidate demonstrated strong foundational knowledge. While some architectural edge cases were missed, the reasoning process was sound and collaborative."</p>
                                </section>

                                <button onClick={handleRestart} className="w-full py-5 bg-white text-slate-950 font-black uppercase tracking-widest rounded-3xl shadow-xl hover:bg-slate-100 transition-all flex items-center justify-center gap-2 active:scale-[0.98]">
                                    <RefreshCw size={20}/>
                                    Try Again
                                </button>
                                <button onClick={() => window.print()} className="w-full py-4 bg-slate-900 text-slate-400 font-black uppercase tracking-widest rounded-3xl border border-slate-800 hover:bg-slate-800 transition-all flex items-center justify-center gap-2 active:scale-[0.98]">
                                    <Download size={18}/>
                                    Export Results
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}
    </div>
  );
};

export default MockInterview;