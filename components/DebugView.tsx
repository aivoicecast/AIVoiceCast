
import React, { useState, useEffect } from 'react';
import { getAllDebugEntries, deleteDebugEntry, clearDebugStore, DebugEntry } from '../utils/db';
import { ArrowLeft, Trash2, RefreshCw, HardDrive, FileText, Mic2 } from 'lucide-react';

interface DebugViewProps {
  onBack: () => void;
}

export const DebugView: React.FC<DebugViewProps> = ({ onBack }) => {
  const [entries, setEntries] = useState<DebugEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState('all');

  const loadData = async () => {
    setIsLoading(true);
    const data = await getAllDebugEntries();
    setEntries(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (store: string, key: string) => {
    if (!confirm(`Delete key: ${key}?`)) return;
    await deleteDebugEntry(store, key);
    await loadData();
  };

  const handleClearStore = async (store: string) => {
    if (!confirm(`Clear ALL data in ${store}? This cannot be undone.`)) return;
    await clearDebugStore(store);
    await loadData();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const filteredEntries = entries.filter(e => filter === 'all' || e.store === filter);
  
  const stats = {
     audio: entries.filter(e => e.store === 'audio_segments').reduce((acc, curr) => acc + curr.size, 0),
     text: entries.filter(e => e.store === 'lecture_scripts').reduce((acc, curr) => acc + curr.size, 0),
     channels: entries.filter(e => e.store === 'user_channels').reduce((acc, curr) => acc + curr.size, 0),
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
             <h1 className="text-2xl font-bold">IndexedDB Inspector</h1>
           </div>
           <button onClick={loadData} className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-500">
             <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
             <span>Refresh</span>
           </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex items-center justify-between">
              <div>
                 <p className="text-slate-500 text-xs font-bold uppercase">Audio Cache</p>
                 <p className="text-2xl font-mono text-emerald-400">{formatSize(stats.audio)}</p>
                 <p className="text-slate-600 text-xs">{entries.filter(e => e.store === 'audio_segments').length} files</p>
              </div>
              <Mic2 className="text-slate-700" size={32} />
           </div>
           <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex items-center justify-between">
              <div>
                 <p className="text-slate-500 text-xs font-bold uppercase">Lectures (Text)</p>
                 <p className="text-2xl font-mono text-indigo-400">{formatSize(stats.text)}</p>
                 <p className="text-slate-600 text-xs">{entries.filter(e => e.store === 'lecture_scripts').length} files</p>
              </div>
              <FileText className="text-slate-700" size={32} />
           </div>
           <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex items-center justify-between">
              <div>
                 <p className="text-slate-500 text-xs font-bold uppercase">User Channels</p>
                 <p className="text-2xl font-mono text-purple-400">{formatSize(stats.channels)}</p>
                 <p className="text-slate-600 text-xs">{entries.filter(e => e.store === 'user_channels').length} channels</p>
              </div>
              <HardDrive className="text-slate-700" size={32} />
           </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex space-x-2 border-b border-slate-800 pb-1">
            {['all', 'audio_segments', 'lecture_scripts', 'user_channels'].map(f => (
               <button 
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${filter === f ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
               >
                  {f === 'all' ? 'All Items' : f.replace('_', ' ').toUpperCase()}
               </button>
            ))}
        </div>

        {/* Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
           <div className="overflow-x-auto">
             <table className="w-full text-left text-sm text-slate-400">
               <thead className="bg-slate-950 text-slate-200 uppercase text-xs font-bold">
                 <tr>
                   <th className="px-6 py-4">Store</th>
                   <th className="px-6 py-4">Key</th>
                   <th className="px-6 py-4">Size</th>
                   <th className="px-6 py-4 text-right">Actions</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-800">
                 {filteredEntries.map((entry, idx) => (
                   <tr key={`${entry.store}-${entry.key}`} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-3 font-mono text-xs text-indigo-300">{entry.store}</td>
                      <td className="px-6 py-3 font-mono text-xs truncate max-w-xs" title={entry.key}>{entry.key}</td>
                      <td className="px-6 py-3 text-slate-300">{formatSize(entry.size)}</td>
                      <td className="px-6 py-3 text-right">
                         <button 
                            onClick={() => handleDelete(entry.store, entry.key)}
                            className="text-slate-500 hover:text-red-400 transition-colors p-1"
                         >
                            <Trash2 size={16} />
                         </button>
                      </td>
                   </tr>
                 ))}
                 {filteredEntries.length === 0 && (
                   <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-600 italic">No entries found</td>
                   </tr>
                 )}
               </tbody>
             </table>
           </div>
        </div>

        {/* Dangerous Actions */}
        <div className="flex justify-end space-x-4 pt-8 border-t border-slate-800">
           <button 
              onClick={() => handleClearStore('audio_segments')}
              className="px-4 py-2 border border-red-900/50 text-red-500 hover:bg-red-900/20 rounded-lg text-sm"
           >
              Clear Audio Cache
           </button>
           <button 
              onClick={() => handleClearStore('lecture_scripts')}
              className="px-4 py-2 border border-red-900/50 text-red-500 hover:bg-red-900/20 rounded-lg text-sm"
           >
              Clear Lecture Cache
           </button>
        </div>

      </div>
    </div>
  );
};
