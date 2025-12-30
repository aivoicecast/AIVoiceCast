
import React from 'react';
import { ArrowLeft, Zap, Heart, Users, BrainCircuit, Rocket } from 'lucide-react';

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
        <h1 className="text-xl font-bold tracking-widest uppercase text-slate-400">Mission Statement</h1>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
        <div className="max-w-4xl mx-auto px-6 py-12 space-y-24">
          
          {/* Hero Section */}
          <section className="text-center space-y-8 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-900/30 border border-indigo-500/30 text-indigo-300 text-sm font-bold uppercase tracking-wider mb-4">
              <SparkleIcon /> AIVoiceCast Platform
            </div>
            <h2 className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-200 to-slate-400 leading-tight">
              Grow. Share.<br />Live.
            </h2>
            <p className="text-xl md:text-2xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
              We are evolving from a podcast tool into an <span className="text-white font-bold">AI-Human Community</span>. Our goal is to empower humanity in the AI era.
            </p>
          </section>

          {/* Core Pillars */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800 hover:border-indigo-500/50 transition-all duration-500 group">
              <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-indigo-500/20">
                <Zap className="text-indigo-400 w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">5X Productivity</h3>
              <p className="text-slate-400 leading-relaxed">
                Use AI not to replace yourself, but to amplify your capabilities. Less time on repetitive work for money. More time on high-value creation.
              </p>
            </div>

            <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800 hover:border-emerald-500/50 transition-all duration-500 group">
              <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-emerald-500/20">
                <Heart className="text-emerald-400 w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Joy of Living</h3>
              <p className="text-slate-400 leading-relaxed">
                The ultimate goal of productivity is freedom. Freedom to learn, to connect, and to work on what brings true joy and fulfillment to your life.
              </p>
            </div>

            <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800 hover:border-pink-500/50 transition-all duration-500 group">
              <div className="w-14 h-14 bg-pink-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-pink-500/20">
                <Users className="text-pink-400 w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Symbiosis</h3>
              <p className="text-slate-400 leading-relaxed">
                A community where humans and AI mentors coexist. Learn from an AI tutor today, mentor a human peer tomorrow.
              </p>
            </div>
          </section>

          {/* Feature Highlight */}
          <section className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-10 border border-slate-700 relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-indigo-500/20 blur-[100px] rounded-full pointer-events-none"></div>
            
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
              <div className="flex-1 space-y-6">
                <h3 className="text-3xl font-bold text-white">Competitive in the AI era</h3>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <BrainCircuit className="text-indigo-400 shrink-0 mt-1" />
                    <span className="text-slate-300">Create custom podcast channels to prep for interviews (e.g., "Google Interview Prep").</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Rocket className="text-indigo-400 shrink-0 mt-1" />
                    <span className="text-slate-300">Convert meeting recordings into formal Design Docs instantly.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Users className="text-indigo-400 shrink-0 mt-1" />
                    <span className="text-slate-300">Find mentors, join study groups, and share knowledge maps.</span>
                  </li>
                </ul>
              </div>
              <div className="w-full md:w-1/3 aspect-square bg-slate-950 rounded-2xl border border-slate-700 flex items-center justify-center">
                 <span className="text-6xl">🚀</span>
              </div>
            </div>
          </section>

          {/* Footer Quote */}
          <div className="text-center pt-12 border-t border-slate-900">
            <p className="text-2xl font-serif italic text-slate-500">
              "The future belongs to those who learn fast, share openly, and build with joy."
            </p>
            <p className="mt-4 text-sm font-bold text-indigo-400 uppercase tracking-widest">- AIVoiceCast Community</p>
          </div>

        </div>
      </div>
    </div>
  );
};

const SparkleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L14.39 9.61L22 12L14.39 14.39L12 22L9.61 14.39L2 12L9.61 9.61L12 2Z" />
  </svg>
);
