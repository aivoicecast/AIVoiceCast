import React, { useState, useEffect } from 'react';
import { CommunityDiscussion } from '../types';
import { getUserDesignDocs, deleteDiscussion, getPublicDesignDocs, getGroupDesignDocs, getUserProfile } from '../services/firestoreService';
import { FileText, ArrowRight, Loader2, MessageSquare, Plus, ShieldCheck, Trash2, Info, FileCode, Globe, Users, Lock, User, AlertCircle, Sparkles } from 'lucide-react';
import { auth } from '../services/firebaseConfig';
import { DiscussionModal } from './DiscussionModal';
import { APP_COMPARISON_DOC, STACK_STORY_DOC, BUILT_WITH_DOC } from '../utils/docContent';

interface DocumentListProps {
  onBack?: () => void;
}

export const DocumentList: React.FC<DocumentListProps> = ({ onBack }) => {
  const [docs, setDocs] = useState<CommunityDiscussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  
  const currentUser = auth?.currentUser;

  const loadData = async () => {
    setLoading(true);
    let allDocs: CommunityDiscussion[] = [];
    try {
      // 1. Always attempt to load public documents
      try {
        const publicDocs = await getPublicDesignDocs();
        allDocs = [...allDocs, ...publicDocs];
      } catch (e) { 
        console.warn("Public docs fetch failed", e); 
      }

      // 2. Load user-specific documents if authenticated
      if (currentUser) {
          try {
              const myDocs = await getUserDesignDocs(currentUser.uid);
              allDocs = [...allDocs, ...myDocs];
              
              const profile = await getUserProfile(currentUser.uid);
              if (profile?.groups && profile.groups.length > 0) {
                  const groupDocs = await getGroupDesignDocs(profile.groups);
                  allDocs = [...allDocs, ...groupDocs];
              }
          } catch (e) {
              console.warn("User docs fetch failed", e);
          }
      }

      // 3. Deduplicate by ID
      const unique = Array.from(new Map(allDocs.map(item => [item.id, item])).values());
      
      // 4. Handle System Comparison Document Visibility
      const isSystemDocHidden = localStorage.getItem('hide_system_doc_v1') === 'true';
      const systemDocs = isSystemDocHidden ? [] : [APP_COMPARISON_DOC, STACK_STORY_DOC, BUILT_WITH_DOC];
      
      const finalDocs = [...systemDocs, ...unique.filter(d => ![APP_COMPARISON_DOC.id, STACK_STORY_DOC.id, BUILT_WITH_DOC.id].includes(d.id))];
      
      setDocs(finalDocs.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt)));
    } catch (e) {
      console.error("Critical error loading document archive", e);
      setDocs([APP_COMPARISON_DOC, STACK_STORY_DOC, BUILT_WITH_DOC]);
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
      if ([APP_COMPARISON_DOC.id, STACK_STORY_DOC.id, BUILT_WITH_DOC.id].includes(id)) {
          if (confirm("Hide system example document from your library?")) { 
              localStorage.setItem('hide_system_doc_v1', 'true'); 
              loadData(); 
          }
          return;
      }
      if (!confirm("Permanently delete this document? This action cannot be undone.")) return;
      setIsDeleting(id);
      try { 
          await deleteDiscussion(id); 
          setDocs(prev => prev.filter(d => d.id !== id)); 
      } catch (err) {
          alert("Failed to delete document.");
      } finally { 
          setIsDeleting(null); 
      }
  };

  const handleCreateNew = () => { 
      if (!currentUser) {
          alert("Please sign in to create custom documents.");
          return;
      }
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
          <p className="text-xs text-slate-500 mt-1">Create and manage technical specifications and design docs.</p>
        </div>
        <button onClick={handleCreateNew} className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors text-xs font-bold shadow-lg active:scale-95">
            <Plus size={14} /><span>New Spec</span>
        </button>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-indigo-400 gap-4">
            <Loader2 className="animate-spin" size={32} />
            <span className="text-xs font-bold uppercase tracking-widest animate-pulse">Syncing Knowledge...</span>
        </div>
      ) : docs.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-500 bg-slate-900/30 rounded-3xl border-2 border-dashed border-slate-800">
            <FileText size={48} className="mb-4 opacity-10" />
            <p className="font-bold">The library is empty.</p>
            {!currentUser && <p className="text-xs mt-2">Sign in to view your private specifications.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {docs.map((doc) => {
            const isSystem = [APP_COMPARISON_DOC.id, STACK_STORY_DOC.id, BUILT_WITH_DOC.id].includes(doc.id);
            const isMyDoc = currentUser && doc.userId === currentUser.uid;
            return (
              <div 
                key={doc.id} 
                onClick={() => setSelectedDocId(doc.id)} 
                className={`bg-slate-900 border ${isSystem ? 'border-indigo-500/50 bg-indigo-900/10' : 'border-slate-800'} rounded-2xl p-5 hover:border-emerald-500/50 transition-all cursor-pointer group flex flex-col justify-between relative shadow-lg min-h-[160px]`}
              >
                {(isMyDoc || isSystem) && (
                    <button 
                        onClick={(e) => handleDelete(e, doc.id)} 
                        disabled={isDeleting === doc.id} 
                        className="absolute top-4 right-4 p-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-slate-950/50 rounded-lg"
                        title={isSystem ? "Hide System Doc" : "Delete Document"}
                    >
                        {isDeleting === doc.id ? <Loader2 size={16} className="animate-spin"/> : <Trash2 size={16} />}
                    </button>
                )}
                <div>
                  <div className="flex items-start justify-between mb-3">
                     <div className="flex items-center gap-2">
                         <div className={`p-2 rounded-lg ${isSystem ? 'bg-indigo-900/30 text-indigo-400' : 'bg-emerald-900/20 text-emerald-400'}`}>
                             {isSystem ? <ShieldCheck size={20}/> : <FileText size={20} />}
                         </div>
                     </div>
                     <span className="text-[9px] text-slate-600 font-mono bg-slate-950 px-2 py-1 rounded">
                         {new Date(doc.createdAt).toLocaleDateString()}
                     </span>
                  </div>
                  <h3 className="text-base font-bold mb-1 text-white pr-8 line-clamp-2">{doc.title || "Untitled Document"}</h3>
                </div>
                <div className="flex items-center justify-between border-t border-slate-800/50 pt-4 mt-4">
                   <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase">
                       <User size={12}/>
                       <span className="truncate max-w-[80px]">{isMyDoc ? 'Me' : doc.userName}</span>
                       {doc.visibility === 'public' && <Globe size={10} className="text-emerald-500"/>}
                   </div>
                   <button className="text-emerald-400 flex items-center gap-1 text-[10px] font-black uppercase group-hover:translate-x-1 transition-transform">
                       Open <ArrowRight size={12} />
                   </button>
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
          />
      )}
    </div>
  );
};
