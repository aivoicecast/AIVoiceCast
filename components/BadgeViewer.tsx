
import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, ShieldCheck, Lock, User, Clock, QrCode, Loader2, AlertTriangle, Fingerprint, Shield, Share2, Download, Info } from 'lucide-react';
import { BadgeData } from '../types';
import { getBadge } from '../services/firestoreService';

interface BadgeViewerProps {
  onBack: () => void;
  badgeId?: string | null;
}

export const BadgeViewer: React.FC<BadgeViewerProps> = ({ onBack, badgeId }) => {
  const [badge, setBadge] = useState<BadgeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [side, setSide] = useState<'front' | 'back'>('front');

  useEffect(() => {
    if (badgeId) {
      setLoading(true);
      setError(null);
      getBadge(badgeId)
        .then(data => {
          if (data) {
            setBadge(data);
          } else {
            setError("Badge not found in global registry.");
          }
        })
        .catch(err => {
          setError("Neural link failed: " + err.message);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setError("No Badge ID provided.");
      setLoading(false);
    }
  }, [badgeId]);

  // Robust QR Code Generation with fallback to Badge ID
  const qrCodeUrl = useMemo(() => {
    if (!badge) return '';
    // Use the certificate if available, otherwise use the badge unique ID
    const dataToEncode = badge.certificate || `REF:ID-${badge.id}`;
    // Limit string length to ensure API compatibility
    const safeData = dataToEncode.length > 1000 ? dataToEncode.substring(0, 1000) : dataToEncode;
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&bgcolor=ffffff&data=${encodeURIComponent(safeData)}`;
  }, [badge]);

  // Robust Barcode Generation with fallback to Badge ID
  const barcodeUrl = useMemo(() => {
    if (!badge) return '';
    const code = (badge.ownerId && badge.ownerId !== 'anonymous') 
        ? `ID-${badge.ownerId.substring(0, 12).toUpperCase()}` 
        : `BDG-${badge.id.substring(0, 12).toUpperCase()}`;
    return `https://barcodeapi.org/api/128/${encodeURIComponent(code)}`;
  }, [badge]);

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-950 text-indigo-400 gap-4">
        <Loader2 className="animate-spin" size={48} />
        <span className="text-[10px] font-black uppercase tracking-[0.4em]">Handshaking Ledger...</span>
      </div>
    );
  }

  if (error || !badge) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-950 p-6 text-center gap-6">
        <div className="p-6 bg-red-900/20 rounded-[2.5rem] border border-red-500/30 shadow-2xl">
          <AlertTriangle size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white uppercase tracking-tight">Handshake Refused</h2>
          <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto">{error || "The requested artifact does not exist."}</p>
        </div>
        <button onClick={onBack} className="flex items-center gap-2 text-indigo-400 font-bold uppercase text-[10px] tracking-widest hover:text-white transition-colors">
          <ArrowLeft size={16} /> Return to Hub
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-20">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-widest italic">
              <ShieldCheck className="text-indigo-400" size={16} /> 
              Neural Badge Verifier
            </h1>
            <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Verifying Node: {badge.id.substring(0,12)}</p>
          </div>
        </div>
        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button onClick={() => setSide('front')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${side === 'front' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Identity</button>
          <button onClick={() => setSide('back')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${side === 'back' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Verification</button>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-y-auto scrollbar-hide">
        <div className="absolute top-10 flex flex-col items-center text-center gap-2 z-10">
          <div className={`px-4 py-1.5 rounded-full border text-[10px] font-black uppercase flex items-center gap-2 shadow-2xl ${badge.isSecure ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>
            {badge.isSecure ? <ShieldCheck size={14}/> : <Shield size={14}/>}
            {badge.isSecure ? 'Secure Biometric Verified' : 'Standard Identity'}
          </div>
          {badge.isSecure && <p className="text-[8px] text-slate-600 uppercase font-black tracking-[0.2em]">Capture Timing: {new Date(badge.photoTakenAt).toLocaleString()}</p>}
        </div>

        <div className="relative group perspective mt-12 mb-20">
          <div 
            className={`w-[330px] h-[495px] rounded-[2.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] relative transition-all duration-700 preserve-3d ${side === 'back' ? '[transform:rotateY(180deg)]' : ''}`}
          >
            {/* FRONT SIDE */}
            <div 
              className={`absolute inset-0 h-full w-full flex flex-col bg-[#020617] rounded-[2.5rem] border border-white/10 backface-hidden`}
              style={{ zIndex: side === 'front' ? 2 : 1 }}
            >
              <div className="h-1/2 p-10 flex items-center justify-center relative">
                <div className="w-full aspect-square bg-slate-900 rounded-[2rem] border-4 border-slate-800 overflow-hidden shadow-2xl relative">
                  <img src={badge.photoUrl} className="w-full h-full object-cover object-[center_20%] transform scale-105" crossOrigin="anonymous" />
                  <div className="absolute top-3 left-3">
                    <div className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase flex items-center gap-1 shadow-lg border ${badge.isSecure ? 'bg-emerald-500 text-white border-white/20' : 'bg-slate-800 text-slate-400 border-white/5'}`}>
                      {badge.isSecure ? <ShieldCheck size={8}/> : <User size={8}/>}
                      {badge.isSecure ? 'Secure' : 'Standard'}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex-1 p-10 pt-0 flex flex-col justify-between text-center relative z-10">
                <div className="space-y-1">
                  <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none">{badge.displayName}</h2>
                  <p className="text-indigo-400 text-xs font-black uppercase tracking-[0.3em]">Verified Resident</p>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-left">
                    <div className="bg-slate-900/50 p-3 rounded-2xl border border-white/5">
                      <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Clearance</p>
                      <p className="text-[10px] font-bold text-white uppercase">{badge.tier || 'Standard'}</p>
                    </div>
                    <div className="bg-slate-900/50 p-3 rounded-2xl border border-white/5">
                      <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Node Path</p>
                      <p className="text-[10px] font-mono text-indigo-300 uppercase truncate">{badge.anchorNode}</p>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 rounded-full shadow-lg"></div>
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[8px] font-black text-slate-700 uppercase tracking-[0.4em]">Neural Prism Protocol</span>
                    <ShieldCheck size={14} className="text-indigo-500 opacity-60" />
                  </div>
                </div>
              </div>
            </div>

            {/* BACK SIDE */}
            <div 
              className={`absolute inset-0 h-full w-full flex flex-col p-10 text-center bg-[#020617] rounded-[2.5rem] border border-white/10 [transform:rotateY(180deg)] backface-hidden`}
              style={{ zIndex: side === 'back' ? 2 : 1 }}
            >
              <div className="space-y-2 mb-8 shrink-0">
                <h3 className="text-lg font-black text-white uppercase italic tracking-tighter flex items-center justify-center gap-2">
                  <Lock size={16} className="text-indigo-400"/> Cryptographic Shard
                </h3>
                <p className="text-[9px] text-slate-500 leading-relaxed font-bold uppercase tracking-widest">Verification Registry Artifact</p>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="bg-white p-4 rounded-[2rem] shadow-2xl relative mb-4">
                  <img 
                    src={qrCodeUrl} 
                    className="w-44 h-44 block" 
                    alt="Identity Shard" 
                    crossOrigin="anonymous"
                  />
                </div>
                <p className="text-[7px] font-mono text-slate-600 break-all max-w-[240px] leading-tight">
                    {badge.certificate ? `SHA-256_${badge.certificate.substring(10, 50)}...` : `REF_ID_${badge.id.substring(0, 32)}`}
                </p>
              </div>
              <div className="mt-8 space-y-6 pt-8 border-t border-white/5">
                <div className="flex justify-center bg-white rounded-lg p-2 overflow-hidden min-h-[60px] items-center">
                  <img 
                    src={barcodeUrl} 
                    className="h-10 w-full object-contain" 
                    alt="System Serial" 
                    crossOrigin="anonymous"
                  />
                </div>
                <div className="flex justify-between items-end text-[9px] uppercase font-black">
                  <div className="text-left">
                    <p className="text-indigo-400 tracking-widest">Audit Date</p>
                    <p className="text-white font-mono">{new Date(badge.photoTakenAt).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-indigo-400 tracking-widest">Binding</p>
                    <p className="text-white font-mono">#SYN-882-NP</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        <div className="text-center space-y-2 max-w-sm">
          <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center justify-center gap-2">
            <Fingerprint size={14} className="text-indigo-400"/> Public Verification Mode
          </h4>
          <p className="text-[10px] text-slate-500 leading-relaxed font-medium uppercase italic">This artifact is persistent in the Neural Prism global registry for community audit via UUID linkage.</p>
        </div>
      </div>
    </div>
  );
};

export default BadgeViewer;
