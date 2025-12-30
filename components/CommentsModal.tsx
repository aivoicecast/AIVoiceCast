import React, { useState, useRef, useEffect } from 'react';
import { Channel, Attachment, AttachmentType, Comment } from '../types';
import { X, Send, MessageSquare, User, Image as ImageIcon, Video, Mic, Loader2, StopCircle, Trash2, Edit2, Save, FileText } from 'lucide-react';
import { uploadCommentAttachment } from '../services/firestoreService';

interface CommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: Channel;
  onAddComment: (text: string, attachments: Attachment[]) => void;
  onDeleteComment?: (commentId: string) => void;
  onEditComment?: (commentId: string, newText: string, newAttachments: Attachment[]) => void;
  currentUser: any;
}

export const CommentsModal: React.FC<CommentsModalProps> = ({ 
  isOpen, onClose, channel, onAddComment, onDeleteComment, onEditComment, currentUser 
}) => {
  const [text, setText] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  // Editing State
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  
  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Refs for hidden inputs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      // Reset state on close
      setText('');
      setPendingAttachments([]);
      setExistingAttachments([]);
      setEditingCommentId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setPendingAttachments(prev => [...prev, ...Array.from(e.target.files || [])]);
    }
    e.target.value = '';
  };

  const removePendingAttachment = (idx: number) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  const removeExistingAttachment = (attId: string) => {
    setExistingAttachments(prev => prev.filter(att => att.id !== attId));
  };

  const toggleRecording = async () => {
    if (isRecording) {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
    } else {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            audioChunksRef.current = [];
            
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };
            
            recorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const file = new File([blob], `voice_note_${Date.now()}.webm`, { type: 'audio/webm' });
                setPendingAttachments(prev => [...prev, file]);
                stream.getTracks().forEach(track => track.stop());
            };
            
            mediaRecorderRef.current = recorder;
            recorder.start();
            setIsRecording(true);
        } catch(e) {
            console.error("Mic error", e);
            alert("Could not access microphone.");
        }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!text.trim() && pendingAttachments.length === 0 && existingAttachments.length === 0) || isUploading) return;

    setIsUploading(true);
    const finalAttachments: Attachment[] = [...existingAttachments];

    try {
        // Upload new files
        for (const file of pendingAttachments) {
            let url = '';
            let type: AttachmentType = 'image';
            if (file.type.startsWith('video/')) type = 'video';
            else if (file.type.startsWith('audio/')) type = 'audio';
            else if (file.type === 'application/pdf') type = 'file';

            if (currentUser) {
                try {
                    const path = `comments/${channel.id}/${Date.now()}_${file.name}`;
                    url = await uploadCommentAttachment(file, path);
                } catch(err) {
                    console.error("Upload failed", err);
                    continue; 
                }
            } else {
                if (file.size > 2 * 1024 * 1024) {
                    alert(`File ${file.name} is too large for guest mode (limit 2MB).`);
                    continue;
                }
                url = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(file);
                });
            }

            finalAttachments.push({
                id: crypto.randomUUID(),
                type,
                url,
                name: file.name
            });
        }

        if (editingCommentId && onEditComment) {
            onEditComment(editingCommentId, text, finalAttachments);
        } else {
            onAddComment(text, finalAttachments);
        }

        // Reset
        setText('');
        setPendingAttachments([]);
        setExistingAttachments([]);
        setEditingCommentId(null);
    } catch(e) {
        console.error("Error sending comment", e);
        alert("Failed to send comment.");
    } finally {
        setIsUploading(false);
    }
  };

  const handleStartEdit = (comment: Comment) => {
      setEditingCommentId(comment.id);
      setText(comment.text);
      setExistingAttachments(comment.attachments || []);
      setPendingAttachments([]);
  };

  const handleCancelEdit = () => {
      setEditingCommentId(null);
      setText('');
      setExistingAttachments([]);
      setPendingAttachments([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Helper to render attachment in stream
  const renderAttachment = (att: Attachment) => {
      switch(att.type) {
          case 'image': 
            return <img src={att.url} alt="attachment" className="max-h-48 rounded-lg mt-2 border border-slate-700" loading="lazy" />;
          case 'video':
            return <video src={att.url} controls className="max-h-64 rounded-lg mt-2 border border-slate-700 w-full max-w-sm" />;
          case 'audio':
            return <audio src={att.url} controls className="mt-2 w-full max-w-sm" />;
          case 'file':
            return (
                <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-3 p-3 bg-slate-800 rounded-lg border border-slate-700 mt-2 hover:bg-slate-700 transition-colors w-full max-w-sm group">
                    <div className="p-2 bg-red-500/10 text-red-400 rounded-lg group-hover:bg-red-500/20 transition-colors">
                        <FileText size={24} />
                    </div>
                    <div className="flex-1 overflow-hidden text-left">
                        <p className="text-sm font-medium text-slate-200 truncate">{att.name || 'Document'}</p>
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">PDF Document</p>
                    </div>
                </a>
            );
          default: return null;
      }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[85vh] animate-fade-in-up">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900 shrink-0 rounded-t-2xl">
          <div className="flex items-center space-x-2">
            <MessageSquare className="text-indigo-400 w-5 h-5" />
            <h2 className="text-lg font-bold text-white">Comments</h2>
            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
               {channel.comments.length}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Comments List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4 scrollbar-thin scrollbar-thumb-slate-700">
          {channel.comments.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
               <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
               <p>No comments yet. Be the first!</p>
            </div>
          ) : (
            channel.comments.map((comment, idx) => (
              <div key={comment.id || idx} className={`bg-slate-800/50 border border-slate-700/50 p-4 rounded-xl relative group ${editingCommentId === comment.id ? 'ring-2 ring-indigo-500' : ''}`}>
                 
                 {/* Action Buttons (Edit/Delete) */}
                 {currentUser && (comment.userId === currentUser.uid || comment.user === currentUser.displayName || currentUser.email === 'shengliang.song@gmail.com') && !editingCommentId && (
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                        <button 
                           onClick={() => handleStartEdit(comment)}
                           className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                           title="Edit"
                        >
                           <Edit2 size={14} />
                        </button>
                        <button 
                           onClick={() => {
                               if (confirm("Delete this comment?") && onDeleteComment) onDeleteComment(comment.id);
                           }}
                           className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                           title="Delete"
                        >
                           <Trash2 size={14} />
                        </button>
                    </div>
                 )}

                 <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                       <div className="w-6 h-6 bg-indigo-900/50 rounded-full flex items-center justify-center text-indigo-300">
                          <User size={12} />
                       </div>
                       <span className="text-sm font-bold text-slate-300">{comment.user}</span>
                    </div>
                    <span className="text-[10px] text-slate-500">
                       {new Date(comment.timestamp).toLocaleDateString()}
                    </span>
                 </div>
                 
                 {editingCommentId === comment.id ? (
                     <p className="text-xs text-indigo-400 italic mb-2">Editing now...</p>
                 ) : (
                     <>
                        {comment.text && <p className="text-sm text-slate-300 pl-8 whitespace-pre-wrap leading-relaxed">{comment.text}</p>}
                        {comment.attachments && comment.attachments.length > 0 && (
                            <div className="pl-8 mt-2 space-y-2">
                                {comment.attachments.map(att => (
                                    <div key={att.id}>{renderAttachment(att)}</div>
                                ))}
                            </div>
                        )}
                     </>
                 )}
              </div>
            ))
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 rounded-b-2xl">
           {currentUser ? (
             <div className="flex flex-col space-y-3">
               
               {editingCommentId && (
                   <div className="flex justify-between items-center text-xs text-indigo-400 bg-indigo-900/20 px-3 py-1.5 rounded-lg border border-indigo-900/50">
                       <span>Editing your comment...</span>
                       <button onClick={handleCancelEdit} className="text-slate-400 hover:text-white underline">Cancel</button>
                   </div>
               )}

               {/* Attachments Preview (Existing + New) */}
               {(pendingAttachments.length > 0 || existingAttachments.length > 0) && (
                  <div className="flex gap-2 overflow-x-auto pb-2">
                     {existingAttachments.map(att => (
                        <div key={att.id} className="relative group shrink-0">
                           <div className="w-16 h-16 bg-slate-800 rounded-lg border border-indigo-500/50 flex items-center justify-center overflow-hidden">
                              {att.type === 'image' ? <img src={att.url} className="w-full h-full object-cover" /> : 
                               att.type === 'video' ? <Video size={20} className="text-indigo-400" /> : 
                               att.type === 'file' ? <FileText size={20} className="text-red-400" /> :
                               <Mic size={20} className="text-pink-400" />}
                           </div>
                           <button onClick={() => removeExistingAttachment(att.id)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 shadow-md">
                              <X size={10} />
                           </button>
                        </div>
                     ))}
                     {pendingAttachments.map((file, idx) => (
                        <div key={idx} className="relative group shrink-0">
                           <div className="w-16 h-16 bg-slate-800 rounded-lg border border-slate-700 flex items-center justify-center overflow-hidden">
                              {file.type.startsWith('image/') ? (
                                <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                              ) : file.type.startsWith('video/') ? (
                                <Video size={20} className="text-indigo-400" />
                              ) : file.type === 'application/pdf' ? (
                                <FileText size={20} className="text-red-400" />
                              ) : (
                                <Mic size={20} className="text-pink-400" />
                              )}
                           </div>
                           <button onClick={() => removePendingAttachment(idx)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 shadow-md">
                              <X size={10} />
                           </button>
                        </div>
                     ))}
                  </div>
               )}

               <div className="flex gap-2 items-end bg-slate-800 border border-slate-700 rounded-lg p-2">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Write a comment..."
                    rows={2}
                    className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none text-sm resize-none scrollbar-thin scrollbar-thumb-slate-600 px-2"
                  />
                  
                  {/* Toolbar */}
                  <div className="flex items-center space-x-1">
                     <button onClick={() => imageInputRef.current?.click()} className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-700/50 rounded-full transition-colors" title="Add Image">
                        <ImageIcon size={18} />
                     </button>
                     <button onClick={() => videoInputRef.current?.click()} className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-700/50 rounded-full transition-colors" title="Add Video">
                        <Video size={18} />
                     </button>
                     <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700/50 rounded-full transition-colors" title="Attach PDF">
                        <FileText size={18} />
                     </button>
                     <button onClick={toggleRecording} className={`p-2 rounded-full transition-all ${isRecording ? 'text-red-500 bg-red-500/20 animate-pulse' : 'text-slate-400 hover:text-pink-400 hover:bg-slate-700/50'}`} title="Record Audio">
                        {isRecording ? <StopCircle size={18} /> : <Mic size={18} />}
                     </button>
                     
                     <div className="w-px h-6 bg-slate-700 mx-1"></div>

                     <button 
                        onClick={handleSubmit} 
                        disabled={(!text.trim() && pendingAttachments.length === 0 && existingAttachments.length === 0) || isUploading || isRecording}
                        className={`p-2 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors shadow-lg ${editingCommentId ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-indigo-600'}`}
                     >
                        {isUploading ? <Loader2 size={18} className="animate-spin" /> : editingCommentId ? <Save size={18} /> : <Send size={18} />}
                     </button>
                  </div>
               </div>
               
               <p className="text-[10px] text-slate-500 text-right">Ctrl + Enter to send</p>

               {/* Hidden Inputs */}
               <input type="file" accept="image/*" className="hidden" ref={imageInputRef} onChange={handleFileSelect} />
               <input type="file" accept="video/*" className="hidden" ref={videoInputRef} onChange={handleFileSelect} />
               <input type="file" accept=".pdf" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
             </div>
           ) : (
             <p className="text-xs text-center text-slate-500">Sign in to leave a comment.</p>
           )}
        </div>

      </div>
    </div>
  );
};