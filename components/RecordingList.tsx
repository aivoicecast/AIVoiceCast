
import React, { useState, useEffect } from 'react';
import { RecordingSession, Channel, TranscriptItem, UserProfile } from '../types';
import { getUserRecordings, deleteRecordingReference, saveRecordingReference, getUserProfile } from '../services/firestoreService';
import { getLocalRecordings, deleteLocalRecording } from '../utils/db';
import { Play, FileText, Trash2, Calendar, Clock, Loader2, Video, X, HardDriveDownload, Sparkles, Mic, Monitor, CheckCircle, Languages, AlertCircle, ShieldOff, Volume2, Camera, Youtube, ExternalLink, HelpCircle, Info, Link as LinkIcon, Copy, CloudUpload, HardDrive, LogIn, Check, Terminal, Activity, ShieldAlert, History, Zap, Download, Share2 } from 'lucide-react';
import { auth } from '../services/firebaseConfig';
import { getYouTubeEmbedUrl, uploadToYouTube, getYouTubeVideoUrl } from '../services/youtubeService';
import { getDriveToken, signInWithGoogle } from '../services/authService';
import { ensureCodeStudioFolder, uploadToDrive, downloadDriveFileAsBlob } from '../services/googleDriveService';
import { ShareModal } from './ShareModal';

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

export const RecordingList: React.FC<RecordingListProps> = ({ onBack, onStartLiveSession }) => {
  const [recordings, setRecordings] = useState<RecordingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);
  const [resolvedMediaUrl, setResolvedMediaUrl] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  
  const [isRecorderModalOpen, setIsRecorderModalOpen] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [recordCamera, setRecordCamera] = useState(true);
  const [recordScreen, setRecordScreen] = useState(true);

  // Sharing State
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [sharingTitle, setSharingTitle] = useState('');

  // Diagnostic State
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [showSyncLog, setShowSyncLog] = useState(false);

  const currentUser = auth?.currentUser;

  const addSyncLog = (msg: string, type: SyncLog['type'] = 'info') => {
      const time = new Date().toLocaleTimeString();
      setSyncLogs(prev => [{ time, msg, type }, ...prev].slice(0, 50));
      console.log(`[Sync Diagnostic] ${msg}`);
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const loadData = async () => {
    setLoading(true);
    try {
      let all: RecordingSession[] = [];
      const local = await getLocalRecordings();
      
      const localWithFreshUrls = local.map(rec => {
          if ((rec as any).blob instanceof Blob) {
              return { 
                  ...rec, 
                  mediaUrl: URL.createObjectURL((rec as any).blob) 
              };
          }
          return rec;
      });
      
      all = [...localWithFreshUrls];
      
      if (currentUser?.uid) {
          try {
              const cloud = await getUserRecordings(currentUser.uid);
              all = [...all, ...cloud];
          } catch (e) {
              console.warn("Cloud recordings unavailable:", e);
          }
      }
      
      const unique = Array.from(new Map(all.map(item => [item.id, item])).values());
      setRecordings(unique.sort((a, b) => b.timestamp - a.timestamp));
    } catch (e) {
      console.error("Failed to load recording archive:", e);
    } finally {
      setLoading(false);
    }
  };

  const isYouTubeUrl = (url: string) => url?.includes('youtube.com') || url?.includes('youtu.be');
  const isDriveUrl = (url: string) => url?.startsWith('drive://') || url?.includes('drive.google.com');

  const handleCopyLink = (url: string, id: string) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopyingId(id);
    setTimeout(() => setCopyingId(null), 2000);
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
          alert("Download failed: " + e.message);
      } finally {
          setDownloadingId(null);
      }
  };

  const handlePlayback = async (rec: RecordingSession) => {
      if (activeMediaId === rec.id) {
          setActiveMediaId(null);
          if (resolvedMediaUrl?.startsWith('blob:')) URL.revokeObjectURL(resolvedMediaUrl);
          setResolvedMediaUrl(null);
          return;
      }

      if (isDriveUrl(rec.mediaUrl)) {
          setResolvingId(rec.id);
          try {
              const token = getDriveToken();
              if (!token) throw new Error("Google access required.");
              const fileId = rec.mediaUrl.replace('drive://', '').split('&')[0];
              const blob = await downloadDriveFileAsBlob(token, fileId);
              const url = URL.createObjectURL(blob);
              setResolvedMediaUrl(url);
              setActiveMediaId(rec.id);
          } catch (e: any) {
              alert("Drive Access Denied: " + e.message);
          } finally {
              setResolvingId(null);
          }
      } else {
          setResolvedMediaUrl(rec.mediaUrl);
          setActiveMediaId(rec.id);
      }
  };

  const handleForceYouTubeSync = async (rec: any) => {
    if (!currentUser) return;
    
    setShowSyncLog(true);
    setSyncLogs([]);
    addSyncLog(`FORCING YouTube Sync for: ${rec.channelTitle}`, 'info');

    let token = getDriveToken();
    if (!token) {
        addSyncLog("OAuth missing. Requesting session...", 'warn');
        const user = await signInWithGoogle();
        if (!user) {
            addSyncLog("Login canceled.", 'error');
            return;
        }
        token = getDriveToken();
    }

    setSyncingId(rec.id);
    try {
        let videoBlob: Blob;
        const isFromDrive = isDriveUrl(rec.mediaUrl);
        
        if (rec.blob instanceof Blob) {
            addSyncLog("Loading local buffer...", 'info');
            videoBlob = rec.blob;
        } else if (isFromDrive) {
            addSyncLog("Fetching source recording from Google Drive...", 'info');
            const fileId = rec.mediaUrl.replace('drive://', '').split('&')[0];
            videoBlob = await downloadDriveFileAsBlob(token!, fileId);
            addSyncLog("Drive source download successful.", 'success');
        } else {
            throw new Error("Recording source not found locally or on Drive.");
        }

        addSyncLog("Step 1: Initiating YouTube Handshake...", 'info');
        let videoUrl = "";
        try {
            const ytId = await uploadToYouTube(token!, videoBlob, {
                title: `${rec.channelTitle} (Neural Archive)`,
                description: `Recorded via AIVoiceCast.\nOriginal Source: ${rec.mediaUrl}`,
                privacyStatus: 'unlisted'
            });
            videoUrl = getYouTubeVideoUrl(ytId);
            addSyncLog(`YouTube Transfer Success: ${ytId}`, 'success');
        } catch (ytErr: any) { 
            const msg = ytErr.message || String(ytErr);
            addSyncLog(`YouTube FAILED: ${msg}`, 'error');
            
            if (isFromDrive) {
                addSyncLog("Source is already on Drive. ABORTING transfer to avoid duplicate Drive storage.", 'warn');
                setSyncingId(null);
                return; // DO NOT fallback if it's already there
            }

            addSyncLog("FALLBACK: Saving local buffer to Google Drive instead...", 'warn');
            const folderId = await ensureCodeStudioFolder(token!);
            const driveFileId = await uploadToDrive(token!, folderId, `${rec.id}.webm`, videoBlob);
            videoUrl = `drive://${driveFileId}`;
            addSyncLog(`Drive Fallback Successful: ${driveFileId}`, 'success');
        }

        addSyncLog("Step 2: Updating neural ledger references...", 'info');
        const sessionData: RecordingSession = {
            ...rec,
            userId: currentUser.uid,
            mediaUrl: videoUrl,
        };
        
        // Ensure transcript is also in cloud if it wasn't
        if (!isDriveUrl(rec.transcriptUrl)) {
            const transcriptText = `Neural Transcript: ${rec.channelTitle}\nID: ${rec.id}`;
            const transcriptBlob = new Blob([transcriptText], { type: 'text/plain' });
            const folderId = await ensureCodeStudioFolder(token!);
            const tFileId = await uploadToDrive(token!, folderId, `${rec.id}_transcript.txt`, transcriptBlob);
            sessionData.transcriptUrl = `drive://${tFileId}`;
        }
        
        await saveRecordingReference(sessionData);
        addSyncLog("Neural ledger synchronized with new URI.", 'success');
        
        setTimeout(() => {
            loadData();
            setSyncingId(null);
        }, 800);
        
    } catch (e: any) {
        addSyncLog(`CRITICAL SYNC ERROR: ${e.message}`, 'error');
        setSyncingId(null);
    }
  };

  const handleManualSync = async (rec: any) => {
    if (!currentUser || !rec.blob) return;
    
    setShowSyncLog(true);
    setSyncLogs([]);
    addSyncLog(`Auto-Sync: ${rec.channelTitle}`, 'info');

    let token = getDriveToken();
    if (!token) {
        addSyncLog("OAuth missing. Re-authenticating...", 'warn');
        const user = await signInWithGoogle();
        if (!user) {
            addSyncLog("Action canceled.", 'error');
            return;
        }
        token = getDriveToken();
    }

    setSyncingId(rec.id);
    try {
        const profile = await getUserProfile(currentUser.uid);
        const pref = profile?.preferredRecordingTarget || 'drive';
        addSyncLog(`Target: ${pref.toUpperCase()}`, 'info');

        const folderId = await ensureCodeStudioFolder(token!);
        const videoBlob = rec.blob;
        const transcriptText = `Neural Transcript: ${rec.channelTitle}\nID: ${rec.id}`;
        const transcriptBlob = new Blob([transcriptText], { type: 'text/plain' });

        let mediaUrl = "";

        if (pref === 'youtube') {
            addSyncLog("Syncing to YouTube...", 'info');
            try {
                const ytId = await uploadToYouTube(token!, videoBlob, {
                    title: `${rec.channelTitle} (AI)`,
                    description: `Recorded via AIVoiceCast.`,
                    privacyStatus: 'unlisted'
                });
                mediaUrl = getYouTubeVideoUrl(ytId);
                addSyncLog(`YouTube Success: ${ytId}`, 'success');
            } catch (ytErr: any) { 
                addSyncLog(`YouTube Sync Failed. Checking Drive Fallback...`, 'warn');
            }
        }

        if (!mediaUrl) {
            addSyncLog("Syncing to Google Drive...", 'info');
            const driveFileId = await uploadToDrive(token!, folderId, `${rec.id}.webm`, videoBlob);
            mediaUrl = `drive://${driveFileId}`;
            addSyncLog("Drive Sync Success.", 'success');
        }

        addSyncLog("Archiving transcript...");
        const tFileId = await uploadToDrive(token!, folderId, `${rec.id}_transcript.txt`, transcriptBlob);
        
        const sessionData: RecordingSession = {
            id: rec.id, userId: currentUser.uid, channelId: rec.channelId,
            channelTitle: rec.channelTitle, channelImage: rec.channelImage,
            timestamp: rec.timestamp, 
            mediaUrl: mediaUrl,
            mediaType: rec.mediaType, 
            transcriptUrl: `drive://${tFileId}`
        };
        
        await saveRecordingReference(sessionData);
        addSyncLog("Neural ledger updated.", 'success');
        
        setTimeout(() => { loadData(); setSyncingId(null); }, 800);
        
    } catch (e: any) {
        addSyncLog(`SYNC FAILED: ${e.message}`, 'error');
        setSyncingId(null);
    }
  };

  const handleDelete = async (rec: RecordingSession) => {
    if (!confirm("Permanently delete?")) return;
    try {
      if (rec.mediaUrl.startsWith('blob:') || rec.mediaUrl.startsWith('data:')) {
          await deleteLocalRecording(rec.id);
      } else if (currentUser) {
          await deleteRecordingReference(rec.id, rec.mediaUrl, rec.transcriptUrl);
      } else {
          await deleteLocalRecording(rec.id);
      }
      setRecordings(prev => prev.filter(r => r.id !== rec.id));
    } catch (e) { alert("Deletion failed."); }
  };

  const handleStartRecorder = async () => {
      if (!meetingTitle.trim() || !onStartLiveSession) return;
      
      const now = new Date();
      const timeStr = now.toLocaleString();
      const newChannel: Channel = {
          id: `meeting-force-start-${Date.now()}`,
          title: meetingTitle,
          description: `Meeting: ${meetingTitle}`,
          author: currentUser?.displayName || 'Guest User',
          ownerId: currentUser?.uid || 'guest',
          visibility: 'private',
          voiceName: 'Zephyr',
          systemInstruction: `You are a helpful meeting assistant. Context: ${meetingTitle}. Recorded at ${timeStr}.`,
          likes: 0, dislikes: 0, comments: [], tags: ['Meeting'],
          imageUrl: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=600&q=80',
          createdAt: Date.now()
      };
      
      setIsRecorderModalOpen(false);
      onStartLiveSession(newChannel, meetingTitle, true, undefined, recordScreen, recordCamera);
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="w-2 h-6 bg-red-500 rounded-full"></span>
            <span>Studio Recordings</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">Archive of interactive AI sessions and recorded meetings.</p>
        </div>
        
        <div className="flex items-center gap-2">
            <button 
                onClick={() => setShowSyncLog(!showSyncLog)}
                className={`p-2 rounded-lg transition-colors ${showSyncLog ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                title="Sync Diagnostics"
            >
                <Terminal size={18}/>
            </button>
            <button 
                onClick={() => { setIsRecorderModalOpen(true); setMeetingTitle(`Meeting ${new Date().toLocaleDateString()}`); }}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-all text-xs font-bold shadow-lg shadow-red-900/20 active:scale-95"
            >
                <Zap size={14} fill="currentColor" />
                <span>One-Click Record</span>
            </button>
        </div>
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center text-indigo-400 gap-4">
          <Loader2 className="animate-spin" size={40} />
          <span className="text-xs font-black uppercase tracking-[0.2em] animate-pulse">Scanning Neural Archives</span>
        </div>
      ) : recordings.length === 0 ? (
        <div className="py-32 text-center text-slate-500 bg-slate-900/30 rounded-[2.5rem] border-2 border-dashed border-slate-800">
          <Play size={64} className="mx-auto mb-6 opacity-5" />
          <p className="text-lg font-bold text-slate-400">The archive is empty.</p>
          <p className="text-sm mt-2 opacity-60">Record meetings or save AI live sessions to see them here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {recordings.map((rec) => {
            const date = new Date(rec.timestamp);
            const isVideo = rec.mediaType?.includes('video') || rec.mediaUrl.endsWith('.webm') || isYouTubeUrl(rec.mediaUrl);
            const isPlaying = activeMediaId === rec.id;
            const isLocal = rec.mediaUrl.startsWith('blob:') || rec.mediaUrl.startsWith('data:');
            const isYoutube = isYouTubeUrl(rec.mediaUrl);
            const isDrive = isDriveUrl(rec.mediaUrl);
            const isThisResolving = resolvingId === rec.id;
            const isThisDownloading = downloadingId === rec.id;
            const isCopying = copyingId === rec.id;

            return (
              <div key={rec.id} className={`bg-slate-900 border ${isPlaying ? 'border-indigo-500 shadow-indigo-500/10' : 'border-slate-800'} rounded-2xl p-5 transition-all hover:border-indigo-500/30 group shadow-xl`}>
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-transform group-hover:scale-105 ${isYoutube ? 'bg-red-900/20 border-red-500/50 text-red-500' : 'bg-slate-800 text-slate-500'}`}>
                       {isYoutube ? <Youtube size={24} /> : isDrive ? <HardDrive size={24} /> : <Mic size={24} />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white text-lg truncate">{rec.channelTitle}</h3>
                        {isYoutube && <span className="bg-red-600 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded">YouTube</span>}
                        {isLocal && <span className="bg-slate-800 text-slate-500 text-[8px] font-black uppercase px-1.5 py-0.5 rounded border border-slate-700">Local Only</span>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1"><Calendar size={12} /> {date.toLocaleDateString()}</span>
                        <span className="flex items-center gap-1"><Clock size={12} /> {date.toLocaleTimeString()}</span>
                      </div>
                      {(isYoutube || isDrive) && (
                          <div className="mt-2 flex items-center gap-2 max-w-full">
                              <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-400 uppercase tracking-widest bg-indigo-900/20 px-2 py-0.5 rounded border border-indigo-500/10">
                                <LinkIcon size={10}/>
                                <span>{isYoutube ? 'YouTube' : 'Drive'} URI</span>
                              </div>
                              <code className="text-[10px] font-mono text-slate-400 truncate max-w-[200px]">
                                  {rec.mediaUrl}
                              </code>
                              <button 
                                onClick={() => handleCopyLink(rec.mediaUrl, rec.id)}
                                className={`p-1 rounded hover:bg-slate-800 transition-colors ${isCopying ? 'text-emerald-400' : 'text-slate-500'}`}
                                title="Copy URI"
                              >
                                  {isCopying ? <Check size={12}/> : <Copy size={12}/>}
                              </button>
                          </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                    {currentUser && !isYoutube && (
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => handleForceYouTubeSync(rec)}
                                disabled={syncingId === rec.id}
                                className="p-2.5 rounded-xl border bg-red-600 hover:bg-red-500 text-white transition-all shadow-lg active:scale-95 flex items-center gap-2 px-4 group"
                                title="Sync to Cloud (YouTube/Drive)"
                            >
                                {syncingId === rec.id ? <Loader2 size={16} className="animate-spin"/> : <Youtube size={16} />}
                                <span className="text-[10px] font-black uppercase tracking-widest hidden group-hover:inline">Sync YouTube</span>
                            </button>
                            {isLocal && (
                                <button 
                                    onClick={() => handleManualSync(rec)}
                                    disabled={syncingId === rec.id}
                                    className="p-2.5 rounded-xl border bg-indigo-600/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all shadow-lg active:scale-95"
                                    title="Auto Sync"
                                >
                                    {syncingId === rec.id ? <Loader2 size={18} className="animate-spin"/> : <CloudUpload size={18} />}
                                </button>
                            )}
                        </div>
                    )}

                    <button 
                        onClick={() => handleShare(rec)}
                        className="p-2.5 bg-slate-800 text-slate-400 hover:text-indigo-400 rounded-xl border border-slate-700 transition-colors" 
                        title="Share Session"
                    >
                        <Share2 size={20} />
                    </button>

                    {!isYoutube && (
                        <button 
                            onClick={() => handleDownloadToDevice(rec)}
                            disabled={isThisDownloading}
                            className="p-2.5 bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition-colors" 
                            title="Download Local"
                        >
                            {isThisDownloading ? <Loader2 size={20} className="animate-spin text-indigo-400" /> : <Download size={20} />}
                        </button>
                    )}
                    
                    <button 
                      onClick={() => handlePlayback(rec)}
                      disabled={resolvingId !== null && !isThisResolving}
                      className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all shadow-lg active:scale-95 ${isPlaying ? 'bg-red-600 text-white' : 'bg-slate-800 text-indigo-400 hover:bg-indigo-600 hover:text-white border border-slate-700'}`}
                    >
                      {isThisResolving ? <Loader2 size={16} className="animate-spin" /> : isPlaying ? <X size={16}/> : <Play size={16} fill="currentColor" />}
                      <span>{isPlaying ? 'Close' : 'Playback'}</span>
                    </button>
                    
                    <a href={rec.transcriptUrl} target="_blank" rel="noreferrer" className="p-2.5 bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition-colors" title="View Transcript">
                      <FileText size={20} />
                    </a>

                    <button onClick={() => handleDelete(rec)} className="p-2.5 bg-slate-800 text-slate-400 hover:text-red-400 rounded-xl border border-slate-700 transition-colors" title="Delete Permanent">
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>

                {isPlaying && resolvedMediaUrl && (
                  <div className="mt-6 pt-6 border-t border-slate-800 animate-fade-in flex justify-center">
                    {isYoutube ? (
                        <div className="relative pt-[56.25%] w-full overflow-hidden rounded-2xl bg-black border border-slate-800 shadow-2xl">
                             <iframe 
                                className="absolute top-0 left-0 w-full h-full"
                                src={getYouTubeEmbedUrl(rec.mediaUrl.split('v=')[1] || rec.mediaUrl.split('/').pop() || '')}
                                frameBorder="0" allowFullScreen
                             />
                        </div>
                    ) : isVideo ? (
                      <div className="w-full bg-black rounded-2xl overflow-hidden flex justify-center shadow-2xl border border-slate-800" style={{ maxHeight: '70vh' }}>
                        <video 
                            src={resolvedMediaUrl} 
                            controls 
                            autoPlay 
                            className="max-w-full max-h-full h-auto w-auto object-contain"
                        />
                      </div>
                    ) : (
                      <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 flex items-center gap-6 shadow-inner w-full">
                          <audio src={resolvedMediaUrl} controls autoPlay className="flex-1" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showSyncLog && (
          <div className="bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden flex flex-col shadow-2xl animate-fade-in-up">
              <div className="p-4 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-3">
                      <Activity size={18} className="text-indigo-400"/>
                      <div>
                          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Neural Sync Diagnostic Console</h3>
                          <p className="text-[10px] text-slate-500 uppercase font-black">Monitoring Cloud Flow & Fallback Logic</p>
                      </div>
                  </div>
                  <button onClick={() => setShowSyncLog(false)} className="p-2 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white transition-colors"><X size={18}/></button>
              </div>
              <div className="flex-1 max-h-[300px] overflow-y-auto p-4 space-y-2 font-mono text-[11px] bg-slate-950/50">
                  {syncLogs.length === 0 ? (
                      <p className="text-slate-600 italic">Listening for neural events...</p>
                  ) : syncLogs.map((log, i) => (
                      <div key={i} className={`flex gap-3 leading-relaxed ${
                          log.type === 'error' ? 'text-red-400' : 
                          log.type === 'warn' ? 'text-amber-400' : 
                          log.type === 'success' ? 'text-emerald-400' : 
                          'text-slate-400'
                      }`}>
                          <span className="opacity-40 shrink-0 font-bold">[{log.time}]</span>
                          <span className="break-words">
                              {log.type === 'error' && <ShieldAlert size={12} className="inline mr-2 -mt-0.5"/>}
                              {log.type === 'success' && <Check size={12} className="inline mr-2 -mt-0.5"/>}
                              {log.msg}
                          </span>
                      </div>
                  ))}
              </div>
              <div className="p-3 border-t border-slate-800 bg-slate-950 flex justify-between items-center">
                  <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">Protocol Version 4.2.1-SYN</p>
                  <button onClick={() => setSyncLogs([])} className="text-[10px] text-slate-500 hover:text-white underline font-bold uppercase">Clear Logs</button>
              </div>
          </div>
      )}
    </div>
  );
};
