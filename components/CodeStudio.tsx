import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Editor, { OnMount, loader } from '@monaco-editor/react';
import { 
    CodeProject, CodeFile, UserProfile, Channel, CursorPosition, 
    CloudItem, TranscriptItem, WhiteboardElement 
} from '../types';
import { 
  ArrowLeft, Save, Plus, Github, Cloud, HardDrive, Code, X, ChevronRight, ChevronDown, 
  File, Folder, DownloadCloud, Loader2, CheckCircle, AlertTriangle, Info, FolderPlus, 
  FileCode, RefreshCw, LogIn, CloudUpload, Trash2, ArrowUp, Edit2, FolderOpen, MoreVertical, 
  Send, MessageSquare, Bot, Mic, Sparkles, SidebarClose, SidebarOpen, Users, Eye, 
  FileText as FileTextIcon, Image as ImageIcon, StopCircle, Minus, Maximize2, Minimize2, 
  Lock, Unlock, Share2, Terminal, Copy, WifiOff, PanelRightClose, PanelRightOpen, 
  PanelLeftClose, PanelLeftOpen, Monitor, Laptop, PenTool, Edit3, ShieldAlert, ZoomIn, 
  ZoomOut, Columns, Rows, Grid2X2, Square as SquareIcon, GripVertical, GripHorizontal, 
  FileSearch, Indent, Wand2, Check, UserCheck, Briefcase, FileUser, Trophy, Star, Play, 
  Camera, FilePlus, MicOff, Activity, Database, Globe, FlaskConical, Beaker, CheckCircle2, Circle,
  Search, TerminalSquare, Command, Cpu, Binary, Layers, Boxes, Workflow, Ghost,
  MousePointer2, Network, Radio, Compass, Target, Hash, Settings2, CodeSquare, 
  Bug, Boxes as BoxesIcon, Clipboard, History, Move, HardDriveDownload
} from 'lucide-react';
import { 
  listCloudDirectory, saveProjectToCloud, deleteCloudItem, createCloudFolder, 
  subscribeToCodeProject, saveCodeProject, updateCodeFile, updateCursor, 
  claimCodeProjectLock, updateProjectActiveFile, deleteCodeFile, moveCloudFile, 
  updateProjectAccess, sendShareNotification, deleteCloudFolderRecursive,
  getCodeProject, deductCoins, AI_COSTS 
} from '../services/firestoreService';
import { 
  ensureCodeStudioFolder, listDriveFiles, readDriveFile, saveToDrive, 
  deleteDriveFile, createDriveFolder, DriveFile, moveDriveFile,
  downloadDriveFileAsBlob, getDriveFileStreamUrl, ensureFolder
} from '../services/googleDriveService';
import { connectGoogleDrive, signInWithGoogle, getDriveToken } from '../services/authService';
import { 
  fetchRepoInfo, fetchRepoContents, fetchFileContent, updateRepoFile, 
  deleteRepoFile, renameRepoFile, fetchRepoSubTree 
} from '../services/githubService';
import { GeminiLiveService } from '../services/geminiLive';
import { MarkdownView } from './MarkdownView';
import { Whiteboard } from './Whiteboard';
import { Visualizer } from './Visualizer';
import { GoogleGenAI, FunctionDeclaration, Type } from '@google/genai';
import { ShareModal } from './ShareModal';
// Added missing import for generateSecureId to fix error on line 612
import { generateSecureId } from '../utils/idUtils';

// --- Interfaces & Internal Models ---

interface VFSNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children: VFSNode[];
  data?: CodeFile;
  isLoaded?: boolean;
  isOpen?: boolean;
  isModified?: boolean;
  source: StorageSource;
  parentId: string | null;
}

type LayoutMode = 'single' | 'split-v' | 'split-h' | 'quad';
type StorageSource = 'cloud' | 'drive' | 'github' | 'session';

// Added TreeItem component to resolve error on line 535
const TreeItem: React.FC<{ 
    node: VFSNode; 
    depth: number; 
    activeId?: string | null; 
    onSelect: (node: VFSNode) => void 
}> = ({ node, depth, activeId, onSelect }) => {
    const isSelected = activeId === node.id;
    const Icon = node.type === 'folder' ? (node.isOpen ? FolderOpen : Folder) : File;
    
    return (
        <div className="flex flex-col">
            <button 
                onClick={() => onSelect(node)}
                style={{ paddingLeft: `${depth * 12 + 12}px` }}
                className={`w-full flex items-center gap-2 py-1 text-xs transition-colors group ${isSelected ? 'bg-indigo-600/20 text-white border-r-2 border-indigo-500' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
            >
                <div className="shrink-0">
                    {node.type === 'folder' ? (
                        node.isOpen ? <ChevronDown size={14} className="text-slate-600"/> : <ChevronRight size={14} className="text-slate-600"/>
                    ) : (
                        <div className="w-3.5 h-3.5" />
                    )}
                </div>
                <Icon size={14} className={node.type === 'folder' ? 'text-indigo-400' : 'text-slate-500'} />
                <span className={`truncate ${node.isModified ? 'font-bold' : ''}`}>{node.name}</span>
                {node.isModified && <div className="w-1 h-1 rounded-full bg-amber-500 ml-auto mr-2" />}
            </button>
            {node.type === 'folder' && node.isOpen && node.children.map(child => (
                <TreeItem key={child.id} node={child} depth={depth + 1} activeId={activeId} onSelect={onSelect} />
            ))}
        </div>
    );
};

interface CodeStudioProps {
  onBack: () => void;
  currentUser: any;
  userProfile: UserProfile | null;
  sessionId?: string;
  onSessionStart?: (id: string) => void;
  onSessionStop?: () => void;
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

interface AuditStep {
    id: string;
    label: string;
    status: 'pending' | 'active' | 'success' | 'fail';
}

interface TerminalLine {
    id: string;
    text: string;
    type: 'input' | 'output' | 'error' | 'info' | 'success';
    time: string;
}

// --- MONACO THEME REGISTRY ---
const configureMonaco = (monaco: any) => {
    monaco.editor.defineTheme('neural-night', {
        base: 'vs-dark',
        inherit: true,
        rules: [
            { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
            { token: 'keyword', foreground: 'ff79c6', fontStyle: 'bold' },
            { token: 'string', foreground: 'f1fa8c' },
            { token: 'number', foreground: 'bd93f9' },
            { token: 'type', foreground: '8be9fd', fontStyle: 'italic' },
            { token: 'function', foreground: '50fa7b' },
        ],
        colors: {
            'editor.background': '#020617',
            'editor.foreground': '#f8fafc',
            'editor.lineHighlightBackground': '#1e293b50',
            'editorCursor.foreground': '#6366f1',
            'editorIndentGuide.background': '#1e293b',
            'editorIndentGuide.activeBackground': '#334155',
            'editorLineNumber.foreground': '#475569',
            'editor.selectionBackground': '#6366f140',
        }
    });
};

// --- HELPER: LANGUAGE RESOLUTION ---
function getLanguageFromExt(filename: string): any {
    if (!filename) return 'text';
    const ext = filename.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
        'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
        'py': 'python', 'cpp': 'cpp', 'c': 'cpp', 'h': 'cpp', 'hpp': 'cpp',
        'java': 'java', 'go': 'go', 'rs': 'rust', 'html': 'html', 'css': 'css',
        'json': 'json', 'md': 'markdown', 'wb': 'whiteboard', 'draw': 'whiteboard'
    };
    return map[ext || ''] || 'text';
}

// --- AI TOOL DEFINITIONS ---
const writeFileTool: FunctionDeclaration = {
    name: 'write_file',
    description: 'Manifest or update a logic node in the VFS Registry. Automatically focuses the tab.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            path: { type: Type.STRING, description: 'Path (e.g. src/main.cpp)' },
            content: { type: Type.STRING, description: 'Full UTF-8 content.' }
        },
        required: ['path', 'content']
    }
};

const readFileTool: FunctionDeclaration = {
    name: 'read_file',
    description: 'Ingest content from the VFS Registry.',
    parameters: {
        type: Type.OBJECT,
        properties: { path: { type: Type.STRING } },
        required: ['path']
    }
};

const executeTerminalTool: FunctionDeclaration = {
    name: 'execute_cmd',
    description: 'Simulate a terminal command. AI predicts the stdout based on VFS state.',
    parameters: {
        type: Type.OBJECT,
        properties: { command: { type: Type.STRING } },
        required: ['command']
    }
};

// --- MAIN ARCHITECTURAL COMPONENT ---
export const CodeStudio: React.FC<CodeStudioProps> = ({ 
  onBack, currentUser, userProfile, sessionId, onSessionStart, onSessionStop, onStartLiveSession,
  isProMember, onOpenManual, isInterviewerMode, initialFiles, onFileChange, externalChatContent, 
  isAiThinking, onSyncCodeWithAi, activeFilePath: propActivePath, onActiveFileChange
}) => {
  if (isProMember === false) {
    return (
        <div className="h-full flex items-center justify-center p-6 bg-slate-950">
            <div className="max-w-md w-full bg-slate-900 border border-indigo-500/30 rounded-[3rem] p-12 text-center shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-32 bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none"></div>
                <Lock size={48} className="text-indigo-400 mx-auto mb-6 relative z-10" />
                <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-4 relative z-10">Pro Access Required</h2>
                <p className="text-slate-400 text-sm mb-10 font-medium relative z-10">Neural Builder Studio requires an active Pro Membership to handle high-fidelity refractions.</p>
                <button onClick={onBack} className="w-full py-4 bg-indigo-600 hover:bg-indigo-50 text-white font-black uppercase tracking-widest rounded-2xl transition-all relative z-10">Back to Hub</button>
            </div>
        </div>
    );
  }

  // --- 1. STATE FOUNDATION ---
  const [activeTab, setActiveTab] = useState<StorageSource>('cloud');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('single');
  const [activeSlots, setActiveSlots] = useState<(CodeFile | null)[]>([null, null, null, null]);
  const [focusedSlot, setFocusedSlot] = useState<number>(0);
  
  // VFS Registry
  const [vfsRoot, setVfsRoot] = useState<VFSNode[]>([]);
  const [files, setFiles] = useState<CodeFile[]>(initialFiles || []);
  const filesRef = useRef<CodeFile[]>(initialFiles || []);
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'modified' | 'syncing'>('saved');

  // UI Resizing (Tri-Axis Control)
  const [leftWidth, setLeftWidth] = useState(() => parseInt(localStorage.getItem('studio_left_w') || '260'));
  const [rightWidth, setRightWidth] = useState(() => parseInt(localStorage.getItem('studio_right_w') || '340'));
  const [terminalHeight, setTerminalHeight] = useState(() => parseInt(localStorage.getItem('studio_term_h') || '180'));
  const [innerSplit, setInnerSplit] = useState(50);
  const [isResizing, setIsResizing] = useState<'left' | 'right' | 'terminal' | 'inner' | null>(null);

  // Terminal & Simulations
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([
      { id: '1', text: 'DyadAI Architecture v10.4.0 initialization complete.', type: 'info', time: new Date().toLocaleTimeString() },
      { id: '2', text: 'Heuristic Simulation Engine: READY.', type: 'success', time: new Date().toLocaleTimeString() }
  ]);

  // AI & Live Collaboration
  const [chatMessages, setChatMessages] = useState<TranscriptItem[]>([]);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [isAiConnected, setIsAiConnected] = useState(false);
  const [volume, setVolume] = useState(0);
  const serviceRef = useRef<GeminiLiveService | null>(null);
  const [remoteCursors, setRemoteCursors] = useState<Record<string, CursorPosition>>({});

  // Audit Step Matrix
  const [auditSteps, setAuditSteps] = useState<AuditStep[]>([
      { id: 'vfs', label: 'VFS Consistency Check', status: 'success' },
      { id: 'monaco', label: 'Monaco Buffer Mapping', status: 'pending' },
      { id: 'diff', label: 'Sparse Diff Generation', status: 'pending' },
      { id: 'live', label: 'Emotive Link Handshake', status: 'pending' }
  ]);

  const activeFile = useMemo(() => activeSlots[focusedSlot], [activeSlots, focusedSlot]);

  // --- 2. VFS LOGIC (Recursive Engine) ---
  const rebuildVfs = useCallback(() => {
    const root: VFSNode[] = [];
    const nodeMap = new Map<string, VFSNode>();

    files.forEach(f => {
        const parts = f.path.split('/');
        let currentPath = '';
        
        parts.forEach((part, idx) => {
            const parentPath = currentPath;
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            const isLast = idx === parts.length - 1;
            
            if (!nodeMap.has(currentPath)) {
                const node: VFSNode = {
                    id: currentPath,
                    name: part,
                    type: (isLast && !f.isDirectory) ? 'file' : 'folder',
                    source: activeTab,
                    parentId: parentPath || null,
                    children: [],
                    data: isLast ? f : undefined,
                    isOpen: nodeMap.get(currentPath)?.isOpen || false,
                    isModified: f.isModified
                };
                nodeMap.set(currentPath, node);
                if (!parentPath) root.push(node);
                else nodeMap.get(parentPath)?.children.push(node);
            }
        });
    });
    setVfsRoot(root);
  }, [files, activeTab]);

  useEffect(() => { rebuildVfs(); }, [rebuildVfs]);
  useEffect(() => { filesRef.current = files; }, [files]);

  const handleFileSelect = async (node: VFSNode) => {
      if (node.type === 'folder') {
          node.isOpen = !node.isOpen;
          rebuildVfs();
          return;
      }
      
      const file = node.data!;
      if (!file.loaded) {
          setIsLoading(true);
          try {
              let content = '';
              if (activeTab === 'drive') {
                  const token = getDriveToken() || await connectGoogleDrive();
                  content = await readDriveFile(token, file.path);
              } else if (activeTab === 'github') {
                  const gh = userProfile?.defaultRepoUrl?.split('/') || [];
                  content = await fetchFileContent(localStorage.getItem('github_token'), gh[3], gh[4], file.path);
              }
              file.content = content;
              file.loaded = true;
          } catch (e) {
              window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: "VFS Registry Load Fault.", type: 'error' } }));
          } finally {
              setIsLoading(false);
          }
      }
      
      const next = [...activeSlots];
      next[focusedSlot] = file;
      setActiveSlots(next);
      if (onActiveFileChange) onActiveFileChange(file.path);
  };

  const handleEditorChange = (val: string | undefined) => {
      if (!activeFile) return;
      const updated = { ...activeFile, content: val || '', isModified: true };
      setFiles(prev => prev.map(f => f.path === activeFile.path ? updated : f));
      const nextSlots = [...activeSlots];
      nextSlots[focusedSlot] = updated;
      setActiveSlots(nextSlots);
      setSaveStatus('modified');
      if (onFileChange) onFileChange(updated);
  };

  // --- 3. TERMINAL & SIMULATION ---
  const addTerminalLine = (text: string, type: TerminalLine['type'] = 'info') => {
      const newLine: TerminalLine = { id: Math.random().toString(), text, type, time: new Date().toLocaleTimeString() };
      setTerminalLines(prev => [newLine, ...prev].slice(0, 100));
  };

  const runSimulation = async (cmd?: string) => {
      const command = cmd || `g++ ${activeFile?.name || 'main.cpp'} -o app && ./app`;
      setIsTerminalOpen(true);
      addTerminalLine(command, 'input');
      
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const context = files.filter(f => f.loaded).map(f => `PATH: ${f.path}\nCONTENT:\n${f.content}`).join('\n\n');
          const prompt = `WORKSPACE CONTEXT:\n${context}\n\nEXECUTE COMMAND: "${command}"\n\nPredict STDOUT/STDERR. If errors occur, explain them Socratically. Return ONLY output text.`;
          
          const res = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: prompt,
              config: { thinkingConfig: { thinkingBudget: 0 } }
          });
          
          addTerminalLine(res.text || "Command complete (no output).", 'output');
      } catch (e: any) {
          addTerminalLine(`Simulation Fault: ${e.message}`, 'error');
      }
  };

  // --- 4. LIVE PARTNER & MULTI-AGENT SYNC ---
  const toggleLive = async () => {
    if (isLiveActive) {
        serviceRef.current?.disconnect();
        setIsLiveActive(false);
        setIsAiConnected(false);
        return;
    }

    setIsLiveActive(true);
    const service = new GeminiLiveService();
    serviceRef.current = service;

    const systemInstruction = `You are the Lead Technical Architect. You have full access to the VFS Registry. Use tools to manage code and simulate terminals.`;

    try {
        await service.connect('Zephyr', systemInstruction, {
            onOpen: () => setIsAiConnected(true),
            onClose: () => { setIsLiveActive(false); setIsAiConnected(false); },
            onError: (err) => addTerminalLine(`Link Fault: ${err}`, 'error'),
            onVolumeUpdate: (v) => setVolume(v),
            onTranscript: (text, isUser) => {
                setChatMessages(prev => [...prev, { role: isUser ? 'user' : 'ai', text, timestamp: Date.now() }]);
            },
            onToolCall: async (tc) => {
                for (const fc of tc.functionCalls) {
                    if (fc.name === 'write_file') {
                        const args = fc.args as any;
                        const newFile: CodeFile = { 
                            name: args.path.split('/').pop()!, 
                            path: args.path, 
                            content: args.content, 
                            language: getLanguageFromExt(args.path), 
                            loaded: true 
                        };
                        setFiles(prev => [...prev.filter(f => f.path !== args.path), newFile]);
                        const nextSlots = [...activeSlots];
                        nextSlots[focusedSlot] = newFile;
                        setActiveSlots(nextSlots);
                        service.sendToolResponse({ id: fc.id, name: fc.name, response: { result: "Node Manifested." } });
                    } else if (fc.name === 'execute_cmd') {
                        runSimulation((fc.args as any).command);
                        service.sendToolResponse({ id: fc.id, name: fc.name, response: { result: "Dispatched to Heuristic Engine." } });
                    }
                }
            }
        }, [{ functionDeclarations: [writeFileTool, readFileTool, executeTerminalTool] }]);
    } catch (e) { setIsLiveActive(false); }
  };

  // --- 5. RESIZE ENGINE ---
  const handleMouseMove = useCallback((e: MouseEvent) => {
      if (!isResizing) return;
      if (isResizing === 'left') {
          const w = Math.max(180, Math.min(600, e.clientX));
          setLeftWidth(w);
          localStorage.setItem('studio_left_w', w.toString());
      }
      if (isResizing === 'right') {
          const w = Math.max(240, Math.min(700, window.innerWidth - e.clientX));
          setRightWidth(w);
          localStorage.setItem('studio_right_w', w.toString());
      }
      if (isResizing === 'terminal') {
          const h = Math.max(100, Math.min(700, window.innerHeight - e.clientY));
          setTerminalHeight(h);
          localStorage.setItem('studio_term_h', h.toString());
      }
      if (isResizing === 'inner') {
          const rect = document.getElementById('grid-host')?.getBoundingClientRect();
          if (rect) {
              const p = layoutMode === 'split-v' ? ((e.clientX - rect.left) / rect.width) * 100 : ((e.clientY - rect.top) / rect.height) * 100;
              setInnerSplit(Math.max(10, Math.min(90, p)));
          }
      }
  }, [isResizing, layoutMode]);

  useEffect(() => {
      if (isResizing) {
          window.addEventListener('mousemove', handleMouseMove);
          window.addEventListener('mouseup', () => setIsResizing(null));
          return () => window.removeEventListener('mousemove', handleMouseMove);
      }
  }, [isResizing, handleMouseMove]);

  // --- 6. RENDERERS ---
  const renderSlot = (idx: number) => {
      const file = activeSlots[idx];
      const isFocused = focusedSlot === idx;
      const isVisible = layoutMode === 'single' ? idx === 0 : (layoutMode === 'quad' ? true : idx < 2);
      if (!isVisible) return null;

      const style = (layoutMode === 'split-v' || layoutMode === 'split-h')
          ? { [layoutMode === 'split-v' ? 'width' : 'height']: `${idx === 0 ? innerSplit : 100 - innerSplit}%`, flex: 'none' }
          : { flex: 1 };

      return (
          <div 
            key={idx} 
            onClick={() => setFocusedSlot(idx)}
            style={style} 
            className={`flex flex-col border transition-all relative overflow-hidden ${isFocused ? 'border-indigo-500 z-10' : 'border-slate-800'}`}
          >
              {file ? (
                  <>
                    <div className={`h-10 px-4 flex items-center justify-between border-b shrink-0 ${isFocused ? 'bg-indigo-950/40 border-indigo-500/30' : 'bg-slate-900 border-slate-800'}`}>
                        <div className="flex items-center gap-3">
                            {file.isModified && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-lg" />}
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-200">{file.name}</span>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); const n = [...activeSlots]; n[idx] = null; setActiveSlots(n); }} className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-white"><X size={14}/></button>
                    </div>
                    <div className="flex-1 overflow-hidden bg-[#020617]">
                        {getLanguageFromExt(file.name) === 'whiteboard' ? (
                            <Whiteboard initialContent={file.content} onChange={handleEditorChange} backgroundColor="#020617" />
                        ) : (
                            <Editor
                                theme="neural-night"
                                language={getLanguageFromExt(file.name)}
                                value={file.content}
                                onChange={handleEditorChange}
                                onMount={(editor, monaco) => configureMonaco(monaco)}
                                options={{
                                    fontSize: 13,
                                    fontFamily: "'JetBrains Mono', monospace",
                                    minimap: { enabled: false },
                                    lineNumbers: 'on',
                                    padding: { top: 16 },
                                    scrollBeyondLastLine: false,
                                    smoothScrolling: true,
                                    cursorBlinking: 'smooth'
                                }}
                            />
                        )}
                    </div>
                  </>
              ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-800 gap-4 group cursor-pointer hover:bg-slate-900/10 transition-colors">
                      <div className="p-6 rounded-full border-2 border-dashed border-slate-800 group-hover:border-indigo-500/50 group-hover:scale-110 transition-all">
                          <Plus size={40} className="opacity-10 group-hover:opacity-100 group-hover:text-indigo-400" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-[0.4em]">Mount Node</span>
                  </div>
              )}
          </div>
      );
  };

  return (
    <div className="h-full w-full bg-slate-950 text-slate-100 flex flex-col font-sans overflow-hidden">
        {/* GLOBAL HEADER */}
        <header className="h-14 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 shrink-0 z-50 backdrop-blur-xl">
            <div className="flex items-center gap-6">
                <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"><ArrowLeft size={18}/></button>
                <div className="flex items-center gap-3 bg-slate-950 border border-slate-800 px-4 py-1.5 rounded-xl shadow-inner">
                    <Database size={14} className="text-indigo-400"/>
                    <span className="text-[10px] font-black uppercase text-slate-400">{activeTab}://</span>
                    <span className="text-xs font-bold text-white truncate max-w-[200px]">{activeFile?.name || 'root'}</span>
                </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-inner">
                <button onClick={() => setLayoutMode('single')} className={`p-1.5 rounded-lg transition-all ${layoutMode === 'single' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}><SquareIcon size={14}/></button>
                <button onClick={() => setLayoutMode('split-v')} className={`p-1.5 rounded-lg transition-all ${layoutMode === 'split-v' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}><Columns size={14}/></button>
                <button onClick={() => setLayoutMode('split-h')} className={`p-1.5 rounded-lg transition-all ${layoutMode === 'split-h' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}><Rows size={14}/></button>
                <button onClick={() => setLayoutMode('quad')} className={`p-1.5 rounded-lg transition-all ${layoutMode === 'quad' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}><Grid2X2 size={14}/></button>
            </div>

            <div className="flex items-center gap-3">
                <button onClick={() => setIsTerminalOpen(!isTerminalOpen)} className={`p-2 rounded-xl transition-all ${isTerminalOpen ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:bg-slate-800'}`}><Terminal size={18}/></button>
                <button onClick={() => runSimulation()} className="px-6 py-2 bg-white text-slate-950 font-black uppercase text-[10px] tracking-widest rounded-lg shadow-xl active:scale-95 transition-all">Execute Refraction</button>
                <button onClick={toggleLive} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-xl ${isLiveActive ? 'bg-red-600 text-white animate-pulse' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}><Mic size={16}/> {isLiveActive ? 'End Link' : 'Talk to AI'}</button>
            </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
            {/* VFS EXPLORER */}
            <aside className="bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 relative transition-all" style={{ width: `${leftWidth}px` }}>
                <div className="flex border-b border-slate-800 bg-slate-950/50">
                    <button className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-indigo-400 border-b-2 border-indigo-500">Registry</button>
                    <button className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-slate-400 transition-colors">Audit</button>
                </div>
                <div className="flex p-1.5 bg-slate-950/40 border-b border-slate-800 gap-1">
                    {(['cloud', 'drive', 'github'] as StorageSource[]).map(s => (
                        <button key={s} onClick={() => setActiveTab(s)} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${activeTab === s ? 'bg-slate-800 text-white border border-white/5 shadow-lg' : 'text-slate-600 hover:text-slate-400'}`}>{s}</button>
                    ))}
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-hide py-4 px-2 space-y-1">
                    {vfsRoot.map(node => (
                        <TreeItem key={node.id} node={node} depth={0} activeId={activeFile?.path} onSelect={handleFileSelect} />
                    ))}
                </div>
                <div onMouseDown={() => setIsResizing('left')} className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-indigo-500/50 transition-colors z-50" />
            </aside>

            {/* EDITOR GRID */}
            <div className="flex-1 flex flex-col min-w-0 bg-slate-950 relative">
                <div id="grid-host" className={`flex-1 relative ${layoutMode === 'quad' ? 'grid grid-cols-2 grid-rows-2' : layoutMode === 'split-v' ? 'flex flex-row' : 'flex flex-col'}`}>
                    {[0, 1, 2, 3].map(i => renderSlot(i))}
                    {layoutMode !== 'single' && layoutMode !== 'quad' && (
                        <div 
                            onMouseDown={() => setIsResizing('inner')}
                            className={`absolute z-40 bg-slate-800/40 hover:bg-indigo-500 transition-colors ${layoutMode === 'split-v' ? 'w-1 h-full cursor-col-resize' : 'h-1 w-full cursor-row-resize'}`}
                            style={layoutMode === 'split-v' ? { left: `${innerSplit}%` } : { top: `${innerSplit}%` }}
                        />
                    )}
                </div>

                {/* TERMINAL DRAWER */}
                <div className={`${isTerminalOpen ? 'flex' : 'hidden'} flex-col bg-slate-950 border-t border-slate-800 shrink-0 relative`} style={{ height: `${terminalHeight}px` }}>
                    <div onMouseDown={() => setIsResizing('terminal')} className="absolute top-0 left-0 w-full h-1 cursor-row-resize hover:bg-indigo-500 transition-colors z-50" />
                    <div className="h-10 px-5 flex items-center justify-between border-b border-slate-800 bg-slate-900/50">
                        <div className="flex items-center gap-3 text-[10px] font-black text-indigo-400 uppercase tracking-widest"><Terminal size={14}/> Heuristic Logic Console</div>
                        <button onClick={() => setTerminalLines([])} className="p-1 hover:text-white text-slate-600 transition-colors"><RefreshCw size={14}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5 font-mono text-[11px] space-y-1.5 scrollbar-hide flex flex-col-reverse">
                        {terminalLines.map(l => (
                            <div key={l.id} className={`flex gap-4 animate-fade-in ${l.type === 'error' ? 'text-red-400' : l.type === 'success' ? 'text-emerald-400' : l.type === 'input' ? 'text-indigo-400' : 'text-slate-500'}`}>
                                <span className="opacity-30 shrink-0">[{l.time}]</span>
                                <span className="whitespace-pre-wrap leading-relaxed">{l.text}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* AI CHAT SIDEBAR */}
            <aside className="bg-slate-950 border-l border-slate-800 flex flex-col shrink-0 relative overflow-hidden" style={{ width: `${rightWidth}px` }}>
                <div onMouseDown={() => setIsResizing('right')} className="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-indigo-500/50 transition-colors z-50" />
                <div className="p-5 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Sparkles size={18} className="text-indigo-400"/>
                        <span className="text-xs font-black uppercase tracking-tighter text-white">Neural Partner</span>
                    </div>
                    {isLiveActive && <div className="w-20 h-4"><Visualizer volume={volume} isActive={true} color="#6366f1"/></div>}
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-hide">
                    {chatMessages.map((m, i) => (
                        <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in-up`}>
                            <span className={`text-[9px] font-black uppercase mb-1.5 ${m.role === 'user' ? 'text-indigo-400' : 'text-slate-500'}`}>{m.role === 'user' ? 'Local' : 'Prism'}</span>
                            <div className={`max-w-[90%] rounded-2xl p-4 text-xs leading-relaxed shadow-2xl ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-slate-900 text-slate-300 rounded-tl-sm border border-slate-800'}`}>
                                {m.text}
                            </div>
                        </div>
                    ))}
                    {isAiThinking && (
                        <div className="flex items-center gap-4 p-4 bg-slate-900 rounded-2xl w-fit animate-pulse border border-white/5">
                            <Loader2 size={14} className="animate-spin text-indigo-400" />
                            <span className="text-[10px] font-black uppercase text-slate-600 tracking-widest">Handshaking logic...</span>
                        </div>
                    )}
                </div>
                <div className="p-5 border-t border-slate-800 bg-slate-900/50">
                    <form onSubmit={(e) => { e.preventDefault(); /* Chat Handle */ }} className="relative group">
                        <textarea placeholder="Describe logic requirements..." className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 pr-12 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500/50 resize-none h-28 shadow-inner transition-all group-hover:border-indigo-500/30" />
                        <button className="absolute bottom-4 right-4 p-2 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-500 transition-all active:scale-95 shadow-indigo-900/40"><Send size={18}/></button>
                    </form>
                </div>
            </aside>
        </div>

        {/* ANALYTICS FOOTER */}
        <footer className="h-6 bg-slate-900 border-t border-slate-800 flex items-center justify-between px-6 shrink-0">
            <div className="flex items-center gap-6 text-[9px] font-black text-slate-600 uppercase tracking-widest">
                <div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${isLiveActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`} /> {isLiveActive ? 'Link: 0ms' : 'Link: Offline'}</div>
                <div className="flex items-center gap-2"><Cpu size={10} /> 18x Efficiency (Flash)</div>
                <div>Trace: {generateSecureId().substring(0, 12)}</div>
            </div>
            <div className="text-[9px] font-black text-slate-700 uppercase tracking-[0.4em]">Neural Prism v10.4.0-SOVEREIGN</div>
        </footer>
    </div>
  );
};

export default CodeStudio;