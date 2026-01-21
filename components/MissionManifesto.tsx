
import React from 'react';
import { ArrowLeft, Zap, Heart, Users, BrainCircuit, Rocket, Code, Palette, Wallet, Truck, Box, Sparkles } from 'lucide-react';

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
        <h1 className="text-xl font-bold tracking-widest uppercase text-slate-400">Mission & Vision</h1>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
        <div className="max-w-4xl mx-auto px-6 py-12 space-y-24">
          
          {/* Hero Section */}
          <section className="text-center space-y-8 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-900/30 border border-indigo-500/30 text-indigo-300 text-sm font-bold uppercase tracking-wider mb-4">
              <Sparkles size={16} className="text-indigo-400"/> Neural Prism Platform v5.6.0
            </div>
            <h2 className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-200 to-slate-400 leading-tight">
              Complex Intelligence.<br />Beautifully Accessible.
            </h2>
            <p className="text-xl md:text-2xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
              We pass <span className="text-white font-bold">AI Super-Intelligence</span> through our Magic Prism, resulting in a spectrum of tools that are user-friendly, daily-ready, and deeply human.
            </p>
          </section>

          {/* The Prism Metaphor */}
          <section className="bg-gradient-to-br from-indigo-950/40 to-slate-950 p-12 rounded-[3rem] border border-indigo-500/20 shadow-2xl relative overflow-hidden">
             <div className="relative z-10 flex flex-col items-center text-center space-y-6">
                <div className="w-20 h-20 bg-white/10 rounded-3xl rotate-45 flex items-center justify-center border border-white/20 shadow-2xl">
                    <Sparkles size={40} className="text-indigo-400 -rotate-45"/>
                </div>
                <h3 className="text-3xl font-black text-white italic tracking-tight uppercase">The Magic Prism Effect</h3>
                <p className="text-lg text-slate-300 max-w-2xl leading-relaxed">
                  Raw AI models are overwhelming. Our platform acts as a refractive lens, turning powerful but complex logic into 20+ specialized "rainbow" tools. From creating holiday cards to auditing code, we make intelligence accessible to every human being.
                </p>
             </div>
          </section>

          {/* Core Pillars */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800 hover:border-indigo-500/50 transition-all duration-500 group">
              <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-indigo-500/20">
                <Zap className="text-indigo-400 w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Daily Assistance</h3>
              <p className="text-slate-400 leading-relaxed text-sm">
                AI that helps with your errands, your career, and your creative hobbies. Tools that fit into your context, not the other way around.
              </p>
            </div>

            <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800 hover:border-emerald-500/50 transition-all duration-500 group">
              <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 border border-emerald-500/20">
                <Heart className="text-emerald-400 w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Human First</h3>
              <p className="text-slate-400 leading-relaxed text-sm">
                We believe AI should amplify the human soul. Every tool is designed to save you time so you can focus on what makes you unique.
              </p>
            </div>

            <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800 hover:border-pink-500/50 transition-all duration-500 group">
              <div className="w-14 h-14 bg-pink-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-pink-500/20">
                <Users className="text-pink-400 w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Open Spectrum</h3>
              <p className="text-slate-400 leading-relaxed text-sm">
                Our toolset grows exponentially because every member can contribute. Add the tools you need and share them with the world.
              </p>
            </div>
          </section>

          {/* Feature Hub Highlight */}
          <section className="bg-slate-900 border border-slate-800 rounded-[3rem] p-12 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none"></div>
            
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-8">
                <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter">The 20+ Rainbow Tools</h3>
                <div className="grid grid-cols-1 gap-6">
                  <div className="flex gap-4">
                    <div className="p-3 bg-blue-500/20 rounded-xl text-blue-400 shrink-0 h-fit"><Code size={20}/></div>
                    <div>
                      <h4 className="font-bold text-white text-sm">Daily Utility</h4>
                      <p className="text-xs text-slate-500 mt-1">Shipping labs, check designers, and logistics assistants for your home and business.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="p-3 bg-pink-500/20 rounded-xl text-pink-400 shrink-0 h-fit"><Palette size={20}/></div>
                    <div>
                      <h4 className="font-bold text-white text-sm">Creative Expression</h4>
                      <p className="text-xs text-slate-500 mt-1">Generative icons, holiday workshops, and visual canvases for your imagination.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="p-3 bg-amber-500/20 rounded-xl text-amber-400 shrink-0 h-fit"><Wallet size={20}/></div>
                    <div>
                      <h4 className="font-bold text-white text-sm">Intelligence Exchange</h4>
                      <p className="text-xs text-slate-500 mt-1">Secure neural assets and wallets to trade knowledge and mentorship value.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-400 shrink-0 h-fit"><Users size={20}/></div>
                    <div>
                      <h4 className="font-bold text-white text-sm">Growth & Careers</h4>
                      <p className="text-xs text-slate-500 mt-1">Mock interviews, career guidance, and expert hubs to accelerate your path.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="hidden lg:flex justify-center">
                 <div className="relative">
                    <div className="w-64 h-64 bg-indigo-600/5 border border-indigo-500/20 rounded-[4rem] rotate-12 flex items-center justify-center animate-pulse">
                        <Box size={100} className="text-indigo-500/20" />
                    </div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-slate-900 border border-slate-700 rounded-[3rem] -rotate-12 flex flex-col items-center justify-center shadow-2xl">
                         <BrainCircuit size={64} className="text-indigo-400 mb-4" />
                         <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Neural Core</span>
                    </div>
                 </div>
              </div>
            </div>
          </section>

          {/* Footer Quote */}
          <div className="text-center pt-12 border-t border-slate-900">
            <p className="text-2xl font-serif italic text-slate-400">
              "We don't build tools for AI; we build a Prism for Humanity."
            </p>
            <div className="mt-8 flex flex-col items-center">
                <div className="w-12 h-px bg-indigo-500 mb-4"></div>
                <p className="text-sm font-bold text-white uppercase tracking-[0.4em]">Neural Prism v5.6.0</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
