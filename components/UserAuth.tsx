
import React, { useState, useEffect } from 'react';
import { signInWithGoogle, signOut } from '../services/authService';
import { firebase, getAuth, isFirebaseConfigured } from '../services/firebaseConfig';
import { LogOut, User as UserIcon, Loader2, AlertCircle, Copy, ExternalLink, ShieldAlert, Settings, Flame } from 'lucide-react';
import { syncUserProfile, logUserActivity } from '../services/firestoreService';

export const UserAuth: React.FC = () => {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

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
         syncUserProfile(u).catch(e => console.error("Profile sync failed", e));
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      const loggedInUser = await signInWithGoogle();
      if (loggedInUser) {
         logUserActivity('login', { method: 'google' });
      }
    } catch (e: any) {
      console.error("Login failed:", e);
      if (e.code === 'auth/popup-closed-by-user') {
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
