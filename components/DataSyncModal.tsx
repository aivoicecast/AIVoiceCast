
import React, { useState, useEffect } from 'react';
import { X, Database, Download, Upload, Loader2, CheckCircle, AlertCircle, Cloud, CloudUpload, CloudDownload, Copy, Edit2, Save } from 'lucide-react';
import { exportFullDatabase, importFullDatabase } from '../utils/db';
import { uploadToCloud, downloadFromCloud, getLastBackupTime, getCloudBackupMetadata } from '../services/cloudService';
import { auth } from '../services/firebaseConfig';

interface DataSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DataSyncModal: React.FC<DataSyncModalProps> = ({ isOpen, onClose }) => {
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [stats, setStats] = useState<{ size: string } | null>(null);
  const [lastCloudDate, setLastCloudDate] = useState<Date | null>(null);
  const [userId, setUserId] = useState('public');

  useEffect(() => {
    if (isOpen) {
      checkStorage();
      fetchCloudStats();
      // Normalize ID logic
      const currentUser = auth.currentUser;
      setUserId(currentUser ? currentUser.uid : 'public');
    }
  }, [isOpen]);

  const checkStorage = async () => {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      if (estimate.usage) {
        setStats({ size: (estimate.usage / 1024 / 1024).toFixed(2) + ' MB' });
      }
    }
  };

  const fetchCloudStats = async () => {
    const date = await getLastBackupTime();
    setLastCloudDate(date);
  };

  // --- File Export/Import ---

  const handleExportFile = async () => {
    try {
      setStatus('processing');
      setMessage('Generating export file...');
      const jsonStr = await exportFullDatabase();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aivoicecast_export_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus('success');
      setMessage('File downloaded successfully.');
    } catch (e) {
      console.error(e);
      setStatus('error');
      setMessage('Failed to export to file.');
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setStatus('processing');
      setMessage('Restoring from file...');
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const jsonStr = event.target?.result as string;
          await importFullDatabase(jsonStr);
          setStatus('success');
          setMessage('Restored successfully! Reloading...');
          setTimeout(() => window.location.reload(), 1500);
        } catch (err) {
          setStatus('error');
          setMessage('Invalid backup file.');
        }
      };
      reader.readAsText(file);
    } catch (e) {
      setStatus('error');
      setMessage('Error reading file.');
    }
  };

  // --- Cloud Sync ---

  const handleCloudUpload = async () => {
    if (userId === 'public') {
        setStatus('error');
        setMessage("Guest users cannot upload. Please sign in.");
        return;
    }
    
    try {
      setStatus('processing');
      setMessage('Uploading to Cloud... (This may take time for large audio caches)');
      
      const result = await uploadToCloud();
      
      await fetchCloudStats();
      setStatus('success');
      
      const sizeMB = (result.size / 1024 / 1024).toFixed(2);
      const timeSec = (result.time / 1000).toFixed(1);
      
      setMessage(`Upload Complete! Sent ${result.count} items (${sizeMB} MB) in ${timeSec}s.`);
    } catch (e: any) {
      console.error(e);
      setStatus('error');
      setMessage(e.message || 'Upload failed. Check console.');
    }
  };

  const handleCloudDownload = async () => {
    try {
      // 1. Smart Check: Fetch Metadata first
      setStatus('processing');
      setMessage('Checking cloud backup...');
      
      const meta = await getCloudBackupMetadata();
      if (!meta) {
        setStatus('error');
        setMessage(userId === 'public' ? "No public content found." : "No cloud backup found for this user.");
        return;
      }
      
      const cloudDate = new Date(meta.timeCreated);
      let confirmMsg = `Found backup from ${cloudDate.toLocaleString()}.\n`;
      
      if (lastCloudDate) {
         if (cloudDate.getTime() > lastCloudDate.getTime()) {
            confirmMsg += `(Newer than your last sync: ${lastCloudDate.toLocaleString()})`;
         } else {
            confirmMsg += `WARNING: This backup is Older or Same as your last sync (${lastCloudDate.toLocaleString()}).`;
         }
      }
      
      confirmMsg += "\n\nOverwrite local data?";
      
      if (!confirm(confirmMsg)) {
         setStatus('idle');
         setMessage('');
         return;
      }

      // 2. Proceed with Download
      setMessage('Downloading from Cloud... (This may take time)');
      
      const result = await downloadFromCloud();
      
      await fetchCloudStats(); // Update timestamp in UI
      setStatus('success');
      
      const sizeMB = (result.size / 1024 / 1024).toFixed(2);
      const timeSec = (result.time / 1000).toFixed(1);
      
      setMessage(`Download Complete! Restored ${result.count} items (${sizeMB} MB) in ${timeSec}s. Reloading...`);
      setTimeout(() => window.location.reload(), 3000);
    } catch (e: any) {
      console.error(e);
      setStatus('error');
      setMessage(e.message || 'Download failed or cancelled.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in-up">
        
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900">
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Database className="text-indigo-400 w-6 h-6" />
            <span>Data Sync Center</span>
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-8 space-y-6">
          
          {/* Identity Section */}
          <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-4 flex flex-col space-y-2">
             <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">User Sync ID</span>
             </div>
             
             <div className="flex items-center justify-between">
                <code className="text-sm font-mono text-indigo-200 bg-indigo-900/20 px-2 py-1 rounded select-all">
                    {userId}
                </code>
                {userId !== 'public' && (
                    <button 
                        onClick={() => navigator.clipboard.writeText(userId)}
                        className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                        title="Copy ID"
                    >
                        <Copy size={14} />
                    </button>
                )}
             </div>
             <p className="text-[10px] text-slate-500">
                {userId === 'public' 
                   ? "Guest Mode: Cloud uploads are disabled. Sign in to enable personal backup." 
                   : "Your backups are linked securely to this Google Account ID."}
             </p>
          </div>

          {/* Stats Bar */}
          <div className="flex gap-4">
             <div className="flex-1 bg-slate-800/50 rounded-xl p-4 border border-slate-700">
               <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Local Storage</h3>
               <p className="text-xl font-bold text-white mt-1">{stats ? stats.size : '...'}</p>
             </div>
             <div className="flex-1 bg-slate-800/50 rounded-xl p-4 border border-slate-700">
               <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Last Cloud Sync</h3>
               <p className="text-xl font-bold text-indigo-300 mt-1">
                 {lastCloudDate ? lastCloudDate.toLocaleDateString() + ' ' + lastCloudDate.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'Never'}
               </p>
             </div>
          </div>

          {/* Cloud Sync Section */}
          <div className="space-y-4">
             <div className="flex items-center space-x-2 text-indigo-400">
               <Cloud size={20} />
               <span className="font-bold">Cloud Sync (Google Firebase)</span>
             </div>
             <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={handleCloudUpload}
                  disabled={status === 'processing' || userId === 'public'}
                  className="flex items-center justify-center space-x-3 p-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
                  title={userId === 'public' ? "Sign in to upload" : "Backup to Cloud"}
                >
                  <CloudUpload size={20} />
                  <span>Upload to Cloud</span>
                </button>
                <button 
                  onClick={handleCloudDownload}
                  disabled={status === 'processing'}
                  className="flex items-center justify-center space-x-3 p-4 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 hover:border-indigo-500 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CloudDownload size={20} />
                  <span>Download from Cloud</span>
                </button>
             </div>
          </div>

          <div className="h-px bg-slate-800 w-full" />

          {/* File Sync Section */}
          <div className="space-y-4 opacity-80 hover:opacity-100 transition-opacity">
             <div className="flex items-center space-x-2 text-slate-400">
               <Database size={20} />
               <span className="font-bold">Manual File Backup</span>
             </div>
             <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={handleExportFile}
                  disabled={status === 'processing'}
                  className="flex items-center justify-center space-x-2 p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-300 transition-all"
                >
                  <ExportIcon />
                  <span>Export Data</span>
                </button>
                <label 
                  className={`flex items-center justify-center space-x-2 p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-300 transition-all cursor-pointer ${status === 'processing' ? 'pointer-events-none opacity-50' : ''}`}
                >
                  <ImportIcon />
                  <span>Import Data</span>
                  <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
                </label>
             </div>
          </div>

          {/* Status Message */}
          {status !== 'idle' && (
             <div className={`p-4 rounded-lg flex items-start space-x-3 ${
                status === 'processing' ? 'bg-indigo-900/20 text-indigo-200' :
                status === 'success' ? 'bg-emerald-900/20 text-emerald-200' :
                'bg-red-900/20 text-red-200'
             }`}>
                {status === 'processing' && <Loader2 className="animate-spin flex-shrink-0" size={20} />}
                {status === 'success' && <CheckCircle className="flex-shrink-0" size={20} />}
                {status === 'error' && <AlertCircle className="flex-shrink-0" size={20} />}
                <p className="text-sm font-medium">{message}</p>
             </div>
          )}

        </div>
      </div>
    </div>
  );
};

// Helper components for icons to keep main clean
const ExportIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
);
const ImportIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
);
