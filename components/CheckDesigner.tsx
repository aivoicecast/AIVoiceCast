import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, Wallet, Save, Download, Sparkles, Loader2, User, Hash, QrCode, Mail, 
  Trash2, Printer, CheckCircle, AlertTriangle, Send, Share2, DollarSign, Calendar, 
  Landmark, Info, Search, Edit3, RefreshCw, ShieldAlert, X, ChevronRight, ImageIcon, Link, Coins, Check as CheckIcon, Palette, Copy, ZoomIn, ZoomOut, Maximize2, PenTool, Upload, Camera, MapPin, HardDrive, List, FileText, Plus, ShieldCheck, Lock, CreditCard, BookOpen, Shield, Timer, TrendingUp, UserCheck, Clock, Trash, History, FilePlus, CopyPlus, Sliders, ShieldCheck as SecurityIcon, Fingerprint, Eye, EyeOff
} from 'lucide-react';
import { BankingCheck, UserProfile, InsurancePolicy } from '../types';
import { GoogleGenAI } from "@google/genai";
import { jsPDF } from 'jspdf';
import { getAllUsers, sendMessage, uploadFileToStorage, saveBankingCheck, claimCoinCheck, getCheckById, updateUserProfile, getUserChecks, deleteCheck, deductCoins, AI_COSTS, calculateUserTrustScore } from '../services/firestoreService';
import { auth } from '../services/firebaseConfig';
import { Whiteboard } from './Whiteboard';
import { generateSecureId } from '../utils/idUtils';
import { ShareModal } from './ShareModal';
import { connectGoogleDrive, getDriveToken } from '../services/authService';
import { ensureFolder, uploadToDrive, makeFilePubliclyViewable, getDriveFileSharingLink, ensureCodeStudioFolder, getDrivePreviewUrl } from '../services/googleDriveService';
import { MarkdownView } from './MarkdownView';
import { saveLocalAsset, getLocalAsset } from '../utils/db';
import { FINANCE_LAB_MANUAL } from '../utils/financeContent';

const numberToWords = (num: number): string => {
  if (num === 0) return 'ZERO AND 00/100';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  const helper = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + helper(n % 100) : '');
    return '';
  };

  const dollars = Math.floor(num);
  const cents = Math.round((num - dollars) * 100);
  
  let res = '';
  if (dollars >= 1000000) res += helper(Math.floor(dollars / 1000000)) + ' Million ';
  const thousands = Math.floor((dollars % 1000000) / 1000);
  if (thousands > 0) res += helper(thousands) + ' Thousand ';
  const hundreds = dollars % 1000;
  if (hundreds > 0 || res === '') res += helper(hundreds);
  
  return `${res.trim()} and ${cents.toString().padStart(2, '0')}/100`.toUpperCase();
};

const DEFAULT_CHECK: BankingCheck = {
  id: '', payee: '', amount: 0, amountWords: '', date: new Date().toISOString().split('T')[0],
  memo: 'Neural Services', checkNumber: '1001', routingNumber: '123456789', accountNumber: '987654321',
  bankName: 'Neural Prism Bank', senderName: 'Account Holder', senderAddress: '', signature: '', isCoinCheck: false, coinAmount: 0,
  isInsured: false, isVerified: false,
  insurancePolicy: {
    amountPerSecond: 0.1,
    maxAmount: 1000,
    validWindows: []
  }
};

interface CheckDesignerProps {
  onBack: () => void;
  currentUser: any;
  userProfile: UserProfile | null;
  isProMember?: boolean;
}

export const CheckDesigner: React.FC<CheckDesignerProps> = ({ onBack, currentUser, userProfile, isProMember }) => {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const checkIdFromUrl = params.get('id');
  const isReadOnly = params.get('mode') === 'view';

  if (!isReadOnly && isProMember === false) {
    return (
        <div className="h-full flex items-center justify-center p-6 bg-slate-950">
            <div className="max-w-md w-full bg-slate-900 border border-indigo-500/30 rounded-[3rem] p-12 text-center shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-32 bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none"></div>
                <Lock size={48} className="text-indigo-400 mx-auto mb-6 relative z-10" />
                <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-4 relative z-10">Pro Access Required</h2>
                <p className="text-slate-400 text-sm mb-10 font-medium relative z-10">Neural Finance Lab requires an active Pro Membership to design and verify financial assets.</p>
                <button onClick={onBack} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest rounded-2xl transition-all relative z-10">Back to Hub</button>
            </div>
        </div>
    );
  }

  const [check, setCheck] = useState<BankingCheck>({ ...DEFAULT_CHECK, id: checkIdFromUrl || generateSecureId() });
  const [convertedAssets, setConvertedAssets] = useState<Record<string, string>>({});
  const [tempSigData, setTempSigData] = useState<string>(''); 
  const [isUpdatingWords, setIsUpdatingWords] = useState(false);
  const [isIssuing, setIsIssuing] = useState(false);
  const [isGeneratingArt, setIsGeneratingArt] = useState(false);
  const [isSynthesisActive, setIsSynthesisActive] = useState(false);
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.6); 
  const [highContrastMode, setHighContrastMode] = useState(true);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [showSignPad, setShowSignPad] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<BankingCheck[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [zoom, setZoom] = useState(1.0);
  const [isLoadingCheck, setIsLoadingCheck] = useState(!!checkIdFromUrl);
  const [qrLocalUrl, setQrLocalUrl] = useState<string | null>(null);
  const checkRef = useRef<HTMLDivElement>(null);

  // Insurance Input Buffer
  const [newWindowStart, setNewWindowStart] = useState('');
  const [newWindowEnd, setNewWindowEnd] = useState('');

  const [activeTab, setActiveTab] = useState<'details' | 'insurance'>('details');

  const filteredRecipients = useMemo(() => {
    if (!userSearch.trim()) return [];
    const q = userSearch.toLowerCase();
    return allUsers.filter(u => 
        u.displayName.toLowerCase().includes(q) || 
        (u.email && u.email.toLowerCase().includes(q))
    ).slice(0, 5);
  }, [allUsers, userSearch]);

  const convertRemoteToDataUrl = async (url: string): Promise<string> => {
      if (!url || url.startsWith('data:')) return url;
      try {
          const response = await fetch(url, { method: 'GET', mode: 'cors', headers: { 'Cache-Control': 'no-cache' } });
          if (!response.ok) throw new Error(`Handshake HTTP ${response.status}`);
          const blob = await response.blob();
          return new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = () => resolve(url);
              reader.readAsDataURL(blob);
          });
      } catch (e: any) { return url; }
  };

  const loadHistory = useCallback(async () => {
    if (currentUser) {
        const data = await getUserChecks(currentUser.uid);
        setHistory(data);
    }
  }, [currentUser]);

  useEffect(() => {
      if (checkIdFromUrl) {
          setIsLoadingCheck(true);
          getCheckById(checkIdFromUrl).then(async (data) => {
              if (data) {
                  // 1. Check Local Sovereign Cache
                  const localCachedSig = await getLocalAsset(`sig_${data.id}`);
                  if (localCachedSig) {
                      setConvertedAssets(prev => ({ ...prev, sig: localCachedSig }));
                  } else {
                      // 2. Resolve Remote Signature for Canvas Handshake
                      const sigPath = data.signatureUrl || data.signature || '';
                      if (sigPath && sigPath.startsWith('http')) {
                          const sigB64 = await convertRemoteToDataUrl(sigPath);
                          setConvertedAssets(prev => ({ ...prev, sig: sigB64 }));
                          if (sigB64.startsWith('data:')) saveLocalAsset(`sig_${data.id}`, sigB64);
                      }
                  }

                  const wmPath = data.watermarkUrl || '';
                  if (data.drivePdfUrl) setShareLink(data.drivePdfUrl);
                  if (wmPath) {
                      const wmB64 = await convertRemoteToDataUrl(wmPath);
                      setConvertedAssets(prev => ({ ...prev, wm: wmB64 }));
                  }
                  setCheck(data);
              }
              setIsLoadingCheck(false);
          });
      } else {
          const freshId = generateSecureId();
          const nextCheckNum = (userProfile?.nextCheckNumber || 1001).toString();
          const initSignature = userProfile?.savedSignatureUrl || '';
          
          if (initSignature) {
              setCheck(prev => ({ ...prev, signature: initSignature }));
              convertRemoteToDataUrl(initSignature).then(b64 => {
                  if (b64) {
                      setConvertedAssets(prev => ({ ...prev, sig: b64 }));
                      if (b64.startsWith('data:')) saveLocalAsset(`sig_${freshId}`, b64);
                  }
              });
          }
          setCheck(prev => ({ ...prev, id: freshId, senderName: userProfile?.displayName || 'Account Holder', checkNumber: nextCheckNum, senderAddress: userProfile?.senderAddress || '' }));
          window.history.replaceState({}, '', `${window.location.origin}${window.location.pathname}?view=check_designer&id=${freshId}`);
      }
      if (currentUser) {
          loadHistory();
          getAllUsers().then(users => setAllUsers(users.filter(u => u.uid !== currentUser.uid)));
      }
  }, [checkIdFromUrl, currentUser, userProfile, loadHistory]);

  useEffect(() => {
    const timer = setTimeout(async () => {
        if (!isReadOnly && currentUser && check.id) {
            try {
                await saveBankingCheck({ ...check, ownerId: currentUser.uid });
                loadHistory();
            } catch(e) { console.error("Auto-sync failed", e); }
        }
    }, 2000);
    return () => clearTimeout(timer);
  }, [check, currentUser, isReadOnly, loadHistory]);

  const qrCodeUrl = useMemo(() => {
      const internalLink = `${window.location.origin}${window.location.pathname}?view=check_viewer&id=${check.id || 'preview'}&mode=view`;
      return `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(internalLink)}`;
  }, [check.id]);

  const handleRefractWords = async () => {
    if (!check.amount) return;
    setIsUpdatingWords(true);
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Refract this currency amount into professional legal words for a check: $${check.amount}. Return ONLY the words, no symbols.`,
            config: { thinkingConfig: { thinkingBudget: 0 } }
        });
        setCheck(prev => ({ ...prev, amountWords: response.text?.trim() || '' }));
        if (currentUser) deductCoins(currentUser.uid, AI_COSTS.TEXT_REFRACTION);
    } catch(e) { console.error(e); } finally { setIsUpdatingWords(false); }
  };

  const handleGenerateWatermark = async () => {
      setIsGeneratingArt(true);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const prompt = `ULTRA HIGH CONTRAST security pattern for a bank check. Use THICK "DEEP NAVY" and "DARK CHARCOAL" geometric meshes. Repeating large fractal patterns, ornate guilloche, very visible dark lines on pure white background. NO TEXT. Style: Professional, Bold, Verifiable.`;
          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash-image',
              contents: prompt,
              config: { imageConfig: { aspectRatio: "16:9" } }
          });
          if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    const b64 = `data:image/png;base64,${part.inlineData.data}`;
                    setCheck(prev => ({ ...prev, watermarkUrl: b64 }));
                    setConvertedAssets(prev => ({ ...prev, wm: b64 }));
                    setIsSynthesisActive(true);
                    setTimeout(() => setIsSynthesisActive(false), 2000);
                    break;
                }
            }
          }
          if (currentUser) deductCoins(currentUser.uid, AI_COSTS.IMAGE_GENERATION);
      } catch (e) { alert("Art synthesis failed."); } finally { setIsGeneratingArt(false); }
  };

  const handleSaveSignature = async (sigB64: string) => {
      setCheck(prev => ({ ...prev, signature: sigB64, signatureUrl: '' }));
      setConvertedAssets(prev => ({ ...prev, sig: sigB64 }));
      saveLocalAsset(`sig_${check.id}`, sigB64);
      
      // PERSIST VECTOR DATA TO PROFILE
      if (currentUser && tempSigData) {
          updateUserProfile(currentUser.uid, { 
              // @ts-ignore
              savedSignatureData: tempSigData 
          }).catch(console.error);
      }
      
      setShowSignPad(false);
      setIsSynthesisActive(true);
      setTimeout(() => setIsSynthesisActive(false), 2000);
  };

  const handleUseProfileSignature = async () => {
      // @ts-ignore - access the draw file JSON
      const vectorData = userProfile?.savedSignatureData;
      const profileSigUrl = userProfile?.savedSignatureUrl;

      if (!vectorData && !profileSigUrl) return;

      setIsSynthesisActive(true);
      try {
          if (vectorData) {
              setTempSigData(vectorData);
          }
          
          if (profileSigUrl) {
              const b64 = await convertRemoteToDataUrl(profileSigUrl);
              if (b64) {
                  const isBase64 = b64.startsWith('data:');
                  setConvertedAssets(prev => ({ ...prev, sig: b64 }));
                  setCheck(prev => ({ 
                    ...prev, 
                    signature: isBase64 ? b64 : '', 
                    signatureUrl: isBase64 ? '' : b64 
                  }));
                  if (isBase64) await saveLocalAsset(`sig_${check.id}`, b64);
              }
          }
      } catch(e: any) {
          console.warn("[Signature Pad] Profile handshake failure.");
      } finally {
          setTimeout(() => setIsSynthesisActive(false), 500);
      }
  };

  const assembleCheckCanvas = async (qrDataUrl: string, resolvedSig: string): Promise<string> => {
      const canvas = document.createElement('canvas');
      canvas.width = 1800; canvas.height = 810; 
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Synthesis Core Failure");
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const loadImage = (src: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
          if (!src) return reject(new Error("Empty Source"));
          const img = new Image();
          if (!src.startsWith('data:')) img.crossOrigin = 'anonymous';
          img.onload = async () => {
              try {
                  if ('decode' in img) await img.decode();
                  resolve(img);
              } catch(e) { resolve(img); }
          };
          img.onerror = () => reject(new Error(`Asset load missed: ${src.substring(0, 40)}...`));
          img.src = src;
      });

      if (convertedAssets.wm) {
          try {
            const wmImg = await loadImage(convertedAssets.wm);
            ctx.save(); 
            ctx.globalAlpha = watermarkOpacity * 0.4; 
            ctx.drawImage(wmImg, 0, 0, canvas.width, canvas.height); 
            ctx.restore();
          } catch(e) { console.warn("Watermark layer skipped", e); }
      }

      ctx.fillStyle = '#000000'; ctx.font = 'bold 36px sans-serif';
      ctx.fillText((check.senderName || 'NEURAL PRISM MEMBER').toUpperCase(), 120, 100);
      ctx.font = '24px sans-serif';
      ctx.fillText((userProfile?.senderAddress || 'REGISTERED LEDGER ADDRESS').toUpperCase(), 120, 140);
      ctx.font = 'bold 30px sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(check.checkNumber, 1680, 80); ctx.fillText(check.date, 1680, 140);
      ctx.textAlign = 'left'; ctx.font = 'italic bold 30px sans-serif';
      ctx.fillText(check.bankName.toUpperCase(), 120, 200);
      
      ctx.font = 'bold 24px sans-serif'; ctx.fillText("PAY TO THE ORDER OF", 120, 370);
      ctx.font = 'italic 54px serif'; ctx.fillText(check.payee || "___________________", 480, 370);
      ctx.lineWidth = 6; ctx.strokeRect(1440, 310, 300, 100);
      ctx.font = 'bold 48px monospace'; ctx.fillText("$", 1460, 375);
      ctx.textAlign = 'right'; ctx.fillText(check.amount.toLocaleString(undefined, { minimumFractionDigits: 2 }), 1720, 375);
      
      ctx.textAlign = 'left'; ctx.font = 'italic bold 30px serif';
      ctx.fillText((check.amountWords || "___________________").toUpperCase(), 120, 470);
      ctx.font = 'bold 24px sans-serif'; ctx.fillText("DOLLARS", 1600, 470);
      
      ctx.font = 'bold 24px sans-serif'; ctx.fillText("MEMO", 120, 680);
      ctx.font = '24px sans-serif'; ctx.fillText(check.memo, 220, 680);
      ctx.beginPath(); ctx.moveTo(220, 690); ctx.lineTo(700, 690); ctx.stroke();
      ctx.textAlign = 'center'; ctx.font = 'bold 20px sans-serif';
      ctx.fillText("AUTHORIZED SIGNATURE", 1440, 720);
      ctx.beginPath(); ctx.moveTo(1170, 690); ctx.lineTo(1710, 690); ctx.stroke();
      
      const sigToDraw = resolvedSig || convertedAssets.sig || check.signature || '';
      if (sigToDraw) {
          try { 
              const sigImg = await loadImage(sigToDraw); 
              ctx.drawImage(sigImg, 1170, 580, 540, 110); 
          } catch(e) { console.error("[Canvas Assembly] Signature bake failed:", e); }
      }

      try { const qrImg = await loadImage(qrDataUrl); ctx.drawImage(qrImg, 750, 40, 300, 300); } catch(e) {}
      ctx.font = 'bold 36px monospace'; ctx.textAlign = 'center';
      ctx.fillText(`⑆ ${check.routingNumber} ⑈ ${check.accountNumber} ⑈ ${check.checkNumber}`, 900, 780);
      
      return canvas.toDataURL('image/png');
  };

  const handleIssueAsset = async () => {
    if (!check.payee || !check.amount) return alert("Please fill in Recipient and Amount.");
    setIsIssuing(true);
    try {
        const id = check.id || generateSecureId();
        const internalLink = `${window.location.origin}${window.location.pathname}?view=check_viewer&id=${id}&mode=view`;
        
        const qrDataUrl = await convertRemoteToDataUrl(qrCodeUrl);
        const signatureSource = convertedAssets.sig || check.signature || check.signatureUrl || userProfile?.savedSignatureUrl || '';
        const resolvedSig = await convertRemoteToDataUrl(signatureSource);
        setQrLocalUrl(qrDataUrl);

        if (resolvedSig && resolvedSig.startsWith('data:')) {
            setConvertedAssets(prev => ({ ...prev, sig: resolvedSig }));
            await saveLocalAsset(`sig_${id}`, resolvedSig);
        }
        
        const assembledImageB64 = await assembleCheckCanvas(qrDataUrl, resolvedSig);
        const finalizedCheck = { ...check, id, isVerified: true, ownerId: currentUser?.uid || 'guest' };
        
        if (currentUser) {
            try {
                const rasterBlob = await (await fetch(assembledImageB64)).blob();
                finalizedCheck.checkImageUrl = await uploadFileToStorage(`checks/${id}/assembled_raster.png`, rasterBlob);
                if (resolvedSig && resolvedSig.startsWith('data:')) {
                    const sigBlob = await (await fetch(resolvedSig)).blob();
                    finalizedCheck.signatureUrl = await uploadFileToStorage(`checks/${id}/sig_${generateSecureId().substring(0,8)}.png`, sigBlob);
                    finalizedCheck.signature = ''; 
                } else if (finalizedCheck.signatureUrl) {
                    finalizedCheck.signature = '';
                }
            } catch (storageErr) {}
        }

        const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [600, 270] });
        pdf.addImage(assembledImageB64, 'PNG', 0, 0, 600, 270);
        const pdfBlob = pdf.output('blob');

        try {
            const token = getDriveToken() || await connectGoogleDrive();
            if (token) {
                const root = await ensureCodeStudioFolder(token);
                const folder = await ensureFolder(token, 'Checks', root);
                const driveFileId = await uploadToDrive(token, folder, `Asset_${check.checkNumber}.pdf`, pdfBlob);
                finalizedCheck.drivePdfUrl = await getDriveFileSharingLink(token, driveFileId);
            }
        } catch (driveErr: any) {}

        await saveBankingCheck(finalizedCheck);
        if (currentUser) await calculateUserTrustScore(currentUser.uid);
        
        const nextNum = (parseInt(check.checkNumber) || 0) + 1;
        if (userProfile) updateUserProfile(userProfile.uid, { nextCheckNumber: nextNum });
        
        setCheck(finalizedCheck);
        pdf.save(`Check_${check.checkNumber}.pdf`);
        setShareLink(finalizedCheck.drivePdfUrl || internalLink);
        setShowShareModal(true);
        loadHistory();
    } catch(e: any) { 
        alert("Issuance failed: " + e.message); 
    } finally { 
        setIsIssuing(false); 
        setQrLocalUrl(null); 
    }
  };

  const handleNewCheck = () => {
    const newId = generateSecureId();
    const initSignature = userProfile?.savedSignatureUrl || '';
    if (initSignature) {
        setCheck({ ...DEFAULT_CHECK, signature: initSignature, id: newId, senderName: userProfile?.displayName || 'Account Holder', checkNumber: (userProfile?.nextCheckNumber || 1001).toString(), senderAddress: userProfile?.senderAddress || '' });
        convertRemoteToDataUrl(initSignature).then(b64 => { 
            if (b64) {
                setConvertedAssets(prev => ({ ...prev, sig: b64 }));
                if (b64.startsWith('data:')) saveLocalAsset(`sig_${newId}`, b64);
            } 
        });
    } else {
        setCheck({ ...DEFAULT_CHECK, id: newId, senderName: userProfile?.displayName || 'Account Holder', checkNumber: (userProfile?.nextCheckNumber || 1001).toString(), senderAddress: userProfile?.senderAddress || '' });
        setConvertedAssets({});
    }
    setShareLink(null);
    window.history.pushState({}, '', `${window.location.origin}${window.location.pathname}?view=check_designer&id=${newId}`);
  };

  const handleCloneCheck = () => {
      const newId = generateSecureId();
      const currentNum = parseInt(check.checkNumber) || 0;
      const nextNum = (currentNum + 1).toString().padStart(check.checkNumber.length, '0');
      const sigToKeep = check.signature || convertedAssets.sig || userProfile?.savedSignatureUrl || '';

      setCheck(prev => ({ 
        ...prev, 
        id: newId, 
        checkNumber: nextNum, 
        isVerified: false, 
        drivePdfUrl: undefined, 
        signature: sigToKeep, 
        signatureUrl: '' 
      }));
      if (sigToKeep.startsWith('data:')) saveLocalAsset(`sig_${newId}`, sigToKeep);
      setShareLink(null);
      window.history.pushState({}, '', `${window.location.origin}${window.location.pathname}?view=check_designer&id=${newId}`);
  };

  const handleSwitchToId = (id: string) => {
      const url = new URL(window.location.href);
      url.searchParams.set('id', id); url.searchParams.delete('mode');
      window.location.assign(url.toString());
  };

  const handleAddWindow = () => {
      if (!newWindowStart || !newWindowEnd) return;
      const start = new Date(newWindowStart).getTime();
      const end = new Date(newWindowEnd).getTime();
      if (end <= start) return alert("End time must be after start time.");

      setCheck(prev => ({
          ...prev,
          insurancePolicy: {
              ...prev.insurancePolicy!,
              validWindows: [...(prev.insurancePolicy?.validWindows || []), { start, end }]
          }
      }));
      setNewWindowStart('');
      setNewWindowEnd('');
  };

  const handleRemoveWindow = (idx: number) => {
      setCheck(prev => ({
          ...prev,
          insurancePolicy: {
              ...prev.insurancePolicy!,
              validWindows: (prev.insurancePolicy?.validWindows || []).filter((_, i) => i !== idx)
          }
      }));
  };

  if (isLoadingCheck) return <div className="h-screen bg-slate-950 flex flex-col items-center justify-center gap-4"><Loader2 className="animate-spin text-indigo-500" size={40} /><span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Paging Asset Archive...</span></div>;

  const currentSignatureDisplay = convertedAssets.sig || check.signatureUrl || check.signature || '';
  const isSigResolved = currentSignatureDisplay?.startsWith('data:');

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden relative font-sans">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-20">
          <div className="flex items-center gap-4">
              <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"><ArrowLeft size={20} /></button>
              <h1 className="text-lg font-bold text-white flex items-center gap-2"><Wallet className="text-indigo-400" /> {isReadOnly ? 'Asset Viewer' : 'Finance Lab'}</h1>
              <button onClick={() => setShowManual(true)} className="p-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded-lg transition-colors border border-slate-700" title="Usage Guide"><BookOpen size={18}/></button>
              <button onClick={() => setShowHistory(true)} className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg transition-colors border border-slate-700" title="Registry History"><History size={18}/></button>
          </div>
          <div className="flex items-center gap-3">
              {!isReadOnly && (
                  <>
                      <button onClick={handleNewCheck} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-black uppercase border border-slate-700 transition-all flex items-center gap-2"><FilePlus size={14}/> <span>New</span></button>
                      <button onClick={handleCloneCheck} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-black uppercase border border-slate-700 transition-all flex items-center gap-2"><CopyPlus size={14}/> <span>Clone</span></button>
                      <div className="w-px h-6 bg-slate-800 mx-1"></div>
                      <button onClick={handleIssueAsset} disabled={isIssuing} className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-black uppercase tracking-widest shadow-lg transition-all active:scale-95">
                          {isIssuing ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>}
                          <span>Issue Asset</span>
                      </button>
                  </>
              )}
          </div>
      </header>

      <div className="flex-1 flex overflow-hidden flex-col lg:flex-row">
          {!isReadOnly && (
              <div className="w-full lg:w-[450px] border-r border-slate-800 bg-slate-900/30 flex flex-col shrink-0 overflow-y-auto p-6 space-y-8 scrollbar-thin">
                  <div className="flex p-1 bg-slate-950 rounded-2xl border border-slate-800">
                      <button onClick={() => setActiveTab('details')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === 'details' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-50'}`}>Check Details</button>
                      <button onClick={() => setActiveTab('insurance')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === 'insurance' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-50'}`}>Neural Insurance</button>
                  </div>
                  {activeTab === 'details' ? (
                      <div className="space-y-6 animate-fade-in">
                          <div className="space-y-4">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block px-1">Recipient Info</label>
                              <div className="relative">
                                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={12}/>
                                  <input type="text" placeholder="Search members..." value={userSearch} onChange={e => setUserSearch(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none"/>
                                  {filteredRecipients.length > 0 && (
                                      <div className="absolute top-full left-0 w-full bg-slate-800 border border-slate-700 rounded-xl mt-1 shadow-2xl z-20 overflow-hidden divide-y divide-slate-700">
                                          {filteredRecipients.map(r => (
                                              <button key={r.uid} onClick={() => { setCheck({...check, payee: r.displayName}); setUserSearch(''); }} className="w-full text-left px-4 py-3 hover:bg-slate-700 flex items-center gap-3 transition-colors">
                                                  <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-bold">{r.displayName[0]}</div>
                                                  <span className="text-xs text-white">@{r.displayName}</span>
                                              </button>
                                          ))}
                                      </div>
                                  )}
                              </div>
                              <input type="text" value={check.payee} onChange={e => setCheck({...check, payee: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none shadow-inner" placeholder="Pay to the order of..."/>
                          </div>
                          <div className="space-y-4">
                              <div className="flex justify-between items-center px-1">
                                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Amount Refraction</label>
                                  <button onClick={handleRefractWords} disabled={isUpdatingWords || !check.amount} className="text-[9px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1 hover:text-white transition-all">
                                      {isUpdatingWords ? <Loader2 size={10} className="animate-spin"/> : <Sparkles size={10}/>}
                                      Magic Words
                                  </button>
                              </div>
                              <div className="flex bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-inner">
                                  <input type="number" value={check.amount || ''} onChange={e => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setCheck({...check, amount: val, amountWords: numberToWords(val)});
                                  }} className="w-full bg-transparent px-4 py-3 text-white text-lg font-black outline-none" placeholder="0.00"/>
                                  <div className="bg-slate-800 p-3 text-indigo-400"><DollarSign size={20}/></div>
                              </div>
                              <textarea value={check.amountWords} onChange={e => setCheck({...check, amountWords: e.target.value})} rows={2} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-[10px] font-medium text-slate-400 italic resize-none outline-none shadow-inner" placeholder="Numerical words..."/>
                          </div>
                          <div className="space-y-4">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Banking Tokens</label>
                              <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                      <label className="text-[9px] font-bold text-slate-600 uppercase ml-1">Routing Number</label>
                                      <input type="text" value={check.routingNumber} onChange={e => setCheck({...check, routingNumber: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-indigo-300 outline-none font-mono focus:ring-1 focus:ring-indigo-500 shadow-inner"/>
                                  </div>
                                  <div className="space-y-2">
                                      <label className="text-[9px] font-bold text-slate-600 uppercase ml-1">Account Number</label>
                                      <input type="text" value={check.accountNumber} onChange={e => setCheck({...check, accountNumber: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-indigo-300 outline-none font-mono focus:ring-1 focus:ring-indigo-500 shadow-inner"/>
                                  </div>
                              </div>
                          </div>
                          <div className="space-y-4">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Memo</label>
                              <input type="text" value={check.memo} onChange={e => setCheck({...check, memo: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none shadow-inner" placeholder="For: Business Services"/>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                  <label className="text-[10px] font-black text-slate-500 uppercase px-1">Issue Date</label>
                                  <input type="date" value={check.date} onChange={e => setCheck({...check, date: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white outline-none"/>
                              </div>
                              <div className="space-y-2">
                                  <label className="text-[10px] font-black text-slate-500 uppercase px-1">Check Number</label>
                                  <input type="text" value={check.checkNumber} onChange={e => setCheck({...check, checkNumber: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white outline-none font-mono"/>
                              </div>
                          </div>
                      </div>
                  ) : (
                      <div className="space-y-6 animate-fade-in">
                          <div className="p-4 bg-amber-900/10 border border-amber-500/20 rounded-2xl flex items-start gap-4">
                              <Shield className="text-amber-500 mt-1" size={24}/>
                              <div>
                                  <h3 className="font-bold text-white text-sm">Temporal Liquidity Protocol</h3>
                                  <p className="text-[10px] text-slate-400 leading-relaxed mt-1">Locks this asset to specific offline windows. Claims are verified against the neural ledger.</p>
                              </div>
                          </div>
                          
                          <div className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                               <div><p className="text-sm font-bold text-white">Enable Insurance</p></div>
                               <button onClick={() => setCheck({...check, isInsured: !check.isInsured})} className={`w-12 h-6 rounded-full transition-all relative ${check.isInsured ? 'bg-amber-500' : 'bg-slate-700'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${check.isInsured ? 'right-1' : 'left-1'}`}></div></button>
                          </div>

                          {check.isInsured && (
                              <div className="space-y-6 animate-fade-in-up">
                                  <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                          <label className="text-[10px] font-black text-slate-500 uppercase px-1 flex items-center gap-1"><TrendingUp size={12} className="text-emerald-400"/> Gain / Sec</label>
                                          <input 
                                            type="number" 
                                            step="0.01" 
                                            value={check.insurancePolicy?.amountPerSecond || 0} 
                                            onChange={e => setCheck({...check, insurancePolicy: { ...check.insurancePolicy!, amountPerSecond: parseFloat(e.target.value) || 0 }})} 
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-emerald-400 outline-none"
                                          />
                                      </div>
                                      <div className="space-y-2">
                                          <label className="text-[10px] font-black text-slate-500 uppercase px-1 flex items-center gap-1"><Maximize2 size={12} className="text-indigo-400"/> Max Cap</label>
                                          <input 
                                            type="number" 
                                            value={check.insurancePolicy?.maxAmount || 0} 
                                            onChange={e => setCheck({...check, insurancePolicy: { ...check.insurancePolicy!, maxAmount: parseFloat(e.target.value) || 0 }})} 
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-indigo-400 outline-none"
                                          />
                                      </div>
                                  </div>

                                  <div className="space-y-4">
                                      <label className="text-[10px] font-black text-slate-500 uppercase px-1 flex items-center gap-1"><Timer size={14} className="text-amber-500"/> Temporal Windows</label>
                                      <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-4">
                                          <div className="grid grid-cols-2 gap-2">
                                              <div className="space-y-1">
                                                  <span className="text-[8px] font-black text-slate-600 uppercase ml-1">Start Time</span>
                                                  <input type="datetime-local" value={newWindowStart} onChange={e => setNewWindowStart(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-[10px] text-white outline-none"/>
                                              </div>
                                              <div className="space-y-1">
                                                  <span className="text-[8px] font-black text-slate-600 uppercase ml-1">End Time</span>
                                                  <input type="datetime-local" value={newWindowEnd} onChange={e => setNewWindowEnd(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-[10px] text-white outline-none"/>
                                              </div>
                                          </div>
                                          <button onClick={handleAddWindow} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">Add Window</button>
                                      </div>
                                      
                                      <div className="space-y-2">
                                          {check.insurancePolicy?.validWindows.map((win, idx) => (
                                              <div key={idx} className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl">
                                                  <div className="flex items-center gap-3">
                                                      <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                                                      <div className="text-[9px]">
                                                          <p className="text-slate-300 font-bold uppercase">{new Date(win.start).toLocaleString()}</p>
                                                          <p className="text-slate-500 uppercase">{new Date(win.end).toLocaleString()}</p>
                                                      </div>
                                                  </div>
                                                  <button onClick={() => handleRemoveWindow(idx)} className="p-1.5 text-slate-600 hover:text-red-400 transition-colors"><X size={14}/></button>
                                              </div>
                                          ))}
                                      </div>
                                  </div>

                                  <div className="space-y-2">
                                      <label className="text-[10px] font-black text-slate-500 uppercase px-1">Target Recipient (UID Lock)</label>
                                      <input 
                                        type="text" 
                                        value={check.insurancePolicy?.recipientUid || ''} 
                                        onChange={e => setCheck({...check, insurancePolicy: { ...check.insurancePolicy!, recipientUid: e.target.value }})} 
                                        placeholder="Optional: Enter member UID to lock claim"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white outline-none"
                                      />
                                  </div>
                              </div>
                          )}
                      </div>
                  )}
                  <div className="space-y-4 pt-4 border-t border-slate-800">
                      <div className="flex justify-between items-center px-1">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Security Synthesis</label>
                          <button onClick={handleGenerateWatermark} disabled={isGeneratingArt} className="text-[9px] font-black text-pink-400 uppercase tracking-widest flex items-center gap-1 hover:text-white transition-all">
                              {isGeneratingArt ? <Loader2 size={10} className="animate-spin"/> : <Sparkles size={10}/>} Art Watermark
                          </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => setShowSignPad(true)} className="flex items-center justify-center gap-2 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-all shadow-sm"><PenTool size={16}/> Sign Check</button>
                          <div className="bg-slate-950 border border-slate-800 rounded-xl flex flex-col items-center justify-center overflow-hidden relative group min-h-[50px]">
                               {isGeneratingArt ? (
                                   <div className="flex flex-col items-center gap-1 animate-pulse"><Loader2 size={12} className="animate-spin text-indigo-500" /><span className="text-[8px] font-black text-indigo-400 uppercase">Synthesizing...</span></div>
                               ) : convertedAssets.wm ? (
                                   <div className="w-full h-full relative group/wm">
                                      <img src={convertedAssets.wm} className="w-full h-full object-cover transition-transform group-hover/wm:scale-150" />
                                      <button onClick={handleGenerateWatermark} className="absolute inset-0 bg-indigo-600/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"><RefreshCw size={14}/></button>
                                   </div>
                               ) : (<div className="text-[8px] font-black text-slate-700 uppercase">No Pattern</div>)}
                          </div>
                      </div>
                  </div>
              </div>
          )}

          <div className="flex-1 bg-slate-950 flex flex-col p-8 items-center justify-center overflow-y-auto scrollbar-hide relative">
              <div className="relative group perspective">
                {check.isVerified && check.checkImageUrl ? (
                    /* 
                       BAKED IMAGE PRIORITY (Safari/Mobile Fix)
                       When issued, we show the single synchronous PNG. 
                       This guarantees all layers (Signature, Watermark, QR) are visible.
                    */
                    <div 
                        style={{ transform: `scale(${zoom})`, width: '600px', height: '270px' }}
                        className="rounded-lg shadow-2xl overflow-hidden border border-slate-800 animate-fade-in relative group/check-img"
                    >
                        <img 
                            src={check.checkImageUrl} 
                            className="w-full h-full object-cover" 
                            alt={`Issued Check #${check.checkNumber}`}
                            referrerPolicy="no-referrer"
                        />
                        {check.isInsured && (
                            <div className="absolute top-4 right-4 bg-amber-500 text-white px-2 py-1 rounded text-[8px] font-black uppercase shadow-lg border border-white/20 z-10 flex items-center gap-1">
                                <Shield size={10} fill="white"/> Insured
                            </div>
                        )}
                    </div>
                ) : (
                    /* INTERACTIVE DRAFT MODE */
                    <div 
                        ref={checkRef}
                        style={{ transform: `scale(${zoom})`, width: '600px', height: '270px' }} 
                        className={`check-container bg-white text-black pt-10 px-10 pb-6 rounded-lg shadow-2xl relative border border-slate-300 shrink-0 select-none overflow-hidden flex flex-col transition-all duration-500`}
                    >
                        {convertedAssets.wm && (
                            <div 
                                className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none transition-all duration-500" 
                                style={{ opacity: watermarkOpacity, mixBlendMode: 'multiply', filter: highContrastMode ? 'contrast(180%)' : 'none' }}
                            >
                                <img src={convertedAssets.wm} className="w-full h-full object-cover" />
                            </div>
                        )}
                        {check.isInsured && (
                            <div className="absolute top-4 right-4 bg-amber-500 text-white px-2 py-1 rounded text-[8px] font-black uppercase shadow-lg border border-white/20 z-20 flex items-center gap-1 animate-pulse">
                                <Shield size={10} fill="white"/> Neural Insurance Active
                            </div>
                        )}
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20">
                            <div className="p-2 bg-white border border-black rounded-xl shadow-xl"><img src={qrLocalUrl || qrCodeUrl} className="w-24 h-24" alt="QR" /></div>
                        </div>
                        <div className="relative z-10 flex justify-between items-start">
                            <div className="space-y-0.5"><h2 className="text-sm font-black uppercase tracking-tight">{check.senderName || 'NEURAL PRISM MEMBER'}</h2><p className="text-[8px] text-slate-600 leading-tight max-w-[200px] uppercase font-bold">{userProfile?.senderAddress || 'REGISTERED LEDGER ADDRESS'}</p></div>
                            <div className="text-right"><p className="text-[10px] font-black uppercase mb-1">{check.checkNumber}</p><div className="inline-flex border-b-2 border-black px-4 py-0.5"><span className="text-[10px] font-mono font-bold">{check.date}</span></div></div>
                        </div>
                        <div className="relative z-10 mt-6 flex items-end gap-3">
                            <span className="text-[9px] font-black uppercase tracking-wider mb-1 whitespace-nowrap">Pay to the Order of</span>
                            <div className="flex-1 border-b border-black text-xl font-serif italic pb-1 min-w-0 truncate">{check.payee || '________________________________'}</div>
                            <div className="flex items-center bg-slate-50 border-2 border-black p-1.5 min-w-[120px] shadow-sm"><span className="text-lg font-bold mr-1">$</span><span className="flex-1 text-right text-xl font-mono font-black">{check.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                        </div>
                        <div className="relative z-10 mt-2 flex items-end gap-3">
                            <div className="flex-1 border-b border-black text-[11px] font-serif italic pb-1 uppercase tracking-tight">{check.amountWords || '____________________________________________________________________'}</div>
                            <span className="text-[10px] font-black uppercase mb-1">Dollars</span>
                        </div>
                        <div className="relative z-10 mt-auto flex justify-between items-end pb-1"><div className="flex items-end gap-2"><span className="text-[8px] font-bold uppercase">Memo</span><div className="w-48 border-b border-black text-[10px] pb-0.5 px-1 truncate">{check.memo}</div></div>
                            <div onClick={() => !isReadOnly && setShowSignPad(true)} className="relative w-56 flex flex-col items-center group/sigzone">
                                {currentSignatureDisplay && (
                                    <div className="absolute -top-1 -right-2 z-30" title={isSigResolved ? "Asset Resolved Locally" : "Remote Link (Standard Browser Rendering)"}>
                                        <div className={`w-2 h-2 rounded-full ${isSigResolved ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'}`}></div>
                                    </div>
                                )}
                                
                                {currentSignatureDisplay ? (
                                    <img 
                                        src={currentSignatureDisplay} 
                                        className="absolute bottom-4 w-full h-12 object-contain" 
                                        referrerPolicy="no-referrer"
                                    />
                                ) : (
                                    !isReadOnly && <div className="absolute bottom-4 inset-x-0 h-12 flex items-center justify-center text-slate-300"><PenTool size={16} /></div>
                                )}
                                <div className="w-full border-b-2 border-black"></div><span className="text-[8px] font-black uppercase tracking-widest mt-1">Authorized Signature</span>
                            </div>
                        </div>
                        <div className="absolute bottom-2 left-10 right-10 flex justify-between items-end pointer-events-none">
                            <div className="font-mono text-[12px] tracking-[0.4em] tubular-nums leading-none text-black">⑆ {check.routingNumber} ⑈ {check.accountNumber} ⑈ {check.checkNumber}</div>
                        </div>
                    </div>
                )}

                {/* Insurance Validity Banner in Viewer Mode */}
                {isReadOnly && check.isInsured && check.insurancePolicy && (
                    <div className="mt-8 w-full max-w-lg bg-amber-900/10 border border-amber-500/30 rounded-2xl p-6 shadow-2xl animate-fade-in-up">
                        <div className="flex items-center gap-3 mb-4">
                            <Shield className="text-amber-500" size={20}/>
                            <h3 className="font-bold text-white uppercase tracking-widest text-sm">Neural Insurance Ledger</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase font-black">Streaming Rate</p>
                                <p className="text-lg font-black text-emerald-400">{check.insurancePolicy.amountPerSecond} VC/Sec</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase font-black">Max Claim Cap</p>
                                <p className="text-lg font-black text-indigo-400">{check.insurancePolicy.maxAmount} VC</p>
                            </div>
                        </div>
                        <div className="mt-6 space-y-2">
                             <p className="text-[10px] text-slate-500 uppercase font-black px-1">Valid Temporal Windows</p>
                             {check.insurancePolicy.validWindows.length === 0 ? (
                                 <p className="text-xs text-slate-600 italic px-1">No time restrictions defined.</p>
                             ) : (
                                 check.insurancePolicy.validWindows.map((win, idx) => (
                                     <div key={idx} className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex items-center justify-between">
                                         <div className="flex items-center gap-2">
                                             <Clock size={12} className="text-amber-500"/>
                                             <div className="text-[9px]">
                                                 <p className="text-slate-300 font-bold uppercase">{new Date(win.start).toLocaleString()}</p>
                                                 <p className="text-slate-500 uppercase">Ends: {new Date(win.end).toLocaleString()}</p>
                                             </div>
                                         </div>
                                         <div className="text-[8px] font-black text-emerald-500 uppercase tracking-tighter">Verified</div>
                                     </div>
                                 ))
                             )}
                        </div>
                    </div>
                )}
              </div>
          </div>
      </div>
      {showSignPad && (
          <div className="fixed inset-0 z-[150] bg-slate-950/95 flex items-center justify-center p-6 animate-fade-in">
              <div className="w-full max-w-2xl bg-white rounded-3xl overflow-hidden shadow-2xl border-8 border-indigo-600">
                  <div className="p-6 bg-indigo-600 flex justify-between items-center"><h3 className="text-white font-black uppercase tracking-widest flex items-center gap-2"><PenTool size={20}/> Signature Pad</h3><button onClick={() => setShowSignPad(false)} className="text-white/60 hover:text-white transition-colors"><X size={24}/></button></div>
                  <div className="h-64 bg-white relative">
                    <Whiteboard 
                        backgroundColor="#ffffff" 
                        initialColor="#000000" 
                        onChange={(json) => setTempSigData(json)} 
                        onBack={() => setShowSignPad(false)}
                        initialContent={tempSigData}
                    />
                  </div>
                  <div className="p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
                      <div className="flex flex-col gap-2">
                        {userProfile?.savedSignatureUrl && <button onClick={handleUseProfileSignature} className="text-[10px] font-black text-indigo-600 uppercase flex items-center gap-1.5"><UserCheck size={14}/> Use Profile Sig</button>}
                      </div>
                      <div className="flex gap-2"><button onClick={() => setShowSignPad(false)} className="px-6 py-2 text-sm font-bold text-slate-400">Cancel</button><button onClick={() => { const canvas = document.getElementById('whiteboard-canvas-core') as HTMLCanvasElement; if (canvas) handleSaveSignature(canvas.toDataURL()); }} className="px-8 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg">Adopt</button></div>
                  </div>
              </div>
          </div>
      )}
      {showManual && (
          <div className="fixed inset-0 z-[150] bg-slate-950/95 flex items-center justify-center p-4 animate-fade-in"><div className="w-full max-w-4xl bg-white rounded-[2.5rem] overflow-hidden flex flex-col h-full max-h-[90vh]"><div className="p-6 bg-indigo-600 flex justify-between items-center"><h3 className="text-white font-black uppercase flex items-center gap-2">< BookOpen size={20}/> Manual</h3><button onClick={() => setShowManual(false)} className="text-white/60 hover:text-white transition-colors"><X size={24}/></button></div><div className="flex-1 overflow-y-auto"><MarkdownView content={FINANCE_LAB_MANUAL} initialTheme="light" /></div></div></div>
      )}
      {showHistory && (
        <div className="fixed inset-0 z-[150] bg-slate-950/95 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-[2.5rem] overflow-hidden flex flex-col h-full max-h-[90vh]">
            <div className="p-6 bg-indigo-600 flex justify-between items-center"><h3 className="text-white font-black uppercase flex items-center gap-2"><History size={20}/> Assets Registry</h3><button onClick={() => setShowHistory(false)} className="text-white/60 hover:text-white transition-colors"><X size={24}/></button></div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {history.length === 0 ? (<div className="py-20 text-center text-slate-600 italic">No assets found in ledger.</div>) : (
                history.map(h => (
                  <div key={h.id} onClick={() => { handleSwitchToId(h.id); setShowHistory(false); }} className="bg-slate-950 border border-slate-800 p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:border-indigo-500/50 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-indigo-900/30 text-indigo-400 rounded-xl"><Wallet size={20}/></div>
                      <div><p className="text-sm font-bold text-white">#{h.checkNumber} - {h.payee}</p><p className="text-[10px] text-slate-500 font-mono">{h.date}</p></div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-indigo-400">${h.amount.toLocaleString()}</p>
                      {h.isVerified && <span className="text-[8px] bg-emerald-900/30 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30 uppercase font-black">Verified</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {showShareModal && (<ShareModal isOpen={true} onClose={() => setShowShareModal(false)} link={shareLink || ''} title={`Check #${check.checkNumber}`} onShare={async () => {}} />)}
    </div>
  );
};

export default CheckDesigner;