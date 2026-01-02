
import React, { useState, useRef, useMemo } from 'react';
import { ArrowLeft, Truck, Package, Save, Download, Sparkles, Loader2, RefreshCw, User, MapPin, Hash, QrCode, Mail, Trash2, Printer, CheckCircle, AlertTriangle, Share2, Link } from 'lucide-react';
import { Address, PackageDetails, ShippingLabel } from '../types';
import { GoogleGenAI } from '@google/genai';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { auth } from '../services/firebaseConfig';
import { saveShippingLabel } from '../services/firestoreService';
import { getDriveToken, connectGoogleDrive } from '../services/authService';
import { ensureCodeStudioFolder, uploadToDrive } from '../services/googleDriveService';
import { generateSecureId } from '../utils/idUtils';

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

export const ShippingLabelApp: React.FC<ShippingLabelAppProps> = ({ onBack }) => {
  const [sender, setSender] = useState<Address>(DEFAULT_ADDRESS);
  const [recipient, setRecipient] = useState<Address>(DEFAULT_ADDRESS);
  const [pkg, setPkg] = useState<PackageDetails>(DEFAULT_PACKAGE);
  
  const [isParsing, setIsParsing] = useState<'sender' | 'recipient' | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  
  const labelRef = useRef<HTMLDivElement>(null);

  const handleParseAddress = async (type: 'sender' | 'recipient') => {
      const input = prompt(`Paste address for ${type}:`);
      if (!input) return;
      setIsParsing(type);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const response = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: `Parse into JSON (name, street, city, state, zip, country): "${input}"`,
              config: { responseMimeType: 'application/json' }
          });
          const parsed = JSON.parse(response.text || '{}');
          if (type === 'sender') setSender({ ...sender, ...parsed });
          else setRecipient({ ...recipient, ...parsed });
      } catch (e) {
          alert("Neural parse failed.");
      } finally {
          setIsParsing(null);
      }
  };

  const handlePublishAndShare = async () => {
      if (!auth.currentUser) return alert("Please sign in to share.");
      setIsSharing(true);
      try {
          const id = generateSecureId();
          await saveShippingLabel({
              id, sender, recipient, package: pkg,
              trackingNumber: trackingNum, createdAt: Date.now(), ownerId: auth.currentUser.uid
          });

          const canvas = await html2canvas(labelRef.current!, { scale: 4, useCORS: true });
          const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [288, 432] });
          pdf.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, 288, 432);
          const pdfBlob = pdf.output('blob');

          const token = getDriveToken() || await connectGoogleDrive();
          if (token) {
              const folderId = await ensureCodeStudioFolder(token);
              await uploadToDrive(token, folderId, `Label_${recipient.name.replace(/\s/g, '_')}.pdf`, pdfBlob);
          }

          const link = `${window.location.origin}?view=shipping&id=${id}`;
          setShareLink(link);
          alert("Label shared and saved to Drive!");
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
          pdf.save(`shipping_label_${Date.now()}.pdf`);
      } catch (e) {
          alert("Export failed.");
      } finally {
          setIsExporting(false);
      }
  };

  const trackingNum = useMemo(() => `TRACK-${generateSecureId().substring(0, 12).toUpperCase()}`, [sender, recipient, pkg]);

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-20">
          <div className="flex items-center gap-4">
              <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"><ArrowLeft size={20} /></button>
              <h1 className="text-lg font-bold text-white flex items-center gap-2"><Truck className="text-emerald-400" /> Neural Shipping Lab</h1>
          </div>
          <div className="flex items-center gap-3">
              <button onClick={handlePublishAndShare} disabled={isSharing} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-lg transition-all">
                  {isSharing ? <Loader2 size={14} className="animate-spin"/> : <Share2 size={14}/>}
                  <span>Publish & Share URI</span>
              </button>
              <button onClick={handleExportPDF} disabled={isExporting} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold border border-slate-700">
                  {isExporting ? <Loader2 size={14} className="animate-spin"/> : <Download size={14} />}
                  <span>Download Label</span>
              </button>
          </div>
      </header>

      <div className="flex-1 flex overflow-hidden flex-col lg:flex-row">
          <div className="w-full lg:w-[450px] border-r border-slate-800 bg-slate-900/30 flex flex-col shrink-0 overflow-y-auto p-6 space-y-8 scrollbar-thin">
              <div className="space-y-4">
                  <div className="flex justify-between items-center"><h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><User size={14} className="text-indigo-400"/> Ship From</h3><button onClick={() => handleParseAddress('sender')} className="text-[10px] font-bold text-indigo-400"><Sparkles size={10}/> Neural Parse</button></div>
                  <input type="text" placeholder="Name" value={sender.name} onChange={e => setSender({...sender, name: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none"/>
                  <input type="text" placeholder="Street" value={sender.street} onChange={e => setSender({...sender, street: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none"/>
              </div>
              <div className="space-y-4">
                  <div className="flex justify-between items-center"><h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><MapPin size={14} className="text-emerald-400"/> Ship To</h3><button onClick={() => handleParseAddress('recipient')} className="text-[10px] font-bold text-emerald-400"><Sparkles size={10}/> Neural Parse</button></div>
                  <input type="text" placeholder="Name" value={recipient.name} onChange={e => setRecipient({...recipient, name: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none"/>
                  <input type="text" placeholder="Street" value={recipient.street} onChange={e => setRecipient({...recipient, street: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none"/>
              </div>
          </div>
          <div className="flex-1 bg-slate-950 flex flex-col p-8 items-center overflow-y-auto scrollbar-hide">
              {shareLink && (
                  <div className="mb-6 w-full max-w-md bg-slate-900 border border-indigo-500/50 rounded-2xl p-4 flex items-center justify-between shadow-xl">
                      <div className="overflow-hidden"><p className="text-[10px] font-bold text-indigo-400 uppercase mb-1">Shareable URI</p><p className="text-xs text-slate-400 truncate font-mono">{shareLink}</p></div>
                      <button onClick={() => { navigator.clipboard.writeText(shareLink); alert("Copied!"); }} className="p-2 bg-slate-800 rounded-lg"><Share2 size={16}/></button>
                  </div>
              )}
              <div ref={labelRef} className="w-[288px] h-[432px] bg-white text-black shadow-2xl flex flex-col border border-slate-300 shrink-0">
                  <div className="p-4 border-b-2 border-black flex justify-between"><span className="text-2xl font-black italic">{pkg.carrier}</span><div className="text-xl font-bold border-2 border-black px-2">P</div></div>
                  <div className="p-4 flex-1 flex flex-col justify-center space-y-1">
                      <p className="text-xs font-bold uppercase">To:</p>
                      <p className="text-xl font-black uppercase tracking-tight leading-tight">{recipient.name || 'RECIPIENT'}</p>
                      <p className="text-base font-bold uppercase">{recipient.street || '456 DESTINATION AVE'}</p>
                      <p className="text-base font-black uppercase tracking-tighter">{recipient.city || 'CITY'}, {recipient.state || 'ST'} {recipient.zip || '00000'}</p>
                  </div>
                  <div className="p-4 border-t-2 border-black flex justify-between items-center">
                      <div className="flex flex-col"><span className="text-[10px] font-bold">TRACKING:</span><span className="text-xs font-mono font-bold">{trackingNum}</span></div>
                      <QrCode size={48} className="text-black"/>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};
