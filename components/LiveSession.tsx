
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Channel, TranscriptItem, GeneratedLecture, CommunityDiscussion, RecordingSession, Attachment, UserProfile } from '../types';
import { GeminiLiveService } from '../services/geminiLive';
import { Mic, MicOff, PhoneOff, Radio, AlertCircle, ScrollText, RefreshCw, Music, Download, Share2, Trash2, Quote, Copy, Check, MessageSquare, BookPlus, Loader2, Globe, FilePlus, Play, Save, CloudUpload, Link, X, Video, Monitor, Camera, Youtube, ClipboardList, Maximize2, Minimize2, Activity, Terminal, ShieldAlert, LogIn, Wifi, WifiOff, Zap, ShieldCheck, Thermometer, RefreshCcw, Sparkles, Square, Power } from 'lucide-react';
import { auth } from '../services/firebaseConfig';
import { getDriveToken, signInWithGoogle } from '../services/authService';
import { uploadToYouTube, getYouTubeVideoUrl } from '../services/youtubeService';
import { ensureCodeStudioFolder, uploadToDrive } from '../services/googleDriveService';
import { saveUserChannel, cacheLectureScript, getCachedLectureScript, saveLocalRecording } from '../utils/db';
// Fix: removed linkDiscussionToLectureSegment which is not exported by firestoreService
import { publishChannelToFirestore, saveDiscussion, saveRecordingReference, updateBookingRecording, addChannelAttachment, updateDiscussion, syncUserProfile, getUserProfile } from '../services/firestoreService';
import { summarizeDiscussionAsSection, generateDesignDocFromTranscript } from '../services/lectureGenerator';
import { FunctionDeclaration, Type } from '@google/genai';
import { getGlobalAudioContext, getGlobalMediaStreamDest, warmUpAudioContext, stopAllPlatformAudio } from '../utils/audioUtils';

interface LiveSessionProps {
  channel: Channel;
  initialContext?: string;
  lectureId?: string;
  onEndSession: () => void;
  language: 'en' | 'zh';
  recordingEnabled?: boolean;
  videoEnabled?: boolean;
  cameraEnabled?: boolean;
  activeSegment?: { index: number, lectureId: string };
  initialTranscript?: TranscriptItem[];
  existingDiscussionId?: string;
  customTools?: FunctionDeclaration[];
  onCustomToolCall?: (name: string, args: any) => Promise<any>;
}

const UI_TEXT = {
  en: {
    welcomePrefix: "Try asking...",
    reconnecting: "Neural Link Recovery...",
    establishing: "Establishing neural link...",
    holdMusic: "Playing hold music...",
    preparing: "Preparing agent environment...",
    transcript: "Live Transcript",
    copied: "Copied",
    listening: "Listening...",
    connecting: "Connecting to AI Agent...",
    reconnect: "Manual Reconnect",
    you: "You",
    speaking: "Speaking...",
    retry: "Retry Connection",
    live: "LIVE ON AIR",
    saveToCourse: "Save as New Lesson",
    appendToLecture: "Append to Current Lecture",
    sharePublic: "Share Discussion Publicly",
    saving: "Saving...",
    saveSuccess: "Saved!",
    sharedSuccess: "Shared to Community!",
    tapToStart: "Start Neural Session",
    tapDesc: "Click to enable audio and microphone access.",
    recording: "REC",
    uploading: "Syncing Session to Cloud...",
    uploadComplete: "Upload Successful",
    saveAndLink: "Save & Link to Segment",
    start: "Start Session",
    saveSession: "Save Session",
    localPreview: "Local Preview",
    diagnostics: "Neural Diagnostics",
    cloudWarn: "Drive/YouTube Access Missing: Local Only.",
    signIn: "Sign In",
    forceStart: "Bypassing Landing Screen: Auto-Initializing...",
    linkRestored: "Neural Link Restored",
    linkLost: "Neural Link Interrupted",
    rateLimit: "Neural Cooling Engaged",
    rateLimitDesc: "API quota exceeded. Please wait a few seconds before retrying.",
    rotating: "Refreshing Neural Fabric...",
    forceRestart: "Neural Refresh (Fix Hang)",
    stopLink: "Pause AI Link",
    stopped: "AI Paused"
  },
  zh: {
    welcomePrefix: "试着问...",
    reconnecting: "正在恢复神经连接...",
    establishing: "建立神经连接...",
    holdMusic: "播放等待音乐...",
    preparing: "准备智能体环境...",
    transcript: "实时字幕",
    copied: "已复制",
    listening: "正在聆听...",
    connecting: "连接到 AI 智能体...",
    reconnect: "手动重连",
    you: "你",
    speaking: "正在说话...",
    retry: "重试连接",
    live: "直播中",
    saveToCourse: "保存为新课程",
    appendToLecture: "追加到当前课程",
    sharePublic: "分享到社区",
    saving: "保存中...",
    saveSuccess: "已保存！",
    sharedSuccess: "已分享到社区！",
    tapToStart: "启动神经会话",
    tapDesc: "点击以启用音频和麦克风权限。",
    recording: "录音中",
    uploading: "正在同步会话存档...",
    uploadComplete: "上传成功",
    saveAndLink: "保存并链接到段落",
    start: "开始会话",
    saveSession: "保存会话",
    localPreview: "本地预览",
    diagnostics: "神经诊断",
    cloudWarn: "缺少 Drive/YouTube 权限：仅限本地。",
    signIn: "登录",
    forceStart: "跳过着陆页：自动初始化...",
    linkRestored: "神经连接已恢复",
    linkLost: "神经连接中断",
    rateLimit: "神经冷却中",
    rateLimitDesc: "API 配额已超出。请等待几秒钟后重试。",
    rotating: "正在刷新神经织网...",
    forceRestart: "神经刷新 (修复卡顿)",
    stopLink: "暂停 AI 连接",
    stopped: "AI 已暂停"
  }
};

const saveContentTool: FunctionDeclaration = {
  name: "save_content",
  description: "Save generated code, text, or specifications to the project. Useful when the user asks to 'document' or 'save' a part of the chat.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      filename: { type: Type.STRING, description: "Name of the file." },
      content: { type: Type.STRING, description: "Raw text or markdown content." },
      mimeType: { type: Type.STRING, description: "File type." }
    },
    required: ["filename", "content"]
  }
};

const SuggestionsBar = React.memo(({ suggestions, welcomeMessage, showWelcome, uiText }: { 
  suggestions: string[], 
  welcomeMessage?: string,
  showWelcome: boolean,
  uiText: any
}) => (
  <div className="w-full px-4 animate-fade-in-up py-2">
      {showWelcome && welcomeMessage && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 mb-4 text-center shadow-lg">
          <p className="text-slate-300 italic text-sm">"{welcomeMessage}"</p>
        </div>
      )}
      <div className="text-center mb-2">
         <span className="text-[10px] text-slate-500 uppercase tracking-widest font-black">{uiText.welcomePrefix}</span>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {suggestions.map((prompt, idx) => (
          <div key={idx} className="px-4 py-1.5 rounded-full text-[10px] bg-slate-800/50 border border-slate-700 text-slate-400 font-bold hover:bg-slate-800 transition-colors cursor-default select-none flex items-center gap-2">
            <MessageSquare size={10} className="text-slate-600" />
            {prompt}
          </div>
        ))}
      </div>
  </div>
));

export const LiveSession: React.FC<LiveSessionProps> = ({ 
  channel, initialContext, lectureId, onEndSession, language, 
  recordingEnabled, videoEnabled, cameraEnabled, activeSegment, 
  initialTranscript, existingDiscussionId,
  customTools, onCustomToolCall 
}) => {
  const t = UI_TEXT[language];
  const [hasStarted, setHasStarted] = useState(false); 
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [showReconnectButton, setShowReconnectButton] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploadingRecording, setIsUploadingRecording] = useState(false);
  const [synthesisProgress, setSynthesisProgress] = useState(0);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [logs, setLogs] = useState<{time: string, msg: string, type: 'info' | 'error' | 'warn'}[]>([]);
  
  // PERSISTENT RECORDING REFS (Survive re-connections)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const reconnectTimeoutRef = useRef<any>(null);
  const rotationTimerRef = useRef<any>(null);
  const autoReconnectAttempts = useRef(0);
  const maxAutoRetries = 8; 

  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [currentLine, setCurrentLine] = useState<TranscriptItem | null>(null);
  const transcriptRef = useRef<TranscriptItem[]>(initialTranscript || []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [suggestions] = useState<string[]>(channel.starterPrompts?.slice(0, 4) || []);
  
  const addLog = useCallback((msg: string, type: 'info' | 'error' | 'warn' = 'info') => {
      const time = new Date().toLocaleTimeString();
      setLogs(prev => [{ time, msg, type }, ...prev].slice(0, 100));
      console.log(`[Neural Log] ${msg}`);
  }, []);

  useEffect(() => { 
      transcriptRef.current = transcript; 
      mountedRef.current = true;
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      return () => { 
          mountedRef.current = false; 
          if (rotationTimerRef.current) clearTimeout(rotationTimerRef.current);
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      };
  }, [transcript, currentLine]);

  const serviceRef = useRef<GeminiLiveService | null>(null);
  const currentUser = auth?.currentUser;

  // Decoupled startRecording logic
  const initializePersistentRecorder = useCallback(async () => {
    if (!recordingEnabled || !currentUser) return;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') return;

    try {
        addLog("Initializing Persistent Neural Scribe...");
        const ctx = getGlobalAudioContext();
        const recordingDest = getGlobalMediaStreamDest();
        
        // Microphone acquisition
        const userStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const userSource = ctx.createMediaStreamSource(userStream); 
        userSource.connect(recordingDest);

        // UI Compositor Canvas
        const canvas = document.createElement('canvas');
        const isPortrait = window.innerHeight > window.innerWidth;
        canvas.width = isPortrait ? 720 : 1280;
        canvas.height = isPortrait ? 1280 : 720;
        const drawCtx = canvas.getContext('2d', { alpha: false })!;
        
        const screenVideo = document.createElement('video');
        if (screenStreamRef.current) { screenVideo.srcObject = screenStreamRef.current; screenVideo.muted = true; screenVideo.play(); }
        const cameraVideo = document.createElement('video');
        if (cameraStreamRef.current) { cameraVideo.srcObject = cameraStreamRef.current; cameraVideo.muted = true; cameraVideo.play(); }

        const drawCompositor = () => {
            if (!mountedRef.current) return;
            drawCtx.fillStyle = '#020617'; drawCtx.fillRect(0, 0, canvas.width, canvas.height);
            if (screenStreamRef.current && screenVideo.readyState >= 2) {
                const scale = Math.min(canvas.width / screenVideo.videoWidth, canvas.height / screenVideo.videoHeight);
                const w = screenVideo.videoWidth * scale; const h = screenVideo.videoHeight * scale;
                drawCtx.drawImage(screenVideo, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
            }
            if (cameraStreamRef.current && cameraVideo.readyState >= 2) {
                const pipW = isPortrait ? canvas.width * 0.5 : 320;
                const pipH = (pipW * cameraVideo.videoHeight) / cameraVideo.videoWidth;
                const pipX = isPortrait ? (canvas.width - pipW) / 2 : canvas.width - pipW - 24;
                const pipY = isPortrait ? canvas.height - pipH - 150 : canvas.height - pipH - 24;
                drawCtx.strokeStyle = '#6366f1'; drawCtx.lineWidth = 4;
                drawCtx.strokeRect(pipX, pipY, pipW, pipH); drawCtx.drawImage(cameraVideo, pipX, pipY, pipW, pipH);
            }
            animationFrameRef.current = requestAnimationFrame(drawCompositor);
        };
        drawCompositor();

        const captureStream = canvas.captureStream(30);
        recordingDest.stream.getAudioTracks().forEach(track => captureStream.addTrack(track));
        
        const recorder = new MediaRecorder(captureStream, { 
            mimeType: 'video/webm;codecs=vp8,opus', 
            videoBitsPerSecond: 2500000 
        });
        
        audioChunksRef.current = []; // ONLY reset here once per meeting
        recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
        
        recorder.onstop = async () => {
            addLog("Processing final meeting package...");
            const videoBlob = new Blob(audioChunksRef.current, { type: 'video/webm' });
            const transcriptText = transcriptRef.current.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n\n');
            const transcriptBlob = new Blob([transcriptText], { type: 'text/plain' });
            setIsUploadingRecording(true);
            try {
                const timestamp = Date.now();
                const recId = `session-${timestamp}`;
                await saveLocalRecording({
                    id: recId, userId: currentUser.uid, channelId: channel.id, channelTitle: channel.title, channelImage: channel.imageUrl, timestamp, mediaUrl: URL.createObjectURL(videoBlob), mediaType: 'video/webm', transcriptUrl: URL.createObjectURL(transcriptBlob), blob: videoBlob
                });
                const token = getDriveToken();
                if (token) {
                    const folderId = await ensureCodeStudioFolder(token);
                    const driveVideoUrl = `drive://${await uploadToDrive(token, folderId, `${recId}.webm`, videoBlob)}`;
                    const tFileId = await uploadToDrive(token, folderId, `${recId}_transcript.txt`, transcriptBlob);
                    await saveRecordingReference({
                        id: recId, userId: currentUser.uid, channelId: channel.id, channelTitle: channel.title, channelImage: channel.imageUrl, timestamp, mediaUrl: driveVideoUrl, driveUrl: driveVideoUrl, mediaType: 'video/webm', transcriptUrl: `drive://${tFileId}`
                    });
                }
            } catch(e) { console.error("Neural archive failed", e); } 
            finally { setIsUploadingRecording(false); onEndSession(); }
            userStream.getTracks().forEach(t => t.stop());
        };
        
        mediaRecorderRef.current = recorder;
        recorder.start(1000);
        addLog("Recording Active.");
    } catch(e) { addLog("Recorder Init Error: Permissions declined.", "error"); }
  }, [recordingEnabled, currentUser, channel, onEndSession, addLog]);

  const handleStartSession = async () => {
      setError(null);
      setIsRateLimited(false);
      autoReconnectAttempts.current = 0;
      
      // 1. Hardware Sync
      if (recordingEnabled) {
          const isMeeting = channel.id.includes('meeting');
          if (videoEnabled || isMeeting) {
              try {
                  screenStreamRef.current = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" } as any, audio: true });
                  addLog("Screen sync active.");
              } catch(e) { addLog("Screen sync declined.", "warn"); }
          }
          if (cameraEnabled) {
              try {
                  cameraStreamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
                  addLog("Camera sync active.");
              } catch(e) { addLog("Camera sync declined.", "warn"); }
          }
          await initializePersistentRecorder();
      }

      // 2. Audio Fabric
      const ctx = getGlobalAudioContext();
      addLog("Warming up neural fabric...");
      await warmUpAudioContext(ctx);
      setHasStarted(true);
      
      // 3. Connect Link
      await connect();
  };

  const connect = useCallback(async (isAutoRetry = false, isRotationSwap = false) => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    if (rotationTimerRef.current) clearTimeout(rotationTimerRef.current);
    
    if (isRotationSwap || isAutoRetry) {
        addLog(isRotationSwap ? "NEURAL ROTATION: Refreshing fabric for stability..." : "LINK INTERRUPTED: Attempting neural restoration...", "info");
        setIsRotating(isRotationSwap);
        setIsReconnecting(!isRotationSwap);
        
        if (serviceRef.current) {
            await serviceRef.current.disconnect();
            serviceRef.current = null;
        }
        stopAllPlatformAudio("NeuralHandover");
    } else {
        setIsConnected(false); setIsReconnecting(false); setIsRotating(false); setShowReconnectButton(false);
    }
    
    const service = new GeminiLiveService();
    serviceRef.current = service;
    
    try {
      await service.initializeAudio();
      const now = new Date();
      let effectiveInstruction = `[TIME]: ${now.toLocaleString()}.\n\n${channel.systemInstruction}`;
      
      const fullHistory = transcriptRef.current;
      const recentHistory = fullHistory.slice(-25); 
      if (recentHistory.length > 0) {
          effectiveInstruction += `\n\n[CONTEXT_STITCH]:\n${recentHistory.map(t => `${t.role}: ${t.text}`).join('\n')}\n\nContinue the current meeting exactly where it left off.`;
      }

      await service.connect(channel.voiceName, effectiveInstruction, {
          onOpen: () => { 
              if (!mountedRef.current) return;
              setIsConnected(true); setIsReconnecting(false); setIsRotating(false); setShowReconnectButton(false);
              autoReconnectAttempts.current = 0;
              addLog(isRotationSwap ? "Neural Link Refreshed." : "Neural Link Active.");

              // SCHEDULE 5-MINUTE ROTATION
              const jitter = (Math.random() * 20 - 10) * 1000;
              rotationTimerRef.current = setTimeout(() => {
                  if (mountedRef.current && isConnected) handlePreemptiveRotation();
              }, (5 * 60 * 1000) + jitter);
          },
          onClose: (reason, code) => { 
              if (!mountedRef.current) return;
              setIsConnected(false);
              if (!isRotating && autoReconnectAttempts.current < maxAutoRetries) {
                  autoReconnectAttempts.current++;
                  const backoff = 1000 + (autoReconnectAttempts.current * 1500);
                  reconnectTimeoutRef.current = setTimeout(() => connect(true), backoff);
              } else if (!isRotating) {
                  setIsReconnecting(false); setShowReconnectButton(true);
              }
          },
          onError: (err, code) => { 
              if (!mountedRef.current) return;
              setIsConnected(false); setIsReconnecting(false); setIsRotating(false);
              if (code === 'RATE_LIMIT') setIsRateLimited(true);
              else { setError(err); setShowReconnectButton(true); }
          },
          onVolumeUpdate: () => {},
          onTranscript: (text, isUser) => {
              const role = isUser ? 'user' : 'ai';
              setCurrentLine(prev => {
                  if (prev && prev.role !== role) { setTranscript(history => [...history, prev]); return { role, text, timestamp: Date.now() }; }
                  return { role, text: (prev ? prev.text : '') + text, timestamp: prev ? prev.timestamp : Date.now() };
              });
          },
          onToolCall: async (toolCall: any) => {
              for (const fc of toolCall.functionCalls) {
                  if (fc.name === 'save_content') {
                      const { filename, content } = fc.args;
                      setTranscript(h => [...h, { role: 'ai', text: `*[System]: Generated '${filename}' archived.*`, timestamp: Date.now() }]);
                      serviceRef.current?.sendToolResponse([{ id: fc.id, name: fc.name, response: { result: "Success" } }]);
                  } else if (onCustomToolCall) {
                      const result = await onCustomToolCall(fc.name, fc.args);
                      serviceRef.current?.sendToolResponse([{ id: fc.id, name: fc.name, response: { result } }]);
                  }
              }
          }
      }, [{ functionDeclarations: [saveContentTool] }]);

    } catch (e: any) { 
        if (!mountedRef.current) return;
        setIsReconnecting(false); setIsRotating(false); setIsConnected(false); 
        const isRate = e.message?.includes('429');
        setIsRateLimited(isRate);
        setError(isRate ? null : (e.message || "Link Timeout"));
        setShowReconnectButton(true);
    }
  }, [channel.id, channel.voiceName, channel.systemInstruction, recordingEnabled, initializePersistentRecorder, onCustomToolCall, isRotating, isConnected, addLog]);

  const handlePreemptiveRotation = async (force: boolean = false) => {
    if (!mountedRef.current) return;
    if (!force && serviceRef.current && (serviceRef.current as any).isPlayingResponse) {
        addLog("Neural Rotation: Waiting for AI silence...", "info");
        rotationTimerRef.current = setTimeout(() => handlePreemptiveRotation(false), 2500);
        return;
    }
    connect(false, true); 
  };

  const handleStopLink = async () => {
    addLog("HUMAN PAUSE: Severing AI connection temporarily...", "warn");
    setIsConnected(false); setIsReconnecting(false); setIsRotating(false);
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    if (rotationTimerRef.current) clearTimeout(rotationTimerRef.current);
    if (serviceRef.current) await serviceRef.current.disconnect();
  };

  const handleDisconnect = async () => {
      addLog("Terminating Session...");
      autoReconnectAttempts.current = maxAutoRetries; 
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (rotationTimerRef.current) clearTimeout(rotationTimerRef.current);
      
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
      } else {
          onEndSession();
      }
      
      if (serviceRef.current) await serviceRef.current.disconnect();
  };

  const renderMessageContent = (text: string) => {
    const parts = text.split(/```/);
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return (
          <div key={index} className="my-3 rounded-xl overflow-hidden border border-slate-700 bg-slate-950 shadow-lg animate-fade-in">
             <div className="flex items-center justify-between px-4 py-2 bg-slate-800/80 border-b border-slate-700">
               <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Neural Artifact</span>
               <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(part); }} className="text-[10px] font-bold text-slate-500 hover:text-indigo-400 flex items-center gap-1"><Copy size={10} /><span>Copy</span></button>
             </div>
             <pre className="p-4 text-sm font-mono text-indigo-200 overflow-x-auto whitespace-pre-wrap">{part}</pre>
          </div>
        );
      }
      return part.split(/\n\s*\n/).map((p, pi) => p.trim() ? <p key={`${index}-${pi}`} className="mb-3 last:mb-0 leading-relaxed">{p}</p> : null);
    });
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 relative">
      <div className="p-4 flex items-center justify-between bg-slate-900 border-b border-slate-800 shrink-0 z-20">
         <div className="flex items-center space-x-3">
            <img src={channel.imageUrl} className="w-10 h-10 rounded-full border border-slate-700 object-cover" alt={channel.title} />
            <div>
               <h2 className="text-sm font-bold text-white leading-tight">{channel.title}</h2>
               <div className="flex items-center gap-2">
                   <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : (isReconnecting || isRotating || isRateLimited) ? 'bg-amber-500 animate-pulse' : 'bg-red-500'}`} />
                   <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">
                       {isConnected ? 'Link Active' : isRotating ? 'Neural Swap...' : isReconnecting ? 'Recovery...' : isRateLimited ? 'Neural Cooling' : t.stopped}
                   </span>
               </div>
            </div>
         </div>
         <div className="flex items-center gap-2">
            <button onClick={() => handlePreemptiveRotation(true)} className="p-2 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-lg border border-indigo-500/20 transition-all active:scale-95" title={t.forceRestart}><RefreshCw size={18}/></button>
            <button onClick={handleStopLink} className="p-2 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white rounded-lg border border-red-500/20 transition-all active:scale-95" title={t.stopLink}><Square size={18}/></button>
            <div className="w-px h-6 bg-slate-800 mx-1"></div>
            <button onClick={() => setShowDiagnostics(!showDiagnostics)} className={`p-2 rounded-lg transition-colors ${showDiagnostics ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`} title={t.diagnostics}><Activity size={18}/></button>
            <button onClick={handleDisconnect} className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-colors">Terminate</button>
         </div>
      </div>

      {(isRotating || isReconnecting) && (
          <div className="bg-indigo-600/20 border-b border-indigo-500/30 p-2 px-4 flex items-center justify-center animate-fade-in z-20 gap-3">
              <RefreshCcw size={12} className="animate-spin text-indigo-400"/>
              <span className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em]">{isRotating ? t.rotating : t.reconnecting}</span>
          </div>
      )}

      {hasStarted && cameraEnabled && (
          <div className="absolute bottom-20 right-6 w-48 aspect-video md:w-64 bg-black border-2 border-indigo-500 rounded-2xl shadow-2xl z-40 overflow-hidden group">
              <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover mirror" />
          </div>
      )}

      {showDiagnostics && (
          <div className="absolute top-16 right-4 w-80 max-h-[70%] z-[100] bg-slate-900/95 border border-slate-700 rounded-2xl shadow-2xl flex flex-col animate-fade-in-down backdrop-blur-md">
              <div className="p-3 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center"><span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2"><Terminal size={14}/> {t.diagnostics}</span><button onClick={() => setShowDiagnostics(false)} className="text-slate-500 hover:text-white"><X size={16}/></button></div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-[10px]">{logs.map((log, i) => (<div key={i} className={`flex gap-2 ${log.type === 'error' ? 'text-red-400' : log.type === 'warn' ? 'text-amber-400' : 'text-slate-400'}`}><span className="opacity-40 shrink-0">[{log.time}]</span><span className="break-words font-black">{log.msg}</span></div>))}</div>
          </div>
      )}

      {!hasStarted ? (
         <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
             <div className="w-20 h-20 bg-indigo-600/10 rounded-full flex items-center justify-center animate-pulse shadow-2xl shadow-indigo-500/10"><Mic size={40} className="text-indigo-500" /></div>
             <div><h3 className="text-xl font-bold text-white uppercase tracking-tighter italic">{t.tapToStart}</h3><p className="text-slate-400 text-sm mt-2 max-w-xs leading-relaxed">{t.tapDesc}</p></div>
             <button onClick={handleStartSession} className="px-12 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest rounded-full shadow-2xl shadow-indigo-500/30 transition-transform hover:scale-105 active:scale-95">Link Neural Fabric</button>
         </div>
      ) : (
         <div className="flex-1 flex flex-col min-h-0 relative">
            {isUploadingRecording && (
               <div className="absolute inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center gap-8 animate-fade-in">
                  <div className="relative">
                    <div className="w-32 h-32 border-4 border-indigo-500/10 rounded-full" />
                    <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl font-black text-white">SYNC</div>
                  </div>
                  <div className="text-center"><span className="text-sm font-black text-white uppercase tracking-widest">{t.uploading}</span></div>
               </div>
            )}

            {!isConnected && !isReconnecting && !isRotating && !error && !isRateLimited && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-fade-in gap-6">
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 size={32} className="text-indigo-500 animate-spin" />
                        <p className="text-xs font-black text-indigo-300 uppercase tracking-widest">Neural Link Inactive</p>
                    </div>
                    <button onClick={() => connect()} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase rounded-xl shadow-xl transition-all flex items-center gap-2"><RefreshCw size={14}/><span>Resume AI Conversation</span></button>
                </div>
            )}
            
            <div className="shrink-0 bg-slate-950"><SuggestionsBar suggestions={suggestions} welcomeMessage={channel.welcomeMessage} showWelcome={transcript.length === 0 && !currentLine && !initialContext} uiText={t} /></div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
               {transcript.map((item, index) => (
                   <div key={index} className={`flex flex-col ${item.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in-up`}>
                       <span className={`text-[10px] uppercase font-bold tracking-wider mb-1 ${item.role === 'user' ? 'text-indigo-400' : 'text-emerald-400'}`}>{item.role === 'user' ? 'You' : channel.author}</span>
                       <div className={`max-w-[90%] px-4 py-3 rounded-2xl text-sm leading-relaxed relative group ${item.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm shadow-xl' : 'bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700 shadow-md'}`}>
                           {renderMessageContent(item.text)}
                       </div>
                   </div>
               ))}
               {currentLine && (
                   <div className={`flex flex-col ${currentLine.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in`}>
                       <span className={`text-[10px] uppercase font-bold tracking-wider mb-1 ${currentLine.role === 'user' ? 'text-indigo-400' : 'text-emerald-400'}`}>{currentLine.role === 'user' ? 'You' : channel.author}</span>
                       <div className={`max-w-[90%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${currentLine.role === 'user' ? 'bg-indigo-600/80 text-white rounded-tr-sm shadow-xl' : 'bg-slate-800/80 text-slate-200 rounded-tl-sm border border-slate-700 shadow-md'}`}>
                           {renderMessageContent(currentLine.text)}<span className="inline-block w-1.5 h-4 ml-1 align-middle bg-current opacity-50 animate-blink"></span>
                       </div>
                   </div>
               )}
            </div>

            {showReconnectButton && !isReconnecting && !isRotating && (
                <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-col items-center gap-3 shrink-0 animate-fade-in">
                    <div className="p-2 bg-red-900/20 rounded-full text-red-400"><AlertCircle size={24}/></div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Neural link encountered a terminal interruption</p>
                    <button onClick={() => connect()} className="flex items-center gap-2 px-10 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase rounded-xl shadow-xl shadow-indigo-500/20 transition-all active:scale-95"><RefreshCw size={14}/><span>{t.reconnect}</span></button>
                </div>
            )}

            <div className="p-3 border-t border-slate-800 bg-slate-900 flex items-center justify-between shrink-0 z-20 shadow-[0_-10px_20px_rgba(0,0,0,0.4)]">
                <div className="flex items-center space-x-2 text-slate-500 text-[10px] font-black uppercase tracking-widest"><ScrollText size={14} className="text-indigo-400"/><span>{t.transcript}</span></div>
                <div className="flex items-center gap-2">
                    <button onClick={handleDisconnect} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"><Save size={16}/></button>
                </div>
            </div>
         </div>
      )}
    </div>
  );
};
