
import React, { useState, useEffect } from 'react';
import { createGroup, getUserGroups, sendInvitation, getGroupMembers, removeMemberFromGroup, deleteGroup, renameGroup } from '../services/firestoreService';
import { Group, UserProfile } from '../types';
import { auth } from '../services/firebaseConfig';
import { Users, Plus, RefreshCw, Mail, Send, Trash2, ChevronDown, ChevronUp, User, Edit2, Check, X } from 'lucide-react';

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
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const data = await getUserGroups(auth.currentUser.uid);
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

      <div className="border-t border-slate-800 pt-6">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Active Memberships</h3>
        {groups.length === 0 ? (
          <p className="text-slate-500 italic text-sm">You haven't joined any groups yet. Ask a friend to invite you!</p>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {groups.map(g => (
              <div key={g.id} className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden group">
                <div className="p-5 flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex-1">
                        <div className="flex items-center space-x-3">
                            {editingGroupId === g.id ? (
                              <div className="flex items-center gap-2 flex-1">
                                <input 
                                  autoFocus
                                  type="text"
                                  className="bg-slate-900 border border-indigo-500 rounded px-3 py-1 text-white text-lg font-bold outline-none w-full"
                                  value={editingName}
                                  onChange={e => setEditingName(e.target.value)}
                                  onKeyDown={e => e.key === 'Enter' && handleRenameGroup()}
                                />
                                <button onClick={handleRenameGroup} className="p-1.5 text-emerald-400 hover:bg-emerald-400/10 rounded"><Check size={20}/></button>
                                <button onClick={() => setEditingGroupId(null)} className="p-1.5 text-slate-400 hover:bg-slate-400/10 rounded"><X size={20}/></button>
                              </div>
                            ) : (
                              <>
                                <p className="text-white font-bold text-lg">{g.name}</p>
                                {g.ownerId === auth.currentUser?.uid && (
                                  <div className="flex items-center gap-2">
                                    <span className="bg-indigo-900/50 text-indigo-400 text-[10px] px-2 py-0.5 rounded uppercase font-bold">Owner</span>
                                    <button onClick={() => startRenaming(g)} className="p-1 text-slate-500 hover:text-white transition-colors"><Edit2 size={14}/></button>
                                    <button onClick={() => handleDeleteGroup(g.id)} className="p-1 text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={14}/></button>
                                  </div>
                                )}
                              </>
                            )}
                        </div>
                        
                        <div className="flex items-center space-x-4 mt-2">
                            <div className="flex items-center space-x-1 text-slate-400 text-xs">
                                <Users size={12} />
                                <span>{g.memberIds.length} members</span>
                            </div>
                            <button 
                                onClick={() => toggleMembers(g)}
                                className="text-xs text-indigo-400 hover:text-white flex items-center space-x-1"
                            >
                                <span>{expandedGroupId === g.id ? 'Hide Members' : 'Show Members'}</span>
                                {expandedGroupId === g.id ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                            </button>
                        </div>
                    </div>

                    {/* Owner Only: Invite UI */}
                    {g.ownerId === auth.currentUser?.uid && (
                    <div className="flex flex-col space-y-2 md:w-1/2 bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                        <p className="text-[10px] text-slate-500 uppercase font-bold flex items-center space-x-1">
                            <Mail size={10} />
                            <span>Invite Member</span>
                        </p>
                        <div className="flex space-x-2">
                            <input 
                                type="email" 
                                placeholder="friend@gmail.com"
                                className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none"
                                value={inviteEmails[g.id] || ''}
                                onChange={(e) => setInviteEmails({ ...inviteEmails, [g.id]: e.target.value })}
                            />
                            <button 
                                onClick={() => handleInvite(g.id)}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white p-1.5 rounded transition-colors"
                            >
                                <Send size={14} />
                            </button>
                        </div>
                        {inviteStatus[g.id] && (
                            <p className={`text-[10px] ${inviteStatus[g.id].includes('sent') ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {inviteStatus[g.id]}
                            </p>
                        )}
                    </div>
                    )}
                </div>

                {/* Member List */}
                {expandedGroupId === g.id && (
                    <div className="bg-slate-950/30 border-t border-slate-700/50 p-4 animate-fade-in">
                        {loadingMembers ? (
                            <p className="text-xs text-slate-500 text-center">Loading profiles...</p>
                        ) : (
                            <div className="space-y-2">
                                {(groupMembers[g.id] || []).map(member => (
                                    <div key={member.uid} className="flex items-center justify-between p-2 rounded hover:bg-slate-800/30">
                                        <div className="flex items-center space-x-3">
                                            {member.photoURL ? (
                                                <img src={member.photoURL} alt={member.displayName} className="w-6 h-6 rounded-full border border-slate-600" />
                                            ) : (
                                                <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-slate-400">
                                                    <User size={12} />
                                                </div>
                                            )}
                                            <div>
                                                <p className="text-sm text-slate-300 font-medium flex items-center space-x-2">
                                                    <span>{member.displayName}</span>
                                                    {member.uid === g.ownerId && <span className="text-[10px] text-indigo-400 border border-indigo-900 px-1 rounded">OWNER</span>}
                                                </p>
                                                {/* Privacy: Only Owner sees actual emails */}
                                                <p className="text-[10px] text-slate-500">
                                                    {g.ownerId === auth.currentUser?.uid ? member.email : 'Member (Email Hidden)'}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        {/* Remove Button (Owner only, cannot remove self) */}
                                        {g.ownerId === auth.currentUser?.uid && member.uid !== g.ownerId && (
                                            <button 
                                                onClick={() => handleRemoveMember(g.id, member.uid)}
                                                className="text-slate-600 hover:text-red-400 p-1.5 rounded hover:bg-slate-800 transition-colors"
                                                title="Remove Member"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
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
  );
};
