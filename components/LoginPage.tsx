import React, { useState } from 'react';
import { ArrowRight, Loader2, ShieldCheck, HardDrive, Share2, Sparkles } from 'lucide-react';
import { signInWithGoogle } from '../services/authService';
import { BrandLogo } from './BrandLogo';

interface LoginPageProps {
  onPrivacyClick?: () => void;
  onMissionClick?: () => void;
}

const GoogleLogo = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    <path fill="none" d="M0 0h48v48H0z"/>
  </svg>
);

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

          <h1 className="text-4xl font-black text-white mb-2 tracking-tighter uppercase italic">Neural Prism</h1>
          <p className="text-slate-400 text-sm mb-10 font-medium">
            <span className="text-indigo-400 font-bold uppercase tracking-widest">Intelligence Hub</span><br/> 
            Refracting AI for your daily activities.
          </p>

          <div className="space-y-4 mb-10">
              <div className="flex items-center gap-3 bg-slate-800/30 p-3 rounded-xl border border-slate-700/50">
                  <ShieldCheck className="text-emerald-400" size={20}/>
                  <div className="text-left">
                      <p className="text-xs font-bold text-white uppercase">Sovereign Entry</p>
                      <p className="text-[10px] text-slate-500">Secure Google Account handshake required.</p>
                  </div>
              </div>
              <div className="flex items-center gap-3 bg-slate-800/30 p-3 rounded-xl border border-slate-700/50">
                  <Sparkles className="text-indigo-400" size={20}/>
                  <div className="text-left">
                      <p className="text-xs font-bold text-white uppercase">Refracted Logic</p>
                      <p className="text-[10px] text-slate-500">20+ specialized tools for projects and growth.</p>
                  </div>
              </div>
              <div className="flex items-center gap-3 bg-slate-800/30 p-3 rounded-xl border border-slate-700/50">
                  <HardDrive className="text-purple-400" size={20}/>
                  <div className="text-left">
                      <p className="text-xs font-bold text-white uppercase">Personal Storage</p>
                      <p className="text-[10px] text-slate-500">Archives save directly to your own Google Drive.</p>
                  </div>
              </div>
          </div>

          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="group w-full bg-white hover:bg-slate-50 text-slate-900 font-black py-5 rounded-2xl shadow-2xl flex items-center justify-center gap-4 transition-all active:scale-[0.98]"
          >
            {isLoading ? (
              <Loader2 size={24} className="animate-spin text-indigo-600" />
            ) : (
              <>
                <GoogleLogo size={24} />
                <span className="text-base uppercase tracking-wider">Continue with Google Account</span>
              </>
            )}
          </button>
          
          <div className="mt-10 flex justify-center gap-8">
              <button onClick={onMissionClick} className="text-[10px] text-slate-500 hover:text-indigo-400 uppercase font-bold tracking-[0.2em] transition-colors">Vision</button>
              <button onClick={onPrivacyClick} className="text-[10px] text-slate-500 hover:text-indigo-400 uppercase font-bold tracking-[0.2em] transition-colors">Privacy</button>
          </div>
      </div>
    </div>
  );
};