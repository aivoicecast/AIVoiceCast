
import React, { useState, useEffect } from 'react';
import { RecordingSession, Channel } from '../types';
import { getUserRecordings, deleteRecordingReference } from '../services/firestoreService';
import { Play, FileText, Trash2, Calendar, Clock, Loader2, Video, X, HardDriveDownload, Sparkles, Mic, Monitor, CheckCircle, Languages } from 'lucide-react';
import { auth } from '../services/firebaseConfig';

interface RecordingListProps {
  onBack?: () => void;
  onStartLiveSession?: (channel: Channel, context?: string, recordingEnabled?: boolean, bookingId?: string, videoEnabled?: boolean, cameraEnabled?: boolean) => void;
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

  const currentUser = auth.currentUser;

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const data = await getUserRecordings(currentUser.uid);
      setRecordings(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (rec: RecordingSession) => {
    if (!confirm("Are you sure you want to delete this recording permanently?")) return;
    try {
      await deleteRecordingReference(rec.id, rec.mediaUrl, rec.transcriptUrl);
      setRecordings(prev => prev.filter(r => r.id !== rec.id));
    } catch (e) {
      alert("Failed to delete recording.");
    }
  };

  const handleStartRecorder = async () => {
      if (!meetingTitle.trim() || !onStartLiveSession) return;
      
      const systemPrompt = recorderMode === 'silent' 
        ? `You are a professional interpreter. Your task is to transcribe the conversation and provide real-time translation of the user's speech into ${targetLanguage}. Speak only the translations clearly. Do not answer questions or engage in conversation, simply act as a voice translator.`
        : "You are a helpful meeting assistant. Participate in the discussion, take notes, and answer questions when asked.";

      const newChannel: Channel = {
          id: `meeting-${Date.now()}`,
          title: meetingTitle,
          description: `Meeting Recording: ${meetingTitle}`,
          author: currentUser?.displayName || 'User',
          ownerId: currentUser?.uid,
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

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500 bg-slate-900/30 rounded-xl border border-dashed border-slate-800">
        <p>Please sign in to view your recordings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="w-2 h-6 bg-red-500 rounded-full"></span>
          <span>My Recordings</span>
        </h2>
        
        <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-mono hidden sm:inline">{recordings.length} files</span>
            {onStartLiveSession && (
                <button 
                    onClick={() => { setIsRecorderModalOpen(true); setRecordScreen(false); setRecordCamera(false); setMeetingTitle(''); }}
                    className="flex items-center space-x-2 px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors text-xs font-bold shadow-md shadow-red-500/20"
                >
                    <Video size={14} />
                    <span>Record Meeting</span>
                </button>
            )}
        </div>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center text-indigo-400">
          <Loader2 className="animate-spin" size={32} />
        </div>
      ) : recordings.length === 0 ? (
        <div className="py-12 text-center text-slate-500 bg-slate-900/30 rounded-xl border border-dashed border-slate-800">
          <p>No recordings found. Click "Record Meeting" to start.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {recordings.map((rec) => {
            const date = new Date(rec.timestamp);
            const isVideo = rec.mediaType?.includes('video');
            const isPlaying = activeMediaId === rec.id;

            return (
              <div key={rec.id} className={`bg-slate-900 border ${isPlaying ? 'border-indigo-500' : 'border-slate-800'} rounded-xl p-4 transition-all hover:border-indigo-500/30`}>
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                  
                  {/* Info */}
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${isVideo ? 'bg-indigo-900/20 border-indigo-500/50 text-indigo-400' : 'bg-pink-900/20 border-pink-500/50 text-pink-400'}`}>
                       {isVideo ? <Video size={20} /> : <Play size={20} />}
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base line-clamp-1">{rec.channelTitle}</h3>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                        <span className="flex items-center gap-1"><Calendar size={10} /> {date.toLocaleDateString()}</span>
                        <span className="flex items-center gap-1"><Clock size={10} /> {date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                    <button 
                      onClick={() => setActiveMediaId(isPlaying ? null : rec.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ${isPlaying ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-slate-800 text-indigo-400 hover:text-white hover:bg-indigo-600'}`}
                    >
                      {isPlaying ? <X size={16}/> : <Play size={16} fill="currentColor" />}
                      <span>{isPlaying ? 'Close' : 'Play'}</span>
                    </button>
                    
                    <a 
                      href={rec.transcriptUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="p-2 bg-slate-800 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors"
                      title="View Transcript"
                    >
                      <FileText size={18} />
                    </a>

                    <a 
                      href={rec.mediaUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      download
                      className="p-2 bg-slate-800 text-slate-400 hover:text-emerald-400 rounded-lg hover:bg-slate-700 transition-colors"
                      title="Download Media"
                    >
                      <HardDriveDownload size={18} />
                    </a>

                    <button 
                      onClick={() => handleDelete(rec)}
                      className="p-2 bg-slate-800 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-700 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {/* Player Area */}
                {isPlaying && (
                  <div className="mt-4 pt-4 border-t border-slate-800 animate-fade-in">
                    {isVideo ? (
                      <video 
                        src={rec.mediaUrl} 
                        controls 
                        autoPlay 
                        className="w-full max-h-96 rounded-lg bg-black"
                      />
                    ) : (
                      <audio 
                        src={rec.mediaUrl} 
                        controls 
                        autoPlay 
                        className="w-full mt-2"
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* --- Recorder Modal --- */}
      {isRecorderModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-6 animate-fade-in-up">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-white flex items-center gap-2"><Video className="text-red-500"/> Start Recording</h3>
                      <button onClick={() => setIsRecorderModalOpen(false)}><X size={20} className="text-slate-400 hover:text-white"/></button>
                  </div>
                  
                  <div className="space-y-6">
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase">Meeting Title</label>
                          <input 
                              type="text" 
                              value={meetingTitle} 
                              onChange={e => setMeetingTitle(e.target.value)} 
                              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-red-500 mt-1"
                              placeholder="e.g., Weekly Team Sync"
                          />
                      </div>
                      
                      <div className="space-y-4">
                          <div>
                              <label className="text-xs font-bold text-slate-500 uppercase">AI Mode</label>
                              <div className="grid grid-cols-2 gap-3 mt-2">
                                  <button 
                                      onClick={() => setRecorderMode('interactive')}
                                      className={`p-3 rounded-xl border text-left transition-all ${recorderMode === 'interactive' ? 'bg-indigo-900/30 border-indigo-500 ring-1 ring-indigo-500' : 'bg-slate-800 border-slate-700 opacity-60'}`}
                                  >
                                      <div className="flex items-center gap-2 mb-1"><Sparkles size={16} className="text-indigo-400"/><span className="font-bold text-white text-sm">Interactive</span></div>
                                      <p className="text-[10px] text-slate-400">AI participates and answers questions.</p>
                                  </button>
                                  <button 
                                      onClick={() => setRecorderMode('silent')}
                                      className={`p-3 rounded-xl border text-left transition-all ${recorderMode === 'silent' ? 'bg-emerald-900/30 border-emerald-500 ring-1 ring-emerald-500' : 'bg-slate-800 border-slate-700 opacity-60'}`}
                                  >
                                      <div className="flex items-center gap-2 mb-1"><Mic size={16} className="text-emerald-400"/><span className="font-bold text-white text-sm">Silent Scribe</span></div>
                                      <p className="text-[10px] text-slate-400">AI translates and transcribes.</p>
                                  </button>
                              </div>
                          </div>

                          {/* Language Selection for Silent Scribe / Translator Mode */}
                          {recorderMode === 'silent' && (
                              <div className="animate-fade-in">
                                  <label className="text-xs font-bold text-emerald-400 uppercase flex items-center gap-2">
                                      <Languages size={14}/> Translate To
                                  </label>
                                  <select 
                                      value={targetLanguage} 
                                      onChange={(e) => setTargetLanguage(e.target.value)}
                                      className="w-full bg-slate-800 border border-emerald-500/50 rounded-lg p-2.5 mt-1 text-sm text-white focus:outline-none"
                                  >
                                      {TARGET_LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                                  </select>
                                  <p className="text-[10px] text-slate-500 mt-1">AI will translate spoken words into {targetLanguage} in real-time.</p>
                              </div>
                          )}

                          {/* Screen Record Toggle */}
                          <div 
                              onClick={() => setRecordScreen(!recordScreen)}
                              className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${recordScreen ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-slate-800/30 border-slate-700 hover:bg-slate-800'}`}
                          >
                              <div className="flex items-center gap-3">
                                  <div className={`p-1.5 rounded-full ${recordScreen ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                                      <Monitor size={16} />
                                  </div>
                                  <div>
                                      <p className={`font-bold text-sm ${recordScreen ? 'text-indigo-400' : 'text-slate-400'}`}>Include Screen Share</p>
                                  </div>
                              </div>
                              <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${recordScreen ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-500'}`}>
                                  {recordScreen && <CheckCircle size={12} />}
                              </div>
                          </div>

                          {/* Camera Toggle */}
                          <div 
                              onClick={() => setRecordCamera(!recordCamera)}
                              className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${recordCamera ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-slate-800/30 border-slate-700 hover:bg-slate-800'}`}
                          >
                              <div className="flex items-center gap-3">
                                  <div className={`p-1.5 rounded-full ${recordCamera ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                                      <Video size={16} />
                                  </div>
                                  <div>
                                      <p className={`font-bold text-sm ${recordCamera ? 'text-indigo-400' : 'text-slate-400'}`}>Include Camera Video</p>
                                  </div>
                              </div>
                              <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${recordCamera ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-500'}`}>
                                  {recordCamera && <CheckCircle size={12} />}
                              </div>
                          </div>
                      </div>

                      <button 
                          onClick={handleStartRecorder}
                          disabled={!meetingTitle}
                          className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2"
                      >
                          <Video size={18} fill="currentColor"/>
                          <span>Start Meeting</span>
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
