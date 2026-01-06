
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AgentMemory, TranscriptItem } from '../types';
import { ArrowLeft, Sparkles, Wand2, Image as ImageIcon, Download, Share2, RefreshCw, Mic, MicOff, Gift, Loader2, ChevronRight, ChevronLeft, Upload, QrCode, X, Music, Play, Pause, Volume2, Camera, CloudUpload, Lock, Globe, Check, Edit, Package, ArrowDown, Type as TypeIcon, Minus, Plus, Edit3, Link, LayoutGrid, User, Calendar, MessageSquare, Bot, CheckCircle, Trash2 } from 'lucide-react';
import { generateCardMessage, generateCardImage, generateCardAudio, generateSongLyrics } from '../services/cardGen';
import { GeminiLiveService } from '../services/geminiLive';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { uploadFileToStorage, saveCard, getCard, getUserCards, deleteCard } from '../services/firestoreService';
import { auth } from '../services/firebaseConfig';
import { FunctionDeclaration, Type as GenType } from '@google/genai';
import { resizeImage } from '../utils/imageUtils';
import { generateSecureId } from '../utils/idUtils';
import { MarkdownView } from './MarkdownView';

interface CardWorkshopProps {
  onBack: () => void;
  cardId?: string;
  isViewer?: boolean;
}

const DEFAULT_MEMORY: AgentMemory = {
  recipientName: '',
  senderName: '',
  occasion: 'Holiday',
  cardMessage: 'Dear Friend,\n\nWishing you a season filled with warmth, comfort, and good cheer.\n\nWarmly,\nMe',
  context: '',
  theme: 'festive',
  customThemePrompt: '',
  userImages: [],
  googlePhotosUrl: '',
  generatedAt: new Date().toISOString(),
  fontFamily: 'font-script',
  fontSizeScale: 1.0
};

const THEMES = [
  { id: 'festive', label: 'Festive & Classic', prompt: 'classic warm holiday style, cozy fireplace, traditional colors' },
  { id: 'minimal', label: 'Modern Minimal', prompt: 'minimalist high-end design, elegant typography, white space' },
  { id: 'cyberpunk', label: 'Neon Future', prompt: 'cyberpunk aesthetic, neon lights, high tech futuristic holiday' },
  { id: 'chinese-poem', label: 'Ink Wash Poem', prompt: 'traditional chinese ink wash painting, monochromatic, elegant' },
  { id: 'abstract', label: 'Artistic Abstract', prompt: 'abstract expressive art, vibrant colors, textured brush strokes' }
];

const isLocalUrl = (url?: string) => url?.startsWith('blob:') || url?.startsWith('data:');

const updateCardTool: FunctionDeclaration = {
    name: 'update_card',
    description: 'Update the holiday card details. Use this when the user asks to change the message, theme, recipient, or occasion.',
    parameters: {
        type: GenType.OBJECT,
        properties: {
            recipientName: { type: GenType.STRING, description: "Name of person receiving the card" },
            senderName: { type: GenType.STRING, description: "Name of person sending the card" },
            occasion: { type: GenType.STRING, description: "The event (Christmas, Birthday, etc)" },
            cardMessage: { type: GenType.STRING, description: "The final message text to be written on the card." },
            context: { type: GenType.STRING, description: "The main background story or theme summary for the card." },
            theme: { type: GenType.STRING, enum: ['festive', 'cozy', 'minimal', 'chinese-poem', 'cyberpunk', 'abstract'], description: "Visual theme style" },
            customThemePrompt: { type: GenType.STRING, description: "Specific visual details for image generation (e.g. 'a dog in snow')" }
        }
    }
};

export const CardWorkshop: React.FC<CardWorkshopProps> = ({ onBack, cardId, isViewer: initialIsViewer = false }) => {
  const [viewState, setViewState] = useState<'gallery' | 'editor'>(cardId ? 'editor' : 'gallery');
  const [memory, setMemory] = useState<AgentMemory>(DEFAULT_MEMORY);
  const [activeTab, setActiveTab] = useState<'chat' | 'settings'>('chat');
  const [activePage, setActivePage] = useState<number>(0); 
  const [isViewer, setIsViewer] = useState(initialIsViewer);
  
  const [savedCards, setSavedCards] = useState<AgentMemory[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);

  const [isGeneratingText, setIsGeneratingText] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingBackImage, setIsGeneratingBackImage] = useState(false);
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [isGeneratingSong, setIsGeneratingSong] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPackage, setIsExportingPackage] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);

  const [isLiveActive, setIsLiveActive] = useState(false);
  const [isAiConnected, setIsAiConnected] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const liveServiceRef = useRef<GeminiLiveService | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatImageInputRef = useRef<HTMLInputElement>(null);
  const playingAudioRef = useRef<HTMLAudioElement | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);

  const currentUser = auth?.currentUser;
  const isOwner = currentUser && (!memory.ownerId || memory.ownerId === currentUser.uid);

  useEffect(() => {
    if (cardId) {
        getCard(cardId).then(data => { 
            if (data) {
                setMemory(data);
                setViewState('editor');
            }
        });
    } else if (viewState === 'gallery') {
        loadGallery();
    }
  }, [cardId, viewState]);

  useEffect(() => {
    if (memory.googlePhotosUrl) {
        const url = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(memory.googlePhotosUrl)}`;
        fetch(url, { mode: 'cors' }).then(res => res.blob()).then(blob => {
            const reader = new FileReader();
            reader.onloadend = () => setQrCodeBase64(reader.result as string);
            reader.readAsDataURL(blob);
        }).catch(() => setQrCodeBase64(url));
    } else { setQrCodeBase64(null); }
  }, [memory.googlePhotosUrl]);

  const loadGallery = async () => {
      if (!currentUser) return;
      setLoadingGallery(true);
      try {
          const data = await getUserCards(currentUser.uid);
          setSavedCards(data);
      } catch (e) {
          console.error(e);
      } finally {
          setLoadingGallery(false);
      }
  };

  const handleOpenCard = (id: string) => {
      const found = savedCards.find(c => c.id === id);
      if (found) {
          setMemory(found);
          setViewState('editor');
          setShareLink(found.id ? `${window.location.origin}?view=card&id=${found.id}` : null);
      }
  };

  const handleDeleteCard = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (!confirm("Are you sure you want to permanently delete this card?")) return;
      
      try {
          await deleteCard(id);
          setSavedCards(prev => prev.filter(c => c.id !== id));
      } catch (e) {
          alert("Failed to delete card.");
      }
  };

  const handleCreateNew = () => {
      setMemory({ ...DEFAULT_MEMORY, senderName: currentUser?.displayName || '' });
      setViewState('editor');
      setShareLink(null);
  };

  const handleGenText = async () => {
      setIsGeneratingText(true);
      try {
          const msg = await generateCardMessage(memory);
          setMemory(prev => ({ ...prev, cardMessage: msg }));
      } catch(e) { alert("Failed to generate text"); } finally { setIsGeneratingText(false); }
  };

  const handleGenLyrics = async () => {
      setIsGeneratingSong(true);
      try {
          const lyrics = await generateSongLyrics(memory);
          setMemory(prev => ({ ...prev, songLyrics: lyrics }));
      } catch(e) { alert("Failed to generate lyrics"); } finally { setIsGeneratingSong(false); }
  };

  const handleGenImage = async (isBack = false) => {
      const setter = isBack ? setIsGeneratingBackImage : setIsGeneratingImage;
      setter(true);
      try {
          const themeConfig = THEMES.find(t => t.id === memory.theme) || THEMES[0];
          const img = await generateCardImage(memory, themeConfig.prompt, undefined, undefined, isBack ? '16:9' : '1:1');
          setMemory(prev => isBack ? ({ ...prev, backImageUrl: img }) : ({ ...prev, coverImageUrl: img }));
      } catch(e) { alert("Failed to generate image"); } finally { setter(false); }
  };

  const handleGenAudio = async (type: 'message' | 'song') => {
      const setter = type === 'song' ? setIsGeneratingSong : setIsGeneratingVoice;
      setter(true);
      try {
          const text = type === 'song' ? (memory.songLyrics || await generateSongLyrics(memory)) : memory.cardMessage;
          if (type === 'song' && !memory.songLyrics) setMemory(prev => ({ ...prev, songLyrics: text }));
          
          const url = await generateCardAudio(text, type === 'song' ? 'Fenrir' : 'Kore');
          setMemory(prev => type === 'song' ? { ...prev, songUrl: url } : { ...prev, voiceMessageUrl: url });
      } catch(e) { alert("Failed to generate audio"); } finally { setter(false); }
  };

  const playAudio = (url: string) => {
      if (playingUrl === url) {
          playingAudioRef.current?.pause();
          setPlayingUrl(null);
          return;
      }
      if (playingAudioRef.current) playingAudioRef.current.pause();
      const audio = new Audio(url);
      audio.crossOrigin = "anonymous";
      playingAudioRef.current = audio;
      audio.onended = () => setPlayingUrl(null);
      audio.play().then(() => setPlayingUrl(url)).catch(() => setPlayingUrl(null));
  };

  const handlePublishAndShare = async () => {
      if (!auth?.currentUser) return alert("Please sign in to share.");
      setIsPublishing(true);
      try {
          const cid = cardId || memory.id || generateSecureId();
          const updatedMemory = { ...memory };

          const syncMedia = async (url: string | undefined, path: string) => {
              if (!url || !isLocalUrl(url)) return url;
              const res = await fetch(url);
              const blob = await res.blob();
              return await uploadFileToStorage(path, blob);
          };

          updatedMemory.coverImageUrl = await syncMedia(updatedMemory.coverImageUrl, `cards/${cid}/cover.jpg`);
          updatedMemory.backImageUrl = await syncMedia(updatedMemory.backImageUrl, `cards/${cid}/back.jpg`);
          updatedMemory.voiceMessageUrl = await syncMedia(updatedMemory.voiceMessageUrl, `cards/${cid}/voice.wav`);
          updatedMemory.songUrl = await syncMedia(updatedMemory.songUrl, `cards/${cid}/song.wav`);

          if (updatedMemory.userImages && updatedMemory.userImages.length > 0) {
              const syncedImages = [];
              for (let i = 0; i < updatedMemory.userImages.length; i++) {
                  const img = updatedMemory.userImages[i];
                  if (isLocalUrl(img)) {
                      const res = await fetch(img);
                      const blob = await res.blob();
                      const cloudUrl = await uploadFileToStorage(`cards/${cid}/user_img_${i}.jpg`, blob);
                      syncedImages.push(cloudUrl);
                  } else {
                      syncedImages.push(img);
                  }
              }
              updatedMemory.userImages = syncedImages;
          }

          const finalCardId = await saveCard(updatedMemory, cid); 
          setMemory(updatedMemory);
          const link = `${window.location.origin}?view=card&id=${finalCardId}`;
          setShareLink(link);
          alert("Card published and synced!");
      } catch(e: any) { 
          alert("Publish failed: " + e.message); 
      } finally { setIsPublishing(false); }
  };

  const generatePDFBlob = async (): Promise<Blob | null> => {
    try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [330, 495] });
        for (let i = 0; i <= 3; i++) { 
            const el = document.getElementById(`export-card-page-${i}`);
            if (el) {
                const canvas = await html2canvas(el, { 
                    scale: 3, 
                    useCORS: true, 
                    width: 330, 
                    height: 495,
                    backgroundColor: '#ffffff'
                });
                if (i > 0) pdf.addPage();
                pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 330, 495);
            }
        }
        return pdf.output('blob');
    } catch(e) { return null; }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    const blob = await generatePDFBlob();
    if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `Neural_Card_${memory.recipientName || 'Friend'}.pdf`; a.click();
    }
    setIsExporting(false);
  };

  const handleDownloadPackage = async () => {
    setIsExportingPackage(true);
    try {
        const zip = new JSZip();
        const folder = zip.folder("NeuralCard");
        const pdfBlob = await generatePDFBlob();
        if (pdfBlob) folder?.file(`Card.pdf`, pdfBlob);
        
        const safeFetchBlob = async (url: string) => {
            const res = await fetch(url);
            if (!res.ok) throw new Error("Fetch failed");
            return await res.blob();
        };

        if (memory.voiceMessageUrl) {
            try { folder?.file("voice_greeting.wav", await safeFetchBlob(memory.voiceMessageUrl)); } catch(e) {}
        }
        if (memory.songUrl) {
            try { folder?.file("holiday_song.wav", await safeFetchBlob(memory.songUrl)); } catch(e) {}
        }
        
        const content = await zip.generateAsync({ type: "blob" });
        const a = document.createElement('a'); 
        a.href = URL.createObjectURL(content); 
        a.download = `Neural_Card_Package_${memory.recipientName || 'Friend'}.zip`; 
        a.click();
    } catch (e) { 
        console.error("Zip failed", e);
        alert("Package generation failed. Some assets might be missing or restricted."); 
    } finally { setIsExportingPackage(false); }
  };

  const toggleLiveAgent = async () => {
      if (isLiveActive) {
          liveServiceRef.current?.disconnect();
          setIsLiveActive(false);
          setIsAiConnected(false);
          return;
      }

      setIsLiveActive(true);
      const service = new GeminiLiveService();
      liveServiceRef.current = service;

      const systemInstruction = `
        You are the "Neural Card Assistant", appearing as a helpful holiday Elf. 
        Your goal is to help the user design a professional and heartfelt greeting card.
        
        CONTEXT:
        - Recipient: ${memory.recipientName}
        - Sender: ${memory.senderName}
        - Occasion: ${memory.occasion}
        - Theme: ${memory.theme}
        - Current Message: ${memory.cardMessage}
        - Card Background Context: ${memory.context || 'None provided'}
        
        TASK:
        1. Discuss the design and message.
        2. Offer suggestions for better wording or themes.
        3. Use the 'update_card' tool to directly modify the card data based on the user's voice requests.
      `;

      try {
          await service.connect('Zephyr', systemInstruction, {
              onOpen: () => setIsAiConnected(true),
              onClose: () => { setIsLiveActive(false); setIsAiConnected(false); },
              onError: () => { setIsLiveActive(false); setIsAiConnected(false); },
              onVolumeUpdate: () => {},
              onTranscript: (text, isUser) => {
                  setTranscript(prev => {
                      const role = isUser ? 'user' : 'ai';
                      let next;
                      if (prev.length > 0 && prev[prev.length - 1].role === role) {
                        next = [...prev.slice(0, -1), { ...prev[prev.length - 1], text: prev[prev.length - 1].text + text }];
                      } else {
                        next = [...prev, { role, text, timestamp: Date.now() }];
                      }
                      return next.slice(-20);
                  });
              },
              onToolCall: async (toolCall) => {
                  for (const fc of toolCall.functionCalls) {
                      if (fc.name === 'update_card') {
                          setMemory(prev => ({ ...prev, ...fc.args }));
                          service.sendToolResponse([{ id: fc.id, name: fc.name, response: { result: "Card data updated instantly." } }]);
                      }
                  }
              }
          }, [{ functionDeclarations: [updateCardTool] }]);
      } catch(e) {
          setIsLiveActive(false);
      }
  };

  const renderCardPage = (page: number) => (
      <div 
        className={`w-full h-full flex flex-col relative overflow-hidden shadow-2xl rounded-xl ${memory.theme === 'chinese-poem' ? 'bg-[#f5f0e1]' : 'bg-white'} border border-slate-200`}
        style={{ width: '330px', height: '495px' }}
      >
          {page === 0 && (
              <>
                {memory.coverImageUrl ? (
                    <img src={memory.coverImageUrl} className="absolute inset-0 w-full h-full object-cover" crossOrigin="anonymous"/>
                ) : (
                    <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center text-slate-300 gap-4">
                        <ImageIcon size={64} className="opacity-20"/>
                        <p className="text-xs font-black uppercase tracking-widest">No Cover Art</p>
                    </div>
                )}
                <div className="absolute top-6 left-6 right-6 text-center z-10">
                    <h2 className={`text-2xl font-black uppercase tracking-widest drop-shadow-lg ${memory.theme === 'chinese-poem' ? 'text-[#423328]' : 'text-white'}`}>{memory.occasion}</h2>
                </div>
              </>
          )}
          {page === 1 && (
              <div className="p-10 flex flex-col items-center justify-center h-full text-center overflow-y-auto">
                  <div className="w-12 h-px bg-slate-300 mb-8 shrink-0"></div>
                  <p className={`whitespace-pre-wrap leading-relaxed text-slate-800 ${memory.fontFamily || 'font-script'}`} style={{ fontSize: `${20 * (memory.fontSizeScale || 1.0)}px` }}>
                      {memory.cardMessage}
                  </p>
                  <div className="w-12 h-px bg-slate-300 mt-8 shrink-0"></div>
              </div>
          )}
          {page === 2 && (
              <div className="p-8 h-full flex flex-col items-center justify-center text-center gap-6">
                   <div className="grid grid-cols-2 gap-4 w-full h-full">
                       {[0,1,2,3].map(i => (
                           <div key={i} className="bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center text-slate-200 overflow-hidden aspect-square">
                               {memory.userImages[i] ? <img src={memory.userImages[i]} className="w-full h-full object-cover rounded-lg" crossOrigin="anonymous"/> : <ImageIcon size={24}/>}
                           </div>
                       ))}
                   </div>
              </div>
          )}
          {page === 3 && (
              <div className="p-8 h-full flex flex-col items-center justify-between text-center">
                   <div className="w-full flex-1 flex flex-col justify-center rounded-xl overflow-hidden shadow-inner border border-slate-100 bg-slate-50">
                        {memory.backImageUrl ? <img src={memory.backImageUrl} className="w-full h-full object-cover" crossOrigin="anonymous"/> : <ImageIcon size={32} className="mx-auto opacity-20"/>}
                   </div>
                  <div className="p-4 bg-white border-2 border-slate-100 rounded-2xl shadow-xl mt-6">
                      {qrCodeBase64 ? <img src={qrCodeBase64} className="w-24 h-24" alt="QR Code"/> : <QrCode size={100} className="text-slate-800"/>}
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-4 mb-1">AIVoiceCast Neural Archive</p>
              </div>
          )}
          {page === 4 && (
              <div className="p-12 h-full flex flex-col items-center justify-center text-center space-y-8">
                  <div className="space-y-2">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Voice Message</h3>
                    <div className="w-8 h-1 bg-indigo-500 mx-auto rounded-full"></div>
                  </div>
                  <p className="text-sm italic text-slate-500 leading-relaxed font-serif line-clamp-[10]">"{memory.cardMessage}"</p>
                  <button onClick={() => memory.voiceMessageUrl && playAudio(memory.voiceMessageUrl)} className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-95 ${playingUrl === memory.voiceMessageUrl ? 'bg-red-500 text-white animate-pulse' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}>
                      {playingUrl === memory.voiceMessageUrl ? <Pause size={28}/> : <Volume2 size={28}/>}
                  </button>
              </div>
          )}
          {page === 5 && (
              <div className="p-12 h-full flex flex-col items-center justify-center text-center space-y-8">
                  <div className="space-y-2">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Holiday Song</h3>
                    <div className="w-8 h-1 bg-pink-500 mx-auto rounded-full"></div>
                  </div>
                  <div className="flex-1 overflow-y-auto scrollbar-hide py-4 text-[10px] font-medium text-slate-600 leading-tight">
                    <p className="whitespace-pre-wrap">{memory.songLyrics || "Synthesizing melodic neural patterns..."}</p>
                  </div>
                  <button onClick={() => memory.songUrl && playAudio(memory.songUrl)} className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-95 ${playingUrl === memory.songUrl ? 'bg-red-500 text-white animate-pulse' : 'bg-pink-600 text-white hover:bg-pink-500'}`}>
                      {playingUrl === memory.songUrl ? <Pause size={28}/> : <Music size={28}/>}
                  </button>
              </div>
          )}
      </div>
  );

  if (viewState === 'gallery') {
    return (
        <div className="h-full bg-slate-950 text-slate-100 flex flex-col animate-fade-in">
            <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-20">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"><ArrowLeft size={20} /></button>
                    <h1 className="text-lg font-bold text-white flex items-center gap-2"><Gift className="text-red-500" /> My Holiday Cards</h1>
                </div>
                <button 
                    onClick={handleCreateNew}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-sm shadow-lg transition-transform hover:scale-105"
                >
                    <Plus size={16}/> Create New
                </button>
            </header>

            <div className="flex-1 overflow-y-auto p-6 md:p-10 scrollbar-hide">
                {loadingGallery ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                        <Loader2 size={32} className="animate-spin mb-2"/>
                        <p className="text-xs font-bold uppercase tracking-widest">Scanning Neural Archives...</p>
                    </div>
                ) : savedCards.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-500 border-2 border-dashed border-slate-800 rounded-[3rem] space-y-6">
                        <Gift size={64} className="opacity-10"/>
                        <div className="text-center">
                            <p className="text-lg font-bold text-slate-400">Empty Archive</p>
                            <p className="text-sm opacity-60">Start your first generative card today.</p>
                        </div>
                        <button onClick={handleCreateNew} className="px-6 py-2 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/20 rounded-xl font-bold transition-all">Start Designing</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                        {savedCards.map((card) => (
                            <div 
                                key={card.id} 
                                onClick={() => card.id && handleOpenCard(card.id)}
                                className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden hover:border-indigo-500/50 hover:shadow-2xl transition-all cursor-pointer group flex flex-col relative"
                            >
                                <button 
                                    onClick={(e) => card.id && handleDeleteCard(e, card.id)}
                                    className="absolute top-4 right-4 z-20 p-2 bg-black/40 hover:bg-red-600 text-white rounded-full backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                                    title="Delete Card"
                                >
                                    <Trash2 size={16}/>
                                </button>
                                
                                <div className="aspect-[2/3] bg-slate-800 relative overflow-hidden">
                                    {card.coverImageUrl ? (
                                        <img src={card.coverImageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" crossOrigin="anonymous"/>
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 bg-slate-950 gap-2">
                                            <ImageIcon size={32} className="opacity-20"/>
                                            <span className="text-[10px] font-bold uppercase">No Cover</span>
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-60"></div>
                                    <div className="absolute bottom-4 left-4 right-4 text-white">
                                        <h3 className="font-black text-xl leading-tight uppercase italic">{card.occasion}</h3>
                                        <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest mt-1">To: {card.recipientName}</p>
                                    </div>
                                    {(card.voiceMessageUrl || card.songUrl) && <div className="absolute top-4 left-4 bg-indigo-600 p-1.5 rounded-full text-white shadow-lg"><Music size={12}/></div>}
                                </div>
                                <div className="p-5 flex-1 flex flex-col justify-between bg-slate-900">
                                    <p className="text-xs text-slate-400 line-clamp-2 italic leading-relaxed">"{card.cardMessage}"</p>
                                    <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><User size={10}/> {card.senderName}</span>
                                        <span className="text-[10px] font-bold text-slate-600">{new Date(card.generatedAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden relative">
      <div className={`${isLiveActive ? 'flex-1' : 'w-full'} flex flex-col min-w-0 transition-all duration-500`}>
        <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-20">
            <div className="flex items-center gap-4">
                <button onClick={() => setViewState('gallery')} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"><ArrowLeft size={20} /></button>
                <div>
                    <h1 className="text-lg font-bold text-white flex items-center gap-2">
                        <Gift className="text-red-500" /> 
                        Card Lab
                        {isOwner && <span className="text-[10px] bg-indigo-900/40 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20 uppercase font-black">Creator</span>}
                    </h1>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={handleExportPDF} disabled={isExporting} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors" title="Export PDF">
                    {isExporting ? <Loader2 size={20} className="animate-spin"/> : <Download size={20} />}
                </button>
                <button onClick={handleDownloadPackage} disabled={isExportingPackage} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors" title="Export Zip Package">
                    {isExportingPackage ? <Loader2 size={20} className="animate-spin"/> : <Package size={20} />}
                </button>
                <button onClick={handlePublishAndShare} disabled={isPublishing} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-lg transition-all active:scale-95">
                    {isPublishing ? <Loader2 size={14} className="animate-spin"/> : <Share2 size={14}/>}
                    <span className="hidden sm:inline">Sync & Share</span>
                </button>
            </div>
        </header>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
            {/* Toolbar Sidebar */}
            <div className="w-full md:w-[350px] border-r border-slate-800 bg-slate-900/30 flex flex-col shrink-0 overflow-y-auto p-6 space-y-8 scrollbar-thin">
                
                <div className="flex p-1 bg-slate-950 rounded-xl border border-slate-800">
                    <button onClick={() => setActiveTab('chat')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'chat' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-50'}`}>Assistant</button>
                    <button onClick={() => setActiveTab('settings')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-50'}`}>Settings</button>
                </div>

                {activeTab === 'chat' ? (
                    <div className="flex flex-col h-full overflow-hidden">
                        <div className="flex-1 overflow-y-auto space-y-4 scrollbar-hide pr-1">
                            {transcript.length === 0 && (
                                <div className="p-8 text-center text-slate-500 flex flex-col items-center gap-4">
                                    <Bot size={48} className="opacity-20"/>
                                    <p className="text-xs font-medium leading-relaxed">I'm your Neural Design Assistant. I can help you write messages, choose themes, and generate art using your voice.</p>
                                    <button onClick={toggleLiveAgent} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl text-xs shadow-lg uppercase tracking-widest transition-transform hover:scale-105 active:scale-95">Talk to Assistant</button>
                                </div>
                            )}
                            {transcript.map((item, i) => (
                                <div key={i} className={`flex flex-col ${item.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in-up`}>
                                    <span className={`text-[9px] font-black uppercase mb-1 ${item.role === 'user' ? 'text-indigo-400' : 'text-emerald-400'}`}>{item.role === 'user' ? 'Me' : 'AI'}</span>
                                    <div className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed ${item.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-slate-800 text-slate-300 rounded-tl-sm border border-slate-700 shadow-lg'}`}>{item.text}</div>
                                </div>
                            ))}
                        </div>
                        <div className="pt-4 border-t border-slate-800 shrink-0">
                            <div className="flex items-center gap-2">
                                <button onClick={toggleLiveAgent} className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 ${isLiveActive ? 'bg-red-600 text-white animate-pulse shadow-red-900/20' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20'}`}>
                                    {isLiveActive ? <MicOff size={18}/> : <Mic size={18}/>}
                                    <span className="text-xs uppercase tracking-widest">{isLiveActive ? 'End Link' : 'Talk'}</span>
                                </button>
                                <button onClick={() => chatImageInputRef.current?.click()} className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition-colors" title="Show Image to AI">
                                    <Camera size={18}/>
                                </button>
                                <input type="file" ref={chatImageInputRef} className="hidden" accept="image/*" onChange={async (e) => { if (e.target.files?.[0]) { const base64 = await resizeImage(e.target.files[0], 512, 0.7); liveServiceRef.current?.sendVideo(base64.split(',')[1], e.target.files[0].type); setTranscript(prev => [...prev, { role: 'user', text: '📷 [Shared Inspiration Image]', timestamp: Date.now() }]); } }}/>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 animate-fade-in">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Active Page: {getPageLabel(activePage)}</label>
                            
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Background Context</label>
                                <textarea 
                                    rows={3} 
                                    value={memory.context || ''} 
                                    onChange={e => setMemory({...memory, context: e.target.value})} 
                                    placeholder="Brief background summary (e.g. 'A thank you card for a coworker who helped with a big launch'). This informs AI generation."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 outline-none focus:border-indigo-500 resize-none shadow-inner"
                                />
                            </div>

                            {activePage === 0 && (
                                <div className="space-y-4 animate-fade-in">
                                    <button onClick={() => handleGenImage(false)} disabled={isGeneratingImage} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl active:scale-[0.98]">
                                        {isGeneratingImage ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>}
                                        <span>Generate Front Art</span>
                                    </button>
                                    <div className="grid grid-cols-2 gap-2">
                                        {THEMES.map(t => (
                                            <button key={t.id} onClick={() => setMemory({...memory, theme: t.id as any})} className={`p-3 rounded-xl border text-[10px] font-bold uppercase transition-all ${memory.theme === t.id ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>{t.label}</button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activePage === 1 && (
                                <div className="space-y-4 animate-fade-in">
                                    <button onClick={handleGenText} disabled={isGeneratingText} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2">
                                        {isGeneratingText ? <Loader2 size={16} className="animate-spin"/> : <Wand2 size={16}/>}
                                        <span>AI Write Message</span>
                                    </button>
                                    <div className="space-y-2 pt-2">
                                        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                                            <button onClick={() => setMemory({...memory, fontFamily: 'font-script'})} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${memory.fontFamily === 'font-script' ? 'bg-slate-800 text-white' : 'text-slate-50'}`}>Script</button>
                                            <button onClick={() => setMemory({...memory, fontFamily: 'font-serif'})} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${memory.fontFamily === 'font-serif' ? 'bg-slate-800 text-white' : 'text-slate-50'}`}>Serif</button>
                                        </div>
                                        <div className="px-1 py-2">
                                            <div className="flex justify-between items-center mb-2"><span className="text-[9px] font-bold text-slate-600 uppercase">Size</span><span className="text-[9px] font-mono text-indigo-400">x{memory.fontSizeScale?.toFixed(1)}</span></div>
                                            <input type="range" min="0.5" max="2.0" step="0.1" value={memory.fontSizeScale} onChange={e => setMemory({...memory, fontSizeScale: parseFloat(e.target.value)})} className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                                        </div>
                                    </div>
                                    <textarea rows={8} value={memory.cardMessage} onChange={e => setMemory({...memory, cardMessage: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-slate-300 outline-none focus:border-indigo-500 resize-none leading-relaxed shadow-inner"/>
                                </div>
                            )}

                            {activePage === 2 && (
                                <div className="space-y-4 animate-fade-in">
                                     <button onClick={() => fileInputRef.current?.click()} className="w-full py-10 border-2 border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center gap-3 text-slate-500 hover:border-indigo-500 hover:text-indigo-400 transition-all bg-slate-950/40 group">
                                        <div className="p-4 bg-slate-800 rounded-full group-hover:bg-indigo-900/30 transition-colors">
                                            <Upload size={24}/>
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-widest">Upload Photo Memories</span>
                                        <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*" onChange={async (e) => { if (e.target.files) { const photos = await Promise.all(Array.from(e.target.files).map(f => resizeImage(f as File, 1024))); setMemory(prev => ({...prev, userImages: [...prev.userImages, ...photos]})); } }}/>
                                     </button>
                                     <div className="grid grid-cols-4 gap-2">
                                         {memory.userImages.map((img, i) => (
                                             <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-slate-800 group/img">
                                                 <img src={img} className="w-full h-full object-cover" crossOrigin="anonymous"/>
                                                 <button onClick={() => setMemory(p => ({...p, userImages: p.userImages.filter((_, idx) => idx !== i)}))} className="absolute inset-0 bg-red-600/60 opacity-0 group-hover/img:opacity-100 flex items-center justify-center text-white"><Trash2 size={12}/></button>
                                             </div>
                                         ))}
                                     </div>
                                </div>
                            )}

                            {activePage === 3 && (
                                <div className="space-y-4 animate-fade-in">
                                    <button onClick={() => handleGenImage(true)} disabled={isGeneratingBackImage} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2">
                                        {isGeneratingBackImage ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>}
                                        <span>Generate Back Art</span>
                                    </button>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1"><Link size={10}/> Shared Album URI</label>
                                        <input type="text" placeholder="Photos Album URL..." value={memory.googlePhotosUrl || ''} onChange={e => setMemory({...memory, googlePhotosUrl: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:border-indigo-500 outline-none shadow-inner"/>
                                    </div>
                                </div>
                            )}

                            {activePage === 4 && (
                                <div className="space-y-4 animate-fade-in">
                                    <button onClick={() => handleGenAudio('message')} disabled={isGeneratingVoice} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg">
                                        {isGeneratingVoice ? <Loader2 size={18} className="animate-spin"/> : <Mic size={18}/>}
                                        <span>Synthesize Voice</span>
                                    </button>
                                    <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl shadow-inner">
                                        <p className="text-[10px] text-slate-500 font-medium italic leading-relaxed line-clamp-4">"{memory.cardMessage}"</p>
                                    </div>
                                </div>
                            )}

                            {activePage === 5 && (
                                <div className="space-y-4 animate-fade-in">
                                    <button onClick={() => handleGenAudio('song')} disabled={isGeneratingSong} className="w-full py-4 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg">
                                        {isGeneratingSong ? <Loader2 size={18} className="animate-spin"/> : <Music size={18}/>}
                                        <span>Synthesize Custom Song</span>
                                    </button>
                                    <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl max-h-40 overflow-y-auto scrollbar-hide shadow-inner">
                                        <p className="text-[10px] text-slate-500 font-medium whitespace-pre-wrap">{memory.songLyrics || "Synthesizing melodic neural patterns..."}</p>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                )}
            </div>

            {/* Preview Section */}
            <div className="flex-1 bg-slate-950 flex flex-col p-12 items-center justify-center overflow-y-auto scrollbar-hide relative">
                
                {shareLink && (
                    <div className="mb-10 w-full max-w-md bg-slate-900 border border-indigo-500/30 rounded-[2rem] p-6 flex items-center justify-between shadow-2xl animate-fade-in-up">
                        <div className="overflow-hidden">
                            <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest mb-1">Public Card URI</p>
                            <p className="text-xs text-slate-400 truncate font-mono">{shareLink}</p>
                        </div>
                        <button onClick={() => { navigator.clipboard.writeText(shareLink); alert("URI Copied!"); }} className="p-3 bg-slate-800 hover:bg-indigo-600 rounded-2xl text-white transition-all shadow-lg active:scale-95"><Link size={20}/></button>
                    </div>
                )}

                <div className="relative group perspective">
                    <div className="w-[330px] h-[495px] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] transition-transform duration-500 transform-style-preserve-3d group-hover:rotate-y-6 overflow-hidden rounded-xl bg-white border border-slate-200">
                        {renderCardPage(activePage)}
                    </div>
                    <div className="absolute -left-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setActivePage(p => Math.max(0, p - 1))} className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full border border-white/20 text-white shadow-xl"><ChevronLeft size={24}/></button>
                    </div>
                    <div className="absolute -right-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setActivePage(p => Math.min(5, p + 1))} className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full border border-white/20 text-white shadow-xl"><ChevronRight size={24}/></button>
                    </div>
                </div>

                <div className="mt-12 flex flex-col items-center gap-6">
                    <div className="flex bg-slate-900/50 p-1.5 rounded-full border border-slate-800 backdrop-blur-sm">
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                            <button key={i} onClick={() => setActivePage(i)} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activePage === i ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>{getPageLabel(i)}</button>
                        ))}
                    </div>
                    
                    {playingUrl && (
                        <div className="flex items-center gap-4 bg-indigo-600/10 border border-indigo-500/20 px-6 py-3 rounded-2xl shadow-xl animate-fade-in">
                            <Volume2 size={20} className="text-indigo-400 animate-pulse" />
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase text-indigo-400">Now Playing Neural Audio</span>
                                <span className="text-[9px] text-slate-500 uppercase font-bold">{playingUrl === memory.songUrl ? 'Custom Holiday Song' : 'Voice Greeting'}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* HIDDEN EXPORT AREA - Strictly lock dimensions for high-fidelity capture */}
                {(isExporting || isExportingPackage) && (
                    <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', opacity: 0 }}>
                        {[0, 1, 2, 3].map(pageNum => (
                            <div key={pageNum} id={`export-card-page-${pageNum}`} style={{ width: '330px', height: '495px', overflow: 'hidden' }} className="flex flex-col relative">
                                {renderCardPage(pageNum)}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

const getPageLabel = (page: number) => {
    switch(page) {
        case 0: return 'Front'; case 1: return 'Inside'; case 2: return 'Photos'; case 3: return 'Back'; case 4: return 'Voice'; case 5: return 'Song'; default: return 'Page';
    }
};

export default CardWorkshop;
