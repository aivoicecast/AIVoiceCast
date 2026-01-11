import React, { useState } from 'react';
import { X, Check, Zap, Loader2, Sparkles, Crown, CreditCard, AlertCircle, ShieldCheck, Coins } from 'lucide-react';
import { UserProfile, SubscriptionTier } from '../types';
import { setUserSubscriptionTier } from '../services/firestoreService';
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

  // Use the profile UID or fall back to the raw auth UID to prevent hanging
  const effectiveUid = user?.uid || auth?.currentUser?.uid;
  const currentTier = user?.subscriptionTier || 'free';

  const handleUpgrade = async () => {
    if (!effectiveUid) {
        setError("User identification failed. Please sign in again.");
        return;
    }

    setProcessing(true);
    setError(null);
    
    try {
      // In this environment, we fulfill the 'Pro' request directly in Firestore 
      await setUserSubscriptionTier(effectiveUid, 'pro');
      setSuccess(true);
      onSuccess('pro');
      
      // Auto close on success
      setTimeout(() => {
          onClose();
      }, 2000);
      
    } catch (e: any) {
      console.error("Upgrade Failed:", e);
      setError(e.message || "Failed to update subscription tier.");
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in-up my-auto relative">
        
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50 shrink-0">
          <div>
             <h2 className="text-2xl font-bold text-white">Upgrade Plan</h2>
             <p className="text-slate-400 text-sm">Unlock the full spectrum of the Neural Prism.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-8 overflow-y-auto flex-1 flex flex-col items-center justify-center">
           
           {error && (
               <div className="w-full max-w-3xl mb-6 bg-red-900/20 border border-red-900/50 rounded-xl p-4 flex items-start gap-3 animate-fade-in">
                   <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
                   <div className="text-red-200 text-sm">
                       <p className="font-bold">Setup Error</p>
                       <p>{error}</p>
                   </div>
               </div>
           )}

           {success && (
               <div className="w-full max-w-3xl mb-6 bg-emerald-900/20 border border-emerald-900/50 rounded-xl p-6 flex flex-col items-center gap-3 animate-fade-in">
                   <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg">
                       <Check size={28} strokeWidth={3}/>
                   </div>
                   <div className="text-emerald-200 text-center">
                       <p className="text-xl font-bold">Refraction Complete!</p>
                       <p className="text-sm opacity-80">Your Pro membership has been activated successfully.</p>
                   </div>
               </div>
           )}

           <div className={`grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-3xl transition-opacity duration-500 ${success ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
              
              {/* FREE TIER */}
              <div className="bg-slate-800/30 border border-slate-700 rounded-2xl p-8 flex flex-col relative h-full">
                 <h3 className="text-xl font-bold text-white mb-2">Free Starter</h3>
                 <div className="text-4xl font-bold text-white mb-6">$0 <span className="text-sm font-normal text-slate-500">/mo</span></div>
                 
                 <ul className="space-y-4 mb-8 flex-1">
                    <li className="flex items-center gap-3 text-sm text-slate-300"><Check size={18} className="text-emerald-500"/> Activity Hub Access</li>
                    <li className="flex items-center gap-3 text-sm text-slate-300"><Check size={18} className="text-emerald-500"/> 5 AI Generation Credits</li>
                    <li className="flex items-center gap-3 text-sm text-slate-300"><Check size={18} className="text-emerald-500"/> Public Communities Only</li>
                    <li className="flex items-center gap-3 text-sm text-slate-300"><Coins size={18} className="text-amber-500"/> <strong>100 Coins</strong> / mo</li>
                 </ul>

                 <button 
                    disabled={true}
                    className={`w-full py-4 rounded-xl border border-slate-600 font-bold text-sm cursor-default ${currentTier === 'free' ? 'text-white border-indigo-500 bg-indigo-900/20' : 'text-slate-400'}`}
                 >
                    {currentTier === 'free' ? 'Current Plan' : 'Standard'}
                 </button>
              </div>

              {/* PRO TIER */}
              <div className="bg-gradient-to-b from-indigo-900/20 to-slate-900 border border-indigo-500 rounded-2xl p-8 flex flex-col relative transform hover:scale-[1.02] transition-transform shadow-2xl shadow-indigo-500/10">
                 <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs uppercase font-bold px-4 py-1.5 rounded-full shadow-lg flex items-center gap-1 whitespace-nowrap z-10">
                    <Sparkles size={12} fill="currentColor"/> Pro Access
                 </div>
                 <h3 className="text-xl font-bold text-indigo-300 mb-2 flex items-center gap-2">Pro Membership</h3>
                 
                 <div className="flex items-baseline gap-2 mb-2">
                    <div className="text-4xl font-bold text-white">$0.01</div>
                    <div className="flex flex-col items-start leading-none">
                        <span className="text-xs text-emerald-400 font-bold uppercase">Activation</span>
                        <span className="text-xs text-slate-500 decoration-slate-600 line-through">$29.00</span>
                    </div>
                 </div>
                 <p className="text-xs text-slate-400 mb-6">Immediate access to the full spectrum.</p>
                 
                 <ul className="space-y-4 mb-8 flex-1">
                    <li className="flex items-center gap-3 text-sm text-white"><Check size={18} className="text-indigo-400"/> <strong>Unlimited</strong> AI Refraction</li>
                    <li className="flex items-center gap-3 text-sm text-white"><Coins size={18} className="text-amber-500"/> <strong>2,900 Coins</strong> / mo ($29 value)</li>
                    <li className="flex items-center gap-3 text-sm text-white"><Check size={18} className="text-indigo-400"/> Private Workshops & Labs</li>
                    <li className="flex items-center gap-3 text-sm text-white"><Check size={18} className="text-indigo-400"/> Builder Studio Pro (Git Sync)</li>
                 </ul>

                 {!effectiveUid ? (
                     <div className="w-full py-3 bg-slate-800 rounded-xl flex items-center justify-center gap-2">
                         <Loader2 size={18} className="animate-spin text-slate-500"/>
                         <span className="text-xs font-bold text-slate-500">Syncing Profile...</span>
                     </div>
                 ) : currentTier === 'pro' ? (
                     <button disabled className="w-full py-4 bg-slate-700 text-white font-bold rounded-xl text-sm border border-slate-600">Plan Active</button>
                 ) : (
                     <button 
                        onClick={handleUpgrade}
                        disabled={processing}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm shadow-xl shadow-indigo-500/20 transition-all flex justify-center items-center gap-2 active:scale-[0.98]"
                     >
                        {processing ? (
                            <>
                                <Loader2 className="animate-spin" size={18}/> 
                                <span>Activating...</span>
                            </>
                        ) : (
                            <><Crown size={18} fill="currentColor"/> Activate Pro Membership</>
                        )}
                     </button>
                 )}
              </div>

           </div>
           
           <div className="mt-8 text-center text-xs text-slate-500">
              <p>Platform upgrade processed via internal neural fabric.</p>
              <p className="mt-1">By upgrading, you join a community dedicated to human potential.</p>
           </div>
        </div>
      </div>
    </div>
  );
};