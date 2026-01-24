
import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Sparkles, Download, Loader2, AppWindow, RefreshCw, Layers, ShieldCheck, Key, Globe, Layout, Palette, Zap, Check, Upload, X, Edit3, Image as ImageIcon, Camera, AlertCircle, Share2, Link, Copy, Lock } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { resizeImage } from '../utils/imageUtils';
import { saveIcon, uploadFileToStorage, getIcon, deductCoins, AI_COSTS } from '../services/firestoreService';
import { auth } from '../services/firebaseConfig';
import { getDriveToken, connectGoogleDrive } from '../services/authService';
import { ensureCodeStudioFolder, uploadToDrive } from '../services/googleDriveService';
import { generateSecureId } from '../utils/idUtils';
import { ShareModal } from './ShareModal';

interface IconGeneratorProps {
  onBack: () => void;
  currentUser: any;
  iconId?: string;
  isProMember?: boolean;
}

const STYLE_PRESETS = [
  { name: 'Glassmorphism', prompt: 'Glassmorphic design, frosted glass texture, soft colorful gradients, modern look, translucent, high quality UI' },
  { name: 'Flat Minimal', prompt: 'Flat design, minimalist, bold colors, simple geometric shapes, clean lines, high contrast, material design' },
  { name: 'Cyberpunk', prompt: 'Cyberpunk neon aesthetic, glowing lines, dark background, electric blue and magenta accents, high tech' },
  { name: '3D Isometric', prompt: '3D isometric render, Claymorphism style, soft shadows, rounded edges, high resolution, soft lighting' },
  { name: 'Neumorphism', prompt: 'Neumorphic style, soft shadows and highlights, subtle depth, monochromatic, elegant, Apple aesthetic' },
  { name: 'Ink Wash', prompt: 'Traditional Chinese ink wash painting style, minimalist, elegant brush strokes, negative space, artistic' }
];

export const IconGenerator: React.FC<IconGeneratorProps> = ({ onBack, currentUser, iconId, isProMember }) => {
  if (isProMember === false) {
    return (
        <div className="h-full flex items-center justify-center p-6 bg-slate-950">
            <div className="max-w-md w-full bg-slate-900 border border-indigo-500/30 rounded-[3rem] p-12 text-center shadow-2xl">
                <Lock size={48} className="text-indigo-400 mx-auto mb-6" />
                <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-4">Pro Access Required</h2>
                <p className="text-slate-400 text-sm mb-10 font-medium">Neural Icon Lab requires an active Pro Membership to generate high-fidelity branding assets.</p>
                <button onClick={onBack} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest rounded-2xl transition-all">Back to Hub</button>
            </div>
        </div>
    );
  }

  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState(STYLE_PRESETS[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedIcon, setGeneratedIcon] = useState<string | null>(null);
  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

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
    setIsGenerating(true); setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const styleInstruction = `Professional app icon design for: ${prompt}. ${selectedStyle.prompt}. Isolated, high quality, 8k resolution.`;
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: styleInstruction,
        config: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } },
      });
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) { 
            setGeneratedIcon(`data:image/png;base64,${part.inlineData.data}`); 
            if (currentUser) {
                deductCoins(currentUser.uid, AI_COSTS.IMAGE_GENERATION);
            }
            break; 
          }
        }
      }
    } catch (e: any) { setError(e.message || "Failed to generate."); } finally { setIsGenerating(false); }
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-4"><button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"><ArrowLeft size={20} /></button><h1 className="text-lg font-bold text-white flex items-center gap-2"><AppWindow className="text-cyan-400" /> Neural Icon Lab</h1></div>
          {generatedIcon && <button onClick={handleGenerate} disabled={isGenerating} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs shadow-lg">{isGenerating ? 'Synthesizing...' : 'Re-Generate'}</button>}
      </header>
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          <div className="w-full lg:w-[400px] border-r border-slate-800 bg-slate-900/30 p-8 space-y-8 overflow-y-auto">
              <div className="space-y-4"><label className="text-[10px] font-black text-slate-500 uppercase">Icon Concept</label><textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe your app..." className="w-full h-32 bg-slate-900 border border-slate-700 rounded-2xl p-4 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none leading-relaxed"/></div>
              <div className="space-y-4"><label className="text-[10px] font-black text-slate-500 uppercase">Design Style</label><div className="grid grid-cols-2 gap-3">{STYLE_PRESETS.map((style) => (<button key={style.name} onClick={() => setSelectedStyle(style)} className={`p-3 rounded-xl border text-left transition-all ${selectedStyle.name === style.name ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-400'}`}><span className="text-xs font-bold">{style.name}</span></button>))}</div></div>
              <button onClick={handleGenerate} disabled={isGenerating || !prompt.trim()} className="w-full py-4 bg-gradient-to-r from-cyan-600 to-indigo-600 text-white font-black uppercase rounded-2xl shadow-xl transition-all active:scale-[0.98]">{isGenerating ? <Loader2 size={20} className="animate-spin mx-auto"/> : 'Generate Icon'}</button>
          </div>
          <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center p-8 relative">
              {generatedIcon ? <img src={generatedIcon} className="w-64 h-64 rounded-[3rem] shadow-2xl border border-white/10 animate-fade-in" alt="App Icon Preview" /> : <div className="p-20 rounded-[4rem] border-2 border-dashed border-slate-800 bg-slate-900/20 text-slate-700 font-bold uppercase tracking-widest">Icon Preview</div>}
              {isGenerating && <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center"><Loader2 size={40} className="animate-spin text-indigo-400"/></div>}
          </div>
      </div>
    </div>
  );
};
