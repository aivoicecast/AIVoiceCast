import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { CodeProject, CodeFile, UserProfile, Channel, CursorPosition, CloudItem, TranscriptItem } from '../types';
import { ArrowLeft, Save, Plus, Github, Cloud, HardDrive, Code, X, ChevronRight, ChevronDown, File, Folder, DownloadCloud, Loader2, CheckCircle, AlertCircle, Info, FolderPlus, FileCode, RefreshCw, LogIn, CloudUpload, Trash2, ArrowUp, Edit2, FolderOpen, MoreVertical, Send, MessageSquare, Bot, Mic, Sparkles, SidebarClose, SidebarOpen, Users, Eye, FileText as FileTextIcon, Image as ImageIcon, StopCircle, Minus, Maximize2, Minimize2, Lock, Unlock, Share2, Terminal, Copy, WifiOff, PanelRightClose, PanelRightOpen, PanelLeftClose, PanelLeftOpen, Monitor, Laptop, PenTool, Edit3, ShieldAlert, ZoomIn, ZoomOut, Columns, Rows, Grid2X2, Square as SquareIcon, GripVertical, GripHorizontal, FileSearch, Indent, Wand2, Check, UserCheck, Play, Camera, MicOff, Signal } from 'lucide-react';
import { auth, db } from '../services/firebaseConfig';
import { listCloudDirectory, saveProjectToCloud, deleteCloudItem, createCloudFolder, subscribeToCodeProject, saveCodeProject, updateCodeFile, updateCursor, claimCodeProjectLock, updateProjectActiveFile, deleteCodeFile, moveCloudFile, updateProjectAccess, sendShareNotification, deleteCloudFolderRecursive, getCloudFileContent } from '../services/firestoreService';
import { ensureCodeStudioFolder, listDriveFiles, readDriveFile, saveToDrive, deleteDriveFile, createDriveFolder, DriveFile, moveDriveFile } from '../services/googleDriveService';
import { connectGoogleDrive, signInWithGoogle, connectGoogleDrive as connectDrive } from '../services/authService';
import { fetchRepoInfo, fetchRepoContents, fetchFileContent, updateRepoFile, deleteRepoFile, renameRepoFile } from '../services/githubService';
import { MarkdownView } from './MarkdownView';
import { encodePlantUML } from '../utils/plantuml';
import { Whiteboard } from './Whiteboard';
import { GoogleGenAI, FunctionDeclaration, Type as GenType, Chat } from '@google/genai';
import { GeminiLiveService } from '../services/geminiLive';
import { Visualizer } from './Visualizer';
import { ShareModal } from './ShareModal';
import { generateSecureId, safeJsonStringify } from '../utils/idUtils';
import { logger } from '../services/logger';
import Editor from '@monaco-editor/react';

// --- Interfaces & Constants ---

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
  onStartLiveSession: (channel: Channel, context?: string, recordingEnabled?: boolean, bookingId?: string, videoEnabled?: boolean, cameraEnabled?: boolean, activeSegment?: { index: number, lectureId: string }, recordingDuration?: number, interactionEnabled?: boolean, recordingTarget?: 'drive' | 'youtube', sessionTitle?: string) => void;
  isProMember?: boolean;
  onOpenManual?: () => void;
  isInterviewerMode?: boolean;
  initialFiles?: CodeFile[];
  onFileChange?: (file: CodeFile) => void;
  externalChatContent?: TranscriptItem[];
  isAiThinking?: boolean;
  onSyncCodeWithAi?: (file: CodeFile) => void;
  activeFilePath?: string;
  onActiveFileChange?: (path: string) => void;
}

function getLanguageFromExt(filename: string): CodeFile['language'] {
    if (!filename) return 'text';
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['js', 'jsx'].includes(ext || '')) return 'javascript';
    if (['ts', 'tsx'].includes(ext || '')) return 'typescript';
    if (ext === 'py') return 'python';
    if (['cpp', 'c', 'h', 'hpp', 'cc', 'hh', 'cxx'].includes(ext || '')) return 'cpp';
    if (ext === 'java') return 'java';
    if (ext === 'go') return 'go';
    if (ext === 'rs') return 'rs';
    if (ext === 'json') return 'json';
    if (ext === 'md') return 'markdown';
    if (ext === 'html') return 'html';
    if (ext === 'css') return 'css';
    if (['puml', 'plantuml'].includes(ext || '')) return 'plantuml';
    if (['draw', 'whiteboard', 'wb'].includes(ext || '')) return 'whiteboard';
    return 'text';
}

const FileIcon = ({ filename }: { filename: string }) => {
    if (!filename) return <File size={16} className="text-slate-500" />;
    const lang = getLanguageFromExt(filename);
    if (lang === 'javascript' || lang === 'typescript') return <FileCode size={16} className="text-yellow-400" />;
    if (lang === 'python') return <FileCode size={16} className="text-blue-400" />;
    if (lang === 'cpp') return <FileCode size={16} className="text-indigo-400" />;
    if (lang === 'html') return <FileCode size={16} className="text-orange-400" />;
    if (lang === 'css') return <FileCode size={16} className="text-blue-300" />;
    if (lang === 'json') return <FileCode size={16} className="text-green-400" />;
    if (lang === 'markdown') return <FileTextIcon size={16} className="text-slate-400" />;
    if (lang === 'plantuml') return <ImageIcon size={16} className="text-pink-400" />;
    if (lang === 'whiteboard') return <PenTool size={16} className="text-pink-500" />;
    return <File size={16} className="text-slate-500" />;
};

const FileTreeItem = ({ node, depth, activeId, onSelect, onToggle, onDelete, onRename, onShare, expandedIds, loadingIds, onDragStart, onDrop }: any) => {
    const isExpanded = expandedIds[node.id];
    const isLoading = loadingIds[node.id];
    const isActive = activeId === node.id;
    
    return (
        <div>
            <div 
                className={`flex items-center gap-1 py-1 px-2 cursor-pointer select-none hover:bg-slate-800/50 group ${isActive ? 'bg-indigo-600/20 text-white border-l-2 border-indigo-500' : 'text-slate-400 hover:text-slate-200'}`}
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
                onClick={() => onSelect(node)}
                draggable
                onDragStart={(e) => onDragStart(e, node)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDrop(e, node)}
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
                            onSelect={node.data ? (n: any) => onSelect(n) : onSelect} 
                            onToggle={onToggle} 
                            onDelete={onDelete} 
                            onRename={onRename} 
                            onShare={onShare}
                            expandedIds={expandedIds} 
                            loadingIds={loadingIds}
                            onDragStart={onDragStart}
                            onDrop={onDrop}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const AIChatPanel = ({ isOpen, onClose, messages, onSendMessage, isThinking, isLiveActive, onToggleLive, liveVolume, isRecovering }: any) => {
    const [input, setInput] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isThinking]);

    return (
        <div className="flex flex-col h-full bg-slate-950 border-l border-slate-800 shadow-2xl">
            <div className="p-3 border-b border-slate-800 flex justify-between items-center bg-slate-900 shrink-0">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-600/20 rounded-lg">
                        <Bot size={16} className="text-indigo-400"/>
                    </div>
                    <div className="flex flex-col">
                        <span className="font-black text-white text-xs uppercase tracking-widest">Code Partner</span>
                        <span className={`text-[8px] font-bold uppercase tracking-tighter ${isRecovering ? 'text-amber-500 animate-pulse' : 'text-emerald-500'}`}>
                            {isRecovering ? 'Neural Link Recovery...' : 'Handshake Active'}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-6 w-16 overflow-hidden rounded-full bg-slate-950/50">
                        <Visualizer volume={liveVolume} isActive={isLiveActive} color="#6366f1" />
                    </div>
                    <button 
                        onClick={onToggleLive} 
                        className={`p-2 rounded-xl transition-all ${isLiveActive ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-800 text-slate-400 hover:text-indigo-400'}`}
                        title={isLiveActive ? "Disconnect Voice" : "Connect Voice Link"}
                    >
                        {isLiveActive ? <MicOff size={16}/> : <Mic size={16}/>}
                    </button>
                    <button onClick={onClose} title="Minimize AI Panel" className="p-1 hover:bg-slate-800 rounded transition-colors">
                        <PanelRightClose size={16} className="text-slate-500 hover:text-white"/>
                    </button>
                </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
                {messages.map((m: any, i: number) => (
                    <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in-up`}>
                        <span className={`text-[9px] font-black uppercase tracking-widest mb-1 ${m.role === 'user' ? 'text-indigo-500' : 'text-slate-50'}`}>
                            {m.role === 'user' ? 'You' : 'Neural Partner'}
                        </span>
                        <div className={`max-w-[90%] rounded-2xl p-3 text-sm leading-relaxed shadow-lg ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-slate-900 border border-slate-800 text-slate-300 rounded-tl-sm'}`}>
                            {m.role === 'ai' ? <MarkdownView content={m.text} /> : <p className="whitespace-pre-wrap">{m.text}</p>}
                        </div>
                    </div>
                ))}
                {isThinking && (
                    <div className="flex items-center gap-3 animate-pulse">
                        <div className="p-2 bg-slate-900 rounded-full border border-slate-800">
                            <Loader2 className="animate-spin text-indigo-500" size={12}/>
                        </div>
                        <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Partner is analyzing code...</span>
                    </div>
                )}
                {isRecovering && (
                    <div className="flex items-center gap-3 animate-pulse">
                        <div className="p-2 bg-amber-900/20 rounded-full border border-amber-500/30">
                            <Signal className="text-amber-500" size={12}/>
                        </div>
                        <span className="text-amber-500 text-[10px] font-black uppercase tracking-widest">Re-establishing link...</span>
                    </div>
                )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950 shrink-0">
                <div className="flex gap-2 bg-slate-900 border border-slate-800 rounded-2xl p-2 focus-within:border-indigo-500 transition-colors shadow-inner">
                    <textarea 
                        rows={1}
                        value={input} 
                        onChange={e => setInput(e.target.value)} 
                        onKeyDown={e => { 
                            if(e.key === 'Enter' && !e.shiftKey) { 
                                e.preventDefault();
                                onSendMessage(input); 
                                setInput(''); 
                            } 
                        }} 
                        className="flex-1 bg-transparent px-3 py-1.5 text-sm text-slate-200 outline-none placeholder-slate-600 resize-none" 
                        placeholder="Ask your partner for help..." 
                    />
                    <button 
                        onClick={() => { onSendMessage(input); setInput(''); }} 
                        disabled={!input.trim() || isThinking}
                        className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all disabled:opacity-30 shadow-lg"
                    >
                        <Send size={18}/>
                    </button>
                </div>
                <p className="text-[8px] text-slate-600 text-center mt-2 uppercase font-black tracking-widest">Sovereign Logic Synthesis Enabled</p>
            </div>
        </div>
    );
};

export const CodeStudio: React.FC<CodeStudioProps> = ({ onBack, currentUser, userProfile, sessionId, accessKey, onSessionStart, onSessionStop, onStartLiveSession, isProMember, onOpenManual, isInterviewerMode, initialFiles, onFileChange, externalChatContent, isAiThinking, onSyncCodeWithAi, activeFilePath: propActiveFilePath, onActiveFileChange }) => {
  const defaultFile: CodeFile = {
      name: 'hello.cpp',
      path: 'hello.cpp',
      language: 'cpp',
      content: `#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}`,
      loaded: true,
      isDirectory: false,
      isModified: true
  };

  const dispatchLog = useCallback((text: string, type: any = 'info', meta?: any) => {
      logger[type as keyof typeof logger](text, meta);
  }, []);

  // PROJECT SESSION ID: Unique identity for grouping cloud files in the VFS layer
  const [projectSessionId] = useState(() => sessionId || generateSecureId());

  // MULTI-PANE STATE
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('single');
  const [activeSlots, setActiveSlots] = useState<(CodeFile | null)[]>([defaultFile, null, null, null]);
  const [focusedSlot, setFocusedSlot] = useState<number>(0);
  const [slotViewModes, setSlotViewModes] = useState<Record<number, 'code' | 'preview'>>({});
  
  const [innerSplitRatio, setInnerSplitRatio] = useState(50); 
  const [isDraggingInner, setIsDraggingInner] = useState(false);
  
  const [project, setProject] = useState<CodeProject>({ id: projectSessionId, name: 'New Project', files: initialFiles || [defaultFile], lastModified: Date.now() });
  const [activeTab, setActiveTab] = useState<'cloud' | 'drive' | 'github' | 'session'>('cloud');
  const [isLeftOpen, setIsLeftOpen] = useState(true);
  const [isRightOpen, setIsRightOpen] = useState(true);
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'ai', text: string}>>([{ role: 'ai', text: "Hey! I'm your code partner. Let's build something awesome together.\n\nYou can ask me to **modify files, refactor logic, or explain complex concepts**. I'll update the code directly in the editor for you!" }]);
  const [isChatThinking, setIsChatThinking] = useState(false);
  const [isFormattingSlots, setIsFormattingSlots] = useState<Record<number, boolean>>({});
  
  // LIVE VOICE STATE
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [isAiConnected, setIsAiConnected] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [liveVolume, setVolume] = useState(0);
  const liveServiceRef = useRef<GeminiLiveService | null>(null);
  const autoReconnectAttempts = useRef(0);
  const maxAutoRetries = 200; // Increased budget for long sessions

  // TERMINAL STATE
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string>('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(200);
  const [isDraggingTerminal, setIsDraggingTerminal] = useState(false);

  const [cloudItems, setCloudItems] = useState<CloudItem[]>([]); 
  const [driveItems, setDriveItems] = useState<(DriveFile & { parentId?: string, isLoaded?: boolean })[]>([]); 
  const [driveRootId, setDriveRootId] = useState<string | null>(null);
  const [githubItems, setGithubItems] = useState<CodeFile[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [loadingFolders, setLoadingFolders] = useState<Record<string, boolean>>({});
  
  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [githubToken, setGithubToken] = useState<string | null>(localStorage.getItem('github_token'));
  const [saveStatus, setSaveStatus] = useState<'saved' | 'modified' | 'saving'>('saved');
  const [isSharedSession, setIsSharedSession] = useState(!!sessionId);
  const [isZenMode, setIsZenMode] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [indentMode, setIndentMode] = useState<IndentMode>('spaces');
  const [leftWidth, setLeftWidth] = useState(256); 
  const [rightWidth, setRightWidth] = useState(320); 
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);

  const [showShareModal, setShowShareModal] = useState(false);
  const [writeToken, setWriteToken] = useState<string | undefined>(accessKey);
  const [isReadOnly, setIsReadOnly] = useState(!!sessionId && !accessKey);
  const [activeClients, setActiveClients] = useState<Record<string, CursorPosition>>({});
  const [clientId] = useState(() => crypto.randomUUID());

  const centerContainerRef = useRef<HTMLDivElement>(null);
  const activeFile = activeSlots[focusedSlot];
  const chatRef = useRef<Chat | null>(null);
  const projectFilesRef = useRef<CodeFile[]>(project.files);

  useEffect(() => {
    projectFilesRef.current = project.files;
  }, [project.files]);

  /**
   * Neural Linguistic Refiner:
   * Aggressively collapses multiple spaces and ensures punctuation is properly aligned.
   * Handles fragmented voice inputs like "He llo".
   */
  const refineTranscriptText = (text: string): string => {
      return text
          .replace(/\s+/g, ' ')               // Collapse whitespace
          .replace(/\s+([,.!?;:])/g, '$1')    // Remove spaces before punctuation
          .trim();
  };

  // Tool Definitions
  const updateFileTool: FunctionDeclaration = {
    name: "update_active_file",
    description: "Updates the content of the currently focused file in the editor. Use this whenever the user asks for code modifications, refactoring, or additions to the file.",
    parameters: {
      type: GenType.OBJECT,
      properties: {
        new_content: {
          type: GenType.STRING,
          description: "The complete new content of the file. Maintain proper indentation."
        },
        summary_for_user: {
          type: GenType.STRING,
          description: "A friendly, partner-like explanation of what was changed and why."
        }
      },
      required: ["new_content", "summary_for_user"]
    }
  };

  const writeFileTool: FunctionDeclaration = {
    name: "write_file",
    description: "Create or overwrite a file in the workspace by path. Use this for presenting problems, adding function stubs, or injecting boilerplate.",
    parameters: {
      type: GenType.OBJECT,
      properties: {
        path: { type: GenType.STRING, description: "The path for the file (e.g. 'hello.cpp')" },
        content: { type: GenType.STRING, description: "Full new content for the file." }
      },
      required: ["path", "content"]
    }
  };

  const readFileTool: FunctionDeclaration = {
      name: "read_file",
      description: "Read the content of a specific file in the workspace. Use this to examine existing logic or verify a file was created correctly.",
      parameters: {
          type: GenType.OBJECT,
          properties: {
              path: { type: GenType.STRING, description: "Path of the file to read." }
          },
          required: ["path"]
      }
  };

  const codeTools = [{ functionDeclarations: [updateFileTool, writeFileTool, readFileTool] }];

  const processAiToolCall = useCallback(async (name: string, args: any) => {
    dispatchLog(`VFS HANDSHAKE: Processing Tool Call [${name}]`, 'info', { category: 'VFS' });

    if (name === 'update_active_file') {
        const active = activeSlots[focusedSlot];
        if (!active) return { result: "Error: No file currently focused for update." };
        const targetPath = active.path || active.name;
        const content = args.new_content;

        const newFile = { ...active, content, isModified: true };
        setProject(prev => ({ ...prev, files: prev.files.map(f => (f.path || f.name) === targetPath ? newFile : f) }));
        setActiveSlots(prev => prev.map((s, i) => i === focusedSlot ? newFile : s));
        return { result: `Success. ${targetPath} updated.` };

    } else if (name === 'write_file') {
        const targetPath = args.path;
        const content = args.content;
        const newFile: CodeFile = { 
            name: targetPath.split('/').pop()!, 
            path: targetPath, 
            content: content, 
            language: getLanguageFromExt(targetPath), 
            loaded: true, 
            isModified: true 
        };

        setProject(prev => {
            const idx = prev.files.findIndex(f => (f.path || f.name) === targetPath);
            const nextFiles = [...prev.files];
            if (idx > -1) nextFiles[idx] = newFile; else nextFiles.push(newFile);
            return { ...prev, files: nextFiles };
        });

        setActiveSlots(prevSlots => prevSlots.map(s => {
            if (s && (s.path === targetPath || s.name === targetPath)) return newFile;
            return s;
        }));

        if (activeTab === 'cloud' && currentUser) {
            const lastSlash = targetPath.lastIndexOf('/');
            const parentPath = lastSlash > -1 ? targetPath.substring(0, lastSlash) : '';
            await saveProjectToCloud(parentPath, newFile.name, content, projectSessionId);
        }
        return { result: `Success. File ${targetPath} manifested.` };

    } else if (name === 'read_file') {
        const targetPath = args.path;
        const file = projectFilesRef.current.find(f => (f.path === targetPath || f.name === targetPath));
        if (file) return { result: file.content };
        return { result: `Error: File ${targetPath} not found in current workspace.` };
    }

    return { result: "Error: Unknown tool." };
  }, [activeSlots, focusedSlot, activeTab, currentUser, projectSessionId]);

  // GitHub Repo Parsing from User Profile
  useEffect(() => {
    if (userProfile?.defaultRepoUrl) {
      const url = userProfile.defaultRepoUrl;
      const parts = url.replace('https://github.com/', '').split('/');
      if (parts.length >= 2) {
        dispatchLog(`VFS SECTOR: Configuring GitHub Bridge [${parts[0]}/${parts[1]}]`, 'info', { category: 'VFS' });
        setProject(prev => ({
          ...prev,
          github: {
            owner: parts[0],
            repo: parts[1],
            branch: 'main',
            sha: ''
          }
        }));
      }
    }
  }, [userProfile?.defaultRepoUrl, dispatchLog]);

  // Sync with initial context
  useEffect(() => {
      if (initialFiles && initialFiles.length > 0) {
          dispatchLog(`VFS HYDRATION: Synchronizing Workspace with ${initialFiles.length} nodes.`, 'info', { category: 'VFS' });
          setProject(prev => ({ ...prev, files: initialFiles }));
          if (propActiveFilePath) {
              const file = initialFiles.find(f => f.path === propActiveFilePath);
              if (file) {
                  const newSlots = [...activeSlots];
                  newSlots[0] = file;
                  setActiveSlots(newSlots);
              }
          } else {
              const newSlots = [...activeSlots];
              newSlots[0] = initialFiles[0];
              setActiveSlots(newSlots);
          }
      }
  }, [initialFiles, propActiveFilePath, dispatchLog]);

  const refreshCloudPath = useCallback(async (path: string) => { 
    if (!currentUser) return; 
    try { 
        dispatchLog(`VFS REFRESH: Polling Cloud Registry Path [${path || 'root'}]`, 'info', { category: 'VFS' });
        const items = await listCloudDirectory(path, projectSessionId); 
        setCloudItems(prev => { 
            const map = new Map(prev.map(i => [i.fullPath, i])); 
            items.forEach(i => map.set(i.fullPath, i)); 
            return Array.from(map.values()); 
        }); 
    } catch(e: any) { 
        dispatchLog(`VFS FAULT: Cloud Sync Failed: ${e.message}`, 'error', { category: 'VFS' });
    } 
  }, [currentUser, projectSessionId, dispatchLog]);

  const handleCloudToggle = useCallback(async (node: TreeNode) => { 
    const nodeId = node.id as string;
    const isExpanded = expandedFolders[nodeId]; 
    setExpandedFolders(prev => ({ ...prev, [nodeId]: !isExpanded })); 
    if (!isExpanded) { 
        setLoadingFolders(prev => ({ ...prev, [nodeId]: true })); 
        try { 
            await refreshCloudPath(nodeId); 
        } catch(e) { console.error(e); } 
        finally { setLoadingFolders(prev => ({ ...prev, [nodeId]: false })); } 
    } 
  }, [expandedFolders, refreshCloudPath]);

  const handleDriveToggle = useCallback(async (node: TreeNode) => { 
    const driveFile = node.data as DriveFile; 
    const nodeId = node.id as string;
    const isExpanded = expandedFolders[nodeId]; 
    setExpandedFolders(prev => ({ ...prev, [nodeId]: !isExpanded })); 
    if (!isExpanded && driveToken && (!node.children || node.children.length === 0)) { 
        setLoadingFolders(prev => ({ ...prev, [nodeId]: true })); 
        try { 
            dispatchLog(`VAULT HANDSHAKE: Polling Google Drive Folder [${node.name}]`, 'info', { category: 'VFS' });
            const files = await listDriveFiles(driveToken!, driveFile.id); 
            setDriveItems(prev => { 
                const newItems = files.map(f => ({ ...f, parentId: nodeId, isLoaded: false })); 
                return Array.from(new Map([...prev, ...newItems].map(item => [item.id, item])).values()); 
            }); 
        } catch(e: any) { 
            dispatchLog(`VAULT FAULT: Drive Access Refused: ${e.message}`, 'error', { category: 'VFS' });
        } 
        finally { setLoadingFolders(prev => ({ ...prev, [nodeId]: false })); } 
    } 
  }, [expandedFolders, driveToken, dispatchLog]);

  const workspaceTree = useMemo(() => {
    return project.files.map(f => ({
      id: f.path || f.name,
      name: f.name,
      type: (f.isDirectory ? 'folder' : 'file') as 'file' | 'folder',
      data: f
    }));
  }, [project.files]);

  const cloudTree = useMemo(() => {
    const buildTree = (items: CloudItem[], parentPath: string = ''): TreeNode[] => {
      return items
        .filter(item => {
          const lastSlash = item.fullPath.lastIndexOf('/');
          const currentParent = lastSlash === -1 ? '' : item.fullPath.substring(0, lastSlash);
          return currentParent === parentPath;
        })
        .map(item => ({
          id: item.fullPath,
          name: item.name,
          type: (item.isFolder ? 'folder' : 'file') as 'file' | 'folder',
          data: item,
          children: item.isFolder ? buildTree(items, item.fullPath) : undefined
        }));
    };
    return buildTree(cloudItems);
  }, [cloudItems]);

  const driveTree = useMemo(() => {
    const buildTree = (items: (DriveFile & { parentId?: string })[], parentId?: string): TreeNode[] => {
      return items
        .filter(item => item.parentId === parentId)
        .map(item => ({
          id: item.id,
          name: item.name,
          type: (item.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file') as 'file' | 'folder',
          data: item,
          children: item.mimeType === 'application/vnd.google-apps.folder' ? buildTree(items, item.id) : undefined
        }));
    };
    return driveToken && driveRootId ? buildTree(driveItems, driveRootId) : [];
  }, [driveItems, driveToken, driveRootId]);

  const githubTree = useMemo(() => {
    return githubItems.map(f => ({
        id: f.path || f.name,
        name: (f.path || f.name).split('/').pop() || f.name,
        type: (f.isDirectory ? 'folder' : 'file') as 'file' | 'folder',
        data: f
    }));
  }, [githubItems]);

  const refreshExplorer = useCallback(async () => {
    if (activeTab === 'cloud') {
      await refreshCloudPath('');
    } else if (activeTab === 'drive' && driveToken && driveRootId) {
      const files = await listDriveFiles(driveToken!, driveRootId);
      setDriveItems([{ id: driveRootId, name: 'CodeStudio', mimeType: 'application/vnd.google-apps.folder', isLoaded: true }, ...files.map(f => ({ ...f, parentId: driveRootId, isLoaded: false }))]);
    } else if (activeTab === 'github' && project.github) {
      setLoadingFolders(prev => ({ ...prev, github_root: true }));
      try {
          dispatchLog(`VFS SYNC: Requesting GitHub Tree [${project.github.owner}/${project.github.repo}]`, 'info', { category: 'VFS' });
          const { files, latestSha } = await fetchRepoContents(githubToken, project.github.owner, project.github.repo, project.github.branch);
          setGithubItems(files);
          setProject(prev => ({ ...prev, github: { ...prev.github!, sha: latestSha } }));
          dispatchLog(`VFS SYNC SUCCESS: ${files.length} nodes resolved.`, 'success', { category: 'VFS' });
      } catch (e: any) {
          dispatchLog(`VFS SYNC FAULT: ${e.message}`, 'error', { category: 'VFS' });
      } finally {
          setLoadingFolders(prev => ({ ...prev, github_root: false }));
      }
    }
  }, [activeTab, driveToken, driveRootId, refreshCloudPath, githubToken, project.github, dispatchLog]);

  useEffect(() => {
    refreshExplorer();
  }, [currentUser, activeTab, refreshExplorer]);

  const handleRunSimulation = async () => {
    if (!activeFile || isExecuting) return;
    setIsTerminalOpen(true);
    setIsExecuting(true);
    setTerminalOutput(`[Neural Link] Initiating Heuristic Logic Trace for ${activeFile.name}...\n`);
    dispatchLog(`NEURAL CORE: Executing Trace Simulation [${activeFile.name}]`, 'info', { category: 'NEURAL_CORE' });

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const contextFiles = activeSlots.filter(f => f !== null && f.name !== activeFile.name).map(f => `File: ${f?.name}\nContent:\n${f?.content}`).join('\n\n');
        
        const systemPrompt = `You are a high-fidelity Heuristic Simulation Engine. Predict exact STDOUT/STDERR for the provided code in a virtual POSIX terminal.
        PROJECT CONTEXT:
        ${contextFiles}`;

        const startTime = Date.now();
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `EXECUTE CODE:\n\n${activeFile.content}`,
          config: {
              systemInstruction: systemPrompt,
              thinkingConfig: { thinkingBudget: 0 }
          }
        });

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        setTerminalOutput(prev => prev + (response.text || 'Process exited with no output.') + `\n\n[Refraction Complete in ${duration}s]`);
        
        dispatchLog(`NEURAL CORE SUCCESS: Trace complete.`, 'success', { 
            category: 'NEURAL_CORE', 
            latency: Number(duration) * 1000,
            inputTokens: response.usageMetadata?.promptTokenCount,
            outputTokens: response.usageMetadata?.candidatesTokenCount
        });
    } catch (e: any) {
        setTerminalOutput(prev => prev + `\n[CRITICAL FAULT] Simulation interrupted: ${e.message}`);
        dispatchLog(`NEURAL CORE FAULT: ${e.message}`, 'error', { category: 'NEURAL_CORE' });
    } finally {
        setIsExecuting(false);
    }
  };

  useEffect(() => {
    const handshakeId = sessionId || projectSessionId;
    if (handshakeId) {
        setIsSharedSession(true);
        setActiveTab('session');
        dispatchLog(`VFS HANDSHAKE: Establishing Persistent Session [${handshakeId}]`, 'info', { category: 'VFS' });
        const unsubscribe = subscribeToCodeProject(handshakeId, (remoteProject: any) => {
            setProject(prev => {
                const mergedFiles = [...prev.files];
                remoteProject.files.forEach((rf: any) => {
                    const idx = mergedFiles.findIndex(f => (f.path || f.name) === (rf.path || rf.name));
                    if (idx > -1) {
                        if (rf.content !== mergedFiles[idx].content) mergedFiles[idx] = rf;
                    } else {
                        mergedFiles.push(rf);
                    }
                });
                return { ...remoteProject, files: mergedFiles };
            });
            if (remoteProject.activeSlots && remoteProject.activeClientId !== clientId) setActiveSlots(remoteProject.activeSlots);
            if (remoteProject.layoutMode) setLayoutMode(remoteProject.layoutMode);
            if (remoteProject.cursors) setActiveClients(remoteProject.cursors);
            if (remoteProject.activeFilePath && remoteProject.activeClientId !== clientId) {
                const remoteFile = remoteProject.files.find((f: any) => (f.path || f.name) === remoteProject.activeFilePath);
                if (remoteFile && (!activeFile || (activeFile.path || activeFile.name) !== remoteProject.activeFilePath)) {
                    updateSlotFile(remoteFile, 0);
                }
            }
        });
        return () => unsubscribe();
    }
  }, [sessionId, projectSessionId, clientId, dispatchLog, activeFile]);

  const handleShare = async (uids: string[], isPublic: boolean) => {
      let sid = sessionId || projectSessionId;
      let token = writeToken;
      dispatchLog(`VFS CONTROL: Updating Workspace Access [${isPublic ? 'PUBLIC' : 'RESTRICTED'}]`, 'info', { category: 'VFS' });
      if (!sid) {
          sid = projectSessionId;
          token = generateSecureId();
          setWriteToken(token);
          const newProject: CodeProject = { ...project, id: sid, ownerId: currentUser?.uid, accessLevel: isPublic ? 'public' : 'restricted', allowedUserIds: uids, activeSlots: activeSlots, layoutMode: layoutMode, activeClientId: clientId };
          await saveCodeProject(newProject);
          onSessionStart(sid);
      } else {
          await updateProjectAccess(sid, isPublic ? 'public' : 'restricted', uids);
          await saveCodeProject({ ...project, activeSlots: activeSlots, layoutMode: layoutMode, activeClientId: clientId });
      }
      if (uids.length > 0) {
          const shareUrl = new URL(window.location.href);
          shareUrl.searchParams.set('session', sid);
          shareUrl.searchParams.set('key', token || '');
          uids.forEach(uid => sendShareNotification([uid], 'Code Studio', shareUrl.toString(), currentUser?.displayName || 'A member'));
      }
      setIsSharedSession(true);
  };

  const handleStopSession = () => { if (sessionId) onSessionStop(sessionId); setIsSharedSession(false); setIsReadOnly(false); setWriteToken(undefined); };
  const handleSetLayout = (mode: LayoutMode) => {
      setLayoutMode(mode);
      if (mode === 'single' && focusedSlot !== 0) setFocusedSlot(0);
      if (isSharedSession && sessionId) saveCodeProject({ ...project, layoutMode: mode, activeClientId: clientId });
  };

  const handleSmartSave = async (targetFileOverride?: CodeFile) => {
    const fileToSave = targetFileOverride || activeFile;
    if (!fileToSave || (!fileToSave.isModified && saveStatus === 'saved')) return;
    setSaveStatus('saving');
    dispatchLog(`VAULT SYNC: Committing [${fileToSave.name}] to Registry`, 'info', { category: 'VFS' });
    try {
        if (activeTab === 'cloud' && currentUser) {
             const lastSlash = (fileToSave.path || fileToSave.name).lastIndexOf('/');
             const parentPath = lastSlash > -1 ? (fileToSave.path || fileToSave.name).substring(0, lastSlash) : '';
             await saveProjectToCloud(parentPath, fileToSave.name, fileToSave.content, projectSessionId);
             await refreshCloudPath(parentPath);
        } else if (activeTab === 'drive' && driveToken && driveRootId) {
             await saveToDrive(driveToken!, driveRootId, fileToSave.name, fileToSave.content);
        } else if (isSharedSession && (sessionId || projectSessionId)) {
             await updateCodeFile(sessionId || projectSessionId, fileToSave);
        }
        setSaveStatus('saved');
        dispatchLog(`VAULT SYNC SUCCESS: Node persistent.`, 'success', { category: 'VFS' });
    } catch(e: any) { 
        setSaveStatus('modified'); 
        dispatchLog(`VAULT SYNC FAULT: ${e.message}`, 'error', { category: 'VFS' });
    }
  };

  const handleFormatCode = async (slotIdx: number) => {
      const file = activeSlots[slotIdx];
      if (!file || isFormattingSlots[slotIdx]) return;
      setIsFormattingSlots(prev => ({ ...prev, [slotIdx]: true }));
      dispatchLog(`NEURAL CORE: Refracting Source Layout [${file.name}]`, 'info', { category: 'NEURAL_CORE' });
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const prompt = `expert code formatter. Reformat the following ${file.language} code. respond ONLY with code.`;
          const resp = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt + "\nCODE:\n" + file.content });
          const formatted = resp.text?.trim() || file.content;
          handleCodeChangeInSlot(formatted, slotIdx);
          dispatchLog(`NEURAL CORE SUCCESS: Formatting finalized.`, 'success', { 
              category: 'NEURAL_CORE',
              inputTokens: resp.usageMetadata?.promptTokenCount,
              outputTokens: resp.usageMetadata?.candidatesTokenCount
          });
      } catch (e: any) { 
          dispatchLog(`NEURAL CORE REFUSED: ${e.message}`, 'error', { category: 'NEURAL_CORE' });
          console.error("Formatting failed", e); 
      } finally { setIsFormattingSlots(prev => ({ ...prev, [slotIdx]: false })); }
  };

  const updateSlotFile = async (file: CodeFile | null, slotIndex: number) => {
      const newSlots = [...activeSlots];
      newSlots[slotIndex] = file;
      setActiveSlots(newSlots);
      if (file && isPreviewable(file.name)) {
          const defaultMode = getLanguageFromExt(file.name) === 'whiteboard' ? 'preview' : 'code';
          setSlotViewModes(prev => ({ ...prev, [slotIndex]: defaultMode }));
      }
      if (isSharedSession && (sessionId || projectSessionId)) {
          if (file) updateProjectActiveFile(sessionId || projectSessionId, file.path || file.name);
          saveCodeProject({ ...project, activeSlots: newSlots, activeClientId: clientId });
          if (file) await updateCodeFile(sessionId || projectSessionId, file);
      }
      if (file && onActiveFileChange) {
          onActiveFileChange(file.path || file.name);
      }
  };

  const isPreviewable = (filename: string) => ['md', 'puml', 'plantuml', 'wb', 'whiteboard'].includes(filename.split('.').pop()?.toLowerCase() || '');
  const toggleSlotViewMode = (idx: number) => setSlotViewModes(prev => ({ ...prev, [idx]: prev[idx] === 'preview' ? 'code' : 'preview' }));

  const handleExplorerSelect = async (node: TreeNode) => {
      if (node.type === 'file') {
          let fileData: CodeFile | null = null;
          dispatchLog(`VFS: Requesting logic node [${node.name}]`, 'info', { category: 'VFS' });
          if (activeTab === 'cloud') {
                const item = node.data as CloudItem;
                try {
                    const text = await getCloudFileContent(item.fullPath, projectSessionId);
                    fileData = { name: item.name, path: item.fullPath, content: text, language: getLanguageFromExt(item.name), loaded: true, isDirectory: false, isModified: false };
                } catch(e: any) { console.error(e); }
          } else if (activeTab === 'drive') {
                const driveFile = node.data as DriveFile;
                if (driveToken) { 
                    const text = await readDriveFile(driveToken as string, driveFile.id as string); 
                    fileData = { name: driveFile.name, path: `drive://${driveFile.id}`, content: text, language: getLanguageFromExt(driveFile.name), loaded: true, isDirectory: false, isModified: false }; 
                }
          } else if (activeTab === 'github') {
                const file = node.data as CodeFile;
                const gh = project.github;
                if (!file.loaded && gh) { 
                    const content = await fetchFileContent(githubToken, gh.owner, gh.repo, file.path || file.name, gh.branch); 
                    fileData = { ...file, content, loaded: true }; 
                } else { fileData = file; }
          } else fileData = node.data as CodeFile;
          
          if (fileData) {
            setProject(prev => {
                const existing = prev.files.findIndex(f => (f.path || f.name) === (fileData!.path || fileData!.name));
                if (existing > -1) {
                    const nextFiles = [...prev.files];
                    nextFiles[existing] = fileData!;
                    return { ...prev, files: nextFiles };
                }
                return { ...prev, files: [...prev.files, fileData!] };
            });
            updateSlotFile(fileData, focusedSlot);
          }
      } else {
          if (activeTab === 'cloud') handleCloudToggle(node);
          else if (activeTab === 'drive') handleDriveToggle(node);
          else setExpandedFolders(prev => ({...prev, [node.id]: !expandedFolders[node.id]}));
      }
  };

  const handleCodeChangeInSlot = (newCode: string, slotIdx: number) => {
      const file = activeSlots[slotIdx];
      if (!file) return;
      const updatedFile = { ...file, content: newCode, isModified: true };
      const newSlots = [...activeSlots];
      newSlots[slotIdx] = updatedFile;
      setActiveSlots(newSlots);
      setProject(prev => ({ ...prev, files: prev.files.map(f => (f.path || f.name) === (file.path || f.name) ? updatedFile : f) }));
      setSaveStatus('modified');
      if (isSharedSession && (sessionId || projectSessionId)) updateCodeFile(sessionId || projectSessionId, updatedFile);
      if (onFileChange) onFileChange(updatedFile);
  };

  const resize = useCallback((e: MouseEvent) => {
    if (isDraggingLeft) { const newWidth = e.clientX; if (newWidth > 160 && newWidth < 500) setLeftWidth(newWidth); }
    if (isDraggingRight) { const newWidth = window.innerWidth - e.clientX; if (newWidth > 160 && newWidth < 500) setRightWidth(newWidth); }
    if (isDraggingTerminal) { const newHeight = window.innerHeight - e.clientY; if (newHeight > 100 && newHeight < 600) setTerminalHeight(newHeight); }
    if (isDraggingInner && centerContainerRef.current) {
        const rect = centerContainerRef.current.getBoundingClientRect();
        if (layoutMode === 'split-v') {
            const newRatio = ((e.clientX - rect.left) / rect.width) * 100;
            if (newRatio > 10 && newRatio < 90) setInnerSplitRatio(newRatio);
        } else if (layoutMode === 'split-h') {
            const newRatio = ((e.clientY - rect.top) / rect.height) * 100;
            if (newRatio > 10 && newRatio < 90) setInnerSplitRatio(newRatio);
        }
    }
  }, [isDraggingLeft, isDraggingRight, isDraggingTerminal, isDraggingInner, layoutMode]);

  useEffect(() => {
      if (isDraggingLeft || isDraggingRight || isDraggingTerminal || isDraggingInner) {
          window.addEventListener('mousemove', resize);
          const stop = () => { setIsDraggingLeft(false); setIsDraggingRight(false); setIsDraggingTerminal(false); setIsDraggingInner(false); };
          window.addEventListener('mouseup', stop);
          return () => { window.removeEventListener('mousemove', resize); window.removeEventListener('mouseup', stop); };
      }
  }, [isDraggingLeft, isDraggingRight, isDraggingTerminal, isDraggingInner, resize]);

  const handleSendMessage = async (input: string) => {
      if (!input.trim()) return;
      setChatMessages(prev => [...prev, { role: 'user', text: input }]);
      setIsChatThinking(true);
      dispatchLog(`NEURAL CORE: Dispatching user handshake to Gemini 3 Pro`, 'info', { category: 'NEURAL_CORE', model: 'gemini-3-pro-preview' });
      
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          if (!chatRef.current) {
              const systemPrompt = `You are a Senior Code Partner. Use 'update_active_file' for modifications to focused slot or 'write_file' to manage workspace paths. Use 'read_file' to examine existing code. PRIORITIZE tool usage over text descriptions. All code edits are manifested instantly.`;
              chatRef.current = ai.chats.create({
                model: 'gemini-3-pro-preview',
                config: { systemInstruction: systemPrompt, tools: codeTools }
              });
          }

          const contextInjectedPrompt = `[FOCUSED_FILE]: ${activeFile?.name}\n[CONTENT]:\n${activeFile?.content || 'Empty'}\n\nUSER: ${input}`;
          const startTime = Date.now();
          const resp = await chatRef.current.sendMessage({ message: contextInjectedPrompt });
          const latency = Date.now() - startTime;
          
          if (resp.functionCalls) {
              for (const fc of resp.functionCalls) {
                  const res = await processAiToolCall(fc.name, fc.args);
                  setChatMessages(prev => [...prev, { role: 'ai', text: `✨ **Handshake Complete**: ${res.result}` }]);
              }
          } else {
              setChatMessages(prev => [...prev, { role: 'ai', text: resp.text || "Handshake verified." }]);
          }

          dispatchLog(`NEURAL CORE SUCCESS: Handshake finalized.`, 'success', { 
              category: 'NEURAL_CORE',
              latency,
              inputTokens: resp.usageMetadata?.promptTokenCount,
              outputTokens: resp.usageMetadata?.candidatesTokenCount
          });
      } catch (e: any) { 
          setChatMessages(prev => [...prev, { role: 'ai', text: `Fault: ${e.message}` }]); 
          dispatchLog(`NEURAL CORE REFUSED: ${e.message}`, 'error', { category: 'NEURAL_CORE' });
          chatRef.current = null; 
      } finally { setIsChatThinking(false); }
  };

  const handleToggleLivePartner = async (reconnect = false) => {
    if (isLiveActive && !reconnect) { 
        dispatchLog(`LIVE API: Disconnecting Voice Link.`, 'info', { category: 'LIVE_API' });
        liveServiceRef.current?.disconnect(); 
        setIsLiveActive(false); 
        setIsAiConnected(false); 
        setIsRecovering(false);
        autoReconnectAttempts.current = 0;
        return; 
    }

    if (reconnect) {
        setIsRecovering(true);
        dispatchLog(`LIVE API: Protocol 1006 trapped. Re-establishing link (Attempt ${autoReconnectAttempts.current + 1})...`, 'warn', { category: 'LIVE_API' });
    } else {
        dispatchLog(`LIVE API: Initiating Neural Voice Link Handshake...`, 'info', { category: 'LIVE_API' });
    }

    const service = new GeminiLiveService();
    liveServiceRef.current = service;
    const sysPrompt = `Senior Code Partner. Resilient interaction. use 'write_file', 'read_file' or 'update_active_file' for all code changes. FOCUSED: ${activeFile?.name}. All VFS tool results are synced to the user screen. If this is a reconnection, acknowledge and continue the current context.`;

    try {
        await service.connect('Zephyr', sysPrompt, {
            onOpen: () => { 
                setIsLiveActive(true); 
                setIsAiConnected(true); 
                setIsRecovering(false);
                autoReconnectAttempts.current = 0;
                dispatchLog(`LIVE API: Voice Link Established.`, 'success', { category: 'LIVE_API' });
                if (reconnect) {
                    service.sendText("[RECONNECTION_PROTOCOL_ACTIVE] Neural link recovered. Continuing session.");
                }
            },
            onClose: (reason, code) => { 
                setIsAiConnected(false); 
                if (code === 1006 || code === 1001) {
                    if (autoReconnectAttempts.current < maxAutoRetries) {
                        autoReconnectAttempts.current++;
                        setIsRecovering(true);
                        // Calculate exponential backoff delay capped at 10s
                        const delay = Math.min(1500 * Math.pow(1.1, autoReconnectAttempts.current), 10000);
                        dispatchLog(`Network Jitter detected. Scheduling reconnection in ${Math.round(delay/1000)}s...`, 'warn');
                        setTimeout(() => handleToggleLivePartner(true), delay);
                        return;
                    }
                }
                setIsLiveActive(false); 
                setIsRecovering(false);
                dispatchLog(`LIVE API: Voice Link Closed.`, 'warn', { category: 'LIVE_API', meta: { reason, code } });
            },
            onError: (err) => { 
                setIsAiConnected(false); 
                if (autoReconnectAttempts.current < maxAutoRetries) {
                    autoReconnectAttempts.current++;
                    setIsRecovering(true);
                    const delay = Math.min(2000 * Math.pow(1.1, autoReconnectAttempts.current), 12000);
                    setTimeout(() => handleToggleLivePartner(true), delay);
                    return;
                }
                setIsLiveActive(false); 
                setIsRecovering(false);
                dispatchLog(`LIVE API: Critical Fault: ${err}`, 'error', { category: 'LIVE_API' });
            },
            onVolumeUpdate: (v) => setVolume(v),
            onTranscript: (text, isUser) => {
                const role = isUser ? 'user' : 'ai';
                setChatMessages(prev => {
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg && lastMsg.role === role) {
                        // Use refined transcript joiner to fix word fragments and extra spaces
                        const newText = refineTranscriptText(lastMsg.text + ' ' + text);
                        return [...prev.slice(0, -1), { role, text: newText }];
                    }
                    return [...prev, { role, text: refineTranscriptText(text) }];
                });
            },
            onToolCall: async (toolCall) => {
                for (const fc of toolCall.functionCalls) {
                    const res = await processAiToolCall(fc.name, fc.args);
                    service.sendToolResponse({ id: fc.id, name: fc.name, response: res });
                    setChatMessages(prev => [...prev, { role: 'ai', text: `✨ **Voice Sync**: ${res.result}` }]);
                }
            }
        }, codeTools);
    } catch (e: any) { 
        if (!reconnect) {
            setIsLiveActive(false); 
            setIsRecovering(false);
            dispatchLog(`LIVE API: Handshake Failed: ${e.message}`, 'error', { category: 'LIVE_API' });
        } else if (autoReconnectAttempts.current < maxAutoRetries) {
            autoReconnectAttempts.current++;
            setTimeout(() => handleToggleLivePartner(true), 3000);
        }
    }
  };

  const handleConnectDrive = async () => { 
      try { 
          dispatchLog(`VAULT: Requesting Google Drive Access Scopes...`, 'info', { category: 'VFS' });
          const token = await connectDrive(); 
          setDriveToken(token); 
          const rootId = await ensureCodeStudioFolder(token); 
          setDriveRootId(rootId); 
          const files = await listDriveFiles(token, rootId); 
          setDriveItems([{ id: driveRootId, name: 'CodeStudio', mimeType: 'application/vnd.google-apps.folder', isLoaded: true }, ...files.map(f => ({ ...f, parentId: driveRootId, isLoaded: false }))]); 
          setActiveTab('drive'); 
          dispatchLog(`VAULT SUCCESS: Drive Connected. Root [${rootId}]`, 'success', { category: 'VFS' });
      } catch(e: any) { 
          dispatchLog(`VAULT FAULT: Drive Handshake Refused: ${e.message}`, 'error', { category: 'VFS' });
          console.error(e); 
      } 
  };

  const renderSlot = (idx: number) => {
      const file = activeSlots[idx];
      const isFocused = focusedSlot === idx;
      const viewMode = slotViewModes[idx] || 'code';
      const isFormatting = isFormattingSlots[idx];
      const isVisible = layoutMode === 'single' ? idx === 0 : (layoutMode === 'quad' ? true : idx < 2);
      if (!isVisible) return null;
      
      const isWhiteboard = file && getLanguageFromExt(file.name) === 'whiteboard';
      const slotStyle: React.CSSProperties = {};
      if (layoutMode === 'split-v' || layoutMode === 'split-h') {
          const size = idx === 0 ? `${innerSplitRatio}%` : `${100 - innerSplitRatio}%`;
          if (layoutMode === 'split-v') slotStyle.width = size; else slotStyle.height = size;
          slotStyle.flex = 'none';
      }

      return (
          <div key={idx} onClick={() => setFocusedSlot(idx)} style={slotStyle} className={`flex flex-col min-w-0 border ${isFocused ? 'border-indigo-500 z-10 shadow-[inset_0_0_10px_rgba(79,70,229,0.1)]' : 'border-slate-800'} relative transition-all overflow-hidden bg-slate-950 flex-1`} >
              {file ? (
                  <>
                    <div className={`px-4 py-2 flex items-center justify-between shrink-0 border-b ${isFocused ? 'bg-indigo-900/20 border-indigo-500/30' : 'bg-slate-900 border-slate-800'}`}>
                        <div className="flex items-center gap-2 overflow-hidden">
                            <FileIcon filename={file.name} />
                            <span className={`text-xs font-bold truncate ${isFocused ? 'text-indigo-200' : 'text-slate-400'}`}>{file.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            {viewMode === 'code' && !['whiteboard', 'markdown', 'plantuml'].includes(getLanguageFromExt(file.name)) && (
                                <button onClick={(e) => { e.stopPropagation(); handleFormatCode(idx); }} disabled={isFormatting} className={`p-1.5 rounded transition-colors ${isFormatting ? 'text-indigo-400' : 'text-slate-500 hover:text-indigo-400'}`} title="Auto-Format (AI)"><Wand2 size={14} className={isFormatting ? 'animate-spin' : ''}/></button>
                            )}
                            {isPreviewable(file.name) && (
                                <button onClick={(e) => { e.stopPropagation(); toggleSlotViewMode(idx); }} className={`p-1.5 rounded transition-colors ${viewMode === 'preview' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'}`} title={viewMode === 'preview' ? 'Show Code' : (isWhiteboard ? 'Show Visual Canvas' : 'Show Preview')}><Eye size={14}/></button>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); updateSlotFile(null, idx); }} className="p-1.5 hover:bg-slate-800 rounded text-slate-500 hover:text-white transition-colors"><X size={14}/></button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-hidden relative">
                        {isWhiteboard ? (
                            viewMode === 'preview' ? (
                                <Whiteboard key={file.path} initialContent={file.content} onChange={(code) => handleCodeChangeInSlot(code, idx)} />
                            ) : (
                                <Editor height="100%" theme="vs-dark" language="json" value={file.content} onChange={(val) => handleCodeChangeInSlot(val || '', idx)} options={{ fontSize, fontFamily: 'JetBrains Mono', minimap: { enabled: false }, scrollBeyondLastLine: false, automaticLayout: true, tabSize: 4, readOnly: isReadOnly }} />
                            )
                        ) : viewMode === 'preview' ? (
                            <div className="h-full overflow-y-auto p-8 bg-slate-950 text-slate-300 selection:bg-indigo-500/30">
                                <MarkdownView content={file.name.endsWith('.puml') || file.name.endsWith('.plantuml') ? `\`\`\`plantuml\n${file.content}\n\`\`\`` : file.content} />
                            </div>
                        ) : (
                            <Editor height="100%" theme="vs-dark" language={getLanguageFromExt(file.name)} value={file.content} onChange={(val) => handleCodeChangeInSlot(val || '', idx)} options={{ fontSize, fontFamily: 'JetBrains Mono', minimap: { enabled: false }, scrollBeyondLastLine: false, automaticLayout: true, tabSize: 4, readOnly: isReadOnly }} />
                        )}
                        {isFocused && isTerminalOpen && (
                            <div style={{ height: `${terminalHeight}px` }} className="absolute bottom-0 left-0 right-0 bg-slate-950 border-t border-indigo-500/50 flex flex-col z-20 shadow-2xl animate-fade-in-up">
                                <div onMouseDown={() => setIsDraggingTerminal(true)} className="h-1 bg-indigo-500/30 hover:bg-indigo-500 cursor-row-resize transition-colors"></div>
                                <div className="h-8 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0">
                                    <div className="flex items-center gap-2">
                                        <Terminal size={12} className="text-emerald-400" />
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Heuristic Terminal</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <button onClick={() => setTerminalOutput('')} className="text-[9px] font-bold text-slate-500 hover:text-white uppercase">Clear</button>
                                        <button onClick={() => setIsTerminalOpen(false)} className="text-slate-500 hover:text-white"><X size={14}/></button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-auto p-4 font-mono text-xs text-emerald-400/90 whitespace-pre-wrap leading-relaxed">
                                    {terminalOutput}
                                    {isExecuting && <span className="inline-block w-2 h-4 bg-emerald-500 ml-1 animate-pulse align-middle"></span>}
                                    {!terminalOutput && !isExecuting && <span className="text-slate-700">Awaiting execution...</span>}
                                </div>
                            </div>
                        )}
                    </div>
                  </>
              ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-700 bg-slate-950/50 border-2 border-dashed border-slate-800 m-4 rounded-xl group cursor-pointer hover:border-slate-600 transition-colors">
                      <Plus size={32} className="opacity-20 group-hover:opacity-40 transition-opacity mb-2" />
                      <p className="text-xs font-bold uppercase tracking-widest">Pane {idx + 1}</p>
                      <p className="text-[10px] opacity-50 mt-1">Select from Explorer</p>
                  </div>
              )}
              {isFocused && <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>}
          </div>
      );
  };

  const getShareLink = () => { const url = new URL(window.location.href); if (sessionId || projectSessionId) url.searchParams.set('session', sessionId || projectSessionId); if (writeToken) url.searchParams.set('key', writeToken); url.searchParams.delete('view'); url.searchParams.delete('id'); return url.toString(); };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans relative">
      <header className="h-14 bg-slate-950 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-4 shrink-0 z-20 shadow-lg">
         <div className="flex items-center space-x-4">
            <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"><ArrowLeft size={20} /></button>
            <button onClick={() => setIsLeftOpen(!isLeftOpen)} className={`p-2 rounded-lg transition-colors ${isLeftOpen ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`} title={isLeftOpen ? "Hide Explorer" : "Show Explorer"}>{isLeftOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}</button>
            <div className="flex flex-col">
                <h1 className="font-bold text-white text-sm flex items-center gap-2"><Code className="text-indigo-400" size={18}/> {project.name}</h1>
                <p className="text-[8px] text-slate-500 font-mono">UUID: {projectSessionId.substring(0, 16)}...</p>
            </div>
            {isSharedSession && <div className="flex items-center gap-2 px-3 py-1 bg-indigo-900/40 rounded-full border border-indigo-500/30"><div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></div><span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Live Session</span></div>}
         </div>
         <div className="flex items-center space-x-2">
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 mr-4">
                <button onClick={() => handleSetLayout('single')} className={`p-1.5 rounded transition-colors ${layoutMode === 'single' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`} title="Single Frame"><SquareIcon size={16}/></button>
                <button onClick={() => handleSetLayout('split-v')} className={`p-1.5 rounded transition-colors ${layoutMode === 'split-v' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`} title="Vertical Split"><Columns size={16}/></button>
                <button onClick={() => handleSetLayout('split-h')} className={`p-1.5 rounded transition-colors ${layoutMode === 'split-h' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`} title="Horizontal Split"><Rows size={16}/></button>
                <button onClick={() => handleSetLayout('quad')} className={`p-1.5 rounded transition-colors ${layoutMode === 'quad' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`} title="4 Frame Mode"><Grid2X2 size={16}/></button>
            </div>
            <button onClick={() => { navigator.clipboard.writeText(getShareLink()); alert("Read-only URI copied to clipboard!"); }} className="flex items-center gap-2 px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold border border-slate-700 transition-all mr-2" > <Share2 size={14}/> <span>Share Workspace</span> </button>
            <button onClick={handleRunSimulation} disabled={isExecuting || !activeFile} className={`flex items-center gap-2 px-5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-black uppercase shadow-lg transition-all active:scale-95 disabled:opacity-30 mr-2`}> {isExecuting ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} fill="currentColor"/>} <span>Run Simulation</span> </button>
            <button onClick={() => handleSmartSave()} className="flex items-center space-x-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-md mr-2"><Save size={14}/><span>Save</span></button>
            <button onClick={() => setIsRightOpen(!isRightOpen)} className={`p-2 rounded-lg transition-colors ${isRightOpen ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`} title={isRightOpen ? "Hide AI Assistant" : "Show AI Assistant"}>{isRightOpen ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}</button>
         </div>
      </header>
      <div className="flex-1 flex overflow-hidden relative">
          <div className={`${isZenMode ? 'hidden' : (isLeftOpen ? '' : 'hidden')} bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 overflow-hidden`} style={{ width: `${leftWidth}px` }}>
              <div className="flex border-b border-slate-800 bg-slate-900">
                  <button onClick={() => setActiveTab('cloud')} className={`flex-1 py-3 flex justify-center border-b-2 transition-colors ${activeTab === 'cloud' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}><Cloud size={16}/></button>
                  <button onClick={() => setActiveTab('drive')} className={`flex-1 py-3 flex justify-center border-b-2 transition-colors ${activeTab === 'drive' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}><HardDrive size={16}/></button>
                  <button onClick={() => setActiveTab('github')} className={`flex-1 py-3 flex justify-center border-b-2 transition-colors ${activeTab === 'github' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}><Github size={16}/></button>
                  <button onClick={() => setActiveTab('session')} className={`flex-1 py-3 flex justify-center border-b-2 transition-colors ${activeTab === 'session' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}><Users size={16}/></button>
              </div>
              <div className="p-3 border-b border-slate-800 flex wrap gap-2 bg-slate-900 justify-center">
                  <button onClick={async () => { const name = prompt("File Name:"); if(name) { const newFile = { name, path: name, language: getLanguageFromExt(name), content: "// Start coding...", loaded: true, isModified: true }; updateSlotFile(newFile, focusedSlot); } }} className="flex-1 flex items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white py-1.5 px-2 rounded text-xs font-bold transition-colors"><FileCode size={14}/> <span>New File</span></button>
                  <button onClick={refreshExplorer} className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"><RefreshCw size={16} className={Object.values(loadingFolders).some(v => v) ? 'animate-spin' : ''}/></button>
              </div>
              <div className="flex-1 overflow-y-auto">
                  {(activeTab === 'cloud' || activeTab === 'session') && (activeTab === 'session' ? workspaceTree : cloudTree).map(node => <FileTreeItem key={node.id} node={node} depth={0} activeId={activeFile?.path || activeFile?.name} onSelect={handleExplorerSelect} onToggle={handleCloudToggle} expandedIds={expandedFolders} loadingIds={loadingFolders} />)}
                  {activeTab === 'drive' && (driveToken ? driveTree.map(node => <FileTreeItem key={node.id} node={node} depth={0} activeId={activeFile?.path || activeFile?.name} onSelect={handleExplorerSelect} onToggle={handleDriveToggle} expandedIds={expandedFolders} loadingIds={loadingFolders} />) : <div className="p-4 text-center"><button onClick={handleConnectDrive} className="px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-lg border border-slate-700 hover:bg-slate-700">Connect Drive</button></div>)}
                  {activeTab === 'github' && (
                    <div className="p-2">
                        {project.github ? (
                            githubItems.length > 0 ? (
                                githubTree.map(node => <FileTreeItem key={node.id} node={node} depth={0} activeId={activeFile?.path || activeFile?.name} onSelect={handleExplorerSelect} onToggle={() => {}} expandedIds={expandedFolders} loadingIds={loadingFolders} />)
                            ) : (
                                <div className="p-4 text-center"><button onClick={refreshExplorer} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase rounded-lg shadow-lg">Load Root Manifest</button></div>
                            )
                        ) : (
                            <div className="p-6 text-center space-y-4"><div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700"><ShieldAlert size={24} className="mx-auto text-amber-500 mb-2"/><p className="text-[10px] text-slate-400 leading-relaxed uppercase font-black">No default repository detected in your profile settings.</p></div></div>
                        )}
                    </div>
                  )}
              </div>
          </div>
          <div onMouseDown={() => setIsDraggingLeft(true)} className="w-1 cursor-col-resize hover:bg-indigo-500/50 transition-colors z-30 shrink-0 bg-slate-800/20 group relative"><div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 bg-indigo-500 p-0.5 rounded-full pointer-events-none"><GripVertical size={10}/></div></div>
          <div ref={centerContainerRef} className={`flex-1 bg-slate-950 flex min-w-0 relative ${layoutMode === 'quad' ? 'grid grid-cols-2 grid-rows-2' : layoutMode === 'split-v' ? 'flex-row' : layoutMode === 'split-h' ? 'flex-col' : 'flex-col'}`}>
              {layoutMode === 'single' && renderSlot(0)}
              {layoutMode === 'split-v' && (
                  <> {renderSlot(0)} <div onMouseDown={() => setIsDraggingInner(true)} className="w-1.5 cursor-col-resize hover:bg-indigo-500/50 transition-colors z-40 bg-slate-800 group relative flex-shrink-0"><div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 bg-indigo-500 p-1 rounded-full pointer-events-none"><GripVertical size={12}/></div></div> {renderSlot(1)} </>
              )}
              {layoutMode === 'split-h' && (
                  <> {renderSlot(0)} <div onMouseDown={() => setIsDraggingInner(true)} className="h-1.5 cursor-row-resize hover:bg-indigo-500/50 transition-colors z-40 bg-slate-800 group relative flex-shrink-0"><div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 bg-indigo-500 p-1 rounded-full pointer-events-none"><GripHorizontal size={12}/></div></div> {renderSlot(1)} </>
              )}
              {layoutMode === 'quad' && [0,1,2,3].map(i => renderSlot(i))}
          </div>
          <div onMouseDown={() => setIsDraggingRight(true)} className="w-1 cursor-col-resize hover:bg-indigo-500/50 transition-colors z-30 shrink-0 bg-slate-800/20 group relative"><div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 bg-indigo-500 p-0.5 rounded-full pointer-events-none"><GripVertical size={10}/></div></div>
          <div className={`${isZenMode ? 'hidden' : (isRightOpen ? '' : 'hidden')} bg-slate-950 flex flex-col shrink-0 overflow-hidden shadow-2xl`} style={{ width: `${rightWidth}px` }}>
              <AIChatPanel messages={chatMessages} onSendMessage={handleSendMessage} isThinking={isChatThinking} isLiveActive={isLiveActive} onToggleLive={() => handleToggleLivePartner()} liveVolume={liveVolume} onClose={() => setIsRightOpen(false)} isRecovering={isRecovering} />
          </div>
      </div>
      <ShareModal isOpen={showShareModal} onClose={() => setShowShareModal(false)} onShare={handleShare} link={getShareLink()} title={project.name} currentAccess={project.accessLevel} currentAllowedUsers={project.allowedUserIds} currentUserUid={currentUser?.uid} />
    </div>
  );
};

export default CodeStudio;
