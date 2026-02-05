import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ArrowLeft, Mic, MicOff, Save, Download, FileText, 
  Sparkles, Loader2, Trash2, Globe, Activity, Terminal, 
  Bot, Clock, User, CheckCircle, Info, RefreshCw, X, 
  Volume2, Settings2, ShieldCheck, Zap, MoreVertical,
  Disc, CloudUpload, Square, Monitor, AlertCircle, Languages,
  ChevronRight, ArrowRightLeft, Play, VolumeX, Radio
} from 'lucide-react';
import { GeminiLiveService } from '../services/geminiLive';
import { TranscriptItem, UserProfile } from '../types';
import { Visualizer } from './Visualizer';
import { auth } from '../services/firebaseConfig';
import { saveDiscussion } from '../services/firestoreService';
import { generateSecureId } from '../utils/idUtils';
import { getDriveToken, signInWithGoogle, connectGoogleDrive } from '../services/authService';
import { ensureCodeStudioFolder, uploadToDrive, ensureFolder } from '../services/googleDriveService';
import { getGlobalAudioContext, warmUpAudioContext } from '../utils/audioUtils';

interface ScribeStudioProps {
  onBack: () => void;
  currentUser: any;
  userProfile: UserProfile | null;
  onOpenManual?: () => void;
}

export const ScribeStudio: React.FC<ScribeStudioProps> = ({ onBack, currentUser, userProfile, onOpenManual }) => {
  const [isActive, setIsActive] = useState(false);
  const [isAiConnected, setIsAiConnected] = useState(false);
  const [volume, setVolume] = useState(0);
  const [sessionTitle, setSessionTitle] = useState('Universal Neural Translate');
  
  // Audio sources
  const [hasSystemAudio, setHasSystemAudio] = useState(false);
  
  // History of completed translation turns
  const [history, setHistory] = useState<TranscriptItem[]>([]);
  
  // Active buffers for the currently speaking turn
  const [activeEnglish, setActiveEnglish] = useState<string>('');
  const [activeChinese, setActiveChinese] = useState<string>('');

  const serviceRef = useRef<GeminiLiveService | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const translationScrollRef = useRef<HTMLDivElement>(null);

  // Refs for tracking the ongoing turn state without re-render lag
  const currentEnRef = useRef('');
  const currentZhRef = useRef('');
  const isSyncingScroll = useRef(false);
  
  const dispatchLog = (msg: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') => {
      window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: `[Translate] ${msg}`, type } }));
  };

  const handleScrollSync = (e: React.UIEvent<HTMLDivElement>, targetRef: React.RefObject<HTMLDivElement | null>) => {
      if (isSyncingScroll.current) return;
      isSyncingScroll.current = true;
      if (targetRef.current) {
          targetRef.current.scrollTop = e.currentTarget.scrollTop;
      }
      setTimeout(() => { isSyncingScroll.current = false; }, 50);
  };

  const autoScroll = () => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      if (translationScrollRef.current) translationScrollRef.current.scrollTop = translationScrollRef.current.scrollHeight;
  };

  // Mixed audio stream helper
  const createMixedStream = async (useSystem: boolean) => {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!useSystem) return { stream: micStream, cleanup: () => micStream.getTracks().forEach(t => t.stop()) };

      dispatchLog("Requesting System Audio access (Tab/Screen)...", "info");
      try {
          const systemStream = await navigator.mediaDevices.getDisplayMedia({
              video: { width: 1, height: 1 }, // Required but we'll ignore
              audio: { 
                  echoCancellation: false, 
                  noiseSuppression: false, 
                  autoGainControl: false 
              }
          });

          const ctx = getGlobalAudioContext();
          const dest = ctx.createMediaStreamDestination();
          
          const micSource = ctx.createMediaStreamSource(micStream);
          const systemSource = ctx.createMediaStreamSource(systemStream);
          
          micSource.connect(dest);
          systemSource.connect(dest);
          
          return { 
              stream: dest.stream, 
              cleanup: () => {
                  micStream.getTracks().forEach(t => t.stop());
                  systemStream.getTracks().forEach(t => t.stop());
              }
          };
      } catch (err) {
          dispatchLog("System Audio denied. Falling back to Microphone only.", "warn");
          return { stream: micStream, cleanup: () => micStream.getTracks().forEach(t => t.stop()) };
      }
  };

  const handleStart = async () => {
    setIsActive(true);
    setHistory([]);
    setActiveEnglish('');
    setActiveChinese('');
    currentEnRef.current = '';
    currentZhRef.current = '';
    
    const service = new GeminiLiveService();
    serviceRef.current = service;

    const systemInstruction = `
    ROLE: UNIVERSAL_TRANSLATION_PIPE.
    TASK: Hear ALL audio (User and System) and Translate to Simplified Chinese.
    
    STRICT COMPLIANCE PROTOCOL:
    1. OUTPUT ONLY the direct translation string in Simplified Chinese.
    2. ABSOLUTELY NO English preamble or postamble.
    3. NO reasoning, no bold markers (**), no conversational filler.
    4. Treat yourself as a data wire: Input(Audio) -> Output(Chinese Text).
    5. If input is silence, output nothing.
    `.trim();

    try {
        const { stream: mixedStream, cleanup } = await createMixedStream(hasSystemAudio);
        
        await service.initializeAudio();
        await service.connect('Default Gem', systemInstruction, {
            onOpen: () => {
                setIsAiConnected(true);
                dispatchLog("Neural link active. Hearing all sources.", "success");
            },
            onClose: () => {
                setIsActive(false);
                setIsAiConnected(false);
                cleanup();
                dispatchLog("Neural link closed.", "info");
            },
            onError: (err) => {
                setIsActive(false);
                setIsAiConnected(false);
                cleanup();
                dispatchLog(`Link Fault: ${err}`, "error");
            },
            onVolumeUpdate: (v) => setVolume(v),
            onTranscript: (text, isUser) => {
                if (isUser) {
                    // Cumulative turn text from inputAudioTranscription
                    currentEnRef.current = text;
                    setActiveEnglish(text);
                } else {
                    // Incremental tokens from model response
                    // Filter out any AI "inner monologue" markers if they slip through
                    const filtered = text.replace(/\*\*.*?\*\*/g, '').replace(/Translating.*?/gi, '');
                    currentZhRef.current += filtered;
                    setActiveChinese(currentZhRef.current);
                }
                autoScroll();
            },
            onTurnComplete: () => {
                const en = currentEnRef.current.trim();
                const zh = currentZhRef.current.trim();
                
                if (en || zh) {
                    setHistory(prev => [...prev, { 
                        role: 'user', 
                        text: en || "...", 
                        translation: zh || "...",
                        timestamp: Date.now() 
                    }]);
                }
                
                currentEnRef.current = '';
                currentZhRef.current = '';
                setActiveEnglish('');
                setActiveChinese('');
                
                setTimeout(autoScroll, 100);
            },
            onAudioData: () => false // Mute AI verbal response for clean translate mode
        }, undefined, mixedStream);
    } catch (e: any) {
        setIsActive(true);
        if (e.name !== 'NotAllowedError') alert(e.message);
        else dispatchLog("Audio permissions missing.", "warn");
    }
  };

  const handleStop = () => {
      serviceRef.current?.disconnect();
      setIsActive(false);
      setIsAiConnected(false);
  };

  const handleSaveToVault = async () => {
    if (history.length === 0 && !activeEnglish) return;
    const fullText = history.map(h => `[EN]: ${h.text}\n[ZH]: ${h.translation}`).join('\n\n');
    const blob = new Blob([fullText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `translation_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-20">
          <div className="flex items-center gap-4">
              <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"><ArrowLeft size={20} /></button>
              <div>
                <h1 className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-widest"><Languages className="text-indigo-500" size={16} /> Neural Translate</h1>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{sessionTitle}</p>
              </div>
          </div>
          <div className="flex items-center gap-3">
              {!isActive ? (
                  <button onClick={handleStart} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg transition-all active:scale-95">
                      <Mic size={14} fill="currentColor"/> <span>Initialize Link</span>
                  </button>
              ) : (
                  <button onClick={handleStop} className="flex items-center gap-2 px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg transition-all active:scale-95">
                      <Square size={14} fill="currentColor"/> <span>Terminate</span>
                  </button>
              )}
              {history.length > 0 && (
                  <button onClick={handleSaveToVault} className="p-2 bg-slate-800 hover:bg-emerald-600 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition-all shadow-lg">
                      <Download size={18}/>
                  </button>
              )}
          </div>
      </header>

      <div className="flex-1 flex overflow-hidden flex-col md:flex-row">
          {/* Left Pane: English Source */}
          <div className="flex-1 flex flex-col border-r border-slate-800 relative bg-[#fdfbf7]">
              <div className="p-4 border-b border-slate-200 bg-slate-100/50 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Source (English)</span>
                    {isActive && <div className="w-16 h-3 overflow-hidden rounded-full"><Visualizer volume={volume} isActive={isActive} color="#6366f1" /></div>}
                  </div>
                  <div className="flex items-center gap-2">
                      <Radio size={12} className={hasSystemAudio ? 'text-indigo-500 animate-pulse' : 'text-slate-300'} />
                      <span className="text-[9px] font-bold text-slate-400 uppercase">System Mix</span>
                  </div>
              </div>
              <div ref={scrollRef} onScroll={(e) => handleScrollSync(e, translationScrollRef)} className="flex-1 overflow-y-auto p-8 md:p-12 space-y-8 scrollbar-hide">
                  {history.map((t, i) => (
                      <div key={i} className="animate-fade-in-up">
                          <p className="text-2xl md:text-3xl font-bold text-slate-900 leading-tight">{t.text}</p>
                      </div>
                  ))}
                  {activeEnglish && (
                      <div className="animate-fade-in">
                          <p className="text-2xl md:text-3xl font-bold text-indigo-600 leading-tight italic">{activeEnglish}</p>
                      </div>
                  )}
                  {history.length === 0 && !activeEnglish && (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4 opacity-20 mt-20">
                          <Mic size={64}/>
                          <p className="text-xs font-black uppercase tracking-widest">Awaiting Audio Stream</p>
                      </div>
                  )}
              </div>
          </div>

          {/* Right Pane: Chinese Translation */}
          <div className="flex-1 flex flex-col relative bg-white">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
                  <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Refraction (Chinese)</span>
                  <Languages size={14} className="text-indigo-500" />
              </div>
              <div ref={translationScrollRef} onScroll={(e) => handleScrollSync(e, scrollRef)} className="flex-1 overflow-y-auto p-8 md:p-12 space-y-8 scrollbar-hide bg-indigo-50/5">
                  {history.map((t, i) => (
                      <div key={i} className="animate-fade-in-up">
                          <p className="text-2xl md:text-3xl font-bold text-slate-500 leading-tight border-l-4 border-indigo-500/20 pl-8">{t.translation || "..."}</p>
                      </div>
                  ))}
                  {activeChinese && (
                      <div className="animate-fade-in">
                          <p className="text-2xl md:text-3xl font-bold text-emerald-600 leading-tight pl-9">{activeChinese}</p>
                      </div>
                  )}
              </div>
          </div>
      </div>

      <footer className="p-4 border-t border-slate-800 bg-slate-900/50 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-6">
              <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Handshake Logic</label>
                  <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                      <button 
                        onClick={() => setHasSystemAudio(false)} 
                        className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${!hasSystemAudio ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}
                      >
                        Voice Only
                      </button>
                      <button 
                        onClick={() => setHasSystemAudio(true)} 
                        className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${hasSystemAudio ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}
                      >
                        Unified Mix
                      </button>
                  </div>
              </div>
              
              <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isAiConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`}></div>
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Neural Status: {isAiConnected ? 'LINK_ESTABLISHED' : 'IDLE'}</span>
              </div>
          </div>

          <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-[9px] font-black text-slate-700 uppercase tracking-[0.4em]">
                  <Activity size={14}/> Socratic Refraction Protocol
              </div>
          </div>
      </footer>
    </div>
  );
};

export default ScribeStudio;
