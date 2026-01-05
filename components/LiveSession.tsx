
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Channel, TranscriptItem, GeneratedLecture, CommunityDiscussion, RecordingSession, Attachment } from '../types';
import { GeminiLiveService } from '../services/geminiLive';
import { Mic, MicOff, PhoneOff, Radio, AlertCircle, ScrollText, RefreshCw, Music, Download, Share2, Trash2, Quote, Copy, Check, MessageSquare, BookPlus, Loader2, Globe, FilePlus, Play, Save, CloudUpload, Link, X, Video, Monitor } from 'lucide-react';
import { auth } from '../services/firebaseConfig';
import { getDriveToken } from '../services/authService';
import { ensureCodeStudioFolder, uploadToDrive } from '../services/googleDriveService';
import { saveUserChannel, cacheLectureScript, getCachedLectureScript, saveLocalRecording } from '../utils/db';
// Fix: remove updateDiscussion from imports as it is not exported from firestoreService and is unused here
import { publishChannelToFirestore, saveDiscussion, saveRecordingReference, updateBookingRecording, addChannelAttachment } from '../services/firestoreService';
import { summarizeDiscussionAsSection } from '../services/lectureGenerator';
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
    tapToStart: "Tap to Start Session",
    tapDesc: "Click to enable audio and microphone access.",
    recording: "REC",
    uploading: "Uploading to Drive...",
    uploadComplete: "Saved to Drive",
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
    tapToStart: "点击开始会话",
    tapDesc: "点击以启用音频和麦克风权限。",
    recording: "录音中",
    uploading: "正在上传到 Drive...",
    uploadComplete: "已保存到 Drive",
    saveAndLink: "保存并链接到段落",
    start: "开始会话",
    saveSession: "保存会话"
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
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mixingAudioContextRef = useRef<AudioContext | null>(null);

  const [transcript, setTranscript] = useState<TranscriptItem[]>(initialTranscript || []);
  const [currentLine, setCurrentLine] = useState<TranscriptItem | null>(null);
  const transcriptRef = useRef<TranscriptItem[]>(initialTranscript || []);
  
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);

  const serviceRef = useRef<GeminiLiveService | null>(null);
  const currentUser = auth?.currentUser;

  const startRecording = useCallback(async () => {
      if (!recordingEnabled || !serviceRef.current || !currentUser) return;
      try {
          const mixCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          mixingAudioContextRef.current = mixCtx;
          const dest = mixCtx.createMediaStreamDestination();
          const aiStream = serviceRef.current.getOutputMediaStream();
          if (aiStream) { const aiSource = mixCtx.createMediaStreamSource(aiStream); aiSource.connect(dest); }
          const userStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const userSource = mixCtx.createMediaStreamSource(userStream); userSource.connect(dest);

          const recorder = new MediaRecorder(dest.stream);
          audioChunksRef.current = [];
          recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
          
          recorder.onstop = async () => {
              const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
              const fullTranscript = currentLine ? [...transcript, currentLine] : transcript;
              const transcriptText = fullTranscript.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n\n');
              const transcriptBlob = new Blob([transcriptText], { type: 'text/plain' });

              setIsUploadingRecording(true);
              try {
                  const token = getDriveToken();
                  if (token) {
                      const folderId = await ensureCodeStudioFolder(token);
                      const recId = `recording-${Date.now()}`;
                      const driveFileId = await uploadToDrive(token, folderId, `${recId}.webm`, blob);
                      const tFileId = await uploadToDrive(token, folderId, `${recId}_transcript.txt`, transcriptBlob);
                      
                      const sessionData: RecordingSession = {
                          id: recId,
                          userId: currentUser.uid,
                          channelId: channel.id,
                          channelTitle: channel.title,
                          channelImage: channel.imageUrl,
                          timestamp: Date.now(),
                          mediaUrl: `drive://${driveFileId}`,
                          mediaType: 'audio/webm',
                          transcriptUrl: `drive://${tFileId}`
                      };
                      await saveRecordingReference(sessionData);
                  }
              } catch(e) { console.error("Drive upload failed", e); }
              finally { setIsUploadingRecording(false); }
              userStream.getTracks().forEach(t => t.stop());
              mixCtx.close();
          };
          mediaRecorderRef.current = recorder;
          recorder.start();
      } catch(e) { console.warn("Recording failed", e); }
  }, [recordingEnabled, channel, currentUser, transcript, currentLine]);

  const connect = useCallback(async () => {
    setError(null);
    setIsConnected(false);
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
          // Fix: err is a string here, so setError(err.message) would fail.
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
                  if (onCustomToolCall) {
                      const result = await onCustomToolCall(fc.name, fc.args);
                      serviceRef.current?.sendToolResponse({ functionResponses: [{ id: fc.id, name: fc.name, response: { result } }] });
                  }
              }
          }
      });
    } catch (e) { setError("Failed to initialize session"); }
  }, [channel.id, channel.voiceName, channel.systemInstruction, initialContext, initialTranscript, customTools, onCustomToolCall, recordingEnabled, startRecording]);

  const handleDisconnect = async () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
      serviceRef.current?.disconnect();
      const fullTranscript = currentLine ? [...transcript, currentLine] : transcript;
      if (currentUser && fullTranscript.length > 0) {
          const discussion: CommunityDiscussion = { id: '', lectureId: activeSegment?.lectureId || lectureId || channel.id, channelId: channel.id, userId: currentUser.uid, userName: currentUser.displayName || 'Anonymous', transcript: fullTranscript, createdAt: Date.now(), title: `${channel.title}: Live Session` };
          await saveDiscussion(discussion);
      }
      onEndSession(); 
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
         <button onClick={handleDisconnect} className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-colors">End Session</button>
      </div>

      {!hasStarted ? (
         <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
             <div className="w-20 h-20 bg-indigo-600/10 rounded-full flex items-center justify-center animate-pulse"><Mic size={40} className="text-indigo-500" /></div>
             <div><h3 className="text-xl font-bold text-white">Tap to Join the Session</h3><p className="text-slate-400 text-sm mt-2">Requires microphone access for real-time dialogue.</p></div>
             <button onClick={() => { setHasStarted(true); connect(); }} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-full shadow-lg shadow-indigo-500/30 transition-transform hover:scale-105">{t.start}</button>
         </div>
      ) : error ? (
         <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
             <AlertCircle size={40} className="text-red-400" />
             <p className="text-red-300 text-sm">{error}</p>
             <button onClick={() => connect()} className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg"><RefreshCw size={14} /><span>{t.retry}</span></button>
         </div>
      ) : (
         <div className="flex-1 flex flex-col min-h-0 relative">
            {isUploadingRecording && (
               <div className="absolute top-4 right-4 z-50 bg-slate-900 border border-indigo-500/50 p-3 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in">
                  <Loader2 size={16} className="text-indigo-400 animate-spin"/><span className="text-xs font-bold text-white">{t.uploading}</span>
               </div>
            )}
            {!isConnected && <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 z-10 backdrop-blur-sm"><div className="flex flex-col items-center space-y-4"><Loader2 size={32} className="text-indigo-500 animate-spin" /><p className="text-sm font-medium text-indigo-300">{t.connecting}</p></div></div>}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
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
            <div className="p-3 border-t border-slate-800 bg-slate-900 flex items-center justify-between shrink-0"><div className="flex items-center space-x-2 text-slate-500 text-xs"><ScrollText size={14} /><span className="uppercase tracking-wider font-bold">{t.transcript}</span></div></div>
         </div>
      )}
    </div>
  );
};
