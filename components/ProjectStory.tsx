import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ArrowLeft, BookOpen, Rocket, Sparkles, Globe, ShieldCheck, Play, Pause, Volume2, Clock, Loader2, FileText, LayoutList, Speaker, ChevronDown, Check, Zap } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { MarkdownView } from './MarkdownView';
import { STORY_PITCH_MD, STORY_DEEP_DIVE_MD, STORY_SPEAKER_SCRIPT } from '../utils/storyContent';
import { synthesizeSpeech, speakSystem, TtsProvider } from '../services/tts';
import { stopAllPlatformAudio, syncPrimeSpeech, registerAudioOwner, getGlobalAudioContext, warmUpAudioContext, connectOutput } from '../utils/audioUtils';
import { Visualizer } from './Visualizer';

interface ProjectStoryProps {
  onBack: () => void;
}

export const ProjectStory: React.FC<ProjectStoryProps> = ({ onBack }) => {
  const [activeVersion, setActiveVersion] = useState<'pitch' | 'deep-dive'>('pitch');
  const [isReading, setIsReading] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [liveVolume, setLiveVolume] = useState(0);
  const [ttsProvider, setTtsProvider] = useState<TtsProvider>('gemini');
  const [showProviderMenu, setShowProviderMenu] = useState(false);
  
  const playbackSessionRef = useRef(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const currentContent = useMemo(() => {
      return activeVersion === 'pitch' ? STORY_PITCH_MD : STORY_DEEP_DIVE_MD;
  }, [activeVersion]);

  const estimatedDuration = useMemo(() => {
      return activeVersion === 'pitch' ? '3m 0s' : '12m 30s';
  }, [activeVersion]);

  const stopAudioLocal = useCallback(() => {
      playbackSessionRef.current++;
      setIsReading(false);
      setIsBuffering(false);
      setLiveVolume(0);
      
      // Stop all active audio sources
      activeSourcesRef.current.forEach(s => { 
          try { 
              s.onended = null;
              s.stop(); 
              s.disconnect(); 
          } catch(e) {} 
      });
      activeSourcesRef.current.clear();
      
      if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
      }
  }, []);

  const handleToggleRead = async () => {
      // 1. If currently reading, trigger immediate stop and exit
      if (isReading) {
          stopAudioLocal();
          return;
      }

      const MY_TOKEN = "NeuralPrismPitchPresentation";
      
      // 2. CRITICAL: Register as the audio owner BEFORE generating the localSession ID.
      // This ensures that registerAudioOwner triggers the "cleanup" of any previous sessions
      // (incrementing playbackSessionRef.current) BEFORE we grab our fresh ID.
      registerAudioOwner(MY_TOKEN, stopAudioLocal);
      
      // 3. Generate the fresh session ID for this playback attempt
      const localSession = ++playbackSessionRef.current;
      
      setIsReading(true);
      syncPrimeSpeech();
      const ctx = getGlobalAudioContext();
      await warmUpAudioContext(ctx);

      try {
          if (activeVersion === 'pitch') {
              // --- NEURAL PRESENTER MODE ---
              for (let i = 0; i < STORY_SPEAKER_SCRIPT.length; i++) {
                  // Session Guard: Check if we were stopped while waiting
                  if (localSession !== playbackSessionRef.current) break;
                  
                  setIsBuffering(true);
                  const segment = STORY_SPEAKER_SCRIPT[i];
                  
                  if (ttsProvider === 'system') {
                      setIsBuffering(false);
                      setLiveVolume(0.8);
                      await speakSystem(segment, 'en');
                      setLiveVolume(0);
                  } else {
                      // Attempt synthesis with selected provider
                      const res = await synthesizeSpeech(segment, 'Zephyr', ctx, ttsProvider, 'en', {
                          channelId: 'system', topicId: 'story-pitch', nodeId: `story_pitch_seg_${i}`
                      });
                      
                      setIsBuffering(false);
                      
                      if (res.errorType !== 'none') {
                          window.dispatchEvent(new CustomEvent('neural-log', { 
                              detail: { text: `[Engine Alert] ${ttsProvider.toUpperCase()} reported error: ${res.errorMessage}. Try switching engines.`, type: 'error' } 
                          }));
                          throw new Error(res.errorMessage);
                      }

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
                  
                  // Human-like pause between segments
                  if (localSession === playbackSessionRef.current) {
                      await new Promise(r => setTimeout(r, 800));
                  }
              }
          } else {
              // --- STANDARD READ MODE ---
              const cleanText = currentContent
                  .replace(/[#*`]/g, '')
                  .replace(/\$/g, '')
                  .replace(/---/g, '');
              
              setLiveVolume(0.5);
              await speakSystem(cleanText, 'en');
              setLiveVolume(0);
          }
      } catch (e: any) {
          console.error("Story presentation failed", e);
          if (e.message?.includes('429')) {
              alert("Gemini Rate Limit reached (429). Please select OpenAI or Google Cloud TTS in the 'Voice Engine' menu to continue the high-fidelity experience.");
          }
      } finally {
          // Only clear the "isReading" state if this is still the active session
          if (localSession === playbackSessionRef.current) {
              setIsReading(false);
              setIsBuffering(false);
          }
      }
  };

  useEffect(() => {
      return () => stopAudioLocal();
  }, [stopAudioLocal]);

  // When switching versions, stop any active reading
  useEffect(() => {
      if (isReading) {
          stopAudioLocal();
      }
  }, [activeVersion]); // Removed stopAudioLocal from deps as it is stable

  return (
    <div className="h-full bg-slate-950 text-slate-100 flex flex-col overflow-hidden animate-fade-in relative">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 blur-[150px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-600/10 blur-[150px] rounded-full pointer-events-none"></div>

        <div className="relative z-10 flex flex-col h-full">
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-950/90 backdrop-blur-md z-20">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-xl transition-all text-slate-400 hover:text-white">
                        <ArrowLeft size={24} />
                    </button>
                    <div className="hidden sm:block">
                        <h1 className="text-xl font-black tracking-widest uppercase text-white flex items-center gap-2 italic">
                            <BookOpen size={20} className="text-indigo-400"/> The Neural Prism Story
                        </h1>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em]">Manifest v7.0.0-ULTRA</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Version Toggle */}
                    <div className="flex bg-slate-900 p-1 rounded-2xl border border-slate-800 shadow-inner">
                        <button 
                            onClick={() => setActiveVersion('pitch')}
                            className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeVersion === 'pitch' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <LayoutList size={14}/> 3-Min Pitch
                        </button>
                        <button 
                            onClick={() => setActiveVersion('deep-dive')}
                            className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeVersion === 'deep-dive' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <FileText size={14}/> Deep Dive
                        </button>
                    </div>

                    <div className="h-10 w-px bg-slate-800 mx-2 hidden md:block"></div>

                    {/* Voice Engine Selector */}
                    <div className="relative">
                        <button 
                            onClick={() => setShowProviderMenu(!showProviderMenu)}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-white transition-all shadow-xl"
                        >
                            <Speaker size={14}/>
                            <span className="hidden lg:inline">Engine:</span>
                            <span className="text-white">{ttsProvider}</span>
                            <ChevronDown size={12}/>
                        </button>
                        {showProviderMenu && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowProviderMenu(false)}></div>
                                <div className="absolute top-full mt-2 right-0 w-48 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 p-2 animate-fade-in-up flex flex-col gap-1">
                                    {(['gemini', 'google', 'openai', 'system'] as TtsProvider[]).map(p => (
                                        <button 
                                            key={p} 
                                            onClick={() => { setTtsProvider(p); setShowProviderMenu(false); }}
                                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${ttsProvider === p ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Zap size={12} className={ttsProvider === p ? 'text-white' : 'text-indigo-500'}/>
                                                <span>{p}</span>
                                            </div>
                                            {ttsProvider === p && <Check size={12}/>}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
                        <div className="hidden md:flex items-center gap-4 text-slate-500 text-[10px] font-black uppercase tracking-widest mr-4">
                            <div className="flex items-center gap-2">
                                <Clock size={14} className="text-amber-500" />
                                <span>{estimatedDuration} Est.</span>
                            </div>
                            <div className="w-16 h-4 overflow-hidden rounded-full"><Visualizer volume={isReading ? 0.6 : 0} isActive={isReading} color="#818cf8"/></div>
                        </div>
                        <button 
                            onClick={handleToggleRead}
                            disabled={isBuffering}
                            className={`flex items-center gap-2 px-6 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 ${isReading ? 'bg-red-600 text-white animate-pulse' : 'bg-white text-slate-900 hover:bg-indigo-50'}`}
                        >
                            {isBuffering ? <Loader2 size={14} className="animate-spin"/> : isReading ? <Pause size={14} fill="currentColor"/> : <Play size={14} fill="currentColor"/>}
                            <span>{isReading ? 'Stop' : activeVersion === 'pitch' ? 'Start Presentation' : 'Read Narrative'}</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide bg-[#fdfbf7]">
                <div className="max-w-4xl mx-auto px-6 py-16 md:py-24">
                    <div className="mb-20 flex flex-col items-center sm:items-start space-y-8">
                        <div className="p-4 bg-slate-950 rounded-[2.5rem] shadow-2xl border border-white/5">
                            <BrandLogo size={80} className="transform hover:rotate-12 transition-transform duration-700" />
                        </div>
                        <h2 className="text-5xl sm:text-8xl font-black italic tracking-tighter uppercase leading-none text-slate-950">
                            {activeVersion === 'pitch' ? 'Refracting' : 'Technical'} <br/>
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600">
                                {activeVersion === 'pitch' ? 'Intelligence' : 'Sovereignty'}
                            </span>
                        </h2>
                        <div className="w-24 h-2 bg-indigo-600 rounded-full"></div>
                    </div>

                    <div className="prose prose-slate prose-lg max-w-none antialiased shadow-2xl rounded-[3rem] overflow-hidden border border-slate-200">
                        <MarkdownView content={currentContent} initialTheme="light" showThemeSwitcher={true} />
                    </div>

                    {/* Next Steps */}
                    <section className="text-center pt-24 border-t border-slate-200 mt-32 pb-32">
                        <div className="inline-flex items-center gap-3 px-6 py-2 bg-slate-950 rounded-full text-white text-[10px] font-black uppercase tracking-[0.4em] mb-10 shadow-xl">
                            <Globe size={14} className="text-indigo-400" /> Entering the Spectrum
                        </div>
                        <h3 className="text-5xl md:text-6xl font-black italic tracking-tighter uppercase mb-8 text-slate-950 leading-none">
                            Ready to <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Refract</span>?
                        </h3>
                        <p className="text-slate-500 max-w-xl mx-auto mb-16 leading-relaxed text-xl font-medium">
                            Join the community of sovereign builders. Your growth plan is synthesized, and your artifacts are persistent.
                        </p>
                        <button 
                            onClick={onBack}
                            className="px-16 py-6 bg-slate-950 text-white font-black uppercase tracking-[0.3em] rounded-3xl hover:bg-indigo-600 transition-all shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] hover:shadow-indigo-600/30 active:scale-95 flex items-center gap-4 mx-auto"
                        >
                            <Rocket size={24} />
                            Launch Hub
                        </button>
                    </section>

                    {/* Footer */}
                    <footer className="py-12 border-t border-slate-200 flex flex-col items-center gap-6">
                        <div className="flex items-center gap-8 opacity-30">
                            <ShieldCheck size={24} className="text-slate-900" />
                            <div className="w-12 h-px bg-slate-900"></div>
                            <Sparkles size={24} className="text-slate-900" />
                            <div className="w-12 h-px bg-slate-900"></div>
                            <Globe size={24} className="text-slate-900" />
                        </div>
                        <div className="text-center">
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.5em]">Neural Prism v7.0.0-ULTRA</p>
                            <p className="text-[10px] text-slate-400 font-bold italic mt-2 uppercase tracking-widest">Built for humanity. Refracted by Neural Prism.</p>
                        </div>
                    </footer>
                </div>
            </div>
        </div>
    </div>
  );
};

export default ProjectStory;
