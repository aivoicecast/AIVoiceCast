
import React, { useState, useEffect, useRef } from 'react';
import { Channel, Group } from '../types';
import { generateChannelFromPrompt } from '../services/channelGenerator';
import { auth } from '../services/firebaseConfig';
import { getUserGroups } from '../services/firestoreService';
import { Mic, MicOff, Sparkles, X, Loader2, Check, Lock, Globe, Users, AlertCircle, Keyboard, Send } from 'lucide-react';

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
  
  // Sharing Options during Preview
  const [visibility, setVisibility] = useState<'private' | 'public' | 'group'>('private');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check for browser support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (isOpen) {
        if (!SpeechRecognition) {
            setIsSupported(false);
            // Don't show error immediately, just default to text mode UI
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
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    }
                }
                if (finalTranscript) {
                   setTranscript(prev => prev + ' ' + finalTranscript);
                }
            };

            recognitionRef.current.onerror = (event: any) => {
                console.error("Speech recognition error", event.error);
                if (event.error === 'not-allowed') {
                    setError("Microphone access denied. Check settings.");
                    setIsListening(false);
                } else if (event.error === 'no-speech') {
                    // Ignore no-speech errors, just stop listening visually
                    return; 
                } else if (event.error === 'service-not-allowed') {
                    // Critical iOS/Mobile Chrome fix:
                    // This error means the browser engine refuses to provide speech-to-text.
                    // We must fallback to text mode immediately.
                    setError("Voice dictation is unavailable in this browser. Please type your idea.");
                    setIsSupported(false); 
                    setIsListening(false);
                } else if (event.error === 'network') {
                    setError("Network error. Voice recognition requires internet.");
                    setIsListening(false);
                } else {
                    setError("Voice error: " + event.error);
                    setIsListening(false);
                }
            };
            
            recognitionRef.current.onend = () => {
                if (isListening) setIsListening(false);
            };
            
        } catch (e) {
            console.error("Speech Init Failed", e);
            setIsSupported(false);
        }
    }
    
    // Reset state on open
    if (isOpen) {
        setTranscript('');
        setGeneratedChannel(null);
        setVisibility('private');
        setSelectedGroupId('');
        if (isSupported) setError(null); 
    }
    
    return () => {
        if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch(e) {}
        }
    };
  }, [isOpen]);

  // Load groups if needed
  useEffect(() => {
     if (generatedChannel && visibility === 'group' && auth.currentUser) {
         getUserGroups(auth.currentUser.uid).then(groups => {
             setUserGroups(groups);
             if (groups.length > 0) setSelectedGroupId(groups[0].id);
         });
     }
  }, [visibility, generatedChannel]);

  const toggleListening = () => {
    if (!isSupported) return;
    
    if (isListening) {
      try { recognitionRef.current?.stop(); } catch(e) {}
      setIsListening(false);
    } else {
      setError(null);
      try {
          recognitionRef.current?.start();
          setIsListening(true);
      } catch(e) {
          console.error("Start failed", e);
          setError("Could not start microphone.");
          setIsSupported(false); // Assume broken if start throws immediately
      }
    }
  };

  const handleGenerate = async () => {
    if (!transcript.trim()) return;
    
    setIsListening(false);
    try { recognitionRef.current?.stop(); } catch(e) {}
    setIsProcessing(true);
    setError(null);

    try {
      const channel = await generateChannelFromPrompt(
        transcript, 
        auth.currentUser, 
        'en' 
      );
      
      if (channel) {
        setGeneratedChannel(channel);
      } else {
        setError("Failed to generate podcast. Please try again.");
      }
    } catch (e) {
      setError("An error occurred during generation.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = () => {
    if (generatedChannel) {
      // Apply visibility settings
      const finalChannel = {
          ...generatedChannel,
          visibility,
          groupId: visibility === 'group' ? selectedGroupId : undefined
      };
      onCreate(finalChannel);
      handleClose();
    }
  };

  const handleClose = () => {
    setTranscript('');
    setGeneratedChannel(null);
    setIsListening(false);
    setIsProcessing(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
      <div className="relative bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900 shrink-0">
          <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-indigo-400 flex items-center space-x-2">
            <Sparkles className="text-pink-400 w-5 h-5" />
            <span>Magic Creator</span>
          </h2>
          <button onClick={handleClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 flex-1 flex flex-col items-center justify-center space-y-8 overflow-y-auto">
          
          {!generatedChannel && !isProcessing && (
            <>
              <div className="text-center space-y-2">
                <p className="text-lg text-white font-medium">
                    {isSupported ? "Speak your idea to life." : "Type your idea below."}
                </p>
                <p className="text-sm text-slate-400">"I want a podcast about quantum physics for beginners..."</p>
              </div>

              {/* Mic Button - Only show if supported */}
              {isSupported && (
                  <button
                    onClick={toggleListening}
                    className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${
                      isListening 
                        ? 'bg-red-500 hover:bg-red-600 shadow-red-500/40 animate-pulse' 
                        : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/40 hover:scale-105'
                    }`}
                  >
                    {isListening ? <MicOff size={40} className="text-white" /> : <Mic size={40} className="text-white" />}
                  </button>
              )}

              {/* Text Input - Always available, but highlighted if mic not supported */}
              <div className="w-full relative">
                <textarea
                  autoFocus={!isSupported}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder={isSupported ? (isListening ? "Listening..." : "Or type here...") : "Describe your podcast topic here..."}
                  className={`w-full bg-slate-800/50 border rounded-xl p-4 text-white placeholder-slate-500 focus:outline-none resize-none text-center transition-all ${isSupported ? 'border-slate-700 focus:ring-2 focus:ring-indigo-500' : 'border-indigo-500 ring-1 ring-indigo-500/50 h-32'}`}
                  rows={isSupported ? 3 : 5}
                />
                {!isSupported && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-900 px-2 text-xs text-indigo-400 font-bold uppercase tracking-wider">
                        Text Mode
                    </div>
                )}
              </div>

              <button
                onClick={handleGenerate}
                disabled={!transcript.trim()}
                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl font-bold text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
              >
                {isSupported ? <Sparkles size={18} /> : <Send size={18} />}
                <span>Generate Podcast</span>
              </button>
            </>
          )}

          {isProcessing && (
            <div className="flex flex-col items-center space-y-4 py-10">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                <Sparkles className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-indigo-400" size={20} />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-white">Dreaming up your channel...</h3>
                <p className="text-sm text-slate-500">Designing curriculum, hiring AI host, painting cover art.</p>
              </div>
            </div>
          )}

          {generatedChannel && (
            <div className="w-full space-y-6 animate-fade-in-up">
               <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700 flex flex-col items-center text-center space-y-4">
                  <img 
                    src={generatedChannel.imageUrl} 
                    alt="Preview" 
                    className="w-24 h-24 rounded-xl object-cover shadow-lg"
                  />
                  <div>
                    <h3 className="text-lg font-bold text-white">{generatedChannel.title}</h3>
                    <p className="text-xs text-indigo-300 font-bold uppercase tracking-wider mt-1">{generatedChannel.voiceName} • {generatedChannel.chapters?.length} Chapters</p>
                  </div>
               </div>

               {/* Visibility Selection */}
               <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700 space-y-3">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Share with</label>
                  <div className="flex gap-2">
                     <button onClick={() => setVisibility('private')} className={`flex-1 py-1.5 rounded-lg text-xs font-medium border flex items-center justify-center space-x-1 transition-all ${visibility === 'private' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}><Lock size={12}/><span>Private</span></button>
                     <button onClick={() => setVisibility('public')} className={`flex-1 py-1.5 rounded-lg text-xs font-medium border flex items-center justify-center space-x-1 transition-all ${visibility === 'public' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}><Globe size={12}/><span>Public</span></button>
                     <button onClick={() => setVisibility('group')} className={`flex-1 py-1.5 rounded-lg text-xs font-medium border flex items-center justify-center space-x-1 transition-all ${visibility === 'group' ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}><Users size={12}/><span>Group</span></button>
                  </div>
                  {visibility === 'group' && (
                     <select value={selectedGroupId} onChange={e => setSelectedGroupId(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-xs text-white">
                        {userGroups.length > 0 ? userGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>) : <option>No Groups Found</option>}
                     </select>
                  )}
               </div>

               <div className="flex space-x-3">
                 <button 
                   onClick={() => setGeneratedChannel(null)}
                   className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-medium text-slate-300 transition-colors"
                 >
                   Discard
                 </button>
                 <button 
                   onClick={handleConfirm}
                   disabled={visibility === 'group' && !selectedGroupId}
                   className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl font-bold text-white shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2 transition-colors"
                 >
                   <Check size={18} />
                   <span>Publish & Listen</span>
                 </button>
               </div>
            </div>
          )}

          {error && (
            <div className="bg-red-900/20 text-red-300 p-4 rounded-xl text-center w-full flex items-center justify-center gap-2 border border-red-900/50">
              <AlertCircle size={16} />
              <span className="text-xs">{error}</span>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
