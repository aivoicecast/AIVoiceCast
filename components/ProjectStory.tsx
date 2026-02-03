import React from 'react';
import { ArrowLeft, BookOpen, Rocket, Sparkles, Globe, ShieldCheck } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { MarkdownView } from './MarkdownView';
import { STORY_MARKDOWN } from '../utils/storyContent';

interface ProjectStoryProps {
  onBack: () => void;
}

export const ProjectStory: React.FC<ProjectStoryProps> = ({ onBack }) => {
  return (
    <div className="h-full bg-slate-950 text-slate-100 flex flex-col overflow-hidden animate-fade-in relative">
        {/* Background Decor */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 blur-[150px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-600/10 blur-[150px] rounded-full pointer-events-none"></div>

        <div className="relative z-10 flex flex-col h-full">
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-950/90 backdrop-blur-md z-20">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-xl transition-all text-slate-400 hover:text-white">
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-xl font-black tracking-widest uppercase text-white flex items-center gap-2 italic">
                            <BookOpen size={20} className="text-indigo-400"/> The Neural Prism Story
                        </h1>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em]">Manifest v6.9.5-PRO</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600/20 border border-indigo-500/30 rounded-full text-indigo-400 text-[10px] font-black uppercase tracking-widest">
                    <Sparkles size={12} fill="currentColor" /> Verified Architecture
                </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide bg-[#fdfbf7]">
                <div className="max-w-4xl mx-auto px-6 py-16 md:py-24">
                    <div className="mb-20 flex flex-col items-center sm:items-start space-y-8">
                        <div className="p-4 bg-slate-950 rounded-[2.5rem] shadow-2xl border border-white/5">
                            <BrandLogo size={80} className="transform hover:rotate-12 transition-transform duration-700" />
                        </div>
                        <h2 className="text-6xl sm:text-8xl font-black italic tracking-tighter uppercase leading-none text-slate-950">
                            Refracting <br/>
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600">Intelligence</span>
                        </h2>
                        <div className="w-24 h-2 bg-indigo-600 rounded-full"></div>
                    </div>

                    <div className="prose prose-slate prose-lg max-w-none antialiased">
                        <MarkdownView content={STORY_MARKDOWN} initialTheme="light" showThemeSwitcher={true} />
                    </div>

                    {/* Next Steps */}
                    <section className="text-center pt-24 border-t border-slate-200 mt-32 pb-32">
                        <div className="inline-flex items-center gap-3 px-6 py-2 bg-slate-950 rounded-full text-white text-[10px] font-black uppercase tracking-[0.4em] mb-10 shadow-xl">
                            <Globe size={14} className="text-indigo-400" /> Entering the Spectrum
                        </div>
                        <h3 className="text-5xl md:text-6xl font-black italic tracking-tighter uppercase mb-8 text-slate-950 leading-none">
                            Ready to <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Refract</span>?
                        </h3>
                        <p className="text-slate-500 max-w-xl mx-auto mb-16 leading-relaxed text-xl font-medium">
                            Join the community of sovereign builders. Your growth plan is synthesized, and your artifacts are persistent.
                        </p>
                        <button 
                            onClick={onBack}
                            className="px-16 py-6 bg-slate-950 text-white font-black uppercase tracking-[0.3em] rounded-3xl hover:bg-indigo-600 transition-all shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] hover:shadow-indigo-600/30 active:scale-95 flex items-center gap-4 mx-auto"
                        >
                            <Rocket size={24} />
                            Launch Hub
                        </button>
                    </section>

                    {/* Footer */}
                    <footer className="py-12 border-t border-slate-200 flex flex-col items-center gap-6">
                        <div className="flex items-center gap-8 opacity-30">
                            <ShieldCheck size={24} className="text-slate-900" />
                            <div className="w-12 h-px bg-slate-900"></div>
                            <Sparkles size={24} className="text-slate-900" />
                            <div className="w-12 h-px bg-slate-900"></div>
                            <Globe size={24} className="text-slate-900" />
                        </div>
                        <div className="text-center">
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.5em]">Neural Prism v6.9.5-PRO</p>
                            <p className="text-[10px] text-slate-400 font-bold italic mt-2 uppercase tracking-widest">Built for humanity. Refracted by Neural Prism.</p>
                        </div>
                    </footer>
                </div>
            </div>
        </div>
    </div>
  );
};

export default ProjectStory;