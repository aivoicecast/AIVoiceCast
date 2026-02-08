
import React, { useState, useEffect, useRef } from 'react';
import { Channel, Group, Chapter, SubTopic } from '../types';
import { getUserGroups, publishChannelToFirestore, deductCoins, AI_COSTS, incrementApiUsage } from '../services/firestoreService';
import { auth } from '../services/firebaseConfig';
import { modifyCurriculumWithAI, generateChannelFromDocument } from '../services/channelGenerator';
import { generateCurriculum } from '../services/curriculumGenerator';
import { generateLectureScript, summarizeLectureForContext } from '../services/lectureGenerator';
import { X, Lock, Globe, Users, Save, Loader2, Trash2, BookOpen, Plus, LayoutList, Mic, MicOff, Sparkles, Star, Podcast, RefreshCw, Zap, Activity, FileText, Database } from 'lucide-react';
import { VOICES } from '../utils/initialData';
import { logger } from '../services/logger';

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
  
  // Advanced Batch States
  const [isRegeneratingIndex, setIsRegeneratingIndex] = useState(false);
  const [isSynthesizingFull, setIsSynthesizingFull] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  const recognitionRef = useRef<any>(null);
  const currentUser = auth?.currentUser;

  const dispatchLog = (text: string, type: any = 'info', meta?: any) => {
      logger[type as keyof typeof logger](text, { category: 'REGISTRY_ADMIN', ...meta });
  };

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
      dispatchLog(`Requesting curriculum mutation via voice prompt...`, 'info');
      const newChapters = await modifyCurriculumWithAI(chapters, prompt, 'en');
      if (newChapters) {
          setChapters(newChapters);
          dispatchLog(`Curriculum layout modified via neural prompt.`, 'success');
      }
      else dispatchLog("Core refused curriculum modification.", 'error');
      setIsAIProcessing(false);
  };

  const handleRegenerateIndexOnly = async () => {
      if (isRegeneratingIndex) return;
      setIsRegeneratingIndex(true);
      dispatchLog(`Initiating Index-Only Refraction for "${title}"...`, 'info');
      try {
          const newChapters = await generateCurriculum(title, description, 'en');
          if (newChapters) {
              setChapters(newChapters);
              dispatchLog(`Curriculum Index synthesized: ${newChapters.length} chapters created.`, 'success');
          } else {
              throw new Error("Core refused index generation.");
          }
      } catch (e: any) {
          dispatchLog(`Index Fault: ${e.message}`, 'error');
      } finally {
          setIsRegeneratingIndex(false);
      }
  };

  const handleSynthesizeFullCorpus = async () => {
    if (isSynthesizingFull) return;
    setIsSynthesizingFull(true);
    dispatchLog(`STARTING FULL-INTENSITY BATCH SYNTHESIS...`, 'warn');
    
    try {
        let currentChapters = chapters;
        if (chapters.length === 0) {
            dispatchLog("Registry empty. Synthesizing initial index shards...", 'info');
            const fresh = await generateCurriculum(title, description, 'en');
            if (!fresh) throw new Error("Could not initialize index.");
            currentChapters = fresh;
            setChapters(fresh);
        }

        const flatTopics = currentChapters.flatMap(c => c.subTopics);
        setBatchProgress({ current: 0, total: flatTopics.length });
        dispatchLog(`DISCOVERY: ${flatTopics.length} logic nodes identified for sequential refraction.`, 'info');

        // MULTI-PHASE CUMULATIVE CONTEXT LOGIC
        let cumulativeKnowledgeSummary = "";

        for (let i = 0; i < flatTopics.length; i++) {
            const topic = flatTopics[i];
            setBatchProgress(prev => ({ ...prev, current: i + 1 }));
            dispatchLog(`[NODE ${i + 1}/${flatTopics.length}] Refracting [${topic.title}]...`, 'info');
            
            const lecture = await generateLectureScript(
                topic.title, 
                description, 
                'en', 
                channel.id, 
                voice, 
                true, // Force refresh to ensure full coverage
                undefined,
                cumulativeKnowledgeSummary // Pass the "knowledge so far"
            );

            if (lecture) {
                // Update cumulative summary to prevent duplication in next node
                const nodeSummary = await summarizeLectureForContext(lecture);
                cumulativeKnowledgeSummary += `\n- Node ${i+1} [${topic.title}] Summary: ${nodeSummary}`;
                
                dispatchLog(`NODE ${i + 1} SECURED. Logic integrity: ${lecture.audit?.coherenceScore || '??'}%`, 'success', {
                    inputSizeBytes: new TextEncoder().encode(cumulativeKnowledgeSummary).length,
                    outputSizeBytes: new TextEncoder().encode(nodeSummary).length
                });
            } else {
                dispatchLog(`NODE ${i + 1} CRITICAL FAULT: Core timeout. Continuing...`, 'error');
            }

            // Neural Throttle to prevent API congestion
            await new Promise(r => setTimeout(r, 1200));
        }

        dispatchLog("FINAL HANDSHAKE: Full Corpus synthesized and deduplicated.", 'success');
        alert("Full Corpus Synthesis Complete. Context was carried across all nodes to ensure unique technical depth.");
    } catch (e: any) {
        dispatchLog(`Corpus Synthesis Interrupted: ${e.message}`, 'error');
    } finally {
        setIsSynthesizingFull(false);
        setBatchProgress({ current: 0, total: 0 });
    }
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setIsSaving(true);
    const updatedChannel: Channel = { ...channel, title, description, visibility, voiceName: voice, groupId: visibility === 'group' ? selectedGroupId : undefined, chapters: chapters };
    await onUpdate(updatedChannel);
    setIsSaving(false);
    onClose();
  };

  if (!isOpen) return null;

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

        <div className="p-6 overflow-y-auto flex-1 scrollbar-hide">
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
                                  {voice === v ? <Star size={12} className="text-amber-300" fill="currentColor" /> : <Podcast size={12} className="opacity-50" />}
                                  <span className="truncate">{v.split(' gen-')[0]}</span>
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
            <div className="space-y-8 animate-fade-in">
                <div className="bg-gradient-to-r from-indigo-900/30 to-purple-900/30 p-4 rounded-xl border border-indigo-500/30 flex items-center justify-between">
                   <div className="flex items-center space-x-3">
                      <Sparkles size={20} className="text-indigo-400" />
                      <div>
                        <p className="text-xs font-black text-indigo-200 uppercase tracking-widest">{isAIProcessing ? "Designing..." : "Voice Modulator"}</p>
                        <p className="text-[10px] text-indigo-400/60 uppercase">Refract curriculum via neural speech</p>
                      </div>
                   </div>
                   <button onClick={() => startListening('curriculum')} disabled={isAIProcessing} className={`p-3 rounded-xl transition-all ${activeVoiceField === 'curriculum' ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>{activeVoiceField === 'curriculum' ? <MicOff size={20}/> : <Mic size={20}/>}</button>
                </div>

                <div className="space-y-6">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                            <Database size={16} className="text-indigo-400"/> Refraction Maintenance
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-inner relative overflow-hidden group">
                            <div className="flex items-start justify-between relative z-10">
                                <div className="space-y-1">
                                    <h4 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-tight">
                                        <LayoutList size={16} className="text-indigo-400"/> Re-index Outline
                                    </h4>
                                    <p className="text-[10px] text-slate-500 leading-relaxed font-medium uppercase italic">
                                        Regenerates chapters and lesson headers only.
                                    </p>
                                </div>
                                <button 
                                    onClick={handleRegenerateIndexOnly} 
                                    disabled={isRegeneratingIndex || isAIProcessing}
                                    className="p-3 bg-slate-900 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-xl transition-all shadow-lg active:scale-95 border border-white/5 disabled:opacity-30"
                                >
                                    {isRegeneratingIndex ? <Loader2 size={18} className="animate-spin"/> : <RefreshCw size={18}/>}
                                </button>
                            </div>
                        </div>

                        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-inner relative overflow-hidden group">
                            <div className="flex items-start justify-between relative z-10">
                                <div className="space-y-1">
                                    <h4 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-tight">
                                        <Zap size={16} className="text-amber-400"/> Deep Corpus Synthesis
                                    </h4>
                                    <p className="text-[10px] text-slate-500 leading-relaxed font-medium uppercase italic">
                                        Sequential refraction with rolling summary memory. Prevents logical redundancy.
                                    </p>
                                </div>
                                <button 
                                    onClick={handleSynthesizeFullCorpus} 
                                    disabled={isSynthesizingFull || isAIProcessing}
                                    className="p-3 bg-slate-900 hover:bg-amber-600 text-amber-400 hover:text-white rounded-xl transition-all shadow-lg active:scale-95 border border-white/5 disabled:opacity-30"
                                >
                                    {isSynthesizingFull ? <Loader2 size={18} className="animate-spin"/> : <Sparkles size={18}/>}
                                </button>
                            </div>

                            {isSynthesizingFull && (
                                <div className="space-y-3 animate-fade-in-up">
                                    <div className="flex justify-between items-center text-[9px] font-black uppercase text-indigo-400 px-1">
                                        <span>Node Synchronization: {batchProgress.current} / {batchProgress.total}</span>
                                        <span className="font-mono">{Math.round((batchProgress.current / (batchProgress.total || 1)) * 100)}%</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden shadow-inner">
                                        <div className="h-full bg-indigo-600 transition-all duration-700" style={{ width: `${(batchProgress.current / (batchProgress.total || 1)) * 100}%` }}></div>
                                    </div>
                                    <p className="text-[8px] text-slate-600 text-center uppercase font-bold tracking-widest animate-pulse">Building rolling context summary...</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-slate-800 bg-slate-900 shrink-0 flex items-center justify-end space-x-3">
             <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors font-bold">Cancel</button>
             <button onClick={handleSave} disabled={isSaving || isRegeneratingIndex || isSynthesizingFull} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-50 text-white text-sm font-black uppercase tracking-widest rounded-lg shadow-lg flex items-center space-x-2 transition-all">
               {isSaving && <Loader2 size={14} className="animate-spin" />}
               <span>Save Changes</span>
             </button>
        </div>
      </div>
    </div>
  );
};

export default ChannelSettingsModal;
