import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Channel, TranscriptItem, GeneratedLecture, CommunityDiscussion, RecordingSession, Attachment } from '../types';
import { GeminiLiveService } from '../services/geminiLive';
import { Mic, MicOff, PhoneOff, Radio, AlertCircle, ScrollText, RefreshCw, Music, Download, Share2, Trash2, Quote, Copy, Check, MessageSquare, BookPlus, Loader2, Globe, FilePlus, Play, Save, CloudUpload, Link, X, Video, Monitor, Camera, Youtube, ClipboardList } from 'lucide-react';
import { auth } from '../services/firebaseConfig';
import { getDriveToken } from '../services/authService';
import { uploadToYouTube, getYouTubeVideoUrl } from '../services/youtubeService';
import { ensureCodeStudioFolder, uploadToDrive } from '../services/googleDriveService';
import { saveUserChannel, cacheLectureScript, getCachedLectureScript } from '../utils/db';
import { publishChannelToFirestore, saveDiscussion, saveRecordingReference, updateBookingRecording, addChannelAttachment, updateDiscussion } from '../services/firestoreService';
import { summarizeDiscussionAsSection, generateDesignDocFromTranscript } from '../services/lectureGenerator';
import { FunctionDeclaration, Type } from '@google/genai';

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
    establishing: "Establishing secure link...",
    holdMusic: "Playing hold music...",
    preparing: "Preparing studio environment...",
    transcript: "Live Transcript",
    copied: "Copied",
    listening: "Listening...",
    connecting: "Connecting to AI Studio...",
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
    saveSession: "Save Session"
  },
  zh: {
    welcomePrefix: "试着问...",
    reconnecting: "正在重新连接...",
    establishing: "建立安全连接...",
    holdMusic: "播放等待音乐...",
    preparing: "准备演播室环境...",
    transcript: "实时字幕",
    copied: "已复制",
    listening: "正在聆听...",
    connecting: "连接到 AI 演播室...",
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
    saveSession: "保存会话"
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

export const LiveSession: React.FC<LiveSessionProps> = ({ 
  channel, initialContext, lectureId, onEndSession, language, 
  recordingEnabled, videoEnabled, cameraEnabled, activeSegment, 
  initialTranscript, existingDiscussionId,
  customTools, onCustomToolCall 
}) => {
  const t = UI_TEXT[language];
  const [hasStarted, setHasStarted] = useState(false); 
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploadingRecording, setIsUploadingRecording] = useState(false);
  
  // Action Progress States
  const [isAppending, setIsAppending] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isSavingLesson, setIsSavingLesson] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mixingAudioContextRef = useRef<AudioContext | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const [transcript, setTranscript] = useState<TranscriptItem[]>(initialTranscript || []);
  const [currentLine, setCurrentLine] = useState<TranscriptItem | null>(null);
  const transcriptRef = useRef<TranscriptItem[]>(initialTranscript || []);
  
  useEffect(() => { 
      transcriptRef.current = transcript; 
      mountedRef.current = true;
      return () => { mountedRef.current = false; };
  }, [transcript]);

  const serviceRef = useRef<GeminiLiveService | null>(null);
  const currentUser = auth?.currentUser;
  // Fix: Defined isOwner to check if the current user has ownership or admin privileges for the channel.
  const isOwner = currentUser && (channel.ownerId === currentUser.uid || currentUser.email === 'shengliang.song.ai@gmail.com');

  const handleStartSession = async () => {
      setError(null);
      try {
          // 1. Capture Hardware IMMEDIATELY on User Interaction
          if (recordingEnabled) {
              if (videoEnabled) {
                  screenStreamRef.current = await navigator.mediaDevices.getDisplayMedia({ 
                      video: { cursor: "always" } as any,
                      audio: false 
                  });
              }
              if (cameraEnabled) {
                  cameraStreamRef.current = await navigator.mediaDevices.getUserMedia({ 
                      video: true, 
                      audio: false 
                  });
              }
          }
          setHasStarted(true);
          await connect();
      } catch (e: any) {
          console.error("Hardware denied", e);
          setError(e.name === 'NotAllowedError' ? "Hardware access denied. Refresh and try again." : "Hardware init failed.");
          setHasStarted(false);
      }
  };

  const startRecording = useCallback(async () => {
      if (!recordingEnabled || !serviceRef.current || !currentUser) return;
      
      try {
          const mixCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          mixingAudioContextRef.current = mixCtx;
          const dest = mixCtx.createMediaStreamDestination();
          
          const aiStream = serviceRef.current.getOutputMediaStream();
          if (aiStream) { 
              const aiSource = mixCtx.createMediaStreamSource(aiStream); 
              aiSource.connect(dest); 
          }
          
          const userStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const userSource = mixCtx.createMediaStreamSource(userStream); 
          userSource.connect(dest);

          const canvas = document.createElement('canvas');
          canvas.width = 1280; canvas.height = 720;
          const ctx = canvas.getContext('2d', { alpha: false })!;
          
          const screenVideo = document.createElement('video');
          if (screenStreamRef.current) { screenVideo.srcObject = screenStreamRef.current; screenVideo.muted = true; screenVideo.play(); }
          const cameraVideo = document.createElement('video');
          if (cameraStreamRef.current) { cameraVideo.srcObject = cameraStreamRef.current; cameraVideo.muted = true; cameraVideo.play(); }

          const drawCompositor = () => {
              if (!mountedRef.current) return;
              ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, canvas.width, canvas.height);

              if (screenStreamRef.current && screenVideo.readyState >= 2) ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
              else {
                  ctx.fillStyle = '#1e293b'; ctx.fillRect(40, 40, canvas.width - 80, canvas.height - 80);
                  ctx.fillStyle = '#94a3b8'; ctx.font = 'bold 30px sans-serif'; ctx.textAlign = 'center';
                  ctx.fillText('Interactive Audio Session', canvas.width / 2, canvas.height / 2);
              }

              if (cameraStreamRef.current && cameraVideo.readyState >= 2) {
                  const pipW = 320, pipH = 180, m = 24;
                  ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 4;
                  ctx.strokeRect(canvas.width - pipW - m, canvas.height - pipH - m, pipW, pipH);
                  ctx.drawImage(cameraVideo, canvas.width - pipW - m, canvas.height - pipH - m, pipW, pipH);
              }
              animationFrameRef.current = requestAnimationFrame(drawCompositor);
          };
          drawCompositor();

          const captureStream = canvas.captureStream(30);
          dest.stream.getAudioTracks().forEach(track => captureStream.addTrack(track));

          const recorder = new MediaRecorder(captureStream, {
              mimeType: 'video/webm;codecs=vp8,opus',
              videoBitsPerSecond: 2500000
          });

          audioChunksRef.current = [];
          recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
          
          recorder.onstop = async () => {
              if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
              
              const isVideo = !!(screenStreamRef.current || cameraStreamRef.current);
              const videoBlob = new Blob(audioChunksRef.current, { type: isVideo ? 'video/webm' : 'audio/webm' });
              const transcriptText = transcriptRef.current.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n\n');
              const transcriptBlob = new Blob([transcriptText], { type: 'text/plain' });

              setIsUploadingRecording(true);
              try {
                  const token = getDriveToken();
                  if (token) {
                      const folderId = await ensureCodeStudioFolder(token);
                      const timestamp = Date.now();
                      const recId = `session-${timestamp}`;
                      
                      let videoUrl = '';
                      if (isVideo) {
                          try {
                              const ytId = await uploadToYouTube(token, videoBlob, {
                                  title: `${channel.title}: AI Session`,
                                  description: `Recorded via AIVoiceCast.\n\nSummary:\n${transcriptText.substring(0, 1000)}`,
                                  privacyStatus: 'unlisted'
                              });
                              videoUrl = getYouTubeVideoUrl(ytId);
                          } catch (ytErr) { console.warn("YT Upload fail", ytErr); }
                      }

                      const driveFileId = await uploadToDrive(token, folderId, `${recId}.webm`, videoBlob);
                      const tFileId = await uploadToDrive(token, folderId, `${recId}_transcript.txt`, transcriptBlob);
                      
                      const sessionData: RecordingSession = {
                          id: recId, userId: currentUser.uid, channelId: channel.id,
                          channelTitle: channel.title, channelImage: channel.imageUrl,
                          timestamp, mediaUrl: videoUrl || `drive://${driveFileId}`,
                          mediaType: isVideo ? 'video/webm' : 'audio/webm',
                          transcriptUrl: `drive://${tFileId}`
                      };
                      await saveRecordingReference(sessionData);
                  }
              } catch(e) { console.error("Cloud sync failed", e); } finally { 
                  setIsUploadingRecording(false); 
                  onEndSession();
              }
              userStream.getTracks().forEach(t => t.stop());
              screenStreamRef.current?.getTracks().forEach(t => t.stop());
              cameraStreamRef.current?.getTracks().forEach(t => t.stop());
              mixCtx.close();
          };
          mediaRecorderRef.current = recorder;
          recorder.start(1000);
      } catch(e) { console.warn("Recording start failure", e); }
  }, [recordingEnabled, channel, currentUser, onEndSession]);

  const connect = useCallback(async () => {
    let service = serviceRef.current || new GeminiLiveService();
    serviceRef.current = service;
    service.initializeAudio();
    try {
      let effectiveInstruction = channel.systemInstruction;
      const historyToInject = transcriptRef.current.length > 0 ? transcriptRef.current : (initialTranscript || []);
      if (historyToInject.length > 0) {
          effectiveInstruction += `\n\n[CONTEXT]:\n${historyToInject.map(t => `${t.role}: ${t.text}`).join('\n')}`;
      }
      await service.connect(channel.voiceName, effectiveInstruction, {
          onOpen: () => { setIsConnected(true); if (recordingEnabled) startRecording(); },
          onClose: () => { setIsConnected(false); setHasStarted(false); },
          onError: (err) => { setIsConnected(false); setError(err); },
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
                      setTranscript(h => [...h, { role: 'ai', text: `*[System]: Saving artifact '${filename}' to history.*`, timestamp: Date.now() }]);
                      serviceRef.current?.sendToolResponse({ functionResponses: [{ id: fc.id, name: fc.name, response: { result: "Document saved." } }] });
                  } else if (onCustomToolCall) {
                      const result = await onCustomToolCall(fc.name, fc.args);
                      serviceRef.current?.sendToolResponse({ functionResponses: [{ id: fc.id, name: fc.name, response: { result } }] });
                  }
              }
          }
      }, [{ functionDeclarations: [saveContentTool] }]);
    } catch (e) { setError("AI initialization failed."); }
  }, [channel.id, channel.voiceName, channel.systemInstruction, recordingEnabled, startRecording]);

  const handleDisconnect = async () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
      } else { onEndSession(); }
      serviceRef.current?.disconnect();
      const fullTranscript = currentLine ? [...transcript, currentLine] : transcript;
      if (currentUser && fullTranscript.length > 0) {
          const discussion: CommunityDiscussion = { 
              id: existingDiscussionId || '', 
              lectureId: activeSegment?.lectureId || lectureId || channel.id, 
              channelId: channel.id, userId: currentUser.uid, 
              userName: currentUser.displayName || 'Anonymous', 
              transcript: fullTranscript, createdAt: Date.now(), 
              title: `${channel.title}: Live Session` 
          };
          if (existingDiscussionId) await updateDiscussion(existingDiscussionId, fullTranscript);
          else await saveDiscussion(discussion);
      }
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
                  alert("Discussion appended to lecture script.");
              }
          }
      } catch(e) { alert("Append failed."); } finally { setIsAppending(false); }
  };

  const handleAddToCurriculum = async () => {
      if (!currentUser) return;
      const fullTranscript = currentLine ? [...transcript, currentLine] : transcript;
      setIsSavingLesson(true);
      try {
          const title = `Live Notes - ${new Date().toLocaleDateString()}`;
          const nb: GeneratedLecture = { topic: title, professorName: channel.voiceName, studentName: "User", sections: fullTranscript.map(t => ({ speaker: t.role === 'user' ? 'Student' : 'Teacher', text: t.text })) };
          await cacheLectureScript(`lecture_${channel.id}_live_${Date.now()}_${language}`, nb);
          alert("Session saved as new curriculum item.");
      } catch (e) { alert("Save failed."); } finally { setIsSavingLesson(false); }
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-950">
      <div className="p-4 flex items-center justify-between bg-slate-900 border-b border-slate-800 shrink-0">
         <div className="flex items-center space-x-3">
            <img src={channel.imageUrl} className="w-10 h-10 rounded-full border border-slate-700 object-cover" />
            <div>
               <h2 className="text-sm font-bold text-white leading-tight">{channel.title}</h2>
               <span className="text-xs text-indigo-400 font-medium">Live Studio</span>
            </div>
         </div>
         <div className="flex items-center gap-3">
            {recordingEnabled && isConnected && (
                <div className="flex items-center gap-2 px-2 py-1 bg-red-900/20 text-red-400 border border-red-500/20 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                    <span>REC</span>
                </div>
            )}
            <button onClick={handleDisconnect} className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-colors">End Session</button>
         </div>
      </div>

      {!hasStarted ? (
         <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
             <div className="w-20 h-20 bg-indigo-600/10 rounded-full flex items-center justify-center animate-pulse"><Mic size={40} className="text-indigo-500" /></div>
             <div>
                 <h3 className="text-xl font-bold text-white uppercase tracking-tighter italic">{t.tapToStart}</h3>
                 <p className="text-slate-400 text-sm mt-2 max-w-xs leading-relaxed">{t.tapDesc}</p>
                 <div className="flex justify-center gap-4 mt-4">
                     {videoEnabled && <div className="flex items-center gap-1.5 text-[10px] font-black text-indigo-400 uppercase"><Monitor size={14}/> Screen</div>}
                     {cameraEnabled && <div className="flex items-center gap-1.5 text-[10px] font-black text-red-400 uppercase"><Camera size={14}/> Camera</div>}
                 </div>
             </div>
             <button onClick={handleStartSession} className="px-12 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest rounded-full shadow-2xl shadow-indigo-500/30 transition-transform hover:scale-105">{t.start}</button>
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
               <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center gap-6 animate-fade-in">
                  <div className="relative"><div className="w-24 h-24 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" /><Youtube className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-red-500" size={32}/></div>
                  <div className="text-center"><span className="text-sm font-black text-white uppercase tracking-widest">{t.uploading}</span><p className="text-xs text-slate-500 mt-1">Exporting to YouTube & Drive...</p></div>
               </div>
            )}
            {!isConnected && <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 z-10 backdrop-blur-sm"><div className="flex flex-col items-center space-y-4"><Loader2 size={32} className="text-indigo-500 animate-spin" /><p className="text-sm font-medium text-indigo-300">{t.connecting}</p></div></div>}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
               {transcript.map((item, index) => (
                   <div key={index} className={`flex flex-col ${item.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in-up`}>
                       <span className={`text-[10px] uppercase font-bold tracking-wider mb-1 ${item.role === 'user' ? 'text-indigo-400' : 'text-emerald-400'}`}>{item.role === 'user' ? 'You' : channel.voiceName}</span>
                       <div className={`max-w-[90%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${item.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700'}`}>{item.text}</div>
                   </div>
               ))}
               {currentLine && (
                   <div className={`flex flex-col ${currentLine.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in`}>
                       <span className={`text-[10px] uppercase font-bold tracking-wider mb-1 ${currentLine.role === 'user' ? 'text-indigo-400' : 'text-emerald-400'}`}>{currentLine.role === 'user' ? 'You' : channel.voiceName}</span>
                       <div className={`max-w-[90%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${currentLine.role === 'user' ? 'bg-indigo-600/80 text-white rounded-tr-sm' : 'bg-slate-800/80 text-slate-200 rounded-tl-sm border border-slate-700'}`}>{currentLine.text}<span className="inline-block w-1.5 h-4 ml-1 align-middle bg-current opacity-50 animate-blink"></span></div>
                   </div>
               )}
            </div>
            <div className="p-3 border-t border-slate-800 bg-slate-900 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-2 text-slate-500 text-[10px] font-black uppercase tracking-widest"><ScrollText size={14} className="text-indigo-400"/><span>{t.transcript}</span></div>
                <div className="flex items-center gap-2">
                    {lectureId && <button onClick={handleAppendToLecture} disabled={isAppending} className="p-2 bg-indigo-900/40 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/20 rounded-lg transition-all" title={t.appendToLecture}>{isAppending ? <Loader2 size={16} className="animate-spin"/> : <FilePlus size={16}/>}</button>}
                    {isOwner && <button onClick={handleAddToCurriculum} disabled={isSavingLesson} className="p-2 bg-emerald-900/40 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/20 rounded-lg transition-all" title={t.saveToCourse}>{isSavingLesson ? <Loader2 size={16} className="animate-spin"/> : <BookPlus size={16}/>}</button>}
                    <button onClick={handleDisconnect} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors" title="Save Session"><Save size={16}/></button>
                </div>
            </div>
         </div>
      )}
    </div>
  );
};