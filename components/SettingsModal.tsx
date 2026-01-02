
import React, { useState, useEffect, useRef } from 'react';
import { UserProfile } from '../types';
import { X, User, Shield, CreditCard, LogOut, CheckCircle, AlertTriangle, Bell, Lock, Database, Trash2, Edit2, Save, FileText, ExternalLink, Loader2, DollarSign, HelpCircle, ChevronDown, ChevronUp, Github, Heart, Hash, Cpu, Sparkles, MapPin, PenTool } from 'lucide-react';
import { logUserActivity, getBillingHistory, createStripePortalSession, updateUserProfile, uploadFileToStorage } from '../services/firestoreService';
import { signOut } from '../services/authService';
import { clearAudioCache } from '../services/tts';
import { TOPIC_CATEGORIES } from '../utils/initialData';
import { Whiteboard } from './Whiteboard';

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
  const [activeTab, setActiveTab] = useState<'general' | 'interests' | 'preferences' | 'banking' | 'billing'>('general');
  const [isProcessingPortal, setIsProcessingPortal] = useState(false);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [defaultRepo, setDefaultRepo] = useState(user.defaultRepoUrl || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [publicProfile, setPublicProfile] = useState(true);
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openai'>(user.preferredAiProvider || 'gemini');
  const [error, setError] = useState<string | null>(null);
  
  // Banking Profile State
  const [senderAddress, setSenderAddress] = useState(user.senderAddress || '');
  const [showSignPad, setShowSignPad] = useState(false);
  const [signaturePreview, setSignaturePreview] = useState(user.savedSignatureUrl || '');
  const [isSavingBanking, setIsSavingBanking] = useState(false);
  
  // Interests State
  const [selectedInterests, setSelectedInterests] = useState<string[]>(user.interests || []);
  
  // Billing State
  const [billingHistory, setBillingHistory] = useState<any[]>([]);
  const [showPolicy, setShowPolicy] = useState(false);

  useEffect(() => {
      if (activeTab === 'billing' && user.subscriptionTier === 'pro') {
          getBillingHistory(user.uid).then(setBillingHistory);
      }
  }, [activeTab, user]);

  useEffect(() => {
      if (isOpen) {
          setSelectedInterests(user.interests || []);
          setAiProvider(user.preferredAiProvider || 'gemini');
          setSenderAddress(user.senderAddress || '');
          setSignaturePreview(user.savedSignatureUrl || '');
          setDisplayName(user.displayName);
      }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const currentTier = user.subscriptionTier || 'free';
  const isPaid = currentTier === 'pro';

  const handleManageSubscription = async () => {
    setIsProcessingPortal(true);
    setError(null);
    try {
        const url = await createStripePortalSession(user.uid);
        window.location.assign(url);
    } catch (e: any) {
        console.error(e);
        setError("Failed to open portal: " + (e.message || "Unknown error"));
        setIsProcessingPortal(false);
    }
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
          alert("Profile updated!");
      } catch(e: any) {
          alert("Failed to save settings: " + e.message);
      }
  };

  const handleSaveBanking = async () => {
      setIsSavingBanking(true);
      try {
          let finalSigUrl = signaturePreview;
          if (signaturePreview.startsWith('data:')) {
              const res = await fetch(signaturePreview);
              const blob = await res.blob();
              finalSigUrl = await uploadFileToStorage(`users/${user.uid}/signature_profile.png`, blob);
          }

          await updateUserProfile(user.uid, { 
              senderAddress, 
              savedSignatureUrl: finalSigUrl 
          });

          const updatedProfile = { ...user, senderAddress, savedSignatureUrl: finalSigUrl };
          if (onUpdateProfile) onUpdateProfile(updatedProfile);
          setSignaturePreview(finalSigUrl);
          alert("Banking profile saved!");
      } catch(e: any) {
          alert("Save failed: " + e.message);
      } finally {
          setIsSavingBanking(false);
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
            <button onClick={() => setActiveTab('banking')} className={`flex-1 py-3 px-4 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'banking' ? 'border-indigo-500 text-white bg-slate-800' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>Check Profile</button>
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
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><Github size={12}/> Default Git Repository</label>
                                <input type="text" value={defaultRepo} onChange={(e) => setDefaultRepo(e.target.value)} disabled={!isEditingName} placeholder="owner/repo" className={`w-full bg-slate-950 border ${isEditingName ? 'border-indigo-500' : 'border-slate-800'} rounded-lg px-3 py-2 text-white text-sm focus:outline-none`} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'banking' && (
                <div className="space-y-8 animate-fade-in">
                    <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-xl p-4 flex items-start gap-4">
                        <div className="p-2 bg-indigo-600 rounded-lg text-white"><PenTool size={20}/></div>
                        <div>
                            <h3 className="text-sm font-bold text-white">Neural Check Profile</h3>
                            <p className="text-xs text-slate-400">Save your professional details once to generate checks in seconds.</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1"><MapPin size={12} className="text-indigo-400"/> Business/Sender Address</label>
                            <textarea 
                                value={senderAddress}
                                onChange={(e) => setSenderAddress(e.target.value)}
                                placeholder="123 Silicon Way, San Jose, CA 95134"
                                rows={3}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none leading-relaxed"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1"><PenTool size={12} className="text-indigo-400"/> Official Signature</label>
                            {signaturePreview ? (
                                <div className="relative w-full aspect-[3/1] bg-white rounded-xl border border-slate-700 overflow-hidden group">
                                    <img src={signaturePreview} className="w-full h-full object-contain p-4" alt="Saved Signature" />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                        <button onClick={() => setShowSignPad(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-lg">Change Signature</button>
                                        <button onClick={() => setSignaturePreview('')} className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold shadow-lg">Remove</button>
                                    </div>
                                </div>
                            ) : (
                                <button 
                                    onClick={() => setShowSignPad(true)}
                                    className="w-full aspect-[3/1] border-2 border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-600 hover:border-indigo-500 hover:text-indigo-400 transition-all bg-slate-950/50"
                                >
                                    <PenTool size={32} className="opacity-20"/>
                                    <span className="text-xs font-bold uppercase">Register Official Signature</span>
                                </button>
                            )}
                        </div>
                    </div>

                    <button 
                        onClick={handleSaveBanking}
                        disabled={isSavingBanking}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                        {isSavingBanking ? <Loader2 size={18} className="animate-spin"/> : <CheckCircle size={18}/>}
                        <span>Save Check Profile</span>
                    </button>
                </div>
            )}

            {activeTab === 'interests' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><Heart className="text-pink-500" /> Your Interests</h3>
                            <p className="text-sm text-slate-400">Select topics you love to personalize your feed.</p>
                        </div>
                        <button onClick={handleSaveProfile} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg shadow-lg flex items-center gap-2"><Save size={16} /> Save</button>
                    </div>
                    <div className="space-y-6">
                        {Object.keys(TOPIC_CATEGORIES).map(category => (
                            <div key={category} className="bg-slate-800/30 border border-slate-800 rounded-xl p-4">
                                <h4 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2"><Hash size={14} className="text-indigo-400" /> {category}</h4>
                                <div className="flex flex-wrap gap-2">
                                    {TOPIC_CATEGORIES[category].map(tag => (
                                        <button key={tag} onClick={() => toggleInterest(tag)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${selectedInterests.includes(tag) ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}>{tag}</button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'preferences' && (
                <div className="space-y-6">
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><Cpu size={16}/> AI Model API</h4>
                        <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-4 space-y-4">
                            <label className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${aiProvider === 'gemini' ? 'bg-indigo-900/20 border-indigo-500' : 'bg-slate-900/50 border-slate-700'}`}>
                                <div className="flex items-center gap-3">
                                    <input type="radio" checked={aiProvider === 'gemini'} onChange={() => setAiProvider('gemini')} className="accent-indigo-500"/>
                                    <div><p className="text-sm font-bold text-white">Google Gemini</p><p className="text-xs text-slate-500">Fast, reliable, multimodal.</p></div>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>

      {showSignPad && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
              <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl p-6 shadow-2xl animate-fade-in-up">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2"><PenTool size={20} className="text-indigo-400"/> Draw Official Signature</h3>
                      <button onClick={() => setShowSignPad(false)} className="p-2 text-slate-500 hover:text-white"><X/></button>
                  </div>
                  <div className="h-[300px] border-2 border-dashed border-slate-800 rounded-2xl overflow-hidden mb-6 bg-white">
                      <Whiteboard disableAI backgroundColor="transparent" initialColor="#000000" onDataChange={() => {}} onSessionStart={() => {}} />
                  </div>
                  <div className="flex justify-end gap-2">
                      <button onClick={() => setShowSignPad(false)} className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold">Cancel</button>
                      <button 
                        onClick={() => {
                            const canvas = document.querySelector('.fixed canvas') as HTMLCanvasElement;
                            if (canvas) setSignaturePreview(canvas.toDataURL('image/png'));
                            setShowSignPad(false);
                        }} 
                        className="px-8 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-lg"
                      >
                        Confirm
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
