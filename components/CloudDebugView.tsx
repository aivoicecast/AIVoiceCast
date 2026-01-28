
import React, { useState, useEffect } from 'react';
import { listUserBackups, deleteCloudFile, CloudFileEntry, getCloudFileContent } from '../services/cloudService';
import { ArrowLeft, Trash2, RefreshCw, Cloud, FileJson, Folder, CornerLeftUp, FileAudio, Eye, X, Loader2, Database, ShieldCheck, AlertCircle } from 'lucide-react';
import { auth } from '../services/firebaseConfig';

interface CloudDebugViewProps {
  onBack: () => void;
}

export const CloudDebugView: React.FC<CloudDebugViewProps> = ({ onBack }) => {
  const [files, setFiles] = useState<CloudFileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPath, setCurrentPath] = useState(''); 
  const [isAbsolute, setIsAbsolute] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const loadData = async (path: string = '', absolute: boolean = false) => {
    setIsLoading(true);
    try {
        const data = await listUserBackups(path, absolute);
        setFiles(data);
        setCurrentPath(path);
        setIsAbsolute(absolute);
    } catch (e) {
        console.error("Storage list failed", e);
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData('');
  }, []);

  const handleDelete = async (fullPath: string) => {
    if (!confirm(`Delete cloud file: ${fullPath}? This cannot be undone.`)) return;
    try {
      await deleteCloudFile(fullPath);
      await loadData(currentPath, isAbsolute);
    } catch (e) {
      alert("Failed to delete file. Check console.");
    }
  };

  const handleFolderClick = (folderName: string, fullPath: string) => {
     loadData(fullPath, true);
  };

  const handleGoUp = () => {
     if (!currentPath || currentPath === 'backups' || currentPath === 'bible_corpus') {
         loadData('');
         return;
     }
     const parts = currentPath.split('/');
     parts.pop();
     loadData(parts.join('/'), true);
  };

  const handlePreviewFile = async (file: CloudFileEntry) => {
      setIsPreviewLoading(true);
      setPreviewName(file.name);
      try {
          const content = await getCloudFileContent(file.fullPath);
          setPreviewContent(content);
      } catch (e: any) {
          setPreviewContent(`[ERROR READING FILE]: ${e.message}`);
      } finally {
          setIsPreviewLoading(false);
      }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const currentUid = auth.currentUser?.uid || localStorage.getItem('aivoicecast_uid') || 'Unknown';

  return (
    <div className="h-full overflow-hidden bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Header */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0">
          <div className="flex items-center space-x-4">
             <button onClick={onBack} className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700">
                <ArrowLeft size={20} />
             </button>
             <div>
                <h1 className="text-xl font-bold flex items-center space-x-2 italic uppercase tracking-tighter">
                  <Cloud className="text-indigo-400" />
                  <span>Storage Inspector</span>
                </h1>
                <p className="text-[10px] text-slate-500 font-mono">UID: {currentUid}</p>
             </div>
          </div>
          <div className="flex gap-2">
              <button 
                onClick={() => loadData('bible_corpus', true)} 
                className="flex items-center gap-2 px-3 py-1.5 bg-amber-900/20 hover:bg-amber-600 text-amber-400 hover:text-white border border-amber-500/30 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-lg"
              >
                  <Database size={14}/> Bible Corpus
              </button>
              <button onClick={() => loadData(currentPath, isAbsolute)} className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-all active:scale-95 shadow-lg">
                <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                <span className="text-xs font-bold uppercase">Refresh</span>
              </button>
          </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col p-8 space-y-6 overflow-y-auto scrollbar-hide">
                {/* Breadcrumbs */}
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl flex items-center space-x-2 text-xs font-mono overflow-x-auto shadow-inner">
                   <button onClick={() => loadData('')} className="text-indigo-400 hover:underline">root</button>
                   {currentPath.split('/').filter(Boolean).map((part, i, arr) => (
                      <React.Fragment key={i}>
                         <span className="text-slate-600">/</span>
                         <button 
                            onClick={() => loadData(arr.slice(0, i+1).join('/'), true)}
                            className={`${i === arr.length - 1 ? 'text-white font-bold' : 'text-indigo-400 hover:underline'}`}
                         >
                            {part}
                         </button>
                      </React.Fragment>
                   ))}
                </div>

                {/* Table */}
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
                         {(currentPath || isAbsolute) && (
                            <tr onClick={handleGoUp} className="hover:bg-slate-800/50 transition-colors cursor-pointer group">
                               <td className="px-6 py-3" colSpan={4}>
                                  <div className="flex items-center space-x-2 text-indigo-400 group-hover:text-white">
                                     <CornerLeftUp size={16} />
                                     <span className="text-xs font-bold uppercase tracking-widest">.. (Go Up)</span>
                                  </div>
                               </td>
                            </tr>
                         )}
                         
                         {files.map((file) => (
                           <tr key={file.fullPath} className="hover:bg-indigo-600/5 transition-colors group">
                              <td className="px-6 py-4">
                                 <div 
                                    className={`flex items-center space-x-3 ${file.isFolder ? 'cursor-pointer text-indigo-300 hover:text-white' : 'text-slate-200'}`}
                                    onClick={() => file.isFolder ? handleFolderClick(file.name, file.fullPath) : handlePreviewFile(file)}
                                 >
                                    {file.isFolder ? (
                                       <Folder size={18} className="fill-indigo-900/50 text-indigo-400" />
                                    ) : file.name.endsWith('.json') ? (
                                       <FileJson size={18} className="text-amber-500" />
                                    ) : (
                                       <FileAudio size={18} className="text-emerald-500" />
                                    )}
                                    <span className="font-mono text-xs">{file.name}</span>
                                 </div>
                              </td>
                              <td className="px-6 py-4 text-slate-600 text-[10px] font-black uppercase tracking-tighter">
                                 {file.isFolder ? 'Directory' : file.contentType || 'Binary Asset'}
                              </td>
                              <td className="px-6 py-4 font-mono text-[10px] text-emerald-400">{formatSize(file.size)}</td>
                              <td className="px-6 py-4 text-right">
                                 <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {!file.isFolder && (
                                       <>
                                          <button 
                                              onClick={() => handlePreviewFile(file)}
                                              className="p-2 text-slate-400 hover:text-indigo-400 transition-colors"
                                              title="Preview Content"
                                          >
                                              <Eye size={16} />
                                          </button>
                                          <button 
                                              onClick={() => handleDelete(file.fullPath)}
                                              className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                                              title="Delete File"
                                          >
                                              <Trash2 size={16} />
                                          </button>
                                       </>
                                    )}
                                 </div>
                              </td>
                           </tr>
                         ))}
                         
                         {!isLoading && files.length === 0 && (
                           <tr>
                              <td colSpan={4} className="px-6 py-20 text-center">
                                 <div className="flex flex-col items-center gap-4 opacity-20">
                                     <Database size={48} />
                                     <p className="text-xs font-black uppercase tracking-widest">Empty directory</p>
                                 </div>
                              </td>
                           </tr>
                         )}
                       </tbody>
                     </table>
                   </div>
                </div>
          </div>

          {/* Preview Panel */}
          {(previewContent || isPreviewLoading) && (
              <div className="w-1/2 border-l border-slate-800 bg-black/40 backdrop-blur-md flex flex-col animate-fade-in relative z-50">
                  <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/80">
                      <div className="flex items-center gap-3">
                          <FileJson size={18} className="text-amber-500"/>
                          <h3 className="text-sm font-bold text-white truncate max-w-[300px]">{previewName}</h3>
                      </div>
                      <button onClick={() => setPreviewContent(null)} className="p-1 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-colors"><X size={20}/></button>
                  </div>
                  <div className="flex-1 overflow-auto p-6 font-mono text-xs text-indigo-200/80 leading-relaxed scrollbar-hide">
                      {isPreviewLoading ? (
                          <div className="h-full flex flex-col items-center justify-center gap-3 animate-pulse">
                              <Loader2 size={32} className="animate-spin text-indigo-500"/>
                              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Decrypting Storage Node...</span>
                          </div>
                      ) : (
                          <pre className="whitespace-pre-wrap select-text">
                              {previewContent}
                          </pre>
                      )}
                  </div>
                  <div className="p-4 bg-slate-950 border-t border-slate-800 text-center">
                      <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Sovereign Data Preview Mode</p>
                  </div>
              </div>
          )}
      </div>

      {isLoading && (
        <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-[2px] pointer-events-none z-30"></div>
      )}
    </div>
  );
};
