
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { CodeProject, CodeFile, UserProfile, Channel, CursorPosition, CloudItem } from '../types';
import { ArrowLeft, Save, Plus, Github, Cloud, HardDrive, Code, X, ChevronRight, ChevronDown, File, Folder, DownloadCloud, Loader2, CheckCircle, AlertTriangle, Info, FolderPlus, FileCode, RefreshCw, LogIn, CloudUpload, Trash2, ArrowUp, Edit2, FolderOpen, MoreVertical, Send, MessageSquare, Bot, Mic, Sparkles, SidebarClose, SidebarOpen, Users, Eye, FileText as FileTextIcon, Image as ImageIcon, StopCircle, Minus, Maximize2, Minimize2, Lock, Unlock, Share2, Terminal as TerminalIcon, Copy, WifiOff, PanelRightClose, PanelRightOpen, PanelLeftClose, PanelLeftOpen, Monitor, Laptop, PenTool, Edit3, ShieldAlert, ZoomIn, ZoomOut, Columns, Rows, Grid2X2, Square as SquareIcon, GripVertical, GripHorizontal, FileSearch, Indent, Wand2, Check, Link, MousePointer2, Activity, Key, Search, FilePlus, FileUp, Play, Trash, ExternalLink, GraduationCap, ShieldCheck } from 'lucide-react';
import { listCloudDirectory, saveProjectToCloud, deleteCloudItem, createCloudFolder, subscribeToCodeProject, saveCodeProject, updateCodeFile, updateCursor, claimCodeProjectLock, updateProjectActiveFile, deleteCodeFile, updateProjectAccess, sendShareNotification, deleteCloudFolderRecursive } from '../services/firestoreService';
import { ensureCodeStudioFolder, listDriveFiles, readDriveFile, saveToDrive, deleteDriveFile, createDriveFolder, DriveFile, moveDriveFile, shareFileWithEmail, getDriveFileSharingLink, downloadDriveFileAsBlob } from '../services/googleDriveService';
import { connectGoogleDrive, getDriveToken, signInWithGitHub } from '../services/authService';
import { fetchRepoInfo, fetchRepoContents, fetchFileContent, updateRepoFile, fetchUserRepos, fetchRepoSubTree } from '../services/githubService';
import { MarkdownView } from './MarkdownView';
import { Whiteboard } from './Whiteboard';
import { ShareModal } from './ShareModal';
import { generateSecureId } from '../utils/idUtils';
import { GoogleGenAI, FunctionDeclaration, Type } from '@google/genai';
import Editor from '@monaco-editor/react';

interface TreeNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: TreeNode[];
  data?: any;
  isLoaded?: boolean;
  status?: 'modified' | 'new' | 'deleted';
}

type LayoutMode = 'single' | 'split-v' | 'split-h' | 'quad';
type IndentMode = 'tabs' | 'spaces';

interface CodeStudioProps {
  onBack: () => void;
  currentUser: any;
  userProfile: UserProfile | null;
  sessionId?: string;
  accessKey?: string;
  onSessionStart: (id: string) => void;
  onSessionStop: (id: string) => void;
  onStartLiveSession: (channel: Channel, context?: string) => void;
  initialFiles?: CodeFile[];
  externalChatContent?: { role: 'user' | 'ai', text: string }[];
  onSendExternalMessage?: (text: string) => void;
  isInterviewerMode?: boolean;
  isAiThinking?: boolean;
  onFileChange?: (file: CodeFile) => void;
}

function getLanguageFromExt(filename: string): CodeFile['language'] {
    if (!filename) return 'text';
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'jsx') return 'javascript (react)';
    if (ext === 'tsx') return 'typescript (react)';
    if (ext === 'js') return 'javascript';
    if (ext === 'ts') return 'typescript';
    if (ext === 'py') return 'python';
    if (['cpp', 'hpp', 'cc', 'cxx'].includes(ext || '')) return 'c++';
    if (ext === 'c' || ext === 'h') return 'c';
    if (ext === 'java') return 'java';
    if (ext === 'rs') return 'rust';
    if (ext === 'go') return 'go';
    if (ext === 'cs') return 'c#';
    if (ext === 'html') return 'html';
    if (ext === 'css') return 'css';
    if (ext === 'json') return 'json';
    if (ext === 'md') return 'markdown';
    if (['puml', 'plantuml'].includes(ext || '')) return 'plantuml';
    if (['draw', 'whiteboard', 'wb'].includes(ext || '')) return 'whiteboard';
    if (ext === 'pdf') return 'pdf';
    return 'text';
}

const CURSOR_COLORS = [
    '#f87171', '#fb923c', '#fbbf24', '#facc15', '#a3e635', 
    '#4ade80', '#34d399', '#2dd4bf', '#22d3ee', '#38bdf8', 
    '#60a5fa', '#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#fb7185'
];

const FileIcon = ({ filename }: { filename: string }) => {
    if (!filename) return <File size={16} className="text-slate-500" />;
    const lang = getLanguageFromExt(filename);
    if (lang === 'javascript' || lang === 'typescript' || lang === 'javascript (react)' || lang === 'typescript (react)') return <FileCode size={16} className="text-yellow-400" />;
    if (lang === 'python') return <FileCode size={16} className="text-blue-400" />;
    if (lang === 'c++' || lang === 'c') return <FileCode size={16} className="text-indigo-400" />;
    if (lang === 'html') return <FileCode size={16} className="text-orange-400" />;
    if (lang === 'css') return <FileCode size={16} className="text-blue-300" />;
    if (lang === 'json') return <FileCode size={16} className="text-green-400" />;
    if (lang === 'markdown') return <FileTextIcon size={16} className="text-slate-400" />;
    if (lang === 'plantuml') return <ImageIcon size={16} className="text-pink-400" />;
    if (lang === 'whiteboard') return <PenTool size={16} className="text-pink-500" />;
    if (lang === 'pdf') return <FileTextIcon size={16} className="text-red-400" />;
    return <File size={16} className="text-slate-500" />;
};

const FileTreeItem = ({ node, depth, activeId, onSelect, onToggle, onDelete, onShare, expandedIds, loadingIds }: any) => {
    const isExpanded = expandedIds[node.id];
    const isLoading = loadingIds[node.id];
    const isActive = activeId === node.id;
    
    return (
        <div>
            <div 
                className={`flex items-center gap-1 py-1 px-2 cursor-pointer select-none hover:bg-slate-800/50 group ${isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
                onClick={() => onSelect(node)}
            >
                {node.type === 'folder' && (
                    <div onClick={(e) => { e.stopPropagation(); onToggle(node); }} className="p-0.5 hover:text-white">
                        {isLoading ? <Loader2 size={12} className="animate-spin text-indigo-400"/> : isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </div>
                )}
                {node.type === 'folder' ? (
                    isExpanded ? <FolderOpen size={16} className="text-indigo-400"/> : <Folder size={16} className="text-indigo-400"/>
                ) : (
                    <FileIcon filename={node.name} />
                )}
                <span className="text-xs truncate flex-1">{node.name}</span>
                {node.type === 'file' && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onShare(node); }}
                        className="p-1 opacity-0 group-hover:opacity-100 hover:bg-slate-700 rounded text-slate-400 hover:text-indigo-400 transition-all"
                        title="Share File"
                    >
                        <Share2 size={12}/>
                    </button>
                )}
            </div>
            {isExpanded && node.children && (
                <div>
                    {node.children.map((child: any) => (
                        <FileTreeItem 
                            key={child.id} 
                            node={child} 
                            depth={depth + 1} 
                            activeId={activeId} 
                            onSelect={node.children ? onSelect : undefined} 
                            onToggle={onToggle}
                            onDelete={onDelete}
                            onShare={onShare}
                            expandedIds={expandedIds}
                            loadingIds={loadingIds}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const RichCodeEditor = ({ code, onChange, onCursorMove, language, readOnly, fontSize, indentMode }: any) => {
    const monacoLang = useMemo(() => {
        const l = (language || 'text').toLowerCase();
        if (l.includes('c++')) return 'cpp';
        if (l.includes('react')) return l.includes('typescript') ? 'typescript' : 'javascript';
        return l;
    }, [language]);

    const handleEditorChange = (value: string | undefined) => {
        onChange(value || '');
    };

    const handleEditorDidMount = (editor: any) => {
        editor.onDidChangeCursorPosition((e: any) => {
            if (onCursorMove) {
                onCursorMove(e.position.lineNumber, e.position.column);
            }
        });
    };

    return (
        <div className="w-full h-full relative" style={{ letterSpacing: 'normal', textAlign: 'left' }}>
            <Editor
                height="100%"
                defaultLanguage={monacoLang}
                language={monacoLang}
                value={code}
                theme="vs-dark"
                onChange={handleEditorChange}
                onMount={handleEditorDidMount}
                options={{
                    fontSize: fontSize,
                    readOnly: readOnly,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    fixedOverflowWidgets: true,
                    padding: { top: 16, bottom: 16 },
                    tabSize: 4,
                    insertSpaces: indentMode === 'spaces',
                    fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
                    fontLigatures: true,
                    renderControlCharacters: true,
                    renderWhitespace: 'none',
                    cursorBlinking: 'smooth',
                    smoothScrolling: true,
                    lineHeight: fontSize * 1.5,
                    stopRenderingLineAfter: -1
                }}
            />
        </div>
    );
};

const AIChatPanel = ({ isOpen, onClose, messages, onSendMessage, isThinking, currentInput, onInputChange, isInterviewerMode }: any) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isThinking]);

    return (
        <div className="flex flex-col h-full bg-slate-950 border-l border-slate-800">
            <div className="p-3 border-b border-slate-800 flex justify-between items-center bg-slate-900">
                <span className="font-bold text-slate-300 text-sm flex items-center gap-2">
                    {isInterviewerMode ? (
                        <><GraduationCap size={16} className="text-red-500"/> AI Interviewer</>
                    ) : (
                        <><Bot size={16} className="text-indigo-400"/> AI Assistant</>
                    )}
                </span>
                <button onClick={onClose} title="Minimize AI Panel"><PanelRightClose size={16} className="text-slate-500 hover:text-white"/></button>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-slate-600 text-center p-4">
                        {isInterviewerMode ? <ShieldCheck size={32} className="mb-2 opacity-20"/> : <Bot size={32} className="mb-2 opacity-20"/>}
                        <p className="text-xs font-bold uppercase tracking-widest">{isInterviewerMode ? 'Ready for evaluation' : 'Ready to help'}</p>
                    </div>
                )}
                {messages.map((m: any, i: number) => (
                    <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in-up`}>
                        <span className={`text-[9px] font-black uppercase mb-1 ${m.role === 'user' ? 'text-indigo-500' : 'text-slate-500'}`}>
                            {m.role === 'user' ? 'Candidate' : 'Interviewer'}
                        </span>
                        <div className={`max-w-[95%] rounded-2xl p-3 text-sm leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm shadow-lg' : 'bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700'}`}>
                            {m.role === 'ai' || m.role === 'model' ? <MarkdownView content={m.text} /> : <p className="whitespace-pre-wrap">{m.text}</p>}
                        </div>
                    </div>
                ))}
                {isThinking && (
                    <div className="flex flex-col items-start animate-fade-in">
                        <span className="text-[9px] font-black uppercase mb-1 text-slate-500">AI Thinking...</span>
                        <div className="bg-slate-800/50 rounded-2xl p-3 border border-slate-700/50">
                            <Loader2 className="animate-spin text-indigo-400" size={16}/>
                        </div>
                    </div>
                )}
            </div>
            <div className="p-3 border-t border-slate-800 bg-slate-950">
                <form 
                    className="flex gap-2" 
                    onSubmit={(e) => { e.preventDefault(); if(currentInput.trim()) { onSendMessage(currentInput); onInputChange(''); } }}
                >
                    <input 
                        type="text" 
                        value={currentInput} 
                        onChange={e => onInputChange(e.target.value)} 
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 placeholder-slate-600 shadow-inner" 
                        placeholder={isInterviewerMode ? "Reply to interviewer..." : "Ask AI to edit code..."} 
                    />
                    <button 
                        type="submit" 
                        disabled={!currentInput.trim() || isThinking}
                        className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:grayscale text-white rounded-xl transition-all shadow-lg active:scale-95"
                    >
                        <Send size={18}/>
                    </button>
                </form>
            </div>
        </div>
    );
};

interface SlotProps {
    idx: number;
    activeSlots: (CodeFile | null)[];
    focusedSlot: number;
    setFocusedSlot: (idx: number) => void;
    slotViewModes: Record<number, 'code' | 'preview'>;
    toggleSlotViewMode: (idx: number) => void;
    isFormattingSlots: Record<number, boolean>;
    terminalOutputs: Record<number, string[]>;
    setTerminalOutputs: React.Dispatch<React.SetStateAction<Record<number, string[]>>>;
    isTerminalOpen: Record<number, boolean>;
    setIsTerminalOpen: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
    isRunning: Record<number, boolean>;
    layoutMode: LayoutMode;
    innerSplitRatio: number;
    handleRunCode: (idx: number) => void;
    handleFormatCode: (idx: number) => void;
    handleCodeChangeInSlot: (c: string, idx: number) => void;
    updateSlotFile: (f: CodeFile | null, idx: number) => void;
    fontSize: number;
    indentMode: IndentMode;
    isLive: boolean;
    lockStatus: string;
    broadcastCursor: (line: number, col: number) => void;
    isReadOnly?: boolean;
}

const Slot: React.FC<SlotProps> = ({ 
    idx, activeSlots, focusedSlot, setFocusedSlot, slotViewModes, toggleSlotViewMode,
    isFormattingSlots, terminalOutputs, setTerminalOutputs, isTerminalOpen, setIsTerminalOpen,
    isRunning, layoutMode, innerSplitRatio, handleRunCode, handleFormatCode,
    handleCodeChangeInSlot, updateSlotFile, fontSize, indentMode, isLive, lockStatus, broadcastCursor, isReadOnly = false
}) => {
    const file = activeSlots[idx];
    const isFocused = focusedSlot === idx;
    const vMode = slotViewModes[idx] || 'code';
    const isFormatting = isFormattingSlots[idx];
    const terminalVisible = isTerminalOpen[idx];
    const output = terminalOutputs[idx] || [];
    const running = isRunning[idx];
    
    const isVisible = layoutMode === 'single' ? idx === 0 : (layoutMode === 'quad' ? true : idx < 2);
    if (!isVisible) return null;
    
    const slotStyle: any = {};
    if (layoutMode === 'split-v' || layoutMode === 'split-h') {
        const size = idx === 0 ? `${innerSplitRatio}%` : `${100 - innerSplitRatio}%`;
        if (layoutMode === 'split-v') slotStyle.width = size; else slotStyle.height = size;
        slotStyle.flex = 'none';
    }

    const lang = file ? getLanguageFromExt(file.name) : 'text';
    const canRun = ['c++', 'c', 'python', 'javascript', 'typescript'].includes(lang);

    return (
        <div onClick={() => setFocusedSlot(idx)} style={slotStyle} className={`flex flex-col min-w-0 border ${isFocused ? 'border-indigo-500 z-10' : 'border-slate-800'} relative bg-slate-950 flex-1 overflow-hidden`}>
            {file ? (
                <>
                  <div className={`px-4 py-2 flex items-center justify-between shrink-0 border-b ${isFocused ? 'bg-indigo-900/20 border-indigo-500/30' : 'bg-slate-900 border-slate-800'}`}>
                      <div className="flex items-center gap-2 overflow-hidden">
                          <FileIcon filename={file.name} />
                          <span className={`text-xs font-bold truncate ${isFocused ? 'text-indigo-200' : 'text-slate-400'}`}>{file.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                          {canRun && (
                              <button onClick={(e) => { e.stopPropagation(); handleRunCode(idx); }} disabled={running} className={`p-1.5 rounded flex items-center gap-1 text-[10px] font-black uppercase transition-all ${running ? 'text-indigo-400' : 'text-emerald-400 hover:bg-emerald-600/10'}`} title="Compile & Run">
                                  {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} fill="currentColor" />}
                                  <span className="hidden md:inline">Run</span>
                              </button>
                          )}
                          {vMode === 'code' && !['markdown', 'pdf', 'whiteboard'].includes(lang) && (
                              <button onClick={(e) => { e.stopPropagation(); handleFormatCode(idx); }} disabled={isFormatting} className={`p-1.5 rounded ${isFormatting ? 'text-indigo-400' : 'text-slate-500 hover:text-indigo-400'}`} title="AI Format"><Wand2 size={14}/></button>
                          )}
                          {['md', 'puml', 'plantuml', 'pdf', 'draw', 'whiteboard', 'wb'].includes(file.name.split('.').pop()?.toLowerCase() || '') && <button onClick={(e) => { e.stopPropagation(); toggleSlotViewMode(idx); }} className={`p-1.5 rounded ${vMode === 'preview' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'}`}>{vMode === 'preview' ? <Code size={14}/> : <Eye size={14}/>}</button>}
                          <button onClick={(e) => { e.stopPropagation(); updateSlotFile(null, idx); }} className="p-1.5 hover:bg-slate-800 rounded text-slate-500 hover:text-white"><X size={14}/></button>
                      </div>
                  </div>
                  <div className="flex-1 flex flex-col overflow-hidden">
                      <div className="flex-1 overflow-hidden relative">
                          {vMode === 'preview' ? (
                              lang === 'whiteboard' ? (
                                  <div className="w-full h-full"><Whiteboard isReadOnly={isReadOnly} /></div>
                              ) : lang === 'pdf' ? (
                                  <iframe src={file.path} className="w-full h-full border-none bg-white" title="PDF Viewer" />
                              ) : (
                                  <div className="h-full overflow-y-auto p-8 scrollbar-hide">
                                      <MarkdownView content={file.content} />
                                  </div>
                              )
                          ) : (
                              <RichCodeEditor 
                                  code={file.content} 
                                  onChange={(c: string) => handleCodeChangeInSlot(c, idx)} 
                                  onCursorMove={broadcastCursor}
                                  language={file.language} 
                                  fontSize={fontSize} 
                                  indentMode={indentMode} 
                                  readOnly={isReadOnly || (isLive && lockStatus === 'busy')}
                              />
                          )}
                      </div>

                      {terminalVisible && (
                          <div className="h-1/3 bg-slate-950 border-t border-slate-800 flex flex-col animate-fade-in-up">
                              <div className="p-2 border-b border-slate-900 bg-slate-900/50 flex justify-between items-center shrink-0">
                                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2"><TerminalIcon size={12}/> Output Console</span>
                                  <div className="flex items-center gap-1">
                                      <button onClick={() => setTerminalOutputs(prev => ({ ...prev, [idx]: [] }))} className="p-1 text-slate-500 hover:text-white" title="Clear Console"><Trash size={12}/></button>
                                      <button onClick={() => setIsTerminalOpen(prev => ({ ...prev, [idx]: false }))} className="p-1 text-slate-500 hover:text-white"><X size={12}/></button>
                                  </div>
                              </div>
                              <div className="flex-1 overflow-y-auto p-3 font-mono text-xs scrollbar-hide select-text">
                                  {output.map((line, lidx) => (
                                      <div key={lidx} className={`${line.includes('[ERROR]') ? 'text-red-400' : 'text-slate-300'} whitespace-pre-wrap leading-relaxed`}>
                                          {line}
                                      </div>
                                  ))}
                                  {running && <div className="text-indigo-400 animate-pulse mt-2">▋ Running process...</div>}
                              </div>
                          </div>
                      )}
                  </div>
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-700 bg-slate-950/50 border-2 border-dashed border-slate-800 m-4 rounded-xl cursor-pointer hover:border-slate-600" onClick={() => {}}>
                    <Plus size={32} className="opacity-20 mb-2" /><p className="text-xs font-bold uppercase">Pane {idx + 1}</p>
                </div>
            )}
        </div>
    );
};

export const CodeStudio: React.FC<CodeStudioProps> = ({ 
  onBack, currentUser, userProfile, sessionId: propSessionId, accessKey, 
  onSessionStart, onSessionStop, onStartLiveSession, initialFiles,
  externalChatContent, onSendExternalMessage, isInterviewerMode = false,
  isAiThinking = false, onFileChange
}) => {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const [githubLinkingError, setGithubLinkingError] = useState<string | null>(null);
  
  const defaultFile: CodeFile = {
      name: 'main.cpp',
      path: 'drive://welcome',
      language: 'c++',
      content: `#include <iostream>\n\nint main() {\n    std::cout << "Hello from AIVoiceCast Code Studio!" << std::endl;\n    return 0;\n}`,
      loaded: true,
      isDirectory: false,
      isModified: false
  };

  const clientId = useMemo(() => generateSecureId().substring(0, 8), []);
  const myColor = useMemo(() => CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)], []);

  const [layoutMode, setLayoutMode] = useState<LayoutMode>('single');
  const [activeSlots, setActiveSlots] = useState<(CodeFile | null)[]>([null, null, null, null]);
  const [focusedSlot, setFocusedSlot] = useState<number>(0);
  const [slotViewModes, setSlotViewModes] = useState<Record<number, 'code' | 'preview'>>({ 0: 'code' });
  
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
        const slots: (CodeFile | null)[] = [null, null, null, null];
        const vModes: Record<number, 'code' | 'preview'> = {};
        initialFiles.slice(0, 4).forEach((file, i) => {
            slots[i] = file;
            const lang = getLanguageFromExt(file.name);
            vModes[i] = ['markdown', 'plantuml', 'pdf', 'whiteboard'].includes(lang) ? 'preview' : 'code';
        });
        setActiveSlots(slots);
        setSlotViewModes(vModes);
        if (initialFiles.length > 1) setLayoutMode('split-v');
    } else {
        setActiveSlots([defaultFile, null, null, null]);
        setSlotViewModes({ 0: 'code' });
    }
  }, [initialFiles]);

  const [innerSplitRatio, setInnerSplitRatio] = useState(50);
  const [isDraggingInner, setIsDraggingInner] = useState(false);
  
  const [project, setProject] = useState<CodeProject>({ id: 'init', name: 'My Workspace', files: [defaultFile], lastModified: Date.now() });
  const [activeTab, setActiveTab] = useState<'drive' | 'cloud' | 'github'>('drive');
  const [isLeftOpen, setIsLeftOpen] = useState(true);
  const [isRightOpen, setIsRightOpen] = useState(true);
  
  const [terminalOutputs, setTerminalOutputs] = useState<Record<number, string[]>>({});
  const [isTerminalOpen, setIsTerminalOpen] = useState<Record<number, boolean>>({});
  const [isRunning, setIsRunning] = useState<Record<number, boolean>>({});

  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'ai', text: string}>>([{ role: 'ai', text: "Ready to code. Open a file from your **Google Drive** to begin." }]);
  const [chatInput, setChatInput] = useState('');
  const [isChatThinking, setIsChatThinking] = useState(false);
  const [isFormattingSlots, setIsFormattingSlots] = useState<Record<number, boolean>>({});
  
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  const [cloudItems, setCloudItems] = useState<CloudItem[]>([]); 
  const [driveItems, setDriveItems] = useState<(DriveFile & { parentId?: string, isLoaded?: boolean })[]>([]); 
  const [driveRootId, setDriveRootId] = useState<string | null>(null);
  
  const [githubToken, setGithubToken] = useState<string | null>(localStorage.getItem('github_token'));
  const [githubRepos, setGithubRepos] = useState<any[]>([]);
  const [githubSearchQuery, setGithubSearchQuery] = useState('');
  const [isGithubLoading, setIsGithubLoading] = useState(false);
  const [githubTree, setGithubTree] = useState<TreeNode[]>([]);
  const [showManualToken, setShowManualToken] = useState(false);
  const [manualToken, setManualToken] = useState('');

  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [loadingIds, setLoadingIds] = useState<Record<string, boolean>>({});
  const [isExplorerLoading, setIsExplorerLoading] = useState(false);
  
  const [driveToken, setDriveToken] = useState<string | null>(getDriveToken());
  const [saveStatus, setSaveStatus] = useState<'saved' | 'modified' | 'saving'>('saved');
  const [fontSize, setFontSize] = useState(14);
  const [indentMode, setIndentMode] = useState<IndentMode>('spaces');
  const [leftWidth, setLeftWidth] = useState(260); 
  const [rightWidth, setRightWidth] = useState(320); 
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);

  const centerContainerRef = useRef<HTMLDivElement>(null);
  const activeFile = activeSlots[focusedSlot];
  const blobUrlsRef = useRef<Set<string>>(new Set());

  const [isLive, setIsLive] = useState(false);
  const [lockStatus, setLockStatus] = useState<'free' | 'busy' | 'mine'>('free');

  const updateFileTool: FunctionDeclaration = {
    name: "update_active_file",
    description: "Updates the content of the currently focused file in the editor.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        new_content: { type: Type.STRING, description: "The complete new content of the file." },
        summary: { type: Type.STRING, description: "A brief summary of what you changed." }
      },
      required: ["new_content"]
    }
  };

  const toggleSlotViewMode = (idx: number) => {
      setSlotViewModes(prev => ({
          ...prev,
          [idx]: prev[idx] === 'preview' ? 'code' : 'preview'
      }));
  };

  const handleSetLayout = (mode: LayoutMode) => {
      setLayoutMode(mode);
  };

  const handleConnectDrive = async () => {
      try {
          const token = await connectGoogleDrive();
          setDriveToken(token);
          await refreshExplorer();
      } catch(e) {
          console.error(e);
      }
  };

  const handleGithubLogin = async () => {
      setGithubLinkingError(null);
      try {
          const token = await signInWithGitHub();
          if (token) {
              setGithubToken(token);
              await refreshExplorer();
          }
      } catch (e: any) {
          console.error("GitHub Login Failed", e);
          if (e.code === 'auth/credential-already-in-use' || e.message?.includes('already bound')) {
              setGithubLinkingError(e.message);
              setShowManualToken(true);
          }
      }
  };

  const handleSetManualToken = () => {
      if (manualToken.trim()) {
          setGithubToken(manualToken.trim());
          localStorage.setItem('github_token', manualToken.trim());
          setShowManualToken(false);
          setGithubLinkingError(null);
          refreshExplorer();
      }
  };

  const handleAutoLoadDefaultRepo = async (token: string, repoFullName: string) => {
      const [owner, repo] = repoFullName.split('/');
      setIsGithubLoading(true);
      try {
          const info = await fetchRepoInfo(owner, repo, token);
          const { files } = await fetchRepoContents(token, owner, repo, info.default_branch);
          const tree: TreeNode[] = files.map(f => ({
              id: f.path || f.name,
              name: f.name.split('/').pop() || f.name,
              type: (f.isDirectory ? 'folder' : 'file') as 'file' | 'folder',
              isLoaded: f.childrenFetched,
              data: f
          }));
          setGithubTree(tree);
          setProject(prev => ({
              ...prev,
              github: { owner, repo, branch: info.default_branch, sha: '' }
          }));
      } catch (e: any) {
          alert("Failed to load repo: " + e.message);
      } finally {
          setIsGithubLoading(false);
      }
  };

  const handleSelectRepo = async (repo: any) => {
      if (!githubToken) return;
      setIsGithubLoading(true);
      try {
          const { files } = await fetchRepoContents(githubToken, repo.owner.login, repo.name, repo.default_branch);
          const tree: TreeNode[] = files.map(f => ({
              id: f.path || f.name,
              name: f.name.split('/').pop() || f.name,
              type: (f.isDirectory ? 'folder' : 'file') as 'file' | 'folder',
              isLoaded: f.childrenFetched,
              data: f
          }));
          setGithubTree(tree);
          setProject(prev => ({
              ...prev,
              github: { owner: repo.owner.login, repo: repo.name, branch: repo.default_branch, sha: '' }
          }));
      } catch (e: any) {
          alert("Failed to load repository tree: " + e.message);
      } finally {
          setIsGithubLoading(false);
      }
  };

  useEffect(() => {
    const pid = params.get('id');

    if (pid && pid !== 'init') {
        setIsLive(true);
        const unsubscribe = subscribeToCodeProject(pid, (updatedProject) => {
            setProject(updatedProject);
            if (updatedProject.activeClientId === clientId) setLockStatus('mine');
            else if (updatedProject.activeClientId) setLockStatus('busy');
            else setLockStatus('free');

            if (updatedProject.activeClientId !== clientId && updatedProject.activeFilePath) {
                const remoteFile = updatedProject.files.find(f => f.path === updatedProject.activeFilePath);
                if (remoteFile) {
                    setActiveSlots(prev => prev.map((s, i) => {
                        if (s?.path === remoteFile.path) return { ...s, content: remoteFile.content, isModified: false };
                        return s;
                    }));
                }
            }
        });
        return () => unsubscribe();
    }
  }, [clientId, params]);

  const broadcastCursor = useCallback((line: number, col: number) => {
      if (!isLive || project.id === 'init') return;
      updateCursor(project.id, {
          clientId, userId: currentUser?.uid || 'guest', userName: currentUser?.displayName || 'Guest',
          fileName: activeFile?.path || 'none', line, column: col, color: myColor, updatedAt: Date.now()
      });
  }, [isLive, project.id, activeFile?.path, clientId, currentUser, myColor]);

  const handleSmartSave = async (targetFileOverride?: CodeFile) => {
    const fileToSave = targetFileOverride || activeFile;
    if (!fileToSave || (!fileToSave.isModified && saveStatus === 'saved')) return;
    setSaveStatus('saving');
    try {
        if (activeTab === 'drive' && driveToken && driveRootId) {
             const driveId = fileToSave.path?.startsWith('drive://') ? fileToSave.path.replace('drive://', '') : undefined;
             const validId = (driveId && driveId.length > 20 && !driveId.includes('blob:')) ? driveId : undefined;
             await saveToDrive(driveToken, driveRootId, fileToSave.name, fileToSave.content, validId);
        } else if (activeTab === 'cloud' && currentUser) {
             await saveProjectToCloud(`projects/${currentUser.uid}`, fileToSave.name, fileToSave.content);
        } else if (activeTab === 'github' && githubToken && project.github) {
            const { owner, repo, branch } = project.github;
            const res = await updateRepoFile(githubToken, owner, repo, fileToSave.path || fileToSave.name, fileToSave.content, fileToSave.sha, `Update ${fileToSave.name}`, branch);
            fileToSave.sha = res.sha;
            fileToSave.isModified = false;
        }
        if (isLive && lockStatus === 'mine') await updateCodeFile(project.id, fileToSave);
        setSaveStatus('saved');
    } catch(e: any) { 
        console.error("Save failed", e);
        setSaveStatus('modified'); 
    }
  };

  const handleShare = async () => {
      let projectId = project.id;
      if (projectId === 'init') {
          if (!currentUser) return alert("Please sign in to share projects.");
          setIsExplorerLoading(true);
          try {
              const filesToSave = activeSlots.filter(s => s !== null) as CodeFile[];
              const newId = generateSecureId();
              const newProject: CodeProject = { 
                  ...project, 
                  id: newId, 
                  files: filesToSave,
                  lastModified: Date.now(),
                  accessLevel: 'public'
              };
              projectId = await saveCodeProject(newProject);
              setProject(newProject);
              setIsLive(true);
              const url = new URL(window.location.href);
              url.searchParams.set('id', projectId);
              window.history.replaceState({}, '', url.toString());
          } catch(e) {
              alert("Failed to create shared project.");
              return;
          } finally {
              setIsExplorerLoading(false);
          }
      }
      setShareUrl(`${window.location.origin}${window.location.pathname}?view=code_studio&id=${projectId}`);
      setShowShareModal(true);
  };

  const handleUpdateAccess = async (uids: string[], isPublic: boolean, perm: 'read' | 'write') => {
      await updateProjectAccess(project.id, isPublic ? 'public' : 'restricted', uids);
  };

  const refreshExplorer = async () => {
      setIsExplorerLoading(true);
      try {
          if (activeTab === 'drive' && driveToken) {
              const rootId = driveRootId || await ensureCodeStudioFolder(driveToken);
              setDriveRootId(rootId);
              const files = await listDriveFiles(driveToken, rootId);
              setDriveItems([{ id: rootId, name: 'CodeStudio', mimeType: 'application/vnd.google-apps.folder', isLoaded: true }, ...files.map(f => ({ ...f, parentId: rootId, isLoaded: false }))]);
          } else if (activeTab === 'cloud' && currentUser) {
              const items = await listCloudDirectory(`projects/${currentUser.uid}`);
              setCloudItems(items);
          } else if (activeTab === 'github' && githubToken) {
              if (project.github && githubTree.length === 0) {
                   await handleAutoLoadDefaultRepo(githubToken, `${project.github.owner}/${project.github.repo}`);
              } else {
                  const repos = await fetchUserRepos(githubToken);
                  setGithubRepos(repos);
              }
          }
      } finally { setIsExplorerLoading(false); }
  };

  const handleCreateNewFile = () => {
      const fileName = prompt("Enter filename (with extension):", "NewFile.ts");
      if (!fileName) return;
      const newFile: CodeFile = {
          name: fileName, path: activeTab === 'drive' ? `drive://${fileName}` : fileName,
          content: "", language: getLanguageFromExt(fileName), loaded: true, isDirectory: false, isModified: true
      };
      updateSlotFile(newFile, focusedSlot);
      setSaveStatus('modified');
  };

  const toggleFolder = async (node: TreeNode) => {
      const isExpanded = expandedIds[node.id];
      setExpandedIds(prev => ({ ...prev, [node.id]: !isExpanded }));
      
      if (!isExpanded && !node.isLoaded) {
          setLoadingIds(prev => ({ ...prev, [node.id]: true }));
          try {
              if (activeTab === 'drive' && driveToken) {
                  const files = await listDriveFiles(driveToken, node.id);
                  setDriveItems(prev => {
                      const next = prev.map(item => item.id === node.id ? { ...item, isLoaded: true } : item);
                      const filteredNext = next.filter(item => item.parentId !== node.id);
                      const newItems = files.map(f => ({ ...f, parentId: node.id, isLoaded: false }));
                      return [...filteredNext, ...newItems];
                  });
              } else if (activeTab === 'github' && project.github) {
                  const { owner, repo, branch } = project.github;
                  const children = await fetchRepoSubTree(githubToken, owner, repo, node.data.treeSha, node.id);
                  const childNodes: TreeNode[] = children.map(f => ({ id: f.path || f.name, name: f.name.split('/').pop() || f.name, type: (f.isDirectory ? 'folder' : 'file') as 'file' | 'folder', isLoaded: f.childrenFetched, data: f }));
                  setGithubTree(prev => {
                      const updateRecursive = (list: TreeNode[]): TreeNode[] => list.map(n => {
                          if (n.id === node.id) return { ...n, isLoaded: true, children: childNodes };
                          if (n.children) return { ...n, children: updateRecursive(prev) };
                          return n;
                      });
                      return updateRecursive(prev);
                  });
              }
          } finally { setLoadingIds(prev => ({ ...prev, [node.id]: false })); }
      }
  };

  const handleExplorerSelect = async (node: TreeNode) => {
      if (node.type === 'file') {
          let fileData: CodeFile | null = null;
          try {
              if (activeTab === 'drive' && driveToken) {
                  const iSBinary = node.name.toLowerCase().endsWith('.pdf');
                  if (iSBinary) {
                      const blob = await downloadDriveFileAsBlob(driveToken, node.id);
                      const blobUrl = URL.createObjectURL(blob);
                      blobUrlsRef.current.add(blobUrl);
                      fileData = { name: node.name, path: blobUrl, content: '[BINARY DATA]', language: 'pdf', loaded: true, isDirectory: false, isModified: false };
                  } else {
                      const text = await readDriveFile(driveToken, node.id);
                      fileData = { name: node.name, path: `drive://${node.id}`, content: text, language: getLanguageFromExt(node.name), loaded: true, isDirectory: false, isModified: false };
                  }
              } else if (activeTab === 'cloud' && node.data?.url) {
                  const iSBinary = node.name.toLowerCase().endsWith('.pdf');
                  if (iSBinary) {
                      fileData = { name: node.name, path: node.data.url, content: '[BINARY DATA]', language: 'pdf', loaded: true, isDirectory: false, isModified: false };
                  } else {
                      const res = await fetch(node.data.url);
                      const text = await res.text();
                      fileData = { name: node.name, path: node.id, content: text, language: getLanguageFromExt(node.name), loaded: true, isDirectory: false, isModified: false };
                  }
              } else if (activeTab === 'github' && project.github) {
                  const { owner, repo, branch } = project.github;
                  const text = await fetchFileContent(githubToken, owner, repo, node.id, branch);
                  fileData = { name: node.name, path: node.id, content: text, language: getLanguageFromExt(node.name), loaded: true, isDirectory: false, isModified: false, sha: node.data?.sha };
              }
              if (fileData) updateSlotFile(fileData, focusedSlot);
          } catch(e: any) { alert(e.message); }
      } else { toggleFolder(node); }
  };

  const updateSlotFile = async (file: CodeFile | null, slotIndex: number) => {
      const newSlots = [...activeSlots];
      newSlots[slotIndex] = file;
      setActiveSlots(newSlots);
      if (file) {
        const lang = getLanguageFromExt(file.name);
        setSlotViewModes(prev => ({ ...prev, [slotIndex]: ['markdown', 'plantuml', 'pdf', 'whiteboard'].includes(lang) ? 'preview' : 'code' }));
        if (onFileChange) onFileChange(file);
        
        // AUTO-FOCUS the newly updated slot
        setFocusedSlot(slotIndex);
      }
      if (isLive && lockStatus === 'mine' && file?.path) updateProjectActiveFile(project.id, file.path);
  };

  const handleCodeChangeInSlot = (newCode: string, slotIdx: number) => {
      const file = activeSlots[slotIdx];
      if (!file) return;
      const updatedFile = { ...file, content: newCode, isModified: true };
      const newSlots = [...activeSlots];
      newSlots[slotIdx] = updatedFile;
      setActiveSlots(newSlots);
      setSaveStatus('modified');
      if (onFileChange) onFileChange(updatedFile);
      if (isLive && lockStatus === 'mine') updateCodeFile(project.id, updatedFile);
  };

  const handleRunCode = async (slotIdx: number) => {
      const file = activeSlots[slotIdx];
      if (!file) return;
      setIsRunning(prev => ({ ...prev, [slotIdx]: true }));
      setIsTerminalOpen(prev => ({ ...prev, [slotIdx]: true }));
      const updateTerminal = (msg: string, isError = false) => { setTerminalOutputs(prev => ({ ...prev, [slotIdx]: [...(prev[slotIdx] || []), `${isError ? '[ERROR] ' : ''}${msg}`] })); };
      updateTerminal(`>>> Starting Neural Execution: ${file.name}`);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const prompt = `Act as a high-speed remote C++ / Multi-language execution engine. Execute: File: ${file.name}, Lang: ${file.language}, Code: ${file.content}. Respond ONLY with JSON: { "stdout": "string", "stderr": "string", "exitCode": number }`;
          
          const resp = await ai.models.generateContent({ 
              model: 'gemini-3-flash-preview', 
              contents: prompt, 
              config: { 
                  responseMimeType: 'application/json',
                  thinkingConfig: { thinkingBudget: 0 } 
              } 
          });
          
          const result = JSON.parse(resp.text || '{"stdout": "", "stderr": "Internal Error", "exitCode": 1}');
          if (result.stderr) updateTerminal(result.stderr, true);
          if (result.stdout) updateTerminal(result.stdout);
          updateTerminal(`\n[Process exited with code ${result.exitCode}]`);
      } catch (e: any) { updateTerminal(`Execution failed: ${e.message}`, true); } finally { setIsRunning(prev => ({ ...prev, [slotIdx]: false })); }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isChatThinking) return;
    
    // If in interviewer mode, prioritize external handler
    if (isInterviewerMode && onSendExternalMessage) {
        onSendExternalMessage(text);
        return;
    }

    setChatMessages(prev => [...prev, { role: 'user', text }]);
    setIsChatThinking(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const history = chatMessages.map(m => ({ role: (m.role === 'ai' ? 'model' : 'user') as 'model' | 'user', parts: [{ text: m.text }] }));
      let contextualMessage = text;
      if (activeFile) contextualMessage = `CONTEXT: Focused File "${activeFile.name}" content:\n\`\`\`${activeFile.language}\n${activeFile.content}\n\`\`\`\n\nUSER REQUEST: ${text}`;
      const response = await ai.models.generateContent({ model: 'gemini-3-pro-preview', contents: [ ...history, { role: 'user', parts: [{ text: contextualMessage }] } ], config: { systemInstruction: "Expert pair programmer.", tools: [{ functionDeclarations: [updateFileTool] }] } });
      if (response.functionCalls?.[0]?.name === 'update_active_file') {
          const args = response.functionCalls[0].args as any;
          if (args.new_content) { handleCodeChangeInSlot(args.new_content, focusedSlot); setChatMessages(prev => [...prev, { role: 'ai', text: `✅ Updated. ${args.summary || ''}` }]); }
      } else { setChatMessages(prev => [...prev, { role: 'ai', text: response.text || "No response." }]); }
    } catch (e: any) { setChatMessages(prev => [...prev, { role: 'ai', text: "Error: " + e.message }]); } finally { setIsChatThinking(false); }
  };

  const handleFormatCode = async (slotIdx: number) => {
      const file = activeSlots[slotIdx];
      if (!file || isFormattingSlots[slotIdx]) return;
      setIsFormattingSlots(prev => ({ ...prev, [slotIdx]: true }));
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const resp = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: `Format RAW code: ${file.content}` });
          let result = resp.text || file.content;
          result = result.replace(/```(?:[a-zA-Z0-9+-]+)?\n?([\s\S]*?)\n?```/g, '$1').trim();
          handleCodeChangeInSlot(result, slotIdx);
      } catch (e: any) { console.error(e); } finally { setIsFormattingSlots(prev => ({ ...prev, [slotIdx]: false })); }
  };

  const resize = useCallback((e: MouseEvent) => {
    if (isDraggingLeft) { const nw = e.clientX; if (nw > 160 && nw < 500) setLeftWidth(nw); }
    if (isDraggingRight) { const nw = window.innerWidth - e.clientX; if (nw > 160 && nw < 500) setRightWidth(nw); }
    if (isDraggingInner && centerContainerRef.current) {
        const rect = centerContainerRef.current.getBoundingClientRect();
        const newRatio = layoutMode === 'split-v' ? ((e.clientX - rect.left) / rect.width) * 100 : ((e.clientY - rect.top) / rect.height) * 100;
        if (newRatio > 10 && newRatio < 90) setInnerSplitRatio(newRatio);
    }
  }, [isDraggingLeft, isDraggingRight, isDraggingInner, layoutMode]);

  useEffect(() => {
      if (isDraggingLeft || isDraggingRight || isDraggingInner) {
          window.addEventListener('mousemove', resize);
          const stop = () => { setIsDraggingLeft(false); setIsDraggingRight(false); setIsDraggingInner(false); };
          window.addEventListener('mouseup', stop);
          return () => { window.removeEventListener('mousemove', resize); window.removeEventListener('mouseup', stop); };
      }
  }, [isDraggingLeft, isDraggingRight, isDraggingInner, resize]);

  useEffect(() => { refreshExplorer(); }, [activeTab, driveToken, githubToken, currentUser]);

  const driveTree = useMemo(() => {
      const root: TreeNode[] = [];
      const map = new Map<string, TreeNode>();
      driveItems.forEach(item => map.set(item.id, { id: item.id, name: item.name, type: item.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file', data: item, children: [], isLoaded: item.isLoaded }));
      driveItems.forEach(item => {
          const node = map.get(item.id)!;
          if (item.parentId && map.has(item.parentId)) map.get(item.parentId)!.children.push(node);
          else if (!item.parentId) root.push(node);
      });
      return root;
  }, [driveItems]);

  const cloudTree = useMemo(() => {
    const root: TreeNode[] = [];
    const map = new Map<string, TreeNode>();
    cloudItems.forEach(item => map.set(item.fullPath, { id: item.fullPath, name: item.name, type: item.isFolder ? 'folder' : 'file', data: item, children: [], isLoaded: true }));
    cloudItems.forEach(item => { const node = map.get(item.fullPath)!; const parts = item.fullPath.split('/'); parts.pop(); const pPath = parts.join('/'); if (map.has(pPath)) map.get(pPath)!.children.push(node); else root.push(node); });
    return root;
  }, [cloudItems]);

  // Fix: replaced broken 'searchQuery' reference with correctly defined 'githubSearchQuery'
  const filteredRepos = useMemo(() => {
      if (!githubSearchQuery.trim()) return githubRepos;
      return githubRepos.filter(r => r.full_name.toLowerCase().includes(githubSearchQuery.toLowerCase()));
  }, [githubRepos, githubSearchQuery]);

  const isSharedViewOnly = isLive && (params.get('mode') === 'view');

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden">
      <header className="h-14 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-4 shrink-0 z-20">
         <div className="flex items-center space-x-4">
            <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"><ArrowLeft size={20} /></button>
            <button onClick={() => setIsLeftOpen(!isLeftOpen)} className={`p-2 rounded-lg ${isLeftOpen ? 'bg-slate-800 text-white' : 'text-slate-50'}`}><PanelLeftOpen size={20}/></button>
         </div>
         <div className="flex items-center space-x-2">
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 mr-4">
                <button onClick={() => handleSetLayout('single')} className={`p-1.5 rounded ${layoutMode === 'single' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}><SquareIcon size={16}/></button>
                <button onClick={() => handleSetLayout('split-v')} className={`p-1.5 rounded ${layoutMode === 'split-v' ? 'bg-indigo-600 text-white' : 'text-slate-50'}`}><Columns size={16}/></button>
                <button onClick={() => handleSetLayout('split-h')} className={`p-1.5 rounded ${layoutMode === 'split-h' ? 'bg-indigo-600 text-white' : 'text-slate-50'}`}><Rows size={16}/></button>
                <button onClick={() => handleSetLayout('quad')} className={`p-1.5 rounded ${layoutMode === 'quad' ? 'bg-indigo-600 text-white' : 'text-slate-50'}`}><Grid2X2 size={16}/></button>
            </div>
            {!isSharedViewOnly && (
                <>
                    <button onClick={handleShare} className="flex items-center space-x-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-lg transition-all active:scale-95">
                        <Share2 size={14}/>
                        <span>Share</span>
                    </button>
                    <button onClick={() => handleSmartSave()} disabled={lockStatus === 'busy'} className="flex items-center space-x-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold"><Save size={14}/><span>Save</span></button>
                </>
            )}
            <button onClick={() => setIsRightOpen(!isRightOpen)} className={`p-2 rounded-lg ${isRightOpen ? 'bg-slate-800 text-white' : 'text-slate-50'}`}><PanelRightOpen size={20}/></button>
         </div>
      </header>
      <div className="flex-1 flex overflow-hidden">
          <div className={`${isLeftOpen ? '' : 'hidden'} bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 overflow-hidden`} style={{ width: `${leftWidth}px` }}>
              <div className="flex border-b border-slate-800 shrink-0">
                  <button onClick={() => setActiveTab('drive')} className={`flex-1 py-3 flex justify-center border-b-2 transition-colors ${activeTab === 'drive' ? 'border-indigo-500 text-white bg-slate-800' : 'border-transparent text-slate-500 hover:text-slate-300'}`} title="Google Drive"><HardDrive size={18}/></button>
                  <button onClick={() => setActiveTab('cloud')} className={`flex-1 py-3 flex justify-center border-b-2 transition-colors ${activeTab === 'cloud' ? 'border-indigo-500 text-white bg-slate-800' : 'border-transparent text-slate-500 hover:text-slate-300'}`} title="Private Cloud"><Cloud size={18}/></button>
                  <button onClick={() => setActiveTab('github')} className={`flex-1 py-3 flex justify-center border-b-2 transition-colors ${activeTab === 'github' ? 'border-indigo-500 text-white bg-slate-800' : 'border-transparent text-slate-500 hover:text-slate-300'}`} title="GitHub"><Github size={18}/></button>
              </div>
              <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="p-3 border-b border-slate-800 flex gap-1.5 shrink-0 bg-slate-900/50">
                      <button onClick={refreshExplorer} disabled={isExplorerLoading} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors" title="Refresh Explorer">{isExplorerLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}</button>
                      {!isSharedViewOnly && <button onClick={handleCreateNewFile} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-1.5 shadow-lg transition-all active:scale-95"><FilePlus size={14}/> New File</button>}
                  </div>
                  
                  {activeTab === 'drive' && (driveToken ? <div className="flex-1 overflow-y-auto scrollbar-hide py-2">{driveTree.map(node => <FileTreeItem key={node.id} node={node} depth={0} activeId={activeFile?.path?.replace('drive://','')} onSelect={handleExplorerSelect} onToggle={toggleFolder} onShare={()=>{}} expandedIds={expandedIds} loadingIds={loadingIds}/>)}</div> : <div className="p-12 text-center flex flex-col items-center justify-center h-full gap-4"><button onClick={handleConnectDrive} className="px-6 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-lg">Connect G-Drive</button></div>)}
                  
                  {activeTab === 'cloud' && (currentUser ? <div className="flex-1 overflow-y-auto scrollbar-hide py-2">{cloudTree.map(node => <FileTreeItem key={node.id} node={node} depth={0} onSelect={handleExplorerSelect} onToggle={toggleFolder} onShare={()=>{}} expandedIds={expandedIds} loadingIds={loadingIds}/>)}</div> : <div className="p-12 text-center flex flex-col items-center justify-center h-full gap-4"><p className="text-xs text-slate-400">Sign in for Private Cloud.</p></div>)}

                  {activeTab === 'github' && (
                      <div className="flex-1 flex flex-col overflow-hidden">
                          {!githubToken ? (
                              <div className="p-12 text-center flex flex-col items-center justify-center h-full gap-4"><button onClick={handleGithubLogin} className="px-6 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-lg flex items-gap-2"><Github size={14}/> Connect GitHub</button><div className="flex flex-col gap-2 mt-4 text-center"><p className="text-[10px] text-slate-500 uppercase font-black tracking-widest leading-relaxed">Problems connecting?</p><button onClick={() => setShowManualToken(true)} className="text-[10px] text-indigo-400 hover:text-white underline font-bold uppercase tracking-widest">Use Access Token</button></div></div>
                          ) : isGithubLoading ? (
                              <div className="flex-1 flex flex-col items-center justify-center text-indigo-400 gap-4"><Loader2 className="animate-spin" size={32}/><span className="text-[10px] font-black uppercase tracking-widest">Fetching Repos...</span></div>
                          ) : githubTree.length > 0 ? (
                              <div className="flex-1 flex flex-col overflow-hidden">
                                  <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between"><div className="flex items-center gap-2 overflow-hidden"><Github size={12} className="text-slate-500"/><span className="text-[10px] font-bold text-indigo-300 truncate uppercase tracking-widest">{project.github?.owner}/{project.github?.repo}</span></div><div className="flex items-center gap-2"><button onClick={() => { localStorage.removeItem('github_token'); setGithubToken(null); setGithubTree([]); }} className="text-slate-500 hover:text-red-400" title="Disconnect GitHub"><LogIn size={12} className="rotate-180"/></button><button onClick={() => setGithubTree([])} className="text-slate-500 hover:text-white" title="Change Repository"><RefreshCw size={12}/></button></div></div>
                                  <div className="flex-1 overflow-y-auto scrollbar-hide py-2">{githubTree.map(node => <FileTreeItem key={node.id} node={node} depth={0} activeId={activeFile?.path} onSelect={handleExplorerSelect} onToggle={toggleFolder} onShare={()=>{}} expandedIds={expandedIds} loadingIds={loadingIds}/>)}</div>
                              </div>
                          ) : (
                              <div className="flex-1 flex flex-col overflow-hidden">
                                  {/* Fix: replaced broken 'searchQuery' reference with 'githubSearchQuery' and its setter */}
                                  <div className="p-3"><div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" size={14}/><input type="text" value={githubSearchQuery} onChange={e => setGithubSearchQuery(e.target.value)} placeholder="Search repositories..." className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"/></div></div>
                                  <div className="flex-1 overflow-y-auto scrollbar-hide">{filteredRepos.length === 0 ? <div className="p-8 text-center text-slate-600 text-xs italic">No repositories found.</div> : filteredRepos.map(repo => <button key={repo.id} onClick={() => handleSelectRepo(repo)} className="w-full text-left p-3 border-b border-slate-800 hover:bg-slate-800 transition-colors group"><div className="flex items-center justify-between mb-1"><span className="text-xs font-bold text-slate-300 group-hover:text-white truncate">{repo.name}</span><span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${repo.private ? 'bg-amber-900/20 text-amber-500 border-amber-900/50' : 'bg-emerald-900/20 text-emerald-500 border-emerald-900/50'}`}>{repo.private ? 'Private' : 'Public'}</span></div><p className="text-[10px] text-slate-500 line-clamp-1">{repo.description || 'No description provided.'}</p></button>)}</div>
                                  <div className="p-3 bg-slate-950 border-t border-slate-800 text-center"><button onClick={() => { localStorage.removeItem('github_token'); setGithubToken(null); }} className="text-[9px] font-black text-slate-500 uppercase hover:text-red-400">Logout GitHub</button></div>
                              </div>
                          )}
                      </div>
                  )}
              </div>
          </div>
          <div onMouseDown={() => setIsDraggingLeft(true)} className="w-1 cursor-col-resize hover:bg-indigo-500/50 z-30 shrink-0 bg-slate-800/20"></div>
          <div ref={centerContainerRef} className={`flex-1 bg-slate-950 flex min-w-0 relative ${layoutMode === 'quad' ? 'grid grid-cols-2 grid-rows-2' : layoutMode === 'split-v' ? 'flex-row' : layoutMode === 'split-h' ? 'flex-col' : 'flex-col'}`}>
              {[0, 1, 2, 3].map(i => (
                  <Slot key={i} idx={i} activeSlots={activeSlots} focusedSlot={focusedSlot} setFocusedSlot={setFocusedSlot} slotViewModes={slotViewModes} toggleSlotViewMode={toggleSlotViewMode} isFormattingSlots={isFormattingSlots} terminalOutputs={terminalOutputs} setTerminalOutputs={setTerminalOutputs} isTerminalOpen={isTerminalOpen} setIsTerminalOpen={setIsTerminalOpen} isRunning={isRunning} layoutMode={layoutMode} innerSplitRatio={innerSplitRatio} handleRunCode={handleRunCode} handleFormatCode={handleFormatCode} handleCodeChangeInSlot={handleCodeChangeInSlot} updateSlotFile={updateSlotFile} fontSize={fontSize} indentMode={indentMode} isLive={isLive} lockStatus={lockStatus} broadcastCursor={broadcastCursor} isReadOnly={isSharedViewOnly} />
              ))}
          </div>
          <div onMouseDown={() => setIsDraggingRight(true)} className="w-1 cursor-col-resize hover:bg-indigo-500/50 z-30 shrink-0 bg-slate-800/20"></div>
          <div className={`${isRightOpen ? '' : 'hidden'} bg-slate-950 flex flex-col shrink-0 overflow-hidden`} style={{ width: `${rightWidth}px` }}>
              <AIChatPanel 
                isOpen={true} 
                onClose={() => setIsRightOpen(false)} 
                messages={isInterviewerMode ? externalChatContent || [] : chatMessages} 
                onSendMessage={handleSendMessage} 
                isThinking={isInterviewerMode ? isAiThinking : isChatThinking} 
                currentInput={chatInput} 
                onInputChange={setChatInput} 
                isInterviewerMode={isInterviewerMode}
              />
          </div>
      </div>

      {showShareModal && shareUrl && (
          <ShareModal 
            isOpen={true} 
            onClose={() => setShowShareModal(false)} 
            onShare={handleUpdateAccess}
            link={shareUrl} 
            title={project.name}
            currentAccess={project.accessLevel}
            currentAllowedUsers={project.allowedUserIds}
            currentUserUid={currentUser?.uid}
            defaultPermission="write"
          />
      )}

      {showManualToken && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
              <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-fade-in-up">
                  <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-white flex items-center gap-2"><Key className="text-indigo-400" size={18}/> Manual Token Fallback</h3><button onClick={() => setShowManualToken(false)} className="text-slate-500 hover:text-white"><X size={20}/></button></div>
                  <div className="space-y-4"><div className="p-3 bg-amber-900/20 border border-amber-500/30 rounded-xl flex items-start gap-3"><AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16}/><div className="space-y-2"><p className="text-[10px] text-amber-200 leading-relaxed font-bold">CONFLICT DETECTED:</p><p className="text-[10px] text-amber-200 leading-relaxed">{githubLinkingError || "OAuth linking failed because your GitHub is already linked to another account."}</p><p className="text-[10px] text-amber-200 leading-relaxed italic">Use a Personal Access Token (PAT) to bypass this conflict.</p></div></div><div className="space-y-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">GitHub Access Token</label><input type="password" value={manualToken} onChange={e => setManualToken(e.target.value)} placeholder="ghp_..." className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-indigo-200 outline-none focus:border-indigo-500 font-mono"/></div><div className="flex flex-col gap-2"><button onClick={handleSetManualToken} disabled={!manualToken.trim()} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg disabled:opacity-50 transition-all active:scale-95">Save & Connect</button><a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer" className="text-[10px] text-slate-500 hover:text-indigo-400 flex items-center justify-center gap-1 mt-1 transition-colors">How to generate a token? <ExternalLink size={10}/></a></div></div>
              </div>
          </div>
      )}
    </div>
  );
};

export default CodeStudio;
