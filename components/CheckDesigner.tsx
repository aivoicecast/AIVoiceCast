
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  ArrowLeft, Wallet, Save, Download, Sparkles, Loader2, User, Hash, QrCode, Mail, 
  Trash2, Printer, CheckCircle, AlertTriangle, Send, Share2, DollarSign, Calendar, 
  Landmark, Info, Search, Edit3, RefreshCw, ShieldAlert, X, ChevronRight, ImageIcon
} from 'lucide-react';
import { BankingCheck, UserProfile } from '../types';
import { GoogleGenAI } from '@google/genai';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { getAllUsers, sendMessage, uploadFileToStorage } from '../services/firestoreService';
import { auth } from '../services/firebaseConfig';

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
  signature: ''
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
  const [showShareModal, setShowShareModal] = useState(false);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  
  const checkRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (showShareModal) {
        setIsLoadingUsers(true);
        getAllUsers().then(users => {
            setAllUsers(users.filter(u => u.uid !== currentUser?.uid));
            setIsLoadingUsers(false);
        });
    }
  }, [showShareModal, currentUser]);

  // Automatic Amount Words Generation with Debounce
  useEffect(() => {
    if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
    }

    if (check.amount > 0) {
        debounceTimerRef.current = setTimeout(() => {
            handleGenerateAmountWords(check.amount);
        }, 1200); 
    }

    return () => {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [check.amount]);

  const qrCodeUrl = useMemo(() => {
      const data = `payee:${check.payee}|amount:${check.amount}|memo:${check.memo}|bank:${check.bankName}`;
      return `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(data)}`;
  }, [check.payee, check.amount, check.memo, check.bankName]);

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
          setIsParsing(false);
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

  const handleGenerateAmountWords = async (val: number) => {
      setIsUpdatingWords(true);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const prompt = `Convert the numeric amount ${val} into formal banking check words (e.g., "Five Hundred and 00/100"). 
          Currency is USD. Return ONLY the text, nothing else.`;
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

  const handleShareWithMember = async (member: UserProfile) => {
      setIsSharing(true);
      try {
          const blob = await generatePDFBlob();
          if (!blob) throw new Error("Could not generate PDF");
          
          const path = `shared_checks/${currentUser.uid}/${Date.now()}_check.pdf`;
          const url = await uploadFileToStorage(path, blob);
          
          const channelId = [currentUser.uid, member.uid].sort().join('_');
          const messageText = `Hi ${member.displayName}, I've generated a check for you: ${check.amountWords}. Check #: ${check.checkNumber}. View here: ${url}`;
          
          await sendMessage(channelId, messageText, `chat_channels/${channelId}/messages`, undefined, [{
              type: 'file',
              url: url,
              name: `Check_${check.checkNumber}.pdf`
          }]);
          
          alert(`Check shared with ${member.displayName}!`);
          setShowShareModal(false);
      } catch (e: any) {
          alert("Sharing failed: " + e.message);
      } finally {
          setIsSharing(false);
      }
  };

  const filteredUsers = allUsers.filter(u => 
      u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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
              <button 
                onClick={() => setShowShareModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-lg transition-all active:scale-95"
              >
                  <Share2 size={14} />
                  <span>Share with Member</span>
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
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                            <input type="number" placeholder="0.00" value={check.amount} onChange={e => setCheck({...check, amount: parseFloat(e.target.value) || 0})} className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-6 pr-2.5 py-2.5 text-sm text-white outline-none focus:border-indigo-500 text-right"/>
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

          <div className="flex-1 bg-slate-950 flex flex-col p-12 items-center overflow-y-auto scrollbar-hide">
              <div className="sticky top-0 mb-8 flex items-center gap-2 text-slate-600 select-none">
                  <Printer size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">High-Security Document Preview</span>
              </div>

              <div 
                ref={checkRef}
                className="w-[600px] h-[270px] bg-white text-black shadow-2xl flex flex-col border border-slate-300 relative shrink-0 overflow-hidden font-sans p-6 rounded-sm"
                style={{
                    backgroundImage: `radial-gradient(circle at 2px 2px, rgba(0,0,0,0.02) 1px, transparent 0)`,
                    backgroundSize: '8px 8px'
                }}
              >
                  {/* Custom Watermark Art */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-[0.06] pointer-events-none select-none overflow-hidden">
                      {customArtUrl ? (
                          <img src={customArtUrl} className="w-[350px] h-[350px] object-contain grayscale scale-125" alt="watermark" />
                      ) : (
                          <Landmark size={200} />
                      )}
                  </div>

                  {/* Header Row */}
                  <div className="flex justify-between items-start mb-4">
                      <div className="space-y-0.5">
                          <p className="text-xs font-black uppercase tracking-tight leading-none">{check.senderName}</p>
                          <p className="text-[8px] text-slate-500 max-w-[150px] leading-tight">{check.senderAddress}</p>
                      </div>
                      <div className="text-right">
                          <p className="text-sm font-black italic text-indigo-900">{check.bankName}</p>
                          <p className="text-[10px] font-bold mt-1">{check.checkNumber}</p>
                      </div>
                  </div>

                  {/* Date and Amount Box Row */}
                  <div className="flex justify-end gap-12 mb-2 items-center">
                      <div className="flex items-center gap-2 border-b border-black pb-1 min-w-[120px]">
                          <span className="text-[8px] font-bold uppercase">Date</span>
                          <span className="text-xs font-medium">{check.date}</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-300 px-3 py-1 flex items-center gap-2 min-w-[120px] shadow-inner">
                          <span className="text-sm font-bold">$</span>
                          <span className="text-lg font-black tracking-tight">{check.amount.toFixed(2)}</span>
                      </div>
                  </div>

                  {/* Payee Line */}
                  <div className="flex items-end gap-3 mb-2 border-b border-black pb-1">
                      <span className="text-[8px] font-bold uppercase whitespace-nowrap mb-1">Pay to the order of</span>
                      <span className="flex-1 text-sm font-black italic px-2">{check.payee}</span>
                  </div>

                  {/* Amount Words Line */}
                  <div className="flex items-end gap-3 mb-4 border-b border-black pb-1 relative">
                      <span className="flex-1 text-xs font-bold italic px-2">{check.amountWords}</span>
                      <span className="text-[8px] font-bold uppercase absolute right-0 bottom-1">Dollars</span>
                  </div>

                  {/* Memo, QR, and Signature Row - Fixed overlap with MICR and moved up */}
                  <div className="flex items-end justify-between mt-auto mb-14">
                      <div className="flex flex-col gap-1 w-1/3">
                          <div className="flex items-end gap-2 border-b border-black pb-1">
                              <span className="text-[8px] font-bold uppercase mb-1">For</span>
                              <span className="text-xs font-medium px-2 truncate">{check.memo}</span>
                          </div>
                      </div>
                      
                      {/* Scan to Pay QR Code */}
                      <div className="flex flex-col items-center">
                          <img src={qrCodeUrl} className="w-12 h-12 border border-slate-100 p-0.5 rounded shadow-sm" alt="QR Code" crossOrigin="anonymous"/>
                          <span className="text-[6px] font-black uppercase text-slate-400 mt-1">Scan for Digital Pay</span>
                      </div>

                      <div className="flex flex-col items-center w-1/3">
                          <div className="min-w-[160px] border-b border-black text-center pb-1">
                              <span className="text-xl font-script italic leading-none">{check.signature || check.senderName}</span>
                          </div>
                          <span className="text-[8px] font-bold uppercase mt-1">Authorized Signature</span>
                      </div>
                  </div>

                  {/* MICR Line - Absolute bottom with safe margin */}
                  <div className="absolute bottom-2 left-0 w-full flex justify-center gap-12 font-mono text-sm tracking-[0.2em] opacity-80 select-none bg-white/50 py-1">
                      <span>⑆ {check.routingNumber} ⑆</span>
                      <span>{check.accountNumber} ⑈</span>
                      <span>{check.checkNumber}</span>
                  </div>
                  
                  {/* Security Borders */}
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500/20 via-transparent to-indigo-500/20"></div>
                  <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500/20 via-transparent to-indigo-500/20"></div>
              </div>

              {/* Tips Section */}
              <div className="mt-12 w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex items-start gap-4">
                      <div className="p-2 bg-emerald-900/20 rounded-lg text-emerald-400"><QrCode size={20}/></div>
                      <div>
                          <h4 className="text-sm font-bold text-white mb-1">Digital Scan Support</h4>
                          <p className="text-xs text-slate-500 leading-relaxed">Integrated QR code encodes payment details for fast mobile banking imports and ledger synchronization.</p>
                      </div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex items-start gap-4">
                      <div className="p-2 bg-amber-900/20 rounded-lg text-amber-400"><ShieldAlert size={20}/></div>
                      <div>
                          <h4 className="text-sm font-bold text-white mb-1">Secure Architecture</h4>
                          <p className="text-xs text-slate-500 leading-relaxed">Layout designed to prevent data overlap and ensure machine-readability for automated deposit systems.</p>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                  <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2"><Send size={18} className="text-indigo-400"/> Send Check to Member</h3>
                      <button onClick={() => setShowShareModal(false)} className="p-1 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white transition-colors"><X size={20}/></button>
                  </div>
                  <div className="p-6 flex-1 overflow-y-auto space-y-4">
                      <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16}/>
                          <input 
                            type="text" 
                            placeholder="Find member..." 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                          />
                      </div>
                      <div className="space-y-2">
                          {isLoadingUsers ? (
                              <div className="py-12 text-center text-slate-500"><Loader2 className="animate-spin mx-auto mb-2"/>Loading Members...</div>
                          ) : filteredUsers.map(user => (
                              <button 
                                key={user.uid}
                                onClick={() => handleShareWithMember(user)}
                                disabled={isSharing}
                                className="w-full flex items-center justify-between p-3 bg-slate-800/50 border border-slate-700 rounded-xl hover:bg-indigo-900/20 hover:border-indigo-500/50 transition-all group disabled:opacity-50"
                              >
                                  <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 overflow-hidden">
                                          {user.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover"/> : <User size={20}/>}
                                      </div>
                                      <div className="text-left">
                                          <p className="text-sm font-bold text-white group-hover:text-indigo-300">{user.displayName}</p>
                                          <p className="text-[10px] text-slate-500">{user.email}</p>
                                      </div>
                                  </div>
                                  <ChevronRight size={16} className="text-slate-600 group-hover:text-indigo-400"/>
                              </button>
                          ))}
                      </div>
                  </div>
                  {isSharing && (
                      <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3 z-10">
                          <Loader2 size={32} className="animate-spin text-indigo-400"/>
                          <p className="text-sm font-bold">Uploading & Sending...</p>
                      </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};
