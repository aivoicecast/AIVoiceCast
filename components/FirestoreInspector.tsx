
import React, { useState, useMemo } from 'react';
import { getDebugCollectionDocs, seedDatabase, recalculateGlobalStats, cleanupDuplicateUsers, isUserAdmin, deleteFirestoreDoc, purgeFirestoreCollection, setUserSubscriptionTier, updateAllChannelDatesToToday } from '../services/firestoreService';
import { ArrowLeft, RefreshCw, Database, Table, Code, Search, UploadCloud, Users, ShieldCheck, Crown, Trash2, ShieldAlert, Loader2, Zap, Activity, CheckCircle, Copy, Check, X, Film, GraduationCap, AlertCircle, Info, Cloud, Speech, Settings, Calendar } from 'lucide-react';
import { auth } from '../services/firebaseConfig';
import { UserProfile } from '../types';
import { GoogleGenAI } from "@google/genai";
import { GCP_API_KEY } from '../services/private_keys';

interface FirestoreInspectorProps {
  onBack: () => void;
  userProfile: UserProfile | null;
}

const COLLECTIONS = [
  'users', 'channels', 'channel_stats', 'groups', 'messages', 'bookings', 
  'recordings', 'discussions', 'blogs', 'blog_posts', 'job_postings', 
  'career_applications', 'code_projects', 'whiteboards', 'saved_words', 
  'cards', 'icons', 'checks', 'shipping', 'coin_transactions', 'tasks', 
  'notebooks', 'invitations', 'mock_interviews'
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
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [diagnosticSteps, setDiagnosticSteps] = useState<DiagnosticStep[]>([]);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'json'>('table');
  const [error, setError] = useState<string | null>(null);

  const isSuperAdmin = useMemo(() => {
    const currentUser = auth?.currentUser;
    if (!currentUser) return false;
    const ownerEmails = ['shengliang.song.ai@gmail.com'];
    if (ownerEmails.includes(currentUser.email || '')) return true;
    return isUserAdmin(userProfile || null);
  }, [userProfile]);

  const fetchCollection = async (name: string) => {
    setActiveCollection(name);
    setIsLoading(true);
    setDocs([]);
    setError(null);
    try {
      const data = await getDebugCollectionDocs(name, 100); 
      setDocs(data);
    } catch (e: any) {
      setError(e.message || "Failed to fetch");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunFullDiagnostics = async () => {
    setIsTestingGemini(true);
    
    const steps: DiagnosticStep[] = [
        { id: 'auth', label: 'Neural Key Integrity', status: 'idle' },
        { id: 'standard', label: 'Gemini 3 Flash Handshake', status: 'idle' },
        { id: 'cloud_tts', label: 'Cloud TTS API Handshake', status: 'idle' },
        { id: 'veo', label: 'Veo Video Spectrum', status: 'idle' }
    ];
    setDiagnosticSteps(steps);

    const updateStep = (id: string, update: Partial<DiagnosticStep>) => {
        setDiagnosticSteps(prev => prev.map(s => s.id === id ? { ...s, ...update } : s));
    };

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Step 1: Basic Key Check
    updateStep('auth', { status: 'running' });
    if (!process.env.API_KEY) {
        updateStep('auth', { 
            status: 'failed', 
            error: 'Missing API_KEY in environment variables.',
            advice: ["Check your .env or platform deployment settings."]
        });
    } else {
        updateStep('auth', { status: 'success', details: `Gemini Key detected: ${process.env.API_KEY.substring(0, 8)}...` });
    }

    // Step 2: Standard API
    updateStep('standard', { status: 'running' });
    try {
        const resp = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: 'Neural Heartbeat'
        });
        updateStep('standard', { status: 'success', details: `Latency: Low. Response: "${resp.text?.substring(0, 20)}..."` });
    } catch (e: any) {
        const msg = e instanceof Error ? e.message : String(e);
        let advice = ["Check API Key permissions in Google AI Studio."];
        
        if (msg.includes("503") || msg.includes("overloaded") || msg.includes("UNAVAILABLE")) {
            advice = [
                "SERVER OVERLOAD: The Gemini 3 Flash Preview model is currently at capacity.",
                "1. This is a transient Google server issue, not a problem with your code.",
                "2. Wait 30-60 seconds and try the handshake again.",
                "3. Consider using 'gemini-3-pro-preview' as a fallback if this persists."
            ];
        } else if (msg.includes("API keys are not supported")) {
            advice = ["GCP Error: Ensure 'Generative Language API' is enabled and your project allows API Keys."];
        } else if (msg.includes("429")) {
            advice = ["Rate limit exceeded. Check your quota in AI Studio settings."];
        }
        
        updateStep('standard', { status: 'failed', error: msg, advice });
    }

    // Step 3: Cloud TTS Handshake
    updateStep('cloud_tts', { status: 'running' });
    const activeGcpKey = userProfile?.cloudTtsApiKey || GCP_API_KEY || process.env.API_KEY;
    try {
        const res = await fetch(`https://texttospeech.googleapis.com/v1/voices?key=${activeGcpKey}`);
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error?.message || "GCP Handshake failed");
        }
        const data = await res.json();
        updateStep('cloud_tts', { 
            status: 'success', 
            details: `Verified. Using key ${activeGcpKey.substring(0, 8)}... Received ${data.voices?.length || 0} enterprise voices.` 
        });
    } catch (e: any) {
        const msg = e instanceof Error ? e.message : String(e);
        updateStep('cloud_tts', { 
            status: 'failed', 
            error: msg,
            advice: [
                "1. Enable the 'Cloud Text-to-Speech API' in Google Cloud Console.",
                "2. Check API Key Restrictions: Your key must allow 'Cloud Text-to-Speech API'.",
                "3. Verify your project has an active Billing Account linked.",
                "4. Important: Use a GCP API Key, not an AI Studio key."
            ]
        });
    }

    // Step 4: Veo API
    updateStep('veo', { status: 'running' });
    // Use the paid key source for Veo to avoid 429
    const activeVeoKey = userProfile?.cloudTtsApiKey || GCP_API_KEY || process.env.API_KEY;
    try {
        const veoAi = new GoogleGenAI({ apiKey: activeVeoKey });
        const operation = await veoAi.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: 'Neural Diagnostic Probe',
            config: { numberOfVideos: 1 }
        });
        
        const keyType = activeVeoKey === GCP_API_KEY ? "Dedicated GCP Key" : activeVeoKey === userProfile?.cloudTtsApiKey ? "User Custom Key" : "Default Env Key";
        
        if (operation && !operation.done) {
            updateStep('veo', { status: 'success', details: `Handshake successful using ${keyType}. Operation initiated.` });
        } else if (operation.error) {
            throw new Error((operation.error as any).message || "Operation failed immediately.");
        } else {
            updateStep('veo', { status: 'success', details: `Ready. Used ${keyType}.` });
        }
    } catch (e: any) {
        const msg = e instanceof Error ? e.message : String(e);
        let advice = ["Veo requires a PAID Google Cloud Project with billing enabled."];
        
        if (msg.includes("429")) {
            advice = [
                "QUOTA EXHAUSTED: Even with a paid key, Veo has strict minute-by-minute rate limits.",
                "1. Check if you have recently generated videos in AI Studio.",
                "2. Ensure your Billing Account is in good standing.",
                "3. Verify that your GCP Key has permissions for 'Vertex AI API'."
            ];
        } else if (msg.includes("not found") || msg.includes("404") || msg.includes("Requested entity was not found")) {
            advice = [
                "MODEL ACCESS DENIED: Veo is restricted to projects with an active Billing Account.",
                "1. Go to console.cloud.google.com and ensure Billing is ENABLED.",
                "2. Go to 'APIs & Services' and ensure 'Vertex AI API' is ENABLED.",
                "3. Note: Standard AI Studio Free Tier keys do NOT support Veo."
            ];
        }
        
        updateStep('veo', { status: 'failed', error: msg, advice });
    }
  };

  const handleCopyResult = () => {
      const log = diagnosticSteps.map(s => `${s.status.toUpperCase()}: ${s.label}\n  Details: ${s.details || 'None'}\n  Error: ${s.error || 'None'}`).join('\n\n');
      navigator.clipboard.writeText(log);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
  };

  const handleSeed = async () => {
    if(!confirm("Upload all built-in podcasts to Firestore?")) return;
    setIsLoading(true);
    try {
        await seedDatabase();
        alert("Seeding complete. Refreshing channels...");
        await fetchCollection('channels');
    } catch(e: any) {
        alert("Seeding failed: " + e.message);
        setIsLoading(false);
    }
  };

  const handleResetAllDates = async () => {
      if(!confirm("Reset ALL channel creation dates to right now? This affects sorting in the discovery feed.")) return;
      setIsLoading(true);
      try {
          const count = await updateAllChannelDatesToToday();
          alert(`Success! Updated ${count} cloud channels to today's date.`);
          await fetchCollection('channels');
      } catch(e: any) {
          alert("Update failed: " + e.message);
      } finally {
          setIsLoading(false);
      }
  };

  const handleCleanupDuplicates = async () => {
      if (!confirm("Are you sure? This fixes 'Accept Invitation' errors caused by duplicate UIDs.")) return;
      setIsLoading(true);
      try {
          const count = await cleanupDuplicateUsers();
          alert(`Cleanup complete. Purged ${count} duplicate user records.`);
          if (activeCollection === 'users') await fetchCollection('users');
      } catch (e: any) {
          alert("Cleanup failed: " + e.message);
      } finally {
          setIsLoading(false);
      }
  };

  const handleRecalculateStats = async () => {
      setIsLoading(true);
      try {
          const count = await recalculateGlobalStats();
          alert(`Stats Recalculated! Found ${count} existing users.`);
          await fetchCollection('stats');
      } catch(e: any) {
          alert("Failed: " + e.message);
      } finally {
          setIsLoading(false);
      }
  };

  const handleSetTier = async (uid: string, tier: 'free' | 'pro') => {
      if(!confirm(`Force change user ${uid} to ${tier}?`)) return;
      setIsLoading(true);
      try {
          await setUserSubscriptionTier(uid, tier);
          setDocs(prev => prev.map(d => d.id === uid ? { ...d, subscriptionTier: tier } : d));
          alert(`Success: User is now ${tier}.`);
      } catch(e: any) {
          alert("Error updating tier: " + e.message);
      } finally {
          setIsLoading(false);
      }
  };

  const handleDeleteDocument = async (id: string, collectionName: string) => {
      if (!isSuperAdmin) return;
      if (!confirm(`DANGER: Permanently delete document "${id}" from "${collectionName}"?\n\nThis action cannot be undone.`)) return;
      
      setIsLoading(true);
      try {
          await deleteFirestoreDoc(collectionName, id);
          setDocs(prev => prev.filter(d => d.id !== id));
      } catch (e: any) {
          alert("Deletion failed: " + e.message);
      } finally {
          setIsLoading(false);
      }
  };

  const handlePurgeCollection = async () => {
      if (!activeCollection || !isSuperAdmin) return;
      
      const confirm1 = confirm(`CRITICAL ACTION: You are about to wipe all records in the "${activeCollection}" collection.\n\nThis will delete the FIRST 500 documents found. If there are more, you must run this again.\n\nAre you absolutely sure?`);
      if (!confirm1) return;
      
      const confirm2 = confirm(`FINAL WARNING: This action is permanent and cannot be undone. Wipe ${activeCollection} records now?`);
      if (!confirm2) return;

      setIsLoading(true);
      try {
          const count = await purgeFirestoreCollection(activeCollection);
          alert(`Purge Complete: Deleted ${count} documents from ${activeCollection}.`);
          await fetchCollection(activeCollection);
      } catch (e: any) {
          alert("Purge failed: " + e.message);
      } finally {
          setIsLoading(false);
      }
  };

  const renderValue = (val: any) => {
    if (typeof val === 'number' && val > 1000000000000 && val < 10000000000000) {
        return new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Los_Angeles',
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: true
        }).format(new Date(val)) + ' (PST)';
    }

    if (typeof val === 'object' && val !== null) {
        if (val.seconds !== undefined && val.nanoseconds !== undefined) {
            return new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/Los_Angeles',
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: true
            }).format(new Date(val.seconds * 1000)) + ' (PST)';
        }
        return JSON.stringify(val).substring(0, 50) + (JSON.stringify(val).length > 50 ? '...' : '');
    }
    return String(val);
  };

  const allKeys = Array.from(new Set(docs.flatMap(d => Object.keys(d)))) as string[];

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      <div className="p-4 border-b border-slate-800 bg-slate-900 flex items-center justify-between shrink-0">
         <div className="flex items-center space-x-4">
           <button onClick={onBack} className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors">
              <ArrowLeft size={20} />
           </button>
           <div>
              <h1 className="text-xl font-bold flex items-center space-x-2">
                <Database className="text-amber-500" />
                <span>Firestore Inspector</span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">Global Admin Registry</p>
           </div>
         </div>
         
         <div className="flex gap-2">
             <button 
                onClick={handleRunFullDiagnostics}
                disabled={isTestingGemini}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-900/40 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 rounded-lg text-xs font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 group"
             >
                {isTestingGemini ? <Loader2 size={14} className="animate-spin"/> : <Zap size={14} className="group-hover:fill-current"/>} 
                Deep Neural Handshake
             </button>
             {isSuperAdmin && (
                 <button 
                    onClick={handleCleanupDuplicates}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-900/50 rounded-lg text-xs font-bold transition-colors shadow-lg"
                 >
                    <ShieldAlert size={14} /> Cleanup Duplicates
                 </button>
             )}
             <button 
                onClick={handleRecalculateStats}
                disabled={isLoading}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-colors shadow-lg"
                title="Sync stats"
             >
                <Users size={14} /> Sync Stats
             </button>
         </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col bg-slate-950">
          <div className="flex flex-1 overflow-hidden">
              <div className="w-64 bg-slate-900 border-r border-slate-800 overflow-y-auto p-4 shrink-0 scrollbar-thin scrollbar-thumb-slate-800">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 px-2">Collections</h3>
                  <div className="space-y-1">
                      {COLLECTIONS.map(col => (
                          <button
                              key={col}
                              onClick={() => fetchCollection(col)}
                              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${activeCollection === col ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                          >
                              {col.replace('_', ' ')}
                          </button>
                      ))}
                  </div>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col bg-slate-950">
                  {activeCollection ? (
                      <>
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                            <div className="flex items-center space-x-3">
                                <h2 className="font-bold text-lg text-white capitalize">{activeCollection.replace('_', ' ')}</h2>
                                <span className="text-[10px] font-black text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800 uppercase tracking-widest">
                                    {isLoading ? 'Syncing...' : `${docs.length} Entries`}
                                </span>
                                {activeCollection === 'channels' && isSuperAdmin && (
                                    <>
                                        <button onClick={handleSeed} disabled={isLoading} className="flex items-center space-x-2 px-3 py-1 bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-900 text-emerald-400 rounded text-xs font-bold ml-2">
                                            <UploadCloud size={14} />
                                            <span>Seed DB</span>
                                        </button>
                                        <button onClick={handleResetAllDates} disabled={isLoading} className="flex items-center space-x-2 px-3 py-1 bg-indigo-900/30 hover:bg-indigo-900/50 border border-indigo-900 text-indigo-400 rounded text-xs font-bold ml-2">
                                            <Calendar size={14} />
                                            <span>Reset All Dates</span>
                                        </button>
                                    </>
                                )}
                                {isSuperAdmin && (
                                    <button 
                                        onClick={handlePurgeCollection} 
                                        disabled={isLoading} 
                                        className="flex items-center space-x-2 px-3 py-1 bg-red-900/30 hover:bg-red-600 border border-red-600 text-red-100 rounded text-xs font-bold ml-2 transition-all group"
                                        title={`Purge all records from ${activeCollection}`}
                                    >
                                        <Trash2 size={14} className="group-hover:animate-bounce" />
                                        <span>Purge All</span>
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center space-x-2">
                                <div className="bg-slate-900 p-1 rounded-lg border border-slate-800 flex">
                                    <button onClick={() => setViewMode('json')} className={`p-1.5 rounded ${viewMode === 'json' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}><Code size={16}/></button>
                                    <button onClick={() => setViewMode('table')} className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}><Table size={16}/></button>
                                </div>
                                <button onClick={() => fetchCollection(activeCollection!)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white transition-colors">
                                    <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto p-6 scrollbar-thin scrollbar-thumb-slate-800">
                            {isLoading ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
                                    <Loader2 className="animate-spin text-indigo-500" size={32} />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Paging Neural Registry...</span>
                                </div>
                            ) : error ? (
                                <div className="text-red-400 p-4 border border-red-900/50 bg-red-900/20 rounded-xl flex items-center gap-3">
                                    <ShieldAlert size={20}/>
                                    <span>{error}</span>
                                </div>
                            ) : docs.length === 0 ? (
                                <div className="text-slate-700 italic text-center mt-20 flex flex-col items-center gap-4">
                                    <Search size={48} className="opacity-10"/>
                                    <p className="text-sm font-bold uppercase tracking-widest">Collection is empty or unreachable.</p>
                                </div>
                            ) : viewMode === 'json' ? (
                                <pre className="text-xs font-mono text-indigo-200 bg-slate-900 p-6 rounded-2xl overflow-auto border border-slate-800 max-w-full shadow-inner leading-relaxed">
                                    {JSON.stringify(docs, null, 2)}
                                </pre>
                            ) : (
                                <div className="overflow-x-auto border border-slate-800 rounded-2xl shadow-2xl bg-slate-900/20">
                                    <table className="w-full text-left text-[11px] text-slate-400 border-collapse">
                                        <thead className="bg-slate-950 text-slate-200 uppercase font-black tracking-widest sticky top-0 z-10 border-b border-slate-800">
                                            <tr>
                                                {allKeys.map(k => (
                                                    <th key={k} className="px-5 py-4 whitespace-nowrap">{k}</th>
                                                ))}
                                                {isSuperAdmin && <th className="px-5 py-4 whitespace-nowrap text-right bg-slate-950">Actions</th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/50">
                                            {docs.map((doc, i) => (
                                                <tr key={doc.id || i} className="hover:bg-indigo-600/5 transition-colors">
                                                    {allKeys.map(k => (
                                                        <td key={k} className="px-5 py-3 whitespace-nowrap overflow-hidden text-ellipsis max-w-[250px] font-mono" title={String(doc[k])}>
                                                            {doc[k] !== undefined ? renderValue(doc[k]) : <span className="text-slate-800">-</span>}
                                                        </td>
                                                    ))}
                                                    {isSuperAdmin && (
                                                        <td className="px-5 py-3 text-right whitespace-nowrap sticky right-0 bg-slate-900/80 backdrop-blur-sm group-hover:bg-transparent transition-colors">
                                                            <div className="flex gap-2 justify-end">
                                                                {activeCollection === 'users' && (
                                                                    <>
                                                                        <button onClick={() => handleSetTier(doc.id, 'pro')} className={`p-1.5 rounded-lg flex items-center gap-1 text-[9px] font-black uppercase tracking-tighter border transition-all ${doc.subscriptionTier === 'pro' ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-900/40' : 'bg-slate-800 border-slate-700 hover:border-emerald-500'}`} title="Set Pro"><Crown size={12}/> Pro</button>
                                                                        <button onClick={() => handleSetTier(doc.id, 'free')} className={`p-1.5 rounded-lg flex items-center gap-1 text-[9px] font-black uppercase tracking-tighter border transition-all ${doc.subscriptionTier === 'free' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-800 border-slate-700 hover:border-emerald-500'}`} title="Set Free">Free</button>
                                                                    </>
                                                                )}
                                                                <button 
                                                                    onClick={() => handleDeleteDocument(doc.id, activeCollection!)} 
                                                                    className="p-2 rounded-lg bg-red-600/10 text-red-500 border border-red-500/20 hover:bg-red-600 hover:text-white transition-all shadow-lg active:scale-95" 
                                                                    title={`Purge from ${activeCollection}`}
                                                                >
                                                                    <Trash2 size={14}/>
                                                                </button>
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
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-700">
                          <div className="p-10 bg-slate-900/50 rounded-[3rem] border border-dashed border-slate-800 flex flex-col items-center gap-6 animate-fade-in">
                              <Database size={64} className="opacity-10" />
                              <div className="text-center space-y-2">
                                  <h3 className="text-xl font-bold uppercase tracking-[0.2em] text-slate-500">Registry Inactive</h3>
                                  <p className="text-xs text-slate-600">Select a collection from the spectral sidebar to begin audit.</p>
                              </div>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      </div>

      {isTestingGemini && (
        <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
            <div className="bg-slate-900 border border-slate-700 rounded-[2.5rem] w-full max-w-3xl shadow-2xl overflow-hidden animate-fade-in-up">
                <div className="p-6 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <Activity className="text-indigo-400" />
                        <h3 className="text-lg font-black text-white italic uppercase tracking-widest">Neural Diagnostic Matrix</h3>
                    </div>
                    <button onClick={() => setIsTestingGemini(false)} className="p-2 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white transition-colors"><X size={20}/></button>
                </div>
                
                <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto scrollbar-hide">
                    {diagnosticSteps.map((step) => (
                        <div key={step.id} className={`p-5 rounded-2xl border transition-all ${
                            step.status === 'success' ? 'bg-emerald-950/20 border-emerald-500/30' : 
                            step.status === 'failed' ? 'bg-red-950/20 border-red-500/30' : 
                            step.status === 'running' ? 'bg-indigo-950/20 border-indigo-500/30 animate-pulse' :
                            'bg-slate-900/50 border-slate-800'
                        }`}>
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${
                                        step.status === 'success' ? 'bg-emerald-500' :
                                        step.status === 'failed' ? 'bg-red-500' :
                                        'bg-slate-800'
                                    }`}>
                                        {step.id === 'veo' ? <Film size={16} className="text-white"/> : 
                                         step.id === 'auth' ? <ShieldCheck size={16} className="text-white"/> :
                                         step.id === 'cloud_tts' ? <Speech size={16} className="text-white"/> :
                                         <Zap size={16} className="text-white"/>}
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-white">{step.label}</h4>
                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest">Diagnostic ID: {step.id}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                                        step.status === 'success' ? 'text-emerald-400' :
                                        step.status === 'failed' ? 'text-red-400' :
                                        'text-slate-50'
                                    }`}>{step.status}</span>
                                </div>
                            </div>
                            
                            {step.details && <p className="text-xs text-slate-300 mt-3 leading-relaxed bg-black/30 p-3 rounded-xl border border-white/10">{step.details}</p>}
                            
                            {step.error && (
                                <div className="mt-3 p-3 bg-red-900/40 rounded-xl border border-red-500/20">
                                    <p className="text-[10px] font-black text-red-400 uppercase mb-1 flex items-center gap-1"><ShieldAlert size={10}/> Error Trace:</p>
                                    <p className="text-[11px] font-mono text-red-200 break-all">{step.error}</p>
                                </div>
                            )}

                            {step.advice && (
                                <div className="mt-4 space-y-2">
                                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest px-1">Troubleshooting Actions:</p>
                                    <div className="grid grid-cols-1 gap-2">
                                        {step.advice.map((adv, i) => (
                                            <div key={i} className="flex items-start gap-3 bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></div>
                                                <p className="text-[11px] text-slate-300 leading-relaxed">{adv}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    
                    <div className="flex gap-3 pt-4">
                        <button 
                            onClick={handleCopyResult}
                            className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-slate-700"
                        >
                            {copyFeedback ? <Check size={16} className="text-emerald-400"/> : <Copy size={16}/>}
                            {copyFeedback ? 'Copied' : 'Copy Log'}
                        </button>
                        <button 
                            onClick={() => setIsTestingGemini(false)}
                            className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl transition-all"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
                
                <div className="p-4 bg-slate-950 border-t border-slate-800 text-center">
                    <p className="text-[8px] text-slate-600 font-black uppercase tracking-[0.2em]">Neural Handshake Protocol v5.6.0</p>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default FirestoreInspector;
