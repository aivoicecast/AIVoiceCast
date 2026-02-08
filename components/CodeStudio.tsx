
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
// Added TranscriptItem to imports
import { CodeProject, CodeFile, UserProfile, Channel, CursorPosition, CloudItem, TranscriptItem } from '../types';
import { 
  ArrowLeft, Save, Plus, Github, Cloud, HardDrive, Code, X, ChevronRight, ChevronDown, 
  File, Folder, DownloadCloud, Loader2, CheckCircle, AlertCircle, Info, FolderPlus, 
  FileCode, RefreshCw, LogIn, CloudUpload, Trash2, ArrowUp, Edit2, FolderOpen, MoreVertical, 
  Send, MessageSquare, Bot, Mic, Sparkles, SidebarClose, SidebarOpen, Users, Eye, 
  FileText as FileTextIcon, Image as ImageIcon, StopCircle, Minus, Maximize2, Minimize2, 
  Lock, Unlock, Share2, Terminal, Copy, WifiOff, PanelRightClose, PanelRightOpen, 
  PanelLeftClose, PanelLeftOpen, Monitor, Laptop, PenTool, Edit3, ShieldAlert, ZoomIn, 
  ZoomOut, Columns, Rows, Grid2X2, Square as SquareIcon, GripVertical, GripHorizontal, 
  FileSearch, Indent, Wand2, Check, UserCheck, Briefcase, FileUser, Trophy, Star, Play, Camera,
  // Added FilePlus icon import
  FilePlus
} from 'lucide-react';
import { 
  // Removed missing members from firestoreService import
  subscribeToCodeProject, saveCodeProject, updateCodeFile, updateCursor, 
  claimCodeProjectLock, updateProjectActiveFile, 
  updateProjectAccess
} from '../services/firestoreService';
import { 
  ensureCodeStudioFolder, listDriveFiles, readDriveFile, saveToDrive, 
  deleteDriveFile, createDriveFolder, DriveFile, moveDriveFile 
} from '../services/googleDriveService';
// Added getDriveToken to authService import
import { connectGoogleDrive, signInWithGitHub, getDriveToken } from '../services/authService';
import { 
  fetchRepoInfo, fetchRepoContents, fetchFileContent, updateRepoFile, 
  deleteRepoFile, renameRepoFile 
} from '../services/githubService';
import { MarkdownView } from './MarkdownView';
import { Whiteboard } from './Whiteboard';
import { GoogleGenAI, FunctionDeclaration, Type } from '@google/genai';
import { ShareModal } from './ShareModal';

// --- Interfaces & Constants ---

// Added missing StorageSource type definition
type StorageSource = 'cloud' | 'drive' | 'github' | 'session';

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
  onSessionStop: () => void;
  onStartLiveSession: (channel: Channel, context?: string) => void;
  isProMember?: boolean;
  onOpenManual?: () => void;
  isInterviewerMode?: boolean;
  initialFiles?: CodeFile[];
  onFileChange?: (file: CodeFile) => void;
  externalChatContent?: TranscriptItem[];
  isAiThinking?: boolean;
  onSyncCodeWithAi?: (file: CodeFile) => void;
  activeFilePath?: string | null;
  onActiveFileChange?: (path: string | null) => void;
}

function getLanguageFromExt(filename: string): any {
    if (!filename) return 'text';
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['js', 'jsx'].includes(ext || '')) return 'javascript';
    if (['ts', 'tsx'].includes(ext || '')) return 'typescript';
    if (ext === 'py') return 'python';
    if (['cpp', 'c', 'h', 'hpp'].includes(ext || '')) return 'c++';
    if (ext === 'html') return 'html';
    if (ext === 'css') return 'css';
    if (ext === 'json') return 'json';
    if (ext === 'md') return 'markdown';
    if (['draw', 'whiteboard', 'wb'].includes(ext || '')) return 'whiteboard';
    return 'text';
}

const FileIcon = ({ filename }: { filename: string }) => {
    if (!filename) return <File size={16} className="text-slate-500" />;
    const lang = getLanguageFromExt(filename);
    if (lang === 'javascript' || lang === 'typescript') return <FileCode size={16} className="text-yellow-400" />;
    if (lang === 'python') return <FileCode size={16} className="text-blue-400" />;
    if (lang === 'c++') return <FileCode size={16} className="text-indigo-400" />;
    if (lang === 'html') return <FileCode size={16} className="text-orange-400" />;
    if (lang === 'css') return <FileCode size={16} className="text-blue-300" />;
    if (lang === 'json') return <FileCode size={16} className="text-green-400" />;
    if (lang === 'markdown') return <FileTextIcon size={16} className="text-slate-400" />;
    if (lang === 'whiteboard') return <PenTool size={16} className="text-pink-500" />;
    return <File size={16} className="text-slate-500" />;
};

const FileTreeItem = ({ node, depth, activeId, onSelect, onToggle, expandedIds, loadingIds }: any) => {
    const isExpanded = expandedIds[node.id];
    const isLoading = loadingIds[node.id];
    const isActive = activeId === node.id;
    
    return (
        <div>
            <div 
                className={`flex items-center gap-1 py-1 px-2 cursor-pointer select-none hover:bg-slate-800/50 group ${isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
                onClick={() => onSelect(node)}
            >
                {node.type === 'folder' && (
                    <div onClick={(e) => { e.stopPropagation(); onToggle(node); }} className="p-0.5 hover:text-white">
                        {isLoading ? <Loader2 size={12} className="animate-spin"/> : isExpanded ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
                    </div>
                )}
                {node.type === 'folder' ? (
                    isExpanded ? <FolderOpen size={16} className="text-indigo-400"/> : <Folder size={16} className="text-indigo-400"/>
                ) : (
                    <FileIcon filename={node.name} />
                )}
                <span className="text-xs truncate flex-1">{node.name}</span>
                {node.status === 'modified' && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 ml-1"></div>}
            </div>
            {isExpanded && node.children && (
                <div>
                    {node.children.map((child: any) => (
                        <FileTreeItem 
                            key={child.id} 
                            node={child} 
                            depth={depth + 1} 
                            activeId={activeId} 
                            onSelect={node.data ? () => onSelect(node) : undefined} 
                            onToggle={onToggle} 
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
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const lineNumbersRef = useRef<HTMLDivElement>(null);
    const lineCount = (code || '').split('\n').length;
    
    const handleScroll = () => {
        if (textareaRef.current && lineNumbersRef.current) {
            lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            if (readOnly) return;
            const target = e.currentTarget;
            const start = target.selectionStart;
            const end = target.selectionEnd;
            const value = target.value;
            const tabStr = indentMode === 'spaces' ? "    " : "\t"; 
            const updatedValue = value.substring(0, start) + tabStr + value.substring(end);
            onChange(updatedValue);
            requestAnimationFrame(() => {
                target.selectionStart = target.selectionEnd = start + tabStr.length;
            });
        }
    };

    const editorStyles = { 
        fontSize: `${fontSize}px`, 
        lineHeight: '1.6', 
        tabSize: 4, 
        MozTabSize: 4,
        fontFamily: "'JetBrains Mono', monospace"
    } as React.CSSProperties;

    return (
        <div className="w-full h-full flex bg-slate-950 font-mono overflow-hidden relative">
            <div ref={lineNumbersRef} className="w-12 flex-shrink-0 bg-slate-900 text-slate-600 py-4 text-right pr-3 select-none overflow-hidden border-r border-slate-800" style={editorStyles}>
                {Array.from({ length: lineCount }).map((_, i) => <div key={i} className="h-[1.6em]">{i + 1}</div>)}
            </div>
            <textarea
                ref={textareaRef}
                className="flex-1 bg-transparent text-slate-300 p-4 resize-none outline-none leading-relaxed overflow-auto whitespace-pre scrollbar-hide"
                style={editorStyles}
                value={code || ''}
                wrap="off"
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onScroll={handleScroll}
                onSelect={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    const val = target.value.substr(0, target.selectionStart);
                    const lines = val.split('\n');
                    if (onCursorMove) onCursorMove(lines.length, lines[lines.length - 1].length);
                }}
                spellCheck={false}
                readOnly={readOnly}
            />
        </div>
    );
};

const AIChatPanel = ({ isOpen, onClose, messages, onSendMessage, isThinking }: any) => {
    const [input, setInput] = useState('');
    return (
        <div className="flex flex-col h-full bg-slate-950 border-l border-slate-800">
            <div className="p-3 border-b border-slate-800 flex justify-between items-center bg-slate-900">
                <span className="font-bold text-slate-300 text-sm flex items-center gap-2"><Bot size={16} className="text-indigo-400"/> AI Assistant</span>
                <button onClick={onClose} title="Minimize AI Panel"><PanelRightClose size={16} className="text-slate-500 hover:text-white"/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
                {messages.map((m: any, i: number) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[95%] rounded-lg p-3 text-sm leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'}`}>
                            {m.role === 'ai' ? <MarkdownView content={m.text} /> : <p className="whitespace-pre-wrap">{m.text}</p>}
                        </div>
                    </div>
                ))}
                {isThinking && <div className="text-slate-500 text-xs flex items-center gap-2 justify-center"><Loader2 className="animate-spin" size={12}/> AI is thinking...</div>}
            </div>
            <div className="p-3 border-t border-slate-800 bg-slate-950">
                <div className="flex gap-2">
                    <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') { onSendMessage(input); setInput(''); } }} className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 placeholder-slate-600" placeholder="Ask AI to edit code..." />
                    <button onClick={() => { onSendMessage(input); setInput(''); }} className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"><Send size={16}/></button>
                </div>
            </div>
        </div>
    );
};

export const CodeStudio: React.FC<CodeStudioProps> = ({ 
  onBack, currentUser, userProfile, sessionId, accessKey, onSessionStart, onSessionStop, onStartLiveSession,
  isProMember, onOpenManual, isInterviewerMode, initialFiles, onFileChange, externalChatContent, isAiThinking,
  onSyncCodeWithAi, activeFilePath: propActiveFilePath, onActiveFileChange
}) => {
  if (isProMember === false) {
    return (
        <div className="h-full flex items-center justify-center p-6 bg-slate-950">
            <div className="max-w-md w-full bg-slate-900 border border-indigo-500/30 rounded-[3rem] p-12 text-center shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-32 bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none"></div>
                <Lock size={48} className="text-indigo-400 mx-auto mb-6 relative z-10" />
                <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-4 relative z-10">Pro Access Required</h2>
                <button onClick={onBack} className="w-full py-4 bg-indigo-600 hover:bg-indigo-50 text-white font-black uppercase tracking-widest rounded-2xl transition-all relative z-10">Back to Hub</button>
            </div>
        </div>
    );
  }

  const defaultFile: CodeFile = {
      name: 'hello.cpp',
      path: 'cloud://hello.cpp',
      language: 'c++',
      content: `#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}`,
      loaded: true,
      isDirectory: false
  };

  // MULTI-PANE STATE
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('single');
  const [activeSlots, setActiveSlots] = useState<(CodeFile | null)[]>([defaultFile, null, null, null]);
  const [focusedSlot, setFocusedSlot] = useState<number>(0);
  const [slotViewModes, setSlotViewModes] = useState<Record<number, 'code' | 'preview'>>({});
  const [innerSplitRatio, setInnerSplitRatio] = useState(50); 
  const [isDraggingInner, setIsDraggingInner] = useState(false);
  
  const [project, setProject] = useState<CodeProject>({ id: 'init', name: 'New Project', files: initialFiles || [defaultFile], lastModified: Date.now() });
  const [activeTab, setActiveTab] = useState<StorageSource>('cloud');
  const [isLeftOpen, setIsLeftOpen] = useState(true);
  const [isRightOpen, setIsRightOpen] = useState(true);
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'ai', text: string}>>([{ role: 'ai', text: "Ready to build. Open a file from the explorer to begin." }]);
  const [isChatThinking, setIsChatThinking] = useState(false);
  // Added isLoading state to fix CodeStudio error
  const [isLoading, setIsLoading] = useState(false);
  
  const [cloudItems, setCloudItems] = useState<CloudItem[]>([]); 
  const [driveItems, setDriveItems] = useState<(DriveFile & { parentId?: string, isLoaded?: boolean })[]>([]); 
  const [driveRootId, setDriveRootId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [loadingFolders, setLoadingFolders] = useState<Record<string, boolean>>({});
  
  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [githubToken, setGithubToken] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'modified' | 'saving'>('saved');
  const [isSharedSession, setIsSharedSession] = useState(!!sessionId);
  const [fontSize, setFontSize] = useState(14);
  const [indentMode, setIndentMode] = useState<IndentMode>('spaces');
  const [leftWidth, setLeftWidth] = useState(256); 
  const [rightWidth, setRightWidth] = useState(320); 
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [activeClients, setActiveClients] = useState<Record<string, CursorPosition>>({});
  const [clientId] = useState(() => crypto.randomUUID());

  const centerContainerRef = useRef<HTMLDivElement>(null);
  const activeFile = activeSlots[focusedSlot];

  // Tool for In-Place Editing (CRITICAL FOR AI VISIBILITY)
  const updateFileTool: FunctionDeclaration = {
    name: "update_active_file",
    description: "Updates the content of the currently focused file in the editor. Use this whenever the user asks for code modifications.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        new_content: { type: Type.STRING, description: "The complete new content." },
        summary: { type: Type.STRING, description: "Brief summary of changes." }
      },
      required: ["new_content"]
    }
  };

  const writeFileTool: FunctionDeclaration = {
    name: 'write_file',
    description: 'Create or update a specific file in the workspace. Forces the editor to open this file.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            path: { type: Type.STRING, description: 'File path.' },
            content: { type: Type.STRING, description: 'Content.' }
        },
        required: ['path', 'content']
    }
  };

  const dispatchLog = useCallback((text: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
      window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: `[Studio] ${text}`, type } }));
  }, []);

  // --- Real-time Collaboration Logic ---
  useEffect(() => {
    if (sessionId) {
        setIsSharedSession(true);
        setActiveTab('session');
        const unsubscribe = subscribeToCodeProject(sessionId, (remoteProject: any) => {
            setProject(prev => {
                const mergedFiles = [...prev.files];
                remoteProject.files.forEach((rf: any) => {
                    const idx = mergedFiles.findIndex(f => (f.path || f.name) === (rf.path || rf.name));
                    if (idx > -1) {
                        if (rf.content !== mergedFiles[idx].content) mergedFiles[idx] = rf;
                    } else { mergedFiles.push(rf); }
                });
                return { ...remoteProject, files: mergedFiles };
            });
            if (remoteProject.activeSlots && remoteProject.activeClientId !== clientId) setActiveSlots(remoteProject.activeSlots);
            if (remoteProject.layoutMode) setLayoutMode(remoteProject.layoutMode);
            if (remoteProject.cursors) setActiveClients(remoteProject.cursors);
        });
        return () => unsubscribe();
    }
  }, [sessionId, clientId]);

  const handleSetLayout = (mode: LayoutMode) => {
      setLayoutMode(mode);
      if (mode === 'single' && focusedSlot !== 0) setFocusedSlot(0);
      // layoutMode is now optional on CodeProject to fix error
      if (isSharedSession && sessionId) saveCodeProject({ ...project, layoutMode: mode, activeClientId: clientId });
  };

  const updateSlotFile = (file: CodeFile | null, slotIndex: number) => {
      const newSlots = [...activeSlots];
      newSlots[slotIndex] = file;
      setActiveSlots(newSlots);
      if (file && isPreviewable(file.name)) setSlotViewModes(prev => ({ ...prev, [slotIndex]: 'code' }));
      if (isSharedSession && sessionId) {
          if (file) updateProjectActiveFile(sessionId, file.path || file.name);
          // activeSlots is now optional on CodeProject to fix error
          saveCodeProject({ ...project, activeSlots: newSlots, activeClientId: clientId });
          if (file) updateCodeFile(sessionId, file);
      }
      if (file && onActiveFileChange) onActiveFileChange(file.path);
  };

  const isPreviewable = (filename: string) => ['md', 'wb', 'draw'].includes(filename.split('.').pop()?.toLowerCase() || '');

  const handleCodeChangeInSlot = (newCode: string, slotIdx: number) => {
      const file = activeSlots[slotIdx];
      if (!file) return;
      // isModified is now optional on CodeFile to fix error
      const updatedFile = { ...file, content: newCode, isModified: true };
      const newSlots = [...activeSlots];
      newSlots[slotIdx] = updatedFile;
      setActiveSlots(newSlots);
      setProject(prev => ({ ...prev, files: prev.files.map(f => (f.path || f.name) === (file.path || f.name) ? updatedFile : f) }));
      setSaveStatus('modified');
      if (isSharedSession && sessionId) updateCodeFile(sessionId, updatedFile);
      if (onFileChange) onFileChange(updatedFile);
  };

  const handleExplorerSelect = async (node: TreeNode) => {
      if (node.type === 'file') {
          let fileData: CodeFile | null = null;
          if (activeTab === 'cloud') {
                const item = node.data as CloudItem;
                if (item.url) {
                    const res = await fetch(item.url);
                    const text = await res.text();
                    // isModified is now optional on CodeFile to fix error
                    fileData = { name: item.name, path: item.fullPath, content: text, language: getLanguageFromExt(item.name), loaded: true, isModified: false };
                }
          } else if (activeTab === 'drive' && driveToken) {
                const driveFile = node.data as DriveFile;
                const text = await readDriveFile(driveToken, driveFile.id);
                // isModified is now optional on CodeFile to fix error
                fileData = { name: driveFile.name, path: `drive://${driveFile.id}`, content: text, language: getLanguageFromExt(driveFile.name), loaded: true, isModified: false };
          } else if (activeTab === 'github') {
                const file = node.data as CodeFile;
                if (!file.loaded && project.github) {
                    const content = await fetchFileContent(githubToken, project.github.owner, project.github.repo, file.path || file.name, project.github.branch);
                    fileData = { ...file, content, loaded: true };
                } else { fileData = file; }
          } else { fileData = node.data; }

          if (fileData) updateSlotFile(fileData, focusedSlot);
      } else {
          setExpandedFolders(prev => ({...prev, [node.id]: !expandedFolders[node.id]}));
      }
  };

  const handleSendMessage = async (input: string) => {
      if (!input.trim()) return;
      setChatMessages(prev => [...prev, { role: 'user', text: input }]);
      setIsChatThinking(true);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const contextFiles = activeSlots.filter(f => f !== null).map(f => `File: ${f?.name}\nContent:\n${f?.content}`).join('\n---\n');
          const systemPrompt = `You are a Senior Engineer helping in Code Studio.\nWorkspace:\n${contextFiles}\nFocused File: ${activeFile?.name || "None"}`;

          const resp = await ai.models.generateContent({ 
              model: 'gemini-3-flash-preview', 
              contents: `${systemPrompt}\nUser: ${input}`,
              config: { tools: [{ functionDeclarations: [updateFileTool, writeFileTool] }] }
          });

          if (resp.functionCalls) {
              for (const fc of resp.functionCalls) {
                  if (fc.name === 'update_active_file') {
                      const { new_content, summary } = fc.args as any;
                      if (activeFile) {
                          handleCodeChangeInSlot(new_content, focusedSlot);
                          setChatMessages(prev => [...prev, { role: 'ai', text: `✨ **Edit Applied to ${activeFile.name}**\n\n${summary || "Updated."}` }]);
                      }
                  } else if (fc.name === 'write_file') {
                      const { path, content } = fc.args as any;
                      const newFile: CodeFile = { name: path, path: path, language: getLanguageFromExt(path), content, loaded: true };
                      setProject(prev => ({ ...prev, files: [...prev.files, newFile] }));
                      updateSlotFile(newFile, focusedSlot);
                      setChatMessages(prev => [...prev, { role: 'ai', text: `✅ Manifested ${path}.` }]);
                  }
              }
          } else { setChatMessages(prev => [...prev, { role: 'ai', text: resp.text || "No response." }]); }
      } catch (e: any) { setChatMessages(prev => [...prev, { role: 'ai', text: `Error: ${e.message}` }]); } 
      finally { setIsChatThinking(false); }
  };

  const resize = useCallback((e: MouseEvent) => {
    if (isDraggingLeft) { const newWidth = e.clientX; if (newWidth > 160 && newWidth < 500) setLeftWidth(newWidth); }
    if (isDraggingRight) { const newWidth = window.innerWidth - e.clientX; if (newWidth > 160 && newWidth < 500) setRightWidth(newWidth); }
    if (isDraggingInner && centerContainerRef.current) {
        const rect = centerContainerRef.current.getBoundingClientRect();
        const ratio = layoutMode === 'split-v' ? ((e.clientX - rect.left) / rect.width) * 100 : ((e.clientY - rect.top) / rect.height) * 100;
        if (ratio > 10 && ratio < 90) setInnerSplitRatio(ratio);
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

  const workspaceTree = useMemo(() => {
      const root: TreeNode[] = [];
      const map = new Map<string, TreeNode>();
      project.files.forEach(f => {
          const path = f.path || f.name;
          // isModified is now optional on CodeFile to fix error
          map.set(path, { id: path, name: f.name.split('/').pop()!, type: f.isDirectory ? 'folder' : 'file', data: f, children: [], status: f.isModified ? 'modified' : undefined });
      });
      project.files.forEach(f => {
          const path = f.path || f.name;
          const node = map.get(path)!;
          const parts = path.split('/');
          if (parts.length === 1) root.push(node);
          else {
              const parent = map.get(parts.slice(0, -1).join('/'));
              if (parent) parent.children?.push(node); else root.push(node);
          }
      });
      return root;
  }, [project.files]);

  // Added driveTree calculation for explorer
  const driveTree = useMemo(() => {
      return driveItems.map(f => ({
          id: f.id,
          name: f.name,
          type: f.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file',
          data: f,
          children: []
      }));
  }, [driveItems]);

  const handleRefreshSource = async () => {
    setIsLoading(true);
    dispatchLog(`Syncing ${activeTab.toUpperCase()}...`);
    try {
        if (activeTab === 'github' && userProfile?.defaultRepoUrl) {
            const [owner, repo] = userProfile.defaultRepoUrl.replace('https://github.com/', '').split('/');
            const info = await fetchRepoInfo(owner, repo, githubToken);
            const { files } = await fetchRepoContents(githubToken, owner, repo, info.default_branch);
            setProject(prev => ({ ...prev, files }));
        } else if (activeTab === 'drive') {
            const token = getDriveToken() || await connectGoogleDrive();
            setDriveToken(token);
            const rootId = await ensureCodeStudioFolder(token);
            const files = await listDriveFiles(token, rootId);
            setDriveItems(files.map(f => ({ ...f, isLoaded: false })));
        }
    } catch(e: any) { dispatchLog(e.message, 'error'); } finally { setIsLoading(false); }
  };

  useEffect(() => {
    if (activeTab === 'github' && userProfile?.defaultRepoUrl && project.files.length === 0) handleRefreshSource();
  }, [activeTab]);

  const handleCreateFile = () => {
      const name = prompt("File name (e.g. main.py):");
      if (!name) return;
      const newFile: CodeFile = { name, path: name, language: getLanguageFromExt(name), content: '', loaded: true };
      setProject(prev => ({ ...prev, files: [...prev.files, newFile] }));
      updateSlotFile(newFile, focusedSlot);
  };

  const handleCreateBoard = () => {
      const name = prompt("Board name:");
      if (!name) return;
      const newFile: CodeFile = { name: `${name}.wb`, path: `${name}.wb`, language: 'whiteboard', content: '[]', loaded: true };
      setProject(prev => ({ ...prev, files: [...prev.files, newFile] }));
      updateSlotFile(newFile, focusedSlot);
  };

  const renderSlot = (idx: number) => {
      const file = activeSlots[idx];
      const isFocused = focusedSlot === idx;
      const isVisible = layoutMode === 'single' ? idx === 0 : (layoutMode === 'quad' ? true : idx < 2);
      if (!isVisible) return null;
      const slotStyle = (layoutMode === 'split-v' || layoutMode === 'split-h') 
        ? { [layoutMode === 'split-v' ? 'width' : 'height']: `${idx === 0 ? innerSplitRatio : 100 - innerSplitRatio}%`, flex: 'none' } 
        : { flex: 1 };

      return (
          <div key={idx} onClick={() => setFocusedSlot(idx)} style={slotStyle} className={`flex flex-col border ${isFocused ? 'border-indigo-500 z-10' : 'border-slate-800'} bg-slate-950 overflow-hidden`}>
              {file ? (
                  <>
                    <div className={`px-3 py-1.5 flex items-center justify-between border-b ${isFocused ? 'bg-indigo-900/20' : 'bg-slate-900'}`}>
                        <div className="flex items-center gap-2 overflow-hidden">
                            <FileIcon filename={file.name} />
                            <span className="text-xs font-bold truncate">{file.name}</span>
                        </div>
                        <button onClick={() => updateSlotFile(null, idx)} className="p-1 hover:bg-slate-800 rounded text-slate-500"><X size={12}/></button>
                    </div>
                    <div className="flex-1 overflow-hidden">
                        {getLanguageFromExt(file.name) === 'whiteboard' ? (
                            <Whiteboard initialContent={file.content} onChange={(c) => handleCodeChangeInSlot(c, idx)} backgroundColor="#000000" />
                        ) : (
                            <RichCodeEditor code={file.content} onChange={(c: string) => handleCodeChangeInSlot(c, idx)} fontSize={fontSize} indentMode={indentMode} />
                        )}
                    </div>
                  </>
              ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-800 bg-slate-950/50 m-4 rounded-xl border-2 border-dashed border-slate-800 group hover:border-slate-600 cursor-pointer">
                      <Plus size={32} className="opacity-20 group-hover:opacity-40 transition-opacity" />
                      <p className="text-[10px] font-black uppercase tracking-widest mt-2">Slot {idx + 1}</p>
                  </div>
              )}
          </div>
      );
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden relative font-sans">
      <header className="h-14 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-4 shrink-0 z-20">
         <div className="flex items-center space-x-4">
            <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"><ArrowLeft size={20} /></button>
            <button onClick={() => setIsLeftOpen(!isLeftOpen)} className={`p-2 rounded-lg transition-colors ${isLeftOpen ? 'bg-slate-800 text-white' : 'text-slate-400'}`}>{isLeftOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}</button>
            <h1 className="font-bold text-white text-sm flex items-center gap-2"><Code className="text-indigo-400" size={18}/> {project.name}</h1>
         </div>

         <div className="flex items-center space-x-2">
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 mr-4">
                <button onClick={() => handleSetLayout('single')} className={`p-1.5 rounded transition-colors ${layoutMode === 'single' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}><SquareIcon size={16}/></button>
                <button onClick={() => handleSetLayout('split-v')} className={`p-1.5 rounded transition-colors ${layoutMode === 'split-v' ? 'bg-indigo-600 text-white' : 'text-slate-50'}`}><Columns size={16}/></button>
                <button onClick={() => handleSetLayout('split-h')} className={`p-1.5 rounded transition-colors ${layoutMode === 'split-h' ? 'bg-indigo-600 text-white' : 'text-slate-50'}`}><Rows size={16}/></button>
                <button onClick={() => handleSetLayout('quad')} className={`p-1.5 rounded transition-colors ${layoutMode === 'quad' ? 'bg-indigo-600 text-white' : 'text-slate-50'}`}><Grid2X2 size={16}/></button>
            </div>
            <button onClick={() => setFontSize(f => Math.max(10, f - 2))} className="p-1.5 hover:bg-slate-700 rounded text-slate-400"><ZoomOut size={16}/></button>
            <button onClick={() => setFontSize(f => Math.min(48, f + 2))} className="p-1.5 hover:bg-slate-700 rounded text-slate-400"><ZoomIn size={16}/></button>
            <button onClick={() => setShowShareModal(true)} className="flex items-center space-x-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold"><Share2 size={14}/><span>Share</span></button>
            <button onClick={() => setIsRightOpen(!isRightOpen)} className={`p-2 rounded-lg transition-colors ${isRightOpen ? 'bg-slate-800 text-white' : 'text-slate-50'}`}>{isRightOpen ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}</button>
         </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
          {/* EXPLORER PANEL */}
          <div className={`${isLeftOpen ? '' : 'hidden'} bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 overflow-hidden`} style={{ width: `${leftWidth}px` }}>
              <div className="flex border-b border-slate-800 bg-slate-900">
                  {(['cloud', 'drive', 'github'] as StorageSource[]).map(t => (
                      <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-3 flex justify-center border-b-2 transition-colors ${activeTab === t ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                          {t === 'cloud' ? <Cloud size={16}/> : t === 'drive' ? <HardDrive size={16}/> : <Github size={16}/>}
                      </button>
                  ))}
              </div>
              <div className="p-3 border-b border-slate-800 flex gap-2 bg-slate-900 justify-center">
                  <button onClick={handleCreateFile} className="flex-1 flex items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white py-1.5 px-2 rounded text-xs font-bold transition-colors whitespace-nowrap"><FilePlus size={14}/> <span>File</span></button>
                  <button onClick={handleCreateBoard} className="flex-1 flex items-center justify-center gap-1 bg-pink-600 hover:bg-pink-500 text-white py-1.5 px-2 rounded text-xs font-bold transition-colors whitespace-nowrap"><PenTool size={14}/> <span>Board</span></button>
                  <button onClick={handleRefreshSource} className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"><RefreshCw size={16} className={isLoading ? 'animate-spin' : ''}/></button>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-hide">
                  {activeTab === 'cloud' && workspaceTree.map(node => <FileTreeItem key={node.id} node={node} depth={0} activeId={activeFile?.path} onSelect={handleExplorerSelect} onToggle={()=>{}} expandedIds={expandedFolders} loadingIds={loadingFolders}/>)}
                  {activeTab === 'drive' && driveTree.map(node => <FileTreeItem key={node.id} node={node} depth={0} activeId={activeFile?.path} onSelect={handleExplorerSelect} onToggle={()=>{}} expandedIds={expandedFolders} loadingIds={loadingFolders}/>)}
                  {activeTab === 'github' && workspaceTree.map(node => <FileTreeItem key={node.id} node={node} depth={0} activeId={activeFile?.path} onSelect={handleExplorerSelect} onToggle={()=>{}} expandedIds={expandedFolders} loadingIds={loadingFolders}/>)}
              </div>
          </div>

          <div onMouseDown={() => setIsDraggingLeft(true)} className="w-1 cursor-col-resize hover:bg-indigo-500/50 transition-colors z-30 shrink-0 bg-slate-800/20 group relative">
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 bg-indigo-500 p-0.5 rounded-full pointer-events-none"><GripVertical size={10}/></div>
          </div>

          <div ref={centerContainerRef} className={`flex-1 bg-slate-950 flex min-w-0 relative ${layoutMode === 'quad' ? 'grid grid-cols-2 grid-rows-2' : layoutMode === 'split-v' ? 'flex-row' : 'flex-col'}`}>
              {layoutMode === 'single' && renderSlot(0)}
              {(layoutMode === 'split-v' || layoutMode === 'split-h') && (
                  <>
                    {renderSlot(0)}
                    <div onMouseDown={() => setIsDraggingInner(true)} className={`${layoutMode === 'split-v' ? 'w-1.5 cursor-col-resize' : 'h-1.5 cursor-row-resize'} hover:bg-indigo-500/50 transition-colors z-40 bg-slate-800 flex-shrink-0 relative group`}>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 bg-indigo-500 p-1 rounded-full shadow-lg"><GripVertical size={12}/></div>
                    </div>
                    {renderSlot(1)}
                  </>
              )}
              {layoutMode === 'quad' && [0,1,2,3].map(i => renderSlot(i))}
          </div>

          <div onMouseDown={() => setIsDraggingRight(true)} className="w-1 cursor-col-resize hover:bg-indigo-500/50 transition-colors z-30 shrink-0 bg-slate-800/20 group relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 bg-indigo-500 p-0.5 rounded-full pointer-events-none"><GripVertical size={10}/></div>
          </div>

          <div className={`${isRightOpen ? '' : 'hidden'} bg-slate-950 flex flex-col shrink-0 overflow-hidden transition-all duration-300`} style={{ width: `${rightWidth}px` }}>
              <AIChatPanel isOpen={true} onClose={() => setIsRightOpen(false)} messages={chatMessages} onSendMessage={handleSendMessage} isThinking={isChatThinking} />
          </div>
      </div>
      
      <ShareModal 
        isOpen={showShareModal} onClose={() => setShowShareModal(false)} link={`${window.location.origin}/?session=${sessionId}`} title={project.name} 
        onShare={async (uids, pub) => { await updateProjectAccess(sessionId!, pub ? 'public' : 'restricted', uids); }} 
      />
    </div>
  );
};

export default CodeStudio;
