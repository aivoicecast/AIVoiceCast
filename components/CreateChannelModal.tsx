
import React, { useState, useEffect } from 'react';
import { Channel, Group, Chapter } from '../types';
// Fixed: ShieldSearch does not exist in lucide-react, replaced with SearchCheck
import { X, Podcast, Sparkles, Lock, Globe, Users, FileText, Loader2, Crown, Calendar, Star, Zap, Cpu, Link as LinkIcon, Globe2, AlertCircle, CheckCircle, SearchCheck, BarChart3, SearchCode } from 'lucide-react';
import { getUserGroups, getUserProfile } from '../services/firestoreService';
import { generateChannelFromDocument } from '../services/channelGenerator';
import { auth } from '../services/firebaseConfig';
import { getCurrentUser } from '../services/authService';
import { VOICES, SPECIALIZED_VOICES } from '../utils/initialData';

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (channel: Channel) => void;
  initialDate?: Date | null;
  currentUser?: any;
}

export const CreateChannelModal: React.FC<CreateChannelModalProps> = ({ isOpen, onClose, onCreate, initialDate, currentUser: propUser }) => {
  const [activeTab, setActiveTab] = useState<'manual' | 'import' | 'url'>('manual');
  
  // Manual Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instruction, setInstruction] = useState('');
  const [voice, setVoice] = useState('Default Gem');
  const [releaseDate, setReleaseDate] = useState<string>(''); 
  
  // Import State
  const [scriptText, setScriptText] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importedChapters, setImportedChapters] = useState<Chapter[]>([]);
  const [enableAudit, setEnableAudit] = useState(false);
  
  // Visibility State
  const [visibility, setVisibility] = useState<'private' | 'public' | 'group'>('private');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  
  // Membership State
  const [isPro, setIsPro] = useState(false);

  const effectiveUser = propUser || auth?.currentUser || getCurrentUser();

  useEffect(() => {
    if (isOpen && effectiveUser) {
      setTitle('');
      setDescription('');
      setInstruction('');
      setScriptText('');
      setImportUrl('');
      setImportedChapters([]);
      setActiveTab('manual');
      setVisibility('public'); 
      setEnableAudit(false);
      
      const dateToUse = initialDate || new Date();
      const localIso = dateToUse.toLocaleDateString('en-CA');
      setReleaseDate(localIso);
      
      getUserProfile(effectiveUser.uid).then(profile => {
          const pro = profile?.subscriptionTier === 'pro';
          setIsPro(pro);
          if (pro) setVisibility('private');
      });
    }
  }, [isOpen, effectiveUser, initialDate]);

  useEffect(() => {
    if (isOpen && effectiveUser && visibility === 'group') {
      setLoadingGroups(true);
      getUserGroups(effectiveUser.uid).then(groups => {
        setUserGroups(groups);
        if (groups.length > 0) setSelectedGroupId(groups[0].id);
        setLoadingGroups(false);
      });
    }
  }, [isOpen, visibility, effectiveUser]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const channelId = crypto.randomUUID();
    
    const [year, month, day] = releaseDate.split('-').map(Number);
    const targetDate = new Date(year, month - 1, day);
    const now = new Date();
    targetDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
    
    const newChannel: Channel = {
      id: channelId,
      title,
      description,
      author: effectiveUser?.displayName || 'Anonymous User',
      ownerId: effectiveUser?.uid,
      visibility: visibility,
      groupId: visibility === 'group' ? selectedGroupId : undefined,
      voiceName: voice,
      systemInstruction: instruction,
      likes: 0,
      dislikes: 0,
      comments: [],
      tags: ['Community', 'AI'],
      imageUrl: '', 
      createdAt: targetDate.getTime(),
      chapters: importedChapters 
    };
    onCreate(newChannel);
    onClose();
  };

  const handleImport = async (useUrl: boolean = false) => {
    if (useUrl && !importUrl.trim()) return;
    if (!useUrl && !scriptText.trim()) return;

    setIsProcessing(true);
    try {
      const generated = await generateChannelFromDocument(
          useUrl ? { url: importUrl } : { text: scriptText }, 
          effectiveUser, 
          'en',
          enableAudit
      );
      if (generated) {
        setTitle(generated.title);
        setDescription(generated.description);
        setInstruction(generated.systemInstruction);
        setVoice(generated.voiceName);
        setImportedChapters(generated.chapters || []);
        
        if (enableAudit && generated.sourceAudit) {
            // Pre-fill generated audit if it came back
            alert(`Neural Audit Complete! Source quality score: ${generated.sourceAudit.StructuralCoherenceScore}%. Review your new channel details.`);
        } else {
            alert("Source refracted successfully! Review your new channel details.");
        }
        
        setActiveTab('manual');
      } else {
        alert("Neural refraction failed. Ensure the source is accessible.");
      }
    } catch (e: any) {
      console.error(e);
      alert("Error processing source.");
    } finally {
      setIsProcessing(false);
    }
  };

  const isSpecializedVoice = (v: string) => {
      return SPECIALIZED_VOICES.some(name => v.includes(name));
  };

  if (!effectiveUser) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 text-center shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-2">Login Required</h2>
          <p className="text-slate-400 mb-6">You must be signed in to create and publish podcasts.</p>
          <button onClick={onClose} className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900 shrink-0">
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Sparkles className="text-indigo-400 w-5 h-5" />
            <span>Refract Source to Channel</span>
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={24} /></button>
        </div>

        <div className="flex border-b border-slate-800 shrink-0">
            <button onClick={() => setActiveTab('manual')} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'manual' ? 'bg-slate-800 text-white border-b-2 border-indigo-500 shadow-inner' : 'text-slate-500 hover:text-white'}`}>Manual</button>
            <button onClick={() => setActiveTab('url')} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'url' ? 'bg-slate-800 text-indigo-400 border-b-2 border-indigo-500 shadow-inner' : 'text-slate-500 hover:text-white'}`}><Globe2 size={14}/> URL Import</button>
            <button onClick={() => setActiveTab('import')} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'import' ? 'bg-slate-800 text-white border-b-2 border-indigo-500 shadow-inner' : 'text-slate-500 hover:text-white'}`}><FileText size={14} /> Text/Script</button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 scrollbar-hide">
          {activeTab === 'manual' ? (
            <form id="create-channel-form" onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 px-1">Podcast Title</label>
                <input required type="text" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g., Quantum Physics Daily" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 px-1 flex items-center gap-2"><Calendar size={12}/> Release Date</label>
                    <input type="date" required className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} />
                  </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 px-1">Description</label>
                <textarea required rows={3} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none shadow-inner" placeholder="What is this podcast about?" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-inner">
                <div className="flex justify-between items-center">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Visibility Spectrum</label>
                    {!isPro && <span className="text-[9px] text-amber-400 font-bold flex items-center gap-1 uppercase tracking-tighter"><Crown size={10}/> Pro Only</span>}
                </div>
                <div className="flex gap-2">
                    <button type="button" disabled={!isPro} onClick={() => setVisibility('private')} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase flex items-center justify-center space-x-2 border transition-all ${visibility === 'private' ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : !isPro ? 'bg-slate-900 border-slate-800 text-slate-700 cursor-not-allowed opacity-40' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}><Lock size={12} /><span>Private</span></button>
                    <button type="button" onClick={() => setVisibility('public')} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase flex items-center justify-center space-x-2 border transition-all ${visibility === 'public' ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}><Globe size={12} /><span>Public</span></button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 px-1">AI Instruction Shell</label>
                <textarea required rows={4} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono text-xs focus:ring-2 focus:ring-indigo-500 outline-none resize-none shadow-inner leading-relaxed" placeholder="You are a friendly expert in..." value={instruction} onChange={(e) => setInstruction(e.target.value)} />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 px-1 flex items-center gap-2"><Cpu size={14} className="text-indigo-400" /> Neural Persona Models</label>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-2">
                    {VOICES.filter(isSpecializedVoice).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setVoice(v)}
                        className={`relative px-4 py-3 rounded-2xl text-left transition-all border flex items-center justify-between group ${
                          voice === v 
                            ? 'bg-indigo-600 border-indigo-400 text-white shadow-xl ring-4 ring-indigo-500/10 scale-[1.02]' 
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-indigo-500/30'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl ${voice === v ? 'bg-indigo-500' : 'bg-slate-900'}`}>
                            <Zap size={14} fill={voice === v ? 'currentColor' : 'none'} className={voice === v ? 'text-white' : 'text-indigo-500'} />
                          </div>
                          <div>
                            <span className="text-xs font-black uppercase tracking-wider block">{v.split(' gen-')[0]}</span>
                            <span className="text-[9px] opacity-60 font-mono">{v.includes('gen-') ? v.split('Voice ')[1] : 'Neural Standard'}</span>
                          </div>
                        </div>
                        {voice === v && <div className="p-1 bg-white/20 rounded-full"><CheckCircle size={14} fill="white" className="text-indigo-600"/></div>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </form>
          ) : (
            <div className="space-y-6 h-full flex flex-col justify-start animate-fade-in">
                {activeTab === 'url' ? (
                   <div className="space-y-6 text-center py-4">
                        <div className="w-20 h-20 bg-indigo-600/10 rounded-3xl flex items-center justify-center mx-auto border border-indigo-500/20">
                            <Globe2 size={40} className="text-indigo-400" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Direct URI Ingestion</h3>
                            <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">Paste a publicly accessible PDF or documentation URL.</p>
                        </div>
                        <div className="relative group">
                            <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400" size={18}/>
                            <input 
                                type="url" 
                                value={importUrl}
                                onChange={e => setImportUrl(e.target.value)}
                                placeholder="https://example.com/whitepaper.pdf"
                                className="w-full bg-slate-950 border border-slate-700 rounded-2xl pl-12 pr-6 py-4 text-sm text-indigo-300 outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                            />
                        </div>
                   </div>
                ) : (
                   <div className="flex-1 flex flex-col gap-4">
                       <textarea className="flex-1 w-full bg-slate-800 border border-slate-700 rounded-2xl p-5 text-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none shadow-inner leading-relaxed min-h-[200px]" placeholder="Chapter 1: The Beginning..." value={scriptText} onChange={(e) => setScriptText(e.target.value)} />
                   </div>
                )}

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${enableAudit ? 'bg-indigo-600 shadow-lg' : 'bg-slate-800'} text-white transition-all`}>
                                <SearchCode size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-white uppercase tracking-widest">Neural Quality Audit</p>
                                <p className="text-[8px] text-slate-500 uppercase font-black">Score technical rigor & structural coherence</p>
                            </div>
                        </div>
                        <button 
                            type="button"
                            onClick={() => setEnableAudit(!enableAudit)}
                            className={`w-12 h-6 rounded-full relative transition-all ${enableAudit ? 'bg-indigo-600' : 'bg-slate-700'}`}
                        >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${enableAudit ? 'right-1' : 'left-1'}`}></div>
                        </button>
                    </div>
                    {enableAudit && (
                        <div className="p-3 bg-indigo-900/10 border border-indigo-500/10 rounded-xl text-[9px] text-indigo-400 font-bold uppercase tracking-widest flex items-start gap-2 animate-fade-in">
                            {/* Fixed: Replaced non-existent ShieldSearch with SearchCheck */}
                            <SearchCheck size={14} className="shrink-0"/>
                            <p>High-Intensity Scan: Gemini 3 Pro will evaluate technical parity and generate an adversarial logic mesh for this source.</p>
                        </div>
                    )}
                </div>

                <button 
                    onClick={() => handleImport(activeTab === 'url')} 
                    disabled={isProcessing || (activeTab === 'url' ? !importUrl.trim() : !scriptText.trim())} 
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black uppercase tracking-widest rounded-2xl shadow-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-indigo-900/40"
                >
                    {isProcessing ? <Loader2 size={18} className="animate-spin"/> : <Sparkles size={18}/>}
                    <span>{enableAudit ? 'Ingest & Audit Source' : 'Ingest & Refract URI'}</span>
                </button>
            </div>
          )}
        </div>

        {activeTab === 'manual' && (
            <div className="p-6 pt-0 shrink-0">
                <button type="submit" form="create-channel-form" className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black uppercase tracking-[0.2em] py-4 rounded-2xl shadow-2xl transform transition hover:-translate-y-0.5 active:scale-95 shadow-indigo-900/30">Launch Spectrum Activity</button>
            </div>
        )}
      </div>
    </div>
  );
};
