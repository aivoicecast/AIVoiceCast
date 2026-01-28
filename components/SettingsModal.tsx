import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, ReaderTheme, UserAvailability } from '../types';
// Fixed: Added missing Wallet and ShieldCheck icon to lucide-react imports
import { X, User, Shield, CreditCard, LogOut, CheckCircle, AlertTriangle, Bell, Lock, Database, Trash2, Edit2, Save, FileText, ExternalLink, Loader2, DollarSign, HelpCircle, ChevronDown, ChevronUp, ChevronRight, Github, Heart, Hash, Cpu, Sparkles, MapPin, PenTool, Hash as HashIcon, Globe, Zap, Crown, Linkedin, Upload, FileUp, FileCheck, Check, Link, Type, Sun, Moon, Coffee, Palette, Code2, Youtube, HardDrive, Calendar, Clock, Info, Globe2, Terminal, Languages, Key, Speaker, BookOpen, Fingerprint, Wallet, ShieldCheck } from 'lucide-react';
import { logUserActivity, updateUserProfile, uploadFileToStorage } from '../services/firestoreService';
import { signOut, getDriveToken, connectGoogleDrive } from '../services/authService';
import { TOPIC_CATEGORIES } from '../utils/initialData';
import { Whiteboard } from './Whiteboard';
import { GoogleGenAI } from '@google/genai';
import { ensureFolder, uploadToDrive } from '../services/googleDriveService';

interface SettingsModalProps {
  isOpen: boolean;
  // Fixed: Replaced onBack with onClose to align with usage in App.tsx
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

const LANGUAGES = ['C++', 'Python', 'JavaScript', 'TypeScript', 'Rust', 'Go', 'Java', 'C#', 'Swift', 'PHP', 'HTML/CSS'];

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
  const [languagePreference, setLanguagePreference] = useState<'en' | 'zh'>(user.languagePreference || 'en');
  const [preferredScriptureView, setPreferredScriptureView] = useState<'dual' | 'en' | 'zh'>(user.preferredScriptureView || 'dual');
  const [cloudTtsApiKey, setCloudTtsApiKey] = useState(user.cloudTtsApiKey || '');
  
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
  const [isUpdatingSignature, setIsUpdatingSignature] = useState(false);
  
  const currentTier = user.subscriptionTier || 'free';
  const isPaid = currentTier === 'pro';

  useEffect(() => {
      if (isOpen) {
          setSelectedInterests(user.interests || []);
          setAiProvider(user.preferredAiProvider || 'gemini');
          setReaderTheme(user.preferredReaderTheme || 'slate');
          setRecordingTarget(user.preferredRecordingTarget || 'drive');
          setLanguagePreference(user.languagePreference || 'en');
          setPreferredScriptureView(user.preferredScriptureView || 'dual');
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
          setCloudTtsApiKey(user.cloudTtsApiKey || '');
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

  const handleAdoptSignature = async () => {
      // Fixed: Targeting the specific whiteboard canvas for extraction
      const canvas = document.getElementById('whiteboard-canvas-core') as HTMLCanvasElement;
      if (!canvas) return;
      
      const b64 = canvas.toDataURL('image/png', 1.0);
      // Update local state immediately so user sees it "saved" in memory
      setSignaturePreview(b64);
      setShowSignPad(false);
  };

  const handleSaveAll = async () => {
      setIsSaving(true);
      try {
          let finalSigUrl = signaturePreview;
          // If the preview is a data URL (newly adopted), upload it to storage
          if (signaturePreview && signaturePreview.startsWith('data:')) {
              const res = await fetch(signaturePreview);
              const blob = await res.blob();
              finalSigUrl = await uploadFileToStorage(`users/${user.uid}/signature_authority.png`, blob);
          }

          const updateData: Partial<UserProfile> = {
              displayName,
              defaultRepoUrl: defaultRepo,
              defaultLanguage,
              interests: selectedInterests,
              preferredAiProvider: aiProvider,
              preferredReaderTheme: readerTheme,
              preferredRecordingTarget: recordingTarget,
              languagePreference,
              preferredScriptureView,
              senderAddress,
              savedSignatureUrl: finalSigUrl,
              nextCheckNumber,
              headline,
              company,
              linkedinUrl,
              resumeText,
              availability,
              cloudTtsApiKey
          };

          await updateUserProfile(user.uid, updateData);
          if (onUpdateProfile) onUpdateProfile({ ...user, ...updateData, savedSignatureUrl: finalSigUrl });
          
          setIsSaving(false);
          onClose();
      } catch(e: any) {
          const systemMsg = "Save failed: " + e.message;
          window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: systemMsg, type: 'error' } }));
          setIsSaving(false);
      }
  };

  const handleLogout = async () => {
    // Confirmation removed for seamless experience
    await signOut();
    onClose();
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
                                {!isPaid && <button onClick={onUpgradeClick} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase rounded-lg shadow-lg">Upgrade</button>}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2"><Globe size={16} className="text-indigo-400"/> Primary Language & Neural Voice</h4>
                        <p className="text-[10px] text-slate-500 uppercase font-black px-1">This setting dictates the default spoken language and UI locale.</p>
                        <div className="p-1.5 bg-slate-950 border border-slate-800 rounded-2xl flex shadow-inner">
                            <button onClick={() => setLanguagePreference('en')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all ${languagePreference === 'en' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-200'}`}>English</button>
                            <button onClick={() => setLanguagePreference('zh')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all ${languagePreference === 'zh' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-200'}`}>Chinese (中文)</button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2"><BookOpen size={16} className="text-amber-500"/> Default Scripture View Mode</h4>
                        <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-950 border border-slate-800 rounded-2xl shadow-inner">
                            <button onClick={() => setPreferredScriptureView('dual')} className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all ${preferredScriptureView === 'dual' ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-50'}`}>Bilingual</button>
                            <button onClick={() => setPreferredScriptureView('en')} className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all ${preferredScriptureView === 'en' ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-50'}`}>English</button>
                            <button onClick={() => setPreferredScriptureView('zh')} className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all ${preferredScriptureView === 'zh' ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-50'}`}>Chinese</button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2"><Key size={16} className="text-amber-400"/> Dedicated Cloud TTS Key</h4>
                        <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                            <p className="text-[10px] text-slate-400 leading-relaxed">If you are getting "API key not valid" on enterprise voices, enter a dedicated GCP console key here.</p>
                            <div className="relative">
                                <input 
                                    type="password" 
                                    value={cloudTtsApiKey} 
                                    onChange={e => setCloudTtsApiKey(e.target.value)} 
                                    placeholder="GCP Enterprise Key (AIza...)"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-xs text-indigo-300 font-mono focus:ring-1 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'profile' && (
                <div className="space-y-8 animate-fade-in">
                    <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-xl p-4 flex items-center gap-3">
                        <Github className="text-indigo-400" size={24}/>
                        <div><h3 className="text-sm font-bold text-white">GitHub & IDE Sync</h3><p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-0.5">Configure Neural Workspace Defaults</p></div>
                    </div>
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Primary Language / Stack</label>
                                <select 
                                    value={defaultLanguage} 
                                    onChange={e => setDefaultLanguage(e.target.value)} 
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                                >
                                    {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Default Repository URL</label>
                                <input type="text" value={defaultRepo} onChange={e => setDefaultRepo(e.target.value)} placeholder="https://github.com/owner/repo" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:ring-1 focus:ring-indigo-500 outline-none"/>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Headline</label><input type="text" value={headline} onChange={e => setHeadline(e.target.value)} placeholder="Senior Software Engineer..." className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:ring-1 focus:ring-indigo-500 outline-none"/></div>
                            <div><label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Company</label><input type="text" value={company} onChange={e => setCompany(e.target.value)} placeholder="Tech Corp" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:ring-1 focus:ring-indigo-500 outline-none"/></div>
                        </div>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-2 px-1"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Resume Context</label><div className="flex gap-2"><button onClick={handleResumeUrlSelect} className="text-[10px] font-black text-indigo-400 flex items-center gap-1 hover:text-white transition-all"><Globe2 size={12}/> Link PDF</button><button onClick={() => resumeInputRef.current?.click()} className="text-[10px] font-black text-emerald-400 flex items-center gap-1 hover:text-white transition-all"><FileUp size={12}/> Upload</button></div></div>
                            <textarea value={resumeText} onChange={e => setResumeText(e.target.value)} rows={5} placeholder="AI summary of your skills..." className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs font-mono text-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none resize-none" />
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'availability' && (
                <div className="space-y-8 animate-fade-in">
                    <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-xl p-4 flex items-center gap-3"><Calendar className="text-indigo-400" size={24}/><div><h3 className="text-sm font-bold text-white">Office Hours</h3><p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-0.5">Manage appointment requests</p></div></div>
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
                <div className="space-y-8 animate-fade-in">
                    <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-xl p-4 flex items-start gap-4">
                        <div className="p-2 bg-indigo-600 rounded-lg text-white shadow-lg"><Wallet size={20}/></div>
                        <div><h3 className="text-sm font-bold text-white">Financial Authority Profile</h3><p className="text-xs text-slate-400">Configure default data for check issuance and ledger verification.</p></div>
                    </div>
                    <div className="space-y-6">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1"><MapPin size={12} className="text-indigo-400"/> Ledger Address</label>
                            <textarea value={senderAddress} onChange={(e) => setSenderAddress(e.target.value)} rows={3} placeholder="123 Neural Way, San Francisco, CA..." className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none shadow-inner"/>
                        </div>
                        
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1"><Fingerprint size={12} className="text-emerald-400"/> Authorized Signature</label>
                            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 flex flex-col items-center gap-4 relative group">
                                {signaturePreview ? (
                                    <div className="relative w-full max-w-xs flex flex-col items-center">
                                        <img 
                                            src={signaturePreview} 
                                            className="h-20 object-contain drop-shadow-lg" 
                                            alt="Stored Signature" 
                                        />
                                        <div className="w-full border-b border-slate-800 mt-2"></div>
                                        <button 
                                            onClick={() => { setSignaturePreview(''); }}
                                            className="absolute -top-2 -right-2 p-1.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                        >
                                            <Trash2 size={12}/>
                                        </button>
                                        <div className="absolute -bottom-6 flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                            <ShieldCheck size={10} className="text-emerald-400"/>
                                            <span className="text-[8px] font-black uppercase text-slate-500">Verified Sovereign Asset</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-4">
                                        <PenTool size={32} className="text-slate-800 mx-auto mb-2"/>
                                        <p className="text-xs text-slate-600 uppercase font-bold tracking-tighter">No Signature Verified</p>
                                    </div>
                                )}
                                <button onClick={() => setShowSignPad(true)} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                                    {signaturePreview ? 'Overwrite Signature' : 'Draw Signature'}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1"><Hash size={12} className="text-indigo-400"/> Next Asset Serial Number</label>
                            <input 
                                type="number" 
                                value={nextCheckNumber} 
                                onChange={(e) => setNextCheckNumber(parseInt(e.target.value) || 1001)} 
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white font-mono text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>

        <div className="p-5 border-t border-slate-800 bg-slate-950 flex items-center justify-between shrink-0 shadow-2xl">
             <button onClick={handleLogout} className="flex items-center gap-2 text-xs font-black text-slate-500 hover:text-red-400 transition-all uppercase tracking-widest px-3 py-2 rounded-lg hover:bg-red-950/20"><LogOut size={16} /> Exit</button>
             <div className="flex items-center gap-3"><button onClick={onClose} className="px-6 py-2.5 text-xs font-bold text-slate-400 hover:text-white">Cancel</button><button onClick={handleSaveAll} disabled={isSaving} className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-[0.2em] rounded-xl shadow-xl flex items-center gap-2 transition-all active:scale-0.98">{isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}<span>Apply Spectrum</span></button></div>
        </div>
      </div>

      {showSignPad && (
          <div className="fixed inset-0 z-[150] bg-slate-950/95 flex items-center justify-center p-6 animate-fade-in">
              <div className="w-full max-w-2xl bg-white rounded-3xl overflow-hidden shadow-2xl border-8 border-indigo-600">
                  <div className="p-6 bg-indigo-600 flex justify-between items-center">
                    <h3 className="text-white font-black uppercase tracking-widest flex items-center gap-2"><PenTool size={20}/> Member Signature Capture</h3>
                    <button onClick={() => setShowSignPad(false)} className="text-white/60 hover:text-white transition-colors"><X size={24}/></button>
                  </div>
                  <div className="h-64 bg-white relative">
                    <Whiteboard backgroundColor="#ffffff" initialColor="#000000" onChange={() => {}} onBack={() => setShowSignPad(false)}/>
                  </div>
                  <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                    <p className="text-[10px] text-slate-400 flex-1 uppercase font-bold self-center">Sign above to authorize global financial refractions.</p>
                    <button onClick={() => setShowSignPad(false)} className="px-6 py-2 text-sm font-bold text-slate-400">Cancel</button>
                    <button onClick={handleAdoptSignature} className="px-8 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all">Verify & Adopt</button>
                  </div>
              </div>
          </div>
      )}

      <input type="file" ref={resumeInputRef} className="hidden" accept=".pdf,.txt" onChange={handleResumeFileSelect} />
    </div>
  );
};

export default SettingsModal;