
import React, { useState } from 'react';
import { getDebugCollectionDocs, seedDatabase, recalculateGlobalStats, claimSystemChannels, setUserSubscriptionTier } from '../services/firestoreService';
import { ArrowLeft, RefreshCw, Database, Table, Code, Search, UploadCloud, Users, ShieldCheck, Crown, XCircle } from 'lucide-react';

interface FirestoreInspectorProps {
  onBack: () => void;
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
  'stats'
];

export const FirestoreInspector: React.FC<FirestoreInspectorProps> = ({ onBack }) => {
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'json'>('table');
  const [error, setError] = useState<string | null>(null);

  const fetchCollection = async (name: string) => {
    setActiveCollection(name);
    setIsLoading(true);
    setDocs([]);
    setError(null);
    try {
      const data = await getDebugCollectionDocs(name, 20); // Limit 20 for perf
      setDocs(data);
    } catch (e: any) {
      setError(e.message || "Failed to fetch");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeed = async () => {
    if(!confirm("Upload all built-in podcasts to Firestore? This effectively makes them database-driven public channels.")) return;
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

  const handleClaimOwnership = async () => {
      const email = prompt("Enter email address to assign ownership to:", "shengliang.song@gmail.com");
      if (!email) return;
      
      setIsLoading(true);
      try {
          const count = await claimSystemChannels(email);
          alert(`Successfully assigned ${count} channels to ${email}.`);
          await fetchCollection('channels');
      } catch (e: any) {
          alert("Error: " + e.message);
      } finally {
          setIsLoading(false);
      }
  };

  const handleRecalculateStats = async () => {
      setIsLoading(true);
      try {
          const count = await recalculateGlobalStats();
          alert(`Stats Recalculated! Found ${count} existing users. The global counter has been updated.`);
          await fetchCollection('stats');
      } catch(e: any) {
          alert("Failed: " + e.message);
      } finally {
          setIsLoading(false);
      }
  };

  const handleSetTier = async (uid: string, tier: 'free' | 'pro') => {
      if(!confirm(`Force change user ${uid} to ${tier}? This will override their current subscription status.`)) return;
      setIsLoading(true);
      try {
          await setUserSubscriptionTier(uid, tier);
          // Update local state to reflect change immediately
          setDocs(prev => prev.map(d => d.id === uid ? { ...d, subscriptionTier: tier } : d));
          alert(`Success: User is now ${tier}.`);
      } catch(e: any) {
          alert("Error updating tier: " + e.message);
      } finally {
          setIsLoading(false);
      }
  };

  const renderValue = (val: any) => {
    if (typeof val === 'object' && val !== null) {
        // Handle Firestore timestamps
        if (val.seconds !== undefined && val.nanoseconds !== undefined) {
            return new Date(val.seconds * 1000).toLocaleString();
        }
        return JSON.stringify(val).substring(0, 50) + (JSON.stringify(val).length > 50 ? '...' : '');
    }
    return String(val);
  };

  // Extract all unique keys for table headers
  const allKeys = Array.from(new Set(docs.flatMap(d => Object.keys(d)))) as string[];

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      
      {/* Header */}
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
              <p className="text-xs text-slate-500 mt-0.5">Live view of backend collections</p>
           </div>
         </div>
         
         <div className="flex gap-2">
             <button 
                onClick={handleRecalculateStats}
                disabled={isLoading}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors shadow-lg"
                title="Fix user count if incorrect"
             >
                <Users size={14} /> Recalculate Stats
             </button>
         </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
          
          {/* Sidebar */}
          <div className="w-64 bg-slate-900 border-r border-slate-800 overflow-y-auto p-4 shrink-0">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Collections</h3>
              <div className="space-y-1">
                  {COLLECTIONS.map(col => (
                      <button
                          key={col}
                          onClick={() => fetchCollection(col)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeCollection === col ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                      >
                          {col}
                      </button>
                  ))}
              </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-hidden flex flex-col bg-slate-950">
              {activeCollection ? (
                  <>
                    <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                        <div className="flex items-center space-x-3">
                            <h2 className="font-bold text-lg text-white">{activeCollection}</h2>
                            <span className="text-xs text-slate-500 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                                {isLoading ? '...' : `${docs.length} docs (limit 20)`}
                            </span>
                            {activeCollection === 'channels' && (
                                <>
                                    <button 
                                        onClick={handleSeed} 
                                        disabled={isLoading}
                                        className="flex items-center space-x-2 px-3 py-1 bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-900 text-emerald-400 hover:text-emerald-200 rounded text-xs font-bold ml-2 transition-colors"
                                        title="Upload built-in channels to Firestore"
                                    >
                                        <UploadCloud size={14} />
                                        <span>Seed DB</span>
                                    </button>
                                    <button 
                                        onClick={handleClaimOwnership} 
                                        disabled={isLoading}
                                        className="flex items-center space-x-2 px-3 py-1 bg-amber-900/30 hover:bg-amber-900/50 border border-amber-900 text-amber-400 hover:text-amber-200 rounded text-xs font-bold ml-2 transition-colors"
                                        title="Assign all system channels to Admin"
                                    >
                                        <ShieldCheck size={14} />
                                        <span>Claim All</span>
                                    </button>
                                </>
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

                    <div className="flex-1 overflow-auto p-6">
                        {isLoading ? (
                            <div className="h-full flex items-center justify-center text-slate-500">Loading...</div>
                        ) : error ? (
                            <div className="text-red-400 p-4 border border-red-900/50 bg-red-900/20 rounded-xl">{error}</div>
                        ) : docs.length === 0 ? (
                            <div className="text-slate-500 italic text-center mt-10">Collection is empty.</div>
                        ) : viewMode === 'json' ? (
                            <pre className="text-xs font-mono text-indigo-200 bg-slate-900 p-4 rounded-xl overflow-auto border border-slate-800 max-w-full">
                                {JSON.stringify(docs, null, 2)}
                            </pre>
                        ) : (
                            <div className="overflow-x-auto border border-slate-800 rounded-xl">
                                <table className="w-full text-left text-xs text-slate-400">
                                    <thead className="bg-slate-900 text-slate-200 uppercase font-bold sticky top-0">
                                        <tr>
                                            {allKeys.map(k => (
                                                <th key={k} className="px-4 py-3 border-b border-slate-800 whitespace-nowrap">{k}</th>
                                            ))}
                                            {activeCollection === 'users' && <th className="px-4 py-3 border-b border-slate-800 whitespace-nowrap text-right">Actions</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800 bg-slate-900/30">
                                        {docs.map((doc, i) => (
                                            <tr key={doc.id || i} className="hover:bg-slate-800/50">
                                                {allKeys.map(k => (
                                                    <td key={k} className="px-4 py-2 whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]" title={String(doc[k])}>
                                                        {doc[k] !== undefined ? renderValue(doc[k]) : <span className="text-slate-700">-</span>}
                                                    </td>
                                                ))}
                                                {activeCollection === 'users' && (
                                                    <td className="px-4 py-2 text-right whitespace-nowrap">
                                                        <div className="flex gap-2 justify-end">
                                                            <button 
                                                                onClick={() => handleSetTier(doc.id, 'pro')} 
                                                                className={`p-1.5 rounded flex items-center gap-1 text-[10px] font-bold border transition-colors ${doc.subscriptionTier === 'pro' ? 'bg-emerald-900/50 text-emerald-400 border-emerald-500/50' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'}`}
                                                                title="Set as Pro"
                                                            >
                                                                <Crown size={12} fill={doc.subscriptionTier === 'pro' ? 'currentColor' : 'none'}/>
                                                                Pro
                                                            </button>
                                                            <button 
                                                                onClick={() => handleSetTier(doc.id, 'free')} 
                                                                className={`p-1.5 rounded flex items-center gap-1 text-[10px] font-bold border transition-colors ${doc.subscriptionTier === 'free' || !doc.subscriptionTier ? 'bg-slate-700 text-white border-slate-600' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'}`}
                                                                title="Set as Free"
                                                            >
                                                                <XCircle size={12}/>
                                                                Free
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
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
                      <Search size={48} className="mb-4 opacity-20" />
                      <p>Select a collection to inspect.</p>
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};
