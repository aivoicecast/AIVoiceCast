
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ArrowLeft, Mic, Disc, Square, Info, FileText, 
  RefreshCw, Sparkles, Activity, Zap, Cpu, Monitor, Volume2, 
  FileSignature, Wand2, X, Clock, Radio, GraduationCap, ShieldCheck, Loader2,
  Timer, History, CheckCircle2, Binary, ChevronRight, VolumeX, AlertTriangle, 
  Waves, ZapOff
} from 'lucide-react';
import { UserProfile, TranscriptItem } from '../types';
import { Visualizer } from './Visualizer';
import { MarkdownView } from './MarkdownView';
import { saveDiscussion, AI_COSTS, deductCoins } from '../services/firestoreService';
import { GoogleGenAI } from "@google/genai";

interface ScribeStudioProps {
  onBack: () => void;
  currentUser: any;
  userProfile: UserProfile | null;
  onOpenManual?: () => void;
}

export const ScribeStudio: React.FC<ScribeStudioProps> = ({ onBack, currentUser, userProfile, onOpenManual }) => {
  const [isActive, setIsActive] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [stagedDocId, setStagedDocId] = useState<string | null>(null);
  const [volume, setVolume] = useState(0);
  const [sessionTitle, setSessionTitle] = useState('Neural Transcript');
  
  const [history, setHistory] = useState<TranscriptItem[]>([]);
  const [liveText, setLiveText] = useState('');
  const [currentTime, setCurrentTime] = useState('');
  
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // High-Precision Refs for Callbacks
  const isBatchRunningRef = useRef(false);
  const lastResultTimeRef = useRef<number>(Date.now());
  const volumeRef = useRef<number>(0);
  const liveTextRef = useRef<string>('');
  const lastCommittedTextRef = useRef<string>('');

  useEffect(() => {
    const timer = setInterval(() => {
        const now = new Date();
        setCurrentTime(now.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Continuous Ref Update
  useEffect(() => {
    liveTextRef.current = liveText;
  }, [liveText]);

  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, liveText, isActive]);

  const dispatchLog = (msg: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') => {
      window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: `[Scribe] ${msg}`, type } }));
  };

  /**
   * Neural Linguistic Refiner:
   * Collapses multiple spaces and ensures punctuation is properly aligned.
   */
  const refineTranscriptText = (text: string): string => {
      return text
          .replace(/\s+/g, ' ')               // Collapse whitespace
          .replace(/\s+([,.!?;:])/g, '$1')    // Remove spaces before punctuation
          .trim();
  };

  const setupVisualizer = async (stream: MediaStream) => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateVolume = () => {
        if (!isBatchRunningRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for(let i = 0; i < bufferLength; i++) sum += dataArray[i];
        const v = sum / bufferLength / 128;
        setVolume(v);
        volumeRef.current = v;
        requestAnimationFrame(updateVolume);
    };
    updateVolume();
  };

  const commitToHistory = (text: string) => {
    const cleanText = refineTranscriptText(text);
    if (!cleanText) return;

    // DUPLICATE GUARD: Check if this exact text was just added
    if (cleanText === lastCommittedTextRef.current) {
        return;
    }

    setHistory(prev => [...prev, { 
        role: 'user', 
        text: cleanText, 
        timestamp: Date.now() 
    }]);
    lastCommittedTextRef.current = cleanText;
  };

  const handleStart = async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
        dispatchLog("Speech API unavailable.", "error");
        return;
    }

    setHistory([]);
    setLiveText('');
    setSummary(null);
    setStagedDocId(null);
    lastCommittedTextRef.current = '';
    isBatchRunningRef.current = true;
    lastResultTimeRef.current = Date.now();

    dispatchLog(`Initiating Sovereign Scribe...`, "info");
    
    try {
        const captureStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        audioStreamRef.current = captureStream;
        await setupVisualizer(captureStream);

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            setIsActive(true);
            dispatchLog("Neural Link Active.", "success");
        };

        recognition.onresult = (event: any) => {
            let currentInterim = '';
            lastResultTimeRef.current = Date.now();
            
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                const result = event.results[i];
                if (result.isFinal) {
                    const finalFragment = refineTranscriptText(result[0].transcript);
                    if (finalFragment) {
                        commitToHistory(finalFragment);
                        setLiveText(''); 
                    }
                } else {
                    currentInterim += result[0].transcript;
                }
            }
            
            if (currentInterim) {
                const words = currentInterim.trim().split(/\s+/);
                if (words.length > 20) {
                    const toCommit = words.slice(0, 15).join(' ');
                    const remaining = words.slice(15).join(' ');
                    commitToHistory(toCommit);
                    setLiveText(refineTranscriptText(remaining));
                } else {
                    setLiveText(refineTranscriptText(currentInterim));
                }
            }
        };

        recognition.onerror = (event: any) => {
            if (event.error === 'no-speech') return; 
            dispatchLog(`Engine Warning: ${event.error}`, "warn");
        };

        recognition.onend = () => {
            const residual = liveTextRef.current.trim();
            if (residual.length > 0 && isBatchRunningRef.current) {
                commitToHistory(residual);
                setLiveText('');
            }

            if (isBatchRunningRef.current) {
                try { 
                    recognition.start(); 
                } catch (e) {}
            }
        };

        recognitionRef.current = recognition;
        recognition.start();

    } catch (e: any) {
        setIsActive(false);
        dispatchLog(`Link Failed: ${e.message}`, "error");
    }
  };

  const handleStop = async () => {
    isBatchRunningRef.current = false;
    
    if (recognitionRef.current) {
        recognitionRef.current.stop();
    }
    
    setIsActive(false);
    dispatchLog("Session closed. Finalizing artifact...", "info");
    
    if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(t => t.stop());
        audioStreamRef.current = null;
    }
    if (audioContextRef.current) {
        audioContextRef.current.close();
    }

    const currentLive = liveText.trim();
    if (currentLive) {
        commitToHistory(currentLive);
        setLiveText('');
    }

    setTimeout(async () => {
        setHistory(finalHistory => {
            if (finalHistory.length > 0) {
                generateSummary(finalHistory);
            }
            return finalHistory;
        });
    }, 500);
  };

  const generateSummary = async (finalHistory: TranscriptItem[]) => {
    try {
        setIsSynthesizing(true);
        const fullText = finalHistory.map(h => h.text).join('\n');
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const prompt = `You are a Senior Technical Scribe. Title: "${sessionTitle}". Reconstruct the following transcript into a high-fidelity technical specification. Summarize logic, architecture, and decisions.\n\nRAW DATA:\n${fullText}`;

        const res = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { thinkingConfig: { thinkingBudget: 0 } }
        });
        
        if (res.text) {
            setSummary(res.text);
            if (currentUser) {
                const docId = await saveDiscussion({
                    id: 'new',
                    channelId: 'scribe_studio',
                    userId: currentUser.uid,
                    userName: currentUser.displayName || 'Scribe Member',
                    transcript: finalHistory,
                    createdAt: Date.now(),
                    title: sessionTitle || 'Neural Transcript',
                    isManual: true,
                    designDoc: res.text
                });
                setStagedDocId(docId);
                deductCoins(currentUser.uid, AI_COSTS.TEXT_REFRACTION);
            }
            dispatchLog("Refraction secured in vault.", "success");
        }
    } catch (e: any) {
        dispatchLog("Synthesis Error. Registry remains intact.", "error");
    } finally {
        setIsSynthesizing(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans relative">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-20">
          <div className="flex items-center gap-4">
              <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"><ArrowLeft size={20} /></button>
              <div>
                <h1 className="text-lg font-bold text-white flex items-center gap-2 uppercase tracking-tighter italic">
                    <Disc className={`text-red-500 ${isActive ? 'animate-spin' : ''}`} /> Neural Scribe
                </h1>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Sovereign Buffer v12.5.0</p>
              </div>
          </div>
          <div className="flex items-center gap-3">
              {stagedDocId && (
                  <button onClick={() => window.open(`?view=docs&id=${stagedDocId}`, '_blank')} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-black uppercase shadow-lg transition-all animate-fade-in">
                      <FileSignature size={14}/>
                      <span>Open Vault File</span>
                  </button>
              )}
              {onOpenManual && <button onClick={onOpenManual} className="p-2 text-slate-400 hover:text-white" title="Scribe Manual"><Info size={18}/></button>}
          </div>
      </header>

      <div className="flex-1 flex overflow-hidden flex-col lg:flex-row">
          <div className="w-full lg:w-[350px] border-r border-slate-800 bg-slate-900/30 flex flex-col shrink-0 overflow-y-auto p-6 space-y-8 scrollbar-hide">
              <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Session Identity</label>
                  <input type="text" value={sessionTitle} onChange={e => setSessionTitle(e.target.value)} placeholder="Session title..." className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-red-500 outline-none shadow-inner transition-all"/>
              </div>

              <div className="pt-4">
                  {!isActive ? (
                      <button onClick={handleStart} className="w-full py-5 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-2xl shadow-red-900/40 transition-all active:scale-95 flex items-center justify-center gap-3"><Mic size={24}/> Begin Ingest</button>
                  ) : (
                      <button onClick={handleStop} className="w-full py-5 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3"><Square size={24} fill="currentColor"/> Terminate</button>
                  )}
              </div>

              {isActive && (
                  <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-6 flex flex-col items-center gap-4 animate-fade-in">
                      <div className="w-full h-12"><Visualizer volume={volume} isActive={true} color='#6366f1' /></div>
                      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div><span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.3em]">Persistent Link Active</span></div>
                  </div>
              )}
          </div>

          <main className="flex-1 bg-slate-950 flex flex-col p-8 overflow-hidden relative">
              <div className="absolute top-8 right-8 text-slate-800 select-none pointer-events-none"><Activity size={120} strokeWidth={0.5} /></div>

              {isSynthesizing && (
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-40 flex flex-col items-center justify-center gap-6 animate-fade-in">
                      <div className="relative"><div className="w-24 h-24 border-4 border-indigo-500/10 rounded-full"></div><div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div><div className="absolute inset-0 flex items-center justify-center"><Wand2 size={32} className="text-indigo-400 animate-pulse" /></div></div>
                      <div className="text-center space-y-2"><h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Assembling Manifest</h3><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Refining technical shards...</p></div>
                  </div>
              )}

              <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-hide pr-4">
                  {summary ? (
                      <div className="animate-fade-in-up bg-white rounded-[2.5rem] shadow-2xl p-10 md:p-16 mb-20 text-slate-900 border border-slate-200 min-h-full"><MarkdownView content={summary} initialTheme="light" showThemeSwitcher={false} /></div>
                  ) : history.length === 0 && !isActive ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-800 space-y-6 opacity-20"><Radio size={160} strokeWidth={0.5} /><div className="text-center space-y-2"><h3 className="text-3xl font-black uppercase italic tracking-tighter">Manifest Pending</h3><p className="text-xs font-bold uppercase tracking-widest">Start ingest for high-fidelity record</p></div></div>
                  ) : (
                      <div className="space-y-6 pb-40 text-left max-w-3xl mx-auto w-full">
                          {history.map((node, i) => (
                              <div key={i} className="animate-fade-in-up flex gap-6 group">
                                  <div className="flex flex-col items-center pt-2"><div className="w-2 h-2 rounded-full bg-slate-800 border border-slate-700 shadow-sm"></div><div className="w-px h-full bg-slate-800/30 mt-2"></div></div>
                                  <div className="flex-1"><span className="text-[9px] font-mono text-slate-600 block mb-1">[{new Date(node.timestamp).toLocaleTimeString([], {hour12: false})}]</span><p className="text-xl font-medium text-slate-300 leading-relaxed antialiased">{node.text}</p></div>
                              </div>
                          ))}
                          {isActive && (
                              <div className="flex gap-6 relative">
                                  <div className="flex flex-col items-center pt-2">
                                      <div className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)] ${liveText || (volume > 0.05) ? 'bg-indigo-500 animate-ping' : 'bg-slate-800'}`}></div>
                                  </div>
                                  <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-[9px] font-black uppercase tracking-widest ${liveText ? 'text-indigo-400' : 'text-slate-600'}`}>{liveText ? '[LIVE]' : '[SYNCING]'}</span>
                                        <span className="text-[9px] font-mono text-indigo-700 font-bold">{currentTime}</span>
                                      </div>
                                      <p className={`text-xl leading-relaxed antialiased min-h-[1.5em] transition-colors duration-500 ${liveText ? 'text-indigo-300 italic font-black' : 'text-slate-700 font-bold italic'}`}>
                                          {liveText || (volume > 0.05 ? 'Capturing neural signal...' : 'Awaiting verbal signal...')}
                                          <span className={`inline-block w-2 h-6 bg-indigo-500 ml-2 align-middle ${volume > 0.05 ? 'animate-bounce' : 'animate-pulse'}`}></span>
                                      </p>
                                  </div>
                              </div>
                          )}
                      </div>
                  )}
              </div>

              {isActive && (
                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-8 py-4 bg-slate-900/80 backdrop-blur-xl border border-white/5 rounded-3xl shadow-2xl flex flex-col items-center gap-2 animate-bounce">
                      <div className="flex items-center gap-3"><div className={`w-3 h-3 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.5)] ${volume > 0.05 ? 'bg-red-500 scale-125' : 'bg-red-900 animate-pulse'}`}></div><span className="text-[10px] font-black text-white uppercase tracking-widest">Sovereign Registry Locked</span></div>
                      <span className="text-[8px] font-black text-indigo-500 uppercase tracking-tighter">Verified Shards: {history.length}</span>
                  </div>
              )}
          </main>
      </div>
    </div>
  );
};

export default ScribeStudio;
