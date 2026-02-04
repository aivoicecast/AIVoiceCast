
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { getDebugCollectionDocs, seedDatabase, seedBlogPosts, recalculateGlobalStats, isUserAdmin, deleteFirestoreDoc, purgeFirestoreCollection, setUserSubscriptionTier, updateAllChannelDatesToToday } from '../services/firestoreService';
import { listUserBackups, deleteCloudFile, CloudFileEntry, getCloudFileContent } from '../services/cloudService';
import { ArrowLeft, RefreshCw, Database, Table, Code, Search, UploadCloud, Users, ShieldCheck, Crown, Trash2, ShieldAlert, Loader2, Zap, Activity, CheckCircle, Copy, Check, X, Film, GraduationCap, AlertCircle, Info, Cloud, Speaker, Settings, Calendar, ArrowRightLeft, Folder, FolderOpen, CornerLeftUp, FileJson, FileAudio, Eye, Layout, Monitor, HardDrive, Terminal, ExternalLink, UserPlus, UserMinus, LayoutGrid, Rss } from 'lucide-react';
import { auth } from '../services/firebaseConfig';
import { UserProfile } from '../types';
import { GoogleGenAI } from "@google/genai";
import { safeJsonStringify } from '../utils/idUtils';

interface FirestoreInspectorProps {
  onBack: () => void;
  userProfile: UserProfile | null;
}

const COLLECTIONS = [
  'users', 'channels', 'channel_stats', 'groups', 'messages', 'bookings', 
  'recordings', 'discussions', 'blogs', 'blog_posts', 'job_postings', 
  'career_applications', 'code_projects', 'whiteboards', 'saved_words', 
  'cards', 'icons', 'checks', 'shipping', 'coin_transactions', 'tasks', 
  'notebooks', 'invitations', 'mock_interviews', 'bible_ledger'
];

interface DiagnosticStep {
    id: string;
    label: string;
    status: 'idle' | 'running' | 'success' | 'failed' | 'skipped';
    error?: string;
    details?: string;
    advice?: string[];
}

export const FirestoreInspector: React.FC<FirestoreInspectorProps> = ({ onBack, userProfile }) => {
  const [mainTab, setMainTab] = useState<'database' | 'storage'>(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('tab') as any) || 'database';
  });
  
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  const [dbDocs, setDbDocs] = useState<any[]>([]);
  const [isDbLoading, setIsDbLoading] = useState(false);
  const [dbViewMode, setDbViewMode] = useState<'table' | 'json'>('table');
  const [dbError, setDbError] = useState<string | null>(null);

  const [storageFiles, setStorageFiles] = useState<CloudFileEntry[]>([]);
  const [isStorageLoading, setIsStorageLoading] = useState(false);
  const [storagePath, setStoragePath] = useState(() => {
    return new URLSearchParams(window.location.search).get('path') || '';
  });
  const [isAbsolute, setIsAbsolute] = useState(() => {
    return new URLSearchParams(window.location.search).get('abs') === 'true';
  });
  const [storageError, setStorageError] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState(false);
  const [showCorsFix, setShowCorsFix] = useState(false);

  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [diagnosticSteps, setDiagnosticSteps] = useState<DiagnosticStep[]>([]);

  const isSuperAdmin = useMemo(() => {
    const currentUser = auth?.currentUser;
    if (!currentUser) return false;
    const ownerEmails = ['shengliang.song.ai@gmail.com'];
    if (ownerEmails.includes(currentUser.email || '')) return true;
    return isUserAdmin(userProfile || null);
  }, [userProfile]);

  const currentUid = auth.currentUser?.uid || 'Unknown';

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', mainTab);
    if (mainTab === 'storage') {
        url.searchParams.set('path', storagePath);
        url.searchParams.set('abs', String(isAbsolute));
    } else {
        url.searchParams.delete('path');
        url.searchParams.delete('abs');
    }
    window.history.replaceState({}, '', url.toString());
  }, [mainTab, storagePath, isAbsolute]);

  const fetchCollection = async (name: string) => {
    setActiveCollection(name);
    setIsDbLoading(true);
    setDbDocs([]);
    setDbError(null);
    try {
      const data = await getDebugCollectionDocs(name, 100); 
      setDbDocs(data);
    } catch (e: any) {
      setDbError(e.message || "Failed to fetch");
    } finally {
      setActiveCollection(name);
      setIsDbLoading(false);
    }
  };

  const handleSetUserTier = async (uid: string, currentTier: string) => {
      const nextTier = currentTier === 'pro' ? 'free' : 'pro';
      const label = nextTier === 'pro' ? 'Promote to Pro' : 'Demote to Free';
      if (!confirm(`${label} user ${uid}?`)) return;

      try {
          await setUserSubscriptionTier(uid, nextTier);
          setDbDocs(prev => prev.map(d => d.uid === uid ? { ...d, subscriptionTier: nextTier } : d));
          window.dispatchEvent(new CustomEvent('neural-log', { 
              detail: { text: `Member ${uid.substring(0,8)} refracted to ${nextTier.toUpperCase()} tier.`, type: 'success' } 
          }));
      } catch (e: any) {
          alert("Tier update failed: " + e.message);
      }
  };

  const loadStorage = async (path: string = '', absolute: boolean = false) => {
    setIsStorageLoading(true);
    setStorageError(null);
    try {
        const data = await listUserBackups(path, absolute);
        setStorageFiles(data);
        setStoragePath(path);
        setIsAbsolute(absolute);
    } catch (e: any) {
        console.error("Storage list failed", e);
        setStorageError(e.message || "Unknown Storage Error");
        setStorageFiles([]);
    } finally {
        setIsStorageLoading(false);
    }
  };

  useEffect(() => {
    if (mainTab === 'storage' && storageFiles.length === 0 && !storageError) {
        loadStorage(storagePath, isAbsolute);
    }
  }, [mainTab]);

  const handlePreviewFile = async (file: CloudFileEntry) => {
    setIsPreviewLoading(true);
    setPreviewName(file.name);
    setPreviewContent(null);
    setShowCorsFix(false);
    try {
        const content = await getCloudFileContent(file.fullPath);
        const isJson = file.name.toLowerCase().endsWith('.json') || 
                       content.trim().startsWith('[') || 
                       content.trim().startsWith('{');
        
        if (isJson) {
            try {
                const parsed = JSON.parse(content);
                setPreviewContent(safeJsonStringify(parsed));
            } catch (e) {
                setPreviewContent(content);
            }
        } else {
            setPreviewContent(content);
        }
    } catch (e: any) {
        const msg = e.message || String(e);
        const isCors = msg.includes("Failed to fetch") || msg.includes("Access Denied") || msg.includes("retry-limit") || msg.includes("CORS");
        if (isCors) setShowCorsFix(true);
        setPreviewContent(`[HANDSHAKE FAILED]\nPath: ${file.fullPath}\nError: ${msg}`);
    } finally {
        setIsPreviewLoading(false);
    }
  };

  const handleCopyPreview = () => {
    if (!previewContent) return;
    navigator.clipboard.writeText(previewContent);
    setCopyStatus(true);
    setTimeout(() => setCopyStatus(false), 2000);
  };

  const handleStorageDelete = async (fullPath: string) => {
    if (!confirm(`Delete cloud file: ${fullPath}? This cannot be undone.`)) return;
    try {
      await deleteCloudFile(fullPath);
      await loadStorage(storagePath, isAbsolute);
    } catch (e) {
      alert("Failed to delete file.");
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const handleRunFullDiagnostics = async () => {
    setIsTestingGemini(true);
    const steps: DiagnosticStep[] = [
        { id: 'auth', label: 'Neural Key Integrity', status: 'idle' },
        { id: 'standard', label: 'Gemini 3 Flash Handshake', status: 'idle' },
        { id: 'storage', label: 'Cloud Storage Handshake', status: 'idle' },
        { id: 'cloud_tts', label: 'Cloud TTS API Handshake', status: 'idle' },
        { id: 'veo', label: 'Veo Video Spectrum', status: 'idle' }
    ];
    setDiagnosticSteps(steps);

    const updateStep = (id: string, update: Partial<DiagnosticStep>) => {
        setDiagnosticSteps(prev => prev.map(s => s.id === id ? { ...s, ...update } : s));
    };

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    updateStep('auth', { status: 'running' });
    if (!process.env.API_KEY) {
        updateStep('auth', { status: 'failed', error: 'Missing API_KEY' });
    } else {
        updateStep('auth', { status: 'success', details: 'API Key located.' });
    }

    updateStep('standard', { status: 'running' });
    try {
        const res = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: 'Neural connectivity test.',
            config: { thinkingConfig: { thinkingBudget: 0 } }
        });
        if (res.text) updateStep('standard', { status: 'success', details: 'Flash model responsive.' });
        else throw new Error("Empty response");
    } catch (e: any) {
        updateStep('standard', { status: 'failed', error: e.message });
    }

    updateStep('storage', { status: 'running' });
    try {
        await listUserBackups();
        updateStep('storage', { status: 'success', details: 'Storage list verified.' });
    } catch (e: any) {
        updateStep('storage', { status: 'failed', error: e.message });
    }

    updateStep('cloud_tts', { status: 'running' });
    try {
        const key = userProfile?.cloudTtsApiKey || process.env.API_KEY;
        const res = await fetch(`https://texttospeech.googleapis.com/v1/voices?key=${key}`);
        if (res.ok) updateStep('cloud_tts', { status: 'success', details: 'TTS API reachable.' });
        else throw new Error(`HTTP ${res.status}`);
    } catch (e: any) {
        updateStep('cloud_tts', { status: 'failed', error: e.message });
    }

    updateStep('veo', { status: 'running' });
    try {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (hasKey) updateStep('veo', { status: 'success', details: 'Veo key verified.' });
        else updateStep('veo', { status: 'skipped', details: 'No billing key.' });
    } catch (e) {
        updateStep('veo', { status: 'skipped' });
    }

    setIsTestingGemini(false);
  };

  const handleSeedBlog = async () => {
    if (!confirm("Seed Community Blog Feed with default system posts?")) return;
    setIsDbLoading(true);
    try {
        await seedBlogPosts();
        alert("Blog feed seeded successfully!");
        if (activeCollection === 'blog_posts') fetchCollection('blog_posts');
    } catch (e: any) {
        alert("Seed failed: " + e.message);
    } finally {
        setIsDbLoading(false);
    }
  };

  return (
    <div className="h-full bg-slate-950 flex flex-col overflow-hidden font-sans">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-20">
          <div className="flex items-center gap-4">
              <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"><ArrowLeft size={20} /></button>
              <h1 className="text-xl font-bold flex items-center gap-2 italic uppercase tracking-tighter">
                <Database className="text-red-500" />
                <span>Admin Inspector</span>
              </h1>
          </div>
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button onClick={() => setMainTab('database')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${mainTab === 'database' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Database</button>
              <button onClick={() => setMainTab('storage')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${mainTab === 'storage' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Storage</button>
          </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {mainTab === 'database' ? (
          <div className="flex-1 flex overflow-hidden">
            <aside className="w-64 border-r border-slate-800 bg-slate-900/30 flex flex-col shrink-0">
              <div className="p-4 border-b border-slate-800 bg-slate-950/50">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Registry Collections</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hide">
                {COLLECTIONS.map(col => (
                  <button key={col} onClick={() => fetchCollection(col)} className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${activeCollection === col ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800'}`}>
                    {col}
                  </button>
                ))}
              </div>
            </aside>

            <main className="flex-1 flex flex-col min-w-0 bg-black/20">
              {activeCollection ? (
                <>
                  <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                      <h2 className="text-sm font-black text-white uppercase tracking-widest">{activeCollection}</h2>
                      <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 shadow-inner">
                        <button onClick={() => setDbViewMode('table')} className={`p-1.5 rounded ${dbViewMode === 'table' ? 'bg-slate-800 text-indigo-400' : 'text-slate-600'}`}><LayoutGrid size={16}/></button>
                        <button onClick={() => setDbViewMode('json')} className={`p-1.5 rounded ${dbViewMode === 'json' ? 'bg-slate-800 text-indigo-400' : 'text-slate-600'}`}><Code size={16}/></button>
                      </div>
                    </div>
                    <button onClick={() => fetchCollection(activeCollection)} className="p-2 text-slate-500 hover:text-white transition-colors"><RefreshCw size={18} className={isDbLoading ? 'animate-spin' : ''}/></button>
                  </div>
                  <div className="flex-1 overflow-auto p-6 scrollbar-thin scrollbar-thumb-slate-800">
                    {isDbLoading ? (
                      <div className="h-full flex flex-col items-center justify-center gap-4 animate-pulse"><Loader2 size={32} className="animate-spin text-indigo-500"/><span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Syncing Ledger...</span></div>
                    ) : dbError ? (
                      <div className="p-8 bg-red-900/20 border border-red-900/50 rounded-3xl flex items-start gap-4 text-red-200 text-sm font-medium"><AlertCircle className="text-red-500 shrink-0" size={24}/><div className="flex-1"><p className="font-bold uppercase mb-1">Refraction Error</p><p>{dbError}</p></div></div>
                    ) : dbDocs.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-700 italic"><Database size={48} className="mb-4 opacity-10"/><p>No documents found in this sector.</p></div>
                    ) : dbViewMode === 'json' ? (
                      <pre className="p-8 bg-slate-950 rounded-3xl border border-slate-800 text-[11px] font-mono text-indigo-300 overflow-x-auto whitespace-pre leading-relaxed shadow-inner">{safeJsonStringify(dbDocs)}</pre>
                    ) : (
                      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-950 text-slate-400 font-black uppercase tracking-widest border-b border-slate-800">
                              <tr>
                                <th className="px-6 py-4">Sovereign ID</th>
                                <th className="px-6 py-4">Actions</th>
                                <th className="px-6 py-4">Neural Data Trace</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                              {dbDocs.map(doc => (
                                <tr key={doc.id} className="hover:bg-indigo-600/5 transition-colors group">
                                  <td className="px-6 py-4 font-mono text-indigo-400 truncate max-w-[150px]" title={doc.id}>{doc.id}</td>
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                      <button onClick={() => { if(confirm("Permanently delete document?")) deleteFirestoreDoc(activeCollection, doc.id).then(() => fetchCollection(activeCollection)) }} className="p-2 text-slate-600 hover:text-red-400 transition-colors bg-slate-950 rounded-lg border border-slate-800" title="Delete"><Trash2 size={14}/></button>
                                      {activeCollection === 'users' && (
                                        <button onClick={() => handleSetUserTier(doc.uid, doc.subscriptionTier)} className="p-2 text-slate-600 hover:text-amber-400 transition-colors bg-slate-950 rounded-lg border border-slate-800" title="Shift Tier">
                                          {doc.subscriptionTier === 'pro' ? <UserMinus size={14}/> : <UserPlus size={14}/>}
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-slate-500 font-mono text-[10px] truncate max-w-sm" title={safeJsonStringify(doc)}>{safeJsonStringify(doc)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-12 overflow-y-auto scrollbar-hide">
                    <div className="space-y-4">
                        <div className="w-24 h-24 bg-red-900/10 border border-red-500/20 rounded-[3rem] flex items-center justify-center mx-auto shadow-2xl group relative overflow-hidden">
                            <Terminal size={48} className="text-red-500 opacity-20 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none">Registry Inspector</h2>
                        <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed">System-level access to the Firestore data plane. Refract, audit, or purge sovereign documents with absolute authority.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
                        <button onClick={() => { if(confirm("Seed Database with defaults?")) seedDatabase().then(() => alert("Seed successful")) }} className="p-6 bg-slate-900 border border-slate-800 rounded-[2rem] text-left hover:border-emerald-500/50 transition-all group shadow-xl relative overflow-hidden">
                            <UploadCloud className="text-emerald-500 mb-4 group-hover:scale-110 transition-transform" size={32}/>
                            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-1">Seed Hub Channels</h3>
                            <p className="text-[10px] text-slate-500 font-medium">Publish standard activities to the public registry.</p>
                        </button>
                        <button onClick={handleSeedBlog} className="p-6 bg-slate-900 border border-slate-800 rounded-[2rem] text-left hover:border-indigo-500/50 transition-all group shadow-xl relative overflow-hidden">
                            <Rss className="text-indigo-400 mb-4 group-hover:scale-110 transition-transform" size={32}/>
                            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-1">Seed Blog Feed</h3>
                            <p className="text-[10px] text-slate-500 font-medium">Inject initial system posts into the community stream.</p>
                        </button>
                        <button onClick={handleRunFullDiagnostics} className="p-6 bg-slate-900 border border-slate-800 rounded-[2rem] text-left hover:border-indigo-500/50 transition-all group shadow-xl relative overflow-hidden">
                            <ShieldCheck className="text-indigo-400 mb-4 group-hover:scale-110 transition-transform" size={32}/>
                            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-1">Neural Diagnostics</h3>
                            <p className="text-[10px] text-slate-500 font-medium">Audit the handshake integrity of the entire spectrum.</p>
                        </button>
                    </div>

                    {isTestingGemini && (
                        <div className="w-full max-w-2xl bg-slate-900/50 border border-slate-800 rounded-[2.5rem] p-8 space-y-4 animate-fade-in-up shadow-2xl">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2"><Activity size={16} className="text-indigo-400"/> Audit Trace</h4>
                                <Loader2 size={18} className="animate-spin text-indigo-500" />
                            </div>
                            <div className="space-y-2">
                                {diagnosticSteps.map(step => (
                                    <div key={step.id} className="flex items-center justify-between p-4 bg-slate-950 rounded-2xl border border-slate-800 shadow-inner">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-2 h-2 rounded-full ${step.status === 'success' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : step.status === 'failed' ? 'bg-red-500 animate-pulse' : step.status === 'running' ? 'bg-indigo-500 animate-ping' : 'bg-slate-800'}`}></div>
                                            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">{step.label}</span>
                                        </div>
                                        <div className="text-right">
                                            {step.details && <span className="text-[10px] font-mono text-slate-600 mr-4">{step.details}</span>}
                                            {step.status === 'failed' && <span className="text-[9px] font-black text-red-500 uppercase">{step.error}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
              )}
            </main>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between px-8">
                <div className="flex items-center gap-3">
                    <Cloud size={18} className="text-indigo-400"/>
                    <div className="bg-slate-950 border border-slate-800 p-2 rounded-xl flex items-center gap-2 text-[10px] font-mono shadow-inner">
                        <span className="text-slate-600">PATH:</span>
                        <span className="text-indigo-300">root/{storagePath || '/'}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => loadStorage(storagePath, isAbsolute)} className="p-2 text-slate-500 hover:text-white transition-colors bg-slate-900 rounded-lg border border-slate-800 shadow-lg"><RefreshCw size={18} className={isStorageLoading ? 'animate-spin' : ''}/></button>
                </div>
            </div>
            
            <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
                    {storageError ? (
                        <div className="p-10 bg-red-900/20 border border-red-900/50 rounded-[3rem] flex items-center gap-6 shadow-2xl animate-fade-in-up">
                            <ShieldAlert size={48} className="text-red-500" />
                            <div className="space-y-1">
                                <h3 className="text-xl font-black text-white uppercase italic">Vault Handshake Error</h3>
                                <p className="text-red-200 text-sm font-medium">{storageError}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-slate-900 border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-slate-950 text-slate-400 font-black uppercase tracking-[0.2em] border-b border-slate-800">
                                        <tr>
                                            <th className="px-8 py-5">Node Identity</th>
                                            <th className="px-8 py-5">Mass</th>
                                            <th className="px-8 py-5 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {(storagePath || isAbsolute) && (
                                            <tr onClick={() => { const parts = storagePath.split('/'); parts.pop(); loadStorage(parts.join('/'), true); }} className="hover:bg-indigo-600/5 cursor-pointer group">
                                                <td colSpan={3} className="px-8 py-4 text-indigo-400 font-black uppercase text-[10px] flex items-center gap-2 group-hover:translate-x-1 transition-transform tracking-widest"><CornerLeftUp size={14}/> .. Escape Level</td>
                                            </tr>
                                        )}
                                        {storageFiles.length === 0 && !isStorageLoading && (
                                            <tr>
                                                <td colSpan={3} className="px-8 py-20 text-center">
                                                    <div className="flex flex-col items-center gap-4 opacity-10">
                                                        <Database size={64} />
                                                        <p className="text-sm font-black uppercase tracking-widest">Sector Empty</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                        {storageFiles.map(file => (
                                            <tr key={file.fullPath} className="hover:bg-indigo-600/5 group transition-colors">
                                                <td className="px-8 py-4">
                                                    <div className="flex items-center gap-4 cursor-pointer" onClick={() => file.isFolder ? loadStorage(file.fullPath, true) : handlePreviewFile(file)}>
                                                        {file.isFolder ? <Folder size={20} className="text-indigo-500 fill-indigo-500/10"/> : <FileJson size={20} className="text-amber-500"/>}
                                                        <div className="flex flex-col">
                                                            <span className="font-mono text-slate-100 font-bold">{file.name}</span>
                                                            <span className="text-[8px] text-slate-600 uppercase font-black tracking-tighter">{file.fullPath}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-4 font-mono text-slate-400 tabular-nums">{formatSize(file.size)}</td>
                                                <td className="px-8 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <div className="flex justify-end gap-1">
                                                        {!file.isFolder && (
                                                            <>
                                                                <button onClick={() => handlePreviewFile(file)} className="p-2 text-slate-500 hover:text-indigo-400 transition-colors bg-slate-950 rounded-lg border border-slate-800" title="Preview"><Eye size={14}/></button>
                                                                <button onClick={() => handleStorageDelete(file.fullPath)} className="p-2 text-slate-500 hover:text-red-400 transition-colors bg-slate-950 rounded-lg border border-slate-800" title="Purge Node"><Trash2 size={14}/></button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {previewContent && (
                    <div className="w-[600px] border-l border-slate-800 bg-slate-950/80 backdrop-blur-2xl flex flex-col animate-fade-in-right relative z-50 shadow-[-20px_0_50px_rgba(0,0,0,0.5)]">
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/60 shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-amber-900/20 text-amber-500 rounded-xl border border-amber-500/20 shadow-lg"><FileJson size={20}/></div>
                                <div>
                                    <h3 className="text-sm font-black text-white truncate max-w-[300px] uppercase tracking-tighter">{previewName}</h3>
                                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Sovereign Data Buffer</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={handleCopyPreview} className="p-2.5 bg-slate-950 hover:bg-indigo-600 rounded-xl text-slate-400 hover:text-white transition-all border border-slate-800 shadow-xl active:scale-95">
                                    {copyStatus ? <Check size={18} className="text-emerald-400"/> : <Copy size={18} />}
                                </button>
                                <button onClick={() => setPreviewContent(null)} className="p-2.5 bg-slate-950 hover:bg-red-600 rounded-xl text-slate-500 hover:text-white transition-all border border-slate-800 shadow-xl active:scale-95"><X size={20}/></button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-8 font-mono text-[11px] text-indigo-200/90 leading-relaxed scrollbar-thin scrollbar-thumb-indigo-500/20 scrollbar-track-transparent">
                            {isPreviewLoading ? (
                                <div className="h-full flex flex-col items-center justify-center gap-4 animate-pulse">
                                    <Loader2 className="animate-spin text-indigo-500" size={32}/>
                                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">Reconstructing Shards...</span>
                                </div>
                            ) : (
                                <pre className="whitespace-pre-wrap select-text selection:bg-indigo-500/30">{previewContent}</pre>
                            )}
                        </div>
                        <div className="p-4 bg-slate-950 border-t border-slate-800 text-center"><p className="text-[8px] font-black text-slate-700 uppercase tracking-[0.5em]">Neural Trace Assembly Complete</p></div>
                    </div>
                )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FirestoreInspector;
