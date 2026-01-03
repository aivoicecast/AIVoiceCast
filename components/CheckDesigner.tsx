
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  ArrowLeft, Wallet, Save, Download, Sparkles, Loader2, User, Hash, QrCode, Mail, 
  Trash2, Printer, CheckCircle, AlertTriangle, Send, Share2, DollarSign, Calendar, 
  Landmark, Info, Search, Edit3, RefreshCw, ShieldAlert, X, ChevronRight, ImageIcon, Link, Coins, Check as CheckIcon, Palette, Copy, ZoomIn, ZoomOut, Maximize2, PenTool, Upload, Camera, MapPin, HardDrive, List
} from 'lucide-react';
import { BankingCheck, UserProfile } from '../types';
import { GoogleGenAI } from "@google/genai";
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { getAllUsers, sendMessage, uploadFileToStorage, saveBankingCheck, claimCoinCheck, getCheckById, updateUserProfile, getUserChecks } from '../services/firestoreService';
import { auth } from '../services/firebaseConfig';
import { Whiteboard } from './Whiteboard';
import { generateSecureId } from '../utils/idUtils';
import { ShareModal } from './ShareModal';

interface CheckDesignerProps {
  onBack: () => void;
  currentUser: any;
  userProfile?: UserProfile | null;
}

const DEFAULT_CHECK: BankingCheck = {
  id: '',
  payee: '',
  amount: 0,
  amountWords: '',
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

export const CheckDesigner: React.FC<CheckDesignerProps> = ({ onBack, currentUser, userProfile }) => {
  const params = new URLSearchParams(window.location.search);
  const isReadOnly = params.get('mode') === 'view' || params.get('view') === 'check_viewer';
  const checkIdFromUrl = params.get('id');

  const [check, setCheck] = useState<BankingCheck>(DEFAULT_CHECK);
  const [convertedAssets, setConvertedAssets] = useState<Record<string, string>>({});
  
  const [isParsing, setIsParsing] = useState(false);
  const [isUpdatingWords, setIsUpdatingWords] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isGeneratingArt, setIsGeneratingArt] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [showSignPad, setShowSignPad] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [archiveChecks, setArchiveChecks] = useState<BankingCheck[]>([]);
  const [loadingArchive, setLoadingArchive] = useState(false);
  const [zoom, setZoom] = useState(1.0);
  const [isLoadingCheck, setIsLoadingCheck] = useState(!!checkIdFromUrl);
  const [imageError, setImageError] = useState<Record<string, boolean>>({});
  
  const checkRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasHydratedFromTemplate = useRef(false);

  // Helper to convert remote image to data URL to fix CORS issues in PDF and Shared View
  const convertRemoteToDataUrl = async (url: string): Promise<string> => {
      if (!url || !url.startsWith('http')) return url;
      try {
          const res = await fetch(url, { mode: 'cors' });
          const blob = await res.blob();
          return new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
          });
      } catch (e) {
          console.warn("Conversion failed for", url, e);
          return url; // Fallback to original URL
      }
  };

  useEffect(() => {
      if (checkIdFromUrl) {
          setIsLoadingCheck(true);
          getCheckById(checkIdFromUrl).then(async (data) => {
              if (data) {
                  const sig = data.signatureUrl || data.signature || '';
                  const wm = data.watermarkUrl || '';
                  
                  const [base64Sig, base64Wm] = await Promise.all([
                      convertRemoteToDataUrl(sig),
                      convertRemoteToDataUrl(wm)
                  ]);

                  setConvertedAssets({ sig: base64Sig, wm: base64Wm });

                  const normalizedCheck = {
                      ...DEFAULT_CHECK,
                      ...data,
                      signature: sig,
                      signatureUrl: sig,
                      watermarkUrl: wm 
                  };
                  setCheck(normalizedCheck);
                  setShareLink(`${window.location.origin}?view=check_viewer&id=${data.id}`);
              }
              setIsLoadingCheck(false);
          }).catch(() => setIsLoadingCheck(false));
      } else if (!hasHydratedFromTemplate.current) {
          let initial = { ...DEFAULT_CHECK, senderName: currentUser?.displayName || DEFAULT_CHECK.senderName };
          if (userProfile) {
              if (userProfile.senderAddress) initial.senderAddress = userProfile.senderAddress;
              if (userProfile.savedSignatureUrl) {
                  initial.signatureUrl = userProfile.savedSignatureUrl;
                  initial.signature = userProfile.savedSignatureUrl;
              }
              if (userProfile.checkTemplate) {
                  initial = { ...initial, ...userProfile.checkTemplate };
              }
              hasHydratedFromTemplate.current = true;
          }
          setCheck(initial);
      }
  }, [checkIdFromUrl, userProfile, currentUser]);

  useEffect(() => {
    const handleAutoZoom = () => {
        if (window.innerWidth < 768) { 
            const containerWidth = window.innerWidth - 64;
            setZoom(Math.min(1.0, containerWidth / 600)); 
        } else { 
            setZoom(1.0); 
        }
    };
    handleAutoZoom();
    window.addEventListener('resize', handleAutoZoom);
    return () => window.removeEventListener('resize', handleAutoZoom);
  }, []);

  // RESTORE: Auto-generate description of the amount with professional formatting
  useEffect(() => {
    if (isReadOnly || isLoadingCheck) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    
    const amountToSpell = check.isCoinCheck ? check.coinAmount : check.amount;
    
    if (amountToSpell !== undefined && amountToSpell > 0) {
        debounceTimerRef.current = setTimeout(() => {
            handleGenerateAmountWords(amountToSpell as number, check.isCoinCheck);
        }, 1000); 
    } else {
        setCheck(prev => ({ ...prev, amountWords: '' }));
    }
    
    return () => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); };
  }, [check.amount, check.coinAmount, check.isCoinCheck, isReadOnly, isLoadingCheck]);

  const qrCodeUrl = useMemo(() => {
      const baseUri = shareLink || `${window.location.origin}?view=check_viewer&id=${check.id || 'preview'}`;
      return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&color=0-0-0&bgcolor=255-255-255&data=${encodeURIComponent(baseUri)}`;
  }, [shareLink, check.id]);

  const handleGenerateArt = async () => {
      if (!check.memo) return alert("Enter a memo first.");
      setIsGeneratingArt(true);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash-image',
              contents: { parts: [{ text: `A professional high-contrast watermark etching for a bank check. Subject: ${check.memo}. Minimalist, grayscale.` }] },
              config: { imageConfig: { aspectRatio: "16:9" } }
          });
          for (const part of response.candidates[0].content.parts) {
              if (part.inlineData) { 
                  const dataUrl = `data:image/png;base64,${part.inlineData.data}`;
                  setCheck(prev => ({ ...prev, watermarkUrl: dataUrl })); 
                  setConvertedAssets(prev => ({ ...prev, wm: dataUrl }));
                  break; 
              }
          }
      } catch (e) { alert("Art failed."); } finally { setIsGeneratingArt(false); }
  };

  const handleGenerateAmountWords = async (val: number, isCoins = false) => {
      setIsUpdatingWords(true);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const response = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: `Convert the amount ${val} to official bank check words. 
              Format as 'WORDS AND CENTS/100'. 
              Example for 100: 'ONE HUNDRED AND 00/100'. 
              Example for 123.45: 'ONE HUNDRED TWENTY THREE AND 45/100'. 
              Include the text '${isCoins ? 'COINS' : 'DOLLARS'}' at the end if you want, but the requirement is the numerical/word conversion. 
              Respond with the text ONLY.`
          });
          const text = response.text?.trim().toUpperCase() || '';
          if (text) setCheck(prev => ({ ...prev, amountWords: text }));
      } catch (e) { console.error(e); } finally { setIsUpdatingWords(false); }
  };

  const handleSaveAsTemplate = async () => {
      if (!currentUser) return alert("Sign in to save templates.");
      setIsSavingTemplate(true);
      try {
          const template: Partial<BankingCheck> = {
              bankName: check.bankName,
              routingNumber: check.routingNumber,
              accountNumber: check.accountNumber,
              senderAddress: check.senderAddress,
              senderName: check.senderName
          };
          await updateUserProfile(currentUser.uid, { checkTemplate: template });
          alert("Template saved as default!");
      } catch(e: any) {
          alert("Save template failed: " + e.message);
      } finally {
          setIsSavingTemplate(false);
      }
  };

  const handlePublishAndShareLink = async () => {
      if (shareLink) { setShowShareModal(true); return; }
      if (!auth.currentUser) return alert("Please sign in.");
      setIsSharing(true);
      try {
          const id = check.id || generateSecureId();
          
          let finalWatermarkUrl = check.watermarkUrl || '';
          if (check.watermarkUrl?.startsWith('data:')) {
             const res = await fetch(check.watermarkUrl);
             const blob = await res.blob();
             finalWatermarkUrl = await uploadFileToStorage(`checks/${id}/watermark.png`, blob);
          }
          
          let finalSignatureUrl = check.signatureUrl || check.signature || '';
          if (finalSignatureUrl.startsWith('data:')) {
              const res = await fetch(finalSignatureUrl);
              const blob = await res.blob();
              finalSignatureUrl = await uploadFileToStorage(`checks/${id}/signature.png`, blob);
          }
          
          const checkToSave = { 
              ...check, 
              id, 
              ownerId: auth.currentUser.uid, 
              watermarkUrl: finalWatermarkUrl, 
              signatureUrl: finalSignatureUrl,
              signature: finalSignatureUrl 
          };
          
          await saveBankingCheck(checkToSave as any);
          setCheck(checkToSave);
          setShareLink(`${window.location.origin}?view=check_viewer&id=${id}`);
          setShowShareModal(true);
      } catch (e: any) { 
          alert("Publish failed: " + e.message); 
      } finally { 
          setIsSharing(false); 
      }
  };

  const loadArchive = async () => {
      if (!currentUser) return;
      setLoadingArchive(true);
      setShowArchive(true);
      try {
          const data = await getUserChecks(currentUser.uid);
          setArchiveChecks(data);
      } catch (e) {
          console.error(e);
      } finally {
          setLoadingArchive(false);
      }
  };

  const handleDownloadPDF = async () => {
    if (!checkRef.current) return;
    setIsExporting(true);
    try {
        const canvas = await html2canvas(checkRef.current, { 
            scale: 4, 
            useCORS: true, 
            backgroundColor: '#ffffff',
            logging: false,
            allowTaint: true,
            imageTimeout: 15000,
            onclone: (clonedDoc) => {
                const el = clonedDoc.querySelector('.check-preview-container');
                if (el) (el as HTMLElement).style.transform = 'none';
            }
        });
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [600, 270] });
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 600, 270);
        pdf.save(`check_${check.checkNumber}.pdf`);
    } catch(e) {
        alert("PDF Generation failed. Try again.");
    } finally { 
        setIsExporting(false); 
    }
  };

  const renderSignature = () => {
      const url = convertedAssets.sig || check.signatureUrl || check.signature;
      if (!url || typeof url !== 'string' || url.length < 10 || imageError['sig']) {
          return <span className="text-slate-200 font-serif text-[10px]">AUTHORIZED SIGNATURE</span>;
      }
      const isRemote = url.startsWith('http');
      return (
          <img 
              key={url}
              src={url} 
              className="max-h-16 w-auto object-contain mb-1" 
              alt="Authorized Signature"
              crossOrigin={isRemote ? "anonymous" : undefined}
              onError={() => setImageError(prev => ({ ...prev, 'sig': true }))}
          />
      );
  };

  const renderWatermark = () => {
      const url = convertedAssets.wm || check.watermarkUrl;
      if (!url || imageError['wm']) return null;
      const isRemote = url.startsWith('http');
      return (
          <div className="absolute inset-0 opacity-[0.35] pointer-events-none z-0">
            <img 
                key={url} 
                src={url} 
                className="w-full h-full object-cover grayscale" 
                alt="Security Watermark"
                crossOrigin={isRemote ? "anonymous" : undefined}
                onError={() => setImageError(prev => ({ ...prev, 'wm': true }))}
            />
          </div>
      );
  };

  if (isLoadingCheck) return <div className="h-screen bg-slate-950 flex items-center justify-center animate-pulse"><Loader2 className="animate-spin text-indigo-500" size={40} /></div>;

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden relative">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-20">
          <div className="flex items-center gap-4">
              <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                  <ArrowLeft size={20} />
              </button>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                  <Wallet className="text-indigo-400" />
                  {isReadOnly ? 'Neural Check Viewer' : 'Neural Check Lab'}
              </h1>
          </div>
          <div className="flex items-center gap-3">
              {!isReadOnly && (
                <>
                  <button onClick={loadArchive} className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-bold border border-slate-700 hover:bg-slate-700 transition-all">
                      <List size={14}/>
                      <span className="hidden sm:inline">My Archive</span>
                  </button>
                  <button onClick={handleSaveAsTemplate} disabled={isSavingTemplate} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-bold border border-slate-700 hover:bg-slate-700 transition-all">
                      {isSavingTemplate ? <Loader2 size={14} className="animate-spin"/> : <HardDrive size={14}/>}
                      <span className="hidden sm:inline">Save Default</span>
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

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
          {!isReadOnly && (
            <div className="w-full lg:w-[400px] border-r border-slate-800 bg-slate-900/30 flex flex-col shrink-0 overflow-y-auto p-6 space-y-6 scrollbar-thin">
                <div className="space-y-4">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><MapPin size={14} className="text-indigo-400"/> Sender Information</h3>
                    <input type="text" placeholder="Sender Name" value={check.senderName} onChange={e => setCheck({...check, senderName: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none"/>
                    <textarea placeholder="Sender Address" value={check.senderAddress} onChange={e => setCheck({...check, senderAddress: e.target.value})} rows={2} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none resize-none"/>
                </div>

                <div className="space-y-4 bg-slate-800/20 p-4 rounded-xl border border-slate-800">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Landmark size={14}/> Bank & Account</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                            <input type="text" placeholder="Bank Name" value={check.bankName} onChange={e => setCheck({...check, bankName: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"/>
                        </div>
                        <div><input type="text" placeholder="Routing #" value={check.routingNumber} onChange={e => setCheck({...check, routingNumber: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"/></div>
                        <div><input type="text" placeholder="Account #" value={check.accountNumber} onChange={e => setCheck({...check, accountNumber: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"/></div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><User size={14} className="text-indigo-400"/> Transaction</h3>
                    <input type="text" placeholder="Pay to the order of..." value={check.payee} onChange={e => setCheck({...check, payee: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none ring-2 ring-indigo-500/20 focus:ring-indigo-500/50"/>
                    <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" size={16}/>
                        <input type="number" placeholder="0.00" value={check.isCoinCheck ? (check.coinAmount || '') : (check.amount || '')} onChange={e => setCheck(check.isCoinCheck ? {...check, coinAmount: parseFloat(e.target.value) || 0} : {...check, amount: parseFloat(e.target.value) || 0})} className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white outline-none ring-2 ring-indigo-500/20 focus:ring-indigo-500/50"/>
                    </div>
                    <input type="text" placeholder="Memo" value={check.memo} onChange={e => setCheck({...check, memo: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none"/>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <button onClick={handleGenerateArt} disabled={isGeneratingArt} className="py-3 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-xl font-bold text-xs border border-slate-700 flex items-center justify-center gap-2 transition-all">
                        {isGeneratingArt ? <Loader2 size={14} className="animate-spin"/> : <Palette size={14}/>} AI Watermark
                    </button>
                    <button onClick={() => { setImageError({}); setShowSignPad(true); }} className="py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs border border-slate-700 flex items-center justify-center gap-2 transition-all">
                        <PenTool size={14}/> Sign Check
                    </button>
                </div>
            </div>
          )}

          <div className="flex-1 bg-slate-950 flex flex-col p-8 items-center justify-center overflow-auto relative">
              {isReadOnly && (
                  <div className="absolute top-8 text-center max-w-md animate-fade-in mb-8">
                      <div className="bg-emerald-900/20 border border-emerald-500/30 px-6 py-4 rounded-3xl backdrop-blur-md">
                          <p className="text-emerald-400 font-bold flex items-center justify-center gap-2 mb-1">
                              <ShieldCheckIcon /> Authenticated Document
                          </p>
                          <p className="text-slate-400 text-xs leading-relaxed">Verified via AIVoiceCast Neural Prism secure ledger.</p>
                      </div>
                  </div>
              )}
              
              <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }} className="transition-transform duration-300 mt-12 check-preview-container">
                  <div ref={checkRef} className="w-[600px] h-[270px] bg-white text-black shadow-2xl flex flex-col border border-slate-300 rounded-lg relative overflow-hidden p-8 pb-10">
                      {renderWatermark()}
                      
                      <div className="absolute top-8 left-[210px] z-40 pointer-events-none">
                        <img 
                            key={qrCodeUrl} 
                            src={qrCodeUrl} 
                            className="w-14 h-14 border border-slate-100 p-0.5 rounded shadow-sm bg-white" 
                            alt="Verification QR"
                            crossOrigin="anonymous"
                        />
                      </div>
                      
                      <div className="flex justify-between items-start relative z-10">
                          <div className="space-y-1">
                              <h2 className="text-sm font-bold uppercase tracking-wider leading-[1.6]">{check.senderName}</h2>
                              <p className="text-[9px] text-slate-500 leading-[1.6] max-w-[240px] whitespace-pre-wrap pb-4">{check.senderAddress}</p>
                          </div>
                          <div className="text-right">
                              <h2 className="text-xs font-black uppercase text-slate-800 leading-normal">{check.isCoinCheck ? 'VOICECOIN LEDGER' : check.bankName}</h2>
                              <p className="text-lg font-mono font-bold mt-1 leading-normal">{check.checkNumber}</p>
                          </div>
                      </div>

                      <div className="flex justify-end mt-0 relative z-10">
                          <div className="border-b border-black w-32 flex justify-between items-end pb-1 mb-1">
                              <span className="text-[9px] font-bold">DATE</span>
                              <span className="text-sm font-mono leading-normal">{check.date}</span>
                          </div>
                      </div>

                      <div className="mt-4 flex items-center gap-4 relative z-10">
                          <span className="text-xs font-bold whitespace-nowrap uppercase">Pay to the Order of</span>
                          <div className="flex-1 border-b border-black text-lg font-serif italic px-2 overflow-hidden whitespace-nowrap min-w-0 pb-1 leading-relaxed">{check.payee || '____________________'}</div>
                          <div className="w-32 border-2 border-black p-1 flex items-center bg-slate-50/50 shrink-0">
                              <span className="text-sm font-bold">$</span>
                              <span className="flex-1 text-right font-mono text-lg font-bold leading-normal">
                                  {check.isCoinCheck ? (check.coinAmount || 0).toFixed(2) : (check.amount || 0).toFixed(2)}
                              </span>
                          </div>
                      </div>

                      <div className="mt-6 flex items-center gap-4 relative z-10 overflow-hidden">
                          <div className="flex-1 max-w-[460px] border-b border-black text-[13px] font-serif italic px-2 overflow-hidden whitespace-nowrap min-w-0 pb-1.5 leading-[1.6]">
                            {isUpdatingWords ? 'PROCESSING AMOUNT...' : (check.amountWords || '____________________________________________________________________')}
                          </div>
                          <span className="text-xs font-bold shrink-0">{check.isCoinCheck ? 'COINS' : 'DOLLARS'}</span>
                      </div>

                      <div className="mt-4 flex items-center gap-2 relative z-10">
                          <span className="text-[10px] font-bold">FOR</span>
                          <div className="w-64 border-b border-black text-sm font-serif italic px-1 truncate leading-relaxed pb-1.5">{check.memo || '____________________'}</div>
                      </div>

                      {/* Signature Block - Anchored Strictly to Bottom Right */}
                      <div className="absolute bottom-10 right-8 w-48 z-20 flex flex-col items-center">
                          <div className="border-b border-black w-full min-h-[64px] flex items-end justify-center overflow-hidden pb-1">
                              {renderSignature()}
                          </div>
                          <span className="text-[8px] font-bold text-center block mt-1 uppercase tracking-tighter w-full">Authorized Signature</span>
                      </div>
                      
                      <div className="absolute bottom-2 left-6 font-mono text-lg tracking-[0.2em] text-slate-800 whitespace-nowrap bg-white/70 inline-block px-1 z-30 leading-normal">
                          ⑆ {check.routingNumber} ⑈ {check.accountNumber} ⑈ {check.checkNumber}
                      </div>
                  </div>
              </div>

              {isReadOnly && (
                  <div className="mt-12 flex flex-col items-center gap-4">
                      <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest">Shared Document Archive</p>
                      <div className="flex gap-3">
                        <button onClick={handleDownloadPDF} disabled={isExporting} className="px-8 py-3 bg-white text-slate-900 font-black rounded-xl hover:bg-slate-100 transition-all flex items-center gap-3 shadow-xl active:scale-95">
                            {isExporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                            Download Verified Copy
                        </button>
                        {currentUser && currentUser.uid === check.ownerId && (
                            <button onClick={() => {
                                const url = new URL(window.location.href);
                                url.searchParams.set('mode', 'edit');
                                url.searchParams.set('view', 'check_designer');
                                window.location.assign(url.toString());
                            }} className="px-8 py-3 bg-slate-800 text-white font-bold rounded-xl border border-slate-700 hover:bg-slate-700">
                                Edit Original
                            </button>
                        )}
                      </div>
                  </div>
              )}
          </div>
          
          {/* ARCHIVE SLIDE-OVER */}
          {showArchive && (
              <div className="absolute inset-0 z-40 flex justify-end">
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowArchive(false)}></div>
                  <div className="relative w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-fade-in-right">
                      <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                          <h2 className="text-lg font-bold text-white flex items-center gap-2"><List className="text-indigo-400"/> Recent Checks</h2>
                          <button onClick={() => setShowArchive(false)} className="text-slate-500 hover:text-white"><X/></button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
                          {loadingArchive ? (
                              <div className="flex flex-col items-center justify-center h-40 gap-3 text-slate-500">
                                  <Loader2 size={24} className="animate-spin"/>
                                  <span className="text-xs font-bold uppercase tracking-widest">Scanning Ledger...</span>
                              </div>
                          ) : archiveChecks.length === 0 ? (
                              <div className="text-center py-20 text-slate-600 italic text-sm">No published checks found in your account.</div>
                          ) : (
                              archiveChecks.map(ac => (
                                  <div key={ac.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 hover:border-indigo-500/50 transition-all group">
                                      <div className="flex justify-between items-start mb-2">
                                          <div>
                                              <p className="text-[10px] font-bold text-indigo-400 uppercase">Check #{ac.checkNumber}</p>
                                              <h4 className="font-bold text-white text-sm line-clamp-1">{ac.payee || 'Unnamed Payee'}</h4>
                                          </div>
                                          <div className="text-right">
                                              <p className="text-sm font-black text-white">${(ac.amount || ac.coinAmount || 0).toFixed(2)}</p>
                                              <p className="text-[9px] text-slate-500">{ac.date}</p>
                                          </div>
                                      </div>
                                      <p className="text-xs text-slate-500 italic mb-4 line-clamp-1">"{ac.memo}"</p>
                                      <div className="flex gap-2">
                                          <button 
                                            onClick={() => {
                                                const url = new URL(window.location.origin);
                                                url.searchParams.set('view', 'check_viewer');
                                                url.searchParams.set('id', ac.id);
                                                window.history.pushState({}, '', url.toString());
                                                window.location.reload();
                                            }}
                                            className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold uppercase transition-all"
                                          >
                                              Open URI
                                          </button>
                                          <button 
                                            onClick={() => {
                                                setCheck({...ac, id: '', checkNumber: (parseInt(ac.checkNumber) + 1).toString(), date: new Date().toISOString().split('T')[0]});
                                                setShareLink(null);
                                                setShowArchive(false);
                                            }}
                                            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold uppercase transition-all"
                                            title="Clone to Draft"
                                          >
                                              Clone
                                          </button>
                                      </div>
                                  </div>
                              ))
                          )}
                      </div>
                  </div>
              </div>
          )}
      </div>

      {showSignPad && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
              <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl p-6 shadow-2xl animate-fade-in-up">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2"><PenTool size={20} className="text-indigo-400"/> Authorized Signature</h3>
                      <button onClick={() => setShowSignPad(false)} className="p-2 text-slate-500 hover:text-white"><X/></button>
                  </div>
                  <div className="h-[300px] border-2 border-dashed border-slate-800 rounded-2xl overflow-hidden mb-6 bg-white">
                      <Whiteboard disableAI backgroundColor="transparent" initialColor="#000000" onDataChange={() => {}} onSessionStart={() => {}} />
                  </div>
                  <div className="flex justify-end gap-2">
                      <button onClick={() => setShowSignPad(false)} className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold">Cancel</button>
                      <button 
                        onClick={() => {
                            const canvas = document.querySelector('.fixed canvas') as HTMLCanvasElement;
                            if (canvas) {
                                setImageError(prev => ({ ...prev, 'sig': false }));
                                const dataUrl = canvas.toDataURL('image/png');
                                setCheck(prev => ({ ...prev, signatureUrl: dataUrl, signature: dataUrl }));
                                setConvertedAssets(prev => ({ ...prev, sig: dataUrl }));
                            }
                            setShowSignPad(false);
                        }} 
                        className="px-8 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-lg"
                      >
                        Confirm
                      </button>
                  </div>
              </div>
          </div>
      )}

      {showShareModal && shareLink && (
          <ShareModal isOpen={true} onClose={() => setShowShareModal(false)} link={shareLink} title={`Check #${check.checkNumber}`} onShare={async () => {}} currentUserUid={currentUser?.uid} />
      )}
    </div>
  );
};

const ShieldCheckIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
);
