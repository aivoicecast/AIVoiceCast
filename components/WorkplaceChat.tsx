
import React, { useState, useEffect, useRef } from 'react';
import { ChatChannel, RealTimeMessage, Group, UserProfile } from '../types';
import { sendMessage, subscribeToMessages, getUserGroups, getAllUsers, createOrGetDMChannel, getUserDMChannels, getUniqueGroupMembers, deleteMessage, uploadFileToStorage } from '../services/firestoreService';
import { auth } from '../services/firebaseConfig';
import { Send, Hash, Lock, User, Plus, Search, MessageSquare, MoreVertical, Paperclip, Loader2, ArrowLeft, Menu, Users, Briefcase, Reply, Trash2, X, FileText, Image as ImageIcon, Video, CheckCircle } from 'lucide-react';

interface WorkplaceChatProps {
  onBack: () => void;
  currentUser: any;
  initialChannelId?: string | null;
}

export const WorkplaceChat: React.FC<WorkplaceChatProps> = ({ onBack, currentUser, initialChannelId }) => {
  const [activeChannelId, setActiveChannelId] = useState<string>('general');
  const [activeChannelType, setActiveChannelType] = useState<'public' | 'group' | 'dm'>('public');
  const [activeChannelName, setActiveChannelName] = useState<string>('General');
  
  const [messages, setMessages] = useState<RealTimeMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  
  const [groups, setGroups] = useState<Group[]>([]);
  const [dms, setDms] = useState<ChatChannel[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  
  const [replyingTo, setReplyingTo] = useState<RealTimeMessage | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  
  // Attachments State
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Helper to render text with clickable links
  const renderMessageText = (text: string) => {
      if (!text) return null;
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      return text.split(urlRegex).map((part, index) => {
          if (part.match(urlRegex)) {
              return (
                  <a
                      key={index}
                      href={part}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-300 hover:text-white underline break-all font-medium z-10 relative"
                      onClick={(e) => e.stopPropagation()}
                  >
                      {part}
                  </a>
              );
          }
          return part;
      });
  };

  useEffect(() => {
    if (currentUser) {
      getUserGroups(currentUser.uid).then(setGroups);
      getUserDMChannels().then(dmData => {
          setDms(dmData);
          // If deep link provided, switch to it
          if (initialChannelId) {
              const target = dmData.find(d => d.id === initialChannelId);
              if (target) {
                  setActiveChannelId(target.id);
                  setActiveChannelType(target.type as any);
                  setActiveChannelName(target.name.replace(currentUser?.displayName || '', '').replace('&', '').trim() || 'Chat');
                  
                  // On mobile, close sidebar if deep linked
                  if (window.innerWidth < 768) setIsSidebarOpen(false);
              }
          }
      });
      getAllUsers().then(users => setAllUsers(users.filter(u => u.uid !== currentUser.uid)));
    }
  }, [currentUser, initialChannelId]);

  useEffect(() => {
    let collectionPath;
    if (activeChannelType === 'group') {
        collectionPath = `groups/${activeChannelId}/messages`;
    } else {
        collectionPath = `chat_channels/${activeChannelId}/messages`;
    }

    const unsubscribe = subscribeToMessages(activeChannelId, (msgs) => {
        setMessages(msgs);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, collectionPath);

    return () => unsubscribe();
  }, [activeChannelId, activeChannelType]);

  useEffect(() => {
      setReplyingTo(null);
      setSelectedMessageId(null);
      setSelectedFiles([]);
      setFilePreviews([]);
  }, [activeChannelId]);

  // Clean up object URLs to avoid memory leaks
  useEffect(() => {
      return () => {
          filePreviews.forEach(url => URL.revokeObjectURL(url));
      };
  }, [filePreviews]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const newFiles: File[] = Array.from(e.target.files);
          setSelectedFiles(prev => [...prev, ...newFiles]);
          
          // Generate previews immediately
          const newPreviews = newFiles.map(file => URL.createObjectURL(file));
          setFilePreviews(prev => [...prev, ...newPreviews]);
      }
      e.target.value = ''; // Reset input to allow re-selection
  };

  const removeAttachment = (index: number) => {
      setSelectedFiles(prev => prev.filter((_, i) => i !== index));
      
      // Clean up the specific URL being removed
      URL.revokeObjectURL(filePreviews[index]);
      setFilePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newMessage.trim() && selectedFiles.length === 0) return;

    let collectionPath;
    if (activeChannelType === 'group') {
        collectionPath = `groups/${activeChannelId}/messages`;
    } else {
        collectionPath = `chat_channels/${activeChannelId}/messages`;
    }

    setIsUploading(true);
    const attachmentData = [];

    try {
        for (const file of selectedFiles) {
             const path = `chat_attachments/${activeChannelId}/${Date.now()}_${file.name}`;
             const url = await uploadFileToStorage(path, file);
             
             let type = 'file';
             if (file.type.startsWith('image/')) type = 'image';
             else if (file.type.startsWith('video/')) type = 'video';
             
             attachmentData.push({ type, url, name: file.name });
        }

        let replyData = undefined;
        if (replyingTo) {
            replyData = {
                id: replyingTo.id,
                text: replyingTo.text,
                senderName: replyingTo.senderName
            };
        }

        await sendMessage(activeChannelId, newMessage, collectionPath, replyData, attachmentData);
        setNewMessage('');
        setReplyingTo(null);
        setSelectedFiles([]);
        setFilePreviews([]);
    } catch (error) {
        console.error("Send failed", error);
        alert("Failed to send message. Please try again.");
    } finally {
        setIsUploading(false);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
      if (!confirm("Unsend this message?")) return;
      
      let collectionPath;
      if (activeChannelType === 'group') {
          collectionPath = `groups/${activeChannelId}/messages`;
      } else {
          collectionPath = `chat_channels/${activeChannelId}/messages`;
      }

      try {
          await deleteMessage(activeChannelId, msgId, collectionPath);
      } catch (error) {
          console.error("Delete failed", error);
          alert("Failed to delete message.");
      }
  };

  const handleStartDM = async (otherUserId: string, otherUserName: string) => {
      try {
          const channelId = await createOrGetDMChannel(otherUserId, otherUserName);
          const updatedDMs = await getUserDMChannels();
          setDms(updatedDMs);
          
          setActiveChannelId(channelId);
          setActiveChannelName(otherUserName);
          setActiveChannelType('dm');
          setIsSearchingUsers(false);
          if (window.innerWidth < 768) setIsSidebarOpen(false);
      } catch (error) {
          console.error("DM creation failed", error);
      }
  };

  // Only filter by name/email but DO NOT display email in UI
  const filteredUsers = allUsers.filter(u => 
      u.displayName.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
      u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full bg-slate-950 text-slate-100 overflow-hidden">
      
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-0'} bg-slate-900 border-r border-slate-800 flex-shrink-0 transition-all duration-300 flex flex-col overflow-hidden`}>
          <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
              <h2 className="font-bold text-lg text-white flex items-center gap-2">
                  <MessageSquare className="text-indigo-400" size={20} />
                  Workspace
              </h2>
              <button onClick={onBack} className="p-1 hover:bg-slate-800 rounded text-slate-400">
                  <ArrowLeft size={18} />
              </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-6">
              <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">Channels</h3>
                  <div className="space-y-0.5">
                      <button onClick={() => { setActiveChannelId('general'); setActiveChannelType('public'); setActiveChannelName('General'); }} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm ${activeChannelId === 'general' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                          <Hash size={16} /> general
                      </button>
                      <button onClick={() => { setActiveChannelId('announcements'); setActiveChannelType('public'); setActiveChannelName('Announcements'); }} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm ${activeChannelId === 'announcements' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                          <Hash size={16} /> announcements
                      </button>
                  </div>
              </div>

              <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">Teams</h3>
                  <div className="space-y-0.5">
                      {groups.length === 0 && <p className="text-xs text-slate-600 px-2 italic">No groups joined</p>}
                      {groups.map(group => (
                          <button key={group.id} onClick={() => { setActiveChannelId(group.id); setActiveChannelType('group'); setActiveChannelName(group.name); }} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm ${activeChannelId === group.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                              <Lock size={14} /> {group.name}
                          </button>
                      ))}
                  </div>
              </div>

              <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-2 flex justify-between items-center">
                      Direct Messages <button onClick={() => setIsSearchingUsers(!isSearchingUsers)} className="hover:text-white"><Plus size={14}/></button>
                  </h3>
                  
                  {isSearchingUsers && (
                      <div className="mb-2 px-2 relative">
                          <input autoFocus type="text" placeholder="Find user..." value={userSearchQuery} onChange={e => setUserSearchQuery(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none"/>
                          <div className="absolute top-full left-0 w-full bg-slate-800 border border-slate-700 rounded mt-1 max-h-40 overflow-y-auto z-20 shadow-xl">
                              {filteredUsers.map(u => (
                                  <button key={u.uid} onClick={() => handleStartDM(u.uid, u.displayName)} className="w-full text-left px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2">
                                      <div className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center text-[8px] font-bold">{u.displayName[0]}</div>
                                      <span>{u.displayName}</span> {/* Privacy: Do not show email here */}
                                  </button>
                              ))}
                          </div>
                      </div>
                  )}

                  <div className="space-y-0.5">
                      {dms.map(dm => (
                          <button key={dm.id} onClick={() => { setActiveChannelId(dm.id); setActiveChannelType('dm'); setActiveChannelName(dm.name.replace(currentUser?.displayName || '', '').replace('&', '').trim() || 'DM'); }} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm ${activeChannelId === dm.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                              <User size={14} />
                              <span className="truncate">{dm.name.replace(currentUser?.displayName || '', '').replace('&', '').trim() || 'Chat'}</span>
                          </button>
                      ))}
                  </div>
              </div>
          </div>
          
          {currentUser && (
              <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold overflow-hidden">
                      {currentUser.photoURL ? <img src={currentUser.photoURL} className="w-full h-full object-cover"/> : currentUser.displayName?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{currentUser.displayName}</p>
                      <p className="text-xs text-slate-500 truncate">Online</p>
                  </div>
              </div>
          )}
      </div>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950">
          <div className="h-14 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-900/50">
              <div className="flex items-center gap-3">
                  <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-400 hover:text-white md:hidden"><Menu size={20} /></button>
                  <h3 className="font-bold text-white flex items-center gap-2">
                      {activeChannelType === 'public' && <Hash size={18} className="text-slate-400"/>}
                      {activeChannelType === 'group' && <Lock size={18} className="text-slate-400"/>}
                      {activeChannelType === 'dm' && <User size={18} className="text-slate-400"/>}
                      {activeChannelName}
                  </h3>
              </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500">
                      <MessageSquare size={48} className="mb-4 opacity-20"/>
                      <p>No messages yet.</p>
                  </div>
              ) : (
                  messages.map((msg, i) => {
                      const isMe = msg.senderId === currentUser?.uid;
                      const showHeader = i === 0 || messages[i-1].senderId !== msg.senderId || (msg.timestamp?.toMillis && messages[i-1].timestamp?.toMillis && (msg.timestamp.toMillis() - messages[i-1].timestamp.toMillis() > 300000));
                      const isSelected = selectedMessageId === msg.id;
                      const attachments = (msg as any).attachments || [];

                      return (
                          <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1 group/row`}>
                              {!isMe && (
                                  <div className="flex-shrink-0 w-10 mr-2 flex flex-col justify-start pt-1">
                                      {showHeader && (
                                          msg.senderImage ? <img src={msg.senderImage} className="w-10 h-10 rounded-full object-cover border-2 border-slate-700" /> : 
                                          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-xs text-slate-400 font-bold border-2 border-slate-700">{msg.senderName?.[0]?.toUpperCase()}</div>
                                      )}
                                  </div>
                              )}

                              <div className={`flex flex-col max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                                  {showHeader && (
                                      <div className={`flex items-center gap-2 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                                          <span className="text-xs font-bold text-slate-300">{msg.senderName}</span>
                                          <span className="text-[10px] text-slate-500">{msg.timestamp?.toMillis ? new Date(msg.timestamp.toMillis()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</span>
                                      </div>
                                  )}
                                  
                                  <div 
                                      className={`px-4 py-2 rounded-2xl text-sm leading-relaxed relative cursor-pointer group/bubble transition-all duration-200 ${isMe ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-slate-800 text-slate-200 rounded-tl-sm hover:bg-slate-700'} ${isSelected ? 'ring-2 ring-white/20' : ''}`}
                                      onClick={(e) => { e.stopPropagation(); setSelectedMessageId(isSelected ? null : msg.id); }}
                                      onDoubleClick={() => setReplyingTo(msg)}
                                  >
                                      {msg.replyTo && (
                                          <div className="mb-2 pl-2 border-l-2 border-white/30 text-xs opacity-70 bg-black/10 p-1 rounded-r">
                                              <p className="font-bold">{msg.replyTo.senderName}</p>
                                              <p className="truncate">{msg.replyTo.text}</p>
                                          </div>
                                      )}
                                      
                                      {renderMessageText(msg.text)}

                                      {attachments.length > 0 && (
                                          <div className="mt-2 space-y-2">
                                              {attachments.map((att: any, idx: number) => (
                                                  <div key={idx} className="rounded overflow-hidden">
                                                      {att.type === 'image' ? <img src={att.url} alt="att" className="max-w-full rounded-lg border border-white/10 max-h-60 object-cover" /> : 
                                                       att.type === 'video' ? <video src={att.url} controls className="max-w-full rounded-lg border border-white/10 max-h-60" /> : 
                                                       <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-black/20 p-2 rounded-lg hover:bg-black/30"><FileText size={16}/><span className="text-xs truncate underline">{att.name}</span></a>}
                                                  </div>
                                              ))}
                                          </div>
                                      )}

                                      {/* Actions Menu - Appears on Hover (Desktop) or Selection (Mobile/Click) */}
                                      <div className={`absolute bottom-1 ${isMe ? 'left-1 -translate-x-full pr-2' : 'right-1 translate-x-full pl-2'} flex items-center gap-1 opacity-0 group-hover/bubble:opacity-100 ${isSelected ? '!opacity-100' : ''} transition-opacity`}>
                                          <button onClick={(e) => { e.stopPropagation(); setReplyingTo(msg); }} className="p-1 bg-slate-900/80 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 shadow-sm"><Reply size={12} /></button>
                                          {isMe && <button onClick={(e) => { e.stopPropagation(); handleDeleteMessage(msg.id); }} className="p-1 bg-slate-900/80 rounded-full hover:bg-slate-700 text-slate-400 hover:text-red-500 border border-slate-700 shadow-sm"><Trash2 size={12} /></button>}
                                      </div>
                                  </div>
                              </div>

                              {isMe && (
                                  <div className="flex-shrink-0 w-10 ml-2 flex flex-col justify-start pt-1">
                                      {showHeader && (
                                          msg.senderImage ? <img src={msg.senderImage} className="w-10 h-10 rounded-full object-cover border-2 border-indigo-500" /> : 
                                          <div className="w-10 h-10 rounded-full bg-indigo-700 flex items-center justify-center text-xs text-indigo-200 font-bold border-2 border-indigo-600">{msg.senderName?.[0]?.toUpperCase()}</div>
                                      )}
                                  </div>
                              )}
                          </div>
                      );
                  })
              )}
              <div ref={messagesEndRef} />
          </div>

          <div className="p-4 bg-slate-900 border-t border-slate-800">
              {replyingTo && (
                  <div className="flex justify-between items-center bg-slate-800 p-2 rounded-t-lg border-x border-t border-slate-700 text-xs mb-2">
                      <div className="flex items-center gap-2 overflow-hidden">
                          <Reply size={14} className="text-indigo-400 shrink-0" />
                          <div className="truncate">
                              <span className="font-bold text-indigo-300">Replying to {replyingTo.senderName}: </span>
                              <span className="text-slate-400">{replyingTo.text}</span>
                          </div>
                      </div>
                      <button onClick={() => setReplyingTo(null)} className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700"><X size={14} /></button>
                  </div>
              )}

              {/* Enhanced File Preview */}
              {selectedFiles.length > 0 && (
                  <div className="flex gap-4 overflow-x-auto pb-4 px-2 mb-2 bg-slate-950/50 p-2 rounded-lg border border-slate-800">
                      {selectedFiles.map((file, idx) => (
                          <div key={idx} className="relative group flex-shrink-0 w-24 h-24 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg hover:border-indigo-500 transition-colors">
                              {file.type.startsWith('image/') && filePreviews[idx] ? (
                                  <img src={filePreviews[idx]} className="w-full h-full object-cover" />
                              ) : (
                                  <div className="flex flex-col items-center justify-center h-full text-slate-400 p-2">
                                      {file.type.startsWith('video/') ? <Video size={24} className="mb-1 text-indigo-400"/> : <FileText size={24} className="mb-1 text-slate-500"/>}
                                      <span className="text-[9px] text-center w-full truncate leading-tight">{file.name}</span>
                                  </div>
                              )}
                              <button onClick={() => removeAttachment(idx)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-md transform hover:scale-110 transition-all"><X size={12} /></button>
                          </div>
                      ))}
                  </div>
              )}

              <form onSubmit={handleSendMessage} className="bg-slate-800 border border-slate-700 rounded-xl flex items-center p-2 gap-2 relative z-10">
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors relative" title="Attach File">
                      <Paperclip size={20} />
                      {selectedFiles.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>}
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileSelect} accept="image/*,video/*,.pdf,.doc,.docx,.txt" />
                  
                  <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder={`Message #${activeChannelName}`} className="flex-1 bg-transparent text-white outline-none placeholder-slate-500" />
                  
                  <button type="submit" disabled={(!newMessage.trim() && selectedFiles.length === 0) || isUploading} className={`p-2 rounded-lg flex items-center gap-2 transition-all ${isUploading ? 'bg-indigo-900/50 text-indigo-300' : 'bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed'}`}>
                      {isUploading ? <Loader2 size={18} className="animate-spin"/> : <Send size={18} />}
                      {isUploading && <span className="text-xs font-bold">Uploading...</span>}
                  </button>
              </form>
          </div>
      </div>
    </div>
  );
};
