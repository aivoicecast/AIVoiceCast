
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  ArrowLeft, Wallet, Save, Download, Sparkles, Loader2, User, Hash, QrCode, Mail, 
  Trash2, Printer, CheckCircle, AlertTriangle, Send, Share2, DollarSign, Calendar, 
  Landmark, Info, Search, Edit3, RefreshCw, ShieldAlert, X, ChevronRight, ImageIcon, Link, Coins, Check as CheckIcon, Palette, Copy, ZoomIn, ZoomOut, Maximize2, PenTool, Upload, Camera, MapPin
} from 'lucide-react';
import { BankingCheck, UserProfile } from '../types';
import { GoogleGenAI } from '@google/genai';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { getAllUsers, sendMessage, uploadFileToStorage, saveBankingCheck, claimCoinCheck } from '../services/firestoreService';
import { auth } from '../services/firebaseConfig';
import { getDriveToken, connectGoogleDrive } from '../services/authService';
import { ensureCodeStudioFolder, uploadToDrive } from '../services/googleDriveService';
import { Whiteboard } from './Whiteboard';
import { resizeImage } from '../utils/imageUtils';
import { generateSecureId } from '../utils/idUtils';

interface CheckDesignerProps {
  onBack: () => void;
  currentUser: any;
}

const DEFAULT_CHECK: BankingCheck = {
  id: '',
  payee: 'The Bearer',
  amount: 100.00,
  amountWords: 'One Hundred Dollars and 00/100',
  date: new Date().toISOString().split('T')[0],
  memo: 'General Payment',
  checkNumber: '1001',
  routingNumber: '123456789',
  accountNumber: '987654321',
  bankName: 'Neural Prism Bank',
  senderName: 'Account Holder',
  senderAddress: '',
  recipientAddress: '',
  signature: '',
  isCoinCheck: false,
  coinAmount: 0
};

export const CheckDesigner: React.FC<CheckDesignerProps> = ({ onBack, currentUser }) => {
  const [check, setCheck] = useState<BankingCheck>(({
      ...DEFAULT_CHECK,
      senderName: currentUser?.displayName || DEFAULT_CHECK.senderName
  }));
  
  const [isParsing, setIsParsing] = useState(false);
  const [isUpdatingWords, setIsUpdatingWords] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isGeneratingArt, setIsGeneratingArt] = useState(false);
  const [customArtUrl, setCustomArtUrl] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showSignPad, setShowSignPad] = useState(false);
  
  const checkRef = useRef<HTMLDivElement>(null);
  const signInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
    }

    const amountToSpell = check.isCoinCheck ? (check.coinAmount || 0) : check.amount;
    if (amountToSpell > 0) {
        debounceTimerRef.current = setTimeout(() => {
            handleGenerateAmountWords(amountToSpell, check.isCoinCheck);
        }, 1200); 
    }

    return () => {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [check.amount, check.coinAmount, check.isCoinCheck]);

  const qrCodeUrl = useMemo(() => {
      const baseUri = shareLink || `${window.location.origin}?view=check&id=${check.id || 'preview'}`;
      return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(baseUri)}`;
  }, [shareLink, check.id]);

  const handleParseCheckDetails = async () => {
      const input = prompt("Paste raw payment instructions:");
      if (!input) return;

      setIsParsing(true);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const response = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: `Parse into JSON for a banking check: "${input}"`,
              config: { responseMimeType: 'application/json' }
          });
          const parsed = JSON.parse(response.text || '{}');
          setCheck(prev => ({ ...prev, ...parsed }));
      } catch (e) {
          alert("Neural parse failed.");
      } finally {
          setIsParsing(null);
      }
  };

  const handleGenerateArt = async () => {
      if (!check.memo) return alert("Enter a memo first.");
      setIsGeneratingArt(true);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash-image',
              contents: { parts: [{ text: `A professional etching style watermark for a check: ${check.memo}` }] },
          });
          for (const part of response.candidates[0].content.parts) {
              if (part.inlineData) {
                  setCustomArtUrl(`data:image/png;base64,${part.inlineData.data}`);
                  break;
              }
          }
      } catch (e) {
          alert("Art generation failed.");
      } finally {
          setIsGeneratingArt(false);
      }
  };

  const handleGenerateAmountWords = async (val: number, isCoins = false) => {
      setIsUpdatingWords(true);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const response = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: `Convert ${val} to check words (${isCoins ? 'Coins' : 'Dollars'}). Return text only.`
          });
          const text = response.text?.trim() || '';
          if (text) setCheck(prev => ({ ...prev, amountWords: text }));
      } catch (e) {
          console.error("Word gen failed", e);
      } finally {
          setIsUpdatingWords(false);
      }
  };

  const handlePublishAndShareLink = async () => {
      if (!auth.currentUser) return alert("Please sign in to publish.");
      setIsSharing(true);
      try {
          const id = check.id || generateSecureId();
          
          let finalWatermarkUrl = customArtUrl || '';
          if (customArtUrl?.startsWith('data:')) {
             const res = await fetch(customArtUrl);
             const blob = await res.blob();
             finalWatermarkUrl = await uploadFileToStorage(`checks/${id}/watermark.png`, blob);
          }

          let finalSignatureUrl = check.signatureUrl || '';
          if (check.signatureUrl?.startsWith('data:')) {
              const res = await fetch(check.signatureUrl);
              const blob = await res.blob();
              finalSignatureUrl = await uploadFileToStorage(`checks/${id}/signature.png`, blob);
          }

          const finalId = await saveBankingCheck({
              ...check,
              id,
              ownerId: auth.currentUser.uid,
              watermarkUrl: finalWatermarkUrl,
              signatureUrl: finalSignatureUrl
          });

          const blob = await generatePDFBlob();
          if (blob) {
              const token = getDriveToken() || await connectGoogleDrive();
              if (token) {
                  const folderId = await ensureCodeStudioFolder(token);
                  await uploadToDrive(token, folderId, `Check_${check.checkNumber}.pdf`, blob);
              }
          }

          const link = check.isCoinCheck 
            ? `${window.location.origin}?claim=${finalId}` 
            : `${window.location.origin}?view=check&id=${finalId}`;
            
          setShareLink(link);
          setCheck(prev => ({ ...prev, id: finalId }));
          alert(check.isCoinCheck ? "Coin Check Issued!" : "Check published!");
      } catch (e: any) {
          alert("Publishing failed: " + e.message);
      } finally {
          setIsSharing(false);
      }
  };

  const generatePDFBlob = async (): Promise<Blob | null> => {
    if (!checkRef.current) return null;
    const canvas = await html2canvas(checkRef.current, { scale: 4, useCORS: true, backgroundColor: '#ffffff' });
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [600, 270] });
    pdf.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, 600, 270);
    return pdf.output('blob');
  };

  const handleDownloadPDF = async () => {
      setIsExporting(true);
      const blob = await generatePDFBlob();
      if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = `check_${check.checkNumber}.pdf`; a.click();
      }
      setIsExporting(false);
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) {
          const base64 = await resizeImage(e.target.files[0], 400, 0.9);
          setCheck(prev => ({ ...prev, signatureUrl: base64 }));
      }
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-20">
          <div className="flex items-center gap-4">
              <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"><ArrowLeft size={20} /></button>
              <h1 className="text-lg font-bold text-white flex items-center gap-2"><Wallet className="text-amber-400" /> Neural Check Designer</h1>
          </div>
          <div className="flex items-center gap-3">
              <button onClick={handlePublishAndShareLink} disabled={isSharing} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-lg transition-all">
                  {isSharing ? <Loader2 size={14} className="animate-spin"/> : <Share2 size={14}/>}
                  <span>{isSharing ? 'Processing...' : (check.isCoinCheck ? 'Issue Coin Check' : 'Publish & Share URI')}</span>
              </button>
              <button onClick={handleDownloadPDF} disabled={isExporting} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold border border-slate-700">
                  {isExporting ? <Loader2 size={14} className="animate-spin"/> : <Download size={14} />}
                  <span>Download PDF</span>
              </button>
          </div>
      </header>

      <div className="flex-1 flex overflow-hidden flex-col lg:flex-row">
          <div className="w-full lg:w-[450px] border-r border-slate-800 bg-slate-900/30 flex flex-col shrink-0 overflow-y-auto p-6 space-y-8 scrollbar-thin">
              <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Palette className="text-indigo-400"/> Transaction Type</h3>
                  <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                      <button onClick={() => setCheck({...check, isCoinCheck: false})} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${!check.isCoinCheck ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}><Landmark size={14}/> Standard</button>
                      <button onClick={() => setCheck({...check, isCoinCheck: true})} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${check.isCoinCheck ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}><Coins size={14}/> Voice Coin</button>
                  </div>
              </div>

              <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Payment Amount</h3>
                  <div className="grid grid-cols-1 gap-3">
                      <div className="flex gap-2">
                        <input type="text" placeholder="Payee..." value={check.payee} onChange={e => setCheck({...check, payee: e.target.value})} className="flex-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none focus:border-indigo-500"/>
                        <div className="relative w-32">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">{check.isCoinCheck ? <Coins size={14}/> : '$'}</span>
                            <input type="number" value={check.isCoinCheck ? check.coinAmount : check.amount} onChange={e => setCheck(check.isCoinCheck ? {...check, coinAmount: parseInt(e.target.value)} : {...check, amount: parseFloat(e.target.value)})} className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-2.5 py-2.5 text-sm text-white text-right"/>
                        </div>
                      </div>
                      <input type="text" placeholder="Memo..." value={check.memo} onChange={e => setCheck({...check, memo: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white"/>
                      <div className="flex gap-2">
                          <button onClick={() => setShowSignPad(true)} className="flex-1 py-3 bg-slate-800 text-xs font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-2"><PenTool size={16}/> Sign</button>
                          <button onClick={handleGenerateArt} disabled={isGeneratingArt} className="flex-1 py-3 bg-slate-800 text-xs font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-2">{isGeneratingArt ? <Loader2 size={16} className="animate-spin"/> : <ImageIcon size={16}/>} Neural Art</button>
                      </div>
                  </div>
              </div>
          </div>

          <div className="flex-1 bg-slate-950 flex flex-col p-12 items-center overflow-y-auto scrollbar-hide relative">
              <div 
                ref={checkRef}
                className={`w-[600px] h-[270px] bg-white text-black shadow-2xl flex flex-col border ${check.isCoinCheck ? 'border-amber-400' : 'border-slate-300'} relative shrink-0 p-8 rounded-sm`}
              >
                  <div className="absolute inset-0 opacity-[0.06] flex items-center justify-center pointer-events-none">
                      {customArtUrl ? <img src={customArtUrl} className="w-[300px] h-[300px] object-contain grayscale" /> : <Landmark size={200}/>}
                  </div>
                  <div className="flex justify-between items-start mb-6">
                      <div className="font-black uppercase text-xs">{check.senderName}</div>
                      <div className="text-right"><p className="text-sm font-black italic text-indigo-900">{check.isCoinCheck ? 'VoiceCoin Protocol' : check.bankName}</p><p className="text-[10px] font-bold">{check.checkNumber}</p></div>
                  </div>
                  <div className="flex justify-end gap-8 items-center mb-4">
                      <span className="text-xs font-medium border-b border-black pb-1">{check.date}</span>
                      <div className="bg-slate-50 border border-slate-300 px-4 py-2 font-black text-xl">{check.isCoinCheck ? `VC ${check.coinAmount}` : `$ ${check.amount.toFixed(2)}`}</div>
                  </div>
                  <div className="flex-1 border-b border-black text-sm font-black italic pt-2">{check.payee}</div>
                  <div className="flex-1 border-b border-black text-xs font-bold pt-4">{check.amountWords}</div>
                  <div className="flex items-end justify-between mt-4">
                      <div className="w-[30%] border-b border-black text-xs pb-1">For: {check.memo}</div>
                      <img src={qrCodeUrl} className="w-20 h-20 border p-1 rounded bg-white" />
                      <div className="w-[30%] border-b border-black text-xl font-script text-center pb-1">{check.signatureUrl ? <img src={check.signatureUrl} className="h-8 mx-auto" /> : (check.signature || check.senderName)}</div>
                  </div>
              </div>
          </div>
      </div>

      {showSignPad && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
              <div className="bg-slate-900 border border-slate-700 rounded-[2rem] w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl">
                  <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                      <div className="flex items-center gap-3"><PenTool className="text-indigo-400" /><h3 className="font-bold text-white">Digital Signature</h3></div>
                      <button onClick={() => setShowSignPad(false)} className="p-1.5 hover:bg-slate-800 rounded-full text-slate-500"><X size={20}/></button>
                  </div>
                  <div className="bg-white m-6 rounded-xl overflow-hidden border border-slate-700 h-64 relative">
                      <Whiteboard disableAI={true} onDataChange={() => {}} />
                      <div className="absolute bottom-4 right-4 z-50">
                          <button onClick={() => { const canvas = document.querySelector('canvas'); if (canvas) setCheck({...check, signatureUrl: canvas.toDataURL()}); setShowSignPad(false); }} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2"><CheckIcon size={18}/> Save Signature</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
