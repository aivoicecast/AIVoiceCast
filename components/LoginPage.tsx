import React, { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
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
      // App.tsx handles the state change via localstorage check/event
      window.location.reload();
    } catch (e: any) {
      console.error(e);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decorative Blurs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-lg bg-slate-900/40 backdrop-blur-2xl border border-slate-800/50 rounded-[3rem] p-10 text-center animate-fade-in-up shadow-2xl">
          <div className="flex justify-center mb-8 transform hover:scale-105 transition-transform duration-500">
             <BrandLogo size={96} />
          </div>

          <h1 className="text-4xl font-black text-white mb-2 tracking-tighter uppercase italic">AIVoiceCast</h1>
          <p className="text-slate-400 text-sm mb-10 font-medium">
            <span className="text-indigo-400 font-bold uppercase tracking-widest">Neural Resonance Studio</span><br/> 
            Your knowledge ecosystem, synced to your Drive.
          </p>

          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="group w-full bg-white hover:bg-slate-50 text-slate-900 font-black py-5 rounded-2xl shadow-2xl flex items-center justify-center gap-4 transition-all disabled:opacity-70 active:scale-[0.98]"
          >
            {isLoading ? (
              <Loader2 size={24} className="animate-spin text-indigo-600" />
            ) : (
              <>
                <span className="text-base uppercase tracking-wider">Sign in with Google Account</span>
                <ArrowRight size={20} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
              </>
            )}
          </button>
          
          <div className="mt-10 flex justify-center gap-8">
              <button onClick={onMissionClick} className="text-[10px] text-slate-500 hover:text-indigo-400 uppercase font-bold tracking-[0.2em] transition-colors">Mission</button>
              <button onClick={onPrivacyClick} className="text-[10px] text-slate-500 hover:text-indigo-400 uppercase font-bold tracking-[0.2em] transition-colors">Privacy</button>
          </div>
      </div>
    </div>
  );
};