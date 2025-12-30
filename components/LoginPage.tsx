import React, { useState } from 'react';
import { Podcast, ArrowRight, ShieldCheck, Loader2, AlertCircle, Rocket, Shield, Code, Image as ImageIcon, MessageSquare, Sparkles, Users } from 'lucide-react';
import { signInWithGoogle } from '../services/authService';
import { logUserActivity } from '../services/firestoreService';

interface LoginPageProps {
  onPrivacyClick?: () => void;
  onMissionClick?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onPrivacyClick, onMissionClick }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const user = await signInWithGoogle();
      if (user) {
        logUserActivity('login', { method: 'google', email: user.email });
      }
    } catch (e: any) {
      console.error("Login Error:", e);
      let msg = "Login failed. Please try again.";
      if (e.code === 'auth/operation-not-supported-in-this-environment') {
        msg = "Environment not supported (http/https required).";
      }
      setError(msg);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/10 rounded-full blur-[150px]"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-violet-600/10 rounded-full blur-[150px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-slate-800 rounded-[3rem] shadow-2xl p-10 text-center animate-fade-in-up">
          
          {/* Branded 'AIVoiceCast' App Icon (Neural Prism Design) */}
          <div className="w-56 h-56 mx-auto mb-8 relative group">
             <div className="absolute inset-0 bg-slate-950 rounded-[2.5rem] border border-slate-800 group-hover:border-indigo-500/50 transition-colors shadow-2xl"></div>
             
             <svg viewBox="0 0 512 512" className="relative z-10 w-full h-full p-4 drop-shadow-[0_0_20px_rgba(99,102,241,0.3)]">
                <defs>
                    <linearGradient id="prismGradLogin" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#00f2ff" />
                        <stop offset="50%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                </defs>
                
                {/* Orbital Rings */}
                <g stroke="white" strokeWidth="1" strokeOpacity="0.05">
                   <circle cx="256" cy="256" r="230" fill="none" />
                   <circle cx="256" cy="256" r="210" fill="none" strokeDasharray="4 8" />
                </g>

                {/* The Faceted 'A' Prism */}
                <path 
                    d="M256 70 L400 410 H340 L310 330 H202 L172 410 H112 Z" 
                    fill="none" 
                    stroke="url(#prismGradLogin)" 
                    strokeWidth="14" 
                    strokeLinejoin="round" 
                    className="animate-pulse"
                />
                
                {/* Neural Waveform Synapse */}
                <path 
                    d="M202 290 h30 l12 -50 l12 80 l12 -100 l12 100 l12 -80 l12 50 h20" 
                    stroke="white" 
                    strokeWidth="10" 
                    fill="none" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                />

                {/* Network Learning Nodes */}
                <g fill="white">
                   <circle cx="256" cy="70" r="14" />
                   <circle cx="112" cy="410" r="14" />
                   <circle cx="400" cy="410" r="14" />
                   <circle cx="430" cy="220" r="8" fill="url(#prismGradLogin)" />
                   <circle cx="82" cy="220" r="8" fill="url(#prismGradLogin)" />
                </g>
             </svg>
             <div className="absolute -inset-10 bg-gradient-to-tr from-cyan-500/20 via-indigo-500/10 to-purple-500/20 rounded-full blur-[4rem] opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </div>

          <h1 className="text-4xl font-black text-white mb-2 tracking-tighter uppercase">AIVoiceCast</h1>
          <p className="text-slate-400 text-sm mb-10 font-medium tracking-wide leading-relaxed">
            A <span className="text-indigo-400 font-bold uppercase">Shared Network of Learning</span> for<br/> 
            <span className="text-white font-bold">Infinite Capacity</span> & 
            <span className="text-purple-400 font-bold uppercase"> Mastery</span>
          </p>

          <div className="space-y-6">
            {error && (
              <div className="bg-red-900/20 border border-red-900/50 rounded-2xl p-4 text-red-300 text-xs flex items-center gap-3 text-left animate-shake">
                <AlertCircle size={18} className="shrink-0" />
                <span className="flex-1">{error}</span>
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={isLoading}
              className="w-full bg-white hover:bg-slate-50 text-slate-900 font-black py-5 rounded-[1.5rem] shadow-2xl flex items-center justify-center gap-4 transition-all transform hover:scale-[1.03] active:scale-[0.97] disabled:opacity-70 disabled:cursor-not-allowed group"
            >
              {isLoading ? (
                <Loader2 size={24} className="animate-spin text-indigo-600" />
              ) : (
                <>
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  <span className="text-base uppercase tracking-wider">Continue with Google</span>
                  <ArrowRight size={20} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
            
            <div className="flex items-center justify-center gap-6 mt-8">
                {onMissionClick && (
                    <button onClick={onMissionClick} className="text-xs text-slate-500 hover:text-orange-400 font-bold uppercase tracking-widest flex items-center gap-2 transition-colors">
                        <Rocket size={14} /> <span>Mission</span>
                    </button>
                )}
                <div className="w-1.5 h-1.5 bg-slate-800 rounded-full"></div>
                {onPrivacyClick && (
                    <button onClick={onPrivacyClick} className="text-xs text-slate-500 hover:text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-2 transition-colors">
                        <Shield size={14} /> <span>Security</span>
                    </button>
                )}
            </div>
          </div>
        </div>
        
        <div className="mt-12 flex flex-col items-center gap-6 animate-fade-in [animation-delay:600ms]">
            <p className="text-center text-slate-600 text-[10px] uppercase font-black tracking-[0.3em] flex items-center gap-3">
              <Sparkles size={12} className="text-indigo-500" /> Knowledge Operating System
            </p>
            <div className="flex gap-12 text-slate-800">
                <div className="flex flex-col items-center gap-2 group cursor-help" title="Workplace Integration">
                    <Code size={24} className="group-hover:text-cyan-500 transition-colors" />
                    <span className="text-[9px] uppercase tracking-tighter font-black">Work</span>
                </div>
                <div className="flex flex-col items-center gap-2 group cursor-help" title="Shared Learning Paths">
                    <Podcast size={24} className="group-hover:text-indigo-500 transition-colors" />
                    <span className="text-[9px] uppercase tracking-tighter font-black">Learn</span>
                </div>
                <div className="flex flex-col items-center gap-2 group cursor-help" title="Community Network">
                    <Users size={24} className="group-hover:text-purple-500 transition-colors" />
                    <span className="text-[9px] uppercase tracking-tighter font-black">Share</span>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
