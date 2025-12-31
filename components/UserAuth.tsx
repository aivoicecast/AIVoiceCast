import React, { useState, useEffect } from 'react';
import { signInWithGoogle, signOut } from '../services/authService';
import { firebase, getAuth, isFirebaseConfigured } from '../services/firebaseConfig';
import { LogOut, User as UserIcon, Loader2, AlertCircle, Copy, ExternalLink, ShieldAlert, Settings, Flame } from 'lucide-react';
import { syncUserProfile, logUserActivity } from '../services/firestoreService';

export const UserAuth: React.FC = () => {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorDetails, setErrorDetails] = useState<{ code: string; domain: string; title: string; message: string } | null>(null);

  useEffect(() => {
    const authInstance = getAuth();
    if (!authInstance) {
        setLoading(false);
        return;
    }

    const unsubscribe = authInstance.onAuthStateChanged((u: any) => {
      setUser(u);
      setLoading(false);
      if (u) {
         setErrorDetails(null);
         syncUserProfile(u).catch(e => console.error("Profile sync failed", e));
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setErrorDetails(null);
    try {
      const loggedInUser = await signInWithGoogle();
      if (loggedInUser) {
         logUserActivity('login', { method: 'google' });
      }
    } catch (e: any) {
      console.error("Login failed:", e);
      const domain = window.location.hostname || window.location.host;
      
      if (e.code === 'auth/unauthorized-domain') {
        setErrorDetails({ 
          code: e.code, 
          domain,
          title: "Domain Unauthorized",
          message: "Firebase Authentication is blocking login because this domain is not on your whitelist."
        });
      } else if (e.code === 'auth/configuration-not-found' || e.code === 'auth/operation-not-allowed') {
        setErrorDetails({
          code: e.code,
          domain,
          title: "Provider Disabled",
          message: "Google Sign-In is not enabled in your Firebase project. Please enable it in the console."
        });
      } else if (e.message?.includes("initialized") || e.message?.includes("configuration")) {
        setErrorDetails({
            code: 'init-error',
            domain,
            title: "Configuration Missing",
            message: "Firebase is not correctly configured. Please provide a valid Firebase config object in the Setup tool."
        });
      } else if (e.code === 'auth/popup-closed-by-user') {
        // Silently ignore
      } else {
        alert(`Login failed: ${e.message}`);
      }
    }
  };

  const handleLogout = async () => {
    const uid = user?.uid;
    if (uid) {
       logUserActivity('logout', { uid });
    }
    await signOut();
  };

  if (loading) return (
    <div className="flex items-center px-4 py-2 bg-slate-800/50 rounded-full border border-slate-700">
        <Loader2 size={16} className="animate-spin text-indigo-400" />
    </div>
  );

  if (user) {
    return (
      <div className="flex items-center space-x-2 bg-slate-800 rounded-full pl-2 pr-3 py-1 border border-slate-700">
        <img 
          src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'U')}&background=6366f1&color=fff`} 
          alt={user.displayName || 'User'} 
          className="w-6 h-6 rounded-full border border-indigo-500"
        />
        <span className="text-xs font-medium text-slate-300 hidden sm:inline max-w-[100px] truncate">
          {user.displayName}
        </span>
        <button 
          onClick={handleLogout}
          className="ml-2 text-slate-500 hover:text-red-400 transition-colors"
          title="Sign Out"
        >
          <LogOut size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2 relative">
      {errorDetails && (
         <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-900 border border-red-500/50 rounded-3xl p-8 max-w-lg w-full shadow-2xl space-y-6 text-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                    <ShieldAlert size={32} className="text-red-500" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-white">{errorDetails.title}</h2>
                    <p className="text-slate-400 text-sm">{errorDetails.message}</p>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-4">
                    <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">How to resolve</p>
                        <div className="text-left text-xs text-slate-400 space-y-2">
                            <p>1. Ensure you have provided a valid Firebase Config in the application settings.</p>
                            <p>2. Click the <strong>Setup Icon</strong> (Flame) in the navigation bar to open the config tool.</p>
                        </div>
                    </div>

                    <div className="text-left space-y-2">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Verify Console Settings</p>
                        <ol className="text-xs text-slate-400 list-decimal pl-4 space-y-1">
                            <li>Go to <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-indigo-400 underline inline-flex items-center gap-0.5">Firebase Console <ExternalLink size={10}/></a></li>
                            {errorDetails.code === 'auth/unauthorized-domain' ? (
                              <>
                                <li><strong>Auth</strong> > <strong>Settings</strong> > <strong>Authorized Domains</strong></li>
                                <li>Click <strong>Add Domain</strong> and paste: <code className="text-indigo-300">{errorDetails.domain}</code></li>
                              </>
                            ) : (
                              <>
                                <li><strong>Auth</strong> > <strong>Sign-in method</strong></li>
                                <li>Enable <strong>Google</strong> provider</li>
                              </>
                            )}
                        </ol>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <button 
                        onClick={() => setErrorDetails(null)}
                        className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all"
                    >
                        Dismiss
                    </button>
                </div>
            </div>
         </div>
      )}
      
      {!isFirebaseConfigured ? (
          <button
            onClick={() => {
                const event = new CustomEvent('open-firebase-config');
                window.dispatchEvent(event);
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 text-sm font-bold rounded-full border border-amber-600/30 transition-all shadow-md active:scale-95"
          >
            <Flame size={16} className="animate-pulse" />
            <span>Setup Backend</span>
          </button>
      ) : (
          <button
            onClick={handleLogin}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-full border border-slate-700 transition-all shadow-md active:scale-95"
          >
            <UserIcon size={16} />
            <span>Sign In</span>
          </button>
      )}
    </div>
  );
};