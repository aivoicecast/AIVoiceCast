
import React, { useState } from 'react';
import { ArrowRight, Loader2, Sparkles, Rocket, Shield, HardDrive } from 'lucide-react';
import { signInWithGoogle } from '../services/authService';

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
      // App.tsx handles the state change via localstorage check/event
      window.location.reload();
    } catch (e: any) {
      console.error(e);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="relative z-10 w-full max-w-lg bg-slate-900/80 backdrop-blur-2xl border border-slate-800 rounded-[3rem] p-10 text-center animate-fade-in-up">
          <div className="w-40 h-40 mx-auto mb-8 bg-indigo-600/10 rounded-[2rem] flex items-center justify-center border border-indigo-500/20">
             <HardDrive size={64} className="text-indigo-400" />
          </div>

          <h1 className="text-3xl font-black text-white mb-2 tracking-tighter uppercase">AIVoiceCast</h1>
          <p className="text-slate-400 text-sm mb-8 font-medium">
            <span className="text-indigo-400 font-bold">Private Storage Mode</span><br/> 
            Your data is saved directly to your Google Drive.
          </p>

          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full bg-white hover:bg-slate-50 text-slate-900 font-black py-5 rounded-2xl shadow-2xl flex items-center justify-center gap-4 transition-all disabled:opacity-70"
          >
            {isLoading ? (
              <Loader2 size={24} className="animate-spin" />
            ) : (
              <>
                <span className="text-base uppercase tracking-wider">Sign in with Google Drive</span>
                <ArrowRight size={20} className="text-slate-400" />
              </>
            )}
          </button>
          
          <div className="mt-8 flex justify-center gap-6">
              <button onClick={onMissionClick} className="text-xs text-slate-500 hover:text-white uppercase font-bold tracking-widest">Mission</button>
              <button onClick={onPrivacyClick} className="text-xs text-slate-500 hover:text-white uppercase font-bold tracking-widest">Privacy</button>
          </div>
      </div>
    </div>
  );
};
