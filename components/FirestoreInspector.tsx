
import React, { useState, useMemo, useEffect } from 'react';
import { getDebugCollectionDocs, seedDatabase, recalculateGlobalStats, cleanupDuplicateUsers, isUserAdmin, deleteFirestoreDoc, purgeFirestoreCollection, setUserSubscriptionTier, updateAllChannelDatesToToday, migrateVaultToLedger } from '../services/firestoreService';
import { listUserBackups, deleteCloudFile, CloudFileEntry, getCloudFileContent } from '../services/cloudService';
import { ArrowLeft, RefreshCw, Database, Table, Code, Search, UploadCloud, Users, ShieldCheck, Crown, Trash2, ShieldAlert, Loader2, Zap, Activity, CheckCircle, Copy, Check, X, Film, GraduationCap, AlertCircle, Info, Cloud, Speech, Settings, Calendar, ArrowRightLeft, Folder, FolderOpen, CornerLeftUp, FileJson, FileAudio, Eye, Layout, Monitor, HardDrive, Terminal, ExternalLink, UserPlus, UserMinus } from 'lucide-react';
import { auth } from '../services/firebaseConfig';
import { UserProfile } from '../types';
import { GoogleGenAI } from "@google/genai";
import { firebaseKeys } from '../services/private_keys';

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
  
  // --- DATABASE STATE ---
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  const [dbDocs, setDbDocs] = useState<any[]>([]);
  const [isDbLoading, setIsDbLoading] = useState(false);
  const [dbViewMode, setDbViewMode] = useState<'table' | 'json'>('table');
  const [dbError, setDbError] = useState<string | null>(null);

  // --- STORAGE STATE ---
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

  // --- DIAGNOSTICS STATE ---
  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [diagnosticSteps, setDiagnosticSteps] = useState<DiagnosticStep[]>([]);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const isSuperAdmin = useMemo(() => {
    const currentUser = auth?.currentUser;
    if (!currentUser) return false;
    const ownerEmails = ['shengliang.song.ai@gmail.com'];
    if (ownerEmails.includes(currentUser.email || '')) return true;
    return isUserAdmin(userProfile || null);
  }, [userProfile]);

  const currentUid = auth.currentUser?.uid || 'Unknown';

  // Persistence of tab and storage path
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

  // --- DATABASE LOGIC ---
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

  // --- STORAGE LOGIC ---
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
        // Robust JSON detection and pretty-printing
        const isJson = file.name.toLowerCase().endsWith('.json') || 
                       content.trim().startsWith('[') || 
                       content.trim().startsWith('{');
        
        if (isJson) {
            try {
                const parsed = JSON.parse(content);
                setPreviewContent(JSON.stringify(parsed, null, 2));
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

        setPreviewContent(`[HANDSHAKE FAILED]\nPath: ${file.fullPath}\nError: ${msg}\n\nAdvice: If you just updated your CORS policy, wait 60 seconds and try a Hard Refresh (Cmd+Shift+R).`);
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
        updateStep('auth', { status: 'failed', error: 'Missing API_KEY', advice: ["Check environment settings."] });
    } else {
        updateStep('auth', { status: 'success', details: `Gemini Key detected: ${process.env.API_KEY.substring(0, 8)}...` });
    }

    updateStep('standard', { status: 'running' });
    try {
        const resp = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: 'Neural Heartbeat' });
        updateStep('standard', { status: 'success', details: `Response: "${resp.text?.substring(0, 20)}..."` });
    } catch (e: any) {
        updateStep('standard', { status: 'failed', error: e.message });
    }

    updateStep('storage', { status: 'running' });
    try {
        const res = await listUserBackups('bible_corpus', true);
        updateStep('storage', { status: 'success', details: `Read access to 'bible_corpus' confirmed. Found ${res.length} items.` });
    } catch (e: any) {
        updateStep('storage', { status: 'failed', error: e.message });
    }

    const activeGcpKey = userProfile?.cloudTtsApiKey || process.env.API_KEY;
    updateStep('cloud_tts', { status: 'running' });
    try {
        const res = await fetch(`https://texttospeech.googleapis.com/v1/voices?key=${activeGcpKey}`);
        const data = await res.json();
        updateStep('cloud_tts', { status: 'success', details: `Enterprise voices received: ${data.voices?.length || 0}` });
    } catch (e: any) {
        updateStep('cloud_tts', { status: 'failed', error: e.message });
    }

    updateStep('veo', { status: 'running' });
    try {
        const veoAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const op = await veoAi.models.generateVideos({ model: 'veo-3.1-fast-generate-preview', prompt: 'Probe', config: { numberOfVideos: 1 } });
        updateStep('veo', { status: 'success', details: `Handshake successful. Op: ${op.id}` });
    } catch (e: any) {
        updateStep('veo', { status: 'failed', error: e.message });
    }
  };

  const handleMigrateVault = async () => {
    setIsTestingGemini(true);
    const steps: DiagnosticStep[] = [{ id: 'migrate', label: 'Vault to Ledger Migration', status: 'running' }];
    setDiagnosticSteps(steps);
    const logUpdate = (msg: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') => {
        setDiagnosticSteps(prev => {
            const step = prev[0];
            const details = (step.details || '') + '\n' + msg;
            return [{ ...step, details, status: type === 'error' ? 'failed' : (type === 'success' ? 'success' : 'running') }];
        });
    };
    try { await migrateVaultToLedger(logUpdate); } catch (e: any) { setDiagnosticSteps(prev => [{ ...prev[0], status: 'failed', error: e.message }]); }
  };

  const dbKeys = Array.from(new Set(dbDocs.flatMap(d => Object.keys(d)))) as string[];

  const bucketUrl = firebaseKeys.storageBucket || "YOUR_BUCKET.appspot.com";

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      
      {/* Universal Header */}
      <header className="p-4 border-b border-slate-800 bg-slate-900 flex items-center justify-between shrink-0 z-50">
         <div className="flex items-center space-x-4">
           <button onClick={onBack} className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors">
              <ArrowLeft size={20} />
           </button>
           <div>
              <h1 className="text-xl font-bold flex items-center space-x-2 italic uppercase tracking-tighter">
                <Cloud className="text-indigo-400" />
                <span>Neural Console</span>
              </h1>
              <p className="text-[10px] text-slate-500 font-mono">UID: {currentUid}</p>
           </div>
         </div>
         
         <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-inner">
             <button onClick={() => setMainTab('database')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${mainTab === 'database' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                <Database size={14}/> Database
             </button>
             <button onClick={() => setMainTab('storage')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${mainTab === 'storage' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                <Folder size={14}/> Storage
             </button>
         </div>

         <div className="flex gap-2">
             <button onClick={handleMigrateVault} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-900/40 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95">
                <ArrowRightLeft size={14}/> Refract Vault
             </button>
             <button onClick={handleRunFullDiagnostics} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-900/40 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95">
                <Zap size={14}/> Neural Handshake
             </button>
         </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
          
          {/* DATABASE TAB VIEW */}
          {mainTab === 'database' && (
              <>
                <div className="w-64 bg-slate-900 border-r border-slate-800 overflow-y-auto p-4 shrink-0 scrollbar-hide">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4 px-2">Collections</h3>
                    <div className="space-y-1">
                        {COLLECTIONS.map(col => (
                            <button
                                key={col}
                                onClick={() => fetchCollection(col)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${activeCollection === col ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                            >
                                {col.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col bg-slate-950 relative">
                    {activeCollection ? (
                        <>
                            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 shrink-0">
                                <div className="flex items-center space-x-3">
                                    <h2 className="font-bold text-lg text-white capitalize">{activeCollection.replace('_', ' ')}</h2>
                                    <span className="text-[10px] font-black text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800 uppercase tracking-widest">
                                        {isDbLoading ? 'Syncing...' : `${dbDocs.length} Entries`}
                                    </span>
                                    {isSuperAdmin && (
                                        <button onClick={() => purgeFirestoreCollection(activeCollection!)} className="p-1.5 text-red-500 hover:bg-red-950/30 rounded-lg transition-colors" title="Purge Collection"><Trash2 size={16}/></button>
                                    )}
                                </div>
                                <div className="flex items-center space-x-2">
                                    <div className="bg-slate-900 p-1 rounded-lg border border-slate-800 flex">
                                        <button onClick={() => setDbViewMode('json')} className={`p-1.5 rounded ${dbViewMode === 'json' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}><Code size={16}/></button>
                                        <button onClick={() => setDbViewMode('table')} className={`p-1.5 rounded ${dbViewMode === 'table' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}><Table size={16}/></button>
                                    </div>
                                    <button onClick={() => fetchCollection(activeCollection!)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white transition-colors"><RefreshCw size={16} className={isDbLoading ? 'animate-spin' : ''} /></button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-auto p-6 scrollbar-hide">
                                {isDbLoading ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4"><Loader2 className="animate-spin text-indigo-500" size={32} /><span className="text-[10px] font-black uppercase tracking-[0.2em]">Paging Neural Registry...</span></div>
                                ) : dbError ? (
                                    <div className="text-red-400 p-4 border border-red-900/50 bg-red-900/20 rounded-xl flex items-center gap-3"><ShieldAlert size={20}/><span>{dbError}</span></div>
                                ) : dbDocs.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center opacity-20"><Search size={64}/><p className="text-sm font-bold uppercase tracking-widest mt-4">Empty Node</p></div>
                                ) : dbViewMode === 'json' ? (
                                    <pre className="text-xs font-mono text-indigo-200 bg-slate-900 p-6 rounded-2xl overflow-auto border border-slate-800 max-w-full shadow-inner leading-relaxed">{JSON.stringify(dbDocs, null, 2)}</pre>
                                ) : (
                                    <div className="overflow-x-auto border border-slate-800 rounded-2xl shadow-2xl bg-slate-900/20">
                                        <table className="w-full text-left text-[11px] text-slate-400 border-collapse">
                                            <thead className="bg-slate-950 text-slate-200 uppercase font-black tracking-widest sticky top-0 z-10 border-b border-slate-800">
                                                <tr>{dbKeys.map(k => <th key={k} className="px-5 py-4 whitespace-nowrap">{k}</th>)}{isSuperAdmin && <th className="px-5 py-4 whitespace-nowrap text-right">Actions</th>}</tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-800/50">
                                                {dbDocs.map((doc, i) => (
                                                    <tr key={doc.id || i} className="hover:bg-indigo-600/5 transition-colors">
                                                        {dbKeys.map(k => (
                                                            <td key={k} className="px-5 py-3 whitespace-nowrap overflow-hidden text-ellipsis max-w-[250px] font-mono" title={String(doc[k])}>
                                                                {doc[k] !== undefined ? String(doc[k]) : '-'}
                                                            </td>
                                                        ))}
                                                        {isSuperAdmin && (
                                                            <td className="px-5 py-3 text-right">
                                                                <div className="flex items-center justify-end gap-1">
                                                                    {activeCollection === 'users' && (
                                                                        <button 
                                                                            onClick={() => handleSetUserTier(doc.uid || doc.id, doc.subscriptionTier)} 
                                                                            className={`p-2 rounded-lg transition-colors ${doc.subscriptionTier === 'pro' ? 'text-amber-400 hover:bg-amber-900/30' : 'text-indigo-400 hover:bg-indigo-900/30'}`}
                                                                            title={doc.subscriptionTier === 'pro' ? 'Demote to Free' : 'Promote to Pro'}
                                                                        >
                                                                            {doc.subscriptionTier === 'pro' ? <UserMinus size={14}/> : <UserPlus size={14}/>}
                                                                        </button>
                                                                    )}
                                                                    <button onClick={() => deleteFirestoreDoc(activeCollection!, doc.id)} className="p-2 text-red-400 hover:bg-red-900/30 rounded-lg"><Trash2 size={14}/></button>
                                                                </div>
                                                            </td>
                                                        )}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-700 gap-6">
                            <Database size={64} className="opacity-10" />
                            <p className="text-xs font-black uppercase tracking-[0.4em]">Select Registry Segment</p>
                        </div>
                    )}
                </div>
              </>
          )}

          {/* STORAGE TAB VIEW */}
          {mainTab === 'storage' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 flex flex-col p-8 space-y-6 overflow-y-auto scrollbar-hide">
                        {/* Storage Breadcrumbs */}
                        <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl flex items-center space-x-2 text-xs font-mono overflow-x-auto shadow-inner shrink-0">
                           <button onClick={() => loadStorage('', false)} className="text-indigo-400 hover:underline">root</button>
                           {storagePath.split('/').filter(Boolean).map((part, i, arr) => (
                              <React.Fragment key={i}>
                                 <span className="text-slate-600">/</span>
                                 <button onClick={() => loadStorage(arr.slice(0, i+1).join('/'), true)} className={`${i === arr.length - 1 ? 'text-white font-bold' : 'text-indigo-400 hover:underline'}`}>{part}</button>
                              </React.Fragment>
                           ))}
                           <div className="flex-1"></div>
                           <div className="flex gap-2">
                               <button onClick={() => loadStorage('', false)} className="flex items-center gap-2 px-3 py-1 bg-slate-800 text-slate-400 border border-slate-700 rounded-lg text-[10px] font-black uppercase hover:text-white transition-all">
                                    <HardDrive size={12}/> My Backups
                               </button>
                               <button onClick={() => loadStorage('bible_corpus', true)} className="flex items-center gap-2 px-3 py-1 bg-amber-900/20 text-amber-400 border border-amber-500/30 rounded-lg text-[10px] font-black uppercase hover:bg-amber-600 hover:text-white transition-all">
                                    <Database size={12}/> Bible Ingest
                                </button>
                           </div>
                        </div>

                        {storageError && (
                            <div className="p-4 bg-red-900/20 border border-red-900/50 rounded-xl flex items-start gap-3 animate-fade-in shadow-xl">
                                <ShieldAlert className="text-red-500 shrink-0 mt-0.5" size={18} />
                                <div className="space-y-1">
                                    <p className="text-sm font-bold text-red-200">Storage Handshake Failed</p>
                                    <p className="text-xs text-red-300 leading-relaxed font-mono whitespace-pre-wrap">{storageError}</p>
                                    <div className="mt-3 flex gap-2">
                                        <button onClick={() => loadStorage(storagePath, isAbsolute)} className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-[9px] font-black uppercase rounded shadow-lg transition-all">Retry List</button>
                                        <button onClick={() => loadStorage('', false)} className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9px] font-black uppercase rounded border border-slate-700 transition-all">Reset to Root</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Storage Table */}
                        <div className="bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden shadow-2xl bg-slate-900/50">
                           <div className="overflow-x-auto">
                             <table className="w-full text-left text-sm text-slate-400 border-collapse">
                               <thead className="bg-slate-950 text-slate-200 uppercase text-[10px] font-black tracking-widest sticky top-0">
                                 <tr>
                                   <th className="px-6 py-4">Name</th>
                                   <th className="px-6 py-4">Type</th>
                                   <th className="px-6 py-4">Size</th>
                                   <th className="px-6 py-4 text-right">Actions</th>
                                 </tr>
                               </thead>
                               <tbody className="divide-y divide-slate-800">
                                 {(storagePath || isAbsolute) && (
                                    <tr onClick={() => { const parts = storagePath.split('/'); parts.pop(); loadStorage(parts.join('/'), true); }} className="hover:bg-slate-800/50 transition-colors cursor-pointer group">
                                       <td className="px-6 py-3" colSpan={4}><div className="flex items-center space-x-2 text-indigo-400 group-hover:text-white"><CornerLeftUp size={16} /><span className="text-xs font-bold uppercase tracking-widest">.. (Go Up)</span></div></td>
                                    </tr>
                                 )}
                                 {storageFiles.map((file) => (
                                   <tr key={file.fullPath} className="hover:bg-indigo-600/5 transition-colors group">
                                      <td className="px-6 py-4">
                                         <div className={`flex items-center space-x-3 ${file.isFolder ? 'cursor-pointer text-indigo-300 hover:text-white' : 'text-slate-200'}`} onClick={() => file.isFolder ? loadStorage(file.fullPath, true) : handlePreviewFile(file)}>
                                            {file.isFolder ? <Folder size={18} className="fill-indigo-900/50 text-indigo-400" /> : file.name.endsWith('.json') ? <FileJson size={18} className="text-amber-500" /> : <FileAudio size={18} className="text-emerald-500" />}
                                            <span className="font-mono text-xs">{file.name}</span>
                                         </div>
                                      </td>
                                      <td className="px-6 py-4 text-slate-600 text-[10px] font-black uppercase tracking-tighter">{file.isFolder ? 'Directory' : file.contentType || 'Binary'}</td>
                                      <td className="px-6 py-4 font-mono text-[10px] text-emerald-400">{formatSize(file.size)}</td>
                                      <td className="px-6 py-4 text-right">
                                         <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {!file.isFolder && (
                                               <>
                                                  <button onClick={() => handlePreviewFile(file)} className="p-2 text-slate-400 hover:text-indigo-400 transition-colors" title="Preview"><Eye size={16} /></button>
                                                  {isSuperAdmin && <button onClick={() => handleStorageDelete(file.fullPath)} className="p-2 text-slate-500 hover:text-red-400 transition-colors" title="Delete"><Trash2 size={16} /></button>}
                                               </>
                                            )}
                                         </div>
                                      </td>
                                   </tr>
                                 ))}
                               </tbody>
                             </table>
                             {isStorageLoading && (
                                <div className="p-20 flex flex-col items-center gap-4 animate-pulse">
                                    <Loader2 size={32} className="animate-spin text-indigo-500"/>
                                    <div className="text-center">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 block">Paging Storage Nodes...</span>
                                        <span className="text-[8px] font-mono text-slate-700 uppercase mt-1 block">Path: {storagePath || 'root'}</span>
                                    </div>
                                </div>
                             )}
                             {!isStorageLoading && !storageError && storageFiles.length === 0 && (
                                 <div className="p-20 flex flex-col items-center gap-4 text-slate-700 animate-fade-in">
                                     <FolderOpen size={48} className="opacity-10"/>
                                     <div className="text-center">
                                        <p className="text-xs font-black uppercase tracking-widest">Directory is Empty</p>
                                        <p className="text-[9px] font-mono text-slate-800 mt-2 uppercase">Verified Path: {storagePath || 'backups/public'}</p>
                                     </div>
                                 </div>
                             )}
                           </div>
                        </div>
                  </div>

                  {/* Storage Preview Panel */}
                  {(previewContent || isPreviewLoading) && (
                      <div className="w-1/2 border-l border-slate-800 bg-black/40 backdrop-blur-md flex flex-col animate-fade-in relative z-50">
                          <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/80 shrink-0">
                              <div className="flex items-center gap-3">
                                  <FileJson size={18} className="text-amber-500"/>
                                  <h3 className="text-sm font-bold text-white truncate max-w-[200px]">{previewName}</h3>
                              </div>
                              <div className="flex items-center gap-2">
                                  <button onClick={handleCopyPreview} className={`p-1.5 rounded-lg transition-colors ${copyStatus ? 'bg-emerald-600 text-white' : 'hover:bg-white/10 text-slate-400 hover:text-white'}`} title="Copy Content">
                                      {copyStatus ? <Check size={16}/> : <Copy size={16}/>}
                                  </button>
                                  <button onClick={() => { setPreviewContent(null); setPreviewName(null); }} className="p-1 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-colors"><X size={20}/></button>
                              </div>
                          </div>
                          <div className="flex-1 overflow-auto p-6 font-mono text-xs text-indigo-200/80 leading-relaxed scrollbar-hide">
                              {isPreviewLoading ? (
                                  <div className="h-full flex flex-col items-center justify-center gap-3 animate-pulse"><Loader2 size={32} className="animate-spin text-indigo-500"/><span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Decrypting Storage Node...</span></div>
                              ) : (
                                <div className="space-y-6">
                                    {showCorsFix && (
                                        <div className="bg-emerald-950/40 border border-emerald-500/30 p-6 rounded-3xl space-y-4 animate-fade-in-up shadow-2xl">
                                            <div className="flex items-center gap-3 text-emerald-400">
                                                <CheckCircle size={20}/>
                                                <h4 className="text-sm font-black uppercase tracking-[0.2em]">CORS Handshake Optimized</h4>
                                            </div>
                                            <p className="text-xs text-slate-300 leading-relaxed">Bucket origin access detected. If content fails to load, ensure your <a href="https://console.cloud.google.com/" target="_blank" className="text-indigo-400 underline">Google Cloud Shell</a> has applied the policy to the correct bucket:</p>
                                            
                                            <div className="bg-black/80 p-3 rounded-xl border border-white/10 relative group">
                                                <code className="text-[10px] text-indigo-300 break-all leading-relaxed block pr-8">
                                                    gsutil cors set cors.json gs://{bucketUrl}
                                                </code>
                                            </div>
                                        </div>
                                    )}
                                    <pre className="whitespace-pre-wrap select-text bg-slate-900/40 p-4 rounded-xl border border-white/5 shadow-inner">
                                        {previewContent}
                                    </pre>
                                </div>
                              )}
                          </div>
                          <div className="p-4 bg-slate-950 border-t border-slate-800 text-center shrink-0">
                              <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Sovereign Data Preview Mode</p>
                          </div>
                      </div>
                  )}
              </div>
          )}
      </div>

      {/* Diagnostics Overlay */}
      {isTestingGemini && (
        <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
            <div className="bg-slate-900 border border-slate-700 rounded-[2.5rem] w-full max-w-3xl shadow-2xl overflow-hidden animate-fade-in-up">
                <div className="p-6 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
                    <div className="flex items-center gap-3"><Activity className="text-indigo-400" /><h3 className="text-lg font-black text-white italic uppercase tracking-widest">Neural Diagnostic Matrix</h3></div>
                    <button onClick={() => setIsTestingGemini(false)} className="p-2 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white transition-colors"><X size={20}/></button>
                </div>
                <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto scrollbar-hide">
                    {diagnosticSteps.map((step) => (
                        <div key={step.id} className={`p-5 rounded-2xl border transition-all ${step.status === 'success' ? 'bg-emerald-950/20 border-emerald-500/30' : step.status === 'failed' ? 'bg-red-950/20 border-red-500/30' : step.status === 'running' ? 'bg-indigo-950/20 border-indigo-500/30 animate-pulse' : 'bg-slate-900/50 border-slate-800'}`}>
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${step.status === 'success' ? 'bg-emerald-500' : step.status === 'failed' ? 'bg-red-500' : 'bg-slate-800'}`}>
                                        {step.id === 'storage' ? <Cloud size={16} className="text-white"/> : <Zap size={16} className="text-white"/>}
                                    </div>
                                    <div><h4 className="text-sm font-bold text-white">{step.label}</h4><p className="text-[10px] text-slate-500 uppercase font-black">ID: {step.id}</p></div>
                                </div>
                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${step.status === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>{step.status}</span>
                            </div>
                            {step.details && <pre className="text-xs text-slate-300 mt-3 leading-relaxed bg-black/30 p-3 rounded-xl border border-white/10 whitespace-pre-wrap font-mono overflow-auto max-h-40">{step.details}</pre>}
                            {step.error && <p className="mt-3 p-3 bg-red-900/40 rounded-xl border border-red-500/20 text-[11px] font-mono text-red-200">{step.error}</p>}
                        </div>
                    ))}
                    <div className="flex gap-3 pt-4"><button onClick={() => { navigator.clipboard.writeText(JSON.stringify(diagnosticSteps, null, 2)); setCopyFeedback(true); setTimeout(() => setCopyFeedback(false), 2000); }} className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-slate-700">{copyFeedback ? <Check size={16} className="text-emerald-400"/> : <Copy size={16}/>} Copy Log</button><button onClick={() => setIsTestingGemini(false)} className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl transition-all">Dismiss</button></div>
                </div>
                <div className="p-4 bg-slate-950 border-t border-slate-800 text-center"><p className="text-[8px] text-slate-600 font-black uppercase tracking-[0.2em]">Neural Handshake Protocol v5.8.2-CONSOLE</p></div>
            </div>
        </div>
      )}
    </div>
  );
};

export default FirestoreInspector;
