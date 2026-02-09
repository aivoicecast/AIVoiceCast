import { GoogleGenAI } from '@google/genai';
import {
    Activity,
    AlertTriangle,
    ArrowLeft,
    BookOpen,
    Calendar,
    Check,
    CheckCircle,
    ChevronDown,
    Clock,
    Coffee,
    Cpu,
    Crown,
    Edit2,
    Edit3,
    ExternalLink,
    Eye,
    EyeOff,
    Feather,
    FileCheck,
    FileUp,
    Fingerprint,
    Github,
    Globe,
    Globe2,
    Hash,
    Hash as HashIcon,
    Heart,
    History,
    Key,
    Languages,
    Link,
    Loader2,
    Lock,
    LogOut,
    MapPin,
    Moon,
    Palette,
    PenTool,
    Play,
    Save,
    Settings2,
    Shield,
    ShieldCheck,
    ShieldQuestion,
    Sparkles,
    Speaker,
    Sun,
    Terminal,
    Trash2,
    Type,
    Upload,
    User,
    UserCheck,
    UserMinus,
    UserPlus,
    Volume2,
    Wallet,
    X,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { getDriveToken, signInWithGoogle, connectGoogleDrive, signOut } from '../services/authService';
import { ensureFolder, uploadToDrive } from '../services/googleDriveService';
import { deductCoins, logUserActivity, updateUserProfile, uploadFileToStorage, AI_COSTS } from '../services/firestoreService';
import { runNeuralAudit } from '../services/tts';
import { UserProfile, ReaderTheme, UserAvailability, TtsProvider } from '../types';
import { getGlobalAudioContext, getSystemVoicesAsync, syncPrimeSpeech, warmUpAudioContext, SPEECH_REGISTRY } from '../utils/audioUtils';
import { TOPIC_CATEGORIES } from '../utils/initialData';
import { MarkdownView } from './MarkdownView';
import { Whiteboard } from './Whiteboard';

const MAX_TEST_LENGTH = 1000;
const LANGUAGES = ['C++', 'Python', 'JavaScript', 'TypeScript', 'Java', 'Go', 'Rust', 'C#', 'Swift', 'Kotlin', 'PHP', 'Ruby', 'HTML', 'CSS', 'SQL'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onUpdateProfile?: (updated: UserProfile) => void;
  onUpgradeClick?: () => void;
  isSuperAdmin?: boolean;
  onNavigateAdmin?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, onClose, user, onUpdateProfile, onUpgradeClick, isSuperAdmin, onNavigateAdmin
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'interests' | 'profile' | 'availability' | 'banking'>('general');
  const [isSaving, setIsSaving] = useState(false);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [defaultRepo, setDefaultRepo] = useState(user.defaultRepoUrl || '');
  const [defaultLanguage, setDefaultLanguage] = useState(user.defaultLanguage || 'C++');
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openai'>(user.preferredAiProvider || 'gemini');
  const [ttsProvider, setTtsProvider] = useState<TtsProvider>(user.preferredTtsProvider || 'gemini');
  const [readerTheme, setReaderTheme] = useState<ReaderTheme>(user.preferredReaderTheme || 'slate');
  const [recordingTarget, setRecordingTarget] = useState<'youtube' | 'drive'>(user.preferredRecordingTarget || 'drive');
  const [selectedInterests, setSelectedInterests] = useState<string[]>(user.interests || []);
  const [languagePreference, setLanguagePreference] = useState<'en' | 'zh'>(user.languagePreference || 'en');
  const [preferredScriptureView, setPreferredScriptureView] = useState<'dual' | 'en' | 'zh'>(user.preferredScriptureView || 'dual');
  
  // API Keys state
  const [geminiApiKey, setGeminiApiKey] = useState(user.geminiApiKey || '');
  const [openaiApiKey, setOpenaiApiKey] = useState(user.openaiApiKey || '');
  const [gcpApiKey, setGcpApiKey] = useState(user.gcpApiKey || '');
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [testText, setTestText] = useState(() => localStorage.getItem('last_audio_test_text') || 'Neural Prism audio handshake successful. 这是一个神经棱镜音频测试。');
  const [testResult, setTestResult] = useState<{ status: 'idle' | 'success' | 'error' | 'syncing', msg: string, provider?: string }>({ status: 'idle', msg: '' });
  const [testLogs, setTestLogs] = useState<string[]>([]);

  const [availability, setAvailability] = useState<UserAvailability>(user.availability || {
      days: [1, 2, 3, 4, 5],
      startHour: 9,
      endHour: 18,
      enabled: true
  });

  const [headline, setHeadline] = useState(user.headline || '');
  const [company, setCompany] = useState(user.company || '');
  const [linkedinUrl, setLinkedinUrl] = useState(user.linkedinUrl || '');
  const [resumeText, setResumeText] = useState(user.resumeText || '');
  const [resumeUploadStatus, setResumeUploadStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [resumeStatusMsg, setResumeStatusMsg] = useState('');
  const resumeInputRef = useRef<HTMLInputElement>(null);

  const [senderAddress, setSenderAddress] = useState(user.senderAddress || '');
  const [signaturePreview, setSignaturePreview] = useState(user.savedSignatureUrl || '');
  const [nextCheckNumber, setNextCheckNumber] = useState(user.nextCheckNumber || 1001);
  const [showSignPad, setShowSignPad] = useState(false);
  
  const playbackSessionIdRef = useRef(0);
  const currentTier = user.subscriptionTier || 'free';
  const isPaid = currentTier === 'pro';

  useEffect(() => {
      if (isOpen) {
          setSelectedInterests(user.interests || []);
          setAiProvider(user.preferredAiProvider || 'gemini');
          setTtsProvider(user.preferredTtsProvider || 'gemini');
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
          setGeminiApiKey(user.geminiApiKey || '');
          setOpenaiApiKey(user.openaiApiKey || '');
          setGcpApiKey(user.gcpApiKey || '');
          setResumeUploadStatus('idle');
          setResumeStatusMsg('');
          setTestResult({ status: 'idle', msg: '' });
          setTestLogs([]);
      }
  }, [isOpen, user]);

  const addTestLog = (msg: string) => {
    setTestLogs(prev => [...prev, msg].slice(-5));
    window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: `[Audit Trace] ${msg}`, type: 'info' } }));
  };

  const handleRunVoiceTest = async () => {
      if (!testText.trim()) return;
      
      const currentSession = ++playbackSessionIdRef.current;
      setIsTestingVoice(true);
      setTestResult({ status: 'syncing', msg: 'Priming Hardware...', provider: ttsProvider });
      
      localStorage.setItem('last_audio_test_text', testText);
      const ctx = getGlobalAudioContext();

      const englishParts = testText.match(/[a-zA-Z0-9\s.,!?'"]+/g)?.join(' ') || "Neural Prism.";
      const chineseParts = testText.match(/[\u4e00-\u9fa5\s。，！？“”]+/g)?.join('') || "神经棱镜。";

      try {
          addTestLog("Handshake Phase 1: Resolving Audio Context...");
          await warmUpAudioContext(ctx);
          
          if (currentSession !== playbackSessionIdRef.current) return;

          if (preferredScriptureView === 'dual' || preferredScriptureView === 'en') {
              addTestLog(`Handshake Phase 2: Dispatching English Track to ${ttsProvider.toUpperCase()} engine...`);
              await runNeuralAudit(ttsProvider, englishParts, ctx, 'en', gcpApiKey);
              
              if (currentSession === playbackSessionIdRef.current && preferredScriptureView === 'dual') {
                  addTestLog("Sync Pause: Transitioning language spectrum...");
                  await new Promise(r => setTimeout(r, 600));
              }
          }

          if (currentSession === playbackSessionIdRef.current && (preferredScriptureView === 'dual' || preferredScriptureView === 'zh')) {
              addTestLog(`Handshake Phase 3: Dispatching Chinese Track to ${ttsProvider.toUpperCase()} engine...`);
              await runNeuralAudit(ttsProvider, chineseParts, ctx, 'zh', gcpApiKey);
          }
          
          if (currentSession === playbackSessionIdRef.current) {
            setTestResult({ status: 'success', msg: `Spectrum Validated: ${ttsProvider.toUpperCase()} Online.`, provider: ttsProvider });
            addTestLog("Handshake Phase 4: Finalized. Neural fabric secure.");
          }
      } catch (e: any) {
          const errMsg = e.message || "Hardware link fault.";
          setTestResult({ status: 'error', msg: `Audit Failed: ${errMsg}`, provider: ttsProvider });
          addTestLog(`HANDSHAKE REFUSED: ${errMsg}`);
          
          window.dispatchEvent(new CustomEvent('neural-log', { 
              detail: { text: `[Audit Fault] ${ttsProvider.toUpperCase()}: ${errMsg}`, type: 'error' } 
          }));
      } finally {
          if (currentSession === playbackSessionIdRef.current) setIsTestingVoice(false);
      }
  };

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
      const canvas = document.getElementById('whiteboard-canvas-core') as HTMLCanvasElement;
      if (!canvas) return;
      
      const b64 = canvas.toDataURL('image/png', 1.0);
      setSignaturePreview(b64);
      setShowSignPad(false);
  };

  const handleSaveAll = async () => {
      setIsSaving(true);
      try {
          let finalSigUrl = signaturePreview;
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
              preferredTtsProvider: ttsProvider,
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
              geminiApiKey,
              openaiApiKey,
              gcpApiKey
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
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 px-1">Display Name</label>
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
                        <div className="flex justify-between items-end px-1">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2"><Key size={16} className="text-indigo-400"/> Security & API Keys</h4>
                        </div>
                        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-inner">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Google Gemini Key</label>
                                    <div className="relative">
                                        <input 
                                            type={showKeys.gemini ? "text" : "password"}
                                            value={geminiApiKey} 
                                            onChange={e => setGeminiApiKey(e.target.value)} 
                                            placeholder="Custom Model Override (Optional)"
                                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-indigo-300 font-mono focus:ring-1 focus:ring-indigo-500 outline-none"
                                        />
                                        <button onClick={() => setShowKeys({...showKeys, gemini: !showKeys.gemini})} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                                            {showKeys.gemini ? <EyeOff size={14}/> : <Eye size={14}/>}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">GCP API Key (Enterprise TTS)</label>
                                    <div className="relative">
                                        <input 
                                            type={showKeys.gcp ? "text" : "password"}
                                            value={gcpApiKey} 
                                            onChange={e => setGcpApiKey(e.target.value)} 
                                            placeholder="Google Cloud Platform Key"
                                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-indigo-300 font-mono focus:ring-1 focus:ring-indigo-500 outline-none"
                                        />
                                        <button onClick={() => setShowKeys({...showKeys, gcp: !showKeys.gcp})} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                                            {showKeys.gcp ? <EyeOff size={14}/> : <Eye size={14}/>}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">OpenAI API Key</label>
                                    <div className="relative">
                                        <input 
                                            type={showKeys.openai ? "text" : "password"}
                                            value={openaiApiKey} 
                                            onChange={e => setOpenaiApiKey(e.target.value)} 
                                            placeholder="sk-..."
                                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-emerald-300 font-mono focus:ring-1 focus:ring-emerald-500 outline-none"
                                        />
                                        <button onClick={() => setShowKeys({...showKeys, openai: !showKeys.openai})} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                                            {showKeys.openai ? <EyeOff size={14}/> : <Eye size={14}/>}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-end px-1">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2"><Speaker size={16} className="text-indigo-400"/> Preferred Speech Engine</h4>
                        </div>
                        <div className="p-1.5 bg-slate-950 border border-slate-800 rounded-2xl grid grid-cols-4 gap-1 shadow-inner">
                            <button onClick={() => setTtsProvider('gemini')} className={`py-2 rounded-xl text-[10px] font-black uppercase transition-all ${ttsProvider === 'gemini' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-200'}`}>Gemini</button>
                            <button onClick={() => setTtsProvider('google')} className={`py-2 rounded-xl text-[10px] font-black uppercase transition-all ${ttsProvider === 'google' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-200'}`}>Cloud</button>
                            <button onClick={() => setTtsProvider('openai')} className={`py-2 rounded-xl text-[10px] font-black uppercase transition-all ${ttsProvider === 'openai' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-200'}`}>OpenAI</button>
                            <button onClick={() => setTtsProvider('system')} className={`py-2 rounded-xl text-[10px] font-black uppercase transition-all ${ttsProvider === 'system' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-200'}`}>Local</button>
                        </div>

                        <div className="bg-slate-950/50 border border-slate-800 rounded-[2rem] p-6 space-y-6 shadow-xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-12 bg-indigo-600/5 blur-[80px] rounded-full pointer-events-none"></div>
                            
                            <div className="flex items-center justify-between relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className={`p-3 rounded-2xl ${isTestingVoice ? 'bg-indigo-600 text-white animate-pulse' : 'bg-slate-900 border border-slate-800 text-indigo-400 shadow-inner'}`}>
                                        <Activity size={24} />
                                    </div>
                                    <div>
                                        <h5 className="text-sm font-black text-white uppercase tracking-[0.2em] italic">Neural Sound Check</h5>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Auditing {ttsProvider.toUpperCase()} Linkage</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={handleRunVoiceTest} 
                                    disabled={isTestingVoice || !testText.trim()}
                                    className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-30 ${isTestingVoice ? 'bg-indigo-600 text-white animate-pulse' : 'bg-white text-slate-900 hover:bg-indigo-50 shadow-indigo-900/20'}`}
                                >
                                    {isTestingVoice ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16} fill="currentColor"/>}
                                    Run Audit
                                </button>
                            </div>

                            <div className="space-y-3 relative z-10">
                                <div className="flex justify-between items-center px-1">
                                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">Test Logic String</label>
                                    <span className={`text-[10px] font-mono font-bold ${testText.length >= MAX_TEST_LENGTH ? 'text-red-500' : 'text-slate-500'}`}>
                                        {testText.length}/{MAX_TEST_LENGTH}
                                    </span>
                                </div>
                                <div className="relative">
                                    <textarea 
                                        value={testText}
                                        onChange={e => setTestText(e.target.value.substring(0, MAX_TEST_LENGTH))}
                                        placeholder="Enter custom text for mixed-language audit..."
                                        rows={3}
                                        className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-indigo-100 font-mono leading-relaxed outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all resize-none shadow-inner scrollbar-hide"
                                    />
                                    {testText.length >= MAX_TEST_LENGTH && (
                                        <div className="absolute bottom-2 right-4 flex items-center gap-1.5 text-[9px] font-black text-red-500 uppercase animate-fade-in">
                                            <AlertTriangle size={10}/> Maximum Handshake Length
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                                <div className="bg-black/60 rounded-2xl p-4 border border-slate-800 min-h-[100px] flex flex-col justify-center shadow-inner">
                                    <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-2 border-b border-slate-800/50 pb-1">Telemetry Trace</p>
                                    {testLogs.length === 0 ? (
                                        <p className="text-[10px] text-slate-700 italic">Awaiting neural trigger...</p>
                                    ) : (
                                        <div className="space-y-1">
                                            {testLogs.map((log, i) => (
                                                <div key={i} className="flex items-start gap-2 text-[10px] font-mono text-indigo-400/90 animate-fade-in-up">
                                                    <span className="text-indigo-600 font-bold shrink-0">#</span>
                                                    <span className="break-words leading-tight">{log}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className={`rounded-2xl p-4 border transition-all flex flex-col justify-center items-center text-center gap-2 shadow-inner ${testResult.status === 'success' ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400' : testResult.status === 'error' ? 'bg-red-950/20 border-red-500/30 text-red-400' : testResult.status === 'syncing' ? 'bg-indigo-900/10 border-indigo-500/30 text-indigo-400' : 'bg-slate-900 border-slate-800 text-slate-600'}`}>
                                    {testResult.status === 'success' ? <CheckCircle size={24} className="animate-bounce" /> : testResult.status === 'error' ? <AlertTriangle size={24}/> : <Activity size={24}/>}
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-black uppercase tracking-tighter line-clamp-2">{testResult.msg || 'Spectrum Idle'}</p>
                                        {testResult.status === 'error' && (
                                            <div className="flex items-center justify-center gap-1 mt-1 opacity-60">
                                                <ShieldQuestion size={12}/>
                                                <span className="text-[8px] font-black uppercase">Handshake Failure</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2"><Globe size={16} className="text-indigo-400"/> Primary Language & Neural Voice</h4>
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
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 px-1">Primary Language / Stack</label>
                                <select 
                                    value={defaultLanguage} 
                                    onChange={e => setDefaultLanguage(e.target.value)} 
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                                >
                                    {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 px-1">Default Repository URL</label>
                                <input type="text" value={defaultRepo} onChange={e => setDefaultRepo(e.target.value)} placeholder="https://github.com/owner/repo" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:ring-1 focus:ring-indigo-500 outline-none"/>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 px-1">Headline</label><input type="text" value={headline} onChange={e => setHeadline(e.target.value)} placeholder="Senior Software Engineer..." className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:ring-1 focus:ring-indigo-500 outline-none"/></div>
                            <div><label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 px-1">Company</label><input type="text" value={company} onChange={e => setCompany(e.target.value)} placeholder="Tech Corp" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:ring-1 focus:ring-indigo-500 outline-none"/></div>
                        </div>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-2 px-1"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Resume Context</label><div className="flex gap-2"><button onClick={handleResumeUrlSelect} className="text-[10px] font-black text-indigo-400 flex items-center gap-1 hover:text-white transition-all"><Globe2 size={12}/> Link PDF</button><button onClick={() => resumeInputRef.current?.click()} className="text-[10px] font-black text-emerald-400 flex items-center gap-1 hover:text-white transition-all"><FileUp size={12}/> Upload</button></div></div>
                            <textarea value={resumeText} onChange={e => setResumeText(e.target.value)} rows={5} placeholder="AI summary of your skills..." className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs font-mono text-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none resize-none shadow-inner leading-relaxed" />
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'availability' && (
                <div className="space-y-8 animate-fade-in">
                    <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-xl p-4 flex items-center gap-3"><Calendar className="text-indigo-400" size={24}/><div><h3 className="text-sm font-bold text-white">Office Hours</h3><p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-0.5">Manage appointment requests</p></div></div>
                    <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-2xl shadow-inner"><div><p className="text-sm font-bold text-white">Accept Appointments</p></div><button onClick={() => setAvailability({...availability, enabled: !availability.enabled})} className={`w-12 h-6 rounded-full transition-all relative ${availability.enabled ? 'bg-indigo-600' : 'bg-slate-700'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${availability.enabled ? 'right-1' : 'left-1'}`}></div></button></div>
                        <div><label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">Available Days</label><div className="flex gap-2">{DAYS.map((day, i) => (<button key={day} onClick={() => toggleDay(i)} className={`flex-1 py-3 rounded-xl border text-xs font-black transition-all ${availability.days.includes(i) ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-950 border border-slate-800 text-slate-600'}`}>{day.charAt(0)}</button>))}</div></div>
                    </div>
                </div>
            )}

            {activeTab === 'interests' && (
                <div className="space-y-6 animate-fade-in">{Object.keys(TOPIC_CATEGORIES).map(category => (<div key={category} className="bg-slate-800/30 border border-slate-800 rounded-2xl p-5 shadow-xl"><h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-slate-800 pb-2"><HashIcon size={12} className="text-indigo-400" /> {category}</h4><div className="flex flex-wrap gap-2">{TOPIC_CATEGORIES[category].map(tag => (<button key={tag} onClick={() => toggleInterest(tag)} className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 ${selectedInterests.includes(tag) ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-50'}`}>{tag}</button>))}</div></div>))}</div>
            )}

            {activeTab === 'banking' && (
                <div className="space-y-8 animate-fade-in">
                    <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-xl p-4 flex items-start gap-4">
                        <div className="p-2 bg-indigo-600 rounded-lg text-white shadow-lg"><Wallet size={20}/></div>
                        <div><h3 className="text-sm font-bold text-white">Financial Authority Profile</h3><p className="text-xs text-slate-400">Configure default data for check issuance and ledger verification.</p></div>
                    </div>
                    <div className="space-y-6">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1 flex items-center gap-1"><MapPin size={12} className="text-indigo-400"/> Ledger Address</label>
                            <textarea value={senderAddress} onChange={(e) => setSenderAddress(e.target.value)} rows={3} placeholder="123 Neural Way, San Francisco, CA..." className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none shadow-inner"/>
                        </div>
                        
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-1 flex items-center gap-1"><Fingerprint size={12} className="text-emerald-400"/> Authorized Signature</label>
                            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 flex flex-col items-center gap-4 relative group shadow-inner">
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
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1 flex items-center gap-1"><Hash size={12} className="text-indigo-400"/> Next Asset Serial Number</label>
                            <input 
                                type="number" 
                                value={nextCheckNumber} 
                                onChange={(e) => setNextCheckNumber(parseInt(e.target.value) || 1001)} 
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white font-mono text-sm focus:ring-1 focus:ring-indigo-500 outline-none shadow-inner"
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
                  <div className="p-6 bg-indigo-600 flex justify-between items-center"><h3 className="text-white font-black uppercase tracking-widest flex items-center gap-2"><PenTool size={20}/> Member Signature Capture</h3><button onClick={() => setShowSignPad(false)} className="text-white/60 hover:text-white transition-colors"><X size={24}/></button></div>
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