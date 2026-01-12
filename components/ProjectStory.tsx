
import React from 'react';
import { ArrowLeft, BookOpen, Rocket } from 'lucide-react';
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
        <div className="fixed top-0 left-1/4 w-96 h-96 bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-purple-600/10 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="relative z-10 flex flex-col h-full">
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex items-center gap-4 sticky top-0 bg-slate-950/90 backdrop-blur-md z-20">
                <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-xl font-bold tracking-widest uppercase text-slate-400 flex items-center gap-2">
                    <BookOpen size={20} className="text-indigo-400"/> The Neural Prism Story
                </h1>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 bg-[#fdfbf7]">
                <div className="max-w-4xl mx-auto px-6 py-16 md:py-24">
                    <div className="mb-16 flex flex-col items-center sm:items-start space-y-8">
                        <BrandLogo size={80} className="transform hover:scale-110 transition-transform duration-500" />
                        <h2 className="text-6xl sm:text-7xl font-black italic tracking-tighter uppercase leading-none text-slate-900">
                            Refracting <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600">Intelligence</span>
                        </h2>
                    </div>

                    <div className="prose prose-slate prose-lg max-w-none antialiased">
                        <MarkdownView content={STORY_MARKDOWN} initialTheme="light" showThemeSwitcher={true} />
                    </div>

                    {/* Next Steps */}
                    <section className="text-center pt-24 border-t border-slate-200 mt-20 pb-20">
                        <h3 className="text-5xl font-black italic tracking-tighter uppercase mb-8 text-slate-900">Enter the <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Spectrum</span></h3>
                        <p className="text-slate-500 max-w-xl mx-auto mb-12 leading-relaxed text-lg font-medium">
                            Join our community of developers, designers, and dreamers as we build the final bridge between superhuman AI capacity and daily human utility.
                        </p>
                        <button 
                            onClick={onBack}
                            className="px-12 py-5 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-700 transition-all shadow-2xl active:scale-95 flex items-center gap-3 mx-auto"
                        >
                            <Rocket size={20} />
                            Launch Workspace
                        </button>
                    </section>

                    {/* Footer */}
                    <footer className="py-12 border-t border-slate-200 flex flex-col items-center gap-4">
                        <div className="w-12 h-1 bg-indigo-600 rounded-full"></div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Neural Prism v5.1.0-SYN</p>
                        <p className="text-[10px] text-slate-500 italic">Built for humanity. Refracted by Neural Prism.</p>
                    </footer>
                </div>
            </div>
        </div>
    </div>
  );
};
