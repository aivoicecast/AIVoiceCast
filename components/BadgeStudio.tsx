
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, Camera, Upload, Download, Sparkles, ShieldCheck, QrCode, User, RefreshCw, X, Loader2, Shield, Lock, Fingerprint, Palette, Zap, Check, Info, Share2, Link, Globe, AlertTriangle, Clock, History, LayoutGrid, Trash2, Activity, ChevronRight } from 'lucide-react';
import { UserProfile, BadgeData } from '../types';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { resizeImage } from '../utils/imageUtils';
import { GoogleGenAI } from '@google/genai';
import { getDriveToken, signInWithGoogle, connectGoogleDrive } from '../services/authService';
import { ensureCodeStudioFolder, ensureFolder, uploadToDrive } from '../services/googleDriveService';
import { saveBadge, uploadFileToStorage, getUserBadges, deleteFirestoreDoc } from '../services/firestoreService';
import { generateSecureId } from '../utils/idUtils';

interface BadgeStudioProps {
  onBack: () => void;
  userProfile: UserProfile | null;
  // Added onOpenManual prop to fix type error in App.tsx
  onOpenManual?: () => void;
}

export const BadgeStudio: React.FC<BadgeStudioProps> = ({ onBack, userProfile, onOpenManual }) => {
  const [viewMode, setViewMode] = useState<'create' | 'gallery'>('create');
  const [activeTab, setActiveTab] = useState<'design' | 'capture'>('design');
  const [badgeSide, setBadgeSide] = useState<'front' | 'back'>('front');
  const [photo, setPhoto] = useState<string | null>(userProfile?.photoURL || null);
  const [photoTakenAt, setPhotoTakenAt] = useState<number | null>(null);
  const [isSecure, setIsSecure] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isGeneratingWatermark, setIsGeneratingWatermark] = useState(false);
  const [watermarkUrl, setWatermarkUrl] = useState<string | null>(null);
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.15);
  const [isExporting, setIsExporting] = useState(false);
  const [isSavingToDrive, setIsSavingToDrive] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [myBadges, setMyBadges] = useState<BadgeData[]>([]);
  const [isLoadingGallery, setIsLoadingGallery] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (viewMode === 'gallery' && userProfile?.uid) {
        setIsLoadingGallery(true);
        getUserBadges(userProfile.uid).then(data => {
            setMyBadges(data.sort((a,b) => b.photoTakenAt - a.photoTakenAt));
            setIsLoadingGallery(false);
        });
    }
  }, [viewMode, userProfile?.uid]);

  const startCamera = async () => {
    setIsCameraActive(true);
    setActiveTab('capture');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 480, facingMode: 'user' } });
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
        }
    } catch (err) {
        console.error("Camera access denied", err);
        setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.85);
        setPhoto(dataUrl);
        setPhotoTakenAt(Date.now());
        setIsSecure(true); // Secure status achieved via live camera
        stopCamera();
        setActiveTab('design');
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const b64 = await resizeImage(e.target.files[0], 512, 0.8);
      setPhoto(b64);
      setPhotoTakenAt(null);
      setIsSecure(false); // Uploaded photos are standard
    }
  };

  const generateWatermark = async () => {
    if (!userProfile) return;
    setIsGeneratingWatermark(true);
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `A highly detailed, intricate security watermark seal for a digital ID card. 
        Theme: Neural networking, futuristic data prism, high security. 
        Include artistic representations of: "MEMBER ID ${userProfile.uid.substring(0, 8)}". 
        Style: Minimalist vector lines, clean official stamp, elegant light blue and indigo tones. 
        No photorealistic elements, should look like a security stamp on a credit card.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: prompt,
            config: { imageConfig: { aspectRatio: "1:1" } }
        });

        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    setWatermarkUrl(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`);
                    break;
                }
            }
        }
        window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: "Neural Watermark synthesized successfully.", type: 'success' } }));
    } catch (e: any) {
        console.error(e);
        alert("Watermark synthesis failed.");
    } finally {
        setIsGeneratingWatermark(false);
    }
  };

  const handleIssueBadge = async () => {
      if (!photo) return alert("Photo required.");
      setIsExporting(true);
      try {
          const badgeId = generateSecureId();
          const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [330, 495] });
          
          // Front
          const frontEl = document.getElementById('badge-front');
          if (frontEl) {
              const canvas = await html2canvas(frontEl, { scale: 3, useCORS: true, backgroundColor: '#020617' });
              pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 330, 495);
          }
          
          // Back
          pdf.addPage();
          const backEl = document.getElementById('badge-back');
          if (backEl) {
              const canvas = await html2canvas(backEl, { scale: 3, useCORS: true, backgroundColor: '#020617' });
              pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 330, 495);
          }

          const pdfBlob = pdf.output('blob');
          let finalPhotoUrl = photo;
          if (photo.startsWith('data:')) {
            const res = await fetch(photo);
            const blob = await res.blob();
            finalPhotoUrl = await uploadFileToStorage(`badges/${badgeId}/photo.jpg`, blob);
          }

          const badgeData: BadgeData = {
              id: badgeId,
              ownerId: userProfile?.uid || 'anonymous',
              displayName: userProfile?.displayName || 'Anonymous Member',
              photoUrl: finalPhotoUrl,
              isSecure: isSecure,
              photoTakenAt: photoTakenAt || Date.now(),
              certificate: userProfile?.certificate || '',
              tier: userProfile?.subscriptionTier || 'Standard',
              anchorNode: `0x${userProfile?.uid.substring(0, 6).toUpperCase()}`
          };

          await saveBadge(badgeData);
          const link = `${window.location.origin}/?view=badge_viewer&id=${badgeId}`;
          setShareLink(link);
          
          // Sync to Drive
          const token = getDriveToken();
          if (token && !isSavingToDrive) {
              setIsSavingToDrive(true);
              const root = await ensureCodeStudioFolder(token);
              const folder = await ensureFolder(token, 'Identity', root);
              await uploadToDrive(token, folder, `Badge_${badgeId.substring(0,8)}.pdf`, pdfBlob);
              setIsSavingToDrive(false);
          }

          window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: "Badge issued and shared link generated.", type: 'success' } }));
          pdf.save(`Neural_Badge_${badgeId.substring(0,8)}.pdf`);
      } catch (e) {
          console.error(e);
          alert("Issuance failed.");
      } finally {
          setIsExporting(false);
      }
  };

  const handleOpenBadgeFromGallery = (b: BadgeData) => {
      setPhoto(b.photoUrl);
      setPhotoTakenAt(b.photoTakenAt);
      setIsSecure(b.isSecure);
      setShareLink(`${window.location.origin}/?view=badge_viewer&id=${b.id}`);
      setViewMode('create');
  };

  const handleDeleteBadge = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Permanently delete this badge from registry?")) return;
    try {
        await deleteFirestoreDoc('badges', id);
        setMyBadges(prev => prev.filter(b => b.id !== id));
    } catch(e) { alert("Delete failed"); }
  };

  const qrCodeUrl = useMemo(() => {
      if (!userProfile?.certificate) return '';
      return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&bgcolor=ffffff&data=${encodeURIComponent(userProfile.certificate)}`;
  }, [userProfile?.certificate]);

  const barcodeUrl = useMemo(() => {
    return `https://barcodeapi.org/api/128/ID-${userProfile?.uid.substring(0, 12).toUpperCase()}`;
  }, [userProfile?.uid]);

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-20">
          <div className="flex items-center gap-4">
              <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"><ArrowLeft size={20} /></button>
              <div>
                <h1 className="text-lg font-bold text-white flex items-center gap-2 uppercase tracking-tighter italic">
                    <Fingerprint className="text-indigo-400" /> 
                    Badge Studio
                </h1>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Sovereign Identity Synthesizer</p>
              </div>
          </div>
          <div className="flex items-center gap-3">
              <button onClick={() => setViewMode('create')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'create' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:text-white'}`} > Library </button>
              {onOpenManual && <button onClick={onOpenManual} className="p-2 text-slate-400 hover:text-white" title="Badge Manual"><Info size={18}/></button>}
              <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                  <button onClick={() => setViewMode('create')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${viewMode === 'create' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}><LayoutGrid size={16}/></button>
                  <button onClick={() => setViewMode('gallery')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${viewMode === 'gallery' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}><History size={16}/></button>
              </div>
          </div>
      </header>

      {viewMode === 'create' ? (
        <div className="flex-1 flex overflow-hidden flex-col lg:flex-row animate-fade-in">
          {/* Controls Sidebar */}
          <div className="w-full lg:w-[400px] border-r border-slate-800 bg-slate-900/30 flex flex-col shrink-0 overflow-y-auto p-6 space-y-8 scrollbar-hide">
              <div className="flex p-1 bg-slate-950 rounded-2xl border border-slate-800">
                  <button onClick={() => setActiveTab('design')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === 'design' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>Configuration</button>
                  <button onClick={() => setActiveTab('capture')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === 'capture' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-50'}`}>Biometric Snap</button>
              </div>

              {activeTab === 'design' ? (
                  <div className="space-y-8 animate-fade-in">
                      <div className="space-y-4">
                          <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2"><Palette size={16} className="text-indigo-400"/> Security Layers</h3>
                          <div className="bg-slate-950 border border-slate-800 rounded-[2rem] p-6 space-y-6 shadow-inner">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-indigo-600/10 text-indigo-400 rounded-xl border border-indigo-500/20"><Zap size={20}/></div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Neural Seal</p>
                                            <p className="text-xs font-bold text-white">Generative Watermark</p>
                                        </div>
                                    </div>
                                    <button onClick={generateWatermark} disabled={isGeneratingWatermark} className="p-3 bg-slate-800 hover:bg-indigo-600 rounded-xl text-indigo-400 hover:text-white transition-all shadow-lg active:scale-95 border border-white/5">{isGeneratingWatermark ? <Loader2 size={18} className="animate-spin"/> : <Sparkles size={18}/>}</button>
                                </div>
                                {watermarkUrl && (
                                    <div className="space-y-4 animate-fade-in">
                                        <div className="flex items-center gap-4 bg-slate-900 rounded-2xl p-3 border border-indigo-500/20">
                                            <img src={watermarkUrl} className="w-12 h-12 rounded-lg object-contain bg-white" />
                                            <div className="flex-1 space-y-1">
                                                <div className="flex justify-between text-[10px] font-black uppercase text-slate-600"><span>Seal Opacity</span><span>{Math.round(watermarkOpacity * 100)}%</span></div>
                                                <input type="range" min="0.05" max="0.5" step="0.01" value={watermarkOpacity} onChange={e => setWatermarkOpacity(parseFloat(e.target.value))} className="w-full h-1 bg-slate-800 accent-indigo-500 rounded-full" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                          </div>
                      </div>

                      <div className="space-y-4">
                          <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2"><User size={16} className="text-indigo-400"/> Personalization</h3>
                          <div className="grid grid-cols-2 gap-4">
                              <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-3 p-6 bg-slate-950 border border-slate-800 rounded-3xl hover:border-indigo-500/50 transition-all shadow-inner group">
                                  <Upload className="text-slate-600 group-hover:text-indigo-400" size={24}/>
                                  <span className="text-[10px] font-black uppercase text-slate-500">Upload Photo</span>
                              </button>
                              <button onClick={startCamera} className="flex flex-col items-center gap-3 p-6 bg-slate-950 border border-slate-800 rounded-3xl hover:border-indigo-500/50 transition-all shadow-inner group">
                                  <Camera className="text-slate-600 group-hover:text-indigo-400" size={24}/>
                                  <span className="text-[10px] font-black uppercase text-slate-500">Camera</span>
                              </button>
                          </div>
                      </div>

                      {shareLink && (
                        <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-6 space-y-4 animate-fade-in-up">
                            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2"><Share2 size={16}/> Shared URI</h4>
                            <div className="flex gap-2">
                                <input readOnly value={shareLink} className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-[9px] font-mono text-indigo-300 truncate outline-none" />
                                <button onClick={() => { navigator.clipboard.writeText(shareLink); alert("URI Copied!"); }} className="p-2 bg-slate-800 hover:bg-indigo-600 rounded-lg text-white transition-all shadow-lg active:scale-95"><Link size={16}/></button>
                            </div>
                        </div>
                      )}

                      <button onClick={handleIssueBadge} disabled={isExporting || !photo} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-30">
                          {isExporting ? <Loader2 size={20} className="animate-spin mx-auto"/> : 'Generate & Issue Badge'}
                      </button>
                  </div>
              ) : (
                  <div className="space-y-8 animate-fade-in flex flex-col items-center justify-center py-10">
                      <div className="w-full aspect-square bg-slate-950 rounded-[3rem] border-2 border-indigo-500/30 overflow-hidden relative shadow-2xl">
                          {isCameraActive ? <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted /> : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-slate-800 gap-4"><Camera size={48} className="opacity-20" /><p className="text-[10px] font-black uppercase tracking-widest">Camera Inactive</p></div>
                          )}
                      </div>
                      <div className="flex gap-4 w-full">
                          {isCameraActive ? (
                              <><button onClick={capturePhoto} className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3"><Sparkles size={20}/> Capture</button><button onClick={stopCamera} className="p-4 bg-slate-800 hover:bg-red-600 rounded-2xl text-white transition-all shadow-lg"><X size={20}/></button></>
                          ) : <button onClick={startCamera} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3"><RefreshCw size={18}/> Re-initialize Sensor</button>}
                      </div>
                  </div>
              )}
          </div>

          {/* Badge Display Area */}
          <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center p-8 lg:p-12 relative overflow-y-auto scrollbar-hide">
              <div className="absolute top-10 flex bg-slate-900 border border-slate-800 p-1 rounded-xl shadow-2xl z-30">
                  <button onClick={() => setBadgeSide('front')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${badgeSide === 'front' ? 'bg-white text-black shadow-lg' : 'text-slate-500 hover:text-white'}`}>Identity View</button>
                  <button onClick={() => setBadgeSide('back')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${badgeSide === 'back' ? 'bg-white text-black shadow-lg' : 'text-slate-500 hover:text-white'}`}>Verification View</button>
              </div>

              <div className="relative group perspective mt-12 mb-20">
                  <div id={badgeSide === 'front' ? 'badge-front' : 'badge-back'} className={`w-[330px] h-[495px] bg-[#020617] rounded-[2.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.6)] overflow-hidden relative border border-white/10 flex flex-col transition-all duration-700 ${badgeSide === 'back' ? '[transform:rotateY(180deg)]' : ''}`} style={{ transformStyle: 'preserve-3d' }}>
                      {badgeSide === 'front' ? (
                          <div className="h-full w-full flex flex-col relative animate-fade-in">
                              <div className="h-1/2 p-10 flex items-center justify-center relative">
                                  <div className="w-full aspect-square bg-slate-900 rounded-[2rem] border-4 border-slate-800 overflow-hidden shadow-2xl relative">
                                      {photo ? <img src={photo} className="w-full h-full object-cover object-[center_20%] transform scale-105" crossOrigin="anonymous"/> : <div className="w-full h-full flex flex-col items-center justify-center text-slate-800 gap-4"><User size={64}/><p className="text-[9px] font-black uppercase tracking-widest opacity-40">Photo Pending</p></div>}
                                      {watermarkUrl && <div className="absolute inset-0 pointer-events-none flex items-center justify-center" style={{ opacity: watermarkOpacity }}><img src={watermarkUrl} className="w-48 h-48 object-contain mix-blend-screen" /></div>}
                                      <div className="absolute top-3 left-3">{isSecure ? <div className="px-2 py-0.5 bg-emerald-500 text-white rounded-full text-[7px] font-black uppercase flex items-center gap-1 shadow-lg border border-white/20"><ShieldCheck size={8}/> Secure</div> : <div className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full text-[7px] font-black uppercase flex items-center gap-1 shadow-lg border border-white/5"><Upload size={8}/> Standard</div>}</div>
                                  </div>
                              </div>
                              <div className="flex-1 p-10 pt-0 flex flex-col justify-between text-center relative z-10">
                                  <div className="space-y-1"><h2 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none">{userProfile?.displayName || 'MEMBER NAME'}</h2><p className="text-indigo-400 text-xs font-black uppercase tracking-[0.3em]">Verified Resident</p></div>
                                  <div className="space-y-4">
                                      <div className="grid grid-cols-2 gap-4">
                                          <div className="bg-slate-900/50 p-3 rounded-2xl border border-white/5"><p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Clearance</p><p className="text-[10px] font-bold text-white uppercase">{userProfile?.subscriptionTier || 'Level 0'}</p></div>
                                          <div className="bg-slate-900/50 p-3 rounded-2xl border border-white/5 text-left overflow-hidden"><p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Timestamp</p><div className="flex items-center gap-1 mt-0.5 text-[8px] font-mono text-indigo-200 uppercase truncate"><Clock size={8}/> {photoTakenAt ? new Date(photoTakenAt).toLocaleString() : 'N/A'}</div></div>
                                      </div>
                                      <div className="w-full h-2 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 rounded-full shadow-lg shadow-indigo-500/20"></div>
                                      <div className="flex justify-between items-center px-1"><span className="text-[8px] font-black text-slate-700 uppercase tracking-[0.4em]">Neural Prism Protocol</span><ShieldCheck size={14} className="text-indigo-500 opacity-60" /></div>
                                  </div>
                              </div>
                          </div>
                      ) : (
                          <div className="h-full w-full flex flex-col p-10 text-center relative bg-[#020617] [transform:rotateY(180deg)] animate-fade-in">
                              <div className="space-y-2 mb-10 shrink-0"><h3 className="text-lg font-black text-white uppercase italic tracking-tighter flex items-center justify-center gap-2"><Lock size={16} className="text-indigo-400"/> Cryptographic Shard</h3><p className="text-[9px] text-slate-500 leading-relaxed font-bold uppercase tracking-widest">Scan to verify sovereign identity signature offline</p></div>
                              <div className="flex-1 flex flex-col items-center justify-center"><div className="bg-white p-4 rounded-[2rem] shadow-2xl relative group"><img src={qrCodeUrl} className="w-48 h-48" alt="Identity Shard" /><div className="absolute inset-0 bg-indigo-600/5 group-hover:bg-indigo-600/10 transition-colors pointer-events-none rounded-[2rem]"></div></div><p className="text-[8px] font-mono text-slate-600 mt-6 break-all max-w-[200px] leading-tight">SHA-256_{userProfile?.certificate?.substring(10, 50)}...</p></div>
                              <div className="mt-10 space-y-6 pt-10 border-t border-white/5"><div className="flex justify-center grayscale opacity-60"><img src={barcodeUrl} className="h-10 w-full object-contain" alt="System Serial" /></div><div className="flex justify-between items-end"><div className="text-left"><p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Issue Date</p><p className="text-[10px] font-mono text-white">{new Date().toLocaleDateString()}</p></div><div className="text-right"><p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Binding ID</p><p className="text-[10px] font-mono text-white">#SYN-882-NP</p></div></div></div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
        </div>
      ) : (
          <div className="flex-1 overflow-y-auto p-8 lg:p-12 animate-fade-in scrollbar-hide">
              <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex justify-between items-end border-b border-slate-800 pb-8">
                    <div><h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">Member Archive</h2><p className="text-slate-500 text-sm font-medium">Verify your historical sovereign identities.</p></div>
                    <button onClick={() => setViewMode('create')} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all">New Synthesis</button>
                </div>
                {isLoadingGallery ? (
                    <div className="py-32 flex flex-col items-center justify-center gap-4 animate-pulse"><Loader2 size={40} className="animate-spin text-indigo-500"/><span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Paging Registry...</span></div>
                ) : myBadges.length === 0 ? (
                    <div className="py-32 text-center text-slate-700 italic border-2 border-dashed border-slate-800 rounded-[3rem]"><Activity size={64} className="mx-auto mb-4 opacity-10"/><p className="text-sm font-bold uppercase tracking-widest">Registry Empty</p></div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {myBadges.map(b => (
                            <div key={b.id} onClick={() => handleOpenBadgeFromGallery(b)} className="bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden hover:border-indigo-500 transition-all cursor-pointer group shadow-xl relative">
                                <div className="aspect-[3/4] relative overflow-hidden">
                                    <img src={b.photoUrl} className="w-full h-full object-cover object-[center_20%] opacity-60 group-hover:opacity-100 transition-opacity" crossOrigin="anonymous"/>
                                    <div className="absolute top-4 right-4">{b.isSecure ? <div className="p-1.5 bg-emerald-500 text-white rounded-full shadow-lg"><ShieldCheck size={14}/></div> : <div className="p-1.5 bg-slate-800 text-slate-400 rounded-full"><Upload size={14}/></div>}</div>
                                    <button onClick={(e) => handleDeleteBadge(e, b.id)} className="absolute top-4 left-4 p-1.5 bg-red-900/60 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14}/></button>
                                    <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-slate-950 to-transparent">
                                        <h4 className="text-white font-bold uppercase tracking-tight truncate">{b.displayName}</h4>
                                        <p className="text-[8px] font-mono text-slate-400 truncate mt-1">ID: {b.id}</p>
                                    </div>
                                </div>
                                <div className="p-5 flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-slate-500">
                                    <div className="flex items-center gap-1"><Clock size={10}/> {new Date(b.photoTakenAt).toLocaleDateString()}</div>
                                    <ChevronRight size={14}/>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
              </div>
          </div>
      )}

      {/* Hidden container for rendering both sides simultaneously during PDF export */}
      {isExporting && (
          <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
              <div id="badge-front" className="w-[330px] h-[495px] bg-[#020617] rounded-[2.5rem] relative overflow-hidden flex flex-col">
                  <div className="h-1/2 p-10 flex items-center justify-center relative">
                      <div className="w-full aspect-square bg-slate-900 rounded-[2rem] border-4 border-slate-800 overflow-hidden relative">
                          {photo && <img src={photo} className="w-full h-full object-cover object-[center_20%] transform scale-105" crossOrigin="anonymous"/>}
                          {watermarkUrl && <div className="absolute inset-0 flex items-center justify-center" style={{ opacity: watermarkOpacity }}><img src={watermarkUrl} className="w-48 h-48 object-contain mix-blend-screen" /></div>}
                          <div className="absolute top-3 left-3"><div style={{ padding: '2px 8px', backgroundColor: isSecure ? '#10b981' : '#1e293b', color: 'white', borderRadius: '999px', fontSize: '7px', fontWeight: '900' }}>{isSecure ? 'SECURE' : 'STANDARD'}</div></div>
                      </div>
                  </div>
                  <div className="flex-1 p-10 pt-0 flex flex-col justify-between text-center relative z-10">
                      <div className="space-y-1"><h2 style={{ color: 'white', fontSize: '30px', fontWeight: '900', fontStyle: 'italic', textTransform: 'uppercase' }}>{userProfile?.displayName || 'MEMBER NAME'}</h2><p style={{ color: '#818cf8', fontSize: '12px', fontWeight: '900', textTransform: 'uppercase' }}>Verified Resident</p></div>
                      <div className="space-y-4">
                          <div style={{ display: 'flex', gap: '16px' }}><div style={{ flex: 1, background: 'rgba(15, 23, 42, 0.5)', padding: '12px', borderRadius: '16px' }}><p style={{ fontSize: '8px', color: '#475569', textTransform: 'uppercase' }}>Clearance</p><p style={{ fontSize: '10px', color: 'white' }}>{userProfile?.subscriptionTier || 'Level 0'}</p></div><div style={{ flex: 1, background: 'rgba(15, 23, 42, 0.5)', padding: '12px', borderRadius: '16px' }}><p style={{ fontSize: '8px', color: '#475569', textTransform: 'uppercase' }}>Captured</p><p style={{ fontSize: '7px', color: '#818cf8' }}>{photoTakenAt ? new Date(photoTakenAt).toLocaleString() : 'N/A'}</p></div></div>
                          <div style={{ width: '100%', height: '8px', background: 'linear-gradient(to right, #06b6d4, #6366f1, #9333ea)', borderRadius: '999px' }}></div>
                      </div>
                  </div>
              </div>
              <div id="badge-back" className="w-[330px] h-[495px] bg-[#020617] rounded-[2.5rem] relative overflow-hidden flex flex-col p-10 text-center">
                  <div className="space-y-2 mb-10 shrink-0"><h3 style={{ color: 'white', fontSize: '18px', fontWeight: '900', textTransform: 'uppercase' }}>Cryptographic Shard</h3><p style={{ color: '#64748b', fontSize: '9px', fontWeight: 'bold' }}>Scan to verify sovereign identity signature offline</p></div>
                  <div className="flex-1 flex flex-col items-center justify-center"><div style={{ background: 'white', padding: '16px', borderRadius: '32px' }}><img src={qrCodeUrl} style={{ width: '192px', height: '192px' }} alt="Identity Shard" /></div><p style={{ fontSize: '8px', fontFamily: 'monospace', color: '#475569', marginTop: '24px' }}>SHA-256_{userProfile?.certificate?.substring(10, 50)}...</p></div>
                  <div style={{ marginTop: '40px', paddingTop: '40px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}><div style={{ display: 'flex', justifyContent: 'center', opacity: 0.6, filter: 'grayscale(100%)' }}><img src={barcodeUrl} style={{ height: '40px', width: '100%' }} alt="System Serial" /></div><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '24px' }}><div style={{ textAlign: 'left' }}><p style={{ fontSize: '10px', color: '#818cf8', textTransform: 'uppercase' }}>Issue Date</p><p style={{ fontSize: '10px', color: 'white' }}>{new Date().toLocaleDateString()}</p></div><div style={{ textAlign: 'right' }}><p style={{ fontSize: '10px', color: '#818cf8', textTransform: 'uppercase' }}>Binding ID</p><p style={{ fontSize: '10px', color: 'white' }}>#SYN-882-NP</p></div></div></div>
              </div>
          </div>
      )}

      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default BadgeStudio;
