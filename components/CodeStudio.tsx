import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { CodeProject, CodeFile, UserProfile, Channel, CursorPosition, CloudItem, TranscriptItem } from '../types';
import { listCloudDirectory, saveProjectToCloud, deleteCloudItem, createCloudFolder, subscribeToCodeProject, saveCodeProject, updateCodeFile, updateCursor, claimCodeProjectLock, updateProjectActiveFile, deleteCodeFile, updateProjectAccess } from '../services/firestoreService';
import { ensureCodeStudioFolder, ensureFolder, listDriveFiles, readDriveFile, saveToDrive, deleteDriveFile, createDriveFolder, DriveFile, moveDriveFile, getDriveFileStreamUrl, getDrivePreviewUrl, findFolder, downloadDriveFileAsBlob } from '../services/googleDriveService';
import { connectGoogleDrive, getDriveToken, signInWithGoogle, signInWithGitHub, clearGitHubToken } from '../services/authService';
import { fetchRepoInfo, fetchRepoContents, fetchFileContent, updateRepoFile, fetchUserRepos, fetchRepoSubTree, deleteRepoFile, renameRepoFile } from '../services/githubService';
import { GeminiLiveService } from '../services/geminiLive';
import { MarkdownView } from './MarkdownView';
import { Whiteboard } from './Whiteboard';
import { ShareModal } from './ShareModal';
import { generateSecureId } from '../utils/idUtils';
import { GoogleGenAI, FunctionDeclaration, Type } from '@google/genai';
import Editor from '@monaco-editor/react';
import { 
  ArrowLeft, Save, Plus, Github, Cloud, HardDrive, Code, X, ChevronRight, ChevronDown, ChevronUp, File, Folder, DownloadCloud, Loader2, AlertTriangle, Info, FolderPlus, FileCode, RefreshCw, LogIn, CloudUpload, Trash2, Edit2, FolderOpen, Send, Bot, Mic, MicOff, Sparkles, SidebarClose, SidebarOpen, Users, Eye, FileText as FileTextIcon, Image as ImageIcon, Minus, Share2, Terminal as TerminalIcon, PanelRightClose, PanelRightOpen, PanelLeftClose, PanelLeftOpen, Camera, Search, FilePlus, FileUp, Play, Trash, ExternalLink, GraduationCap, ShieldCheck, Youtube, Video, Zap, Download, Headphones, Radio, TerminalSquare, MoveRight, 
  Columns, Rows, Grid2X2, Terminal, Wand2, PanelLeft, PenTool, Activity
} from 'lucide-react';

interface TreeNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: TreeNode[];
  parentId?: string;
  data?: any;
  isLoaded?: boolean;
  status?: 'modified' | 'new' | 'deleted';
  size?: number;
}

interface SystemLog {
    id: string;
    time: string;
    message: string;
    type: 'info' | 'tool' | 'error' | 'success' | 'warn';
    details?: any;
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
  onSyncCodeWithAi?: (file: CodeFile) => void;
}

function getLanguageFromExt(filename: string): CodeFile['language'] {
    if (!filename) return 'text';
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'youtube' || filename.includes('youtube.com') || filename.includes('youtu.be')) return 'youtube';
    if (['mp4', 'mov', 'm4v', 'webm'].includes(ext || '')) return 'video';
    if (['mp3', 'wav', 'm4a', 'ogg'].includes(ext || '')) return 'audio';
    if (ext === 'jsx') return 'javascript (react)';
    if (ext === 'tsx') return 'typescript (react)';
    if (ext === 'js') return 'javascript';
    if (ext === 'sh') return 'shell';
    if (ext === 'ts') return 'typescript';
    if (ext === 'py') return 'python';
    if (['cpp', 'hpp', 'cc', 'cxx'].includes(ext || '')) return 'c++';
    if (ext === 'c' || ext === 'h') return 'c';
    if (ext === 'java') return 'java';
    if (ext === 'rs') return 'rs';
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

function formatSize(bytes?: number): string {
    if (bytes === undefined || bytes === null || isNaN(bytes)) return '';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

const CURSOR_COLORS = [
    '#f87171', '#fb923c', '#fbbf24', '#facc15', '#a3e635', 
    '#4ade80', '#34d399', '#2dd4bf', '#22d3ee', '#38bdf8', 
    '#60a5fa', '#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#fb7185'
];

const FileIcon = ({ filename }: { filename: string }) => {
    if (!filename) return <File size={16} className="text-slate-500" />;
    const lang = getLanguageFromExt(filename);
    if (lang === 'youtube') return <Youtube size={16} className="text-red-500" />;
    if (lang === 'video') return <Video size={16} className="text-indigo-400" />;
    if (lang === 'audio') return <Headphones size={16} className="text-emerald-400" />;
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

const FileTreeItem = ({ node, depth, activeId, onSelect, onToggle, onDelete, onShare, onMove, expandedIds, loadingIds }: any) => {
    const isExpanded = expandedIds[node.id];
    const isLoading = loadingIds[node.id];
    const isActive = activeId === node.id || activeId === `drive://${node.id}`;
    
    const handleRowClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (node.type === 'folder') {
            onToggle(node);
        } else {
            if (onSelect) onSelect(node);
        }
    };

    return (
        <div>
            <div 
                className={`flex items-center gap-1 py-1 px-2 cursor-pointer select-none hover:bg-slate-800/50 group ${isActive ? 'bg-indigo-600/20 text-white shadow-sm ring-1 ring-indigo-500/30' : 'text-slate-400 hover:text-white'}`}
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
                onClick={handleRowClick}
            >
                {node.type === 'folder' && (
                    <div className="p-0.5 hover:text-white">
                        {isLoading ? <Loader2 size={12} className="animate-spin text-indigo-400"/> : isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </div>
                )}
                {node.type === 'folder' ? (
                    isExpanded ? <FolderOpen size={16} className="text-indigo-400"/> : <Folder size={16} className="text-indigo-400"/>
                ) : (
                    <div className="relative">
                        {isLoading ? <Loader2 size={16} className="animate-spin text-indigo-400"/> : <FileIcon filename={node.name} />}
                    </div>
                )}
                <span className="text-xs truncate flex-1 ml-1">{node.name}</span>
                {node.type === 'file' && node.size !== undefined && (
                    <span className="text-[9px] font-mono text-slate-600 group-hover:text-slate-400 mr-2">{formatSize(node.size)}</span>
                )}
                <div className="flex items-center gap-1">
                    {onMove && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onMove(node); }}
                            className="p-1 opacity-0 group-hover:opacity-100 hover:bg-slate-700 rounded text-slate-400 hover:text-indigo-400 transition-all"
                            title="Move/Rename"
                        >
                            <MoveRight size={12}/>
                        </button>
                    )}
                    {node.type === 'file' && onShare && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onShare(node); }}
                            className="p-1 opacity-0 group-hover:opacity-100 hover:bg-slate-700 rounded text-slate-400 hover:text-indigo-400 transition-all"
                            title="Share File"
                        >
                            <Share2 size={12}/>
                        </button>
                    )}
                    {onDelete && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onDelete(node); }}
                            className="p-1 opacity-0 group-hover:opacity-100 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400 transition-all"
                            title="Delete"
                        >
                            <Trash2 size={12}/>
                        </button>
                    )}
                </div>
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
                            onMove={onMove}
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

const AIChatPanel = ({ isOpen, onClose, messages, onSendMessage, isThinking, currentInput, onInputChange, isInterviewerMode, isLiveMode, onToggleLive }: any) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [showLocalPaste, setShowLocalPaste] = useState(false);
    const [pasteBuffer, setPasteBuffer] = useState('');
    const [pasteLang, setPasteLang] = useState('cpp');
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);
    
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isThinking]);

    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.onresult = (event: any) => {
                let finalTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
                }
                if (finalTranscript) {
                    onInputChange((prev: string) => prev + ' ' + finalTranscript);
                }
            };
            recognitionRef.current.onend = () => setIsListening(false);
        }
    }, [onInputChange]);

    const toggleVoiceInput = () => {
        if (!recognitionRef.current) return alert("Speech recognition not supported.");
        if (isListening) {
            recognitionRef.current.stop();
        } else {
            recognitionRef.current.start();
            setIsListening(true);
        }
    };

    const handleLocalPaste = () => {
        if (!pasteBuffer.trim()) return;
        const wrapped = `\`\`\`${pasteLang}\n${pasteBuffer}\n\`\`\``;
        onSendMessage(wrapped);
        setPasteBuffer('');
        setShowLocalPaste(false);
    };

    return (
        <div className="flex flex-col h-full bg-slate-950 border-l border-slate-800 relative">
            <div className="p-3 border-b border-slate-800 flex justify-between items-center bg-slate-900 shrink-0">
                <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-300 text-sm flex items-center gap-2">
                        {isInterviewerMode ? (
                            <><GraduationCap size={16} className="text-red-500"/> AI Interviewer</>
                        ) : (
                            <><Bot size={16} className="text-indigo-400"/> AI Assistant</>
                        )}
                    </span>
                    {isLiveMode && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-red-900/30 text-red-400 rounded-full border border-red-500/20 text-[10px] font-black uppercase tracking-widest animate-pulse">
                            <Radio size={10} fill="currentColor"/> Live
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {!isInterviewerMode && (
                        <button 
                            onClick={onToggleLive} 
                            className={`p-1.5 rounded-lg transition-all ${isLiveMode ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}
                            title={isLiveMode ? "End Live Connection" : "Start Live Voice Link"}
                        >
                            {isLiveMode ? <MicOff size={16}/> : <Mic size={16}/>}
                        </button>
                    )}
                    <button onClick={onClose} title="Minimize AI Panel"><PanelRightClose size={16} className="text-slate-500 hover:text-white"/></button>
                </div>
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
                            {m.role === 'user' ? 'Me' : 'AI'}
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

            {showLocalPaste && (
                <div className="absolute bottom-[70px] left-3 right-3 bg-slate-900 border border-indigo-500/50 rounded-2xl p-4 shadow-2xl z-50 animate-fade-in-up">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Neural Paste Helper</span>
                        <button onClick={() => setShowLocalPaste(false)}><X size={14}/></button>
                    </div>
                    <div className="flex gap-1 mb-3">
                        {['cpp', 'python', 'js'].map(l => (
                            <button key={l} onClick={() => setPasteLang(l)} className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border transition-all ${pasteLang === l ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-50'}`}>{l}</button>
                        ))}
                    </div>
                    <textarea 
                        value={pasteBuffer}
                        onChange={e => setPasteBuffer(e.target.value)}
                        className="w-full h-32 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-indigo-200 outline-none focus:border-indigo-500 resize-none mb-3"
                        placeholder="// Paste code to share..."
                    />
                    <button onClick={handleLocalPaste} disabled={!pasteBuffer.trim()} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 disabled:opacity-30 transition-all">Inject Block</button>
                </div>
            )}

            <div className="p-3 border-t border-slate-800 bg-slate-950">
                <form 
                    className="flex gap-2" 
                    onSubmit={(e) => { e.preventDefault(); if(currentInput.trim()) { onSendMessage(currentInput); onInputChange(''); } }}
                >
                    <div className="flex-1 flex items-center bg-slate-900 border border-slate-800 rounded-xl px-2 focus-within:border-indigo-500/50 transition-all shadow-inner">
                        <button type="button" onClick={() => setShowLocalPaste(true)} className="p-1.5 text-slate-500 hover:text-indigo-400 transition-colors" title="Paste Code Snippet"><Code size={18}/></button>
                        <input 
                            type="text" 
                            value={currentInput} 
                            onChange={e => onInputChange(e.target.value)} 
                            className="flex-1 bg-transparent border-none py-2.5 text-sm text-slate-300 focus:ring-0 placeholder-slate-600" 
                            placeholder={isLiveMode ? "AI is listening..." : isInterviewerMode ? "Reply to AI..." : "Ask AI to edit code..."} 
                        />
                        <button 
                            type="button" 
                            onClick={isLiveMode ? onToggleLive : toggleVoiceInput} 
                            className={`p-1.5 rounded-full transition-all ${isLiveMode || isListening ? 'text-red-500 bg-red-500/20 animate-pulse' : 'text-slate-400 hover:text-white'}`}
                            title={isLiveMode ? "End Live Session" : "Voice Input"}
                        >
                            {isLiveMode || isListening ? <MicOff size={18}/> : <Mic size={18}/>}
                        </button>
                    </div>
                    <button 
                        type="submit" 
                        disabled={!currentInput.trim() || isThinking}
                        className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50"
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
    onSyncCodeWithAi?: (file: CodeFile) => void;
    handleDownloadMedia: (file: CodeFile) => Promise<void>;
    fontSize: number;
    indentMode: IndentMode;
    isLive: boolean;
    lockStatus: string;
    broadcastCursor: (line: number, col: number) => void;
    isReadOnly?: boolean;
    isInterviewerMode?: boolean;
}

const Slot: React.FC<SlotProps> = ({ 
    idx, activeSlots, focusedSlot, setFocusedSlot, slotViewModes, toggleSlotViewMode,
    isFormattingSlots, terminalOutputs, setTerminalOutputs, isTerminalOpen, setIsTerminalOpen,
    isRunning, layoutMode, innerSplitRatio, handleRunCode, handleFormatCode,
    handleCodeChangeInSlot, updateSlotFile, onSyncCodeWithAi, handleDownloadMedia, fontSize, indentMode, isLive, lockStatus, broadcastCursor, isReadOnly = false, isInterviewerMode = false
}) => {
    const file = activeSlots[idx];
    const isFocused = focusedSlot === idx;
    const vMode = slotViewModes[idx] || 'code';
    const isFormatting = isFormattingSlots[idx];
    const terminalVisible = isTerminalOpen[idx];
    const output = terminalOutputs[idx] || [];
    const running = isRunning[idx];
    const [isDownloading, setIsDownloading] = useState(false);
    
    const isVisible = useMemo(() => {
        if (layoutMode === 'single') return idx === 0;
        if (layoutMode === 'quad') return true;
        return idx < 2; 
    }, [layoutMode, idx]);

    if (!isVisible) return null;
    
    const slotStyle: any = {};
    if (layoutMode === 'split-v' || layoutMode === 'split-h') {
        const size = idx === 0 ? `${innerSplitRatio}%` : `${100 - innerSplitRatio}%`;
        if (layoutMode === 'split-v') {
            slotStyle.width = size;
            slotStyle.flex = 'none';
        } else {
            slotStyle.height = size;
            slotStyle.flex = 'none';
        }
    } else if (layoutMode === 'single') {
        slotStyle.flex = '1';
        slotStyle.width = '100%';
    } else { // quad
        slotStyle.flex = '1';
    }

    const lang = file ? getLanguageFromExt(file.name) : 'text';
    const canRun = ['c++', 'c', 'python', 'javascript', 'typescript'].includes(lang);

    const getYouTubeId = (url: string) => {
        const match = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
        return match ? match[1] : null;
    };

    const isStreamUrl = file?.path && (file.path.startsWith('http') || file.path.includes('access_token='));

    const onMediaDownloadClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!file) return;
        setIsDownloading(true);
        try {
            await handleDownloadMedia(file);
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div 
            onClick={() => setFocusedSlot(idx)} 
            style={slotStyle} 
            className={`flex flex-col min-w-0 border ${isFocused ? 'border-indigo-500 z-10' : 'border-slate-800'} relative bg-slate-950 overflow-hidden h-full`}
        >
            {file ? (
                <>
                  <div className={`px-4 py-2 flex items-center justify-between shrink-0 border-b ${isFocused ? 'bg-indigo-900/20 border-indigo-500/30' : 'bg-slate-900 border-slate-800'}`}>
                      <div className="flex items-center gap-2 overflow-hidden">
                          <FileIcon filename={file.name} />
                          <span className={`text-xs font-bold truncate ${isFocused ? 'text-indigo-200' : 'text-slate-400'}`}>{file.name}</span>
                          {isStreamUrl && (
                              <div className="hidden sm:flex items-center gap-1 text-[8px] font-black bg-indigo-900/40 text-indigo-400 border border-indigo-500/30 px-1.5 py-0.5 rounded-full uppercase tracking-widest pointer-events-none">
                                  <Zap size={8} fill="currentColor"/> Neural Stream
                              </div>
                          )}
                      </div>
                      <div className="flex items-center gap-1">
                          {isInterviewerMode && (
                              <button onClick={(e) => { e.stopPropagation(); onSyncCodeWithAi?.(file); }} className="p-1.5 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded flex items-center gap-1 text-[10px] font-black uppercase transition-all" title="Send current code to AI">
                                  <Send size={14}/>
                                  <span className="hidden md:inline">Sync AI</span>
                              </button>
                          )}
                          {canRun && (
                              <button onClick={(e) => { e.stopPropagation(); handleRunCode(idx); }} disabled={running} className={`p-1.5 rounded flex items-center gap-1 text-[10px] font-black uppercase transition-all ${running ? 'text-indigo-400' : 'text-emerald-400 hover:bg-emerald-600/10'}`} title="Compile & Run">
                                  {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} fill="currentColor" />}
                                  <span className="hidden md:inline">Run</span>
                              </button>
                          )}
                          {vMode === 'code' && !['markdown', 'pdf', 'whiteboard', 'youtube', 'video', 'audio'].includes(lang) && (
                              <button onClick={(e) => { e.stopPropagation(); handleFormatCode(idx); }} disabled={isFormatting} className={`p-1.5 rounded ${isFormatting ? 'text-indigo-400' : 'text-slate-500 hover:text-indigo-400'}`} title="AI Format"><Wand2 size={14}/></button>
                          )}
                          {['md', 'puml', 'plantuml', 'pdf', 'draw', 'whiteboard', 'wb', 'youtube', 'webm', 'mp4', 'mov', 'm4v', 'mp3', 'wav', 'm4a', 'ogg'].includes(file.name.split('.').pop()?.toLowerCase() || '') && <button onClick={(e) => { e.stopPropagation(); toggleSlotViewMode(idx); }} className={`p-1.5 rounded ${vMode === 'preview' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'}`}>{vMode === 'preview' ? <Code size={14}/> : <Eye size={14}/>}</button>}
                          <button onClick={(e) => { e.stopPropagation(); updateSlotFile(null, idx); }} className="p-1.5 hover:bg-slate-800 rounded text-slate-500 hover:text-white"><X size={14}/></button>
                      </div>
                  </div>
                  <div className="flex-1 flex flex-col overflow-hidden">
                      <div className="flex-1 overflow-hidden relative">
                          {vMode === 'preview' ? (
                              lang === 'whiteboard' ? (
                                  <div className="w-full h-full">
                                      <Whiteboard driveId={file.driveId} initialContent={file.content} onChange={(c) => handleCodeChangeInSlot(c, idx)} isReadOnly={isReadOnly} />
                                  </div>
                              ) : lang === 'pdf' ? (
                                  <iframe 
                                      src={file.path} 
                                      className="w-full h-full border-none bg-white" 
                                      title="PDF Viewer" 
                                      sandbox="allow-scripts allow-same-origin"
                                  />
                              ) : lang === 'audio' ? (
                                  <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center p-8 space-y-6">
                                      <div className="w-24 h-24 bg-emerald-600/10 rounded-full flex items-center justify-center border border-emerald-500/20 text-emerald-400">
                                          <Headphones size={48} />
                                      </div>
                                      <audio 
                                          src={file.path} 
                                          controls 
                                          autoPlay 
                                          crossOrigin="anonymous"
                                          className="w-full max-w-md" 
                                      />
                                      <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Direct Audio Stream</p>
                                  </div>
                              ) : lang === 'video' ? (
                                  <div className="w-full h-full bg-black flex flex-col items-center justify-center relative p-6 text-center">
                                      <div className="w-16 h-16 bg-indigo-600/10 rounded-full flex items-center justify-center mb-4 border border-indigo-500/20 text-indigo-400">
                                          <Video size={32} />
                                      </div>
                                      <h3 className="text-white font-bold text-lg mb-2 uppercase tracking-tighter">Legacy Media Bridge</h3>
                                      <p className="text-slate-400 text-xs max-w-xs mb-8 leading-relaxed">
                                          Drive API security restricts direct streaming for this video format. To view this recording, download it to your local machine.
                                      </p>
                                      
                                      <button 
                                        onClick={onMediaDownloadClick}
                                        disabled={isDownloading}
                                        className="px-10 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black uppercase tracking-widest flex items-center gap-3 transition-all active:scale-95 shadow-xl shadow-indigo-900/40 disabled:opacity-50"
                                      >
                                          {isDownloading ? <Loader2 size={18} className="animate-spin"/> : <Download size={18}/>}
                                          {isDownloading ? 'PULLING STREAM...' : 'Download & Play Local'}
                                      </button>

                                      <div className="mt-8 flex items-center gap-2 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                                          <Info size={12}/>
                                          Matches G-Drive Native Protocol
                                      </div>
                                  </div>
                              ) : lang === 'youtube' ? (
                                  <div className="w-full h-full bg-black flex items-center justify-center">
                                      <iframe 
                                          width="100%" height="100%" 
                                          src={`https://www.youtube.com/embed/${getYouTubeId(file.content || file.path)}`} 
                                          frameBorder="0" allowFullScreen title="YouTube Preview"
                                      />
                                  </div>
                              ) : (
                                  <div className="h-full overflow-y-auto p-8 scrollbar-hide">
                                      <MarkdownView content={file.content} />
                                  </div>
                              )
                          ) : (
                              lang === 'youtube' ? (
                                <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-500 bg-slate-900/50">
                                    <Youtube size={64} className="mb-4 text-red-500 opacity-50"/>
                                    <h3 className="text-lg font-bold text-white mb-2">YouTube View File</h3>
                                    <p className="text-sm max-w-xs mb-6">This is a media reference file. Click the Eye icon in the toolbar to play the video.</p>
                                    <button onClick={() => toggleSlotViewMode(idx)} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-2">
                                        <Eye size={18}/> Preview & Play
                                    </button>
                                </div>
                              ) : lang === 'video' ? (
                                <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-500 bg-slate-900/50">
                                    <Video size={64} className="mb-4 text-indigo-500 opacity-50"/>
                                    <h3 className="text-lg font-bold text-white mb-2">Neural Recording</h3>
                                    <p className="text-sm max-w-xs mb-6">Recorded interview or session. Use the Eye icon to start playback.</p>
                                    <button onClick={() => toggleSlotViewMode(idx)} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-2">
                                        <Eye size={18}/> Access Recording
                                    </button>
                                </div>
                              ) : lang === 'audio' ? (
                                <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-500 bg-slate-900/50">
                                    <Headphones size={64} className="mb-4 text-emerald-500 opacity-50"/>
                                    <h3 className="text-lg font-bold text-white mb-2">Audio Archive</h3>
                                    <p className="text-sm max-w-xs mb-6">Directly playable audio stream. Use the Eye icon to start playback.</p>
                                    <button onClick={() => toggleSlotViewMode(idx)} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-2">
                                        <Eye size={18}/> Play Audio
                                    </button>
                                </div>
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
                              )
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
  isAiThinking = false, onFileChange, onSyncCodeWithAi
}) => {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const [githubLinkingError, setGithubLinkingError] = useState<string | null>(null);
  
  const defaultFile: CodeFile = {
      name: 'main.cpp',
      path: 'drive://welcome',
      language: 'c++',
      content: `#include <iostream>\n\nint main() {\n    std::cout << "Hello from Neural Prism Code Studio!" << std::endl;\n    return 0;\n}`,
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
  
  const internalFileContentRef = useRef<Map<string, string>>(new Map());
  const lastSessionIdRef = useRef<string | null>(null);
  const lastOpenedPathRef = useRef<string | null>(null);
  const initialFilesLengthRef = useRef<number>(0);

  const currentSessionIdFromPaths = useMemo(() => {
      const firstPath = initialFiles?.[0]?.path;
      if (firstPath?.startsWith('drive://')) {
          const parts = firstPath.split('/');
          return parts[2]; 
      }
      return null;
  }, [initialFiles]);

  const updateSlotsLRU = useCallback((file: CodeFile) => {
    setActiveSlots(prev => {
        const next = [...prev];
        next[focusedSlot] = file;
        return next;
    });
    
    const lang = getLanguageFromExt(file.name);
    setSlotViewModes(prev => ({
        ...prev,
        [focusedSlot]: ['markdown', 'plantuml', 'pdf', 'whiteboard', 'youtube', 'video', 'audio'].includes(lang) ? 'preview' : 'code'
    }));
  }, [focusedSlot]);

  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
        const sid = currentSessionIdFromPaths;
        const isNewSession = sid !== lastSessionIdRef.current;
        const hasGrown = initialFiles.length > initialFilesLengthRef.current;

        if (isNewSession) {
            setActiveSlots([null, null, null, null]);
            internalFileContentRef.current.clear();
            lastOpenedPathRef.current = null;
            lastSessionIdRef.current = sid;
        }

        const newestFile = [...initialFiles].reverse()[0];
        
        if (newestFile && (newestFile.path !== lastOpenedPathRef.current || hasGrown)) {
            updateSlotsLRU(newestFile);
            lastOpenedPathRef.current = newestFile.path;
        } else {
            setActiveSlots(prev => prev.map((s) => {
                if (!s) return null;
                const match = initialFiles.find(f => f.path === s.path);
                if (match && match.content !== s.content) {
                    return { ...s, content: match.content, isModified: false };
                }
                return s;
            }));
        }

        initialFilesLengthRef.current = initialFiles.length;
        setProject(prev => ({
            ...prev,
            files: initialFiles
        }));
    } else if (activeSlots.every(s => s === null)) {
        setActiveSlots([defaultFile, null, null, null]);
        setSlotViewModes({ 0: 'code' });
    }
  }, [initialFiles, currentSessionIdFromPaths, updateSlotsLRU]);

  useEffect(() => {
    const file = activeSlots[focusedSlot];
    if (file && onFileChange) {
        onFileChange(file);
    }
  }, [focusedSlot, onFileChange]);

  const [innerSplitRatio, setInnerSplitRatio] = useState(50);
  const [isDraggingInner, setIsDraggingInner] = useState(false);
  
  const [project, setProject] = useState<CodeProject>({ id: 'init', name: 'My Workspace', files: [defaultFile], lastModified: Date.now() });
  const [activeTab, setActiveTab] = useState<'session' | 'drive' | 'cloud' | 'github'>(isInterviewerMode ? 'session' : 'drive');
  const [isLeftOpen, setIsLeftOpen] = useState(true);
  const [isRightOpen, setIsRightOpen] = useState(true);
  
  const [terminalOutputs, setTerminalOutputs] = useState<Record<number, string[]>>({});
  const [isTerminalOpen, setIsTerminalOpen] = useState<Record<number, boolean>>({});
  const [isRunning, setIsRunning] = useState<Record<number, boolean>>({});

  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'ai', text: string}>>([{ role: 'ai', text: "Ready to code. Open a file from your **Google Drive** to begin." }]);
  const [githubSearchQuery, setGithubSearchQuery] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [isChatThinking, setIsChatThinking] = useState(false);
  const [isFormattingSlots, setIsFormattingSlots] = useState<Record<number, boolean>>({});
  const [isLiveChatActive, setIsLiveChatActive] = useState(false);
  const liveChatServiceRef = useRef<GeminiLiveService | null>(null);
  
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  const [cloudItems, setCloudItems] = useState<CloudItem[]>([]); 
  const [driveItems, setDriveItems] = useState<(DriveFile & { parentId?: string, isLoaded?: boolean })[]>([]); 
  const [driveRootId, setDriveRootId] = useState<string | null>(null);
  
  const [githubToken, setGithubToken] = useState<string | null>(localStorage.getItem('github_token'));
  const [githubRepos, setGithubRepos] = useState<any[]>([]);
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

  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [workingDirectory, setWorkingDirectory] = useState('/');

  const addSystemLog = useCallback((message: string, type: SystemLog['type'] = 'info', details?: any) => {
      const log: SystemLog = {
          id: generateSecureId(),
          time: new Date().toLocaleTimeString(),
          message,
          type,
          details
      };
      setSystemLogs(prev => [log, ...prev].slice(0, 100));
  }, []);

  const centerContainerRef = useRef<HTMLDivElement>(null);
  const activeFile = activeSlots[focusedSlot];

  const [isLive, setIsLive] = useState(false);
  const [lockStatus, setLockStatus] = useState<'free' | 'busy' | 'mine'>('free');

  const broadcastCursor = useCallback((line: number, column: number) => {
    if (isLive && lockStatus === 'mine') {
      updateCursor(project.id, {
        clientId,
        userId: currentUser?.uid || 'guest',
        userName: currentUser?.displayName || 'Guest',
        fileName: activeFile?.name || '',
        line,
        column,
        color: myColor,
        updatedAt: Date.now()
      });
    }
  }, [isLive, lockStatus, project.id, clientId, currentUser, activeFile, myColor]);

  const resolvePath = useCallback((target: string | undefined, currentCwd: string) => {
      if (!target) return currentCwd;
      if (target.startsWith('/')) return target;
      const prefix = currentCwd === '/' ? '/' : (currentCwd.endsWith('/') ? currentCwd : currentCwd + '/');
      return prefix + target;
  }, []);

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

  const createNewFileTool: FunctionDeclaration = {
    name: "create_new_file",
    description: "Creates a new file in the workspace and switches focus to it.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        filename: { type: Type.STRING, description: "The name of the file." },
        content: { type: Type.STRING, description: "The initial code content." },
        directory_path: { type: Type.STRING, description: "Optional path." }
      },
      required: ["filename", "content"]
    }
  };

  const createDirectoryTool: FunctionDeclaration = {
    name: "create_directory",
    description: "Creates a new directory.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        directory_name: { type: Type.STRING },
        parent_path: { type: Type.STRING }
      },
      required: ["directory_name"]
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
      } catch(e: any) { console.error(e); }
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
                  try {
                      const repos = await fetchUserRepos(githubToken);
                      setGithubRepos(repos);
                  } catch (e: any) {
                      if (e.message.includes('401') || e.message.includes('403')) {
                          clearGitHubToken();
                          setGithubToken(null);
                      }
                      throw e;
                  }
              }
          }
      } finally { setIsExplorerLoading(false); }
  };

  const handleAutoLoadDefaultRepo = async (token: string, repoFullName: string) => {
      const [owner, repo] = repoFullName.split('/');
      setIsGithubLoading(true);
      try {
          const info = await fetchRepoInfo(owner, repo, token);
          const { files, latestSha } = await fetchRepoContents(token, owner, repo, info.default_branch);
          const tree: TreeNode[] = files.map(f => ({
              id: f.path || f.name,
              name: f.name.split('/').pop() || f.name,
              type: (f.isDirectory ? 'folder' : 'file') as 'file' | 'folder',
              isLoaded: f.childrenFetched,
              size: f.size,
              data: f
          }));
          setGithubTree(tree);
          setProject(prev => ({
              ...prev,
              github: { owner, repo, branch: info.default_branch, sha: latestSha }
          }));
      } catch (e: any) {
          addSystemLog("Failed to load repo: " + e.message, 'error');
          if (e.message.includes('401') || e.message.includes('403')) {
              clearGitHubToken();
              setGithubToken(null);
          }
      } finally {
          setIsGithubLoading(false);
      }
  };

  const handleSelectRepo = async (repo: any) => {
      if (!githubToken) return;
      setIsGithubLoading(true);
      try {
          const { files, latestSha } = await fetchRepoContents(githubToken, repo.owner.login, repo.name, repo.default_branch);
          const tree: TreeNode[] = files.map(f => ({
              id: f.path || f.name,
              name: f.name.split('/').pop() || f.name,
              type: (f.isDirectory ? 'folder' : 'file') as 'file' | 'folder',
              isLoaded: f.childrenFetched,
              size: f.size,
              data: f
          }));
          setGithubTree(tree);
          setProject(prev => ({
              ...prev,
              github: { owner: repo.owner.login, repo: repo.name, branch: repo.default_branch, sha: latestSha }
          }));
      } catch (e: any) {
          alert("Failed to load repository tree: " + e.message);
          if (e.message.includes('401') || e.message.includes('403')) {
              clearGitHubToken();
              setGithubToken(null);
          }
      } finally {
          setIsGithubLoading(false);
      }
  };

  const handleSmartSave = async (targetFileOverride?: CodeFile) => {
    const fileToSave = targetFileOverride || activeFile;
    if (!fileToSave || (!fileToSave.isModified && saveStatus === 'saved')) return;
    setSaveStatus('saving');
    try {
        if (activeTab === 'drive' && driveToken && driveRootId) {
             const driveId = fileToSave.path?.startsWith('drive://') ? fileToSave.path.replace('drive://', '') : undefined;
             const folderId = fileToSave.parentId || driveRootId;
             await saveToDrive(driveToken, folderId, fileToSave.name, fileToSave.content, driveId);
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
        addSystemLog(`Saved: ${fileToSave.name}`, 'success');
    } catch(e: any) { 
        setSaveStatus('modified'); 
        addSystemLog(`Save Failed: ${e.message}`, 'error');
        if (e.message.includes('401') || e.message.includes('403')) {
            clearGitHubToken();
            setGithubToken(null);
        }
    }
  };

  const handleCreateNewFile = async (fileNameInput?: string, contentInput?: string, dirPathInput?: string) => {
      const fileName = fileNameInput || prompt("Enter filename:", "NewFile.ts");
      if (!fileName) return;
      let resolvedDirPath = resolvePath(dirPathInput, workingDirectory);
      if (resolvedDirPath.startsWith('/')) resolvedDirPath = resolvedDirPath.substring(1);
      try {
          let driveId: string | undefined;
          if (activeTab === 'drive' && driveToken) {
              const parentId = await ensureFolder(driveToken, resolvedDirPath || '', driveRootId || undefined);
              driveId = await saveToDrive(driveToken, parentId, fileName, contentInput || "");
          }
          const newFile: CodeFile = {
              name: fileName, path: `drive://${driveId || generateSecureId()}`,
              content: contentInput || "", language: getLanguageFromExt(fileName), 
              loaded: true, isDirectory: false, isModified: false, driveId: driveId
          };
          updateSlotFile(newFile, focusedSlot);
          refreshExplorer();
      } catch (e: any) { addSystemLog(`File creation failed: ${e.message}`, 'error'); }
  };

  const handleExplorerSelect = async (node: TreeNode) => {
      if (node.type === 'file') {
          setLoadingIds(prev => ({ ...prev, [node.id]: true }));
          try {
              let fileData = project.files.find(f => f.path === node.id || f.path === `drive://${node.id}`);
              
              if (!fileData) {
                  if (activeTab === 'drive' && driveToken) {
                      const text = await readDriveFile(driveToken, node.id);
                      fileData = { name: node.name, path: `drive://${node.id}`, content: text || "", language: getLanguageFromExt(node.name), loaded: true, isDirectory: false, isModified: false, driveId: node.id };
                  } else if (activeTab === 'github' && project.github) {
                      const { owner, repo, branch } = project.github;
                      const text = await fetchFileContent(githubToken, owner, repo, node.id, branch);
                      fileData = { name: node.name, path: node.id, content: text || "", language: getLanguageFromExt(node.name), size: node.size, loaded: true, isDirectory: false, isModified: false, sha: node.data?.sha };
                  } else if (activeTab === 'cloud' && node.data?.url) {
                      const res = await fetch(node.data.url);
                      const text = await res.text();
                      fileData = { name: node.name, path: node.id, content: text || "", language: getLanguageFromExt(node.name), size: node.size, loaded: true, isDirectory: false, isModified: false };
                  }
                  
                  if (fileData) {
                      setProject(prev => ({ ...prev, files: [...prev.files, fileData!] }));
                  }
              }
              
              if (fileData) updateSlotFile(fileData, focusedSlot);
          } catch(e: any) { 
              alert(`Error opening file: ${e.message}`); 
              if (e.message.includes('401') || e.message.includes('403')) {
                  clearGitHubToken();
                  setGithubToken(null);
              }
          } finally {
              setLoadingIds(prev => ({ ...prev, [node.id]: false }));
          }
      } else { 
          toggleFolder(node); 
      }
  };

  const toggleFolder = async (node: TreeNode) => {
      setExpandedIds(prev => ({ ...prev, [node.id]: !prev[node.id] }));
      
      if (!expandedIds[node.id] && !node.isLoaded) {
          setLoadingIds(prev => ({ ...prev, [node.id]: true }));
          try {
              if (activeTab === 'drive' && driveToken) {
                  const files = await listDriveFiles(driveToken, node.id);
                  const driveChildren = files.map(f => ({ ...f, parentId: node.id, isLoaded: false }));
                  setDriveItems(prev => [...prev, ...driveChildren]);
                  setDriveItems(prev => prev.map(item => item.id === node.id ? { ...item, isLoaded: true } : item));
              } else if (activeTab === 'github' && githubToken && project.github) {
                  const { owner, repo } = project.github;
                  const children = await fetchRepoSubTree(githubToken, owner, repo, node.data.sha, node.id);
                  const childNodes: TreeNode[] = children.map(f => ({
                      id: f.path || f.name,
                      name: f.name.split('/').pop() || f.name,
                      type: (f.isDirectory ? 'folder' : 'file') as 'file' | 'folder',
                      isLoaded: f.childrenFetched,
                      size: f.size,
                      data: f
                  }));
                  
                  const updateTree = (nodes: TreeNode[]): TreeNode[] => {
                      return nodes.map(n => {
                          if (n.id === node.id) return { ...n, children: childNodes, isLoaded: true };
                          if (n.children) return { ...n, children: updateTree(n.children) };
                          return n;
                      });
                  };
                  setGithubTree(prev => updateTree(prev));
              }
          } catch (e: any) {
              addSystemLog(`Failed to expand folder: ${e.message}`, 'error');
              if (e.message.includes('401') || e.message.includes('403')) {
                  clearGitHubToken();
                  setGithubToken(null);
              }
          } finally {
              setLoadingIds(prev => ({ ...prev, [node.id]: false }));
          }
      }
  };

  const updateSlotFile = async (file: CodeFile | null, slotIndex: number) => {
      setActiveSlots(prev => {
          const next = [...prev];
          next[slotIndex] = file;
          return next;
      });
      if (file) {
          const lang = getLanguageFromExt(file.name);
          setSlotViewModes(prev => ({ ...prev, [slotIndex]: ['markdown', 'pdf', 'whiteboard', 'video', 'audio', 'youtube'].includes(lang) ? 'preview' : 'code' }));
          if (onFileChange) onFileChange(file);
      }
  };

  const handleCodeChangeInSlot = (newCode: string, slotIdx: number) => {
      const file = activeSlots[slotIdx];
      if (!file) return;
      const updatedFile = { ...file, content: newCode, isModified: true };
      
      setActiveSlots(prev => {
          const next = [...prev];
          next[slotIdx] = updatedFile;
          return next.map(s => s?.path === updatedFile.path ? updatedFile : s);
      });
      
      setProject(prev => ({
          ...prev,
          files: prev.files.map(f => f.path === updatedFile.path ? updatedFile : f)
      }));

      setSaveStatus('modified');
      if (onFileChange) onFileChange(updatedFile);
      if (isLive && lockStatus === 'mine') updateCodeFile(project.id, updatedFile);
  };

  const handleFormatCode = async (slotIdx: number) => {
      const file = activeSlots[slotIdx];
      if (!file) return;
      setIsFormattingSlots(prev => ({ ...prev, [slotIdx]: true }));
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const response = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: `Reformat this ${file.language} code for production quality. Keep logic identical. Return ONLY the code content, with no markdown delimiters or extra text:\n\n${file.content}`
          });
          if (response.text) {
              const cleaned = response.text.trim().replace(/^```[a-z]*\n/i, '').replace(/\n```$/i, '');
              handleCodeChangeInSlot(cleaned, slotIdx);
          }
      } catch (e: any) {
          console.error("Format error:", e);
      } finally {
          setIsFormattingSlots(prev => ({ ...prev, [slotIdx]: false }));
      }
  };

  const handleRunCode = async (slotIdx: number) => {
      const file = activeSlots[slotIdx];
      if (!file) return;
      setIsRunning(prev => ({ ...prev, [slotIdx]: true }));
      setIsTerminalOpen(prev => ({ ...prev, [slotIdx]: true }));
      const updateTerminal = (msg: string, isError = false) => { setTerminalOutputs(prev => ({ ...prev, [slotIdx]: [...(prev[slotIdx] || []), `${isError ? '[ERROR] ' : ''}${msg}`] })); };
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const prompt = `Simulate output for: Lang: ${file.language}, Code: ${file.content}. Respond JSON: { "stdout": "string", "stderr": "string", "exitCode": number }`;
          const resp = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt, config: { responseMimeType: 'application/json' } });
          const result = JSON.parse(resp.text || '{}');
          if (result.stdout) updateTerminal(result.stdout);
          if (result.stderr) updateTerminal(result.stderr, true);
      } catch (e: any) { 
          updateTerminal(`Execution failed: ${e.message}`, true); 
      } finally { setIsRunning(prev => ({ ...prev, [slotIdx]: false })); }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isChatThinking) return;
    setChatMessages(prev => [...prev, { role: 'user', text }]);
    setIsChatThinking(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({ 
          model: 'gemini-3-pro-preview', 
          contents: text,
          config: { tools: [{ functionDeclarations: [updateFileTool, createNewFileTool, createDirectoryTool] }] } 
      });
      if (response.functionCalls) {
          for (const fc of response.functionCalls) {
              const args = fc.args as any;
              if (fc.name === 'update_active_file') handleCodeChangeInSlot(args.new_content, focusedSlot);
              else if (fc.name === 'create_new_file') await handleCreateNewFile(args.filename, args.content);
          }
      } else { setChatMessages(prev => [...prev, { role: 'ai', text: response.text || "..." }]); }
    } catch (e: any) {
        console.error("Chat error:", e);
    } finally { setIsChatThinking(false); }
  };

  const toggleLiveChat = async () => {
    if (isLiveChatActive) { liveChatServiceRef.current?.disconnect(); setIsLiveChatActive(false); return; }
    setIsLiveChatActive(true);
    const service = new GeminiLiveService();
    liveChatServiceRef.current = service;
    await service.connect('Fenrir', "Expert programmer", {
        onOpen: () => {}, onClose: () => setIsLiveChatActive(false), onError: () => setIsLiveChatActive(false),
        onVolumeUpdate: () => {}, onTranscript: (t, u) => setChatMessages(prev => [...prev, { role: u ? 'user' : 'ai', text: t }]),
    });
  };

  const resize = useCallback((e: MouseEvent) => {
    if (isDraggingLeft) { const nw = e.clientX; if (nw > 160 && nw < 500) setLeftWidth(nw); }
    if (isDraggingRight) { const nw = window.innerWidth - e.clientX; if (nw > 160 && nw < 500) setRightWidth(nw); }
  }, [isDraggingLeft, isDraggingRight]);

  useEffect(() => {
      if (isDraggingLeft || isDraggingRight) {
          window.addEventListener('mousemove', resize);
          const stop = () => { setIsDraggingLeft(false); setIsDraggingRight(false); };
          window.addEventListener('mouseup', stop);
          return () => { window.removeEventListener('mousemove', resize); window.removeEventListener('mouseup', stop); };
      }
  }, [isDraggingLeft, isDraggingRight, resize]);

  useEffect(() => { refreshExplorer(); }, [activeTab, driveToken, githubToken, currentUser]);

  const driveTree = useMemo(() => {
      const root: TreeNode[] = [];
      const map = new Map<string, TreeNode>();
      driveItems.forEach(item => map.set(item.id, { id: item.id, name: item.name, type: item.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file', data: item, children: [], isLoaded: item.isLoaded, size: item.size ? parseInt(item.size) : undefined }));
      driveItems.forEach(item => {
          const node = map.get(item.id)!;
          if (item.parentId && map.has(item.parentId)) map.get(item.parentId)!.children.push(node);
          else if (!item.parentId) root.push(node);
      });
      return root;
  }, [driveItems]);

  const sessionTree = useMemo(() => {
      return project.files.map(f => ({ id: f.path, name: f.name, type: 'file' as const, isLoaded: true, size: f.size, data: f }));
  }, [project.files]);

  return (
    <div className="flex h-full w-full bg-slate-950 text-slate-100 overflow-hidden">
      <div className={`${isLeftOpen ? '' : 'hidden'} bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 overflow-hidden`} style={{ width: `${leftWidth}px` }}>
          <div className="flex border-b border-slate-800 shrink-0">
              <button onClick={() => setActiveTab('session')} className={`flex-1 py-3 transition-colors ${activeTab === 'session' ? 'border-b-2 border-indigo-500 bg-slate-800 text-white' : 'text-slate-500 hover:text-white'}`}>
                <Activity size={18}/>
              </button>
              <button onClick={() => setActiveTab('drive')} className={`flex-1 py-3 transition-colors ${activeTab === 'drive' ? 'border-b-2 border-indigo-500 bg-slate-800 text-white' : 'text-slate-500 hover:text-white'}`}>
                <HardDrive size={18}/>
              </button>
              <button onClick={() => setActiveTab('cloud')} className={`flex-1 py-3 transition-colors ${activeTab === 'cloud' ? 'border-b-2 border-indigo-500 bg-slate-800 text-white' : 'text-slate-500 hover:text-white'}`}>
                <Cloud size={18}/>
              </button>
              <button onClick={() => setActiveTab('github')} className={`flex-1 py-3 transition-colors ${activeTab === 'github' ? 'border-b-2 border-indigo-500 bg-slate-800 text-white' : 'text-slate-500 hover:text-white'}`}>
                <Github size={18}/>
              </button>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-hide py-2">
              {activeTab === 'drive' && (driveToken ? driveTree.map(node => <FileTreeItem key={node.id} node={node} depth={0} activeId={activeFile?.path} onSelect={handleExplorerSelect} onToggle={toggleFolder} expandedIds={expandedIds} loadingIds={loadingIds}/>) : <div className="p-8 text-center"><button onClick={handleConnectDrive} className="px-4 py-2 bg-indigo-600 rounded-lg text-xs font-bold">Connect Drive</button></div>)}
              {activeTab === 'session' && sessionTree.map(node => <FileTreeItem key={node.id} node={node} depth={0} activeId={activeFile?.path} onSelect={handleExplorerSelect} onToggle={toggleFolder} expandedIds={expandedIds} loadingIds={loadingIds}/>)}
              {activeTab === 'cloud' && (currentUser ? cloudItems.map(node => <FileTreeItem key={node.name} node={{ id: node.fullPath, name: node.name, type: node.isFolder ? 'folder' : 'file', size: node.size, data: node }} depth={0} activeId={activeFile?.path} onSelect={handleExplorerSelect} onToggle={toggleFolder} expandedIds={expandedIds} loadingIds={loadingIds}/>) : <p className="p-4 text-xs text-slate-500">Sign in to view Cloud</p>)}
              {activeTab === 'github' && (githubToken ? (
                  githubTree.length > 0 ? (
                      githubTree.map(node => <FileTreeItem key={node.id} node={node} depth={0} activeId={activeFile?.path} onSelect={handleExplorerSelect} onToggle={toggleFolder} expandedIds={expandedIds} loadingIds={loadingIds}/>)
                  ) : (
                      <div className="p-4 space-y-4">
                          <h3 className="text-xs font-bold text-slate-500 uppercase">My Repositories</h3>
                          {isGithubLoading ? <Loader2 className="animate-spin mx-auto text-indigo-400" size={32}/> : githubRepos.map(repo => (
                              <button key={repo.id} onClick={() => handleSelectRepo(repo)} className="w-full text-left p-2 rounded hover:bg-slate-800 text-xs text-slate-300 transition-colors flex items-center gap-2">
                                  <Github size={14}/> {repo.name}
                              </button>
                          ))}
                      </div>
                  )
              ) : <div className="p-8 text-center"><button onClick={() => signInWithGitHub().then(setGithubToken)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold border border-slate-700">Link GitHub</button></div>)}
          </div>
      </div>
      <div onMouseDown={() => setIsDraggingLeft(true)} className="w-1 cursor-col-resize hover:bg-indigo-500 z-30 bg-slate-800/20"></div>
      <div className="flex-1 flex flex-col relative overflow-hidden">
          <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 shrink-0 z-20">
              <div className="flex items-center space-x-2">
                <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"><ArrowLeft size={20} /></button>
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                    <button onClick={() => handleSetLayout('single')} className={`p-1.5 rounded ${layoutMode === 'single' ? 'bg-indigo-600' : ''}`}><Terminal size={16}/></button>
                    <button onClick={() => handleSetLayout('split-v')} className={`p-1.5 rounded ${layoutMode === 'split-v' ? 'bg-indigo-600' : ''}`}><Columns size={16}/></button>
                    <button onClick={() => handleSetLayout('split-h')} className={`p-1.5 rounded ${layoutMode === 'split-h' ? 'bg-indigo-600' : ''}`}><Rows size={16}/></button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleSmartSave()} className="flex items-center space-x-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold"><Save size={14}/><span>Save</span></button>
              </div>
          </header>
          <div className={`flex-1 bg-slate-950 flex relative ${layoutMode === 'quad' ? 'grid grid-cols-2 grid-rows-2' : layoutMode === 'split-v' ? 'flex-row' : 'flex-col'}`}>
              {[0, 1, 2, 3].map(i => (
                  <Slot key={i} idx={i} activeSlots={activeSlots} focusedSlot={focusedSlot} setFocusedSlot={setFocusedSlot} slotViewModes={slotViewModes} toggleSlotViewMode={toggleSlotViewMode} isFormattingSlots={isFormattingSlots} terminalOutputs={terminalOutputs} setTerminalOutputs={setTerminalOutputs} isTerminalOpen={isTerminalOpen} setIsTerminalOpen={setIsTerminalOpen} isRunning={isRunning} layoutMode={layoutMode} innerSplitRatio={innerSplitRatio} handleRunCode={handleRunCode} handleFormatCode={handleFormatCode} handleCodeChangeInSlot={handleCodeChangeInSlot} updateSlotFile={updateSlotFile} fontSize={fontSize} indentMode={indentMode} isLive={isLive} lockStatus={lockStatus} broadcastCursor={broadcastCursor} isInterviewerMode={isInterviewerMode} handleDownloadMedia={async (file) => {
                      if (!driveToken) return;
                      const fileId = file.path.replace('drive://', '');
                      const blob = await downloadDriveFileAsBlob(driveToken, fileId);
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a'); a.href = url; a.download = file.name; a.click();
                  }} />
              ))}
          </div>
      </div>
      <div onMouseDown={() => setIsDraggingRight(true)} className="w-1 cursor-col-resize hover:bg-indigo-500 z-30 bg-slate-800/20"></div>
      <div className={`${isRightOpen ? '' : 'hidden'} bg-slate-950 flex flex-col shrink-0`} style={{ width: `${rightWidth}px` }}>
          <AIChatPanel isOpen={true} onClose={() => setIsRightOpen(false)} messages={isInterviewerMode ? externalChatContent || [] : chatMessages} onSendMessage={handleSendMessage} isThinking={isInterviewerMode ? isAiThinking : isChatThinking} currentInput={chatInput} onInputChange={setChatInput} isInterviewerMode={isInterviewerMode} isLiveMode={isLiveChatActive} onToggleLive={toggleLiveChat} />
      </div>
    </div>
  );
};

export default CodeStudio;