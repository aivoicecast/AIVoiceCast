import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ArrowLeft, BookOpen, Rocket, Sparkles, Globe, ShieldCheck, Play, Pause, Volume2, Clock, Loader2, FileText, LayoutList, Speaker, ChevronDown, Check, Zap, Trophy, Layout, Target } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { MarkdownView } from './MarkdownView';
import { STORY_VISION_PITCH_MD, STORY_DEEP_DIVE_MD, STORY_VISION_SPEAKER_SCRIPT, STORY_JUDGE_PITCH_MD, STORY_JUDGE_SPEAKER_SCRIPT, STORY_HACKATHON_PITCH_MD, STORY_HACKATHON_SPEAKER_SCRIPT } from '../utils/storyContent';
import { synthesizeSpeech, speakSystem, TtsProvider } from '../services/tts';
import { stopAllPlatformAudio, syncPrimeSpeech, registerAudioOwner, getGlobalAudioContext, warmUpAudioContext, connectOutput } from '../utils/audioUtils';
import { Visualizer } from './Visualizer';

interface ProjectStoryProps {
  onBack: () => void;
}

export const ProjectStory: React.FC<ProjectStoryProps> = ({ onBack }) => {
  const [activeVersion, setActiveVersion] = useState<'hackathon' | 'judge' | 'vision' | 'deep-dive'>('hackathon');
  const [isReading, setIsReading] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [liveVolume, setLiveVolume] = useState(0);
  const [ttsProvider, setTtsProvider] = useState<TtsProvider>('gemini');
  const [showProviderMenu, setShowProviderMenu] = useState(false);
  
  const playbackSessionRef = useRef(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const currentContent = useMemo(() => {
      if (activeVersion === 'hackathon') return STORY_HACKATHON_PITCH_MD;
      if (activeVersion === 'judge') return STORY_JUDGE_PITCH_MD;
      if (activeVersion === 'vision') return STORY_VISION_PITCH_MD;
      return STORY_DEEP_DIVE_MD;
  }, [activeVersion]);

  const estimatedDuration = useMemo(() => {
      if (activeVersion === 'hackathon') return '5m 15s';
      if (activeVersion === 'judge') return '5m 30s';
      if (activeVersion === 'vision') return '5m 0s';
      return '15m 0s';
  }, [activeVersion]);

  const stopAudioLocal = useCallback(() => {
      playbackSessionRef.current++;
      setIsReading(false);
      setIsBuffering(false);
      setLiveVolume(0);
      
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
      if (isReading) {
          stopAudioLocal();
          return;
      }

      const MY_TOKEN = "NeuralPrismPitchPresentation";
      registerAudioOwner(MY_TOKEN, stopAudioLocal);
      const localSession = ++playbackSessionRef.current;
      
      setIsReading(true);
      syncPrimeSpeech();
      const ctx = getGlobalAudioContext();
      await warmUpAudioContext(ctx);

      try {
          if (activeVersion !== 'deep-dive') {
              let script: string[] = [];
              if (activeVersion === 'hackathon') script = STORY_HACKATHON_SPEAKER_SCRIPT;
              else if (activeVersion === 'judge') script = STORY_JUDGE_SPEAKER_SCRIPT;
              else if (activeVersion === 'vision') script = STORY_VISION_SPEAKER_SCRIPT;
              
              for (let i = 0; i < script.length; i++) {
                  if (localSession !== playbackSessionRef.current) break;
                  
                  setIsBuffering(true);
                  const segment = script[i];
                  
                  if (ttsProvider === 'system') {
                      setIsBuffering(false);
                      setLiveVolume(0.8);
                      await speakSystem(segment, 'en');
                      setLiveVolume(0);
                  } else {
                      const res = await synthesizeSpeech(segment, 'Zephyr', ctx, ttsProvider, 'en', {
                          channelId: 'system', topicId: activeVersion, nodeId: `story_${activeVersion}_seg_${i}`
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
                  
                  if (localSession === playbackSessionRef.current) {
                      await new Promise(r => setTimeout(r, 800));
                  }
              }
          } else {
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
          if (localSession === playbackSessionRef.current) {
              setIsReading(false);
              setIsBuffering(false);
          }
      }
  };

  useEffect(() => {
      return () => stopAudioLocal();
  }, [stopAudioLocal]);

  useEffect(() => {
      if (isReading) {
          stopAudioLocal();
      }
  }, [activeVersion]);

  return (
    <div className="h-full bg-slate-950 text-slate-100 flex flex-col overflow-hidden animate-fade-in relative">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 blur-[150px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-600/10 blur-[150px] rounded-full pointer-events-none"></div>

        <div className="relative z-10 flex flex-col h-full">
            <div className="p-4 border-b border-slate-800 flex flex-col lg:flex-row items-center justify-between sticky top-0 bg-slate-950/90 backdrop-blur-md z-20 gap-4">
                <div className="flex items-center gap-4 w-full lg:w-auto">
                    <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-xl transition-all text-slate-400 hover:text-white">
                        <ArrowLeft size={24} />
                    </button>
                    <div className="hidden sm:block">
                        <h1 className="text-lg font-black tracking-widest uppercase text-white flex items-center gap-2 italic">
                            <Layout size={20} className="text-indigo-400"/> Refractive Deck
                        </h1>
                        <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.3em]">Startup Manifest v8.8.0</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-4">
                    <div className="flex bg-slate-900 p-1 rounded-2xl border border-slate-800 shadow-inner">
                        <button 
                            onClick={() => setActiveVersion('hackathon')}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeVersion === 'hackathon' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <Target size={14}/> Judge Pitch
                        </button>
                        <button 
                            onClick={() => setActiveVersion('judge')}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeVersion === 'judge' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <Trophy size={14}/> Startup Pitch
                        </button>
                        <button 
                            onClick={() => setActiveVersion('vision')}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeVersion === 'vision' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <Rocket size={14}/> 2036 Vision
                        </button>
                        <button 
                            onClick={() => setActiveVersion('deep-dive')}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeVersion === 'deep-dive' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <FileText size={14}/> Technical
                        </button>
                    </div>

                    <div className="h-8 w-px bg-slate-800 mx-2 hidden md:block"></div>

                    <div className="relative">
                        <button 
                            onClick={() => setShowProviderMenu(!showProviderMenu)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-[9px] font-black uppercase tracking-widest text-indigo-400 hover:text-white transition-all shadow-xl"
                        >
                            <Speaker size={14}/>
                            <span className="text-white">{ttsProvider}</span>
                            <ChevronDown size={12}/>
                        </button>
                        {showProviderMenu && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowProviderMenu(false)}></div>
                                <div className="absolute top-full right-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 p-2 animate-fade-in-up flex flex-col gap-1">
                                    {(['gemini', 'google', 'openai', 'system'] as TtsProvider[]).map(p => (
                                        <button 
                                            key={p} 
                                            onClick={() => { setTtsProvider(p); setShowProviderMenu(false); }}
                                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${ttsProvider === p ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}
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

                    <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
                        <div className="hidden md:flex items-center gap-4 text-slate-500 text-[10px] font-black uppercase tracking-widest mr-2">
                            <div className="flex items-center gap-1.5">
                                <Clock size={12} className="text-amber-500" />
                                <span>{estimatedDuration}</span>
                            </div>
                            <div className="w-12 h-3 overflow-hidden rounded-full"><Visualizer volume={isReading ? 0.6 : 0} isActive={isReading} color="#818cf8"/></div>
                        </div>
                        <button 
                            onClick={handleToggleRead}
                            disabled={isBuffering}
                            className={`flex items-center gap-2 px-5 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 ${isReading ? 'bg-red-600 text-white animate-pulse' : 'bg-white text-slate-900 hover:bg-indigo-50'}`}
                        >
                            {isBuffering ? <Loader2 size={12} className="animate-spin"/> : isReading ? <Pause size={12} fill="currentColor"/> : <Play size={12} fill="currentColor"/>}
                            <span>{isReading ? 'Stop' : 'Play Pitch'}</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide bg-[#fdfbf7]">
                <div className="max-w-4xl mx-auto px-6 py-12 md:py-20">
                    <div className="mb-16 flex flex-col items-center sm:items-start space-y-6">
                        <div className="p-3 bg-slate-950 rounded-3xl shadow-2xl border border-white/5">
                            <BrandLogo size={64} className="transform hover:rotate-12 transition-transform duration-700" />
                        </div>
                        <h2 className="text-5xl sm:text-7xl font-black italic tracking-tighter uppercase leading-none text-slate-950">
                            {activeVersion === 'hackathon' ? 'Judge' : activeVersion === 'judge' ? 'Startup' : activeVersion === 'vision' ? '2036 Vision' : 'Deep Dive'} <br/>
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600">
                                Refraction
                            </span>
                        </h2>
                        <div className="w-16 h-1.5 bg-indigo-600 rounded-full"></div>
                    </div>

                    <div className="prose prose-slate prose-lg max-w-none antialiased shadow-2xl rounded-[2.5rem] overflow-hidden border border-slate-200">
                        <MarkdownView content={currentContent} initialTheme="light" showThemeSwitcher={true} />
                    </div>

                    <section className="text-center pt-24 border-t border-slate-200 mt-32 pb-32">
                        <div className="inline-flex items-center gap-3 px-6 py-2 bg-slate-950 rounded-full text-white text-[10px] font-black uppercase tracking-[0.4em] mb-10 shadow-xl">
                            <Globe size={14} className="text-indigo-400" /> Spectrum Propagation
                        </div>
                        <h3 className="text-4xl md:text-5xl font-black italic tracking-tighter uppercase mb-8 text-slate-950 leading-none">
                            Ready to <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Sync</span>?
                        </h3>
                        <p className="text-slate-500 max-w-xl mx-auto mb-16 leading-relaxed text-lg font-medium">
                            Explore the 24-app spectrum of the Neural Prism Hub.
                        </p>
                        <button 
                            onClick={onBack}
                            className="px-16 py-5 bg-slate-950 text-white font-black uppercase tracking-[0.3em] rounded-2xl hover:bg-indigo-600 transition-all shadow-2xl active:scale-95 flex items-center gap-4 mx-auto"
                        >
                            <Rocket size={20} />
                            Launch Workspace
                        </button>
                    </section>

                    <footer className="py-12 border-t border-slate-200 flex flex-col items-center gap-6">
                        <div className="flex items-center gap-6 opacity-30">
                            <ShieldCheck size={20} className="text-slate-900" />
                            <div className="w-10 h-px bg-slate-900"></div>
                            <Sparkles size={20} className="text-slate-900" />
                            <div className="w-10 h-px bg-slate-900"></div>
                            <Globe size={20} className="text-slate-900" />
                        </div>
                        <div className="text-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em]">Neural Prism v8.8.0-COMPLETE</p>
                            <p className="text-[9px] text-slate-400 font-bold italic mt-2 uppercase tracking-widest">Powered by Google Gemini // Refracted by Neural Prism.</p>
                        </div>
                    </footer>
                </div>
            </div>
        </div>
    </div>
  );
};

export default ProjectStory;