
import React, { useState, useEffect, useRef } from 'react';
/* Added missing AppWindow, Cloud, and Activity to resolve compilation errors on lines 155, 164, and 224 */
import { ArrowLeft, Sparkles, Download, Loader2, RefreshCw, Zap, Check, Upload, X, Image as ImageIcon, AlertCircle, Share2, Link, Lock, Info, AppWindow, Cloud, Activity } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { resizeImage } from '../utils/imageUtils';
import { saveIcon, uploadFileToStorage, getIcon, deductCoins, AI_COSTS } from '../services/firestoreService';
import { auth } from '../services/firebaseConfig';
import { getDriveToken, signInWithGoogle, connectGoogleDrive } from '../services/authService';
/* Added missing ensureFolder to resolve compilation error on line 129 */
import { ensureCodeStudioFolder, uploadToDrive, ensureFolder } from '../services/googleDriveService';
import { generateSecureId } from '../utils/idUtils';
import { ShareModal } from './ShareModal';

interface IconGeneratorProps {
  onBack: () => void;
  currentUser: any;
  iconId?: string;
  isProMember?: boolean;
  onOpenManual?: () => void;
}

const STYLE_PRESETS = [
  { name: 'Glassmorphism', prompt: 'Glassmorphic design, frosted glass texture, soft colorful gradients, modern look, translucent, high quality UI' },
  { name: 'Flat Minimal', prompt: 'Flat design, minimalist, bold colors, simple geometric shapes, clean lines, high contrast, material design' },
  { name: 'Cyberpunk', prompt: 'Cyberpunk neon aesthetic, glowing lines, dark background, electric blue and magenta accents, high tech' },
  { name: '3D Isometric', prompt: '3D isometric render, Claymorphism style, soft shadows, rounded edges, high resolution, soft lighting' },
  { name: 'Neumorphism', prompt: 'Neumorphic style, soft shadows and highlights, subtle depth, monochromatic, elegant, Apple aesthetic' },
  { name: 'Ink Wash', prompt: 'Traditional Chinese ink wash painting style, minimalist, elegant brush strokes, negative space, artistic' }
];

export const IconGenerator: React.FC<IconGeneratorProps> = ({ onBack, currentUser, iconId, isProMember, onOpenManual }) => {
  if (isProMember === false) {
    return (
        <div className="h-full flex items-center justify-center p-6 bg-slate-950">
            <div className="max-w-md w-full bg-slate-900 border border-indigo-500/30 rounded-[3rem] p-12 text-center shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-32 bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none"></div>
                <Lock size={48} className="text-indigo-400 mx-auto mb-6 relative z-10" />
                <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-4 relative z-10">Pro Access Required</h2>
                <p className="text-slate-400 text-sm mb-10 font-medium relative z-10">Neural Icon Lab requires an active Pro Membership to generate high-fidelity branding assets.</p>
                <button onClick={onBack} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest rounded-2xl transition-all relative z-10">Back to Hub</button>
            </div>
        </div>
    );
  }

  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState(STYLE_PRESETS[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedIcon, setGeneratedIcon] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);

  useEffect(() => {
      if (iconId) {
          setIsGenerating(true);
          getIcon(iconId).then(data => {
              if (data) {
                  setGeneratedIcon(data.url); setPrompt(data.prompt);
                  setSelectedStyle(STYLE_PRESETS.find(s => s.name === data.style) || STYLE_PRESETS[0]);
              }
          }).finally(() => setIsGenerating(false));
      }
  }, [iconId]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    // MANDATORY API KEY SELECTION FOR GEMINI-3-PRO-IMAGE-PREVIEW
    if (!(await (window as any).aistudio.hasSelectedApiKey())) {
        await (window as any).aistudio.openSelectKey();
    }

    setIsGenerating(true); 
    setError(null);
    setShareLink(null);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const styleInstruction = `Professional app icon design for: ${prompt}. ${selectedStyle.prompt}. Square, isolated on white background, high quality, 8k resolution, centered composition. No text.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: [{ text: styleInstruction }],
        config: { 
            imageConfig: { 
                aspectRatio: "1:1", 
                imageSize: "1K" 
            } 
        },
      });

      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                const b64 = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                setGeneratedIcon(b64);
                
                if (currentUser) {
                    const id = generateSecureId();
                    const blob = await (await fetch(b64)).blob();
                    const url = await uploadFileToStorage(`icons/${currentUser.uid}/${id}.jpg`, blob);
                    await saveIcon({ id, url, prompt, style: selectedStyle.name, createdAt: Date.now(), ownerId: currentUser.uid });
                    deductCoins(currentUser.uid, AI_COSTS.IMAGE_GENERATION);
                }
                break;
            }
        }
      } else {
          throw new Error("Handshake successful but refraction yielded no image parts.");
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Refraction failed. Ensure you have selected a valid API key for the 3 Pro model.");
      if (e.message?.includes("Requested entity was not found")) {
          await (window as any).aistudio.openSelectKey();
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSyncToDrive = async () => {
      if (!generatedIcon || !currentUser) return;
      setIsSyncingDrive(true);
      try {
          const token = getDriveToken() || await connectGoogleDrive();
          const root = await ensureCodeStudioFolder(token);
          const folder = await ensureFolder(token, 'Icons', root);
          const blob = await (await fetch(generatedIcon)).blob();
          await uploadToDrive(token, folder, `Icon_${generateSecureId().substring(0,8)}.jpg`, blob);
          alert("Handshake confirmed. Asset persistent in Sovereign Vault.");
      } catch (e: any) {
          alert("Drive sync failed: " + e.message);
      } finally {
          setIsSyncingDrive(false);
      }
  };

  const handleDownload = () => {
      if (!generatedIcon) return;
      const a = document.createElement('a');
      a.href = generatedIcon;
      a.download = `Neural_Icon_${selectedStyle.name}.jpg`;
      a.click();
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-20">
          <div className="flex items-center gap-4">
              <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"><ArrowLeft size={20} /></button>
              <div>
                <h1 className="text-lg font-bold text-white flex items-center gap-2 uppercase tracking-tighter italic">
                    <AppWindow className="text-cyan-400" /> Icon Lab
                </h1>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Branding Synthesis v4.2.0</p>
              </div>
          </div>
          <div className="flex items-center gap-3">
              {generatedIcon && (
                  <>
                    <button onClick={handleSyncToDrive} disabled={isSyncingDrive} className="px-4 py-2 bg-slate-800 hover:bg-indigo-600 text-slate-300 rounded-lg text-xs font-bold transition-all border border-slate-700 flex items-center gap-2 shadow-lg">
                        {isSyncingDrive ? <Loader2 size={14} className="animate-spin"/> : <Cloud size={14}/>}
                        <span>Vault Sync</span>
                    </button>
                    <button onClick={handleDownload} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700 shadow-lg" title="Download Asset">
                        <Download size={18} />
                    </button>
                    <button onClick={() => setShowShareModal(true)} className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors shadow-lg shadow-indigo-900/40" title="Share URI">
                        <Share2 size={18}/>
                    </button>
                  </>
              )}
              {onOpenManual && <button onClick={onOpenManual} className="p-1 text-slate-600 hover:text-white transition-colors" title="Icon Manual"><Info size={16}/></button>}
          </div>
      </header>

      <div className="flex-1 flex overflow-hidden flex-col lg:flex-row">
          {/* Controls */}
          <div className="w-full lg:w-[450px] border-r border-slate-800 bg-slate-900/30 flex flex-col shrink-0 overflow-y-auto p-8 space-y-10 scrollbar-hide">
              <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Conceptual Refraction (Prompt)</label>
                  <textarea 
                    value={prompt} 
                    onChange={e => setPrompt(e.target.value)} 
                    placeholder="Describe your brand identity (e.g. 'A futuristic cloud storage service')..."
                    rows={4}
                    className="w-full bg-slate-950 border border-slate-800 rounded-[2rem] p-6 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none shadow-inner leading-relaxed"
                  />
              </div>

              <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Visual Style Engine</label>
                  <div className="grid grid-cols-2 gap-3">
                      {STYLE_PRESETS.map(style => (
                          <button 
                            key={style.name} 
                            onClick={() => setSelectedStyle(style)}
                            className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden group ${selectedStyle.name === style.name ? 'bg-indigo-600 border-indigo-500 text-white shadow-xl scale-[1.02]' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600'}`}
                          >
                              <p className="text-[10px] font-black uppercase tracking-tighter relative z-10">{style.name}</p>
                              {selectedStyle.name === style.name && <Check size={14} className="absolute right-3 top-3 text-white"/>}
                              <div className="absolute top-0 right-0 p-6 bg-white/5 blur-2xl rounded-full group-hover:scale-110 transition-transform"></div>
                          </button>
                      ))}
                  </div>
              </div>

              <div className="pt-6 border-t border-slate-800">
                  <button 
                    onClick={handleGenerate} 
                    disabled={isGenerating || !prompt.trim()} 
                    className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-900/40 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                  >
                      {isGenerating ? <Loader2 size={24} className="animate-spin" /> : <Zap size={24} fill="currentColor"/>}
                      <span>Synthesize Icon</span>
                  </button>
                  <p className="text-[9px] text-slate-600 text-center mt-6 uppercase font-bold tracking-widest">Powered by Gemini 3 Pro Image Spectrum</p>
              </div>
          </div>

          <main className="flex-1 bg-slate-950 flex flex-col items-center justify-center p-8 lg:p-12 relative overflow-y-auto scrollbar-hide">
              <div className="absolute top-8 right-8 text-slate-800 select-none">
                  <Activity size={120} strokeWidth={0.5} />
              </div>

              {isGenerating ? (
                  <div className="flex flex-col items-center gap-8 animate-pulse text-center">
                      <div className="relative">
                          <div className="w-32 h-32 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                          <div className="absolute inset-0 flex items-center justify-center">
                              <Sparkles size={48} className="text-indigo-400" />
                          </div>
                      </div>
                      <div className="space-y-2">
                          <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">Neural Refraction Active</h3>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Rasterizing logical shards from prompt vectors...</p>
                      </div>
                  </div>
              ) : generatedIcon ? (
                  <div className="space-y-12 w-full max-w-lg flex flex-col items-center animate-fade-in">
                      <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-indigo-600 rounded-[3rem] blur opacity-25 group-hover:opacity-60 transition duration-1000 group-hover:duration-200"></div>
                        <div className="relative w-80 h-80 bg-white rounded-[3rem] overflow-hidden shadow-2xl border-8 border-slate-900">
                            <img src={generatedIcon} alt="Generated Icon" className="w-full h-full object-cover shadow-inner" />
                        </div>
                      </div>
                      
                      <div className="flex gap-4 p-4 bg-slate-900/50 backdrop-blur-md rounded-[2rem] border border-slate-800 shadow-xl">
                          <div className="px-6 py-3 border-r border-slate-800 text-center">
                              <p className="text-[9px] font-black text-slate-600 uppercase mb-1">Scale</p>
                              <p className="text-xs font-bold text-white">1024x1024</p>
                          </div>
                          <div className="px-6 py-3 border-r border-slate-800 text-center">
                              <p className="text-[9px] font-black text-slate-600 uppercase mb-1">Depth</p>
                              <p className="text-xs font-bold text-white">Neural-HD</p>
                          </div>
                          <div className="px-6 py-3 text-center">
                              <p className="text-[9px] font-black text-slate-600 uppercase mb-1">Style</p>
                              <p className="text-xs font-bold text-white">{selectedStyle.name}</p>
                          </div>
                      </div>
                  </div>
              ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-800 space-y-8 opacity-20">
                      <ImageIcon size={160} strokeWidth={1} />
                      <h3 className="text-3xl font-black uppercase italic tracking-tighter">Manifest Pending</h3>
                  </div>
              )}

              {error && (
                  <div className="mt-8 p-4 bg-red-900/20 border border-red-900/50 rounded-2xl flex items-center gap-4 text-red-200 text-sm animate-shake">
                      <AlertCircle className="text-red-500 shrink-0" size={20} />
                      <p className="font-medium">{error}</p>
                  </div>
              )}
          </main>
      </div>

      {showShareModal && generatedIcon && (
          <ShareModal 
            isOpen={true} onClose={() => setShowShareModal(false)}
            link={generatedIcon} title={`Neural Icon: ${prompt}`}
            onShare={async () => {}} currentUserUid={currentUser?.uid}
          />
      )}
    </div>
  );
};

export default IconGenerator;
