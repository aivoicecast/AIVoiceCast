
import React, { useState } from 'react';
import { X, Check, Zap, Loader2, Sparkles, Crown, CreditCard, AlertCircle, Terminal, RefreshCw, Key, ShieldCheck } from 'lucide-react';
import { UserProfile, SubscriptionTier } from '../types';
import { createStripeCheckoutSession, forceUpgradeDebug } from '../services/firestoreService';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onSuccess: (tier: SubscriptionTier) => void;
}

export const PricingModal: React.FC<PricingModalProps> = ({ isOpen, onClose, user, onSuccess }) => {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);

  if (!isOpen) return null;

  const handleCheckout = async () => {
    if (!user || !user.uid) {
        setError("Error: User profile is incomplete. Please sign out and sign in again.");
        return;
    }

    setProcessing(true);
    setError(null);
    setShowRules(false);
    
    try {
      const url = await createStripeCheckoutSession(user.uid);
      window.location.assign(url);
    } catch (e: any) {
      console.error("Checkout Creation Failed:", e);
      let msg = e.message || "Unknown error.";
      
      if (msg.includes("permission-denied")) {
          msg = "Permission Denied: Firebase Security Rules are blocking the request.";
          setShowRules(true);
      } else if (msg.includes("Configuration Error")) {
          // Pass through specific config errors
      }
      
      setError(msg);
      setProcessing(false);
    }
  };

  const handleDevBypass = async () => {
      setProcessing(true);
      try {
          await forceUpgradeDebug(user.uid);
          onSuccess('pro');
          alert("Debug Mode: You have been upgraded to Pro locally. Refresh the page if needed.");
          onClose();
      } catch (e) {
          alert("Bypass failed: " + e);
          setProcessing(false);
      }
  };

  const currentTier = user.subscriptionTier || 'free';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in-up my-auto relative">
        
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50 shrink-0">
          <div>
             <h2 className="text-2xl font-bold text-white">Upgrade Plan</h2>
             <p className="text-slate-400 text-sm">Unlock the full power of AIVoiceCast.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-8 overflow-y-auto flex-1 flex flex-col items-center justify-center">
           
           {error && (
               <div className="w-full max-w-3xl mb-6 bg-red-900/20 border border-red-900/50 rounded-xl p-4 flex flex-col gap-3 animate-fade-in">
                   <div className="flex items-start gap-3">
                       <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
                       <div className="text-red-200 text-sm flex-1">
                           <p className="font-bold">Payment Setup Error</p>
                           <p>{error}</p>
                       </div>
                   </div>

                   {/* Debug Tools */}
                   <div className="pl-8 flex flex-col gap-3 mt-2">
                       <button 
                           onClick={handleDevBypass}
                           className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 shadow-lg"
                       >
                           <Zap size={14} fill="currentColor"/>
                           DEV BYPASS: Force Upgrade (Skip Payment)
                       </button>
                       
                       {showRules && (
                           <div className="bg-slate-950 p-3 rounded-lg border border-slate-700">
                               <p className="text-xs text-slate-400 mb-2 font-bold flex items-center gap-2">
                                   <ShieldCheck size={12}/> Required Firestore Rules (Copy to Firebase Console):
                               </p>
                               <pre className="text-[10px] font-mono text-indigo-300 overflow-x-auto whitespace-pre-wrap select-all">
{`match /customers/{uid} {
  allow read: if request.auth.uid == uid;

  match /checkout_sessions/{id} {
    allow read, write: if request.auth.uid == uid;
  }
  match /subscriptions/{id} {
    allow read: if request.auth.uid == uid;
  }
  match /payments/{id} {
    allow read: if request.auth.uid == uid;
  }
}`}
                               </pre>
                           </div>
                       )}
                   </div>
               </div>
           )}

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-3xl">
              
              {/* FREE TIER */}
              <div className="bg-slate-800/30 border border-slate-700 rounded-2xl p-8 flex flex-col relative h-full">
                 <h3 className="text-xl font-bold text-white mb-2">Free Starter</h3>
                 <div className="text-4xl font-bold text-white mb-6">$0 <span className="text-sm font-normal text-slate-500">/mo</span></div>
                 
                 <ul className="space-y-4 mb-8 flex-1">
                    <li className="flex items-center gap-3 text-sm text-slate-300"><Check size={18} className="text-emerald-500"/> Unlimited Listening</li>
                    <li className="flex items-center gap-3 text-sm text-slate-300"><Check size={18} className="text-emerald-500"/> 5 AI Generation Credits</li>
                    <li className="flex items-center gap-3 text-sm text-slate-300"><Check size={18} className="text-emerald-500"/> Public Groups Only</li>
                    <li className="flex items-center gap-3 text-sm text-slate-500"><X size={18} /> No Private Channels</li>
                    <li className="flex items-center gap-3 text-sm text-slate-500"><X size={18} /> Standard Voice Quality</li>
                 </ul>

                 <button 
                    disabled={true}
                    className="w-full py-4 rounded-xl border border-slate-600 text-slate-400 font-bold text-sm cursor-default"
                 >
                    Current Plan
                 </button>
              </div>

              {/* PRO TIER */}
              <div className="bg-gradient-to-b from-indigo-900/20 to-slate-900 border border-indigo-500 rounded-2xl p-8 flex flex-col relative transform hover:scale-[1.02] transition-transform shadow-2xl shadow-indigo-500/10">
                 <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs uppercase font-bold px-4 py-1.5 rounded-full shadow-lg flex items-center gap-1 whitespace-nowrap z-10">
                    <Sparkles size={12} fill="currentColor"/> Limited Offer: 1¢ First Month
                 </div>
                 <h3 className="text-xl font-bold text-indigo-300 mb-2 flex items-center gap-2">Pro Membership</h3>
                 
                 {/* Pricing Promotion Display */}
                 <div className="flex items-baseline gap-2 mb-2">
                    <div className="text-4xl font-bold text-white">$0.01</div>
                    <div className="flex flex-col items-start leading-none">
                        <span className="text-xs text-emerald-400 font-bold uppercase">1st Month</span>
                        <span className="text-xs text-slate-500 decoration-slate-600 line-through">$29.00</span>
                    </div>
                 </div>
                 <p className="text-xs text-slate-400 mb-6">Then $29/mo. Cancel anytime.</p>
                 
                 <ul className="space-y-4 mb-8 flex-1">
                    <li className="flex items-center gap-3 text-sm text-white"><Check size={18} className="text-indigo-400"/> <strong>Unlimited</strong> AI Generation</li>
                    <li className="flex items-center gap-3 text-sm text-white"><Check size={18} className="text-indigo-400"/> <strong>Private</strong> Channels & Groups</li>
                    <li className="flex items-center gap-3 text-sm text-white"><Check size={18} className="text-indigo-400"/> Neural Voices (Gemini)</li>
                    <li className="flex items-center gap-3 text-sm text-white"><Check size={18} className="text-indigo-400"/> Code Studio Pro (Git Sync)</li>
                    <li className="flex items-center gap-3 text-sm text-white"><Check size={18} className="text-indigo-400"/> Priority 1-on-1 Mentorship</li>
                 </ul>

                 {currentTier === 'pro' ? (
                     <button disabled className="w-full py-4 bg-slate-700 text-white font-bold rounded-xl text-sm border border-slate-600">Plan Active</button>
                 ) : (
                     <button 
                        onClick={handleCheckout}
                        disabled={processing}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm shadow-xl shadow-indigo-500/20 transition-all flex justify-center items-center gap-2"
                     >
                        {processing ? (
                            <>
                                <Loader2 className="animate-spin" size={18}/> 
                                <span>Initializing...</span>
                            </>
                        ) : (
                            <><CreditCard size={18}/> Claim Offer: $0.01 for 1st Mo</>
                        )}
                     </button>
                 )}
              </div>

           </div>
           
           <div className="mt-8 text-center text-xs text-slate-500">
              <p>Secure payment processing via Stripe. You can cancel at any time.</p>
              <p className="mt-1">All prices in USD. Enterprise plans available.</p>
           </div>
        </div>
      </div>
    </div>
  );
};