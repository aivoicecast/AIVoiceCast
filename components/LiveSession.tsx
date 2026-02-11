
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Channel, TranscriptItem, UserProfile } from '../types';
import { GeminiLiveService } from '../services/geminiLive';
import { 
  Mic, MicOff, AlertCircle, ScrollText, Loader2, X, Monitor, Camera, 
  Maximize2, Minimize2, Activity, Type as TypeIcon, Smartphone, 
  MonitorOff, SmartphoneNfc, EyeOff, Image as ImageIconLucide, 
  Palette, Upload, Shield, Droplets, Clock, Zap
} from 'lucide-react';
import { auth } from '../services/firebaseConfig';
import { getDriveToken, signInWithGoogle, connectGoogleDrive } from '../services/authService';
import { uploadToYouTube, getYouTubeVideoUrl } from '../services/youtubeService';
import { ensureCodeStudioFolder, uploadToDriveWithProgress } from '../services/googleDriveService';
import { saveLocalRecording } from '../utils/db';
import { saveRecordingReference } from '../services/firestoreService';
import { getGlobalAudioContext, getGlobalMediaStreamDest, warmUpAudioContext } from '../utils/audioUtils';
import { Visualizer } from './Visualizer';
import { resizeImage } from '../utils/imageUtils';

interface LiveSessionProps {
  channel: Channel;
  onEndSession: () => void;
  language: 'en' | 'zh';
  recordingEnabled?: boolean;
  recordingDuration?: number;
  recordScreen?: boolean;
  recordCamera?: boolean;
  recordingTarget?: 'drive' | 'youtube';
  sessionTitle?: string;
  initialContext?: string;
  lectureId?: string;
  activeSegment?: any;
  interactionEnabled?: boolean;
}

type ScreenPreset = 'desktop' | 'mobile-v' | 'mobile-h';

const UI_TEXT = {
  en: {
    transcript: "Live Transcript",
    tapToStart: "Start Neural Session",
    tapDesc: "Click to enable audio and microphone access.",
    finalizing: "Securing Neural Artifact...",
    privacyShield: "Privacy Backdrop",
    bgStyle: "Video Backdrop",
    uploadBtn: "Upload Image",
    mirrorLabel: "Privacy Mirror",
    length: "Session Duration",
    screenType: "Screen Aspect Ratio",
    dimMode: "Neural Dim Mode",
    dimDesc: "Stealth mode for OLED/iPhone.",
    camEnable: "Include Camera Feed",
    screenEnable: "Include Screen Capture",
    titlePlaceholder: "Session Title (e.g. System Design)",
    macAudioWarn: "MAC USERS: Ensure 'Share Audio' is checked in the browser dialog.",
    blurCam: "Apply Privacy Blur",
    blurDesc: "Obscures room details."
  },
  zh: {
    transcript: "实时字幕",
    tapToStart: "启动神经会话",
    tapDesc: "点击以启用音频和麦克风权限。",
    finalizing: "正在固化神经存档...",
    privacyShield: "隐私背景图",
    bgStyle: "视频背景样式",
    uploadBtn: "上传背景",
    mirrorLabel: "隐私镜像",
    length: "会话时长",
    screenType: "屏幕宽高比",
    dimMode: "神经调光模式",
    dimDesc: "针对 OLED/iPhone 的隐身模式。",
    camEnable: "包含摄像头画面",
    screenEnable: "包含屏幕截图",
    titlePlaceholder: "会话标题 (例如：系统设计)",
    macAudioWarn: "MAC 用户：请确保在浏览器共享对话框中勾选“共享音频”。",
    blurCam: "应用隐私模糊",
    blurDesc: "遮挡房间细节。"
  }
};

export const LiveSession: React.FC<LiveSessionProps> = ({ 
  channel, onEndSession, language, recordingEnabled, recordingDuration: propDuration,
  recordScreen: propRecordScreen, recordCamera: propRecordCamera,
  recordingTarget = 'drive', sessionTitle: propSessionTitle,
  initialContext, lectureId, activeSegment, interactionEnabled
}) => {
  const t = UI_TEXT[language];
  const [hasStarted, setHasStarted] = useState(false); 
  const [isWaitingForFrames, setIsWaitingForFrames] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isRecordingActive, setIsRecordingActive] = useState(false);
  const [volume, setVolume] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [localSessionTitle, setLocalSessionTitle] = useState(propSessionTitle || '');
  const [sessionDuration, setSessionDuration] = useState(propDuration || 15);
  const [isMirrorMinimized, setIsMirrorMinimized] = useState(false);
  const [scribeTimeLeft, setScribeTimeLeft] = useState(sessionDuration * 60);
  const [screenPreset, setScreenPreset] = useState<ScreenPreset>('desktop');
  const [useCamera, setUseCamera] = useState(propRecordCamera ?? true);
  const [useScreen, setUseScreen] = useState(propRecordScreen ?? true);
  const [isDimmed, setIsDimmed] = useState(false);
  const [isCamBlurred, setIsCamBlurred] = useState(false);
  const [customPipBgBase64, setCustomPipBgBase64] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const renderIntervalRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const pipBgImageRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mirrorVideoRef = useRef<HTMLVideoElement>(null);

  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [currentLine, setCurrentLine] = useState<TranscriptItem | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const addLog = useCallback((msg: string, type: 'info' | 'error' | 'success' | 'warn' = 'info') => {
      window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: `[Neural Studio] ${msg}`, type } }));
  }, []);

  const refineTranscription = (existing: string, incoming: string): string => {
      const combined = existing + incoming;
      return combined.replace(/\s+/g, ' ').replace(/\s+([,.!?;:])/g, '$1');   
  };

  // REFRATION FIX: Explicitly re-bind the camera stream to the mirror element when acquired
  useEffect(() => {
      if (hasStarted && mirrorVideoRef.current && cameraStreamRef.current) {
          if (mirrorVideoRef.current.srcObject !== cameraStreamRef.current) {
              mirrorVideoRef.current.srcObject = cameraStreamRef.current;
              mirrorVideoRef.current.play().catch(() => {});
          }
      }
  }, [hasStarted, useCamera, cameraStreamRef.current]);

  useEffect(() => { 
      mountedRef.current = true;
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      return () => { 
          mountedRef.current = false; 
          if (renderIntervalRef.current) clearInterval(renderIntervalRef.current);
      };
  }, [transcript, currentLine]);

  useEffect(() => {
    if (hasStarted && recordingEnabled && isRecordingActive && scribeTimeLeft > 0) {
      const timer = setInterval(() => {
        setScribeTimeLeft(prev => {
          if (prev <= 1) { handleDisconnect(); return 0; }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [hasStarted, recordingEnabled, isRecordingActive, scribeTimeLeft]);

  const serviceRef = useRef<GeminiLiveService | null>(null);
  const currentUser = auth?.currentUser;

  const handlePipBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const b64 = await resizeImage(e.target.files[0], 1024, 0.7);
      setCustomPipBgBase64(b64);
      const img = new Image();
      img.src = b64;
      img.onload = () => { pipBgImageRef.current = img; addLog("Privacy Shield background verified."); };
    }
  };

  const initializePersistentRecorder = useCallback(async () => {
    if (!recordingEnabled || !currentUser) return;
    try {
        setIsWaitingForFrames(true);
        const ctx = getGlobalAudioContext();
        const recordingDest = getGlobalMediaStreamDest();
        if (ctx.state !== 'running') await ctx.resume();

        const userStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        ctx.createMediaStreamSource(userStream).connect(recordingDest);

        if (screenStreamRef.current && screenStreamRef.current.getAudioTracks().length > 0) {
            ctx.createMediaStreamSource(screenStreamRef.current).connect(recordingDest);
        }

        const canvas = document.createElement('canvas');
        if (screenPreset === 'mobile-v') { canvas.width = 1080; canvas.height = 1920; } 
        else { canvas.width = 1920; canvas.height = 1080; }
        
        const drawCtx = canvas.getContext('2d', { alpha: false })!;
        
        const createCaptureVideo = (stream: MediaStream | null) => {
            const v = document.createElement('video');
            v.muted = true; v.playsInline = true; v.autoplay = true;
            v.style.position = 'fixed'; v.style.left = '-10000px'; 
            if (stream) { v.srcObject = stream; document.body.appendChild(v); v.play().catch(() => {}); }
            return v;
        };

        const screenVideo = createCaptureVideo(screenStreamRef.current);
        const cameraVideo = createCaptureVideo(cameraStreamRef.current);

        let ready = false;
        const checkFlow = () => {
            const screenOk = !screenStreamRef.current || (screenVideo.readyState >= 2);
            const cameraOk = !cameraStreamRef.current || (cameraVideo.readyState >= 2);
            if (screenOk && cameraOk) { ready = true; setIsWaitingForFrames(false); } 
            else { 
                if (cameraVideo.paused) cameraVideo.play().catch(() => {});
                if (screenVideo.paused) screenVideo.play().catch(() => {});
                setTimeout(checkFlow, 500); 
            }
        };
        checkFlow();

        const renderLoop = () => {
            if (!mountedRef.current) return;
            drawCtx.fillStyle = '#020617';
            drawCtx.fillRect(0, 0, canvas.width, canvas.height);

            // 1. Layer: Blurred Background (The requested "Blur" bedrock)
            if (screenStreamRef.current && screenVideo.readyState >= 2) {
                drawCtx.save();
                drawCtx.filter = 'blur(60px) brightness(0.4)';
                drawCtx.drawImage(screenVideo, -100, -100, canvas.width + 200, canvas.height + 200);
                drawCtx.restore();
            }

            // 2. Layer: Main Content (The "Background Image" context for the video)
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

            // 3. Layer: PIP (The "Camera Face" assembly)
            if (cameraStreamRef.current && cameraVideo.readyState >= 2 && cameraVideo.videoWidth > 0) {
                const size = screenPreset === 'mobile-v' ? 320 : 440; 
                const px = canvas.width - size - 40;
                const py = canvas.height - size - 40;
                const centerX = px + size / 2;
                const centerY = py + size / 2;
                const radius = size / 2;
                
                drawCtx.save();
                drawCtx.shadowColor = 'rgba(0,0,0,0.9)';
                drawCtx.shadowBlur = 50;
                drawCtx.beginPath();
                drawCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                drawCtx.clip();

                // 3a. PIP Base: Privacy Shield (Background image inside the circle)
                if (pipBgImageRef.current) {
                    const img = pipBgImageRef.current;
                    const imgScale = Math.max(size / img.width, size / img.height);
                    drawCtx.drawImage(img, centerX - (img.width*imgScale)/2, centerY - (img.height*imgScale)/2, img.width*imgScale, img.height*imgScale);
                } else {
                    drawCtx.fillStyle = '#0f172a';
                    drawCtx.fill();
                }

                // 3b. PIP Content: Camera Face
                if (isCamBlurred) drawCtx.filter = 'blur(25px)';
                const camScale = Math.max(size / cameraVideo.videoWidth, size / cameraVideo.videoHeight);
                const cw = cameraVideo.videoWidth * camScale;
                const ch = cameraVideo.videoHeight * camScale;
                drawCtx.drawImage(cameraVideo, centerX - cw / 2, centerY - ch / 2, cw, ch);
                
                drawCtx.restore();

                // 3c. PIP Decoration: Ring
                drawCtx.beginPath();
                drawCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                drawCtx.strokeStyle = '#6366f1';
                drawCtx.lineWidth = screenPreset === 'mobile-v' ? 6 : 10;
                drawCtx.stroke();
            }
        };

        while (!ready) { await new Promise(r => setTimeout(r, 100)); if (!mountedRef.current) return; }
        renderIntervalRef.current = setInterval(renderLoop, 1000 / 30);

        const captureStream = canvas.captureStream(30);
        recordingDest.stream.getAudioTracks().forEach(t => captureStream.addTrack(t));
        
        const recorder = new MediaRecorder(captureStream, { mimeType: 'video/webm;codecs=vp9,opus', videoBitsPerSecond: 8000000 });
        audioChunksRef.current = []; 
        recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
        
        recorder.onstop = async () => {
            setIsRecordingActive(false); setIsFinalizing(true);
            if (renderIntervalRef.current) clearInterval(renderIntervalRef.current);
            const videoBlob = new Blob(audioChunksRef.current, { type: 'video/webm' });
            const timestamp = Date.now();
            const recId = `session-${timestamp}`;
            
            try {
                await saveLocalRecording({ id: recId, userId: currentUser.uid, channelId: channel.id, channelTitle: localSessionTitle || channel.title, channelImage: channel.imageUrl, timestamp, mediaUrl: URL.createObjectURL(videoBlob), mediaType: 'video/webm', transcriptUrl: '', blob: videoBlob, size: videoBlob.size });
                const token = getDriveToken() || await signInWithGoogle().then(() => getDriveToken());
                if (token) {
                    const folderId = await ensureCodeStudioFolder(token);
                    const driveId = await uploadToDriveWithProgress(token, folderId, `${localSessionTitle || recId}.webm`, videoBlob, (p) => setUploadProgress(p));
                    await saveRecordingReference({ id: recId, userId: currentUser.uid, channelId: channel.id, channelTitle: localSessionTitle || channel.title, channelImage: channel.imageUrl, timestamp, mediaUrl: `drive://${driveId}`, driveUrl: `drive://${driveId}`, mediaType: 'video/webm', transcriptUrl: '', size: videoBlob.size });
                }
            } catch (e: any) { addLog("Save failed: " + e.message, "error"); } 
            finally { setIsFinalizing(false); setTimeout(() => onEndSession(), 500); }
            userStream.getTracks().forEach(t => t.stop());
            if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach(t => t.stop());
            if (cameraStreamRef.current) cameraStreamRef.current.getTracks().forEach(t => t.stop());
            screenVideo.remove(); cameraVideo.remove();
        };
        mediaRecorderRef.current = recorder;
        recorder.start(1000);
        setIsRecordingActive(true);
    } catch(e: any) { addLog("Init failed: " + e.message, "error"); }
  }, [recordingEnabled, currentUser, channel, onEndSession, addLog, localSessionTitle, screenPreset, isCamBlurred]);

  const handleStartSession = async () => {
      setHasStarted(true);
      if (recordingEnabled) {
          try {
              if (useScreen) screenStreamRef.current = await navigator.mediaDevices.getDisplayMedia({ video: { width: 1920, height: 1080 }, audio: true } as any);
              if (useCamera) cameraStreamRef.current = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
              initializePersistentRecorder();
          } catch(e) { setHasStarted(false); return; }
      }
      const ctx = getGlobalAudioContext();
      await warmUpAudioContext(ctx);
      await connect();
  };

  const connect = useCallback(async () => {
    const service = new GeminiLiveService();
    serviceRef.current = service;
    try {
      await service.initializeAudio();
      await service.connect(channel.voiceName, `${channel.systemInstruction}\n[MODE]: INTERACTIVE STUDIO${initialContext ? `\n[CONTEXT]: ${initialContext}` : ''}`, {
          onOpen: () => setIsConnected(true),
          onClose: () => setIsConnected(false),
          onError: (error) => {
              addLog(`Link error: ${error}`, 'error');
              setIsConnected(false);
          },
          onVolumeUpdate: (v) => setVolume(v),
          onTranscript: (text, isUser) => {
              const role = isUser ? 'user' : 'ai';
              setCurrentLine(prev => {
                  if (prev && prev.role !== role) { setTranscript(history => [...history, prev]); return { role, text, timestamp: Date.now() }; }
                  return { role, text: refineTranscription(prev ? prev.text : '', text), timestamp: prev ? prev.timestamp : Date.now() };
              });
          }
      });
    } catch (e: any) { addLog("Link error: " + e.message, "error"); }
  }, [channel, addLog, initialContext]);

  const handleDisconnect = async () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
      else onEndSession();
      if (serviceRef.current) await serviceRef.current.disconnect();
  };

  return (
    <div className={`h-full w-full flex flex-col bg-slate-950 relative`}>
      {isDimmed && hasStarted && (
        <div className="fixed inset-0 z-[200] bg-black/95 pointer-events-none flex flex-col items-center justify-center gap-6 animate-fade-in">
            <EyeOff className="text-slate-800 animate-pulse" size={64}/>
            <p className="text-[10px] font-black text-slate-800 uppercase tracking-[0.4em]">Neural Dim Mode Active</p>
        </div>
      )}

      {hasStarted && useCamera && (
        <div className={`fixed bottom-24 right-6 z-[100] transition-all duration-500 transform ${isMirrorMinimized ? 'translate-x-20 scale-50 opacity-20' : 'translate-x-0 scale-100'}`}>
            <div className="relative group w-56 h-56">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full blur opacity-40 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative w-full h-full bg-slate-900 rounded-full border-4 border-indigo-500/50 overflow-hidden shadow-2xl">
                    {customPipBgBase64 && <img src={customPipBgBase64} className="absolute inset-0 w-full h-full object-cover" alt="" />}
                    <video ref={mirrorVideoRef} autoPlay playsInline muted className={`w-full h-full object-cover transform scale-110 relative z-10 ${isCamBlurred ? 'blur-md' : ''}`}/>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent z-20"></div>
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30"><div className="bg-indigo-600 text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-full shadow-lg border border-indigo-400/50">{t.mirrorLabel}</div></div>
                    <button onClick={() => setIsMirrorMinimized(!isMirrorMinimized)} className="absolute bottom-2 left-1/2 -translate-x-1/2 p-1.5 bg-black/40 hover:bg-indigo-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg z-30">{isMirrorMinimized ? <Maximize2 size={12}/> : <Minimize2 size={12}/>}</button>
                </div>
            </div>
        </div>
      )}

      <div className="p-4 flex items-center justify-between bg-slate-900 border-b border-slate-800 shrink-0 z-20">
         <div className="flex items-center space-x-3">
            {!recordingEnabled && <img src={channel.imageUrl} className="w-10 h-10 rounded-full border border-slate-700 object-cover" alt="" />}
            <div><h2 className="text-sm font-bold text-white leading-tight">{channel.title}</h2><div className="flex items-center gap-2"><div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} /><span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">{isConnected ? 'Link Active' : 'Offline'}</span></div></div>
         </div>
         <div className="flex items-center gap-4">
            {isRecordingActive && (
                <div className="flex items-center gap-2 bg-red-600/20 text-red-500 px-3 py-1 rounded-full border border-red-500/30 text-[10px] font-black uppercase tracking-widest animate-pulse">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    <span>REC ({Math.floor(scribeTimeLeft / 60)}:{(scribeTimeLeft % 60).toString().padStart(2, '0')})</span>
                </div>
            )}
            <button onClick={handleDisconnect} className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-colors">Terminate</button>
         </div>
      </div>

      {!hasStarted ? (
         <div className="flex-1 flex flex-col items-center justify-start pt-12 pb-32 px-6 text-center space-y-8 overflow-y-auto scrollbar-hide">
             <div className="flex flex-col items-center space-y-4">
                <div className="w-20 h-20 bg-indigo-600/10 rounded-full flex items-center justify-center shadow-2xl shadow-indigo-500/10"><Mic size={40} className="text-indigo-500" /></div>
                <div><h3 className="text-xl font-bold text-white uppercase tracking-tighter italic">{t.tapToStart}</h3><p className="text-slate-400 text-sm mt-2 max-w-xs leading-relaxed">{t.tapDesc}</p></div>
             </div>
             
             {recordingEnabled && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full text-left">
                    <div className="space-y-4">
                        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6 shadow-xl">
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Archive ID</label>
                                <div className="relative group">
                                    <TypeIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400" size={16}/>
                                    <input type="text" value={localSessionTitle} onChange={e => setLocalSessionTitle(e.target.value)} placeholder={t.titlePlaceholder} className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-6 py-4 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none shadow-inner transition-all"/>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">{t.length}</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {[3, 10, 30, 60].map(min => (<button key={min} onClick={() => { setSessionDuration(min); setScribeTimeLeft(min * 60); }} className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${sessionDuration === min ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-950 border border-slate-800 text-slate-500'}`}>{min}m</button>))}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">{t.screenType}</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button onClick={() => setScreenPreset('desktop')} className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${screenPreset === 'desktop' ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-950 border border-slate-800 text-slate-500'}`}><Monitor size={18}/> <span className="text-[8px] font-bold">16:9</span></button>
                                    <button onClick={() => setScreenPreset('mobile-v')} className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${screenPreset === 'mobile-v' ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-950 border border-slate-800 text-slate-500'}`}><Smartphone size={18}/> <span className="text-[8px] font-bold">9:16</span></button>
                                    <button onClick={() => setScreenPreset('mobile-h')} className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${screenPreset === 'mobile-h' ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-950 border border-slate-800 text-slate-500'}`}><SmartphoneNfc size={18}/> <span className="text-[8px] font-bold">HORIZ</span></button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6 shadow-xl">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2"><ImageIconLucide size={14} className="text-indigo-400"/><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t.privacyShield}</span></div>
                                    <button onClick={() => fileInputRef.current?.click()} className="text-[9px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1 hover:text-white transition-all"><Upload size={12}/> {t.uploadBtn}</button>
                                    <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handlePipBgUpload}/>
                                </div>
                                {customPipBgBase64 && (<div className="flex items-center gap-3 p-2 bg-slate-950 rounded-xl border border-indigo-500/30"><img src={customPipBgBase64} className="w-10 h-10 rounded-lg object-cover" /><span className="text-[9px] text-slate-500 uppercase font-black">Shield Ready</span><button onClick={() => {setCustomPipBgBase64(null); pipBgImageRef.current = null;}} className="ml-auto p-1.5 text-slate-600 hover:text-red-400"><X size={14}/></button></div>)}
                            </div>

                            <div className="space-y-3 pt-2 border-t border-slate-800">
                                <div className="flex items-center justify-between p-3 bg-slate-950 rounded-2xl border border-slate-800">
                                    <div className="flex items-center gap-2 text-slate-300"><Droplets size={14}/> <span className="text-[10px] font-bold uppercase">{t.blurCam}</span></div>
                                    <button onClick={() => setIsCamBlurred(!isCamBlurred)} className={`w-10 h-5 rounded-full relative transition-all ${isCamBlurred ? 'bg-indigo-600' : 'bg-slate-700'}`}><div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isCamBlurred ? 'right-1' : 'left-1'}`}></div></button>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-slate-950 rounded-2xl border border-slate-800">
                                    <div className="flex items-center gap-2 text-slate-300"><Camera size={14}/> <span className="text-[10px] font-bold uppercase">{t.camEnable}</span></div>
                                    <button onClick={() => setUseCamera(!useCamera)} className={`w-10 h-5 rounded-full relative transition-all ${useCamera ? 'bg-indigo-600' : 'bg-slate-700'}`}><div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${useCamera ? 'right-1' : 'left-1'}`}></div></button>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-slate-950 rounded-2xl border border-slate-800">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${isDimmed ? 'bg-amber-600' : 'bg-slate-800'} text-white`}><MonitorOff size={16}/></div>
                                        <div><p className="text-[10px] font-bold text-white uppercase">{t.dimMode}</p><p className="text-[8px] text-slate-500 uppercase">{t.dimDesc}</p></div>
                                    </div>
                                    <button onClick={() => setIsDimmed(!isDimmed)} className={`w-10 h-5 rounded-full relative transition-all ${isDimmed ? 'bg-amber-600' : 'bg-slate-700'}`}><div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isDimmed ? 'right-1' : 'left-1'}`}></div></button>
                                </div>
                            </div>
                        </div>
                    </div>
                 </div>
             )}

             <button onClick={handleStartSession} className="px-16 py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-[0.4em] rounded-full shadow-2xl shadow-indigo-900/40 transition-transform hover:scale-105 active:scale-95">Link Neural Fabric</button>
         </div>
      ) : (
         <div className="flex-1 flex flex-col min-0 relative">
            {isWaitingForFrames && (
               <div className="absolute inset-0 z-[130] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center gap-6 animate-fade-in"><Loader2 className="animate-spin text-indigo-500" size={48} /><span className="text-sm font-black text-white uppercase tracking-widest">Synchronizing Streams...</span></div>
            )}
            {isFinalizing && (
               <div className="absolute inset-0 z-[130] bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-center p-12 text-center animate-fade-in"><div className="w-full max-w-md space-y-8"><div className="relative flex justify-center"><Loader2 className="animate-spin text-indigo-500" size={64} /><div className="absolute inset-0 flex items-center justify-center"><span className="text-[10px] font-black text-white">{Math.round(uploadProgress)}%</span></div></div><div className="space-y-2"><h3 className="text-xl font-black text-white uppercase italic tracking-tighter">{t.finalizing}</h3><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Streaming to Sovereign Vault...</p></div><div className="w-full h-2 bg-slate-900 rounded-full border border-slate-800 overflow-hidden shadow-inner"><div className="h-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 transition-all duration-300" style={{ width: `${uploadProgress}%` }} /></div></div></div>
            )}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
               {transcript.map((item, index) => (
                   <div key={index} className={`flex flex-col ${item.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in-up`}><span className={`text-[10px] uppercase font-bold tracking-wider mb-1 ${item.role === 'user' ? 'text-indigo-400' : 'text-emerald-400'}`}>{item.role === 'user' ? 'You' : channel.author}</span><div className={`max-w-[90%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${item.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm shadow-xl' : 'bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700 shadow-md'}`}>{item.text}</div></div>
               ))}
               {currentLine && (
                   <div className={`flex flex-col ${currentLine.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in`}><span className={`text-[10px] uppercase font-bold tracking-wider mb-1 ${currentLine.role === 'user' ? 'text-indigo-400' : 'text-emerald-400'}`}>{currentLine.role === 'user' ? 'You' : channel.author}</span><div className={`max-w-[90%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${currentLine.role === 'user' ? 'bg-indigo-600/80 text-white rounded-tr-sm shadow-xl' : 'bg-slate-800/80 text-slate-200 rounded-tl-sm border border-slate-700 shadow-md'}`}>{currentLine.text}</div></div>
               )}
            </div>
            <div className="px-6 py-4 bg-slate-900 border-t border-slate-800 flex flex-col items-center gap-4 shrink-0"><div className="w-full flex justify-center h-40"><Visualizer volume={volume} isActive={isConnected} color="#6366f1" /></div><div className="w-full flex items-center justify-between text-slate-500 text-[10px] font-black uppercase tracking-widest"><div className="flex items-center space-x-2"><ScrollText size={14} className="text-indigo-400"/><span>{t.transcript}</span></div></div></div>
         </div>
      )}
    </div>
  );
};
