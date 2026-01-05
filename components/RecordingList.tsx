
import React, { useState, useEffect } from 'react';
import { RecordingSession, Channel, TranscriptItem } from '../types';
import { getUserRecordings, deleteRecordingReference, saveRecordingReference } from '../services/firestoreService';
import { getLocalRecordings, deleteLocalRecording } from '../utils/db';
import { Play, FileText, Trash2, Calendar, Clock, Loader2, Video, X, HardDriveDownload, Sparkles, Mic, Monitor, CheckCircle, Languages, AlertCircle, ShieldOff, Volume2, Camera, Youtube, ExternalLink, HelpCircle, Info, Link as LinkIcon, Copy, CloudUpload, HardDrive, LogIn } from 'lucide-react';
import { auth } from '../services/firebaseConfig';
import { getYouTubeEmbedUrl, uploadToYouTube, getYouTubeVideoUrl } from '../services/youtubeService';
import { getDriveToken, signInWithGoogle } from '../services/authService';
import { ensureCodeStudioFolder, uploadToDrive } from '../services/googleDriveService';

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
  const [syncingId, setSyncingId] = useState<string | null>(null);
  
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

  const handleManualSync = async (rec: any) => {
    if (!currentUser || !rec.blob) return;
    let token = getDriveToken();
    if (!token) {
        if (confirm("You need a Google Drive/YouTube token to sync. Sign in now?")) {
            const user = await signInWithGoogle();
            if (!user) return;
            token = getDriveToken();
        } else {
            return;
        }
    }

    setSyncingId(rec.id);
    try {
        const folderId = await ensureCodeStudioFolder(token!);
        const videoBlob = rec.blob;
        const transcriptText = `Neural Scribe Transcript for ${rec.channelTitle}\nTimestamp: ${new Date(rec.timestamp).toLocaleString()}`;
        const transcriptBlob = new Blob([transcriptText], { type: 'text/plain' });

        const isVideo = rec.mediaType?.includes('video');
        let videoUrl = "";

        if (isVideo) {
            try {
                const ytId = await uploadToYouTube(token!, videoBlob, {
                    title: `${rec.channelTitle}: AI Session`,
                    description: `Recorded via AIVoiceCast.\n\nAutomated Cloud Sync.`,
                    privacyStatus: 'unlisted'
                });
                videoUrl = getYouTubeVideoUrl(ytId);
            } catch (ytErr) { console.warn("YouTube fallback to Drive", ytErr); }
        }

        const driveFileId = await uploadToDrive(token!, folderId, `${rec.id}.webm`, videoBlob);
        const tFileId = await uploadToDrive(token!, folderId, `${rec.id}_transcript.txt`, transcriptBlob);
        
        const sessionData: RecordingSession = {
            id: rec.id, userId: currentUser.uid, channelId: rec.channelId,
            channelTitle: rec.channelTitle, channelImage: rec.channelImage,
            timestamp: rec.timestamp, mediaUrl: videoUrl || `drive://${driveFileId}`,
            mediaType: rec.mediaType,
            transcriptUrl: `drive://${tFileId}`
        };
        
        await saveRecordingReference(sessionData);
        alert("Upload Successful! Session is now Cloud-Hosted.");
        loadData();
    } catch (e: any) {
        alert("Sync Failed: " + e.message);
    } finally {
        setSyncingId(null);
    }
  };

  const handleDelete = async (rec: RecordingSession) => {
    if (!confirm("Permanently delete this recording? This cannot be undone.")) return;
    try {
      if (rec.mediaUrl.startsWith('blob:') || rec.mediaUrl.startsWith('data:')) {
          await deleteLocalRecording(rec.id);
      } else if (currentUser) {
          await deleteRecordingReference(rec.id, rec.mediaUrl, rec.transcriptUrl);
      } else {
          await deleteLocalRecording(rec.id);
      }
      setRecordings(prev => prev.filter(r => r.id !== rec.id));
    } catch (e) {
      alert("Deletion failed. Check connection.");
    }
  };

  const handleStartRecorder = async () => {
      if (!meetingTitle.trim() || !onStartLiveSession) return;
      
      const systemPrompt = recorderMode === 'silent' 
        ? `You are a professional interpreter. Your task is to transcribe the conversation and provide real-time translation of the user's speech into ${targetLanguage}. Speak only the translations clearly.`
        : "You are a helpful meeting assistant. Participate in the discussion, take notes, and answer questions when asked.";

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
          <p className="text-xs text-slate-500 mt-1">Archive of your interactive AI sessions and recorded meetings.</p>
        </div>
        
        <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-mono hidden md:inline">{recordings.length} sessions archived</span>
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
          <span className="text-xs font-black uppercase tracking-[0.2em] animate-pulse">Syncing Local & Cloud Archive</span>
        </div>
      ) : recordings.length === 0 ? (
        <div className="py-32 text-center text-slate-500 bg-slate-900/30 rounded-[2.5rem] border-2 border-dashed border-slate-800">
          <Play size={64} className="mx-auto mb-6 opacity-5" />
          <p className="text-lg font-bold text-slate-400">The archive is empty.</p>
          <p className="text-sm mt-2 opacity-60">Record meetings or save AI live sessions to see them here.</p>
          <button 
            onClick={() => setIsRecorderModalOpen(true)}
            className="mt-8 px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 font-bold rounded-xl transition-all border border-slate-700"
          >
             Start your first recording
          </button>
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

            return (
              <div key={rec.id} className={`bg-slate-900 border ${isPlaying ? 'border-indigo-500 shadow-indigo-500/10' : (isYoutube ? 'border-red-500/30 shadow-red-900/5' : (isDrive ? 'border-indigo-500/20' : 'border-slate-800'))} rounded-2xl p-5 transition-all hover:border-indigo-500/30 group shadow-xl`}>
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                  
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-transform group-hover:scale-105 ${isYoutube ? 'bg-red-900/20 border-red-500/50 text-red-500 shadow-lg shadow-red-900/20' : (isDrive ? 'bg-indigo-900/20 border-indigo-500/50 text-indigo-400' : 'bg-slate-800 text-slate-500')}`}>
                       {isYoutube ? <Youtube size={24} /> : isDrive ? <HardDrive size={24} /> : <Mic size={24} />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white text-lg truncate">{rec.channelTitle}</h3>
                        {isYoutube && (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-red-600 rounded-lg text-[10px] font-black text-white uppercase tracking-tighter shadow-lg shadow-red-900/20 animate-fade-in">
                                <ExternalLink size={12}/> YouTube
                            </div>
                        )}
                        {isDrive && (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-900/30 border border-indigo-500/20 rounded-lg text-[10px] font-black text-indigo-400 uppercase tracking-tighter shadow-lg">
                                <CheckCircle size={12}/> Drive Hosted
                            </div>
                        )}
                        {isLocal && (
                            <div className="flex items-center gap-2">
                                <span className="bg-slate-800 text-slate-500 text-[8px] font-black uppercase px-1.5 py-0.5 rounded border border-slate-700" title="Device Storage Only">Local only</span>
                                {!getDriveToken() && <span className="text-[8px] text-amber-500 font-bold animate-pulse">Sign in to fix</span>}
                            </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1"><Calendar size={12} /> {date.toLocaleDateString()}</span>
                        <span className="flex items-center gap-1"><Clock size={12} /> {date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                    {isLocal && currentUser && (
                        <button 
                            onClick={() => handleManualSync(rec)}
                            disabled={syncingId === rec.id}
                            className={`p-2.5 rounded-xl border transition-all flex items-center gap-2 ${!getDriveToken() ? 'bg-amber-600/10 border-amber-500/20 text-amber-500 hover:bg-amber-600 hover:text-white' : 'bg-indigo-600/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-600 hover:text-white'}`}
                            title={!getDriveToken() ? "Sign in & Push to Cloud" : "Push to Cloud"}
                        >
                            {syncingId === rec.id ? <Loader2 size={18} className="animate-spin"/> : (!getDriveToken() ? <LogIn size={18}/> : <CloudUpload size={18} />)}
                            <span className="text-[10px] font-black uppercase tracking-widest hidden lg:inline">{!getDriveToken() ? 'Fix Local Only' : 'Push to Cloud'}</span>
                        </button>
                    )}
                    
                    <button 
                      onClick={() => setActiveMediaId(isPlaying ? null : rec.id)}
                      className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all shadow-lg active:scale-95 ${isPlaying ? 'bg-red-600 text-white' : 'bg-slate-800 text-indigo-400 hover:bg-indigo-600 hover:text-white border border-slate-700'}`}
                    >
                      {isPlaying ? <X size={16}/> : <Play size={16} fill="currentColor" />}
                      <span>{isPlaying ? 'Close' : 'Playback'}</span>
                    </button>
                    
                    <a href={rec.transcriptUrl} target="_blank" rel="noreferrer" className="p-2.5 bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition-colors" title="View Transcript">
                      <FileText size={20} />
                    </a>

                    {!isYoutube && (
                        <div className="relative group">
                            <a href={rec.mediaUrl} target="_blank" rel="noreferrer" download={`${rec.channelTitle.replace(/\s/g, '_')}_Session.webm`} className="p-2.5 bg-slate-800 text-slate-400 hover:text-emerald-400 rounded-xl border border-slate-700 transition-colors flex items-center justify-center">
                                <HardDriveDownload size={20} />
                            </a>
                        </div>
                    )}

                    <button onClick={() => handleDelete(rec)} className="p-2.5 bg-slate-800 text-slate-400 hover:text-red-400 rounded-xl border border-slate-700 transition-colors" title="Permanent Delete">
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>

                {isPlaying && (
                  <div className="mt-6 pt-6 border-t border-slate-800 animate-fade-in">
                    {isYoutube ? (
                        <div className="relative pt-[56.25%] w-full overflow-hidden rounded-2xl bg-black border border-slate-800 shadow-2xl">
                             <iframe 
                                className="absolute top-0 left-0 w-full h-full"
                                src={getYouTubeEmbedUrl(rec.mediaUrl.split('v=')[1] || rec.mediaUrl.split('/').pop() || '')}
                                title="YouTube Video"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                             />
                        </div>
                    ) : isVideo ? (
                      <video src={rec.mediaUrl} controls autoPlay className="w-full max-h-[500px] rounded-2xl bg-black border border-slate-800 shadow-2xl" />
                    ) : (
                      <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 flex items-center gap-6 shadow-inner">
                          <div className="w-12 h-12 bg-indigo-600/10 text-indigo-400 rounded-full flex items-center justify-center border border-indigo-500/20"><Volume2 className="animate-pulse" /></div>
                          <audio src={rec.mediaUrl} controls autoPlay className="flex-1" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* --- Recorder Selection Modal --- */}
      {isRecorderModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
              <div className="bg-slate-900 border border-slate-700 rounded-[2.5rem] w-full max-w-md shadow-2xl p-8 animate-fade-in-up relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-24 bg-red-600/5 blur-[80px] rounded-full pointer-events-none"></div>
                  
                  <div className="flex justify-between items-center mb-8 relative z-10">
                      <div>
                          <h3 className="text-xl font-bold text-white flex items-center gap-3">
                              <div className="p-2 bg-red-600 rounded-xl shadow-lg shadow-red-900/20"><Video className="text-white" size={20}/></div>
                              Capture Session
                          </h3>
                          <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1">Configure neural recorder</p>
                      </div>
                      <button onClick={() => setIsRecorderModalOpen(false)} className="p-2 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white transition-colors"><X size={20}/></button>
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
                          <div>
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-3 px-1">AI Participation Level</label>
                              <div className="grid grid-cols-2 gap-3">
                                  <button onClick={() => setRecorderMode('interactive')} className={`p-4 rounded-2xl border text-left transition-all ${recorderMode === 'interactive' ? 'bg-indigo-900/30 border-indigo-500 ring-1 ring-indigo-500 shadow-lg' : 'bg-slate-950 border-slate-800 opacity-60 hover:opacity-100'}`}>
                                      <div className="flex items-center gap-2 mb-1"><Sparkles size={16} className="text-indigo-400"/><span className="font-bold text-white text-sm">Active</span></div>
                                      <p className="text-[9px] text-slate-500 leading-tight">AI facilitates and answers questions.</p>
                                  </button>
                                  <button onClick={() => setRecorderMode('silent')} className={`p-4 rounded-2xl border text-left transition-all ${recorderMode === 'silent' ? 'bg-emerald-900/30 border-emerald-500 ring-1 emerald-500 shadow-lg' : 'bg-slate-950 border-slate-800 opacity-60 hover:opacity-100'}`}>
                                      <div className="flex items-center gap-2 mb-1"><Mic size={16} className="text-emerald-400"/><span className="font-bold text-white text-sm">Scribe</span></div>
                                      <p className="text-[9px] text-slate-500 leading-tight">AI translates and transcribes silently.</p>
                                  </button>
                              </div>
                          </div>

                          {recorderMode === 'silent' && (
                              <div className="animate-fade-in p-4 bg-slate-950 rounded-2xl border border-slate-800">
                                  <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2 mb-2"><Languages size={14}/> Real-time Translation</label>
                                  <select value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none focus:border-emerald-500 transition-colors">
                                      {TARGET_LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                                  </select>
                              </div>
                          )}

                          <div onClick={() => setRecordScreen(!recordScreen)} className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${recordScreen ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-slate-950 border-slate-800 hover:bg-slate-900'}`}>
                              <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-lg ${recordScreen ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-800 text-slate-500'}`}><Monitor size={18} /></div>
                                  <div><p className={`font-bold text-sm ${recordScreen ? 'text-indigo-200' : 'text-slate-400'}`}>Shared Screen</p></div>
                              </div>
                              <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${recordScreen ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-700'}`}>{recordScreen && <CheckCircle size={12} />}</div>
                          </div>

                          <div onClick={() => setRecordCamera(!recordCamera)} className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${recordCamera ? 'bg-red-900/20 border-red-500/50' : 'bg-slate-950 border-slate-800 hover:bg-slate-900'}`}>
                              <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-lg ${recordCamera ? 'bg-red-500 text-white shadow-lg shadow-red-900/20' : 'bg-slate-800 text-slate-500'}`}><Camera size={18} /></div>
                                  <div><p className={`font-bold text-sm ${recordCamera ? 'text-red-200' : 'text-slate-400'}`}>Camera Video</p></div>
                              </div>
                              <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${recordCamera ? 'border-red-500 bg-red-500 text-white' : 'border-slate-700'}`}>{recordCamera && <CheckCircle size={12} />}</div>
                          </div>
                      </div>

                      <button 
                        onClick={handleStartRecorder} 
                        disabled={!meetingTitle} 
                        className="w-full py-5 bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:grayscale text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-red-900/20 flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95"
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
