import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ShieldCheck, Activity, BrainCircuit, Globe, 
  ChevronRight, AlertTriangle, CheckCircle2, 
  Network, Zap, Ghost, Target, BarChart3, Database,
  ArrowLeft, Search, RefreshCw, Loader2, Info, Star, X,
  FileText, Wand2, Layers, Cpu, Sparkles, FileSearch,
  Filter, ZapOff, Fingerprint, SearchCode, Beaker, Terminal, Download, FileCode, FileDown,
  Layout, BookOpen, ChevronDown, Signal, Library, BookText, Gauge, BarChart, History,
  Maximize2, Share2, Clipboard, Share, Palette, Eye, Code, Copy, ExternalLink, Clock, Tag,
  Check, FileSignature, Stamp, Shield, User, PenTool, Edit, AlignLeft, ShieldAlert,
  Maximize, Info as InfoIcon, Fingerprint as FingerprintIcon
} from 'lucide-react';
import { collection, query, getDocs, limit, orderBy, where } from '@firebase/firestore';
import { db, auth } from '../services/firebaseConfig';
import { GeneratedLecture, Channel, SubTopic, NeuralLensAudit, DependencyNode, DependencyLink, UserProfile } from '../types';
import { SYSTEM_AUDIT_NODES } from '../utils/auditContent';
import { generateLectureScript, performNeuralLensAudit, summarizeLectureForContext, repairPlantUML } from '../services/lectureGenerator';
import { generateCurriculum } from '../services/curriculumGenerator';
import { SPOTLIGHT_DATA } from '../utils/spotlightContent';
import { logger } from '../services/logger';
import { HANDCRAFTED_CHANNELS } from '../utils/initialData';
import { SYSTEM_BOOKS } from '../utils/bookContent';
import { saveCloudCachedLecture } from '../services/firestoreService';
import { generateContentUid, safeJsonStringify, generateSecureId } from '../utils/idUtils';
import { MarkdownView } from './MarkdownView';
import { NeuralRetinaGraph, AuditData } from './NeuralRetinaGraph';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface NeuralLensProps {
  onBack: () => void;
  onOpenManual?: () => void;
  userProfile: UserProfile | null;
}

interface HierarchyNode {
    id: string;
    title: string;
    description: string;
    shards: any[];
    type: 'podcast' | 'book';
    priority: number;
}

type GraphTheme = 'neon-void' | 'solarized' | 'monokai-plus';
type DiagramFormat = 'mermaid' | 'plantuml';

const CONCURRENCY_LIMIT = 3;

export const NeuralLens: React.FC<NeuralLensProps> = ({ onBack, onOpenManual, userProfile }) => {
  const [cloudAudits, setCloudAudits] = useState<GeneratedLecture[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [selectedSector, setSelectedSector] = useState<HierarchyNode | null>(null);
  const [activeAudit, setActiveAudit] = useState<GeneratedLecture | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isBatchAuditing, setIsBatchAuditing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  
  const [activeTab, setActiveTab] = useState<'audit' | 'script' | 'holistic'>('holistic');
  const [graphTheme, setGraphTheme] = useState<GraphTheme>('neon-void');
  const [diagramFormat, setDiagramFormat] = useState<DiagramFormat>('mermaid');
  const [isEditingSource, setIsEditingSource] = useState(false);
  const [editedSource, setEditedSource] = useState('');

  const [expandedSectors, setExpandedSectors] = useState<Record<string, boolean>>({
      'platform-core': true,
      'judge-deep-dive': true
  });

  const cycleTheme = () => {
      const themes: GraphTheme[] = ['neon-void', 'solarized', 'monokai-plus'];
      const next = themes[(themes.indexOf(graphTheme) + 1) % themes.length];
      setGraphTheme(next);
  };

  const dispatchLog = (text: string, type: any = 'info', meta?: any) => {
      const safeMeta = meta ? JSON.parse(safeJsonStringify(meta)) : null;
      logger[type as keyof typeof logger](text, safeMeta);
  };

  const loadData = useCallback(async () => {
    if (!db) {
        setLoading(false);
        return;
    }
    setLoading(true);
    try {
        const auditQ = query(collection(db, 'lecture_cache'), limit(300));
        const channelQ = query(collection(db, 'channels'), limit(100));
        const [auditSnap, channelSnap] = await Promise.all([getDocs(auditQ), getDocs(channelQ)]);

        const audits = auditSnap.docs.map(d => d.data() as GeneratedLecture).filter(l => !!l.audit);
        const chanData = channelSnap.docs.map(d => d.data() as Channel);
        
        setCloudAudits(audits);
        setChannels(chanData);
        
        dispatchLog(`Hydrated ${audits.length} audit nodes from cloud.`, 'success', { category: 'REGISTRY' });
    } catch (e: any) {
        dispatchLog(`Ledger Sync Failure: ${e.message}`, 'error');
    } finally {
        setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const formatScore = (score: number) => {
      if (score === undefined || score === null) return '0';
      const val = score <= 1 ? Math.round(score * 100) : Math.round(score);
      return val.toString();
  };

  // Convert internal graph schema to NeuralRetinaGraph compatible schema
  const auditData: AuditData | null = useMemo(() => {
      if (!selectedNode?.audit) return null;
      const audit = selectedNode.audit;
      
      // Transform our graph data to the retina graph schema
      return {
          audit_id: audit.reportUuid || generateSecureId().substring(0, 16),
          timestamp: new Date(audit.timestamp).toISOString(),
          nodes: audit.graph.nodes.map((n: any) => ({
              id: n.id,
              label: n.label,
              type: (n.type === 'concept' ? 'claim' : n.type === 'component' ? 'document' : 'verification') as any,
              status: (audit.StructuralCoherenceScore > 80 ? 'PASS' : audit.StructuralCoherenceScore > 50 ? 'WARN' : 'FAIL') as any
          })),
          edges: audit.graph.links.map((l: any) => ({
              source: l.source,
              target: l.target,
              label: l.label
          }))
      };
  }, [selectedNode]);

  const hierarchy = useMemo(() => {
    const sectors: Record<string, HierarchyNode> = {};
    const allAvailableChannels = [...HANDCRAFTED_CHANNELS, ...channels];

    allAvailableChannels.forEach(c => {
        if (c && !sectors[c.id]) {
            sectors[c.id] = { id: c.id, title: c.title, description: c.description, shards: [], type: 'podcast', priority: c.id === 'judge-deep-dive' ? 100 : 0 };
        }
    });
    SYSTEM_BOOKS.forEach(b => {
        if (b && !sectors[b.id]) {
            sectors[b.id] = { id: b.id, title: b.title, description: b.subtitle, shards: [], type: 'book', priority: b.id === 'platform-core' ? 100 : 0 };
        }
    });

    const neuralRegistryMap = new Map<string, GeneratedLecture>();
    [...SYSTEM_AUDIT_NODES, ...cloudAudits].forEach(item => {
        if (item?.topic) {
            const existing = neuralRegistryMap.get(item.topic);
            if (!existing || (item.audit?.timestamp || 0) > (existing.audit?.timestamp || 0)) {
                neuralRegistryMap.set(item.topic, item);
            }
        }
    });

    Object.entries(SPOTLIGHT_DATA).forEach(([chanId, data]) => {
        if (!sectors[chanId]) sectors[chanId] = { id: chanId, title: chanId, description: '', shards: [], type: 'podcast', priority: 0 };
        Object.keys(data.lectures).forEach(topic => {
            const auditData = neuralRegistryMap.get(topic);
            sectors[chanId].shards.push({ topic, status: auditData ? 'audited' : 'staged', audit: auditData?.audit, sections: auditData?.sections });
        });
    });

    SYSTEM_BOOKS.forEach(book => {
        book.pages.forEach(page => {
            const auditData = neuralRegistryMap.get(page.title);
            sectors[book.id].shards.push({ topic: page.title, status: auditData ? 'audited' : 'ghost', audit: auditData?.audit, sections: auditData?.sections || [{ speaker: 'Teacher', text: page.content }] });
        });
    });

    allAvailableChannels.forEach(chan => {
        chan.chapters?.forEach(chapter => {
            chapter.subTopics.forEach(sub => {
                const alreadyIn = sectors[chan.id]?.shards.some(s => s.topic === sub.title);
                if (!alreadyIn && sectors[chan.id]) {
                    const auditData = neuralRegistryMap.get(sub.title);
                    sectors[chan.id].shards.push({ topic: sub.title, status: auditData ? 'audited' : 'ghost', audit: auditData?.audit, sections: auditData?.sections });
                }
            });
        });
    });

    return Object.values(sectors)
        .filter(s => s && s.shards.length > 0)
        .sort((a, b) => {
            if (a.type !== b.type) return a.type === 'book' ? -1 : 1;
            return b.priority - a.priority || a.title.localeCompare(b.title);
        });
  }, [cloudAudits, channels]);

  const filteredHierarchy = useMemo(() => {
    if (!searchQuery.trim()) return hierarchy;
    const q = searchQuery.toLowerCase();
    return hierarchy.map(sector => ({
        ...sector,
        shards: sector.shards.filter(s => 
            s.topic.toLowerCase().includes(q) || 
            sector.title.toLowerCase().includes(q)
        )
    })).filter(sector => sector.shards.length > 0);
  }, [hierarchy, searchQuery]);

  const sectorIntegrity = useMemo(() => {
      if (!selectedSector) return null;
      const audited = selectedSector.shards.filter(s => !!s.audit);
      
      const score = audited.length === 0 ? 0 : Math.round(audited.reduce((acc, curr) => {
          const s = curr.audit.coherenceScore || curr.audit.StructuralCoherenceScore || 0;
          const normalized = s <= 1 ? s * 100 : s;
          return acc + normalized;
      }, 0) / audited.length);
      
      const risks = audited.map(s => s.audit.driftRisk || s.audit.LogicalDriftRisk);
      const worstRisk = risks.includes('High') ? 'High' : risks.includes('Medium') ? 'Medium' : 'Low';

      const allNodesMap = new Map<string, DependencyNode>();
      const allLinksMap = new Map<string, DependencyLink>();

      audited.forEach(shard => {
          if (shard.audit?.graph) {
              shard.audit.graph.nodes.forEach((n: DependencyNode) => {
                  if (n && n.id) {
                      const existing = allNodesMap.get(n.id);
                      if (!existing || shard.audit.timestamp > (allNodesMap.get(n.id) as any)?._ts) {
                          allNodesMap.set(n.id, { ...n, _ts: shard.audit.timestamp } as any);
                      }
                  }
              });
              shard.audit.graph.links.forEach((l: DependencyLink) => {
                  if (l && l.source && l.target) {
                    const linkKey = `${l.source}-${l.target}-${l.label || ''}`;
                    allLinksMap.set(linkKey, l);
                  }
              });
          }
      });

      return {
          score,
          drift: audited.length > 0 ? worstRisk : 'Unknown',
          total: selectedSector.shards.length,
          audited: audited.length,
          mesh: { 
              nodes: Array.from(allNodesMap.values()),
              links: Array.from(allLinksMap.values())
          }
      };
  }, [selectedSector]);

  const handleSelectSector = (sector: HierarchyNode) => {
      setSelectedSector(sector);
      setSelectedNode(null);
      setActiveAudit(null);
      setActiveTab('holistic');
      setExpandedSectors(prev => ({ ...prev, [sector.id]: !prev[sector.id] }));
      dispatchLog(`Focused Sector: ${sector.title}`, 'info', { category: 'LENS_UI', nodeId: sector.id });
  };

  const handleSelectNode = (node: any) => {
    setSelectedNode(node);
    setIsEditingSource(false);
    setActiveTab(node.audit ? 'audit' : 'script');
    dispatchLog(`Observing Logic Node: ${node.topic}`, 'info', { category: 'LENS_UI', topic: node.topic });
  };

  const handleRegenerateOrVerifySector = async (force: boolean = false) => {
    if (!selectedSector || isBatchAuditing) return;
    setIsBatchAuditing(true);
    setBatchProgress({ current: 0, total: selectedSector.shards.length });

    dispatchLog(force ? `FORCE RE-VERIFICATION INITIATED: Bypassing fingerprint cache for ${selectedSector.title}.` : `Verification cycle started for ${selectedSector.title}.`, 'warn', { category: 'LENS_AUDIT' });

    try {
        const shards = [...selectedSector.shards];
        for (let i = 0; i < shards.length; i += CONCURRENCY_LIMIT) {
            const chunk = shards.slice(i, i + CONCURRENCY_LIMIT);
            await Promise.all(chunk.map(async (node, chunkIdx) => {
                const globalIdx = i + chunkIdx;
                let lecture: GeneratedLecture | null = null;
                
                dispatchLog(`[BATCH] Syncing Node ${globalIdx + 1}/${shards.length}: ${node.topic}`, 'trace');

                if (node.sections && node.sections.length > 0) {
                    lecture = { 
                        topic: node.topic, 
                        sections: node.sections, 
                        professorName: 'Auditor', 
                        studentName: 'System', 
                        uid: node.uid,
                        audit: node.audit 
                    };
                }
                if (!lecture) {
                    const chan = channels.find(c => c.id === selectedSector.id) || HANDCRAFTED_CHANNELS.find(c => c.id === selectedSector.id);
                    if (chan) lecture = await generateLectureScript(node.topic, chan.description, 'en', chan.id, chan.voiceName);
                }
                if (lecture) {
                    const audit = await performNeuralLensAudit(lecture, 'en', force, selectedSector.id);
                    if (audit) {
                        const finalized: GeneratedLecture = { ...lecture, audit };
                        shards[globalIdx] = { ...node, audit, status: 'audited' };
                        const contentUid = lecture.uid || await generateContentUid(node.topic, selectedSector.description || '', 'en');
                        await saveCloudCachedLecture(selectedSector.id, contentUid, 'en', finalized);
                        setCloudAudits(prev => {
                            const next = [...prev];
                            const idx = next.findIndex(a => a.topic === lecture?.topic);
                            if (idx > -1) next[idx] = finalized;
                            else next.push(finalized);
                            return next;
                        });
                        dispatchLog(`[BATCH] Node Secured: ${node.topic} (Integrity: ${audit.StructuralCoherenceScore}%)`, 'success');
                    }
                }
                setBatchProgress(prev => ({ ...prev, current: prev.current + 1 }));
            }));
            await new Promise(r => setTimeout(r, 200));
        }
        setSelectedSector({ ...selectedSector, shards });
        dispatchLog(`Sector "${selectedSector.title}" verification finalized. Total nodes: ${shards.length}.`, 'success', { category: 'LENS_AUDIT' });
    } catch (e: any) {
        dispatchLog(`Batch Fault: ${e.message}`, 'error');
    } finally {
        setIsBatchAuditing(false);
        loadData();
    }
  };

  const containerBg = useMemo(() => {
    if (graphTheme === 'solarized') return 'bg-[#fdf6e3]';
    if (graphTheme === 'monokai-plus') return 'bg-[#272822]';
    return 'bg-[#020617]';
  }, [graphTheme]);

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-20">
          <div className="flex items-center gap-4">
              <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"><ArrowLeft size={20} /></button>
              <div>
                <h1 className="text-lg font-bold text-white flex items-center gap-2 uppercase tracking-tighter italic">
                    <ShieldCheck className="text-indigo-400" size={24} /> Neural Lens
                </h1>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Reasoning Observability Matrix</p>
              </div>
          </div>
          <div className="flex items-center gap-3">
              <button onClick={cycleTheme} className="flex items-center gap-2 px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[10px] font-black uppercase transition-all shadow-lg border border-slate-700">
                  <Palette size={14} className="text-indigo-400"/>
                  <span className="hidden sm:inline">Theme: {graphTheme.replace('-', ' ')}</span>
              </button>
              <button onClick={loadData} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all"><RefreshCw size={18} className={loading ? 'animate-spin' : ''} /></button>
              {onOpenManual && <button onClick={onOpenManual} className="p-2 text-slate-400 hover:text-white" title="Lens Manual"><Info size={18}/></button>}
          </div>
      </header>

      <div className="flex-1 flex overflow-hidden flex-col lg:flex-row">
          <aside className="w-full lg:w-96 border-r border-slate-800 bg-slate-900/30 flex flex-col shrink-0">
              <div className="p-4 border-b border-slate-800 space-y-4 bg-slate-950/40">
                  <div className="relative group">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400" size={14}/>
                      <input type="text" placeholder="Search sectors or shards..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 outline-none shadow-inner"/>
                  </div>
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-hide p-2 space-y-6">
                  {loading && hierarchy.length === 0 ? (
                      <div className="py-20 flex flex-col items-center justify-center gap-4 text-center">
                          <Loader2 className="animate-spin text-indigo-500" size={24} /><span className="text-[8px] font-black uppercase text-slate-600 tracking-widest">Hydrating Ledger...</span>
                      </div>
                  ) : (
                      <div className="space-y-4">
                          <h3 className="px-3 text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] flex items-center gap-2 border-b border-slate-800/50 pb-2"> Discovery Spectrum</h3>
                          {filteredHierarchy.map((sector) => {
                              const isFocused = selectedSector?.id === sector.id;
                              const isExpanded = expandedSectors[sector.id];
                              return (
                              <div key={sector.id} className="space-y-1 px-1">
                                  <button 
                                    onClick={() => handleSelectSector(sector)}
                                    className={`w-full text-left flex items-center justify-between px-3 py-3 rounded-2xl group transition-all border ${isFocused ? 'bg-indigo-600 border-indigo-400 text-white shadow-xl' : 'bg-slate-900/40 border-transparent hover:bg-slate-800/50'}`}
                                  >
                                      <div className="flex items-center gap-3">
                                          {sector.type === 'book' ? <BookText size={16} className={isFocused ? 'text-white' : 'text-emerald-400'}/> : <Layout size={16} className={isFocused ? 'text-white' : 'text-indigo-400'}/>}
                                          <span className="text-[11px] font-black uppercase tracking-widest truncate max-w-[160px]">{sector.title}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                          <span className="text-[8px] font-mono font-bold opacity-60">{sector.shards.length} Nodes</span>
                                          <ChevronRight size={14} className={`text-slate-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                      </div>
                                  </button>
                                  {isExpanded && (
                                      <div className="pl-6 space-y-1 animate-fade-in border-l border-slate-800 ml-5 mt-1">
                                          {sector.shards.map((shard, i) => {
                                              const isNodeFocused = selectedNode?.topic === shard.topic;
                                              const hasAudit = !!shard.audit;
                                              return (
                                                  <button 
                                                    key={i} 
                                                    onClick={() => handleSelectNode(shard)}
                                                    className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between ${isNodeFocused ? 'bg-slate-800 border-indigo-500 text-white shadow-lg' : 'bg-transparent border-transparent text-slate-500 hover:bg-slate-800/40'}`}
                                                  >
                                                      <div className="flex items-center gap-2 min-w-0">
                                                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasAudit ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : shard.status === 'staged' ? 'bg-amber-500' : 'bg-slate-800'}`}></div>
                                                          <span className="text-[10px] font-bold uppercase truncate">{shard.topic}</span>
                                                      </div>
                                                      <div className="flex items-center gap-2">
                                                          {hasAudit && <span className="text-[8px] font-mono font-bold opacity-60">{formatScore(shard.audit?.coherenceScore || shard.audit?.StructuralCoherenceScore)}%</span>}
                                                      </div>
                                                  </button>
                                              );
                                          })}
                                      </div>
                                  )}
                              </div>
                          )})}
                      </div>
                  )}
              </div>
          </aside>

          <main className="flex-1 bg-black/20 overflow-y-auto scrollbar-hide p-8 lg:p-12 relative flex flex-col items-center">
              {selectedNode ? (
                  <div className="max-w-4xl w-full mx-auto space-y-12 animate-fade-in-up">
                      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-800 pb-8">
                          <div className="space-y-3 text-left">
                              <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">{selectedNode.topic}</h2>
                              <div className="flex flex-wrap items-center gap-4 mt-2">
                                  <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 shadow-inner">
                                      <button onClick={() => setActiveTab('audit')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${activeTab === 'audit' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Reasoning Mesh</button>
                                      <button onClick={() => setActiveTab('script')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${activeTab === 'script' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Source Script</button>
                                  </div>
                                  {selectedNode.audit?.signature && (
                                      <div className="flex items-center gap-2 px-3 py-1 bg-emerald-950/40 border border-emerald-500/30 rounded-full text-emerald-400 text-[9px] font-black uppercase tracking-widest shadow-lg animate-fade-in">
                                          <FingerprintIcon size={12}/> VPR Verified
                                      </div>
                                  )}
                              </div>
                          </div>
                          <div className="bg-slate-900 border border-slate-800 px-8 py-4 rounded-[2.5rem] shadow-inner text-center">
                              <p className="text-[8px] font-black text-slate-600 uppercase mb-1 tracking-widest">Node Integrity</p>
                              <p className="text-4xl font-black text-emerald-400 italic tracking-tighter">
                                  {selectedNode.audit ? `${formatScore(selectedNode.audit.StructuralCoherenceScore || selectedNode.audit.coherenceScore)}%` : '---'}
                              </p>
                          </div>
                      </div>

                      {activeTab === 'audit' ? (
                        <div className="space-y-12 animate-fade-in text-left">
                            {!selectedNode.audit ? (
                                <div className="py-32 flex flex-col items-center justify-center gap-6 text-slate-600">
                                    <div className="w-20 h-20 bg-slate-900 rounded-[2rem] border-2 border-dashed border-slate-800 flex items-center justify-center">
                                        <ZapOff size={32} className="opacity-20"/>
                                    </div>
                                    <div className="text-center space-y-2">
                                        <p className="text-sm font-black uppercase tracking-widest">Logic Node not yet audited</p>
                                        <p className="text-xs max-w-xs mx-auto leading-relaxed">Run sector verification to synthesize the conceptual mesh and adversarial probes for this node.</p>
                                    </div>
                                    <button onClick={() => handleRegenerateOrVerifySector(false)} className="px-8 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">Begin Audit</button>
                                </div>
                            ) : (
                                <>
                                    {auditData && (
                                        <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden group">
                                            <div className="flex justify-between items-center mb-10 relative z-10">
                                                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] flex items-center gap-3">
                                                    <Layers size={18} className="text-indigo-400"/> Refined Retina Mesh
                                                </h4>
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => handleRegenerateOrVerifySector(true)} className="p-2 bg-slate-950 border border-slate-800 text-amber-500 hover:text-white hover:bg-amber-600 rounded-lg transition-all" title="Force Re-verify (Bypass Cache)"><RefreshCw size={16}/></button>
                                                </div>
                                            </div>
                                            <div className="relative z-10 w-full min-h-[500px]">
                                                <NeuralRetinaGraph data={auditData} className="h-[600px]" />
                                            </div>
                                        </div>
                                    )}

                                    {selectedNode.audit.signature && (
                                        <div className="bg-emerald-950/20 border border-emerald-500/30 p-8 rounded-[3rem] shadow-xl space-y-6 animate-fade-in-up">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-3 bg-emerald-500 text-white rounded-2xl shadow-lg"><FileSignature size={24}/></div>
                                                    <div>
                                                        <h4 className="text-sm font-black text-white uppercase tracking-[0.2em] italic">Sovereign VPR Certificate</h4>
                                                        <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Verifiable Proof of Reasoning</p>
                                                    </div>
                                                </div>
                                                <CheckCircle2 className="text-emerald-500" size={32}/>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="bg-black/40 rounded-2xl p-4 border border-white/5 space-y-2">
                                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Signatory Authority</p>
                                                    <p className="text-[10px] font-mono text-emerald-300 truncate">{selectedNode.audit.signerId}</p>
                                                    <p className="text-[9px] font-black text-slate-600 uppercase">Public Key: {selectedNode.audit.signerPublicKey?.substring(0, 32)}...</p>
                                                </div>
                                                <div className="bg-black/40 rounded-2xl p-4 border border-white/5 space-y-2">
                                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Logic Signature</p>
                                                    <p className="text-[8px] font-mono text-indigo-300 break-all leading-relaxed line-clamp-3">{selectedNode.audit.signature}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className="space-y-6">
                                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] flex items-center gap-2 px-2">
                                            <Ghost size={16} className="text-purple-500"/> Adversarial Probe Audit
                                        </h4>
                                        <div className="grid grid-cols-1 gap-4">
                                            {selectedNode.audit.probes?.map((probe: any, i: number) => (
                                                <div key={i} className="bg-slate-900 border border-slate-800 rounded-[2rem] p-8 flex flex-col gap-4 shadow-xl group">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-red-900/20 text-red-500 rounded-xl"><Target size={16}/></div>
                                                            <h5 className="text-sm font-black text-white uppercase tracking-tight leading-relaxed">{probe.question}</h5>
                                                        </div>
                                                        <div className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase ${
                                                            probe.status === 'passed' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-amber-900/30 text-amber-400'
                                                        }`}>{probe.status}</div>
                                                    </div>
                                                    <p className="text-sm text-slate-400 italic leading-relaxed border-l-2 border-slate-800 pl-4 py-2 group-hover:border-indigo-500 transition-colors">
                                                        "{probe.answer}"
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                      ) : (
                        <div className="space-y-8 animate-fade-in-up text-left max-w-3xl mx-auto pb-40">
                            {selectedNode.sections?.map((s: any, i: number) => (
                                <div key={i} className={`flex flex-col ${s.speaker === 'Teacher' ? 'items-start' : 'items-end'} group`}>
                                    <div className="flex items-center gap-2 mb-2 px-4">
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${s.speaker === 'Teacher' ? 'text-indigo-400' : 'text-slate-500'}`}>{s.speaker}</span>
                                    </div>
                                    <div className={`px-8 py-6 rounded-[2rem] shadow-xl transition-all ${s.speaker === 'Teacher' ? 'bg-slate-900 border border-indigo-500/10 text-white rounded-tl-sm' : 'bg-slate-900/40 text-slate-300 rounded-tr-sm'}`}>
                                        <MarkdownView content={s.text} initialTheme="dark" showThemeSwitcher={false} compact={true} />
                                    </div>
                                </div>
                            ))}
                        </div>
                      )}
                  </div>
              ) : selectedSector ? (
                  <div className="max-w-5xl w-full mx-auto space-y-12 animate-fade-in-up">
                      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-800 pb-10">
                          <div className="space-y-4 text-left">
                              <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-900/30 border border-indigo-500/30 rounded-full text-indigo-400 text-[9px] font-black uppercase tracking-widest">
                                  <Signal size={12} className="animate-pulse"/> Holistic Sector Evaluation
                              </div>
                              <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">{selectedSector.title}</h2>
                              <p className="text-slate-400 text-lg max-w-xl">{selectedSector.description}</p>
                              <div className="pt-2 flex flex-wrap gap-4">
                                  <button onClick={() => handleRegenerateOrVerifySector(false)} disabled={isBatchAuditing} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-50 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 disabled:opacity-50">
                                      <Zap size={14} fill="currentColor"/> Run Logic Audit
                                  </button>
                              </div>
                          </div>
                          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3.5rem] shadow-2xl text-center relative overflow-hidden group">
                              <div className="absolute top-0 right-0 p-12 bg-emerald-500/5 blur-3xl rounded-full"></div>
                              <p className="text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest relative z-10">Aggregate Sector Score</p>
                              <p className="text-7xl font-black text-emerald-400 italic tracking-tighter relative z-10">{sectorIntegrity.score}%</p>
                          </div>
                      </div>

                      <div className="p-8 border-2 border-dashed border-slate-800 rounded-[3rem] text-center space-y-4 text-slate-500">
                          <Target size={48} className="mx-auto opacity-20"/>
                          <p className="text-xs font-black uppercase tracking-[0.2em]">Aggregate Holistic Mesh View Pending Refinement</p>
                          <p className="text-[10px] max-w-sm mx-auto leading-relaxed">Select individual shards from the sidebar to inspect high-fidelity Retina Graphs for each logic node.</p>
                      </div>
                  </div>
              ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-800 space-y-12 opacity-30">
                      <div className="p-10 border-2 border-dashed border-slate-800 rounded-[4rem] animate-pulse">
                        <FileSearch size={120} strokeWidth={0.5} />
                      </div>
                      <h3 className="text-4xl font-black uppercase italic tracking-tighter">Observability Portal</h3>
                  </div>
              )}
          </main>
      </div>
    </div>
  );
};

export default NeuralLens;
