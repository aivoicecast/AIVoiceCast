import React, { useState, useEffect } from 'react';
import { CommunityDiscussion } from '../types';
import { getUserDesignDocs, deleteDiscussion, getPublicDesignDocs, getGroupDesignDocs, getUserProfile } from '../services/firestoreService';
import { FileText, ArrowRight, Loader2, MessageSquare, Plus, ShieldCheck, Trash2, Info, FileCode, Globe, Users, Lock, User, AlertCircle, Sparkles } from 'lucide-react';
import { auth } from '../services/firebaseConfig';
import { DiscussionModal } from './DiscussionModal';
import { APP_COMPARISON_DOC } from '../utils/docContent';

interface DocumentListProps {
  onBack?: () => void;
}

export const DocumentList: React.FC<DocumentListProps> = ({ onBack }) => {
  const [docs, setDocs] = useState<CommunityDiscussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  
  const currentUser = auth?.currentUser;

  const loadData = async () => {
    setLoading(true);
    // Fix: Declaring allDocs outside of the try block so it is accessible in the catch block for error reporting.
    let allDocs: CommunityDiscussion[] = [];
    try {
      // 1. Fetch Public Docs (Always available)
      try {
        const publicDocs = await getPublicDesignDocs();
        allDocs = [...allDocs, ...publicDocs];
      } catch (e) { console.warn("Public docs fetch failed"); }

      // 2. Fetch User Specific Docs (If logged in)
      if (currentUser) {
          const myDocs = await getUserDesignDocs(currentUser.uid);
          allDocs = [...allDocs, ...myDocs];
          
          const profile = await getUserProfile(currentUser.uid);
          if (profile?.groups) {
              const groupDocs = await getGroupDesignDocs(profile.groups);
              allDocs = [...allDocs, ...groupDocs];
          }
      }

      // 3. Fetch Local Guest Docs (Stored in localStorage)
      const localDocsRaw = localStorage.getItem('guest_docs_v1');
      if (localDocsRaw) {
          try {
              const localDocs = JSON.parse(localDocsRaw);
              allDocs = [...allDocs, ...localDocs];
          } catch(e) { console.warn("Local docs parse failed"); }
      }
      
      // Deduplicate
      const unique = Array.from(new Map(allDocs.map(item => [item.id, item])).values());
      
      // System Examples
      const isSystemDocHidden = localStorage.getItem('hide_system_doc_v1') === 'true';
      const finalDocs = isSystemDocHidden ? unique.filter(d => d.id !== APP_COMPARISON_DOC.id) : [APP_COMPARISON_DOC, ...unique.filter(d => d.id !== APP_COMPARISON_DOC.id)];
      
      setDocs(finalDocs.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt)));

    } catch (e) {
      console.error(allDocs);
      setDocs([APP_COMPARISON_DOC]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (!id || id === 'new') return;
      if (id === APP_COMPARISON_DOC.id) {
          if (confirm("This is a system example. Hide it from your list?")) {
              localStorage.setItem('hide_system_doc_v1', 'true');
              loadData();
          }
          return;
      }

      // Handle Guest Doc Deletion
      const localDocsRaw = localStorage.getItem('guest_docs_v1');
      if (localDocsRaw) {
          const localDocs = JSON.parse(localDocsRaw);
          if (localDocs.some((d: any) => d.id === id)) {
              if (!confirm("Delete this local document?")) return;
              const filtered = localDocs.filter((d: any) => d.id !== id);
              localStorage.setItem('guest_docs_v1', JSON.stringify(filtered));
              loadData();
              return;
          }
      }

      if (!confirm("Are you sure you want to delete this document permanently?")) return;
      setIsDeleting(id);
      try {
          await deleteDiscussion(id);
          setDocs(prev => prev.filter(d => d.id !== id));
      } catch (e) {
          console.error("Delete failed", e);
          alert("Failed to delete document from cloud.");
      } finally {
          setIsDeleting(null);
      }
  };

  const handleCleanupUntitled = async () => {
      const untitledDocs = docs.filter(d => (!d.title || d.title === 'Untitled Document') && d.id !== APP_COMPARISON_DOC.id && d.id !== 'new');
      if (untitledDocs.length === 0) {
          alert("No untitled documents found to clean up.");
          return;
      }
      if (!confirm(`This will attempt to delete ${untitledDocs.length} "Untitled" documents. Continue?`)) return;
      setIsCleaningUp(true);
      
      // Clean local
      const localDocsRaw = localStorage.getItem('guest_docs_v1');
      if (localDocsRaw) {
          const localDocs = JSON.parse(localDocsRaw);
          const filtered = localDocs.filter((d: any) => d.title && d.title !== 'Untitled Document');
          localStorage.setItem('guest_docs_v1', JSON.stringify(filtered));
      }

      // Clean cloud
      if (currentUser) {
          for (const doc of untitledDocs) {
              if (doc.userId === currentUser.uid) {
                try { if (doc.id) await deleteDiscussion(doc.id); } catch (e) { console.error(`Failed to delete doc ${doc.id}`, e); }
              }
          }
      }
      
      await loadData();
      setIsCleaningUp(false);
  };

  const handleCreateNew = () => {
      setSelectedDocId('new'); 
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="w-2 h-6 bg-emerald-500 rounded-full"></span>
            <span>Document Studio</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">Create Markdown specifications and PlantUML diagrams.</p>
        </div>
        <div className="flex items-center gap-2">
            <button onClick={handleCleanupUntitled} disabled={isCleaningUp || loading} className="flex items-center space-x-2 px-3 py-2 bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-400 rounded-lg transition-all text-xs font-bold border border-slate-700 hover:border-red-900/50">
                {isCleaningUp ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>{isCleaningUp ? 'Cleaning...' : 'Cleanup Untitled'}</span>
            </button>
            <button onClick={handleCreateNew} className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors text-xs font-bold shadow-lg shadow-indigo-500/20 active:scale-95">
                <Plus size={14} />
                <span>New Spec</span>
            </button>
        </div>
      </div>

      {!currentUser && (
          <div className="bg-indigo-900/20 border border-indigo-500/30 p-4 rounded-xl flex items-center gap-3 text-indigo-300">
              <Info size={18} className="shrink-0" />
              <p className="text-xs">Guest Mode: You can create and edit documents. They will be saved to your browser's local storage. Sign in to sync them to your cloud account.</p>
          </div>
      )}

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-indigo-400 gap-4">
          <Loader2 className="animate-spin" size={32} />
          <span className="text-xs font-bold uppercase tracking-widest animate-pulse">Syncing Knowledge...</span>
        </div>
      ) : docs.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-500 bg-slate-900/30 rounded-3xl border-2 border-dashed border-slate-800">
          <FileText size={48} className="mb-4 opacity-10" />
          <p className="font-bold">The library is empty.</p>
          <button onClick={handleCreateNew} className="mt-4 text-indigo-400 font-bold hover:text-white flex items-center gap-2">
             <Plus size={16}/> Create your first document
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {docs.map((doc) => {
            const isSystem = doc.id === APP_COMPARISON_DOC.id;
            const hasSynthesis = !!doc.designDoc;
            const isCodeDoc = doc.title?.endsWith('.hpp') || doc.title?.endsWith('.cpp') || doc.title?.endsWith('.py') || doc.title?.includes('Diagram') || doc.designDoc?.includes('```plantuml');
            const isMyDoc = (currentUser && doc.userId === currentUser.uid) || (!currentUser && doc.userId === 'guest');

            return (
              <div key={doc.id} onClick={() => setSelectedDocId(doc.id)} className={`bg-slate-900 border ${isSystem ? 'border-indigo-500/50 bg-indigo-900/10' : hasSynthesis ? 'border-slate-800' : 'border-emerald-500/30 bg-emerald-900/5'} rounded-2xl p-5 hover:border-emerald-500/50 hover:bg-slate-800/50 transition-all cursor-pointer group flex flex-col justify-between relative shadow-lg`}>
                {(isMyDoc || isSystem) && (
                    <button onClick={(e) => handleDelete(e, doc.id)} disabled={isDeleting === doc.id} className="absolute top-4 right-4 p-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-slate-950/50 rounded-lg hover:bg-red-900/20">
                        {isDeleting === doc.id ? <Loader2 size={16} className="animate-spin"/> : <Trash2 size={16} />}
                    </button>
                )}
                <div>
                  <div className="flex items-start justify-between mb-3">
                     <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${isSystem ? 'bg-indigo-900/30 text-indigo-400' : isCodeDoc ? 'bg-amber-900/20 text-amber-400' : 'bg-emerald-900/20 text-emerald-400'}`}>
                            {isSystem ? <ShieldCheck size={20}/> : isCodeDoc ? <FileCode size={20}/> : <FileText size={20} />}
                        </div>
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-950/50 border border-slate-800">
                           {doc.visibility === 'public' ? <span title="Public"><Globe size={10} className="text-emerald-400" /></span> : doc.visibility === 'group' ? <span title="Shared with Group"><Users size={10} className="text-purple-400" /></span> : <span title="Private"><Lock size={10} className="text-slate-500" /></span>}
                           <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{doc.visibility || 'Private'}</span>
                        </div>
                     </div>
                     <div className="flex flex-col items-end gap-1">
                        <span className="text-[9px] text-slate-600 font-mono bg-slate-950 px-2 py-1 rounded">{isSystem ? 'CORE' : new Date(doc.createdAt).toLocaleDateString()}</span>
                        {!hasSynthesis && !isSystem && <span className="text-[9px] font-bold bg-indigo-600/40 text-indigo-200 px-1.5 py-0.5 rounded border border-indigo-500/20">{doc.transcript && doc.transcript.length > 0 ? 'SESSION' : 'DRAFT'}</span>}
                     </div>
                  </div>
                  <h3 className={`text-base font-bold mb-1 line-clamp-1 group-hover:text-emerald-400 transition-colors pr-8 ${isSystem ? 'text-indigo-100' : 'text-white'}`}>{doc.title || "Untitled Document"}</h3>
                  <p className="text-xs text-slate-500 mb-4 line-clamp-2 h-8">{isSystem ? "Official platform guidelines." : doc.isManual ? "Manual Technical Specification" : (doc.transcript && doc.transcript.length > 0 ? `Captured from: ${doc.lectureId}` : "Draft specification.")}</p>
                </div>
                <div className="flex items-center justify-between border-t border-slate-800/50 pt-4 mt-2">
                   <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                       <div className="flex items-center gap-1"><User size={12} className="text-slate-600"/><span className="truncate max-w-[80px]">{isMyDoc ? 'Me' : doc.userName}</span></div>
                       <span className="text-slate-800">•</span>
                       {isSystem ? <span className="text-indigo-500">PLATFORM SPEC</span> : doc.userId === 'guest' ? <span className="text-emerald-500">LOCAL DEVICE</span> : <span className="text-slate-500">CLOUD SYNCED</span>}
                   </div>
                   <button className="text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px] font-black uppercase tracking-widest">{hasSynthesis ? 'Open' : 'Edit'} <ArrowRight size={12} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedDocId && (
        <DiscussionModal 
           isOpen={true} 
           onClose={() => { setSelectedDocId(null); loadData(); }} 
           discussionId={selectedDocId} 
           currentUser={currentUser} 
           onDocumentDeleted={() => { setSelectedDocId(null); loadData(); }}
           initialDiscussion={selectedDocId === 'new' ? { 
               id: 'new', 
               lectureId: 'manual', 
               channelId: 'manual', 
               userId: currentUser?.uid || 'guest', 
               userName: currentUser?.displayName || 'Guest User', 
               transcript: [], 
               createdAt: Date.now(), 
               designDoc: "", 
               isManual: true, 
               title: "New Specification", 
               visibility: currentUser ? 'private' : 'public' 
            } : (selectedDocId === APP_COMPARISON_DOC.id ? APP_COMPARISON_DOC : undefined)}
        />
      )}
    </div>
  );
};
