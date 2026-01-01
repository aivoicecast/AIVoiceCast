
import React, { useState, useEffect } from 'react';
import { RecordingSession, Channel } from '../types';
import { getUserRecordings, deleteRecordingReference } from '../services/firestoreService';
import { getLocalRecordings, deleteLocalRecording } from '../utils/db';
import { Play, FileText, Trash2, Calendar, Clock, Loader2, Video, X, HardDriveDownload, Sparkles, Mic, Monitor, CheckCircle, Languages, AlertCircle, ShieldOff } from 'lucide-react';
import { auth } from '../services/firebaseConfig';

interface RecordingListProps {
  onBack?: () => void;
  onStartLiveSession?: (channel: Channel, context?: string, recordingEnabled?: boolean, bookingId?: string, videoEnabled?: boolean, cameraEnabled?: boolean, activeSegment?: { index: number, lectureId: string }) => void;
}

const TARGET_LANGUAGES = [
  'Spanish', 'French', 'German', 'Chinese (Mandarin)', 'Japanese', 
  'Korean', 'Portuguese', 'Italian', 'Russian', 'Hindi'
];

export const RecordingList: React.FC<RecordingListProps> = ({ onBack, onStartLiveSession }) => {
  const [recordings, setRecordings] = useState<RecordingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);
  
  // Recorder Flow State
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
      
      // 1. Load Local Recordings (Always accessible)
      const local = await getLocalRecordings();
      all = [...local];
      
      // 2. Load Cloud Recordings (If logged in)
      if (currentUser?.uid) {
          const cloud = await getUserRecordings(currentUser.uid);
          all = [...all, ...cloud];
      }
      
      // Deduplicate and sort
      const unique = Array.from(new Map(all.map(item => [item.id, item])).values());
      setRecordings(unique.sort((a, b) => b.timestamp - a.timestamp));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (rec: RecordingSession) => {
    if (!confirm("Are you sure you want to delete this recording permanently?")) return;
    try {
      if (rec.mediaUrl.startsWith('blob:')) {
          await deleteLocalRecording(rec.id);
      } else {
          await deleteRecordingReference(rec.id, rec.mediaUrl, rec.transcriptUrl);
      }
      setRecordings(prev => prev.filter(r => r.id !== rec.id));
    } catch (e) {
      alert("Failed to delete recording.");
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
          likes: 0, 
          dislikes: 0, 
          comments: [],
          tags: ['Meeting', 'Recording'],
          imageUrl: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=600&q=80',
          createdAt: Date.now()
      };
      
      setIsRecorderModalOpen(false);
      onStartLiveSession(newChannel, meetingTitle, true, undefined, recordScreen, recordCamera);
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="w-2 h-6 bg-red-500 rounded-full"></span>
            <span>Studio Recordings</span>
            </h2>
            {!currentUser && (
                <p className="text-[10px] text-amber-400 font-bold uppercase mt-1 flex items-center gap-1">
                    <ShieldOff size={10}/> Guest Mode: Saved locally
                </p>
            )}
        </div>
        
        <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-mono hidden sm:inline">{recordings.length} sessions</span>
            <button 
                onClick={() => { setIsRecorderModalOpen(true); setRecordScreen(false); setRecordCamera(false); setMeetingTitle(''); }}
                className="flex items-center space-x-2 px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors text-xs font-bold shadow-md shadow-red-500/20"
            >
                <Video size={14} />
                <span>New Session</span>
            </button>
        </div>
      </div>

      {!currentUser && recordings.length > 0 && (
          <div className="bg-indigo-900/20 border border-indigo-500/30 p-4 rounded-xl flex items-start gap-3 text-indigo-300">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                  <p className="font-bold">Device-Only Storage</p>
                  <p>You are not signed in. These recordings are stored in your browser's memory and won't sync to other devices. Sign in to back them up to the cloud.</p>
              </div>
          </div>
      )}

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-indigo-400 gap-4">
          <Loader2 className="animate-spin" size={32} />
          <span className="text-xs font-bold uppercase tracking-widest animate-pulse">Scanning Archive...</span>
        </div>
      ) : recordings.length === 0 ? (
        <div className="py-20 text-center text-slate-500 bg-slate-900/30 rounded-3xl border-2 border-dashed border-slate-800">
          <Play size={48} className="mx-auto mb-4 opacity-10" />
          <p className="font-medium text-slate-400">The archive is empty.</p>
          <button onClick={() => setIsRecorderModalOpen(true)} className="mt-4 text-indigo-400 font-bold hover:text-white flex items-center gap-2 mx-auto">
             <Video size={16}/> Start your first recording
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {recordings.map((rec) => {
            const date = new Date(rec.timestamp);
            const isVideo = rec.mediaType?.includes('video');
            const isPlaying = activeMediaId === rec.id;
            const isLocal = rec.mediaUrl.startsWith('blob:');

            return (
              <div key={rec.id} className={`bg-slate-900 border ${isPlaying ? 'border-indigo-500' : 'border-slate-800'} rounded-2xl p-4 transition-all hover:border-indigo-500/30 group`}>
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                  
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-transform group-hover:scale-105 ${isVideo ? 'bg-indigo-900/20 border-indigo-500/50 text-indigo-400' : 'bg-pink-900/20 border-pink-500/50 text-pink-400'}`}>
                       {isVideo ? <Video size={20} /> : <Mic size={20} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white text-base line-clamp-1">{rec.channelTitle}</h3>
                        {isLocal && <span className="text-[9px] bg-slate-800 text-slate-500 border border-slate-700 px-1.5 py-0.5 rounded font-bold uppercase">Local</span>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1"><Calendar size={10} /> {date.toLocaleDateString()}</span>
                        <span className="flex items-center gap-1"><Clock size={10} /> {date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                    <button 
                      onClick={() => setActiveMediaId(isPlaying ? null : rec.id)}
                      className={`px-4 py-2 rounded-lg text-xs font-black uppercase flex items-center gap-2 transition-all shadow-lg active:scale-95 ${isPlaying ? 'bg-red-600 text-white' : 'bg-slate-800 text-indigo-400 hover:bg-indigo-600 hover:text-white'}`}
                    >
                      {isPlaying ? <X size={14}/> : <Play size={14} fill="currentColor" />}
                      <span>{isPlaying ? 'Close' : 'Playback'}</span>
                    </button>
                    
                    <a href={rec.transcriptUrl} target="_blank" rel="noreferrer" className="p-2 bg-slate-800 text-slate-400 hover:text-white rounded-lg border border-slate-700 transition-colors" title="View Transcript">
                      <FileText size={18} />
                    </a>

                    <a href={rec.mediaUrl} target="_blank" rel="noreferrer" download={`${rec.channelTitle}_Recording.webm`} className="p-2 bg-slate-800 text-slate-400 hover:text-emerald-400 rounded-lg border border-slate-700 transition-colors" title="Download Media">
                      <HardDriveDownload size={18} />
                    </a>

                    <button onClick={() => handleDelete(rec)} className="p-2 bg-slate-800 text-slate-400 hover:text-red-400 rounded-lg border border-slate-700 transition-colors" title="Delete Permanent">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {isPlaying && (
                  <div className="mt-4 pt-4 border-t border-slate-800 animate-fade-in">
                    {isVideo ? (
                      <video src={rec.mediaUrl} controls autoPlay className="w-full max-h-[500px] rounded-xl bg-black border border-slate-800 shadow-2xl" />
                    ) : (
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                          <audio src={rec.mediaUrl} controls autoPlay className="w-full" />
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
              <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md shadow-2xl p-8 animate-fade-in-up">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-white flex items-center gap-2"><Video className="text-red-500"/> Capture Session</h3>
                      <button onClick={() => setIsRecorderModalOpen(false)} className="p-1 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white transition-colors"><X size={20}/></button>
                  </div>
                  
                  <div className="space-y-6">
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Meeting Title</label>
                          <input 
                              type="text" 
                              value={meetingTitle} 
                              onChange={e => setMeetingTitle(e.target.value)} 
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
                              placeholder="e.g., Weekly Team Sync"
                          />
                      </div>
                      
                      <div className="space-y-4">
                          <div>
                              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-3">AI Engine Mode</label>
                              <div className="grid grid-cols-2 gap-3">
                                  <button onClick={() => setRecorderMode('interactive')} className={`p-4 rounded-2xl border text-left transition-all ${recorderMode === 'interactive' ? 'bg-indigo-900/30 border-indigo-500 ring-1 ring-indigo-500 shadow-lg' : 'bg-slate-950 border-slate-800 opacity-60 hover:opacity-100'}`}>
                                      <div className="flex items-center gap-2 mb-1"><Sparkles size={16} className="text-indigo-400"/><span className="font-bold text-white text-sm">Interactive</span></div>
                                      <p className="text-[10px] text-slate-500 leading-tight">AI participates and answers questions.</p>
                                  </button>
                                  <button onClick={() => setRecorderMode('silent')} className={`p-4 rounded-2xl border text-left transition-all ${recorderMode === 'silent' ? 'bg-emerald-900/30 border-emerald-500 ring-1 ring-emerald-500 shadow-lg' : 'bg-slate-950 border-slate-800 opacity-60 hover:opacity-100'}`}>
                                      <div className="flex items-center gap-2 mb-1"><Mic size={16} className="text-emerald-400"/><span className="font-bold text-white text-sm">Scribe</span></div>
                                      <p className="text-[10px] text-slate-500 leading-tight">AI translates and transcribes silently.</p>
                                  </button>
                              </div>
                          </div>

                          {recorderMode === 'silent' && (
                              <div className="animate-fade-in p-4 bg-slate-950 rounded-2xl border border-slate-800">
                                  <label className="text-xs font-bold text-emerald-400 uppercase flex items-center gap-2 mb-2"><Languages size={14}/> Translate To</label>
                                  <select value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none focus:border-emerald-500">
                                      {TARGET_LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                                  </select>
                              </div>
                          )}

                          <div onClick={() => setRecordScreen(!recordScreen)} className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${recordScreen ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-slate-950 border-slate-800 hover:bg-slate-900'}`}>
                              <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-lg ${recordScreen ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-800 text-slate-500'}`}><Monitor size={18} /></div>
                                  <div><p className={`font-bold text-sm ${recordScreen ? 'text-indigo-200' : 'text-slate-400'}`}>Screen Share</p></div>
                              </div>
                              <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${recordScreen ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-700'}`}>{recordScreen && <CheckCircle size={12} />}</div>
                          </div>

                          <div onClick={() => setRecordCamera(!recordCamera)} className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${recordCamera ? 'bg-red-900/20 border-red-500/50' : 'bg-slate-950 border-slate-800 hover:bg-slate-900'}`}>
                              <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-lg ${recordCamera ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-slate-800 text-slate-500'}`}><Video size={18} /></div>
                                  <div><p className={`font-bold text-sm ${recordCamera ? 'text-red-200' : 'text-slate-400'}`}>Camera Video</p></div>
                              </div>
                              <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${recordCamera ? 'border-red-500 bg-red-500 text-white' : 'border-slate-700'}`}>{recordCamera && <CheckCircle size={12} />}</div>
                          </div>
                      </div>

                      <button onClick={handleStartRecorder} disabled={!meetingTitle} className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-red-900/20 flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95">
                          <Video size={20} fill="currentColor"/>
                          <span>Start Recording</span>
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
