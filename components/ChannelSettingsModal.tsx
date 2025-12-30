
import React, { useState, useEffect, useRef } from 'react';
import { Channel, Group, Chapter, SubTopic } from '../types';
import { getUserGroups } from '../services/firestoreService';
import { auth } from '../services/firebaseConfig';
import { modifyCurriculumWithAI } from '../services/channelGenerator';
import { X, Lock, Globe, Users, Save, Loader2, Trash2, BookOpen, Plus, LayoutList, Mic, MicOff, Sparkles } from 'lucide-react';

interface ChannelSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: Channel;
  onUpdate: (updatedChannel: Channel) => void;
  onDelete?: () => void;
}

export const ChannelSettingsModal: React.FC<ChannelSettingsModalProps> = ({ isOpen, onClose, channel, onUpdate, onDelete }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'curriculum'>('general');
  
  // General State
  const [title, setTitle] = useState(channel.title);
  const [description, setDescription] = useState(channel.description);
  const [visibility, setVisibility] = useState<'private' | 'public' | 'group'>(channel.visibility || 'private');
  const [selectedGroupId, setSelectedGroupId] = useState(channel.groupId || '');
  
  // Curriculum State
  const [chapters, setChapters] = useState<Chapter[]>(channel.chapters || []);
  
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Voice & AI State
  const [isListening, setIsListening] = useState(false);
  const [activeVoiceField, setActiveVoiceField] = useState<'title' | 'desc' | 'curriculum' | null>(null);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const recognitionRef = useRef<any>(null);

  const currentUser = auth.currentUser;

  // Load groups when switching to 'group' visibility
  useEffect(() => {
    if (isOpen && currentUser && visibility === 'group') {
      setLoadingGroups(true);
      getUserGroups(currentUser.uid).then(groups => {
        setUserGroups(groups);
        // If user has no current group set for this channel, default to first available
        if (!selectedGroupId && groups.length > 0) {
           setSelectedGroupId(groups[0].id);
        }
        setLoadingGroups(false);
      });
    }
  }, [isOpen, visibility, currentUser, selectedGroupId]);

  // Setup Speech Recognition
  useEffect(() => {
    if (isOpen && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = async (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (activeVoiceField === 'title') {
            setTitle(transcript);
        } else if (activeVoiceField === 'desc') {
            setDescription(prev => prev ? prev + ' ' + transcript : transcript);
        } else if (activeVoiceField === 'curriculum') {
            await handleAIModification(transcript);
        }
        setIsListening(false);
        setActiveVoiceField(null);
      };

      recognitionRef.current.onerror = (e: any) => {
        console.error("Speech error", e);
        setIsListening(false);
        setActiveVoiceField(null);
      };
      
      recognitionRef.current.onend = () => {
         setIsListening(false);
      };
    }
  }, [isOpen, activeVoiceField, chapters]); // Depend on chapters for current state closure in AI handler

  const startListening = (field: 'title' | 'desc' | 'curriculum') => {
    if (isListening) {
        recognitionRef.current?.stop();
        setIsListening(false);
        setActiveVoiceField(null);
    } else {
        setActiveVoiceField(field);
        setIsListening(true);
        recognitionRef.current?.start();
    }
  };

  const handleAIModification = async (prompt: string) => {
      setIsAIProcessing(true);
      const newChapters = await modifyCurriculumWithAI(chapters, prompt, 'en');
      if (newChapters) {
          setChapters(newChapters);
      } else {
          alert("Could not update curriculum. Please try again.");
      }
      setIsAIProcessing(false);
  };

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!title.trim()) return;
    setIsSaving(true);

    const updatedChannel: Channel = {
      ...channel,
      title,
      description,
      visibility,
      groupId: visibility === 'group' ? selectedGroupId : undefined,
      chapters: chapters // Save edited curriculum
    };

    await onUpdate(updatedChannel);
    setIsSaving(false);
    onClose();
  };

  const handleDelete = () => {
      if (confirm("Are you sure you want to delete this podcast? This cannot be undone.")) {
          if (onDelete) onDelete();
          onClose();
      }
  };

  // Curriculum Helpers
  const addChapter = () => {
    const newChapter: Chapter = {
        id: `ch-${Date.now()}`,
        title: `Chapter ${chapters.length + 1}`,
        subTopics: []
    };
    setChapters([...chapters, newChapter]);
  };

  const removeChapter = (idx: number) => {
    if (confirm("Delete this chapter?")) {
        const newChapters = [...chapters];
        newChapters.splice(idx, 1);
        setChapters(newChapters);
    }
  };

  const updateChapterTitle = (idx: number, val: string) => {
    const newChapters = [...chapters];
    newChapters[idx].title = val;
    setChapters(newChapters);
  };

  const addLesson = (chapterIdx: number) => {
    const newChapters = [...chapters];
    const newLesson: SubTopic = {
        id: `sub-${Date.now()}`,
        title: "New Lesson"
    };
    newChapters[chapterIdx].subTopics.push(newLesson);
    setChapters(newChapters);
  };

  const removeLesson = (chapterIdx: number, subIdx: number) => {
    const newChapters = [...chapters];
    newChapters[chapterIdx].subTopics.splice(subIdx, 1);
    setChapters(newChapters);
  };

  const updateLessonTitle = (chapterIdx: number, subIdx: number, val: string) => {
    const newChapters = [...chapters];
    newChapters[chapterIdx].subTopics[subIdx].title = val;
    setChapters(newChapters);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl animate-fade-in-up overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900 shrink-0">
          <h2 className="text-lg font-bold text-white">Channel Settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b border-slate-800 shrink-0">
            <button 
               onClick={() => setActiveTab('general')}
               className={`flex-1 py-3 text-sm font-bold flex items-center justify-center space-x-2 transition-colors ${activeTab === 'general' ? 'bg-slate-800 text-white border-b-2 border-indigo-500' : 'text-slate-500 hover:text-slate-300'}`}
            >
               <LayoutList size={16}/>
               <span>General</span>
            </button>
            <button 
               onClick={() => setActiveTab('curriculum')}
               className={`flex-1 py-3 text-sm font-bold flex items-center justify-center space-x-2 transition-colors ${activeTab === 'curriculum' ? 'bg-slate-800 text-white border-b-2 border-indigo-500' : 'text-slate-500 hover:text-slate-300'}`}
            >
               <BookOpen size={16}/>
               <span>Curriculum</span>
            </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          
          {activeTab === 'general' ? (
            <div className="space-y-6">
                {/* Metadata */}
                <div className="space-y-4">
                    <div>
                        <div className="flex justify-between items-center mb-1">
                           <label className="block text-xs font-bold text-slate-500 uppercase">Title</label>
                           <button 
                              onClick={() => startListening('title')}
                              className={`p-1 rounded-full ${activeVoiceField === 'title' ? 'bg-red-500/20 text-red-400 animate-pulse' : 'hover:bg-slate-800 text-slate-500'}`}
                           >
                              {activeVoiceField === 'title' ? <MicOff size={14}/> : <Mic size={14}/>}
                           </button>
                        </div>
                        <input 
                        type="text" 
                        value={title} 
                        onChange={e => setTitle(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-1">
                           <label className="block text-xs font-bold text-slate-500 uppercase">Description</label>
                           <button 
                              onClick={() => startListening('desc')}
                              className={`p-1 rounded-full ${activeVoiceField === 'desc' ? 'bg-red-500/20 text-red-400 animate-pulse' : 'hover:bg-slate-800 text-slate-500'}`}
                           >
                              {activeVoiceField === 'desc' ? <MicOff size={14}/> : <Mic size={14}/>}
                           </button>
                        </div>
                        <textarea 
                        rows={3}
                        value={description} 
                        onChange={e => setDescription(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                        />
                    </div>
                </div>

                <div className="h-px bg-slate-800 w-full" />

                {/* Sharing Settings */}
                <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-500 uppercase">Sharing & Visibility</label>
                    <div className="grid grid-cols-3 gap-2">
                        <button
                        type="button"
                        onClick={() => setVisibility('private')}
                        className={`py-2 rounded-lg text-xs font-medium flex flex-col items-center justify-center space-y-1 border transition-all ${visibility === 'private' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                        >
                        <Lock size={16} />
                        <span>Private</span>
                        </button>
                        <button
                        type="button"
                        onClick={() => setVisibility('public')}
                        className={`py-2 rounded-lg text-xs font-medium flex flex-col items-center justify-center space-y-1 border transition-all ${visibility === 'public' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                        >
                        <Globe size={16} />
                        <span>Public</span>
                        </button>
                        <button
                        type="button"
                        onClick={() => setVisibility('group')}
                        className={`py-2 rounded-lg text-xs font-medium flex flex-col items-center justify-center space-y-1 border transition-all ${visibility === 'group' ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                        >
                        <Users size={16} />
                        <span>Group</span>
                        </button>
                    </div>
                    
                    {/* Group Selection */}
                    {visibility === 'group' && (
                        <div className="animate-fade-in p-3 bg-slate-800/50 rounded-lg border border-slate-700 mt-2">
                        {loadingGroups ? (
                            <div className="flex items-center space-x-2 text-slate-400">
                                <Loader2 size={14} className="animate-spin" />
                                <span className="text-xs">Loading your groups...</span>
                            </div>
                        ) : userGroups.length > 0 ? (
                            <div>
                                <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Select Group</label>
                                <select 
                                value={selectedGroupId} 
                                onChange={e => setSelectedGroupId(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                >
                                {userGroups.map(g => (
                                    <option key={g.id} value={g.id}>{g.name}</option>
                                ))}
                                </select>
                            </div>
                        ) : (
                            <p className="text-xs text-red-400">You are not in any groups. Please create or join one first.</p>
                        )}
                        </div>
                    )}
                </div>

                <div className="h-px bg-slate-800 w-full" />
                
                {/* Danger Zone */}
                {onDelete && (
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-red-500 uppercase">Danger Zone</label>
                        <button 
                            onClick={handleDelete}
                            className="w-full py-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 hover:border-red-500/50 rounded-lg text-sm font-bold flex items-center justify-center space-x-2 transition-all"
                        >
                            <Trash2 size={16} />
                            <span>Delete Podcast</span>
                        </button>
                    </div>
                )}
            </div>
          ) : (
            <div className="space-y-6">
                {/* AI Voice Command Bar */}
                <div className="bg-gradient-to-r from-indigo-900/30 to-purple-900/30 p-3 rounded-lg border border-indigo-500/30 flex items-center justify-between">
                   <div className="flex items-center space-x-2">
                      <Sparkles size={16} className="text-indigo-400" />
                      <span className="text-xs text-indigo-200">
                         {isAIProcessing ? "Designing curriculum..." : activeVoiceField === 'curriculum' ? "Listening... (e.g., 'Add a chapter on Security')" : "Voice Command"}
                      </span>
                   </div>
                   <button 
                      onClick={() => startListening('curriculum')}
                      disabled={isAIProcessing}
                      className={`p-2 rounded-full transition-all ${
                         activeVoiceField === 'curriculum' 
                         ? 'bg-red-500 text-white animate-pulse' 
                         : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                   >
                      {activeVoiceField === 'curriculum' ? <MicOff size={16}/> : <Mic size={16}/>}
                   </button>
                </div>

                <div className="flex justify-between items-center">
                    <p className="text-sm text-slate-400">Edit your course structure.</p>
                    <button 
                       onClick={addChapter}
                       className="flex items-center space-x-1 px-3 py-1.5 bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 text-xs font-bold rounded-lg transition-colors border border-slate-700"
                    >
                        <Plus size={14} />
                        <span>Add Chapter</span>
                    </button>
                </div>

                {isAIProcessing ? (
                   <div className="py-12 flex flex-col items-center justify-center space-y-2 text-indigo-400">
                      <Loader2 size={32} className="animate-spin" />
                      <span className="text-sm">AI is updating your course...</span>
                   </div>
                ) : (
                    <div className="space-y-4">
                        {chapters.map((chapter, cIdx) => (
                            <div key={chapter.id} className="bg-slate-800/30 border border-slate-700 rounded-lg p-3">
                                {/* Chapter Header */}
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-xs font-mono text-slate-500 whitespace-nowrap">CH {cIdx + 1}</span>
                                    <input 
                                    type="text" 
                                    value={chapter.title}
                                    onChange={(e) => updateChapterTitle(cIdx, e.target.value)}
                                    className="flex-1 bg-transparent border-b border-slate-600 focus:border-indigo-500 outline-none text-sm font-bold text-white px-1"
                                    placeholder="Chapter Title"
                                    />
                                    <button onClick={() => removeChapter(cIdx)} className="text-slate-500 hover:text-red-400"><Trash2 size={16}/></button>
                                </div>

                                {/* Subtopics */}
                                <div className="pl-8 space-y-2">
                                    {chapter.subTopics.map((sub, sIdx) => (
                                        <div key={sub.id} className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-600"></div>
                                            <input 
                                                type="text" 
                                                value={sub.title}
                                                onChange={(e) => updateLessonTitle(cIdx, sIdx, e.target.value)}
                                                className="flex-1 bg-slate-900/50 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 focus:text-white focus:border-indigo-500 outline-none"
                                                placeholder="Lesson Title"
                                            />
                                            <button onClick={() => removeLesson(cIdx, sIdx)} className="text-slate-600 hover:text-red-400"><X size={14}/></button>
                                        </div>
                                    ))}
                                    <button 
                                    onClick={() => addLesson(cIdx)}
                                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 mt-1"
                                    >
                                        <Plus size={12} />
                                        <span>Add Lesson</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                        {chapters.length === 0 && (
                            <div className="text-center py-8 text-slate-500 text-sm italic">
                                No chapters yet. Click "Add Chapter" or use Voice Command to begin.
                            </div>
                        )}
                    </div>
                )}
            </div>
          )}

        </div>

        <div className="p-5 border-t border-slate-800 bg-slate-900 shrink-0 flex items-center justify-end space-x-3">
             <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
               Cancel
             </button>
             <button 
               onClick={handleSave}
               disabled={isSaving || (visibility === 'group' && !selectedGroupId)}
               className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg shadow-lg flex items-center space-x-2 transition-all"
             >
               {isSaving && <Loader2 size={14} className="animate-spin" />}
               <span>Save Changes</span>
             </button>
        </div>

      </div>
    </div>
  );
};
