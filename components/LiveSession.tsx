
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
  lectureId?: string; // ID of the lecture being discussed (or Booking ID)
  onEndSession: () => void;
  language: 'en' | 'zh';
  recordingEnabled?: boolean;
  videoEnabled?: boolean; // Screen Share
  cameraEnabled?: boolean; // Camera Video
  activeSegment?: { index: number, lectureId: string }; // New prop for segment linking
  initialTranscript?: TranscriptItem[]; // Pre-load history for continuing
  existingDiscussionId?: string; // ID to update if continuing
  // New props for custom tools (e.g. Code Editing)
  customTools?: FunctionDeclaration[];
  onCustomToolCall?: (name: string, args: any) => Promise<any>;
}

const GENERIC_FOLLOW_UPS_EN = [
  "Can you explain that simply?",
  "Give me a real-world example",
  "Why is this important?",
  "What are the pros and cons?",
  "Tell me more about the history",
  "How does this apply to me?"
];

const GENERIC_FOLLOW_UPS_ZH = [
  "能简单解释一下吗？",
  "举个现实生活中的例子",
  "为什么这很重要？",
  "优缺点是什么？",
  "再讲讲历史背景",
  "这对我有什么影响？"
];

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

// Define Tool for Saving Content
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

// Memoized suggestion bar (ReadOnly)
const SuggestionsBar = React.memo(({ suggestions, welcomeMessage, showWelcome, uiText }: { 
  suggestions: string[], 
  welcomeMessage?: string,
  showWelcome: boolean,
  uiText: any
}) => (
  <div className="w-full px-4 animate-fade-in-up">
      {/* Show welcome message text context */}
      {showWelcome && welcomeMessage && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 mb-4 text-center shadow-lg">
          <p className="text-slate-300 italic text-sm">"{welcomeMessage}"</p>
        </div>
      )}
      
      {/* Instructions */}
      <div className="text-center mb-2">
         <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">{uiText.welcomePrefix}</span>
      </div>

      {/* Non-clickable Chips */}
      <div className="flex flex-wrap justify-center gap-2">
        {suggestions.map((prompt, idx) => (
          <div 
            key={idx}
            className="px-4 py-2 rounded-full text-xs transition-all flex items-center space-x-2 bg-slate-800/50 border border-slate-700 text-slate-400 cursor-default select-none hover:bg-slate-800"
          >
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
  
  // Action States
  const [isSavingLesson, setIsSavingLesson] = useState(false);
  const [isAppending, setIsAppending] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isUploadingRecording, setIsUploadingRecording] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [isSavingGeneric, setIsSavingGeneric] = useState(false);
  
  // Recording State
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const mixingAudioContextRef = useRef<AudioContext | null>(null);
  const recorderMimeTypeRef = useRef<string>(''); // Capture browser specific format
  const videoStreamRef = useRef<MediaStream | null>(null);
  const sourceStreamsRef = useRef<MediaStream[]>([]); // To clean up source streams (camera/screen)
  const animationFrameRef = useRef<number | null>(null);

  // Use Ref for retry count to prevent dependency loops in useCallback
  const retryCountRef = useRef(0);
  
  // Transcription State
  const [transcript, setTranscript] = useState<TranscriptItem[]>(initialTranscript || []);
  const [currentLine, setCurrentLine] = useState<TranscriptItem | null>(null);
  const [activeQuoteIndex, setActiveQuoteIndex] = useState<number | null>(null);
  
  // Refs for stable access in callbacks
  const transcriptRef = useRef<TranscriptItem[]>(initialTranscript || []);
  
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const [suggestions, setSuggestions] = useState<string[]>([]);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showCopyFeedback, setShowCopyFeedback] = useState(false);

  const serviceRef = useRef<GeminiLiveService | null>(null);
  const waitingAudioCtxRef = useRef<AudioContext | null>(null);
  const waitingTimerRef = useRef<any>(null);

  const currentUser = auth.currentUser;
  const isOwner = currentUser && (channel.ownerId === currentUser.uid || currentUser.email === 'shengliang.song@gmail.com');

  // Helper to generate a descriptive title based on metadata
  const getDescriptiveTitle = () => {
    const podcastTitle = channel.title;
    
    if (activeSegment) {
        const chapter = channel.chapters?.find(c => c.subTopics.some(s => s.id === activeSegment.lectureId));
        const subTopic = chapter?.subTopics.find(s => s.id === activeSegment.lectureId);
        
        const chPrefix = chapter ? `${chapter.title} > ` : "";
        const lecTitle = subTopic?.title || activeSegment.lectureId;
        return `${podcastTitle}: ${chPrefix}${lecTitle} (Part ${activeSegment.index + 1})`;
    }
    
    if (lectureId) {
        const subTopic = channel.chapters?.flatMap(c => c.subTopics).find(s => s.id === lectureId);
        if (subTopic) {
            const chapter = channel.chapters?.find(c => c.subTopics.some(s => s.id === lectureId));
            const chPrefix = chapter ? `${chapter.title} > ` : "";
            return `${podcastTitle}: ${chPrefix}${subTopic.title}`;
        }
        return `${podcastTitle}: ${lectureId}`;
    }
    
    return `${podcastTitle}: General Discussion`;
  };

  useEffect(() => {
    if (!initialTranscript) {
        const savedHistory = localStorage.getItem(`transcript_${channel.id}`);
        if (savedHistory) {
          try {
            const parsed = JSON.parse(savedHistory);
            setTranscript(parsed);
          } catch (e) {
            console.error("Failed to load history", e);
          }
        }
    }
    
    if (channel.starterPrompts) {
      setSuggestions(channel.starterPrompts.slice(0, 4));
    }
    retryCountRef.current = 0;
  }, [channel.id, channel.starterPrompts, initialTranscript]);

  useEffect(() => {
    if (transcript.length > 0) {
      localStorage.setItem(`transcript_${channel.id}`, JSON.stringify(transcript));
    }
  }, [transcript, channel.id]);

  useEffect(() => {
    if (transcript.length > 0) {
      const lastItem = transcript[transcript.length - 1];
      if (lastItem.role === 'ai') {
        const followUps = language === 'zh' ? GENERIC_FOLLOW_UPS_ZH : GENERIC_FOLLOW_UPS_EN;
        const randomFollowUps = [...followUps].sort(() => 0.5 - Math.random()).slice(0, 2);
        const randomOriginals = channel.starterPrompts 
          ? [...channel.starterPrompts].sort(() => 0.5 - Math.random()).slice(0, 2)
          : [];
        setSuggestions([...randomFollowUps, ...randomOriginals]);
      }
    }
  }, [transcript, channel.starterPrompts, language]);

  const startWaitingMusic = () => {
    if (waitingAudioCtxRef.current) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      waitingAudioCtxRef.current = ctx;
      const notes = [261.63, 329.63, 392.00, 523.25];
      let nextNoteTime = ctx.currentTime;
      const scheduler = () => {
        if (!waitingAudioCtxRef.current) return;
        while (nextNoteTime < ctx.currentTime + 1.0) {
           const osc = ctx.createOscillator();
           const gain = ctx.createGain();
           const freq = notes[Math.floor(Math.random() * notes.length)];
           osc.frequency.value = freq;
           osc.type = 'sine';
           osc.connect(gain);
           gain.connect(ctx.destination);
           const now = nextNoteTime;
           osc.start(now);
           gain.gain.setValueAtTime(0, now);
           gain.gain.linearRampToValueAtTime(0.05, now + 0.05);
           gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05 + 0.8);
           osc.stop(now + 0.05 + 0.8);
           nextNoteTime += Math.random() > 0.5 ? 0.25 : 0.5;
        }
        waitingTimerRef.current = setTimeout(scheduler, 250);
      };
      scheduler();
    } catch (e) {}
  };

  const stopWaitingMusic = () => {
    if (waitingTimerRef.current) { clearTimeout(waitingTimerRef.current); waitingTimerRef.current = null; }
    if (waitingAudioCtxRef.current) { waitingAudioCtxRef.current.close().catch(() => {}); waitingAudioCtxRef.current = null; }
  };

  const setupRecording = async () => {
      if (!recordingEnabled || !serviceRef.current) return;
      
      try {
          const userAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          
          let visualStream: MediaStream | null = null;
          sourceStreamsRef.current = [];

          // Handle Video Streams (Screen / Camera / Both)
          if (videoEnabled && cameraEnabled) {
              // COMPOSITING MODE: Draw both streams to a canvas
              try {
                  const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
                  const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                  
                  sourceStreamsRef.current.push(screenStream, cameraStream);

                  const canvas = document.createElement('canvas');
                  canvas.width = 1920;
                  canvas.height = 1080;
                  const ctx = canvas.getContext('2d');

                  const vScreen = document.createElement('video');
                  vScreen.muted = true;
                  vScreen.srcObject = screenStream;
                  await vScreen.play();

                  const vCam = document.createElement('video');
                  vCam.muted = true;
                  vCam.srcObject = cameraStream;
                  await vCam.play();

                  const draw = () => {
                      if (!ctx) return;
                      // Draw Screen (Full)
                      ctx.drawImage(vScreen, 0, 0, canvas.width, canvas.height);
                      
                      // Draw Camera (PiP Bottom Right)
                      const pipWidth = 480;
                      const pipHeight = (vCam.videoHeight / vCam.videoWidth) * pipWidth || 360;
                      const margin = 40;
                      
                      // Draw border/shadow for pip
                      ctx.fillStyle = 'rgba(0,0,0,0.5)';
                      ctx.fillRect(canvas.width - pipWidth - margin - 5, canvas.height - pipHeight - margin - 5, pipWidth + 10, pipHeight + 10);
                      
                      ctx.drawImage(vCam, canvas.width - pipWidth - margin, canvas.height - pipHeight - margin, pipWidth, pipHeight);
                      
                      animationFrameRef.current = requestAnimationFrame(draw);
                  };
                  draw();

                  visualStream = canvas.captureStream(30); // 30 FPS
                  videoStreamRef.current = visualStream;
              } catch(e) {
                  console.warn("Failed to setup composite video", e);
              }
          } else if (videoEnabled) {
              try {
                  visualStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
                  videoStreamRef.current = visualStream;
                  sourceStreamsRef.current.push(visualStream);
              } catch(e) {
                  console.warn("Screen share cancelled or failed", e);
              }
          } else if (cameraEnabled) {
              try {
                  visualStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                  videoStreamRef.current = visualStream;
                  sourceStreamsRef.current.push(visualStream);
              } catch(e) {
                  console.warn("Camera access failed", e);
              }
          }

          const aiStream = serviceRef.current.getOutputMediaStream();
          const ctx = new AudioContext();
          mixingAudioContextRef.current = ctx;
          
          if (ctx.state === 'suspended') {
              await ctx.resume().catch(e => console.warn("Auto-resume mixing ctx failed", e));
          }

          const dest = ctx.createMediaStreamDestination();
          const userSource = ctx.createMediaStreamSource(userAudioStream);
          userSource.connect(dest);

          if (aiStream) {
              const aiSource = ctx.createMediaStreamSource(aiStream);
              aiSource.connect(dest);
          }
          
          const finalStream = new MediaStream();
          dest.stream.getAudioTracks().forEach(t => finalStream.addTrack(t));
          if (visualStream) {
              visualStream.getVideoTracks().forEach(t => finalStream.addTrack(t));
          }
          
          recordingStreamRef.current = finalStream;

          if (recordingStreamRef.current.getTracks().length > 0) {
              let mimeType = 'audio/webm';
              if (visualStream) {
                  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) mimeType = 'video/webm;codecs=vp9';
                  else if (MediaRecorder.isTypeSupported('video/webm')) mimeType = 'video/webm';
                  else if (MediaRecorder.isTypeSupported('video/mp4')) mimeType = 'video/mp4';
              } else {
                  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mimeType = 'audio/webm;codecs=opus';
              }

              const recorder = new MediaRecorder(recordingStreamRef.current, { mimeType });
              audioChunksRef.current = [];
              
              recorder.ondataavailable = (e) => {
                  if (e.data.size > 0) audioChunksRef.current.push(e.data);
              };
              
              recorder.start(1000); 
              mediaRecorderRef.current = recorder;
              recorderMimeTypeRef.current = recorder.mimeType;
              console.log("Recording started with mimeType:", recorder.mimeType);
          }
      } catch(e) {
          console.error("Failed to setup recording", e);
      }
  };

  const connect = useCallback(async (isRetryAttempt = false) => {
    setError(null);
    setIsConnected(false);
    
    let service = serviceRef.current;
    if (!service) {
         service = new GeminiLiveService();
         serviceRef.current = service;
         service.initializeAudio();
    }
    
    try {
      let effectiveInstruction = channel.systemInstruction;
      
      // Inject transcript context (either from initial prop or current session history if reconnecting)
      const historyToInject = transcriptRef.current.length > 0 ? transcriptRef.current : (initialTranscript || []);
      
      if (historyToInject.length > 0) {
          const historyText = historyToInject.map(t => `${t.role === 'user' ? 'User' : 'AI'}: ${t.text}`).join('\n');
          effectiveInstruction += `\n\n[PREVIOUS CONVERSATION HISTORY - RESUME CONTEXT]:\n${historyText}\n\n[INSTRUCTION]: The connection was interrupted. Please continue the conversation naturally from the last point above.`;
      }

      if (initialContext) {
        effectiveInstruction += `\n\n[USER CONTEXT]: The user is starting this session with the following specific context or question: "${initialContext}"`;
      }
      
      // Setup Tools: Merge built-in tools with custom tools
      const toolsToUse = [{
          functionDeclarations: [
              saveContentTool, 
              ...(customTools || [])
          ]
      }];

      await service.connect(channel.voiceName, effectiveInstruction, {
          onOpen: () => { 
              stopWaitingMusic(); 
              setIsRetrying(false); 
              setIsConnected(true); 
              retryCountRef.current = 0;
              if (recordingEnabled) {
                  setupRecording();
              }
          },
          onClose: () => { 
              stopWaitingMusic(); 
              setIsConnected(false);
              // If we are closed cleanly or by network drop, ensure we don't stay in "Connecting..." limbo
              setHasStarted(false); 
          },
          onError: (err) => {
              stopWaitingMusic(); setIsRetrying(false); setIsConnected(false); setError(err.message);
              const currentRetry = retryCountRef.current;
              if (!isRetryAttempt && currentRetry < 3) {
                 const shouldRetry = err.message.includes("unavailable") || err.message.includes("Internal error") || err.message.includes("Network");
                 if (shouldRetry) {
                   retryCountRef.current += 1;
                   setTimeout(() => { setIsRetrying(true); startWaitingMusic(); connect(true); }, 2000);
                 }
              }
          },
          onVolumeUpdate: (vol) => {}, // Visualizer removed, simplified callback
          onTranscript: (text, isUser) => {
              const role = isUser ? 'user' : 'ai';
              const timestamp = Date.now();
              setCurrentLine(prev => {
                  if (prev && prev.role !== role) {
                      setTranscript(history => [...history, prev]);
                      return { role, text, timestamp };
                  }
                  return { role, text: (prev ? prev.text : '') + text, timestamp: prev ? prev.timestamp : timestamp };
              });
          },
          onToolCall: async (toolCall: any) => {
              console.log("Tool Call Received:", toolCall);
              for (const fc of toolCall.functionCalls) {
                  if (fc.name === 'save_content') {
                      try {
                          const { filename, content, mimeType } = fc.args;
                          const blob = new Blob([content], { type: mimeType || 'text/plain' });
                          const timestamp = Date.now();
                          const path = `appendix/${channel.id}/${timestamp}_${filename}`;
                          
                          // 1. Upload to Firebase
                          const url = await uploadFileToStorage(path, blob, { contentType: mimeType || 'text/plain' });
                          
                          // 2. Add to Channel Appendix
                          const attachment: Attachment = {
                              id: `att-${timestamp}`,
                              type: 'file',
                              url: url,
                              name: filename,
                              uploadedAt: timestamp
                          };
                          await addChannelAttachment(channel.id, attachment);
                          
                          // 3. Send Response back to AI
                          serviceRef.current?.sendToolResponse({
                              functionResponses: [{
                                  id: fc.id,
                                  name: fc.name,
                                  response: { result: `File saved successfully at ${url}. It is now available in the Appendix section.` }
                              }]
                          });
                          
                          // 4. Update Transcript to show activity
                          setTranscript(history => [...history, {
                              role: 'ai',
                              text: `*[System]: File '${filename}' saved to Appendix.*`,
                              timestamp: Date.now()
                          }]);

                      } catch (err: any) {
                          console.error("Tool execution failed", err);
                          serviceRef.current?.sendToolResponse({
                              functionResponses: [{
                                  id: fc.id,
                                  name: fc.name,
                                  response: { error: `Failed to save file: ${err.message}` }
                              }]
                          });
                      }
                  } else if (onCustomToolCall) {
                      // Handle Custom Tool Calls (delegated to parent)
                      try {
                          const result = await onCustomToolCall(fc.name, fc.args);
                          serviceRef.current?.sendToolResponse({
                              functionResponses: [{
                                  id: fc.id,
                                  name: fc.name,
                                  response: { result: result || "Success" }
                              }]
                          });
                          
                          // Show action in transcript
                          setTranscript(history => [...history, {
                              role: 'ai',
                              text: `*[System]: Executed tool '${fc.name}'.*`,
                              timestamp: Date.now()
                          }]);
                          
                      } catch(err: any) {
                          serviceRef.current?.sendToolResponse({
                              functionResponses: [{
                                  id: fc.id,
                                  name: fc.name,
                                  response: { error: `Tool execution failed: ${err.message}` }
                              }]
                          });
                      }
                  }
              }
          }
        },
        toolsToUse // Pass tools config
      );
    } catch (e) { stopWaitingMusic(); setIsRetrying(false); setError("Failed to initialize audio session"); }
  }, [channel.id, channel.voiceName, channel.systemInstruction, initialContext, recordingEnabled, videoEnabled, cameraEnabled, initialTranscript, customTools, onCustomToolCall]);

  // Context Update Handling (Seamless)
  // Instead of reconnecting, we send a text message to the AI
  useEffect(() => {
    if (hasStarted && isConnected && initialContext) {
        if (serviceRef.current) {
            console.log("LiveSession: Context updated. Sending update to AI...");
            // Extract the user visible part or just send the whole thing as a system note
            // We use the new sendText method on the service
            serviceRef.current.sendText(`[SYSTEM UPDATE: User context changed]\n${initialContext}`);
        }
    }
  }, [initialContext, hasStarted, isConnected]);

  useEffect(() => {
     return () => {
        stopWaitingMusic();
        serviceRef.current?.disconnect();
        
        // Stop canvas animation
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }

        // Clean up source streams
        sourceStreamsRef.current.forEach(stream => {
            stream.getTracks().forEach(t => t.stop());
        });
        
        if (videoStreamRef.current) {
            videoStreamRef.current.getTracks().forEach(t => t.stop());
        }
        
        if (mixingAudioContextRef.current) {
            mixingAudioContextRef.current.close().catch(() => {});
        }
     };
  }, []);

  const handleStartSession = () => {
     setHasStarted(true);
     if (!serviceRef.current) {
        serviceRef.current = new GeminiLiveService();
     }
     serviceRef.current.initializeAudio();
     connect();
  };

  useEffect(() => {
    if (scrollRef.current) {
        const isNearBottom = scrollRef.current.scrollHeight - scrollRef.current.scrollTop - scrollRef.current.clientHeight < 300;
        if (isNearBottom) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript, currentLine]);

  // Cancel only the connection attempt, return to "Start" screen
  const handleCancelConnection = async () => {
      // Stop any pending connection attempts/media
      if (serviceRef.current) {
          try { await serviceRef.current.disconnect(); } catch(e) {}
      }
      stopWaitingMusic();
      setIsRetrying(false);
      setIsConnected(false);
      setError(null);
      
      // Cleanup any recorder streams that might have started eagerly
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
      }
      audioChunksRef.current = [];
      
      // Return to start screen
      setHasStarted(false);
  };

  const handleDisconnect = async () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          const stopPromise = new Promise<void>(resolve => {
              if (mediaRecorderRef.current) {
                  mediaRecorderRef.current.onstop = () => resolve();
              } else {
                  resolve();
              }
          });
          mediaRecorderRef.current.stop();
          await stopPromise;
      }
      
      if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
      }

      if (videoStreamRef.current) {
          videoStreamRef.current.getTracks().forEach(t => t.stop());
          videoStreamRef.current = null;
      }

      sourceStreamsRef.current.forEach(stream => {
          stream.getTracks().forEach(t => t.stop());
      });
      sourceStreamsRef.current = [];
      
      if (mixingAudioContextRef.current) {
          try { mixingAudioContextRef.current.close(); } catch(e) {}
          mixingAudioContextRef.current = null;
      }

      stopWaitingMusic(); 
      serviceRef.current?.disconnect();

      // --- AUTO-SAVE LOGIC ---
      const fullTranscript = currentLine ? [...transcript, currentLine] : transcript;
      if (currentUser && fullTranscript.length > 0) {
          try {
             if (existingDiscussionId) {
                 // UPDATE EXISTING DISCUSSION
                 await updateDiscussion(existingDiscussionId, fullTranscript);
                 console.log("Updated discussion:", existingDiscussionId);
             } else {
                 // CREATE NEW DISCUSSION
                 // Use activeSegment.lectureId if available, else lectureId passed in prop, else channel.id
                 const targetLectureId = activeSegment?.lectureId || lectureId || channel.id;
                 const descriptiveTitle = getDescriptiveTitle();
                 
                 const discussion: CommunityDiscussion = {
                    id: '', 
                    lectureId: targetLectureId,
                    channelId: channel.id,
                    userId: currentUser.uid,
                    userName: currentUser.displayName || 'Anonymous',
                    transcript: fullTranscript,
                    createdAt: Date.now(),
                    segmentIndex: activeSegment?.index,
                    summary: "Auto-saved session",
                    title: descriptiveTitle
                 };
                 
                 const discussionId = await saveDiscussion(discussion);
                 console.log("Auto-saved discussion:", discussionId);

                 // Link to Lecture Segment if applicable
                 if (activeSegment) {
                     await linkDiscussionToLectureSegment(channel.id, activeSegment.lectureId, activeSegment.index, discussionId);
                     
                     // Update Local Cache so UI reflects change immediately
                     const cacheKey = `lecture_${channel.id}_${activeSegment.lectureId}_${language}`;
                     const cachedLecture = await getCachedLectureScript(cacheKey);
                     if (cachedLecture && cachedLecture.sections[activeSegment.index]) {
                          cachedLecture.sections[activeSegment.index].discussionId = discussionId;
                          await cacheLectureScript(cacheKey, cachedLecture);
                     }
                 }
             }
          } catch (e) {
             console.error("Auto-save discussion failed", e);
          }
      }
      // -----------------------

      if (recordingEnabled && currentUser && audioChunksRef.current.length > 0) {
          setIsUploadingRecording(true);
          try {
              const timestamp = Date.now();
              const bookingPath = lectureId ? `recordings/${lectureId}` : `recordings/${channel.id}_${timestamp}`;
              
              const mimeType = recorderMimeTypeRef.current || 'audio/webm';
              const isVideo = mimeType.toLowerCase().includes('video');
              const ext = isVideo ? (mimeType.includes('mp4') ? 'mp4' : 'webm') : 'webm';
              
              const mediaBlob = new Blob(audioChunksRef.current, { type: mimeType });
              const mediaUrl = await uploadFileToStorage(`${bookingPath}/${isVideo ? 'video' : 'audio'}.${ext}`, mediaBlob, { contentType: mimeType });
              
              const mdText = `# ${channel.title} - Session\nDate: ${new Date().toLocaleString()}\n\n` + 
                             fullTranscript.map(t => `**${t.role.toUpperCase()}:** ${t.text}`).join('\n\n');
              const transcriptBlob = new Blob([mdText], { type: 'text/markdown' });
              const transcriptUrl = await uploadFileToStorage(`${bookingPath}/transcript.md`, transcriptBlob, { contentType: 'text/markdown' });
              
              if (lectureId && !lectureId.startsWith('sub-') && !lectureId.startsWith('ch-') && !lectureId.startsWith('tutor-')) {
                  await updateBookingRecording(lectureId, mediaUrl, transcriptUrl);
              } else {
                  const recordingSession: RecordingSession = {
                      id: '',
                      userId: currentUser.uid,
                      channelId: channel.id,
                      channelTitle: channel.title,
                      channelImage: channel.imageUrl,
                      timestamp: timestamp,
                      mediaUrl: mediaUrl,
                      mediaType: mimeType,
                      transcriptUrl: transcriptUrl
                  };
                  await saveRecordingReference(recordingSession);
              }
              
              console.log("Recording Uploaded and Linked");
          } catch(e) {
              console.error("Failed to upload recording", e);
          } finally {
              setIsUploadingRecording(false);
          }
      }

      onEndSession(); 
  };

  const handleRetry = () => { setIsRetrying(true); retryCountRef.current = 0; setError(null); startWaitingMusic(); connect(); };
  
  const handleDownload = () => {
    const fullTranscript = currentLine ? [...transcript, currentLine] : transcript;
    if (fullTranscript.length === 0) return;
    const header = `# ${channel.title}\n**Host:** ${channel.voiceName}\n**Date:** ${new Date().toLocaleDateString()}\n\n----- \n\n`;
    const content = fullTranscript.map(t => `### ${t.role === 'user' ? 'User' : channel.voiceName}\n${t.text}\n`).join('\n');
    const blob = new Blob([header + content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${channel.title.replace(/[^a-z0-9]/gi, '_')}_transcript.md`; a.click(); URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    const fullTranscript = currentLine ? [...transcript, currentLine] : transcript;
    if (fullTranscript.length === 0) return;
    const header = `🎙️ ${channel.title.toUpperCase()} - Live Session\nDate: ${new Date().toLocaleDateString()}\n`;
    const body = fullTranscript.map(t => `[${new Date(t.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}] ${t.role === 'user' ? 'ME' : channel.voiceName.toUpperCase()}:\n${t.text}`).join('\n\n----- \n\n');
    const text = `${header}\n\n${body}`;
    if (navigator.share) {
      try { await navigator.share({ title: `Podcast Session: ${channel.title}`, text: text.substring(0, 10000) }); } catch (err) {}
    } else {
      try { await navigator.clipboard.writeText(text); setShowCopyFeedback(true); setTimeout(() => setShowCopyFeedback(false), 2000); } catch (err) {}
    }
  };

  const handleShareToCommunity = async () => {
    if (!currentUser || !lectureId) return;
    const fullTranscript = currentLine ? [...transcript, currentLine] : transcript;
    if (fullTranscript.length === 0) return;

    setIsSharing(true);
    try {
        const descriptiveTitle = getDescriptiveTitle();
        const discussion: CommunityDiscussion = {
            id: '', 
            lectureId,
            channelId: channel.id,
            userId: currentUser.uid,
            userName: currentUser.displayName || 'Anonymous',
            transcript: fullTranscript,
            createdAt: Date.now(),
            title: descriptiveTitle
        };
        await saveDiscussion(discussion);
        alert(t.sharedSuccess);
    } catch(e) {
        alert("Share failed.");
    } finally {
        setIsSharing(false);
    }
  };

  const handleSaveGeneric = async () => {
      if (!currentUser || !lectureId) return;
      const fullTranscript = currentLine ? [...transcript, currentLine] : transcript;
      if (fullTranscript.length === 0) return;

      setIsSavingGeneric(true);
      try {
          const descriptiveTitle = getDescriptiveTitle();
          const discussion: CommunityDiscussion = {
              id: '', 
              lectureId,
              channelId: channel.id,
              userId: currentUser.uid,
              userName: currentUser.displayName || 'Anonymous',
              transcript: fullTranscript,
              createdAt: Date.now(),
              title: descriptiveTitle
          };
          await saveDiscussion(discussion);
          alert("Session saved to your history.");
      } catch(e) {
          console.error(e);
          alert("Failed to save session.");
      } finally {
          setIsSavingGeneric(false);
      }
  };

  const handleAppendToLecture = async () => {
    // Permission check: Owner or Lecture ID present?
    // User request implies this button is for appending to lecture.
    if (!currentUser) return; 
    
    const fullTranscript = currentLine ? [...transcript, currentLine] : transcript;
    if (fullTranscript.length === 0) {
        alert("No transcript to process.");
        return;
    }

    setIsAppending(true);
    try {
        let appended = false;
        
        // 1. Try to append to existing cached lecture
        if (lectureId) {
            const cacheKey = `lecture_${channel.id}_${lectureId}_${language}`;
            const currentLecture = await getCachedLectureScript(cacheKey);
            
            if (currentLecture) {
                const newSections = await summarizeDiscussionAsSection(fullTranscript, currentLecture, language);
                if (newSections) {
                    currentLecture.sections.push(...newSections);
                    await cacheLectureScript(cacheKey, currentLecture);
                    if (isOwner) {
                       await saveLectureToFirestore(channel.id, lectureId, currentLecture);
                    }
                    alert("Success! The summary has been added to the END of the current lecture script. Please scroll down in the Lecture view to see it.");
                    appended = true;
                }
            }
        }

        // 2. Fallback: Generate Design Doc
        if (!appended) {
            if (confirm("Original lecture not found in cache. Would you like to generate a standalone Design Document instead?")) {
                 const descriptiveTitle = getDescriptiveTitle();
                 const meta = {
                    date: new Date().toLocaleDateString(),
                    topic: descriptiveTitle,
                    segmentIndex: activeSegment?.index
                 };
                 const doc = await generateDesignDocFromTranscript(fullTranscript, meta, language);
                 
                 if (doc) {
                     // We need a discussion ID to save the doc against
                     let targetDiscussionId = existingDiscussionId;
                     if (!targetDiscussionId) {
                         const discussion: CommunityDiscussion = {
                            id: '',
                            lectureId: lectureId || channel.id,
                            channelId: channel.id,
                            userId: currentUser.uid,
                            userName: currentUser.displayName || 'Anonymous',
                            transcript: fullTranscript,
                            createdAt: Date.now(),
                            segmentIndex: activeSegment?.index,
                            summary: "Auto-saved for Design Doc",
                            title: descriptiveTitle
                         };
                         targetDiscussionId = await saveDiscussion(discussion);
                     }
                     
                     await saveDiscussionDesignDoc(targetDiscussionId, doc);
                     alert("Success! A new Design Document has been created. You can find it in the 'Documents' tab on the main dashboard.");
                 }
            }
        }
    } catch(e) {
        console.error(e);
        alert("Failed to process request.");
    } finally {
        setIsAppending(false);
    }
  };

  const handleAddToCurriculum = async () => {
    if (!isOwner) return;
    const fullTranscript = currentLine ? [...transcript, currentLine] : transcript;
    if (fullTranscript.length === 0) return;
    setIsSavingLesson(true);
    try {
        const topicTitle = `Live Session - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        const newId = `live-${Date.now()}`;
        const newLecture: GeneratedLecture = {
            topic: topicTitle,
            professorName: channel.voiceName,
            studentName: "User",
            sections: fullTranscript.map(t => ({ speaker: t.role === 'user' ? 'Student' : 'Teacher', text: t.text }))
        };
        await cacheLectureScript(`lecture_${channel.id}_${newId}_${language}`, newLecture);
        await saveLectureToFirestore(channel.id, newId, newLecture);
        const updatedChapters = [...(channel.chapters || [])];
        let liveChapter = updatedChapters.find(ch => ch.title.includes("Live Discussions"));
        if (!liveChapter) {
            liveChapter = { id: `ch-live-${Date.now()}`, title: "Live Discussions", subTopics: [] };
            updatedChapters.push(liveChapter);
        }
        liveChapter.subTopics.push({ id: newId, title: topicTitle });
        const updatedChannel = { ...channel, chapters: updatedChapters };
        await saveUserChannel(updatedChannel);
        if (updatedChannel.visibility !== 'private') await publishChannelToFirestore(updatedChannel);
        alert(t.saveSuccess);
    } catch (e) { alert("Failed to save lesson."); } finally { setIsSavingLesson(false); }
  };

  const handleSaveAndLink = async () => {
      if (!activeSegment || !currentUser) return;
      const fullTranscript = currentLine ? [...transcript, currentLine] : transcript;
      if (fullTranscript.length === 0) return;

      setIsLinking(true);
      try {
          // If we already have a discussion ID, update it
          if (existingDiscussionId) {
              await updateDiscussion(existingDiscussionId, fullTranscript);
              alert("Discussion updated!");
          } else {
              // Create new and link
              const descriptiveTitle = getDescriptiveTitle();
              const discussion: CommunityDiscussion = {
                  id: '', 
                  lectureId: activeSegment.lectureId,
                  channelId: channel.id,
                  userId: currentUser.uid,
                  userName: currentUser.displayName || 'Anonymous',
                  transcript: fullTranscript,
                  createdAt: Date.now(),
                  segmentIndex: activeSegment.index,
                  title: descriptiveTitle
              };
              
              const discussionId = await saveDiscussion(discussion);
              await linkDiscussionToLectureSegment(channel.id, activeSegment.lectureId, activeSegment.index, discussionId);
              
              // Update local cache
              const cacheKey = `lecture_${channel.id}_${activeSegment.lectureId}_${language}`;
              const cachedLecture = await getCachedLectureScript(cacheKey);
              if (cachedLecture && cachedLecture.sections[activeSegment.index]) {
                  cachedLecture.sections[activeSegment.index].discussionId = discussionId;
                  await cacheLectureScript(cacheKey, cachedLecture);
              }
              alert("Discussion saved and linked!");
          }
      } catch(e) {
          console.error(e);
          alert("Failed to save discussion.");
      } finally {
          setIsLinking(false);
      }
  };

  const renderMessageContent = (text: string) => {
    const parts = text.split(/```/);
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return (
          <div key={index} className="my-3 rounded-lg overflow-hidden border border-slate-700 bg-slate-950 shadow-lg">
             <div className="flex items-center justify-between px-4 py-1.5 bg-slate-800/80 border-b border-slate-700">
               <span className="text-xs font-mono text-slate-400 lowercase">Code</span>
               <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(part); }} className="flex items-center space-x-1 text-xs text-slate-500 hover:text-indigo-400 transition-colors">
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

  if (isUploadingRecording) {
      return (
          <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-4">
              <div className="text-center space-y-4">
                  <CloudUpload size={48} className="text-indigo-400 animate-bounce mx-auto" />
                  <h2 className="text-2xl font-bold text-white">{t.uploading}</h2>
                  <p className="text-slate-400">Saving audio, video, and transcript to your secure cloud storage.</p>
              </div>
          </div>
      );
  }

  return (
    <div className="w-full h-full flex flex-col bg-slate-950">
      
      {/* Session Header / Info */}
      <div className="p-4 flex items-center justify-between bg-slate-900 border-b border-slate-800 shrink-0">
         <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-800 border border-slate-700">
               <img src={channel.imageUrl} alt={channel.title} className="w-full h-full object-cover" />
            </div>
            <div>
               <h2 className="text-sm font-bold text-white leading-tight">{channel.title}</h2>
               <div className="flex items-center gap-2">
                  <span className="text-xs text-indigo-400 font-medium">{channel.voiceName}</span>
                  {recordingEnabled && <span className="flex items-center gap-1 text-[10px] text-red-400 bg-red-900/20 px-1.5 py-0.5 rounded animate-pulse"><span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>REC</span>}
               </div>
            </div>
         </div>
         <button onClick={handleDisconnect} className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-colors">
            End Session
         </button>
      </div>

      {/* Main Status / Prompt Area */}
      {!hasStarted ? (
         <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6 text-center">
             <div className="w-20 h-20 bg-indigo-600/10 rounded-full flex items-center justify-center animate-pulse">
                <Mic size={40} className="text-indigo-500" />
             </div>
             <div>
                <h3 className="text-xl font-bold text-white">{t.tapToStart}</h3>
                <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto">{t.tapDesc}</p>
                {initialTranscript && initialTranscript.length > 0 && (
                    <div className="mt-4 bg-slate-800/50 p-2 rounded text-xs text-indigo-300 border border-indigo-500/30">
                        Continuing from saved discussion ({initialTranscript.length} messages)
                    </div>
                )}
                <div className="flex items-center justify-center gap-4 mt-3 text-xs text-indigo-400">
                    {videoEnabled && <span className="flex items-center gap-1"><Monitor size={12}/> Screen Share</span>}
                    {cameraEnabled && <span className="flex items-center gap-1"><Video size={12}/> Camera</span>}
                </div>
             </div>
             <button 
                 onClick={handleStartSession}
                 className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-full shadow-lg shadow-indigo-500/30 transition-transform hover:scale-105"
             >
                 {t.start}
             </button>
         </div>
      ) : error ? (
         <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
             <AlertCircle size={40} className="text-red-400" />
             <div className="bg-red-900/10 p-4 rounded-xl border border-red-900/30">
                <p className="text-red-300 font-medium text-sm">{error}</p>
             </div>
             <button onClick={handleRetry} className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg">
                <RefreshCw size={14} />
                <span>{t.retry}</span>
             </button>
         </div>
      ) : (
         <div className="flex-1 flex flex-col min-h-0 relative">
            {/* Connecting State */}
            {(!isConnected && !isRetrying) && (
               <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 z-10 backdrop-blur-sm">
                  <div className="flex flex-col items-center space-y-4">
                     <Loader2 size={32} className="text-indigo-500 animate-spin" />
                     <p className="text-sm font-medium text-indigo-300">{t.connecting}</p>
                     <button 
                        onClick={handleCancelConnection}
                        className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-full border border-slate-700 transition-colors shadow-lg"
                     >
                        Cancel
                     </button>
                  </div>
               </div>
            )}

            {/* Suggestions */}
            <div className="shrink-0 py-3 bg-slate-950">
               <SuggestionsBar suggestions={suggestions} welcomeMessage={channel.welcomeMessage} showWelcome={transcript.length === 0 && !currentLine && !initialContext} uiText={t} />
            </div>

            {/* Transcript */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
               {transcript.length === 0 && !currentLine && (
                   <div className="h-full flex items-center justify-center text-slate-700">
                       <p className="text-sm italic">Conversation started...</p>
                   </div>
               )}
               {transcript.map((item, index) => {
                   // Robust mapping for technical gen-lang-client roles and specific IDs
                   const isAIVoice = item.role === 'ai' || 
                                     item.role.includes('gen-lang-client') || 
                                     item.role.toLowerCase().includes('gem') ||
                                     item.role === 'Software Interview Voice' ||
                                     item.role === 'Linux Kernel Voice';
                                     
                   const roleLabel = isAIVoice ? channel.voiceName : t.you;
                   const colorClass = isAIVoice ? 'text-emerald-400' : 'text-indigo-400';

                   return (
                   <div key={index} className={`flex flex-col ${item.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in-up`}>
                       <div className="flex items-center space-x-2 mb-1 px-1">
                           <span className={`text-[10px] uppercase font-bold tracking-wider ${colorClass}`}>
                               {roleLabel}
                           </span>
                       </div>
                       <div className={`max-w-[90%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm relative group ${
                           item.role === 'user' 
                           ? 'bg-indigo-600 text-white rounded-tr-sm' 
                           : 'bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700'
                       }`}>
                           <div className={`absolute ${item.role === 'user' ? '-left-8' : '-right-8'} top-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1`}>
                               <button onClick={() => { navigator.clipboard.writeText(item.text); setActiveQuoteIndex(index); setTimeout(() => setActiveQuoteIndex(null), 1000); }} className="p-1.5 bg-slate-800 text-slate-400 hover:text-white rounded-full border border-slate-700 shadow-lg">
                                   {activeQuoteIndex === index ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                               </button>
                           </div>
                           {renderMessageContent(item.text)}
                       </div>
                   </div>
                   );
               })}
               {currentLine && (
                   <div className={`flex flex-col ${currentLine.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in`}>
                       <div className="flex items-center space-x-2 mb-1 px-1">
                           <span className={`text-[10px] uppercase font-bold tracking-wider ${currentLine.role === 'user' ? 'text-indigo-400' : 'text-emerald-400'}`}>
                               {currentLine.role === 'user' ? t.you : channel.voiceName}
                           </span>
                           <span className="text-[10px] text-slate-500 italic animate-pulse">{t.speaking}</span>
                       </div>
                       <div className={`max-w-[90%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                           currentLine.role === 'user' 
                           ? 'bg-indigo-600/80 text-white rounded-tr-sm backdrop-blur-sm' 
                           : 'bg-slate-800/80 text-slate-200 rounded-tl-sm border border-slate-700 backdrop-blur-sm'
                       }`}>
                           {renderMessageContent(currentLine.text)}
                           <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-current opacity-50 animate-blink"></span>
                       </div>
                   </div>
               )}
            </div>

            {/* Action Bar */}
            <div className="p-3 border-t border-slate-800 bg-slate-900 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-2 text-slate-500 text-xs">
                   <ScrollText size={14} />
                   <span className="uppercase tracking-wider font-bold">{t.transcript}</span>
                </div>
                <div className="flex items-center space-x-2">
                    {/* Toolbar Actions */}
                    {activeSegment ? (
                        <button onClick={handleSaveAndLink} disabled={isLinking} className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors" title={t.saveAndLink}>
                            {isLinking ? <Loader2 size={16} className="animate-spin" /> : <Link size={16} />}
                        </button>
                    ) : (
                        currentUser && lectureId && !lectureId.startsWith('p2p') && (
                            <>
                                <button onClick={handleShareToCommunity} disabled={isSharing} className="p-2 bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-400 border border-emerald-900/50 rounded-lg transition-colors" title={t.sharePublic}>
                                    {isSharing ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
                                </button>
                                {/* Generic Save for non-course sessions (e.g. Code Tutor) */}
                                <button onClick={handleSaveGeneric} disabled={isSavingGeneric} className="p-2 bg-indigo-900/30 hover:bg-indigo-900/50 text-indigo-400 border border-indigo-500/50 rounded-lg transition-colors" title={t.saveSession}>
                                    {isSavingGeneric ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                </button>
                            </>
                        )
                    )}
                    {/* Append Button Logic: Enabled if Owner OR if LectureID is present (Ad-Hoc sessions usually have fake ID) */}
                    {(isOwner || lectureId) && (
                        <button onClick={handleAppendToLecture} disabled={isAppending} className="p-2 bg-indigo-900/30 hover:bg-indigo-900/50 text-indigo-400 border border-indigo-500/50 rounded-lg transition-colors" title={t.appendToLecture}>
                            {isAppending ? <Loader2 size={16} className="animate-spin" /> : <FilePlus size={16} />}
                        </button>
                    )}
                    <button onClick={handleShare} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors" title="Copy Transcript">
                        <Share2 size={16} />
                    </button>
                    <button onClick={handleDownload} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors" title="Download Markdown">
                        <Download size={16} />
                    </button>
                </div>
            </div>
         </div>
      )}
    </div>
  );
};
