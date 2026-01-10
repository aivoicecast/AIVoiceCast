
import React, { useState, useEffect, useRef } from 'react';
import { Channel, Group } from '../types';
import { generateChannelFromPrompt } from '../services/channelGenerator';
import { auth } from '../services/firebaseConfig';
import { getUserGroups } from '../services/firestoreService';
import { Mic, MicOff, Sparkles, X, Loader2, Check, Lock, Globe, Users, AlertCircle, Wand2, ArrowRight, BrainCircuit, MessageSquare } from 'lucide-react';

interface VoiceCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (channel: Channel) => void;
}

export const VoiceCreateModal: React.FC<VoiceCreateModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [generatedChannel, setGeneratedChannel] = useState<Channel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  
  const [visibility, setVisibility] = useState<'private' | 'public' | 'group'>('private');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (isOpen) {
        if (!SpeechRecognition) {
            setIsSupported(false);
            return;
        }
        try {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.lang = 'en-US'; 
            recognitionRef.current.onresult = (event: any) => {
                let finalTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
                }
                if (finalTranscript) setTranscript(prev => prev + ' ' + finalTranscript);
            };
            recognitionRef.current.onerror = (event: any) => {
                console.error(event.error);
                setIsListening(false);
            };
            recognitionRef.current.onend = () => { if (isListening) setIsListening(false); };
        } catch (e) { setIsSupported(false); }
    }
    if (isOpen) {
        setTranscript('');
        setGeneratedChannel(null);
        setVisibility('private');
        setSelectedGroupId('');
    }
    return () => { if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e) {} };
  }, [isOpen]);

  useEffect(() => {
     if (generatedChannel && visibility === 'group' && auth.currentUser) {
         getUserGroups(auth.currentUser.uid).then(setUserGroups);
     }
  }, [visibility, generatedChannel]);

  const toggleListening = () => {
    if (!isSupported) return;
    if (isListening) {
      try { recognitionRef.current?.stop(); } catch(e) {}
      setIsListening(false);
    } else {
      setError(null);
      try { recognitionRef.current?.start(); setIsListening(true); } catch(e) { setIsSupported(false); }
    }
  };

  const handleGenerate = async () => {
    if (!transcript.trim()) return;
    setIsListening(false);
    try { recognitionRef.current?.stop(); } catch(e) {}
    setIsProcessing(true);
    setError(null);

    try {
      const channel = await generateChannelFromPrompt(transcript, auth.currentUser, 'en');
      if (channel) setGeneratedChannel(channel);
      else setError("Failed to generate podcast.");
    } catch (e) { setError("An error occurred during generation."); } finally { setIsProcessing(false); }
  };

  const handleConfirm = () => {
    if (generatedChannel) {
      const finalChannel = { ...generatedChannel, visibility, groupId: visibility === 'group' ? selectedGroupId : undefined };
      onCreate(finalChannel);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
      <div className="relative bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900 shrink-0">
          <h2 className="text-xl font-bold text-white flex items-center space-x-3">
            <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/20"><Wand2 className="text-white" size={20} /></div>
            <div className="flex flex-col">
                <span className="leading-tight">Magic Creator</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Consultative Assistant</span>
            </div>
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={24} /></button>
        </div>

        <div className="p-8 flex-1 flex flex-col items-center justify-center space-y-8 overflow-y-auto">
          
          {!generatedChannel && !isProcessing && (
            <>
              <div className="text-center space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-900/40 border border-indigo-500/30 rounded-full text-indigo-300 text-[10px] font-bold uppercase tracking-widest mb-2">
                    <BrainCircuit size={14}/> I will narrow down your topic for you
                </div>
                <h3 className="text-2xl font-bold text-white">What should we create today?</h3>
                <p className="text-sm text-slate-400 max-w-xs mx-auto">"I want a deep technical series on C++ for experts" or "A 10-lesson guide to healthy living."</p>
              </div>

              <div className="w-full flex flex-col items-center gap-6">
                  {isSupported && (
                      <button onClick={toggleListening} className={`w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl relative ${isListening ? 'bg-red-500 hover:bg-red-600 shadow-red-500/40 scale-110' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/40 hover:scale-105'}`}>
                        {isListening ? <MicOff size={44} className="text-white" /> : <Mic size={44} className="text-white" />}
                        {isListening && <div className="absolute -inset-4 border-2 border-red-500/30 rounded-full animate-ping"></div>}
                      </button>
                  )}

                  <div className="w-full">
                    <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder={isListening ? "Listening to your request..." : "Describe your idea and I'll handle the specifics..."} className={`w-full bg-slate-800/50 border rounded-2xl p-5 text-white placeholder-slate-500 focus:outline-none resize-none text-center transition-all leading-relaxed ${isListening ? 'border-red-500 ring-2 ring-red-500/20' : 'border-slate-700 focus:ring-2 focus:ring-indigo-500'} h-32`}/>
                  </div>

                  <button onClick={handleGenerate} disabled={!transcript.trim()} className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl font-black text-white shadow-xl shadow-indigo-900/20 disabled:opacity-30 disabled:cursor-not-allowed hover:scale-[1.02] transition-transform flex items-center justify-center gap-3 uppercase tracking-wider text-sm">
                    <Sparkles size={20} />
                    <span>Synthesize Channel Concept</span>
                  </button>
              </div>
            </>
          )}

          {isProcessing && (
            <div className="flex flex-col items-center space-y-6 py-10 animate-fade-in">
              <div className="relative">
                <div className="w-24 h-24 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center"><Wand2 className="text-indigo-400 animate-pulse" size={32} /></div>
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-white uppercase tracking-tighter italic">Consulting the Oracle</h3>
                <p className="text-sm text-slate-400">Refining your topic and designing a custom curriculum...</p>
              </div>
            </div>
          )}

          {generatedChannel && (
            <div className="w-full space-y-6 animate-fade-in-up">
               <div className="bg-slate-800/50 rounded-[2rem] p-6 border border-slate-700 flex flex-col items-center text-center space-y-6 shadow-2xl">
                  <div className="relative">
                    <img src={generatedChannel.imageUrl} alt="Preview" className="w-40 h-40 rounded-3xl object-cover shadow-2xl border-2 border-indigo-500/20" />
                    <div className="absolute -bottom-3 -right-3 bg-indigo-600 p-2 rounded-xl shadow-lg"><Sparkles size={16} className="text-white"/></div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-tight">{generatedChannel.title}</h3>
                    <p className="text-xs text-indigo-400 font-black uppercase tracking-[0.2em] mt-2 mb-4">{generatedChannel.voiceName} • {generatedChannel.chapters?.[0]?.subTopics?.length} High-Intensity Lessons</p>
                    <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 text-xs text-slate-400 leading-relaxed max-w-sm mx-auto italic">
                        {generatedChannel.description}
                    </div>
                  </div>
               </div>

               <div className="bg-slate-800/30 p-4 rounded-2xl border border-slate-700 space-y-3">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Privacy Control</label>
                  <div className="flex gap-2">
                     <button onClick={() => setVisibility('private')} className={`flex-1 py-2 rounded-xl text-[10px] font-bold border flex items-center justify-center gap-1.5 transition-all ${visibility === 'private' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-500'}`}><Lock size={12}/> PRIVATE</button>
                     <button onClick={() => setVisibility('public')} className={`flex-1 py-2 rounded-xl text-[10px] font-bold border flex items-center justify-center gap-1.5 transition-all ${visibility === 'public' ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-500'}`}><Globe size={12}/> PUBLIC</button>
                  </div>
               </div>

               <div className="flex space-x-3">
                 <button onClick={() => setGeneratedChannel(null)} className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 rounded-2xl font-bold text-slate-400 transition-colors uppercase text-xs tracking-widest">Restart</button>
                 <button onClick={handleConfirm} className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black text-white shadow-xl shadow-indigo-900/30 flex items-center justify-center gap-2 transition-all uppercase text-xs tracking-widest active:scale-95">
                   <ArrowRight size={18} />
                   <span>Launch Channel</span>
                 </button>
               </div>
            </div>
          )}

          {error && (
            <div className="bg-red-900/20 text-red-300 p-4 rounded-xl text-center w-full flex items-center justify-center gap-2 border border-red-900/50">
              <AlertCircle size={16} />
              <span className="text-xs font-bold">{error}</span>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
