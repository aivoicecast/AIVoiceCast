
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

    const amountToSpell = check.isCoinCheck ? (check.coinAmount) : (check.amount);
    
    if (amountToSpell !== undefined && amountToSpell !== null && !isNaN(amountToSpell as number) && (amountToSpell as number) > 0) {
        debounceTimerRef.current = setTimeout(() => {
            handleGenerateAmountWords(amountToSpell as number, check.isCoinCheck);
        }, 1200); 
    } else {
        setCheck(prev => ({ ...prev, amountWords: '' }));
    }

    return () => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); };
  }, [check.amount, check.coinAmount, check.isCoinCheck, isReadOnly]);

  const qrCodeUrl = useMemo(() => {
      const baseUri = shareLink || `${window.location.origin}?view=check_viewer&id=${check.id || 'preview'}`;
      return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&color=0-0-0&bgcolor=255-255-255&data=${encodeURIComponent(baseUri)}`;
  }, [shareLink, check.id]);

  const isLocalUrl = (url?: string) => url?.startsWith('data:') || url?.startsWith('blob:');

  const handleParseCheckDetails = async () => {
      const input = prompt("Paste raw payment instructions:");
      if (!input) return;
      setIsParsing(true);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const response = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: `Parse into JSON for a banking check. Include fields: payee, amount, memo, routingNumber, accountNumber, senderName, senderAddress. Input: "${input}"`,
              config: { responseMimeType: 'application/json' }
          });
          const parsed = JSON.parse(response.text || '{}');
          setCheck(prev => ({ ...prev, ...parsed }));
      } catch (e) { alert("Neural parse failed."); } finally { setIsParsing(false); }
  };

  const handleGenerateArt = async () => {
      if (!check.memo) return alert("Enter a memo first to define the watermark style.");
      setIsGeneratingArt(true);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash-image',
              contents: { parts: [{ text: `A professional high-contrast watermark etching for a bank check background. Subject: ${check.memo}. Wide aspect ratio, minimalist, grayscale, line art style.` }] },
              config: { imageConfig: { aspectRatio: "16:9" } }
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
              ...check, 
              id, 
              ownerId: auth.currentUser.uid,
              watermarkUrl: finalWatermarkUrl, 
              signatureUrl: finalSignatureUrl,
              amount: (check.amount === undefined || check.amount === null) ? 0 : check.amount
          };
          
          await saveBankingCheck(checkToSave as any);
          const link = `${window.location.origin}?view=check_viewer&id=${id}`;
          setShareLink(link);
          setShowShareModal(true);
      } catch (e: any) {
          alert("Publish failed: " + e.message);
      } finally {
          setIsSharing(false);
      }
  };

  const handleDownloadPDF = async () => {
    if (!checkRef.current) return;
    setIsExporting(true);
    try {
        const canvas = await html2canvas(checkRef.current, { 
            scale: 4, 
            useCORS: true, 
            backgroundColor: '#ffffff'
        });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('l', 'px', [600, 270]);
        pdf.addImage(imgData, 'PNG', 0, 0, 600, 270);
        pdf.save(`check_${check.checkNumber}.pdf`);
    } catch (e) {
        alert("PDF export failed.");
    } finally {
        setIsExporting(false);
    }
  };

  if (isLoadingCheck) {
      return (
          <div className="h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
              <Loader2 className="animate-spin text-indigo-500" size={40} />
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Retrieving Check...</p>
          </div>
      );
  }

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-20">
          <div className="flex items-center gap-4">
              <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"><ArrowLeft size={20} /></button>
              <h1 className="text-lg font-bold text-white flex items-center gap-2"><Wallet className="text-indigo-400" /> Neural Check Lab</h1>
          </div>
          <div className="flex items-center gap-3">
              {!isReadOnly && (
                <>
                  <button onClick={handleParseCheckDetails} disabled={isParsing} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-indigo-400 rounded-lg text-xs font-bold border border-slate-700 hover:bg-slate-700 transition-all">
                      {isParsing ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>}
                      <span>Neural Parse</span>
                  </button>
                  <button onClick={handlePublishAndShareLink} disabled={isSharing} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-lg transition-all">
                      {isSharing ? <Loader2 size={14} className="animate-spin"/> : <Share2 size={14}/>}
                      <span>{shareLink ? 'Share URI' : 'Publish & Share'}</span>
                  </button>
                </>
              )}
              <button onClick={handleDownloadPDF} disabled={isExporting} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold border border-slate-700 hover:bg-slate-700 transition-all">
                  {isExporting ? <Loader2 size={14} className="animate-spin"/> : <Download size={14}/>}
                  <span>Download PDF</span>
              </button>
          </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {!isReadOnly && (
            <div className="w-full lg:w-[400px] border-r border-slate-800 bg-slate-900/30 flex flex-col shrink-0 overflow-y-auto p-6 space-y-6 scrollbar-thin">
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Palette className="text-indigo-400"/> Transaction Type</h3>
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
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><User size={14} className="text-indigo-400"/> Payee Info</h3>
                    <input type="text" placeholder="Payee Name" value={check.payee} onChange={e => setCheck({...check, payee: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/50"/>
                    <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16}/>
                        <input type="number" placeholder="0.00" value={check.isCoinCheck ? (check.coinAmount || '') : (check.amount || '')} onChange={e => setCheck(check.isCoinCheck ? {...check, coinAmount: parseFloat(e.target.value) || 0} : {...check, amount: parseFloat(e.target.value) || 0})} className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/50"/>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Edit3 size={14} className="text-indigo-400"/> Check Details</h3>
                    <input type="text" placeholder="Memo" value={check.memo} onChange={e => setCheck({...check, memo: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/50"/>
                    <div className="flex gap-2">
                        <input type="text" placeholder="Check #" value={check.checkNumber} onChange={e => setCheck({...check, checkNumber: e.target.value})} className="flex-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/50"/>
                        <input type="date" value={check.date} onChange={e => setCheck({...check, date: e.target.value})} className="flex-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/50"/>
                    </div>
                </div>

                <div className="space-y-3">
                    <button onClick={handleGenerateArt} disabled={isGeneratingArt} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-xl font-bold text-sm border border-slate-700 flex items-center justify-center gap-2 transition-all">
                        {isGeneratingArt ? <Loader2 size={16} className="animate-spin"/> : <Palette size={16}/>}
                        Generate AI Watermark
                    </button>
                    
                    <button onClick={() => setShowSignPad(true)} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm border border-slate-700 flex items-center justify-center gap-2 transition-all">
                        <PenTool size={16}/>
                        Drawn Signature
                    </button>
                </div>
            </div>
          )}

          <div className="flex-1 bg-slate-950 flex flex-col p-8 items-center justify-center overflow-auto relative">
              <div 
                style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
                className="transition-transform duration-300"
              >
                  <div ref={checkRef} className="w-[600px] h-[270px] bg-white text-black shadow-2xl flex flex-col border border-slate-300 rounded-lg relative overflow-hidden p-8">
                      {/* WATERMARK LAYER - Absolute Background */}
                      {check.watermarkUrl && (
                          <div className="absolute inset-0 opacity-[0.15] pointer-events-none z-0">
                              <img 
                                src={check.watermarkUrl} 
                                className="w-full h-full object-cover grayscale" 
                                crossOrigin={isLocalUrl(check.watermarkUrl) ? undefined : "anonymous"}
                                referrerPolicy="no-referrer"
                                alt="" 
                              />
                          </div>
                      )}

                      {/* QR CODE - ABSOLUTELY POSITIONED TOP CENTER (Does not shift flow) */}
                      <div className="absolute top-1 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
                          <img src={qrCodeUrl} className="w-16 h-16 border border-white p-0.5 rounded shadow-lg bg-white" />
                      </div>
                      
                      {/* CONTENT FLOW STARTS HERE */}
                      <div className="flex justify-between items-start relative z-10">
                          <div className="space-y-1">
                              <h2 className="text-sm font-bold uppercase tracking-wider">{check.senderName}</h2>
                              <p className="text-[9px] text-slate-500 leading-tight max-w-[180px] truncate">{check.senderAddress}</p>
                          </div>
                          <div className="text-right">
                              <p className="text-lg font-mono font-bold">{check.checkNumber}</p>
                          </div>
                      </div>

                      <div className="flex justify-end mt-2 relative z-10">
                          <div className="border-b border-black w-32 flex justify-between items-end pb-1">
                              <span className="text-[9px] font-bold">DATE</span>
                              <span className="text-sm font-mono">{check.date}</span>
                          </div>
                      </div>

                      <div className="mt-4 flex items-center gap-4 relative z-10">
                          <span className="text-xs font-bold whitespace-nowrap">PAY TO THE ORDER OF</span>
                          <div className="flex-1 border-b border-black text-lg font-serif italic px-2">{check.payee || '____________________'}</div>
                          <div className="w-32 border-2 border-black p-1 flex items-center bg-slate-50/50">
                              <span className="text-sm font-bold">$</span>
                              <span className="flex-1 text-right font-mono text-lg font-bold">
                                {check.isCoinCheck ? (check.coinAmount || 0).toFixed(2) : (check.amount || 0).toFixed(2)}
                              </span>
                          </div>
                      </div>

                      <div className="mt-4 flex items-center gap-4 relative z-10">
                          <div className="flex-1 border-b border-black text-sm font-serif italic px-2">{check.amountWords || '____________________________________________________________________'}</div>
                          <span className="text-xs font-bold">{check.isCoinCheck ? 'COINS' : 'DOLLARS'}</span>
                      </div>

                      <div className="mt-4 relative z-10">
                          <p className="text-xs font-bold">{check.isCoinCheck ? 'VOICECOIN LEDGER' : check.bankName}</p>
                      </div>

                      <div className="mt-6 flex items-end justify-between relative z-10">
                          <div className="flex-1 flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold">FOR</span>
                                  <div className="w-48 border-b border-black text-sm font-serif italic px-1 truncate">{check.memo || '____________________'}</div>
                              </div>
                              {/* MICR LINE - POSITIONED RELATIVE TO BOTTOM OF CONTAINER */}
                              <div className="mt-2 font-mono text-xl tracking-widest text-slate-800">
                                  ⑆ {check.routingNumber} ⑈ {check.accountNumber} ⑈ {check.checkNumber}
                              </div>
                          </div>
                          
                          <div className="w-48 relative">
                              <div className="border-b border-black h-12 flex items-end justify-center pb-1 overflow-hidden">
                                  {check.signatureUrl ? (
                                      <img 
                                        src={check.signatureUrl} 
                                        className="max-h-12 w-auto object-contain" 
                                        crossOrigin={isLocalUrl(check.signatureUrl) ? undefined : "anonymous"}
                                        referrerPolicy="no-referrer"
                                        alt="Signature" 
                                      />
                                  ) : (
                                      <span className="text-slate-200 font-serif text-sm">SIGN HERE</span>
                                  )}
                              </div>
                              <span className="text-[8px] font-bold text-center block mt-1 uppercase tracking-tighter">Authorized Signature</span>
                          </div>
                      </div>
                  </div>
              </div>

              {!isReadOnly && (
                  <div className="mt-12 flex gap-4 shrink-0">
                      <button onClick={() => setZoom(prev => Math.max(0.5, prev - 0.1))} className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white"><ZoomOut size={16}/></button>
                      <button onClick={() => setZoom(1)} className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-bold text-slate-400">{Math.round(zoom * 100)}%</button>
                      <button onClick={() => setZoom(prev => Math.min(2, prev + 0.1))} className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white"><ZoomIn size={16}/></button>
                  </div>
              )}
          </div>
      </div>

      {showSignPad && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
              <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl p-6 shadow-2xl animate-fade-in-up">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2"><PenTool size={20} className="text-indigo-400"/> Authorized Signature</h3>
                      <button onClick={() => setShowSignPad(false)} className="p-2 text-slate-500 hover:text-white"><X/></button>
                  </div>
                  <div className="h-[300px] border-2 border-dashed border-slate-800 rounded-2xl overflow-hidden mb-6 bg-white">
                      <Whiteboard 
                        disableAI 
                        backgroundColor="transparent" 
                        initialColor="#000000"
                        onDataChange={() => {}}
                        onSessionStart={() => {}}
                      />
                  </div>
                  <div className="flex justify-between gap-4">
                      <p className="text-xs text-slate-500 max-w-sm italic">Draw your signature in the box above. For security, signatures are encrypted and stored with the document URI.</p>
                      <div className="flex gap-2">
                        <button onClick={() => setShowSignPad(false)} className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold">Cancel</button>
                        <button 
                            onClick={async () => {
                                const canvas = document.querySelector('.fixed canvas') as HTMLCanvasElement;
                                if (canvas) {
                                    const sigUrl = canvas.toDataURL('image/png');
                                    setCheck(prev => ({ ...prev, signatureUrl: sigUrl }));
                                }
                                setShowSignPad(false);
                            }} 
                            className="px-8 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-lg"
                        >
                            Confirm Signature
                        </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {showShareModal && shareLink && (
          <ShareModal 
            isOpen={true} onClose={() => setShowShareModal(false)}
            link={shareLink} title={`Check #${check.checkNumber}`}
            onShare={async () => {}} currentUserUid={currentUser?.uid}
          />
      )}
    </div>
  );
};
