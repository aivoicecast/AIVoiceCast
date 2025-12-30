
import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Check, Globe, Lock, Copy, Send, User, Loader2, Users } from 'lucide-react';
import { UserProfile } from '../types';
import { getAllUsers } from '../services/firestoreService';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShare: (selectedUids: string[], isPublic: boolean) => Promise<void>;
  link: string;
  title: string;
  currentAccess?: 'public' | 'restricted';
  currentAllowedUsers?: string[];
  currentUserUid?: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({ 
  isOpen, onClose, onShare, link, title, 
  currentAccess = 'public', currentAllowedUsers, currentUserUid 
}) => {
  const [accessLevel, setAccessLevel] = useState<'public' | 'restricted'>(currentAccess);
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  
  // Ensure we have a stable reference for allowed users to prevent unnecessary effect firing
  const stableAllowedUsers = useMemo(() => currentAllowedUsers || [], [currentAllowedUsers]);
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set(stableAllowedUsers));
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  useEffect(() => {
    if (isOpen && accessLevel === 'restricted') {
      setIsLoading(true);
      getAllUsers().then(users => {
        setAllUsers(users.filter(u => u.uid !== currentUserUid)); // Exclude self
        setIsLoading(false);
      });
    }
  }, [isOpen, accessLevel, currentUserUid]);

  // Sync access level prop changes
  useEffect(() => {
      if (isOpen) {
          setAccessLevel(currentAccess);
      }
  }, [isOpen, currentAccess]);

  // Sync allowed users prop changes
  useEffect(() => {
      if (isOpen) {
          setSelectedUids(new Set(stableAllowedUsers));
      }
  }, [isOpen, stableAllowedUsers]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const handleConfirmShare = async () => {
    setIsSharing(true);
    try {
        await onShare(Array.from(selectedUids), accessLevel === 'public');
        onClose();
    } catch (e) {
        console.error(e);
        alert("Failed to update share settings.");
    } finally {
        setIsSharing(false);
    }
  };

  const toggleUser = (uid: string) => {
      const next = new Set(selectedUids);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      setSelectedUids(next);
  };

  const filteredUsers = allUsers.filter(u => 
      u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-fade-in-up">
        
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900 shrink-0">
          <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users size={18} className="text-indigo-400" />
                  Share "{title}"
              </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-6">
            
            {/* Access Toggle */}
            <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
                <button 
                    onClick={() => setAccessLevel('public')}
                    className={`flex-1 py-2 text-sm font-bold rounded-md flex items-center justify-center gap-2 transition-colors ${accessLevel === 'public' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                >
                    <Globe size={14} /> Anyone with Link
                </button>
                <button 
                    onClick={() => setAccessLevel('restricted')}
                    className={`flex-1 py-2 text-sm font-bold rounded-md flex items-center justify-center gap-2 transition-colors ${accessLevel === 'restricted' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                >
                    <Lock size={14} /> Restricted
                </button>
            </div>

            {/* Link Copy Area */}
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Project Link</label>
                <div className="flex gap-2">
                    <div className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 truncate font-mono select-all">
                        {link}
                    </div>
                    <button 
                        onClick={handleCopy}
                        className="px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 transition-colors flex items-center justify-center"
                        title="Copy"
                    >
                        {copyFeedback ? <Check size={16} className="text-emerald-400"/> : <Copy size={16}/>}
                    </button>
                </div>
            </div>

            {/* User Selection (Restricted Only) */}
            {accessLevel === 'restricted' && (
                <div className="space-y-3 animate-fade-in">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-500 uppercase">Select Members</label>
                        <span className="text-xs text-indigo-400">{selectedUids.size} selected</span>
                    </div>
                    
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14}/>
                        <input 
                            type="text" 
                            placeholder="Search members..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                    </div>

                    <div className="border border-slate-800 rounded-xl overflow-hidden max-h-48 overflow-y-auto bg-slate-900/30">
                        {isLoading ? (
                            <div className="py-8 flex justify-center text-slate-500"><Loader2 className="animate-spin" size={20}/></div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="py-8 text-center text-slate-500 text-xs">No members found.</div>
                        ) : (
                            <div className="divide-y divide-slate-800">
                                {filteredUsers.map(user => {
                                    const isSelected = selectedUids.has(user.uid);
                                    return (
                                        <div 
                                            key={user.uid} 
                                            onClick={() => toggleUser(user.uid)}
                                            className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${isSelected ? 'bg-indigo-900/20' : 'hover:bg-slate-800/50'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
                                                    {user.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover" /> : <User size={14} className="text-slate-400"/>}
                                                </div>
                                                <div>
                                                    <p className={`text-sm font-bold ${isSelected ? 'text-indigo-300' : 'text-slate-200'}`}>{user.displayName}</p>
                                                    <p className="text-[10px] text-slate-500 truncate max-w-[150px]">{user.email}</p>
                                                </div>
                                            </div>
                                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-600'}`}>
                                                {isSelected && <Check size={12} className="text-white"/>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    <p className="text-[10px] text-slate-500">Selected members will receive a Direct Message with the link.</p>
                </div>
            )}
        </div>

        <div className="p-5 border-t border-slate-800 bg-slate-900 flex justify-end gap-3 shrink-0">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
            <button 
                onClick={handleConfirmShare}
                disabled={isSharing}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg shadow-lg flex items-center gap-2 transition-all disabled:opacity-50"
            >
                {isSharing ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>}
                <span>{accessLevel === 'restricted' ? 'Share & Invite' : 'Update Access'}</span>
            </button>
        </div>

      </div>
    </div>
  );
};
