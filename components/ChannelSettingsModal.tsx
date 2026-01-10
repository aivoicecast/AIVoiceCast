
import React, { useState, useEffect, useRef } from 'react';
import { Channel, Group, Chapter, SubTopic } from '../types';
import { getUserGroups } from '../services/firestoreService';
import { auth } from '../services/firebaseConfig';
import { modifyCurriculumWithAI } from '../services/channelGenerator';
import { X, Lock, Globe, Users, Save, Loader2, Trash2, BookOpen, Plus, LayoutList, Mic, MicOff, Sparkles, Star, Podcast } from 'lucide-react';
import { VOICES } from '../utils/initialData';

interface ChannelSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: Channel;
  onUpdate: (updatedChannel: Channel) => void;
  onDelete?: () => void;
}

export const ChannelSettingsModal: React.FC<ChannelSettingsModalProps> = ({ isOpen, onClose, channel, onUpdate, onDelete }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'curriculum'>('general');
  
  const [title, setTitle] = useState(channel.title);
  const [description, setDescription] = useState(channel.description);
  const [visibility, setVisibility] = useState<'private' | 'public' | 'group'>(channel.visibility || 'private');
  const [selectedGroupId, setSelectedGroupId] = useState(channel.groupId || '');
  const [voice, setVoice] = useState(channel.voiceName);
  
  const [chapters, setChapters] = useState<Chapter[]>(channel.chapters || []);
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [isListening, setIsListening] = useState(false);
  const [activeVoiceField, setActiveVoiceField] = useState<'title' | 'desc' | 'curriculum' | null>(null);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const recognitionRef = useRef<any>(null);

  const currentUser = auth?.currentUser;

  useEffect(() => {
    if (isOpen && currentUser && visibility === 'group') {
      setLoadingGroups(true);
      getUserGroups(currentUser.uid).then(groups => {
        setUserGroups(groups);
        if (!selectedGroupId && groups.length > 0) setSelectedGroupId(groups[0].id);
        setLoadingGroups(false);
      });
    }
  }, [isOpen, visibility, currentUser, selectedGroupId]);

  useEffect(() => {
    if (isOpen && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = async (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (activeVoiceField === 'title') setTitle(transcript);
        else if (activeVoiceField === 'desc') setDescription(prev => prev ? prev + ' ' + transcript : transcript);
        else if (activeVoiceField === 'curriculum') await handleAIModification(transcript);
        setIsListening(false);
        setActiveVoiceField(null);
      };

      recognitionRef.current.onerror = () => { setIsListening(false); setActiveVoiceField(null); };
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, [isOpen, activeVoiceField, chapters]);

  const startListening = (field: 'title' | 'desc' | 'curriculum') => {
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); setActiveVoiceField(null); }
    else { setActiveVoiceField(field); setIsListening(true); recognitionRef.current?.start(); }
  };

  const handleAIModification = async (prompt: string) => {
      setIsAIProcessing(true);
      const newChapters = await modifyCurriculumWithAI(chapters, prompt, 'en');
      if (newChapters) setChapters(newChapters);
      else alert("Could not update curriculum.");
      setIsAIProcessing(false);
  };

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!title.trim()) return;
    setIsSaving(true);
    const updatedChannel: Channel = { ...channel, title, description, visibility, voiceName: voice, groupId: visibility === 'group' ? selectedGroupId : undefined, chapters: chapters };
    await onUpdate(updatedChannel);
    setIsSaving(false);
    onClose();
  };

  const isSpecializedVoice = (v: string) => {
    const specializedNames = ['Software Interview Voice', 'Linux Kernel Voice', 'Default Gem'];
    return specializedNames.some(name => v.includes(name));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl animate-fade-in-up overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900 shrink-0">
          <h2 className="text-lg font-bold text-white">Channel Settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={20} /></button>
        </div>

        <div className="flex border-b border-slate-800 shrink-0">
            <button onClick={() => setActiveTab('general')} className={`flex-1 py-3 text-sm font-bold flex items-center justify-center space-x-2 transition-colors ${activeTab === 'general' ? 'bg-slate-800 text-white border-b-2 border-indigo-500' : 'text-slate-500 hover:text-slate-300'}`}><LayoutList size={16}/><span>General</span></button>
            <button onClick={() => setActiveTab('curriculum')} className={`flex-1 py-3 text-sm font-bold flex items-center justify-center space-x-2 transition-colors ${activeTab === 'curriculum' ? 'bg-slate-800 text-white border-b-2 border-indigo-500' : 'text-slate-500 hover:text-slate-300'}`}><BookOpen size={16}/><span>Curriculum</span></button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'general' ? (
            <div className="space-y-6">
                <div className="space-y-4">
                    <div>
                        <div className="flex justify-between items-center mb-1">
                           <label className="block text-xs font-bold text-slate-500 uppercase">Title</label>
                           <button onClick={() => startListening('title')} className={`p-1 rounded-full ${activeVoiceField === 'title' ? 'bg-red-500/20 text-red-400 animate-pulse' : 'hover:bg-slate-800 text-slate-500'}`}>{activeVoiceField === 'title' ? <MicOff size={14}/> : <Mic size={14}/>}</button>
                        </div>
                        <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-1">
                           <label className="block text-xs font-bold text-slate-500 uppercase">Description</label>
                           <button onClick={() => startListening('desc')} className={`p-1 rounded-full ${activeVoiceField === 'desc' ? 'bg-red-500/20 text-red-400 animate-pulse' : 'hover:bg-slate-800 text-slate-500'}`}>{activeVoiceField === 'desc' ? <MicOff size={14}/> : <Mic size={14}/>}</button>
                        </div>
                        <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Voice personality</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                           {VOICES.map(v => (
                               <button 
                                key={v}
                                onClick={() => setVoice(v)}
                                className={`relative px-2 py-2 rounded-lg text-[10px] font-bold transition-all border flex items-center gap-1.5 ${voice === v ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg ring-1 ring-indigo-500/50' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                               >
                                  {isSpecializedVoice(v) ? <Star size={12} className={voice === v ? 'text-amber-300' : 'text-indigo-400'} fill={voice === v ? "currentColor" : "none"} /> : <Podcast size={12} className="opacity-50" />}
                                  <span className="truncate">{v}</span>
                               </button>
                           ))}
                        </div>
                    </div>
                </div>

                <div className="h-px bg-slate-800 w-full" />
                <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-500 uppercase">Visibility</label>
                    <div className="grid grid-cols-3 gap-2">
                        <button type="button" onClick={() => setVisibility('private')} className={`py-2 rounded-lg text-xs font-medium flex flex-col items-center justify-center space-y-1 border transition-all ${visibility === 'private' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}><Lock size={16} /><span>Private</span></button>
                        <button type="button" onClick={() => setVisibility('public')} className={`py-2 rounded-lg text-xs font-medium flex flex-col items-center justify-center space-y-1 border transition-all ${visibility === 'public' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}><Globe size={16} /><span>Public</span></button>
                        <button type="button" onClick={() => setVisibility('group')} className={`py-2 rounded-lg text-xs font-medium flex flex-col items-center justify-center space-y-1 border transition-all ${visibility === 'group' ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}><Users size={16} /><span>Group</span></button>
                    </div>
                </div>
            </div>
          ) : (
            <div className="space-y-6">
                <div className="bg-gradient-to-r from-indigo-900/30 to-purple-900/30 p-3 rounded-lg border border-indigo-500/30 flex items-center justify-between">
                   <div className="flex items-center space-x-2">
                      <Sparkles size={16} className="text-indigo-400" />
                      <span className="text-xs text-indigo-200">{isAIProcessing ? "Designing..." : "Voice Command"}</span>
                   </div>
                   <button onClick={() => startListening('curriculum')} disabled={isAIProcessing} className={`p-2 rounded-full transition-all ${activeVoiceField === 'curriculum' ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>{activeVoiceField === 'curriculum' ? <MicOff size={16}/> : <Mic size={16}/>}</button>
                </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-slate-800 bg-slate-900 shrink-0 flex items-center justify-end space-x-3">
             <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
             <button onClick={handleSave} disabled={isSaving} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg shadow-lg flex items-center space-x-2 transition-all">
               {isSaving && <Loader2 size={14} className="animate-spin" />}
               <span>Save Changes</span>
             </button>
        </div>
      </div>
    </div>
  );
};
