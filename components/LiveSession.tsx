
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Channel, TranscriptItem, GeneratedLecture, CommunityDiscussion, RecordingSession, Attachment, UserProfile, ViewID } from '../types';
import { GeminiLiveService } from '../services/geminiLive';
import { Mic, MicOff, PhoneOff, Radio, AlertCircle, ScrollText, RefreshCw, Music, Download, Share2, Trash2, Quote, Copy, Check, MessageSquare, BookPlus, Loader2, Globe, FilePlus, Play, Save, CloudUpload, Link, X, Video, Monitor, Camera, Youtube, ClipboardList, Maximize2, Minimize2, Activity, Terminal, ShieldAlert, LogIn, Wifi, WifiOff, Zap, ShieldCheck, Thermometer, RefreshCcw, Sparkles, Square, Power, Database, Timer, MessageSquareOff, ImageIcon as ImageIconLucide, Palette, Upload, Maximize } from 'lucide-react';
import { auth } from '../services/firebaseConfig';
import { getDriveToken, signInWithGoogle, isJudgeSession } from '../services/authService';
import { uploadToYouTube, getYouTubeVideoUrl } from '../services/youtubeService';
import { ensureCodeStudioFolder, uploadToDrive, uploadToDriveWithProgress } from '../services/googleDriveService';
import { saveUserChannel, cacheLectureScript, getCachedLectureScript, saveLocalRecording } from '../utils/db';
import { publishChannelToFirestore, saveDiscussion, saveRecordingReference, updateBookingRecording, addChannelAttachment, syncUserProfile, getUserProfile, uploadFileToStorage } from '../services/firestoreService';
import { FunctionDeclaration, Type } from '@google/genai';
import { getGlobalAudioContext, getGlobalMediaStreamDest, warmUpAudioContext, stopAllPlatformAudio } from '../utils/audioUtils';
import { Visualizer } from './Visualizer';
import { resizeImage } from '../utils/imageUtils';

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
  recordingTarget?: 'drive' | 'youtube';
  sessionTitle?: string;
}

type PipBackground = 'blur' | 'indigo' | 'black';
type PipSize = 'normal' | 'compact';

const UI_TEXT = {
  en: {
    welcomePrefix: "Try asking...",
    reconnecting: "Neural Link Recovery...",
    establishing: "Establishing neural link...",
    preparing: "Preparing agent environment...",
    transcript: "Live Transcript",
    copied: "Copied",
    listening: "Listening...",
    connecting: "Connecting to AI Agent...",
    you: "You",
    speaking: "Speaking...",
    live: "LIVE ON AIR",
    saving: "Saving...",
    tapToStart: "Start Neural Session",
    tapDesc: "Click to enable audio and microphone access.",
    recording: "REC",
    uploading: "Syncing Session to Cloud...",
    uploadComplete: "Upload Successful",
    start: "Start Session",
    scribeActive: "Silent Scribe Mode Active",
    studio: "Interactive Studio",
    macAudioWarn: "MAC USERS: Ensure 'Share Audio' is checked in the browser dialog to capture system sounds.",
    provisioning: "Provisioning Workspace...",
    waitingFrames: "Syncing Streams...",
    finalizing: "Securing Neural Artifact...",
    pipFrame: "PIP Frame Image",
    bgStyle: "Video Backdrop",
    uploadBtn: "Upload Image",
    pipSize: "PIP Circle Size",
    mirrorLabel: "Neural Mirror"
  },
  zh: {
    welcomePrefix: "试着问...",
    reconnecting: "正在恢复神经连接...",
    establishing: "建立神经连接...",
    preparing: "准备智能体环境...",
    transcript: "实时字幕",
    copied: "已复制",
    listening: "正在聆听...",
    connecting: "连接到 AI 智能体...",
    you: "你",
    speaking: "正在说话...",
    live: "直播中",
    saving: "保存中...",
    tapToStart: "启动神经会话",
    tapDesc: "点击以启用音频和麦克风权限。",
    recording: "录音中",
    uploading: "正在同步会话存档...",
    uploadComplete: "上传成功",
    start: "开始会话",
    scribeActive: "静默速记模式已激活",
    studio: "互动工作室",
    macAudioWarn: "MAC 用户：请确保在浏览器共享对话框中勾选“共享音频”以录制系统声音。",
    provisioning: "正在准备工作空间...",
    waitingFrames: "同步音视频流...",
    finalizing: "正在固化神经存档...",
    pipFrame: "画中画背景图",
    bgStyle: "视频背景样式",
    uploadBtn: "上传图片",
    pipSize: "画中画尺寸",
    mirrorLabel: "神经镜像"
  }
};

export const LiveSession: React.FC<LiveSessionProps> = ({ 
  channel, initialContext, lectureId, onEndSession, language, 
  recordingEnabled, recordingDuration, interactionEnabled = true,
  recordScreen: propRecordScreen, recordCamera: propRecordCamera,
  activeSegment, initialTranscript, existingDiscussionId,
  customTools, onCustomToolCall, recordingTarget = 'drive', sessionTitle
}) => {
  const t = UI_TEXT[language];
  const [hasStarted, setHasStarted] = useState(false); 
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [isWaitingForFrames, setIsWaitingForFrames] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isRecordingActive, setIsRecordingActive] = useState(false);
  const [isUploadingRecording, setIsUploadingRecording] = useState(false);
  const [volume, setVolume] = useState(0);

  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [uploadETA, setUploadETA] = useState(0);

  const [scribeTimeLeft, setScribeTimeLeft] = useState(recordingDuration || 180);
  const [backdropStyle, setBackdropStyle] = useState<PipBackground>('blur');
  const [pipSize, setPipSize] = useState<PipSize>('normal');
  const [customPipBgBase64, setCustomPipBgBase64] = useState<string | null>(null);
  const [isMirrorMinimized, setIsMirrorMinimized] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const renderIntervalRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const reconnectTimeoutRef = useRef<any>(null);
  const pipBgImageRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mirrorVideoRef = useRef<HTMLVideoElement>(null);

  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [currentLine, setCurrentLine] = useState<TranscriptItem | null>(null);
  const transcriptRef = useRef<TranscriptItem[]>(initialTranscript || []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [suggestions] = useState<string[]>(channel.starterPrompts?.slice(0, 4) || []);
  
  const addLog = useCallback((msg: string, type: 'info' | 'error' | 'success' | 'warn' = 'info') => {
      console.log(`[Neural Log] ${msg}`);
      window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: msg, type } }));
  }, []);

  /**
   * Refines transcription text by collapsing multiple spaces and repairing word fragments.
   */
  const refineTranscription = (existing: string, incoming: string): string => {
      const combined = existing + incoming;
      return combined
          .replace(/\s+/g, ' ')               // Collapse whitespace
          .replace(/\s+([,.!?;:])/g, '$1');   // Repair punctuation spacing
  };

  useEffect(() => { 
      transcriptRef.current = transcript; 
      mountedRef.current = true;
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      return () => { 
          mountedRef.current = false; 
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          if (renderIntervalRef.current) clearInterval(renderIntervalRef.current);
      };
  }, [transcript, currentLine]);

  useEffect(() => {
    if (hasStarted && recordingEnabled && isRecordingActive && scribeTimeLeft > 0) {
      const timer = setInterval(() => {
        setScribeTimeLeft(prev => {
          if (prev <= 1) {
            handleDisconnect(); 
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [hasStarted, recordingEnabled, isRecordingActive, scribeTimeLeft]);

  const serviceRef = useRef<GeminiLiveService | null>(null);
  const currentUser = auth?.currentUser;

  const handlePipBgUpload = async (timeout: React.ChangeEvent<HTMLInputElement>) => {
    if (timeout.target.files?.[0]) {
      const b64 = await resizeImage(timeout.target.files[0], 1024, 0.7);
      setCustomPipBgBase64(b64);
      const img = new Image();
      img.src = b64;
      pipBgImageRef.current = img;
      addLog("PIP Portal backdrop verified.");
    }
  };

  const initializePersistentRecorder = useCallback(async () => {
    if (!recordingEnabled || !currentUser) return;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') return;

    try {
        addLog(`Initializing Scribe Compositor Protocol...`);
        setIsWaitingForFrames(true);

        const ctx = getGlobalAudioContext();
        const recordingDest = getGlobalMediaStreamDest();
        
        if (ctx.state !== 'running') await ctx.resume();

        const userStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const userSource = ctx.createMediaStreamSource(userStream); 
        userSource.connect(recordingDest);

        if (screenStreamRef.current && screenStreamRef.current.getAudioTracks().length > 0) {
            const screenAudioSource = ctx.createMediaStreamSource(screenStreamRef.current);
            screenAudioSource.connect(recordingDest);
        }

        const canvas = document.createElement('canvas');
        canvas.width = 1920; 
        canvas.height = 1080;
        const drawCtx = canvas.getContext('2d', { alpha: false })!;
        
        const createCaptureVideo = (stream: MediaStream | null, id: string) => {
            const v = document.createElement('video');
            v.muted = true; v.playsInline = true; v.autoplay = true;
            v.style.position = 'fixed'; v.style.left = '-10000px'; 
            if (stream) { 
                v.srcObject = stream; 
                document.body.appendChild(v); 
                v.play().catch(err => {
                    addLog(`Compositor: ${id} buffer delayed. Status: REPAIRING.`, "warn");
                }); 
            }
            return v;
        };

        const screenVideo = createCaptureVideo(screenStreamRef.current, 'screen');
        const cameraVideo = createCaptureVideo(cameraStreamRef.current, 'camera');

        let ready = false;
        let firstCameraFrameLogged = false;

        const checkFlow = () => {
            const screenOk = !screenStreamRef.current || (screenVideo.readyState >= 2 && screenVideo.currentTime > 0);
            const cameraOk = !cameraStreamRef.current || (cameraVideo.readyState >= 2 && cameraVideo.currentTime > 0);
            
            if (screenOk && cameraOk) {
                ready = true;
                setIsWaitingForFrames(false);
                addLog("Frame flow verified. Recorder engaged.");
                
                // Mirror for user view
                if (mirrorVideoRef.current && cameraStreamRef.current) {
                    mirrorVideoRef.current.srcObject = cameraStreamRef.current;
                }
            } else {
                // Hardening: Explicit play calls
                if (screenVideo.paused) screenVideo.play();
                if (cameraVideo.paused) cameraVideo.play();

                if (!cameraOk && cameraStreamRef.current) {
                    addLog(`Waiting for Camera Buffer (ReadyState: ${cameraVideo.readyState})...`, "warn");
                }
                setTimeout(checkFlow, 500);
            }
        };
        checkFlow();

        const renderLoop = () => {
            if (!mountedRef.current) return;
            
            if (backdropStyle === 'black') {
                drawCtx.fillStyle = '#020617';
                drawCtx.fillRect(0, 0, canvas.width, canvas.height);
            } else if (backdropStyle === 'indigo') {
                const grad = drawCtx.createRadialGradient(canvas.width/2, canvas.height/2, 0, canvas.width/2, canvas.height/2, canvas.width);
                grad.addColorStop(0, '#1e1b4b'); grad.addColorStop(1, '#020617');
                drawCtx.fillStyle = grad;
                drawCtx.fillRect(0, 0, canvas.width, canvas.height);
            } else {
                drawCtx.fillStyle = '#020617';
                drawCtx.fillRect(0, 0, canvas.width, canvas.height);
                if (screenVideo.readyState >= 2) {
                    drawCtx.save();
                    drawCtx.filter = 'blur(60px) brightness(0.4)';
                    drawCtx.drawImage(screenVideo, -100, -100, canvas.width + 200, canvas.height + 200);
                    drawCtx.restore();
                }
            }

            if (screenStreamRef.current && screenVideo.readyState >= 2) {
                const scale = Math.min(canvas.width / screenVideo.videoWidth, canvas.height / screenVideo.videoHeight);
                const w = screenVideo.videoWidth * scale;
                const h = screenVideo.videoHeight * scale;
                drawCtx.save();
                drawCtx.shadowColor = 'rgba(0,0,0,0.8)';
                drawCtx.shadowBlur = 40;
                drawCtx.drawImage(screenVideo, (canvas.width - w)/2, (canvas.height - h)/2, w, h);
                drawCtx.restore();
            }

            if (cameraStreamRef.current && cameraVideo.readyState >= 2) {
                // DYNAMIC SIZE SELECTION
                const size = pipSize === 'compact' ? 220 : 440; 
                const margin = pipSize === 'compact' ? 30 : 40; 
                const px = canvas.width - size - margin;
                const py = canvas.height - size - margin;
                const centerX = px + size / 2;
                const centerY = py + size / 2;
                const radius = size / 2;
                
                drawCtx.save();
                drawCtx.shadowColor = 'rgba(0,0,0,0.9)';
                drawCtx.shadowBlur = 50;
                drawCtx.beginPath();
                drawCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                drawCtx.closePath();
                drawCtx.clip();

                if (pipBgImageRef.current) {
                    const img = pipBgImageRef.current;
                    const imgScale = Math.max(size / img.width, size / img.height);
                    const iw = img.width * imgScale;
                    const ih = img.height * imgScale;
                    drawCtx.drawImage(img, centerX - iw / 2, centerY - ih / 2, iw, ih);
                } else {
                    drawCtx.fillStyle = '#1e1b4b';
                    drawCtx.fillRect(px, py, size, size);
                }

                const camScale = Math.max(size / cameraVideo.videoWidth, size / cameraVideo.videoHeight);
                const cw = cameraVideo.videoWidth * camScale;
                const ch = cameraVideo.videoHeight * camScale;
                drawCtx.drawImage(cameraVideo, centerX - cw / 2, centerY - ch / 2, cw, ch);
                drawCtx.restore();

                drawCtx.save();
                drawCtx.beginPath();
                drawCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                drawCtx.strokeStyle = '#6366f1';
                drawCtx.lineWidth = pipSize === 'compact' ? 6 : 12;
                drawCtx.stroke();
                drawCtx.strokeStyle = '#ffffff';
                drawCtx.lineWidth = pipSize === 'compact' ? 1 : 2;
                drawCtx.stroke();
                drawCtx.restore();

                if (!firstCameraFrameLogged) {
                    firstCameraFrameLogged = true;
                    addLog("Compositor: First PiP frame rasterized successfully.", "success");
                }
            }
        };

        while (!ready) { await new Promise(r => setTimeout(r, 100)); if (!mountedRef.current) return; }

        renderIntervalRef.current = setInterval(renderLoop, 1000 / 30);

        const captureStream = canvas.captureStream(30);
        recordingDest.stream.getAudioTracks().forEach(t => captureStream.addTrack(t));
        
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') 
            ? 'video/webm;codecs=vp9,opus' 
            : MediaRecorder.isTypeSupported('video/webm') 
                ? 'video/webm' 
                : 'video/mp4';

        const recorder = new MediaRecorder(captureStream, { 
            mimeType, 
            videoBitsPerSecond: 8000000 
        });

        audioChunksRef.current = []; 
        recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
        
        recorder.onstop = async () => {
            setIsRecordingActive(false);
            setIsFinalizing(true);
            setUploadProgress(0);
            if (renderIntervalRef.current) clearInterval(renderIntervalRef.current);
            
            const videoBlob = new Blob(audioChunksRef.current, { type: mimeType });
            const timestamp = Date.now();
            const recId = `session-${timestamp}`;
            const fileSizeMB = (videoBlob.size / 1024 / 1024).toFixed(2);
            
            addLog(`Scribe: Neural artifact assembled (${fileSizeMB} MB). Starting local vaulting...`, "info");
            
            try {
                setUploadProgress(2);
                await saveLocalRecording({
                    id: recId, userId: currentUser.uid, channelId: channel.id, 
                    channelTitle: sessionTitle || channel.title, channelImage: channel.imageUrl, 
                    timestamp, mediaUrl: URL.createObjectURL(videoBlob), 
                    mediaType: 'video/webm', transcriptUrl: '', 
                    blob: videoBlob, size: videoBlob.size
                });
                setUploadProgress(5);
                addLog("Vault: Artifact secured in browser storage (IndexedDB).", "success");

                setIsUploadingRecording(true);
                const token = getDriveToken() || await signInWithGoogle().then(() => getDriveToken());
                
                if (token) {
                    if (recordingTarget === 'youtube') {
                        addLog("Cloud: Requesting sovereign handshake with YouTube Registry...", "info");
                        setUploadProgress(10);
                        const ytId = await uploadToYouTube(token, videoBlob, {
                            title: `${sessionTitle || channel.title} (Neural Archive)`,
                            description: `Session recorded on ${new Date(timestamp).toLocaleString()}. Source: Neural Prism Platform.`,
                            privacyStatus: 'unlisted'
                        });
                        const videoUrl = getYouTubeVideoUrl(ytId);
                        addLog(`Cloud: YouTube upload successful (ID: ${ytId}). Registering ledger...`, "success");
                        setUploadProgress(95);
                        await saveRecordingReference({
                            id: recId, userId: currentUser.uid, channelId: channel.id, 
                            channelTitle: sessionTitle || channel.title, channelImage: channel.imageUrl, 
                            timestamp, mediaUrl: videoUrl, driveUrl: videoUrl, 
                            mediaType: 'video/webm', transcriptUrl: '', size: videoBlob.size
                        });
                    } else {
                        addLog("Cloud: Requesting sovereign handshake with Google Drive...", "info");
                        const folderId = await ensureCodeStudioFolder(token);
                        addLog("Cloud: Provisioning storage segment...", "info");
                        
                        const driveId = await uploadToDriveWithProgress(
                            token, 
                            folderId, 
                            `${recId}.webm`, 
                            videoBlob,
                            (progress, speed, eta) => {
                                setUploadProgress(5 + (progress * 0.9));
                                setUploadSpeed(speed);
                                setUploadETA(eta);
                            }
                        );
                        addLog(`Cloud: Drive upload successful (ID: ${driveId}). Registering ledger...`, "success");
                        
                        setUploadProgress(98);
                        await saveRecordingReference({
                            id: recId, userId: currentUser.uid, channelId: channel.id, 
                            channelTitle: sessionTitle || channel.title, channelImage: channel.imageUrl, 
                            timestamp, mediaUrl: `drive://${driveId}`, driveUrl: `drive://${driveId}`, 
                            mediaType: 'video/webm', transcriptUrl: '', size: videoBlob.size
                        });
                    }
                    setUploadProgress(100);
                    addLog("Archive: Session manifestation complete in Cloud Registry.", "success");
                } else {
                    addLog("Cloud: Identity token missing. Artifact remains in local vault only.", "warn");
                }
            } catch (e: any) {
                addLog("Protocol Failure: " + e.message, "error");
            } finally {
                setIsFinalizing(false);
                setIsUploadingRecording(false);
                addLog("Scribe Protocol Terminated. Handshake complete.", "info");
                setTimeout(() => onEndSession(), 500);
            }

            userStream.getTracks().forEach(t => t.stop());
            if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach(t => t.stop());
            if (cameraStreamRef.current) cameraStreamRef.current.getTracks().forEach(t => t.stop());
            screenVideo.remove(); cameraVideo.remove();
        };
        
        mediaRecorderRef.current = recorder;
        recorder.start(1000);
        setIsRecordingActive(true);
    } catch(e: any) { 
        setIsWaitingForFrames(false);
        addLog("Init failed: " + e.message, "error");
    }
  }, [recordingEnabled, currentUser, channel, onEndSession, addLog, backdropStyle, pipSize, recordingTarget, sessionTitle]);

  const handleStartSession = async () => {
      setIsProvisioning(true);
      setHasStarted(true);

      if (recordingEnabled) {
          try {
              addLog("Requesting screen access...");
              screenStreamRef.current = await navigator.mediaDevices.getDisplayMedia({ 
                  video: { width: { ideal: 1920 }, height: { ideal: 1080 } }, 
                  audio: true 
              } as any);
              
              if (propRecordCamera) {
                  addLog("Requesting camera access...");
                  cameraStreamRef.current = await navigator.mediaDevices.getUserMedia({ 
                      video: { width: 1280, height: 720 }, 
                      audio: false 
                  });
              }
              initializePersistentRecorder();
          } catch(e: any) { 
              addLog("Permission denied.", "warn"); 
              setHasStarted(false); setIsProvisioning(false);
              return;
          }
      }

      const ctx = getGlobalAudioContext();
      await warmUpAudioContext(ctx);
      setIsProvisioning(false);
      await connect();
  };

  const connect = useCallback(async () => {
    const service = new GeminiLiveService();
    serviceRef.current = service;
    try {
      await service.initializeAudio();
      const instruction = `${channel.systemInstruction}\n[MODE]: SCRIBE ACTIVE`;
      await service.connect(channel.voiceName, instruction, {
          onOpen: () => setIsConnected(true),
          onClose: () => setIsConnected(false),
          onError: () => setIsConnected(false),
          onVolumeUpdate: (v) => setVolume(v),
          onTranscript: (text, isUser) => {
              const role = isUser ? 'user' : 'ai';
              const timestamp = Date.now();
              setCurrentLine(prev => {
                  if (prev && prev.role !== role) {
                      setTranscript(history => [...history, prev]);
                      return { role, text, timestamp };
                  }
                  // REFINEMENT: Ensure no double spaces or split words
                  const newText = refineTranscription(prev ? prev.text : '', text);
                  return { role, text: newText, timestamp: prev ? prev.timestamp : timestamp };
              });
          }
      });
    } catch (e: any) { addLog("Link error: " + e.message, "error"); }
  }, [channel, addLog]);

  const handleDisconnect = async () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
      else onEndSession();
      if (serviceRef.current) await serviceRef.current.disconnect();
  };

  return (
    <div className="h-full w-full flex flex-col bg-slate-950 relative">
      {/* Neural Mirror (PIP Portal) */}
      {hasStarted && propRecordCamera && (
        <div className={`fixed bottom-24 right-6 z-[100] transition-all duration-500 transform ${isMirrorMinimized ? 'translate-x-20 scale-50 opacity-20' : 'translate-x-0 scale-100'}`}>
            <div className={`relative group ${pipSize === 'compact' ? 'w-32 h-32' : 'w-56 h-56'}`}>
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full blur opacity-40 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative w-full h-full bg-slate-900 rounded-full border-4 border-indigo-500/50 overflow-hidden shadow-2xl">
                    <video 
                      ref={mirrorVideoRef}
                      autoPlay 
                      playsInline 
                      muted 
                      className="w-full h-full object-cover transform scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
                    <div className="absolute top-2 left-1/2 -translate-x-1/2">
                        <div className="bg-indigo-600 text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-full shadow-lg border border-indigo-400/50 whitespace-nowrap">{t.mirrorLabel}</div>
                    </div>
                    <button 
                      onClick={() => setIsMirrorMinimized(!isMirrorMinimized)}
                      className="absolute bottom-2 left-1/2 -translate-x-1/2 p-1.5 bg-black/40 hover:bg-indigo-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                    >
                        {isMirrorMinimized ? <Maximize2 size={12}/> : <Minimize2 size={12}/>}
                    </button>
                </div>
            </div>
        </div>
      )}

      <div className="p-4 flex items-center justify-between bg-slate-900 border-b border-slate-800 shrink-0 z-20">
         <div className="flex items-center space-x-3">
            {!recordingEnabled && <img src={channel.imageUrl} className="w-10 h-10 rounded-full border border-slate-700 object-cover" alt="" />}
            <div>
               <h2 className="text-sm font-bold text-white leading-tight">{channel.title}</h2>
               <div className="flex items-center gap-2">
                   <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
                   <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">{isConnected ? 'Link Active' : 'Offline'}</span>
               </div>
            </div>
         </div>
         <div className="flex items-center gap-4">
            {isRecordingActive && (
                <div className="flex items-center gap-2 bg-red-600/20 text-red-500 px-3 py-1 rounded-full border border-red-500/30 text-[10px] font-black uppercase tracking-widest animate-pulse">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    <span>Recording ({Math.floor(scribeTimeLeft / 60)}:{(scribeTimeLeft % 60).toString().padStart(2, '0')})</span>
                </div>
            )}
            <button onClick={handleDisconnect} className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-colors">Terminate</button>
         </div>
      </div>

      {!hasStarted ? (
         <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6 overflow-y-auto">
             <div className="w-20 h-20 bg-indigo-600/10 rounded-full flex items-center justify-center shadow-2xl shadow-indigo-500/10"><Mic size={40} className="text-indigo-500" /></div>
             <div><h3 className="text-xl font-bold text-white uppercase tracking-tighter italic">{t.tapToStart}</h3><p className="text-slate-400 text-sm mt-2 max-w-xs leading-relaxed">{t.tapDesc}</p></div>
             
             {recordingEnabled && (
                 <div className="space-y-4 max-w-sm w-full">
                    <div className="bg-amber-900/10 border border-amber-500/20 p-4 rounded-2xl flex items-start gap-3">
                        <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={16}/>
                        <p className="text-[10px] text-amber-200 leading-relaxed font-bold uppercase text-left">{t.macAudioWarn}</p>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-5 shadow-xl">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2"><ImageIconLucide size={14} className="text-indigo-400"/><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t.pipFrame}</span></div>
                                <button onClick={() => fileInputRef.current?.click()} className="text-[9px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1 hover:text-white transition-all"><Upload size={12}/> {t.uploadBtn}</button>
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePipBgUpload}/>
                            </div>
                            {customPipBgBase64 && (
                                <div className="flex items-center gap-3 p-2 bg-slate-950 rounded-xl border border-indigo-500/30">
                                    <img src={customPipBgBase64} className="w-10 h-10 rounded-lg object-cover" />
                                    <span className="text-[9px] text-slate-500 uppercase font-black">Portal Backdrop Staged</span>
                                    <button onClick={() => {setCustomPipBgBase64(null); pipBgImageRef.current = null;}} className="ml-auto p-1.5 text-slate-600 hover:text-red-400 transition-colors"><X size={14}/></button>
                                </div>
                            )}
                        </div>

                        <div className="space-y-3 pt-2 border-t border-slate-800">
                            <div className="flex items-center gap-2"><Palette size={14} className="text-indigo-400"/><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t.bgStyle}</span></div>
                            <div className="grid grid-cols-3 gap-2">
                                {(['blur', 'indigo', 'black'] as PipBackground[]).map(bg => (
                                    <button 
                                        key={bg} onClick={() => setBackdropStyle(bg)}
                                        className={`py-2 rounded-xl text-[9px] font-black uppercase transition-all border ${backdropStyle === bg ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-500'}`}
                                    >
                                        <span>{bg}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* NEW: PIP SIZE SELECTOR */}
                        <div className="space-y-3 pt-2 border-t border-slate-800">
                            <div className="flex items-center gap-2"><Maximize size={14} className="text-indigo-400"/><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t.pipSize}</span></div>
                            <div className="grid grid-cols-2 gap-2">
                                {(['normal', 'compact'] as PipSize[]).map(sz => (
                                    <button 
                                        key={sz} onClick={() => setPipSize(sz)}
                                        className={`py-2 rounded-xl text-[9px] font-black uppercase transition-all border ${pipSize === sz ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-50'}`}
                                    >
                                        <span>{sz}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                 </div>
             )}

             <button onClick={handleStartSession} className="px-12 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest rounded-full shadow-2xl shadow-indigo-900/40 transition-transform hover:scale-105 active:scale-95">Link Neural Fabric</button>
         </div>
      ) : (
         <div className="flex-1 flex flex-col min-0 relative">
            {(isProvisioning || isWaitingForFrames) && (
               <div className="absolute inset-0 z-[130] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center gap-6 animate-fade-in">
                  <Loader2 className="animate-spin text-indigo-500" size={48} />
                  <span className="text-sm font-black text-white uppercase tracking-widest">{isWaitingForFrames ? t.waitingFrames : t.provisioning}</span>
               </div>
            )}

            {isFinalizing && (
               <div className="absolute inset-0 z-[130] bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-center p-12 text-center animate-fade-in">
                  <div className="w-full max-w-md space-y-8">
                    <div className="relative flex justify-center">
                        <Loader2 className="animate-spin text-indigo-500" size={64} />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[10px] font-black text-white">{Math.round(uploadProgress)}%</span>
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">{t.finalizing}</h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                            {uploadProgress < 5 ? "Securing Local Shards..." : recordingTarget === 'youtube' ? "Streaming to YouTube Archive..." : "Streaming to Sovereign Vault..."}
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="w-full h-2 bg-slate-900 rounded-full border border-slate-800 overflow-hidden shadow-inner">
                            <div 
                                className="h-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 transition-all duration-300"
                                style={{ width: `${uploadProgress}%` }}
                            />
                        </div>
                        
                        {uploadProgress >= 5 && uploadETA > 0 && (
                            <div className="flex justify-between items-center px-2">
                                <div className="flex items-center gap-2 text-slate-500">
                                    <Activity size={12} className="text-indigo-400" />
                                    <span className="text-[10px] font-mono">{(uploadSpeed / 1024 / 1024).toFixed(2)} MB/s</span>
                                </div>
                                <div className="flex items-center gap-2 text-slate-500">
                                    <Timer size={12} className="text-amber-400" />
                                    <span className="text-[10px] font-mono">
                                        ETA: {Math.floor(uploadETA / 60)}m {Math.floor(uploadETA % 60)}s
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="p-4 bg-indigo-900/10 rounded-2xl border border-indigo-500/10">
                        <p className="text-[9px] text-slate-400 leading-relaxed font-medium uppercase italic">
                            Protocol status: DO NOT CLOSE TAB. Starching neural fragments into permanent technical artifact.
                        </p>
                    </div>
                  </div>
               </div>
            )}

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
               {transcript.map((item, index) => (
                   <div key={index} className={`flex flex-col ${item.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in-up`}>
                       <span className={`text-[10px] uppercase font-bold tracking-wider mb-1 ${item.role === 'user' ? 'text-indigo-400' : 'text-emerald-400'}`}>{item.role === 'user' ? 'You' : channel.author}</span>
                       <div className={`max-w-[90%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${item.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm shadow-xl' : 'bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700 shadow-md'}`}>
                           {item.text}
                       </div>
                   </div>
               ))}
               {currentLine && (
                   <div className={`flex flex-col ${currentLine.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in`}>
                       <span className={`text-[10px] uppercase font-bold tracking-wider mb-1 ${currentLine.role === 'user' ? 'text-indigo-400' : 'text-emerald-400'}`}>{currentLine.role === 'user' ? 'You' : channel.author}</span>
                       <div className={`max-w-[90%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${currentLine.role === 'user' ? 'bg-indigo-600/80 text-white rounded-tr-sm shadow-xl' : 'bg-slate-800/80 text-slate-200 rounded-tl-sm border border-slate-700 shadow-md'}`}>
                           {currentLine.text}
                       </div>
                   </div>
               )}
            </div>

            <div className="px-6 py-4 bg-slate-900 border-t border-slate-800 flex flex-col items-center gap-4 shrink-0">
              <div className="w-full flex justify-center h-40">
                 <Visualizer volume={volume} isActive={isConnected} color="#6366f1" />
              </div>
              <div className="w-full flex items-center justify-between text-slate-500 text-[10px] font-black uppercase tracking-widest">
                  <div className="flex items-center space-x-2"><ScrollText size={14} className="text-indigo-400"/><span>{t.transcript}</span></div>
                  {isUploadingRecording && <div className="flex items-center gap-2 text-indigo-300 animate-pulse"><Loader2 size={12} className="animate-spin"/> <span>Syncing Archive...</span></div>}
              </div>
            </div>
         </div>
      )}
    </div>
  );
};
