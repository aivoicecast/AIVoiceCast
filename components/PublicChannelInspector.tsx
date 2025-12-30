
import React, { useState, useEffect } from 'react';
import { getPublicChannels, deleteChannelFromFirestore, seedDatabase } from '../services/firestoreService';
import { Channel } from '../types';
import { ArrowLeft, RefreshCw, Trash2, Globe, Calendar, User, UploadCloud } from 'lucide-react';
import { auth } from '../services/firebaseConfig';

interface PublicChannelInspectorProps {
  onBack: () => void;
}

export const PublicChannelInspector: React.FC<PublicChannelInspectorProps> = ({ onBack }) => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const currentUser = auth.currentUser;

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await getPublicChannels();
      setChannels(data);
    } catch (e: any) {
      console.error(e);
      // Improved error message: Displays exact error (e.g. Missing Index link)
      alert(`Failed to load public channels: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete public channel "${title}"? This cannot be undone.`)) return;
    try {
      await deleteChannelFromFirestore(id);
      await loadData();
    } catch (e) {
      alert("Failed to delete channel.");
    }
  };

  const handleSeed = async () => {
    if (!confirm("Upload all system channels (including new AIVoiceCast) to the Public Registry? This will update existing channels.")) return;
    setIsLoading(true);
    try {
        await seedDatabase();
        await loadData();
        alert("System channels published successfully!");
    } catch(e: any) {
        alert("Failed to publish: " + e.message);
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
                  <Globe className="text-emerald-400" />
                  <span>Public Channel Inspector</span>
                </h1>
                <p className="text-xs text-slate-500 mt-1">Live View of Firestore 'channels' collection</p>
             </div>
           </div>
           
           <div className="flex gap-2">
               {currentUser?.email === 'shengliang.song@gmail.com' && (
                   <button onClick={handleSeed} disabled={isLoading} className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-lg font-bold text-xs transition-colors">
                     <UploadCloud size={16} />
                     <span>Publish System Channels</span>
                   </button>
               )}
               
               <button onClick={loadData} className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-500 text-white font-bold text-xs transition-colors">
                 <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                 <span>Refresh</span>
               </button>
           </div>
        </div>

        {/* Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
           <div className="overflow-x-auto">
             <table className="w-full text-left text-sm text-slate-400">
               <thead className="bg-slate-950 text-slate-200 uppercase text-xs font-bold">
                 <tr>
                   <th className="px-6 py-4">Title</th>
                   <th className="px-6 py-4">Author / Owner</th>
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
                            <span className="font-bold text-white">{ch.title}</span>
                         </div>
                      </td>
                      <td className="px-6 py-4">
                         <div className="flex flex-col">
                            <span className="text-slate-300">{ch.author}</span>
                            <span className="text-xs text-slate-600 font-mono">{ch.ownerId || 'N/A'}</span>
                         </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs">
                         {ch.createdAt ? new Date(ch.createdAt).toLocaleString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs truncate max-w-[100px]" title={ch.id}>
                         {ch.id}
                      </td>
                      <td className="px-6 py-4 text-right">
                         {/* STRICT: Allow deletion ONLY if current user is logged in AND (is owner OR channel is orphaned OR is Super Admin) */}
                         {currentUser && (currentUser.uid === ch.ownerId || !ch.ownerId || currentUser.email === 'shengliang.song@gmail.com') && (
                            <button 
                                onClick={() => handleDelete(ch.id, ch.title)}
                                className="text-slate-500 hover:text-red-400 transition-colors p-2 hover:bg-slate-800 rounded-full"
                                title="Delete Channel"
                            >
                                <Trash2 size={16} />
                            </button>
                         )}
                      </td>
                   </tr>
                 ))}
                 {channels.length === 0 && (
                   <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-600 italic">
                         No public channels found.
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
