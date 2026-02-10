
import React from 'react';
import { ArrowLeft, Book, Sparkles, Zap, Cpu, Radio, Layout, Key, Globe, CheckCircle } from 'lucide-react';

interface UserManualProps {
  onBack: () => void;
}

export const UserManual: React.FC<UserManualProps> = ({ onBack }) => {
  return (
    <div className="h-full bg-slate-950 flex flex-col animate-fade-in">
      {/* Header */}
      <div className="p-6 border-b border-slate-800 flex items-center gap-4 sticky top-0 bg-slate-950/90 backdrop-blur-md z-20">
        <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold tracking-widest uppercase text-slate-400 flex items-center gap-2">
            <Book size={20} className="text-indigo-400"/> Activity Manual
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#fdfbf7] text-slate-900 scrollbar-thin scrollbar-thumb-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-16 md:py-24 space-y-16 pb-32">
            
            <header className="text-center space-y-6">
                <div className="w-20 h-20 bg-indigo-600 rounded-3xl rotate-12 flex items-center justify-center mx-auto shadow-2xl">
                    <Sparkles size={40} className="text-white -rotate-12" />
                </div>
                <h1 className="text-5xl font-black tracking-tight text-slate-900 uppercase italic">The Neural Prism</h1>
                <p className="text-xl text-slate-600 font-medium max-w-2xl mx-auto leading-relaxed">
                    Refracting super-intelligence into a beautiful spectrum of daily utility.
                </p>
            </header>

            <section className="space-y-8">
                <div className="flex items-center gap-4 border-b-2 border-slate-100 pb-4">
                    <Zap size={24} className="text-indigo-600" />
                    <h2 className="text-3xl font-black uppercase text-slate-800">1. Interactive Knowledge</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h3 className="text-xl font-bold flex items-center gap-2 text-slate-900"><Radio size={20} className="text-indigo-500"/> Discovery Hub</h3>
                        <p className="text-slate-600 leading-relaxed">Enter activity nodes where an AI guide helps you refract complex topics. You can interrupt, ask for deep-dives, or share your camera for visual feedback.</p>
                    </div>
                    <div className="space-y-4">
                        <h3 className="text-xl font-bold flex items-center gap-2 text-slate-900"><Cpu size={20} className="text-indigo-500"/> Socratic Feedback</h3>
                        <p className="text-slate-600 leading-relaxed">Our guides are powered by <strong>Gemini 2.5 Native Audio</strong>, providing sub-second verbal responses that adapt to your pace and tone.</p>
                    </div>
                </div>
            </section>

            <section className="space-y-8">
                <div className="flex items-center gap-4 border-b-2 border-slate-100 pb-4">
                    <Layout size={24} className="text-emerald-600" />
                    <h2 className="text-3xl font-black uppercase text-slate-800">2. Builder Studio</h2>
                </div>
                <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-lg space-y-6">
                    <h3 className="text-2xl font-bold text-slate-900 uppercase italic tracking-tighter">Heuristic Simulation Engine</h3>
                    <p className="text-slate-600 text-lg leading-relaxed">
                        In the <strong>Builder Studio</strong>, code execution is infrastructure-less. When you click "Run", Gemini 3 Flash traces your logic heuristically, "imagining" the output with {'>'}98% parity to native GCC or Python.
                    </p>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <li className="flex items-start gap-2 text-sm text-slate-700 font-bold">
                            <CheckCircle size={18} className="text-emerald-500 shrink-0" /> Zero-Latency Provisioning
                        </li>
                        <li className="flex items-start gap-2 text-sm text-slate-700 font-bold">
                            <CheckCircle size={18} className="text-emerald-500 shrink-0" /> Multi-File VFS Support
                        </li>
                    </ul>
                </div>
            </section>

            <footer className="pt-16 border-t-2 border-slate-100 text-center space-y-4">
                <div className="flex justify-center items-center gap-6">
                    <Globe size={20} className="text-slate-300" />
                    <span className="w-8 h-px bg-slate-200"></span>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">v7.0.0-ULTRA</p>
                    <span className="w-8 h-px bg-slate-200"></span>
                    <Sparkles size={20} className="text-slate-300" />
                </div>
                <p className="text-xs text-slate-400 font-bold italic">Refracting the future of human activity.</p>
            </footer>

        </div>
      </div>
    </div>
  );
};
