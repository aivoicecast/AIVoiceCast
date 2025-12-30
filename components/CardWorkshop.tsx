
import React, { useState, useRef, useEffect } from 'react';
import { AgentMemory, TranscriptItem } from '../types';
import { ArrowLeft, Sparkles, Wand2, Image as ImageIcon, Download, Share2, RefreshCw, Mic, MicOff, Gift, Loader2, ChevronRight, ChevronLeft, Upload, QrCode, X, Music, Play, Pause, Volume2, Camera, CloudUpload, Lock, Globe, Check, Edit, Package, ArrowDown, Type as TypeIcon, Minus, Plus, Edit3, Link } from 'lucide-react';
import { generateCardMessage, generateCardImage, generateCardAudio, generateSongLyrics } from '../services/cardGen';
import { GeminiLiveService } from '../services/geminiLive';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { uploadFileToStorage, saveCard, getCard } from '../services/firestoreService';
import { auth } from '../services/firebaseConfig';
import { FunctionDeclaration, Type as GenType } from '@google/genai';
import { resizeImage } from '../utils/imageUtils';

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
  theme: 'festive',
  customThemePrompt: '',
  userImages: [],
  googlePhotosUrl: '',
  generatedAt: new Date().toISOString(),
  fontFamily: 'font-script',
  fontSizeScale: 1.0
};

const isChinese = (text: string) => /[\u4e00-\u9fa5]/.test(text);
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
            theme: { type: GenType.STRING, enum: ['festive', 'cozy', 'minimal', 'chinese-poem'], description: "Visual theme style" },
            customThemePrompt: { type: GenType.STRING, description: "Specific visual details for image generation (e.g. 'a dog in snow')" }
        }
    }
};

export const CardWorkshop: React.FC<CardWorkshopProps> = ({ onBack, cardId, isViewer: initialIsViewer = false }) => {
  const [memory, setMemory] = useState<AgentMemory>(DEFAULT_MEMORY);
  const [activeTab, setActiveTab] = useState<'settings' | 'chat'>('chat');
  const [activePage, setActivePage] = useState<number>(0); 
  const [isViewer, setIsViewer] = useState(initialIsViewer);
  
  const [isGeneratingText, setIsGeneratingText] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingBackImage, setIsGeneratingBackImage] = useState(false);
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [isGeneratingSong, setIsGeneratingSong] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPackage, setIsExportingPackage] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState('');

  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [frontRefImage, setFrontRefImage] = useState<string | null>(null);
  const [frontRefinement, setFrontRefinement] = useState('');
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const liveServiceRef = useRef<GeminiLiveService | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatImageInputRef = useRef<HTMLInputElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  const isOwner = auth.currentUser && (!memory.ownerId || memory.ownerId === auth.currentUser.uid);

  useEffect(() => {
      if (cardId) {
          getCard(cardId).then(data => { if (data) setMemory(data); });
      }
  }, [cardId]);

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

  useEffect(() => {
      liveServiceRef.current = new GeminiLiveService();
      liveServiceRef.current.initializeAudio();
      return () => { liveServiceRef.current?.disconnect(); };
  }, []);

  useEffect(() => {
      if (transcriptEndRef.current) {
          transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
  }, [transcript, activeTab]);

  const handleLiveToggle = async () => {
      if (isLiveActive) {
          liveServiceRef.current?.disconnect();
          setIsLiveActive(false);
      } else {
          try {
              const sysPrompt = `You are Elf, a helpful holiday card assistant. Help the user design their card. Recipient: ${memory.recipientName || "Unknown"}. Use update_card tool.`;
              await liveServiceRef.current?.connect("Puck", sysPrompt, {
                  onOpen: () => setIsLiveActive(true),
                  onClose: () => setIsLiveActive(false),
                  onError: () => setIsLiveActive(false),
                  onVolumeUpdate: () => {},
                  onTranscript: (text, isUser) => {
                      const role = isUser ? 'user' : 'ai';
                      setTranscript(prev => {
                          if (prev.length > 0 && prev[prev.length - 1].role === role) {
                              return [...prev.slice(0, -1), { ...prev[prev.length - 1], text: prev[prev.length - 1].text + text }];
                          }
                          return [...prev, { role, text, timestamp: Date.now() }];
                      });
                  },
                  onToolCall: async (toolCall) => {
                      for (const fc of toolCall.functionCalls) {
                          if (fc.name === 'update_card') {
                              setMemory(prev => ({ ...prev, ...fc.args }));
                              liveServiceRef.current?.sendToolResponse({ functionResponses: [{ id: fc.id, name: fc.name, response: { result: "Card updated!" } }] });
                          }
                      }
                  }
              }, [{ functionDeclarations: [updateCardTool] }]);
          } catch(e) { alert("Failed to connect live service."); }
      }
  };

  const handleGenText = async () => {
      setIsGeneratingText(true);
      try {
          const msg = await generateCardMessage(memory);
          setMemory(prev => ({ ...prev, cardMessage: msg }));
      } catch(e) { alert("Failed to generate text"); } finally { setIsGeneratingText(false); }
  };

  const handleGenAudio = async (type: 'message' | 'song') => {
      const setter = type === 'song' ? setIsGeneratingSong : setIsGeneratingVoice;
      setter(true);
      try {
          let text = type === 'song' ? await generateSongLyrics(memory) : memory.cardMessage;
          if (type === 'song') setMemory(prev => ({ ...prev, songLyrics: text }));
          const audioUrl = await generateCardAudio(text, type === 'song' ? 'Fenrir' : 'Kore');
          setMemory(prev => type === 'song' ? { ...prev, songUrl: audioUrl } : { ...prev, voiceMessageUrl: audioUrl });
      } catch(e) { alert("Audio failed."); } finally { setter(false); }
  };
  
  const playAudio = (url: string) => {
      if (playingUrl === url) { audioRef.current?.pause(); setPlayingUrl(null); return; }
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(url);
      audio.crossOrigin = "anonymous"; 
      audioRef.current = audio;
      audio.onended = () => setPlayingUrl(null);
      audio.play().then(() => setPlayingUrl(url)).catch(() => setPlayingUrl(null));
  };

  const handleGenImage = async (isBack = false) => {
      const setter = isBack ? setIsGeneratingBackImage : setIsGeneratingImage;
      setter(true);
      try {
          let style = memory.theme === 'chinese-poem' ? 'Ink wash painting' : 'Festive art';
          const imgUrl = await generateCardImage(memory, style, !isBack ? (frontRefImage || undefined) : undefined, !isBack ? frontRefinement : undefined, isBack ? '16:9' : '3:4');
          setMemory(prev => isBack ? ({ ...prev, backImageUrl: imgUrl }) : ({ ...prev, coverImageUrl: imgUrl }));
      } catch(e) { alert("Failed to generate image."); } finally { setter(false); }
  };

  const generatePDFBlob = async (): Promise<Blob | null> => {
      try {
          // Give the DOM a moment to ensure images and layout are fully rendered in the hidden export area
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [360, 540] });
          for (let i = 0; i <= 3; i++) { 
              const el = document.getElementById(`export-card-page-${i}`);
              if (el) {
                  const canvas = await html2canvas(el, { 
                      scale: 3, // High scale for crisp printing
                      useCORS: true, 
                      logging: false,
                      backgroundColor: null,
                      width: 360,
                      height: 540
                  });
                  if (i > 0) pdf.addPage();
                  // Explicitly use page dimensions to avoid any stretch during image placement
                  pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 360, 540, undefined, 'FAST');
              }
          }
          return pdf.output('blob');
      } catch(e) { 
          console.error("PDF generation error", e);
          return null; 
      }
  };

  const handleExportPDF = async () => {
      setIsExporting(true);
      const blob = await generatePDFBlob();
      if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = `HolidayCard.pdf`; a.click();
      }
      setIsExporting(false);
  };

  const handleDownloadPackage = async () => {
      setIsExportingPackage(true);
      try {
          const zip = new JSZip();
          const folder = zip.folder("HolidayCard");
          
          const pdfBlob = await generatePDFBlob();
          if (pdfBlob) folder?.file(`Card.pdf`, pdfBlob);
          
          if (memory.voiceMessageUrl) {
              const res = await fetch(memory.voiceMessageUrl);
              const blob = await res.blob();
              folder?.file("voice_message.wav", blob);
          }
          if (memory.songUrl) {
              const res = await fetch(memory.songUrl);
              const blob = await res.blob();
              folder?.file("holiday_song.wav", blob);
          }
          
          const content = await zip.generateAsync({ type: "blob" });
          const url = URL.createObjectURL(content);
          const a = document.createElement('a'); a.href = url; a.download = `HolidayCard_Package.zip`; a.click();
      } catch (e) { alert("Failed to create package."); } finally { setIsExportingPackage(false); }
  };

  const handlePublishAndShare = async () => {
      if (!auth.currentUser) return alert("Please sign in to share your card.");
      setIsPublishing(true);
      setPublishProgress('Uploading assets...');
      
      try {
          const cid = cardId || crypto.randomUUID();
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

          if (updatedMemory.userImages.length > 0) {
              const newPhotos = [];
              for (let i = 0; i < updatedMemory.userImages.length; i++) {
                  const url = updatedMemory.userImages[i];
                  const newUrl = await syncMedia(url, `cards/${cid}/photo_${i}.jpg`);
                  if (newUrl) newPhotos.push(newUrl);
              }
              updatedMemory.userImages = newPhotos;
          }

          setPublishProgress('Saving to database...');
          const finalCardId = await saveCard(updatedMemory, cid); 
          setMemory(updatedMemory);
          setShareLink(`${window.location.origin}?view=card&id=${finalCardId}`);
          setShowShareModal(true);
      } catch(e: any) { 
          console.error("Publish failed", e);
          alert("Failed to publish: " + (e.message || "Unknown error")); 
      } finally { 
          setIsPublishing(false); 
          setPublishProgress('');
      }
  };

  const getPageLabel = (page: number) => {
      switch(page) {
          case 0: return 'Front'; case 1: return 'Message'; case 2: return 'Photos'; case 3: return 'Back'; case 4: return 'Voice'; case 5: return 'Song'; default: return 'Page';
      }
  };

  const renderCardContent = (page: number) => (
      <div className={`w-full h-full flex flex-col relative overflow-hidden ${memory.theme === 'chinese-poem' ? 'bg-[#f5f0e1]' : 'bg-white'}`}>
          {page === 0 && (
              memory.coverImageUrl ? (
                <img 
                    src={memory.coverImageUrl} 
                    className="absolute inset-0 w-full h-full object-cover" 
                    crossOrigin="anonymous"
                    alt="Front Cover"
                    loading="eager"
                />
              ) : (
                <div className="w-full h-full bg-slate-200 flex flex-col items-center justify-center text-slate-400 gap-2">
                    <ImageIcon size={48} className="opacity-20"/>
                    <span className="text-xs font-bold uppercase tracking-widest">No Cover Art</span>
                </div>
              )
          )}
          
          {page === 1 && (
            <div className="p-8 flex flex-col h-full overflow-hidden">
                <div 
                    className={`flex-1 overflow-y-auto scrollbar-hide text-center text-slate-800 ${memory.fontFamily || 'font-script'} leading-relaxed flex flex-col justify-center`}
                    style={{ fontSize: `${22 * (memory.fontSizeScale || 1.0)}px` }}
                >
                    <p className="whitespace-pre-wrap">{memory.cardMessage}</p>
                </div>
            </div>
          )}

          {page === 2 && (
            <div className="p-6 h-full flex flex-col">
                <div className="grid grid-cols-2 gap-3 flex-1">
                    {memory.userImages.length > 0 ? (
                        memory.userImages.slice(0,4).map((img, i) => (
                            <div key={i} className="bg-slate-100 rounded-lg overflow-hidden border border-slate-200 shadow-sm relative">
                                <img src={img} className="w-full h-full object-cover" crossOrigin="anonymous" alt=""/>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-2 flex flex-col items-center justify-center text-slate-300 gap-2 border-2 border-dashed border-slate-200 rounded-xl h-full">
                            <ImageIcon size={32} className="opacity-30"/>
                            <span className="text-[10px] uppercase font-bold tracking-widest">No Photos Uploaded</span>
                        </div>
                    )}
                </div>
            </div>
          )}

          {page === 3 && (
            <div className="p-8 h-full flex flex-col items-center justify-between text-center bg-white">
                <div className="w-full flex-1 flex flex-col justify-center max-h-[300px] overflow-hidden rounded-xl shadow-md border border-slate-100">
                    {memory.backImageUrl ? (
                        <img 
                            src={memory.backImageUrl} 
                            className="w-full h-full object-cover" 
                            crossOrigin="anonymous" 
                            alt="Back Cover"
                            style={{ aspectRatio: '16/9' }}
                        />
                    ) : (
                        <div className="w-full aspect-video bg-slate-50 flex items-center justify-center text-slate-200">
                            <ImageIcon size={48}/>
                        </div>
                    )}
                </div>
                <div className="flex flex-col items-center gap-2 mt-6">
                    {qrCodeBase64 ? (
                        <img src={qrCodeBase64} className="w-20 h-20 opacity-80" alt="QR Code"/>
                    ) : (
                        <QrCode size={40} className="text-slate-200"/>
                    )}
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-2">AIVoiceCast Digital Card</p>
                </div>
            </div>
          )}

          {page === 4 && (
            <div className="h-full flex flex-col relative">
                <div className="flex-shrink-0 p-8 pt-10 text-center bg-white z-10">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Voice Greeting</h3>
                    <div className="w-8 h-1 bg-indigo-500 mx-auto rounded-full"></div>
                </div>
                
                <div className="flex-1 w-full overflow-y-auto scrollbar-hide text-center text-slate-600 italic text-sm px-8 leading-relaxed">
                    {/* Use my-auto on text block to center while allowing scrolling to beginning if tall */}
                    <div className="min-h-full flex flex-col justify-center py-4">
                        <p className="whitespace-pre-wrap">"{memory.cardMessage}"</p>
                    </div>
                </div>

                <div className="flex-shrink-0 p-8 flex flex-col items-center gap-3 bg-white z-10">
                    <button 
                        onClick={() => memory.voiceMessageUrl && playAudio(memory.voiceMessageUrl)} 
                        className={`w-14 h-14 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 ${playingUrl === memory.voiceMessageUrl ? 'ring-4 ring-indigo-500/30 bg-red-500' : 'hover:bg-indigo-500'}`}
                    >
                        {playingUrl === memory.voiceMessageUrl ? <Pause size={24}/> : <Volume2 size={24}/>}
                    </button>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Listen to Message</span>
                </div>
            </div>
          )}

          {page === 5 && (
            <div className="h-full flex flex-col relative">
                <div className="flex-shrink-0 p-8 pt-10 text-center bg-white z-10">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Holiday Song</h3>
                    <div className="w-8 h-1 bg-pink-500 mx-auto rounded-full"></div>
                </div>
                
                <div className="flex-1 w-full overflow-y-auto scrollbar-hide text-center text-slate-600 text-[10px] px-8 leading-tight">
                    <div className="min-h-full flex flex-col justify-center py-4">
                        <p className="whitespace-pre-wrap font-medium">{memory.songLyrics || "Generating song lyrics..."}</p>
                    </div>
                </div>

                <div className="flex-shrink-0 p-8 flex flex-col items-center gap-3 bg-white z-10">
                    <button 
                        onClick={() => memory.songUrl && playAudio(memory.songUrl)} 
                        className={`w-14 h-14 bg-pink-600 text-white rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 ${playingUrl === memory.songUrl ? 'ring-4 ring-pink-500/30 bg-red-500' : 'hover:bg-pink-500'}`}
                    >
                        {playingUrl === memory.songUrl ? <Pause size={24}/> : <Music size={24}/>}
                    </button>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Play Custom Song</span>
                </div>
            </div>
          )}
      </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden relative">
      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
          
          {/* LEFT PANEL: CONTROLS */}
          {!isViewer && (
          <div className="w-full md:w-96 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 h-full overflow-hidden z-30">
              <div className="flex-shrink-0 flex border-b border-slate-800 bg-slate-900">
                  <button onClick={() => setActiveTab('chat')} className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab==='chat' ? 'bg-slate-800 text-white border-b-2 border-indigo-500' : 'text-slate-500'}`}>Elf Assistant</button>
                  <button onClick={() => setActiveTab('settings')} className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab==='settings' ? 'bg-slate-800 text-white border-b-2 border-indigo-500' : 'text-slate-500'}`}>Edit Context</button>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-slate-800">
                  {activeTab === 'settings' ? (
                        <div className="p-6 space-y-8 pb-20">
                            <div className="space-y-4">
                                <label className="text-xs font-bold text-slate-500 uppercase">Card Settings</label>
                                <select value={memory.occasion} onChange={e => setMemory({...memory, occasion: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white outline-none">
                                    <option value="Holiday">Happy Holidays</option><option value="Christmas">Merry Christmas</option><option value="Birthday">Happy Birthday</option><option value="New Year">New Year 2026</option>
                                </select>
                                <div className="grid grid-cols-2 gap-2">
                                    {['festive', 'cozy', 'minimal', 'chinese-poem'].map(t => <button key={t} onClick={() => setMemory({...memory, theme: t as any})} className={`py-2 text-xs font-bold rounded-lg border capitalize ${memory.theme === t ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>{t.replace('-', ' ')}</button>)}
                                </div>
                                <textarea rows={2} placeholder="Visual theme details..." value={memory.customThemePrompt || ''} onChange={e => setMemory({...memory, customThemePrompt: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white outline-none resize-none"/>
                            </div>

                            <div className="space-y-6">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2"><Edit3 size={16} /> Editing: {getPageLabel(activePage)}</h3>
                                
                                {activePage === 1 && (
                                    <div className="space-y-4 animate-fade-in">
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase">Font Size Scale</label>
                                                <span className="text-[10px] text-indigo-400 font-mono">x{memory.fontSizeScale || 1.0}</span>
                                            </div>
                                            <input 
                                                type="range" min="0.5" max="2.0" step="0.1" 
                                                value={memory.fontSizeScale || 1.0}
                                                onChange={(e) => setMemory({...memory, fontSizeScale: parseFloat(e.target.value)})}
                                                className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-full appearance-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Font Style</label>
                                            <div className="flex gap-2">
                                                <button onClick={() => setMemory({...memory, fontFamily: 'font-script'})} className={`flex-1 py-1.5 rounded-lg text-xs border ${memory.fontFamily === 'font-script' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>Script</button>
                                                <button onClick={() => setMemory({...memory, fontFamily: 'font-serif'})} className={`flex-1 py-1.5 rounded-lg text-xs border ${memory.fontFamily === 'font-serif' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>Serif</button>
                                                <button onClick={() => setMemory({...memory, fontFamily: 'font-sans'})} className={`flex-1 py-1.5 rounded-lg text-xs border ${memory.fontFamily === 'font-sans' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>Sans</button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activePage === 0 && (
                                    <div className="space-y-4">
                                        <button onClick={() => handleGenImage(false)} disabled={isGeneratingImage} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-lg">
                                            {isGeneratingImage ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>} Generate Front Art
                                        </button>
                                        <input type="text" placeholder="Refine style (e.g. 'Watercolor style')" value={frontRefinement} onChange={e => setFrontRefinement(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white"/>
                                    </div>
                                )}

                                {activePage === 3 && (
                                    <div className="space-y-4 animate-fade-in">
                                        <button onClick={() => handleGenImage(true)} disabled={isGeneratingBackImage} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-lg">
                                            {isGeneratingBackImage ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>} Generate Back Art
                                        </button>
                                        
                                        <div className="h-px bg-slate-800 my-4" />
                                        
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><Link size={10}/> Photo Album Link (QR)</label>
                                            <div className="flex gap-2">
                                                <input 
                                                    type="text" 
                                                    placeholder="Paste URL for QR Code..." 
                                                    value={memory.googlePhotosUrl || ''} 
                                                    onChange={e => setMemory({...memory, googlePhotosUrl: e.target.value})}
                                                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs text-white outline-none focus:border-indigo-500"
                                                />
                                            </div>
                                            <button 
                                                onClick={() => setMemory({...memory, googlePhotosUrl: 'https://photos.google.com/album/AF1QipMMMkVYTurznefCJ9jEQHN_o3xoPRQE-JLy8-CD'})}
                                                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-indigo-400 border border-slate-700 rounded-lg text-[10px] font-bold flex items-center justify-center gap-2 transition-colors"
                                            >
                                                <QrCode size={12}/> Use Family Album Preset
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {activePage === 1 && (
                                    <div className="space-y-4">
                                        <button onClick={handleGenText} disabled={isGeneratingText} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2">
                                            {isGeneratingText ? <Loader2 size={12} className="animate-spin"/> : <Wand2 size={12}/>} AI Write Message
                                        </button>
                                        <textarea rows={10} value={memory.cardMessage} onChange={e => setMemory({...memory, cardMessage: e.target.value})} className={`w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white outline-none resize-none ${memory.fontFamily || 'font-script'} text-xl`}/>
                                    </div>
                                )}
                                {activePage === 2 && (
                                    <div onClick={() => fileInputRef.current?.click()} className="p-8 border-2 border-dashed border-slate-700 rounded-xl hover:border-indigo-500 cursor-pointer text-center text-xs text-slate-500 group">
                                        <Upload className="mx-auto mb-2 opacity-50 group-hover:opacity-100 transition-opacity"/><input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*" onChange={async (e) => { if (e.target.files) { const photos = await Promise.all(Array.from(e.target.files).map(f => resizeImage(f as File, 1024))); setMemory(prev => ({...prev, userImages: [...prev.userImages, ...photos]})); } }}/> Upload Memories
                                        <p className="mt-2">Drag and drop family photos here</p>
                                    </div>
                                )}
                                {activePage === 4 && <button onClick={() => handleGenAudio('message')} disabled={isGeneratingVoice} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2">{isGeneratingVoice ? <Loader2 size={12} className="animate-spin"/> : <Mic size={12}/>} Generate Voice Greeting</button>}
                                {activePage === 5 && <button onClick={() => handleGenAudio('song')} disabled={isGeneratingSong} className="w-full py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2">{isGeneratingSong ? <Loader2 size={12} className="animate-spin"/> : <Music size={12}/>} Generate Custom Song</button>}
                            </div>
                        </div>
                  ) : (
                      <div className="flex flex-col h-full bg-slate-900">
                          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
                              {transcript.length === 0 && <div className="text-center text-slate-500 text-sm py-10 px-4">Elf is ready. Tap <strong>Talk to Elf</strong> below to start designing with voice!</div>}
                              {transcript.map((t, i) => <div key={i} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] p-3 rounded-xl text-xs whitespace-pre-wrap ${t.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}>{t.text}</div></div>)}
                              <div ref={transcriptEndRef} className="h-4"></div>
                          </div>
                      </div>
                  )}
              </div>

              <div className="flex-shrink-0 p-4 border-t border-slate-800 bg-slate-950 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                        <button onClick={handleLiveToggle} className={`flex-1 h-12 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 ${isLiveActive ? 'bg-red-600 text-white animate-pulse' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}>
                            {isLiveActive ? <MicOff size={20}/> : <Mic size={20}/>}
                            <span className="text-sm">{isLiveActive ? 'End Session' : 'Talk to Elf'}</span>
                        </button>
                        <button onClick={() => chatImageInputRef.current?.click()} className="h-12 w-12 flex items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors" title="Show Image to Elf">
                            <Camera size={20}/>
                        </button>
                        <input type="file" ref={chatImageInputRef} className="hidden" accept="image/*" onChange={async (e) => { if (e.target.files?.[0]) { const base64 = await resizeImage(e.target.files[0], 512, 0.7); liveServiceRef.current?.sendVideo(base64.split(',')[1], e.target.files[0].type); setTranscript(prev => [...prev, { role: 'user', text: '📷 [Sent Photo Inspiration]', timestamp: Date.now() }]); } }}/>
                  </div>
              </div>
          </div>
          )}

          {/* RIGHT PANEL: PREVIEW */}
          <div className="flex-1 bg-slate-950 p-4 md:p-8 flex flex-col items-center overflow-hidden relative">
              
              {/* FIXED HEADER: TOOLBAR */}
              <div className="flex-shrink-0 flex items-center gap-4 mb-6 bg-slate-900 p-2 rounded-full border border-slate-800 shadow-xl z-20">
                  <button onClick={onBack} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-full transition-colors"><ArrowLeft size={18} /></button>
                  <div className="w-px h-6 bg-slate-800"></div>
                  {!isViewer && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => setActivePage(p => Math.max(0, p - 1))} disabled={activePage === 0} className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-full disabled:opacity-30 transition-colors"><ChevronLeft size={18} /></button>
                        <span className="text-xs font-bold text-slate-300 min-w-[80px] text-center select-none uppercase tracking-wider">{getPageLabel(activePage)}</span>
                        <button onClick={() => setActivePage(p => Math.min(5, p + 1))} disabled={activePage === 5} className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-full disabled:opacity-30 transition-colors"><ChevronRight size={18} /></button>
                      </div>
                  )}
                  <div className="w-px h-6 bg-slate-800"></div>
                  <div className="flex gap-1 pr-1">
                      {isViewer && isOwner && <button onClick={() => setIsViewer(false)} className="p-2 bg-indigo-600 hover:bg-indigo-500 rounded-full text-white" title="Edit Card"><Edit size={16} /></button>}
                      <button onClick={handleExportPDF} disabled={isExporting} className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-full transition-colors" title="Download PDF">{isExporting ? <Loader2 size={16} className="animate-spin"/> : <Download size={16} />}</button>
                      <button onClick={handleDownloadPackage} disabled={isExportingPackage} className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-full transition-colors" title="Download Zip Package">{isExportingPackage ? <Loader2 size={16} className="animate-spin"/> : <Package size={16} />}</button>
                      {!isViewer && (
                        <button onClick={handlePublishAndShare} disabled={isPublishing} className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors shadow-lg" title="Publish Card Online">
                            {isPublishing ? <Loader2 size={16} className="animate-spin"/> : <Share2 size={16} />}
                        </button>
                      )}
                  </div>
              </div>

              {/* SCROLLABLE BODY: PREVIEW AREA */}
              {/* Removed items-center and justify-center when in viewer mode to fix starting scroll position */}
              <div className={`flex-1 w-full flex flex-col min-h-0 overflow-y-auto scrollbar-hide pb-10 ${isViewer ? '' : 'items-center justify-center'}`}>
                  {isViewer ? (
                      <div className="w-full flex flex-col items-center gap-12 py-8">
                          {[0, 1, 2, 3, 4, 5].map((pageNum) => (
                              <div key={pageNum} className="w-[330px] h-[495px] shadow-2xl relative overflow-hidden flex flex-col rounded-xl shrink-0">
                                  {renderCardContent(pageNum)}
                              </div>
                          ))}
                      </div>
                  ) : (
                      <div 
                          ref={cardRef} 
                          className="w-[330px] h-[495px] shadow-2xl relative overflow-hidden flex flex-col transition-all duration-300 rounded-xl shrink-0"
                      >
                          {renderCardContent(activePage)}
                      </div>
                  )}
              </div>

              {/* HIDDEN EXPORT AREA - Strictly lock dimensions for PDF capture */}
              {(isExporting || isExportingPackage) && (
                  <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', opacity: 0 }}>
                      {[0, 1, 2, 3].map(pageNum => (
                        <div key={pageNum} id={`export-card-page-${pageNum}`} style={{ width: '360px', height: '540px' }} className="overflow-hidden flex flex-col relative">
                            {renderCardContent(pageNum)}
                        </div>
                      ))}
                  </div>
              )}
          </div>
      </div>
      
      {showShareModal && shareLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
           <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
               <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-white flex items-center gap-2"><Sparkles className="text-emerald-400"/> Card Published!</h3><button onClick={() => setShowShareModal(false)}><X className="text-slate-400 hover:text-white"/></button></div>
               <p className="text-sm text-slate-300 mb-4">Your interactive holiday card is live. Share this link for friends to view and listen.</p>
               <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex items-center gap-2 mb-4">
                  <span className="flex-1 text-xs text-slate-300 truncate font-mono">{shareLink}</span>
                  <button onClick={() => { navigator.clipboard.writeText(shareLink); alert("Link copied!"); }} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"><Share2 size={14}/></button>
               </div>
               <button onClick={() => setShowShareModal(false)} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors">Done</button>
           </div>
        </div>
      )}

      {isPublishing && publishProgress && (
          <div className="fixed bottom-8 right-8 bg-slate-900 border border-indigo-500/50 p-4 rounded-xl shadow-2xl flex items-center gap-3 z-50 animate-fade-in">
              <Loader2 className="text-indigo-400 animate-spin" size={20}/>
              <span className="text-sm font-bold text-indigo-100">{publishProgress}</span>
          </div>
      )}

    </div>
  );
};
