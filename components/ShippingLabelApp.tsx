import { GoogleGenAI } from '@google/genai';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { ArrowLeft, Download, Globe, Loader2, MapPin, Printer, Scale, Share2, Sparkles, Truck, User } from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';
import { auth } from '../services/firebaseConfig';
import { connectGoogleDrive, getDriveToken, isJudgeSession } from '../services/authService';
import { saveShippingLabel, deductCoins, AI_COSTS, uploadFileToStorage } from '../services/firestoreService';
import { ensureCodeStudioFolder, ensureFolder, uploadToDrive } from '../services/googleDriveService';
import { Address, PackageDetails } from '../types';
import { generateSecureId } from '../utils/idUtils';
import { ShareModal } from './ShareModal';

interface ShippingLabelAppProps {
  onBack: () => void;
}

const DEFAULT_ADDRESS: Address = {
  name: '',
  street: '',
  city: '',
  state: '',
  zip: '',
  country: 'USA'
};

const DEFAULT_PACKAGE: PackageDetails = {
  weight: '1.5',
  unit: 'lbs',
  type: 'box',
  service: 'standard',
  carrier: 'USPS'
};

const CARRIER_CONFIG = {
    USPS: { color: 'bg-[#004b87]', text: 'text-white', border: 'border-black', label: 'UNITED STATES POSTAL SERVICE', font: 'font-sans' },
    UPS: { color: 'bg-[#351c15]', text: 'text-white', border: 'border-black', label: 'UPS GROUND', font: 'font-sans' },
    FedEx: { color: 'bg-[#4d148c]', text: 'text-white', border: 'border-black', label: 'FedEx Express', font: 'font-sans' }
};

export const ShippingLabelApp: React.FC<ShippingLabelAppProps> = ({ onBack }) => {
  const [sender, setSender] = useState<Address>(DEFAULT_ADDRESS);
  const [recipient, setRecipient] = useState<Address>(DEFAULT_ADDRESS);
  const [pkg, setPkg] = useState<PackageDetails>(DEFAULT_PACKAGE);
  
  const [isParsing, setIsParsing] = useState<'sender' | 'recipient' | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  
  const labelRef = useRef<HTMLDivElement>(null);

  const trackingNum = useMemo(() => {
      const prefix = pkg.carrier === 'USPS' ? '9400' : pkg.carrier === 'UPS' ? '1Z' : '7700';
      return `${prefix} ${generateSecureId().substring(0, 16).toUpperCase()}`;
  }, [pkg.carrier, sender, recipient]);

  const handleParseAddress = async (type: 'sender' | 'recipient') => {
      const input = prompt(`Paste raw address for ${type} (e.g. from an email or invoice):`);
      if (!input) return;
      setIsParsing(type);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const response = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: `Refract this raw text into a structured JSON address object with fields: name, street, city, state, zip, country. TEXT: "${input}"`,
              config: { responseMimeType: 'application/json' }
          });
          const parsed = JSON.parse(response.text || '{}');
          if (type === 'sender') setSender({ ...sender, ...parsed });
          else setRecipient({ ...recipient, ...parsed });
          
          if (auth.currentUser) {
              deductCoins(auth.currentUser.uid, AI_COSTS.TEXT_REFRACTION);
          }
      } catch (e) {
          alert("Neural refraction of address failed. Please enter manually.");
      } finally {
          setIsParsing(null);
      }
  };

  const handlePublishAndShare = async () => {
      if (!auth.currentUser) return alert("Please sign in to publish.");
      setIsSharing(true);
      try {
          const id = generateSecureId();
          const isJudge = isJudgeSession();

          // High DPI capture for PDF
          const canvas = await html2canvas(labelRef.current!, { scale: 4, useCORS: true, backgroundColor: '#ffffff' });
          const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [288, 432] }); // 4x6 inches
          pdf.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, 288, 432);
          const pdfBlob = pdf.output('blob');

          if (isJudge) {
              // JUDGE REDIRECTION: Save directly to Firebase Storage
              const fbPdfUrl = await uploadFileToStorage(`shipping/${auth.currentUser.uid}/Label_${id}.pdf`, pdfBlob);
              await saveShippingLabel({
                  id, sender, recipient, package: pkg,
                  trackingNumber: trackingNum, createdAt: Date.now(), ownerId: auth.currentUser.uid
              });
              const link = `${window.location.origin}?view=shipping&id=${id}`;
              setShareLink(link);
          } else {
              // STANDARD MEMBER: Sync to Google Drive
              await saveShippingLabel({
                  id, sender, recipient, package: pkg,
                  trackingNumber: trackingNum, createdAt: Date.now(), ownerId: auth.currentUser.uid
              });
              
              const token = getDriveToken() || await connectGoogleDrive();
              if (token) {
                  const folderId = await ensureCodeStudioFolder(token);
                  const shipFolder = await ensureFolder(token, 'Shipments', folderId);
                  await uploadToDrive(token, shipFolder, `Label_${recipient.name.replace(/\s+/g, '_')}.pdf`, pdfBlob);
              }
              const link = `${window.location.origin}?view=shipping&id=${id}`;
              setShareLink(link);
          }

          setShowShareModal(true);
      } catch (e: any) {
          alert("Sharing failed: " + e.message);
      } finally {
          setIsSharing(false);
      }
  };

  const handleExportPDF = async () => {
      if (!labelRef.current) return;
      setIsExporting(true);
      try {
          const canvas = await html2canvas(labelRef.current, { scale: 4, useCORS: true, backgroundColor: '#ffffff' });
          const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [288, 432] });
          pdf.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, 288, 432);
          pdf.save(`shipping_label_${pkg.carrier}_${Date.now()}.pdf`);
      } catch (e) {
          alert("Export failed.");
      } finally {
          setIsExporting(false);
      }
  };

  // Switched to barcodeapi.org which is highly reliable and CORS friendly for browser rendering
  const barcodeUrl = `https://barcodeapi.org/api/128/${encodeURIComponent(trackingNum.replace(/\s/g, ''))}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin + '?view=shipping&id=' + trackingNum)}`;

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-20">
          <div className="flex items-center gap-4">
              <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"><ArrowLeft size={20} /></button>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                  <Truck className="text-emerald-400" /> 
                  Neural Shipping Lab
              </h1>
          </div>
          <div className="flex items-center gap-3">
              <button onClick={handlePublishAndShare} disabled={isSharing} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-black uppercase tracking-widest shadow-lg transition-all active:scale-95">
                  {isSharing ? <Loader2 size={14} className="animate-spin"/> : <Share2 size={14}/>}
                  <span>{shareLink ? 'Reshare URI' : 'Sync & Share'}</span>
              </button>
              <button onClick={handleExportPDF} disabled={isExporting} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-black uppercase tracking-widest border border-slate-700 shadow-md">
                  {isExporting ? <Loader2 size={14} className="animate-spin"/> : <Download size={14} />}
                  <span>Print PDF</span>
              </button>
          </div>
      </header>

      <div className="flex-1 flex overflow-hidden flex-col lg:flex-row">
          {/* Controls */}
          <div className="w-full lg:w-[450px] border-r border-slate-800 bg-slate-900/30 flex flex-col shrink-0 overflow-y-auto p-6 space-y-8 scrollbar-thin">
              
              <div className="space-y-4">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2"><Globe size={14} className="text-indigo-400"/> Carrier Spectrum</h3>
                  <div className="grid grid-cols-3 gap-2">
                      {['USPS', 'UPS', 'FedEx'].map(c => (
                          <button key={c} onClick={() => setPkg({...pkg, carrier: c as any})} className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${pkg.carrier === c ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600'}`}>{c}</button>
                      ))}
                  </div>
              </div>

              <div className="space-y-4">
                  <div className="flex justify-between items-center px-1">
                      <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2"><User size={14} className="text-indigo-400"/> Origin (From)</h3>
                      <button onClick={() => handleParseAddress('sender')} className="text-[9px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1 hover:text-white transition-all">
                          {isParsing === 'sender' ? <Loader2 size={10} className="animate-spin"/> : <Sparkles size={10}/>}
                          Neural Ingest
                      </button>
                  </div>
                  <input type="text" placeholder="Full Name" value={sender.name} onChange={e => setSender({...sender, name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"/>
                  <input type="text" placeholder="Street Address" value={sender.street} onChange={e => setSender({...sender, street: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"/>
                  <div className="grid grid-cols-3 gap-2">
                      <input type="text" placeholder="City" value={sender.city} onChange={e => setSender({...sender, city: e.target.value})} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none"/>
                      <input type="text" placeholder="State" value={sender.state} onChange={e => setSender({...sender, state: e.target.value})} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none"/>
                      <input type="text" placeholder="ZIP" value={sender.zip} onChange={e => setSender({...sender, zip: e.target.value})} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none font-mono"/>
                  </div>
              </div>

              <div className="space-y-4">
                  <div className="flex justify-between items-center px-1">
                      <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2"><MapPin size={14} className="text-emerald-400"/> Destination (To)</h3>
                      <button onClick={() => handleParseAddress('recipient')} className="text-[9px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1 hover:text-white transition-all">
                          {isParsing === 'recipient' ? <Loader2 size={10} className="animate-spin"/> : <Sparkles size={10}/>}
                          Neural Ingest
                      </button>
                  </div>
                  <input type="text" placeholder="Recipient Name" value={recipient.name} onChange={e => setRecipient({...recipient, name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner"/>
                  <input type="text" placeholder="Street Address" value={recipient.street} onChange={e => setRecipient({...recipient, street: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner"/>
                  <div className="grid grid-cols-3 gap-2">
                      <input type="text" placeholder="City" value={recipient.city} onChange={e => setRecipient({...recipient, city: e.target.value})} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none"/>
                      <input type="text" placeholder="State" value={recipient.state} onChange={e => setRecipient({...recipient, state: e.target.value})} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none"/>
                      <input type="text" placeholder="ZIP" value={recipient.zip} onChange={e => setRecipient({...recipient, zip: e.target.value})} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none font-mono"/>
                  </div>
              </div>

              <div className="space-y-4">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2"><Scale size={14} className="text-indigo-400"/> Logistics Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-600 uppercase ml-1">Weight</label>
                          <div className="flex bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-inner">
                              <input type="text" value={pkg.weight} onChange={e => setPkg({...pkg, weight: e.target.value})} className="w-full bg-transparent px-4 py-3 text-sm text-white outline-none"/>
                              <span className="px-3 py-3 text-[10px] font-black text-slate-600 border-l border-slate-800 bg-slate-900">LBS</span>
                          </div>
                      </div>
                      <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-600 uppercase ml-1">Type</label>
                          <select value={pkg.type} onChange={e => setPkg({...pkg, type: e.target.value as any})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none shadow-inner">
                              <option value="box">Package Box</option>
                              <option value="envelope">Envelope</option>
                              <option value="pallet">LTL Pallet</option>
                          </select>
                      </div>
                  </div>
              </div>
          </div>

          {/* Preview Panel */}
          <div className="flex-1 bg-slate-950 flex flex-col p-8 items-center justify-center overflow-y-auto scrollbar-hide relative">
              <div className="absolute top-8 left-8 text-slate-600 flex items-center gap-2 select-none">
                  <Printer size={14} />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em]">Thermal Printing Preview (4x6)</span>
              </div>

              {/* DYNAMIC SHIPPING LABEL */}
              <div 
                ref={labelRef} 
                className="w-[384px] h-[576px] bg-white text-black shadow-2xl flex flex-col border border-slate-300 shrink-0 select-none overflow-hidden"
              >
                  {/* Header Block */}
                  <div className="p-4 border-b-4 border-black flex justify-between items-start gap-4">
                      <div className="flex-1">
                          <p className="text-[10px] font-bold uppercase leading-tight">{CARRIER_CONFIG[pkg.carrier as keyof typeof CARRIER_CONFIG].label}</p>
                          <p className="text-3xl font-black italic tracking-tighter uppercase leading-none mt-1">{pkg.carrier}</p>
                          <div className="mt-4 text-[9px] leading-tight">
                              <p className="font-bold">{sender.name || 'SENDER NAME'}</p>
                              <p>{sender.street || '123 SENDER ST'}</p>
                              <p>{sender.city || 'CITY'}, {sender.state || 'ST'} {sender.zip || '00000'}</p>
                          </div>
                      </div>
                      <div className="text-center">
                          <div className="w-16 h-16 border-2 border-black flex items-center justify-center text-4xl font-black">
                              {pkg.carrier === 'USPS' ? 'P' : 'F'}
                          </div>
                          <p className="text-[8px] font-bold mt-1 uppercase">Postage Paid</p>
                      </div>
                  </div>

                  {/* Main Ship To Area */}
                  <div className="flex-1 flex flex-col p-6 space-y-2 relative">
                      <p className="text-[12px] font-black uppercase tracking-widest border-b border-black w-fit mb-4">SHIP TO:</p>
                      
                      <div className="pl-6 space-y-0.5">
                          <p className="text-2xl font-black uppercase tracking-tight leading-none mb-2">{recipient.name || 'RECIPIENT NAME'}</p>
                          <p className="text-xl font-bold uppercase tracking-tight">{recipient.street || '456 DESTINATION AVE'}</p>
                          <p className="text-2xl font-black uppercase tracking-tighter">
                              {recipient.city || 'CITY'}, {recipient.state || 'ST'} {recipient.zip || '00000'}
                          </p>
                          {recipient.country !== 'USA' && <p className="text-lg font-black uppercase mt-2">{recipient.country}</p>}
                      </div>

                      {/* Small Service Code */}
                      <div className="absolute top-4 right-4 text-center">
                          <p className="text-[10px] font-black border border-black px-2 py-0.5">ZONE 5</p>
                          <p className="text-[8px] font-bold mt-1">{pkg.weight} LBS</p>
                      </div>
                  </div>

                  {/* Tracking Section */}
                  <div className="p-4 border-t-4 border-black flex flex-col items-center">
                      <div className="w-full min-h-[96px] flex items-center justify-center bg-white overflow-hidden mb-2">
                          <img 
                            src={barcodeUrl} 
                            style={{ display: 'block', minWidth: '100%', minHeight: '80px' }}
                            className="max-w-full h-24 object-contain" 
                            alt="Tracking Barcode" 
                            crossOrigin="anonymous"
                          />
                      </div>
                      <div className="text-center">
                          <p className="text-[10px] font-bold uppercase mb-1">Tracking Number:</p>
                          <p className="text-lg font-black font-mono tracking-widest uppercase">{trackingNum}</p>
                      </div>
                  </div>

                  {/* Footer Block */}
                  <div className="p-4 border-t-2 border-black flex justify-between items-end bg-slate-50/50">
                      <div className="space-y-1">
                          <p className="text-[10px] font-black bg-black text-white px-2 py-0.5 inline-block mb-1">REF: NEURAL-PRISM-V5</p>
                          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">AIVoiceCast Official Refraction</p>
                      </div>
                      <div className="flex gap-4 items-end">
                        <img src={qrCodeUrl} className="w-12 h-12" alt="Neural QR" crossOrigin="anonymous"/>
                        <div className="w-12 h-12 border-2 border-black p-0.5 flex flex-wrap gap-0.5">
                            {Array.from({length: 16}).map((_, i) => <div key={i} className={`w-2 h-2 ${Math.random() > 0.5 ? 'bg-black' : 'bg-transparent'}`}></div>)}
                        </div>
                      </div>
                  </div>
              </div>

              {shareLink && (
                  <div className="mt-10 w-full max-w-md bg-slate-900 border border-indigo-500/50 rounded-[2rem] p-6 flex items-center justify-between shadow-2xl animate-fade-in-up">
                      <div className="overflow-hidden">
                          <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest mb-1">Verifiable Label URI</p>
                          <p className="text-xs text-slate-400 truncate font-mono">{shareLink}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { navigator.clipboard.writeText(shareLink); alert("URI Copied!"); }} className="p-3 bg-slate-800 hover:bg-indigo-600 rounded-2xl text-white transition-all shadow-lg active:scale-95"><Share2 size={20}/></button>
                      </div>
                  </div>
              )}
          </div>
      </div>
      
      {showShareModal && shareLink && (
          <ShareModal 
            isOpen={true} onClose={() => setShowShareModal(false)}
            link={shareLink} title={`Shipping Label to ${recipient.name}`}
            onShare={async () => {}} currentUserUid={auth?.currentUser?.uid}
          />
      )}
    </div>
  );
};