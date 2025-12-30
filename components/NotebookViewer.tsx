
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Book, Play, Terminal, MoreVertical, Plus, Edit3, Trash2, Cpu, Share2, Sparkles, Loader2 } from 'lucide-react';
import { Notebook, NotebookCell } from '../types';
import { getCreatorNotebooks } from '../services/firestoreService';
import { MarkdownView } from './MarkdownView';
import { GoogleGenAI } from '@google/genai';

interface NotebookViewerProps {
  onBack: () => void;
  currentUser: any;
}

export const NotebookViewer: React.FC<NotebookViewerProps> = ({ onBack, currentUser }) => {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [activeNotebook, setActiveNotebook] = useState<Notebook | null>(null);
  const [loading, setLoading] = useState(true);
  
  // AI Explanation State
  const [explainingCellId, setExplainingCellId] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);

  useEffect(() => {
    // Load mock notebooks
    getCreatorNotebooks('system').then(data => {
      setNotebooks(data);
      setLoading(false);
    });
  }, []);

  const handleExplainCell = async (cell: NotebookCell) => {
      if (explainingCellId === cell.id) {
          setExplainingCellId(null);
          setExplanation(null);
          return;
      }
      
      setExplainingCellId(cell.id);
      setExplanation(null);
      
      try {
          // FIX: Always use const ai = new GoogleGenAI({apiKey: process.env.API_KEY}); exclusively from process.env.API_KEY.
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const prompt = `Explain the following code snippet concisely for a student:\n\n${cell.content}`;
          
          const response = await ai.models.generateContent({
              // FIX: Use gemini-3-flash-preview as recommended for text explanation tasks
              model: 'gemini-3-flash-preview',
              contents: prompt
          });
          
          setExplanation(response.text || "No explanation generated.");
      } catch (e: any) {
          setExplanation("Error: " + e.message);
      }
  };

  const renderCell = (cell: NotebookCell, index: number) => {
      const isCode = cell.type === 'code';
      
      return (
          <div key={cell.id} className="group relative mb-6">
              {/* Cell Gutter/Number */}
              <div className="absolute -left-12 top-0 text-xs font-mono text-slate-600 w-8 text-right select-none">
                  [{index + 1}]
              </div>
              
              <div className={`rounded-xl border ${isCode ? 'border-slate-800 bg-slate-950' : 'border-transparent'}`}>
                  {isCode ? (
                      <div className="relative">
                          <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 rounded-t-xl">
                              <span className="text-xs font-mono text-indigo-400">{cell.language || 'python'}</span>
                              <div className="flex items-center gap-2">
                                  <button 
                                      onClick={() => handleExplainCell(cell)}
                                      className="p-1 text-slate-400 hover:text-emerald-400 transition-colors"
                                      title="Explain with AI"
                                  >
                                      <Sparkles size={14}/>
                                  </button>
                                  <button className="p-1 text-slate-400 hover:text-white transition-colors"><Play size={14}/></button>
                              </div>
                          </div>
                          <pre className="p-4 overflow-x-auto text-sm font-mono text-slate-300">
                              <code>{cell.content}</code>
                          </pre>
                          {/* AI Explanation Overlay */}
                          {explainingCellId === cell.id && (
                              <div className="border-t border-slate-800 p-4 bg-indigo-900/10 animate-fade-in">
                                  <div className="flex items-center gap-2 mb-2 text-indigo-300 text-xs font-bold uppercase">
                                      <Sparkles size={12}/> AI Explanation
                                  </div>
                                  {explanation ? (
                                      <p className="text-sm text-slate-300 leading-relaxed">{explanation}</p>
                                  ) : (
                                      <div className="flex items-center gap-2 text-slate-500 text-sm">
                                          <Loader2 size={14} className="animate-spin"/> Analyzing code...
                                      </div>
                                  )}
                              </div>
                          )}
                          {cell.output && (
                              <div className="border-t border-slate-800 p-4 bg-black/30 font-mono text-xs text-slate-400 rounded-b-xl">
                                  {cell.output}
                              </div>
                          )}
                      </div>
                  ) : (
                      <div className="px-4 py-2 prose prose-invert max-w-none">
                          <MarkdownView content={cell.content} />
                      </div>
                  )}
              </div>
          </div>
      );
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
      
      {/* Sidebar List */}
      <div className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-800 flex items-center gap-3">
              <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                  <ArrowLeft size={20} />
              </button>
              <h2 className="font-bold text-white flex items-center gap-2">
                  <Book className="text-indigo-400" size={20} />
                  Notebooks
              </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loading ? (
                  <div className="p-8 text-center text-slate-500 text-sm">Loading notebooks...</div>
              ) : notebooks.map(nb => (
                  <button
                      key={nb.id}
                      onClick={() => setActiveNotebook(nb)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${activeNotebook?.id === nb.id ? 'bg-indigo-600/10 border-indigo-500/50' : 'border-transparent hover:bg-slate-800'}`}
                  >
                      <h3 className={`font-bold text-sm ${activeNotebook?.id === nb.id ? 'text-indigo-300' : 'text-slate-200'}`}>{nb.title}</h3>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{nb.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-950 rounded text-slate-400 font-mono border border-slate-800">{nb.kernel}</span>
                          <span className="text-[10px] text-slate-600">{new Date(nb.updatedAt).toLocaleDateString()}</span>
                      </div>
                  </button>
              ))}
          </div>
          
          <div className="p-4 border-t border-slate-800">
              <button className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors">
                  <Plus size={16}/> New Notebook
              </button>
          </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950 relative">
          {activeNotebook ? (
              <>
                  <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
                      <div>
                          <h1 className="text-lg font-bold text-white flex items-center gap-2">
                              {activeNotebook.title}
                              <span className="text-xs font-normal text-slate-500 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">Read Only</span>
                          </h1>
                          <p className="text-xs text-slate-400">By {activeNotebook.author}</p>
                      </div>
                      <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 rounded-lg border border-slate-700">
                              <Cpu size={14} className="text-emerald-400"/>
                              <span className="text-xs font-mono text-slate-300">Kernel: {activeNotebook.kernel}</span>
                          </div>
                          <button className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"><Share2 size={18}/></button>
                          <button className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"><MoreVertical size={18}/></button>
                      </div>
                  </header>

                  <div className="flex-1 overflow-y-auto p-8 lg:px-16 max-w-5xl mx-auto w-full">
                      {activeNotebook.cells.map((cell, index) => renderCell(cell, index))}
                      
                      <div className="py-12 border-t-2 border-dashed border-slate-800 mt-8 text-center text-slate-500 text-sm">
                          End of Notebook
                      </div>
                  </div>
              </>
          ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
                  <Book size={64} className="mb-6 opacity-20"/>
                  <h3 className="text-xl font-bold text-slate-500 mb-2">Select a Notebook</h3>
                  <p className="text-sm max-w-sm text-center">
                      Browse the collection of AI-generated research and coding tutorials from the sidebar.
                  </p>
              </div>
          )}
      </div>
    </div>
  );
};
