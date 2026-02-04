
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, BookOpen, Play, Pause, Loader2, Speaker, ChevronDown, Check, Zap, Volume2, Activity } from 'lucide-react';
import { MANUAL_CONTENT } from '../utils/manualContent';
import { MarkdownView } from './MarkdownView';
import { ViewID, TtsProvider } from '../types';
import { synthesizeSpeech, speakSystem } from '../services/tts';
import { getGlobalAudioContext, warmUpAudioContext, registerAudioOwner, connectOutput, syncPrimeSpeech } from '../utils/audioUtils';
import { Visualizer } from './Visualizer';

interface ManualModalProps {
  isOpen: boolean;
  onClose: () => void;
  viewId: ViewID | null;
}

export const ManualModal: React.FC<ManualModalProps> = ({ isOpen, onClose, viewId }) => {
  const [isReading, setIsReading] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [ttsProvider, setTtsProvider] = useState<TtsProvider>('gemini');
  const [showProviderMenu, setShowProviderMenu] = useState(false);
  const [liveVolume, setLiveVolume] = useState(0);
  
  const playbackSessionRef = useRef(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const content = viewId ? MANUAL_CONTENT[viewId] || "# Documentation Missing\nThis sector's manifest is still being refracted." : "";

  const stopAudio = useCallback(() => {
    playbackSessionRef.current++;
    setIsReading(false);
    setIsBuffering(false);
    setLiveVolume(0);
    activeSourcesRef.current.forEach(s => { 
        try { s.onended = null; s.stop(); s.disconnect(); } catch(e) {} 
    });
    activeSourcesRef.current.clear();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }, []);

  useEffect(() => {
    if (!isOpen) stopAudio();
  }, [isOpen, stopAudio]);

  const handleToggleRead = async () => {
    if (isReading) {
        stopAudio();
        return;
    }

    const MY_TOKEN = `ManualReader:${viewId}`;
    registerAudioOwner(MY_TOKEN, stopAudio);
    const localSession = ++playbackSessionRef.current;
    
    setIsReading(true);
    syncPrimeSpeech();
    const ctx = getGlobalAudioContext();
    await warmUpAudioContext(ctx);

    const cleanText = content
        .replace(/[#*`]/g, '')
        .replace(/\$/g, '')
        .replace(/---/g, '');

    const segments = cleanText.split('\n').filter(s => s.trim().length > 5);

    try {
        for (let i = 0; i < segments.length; i++) {
            if (localSession !== playbackSessionRef.current) break;
            
            const segment = segments[i].trim();
            setIsBuffering(true);

            if (ttsProvider === 'system') {
                setIsBuffering(false);
                setLiveVolume(0.8);
                await speakSystem(segment, 'en');
                setLiveVolume(0);
            } else {
                const res = await synthesizeSpeech(segment, 'Zephyr', ctx, ttsProvider, 'en');
                setIsBuffering(false);

                if (res.buffer && localSession === playbackSessionRef.current) {
                    setLiveVolume(0.8);
                    await new Promise<void>((resolve) => {
                        const source = ctx.createBufferSource();
                        source.buffer = res.buffer!;
                        connectOutput(source, ctx);
                        activeSourcesRef.current.add(source);
                        source.onended = () => { 
                            activeSourcesRef.current.delete(source); 
                            setLiveVolume(0); 
                            resolve(); 
                        };
                        source.start(0);
                    });
                }
            }
            if (localSession === playbackSessionRef.current) {
                await new Promise(r => setTimeout(r, 600));
            }
        }
    } catch (e) {
        console.error("Manual reading failed", e);
    } finally {
        if (localSession === playbackSessionRef.current) {
            setIsReading(false);
            setIsBuffering(false);
        }
    }
  };

  if (!isOpen || !viewId) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-fade-in">
      <div className="bg-white rounded-[2.5rem] w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in-up">
        
        <header className="p-6 bg-indigo-600 flex justify-between items-center shrink-0 shadow-lg relative z-10">
          <div className="flex items-center gap-4">
              <div className="p-2 bg-white/20 rounded-xl text-white backdrop-blur-md">
                  <BookOpen size={24} />
              </div>
              <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-widest italic">Activity Manual</h2>
                  <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">Sector: {viewId.replace('_', ' ')}</p>
              </div>
          </div>
          
          <div className="flex items-center gap-4">
              <div className="relative">
                  <button 
                    onClick={() => setShowProviderMenu(!showProviderMenu)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-[9px] font-black uppercase text-white transition-all"
                  >
                      <Speaker size={14}/>
                      <span>{ttsProvider}</span>
                      <ChevronDown size={12}/>
                  </button>
                  {showProviderMenu && (
                      <div className="absolute top-full right-0 mt-2 w-40 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-20 p-1 flex flex-col gap-1 overflow-hidden">
                          {(['gemini', 'openai', 'system'] as const).map(p => (
                              <button key={p} onClick={() => { setTtsProvider(p); setShowProviderMenu(false); }} className={`flex items-center justify-between px-3 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${ttsProvider === p ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>
                                  <span>{p}</span>
                                  {ttsProvider === p && <Check size={12}/>}
                              </button>
                          ))}
                      </div>
                  )}
              </div>
              <button 
                onClick={handleToggleRead}
                disabled={isBuffering}
                className={`flex items-center gap-2 px-6 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 ${isReading ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-indigo-600 hover:bg-indigo-50'}`}
              >
                  {isBuffering ? <Loader2 size={14} className="animate-spin"/> : isReading ? <Pause size={14} fill="currentColor"/> : <Play size={14} fill="currentColor"/>}
                  <span>{isReading ? 'Stop' : 'Neural Audit'}</span>
              </button>
              <div className="w-16 h-6 overflow-hidden rounded-full bg-white/10 hidden sm:block"><Visualizer volume={liveVolume} isActive={isReading} color="#ffffff" /></div>
              <button onClick={onClose} className="p-2 text-white/60 hover:text-white transition-colors"><X size={24}/></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 lg:p-16 scrollbar-hide bg-[#fdfbf7]">
            <div className="max-w-3xl mx-auto prose prose-slate prose-lg">
                <MarkdownView content={content} initialTheme="light" showThemeSwitcher={false} />
            </div>
            
            <div className="mt-20 pt-10 border-t border-slate-200 flex flex-col items-center gap-4 text-slate-400">
                <div className="flex items-center gap-6">
                    <Activity size={20} className="opacity-20"/>
                    <span className="w-12 h-px bg-slate-200"></span>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em]">v7.0.0-ULTRA</p>
                    <span className="w-12 h-px bg-slate-200"></span>
                    <Zap size={20} className="opacity-20"/>
                </div>
                <p className="text-[8px] font-bold italic uppercase tracking-widest text-center">Refracting intelligence into permanent human utility.</p>
            </div>
        </div>
      </div>
    </div>
  );
};
