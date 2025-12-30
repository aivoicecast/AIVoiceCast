
import React, { useState, useEffect } from 'react';
import { Channel, Group, Chapter } from '../types';
import { X, Podcast, Sparkles, Lock, Globe, Users, FileText, Loader2, Clipboard, Crown, Calendar } from 'lucide-react';
import { getUserGroups, getUserProfile } from '../services/firestoreService';
import { generateChannelFromDocument } from '../services/channelGenerator';
import { auth } from '../services/firebaseConfig';

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
  const [voice, setVoice] = useState('Puck');
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

  const currentUser = auth.currentUser;

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
      // Format as YYYY-MM-DD in local time
      const dateToUse = initialDate || new Date();
      const localIso = dateToUse.toLocaleDateString('en-CA'); // YYYY-MM-DD format
      setReleaseDate(localIso);
      
      // Check Membership
      getUserProfile(currentUser.uid).then(profile => {
          const pro = profile?.subscriptionTier === 'pro';
          setIsPro(pro);
          // If pro, default to private for convenience
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
    
    // Generate an image URL that reflects the user's content
    const imagePrompt = encodeURIComponent(`${title} ${description} digital art masterpiece`);
    
    // Calculate timestamp from releaseDate input (local time -> timestamp)
    // We construct the date using local year/month/day to ensure it lands on the correct day in Calendar
    const [year, month, day] = releaseDate.split('-').map(Number);
    const targetDate = new Date(year, month - 1, day); // Month is 0-indexed
    const now = new Date();
    // Preserve current time of day
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
      chapters: importedChapters // Include imported curriculum
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
        setActiveTab('manual'); // Switch back to form to review/save
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

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setScriptText(text);
    } catch(e) {}
  };

  if (!currentUser) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 text-center shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-2">Login Required</h2>
          <p className="text-slate-400 mb-6">You must be signed in to create and publish podcasts.</p>
          <button onClick={onClose} className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900 shrink-0">
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Sparkles className="text-indigo-400 w-5 h-5" />
            <span>Launch New Podcast</span>
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 shrink-0">
            <button 
                onClick={() => setActiveTab('manual')}
                className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'manual' ? 'bg-slate-800 text-white border-b-2 border-indigo-500' : 'text-slate-500 hover:text-white'}`}
            >
                Manual Setup
            </button>
            <button 
                onClick={() => setActiveTab('import')}
                className={`flex-1 py-3 text-sm font-bold transition-colors flex items-center justify-center space-x-2 ${activeTab === 'import' ? 'bg-slate-800 text-white border-b-2 border-indigo-500' : 'text-slate-500 hover:text-white'}`}
            >
                <FileText size={14} />
                <span>Import from Script</span>
            </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {activeTab === 'manual' ? (
            <form id="create-channel-form" onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Podcast Title</label>
                <input 
                  required
                  type="text" 
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  placeholder="e.g., Quantum Physics Daily"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              
              <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-400 mb-1 flex items-center gap-2"><Calendar size={14}/> Release Date</label>
                    <input 
                        type="date"
                        required
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={releaseDate}
                        onChange={(e) => setReleaseDate(e.target.value)}
                    />
                  </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Description</label>
                <textarea 
                  required
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all resize-none"
                  placeholder="What is this podcast about?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {importedChapters.length > 0 && (
                  <div className="bg-emerald-900/20 border border-emerald-900/50 p-3 rounded-lg flex items-center gap-2 text-xs text-emerald-400 font-bold">
                      <FileText size={14} />
                      <span>{importedChapters.length} Chapters imported from script.</span>
                  </div>
              )}

              {/* Visibility Section */}
              <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 space-y-3">
                <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Visibility & Sharing</label>
                    {!isPro && <span className="text-[10px] text-amber-400 flex items-center gap-1"><Crown size={10}/> Upgrade for Private</span>}
                </div>
                
                <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!isPro}
                      onClick={() => setVisibility('private')}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center space-x-2 border transition-all ${visibility === 'private' ? 'bg-indigo-600 border-indigo-500 text-white' : !isPro ? 'bg-slate-900/50 border-slate-800 text-slate-600 cursor-not-allowed' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                    >
                      {isPro ? <Lock size={14} /> : <Lock size={14} />}
                      <span>Private</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisibility('public')}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center space-x-2 border transition-all ${visibility === 'public' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                    >
                      <Globe size={14} />
                      <span>Public</span>
                    </button>
                    <button
                      type="button"
                      disabled={!isPro}
                      onClick={() => setVisibility('group')}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center space-x-2 border transition-all ${visibility === 'group' ? 'bg-purple-600 border-purple-500 text-white' : !isPro ? 'bg-slate-900/50 border-slate-800 text-slate-600 cursor-not-allowed' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                    >
                      {isPro ? <Users size={14} /> : <Users size={14} />}
                      <span>Group</span>
                    </button>
                </div>
                
                {visibility === 'group' && (
                    <div className="animate-fade-in mt-2">
                      {loadingGroups ? (
                        <p className="text-xs text-slate-500">Loading groups...</p>
                      ) : userGroups.length > 0 ? (
                        <select 
                            value={selectedGroupId} 
                            onChange={e => setSelectedGroupId(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                        >
                            {userGroups.map(g => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                        </select>
                      ) : (
                        <p className="text-xs text-red-400">You are not a member of any groups.</p>
                      )}
                    </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  AI Persona Instruction
                  <span className="text-xs text-slate-500 ml-2">(System Prompt)</span>
                </label>
                <textarea 
                  required
                  rows={4}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all resize-none"
                  placeholder="You are a friendly expert in..."
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Voice Personality</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setVoice(v)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                        voice === v 
                          ? 'bg-indigo-600 border-indigo-500 text-white' 
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </form>
          ) : (
            <div className="space-y-4 h-full flex flex-col">
                <div className="flex justify-between items-center">
                    <p className="text-sm text-slate-400">Paste your lecture notes, transcript, or document below.</p>
                    <button onClick={handlePaste} className="flex items-center gap-1 text-xs text-indigo-400 hover:text-white">
                        <Clipboard size={12}/> Paste
                    </button>
                </div>
                <textarea 
                    className="flex-1 w-full bg-slate-800 border border-slate-700 rounded-lg p-4 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                    placeholder="Chapter 1: The Beginning..."
                    value={scriptText}
                    onChange={(e) => setScriptText(e.target.value)}
                />
                <button 
                    onClick={handleImportScript}
                    disabled={isProcessing || !scriptText.trim()}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2"
                >
                    {isProcessing ? <Loader2 size={18} className="animate-spin"/> : <Sparkles size={18}/>}
                    <span>Analyze & Create Structure</span>
                </button>
            </div>
          )}
        </div>

        {activeTab === 'manual' && (
            <div className="p-6 pt-0 shrink-0">
                <button 
                type="submit" 
                form="create-channel-form"
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3 rounded-lg shadow-lg transform transition hover:-translate-y-0.5"
                >
                Create & Publish
                </button>
            </div>
        )}
      </div>
    </div>
  );
};
