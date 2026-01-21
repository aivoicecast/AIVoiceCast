
import React, { useState } from 'react';
import { X, Check, Zap, Loader2, Sparkles, Crown, CreditCard, AlertCircle, ShieldCheck, Coins, Lock } from 'lucide-react';
import { UserProfile, SubscriptionTier } from '../types';
import { setUserSubscriptionTier, getUserProfile } from '../services/firestoreService';
import { auth } from '../services/firebaseConfig';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onSuccess: (tier: SubscriptionTier) => void;
}

export const PricingModal: React.FC<PricingModalProps> = ({ isOpen, onClose, user, onSuccess }) => {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const effectiveUid = user?.uid || auth?.currentUser?.uid;
  const currentTier = user?.subscriptionTier || 'free';

  const handleUpgrade = async () => {
    if (!effectiveUid) {
        setError("User session lost. Please sign in again.");
        return;
    }

    setProcessing(true);
    setError(null);
    
    try {
      // 1. Direct Firestore update
      await setUserSubscriptionTier(effectiveUid, 'pro');
      
      // 2. Proactive verification - fetch fresh profile to ensure sync
      const freshProfile = await getUserProfile(effectiveUid);
      if (freshProfile?.subscriptionTier === 'pro') {
          setSuccess(true);
          // 3. IMMEDIATE CALLBACK to update App.tsx local state
          onSuccess('pro');
          
          setTimeout(() => {
              onClose();
              setSuccess(false);
              setProcessing(false);
          }, 1500);
      } else {
          throw new Error("Tier update not yet reflected in neural ledger. Please try again.");
      }
      
    } catch (e: any) {
      console.error("Upgrade Failed:", e);
      setError(e.message || "Upgrade handshake failed.");
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-[2.5rem] w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in-up relative">
        
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50 shrink-0">
          <div>
             <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">Neural Clearance Upgrade</h2>
             <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Acquire Full Spectrum Access</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-10 overflow-y-auto flex-1 flex flex-col items-center justify-center">
           
           {error && (
               <div className="w-full max-w-3xl mb-6 bg-red-900/20 border border-red-900/50 rounded-2xl p-4 flex items-start gap-3 animate-fade-in">
                   <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
                   <div className="text-red-200 text-sm">
                       <p className="font-bold uppercase tracking-tight">Handshake Failure</p>
                       <p>{error}</p>
                   </div>
               </div>
           )}

           {success && (
               <div className="w-full max-w-3xl mb-6 bg-emerald-900/20 border border-emerald-900/50 rounded-2xl p-8 flex flex-col items-center gap-4 animate-fade-in">
                   <div className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg animate-bounce">
                       <Check size={40} strokeWidth={4}/>
                   </div>
                   <div className="text-emerald-200 text-center">
                       <p className="text-3xl font-black uppercase tracking-tighter italic">Membership Verified</p>
                       <p className="text-sm opacity-80 mt-1">Full Neural Spectrum access granted to your profile. Redirecting...</p>
                   </div>
               </div>
           )}

           <div className={`grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-3xl transition-all duration-500 ${success ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100'}`}>
              
              {/* FREE TIER */}
              <div className="bg-slate-800/30 border border-slate-700 rounded-[2.5rem] p-8 flex flex-col relative h-full grayscale opacity-60">
                 <h3 className="text-xl font-black text-white uppercase tracking-widest mb-2">Standard Hub</h3>
                 <div className="text-5xl font-black text-white mb-6 tracking-tighter">$0</div>
                 
                 <ul className="space-y-4 mb-8 flex-1">
                    <li className="flex items-center gap-3 text-xs font-bold text-slate-300 uppercase tracking-wider"><Check size={16} className="text-emerald-500"/> Public Lessons</li>
                    <li className="flex items-center gap-3 text-xs font-bold text-slate-300 uppercase tracking-wider"><Check size={16} className="text-emerald-500"/> Basic Activity Hub</li>
                    <li className="flex items-center gap-3 text-xs font-bold text-slate-600 line-through uppercase tracking-wider"><Lock size={16}/> Specialized AI Suite</li>
                    <li className="flex items-center gap-3 text-xs font-bold text-slate-600 line-through uppercase tracking-wider"><Lock size={16}/> Sovereign Builder Studio</li>
                 </ul>

                 <button disabled className="w-full py-4 rounded-2xl border border-slate-700 text-[10px] font-black uppercase tracking-widest text-slate-500 cursor-default">Current Plan</button>
              </div>

              {/* PRO TIER */}
              <div className="bg-gradient-to-b from-indigo-900/40 to-slate-900 border border-indigo-500/50 rounded-[2.5rem] p-8 flex flex-col relative transform hover:scale-[1.02] transition-all shadow-2xl shadow-indigo-500/10 group">
                 <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-amber-500 to-orange-600 text-white text-[10px] uppercase font-black px-5 py-2 rounded-full shadow-lg flex items-center gap-1.5 whitespace-nowrap z-10 border border-amber-400/50">
                    <Sparkles size={12} fill="currentColor"/> Elite Access
                 </div>
                 <h3 className="text-xl font-black text-indigo-300 uppercase tracking-widest mb-2 flex items-center gap-2">Neural Architect</h3>
                 
                 <div className="flex items-baseline gap-2 mb-6">
                    <div className="text-6xl font-black text-white tracking-tighter">$29<span className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">/mo</span></div>
                 </div>
                 
                 <ul className="space-y-4 mb-8 flex-1">
                    <li className="flex items-center gap-3 text-xs font-bold text-white uppercase tracking-wider"><Sparkles size={16} className="text-indigo-400"/> Unlocked: Builder Studio Pro</li>
                    <li className="flex items-center gap-3 text-xs font-bold text-white uppercase tracking-wider"><Sparkles size={16} className="text-indigo-400"/> Unlocked: Mock Interview Lab</li>
                    <li className="flex items-center gap-3 text-xs font-bold text-white uppercase tracking-wider"><Sparkles size={16} className="text-indigo-400"/> Unlocked: Unlimited AI Agents</li>
                    <li className="flex items-center gap-3 text-xs font-bold text-amber-500 uppercase tracking-wider"><Coins size={16}/> 1M VoiceCoins / mo</li>
                 </ul>

                 {currentTier === 'pro' ? (
                     <button disabled className="w-full py-5 bg-emerald-600/20 text-emerald-400 font-black uppercase tracking-widest rounded-2xl text-xs border border-emerald-500/30">Verified Spectrum</button>
                 ) : (
                     <button 
                        onClick={handleUpgrade}
                        disabled={processing}
                        className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-[0.2em] rounded-2xl text-xs shadow-2xl shadow-indigo-900/40 transition-all flex justify-center items-center gap-3 active:scale-95"
                     >
                        {processing ? <Loader2 className="animate-spin" size={20}/> : <><Crown size={20} fill="currentColor"/> Unlock Everything</>}
                     </button>
                 )}
              </div>

           </div>
           
           <div className="mt-12 text-center">
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">Instant Handshake • Sovereign Ledger Update</p>
           </div>
        </div>
      </div>
    </div>
  );
};
