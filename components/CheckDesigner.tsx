
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  ArrowLeft, Wallet, Save, Download, Sparkles, Loader2, User, Hash, QrCode, Mail, 
  Trash2, Printer, CheckCircle, AlertTriangle, Send, Share2, DollarSign, Calendar, 
  Landmark, Info, Search, Edit3, RefreshCw, ShieldAlert, X, ChevronRight, ImageIcon, Link, Coins, Check as CheckIcon, Palette, Copy, ZoomIn, ZoomOut, Maximize2, PenTool, Upload, Camera, MapPin, HardDrive, List, FileText, Plus, ShieldCheck, Lock
} from 'lucide-react';
import { BankingCheck, UserProfile } from '../types';
import { GoogleGenAI } from "@google/genai";
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { getAllUsers, sendMessage, uploadFileToStorage, saveBankingCheck, claimCoinCheck, getCheckById, updateUserProfile, getUserChecks, deleteCheck } from '../services/firestoreService';
import { auth } from '../services/firebaseConfig';
import { Whiteboard } from './Whiteboard';
import { generateSecureId } from '../utils/idUtils';
import { ShareModal } from './ShareModal';
import { connectGoogleDrive, getDriveToken } from '../services/authService';
import { ensureFolder, uploadToDrive, makeFilePubliclyViewable, getDriveFileSharingLink } from '../services/googleDriveService';

interface CheckDesignerProps {
  onBack: () => void;
  currentUser: any;
  userProfile?: UserProfile | null;
  isProMember?: boolean;
}

const DUMMY_ADDRESSES = [
    "888 Infinite Loop, Digital City, CP 10101",
    "42 Galaxy Way, Sector 7G, Mars",
    "101 Binary Boulevard, Silicon Valley, CA 94025",
    "777 Quantum Lane, Neo Tokyo, JP",
    "555 Ether Street, Decentralized Park, NY 10001"
];

const DEFAULT_CHECK: BankingCheck = {
  id: '', payee: '', amount: 0, amountWords: '', date: new Date().toISOString().split('T')[0],
  memo: 'General Payment', checkNumber: '1001', routingNumber: '123456789', accountNumber: '987654321',
  bankName: 'Neural Prism Bank', senderName: 'Account Holder', senderAddress: '', signature: '', isCoinCheck: false, coinAmount: 0
};

export const CheckDesigner: React.FC<CheckDesignerProps> = ({ onBack, currentUser, userProfile, isProMember }) => {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const isReadOnly = params.get('mode') === 'view' || params.get('view') === 'check_viewer';
  
  if (!isReadOnly && isProMember === false) {
    return (
        <div className="h-full flex items-center justify-center p-6 bg-slate-950">
            <div className="max-w-md w-full bg-slate-900 border border-indigo-500/30 rounded-[3rem] p-12 text-center shadow-2xl">
                <Lock size={48} className="text-indigo-400 mx-auto mb-6" />
                <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-4">Pro Access Required</h2>
                <p className="text-slate-400 text-sm mb-10 font-medium">Neural Finance Lab requires an active Pro Membership to design and verify financial assets.</p>
                <button onClick={onBack} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest rounded-2xl transition-all">Back to Hub</button>
            </div>
        </div>
    );
  }

  const checkIdFromUrl = params.get('id');
  const [check, setCheck] = useState<BankingCheck>(DEFAULT_CHECK);
  const [convertedAssets, setConvertedAssets] = useState<Record<string, string>>({});
  const [isUpdatingWords, setIsUpdatingWords] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isGeneratingArt, setIsGeneratingArt] = useState(false);
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

  const convertRemoteToDataUrl = async (url: string): Promise<string> => {
      if (!url || !url.startsWith('http')) return url;
      try {
          const res = await fetch(url, { mode: 'cors' });
          const blob = await res.blob();
          return new Promise(r => { const reader = new FileReader(); reader.onloadend = () => r(reader.result as string); reader.readAsDataURL(blob); });
      } catch (e) { return url; }
  };

  useEffect(() => {
      if (checkIdFromUrl) {
          setIsLoadingCheck(true);
          getCheckById(checkIdFromUrl).then(async (data) => {
              if (data) {
                  const sigUrl = data.signatureUrl || data.signature || '';
                  const wmUrl = data.watermarkUrl || '';
                  if (data.drivePdfUrl) setShareLink(data.drivePdfUrl);
                  const [sigB64, wmB64] = await Promise.all([convertRemoteToDataUrl(sigUrl), convertRemoteToDataUrl(wmUrl)]);
                  setConvertedAssets({ sig: sigB64, wm: wmB64 });
                  setCheck({ ...DEFAULT_CHECK, ...data });
              }
              setIsLoadingCheck(false);
          });
      } else if (userProfile) {
          setCheck(prev => ({ ...prev, senderName: currentUser?.displayName || prev.senderName, checkNumber: (userProfile.nextCheckNumber || 1001).toString() }));
      }
  }, [checkIdFromUrl, userProfile, currentUser]);

  const qrCodeUrl = useMemo(() => {
      const baseUri = shareLink || `${window.location.origin}?view=check_viewer&id=${check.id || 'preview'}`;
      return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(baseUri)}`;
  }, [shareLink, check.id]);

  const handleDownloadPDF = async () => {
    if (!checkRef.current) return;
    setIsExporting(true);
    try {
        const canvas = await html2canvas(checkRef.current, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [600, 270] });
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 600, 270);
        pdf.save(`check_${check.checkNumber}.pdf`);
    } finally { setIsExporting(false); }
  };

  if (isLoadingCheck) return <div className="h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={40} /></div>;

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden relative">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-20">
          <div className="flex items-center gap-4"><button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"><ArrowLeft size={20} /></button><h1 className="text-lg font-bold text-white flex items-center gap-2"><Wallet className="text-indigo-400" />{isReadOnly ? 'Neural Check Viewer' : 'Neural Check Lab'}</h1></div>
          <div className="flex items-center gap-3">
              {!isReadOnly && <button onClick={handleDownloadPDF} disabled={isExporting} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold">{isExporting ? <Loader2 size={14} className="animate-spin"/> : 'Download PDF'}</button>}
          </div>
      </header>
      <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center overflow-auto p-8">
          <div style={{ transform: `scale(${zoom})` }} className="check-preview-container bg-white text-black p-8 rounded-lg shadow-2xl w-[600px] h-[270px] relative border border-slate-300">
              <div className="flex justify-between items-start">
                  <div><h2 className="text-sm font-bold uppercase">{check.senderName}</h2><p className="text-[9px] text-slate-500">{check.senderAddress || '________________'}</p></div>
                  <div className="text-right"><h2 className="text-xs font-black uppercase">{check.bankName}</h2><p className="text-xs font-mono font-bold">{check.date}</p></div>
              </div>
              <div className="mt-8 flex items-center gap-4"><span className="text-xs font-bold uppercase">Pay to the Order of</span><div className="flex-1 border-b border-black text-lg italic px-2">{check.payee || '________________'}</div><div className="w-32 border-2 border-black p-1 text-right font-mono text-lg font-bold">${check.amount.toFixed(2)}</div></div>
              <div className="mt-4 flex items-center gap-4"><div className="flex-1 border-b border-black text-[13px] italic">{check.amountWords || '________________________________'}</div><span className="text-xs font-bold">DOLLARS</span></div>
              <div className="absolute bottom-4 left-8 right-8 flex items-end justify-between"><div className="font-mono text-lg tracking-widest">⑆ {check.routingNumber} ⑈ {check.accountNumber} ⑈ {check.checkNumber}</div><div className="w-48 border-b border-black text-center"><span className="text-[10px] uppercase font-bold">Authorized Signature</span></div></div>
          </div>
      </div>
    </div>
  );
};
