
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { RecordingSession, Channel, TranscriptItem, UserProfile, ViewID } from '../types';
import { getUserRecordings, deleteRecordingReference, saveRecordingReference, getUserProfile } from '../services/firestoreService';
import { getLocalRecordings, deleteLocalRecording } from '../utils/db';
import { Play, FileText, Trash2, Calendar, Clock, Loader2, Video, X, HardDriveDownload, Sparkles, Mic, Monitor, CheckCircle, Languages, AlertCircle, ShieldOff, Volume2, Camera, Youtube, ExternalLink, HelpCircle, Info, Link as LinkIcon, Copy, CloudUpload, HardDrive, LogIn, Check, Terminal, Activity, ShieldAlert, History, Zap, Download, Share2, Square, CheckSquare, Pause, Search, Plus, RefreshCw, ChevronRight, FileVideo, Calendar as CalendarIcon, Database, Timer, MessageSquareOff, MessageSquare, Power, Layers, Cpu, Target, Briefcase } from 'lucide-react';
import { auth } from '../services/firebaseConfig';
import { getYouTubeEmbedUrl, uploadToYouTube, getYouTubeVideoUrl, deleteYouTubeVideo } from '../services/youtubeService';
import { getDriveToken, signInWithGoogle, connectGoogleDrive } from '../services/authService';
import { ensureCodeStudioFolder, uploadToDrive, downloadDriveFileAsBlob, deleteDriveFile, getDriveFileStreamUrl } from '../services/googleDriveService';
import { ShareModal } from './ShareModal';
import { HANDCRAFTED_CHANNELS } from '../utils/initialData';

interface RecordingListProps {
  onBack?: () => void;
  onStartLiveSession?: (
    channel: Channel, 
    context?: string, 
    recordingEnabled?: boolean, 
    bookingId?: string, 
    videoEnabled?: boolean, 
    cameraEnabled?: boolean,
    activeSegment?: { index: number, lectureId: string },
    recordingDuration?: number,
    interactionEnabled?: boolean,
    recordingTarget?: 'drive' | 'youtube',
    sessionTitle?: string
  ) => void;
  onOpenManual?: () => void;
}

// Added missing HandshakePhase type definition to resolve TypeScript error on line 46
type HandshakePhase = 'idle' | 'local' | 'cloud' | 'finalizing' | 'complete';

const TOPIC_PRESETS = [
    { id: 'arch', label: 'Architecture', icon: Layers, color: 'text-indigo-400', bg: 'bg-indigo-900/20' },
    { id: 'algo', label: 'Algorithm', icon: Cpu, color: 'text-emerald-400', bg: 'bg-emerald-900/20' },
    { id: 'sys', label: 'System Design', icon: Database, color: 'text-amber-400', bg: 'bg-amber-900/20' },
    { id: 'biz', label: 'Business Strategy', icon: Briefcase, color: 'text-pink-400', bg: 'bg-pink-900/20' },
    { id: 'eval', label: 'Evaluation', icon: Target, color: 'text-red-400', bg: 'bg-red-900/20' },
    { id: 'gen', label: 'General Sync', icon: MessageSquare, color: 'text-slate-400', bg: 'bg-slate-800' }
];

const formatSize = (bytes?: number) => {
    if (bytes === undefined || bytes === null || bytes === 0) return '---';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

export const RecordingList: React.FC<RecordingListProps> = ({ onBack, onStartLiveSession, onOpenManual }) => {
  const [recordings, setRecordings] = useState<RecordingSession[]>([]);
  const [phase, setPhase] = useState<HandshakePhase>('idle');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);
  const [resolvedMediaUrl, setResolvedMediaUrl] = useState<string | null>(null);
  const [activeRecording, setActiveRecording] = useState<RecordingSession | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [isRecorderModalOpen, setIsRecorderModalOpen] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [recordCamera, setRecordCamera] = useState(true);
  const [recordScreen, setRecordScreen] = useState(true);
  const [recordingDuration, setRecordingDuration] = useState(180); 
  const [interactionEnabled, setInteractionEnabled] = useState(false); 
  const [recordingTarget, setRecordingTarget] = useState<'drive' | 'youtube'>('drive');

  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [sharingTitle, setSharingTitle] = useState('');

  const currentUser = auth?.currentUser;
  const isMounted = useRef(true);
  const lastHandshakeId = useRef<string>('');

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const addSyncLog = (msg: string, type: 'info' | 'error' | 'success' | 'warn' = 'info') => {
      window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: `[Archive] ${msg}`, type } }));
  };

  const formatPST = (timestamp: number) => {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(new Date(timestamp));
  };

  const loadData = useCallback(async () => {
    const handshakeId = Math.random().toString(36).substring(7);
    lastHandshakeId.current = handshakeId;
    
    setLoading(true);
    setError(null);
    setPhase('local');
    addSyncLog(`Registry cycle ${handshakeId} initialized.`);

    let collected: RecordingSession[] = [];

    try {
      addSyncLog("Handshake Phase 1: Local Refraction...");
      const localPromise = getLocalRecordings();
      const localTimeout = new Promise<RecordingSession[]>((resolve) => setTimeout(() => resolve([]), 4000));
      const local = await Promise.race([localPromise, localTimeout]);
      
      if (lastHandshakeId.current !== handshakeId || !isMounted.current) return;
      
      if (local && local.length > 0) {
          collected = [...local];
          setRecordings([...collected].sort((a,b) => b.timestamp - a.timestamp));
          addSyncLog(`Hydrated ${local.length} local nodes.`, 'success');
      } else {
          addSyncLog("Local ledger empty or timed out.", 'warn');
      }

      if (currentUser?.uid) {
          setPhase('cloud');
          addSyncLog(`Handshake Phase 2: Polling Cloud Vault (${currentUser.uid.substring(0,8)})...`);
          try {
              const cloudPromise = getUserRecordings(currentUser.uid);
              const cloudTimeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Cloud Latency Exceeded")), 12000));
              const cloud = await Promise.race([cloudPromise, cloudTimeout]) as RecordingSession[];

              if (lastHandshakeId.current !== handshakeId || !isMounted.current) return;
              
              if (cloud && cloud.length > 0) {
                  const combined = [...collected, ...cloud];
                  const map = new Map<string, RecordingSession>();
                  combined.forEach(item => { if (item && item.id) map.set(item.id, item); });
                  collected = Array.from(map.values());
                  addSyncLog(`Refracted ${cloud.length} remote artifacts.`, 'success');
              }
          } catch (e: any) {
              addSyncLog(`Cloud poll interrupted: ${e.message}`, 'warn');
          }
      }

      if (lastHandshakeId.current === handshakeId && isMounted.current) {
          setPhase('finalizing');
          setRecordings(collected.sort((a, b) => b.timestamp - a.timestamp));
          addSyncLog(`Handshake cycle complete. ${collected.length} total nodes active.`);
      }
    } catch (e: any) { 
        console.error("Critical Registry Fault:", e);
        if (isMounted.current && lastHandshakeId.current === handshakeId) setError(e.message);
    } finally { 
        if (isMounted.current && lastHandshakeId.current === handshakeId) {
            setPhase('complete');
            setLoading(false);
        }
    }
  }, [currentUser]);

  useEffect(() => { loadData(); }, [loadData]);

  const isYouTubeUrl = (url?: string) => !!url && (url.includes('youtube.com') || url.includes('youtu.be'));
  const isDriveUrl = (url?: string) => !!url && (url.startsWith('drive://') || url.includes('drive.google.com'));

  const extractYouTubeId = (url: string): string | null => {
      try {
          const urlObj = new URL(url);
          if (urlObj.hostname.includes('youtube.com')) return urlObj.searchParams.get('v');
          else if (urlObj.hostname.includes('youtu.be')) return urlObj.pathname.slice(1);
      } catch (e: any) {
          const match = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
          return match ? match[1] : null;
      }
      return null;
  };

  const handleShare = (rec: RecordingSession) => {
    const url = isYouTubeUrl(rec.mediaUrl) ? rec.mediaUrl : `${window.location.origin}${window.location.pathname}?view=recordings&id=${rec.id}`;
    setShareUrl(url);
    setSharingTitle(rec.channelTitle);
    setShowShareModal(true);
  };

  const handleDownloadToDevice = async (rec: any) => {
      setDownloadingId(rec.id);
      try {
          let blob: Blob;
          if (rec.blob instanceof Blob) { blob = rec.blob; } 
          else if (isDriveUrl(rec.mediaUrl)) {
              const token = getDriveToken() || await signInWithGoogle().then(() => getDriveToken());
              if (!token) throw new Error("Google access required.");
              const fileId = rec.mediaUrl.replace('drive://', '').split('&')[0];
              blob = await downloadDriveFileAsBlob(token!, fileId);
          } else if (isYouTubeUrl(rec.mediaUrl)) {
              window.open(rec.mediaUrl, '_blank');
              setDownloadingId(null);
              return;
          } else { throw new Error("Source file not available for direct download."); }
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = `${rec.channelTitle.replace(/\s+/g, '_')}_${rec.id}.webm`;
          document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      } catch (e: any) {
          window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: "Download failed: " + e.message, type: 'error' } }));
      } finally { setDownloadingId(null); }
  };

  const handlePlayback = async (rec: RecordingSession) => {
      if (resolvedMediaUrl?.startsWith('blob:')) { URL.revokeObjectURL(resolvedMediaUrl); }
      if (isYouTubeUrl(rec.mediaUrl)) {
          setResolvedMediaUrl(rec.mediaUrl); setActiveMediaId(rec.id); setActiveRecording(rec);
          return;
      }
      if (isDriveUrl(rec.mediaUrl) || (rec.driveUrl && isDriveUrl(rec.driveUrl))) {
          setResolvingId(rec.id);
          try {
              const token = getDriveToken() || await connectGoogleDrive();
              const driveUri = isDriveUrl(rec.mediaUrl) ? rec.mediaUrl : rec.driveUrl!;
              const fileId = driveUri.replace('drive://', '').split('&')[0];
              const streamUrl = getDriveFileStreamUrl(token, fileId);
              setResolvedMediaUrl(streamUrl); setActiveMediaId(rec.id); setActiveRecording(rec);
          } catch (e: any) {
              window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: "Drive Access Denied: " + e.message, type: 'error' } }));
          } finally { setResolvingId(null); }
      } else {
          if (rec.blob instanceof Blob) {
              const freshUrl = URL.createObjectURL(rec.blob);
              setResolvedMediaUrl(freshUrl); setActiveMediaId(rec.id); setActiveRecording(rec);
          } else {
              setResolvedMediaUrl(rec.mediaUrl); setActiveMediaId(rec.id); setActiveRecording(rec);
          }
      }
  };

  const closePlayer = () => {
    if (resolvedMediaUrl?.startsWith('blob:')) URL.revokeObjectURL(resolvedMediaUrl);
    setActiveMediaId(null); setResolvedMediaUrl(null); setActiveRecording(null);
  };

  const handleYouTubeSync = async (rec: any) => {
    if (!currentUser) return;
    if (isYouTubeUrl(rec.mediaUrl)) { window.open(rec.mediaUrl, '_blank'); return; }
    addSyncLog(`YouTube Sync Initialized: ${rec.channelTitle}`, 'info');
    let token = getDriveToken() || await signInWithGoogle().then(() => getDriveToken());
    if (!token) return;
    
    setSyncingId(rec.id);
    try {
        let videoBlob: Blob;
        const isFromDrive = isDriveUrl(rec.mediaUrl);
        const originalDriveUrl = isFromDrive ? rec.mediaUrl : rec.driveUrl;
        if (rec.blob instanceof Blob) videoBlob = rec.blob;
        else if (isFromDrive) {
            const fileId = rec.mediaUrl.replace('drive://', '').split('&')[0];
            videoBlob = await downloadDriveFileAsBlob(token!, fileId);
        } else { throw new Error("No available source."); }
        
        const ytId = await uploadToYouTube(token!, videoBlob, {
            title: `${rec.channelTitle} (Neural Archive)`,
            description: `Session recorded on ${new Date(rec.timestamp).toLocaleString()}`,
            privacyStatus: 'unlisted'
        });
        const videoUrl = getYouTubeVideoUrl(ytId);
        const sessionData: RecordingSession = {
            ...rec, userId: currentUser.uid, mediaUrl: videoUrl, driveUrl: originalDriveUrl || videoUrl, size: videoBlob.size
        };
        await saveRecordingReference(sessionData);
        addSyncLog("Ledger synced successfully.", 'success');
        loadData();
    } catch (e: any) { addSyncLog(`SYNC ERROR: ${e.message}`, 'error'); } 
    finally { setSyncingId(null); }
  };

  const handleDriveSync = async (rec: any) => {
    if (!currentUser || isDriveUrl(rec.mediaUrl)) return;
    addSyncLog(`Drive Backup Initialized: ${rec.channelTitle}`, 'info');
    let token = getDriveToken() || await signInWithGoogle().then(() => getDriveToken());
    if (!token) return;
    setSyncingId(rec.id);
    try {
        const videoBlob = rec.blob;
        if (!videoBlob) throw new Error("No local buffer available.");
        const folderId = await ensureCodeStudioFolder(token);
        const driveFileId = await uploadToDrive(token, folderId, `${rec.id}.webm`, videoBlob);
        const driveUrl = `drive://${driveFileId}`;
        const sessionData: RecordingSession = {
            ...rec, userId: currentUser.uid, mediaUrl: driveUrl, driveUrl: driveUrl, size: videoBlob.size
        };
        await saveRecordingReference(sessionData);
        addSyncLog("Drive backup successful.", 'success');
        loadData();
    } catch (e: any) { addSyncLog(`FAIL: ${e.message}`, 'error'); } 
    finally { setSyncingId(null); }
  };

  const handleDelete = async (rec: RecordingSession) => {
    setDeletingId(rec.id);
    try {
        const token = getDriveToken();
        const isCloud = !rec.mediaUrl.startsWith('blob:') && !rec.mediaUrl.startsWith('data:');
        if (!isCloud) { await deleteLocalRecording(rec.id); }
        else {
            const ytUri = isYouTubeUrl(rec.mediaUrl) ? rec.mediaUrl : (isYouTubeUrl(rec.driveUrl || '') ? rec.driveUrl : '');
            const driveUri = isDriveUrl(rec.mediaUrl) ? rec.mediaUrl : (isDriveUrl(rec.driveUrl || '') ? rec.driveUrl : '');
            if (ytUri && token) {
                const videoId = extractYouTubeId(ytUri);
                if (videoId) try { await deleteYouTubeVideo(token, videoId); } catch(e) {}
            }
            if (driveUri && token) {
                const fileId = driveUri.replace('drive://', '').split('&')[0];
                if (fileId) try { await deleteDriveFile(token, fileId); } catch(e) {}
            }
            await deleteRecordingReference(rec.id, rec.mediaUrl, rec.transcriptUrl);
        }
        setRecordings(prev => prev.filter(r => r.id !== rec.id));
        addSyncLog("Recording purged.", 'info');
    } catch (e: any) { addSyncLog("Purge failed: " + e.message, 'error'); } 
    finally { setDeletingId(null); }
  };

  const handleTopicClick = (topic: typeof TOPIC_PRESETS[0]) => {
      setSelectedTopic(topic.id);
      const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      setMeetingTitle(`${topic.label} [${dateStr}]`);
      
      // Sensible defaults based on topic
      if (topic.id === 'arch' || topic.id === 'sys') setRecordingDuration(1800); // 30m
      else if (topic.id === 'gen') setRecordingDuration(600); // 10m
  };

  const handleStartQuickRecording = () => {
    const defaultChannel: Channel = HANDCRAFTED_CHANNELS[0]; 
    if (onStartLiveSession) {
        const context = selectedTopic ? `[TOPIC]: ${selectedTopic}\n[CONTEXT]: Scribe session regarding ${meetingTitle}` : undefined;
        // Inject meetingTitle as the sessionTitle argument
        onStartLiveSession(defaultChannel, context, true, undefined, undefined, undefined, undefined, recordingDuration, interactionEnabled, recordingTarget, meetingTitle);
    }
    setIsRecorderModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="w-2 h-6 bg-red-500 rounded-full"></span>
            <span>Recordings Archive</span>
            {onOpenManual && <button onClick={onOpenManual} className="p-1 text-slate-600 hover:text-white transition-colors" title="Recordings Manual"><Info size={16}/></button>}
          </h2>
          <div className="flex items-center gap-3 mt-1">
             <p className="text-xs text-slate-500">Sovereign meeting logs and neural evaluations.</p>
             {loading && (
                 <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-900/40 border border-indigo-500/20 rounded-full animate-pulse">
                    <Loader2 size={10} className="animate-spin text-indigo-400"/>
                    <span className="text-[8px] font-black uppercase text-indigo-300 tracking-widest">{phase === 'local' ? 'Scanning Ledger' : 'Polling Cloud'}...</span>
                 </div>
             )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsRecorderModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors text-xs font-bold shadow-lg"
          >
            <Plus size={14} /><span>Start Scribe</span>
          </button>
          <button onClick={loadData} className="p-2 text-slate-400 hover:text-white transition-colors bg-slate-950 rounded-lg border border-slate-800">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading && recordings.length === 0 ? (
        <div className="py-32 flex flex-col items-center justify-center text-red-400 gap-8">
          <div className="relative">
              <div className="w-16 h-16 border-4 border-red-500/10 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <div className="text-center space-y-4">
              <span className="text-xs font-black uppercase tracking-widest animate-pulse block">Handshaking Secure Registry...</span>
              <p className="text-[10px] text-slate-600 uppercase font-bold tracking-widest">Phase: {phase.toUpperCase()}</p>
              
              <button 
                onClick={() => setLoading(false)}
                className="mt-6 px-6 py-2 bg-slate-900 hover:bg-slate-800 text-slate-500 hover:text-indigo-400 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border border-slate-800"
              >
                Bypass Waiting Nodes
              </button>
          </div>
        </div>
      ) : error && recordings.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-red-400 bg-red-900/10 rounded-3xl border border-red-900/30 gap-4 text-center px-6">
              <AlertCircle size={48} className="opacity-50" />
              <div className="space-y-1">
                  <p className="font-bold">Handshake Interrupted</p>
                  <p className="text-xs opacity-80 max-sm">{error}</p>
              </div>
              <button onClick={loadData} className="mt-4 px-6 py-2 bg-red-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg">Retry Handshake</button>
          </div>
      ) : recordings.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-500 bg-slate-900/30 rounded-3xl border-2 border-dashed border-slate-800">
          <Video size={48} className="mb-4 opacity-10" />
          <p className="font-bold text-lg text-white">Archive Empty</p>
          <p className="text-xs mt-2">Recorded meeting sessions will manifest here.</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-950/50 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Session</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest hidden md:table-cell">Origin</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Mass</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Timestamp (PST)</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-500 tracking-widest">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {recordings.map((rec) => {
                  const isYT = isYouTubeUrl(rec.mediaUrl);
                  const isDrive = isDriveUrl(rec.mediaUrl);
                  const pstString = formatPST(rec.timestamp);
                  return (
                    <tr key={rec.id} className="group hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-10 rounded-lg bg-slate-800 overflow-hidden relative shrink-0 border border-slate-700">
                             {rec.channelImage && !rec.channelImage.includes('ui-avatars.com') ? (
                               <img src={rec.channelImage} alt="" className="w-full h-full object-cover opacity-60" />
                             ) : null}
                             <div className={`w-full h-full flex items-center justify-center text-slate-700 ${rec.channelImage && !rec.channelImage.includes('ui-avatars.com') ? 'hidden' : ''}`}><FileVideo size={20}/></div>
                             <button onClick={() => handlePlayback(rec)} disabled={resolvingId === rec.id} className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/0 transition-colors group/play">
                                {resolvingId === rec.id ? <Loader2 size={16} className="animate-spin text-white"/> : <Play size={16} fill="white" className="text-white opacity-0 group-hover/play:opacity-100 transition-opacity" />}
                             </button>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate" title={rec.channelTitle}>{rec.channelTitle}</p>
                            <p className="text-[10px] text-slate-500 font-mono tracking-tighter">ID: {rec.id.substring(0,12)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <div className="flex items-center gap-2">
                           {isYT ? (
                             <div className="bg-red-600/20 text-red-500 px-3 py-1 rounded-full border border-red-500/30 text-[9px] font-black uppercase flex items-center gap-1.5 shadow-lg shadow-red-900/10"><Youtube size={12} fill="currentColor"/><span>YouTube Archive</span></div>
                           ) : isDrive ? (
                             <div className="bg-indigo-900/20 text-indigo-400 px-3 py-1 rounded-full border border-indigo-500/30 text-[9px] font-black uppercase flex items-center gap-1.5"><HardDrive size={12}/><span>Google Drive</span></div>
                           ) : (
                             <div className="bg-amber-900/20 text-amber-500 px-3 py-1 rounded-full border border-amber-500/30 text-[9px] font-black uppercase flex items-center gap-1.5"><Database size={12}/><span>Local Cache</span></div>
                           )}
                        </div>
                      </td>
                      <td className="px-6 py-4"><span className="text-xs font-mono font-black text-indigo-400">{formatSize(rec.size || rec.blob?.size)}</span></td>
                      <td className="px-6 py-4"><div className="flex flex-col"><span className="text-xs text-slate-300 font-bold">{pstString.split(',')[0]}</span><span className="text-[10px] text-slate-500 uppercase">{pstString.split(',')[1]}</span></div></td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isYT ? (
                            <a href={rec.mediaUrl} target="_blank" rel="noreferrer" className="p-2 bg-slate-800 hover:bg-red-600 text-red-400 hover:text-white rounded-lg transition-all border border-slate-700 shadow-md" title="Watch on YouTube"><ExternalLink size={16}/></a>
                          ) : (
                            <button onClick={() => handleYouTubeSync(rec)} disabled={syncingId === rec.id} className="p-2 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white rounded-lg transition-all shadow-md" title="Sync to YouTube">{syncingId === rec.id ? <Loader2 size={16} className="animate-spin"/> : <Youtube size={16} />}</button>
                          )}
                          {!isDrive && !isYT && (
                            <button onClick={() => handleDriveSync(rec)} disabled={syncingId === rec.id} className="p-2 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-lg transition-all" title="Sync to Drive">{syncingId === rec.id ? <Loader2 size={16} className="animate-spin"/> : <CloudUpload size={16} />}</button>
                          )}
                          <button onClick={() => handleShare(rec)} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-all" title="Share URI"><Share2 size={16} /></button>
                          <button onClick={() => handleDownloadToDevice(rec)} disabled={downloadingId === rec.id} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-all" title="Download Asset">{downloadingId === rec.id ? <Loader2 size={16} className="animate-spin"/> : <Download size={16} />}</button>
                          <button onClick={() => handleDelete(rec)} disabled={deletingId === rec.id} className="p-2 bg-slate-800 hover:bg-red-600 text-slate-400 hover:text-white rounded-lg transition-all" title="Purge Node">{deletingId === rec.id ? <Loader2 size={16} className="animate-spin"/> : <Trash2 size={16} />}</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isRecorderModalOpen && (
          <div className="fixed inset-0 z-40 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
              <div className="bg-slate-900 border border-slate-700 rounded-[2.5rem] w-full max-w-xl shadow-2xl overflow-hidden animate-fade-in-up">
                  <div className="p-6 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                          <div className="p-2 bg-red-600/10 rounded-xl text-red-500 border border-red-500/20"><Video size={20}/></div>
                          <h3 className="text-lg font-black text-white italic uppercase tracking-widest">Neural Scribe Setup</h3>
                      </div>
                      <button onClick={() => setIsRecorderModalOpen(false)} className="p-2 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white transition-colors"><X size={20}/></button>
                  </div>
                  <div className="p-8 space-y-8 max-h-[80vh] overflow-y-auto scrollbar-hide">
                      
                      <div className="space-y-4">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">1. Logic Sector (Topic)</label>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {TOPIC_PRESETS.map(t => (
                                  <button 
                                    key={t.id} 
                                    onClick={() => handleTopicClick(t)}
                                    className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 group ${selectedTopic === t.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-indigo-500/50'}`}
                                  >
                                      <t.icon size={20} className={selectedTopic === t.id ? 'text-white' : t.color} />
                                      <span className="text-[9px] font-black uppercase tracking-tighter">{t.label}</span>
                                  </button>
                              ))}
                          </div>
                      </div>

                      <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">2. Session Identity (Title)</label>
                          <div className="relative">
                            <input 
                                type="text" 
                                placeholder="e.g. Q1 Architecture Review" 
                                value={meetingTitle} 
                                onChange={e => setMeetingTitle(e.target.value)} 
                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-4 text-white text-sm outline-none focus:ring-2 focus:ring-red-500 shadow-inner"
                            />
                            {selectedTopic && <Sparkles className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-400 animate-pulse" size={16}/>}
                          </div>
                      </div>

                      <div className="space-y-4">
                          <div className="flex justify-between items-center px-1">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">3. Temporal Limit (Recording Time)</label>
                              <span className="text-xs font-black text-indigo-400 bg-indigo-900/30 px-2 py-0.5 rounded border border-indigo-500/20">{Math.floor(recordingDuration / 60)}m {recordingDuration % 60}s</span>
                          </div>
                          <input type="range" min="30" max="3600" step="30" value={recordingDuration} onChange={e => setRecordingDuration(parseInt(e.target.value))} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500" />
                          <div className="flex justify-between text-[8px] font-black text-slate-600 uppercase tracking-tighter px-1">
                             <span>30s</span>
                             <span>15m</span>
                             <span>30m</span>
                             <span>45m</span>
                             <span>60m</span>
                          </div>
                      </div>

                      <div className="space-y-4">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">4. Target Vault (Storage)</label>
                          <div className="flex p-1 bg-slate-950 rounded-2xl border border-slate-800 shadow-inner">
                              <button 
                                onClick={() => setRecordingTarget('drive')}
                                className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all ${recordingTarget === 'drive' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                              >
                                  <HardDrive size={14}/> Sovereign Drive
                              </button>
                              <button 
                                onClick={() => setRecordingTarget('youtube')}
                                className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all ${recordingTarget === 'youtube' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                              >
                                  <Youtube size={14}/> Neural Archive
                              </button>
                          </div>
                          <p className="px-2 text-[8px] font-black text-slate-600 uppercase tracking-widest leading-relaxed">
                              {recordingTarget === 'drive' 
                                ? 'Artifacts sharded across your personal Google Drive account.' 
                                : 'Artifacts streamed directly to your unlisted YouTube channel.'}
                          </p>
                      </div>

                      <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">5. Capture Modalities</label>
                          <div className="grid grid-cols-1 gap-2">
                               <button onClick={() => setInteractionEnabled(!interactionEnabled)} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${interactionEnabled ? 'bg-amber-600/10 border-amber-500 text-amber-300 shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
                                   <div className="flex items-center gap-3">{interactionEnabled ? <MessageSquare size={18}/> : <MessageSquareOff size={18}/>}<div className="text-left"><span className="text-[10px] font-bold uppercase tracking-widest block">AI Voice Interaction</span><span className="text-[8px] font-black uppercase opacity-60">{interactionEnabled ? 'Refractive Logic On' : 'Silent Scribe Only'}</span></div></div>
                                   <div className={`w-8 h-4 rounded-full relative transition-colors ${interactionEnabled ? 'bg-amber-500' : 'bg-slate-800'}`}><div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${interactionEnabled ? 'right-0.5' : 'left-0.5'}`}></div></div>
                               </button>
                               <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => setRecordScreen(!recordScreen)} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${recordScreen ? 'bg-indigo-600/10 border-indigo-500 text-indigo-300 shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-600'}`}>
                                        <div className="flex items-center gap-2"><Monitor size={16}/><span className="text-[10px] font-bold uppercase tracking-widest">Screen</span></div>
                                        <div className={`w-6 h-3 rounded-full relative transition-colors ${recordScreen ? 'bg-indigo-500' : 'bg-slate-800'}`}><div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all ${recordScreen ? 'right-0.5' : 'left-0.5'}`}></div></div>
                                    </button>
                                    <button onClick={() => setRecordCamera(!recordCamera)} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${recordCamera ? 'bg-pink-600/10 border-pink-500 text-pink-300 shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-600'}`}>
                                        <div className="flex items-center gap-2"><Camera size={16}/><span className="text-[10px] font-bold uppercase tracking-widest">Camera</span></div>
                                        <div className={`w-6 h-3 rounded-full relative transition-colors ${recordCamera ? 'bg-pink-500' : 'bg-slate-800'}`}><div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all ${recordCamera ? 'right-0.5' : 'left-0.5'}`}></div></div>
                                    </button>
                               </div>
                          </div>
                      </div>

                      <div className="bg-amber-900/10 border border-amber-500/30 p-4 rounded-2xl space-y-2">
                          <div className="flex items-center gap-2 text-amber-500"><AlertCircle size={14} /><h4 className="text-[10px] font-black uppercase tracking-widest">Hardware Handshake Alert</h4></div>
                          <p className="text-[9px] text-slate-300 leading-relaxed font-bold uppercase">Mac Users: Ensure "Share system audio" is active in the browser prompt to capture internal sound sources.</p>
                      </div>

                      <button onClick={handleStartQuickRecording} disabled={!meetingTitle.trim()} className="w-full py-5 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-red-900/40 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-30">
                          <Play size={20} fill="currentColor"/> Begin Neural Scribe
                      </button>
                  </div>
              </div>
          </div>
      )}

      {activeMediaId && activeRecording && (
          <div className="fixed inset-0 z-40 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 sm:p-10 animate-fade-in">
              <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden shadow-2xl flex flex-col h-full max-h-[85vh]">
                  <div className="p-6 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center shrink-0">
                      <div className="flex items-center gap-4">
                          <div className="p-3 bg-red-600 rounded-2xl text-white shadow-lg shadow-red-900/20"><Video size={24}/></div>
                          <div><h2 className="text-xl font-black text-white italic tracking-tighter uppercase">{activeRecording.channelTitle}</h2><div className="flex items-center gap-4 mt-1 text-[10px] font-black text-slate-500 uppercase tracking-widest"><span className="flex items-center gap-1"><Calendar size={12}/> {formatPST(activeRecording.timestamp).split(',')[0]}</span><span className="flex items-center gap-1"><HardDrive size={12}/> 
                          {/* Fix: changed 'rec' to 'activeRecording' to resolve Error in file components/RecordingList.tsx on line 607 */}
                          {formatSize(activeRecording.size || activeRecording.blob?.size)}
                          </span></div></div>
                      </div>
                      <button onClick={closePlayer} className="p-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl transition-all active:scale-95 shadow-lg"><X size={24}/></button>
                  </div>
                  <div className="flex-1 bg-black relative flex items-center justify-center">
                    {resolvedMediaUrl ? (isYouTubeUrl(resolvedMediaUrl) ? (<iframe src={getYouTubeEmbedUrl(extractYouTubeId(resolvedMediaUrl)!)} className="w-full h-full border-none" allowFullScreen />) : (<video src={resolvedMediaUrl} controls autoPlay playsInline className="w-full h-full object-contain" />)) : (<div className="flex flex-col items-center gap-4"><Loader2 size={48} className="animate-spin text-red-500" /><span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Buffering Neural Stream...</span></div>)}
                  </div>
                  <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-center gap-4 shrink-0">
                      <button onClick={() => handleDownloadToDevice(activeRecording)} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 transition-all flex items-center gap-2"><Download size={14}/> Download Asset</button>
                      <button onClick={() => handleShare(activeRecording)} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2"><Share2 size={14}/> Share Link</button>
                  </div>
              </div>
          </div>
      )}
      
      {showShareModal && shareUrl && (
          <ShareModal 
            isOpen={true} onClose={() => setShowShareModal(false)}
            link={shareUrl} title={sharingTitle}
            onShare={async () => {}} currentUserUid={currentUser?.uid}
          />
      )}
    </div>
  );
};
