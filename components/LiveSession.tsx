
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Channel, TranscriptItem, GeneratedLecture, CommunityDiscussion, RecordingSession, Attachment } from '../types';
import { GeminiLiveService } from '../services/geminiLive';
import { Mic, MicOff, PhoneOff, Radio, AlertCircle, ScrollText, RefreshCw, Music, Download, Share2, Trash2, Quote, Copy, Check, MessageCircle, BookPlus, Loader2, Globe, FilePlus, Play, Save, CloudUpload, Link, X, Video, Monitor } from 'lucide-react';
import { auth } from '../services/firebaseConfig';
import { saveUserChannel, cacheLectureScript, getCachedLectureScript } from '../utils/db';
import { publishChannelToFirestore, saveLectureToFirestore, saveDiscussion, updateDiscussion, uploadFileToStorage, updateBookingRecording, saveRecordingReference, linkDiscussionToLectureSegment, saveDiscussionDesignDoc, addChannelAttachment } from '../services/firestoreService';
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
    tapToStart: "Tap to Start Session",
    tapDesc: "Click to enable audio and microphone access.",
    recording: "REC",
    uploading: "Uploading Session...",
    uploadComplete: "Upload Complete",
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
    uploading: "正在上传会话...",
    uploadComplete: "上传完成",
    saveAndLink: "保存并链接到段落",
    start: "开始会话",
    saveSession: "保存会话"
  }
};

const saveContentTool: FunctionDeclaration = {
  name: "save_content",
  description: "Save a generated code file, document, or text snippet to the project storage. Use this when the user asks to generate a file or save code.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      filename: { type: Type.STRING, description: "Name of the file (e.g., script.py, notes.md)" },
      content: { type: Type.STRING, description: "The text content of the file" },
      mimeType: { type: Type.STRING, description: "MIME type (e.g., text/x-python, text/markdown)" }
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
  <div className="w-full px-4 animate-fade-in-up">
      {showWelcome && welcomeMessage && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 mb-4 text-center shadow-lg">
          <p className="text-slate-300 italic text-sm">"{welcomeMessage}"</p>
        </div>
      )}
      <div className="text-center mb-2">
         <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">{uiText.welcomePrefix}</span>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {suggestions.map((prompt, idx) => (
          <div key={idx} className="px-4 py-2 rounded-full text-xs transition-all flex items-center space-x-2 bg-slate-800/50 border border-slate-700 text-slate-400 cursor-default select-none hover:bg-slate-800">
            <MessageCircle size={12} className="text-slate-600" />
            <span>{prompt}</span>
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
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  
  const [isSavingLesson, setIsSavingLesson] = useState(false);
  const [isAppending, setIsAppending] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isUploadingRecording, setIsUploadingRecording] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [isSavingGeneric, setIsSavingGeneric] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const mixingAudioContextRef = useRef<AudioContext | null>(null);
  const recorderMimeTypeRef = useRef<string>('');
  const videoStreamRef = useRef<MediaStream | null>(null);
  const sourceStreamsRef = useRef<MediaStream[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  const retryCountRef = useRef(0);
  const [transcript, setTranscript] = useState<TranscriptItem[]>(initialTranscript || []);
  const [currentLine, setCurrentLine] = useState<TranscriptItem | null>(null);
  const [activeQuoteIndex, setActiveQuoteIndex] = useState<number | null>(null);
  const transcriptRef = useRef<TranscriptItem[]>(initialTranscript || []);
  
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showCopyFeedback, setShowCopyFeedback] = useState(false);
  const serviceRef = useRef<GeminiLiveService | null>(null);
  const waitingAudioCtxRef = useRef<AudioContext | null>(null);
  const waitingTimerRef = useRef<any>(null);

  const currentUser = auth.currentUser;
  const isOwner = currentUser && (channel.ownerId === currentUser.uid || currentUser.email === 'shengliang.song@gmail.com');

  const getDescriptiveTitle = () => {
    const podcastTitle = channel.title;
    if (activeSegment) {
        const chapter = channel.chapters?.find(c => c.subTopics.some(s => s.id === activeSegment.lectureId));
        const subTopic = chapter?.subTopics.find(s => s.id === activeSegment.lectureId);
        return `${podcastTitle}: ${chapter ? `${chapter.title} > ` : ""}${subTopic?.title || activeSegment.lectureId} (Part ${activeSegment.index + 1})`;
    }
    return `${podcastTitle}: General Discussion`;
  };

  useEffect(() => {
    if (!initialTranscript) {
        const savedHistory = localStorage.getItem(`transcript_${channel.id}`);
        if (savedHistory) {
          try { setTranscript(JSON.parse(savedHistory)); } catch (e) {}
        }
    }
    if (channel.starterPrompts) setSuggestions(channel.starterPrompts.slice(0, 4));
    retryCountRef.current = 0;
  }, [channel.id, channel.starterPrompts, initialTranscript]);

  useEffect(() => {
    if (transcript.length > 0) localStorage.setItem(`transcript_${channel.id}`, JSON.stringify(transcript));
  }, [transcript, channel.id]);

  const stopWaitingMusic = () => {
    if (waitingTimerRef.current) { clearTimeout(waitingTimerRef.current); waitingTimerRef.current = null; }
    if (waitingAudioCtxRef.current) { waitingAudioCtxRef.current.close().catch(() => {}); waitingAudioCtxRef.current = null; }
  };

  const connect = useCallback(async (isRetryAttempt = false) => {
    setError(null);
    setIsConnected(false);
    let service = serviceRef.current || new GeminiLiveService();
    serviceRef.current = service;
    service.initializeAudio();
    
    try {
      let effectiveInstruction = channel.systemInstruction;
      const historyToInject = transcriptRef.current.length > 0 ? transcriptRef.current : (initialTranscript || []);
      if (historyToInject.length > 0) {
          const historyText = historyToInject.map(t => `${t.role === 'user' ? 'User' : 'AI'}: ${t.text}`).join('\n');
          effectiveInstruction += `\n\n[RESUME CONTEXT]:\n${historyText}`;
      }
      if (initialContext) effectiveInstruction += `\n\n[USER CONTEXT]: "${initialContext}"`;
      
      const toolsToUse = [{ functionDeclarations: [saveContentTool, ...(customTools || [])] }];

      await service.connect(channel.voiceName, effectiveInstruction, {
          onOpen: () => { 
              stopWaitingMusic(); setIsRetrying(false); setIsConnected(true); retryCountRef.current = 0;
          },
          onClose: () => { stopWaitingMusic(); setIsConnected(false); setHasStarted(false); },
          onError: (err) => {
              stopWaitingMusic(); setIsRetrying(false); setIsConnected(false); setError(err.message);
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
                      try {
                          const { filename, content, mimeType } = fc.args;
                          const blob = new Blob([content], { type: mimeType || 'text/plain' });
                          const url = await uploadFileToStorage(`appendix/${channel.id}/${Date.now()}_${filename}`, blob, { contentType: mimeType || 'text/plain' });
                          await addChannelAttachment(channel.id, { id: `att-${Date.now()}`, type: 'file', url, name: filename, uploadedAt: Date.now() });
                          serviceRef.current?.sendToolResponse({ functionResponses: [{ id: fc.id, name: fc.name, response: { result: `Saved to Appendix: ${url}` } }] });
                      } catch (err: any) {
                          serviceRef.current?.sendToolResponse({ functionResponses: [{ id: fc.id, name: fc.name, response: { error: err.message } }] });
                      }
                  } else if (onCustomToolCall) {
                      try {
                          const result = await onCustomToolCall(fc.name, fc.args);
                          serviceRef.current?.sendToolResponse({ functionResponses: [{ id: fc.id, name: fc.name, response: { result } }] });
                      } catch(err: any) {
                          serviceRef.current?.sendToolResponse({ functionResponses: [{ id: fc.id, name: fc.name, response: { error: err.message } }] });
                      }
                  }
              }
          }
        },
        toolsToUse
      );
    } catch (e) { setError("Failed to initialize session"); }
  }, [channel.id, channel.voiceName, channel.systemInstruction, initialContext, initialTranscript, customTools, onCustomToolCall]);

  useEffect(() => {
    if (hasStarted && isConnected && initialContext) serviceRef.current?.sendText(`[CONTEXT UPDATE]\n${initialContext}`);
  }, [initialContext, hasStarted, isConnected]);

  const handleDisconnect = async () => {
      stopWaitingMusic(); 
      serviceRef.current?.disconnect();
      const fullTranscript = currentLine ? [...transcript, currentLine] : transcript;
      if (currentUser && fullTranscript.length > 0) {
          try {
             const targetLectureId = activeSegment?.lectureId || lectureId || channel.id;
             const discussion: CommunityDiscussion = { id: '', lectureId: targetLectureId, channelId: channel.id, userId: currentUser.uid, userName: currentUser.displayName || 'Anonymous', transcript: fullTranscript, createdAt: Date.now(), title: getDescriptiveTitle() };
             await saveDiscussion(discussion);
          } catch (e) {}
      }
      onEndSession(); 
  };

  const getRoleName = (role: string) => {
      if (role === 'user') return t.you;
      // Handle ID-based persona mapping for transcript headers
      const r = role || '';
      if (r.includes('0648937375') || r === 'Software Interview Voice') return 'Software Interview Voice';
      if (r.includes('0375218270') || r === 'Linux Kernel Voice') return 'Linux Kernel Voice';
      if (r.toLowerCase().includes('gem') || r === 'Default Gem') return 'Default Gem';
      return channel.voiceName;
  };

  const renderMessageContent = (text: string) => {
    const parts = text.split(/```/);
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return (
          <div key={index} className="my-3 rounded-lg overflow-hidden border border-slate-700 bg-slate-950 shadow-lg">
             <div className="flex items-center justify-between px-4 py-1.5 bg-slate-800/80 border-b border-slate-700">
               <span className="text-xs font-mono text-slate-400 lowercase">Code</span>
               <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(part); }} className="flex items-center space-x-1 text-xs text-slate-500 hover:text-indigo-400">
                 <Copy size={10} /><span>{t.copied}</span>
               </button>
             </div>
             <pre className="p-4 text-sm font-mono text-indigo-200 overflow-x-auto whitespace-pre-wrap">{part}</pre>
          </div>
        );
      } else {
        return part.split(/\n\s*\n/).map((paragraph, pIndex) => paragraph.trim() ? <p key={`${index}-${pIndex}`} className="mb-3 last:mb-0 leading-relaxed">{paragraph}</p> : null);
      }
    });
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-950">
      <div className="p-4 flex items-center justify-between bg-slate-900 border-b border-slate-800 shrink-0">
         <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-800 border border-slate-700">
               <img src={channel.imageUrl} alt={channel.title} className="w-full h-full object-cover" />
            </div>
            <div>
               <h2 className="text-sm font-bold text-white leading-tight">{channel.title}</h2>
               <span className="text-xs text-indigo-400 font-medium">{channel.voiceName}</span>
            </div>
         </div>
         <button onClick={handleDisconnect} className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-colors">End Session</button>
      </div>

      {!hasStarted ? (
         <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6 text-center">
             <div className="w-20 h-20 bg-indigo-600/10 rounded-full flex items-center justify-center animate-pulse"><Mic size={40} className="text-indigo-500" /></div>
             <div>
                <h3 className="text-xl font-bold text-white">{t.tapToStart}</h3>
                <p className="text-slate-400 text-sm mt-2">{t.tapDesc}</p>
             </div>
             <button onClick={() => { setHasStarted(true); connect(); }} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-full shadow-lg shadow-indigo-500/30 transition-transform hover:scale-105">{t.start}</button>
         </div>
      ) : error ? (
         <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
             <AlertCircle size={40} className="text-red-400" />
             <p className="text-red-300 text-sm">{error}</p>
             <button onClick={() => connect()} className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg">
                <RefreshCw size={14} /><span>{t.retry}</span>
             </button>
         </div>
      ) : (
         <div className="flex-1 flex flex-col min-h-0 relative">
            {!isConnected && (
               <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 z-10 backdrop-blur-sm">
                  <div className="flex flex-col items-center space-y-4">
                     <Loader2 size={32} className="text-indigo-500 animate-spin" />
                     <p className="text-sm font-medium text-indigo-300">{t.connecting}</p>
                  </div>
               </div>
            )}
            <div className="shrink-0 py-3 bg-slate-950">
               <SuggestionsBar suggestions={suggestions} welcomeMessage={channel.welcomeMessage} showWelcome={transcript.length === 0 && !currentLine} uiText={t} />
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6">
               {transcript.map((item, index) => (
                   <div key={index} className={`flex flex-col ${item.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in-up`}>
                       <span className={`text-[10px] uppercase font-bold tracking-wider mb-1 ${item.role === 'user' ? 'text-indigo-400' : 'text-emerald-400'}`}>{getRoleName(item.role)}</span>
                       <div className={`max-w-[90%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${item.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700'}`}>{renderMessageContent(item.text)}</div>
                   </div>
               ))}
               {currentLine && (
                   <div className={`flex flex-col ${currentLine.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in`}>
                       <span className={`text-[10px] uppercase font-bold tracking-wider mb-1 ${currentLine.role === 'user' ? 'text-indigo-400' : 'text-emerald-400'}`}>{getRoleName(currentLine.role)}</span>
                       <div className={`max-w-[90%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${currentLine.role === 'user' ? 'bg-indigo-600/80 text-white rounded-tr-sm' : 'bg-slate-800/80 text-slate-200 rounded-tl-sm border border-slate-700'}`}>{renderMessageContent(currentLine.text)}<span className="inline-block w-1.5 h-4 ml-1 align-middle bg-current opacity-50 animate-blink"></span></div>
                   </div>
               )}
            </div>
            <div className="p-3 border-t border-slate-800 bg-slate-900 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-2 text-slate-500 text-xs"><ScrollText size={14} /><span className="uppercase tracking-wider font-bold">{t.transcript}</span></div>
            </div>
         </div>
      )}
    </div>
  );
};
