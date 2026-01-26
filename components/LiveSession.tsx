
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Channel, TranscriptItem, GeneratedLecture, CommunityDiscussion, RecordingSession, Attachment, UserProfile, ViewID } from '../types';
import { GeminiLiveService } from '../services/geminiLive';
import { Mic, MicOff, PhoneOff, Radio, AlertCircle, ScrollText, RefreshCw, Music, Download, Share2, Trash2, Quote, Copy, Check, MessageSquare, BookPlus, Loader2, Globe, FilePlus, Play, Save, CloudUpload, Link, X, Video, Monitor, Camera, Youtube, ClipboardList, Maximize2, Minimize2, Activity, Terminal, ShieldAlert, LogIn, Wifi, WifiOff, Zap, ShieldCheck, Thermometer, RefreshCcw, Sparkles, Square, Power, Database } from 'lucide-react';
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
    rotating: "Neural Rotation (15min Checkpoint)...",
    forceRestart: "Neural Refresh (Fix Hang)",
    stopLink: "Pause AI Link",
    stopped: "AI Paused",
    checkpoint: "Neural Checkpoint",
    scribeActive: "Silent Scribe Mode Active",
    studio: "Interactive Studio"
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
    studio: "互动工作室"
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
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [logs, setLogs] = useState<{time: string, msg: string, type: 'info' | 'error' | 'warn'}[]>([]);
  const [volume, setVolume] = useState(0);
  
  // PERSISTENT RECORDING REFS
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const compositorIntervalRef = useRef<any>(null);
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
          if (compositorIntervalRef.current) clearInterval(compositorIntervalRef.current);
      };
  }, [transcript, currentLine]);

  const serviceRef = useRef<GeminiLiveService | null>(null);
  const currentUser = auth?.currentUser;

  const initializePersistentRecorder = useCallback(async () => {
    if (!recordingEnabled || !currentUser) return;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') return;

    try {
        addLog("Initializing Persistent Neural Scribe...");
        const ctx = getGlobalAudioContext();
        const recordingDest = getGlobalMediaStreamDest();
        
        if (ctx.state !== 'running') await ctx.resume();

        // 1. Audio Sources: Mic + System
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
            v.style.left = '-1000px'; 
            v.style.top = '-1000px';
            v.style.width = '1px'; 
            v.style.height = '1px';
            if (stream) { 
                v.srcObject = stream; 
                document.body.appendChild(v); 
                v.play().catch(e => addLog("Video playback failed: " + e.message, "error")); 
            }
            return v;
        };

        const screenVideo = createCaptureVideo(screenStreamRef.current);
        const cameraVideo = createCaptureVideo(cameraStreamRef.current);

        const FPS = 30;
        compositorIntervalRef.current = setInterval(() => {
            if (!mountedRef.current) { 
                clearInterval(compositorIntervalRef.current); 
                screenVideo.remove();
                cameraVideo.remove();
                return; 
            }
            
            drawCtx.fillStyle = '#020617'; 
            drawCtx.fillRect(0, 0, canvas.width, canvas.height);
            
            if (screenStreamRef.current && screenVideo.readyState >= 2) {
                const scale = Math.min(canvas.width / screenVideo.videoWidth, canvas.height / screenVideo.videoHeight);
                const w = screenVideo.videoWidth * scale; 
                const h = screenVideo.videoHeight * scale;
                drawCtx.drawImage(screenVideo, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
            } else if (screenStreamRef.current) {
                drawCtx.fillStyle = '#1e293b';
                drawCtx.fillRect(20, 20, canvas.width - 40, canvas.height - 40);
                drawCtx.fillStyle = '#ffffff';
                drawCtx.font = 'bold 24px Inter, sans-serif';
                drawCtx.fillText("NEURAL STREAM HANDSHAKE...", 50, 100);
            }

            if (cameraStreamRef.current && cameraVideo.readyState >= 2) {
                const pipW = isPortrait ? canvas.width * 0.5 : 320;
                const pipH = (pipW * cameraVideo.videoHeight) / cameraVideo.videoWidth;
                const pipX = isPortrait ? (canvas.width - pipW) / 2 : canvas.width - pipW - 32;
                const pipY = isPortrait ? canvas.height - pipH - 160 : canvas.height - pipH - 32;
                drawCtx.strokeStyle = '#6366f1'; 
                drawCtx.lineWidth = 4;
                drawCtx.strokeRect(pipX, pipY, pipW, pipH); 
                drawCtx.drawImage(cameraVideo, pipX, pipY, pipW, pipH);
            }

            drawCtx.fillStyle = `rgba(${Math.random()*255}, ${Math.random()*255}, ${Math.random()*255}, 0.01)`;
            drawCtx.fillRect(0, 0, 2, 2);
        }, 1000 / FPS);

        await new Promise(resolve => setTimeout(resolve, 2000));

        const captureStream = canvas.captureStream(FPS);
        recordingDest.stream.getAudioTracks().forEach(track => captureStream.addTrack(track));
        
        const recorder = new MediaRecorder(captureStream, { 
            mimeType: 'video/webm;codecs=vp8,opus', 
            videoBitsPerSecond: 5000000 
        });
        
        audioChunksRef.current = []; 
        recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
        recorder.onstop = async () => {
            clearInterval(compositorIntervalRef.current);
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
        addLog("Neural Recording initialized and active.");
    } catch(e: any) { addLog("Init Error: " + e.message, "error"); }
  }, [recordingEnabled, currentUser, channel, onEndSession, addLog]);

  const handleStartSession = async () => {
      setError(null);
      setIsRateLimited(false);
      autoReconnectAttempts.current = 0;
      if (recordingEnabled) {
          try {
              addLog("Requesting display access with system audio...");
              screenStreamRef.current = await navigator.mediaDevices.getDisplayMedia({ 
                  video: { cursor: "always" } as any, 
                  audio: true 
              });
              if (cameraEnabled) cameraStreamRef.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
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
      const now = new Date();
      let effectiveInstruction = `[TIME]: ${now.toLocaleString()}.\n\n${channel.systemInstruction}`;
      
      if (recordingEnabled) {
          effectiveInstruction = `[CRITICAL MODE: SILENT SCRIBE]
          You are an advanced meeting transcriber...
          
          ORIGINAL PERSONA: ${channel.systemInstruction}`;
          addLog("Neural mode: SILENT SCRIBE locked.");
      }

      const ctx = getGlobalAudioContext();
      const userStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mergedDest = ctx.createMediaStreamDestination();
      ctx.createMediaStreamSource(userStream).connect(mergedDest);
      if (screenStreamRef.current && screenStreamRef.current.getAudioTracks().length > 0) {
          ctx.createMediaStreamSource(screenStreamRef.current).connect(mergedDest);
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
          }
      }, [], mergedDest.stream);
    } catch (e: any) { 
        setIsReconnecting(false); setIsRotating(false); setIsConnected(false); 
        setError(e.message?.includes('429') ? null : e.message); setShowReconnectButton(true);
    }
  }, [channel.id, channel.voiceName, channel.systemInstruction, recordingEnabled, isRotating, isConnected, addLog]);

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
                   <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">{isConnected ? (recordingEnabled ? t.scribeActive : 'Link Active') : t.stopped}</span>
               </div>
            </div>
         </div>
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

      {!hasStarted ? (
         <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
             <div className="w-20 h-20 bg-indigo-600/10 rounded-full flex items-center justify-center animate-pulse shadow-2xl shadow-indigo-500/10"><Mic size={40} className="text-indigo-500" /></div>
             <div><h3 className="text-xl font-bold text-white uppercase tracking-tighter italic">{t.tapToStart}</h3><p className="text-slate-400 text-sm mt-2 max-w-xs leading-relaxed">{t.tapDesc}</p></div>
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
                 <Visualizer volume={volume} isActive={isConnected} color={isTuned ? '#a855f7' : '#6366f1'} />
              </div>
              <div className="w-full flex items-center justify-between shrink-0 z-20">
                  <div className="flex items-center space-x-2 text-slate-500 text-[10px] font-black uppercase tracking-widest"><ScrollText size={14} className="text-indigo-400"/><span>{t.transcript}</span></div>
                  <div className="flex gap-2"><button onClick={handleDisconnect} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"><Save size={16}/></button></div>
              </div>
            </div>
         </div>
      )}
    </div>
  );
};
