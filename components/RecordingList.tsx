
import React, { useState, useEffect } from 'react';
import { RecordingSession, Channel, TranscriptItem, UserProfile } from '../types';
import { getUserRecordings, deleteRecordingReference, saveRecordingReference, getUserProfile } from '../services/firestoreService';
import { getLocalRecordings, deleteLocalRecording } from '../utils/db';
import { Play, FileText, Trash2, Calendar, Clock, Loader2, Video, X, HardDriveDownload, Sparkles, Mic, Monitor, CheckCircle, Languages, AlertCircle, ShieldOff, Volume2, Camera, Youtube, ExternalLink, HelpCircle, Info, Link as LinkIcon, Copy, CloudUpload, HardDrive, LogIn, Check } from 'lucide-react';
import { auth } from '../services/firebaseConfig';
import { getYouTubeEmbedUrl, uploadToYouTube, getYouTubeVideoUrl } from '../services/youtubeService';
import { getDriveToken, signInWithGoogle } from '../services/authService';
import { ensureCodeStudioFolder, uploadToDrive, downloadDriveFileAsBlob } from '../services/googleDriveService';

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

const TARGET_LANGUAGES = [
  'Spanish', 'French', 'German', 'Chinese (Mandarin)', 'Japanese', 
  'Korean', 'Portuguese', 'Italian', 'Russian', 'Hindi'
];

export const RecordingList: React.FC<RecordingListProps> = ({ onBack, onStartLiveSession }) => {
  const [recordings, setRecordings] = useState<RecordingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);
  const [resolvedMediaUrl, setResolvedMediaUrl] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  
  const [isRecorderModalOpen, setIsRecorderModalOpen] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [recorderMode, setRecorderMode] = useState<'interactive' | 'silent'>('interactive');
  const [targetLanguage, setTargetLanguage] = useState('Spanish');
  const [recordScreen, setRecordScreen] = useState(false);
  const [recordCamera, setRecordCamera] = useState(false);

  const currentUser = auth?.currentUser;

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

  const handleManualSync = async (rec: any) => {
    if (!currentUser || !rec.blob) return;
    let token = getDriveToken();
    if (!token) {
        if (confirm("You need a Google token to sync. Sign in now?")) {
            const user = await signInWithGoogle();
            if (!user) return;
            token = getDriveToken();
        } else { return; }
    }

    setSyncingId(rec.id);
    try {
        const profile = await getUserProfile(currentUser.uid);
        const pref = profile?.preferredRecordingTarget || 'drive';
        const folderId = await ensureCodeStudioFolder(token!);
        const videoBlob = rec.blob;
        const transcriptText = `Neural Transcript for ${rec.channelTitle}\nTimestamp: ${new Date(rec.timestamp).toLocaleString()}\nOriginal ID: ${rec.id}`;
        const transcriptBlob = new Blob([transcriptText], { type: 'text/plain' });

        const isVideo = rec.mediaType?.includes('video');
        let videoUrl = "";

        // 1. Prioritize YouTube if it is the preferred destination
        if (isVideo && (pref === 'youtube' || rec.channelId?.startsWith('meeting'))) {
            try {
                const ytId = await uploadToYouTube(token!, videoBlob, {
                    title: `${rec.channelTitle}: AI Session`,
                    description: `Recorded via AIVoiceCast.\n\nSummary:\n${transcriptText}`,
                    privacyStatus: 'unlisted'
                });
                videoUrl = getYouTubeVideoUrl(ytId);
            } catch (ytErr: any) { 
                console.warn("YouTube upload failed, will fallback to Drive for media source.", ytErr); 
            }
        }

        // 2. Always upload transcript to Drive for long-term storage
        const tFileId = await uploadToDrive(token!, folderId, `${rec.id}_transcript.txt`, transcriptBlob);
        
        // 3. Upload Video to Drive only if YouTube failed OR if Drive is the preferred target
        let driveFileId = "";
        if (!videoUrl || pref === 'drive') {
            driveFileId = await uploadToDrive(token!, folderId, `${rec.id}.webm`, videoBlob);
        }
        
        const sessionData: RecordingSession = {
            id: rec.id, userId: currentUser.uid, channelId: rec.channelId,
            channelTitle: rec.channelTitle, channelImage: rec.channelImage,
            timestamp: rec.timestamp, 
            mediaUrl: videoUrl || `drive://${driveFileId}`,
            mediaType: rec.mediaType, 
            transcriptUrl: `drive://${tFileId}`
        };
        
        await saveRecordingReference(sessionData);
        alert(videoUrl ? "Session synced to YouTube and Cloud!" : "Session synced to Cloud Drive!");
        loadData();
    } catch (e: any) {
        alert("Sync Failed: " + e.message);
    } finally {
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
      const systemPrompt = recorderMode === 'silent' 
        ? `You are a professional interpreter. Translate user's speech into ${targetLanguage}.`
        : `You are a helpful meeting assistant. Recorded at ${timeStr}.`;

      const newChannel: Channel = {
          id: `meeting-${Date.now()}`,
          title: meetingTitle,
          description: `Meeting Recording: ${meetingTitle}`,
          author: currentUser?.displayName || 'Guest User',
          ownerId: currentUser?.uid || 'guest',
          visibility: 'private',
          voiceName: 'Zephyr',
          systemInstruction: systemPrompt,
          likes: 0, dislikes: 0, comments: [], tags: ['Meeting', 'Recording'],
          imageUrl: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=600&q=80',
          createdAt: Date.now()
      };
      
      setIsRecorderModalOpen(false);
      onStartLiveSession(newChannel, meetingTitle, true, undefined, true, recordCamera);
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
        
        <div className="flex items-center gap-3">
            <button 
                onClick={() => { setIsRecorderModalOpen(true); setRecordScreen(false); setRecordCamera(false); setMeetingTitle(''); }}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-all text-xs font-bold shadow-lg shadow-red-900/20 active:scale-95"
            >
                <Video size={14} />
                <span>New Session</span>
            </button>
        </div>
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center text-indigo-400 gap-4">
          <Loader2 className="animate-spin" size={40} />
          <span className="text-xs font-black uppercase tracking-[0.2em] animate-pulse">Syncing Knowledge Archive</span>
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
            const isVideo = rec.mediaType?.includes('video');
            const isPlaying = activeMediaId === rec.id;
            const isLocal = rec.mediaUrl.startsWith('blob:') || rec.mediaUrl.startsWith('data:');
            const isYoutube = isYouTubeUrl(rec.mediaUrl);
            const isDrive = isDriveUrl(rec.mediaUrl);
            const isThisResolving = resolvingId === rec.id;
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
                              <code className="text-[10px] font-mono text-indigo-400 bg-indigo-900/20 px-2 py-0.5 rounded truncate max-w-[250px] border border-indigo-500/10">
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
                    {isLocal && currentUser && (
                        <button 
                            onClick={() => handleManualSync(rec)}
                            disabled={syncingId === rec.id}
                            className="p-2.5 rounded-xl border bg-indigo-600/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-600 hover:text-white"
                            title="Sync to Cloud"
                        >
                            {syncingId === rec.id ? <Loader2 size={18} className="animate-spin"/> : <CloudUpload size={18} />}
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

      {isRecorderModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
              <div className="bg-slate-900 border border-slate-700 rounded-[2.5rem] w-full max-w-md shadow-2xl p-8 animate-fade-in-up relative overflow-hidden">
                  <div className="flex justify-between items-center mb-8 relative z-10">
                      <div>
                          <h3 className="text-xl font-bold text-white flex items-center gap-3">
                              <div className="p-2 bg-red-600 rounded-xl shadow-lg"><Video className="text-white" size={20}/></div>
                              Capture Session
                          </h3>
                      </div>
                      <button onClick={() => setIsRecorderModalOpen(false)} className="p-2 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white"><X size={20}/></button>
                  </div>
                  
                  <div className="space-y-6 relative z-10">
                      <div>
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2 px-1">Session Identity</label>
                          <input 
                              type="text" 
                              value={meetingTitle} 
                              onChange={e => setMeetingTitle(e.target.value)} 
                              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all shadow-inner"
                              placeholder="e.g., Q1 Technical Strategy Review"
                          />
                      </div>
                      
                      <div className="space-y-4">
                          <div onClick={() => setRecordScreen(!recordScreen)} className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${recordScreen ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-slate-950 border-slate-800 hover:bg-slate-900'}`}>
                              <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-lg ${recordScreen ? 'bg-indigo-500 text-white shadow-lg' : 'bg-slate-800 text-slate-500'}`}><Monitor size={18} /></div>
                                  <p className={`font-bold text-sm ${recordScreen ? 'text-indigo-200' : 'text-slate-400'}`}>Shared Screen</p>
                              </div>
                              <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${recordScreen ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-700'}`}>{recordScreen && <CheckCircle size={12} />}</div>
                          </div>

                          <div onClick={() => setRecordCamera(!recordCamera)} className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${recordCamera ? 'bg-red-900/20 border-red-500/50' : 'bg-slate-950 border-slate-800 hover:bg-slate-900'}`}>
                              <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-lg ${recordCamera ? 'bg-red-500 text-white shadow-lg' : 'bg-slate-800 text-slate-500'}`}><Camera size={18} /></div>
                                  <p className={`font-bold text-sm ${recordCamera ? 'text-red-200' : 'text-slate-400'}`}>Camera Video</p>
                              </div>
                              <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${recordCamera ? 'border-red-500 bg-red-500 text-white' : 'border-slate-700'}`}>{recordCamera && <CheckCircle size={12} />}</div>
                          </div>
                      </div>

                      <button 
                        onClick={handleStartRecorder} 
                        disabled={!meetingTitle} 
                        className="w-full py-5 bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:grayscale text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-95"
                      >
                          <Video size={20} fill="currentColor"/>
                          <span>Launch Recorder</span>
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
