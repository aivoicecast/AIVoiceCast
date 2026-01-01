
import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { X, User, Shield, CreditCard, LogOut, CheckCircle, AlertTriangle, Bell, Lock, Database, Trash2, Edit2, Save, FileText, ExternalLink, Loader2, DollarSign, HelpCircle, ChevronDown, ChevronUp, Github, Heart, Hash, Cpu, Sparkles } from 'lucide-react';
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
  
  // Interests State
  const [selectedInterests, setSelectedInterests] = useState<string[]>(user.interests || []);
  
  // Billing State
  const [billingHistory, setBillingHistory] = useState<any[]>([]);
  const [showPolicy, setShowPolicy] = useState(false);

  useEffect(() => {
      if (activeTab === 'billing' && user.subscriptionTier === 'pro') {
          // Simulate fetch
          getBillingHistory(user.uid).then(setBillingHistory);
      }
  }, [activeTab, user]);

  // Sync initial interests and settings
  useEffect(() => {
      if (isOpen) {
          setSelectedInterests(user.interests || []);
          setAiProvider(user.preferredAiProvider || 'gemini');
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
        let msg = e.message || "Unknown error";
        if (msg.includes("permission-denied")) {
            msg = "Permission Error: Check Firestore Security Rules for 'customers' collection.";
        }
        setError("Failed to open portal: " + msg);
        setIsProcessingPortal(false);
    }
  };

  const handleSaveProfile = async () => {
      try {
          // Persist to Cloud first
          await updateUserProfile(user.uid, { 
              displayName: displayName, 
              defaultRepoUrl: defaultRepo,
              interests: selectedInterests,
              preferredAiProvider: aiProvider
          });

          // Update Local State
          const updatedProfile = { ...user, displayName, defaultRepoUrl: defaultRepo, interests: selectedInterests, preferredAiProvider: aiProvider };
          if (onUpdateProfile) {
              onUpdateProfile(updatedProfile);
          }
          setIsEditingName(false);
          logUserActivity('update_profile', { displayName, defaultRepo, interests: selectedInterests, aiProvider });
          
          if(activeTab === 'interests') alert("Interests saved! Your feed will be updated.");
          if(activeTab === 'preferences') alert("Preferences saved!");
          
      } catch(e: any) {
          console.error("Save failed", e);
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
      if(confirm("Clear all downloaded audio and local settings? This will free up space but require re-downloading content.")) {
          clearAudioCache();
          alert("Local cache cleared.");
      }
  };

  const handleLogout = async () => {
      await signOut();
      onClose();
  };

  const handleDeleteAccount = () => {
      const confirmText = prompt("Type 'DELETE' to confirm account deletion. This action is irreversible.");
      if (confirmText === 'DELETE') {
          alert("Account deletion request submitted. (Mock action)");
      }
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
            <button onClick={() => setActiveTab('general')} className={`flex-1 py-3 px-4 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'general' ? 'border-indigo-500 text-white bg-slate-800' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
                General
            </button>
            <button onClick={() => setActiveTab('interests')} className={`flex-1 py-3 px-4 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'interests' ? 'border-indigo-500 text-white bg-slate-800' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
                Interests
            </button>
            <button onClick={() => setActiveTab('preferences')} className={`flex-1 py-3 px-4 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'preferences' ? 'border-indigo-500 text-white bg-slate-800' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
                Preferences
            </button>
            <button onClick={() => setActiveTab('billing')} className={`flex-1 py-3 px-4 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'billing' ? 'border-indigo-500 text-white bg-slate-800' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
                Billing
            </button>
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
                            
                            {/* Default Repo Setting */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><Github size={12}/> Default Git Repository</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={defaultRepo} 
                                        onChange={(e) => setDefaultRepo(e.target.value)} 
                                        disabled={!isEditingName} 
                                        placeholder="owner/repo (e.g. facebook/react)"
                                        className={`flex-1 bg-slate-950 border ${isEditingName ? 'border-indigo-500' : 'border-slate-800'} rounded-lg px-3 py-2 text-white text-sm focus:outline-none`} 
                                    />
                                </div>
                                <p className="text-[10px] text-slate-500 mt-1">This repository will open automatically when you launch Code Studio.</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="h-px bg-slate-800 w-full" />

                    {/* Sign Out Button */}
                    <div>
                        <button 
                            onClick={handleLogout} 
                            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 border border-slate-700 transition-colors shadow-sm"
                        >
                            <LogOut size={18} />
                            <span>Sign Out</span>
                        </button>
                        <p className="text-center text-[10px] text-slate-500 mt-2">
                            To switch accounts, sign out and then select a different Google account.
                        </p>
                    </div>

                    <div className="h-px bg-slate-800 w-full" />

                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-red-500 uppercase tracking-wider flex items-center gap-2"><AlertTriangle size={16}/> Danger Zone</h4>
                        <div className="bg-red-900/10 border border-red-900/30 rounded-xl p-4 flex items-center justify-between">
                            <div className="text-sm text-red-200"><p className="font-bold">Delete Account</p><p className="text-xs opacity-70">Permanently remove your profile and all data.</p></div>
                            <button onClick={handleDeleteAccount} className="px-4 py-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 rounded-lg text-xs font-bold transition-colors">Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'interests' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><Heart className="text-pink-500" /> Your Interests</h3>
                            <p className="text-sm text-slate-400">Select topics you love. We use these to personalize your podcast feed.</p>
                        </div>
                        <button 
                            onClick={handleSaveProfile}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg shadow-lg flex items-center gap-2"
                        >
                            <Save size={16} /> Save Interests
                        </button>
                    </div>

                    <div className="space-y-6">
                        {Object.keys(TOPIC_CATEGORIES).map(category => (
                            <div key={category} className="bg-slate-800/30 border border-slate-800 rounded-xl p-4">
                                <h4 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                                    <Hash size={14} className="text-indigo-400" /> {category}
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {/* Include the category itself as a tag */}
                                    <button
                                        onClick={() => toggleInterest(category)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${selectedInterests.includes(category) ? 'bg-indigo-600 border-indigo-500 text-white shadow-md' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'}`}
                                    >
                                        {category}
                                    </button>
                                    
                                    {/* Sub-tags */}
                                    {TOPIC_CATEGORIES[category].map(tag => (
                                        <button
                                            key={tag}
                                            onClick={() => toggleInterest(tag)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${selectedInterests.includes(tag) ? 'bg-indigo-600 border-indigo-500 text-white shadow-md' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'}`}
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'preferences' && (
                <div className="space-y-6">
                    {/* AI Provider Section */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><Cpu size={16}/> AI Model API</h4>
                            <button onClick={handleSaveProfile} className="text-xs text-indigo-400 font-bold hover:text-white transition-colors">Save Changes</button>
                        </div>
                        <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-4 space-y-4">
                            <div>
                                <p className="text-sm font-bold text-white mb-2">Default Generation Model</p>
                                <p className="text-xs text-slate-400 mb-3">Choose which AI provider generates your lectures, curriculums, and design docs.</p>
                                
                                <div className="space-y-2">
                                    <label className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${aiProvider === 'gemini' ? 'bg-indigo-900/20 border-indigo-500' : 'bg-slate-900/50 border-slate-700 hover:bg-slate-800'}`}>
                                        <div className="flex items-center gap-3">
                                            <input 
                                                type="radio" 
                                                name="ai_provider" 
                                                value="gemini"
                                                checked={aiProvider === 'gemini'}
                                                onChange={() => setAiProvider('gemini')}
                                                className="accent-indigo-500"
                                            />
                                            <div>
                                                <p className="text-sm font-bold text-white flex items-center gap-2">Google Gemini <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-300">Default</span></p>
                                                <p className="text-xs text-slate-500">Fast, reliable, multimodal. Powered by Gemini 2.5 Flash/Pro.</p>
                                            </div>
                                        </div>
                                    </label>

                                    <label className={`flex items-center justify-between p-3 rounded-lg border transition-all ${!isPaid ? 'opacity-60 cursor-not-allowed bg-slate-900/30 border-slate-800' : 'cursor-pointer'} ${isPaid && aiProvider === 'openai' ? 'bg-emerald-900/20 border-emerald-500' : isPaid ? 'bg-slate-900/50 border-slate-700 hover:bg-slate-800' : ''}`}>
                                        <div className="flex items-center gap-3">
                                            <input 
                                                type="radio" 
                                                name="ai_provider" 
                                                value="openai"
                                                checked={aiProvider === 'openai'}
                                                onChange={() => isPaid && setAiProvider('openai')}
                                                disabled={!isPaid}
                                                className="accent-emerald-500"
                                            />
                                            <div>
                                                <p className="text-sm font-bold text-white flex items-center gap-2">
                                                    OpenAI GPT-4o 
                                                    {!isPaid && <span className="text-[10px] bg-amber-900/50 text-amber-400 px-1.5 py-0.5 rounded flex items-center gap-1 border border-amber-500/30"><Lock size={8}/> Pro Only</span>}
                                                </p>
                                                <p className="text-xs text-slate-500">Advanced reasoning. Requires Pro Membership.</p>
                                            </div>
                                        </div>
                                        {aiProvider === 'openai' && isPaid && <Sparkles size={16} className="text-emerald-400" />}
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><Bell size={16}/> Notifications</h4>
                        <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <div><p className="text-sm font-bold text-white">Email Notifications</p><p className="text-xs text-slate-400">Receive updates about your account and new features.</p></div>
                                <button onClick={() => setEmailNotifs(!emailNotifs)} className={`w-10 h-5 rounded-full relative transition-colors ${emailNotifs ? 'bg-indigo-600' : 'bg-slate-600'}`}><div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${emailNotifs ? 'left-6' : 'left-1'}`}></div></button>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><Lock size={16}/> Privacy</h4>
                        <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <div><p className="text-sm font-bold text-white">Public Profile</p><p className="text-xs text-slate-400">Allow other members to find you in the directory.</p></div>
                                <button onClick={() => setPublicProfile(!publicProfile)} className={`w-10 h-5 rounded-full relative transition-colors ${publicProfile ? 'bg-emerald-600' : 'bg-slate-600'}`}><div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${publicProfile ? 'left-6' : 'left-1'}`}></div></button>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><Database size={16}/> Data & Storage</h4>
                        <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
                            <div><p className="text-sm font-bold text-white">Clear Local Cache</p><p className="text-xs text-slate-400">Remove downloaded audio and temporary files.</p></div>
                            <button onClick={handleClearCache} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold border border-slate-600">Clear Data</button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'billing' && (
                <div className="space-y-6">
                    {error && (
                        <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-3 text-red-300 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Subscription Status */}
                    <div className="flex items-center justify-between bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                        <div>
                            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-2">
                                <Shield size={16}/> Current Plan
                            </h4>
                            <div className="flex items-center gap-3">
                                <span className={`text-2xl font-bold ${isPaid ? 'text-amber-400' : 'text-white'}`}>
                                    {currentTier === 'pro' ? 'Pro Membership' : 'Free Starter'}
                                </span>
                                {isPaid && <span className="bg-emerald-900/30 text-emerald-400 px-2 py-0.5 rounded text-xs font-bold border border-emerald-500/30">Active</span>}
                            </div>
                            <p className="text-xs text-slate-400 mt-2 max-w-sm">
                                {isPaid ? "You have access to all premium features including Neural Voices, OpenAI Models, and Private Groups." : "Upgrade to Pro to unlock Neural Voices, Private Channels, OpenAI Models, and Unlimited Generation."}
                            </p>
                        </div>
                        
                        {!isPaid && onUpgradeClick && (
                            <button 
                                onClick={() => { onClose(); onUpgradeClick(); }}
                                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg transition-colors flex items-center gap-2"
                            >
                                <CreditCard size={16} />
                                <span>Upgrade Now</span>
                            </button>
                        )}
                    </div>

                    {isPaid && (
                        <div className="space-y-6">
                            {/* Manage Subscription Button (Portal) */}
                            <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center text-center space-y-3">
                                <p className="text-sm text-slate-400">Need to update your card, download invoices, or cancel your plan?</p>
                                <button 
                                    onClick={handleManageSubscription}
                                    disabled={isProcessingPortal}
                                    className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 rounded-xl font-bold text-sm flex items-center gap-2 transition-all hover:border-slate-500"
                                >
                                    {isProcessingPortal ? <Loader2 size={16} className="animate-spin"/> : <CreditCard size={16} />}
                                    <span>Manage Billing on Stripe</span>
                                    <ExternalLink size={14} className="text-slate-500" />
                                </button>
                            </div>

                            {/* Billing History */}
                            <div className="space-y-2">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recent Payments</h4>
                                {billingHistory.length > 0 ? (
                                    <div className="border border-slate-800 rounded-xl overflow-hidden">
                                        {billingHistory.map((bill, i) => (
                                            <div key={i} className="flex justify-between items-center p-3 bg-slate-800/30 border-b border-slate-800 last:border-0 hover:bg-slate-800/50">
                                                <div>
                                                    <p className="text-sm font-bold text-white">${bill.amount}</p>
                                                    <p className="text-[10px] text-slate-500">{bill.date}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] bg-emerald-900/50 text-emerald-400 px-2 py-0.5 rounded uppercase font-bold">Paid</span>
                                                    <button className="p-1.5 text-slate-400 hover:text-white"><FileText size={14}/></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-500 italic">No invoices found.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* MENTOR PAYOUTS SECTION & FEE DISPLAY */}
                    <div className="mt-8 pt-8 border-t border-slate-800">
                        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <DollarSign size={16} className="text-emerald-400"/> Mentor Revenue & Fees
                        </h4>
                        
                        <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-5 space-y-4">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-slate-800 rounded-full text-slate-400">
                                    <CreditCard size={24} />
                                </div>
                                <div className="flex-1">
                                    <h5 className="font-bold text-white text-sm mb-1">Get Paid for Mentorship</h5>
                                    <p className="text-xs text-slate-400 leading-relaxed mb-4">
                                        Connect your Stripe account to receive direct deposits from students.
                                    </p>
                                    
                                    <button 
                                        onClick={() => alert("Stripe Connect onboarding would launch here.")}
                                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg border border-slate-600 transition-colors flex items-center gap-2"
                                    >
                                        <span>Connect Stripe Account</span>
                                        <ExternalLink size={12} className="text-slate-500"/>
                                    </button>
                                </div>
                            </div>

                            {/* FEE BREAKDOWN VISUALIZATION */}
                            <div className="bg-slate-950/50 rounded-lg p-4 border border-slate-800">
                                <h5 className="text-xs font-bold text-white mb-3 flex items-center justify-between">
                                    <span>Payout Calculator (Example)</span>
                                </h5>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between text-slate-300">
                                        <span>Session Price (1 Hour)</span>
                                        <span>$50.00</span>
                                    </div>
                                    <div className="flex justify-between text-red-300">
                                        <span className="flex items-center gap-1">Platform Service Fee (10%) <span className="text-xs opacity-70 cursor-help" title="Covers server costs and Stripe processing fees.">*</span></span>
                                        <span>-$5.00</span>
                                    </div>
                                    <div className="h-px bg-slate-700 my-2"></div>
                                    <div className="flex justify-between text-emerald-400 font-bold">
                                        <span>Your Net Earnings</span>
                                        <span>$45.00</span>
                                    </div>
                                </div>
                            </div>

                            {/* INLINE POLICY FAQ */}
                            <div className="border-t border-slate-800 pt-2">
                                <button 
                                    onClick={() => setShowPolicy(!showPolicy)}
                                    className="flex items-center gap-2 text-xs text-indigo-400 hover:text-white transition-colors font-bold w-full"
                                >
                                    <HelpCircle size={14}/>
                                    <span>View Fee Policy & FAQ</span>
                                    {showPolicy ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                                </button>
                                
                                {showPolicy && (
                                    <div className="mt-3 space-y-3 text-xs text-slate-400 bg-slate-900 p-3 rounded-lg animate-fade-in">
                                        <div>
                                            <p className="font-bold text-slate-300 mb-1">Why is there a fee?</p>
                                            <p>AIVoiceCast charges a flat <strong>10% service fee</strong> on all paid sessions. This covers payment processing fees (Stripe) and infrastructure costs for the Live Audio/Video servers.</p>
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-300 mb-1">When do I get paid?</p>
                                            <p>Payouts are processed automatically via Stripe Connect. Funds typically arrive in your connected bank account within 2-5 business days after a session is completed.</p>
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-300 mb-1">How do I set my rate?</p>
                                            <p>You can set your hourly rate in your Profile after your Mentor Application is approved. Rates can be between $0 (Free) and $500/hr.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
