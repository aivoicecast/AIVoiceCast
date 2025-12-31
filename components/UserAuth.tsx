
import React, { useState, useEffect } from 'react';
import { signInWithGoogle, signOut } from '../services/authService';
import { getAuth } from '../services/firebaseConfig';
import { LogOut, User as UserIcon, Loader2 } from 'lucide-react';
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
      <div className="flex items-center space-x-2 bg-slate-800/50 rounded-full pl-2 pr-3 py-1 border border-slate-700 hover:bg-slate-800 transition-colors">
        <img 
          src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'U')}&background=6366f1&color=fff`} 
          alt={user.displayName || 'User'} 
          className="w-7 h-7 rounded-full border border-indigo-500 object-cover"
        />
        <span className="text-xs font-bold text-slate-200 hidden lg:inline max-w-[100px] truncate">
          {user.displayName?.split(' ')[0]}
        </span>
        <div className="w-px h-4 bg-slate-700 mx-1 hidden lg:block"></div>
        <button 
          onClick={handleLogout}
          className="p-1 text-slate-500 hover:text-red-400 transition-colors"
          title="Sign Out"
        >
          <LogOut size={14} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleLogin}
      className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-full transition-all shadow-lg active:scale-95"
    >
      <UserIcon size={16} />
      <span>Sign In</span>
    </button>
  );
};
