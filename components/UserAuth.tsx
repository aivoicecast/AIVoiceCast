
import React, { useState, useEffect } from 'react';
import firebase from 'firebase/compat/app';
import { signInWithGoogle, signOut } from '../services/authService';
import { auth } from '../services/firebaseConfig';
import { LogOut, User as UserIcon, Loader2, AlertCircle, Copy, ExternalLink, ShieldAlert } from 'lucide-react';
import { syncUserProfile, logUserActivity } from '../services/firestoreService';

export const UserAuth: React.FC = () => {
  const [user, setUser] = useState<firebase.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorDetails, setErrorDetails] = useState<{ code: string; domain: string } | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
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
      
      if (e.code === 'auth/unauthorized-domain') {
        const domain = window.location.hostname || window.location.host;
        setErrorDetails({ code: e.code, domain });
      } else if (e.code === 'auth/configuration-not-found' || e.code === 'auth/operation-not-allowed') {
        alert("Google Sign-In is disabled. Enable it in Firebase Console > Authentication > Sign-in method.");
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

  if (loading) return null;

  if (user) {
    return (
      <div className="flex items-center space-x-2 bg-slate-800 rounded-full pl-2 pr-3 py-1 border border-slate-700">
        <img 
          src={user.photoURL || ''} 
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
                    <h2 className="text-2xl font-bold text-white">Domain Unauthorized</h2>
                    <p className="text-slate-400 text-sm">Firebase Authentication is blocking login because this domain is not on your whitelist.</p>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-4">
                    <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Your Current Domain</p>
                        <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-lg border border-slate-800 group">
                            <code className="text-xs text-indigo-300 flex-1 truncate font-mono">{errorDetails.domain}</code>
                            <button 
                                onClick={() => { navigator.clipboard.writeText(errorDetails.domain); alert("Domain copied!"); }}
                                className="p-1.5 hover:bg-slate-800 rounded text-slate-500 hover:text-white transition-colors"
                            >
                                <Copy size={14} />
                            </button>
                        </div>
                    </div>

                    <div className="text-left space-y-2">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">How to Fix</p>
                        <ol className="text-xs text-slate-400 list-decimal pl-4 space-y-1">
                            <li>Go to <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-indigo-400 underline inline-flex items-center gap-0.5">Firebase Console <ExternalLink size={10}/></a></li>
                            <li><strong>Auth</strong> > <strong>Settings</strong> > <strong>Authorized Domains</strong></li>
                            <li>Click <strong>Add Domain</strong> and paste the URL above</li>
                        </ol>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <button 
                        onClick={() => setErrorDetails(null)}
                        className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all"
                    >
                        Close
                    </button>
                </div>
            </div>
         </div>
      )}
      
      <button
        onClick={handleLogin}
        className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-full border border-slate-700 transition-all shadow-md active:scale-95"
      >
        <UserIcon size={16} />
        <span>Sign In</span>
      </button>
    </div>
  );
};
