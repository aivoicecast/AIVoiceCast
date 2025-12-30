
import React, { useState, useEffect } from 'react';
import firebase from 'firebase/compat/app';
import { signInWithGoogle, signOut } from '../services/authService';
import { auth } from '../services/firebaseConfig';
import { LogOut, User as UserIcon, Loader2, AlertCircle } from 'lucide-react';
import { syncUserProfile, logUserActivity } from '../services/firestoreService';

export const UserAuth: React.FC = () => {
  const [user, setUser] = useState<firebase.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
      setLoading(false);
      if (u) {
         // Sync profile to Firestore for Role/Group logic
         syncUserProfile(u).catch(e => console.error("Profile sync failed", e));
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setErrorMsg(null);
    try {
      const loggedInUser = await signInWithGoogle();
      if (loggedInUser) {
         logUserActivity('login', { method: 'google' });
      }
    } catch (e: any) {
      console.error("Login failed:", e);
      
      // Handle specific Firebase Auth errors
      if (e.code === 'auth/configuration-not-found' || e.code === 'auth/operation-not-allowed') {
        const msg = "Google Sign-In is disabled. Go to Firebase Console > Authentication > Sign-in method and enable 'Google'.";
        setErrorMsg("Config Error: Enable Google Auth");
        alert(msg);
      } else if (e.code === 'auth/operation-not-supported-in-this-environment') {
        const msg = "Login Failed: This environment does not support Firebase Authentication.\n\nPossible reasons:\n1. You are running from a 'file://' URL. Please use a local web server (http://localhost).\n2. Your browser is blocking third-party cookies or storage.\n3. The application is running in a restricted sandbox.";
        setErrorMsg("Env Error: Protocol/Storage");
        alert(msg);
      } else if (e.code === 'auth/unauthorized-domain') {
        // Capture both hostname and full host to ensure we get the right value in all environments
        const hostname = window.location.hostname;
        const host = window.location.host;
        const currentDomain = hostname || host || window.location.href;
        
        const msg = `⚠️ DOMAIN UNAUTHORIZED ⚠️\n\nYour app is running on: "${currentDomain}"\n\nFirebase blocks login from unknown domains for security.\n\nTO FIX:\n1. Copy this domain: ${currentDomain}\n2. Go to Firebase Console > Authentication > Settings > Authorized Domains\n3. Click "Add Domain" and paste it there.`;
        console.error(msg); 
        setErrorMsg("Domain Unauthorized");
        alert(msg);
      } else if (e.code === 'auth/popup-closed-by-user') {
        setErrorMsg(null);
      } else {
        setErrorMsg("Login Failed");
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
    <div className="flex items-center space-x-2">
      {errorMsg && (
         <div className="hidden md:flex items-center space-x-1 text-red-400 text-xs animate-pulse cursor-help" title={errorMsg}>
            <AlertCircle size={14} />
            <span className="max-w-[100px] truncate">{errorMsg}</span>
         </div>
      )}
      <button
        onClick={handleLogin}
        className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-full border border-slate-700 transition-all shadow-md"
      >
        <UserIcon size={16} />
        <span>Sign In</span>
      </button>
    </div>
  );
};
