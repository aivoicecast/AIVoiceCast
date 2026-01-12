import React, { useState, useEffect, useRef } from 'react';
import { X, MessageCircle, FileText, Loader2, Edit2, Save, Sparkles, Cloud, Trash2, RefreshCw, Info, Lock, Globe, Users, ChevronDown, Check, Download, Image as ImageIcon, FileCode, Type } from 'lucide-react';
import { CommunityDiscussion, Group, ChannelVisibility, UserProfile } from '../types';
import { getDiscussionById, subscribeToDiscussion, saveDiscussionDesignDoc, saveDiscussion, deleteDiscussion, updateDiscussionVisibility, getUserGroups, getUserProfile, isUserAdmin } from '../services/firestoreService';
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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  
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

      if (currentUser) {
          getUserProfile(currentUser.uid).then(setProfile);
      }

      if (discussionId !== 'new') {
        setLoading(true);
        getDiscussionById(discussionId).then(data => {
            if (data) {
                setActiveDiscussion(data);
                setDocTitle(data.title || 'Untitled Document');
                setEditedDocContent(data.designDoc || '');
                lastSavedContent.current = data.designDoc || '';
                
                const hasTranscript = data.transcript && data.transcript.length > 0;
                if (data.isManual || data.designDoc || !hasTranscript) setViewMode('doc');
                else setViewMode('transcript');

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
      if (docTitle === 'New Specification') setDocTitle(template.name);
  };

  const handleGenerateDoc = async () => {
      if (!activeDiscussion) return;
      if (!activeDiscussion.transcript || activeDiscussion.transcript.length === 0) return alert("Transcript empty.");
      setIsGeneratingDoc(true);
      try {
          const dateStr = new Date().toLocaleDateString('en-US');
          const meta = { date: dateStr, topic: docTitle || activeLectureTopic || "Discussion", segmentIndex: activeDiscussion.segmentIndex };
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
      const updatedDoc = { ...activeDiscussion, title: docTitle || 'Untitled Document', designDoc: editedDocContent, updatedAt: Date.now() };
      if (!currentUser) {
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
    } catch (e) { alert("Failed to save."); } finally { setIsSavingDoc(false); }
  };

  const handleExportPDF = async () => {
      if (!exportRef.current) return;
      setIsExportingPDF(true);
      try {
          const canvas = await html2canvas(exportRef.current, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });
          const imgData = canvas.toDataURL('image/jpeg', 1.0);
          const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' });
          pdf.addImage(imgData, 'JPEG', 0, 0, pdf.internal.pageSize.getWidth(), (canvas.height * pdf.internal.pageSize.getWidth()) / canvas.width);
          pdf.save(`${docTitle.replace(/\s+/g, '_')}.pdf`);
      } catch (e) { alert("PDF failed."); } finally { setIsExportingPDF(false); }
  };

  const handleUpdateVisibility = async (v: ChannelVisibility, gId?: string) => {
      if (!activeDiscussion || activeDiscussion.id === 'new' || activeDiscussion.userId === 'guest') {
          setActiveDiscussion(prev => prev ? ({ ...prev, visibility: v, groupIds: gId ? (prev.groupIds?.includes(gId) ? prev.groupIds : [...(prev.groupIds || []), gId]) : prev.groupIds }) : null);
          return;
      }
      try {
          const nextGroupIds = [...(activeDiscussion.groupIds || [])];
          if (v === 'group' && gId && !nextGroupIds.includes(gId)) nextGroupIds.push(gId);
          await updateDiscussionVisibility(activeDiscussion.id, v, nextGroupIds);
          setActiveDiscussion({ ...activeDiscussion, visibility: v, groupIds: nextGroupIds });
      } catch (e) { alert("Failed."); }
  };

  const isSuperAdmin = isUserAdmin(profile);
  const isOwner = !activeDiscussion || activeDiscussion.userId === 'guest' || (currentUser && activeDiscussion.userId === currentUser.uid) || isSuperAdmin;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in-up">
          <div className="p-4 border-b border-slate-800 bg-slate-900 shrink-0">
              <div className="flex justify-between items-center mb-4 gap-4">
                  <div className="flex items-center gap-2 flex-1">
                      <FileText size={20} className="text-emerald-400 shrink-0" />
                      <input type="text" value={docTitle} readOnly={!isOwner} onChange={(e) => setDocTitle(e.target.value)} className={`bg-transparent border-b border-transparent ${isOwner ? 'hover:border-slate-700 focus:border-indigo-500' : ''} text-lg font-bold text-white focus:outline-none w-full transition-colors truncate`} placeholder="Document Title"/>
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
                                        {userGroups.map(g => (<button key={g.id} onClick={() => { handleUpdateVisibility('group', g.id); setShowVisibilityMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-slate-700 text-xs text-slate-300 flex items-center gap-2 truncate"><Users size={12}/> {g.name}</button>))}
                                    </div>
                                  </>
                              )}
                          </div>
                      )}
                      {editedDocContent && !isEditingDoc && (<button onClick={handleExportPDF} disabled={isExportingPDF} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-all border border-slate-700">{isExportingPDF ? <Loader2 size={14} className="animate-spin"/> : <Download size={14} />}<span className="hidden sm:inline">PDF</span></button>)}
                      <button onClick={onClose} className="text-slate-400 hover:text-white p-2"><X size={20}/></button>
                  </div>
              </div>
              {(activeDiscussion?.transcript?.length || 0) > 0 && activeDiscussion?.id !== 'new' && (
                  <div className="flex space-x-2">
                      <button onClick={() => setViewMode('transcript')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors flex items-center justify-center space-x-2 ${viewMode === 'transcript' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}><MessageCircle size={16} /><span>Transcript</span></button>
                      <button onClick={() => setViewMode('doc')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors flex items-center justify-center space-x-2 ${viewMode === 'doc' ? 'bg-slate-800 text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}><FileText size={16} /><span>Specification</span></button>
                  </div>
              )}
          </div>
          <div className={`flex-1 overflow-y-auto ${isEditingDoc ? 'bg-slate-900' : ''} scrollbar-thin`}>
              {loading ? (<div className="text-center py-20 text-slate-500"><Loader2 size={32} className="animate-spin mx-auto mb-2"/><p>Syncing Document...</p></div>) : activeDiscussion ? (
                  <div className="p-6 md:p-10 max-w-4xl mx-auto">
                      {viewMode === 'transcript' ? (
                          <div className="space-y-4 animate-fade-in text-slate-300">
                              <div className="bg-slate-800/50 p-4 rounded-xl text-xs border border-slate-700 flex justify-between items-center"><div className="flex items-center gap-3"><div className="p-2 bg-emerald-900/30 rounded-full text-emerald-400"><Sparkles size={16}/></div><div><p className="font-bold text-slate-200">Session Context</p><p className="text-slate-500">{activeDiscussion.userName} • {new Date(activeDiscussion.createdAt).toLocaleDateString()}</p></div></div>{isOwner && (<button onClick={handleGenerateDoc} disabled={isGeneratingDoc} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold flex items-center gap-2 shadow-lg transition-all">{isGeneratingDoc ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14} />}AI Synthesize</button>)}</div>
                              <div className="space-y-4 pt-4">{activeDiscussion.transcript?.map((item, idx) => (
                                  <div key={idx} className={`flex flex-col ${item.role === 'user' ? 'items-end' : 'items-start'}`}>
                                      <span className="text-[10px] text-slate-600 uppercase font-bold mb-1 px-1">{item.role === 'user' ? activeDiscussion.userName : 'AI Host'}</span>
                                      <div className={`px-4 py-2 rounded-2xl max-w-[90%] text-sm ${item.role === 'user' ? 'bg-indigo-900/40 text-indigo-100 border border-indigo-500/20' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}>
                                          <p className="whitespace-pre-wrap">{item.text}</p>
                                      </div>
                                  </div>
                              ))}</div>
                          </div>
                      ) : (
                          <div className="h-full flex flex-col min-h-[400px]">
                                <div className={`flex justify-between items-center mb-6 sticky top-0 z-10 ${isEditingDoc ? 'bg-slate-900' : ''} pb-2 border-b border-white/5`}>
                                    <div className="flex gap-2">{isOwner && isEditingDoc && TEMPLATES.map(t => (<button key={t.id} onClick={() => handleApplyTemplate(t)} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded border border-slate-700 text-[10px] font-bold uppercase flex items-center gap-1"><t.icon size={10}/> {t.name}</button>))}</div>
                                    <div className="flex space-x-2">{isOwner && (isEditingDoc ? (<><button onClick={() => setIsEditingDoc(false)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 rounded-lg border border-slate-700">Cancel</button><button onClick={handleSaveDoc} disabled={isSavingDoc} className="px-4 py-1.5 text-xs text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg flex items-center gap-2 font-bold shadow-lg">{isSavingDoc ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Save</button></>) : (<button onClick={() => setIsEditingDoc(true)} className="px-4 py-1.5 text-xs text-white bg-slate-900 hover:bg-indigo-600 rounded-lg flex items-center gap-2 font-bold shadow-lg transition-all"><Edit2 size={14}/> Edit Content</button>)) }</div>
                                </div>
                                {isEditingDoc ? (
                                    <textarea autoFocus value={editedDocContent} onChange={e => setEditedDocContent(e.target.value)} className="w-full flex-1 min-h-[500px] bg-slate-950 p-6 rounded-xl border border-slate-700 font-mono text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none leading-relaxed" placeholder="Start writing Markdown..."/>
                                ) : (
                                    <div ref={exportRef} className="rounded-xl overflow-hidden shadow-2xl">
                                        <MarkdownView 
                                            content={editedDocContent} 
                                            initialTheme={profile?.preferredReaderTheme || 'slate'} 
                                            showThemeSwitcher={true}
                                        />
                                    </div>
                                )}
                          </div>
                      )}
                  </div>
              ) : <p className="text-center text-red-400 p-20">Document missing.</p>}
          </div>
      </div>
    </div>
  );
};
