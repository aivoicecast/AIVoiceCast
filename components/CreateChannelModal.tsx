
import React, { useState, useEffect } from 'react';
import { Channel, Group, Chapter } from '../types';
import { X, Podcast, Sparkles, Lock, Globe, Users, FileText, Loader2, Clipboard, Crown, Calendar, Star } from 'lucide-react';
import { getUserGroups, getUserProfile } from '../services/firestoreService';
import { generateChannelFromDocument } from '../services/channelGenerator';
import { auth } from '../services/firebaseConfig';
import { VOICES } from '../utils/initialData';

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (channel: Channel) => void;
  initialDate?: Date | null;
}

export const CreateChannelModal: React.FC<CreateChannelModalProps> = ({ isOpen, onClose, onCreate, initialDate }) => {
  const [activeTab, setActiveTab] = useState<'manual' | 'import'>('manual');
  
  // Manual Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instruction, setInstruction] = useState('');
  const [voice, setVoice] = useState('Default Gem');
  const [releaseDate, setReleaseDate] = useState<string>(''); // YYYY-MM-DD
  
  // Import State
  const [scriptText, setScriptText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importedChapters, setImportedChapters] = useState<Chapter[]>([]);
  
  // Visibility State
  const [visibility, setVisibility] = useState<'private' | 'public' | 'group'>('private');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  
  // Membership State
  const [isPro, setIsPro] = useState(false);

  const currentUser = auth?.currentUser;

  useEffect(() => {
    if (isOpen && currentUser) {
      // Reset
      setTitle('');
      setDescription('');
      setInstruction('');
      setScriptText('');
      setImportedChapters([]);
      setActiveTab('manual');
      setVisibility('public'); // Default to public for free users
      
      // Set initial date if provided, else today.
      const dateToUse = initialDate || new Date();
      const localIso = dateToUse.toLocaleDateString('en-CA'); // YYYY-MM-DD format
      setReleaseDate(localIso);
      
      // Check Membership
      getUserProfile(currentUser.uid).then(profile => {
          const pro = profile?.subscriptionTier === 'pro';
          setIsPro(pro);
          if (pro) setVisibility('private');
      });
    }
  }, [isOpen, currentUser, initialDate]);

  useEffect(() => {
    if (isOpen && currentUser && visibility === 'group') {
      setLoadingGroups(true);
      getUserGroups(currentUser.uid).then(groups => {
        setUserGroups(groups);
        if (groups.length > 0) setSelectedGroupId(groups[0].id);
        setLoadingGroups(false);
      });
    }
  }, [isOpen, visibility, currentUser]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const channelId = crypto.randomUUID();
    const imagePrompt = encodeURIComponent(`${title} ${description} digital art masterpiece`);
    
    const [year, month, day] = releaseDate.split('-').map(Number);
    const targetDate = new Date(year, month - 1, day);
    const now = new Date();
    targetDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
    
    const newChannel: Channel = {
      id: channelId,
      title,
      description,
      author: currentUser?.displayName || 'Anonymous User',
      ownerId: currentUser?.uid,
      visibility: visibility,
      groupId: visibility === 'group' ? selectedGroupId : undefined,
      voiceName: voice,
      systemInstruction: instruction,
      likes: 0,
      dislikes: 0,
      comments: [],
      tags: ['Community', 'AI'],
      imageUrl: `https://image.pollinations.ai/prompt/${imagePrompt}?width=600&height=400&nologo=true`,
      createdAt: targetDate.getTime(),
      chapters: importedChapters 
    };
    onCreate(newChannel);
    onClose();
  };

  const handleImportScript = async () => {
    if (!scriptText.trim()) return;
    setIsProcessing(true);
    try {
      const generated = await generateChannelFromDocument(scriptText, currentUser, 'en');
      if (generated) {
        setTitle(generated.title);
        setDescription(generated.description);
        setInstruction(generated.systemInstruction);
        setVoice(generated.voiceName);
        setImportedChapters(generated.chapters || []);
        setActiveTab('manual');
        alert("Script parsed successfully! Review details and click 'Create'.");
      } else {
        alert("Failed to parse script.");
      }
    } catch (e) {
      console.error(e);
      alert("Error processing script.");
    } finally {
      setIsProcessing(false);
    }
  };

  const isSpecializedVoice = (v: string) => ['Software Interview Voice', 'Linux Kernel Voice', 'Default Gem'].includes(v);

  if (!currentUser) {
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
            <span>Launch New Podcast</span>
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={24} /></button>
        </div>

        <div className="flex border-b border-slate-800 shrink-0">
            <button onClick={() => setActiveTab('manual')} className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'manual' ? 'bg-slate-800 text-white border-b-2 border-indigo-500' : 'text-slate-500 hover:text-white'}`}>Manual Setup</button>
            <button onClick={() => setActiveTab('import')} className={`flex-1 py-3 text-sm font-bold transition-colors flex items-center justify-center space-x-2 ${activeTab === 'import' ? 'bg-slate-800 text-white border-b-2 border-indigo-500' : 'text-slate-500 hover:text-white'}`}><FileText size={14} /><span>Import from Script</span></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {activeTab === 'manual' ? (
            <form id="create-channel-form" onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Podcast Title</label>
                <input required type="text" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g., Quantum Physics Daily" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-400 mb-1 flex items-center gap-2"><Calendar size={14}/> Release Date</label>
                    <input type="date" required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} />
                  </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Description</label>
                <textarea required rows={3} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none" placeholder="What is this podcast about?" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>

              <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 space-y-3">
                <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Visibility</label>
                    {!isPro && <span className="text-[10px] text-amber-400 flex items-center gap-1"><Crown size={10}/> Upgrade for Private</span>}
                </div>
                <div className="flex gap-2">
                    <button type="button" disabled={!isPro} onClick={() => setVisibility('private')} className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center space-x-2 border transition-all ${visibility === 'private' ? 'bg-indigo-600 border-indigo-500 text-white' : !isPro ? 'bg-slate-900/50 border-slate-800 text-slate-600 cursor-not-allowed' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}><Lock size={14} /><span>Private</span></button>
                    <button type="button" onClick={() => setVisibility('public')} className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center space-x-2 border transition-all ${visibility === 'public' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}><Globe size={14} /><span>Public</span></button>
                    <button type="button" disabled={!isPro} onClick={() => setVisibility('group')} className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center space-x-2 border transition-all ${visibility === 'group' ? 'bg-purple-600 border-purple-500 text-white' : !isPro ? 'bg-slate-900/50 border-slate-800 text-slate-600 cursor-not-allowed' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}><Users size={14} /><span>Group</span></button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">AI Persona Instruction</label>
                <textarea required rows={4} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white font-mono text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none" placeholder="You are a friendly expert in..." value={instruction} onChange={(e) => setInstruction(e.target.value)} />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Voice Personality</label>
                <div className="grid grid-cols-2 gap-2">
                  {VOICES.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setVoice(v)}
                      className={`relative px-3 py-2.5 rounded-xl text-left text-xs font-bold transition-all border flex items-center gap-2 group ${
                        voice === v 
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg ring-2 ring-indigo-500/20' 
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                      }`}
                    >
                      {isSpecializedVoice(v) ? <Star size={14} className={voice === v ? 'text-amber-300' : 'text-indigo-400'} fill={voice === v ? "currentColor" : "none"} /> : <Podcast size={14} className="opacity-50" />}
                      <span className="truncate">{v}</span>
                      {isSpecializedVoice(v) && <span className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 text-[8px] bg-amber-500 text-black px-1.5 rounded-full font-black uppercase tracking-tighter">Pro</span>}
                    </button>
                  ))}
                </div>
              </div>
            </form>
          ) : (
            <div className="space-y-4 h-full flex flex-col">
                <textarea className="flex-1 w-full bg-slate-800 border border-slate-700 rounded-lg p-4 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none" placeholder="Chapter 1: The Beginning..." value={scriptText} onChange={(e) => setScriptText(e.target.value)} />
                <button onClick={handleImportScript} disabled={isProcessing || !scriptText.trim()} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2">
                    {isProcessing ? <Loader2 size={18} className="animate-spin"/> : <Sparkles size={18}/>}
                    <span>Analyze & Create Structure</span>
                </button>
            </div>
          )}
        </div>

        {activeTab === 'manual' && (
            <div className="p-6 pt-0 shrink-0">
                <button type="submit" form="create-channel-form" className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3 rounded-lg shadow-lg transform transition hover:-translate-y-0.5">Create & Publish</button>
            </div>
        )}
      </div>
    </div>
  );
};
