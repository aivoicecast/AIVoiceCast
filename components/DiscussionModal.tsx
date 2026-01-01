import React, { useState, useEffect, useRef } from 'react';
import { X, MessageCircle, FileText, Loader2, Edit2, Save, Sparkles, Cloud, Trash2, RefreshCw, Info, Lock, Globe, Users, ChevronDown, Check, Download, Image as ImageIcon, FileCode, Type } from 'lucide-react';
import { CommunityDiscussion, Group, ChannelVisibility } from '../types';
import { getDiscussionById, subscribeToDiscussion, saveDiscussionDesignDoc, saveDiscussion, deleteDiscussion, updateDiscussionVisibility, getUserGroups } from '../services/firestoreService';
import { generateDesignDocFromTranscript } from '../services/lectureGenerator';
import { MarkdownView } from './MarkdownView';
import { connectGoogleDrive } from '../services/authService';
import { createGoogleDoc } from '../services/googleDriveService';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface DiscussionModalProps {
  isOpen: boolean;
  onClose: () => void;
  discussionId: string;
  initialDiscussion?: CommunityDiscussion | null;
  currentUser?: any;
  language?: 'en' | 'zh';
  activeLectureTopic?: string;
  onDocumentDeleted?: () => void;
}

const TEMPLATES = [
    { 
        id: 'markdown', 
        name: 'Technical Spec', 
        icon: FileText, 
        content: '# New Specification\n\n## Overview\nProvide a brief summary...\n\n## Requirements\n- Point 1\n- Point 2\n\n## Implementation\nDescribe the technical approach...' 
    },
    { 
        id: 'plantuml', 
        name: 'System Diagram', 
        icon: FileCode, 
        content: '# System Architecture Diagram\n\n```plantuml\n@startuml\nactor User\nparticipant Frontend\nparticipant API\ndatabase Database\n\nUser -> Frontend: Interaction\nFrontend -> API: Request\nAPI -> Database: Query\nDatabase --> API: Result\nAPI --> Frontend: Response\nFrontend --> User: View Update\n@enduml\n```' 
    },
    { 
        id: 'math', 
        name: 'Research Paper', 
        icon: Type, 
        content: '# Mathematical Model\n\n## Equation\n$$ f(x) = \\int_{-\\infty}^{\\infty} e^{-x^2} dx $$\n\n## Explanation\nThis model describes the probability distribution...' 
    }
];

export const DiscussionModal: React.FC<DiscussionModalProps> = ({ 
  isOpen, onClose, discussionId, initialDiscussion, currentUser, language = 'en', activeLectureTopic, onDocumentDeleted
}) => {
  const [activeDiscussion, setActiveDiscussion] = useState<CommunityDiscussion | null>(initialDiscussion || null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'transcript' | 'doc'>('transcript');
  
  const [showVisibilityMenu, setShowVisibilityMenu] = useState(false);
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  const [isEditingDoc, setIsEditingDoc] = useState(false);
  const [editedDocContent, setEditedDocContent] = useState('');
  const [docTitle, setDocTitle] = useState('');
  const [isSavingDoc, setIsSavingDoc] = useState(false);
  const [isDeletingDoc, setIsDeletingDoc] = useState(false);
  const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const [isExportingGDoc, setIsExportingGDoc] = useState(false);
  const [gDocUrl, setGDocUrl] = useState<string | null>(null);

  const lastSavedContent = useRef<string>('');
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setGDocUrl(null);
      let unsubscribe = () => {};

      if (discussionId !== 'new') {
        setLoading(true);
        getDiscussionById(discussionId).then(data => {
            if (data) {
                setActiveDiscussion(data);
                setDocTitle(data.title || 'Untitled Document');
                setEditedDocContent(data.designDoc || '');
                lastSavedContent.current = data.designDoc || '';
                
                const hasTranscript = data.transcript && data.transcript.length > 0;
                if (data.isManual || data.designDoc || !hasTranscript) {
                    setViewMode('doc');
                } else {
                    setViewMode('transcript');
                }

                unsubscribe = subscribeToDiscussion(discussionId, (updated) => {
                    setActiveDiscussion(prev => {
                        if (updated.designDoc !== lastSavedContent.current && !isEditingDoc) {
                            setEditedDocContent(updated.designDoc || '');
                            lastSavedContent.current = updated.designDoc || '';
                        }
                        return updated;
                    });
                });
            } else {
                // Check local storage for guest docs
                const localDocsRaw = localStorage.getItem('guest_docs_v1');
                if (localDocsRaw) {
                    const localDocs = JSON.parse(localDocsRaw);
                    const found = localDocs.find((d: any) => d.id === discussionId);
                    if (found) {
                        setActiveDiscussion(found);
                        setDocTitle(found.title);
                        setEditedDocContent(found.designDoc || '');
                        setViewMode('doc');
                    }
                }
            }
            setLoading(false);
        }).catch(() => setLoading(false));
      } else if (initialDiscussion) {
          setActiveDiscussion(initialDiscussion);
          setDocTitle(initialDiscussion.title || 'Untitled Document');
          setEditedDocContent(initialDiscussion.designDoc || '');
          lastSavedContent.current = initialDiscussion.designDoc || '';
          setViewMode('doc');
          setIsEditingDoc(true);
      }

      if (currentUser) {
          setLoadingGroups(true);
          getUserGroups(currentUser.uid).then(groups => {
              setUserGroups(groups);
              setLoadingGroups(false);
          });
      }
      return () => unsubscribe();
    }
  }, [isOpen, discussionId, initialDiscussion, currentUser]);

  const handleApplyTemplate = (template: typeof TEMPLATES[0]) => {
      setEditedDocContent(template.content);
      if (docTitle === 'New Specification') {
          setDocTitle(template.name);
      }
  };

  const handleGenerateDoc = async () => {
      if (!activeDiscussion) return;
      if (!activeDiscussion.transcript || activeDiscussion.transcript.length === 0) {
          alert("Cannot synthesize: The session transcript is empty.");
          return;
      }
      setIsGeneratingDoc(true);
      try {
          const dateStr = new Date().toLocaleDateString('en-US');
          const meta = {
              date: dateStr,
              topic: docTitle || activeLectureTopic || "Discussion",
              segmentIndex: activeDiscussion.segmentIndex
          };

          const doc = await generateDesignDocFromTranscript(activeDiscussion.transcript, meta, language as 'en' | 'zh');
          if (doc) {
              if (activeDiscussion.id && activeDiscussion.id !== 'new') {
                await saveDiscussionDesignDoc(activeDiscussion.id, doc, docTitle);
                lastSavedContent.current = doc;
              }
              setActiveDiscussion({ ...activeDiscussion, designDoc: doc, title: docTitle });
              setEditedDocContent(doc);
              setViewMode('doc');
              setIsEditingDoc(false);
          }
      } catch(e) { alert("Error generating document."); } finally { setIsGeneratingDoc(false); }
  };

  const handleSaveDoc = async () => {
    if (!activeDiscussion) return;
    setIsSavingDoc(true);
    try {
      const updatedDoc = {
          ...activeDiscussion,
          title: docTitle || 'Untitled Document',
          designDoc: editedDocContent,
          updatedAt: Date.now()
      };

      if (!currentUser) {
          // Guest Save to LocalStorage
          const localDocsRaw = localStorage.getItem('guest_docs_v1');
          let localDocs = localDocsRaw ? JSON.parse(localDocsRaw) : [];
          
          if (activeDiscussion.id === 'new') {
              const newId = `local-${Date.now()}`;
              const newDoc = { ...updatedDoc, id: newId, userId: 'guest', userName: 'Local User' };
              localDocs.push(newDoc);
              setActiveDiscussion(newDoc);
          } else {
              localDocs = localDocs.map((d: any) => d.id === activeDiscussion.id ? updatedDoc : d);
              setActiveDiscussion(updatedDoc);
          }
          localStorage.setItem('guest_docs_v1', JSON.stringify(localDocs));
      } else {
          // Cloud Save
          if (activeDiscussion.id === 'new') {
              const docToSave = { ...updatedDoc };
              // @ts-ignore
              delete docToSave.id;
              const newId = await saveDiscussion(docToSave as CommunityDiscussion);
              setActiveDiscussion({ ...docToSave, id: newId });
          } else {
              await saveDiscussionDesignDoc(activeDiscussion.id, editedDocContent, docTitle || 'Untitled Document');
              setActiveDiscussion(updatedDoc);
          }
      }
      lastSavedContent.current = editedDocContent;
      setIsEditingDoc(false);
    } catch (e) {
      alert("Failed to save document.");
    } finally {
      setIsSavingDoc(false);
    }
  };

  const handleExportPDF = async () => {
      if (!exportRef.current) return;
      setIsExportingPDF(true);
      try {
          const element = exportRef.current;
          const canvas = await html2canvas(element, {
              scale: 3,
              useCORS: true,
              logging: false,
              backgroundColor: '#ffffff'
          });
          const imgData = canvas.toDataURL('image/jpeg', 1.0);
          const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' });
          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();
          const imgWidth = pageWidth;
          const imgHeight = (canvas.height * pageWidth) / canvas.width;
          
          pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');
          pdf.save(`${docTitle.replace(/\s+/g, '_')}.pdf`);
      } catch (e) {
          console.error(e);
          alert("PDF generation failed.");
      } finally {
          setIsExportingPDF(false);
      }
  };

  const handleUpdateVisibility = async (v: ChannelVisibility, gId?: string) => {
      if (!activeDiscussion || activeDiscussion.id === 'new' || activeDiscussion.userId === 'guest') {
          setActiveDiscussion(prev => prev ? ({ 
              ...prev, 
              visibility: v, 
              groupIds: gId ? (prev.groupIds?.includes(gId) ? prev.groupIds : [...(prev.groupIds || []), gId]) : prev.groupIds 
          }) : null);
          return;
      }
      try {
          const nextGroupIds = [...(activeDiscussion.groupIds || [])];
          if (v === 'group' && gId && !nextGroupIds.includes(gId)) nextGroupIds.push(gId);
          await updateDiscussionVisibility(activeDiscussion.id, v, nextGroupIds);
          setActiveDiscussion({ ...activeDiscussion, visibility: v, groupIds: nextGroupIds });
      } catch (e) { alert("Failed to update visibility."); }
  };

  const handleDelete = async () => {
      if (!activeDiscussion || activeDiscussion.id === 'system-doc-001') return;
      if (!confirm("Are you sure you want to delete this document?")) return;
      setIsDeletingDoc(true);
      try {
          if (activeDiscussion.id.startsWith('local-')) {
              const localDocsRaw = localStorage.getItem('guest_docs_v1');
              if (localDocsRaw) {
                  const localDocs = JSON.parse(localDocsRaw);
                  localStorage.setItem('guest_docs_v1', JSON.stringify(localDocs.filter((d: any) => d.id !== activeDiscussion.id)));
              }
          } else {
              await deleteDiscussion(activeDiscussion.id);
          }
          if (onDocumentDeleted) onDocumentDeleted();
          onClose();
      } catch (e) { alert("Failed to delete document."); } finally { setIsDeletingDoc(false); }
  };

  const handleExportToGoogleDocs = async () => {
      if (!activeDiscussion || !editedDocContent) return;
      setIsExportingGDoc(true);
      try {
          const token = await connectGoogleDrive();
          const url = await createGoogleDoc(token, docTitle || "AIVoiceCast Spec", editedDocContent);
          setGDocUrl(url);
          window.open(url, '_blank');
      } catch(e: any) { alert(`Failed to export: ${e.message}`); } finally { setIsExportingGDoc(false); }
  };

  const isOwner = !activeDiscussion || activeDiscussion.userId === 'guest' || (currentUser && activeDiscussion.userId === currentUser.uid) || currentUser?.email === 'shengliang.song.ai@gmail.com';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in-up">
          
          <div className="p-4 border-b border-slate-800 bg-slate-900">
              <div className="flex justify-between items-center mb-4 gap-4">
                  <div className="flex items-center gap-2 flex-1">
                      <FileText size={20} className="text-emerald-400 shrink-0" />
                      <input 
                          type="text" 
                          value={docTitle} 
                          readOnly={!isOwner}
                          onChange={(e) => setDocTitle(e.target.value)}
                          className={`bg-transparent border-b border-transparent ${isOwner ? 'hover:border-slate-700 focus:border-indigo-500' : ''} text-lg font-bold text-white focus:outline-none w-full transition-colors truncate`}
                          placeholder="Document Title"
                      />
                  </div>
                  <div className="flex items-center gap-2">
                      {isOwner && currentUser && (
                          <div className="relative">
                              <button onClick={() => setShowVisibilityMenu(!showVisibilityMenu)} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-all border border-slate-700">
                                {activeDiscussion?.visibility === 'public' ? <Globe size={14} className="text-emerald-400"/> : activeDiscussion?.visibility === 'group' ? <Users size={14} className="text-purple-400"/> : <Lock size={14} className="text-slate-500"/>}
                                <span className="capitalize">{activeDiscussion?.visibility || 'Private'}</span>
                                <ChevronDown size={12}/>
                              </button>
                              {showVisibilityMenu && (
                                  <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowVisibilityMenu(false)}></div>
                                    <div className="absolute top-full right-0 mt-1 w-56 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden py-1">
                                        <button onClick={() => { handleUpdateVisibility('private'); setShowVisibilityMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-slate-700 text-xs text-slate-300 flex items-center gap-2"><Lock size={12}/> Private</button>
                                        <button onClick={() => { handleUpdateVisibility('public'); setShowVisibilityMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-slate-700 text-xs text-emerald-400 flex items-center gap-2"><Globe size={12}/> Public</button>
                                        {userGroups.length > 0 && <div className="h-px bg-slate-700 my-1"></div>}
                                        {userGroups.map(g => (
                                            <button key={g.id} onClick={() => { handleUpdateVisibility('group', g.id); setShowVisibilityMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-slate-700 text-xs text-slate-300 flex items-center justify-between">
                                                <div className="flex items-center gap-2"><Users size={12}/> <span className="truncate">{g.name}</span></div>
                                            </button>
                                        ))}
                                    </div>
                                  </>
                              )}
                          </div>
                      )}
                      
                      {editedDocContent && !isEditingDoc && (
                        <button 
                            onClick={handleExportPDF}
                            disabled={isExportingPDF}
                            className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-all border border-slate-700"
                        >
                            {isExportingPDF ? <Loader2 size={14} className="animate-spin"/> : <Download size={14} />}
                            <span className="hidden sm:inline">PDF</span>
                        </button>
                      )}

                      {isOwner && currentUser && activeDiscussion?.designDoc && !isEditingDoc && (
                          <button onClick={handleExportToGoogleDocs} disabled={isExportingGDoc} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-600/30 rounded-lg text-xs font-bold transition-all">
                            {isExportingGDoc ? <Loader2 size={14} className="animate-spin"/> : <Cloud size={14} />}
                            <span className="hidden sm:inline">G-Drive</span>
                          </button>
                      )}
                      <button onClick={onClose} className="text-slate-400 hover:text-white p-2"><X size={20}/></button>
                  </div>
              </div>

              {(activeDiscussion?.transcript && activeDiscussion.transcript.length > 0 && activeDiscussion.id !== 'new') && (
                  <div className="flex space-x-2">
                      <button onClick={() => setViewMode('transcript')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors flex items-center justify-center space-x-2 ${viewMode === 'transcript' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}><MessageCircle size={16} /><span>Transcript</span></button>
                      <button onClick={() => setViewMode('doc')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors flex items-center justify-center space-x-2 ${viewMode === 'doc' ? 'bg-slate-800 text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}><FileText size={16} /><span>Specification</span></button>
                  </div>
              )}
          </div>
          
          <div className="p-6 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-slate-700 bg-slate-900">
              {loading ? (
                  <div className="text-center py-20 text-slate-500"><Loader2 size={32} className="animate-spin mx-auto mb-2"/><p>Syncing Document...</p></div>
              ) : activeDiscussion ? (
                  <>
                      {viewMode === 'transcript' ? (
                          <div className="space-y-4">
                              <div className="bg-slate-800/50 p-4 rounded-xl text-xs border border-slate-700 flex justify-between items-center">
                                  <div className="flex items-center gap-3">
                                      <div className="p-2 bg-emerald-900/30 rounded-full text-emerald-400"><Sparkles size={16}/></div>
                                      <div><p className="font-bold text-slate-200">Session Context</p><p className="text-slate-500">{activeDiscussion.userName} • {new Date(activeDiscussion.createdAt).toLocaleDateString()}</p></div>
                                  </div>
                                  {isOwner && (
                                    <button onClick={handleGenerateDoc} disabled={isGeneratingDoc} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold flex items-center gap-2 shadow-lg transition-all">{isGeneratingDoc ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14} />}AI Synthesize</button>
                                  )}
                              </div>
                              <div className="space-y-4 pt-4">
                                  {activeDiscussion.transcript?.map((item, idx) => (
                                      <div key={idx} className={`flex flex-col ${item.role === 'user' ? 'items-end' : 'items-start'}`}>
                                          <span className="text-[10px] text-slate-600 uppercase font-bold mb-1 px-1">{item.role === 'user' ? activeDiscussion.userName : 'AI Host'}</span>
                                          <div className={`px-4 py-2 rounded-2xl max-w-[90%] text-sm ${item.role === 'user' ? 'bg-indigo-900/40 text-indigo-100 border border-indigo-500/20' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}><p className="whitespace-pre-wrap">{item.text}</p></div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      ) : (
                          <div className="h-full flex flex-col min-h-[400px]">
                                <div className="flex justify-between items-center mb-6 sticky top-0 z-10 bg-slate-900 pb-2 border-b border-slate-800">
                                    <div className="flex gap-2">
                                        {isOwner && !isEditingDoc && activeDiscussion.id !== 'system-doc-001' && (
                                            <button onClick={handleDelete} className="px-3 py-1.5 text-xs text-red-400 hover:text-white bg-red-900/10 hover:bg-red-600 rounded-lg flex items-center gap-1 transition-all border border-red-900/30"><Trash2 size={14}/> <span>Delete</span></button>
                                        )}
                                        {isOwner && isEditingDoc && (
                                            <div className="flex gap-2">
                                                {TEMPLATES.map(t => (
                                                    <button key={t.id} onClick={() => handleApplyTemplate(t)} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded border border-slate-700 text-[10px] font-bold uppercase flex items-center gap-1"><t.icon size={10}/> {t.name}</button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex space-x-2">
                                        {isOwner && (
                                            isEditingDoc ? (
                                                <>
                                                    <button onClick={() => setIsEditingDoc(false)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 rounded-lg border border-slate-700">Cancel</button>
                                                    <button onClick={handleSaveDoc} disabled={isSavingDoc} className="px-4 py-1.5 text-xs text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg flex items-center gap-2 font-bold shadow-lg shadow-emerald-500/20">{isSavingDoc ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Save Changes</button>
                                                </>
                                            ) : (
                                                <button onClick={() => setIsEditingDoc(true)} className="px-4 py-1.5 text-xs text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg flex items-center gap-2 font-bold shadow-lg shadow-indigo-500/20"><Edit2 size={14}/> Edit Content</button>
                                            )
                                        )}
                                    </div>
                                </div>

                                {isEditingDoc ? (
                                    <textarea autoFocus value={editedDocContent} onChange={e => setEditedDocContent(e.target.value)} className="w-full flex-1 min-h-[500px] bg-slate-950 p-6 rounded-xl border border-slate-700 font-mono text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none leading-relaxed" placeholder="Start writing Markdown (Use ```plantuml for diagrams)..."/>
                                ) : (
                                    <div ref={exportRef} className="prose prose-invert prose-sm max-w-none bg-white p-12 rounded-xl border border-slate-800/50 min-h-[500px] text-slate-900 shadow-2xl">
                                        <div className="mb-10 border-b-4 border-emerald-600 pb-4 flex justify-between items-end">
                                            <h1 className="text-3xl font-black text-slate-950 m-0 uppercase tracking-tight">{docTitle}</h1>
                                            <span className="text-[10px] font-black text-slate-400 uppercase">AIVoiceCast Spec</span>
                                        </div>
                                        {editedDocContent ? <MarkdownView content={editedDocContent} /> : <div className="py-20 text-center text-slate-400 italic">This document is currently empty.</div>}
                                        <div className="mt-12 pt-6 border-t border-slate-100 flex justify-between items-center opacity-30">
                                            <span className="text-[8px] font-bold uppercase tracking-widest text-slate-500">Neural Prism Synthesis Engine</span>
                                            <span className="text-[8px] font-bold text-slate-500">{new Date(activeDiscussion.updatedAt || activeDiscussion.createdAt).toLocaleString()}</span>
                                        </div>
                                    </div>
                                )}
                          </div>
                      )}
                  </>
              ) : (
                  <p className="text-center text-red-400">Error: Document missing.</p>
              )}
          </div>
      </div>
    </div>
  );
};