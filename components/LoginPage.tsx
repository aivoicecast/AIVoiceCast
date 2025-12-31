
import React, { useState, useEffect } from 'react';
import { ArrowRight, ShieldCheck, Loader2, Sparkles, Rocket, Shield, AlertCircle, Settings, Globe } from 'lucide-react';
import { signInWithGoogle } from '../services/authService';
import { logUserActivity } from '../services/firestoreService';
import { isFirebaseConfigured, getFirebaseDiagnostics } from '../services/firebaseConfig';
import { FirebaseConfigModal } from './FirebaseConfigModal';

interface LoginPageProps {
  onPrivacyClick?: () => void;
  onMissionClick?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onPrivacyClick, onMissionClick }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);
  const diagnostics = getFirebaseDiagnostics();

  // Auto-reset loading after 30 seconds
  useEffect(() => {
    let timer: any;
    if (isLoading) {
      timer = setTimeout(() => setIsLoading(false), 30000);
    }
    return () => clearTimeout(timer);
  }, [isLoading]);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      const user = await signInWithGoogle();
      if (user) {
        logUserActivity('login', { method: 'google', email: user.email });
      }
    } catch (e: any) {
      console.error("Login Error:", e);
      setShowTroubleshoot(true);
      if (e.code !== 'auth/popup-closed-by-user') {
        alert(`Login failed: ${e.message}`);
      }
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

      <div className="relative z-10 w-full max-w-lg">
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-slate-800 rounded-[3rem] shadow-2xl p-8 md:p-10 text-center animate-fade-in-up">
          
          <div className="w-48 h-48 mx-auto mb-6 relative group">
             <div className="absolute inset-0 bg-slate-950 rounded-[2.5rem] border border-slate-800 group-hover:border-indigo-500/50 transition-colors shadow-2xl"></div>
             <svg viewBox="0 0 512 512" className="relative z-10 w-full h-full p-4 drop-shadow-[0_0_20px_rgba(99,102,241,0.3)]">
                <defs>
                    <linearGradient id="prismGradLogin" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#00f2ff" />
                        <stop offset="50%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                </defs>
                <path d="M256 70 L400 410 H340 L310 330 H202 L172 410 H112 Z" fill="none" stroke="url(#prismGradLogin)" strokeWidth="14" strokeLinejoin="round" className="animate-pulse" />
                <path d="M202 290 h30 l12 -50 l12 80 l12 -100 l12 100 l12 -80 l12 50 h20" stroke="white" strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <g fill="white">
                   <circle cx="256" cy="70" r="14" />
                   <circle cx="112" cy="410" r="14" />
                   <circle cx="400" cy="410" r="14" />
                </g>
             </svg>
          </div>

          <h1 className="text-3xl font-black text-white mb-2 tracking-tighter uppercase">AIVoiceCast</h1>
          <p className="text-slate-400 text-xs mb-8 font-medium tracking-wide leading-relaxed">
            <span className="text-indigo-400 font-bold uppercase">Shared Learning Network</span><br/> 
            Infinite Capacity & Collective Mastery
          </p>

          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full bg-white hover:bg-slate-50 text-slate-900 font-black py-5 rounded-[1.5rem] shadow-2xl flex items-center justify-center gap-4 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed group"
          >
            {isLoading ? (
              <>
                <Loader2 size={24} className="animate-spin text-indigo-600" />
                <span className="text-base uppercase tracking-wider">Signing In...</span>
              </>
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

          {showTroubleshoot && (
              <div className="mt-8 p-4 bg-red-900/10 border border-red-900/20 rounded-2xl text-left animate-fade-in">
                  <div className="flex items-center gap-2 text-red-400 mb-2">
                      <AlertCircle size={16} />
                      <span className="text-xs font-bold uppercase tracking-wider">Connection Problem</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                      Initialization failed. This usually occurs if the current domain is not in your <strong>Firebase Authorized Domains</strong> list or if the configuration is missing.
                  </p>
                  <button 
                    onClick={() => setIsConfigModalOpen(true)}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                  >
                      <Settings size={14} />
                      Manage Configuration
                  </button>
              </div>
          )}
          
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
        
        <div className="mt-8 flex flex-col items-center gap-4 animate-fade-in [animation-delay:400ms]">
            <p className="text-center text-slate-600 text-[9px] uppercase font-black tracking-[0.3em] flex items-center gap-2">
              <Sparkles size={10} className="text-indigo-500" /> Neural Operating System
            </p>
        </div>
      </div>

      <FirebaseConfigModal 
        isOpen={isConfigModalOpen} 
        onClose={() => setIsConfigModalOpen(false)} 
        onConfigUpdate={() => window.location.reload()} 
      />
    </div>
  );
};
