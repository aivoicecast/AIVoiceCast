
import React from 'react';
import { ArrowLeft, Shield, Lock, Eye, Database, Server, Cloud, HardDrive, Github, Wallet, Truck, ImageIcon } from 'lucide-react';

interface PrivacyPolicyProps {
  onBack: () => void;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col animate-fade-in">
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
        <div className="max-w-4xl mx-auto px-6 py-12 space-y-12 text-slate-300 leading-relaxed">
            
            <div className="bg-slate-900/50 p-8 rounded-[2rem] border border-slate-800 shadow-xl">
                <p className="text-lg text-slate-200 font-medium">
                    AIVoiceCast operates as a <strong>Neural Prism Intelligence Hub</strong>. We prioritize user sovereignty, utilizing a hybrid storage model where sensitive creative and financial data is handled across multiple secure environments.
                </p>
            </div>

            <section className="space-y-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Database className="text-indigo-400"/> 1. Decentralized Storage Backends</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                        <h3 className="font-bold text-white flex items-center gap-2 mb-3"><HardDrive size={18} className="text-emerald-400"/> Local Browser Cache</h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            <strong>Data:</strong> Neural audio fragments, ECDSA Private Keys, offline ledger drafts, unsaved channel curriculums.<br/>
                            <strong>Privacy:</strong> Device-local only. This data is never transmitted to Neural Prism servers unless you explicitly trigger a "Cloud Sync" or "Publish" event.
                        </p>
                    </div>

                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                        <h3 className="font-bold text-white flex items-center gap-2 mb-3"><Cloud size={18} className="text-amber-400"/> Global Neural Ledger</h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            <strong>Data:</strong> Public profiles, community blog posts, team messages, and the VoiceCoin global transaction history.<br/>
                            <strong>Privacy:</strong> Stored on our secure Google Cloud (Firebase) instance. Transactions are cryptographically signed but visible on the global ledger for auditability.
                        </p>
                    </div>

                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                        <h3 className="font-bold text-white flex items-center gap-2 mb-3"><Server size={18} className="text-blue-400"/> Personal Google Drive</h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            <strong>Data:</strong> Builder Studio source files, Generated PDF checks, Shipping labels, and meeting recordings.<br/>
                            <strong>Privacy:</strong> Neural Prism acts only as a gateway. We do not store copies of your Drive files on our servers. Access is strictly via your personal OAuth token.
                        </p>
                    </div>

                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                        <h3 className="font-bold text-white flex items-center gap-2 mb-3"><Github size={18} className="text-white"/> Version Control</h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            <strong>Data:</strong> Integrated repositories in Builder Studio.<br/>
                            <strong>Privacy:</strong> Managed directly via the GitHub API using your personal access tokens. We adhere to your repository visibility settings.
                        </p>
                    </div>
                </div>
            </section>

            <section className="space-y-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Lock className="text-indigo-400"/> 2. Neural Application Privacy</h2>
                
                <div className="space-y-8">
                    <div className="flex gap-4">
                        <div className="p-3 bg-amber-900/20 rounded-xl text-amber-500 h-fit"><Wallet size={20}/></div>
                        <div>
                            <h3 className="text-lg font-bold text-white mb-2">VoiceCoin & Cryptographic Identity</h3>
                            <p className="text-sm text-slate-400">
                                Your digital identity is generated on-device using the Web Crypto API. Neural Prism never sees or stores your <strong>Private Key</strong>. We only store your <strong>Certificate</strong> (Public Key signed by our Root) to enable peer-to-peer trust verification.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="p-3 bg-blue-900/20 rounded-xl text-blue-500 h-fit"><ImageIcon size={20}/></div>
                        <div>
                            <h3 className="text-lg font-bold text-white mb-2">Generative Asset Rights</h3>
                            <p className="text-sm text-slate-400">
                                Icons, Gift Workshop assets, and specialized neural art generated via the <strong>Neural Prism</strong> are owned by you. However, prompts and contexts used for generation are processed via Google Gemini and are subject to their service terms.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="p-3 bg-emerald-900/20 rounded-xl text-emerald-500 h-fit"><Truck size={20}/></div>
                        <div>
                            <h3 className="text-lg font-bold text-white mb-2">Logistics & Shipping Data</h3>
                            <p className="text-sm text-slate-400">
                                Address data used in the <strong>Logistics Lab</strong> or <strong>Finance Hub</strong> is stored temporarily in memory for PDF generation. Permanent storage of these documents occurs only in your <strong>Personal Google Drive</strong>.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="space-y-4">
                <h2 className="text-2xl font-bold text-white">3. AI Transparency</h2>
                <p className="text-sm">
                    The <strong>Neural Prism</strong> engine uses Google Gemini 3.0 models. Data sent for synthesis (transcripts, code, voice) is not used to train our internal models. We utilize <em>stateless sessions</em> wherever possible to minimize the persistence of prompt data.
                </p>
            </section>

            <div className="pt-8 border-t border-slate-800 text-center text-xs text-slate-500">
                <p>Neural Prism Privacy Framework v4.4.0</p>
                <p className="mt-1">Last Updated: December 22, 2025</p>
                <p className="mt-4">For data deletion or identity revocation, contact <a href="mailto:ops@neuralprism.io" className="text-indigo-400 hover:underline">ops@neuralprism.io</a>.</p>
            </div>
        </div>
      </div>
    </div>
  );
};
