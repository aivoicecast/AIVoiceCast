import React, { useState, useEffect } from 'react';
import { ArrowRight, Loader2, ShieldCheck, HardDrive, Share2, Activity, Terminal, AlertTriangle, CheckCircle, Wifi, Cpu, ShieldAlert, Key, ExternalLink } from 'lucide-react';
import { signInWithGoogle } from '../services/authService';
import { BrandLogo } from './BrandLogo';
import { getFirebaseDiagnostics } from '../services/firebaseConfig';

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
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [hasAiKey, setHasAiKey] = useState(false);
  const [bootLogs, setBootLogs] = useState<{msg: string, type: 'info' | 'success' | 'error'}[]>([]);

  const addLog = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
      setBootLogs(prev => [...prev, { msg, type }].slice(-10));
  };

  const checkAiKey = async () => {
    if ((window as any).aistudio) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        setHasAiKey(hasKey);
        if (hasKey) addLog("AI Studio: Key Verified", "success");
        else addLog("AI Studio: Key Selection Required", "info");
        return hasKey;
    }
    return false;
  };

  useEffect(() => {
    const runDiagnostics = () => {
        const d = getFirebaseDiagnostics();
        setDiagnostics(d);
        return d;
    };

    const d = runDiagnostics();
    checkAiKey();
    
    addLog("Neural Kernel v4.5.6 Initializing...");
    
    if (d.apiKeyPresent) {
        addLog("Registry: Firebase Keys Loaded", "success");
    } else {
        addLog("Registry: Keys Missing (Local Mode)", "error");
    }

    if (d.isInitialized) {
        addLog("Core: LINKED", "success");
    } else {
        addLog("Core: OFFLINE", "error");
    }
    
    if (d.hasAuth) {
        addLog("Auth Protocol: SIGNED", "success");
    } else {
        addLog("Auth Protocol: NOT REGISTERED", "error");
    }

    if (d.hasFirestore) {
        addLog("Knowledge Ledger: CONNECTED", "success");
    }
    
    const timer = setInterval(() => {
        setDiagnostics(runDiagnostics());
        checkAiKey();
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleSelectKey = async () => {
    if ((window as any).aistudio) {
        addLog("Opening AI Studio Key Selection...");
        await (window as any).aistudio.openSelectKey();
        // Per guidelines, assume success and proceed
        setHasAiKey(true);
        addLog("AI Key Protocol: ACTIVE", "success");
    }
  };

  const handleLogin = async () => {
    if (!hasAiKey) {
        await handleSelectKey();
    }
    
    setIsLoading(true);
    addLog("Initiating Secure Neural Handshake...");
    try {
      await signInWithGoogle();
      addLog("Handshake Complete. Loading UI...", "success");
      setTimeout(() => {
          window.location.reload();
      }, 500);
    } catch (e: any) {
      console.error(e);
      addLog(`Handshake Failed: ${String(e.message || "Network Error")}`, "error");
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
          <p className="text-slate-400 text-sm mb-10 font-medium leading-relaxed">
            <span className="text-indigo-400 font-bold uppercase tracking-widest">Knowledge OS</span><br/> 
            AI-native learning, synced to your sovereign Drive.
          </p>

          <div className="mb-8 p-5 bg-black/60 rounded-3xl border border-slate-800 text-left space-y-4 shadow-inner overflow-hidden">
              <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                      <Terminal size={12}/> Neural Boot Log
                  </span>
                  <div className="flex gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${diagnostics?.isInitialized ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}/>
                      <div className={`w-1.5 h-1.5 rounded-full ${hasAiKey ? 'bg-indigo-500' : 'bg-slate-700'}`}/>
                      <div className={`w-1.5 h-1.5 rounded-full ${diagnostics?.hasFirestore ? 'bg-emerald-500' : 'bg-slate-800'}`}/>
                  </div>
              </div>
              
              <div className="space-y-1.5 font-mono text-[10px] min-h-[140px]">
                  {bootLogs.map((log, i) => (
                      <div key={i} className={`flex items-center gap-2 ${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-emerald-400' : 'text-slate-500'}`}>
                          <span className="opacity-40">>></span>
                          <span className="font-bold">{String(log.msg)}</span>
                      </div>
                  ))}
                  {isLoading && (
                      <div className="flex items-center gap-2 text-indigo-400 animate-pulse">
                          <span className="opacity-40">>></span>
                          <span className="font-bold">Authorizing Neural Link...</span>
                      </div>
                  )}
              </div>
              
              {!hasAiKey && (
                  <div className="mt-4 p-4 bg-indigo-900/20 border border-indigo-500/30 rounded-2xl flex flex-col gap-3 animate-fade-in">
                      <div className="flex items-start gap-3">
                        <Key size={18} className="text-indigo-400 shrink-0 mt-0.5"/>
                        <div className="text-[10px] text-indigo-200 leading-relaxed font-bold">
                            REQUIRED: AI Studio Key Selection
                            <p className="mt-1 text-slate-400 font-normal">A billing-enabled API key from a paid GCP project is required for specialized personas and high-quality imaging.</p>
                        </div>
                      </div>
                      <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-[9px] text-indigo-400 hover:text-white flex items-center gap-1 uppercase font-black tracking-widest">
                        Billing Documentation <ExternalLink size={10}/>
                      </a>
                      <button onClick={handleSelectKey} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">Authorize AI Studio</button>
                  </div>
              )}

              {!diagnostics?.hasAuth && diagnostics?.isInitialized && (
                  <div className="mt-4 p-3 bg-red-900/20 border border-red-900/30 rounded-xl flex items-start gap-3 animate-fade-in">
                      <ShieldAlert size={16} className="text-red-400 shrink-0 mt-0.5"/>
                      <div className="text-[10px] text-red-300 leading-relaxed font-bold">
                          REGISTRY CONFLICT: Auth module failed to register. 
                          <p className="mt-1 text-slate-400 font-normal">Please perform a force reboot to re-link modules.</p>
                          <button onClick={() => window.location.reload()} className="block mt-2 underline text-white font-black uppercase tracking-tighter">Force System Reboot</button>
                      </div>
                  </div>
              )}
          </div>

          <div className="space-y-3 mb-8">
              <div className="flex items-center gap-4 bg-slate-800/30 p-4 rounded-2xl border border-slate-700/50 group hover:border-indigo-500/30 transition-all">
                  <div className="p-2 bg-indigo-600/10 rounded-xl text-indigo-400 group-hover:scale-110 transition-transform">
                    <ShieldCheck size={20}/>
                  </div>
                  <div className="text-left">
                      <p className="text-xs font-bold text-white uppercase tracking-wider">Secure Protocol</p>
                      <p className="text-[10px] text-slate-500 font-medium">Standard Google OAuth 2.0 verification.</p>
                  </div>
              </div>
              <div className="flex items-center gap-4 bg-slate-800/30 p-4 rounded-2xl border border-slate-700/50 group hover:border-indigo-500/30 transition-all">
                  <div className="p-2 bg-indigo-600/10 rounded-xl text-indigo-400 group-hover:scale-110 transition-transform">
                    <HardDrive size={20}/>
                  </div>
                  <div className="text-left">
                      <p className="text-xs font-bold text-white uppercase tracking-wider">Cloud Sovereignty</p>
                      <p className="text-[10px] text-slate-500 font-medium">Data resides strictly in your private Google Drive.</p>
                  </div>
              </div>
          </div>

          <button
            onClick={handleLogin}
            disabled={isLoading || !diagnostics?.isInitialized}
            className={`group w-full bg-white hover:bg-slate-50 text-slate-900 font-black py-5 rounded-2xl shadow-2xl flex items-center justify-center gap-4 transition-all active:scale-[0.98] ${!diagnostics?.isInitialized ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
          >
            {isLoading ? (
              <Loader2 size={24} className="animate-spin text-indigo-600" />
            ) : (
              <>
                <GoogleLogo size={24} />
                <span className="text-base uppercase tracking-wider">Launch Knowledge OS</span>
              </>
            )}
          </button>
          
          <div className="mt-10 flex justify-center gap-8 border-t border-slate-800 pt-6">
              <button onClick={onMissionClick} className="text-[10px] text-slate-500 hover:text-indigo-400 uppercase font-black tracking-[0.2em] transition-colors">Mission</button>
              <button onClick={onPrivacyClick} className="text-[10px] text-slate-500 hover:text-indigo-400 uppercase font-black tracking-[0.2em] transition-colors">Privacy</button>
          </div>
      </div>
    </div>
  );
};
