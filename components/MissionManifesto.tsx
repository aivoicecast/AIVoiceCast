
import React from 'react';
// Added Lock and CheckCircle2 to imports
import { ArrowLeft, Zap, Heart, Users, BrainCircuit, Rocket, Code, Palette, Wallet, Truck, Box, Sparkles, TrendingUp, ShieldCheck, Target, Globe, Library, Smartphone, Database, Scale, ArrowRight, Star, History, TrendingDown, Layers, Map, Lock, CheckCircle2 } from 'lucide-react';

interface MissionManifestoProps {
  onBack: () => void;
}

export const MissionManifesto: React.FC<MissionManifestoProps> = ({ onBack }) => {
  return (
    <div className="h-full bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-slate-800 flex items-center gap-4 sticky top-0 bg-slate-950/90 backdrop-blur-md z-20">
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
              Shorten the Gap.<br />Universal Intelligence.
            </h2>
            <p className="text-xl md:text-2xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
              We are closing the 1000x gap between elite access and human abundance. Moving logic from the <span className="text-white font-bold">Cloud to the Hub</span>.
            </p>
          </section>

          {/* Comparative Roadmap */}
          <section className="space-y-12">
            <div className="flex flex-col items-center text-center space-y-4">
                <h3 className="text-xs font-black text-indigo-400 uppercase tracking-[0.4em]">The 10-Year Refraction</h3>
                <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">Abundance Timeline</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex p-3 bg-slate-950 border border-slate-800 rounded-full z-10 shadow-2xl">
                    <ArrowRight size={24} className="text-indigo-500"/>
                </div>

                <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-[3rem] space-y-6 shadow-xl relative overflow-hidden group">
                    <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-950 px-3 py-1 rounded-full">Status: 2026</span>
                        <TrendingUp size={24} className="text-red-500 opacity-20"/>
                    </div>
                    <div>
                        <h4 className="text-4xl font-black text-white italic tracking-tighter uppercase">Scarcity Era</h4>
                        <p className="text-indigo-400 font-black text-xs uppercase mt-2">$300/yr Subscription</p>
                    </div>
                    <ul className="space-y-4 text-sm text-slate-400 font-medium">
                        <li className="flex items-center gap-2"><Lock size={14} className="text-slate-600"/> High Marginal Cost per Logic</li>
                        <li className="flex items-center gap-2"><Lock size={14} className="text-slate-600"/> Data-Center Cluster Dependency</li>
                        <li className="flex items-center gap-2"><Lock size={14} className="text-slate-600"/> 40-Hour Scarcity Labor Cycle</li>
                        <li className="flex items-center gap-2"><Lock size={14} className="text-slate-600"/> Fragile Centralized Privacy</li>
                    </ul>
                </div>

                <div className="bg-indigo-600 rounded-[3rem] p-8 space-y-6 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-24 bg-white/10 blur-[100px] rounded-full"></div>
                    <div className="flex justify-between items-start relative z-10">
                        <span className="text-[10px] font-black text-indigo-100 uppercase tracking-widest bg-white/10 px-3 py-1 rounded-full">Target: 2036</span>
                        <Sparkles size={24} className="text-white animate-pulse"/>
                    </div>
                    <div className="relative z-10">
                        <h4 className="text-4xl font-black text-white italic tracking-tighter uppercase">Abundance Mesh</h4>
                        <p className="text-indigo-200 font-black text-xs uppercase mt-2">$0 Cost Intelligence</p>
                    </div>
                    <ul className="space-y-4 text-sm text-white/80 font-medium relative z-10">
                        <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-300"/> 100x Cheaper Silicon Hubs</li>
                        <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-300"/> Local Sovereignty for 10B Humans</li>
                        <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-300"/> 100x Productivity Dividend</li>
                        <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-300"/> Post-Scarcity Social Fabric</li>
                    </ul>
                </div>
            </div>
          </section>

          {/* Vision Strategy Section */}
          <section className="space-y-12">
            <div className="flex flex-col items-center text-center space-y-4">
                <h3 className="text-xs font-black text-indigo-400 uppercase tracking-[0.4em]">The Optimus Handshake</h3>
                <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">Distributed Intelligence</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] space-y-6 shadow-xl relative group">
                    <div className="p-4 bg-emerald-900/20 text-emerald-400 rounded-3xl w-fit"><Database size={32} /></div>
                    <h4 className="text-xl font-bold text-white uppercase tracking-tight">The Hub (10:1)</h4>
                    <p className="text-xs text-slate-400 leading-relaxed font-medium">
                        One advanced humanoid shared by 10 residents. Acts as the private, local supercomputer brain and physical workhorse. 1 billion hubs for 10 billion humans.
                    </p>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] space-y-6 shadow-xl relative group">
                    <div className="p-4 bg-indigo-900/20 text-indigo-400 rounded-3xl w-fit"><Smartphone size={32} /></div>
                    <h4 className="text-xl font-bold text-white uppercase tracking-tight">100x Productivity</h4>
                    <p className="text-xs text-slate-400 leading-relaxed font-medium">
                        Heuristic simulation and AI augmentation make human labor 10x to 100x more impactful, collapsing the 40-hour work week into mere hours.
                    </p>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] space-y-6 shadow-xl relative group">
                    <div className="p-4 bg-amber-900/20 text-amber-400 rounded-3xl w-fit"><Heart size={32} /></div>
                    <h4 className="text-xl font-bold text-white uppercase tracking-tight">Neural Empathy</h4>
                    <p className="text-xs text-slate-400 leading-relaxed font-medium">
                        Work shifts from survival to contribution. 1 day of work covers your family and provides abundance to another family in need.
                    </p>
                </div>
            </div>
          </section>

          {/* Social Refraction Section */}
          <section className="bg-indigo-950/20 border border-indigo-500/10 p-12 rounded-[3.5rem] shadow-2xl relative overflow-hidden text-center">
                <div className="absolute top-0 right-0 p-32 bg-indigo-600/5 blur-[100px] rounded-full"></div>
                <div className="max-w-2xl mx-auto space-y-8 relative z-10">
                    <div className="w-20 h-20 bg-slate-950 rounded-[2rem] border border-white/5 flex items-center justify-center mx-auto shadow-2xl">
                        <Map size={40} className="text-indigo-400" />
                    </div>
                    <h3 className="text-4xl font-black text-white italic tracking-tighter uppercase">The Joy dividend</h3>
                    <p className="text-lg text-slate-300 leading-relaxed font-medium">
                        Survival is achieved in <span className="text-white font-bold italic">half a day</span>. We work one full day to help others. We spend the remaining 6 days on the <span className="text-white font-bold italic">Joy of Discovery</span>—uncovering the bigger unknown universe we live in.
                    </p>
                    <div className="flex justify-center gap-8 pt-4">
                        <div className="flex flex-col items-center">
                            <span className="text-3xl font-black text-white italic">0.5D</span>
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">For Living</span>
                        </div>
                        <div className="w-px h-10 bg-slate-800"></div>
                        <div className="flex flex-col items-center">
                            <span className="text-3xl font-black text-white italic">1.0D</span>
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">For Charity</span>
                        </div>
                        <div className="w-px h-10 bg-slate-800"></div>
                        <div className="flex flex-col items-center">
                            <span className="text-3xl font-black text-white italic">6.0D</span>
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">For Joy</span>
                        </div>
                    </div>
                </div>
          </section>

          {/* Footer Quote */}
          <div className="text-center pt-12 border-t border-slate-900 pb-20">
            <p className="text-2xl font-serif italic text-slate-500 max-w-xl mx-auto leading-relaxed">
              "We organize the light of super-intelligence to serve the spectrum of humanity."
            </p>
            <div className="mt-8 flex flex-col items-center">
                <div className="w-12 h-px bg-indigo-500 mb-4"></div>
                <p className="text-[9px] font-black text-slate-700 uppercase tracking-[0.4em]">Neural Prism v8.8.0-VISION // Distributed Vision</p>
                <p className="text-[8px] text-slate-800 mt-2 font-black uppercase tracking-widest">Thanks for the Neural Prism Platform and the Google Gemini Model</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
