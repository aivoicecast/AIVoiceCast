import React, { useState, useEffect } from 'react';
// FIXED: Using @firebase/ scoped packages
import { onAuthStateChanged } from '@firebase/auth';
import { signInWithGoogle, signOut } from '../services/authService';
import { getAuthInstance } from '../services/firebaseConfig';
import { LogOut, User as UserIcon, Loader2 } from 'lucide-react';
import { syncUserProfile, logUserActivity } from '../services/firestoreService';

export const UserAuth: React.FC = () => {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const authInstance = getAuthInstance();
    if (!authInstance) {
        setLoading(false);
        return;
    }

    const unsubscribe = onAuthStateChanged(authInstance, (u: any) => {
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
    if (confirm("Sign out?")) {
        await signOut();
    }
  };

  if (loading) return (
    <div className="flex items-center px-4 py-2 bg-slate-800/50 rounded-full border border-slate-700">
        <Loader2 size={16} className="animate-spin text-indigo-400" />
    </div>
  );

  if (user) {
    return (
      <div className="flex items-center space-x-2 bg-slate-800/50 rounded-full pl-1 pr-2 py-0.5 border border-slate-700">
        <img 
          src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'U')}&background=6366f1&color=fff`} 
          alt={user.displayName || 'User'} 
          className="w-7 h-7 rounded-full border border-indigo-500 object-cover"
        />
        <button 
          onClick={handleLogout}
          className="p-1 text-slate-500 hover:text-red-400 transition-colors"
          title="Quick Sign Out"
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