
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  ArrowLeft, Wallet, Save, Download, Sparkles, Loader2, User, Hash, QrCode, Mail, 
  Trash2, Printer, CheckCircle, AlertTriangle, Send, Share2, DollarSign, Calendar, 
  Landmark, Info, Search, Edit3, RefreshCw, ShieldAlert, X, ChevronRight, ImageIcon, Link, Coins, Check as CheckIcon, Palette, Copy, ZoomIn, ZoomOut, Maximize2, PenTool, Upload, Camera, MapPin
} from 'lucide-react';
import { BankingCheck, UserProfile } from '../types';
import { GoogleGenAI } from "@google/genai";
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
  senderAddress: '123 Neural Way, Silicon Valley, CA',
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
  const [showSignPad, setShowSignPad] = useState(false);
  const [zoom, setZoom] = useState(1.0);
  const [justCopied, setJustCopied] = useState(false);
  
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
              contents: `Parse into JSON for a banking check. Include fields: payee, amount, memo, routingNumber, accountNumber, senderName, senderAddress, recipientAddress. Input: "${input}"`,
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
      if (shareLink) {
          navigator.clipboard.writeText(shareLink);
          setJustCopied(true);
          setTimeout(() => setJustCopied(false), 2000);
          return;
      }

      if (!auth.currentUser) return alert("Please sign in to publish.");
      setIsSharing(true);
      try {
          const id = check.id || generateSecureId();
          
          let finalWatermarkUrl = customArtUrl || '';
          if (customArtUrl?.startsWith('data:')) {
             try {
                const res = await fetch(customArtUrl);
                const blob = await res.blob();
                finalWatermarkUrl = await uploadFileToStorage(`checks/${id}/watermark.png`, blob);
             } catch(e) { console.warn("Failed to sync watermark to cloud storage", e); }
          }

          let finalSignatureUrl = check.signatureUrl || '';
          if (check.signatureUrl?.startsWith('data:')) {
              try {
                const res = await fetch(check.signatureUrl);
                const blob = await res.blob();
                finalSignatureUrl = await uploadFileToStorage(`checks/${id}/signature.png`, blob);
              } catch(e) { console.warn("Failed to sync signature to cloud storage", e); }
          }

          const finalId = await saveBankingCheck({
              ...check,
              id,
              ownerId: auth.currentUser.uid,
              watermarkUrl: finalWatermarkUrl,
              signatureUrl: finalSignatureUrl
          });

          // Attempt PDF generation and G-Drive sync
          try {
              const blob = await generatePDFBlob();
              if (blob) {
                  const token = getDriveToken() || await connectGoogleDrive();
                  if (token) {
                      const folderId = await ensureCodeStudioFolder(token);
                      await uploadToDrive(token, folderId, `Check_${check.checkNumber}.pdf`, blob);
                  }
              }
          } catch(e) { console.warn("G-Drive sync failed during publish", e); }

          const link = check.isCoinCheck 
            ? `${window.location.origin}?claim=${finalId}` 
            : `${window.location.origin}?view=check&id=${finalId}`;
            
          setShareLink(link);
          setCheck(prev => ({ ...prev, id: finalId }));
          // Removed alert in favor of direct button update
      } catch (e: any) {
          console.error("Publishing error:", e);
          alert("Publishing failed: " + (e.message || "Network Error"));
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
      try {
        const blob = await generatePDFBlob();
        if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `check_${check.checkNumber}.pdf`; a.click();
            URL.revokeObjectURL(url);
        }
      } catch(e) { alert("Download failed"); }
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
              <button onClick={handlePublishAndShareLink} disabled={isSharing} className={`flex items-center gap-2 px-4 py-2 ${shareLink ? (justCopied ? 'bg-emerald-600' : 'bg-indigo-600') : 'bg-indigo-600'} hover:opacity-90 text-white rounded-lg text-xs font-bold shadow-lg transition-all`}>
                  {isSharing ? <Loader2 size={14} className="animate-spin"/> : (justCopied ? <CheckIcon size={14}/> : <Share2 size={14}/>)}
                  <span>{isSharing ? 'Processing...' : (shareLink ? (justCopied ? 'Copied URI' : 'Copy Share URI') : (check.isCoinCheck ? 'Issue Coin Check' : 'Publish & Share URI'))}</span>
              </button>
              <button onClick={handleDownloadPDF} disabled={isExporting} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold border border-slate-700">
                  {isExporting ? <Loader2 size={14} className="animate-spin"/> : <Download size={14} />}
                  <span>Download PDF</span>
              </button>
          </div>
      </header>

      <div className="flex-1 flex overflow-hidden flex-col lg:flex-row">
          <div className="w-full lg:w-[450px] border-r border-slate-800 bg-slate-900/30 flex flex-col shrink-0 overflow-y-auto p-6 space-y-6 scrollbar-thin">
              <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Palette className="text-indigo-400"/> Transaction Type</h3>
                    <button onClick={handleParseCheckDetails} disabled={isParsing} className="text-[10px] font-bold text-indigo-400 flex items-center gap-1">
                        {isParsing ? <Loader2 size={10} className="animate-spin"/> : <Sparkles size={10}/>} Neural Parse
                    </button>
                  </div>
                  <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                      <button onClick={() => setCheck({...check, isCoinCheck: false})} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${!check.isCoinCheck ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}><Landmark size={14}/> Standard</button>
                      <button onClick={() => setCheck({...check, isCoinCheck: true})} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${check.isCoinCheck ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}><Coins size={14}/> Voice Coin</button>
                  </div>
              </div>

              <div className="space-y-4 bg-slate-800/20 p-4 rounded-xl border border-slate-800">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Landmark size={14}/> Bank & Account</h3>
                  <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="text-[9px] font-bold text-slate-600 uppercase mb-1 block">Bank Name</label>
                        <input type="text" value={check.bankName} onChange={e => setCheck({...check, bankName: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"/>
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-600 uppercase mb-1 block">Routing #</label>
                        <input type="text" value={check.routingNumber} onChange={e => setCheck({...check, routingNumber: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"/>
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-600 uppercase mb-1 block">Account #</label>
                        <input type="text" value={check.accountNumber} onChange={e => setCheck({...check, accountNumber: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"/>
                      </div>
                  </div>
              </div>

              <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><User size={14}/> Sender Info</h3>
                  <div className="space-y-3">
                      <input type="text" placeholder="Sender Name" value={check.senderName} onChange={e => setCheck({...check, senderName: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none"/>
                      <textarea placeholder="Sender Address" value={check.senderAddress} onChange={e => setCheck({...check, senderAddress: e.target.value})} rows={2} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none resize-none"/>
                  </div>
              </div>

              <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><DollarSign size={14}/> Payment Details</h3>
                  <div className="grid grid-cols-1 gap-3">
                      <div className="flex gap-2">
                        <div className="flex-1">
                            <label className="text-[9px] font-bold text-slate-600 uppercase mb-1 block">Payee Name</label>
                            <input type="text" placeholder="Bearer..." value={check.payee} onChange={e => setCheck({...check, payee: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none focus:border-indigo-500"/>
                        </div>
                        <div className="w-32">
                            <label className="text-[9px] font-bold text-slate-600 uppercase mb-1 block">Amount</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">{check.isCoinCheck ? <Coins size={14}/> : '$'}</span>
                                <input type="number" value={check.isCoinCheck ? check.coinAmount : check.amount} onChange={e => setCheck(check.isCoinCheck ? {...check, coinAmount: parseInt(e.target.value)} : {...check, amount: parseFloat(e.target.value)})} className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-2.5 py-2.5 text-sm text-white text-right"/>
                            </div>
                        </div>
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-600 uppercase mb-1 block">Recipient Address (Optional)</label>
                        <input type="text" placeholder="123 Ocean Blvd..." value={check.recipientAddress} onChange={e => setCheck({...check, recipientAddress: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white"/>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                            <label className="text-[9px] font-bold text-slate-600 uppercase mb-1 block">Memo</label>
                            <input type="text" placeholder="For..." value={check.memo} onChange={e => setCheck({...check, memo: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white"/>
                        </div>
                        <div className="w-24">
                            <label className="text-[9px] font-bold text-slate-600 uppercase mb-1 block">Check #</label>
                            <input type="text" value={check.checkNumber} onChange={e => setCheck({...check, checkNumber: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white font-mono"/>
                        </div>
                      </div>
                      <div className="flex gap-2">
                          <button onClick={() => setShowSignPad(true)} className="flex-1 py-3 bg-slate-800 text-xs font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-2 hover:bg-slate-700 transition-colors"><PenTool size={16}/> Sign</button>
                          <button onClick={handleGenerateArt} disabled={isGeneratingArt} className="flex-1 py-3 bg-slate-800 text-xs font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-2 hover:bg-slate-700 transition-colors">{isGeneratingArt ? <Loader2 size={16} className="animate-spin"/> : <ImageIcon size={16}/>} Neural Art</button>
                      </div>
                  </div>
              </div>
          </div>

          <div className="flex-1 bg-slate-950 flex flex-col p-12 items-center overflow-y-auto scrollbar-hide relative">
              <div 
                ref={checkRef}
                style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
                className={`w-[600px] h-[270px] bg-white text-black shadow-2xl flex flex-col border ${check.isCoinCheck ? 'border-amber-400 ring-4 ring-amber-400/20' : 'border-slate-300'} relative shrink-0 p-8 rounded-sm overflow-hidden`}
              >
                  {/* High Contrast Top-Centered QR Code - Solid for easy phone scanning */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                      <img src={qrCodeUrl} className="w-24 h-24 border-2 border-slate-100 p-1 rounded bg-white shadow-2xl" />
                  </div>

                  {/* Watermark (Etching) */}
                  <div className="absolute inset-0 opacity-[0.05] flex items-center justify-center pointer-events-none">
                      {customArtUrl ? <img src={customArtUrl} className="w-[300px] h-[300px] object-contain grayscale" /> : <Landmark size={200}/>}
                  </div>

                  {/* Top Section */}
                  <div className="flex justify-between items-start mb-4 relative z-10">
                      <div className="flex flex-col">
                          <div className="font-black uppercase text-[10px] leading-tight">{check.senderName}</div>
                          <div className="text-[8px] text-slate-600 max-w-[150px] leading-tight whitespace-pre-wrap">{check.senderAddress}</div>
                      </div>
                      <div className="text-right">
                          <p className="text-sm font-black italic text-indigo-900 leading-none">{check.isCoinCheck ? 'VOICECOIN PROTOCOL' : check.bankName}</p>
                          <p className="text-[10px] font-bold mt-1">CHECK NO. {check.checkNumber}</p>
                      </div>
                  </div>

                  {/* Date and Amount Box */}
                  <div className="flex justify-end gap-6 items-center mb-4 relative z-10">
                      <div className="flex flex-col items-end">
                        <span className="text-[8px] font-bold text-slate-400 uppercase">Date</span>
                        <span className="text-xs font-bold border-b border-black min-w-[80px] text-center">{check.date}</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-300 px-4 py-2 font-black text-xl shadow-inner">
                        {check.isCoinCheck ? `VC ${check.coinAmount}` : `$ ${check.amount.toFixed(2)}`}
                      </div>
                  </div>

                  {/* Payee */}
                  <div className="flex items-center gap-4 relative z-10 mb-2">
                      <div className="flex-1 flex flex-col">
                          <span className="text-[8px] font-bold text-slate-400 uppercase">Pay to the Order of</span>
                          <div className="border-b border-black text-sm font-black italic pt-1 h-7">{check.payee}</div>
                      </div>
                  </div>

                  {/* Amount Words */}
                  <div className="flex flex-col relative z-10 mb-4">
                      <div className="border-b border-black text-[10px] font-bold pt-2 h-6 flex items-center">
                        {check.amountWords}
                        <span className="ml-auto text-[8px] text-slate-400 uppercase font-black">{check.isCoinCheck ? 'COINS' : 'DOLLARS'}</span>
                      </div>
                  </div>

                  {/* Bottom Row */}
                  <div className="flex items-end justify-between mt-auto relative z-10">
                      <div className="w-[35%] flex flex-col">
                          <span className="text-[8px] font-bold text-slate-400 uppercase">Memo</span>
                          <div className="border-b border-black text-[10px] pb-1 font-medium truncate">{check.memo}</div>
                          {check.recipientAddress && <div className="text-[7px] text-slate-400 mt-0.5 truncate italic">For: {check.recipientAddress}</div>}
                      </div>

                      {/* MICR Line */}
                      <div className="font-mono text-xs tracking-widest text-slate-800 flex items-center gap-3">
                          <span>⑆ {check.routingNumber} ⑆</span>
                          <span>{check.accountNumber} ⑈</span>
                          <span>{check.checkNumber}</span>
                      </div>

                      <div className="w-[30%] flex flex-col items-center">
                          <div className="border-b border-black w-full text-center pb-1 h-8 flex items-end justify-center">
                              {check.signatureUrl ? (
                                  <img src={check.signatureUrl} className="h-8 max-w-full object-contain" />
                              ) : (
                                  <span className="text-xl font-script text-slate-400">{check.signature || check.senderName}</span>
                              )}
                          </div>
                          <span className="text-[8px] font-bold text-slate-400 uppercase mt-1">Authorized Signature</span>
                      </div>
                  </div>
              </div>

              {/* View options */}
              <div className="mt-8 flex gap-4">
                  <button onClick={() => setZoom(prev => Math.max(0.5, prev - 0.1))} className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white"><ZoomOut size={16}/></button>
                  <button onClick={() => setZoom(1)} className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-bold text-slate-400">{Math.round(zoom * 100)}%</button>
                  <button onClick={() => setZoom(prev => Math.min(2, prev + 0.1))} className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white"><ZoomIn size={16}/></button>
              </div>
          </div>
      </div>

      {showSignPad && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
              <div className="bg-white border border-slate-200 rounded-[2rem] w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <div className="flex items-center gap-3"><PenTool className="text-indigo-600" /><h3 className="font-bold text-slate-900">Digital Signature</h3></div>
                      <button onClick={() => setShowSignPad(false)} className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400"><X size={20}/></button>
                  </div>
                  <div className="bg-white m-6 rounded-xl overflow-hidden border border-slate-200 h-64 relative">
                      <Whiteboard disableAI={true} onDataChange={() => {}} initialColor="#000000" backgroundColor="#ffffff" />
                      <div className="absolute bottom-4 right-4 z-50 flex gap-2">
                          <button onClick={() => setShowSignPad(false)} className="bg-slate-100 text-slate-600 hover:bg-slate-200 px-6 py-2 rounded-lg font-bold transition-colors">Cancel</button>
                          <button onClick={() => { 
                              const canvas = document.querySelector('canvas'); 
                              if (canvas) setCheck(prev => ({...prev, signatureUrl: canvas.toDataURL()})); 
                              setShowSignPad(false); 
                          }} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 transition-all"><CheckIcon size={18}/> Save Signature</button>
                      </div>
                  </div>
                  <div className="px-6 pb-6 text-center">
                      <p className="text-xs text-slate-400">Sign your name in the box above using your mouse or touch screen.</p>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
