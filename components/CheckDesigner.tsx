
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
  amount: 100.0,
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

// FIX: Ensure the component returns valid JSX and handle truncated logic from the previous version.
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

  const handleParseCheckDetails = async () => {
      const input = prompt("Paste raw payment instructions:");
      if (!input) return;
      setIsParsing(true);
      try {
          // Initialization follows @google/genai guidelines using process.env.API_KEY.
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
          // Initialization follows @google/genai guidelines using process.env.API_KEY.
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
          // Initialization follows @google/genai guidelines using process.env.API_KEY.
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
        const canvas = await html2canvas(checkRef.current, { scale: 4, useCORS: true, backgroundColor: '#ffffff' });
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [600, 260] });
        pdf.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, 600, 260);
        pdf.save(`check_${check.checkNumber}_${Date.now()}.pdf`);
    } catch (e) {
        alert("Export failed.");
    } finally {
        setIsExporting(false);
    }
  };

  if (isLoadingCheck) {
      return (
          <div className="h-full flex flex-col items-center justify-center bg-slate-950 text-indigo-400">
              <Loader2 className="animate-spin mb-2" size={32}/>
              <p className="text-xs font-bold uppercase tracking-widest">Retrieving Check...</p>
          </div>
      );
  }

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-20">
          <div className="flex items-center gap-4">
              <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"><ArrowLeft size={20} /></button>
              <h1 className="text-lg font-bold text-white flex items-center gap-2"><Wallet className="text-orange-400" /> Neural Check Designer</h1>
          </div>
          <div className="flex items-center gap-3">
              {!isReadOnly && (
                  <button onClick={handlePublishAndShareLink} disabled={isSharing} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-lg transition-all">
                      {isSharing ? <Loader2 size={14} className="animate-spin"/> : <Share2 size={14}/>}
                      <span>{shareLink ? 'Share Link' : 'Publish & Share'}</span>
                  </button>
              )}
              <button onClick={handleDownloadPDF} disabled={isExporting} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold border border-slate-700">
                  {isExporting ? <Loader2 size={14} className="animate-spin"/> : <Download size={14} />}
                  <span>Download PDF</span>
              </button>
          </div>
      </header>

      <div className="flex-1 flex overflow-hidden flex-col lg:flex-row">
          {!isReadOnly && (
              <div className="w-full lg:w-[400px] border-r border-slate-800 bg-slate-900/30 flex flex-col shrink-0 overflow-y-auto p-6 space-y-6 scrollbar-thin">
                  <div className="space-y-4">
                      <div className="flex justify-between items-center"><h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><User size={14} className="text-indigo-400"/> Payee Info</h3><button onClick={handleParseCheckDetails} className="text-[10px] font-bold text-indigo-400"><Sparkles size={10}/> Neural Parse</button></div>
                      <input type="text" placeholder="Pay To The Order Of" value={check.payee} onChange={e => setCheck({...check, payee: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none"/>
                      
                      <div className="flex gap-3">
                          <div className="flex-1">
                              <label className="text-[10px] text-slate-500 font-bold uppercase mb-1 block">Amount ($)</label>
                              <input type="number" value={check.amount} onChange={e => setCheck({...check, amount: parseFloat(e.target.value) || 0})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none"/>
                          </div>
                          <div className="w-24">
                              <label className="text-[10px] text-slate-500 font-bold uppercase mb-1 block">Check #</label>
                              <input type="text" value={check.checkNumber} onChange={e => setCheck({...check, checkNumber: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none"/>
                          </div>
                      </div>
                  </div>

                  <div className="space-y-4">
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Info size={14} className="text-emerald-400"/> Details</h3>
                      <input type="text" placeholder="Memo" value={check.memo} onChange={e => setCheck({...check, memo: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none"/>
                      <input type="date" value={check.date} onChange={e => setCheck({...check, date: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none"/>
                  </div>

                  <div className="pt-4 space-y-3">
                      <button onClick={handleGenerateArt} disabled={isGeneratingArt} className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all">
                          {isGeneratingArt ? <Loader2 size={14} className="animate-spin text-indigo-400"/> : <Palette size={14} className="text-indigo-400"/>}
                          <span>Generate Watermark Art</span>
                      </button>
                      <button onClick={() => setShowSignPad(true)} className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all">
                          <PenTool size={14} className="text-emerald-400"/>
                          <span>Sign Check</span>
                      </button>
                  </div>
              </div>
          )}

          <div className="flex-1 bg-slate-950 flex flex-col p-8 items-center justify-center overflow-y-auto relative">
              <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
                  <button onClick={() => setZoom(z => Math.max(0.4, z - 0.1))} className="p-1.5 bg-slate-800 rounded-lg text-slate-400 hover:text-white"><ZoomOut size={16}/></button>
                  <span className="text-[10px] font-mono text-slate-500 w-8 text-center">{Math.round(zoom * 100)}%</span>
                  <button onClick={() => setZoom(z => Math.min(2.0, z + 0.1))} className="p-1.5 bg-slate-800 rounded-lg text-slate-400 hover:text-white"><ZoomIn size={16}/></button>
              </div>

              <div 
                style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
                className="transition-transform duration-200"
              >
                  <div ref={checkRef} className="w-[600px] h-[260px] bg-white text-black shadow-2xl flex flex-col p-6 rounded-sm relative overflow-hidden shrink-0 border border-slate-300">
                      {check.watermarkUrl && (
                          <img src={check.watermarkUrl} className="absolute inset-0 w-full h-full object-cover opacity-10 pointer-events-none grayscale" alt="watermark" />
                      )}
                      
                      <div className="flex justify-between items-start z-10">
                          <div className="space-y-1">
                              <p className="text-xs font-bold leading-tight">{check.senderName}</p>
                              <p className="text-[9px] text-slate-500 leading-tight w-40">{check.senderAddress}</p>
                          </div>
                          <div className="text-right">
                              <p className="text-sm font-bold">{check.checkNumber}</p>
                              <div className="mt-2 border-b border-black w-32 pb-1 text-right">
                                  <span className="text-xs">{check.date}</span>
                              </div>
                              <p className="text-[8px] uppercase font-bold text-slate-400">Date</p>
                          </div>
                      </div>

                      <div className="mt-6 flex items-end gap-4 z-10">
                          <p className="text-xs font-bold whitespace-nowrap mb-1">PAY TO THE ORDER OF</p>
                          <div className="flex-1 border-b border-black pb-1 relative">
                              <span className="text-sm font-script text-indigo-900">{check.payee}</span>
                              <div className="absolute right-[-80px] bottom-0 flex items-center bg-slate-100 px-2 py-1 border border-black min-w-[120px]">
                                  <span className="text-xs font-bold">$</span>
                                  <span className="flex-1 text-right font-mono text-sm font-bold">{check.amount.toFixed(2)}</span>
                              </div>
                          </div>
                      </div>

                      <div className="mt-4 flex items-end gap-2 z-10">
                          <div className="flex-1 border-b border-black pb-1 italic text-xs px-2 min-h-[20px]">
                              {isUpdatingWords ? <Loader2 size={12} className="animate-spin inline-block mr-2" /> : check.amountWords}
                          </div>
                          <span className="text-xs font-bold mb-1">DOLLARS</span>
                      </div>

                      <div className="mt-4 flex justify-between items-start z-10">
                          <div className="space-y-1">
                              <p className="text-[10px] font-bold">{check.bankName}</p>
                              <div className="flex items-center gap-4 pt-2">
                                  <div className="flex flex-col">
                                      <span className="text-[8px] text-slate-500 uppercase font-bold">Memo</span>
                                      <div className="border-b border-black w-48 text-[10px] italic pb-0.5">{check.memo}</div>
                                  </div>
                              </div>
                          </div>
                          <div className="text-right flex flex-col items-end">
                              <div className="border-b border-black w-56 h-12 flex items-center justify-center relative">
                                  {check.signatureUrl ? (
                                      <img src={check.signatureUrl} className="max-h-full max-w-full object-contain" alt="signature" />
                                  ) : (
                                      <span className="text-[10px] text-slate-300">AUTHORIZED SIGNATURE</span>
                                  )}
                              </div>
                          </div>
                      </div>

                      <div className="mt-auto flex gap-6 font-mono text-[14px] items-end z-10 tracking-widest">
                          <span>⑆ {check.routingNumber} ⑆</span>
                          <span>{check.accountNumber} ⑈</span>
                          <span>{check.checkNumber}</span>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {showSignPad && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
              <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col">
                  <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                      <h3 className="font-bold text-white flex items-center gap-2"><PenTool size={18} className="text-emerald-400"/> Draw Signature</h3>
                      <button onClick={() => setShowSignPad(false)} className="p-1 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white"><X size={20}/></button>
                  </div>
                  <div className="h-[300px] bg-white m-6 rounded-xl overflow-hidden border border-slate-700">
                      <Whiteboard 
                        disableAI={true} 
                        initialColor="#000000" 
                        backgroundColor="#ffffff"
                        onDataChange={async (data) => {
                           // Signature captured when user clicks Apply
                        }}
                      />
                  </div>
                  <div className="p-6 border-t border-slate-800 bg-slate-900 flex justify-end gap-3">
                      <button onClick={() => setShowSignPad(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
                      <button 
                        onClick={async () => {
                            const canvas = document.querySelector('.fixed .h-\\[300px\\] canvas') as HTMLCanvasElement;
                            if (canvas) {
                                const sig = canvas.toDataURL('image/png');
                                setCheck({...check, signatureUrl: sig});
                            }
                            setShowSignPad(false);
                        }}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg shadow-lg"
                      >
                          Apply Signature
                      </button>
                  </div>
              </div>
          </div>
      )}

      {showShareModal && shareLink && (
          <ShareModal 
            isOpen={true} onClose={() => setShowShareModal(false)} 
            link={shareLink} title={`Check: ${check.checkNumber}`}
            onShare={async () => {}} currentUserUid={currentUser?.uid}
            defaultPermission="read"
          />
      )}
    </div>
  );
};
