
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  ArrowLeft, Wallet, Save, Download, Sparkles, Loader2, User, Hash, QrCode, Mail, 
  Trash2, Printer, CheckCircle, AlertTriangle, Send, Share2, DollarSign, Calendar, 
  Landmark, Info, Search, Edit3, RefreshCw, ShieldAlert, X, ChevronRight, ImageIcon, Link, Coins, Check as CheckIcon, Palette, Copy, ZoomIn, ZoomOut, Maximize2, PenTool, Upload, Camera, MapPin, HardDrive
} from 'lucide-react';
import { BankingCheck, UserProfile } from '../types';
import { GoogleGenAI } from "@google/genai";
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { getAllUsers, sendMessage, uploadFileToStorage, saveBankingCheck, claimCoinCheck, getCheckById, updateUserProfile } from '../services/firestoreService';
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
  
  const [isParsing, setIsParsing] = useState(false);
  const [isUpdatingWords, setIsUpdatingWords] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isGeneratingArt, setIsGeneratingArt] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
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
          getCheckById(checkIdFromUrl).then(data => {
              if (data) {
                  setCheck(data);
                  setShareLink(`${window.location.origin}?view=check_viewer&id=${data.id}`);
              }
              setIsLoadingCheck(false);
          });
      } else {
          // New check: Hydrate from profile template if available
          let initial = { ...DEFAULT_CHECK, senderName: currentUser?.displayName || DEFAULT_CHECK.senderName };
          if (userProfile) {
              if (userProfile.senderAddress) initial.senderAddress = userProfile.senderAddress;
              if (userProfile.savedSignatureUrl) initial.signatureUrl = userProfile.savedSignatureUrl;
              if (userProfile.checkTemplate) {
                  initial = { ...initial, ...userProfile.checkTemplate };
              }
          }
          setCheck(initial);
      }
  }, [checkIdFromUrl, userProfile, currentUser]);

  useEffect(() => {
    const handleAutoZoom = () => {
        if (window.innerWidth < 640) { setZoom((window.innerWidth - 32) / 600); } else { setZoom(1.0); }
    };
    handleAutoZoom();
    window.addEventListener('resize', handleAutoZoom);
    return () => window.removeEventListener('resize', handleAutoZoom);
  }, []);

  useEffect(() => {
    if (isReadOnly) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    const amountToSpell = check.isCoinCheck ? (check.coinAmount) : (check.amount);
    if (amountToSpell && amountToSpell > 0) {
        debounceTimerRef.current = setTimeout(() => handleGenerateAmountWords(amountToSpell as number, check.isCoinCheck), 1200); 
    } else {
        setCheck(prev => ({ ...prev, amountWords: '' }));
    }
    return () => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); };
  }, [check.amount, check.coinAmount, check.isCoinCheck, isReadOnly]);

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
              if (part.inlineData) { setCheck(prev => ({ ...prev, watermarkUrl: `data:image/png;base64,${part.inlineData.data}` })); break; }
          }
      } catch (e) { alert("Art failed."); } finally { setIsGeneratingArt(false); }
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
      } catch (e) { console.error(e); } finally { setIsUpdatingWords(false); }
  };

  const handleSaveAsTemplate = async () => {
      if (!currentUser) return alert("Sign in to save templates.");
      setIsSavingTemplate(true);
      try {
          // Template only saves recurring fields
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
          let finalSignatureUrl = check.signatureUrl || '';
          if (check.signatureUrl?.startsWith('data:')) {
              const res = await fetch(check.signatureUrl);
              const blob = await res.blob();
              finalSignatureUrl = await uploadFileToStorage(`checks/${id}/signature.png`, blob);
          }
          const checkToSave = { ...check, id, ownerId: auth.currentUser.uid, watermarkUrl: finalWatermarkUrl, signatureUrl: finalSignatureUrl };
          await saveBankingCheck(checkToSave as any);
          setShareLink(`${window.location.origin}?view=check_viewer&id=${id}`);
          setShowShareModal(true);
      } catch (e: any) { alert("Publish failed: " + e.message); } finally { setIsSharing(false); }
  };

  const handleDownloadPDF = async () => {
    if (!checkRef.current) return;
    setIsExporting(true);
    try {
        const canvas = await html2canvas(checkRef.current, { scale: 4, useCORS: true, backgroundColor: '#ffffff' });
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [600, 270] });
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 600, 270);
        pdf.save(`check_${check.checkNumber}.pdf`);
    } finally { setIsExporting(false); }
  };

  if (isLoadingCheck) return <div className="h-screen bg-slate-950 flex items-center justify-center animate-pulse"><Loader2 className="animate-spin text-indigo-500" size={40} /></div>;

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
                  <button onClick={handleSaveAsTemplate} disabled={isSavingTemplate} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-bold border border-slate-700 hover:bg-slate-700 transition-all">
                      {isSavingTemplate ? <Loader2 size={14} className="animate-spin"/> : <HardDrive size={14}/>}
                      <span>Save Default</span>
                  </button>
                  <button onClick={handlePublishAndShareLink} disabled={isSharing} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-lg transition-all">
                      {isSharing ? <Loader2 size={14} className="animate-spin"/> : <Share2 size={14}/>}
                      <span>{shareLink ? 'Share URI' : 'Publish & Share'}</span>
                  </button>
                </>
              )}
              <button onClick={handleDownloadPDF} disabled={isExporting} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold border border-slate-700 hover:bg-slate-700 transition-all">
                  {isExporting ? <Loader2 size={14} className="animate-spin"/> : <Download size={14}/>}
                  <span>PDF</span>
              </button>
          </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
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
                    <button onClick={() => setShowSignPad(true)} className="py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs border border-slate-700 flex items-center justify-center gap-2 transition-all">
                        <PenTool size={14}/> Sign Check
                    </button>
                </div>
            </div>
          )}

          <div className="flex-1 bg-slate-950 flex flex-col p-8 items-center justify-center overflow-auto relative">
              <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }} className="transition-transform duration-300">
                  <div ref={checkRef} className="w-[600px] h-[270px] bg-white text-black shadow-2xl flex flex-col border border-slate-300 rounded-lg relative overflow-hidden p-8">
                      {check.watermarkUrl && <div className="absolute inset-0 opacity-[0.35] pointer-events-none z-0"><img key={check.watermarkUrl} src={check.watermarkUrl} className="w-full h-full object-cover grayscale" crossOrigin="anonymous"/></div>}
                      <div className="absolute top-8 left-[210px] z-40 pointer-events-none"><img key={qrCodeUrl} src={qrCodeUrl} className="w-14 h-14 border border-white p-0.5 rounded shadow-md bg-white" crossOrigin="anonymous" /></div>
                      
                      <div className="flex justify-between items-start relative z-10">
                          <div className="space-y-1">
                              <h2 className="text-sm font-bold uppercase tracking-wider">{check.senderName}</h2>
                              <p className="text-[9px] text-slate-500 leading-tight max-w-[190px] truncate whitespace-pre-wrap">{check.senderAddress}</p>
                          </div>
                          <p className="text-lg font-mono font-bold">{check.checkNumber}</p>
                      </div>

                      <div className="flex justify-end mt-2 relative z-10"><div className="border-b border-black w-32 flex justify-between items-end pb-1"><span className="text-[9px] font-bold">DATE</span><span className="text-sm font-mono">{check.date}</span></div></div>

                      <div className="mt-4 flex items-center gap-4 relative z-10">
                          <span className="text-xs font-bold whitespace-nowrap uppercase">Pay to the Order of</span>
                          <div className="flex-1 border-b border-black text-lg font-serif italic px-2">{check.payee || '____________________'}</div>
                          <div className="w-32 border-2 border-black p-1 flex items-center bg-slate-50/50"><span className="text-sm font-bold">$</span><span className="flex-1 text-right font-mono text-lg font-bold">{check.isCoinCheck ? (check.coinAmount || 0).toFixed(2) : (check.amount || 0).toFixed(2)}</span></div>
                      </div>

                      <div className="mt-4 flex items-center gap-4 relative z-10">
                          <div className="flex-1 border-b border-black text-sm font-serif italic px-2">{check.amountWords || '____________________________________________________________________'}</div>
                          <span className="text-xs font-bold">{check.isCoinCheck ? 'COINS' : 'DOLLARS'}</span>
                      </div>

                      <div className="mt-4 relative z-10"><p className="text-xs font-bold uppercase">{check.isCoinCheck ? 'VOICECOIN LEDGER' : check.bankName}</p></div>

                      <div className="mt-auto flex items-end justify-between relative z-10">
                          <div className="flex-1 flex flex-col gap-2"><div className="flex items-center gap-2"><span className="text-[10px] font-bold">FOR</span><div className="w-48 border-b border-black text-sm font-serif italic px-1 truncate">{check.memo || '____________________'}</div></div></div>
                          <div className="w-48 relative ml-4 z-20">
                              <div className="border-b border-black h-12 flex items-end justify-center pb-1 overflow-hidden">
                                  {check.signatureUrl ? <img key={check.signatureUrl} src={check.signatureUrl} className="max-h-12 w-auto object-contain" crossOrigin="anonymous"/> : <span className="text-slate-200 font-serif text-sm">SIGN HERE</span>}
                              </div>
                              <span className="text-[8px] font-bold text-center block mt-1 uppercase tracking-tighter">Authorized Signature</span>
                          </div>
                      </div>
                      <div className="absolute bottom-6 left-8 font-mono text-xl tracking-widest text-slate-800 whitespace-nowrap bg-white/70 inline-block px-1 z-30">⑆ {check.routingNumber} ⑈ {check.accountNumber} ⑈ {check.checkNumber}</div>
                  </div>
              </div>
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
                      <Whiteboard disableAI backgroundColor="transparent" initialColor="#000000" onDataChange={() => {}} onSessionStart={() => {}} />
                  </div>
                  <div className="flex justify-end gap-2">
                      <button onClick={() => setShowSignPad(false)} className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold">Cancel</button>
                      <button 
                        onClick={() => {
                            const canvas = document.querySelector('.fixed canvas') as HTMLCanvasElement;
                            if (canvas) setCheck(prev => ({ ...prev, signatureUrl: canvas.toDataURL('image/png') }));
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
