
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { CodeProject, CodeFile, UserProfile, Channel, CursorPosition, CloudItem } from '../types';
import { ArrowLeft, Save, Plus, Github, Cloud, HardDrive, Code, X, ChevronRight, ChevronDown, File, Folder, DownloadCloud, Loader2, CheckCircle, AlertTriangle, Info, FolderPlus, FileCode, RefreshCw, LogIn, CloudUpload, Trash2, ArrowUp, Edit2, FolderOpen, MoreVertical, Send, MessageSquare, Bot, Mic, Sparkles, SidebarClose, SidebarOpen, Users, Eye, FileText as FileTextIcon, Image as ImageIcon, StopCircle, Minus, Maximize2, Minimize2, Lock, Unlock, Share2, Terminal, Copy, WifiOff, PanelRightClose, PanelRightOpen, PanelLeftClose, PanelLeftOpen, Monitor, Laptop, PenTool, Edit3, ShieldAlert, ZoomIn, ZoomOut, Columns, Rows, Grid2X2, Square as SquareIcon, GripVertical, GripHorizontal, FileSearch, Indent, Wand2, Check, Link } from 'lucide-react';
import { listCloudDirectory, saveProjectToCloud, deleteCloudItem, createCloudFolder, subscribeToCodeProject, saveCodeProject, updateCodeFile, updateCursor, claimCodeProjectLock, updateProjectActiveFile, deleteCodeFile, updateProjectAccess, sendShareNotification, deleteCloudFolderRecursive } from '../services/firestoreService';
import { ensureCodeStudioFolder, listDriveFiles, readDriveFile, saveToDrive, deleteDriveFile, createDriveFolder, DriveFile, moveDriveFile, shareFileWithEmail, getDriveFileSharingLink } from '../services/googleDriveService';
import { connectGoogleDrive, getDriveToken } from '../services/authService';
import { fetchRepoInfo, fetchRepoContents, fetchFileContent, updateRepoFile } from '../services/githubService';
import { MarkdownView } from './MarkdownView';
import { Whiteboard } from './Whiteboard';
import { ShareModal } from './ShareModal';
import { generateSecureId } from '../utils/idUtils';
import { GoogleGenAI, FunctionDeclaration, Type } from '@google/genai';

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

const FileTreeItem = ({ node, depth, activeId, onSelect, onToggle, onDelete, onShare, expandedIds, loadingIds }: any) => {
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
                            onSelect={onSelect} 
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
      name: 'Welcome.md',
      path: 'drive://welcome',
      language: 'markdown',
      content: `# Welcome to AIVoiceCast Code Studio\n\nYour cloud projects are securely stored and synced to your **Google Drive** in the \`CodeStudio\` folder.\n\n### Features\n- **Multi-Pane Layout**: Standard, Splits, or Quad view.\n- **Neural Formatting**: AI-powered code beautification.\n- **Direct Share**: Share individual files or entire projects with other Google members.`,
      loaded: true,
      isDirectory: false,
      isModified: false
  };

  const [layoutMode, setLayoutMode] = useState<LayoutMode>('single');
  const [activeSlots, setActiveSlots] = useState<(CodeFile | null)[]>([defaultFile, null, null, null]);
  const [focusedSlot, setFocusedSlot] = useState<number>(0);
  const [slotViewModes, setSlotViewModes] = useState<Record<number, 'code' | 'preview'>>({ 0: 'preview' });
  
  const [innerSplitRatio, setInnerSplitRatio] = useState(50);
  const [isDraggingInner, setIsDraggingInner] = useState(false);
  
  const [project, setProject] = useState<CodeProject>({ id: 'init', name: 'My Workspace', files: [defaultFile], lastModified: Date.now() });
  const [activeTab, setActiveTab] = useState<'drive' | 'cloud' | 'github'>('drive');
  const [isLeftOpen, setIsLeftOpen] = useState(true);
  const [isRightOpen, setIsRightOpen] = useState(true);
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'ai', text: string}>>([{ role: 'ai', text: "Ready to code. Open a file from your **Google Drive** to begin." }]);
  const [isChatThinking, setIsChatThinking] = useState(false);
  const [isFormattingSlots, setIsFormattingSlots] = useState<Record<number, boolean>>({});
  
  // Share state
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  const [cloudItems, setCloudItems] = useState<CloudItem[]>([]); 
  const [driveItems, setDriveItems] = useState<(DriveFile & { parentId?: string, isLoaded?: boolean })[]>([]); 
  const [driveRootId, setDriveRootId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [loadingFolders, setLoadingFolders] = useState<Record<string, boolean>>({});
  const [isDriveLoading, setIsDriveLoading] = useState(false);
  
  const [driveToken, setDriveToken] = useState<string | null>(getDriveToken());
  const [githubToken, setGithubToken] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'modified' | 'saving'>('saved');
  const [isZenMode, setIsZenMode] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [indentMode, setIndentMode] = useState<IndentMode>('spaces');
  const [leftWidth, setLeftWidth] = useState(256); 
  const [rightWidth, setRightWidth] = useState(320); 
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);

  const centerContainerRef = useRef<HTMLDivElement>(null);
  const activeFile = activeSlots[focusedSlot];

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

  const handleSetLayout = (mode: LayoutMode) => {
      setLayoutMode(mode);
      if (mode === 'single' && focusedSlot !== 0) setFocusedSlot(0);
  };

  const handleSmartSave = async (targetFileOverride?: CodeFile) => {
    const fileToSave = targetFileOverride || activeFile;
    if (!fileToSave || (!fileToSave.isModified && saveStatus === 'saved')) return;
    setSaveStatus('saving');
    try {
        if (activeTab === 'drive' && driveToken && driveRootId) {
             const driveId = fileToSave.path?.includes('drive://') ? fileToSave.path.replace('drive://', '') : null;
             await saveToDrive(driveToken, driveRootId, fileToSave.name, fileToSave.content);
             await refreshExplorer();
        } else if (activeTab === 'cloud' && currentUser) {
             await saveProjectToCloud(`projects/${currentUser.uid}`, fileToSave.name, fileToSave.content);
        } else if (activeTab === 'github' && githubToken && project.github) {
            // Commit directly back to GitHub repo
            const { owner, repo, branch } = project.github;
            const res = await updateRepoFile(
                githubToken,
                owner,
                repo,
                fileToSave.path || fileToSave.name,
                fileToSave.content,
                fileToSave.sha,
                `Update ${fileToSave.name} via AIVoiceCast Code Studio`,
                branch
            );
            // Update local SHA to match new GitHub state
            fileToSave.sha = res.sha;
            fileToSave.isModified = false;
        }
        setSaveStatus('saved');
    } catch(e: any) { 
        console.error("Save failed", e);
        setSaveStatus('modified'); 
    }
  };

  const handleShareProject = async () => {
      if (!currentUser) return alert("Sign in to share project URIs.");
      let pid = project.id;
      if (pid === 'init') {
          pid = generateSecureId();
          const newProject = { ...project, id: pid, ownerId: currentUser.uid };
          await saveCodeProject(newProject);
          setProject(newProject);
      }
      const url = `${window.location.origin}?view=code_studio&id=${pid}`;
      setShareUrl(url);
      setShowShareModal(true);
  };

  const handleFormatCode = async (slotIdx: number) => {
      const file = activeSlots[slotIdx];
      if (!file || isFormattingSlots[slotIdx]) return;
      setIsFormattingSlots(prev => ({ ...prev, [slotIdx]: true }));
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const prompt = `Reformat the following ${file.language} code follow industry best practices. MAINTAIN LOGIC. Respond ONLY with code.\n\n${file.content}`;
          const resp = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
          handleCodeChangeInSlot(resp.text?.trim() || file.content, slotIdx);
      } catch (e: any) { console.error(e); } finally { setIsFormattingSlots(prev => ({ ...prev, [slotIdx]: false })); }
  };

  const updateSlotFile = async (file: CodeFile | null, slotIndex: number) => {
      const newSlots = [...activeSlots];
      newSlots[slotIndex] = file;
      setActiveSlots(newSlots);
      if (file && isPreviewable(file.name)) setSlotViewModes(prev => ({ ...prev, [slotIndex]: 'code' }));
  };

  const isPreviewable = (filename: string) => ['md', 'puml', 'plantuml'].includes(filename.split('.').pop()?.toLowerCase() || '');

  const toggleSlotViewMode = (idx: number) => {
      setSlotViewModes(prev => ({ ...prev, [idx]: prev[idx] === 'preview' ? 'code' : 'preview' }));
  };

  const handleExplorerSelect = async (node: TreeNode) => {
      if (node.type === 'file') {
          let fileData: CodeFile | null = null;
          if (activeTab === 'drive' && driveToken) {
              const text = await readDriveFile(driveToken, node.id);
              fileData = { name: node.name, path: `drive://${node.id}`, content: text, language: getLanguageFromExt(node.name), loaded: true, isDirectory: false, isModified: false };
          } else if (activeTab === 'cloud' && node.data?.url) {
              const res = await fetch(node.data.url);
              const text = await res.text();
              fileData = { name: node.name, path: node.id, content: text, language: getLanguageFromExt(node.name), loaded: true, isDirectory: false, isModified: false };
          } else if (activeTab === 'github' && project.github) {
              const { owner, repo, branch } = project.github;
              const text = await fetchFileContent(githubToken, owner, repo, node.id, branch);
              fileData = { name: node.name, path: node.id, content: text, language: getLanguageFromExt(node.name), loaded: true, isDirectory: false, isModified: false, sha: node.data?.sha };
          }
          if (fileData) updateSlotFile(fileData, focusedSlot);
      } else {
          if (activeTab === 'drive') handleDriveToggle(node);
          else if (activeTab === 'cloud') handleCloudToggle(node);
          else if (activeTab === 'github') handleGithubToggle(node);
      }
  };

  const handleExplorerShare = async (node: TreeNode) => {
      if (!driveToken) return;
      const email = prompt(`Enter member's Google Email to share "${node.name}" with:`);
      if (!email) return;
      try {
          await shareFileWithEmail(driveToken, node.id, email, 'reader');
          const link = await getDriveFileSharingLink(driveToken, node.id);
          alert(`Successfully shared! Member can access via Drive.\nLink: ${link}`);
      } catch(e: any) { alert(e.message); }
  };

  const handleCodeChangeInSlot = (newCode: string, slotIdx: number) => {
      const file = activeSlots[slotIdx];
      if (!file) return;
      const updatedFile = { ...file, content: newCode, isModified: true };
      const newSlots = [...activeSlots];
      newSlots[slotIdx] = updatedFile;
      setActiveSlots(newSlots);
      setSaveStatus('modified');
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

  const refreshExplorer = async () => {
      if (activeTab === 'drive' && driveToken) {
          setIsDriveLoading(true);
          try {
            const rootId = driveRootId || await ensureCodeStudioFolder(driveToken);
            setDriveRootId(rootId);
            const files = await listDriveFiles(driveToken, rootId);
            setDriveItems([{ id: rootId, name: 'CodeStudio', mimeType: 'application/vnd.google-apps.folder', isLoaded: true }, ...files.map(f => ({ ...f, parentId: rootId, isLoaded: false }))]);
          } finally {
            setIsDriveLoading(false);
          }
      } else if (activeTab === 'cloud' && currentUser) {
          const items = await listCloudDirectory(`projects/${currentUser.uid}`);
          setCloudItems(items);
      }
  };

  const handleDriveToggle = async (node: TreeNode) => {
      const isExpanded = expandedFolders[node.id];
      setExpandedFolders(prev => ({ ...prev, [node.id]: !isExpanded }));
      if (!isExpanded && driveToken && !node.isLoaded) {
          setLoadingFolders(prev => ({ ...prev, [node.id]: true }));
          try {
              const files = await listDriveFiles(driveToken, node.id);
              setDriveItems(prev => [...prev, ...files.map(f => ({ ...f, parentId: node.id, isLoaded: false }))]);
          } finally { setLoadingFolders(prev => ({ ...prev, [node.id]: false })); }
      }
  };

  const handleCloudToggle = async (node: TreeNode) => {
      const isExpanded = expandedFolders[node.id];
      setExpandedFolders(prev => ({ ...prev, [node.id]: !isExpanded }));
      if (!isExpanded) {
          setLoadingFolders(prev => ({ ...prev, [node.id]: true }));
          const items = await listCloudDirectory(node.id);
          setCloudItems(prev => [...prev, ...items]);
          setLoadingFolders(prev => ({ ...prev, [node.id]: false }));
      }
  };

  const handleGithubToggle = async (node: TreeNode) => {
      // Implement lazy subtree loading if needed
  };

  const handleConnectDrive = async () => {
      const token = await connectGoogleDrive();
      setDriveToken(token);
      refreshExplorer();
  };

  const handleCreateFile = async () => {
      const name = prompt("File Name (e.g. script.py):");
      if (!name || !driveToken || !driveRootId) return;
      await saveToDrive(driveToken, driveRootId, name, "// New File");
      await refreshExplorer();
  };

  const handleSendMessage = async (input: string) => {
      if (!input.trim()) return;
      setChatMessages(prev => [...prev, { role: 'user', text: input }]);
      setIsChatThinking(true);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const contextFiles = activeSlots.filter(f => f !== null).map(f => `File: ${f?.name}\nContent:\n${f?.content}`).join('\n---\n');
          const promptText = `Help in Code Studio. Active: ${activeFile?.name || "None"}. Workspace:\n${contextFiles}\nRequest: ${input}`;
          const resp = await ai.models.generateContent({ 
              model: 'gemini-3-flash-preview', 
              contents: promptText,
              config: { tools: [{ functionDeclarations: [updateFileTool] }] }
          });
          if (resp.functionCalls) {
              for (const fc of resp.functionCalls) {
                  if (fc.name === 'update_active_file') {
                      const { new_content, summary } = fc.args as any;
                      if (activeFile) { handleCodeChangeInSlot(new_content, focusedSlot); setChatMessages(prev => [...prev, { role: 'ai', text: `✨ **Edit Applied**\n\n${summary || "Code updated."}` }]); }
                  }
              }
          } else { setChatMessages(prev => [...prev, { role: 'ai', text: resp.text || "I'm not sure how to help with that." }]); }
      } catch (e: any) { setChatMessages(prev => [...prev, { role: 'ai', text: `Error: ${e.message}` }]); } finally { setIsChatThinking(false); }
  };

  const driveTree = useMemo(() => {
      const root: TreeNode[] = [];
      const map = new Map<string, TreeNode>();
      driveItems.forEach(item => {
          map.set(item.id, { id: item.id, name: item.name, type: item.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file', data: item, children: [], isLoaded: item.isLoaded });
      });
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

  useEffect(() => { 
      if (activeTab === 'drive' && !driveToken) return;
      refreshExplorer(); 
  }, [activeTab, driveToken, currentUser]);

  const renderSlot = (idx: number) => {
      const file = activeSlots[idx];
      const isFocused = focusedSlot === idx;
      const vMode = slotViewModes[idx] || 'code';
      const isFormatting = isFormattingSlots[idx];
      const isVisible = layoutMode === 'single' ? idx === 0 : (layoutMode === 'quad' ? true : idx < 2);
      if (!isVisible) return null;
      const slotStyle: any = {};
      if (layoutMode === 'split-v' || layoutMode === 'split-h') {
          const size = idx === 0 ? `${innerSplitRatio}%` : `${100 - innerSplitRatio}%`;
          if (layoutMode === 'split-v') slotStyle.width = size; else slotStyle.height = size;
          slotStyle.flex = 'none';
      }
      return (
          <div key={idx} onClick={() => setFocusedSlot(idx)} style={slotStyle} className={`flex flex-col min-w-0 border ${isFocused ? 'border-indigo-500 z-10' : 'border-slate-800'} relative bg-slate-950 flex-1 overflow-hidden`}>
              {file ? (
                  <>
                    <div className={`px-4 py-2 flex items-center justify-between shrink-0 border-b ${isFocused ? 'bg-indigo-900/20 border-indigo-500/30' : 'bg-slate-900 border-slate-800'}`}>
                        <div className="flex items-center gap-2 overflow-hidden">
                            <FileIcon filename={file.name} />
                            <span className={`text-xs font-bold truncate ${isFocused ? 'text-indigo-200' : 'text-slate-400'}`}>{file.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            {vMode === 'code' && !['markdown'].includes(getLanguageFromExt(file.name)) && (
                                <button onClick={(e) => { e.stopPropagation(); handleFormatCode(idx); }} disabled={isFormatting} className={`p-1.5 rounded ${isFormatting ? 'text-indigo-400' : 'text-slate-500 hover:text-indigo-400'}`} title="AI Format"><Wand2 size={14}/></button>
                            )}
                            {isPreviewable(file.name) && <button onClick={(e) => { e.stopPropagation(); toggleSlotViewMode(idx); }} className={`p-1.5 rounded ${vMode === 'preview' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'}`}>{vMode === 'preview' ? <Code size={14}/> : <Eye size={14}/>}</button>}
                            <button onClick={(e) => { e.stopPropagation(); updateSlotFile(null, idx); }} className="p-1.5 hover:bg-slate-800 rounded text-slate-500 hover:text-white"><X size={14}/></button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-hidden">
                        {vMode === 'preview' ? <div className="h-full overflow-y-auto p-8"><MarkdownView content={file.content} /></div> : <RichCodeEditor code={file.content} onChange={(c: string) => handleCodeChangeInSlot(c, idx)} language={file.language} fontSize={fontSize} indentMode={indentMode} />}
                    </div>
                  </>
              ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-700 bg-slate-950/50 border-2 border-dashed border-slate-800 m-4 rounded-xl cursor-pointer hover:border-slate-600">
                      <Plus size={32} className="opacity-20 mb-2" /><p className="text-xs font-bold uppercase">Pane {idx + 1}</p>
                  </div>
              )}
              {isFocused && <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>}
          </div>
      );
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden">
      <header className="h-14 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-4 shrink-0 z-20">
         <div className="flex items-center space-x-4">
            <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"><ArrowLeft size={20} /></button>
            <button onClick={() => setIsLeftOpen(!isLeftOpen)} className={`p-2 rounded-lg ${isLeftOpen ? 'bg-slate-800 text-white' : 'text-slate-500'}`}><PanelLeftOpen size={20}/></button>
            <h1 className="font-bold text-white text-sm">Code Studio</h1>
         </div>
         <div className="flex items-center space-x-2">
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 mr-4">
                <button onClick={() => handleSetLayout('single')} className={`p-1.5 rounded ${layoutMode === 'single' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}><SquareIcon size={16}/></button>
                <button onClick={() => handleSetLayout('split-v')} className={`p-1.5 rounded ${layoutMode === 'split-v' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}><Columns size={16}/></button>
                <button onClick={() => handleSetLayout('split-h')} className={`p-1.5 rounded ${layoutMode === 'split-h' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}><Rows size={16}/></button>
                <button onClick={() => handleSetLayout('quad')} className={`p-1.5 rounded ${layoutMode === 'quad' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}><Grid2X2 size={16}/></button>
            </div>
            
            <button onClick={handleShareProject} className="flex items-center space-x-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-lg transition-all active:scale-95">
                <Share2 size={14}/>
                <span>Share URI</span>
            </button>

            <button onClick={() => handleSmartSave()} className="flex items-center space-x-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold"><Save size={14}/><span>Save</span></button>
            <button onClick={() => setIsRightOpen(!isRightOpen)} className={`p-2 rounded-lg ${isRightOpen ? 'bg-slate-800 text-white' : 'text-slate-500'}`}><PanelRightOpen size={20}/></button>
         </div>
      </header>
      <div className="flex-1 flex overflow-hidden">
          <div className={`${isLeftOpen ? '' : 'hidden'} bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 overflow-hidden`} style={{ width: `${leftWidth}px` }}>
              <div className="flex border-b border-slate-800">
                  <button onClick={() => setActiveTab('drive')} className={`flex-1 py-3 flex justify-center border-b-2 transition-colors ${activeTab === 'drive' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500'}`}><HardDrive size={16}/></button>
                  <button onClick={() => setActiveTab('cloud')} className={`flex-1 py-3 flex justify-center border-b-2 transition-colors ${activeTab === 'cloud' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500'}`}><Cloud size={16}/></button>
                  <button onClick={() => setActiveTab('github')} className={`flex-1 py-3 flex justify-center border-b-2 transition-colors ${activeTab === 'github' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500'}`}><Github size={16}/></button>
              </div>
              <div className="p-3 border-b border-slate-800 flex gap-2">
                  <button onClick={handleCreateFile} className="flex-1 bg-indigo-600 text-white py-1.5 rounded text-xs font-bold">New File</button>
                  <button onClick={refreshExplorer} disabled={isDriveLoading} className="p-1.5 bg-slate-800 text-slate-300 rounded border border-slate-700 hover:text-white transition-colors">
                      {isDriveLoading ? <Loader2 size={16} className="animate-spin"/> : <RefreshCw size={16}/>}
                  </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                  {activeTab === 'drive' && (driveToken ? (
                      isDriveLoading && driveItems.length === 0 ? (
                          <div className="p-8 text-center"><Loader2 size={24} className="animate-spin mx-auto text-indigo-500 opacity-50"/><p className="text-[10px] text-slate-500 mt-2 uppercase font-bold">Syncing Drive...</p></div>
                      ) : (
                          driveTree.map(node => <FileTreeItem key={node.id} node={node} depth={0} activeId={activeFile?.path?.replace('drive://','')} onSelect={handleExplorerSelect} onToggle={handleDriveToggle} onShare={handleExplorerShare} expandedIds={expandedFolders} loadingIds={loadingFolders}/>)
                      )
                  ) : <div className="p-4 text-center"><button onClick={handleConnectDrive} className="px-4 py-2 bg-indigo-600 text-white text-xs rounded-lg">Connect Drive</button></div>)}
                  {activeTab === 'cloud' && cloudTree.map(node => <FileTreeItem key={node.id} node={node} depth={0} onSelect={handleExplorerSelect} onToggle={handleCloudToggle} onShare={()=>{}} expandedIds={expandedFolders} loadingIds={loadingFolders}/>)}
              </div>
          </div>
          <div onMouseDown={() => setIsDraggingLeft(true)} className="w-1 cursor-col-resize hover:bg-indigo-500/50 z-30 shrink-0 bg-slate-800/20"></div>
          <div ref={centerContainerRef} className={`flex-1 bg-slate-950 flex min-w-0 relative ${layoutMode === 'quad' ? 'grid grid-cols-2 grid-rows-2' : layoutMode === 'split-v' ? 'flex-row' : layoutMode === 'split-h' ? 'flex-col' : 'flex-col'}`}>
              {layoutMode === 'single' && renderSlot(0)}
              {layoutMode === 'split-v' && (<>{renderSlot(0)}<div onMouseDown={() => setIsDraggingInner(true)} className="w-1.5 cursor-col-resize hover:bg-indigo-500/50 z-40 bg-slate-800"></div>{renderSlot(1)}</>)}
              {layoutMode === 'split-h' && (<>{renderSlot(0)}<div onMouseDown={() => setIsDraggingInner(true)} className="h-1.5 cursor-row-resize hover:bg-indigo-500/50 z-40 bg-slate-800"></div>{renderSlot(1)}</>)}
              {layoutMode === 'quad' && [0,1,2,3].map(i => renderSlot(i))}
          </div>
          <div onMouseDown={() => setIsDraggingRight(true)} className="w-1 cursor-col-resize hover:bg-indigo-500/50 z-30 shrink-0 bg-slate-800/20"></div>
          <div className={`${isRightOpen ? '' : 'hidden'} bg-slate-950 flex flex-col shrink-0 overflow-hidden`} style={{ width: `${rightWidth}px` }}>
              <AIChatPanel isOpen={true} onClose={() => setIsRightOpen(false)} messages={chatMessages} onSendMessage={handleSendMessage} isThinking={isChatThinking} />
          </div>
      </div>

      {showShareModal && (
          <ShareModal 
              isOpen={true} 
              onClose={() => setShowShareModal(false)} 
              link={shareUrl} 
              title={project.name}
              onShare={async (uids, isPublic) => {
                  if (project.id !== 'init') {
                      await updateProjectAccess(project.id, isPublic ? 'public' : 'restricted', uids);
                  }
              }}
              currentAccess={project.accessLevel}
              currentAllowedUsers={project.allowedUserIds}
              currentUserUid={currentUser?.uid}
          />
      )}
    </div>
  );
};
