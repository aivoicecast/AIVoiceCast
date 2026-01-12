
import React, { useState, useMemo } from 'react';
import { getDebugCollectionDocs, seedDatabase, recalculateGlobalStats, claimSystemChannels, setUserSubscriptionTier, deleteUser, cleanupDuplicateUsers, isUserAdmin, deleteFirestoreDoc, purgeFirestoreCollection } from '../services/firestoreService';
import { ArrowLeft, RefreshCw, Database, Table, Code, Search, UploadCloud, Users, ShieldCheck, Crown, XCircle, Trash2, ShieldAlert, Loader2, AlertTriangle } from 'lucide-react';
import { auth } from '../services/firebaseConfig';
import { UserProfile } from '../types';

interface FirestoreInspectorProps {
  onBack: () => void;
  userProfile?: UserProfile | null;
}

const COLLECTIONS = [
  'users',
  'channels',
  'groups',
  'invitations',
  'bookings',
  'discussions',
  'recordings',
  'activity_logs',
  'stats',
  'mock_interviews',
  'coin_transactions',
  'checks',
  'shipping',
  'cards',
  'icons',
  'tasks',
  'notebooks'
];

export const FirestoreInspector: React.FC<FirestoreInspectorProps> = ({ onBack, userProfile }) => {
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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
    // Detect potential milliseconds timestamp (13 digits, starting with 17... for the 2020-2030 range)
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
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors shadow-lg"
                title="Fix user count if incorrect"
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
                                    <button onClick={handleSeed} disabled={isLoading} className="flex items-center space-x-2 px-3 py-1 bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-900 text-emerald-400 rounded text-xs font-bold ml-2">
                                        <UploadCloud size={14} />
                                        <span>Seed DB</span>
                                    </button>
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
    </div>
  );
};
