
import React, { useState, useEffect } from 'react';
import { CommunityDiscussion, UserProfile } from '../types';
import { getUserDesignDocs, deleteDiscussion, getPublicDesignDocs, getGroupDesignDocs, getUserProfile } from '../services/firestoreService';
import { FileText, ArrowRight, Loader2, MessageSquare, Plus, Edit, ShieldCheck, Trash2, Info, FileCode, Sparkles, Wand2, Globe, Users, Lock, User } from 'lucide-react';
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
  
  const currentUser = auth.currentUser;

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      // 1. Fetch My Docs
      const myDocs = await getUserDesignDocs(currentUser.uid);
      
      // 2. Fetch Public Docs
      const publicDocs = await getPublicDesignDocs();
      
      // 3. Fetch Group Docs
      const profile = await getUserProfile(currentUser.uid);
      const groupDocs = profile?.groups ? await getGroupDesignDocs(profile.groups) : [];
      
      // Combine and filter unique by ID
      const all = [...myDocs, ...publicDocs, ...groupDocs];
      const unique = Array.from(new Map(all.map(item => [item.id, item])).values());
      
      const isSystemDocHidden = localStorage.getItem('hide_system_doc_v1') === 'true';
      const userDocs = unique.filter(d => d.id !== APP_COMPARISON_DOC.id);
      
      const final = isSystemDocHidden ? userDocs : [APP_COMPARISON_DOC, ...userDocs];
      setDocs(final.sort((a, b) => b.createdAt - a.createdAt));

    } catch (e) {
      console.error(e);
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

      if (!confirm("Are you sure you want to delete this document permanently?")) return;
      
      setIsDeleting(id);
      try {
          await deleteDiscussion(id);
          setDocs(prev => prev.filter(d => d.id !== id));
      } catch (e) {
          console.error("Delete failed", e);
          alert("Failed to delete document. It might have already been removed or you may lack permissions.");
      } finally {
          setIsDeleting(null);
      }
  };

  const handleCleanupUntitled = async () => {
      const untitledDocs = docs.filter(d => d.userId === currentUser?.uid && (!d.title || d.title === 'Untitled Document') && d.id !== APP_COMPARISON_DOC.id && d.id !== 'new');
      
      if (untitledDocs.length === 0) {
          alert("No untitled documents found to clean up.");
          return;
      }

      if (!confirm(`This will attempt to delete ${untitledDocs.length} "Untitled" documents. Continue?`)) return;

      setIsCleaningUp(true);
      let successCount = 0;
      let failCount = 0;

      for (const doc of untitledDocs) {
          try {
              if (doc.id) {
                  await deleteDiscussion(doc.id);
                  successCount++;
              }
          } catch (e) {
              console.error(`Failed to delete doc ${doc.id}`, e);
              failCount++;
          }
      }
      
      await loadData();
      
      if (failCount === 0) {
          alert(`Successfully removed ${successCount} documents.`);
      } else {
          alert(`Cleanup finished. Removed ${successCount} documents. ${failCount} documents could not be deleted.`);
      }
      setIsCleaningUp(false);
  };

  const handleCreateNew = async () => {
      if (!currentUser) return;
      setSelectedDocId('new'); 
  };

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500 bg-slate-900/30 rounded-xl border border-dashed border-slate-800">
        <p>Please sign in to view your documents.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="w-2 h-6 bg-emerald-500 rounded-full"></span>
          <span>Document Studio</span>
        </h2>
        <div className="flex items-center gap-2">
            <button 
                onClick={handleCleanupUntitled}
                disabled={isCleaningUp || loading}
                className="flex items-center space-x-2 px-3 py-2 bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-400 rounded-lg transition-all text-xs font-bold border border-slate-700 hover:border-red-900/50"
            >
                {isCleaningUp ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>{isCleaningUp ? 'Cleaning...' : 'Cleanup Untitled'}</span>
            </button>
            <button 
                onClick={handleCreateNew}
                className="flex items-center space-x-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors text-xs font-bold shadow-md shadow-indigo-500/20"
            >
                <Plus size={14} />
                <span>New Spec</span>
            </button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center text-indigo-400">
          <Loader2 className="animate-spin" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {docs.map((doc) => {
            const isSystem = doc.id === APP_COMPARISON_DOC.id;
            const hasSynthesis = !!doc.designDoc;
            const isCodeDoc = doc.title?.endsWith('.hpp') || doc.title?.endsWith('.cpp') || doc.title?.endsWith('.py');
            const isMyDoc = doc.userId === currentUser.uid;

            return (
              <div 
                key={doc.id} 
                onClick={() => setSelectedDocId(doc.id)}
                className={`bg-slate-900 border ${isSystem ? 'border-indigo-500/50 bg-indigo-900/10' : hasSynthesis ? 'border-slate-800' : 'border-emerald-500/30 bg-emerald-900/5'} rounded-xl p-5 hover:border-emerald-500/50 hover:bg-slate-800/50 transition-all cursor-pointer group flex flex-col justify-between relative shadow-sm`}
              >
                {/* Delete Button */}
                {isMyDoc && (
                    <button 
                    onClick={(e) => handleDelete(e, doc.id)}
                    disabled={isDeleting === doc.id}
                    className="absolute top-4 right-4 p-2 text-slate-600 hover:text-red-400 opacity-40 group-hover:opacity-100 transition-opacity z-10 bg-slate-950/50 rounded-lg hover:bg-red-900/20"
                    title={isSystem ? "Hide Example" : "Delete Document"}
                    >
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
                           {/* Fixed: Wrapped icons in span with title attribute as Lucide components don't accept direct 'title' prop */}
                           {doc.visibility === 'public' ? (
                               <span title="Public"><Globe size={12} className="text-emerald-400" /></span>
                           ) : doc.visibility === 'group' ? (
                               <span title="Shared with Group"><Users size={12} className="text-purple-400" /></span>
                           ) : (
                               <span title="Private"><Lock size={12} className="text-slate-500" /></span>
                           )}
                           <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{doc.visibility || 'Private'}</span>
                        </div>
                     </div>
                     <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] text-slate-500 font-mono bg-slate-950 px-2 py-1 rounded">
                            {isSystem ? 'EXAMPLE' : new Date(doc.createdAt).toLocaleDateString()}
                        </span>
                        {!hasSynthesis && !isSystem && (
                            <span className="text-[9px] font-bold bg-indigo-600/40 text-indigo-200 px-1.5 py-0.5 rounded border border-indigo-500/20">
                                {doc.transcript && doc.transcript.length > 0 ? 'RAW SESSION' : 'EMPTY DRAFT'}
                            </span>
                        )}
                     </div>
                  </div>
                  
                  <h3 className={`text-lg font-bold mb-1 line-clamp-1 group-hover:text-emerald-400 transition-colors pr-10 ${isSystem ? 'text-indigo-100' : 'text-white'}`}>
                     {doc.title || "Untitled Document"}
                  </h3>
                  <p className="text-xs text-slate-400 mb-4 line-clamp-2">
                     {isSystem ? "Official distinction between platform pillars." : doc.isManual ? "Manual Technical Specification" : (doc.transcript && doc.transcript.length > 0 ? `Captured from: ${doc.lectureId}` : "No content captured yet.")}
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-slate-800/50 pt-3 mt-2">
                   <div className="flex items-center gap-2 text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                          <User size={12} />
                          <span className="truncate max-w-[100px]">{isMyDoc ? 'Me' : doc.userName}</span>
                      </div>
                      <span className="text-slate-700">•</span>
                      {isSystem ? (
                          <span className="text-indigo-400 font-bold uppercase tracking-widest text-[9px]">Platform Spec</span>
                      ) : doc.transcript && doc.transcript.length > 0 ? (
                          <><MessageSquare size={12} /><span>{doc.transcript.length} Messages</span></>
                      ) : (
                          <><Edit size={12} /><span>Editor Mode</span></>
                      )}
                   </div>
                   <button className="text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs font-bold">
                      {hasSynthesis ? 'Read & Edit' : 'Open Editor'} <ArrowRight size={12} />
                   </button>
                </div>
              </div>
            );
          })}
          {docs.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-500 bg-slate-900/30 rounded-xl border border-dashed border-slate-800">
                  <Info className="mx-auto mb-2 opacity-20" size={32}/>
                  <p>No documents found.</p>
                  <button onClick={handleCreateNew} className="text-emerald-400 font-bold hover:underline mt-2">Create your first document</button>
              </div>
          )}
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
              userId: currentUser.uid,
              userName: currentUser.displayName || 'User',
              transcript: [],
              createdAt: Date.now(),
              designDoc: "# New Specification\n\nStart writing...",
              isManual: true,
              title: "[Manual] New Specification",
              visibility: 'private'
           } : (selectedDocId === APP_COMPARISON_DOC.id ? APP_COMPARISON_DOC : undefined)}
        />
      )}
    </div>
  );
};