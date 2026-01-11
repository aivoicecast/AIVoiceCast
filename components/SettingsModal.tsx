import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, ReaderTheme, UserAvailability } from '../types';
import { X, User, Shield, CreditCard, LogOut, CheckCircle, AlertTriangle, Bell, Lock, Database, Trash2, Edit2, Save, FileText, ExternalLink, Loader2, DollarSign, HelpCircle, ChevronDown, ChevronUp, Github, Heart, Hash, Cpu, Sparkles, MapPin, PenTool, Hash as HashIcon, Globe, Zap, Crown, Linkedin, Upload, FileUp, FileCheck, Check, Link, Type, Sun, Moon, Coffee, Palette, Code2, Youtube, HardDrive, Calendar, Clock, Info } from 'lucide-react';
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
}

const THEME_OPTIONS: { id: ReaderTheme, label: string, icon: any, desc: string }[] = [
    { id: 'slate', label: 'Slate', icon: Palette, desc: 'Classic Neural Prism dark' },
    { id: 'light', label: 'Paper', icon: Sun, desc: 'Clean high-contrast light' },
    { id: 'dark', label: 'Night', icon: Moon, desc: 'Deep black for reading' },
    { id: 'sepia', label: 'Sepia', icon: Coffee, desc: 'Warm low-eye-strain' }
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, onClose, user, onUpdateProfile, onUpgradeClick 
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

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      setResumeUploadStatus('processing');
      setResumeStatusMsg('Neural Prism scanning PDF...');
      
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const base64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve((reader.result as string).split(',')[1]);
              reader.readAsDataURL(file);
          });

          const response = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: {
                  parts: [
                      { inlineData: { data: base64, mimeType: file.type } },
                      { text: "Extract a professional summary and key skills from this resume. Focus on technical keywords and experience levels. Return text only." }
                  ]
              }
          });
          const parsedText = response.text || "";
          setResumeText(parsedText);
          
          setResumeStatusMsg('Syncing to Cloud Storage...');
          const firebaseResumeUrl = await uploadFileToStorage(`users/${user.uid}/resume.pdf`, file);
          
          try {
            setResumeStatusMsg('Backing up to Google Drive...');
            const token = getDriveToken() || await connectGoogleDrive();
            if (token) {
                const studioFolderId = await ensureFolder(token, 'CodeStudio');
                const resumesFolderId = await ensureFolder(token, 'Resumes', studioFolderId);
                await uploadToDrive(token, resumesFolderId, `Resume_${user.displayName.replace(/\s/g, '_')}.pdf`, file);
            }
          } catch(driveErr) {
            console.warn("Drive backup skipped or failed", driveErr);
          }

          await updateUserProfile(user.uid, { 
              resumeUrl: firebaseResumeUrl,
              resumeText: parsedText 
          });

          if (onUpdateProfile) {
              onUpdateProfile({ ...user, resumeUrl: firebaseResumeUrl, resumeText: parsedText });
          }

          setResumeUploadStatus('success');
          setResumeStatusMsg('Resume verified and synced!');
          setTimeout(() => setResumeUploadStatus('idle'), 3000);
      } catch (err) {
          console.error(err);
          setResumeUploadStatus('error');
          setResumeStatusMsg('Upload failed. Please try again.');
      }
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

          const updatedProfile = { ...user, ...updateData, savedSignatureUrl: finalSigUrl };
          if (onUpdateProfile) onUpdateProfile(updatedProfile);
          
          setIsSaving(false);
          onClose();
      } catch(e: any) {
          alert("Failed to save settings: " + e.message);
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
      setSelectedInterests(prev => 
          prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]
      );
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
            <button onClick={() => setActiveTab('general')} className={`flex-1 py-3 px-4 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'general' ? 'border-indigo-500 text-white bg-slate-800' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>General</button>
            <button onClick={() => setActiveTab('profile')} className={`flex-1 py-3 px-4 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'profile' ? 'border-indigo-500 text-white bg-slate-800' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>Professional</button>
            <button onClick={() => setActiveTab('availability')} className={`flex-1 py-3 px-4 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'availability' ? 'border-indigo-500 text-white bg-slate-800' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>Availability</button>
            <button onClick={() => setActiveTab('interests')} className={`flex-1 py-3 px-4 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'interests' ? 'border-indigo-500 text-white bg-slate-800' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>Interests</button>
            <button onClick={() => setActiveTab('banking')} className={`flex-1 py-3 px-4 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'banking' ? 'border-indigo-500 text-white bg-slate-800' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>Check Profile</button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-slate-900 scrollbar-thin scrollbar-thumb-slate-800">
            
            {activeTab === 'general' && (
                <div className="space-y-8 animate-fade-in">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                        <div className="relative">
                            {user.photoURL ? (
                                <img src={user.photoURL} alt={user.displayName} className="w-24 h-24 rounded-full border-4 border-slate-800 object-cover shadow-xl" />
                            ) : (
                                <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 border-4 border-slate-800 shadow-xl"><User size={40} /></div>
                            )}
                            <div className="absolute -bottom-1 -right-1 p-2 bg-indigo-600 rounded-full border-4 border-slate-900 text-white shadow-lg"><Globe size={14}/></div>
                        </div>
                        <div className="flex-1 space-y-4 w-full">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Profile Display Name</label>
                                <input 
                                    type="text" 
                                    value={displayName} 
                                    onChange={(e) => setDisplayName(e.target.value)} 
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                                />
                            </div>
                            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-inner">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-xl ${isPaid ? 'bg-emerald-600' : 'bg-slate-800'} text-white shadow-lg`}>
                                        {isPaid ? <Crown size={20} fill="currentColor"/> : <User size={20}/>}
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Membership Tier</p>
                                        <p className={`text-sm font-bold ${isPaid ? 'text-emerald-400' : 'text-slate-300'}`}>{currentTier.toUpperCase()}</p>
                                    </div>
                                </div>
                                {!isPaid && (
                                    <button 
                                        onClick={onUpgradeClick}
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase rounded-lg shadow-lg active:scale-95 transition-all"
                                    >
                                        Upgrade to Pro
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2"><HardDrive size={16} className="text-indigo-400"/> Recording Destination</h4>
                            <div className="space-y-2">
                                <label className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${recordingTarget === 'drive' ? 'bg-indigo-900/20 border-indigo-500 ring-1 ring-indigo-500' : 'bg-slate-950 border-slate-800 hover:bg-slate-800'}`}>
                                    <div className="flex items-center gap-3">
                                        <input type="radio" name="recordingTarget" checked={recordingTarget === 'drive'} onChange={() => setRecordingTarget('drive')} className="accent-indigo-500 w-4 h-4"/>
                                        <div><p className="text-sm font-bold text-white">Google Drive</p><p className="text-[10px] text-slate-500 uppercase tracking-tighter">Private Storage</p></div>
                                    </div>
                                    <HardDrive size={20} className={recordingTarget === 'drive' ? 'text-indigo-400' : 'text-slate-700'}/>
                                </label>
                                <label className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${recordingTarget === 'youtube' ? 'bg-red-900/20 border-red-500 ring-1 ring-red-500' : 'bg-slate-950 border-slate-800 hover:bg-slate-800'}`}>
                                    <div className="flex items-center gap-3">
                                        <input type="radio" name="recordingTarget" checked={recordingTarget === 'youtube'} onChange={() => setRecordingTarget('youtube')} className="accent-red-500 w-4 h-4"/>
                                        <div><p className="text-sm font-bold text-white">YouTube</p><p className="text-[10px] text-slate-500 uppercase tracking-tighter">Social Video</p></div>
                                    </div>
                                    <Youtube size={20} className={recordingTarget === 'youtube' ? 'text-red-400' : 'text-slate-700'}/>
                                </label>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2"><Cpu size={16}/> Preferred AI Engine</h4>
                            <div className="space-y-2">
                                <label className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${aiProvider === 'gemini' ? 'bg-indigo-900/20 border-indigo-500 ring-1 ring-indigo-500' : 'bg-slate-950 border-slate-800 hover:bg-slate-800'}`}>
                                    <div className="flex items-center gap-3">
                                        <input type="radio" name="aiProvider" checked={aiProvider === 'gemini'} onChange={() => setAiProvider('gemini')} className="accent-indigo-500 w-4 h-4"/>
                                        <div><p className="text-sm font-bold text-white">Google Gemini</p><p className="text-[10px] text-slate-500 uppercase tracking-tighter">Native Engine</p></div>
                                    </div>
                                    <Sparkles size={20} className={aiProvider === 'gemini' ? 'text-indigo-400' : 'text-slate-700'}/>
                                </label>
                                <label className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${aiProvider === 'openai' ? 'bg-emerald-900/20 border-emerald-500 ring-1 ring-emerald-500' : 'bg-slate-950 border-slate-800 hover:bg-slate-800'}`}>
                                    <div className="flex items-center gap-3">
                                        <input type="radio" name="aiProvider" checked={aiProvider === 'openai'} onChange={() => setAiProvider('openai')} className="accent-emerald-500 w-4 h-4"/>
                                        <div><p className="text-sm font-bold text-white">OpenAI GPT</p><p className="text-[10px] text-slate-500 uppercase tracking-tighter">Requires Pro</p></div>
                                    </div>
                                    <Zap size={20} className={aiProvider === 'openai' ? 'text-emerald-400' : 'text-slate-700'}/>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 pt-4">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2"><Palette size={16}/> Preferred Reader Theme</h4>
                        <div className="grid grid-cols-2 gap-3">
                            {THEME_OPTIONS.map((theme) => {
                                const TIcon = theme.icon;
                                return (
                                    <button 
                                        key={theme.id}
                                        onClick={() => setReaderTheme(theme.id)}
                                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left group ${readerTheme === theme.id ? 'bg-indigo-900/20 border-indigo-500 ring-1 ring-indigo-500' : 'bg-slate-950 border-slate-800 hover:bg-slate-800'}`}
                                    >
                                        <div className={`p-2 rounded-lg transition-colors ${readerTheme === theme.id ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500 group-hover:text-slate-300'}`}>
                                            <TIcon size={18}/>
                                        </div>
                                        <div>
                                            <p className={`text-xs font-bold ${readerTheme === theme.id ? 'text-indigo-200' : 'text-slate-400'}`}>{theme.label}</p>
                                            <p className="text-[9px] text-slate-500 uppercase tracking-tighter">{theme.desc}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'profile' && (
                <div className="space-y-8 animate-fade-in">
                    <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-xl p-4 flex items-center gap-3">
                        <Linkedin className="text-indigo-400" size={24}/>
                        <div>
                            <h3 className="text-sm font-bold text-white">Professional Profile</h3>
                            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-0.5">Used for Mock Interviews & Talent Discovery</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Headline</label>
                                <input type="text" value={headline} onChange={e => setHeadline(e.target.value)} placeholder="Senior Software Engineer..." className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:ring-1 focus:ring-indigo-500 outline-none"/>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Current Company</label>
                                <input type="text" value={company} onChange={e => setCompany(e.target.value)} placeholder="Tech Corp" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:ring-1 focus:ring-indigo-500 outline-none"/>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1"><Link size={12} className="text-indigo-400" /> LinkedIn Profile URI</label>
                            <input type="text" value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} placeholder="https://www.linkedin.com/in/username" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:ring-1 focus:ring-indigo-500 outline-none"/>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2 px-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Resume Summary</label>
                                <button onClick={() => resumeInputRef.current?.click()} className="text-[10px] font-black text-indigo-400 flex items-center gap-1 hover:text-white transition-all">
                                    <FileUp size={12}/> Update PDF
                                </button>
                            </div>
                            <div className="relative">
                                <textarea 
                                    value={resumeText} 
                                    onChange={e => setResumeText(e.target.value)} 
                                    rows={8}
                                    placeholder="Click upload or paste your resume details here..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs font-mono text-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none leading-relaxed resize-none shadow-inner"
                                />
                                {resumeUploadStatus !== 'idle' && (
                                    <div className={`absolute inset-0 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center gap-3 transition-all ${
                                        resumeUploadStatus === 'success' ? 'bg-emerald-950/80' : 
                                        resumeUploadStatus === 'error' ? 'bg-red-950/80' : 'bg-slate-950/60'
                                    }`}>
                                        {resumeUploadStatus === 'processing' && <Loader2 className="animate-spin text-indigo-400" size={32}/>}
                                        {resumeUploadStatus === 'success' && <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg"><Check size={24} strokeWidth={4}/></div>}
                                        {resumeUploadStatus === 'error' && <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg"><X size={24} strokeWidth={4}/></div>}
                                        <span className="text-xs font-black text-white uppercase tracking-widest">{resumeStatusMsg}</span>
                                        {resumeUploadStatus !== 'processing' && (
                                            <button onClick={() => setResumeUploadStatus('idle')} className="mt-2 text-[10px] font-bold text-white/60 hover:text-white underline uppercase">Dismiss</button>
                                        )}
                                    </div>
                                )}
                            </div>
                            <input type="file" ref={resumeInputRef} className="hidden" accept=".pdf,.txt" onChange={handleResumeUpload} />
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'availability' && (
                <div className="space-y-8 animate-fade-in">
                    <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-xl p-4 flex items-center gap-3">
                        <Calendar className="text-indigo-400" size={24}/>
                        <div>
                            <h3 className="text-sm font-bold text-white">Office Hours</h3>
                            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-0.5">Control when peers can book technical sessions with you</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                            <div><p className="text-sm font-bold text-white">Accept Appointments</p><p className="text-[10px] text-slate-500 uppercase">Enable peer discovery for mentorship</p></div>
                            <button onClick={() => setAvailability({...availability, enabled: !availability.enabled})} className={`w-12 h-6 rounded-full transition-all relative ${availability.enabled ? 'bg-indigo-600' : 'bg-slate-700'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${availability.enabled ? 'right-1' : 'left-1'}`}></div></button>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Available Days</label>
                            <div className="flex gap-2">
                                {DAYS.map((day, i) => (
                                    <button key={day} onClick={() => toggleDay(i)} className={`flex-1 py-3 rounded-xl border text-xs font-black transition-all ${availability.days.includes(i) ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-600'}`}>{day.charAt(0)}</button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1"><Clock size={12}/> Daily Start</label>
                                <select value={availability.startHour} onChange={e => setAvailability({...availability, startHour: parseInt(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500">
                                    {Array.from({length: 24}).map((_, i) => <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1"><Clock size={12}/> Daily End</label>
                                <select value={availability.endHour} onChange={e => setAvailability({...availability, endHour: parseInt(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500">
                                    {Array.from({length: 24}).map((_, i) => <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-950 border border-indigo-500/10 rounded-2xl text-[10px] text-slate-500 leading-relaxed font-medium">
                            <Info size={14} className="inline mr-2 mb-0.5 text-indigo-400"/>
                            Neural Prism enforces a 5-minute cooldown between sessions. Bookings are aligned to :05 and :35 minute starts.
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'interests' && (
                <div className="space-y-6 animate-fade-in">
                    <div>
                        <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2"><Heart className="text-pink-500" /> Your Interests</h3>
                        <p className="text-sm text-slate-400">Select topics you love to personalize your spectrum and recommendations.</p>
                    </div>
                    <div className="space-y-6">
                        {Object.keys(TOPIC_CATEGORIES).map(category => (
                            <div key={category} className="bg-slate-800/30 border border-slate-800 rounded-2xl p-5">
                                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-slate-800 pb-2"><HashIcon size={12} className="text-indigo-400" /> {category}</h4>
                                <div className="flex flex-wrap gap-2">
                                    {TOPIC_CATEGORIES[category].map(tag => {
                                        const isSelected = selectedInterests.includes(tag);
                                        return (
                                            <button 
                                                key={tag} 
                                                onClick={() => toggleInterest(tag)} 
                                                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 ${isSelected ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/20' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-50'}`}
                                            >
                                                {tag}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'banking' && (
                <div className="space-y-8 animate-fade-in">
                    <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-xl p-4 flex items-start gap-4">
                        <div className="p-2 bg-indigo-600 rounded-lg text-white shadow-lg shadow-indigo-900/20"><PenTool size={20}/></div>
                        <div>
                            <h3 className="text-sm font-bold text-white">Neural Check Profile</h3>
                            <p className="text-xs text-slate-400">Save your professional details once to generate refracted assets in seconds.</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1"><MapPin size={12} className="text-indigo-400"/> Business/Sender Address</label>
                            <textarea 
                                value={senderAddress}
                                onChange={(e) => setSenderAddress(e.target.value)}
                                placeholder="123 Silicon Way, San Jose, CA 95134"
                                rows={3}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none leading-relaxed transition-all shadow-inner"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1"><HashIcon size={12} className="text-indigo-400"/> Next Asset Number</label>
                                <input 
                                    type="number"
                                    value={nextCheckNumber}
                                    onChange={(e) => setNextCheckNumber(parseInt(e.target.value) || 0)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1"><PenTool size={12} className="text-indigo-400"/> Official Signature</label>
                            {signaturePreview ? (
                                <div className="relative w-full aspect-[3/1] bg-white rounded-xl border border-slate-700 overflow-hidden group shadow-lg">
                                    <img src={signaturePreview} className="w-full h-full object-contain p-4" alt="Saved Signature" />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                        <button onClick={() => setShowSignPad(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-lg">Change Signature</button>
                                        <button onClick={() => setSignaturePreview('')} className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold shadow-lg">Remove</button>
                                    </div>
                                </div>
                            ) : (
                                <button 
                                    onClick={() => setShowSignPad(true)}
                                    className="w-full aspect-[3/1] border-2 border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-600 hover:border-indigo-500 hover:text-indigo-400 transition-all bg-slate-950/50 group"
                                >
                                    <div className="p-3 bg-slate-900 rounded-full group-hover:bg-indigo-900/20 transition-colors">
                                        <PenTool size={32} className="opacity-20"/>
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-widest">Register Neural Signature</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* Global Footer with Save Button */}
        <div className="p-5 border-t border-slate-800 bg-slate-950 flex items-center justify-between shrink-0 shadow-2xl">
             <button 
                onClick={handleLogout}
                className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-red-400 transition-all uppercase tracking-widest px-3 py-2 rounded-lg hover:bg-red-950/20"
             >
                <LogOut size={16} /> Sign Out
             </button>
             
             <div className="flex items-center gap-3">
                <button 
                    onClick={onClose} 
                    className="px-6 py-2.5 text-xs font-bold text-slate-400 hover:text-white transition-colors"
                >
                    Cancel
                </button>
                <button 
                    onClick={handleSaveAll} 
                    disabled={isSaving}
                    className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-[0.2em] rounded-xl shadow-xl shadow-indigo-900/20 flex items-center gap-2 transition-all active:scale-[0.98]"
                >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    <span>Save Changes</span>
                </button>
             </div>
        </div>
      </div>

      {showSignPad && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
              <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl p-6 shadow-2xl animate-fade-in-up">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2"><PenTool size={20} className="text-indigo-400"/> Draw Official Signature</h3>
                      <button onClick={() => setShowSignPad(false)} className="p-2 text-slate-500 hover:text-white"><X/></button>
                  </div>
                  <div className="h-[300px] border-2 border-dashed border-slate-800 rounded-2xl overflow-hidden mb-6 bg-white">
                      <Whiteboard isReadOnly={false} backgroundColor="transparent" initialColor="#000000" />
                  </div>
                  <div className="flex justify-end gap-2">
                      <button onClick={() => setShowSignPad(false)} className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold">Cancel</button>
                      <button 
                        onClick={() => {
                            const canvas = document.querySelector('.fixed canvas') as HTMLCanvasElement;
                            if (canvas) setSignaturePreview(canvas.toDataURL('image/png'));
                            setShowSignPad(false);
                        }} 
                        className="px-8 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-900/20"
                      >
                        Capture & Confirm
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default SettingsModal;