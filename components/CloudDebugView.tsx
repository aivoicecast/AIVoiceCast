
import React, { useState, useEffect } from 'react';
import { listUserBackups, deleteCloudFile, CloudFileEntry } from '../services/cloudService';
import { ArrowLeft, Trash2, RefreshCw, Cloud, FileJson, Folder, CornerLeftUp, FileAudio } from 'lucide-react';
import { auth } from '../services/firebaseConfig';

interface CloudDebugViewProps {
  onBack: () => void;
}

export const CloudDebugView: React.FC<CloudDebugViewProps> = ({ onBack }) => {
  const [files, setFiles] = useState<CloudFileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPath, setCurrentPath] = useState(''); // relative path inside user folder

  const loadData = async (path: string = '') => {
    setIsLoading(true);
    const data = await listUserBackups(path);
    setFiles(data);
    setCurrentPath(path);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData('');
  }, []);

  const handleDelete = async (fullPath: string) => {
    if (!confirm(`Delete cloud file: ${fullPath}? This cannot be undone.`)) return;
    try {
      await deleteCloudFile(fullPath);
      await loadData(currentPath);
    } catch (e) {
      alert("Failed to delete file. Check console.");
    }
  };

  const handleFolderClick = (folderName: string) => {
     const newPath = currentPath ? `${currentPath}/${folderName}` : folderName;
     loadData(newPath);
  };

  const handleGoUp = () => {
     if (!currentPath) return;
     const parts = currentPath.split('/');
     parts.pop();
     loadData(parts.join('/'));
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const currentUid = auth.currentUser?.uid || localStorage.getItem('aivoicecast_uid') || 'Unknown';

  return (
    <div className="h-full overflow-y-auto bg-slate-950 text-slate-100 p-8 scrollbar-thin scrollbar-thumb-slate-800">
      <div className="max-w-5xl mx-auto space-y-6 pb-24">
        
        {/* Header */}
        <div className="flex items-center justify-between">
           <div className="flex items-center space-x-4">
             <button onClick={onBack} className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700">
                <ArrowLeft size={20} />
             </button>
             <div>
                <h1 className="text-2xl font-bold flex items-center space-x-2">
                  <Cloud className="text-indigo-400" />
                  <span>Cloud Storage Inspector</span>
                </h1>
                <p className="text-xs text-slate-500 font-mono mt-1">User ID: {currentUid}</p>
             </div>
           </div>
           <button onClick={() => loadData(currentPath)} className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-500">
             <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
             <span>Refresh</span>
           </button>
        </div>

        {/* Breadcrumbs / Path Bar */}
        <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg flex items-center space-x-2 text-sm font-mono overflow-x-auto">
           <button onClick={() => loadData('')} className="text-indigo-400 hover:underline">root</button>
           {currentPath.split('/').filter(Boolean).map((part, i, arr) => (
              <React.Fragment key={i}>
                 <span className="text-slate-600">/</span>
                 <button 
                    onClick={() => loadData(arr.slice(0, i+1).join('/'))}
                    className={`${i === arr.length - 1 ? 'text-white font-bold' : 'text-indigo-400 hover:underline'}`}
                 >
                    {part}
                 </button>
              </React.Fragment>
           ))}
        </div>

        {/* Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
           <div className="overflow-x-auto">
             <table className="w-full text-left text-sm text-slate-400">
               <thead className="bg-slate-950 text-slate-200 uppercase text-xs font-bold">
                 <tr>
                   <th className="px-6 py-4">Name</th>
                   <th className="px-6 py-4">Type</th>
                   <th className="px-6 py-4">Size</th>
                   <th className="px-6 py-4 text-right">Actions</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-800">
                 {currentPath && (
                    <tr onClick={handleGoUp} className="hover:bg-slate-800/50 transition-colors cursor-pointer group">
                       <td className="px-6 py-3" colSpan={4}>
                          <div className="flex items-center space-x-2 text-indigo-400 group-hover:text-white">
                             <CornerLeftUp size={16} />
                             <span>.. (Go Up)</span>
                          </div>
                       </td>
                    </tr>
                 )}
                 
                 {files.map((file) => (
                   <tr key={file.fullPath} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4">
                         <div 
                            className={`flex items-center space-x-3 ${file.isFolder ? 'cursor-pointer text-indigo-300 hover:text-white' : 'text-slate-200'}`}
                            onClick={() => file.isFolder && handleFolderClick(file.name)}
                         >
                            {file.isFolder ? (
                               <Folder size={18} className="fill-indigo-900/50 text-indigo-400" />
                            ) : file.name.endsWith('.json') ? (
                               <FileJson size={18} className="text-yellow-500" />
                            ) : (
                               <FileAudio size={18} className="text-emerald-500" />
                            )}
                            <span className="font-mono text-xs">{file.name}</span>
                         </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-xs">
                         {file.isFolder ? 'Folder' : file.contentType || 'File'}
                      </td>
                      <td className="px-6 py-4 font-mono text-emerald-400">{formatSize(file.size)}</td>
                      <td className="px-6 py-4 text-right">
                         {!file.isFolder && (
                            <button 
                                onClick={() => handleDelete(file.fullPath)}
                                className="text-slate-500 hover:text-red-400 transition-colors p-2 hover:bg-slate-800 rounded-full"
                                title="Delete File"
                            >
                                <Trash2 size={16} />
                            </button>
                         )}
                      </td>
                   </tr>
                 ))}
                 
                 {!isLoading && files.length === 0 && (
                   <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-600 italic">
                         Empty directory.
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
