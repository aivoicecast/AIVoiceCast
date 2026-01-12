
import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, ReaderTheme, UserAvailability } from '../types';
import { X, User, Shield, CreditCard, LogOut, CheckCircle, AlertTriangle, Bell, Lock, Database, Trash2, Edit2, Save, FileText, ExternalLink, Loader2, DollarSign, HelpCircle, ChevronDown, ChevronUp, ChevronRight, Github, Heart, Hash, Cpu, Sparkles, MapPin, PenTool, Hash as HashIcon, Globe, Zap, Crown, Linkedin, Upload, FileUp, FileCheck, Check, Link, Type, Sun, Moon, Coffee, Palette, Code2, Youtube, HardDrive, Calendar, Clock, Info, Globe2, Terminal } from 'lucide-react';
import { logUserActivity, updateUserProfile, uploadFileToStorage } from '../services/firestoreService';
import { signOut, getDriveToken, connectGoogleDrive } from '../services/authService';
import { clearAudioCache } from '../services/tts';
import { TOPIC_CATEGORIES } from '../utils/initialData';
import { Whiteboard } from './Whiteboard';
import { GoogleGenAI } from '@google/genai';
import { ensureFolder, uploadToDrive } from '../services/googleDriveService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onUpdateProfile?: (updated: UserProfile) => void;
  onUpgradeClick?: () => void;
  isSuperAdmin?: boolean;
  onNavigateAdmin?: () => void;
}

const THEME_OPTIONS: { id: ReaderTheme, label: string, icon: any, desc: string }[] = [
    { id: 'slate', label: 'Slate', icon: Palette, desc: 'Classic Neural Prism dark' },
    { id: 'light', label: 'Paper', icon: Sun, desc: 'Clean high-contrast light' },
    { id: 'dark', label: 'Night', icon: Moon, desc: 'Deep black for reading' },
    { id: 'sepia', label: 'Sepia', icon: Coffee, desc: 'Warm low-eye-strain' }
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, onClose, user, onUpdateProfile, onUpgradeClick, isSuperAdmin, onNavigateAdmin
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'interests' | 'profile' | 'availability' | 'banking'>('general');
  const [isSaving, setIsSaving] = useState(false);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [defaultRepo, setDefaultRepo] = useState(user.defaultRepoUrl || '');
  const [defaultLanguage, setDefaultLanguage] = useState(user.defaultLanguage || 'C++');
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openai'>(user.preferredAiProvider || 'gemini');
  const [readerTheme, setReaderTheme] = useState<ReaderTheme>(user.preferredReaderTheme || 'slate');
  const [recordingTarget, setRecordingTarget] = useState<'youtube' | 'drive'>(user.preferredRecordingTarget || 'drive');
  const [selectedInterests, setSelectedInterests] = useState<string[]>(user.interests || []);
  
  // Availability State
  const [availability, setAvailability] = useState<UserAvailability>(user.availability || {
      days: [1, 2, 3, 4, 5],
      startHour: 9,
      endHour: 18,
      enabled: true
  });

  // LinkedIn Profile Simulation
  const [headline, setHeadline] = useState(user.headline || '');
  const [company, setCompany] = useState(user.company || '');
  const [linkedinUrl, setLinkedinUrl] = useState(user.linkedinUrl || '');
  const [resumeText, setResumeText] = useState(user.resumeText || '');
  const [resumeUploadStatus, setResumeUploadStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [resumeStatusMsg, setResumeStatusMsg] = useState('');
  const resumeInputRef = useRef<HTMLInputElement>(null);

  // Banking Profile State
  const [senderAddress, setSenderAddress] = useState(user.senderAddress || '');
  const [signaturePreview, setSignaturePreview] = useState(user.savedSignatureUrl || '');
  const [nextCheckNumber, setNextCheckNumber] = useState(user.nextCheckNumber || 1001);
  const [showSignPad, setShowSignPad] = useState(false);
  
  const currentTier = user.subscriptionTier || 'free';
  const isPaid = currentTier === 'pro';

  useEffect(() => {
      if (isOpen) {
          setSelectedInterests(user.interests || []);
          setAiProvider(user.preferredAiProvider || 'gemini');
          setReaderTheme(user.preferredReaderTheme || 'slate');
          setRecordingTarget(user.preferredRecordingTarget || 'drive');
          setSenderAddress(user.senderAddress || '');
          setSignaturePreview(user.savedSignatureUrl || '');
          setNextCheckNumber(user.nextCheckNumber || 1001);
          setDisplayName(user.displayName);
          setDefaultRepo(user.defaultRepoUrl || '');
          setDefaultLanguage(user.defaultLanguage || 'C++');
          setHeadline(user.headline || '');
          setCompany(user.company || '');
          setLinkedinUrl(user.linkedinUrl || '');
          setResumeText(user.resumeText || '');
          setAvailability(user.availability || { days: [1,2,3,4,5], startHour: 9, endHour: 18, enabled: true });
          setResumeUploadStatus('idle');
          setResumeStatusMsg('');
      }
  }, [isOpen, user]);

  const handleResumeRefraction = async (source: { file?: File, url?: string }) => {
      setResumeUploadStatus('processing');
      setResumeStatusMsg('Neural Spectrum scanning source...');
      
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          let part: any;

          if (source.url) {
              // Direct URL Ingestion via new API feature
              part = { fileData: { mimeType: 'application/pdf', fileUri: source.url } };
          } else if (source.file) {
              const base64 = await new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve((reader.result as string).split(',')[1]);
                  reader.readAsDataURL(source.file!);
              });
              part = { inlineData: { data: base64, mimeType: source.file.type } };
          }

          const response = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: {
                  parts: [
                      part,
                      { text: "Extract a professional summary and key skills from this resume. Focus on technical keywords, years of experience, and core impact. Return formatted text only." }
                  ]
              }
          });
          const parsedText = response.text || "";
          setResumeText(parsedText);
          
          let firebaseResumeUrl = user.resumeUrl || '';
          if (source.file) {
              setResumeStatusMsg('Syncing to Cloud Storage...');
              firebaseResumeUrl = await uploadFileToStorage(`users/${user.uid}/resume.pdf`, source.file);
              
              try {
                setResumeStatusMsg('Backing up to Google Drive...');
                const token = getDriveToken() || await connectGoogleDrive();
                if (token) {
                    const studioFolderId = await ensureFolder(token, 'CodeStudio');
                    const resumesFolderId = await ensureFolder(token, 'Resumes', studioFolderId);
                    await uploadToDrive(token, resumesFolderId, `Resume_${user.displayName.replace(/\s+/g, '_')}.pdf`, source.file);
                }
              } catch(driveErr) {}
          } else if (source.url) {
              firebaseResumeUrl = source.url;
          }

          await updateUserProfile(user.uid, { 
              resumeUrl: firebaseResumeUrl,
              resumeText: parsedText 
          });

          if (onUpdateProfile) {
              onUpdateProfile({ ...user, resumeUrl: firebaseResumeUrl, resumeText: parsedText });
          }

          setResumeUploadStatus('success');
          setResumeStatusMsg('Refraction verified!');
          setTimeout(() => setResumeUploadStatus('idle'), 3000);
      } catch (err: any) {
          console.error(err);
          setResumeUploadStatus('error');
          setResumeStatusMsg('Refraction failed: ' + (err.message || 'Check access'));
      }
  };

  const handleResumeFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) handleResumeRefraction({ file: e.target.files[0] });
  };

  const handleResumeUrlSelect = () => {
      const url = prompt("Paste publicly accessible PDF URL of your resume:");
      if (url) handleResumeRefraction({ url });
  };

  const handleSaveAll = async () => {
      setIsSaving(true);
      try {
          let finalSigUrl = signaturePreview;
          if (signaturePreview.startsWith('data:')) {
              const res = await fetch(signaturePreview);
              const blob = await res.blob();
              finalSigUrl = await uploadFileToStorage(`users/${user.uid}/signature_profile.png`, blob);
          }

          const updateData: Partial<UserProfile> = {
              displayName,
              defaultRepoUrl: defaultRepo,
              defaultLanguage,
              interests: selectedInterests,
              preferredAiProvider: aiProvider,
              preferredReaderTheme: readerTheme,
              preferredRecordingTarget: recordingTarget,
              senderAddress,
              savedSignatureUrl: finalSigUrl,
              nextCheckNumber,
              headline,
              company,
              linkedinUrl,
              resumeText,
              availability
          };

          await updateUserProfile(user.uid, updateData);
          if (onUpdateProfile) onUpdateProfile({ ...user, ...updateData, savedSignatureUrl: finalSigUrl });
          
          setIsSaving(false);
          onClose();
      } catch(e: any) {
          alert("Save failed: " + e.message);
          setIsSaving(false);
      }
  };

  const handleLogout = async () => {
    if (confirm("Sign out of Neural Prism?")) {
        await signOut();
        onClose();
    }
  };

  const toggleDay = (day: number) => {
    setAvailability(prev => ({
        ...prev,
        days: prev.days.includes(day) ? prev.days.filter(d => d !== day) : [...prev.days, day]
    }));
  };

  const toggleInterest = (topic: string) => {
      setSelectedInterests(prev => prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
        
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950 shrink-0">
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <User className="text-indigo-400 w-5 h-5" />
            <span>Settings</span>
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex border-b border-slate-800 bg-slate-900/50 shrink-0 overflow-x-auto no-scrollbar">
            <button onClick={() => setActiveTab('general')} className={`flex-1 py-3 px-4 text-xs font-black uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap ${activeTab === 'general' ? 'border-indigo-500 text-white bg-slate-800' : 'border-transparent text-slate-500 hover:text-slate-200'}`}>General</button>
            <button onClick={() => setActiveTab('profile')} className={`flex-1 py-3 px-4 text-xs font-black uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap ${activeTab === 'profile' ? 'border-indigo-500 text-white bg-slate-800' : 'border-transparent text-slate-500 hover:text-slate-200'}`}>Professional</button>
            <button onClick={() => setActiveTab('availability')} className={`flex-1 py-3 px-4 text-xs font-black uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap ${activeTab === 'availability' ? 'border-indigo-500 text-white bg-slate-800' : 'border-transparent text-slate-500 hover:text-slate-200'}`}>Availability</button>
            <button onClick={() => setActiveTab('interests')} className={`flex-1 py-3 px-4 text-xs font-black uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap ${activeTab === 'interests' ? 'border-indigo-500 text-white bg-slate-800' : 'border-transparent text-slate-500 hover:text-slate-200'}`}>Interests</button>
            <button onClick={() => setActiveTab('banking')} className={`flex-1 py-3 px-4 text-xs font-black uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap ${activeTab === 'banking' ? 'border-indigo-500 text-white bg-slate-800' : 'border-transparent text-slate-500 hover:text-slate-200'}`}>Checks</button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-slate-900 scrollbar-hide">
            {activeTab === 'general' && (
                <div className="space-y-8 animate-fade-in">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                        <div className="relative">
                            {user.photoURL ? <img src={user.photoURL} alt={user.displayName} className="w-24 h-24 rounded-full border-4 border-slate-800 object-cover shadow-xl" /> : <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 border-4 border-slate-800 shadow-xl"><User size={40} /></div>}
                        </div>
                        <div className="flex-1 space-y-4 w-full">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Display Name</label>
                                <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner" />
                            </div>
                            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-inner">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-xl ${isPaid ? 'bg-emerald-600' : 'bg-slate-800'} text-white shadow-lg`}>{isPaid ? <Crown size={20} fill="currentColor"/> : <User size={20}/>}</div>
                                    <div><p className="text-xs font-black text-slate-500 uppercase tracking-widest">Tier</p><p className={`text-sm font-bold ${isPaid ? 'text-emerald-400' : 'text-slate-300'}`}>{currentTier.toUpperCase()}</p></div>
                                </div>
                                {!isPaid && <button onClick={onUpgradeClick} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase rounded-lg shadow-lg">Upgrade</button>}
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                        <div className="space-y-4"><h4 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2"><HardDrive size={16} className="text-indigo-400"/> Recording</h4><div className="space-y-2"><label className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${recordingTarget === 'drive' ? 'bg-indigo-900/20 border-indigo-500 ring-1 ring-indigo-500' : 'bg-slate-950 border-slate-800'}`}><div className="flex items-center gap-3"><input type="radio" checked={recordingTarget === 'drive'} onChange={() => setRecordingTarget('drive')} className="accent-indigo-500 w-4 h-4"/><div><p className="text-sm font-bold text-white">Drive</p></div></div><HardDrive size={20} className={recordingTarget === 'drive' ? 'text-indigo-400' : 'text-slate-700'}/></label><label className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${recordingTarget === 'youtube' ? 'bg-red-900/20 border-red-500 ring-1 ring-red-500' : 'bg-slate-950 border-slate-800'}`}><div className="flex items-center gap-3"><input type="radio" checked={recordingTarget === 'youtube'} onChange={() => setRecordingTarget('youtube')} className="accent-red-500 w-4 h-4"/><div><p className="text-sm font-bold text-white">YouTube</p></div></div><Youtube size={20} className={recordingTarget === 'youtube' ? 'text-red-400' : 'text-slate-700'}/></label></div></div>
                        <div className="space-y-4"><h4 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2"><Cpu size={16}/> Engine</h4><div className="space-y-2"><label className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${aiProvider === 'gemini' ? 'bg-indigo-900/20 border-indigo-500 ring-1 ring-indigo-500' : 'bg-slate-950 border-slate-800'}`}><div className="flex items-center gap-3"><input type="radio" checked={aiProvider === 'gemini'} onChange={() => setAiProvider('gemini')} className="accent-indigo-500 w-4 h-4"/><div><p className="text-sm font-bold text-white">Gemini</p></div></div><Sparkles size={20} className={aiProvider === 'gemini' ? 'text-indigo-400' : 'text-slate-700'}/></label><label className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${aiProvider === 'openai' ? 'bg-emerald-900/20 border-emerald-500 ring-1 ring-emerald-500' : 'bg-slate-950 border-slate-800'}`}><div className="flex items-center gap-3"><input type="radio" checked={aiProvider === 'openai'} onChange={() => setAiProvider('openai')} className="accent-emerald-500 w-4 h-4"/><div><p className="text-sm font-bold text-white">GPT</p></div></div><Zap size={20} className={aiProvider === 'openai' ? 'text-emerald-400' : 'text-slate-700'}/></label></div></div>
                    </div>

                    {isSuperAdmin && (
                        <div className="pt-8 border-t border-slate-800 space-y-4">
                            <h4 className="text-xs font-bold text-red-400 uppercase tracking-[0.2em] flex items-center gap-2"><Terminal size={16}/> Admin Spectrum</h4>
                            <button 
                                onClick={() => { onClose(); onNavigateAdmin?.(); }}
                                className="w-full flex items-center justify-between p-4 bg-red-900/10 border border-red-900/30 rounded-2xl hover:bg-red-900/20 transition-all group"
                            >
                                <div className="flex items-center gap-3 text-red-200">
                                    <Shield size={20}/>
                                    <div className="text-left">
                                        <p className="text-sm font-bold">Open Admin Inspector</p>
                                        <p className="text-[10px] opacity-60">Manage system channels and user tiers.</p>
                                    </div>
                                </div>
                                <ChevronRight className="text-red-900 group-hover:text-red-400 group-hover:translate-x-1 transition-all" size={20}/>
                            </button>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'profile' && (
                <div className="space-y-8 animate-fade-in">
                    <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-xl p-4 flex items-center gap-3">
                        <Linkedin className="text-indigo-400" size={24}/>
                        <div><h3 className="text-sm font-bold text-white">Expert Profile</h3><p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-0.5">Mock Interview Handshake Context</p></div>
                    </div>
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Headline</label><input type="text" value={headline} onChange={e => setHeadline(e.target.value)} placeholder="Senior Software Engineer..." className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:ring-1 focus:ring-indigo-500 outline-none"/></div>
                            <div><label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Company</label><input type="text" value={company} onChange={e => setCompany(e.target.value)} placeholder="Tech Corp" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:ring-1 focus:ring-indigo-500 outline-none"/></div>
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-2 px-1"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Neural Resume Refraction</label><div className="flex gap-2"><button onClick={handleResumeUrlSelect} className="text-[10px] font-black text-indigo-400 flex items-center gap-1 hover:text-white transition-all"><Globe2 size={12}/> Link PDF URI</button><button onClick={() => resumeInputRef.current?.click()} className="text-[10px] font-black text-emerald-400 flex items-center gap-1 hover:text-white transition-all"><FileUp size={12}/> Upload PDF</button></div></div>
                            <div className="relative">
                                <textarea value={resumeText} onChange={e => setResumeText(e.target.value)} rows={8} placeholder="Upload or link a resume to start analysis..." className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs font-mono text-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none leading-relaxed resize-none shadow-inner" />
                                {resumeUploadStatus !== 'idle' && (
                                    <div className={`absolute inset-0 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center gap-3 transition-all ${resumeUploadStatus === 'success' ? 'bg-emerald-950/80' : resumeUploadStatus === 'error' ? 'bg-red-950/80' : 'bg-slate-950/60'}`}>
                                        {resumeUploadStatus === 'processing' && <Loader2 className="animate-spin text-indigo-400" size={32}/>}{resumeUploadStatus === 'success' && <CheckCircle size={32} className="text-white"/>}{resumeUploadStatus === 'error' && <X size={32} className="text-white"/>}
                                        <span className="text-xs font-black text-white uppercase tracking-widest">{resumeStatusMsg}</span>
                                        {resumeUploadStatus !== 'processing' && <button onClick={() => setResumeUploadStatus('idle')} className="mt-2 text-[10px] font-bold text-white/60 hover:text-white underline uppercase">Dismiss</button>}
                                    </div>
                                )}
                            </div>
                            <input type="file" ref={resumeInputRef} className="hidden" accept=".pdf,.txt" onChange={handleResumeFileSelect} />
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'availability' && (
                <div className="space-y-8 animate-fade-in">
                    <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-xl p-4 flex items-center gap-3"><Calendar className="text-indigo-400" size={24}/><div><h3 className="text-sm font-bold text-white">Office Hours</h3><p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-0.5">Control when peers can book technical sessions with you</p></div></div>
                    <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-2xl"><div><p className="text-sm font-bold text-white">Accept Appointments</p></div><button onClick={() => setAvailability({...availability, enabled: !availability.enabled})} className={`w-12 h-6 rounded-full transition-all relative ${availability.enabled ? 'bg-indigo-600' : 'bg-slate-700'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${availability.enabled ? 'right-1' : 'left-1'}`}></div></button></div>
                        <div><label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">Available Days</label><div className="flex gap-2">{DAYS.map((day, i) => (<button key={day} onClick={() => toggleDay(i)} className={`flex-1 py-3 rounded-xl border text-xs font-black transition-all ${availability.days.includes(i) ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-600'}`}>{day.charAt(0)}</button>))}</div></div>
                    </div>
                </div>
            )}

            {activeTab === 'interests' && (
                <div className="space-y-6 animate-fade-in">{Object.keys(TOPIC_CATEGORIES).map(category => (<div key={category} className="bg-slate-800/30 border border-slate-800 rounded-2xl p-5"><h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-slate-800 pb-2"><HashIcon size={12} className="text-indigo-400" /> {category}</h4><div className="flex flex-wrap gap-2">{TOPIC_CATEGORIES[category].map(tag => (<button key={tag} onClick={() => toggleInterest(tag)} className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 ${selectedInterests.includes(tag) ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-50'}`}>{tag}</button>))}</div></div>))}</div>
            )}

            {activeTab === 'banking' && (
                <div className="space-y-8 animate-fade-in"><div className="bg-indigo-900/10 border border-indigo-500/20 rounded-xl p-4 flex items-start gap-4"><div className="p-2 bg-indigo-600 rounded-lg text-white shadow-lg"><PenTool size={20}/></div><div><h3 className="text-sm font-bold text-white">Check Template</h3><p className="text-xs text-slate-400">Save details for refracting financial assets.</p></div></div><div className="space-y-6"><div><label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1"><MapPin size={12} className="text-indigo-400"/> Address</label><textarea value={senderAddress} onChange={(e) => setSenderAddress(e.target.value)} rows={3} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none leading-relaxed transition-all shadow-inner"/></div><div><label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1"><PenTool size={12}/> Signature</label>{signaturePreview ? (<div className="relative w-full aspect-[3/1] bg-white rounded-xl border border-slate-700 overflow-hidden group shadow-lg"><img src={signaturePreview} className="w-full h-full object-contain p-4"/><div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3"><button onClick={() => setShowSignPad(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-lg">Change</button><button onClick={() => setSignaturePreview('')} className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold shadow-lg">Remove</button></div></div>) : (<button onClick={() => setShowSignPad(true)} className="w-full aspect-[3/1] border-2 border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-600 hover:border-indigo-500 bg-slate-950/50"><PenTool size={32} className="opacity-20"/><span className="text-[10px] font-bold uppercase tracking-widest">Register Signature</span></button>)}</div></div></div>
            )}
        </div>

        <div className="p-5 border-t border-slate-800 bg-slate-950 flex items-center justify-between shrink-0 shadow-2xl">
             <button onClick={handleLogout} className="flex items-center gap-2 text-xs font-black text-slate-500 hover:text-red-400 transition-all uppercase tracking-widest px-3 py-2 rounded-lg hover:bg-red-950/20"><LogOut size={16} /> Exit</button>
             <div className="flex items-center gap-3"><button onClick={onClose} className="px-6 py-2.5 text-xs font-bold text-slate-400 hover:text-white">Cancel</button><button onClick={handleSaveAll} disabled={isSaving} className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-[0.2em] rounded-xl shadow-xl flex items-center gap-2 transition-all active:scale-0.98">{isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}<span>Apply Spectrum</span></button></div>
        </div>
      </div>

      {showSignPad && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in"><div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl p-6 shadow-2xl animate-fade-in-up"><div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-white flex items-center gap-2"><PenTool size={20} className="text-indigo-400"/> Signature Studio</h3><button onClick={() => setShowSignPad(false)} className="p-2 text-slate-500 hover:text-white"><X/></button></div><div className="h-[300px] border-2 border-dashed border-slate-800 rounded-2xl overflow-hidden mb-6 bg-white"><Whiteboard backgroundColor="transparent" initialColor="#000000" /></div><div className="flex justify-end gap-2"><button onClick={() => setShowSignPad(false)} className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold">Cancel</button><button onClick={() => { const canvas = document.querySelector('.fixed canvas') as HTMLCanvasElement; if (canvas) setSignaturePreview(canvas.toDataURL('image/png')); setShowSignPad(false); }} className="px-8 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-lg">Confirm</button></div></div></div>
      )}
    </div>
  );
};

export default SettingsModal;
