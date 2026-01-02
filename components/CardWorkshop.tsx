
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
import { generateSecureId } from '../utils/idUtils';

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

const isLocalUrl = (url?: string) => url?.startsWith('blob:') || url?.startsWith('data:');

export const CardWorkshop: React.FC<CardWorkshopProps> = ({ onBack, cardId, isViewer: initialIsViewer = false }) => {
  const [memory, setMemory] = useState<AgentMemory>(DEFAULT_MEMORY);
  const [activeTab, setActiveTab] = useState<'settings' | 'chat'>('chat');
  const [activePage, setActivePage] = useState<number>(0); 
  const [isViewer, setIsViewer] = useState(initialIsViewer);
  
  const [isGeneratingText, setIsGeneratingText] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);

  const currentUser = auth?.currentUser;
  const isOwner = currentUser && (!memory.ownerId || memory.ownerId === currentUser.uid);

  useEffect(() => {
      if (cardId) {
          getCard(cardId).then(data => { if (data) setMemory(data); });
      }
  }, [cardId]);

  const handleGenText = async () => {
      setIsGeneratingText(true);
      try {
          const msg = await generateCardMessage(memory);
          setMemory(prev => ({ ...prev, cardMessage: msg }));
      } catch(e) { alert("Failed to generate text"); } finally { setIsGeneratingText(false); }
  };

  const handlePublishAndShare = async () => {
      if (!auth?.currentUser) return alert("Please sign in to share.");
      setIsPublishing(true);
      try {
          const cid = cardId || generateSecureId();
          const updatedMemory = { ...memory };

          const syncMedia = async (url: string | undefined, path: string) => {
              if (!url || !isLocalUrl(url)) return url;
              const res = await fetch(url);
              const blob = await res.blob();
              return await uploadFileToStorage(path, blob);
          };

          updatedMemory.coverImageUrl = await syncMedia(updatedMemory.coverImageUrl, `cards/${cid}/cover.jpg`);
          updatedMemory.voiceMessageUrl = await syncMedia(updatedMemory.voiceMessageUrl, `cards/${cid}/voice.wav`);

          const finalCardId = await saveCard(updatedMemory, cid); 
          setMemory(updatedMemory);
          const link = `${window.location.origin}?view=card&id=${finalCardId}`;
          setShareLink(link);
          alert("Card published to URI!");
      } catch(e: any) { 
          alert("Publish failed: " + e.message); 
      } finally { setIsPublishing(false); }
  };

  const renderCardContent = (page: number) => (
      <div className={`w-full h-full flex flex-col relative overflow-hidden ${memory.theme === 'chinese-poem' ? 'bg-[#f5f0e1]' : 'bg-white'}`}>
          {page === 0 && (memory.coverImageUrl ? <img src={memory.coverImageUrl} className="absolute inset-0 w-full h-full object-cover" crossOrigin="anonymous"/> : <div className="w-full h-full bg-slate-200 flex items-center justify-center text-slate-400">No Cover Art</div>)}
          {page === 1 && <div className="p-8 flex items-center justify-center h-full text-center text-slate-800"><p className={`whitespace-pre-wrap ${memory.fontFamily || 'font-script'}`} style={{ fontSize: `${22 * (memory.fontSizeScale || 1.0)}px` }}>{memory.cardMessage}</p></div>}
          {page === 3 && <div className="p-8 h-full flex flex-col items-center justify-center text-center"><QrCode size={64} className="text-slate-300"/><p className="text-[10px] font-bold text-slate-400 uppercase mt-4">AIVoiceCast Memory</p></div>}
      </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden relative">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 shrink-0 z-20">
          <div className="flex items-center gap-4">
              <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"><ArrowLeft size={20} /></button>
              <h1 className="text-lg font-bold text-white flex items-center gap-2"><Gift className="text-red-500" /> Neural Card Lab</h1>
          </div>
          <div className="flex items-center gap-3">
              <button onClick={handlePublishAndShare} disabled={isPublishing} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-lg">
                  {isPublishing ? <Loader2 size={14} className="animate-spin"/> : <Share2 size={14}/>}
                  <span>Save & Share URI</span>
              </button>
          </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          <div className="w-full md:w-96 bg-slate-900 border-r border-slate-800 p-6 space-y-6 overflow-y-auto">
              <button onClick={handleGenText} disabled={isGeneratingText} className="w-full py-3 bg-indigo-600 rounded-xl font-bold flex items-center justify-center gap-2">{isGeneratingText ? <Loader2 size={18} className="animate-spin"/> : <Sparkles size={18}/>} AI Write Message</button>
              <textarea rows={10} value={memory.cardMessage} onChange={e => setMemory({...memory, cardMessage: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-white outline-none resize-none font-script text-xl"/>
          </div>
          <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center p-8 overflow-y-auto">
                {shareLink && (
                    <div className="mb-6 w-full max-w-md bg-slate-900 border border-indigo-500/50 rounded-xl p-4 flex items-center justify-between">
                        <div className="overflow-hidden"><p className="text-[10px] text-indigo-400 uppercase font-bold mb-1">Card URI</p><p className="text-xs text-slate-400 truncate">{shareLink}</p></div>
                        <button onClick={() => { navigator.clipboard.writeText(shareLink); alert("Copied!"); }} className="p-2 bg-slate-800 rounded-lg"><Link size={16}/></button>
                    </div>
                )}
                <div className="w-[330px] h-[495px] shadow-2xl relative overflow-hidden flex flex-col rounded-xl shrink-0 bg-white">
                    {renderCardContent(activePage)}
                </div>
                <div className="flex items-center gap-4 mt-8">
                    <button onClick={() => setActivePage(p => Math.max(0, p - 1))} className="p-2 bg-slate-800 rounded-full"><ChevronLeft/></button>
                    <span className="text-xs font-bold uppercase">{getPageLabel(activePage)}</span>
                    <button onClick={() => setActivePage(p => Math.min(3, p + 1))} className="p-2 bg-slate-800 rounded-full"><ChevronRight/></button>
                </div>
          </div>
      </div>
    </div>
  );
};

const getPageLabel = (page: number) => { switch(page) { case 0: return 'Front'; case 1: return 'Message'; case 2: return 'Photos'; case 3: return 'Back'; default: return 'Page'; } };
