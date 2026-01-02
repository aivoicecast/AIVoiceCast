
import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Sparkles, Download, Loader2, AppWindow, RefreshCw, Layers, ShieldCheck, Key, Globe, Layout, Palette, Zap, Check, Upload, X, Edit3, Image as ImageIcon, Camera, AlertCircle, Share2, Link, Copy } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { resizeImage } from '../utils/imageUtils';
import { saveIcon, uploadFileToStorage, getIcon } from '../services/firestoreService';
import { auth } from '../services/firebaseConfig';
import { getDriveToken, connectGoogleDrive } from '../services/authService';
import { ensureCodeStudioFolder, uploadToDrive } from '../services/googleDriveService';
import { generateSecureId } from '../utils/idUtils';
import { ShareModal } from './ShareModal';

interface IconGeneratorProps {
  onBack: () => void;
  currentUser: any;
  iconId?: string;
}

const STYLE_PRESETS = [
  { name: 'Glassmorphism', prompt: 'Glassmorphic design, frosted glass texture, soft colorful gradients, modern look, translucent, high quality UI' },
  { name: 'Flat Minimal', prompt: 'Flat design, minimalist, bold colors, simple geometric shapes, clean lines, high contrast, material design' },
  { name: 'Cyberpunk', prompt: 'Cyberpunk neon aesthetic, glowing lines, dark background, electric blue and magenta accents, high tech' },
  { name: '3D Isometric', prompt: '3D isometric render, Claymorphism style, soft shadows, rounded edges, high resolution, soft lighting' },
  { name: 'Neumorphism', prompt: 'Neumorphic style, soft shadows and highlights, subtle depth, monochromatic, elegant, Apple aesthetic' },
  { name: 'Ink Wash', prompt: 'Traditional Chinese ink wash painting style, minimalist, elegant brush strokes, negative space, artistic' }
];

export const IconGenerator: React.FC<IconGeneratorProps> = ({ onBack, currentUser, iconId }) => {
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState(STYLE_PRESETS[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedIcon, setGeneratedIcon] = useState<string | null>(null);
  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [publishProgress, setPublishProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      if (iconId) {
          setIsGenerating(true);
          getIcon(iconId).then(data => {
              if (data) {
                  setGeneratedIcon(data.url);
                  setPrompt(data.prompt);
                  setSelectedStyle(STYLE_PRESETS.find(s => s.name === data.style) || STYLE_PRESETS[0]);
                  setShareLink(`${window.location.origin}?view=icon&id=${data.id}`);
              }
          }).finally(() => setIsGenerating(false));
      }
  }, [iconId]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          try {
              const base64 = await resizeImage(e.target.files[0], 1024, 0.8);
              setBaseImage(base64);
              setError(null);
          } catch (err) {
              setError("Failed to process image.");
          }
      }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    setError(null);
    setShareLink(null);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const isEdit = !!baseImage;
      const model = isEdit ? 'gemini-2.5-flash-image' : 'gemini-3-pro-image-preview';
      
      const styleInstruction = isEdit ? `Modify the provided image according to this request: ${prompt}. Maintain the core structure but update the style to: ${selectedStyle.name}. ${selectedStyle.prompt}.` : `Professional app icon design for: ${prompt}. ${selectedStyle.prompt}. Isolated on a solid background, centered composition, no text, masterpiece quality, 8k resolution.`;

      const parts: any[] = [{ text: styleInstruction }];
      
      if (isEdit && baseImage) {
          const base64Data = baseImage.split(',')[1];
          const mimeType = baseImage.substring(baseImage.indexOf(':') + 1, baseImage.indexOf(';'));
          parts.push({
              inlineData: {
                  data: base64Data,
                  mimeType: mimeType
              }
          });
      }

      const response = await ai.models.generateContent({
        model,
        contents: isEdit ? { parts } : styleInstruction,
        config: {
          imageConfig: {
            aspectRatio: "1:1",
            imageSize: isEdit ? undefined : "1K" 
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
        throw new Error("No image was generated. Please try a more specific description.");
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Generation failed. Try a different prompt.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePublishAndShare = async () => {
      if (!generatedIcon) return;
      if (!auth.currentUser) return alert("Please sign in to share and save to Drive.");
      
      setIsSharing(true);
      setPublishProgress('Publishing to cloud...');
      try {
          const id = generateSecureId();
          
          let cloudUrl = generatedIcon;
          if (generatedIcon.startsWith('data:')) {
            const res = await fetch(generatedIcon);
            const blob = await res.blob();
            cloudUrl = await uploadFileToStorage(`icons/${id}.png`, blob);
          }
          
          await saveIcon({
              id,
              prompt,
              style: selectedStyle.name,
              url: cloudUrl,
              createdAt: Date.now(),
              ownerId: auth.currentUser.uid
          });

          const link = `${window.location.origin}?view=icon&id=${id}`;
          setShareLink(link);
          setShowShareModal(true);
      } catch (e: any) {
          alert("Publishing failed: " + e.message);
      } finally {
          setIsSharing(false);
          setPublishProgress('');
      }
  };

  const handleDownload = () => {
    if (!generatedIcon) return;
    const link = document.createElement('a');
    link.href = generatedIcon;
    link.download = `app_icon_${Date.now()}.png`;
    link.click();
  };

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
              {baseImage && (
                  <div className="flex items-center gap-2 bg-pink-900/30 text-pink-400 px-3 py-1 rounded-full border border-pink-500/30 text-[10px] font-bold uppercase tracking-widest animate-pulse">
                      <Edit3 size={12}/> Edit Mode
                  </div>
              )}
              {generatedIcon && (
                  <button onClick={() => shareLink ? setShowShareModal(true) : handlePublishAndShare()} disabled={isSharing} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-lg transition-all">
                      {isSharing ? <Loader2 size={14} className="animate-spin"/> : <Share2 size={14}/>}
                      <span>{isSharing ? 'Syncing...' : 'Share URI'}</span>
                  </button>
              )}
          </div>
      </header>

      <div className="flex-1 flex overflow-hidden flex-col lg:flex-row">
          
          {/* Controls Panel */}
          <div className="w-full lg:w-[400px] border-r border-slate-800 bg-slate-900/30 flex flex-col shrink-0 overflow-y-auto p-8 space-y-10 scrollbar-thin">
              
              {/* Base Image Section */}
              <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center justify-between">
                      <div className="flex items-center gap-2"><ImageIcon size={14} className="text-emerald-400"/> Base Icon (Optional)</div>
                      {baseImage && <button onClick={() => setBaseImage(null)} className="text-red-400 hover:text-red-300 transition-colors"><X size={14}/></button>}
                  </h3>
                  {baseImage ? (
                      <div className="relative aspect-square w-32 mx-auto rounded-2xl overflow-hidden border-2 border-indigo-500 shadow-xl group">
                          <img src={baseImage} className="w-full h-full object-cover" alt="Base" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <button onClick={() => fileInputRef.current?.click()} className="p-2 bg-indigo-600 rounded-full text-white"><RefreshCw size={16}/></button>
                          </div>
                      </div>
                  ) : (
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full aspect-square border-2 border-dashed border-slate-700 rounded-3xl flex flex-col items-center justify-center gap-3 text-slate-500 hover:border-indigo-500 hover:text-indigo-400 transition-all bg-slate-900/20 group"
                      >
                          <div className="p-4 bg-slate-800 rounded-full group-hover:bg-indigo-900/30 transition-colors">
                              <Upload size={24} />
                          </div>
                          <span className="text-xs font-bold uppercase tracking-wider">Upload Icon to Edit</span>
                      </button>
                  )}
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
              </div>

              <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <Layers size={14} className="text-indigo-400"/> {baseImage ? 'Modification Request' : 'Icon Concept'}
                  </h3>
                  <textarea 
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={baseImage ? "What changes should I make to this icon?..." : "Describe your app or icon concept..."}
                    className="w-full h-32 bg-slate-900 border border-slate-700 rounded-2xl p-4 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none leading-relaxed transition-all"
                  />
              </div>

              <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <Palette size={14} className="text-pink-400"/> {baseImage ? 'Target Style' : 'Design Style'}
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
                    className={`w-full py-4 rounded-2xl font-black flex items-center justify-center gap-3 transition-all shadow-xl active:scale-[0.98] ${isGenerating || !prompt.trim() ? 'bg-slate-800 text-slate-500 opacity-50' : (baseImage ? 'bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500' : 'bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500') + ' text-white shadow-cyan-500/10'}`}
                  >
                      {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
                      <span>{isGenerating ? 'Synthesizing...' : baseImage ? 'Modify Icon' : 'Generate Icon'}</span>
                  </button>
                  
                  {error && (
                      <div className="mt-4 p-4 bg-red-900/20 border border-red-900/50 rounded-xl text-red-300 text-xs flex items-center gap-2">
                          <AlertCircle size={14} />
                          <span>{error}</span>
                      </div>
                  )}
              </div>
          </div>

          {/* Preview Panel */}
          <div className="flex-1 bg-slate-950 flex flex-col p-8 items-center justify-center relative min-h-0">
              
              <div className="absolute top-8 left-8 text-slate-600 flex items-center gap-2 select-none">
                  <Globe size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Neural Canvas v2.0</span>
              </div>

              {generatedIcon ? (
                  <div className="flex flex-col items-center animate-fade-in w-full max-w-2xl">
                      <div className="relative mb-12 group">
                          <div className="absolute -inset-10 bg-indigo-500/10 blur-[80px] rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"></div>
                          
                          <div className="relative p-12 bg-slate-900/40 rounded-[4rem] border border-slate-800 shadow-2xl backdrop-blur-sm">
                              <div className="grid grid-cols-3 gap-8">
                                  <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center border border-white/5 opacity-40"></div>
                                  <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center border border-white/5 opacity-40"></div>
                                  <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center border border-white/5 opacity-40"></div>
                                  <div className="flex flex-col items-center gap-2 scale-110">
                                      <img 
                                        src={generatedIcon} 
                                        className="w-24 h-24 rounded-[1.5rem] shadow-2xl border border-white/10" 
                                        alt="App Icon Preview" 
                                        crossOrigin="anonymous"
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
                          <p className="text-sm text-slate-700">
                              {baseImage ? "Request changes to your base icon and we'll reimagine it." : "Enter a concept and select a style to generate your first professional icon."}
                          </p>
                      </div>
                  </div>
              )}

              {isGenerating && (
                  <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] flex items-center justify-center z-10 transition-all">
                      <div className="bg-slate-900/90 p-8 rounded-3xl border border-slate-800 shadow-2xl flex flex-col items-center gap-4 max-w-xs text-center">
                          <div className="relative">
                            <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                            <Sparkles className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-indigo-400" size={24} />
                          </div>
                          <p className="text-sm font-bold text-white">Neural Synthesis in Progress</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Painting with pixels...</p>
                      </div>
                  </div>
              )}
          </div>
      </div>

      {showShareModal && shareLink && (
          <ShareModal 
            isOpen={true} onClose={() => setShowShareModal(false)} 
            link={shareLink} title={`Icon: ${prompt.substring(0, 15)}...`}
            onShare={async () => {}} currentUserUid={currentUser?.uid}
          />
      )}
    </div>
  );
};
