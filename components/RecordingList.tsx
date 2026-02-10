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
  FileSignature, UserCheck, Repeat
} from 'lucide-react';
import { auth, db } from '../services/firebaseConfig';
import { doc, updateDoc } from '@firebase/firestore';
import { getYouTubeEmbedUrl, deleteYouTubeVideo } from '../services/youtubeService';
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
    hackathon: { label: 'Hackathon', icon: TrophyIcon, color: 'text-red-400', bg: 'bg-red-900/20' },
    agent_demo: { label: 'AI Agents', icon: BotIcon, color: 'text-purple-400', bg: 'bg-purple-900/20' },
    code_studio: { label: 'Builder IDE', icon: Code, color: 'text-indigo-400', bg: 'bg-indigo-900/20' },
    mock_interview: { label: 'Interview', icon: UserCheck, color: 'text-amber-400', bg: 'bg-amber-900/20' },
    book_gen: { label: 'Authoring', icon: BookText, color: 'text-emerald-400', bg: 'bg-emerald-900/20' },
    scripture: { label: 'Scripture', icon: FileSignature, color: 'text-orange-400', bg: 'bg-orange-900/20' },
    general: { label: 'General', icon: MessageSquare, color: 'text-slate-400', bg: 'bg-slate-800' }
};

function TrophyIcon(props: any) { return <Target {...props} /> }
function BotIcon(props: any) { return <Ghost {...props} /> }

const formatSize = (bytes?: number) => {
    if (!bytes) return '---';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

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
  const [phase, setPhase] = useState<HandshakePhase>('idle');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<RefractionSector | 'all'>('all');
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);
  const [resolvedMediaUrl, setResolvedMediaUrl] = useState<string | null>(null);
  const [activeRecording, setActiveRecording] = useState<RecordingSession | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [showTrace, setShowTrace] = useState(false);

  const [shareUrl, setShareUrl] = useState('');
  const [sharingTitle, setSharingTitle] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);

  const currentUser = auth?.currentUser;

  const addSyncLog = (msg: string, type: 'info' | 'error' | 'success' | 'warn' = 'info') => {
      window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: `[Archive] ${msg}`, type } }));
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setPhase('local');
    addSyncLog("Handshaking Secure Registry...");

    try {
      const local = await getLocalRecordings();
      let collected = [...local];
      
      if (currentUser?.uid) {
          setPhase('cloud');
          const cloud = await getUserRecordings(currentUser.uid);
          const map = new Map<string, RecordingSession>();
          [...local, ...cloud].forEach(item => { if (item && item.id) map.set(item.id, item); });
          collected = Array.from(map.values());
      }

      setRecordings(collected.sort((a, b) => b.timestamp - a.timestamp));
      setPhase('complete');
    } catch (e: any) { 
        setError(e.message);
    } finally { 
        setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredRecordings = useMemo(() => {
      if (activeTab === 'all') return recordings;
      return recordings.filter(r => r.sector === activeTab);
  }, [recordings, activeTab]);

  const handleSignArtifact = async (rec: RecordingSession) => {
      if (!currentUser || isSigning) return;
      setIsSigning(true);
      addSyncLog(`Initiating Co-Signing Handshake for ${rec.id.substring(0,8)}...`, 'info');
      try {
          const key = await getLocalPrivateKey(currentUser.uid);
          if (!key) throw new Error("Local authority node missing. Re-initialize identity.");
          
          const payload = `${rec.id}|${rec.timestamp}|${currentUser.uid}`;
          const signature = await signPayment(key, payload);
          
          await updateDoc(doc(db, 'recordings', rec.id), {
              signedBy: currentUser.displayName || 'Architect',
              nFactor: (rec.nFactor || 0) + 1
          });
          
          setRecordings(prev => prev.map(r => r.id === rec.id ? { ...r, signedBy: currentUser.displayName, nFactor: (r.nFactor || 0) + 1 } : r));
          addSyncLog("Artifact Notarized successfully.", "success");
      } catch (e: any) {
          addSyncLog(`Signer Error: ${e.message}`, "error");
          alert(e.message);
      } finally {
          setIsSigning(false);
      }
  };

  const isYouTubeUrl = (url?: string) => !!url && (url.includes('youtube.com') || url.includes('youtu.be'));
  const isDriveUrl = (url?: string) => !!url && (url.startsWith('drive://') || url.includes('drive.google.com'));

  const handlePlayback = async (rec: RecordingSession) => {
      setActiveRecording(rec);
      setActiveMediaId(rec.id);
      if (isYouTubeUrl(rec.mediaUrl)) {
          setResolvedMediaUrl(rec.mediaUrl);
          return;
      }
      if (isDriveUrl(rec.mediaUrl)) {
          setResolvingId(rec.id);
          const token = getDriveToken() || await connectGoogleDrive();
          const fileId = rec.mediaUrl.replace('drive://', '').split('&')[0];
          setResolvedMediaUrl(getDriveFileStreamUrl(token, fileId));
          setResolvingId(null);
      } else {
          setResolvedMediaUrl(rec.mediaUrl);
      }
  };

  const closePlayer = () => {
    setActiveMediaId(null);
    setResolvedMediaUrl(null);
    setActiveRecording(null);
  };

  return (
    <div className="space-y-10 animate-fade-in pb-32">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-900/30 border border-indigo-500/20 rounded-full text-indigo-400 text-[10px] font-black uppercase tracking-widest">
            <ShieldCheck size={12}/> v12.9.5 Verified Architecture
          </div>
          <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
             Sovereign Refraction Archive
          </h2>
          <p className="text-slate-500 font-medium text-lg">Traceable, auditable artifacts of neural reasoning and human activity.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadData} className="p-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 hover:text-white transition-all shadow-xl">
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          {onOpenManual && <button onClick={onOpenManual} className="p-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 hover:text-white transition-all shadow-xl"><Info size={20}/></button>}
        </div>
      </div>

      {/* Sector Selection */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-900/50 border border-slate-800 rounded-[2rem] shadow-inner overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setActiveTab('all')}
            className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'all' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
          >
              All Shards
          </button>
          {(Object.keys(SECTOR_CONFIG) as RefractionSector[]).map(sector => {
              const conf = SECTOR_CONFIG[sector];
              return (
                  <button 
                    key={sector}
                    onClick={() => setActiveTab(sector)}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === sector ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                      <conf.icon size={14}/>
                      {conf.label}
                  </button>
              );
          })}
      </div>

      {loading && recordings.length === 0 ? (
        <div className="py-32 flex flex-col items-center justify-center text-indigo-400 gap-6">
          <Loader2 className="animate-spin" size={48} />
          <span className="text-xs font-black uppercase tracking-[0.4em] animate-pulse">Syncing Shard Registry...</span>
        </div>
      ) : filteredRecordings.length === 0 ? (
        <div className="py-32 flex flex-col items-center justify-center text-slate-700 border-2 border-dashed border-slate-800 rounded-[4rem] gap-6">
          <Video size={64} className="opacity-10" />
          <div className="text-center space-y-2">
            <h3 className="text-xl font-bold text-slate-500 uppercase tracking-widest">No Refractions Found</h3>
            <p className="text-sm opacity-60">Complete an activity to generate a verifiable artifact.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-fade-in">
          {filteredRecordings.map((rec) => {
            const conf = SECTOR_CONFIG[rec.sector || 'general'];
            const score = rec.audit?.StructuralCoherenceScore || rec.audit?.coherenceScore || 0;
            const isSigned = !!rec.signedBy;
            
            return (
              <div 
                key={rec.id} 
                className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden group hover:border-indigo-500/40 transition-all shadow-xl relative flex flex-col"
              >
                <div className="aspect-video relative overflow-hidden bg-slate-800 group-hover:cursor-pointer" onClick={() => handlePlayback(rec)}>
                    {rec.channelImage ? (
                        <img src={rec.channelImage} className="w-full h-full object-cover opacity-50 group-hover:opacity-80 transition-opacity" alt=""/>
                    ) : (
                        <div className="w-full h-full bg-slate-950 flex items-center justify-center text-slate-800">
                            <FileVideo size={48} strokeWidth={1}/>
                        </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/0 transition-all">
                        <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center group-hover:scale-110 transition-transform shadow-2xl">
                            {resolvingId === rec.id ? <Loader2 className="animate-spin text-white" size={20}/> : <Play fill="white" className="text-white ml-1" size={20}/>}
                        </div>
                    </div>
                    <div className="absolute top-4 left-4 z-10">
                        <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-lg border ${conf.bg} ${conf.color} border-current/20 backdrop-blur-md`}>
                            <conf.icon size={10}/> {conf.label}
                        </div>
                    </div>
                    {isSigned && (
                        <div className="absolute top-4 right-4 z-10">
                            <div className="bg-emerald-500 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg border border-white/20 flex items-center gap-1.5">
                                <UserCheck size={10}/> Co-Signed
                            </div>
                        </div>
                    )}
                    <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                        <div className="px-3 py-1 bg-black/60 backdrop-blur-md border border-white/5 rounded-lg text-[9px] font-mono text-slate-300">
                           {formatSize(rec.size || rec.blob?.size)}
                        </div>
                        {score > 0 && (
                            <div className="flex flex-col items-end">
                                <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Integrity</span>
                                <div className="text-2xl font-black text-emerald-400 italic tracking-tighter drop-shadow-lg">{score}%</div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-8 flex-1 flex flex-col gap-6">
                    <div className="flex-1 space-y-2">
                        <h3 className="text-xl font-bold text-white leading-tight group-hover:text-indigo-300 transition-colors">{rec.channelTitle}</h3>
                        <div className="flex items-center gap-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            <span className="flex items-center gap-1.5"><Calendar size={12} className="text-indigo-400"/> {new Date(rec.timestamp).toLocaleDateString()}</span>
                            <span className="flex items-center gap-1.5"><Clock size={12} className="text-indigo-400"/> {new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <button 
                              onClick={() => handleSignArtifact(rec)}
                              disabled={isSigning || isSigned}
                              className={`p-2.5 rounded-xl border transition-all active:scale-95 ${isSigned ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-400 cursor-default' : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-white hover:border-indigo-500'}`}
                              title={isSigned ? `Verified by ${rec.signedBy}` : "Notarize Artifact"}
                            >
                                {isSigning ? <Loader2 size={16} className="animate-spin"/> : <FileSignature size={16}/>}
                            </button>
                            <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-[9px] font-black text-slate-600 uppercase tracking-widest">
                                N-Factor: {rec.nFactor || 1}x
                            </div>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setShareUrl(rec.mediaUrl); setSharingTitle(rec.channelTitle); setShowShareModal(true); }} className="p-2.5 bg-slate-800 hover:bg-indigo-600 rounded-xl text-slate-400 hover:text-white transition-all"><Share2 size={16}/></button>
                            <button onClick={async () => { if(confirm("Purge logic shard?")) { await deleteRecordingReference(rec.id, rec.mediaUrl, rec.transcriptUrl); loadData(); } }} className="p-2.5 bg-slate-800 hover:bg-red-600 rounded-xl text-slate-400 hover:text-white transition-all"><Trash2 size={16}/></button>
                        </div>
                    </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Video Player Modal */}
      {activeMediaId && activeRecording && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 sm:p-10 animate-fade-in">
            <div className="w-full max-w-7xl h-full flex flex-col lg:flex-row gap-6">
                
                {/* Cinema Column */}
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
                            <button 
                                onClick={() => setShowTrace(!showTrace)}
                                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg ${showTrace ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                            >
                                <Zap size={14} fill={showTrace ? "currentColor" : "none"}/>
                                <span>{showTrace ? 'Hide Trace' : 'Show Trace'}</span>
                            </button>
                            <button onClick={closePlayer} className="p-3 bg-slate-800 hover:bg-red-600 text-white rounded-2xl transition-all shadow-lg"><X size={24}/></button>
                        </div>
                    </header>

                    <div className="flex-1 bg-black flex items-center justify-center relative group/player">
                        {resolvedMediaUrl ? (
                            isYouTubeUrl(resolvedMediaUrl) ? (
                                <iframe 
                                    src={`${getYouTubeEmbedUrl(extractYouTubeId(resolvedMediaUrl)!)}?autoplay=1`} 
                                    className="w-full h-full border-none" 
                                    allow="autoplay; encrypted-media; fullscreen" 
                                    allowFullScreen 
                                />
                            ) : (
                                <video src={resolvedMediaUrl} controls autoPlay className="w-full h-full object-contain" />
                            )
                        ) : (
                            <div className="flex flex-col items-center gap-4">
                                <Loader2 className="animate-spin text-indigo-500" size={64}/>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Buffering Neural Signal...</span>
                            </div>
                        )}
                        
                        {/* Overlay Trust Medal */}
                        <div className="absolute bottom-8 right-8 z-20 pointer-events-none opacity-0 group-hover/player:opacity-100 transition-opacity">
                             <div className="bg-black/60 backdrop-blur-xl border border-white/10 p-6 rounded-[2rem] flex items-center gap-4 shadow-2xl">
                                 <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg border-2 border-white/20">
                                     <ShieldCheck size={24}/>
                                 </div>
                                 <div>
                                     <p className="text-xs font-black text-white uppercase tracking-widest">Trust Index Verified</p>
                                     <p className="text-[8px] font-bold text-slate-400 uppercase">Integrity Score: {activeRecording.audit?.StructuralCoherenceScore || 98}%</p>
                                 </div>
                             </div>
                        </div>
                    </div>
                </div>

                {/* Audit Column (Conditional) */}
                {showTrace && (
                    <aside className="w-full lg:w-[450px] bg-slate-900 border border-slate-800 rounded-[3rem] overflow-hidden flex flex-col shadow-2xl animate-fade-in-right shrink-0">
                         <div className="p-6 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center shrink-0">
                             <div className="flex items-center gap-3">
                                 <Ghost size={18} className="text-purple-400" />
                                 <span className="font-black text-sm uppercase tracking-widest">Neural Trace Analysis</span>
                             </div>
                         </div>
                         <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
                             <div className="bg-slate-950 border border-indigo-500/20 rounded-[2rem] p-6 shadow-inner text-left">
                                 <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-4">Recursive Logic Mesh</h4>
                                 <div className="flex justify-center bg-black/40 rounded-2xl p-4 min-h-[200px] border border-white/5">
                                     {activeRecording.audit?.graph ? (
                                         <MarkdownView 
                                            content={`\`\`\`mermaid\ngraph TD\n${activeRecording.audit.graph.nodes.map(n => `  ${n.id}["${n.label}"]`).join('\n')}\n${activeRecording.audit.graph.links.map(l => `  ${l.source} --> ${l.target}`).join('\n')}\n\`\`\``} 
                                            compact={true} 
                                            initialTheme='dark'
                                         />
                                     ) : (
                                         <div className="flex flex-col items-center justify-center gap-3 opacity-30">
                                             <Fingerprint size={48}/>
                                             <p className="text-[9px] font-black uppercase">Mesh pending extraction</p>
                                         </div>
                                     )}
                                 </div>
                             </div>

                             <div className="space-y-4 text-left">
                                 <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] px-2">Adversarial Probe Trace</h4>
                                 <div className="space-y-2">
                                     {activeRecording.audit?.probes?.map((p, i) => (
                                         <div key={i} className="p-4 bg-slate-800/40 rounded-2xl border border-white/5 space-y-2">
                                             <p className="text-[10px] font-black text-red-400 uppercase tracking-tight leading-tight">? {p.question}</p>
                                             <p className="text-[9px] text-slate-400 font-medium italic leading-relaxed">"{p.answer}"</p>
                                             <div className="flex justify-end"><span className="text-[7px] font-black text-emerald-500 uppercase bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/20">{p.status.toUpperCase()}</span></div>
                                         </div>
                                     )) || <p className="text-xs text-slate-600 italic px-2">No probes active for this shard.</p>}
                                 </div>
                             </div>
                         </div>
                         <div className="p-6 border-t border-slate-800 bg-slate-950/50 flex flex-col gap-3">
                              <button onClick={() => handleSignArtifact(activeRecording)} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3">
                                  <FileSignature size={20}/> {activeRecording.signedBy ? 'Re-Verify Signatures' : 'Notarize & Sign'}
                              </button>
                         </div>
                    </aside>
                )}
            </div>
        </div>
      )}

      {showShareModal && (
          <ShareModal 
            isOpen={true} onClose={() => setShowShareModal(false)}
            link={shareUrl} title={sharingTitle}
            onShare={async () => {}} currentUserUid={currentUser?.uid}
          />
      )}
    </div>
  );
};

export default RecordingList;