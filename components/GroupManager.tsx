// FIXED: Using default React import to ensure JSX intrinsic elements are recognized correctly
import React, { useState, useEffect } from 'react';
import { createGroup, getUserGroups, sendInvitation, getGroupMembers, removeMemberFromGroup, deleteGroup, renameGroup } from '../services/firestoreService';
import { Group, UserProfile } from '../types';
import { auth } from '../services/firebaseConfig';
import { Users, Plus, RefreshCw, Mail, Send, Trash2, ChevronDown, ChevronUp, User, Edit2, Check, X, Loader2 } from 'lucide-react';

export const GroupManager: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Edit State
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // Invite State
  const [inviteEmails, setInviteEmails] = useState<Record<string, string>>({});
  const [inviteStatus, setInviteStatus] = useState<Record<string, string>>({});

  // Member Management State
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [groupMembers, setGroupMembers] = useState<Record<string, UserProfile[]>>({});
  const [loadingMembers, setLoadingMembers] = useState(false);

  const loadGroups = async () => {
    const currentUser = auth?.currentUser;
    if (!currentUser) return;
    setLoading(true);
    try {
      const data = await getUserGroups(currentUser.uid);
      setGroups(data);
      setError(null);
    } catch (e: any) {
      setError("Failed to load groups");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setLoading(true);
    try {
      await createGroup(newGroupName);
      setNewGroupName('');
      await loadGroups();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (groupId: string) => {
    const email = inviteEmails[groupId];
    if (!email || !email.includes('@')) {
       setInviteStatus({ ...inviteStatus, [groupId]: "Invalid email" });
       return;
    }
    
    setInviteStatus({ ...inviteStatus, [groupId]: "Sending..." });
    try {
       await sendInvitation(groupId, email);
       setInviteStatus({ ...inviteStatus, [groupId]: "Invite sent!" });
       setInviteEmails({ ...inviteEmails, [groupId]: '' });
       setTimeout(() => setInviteStatus(prev => ({ ...prev, [groupId]: '' })), 3000);
    } catch (e: any) {
       setInviteStatus({ ...inviteStatus, [groupId]: e.message });
    }
  };

  const toggleMembers = async (group: Group) => {
      if (expandedGroupId === group.id) {
          setExpandedGroupId(null);
          return;
      }
      setExpandedGroupId(group.id);
      
      // Fetch members if not already loaded or if force reload needed
      setLoadingMembers(true);
      try {
          const members = await getGroupMembers(group.memberIds);
          setGroupMembers(prev => ({ ...prev, [group.id]: members }));
      } catch(e) {
          console.error("Failed to load members", e);
      } finally {
          setLoadingMembers(false);
      }
  };

  const handleRemoveMember = async (groupId: string, memberId: string) => {
      // Safety check: Prevent owner from removing themselves
      const group = groups.find(g => g.id === groupId);
      if (group && group.ownerId === memberId) {
          alert("You cannot remove the owner from the group.");
          return;
      }

      if (!confirm("Are you sure you want to remove this member?")) return;
      try {
          await removeMemberFromGroup(groupId, memberId);
          // Update local state
          const updatedMembers = groupMembers[groupId].filter(m => m.uid !== memberId);
          setGroupMembers(prev => ({ ...prev, [groupId]: updatedMembers }));
          // Update group object locally
          setGroups(prev => prev.map(g => {
              if (g.id === groupId) {
                  return { ...g, memberIds: g.memberIds.filter(id => id !== memberId) };
              }
              return g;
          }));
      } catch(e) {
          console.error("Failed to remove member", e);
          alert("Failed to remove member.");
      }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm("Are you sure you want to delete this group? All memberships will be revoked and this action cannot be undone.")) return;
    setLoading(true);
    try {
      await deleteGroup(groupId);
      setGroups(prev => prev.filter(g => g.id !== groupId));
    } catch (e: any) {
      alert("Failed to delete group: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const startRenaming = (group: Group) => {
    setEditingGroupId(group.id);
    setEditingName(group.name);
  };

  const handleRenameGroup = async () => {
    if (!editingGroupId || !editingName.trim()) return;
    setLoading(true);
    try {
      await renameGroup(editingGroupId, editingName);
      setGroups(prev => prev.map(g => g.id === editingGroupId ? { ...g, name: editingName } : g));
      setEditingGroupId(null);
    } catch (e: any) {
      alert("Failed to rename group: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const currentUser = auth?.currentUser;

  // FIXED: Explicit usage of default React context for intrinsic elements
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-8 animate-fade-in-up">
      
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center space-x-2">
          <Users className="text-indigo-400" />
          <span>My Groups</span>
        </h2>
        <button onClick={loadGroups} className="text-slate-400 hover:text-white p-2">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 text-red-300 p-3 rounded-lg text-sm border border-red-800/50">
          {error}
        </div>
      )}

      {/* Create Group */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Create New Group</h3>
        <form onSubmit={handleCreate} className="flex space-x-2">
          <input 
            type="text" 
            placeholder="Group Name (e.g. AI Researchers)"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
          />
          <button 
            type="submit" 
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            <Plus size={20} />
          </button>
        </form>
      </div>

      <div className="space-y-4 pt-4 border-t border-slate-800">
          {groups.length === 0 ? (
              <p className="text-slate-500 text-sm italic">You don't belong to any groups yet.</p>
          ) : (
              <div className="space-y-4">
                  {groups.map(group => {
                      const isOwner = currentUser?.uid === group.ownerId;
                      const isExpanded = expandedGroupId === group.id;
                      const members = groupMembers[group.id] || [];
                      const isEditing = editingGroupId === group.id;

                      return (
                          <div key={group.id} className="bg-slate-800/30 rounded-xl border border-slate-700 overflow-hidden">
                              <div className="p-4 flex items-center justify-between">
                                  <div className="flex-1 min-w-0 pr-4">
                                      {isEditing ? (
                                          <div className="flex items-center gap-2">
                                              <input 
                                                  value={editingName} 
                                                  onChange={e => setEditingName(e.target.value)}
                                                  className="bg-slate-900 border border-indigo-500 rounded px-2 py-1 text-sm text-white outline-none w-full"
                                              />
                                              <button onClick={handleRenameGroup} className="p-1 text-emerald-400 hover:text-emerald-300"><Check size={16}/></button>
                                              <button onClick={() => setEditingGroupId(null)} className="p-1 text-red-400 hover:text-red-300"><X size={16}/></button>
                                          </div>
                                      ) : (
                                          <div className="flex items-center gap-2">
                                              <h4 className="font-bold text-white truncate">{group.name}</h4>
                                              {isOwner && <button onClick={() => startRenaming(group)} className="p-1 text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"><Edit2 size={12}/></button>}
                                          </div>
                                      )}
                                      <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">{group.memberIds.length} Members • Created {new Date(group.createdAt).toLocaleDateString()}</p>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                      <button onClick={() => toggleMembers(group)} className="p-2 text-slate-400 hover:text-white transition-colors" title="Manage Members">
                                          {isExpanded ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
                                      </button>
                                      {isOwner && (
                                          <button onClick={() => handleDeleteGroup(group.id)} className="p-2 text-slate-400 hover:text-red-400 transition-colors" title="Delete Group">
                                              <Trash2 size={18}/>
                                          </button>
                                      )}
                                  </div>
                              </div>

                              {isExpanded && (
                                  <div className="p-4 bg-slate-900/50 border-t border-slate-700 animate-fade-in-up space-y-4">
                                      {/* Invite Link */}
                                      <div className="flex gap-2">
                                          <div className="relative flex-1">
                                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14}/>
                                              <input 
                                                  type="email" 
                                                  placeholder="invite@email.com"
                                                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                                                  value={inviteEmails[group.id] || ''}
                                                  onChange={e => setInviteEmails({ ...inviteEmails, [group.id]: e.target.value })}
                                              />
                                          </div>
                                          <button 
                                              onClick={() => handleInvite(group.id)}
                                              className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                                          >
                                              <Send size={12}/> Invite
                                          </button>
                                      </div>
                                      {inviteStatus[group.id] && <p className="text-[10px] font-bold text-indigo-400 px-1">{inviteStatus[group.id]}</p>}

                                      {/* Member List */}
                                      <div className="space-y-2">
                                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Active Roster</p>
                                          <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                                              {loadingMembers ? <Loader2 size={16} className="animate-spin mx-auto my-4 text-slate-600"/> : members.map(m => (
                                                  <div key={m.uid} className="flex items-center justify-between p-2 rounded-lg bg-slate-950/50 border border-white/5 group">
                                                      <div className="flex items-center gap-2 min-w-0">
                                                          <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 shrink-0 overflow-hidden">
                                                              {m.photoURL ? <img src={m.photoURL} className="w-full h-full object-cover"/> : <User size={12}/>}
                                                          </div>
                                                          <div className="min-w-0">
                                                            <p className="text-xs font-bold text-slate-300 truncate">{m.displayName}</p>
                                                            {group.ownerId === m.uid && <p className="text-[8px] text-amber-500 font-black uppercase">Owner</p>}
                                                          </div>
                                                      </div>
                                                      {isOwner && m.uid !== group.ownerId && (
                                                          <button onClick={() => handleRemoveMember(group.id, m.uid)} className="p-1 opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all"><X size={14}/></button>
                                                      )}
                                                  </div>
                                              ))}
                                          </div>
                                      </div>
                                  </div>
                              )}
                          </div>
                      );
                  })}
              </div>
          )}
      </div>
    </div>
  );
};