
import React, { useState, useEffect, useMemo } from 'react';
import { Blog, BlogPost, Comment, UserProfile } from '../types';
import { ensureUserBlog, getCommunityPosts, getUserPosts, createBlogPost, updateBlogPost, deleteBlogPost, updateBlogSettings, addPostComment, getBlogPost, getUserProfile, isUserAdmin, deleteBlog } from '../services/firestoreService';
import { auth } from '../services/firebaseConfig';
import { Edit3, Plus, Trash2, Globe, User, MessageSquare, Loader2, ArrowLeft, Save, Image as ImageIcon, Search, LayoutList, PenTool, Rss, X, Pin, AlertCircle, RefreshCw, Eye, Code, ShieldAlert } from 'lucide-react';
import { MarkdownView } from './MarkdownView';
import { CommentsModal } from './CommentsModal';
import { SYSTEM_BLOG_POSTS } from '../utils/blogContent';

interface BlogViewProps {
  currentUser: any;
  onBack?: () => void;
}

export const BlogView: React.FC<BlogViewProps> = ({ currentUser, onBack }) => {
  const [activeTab, setActiveTab] = useState<'feed' | 'my_blog' | 'editor' | 'post_detail'>('feed');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  
  const [myBlog, setMyBlog] = useState<Blog | null>(null);
  const [myPosts, setMyPosts] = useState<BlogPost[]>([]);
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [blogTitle, setBlogTitle] = useState('');
  const [blogDesc, setBlogDesc] = useState('');

  const [editingPost, setEditingPost] = useState<Partial<BlogPost>>({ title: '', content: '', tags: [] });
  const [tagInput, setTagInput] = useState('');
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const [activePost, setActivePost] = useState<BlogPost | null>(null);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);

  const isAdmin = useMemo(() => isUserAdmin(profile), [profile]);
  const isSuperAdmin = useMemo(() => currentUser?.email === 'shengliang.song.ai@gmail.com', [currentUser]);

  useEffect(() => {
    setErrorMsg(null);
    if (currentUser) {
        getUserProfile(currentUser.uid).then(setProfile);
    }
    if (activeTab === 'feed') {
      loadFeed();
    } else if (activeTab === 'my_blog' && currentUser) {
      loadMyBlog();
    }
  }, [activeTab, currentUser]);

  const loadFeed = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await getCommunityPosts();
      const hiddenIds = JSON.parse(localStorage.getItem('hidden_system_posts') || '[]');
      const systemIds = SYSTEM_BLOG_POSTS.map(p => p.id);
      
      const filteredDbPosts = data.filter(p => !systemIds.includes(p.id));
      const visibleSystemPosts = SYSTEM_BLOG_POSTS.filter(p => !hiddenIds.includes(p.id));
      
      const finalPosts = [...visibleSystemPosts, ...filteredDbPosts];
      setPosts(finalPosts.sort((a, b) => (b.publishedAt || b.createdAt) - (a.publishedAt || a.createdAt)));
    } catch (e: any) {
      console.error("Feed load error:", e);
      setErrorMsg("Failed to load community feed. Falling back to system posts.");
      setPosts(SYSTEM_BLOG_POSTS);
    } finally {
      setLoading(false);
    }
  };

  const loadMyBlog = async () => {
    if (!currentUser) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const blog = await ensureUserBlog(currentUser);
      setMyBlog(blog);
      setBlogTitle(blog.title);
      setBlogDesc(blog.description);
      const userPosts = await getUserPosts(blog.id);
      setMyPosts(userPosts);
    } catch (e: any) {
      console.error("My blog load error:", e);
      setErrorMsg("Database error loading your posts.");
    } finally {
      setLoading(false);
    }
  };

  const filteredPosts = useMemo(() => {
      if (!searchQuery.trim()) return posts;
      const q = searchQuery.toLowerCase();
      return posts.filter(p => 
          p.title.toLowerCase().includes(q) || 
          p.excerpt.toLowerCase().includes(q) || 
          p.tags.some(t => t.toLowerCase().includes(q))
      );
  }, [posts, searchQuery]);

  const handleSaveSettings = async () => {
    if (!myBlog) return;
    try {
      await updateBlogSettings(myBlog.id, { title: blogTitle, description: blogDesc });
      setMyBlog({ ...myBlog, title: blogTitle, description: blogDesc });
      setIsEditingSettings(false);
    } catch(e) { 
        window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: "Failed to save settings", type: 'error' } }));
    }
  };

  const handleDeleteBlog = async () => {
      if (!myBlog) return;
      // Confirmation removed for seamless experience
      setLoading(true);
      try {
          // Delete all associated posts first
          for (const post of myPosts) {
              await deleteBlogPost(post.id);
          }
          // Delete the blog doc itself
          await deleteBlog(myBlog.id);
          
          setMyBlog(null);
          setMyPosts([]);
          setActiveTab('feed');
          await loadFeed();
          window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: "Blog workspace purged from ledger.", type: 'info' } }));
      } catch (e: any) {
          window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: "Deletion failed: " + e.message, type: 'error' } }));
      } finally {
          setLoading(false);
      }
  };

  const handleCreatePost = () => {
    setEditingPost({ title: '', content: '', tags: [], status: 'draft' });
    setIsPreviewMode(false);
    setActiveTab('editor');
  };

  const handleEditPost = (post: BlogPost) => {
    setEditingPost(post);
    setIsPreviewMode(false);
    setActiveTab('editor');
  };

  const handleDeletePost = async (postId: string) => {
    // Confirmation removed for seamless experience
    const isSystemPost = SYSTEM_BLOG_POSTS.some(p => p.id === postId);
    
    if (isSystemPost) {
        if (isAdmin || isSuperAdmin) {
            const hidden = JSON.parse(localStorage.getItem('hidden_system_posts') || '[]');
            if (!hidden.includes(postId)) {
                hidden.push(postId);
                localStorage.setItem('hidden_system_posts', JSON.stringify(hidden));
            }
            loadFeed();
            return;
        } else {
            window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: "Permission denied: System post.", type: 'warn' } }));
            return;
        }
    }

    try {
      await deleteBlogPost(postId);
      setMyPosts(prev => prev.filter(p => p.id !== postId));
      setPosts(prev => prev.filter(p => p.id !== postId));
      if (activePost?.id === postId) {
          setActivePost(null);
          setActiveTab('feed');
      }
      window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: "Post deleted successfully.", type: 'info' } }));
    } catch(e) { 
        window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: "Failed to delete post", type: 'error' } }));
    }
  };

  const handleSavePost = async () => {
    if (!myBlog || !currentUser || !editingPost.title || !editingPost.content) {
        window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: "Title and content required.", type: 'warn' } }));
        return;
    }
    setLoading(true);
    try {
        const now = Date.now();
        const postData: any = {
            ...editingPost,
            blogId: myBlog.id,
            authorId: currentUser.uid,
            authorName: currentUser.displayName || 'Anonymous',
            authorImage: currentUser.photoURL || '',
            excerpt: editingPost.content?.substring(0, 150).replace(/[#*`]/g, '') + '...',
            publishedAt: editingPost.status === 'published' ? (editingPost.publishedAt || now) : null,
            createdAt: editingPost.createdAt || now,
            likes: editingPost.likes || 0,
            commentCount: editingPost.commentCount || 0
        };
        if (editingPost.id) await updateBlogPost(editingPost.id, postData);
        else await createBlogPost(postData);
        setActiveTab('my_blog');
        await loadMyBlog(); 
        window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: editingPost.status === 'published' ? "Post published!" : "Draft saved.", type: 'success' } }));
    } catch(e: any) { 
        window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: "Failed to save post: " + (e.message || "Unknown error"), type: 'error' } }));
    } finally {
        setLoading(false);
    }
  };

  const handleViewPost = (post: BlogPost) => {
      setActivePost(post);
      setActiveTab('post_detail');
  };

  const handleAddComment = async (text: string, attachments: any[]) => {
      if (!activePost || !currentUser) return;
      const newComment: Comment = {
          id: crypto.randomUUID(), userId: currentUser.uid, user: currentUser.displayName || 'Anonymous',
          text, timestamp: Date.now(), attachments
      };
      try {
          const isSystemPost = SYSTEM_BLOG_POSTS.some(p => p.id === activePost.id);
          if (isSystemPost) {
              const updatedPost = { ...activePost, comments: [...(activePost.comments || []), newComment], commentCount: (activePost.commentCount || 0) + 1 };
              setActivePost(updatedPost);
              setPosts(prev => prev.map(p => p.id === activePost.id ? updatedPost : p));
              return;
          }
          await addPostComment(activePost.id, newComment);
          const updatedPost = { ...activePost, comments: [...(activePost.comments || []), newComment], commentCount: (activePost.commentCount || 0) + 1 };
          setActivePost(updatedPost);
          setPosts(prev => prev.map(p => p.id === activePost.id ? updatedPost : p));
          setMyPosts(prev => prev.map(p => p.id === activePost.id ? updatedPost : p));
      } catch(e) { 
          window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: "Failed to post comment.", type: 'error' } }));
      }
  };

  const renderPostCard = (post: BlogPost, canDelete = false) => {
      const isPinned = SYSTEM_BLOG_POSTS.some(p => p.id === post.id);
      const isAuthor = currentUser && post.authorId === currentUser.uid;
      
      return (
      <div key={post.id} className={`bg-slate-900 border ${isPinned ? 'border-indigo-500 shadow-lg shadow-indigo-500/10' : 'border-slate-800'} rounded-xl p-5 hover:border-indigo-500/30 transition-all flex flex-col gap-3 group relative`}>
          {isPinned && (
              <div className="absolute top-0 right-0 p-2">
                  <span className="bg-indigo-600 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded flex items-center gap-1 shadow-md"><Pin size={10} fill="currentColor" /> Pinned</span>
              </div>
          )}
          <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0 pr-10">
                  <h3 onClick={() => handleViewPost(post)} className={`text-lg font-bold hover:text-indigo-400 cursor-pointer transition-colors line-clamp-1 ${isPinned ? 'text-indigo-100' : 'text-white'}`}>{post.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                      <span>By {post.authorName}</span>
                      <span>•</span>
                      <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                      {post.status === 'draft' && <span className="bg-amber-900/30 text-amber-400 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold">Draft</span>}
                  </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {isAuthor && (
                    <button onClick={() => handleEditPost(post)} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white" title="Edit"><Edit3 size={14}/></button>
                  )}
                  {(canDelete || isSuperAdmin) && (
                    <button onClick={() => handleDeletePost(post.id)} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-red-400" title="Delete"><Trash2 size={14}/></button>
                  )}
              </div>
          </div>
          <p className="text-sm text-slate-400 line-clamp-2">{post.excerpt}</p>
          <div className="flex items-center justify-between mt-auto pt-2">
              <div className="flex gap-2">{post.tags?.map(t => <span key={t} className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-400 border border-slate-700">#{t}</span>)}</div>
              <button onClick={() => handleViewPost(post)} className="flex items-center gap-1 text-xs text-indigo-400 font-bold hover:text-white transition-colors">Read More</button>
          </div>
      </div>
      );
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100">
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900 sticky top-0 z-10">
            <div className="flex items-center gap-4">
                {(activeTab === 'post_detail' || activeTab === 'editor') && (
                    <button onClick={() => setActiveTab(activeTab === 'editor' ? 'my_blog' : 'feed')} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white"><ArrowLeft size={20} /></button>
                )}
                <h1 className="text-xl font-bold flex items-center gap-2"><Rss className="text-indigo-400"/><span className="hidden sm:inline">{activeTab === 'my_blog' ? 'My Blog' : activeTab === 'editor' ? 'Post Editor' : activeTab === 'post_detail' ? 'Reading Mode' : 'Community Blog'}</span></h1>
            </div>
            <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 overflow-x-auto">
                <button onClick={() => setActiveTab('feed')} className={`px-4 py-2 text-sm font-bold rounded transition-colors ${activeTab === 'feed' || activeTab === 'post_detail' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>Feed</button>
                <button onClick={() => currentUser ? setActiveTab('my_blog') : window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: "Authentication required.", type: 'warn' } }))} className={`px-4 py-2 text-sm font-bold rounded transition-colors ${activeTab === 'my_blog' || activeTab === 'editor' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>My Blog</button>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto">
            {errorMsg && (
                <div className="max-w-5xl mx-auto p-4"><div className="bg-red-900/20 border border-red-900/50 rounded-xl p-4 flex items-center gap-3 text-red-200"><AlertCircle size={20} className="shrink-0" /><div className="flex-1 text-sm">{errorMsg}</div><button onClick={() => activeTab === 'feed' ? loadFeed() : loadMyBlog()} className="p-2 hover:bg-red-900/30 rounded-full"><RefreshCw size={16}/></button></div></div>
            )}

            {activeTab === 'feed' && (
                <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6 animate-fade-in">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Globe size={18} className="text-emerald-400"/> Latest Posts
                        </h2>
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <input type="text" placeholder="Search topics..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-10 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500 w-full sm:w-64 transition-all"/>
                                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"/>
                                {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"><X size={14} /></button>}
                            </div>
                        </div>
                    </div>
                    {loading ? (
                        <div className="py-12 text-center"><Loader2 className="animate-spin mx-auto text-indigo-400" size={32}/></div>
                    ) : filteredPosts.length === 0 ? (
                        <div className="py-12 text-center text-slate-500 italic border border-dashed border-slate-800 rounded-xl">
                            {searchQuery ? `No posts found for "${searchQuery}"` : "No posts yet."}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredPosts.map(post => {
                                const isPostAuthor = currentUser && post.authorId === currentUser.uid;
                                return renderPostCard(post, isPostAuthor || isAdmin || isSuperAdmin);
                            })}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'my_blog' && (
                <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-8 animate-fade-in">
                    <div className="bg-gradient-to-r from-indigo-900/30 to-purple-900/30 border border-indigo-500/30 rounded-xl p-6">
                        <div className="flex justify-between items-start">
                            {isEditingSettings ? (
                                <div className="space-y-3 w-full">
                                    <input type="text" value={blogTitle} onChange={e => setBlogTitle(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white font-bold" placeholder="Blog Title"/>
                                    <textarea value={blogDesc} onChange={e => setBlogDesc(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white resize-none" placeholder="Blog Description" rows={2}/>
                                    <div className="flex justify-between items-center">
                                        <div className="flex gap-2">
                                            <button onClick={handleSaveSettings} className="px-4 py-1.5 bg-indigo-600 text-white rounded text-xs font-bold">Save</button>
                                            <button onClick={() => setIsEditingSettings(false)} className="px-4 py-1.5 bg-slate-800 text-slate-300 rounded text-xs font-bold">Cancel</button>
                                        </div>
                                        <button onClick={handleDeleteBlog} className="px-4 py-1.5 bg-red-900/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-900/50 rounded text-xs font-bold flex items-center gap-2 transition-all">
                                            <Trash2 size={12}/> Delete Workspace
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <h2 className="text-2xl font-bold text-white">{myBlog?.title}</h2>
                                        <p className="text-slate-400 mt-1">{myBlog?.description}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        {(isSuperAdmin || currentUser?.uid === myBlog?.ownerId) && (
                                            <button onClick={() => setIsEditingSettings(true)} className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-white" title="Settings"><Edit3 size={16}/></button>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    
                    {isSuperAdmin && !myBlog && (
                        <div className="bg-red-900/10 border border-red-900/30 p-4 rounded-xl flex items-center gap-3 text-red-200">
                            <ShieldAlert size={20}/>
                            <span className="text-xs font-bold uppercase tracking-widest">Admin Observer Mode: No Workspace Detected</span>
                        </div>
                    )}

                    <div className="flex justify-between items-center"><h3 className="text-lg font-bold text-white flex items-center gap-2"><LayoutList size={18}/> My Posts</h3><button onClick={handleCreatePost} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-sm shadow-lg transition-transform hover:scale-105"><Plus size={16}/> New Post</button></div>
                    {loading ? <div className="py-12 text-center"><Loader2 className="animate-spin mx-auto text-indigo-400" size={32}/></div> : myPosts.length === 0 ? <div className="py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">You haven't written anything yet.</div> : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{myPosts.map(post => renderPostCard(post, true))}</div>}
                </div>
            )}

            {activeTab === 'editor' && (
                <div className="max-w-5xl mx-auto p-4 md:p-8 h-full flex flex-col space-y-6 animate-fade-in-up">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6 shadow-xl flex-1 flex flex-col">
                        <div className="space-y-4"><div className="flex justify-between items-center"><input type="text" value={editingPost.title} onChange={e => setEditingPost({...editingPost, title: e.target.value})} className="flex-1 bg-transparent text-3xl font-bold text-white placeholder-slate-600 outline-none border-b border-slate-800 pb-2 focus:border-indigo-500 transition-colors mr-4" placeholder="Post Title..."/><div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800"><button onClick={() => setIsPreviewMode(false)} className={`p-2 rounded transition-colors ${!isPreviewMode ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`} title="Edit Raw Markdown"><Code size={18}/></button><button onClick={() => setIsPreviewMode(true)} className={`p-2 rounded transition-colors ${isPreviewMode ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`} title="Preview Rendered Content"><Eye size={18}/></button></div></div><div className="flex items-center gap-4"><select value={editingPost.status} onChange={e => setEditingPost({...editingPost, status: e.target.value as any})} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-indigo-500"><option value="draft">Save as Draft</option><option value="published">Publish to Feed</option></select><div className="flex items-center gap-2 flex-1"><input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && tagInput.trim()) { setEditingPost(prev => ({ ...prev, tags: [...(prev.tags || []), tagInput.trim()] })); setTagInput(''); } }} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white outline-none w-full focus:border-indigo-500" placeholder="Add tags (Enter to add)"/></div></div><div className="flex flex-wrap gap-2">{editingPost.tags?.map((t, i) => <span key={i} className="text-xs bg-indigo-900/30 text-indigo-300 px-2 py-1 rounded flex items-center gap-1 border border-indigo-500/30">#{t} <button onClick={() => setEditingPost(prev => ({...prev, tags: prev.tags?.filter((_, idx) => idx !== i)}))} className="hover:text-white"><X size={10}/></button></span>)}</div></div>
                        <div className="flex-1 min-h-[400px]">{isPreviewMode ? <div className="h-full w-full bg-[#fdfbf7] rounded-xl p-8 overflow-y-auto prose prose-sm max-w-none shadow-inner border border-slate-200">{editingPost.content ? <MarkdownView content={editingPost.content} initialTheme={profile?.preferredReaderTheme || 'slate'} /> : <div className="h-full flex flex-col items-center justify-center text-slate-400 italic"><Eye size={48} className="mb-2 opacity-10" /><p>Nothing to preview yet.</p></div>}</div> : <textarea value={editingPost.content} onChange={e => setEditingPost({...editingPost, content: e.target.value})} className="w-full h-full bg-slate-950 border border-slate-800 rounded-xl p-6 text-slate-300 font-mono text-sm leading-relaxed outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none shadow-inner" placeholder="Write your story in Markdown..."/>}</div>
                        <div className="flex justify-end pt-2"><button onClick={handleSavePost} disabled={loading} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg transition-transform hover:scale-105 disabled:opacity-50">{loading ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>}<span>{editingPost.id ? "Update Post" : "Publish Post"}</span></button></div>
                    </div>
                </div>
            )}

            {activeTab === 'post_detail' && activePost && (
                <div className="animate-fade-in">
                    <div className="max-w-4xl mx-auto px-6 py-12 md:py-20">
                        <div className="mb-10 text-center">
                            <h1 className="text-4xl md:text-5xl font-black mb-6 leading-tight tracking-tight">{activePost.title}</h1>
                            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500 font-medium">
                                <div className="flex items-center gap-2"><div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold border border-indigo-200">{activePost.authorName.charAt(0)}</div><span>{activePost.authorName}</span></div>
                                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                <span>{new Date(activePost.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                <div className="flex gap-2">{activePost.tags.map(t => <span key={t} className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700 text-[10px] uppercase font-bold tracking-wider">#{t}</span>)}</div>
                            </div>
                        </div>
                        
                        <MarkdownView content={activePost.content} initialTheme={profile?.preferredReaderTheme || 'slate'} />
                        
                        <div className="mt-20 pt-10 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-6">
                            <button className="flex items-center gap-3 text-slate-400 font-bold hover:text-indigo-400 transition-colors"><MessageSquare size={24}/><span>{activePost.commentCount || 0} Responses</span></button>
                            {currentUser && (
                                <button onClick={() => setIsCommentsOpen(true)} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-xl hover:bg-indigo-500 transition-all active:scale-95">Leave a Comment</button>
                            )}
                        </div>
                    </div>
                    
                    {isCommentsOpen && (
                        <CommentsModal isOpen={true} onClose={() => setIsCommentsOpen(false)} channel={{ ...activePost, comments: activePost.comments || [] } as any} onAddComment={handleAddComment} currentUser={currentUser}/>
                    )}
                </div>
            )}
        </div>
    </div>
  );
};
