
import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Book, Play, Terminal, MoreVertical, Plus, Edit3, Trash2, Cpu, Share2, Sparkles, Loader2, Save, Image as ImageIcon, X, ChevronUp, ChevronDown, Check, Zap, Wand2, Link } from 'lucide-react';
import { Notebook, NotebookCell } from '../types';
import { getCreatorNotebooks, saveNotebook, getNotebook } from '../services/firestoreService';
import { MarkdownView } from './MarkdownView';
import { GoogleGenAI } from '@google/genai';
import { resizeImage } from '../utils/imageUtils';
import { generateSecureId } from '../utils/idUtils';
import { ShareModal } from './ShareModal';

interface NotebookViewerProps {
  onBack: () => void;
  currentUser: any;
  notebookId?: string;
}

export const NotebookViewer: React.FC<NotebookViewerProps> = ({ onBack, currentUser, notebookId }) => {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [activeNotebook, setActiveNotebook] = useState<Notebook | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingCellId, setEditingCellId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Share State
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  // File upload ref for multimodal cells
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [targetCellForUpload, setTargetCellForUpload] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
        setLoading(true);
        if (notebookId) {
            const nb = await getNotebook(notebookId);
            if (nb) {
                setActiveNotebook(nb);
                setShareUrl(`${window.location.origin}?view=notebook_viewer&id=${nb.id}`);
            }
        }
        
        if (currentUser) {
            const data = await getCreatorNotebooks(currentUser.uid);
            setNotebooks(data);
            if (!activeNotebook && data.length > 0 && !notebookId) setActiveNotebook(data[0]);
        }
        setLoading(false);
    };
    init();
  }, [notebookId, currentUser]);

  const handleRunCell = async (cellId: string) => {
      if (!activeNotebook) return;
      
      const cellIndex = activeNotebook.cells.findIndex(c => c.id === cellId);
      const cell = activeNotebook.cells[cellIndex];
      if (!cell || cell.type !== 'code') return;

      // Update UI to show executing
      const updatedCells = [...activeNotebook.cells];
      updatedCells[cellIndex] = { ...cell, isExecuting: true, output: '' };
      setActiveNotebook({ ...activeNotebook, cells: updatedCells });

      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          
          // Construct Context from previous cells
          const context = activeNotebook.cells
              .slice(0, cellIndex)
              .map(c => `${c.type.toUpperCase()}: ${c.content}\n${c.output ? `OUTPUT: ${c.output}` : ''}`)
              .join('\n---\n');

          const prompt = `
            CONTEXT FROM PREVIOUS CELLS:
            ${context}

            CURRENT TASK:
            ${cell.content}

            INSTRUCTIONS: Respond concisely and accurately based on the context above.
          `;

          const response = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: prompt,
          });

          const result = response.text || "No output returned.";
          
          // Update output
          const finalCells = [...activeNotebook.cells];
          finalCells[cellIndex] = { ...cell, isExecuting: false, output: result };
          setActiveNotebook({ ...activeNotebook, cells: finalCells });

      } catch (e: any) {
          const errorCells = [...activeNotebook.cells];
          errorCells[cellIndex] = { ...cell, isExecuting: false, output: `Error: ${e.message}` };
          setActiveNotebook({ ...activeNotebook, cells: errorCells });
      }
  };

  const handleUpdateCell = (cellId: string, content: string) => {
      if (!activeNotebook) return;
      const nextCells = activeNotebook.cells.map(c => c.id === cellId ? { ...c, content } : c);
      setActiveNotebook({ ...activeNotebook, cells: nextCells });
  };

  const handleCreateNotebook = () => {
      const newNb: Notebook = {
          id: generateSecureId(),
          title: 'New Research Session',
          author: currentUser?.displayName || 'Anonymous',
          description: 'A fresh workspace for neural exploration and prompt engineering.',
          kernel: 'python',
          tags: ['Lab', 'Research'],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          cells: [
              {
                  id: `cell-${Date.now()}-1`,
                  type: 'markdown',
                  content: '# New Lab Session\nUse AI cells below to start generating content or analyzing data.'
              },
              {
                  id: `cell-${Date.now()}-2`,
                  type: 'code',
                  content: '# Enter AI instructions here...',
                  language: 'python'
              }
          ]
      };
      setNotebooks(prev => [newNb, ...prev]);
      setActiveNotebook(newNb);
      setEditingCellId(null);
  };

  const handleAddCell = (index: number, type: 'markdown' | 'code') => {
      if (!activeNotebook) return;
      const newCell: NotebookCell = {
          id: `cell-${Date.now()}`,
          type,
          content: type === 'code' ? '# Enter prompt here...' : '## New Section',
          language: 'python'
      };
      const nextCells = [...activeNotebook.cells];
      nextCells.splice(index + 1, 0, newCell);
      setActiveNotebook({ ...activeNotebook, cells: nextCells });
      setEditingCellId(newCell.id);
  };

  const handleDeleteCell = (cellId: string) => {
      if (!activeNotebook) return;
      if (activeNotebook.cells.length <= 1) return;
      const nextCells = activeNotebook.cells.filter(c => c.id !== cellId);
      setActiveNotebook({ ...activeNotebook, cells: nextCells });
  };

  const renderCell = (cell: NotebookCell, index: number) => {
      const isCode = cell.type === 'code';
      const isEditing = editingCellId === cell.id;
      
      return (
          <div key={cell.id} className="group relative mb-4">
              {/* Toolbar between cells */}
              <div className="absolute -top-3 left-0 right-0 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20">
                  <div className="bg-slate-800 border border-slate-700 rounded-full px-2 py-1 flex items-center gap-2 shadow-xl scale-90">
                      <button onClick={() => handleAddCell(index - 1, 'code')} className="flex items-center gap-1 text-[10px] font-bold text-indigo-400 hover:text-white transition-colors">
                          <Plus size={10}/> AI Cell
                      </button>
                      <div className="w-px h-3 bg-slate-700"></div>
                      <button onClick={() => handleAddCell(index - 1, 'markdown')} className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-white transition-colors">
                          <Plus size={10}/> Markdown
                      </button>
                  </div>
              </div>

              {/* Cell Gutter */}
              <div className="absolute -left-12 top-4 text-[10px] font-mono text-slate-600 w-8 text-right select-none">
                  [{index + 1}]
              </div>
              
              <div className={`rounded-xl border transition-all ${isCode ? (isEditing ? 'border-indigo-500 bg-slate-900/50' : 'border-slate-800 bg-slate-950') : 'border-transparent'}`}>
                  {isCode ? (
                      <div className="relative">
                          <div className={`flex items-center justify-between px-4 py-1.5 rounded-t-xl transition-colors ${isEditing ? 'bg-indigo-600/20' : 'bg-slate-900 border-b border-slate-800'}`}>
                              <div className="flex items-center gap-3">
                                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1">
                                      <Cpu size={12}/> AI Logic
                                  </span>
                                  <div className="flex items-center gap-1">
                                      <button onClick={() => setEditingCellId(isEditing ? null : cell.id)} className="p-1 text-slate-500 hover:text-white"><Edit3 size={12}/></button>
                                      <button onClick={() => handleDeleteCell(cell.id)} className="p-1 text-slate-500 hover:text-red-400"><Trash2 size={12}/></button>
                                  </div>
                              </div>
                              <div className="flex items-center gap-2">
                                  <button 
                                      onClick={() => handleRunCell(cell.id)}
                                      disabled={cell.isExecuting}
                                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all shadow-lg active:scale-95 ${cell.isExecuting ? 'bg-slate-800 text-slate-500' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20'}`}
                                  >
                                      {cell.isExecuting ? <Loader2 size={12} className="animate-spin"/> : <Zap size={12} fill="currentColor"/>}
                                      Run
                                  </button>
                              </div>
                          </div>

                          {isEditing ? (
                              <textarea
                                  autoFocus
                                  value={cell.content}
                                  onChange={(e) => handleUpdateCell(cell.id, e.target.value)}
                                  className="w-full bg-transparent p-4 text-sm font-mono text-indigo-200 outline-none resize-none min-h-[100px] scrollbar-hide"
                                  placeholder="Describe what the AI should do..."
                                  onBlur={() => setEditingCellId(null)}
                                  onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleRunCell(cell.id); }}
                              />
                          ) : (
                              <pre className="p-4 overflow-x-auto text-sm font-mono text-slate-300 cursor-text" onClick={() => setEditingCellId(cell.id)}>
                                  <code>{cell.content}</code>
                              </pre>
                          )}

                          {cell.output && (
                              <div className="border-t border-slate-800 p-4 bg-indigo-950/20 rounded-b-xl animate-fade-in">
                                  <div className="flex items-center gap-2 mb-2 text-indigo-400 text-[10px] font-bold uppercase tracking-widest">
                                      <Check size={12}/> Neural Output
                                  </div>
                                  <div className="text-sm text-slate-300 leading-relaxed overflow-x-auto prose prose-invert prose-sm max-w-none">
                                      <MarkdownView content={cell.output} />
                                  </div>
                              </div>
                          )}
                          {cell.isExecuting && !cell.output && (
                              <div className="border-t border-slate-800 p-8 flex flex-col items-center justify-center gap-2 text-slate-500">
                                  <Loader2 size={24} className="animate-spin text-indigo-500 opacity-50"/>
                                  <span className="text-[10px] font-bold uppercase animate-pulse">Thinking...</span>
                              </div>
                          )}
                      </div>
                  ) : (
                      <div className="relative group/md">
                          <div className="absolute -right-8 top-0 opacity-0 group-hover/md:opacity-100 flex flex-col gap-1 transition-opacity">
                              <button onClick={() => setEditingCellId(isEditing ? null : cell.id)} className="p-1.5 bg-slate-800 rounded-lg text-slate-400 hover:text-white shadow-lg"><Edit3 size={14}/></button>
                              <button onClick={() => handleDeleteCell(cell.id)} className="p-1.5 bg-slate-800 rounded-lg text-slate-400 hover:text-red-400 shadow-lg"><Trash2 size={14}/></button>
                          </div>
                          
                          {isEditing ? (
                              <textarea
                                  autoFocus
                                  value={cell.content}
                                  onChange={(e) => handleUpdateCell(cell.id, e.target.value)}
                                  className="w-full bg-slate-900 border border-indigo-500/50 rounded-xl p-6 text-sm text-slate-200 outline-none resize-none min-h-[150px]"
                                  onBlur={() => setEditingCellId(null)}
                              />
                          ) : (
                              <div className="px-4 py-2 prose prose-invert max-w-none cursor-text" onClick={() => setEditingCellId(cell.id)}>
                                  <MarkdownView content={cell.content} />
                              </div>
                          )}
                      </div>
                  )}
              </div>
          </div>
      );
  };

  const handleSaveAndShare = async () => {
      if (!activeNotebook || !currentUser) return alert("Please sign in to save and share.");
      setIsSaving(true);
      try {
          const finalId = await saveNotebook({ 
              ...activeNotebook, 
              ownerId: currentUser.uid,
              updatedAt: Date.now() 
          });
          const url = `${window.location.origin}?view=notebook_viewer&id=${finalId}`;
          setShareUrl(url);
          setShowShareModal(true);
      } catch (e) {
          alert("Failed to save notebook.");
      } finally {
          setIsSaving(false);
      }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
      
      {/* Sidebar: Lab Manager */}
      <div className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-800 flex items-center gap-3 bg-slate-950/40">
              <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                  <ArrowLeft size={20} />
              </button>
              <h2 className="font-black text-white flex items-center gap-2 uppercase tracking-tighter italic">
                  Neural Lab
              </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
              <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active Research</div>
              {loading ? (
                  <div className="p-8 text-center"><Loader2 size={24} className="animate-spin mx-auto text-indigo-500 opacity-50"/></div>
              ) : notebooks.map(nb => (
                  <button
                      key={nb.id}
                      onClick={() => { setActiveNotebook(nb); setEditingCellId(null); setShareUrl(''); }}
                      className={`w-full text-left p-4 rounded-xl border transition-all group ${activeNotebook?.id === nb.id ? 'bg-indigo-600/10 border-indigo-500/30' : 'border-transparent hover:bg-slate-800'}`}
                  >
                      <h3 className={`font-bold text-sm ${activeNotebook?.id === nb.id ? 'text-indigo-300' : 'text-slate-200 group-hover:text-white'}`}>{nb.title}</h3>
                      <div className="flex items-center gap-2 mt-2">
                          <span className="text-[9px] px-1.5 py-0.5 bg-slate-950 rounded text-slate-400 font-mono border border-slate-800">v5.1.0</span>
                          <span className="text-[9px] text-slate-600 uppercase font-bold tracking-tighter">{nb.cells.length} Blocks</span>
                      </div>
                  </button>
              ))}
          </div>
          
          <div className="p-4 border-t border-slate-800 bg-slate-950/40">
              <button onClick={handleCreateNotebook} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all border border-slate-700">
                  <Plus size={14}/> Create New Lab
              </button>
          </div>
      </div>

      {/* Main Content: Interactive Notebook */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950 relative">
          {activeNotebook ? (
              <>
                  <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur-md sticky top-0 z-30">
                      <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-indigo-600/10 rounded-xl flex items-center justify-center border border-indigo-500/20 text-indigo-400">
                              <Wand2 size={20}/>
                          </div>
                          <div>
                              <h1 className="text-base font-bold text-white flex items-center gap-2">
                                  {activeNotebook.title}
                                  <span className="text-[10px] font-black text-emerald-400 bg-emerald-900/20 px-2 py-0.5 rounded border border-emerald-500/20 uppercase tracking-widest">Interactive</span>
                              </h1>
                              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Last Synced: Just now</p>
                          </div>
                      </div>
                      <div className="flex items-center gap-2">
                          <button onClick={handleSaveAndShare} disabled={isSaving} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-lg flex items-center gap-2 transition-all active:scale-95">
                              {isSaving ? <Loader2 size={14} className="animate-spin"/> : <Share2 size={14}/>}
                              Save & Share URI
                          </button>
                          <div className="w-px h-6 bg-slate-800 mx-1"></div>
                          <button className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"><MoreVertical size={18}/></button>
                      </div>
                  </header>

                  <div className="flex-1 overflow-y-auto p-8 lg:px-24 scrollbar-thin scrollbar-thumb-slate-800">
                      <div className="max-w-4xl mx-auto w-full pb-32">
                          
                          {/* Title Metadata Section */}
                          <div className="mb-12 space-y-4">
                              <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em]">Scientific Notebook v5.1.0</span>
                              <h1 className="text-5xl font-black text-white leading-tight tracking-tighter italic">{activeNotebook.title}</h1>
                              <p className="text-lg text-slate-400 font-medium max-w-2xl leading-relaxed">{activeNotebook.description}</p>
                              <div className="flex gap-4 pt-4">
                                  <div className="flex flex-col">
                                      <span className="text-[9px] text-slate-600 uppercase font-bold">Author</span>
                                      <span className="text-sm font-bold text-slate-300">@{activeNotebook.author}</span>
                                  </div>
                                  <div className="w-px h-8 bg-slate-800"></div>
                                  <div className="flex flex-col">
                                      <span className="text-[9px] text-slate-600 uppercase font-bold">Kernel</span>
                                      <span className="text-sm font-mono text-indigo-400">Gemini-3-Flash (API)</span>
                                  </div>
                              </div>
                          </div>

                          <div className="space-y-2">
                              {activeNotebook.cells.map((cell, index) => renderCell(cell, index))}
                          </div>

                          {/* Final "Add Cell" Zone */}
                          <div className="mt-12 py-12 border-t border-slate-800 flex flex-col items-center justify-center gap-6">
                              <div className="flex gap-4">
                                  <button onClick={() => handleAddCell(activeNotebook.cells.length - 1, 'code')} className="flex items-center gap-2 px-6 py-3 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-2xl border border-indigo-500/20 font-bold text-sm transition-all shadow-xl shadow-indigo-500/5 group">
                                      <Zap size={18} className="group-hover:fill-current"/> Add AI Cell
                                  </button>
                                  <button onClick={() => handleAddCell(activeNotebook.cells.length - 1, 'markdown')} className="flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-2xl border border-slate-700 font-bold text-sm transition-all">
                                      <Edit3 size={18}/> Add Markdown
                                  </button>
                              </div>
                              <p className="text-xs text-slate-600 font-bold uppercase tracking-widest">End of Lab Session</p>
                          </div>
                      </div>
                  </div>
              </>
          ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-700 bg-slate-950">
                  <div className="relative mb-8">
                    <div className="w-24 h-24 bg-indigo-600/5 rounded-[2.5rem] border border-indigo-500/10 flex items-center justify-center">
                        <Book size={48} className="opacity-20"/>
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center border-4 border-slate-950 text-white">
                        <Plus size={16}/>
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-slate-500 mb-2">Neural Lab Scratchpad</h3>
                  <p className="text-sm max-w-sm text-center text-slate-600 leading-relaxed mb-8">
                      Select a research session from the sidebar or start a new prompt-based coding notebook.
                  </p>
                  <button 
                    onClick={handleCreateNotebook}
                    className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm shadow-xl shadow-indigo-500/20 transition-all active:scale-95"
                  >
                      <Sparkles size={18}/>
                      Start New Research Session
                  </button>
              </div>
          )}
      </div>

      {showShareModal && shareUrl && (
          <ShareModal 
            isOpen={true} onClose={() => setShowShareModal(false)}
            link={shareUrl} title={activeNotebook?.title || 'Research Notebook'}
            onShare={async () => {}} currentUserUid={currentUser?.uid}
          />
      )}

      {/* Hidden Multimodal File Input */}
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={async (e) => {
          if (e.target.files?.[0] && targetCellForUpload && activeNotebook) {
              const base64 = await resizeImage(e.target.files[0], 512, 0.7);
              handleUpdateCell(targetCellForUpload, activeNotebook.cells.find(c => c.id === targetCellForUpload)?.content + `\n\n[ATTACHED IMAGE: ${e.target.files[0].name}]`);
          }
      }}/>
    </div>
  );
};
