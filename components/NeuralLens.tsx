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
  Maximize
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
import { encodePlantUML } from '../utils/plantuml';
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

  const generateMermaidFromGraph = (nodes: DependencyNode[], links: DependencyLink[]): string => {
      if (!nodes || nodes.length === 0) return '';
      let mermaid = 'graph TD\n';
      
      nodes.forEach(node => {
          if (!node || !node.id) return;
          const safeId = String(node.id).replace(/[^a-zA-Z0-9]/g, '_');
          const safeLabel = String(node.label || "Node").replace(/"/g, "'");
          mermaid += `  ${safeId}["${safeLabel}"]\n`;
      });

      links.forEach(link => {
          if (!link || !link.source || !link.target) return;
          const src = String(link.source).replace(/[^a-zA-Z0-9]/g, '_');
          const tgt = String(link.target).replace(/[^a-zA-Z0-9]/g, '_');
          const label = link.label ? `|${String(link.label)}|` : '';
          mermaid += `  ${src} -->${label} ${tgt}\n`;
      });

      return mermaid;
  };

  const activeDiagramSource = useMemo(() => {
      const audit = selectedNode?.audit;
      if (!audit) return '';

      if (isEditingSource) return `\`\`\`${diagramFormat}\n${editedSource}\n\`\`\``;

      if (diagramFormat === 'mermaid') {
          if (typeof audit.mermaid === 'string' && audit.mermaid) {
              return `\`\`\`mermaid\n${audit.mermaid.replace(/```mermaid\n|```/g, '')}\n\`\`\``;
          }
          if (audit.graph) {
              return `\`\`\`mermaid\n${generateMermaidFromGraph(audit.graph.nodes, audit.graph.links)}\n\`\`\``;
          }
      } else {
          if (typeof audit.plantuml === 'string' && audit.plantuml) {
              return `\`\`\`plantuml\n${audit.plantuml.replace(/```plantuml\n|```/g, '')}\n\`\`\``;
          }
      }
      return '';
  }, [selectedNode, diagramFormat, isEditingSource, editedSource]);

  const handleOpenInNewWindow = () => {
    const rawCode = activeDiagramSource.replace(/```(mermaid|plantuml)\n|```/g, '').trim();
    if (!rawCode) return;

    const win = window.open('', '_blank');
    if (!win) return;

    const title = `Neural Lens: ${selectedNode?.topic || 'Logic Mesh'}`;
    
    let content = '';
    if (diagramFormat === 'mermaid') {
        content = `
            <div class="mermaid">
                ${rawCode}
            </div>
            <script type="module">
                import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
                mermaid.initialize({ startOnLoad: true, theme: 'dark' });
            </script>
        `;
    } else {
        // Simple SVG image viewer for PlantUML
        const encoded = btoa(rawCode); // Not exact for PlantUML but placeholder for now
        content = `<img src="https://www.plantuml.com/plantuml/svg/${encoded}" style="max-width: 100%;" />`;
    }

    win.document.write(`
        <!DOCTYPE html>
        <html>
            <head>
                <title>${title}</title>
                <style>
                    body { background: #020617; color: white; margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; overflow: auto; font-family: sans-serif; }
                    .mermaid { background: rgba(255,255,255,0.02); padding: 40px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.05); }
                </style>
            </head>
            <body>
                ${content}
            </body>
        </html>
    `);
    win.document.close();
  };

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

    const findParentIdByTopic = (topic: string): string => {
        if (!topic) return 'system-artifacts';
        for (const [id, data] of Object.entries(SPOTLIGHT_DATA)) {
            if (data.lectures[topic]) return id;
            if (data.curriculum.some(ch => ch.subTopics.some(st => st.title === topic))) return id;
        }
        for (const book of SYSTEM_BOOKS) {
            if (book.pages.some(p => p.title === topic)) return book.id;
        }
        for (const chan of allAvailableChannels) {
            if (chan.chapters?.some(ch => ch.subTopics.some(st => st.title === topic))) return chan.id;
        }
        return 'system-artifacts';
    };

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
      const runtimeMermaidSegments: string[] = [];

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
          if (typeof shard.audit?.runtime_trace_mermaid === 'string' && shard.audit.runtime_trace_mermaid) {
              runtimeMermaidSegments.push(shard.audit.runtime_trace_mermaid.replace(/sequenceDiagram\n/g, ''));
          }
      });

      let runtimeMermaid = "sequenceDiagram\n";
      runtimeMermaid += runtimeMermaidSegments.join('\n');

      return {
          score,
          drift: audited.length > 0 ? worstRisk : 'Unknown',
          total: selectedSector.shards.length,
          audited: audited.length,
          mesh: { 
              nodes: Array.from(allNodesMap.values()),
              links: Array.from(allLinksMap.values())
          },
          runtimeMermaid
      };
  }, [selectedSector]);

  const holisticDiagram = useMemo(() => {
      if (!sectorIntegrity?.mesh || sectorIntegrity.mesh.nodes.length === 0) return '';
      if (diagramFormat === 'mermaid') {
          return `\`\`\`mermaid\n${generateMermaidFromGraph(sectorIntegrity.mesh.nodes, sectorIntegrity.mesh.links)}\n\`\`\``;
      }
      return '';
  }, [sectorIntegrity, diagramFormat]);

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
    
    if (node.audit) {
        const sourceToEdit = diagramFormat === 'mermaid' 
            ? (node.audit.mermaid ? String(node.audit.mermaid).replace(/```mermaid\n|```/g, '') : '')
            : (node.audit.plantuml ? String(node.audit.plantuml).replace(/```plantuml\n|```/g, '') : '');
        setEditedSource(sourceToEdit);
    } else {
        setEditedSource('');
    }
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
                    // Pass force flag to the audit function
                    const audit = await performNeuralLensAudit(lecture, 'en', force);
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

  const handleExportAuditProbes = () => {
    if (!selectedSector) return;
    let md = `# Adversarial Audit Report: ${selectedSector.title}\n\n`;
    md += `**Description:** ${selectedSector.description}\n`;
    md += `**Aggregated Integrity:** ${sectorIntegrity?.score}%\n`;
    md += `**Date:** ${new Date().toLocaleString()}\n\n`;
    md += `---\n\n`;

    selectedSector.shards.forEach(shard => {
        if (shard.audit && shard.audit.probes) {
            md += `## Node: ${shard.topic}\n`;
            md += `**Individual Coherence:** ${formatScore(shard.audit.coherenceScore || shard.audit.StructuralCoherenceScore)}%\n\n`;
            shard.audit.probes.forEach((probe: any) => {
                const statusEmoji = probe.status === 'passed' ? '✅' : probe.status === 'warning' ? '⚠️' : '❌';
                md += `### ${statusEmoji} Probe: ${probe.question}\n`;
                md += `> **Response:** ${probe.answer}\n\n`;
                md += `**Status:** ${probe.status.toUpperCase()}\n\n`;
            });
            md += `---\n\n`;
        }
    });

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedSector.title.replace(/\s+/g, '_')}_Audit_Probes.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    dispatchLog(`Audit probes exported for ${selectedSector.title}`, 'success', { category: 'REGISTRY' });
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
              <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 mr-2 shadow-inner">
                  <button onClick={() => setDiagramFormat('mermaid')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${diagramFormat === 'mermaid' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Mermaid</button>
                  <button onClick={() => setDiagramFormat('plantuml')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${diagramFormat === 'plantuml' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>PlantUML</button>
              </div>
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
              {isBatchAuditing && (
                  <div className="fixed top-20 right-10 z-[100] w-72 bg-slate-900 border border-indigo-500/30 rounded-[2rem] p-6 shadow-2xl animate-fade-in-up space-y-4">
                      <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                              <Loader2 className="animate-spin text-indigo-400" size={16}/>
                              <span className="text-[10px] font-black text-white uppercase tracking-widest">Shadow Pass</span>
                          </div>
                          <span className="text-xs font-mono font-black text-indigo-300">{Math.round((batchProgress.current / batchProgress.total) * 100)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden shadow-inner">
                          <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}></div>
                      </div>
                  </div>
              )}

              {selectedNode ? (
                  <div id="pdf-export-content" className="max-w-4xl w-full mx-auto space-y-12 animate-fade-in-up">
                      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-800 pb-8">
                          <div className="space-y-3 text-left">
                              <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">{selectedNode.topic}</h2>
                              <div className="flex flex-wrap items-center gap-4 mt-2">
                                  <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 shadow-inner">
                                      <button onClick={() => setActiveTab('audit')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${activeTab === 'audit' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Reasoning Mesh</button>
                                      <button onClick={() => setActiveTab('script')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${activeTab === 'script' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Source Script</button>
                                      <button onClick={() => { setSelectedNode(null); setActiveTab('holistic'); }} className="px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all text-slate-500 hover:text-slate-300">Sector Home</button>
                                  </div>
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
                                    {activeDiagramSource && (
                                        <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden group">
                                            <div className="flex justify-between items-center mb-10 relative z-10">
                                                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] flex items-center gap-3">
                                                    <Layers size={18} className="text-indigo-400"/> Logic Topology ({diagramFormat.toUpperCase()})
                                                </h4>
                                                <div className="flex items-center gap-2">
                                                    <button onClick={handleOpenInNewWindow} className="p-2 bg-slate-950 border border-slate-800 text-slate-500 hover:text-white rounded-lg transition-all" title="Open in New Window (Zoom Mode)"><Maximize size={16}/></button>
                                                    <button onClick={() => handleRegenerateOrVerifySector(true)} className="p-2 bg-slate-950 border border-slate-800 text-amber-500 hover:text-white hover:bg-amber-600 rounded-lg transition-all" title="Force Re-verify (Bypass Cache)"><RefreshCw size={16}/></button>
                                                    <button onClick={() => setIsEditingSource(!isEditingSource)} className={`p-2 rounded-lg transition-all ${isEditingSource ? 'bg-indigo-600 text-white' : 'bg-slate-950 border border-slate-800 text-slate-50'}`} title="Edit Source"><Edit size={16}/></button>
                                                </div>
                                            </div>
                                            <div className={`relative z-10 ${containerBg} rounded-3xl p-8 shadow-inner overflow-hidden border border-white/5 transition-colors duration-500`}>
                                                {isEditingSource ? (
                                                    <textarea 
                                                        value={editedSource} 
                                                        onChange={e => setEditedSource(e.target.value)}
                                                        className="w-full h-[400px] bg-black/60 text-indigo-300 font-mono text-xs p-6 rounded-2xl border border-indigo-500/30 outline-none focus:ring-1 focus:ring-indigo-500"
                                                        spellCheck={false}
                                                    />
                                                ) : (
                                                    <div className="flex justify-center animate-fade-in">
                                                        <MarkdownView content={activeDiagramSource} initialTheme="dark" showThemeSwitcher={false} compact={true} />
                                                    </div>
                                                )}
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
                                  <Signal size={12} className="animate-pulse"/> Holistic Spectrum Audit
                              </div>
                              <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">{selectedSector.title}</h2>
                              <p className="text-slate-400 text-lg max-w-xl">{selectedSector.description}</p>
                              <div className="pt-2 flex flex-wrap gap-4">
                                  <button onClick={() => handleRegenerateOrVerifySector(false)} disabled={isBatchAuditing} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 disabled:opacity-50">
                                      <Zap size={14} fill="currentColor"/> Verify Sector
                                  </button>
                                  <button onClick={() => handleRegenerateOrVerifySector(true)} disabled={isBatchAuditing} className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 hover:bg-amber-600 text-amber-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-700 transition-all active:scale-95 disabled:opacity-50">
                                      <RefreshCw size={14}/> Force Re-verify All
                                  </button>
                                  <button onClick={handleExportAuditProbes} disabled={isBatchAuditing} className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-700 transition-all active:scale-95 disabled:opacity-50">
                                      <FileDown size={14}/> Export Probes
                                  </button>
                              </div>
                          </div>
                          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3.5rem] shadow-2xl text-center relative overflow-hidden group">
                              <div className="absolute top-0 right-0 p-12 bg-emerald-500/5 blur-3xl rounded-full"></div>
                              <p className="text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest relative z-10">Aggregate Integrity</p>
                              <p className="text-7xl font-black text-emerald-400 italic tracking-tighter relative z-10">{sectorIntegrity.score}%</p>
                          </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden group text-left">
                            <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-12 flex items-center gap-3">
                                <Network size={18} className="text-indigo-400"/> Logical Concept Mesh
                            </h4>
                            <div className={`relative z-10 ${containerBg} rounded-[2.5rem] p-8 border border-white/5 shadow-inner transition-colors duration-500 min-h-[300px]`}>
                                {holisticDiagram ? (
                                    <div className="animate-fade-in">
                                        <MarkdownView content={holisticDiagram} initialTheme="dark" showThemeSwitcher={false} compact={true} />
                                    </div>
                                ) : (
                                    <div className="py-12 flex flex-col items-center gap-4 opacity-30">
                                        <Fingerprint size={64}/>
                                        <p className="text-[10px] font-black uppercase tracking-widest">Mesh pending refraction</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden group text-left">
                            <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.4em] mb-12 flex items-center gap-3">
                                <Activity size={18} className="text-emerald-400"/> Runtime Trace
                            </h4>
                            <div className={`relative z-10 ${containerBg} rounded-[2.5rem] p-8 border border-white/5 shadow-inner transition-colors duration-500 min-h-[300px]`}>
                                {sectorIntegrity.runtimeMermaid && sectorIntegrity.runtimeMermaid.length > 20 ? (
                                    <div className="animate-fade-in">
                                        <MarkdownView content={`\`\`\`mermaid\n${sectorIntegrity.runtimeMermaid}\n\`\`\``} initialTheme="dark" showThemeSwitcher={false} compact={true} />
                                    </div>
                                ) : (
                                    <div className="py-12 flex flex-col items-center gap-4 opacity-30">
                                        <Terminal size={64}/>
                                        <p className="text-[10px] font-black uppercase tracking-widest">Trace pending handshake</p>
                                    </div>
                                )}
                            </div>
                        </div>
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
