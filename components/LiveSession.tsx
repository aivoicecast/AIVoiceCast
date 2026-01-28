
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Channel, TranscriptItem, GeneratedLecture, CommunityDiscussion, RecordingSession, Attachment, UserProfile, ViewID } from '../types';
import { GeminiLiveService } from '../services/geminiLive';
import { Mic, MicOff, PhoneOff, Radio, AlertCircle, ScrollText, RefreshCw, Music, Download, Share2, Trash2, Quote, Copy, Check, MessageSquare, BookPlus, Loader2, Globe, FilePlus, Play, Save, CloudUpload, Link, X, Video, Monitor, Camera, Youtube, ClipboardList, Maximize2, Minimize2, Activity, Terminal, ShieldAlert, LogIn, Wifi, WifiOff, Zap, ShieldCheck, Thermometer, RefreshCcw, Sparkles, Square, Power, Database, Timer, MessageSquareOff } from 'lucide-react';
import { auth } from '../services/firebaseConfig';
import { getDriveToken, signInWithGoogle, isJudgeSession } from '../services/authService';
import { uploadToYouTube, getYouTubeVideoUrl } from '../services/youtubeService';
import { ensureCodeStudioFolder, uploadToDrive } from '../services/googleDriveService';
import { saveUserChannel, cacheLectureScript, getCachedLectureScript, saveLocalRecording } from '../utils/db';
import { publishChannelToFirestore, saveDiscussion, saveRecordingReference, updateBookingRecording, addChannelAttachment, updateDiscussion, syncUserProfile, getUserProfile, uploadFileToStorage } from '../services/firestoreService';
import { summarizeDiscussionAsSection, generateDesignDocFromTranscript } from '../services/lectureGenerator';
import { FunctionDeclaration, Type } from '@google/genai';
import { getGlobalAudioContext, getGlobalMediaStreamDest, warmUpAudioContext, stopAllPlatformAudio } from '../utils/audioUtils';
import { Visualizer } from './Visualizer';

interface LiveSessionProps {
  channel: Channel;
  initialContext?: string;
  lectureId?: string;
  onEndSession: () => void;
  language: 'en' | 'zh';
  recordingEnabled?: boolean;
  recordingDuration?: number;
  interactionEnabled?: boolean;
  videoEnabled?: boolean;
  cameraEnabled?: boolean;
  recordScreen?: boolean;
  recordCamera?: boolean;
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
    rotating: "Neural Rotation (15min Checkpoint)...",
    forceRestart: "Neural Refresh (Fix Hang)",
    stopLink: "Pause AI Link",
    stopped: "AI Paused",
    checkpoint: "Neural Checkpoint",
    scribeActive: "Silent Scribe Mode Active",
    studio: "Interactive Studio",
    macAudioWarn: "MAC USERS: Ensure 'Share Audio' is checked in the browser dialog to capture system sounds."
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
    rotating: "神经轮换 (15分钟检查点)...",
    forceRestart: "神经刷新 (修复卡顿)",
    stopLink: "暂停 AI 连接",
    stopped: "AI 已暂停",
    checkpoint: "神经检查点",
    scribeActive: "静默速记模式已激活",
    studio: "互动工作室",
    macAudioWarn: "MAC 用户：请确保在浏览器共享对话框中勾选“共享音频”以录制系统声音。"
  }
};

const SuggestionsBar: React.FC<{ suggestions: string[], welcomeMessage?: string, showWelcome: boolean, uiText: any }> = ({ suggestions, welcomeMessage, showWelcome, uiText }) => {
  if (showWelcome && welcomeMessage) {
    return (
      <div className="p-4 border-b border-slate-800 bg-indigo-900/10 animate-fade-in">
        <p className="text-xs text-indigo-300 font-medium leading-relaxed italic">
          "{welcomeMessage}"
        </p>
      </div>
    );
  }
  if (suggestions.length === 0) return null;
  return (
    <div className="p-2 border-b border-slate-800 overflow-x-auto scrollbar-hide">
      <div className="flex gap-2">
        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest self-center px-2">{uiText.welcomePrefix}</span>
        {suggestions.map((s, i) => (
          <button key={i} className="whitespace-nowrap px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-full text-[10px] font-bold text-slate-400 hover:text-indigo-400 hover:border-indigo-500/50 transition-all active:scale-95">
            {s}
          </button>
        ))}
      </div>
    </div>
  );
};

export const LiveSession: React.FC<LiveSessionProps> = ({ 
  channel, initialContext, lectureId, onEndSession, language, 
  recordingEnabled, recordingDuration, interactionEnabled = true, videoEnabled, cameraEnabled, 
  recordScreen: propRecordScreen, recordCamera: propRecordCamera,
  activeSegment, initialTranscript, existingDiscussionId,
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
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [logs, setLogs] = useState<{time: string, msg: string, type: 'info' | 'error' | 'warn'}[]>([]);
  const [volume, setVolume] = useState(0);

  // COUNTDOWN STATE
  const [scribeTimeLeft, setScribeTimeLeft] = useState(recordingDuration || 180);
  
  // PERSISTENT RECORDING REFS
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const compositorAnimationFrameRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const reconnectTimeoutRef = useRef<any>(null);
  const rotationTimerRef = useRef<any>(null);
  const checkpointTimerRef = useRef<any>(null);
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
          if (checkpointTimerRef.current) clearInterval(checkpointTimerRef.current);
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          if (compositorAnimationFrameRef.current) cancelAnimationFrame(compositorAnimationFrameRef.current);
      };
  }, [transcript, currentLine]);

  // SCRIBE TIMER EFFECT
  useEffect(() => {
    if (hasStarted && recordingEnabled && isConnected && scribeTimeLeft > 0) {
      const timer = setInterval(() => {
        setScribeTimeLeft(prev => {
          if (prev <= 1) {
            addLog("Recording limit reached. Finalizing neural artifact...", "warn");
            handleDisconnect(); 
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [hasStarted, recordingEnabled, isConnected, scribeTimeLeft]);

  const serviceRef = useRef<GeminiLiveService | null>(null);
  const currentUser = auth?.currentUser;

  const initializePersistentRecorder = useCallback(async () => {
    if (!recordingEnabled || !currentUser) return;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') return;

    try {
        addLog(`Initializing Scribe (Fidelity Loop Active)...`);
        const ctx = getGlobalAudioContext();
        const recordingDest = getGlobalMediaStreamDest();
        
        if (ctx.state !== 'running') await ctx.resume();

        const userStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const userSource = ctx.createMediaStreamSource(userStream); 
        userSource.connect(recordingDest);

        if (screenStreamRef.current && screenStreamRef.current.getAudioTracks().length > 0) {
            addLog("Bridging system audio to recording bus...");
            const screenAudioSource = ctx.createMediaStreamSource(screenStreamRef.current);
            screenAudioSource.connect(recordingDest);
        }

        const canvas = document.createElement('canvas');
        const isPortrait = window.innerHeight > window.innerWidth;
        canvas.width = isPortrait ? 720 : 1280;
        canvas.height = isPortrait ? 1280 : 720;
        const drawCtx = canvas.getContext('2d', { alpha: false })!;
        
        const createCaptureVideo = (stream: MediaStream | null) => {
            const v = document.createElement('video');
            v.muted = true; 
            v.playsInline = true; 
            v.autoplay = true;
            v.style.position = 'fixed'; 
            v.style.left = '0px'; 
            v.style.top = '0px';
            v.style.width = '320px'; 
            v.style.height = '180px';
            v.style.pointerEvents = 'none';
            v.style.opacity = '0.001';
            v.style.zIndex = '-1';
            if (stream) { 
                v.srcObject = stream; 
                document.body.appendChild(v); 
                v.play().catch(e => addLog("Video playback failed: " + e.message, "error")); 
            }
            return v;
        };

        const screenVideo = createCaptureVideo(screenStreamRef.current);
        const cameraVideo = createCaptureVideo(cameraStreamRef.current);

        let lastPulseTime = 0;
        const renderLoop = (now: number) => {
            if (!mountedRef.current) return;
            
            drawCtx.fillStyle = '#020617'; 
            drawCtx.fillRect(0, 0, canvas.width, canvas.height);
            
            if (screenStreamRef.current && screenVideo.readyState >= 2) {
                const scale = Math.min(canvas.width / screenVideo.videoWidth, canvas.height / screenVideo.videoHeight);
                const w = screenVideo.videoWidth * scale; 
                const h = screenVideo.videoHeight * scale;
                drawCtx.drawImage(screenVideo, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
            }

            if (cameraStreamRef.current && cameraVideo.readyState >= 2) {
                const pipW = isPortrait ? canvas.width * 0.4 : 320;
                const pipH = (pipW * cameraVideo.videoHeight) / cameraVideo.videoWidth;
                const pipX = isPortrait ? (canvas.width - pipW) / 2 : canvas.width - pipW - 40;
                const pipY = isPortrait ? canvas.height - pipH - 180 : canvas.height - pipH - 40;
                
                drawCtx.shadowColor = 'rgba(0,0,0,0.5)';
                drawCtx.shadowBlur = 20;
                drawCtx.strokeStyle = '#6366f1'; 
                drawCtx.lineWidth = 4;
                drawCtx.strokeRect(pipX, pipY, pipW, pipH); 
                drawCtx.drawImage(cameraVideo, pipX, pipY, pipW, pipH);
                drawCtx.shadowBlur = 0;
            }

            // High-Frequency Neural Pulse for Encoder Freshness
            if (now - lastPulseTime > 50) {
                drawCtx.fillStyle = `rgba(99, 102, 241, ${Math.random() * 0.08})`;
                drawCtx.fillRect(0, 0, 2, 2);
                lastPulseTime = now;
            }

            compositorAnimationFrameRef.current = requestAnimationFrame(renderLoop);
        };

        compositorAnimationFrameRef.current = requestAnimationFrame(renderLoop);
        await new Promise(resolve => setTimeout(resolve, 2000));

        const captureStream = canvas.captureStream(30);
        recordingDest.stream.getAudioTracks().forEach(track => captureStream.addTrack(track));
        
        const recorder = new MediaRecorder(captureStream, { 
            mimeType: 'video/webm;codecs=vp8,opus', 
            videoBitsPerSecond: 5000000 
        });
        
        audioChunksRef.current = []; 
        recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
        recorder.onstop = async () => {
            if (compositorAnimationFrameRef.current) cancelAnimationFrame(compositorAnimationFrameRef.current);
            const videoBlob = new Blob(audioChunksRef.current, { type: 'video/webm' });
            const transcriptText = transcriptRef.current.map(t => `[${new Date(t.timestamp).toLocaleTimeString()}] ${t.role.toUpperCase()}: ${t.text}`).join('\n\n');
            const transcriptBlob = new Blob([transcriptText], { type: 'text/plain' });
            
            setIsUploadingRecording(true);
            try {
                const timestamp = Date.now();
                const recId = `session-${timestamp}`;
                await saveLocalRecording({
                    id: recId, userId: currentUser.uid, channelId: channel.id, 
                    channelTitle: channel.title, channelImage: channel.imageUrl, 
                    timestamp, mediaUrl: URL.createObjectURL(videoBlob), 
                    mediaType: 'video/webm' as any, transcriptUrl: URL.createObjectURL(transcriptBlob), 
                    blob: videoBlob, size: videoBlob.size
                });

                const isJudge = isJudgeSession();
                if (isJudge) {
                    const fbVideoUrl = await uploadFileToStorage(`recordings/${currentUser.uid}/${recId}.webm`, videoBlob);
                    const fbTranscriptUrl = await uploadFileToStorage(`recordings/${currentUser.uid}/${recId}_transcript.txt`, transcriptBlob);
                    await saveRecordingReference({
                        id: recId, userId: currentUser.uid, channelId: channel.id, 
                        channelTitle: channel.title, channelImage: channel.imageUrl, 
                        timestamp, mediaUrl: fbVideoUrl, driveUrl: fbVideoUrl, 
                        mediaType: 'video/webm' as any, transcriptUrl: fbTranscriptUrl, 
                        size: videoBlob.size
                    });
                } else {
                    const token = getDriveToken();
                    if (token) {
                        const folderId = await ensureCodeStudioFolder(token);
                        const driveVideoUrl = `drive://${await uploadToDrive(token, folderId, `${recId}.webm`, videoBlob)}`;
                        const tFileId = await uploadToDrive(token, folderId, `${recId}_transcript.txt`, transcriptBlob);
                        await saveRecordingReference({
                            id: recId, userId: currentUser.uid, channelId: channel.id, 
                            channelTitle: channel.title, channelImage: channel.imageUrl, 
                            timestamp, mediaUrl: driveVideoUrl, driveUrl: driveVideoUrl, 
                            mediaType: 'video/webm' as any, transcriptUrl: `drive://${tFileId}`, 
                            size: videoBlob.size
                        });
                    }
                }
            } catch(e: any) { addLog("Backup failed: " + e.message, "error"); } 
            finally { setIsUploadingRecording(false); onEndSession(); }
            
            userStream.getTracks().forEach(t => t.stop());
            if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach(t => t.stop());
            if (cameraStreamRef.current) cameraStreamRef.current.getTracks().forEach(t => t.stop());
            screenVideo.remove(); 
            cameraVideo.remove();
        };
        
        mediaRecorderRef.current = recorder;
        recorder.start(1000);
        addLog("Neural Recording initialized.");
    } catch(e: any) { addLog("Init Error: " + e.message, "error"); }
  }, [recordingEnabled, currentUser, channel, onEndSession, addLog, recordingDuration]);

  const handleStartSession = async () => {
      setError(null);
      setIsRateLimited(false);
      autoReconnectAttempts.current = 0;
      if (recordingEnabled) {
          try {
              addLog("Requesting display access...");
              screenStreamRef.current = await navigator.mediaDevices.getDisplayMedia({ 
                  video: { 
                      cursor: "always",
                      width: { ideal: 1920 },
                      height: { ideal: 1080 }
                  } as any, 
                  audio: {
                      echoCancellation: true,
                      noiseSuppression: true,
                      autoGainControl: true
                  },
                  // @ts-ignore
                  systemAudio: "include",
                  selfBrowserSurface: "exclude" 
              } as any);
              
              if (cameraEnabled) {
                  cameraStreamRef.current = await navigator.mediaDevices.getUserMedia({ 
                      video: { width: 640, height: 480 }, 
                      audio: false 
                  });
              }
              await initializePersistentRecorder();
          } catch(e: any) { addLog("Capture denied: " + e.message, "warn"); }
      }
      const ctx = getGlobalAudioContext();
      await warmUpAudioContext(ctx);
      setHasStarted(true);
      await connect();
  };

  const connect = useCallback(async (isAutoRetry = false, isRotationSwap = false) => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    if (rotationTimerRef.current) clearTimeout(rotationTimerRef.current);
    if (checkpointTimerRef.current) clearInterval(checkpointTimerRef.current);
    
    if (isRotationSwap || isAutoRetry) {
        setIsRotating(isRotationSwap); setIsReconnecting(!isRotationSwap);
        if (serviceRef.current) await serviceRef.current.disconnect();
        stopAllPlatformAudio("NeuralHandover");
    } else {
        setIsConnected(false); setIsReconnecting(false); setIsRotating(false); setShowReconnectButton(false);
    }
    
    const service = new GeminiLiveService();
    serviceRef.current = service;
    
    try {
      await service.initializeAudio();
      let effectiveInstruction = `[TIME]: ${new Date().toLocaleString()}.\n\n${channel.systemInstruction}`;
      
      if (recordingEnabled) {
          if (!interactionEnabled) {
              // Fixed: Replaced missing 'meetingTitle' with 'initialContext'
              effectiveInstruction = `[CRITICAL MODE: PASSIVE SCRIBE]
              YOU ARE A SILENT OBSERVER. 
              YOU MUST NOT GENERATE ANY AUDIO OUTPUT. 
              YOU MUST NOT SPEAK UNDER ANY CIRCUMSTANCES.
              STAY 100% SILENT.
              YOUR ONLY TASK IS TO LISTEN AND PROVIDE ACCURATE REAL-TIME TRANSCRIPTIONS OF THE MEETING IN THE 'outputAudioTranscription' OR 'onTranscript' CHANNEL.
              IF YOU ARE CALLED UPON, DO NOT RESPOND VERBALLY.
              
              CONTEXT: ${initialContext || channel.title}`;
              addLog("Neural mode: SILENT SCRIBE (Passive Observer) engaged.");
          } else {
              effectiveInstruction = `[CRITICAL MODE: ACTIVE SCRIBE]
              You are an advanced meeting transcriber and participant.
              LIMIT: ${recordingDuration} seconds.
              
              ORIGINAL PERSONA: ${channel.systemInstruction}`;
              addLog("Neural mode: ACTIVE SCRIBE (Interaction On) engaged.");
          }
      }

      await service.connect(channel.voiceName, effectiveInstruction, {
          onOpen: () => { 
              if (!mountedRef.current) return;
              setIsConnected(true); setIsReconnecting(false); setIsRotating(false);
          },
          onClose: () => { 
              if (!mountedRef.current) return;
              setIsConnected(false);
              if (!isRotating && autoReconnectAttempts.current < maxAutoRetries) {
                  autoReconnectAttempts.current++;
                  reconnectTimeoutRef.current = setTimeout(() => connect(true), 1000 + (autoReconnectAttempts.current * 1500));
              } else if (!isRotating) { setIsReconnecting(false); setShowReconnectButton(true); }
          },
          onError: (err, code) => { 
              setIsConnected(false); setIsReconnecting(false); setIsRotating(false);
              if (code === 'RATE_LIMIT') setIsRateLimited(true);
              else { setError(err); setShowReconnectButton(true); }
          },
          onVolumeUpdate: (v) => setVolume(v),
          onTranscript: (text, isUser) => {
              const role = isUser ? 'user' : 'ai';
              const timestamp = Date.now();
              const parts = text.split(/\n\n+/);
              parts.forEach((part, idx) => {
                  if (!part.trim()) return;
                  setCurrentLine(prev => {
                      if (prev && (idx > 0 || prev.role !== role)) {
                          setTranscript(history => [...history, prev]);
                          return { role, text: part, timestamp };
                      }
                      return { 
                          role, 
                          text: (prev ? prev.text : '') + (idx > 0 ? '\n\n' : '') + part, 
                          timestamp: prev ? prev.timestamp : timestamp 
                      };
                  });
              });
          },
          // INTERCEPT AUDIO IF INTERACTION IS DISABLED
          onAudioData: (data) => {
              return interactionEnabled; 
          }
      }, [], screenStreamRef.current ? (
          (() => {
              const ctx = getGlobalAudioContext();
              const userStream = navigator.mediaDevices.getUserMedia({ audio: true });
              const mergedDest = ctx.createMediaStreamDestination();
              // This is a complex mixin - simplify: the service handles standard user audio.
              return undefined; 
          })()
      ) : undefined);
    } catch (e: any) { 
        setIsReconnecting(false); setIsRotating(false); setIsConnected(false); 
        setError(e.message?.includes('429') ? null : e.message); setShowReconnectButton(true);
    }
    // Fixed: Added initialContext to dependency array and removed missing meetingTitle
  }, [channel.id, channel.voiceName, channel.systemInstruction, recordingEnabled, isRotating, isConnected, addLog, recordingDuration, interactionEnabled, initialContext]);

  const handleDisconnect = async () => {
      autoReconnectAttempts.current = maxAutoRetries; 
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
      else onEndSession();
      if (serviceRef.current) await serviceRef.current.disconnect();
  };

  const renderMessageContent = (text: string) => {
    const parts = text.split(/```/);
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return (
          <div key={index} className="my-3 rounded-xl overflow-hidden border border-slate-700 bg-slate-950 shadow-lg animate-fade-in">
             <pre className="p-4 text-sm font-mono text-indigo-100 overflow-x-auto whitespace-pre-wrap">{part}</pre>
          </div>
        );
      }
      return part.split(/\n\s*\n/).map((p, pi) => p.trim() ? <p key={`${index}-${pi}`} className="mb-3 last:mb-0 leading-relaxed">{p}</p> : null);
    });
  };

  const isTuned = channel.voiceName.includes('gen-lang-client');
  const formatScribeTime = (secs: number) => {
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 relative">
      <div className="p-4 flex items-center justify-between bg-slate-900 border-b border-slate-800 shrink-0 z-20">
         <div className="flex items-center space-x-3">
            {!recordingEnabled && <img src={channel.imageUrl} className="w-10 h-10 rounded-full border border-slate-700 object-cover" alt={channel.title} />}
            <div>
               <div className="flex items-center gap-2">
                   <h2 className="text-sm font-bold text-white leading-tight">
                     {channel.title}
                   </h2>
                   <span className="text-[8px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full uppercase font-black tracking-widest border border-slate-700">
                     {t.studio}
                   </span>
               </div>
               <div className="flex items-center gap-2">
                   <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-red-500'}`} />
                   <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">
                       {isConnected ? (recordingEnabled ? (interactionEnabled ? 'Active Participation' : t.scribeActive) : 'Link Active') : t.stopped}
                   </span>
               </div>
            </div>
         </div>
         <div className="flex items-center gap-4">
            {recordingEnabled && isConnected && (
                <div className={`flex items-center gap-2 px-4 py-1.5 rounded-xl border transition-all ${scribeTimeLeft < 30 ? 'bg-red-600/20 border-red-500 text-red-400 animate-pulse' : 'bg-slate-950 border-slate-800 text-slate-300'}`}>
                    <Timer size={14}/>
                    <span className="text-xs font-mono font-black">{formatScribeTime(scribeTimeLeft)}</span>
                </div>
            )}
            <div className="flex items-center gap-2">
                {isTuned && (
                <span className="hidden md:flex items-center gap-1.5 bg-indigo-600/20 text-indigo-400 px-3 py-1 rounded-full border border-indigo-500/30 text-[9px] font-black uppercase tracking-widest animate-fade-in shadow-lg">
                    <Zap size={10} fill="currentColor" />
                    Tuned Engine
                </span>
                )}
                <button onClick={() => setShowDiagnostics(!showDiagnostics)} className={`p-2 rounded-lg transition-colors ${showDiagnostics ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}><Activity size={18}/></button>
                <button onClick={handleDisconnect} className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-colors">Terminate</button>
            </div>
         </div>
      </div>

      {!hasStarted ? (
         <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
             <div className="w-20 h-20 bg-indigo-600/10 rounded-full flex items-center justify-center animate-pulse shadow-2xl shadow-indigo-500/10"><Mic size={40} className="text-indigo-500" /></div>
             <div><h3 className="text-xl font-bold text-white uppercase tracking-tighter italic">{t.tapToStart}</h3><p className="text-slate-400 text-sm mt-2 max-w-xs leading-relaxed">{t.tapDesc}</p></div>
             
             {recordingEnabled && (
                 <div className="space-y-4 max-w-sm w-full">
                    <div className="bg-amber-900/10 border border-amber-500/20 p-4 rounded-2xl flex items-start gap-3 animate-fade-in">
                        <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={16}/>
                        <p className="text-[10px] text-amber-200 leading-relaxed font-bold uppercase text-left">{t.macAudioWarn}</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between animate-fade-in">
                        <div className="flex items-center gap-3">
                            {interactionEnabled ? <MessageSquare className="text-emerald-400" size={16}/> : <MessageSquareOff className="text-slate-500" size={16}/>}
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{interactionEnabled ? 'AI Interaction Active' : 'Silent Scribe Only'}</span>
                        </div>
                    </div>
                 </div>
             )}

             <button onClick={handleStartSession} className="px-12 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest rounded-full shadow-2xl shadow-indigo-500/30 transition-transform hover:scale-105 active:scale-95">Link Neural Fabric</button>
         </div>
      ) : (
         <div className="flex-1 flex flex-col min-0 relative">
            {isUploadingRecording && (
               <div className="absolute inset-0 z-[120] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center gap-8 animate-fade-in">
                  <div className="relative"><div className="w-32 h-32 border-4 border-indigo-500/10 rounded-full" /><div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /><div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl font-black text-white">SYNC</div></div>
                  <div className="text-center"><span className="text-sm font-black text-white uppercase tracking-widest">{t.uploading}</span></div>
               </div>
            )}
            
            {!recordingEnabled && <div className="shrink-0 bg-slate-950"><SuggestionsBar suggestions={suggestions} welcomeMessage={channel.welcomeMessage} showWelcome={transcript.length === 0 && !currentLine && !initialContext} uiText={t} /></div>}

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
               {transcript.map((item, index) => {
                   const isCheckpoint = item.text.includes('[CHECKPOINT SUMMARY]');
                   return (
                   <div key={index} className={`flex flex-col ${item.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in-up`}>
                       {recordingEnabled && <span className="text-[9px] text-slate-600 font-mono mb-1">[{new Date(item.timestamp).toLocaleTimeString()}]</span>}
                       {!recordingEnabled && <span className={`text-[10px] uppercase font-bold tracking-wider mb-1 ${item.role === 'user' ? 'text-indigo-400' : 'text-emerald-400'}`}>{item.role === 'user' ? 'You' : channel.author}</span>}
                       <div className={`max-w-[90%] px-4 py-3 rounded-2xl text-sm leading-relaxed relative group ${isCheckpoint ? 'bg-indigo-900/30 border-2 border-indigo-500/50 text-indigo-100 italic' : item.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm shadow-xl' : 'bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700 shadow-md'}`}>
                           {isCheckpoint && <div className="flex items-center gap-2 mb-2 text-[10px] font-black uppercase text-indigo-400 tracking-widest"><Zap size={10} fill="currentColor"/> Summary Checkpoint</div>}
                           {renderMessageContent(item.text)}
                       </div>
                   </div>
               )})}
               {currentLine && (
                   <div className={`flex flex-col ${currentLine.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in`}>
                       {!recordingEnabled && <span className={`text-[10px] uppercase font-bold tracking-wider mb-1 ${currentLine.role === 'user' ? 'text-indigo-400' : 'text-emerald-400'}`}>{currentLine.role === 'user' ? 'You' : channel.author}</span>}
                       <div className={`max-w-[90%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${currentLine.role === 'user' ? 'bg-indigo-600/80 text-white rounded-tr-sm shadow-xl' : 'bg-slate-800/80 text-slate-200 rounded-tl-sm border border-slate-700 shadow-md'}`}>
                           {renderMessageContent(currentLine.text)}<span className="inline-block w-1.5 h-4 ml-1 align-middle bg-current opacity-50 animate-blink"></span>
                       </div>
                   </div>
               )}
            </div>

            <div className="px-6 py-4 bg-slate-900 border-t border-slate-800 flex flex-col items-center gap-4">
              <div className="w-full flex justify-center h-48">
                 <Visualizer volume={volume} isActive={isConnected} color={!interactionEnabled ? '#94a3b8' : isTuned ? '#a855f7' : '#6366f1'} />
              </div>
              <div className="w-full flex items-center justify-between shrink-0 z-20">
                  <div className="flex items-center space-x-2 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                      {!interactionEnabled ? <MessageSquareOff size={14} className="text-slate-600"/> : <ScrollText size={14} className="text-indigo-400"/>}
                      <span>{!interactionEnabled ? 'Neural Listener Active' : t.transcript}</span>
                  </div>
                  <div className="flex gap-2"><button onClick={handleDisconnect} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"><Save size={16}/></button></div>
              </div>
            </div>
         </div>
      )}
    </div>
  );
};
