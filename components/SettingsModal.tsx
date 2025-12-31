
import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { X, User, Shield, CreditCard, LogOut, CheckCircle, AlertTriangle, Bell, Lock, Database, Trash2, Edit2, Save, FileText, ExternalLink, Loader2, DollarSign, HelpCircle, ChevronDown, ChevronUp, Github, Heart, Hash, Cpu, Sparkles, Key, Check, ShieldCheck } from 'lucide-react';
import { logUserActivity, getBillingHistory, createStripePortalSession, updateUserProfile } from '../services/firestoreService';
import { signOut } from '../services/authService';
import { clearAudioCache } from '../services/tts';
import { TOPIC_CATEGORIES } from '../utils/initialData';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onUpdateProfile?: (updated: UserProfile) => void;
  onUpgradeClick?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, onClose, user, onUpdateProfile, onUpgradeClick 
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'interests' | 'preferences' | 'billing'>('general');
  const [isProcessingPortal, setIsProcessingPortal] = useState(false);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [defaultRepo, setDefaultRepo] = useState(user.defaultRepoUrl || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [publicProfile, setPublicProfile] = useState(true);
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openai'>(user.preferredAiProvider || 'gemini');
  const [error, setError] = useState<string | null>(null);
  
  // GCP Key State
  const [isGcpValidated, setIsGcpValidated] = useState(false);
  
  // Interests State
  const [selectedInterests, setSelectedInterests] = useState<string[]>(user.interests || []);
  
  // Billing State
  const [billingHistory, setBillingHistory] = useState<any[]>([]);
  const [showPolicy, setShowPolicy] = useState(false);

  useEffect(() => {
    const checkGcpStatus = async () => {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setIsGcpValidated(hasKey);
    };
    if (isOpen) {
        checkGcpStatus();
        setSelectedInterests(user.interests || []);
        setAiProvider(user.preferredAiProvider || 'gemini');
    }
  }, [isOpen, user]);

  useEffect(() => {
      if (activeTab === 'billing' && user.subscriptionTier === 'pro') {
          getBillingHistory(user.uid).then(setBillingHistory);
      }
  }, [activeTab, user]);

  if (!isOpen) return null;

  const handleActivateProAI = async () => {
      await window.aistudio.openSelectKey();
      setIsGcpValidated(true);
      logUserActivity('activate_gcp_pro_key', { uid: user.uid });
  };

  const handleSaveProfile = async () => {
      try {
          await updateUserProfile(user.uid, { 
              displayName: displayName, 
              defaultRepoUrl: defaultRepo,
              interests: selectedInterests,
              preferredAiProvider: aiProvider
          });

          const updatedProfile = { ...user, displayName, defaultRepoUrl: defaultRepo, interests: selectedInterests, preferredAiProvider: aiProvider };
          if (onUpdateProfile) onUpdateProfile(updatedProfile);
          setIsEditingName(false);
          logUserActivity('update_profile', { displayName, defaultRepo, interests: selectedInterests, aiProvider });
          
          if(activeTab === 'interests' || activeTab === 'preferences') alert("Settings saved!");
      } catch(e: any) {
          alert("Failed to save settings: " + e.message);
      }
  };

  const toggleInterest = (topic: string) => {
      if (selectedInterests.includes(topic)) {
          setSelectedInterests(prev => prev.filter(t => t !== topic));
      } else {
          setSelectedInterests(prev => [...prev, topic]);
      }
  };

  const handleClearCache = () => {
      if(confirm("Clear all downloaded audio and local settings?")) {
          clearAudioCache();
          alert("Local cache cleared.");
      }
  };

  const handleLogout = async () => {
      await signOut();
      onClose();
  };

  const currentTier = user.subscriptionTier || 'free';
  const isPaid = currentTier === 'pro';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
        
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950 shrink-0">
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <User className="text-indigo-400 w-5 h-5" />
            <span>Settings</span>
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex border-b border-slate-800 bg-slate-900/50 shrink-0 overflow-x-auto">
            <button onClick={() => setActiveTab('general')} className={`flex-1 py-3 px-4 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'general' ? 'border-indigo-500 text-white bg-slate-800' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>General</button>
            <button onClick={() => setActiveTab('interests')} className={`flex-1 py-3 px-4 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'interests' ? 'border-indigo-500 text-white bg-slate-800' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>Interests</button>
            <button onClick={() => setActiveTab('preferences')} className={`flex-1 py-3 px-4 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'preferences' ? 'border-indigo-500 text-white bg-slate-800' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>Preferences</button>
            <button onClick={() => setActiveTab('billing')} className={`flex-1 py-3 px-4 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'billing' ? 'border-indigo-500 text-white bg-slate-800' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>Billing</button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-slate-900">
            {activeTab === 'general' && (
                <div className="space-y-8">
                    <div className="flex items-start gap-6">
                        <div className="relative group">
                            {user.photoURL ? (
                                <img src={user.photoURL} alt={user.displayName} className="w-20 h-20 rounded-full border-2 border-slate-700 object-cover" />
                            ) : (
                                <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center text-slate-500"><User size={32} /></div>
                            )}
                            <div className="absolute bottom-0 right-0 bg-slate-800 p-1 rounded-full border border-slate-600 text-slate-400 cursor-pointer hover:text-white"><Edit2 size={12} /></div>
                        </div>
                        <div className="flex-1 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Display Name</label>
                                <div className="flex gap-2">
                                    <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} disabled={!isEditingName} className={`flex-1 bg-slate-950 border ${isEditingName ? 'border-indigo-500' : 'border-slate-800'} rounded-lg px-3 py-2 text-white text-sm focus:outline-none`} />
                                    {isEditingName ? <button onClick={handleSaveProfile} className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500"><Save size={16} /></button> : <button onClick={() => setIsEditingName(true)} className="p-2 bg-slate-800 text-slate-400 rounded-lg hover:text-white"><Edit2 size={16} /></button>}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Address</label>
                                <div className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-400 text-sm flex justify-between items-center"><span>{user.email}</span><span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-500">Google Linked</span></div>
                            </div>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 border border-slate-700 transition-colors shadow-sm"><LogOut size={18} /><span>Sign Out</span></button>
                </div>
            )}

            {activeTab === 'preferences' && (
                <div className="space-y-8">
                    {/* Gemini Pro Activation Section */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                            <Sparkles size={16}/> Pro Creative Tools (GCP)
                        </h4>
                        <div className="bg-indigo-900/10 border border-indigo-500/30 rounded-2xl p-6 relative overflow-hidden">
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h5 className="text-lg font-bold text-white mb-1">Validate Pro AI Access</h5>
                                        <p className="text-xs text-slate-400 max-w-sm">Enable Gemini 3 Pro high-fidelity image models and Veo Video generation.</p>
                                    </div>
                                    {isGcpValidated ? (
                                        <div className="bg-emerald-500 text-white p-1.5 rounded-full shadow-lg shadow-emerald-500/20"><Check size={16} strokeWidth={4}/></div>
                                    ) : (
                                        <div className="bg-slate-800 text-slate-500 p-1.5 rounded-full"><Lock size={16}/></div>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800 space-y-3">
                                        <p className="text-[11px] text-slate-400 leading-relaxed">
                                            Professional tools like the <strong>Icon Lab</strong> and <strong>Veo Video</strong> require you to select an API key from a paid Google Cloud project with billing enabled.
                                        </p>
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-400 bg-indigo-900/20 px-2 py-1 rounded inline-flex">
                                            <ShieldCheck size={12}/> Secure local storage: Key remains in your browser session.
                                        </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <button 
                                            onClick={handleActivateProAI}
                                            className={`flex-1 py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] ${isGcpValidated ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20'}`}
                                        >
                                            <Key size={18}/>
                                            <span>{isGcpValidated ? 'Re-Validate Key' : 'Unlock Pro AI Tools'}</span>
                                        </button>
                                        <a 
                                            href="https://ai.google.dev/gemini-api/docs/billing" 
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-slate-700 transition-colors"
                                        >
                                            <HelpCircle size={16}/>
                                            Billing Info
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><Cpu size={16}/> Default AI Model</h4>
                            <button onClick={handleSaveProfile} className="text-xs text-indigo-400 font-bold hover:text-white">Save Changes</button>
                        </div>
                        <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-4 space-y-3">
                            <label className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${aiProvider === 'gemini' ? 'bg-indigo-900/20 border-indigo-500' : 'bg-slate-900/50 border-slate-700 hover:bg-slate-800'}`}>
                                <div className="flex items-center gap-3">
                                    <input type="radio" name="ai_provider" checked={aiProvider === 'gemini'} onChange={() => setAiProvider('gemini')} className="accent-indigo-500" />
                                    <div>
                                        <p className="text-sm font-bold text-white flex items-center gap-2">Google Gemini <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-300">Default</span></p>
                                        <p className="text-xs text-slate-500">Multimodal. Uses platform key for standard tasks.</p>
                                    </div>
                                </div>
                            </label>
                            <label className={`flex items-center justify-between p-3 rounded-lg border transition-all ${!isPaid ? 'opacity-60 cursor-not-allowed bg-slate-900/30 border-slate-800' : 'cursor-pointer'} ${isPaid && aiProvider === 'openai' ? 'bg-emerald-900/20 border-emerald-500' : isPaid ? 'bg-slate-900/50 border-slate-700 hover:bg-slate-800' : ''}`}>
                                <div className="flex items-center gap-3">
                                    <input type="radio" name="ai_provider" checked={aiProvider === 'openai'} onChange={() => isPaid && setAiProvider('openai')} disabled={!isPaid} className="accent-emerald-500" />
                                    <div>
                                        <p className="text-sm font-bold text-white flex items-center gap-2">OpenAI GPT-4o {!isPaid && <span className="text-[10px] bg-amber-900/50 text-amber-400 px-1.5 py-0.5 rounded flex items-center gap-1 border border-amber-500/30"><Lock size={8}/> Pro Member</span>}</p>
                                        <p className="text-xs text-slate-500">Advanced reasoning. Requires membership.</p>
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>
            )}
            
            {activeTab === 'interests' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><Heart className="text-pink-500" /> Your Interests</h3>
                            <p className="text-sm text-slate-400">Select topics to personalize your feed.</p>
                        </div>
                        <button onClick={handleSaveProfile} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg shadow-lg flex items-center gap-2"><Save size={16} /> Save</button>
                    </div>
                    <div className="space-y-6">
                        {Object.keys(TOPIC_CATEGORIES).map(category => (
                            <div key={category} className="bg-slate-800/30 border border-slate-800 rounded-xl p-4">
                                <h4 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2"><Hash size={14} className="text-indigo-400" /> {category}</h4>
                                <div className="flex flex-wrap gap-2">
                                    <button onClick={() => toggleInterest(category)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${selectedInterests.includes(category) ? 'bg-indigo-600 border-indigo-500 text-white shadow-md' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'}`}>{category}</button>
                                    {TOPIC_CATEGORIES[category].map(tag => (
                                        <button key={tag} onClick={() => toggleInterest(tag)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${selectedInterests.includes(tag) ? 'bg-indigo-600 border-indigo-500 text-white shadow-md' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'}`}>{tag}</button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'billing' && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                        <div>
                            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-2"><Shield size={16}/> Current Plan</h4>
                            <div className="flex items-center gap-3">
                                <span className={`text-2xl font-bold ${isPaid ? 'text-amber-400' : 'text-white'}`}>{currentTier === 'pro' ? 'Pro Membership' : 'Free Starter'}</span>
                                {isPaid && <span className="bg-emerald-900/30 text-emerald-400 px-2 py-0.5 rounded text-xs font-bold border border-emerald-500/30">Active</span>}
                            </div>
                        </div>
                        {!isPaid && onUpgradeClick && <button onClick={() => { onClose(); onUpgradeClick(); }} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg transition-colors flex items-center gap-2"><CreditCard size={16} /><span>Upgrade</span></button>}
                    </div>
                    {isPaid && (
                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center text-center space-y-3">
                            <p className="text-sm text-slate-400">Manage invoices or payment methods.</p>
                            <button onClick={async () => { setIsProcessingPortal(true); const url = await createStripePortalSession(user.uid); window.location.assign(url); }} disabled={isProcessingPortal} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 rounded-xl font-bold text-sm flex items-center gap-2 transition-all">{isProcessingPortal ? <Loader2 size={16} className="animate-spin"/> : <CreditCard size={16} />}<span>Manage Billing</span><ExternalLink size={14} className="text-slate-500" /></button>
                        </div>
                    )}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
