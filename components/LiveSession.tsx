
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Channel, TranscriptItem, GeneratedLecture, CommunityDiscussion, RecordingSession, Attachment, UserProfile } from '../types';
import { GeminiLiveService } from '../services/geminiLive';
import { Mic, MicOff, PhoneOff, Radio, AlertCircle, ScrollText, RefreshCw, Music, Download, Share2, Trash2, Quote, Copy, Check, MessageSquare, BookPlus, Loader2, Globe, FilePlus, Play, Save, CloudUpload, Link, X, Video, Monitor, Camera, Youtube, ClipboardList, Maximize2, Minimize2, Activity, Terminal, ShieldAlert, LogIn, Wifi, WifiOff } from 'lucide-react';
import { auth } from '../services/firebaseConfig';
import { getDriveToken, signInWithGoogle } from '../services/authService';
import { uploadToYouTube, getYouTubeVideoUrl } from '../services/youtubeService';
import { ensureCodeStudioFolder, uploadToDrive } from '../services/googleDriveService';
import { saveUserChannel, cacheLectureScript, getCachedLectureScript, saveLocalRecording } from '../utils/db';
import { publishChannelToFirestore, saveDiscussion, saveRecordingReference, updateBookingRecording, addChannelAttachment, updateDiscussion, linkDiscussionToLectureSegment, syncUserProfile, getUserProfile } from '../services/firestoreService';
import { summarizeDiscussionAsSection, generateDesignDocFromTranscript } from '../services/lectureGenerator';
import { FunctionDeclaration, Type } from '@google/genai';
import { getGlobalAudioContext, getGlobalMediaStreamDest, warmUpAudioContext } from '../utils/audioUtils';

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
    reconnecting: "Reconnecting...",
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
    signIn: "Sign In"
  },
  zh: {
    welcomePrefix: "试着问...",
    reconnecting: "正在重新连接...",
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
    signIn: "登录"
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
  const [showReconnectButton, setShowReconnectButton] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cloudWarning, setCloudWarning] = useState(false);
  const [isUploadingRecording, setIsUploadingRecording] = useState(false);
  const [synthesisProgress, setSynthesisProgress] = useState(0);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [logs, setLogs] = useState<{time: string, msg: string, type: 'info' | 'error' | 'warn'}[]>([]);
  
  const [isAppending, setIsAppending] = useState(false);
  const [isSavingLesson, setIsSavingLesson] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const reconnectTimeoutRef = useRef<any>(null);

  const [transcript, setTranscript] = useState<TranscriptItem[]>(initialTranscript || []);
  const [currentLine, setCurrentLine] = useState<TranscriptItem | null>(null);
  const transcriptRef = useRef<TranscriptItem[]>(initialTranscript || []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeQuoteIndex, setActiveQuoteIndex] = useState<number | null>(null);

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
      return () => { mountedRef.current = false; };
  }, [transcript, currentLine]);

  const serviceRef = useRef<GeminiLiveService | null>(null);
  const currentUser = auth?.currentUser;
  const isOwner = currentUser && (channel.ownerId === currentUser.uid || currentUser.email === 'shengliang.song.ai@gmail.com');

  const startHardwareSync = async () => {
    // CRITICAL: Request screen capture IMMEDIATELY to satisfy iOS user-gesture requirement
    if (recordingEnabled) {
        const isMeeting = channel.id.startsWith('meeting');
        if (videoEnabled || isMeeting) {
            try {
                screenStreamRef.current = await navigator.mediaDevices.getDisplayMedia({ 
                    video: { cursor: "always" } as any,
                    audio: true 
                });
                addLog("Screen capture active.");
            } catch(e) {
                addLog("Screen capture declined or not supported on this mobile browser.", "warn");
            }
        }
        
        if (cameraEnabled) {
            try {
                cameraStreamRef.current = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: "user" }, 
                    audio: false 
                });
                addLog("Camera capture active.");
            } catch(e) {
                addLog("Camera capture declined.", "warn");
            }
        }
    }
  };

  const handleStartSession = async () => {
      setError(null);
      
      // 1. Immediately request hardware to capture user gesture for iOS
      await startHardwareSync();

      const ctx = getGlobalAudioContext();
      addLog("Warming up neural audio fabric...");
      await warmUpAudioContext(ctx);
      
      setHasStarted(true);
      await connect();
  };

  const handleSignInInPlace = async () => {
      try {
          const user = await signInWithGoogle();
          if (user) {
              await syncUserProfile(user);
              setCloudWarning(false);
              addLog("Cloud Token Acquired.");
          }
      } catch (e) {
          console.error("Sign in failed", e);
      }
  };

  useEffect(() => {
      if (cameraStreamRef.current && localVideoRef.current) {
          localVideoRef.current.srcObject = cameraStreamRef.current;
          localVideoRef.current.play().catch(console.error);
      }
  }, [hasStarted, cameraEnabled]);

  const startRecording = useCallback(async () => {
      if (!recordingEnabled || !serviceRef.current || !currentUser) return;
      
      try {
          const ctx = getGlobalAudioContext();
          const recordingDest = getGlobalMediaStreamDest();
          
          const userStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const userSource = ctx.createMediaStreamSource(userStream); 
          userSource.connect(recordingDest);

          if (screenStreamRef.current && screenStreamRef.current.getAudioTracks().length > 0) {
              const systemAudioSource = ctx.createMediaStreamSource(screenStreamRef.current);
              systemAudioSource.connect(recordingDest);
              addLog("Routing System Audio to AI Agent.");
          }

          // IMPROVED: Logic to determine aspect ratio based on available stream settings
          const screenTrack = screenStreamRef.current?.getVideoTracks()[0];
          const camTrack = cameraStreamRef.current?.getVideoTracks()[0];
          let isPortrait = window.innerHeight > window.innerWidth;
          
          if (screenTrack) {
              const settings = screenTrack.getSettings();
              if (settings.width && settings.height) {
                  isPortrait = settings.height > settings.width;
              }
          } else if (camTrack) {
              const settings = camTrack.getSettings();
              if (settings.width && settings.height) {
                  isPortrait = settings.height > settings.width;
              }
          }

          const canvas = document.createElement('canvas');
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
                  const w = screenVideo.videoWidth * scale;
                  const h = screenVideo.videoHeight * scale;
                  const x = (canvas.width - w) / 2;
                  const y = (canvas.height - h) / 2;
                  drawCtx.drawImage(screenVideo, x, y, w, h);
              } else {
                  // If screen share is missing (common on iPhone), use a nice visual backdrop
                  const gradient = drawCtx.createLinearGradient(0, 0, canvas.width, canvas.height);
                  gradient.addColorStop(0, '#1e1b4b');
                  gradient.addColorStop(1, '#020617');
                  drawCtx.fillStyle = gradient;
                  drawCtx.fillRect(0, 0, canvas.width, canvas.height);

                  drawCtx.fillStyle = '#6366f1'; drawCtx.font = 'bold 40px sans-serif'; drawCtx.textAlign = 'center';
                  drawCtx.fillText('Neural Broadcast', canvas.width / 2, canvas.height / 2 - 40);
                  drawCtx.fillStyle = '#94a3b8'; drawCtx.font = '24px sans-serif';
                  drawCtx.fillText(channel.title, canvas.width / 2, canvas.height / 2 + 20);
              }

              if (cameraStreamRef.current && cameraVideo.readyState >= 2) {
                  const pipW = isPortrait ? canvas.width * 0.5 : 320;
                  const pipH = (pipW * cameraVideo.videoHeight) / cameraVideo.videoWidth;
                  const m = 24;
                  
                  const pipX = isPortrait ? (canvas.width - pipW) / 2 : canvas.width - pipW - m;
                  const pipY = isPortrait ? canvas.height - pipH - 150 : canvas.height - pipH - m;

                  drawCtx.save();
                  drawCtx.shadowColor = 'rgba(0,0,0,0.5)';
                  drawCtx.shadowBlur = 20;
                  drawCtx.strokeStyle = '#6366f1'; drawCtx.lineWidth = 4;
                  drawCtx.strokeRect(pipX, pipY, pipW, pipH);
                  drawCtx.drawImage(cameraVideo, pipX, pipY, pipW, pipH);
                  drawCtx.restore();
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

          audioChunksRef.current = [];
          recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
          
          recorder.onstop = async () => {
              if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
              
              const videoBlob = new Blob(audioChunksRef.current, { type: 'video/webm' });
              const transcriptText = transcriptRef.current.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n\n');
              const transcriptBlob = new Blob([transcriptText], { type: 'text/plain' });

              setIsUploadingRecording(true);
              setSynthesisProgress(10);
              try {
                  const timestamp = Date.now();
                  const recId = `session-${timestamp}`;
                  setSynthesisProgress(30);
                  await saveLocalRecording({
                      id: recId, userId: currentUser.uid, channelId: channel.id,
                      channelTitle: channel.title, channelImage: channel.imageUrl,
                      timestamp, mediaUrl: URL.createObjectURL(videoBlob),
                      mediaType: 'video/webm', transcriptUrl: URL.createObjectURL(transcriptBlob),
                      blob: videoBlob
                  });

                  setSynthesisProgress(50);
                  const token = getDriveToken();
                  if (token) {
                      const profile = await getUserProfile(currentUser.uid);
                      const pref = profile?.preferredRecordingTarget || 'drive';
                      const folderId = await ensureCodeStudioFolder(token);
                      
                      let videoUrl = '';
                      if (pref === 'youtube' || channel.id.startsWith('meeting')) {
                          try {
                              setSynthesisProgress(70);
                              const ytId = await uploadToYouTube(token, videoBlob, {
                                  title: `${channel.title}: AI Session`,
                                  description: `Recorded via AIVoiceCast.\n\nSummary:\n${transcriptText.substring(0, 1000)}`,
                                  privacyStatus: 'unlisted'
                              });
                              videoUrl = getYouTubeVideoUrl(ytId);
                          } catch (ytErr: any) { 
                              addLog(`YouTube Failed: ${ytErr.message}`, "warn");
                          }
                      }

                      let tFileId = '';
                      let driveFileId = '';
                      tFileId = await uploadToDrive(token, folderId, `${recId}_transcript.txt`, transcriptBlob);

                      if (pref === 'drive' || !videoUrl) {
                          setSynthesisProgress(85);
                          driveFileId = await uploadToDrive(token, folderId, `${recId}.webm`, videoBlob);
                      }
                      
                      const sessionData: RecordingSession = {
                          id: recId, userId: currentUser.uid, channelId: channel.id,
                          channelTitle: channel.title, channelImage: channel.imageUrl,
                          timestamp, mediaUrl: videoUrl || (driveFileId ? `drive://${driveFileId}` : ''),
                          mediaType: 'video/webm', transcriptUrl: tFileId ? `drive://${tFileId}` : ''
                      };
                      await saveRecordingReference(sessionData);
                  }
                  setSynthesisProgress(100);
              } catch(e: any) { 
                  console.error("Cloud sync failed", e); 
              } finally { 
                  setIsUploadingRecording(false); 
                  onEndSession();
              }
              userStream.getTracks().forEach(t => t.stop());
              screenStreamRef.current?.getTracks().forEach(t => t.stop());
              cameraStreamRef.current?.getTracks().forEach(t => t.stop());
          };
          mediaRecorderRef.current = recorder;
          recorder.start(1000);
      } catch(e) { 
          console.warn("Recording start failure", e); 
      }
  }, [recordingEnabled, channel, currentUser, onEndSession, addLog, transcript]);

  const connect = useCallback(async () => {
    setIsConnected(false);
    setShowReconnectButton(false);
    
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    reconnectTimeoutRef.current = setTimeout(() => {
        if (!isConnected && mountedRef.current) setShowReconnectButton(true);
    }, 8000);

    let service = serviceRef.current || new GeminiLiveService();
    serviceRef.current = service;
    await service.initializeAudio();
    
    try {
      const now = new Date();
      const timeStr = now.toLocaleString(undefined, { 
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', 
          hour: '2-digit', minute: '2-digit', second: '2-digit' 
      });
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      let effectiveInstruction = `[SYSTEM_TIME_CONTEXT]: Current Local Time is ${timeStr} (${timeZone}).\n\n`;
      
      if (channel.id.startsWith('meeting')) {
          effectiveInstruction += `You are currently in a CO-WATCHING and RECORDING session. You will hear both the user's voice and the system audio. 
          TASK: Actively listen and summarize the shared content.\n\n`;
      }

      effectiveInstruction += channel.systemInstruction;
      
      const historyToInject = transcriptRef.current.length > 0 ? transcriptRef.current : (initialTranscript || []);
      if (historyToInject.length > 0) {
          effectiveInstruction += `\n\n[CONTEXT]:\n${historyToInject.map(t => `${t.role}: ${t.text}`).join('\n')}`;
      }
      if (initialContext) {
          effectiveInstruction += `\n\n[USER CONTEXT]: ${initialContext}`;
      }

      addLog("Establishing Neural Link...");
      await service.connect(channel.voiceName, effectiveInstruction, {
          onOpen: () => { 
              setIsConnected(true); 
              setShowReconnectButton(false);
              if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
              addLog("Link Active.");
              if (recordingEnabled) startRecording(); 
          },
          onClose: (reason, code) => { 
              setIsConnected(false); 
              addLog(`Link Closed: ${reason}`);
          },
          onError: (err) => { 
              setIsConnected(false); 
              setError(err); 
          },
          onVolumeUpdate: () => {},
          onTranscript: (text, isUser) => {
              const role = isUser ? 'user' : 'ai';
              setCurrentLine(prev => {
                  if (prev && prev.role !== role) { 
                      setTranscript(history => [...history, prev]); 
                      return { role, text, timestamp: Date.now() }; 
                  }
                  return { role, text: (prev ? prev.text : '') + text, timestamp: prev ? prev.timestamp : Date.now() };
              });
          },
          onToolCall: async (toolCall: any) => {
              for (const fc of toolCall.functionCalls) {
                  if (fc.name === 'save_content') {
                      const { filename, content } = fc.args;
                      setTranscript(h => [...h, { role: 'ai', text: `*[System]: Artifact '${filename}' saved.*`, timestamp: Date.now() }]);
                      serviceRef.current?.sendToolResponse({ functionResponses: [{ id: fc.id, name: fc.name, response: { result: "Document captured." } }] });
                  } else if (onCustomToolCall) {
                      const result = await onCustomToolCall(fc.name, fc.args);
                      serviceRef.current?.sendToolResponse({ functionResponses: [{ id: fc.id, name: fc.name, response: { result } }] });
                  }
              }
          }
      }, [{ functionDeclarations: [saveContentTool] }]);
    } catch (e: any) { 
        setError("AI init failure."); 
    }
  }, [channel.id, channel.voiceName, channel.systemInstruction, initialContext, recordingEnabled, startRecording, onCustomToolCall, addLog, initialTranscript, isConnected]);

  const handleDisconnect = async () => {
      addLog("Closing Session...");
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
      } else { 
          const fullTranscript = currentLine ? [...transcript, currentLine] : transcript;
          if (currentUser && fullTranscript.length > 0) {
              const discussion: CommunityDiscussion = { 
                  id: existingDiscussionId || '', 
                  lectureId: activeSegment?.lectureId || lectureId || channel.id, 
                  channelId: channel.id, userId: currentUser.uid, 
                  userName: currentUser.displayName || 'Anonymous', 
                  transcript: fullTranscript, createdAt: Date.now(), 
                  title: `${channel.title}: AI Session` 
              };
              if (existingDiscussionId) await updateDiscussion(existingDiscussionId, fullTranscript);
              else await saveDiscussion(discussion);
          }
          onEndSession(); 
      }
      serviceRef.current?.disconnect();
  };

  const handleAppendToLecture = async () => {
      if (!currentUser || !lectureId) return;
      const fullTranscript = currentLine ? [...transcript, currentLine] : transcript;
      setIsAppending(true);
      try {
          const cacheKey = `lecture_${channel.id}_${lectureId}_${language}`;
          const currentLecture = await getCachedLectureScript(cacheKey);
          if (currentLecture) {
              const newSections = await summarizeDiscussionAsSection(fullTranscript, currentLecture, language);
              if (newSections) {
                  currentLecture.sections.push(...newSections);
                  await cacheLectureScript(cacheKey, currentLecture);
                  alert("Summary appended.");
              }
          }
      } catch(e) { alert("Append failed."); } finally { setIsAppending(false); }
  };

  const handleAddToCurriculum = async () => {
      if (!isOwner) return;
      const fullTranscript = currentLine ? [...transcript, currentLine] : transcript;
      setIsSavingLesson(true);
      try {
          const title = `Live Notes - ${new Date().toLocaleDateString()}`;
          const nb: GeneratedLecture = { topic: title, professorName: channel.voiceName, studentName: "User", sections: fullTranscript.map(t => ({ speaker: t.role === 'user' ? 'Student' : 'Teacher', text: t.text })) };
          await cacheLectureScript(`lecture_${channel.id}_live_${Date.now()}_${language}`, nb);
          alert("Session archived.");
      } catch (e) { alert("Save failed."); } finally { setIsSavingLesson(false); }
  };

  const handleSaveAndLink = async () => {
      if (!activeSegment || !currentUser) return;
      const fullTranscript = currentLine ? [...transcript, currentLine] : transcript;
      setIsLinking(true);
      try {
          const discussion: CommunityDiscussion = { 
              id: '', lectureId: activeSegment.lectureId, channelId: channel.id, 
              userId: currentUser.uid, userName: currentUser.displayName || 'Anonymous', 
              transcript: fullTranscript, createdAt: Date.now(), segmentIndex: activeSegment.index,
              title: `${channel.title}: Linked Context`
          };
          const discussionId = await saveDiscussion(discussion);
          await linkDiscussionToLectureSegment(channel.id, activeSegment.lectureId, activeSegment.index, discussionId);
          alert("Linked!");
      } catch(e) { alert("Link failed."); } finally { setIsLinking(false); }
  };

  const renderMessageContent = (text: string) => {
    const parts = text.split(/```/);
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return (
          <div key={index} className="my-3 rounded-lg overflow-hidden border border-slate-700 bg-slate-950 shadow-lg">
             <div className="flex items-center justify-between px-4 py-1.5 bg-slate-800/80 border-b border-slate-700">
               <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Code Fragment</span>
               <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(part); }} className="flex items-center space-x-1 text-[10px] font-bold text-slate-500 hover:text-indigo-400 transition-colors">
                 <Copy size={10} /><span>Copy</span>
               </button>
             </div>
             <pre className="p-4 text-sm font-mono text-indigo-200 overflow-x-auto whitespace-pre-wrap">{part}</pre>
          </div>
        );
      } else {
        return part.split(/\n\s*\n/).map((paragraph, pIndex) => paragraph.trim() ? <p key={`${index}-${paragraph.substring(0,10)}`} className="mb-3 last:mb-0 leading-relaxed">{paragraph}</p> : null);
      }
    });
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 relative">
      <div className="p-4 flex items-center justify-between bg-slate-900 border-b border-slate-800 shrink-0 z-20">
         <div className="flex items-center space-x-3">
            <img src={channel.imageUrl} className="w-10 h-10 rounded-full border border-slate-700 object-cover" alt={channel.title} />
            <div>
               <h2 className="text-sm font-bold text-white leading-tight">{channel.title}</h2>
               <span className="text-xs text-indigo-400 font-medium">Neural Prism Studio</span>
            </div>
         </div>
         <div className="flex items-center gap-3">
            {recordingEnabled && isConnected && (
                <div className="flex items-center gap-2 px-2 py-1 bg-red-900/20 text-red-400 border border-red-500/20 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                    <span>{t.recording}</span>
                </div>
            )}
            <button onClick={() => setShowDiagnostics(!showDiagnostics)} className={`p-2 rounded-lg transition-colors ${showDiagnostics ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`} title={t.diagnostics}>
                <Activity size={18}/>
            </button>
            <button onClick={handleDisconnect} className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-colors">Terminate</button>
         </div>
      </div>

      {cloudWarning && (
          <div className="bg-amber-600/20 border-b border-amber-600/30 p-2 px-4 flex items-center justify-between animate-fade-in z-20">
              <div className="flex items-center gap-2">
                <ShieldAlert size={14} className="text-amber-400"/>
                <span className="text-[10px] font-bold text-amber-300 uppercase tracking-widest">{t.cloudWarn}</span>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handleSignInInPlace} className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-black uppercase rounded transition-colors flex items-center gap-1.5 shadow-lg">
                    <LogIn size={10}/> {t.signIn}
                </button>
                <button onClick={() => setCloudWarning(false)} className="text-slate-500 hover:text-white"><X size={14}/></button>
              </div>
          </div>
      )}

      {hasStarted && cameraEnabled && (
          <div className="absolute bottom-20 right-6 w-48 aspect-video md:w-64 bg-black border-2 border-indigo-500 rounded-2xl shadow-2xl z-40 overflow-hidden group">
              <div className="absolute top-2 left-2 z-10 bg-black/50 backdrop-blur-md px-2 py-0.5 rounded text-[8px] font-black text-white uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                  {t.localPreview}
              </div>
              <video 
                ref={localVideoRef} 
                autoPlay 
                muted 
                playsInline 
                className="w-full h-full object-cover mirror"
              />
          </div>
      )}

      {showDiagnostics && (
          <div className="absolute top-16 right-4 w-80 max-h-[70%] z-[100] bg-slate-900/95 border border-slate-700 rounded-2xl shadow-2xl flex flex-col animate-fade-in-down backdrop-blur-md">
              <div className="p-3 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2"><Terminal size={14}/> {t.diagnostics}</span>
                  <button onClick={() => setShowDiagnostics(false)} className="text-slate-500 hover:text-white"><X size={16}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-[10px]">
                  {logs.length === 0 ? (
                      <p className="text-slate-600 italic">Listening for neural events...</p>
                  ) : logs.map((log, i) => (
                      <div key={i} className={`flex gap-2 ${log.type === 'error' ? 'text-red-400' : log.type === 'warn' ? 'text-amber-400' : 'text-slate-400'}`}>
                          <span className="opacity-40 shrink-0">[{log.time}]</span>
                          <span className="break-words font-black">{log.msg}</span>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {!hasStarted ? (
         <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
             <div className="w-20 h-20 bg-indigo-600/10 rounded-full flex items-center justify-center animate-pulse"><Mic size={40} className="text-indigo-500" /></div>
             <div>
                 <h3 className="text-xl font-bold text-white uppercase tracking-tighter italic">{t.tapToStart}</h3>
                 <p className="text-slate-400 text-sm mt-2 max-w-xs leading-relaxed">{t.tapDesc}</p>
                 <div className="flex justify-center gap-4 mt-4">
                     {videoEnabled && <div className="flex items-center gap-1.5 text-[10px] font-black text-indigo-400 uppercase"><Monitor size={14}/> Shared Screen</div>}
                     {cameraEnabled && <div className="flex items-center gap-1.5 text-[10px] font-black text-red-400 uppercase"><Camera size={14}/> User Camera</div>}
                 </div>
             </div>
             <button onClick={handleStartSession} className="px-12 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest rounded-full shadow-2xl shadow-indigo-500/30 transition-transform hover:scale-105">Link Neural Fabric</button>
         </div>
      ) : error ? (
         <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
             <AlertCircle size={40} className="text-red-400" />
             <p className="text-red-300 text-sm font-bold">{error}</p>
             <button onClick={handleStartSession} className="flex items-center space-x-2 px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-black uppercase rounded-lg border border-slate-700"><RefreshCw size={14} /><span>{t.retry}</span></button>
         </div>
      ) : (
         <div className="flex-1 flex flex-col min-h-0 relative">
            {isUploadingRecording && (
               <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center gap-8 animate-fade-in">
                  <div className="relative">
                    <div className="w-32 h-32 border-4 border-indigo-500/10 rounded-full" />
                    <div 
                        className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" 
                        style={{ clipPath: `conic-gradient(from 0deg, white ${synthesisProgress}%, transparent ${synthesisProgress}%)` }}
                    />
                    <Youtube className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-red-500" size={40}/>
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xl font-black text-white">{synthesisProgress}%</div>
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-black text-white uppercase tracking-widest">{t.uploading}</span>
                    <p className="text-xs text-slate-500 mt-2 uppercase font-bold tracking-widest opacity-60">Pushing archive to channel</p>
                  </div>
               </div>
            )}
            {!isConnected && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 z-10 backdrop-blur-sm space-y-6">
                    <div className="flex flex-col items-center space-y-4">
                        <Loader2 size={32} className="text-indigo-500 animate-spin" />
                        <p className="text-sm font-medium text-indigo-300">{t.connecting}</p>
                    </div>
                    {showReconnectButton && (
                        <button 
                            onClick={connect}
                            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase rounded-xl shadow-xl shadow-indigo-500/20 animate-fade-in"
                        >
                            <RefreshCw size={14}/>
                            <span>{t.reconnect}</span>
                        </button>
                    )}
                </div>
            )}
            
            <div className="shrink-0 bg-slate-950">
               <SuggestionsBar suggestions={suggestions} welcomeMessage={channel.welcomeMessage} showWelcome={transcript.length === 0 && !currentLine && !initialContext} uiText={t} />
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
               {transcript.map((item, index) => (
                   <div key={index} className={`flex flex-col ${item.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in-up`}>
                       <span className={`text-[10px] uppercase font-bold tracking-wider mb-1 ${item.role === 'user' ? 'text-indigo-400' : 'text-emerald-400'}`}>{item.role === 'user' ? 'You' : channel.author}</span>
                       <div className={`max-w-[90%] px-4 py-3 rounded-2xl text-sm leading-relaxed relative group ${item.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700'}`}>
                           <div className={`absolute ${item.role === 'user' ? '-left-8' : '-right-8'} top-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1`}>
                               <button onClick={() => { navigator.clipboard.writeText(item.text); setActiveQuoteIndex(index); setTimeout(() => setActiveQuoteIndex(null), 1000); }} className="p-1.5 bg-slate-800 text-slate-400 hover:text-white rounded-full border border-slate-700 shadow-lg">
                                   {activeQuoteIndex === index ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                               </button>
                           </div>
                           {renderMessageContent(item.text)}
                       </div>
                   </div>
               ))}
               {currentLine && (
                   <div className={`flex flex-col ${currentLine.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in`}>
                       <span className={`text-[10px] uppercase font-bold tracking-wider mb-1 ${currentLine.role === 'user' ? 'text-indigo-400' : 'text-emerald-400'}`}>{currentLine.role === 'user' ? 'You' : channel.author}</span>
                       <div className={`max-w-[90%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${currentLine.role === 'user' ? 'bg-indigo-600/80 text-white rounded-tr-sm' : 'bg-slate-800/80 text-slate-200 rounded-tl-sm border border-slate-700'}`}>
                           {renderMessageContent(currentLine.text)}
                           <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-current opacity-50 animate-blink"></span>
                       </div>
                   </div>
               )}
            </div>
            <div className="p-3 border-t border-slate-800 bg-slate-900 flex items-center justify-between shrink-0 z-20">
                <div className="flex items-center space-x-2 text-slate-500 text-[10px] font-black uppercase tracking-widest"><ScrollText size={14} className="text-indigo-400"/><span>{t.transcript}</span></div>
                <div className="flex items-center gap-2">
                    {activeSegment && (
                        <button onClick={handleSaveAndLink} disabled={isLinking} className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all" title={t.saveAndLink}>
                            {isLinking ? <Loader2 size={16} className="animate-spin" /> : <Link size={16} />}
                        </button>
                    )}
                    {lectureId && <button onClick={handleAppendToLecture} disabled={isAppending} className="p-2 bg-indigo-900/40 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/20 rounded-lg transition-all" title={t.appendToLecture}>{isAppending ? <Loader2 size={16} className="animate-spin"/> : <FilePlus size={16}/>}</button>}
                    {isOwner && <button onClick={handleAddToCurriculum} disabled={isSavingLesson} className="p-2 bg-emerald-900/40 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/20 rounded-lg transition-all" title={t.saveToCourse}>{isSavingLesson ? <Loader2 size={16} className="animate-spin"/> : <BookPlus size={16}/>}</button>}
                    <button onClick={handleDisconnect} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors" title={t.saveSession}><Save size={16}/></button>
                </div>
            </div>
         </div>
      )}
    </div>
  );
};
