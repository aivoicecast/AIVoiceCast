
import React, { useState, useEffect } from 'react';
/* Added Check to lucide-react imports to fix "Cannot find name 'Check'" errors */
import { ArrowLeft, Sparkles, Download, Loader2, AppWindow, RefreshCw, Layers, ShieldCheck, Key, Globe, Layout, Palette, Zap, Check } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface IconGeneratorProps {
  onBack: () => void;
  currentUser: any;
}

const STYLE_PRESETS = [
  { name: 'Glassmorphism', prompt: 'Glassmorphic design, frosted glass texture, soft colorful gradients, modern look, translucent, high quality UI' },
  { name: 'Flat Minimal', prompt: 'Flat design, minimalist, bold colors, simple geometric shapes, clean lines, high contrast, material design' },
  { name: 'Cyberpunk', prompt: 'Cyberpunk neon aesthetic, glowing lines, dark background, electric blue and magenta accents, high tech' },
  { name: '3D Isometric', prompt: '3D isometric render, Claymorphism style, soft shadows, rounded edges, high resolution, soft lighting' },
  { name: 'Neumorphism', prompt: 'Neumorphic style, soft shadows and highlights, subtle depth, monochromatic, elegant, Apple aesthetic' },
  { name: 'Ink Wash', prompt: 'Traditional Chinese ink wash painting style, minimalist, elegant brush strokes, negative space, artistic' }
];

export const IconGenerator: React.FC<IconGeneratorProps> = ({ onBack, currentUser }) => {
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState(STYLE_PRESETS[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedIcon, setGeneratedIcon] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkApiKey = async () => {
      const selected = await window.aistudio.hasSelectedApiKey();
      setHasApiKey(selected);
    };
    checkApiKey();
  }, []);

  const handleSelectKey = async () => {
    await window.aistudio.openSelectKey();
    // Assume success as per guidelines to avoid race condition
    setHasApiKey(true);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    setError(null);
    
    try {
      /* Guideline: Create a new GoogleGenAI instance right before making an API call to ensure it always uses the most up-to-date API key from the dialog. */
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const fullPrompt = `Professional app icon design for: ${prompt}. ${selectedStyle.prompt}. Isolated on a solid background, centered composition, no text, masterpiece quality, 8k resolution.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
          parts: [{ text: fullPrompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
            imageSize: "1K"
          }
        },
      });

      let foundImage = false;
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            setGeneratedIcon(`data:image/png;base64,${part.inlineData.data}`);
            foundImage = true;
            break;
          }
        }
      }

      if (!foundImage) {
        throw new Error("No image was generated in the response.");
      }
    } catch (e: any) {
      console.error(e);
      if (e.message?.includes("Requested entity was not found")) {
        setHasApiKey(false);
        setError("API Key session expired or invalid. Please select your key again.");
      } else {
        setError(e.message || "Generation failed. Try a different prompt.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generatedIcon) return;
    const link = document.createElement('a');
    link.href = generatedIcon;
    link.download = `app_icon_${Date.now()}.png`;
    link.click();
  };

  if (!hasApiKey) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-950 p-6">
        <div className="max-w-md w-full text-center space-y-8 animate-fade-in-up">
            <div className="p-4 bg-indigo-600/10 rounded-3xl inline-block border border-indigo-500/20">
                <ShieldCheck size={64} className="text-indigo-400 mx-auto" />
            </div>
            <div className="space-y-3">
                <h2 className="text-3xl font-black text-white">Unlock Pro Creative Tools</h2>
                <p className="text-slate-400">Icon Lab uses high-fidelity image models that require a validated API Key from a paid GCP project.</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-left space-y-4">
                <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">Requirements</p>
                <ul className="text-sm text-slate-300 space-y-2">
                    <li className="flex items-center gap-2">
                        <Check size={16} className="text-emerald-500" /> 
                        <span>Google AI Studio API Key</span>
                    </li>
                    <li className="flex items-center gap-2">
                        <Check size={16} className="text-emerald-500" /> 
                        <span>GCP Project with Billing Enabled</span>
                    </li>
                </ul>
                <a 
                    href="https://ai.google.dev/gemini-api/docs/billing" 
                    target="_blank" 
                    rel="noreferrer"
                    className="block text-xs text-indigo-400 hover:text-indigo-300 underline font-medium"
                >
                    Learn about Gemini API billing
                </a>
            </div>
            <button 
                onClick={handleSelectKey}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-xl shadow-indigo-500/20 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
            >
                <Key size={20} />
                <span>Select API Key to Continue</span>
            </button>
            <button onClick={onBack} className="text-slate-500 hover:text-white text-sm font-medium transition-colors">Return to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-20">
          <div className="flex items-center gap-4">
              <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                  <ArrowLeft size={20} />
              </button>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                  <AppWindow className="text-cyan-400" />
                  Neural Icon Lab
              </h1>
          </div>
          <div className="flex items-center gap-4">
              <span className="text-[10px] bg-indigo-900/50 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/30 font-bold uppercase tracking-widest">
                  Gemini 3 Pro Image
              </span>
          </div>
      </header>

      <div className="flex-1 flex overflow-hidden flex-col lg:flex-row">
          
          {/* Controls Panel */}
          <div className="w-full lg:w-[400px] border-r border-slate-800 bg-slate-900/30 flex flex-col shrink-0 overflow-y-auto p-8 space-y-10 scrollbar-thin">
              
              <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <Layers size={14} className="text-indigo-400"/> Icon Concept
                  </h3>
                  <textarea 
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe your app or icon (e.g. 'a golden compass for a travel app')..."
                    className="w-full h-32 bg-slate-900 border border-slate-700 rounded-2xl p-4 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none leading-relaxed transition-all"
                  />
              </div>

              <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <Palette size={14} className="text-pink-400"/> Design Style
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                      {STYLE_PRESETS.map((style) => (
                          <button
                            key={style.name}
                            onClick={() => setSelectedStyle(style)}
                            className={`p-3 rounded-xl border text-left transition-all ${selectedStyle.name === style.name ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                          >
                              <span className="text-xs font-bold block">{style.name}</span>
                          </button>
                      ))}
                  </div>
              </div>

              <div className="pt-4">
                  <button 
                    onClick={handleGenerate}
                    disabled={isGenerating || !prompt.trim()}
                    className={`w-full py-4 rounded-2xl font-black flex items-center justify-center gap-3 transition-all shadow-xl active:scale-[0.98] ${isGenerating || !prompt.trim() ? 'bg-slate-800 text-slate-500 opacity-50' : 'bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-cyan-500/10'}`}
                  >
                      {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
                      <span>{isGenerating ? 'Generating...' : 'Generate Icon'}</span>
                  </button>
                  
                  {error && (
                      <div className="mt-4 p-4 bg-red-900/20 border border-red-900/50 rounded-xl text-red-300 text-xs flex items-center gap-2">
                          <AlertCircle size={14} />
                          <span>{error}</span>
                      </div>
                  )}
              </div>

              <div className="bg-indigo-900/10 border border-indigo-500/20 p-4 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
                      <Zap size={14} fill="currentColor"/>
                      Pro Tip
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                      Icons without text perform better. Focus on metaphors and strong visual symbols that represent your app's core value.
                  </p>
              </div>
          </div>

          {/* Preview Panel */}
          <div className="flex-1 bg-slate-950 flex flex-col p-8 items-center justify-center relative min-h-0">
              
              <div className="absolute top-8 left-8 text-slate-600 flex items-center gap-2 select-none">
                  <Globe size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Neural Canvas v1.0</span>
              </div>

              {generatedIcon ? (
                  <div className="flex flex-col items-center animate-fade-in w-full max-w-2xl">
                      {/* Context View: iOS Style Preview */}
                      <div className="relative mb-12 group">
                          <div className="absolute -inset-10 bg-indigo-500/10 blur-[80px] rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"></div>
                          
                          <div className="relative p-12 bg-slate-900/40 rounded-[4rem] border border-slate-800 shadow-2xl backdrop-blur-sm">
                              <div className="grid grid-cols-3 gap-8">
                                  <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center border border-white/5 opacity-40"></div>
                                  <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center border border-white/5 opacity-40"></div>
                                  <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center border border-white/5 opacity-40"></div>
                                  
                                  {/* THE GENERATED ICON */}
                                  <div className="flex flex-col items-center gap-2 scale-110">
                                      <img 
                                        src={generatedIcon} 
                                        className="w-24 h-24 rounded-[1.5rem] shadow-2xl border border-white/10" 
                                        alt="App Icon Preview" 
                                      />
                                      <span className="text-[10px] font-bold text-white uppercase tracking-wider">Your App</span>
                                  </div>

                                  <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center border border-white/5 opacity-40"></div>
                                  <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center border border-white/5 opacity-40"></div>
                              </div>
                          </div>
                      </div>

                      <div className="flex gap-4 w-full justify-center">
                          <button 
                            onClick={handleDownload}
                            className="px-8 py-3 bg-white text-slate-950 font-black rounded-xl hover:bg-slate-100 transition-all flex items-center gap-2 shadow-lg"
                          >
                              <Download size={18} />
                              Download PNG
                          </button>
                          <button 
                            onClick={handleGenerate}
                            className="px-8 py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition-all flex items-center gap-2 border border-slate-700"
                          >
                              <RefreshCw size={18} />
                              Try Again
                          </button>
                      </div>
                  </div>
              ) : (
                  <div className="flex flex-col items-center text-center space-y-6 max-w-sm">
                      <div className={`p-10 rounded-[3rem] border border-dashed border-slate-800 bg-slate-900/20 ${isGenerating ? 'animate-pulse ring-2 ring-indigo-500/20' : ''}`}>
                          <Layout size={64} className="text-slate-800" />
                      </div>
                      <div className="space-y-2">
                          <h3 className="text-xl font-bold text-slate-600">Preview Studio</h3>
                          <p className="text-sm text-slate-700">Enter a concept and select a style to generate your first professional icon.</p>
                      </div>
                  </div>
              )}

              {isGenerating && (
                  <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] flex items-center justify-center z-10 transition-all">
                      <div className="bg-slate-900/90 p-8 rounded-3xl border border-slate-800 shadow-2xl flex flex-col items-center gap-4 max-w-xs text-center">
                          <div className="relative">
                            <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                            <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-400" size={24} />
                          </div>
                          <p className="text-sm font-bold text-white">Neural Synthesis in Progress</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Painting with pixels...</p>
                      </div>
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};

const AlertCircle = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
);
