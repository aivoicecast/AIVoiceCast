
import React from 'react';
import { ArrowLeft, Zap, Heart, Users, BrainCircuit, Rocket, Code, Palette, Wallet, Truck, Box, Sparkles, TrendingUp, ShieldCheck, Target, Globe, Library, Smartphone, Database, Scale } from 'lucide-react';

interface MissionManifestoProps {
  onBack: () => void;
}

export const MissionManifesto: React.FC<MissionManifestoProps> = ({ onBack }) => {
  return (
    <div className="h-full bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-slate-900 flex items-center gap-4 sticky top-0 bg-slate-950/90 backdrop-blur-md z-20">
        <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold tracking-widest uppercase text-slate-400">2036 Vision Manifest</h1>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
        <div className="max-w-4xl mx-auto px-6 py-12 space-y-24">
          
          {/* Hero Section */}
          <section className="text-center space-y-8 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-900/30 border border-indigo-500/30 text-indigo-300 text-sm font-bold uppercase tracking-wider mb-4">
              <Globe size={16} className="text-indigo-400"/> Neural Sovereignty Protocol
            </div>
            <h2 className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-200 to-slate-400 leading-tight">
              The End of the Cloud.<br />Your Home, Your AI.
            </h2>
            <p className="text-xl md:text-2xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
              We are entering the era where <span className="text-white font-bold">your home is the supercomputer</span>. We refract Gemini super-intelligence from distant data centers into a local "Hub and Client" battalion.
            </p>
          </section>

          {/* 1000x Leap Section */}
          <section className="bg-gradient-to-br from-indigo-950/40 to-slate-950 p-12 rounded-[3rem] border border-indigo-500/20 shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 p-32 bg-indigo-500/10 blur-[100px] rounded-full"></div>
             <div className="relative z-10 flex flex-col items-center text-center space-y-6">
                <div className="w-20 h-20 bg-white/10 rounded-3xl rotate-45 flex items-center justify-center border border-white/20 shadow-2xl">
                    <TrendingUp size={40} className="text-indigo-400 -rotate-45"/>
                </div>
                <h3 className="text-3xl font-black text-white italic tracking-tight uppercase">The 1,000x Intelligence Leap</h3>
                <p className="text-lg text-slate-300 max-w-2xl leading-relaxed">
                  In just four years, we collapsed the cost of super-intelligence by 1,000x. By 2036, the <span className="text-indigo-400 font-bold">"Hub and Client" revolution</span> makes AI virtually free, accessible to all 10 billion humans via shared local hardware.
                </p>
             </div>
          </section>

          {/* Vision Strategy Section */}
          <section className="space-y-12">
            <div className="flex flex-col items-center text-center space-y-4">
                <h3 className="text-xs font-black text-indigo-400 uppercase tracking-[0.4em]">The 2036 Horizon</h3>
                <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">Personal AI Battalions</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] space-y-6 shadow-xl border-l-4 border-l-emerald-500">
                    <Database className="text-emerald-400" size={32} />
                    <h4 className="text-xl font-bold text-white">The Optimus Hub</h4>
                    <p className="text-sm text-slate-400 leading-relaxed">
                        One advanced humanoid shared by 10 residents. It handles heavy-duty tasks and acts as the private, local supercomputer brain. 100% of the reasoning power, 0% of the cloud dependency.
                    </p>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] space-y-6 shadow-xl border-l-4 border-l-indigo-500">
                    <Smartphone className="text-indigo-400" size={32} />
                    <h4 className="text-xl font-bold text-white">The Client Robot</h4>
                    <p className="text-sm text-slate-400 leading-relaxed">
                        Your personal AI iPhone. A smaller, specialized companion for light tasks and emotional support. It offloads complex logic to the shared Optimus Hub via the Neural Handshake.
                    </p>
                </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-32 bg-indigo-600/5 blur-[100px] rounded-full"></div>
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
                    <div className="shrink-0 p-6 bg-slate-950 rounded-[2rem] border border-white/5 shadow-2xl">
                        <Target size={48} className="text-red-500" />
                    </div>
                    <div>
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] mb-2">Architectural Proof</h4>
                        <h3 className="text-2xl font-bold text-white mb-4">11 Billion Nodes</h3>
                        <p className="text-slate-400 text-sm leading-relaxed">
                            Today’s Gemini 3 Pro reasoning is the seed of the 2036 Mesh. We are scaling to a network of 1 billion shared hubs and 10 billion client nodes, ensuring super-intelligence is a public utility owned by the humans it serves.
                        </p>
                    </div>
                </div>
            </div>
          </section>

          {/* Core Pillars */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800 hover:border-indigo-500/50 transition-all duration-500 group">
              <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-indigo-500/20">
                <Zap className="text-indigo-400 w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Virtually Free</h3>
              <p className="text-slate-400 leading-relaxed text-sm">
                Scaling super-intelligence to virtually $0 cost by leveraging relentless algorithmic efficiency and shared local hardware.
              </p>
            </div>

            <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800 hover:border-emerald-500/50 transition-all duration-500 group">
              <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 border border-emerald-500/20">
                <Library className="text-emerald-400 w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Shared Brains</h3>
              <p className="text-slate-400 leading-relaxed text-sm">
                The Hub-and-Client model allows a single Gemini-level brain to orchestrate a personal battalion of nodes for up to 10 users.
              </p>
            </div>

            <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800 hover:border-pink-500/50 transition-all duration-500 group">
              <div className="w-14 h-14 bg-pink-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-pink-500/20">
                <Users className="text-pink-400 w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Local Socraticism</h3>
              <p className="text-slate-400 leading-relaxed text-sm">
                Moving logic from the cloud to your home, ensuring 0ms physical response times and absolute data sovereignty.
              </p>
            </div>
          </section>

          {/* Footer Quote */}
          <div className="text-center pt-12 border-t border-slate-900">
            <p className="text-2xl font-serif italic text-slate-400">
              "We organize the light of super-intelligence to serve the spectrum of humanity."
            </p>
            <div className="mt-8 flex flex-col items-center">
                <div className="w-12 h-px bg-indigo-500 mb-4"></div>
                <p className="text-sm font-bold text-white uppercase tracking-[0.4em]">Neural Prism v7.5.0-DISTRIBUTED</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
