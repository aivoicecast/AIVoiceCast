import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { CodeProject, CodeFile, UserProfile, Channel, CursorPosition, CloudItem, TranscriptItem } from '../types';
import { 
    subscribeToCodeProject, saveCodeProject, updateCodeFile, updateCursor, 
    claimCodeProjectLock, updateProjectActiveFile, deleteCodeFile, updateProjectAccess,
    getCodeProject 
} from '../services/firestoreService';
import { 
    ensureCodeStudioFolder, listDriveFiles, readDriveFile, saveToDrive, 
    deleteDriveFile, createDriveFolder, downloadDriveFileAsBlob, getDriveFileStreamUrl,
    moveDriveFile
} from '../services/googleDriveService';
import { connectGoogleDrive, getDriveToken, signInWithGoogle, signInWithGitHub } from '../services/authService';
import { 
    fetchRepoContents, fetchFileContent, updateRepoFile, fetchRepoSubTree, 
    deleteRepoFile, renameRepoFile, fetchRepoInfo
} from '../services/githubService';
import { GeminiLiveService } from '../services/geminiLive';
import { MarkdownView } from './MarkdownView';
import { generateSecureId } from '../utils/idUtils';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import Editor from '@monaco-editor/react';
import { 
  ArrowLeft, Save, Plus, Github, Cloud, HardDrive, Code, X, ChevronRight, ChevronDown, 
  File, Folder, Loader2, RefreshCw, Trash2, Edit2, FolderOpen, Send, Bot, Mic, MicOff, 
  Sparkles, Terminal, Wand2, PanelLeft, PenTool, Activity, Lock, Search, FilePlus, 
  FileUp, Play, ExternalLink, ShieldCheck, Zap, Download, Layout, LayoutGrid, 
  PanelRightClose, PanelRightOpen, Database, Globe, FolderPlus, MoreVertical, Check, Settings, AlertCircle, FileText, FileVideo, Eye, TestTube, Microscope, MessageSquare
} from 'lucide-react';
import { Whiteboard } from './Whiteboard';
import { Visualizer } from './Visualizer';

interface CodeStudioProps {
  onBack: () => void;
  currentUser: any;
  userProfile: UserProfile | null;
  sessionId?: string;
  onSessionStart: (id: string) => void;
  onSessionStop: (id: string) => void;
  onStartLiveSession: (channel: Channel, context?: string) => void;
  initialFiles?: CodeFile[];
  isProMember?: boolean;
  isInterviewerMode?: boolean;
  onFileChange?: (file: CodeFile) => void;
  externalChatContent?: TranscriptItem[];
  isAiThinking?: boolean;
  onSyncCodeWithAi?: (file: CodeFile) => void;
}

type StorageSource = 'cloud' | 'drive' | 'github';

const FileIcon = ({ filename, isDirectory }: { filename: string, isDirectory?: boolean }) => {
    if (isDirectory) return <Folder size={14} className="text-indigo-400 fill-indigo-400/20" />;
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['js', 'jsx', 'ts', 'tsx'].includes(ext || '')) return <Code size={14} className="text-yellow-400" />;
    if (ext === 'py') return <Code size={14} className="text-blue-400" />;
    if (ext === 'md') return <FileText size={14} className="text-slate-400" />;
    if (ext === 'json') return <Code size={14} className="text-green-400" />;
    if (ext === 'html') return <Code size={14} className="text-orange-500" />;
    if (ext === 'css') return <Code size={14} className="text-blue-300" />;
    if (ext === 'pdf') return <FileText size={14} className="text-red-400" />;
    if (ext === 'webm') return <FileVideo size={14} className="text-purple-400" />;
    if (['wb', 'draw'].includes(ext || '')) return <PenTool size={14} className="text-pink-400" />;
    return <File size={14} className="text-slate-500" />;
};

const updateCodeTool: FunctionDeclaration = {
    name: 'update_code',
    description: 'Updates the content of the currently active code file. Use this to apply fixes, refactor code, or add test cases. Do NOT print the code in your text response if you use this tool.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            content: { type: Type.STRING, description: 'The complete new content for the active file.' }
        },
        required: ['content']
    }
};

export const CodeStudio: React.FC<CodeStudioProps> = ({ 
  onBack, currentUser, userProfile, isProMember, sessionId, initialFiles,
  isInterviewerMode, onFileChange, externalChatContent, isAiThinking, onSyncCodeWithAi
}) => {
  if (isProMember === false) {
    return (
        <div className="h-full flex items-center justify-center p-6 bg-slate-950">
            <div className="max-w-md w-full bg-slate-900 border border-indigo-500/30 rounded-[3rem] p-12 text-center shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-32 bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none"></div>
                <Lock size={48} className="text-indigo-400 mx-auto mb-6 relative z-10" />
                <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-4 relative z-10">Pro Access Required</h2>
                <p className="text-slate-400 text-sm mb-10 font-medium relative z-10">Neural Builder Studio requires an active Pro Membership to use high-intensity AI simulation and sovereign storage integration.</p>
                <button onClick={onBack} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest rounded-2xl transition-all relative z-10">Back to Hub</button>
            </div>
        </div>
    );
  }

  const [source, setSource] = useState<StorageSource>('cloud');
  const [project, setProject] = useState<CodeProject | null>(null);
  const [activeFile, setActiveFile] = useState<CodeFile | null>(null);
  const activeFileRef = useRef<CodeFile | null>(null);
  const [files, setFiles] = useState<CodeFile[]>(initialFiles || []);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isMagicFixing, setIsMagicFixing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [githubToken, setGithubToken] = useState<string | null>(localStorage.getItem('github_token'));
  const [previewMode, setPreviewMode] = useState(false);
  
  // Sidebar State
  const [repoUrlInput, setRepoUrlInput] = useState('');
  const [githubConfig, setGithubConfig] = useState({ owner: '', repo: '', branch: 'main' });
  const [terminalOutput, setTerminalOutput] = useState<string | null>(null);
  const [namingModal, setNamingModal] = useState<{ type: 'file' | 'folder' | 'rename', path?: string, oldName?: string } | null>(null);
  const [newName, setNewName] = useState('');

  // AI Chat State
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'ai', text: string}>>([
      { role: 'ai', text: "Hello! I'm your Neural Partner. I can help you write, debug, and simulate code across all backends." }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatThinking, setIsChatThinking] = useState(false);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);

  // Partner Live State
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [isAiConnected, setIsAiConnected] = useState(false);
  const [isRecoveringLink, setIsRecoveringLink] = useState(false);
  const [volume, setVolume] = useState(0);
  const partnerLiveRef = useRef<GeminiLiveService | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isConnectingRef = useRef(false);

  const getLanguageFromFilename = (name: string): any => {
      const ext = name.split('.').pop()?.toLowerCase();
      if (['js', 'jsx'].includes(ext || '')) return 'javascript';
      if (['ts', 'tsx'].includes(ext || '')) return 'typescript';
      if (ext === 'py') return 'python';
      if (ext === 'html') return 'html';
      if (ext === 'css') return 'css';
      if (ext === 'json') return 'json';
      if (ext === 'md') return 'markdown';
      if (ext === 'plantuml' || ext === 'puml') return 'plantuml';
      if (ext === 'wb' || ext === 'draw') return 'whiteboard';
      if (ext === 'pdf') return 'pdf';
      if (ext === 'webm') return 'video';
      return 'text';
  };

  const parseGithubUrl = (url: string) => {
      if (!url) return null;
      try {
          if (url.startsWith('http')) {
              const u = new URL(url);
              const parts = u.pathname.split('/').filter(Boolean);
              if (parts.length >= 2) {
                  return { owner: parts[0], repo: parts[1].replace('.git', '') };
              }
          } else {
              const parts = url.split('/').filter(Boolean);
              if (parts.length === 2) {
                  return { owner: parts[0], repo: parts[1] };
              }
          }
      } catch (e) {}
      return null;
  };

  useEffect(() => {
    if (userProfile?.defaultRepoUrl) {
        setRepoUrlInput(userProfile.defaultRepoUrl);
        const parsed = parseGithubUrl(userProfile.defaultRepoUrl);
        if (parsed) {
            setGithubConfig({ ...githubConfig, owner: parsed.owner, repo: parsed.repo });
        }
    }
  }, [userProfile]);

  useEffect(() => {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
      activeFileRef.current = activeFile;
  }, [activeFile]);

  // Sync internal state with props in interviewer mode
  useEffect(() => {
    if (isInterviewerMode && initialFiles && initialFiles.length > 0) {
        setFiles(initialFiles);
        // If we have an active file, make sure its content is updated from the new prop array
        if (activeFileRef.current) {
            const updated = initialFiles.find(f => f.path === activeFileRef.current?.path);
            if (updated && updated.content !== activeFileRef.current.content) {
                setActiveFile(updated);
                activeFileRef.current = updated;
            }
        }
    }
  }, [initialFiles, isInterviewerMode]);

  const handleGitHubSignIn = async () => {
    try {
        const token = await signInWithGitHub();
        setGithubToken(token);
    } catch (e) {
        setSyncError("GitHub authentication failed.");
    }
  };

  const handleRefreshSource = useCallback(async (forcedSource?: StorageSource, explicitGithub?: { owner: string, repo: string, branch: string }) => {
    const activeSource = forcedSource || source;
    let activeGithub = explicitGithub || githubConfig;
    setSyncError(null);

    if (activeSource === 'github' && !activeGithub.repo && repoUrlInput) {
        const parsed = parseGithubUrl(repoUrlInput);
        if (parsed) {
            activeGithub = { ...githubConfig, ...parsed };
            setGithubConfig(activeGithub);
        } else {
            setSyncError("Invalid GitHub URI. Use 'owner/repo' or full URL.");
            return;
        }
    }

    setIsLoading(true);
    try {
        if (activeSource === 'drive') {
            const token = getDriveToken() || await connectGoogleDrive();
            const folderId = await ensureCodeStudioFolder(token);
            const driveFiles = await listDriveFiles(token, folderId);
            setFiles(driveFiles.map(f => ({
                name: f.name,
                path: f.id,
                language: getLanguageFromFilename(f.name),
                content: '',
                loaded: false,
                isDirectory: f.mimeType === 'application/vnd.google-apps.folder'
            })));
        } else if (activeSource === 'github' && activeGithub.repo) {
            const token = localStorage.getItem('github_token');
            const { files: ghFiles } = await fetchRepoContents(token, activeGithub.owner, activeGithub.repo, activeGithub.branch);
            setFiles(ghFiles);
        } else if (activeSource === 'cloud' && project) {
            const p = await getCodeProject(project.id);
            if (p) setFiles(p.files);
        }
    } catch (e: any) {
        console.error("Refresh failed", e);
        setSyncError(e.message || "Sync failed. Check your connection or token.");
    } finally {
        setIsLoading(false);
    }
  }, [source, githubConfig, project, repoUrlInput]);

  const handleSourceChange = async (newSource: StorageSource) => {
    setSource(newSource);
    setSyncError(null);
    
    if (newSource === 'github') {
        const urlToUse = repoUrlInput || userProfile?.defaultRepoUrl;
        if (urlToUse) {
            const parsed = parseGithubUrl(urlToUse);
            if (parsed) {
                const newConfig = { ...githubConfig, owner: parsed.owner, repo: parsed.repo };
                setGithubConfig(newConfig);
                await handleRefreshSource('github', newConfig);
                return;
            }
        }
        setFiles([]);
        setActiveFile(null);
    } else {
        await handleRefreshSource(newSource);
    }
  };

  const handleFileSelect = async (file: CodeFile) => {
    if (file.isDirectory) return;
    
    const isBinary = file.language === 'pdf' || file.language === 'video';
    const isSpecial = isBinary || file.language === 'markdown' || file.language === 'plantuml' || file.language === 'whiteboard';
    
    if (file.loaded) { 
        setActiveFile(file); 
        setPreviewMode(isSpecial);
        return; 
    }

    setIsLoading(true);
    try {
        let content = '';
        if (!isBinary) {
            if (source === 'drive') {
                const token = getDriveToken()!;
                content = await readDriveFile(token, file.path);
            } else if (source === 'github') {
                content = await fetchFileContent(localStorage.getItem('github_token'), githubConfig.owner, githubConfig.repo, file.path, githubConfig.branch);
            }
        }
        
        const updatedFile = { ...file, content, loaded: true };
        setFiles(prev => prev.map(f => f.path === file.path ? updatedFile : f));
        setActiveFile(updatedFile);
        setPreviewMode(isSpecial);
    } catch (e) {
        setSyncError("Failed to load file content.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!activeFile || !currentUser) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
        if (source === 'cloud') {
            const pId = project?.id || generateSecureId();
            const updatedFiles = files.map(f => f.path === activeFile.path ? activeFile : f);
            const updatedProject: CodeProject = {
                id: pId,
                name: project?.name || 'Untitled Project',
                files: updatedFiles,
                lastModified: Date.now()
            };
            await saveCodeProject(updatedProject);
            setProject(updatedProject);
            setFiles(updatedFiles);
        } else if (source === 'drive') {
            const token = getDriveToken()!;
            const folderId = await ensureCodeStudioFolder(token);
            await saveToDrive(token, folderId, activeFile.name, activeFile.content, activeFile.path);
        } else if (source === 'github') {
            const token = localStorage.getItem('github_token');
            if (!token) throw new Error("Please sign in to GitHub to save.");
            const res = await updateRepoFile(token, githubConfig.owner, githubConfig.repo, activeFile.path, activeFile.content, activeFile.sha, "Neural Studio Sync", githubConfig.branch);
            setFiles(prev => prev.map(f => f.path === activeFile.path ? { ...f, sha: res.sha } : f));
        }
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
        setSyncError("Save failed: " + e.message);
    } finally {
        setIsSaving(false);
    }
  };

  const handleMagicFix = async () => {
    if (!activeFile) return;
    setIsMagicFixing(true);
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const systemPrompt = `You are a professional code refactoring and fixing tool.
        Your tasks:
        1. Fix any syntax errors in the provided code.
        2. Format the code with consistent indentation, spacing, and modern standards.
        3. Add any missing included headers, imports, or requires (e.g., #include <iostream> for C++ if cout is used).
        4. Return ONLY the corrected code. Do NOT include any explanations or markdown code blocks.`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `CODE FOR ${activeFile.language.toUpperCase()}:\n${activeFile.content}`,
            config: {
                systemInstruction: systemPrompt,
                thinkingConfig: { thinkingBudget: 0 }
            }
        });

        const correctedContent = response.text || activeFile.content;
        handleFileChangeLocal({ ...activeFile, content: correctedContent });
    } catch (e: any) {
        alert("Magic Pen failed: " + e.message);
    } finally {
        setIsMagicFixing(false);
    }
  };

  const handleCreateEntity = async () => {
    if (!newName.trim() || !namingModal) return;
    setIsLoading(true);
    try {
        const isFolder = namingModal.type === 'folder';
        if (source === 'drive') {
            const token = getDriveToken()!;
            const rootId = await ensureCodeStudioFolder(token);
            if (isFolder) {
                await createDriveFolder(token, newName, rootId);
            } else {
                await saveToDrive(token, rootId, newName, "// New file\n");
            }
        } else if (source === 'github') {
            const token = localStorage.getItem('github_token');
            if (!token) throw new Error("GitHub login required");
            const path = isFolder ? `${newName}/.keep` : newName;
            await updateRepoFile(token, githubConfig.owner, githubConfig.repo, path, isFolder ? "" : "// New file", undefined, `Create ${newName}`, githubConfig.branch);
        } else {
            const newFile: CodeFile = {
                name: newName,
                path: generateSecureId(),
                content: isFolder ? "" : "// New file",
                language: getLanguageFromFilename(newName),
                isDirectory: isFolder,
                loaded: true
            };
            const updatedFiles = [...files, newFile];
            setFiles(updatedFiles);
            if (project) await saveCodeProject({ ...project, files: updatedFiles });
        }
        await handleRefreshSource();
    } catch (e: any) {
        alert("Action failed: " + e.message);
    } finally {
        setIsLoading(false);
        setNamingModal(null);
        setNewName('');
    }
  };

  const handleDeleteEntity = async (file: CodeFile) => {
      if (!confirm(`Permanently delete ${file.name}?`)) return;
      setIsLoading(true);
      try {
          if (source === 'drive') {
              await deleteDriveFile(getDriveToken()!, file.path);
          } else if (source === 'github') {
              const token = localStorage.getItem('github_token');
              if (!token) throw new Error("GitHub login required");
              await deleteRepoFile(token, githubConfig.owner, githubConfig.repo, file.path, file.sha || '', `Delete ${file.name}`, githubConfig.branch);
          } else {
              const updatedFiles = files.filter(f => f.path !== file.path);
              setFiles(updatedFiles);
              if (project) await saveCodeProject({ ...project, files: updatedFiles });
          }
          if (activeFile?.path === file.path) setActiveFile(null);
          await handleRefreshSource();
      } catch (e: any) {
          alert("Delete failed: " + e.message);
      } finally {
          setIsLoading(false);
      }
  };

  const handleRenameEntity = async (file: CodeFile) => {
      const currentName = file.name.split('/').pop() || '';
      const newName = prompt("Rename to:", currentName);
      if (!newName || newName === currentName) return;

      setIsLoading(true);
      try {
          if (source === 'drive') {
              const token = getDriveToken()!;
              await moveDriveFile(token, file.path, '', '', newName);
          } else if (source === 'github') {
              const token = localStorage.getItem('github_token')!;
              await renameRepoFile(token, githubConfig.owner, githubConfig.repo, file.path, newName, file.content, file.sha || '', githubConfig.branch);
          } else {
              const updatedFiles = files.map(f => f.path === file.path ? { ...f, name: newName } : f);
              setFiles(updatedFiles);
              if (project) await saveCodeProject({ ...project, files: updatedFiles });
          }
          await handleRefreshSource();
      } catch (e: any) {
          alert("Rename failed: " + e.message);
      } finally {
          setIsLoading(false);
      }
  };

  const handleSimulate = async () => {
    if (!activeFile) return;
    setIsSimulating(true);
    setTerminalOutput(null);
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `ACT AS A DIGITAL TWIN TERMINAL. Execute the following code and provide the output/errors.\n\nCODE:\n\`\`\`${activeFile.language}\n${activeFile.content}\n\`\`\``;
        const response = await ai.models.generateContent({ 
            model: 'gemini-3-flash-preview', 
            contents: prompt,
            config: { thinkingConfig: { thinkingBudget: 0 } }
        });
        setTerminalOutput(response.text || "Execution finished with no output.");
    } catch (e: any) {
        setTerminalOutput(`[INTERNAL ERROR]: ${e.message}`);
    } finally {
        setIsSimulating(false);
    }
  };

  const handleChat = async (e?: React.FormEvent, customPrompt?: string) => {
    e?.preventDefault();
    const userText = customPrompt || chatInput;
    if (!userText.trim() || isChatThinking) return;

    if (!customPrompt) setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsChatThinking(true);

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const active = activeFileRef.current;
        const context = active ? `\n\nCURRENT FILE (${active.name}):\n\`\`\`${active.language}\n${active.content}\n\`\`\`` : '';
        
        const response = await ai.models.generateContent({
            // Optimization: Switched to Flash for faster tool calls and code generation
            model: 'gemini-3-flash-preview',
            contents: userText + context,
            config: {
                systemInstruction: "You are the Neural Partner, a world-class software engineer. You have full visibility of the user's active file. If you need to fix errors, refactor, or add tests, ALWAYS use the 'update_code' tool. DO NOT output code blocks in your text response if you use the tool. Your goal is in-place updates for a seamless experience.",
                tools: [{ functionDeclarations: [updateCodeTool] }],
                // Optimization: Disable thinking for direct, fast action responses
                thinkingConfig: { thinkingBudget: 0 }
            }
        });

        if (response.functionCalls && response.functionCalls.length > 0) {
            for (const fc of response.functionCalls) {
                if (fc.name === 'update_code' && activeFileRef.current) {
                    const args = fc.args as any;
                    const newContent = args.content || args.code || args.new_content;
                    if (newContent !== undefined) {
                        handleFileChangeLocal({ ...activeFileRef.current, content: newContent });
                    }
                }
            }
            setChatMessages(prev => [...prev, { role: 'ai', text: "Workspace refraction complete. I've updated the source file with the requested changes." }]);
        } else {
            setChatMessages(prev => [...prev, { role: 'ai', text: response.text || "No response." }]);
        }
    } catch (e: any) {
        setChatMessages(prev => [...prev, { role: 'ai', text: `[Partner Error]: ${e.message}` }]);
    } finally {
        setIsChatThinking(false);
    }
  };

  const toggleLivePartner = async () => {
      if (isLiveActive) {
          partnerLiveRef.current?.disconnect();
          partnerLiveRef.current = null;
          setIsLiveActive(false);
          setIsAiConnected(false);
          setIsRecoveringLink(false);
          reconnectAttemptsRef.current = 0;
          return;
      }

      if (isConnectingRef.current) return;

      // Local connection function to bypass closure issues with isLiveActive
      const initiateConnection = async () => {
          isConnectingRef.current = true;
          setIsLiveActive(true);
          
          const service = new GeminiLiveService();
          partnerLiveRef.current = service;

          const systemInstruction = `
            You are the Neural Partner in the Code Studio. 
            You are a supportive, high-level software architect.
            You can hear the user and they can hear you.
            
            CRITICAL BEHAVIOR:
            1. Upon connection, YOU MUST START THE CONVERSATION FIRST.
            2. Introduce yourself as the Neural Partner.
            3. Acknowledge the file content you see in the 'Neural Snapshot'.
            4. Ask the user how you can assist with their project today.
            
            Use the 'update_code' tool to modify the user's active file in-place when they ask for code fixes, refactoring, or test cases. 
            Never output code blocks verbally or in transcript if you can use the tool. 
            When the user says "review" or "add tests", trigger the 'update_code' tool with the full corrected file content.
            
            IMPORTANT: If the user just reconnected, they will send a "Neural Snapshot" automatically. Acknowledge it and continue from where you left off.
          `;

          try {
              // PRIME AUDIO FIRST
              await service.initializeAudio();
              
              await service.connect('Software Interview Voice', systemInstruction, {
                  onOpen: () => {
                      isConnectingRef.current = false;
                      setIsAiConnected(true);
                      setIsRecoveringLink(false);
                      reconnectAttemptsRef.current = 0;
                      const current = activeFileRef.current;
                      if (current) {
                          const snap = `NEURAL SNAPSHOT (Initial Context): I am currently working in ${current.name} (${current.language}). Here is the latest state of the file:\n\n\`\`\`${current.language}\n${current.content}\n\`\`\`\n\nINSTRUCTION: Please introduce yourself and let me know you're ready to collaborate on this code.`;
                          service.sendText(snap);
                      } else {
                          service.sendText("NEURAL LINK ESTABLISHED: I am ready. Please introduce yourself and let's get started.");
                      }
                  },
                  onClose: () => {
                      isConnectingRef.current = false;
                      setIsAiConnected(false);
                      // Check for auto-reconnect if it wasn't manually stopped
                      if (partnerLiveRef.current && reconnectAttemptsRef.current < 5) {
                          reconnectAttemptsRef.current++;
                          setIsRecoveringLink(true);
                          setTimeout(initiateConnection, 2000); 
                      } else {
                          setIsLiveActive(false);
                          setIsRecoveringLink(false);
                      }
                  },
                  onError: (err) => { 
                      isConnectingRef.current = false;
                      console.error("Partner connection error", err);
                      setIsAiConnected(false);
                      if (!err.includes('429') && reconnectAttemptsRef.current < 3) {
                          reconnectAttemptsRef.current++;
                          setTimeout(initiateConnection, 3000);
                      } else {
                          setIsLiveActive(false);
                      }
                  },
                  onVolumeUpdate: (v) => setVolume(v),
                  onTranscript: (text, isUser) => {
                      setChatMessages(prev => {
                          const role = isUser ? 'user' : 'ai';
                          if (prev.length > 0 && prev[prev.length - 1].role === role) {
                            return [...prev.slice(0, -1), { ...prev[prev.length - 1], text: prev[prev.length - 1].text + text }];
                          }
                          return [...prev, { role, text }];
                      });
                  },
                  onToolCall: async (toolCall) => {
                      for (const fc of toolCall.functionCalls) {
                          if (fc.name === 'update_code' && activeFileRef.current) {
                              const args = fc.args as any;
                              const newContent = args.content || args.code || args.new_content;
                              if (newContent !== undefined) {
                                handleFileChangeLocal({ ...activeFileRef.current, content: newContent });
                              }
                              service.sendToolResponse({ 
                                id: fc.id, 
                                name: fc.name, 
                                response: { result: "Code updated in workspace successfully." } 
                              });
                          }
                      }
                  }
              }, [{ functionDeclarations: [updateCodeTool] }]);
          } catch (e) {
              isConnectingRef.current = false;
              console.error("Critical connection failure", e);
              setIsLiveActive(false);
          }
      };

      initiateConnection();
  };

  const handleQuickAction = (type: 'review' | 'test') => {
      if (!activeFileRef.current) return alert("Select a file first.");
      const prompt = type === 'review' 
        ? "Perform a high-intensity review of this code. Fix logic errors, optimize bottlenecks, and apply security best practices. Return only the corrected code via the tool."
        : "Generate a comprehensive test suite for this code. Use standard testing patterns for the language. Append them or update the file via the tool.";
      handleChat(undefined, prompt);
  };

  const handleFileChangeLocal = (updated: CodeFile) => {
      setActiveFile(updated);
      activeFileRef.current = updated;
      setFiles(prev => prev.map(f => f.path === updated.path ? updated : f));
      if (onFileChange) onFileChange(updated);
  };

  const renderFileViewer = () => {
      if (!activeFile) return null;

      if (previewMode) {
          if (activeFile.language === 'markdown') {
              return <div className="h-full overflow-y-auto bg-white"><MarkdownView content={activeFile.content} initialTheme="light" /></div>;
          }
          if (activeFile.language === 'plantuml') {
              return <div className="h-full overflow-y-auto bg-white p-10"><MarkdownView content={`\`\`\`plantuml\n${activeFile.content}\n\`\`\``} initialTheme="light" /></div>;
          }
          if (activeFile.language === 'whiteboard') {
              return (
                  <Whiteboard 
                    initialContent={activeFile.content} 
                    onChange={(content) => handleFileChangeLocal({ ...activeFile, content })}
                    backgroundColor="#000000"
                  />
              );
          }
          if (activeFile.language === 'pdf') {
              const url = (source === 'drive' && getDriveToken()) ? getDriveFileStreamUrl(getDriveToken()!, activeFile.path) : activeFile.path;
              return <iframe src={url} className="w-full h-full border-none" title="PDF Viewer" />;
          }
          if (activeFile.language === 'video') {
              const url = (source === 'drive' && getDriveToken()) ? getDriveFileStreamUrl(getDriveToken()!, activeFile.path) : activeFile.path;
              return (
                  <div className="h-full w-full bg-black flex items-center justify-center">
                      <video src={url} controls className="max-w-full max-h-full" autoPlay />
                  </div>
              );
          }
      }

      return (
          <Editor 
            height="100%" 
            theme="vs-dark" 
            language={activeFile.language} 
            value={activeFile.content} 
            onChange={(val) => handleFileChangeLocal({ ...activeFile, content: val || '' })} 
            options={{ 
                fontSize: 14, 
                minimap: { enabled: false }, 
                fontFamily: "'JetBrains Mono', monospace", 
                automaticLayout: true,
                padding: { top: 20 }
            }} 
          />
      );
  };

  return (
    <div className="flex h-full w-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar - VFS */}
      <div className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between shrink-0">
              {!isInterviewerMode && (
                  <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400">
                      <ArrowLeft size={20} />
                  </button>
              )}
              <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
                  <button onClick={() => handleSourceChange('cloud')} className={`p-1.5 rounded ${source === 'cloud' ? 'bg-indigo-600 text-white' : 'text-slate-50'}`} title="Neural Cloud"><Database size={16}/></button>
                  <button onClick={() => handleSourceChange('drive')} className={`p-1.5 rounded ${source === 'drive' ? 'bg-emerald-600 text-white' : 'text-slate-50'}`} title="Google Drive"><HardDrive size={16}/></button>
                  <button onClick={() => handleSourceChange('github')} className={`p-1.5 rounded ${source === 'github' ? 'bg-white text-black' : 'text-slate-50'}`} title="GitHub"><Github size={16}/></button>
              </div>
          </div>

          <div className="p-2 flex gap-1 border-b border-slate-800 bg-slate-900/50">
              <button onClick={() => setNamingModal({ type: 'file' })} className="flex-1 py-1.5 flex items-center justify-center gap-2 hover:bg-slate-800 rounded text-[10px] font-bold text-slate-400 uppercase tracking-widest"><FilePlus size={14}/> File</button>
              <button onClick={() => setNamingModal({ type: 'folder' })} className="flex-1 py-1.5 flex items-center justify-center gap-2 hover:bg-slate-800 rounded text-[10px] font-bold text-slate-400 uppercase tracking-widest"><FolderPlus size={14}/> Folder</button>
              <button onClick={() => handleRefreshSource()} className="px-2 hover:bg-slate-800 rounded text-slate-500"><RefreshCw size={14} className={isLoading ? 'animate-spin' : ''}/></button>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-hide">
              <div className="p-4 space-y-4">
                  {source === 'github' && !githubConfig.repo && (
                      <div className="space-y-3 p-3 bg-slate-950 rounded-xl border border-slate-800 animate-fade-in text-center">
                          <div className="w-12 h-12 bg-indigo-900/20 rounded-full flex items-center justify-center mx-auto mb-2">
                             <Github size={20} className="text-indigo-400" />
                          </div>
                          <p className="text-xs font-bold text-white uppercase tracking-widest">Connect Repo</p>
                          <p className="text-[10px] text-slate-500 leading-relaxed">Enter a GitHub repository URI or owner/repo to refract.</p>
                          <div className="pt-2 space-y-2">
                              {!githubToken && (
                                  <button onClick={handleGitHubSignIn} className="w-full py-2 bg-slate-800 border border-slate-700 rounded-lg text-[10px] font-black uppercase tracking-widest text-white flex items-center justify-center gap-2 hover:bg-slate-700 transition-all">
                                      <Lock size={12}/> Handshake Required
                                  </button>
                              )}
                              <input 
                                type="text" 
                                placeholder="https://github.com/owner/repo" 
                                value={repoUrlInput} 
                                onChange={e => setRepoUrlInput(e.target.value)} 
                                onKeyDown={e => e.key === 'Enter' && handleRefreshSource()}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500 text-slate-200"
                              />
                          </div>
                          <button onClick={() => handleRefreshSource()} className="w-full py-2.5 bg-indigo-600 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-lg active:scale-95">Sync Tree</button>
                      </div>
                  )}

                  {syncError && (
                      <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-xl flex items-start gap-3 animate-fade-in">
                          <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                          <p className="text-[10px] text-red-200 leading-relaxed">{syncError}</p>
                      </div>
                  )}

                  <div className="space-y-0.5">
                      {isLoading ? (
                          <div className="py-12 text-center flex flex-col items-center gap-3">
                              <Loader2 className="animate-spin text-indigo-500" size={24}/>
                              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Indexing Workspace...</span>
                          </div>
                      ) : (
                          files.map(file => (
                            <div key={file.path} className="group relative">
                                <button 
                                  onClick={() => handleFileSelect(file)}
                                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${activeFile?.path === file.path ? 'bg-indigo-600/20 text-white border border-indigo-500/30' : 'text-slate-400 hover:bg-slate-800'}`}
                                >
                                    <FileIcon filename={file.name} isDirectory={file.isDirectory}/>
                                    <span className="truncate">{file.name}</span>
                                </button>
                                <div className="absolute right-1 top-1.5 hidden group-hover:flex items-center gap-0.5 z-10 bg-slate-800 rounded px-1">
                                    <button onClick={(e) => { e.stopPropagation(); handleRenameEntity(file); }} className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-white"><Edit2 size={12}/></button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteEntity(file); }} className="p-1 hover:bg-red-900/30 rounded text-slate-500 hover:text-red-400"><Trash2 size={12}/></button>
                                </div>
                            </div>
                          ))
                      )}
                  </div>
              </div>
          </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950 relative">
          <header className="h-14 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 shrink-0 z-20">
              <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-indigo-600/10 rounded-lg flex items-center justify-center border border-indigo-500/20"><Code size={18} className="text-indigo-400" /></div>
                  <div>
                      <h1 className="text-sm font-bold text-white truncate max-w-[200px]">{activeFile?.name || 'Neural Workspace'}</h1>
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${source === 'cloud' ? 'bg-amber-500' : source === 'drive' ? 'bg-emerald-500' : 'bg-white'}`}></div>
                        <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{source} Mode</span>
                      </div>
                  </div>
              </div>
              <div className="flex items-center gap-3">
                  {activeFile && (activeFile.language === 'markdown' || activeFile.language === 'plantuml' || activeFile.language === 'whiteboard' || activeFile.language === 'pdf' || activeFile.language === 'video') && (
                      <button 
                        onClick={() => setPreviewMode(!previewMode)} 
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${previewMode ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                      >
                          {previewMode ? <Edit2 size={14}/> : <Eye size={14}/>}
                          {previewMode ? 'Edit' : 'Preview'}
                      </button>
                  )}
                  {onSyncCodeWithAi && activeFile && (
                      <button onClick={() => onSyncCodeWithAi(activeFile)} className="flex items-center gap-2 px-4 py-1.5 bg-indigo-900/40 text-indigo-300 border border-indigo-500/30 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all">
                          <Zap size={12} fill="currentColor" /> Sync to AI
                      </button>
                  )}
                  <button onClick={handleMagicFix} disabled={isMagicFixing || !activeFile} className="flex items-center gap-2 px-4 py-1.5 bg-indigo-900/40 text-indigo-400 border border-indigo-500/30 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-lg active:scale-95 disabled:opacity-50 group">
                      {isMagicFixing ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} className="group-hover:scale-110 transition-transform" />} Magic Fix
                  </button>
                  <button onClick={handleSimulate} disabled={isSimulating || !activeFile} className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 disabled:opacity-50">
                      {isSimulating ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} fill="currentColor"/>} Run
                  </button>
                  <button onClick={handleSave} disabled={isSaving || !activeFile} className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 disabled:opacity-50">
                      {isSaving ? <Loader2 size={14} className="animate-spin" /> : saveSuccess ? <Check size={14} /> : <Save size={14}/>}
                      {isSaving ? 'Saving...' : saveSuccess ? 'Saved' : 'Save'}
                  </button>
              </div>
          </header>

          <div className="flex-1 overflow-hidden relative">
              {activeFile ? renderFileViewer() : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-700 bg-slate-950/50">
                      <div className="p-8 border-2 border-dashed border-slate-800 rounded-[3rem] text-center space-y-4">
                          <Code size={48} className="mx-auto opacity-10" />
                          <p className="text-sm font-bold uppercase tracking-widest">Select a file to begin refraction</p>
                      </div>
                  </div>
              )}

              {/* Terminal Drawer */}
              {terminalOutput && (
                  <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-slate-950 border-t-2 border-indigo-500/50 flex flex-col z-40 animate-fade-in-up">
                      <div className="flex justify-between items-center px-4 py-2 bg-slate-900 border-b border-slate-800">
                          <div className="flex items-center gap-2 text-indigo-400">
                              <Terminal size={14} />
                              <span className="text-[10px] font-black uppercase tracking-widest">Neural Execution Trace</span>
                          </div>
                          <button onClick={() => setTerminalOutput(null)} className="text-slate-500 hover:text-white transition-colors"><X size={16}/></button>
                      </div>
                      <div className="flex-1 overflow-auto p-6 font-mono text-xs text-slate-300 leading-relaxed bg-black/30">
                          <MarkdownView content={terminalOutput} />
                      </div>
                  </div>
              )}
          </div>
      </div>

      {/* Neural Partner Chat Sidebar */}
      {!isInterviewerMode && (
          <div className="w-80 bg-slate-950 border-l border-slate-800 flex flex-col shrink-0">
              <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                      <div className="relative">
                          <Bot className="text-indigo-400" size={20}/>
                          {isLiveActive && (
                              <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full animate-pulse ${isRecoveringLink ? 'bg-amber-500' : 'bg-red-500'}`}></div>
                          )}
                      </div>
                      <span className="font-bold text-sm uppercase tracking-tight">Neural Partner</span>
                  </div>
                  <button 
                    onClick={toggleLivePartner}
                    className={`p-2 rounded-lg transition-all ${isLiveActive ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-900/40' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                    title={isLiveActive ? "End Audio Link" : "Start Live Audio Chat"}
                  >
                      {isLiveActive ? <MicOff size={18}/> : <Mic size={18}/>}
                  </button>
              </div>

              {isLiveActive && (
                  <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center gap-3">
                      <div className="flex-1">
                          <Visualizer volume={volume} isActive={isAiConnected} color={isRecoveringLink ? "#f59e0b" : "#6366f1"} />
                      </div>
                      {isRecoveringLink && (
                          <div className="flex items-center gap-1.5 animate-pulse">
                              <RefreshCw size={12} className="text-amber-500 animate-spin"/>
                              <span className="text-[8px] font-black uppercase text-amber-500 whitespace-nowrap">Recovering Link...</span>
                          </div>
                      )}
                  </div>
              )}

              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
                  {chatMessages.map((m, i) => (
                      <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in-up`}>
                          <div className={`max-w-[90%] rounded-2xl p-3 text-xs leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm shadow-lg' : 'bg-slate-800 text-slate-300 rounded-tl-sm border border-slate-700'}`}>
                              {m.role === 'ai' ? <MarkdownView content={m.text} /> : <p className="whitespace-pre-wrap">{m.text}</p>}
                          </div>
                      </div>
                  ))}
                  {isChatThinking && <div className="p-2 flex gap-1"><div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></div><div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]"></div><div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]"></div></div>}
                  <div ref={chatMessagesEndRef} />
              </div>

              <div className="p-4 border-t border-slate-800 bg-slate-900 space-y-4">
                  {activeFileRef.current && (
                      <div className="grid grid-cols-2 gap-2">
                          <button 
                            onClick={() => handleQuickAction('review')}
                            disabled={isChatThinking}
                            className="flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-indigo-900/40 text-indigo-300 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-700 transition-all hover:border-indigo-500/30 disabled:opacity-50"
                          >
                            <Microscope size={12}/> Review Code
                          </button>
                          <button 
                            onClick={() => handleQuickAction('test')}
                            disabled={isChatThinking}
                            className="flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-emerald-900/40 text-emerald-300 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-700 transition-all hover:border-emerald-500/30 disabled:opacity-50"
                          >
                            <TestTube size={12}/> Generate Tests
                          </button>
                      </div>
                  )}
                  <form onSubmit={(e) => handleChat(e)} className="relative">
                      <textarea 
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChat(); } }}
                        placeholder="Ask for feedback..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-4 pr-12 py-3 text-xs text-white outline-none focus:border-indigo-500 resize-none h-20 shadow-inner"
                      />
                      <button type="submit" disabled={!chatInput.trim() || isChatThinking} className="absolute bottom-3 right-3 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all shadow-lg disabled:opacity-50"><Send size={16}/></button>
                  </form>
              </div>
          </div>
      )}

      {/* Interviewer Chat View */}
      {isInterviewerMode && (
          <div className="w-96 bg-slate-950 border-l border-slate-800 flex flex-col shrink-0">
               <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                      <Bot className="text-red-500" size={20}/>
                      <span className="font-bold text-sm uppercase tracking-tight">Technical Interviewer</span>
                  </div>
               </div>
               <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                  {externalChatContent?.map((item, i) => (
                      <div key={i} className={`flex flex-col ${item.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in-up`}>
                          <span className={`text-[9px] font-black uppercase mb-1 tracking-widest ${item.role === 'user' ? 'text-indigo-400' : 'text-red-400'}`}>{item.role === 'user' ? 'Candidate' : 'Interviewer'}</span>
                          <div className={`max-w-[90%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${item.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm shadow-xl' : 'bg-slate-900 text-slate-200 rounded-tl-sm border border-slate-800 shadow-md'}`}>
                              <p className="whitespace-pre-wrap">{item.text}</p>
                          </div>
                      </div>
                  ))}
                  {isAiThinking && <div className="p-4 flex flex-col items-center gap-2"><Loader2 className="animate-spin text-red-500" size={20}/><span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">AI evaluating response...</span></div>}
               </div>
               <div className="p-4 border-t border-slate-800 bg-slate-900/50 text-center">
                   <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em]">Live Audio Interrogation Active</p>
               </div>
          </div>
      )}

      {/* Naming Modal */}
      {namingModal && (
          <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
              <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl p-8 shadow-2xl space-y-6 animate-fade-in-up">
                  <div className="flex justify-between items-center">
                      <h3 className="text-lg font-bold text-white uppercase tracking-tighter italic">Create New {namingModal.type}</h3>
                      <button onClick={() => setNamingModal(null)} className="text-slate-500 hover:text-white"><X/></button>
                  </div>
                  <input autoFocus type="text" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateEntity()} placeholder={`Enter ${namingModal.type} name...`} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"/>
                  <div className="flex gap-2">
                      <button onClick={() => setNamingModal(null)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl text-xs font-bold uppercase tracking-widest">Cancel</button>
                      <button onClick={handleCreateEntity} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 uppercase tracking-widest transition-all active:scale-95"><Check size={14}/> Confirm</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default CodeStudio;