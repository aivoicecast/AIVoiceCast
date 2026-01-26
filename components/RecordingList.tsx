
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { RecordingSession, Channel, TranscriptItem, UserProfile, ViewID } from '../types';
import { getUserRecordings, deleteRecordingReference, saveRecordingReference, getUserProfile } from '../services/firestoreService';
import { getLocalRecordings, deleteLocalRecording } from '../utils/db';
import { Play, FileText, Trash2, Calendar, Clock, Loader2, Video, X, HardDriveDownload, Sparkles, Mic, Monitor, CheckCircle, Languages, AlertCircle, ShieldOff, Volume2, Camera, Youtube, ExternalLink, HelpCircle, Info, Link as LinkIcon, Copy, CloudUpload, HardDrive, LogIn, Check, Terminal, Activity, ShieldAlert, History, Zap, Download, Share2, Square, CheckSquare, Pause, Search, Plus, RefreshCw, ChevronRight, FileVideo, Database } from 'lucide-react';
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
    activeSegment?: { index: number, lectureId: string }
  ) => void;
}

interface SyncLog {
    time: string;
    msg: string;
    type: 'info' | 'error' | 'warn' | 'success';
}

const formatSize = (bytes?: number) => {
    if (bytes === undefined || bytes === null || bytes === 0) return '---';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

export const RecordingList: React.FC<RecordingListProps> = ({ onBack, onStartLiveSession }) => {
  const [recordings, setRecordings] = useState<RecordingSession[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);
  const [resolvedMediaUrl, setResolvedMediaUrl] = useState<string | null>(null);
  const [activeRecording, setActiveRecording] = useState<RecordingSession | null>(null);
  
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const [isRecorderModalOpen, setIsRecorderModalOpen] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [recordCamera, setRecordCamera] = useState(true);
  const [recordScreen, setRecordScreen] = useState(true);

  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [sharingTitle, setSharingTitle] = useState('');

  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [showSyncLog, setShowSyncLog] = useState(false);

  const currentUser = auth?.currentUser;

  const addSyncLog = (msg: string, type: SyncLog['type'] = 'info') => {
      const time = new Date().toLocaleTimeString();
      setSyncLogs(prev => [{ time, msg, type }, ...prev].slice(0, 50));
      console.log(`[Sync Diagnostic] ${msg}`);
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
    setLoading(true);
    try {
      let all: RecordingSession[] = [];
      const local = await getLocalRecordings();
      all = [...local];
      
      if (currentUser?.uid) {
          try {
              const cloud = await getUserRecordings(currentUser.uid);
              all = [...all, ...cloud];
          } catch (e: any) {
              console.warn("Cloud recordings unavailable:", e);
          }
      }
      
      const unique = Array.from(new Map(all.map(item => [item.id, item])).values());
      setRecordings(unique.sort((a, b) => b.timestamp - a.timestamp));
    } catch (e: any) {
      console.error("Failed to load recording archive:", e);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const isYouTubeUrl = (url?: string) => !!url && (url.includes('youtube.com') || url.includes('youtu.be'));
  const isDriveUrl = (url?: string) => !!url && (url.startsWith('drive://') || url.includes('drive.google.com'));

  const extractYouTubeId = (url: string): string | null => {
      try {
          const urlObj = new URL(url);
          if (urlObj.hostname.includes('youtube.com')) {
              return urlObj.searchParams.get('v');
          } else if (urlObj.hostname.includes('youtu.be')) {
              return urlObj.pathname.slice(1);
          }
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
          if (rec.blob instanceof Blob) {
              blob = rec.blob;
          } else if (isDriveUrl(rec.mediaUrl)) {
              const token = getDriveToken() || await signInWithGoogle().then(() => getDriveToken());
              if (!token) throw new Error("Google access required.");
              const fileId = rec.mediaUrl.replace('drive://', '').split('&')[0];
              blob = await downloadDriveFileAsBlob(token, fileId);
          } else if (isYouTubeUrl(rec.mediaUrl)) {
              window.open(rec.mediaUrl, '_blank');
              setDownloadingId(null);
              return;
          } else {
              throw new Error("Source file not available for direct download.");
          }

          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${rec.channelTitle.replace(/\s+/g, '_')}_${rec.id}.webm`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
      } catch (e: any) {
          window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: "Download failed: " + e.message, type: 'error' } }));
      } finally {
          setDownloadingId(null);
      }
  };

  const handlePlayback = async (rec: RecordingSession) => {
      if (resolvedMediaUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(resolvedMediaUrl);
      }

      if (isYouTubeUrl(rec.mediaUrl)) {
          setResolvedMediaUrl(rec.mediaUrl);
          setActiveMediaId(rec.id);
          setActiveRecording(rec);
          return;
      }

      if (isDriveUrl(rec.mediaUrl) || (rec.driveUrl && isDriveUrl(rec.driveUrl))) {
          setResolvingId(rec.id);
          try {
              const token = getDriveToken() || await connectGoogleDrive();
              const driveUri = isDriveUrl(rec.mediaUrl) ? rec.mediaUrl : rec.driveUrl!;
              const fileId = driveUri.replace('drive://', '').split('&')[0];
              const streamUrl = getDriveFileStreamUrl(token, fileId);
              setResolvedMediaUrl(streamUrl);
              setActiveMediaId(rec.id);
              setActiveRecording(rec);
          } catch (e: any) {
              window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: "Drive Access Denied: " + e.message, type: 'error' } }));
          } finally {
              setResolvingId(null);
          }
      } else {
          if (rec.blob instanceof Blob) {
              const freshUrl = URL.createObjectURL(rec.blob);
              setResolvedMediaUrl(freshUrl);
              setActiveMediaId(rec.id);
              setActiveRecording(rec);
          } else {
              setResolvedMediaUrl(rec.mediaUrl);
              setActiveMediaId(rec.id);
              setActiveRecording(rec);
          }
      }
  };

  const closePlayer = () => {
    if (resolvedMediaUrl?.startsWith('blob:')) URL.revokeObjectURL(resolvedMediaUrl);
    setActiveMediaId(null);
    setResolvedMediaUrl(null);
    setActiveRecording(null);
  };

  const handleYouTubeSync = async (rec: any) => {
    if (!currentUser) return;
    if (isYouTubeUrl(rec.mediaUrl)) {
        window.open(rec.mediaUrl, '_blank');
        return;
    }
    
    setShowSyncLog(true);
    setSyncLogs([]);
    addSyncLog(`YouTube Sync Initialized: ${rec.channelTitle}`, 'info');

    let token = getDriveToken();
    if (!token) {
        addSyncLog("Handshake required for YouTube access...", 'warn');
        const user = await signInWithGoogle();
        if (!user) {
            addSyncLog("Handshake aborted.", 'error');
            return;
        }
        token = getDriveToken();
    }

    setSyncingId(rec.id);
    try {
        let videoBlob: Blob;
        const isFromDrive = isDriveUrl(rec.mediaUrl);
        const originalDriveUrl = isFromDrive ? rec.mediaUrl : rec.driveUrl;
        
        if (rec.blob instanceof Blob) {
            addSyncLog("Loading local buffer...", 'info');
            videoBlob = rec.blob;
        } else if (isFromDrive) {
            addSyncLog("Streaming source from Google Drive...", 'info');
            const fileId = rec.mediaUrl.replace('drive://', '').split('&')[0];
            videoBlob = await downloadDriveFileAsBlob(token!, fileId);
        } else {
            throw new Error("No available source for this recording.");
        }

        addSyncLog("Publishing to YouTube (Unlisted)...", 'info');
        const ytId = await uploadToYouTube(token!, videoBlob, {
            title: `${rec.channelTitle} (Neural Archive)`,
            description: `Session recorded on ${new Date(rec.timestamp).toLocaleString()}`,
            privacyStatus: 'unlisted'
        });
        const videoUrl = getYouTubeVideoUrl(ytId);
        addSyncLog(`YouTube Link Finalized: ${ytId}`, 'success');

        addSyncLog("Updating persistent ledger...", 'info');
        const sessionData: RecordingSession = {
            ...rec,
            userId: currentUser.uid,
            mediaUrl: videoUrl,
            driveUrl: originalDriveUrl || videoUrl,
            size: videoBlob.size
        };
        
        await saveRecordingReference(sessionData);
        addSyncLog("Ledger synced successfully.", 'success');
        
        setTimeout(() => {
            loadData();
            setSyncingId(null);
        }, 800);
        
    } catch (e: any) {
        addSyncLog(`SYNC ERROR: ${e.message}`, 'error');
        setSyncingId(null);
    }
  };

  const handleDriveSync = async (rec: any) => {
    if (!currentUser || isDriveUrl(rec.mediaUrl)) return;
    
    setShowSyncLog(true);
    setSyncLogs([]);
    addSyncLog(`Drive Backup Initialized: ${rec.channelTitle}`, 'info');

    let token = getDriveToken() || await signInWithGoogle().then(() => getDriveToken());
    if (!token) return addSyncLog("Sync aborted.", 'error');

    setSyncingId(rec.id);
    try {
        const videoBlob = rec.blob;
        if (!videoBlob) throw new Error("No local buffer available.");

        const folderId = await ensureCodeStudioFolder(token);
        addSyncLog("Uploading to secure cloud vault...", 'info');
        const driveFileId = await uploadToDrive(token, folderId, `${rec.id}.webm`, videoBlob);
        const driveUrl = `drive://${driveFileId}`;
        
        const sessionData: RecordingSession = {
            ...rec,
            userId: currentUser.uid,
            mediaUrl: driveUrl,
            driveUrl: driveUrl,
            size: videoBlob.size
        };
        
        await saveRecordingReference(sessionData);
        addSyncLog("Drive backup successful.", 'success');
        
        setTimeout(() => { loadData(); setSyncingId(null); }, 800);
    } catch (e: any) {
        addSyncLog(`FAIL: ${e.message}`, 'error');
        setSyncingId(null);
    }
  };

  const purgeRecordingAssets = async (rec: RecordingSession, token: string | null) => {
    const isCloud = !rec.mediaUrl.startsWith('blob:') && !rec.mediaUrl.startsWith('data:');
    if (!isCloud) {
        await deleteLocalRecording(rec.id);
        return;
    }

    const ytUri = isYouTubeUrl(rec.mediaUrl) ? rec.mediaUrl : (isYouTubeUrl(rec.driveUrl || '') ? rec.driveUrl : '');
    const driveUri = isDriveUrl(rec.mediaUrl) ? rec.mediaUrl : (isDriveUrl(rec.driveUrl || '') ? rec.driveUrl : '');
    const transcriptUri = isDriveUrl(rec.transcriptUrl) ? rec.transcriptUrl : '';

    if (ytUri && token) {
        const videoId = extractYouTubeId(ytUri);
        if (videoId) {
            try { await deleteYouTubeVideo(token, videoId); } catch (e: any) {}
        }
    }

    if (driveUri && token) {
        const fileId = driveUri.replace('drive://', '').split('&')[0];
        if (fileId) {
            try { await deleteDriveFile(token, fileId); } catch (e: any) {}
        }
    }

    if (transcriptUri && token) {
        const tFileId = transcriptUri.replace('drive://', '').split('&')[0];
        if (tFileId) {
            try { await deleteDriveFile(token, tFileId); } catch (e: any) {}
        }
    }

    await deleteRecordingReference(rec.id, rec.mediaUrl, rec.transcriptUrl);
  };

  const handleDelete = async (rec: RecordingSession) => {
    // Confirmation removed for seamless experience
    setDeletingId(rec.id);
    try {
        const token = getDriveToken();
        await purgeRecordingAssets(rec, token);
        setRecordings(prev => prev.filter(r => r.id !== rec.id));
        window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: "Recording purged from sovereign vault.", type: 'info' } }));
    } catch (e: any) {
        window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: "Purge failed: " + e.message, type: 'error' } }));
    } finally {
        setDeletingId(null);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    // Confirmation removed for seamless experience

    setIsBulkDeleting(true);
    const token = getDriveToken();
    try {
      for (const id of Array.from(selectedIds)) {
        const rec = recordings.find(r => r.id === id);
        if (rec) await purgeRecordingAssets(rec, token);
      }
      setRecordings(prev => prev.filter(r => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleStartQuickRecording = () => {
    const defaultChannel: Channel = HANDCRAFTED_CHANNELS[0]; 
    if (onStartLiveSession) {
        onStartLiveSession(defaultChannel, meetingTitle || "Manual Meeting Scribe", true, undefined, recordScreen, recordCamera);
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
          </h2>
          <p className="text-xs text-slate-500 mt-1">Sovereign meeting logs and neural evaluations.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsRecorderModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors text-xs font-bold shadow-lg"
          >
            <Plus size={14} /><span>Start Scribe</span>
          </button>
          {selectedIds.size > 0 && (
            <button 
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white rounded-lg transition-all text-xs font-bold border border-red-500/20"
            >
              {isBulkDeleting ? <Loader2 size={14} className="animate-spin"/> : <Trash2 size={14}/>}
              <span>Delete {selectedIds.size}</span>
            </button>
          )}
          <button onClick={loadData} className="p-2 text-slate-400 hover:text-white transition-colors bg-slate-900 rounded-lg border border-slate-800">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-red-400 gap-4">
          <Loader2 className="animate-spin" size={32} />
          <span className="text-xs font-bold uppercase tracking-widest animate-pulse">Scanning Neural Archives...</span>
        </div>
      ) : recordings.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-500 bg-slate-900/30 rounded-3xl border-2 border-dashed border-slate-800">
          <Video size={48} className="mb-4 opacity-10" />
          <p className="font-bold">The archive is empty.</p>
          <p className="text-xs mt-2">Meeting sessions you record will appear here.</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-950/50 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4 w-12">
                    <button onClick={() => {
                      if (selectedIds.size === recordings.length) setSelectedIds(new Set());
                      else setSelectedIds(new Set(recordings.map(r => r.id)));
                    }} className="p-1 hover:bg-slate-800 rounded">
                      <CheckSquare size={16} className={selectedIds.size === recordings.length ? 'text-red-500' : 'text-slate-600'} />
                    </button>
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Session</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest hidden md:table-cell">Origin</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Size</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Date (PST)</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-500 tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {recordings.map((rec) => {
                  const isSelected = selectedIds.has(rec.id);
                  const isYT = isYouTubeUrl(rec.mediaUrl);
                  const isDrive = isDriveUrl(rec.mediaUrl);
                  const pstString = formatPST(rec.timestamp);
                  
                  return (
                    <tr key={rec.id} className={`group hover:bg-slate-800/30 transition-colors ${isSelected ? 'bg-red-900/5' : ''}`}>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => toggleSelection(rec.id)} 
                          className={`p-1.5 rounded-lg border transition-all ${isSelected ? 'bg-red-600 border-red-500 text-white' : 'border-slate-700 text-slate-600'}`}
                        >
                          <Check size={14} strokeWidth={isSelected ? 4 : 2}/>
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-10 rounded-lg bg-slate-800 overflow-hidden relative shrink-0 border border-slate-700">
                             {rec.channelImage ? (
                               <img src={rec.channelImage} alt="" className="w-full h-full object-cover opacity-60" />
                             ) : (
                               <div className="w-full h-full flex items-center justify-center text-slate-700"><FileVideo size={20}/></div>
                             )}
                             <button 
                                onClick={() => handlePlayback(rec)}
                                disabled={resolvingId === rec.id}
                                className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/0 transition-colors group/play"
                             >
                                {resolvingId === rec.id ? <Loader2 size={16} className="animate-spin text-white"/> : <Play size={16} fill="white" className="text-white opacity-0 group-hover/play:opacity-100 transition-opacity" />}
                             </button>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate" title={rec.channelTitle}>{rec.channelTitle}</p>
                            <p className="text-[10px] text-slate-500 font-mono">ID: {rec.id.substring(0,8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <div className="flex items-center gap-2">
                           {isYT ? (
                             <div className="bg-red-600/20 text-red-500 px-3 py-1 rounded-full border border-red-500/30 text-[9px] font-black uppercase flex items-center gap-1.5 shadow-lg shadow-red-900/10">
                               <Youtube size={12} fill="currentColor"/> 
                               <span>YouTube Archive</span>
                             </div>
                           ) : isDrive ? (
                             <div className="bg-indigo-900/20 text-indigo-400 px-3 py-1 rounded-full border border-indigo-500/30 text-[9px] font-black uppercase flex items-center gap-1.5">
                               <HardDrive size={12}/> 
                               <span>Google Drive</span>
                             </div>
                           ) : (
                             <div className="bg-amber-900/20 text-amber-500 px-3 py-1 rounded-full border border-amber-500/30 text-[9px] font-black uppercase flex items-center gap-1.5">
                               <Database size={12}/> 
                               <span>Local Cache</span>
                             </div>
                           )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                         <span className="text-xs font-mono font-black text-indigo-400">{formatSize(rec.size || rec.blob?.size)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                           <span className="text-xs text-slate-300">{pstString.split(',')[0]}</span>
                           <span className="text-[10px] text-slate-500 uppercase">{pstString.split(',')[1]}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isYT ? (
                            <a 
                                href={rec.mediaUrl} 
                                target="_blank" 
                                rel="noreferrer"
                                className="p-2 bg-slate-800 hover:bg-red-600 text-red-400 hover:text-white rounded-lg transition-all border border-slate-700 shadow-md"
                                title="Watch on YouTube"
                            >
                                <ExternalLink size={16}/>
                            </a>
                          ) : (
                            <button 
                              onClick={() => handleYouTubeSync(rec)} 
                              disabled={syncingId === rec.id}
                              className="p-2 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white rounded-lg transition-all shadow-md"
                              title="Sync to YouTube"
                            >
                              {syncingId === rec.id ? <Loader2 size={16} className="animate-spin"/> : <Youtube size={16} />}
                            </button>
                          )}
                          {!isDrive && !isYT && (
                            <button 
                              onClick={() => handleDriveSync(rec)} 
                              disabled={syncingId === rec.id}
                              className="p-2 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-lg transition-all"
                              title="Sync to Drive"
                            >
                              {syncingId === rec.id ? <Loader2 size={16} className="animate-spin"/> : <CloudUpload size={16} />}
                            </button>
                          )}
                          <button 
                            onClick={() => handleShare(rec)} 
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-all"
                            title="Share"
                          >
                            <Share2 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDownloadToDevice(rec)} 
                            disabled={downloadingId === rec.id}
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-all"
                            title="Download"
                          >
                            {downloadingId === rec.id ? <Loader2 size={16} className="animate-spin"/> : <Download size={16} />}
                          </button>
                          <button 
                            onClick={() => handleDelete(rec)} 
                            disabled={deletingId === rec.id}
                            className="p-2 bg-slate-800 hover:bg-red-600 text-slate-400 hover:text-white rounded-lg transition-all"
                            title="Delete"
                          >
                            {deletingId === rec.id ? <Loader2 size={16} className="animate-spin"/> : <Trash2 size={16} />}
                          </button>
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

      {/* Playback Modal */}
      {activeMediaId && activeRecording && (
          <div className="fixed inset-0 z-[250] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 sm:p-10 animate-fade-in">
              <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden shadow-2xl flex flex-col h-full max-h-[85vh]">
                  <div className="p-6 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center shrink-0">
                      <div className="flex items-center gap-4">
                          <div className="p-3 bg-red-600 rounded-xl text-white shadow-lg shadow-red-900/20"><Video size={24}/></div>
                          <div>
                              <h2 className="text-xl font-black text-white italic tracking-tighter uppercase">{activeRecording.channelTitle}</h2>
                              <div className="flex items-center gap-4 mt-1 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                  <span className="flex items-center gap-1"><Calendar size={12}/> {formatPST(activeRecording.timestamp).split(',')[0]}</span>
                                  <span className="flex items-center gap-1"><HardDrive size={12}/> {formatSize(activeRecording.size || activeRecording.blob?.size)}</span>
                              </div>
                          </div>
                      </div>
                      <button onClick={closePlayer} className="p-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl transition-all active:scale-95"><X size={24}/></button>
                  </div>
                  <div className="flex-1 bg-black relative flex items-center justify-center">
                    {resolvedMediaUrl ? (
                      isYouTubeUrl(resolvedMediaUrl) ? (
                        <iframe 
                          src={getYouTubeEmbedUrl(extractYouTubeId(resolvedMediaUrl)!)} 
                          className="w-full h-full border-none"
                          allowFullScreen
                        />
                      ) : (
                        <video 
                          src={resolvedMediaUrl} 
                          controls 
                          autoPlay 
                          playsInline
                          className="w-full h-full object-contain"
                        />
                      )
                    ) : (
                      <div className="flex flex-col items-center gap-4">
                        <Loader2 size={48} className="animate-spin text-red-500" />
                        <span className="text-xs font-black uppercase tracking-widest text-slate-500">Buffering Neural Stream...</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-center gap-4 shrink-0">
                      <button onClick={() => handleDownloadToDevice(activeRecording)} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 transition-all flex items-center gap-2"><Download size={14}/> Download Asset</button>
                      <button onClick={() => handleShare(activeRecording)} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2"><Share2 size={14}/> Share Link</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
