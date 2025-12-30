
import React, { useState, useEffect } from 'react';
import { getUserChannels, deleteUserChannel, saveUserChannel } from '../utils/db';
import { getCreatorChannels } from '../services/firestoreService';
import { auth } from '../services/firebaseConfig';
import { Channel } from '../types';
import { ArrowLeft, RefreshCw, Trash2, HardDrive, Edit, Calendar, DownloadCloud, CloudDownload, AlertCircle } from 'lucide-react';
import { HANDCRAFTED_CHANNELS } from '../utils/initialData';

interface MyChannelInspectorProps {
  onBack: () => void;
}

export const MyChannelInspector: React.FC<MyChannelInspectorProps> = ({ onBack }) => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const currentUser = auth.currentUser;

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      // Race condition safety: Timeout after 5 seconds if DB is locked
      const timeout = new Promise<Channel[]>((_, reject) => 
          setTimeout(() => reject(new Error("Database load timed out. Please reload the page.")), 5000)
      );
      
      const dbPromise = getUserChannels();
      const data = await Promise.race([dbPromise, timeout]);
      
      // Sort by created time descending
      data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setChannels(data);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message);
      alert(`Failed to load local channels: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete local channel "${title}"? This cannot be undone.`)) return;
    try {
      await deleteUserChannel(id);
      await loadData();
    } catch (e) {
      alert("Failed to delete channel.");
    }
  };

  const handleEditDate = async (channel: Channel) => {
      const current = channel.createdAt ? new Date(channel.createdAt) : new Date();
      const pad = (n: number) => n < 10 ? '0' + n : n;
      const defaultVal = `${current.getFullYear()}-${pad(current.getMonth() + 1)}-${pad(current.getDate())}T${pad(current.getHours())}:${pad(current.getMinutes())}`;
      
      const newVal = prompt("Enter Creation Date (YYYY-MM-DDTHH:mm):", defaultVal);
      if (newVal) {
          const timestamp = new Date(newVal).getTime();
          if (isNaN(timestamp)) {
              alert("Invalid date format.");
              return;
          }
          
          const updatedChannel = { ...channel, createdAt: timestamp };
          try {
              await saveUserChannel(updatedChannel);
              await loadData();
          } catch(e) {
              alert("Failed to update date.");
          }
      }
  };

  const handleSeedLocal = async () => {
      if (!confirm("Import built-in channels to your Local Storage? This is useful for testing offline availability.")) return;
      setIsLoading(true);
      setErrorMsg(null);
      try {
          for (const ch of HANDCRAFTED_CHANNELS) {
              await saveUserChannel(ch);
          }
          await loadData();
          alert(`Imported ${HANDCRAFTED_CHANNELS.length} channels to local storage.`);
      } catch(e: any) {
          alert("Import failed: " + e.message);
      } finally {
          setIsLoading(false);
      }
  };

  const handleSyncFromCloud = async () => {
      if (!currentUser) {
          alert("Please sign in to sync from cloud.");
          return;
      }
      setIsLoading(true);
      setErrorMsg(null);
      try {
          // Fetch from Firestore
          const cloudChannels = await getCreatorChannels(currentUser.uid);
          
          if (cloudChannels.length === 0) {
              alert("No channels found in your Cloud account.");
          } else {
              // Save each to local IndexedDB
              let count = 0;
              for (const ch of cloudChannels) {
                  await saveUserChannel(ch);
                  count++;
              }
              await loadData();
              alert(`Successfully synced ${count} channels from Cloud to Local Storage.`);
          }
      } catch(e: any) {
          console.error(e);
          setErrorMsg(e.message);
          alert("Sync failed: " + e.message);
      } finally {
          setIsLoading(false);
      }
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-950 text-slate-100 p-8 scrollbar-thin scrollbar-thumb-slate-800">
      <div className="max-w-6xl mx-auto space-y-8 pb-24">
        
        {/* Header */}
        <div className="flex items-center justify-between">
           <div className="flex items-center space-x-4">
             <button onClick={onBack} className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700">
                <ArrowLeft size={20} />
             </button>
             <div>
                <h1 className="text-2xl font-bold flex items-center space-x-2">
                  <HardDrive className="text-purple-400" />
                  <span>My Channel Inspector</span>
                </h1>
                <p className="text-xs text-slate-500 mt-1">Live View of IndexedDB 'user_channels' (Local Storage)</p>
             </div>
           </div>
           
           <div className="flex gap-2">
               {currentUser && (
                   <button onClick={handleSyncFromCloud} disabled={isLoading} className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors font-bold text-xs shadow-lg">
                       <CloudDownload size={16} />
                       <span>Sync from Cloud</span>
                   </button>
               )}
               
               <button onClick={handleSeedLocal} disabled={isLoading} className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors font-bold text-xs border border-slate-700">
                   <DownloadCloud size={16} />
                   <span>Import Defaults</span>
               </button>
               
               <button onClick={loadData} className="flex items-center space-x-2 px-4 py-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors font-bold text-xs border border-slate-700">
                 <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                 <span>Refresh</span>
               </button>
           </div>
        </div>
        
        {errorMsg && (
            <div className="bg-red-900/20 border border-red-900/50 p-4 rounded-xl flex items-center gap-3 text-red-200">
                <AlertCircle size={24} />
                <div>
                    <p className="font-bold text-sm">Error Loading Database</p>
                    <p className="text-xs">{errorMsg}</p>
                </div>
            </div>
        )}

        {/* Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
           <div className="overflow-x-auto">
             <table className="w-full text-left text-sm text-slate-400">
               <thead className="bg-slate-950 text-slate-200 uppercase text-xs font-bold">
                 <tr>
                   <th className="px-6 py-4">Title</th>
                   <th className="px-6 py-4">Visibility</th>
                   <th className="px-6 py-4">Created At</th>
                   <th className="px-6 py-4">ID</th>
                   <th className="px-6 py-4 text-right">Actions</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-800">
                 {channels.map((ch) => (
                   <tr key={ch.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4">
                         <div className="flex items-center space-x-3">
                            <img src={ch.imageUrl} alt="" className="w-8 h-8 rounded object-cover bg-slate-800"/>
                            <div className="flex flex-col">
                                <span className="font-bold text-white">{ch.title}</span>
                                <span className="text-xs text-slate-500">{ch.author}</span>
                            </div>
                         </div>
                      </td>
                      <td className="px-6 py-4">
                         <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded border ${
                             ch.visibility === 'public' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-900' :
                             ch.visibility === 'group' ? 'bg-purple-900/30 text-purple-400 border-purple-900' :
                             'bg-slate-800 text-slate-400 border-slate-700'
                         }`}>
                             {ch.visibility || 'private'}
                         </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs">
                         <div className="flex items-center gap-2">
                             <span className={!ch.createdAt ? "text-red-400 font-bold" : ""}>
                                 {ch.createdAt ? new Date(ch.createdAt).toLocaleString() : 'N/A'}
                             </span>
                             <button 
                                onClick={() => handleEditDate(ch)}
                                className="p-1 text-indigo-400 hover:text-white hover:bg-slate-700 rounded"
                                title="Edit Date"
                             >
                                 <Edit size={12} />
                             </button>
                         </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs truncate max-w-[100px]" title={ch.id}>
                         {ch.id}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                            onClick={() => handleDelete(ch.id, ch.title)}
                            className="text-slate-500 hover:text-red-400 transition-colors p-2 hover:bg-slate-800 rounded-full"
                            title="Delete Local Channel"
                        >
                            <Trash2 size={16} />
                        </button>
                      </td>
                   </tr>
                 ))}
                 {!isLoading && channels.length === 0 && (
                   <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-600 italic">
                         No local user channels found in 'user_channels' store.<br/>
                         {currentUser ? 
                           <span className="text-indigo-400 cursor-pointer hover:underline" onClick={handleSyncFromCloud}>Click "Sync from Cloud" to retrieve your online channels.</span> 
                           : "Sign in to sync your cloud channels."
                         }
                      </td>
                   </tr>
                 )}
               </tbody>
             </table>
           </div>
        </div>
      </div>
    </div>
  );
};
