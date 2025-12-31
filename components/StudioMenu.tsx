
import React, { useState, useEffect } from 'react';
import { UserProfile, SubscriptionTier, GlobalStats, Channel } from '../types';
import { getUserProfile, getGlobalStats, updateUserProfile } from '../services/firestoreService';
import { Sparkles, BarChart2, Plus, Wand2, Crown, Settings, Book, Users, LogIn, Terminal, Cloud, Globe, Mic, LayoutGrid, HardDrive, AlertCircle, Gift, CreditCard, Languages, MousePointer2, Rocket, Shield } from 'lucide-react';
import { VOICES } from '../utils/initialData';
import { PricingModal } from './PricingModal';

interface StudioMenuProps {
  isUserMenuOpen: boolean;
  setIsUserMenuOpen: (open: boolean) => void;
  userProfile: UserProfile | null;
  setUserProfile: (p: UserProfile | null) => void;
  currentUser: any;
  globalVoice: string;
  setGlobalVoice: (v: string) => void;
  setIsCreateModalOpen: (open: boolean) => void;
  setIsVoiceCreateOpen: (open: boolean) => void;
  setIsSyncModalOpen: (open: boolean) => void;
  setIsSettingsModalOpen: (open: boolean) => void;
  onOpenUserGuide: () => void;
  onNavigate: (view: string) => void;
  onOpenPrivacy: () => void;
  t: any;
  className?: string;
  channels: Channel[];
  language: 'en' | 'zh';
  setLanguage: (lang: 'en' | 'zh') => void;
  allApps?: any[];
}

export const StudioMenu: React.FC<StudioMenuProps> = ({
  isUserMenuOpen, setIsUserMenuOpen, userProfile, setUserProfile, currentUser,
  globalVoice, setGlobalVoice, 
  setIsCreateModalOpen, setIsVoiceCreateOpen, setIsSettingsModalOpen, onOpenUserGuide, onNavigate, onOpenPrivacy, t,
  className, channels = [],
  language, setLanguage,
  allApps = []
}) => {
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [globalStats, setGlobalStats] = useState<GlobalStats>({ totalLogins: 0, uniqueUsers: 0 });
  
  const isSuperAdmin = currentUser?.email === 'shengliang.song@gmail.com';
  
  useEffect(() => {
      if (isUserMenuOpen) {
          getGlobalStats().then(setGlobalStats).catch(console.error);
      }
  }, [isUserMenuOpen]);

  if (!isUserMenuOpen) return null;

  if (!currentUser) return null;

  const handleUpgradeSuccess = async (newTier: SubscriptionTier) => {
      if (userProfile) setUserProfile({ ...userProfile, subscriptionTier: newTier });
      try {
          const fresh = await getUserProfile(currentUser.uid);
          if (fresh) setUserProfile(fresh);
      } catch(e) {}
  };

  const handleSetQuickApp = async (appId: string) => {
      if (!userProfile) return;
      const updated = { ...userProfile, preferredMobileQuickApp: appId };
      setUserProfile(updated);
      try {
          await updateUserProfile(currentUser.uid, { preferredMobileQuickApp: appId });
      } catch(e) {}
  };

  const tierInfo = (userProfile?.subscriptionTier === 'pro') 
      ? { label: 'PRO MEMBER', color: 'text-amber-400 bg-amber-900/50 border border-amber-500/20' }
      : { label: 'FREE TIER', color: 'text-slate-400 bg-slate-800' };

  const StatBox = ({ icon: Icon, label, value }: { icon: any, label: string, value: number | string }) => (
      <div className="flex flex-col items-center bg-slate-800/50 p-2 rounded-lg border border-slate-800 hover:bg-slate-800 transition-colors">
          <Icon size={14} className="text-indigo-400 mb-1" />
          <span className="text-[10px] text-slate-500 uppercase font-bold">{label}</span>
          <span className="text-sm font-bold text-white">{value}</span>
      </div>
  );

  const quickNavApps = allApps.filter(a => a.id !== 'podcasts');

  return (
    <>
      <div className="fixed inset-0 z-[90]" onClick={() => setIsUserMenuOpen(false)}></div>
      <div 
          className={`${className ? className : 'absolute right-0 top-full mt-2 w-72'} bg-slate-900 border border-slate-700 rounded-xl shadow-2xl animate-fade-in-up max-h-[calc(100vh-6rem)] overflow-y-auto overflow-x-hidden z-[100]`}
          onClick={(e) => e.stopPropagation()}
      >
         <div className="p-3 border-b border-slate-800 bg-slate-950/90 flex justify-between items-center sticky top-0 z-10 backdrop-blur-sm">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-2">
               <Sparkles size={12} className="text-indigo-400" />
               <span>Creator Studio</span>
            </h3>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${tierInfo.color}`}>{tierInfo.label}</span>
         </div>
         
         <div className="p-2 border-b border-slate-800 bg-slate-900/30">
            <div className="grid grid-cols-2 gap-2 mb-2">
                <StatBox icon={Mic} label="Podcasts" value={channels.length} />
                <StatBox icon={Users} label="Members" value={globalStats.uniqueUsers} />
            </div>
         </div>

         <div className="p-2 space-y-1">
            <button 
               onClick={() => setIsPricingOpen(true)}
               className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-white hover:bg-slate-800 rounded-lg transition-colors bg-gradient-to-r from-indigo-900/20 to-purple-900/20 border border-indigo-500/30 mb-2"
            >
               <div className="p-1.5 bg-amber-500 text-white rounded-md shadow-lg"><Crown size={14} fill="currentColor"/></div>
               <span className="font-bold text-amber-200">Upgrade Membership</span>
            </button>

            <button onClick={() => { setIsCreateModalOpen(true); setIsUserMenuOpen(false); }} className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-white hover:bg-slate-800 rounded-lg transition-colors">
               <div className="p-1.5 bg-indigo-900/50 text-indigo-400 rounded-md"><Plus size={16}/></div>
               <span className="font-medium">Create Podcast</span>
            </button>
            
            <div className="h-px bg-slate-800 my-2 mx-2" />
            
            <button onClick={() => { onNavigate('mission'); setIsUserMenuOpen(false); }} className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-white hover:bg-slate-800 rounded-lg transition-colors">
               <div className="p-1.5 bg-orange-900/50 text-orange-400 rounded-md"><Rocket size={16}/></div>
               <span className="font-medium">Mission</span>
            </button>

            <div className="h-px bg-slate-800 my-2 mx-2" />

            {/* Language Selection */}
            <div className="px-3 py-2">
               <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-700">
                  <button onClick={() => setLanguage('en')} className={`flex-1 text-[10px] py-1.5 rounded transition-all font-bold ${language === 'en' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>ENGLISH</button>
                  <button onClick={() => setLanguage('zh')} className={`flex-1 text-[10px] py-1.5 rounded transition-all font-bold ${language === 'zh' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>中文</button>
               </div>
            </div>

            <button onClick={() => { onOpenUserGuide(); setIsUserMenuOpen(false); }} className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
               <Book size={16} />
               <span>User Guide</span>
            </button>

            <button onClick={() => { onOpenPrivacy(); setIsUserMenuOpen(false); }} className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
               <Shield size={16} />
               <span>Privacy Policy</span>
            </button>
            
            <button onClick={() => { setIsSettingsModalOpen(true); setIsUserMenuOpen(false); }} className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
               <Settings size={16} />
               <span>Settings</span>
            </button>

            {isSuperAdmin && (
                <>
                    <div className="h-px bg-slate-800 my-2 mx-2" />
                    <button onClick={() => { onNavigate('firestore_debug'); setIsUserMenuOpen(false); }} className="w-full flex items-center space-x-3 px-3 py-2 text-xs text-red-400 hover:bg-red-900/10 rounded-lg transition-colors">
                        <Terminal size={16}/> <span>Admin Inspector</span>
                    </button>
                </>
            )}
         </div>
      </div>

      {isPricingOpen && userProfile && (
          <PricingModal isOpen={true} onClose={() => setIsPricingOpen(false)} user={userProfile} onSuccess={handleUpgradeSuccess} />
      )}
    </>
  );
};
