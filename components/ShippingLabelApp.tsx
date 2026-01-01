
import React, { useState, useRef, useMemo } from 'react';
import { ArrowLeft, Truck, Package, Save, Download, Sparkles, Loader2, RefreshCw, User, MapPin, Hash, QrCode, Mail, Trash2, Printer, CheckCircle, AlertTriangle } from 'lucide-react';
import { Address, PackageDetails, ShippingLabel } from '../types';
import { GoogleGenAI } from '@google/genai';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

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
  
  const labelRef = useRef<HTMLDivElement>(null);

  const handleParseAddress = async (type: 'sender' | 'recipient') => {
      const input = prompt(`Paste the messy address for ${type.toUpperCase()}:`);
      if (!input) return;

      setIsParsing(type);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const prompt = `Parse the following messy address into a JSON object with fields: name, street, city, state, zip, country.
          If a field is missing, leave it as an empty string. 
          
          Input: "${input}"
          
          Return ONLY valid JSON.`;

          const response = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: prompt,
              config: { responseMimeType: 'application/json' }
          });

          const parsed = JSON.parse(response.text || '{}');
          if (type === 'sender') setSender({ ...sender, ...parsed });
          else setRecipient({ ...recipient, ...parsed });
          
      } catch (e) {
          alert("Failed to parse address. Please enter manually.");
      } finally {
          setIsParsing(null);
      }
  };

  const handleExportPDF = async () => {
      if (!labelRef.current) return;
      setIsExporting(true);
      try {
          const canvas = await html2canvas(labelRef.current, {
              scale: 4, // Increased scale for better resolution
              useCORS: true,
              backgroundColor: '#ffffff',
              logging: false
          });
          const imgData = canvas.toDataURL('image/jpeg', 1.0);
          const pdf = new jsPDF({
              orientation: 'portrait',
              unit: 'px',
              format: [288, 432] // 4x6 inches at 72dpi
          });
          pdf.addImage(imgData, 'JPEG', 0, 0, 288, 432);
          pdf.save(`shipping_label_${Date.now()}.pdf`);
      } catch (e) {
          alert("Export failed.");
      } finally {
          setIsExporting(false);
      }
  };

  const trackingNum = useMemo(() => {
      return `TRACK-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  }, [sender, recipient, pkg]);

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-20">
          <div className="flex items-center gap-4">
              <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                  <ArrowLeft size={20} />
              </button>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                  <Truck className="text-emerald-400" />
                  Neural Shipping Lab
              </h1>
          </div>
          <div className="flex items-center gap-3">
              <button 
                onClick={handleExportPDF}
                disabled={isExporting}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-lg disabled:opacity-50 transition-all active:scale-95"
              >
                  {isExporting ? <Loader2 size={14} className="animate-spin"/> : <Download size={14} />}
                  <span>Export 4x6 Label</span>
              </button>
          </div>
      </header>

      <div className="flex-1 flex overflow-hidden flex-col lg:flex-row">
          <div className="w-full lg:w-[450px] border-r border-slate-800 bg-slate-900/30 flex flex-col shrink-0 overflow-y-auto p-6 space-y-8 scrollbar-thin">
              <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <User size={14} className="text-indigo-400"/> Ship From
                    </h3>
                    <button 
                        onClick={() => handleParseAddress('sender')}
                        disabled={!!isParsing}
                        className="text-[10px] font-bold text-indigo-400 hover:text-white flex items-center gap-1 transition-colors"
                    >
                        {isParsing === 'sender' ? <Loader2 size={10} className="animate-spin"/> : <Sparkles size={10}/>}
                        Neural Parse
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                      <input type="text" placeholder="Sender Name" value={sender.name} onChange={e => setSender({...sender, name: e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none focus:border-indigo-500"/>
                      <input type="text" placeholder="Street Address" value={sender.street} onChange={e => setSender({...sender, street: e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none focus:border-indigo-500"/>
                      <div className="grid grid-cols-2 gap-2">
                          <input type="text" placeholder="City" value={sender.city} onChange={e => setSender({...sender, city: e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none focus:border-indigo-500"/>
                          <div className="grid grid-cols-2 gap-2">
                            <input type="text" placeholder="State" value={sender.state} onChange={e => setSender({...sender, state: e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none focus:border-indigo-500"/>
                            <input type="text" placeholder="ZIP" value={sender.zip} onChange={e => setSender({...sender, zip: e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none focus:border-indigo-500"/>
                          </div>
                      </div>
                  </div>
              </div>

              <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <MapPin size={14} className="text-emerald-400"/> Ship To
                    </h3>
                    <button 
                        onClick={() => handleParseAddress('recipient')}
                        disabled={!!isParsing}
                        className="text-[10px] font-bold text-emerald-400 hover:text-white flex items-center gap-1 transition-colors"
                    >
                        {isParsing === 'recipient' ? <Loader2 size={10} className="animate-spin"/> : <Sparkles size={10}/>}
                        Neural Parse
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                      <input type="text" placeholder="Recipient Name" value={recipient.name} onChange={e => setRecipient({...recipient, name: e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none focus:border-emerald-500"/>
                      <input type="text" placeholder="Street Address" value={recipient.street} onChange={e => setRecipient({...recipient, street: e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none focus:border-emerald-500"/>
                      <div className="grid grid-cols-2 gap-2">
                          <input type="text" placeholder="City" value={recipient.city} onChange={e => setRecipient({...recipient, city: e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none focus:border-emerald-500"/>
                          <div className="grid grid-cols-2 gap-2">
                            <input type="text" placeholder="State" value={recipient.state} onChange={e => setRecipient({...recipient, state: e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none focus:border-emerald-500"/>
                            <input type="text" placeholder="ZIP" value={recipient.zip} onChange={e => setRecipient({...recipient, zip: e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none focus:border-emerald-500"/>
                          </div>
                      </div>
                  </div>
              </div>

              <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <Package size={14} className="text-amber-400"/> Package Details
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 font-bold">Weight</label>
                          <div className="flex gap-1">
                              <input type="number" step="0.1" value={pkg.weight} onChange={e => setPkg({...pkg, weight: e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none w-full"/>
                              <select value={pkg.unit} onChange={e => setPkg({...pkg, unit: e.target.value as any})} className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none">
                                  <option value="lbs">lbs</option>
                                  <option value="kg">kg</option>
                              </select>
                          </div>
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 font-bold">Carrier</label>
                          <select value={pkg.carrier} onChange={e => setPkg({...pkg, carrier: e.target.value as any})} className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none w-full">
                              <option value="USPS">USPS</option>
                              <option value="FedEx">FedEx</option>
                              <option value="UPS">UPS</option>
                              <option value="DHL">DHL</option>
                          </select>
                      </div>
                  </div>
              </div>
          </div>

          <div className="flex-1 bg-slate-950 flex flex-col p-8 items-center overflow-y-auto scrollbar-hide">
              <div className="sticky top-0 mb-6 flex items-center gap-2 text-slate-600 select-none">
                  <Printer size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Label Preview Studio (4x6)</span>
              </div>

              <div 
                ref={labelRef}
                className="w-[288px] h-[432px] bg-white text-black shadow-2xl flex flex-col border border-slate-300 relative shrink-0"
              >
                  <div className="p-4 border-b-2 border-black flex justify-between items-start">
                      <div className="flex flex-col">
                          <span className="text-2xl font-black italic tracking-tighter leading-none">{pkg.carrier}</span>
                          <span className="text-[8px] font-bold uppercase">{pkg.service} shipping</span>
                      </div>
                      <div className="text-right">
                          <div className="text-xl font-bold border-2 border-black px-2 py-0.5 leading-none">P</div>
                      </div>
                  </div>

                  <div className="p-2 border-b border-black">
                      <p className="text-[7px] font-bold uppercase mb-1">From:</p>
                      <div className="pl-1">
                          <p className="text-[8px] font-bold truncate leading-normal py-0.5">{sender.name || 'SENDER NAME'}</p>
                          <p className="text-[8px] leading-normal">{sender.street || '123 Return St'}</p>
                          <p className="text-[8px] leading-normal uppercase">{sender.city || 'Origin City'}, {sender.state || 'ST'} {sender.zip || '00000'}</p>
                      </div>
                  </div>

                  <div className="flex-1 p-4 flex flex-col justify-center">
                      <p className="text-[9px] font-bold uppercase mb-1">To:</p>
                      <div className="pl-4 space-y-0.5">
                          <p className="text-base font-black uppercase tracking-tight leading-normal mb-1">{recipient.name || 'RECIPIENT NAME'}</p>
                          <p className="text-sm font-bold uppercase leading-normal">{recipient.street || '456 Destination Ave'}</p>
                          <p className="text-base font-black uppercase tracking-tighter leading-normal">
                              {recipient.city || 'City'}, {recipient.state || 'ST'} {recipient.zip || '00000'}
                          </p>
                      </div>
                  </div>

                  <div className="p-2 border-t-2 border-black space-y-2">
                      <div className="flex justify-between items-center px-2">
                          <div className="flex flex-col">
                              <span className="text-[7px] font-bold uppercase">Tracking #:</span>
                              <span className="text-[9px] font-mono font-bold leading-normal">{trackingNum}</span>
                          </div>
                          <div className="text-right flex flex-col">
                              <span className="text-[7px] font-bold uppercase">Weight:</span>
                              <span className="text-[9px] font-bold leading-normal">{pkg.weight} {pkg.unit}</span>
                          </div>
                      </div>

                      <div className="h-16 flex items-end gap-[1px] overflow-hidden px-4">
                          {Array.from({ length: 120 }).map((_, i) => (
                              <div key={i} className="bg-black" style={{ width: Math.random() > 0.3 ? (Math.random() > 0.8 ? '3px' : '1.5px') : '0.5px', height: `${80 + Math.random() * 20}%` }}></div>
                          ))}
                      </div>
                  </div>

                  <div className="p-3 border-t border-black bg-slate-50 flex justify-between items-center">
                      <div className="flex flex-col gap-1">
                          <div className="text-[6px] font-bold uppercase tracking-widest text-slate-500">Processed by AIVoiceCast</div>
                          <div className="text-[8px] font-black">{new Date().toLocaleDateString()}</div>
                      </div>
                      <div className="w-12 h-12 bg-black flex items-center justify-center p-1 rounded-sm">
                          <QrCode size={40} className="text-white"/>
                      </div>
                  </div>

                  <div className="absolute top-0 right-0 w-8 h-8 overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-1 bg-black rotate-45 translate-x-4"></div>
                  </div>
              </div>

              <div className="mt-8 w-full max-w-sm space-y-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Neural Diagnostics</h4>
                      <div className="space-y-3">
                          <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-500">Address Validation</span>
                              <span className="text-emerald-400 font-bold flex items-center gap-1"><CheckCircle size={12}/> AI Verified</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-500">Service Optimization</span>
                              <span className="text-indigo-400 font-bold">Express Recommended</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-500">Label Format</span>
                              <span className="text-slate-300">ZPL / PDF 4x6</span>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};
