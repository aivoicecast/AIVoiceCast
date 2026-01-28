
import React, { useState, useEffect, useMemo } from 'react';
import { UserFeedback, UserProfile } from '../types';
import { getAllFeedback, updateFeedbackStatus, isUserAdmin, getUserProfile } from '../services/firestoreService';
import { auth } from '../services/firebaseConfig';
import { 
  ArrowLeft, MessageSquare, Terminal, Clock, User, 
  CheckCircle, XCircle, Loader2, AlertCircle, Sparkles, 
  Bug, Zap, Filter, Search, ChevronRight, Activity, 
  Database, ShieldCheck, RefreshCw, Send, Trash2
} from 'lucide-react';
import { MarkdownView } from './MarkdownView';

interface FeedbackManagerProps {
  onBack: () => void;
  userProfile: UserProfile | null;
}

export const FeedbackManager: React.FC<FeedbackManagerProps> = ({ onBack, userProfile }) => {
  const [feedbacks, setFeedbacks] = useState<UserFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'bug' | 'feature' | 'general'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const isAdmin = useMemo(() => {
    const currentUser = auth?.currentUser;
    if (!currentUser) return false;
    return currentUser.email === 'shengliang.song.ai@gmail.com' || isUserAdmin(userProfile);
  }, [userProfile]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getAllFeedback();
      setFeedbacks(data);
      if (data.length > 0 && !activeId) setActiveId(data[0].id);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin]);

  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter(f => {
      const matchesType = filterType === 'all' || f.type === filterType;
      const matchesSearch = f.userName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          f.message.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [feedbacks, filterType, searchQuery]);

  const selectedFeedback = useMemo(() => 
    feedbacks.find(f => f.id === activeId), 
  [feedbacks, activeId]);

  const handleUpdateStatus = async (id: string, status: UserFeedback['status']) => {
    setUpdatingId(id);
    try {
      await updateFeedbackStatus(id, status);
      setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, status } : f));
    } catch (e) {
      alert("Status update failed.");
    } finally {
      setUpdatingId(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="h-full flex items-center justify-center p-6 bg-slate-950">
        <div className="text-center space-y-4">
          <ShieldCheck size={64} className="text-red-500 mx-auto opacity-20" />
          <h2 className="text-xl font-bold text-white uppercase tracking-widest">Access Denied</h2>
          <p className="text-slate-500">Feedback Vault restricted to Neural Architects.</p>
          <button onClick={onBack} className="text-indigo-400 hover:underline">Return to Hub</button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-20">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"><ArrowLeft size={20} /></button>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2 italic uppercase tracking-tighter"><Zap size={20} className="text-indigo-400" /> Feedback Vault</h1>
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Self-Enhancement Registry</p>
          </div>
        </div>
        <button onClick={loadData} className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 transition-all hover:text-white">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-96 border-r border-slate-800 bg-slate-900/30 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-800 space-y-3 bg-slate-950/40">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14}/>
              <input 
                type="text" 
                placeholder="Search reports..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="flex gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
              {(['all', 'bug', 'feature'] as const).map(t => (
                <button 
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`flex-1 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${filterType === t ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-800 scrollbar-hide">
            {loading && feedbacks.length === 0 ? (
              <div className="py-20 flex flex-col items-center gap-4">
                <Loader2 className="animate-spin text-indigo-500" size={32} />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Syncing Ledger...</span>
              </div>
            ) : filteredFeedbacks.length === 0 ? (
              <div className="py-20 text-center text-slate-700 italic text-sm">No reports in current spectrum.</div>
            ) : (
              filteredFeedbacks.map(f => (
                <button 
                  key={f.id}
                  onClick={() => setActiveId(f.id)}
                  className={`w-full text-left p-5 transition-all relative border-l-4 ${activeId === f.id ? 'bg-indigo-900/10 border-indigo-500' : 'border-transparent hover:bg-slate-800/40'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${
                        f.type === 'bug' ? 'bg-red-900/20 text-red-400 border-red-500/20' :
                        f.type === 'feature' ? 'bg-emerald-900/20 text-emerald-400 border-emerald-500/20' :
                        'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {f.type}
                      </span>
                      <span className={`text-[8px] font-black uppercase ${
                        f.status === 'open' ? 'text-amber-500' : 
                        f.status === 'refracted' ? 'text-indigo-400' : 
                        'text-slate-600'
                      }`}>
                        {f.status}
                      </span>
                    </div>
                    <span className="text-[9px] font-mono text-slate-600">{new Date(f.timestamp).toLocaleDateString()}</span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-200 line-clamp-1">{f.message}</h4>
                  <p className="text-[10px] text-slate-500 mt-1 uppercase font-black">@{f.userName}</p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Main Panel */}
        <div className="flex-1 flex flex-col min-w-0 bg-black/20">
          {selectedFeedback ? (
            <div className="flex-1 overflow-y-auto p-10 space-y-12 scrollbar-thin scrollbar-thumb-slate-800">
              <div className="space-y-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">Report Feedback</h2>
                    <div className="flex items-center gap-4 text-xs font-medium text-slate-500 uppercase tracking-widest">
                       <span className="flex items-center gap-1.5"><User size={14} className="text-indigo-400"/> @{selectedFeedback.userName}</span>
                       <span className="flex items-center gap-1.5"><Clock size={14} className="text-indigo-400"/> {new Date(selectedFeedback.timestamp).toLocaleString()}</span>
                       <span className="flex items-center gap-1.5 font-mono text-[10px]">View: {selectedFeedback.viewId}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                     <button 
                        onClick={() => handleUpdateStatus(selectedFeedback.id, 'refracted')}
                        disabled={updatingId === selectedFeedback.id}
                        className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedFeedback.status === 'refracted' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'}`}
                      >
                       {updatingId === selectedFeedback.id ? <Loader2 size={12} className="animate-spin"/> : <CheckCircle size={12} className="inline mr-2"/>}
                       Refracted
                     </button>
                     <button 
                        onClick={() => handleUpdateStatus(selectedFeedback.id, 'closed')}
                        disabled={updatingId === selectedFeedback.id}
                        className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedFeedback.status === 'closed' ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'}`}
                      >
                       {updatingId === selectedFeedback.id ? <Loader2 size={12} className="animate-spin"/> : <XCircle size={12} className="inline mr-2"/>}
                       Close
                     </button>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] shadow-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-24 bg-indigo-500/5 blur-[100px] rounded-full"></div>
                  <p className="text-lg text-slate-200 leading-relaxed font-medium relative z-10">
                    "{selectedFeedback.message}"
                  </p>
                </div>
              </div>

              {/* Neural Trace Log Section */}
              <div className="space-y-6">
                 <h3 className="text-xs font-black text-indigo-400 uppercase tracking-[0.4em] flex items-center gap-3">
                    <Terminal size={18}/> Neural Diagnostic Trace (BUNBLED)
                 </h3>
                 <div className="bg-black/60 border border-indigo-500/20 rounded-[2.5rem] p-8 font-mono text-[11px] space-y-2 overflow-x-auto shadow-inner min-h-[300px]">
                    {selectedFeedback.logs && selectedFeedback.logs.length > 0 ? (
                      selectedFeedback.logs.map((log: any, i: number) => (
                        <div key={i} className="flex gap-4 p-2 rounded hover:bg-white/5 transition-colors group">
                           <span className="text-slate-600 shrink-0">[{log.time}]</span>
                           <span className={`flex-1 ${
                             log.type === 'error' ? 'text-red-400' : 
                             log.type === 'success' ? 'text-emerald-400' : 
                             log.type === 'warn' ? 'text-amber-400' : 'text-slate-400'
                           }`}>
                             {log.text}
                           </span>
                        </div>
                      ))
                    ) : (
                      <div className="py-20 text-center text-slate-700 italic">No diagnostic trace was bundled with this report.</div>
                    )}
                 </div>
                 <p className="text-[10px] text-slate-600 text-center uppercase font-black tracking-widest">End of Trace Ledgers</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-700">
               <div className="p-12 border-2 border-dashed border-slate-800 rounded-[4rem] flex flex-col items-center gap-6 animate-pulse">
                  <Activity size={64} className="opacity-10"/>
                  <div className="text-center space-y-2">
                    <h3 className="text-xl font-bold uppercase tracking-widest text-slate-500">Vault Idle</h3>
                    <p className="text-xs text-slate-600">Select a submission to begin neural refraction.</p>
                  </div>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeedbackManager;
