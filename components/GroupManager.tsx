
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createGroup, getUserGroups, getPublicGroups, joinGroup, sendInvitation, getGroupMembers, removeMemberFromGroup, deleteGroup, renameGroup, isUserAdmin } from '../services/firestoreService';
import { Group, UserProfile } from '../types';
import { auth } from '../services/firebaseConfig';
import { 
  Users, Plus, RefreshCw, Mail, Send, Trash2, ChevronDown, ChevronUp, User, 
  Edit2, Check, X, ShieldCheck, UserMinus, Loader2, Globe, Lock, Search, 
  Compass, LogIn, Activity, Database, ShieldAlert, Zap, RefreshCcw, 
  Info, Bug, AlertCircle, Cpu, Fingerprint, Sparkles, Filter, Power
} from 'lucide-react';

// --- PERSISTENT MODULE-LEVEL REGISTRY ---
// This lives outside the React lifecycle. It cannot be cleared by re-renders or unmounts.
const GLOBAL_SYNC_REGISTRY = new Map<string, number>();

interface GroupManagerProps {
  currentUser: any;
  userProfile: UserProfile | null;
}

export const GroupManager: React.FC<GroupManagerProps> = ({ currentUser, userProfile }) => {
  const [activeTab, setActiveTab] = useState<'my' | 'discover'>('my');
  const [groups, setGroups] = useState<Group[]>([]);
  const [publicGroups, setPublicGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupVisibility, setNewGroupVisibility] = useState<'public' | 'private'>('public');
  const [error, setError] = useState<string | null>(null);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  const isMountedRef = useRef<boolean>(true);

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [inviteEmails, setInviteEmails] = useState<Record<string, string>>({});
  const [inviteStatus, setInviteStatus] = useState<Record<string, { msg: string, type: 'success' | 'error' | 'loading' }>>({});
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [groupMembers, setGroupMembers] = useState<Record<string, UserProfile[]>>({});
  const [loadingMembers, setLoadingMembers] = useState(false);

  const uid = currentUser?.uid;

  const isAdmin = useMemo(() => {
      return currentUser?.email === 'shengliang.song.ai@gmail.com' || isUserAdmin(userProfile);
  }, [currentUser?.email, userProfile]);

  const dispatchLog = useCallback((text: string, type: 'info' | 'error' | 'success' | 'warn' = 'info') => {
      window.requestAnimationFrame(() => {
          window.dispatchEvent(new CustomEvent('neural-log', { 
              detail: { text: `[Communities] ${text}`, type } 
          }));
      });
  }, []);

  const runSync = useCallback(async (forced: boolean = false) => {
    if (!uid) return;
    
    const requestKey = `${uid}-${activeTab}`;
    const now = Date.now();
    const lastFetch = GLOBAL_SYNC_REGISTRY.get(requestKey) || 0;
    
    // CRITICAL GUARD: Only fetch if forced or if it's been more than 5 seconds since the last attempt.
    // This prevents "Double-Trigger" re-renders from starting a new network request.
    if (!forced && (now - lastFetch < 5000)) {
        return;
    }

    // LOCK: Register the timestamp immediately (Global Scope)
    GLOBAL_SYNC_REGISTRY.set(requestKey, now);
    
    setLoading(true);
    setError(null);

    dispatchLog(activeTab === 'my' ? `Syncing membership registry for ${uid.substring(0,8)}...` : "Polling Global Spectrum for public nodes...", "info");

    try {
        if (activeTab === 'my') {
            const data = await getUserGroups(uid);
            if (isMountedRef.current) {
                setGroups(data);
                setInitialLoadDone(true);
                dispatchLog(`Sync Complete: ${data.length} memberships verified.`, "success");
            }
        } else {
            const data = await getPublicGroups(uid);
            if (isMountedRef.current) {
                setPublicGroups(data);
                setInitialLoadDone(true);
                dispatchLog(`Spectrum Poll Complete: ${data.length} discoverable nodes.`, "success");
            }
        }
    } catch (e: any) {
        if (isMountedRef.current) {
            setError(e.message);
            dispatchLog(`Registry Sync Error: ${e.message}`, "error");
        }
        GLOBAL_SYNC_REGISTRY.delete(requestKey);
    } finally {
        if (isMountedRef.current) {
            setLoading(false);
        }
    }
  }, [uid, activeTab, dispatchLog]);

  useEffect(() => {
    isMountedRef.current = true;
    runSync();
    return () => {
        isMountedRef.current = false;
    };
  }, [runSync]);

  const handleManualRefresh = () => {
      const requestKey = `${uid}-${activeTab}`;
      GLOBAL_SYNC_REGISTRY.delete(requestKey);
      runSync(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !uid || loading) return;
    setLoading(true);
    try {
      await createGroup(newGroupName, newGroupVisibility);
      setNewGroupName('');
      dispatchLog(`Node fabricated: ${newGroupName}`, "success");
      const requestKey = `${uid}-my`;
      GLOBAL_SYNC_REGISTRY.delete(requestKey);
      setActiveTab('my');
      runSync(true);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  const handleJoinGroup = async (groupId: string) => {
      if (!uid || loading) return;
      setLoading(true);
      try {
          await joinGroup(groupId);
          dispatchLog(`Membership confirmed for node ${groupId.substring(0,8)}`, "success");
          const requestKey = `${uid}-my`;
          GLOBAL_SYNC_REGISTRY.delete(requestKey);
          setActiveTab('my');
          runSync(true);
      } catch (e: any) {
          alert("Join failed.");
          setLoading(false);
      }
  };

  const handleInvite = async (groupId: string) => {
    const email = inviteEmails[groupId];
    if (!email || !email.includes('@')) {
       setInviteStatus({ ...inviteStatus, [groupId]: { msg: "Invalid email", type: 'error' } });
       return;
    }
    setInviteStatus({ ...inviteStatus, [groupId]: { msg: "Dispatching...", type: 'loading' } });
    try {
       await sendInvitation(groupId, email);
       setInviteStatus({ ...inviteStatus, [groupId]: { msg: "Verified & Sent", type: 'success' } });
       setInviteEmails({ ...inviteEmails, [groupId]: '' });
       setTimeout(() => {
           if (isMountedRef.current) {
               setInviteStatus(prev => {
                   const next = { ...prev };
                   delete next[groupId];
                   return next;
               });
           }
       }, 3000);
    } catch (e: any) {
       setInviteStatus({ ...inviteStatus, [groupId]: { msg: e.message, type: 'error' } });
    }
  };

  const toggleMembers = async (group: Group) => {
      if (expandedGroupId === group.id) { setExpandedGroupId(null); return; }
      setExpandedGroupId(group.id);
      setLoadingMembers(true);
      try {
          const members = await getGroupMembers(group.memberIds);
          if (isMountedRef.current) {
              setGroupMembers(prev => ({ ...prev, [group.id]: members }));
          }
      } catch(e: any) {
          console.error(e);
      } finally {
          if (isMountedRef.current) setLoadingMembers(false);
      }
  };

  const handleRenameGroup = async () => {
    if (!editingGroupId || !editingName.trim() || loading) return;
    setLoading(true);
    try {
        await renameGroup(editingGroupId, editingName.trim());
        setGroups(prev => prev.map(g => g.id === editingGroupId ? { ...g, name: editingName.trim() } : g));
        setEditingGroupId(null);
    } catch (e: any) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  const recommendedGroups = useMemo(() => {
      if (!userProfile?.interests || userProfile.interests.length === 0) return [];
      const interests = userProfile.interests.map(i => i.toLowerCase());
      return publicGroups.filter(g => 
          interests.some(interest => (g.name || '').toLowerCase().includes(interest))
      ).slice(0, 3);
  }, [publicGroups, userProfile?.interests]);

  return (
    <div className="h-full w-full bg-slate-950 flex flex-col overflow-hidden relative font-sans text-left">
        <div className="flex-1 overflow-y-auto scrollbar-hide pb-40">
            <div className="max-w-4xl mx-auto w-full px-6 pt-10 space-y-10 animate-fade-in-up">
                
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-2">
                        <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase flex items-center gap-4">
                            <Users className="text-indigo-500" size={48} /> 
                            Communities
                        </h1>
                        <p className="text-slate-400 font-medium max-w-xl text-lg leading-relaxed">Collaborative nodes for technical research and shared intelligence.</p>
                    </div>
                    <div className="flex bg-slate-900 rounded-[1.5rem] p-1.5 border border-slate-800 shadow-2xl">
                        <button onClick={() => setActiveTab('my')} className={`px-8 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'my' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500 hover:text-white'}`}>My Registry</button>
                        <button onClick={() => setActiveTab('discover')} className={`px-8 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'discover' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500 hover:text-white'}`}>Discovery</button>
                    </div>
                </div>

                {uid && activeTab === 'discover' && recommendedGroups.length > 0 && (
                    <div className="space-y-4 animate-fade-in">
                        <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] px-2 flex items-center gap-2">
                            <Sparkles size={14} className="animate-pulse"/> Suggested for your profile
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {recommendedGroups.map(g => (
                                <div key={g.id} className="bg-indigo-900/10 border border-indigo-500/30 p-5 rounded-[2rem] hover:bg-indigo-900/20 transition-all group relative overflow-hidden">
                                    <div className="relative z-10">
                                        <h4 className="font-bold text-white uppercase tracking-tight line-clamp-1">{g.name}</h4>
                                        <p className="text-[9px] text-slate-500 mt-1 uppercase font-black">{g.memberIds.length} Members</p>
                                        <button onClick={() => handleJoinGroup(g.id)} className="mt-4 w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">Join Node</button>
                                    </div>
                                    <div className="absolute top-0 right-0 p-8 bg-indigo-400/5 blur-2xl rounded-full group-hover:bg-indigo-400/10 transition-all"></div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {uid && (
                    <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 md:p-10 shadow-2xl space-y-8 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-16 bg-indigo-500/5 blur-[80px] rounded-full pointer-events-none group-hover:bg-indigo-500/10 transition-colors"></div>
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] flex items-center gap-2">
                            <Plus size={16} className="text-indigo-500"/> Initiate New Collective
                        </h3>
                        <form onSubmit={handleCreate} className="space-y-6 relative z-10">
                            <div className="flex flex-col sm:flex-row gap-4">
                                <input 
                                    type="text" 
                                    placeholder="Enter Registry Name..."
                                    className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-6 py-5 text-white text-lg font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-inner transition-all"
                                    value={newGroupName}
                                    onChange={e => setNewGroupName(e.target.value)}
                                />
                                <button 
                                    type="submit" 
                                    disabled={loading || !newGroupName.trim()}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-5 rounded-2xl font-black uppercase tracking-[0.2em] transition-all disabled:opacity-50 active:scale-95 shadow-2xl shadow-indigo-900/40 flex items-center justify-center gap-2"
                                >
                                    {loading ? <Loader2 className="animate-spin" size={24}/> : <Zap size={20}/>}
                                    <span>Create</span>
                                </button>
                            </div>
                            <div className="flex gap-6 px-2">
                                <button type="button" onClick={() => setNewGroupVisibility('public')} className={`flex items-center gap-2.5 text-[11px] font-black uppercase tracking-widest transition-colors ${newGroupVisibility === 'public' ? 'text-indigo-400' : 'text-slate-600 hover:text-slate-400'}`}>
                                    <div className={`w-3 h-3 rounded-full border-2 ${newGroupVisibility === 'public' ? 'bg-indigo-500 border-indigo-400' : 'border-slate-700'}`}></div>
                                    <Globe size={16}/> Public Node
                                </button>
                                <button type="button" onClick={() => setNewGroupVisibility('private')} className={`flex items-center gap-2.5 text-[11px] font-black uppercase tracking-widest transition-colors ${newGroupVisibility === 'private' ? 'text-indigo-400' : 'text-slate-600 hover:text-slate-400'}`}>
                                    <div className={`w-3 h-3 rounded-full border-2 ${newGroupVisibility === 'private' ? 'bg-indigo-500 border-indigo-400' : 'border-slate-700'}`}></div>
                                    <Lock size={16}/> Private Vault
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="space-y-6">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] px-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-px bg-slate-800"></div>
                            {activeTab === 'my' ? 'Active Memberships' : 'Community Spectrum'}
                        </div>
                        <button onClick={handleManualRefresh} className="p-1 hover:bg-slate-800 rounded text-slate-600 hover:text-indigo-400 transition-colors">
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </h3>

                    {loading && !initialLoadDone ? (
                        <div className="py-32 flex flex-col items-center justify-center gap-6 text-indigo-400 text-center">
                            <div className="relative">
                                <div className="w-16 h-16 border-4 border-indigo-500/10 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] animate-pulse">Syncing Neural Ledger...</span>
                            <div className="flex gap-4">
                                <button onClick={handleManualRefresh} className="text-[9px] font-bold text-slate-500 hover:text-white uppercase tracking-widest flex items-center gap-2 mt-4">
                                    <RefreshCcw size={12}/> Break Lock & Retry
                                </button>
                                <button onClick={() => window.location.reload()} className="text-[9px] font-bold text-slate-500 hover:text-red-400 uppercase tracking-widest flex items-center gap-2 mt-4">
                                    <Power size={12}/> Hard Reset
                                </button>
                            </div>
                        </div>
                    ) : (
                    <div className="grid grid-cols-1 gap-6 relative">
                        {loading && (
                            <div className="absolute top-0 right-0 p-4 z-20">
                                <Loader2 className="animate-spin text-indigo-500" size={24}/>
                            </div>
                        )}
                        {(activeTab === 'my' ? groups : publicGroups).map(g => (
                        <div key={g.id} className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden transition-all hover:border-indigo-500/40 shadow-xl group/card animate-fade-in-up relative">
                            <div className="p-8 md:p-10 flex flex-col md:flex-row justify-between gap-8">
                                <div className="flex-1">
                                    <div className="flex items-center gap-4">
                                        {editingGroupId === g.id ? (
                                            <div className="flex items-center gap-3 flex-1 animate-fade-in bg-slate-950 p-2 rounded-2xl border border-indigo-500/50">
                                                <input autoFocus type="text" className="bg-transparent px-4 py-2 text-white text-xl font-bold outline-none w-full" value={editingName} onChange={e => setEditingName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleRenameGroup()} />
                                                <div className="flex gap-1"><button onClick={handleRenameGroup} className="p-2 text-emerald-400 hover:bg-emerald-400/10 rounded-xl transition-colors"><Check size={24}/></button><button onClick={() => setEditingGroupId(null)} className="p-2 text-slate-400 hover:bg-slate-800 rounded-xl transition-colors"><X size={24}/></button></div>
                                            </div>
                                        ) : (
                                            <>
                                                <h4 className="text-white font-black text-3xl italic tracking-tighter uppercase leading-none">{g.name}</h4>
                                                {uid && (g.ownerId === uid || isAdmin) && activeTab === 'my' && (
                                                    <div className="flex items-center gap-1.5 ml-2">
                                                        <div className="bg-indigo-600/20 text-indigo-400 text-[8px] font-black border border-indigo-500/30 px-2 py-0.5 rounded uppercase tracking-widest shadow-lg">Owner</div>
                                                        <button onClick={() => { setEditingGroupId(g.id); setEditingName(g.name); }} className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-xl transition-all"><Edit2 size={16}/></button>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-6 mt-6">
                                        <div className="flex items-center gap-2 text-slate-500 text-[10px] font-black uppercase tracking-widest"><Users size={16} className="text-indigo-500" /><span>{g.memberIds.length} members</span></div>
                                        <div className="flex items-center gap-2 text-[9px] font-black uppercase text-slate-600 tracking-widest">{g.visibility === 'public' ? <Globe size={14}/> : <Lock size={14}/>}<span>{g.visibility || 'private'} Collective</span></div>
                                        {activeTab === 'my' && <button onClick={() => toggleMembers(g)} className="text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-white flex items-center gap-2 transition-colors py-1 px-3 bg-indigo-600/10 rounded-lg border border-indigo-500/20"><span>{expandedGroupId === g.id ? 'Close Directory' : 'View Directory'}</span>{expandedGroupId === g.id ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</button>}
                                    </div>
                                </div>
                                {activeTab === 'discover' && (
                                    <div className="flex items-center shrink-0">
                                        <button onClick={() => handleJoinGroup(g.id)} className="px-10 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-900/40 transition-all active:scale-95 flex items-center gap-3"><Plus size={20}/> Join Collective</button>
                                    </div>
                                )}
                                {activeTab === 'my' && uid && g.ownerId === uid && (
                                    <div className="flex flex-col space-y-3 md:w-[300px] bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-inner group/invite">
                                        <p className="text-[9px] text-slate-500 uppercase font-black flex items-center gap-2"><Mail size={12} className="text-indigo-400" /><span>Dispatch Invitation</span></p>
                                        <div className="flex gap-2">
                                            <input type="email" placeholder="member@gmail.com" className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" value={inviteEmails[g.id] || ''} onChange={(e) => setInviteEmails({ ...inviteEmails, [g.id]: e.target.value })} />
                                            <button onClick={() => handleInvite(g.id)} className="bg-indigo-600 hover:bg-indigo-500 text-white p-2.5 rounded-xl transition-all shadow-xl active:scale-95 flex items-center justify-center"><Send size={18} /></button>
                                        </div>
                                        {inviteStatus[g.id] && <p className={`text-[10px] font-black uppercase tracking-tighter mt-1 ${inviteStatus[g.id].type === 'success' ? 'text-emerald-400' : inviteStatus[g.id].type === 'error' ? 'text-red-400' : 'text-indigo-400 animate-pulse'}`}>{inviteStatus[g.id].msg}</p>}
                                    </div>
                                )}
                            </div>

                            {activeTab === 'my' && expandedGroupId === g.id && (
                                <div className="bg-slate-950/50 border-t border-slate-800 p-8 animate-fade-in-up">
                                    <div className="flex flex-col sm:flex-row justify-between items-center gap-6 mb-6">
                                        <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] flex items-center gap-2"><Fingerprint size={14} className="text-indigo-400"/> Node Registry Archive</h5>
                                        <div className="relative w-full sm:w-64">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14}/>
                                            <input type="text" placeholder="Search registry..." value={memberSearchQuery} onChange={e => setMemberSearchQuery(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-[10px] text-white outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner" />
                                        </div>
                                    </div>
                                    {loadingMembers ? (
                                        <div className="py-12 flex flex-col items-center gap-4 text-center"><Loader2 className="animate-spin text-indigo-500" size={32}/><p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em]">Paging Registry...</p></div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {(groupMembers[g.id] || []).filter(m => (m.displayName || '').toLowerCase().includes(memberSearchQuery.toLowerCase())).map(member => (
                                                <div key={member.uid} className="flex items-center justify-between p-4 rounded-2xl bg-slate-900/40 border border-slate-800/50 hover:bg-slate-900 transition-all group/member">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-black text-indigo-400 shadow-lg uppercase">{member.photoURL ? <img src={member.photoURL} alt={member.displayName} className="w-full h-full object-cover rounded-xl" /> : (member.displayName || 'U')[0]}</div>
                                                        <div className="text-left"><div className="flex items-center gap-2"><p className="text-sm font-black text-slate-200 uppercase tracking-tight">@{member.displayName}</p>{member.uid === g.ownerId && <ShieldCheck size={14} className="text-indigo-400" />}</div><p className="text-[9px] text-slate-600 font-mono uppercase tracking-tighter">{uid && g.ownerId === uid ? member.email : `Ref: ${member.uid.substring(0,12)}`}</p></div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        ))}
                    </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};
