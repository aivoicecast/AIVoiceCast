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
  Check, FileSignature, Stamp, Shield, User, PenTool, Edit
} from 'lucide-react';
// Fix: Standardized to use @firebase/firestore for modular imports
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

const CONCURRENCY_LIMIT = 3; // Number of parallel neural refractions

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
  const [showPumlSource, setShowPumlSource] = useState(false);
  const [isEditingPuml, setIsEditingPuml] = useState(false);
  const [editedPuml, setEditedPuml] = useState('');
  const [isRepairingPuml, setIsRepairingPuml] = useState(false);

  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [expandedSectors, setExpandedSectors] = useState<Record<string, boolean>>({
      'platform-core': true,
      'judge-deep-dive': true
  });

  const cycleTheme = () => {
      const themes: GraphTheme[] = ['neon-void', 'solarized', 'monokai-plus'];
      const next = themes[(themes.indexOf(graphTheme) + 1) % themes.length];
      setGraphTheme(next);
      dispatchLog(`Graph Theme cycled to: ${next}`, 'info');
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
    dispatchLog("Paging Cloud Ledger for structural refractions...", "info");
    try {
        const auditQ = query(collection(db, 'lecture_cache'), limit(300));
        const channelQ = query(collection(db, 'channels'), limit(100));
        const [auditSnap, channelSnap] = await Promise.all([getDocs(auditQ), getDocs(channelQ)]);

        const audits = auditSnap.docs.map(d => d.data() as GeneratedLecture).filter(l => !!l.audit);
        const chanData = channelSnap.docs.map(d => d.data() as Channel);
        
        setCloudAudits(audits);
        setChannels(chanData);
        dispatchLog(`Ledger Scan Complete. Hydrated ${audits.length} verified nodes.`, 'success', { count: audits.length });
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

  const generatePlantUMLFromGraph = (nodes: DependencyNode[], links: DependencyLink[], title?: string): string => {
      if (!nodes || nodes.length === 0) return '';
      
      let puml = '@startuml\n';
      if (title) puml += `title "${title}"\n`;
      puml += 'skinparam backgroundColor transparent\n';
      puml += 'skinparam defaultFontName "JetBrains Mono"\n';
      puml += 'skinparam defaultFontSize 12\n';
      puml += 'skinparam roundcorner 20\n';
      puml += 'skinparam shadowing false\n';
      puml += 'skinparam ArrowThickness 3.5\n'; 

      if (graphTheme === 'neon-void') {
          puml += 'skinparam ArrowColor #00f2ff\n';
          puml += 'skinparam ArrowFontColor #00f2ff\n';
          puml += 'skinparam ArrowFontSize 11\n';
          puml += 'skinparam componentStyle rectangle\n';
          puml += 'skinparam NoteBackgroundColor #1e1b4b\n';
          puml += 'skinparam NoteBorderColor #6366f1\n\n';
      } else if (graphTheme === 'solarized') {
          puml += 'skinparam ArrowColor #cb4b16\n';
          puml += 'skinparam ArrowFontColor #586e75\n';
          puml += 'skinparam ArrowFontSize 11\n';
          puml += 'skinparam componentStyle rectangle\n\n';
      } else if (graphTheme === 'monokai-plus') {
          puml += 'skinparam ArrowColor #a6e22e\n';
          puml += 'skinparam ArrowFontColor #f92672\n';
          puml += 'skinparam ArrowFontSize 12\n\n';
      }

      const nodeColors = {
          'neon-void': { component: '#6366f1', metric: '#10b981', concept: '#06b6d4', text: '#ffffff' },
          'solarized': { component: '#268bd2', metric: '#859900', concept: '#b58900', text: '#fdf6e3' },
          'monokai-plus': { component: '#66d9ef', metric: '#e6db74', concept: '#ae81ff', text: '#f8f8f2' }
      }[graphTheme];

      nodes.forEach(node => {
          const cleanLabel = (node.label || "Untitled Node").replace(/"/g, "'");
          const safeId = (node.id || Math.random().toString(36).substring(7)).replace(/[^a-zA-Z0-9]/g, '_');
          const color = nodeColors[node.type as keyof typeof nodeColors] || nodeColors.concept;
          
          if (node.type === 'component') {
              puml += `component "${cleanLabel}" as ${safeId} ${color}\n`;
          } else if (node.type === 'metric') {
              puml += `queue "${cleanLabel}" as ${safeId} ${color}\n`;
          } else {
              puml += `node "${cleanLabel}" as ${safeId} ${color}\n`;
          }
      });

      puml += '\n';

      links.forEach(link => {
          const src = (link.source || "").replace(/[^a-zA-Z0-9]/g, '_');
          const tgt = (link.target || "").replace(/[^a-zA-Z0-9]/g, '_');
          
          if (!src || !tgt) return; 

          const lbl = link.label ? ` : "${link.label}"` : '';
          
          const arrowColor = {
              'neon-void': '#00f2ff',
              'solarized': '#cb4b16',
              'monokai-plus': '#a6e22e'
          }[graphTheme];

          puml += `${src} -[${arrowColor},bold]-> ${tgt}${lbl}\n`;
      });

      puml += '@enduml';
      return puml;
  };

  const activePlantUML = useMemo(() => {
      let rawPuml = '';
      const audit = activeAudit?.audit;
      if (!audit) return '';

      if (isEditingPuml) return `\`\`\`plantuml\n${editedPuml}\n\`\`\``;

      if (typeof audit.plantuml === 'string') {
          rawPuml = audit.plantuml.replace(/```plantuml\n|```/g, '');
      } else if (audit.graph) {
          rawPuml = generatePlantUMLFromGraph(audit.graph.nodes, audit.graph.links);
      }
      return rawPuml ? `\`\`\`plantuml\n${rawPuml}\n\`\`\`` : '';
  }, [activeAudit, graphTheme, isEditingPuml, editedPuml, generatePlantUMLFromGraph]);

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
            // LATEST-WINS LOGIC: Ensure we only keep the record with the highest timestamp (freshest data)
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

    neuralRegistryMap.forEach((lecture, topic) => {
        const parentId = (lecture as any).channelId || (lecture as any).bookId || findParentIdByTopic(topic);
        if (parentId === 'system-artifacts') {
            if (!sectors['system-artifacts']) sectors['system-artifacts'] = { id: 'system-artifacts', title: 'Independent Shards', description: 'Neural artifacts.', shards: [], type: 'podcast', priority: -1 };
            if (!sectors['system-artifacts'].shards.some(s => s.topic === topic)) {
                sectors['system-artifacts'].shards.push({ topic, status: 'audited', audit: lecture.audit, sections: lecture.sections });
            }
        }
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
      
      const robustness = audited.map(s => s.audit.robustness || s.audit.AdversarialRobustness);
      const avgRobustness = robustness.filter(r => r === 'High').length >= audited.length / 2 ? 'High' : 'Medium';

      const allNodesMap = new Map<string, DependencyNode>();
      const allLinksMap = new Map<string, DependencyLink>();

      audited.forEach(shard => {
          if (shard.audit?.graph) {
              shard.audit.graph.nodes.forEach((n: DependencyNode) => {
                  if (n && n.id) {
                      // SYMBOLIC SYNC: If multiple shards define the same logic ID, the newest audit wins
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

      // CONSTRUCT RUNTIME EXECUTION TRACE DAG
      const runtimeNodes: DependencyNode[] = [
          { id: 'REG_POLL', label: 'Cloud Ledger Poll', type: 'component' },
          { id: 'BCP_REGEN', label: 'BCP Shard Reconstruction', type: 'component' },
          { id: 'SHADOW_INIT', label: 'Shadow Agent Handshake', type: 'component' },
          { id: 'ADVERSARIAL_PROBE', label: 'Adversarial Probing', type: 'component' },
          { id: 'COHERENCE_V', label: 'Coherence Verification', type: 'metric' },
          { id: 'VPR_LOCK', label: 'VPR Signature Binding', type: 'concept' }
      ];

      const runtimeLinks: DependencyLink[] = [
          { source: 'REG_POLL', target: 'BCP_REGEN', label: 'RESOLVE' },
          { source: 'BCP_REGEN', target: 'SHADOW_INIT', label: 'HYDRATE' },
          { source: 'SHADOW_INIT', target: 'ADVERSARIAL_PROBE', label: 'AUDIT' },
          { source: 'ADVERSARIAL_PROBE', target: 'COHERENCE_V', label: 'SCORE' },
          { source: 'COHERENCE_V', target: 'VPR_LOCK', label: 'NOTARIZE' }
      ];

      return {
          score,
          drift: audited.length > 0 ? worstRisk : 'Unknown',
          robustness: audited.length > 0 ? avgRobustness : 'Unknown',
          total: selectedSector.shards.length,
          audited: audited.length,
          mesh: { 
              nodes: Array.from(allNodesMap.values()),
              links: Array.from(allLinksMap.values())
          },
          runtimeMesh: {
              nodes: runtimeNodes,
              links: runtimeLinks
          },
          history: audited.map(s => ({ topic: s.topic, score: s.audit.coherenceScore || s.audit.StructuralCoherenceScore }))
      };
  }, [selectedSector]);

  const holisticPlantUML = useMemo(() => {
      if (!sectorIntegrity?.mesh) return '';
      const puml = generatePlantUMLFromGraph(sectorIntegrity.mesh.nodes, sectorIntegrity.mesh.links, "Logical Concept Mesh");
      return puml ? `\`\`\`plantuml\n${puml}\n\`\`\`` : '';
  }, [sectorIntegrity, graphTheme, generatePlantUMLFromGraph]);

  const runtimeTracePlantUML = useMemo(() => {
      if (!sectorIntegrity?.runtimeMesh) return '';
      const puml = generatePlantUMLFromGraph(sectorIntegrity.runtimeMesh.nodes, sectorIntegrity.runtimeMesh.links, "Runtime Execution Trace");
      return puml ? `\`\`\`plantuml\n${puml}\n\`\`\`` : '';
  }, [sectorIntegrity, graphTheme, generatePlantUMLFromGraph]);

  const handleOpenExternalGraph = async (pumlMarkdown: string | null) => {
      if (!pumlMarkdown) return;
      const rawPuml = pumlMarkdown.replace(/```plantuml\n|```/g, '').trim();
      try {
          const encoded = await encodePlantUML(rawPuml);
          const url = `https://www.plantuml.com/plantuml/svg/${encoded}`;
          window.open(url, '_blank');
      } catch (e) {
          dispatchLog("Failed to encode PlantUML for external view", "error");
      }
  };

  const handleRepairPuml = async () => {
    if (!editedPuml || isRepairingPuml) return;
    setIsRepairingPuml(true);
    dispatchLog("Neural Repair: Analyzing PlantUML syntax...", "warn");
    try {
        const repaired = await repairPlantUML(editedPuml);
        setEditedPuml(repaired);
        dispatchLog("Syntax Refraction Success. Diagram repaired.", "success");
    } catch (e) {
        dispatchLog("Repair failed.", "error");
    } finally {
        setIsRepairingPuml(false);
    }
  };

  const handleSelectSector = (sector: HierarchyNode) => {
      setSelectedSector(sector);
      setSelectedNode(null);
      setActiveAudit(null);
      setActiveTab('holistic');
      setShowPumlSource(false);
      setExpandedSectors(prev => ({ ...prev, [sector.id]: !prev[sector.id] }));
      dispatchLog(`Sector Selected: ${sector.title}`, 'info');
  };

  const handleSelectNode = (node: any) => {
    dispatchLog(`Hydrating Neural Node: ${node.topic}`, 'info', { 
        hasAudit: !!node.audit, 
        auditUuid: node.audit?.reportUuid,
        auditTimestamp: node.audit?.timestamp ? new Date(node.audit.timestamp).toLocaleString() : 'N/A'
    });
    setSelectedNode(node);
    setShowPumlSource(false);
    setIsEditingPuml(false);
    if (node.audit) {
        setActiveAudit(node);
        setActiveTab('audit');
        setEditedPuml(node.audit.plantuml?.replace(/```plantuml\n|```/g, '') || '');
    } else {
        setActiveAudit(null);
        setActiveTab('audit');
        setEditedPuml('');
    }
  };

  const handleRegenerateOrVerifySector = async () => {
    if (!selectedSector || isBatchAuditing) return;
    setIsBatchAuditing(true);
    setBatchProgress({ current: 0, total: selectedSector.shards.length });
    dispatchLog(`Initiating Intelligent Spectrum Verify [Limit: ${CONCURRENCY_LIMIT}]: ${selectedSector.title}`, 'warn');

    try {
        const shards = [...selectedSector.shards];
        for (let i = 0; i < shards.length; i += CONCURRENCY_LIMIT) {
            const chunk = shards.slice(i, i + CONCURRENCY_LIMIT);
            await Promise.all(chunk.map(async (node, chunkIdx) => {
                const globalIdx = i + chunkIdx;
                let lecture: GeneratedLecture | null = null;
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
                    const audit = await performNeuralLensAudit(lecture);
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
                    }
                }
                setBatchProgress(prev => ({ ...prev, current: prev.current + 1 }));
            }));
            await new Promise(r => setTimeout(r, 200));
        }
        setSelectedSector({ ...selectedSector, shards });
        dispatchLog(`Spectrum Integrity Sync Finalized for ${selectedSector.title}.`, 'success');
    } catch (e: any) {
        dispatchLog(`Batch Fault: ${e.message}`, 'error');
    } finally {
        setIsBatchAuditing(false);
        loadData();
    }
  };

  const handleExportSignedReport = async () => {
    const el = document.getElementById('pdf-export-content');
    if (!el || !activeAudit?.audit) return;
    setIsExportingPDF(true);
    dispatchLog("Neural Signer Handshake: Initiating Report Notarization...", "info");
    
    try {
        const canvas = await html2canvas(el, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' });
        const imgWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, (canvas.height * imgWidth) / canvas.width);
        pdf.addPage();
        const audit = activeAudit.audit;
        pdf.setFillColor(2, 6, 23);
        pdf.rect(0, 0, imgWidth, pageHeight, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(24);
        pdf.text("NEURAL AUDIT CERTIFICATE", 40, 60);
        pdf.setDrawColor(99, 102, 241);
        pdf.setLineWidth(2);
        pdf.line(40, 75, 200, 75);
        pdf.setFontSize(10);
        pdf.setTextColor(148, 163, 184);
        pdf.text("ARTIFACT METADATA", 40, 100);
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(12);
        pdf.text(`SUBJECT: ${activeAudit.topic}`, 40, 125);
        pdf.text(`VERSION: ${audit.version || 'v12.8'}`, 40, 145);
        pdf.text(`TIMESTAMP: ${new Date(audit.timestamp).toLocaleString()}`, 40, 165);
        pdf.text(`NODE UUID: ${audit.reportUuid || generateSecureId()}`, 40, 185);
        pdf.setTextColor(148, 163, 184);
        pdf.text("LOGIC FINGERPRINT", 40, 220);
        pdf.setTextColor(99, 102, 241);
        pdf.setFontSize(8);
        pdf.text(audit.contentHash || 'PENDING', 40, 240);
        const qrCanvas = document.createElement('canvas');
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(audit.reportUuid || 'NA')}`;
        const qrImg = new Image();
        qrImg.crossOrigin = "anonymous";
        qrImg.src = qrUrl;
        await new Promise(r => qrImg.onload = r);
        pdf.addImage(qrImg, 'PNG', 40, 300, 100, 100);
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(14);
        pdf.text("VERIFIED BY NEURAL LENS", 40, 430);
        pdf.save(`Audit_Report_${activeAudit.topic.replace(/\s+/g, '_')}.pdf`);
        dispatchLog("Notarization Complete: Signed artifact dispatched.", "success");
    } catch (e: any) {
        dispatchLog(`Notarization Fault: ${e.message}`, 'error');
    } finally {
        setIsExportingPDF(false);
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
                  <span className="hidden sm:inline">Scheme: {(graphTheme || "neon-void").replace('-', ' ')}</span>
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
                      <input type="text" placeholder="Search sectors or shards..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white focus:ring-1 focus:ring-indigo-500 shadow-inner"/>
                  </div>
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-hide p-2 space-y-6">
                  {loading && hierarchy.length === 0 ? (
                      <div className="py-20 flex flex-col items-center gap-4 text-center">
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
                                                          {hasAudit && shard.audit?.contentHash && <div title="Logic Verified" className="p-0.5 bg-emerald-900/30 rounded"><Check size={10} className="text-emerald-500"/></div>}
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
                              <span className="text-[10px] font-black text-white uppercase tracking-widest">Shadow Handshake</span>
                          </div>
                          <span className="text-xs font-mono font-black text-indigo-300">{Math.round((batchProgress.current / batchProgress.total) * 100)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden shadow-inner">
                          <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}></div>
                      </div>
                      <p className="text-[8px] text-slate-500 uppercase font-bold text-center animate-pulse">Shadow Agent performing recursive verification...</p>
                  </div>
              )}

              {selectedSector && sectorIntegrity && activeTab === 'holistic' ? (
                  <div id="pdf-export-content" className="max-w-5xl w-full mx-auto space-y-12 animate-fade-in-up">
                      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-800 pb-10">
                          <div className="space-y-4 text-left">
                              <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-900/30 border border-indigo-500/30 rounded-full text-indigo-400 text-[9px] font-black uppercase tracking-widest">
                                  <Signal size={12} className="animate-pulse"/> Holistic Spectrum Audit
                              </div>
                              <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">{selectedSector.title}</h2>
                              <p className="text-slate-400 text-lg max-w-xl">{selectedSector.description}</p>
                              <div className="pt-2 flex gap-4">
                                  <button onClick={handleRegenerateOrVerifySector} disabled={isBatchAuditing} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 disabled:opacity-50">
                                      <Zap size={14} fill="currentColor"/> Smart Verify Sector
                                  </button>
                              </div>
                          </div>
                          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3.5rem] shadow-2xl text-center relative overflow-hidden group">
                              <div className="absolute top-0 right-0 p-12 bg-emerald-500/5 blur-3xl rounded-full"></div>
                              <p className="text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest relative z-10">Aggregate Integrity</p>
                              <p className="text-7xl font-black text-emerald-400 italic tracking-tighter relative z-10">{sectorIntegrity.score}%</p>
                              <div className="w-full h-1 bg-slate-800 rounded-full mt-6 overflow-hidden relative z-10">
                                  <div className="h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] transition-all duration-1000" style={{ width: `${sectorIntegrity.score}%` }}></div>
                              </div>
                          </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden group text-left">
                            <div className="absolute top-0 right-0 p-24 bg-indigo-500/5 blur-[100px] rounded-full group-hover:bg-indigo-500/10 transition-colors"></div>
                            <div className="flex justify-between items-center mb-12 relative z-10">
                                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] flex items-center gap-3">
                                    <Network size={18} className="text-indigo-400"/> Logical Concept Mesh
                                </h4>
                                <button onClick={() => handleOpenExternalGraph(holisticPlantUML)} className="p-2 bg-slate-950 border border-slate-800 text-indigo-400 hover:text-white rounded-lg transition-all shadow-lg active:scale-95" title="Open in Zoomable New Window"><ExternalLink size={16}/></button>
                            </div>
                            <div className={`relative z-10 ${containerBg} rounded-[2.5rem] p-8 border border-white/5 shadow-inner transition-colors duration-500 min-h-[300px]`}>
                                {holisticPlantUML ? (
                                    <div className="animate-fade-in">
                                        <MarkdownView content={holisticPlantUML} initialTheme="dark" showThemeSwitcher={false} compact={true} />
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
                            <div className="absolute top-0 right-0 p-24 bg-emerald-500/5 blur-[100px] rounded-full group-hover:bg-emerald-500/10 transition-colors"></div>
                            <div className="flex justify-between items-center mb-12 relative z-10">
                                <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.4em] flex items-center gap-3">
                                    <Activity size={18} className="text-emerald-400"/> Runtime Execution Trace
                                </h4>
                                <button onClick={() => handleOpenExternalGraph(runtimeTracePlantUML)} className="p-2 bg-slate-950 border border-slate-800 text-emerald-400 hover:text-white rounded-lg transition-all shadow-lg active:scale-95" title="Open in Zoomable New Window"><ExternalLink size={16}/></button>
                            </div>
                            <div className={`relative z-10 ${containerBg} rounded-[2.5rem] p-8 border border-white/5 shadow-inner transition-colors duration-500 min-h-[300px]`}>
                                {runtimeTracePlantUML ? (
                                    <div className="animate-fade-in">
                                        <MarkdownView content={runtimeTracePlantUML} initialTheme="dark" showThemeSwitcher={false} compact={true} />
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
              ) : activeAudit?.audit ? (
                  <div id="pdf-export-content" className="max-w-4xl w-full mx-auto space-y-12 animate-fade-in-up">
                      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-800 pb-8">
                          <div className="space-y-3 text-left">
                              <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">{activeAudit.topic}</h2>
                              <div className="flex flex-wrap items-center gap-4 mt-2">
                                  <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 shadow-inner">
                                      <button onClick={() => setActiveTab('audit')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${activeTab === 'audit' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Reasoning Mesh</button>
                                      <button onClick={() => setActiveTab('script')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${activeTab === 'script' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Source Script</button>
                                      <button onClick={() => setActiveTab('holistic')} className="px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all text-slate-500 hover:text-slate-300">Sector Home</button>
                                  </div>
                                  <div className="flex gap-1">
                                    <button onClick={handleExportSignedReport} disabled={isExportingPDF} className="flex items-center gap-2 px-4 py-1.5 bg-indigo-900/30 border border-indigo-500/30 text-indigo-400 hover:text-white rounded-xl text-[9px] font-black uppercase transition-all shadow-lg">
                                        {isExportingPDF ? <Loader2 size={12} className="animate-spin"/> : <FileSignature size={12}/>}
                                        <span>Notarize PDF</span>
                                    </button>
                                  </div>
                              </div>
                          </div>
                          <div className="bg-slate-900 border border-slate-800 px-8 py-4 rounded-[2.5rem] shadow-inner text-center">
                              <p className="text-[8px] font-black text-slate-600 uppercase mb-1 tracking-widest">Node Integrity</p>
                              <p className="text-4xl font-black text-emerald-400 italic tracking-tighter">{formatScore(activeAudit.audit.StructuralCoherenceScore || activeAudit.audit.coherenceScore)}%</p>
                          </div>
                      </div>

                      {activeTab === 'audit' ? (
                        <div className="space-y-12 animate-fade-in text-left">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-xl flex flex-col items-center text-center gap-4">
                                    <div className="p-3 bg-indigo-900/20 text-indigo-400 rounded-2xl"><Activity size={24}/></div>
                                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Logical Drift Risk</h4>
                                    <div className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest border ${ (activeAudit.audit.LogicalDriftRisk || activeAudit.audit.driftRisk) === 'Low' ? 'bg-emerald-950/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-950/20 text-amber-400'}`}>{activeAudit.audit.LogicalDriftRisk || activeAudit.audit.driftRisk} Risk</div>
                                </div>
                                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-xl flex flex-col items-center text-center gap-4">
                                    <div className="p-3 bg-purple-900/20 text-purple-400 rounded-2xl"><ShieldCheck size={24}/></div>
                                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Model Robustness</h4>
                                    <div className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest border ${ (activeAudit.audit.AdversarialRobustness || activeAudit.audit.robustness) === 'High' ? 'bg-emerald-950/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-950/20 text-amber-400'}`}>{activeAudit.audit.AdversarialRobustness || activeAudit.audit.robustness} Rank</div>
                                </div>
                            </div>

                            {activePlantUML && (
                                <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-24 bg-indigo-500/5 blur-[100px] rounded-full group-hover:bg-indigo-500/10 transition-colors"></div>
                                    <div className="flex justify-between items-center mb-10 relative z-10">
                                        <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] flex items-center gap-3">
                                            <Layers size={18} className="text-indigo-400"/> Logic Topology (PlantUML)
                                        </h4>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => handleOpenExternalGraph(activePlantUML)} className="p-2 bg-slate-950 border border-slate-800 text-indigo-400 hover:text-white rounded-lg transition-all shadow-lg active:scale-95" title="Open in Zoomable New Window"><ExternalLink size={16}/></button>
                                            <button onClick={() => setIsEditingPuml(!isEditingPuml)} className={`p-2 rounded-lg transition-all ${isEditingPuml ? 'bg-indigo-600 text-white' : 'bg-slate-950 border border-slate-800 text-slate-500'}`} title="Edit Diagram Source"><Edit size={16}/></button>
                                            {isEditingPuml && <button onClick={handleRepairPuml} disabled={isRepairingPuml} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-lg transition-all">
                                                {isRepairingPuml ? <Loader2 size={12} className="animate-spin"/> : <Zap size={12} fill="currentColor"/>}
                                                AI Repair
                                            </button>}
                                        </div>
                                    </div>
                                    <div className={`relative z-10 ${containerBg} rounded-3xl p-8 shadow-inner overflow-hidden border border-white/5 transition-colors duration-500`}>
                                        {isEditingPuml ? (
                                            <textarea 
                                                value={editedPuml} 
                                                onChange={e => setEditedPuml(e.target.value)}
                                                className="w-full h-[400px] bg-black/60 text-indigo-300 font-mono text-xs p-6 rounded-2xl border border-indigo-500/30 outline-none focus:ring-1 focus:ring-indigo-500"
                                                spellCheck={false}
                                            />
                                        ) : (
                                            <div className="flex justify-center animate-fade-in">
                                                <MarkdownView content={activePlantUML} initialTheme="dark" showThemeSwitcher={false} compact={true} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-24 bg-emerald-500/5 blur-[100px] rounded-full group-hover:bg-emerald-500/10 transition-colors"></div>
                                <div className="flex justify-between items-center mb-8 relative z-10">
                                    <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.4em] flex items-center gap-3">
                                        <Stamp size={18} className="text-emerald-400"/> Sovereign Notary Shard
                                    </h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                                    <div className="space-y-6">
                                        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 flex flex-col gap-4 shadow-inner">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Reasoning Hash (SHA-256)</span>
                                            <code className="text-[10px] font-mono text-indigo-300 break-all bg-black/40 p-3 rounded-xl border border-white/5">{activeAudit.audit.contentHash || 'PENDING'}</code>
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-[2rem] p-6 flex flex-col items-center justify-center gap-4 shadow-2xl relative group/sig overflow-hidden">
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] relative z-10">NEURAL PRISM OFFICIAL SEAL</span>
                                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${activeAudit.audit.reportUuid}`} className="w-12 h-12 opacity-40"/>
                                    </div>
                                </div>
                            </div>
                        </div>
                      ) : (
                        <div className="space-y-8 animate-fade-in-up text-left">
                            <div className="space-y-8 max-w-2xl mx-auto pb-40">
                                {activeAudit.sections && activeAudit.sections.length > 0 ? activeAudit.sections.map((s: any, i: number) => (
                                    <div key={i} className={`flex flex-col ${s.speaker === 'Teacher' ? 'items-start' : 'items-end'} group`}>
                                        <div className="flex items-center gap-2 mb-2 px-4"><span className={`text-[9px] font-black uppercase tracking-widest ${s.speaker === 'Teacher' ? 'text-indigo-400' : 'text-slate-400'}`}>{s.speaker === 'Teacher' ? activeAudit.professorName : activeAudit.studentName}</span></div>
                                        <div className={`px-6 py-4 rounded-3xl shadow-xl transition-all ${s.speaker === 'Teacher' ? 'bg-slate-900 border border-indigo-500/20 text-white rounded-tl-sm' : 'bg-slate-900/50 text-slate-300 rounded-tr-sm'}`}>
                                            <p className="text-sm leading-relaxed antialiased font-medium">{s.text}</p>
                                        </div>
                                    </div>
                                )) : <div className="py-20 text-center text-slate-500 italic">No transcript shards present.</div>}
                            </div>
                        </div>
                      )}
                  </div>
              ) : selectedSector ? (
                  <div className="h-full w-full flex flex-col items-center justify-center text-center space-y-12 animate-fade-in">
                       <div className="space-y-6">
                            <div className="relative inline-block">
                                <div className="w-32 h-32 bg-slate-900 border-4 border-slate-800 rounded-[3.5rem] flex items-center justify-center text-slate-600 shadow-2xl"><Library size={64}/></div>
                                <div className="absolute -bottom-2 -right-2 p-3 bg-indigo-600 rounded-2xl border-4 border-slate-950 text-white shadow-xl animate-pulse"><Target size={24}/></div>
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">{selectedSector.title}</h2>
                                <p className="text-slate-500 max-w-md mx-auto text-sm leading-relaxed font-medium">Holistic Spectrum Integrity is currently unrefracted. Initialize a batch audit to compute sector metrics.</p>
                            </div>
                       </div>
                       <button onClick={handleRegenerateOrVerifySector} disabled={isBatchAuditing} className="px-12 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-900/40 transition-all active:scale-95 flex items-center gap-4">{isBatchAuditing ? <Loader2 className="animate-spin" size={24}/> : <Sparkles size={24}/>}<span>Intelligent Spectrum Verify</span></button>
                  </div>
              ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-800 space-y-12 opacity-30"><FileSearch size={160} strokeWidth={0.5} /><h3 className="text-4xl font-black uppercase italic tracking-tighter">Observability Portal</h3></div>
              )}
          </main>
      </div>
    </div>
  );
};

export default NeuralLens;