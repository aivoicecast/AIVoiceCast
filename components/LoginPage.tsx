
import React, { useState } from 'react';
import { ArrowRight, Loader2, ShieldCheck, HardDrive, Share2 } from 'lucide-react';
import { signInWithGoogle } from '../services/authService';
import { BrandLogo } from './BrandLogo';

interface LoginPageProps {
  onPrivacyClick?: () => void;
  onMissionClick?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onPrivacyClick, onMissionClick }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
      window.location.reload();
    } catch (e: any) {
      console.error(e);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-lg bg-slate-900/40 backdrop-blur-2xl border border-slate-800/50 rounded-[3rem] p-10 text-center animate-fade-in-up shadow-2xl">
          <div className="flex justify-center mb-8 transform hover:scale-105 transition-transform duration-500">
             <BrandLogo size={96} />
          </div>

          <h1 className="text-4xl font-black text-white mb-2 tracking-tighter uppercase italic">AIVoiceCast</h1>
          <p className="text-slate-400 text-sm mb-10 font-medium">
            <span className="text-indigo-400 font-bold uppercase tracking-widest">Knowledge OS</span><br/> 
            AI-native learning, synced to your personal Google Drive.
          </p>

          <div className="space-y-4 mb-10">
              <div className="flex items-center gap-3 bg-slate-800/30 p-3 rounded-xl border border-slate-700/50">
                  <ShieldCheck className="text-emerald-400" size={20}/>
                  <div className="text-left">
                      <p className="text-xs font-bold text-white uppercase">Secure Entry</p>
                      <p className="text-[10px] text-slate-500">Google Account mandatory for all members.</p>
                  </div>
              </div>
              <div className="flex items-center gap-3 bg-slate-800/30 p-3 rounded-xl border border-slate-700/50">
                  <HardDrive className="text-indigo-400" size={20}/>
                  <div className="text-left">
                      <p className="text-xs font-bold text-white uppercase">Cloud Sync</p>
                      <p className="text-[10px] text-slate-500">Recordings and projects save directly to your Drive.</p>
                  </div>
              </div>
              <div className="flex items-center gap-3 bg-slate-800/30 p-3 rounded-xl border border-slate-700/50">
                  <Share2 className="text-purple-400" size={20}/>
                  <div className="text-left">
                      <p className="text-xs font-bold text-white uppercase">Native Sharing</p>
                      <p className="text-[10px] text-slate-500">Share files with any valid Google member.</p>
                  </div>
              </div>
          </div>

          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="group w-full bg-white hover:bg-slate-50 text-slate-900 font-black py-5 rounded-2xl shadow-2xl flex items-center justify-center gap-4 transition-all active:scale-[0.98]"
          >
            {isLoading ? <Loader2 size={24} className="animate-spin text-indigo-600" /> : (<><span className="text-base uppercase tracking-wider">Continue with Google Account</span><ArrowRight size={20} className="text-slate-400" /></>)}
          </button>
          
          <div className="mt-10 flex justify-center gap-8">
              <button onClick={onMissionClick} className="text-[10px] text-slate-500 hover:text-indigo-400 uppercase font-bold tracking-[0.2em] transition-colors">Mission</button>
              <button onClick={onPrivacyClick} className="text-[10px] text-slate-500 hover:text-indigo-400 uppercase font-bold tracking-[0.2em] transition-colors">Privacy</button>
          </div>
      </div>
    </div>
  );
};
