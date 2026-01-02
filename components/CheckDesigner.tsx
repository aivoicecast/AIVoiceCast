
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  ArrowLeft, Wallet, Save, Download, Sparkles, Loader2, User, Hash, QrCode, Mail, 
  Trash2, Printer, CheckCircle, AlertTriangle, Send, Share2, DollarSign, Calendar, 
  Landmark, Info, Search, Edit3, RefreshCw, ShieldAlert, X, ChevronRight, ImageIcon, Link, Coins, Check as CheckIcon, Palette, Copy, ZoomIn, ZoomOut, Maximize2
} from 'lucide-react';
import { BankingCheck, UserProfile } from '../types';
import { GoogleGenAI } from '@google/genai';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { getAllUsers, sendMessage, uploadFileToStorage, saveBankingCheck, claimCoinCheck } from '../services/firestoreService';
import { auth } from '../services/firebaseConfig';
import { getDriveToken, connectGoogleDrive } from '../services/authService';
import { ensureCodeStudioFolder, uploadToDrive } from '../services/googleDriveService';

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
  senderAddress: '123 AI Boulevard, Silicon Valley, CA',
  signature: '',
  isCoinCheck: false,
  coinAmount: 0
};

export const CheckDesigner: React.FC<CheckDesignerProps> = ({ onBack, currentUser }) => {
  const [check, setCheck] = useState<BankingCheck>({
      ...DEFAULT_CHECK,
      senderName: currentUser?.displayName || DEFAULT_CHECK.senderName
  });
  
  const [isParsing, setIsParsing] = useState(false);
  const [isUpdatingWords, setIsUpdatingWords] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isGeneratingArt, setIsGeneratingArt] = useState(false);
  const [customArtUrl, setCustomArtUrl] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  
  const checkRef = useRef<HTMLDivElement>(null);
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
      // For Coin Checks, the QR code encodes the check ID for claiming
      if (check.isCoinCheck && check.id) {
          return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin + '?claim=' + check.id)}`;
      }
      const data = `payee:${check.payee}|amount:${check.amount}|memo:${check.memo}|bank:${check.bankName}`;
      return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(data)}`;
  }, [check.payee, check.amount, check.memo, check.bankName, check.isCoinCheck, check.id]);

  const handleParseCheckDetails = async () => {
      const input = prompt("Paste raw payment instructions (e.g. 'Pay Alice 500 dollars for consulting work next week'):");
      if (!input) return;

      setIsParsing(true);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const prompt = `Parse the following payment instructions into a JSON object for a banking check.
          Fields: payee, amount (number), amountWords (text), memo, date (YYYY-MM-DD).
          Current Date: ${new Date().toISOString().split('T')[0]}
          
          Input: "${input}"
          
          Return ONLY valid JSON.`;

          const response = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: prompt,
              config: { responseMimeType: 'application/json' }
          });

          const parsed = JSON.parse(response.text || '{}');
          setCheck(prev => ({ ...prev, ...parsed }));
          
      } catch (e) {
          alert("Neural parse failed. Please enter details manually.");
      } finally {
          setIsParsing(null);
      }
  };

  const handleGenerateArt = async () => {
      if (!check.memo) {
          alert("Please enter a memo (For) first to generate relevant art.");
          return;
      }
      setIsGeneratingArt(true);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const artPrompt = `A professional, high-end artistic watermark/illustration for a banking check. 
          Topic: "${check.memo}". 
          Style: Minimalist line art, subtle etching style, monochromatic charcoal or deep indigo. 
          The design should be centered, sophisticated, and suitable for a secure financial document. No text. 4k resolution.`;

          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash-image',
              contents: { parts: [{ text: artPrompt }] },
          });

          for (const part of response.candidates[0].content.parts) {
              if (part.inlineData) {
                  const base64Data = part.inlineData.data;
                  setCustomArtUrl(`data:image/png;base64,${base64Data}`);
                  break;
              }
          }
      } catch (e) {
          console.error(e);
          alert("Art generation failed.");
      } finally {
          setIsGeneratingArt(false);
      }
  };

  const handleGenerateAmountWords = async (val: number, isCoins = false) => {
      setIsUpdatingWords(true);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const prompt = `Convert the numeric amount ${val} into formal banking check words (e.g., "Five Hundred and 00/100"). 
          The unit is ${isCoins ? 'Coins' : 'Dollars'}. Return ONLY the text, nothing else.`;
          const response = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: prompt
          });
          const text = response.text?.trim() || '';
          if (text) {
            setCheck(prev => ({ ...prev, amountWords: text }));
          }
      } catch (e) {
          console.error("Auto-word generation failed", e);
      } finally {
          setIsUpdatingWords(false);
      }
  };

  const handlePublishAndShareLink = async () => {
      if (!auth.currentUser) return alert("Please sign in to publish.");
      setIsSharing(true);
      try {
          const id = check.id || crypto.randomUUID();
          
          // 1. Sync watermark if exists
          let finalWatermarkUrl = customArtUrl || '';
          if (customArtUrl?.startsWith('data:')) {
             const res = await fetch(customArtUrl);
             const blob = await res.blob();
             finalWatermarkUrl = await uploadFileToStorage(`checks/${id}/watermark.png`, blob);
          }

          // 2. Save metadata to Firestore
          const finalId = await saveBankingCheck({
              ...check,
              id,
              ownerId: auth.currentUser.uid,
              watermarkUrl: finalWatermarkUrl
          });

          // 3. Export PDF and Save to Drive
          const blob = await generatePDFBlob();
          if (blob) {
              const token = getDriveToken() || await connectGoogleDrive();
              if (token) {
                  const folderId = await ensureCodeStudioFolder(token);
                  await uploadToDrive(token, folderId, `Check_${check.checkNumber}_${check.payee.replace(/\s/g, '_')}.pdf`, blob);
              }
          }

          // Use ?claim param for Coin Checks so recipient can redeem instantly
          const link = check.isCoinCheck 
            ? `${window.location.origin}?claim=${finalId}` 
            : `${window.location.origin}?view=check&id=${finalId}`;
            
          setShareLink(link);
          setCheck(prev => ({ ...prev, id: finalId }));
          alert(check.isCoinCheck ? "Coin Check Issued! Copy the claim link to send to another member." : "Check published and shared!");
      } catch (e: any) {
          alert("Publishing failed: " + e.message);
      } finally {
          setIsSharing(false);
      }
  };

  const generatePDFBlob = async (): Promise<Blob | null> => {
    if (!checkRef.current) return null;
    try {
        const canvas = await html2canvas(checkRef.current, {
            scale: 4,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false
        });
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'px',
            format: [600, 270] 
        });
        pdf.addImage(imgData, 'JPEG', 0, 0, 600, 270);
        return pdf.output('blob');
    } catch (e) {
        return null;
    }
  };

  const handleDownloadPDF = async () => {
      setIsExporting(true);
      const blob = await generatePDFBlob();
      if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `check_${check.checkNumber}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
      } else {
          alert("Export failed.");
      }
      setIsExporting(false);
  };

  const handleZoom = (delta: number) => {
      setZoom(prev => Math.min(2.5, Math.max(0.5, prev + delta)));
  };

  const resetZoom = () => setZoom(1);

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-20">
          <div className="flex items-center gap-4">
              <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                  <ArrowLeft size={20} />
              </button>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                  <Wallet className="text-amber-400" />
                  Neural Check Designer
              </h1>
          </div>
          <div className="flex items-center gap-3">
              <button onClick={handlePublishAndShareLink} disabled={isSharing} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-lg transition-all">
                  {isSharing ? <Loader2 size={14} className="animate-spin"/> : <Share2 size={14}/>}
                  <span>{isSharing ? 'Processing...' : (check.isCoinCheck ? 'Issue Coin Check' : 'Publish & Share')}</span>
              </button>
              <button 
                onClick={handleDownloadPDF}
                disabled={isExporting}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold border border-slate-700 transition-all active:scale-95"
              >
                  {isExporting ? <Loader2 size={14} className="animate-spin"/> : <Download size={14} />}
                  <span>Download PDF</span>
              </button>
          </div>
      </header>

      <div className="flex-1 flex overflow-hidden flex-col lg:flex-row">
          <div className="w-full lg:w-[450px] border-r border-slate-800 bg-slate-900/30 flex flex-col shrink-0 overflow-y-auto p-6 space-y-8 scrollbar-thin">
              
              <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <Palette className="text-indigo-400"/> Transaction Type
                  </h3>
                  <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                      <button 
                        onClick={() => setCheck({...check, isCoinCheck: false})}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${!check.isCoinCheck ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                      >
                          <Landmark size={14}/> Standard
                      </button>
                      <button 
                        onClick={() => setCheck({...check, isCoinCheck: true})}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${check.isCoinCheck ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                      >
                          <Coins size={14}/> Voice Coin
                      </button>
                  </div>
              </div>

              <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Sparkles size={14} className="text-indigo-400"/> AI Autocomplete
                    </h3>
                  </div>
                  <button 
                    onClick={handleParseCheckDetails}
                    disabled={isParsing}
                    className="w-full py-3 bg-indigo-900/20 hover:bg-indigo-900/40 border border-indigo-500/30 text-indigo-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all"
                  >
                      {isParsing ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>}
                      Paste Payment Context
                  </button>
              </div>

              <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Account & Bank</h3>
                  <div className="grid grid-cols-1 gap-3">
                      <input type="text" placeholder="Your Name" value={check.senderName} onChange={e => setCheck({...check, senderName: e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none focus:border-indigo-500"/>
                      <input type="text" placeholder="Bank Name" value={check.bankName} onChange={e => setCheck({...check, bankName: e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none focus:border-indigo-500"/>
                      <div className="grid grid-cols-2 gap-3">
                          <input type="text" placeholder="Routing #" value={check.routingNumber} onChange={e => setCheck({...check, routingNumber: e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none focus:border-indigo-500 font-mono"/>
                          <input type="text" placeholder="Account #" value={check.accountNumber} onChange={e => setCheck({...check, accountNumber: e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none focus:border-indigo-500 font-mono"/>
                      </div>
                  </div>
              </div>

              <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Payment Details</h3>
                  <div className="grid grid-cols-1 gap-3">
                      <div className="flex gap-2">
                        <input type="text" placeholder="Pay to the order of..." value={check.payee} onChange={e => setCheck({...check, payee: e.target.value})} className="flex-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none focus:border-indigo-500"/>
                        <div className="relative w-32">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                                {check.isCoinCheck ? <Coins size={14} className="text-amber-500"/> : '$'}
                            </span>
                            {check.isCoinCheck ? (
                                <input type="number" placeholder="0" value={check.coinAmount} onChange={e => setCheck({...check, coinAmount: parseInt(e.target.value) || 0})} className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-2.5 py-2.5 text-sm text-white outline-none focus:border-amber-500 text-right"/>
                            ) : (
                                <input type="number" placeholder="0.00" value={check.amount} onChange={e => setCheck({...check, amount: parseFloat(e.target.value) || 0})} className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-6 pr-2.5 py-2.5 text-sm text-white outline-none focus:border-indigo-500 text-right"/>
                            )}
                        </div>
                      </div>
                      <div className="relative group">
                        <textarea 
                            placeholder="Amount in words..." 
                            value={check.amountWords} 
                            onChange={e => setCheck({...check, amountWords: e.target.value})} 
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 pr-10 text-sm text-white outline-none focus:border-indigo-500 resize-none h-20"
                        />
                        <div className="absolute right-2 bottom-2 p-1.5 pointer-events-none">
                            {isUpdatingWords ? (
                                <Loader2 size={14} className="animate-spin text-indigo-400"/>
                            ) : (
                                <CheckCircle size={14} className="text-emerald-500 opacity-50"/>
                            )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <input type="date" value={check.date} onChange={e => setCheck({...check, date: e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none focus:border-indigo-500"/>
                        <input type="text" placeholder="Check #" value={check.checkNumber} onChange={e => setCheck({...check, checkNumber: e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none focus:border-indigo-500 font-mono"/>
                      </div>
                      <div className="relative">
                        <input type="text" placeholder="Memo (For)" value={check.memo} onChange={e => setCheck({...check, memo: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 pr-10 text-sm text-white outline-none focus:border-indigo-500"/>
                        <button 
                            onClick={handleGenerateArt}
                            disabled={isGeneratingArt}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-indigo-400 hover:text-white transition-all"
                            title="Generate custom watermark art based on memo"
                        >
                            {isGeneratingArt ? <Loader2 size={14} className="animate-spin"/> : <ImageIcon size={14}/>}
                        </button>
                      </div>
                      <input type="text" placeholder="Signature (Type your name)" value={check.signature} onChange={e => setCheck({...check, signature: e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none focus:border-indigo-500 italic"/>
                  </div>
              </div>
          </div>

          <div className="flex-1 bg-slate-950 flex flex-col p-12 items-center overflow-y-auto scrollbar-hide relative">
              {shareLink && (
                  <div className="mb-6 w-full max-w-md bg-slate-900 border border-indigo-500/50 rounded-2xl p-4 animate-fade-in flex items-center justify-between gap-4 shadow-xl z-20">
                      <div className="overflow-hidden">
                          <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">{check.isCoinCheck ? 'Claim Link (Send to Recipient)' : 'Shareable View Link'}</p>
                          <p className="text-xs text-slate-400 truncate font-mono">{shareLink}</p>
                      </div>
                      <button onClick={() => { navigator.clipboard.writeText(shareLink!); alert("Copied!"); }} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors">
                          <Copy size={16}/>
                      </button>
                  </div>
              )}

              <div className="sticky top-0 mb-8 flex items-center gap-6 bg-slate-900/80 backdrop-blur-xl px-6 py-2 rounded-full border border-slate-800 shadow-2xl z-20 select-none">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Printer size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">{check.isCoinCheck ? 'Digital Coin Disbursement' : 'High-Security Document Preview'}</span>
                  </div>
                  
                  <div className="h-4 w-px bg-slate-700"></div>
                  
                  <div className="flex items-center gap-1">
                      <button onClick={() => handleZoom(-0.25)} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors" title="Zoom Out"><ZoomOut size={16}/></button>
                      <button onClick={resetZoom} className="px-2 py-0.5 hover:bg-slate-800 rounded text-[10px] font-mono text-indigo-400 font-bold" title="Reset Zoom">{Math.round(zoom * 100)}%</button>
                      <button onClick={() => handleZoom(0.25)} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors" title="Zoom In"><ZoomIn size={16}/></button>
                  </div>
              </div>

              {/* Check Scaling Wrapper */}
              <div 
                className="flex items-center justify-center transition-transform duration-300 ease-out origin-top"
                style={{ 
                    transform: `scale(${zoom})`,
                    marginBottom: `${(zoom - 1) * 270}px`, // Compensate for scaled height to allow proper scrolling
                    marginTop: '20px'
                }}
              >
                  <div 
                    ref={checkRef}
                    className={`w-[600px] h-[270px] bg-white text-black shadow-2xl flex flex-col border ${check.isCoinCheck ? 'border-amber-400 ring-2 ring-amber-400/20' : 'border-slate-300'} relative shrink-0 overflow-hidden font-sans p-6 rounded-sm`}
                    style={{
                        backgroundImage: `radial-gradient(circle at 2px 2px, rgba(0,0,0,0.02) 1px, transparent 0)`,
                        backgroundSize: '8px 8px'
                    }}
                  >
                      <div className="absolute inset-0 flex items-center justify-center opacity-[0.06] pointer-events-none select-none overflow-hidden">
                          {customArtUrl ? (
                              <img src={customArtUrl} className="w-[350px] h-[350px] object-contain grayscale scale-125" alt="watermark" />
                          ) : check.isCoinCheck ? (
                              <Coins size={200} className="text-amber-500" />
                          ) : (
                              <Landmark size={200} />
                          )}
                      </div>

                      <div className="flex justify-between items-start mb-4">
                          <div className="space-y-0.5">
                              <p className="text-xs font-black uppercase tracking-tight leading-none">{check.senderName}</p>
                              <p className="text-[8px] text-slate-500 max-w-[150px] leading-tight">{check.senderAddress}</p>
                          </div>
                          <div className="text-right">
                              <p className={`text-sm font-black italic ${check.isCoinCheck ? 'text-amber-600' : 'text-indigo-900'}`}>{check.isCoinCheck ? 'VoiceCoin Protocol' : check.bankName}</p>
                              <p className="text-[10px] font-bold mt-1">{check.checkNumber}</p>
                          </div>
                      </div>

                      <div className="flex justify-end gap-12 mb-2 items-center">
                          <div className="flex items-center gap-2 border-b border-black pb-1 min-w-[120px]">
                              <span className="text-[8px] font-bold uppercase">Date</span>
                              <span className="text-xs font-medium">{check.date}</span>
                          </div>
                          <div className={`bg-slate-50 border px-3 py-1 flex items-center gap-2 min-w-[120px] shadow-inner ${check.isCoinCheck ? 'border-amber-300' : 'border-slate-300'}`}>
                              <span className="text-sm font-bold">{check.isCoinCheck ? 'VC' : '$'}</span>
                              <span className="text-lg font-black tracking-tight">{check.isCoinCheck ? check.coinAmount : check.amount.toFixed(2)}</span>
                          </div>
                      </div>

                      <div className="flex items-end gap-3 mb-2 border-b border-black pb-1">
                          <span className="text-[8px] font-bold uppercase whitespace-nowrap mb-1">Pay to the order of</span>
                          <span className="flex-1 text-sm font-black italic px-2">{check.payee}</span>
                      </div>

                      <div className="flex items-end gap-3 mb-4 border-b border-black pb-1 relative">
                          <span className="flex-1 text-xs font-bold italic px-2">{check.amountWords}</span>
                          <span className="text-[8px] font-bold uppercase absolute right-0 bottom-1">{check.isCoinCheck ? 'Coins' : 'Dollars'}</span>
                      </div>

                      <div className="flex items-end justify-between mt-auto mb-14">
                          <div className="flex flex-col gap-1 w-1/3">
                              <div className="flex items-end gap-2 border-b border-black pb-1">
                                  <span className="text-[8px] font-bold uppercase mb-1">For</span>
                                  <span className="text-xs font-medium px-2 truncate">{check.memo}</span>
                              </div>
                          </div>
                          
                          <div className="flex flex-col items-center">
                              <img src={qrCodeUrl} className={`w-12 h-12 border p-0.5 rounded shadow-sm ${check.isCoinCheck ? 'border-amber-400 bg-amber-50' : 'border-slate-100 bg-white'}`} alt="QR Code" crossOrigin="anonymous"/>
                              <span className="text-[6px] font-black uppercase text-slate-400 mt-1">{check.isCoinCheck ? 'Scan to Claim Coins' : 'Scan for Digital Pay'}</span>
                          </div>

                          <div className="flex flex-col items-center w-1/3">
                              <div className="min-w-[160px] border-b border-black text-center pb-1">
                                  <span className="text-xl font-script italic leading-none">{check.signature || check.senderName}</span>
                              </div>
                              <span className="text-[8px] font-bold uppercase mt-1">Authorized Signature</span>
                          </div>
                      </div>

                      <div className="absolute bottom-2 left-0 w-full flex justify-center gap-12 font-mono text-sm tracking-[0.2em] opacity-80 select-none bg-white/50 py-1">
                          <span>⑆ {check.routingNumber} ⑆</span>
                          <span>{check.accountNumber} ⑈</span>
                          <span>{check.checkNumber}</span>
                      </div>
                      
                      <div className={`absolute top-0 left-0 w-full h-1 ${check.isCoinCheck ? 'bg-gradient-to-r from-amber-500/30 via-transparent to-amber-500/30' : 'bg-gradient-to-r from-indigo-500/20 via-transparent to-indigo-500/20'}`}></div>
                      <div className={`absolute bottom-0 left-0 w-full h-1 ${check.isCoinCheck ? 'bg-gradient-to-r from-amber-500/30 via-transparent to-amber-500/30' : 'bg-gradient-to-r from-indigo-500/20 via-transparent to-indigo-500/20'}`}></div>
                  </div>
              </div>

              <div className="mt-12 w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex items-start gap-4">
                      <div className="p-2 bg-emerald-900/20 rounded-lg text-emerald-400"><QrCode size={20}/></div>
                      <div>
                          <h4 className="text-sm font-bold text-white mb-1">{check.isCoinCheck ? 'One-Time Claim' : 'Digital Scan Support'}</h4>
                          <p className="text-xs text-slate-500 leading-relaxed">{check.isCoinCheck ? 'Scanning the QR code on a Coin Check instantly transfers the coins to the recipient\'s wallet and invalidates the check.' : 'Integrated QR code encodes payment details for fast mobile banking imports and ledger synchronization.'}</p>
                      </div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex items-start gap-4">
                      <div className="p-2 bg-amber-900/20 rounded-lg text-amber-400"><ShieldAlert size={20}/></div>
                      <div>
                          <h4 className="text-sm font-bold text-white mb-1">Coin Protocol</h4>
                          <p className="text-xs text-slate-500 leading-relaxed">VoiceCoins are the native currency of AIVoiceCast, equal to 1 cent USD. Use them for tipping, mentoring, and issuing digital vouchers.</p>
                      </div>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};
