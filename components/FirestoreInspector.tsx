import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { getDebugCollectionDocs, seedDatabase, seedBlogPosts, recalculateGlobalStats, isUserAdmin, deleteFirestoreDoc, purgeFirestoreCollection, setUserSubscriptionTier, updateAllChannelDatesToToday } from '../services/firestoreService';
import { listUserBackups, deleteCloudFile, CloudFileEntry, getCloudFileContent } from '../services/cloudService';
import { ArrowLeft, RefreshCw, Database, Code, UploadCloud, Users, ShieldCheck, Crown, Trash2, ShieldAlert, Loader2, Zap, Activity, CheckCircle, Copy, Check, X, Film, GraduationCap, AlertCircle, Info, Cloud, Settings, Calendar, Folder, FolderOpen, CornerLeftUp, FileJson, LayoutGrid, Rss, Terminal, Server, Eye } from 'lucide-react';
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
}

export const FirestoreInspector: React.FC<FirestoreInspectorProps> = ({ onBack, userProfile }) => {
  const [mainTab, setMainTab] = useState<'database' | 'storage'>(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tab');
    return (t === 'storage') ? 'storage' : 'database';
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

  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [diagnosticSteps, setDiagnosticSteps] = useState<DiagnosticStep[]>([]);

  const isSuperAdmin = useMemo(() => {
    const currentUser = auth?.currentUser;
    if (!currentUser) return false;
    return currentUser.email === 'shengliang.song.ai@gmail.com' || isUserAdmin(userProfile || null);
  }, [userProfile]);

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
      setIsDbLoading(false);
    }
  };

  const handleSetUserTier = async (uid: string, currentTier: string) => {
      const nextTier = currentTier === 'pro' ? 'free' : 'pro';
      if (!confirm(`Shift user ${uid} to ${nextTier.toUpperCase()}?`)) return;
      try {
          await setUserSubscriptionTier(uid, nextTier);
          setDbDocs(prev => prev.map(d => d.uid === uid ? { ...d, subscriptionTier: nextTier } : d));
      } catch (e: any) { alert(e.message); }
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
        setStorageError(e.message || "Storage Error");
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
    try {
        const content = await getCloudFileContent(file.fullPath);
        setPreviewContent(content);
    } catch (e: any) {
        setPreviewContent(`[HANDSHAKE FAILED]\nError: ${e.message}`);
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
    if (!confirm(`Delete cloud file: ${fullPath}?`)) return;
    try {
      await deleteCloudFile(fullPath);
      await loadStorage(storagePath, isAbsolute);
    } catch (e) { alert("Delete failed."); }
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
        { id: 'storage', label: 'Cloud Storage Handshake', status: 'idle' }
    ];
    setDiagnosticSteps(steps);

    const updateStep = (id: string, update: Partial<DiagnosticStep>) => {
        setDiagnosticSteps(prev => prev.map(s => s.id === id ? { ...s, ...update } : s));
    };

    updateStep('auth', { status: 'running' });
    if (!process.env.API_KEY) updateStep('auth', { status: 'failed', error: 'Missing Key' });
    else updateStep('auth', { status: 'success', details: 'API Key located.' });

    updateStep('standard', { status: 'running' });
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const res = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: 'test' });
        if (res.text) updateStep('standard', { status: 'success', details: 'Flash responsive.' });
        else throw new Error("Empty response");
    } catch (e: any) { updateStep('standard', { status: 'failed', error: e.message }); }

    updateStep('storage', { status: 'running' });
    try {
        await listUserBackups();
        updateStep('storage', { status: 'success', details: 'Storage verified.' });
    } catch (e: any) { updateStep('storage', { status: 'failed', error: e.message }); }

    setIsTestingGemini(false);
  };

  return (
    <div className="h-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-20">
          <div className="flex items-center gap-4">
              <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"><ArrowLeft size={20} /></button>
              <h1 className="text-xl font-bold flex items-center gap-2 italic uppercase tracking-tighter">
                <Database className="text-red-500" />
                <span>Registry Inspector</span>
              </h1>
          </div>
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button onClick={() => setMainTab('database')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${mainTab === 'database' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>NoSQL Ledger</button>
              <button onClick={() => setMainTab('storage')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${mainTab === 'storage' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Cloud Blobs</button>
          </div>
          <div className="flex items-center gap-3">
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Serverless Architecture Mode</span>
          </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {mainTab === 'database' ? (
          <div className="flex-1 flex overflow-hidden">
            <aside className="w-64 border-r border-slate-800 bg-slate-900/30 flex flex-col shrink-0">
              <div className="p-4 border-b border-slate-800 bg-slate-950/50"><h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Sector Collections</h3></div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hide">
                {COLLECTIONS.map(col => (
                  <button key={col} onClick={() => fetchCollection(col)} className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${activeCollection === col ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800'}`}>{col}</button>
                ))}
              </div>
            </aside>
            <main className="flex-1 flex flex-col min-w-0 bg-black/20">
              {activeCollection ? (
                <>
                  <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                      <h2 className="text-sm font-black text-white uppercase tracking-widest">{activeCollection}</h2>
                      <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                        <button onClick={() => setDbViewMode('table')} className={`p-1.5 rounded ${dbViewMode === 'table' ? 'bg-slate-800 text-indigo-400' : 'text-slate-600'}`}><LayoutGrid size={16}/></button>
                        <button onClick={() => setDbViewMode('json')} className={`p-1.5 rounded ${dbViewMode === 'json' ? 'bg-slate-800 text-indigo-400' : 'text-slate-600'}`}><Code size={16}/></button>
                      </div>
                    </div>
                    <button onClick={() => fetchCollection(activeCollection)} className="p-2 text-slate-500 hover:text-white transition-colors"><RefreshCw size={18} className={isDbLoading ? 'animate-spin' : ''}/></button>
                  </div>
                  <div className="flex-1 overflow-auto p-6 scrollbar-hide">
                    {isDbLoading ? (
                      <div className="h-full flex flex-col items-center justify-center gap-4 animate-pulse"><Loader2 size={32} className="animate-spin text-indigo-500"/><span className="text-[10px] font-black uppercase text-slate-600">Hydrating Nodes...</span></div>
                    ) : (
                      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                         {dbViewMode === 'json' ? <pre className="p-8 text-[11px] font-mono text-indigo-300 overflow-x-auto whitespace-pre leading-relaxed">{safeJsonStringify(dbDocs)}</pre> : (
                           <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-slate-950 text-slate-400 font-black uppercase tracking-widest border-b border-slate-800">
                                  <tr><th className="px-6 py-4">ID</th><th className="px-6 py-4">Actions</th><th className="px-6 py-4">Trace</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                  {dbDocs.map(doc => (
                                    <tr key={doc.id} className="hover:bg-indigo-600/5 transition-colors group">
                                      <td className="px-6 py-4 font-mono text-indigo-400 truncate max-w-[150px]">{doc.id}</td>
                                      <td className="px-6 py-4"><div className="flex items-center gap-2">
                                        <button onClick={() => { if(confirm("Delete node?")) deleteFirestoreDoc(activeCollection, doc.id).then(() => fetchCollection(activeCollection)) }} className="p-2 text-slate-600 hover:text-red-400 transition-colors bg-slate-950 rounded-lg border border-slate-800"><Trash2 size={14}/></button>
                                        {activeCollection === 'users' && <button onClick={() => handleSetUserTier(doc.uid, doc.subscriptionTier)} className="p-2 text-slate-600 hover:text-amber-400 bg-slate-950 rounded-lg border border-slate-800"><RefreshCw size={14}/></button>}
                                      </div></td>
                                      <td className="px-6 py-4 text-slate-500 font-mono text-[10px] truncate max-w-sm">{safeJsonStringify(doc)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                           </div>
                         )}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-12">
                   <div className="space-y-4">
                        <div className="w-24 h-24 bg-red-900/10 border border-red-500/20 rounded-[3rem] flex items-center justify-center mx-auto shadow-2xl"><Terminal size={48} className="text-red-500 opacity-20" /></div>
                        <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">Ledger Auditor</h2>
                        <p className="text-slate-500 text-sm max-w-md mx-auto">Sovereign NoSQL management for the Neural Prism community registry.</p>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
                        <button onClick={() => { if(confirm("Seed Database?")) seedDatabase() }} className="p-6 bg-slate-900 border border-slate-800 rounded-[2rem] text-left hover:border-emerald-500/50 transition-all group">
                            <UploadCloud className="text-emerald-500 mb-4 group-hover:scale-110 transition-transform" size={32}/>
                            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-1">Seed Hub Channels</h3>
                            <p className="text-[10px] text-slate-500">Inject Handcrafted spectrum activities.</p>
                        </button>
                        <button onClick={handleRunFullDiagnostics} className="p-6 bg-slate-900 border border-slate-800 rounded-[2rem] text-left hover:border-indigo-500/50 transition-all group">
                            <ShieldCheck className="text-indigo-400 mb-4 group-hover:scale-110 transition-transform" size={32}/>
                            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-1">Run Diagnostics</h3>
                            <p className="text-[10px] text-slate-500">Audit connectivity and API health.</p>
                        </button>
                   </div>
                </div>
              )}
            </main>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between px-8">
                <div className="flex items-center gap-3">
                    <Cloud size={18} className="text-indigo-400"/>
                    <div className="bg-slate-950 border border-slate-800 p-2 rounded-xl text-[10px] font-mono"><span className="text-slate-600">PATH:</span> <span className="text-indigo-300">root/{storagePath || '/'}</span></div>
                </div>
                <button onClick={() => loadStorage(storagePath, isAbsolute)} className="p-2 text-slate-500 hover:text-white transition-colors bg-slate-900 rounded-lg border border-slate-800"><RefreshCw size={18} className={isStorageLoading ? 'animate-spin' : ''}/></button>
            </div>
            <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
                    <div className="bg-slate-900 border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-950 text-slate-400 font-black uppercase tracking-widest border-b border-slate-800">
                                <tr><th className="px-8 py-5">Node Identity</th><th className="px-8 py-5">Mass</th><th className="px-8 py-5 text-right">Action</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {(storagePath || isAbsolute) && (
                                    <tr onClick={() => { const parts = storagePath.split('/'); parts.pop(); loadStorage(parts.join('/'), true); }} className="hover:bg-indigo-600/5 cursor-pointer group">
                                        <td colSpan={3} className="px-8 py-4 text-indigo-400 font-black uppercase text-[10px]"><CornerLeftUp size={14} className="inline mr-2"/> .. Escape Level</td>
                                    </tr>
                                )}
                                {storageFiles.map(file => (
                                    <tr key={file.fullPath} className="hover:bg-indigo-600/5 group transition-colors">
                                        <td className="px-8 py-4"><div className="flex items-center gap-4 cursor-pointer" onClick={() => file.isFolder ? loadStorage(file.fullPath, true) : handlePreviewFile(file)}>
                                            {file.isFolder ? <Folder size={20} className="text-indigo-500 fill-indigo-500/10"/> : <FileJson size={20} className="text-amber-500"/>}
                                            <div className="flex flex-col"><span className="font-mono text-slate-100 font-bold">{file.name}</span><span className="text-[8px] text-slate-600 uppercase font-black">{file.fullPath}</span></div>
                                        </div></td>
                                        <td className="px-8 py-4 font-mono text-slate-400">{formatSize(file.size)}</td>
                                        <td className="px-8 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="flex justify-end gap-1">
                                                {!file.isFolder && <button onClick={() => handlePreviewFile(file)} className="p-2 text-slate-500 hover:text-indigo-400 bg-slate-950 rounded-lg border border-slate-800"><Eye size={14}/></button>}
                                                <button onClick={() => handleStorageDelete(file.fullPath)} className="p-2 text-slate-500 hover:text-red-400 bg-slate-950 rounded-lg border border-slate-800"><Trash2 size={14}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                {previewContent && (
                    <div className="w-[500px] border-l border-slate-800 bg-slate-950/80 backdrop-blur-2xl flex flex-col animate-fade-in-right relative z-50">
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center shrink-0">
                            <h3 className="text-sm font-black text-white truncate max-w-[300px] uppercase tracking-tighter">{previewName}</h3>
                            <button onClick={() => setPreviewContent(null)} className="p-2 text-slate-500 hover:text-white"><X size={20}/></button>
                        </div>
                        <div className="flex-1 overflow-auto p-8 font-mono text-[11px] text-indigo-200/90 leading-relaxed scrollbar-hide">
                            {isPreviewLoading ? <Loader2 className="animate-spin text-indigo-500 mx-auto" size={32}/> : <pre className="whitespace-pre-wrap select-text">{previewContent}</pre>}
                        </div>
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
