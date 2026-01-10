import React, { useState, useEffect } from 'react';
import { UserProfile, SubscriptionTier, GlobalStats, Channel } from '../types';
import { getUserProfile, getGlobalStats, updateUserProfile } from '../services/firestoreService';
import { Sparkles, BarChart2, Plus, Wand2, Crown, Settings, Book, Users, LogIn, Terminal, Cloud, Globe, Mic, LayoutGrid, HardDrive, AlertCircle, Gift, CreditCard, Languages, MousePointer2, Rocket, Shield, LogOut } from 'lucide-react';
import { VOICES } from '../utils/initialData';
import { signOut } from '../services/authService';

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
  onUpgradeClick: () => void;
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
  setIsCreateModalOpen, setIsVoiceCreateOpen, onUpgradeClick, setIsSettingsModalOpen, onOpenUserGuide, onNavigate, onOpenPrivacy,
  className, channels = [],
  language, setLanguage
}) => {
  const [globalStats, setGlobalStats] = useState<GlobalStats>({ totalLogins: 0, uniqueUsers: 0 });
  
  const isSuperAdmin = currentUser?.email === 'shengliang.song.ai@gmail.com';
  
  useEffect(() => {
      if (isUserMenuOpen) { getGlobalStats().then(setGlobalStats); }
  }, [isUserMenuOpen]);

  if (!isUserMenuOpen || !currentUser) return null;

  const handleLogout = async () => {
    if (confirm("Are you sure you want to sign out?")) {
        await signOut();
        setIsUserMenuOpen(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[90]" onClick={() => setIsUserMenuOpen(false)}></div>
      <div className={`${className ? className : 'absolute right-0 top-full mt-2 w-72'} bg-slate-900 border border-slate-700 rounded-xl shadow-2xl animate-fade-in-up max-h-[calc(100vh-6rem)] overflow-y-auto overflow-x-hidden z-[100] flex flex-col`} onClick={(e) => e.stopPropagation()}>
         <div className="p-4 border-b border-slate-800 bg-slate-950/90 flex flex-col items-center gap-3">
            <img src={currentUser.photoURL} className="w-12 h-12 rounded-full border border-indigo-500 shadow-md" />
            <div className="text-center"><h3 className="text-sm font-bold text-white">{currentUser.displayName}</h3><p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Active Member</p></div>
         </div>
         
         <div className="p-2 space-y-1 flex-1">
            <button onClick={() => { onUpgradeClick(); setIsUserMenuOpen(false); }} className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-white hover:bg-slate-800 rounded-lg transition-colors bg-gradient-to-r from-indigo-900/20 to-purple-900/20 border border-indigo-500/30 mb-2">
               <div className="p-1.5 bg-amber-500 text-white rounded-md shadow-lg"><Crown size={14} fill="currentColor"/></div><span className="font-bold text-amber-200">Upgrade Membership</span>
            </button>
            <button onClick={() => { setIsCreateModalOpen(true); setIsUserMenuOpen(false); }} className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-white hover:bg-slate-800 rounded-lg"><div className="p-1.5 bg-indigo-900/50 text-indigo-400 rounded-md"><Plus size={16}/></div><span className="font-medium">Create Podcast</span></button>
            <div className="h-px bg-slate-800 my-2 mx-2" />
            <div className="px-3 py-2"><div className="flex bg-slate-900 p-1 rounded-lg border border-slate-700"><button onClick={() => setLanguage('en')} className={`flex-1 text-[10px] py-1.5 rounded transition-all font-bold ${language === 'en' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>ENGLISH</button><button onClick={() => setLanguage('zh')} className={`flex-1 text-[10px] py-1.5 rounded transition-all font-bold ${language === 'zh' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>中文</button></div></div>
            <button onClick={() => { onOpenUserGuide(); setIsUserMenuOpen(false); }} className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"><Book size={16} /><span>User Guide</span></button>
            <button onClick={() => { onOpenPrivacy(); setIsUserMenuOpen(false); }} className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"><Shield size={16} /><span>Privacy Policy</span></button>
            <button onClick={() => { setIsSettingsModalOpen(true); setIsUserMenuOpen(false); }} className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"><Settings size={16} /><span>Settings</span></button>
            {isSuperAdmin && (<><div className="h-px bg-slate-800 my-2 mx-2" /><button onClick={() => { onNavigate('firestore_debug'); setIsUserMenuOpen(false); }} className="w-full flex items-center space-x-3 px-3 py-2 text-xs text-red-400 hover:bg-red-900/10 rounded-lg transition-colors"><Terminal size={16}/> <span>Admin Inspector</span></button></>)}
         </div>
         <div className="p-2 border-t border-slate-800 bg-slate-950/50 mt-auto"><button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-bold text-red-400 hover:text-white hover:bg-red-900/40 rounded-lg transition-all"><LogOut size={16} /><span>Sign Out</span></button></div>
      </div>
    </>
  );
};