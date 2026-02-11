import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { RecordingSession, Channel, RefractionSector, UserProfile, ViewID } from '../types';
import { getUserRecordings, deleteRecordingReference, saveRecordingReference, getUserProfile, isUserAdmin } from '../services/firestoreService';
import { getLocalRecordings, deleteLocalRecording, getLocalPrivateKey } from '../utils/db';
import { signPayment } from '../utils/cryptoUtils';
import { 
  Play, FileText, Trash2, Calendar, Clock, Loader2, Video, X, HardDriveDownload, 
  Sparkles, ShieldCheck, Youtube, ExternalLink, Info, Share2, Download, 
  Pause, Search, RefreshCw, FileVideo, Database, Layers, Cpu, Target, 
  Briefcase, MessageSquare, Ghost, Fingerprint, Shield, Zap, BookText, Code, 
  FileSignature, UserCheck, Repeat, Plus, CloudUpload, Monitor, Activity
} from 'lucide-react';
import { auth, db } from '../services/firebaseConfig';
import { doc, updateDoc } from '@firebase/firestore';
import { getYouTubeEmbedUrl, deleteYouTubeVideo, uploadToYouTube, getYouTubeVideoUrl } from '../services/youtubeService';
import { getDriveToken, signInWithGoogle, connectGoogleDrive } from '../services/authService';
import { downloadDriveFileAsBlob, deleteDriveFile, getDriveFileStreamUrl } from '../services/googleDriveService';
import { ShareModal } from './ShareModal';
import { HANDCRAFTED_CHANNELS } from '../utils/initialData';
import { Visualizer } from './Visualizer';
import { MarkdownView } from './MarkdownView';

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

type HandshakePhase = 'idle' | 'local' | 'cloud' | 'finalizing' | 'complete';

const SECTOR_CONFIG: Record<RefractionSector, { label: string, icon: any, color: string, bg: string }> = {
    hackathon: { label: 'Hackathon', icon: Target, color: 'text-red-400', bg: 'bg-red-900/20' },
    agent_demo: { label: 'AI Agents', icon: Ghost, color: 'text-purple-400', bg: 'bg-purple-900/20' },
    code_studio: { label: 'Builder IDE', icon: Code, color: 'text-indigo-400', bg: 'bg-indigo-900/20' },
    mock_interview: { label: 'Interview', icon: UserCheck, color: 'text-amber-400', bg: 'bg-amber-900/20' },
    book_gen: { label: 'Authoring', icon: BookText, color: 'text-emerald-400', bg: 'bg-emerald-900/20' },
    scripture: { label: 'Scripture', icon: FileSignature, color: 'text-orange-400', bg: 'bg-orange-900/20' },
    general: { label: 'General', icon: MessageSquare, color: 'text-slate-400', bg: 'bg-slate-800' }
};

const formatSize = (bytes?: number) => {
    if (!bytes) return '---';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

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

export const RecordingList: React.FC<RecordingListProps> = ({ onBack, onStartLiveSession, onOpenManual }) => {
  const [recordings, setRecordings] = useState<RecordingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<RefractionSector | 'all'>('all');
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);
  const [resolvedMediaUrl, setResolvedMediaUrl] = useState<string | null>(null);
  const [activeRecording, setActiveRecording] = useState<RecordingSession | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [showTrace, setShowTrace] = useState(false);
  const [isUploadingMap, setIsUploadingMap] = useState<Record<string, boolean>>({});

  const [shareUrl, setShareUrl] = useState('');
  const [sharingTitle, setSharingTitle] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);

  const currentUser = auth?.currentUser;

  const addSyncLog = (msg: string, type: 'info' | 'error' | 'success' | 'warn' = 'info') => {
      window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: `[Archive] ${msg}`, type } }));
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    addSyncLog("Hydrating Shard Ledger...");
    try {
      const local = await getLocalRecordings();
      let collected = [...local];
      if (currentUser?.uid) {
          const cloud = await getUserRecordings(currentUser.uid);
          const map = new Map<string, RecordingSession>();
          [...local, ...cloud].forEach(item => { if (item && item.id) map.set(item.id, item); });
          collected = Array.from(map.values());
      }
      setRecordings(collected.sort((a, b) => b.timestamp - a.timestamp));
    } catch (e: any) { 
        addSyncLog(`Sync Fault: ${e.message}`, 'error');
    } finally { 
        setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredRecordings = useMemo(() => {
      if (activeTab === 'all') return recordings;
      return recordings.filter(r => r.sector === activeTab);
  }, [recordings, activeTab]);

  const handleYouTubeUpload = async (rec: RecordingSession) => {
    if (!currentUser || isUploadingMap[rec.id]) return;
    
    setIsUploadingMap(prev => ({ ...prev, [rec.id]: true }));
    addSyncLog(`Initiating YouTube Handshake for ${rec.id.substring(0,8)}...`, 'info');

    try {
        let token = getDriveToken() || await signInWithGoogle().then(() => getDriveToken());
        if (!token) throw new Error("OAuth Handshake Refused.");

        let blob = rec.blob;
        if (!blob) {
            const localRecs = await getLocalRecordings();
            const found = localRecs.find(lr => lr.id === rec.id);
            blob = found?.blob;
        }

        if (!blob) throw new Error("Source blob missing from local cache.");

        const ytId = await uploadToYouTube(token, blob, {
            title: `${rec.channelTitle} (Neural Archive)`,
            description: `Session recorded on ${new Date(rec.timestamp).toLocaleString()}. Node ID: ${rec.id}`,
            privacyStatus: 'unlisted'
        });

        const videoUrl = getYouTubeVideoUrl(ytId);
        await updateDoc(doc(db, 'recordings', rec.id), { 
            mediaUrl: videoUrl, 
            mediaType: 'youtube' 
        });

        addSyncLog(`Archive Secured: YouTube ID ${ytId}`, 'success');
        loadData();
    } catch (e: any) {
        addSyncLog(`Upload Fault: ${e.message}`, 'error');
        alert(e.message);
    } finally {
        setIsUploadingMap(prev => ({ ...prev, [rec.id]: false }));
    }
  };

  const handlePlayback = async (rec: RecordingSession) => {
      setActiveRecording(rec);
      setActiveMediaId(rec.id);
      if (isYouTubeUrl(rec.mediaUrl)) {
          setResolvedMediaUrl(rec.mediaUrl);
      } else if (isDriveUrl(rec.mediaUrl)) {
          addSyncLog("Rehydrating from Sovereign Vault...", "info");
          const token = getDriveToken() || await connectGoogleDrive();
          const fileId = rec.mediaUrl.replace('drive://', '').split('&')[0];
          setResolvedMediaUrl(getDriveFileStreamUrl(token, fileId));
      } else {
          setResolvedMediaUrl(rec.mediaUrl);
      }
  };

  const handleSignArtifact = async (rec: RecordingSession) => {
    if (!currentUser || isSigning) return;
    setIsSigning(true);
    try {
        const key = await getLocalPrivateKey(currentUser.uid);
        if (!key) throw new Error("Local identity shard missing.");
        const signature = await signPayment(key, `${rec.id}|${rec.timestamp}`);
        await updateDoc(doc(db, 'recordings', rec.id), {
            signedBy: currentUser.displayName,
            nFactor: (rec.nFactor || 0) + 1
        });
        addSyncLog("Artifact co-signed.", "success");
        loadData();
    } catch (e: any) {
        alert(e.message);
    } finally {
        setIsSigning(false);
    }
  };

  const closePlayer = () => { setActiveMediaId(null); setResolvedMediaUrl(null); setActiveRecording(null); };

  return (
    <div className="space-y-10 animate-fade-in pb-32">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-900/30 border border-indigo-500/20 rounded-full text-indigo-400 text-[10px] font-black uppercase tracking-widest">
            <ShieldCheck size={12}/> Artifact Verification Registry
          </div>
          <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
             Sovereign Archive
          </h2>
          <p className="text-slate-500 font-medium text-lg">Verifiable technical records sharded across the community mesh.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => onStartLiveSession?.(HANDCRAFTED_CHANNELS[0], "Interactive Archive Session", true, undefined, true, true)}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-50 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-900/40 transition-all active:scale-95 group"
          >
            <Plus size={18} className="group-hover:rotate-90 transition-transform" />
            <span>New Recording</span>
          </button>
          <button onClick={loadData} className="p-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 hover:text-white transition-all shadow-xl">
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          {onOpenManual && <button onClick={onOpenManual} className="p-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 hover:text-white transition-all"><Info size={20}/></button>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-900/50 border border-slate-800 rounded-[2rem] shadow-inner overflow-x-auto no-scrollbar">
          <button onClick={() => setActiveTab('all')} className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'all' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>All Shards</button>
          {(Object.keys(SECTOR_CONFIG) as RefractionSector[]).map(sector => {
              const conf = SECTOR_CONFIG[sector];
              return (
                  <button key={sector} onClick={() => setActiveTab(sector)} className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === sector ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}>
                      <conf.icon size={14}/> {conf.label}
                  </button>
              );
          })}
      </div>

      {loading && recordings.length === 0 ? (
        <div className="py-32 flex flex-col items-center justify-center text-indigo-400 gap-6">
          <Loader2 className="animate-spin" size={48} />
          <span className="text-[10px] font-black uppercase tracking-[0.4em] animate-pulse">Scanning Registry Shards...</span>
        </div>
      ) : filteredRecordings.length === 0 ? (
        <div className="py-32 flex flex-col items-center justify-center text-slate-700 border-2 border-dashed border-slate-800 rounded-[4rem] gap-6">
          <Video size={64} className="opacity-10" />
          <p className="text-sm font-black uppercase tracking-widest">No artifacts found in this sector</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl animate-fade-in">
            <div className="overflow-x-auto scrollbar-hide">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-950 border-b border-slate-800">
                        <tr>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Artifact Trace</th>
                            <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Sector</th>
                            <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Temporal Node</th>
                            <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Mass & Integrity</th>
                            <th className="px-8 py-5 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {filteredRecordings.map((rec) => {
                            const conf = SECTOR_CONFIG[rec.sector || 'general'];
                            const score = rec.audit?.StructuralCoherenceScore || rec.audit?.coherenceScore || 98;
                            const isSyncing = isUploadingMap[rec.id];
                            const onYouTube = isYouTubeUrl(rec.mediaUrl);

                            return (
                                <tr key={rec.id} className="hover:bg-indigo-600/5 transition-colors group">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-5">
                                            <div className="w-12 h-12 rounded-xl bg-slate-800 overflow-hidden shrink-0 border border-white/5 relative group/thumb" onClick={() => handlePlayback(rec)}>
                                                {rec.channelImage ? <img src={rec.channelImage} className="w-full h-full object-cover opacity-60 group-hover/thumb:opacity-100 transition-opacity" alt=""/> : <div className="w-full h-full flex items-center justify-center text-slate-700"><FileVideo size={20}/></div>}
                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 bg-indigo-600/40 transition-opacity cursor-pointer"><Play size={16} fill="white" className="text-white"/></div>
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors truncate max-w-xs">{rec.channelTitle}</h4>
                                                <p className="text-[9px] font-mono text-slate-600 uppercase tracking-tighter mt-1">{rec.id.substring(0,24)}...</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6">
                                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${conf.bg} ${conf.color} border border-current/10 text-[9px] font-black uppercase tracking-widest`}>
                                            <conf.icon size={12}/> {conf.label}
                                        </div>
                                    </td>
                                    <td className="px-6 py-6">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-tight flex items-center gap-2"><Calendar size={12} className="text-indigo-400"/> {new Date(rec.timestamp).toLocaleDateString()}</span>
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Clock size={12} className="text-indigo-400"/> {new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6">
                                        <div className="flex items-center gap-6">
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-black text-slate-600 uppercase">Mass</span>
                                                <span className="text-xs font-mono text-slate-300">{formatSize(rec.size || rec.blob?.size)}</span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-[9px] font-black text-slate-600 uppercase">Coherence</span>
                                                <span className="text-sm font-black text-emerald-400 italic">{score}%</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {!onYouTube ? (
                                                <button 
                                                    onClick={() => handleYouTubeUpload(rec)}
                                                    disabled={isSyncing}
                                                    className={`p-2 rounded-xl transition-all border ${isSyncing ? 'bg-red-900/20 border-red-500/30 text-red-500' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-red-600 hover:border-red-500'}`}
                                                    title="Upload to YouTube Archive"
                                                >
                                                    {isSyncing ? <Loader2 size={16} className="animate-spin"/> : <Youtube size={16}/>}
                                                </button>
                                            ) : (
                                                <div className="p-2 bg-emerald-900/20 border border-emerald-500/30 text-emerald-400 rounded-xl" title="Persistent in Neural Archive">
                                                    <ShieldCheck size={16}/>
                                                </div>
                                            )}
                                            <button onClick={() => handleSignArtifact(rec)} className={`p-2 rounded-xl border ${rec.signedBy ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-indigo-500'}`} title="Notarize Artifact"><FileSignature size={16}/></button>
                                            <button onClick={() => { setShareUrl(rec.mediaUrl); setSharingTitle(rec.channelTitle); setShowShareModal(true); }} className="p-2 bg-slate-800 border border-slate-700 hover:bg-indigo-600 text-slate-400 hover:text-white rounded-xl transition-all shadow-lg"><Share2 size={16}/></button>
                                            <button onClick={async () => { if(confirm("Purge Logic Shard?")) { await deleteRecordingReference(rec.id, rec.mediaUrl, rec.transcriptUrl); loadData(); } }} className="p-2 bg-slate-800 border border-slate-700 hover:bg-red-600 text-slate-400 hover:text-white rounded-xl transition-all shadow-lg"><Trash2 size={16}/></button>
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

      {activeMediaId && activeRecording && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 sm:p-10 animate-fade-in">
            <div className="w-full max-w-7xl h-full flex flex-col lg:flex-row gap-6">
                <div className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl relative">
                    <header className="h-20 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between px-8 shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-xl"><FileVideo size={24}/></div>
                            <div>
                                <h2 className="text-xl font-black text-white italic tracking-tighter uppercase">{activeRecording.channelTitle}</h2>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Artifact Trace // {activeRecording.id.substring(0,16)}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => setShowTrace(!showTrace)} className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg ${showTrace ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}><Zap size={14} fill={showTrace ? "currentColor" : "none"}/><span>{showTrace ? 'Hide Trace' : 'Show Trace'}</span></button>
                            <button onClick={closePlayer} className="p-3 bg-slate-800 hover:bg-red-600 text-white rounded-2xl transition-all shadow-lg"><X size={24}/></button>
                        </div>
                    </header>
                    <div className="flex-1 bg-black flex items-center justify-center relative group/player">
                        {resolvedMediaUrl ? (
                            isYouTubeUrl(resolvedMediaUrl) ? (
                                <iframe src={`${getYouTubeEmbedUrl(extractYouTubeId(resolvedMediaUrl)!)}?autoplay=1`} className="w-full h-full border-none" allow="autoplay; encrypted-media; fullscreen" allowFullScreen />
                            ) : (
                                <video src={resolvedMediaUrl} controls autoPlay className="w-full h-full object-contain" />
                            )
                        ) : (
                            <div className="flex flex-col items-center gap-4"><Loader2 className="animate-spin text-indigo-500" size={64}/><span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Buffering Neural Signal...</span></div>
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}

      {showShareModal && shareUrl && (
          <ShareModal isOpen={true} onClose={() => setShowShareModal(false)} link={shareUrl} title={sharingTitle} onShare={async () => {}} currentUserUid={currentUser?.uid} />
      )}
    </div>
  );
};

export default RecordingList;