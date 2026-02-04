
import React from 'react';
import { ArrowLeft, Shield, Lock, Eye, Database, Server, Cloud, HardDrive, Github, Wallet, Truck, Image as ImageIcon } from 'lucide-react';

interface PrivacyPolicyProps {
  onBack: () => void;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onBack }) => {
  return (
    <div className="h-full bg-slate-950 text-slate-100 flex flex-col animate-fade-in">
      {/* Header */}
      <div className="p-6 border-b border-slate-900 flex items-center gap-4 sticky top-0 bg-slate-950/90 backdrop-blur-md z-20">
        <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold tracking-widest uppercase text-slate-400 flex items-center gap-2">
            <Shield size={20} className="text-emerald-400"/> Privacy & Data Ethics
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-12 space-y-12 text-slate-300 leading-relaxed pb-32">
            
            <div className="bg-slate-900/50 p-8 rounded-[2rem] border border-slate-800 shadow-xl">
                <p className="text-lg text-slate-200 font-medium">
                    Neural Prism operates as a <strong>Sovereign Intelligence Hub</strong>. We prioritize user sovereignty, utilizing a hybrid storage model where sensitive creative and financial data is handled across multiple secure environments.
                </p>
            </div>

            <section className="space-y-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Database size={24} className="text-indigo-400"/> 1. Storage Framework</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                        <h3 className="font-bold text-white flex items-center gap-2 mb-3"><HardDrive size={18} className="text-emerald-400"/> Local Cache</h3>
                        <p className="text-xs text-slate-400">
                            Neural audio fragments and private keys are stored device-local only. This data is never transmitted to our servers.
                        </p>
                    </div>
                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                        <h3 className="font-bold text-white flex items-center gap-2 mb-3"><Cloud size={18} className="text-amber-400"/> Community Ledger</h3>
                        <p className="text-xs text-slate-400">
                            Public profiles and global transaction history are stored on our secure cloud instances for auditability.
                        </p>
                    </div>
                </div>
            </section>

            <section className="space-y-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Lock size={24} className="text-indigo-400"/> 2. Data Sovereignty</h2>
                <p className="text-sm">
                    Intelligence is refracted, not retained. We utilize stateless sessions to minimize data persistence. All technical artifacts reside in your personal cloud (Google Drive/GitHub).
                </p>
            </section>

            <div className="pt-8 border-t border-slate-800 text-center text-xs text-slate-500">
                <p>Neural Prism Privacy Framework v7.0.0-ULTRA</p>
                <p className="mt-1">Last Updated: January 25, 2026</p>
            </div>
        </div>
      </div>
    </div>
  );
};
