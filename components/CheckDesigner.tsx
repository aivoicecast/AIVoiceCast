
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
import { getAllUsers, sendMessage, uploadFileToStorage, saveBankingCheck, claimCoinCheck, getCheckById } from '../services/firestoreService';
import { auth } from '../services/firebaseConfig';
import { getDriveToken, connectGoogleDrive } from '../services/authService';
import { ensureCodeStudioFolder, uploadToDrive } from '../services/googleDriveService';
import { Whiteboard } from './Whiteboard';
import { resizeImage } from '../utils/imageUtils';
import { generateSecureId } from '../utils/idUtils';
import { ShareModal } from './ShareModal';

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
  const params = new URLSearchParams(window.location.search);
  const isReadOnly = params.get('mode') === 'view' || params.get('view') === 'check_viewer';
  const checkIdFromUrl = params.get('id');

  const [check, setCheck] = useState<BankingCheck>(({
      ...DEFAULT_CHECK,
      senderName: currentUser?.displayName || DEFAULT_CHECK.senderName
  }));
  
  const [isParsing, setIsParsing] = useState(false);
  const [isUpdatingWords, setIsUpdatingWords] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isGeneratingArt, setIsGeneratingArt] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [showSignPad, setShowSignPad] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [zoom, setZoom] = useState(1.0);
  const [isLoadingCheck, setIsLoadingCheck] = useState(!!checkIdFromUrl);
  
  const checkRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
      if (checkIdFromUrl) {
          setIsLoadingCheck(true);
          const fetchCheck = async () => {
              try {
                  const data = await getCheckById(checkIdFromUrl);
                  if (data) {
                      setCheck(data);
                      setShareLink(`${window.location.origin}?view=check_viewer&id=${data.id}`);
                  }
              } catch(e) { console.warn("Failed to load check", e); }
              finally { setIsLoadingCheck(false); }
          };
          fetchCheck();
      }
  }, [checkIdFromUrl]);

  useEffect(() => {
    const handleAutoZoom = () => {
        if (window.innerWidth < 640) {
            // Margin for mobile viewport
            const ratio = (window.innerWidth - 32) / 600;
            setZoom(ratio);
        } else {
            setZoom(1.0);
        }
    };
    handleAutoZoom();
    window.addEventListener('resize', handleAutoZoom);
    return () => window.removeEventListener('resize', handleAutoZoom);
  }, []);

  useEffect(() => {
    if (isReadOnly) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    const amountToSpell = check.isCoinCheck ? (check.coinAmount || 0) : (check.amount || 0);
    if (amountToSpell > 0) {
        debounceTimerRef.current = setTimeout(() => {
            handleGenerateAmountWords(amountToSpell, check.isCoinCheck);
        }, 1200); 
    }

    return () => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); };
  }, [check.amount, check.coinAmount, check.isCoinCheck, isReadOnly]);

  const qrCodeUrl = useMemo(() => {
      const baseUri = shareLink || `${window.location.origin}?view=check_viewer&id=${check.id || 'preview'}`;
      return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&color=0-0-0&bgcolor=255-255-255&data=${encodeURIComponent(baseUri)}`;
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
      } catch (e) { alert("Neural parse failed."); } finally { setIsParsing(false); }
  };

  const handleGenerateArt = async () => {
      if (!check.memo) return alert("Enter a memo first.");
      setIsGeneratingArt(true);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash-image',
              contents: { parts: [{ text: `A professional high-contrast fine-line watermark etching for a check background: ${check.memo}. Minimalist, bold lines, easy to see against white. Full width aspect ratio.` }] },
          });
          for (const part of response.candidates[0].content.parts) {
              if (part.inlineData) {
                  setCheck(prev => ({ ...prev, watermarkUrl: `data:image/png;base64,${part.inlineData.data}` }));
                  break;
              }
          }
      } catch (e) { alert("Art generation failed."); } finally { setIsGeneratingArt(false); }
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
      } catch (e) { console.error("Word gen failed", e); } finally { setIsUpdatingWords(false); }
  };

  const handlePublishAndShareLink = async () => {
      if (shareLink) {
          setShowShareModal(true);
          return;
      }

      if (!auth.currentUser) return alert("Please sign in to publish.");
      setIsSharing(true);
      try {
          const id = check.id || generateSecureId();
          
          let finalWatermarkUrl = check.watermarkUrl || '';
          if (check.watermarkUrl?.startsWith('data:')) {
             const res = await fetch(check.watermarkUrl);
             const blob = await res.blob();
             finalWatermarkUrl = await uploadFileToStorage(`checks/${id}/watermark.png`, blob);
          }

          let finalSignatureUrl = check.signatureUrl || '';
          if (check.signatureUrl?.startsWith('data:')) {
              const res = await fetch(check.signatureUrl);
              const blob = await res.blob();
              finalSignatureUrl = await uploadFileToStorage(`checks/${id}/signature.png`, blob);
          }

          const checkToSave = {
              ...check, id, ownerId: auth.currentUser.uid,
              watermarkUrl: finalWatermarkUrl, signatureUrl: finalSignatureUrl
          };

          const finalId = await saveBankingCheck(checkToSave);

          try {
              const blob = await generatePDFBlob();
              if (blob) {
                  const token = getDriveToken() || await connectGoogleDrive();
                  const folderId = await ensureCodeStudioFolder(token);
                  await uploadToDrive(token, folderId, `Check_${check.checkNumber}.pdf`, blob);
              }
          } catch(e) { console.warn("G-Drive sync failed", e); }

          const link = `${window.location.origin}?view=check_viewer&id=${finalId}`;
          setShareLink(link);
          setCheck(checkToSave);
          setShowShareModal(true);
      } catch (e: any) { alert("Publishing failed: " + (e.message || "Network Error")); } finally { setIsSharing(false); }
  };

  const generatePDFBlob = async (): Promise<Blob | null> => {
    if (!checkRef.current) return null;
    const canvas = await html2canvas(checkRef.current, { 
        scale: 4, 
        useCORS: true, 
        backgroundColor: '#ffffff',
        allowTaint: true
    });
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

  if (isLoadingCheck) {
      return (
          <div className="h-full bg-slate-950 flex flex-col items-center justify-center gap-4">
              <Loader2 className="animate-spin text-indigo-500" size={40}/>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Decrypting Check...</p>
          </div>
      );
  }

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      {!isReadOnly && (
        <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-20">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"><ArrowLeft size={20} /></button>
                <h1 className="text-lg font-bold text-white flex items-center gap-2"><Wallet className="text-amber-400" /> Neural Check Designer</h1>
            </div>
            <div className="flex items-center gap-3">
                <button onClick={handlePublishAndShareLink} disabled={isSharing} className={`flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-lg transition-all`}>
                    {isSharing ? <Loader2 size={14} className="animate-spin"/> : <Share2 size={14}/>}
                    <span>{isSharing ? 'Processing...' : (shareLink ? 'Share URI' : (check.isCoinCheck ? 'Issue Coin Check' : 'Publish & Share URI'))}</span>
                </button>
                <button onClick={handleDownloadPDF} disabled={isExporting} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold border border-slate-700 hidden sm:flex">
                    {isExporting ? <Loader2 size={14} className="animate-spin"/> : <Download size={14} />}
                    <span>Download PDF</span>
                </button>
            </div>
        </header>
      )}

      <div className="flex-1 flex overflow-hidden flex-col lg:flex-row">
          {!isReadOnly && (
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
                                    <input type="number" value={check.isCoinCheck ? check.coinAmount : check.amount} onChange={e => setCheck(check.isCoinCheck ? {...check, coinAmount: parseInt(e.target.value) || 0} : {...check, amount: parseFloat(e.target.value) || 0})} className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-2.5 py-2.5 text-sm text-white text-right"/>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="text-[9px] font-bold text-slate-600 uppercase mb-1 block">Memo / Purpose</label>
                            <input type="text" placeholder="For: Web Development Services..." value={check.memo} onChange={e => setCheck({...check, memo: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none focus:border-indigo-500"/>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setShowSignPad(true)} className="flex-1 py-3 bg-slate-800 text-xs font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-2 hover:bg-slate-700 transition-colors"><PenTool size={16}/> Sign</button>
                            <button onClick={handleGenerateArt} disabled={isGeneratingArt} className="flex-1 py-3 bg-slate-800 text-xs font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-2 hover:bg-slate-700 transition-colors">{isGeneratingArt ? <Loader2 size={16} className="animate-spin"/> : <ImageIcon size={16}/>} Add Watermark</button>
                        </div>
                    </div>
                </div>
            </div>
          )}

          <div className={`flex-1 bg-slate-950 flex flex-col p-4 sm:p-12 items-center overflow-y-auto scrollbar-hide relative min-h-0 ${isReadOnly ? 'justify-center h-full' : ''}`}>
              {isReadOnly && (
                  <div className="absolute top-6 left-6 z-20 flex items-center gap-4">
                      <button onClick={onBack} className="p-3 bg-slate-900 border border-slate-800 rounded-full text-white shadow-2xl"><ArrowLeft size={24}/></button>
                      <div>
                        <h2 className="text-xl font-bold">Neural Check</h2>
                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Verified Transaction Ledger</p>
                      </div>
                  </div>
              )}

              {/* Wrapper to maintain scaled height on mobile with safety padding */}
              <div style={{ height: `${280 * zoom}px`, width: `${610 * zoom}px` }} className="flex-shrink-0 transition-all duration-300 p-2">
                  <div 
                    ref={checkRef}
                    style={{ 
                        transform: `scale(${zoom})`, 
                        transformOrigin: 'top left',
                        willChange: 'transform'
                    }}
                    className={`w-[600px] h-[270px] bg-white text-black shadow-[0_0_80px_rgba(0,0,0,0.5)] flex flex-col border ${check.isCoinCheck ? 'border-amber-400 ring-4 ring-amber-400/20' : 'border-slate-300'} relative shrink-0 p-8 rounded-sm overflow-hidden`}
                  >
                      {/* SCANNABLE QR CODE - TOP CENTERED HIGH CONTRAST */}
                      <div className="absolute top-1 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
                          <img src={qrCodeUrl} className="w-20 h-20 border-2 border-white p-0.5 rounded shadow-2xl bg-white" />
                      </div>

                      {/* WATERMARK - MATCHES CHECK DIMENSIONS (600x270) with crossOrigin for cloud sync */}
                      <div className="absolute inset-0 opacity-[0.20] pointer-events-none z-0">
                          {check.watermarkUrl ? (
                              <img src={check.watermarkUrl} className="w-full h-full object-cover grayscale" crossOrigin="anonymous" />
                          ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                  <Landmark size={200} className="text-slate-400 opacity-20"/>
                              </div>
                          )}
                      </div>

                      {/* Header row - Pulled UP further */}
                      <div className="flex justify-between items-start mb-0.5 relative z-10">
                          <div className="flex flex-col">
                              <div className="font-black uppercase text-[9px] leading-tight">{check.senderName}</div>
                              <div className="text-[7px] text-slate-600 max-w-[150px] leading-tight whitespace-pre-wrap">{check.senderAddress}</div>
                          </div>
                          <div className="text-right">
                              <p className="text-sm font-black italic text-indigo-900 leading-none">{check.isCoinCheck ? 'VOICECOIN PROTOCOL' : check.bankName}</p>
                              <p className="text-[9px] font-bold mt-0.5">CHECK NO. {check.checkNumber}</p>
                          </div>
                      </div>

                      {/* Date and Amount box - Pulled UP */}
                      <div className="flex justify-end gap-6 items-center mb-2 relative z-10">
                          <div className="flex flex-col items-end">
                            <span className="text-[7px] font-bold text-slate-400 uppercase">Date</span>
                            <span className="text-xs font-bold border-b border-black min-w-[80px] text-center">{check.date}</span>
                          </div>
                          <div className="bg-slate-50 border border-slate-300 px-4 py-2 font-black text-xl shadow-inner min-w-[120px] text-right">
                            {check.isCoinCheck ? `VC ${check.coinAmount || 0}` : `$ ${(check.amount || 0).toFixed(2)}`}
                          </div>
                      </div>

                      {/* Payee line - MOVED ONE LINE UPPER */}
                      <div className="flex items-center gap-4 relative z-10 mb-0.5">
                          <div className="flex-1 flex flex-col">
                              <span className="text-[7px] font-bold text-slate-400 uppercase leading-none mb-1">Pay to the Order of</span>
                              <div className="border-b border-black text-base font-black italic h-7 flex items-center">{check.payee}</div>
                          </div>
                      </div>

                      {/* Amount Words line - MOVED ONE LINE UPPER */}
                      <div className="flex flex-col relative z-10 mb-1">
                          <div className="border-b border-black text-[11px] font-bold h-6 flex items-center">
                            {check.amountWords}
                            <span className="ml-auto text-[7px] text-slate-400 uppercase font-black">{check.isCoinCheck ? 'COINS' : 'DOLLARS'}</span>
                          </div>
                      </div>

                      {/* Memo line - Pinned above MICR */}
                      <div className="absolute bottom-16 left-8 z-10">
                          <div className="w-[220px] flex flex-col">
                              <span className="text-[7px] font-bold text-slate-400 uppercase">Memo</span>
                              <div className="border-b border-black text-[11px] pb-0.5 font-medium truncate h-5 flex items-center">{check.memo}</div>
                          </div>
                      </div>

                      {/* Signature line - MOVED TO ABSOLUTE BOTTOM RIGHT CORNER (Above MICR) */}
                      <div className="absolute bottom-10 right-8 z-10">
                          <div className="w-[180px] flex flex-col items-center">
                              <div className="border-b border-black w-full text-center pb-0.5 h-10 flex items-end justify-center">
                                  {check.signatureUrl ? (
                                      <img src={check.signatureUrl} className="h-10 max-w-full object-contain" crossOrigin="anonymous" />
                                  ) : (
                                      <span className="text-xl font-script text-slate-400">{check.signature || check.senderName}</span>
                                  )}
                              </div>
                              <span className="text-[7px] font-bold text-slate-400 uppercase mt-0.5">Authorized Signature</span>
                          </div>
                      </div>

                      {/* MICR Line - FIXED TO BOTTOM LEFT CORNER */}
                      <div className="absolute bottom-4 left-8 pointer-events-none z-20">
                          <div className="font-mono text-sm tracking-[0.25em] text-slate-900 flex items-center gap-6">
                              <span>⑆ {check.routingNumber} ⑆</span>
                              <span>{check.accountNumber} ⑈</span>
                              <span>{check.checkNumber}</span>
                          </div>
                      </div>
                  </div>
              </div>

              {!isReadOnly && (
                  <div className="mt-12 mb-20 flex gap-4 shrink-0">
                      <button onClick={() => setZoom(prev => Math.max(0.1, prev - 0.1))} className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white"><ZoomOut size={16}/></button>
                      <button onClick={() => setZoom(1)} className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-bold text-slate-400">{Math.round(zoom * 100)}%</button>
                      <button onClick={() => setZoom(prev => Math.min(2, prev + 0.1))} className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white"><ZoomIn size={16}/></button>
                  </div>
              )}
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

      {showShareModal && shareLink && (
          <ShareModal 
            isOpen={true} onClose={() => setShowShareModal(false)} link={shareLink} title="Banking Check"
            onShare={async (uids, isPublic, permission) => {
                alert("Permission settings updated!");
            }}
            defaultPermission="read"
            currentUserUid={currentUser?.uid}
          />
      )}
    </div>
  );
};
