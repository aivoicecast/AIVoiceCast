
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { CodeProject, CodeFile, UserProfile, Channel, CursorPosition, CloudItem } from '../types';
import { ArrowLeft, Save, Plus, Github, Cloud, HardDrive, Code, X, ChevronRight, ChevronDown, File, Folder, DownloadCloud, Loader2, CheckCircle, AlertTriangle, Info, FolderPlus, FileCode, RefreshCw, LogIn, CloudUpload, Trash2, ArrowUp, Edit2, FolderOpen, MoreVertical, Send, MessageSquare, Bot, Mic, Sparkles, SidebarClose, SidebarOpen, Users, Eye, FileText as FileTextIcon, Image as ImageIcon, StopCircle, Minus, Maximize2, Minimize2, Lock, Unlock, Share2, Terminal, Copy, WifiOff, PanelRightClose, PanelRightOpen, PanelLeftClose, PanelLeftOpen, Monitor, Laptop, PenTool, Edit3, ShieldAlert, ZoomIn, ZoomOut, Columns, Rows, Grid2X2, Square as SquareIcon, GripVertical, GripHorizontal, FileSearch, Indent, Wand2, Check } from 'lucide-react';
import { listCloudDirectory, saveProjectToCloud, deleteCloudItem, createCloudFolder, subscribeToCodeProject, saveCodeProject, updateCodeFile, updateCursor, claimCodeProjectLock, updateProjectActiveFile, deleteCodeFile, moveCloudFile, updateProjectAccess, sendShareNotification, deleteCloudFolderRecursive } from '../services/firestoreService';
import { ensureCodeStudioFolder, listDriveFiles, readDriveFile, saveToDrive, deleteDriveFile, createDriveFolder, DriveFile, moveDriveFile } from '../services/googleDriveService';
import { connectGoogleDrive, signInWithGitHub } from '../services/authService';
import { fetchRepoInfo, fetchRepoContents, fetchFileContent, updateRepoFile, deleteRepoFile, renameRepoFile } from '../services/githubService';
import { MarkdownView } from './MarkdownView';
import { encodePlantUML } from '../utils/plantuml';
import { Whiteboard } from './Whiteboard';
import { GoogleGenAI, FunctionDeclaration, Type } from '@google/genai';
import { ShareModal } from './ShareModal';

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
  onSessionStop: () => void;
  onStartLiveSession: (channel: Channel, context?: string) => void;
}

const PRESET_REPOS = [
  { label: 'React (Facebook)', path: 'facebook/react' },
  { label: 'Vue (Evan You)', path: 'vuejs/core' },
  { label: 'VS Code', path: 'microsoft/vscode' },
  { label: 'Linux', path: 'torvalds/linux' },
  { label: 'Python', path: 'python/cpython' }
];

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
    if (['puml', 'plantuml'].includes(ext || '')) return 'plantuml';
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
                className={`flex items-center gap-1 py-1 px-2 cursor-pointer select-none hover:bg-slate-800/50 group ${isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'}`}
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
                            onSelect={onSelect} 
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

            // Sync the cursor position after the DOM update
            requestAnimationFrame(() => {
                target.selectionStart = target.selectionEnd = start + tabStr.length;
            });
        }
    };

    const editorStyles = { 
        fontSize: `${fontSize}px`, 
        lineHeight: '1.6', 
        tabSize: 4, 
        MozTabSize: 4 
    } as React.CSSProperties;

    return (
        <div className="w-full h-full flex bg-slate-950 font-mono overflow-hidden relative">
            <div ref={lineNumbersRef} className="w-12 flex-shrink-0 bg-slate-900 text-slate-600 py-4 text-right pr-3 select-none overflow-hidden border-r border-slate-800" style={editorStyles}>
                {Array.from({ length: lineCount }).map((_, i) => <div key={i} className="h-[1.6em]">{i + 1}</div>)}
            </div>
            <textarea
                ref={textareaRef}
                className="flex-1 bg-transparent text-slate-300 p-4 resize-none outline-none leading-relaxed overflow-auto whitespace-pre"
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
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
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

export const CodeStudio: React.FC<CodeStudioProps> = ({ onBack, currentUser, userProfile, sessionId, accessKey, onSessionStart, onSessionStop, onStartLiveSession }) => {
  const defaultFile: CodeFile = {
      name: 'hello.cpp',
      path: 'cloud://hello.cpp',
      language: 'c++',
      content: `#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}`,
      loaded: true,
      isDirectory: false,
      isModified: true
  };

  // MULTI-PANE STATE
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('single');
  const [activeSlots, setActiveSlots] = useState<(CodeFile | null)[]>([defaultFile, null, null, null]);
  const [focusedSlot, setFocusedSlot] = useState<number>(0);
  const [slotViewModes, setSlotViewModes] = useState<Record<number, 'code' | 'preview'>>({});
  
  const [innerSplitRatio, setInnerSplitRatio] = useState(50); // Percent for splits
  const [isDraggingInner, setIsDraggingInner] = useState(false);
  
  const [project, setProject] = useState<CodeProject>({ id: 'init', name: 'New Project', files: [defaultFile], lastModified: Date.now() });
  const [activeTab, setActiveTab] = useState<'cloud' | 'drive' | 'github' | 'session'>('cloud');
  const [isLeftOpen, setIsLeftOpen] = useState(true);
  const [isRightOpen, setIsRightOpen] = useState(true);
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'ai', text: string}>>([{ role: 'ai', text: "Hello! I'm your coding assistant. Open a code file or whiteboard to begin. You can ask me to **edit the active file directly**." }]);
  const [isChatThinking, setIsChatThinking] = useState(false);
  const [isFormattingSlots, setIsFormattingSlots] = useState<Record<number, boolean>>({});
  
  const [cloudItems, setCloudItems] = useState<CloudItem[]>([]); 
  const [driveItems, setDriveItems] = useState<(DriveFile & { parentId?: string, isLoaded?: boolean })[]>([]); 
  const [driveRootId, setDriveRootId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [loadingFolders, setLoadingFolders] = useState<Record<string, boolean>>({});
  
  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [githubToken, setGithubToken] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'modified' | 'saving'>('saved');
  const [isSharedSession, setIsSharedSession] = useState(!!sessionId);
  const [isZenMode, setIsZenMode] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [indentMode, setIndentMode] = useState<IndentMode>('spaces');
  const [leftWidth, setLeftWidth] = useState(256); 
  const [rightWidth, setRightWidth] = useState(320); 
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);

  const centerContainerRef = useRef<HTMLDivElement>(null);

  const activeFile = activeSlots[focusedSlot];

  // Tool for In-Place Editing
  const updateFileTool: FunctionDeclaration = {
    name: "update_active_file",
    description: "Updates the content of the currently focused file in the editor. Use this whenever the user asks for code modifications, refactoring, or additions to the file they are working on.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        new_content: {
          type: Type.STRING,
          description: "The complete new content of the file. Ensure you maintain proper indentation (spaces/tabs) and formatting. Do not truncate the file unless requested."
        },
        summary: {
          type: Type.STRING,
          description: "A brief summary of what you changed."
        }
      },
      required: ["new_content"]
    }
  };

  const handleSetLayout = (mode: LayoutMode) => {
      setLayoutMode(mode);
      if (mode === 'single' && focusedSlot !== 0) setFocusedSlot(0);
  };

  const handleSmartSave = async (targetFileOverride?: CodeFile) => {
    const fileToSave = targetFileOverride || activeFile;
    if (!fileToSave || (!fileToSave.isModified && saveStatus === 'saved')) return;
    setSaveStatus('saving');
    try {
        if (activeTab === 'cloud' && currentUser) {
             const rootPrefix = `projects/${currentUser.uid}`;
             let targetPath = fileToSave.path || `${rootPrefix}/${fileToSave.name}`;
             const lastSlash = targetPath.lastIndexOf('/');
             const parentPath = lastSlash > -1 ? targetPath.substring(0, lastSlash) : rootPrefix;
             await saveProjectToCloud(parentPath, fileToSave.name, fileToSave.content);
             await refreshCloudPath(parentPath);
        } else if (activeTab === 'drive' && driveToken && driveRootId) {
             await saveToDrive(driveToken, driveRootId, fileToSave.name, fileToSave.content);
        } else if (isSharedSession && sessionId) {
             await updateCodeFile(sessionId, fileToSave);
        }
        setSaveStatus('saved');
    } catch(e: any) { setSaveStatus('modified'); }
  };

  const handleFormatCode = async (slotIdx: number) => {
      const file = activeSlots[slotIdx];
      if (!file || isFormattingSlots[slotIdx]) return;

      setIsFormattingSlots(prev => ({ ...prev, [slotIdx]: true }));
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const prompt = `You are an expert code formatter. Reformat the following ${file.language} code to follow standard industry best practices. 
          Maintain all logic, comments, and structure. 
          Respond ONLY with the reformatted code. No markdown formatting, no backticks.
          
          CODE:
          ${file.content}`;

          const resp = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: prompt
          });

          const formatted = resp.text?.trim() || file.content;
          handleCodeChangeInSlot(formatted, slotIdx);
      } catch (e: any) {
          console.error("Formatting failed", e);
      } finally {
          setIsFormattingSlots(prev => ({ ...prev, [slotIdx]: false }));
      }
  };

  const updateSlotFile = async (file: CodeFile | null, slotIndex: number) => {
      const newSlots = [...activeSlots];
      newSlots[slotIndex] = file;
      setActiveSlots(newSlots);
      
      // Default to preview mode if it's a markdown/puml file being opened for the first time
      if (file && isPreviewable(file.name)) {
          setSlotViewModes(prev => ({ ...prev, [slotIndex]: 'code' }));
      }

      if (file && isSharedSession && sessionId) {
          updateProjectActiveFile(sessionId, file.path || file.name);
          updateCodeFile(sessionId, file);
      }
  };

  const isPreviewable = (filename: string) => {
      const ext = filename.split('.').pop()?.toLowerCase();
      return ['md', 'puml', 'plantuml'].includes(ext || '');
  };

  const toggleSlotViewMode = (idx: number) => {
      setSlotViewModes(prev => ({
          ...prev,
          [idx]: prev[idx] === 'preview' ? 'code' : 'preview'
      }));
  };

  const handleExplorerSelect = async (node: TreeNode) => {
      if (node.type === 'file') {
          let fileData: CodeFile | null = null;
          if (activeTab === 'cloud') {
                const item = node.data as CloudItem;
                if (item.url) {
                    const res = await fetch(item.url);
                    const text = await res.text();
                    fileData = { name: item.name, path: item.fullPath, content: text, language: getLanguageFromExt(item.name), loaded: true, isDirectory: false, isModified: false };
                }
          } else if (activeTab === 'drive') {
                const driveFile = node.data as DriveFile;
                if (driveToken) {
                    const text = await readDriveFile(driveToken, driveFile.id);
                    fileData = { name: driveFile.name, path: `drive://${driveFile.id}`, content: text, language: getLanguageFromExt(driveFile.name), loaded: true, isDirectory: false, isModified: false };
                }
          } else if (activeTab === 'github') {
                const file = node.data as CodeFile;
                if (!file.loaded && project.github) {
                    const content = await fetchFileContent(githubToken, project.github.owner, project.github.repo, file.path || file.name, project.github.branch);
                    fileData = { ...file, content, loaded: true };
                } else { fileData = file; }
          } else {
              fileData = node.data;
          }

          if (fileData) {
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
      setProject(prev => ({
          ...prev,
          files: prev.files.map(f => (f.path || f.name) === (file.path || f.name) ? updatedFile : f)
      }));
      setSaveStatus('modified');
      if (isSharedSession && sessionId) updateCodeFile(sessionId, updatedFile);
  };

  const resize = useCallback((e: MouseEvent) => {
    if (isDraggingLeft) { const newWidth = e.clientX; if (newWidth > 160 && newWidth < 500) setLeftWidth(newWidth); }
    if (isDraggingRight) { const newWidth = window.innerWidth - e.clientX; if (newWidth > 160 && newWidth < 500) setRightWidth(newWidth); }
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
  }, [isDraggingLeft, isDraggingRight, isDraggingInner, layoutMode]);

  useEffect(() => {
      if (isDraggingLeft || isDraggingRight || isDraggingInner) {
          window.addEventListener('mousemove', resize);
          const stop = () => { setIsDraggingLeft(false); setIsDraggingRight(false); setIsDraggingInner(false); };
          window.addEventListener('mouseup', stop);
          return () => { window.removeEventListener('mousemove', resize); window.removeEventListener('mouseup', stop); };
      }
  }, [isDraggingLeft, isDraggingRight, isDraggingInner, resize]);

  const refreshCloudPath = async (path: string) => {
      if (!currentUser) return;
      try { const items = await listCloudDirectory(path); setCloudItems(prev => { const map = new Map(prev.map(i => [i.fullPath, i])); items.forEach(i => map.set(i.fullPath, i)); return Array.from(map.values()); }); } catch(e) { console.error(e); }
  };

  const handleCloudToggle = async (node: TreeNode) => { const isExpanded = expandedFolders[node.id]; setExpandedFolders(prev => ({ ...prev, [node.id]: !isExpanded })); if (!isExpanded) { setLoadingFolders(prev => ({ ...prev, [node.id]: true })); try { await refreshCloudPath(node.id); } catch(e) { console.error(e); } finally { setLoadingFolders(prev => ({ ...prev, [node.id]: false })); } } };
  const handleDriveToggle = async (node: TreeNode) => { const driveFile = node.data as DriveFile; const isExpanded = expandedFolders[node.id]; setExpandedFolders(prev => ({ ...prev, [node.id]: !isExpanded })); if (!isExpanded && driveToken && (!node.children || node.children.length === 0)) { setLoadingFolders(prev => ({ ...prev, [node.id]: true })); try { const files = await listDriveFiles(driveToken, driveFile.id); setDriveItems(prev => { const newItems = files.map(f => ({ ...f, parentId: node.id, isLoaded: false })); return Array.from(new Map([...prev, ...newItems].map(item => [item.id, item])).values()); }); } catch(e) { console.error(e); } finally { setLoadingFolders(prev => ({ ...prev, [node.id]: false })); } } };
  const handleConnectDrive = async () => { try { const token = await connectGoogleDrive(); setDriveToken(token); const rootId = await ensureCodeStudioFolder(token); setDriveRootId(rootId); const files = await listDriveFiles(token, rootId); setDriveItems([{ id: rootId, name: 'CodeStudio', mimeType: 'application/vnd.google-apps.folder', isLoaded: true }, ...files.map(f => ({ ...f, parentId: rootId, isLoaded: false }))]); setActiveTab('drive'); } catch(e: any) { console.error(e); } };

  const handleCreateFile = async () => { const name = prompt("File Name:"); if (!name) return;
      try {
          const content = "// New File";
          if (activeTab === 'cloud' && currentUser) {
              await saveProjectToCloud(`projects/${currentUser.uid}`, name, content);
              await refreshCloudPath(`projects/${currentUser.uid}`);
          }
          const newFile: CodeFile = { name, path: name, language: getLanguageFromExt(name), content, loaded: true, isDirectory: false, isModified: true };
          updateSlotFile(newFile, focusedSlot);
      } catch(e: any) { console.error(e); }
  };

  const handleCreateWhiteboard = async () => { const name = prompt("Whiteboard Name:"); if (!name) return;
      const fileName = name.endsWith('.wb') ? name : name + '.wb';
      const content = "[]";
      try {
          if (activeTab === 'cloud' && currentUser) {
              await saveProjectToCloud(`projects/${currentUser.uid}`, fileName, content);
              await refreshCloudPath(`projects/${currentUser.uid}`);
          }
          const newFile: CodeFile = { name: fileName, path: fileName, language: 'whiteboard', content, loaded: true, isDirectory: false, isModified: true };
          updateSlotFile(newFile, focusedSlot);
      } catch(e: any) { console.error(e); }
  };

  const handleSendMessage = async (input: string) => {
      if (!input.trim()) return;
      setChatMessages(prev => [...prev, { role: 'user', text: input }]);
      setIsChatThinking(true);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const activeFile = activeSlots[focusedSlot];
          const contextFiles = activeSlots.filter(f => f !== null).map(f => `File: ${f?.name}\nLanguage: ${f?.language}\nContent:\n${f?.content}`).join('\n\n---\n\n');
          
          const prompt = `You are a Senior Software Engineer helping a user in Code Studio.
          Current Focused File: ${activeFile?.name || "None"}
          Workspace Context:\n${contextFiles}\n\n
          User Request: "${input}"
          
          If the user asks for code changes, use the 'update_active_file' tool to apply them directly. 
          When providing code in your conversational response, ensure you use proper Markdown code blocks.`;

          const resp = await ai.models.generateContent({ 
              model: 'gemini-3-flash-preview', 
              contents: prompt,
              config: {
                  tools: [{ functionDeclarations: [updateFileTool] }]
              }
          });

          // Handle Tool Calls
          if (resp.functionCalls) {
              for (const fc of resp.functionCalls) {
                  if (fc.name === 'update_active_file') {
                      const { new_content, summary } = fc.args;
                      if (activeFile) {
                          handleCodeChangeInSlot(new_content, focusedSlot);
                          setChatMessages(prev => [...prev, { role: 'ai', text: `✨ **In-place Edit Applied to ${activeFile.name}**\n\n${summary || "Code updated successfully."}` }]);
                      } else {
                          setChatMessages(prev => [...prev, { role: 'ai', text: "⚠️ No file is currently focused to apply edits to." }]);
                      }
                      
                      // Report back to AI
                      await ai.models.generateContent({
                          model: 'gemini-3-flash-preview',
                          contents: `Tool update_active_file completed successfully.`,
                          config: { tools: [{ functionDeclarations: [updateFileTool] }] }
                      });
                  }
              }
          } else {
              setChatMessages(prev => [...prev, { role: 'ai', text: resp.text || "I couldn't generate a response." }]);
          }

      } catch (e: any) { setChatMessages(prev => [...prev, { role: 'ai', text: `Error: ${e.message}` }]); } finally { setIsChatThinking(false); }
  };

  const cloudTree = useMemo(() => {
      const freshRoot: TreeNode[] = [];
      const freshMap = new Map<string, TreeNode>();
      cloudItems.forEach(item => freshMap.set(item.fullPath, { id: item.fullPath, name: item.name, type: item.isFolder ? 'folder' : 'file', data: item, children: [], isLoaded: true }));
      cloudItems.forEach(item => { const node = freshMap.get(item.fullPath)!; const parts = item.fullPath.split('/'); parts.pop(); const parentPath = parts.join('/'); if (freshMap.has(parentPath)) { freshMap.get(parentPath)!.children.push(node); } else { freshRoot.push(node); } });
      return freshRoot;
  }, [cloudItems]);

  const workspaceTree = useMemo(() => {
      const root: TreeNode[] = [];
      const map = new Map<string, TreeNode>();
      const repoFiles = Array.isArray(project.files) ? project.files : [];
      repoFiles.forEach(f => { const path = f.path || f.name; map.set(path, { id: path, name: f.name.split('/').pop()!, type: f.isDirectory ? 'folder' : 'file', data: f, children: [], status: f.isModified ? 'modified' : undefined }); });
      repoFiles.forEach(f => { const path = f.path || f.name; const node = map.get(path)!; const parts = path.split('/'); if (parts.length === 1) root.push(node); else { const parent = map.get(parts.slice(0, -1).join('/')); if (parent) parent.children.push(node); else root.push(node); } });
      return root;
  }, [project.files]);

  const driveTree = useMemo(() => {
      const root: TreeNode[] = [];
      const map = new Map<string, TreeNode>();
      driveItems.forEach(item => {
          map.set(item.id, {
              id: item.id,
              name: item.name,
              type: item.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file',
              data: item,
              children: [],
              isLoaded: item.isLoaded
          });
      });
      driveItems.forEach(item => {
          const node = map.get(item.id)!;
          if (item.parentId && map.has(item.parentId)) {
              map.get(item.parentId)!.children.push(node);
          } else if (!item.parentId) {
              root.push(node);
          }
      });
      return root;
  }, [driveItems]);

  const refreshExplorer = async () => {
      if (activeTab === 'cloud' && currentUser) {
          await refreshCloudPath(`projects/${currentUser.uid}`);
      } else if (activeTab === 'drive' && driveToken && driveRootId) {
          const files = await listDriveFiles(driveToken, driveRootId);
          setDriveItems([{ id: driveRootId, name: 'CodeStudio', mimeType: 'application/vnd.google-apps.folder', isLoaded: true }, ...files.map(f => ({ ...f, parentId: driveRootId, isLoaded: false }))]);
      }
  };

  const handleOpenRepo = async (repoPath?: string) => {
    const path = repoPath || userProfile?.defaultRepoUrl;
    if (!path) {
        alert("No default repository set in your profile settings.");
        return;
    }
    const [owner, repo] = path.split('/');
    if (!owner || !repo) {
        alert("Invalid repository format in profile. Expected 'owner/repo'.");
        return;
    }
    
    setLoadingFolders(prev => ({ ...prev, github_root: true }));
    try {
        const info = await fetchRepoInfo(owner, repo, githubToken);
        const { files, latestSha } = await fetchRepoContents(githubToken, owner, repo, info.default_branch);
        
        setProject({
            id: `gh-${info.id}`,
            name: info.full_name,
            files: files,
            lastModified: Date.now(),
            github: {
                owner,
                repo,
                branch: info.default_branch,
                sha: latestSha
            }
        });
        setActiveTab('github');
    } catch (e: any) {
        alert(e.message);
    } finally {
        setLoadingFolders(prev => ({ ...prev, github_root: false }));
    }
  };

  useEffect(() => {
    if (activeTab === 'cloud' && currentUser) {
        refreshExplorer();
    }
  }, [activeTab, currentUser]);

  const renderSlot = (idx: number) => {
      const file = activeSlots[idx];
      const isFocused = focusedSlot === idx;
      const viewMode = slotViewModes[idx] || 'code';
      const isFormatting = isFormattingSlots[idx];
      
      const isVisible = layoutMode === 'single' ? idx === 0 : (layoutMode === 'quad' ? true : idx < 2);
      if (!isVisible) return null;

      const slotStyle: React.CSSProperties = {};
      if (layoutMode === 'split-v' || layoutMode === 'split-h') {
          const size = idx === 0 ? `${innerSplitRatio}%` : `${100 - innerSplitRatio}%`;
          if (layoutMode === 'split-v') slotStyle.width = size;
          else slotStyle.height = size;
          slotStyle.flex = 'none';
      }

      return (
          <div 
            key={idx} 
            onClick={() => setFocusedSlot(idx)}
            style={slotStyle}
            className={`flex flex-col min-w-0 border ${isFocused ? 'border-indigo-500 z-10 shadow-[inset_0_0_10px_rgba(79,70,229,0.1)]' : 'border-slate-800'} relative transition-all overflow-hidden bg-slate-950 flex-1`}
          >
              {file ? (
                  <>
                    <div className={`px-4 py-2 flex items-center justify-between shrink-0 border-b ${isFocused ? 'bg-indigo-900/20 border-indigo-500/30' : 'bg-slate-900 border-slate-800'}`}>
                        <div className="flex items-center gap-2 overflow-hidden">
                            <FileIcon filename={file.name} />
                            <span className={`text-xs font-bold truncate ${isFocused ? 'text-indigo-200' : 'text-slate-400'}`}>{file.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            {viewMode === 'code' && !['whiteboard', 'markdown', 'plantuml'].includes(getLanguageFromExt(file.name)) && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleFormatCode(idx); }}
                                    disabled={isFormatting}
                                    className={`p-1.5 rounded transition-colors ${isFormatting ? 'text-indigo-400' : 'text-slate-500 hover:text-indigo-400'}`}
                                    title="Auto-Reformat Code (AI)"
                                >
                                    {isFormatting ? <Loader2 size={14} className="animate-spin"/> : <Wand2 size={14}/>}
                                </button>
                            )}
                            {isPreviewable(file.name) && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); toggleSlotViewMode(idx); }} 
                                    className={`p-1.5 rounded transition-colors ${viewMode === 'preview' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'}`}
                                    title={viewMode === 'preview' ? 'Show Code' : 'Show Preview'}
                                >
                                    {viewMode === 'preview' ? <Code size={14}/> : <Eye size={14}/>}
                                </button>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); updateSlotFile(null, idx); }} className="p-1.5 hover:bg-slate-800 rounded text-slate-500 hover:text-white transition-colors" title="Close Panel"><X size={14}/></button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-hidden relative">
                        {getLanguageFromExt(file.name) === 'whiteboard' ? (
                            <Whiteboard initialData={file.content} onDataChange={(code) => handleCodeChangeInSlot(code, idx)} disableAI={true} />
                        ) : viewMode === 'preview' ? (
                            <div className="h-full overflow-y-auto p-8 bg-slate-950 text-slate-300 selection:bg-indigo-500/30">
                                <MarkdownView content={file.name.endsWith('.puml') || file.name.endsWith('.plantuml') ? `\`\`\`plantuml\n${file.content}\n\`\`\`` : file.content} />
                            </div>
                        ) : (
                            <RichCodeEditor 
                                code={file.content} 
                                onChange={(code: string) => handleCodeChangeInSlot(code, idx)} 
                                language={file.language} 
                                fontSize={fontSize} 
                                indentMode={indentMode}
                            />
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

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden relative">
      <header className="h-14 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-4 shrink-0 z-20">
         <div className="flex items-center space-x-4">
            <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"><ArrowLeft size={20} /></button>
            
            {/* Sidebar Toggle: Explorer */}
            <button 
                onClick={() => setIsLeftOpen(!isLeftOpen)} 
                className={`p-2 rounded-lg transition-colors ${isLeftOpen ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-white'}`}
                title={isLeftOpen ? "Hide Explorer" : "Show Explorer"}
            >
                {isLeftOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
            </button>

            <h1 className="font-bold text-white text-sm flex items-center gap-2">{project.name}</h1>
         </div>

         <div className="flex items-center space-x-2">
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 mr-4">
                <button onClick={() => handleSetLayout('single')} className={`p-1.5 rounded transition-colors ${layoutMode === 'single' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`} title="Single Frame"><SquareIcon size={16}/></button>
                <button onClick={() => handleSetLayout('split-v')} className={`p-1.5 rounded transition-colors ${layoutMode === 'split-v' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`} title="Vertical Split"><Columns size={16}/></button>
                <button onClick={() => handleSetLayout('split-h')} className={`p-1.5 rounded transition-colors ${layoutMode === 'split-h' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`} title="Horizontal Split"><Rows size={16}/></button>
                <button onClick={() => handleSetLayout('quad')} className={`p-1.5 rounded transition-colors ${layoutMode === 'quad' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`} title="4 Frame Mode"><Grid2X2 size={16}/></button>
            </div>

            <div className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-lg border border-slate-700 mr-2">
                <button 
                    onClick={() => setIndentMode(prev => prev === 'spaces' ? 'tabs' : 'spaces')} 
                    className={`p-1.5 rounded transition-colors flex items-center gap-1.5 px-2.5 ${indentMode === 'tabs' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
                    title={indentMode === 'tabs' ? "Using Real Tabs" : "Using 4 Spaces"}
                >
                    <Indent size={14} />
                    <span className="text-[10px] font-bold uppercase">{indentMode}</span>
                </button>
                <div className="w-px h-4 bg-slate-700 mx-1"></div>
                <button onClick={() => setFontSize(f => Math.max(10, f - 2))} className="p-1.5 hover:bg-slate-700 rounded text-slate-400"><ZoomOut size={16}/></button>
                <button onClick={() => setFontSize(f => Math.min(48, f + 2))} className="p-1.5 hover:bg-slate-700 rounded text-slate-400"><ZoomIn size={16}/></button>
            </div>

            <button onClick={() => handleSmartSave()} className="flex items-center space-x-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-md mr-2"><Save size={14}/><span>Save</span></button>

            {/* Sidebar Toggle: AI Assistant */}
            <button 
                onClick={() => setIsRightOpen(!isRightOpen)} 
                className={`p-2 rounded-lg transition-colors ${isRightOpen ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-white'}`}
                title={isRightOpen ? "Hide AI Assistant" : "Show AI Assistant"}
            >
                {isRightOpen ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
            </button>
         </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
          {/* EXPLORER PANEL */}
          <div className={`${isZenMode ? 'hidden' : (isLeftOpen ? '' : 'hidden')} bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 overflow-hidden`} style={{ width: `${leftWidth}px` }}>
              <div className="flex border-b border-slate-800 bg-slate-900">
                  <button onClick={() => setActiveTab('cloud')} className={`flex-1 py-3 flex justify-center border-b-2 transition-colors ${activeTab === 'cloud' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}><Cloud size={16}/></button>
                  <button onClick={() => setActiveTab('drive')} className={`flex-1 py-3 flex justify-center border-b-2 transition-colors ${activeTab === 'drive' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}><HardDrive size={16}/></button>
                  <button onClick={() => setActiveTab('github')} className={`flex-1 py-3 flex justify-center border-b-2 transition-colors ${activeTab === 'github' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}><Github size={16}/></button>
              </div>
              <div className="p-3 border-b border-slate-800 flex flex-wrap gap-2 bg-slate-900 justify-center">
                  <button onClick={handleCreateFile} className="flex-1 flex items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white py-1.5 px-2 rounded text-xs font-bold shadow-md transition-colors whitespace-nowrap"><FileCode size={14}/> <span>New File</span></button>
                  <button onClick={handleCreateWhiteboard} className="flex-1 flex items-center justify-center gap-1 bg-pink-600 hover:bg-pink-500 text-white py-1.5 px-2 rounded text-xs font-bold shadow-md transition-colors whitespace-nowrap"><PenTool size={14}/> <span>New Board</span></button>
                  <button onClick={refreshExplorer} className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"><RefreshCw size={16}/></button>
              </div>
              <div className="flex-1 overflow-y-auto">
                  {activeTab === 'cloud' && cloudTree.map(node => <FileTreeItem key={node.id} node={node} depth={0} activeId={activeFile?.path} onSelect={handleExplorerSelect} onToggle={handleCloudToggle} onDelete={()=>{}} onShare={()=>{}} expandedIds={expandedFolders} loadingIds={loadingFolders} onDragStart={()=>{}} onDrop={()=>{}}/>)}
                  {activeTab === 'drive' && (driveToken ? driveTree.map(node => <FileTreeItem key={node.id} node={node} depth={0} activeId={activeFile?.path} onSelect={handleExplorerSelect} onToggle={handleDriveToggle} onDelete={()=>{}} expandedIds={expandedFolders} loadingIds={loadingFolders} onDragStart={()=>{}} onDrop={()=>{}}/>) : <div className="p-4 text-center"><button onClick={handleConnectDrive} className="px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-lg border border-slate-700 hover:bg-slate-700">Connect Drive</button></div>)}
                  {activeTab === 'github' && (project.github ? workspaceTree.map(node => <FileTreeItem key={node.id} node={node} depth={0} activeId={activeFile?.path} onSelect={handleExplorerSelect} onToggle={()=>{}} onDelete={()=>{}} onRename={()=>{}} expandedIds={expandedFolders} loadingIds={loadingFolders} onDragStart={()=>{}} onDrop={()=>{}}/>) : <div className="p-4 text-center"><button onClick={() => handleOpenRepo()} className="px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-lg border border-slate-700 hover:bg-slate-700">Open Default Repo</button></div>)}
              </div>
          </div>

          <div onMouseDown={() => setIsDraggingLeft(true)} className="w-1 cursor-col-resize hover:bg-indigo-500/50 transition-colors z-30 shrink-0 bg-slate-800/20 group relative">
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 bg-indigo-500 p-0.5 rounded-full pointer-events-none"><GripVertical size={10}/></div>
          </div>

          {/* MAIN EDITOR AREA: DYNAMIC GRID/FLEX LAYOUT */}
          <div ref={centerContainerRef} className={`flex-1 bg-slate-950 flex min-w-0 relative ${layoutMode === 'quad' ? 'grid grid-cols-2 grid-rows-2' : layoutMode === 'split-v' ? 'flex-row' : layoutMode === 'split-h' ? 'flex-col' : 'flex-col'}`}>
              {layoutMode === 'single' && renderSlot(0)}
              
              {layoutMode === 'split-v' && (
                  <>
                    {renderSlot(0)}
                    <div onMouseDown={() => setIsDraggingInner(true)} className="w-1.5 cursor-col-resize hover:bg-indigo-500/50 transition-colors z-40 bg-slate-800 group relative flex-shrink-0">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 bg-indigo-500 p-1 rounded-full shadow-lg pointer-events-none transition-opacity duration-200"><GripVertical size={12}/></div>
                    </div>
                    {renderSlot(1)}
                  </>
              )}

              {layoutMode === 'split-h' && (
                  <>
                    {renderSlot(0)}
                    <div onMouseDown={() => setIsDraggingInner(true)} className="h-1.5 cursor-row-resize hover:bg-indigo-500/50 transition-colors z-40 bg-slate-800 group relative flex-shrink-0">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 bg-indigo-500 p-1 rounded-full shadow-lg pointer-events-none transition-opacity duration-200"><GripHorizontal size={12}/></div>
                    </div>
                    {renderSlot(1)}
                  </>
              )}

              {layoutMode === 'quad' && [0,1,2,3].map(i => renderSlot(i))}
          </div>

          <div onMouseDown={() => setIsDraggingRight(true)} className="w-1 cursor-col-resize hover:bg-indigo-500/50 transition-colors z-30 shrink-0 bg-slate-800/20 group relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 bg-indigo-500 p-0.5 rounded-full pointer-events-none"><GripVertical size={10}/></div>
          </div>

          {/* AI PANEL */}
          <div className={`${isZenMode ? 'hidden' : (isRightOpen ? '' : 'hidden')} bg-slate-950 flex flex-col shrink-0 overflow-hidden`} style={{ width: `${rightWidth}px` }}>
              <AIChatPanel isOpen={true} onClose={() => setIsRightOpen(false)} messages={chatMessages} onSendMessage={handleSendMessage} isThinking={isChatThinking} />
          </div>
      </div>
    </div>
  );
};
