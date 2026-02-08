
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShieldCheck, Activity, BrainCircuit, Globe, 
  ChevronRight, AlertTriangle, CheckCircle2, 
  Network, Zap, Ghost, Target, BarChart3, Database,
  ArrowLeft, Search, RefreshCw, Loader2, Info, Star, X,
  FileText, Wand2, Layers, Cpu, Sparkles, FileSearch,
  Filter, ZapOff, Fingerprint, SearchCode, Beaker, Terminal, Download, FileCode, FileDown,
  Layout, BookOpen, ChevronDown, Signal, Library, BookText
} from 'lucide-react';
import { collection, query, getDocs, limit, orderBy, where } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { GeneratedLecture, Channel, SubTopic } from '../types';
import { SYSTEM_AUDIT_NODES } from '../utils/auditContent';
import { generateLectureScript, performNeuralLensAudit, summarizeLectureForContext } from '../services/lectureGenerator';
import { generateCurriculum } from '../services/curriculumGenerator';
import { SPOTLIGHT_DATA } from '../utils/spotlightContent';
import { logger } from '../services/logger';
import { HANDCRAFTED_CHANNELS } from '../utils/initialData';
import { SYSTEM_BOOKS } from '../utils/bookContent';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface NeuralLensProps {
  onBack: () => void;
  onOpenManual?: () => void;
}

interface HierarchyNode {
    id: string;
    title: string;
    description: string;
    shards: any[];
    type: 'podcast' | 'book';
    priority: number;
}

export const NeuralLens: React.FC<NeuralLensProps> = ({ onBack, onOpenManual }) => {
  const [cloudAudits, setCloudAudits] = useState<GeneratedLecture[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [activeAudit, setActiveAudit] = useState<GeneratedLecture | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAuditing, setIsAuditing] = useState(false);
  const [isDemoRunning, setIsDemoRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'audit' | 'script'>('audit');
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [expandedSectors, setExpandedSectors] = useState<Record<string, boolean>>({
      'platform-core': true,
      'judge-deep-dive': true
  });

  const dispatchLog = (text: string, type: any = 'info', meta?: any) => {
      logger[type as keyof typeof logger](text, { category: 'NEURAL_LENS', ...meta });
  };

  const loadData = async () => {
    if (!db) {
        setLoading(false);
        return;
    }
    setLoading(true);
    try {
        const auditQ = query(collection(db, 'lecture_cache'), orderBy('audit.timestamp', 'desc'), limit(100));
        const channelQ = query(collection(db, 'channels'), limit(50));
        const [auditSnap, channelSnap] = await Promise.all([getDocs(auditQ), getDocs(channelQ)]);

        const audits = auditSnap.docs.map(d => d.data() as GeneratedLecture).filter(l => !!l.audit);
        const chanData = channelSnap.docs.map(d => d.data() as Channel);
        
        setCloudAudits(audits);
        setChannels(chanData);
        dispatchLog(`Ledger Scan Complete. Hydrated ${audits.length} verified nodes.`, 'success');
    } catch (e: any) {
        dispatchLog(`Ledger Sync Failure: ${e.message}`, 'error');
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const formatScore = (score: number) => {
      if (score === undefined || score === null) return '0';
      // Normalize decimal scores (0.98) to percentage (98)
      const val = score <= 1 ? Math.round(score * 100) : Math.round(score);
      return val.toString();
  };

  const handleFullSpectrumDemo = async () => {
      if (isDemoRunning) return;
      setIsDemoRunning(true);
      setActiveAudit(null);
      setSelectedNode(null);
      setActiveTab('audit');
      
      const topic = "Self-Documenting AI Orchestration";
      const description = "A deep technical exploration of the Neural Prism architecture and Gemini 3.0 multi-agent loops.";
      dispatchLog(">>> INITIALIZING STATEFUL REFRACTION LOOP <<<", 'warn');

      try {
          // PHASE 1: Curriculum Synthesis
          dispatchLog("PHASE 1: Core Curriculum Synthesis...", 'info');
          const chapters = await generateCurriculum(topic, description, 'en');
          if (!chapters || chapters.length === 0) throw new Error("Curriculum Refraction Failed.");
          dispatchLog(`Index synthesized: ${chapters.length} chapters identified. Sharding spectrum...`, 'success');

          // PHASE 2: Sequential Synthesis Loop with Cumulative Context
          let cumulativeContext = "";
          const demoNodes = chapters[0].subTopics.slice(0, 3);
          
          for (let i = 0; i < demoNodes.length; i++) {
              const node = demoNodes[i];
              dispatchLog(`PHASE 2 [Node ${i+1}/${demoNodes.length}]: Refracting [${node.title}]...`, 'info', { nodeId: node.id });
              
              const lecture = await generateLectureScript(
                  node.title, 
                  description, 
                  'en', 
                  'demo-session', 
                  'Zephyr', 
                  true, 
                  undefined, 
                  cumulativeContext
              );

              if (!lecture) throw new Error(`Synthesis failed at node: ${node.title}`);
              
              // Extract summary context for next node in loop
              const nodeSummary = await summarizeLectureForContext(lecture);
              cumulativeContext += `\nSection ${i+1} [${node.title}] Summary: ${nodeSummary}\n`;
              dispatchLog(`Node ${i+1} SECURED. Knowledge Shard added to cumulative buffer.`, 'success', { 
                  inputSizeBytes: new TextEncoder().encode(cumulativeContext).length,
                  outputSizeBytes: new TextEncoder().encode(nodeSummary).length
              });

              // Final Phase: Audit the resulting technical artifact
              if (i === demoNodes.length - 1) {
                  dispatchLog("PHASE 3: Dispatching Final Shard to Shadow Agent for Reasoning Audit...", 'info');
                  const audit = await performNeuralLensAudit(lecture);
                  if (audit) {
                      const finalized = { ...lecture, audit };
                      setActiveAudit(finalized);
                      setSelectedNode({ ...finalized, status: 'audited' });
                      dispatchLog(`Verification Finalized. Coherence Score: ${formatScore(audit.coherenceScore)}%`, 'success');
                      dispatchLog(">>> STATEFUL REFRACTION CYCLE COMPLETE <<<", 'success');
                  }
              }
          }
      } catch (e: any) {
          dispatchLog(`Refraction Interrupted: ${e.message}`, 'error');
      } finally {
          setIsDemoRunning(false);
      }
  };

  const hierarchy = useMemo(() => {
    const sectors: Record<string, HierarchyNode> = {};
    const getChan = (id: string) => channels.find(c => c.id === id) || HANDCRAFTED_CHANNELS.find(c => c.id === id);

    // Initialize all Sectors from Podcasts
    [...HANDCRAFTED_CHANNELS, ...channels].forEach(c => {
        if (!sectors[c.id]) {
            sectors[c.id] = { id: c.id, title: c.title, description: c.description, shards: [], type: 'podcast', priority: c.id === 'judge-deep-dive' ? 100 : 0 };
        }
    });

    // Initialize Sectors from Books
    SYSTEM_BOOKS.forEach(b => {
        if (!sectors[b.id]) {
            sectors[b.id] = { id: b.id, title: b.title, description: b.subtitle, shards: [], type: 'book', priority: b.id === 'platform-core' ? 100 : 0 };
        }
    });

    // 1. Audited Nodes: Group by their parent identity
    [...SYSTEM_AUDIT_NODES, ...cloudAudits].forEach(item => {
        if (!item?.topic) return;
        const parentId = (item as any).channelId || (item as any).bookId || 'system-artifacts';
        if (!sectors[parentId]) {
            sectors[parentId] = { id: parentId, title: 'System Shards', description: 'Internal platform logic.', shards: [], type: 'podcast', priority: 0 };
        }
        sectors[parentId].shards.push({ ...item, status: 'audited' });
    });

    // 2. Staged Content: Group by spotlight channel
    Object.entries(SPOTLIGHT_DATA).forEach(([chanId, data]) => {
        if (!sectors[chanId]) {
            const chan = getChan(chanId);
            sectors[chanId] = { id: chanId, title: chan?.title || chanId, description: chan?.description || '', shards: [], type: 'podcast', priority: chanId === 'judge-deep-dive' ? 100 : 0 };
        }
        Object.keys(data.lectures).forEach(topic => {
            const alreadyIn = sectors[chanId].shards.some(s => s.topic === topic);
            if (!alreadyIn) sectors[chanId].shards.push({ topic, status: 'staged', lecture: data.lectures[topic] });
        });
    });

    // 3. Ghost Nodes from Books
    SYSTEM_BOOKS.forEach(book => {
        book.pages.forEach(page => {
            const alreadyIn = sectors[book.id].shards.some(s => s.topic === page.title);
            if (!alreadyIn) sectors[book.id].shards.push({ topic: page.title, status: 'ghost' });
        });
    });

    // 4. Ghost Nodes from Podcasts
    [...HANDCRAFTED_CHANNELS, ...channels].forEach(chan => {
        chan.chapters?.forEach(chapter => {
            chapter.subTopics.forEach(sub => {
                const alreadyIn = sectors[chan.id].shards.some(s => s.topic === sub.title);
                if (!alreadyIn) sectors[chan.id].shards.push({ topic: sub.title, status: 'ghost' });
            });
        });
    });

    const results = Object.values(sectors).filter(s => s.shards.length > 0);
    
    // SOVEREIGN PRIORITY SORTING:
    // Books first, then Podcasts.
    // Within each, sort by priority descending (pinned items first), then title.
    return results.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'book' ? -1 : 1;
        if (a.priority !== b.priority) return b.priority - a.priority;
        return a.title.localeCompare(b.title);
    });
  }, [cloudAudits, channels]);

  const filteredHierarchy = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return hierarchy;
    return hierarchy.map(sector => ({
        ...sector,
        shards: sector.shards.filter(s => s.topic.toLowerCase().includes(q))
    })).filter(sector => sector.shards.length > 0 || sector.title.toLowerCase().includes(q));
  }, [hierarchy, searchQuery]);

  const handleSelectNode = (node: any) => {
    setSelectedNode(node);
    if (node.status === 'audited' && node.audit) {
        setActiveAudit(node);
    } else {
        setActiveAudit(null);
    }
  };

  const handleTriggerAudit = async (node: any) => {
      setIsAuditing(true);
      setActiveAudit(null);
      dispatchLog(`Targeting Node Identity: ${node.topic}...`, 'info');
      
      try {
          let lecture: GeneratedLecture | null = null;
          
          // CORE FIX: Check for pre-existing logic shards before triggering refraction
          if (node.status === 'audited') {
              lecture = node;
          } 
          else if (node.status === 'staged' && node.lecture) {
              lecture = node.lecture;
          }
          else {
              // SEARCH STATIC REGISTRIES (Spotlight & Books)
              const spotlightMatch = Object.values(SPOTLIGHT_DATA).find(data => data.lectures[node.topic]);
              if (spotlightMatch) {
                  lecture = spotlightMatch.lectures[node.topic];
              } else {
                  const bookMatch = SYSTEM_BOOKS.find(b => b.pages.some(p => p.title === node.topic));
                  if (bookMatch) {
                      const page = bookMatch.pages.find(p => p.title === node.topic);
                      lecture = {
                          topic: node.topic,
                          professorName: bookMatch.author,
                          studentName: "Staff Auditor",
                          sections: [{ speaker: 'Teacher', text: page?.content || bookMatch.subtitle }]
                      };
                  }
              }
          }

          // ONLY REFRACT IF NOT FOUND IN STATIC REGISTRY
          if (!lecture) {
              const chan = channels.find(c => c.chapters?.some(ch => ch.subTopics.some(st => st.title === node.topic))) ||
                           HANDCRAFTED_CHANNELS.find(c => c.chapters?.some(ch => ch.subTopics.some(st => st.title === node.topic)));
              if (!chan) throw new Error("Node context missing in local and handcrafted registries.");
              
              lecture = await generateLectureScript(node.topic, chan.description, 'en', chan.id, chan.voiceName);
          }

          if (!lecture) throw new Error("AI Refraction failed.");
          
          // PERFORM SHADOW AUDIT
          const audit = await performNeuralLensAudit(lecture);
          if (audit) {
              const finalized = { ...lecture, audit };
              setActiveAudit(finalized);
              setSelectedNode({ ...finalized, status: 'audited' });
              dispatchLog(`Formal Handshake Finalized. Logic Integrity: ${formatScore(audit.coherenceScore)}%`, 'success');
              loadData(); 
          }
      } catch (e: any) {
          dispatchLog(`Audit Interrupted: ${e.message}`, 'error');
      } finally {
          setIsAuditing(false);
      }
  };

  const handleDownloadScript = () => {
    if (!activeAudit) return;
    const content = activeAudit.sections
      .map(s => `${s.speaker === 'Teacher' ? activeAudit.professorName : activeAudit.studentName}: ${s.text}`)
      .join('\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeAudit.topic.replace(/\s+/g, '_')}_Transcript.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    dispatchLog(`Technical Transcript Exported: ${activeAudit.topic}`, 'success');
  };

  const handleExportPDF = async () => {
    const el = document.getElementById('pdf-export-content');
    if (!activeAudit || !el) return;
    setIsExportingPDF(true);
    try {
        const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' });
        const imgWidth = pdf.internal.pageSize.getWidth();
        pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, (canvas.height * imgWidth) / canvas.width);
        pdf.save(`${activeAudit.topic.replace(/\s+/g, '_')}_Artifact.pdf`);
    } catch (e: any) {
        dispatchLog(`PDF Fault: ${e.message}`, 'error');
    } finally {
        setIsExportingPDF(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-30">
          <div className="flex items-center gap-4">
              <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"><ArrowLeft size={20} /></button>
              <div>
                <h1 className="text-lg font-bold text-white flex items-center gap-2 uppercase tracking-tighter italic"><ShieldCheck className="text-indigo-400" /> Neural Lens</h1>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Reasoning Observability Matrix</p>
              </div>
          </div>
          <div className="flex items-center gap-3">
              <button onClick={loadData} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all"><RefreshCw size={18} className={loading ? 'animate-spin' : ''} /></button>
              {onOpenManual && <button onClick={onOpenManual} className="p-2 text-slate-400 hover:text-white" title="Lens Manual"><Info size={18}/></button>}
          </div>
      </header>

      <div className="flex-1 flex overflow-hidden flex-col lg:flex-row">
          <aside className="w-full lg:w-96 border-r border-slate-800 bg-slate-900/30 flex flex-col shrink-0">
              <div className="p-4 border-b border-slate-800 space-y-4 bg-slate-950/40">
                  <button onClick={handleFullSpectrumDemo} disabled={isDemoRunning || isAuditing} className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 group">
                      {isDemoRunning ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} className="group-hover:rotate-12 transition-transform" />}
                      Stateful Refraction Demo
                  </button>
                  <div className="relative group">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400" size={14}/>
                      <input type="text" placeholder="Search sectors or shards..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-8 py-2.5 text-[10px] text-white outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner"/>
                  </div>
                  
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-inner relative overflow-hidden group/counter">
                      <div className="flex items-center justify-between relative z-10">
                          <div className="space-y-1">
                              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                  <Library size={12} className="text-indigo-400"/> Discovery Spectrum
                              </p>
                              <p className="text-2xl font-black text-white italic tracking-tighter uppercase">{filteredHierarchy.length} <span className="text-[10px] text-slate-600 not-italic ml-1">Sectors</span></p>
                          </div>
                          <div className="p-2 bg-indigo-600/10 rounded-xl text-indigo-400 border border-indigo-500/20 group-hover/counter:scale-110 transition-transform">
                              <Signal size={20} className="animate-pulse" />
                          </div>
                      </div>
                      <div className="absolute top-0 right-0 p-12 bg-indigo-500/5 blur-2xl rounded-full"></div>
                  </div>
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-hide p-2 space-y-6">
                  {loading && hierarchy.length === 0 ? (
                      <div className="py-20 flex flex-col items-center gap-4 text-center">
                          <Loader2 className="animate-spin text-indigo-500" size={24} /><span className="text-[8px] font-black uppercase text-slate-600 tracking-widest">Hydrating Ledger...</span>
                      </div>
                  ) : (
                      <>
                        {/* SECTION: BOOKS */}
                        <div className="space-y-2">
                            <h3 className="px-3 text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] flex items-center gap-2"><BookText size={12} className="text-emerald-500"/> Technical Manuscripts</h3>
                            {filteredHierarchy.filter(s => s.type === 'book').map((sector) => (
                                <div key={sector.id} className="space-y-1">
                                    <button 
                                      onClick={() => setExpandedSectors(prev => ({ ...prev, [sector.id]: !prev[sector.id] }))}
                                      className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg group transition-all ${expandedSectors[sector.id] ? 'bg-slate-800/40 border border-white/5' : 'hover:bg-slate-800/50'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Layers size={14} className="text-emerald-400"/>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-white transition-colors truncate max-w-[180px]">{sector.title}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[8px] font-black text-slate-600 uppercase">{sector.shards.length}</span>
                                            <ChevronDown size={14} className={`text-slate-600 transition-transform ${expandedSectors[sector.id] ? 'rotate-180' : ''}`} />
                                        </div>
                                    </button>
                                    
                                    {expandedSectors[sector.id] && (
                                        <div className="pl-4 space-y-1 animate-fade-in">
                                            {sector.shards.map((shard, i) => {
                                                const isFocused = selectedNode?.topic === shard.topic;
                                                return (
                                                    <button 
                                                      key={i} 
                                                      onClick={() => handleSelectNode(shard)}
                                                      className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${isFocused ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg' : 'bg-slate-900 border-transparent text-slate-500 hover:bg-slate-800'}`}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-1.5 h-1.5 rounded-full ${shard.status === 'audited' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-slate-800'}`}></div>
                                                            <span className={`text-[10px] font-bold uppercase truncate max-w-[140px] ${isFocused ? 'text-white' : 'text-slate-300'}`}>{shard.topic}</span>
                                                        </div>
                                                        {shard.status === 'audited' && <span className="text-[8px] font-mono font-bold opacity-60">{formatScore(shard.audit?.coherenceScore || shard.score)}%</span>}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* SECTION: PODCASTS */}
                        <div className="space-y-2">
                            <h3 className="px-3 text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] flex items-center gap-2"><Activity size={12} className="text-indigo-500"/> Activity Sectors</h3>
                            {filteredHierarchy.filter(s => s.type === 'podcast').map((sector) => (
                                <div key={sector.id} className="space-y-1">
                                    <button 
                                      onClick={() => setExpandedSectors(prev => ({ ...prev, [sector.id]: !prev[sector.id] }))}
                                      className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg group transition-all ${expandedSectors[sector.id] ? 'bg-slate-800/40 border border-white/5' : 'hover:bg-slate-800/50'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Layout size={14} className="text-indigo-400"/>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-white transition-colors truncate max-w-[180px]">{sector.title}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[8px] font-black text-slate-600 uppercase">{sector.shards.length}</span>
                                            <ChevronDown size={14} className={`text-slate-600 transition-transform ${expandedSectors[sector.id] ? 'rotate-180' : ''}`} />
                                        </div>
                                    </button>
                                    
                                    {expandedSectors[sector.id] && (
                                        <div className="pl-4 space-y-1 animate-fade-in">
                                            {sector.shards.map((shard, i) => {
                                                const isFocused = selectedNode?.topic === shard.topic;
                                                return (
                                                    <button 
                                                      key={i} 
                                                      onClick={() => handleSelectNode(shard)}
                                                      className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${isFocused ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-slate-900 border-transparent text-slate-500 hover:bg-slate-800'}`}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-1.5 h-1.5 rounded-full ${shard.status === 'audited' ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : shard.status === 'staged' ? 'bg-amber-500' : 'bg-slate-800'}`}></div>
                                                            <span className={`text-[10px] font-bold uppercase truncate max-w-[140px] ${isFocused ? 'text-white' : 'text-slate-300'}`}>{shard.topic}</span>
                                                        </div>
                                                        {shard.status === 'audited' && <span className="text-[8px] font-mono font-bold opacity-60">{formatScore(shard.audit?.coherenceScore || shard.score)}%</span>}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                      </>
                  )}
              </div>
          </aside>

          <main className="flex-1 bg-black/20 overflow-y-auto scrollbar-hide p-8 lg:p-12 relative flex flex-col items-center">
              {(isAuditing || isDemoRunning) && (
                  <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-40 flex flex-col items-center justify-center gap-10 animate-fade-in">
                      <div className="relative">
                          <div className="w-28 h-28 border-4 border-indigo-500/10 rounded-full"></div>
                          <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                          <div className="absolute inset-0 flex items-center justify-center"><Activity size={40} className="text-indigo-400 animate-pulse" /></div>
                      </div>
                      <div className="text-center space-y-4">
                          <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Shadow Handshake Active</h3>
                          <p className="text-xs text-slate-500 font-bold uppercase tracking-[0.2em] max-w-xs leading-relaxed">{isDemoRunning ? 'Synthesizing Spectrum Loop with Cumulative Knowledge...' : 'Auditing reasoning chains...'}</p>
                          <div className="flex justify-center gap-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce"></div>
                             <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce delay-75"></div>
                             <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce delay-150"></div>
                          </div>
                      </div>
                  </div>
              )}

              {activeAudit?.audit ? (
                  <div className="max-w-4xl w-full mx-auto space-y-12 animate-fade-in-up">
                      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-800 pb-8">
                          <div className="space-y-3 text-left">
                              <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">{activeAudit.topic}</h2>
                              <div className="flex items-center gap-4">
                                  <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 shadow-inner">
                                      <button onClick={() => setActiveTab('audit')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${activeTab === 'audit' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Reasoning Mesh</button>
                                      <button onClick={() => setActiveTab('script')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${activeTab === 'script' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Source Script</button>
                                  </div>
                              </div>
                          </div>
                          <div className="bg-slate-900 border border-slate-800 px-8 py-4 rounded-[2.5rem] shadow-inner text-center">
                              <p className="text-[8px] font-black text-slate-600 uppercase mb-1 tracking-widest">Coherence Score</p>
                              <p className="text-4xl font-black text-emerald-400 italic tracking-tighter">{formatScore(activeAudit.audit.coherenceScore)}%</p>
                          </div>
                      </div>

                      {activeTab === 'audit' ? (
                        <div className="space-y-12 animate-fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-xl flex flex-col items-center text-center gap-4 group hover:border-indigo-500/20 transition-all">
                                    <div className="p-3 bg-indigo-900/30 text-indigo-400 rounded-2xl"><Activity size={24}/></div>
                                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Logical Drift Risk</h4>
                                    <div className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest border ${activeAudit.audit.driftRisk === 'Low' ? 'bg-emerald-950/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-950/20 text-amber-400'}`}>{activeAudit.audit.driftRisk} Risk</div>
                                </div>
                                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-xl flex flex-col items-center text-center gap-4 group hover:border-purple-500/20 transition-all">
                                    <div className="p-3 bg-purple-900/30 text-purple-400 rounded-2xl"><ShieldCheck size={24}/></div>
                                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Model Robustness</h4>
                                    {/* Fix: use activeAudit.audit.robustness instead of GeneratedLecture.robustness */}
                                    <div className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest border ${activeAudit.audit.robustness === 'High' ? 'bg-emerald-950/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-950/20 text-amber-400'}`}>{activeAudit.audit.robustness} Rank</div>
                                </div>
                            </div>

                            <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-24 bg-indigo-500/5 blur-[100px] rounded-full group-hover:bg-indigo-500/10 transition-colors"></div>
                                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-12 flex items-center gap-3"><Network size={18} className="text-indigo-400"/> Reasoning Dependency Mesh</h4>
                                <div className="flex flex-wrap gap-6 justify-center items-center py-6 relative z-10">
                                    {activeAudit.audit.graph.nodes.map(node => (
                                        <div key={node.id} className="bg-slate-950 border border-slate-800 px-6 py-4 rounded-[1.5rem] shadow-xl flex flex-col items-center hover:border-indigo-500 transition-all group/node">
                                            <span className="text-[8px] font-black text-slate-600 uppercase mb-1 group-hover/node:text-indigo-400 transition-colors">{node.type}</span>
                                            <span className="text-xs font-bold text-white uppercase">{node.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                      ) : (
                        <div className="space-y-8 animate-fade-in-up">
                            <div className="flex justify-between items-center bg-slate-900/40 p-6 rounded-3xl border border-white/5">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-indigo-600/10 text-indigo-400 rounded-2xl border border-indigo-500/20"><FileCode size={24}/></div>
                                    <div><h3 className="font-bold text-white uppercase tracking-tight">Technical Transcript</h3><p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Logic sequence archive</p></div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button onClick={handleDownloadScript} className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95"><Download size={14}/> <span>Text Export</span></button>
                                    <button onClick={handleExportPDF} disabled={isExportingPDF} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 disabled:opacity-50">{isExportingPDF ? <Loader2 size={14} className="animate-spin"/> : <FileDown size={14}/>} <span>PDF Export</span></button>
                                </div>
                            </div>
                            <div className="space-y-8 max-w-2xl mx-auto pb-40">
                                {activeAudit.sections.map((s, i) => (
                                    <div key={i} className={`flex flex-col ${s.speaker === 'Teacher' ? 'items-start' : 'items-end'} group`}>
                                        <div className="flex items-center gap-2 mb-2 px-4"><span className={`text-[9px] font-black uppercase tracking-widest ${s.speaker === 'Teacher' ? 'text-indigo-400' : 'text-slate-400'}`}>{s.speaker === 'Teacher' ? activeAudit.professorName : activeAudit.studentName}</span></div>
                                        <div className={`px-6 py-4 rounded-3xl shadow-xl transition-all ${s.speaker === 'Teacher' ? 'bg-slate-900 border border-indigo-500/20 text-white rounded-tl-sm' : 'bg-slate-900/50 text-slate-300 rounded-tr-sm'}`}>
                                            <p className="text-sm leading-relaxed antialiased font-medium">{s.text}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                      )}
                  </div>
              ) : selectedNode ? (
                  <div className="max-w-xl w-full mx-auto space-y-10 animate-fade-in-up py-20 text-center">
                        <div className="relative inline-block mb-6">
                            <div className={`w-32 h-32 rounded-[3rem] border-4 flex items-center justify-center shadow-2xl transition-all ${selectedNode.status === 'staged' ? 'bg-amber-900/10 border-amber-500/30 text-amber-400' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                                {selectedNode.status === 'staged' ? <Terminal size={56} /> : <Fingerprint size={56} />}
                            </div>
                            <div className="absolute -bottom-2 -right-2 p-2 bg-indigo-600 rounded-2xl border-4 border-slate-950 text-white shadow-xl"><Zap size={20} fill="currentColor"/></div>
                        </div>
                        <div className="space-y-3">
                            <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">{selectedNode.topic}</h2>
                            <p className="text-slate-500 text-sm font-medium leading-relaxed px-10">This logic shard requires a formal audit by the Shadow Agent to verify reasoning depth.</p>
                        </div>
                        <button onClick={() => handleTriggerAudit(selectedNode)} disabled={isAuditing} className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3">
                            {isAuditing ? <Loader2 size={24} className="animate-spin" /> : <Sparkles size={24}/>}
                            <span>Refract Logic Shard</span>
                        </button>
                  </div>
              ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-800 space-y-12 opacity-30">
                      <FileSearch size={160} strokeWidth={0.5} />
                      <h3 className="text-4xl font-black uppercase italic tracking-tighter">Observability Portal</h3>
                  </div>
              )}

              {/* HIDDEN EXPORT CONTAINER FOR PDF CAPTURE */}
              <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
                  <div id="pdf-export-content" style={{ width: '800px', padding: '60px', backgroundColor: '#ffffff', color: '#0f172a', fontFamily: 'serif' }}>
                      <div style={{ borderBottom: '4px solid #f1f5f9', paddingBottom: '20px', marginBottom: '40px', display: 'flex', justifySelf: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontSize: '10px', fontWeight: 900, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.2em' }}>Neural Prism Technical Record</div>
                          <div style={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8' }}>{new Date().toLocaleDateString()}</div>
                      </div>
                      <h1 style={{ fontSize: '36px', fontWeight: 900, marginBottom: '10px', textTransform: 'uppercase', color: '#000' }}>{activeAudit?.topic}</h1>
                      <div style={{ marginBottom: '40px' }}>
                          {activeAudit?.sections.map((s, i) => (
                              <div key={i} style={{ marginBottom: '20px' }}>
                                  <div style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: s.speaker === 'Teacher' ? '#4338ca' : '#475569', marginBottom: '4px' }}>{s.speaker === 'Teacher' ? activeAudit.professorName : activeAudit.studentName}</div>
                                  <div style={{ fontSize: '14px', lineHeight: '1.6', color: '#334155' }}>{s.text}</div>
                              </div>
                          ))}
                      </div>
                      <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '2px solid #f1f5f9', display: 'flex', justifySelf: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontSize: '8px', fontWeight: 900, color: '#cbd5e1', letterSpacing: '0.1em' }}>BOUND BY NEURAL PRISM // v12.0.0-ABUNDANCE</div>
                          <div style={{ fontSize: '10px', fontWeight: 900, color: '#64748b' }}>PAGE 1</div>
                      </div>
                  </div>
              </div>
          </main>
      </div>
    </div>
  );
};

export default NeuralLens;
