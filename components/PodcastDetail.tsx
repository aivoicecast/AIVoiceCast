
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Channel, GeneratedLecture, Chapter, SubTopic, UserProfile, TtsProvider } from '../types';
import { 
  ArrowLeft, BookOpen, Loader2, ChevronDown, ChevronRight,
  Sparkles, Play, Pause, Volume2, 
  RefreshCw, X, AlertTriangle, PlayCircle, 
  CheckCircle, Gauge, Speaker, Zap, BrainCircuit, SkipBack, SkipForward,
  Database, Languages, FileDown, ShieldCheck, Printer, Bookmark, CloudDownload, CloudCheck, HardDrive, BookText, CloudUpload, Archive, FileText, FileOutput, QrCode
} from 'lucide-react';
import { generateLectureScript } from '../services/lectureGenerator';
import { generateChannelCoverArt } from '../services/channelGenerator';
import { synthesizeSpeech, speakSystem } from '../services/tts';
import { getCachedLectureScript, cacheLectureScript, saveLocalAsset } from '../utils/db';
import { getGlobalAudioContext, registerAudioOwner, warmUpAudioContext, connectOutput, getSystemVoicesAsync, syncPrimeSpeech, SPEECH_REGISTRY } from '../utils/audioUtils';
import { MarkdownView } from './MarkdownView';
import { getCloudCachedLecture, saveCloudCachedLecture, updateUserProfile } from '../services/firestoreService';
import { Visualizer } from './Visualizer';
import { SPOTLIGHT_DATA } from '../utils/spotlightContent';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { generateSecureId, generateContentUid } from '../utils/idUtils';
import { GoogleGenAI } from '@google/genai';

export const CHINESE_FONT_STACK = '"Microsoft YaHei", "PingFang SC", "STHeiti", sans-serif';
export const SERIF_FONT_STACK = 'Georgia, "Times New Roman", STSong, "SimSun", serif';

interface PodcastDetailProps {
  channel: Channel;
  onBack: () => void;
  onStartLiveSession: (channel: Channel, context?: string, recordingEnabled?: boolean, bookingId?: string, videoEnabled?: boolean, cameraEnabled?: boolean, activeSegment?: { index: number, lectureId: string }) => void;
  language: 'en' | 'zh';
  currentUser: any;
  userProfile: UserProfile | null;
  onUpdateChannel: (updated: Channel) => Promise<void>;
  isProMember: boolean;
}

type NodeStatus = 'local' | 'cloud' | 'none' | 'checking' | 'static';

export const PodcastDetail: React.FC<PodcastDetailProps> = ({ 
  channel, onBack, onStartLiveSession, language, currentUser, userProfile, onUpdateChannel, isProMember 
}) => {
  const [activeSubTopicId, setActiveSubTopicId] = useState<string | null>(null);
  const [activeLecture, setActiveLecture] = useState<GeneratedLecture | null>(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isSyncingContent, setIsSyncingContent] = useState(false);
  const [syncPhase, setSyncPhase] = useState<'registry' | 'vault' | 'neural'>('registry');
  const [playedSubTopicIds, setPlayedSubTopicIds] = useState<Set<string>>(new Set());
  const [liveVolume, setLiveVolume] = useState(0);
  
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, NodeStatus>>({});
  const [currentProvider, setCurrentProvider] = useState<TtsProvider>(userProfile?.preferredTtsProvider || 'system');
  const [showProviderMenu, setShowProviderMenu] = useState(false);

  const [isBatchSynthesizing, setIsBatchSynthesizing] = useState(false);
  const [isExportingBook, setIsExportingBook] = useState(false);
  const [bookProgress, setBookProgress] = useState("");
  const [isExportingText, setIsExportingText] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  const dispatchLog = useCallback((text: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
      window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: text, type } }));
  }, []);

  const chapters = useMemo(() => {
      if (channel.chapters && channel.chapters.length > 0) return channel.chapters;
      const spotlight = SPOTLIGHT_DATA[channel.id];
      if (spotlight && spotlight.curriculum) return spotlight.curriculum;
      return [];
  }, [channel.id, channel.chapters]);

  const flatCurriculum = useMemo(() => chapters.flatMap(c => c.subTopics), [chapters]);
  
  const currentSubTopicIndex = useMemo(() => 
    flatCurriculum.findIndex(s => s.id === activeSubTopicId), 
  [flatCurriculum, activeSubTopicId]);

  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const playbackSessionRef = useRef(0);
  const mountedRef = useRef(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<number, HTMLDivElement | null>>({});
  
  const nextAudioBufferRef = useRef<Map<number, AudioBuffer>>(new Map());

  const checkRegistryNode = async (sub: SubTopic): Promise<NodeStatus> => {
    const spotlight = SPOTLIGHT_DATA[channel.id];
    if (spotlight && spotlight.lectures[sub.title]) return 'static';

    const cacheKey = `lecture_${channel.id}_${sub.id}_${language}`;
    const local = await getCachedLectureScript(cacheKey);
    if (local) return 'local';
    
    const contentUid = await generateContentUid(sub.title, channel.description, language);
    const cloud = await getCloudCachedLecture(channel.id, contentUid, language);
    if (cloud) return 'cloud';
    
    return 'none';
  };

  const updateRegistryStatus = useCallback(async () => {
    const statuses: Record<string, NodeStatus> = {};
    for (const sub of flatCurriculum) {
        statuses[sub.id] = await checkRegistryNode(sub);
    }
    setNodeStatuses(statuses);
  }, [channel.id, flatCurriculum, language]);

  useEffect(() => {
    mountedRef.current = true;
    updateRegistryStatus();
    return () => { mountedRef.current = false; stopAllAudio('Unmount'); };
  }, [updateRegistryStatus]);

  useEffect(() => {
    if (activeLecture && currentSectionIndex >= 0) {
        const target = sectionRefs.current[currentSectionIndex];
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentSectionIndex, activeLecture]);

  const stopAllAudio = useCallback((context: string = 'User') => {
      playbackSessionRef.current++;
      setIsPlaying(false);
      setIsBuffering(false);
      setLiveVolume(0);
      activeSourcesRef.current.forEach(s => { try { s.stop(); s.disconnect(); } catch(e) {} });
      activeSourcesRef.current.clear();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      SPEECH_REGISTRY.clear();
      nextAudioBufferRef.current.clear();
      dispatchLog(`[Playback] Stopped (Context: ${context}).`, 'info');
  }, [dispatchLog]);

  const handleSelectSubTopic = async (sub: SubTopic, shouldStop = true) => {
      if (activeSubTopicId === sub.id && activeLecture) return activeLecture;
      if (shouldStop) stopAllAudio('Switch Topic');
      
      setActiveSubTopicId(sub.id);

      const spotlight = SPOTLIGHT_DATA[channel.id];
      if (spotlight && spotlight.lectures[sub.title]) {
          const staticLecture = spotlight.lectures[sub.title];
          setActiveLecture(staticLecture);
          setIsSyncingContent(false);
          setCurrentSectionIndex(-1);
          return staticLecture;
      }

      setIsSyncingContent(true);
      setSyncPhase('registry');
      setActiveLecture(null);
      setCurrentSectionIndex(-1);

      try {
          const cacheKey = `lecture_${channel.id}_${sub.id}_${language}`;
          let lecture = await getCachedLectureScript(cacheKey);
          
          if (!lecture) {
              const contentUid = await generateContentUid(sub.title, channel.description, language);
              lecture = await getCloudCachedLecture(channel.id, contentUid, language);
              
              if (!lecture) {
                  setSyncPhase('neural');
                  dispatchLog(`Syncing node ${sub.title}...`, 'info');
                  lecture = await generateLectureScript(sub.title, channel.description, language, channel.id, channel.voiceName);
                  if (lecture) setSyncPhase('vault');
              }
              
              if (lecture) {
                  await cacheLectureScript(cacheKey, lecture);
                  updateRegistryStatus();
              }
          }
          
          if (lecture && mountedRef.current) {
              setActiveLecture(lecture);
              return lecture;
          }
      } catch (e: any) {
          dispatchLog(`Vault Error: ${e.message}`, 'error');
      } finally {
          setIsSyncingContent(false);
      }
      return null;
  };

  // --- PROFESSIONAL BOOK SYNTHESIS ENGINE ---
  const generateChapterSummary = async (ch: Chapter): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const langText = language === 'zh' ? '使用简体中文输出。' : 'Output in English.';
        const prompt = `Write a technical 2-sentence executive summary for a book chapter titled "${ch.title}". ${langText} Focus on the core architectural takeaways. Maximum 50 words.`;
        const res = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { thinkingConfig: { thinkingBudget: 0 } }
        });
        return res.text || "Summary pending.";
    } catch (e) { return "Summary unavailable."; }
  };

  const wrapContent = (html: string, chapterTitle: string, hash: string, pageNum: number) => `
    <div style="width: 750px; height: 1050px; background: #ffffff; color: #0f172a; padding: 80px 100px; font-family: ${SERIF_FONT_STACK}; display: flex; flex-direction: column; position: relative;">
        <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px; margin-bottom: 40px;">
            <span style="font-size: 10px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 0.2em;">${chapterTitle}</span>
            <span style="font-size: 10px; font-weight: 900; color: #cbd5e1;">NEURAL PRISM MANUSCRIPT</span>
        </div>
        <div style="flex: 1; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-start;">
            ${html}
        </div>
        <div style="margin-top: auto; padding-top: 20px; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
            <p style="font-size: 8px; color: #cbd5e1; font-weight: 900; letter-spacing: 0.2em; margin: 0;">BOUND BY NEURAL PRISM // TRACE: ${hash}</p>
            <p style="font-size: 10px; color: #64748b; font-weight: 900; margin: 0;">PAGE ${pageNum}</p>
        </div>
    </div>
  `;

  const handleGenerateBook = async () => {
    setIsExportingBook(true);
    setBookProgress("Initializing Publishing Engine...");
    dispatchLog("Initializing Book Synthesis Pipeline...", "info");
    
    let pageCounter = 1;

    try {
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const sessionHash = generateSecureId().substring(0, 12).toUpperCase();
        const channelUrl = `${window.location.origin}?view=podcast_detail&channelId=${channel.id}`;
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(channelUrl)}`;

        const captureContainer = document.createElement('div');
        captureContainer.style.width = '750px'; 
        captureContainer.style.position = 'fixed';
        captureContainer.style.left = '-10000px';
        captureContainer.style.backgroundColor = '#ffffff';
        document.body.appendChild(captureContainer);

        const renderToPdf = async (html: string, addPageBefore = true) => {
            if (addPageBefore) {
                pdf.addPage();
                pageCounter++;
            }
            captureContainer.innerHTML = html;
            const canvas = await html2canvas(captureContainer, { scale: 2.2, useCORS: true, backgroundColor: '#ffffff', logging: false });
            const imgData = canvas.toDataURL('image/jpeg', 0.85);
            pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, (canvas.height * pageWidth) / canvas.width);
        };

        // --- 1. FRONT COVER ---
        setBookProgress("Printing Front Cover...");
        await renderToPdf(`
          <div style="width: 750px; height: 1050px; background: #020617; color: white; padding: 120px 100px; font-family: ${SERIF_FONT_STACK}; display: flex; flex-direction: column; justify-content: space-between; position: relative; border: 25px solid #0f172a;">
              <div style="position: absolute; top: 0; right: 0; width: 400px; height: 400px; background: radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, transparent 70%);"></div>
              <div>
                  <p style="text-transform: uppercase; letter-spacing: 0.6em; font-size: 14px; font-weight: 900; color: #818cf8; margin-bottom: 25px;">Neural Prism Technical Publication</p>
                  <h1 style="font-size: 64px; font-weight: 900; italic: true; margin: 0; line-height: 1.1; text-transform: uppercase; letter-spacing: -0.02em;">${channel.title}</h1>
                  <div style="width: 120px; height: 10px; background: #6366f1; margin-top: 45px; border-radius: 5px;"></div>
              </div>
              <div style="display: flex; align-items: flex-end; justify-content: space-between;">
                  <div>
                      <p style="text-transform: uppercase; letter-spacing: 0.2em; font-size: 12px; color: #64748b; font-weight: 900; margin-bottom: 5px;">Compiled by Neural Host</p>
                      <p style="font-size: 32px; font-weight: 900; margin: 0; color: #fff;">@${channel.author}</p>
                  </div>
                  <div style="text-align: right;">
                      <p style="font-size: 10px; color: #475569; font-mono: true;">TRACE ID: ${sessionHash}</p>
                  </div>
              </div>
          </div>
        `, false);

        // --- 2. TABLE OF CONTENTS ---
        setBookProgress("Generating Index...");
        await renderToPdf(`
          <div style="width: 750px; height: 1050px; background: #ffffff; color: #0f172a; padding: 120px 100px; font-family: ${SERIF_FONT_STACK};">
              <h1 style="font-size: 42px; font-weight: 900; margin-bottom: 60px; text-transform: uppercase; border-bottom: 5px solid #020617; padding-bottom: 20px;">Refractive Index</h1>
              <div style="display: flex; flex-direction: column; gap: 16px;">
                  ${chapters.map((ch, idx) => `
                      <div style="display: flex; justify-content: space-between; border-bottom: 1px dotted #cbd5e1; padding-bottom: 8px; align-items: baseline;">
                          <span style="font-weight: 900; color: #1e293b; font-size: 18px;">Section 0${idx+1}: ${ch.title}</span>
                          <span style="color: #64748b; font-size: 12px; font-weight: bold;">NODE ${idx+1}</span>
                      </div>
                  `).join('')}
              </div>
              <div style="margin-top: 100px; padding: 40px; background: #f8fafc; border-radius: 30px; border: 1px solid #e2e8f0; font-style: italic; color: #64748b; font-size: 14px; line-height: 1.6;">
                  This manuscript represents a deterministic refraction of the "${channel.title}" learning path. Total sections: ${chapters.length}.
              </div>
          </div>
        `);

        // --- 3. CHAPTERS & CONTENT ---
        for (let cIdx = 0; cIdx < chapters.length; cIdx++) {
            const ch = chapters[cIdx];
            setBookProgress(`Binding Node ${cIdx+1}...`);
            dispatchLog(`Processing Book Section ${cIdx+1}: ${ch.title}`, 'info');
            
            const summary = await generateChapterSummary(ch);
            
            // Chapter Cover
            await renderToPdf(`
              <div style="width: 750px; height: 1050px; background: #1e293b; color: white; padding: 80px 100px; font-family: ${SERIF_FONT_STACK}; display: flex; flex-direction: column; justify-content: center; position: relative;">
                  <div style="font-size: 200px; font-weight: 900; color: rgba(255,255,255,0.03); position: absolute; top: 80px; right: 100px;">0${cIdx+1}</div>
                  <p style="font-size: 14px; font-weight: 900; color: #818cf8; text-transform: uppercase; letter-spacing: 0.6em; margin-bottom: 25px;">Registry Segment</p>
                  <h1 style="font-size: 56px; font-weight: 900; text-transform: uppercase; margin: 0; line-height: 1.1; max-width: 550px;">${ch.title}</h1>
                  <div style="width: 80px; height: 5px; background: #6366f1; margin-top: 45px; margin-bottom: 60px;"></div>
                  <div style="max-width: 550px; font-size: 20px; color: #cbd5e1; line-height: 1.8; background: rgba(255,255,255,0.05); padding: 45px; border-radius: 32px; border: 1px solid rgba(255,255,255,0.1); font-style: italic; box-shadow: 0 30px 60px -12px rgba(0,0,0,0.3); word-wrap: break-word;">
                      "${summary}"
                  </div>
              </div>
            `);

            const maxLinesPerPage = 36;
            let currentLines = 0;
            let currentPageHtml = "";

            for (const sub of ch.subTopics) {
                const contentUid = await generateContentUid(sub.title, channel.description, language);
                const cacheKey = `lecture_${channel.id}_${sub.id}_${language}`;
                
                let lecture = SPOTLIGHT_DATA[channel.id]?.lectures[sub.title];
                if (!lecture) {
                    lecture = await getCachedLectureScript(cacheKey) || await getCloudCachedLecture(channel.id, contentUid, language);
                }
                if (!lecture) {
                    lecture = await generateLectureScript(sub.title, channel.description, language, channel.id, channel.voiceName);
                }
                
                if (lecture) {
                    const subHeader = `<h2 style="font-size: 18px; font-weight: 900; color: #6366f1; margin-top: 40px; margin-bottom: 20px; text-transform: uppercase; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px;">${sub.title}</h2>`;
                    
                    if (currentLines > 28) {
                        await renderToPdf(wrapContent(currentPageHtml, ch.title, sessionHash, pageCounter));
                        currentPageHtml = subHeader;
                        currentLines = 4;
                    } else {
                        currentPageHtml += subHeader;
                        currentLines += 4;
                    }

                    for (const s of lecture.sections) {
                        const isTeacher = s.speaker === 'Teacher';
                        const speakerName = isTeacher ? (lecture.professorName || 'Host') : (lecture.studentName || 'Student');
                        const textLines = Math.ceil(s.text.length / 90) + 1;
                        
                        if (currentLines + textLines > maxLinesPerPage) {
                            await renderToPdf(wrapContent(currentPageHtml, ch.title, sessionHash, pageCounter));
                            currentPageHtml = "";
                            currentLines = 0;
                        }

                        currentPageHtml += `
                          <div style="margin-bottom: 18px; font-family: ${SERIF_FONT_STACK}; font-size: 13px; line-height: 1.6; color: #334155;">
                              <span style="font-weight: 900; color: ${isTeacher ? '#4338ca' : '#475569'}; text-transform: uppercase; margin-right: 8px; font-size: 11px;">${speakerName}:</span>
                              <span>${s.text}</span>
                          </div>
                        `;
                        currentLines += textLines + 1;
                    }
                }
            }
            if (currentPageHtml) {
                await renderToPdf(wrapContent(currentPageHtml, ch.title, sessionHash, pageCounter));
            }
        }

        // --- 4. BACK COVER WITH SCAN CODE ---
        setBookProgress("Finalizing Publication...");
        await renderToPdf(`
          <div style="width: 750px; height: 1050px; background: #020617; color: white; padding: 120px 100px; font-family: ${SERIF_FONT_STACK}; display: flex; flex-direction: column; justify-content: center; text-align: center; border: 25px solid #0f172a;">
              <div style="margin-bottom: 80px;">
                  <div style="width: 60px; height: 4px; background: #6366f1; margin: 0 auto 35px auto;"></div>
                  <h2 style="font-size: 38px; font-weight: 900; letter-spacing: -0.02em; text-transform: uppercase; italic: true; margin-bottom: 25px;">Synthesized Intelligence</h2>
                  <p style="color: #94a3b8; font-size: 20px; max-width: 550px; margin: 0 auto; line-height: 1.8;">
                      This technical manuscript is a sovereign refraction of the "${channel.title}" activity ledger.
                  </p>
              </div>

              <div style="background: white; padding: 40px; border-radius: 50px; width: fit-content; margin: 0 auto; box-shadow: 0 40px 100px -20px rgba(99, 102, 241, 0.4); border: 8px solid #6366f1;">
                  <img src="${qrCodeUrl}" style="width: 250px; height: 250px;" />
                  <p style="color: #020617; font-size: 12px; font-weight: 900; margin-top: 25px; text-transform: uppercase; letter-spacing: 0.25em;">Scan to Access Live Registry</p>
              </div>

              <div style="margin-top: 100px;">
                  <p style="font-size: 13px; font-weight: 900; color: #6366f1; text-transform: uppercase; letter-spacing: 0.3em; margin-bottom: 12px;">NEURAL PRISM PUBLISHING</p>
                  <p style="font-size: 10px; color: #475569; font-mono: true;">Verified via Protocol v6.6.1 // Ledger Node: ${generateSecureId().substring(0, 16)}</p>
              </div>
          </div>
        `);

        document.body.removeChild(captureContainer);
        pdf.save(`${channel.title.replace(/\s+/g, '_')}_Neural_Book.pdf`);
        dispatchLog("Book Dispatched to Local Drive.", "success");
    } catch (e: any) { 
        dispatchLog(`Book failure: ${e.message}`, 'error'); 
    } finally { 
        setIsExportingBook(false); 
        setBookProgress("");
    }
  };

  const handleBatchSynthesize = async () => {
      if (isBatchSynthesizing) return;
      setIsBatchSynthesizing(true);
      setBatchProgress({ current: 0, total: flatCurriculum.length });
      
      try {
          for (let i = 0; i < flatCurriculum.length; i++) {
              const sub = flatCurriculum[i];
              
              const spotlight = SPOTLIGHT_DATA[channel.id];
              if (spotlight && spotlight.lectures[sub.title]) {
                  setBatchProgress({ current: i + 1, total: flatCurriculum.length });
                  continue;
              }

              const contentUid = await generateContentUid(sub.title, channel.description, language);
              const cacheKey = `lecture_${channel.id}_${sub.id}_${language}`;
              
              let lecture = await getCachedLectureScript(cacheKey);
              if (!lecture) {
                  lecture = await getCloudCachedLecture(channel.id, contentUid, language);
                  if (!lecture) {
                      dispatchLog(`Synthesizing Manuscript Segment ${i+1}/${flatCurriculum.length}: ${sub.title}`, 'info');
                      lecture = await generateLectureScript(sub.title, channel.description, language, channel.id, channel.voiceName);
                  }
                  if (lecture) {
                      await cacheLectureScript(cacheKey, lecture);
                      if (currentUser) {
                          await saveCloudCachedLecture(channel.id, contentUid, language, lecture);
                      }
                  }
              }
              setBatchProgress({ current: i + 1, total: flatCurriculum.length });
          }
          dispatchLog(`Batch Refraction Complete.`, 'success');
          updateRegistryStatus();
      } catch (e: any) {
          dispatchLog(`Batch failed: ${e.message}`, 'error');
      } finally {
          setIsBatchSynthesizing(false);
      }
  };

  const handleDownloadTextScript = async () => {
    setIsExportingText(true);
    dispatchLog("Collating Text Manuscript...", "info");
    
    try {
        let fullScript = `# ${channel.title}\n\n`;
        fullScript += `> ${channel.description}\n\n`;
        fullScript += `--- \n\n`;

        for (let i = 0; i < flatCurriculum.length; i++) {
            const sub = flatCurriculum[i];
            const contentUid = await generateContentUid(sub.title, channel.description, language);
            const cacheKey = `lecture_${channel.id}_${sub.id}_${language}`;
            
            let lecture = SPOTLIGHT_DATA[channel.id]?.lectures[sub.title];
            if (!lecture) {
                lecture = await getCachedLectureScript(cacheKey) || await getCloudCachedLecture(channel.id, contentUid, language);
            }
            
            if (lecture) {
                fullScript += `## SECTION ${i + 1}: ${sub.title}\n\n`;
                lecture.sections.forEach(s => {
                    const speakerName = s.speaker === 'Teacher' ? lecture.professorName : lecture.studentName;
                    fullScript += `**${speakerName}**: ${s.text}\n\n`;
                });
                fullScript += `\n`;
            }
        }

        const blob = new Blob([fullScript], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${channel.title.replace(/\s+/g, '_')}_Manuscript.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        dispatchLog("Text Manuscript Downloaded.", "success");
    } catch (e: any) {
        dispatchLog(`Export failed: ${e.message}`, 'error');
    } finally {
        setIsExportingText(false);
    }
  };

  /**
   * Enhanced Playback Logic with Neural Heartbeat.
   * This is designed to stay active past the 24-minute mark by aggressively
   * warming the AudioContext before every single section.
   */
  const handlePlayActiveLecture = async (startIndex = 0) => {
    syncPrimeSpeech();
    if (isPlaying) { 
        stopAllAudio('User Stop'); 
        return; 
    }
    
    setIsPlaying(true);
    const localSession = ++playbackSessionRef.current;
    
    registerAudioOwner(`GlobalPodcastStream`, () => {
        if (playbackSessionRef.current === localSession) stopAllAudio('External Eviction');
    });

    try {
        let currentIndex = currentSubTopicIndex < 0 ? 0 : currentSubTopicIndex;
        let currentLecture = activeLecture;
        const ctx = getGlobalAudioContext();
        
        while (currentIndex < flatCurriculum.length && localSession === playbackSessionRef.current) {
            if (!currentLecture) {
                currentLecture = await handleSelectSubTopic(flatCurriculum[currentIndex], false);
                if (!currentLecture) break;
            }
            
            setPlayedSubTopicIds(prev => new Set(prev).add(flatCurriculum[currentIndex].id));
            
            for (let i = startIndex; i < currentLecture.sections.length; i++) {
                if (localSession !== playbackSessionRef.current || !mountedRef.current) break;
                
                // NEURAL HEARTBEAT: Proactively resume before every sentence.
                // Browsers often idle the context if the "user interaction" was long ago.
                await warmUpAudioContext(ctx);
                
                setCurrentSectionIndex(i);
                const section = currentLecture.sections[i];
                
                const nextIdx = i + 1;
                if (nextIdx < currentLecture.sections.length && currentProvider !== 'system') {
                    const nextSection = currentLecture.sections[nextIdx];
                    const nextVoice = nextSection.speaker === 'Teacher' ? (channel.voiceName || 'Zephyr') : 'Puck';
                    
                    synthesizeSpeech(nextSection.text, nextVoice, ctx, currentProvider, language, {
                        channelId: channel.id, topicId: flatCurriculum[currentIndex].id, 
                        nodeId: `node_${channel.id}_${flatCurriculum[currentIndex].id}_${nextIdx}_${language}`
                    }, userProfile?.cloudTtsApiKey).then(res => {
                        if (res.buffer) nextAudioBufferRef.current.set(nextIdx, res.buffer);
                    }).catch(() => {});
                }

                if (currentProvider === 'system') {
                    setLiveVolume(0.8);
                    await speakSystem(section.text, language);
                    setLiveVolume(0);
                } else {
                    let audioBuffer = nextAudioBufferRef.current.get(i);
                    
                    if (!audioBuffer) {
                        setIsBuffering(true);
                        const voice = section.speaker === 'Teacher' ? (channel.voiceName || 'Zephyr') : 'Puck';
                        const res = await synthesizeSpeech(section.text, voice, ctx, currentProvider, language, {
                            channelId: channel.id, topicId: flatCurriculum[currentIndex].id, 
                            nodeId: `node_${channel.id}_${flatCurriculum[currentIndex].id}_${i}_${language}`
                        }, userProfile?.cloudTtsApiKey);
                        audioBuffer = res.buffer || undefined;
                        setIsBuffering(false);
                    } else {
                        nextAudioBufferRef.current.delete(i);
                    }
                    
                    if (audioBuffer && localSession === playbackSessionRef.current) {
                        setLiveVolume(0.8);
                        // Final safety check on context state.
                        await warmUpAudioContext(ctx);
                        
                        await new Promise<void>((resolve) => {
                            const source = ctx.createBufferSource();
                            source.buffer = audioBuffer!;
                            connectOutput(source, ctx);
                            activeSourcesRef.current.add(source);
                            source.onended = () => { 
                                activeSourcesRef.current.delete(source); 
                                setLiveVolume(0); 
                                resolve(); 
                            };
                            source.start(0);
                        });
                    }
                }
                
                if (localSession !== playbackSessionRef.current) break;
                // Padding between sections for natural cadence.
                await new Promise(r => setTimeout(r, 800));
            }
            
            if (localSession === playbackSessionRef.current && mountedRef.current) {
                currentIndex++; 
                startIndex = 0; 
                currentLecture = null; 
                nextAudioBufferRef.current.clear();
                // Pause for 1.5s between chapters to allow browser to breath.
                await new Promise(r => setTimeout(r, 1500));
            } else {
                break;
            }
        }
        
        if (localSession === playbackSessionRef.current) {
            setIsPlaying(false);
            dispatchLog(`[Session] Traversing complete. Spectrum fully refracted.`, 'success');
        }
    } catch (e: any) { 
        dispatchLog(`[Engine Fault] ${e.message}`, 'error'); 
        stopAllAudio('Catch Error'); 
    }
  };

  const handleNext = async () => {
    if (currentSubTopicIndex < flatCurriculum.length - 1) {
        const wasPlaying = isPlaying;
        await handleSelectSubTopic(flatCurriculum[currentSubTopicIndex + 1]);
        if (wasPlaying) handlePlayActiveLecture(0);
    }
  };

  const handlePrev = async () => {
    if (currentSubTopicIndex > 0) {
        const wasPlaying = isPlaying;
        await handleSelectSubTopic(flatCurriculum[currentSubTopicIndex - 1]);
        if (wasPlaying) handlePlayActiveLecture(0);
    }
  };

  const handleSwitchProvider = async (p: TtsProvider) => {
      setCurrentProvider(p);
      setShowProviderMenu(false);
      if (currentUser) updateUserProfile(currentUser.uid, { preferredTtsProvider: p });
  };

  return (
    <div className="h-full flex bg-slate-950 overflow-hidden font-sans relative">
      <aside className="w-[340px] border-r border-slate-800 bg-slate-900/30 flex flex-col shrink-0">
          <div className="p-6 border-b border-slate-800 bg-slate-950/40 space-y-6">
              <div className="flex items-center justify-between">
                  <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"><ArrowLeft size={20} /></button>
                  <div className="relative">
                      <button onClick={() => setShowProviderMenu(!showProviderMenu)} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-[9px] font-black uppercase tracking-widest text-indigo-400 hover:border-indigo-500 transition-all shadow-lg">
                          <Speaker size={12}/>
                          <span>{currentProvider}</span>
                          <ChevronDown size={10} className={showProviderMenu ? 'rotate-180' : ''}/>
                      </button>
                      {showProviderMenu && (
                          <>
                              <div className="fixed inset-0 z-40" onClick={() => setShowProviderMenu(false)}></div>
                              <div className="absolute top-full left-0 mt-1 w-32 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden py-1 animate-fade-in-up">
                                  {(['gemini', 'google', 'openai', 'system'] as const).map(p => (
                                      <button key={p} onClick={() => handleSwitchProvider(p)} className={`w-full text-left px-3 py-2 text-[9px] font-bold uppercase transition-colors ${currentProvider === p ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>{p}</button>
                                  ))}
                              </div>
                          </>
                      )}
                  </div>
              </div>
              <div className="flex gap-4">
                  <div className="relative group shrink-0">
                      <img src={channel.imageUrl || "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=200&q=80"} className="w-16 h-16 rounded-2xl object-cover shadow-xl border border-white/5" />
                  </div>
                  <div className="flex-1 min-w-0">
                      <h2 className="text-white font-black uppercase tracking-tighter italic text-xl leading-none truncate">{channel.title}</h2>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Sovereign Registry</p>
                  </div>
              </div>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-6">
              {chapters.map((ch, idx) => (
                  <div key={ch.id} className="space-y-2">
                      <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] px-2">Sector 0{idx+1}: {ch.title}</h3>
                      <div className="space-y-1">
                          {ch.subTopics.map(sub => {
                              const isSelected = activeSubTopicId === sub.id;
                              const status = nodeStatuses[sub.id] || 'none';
                              return (
                                  <button key={sub.id} onClick={() => handleSelectSubTopic(sub)} className={`w-full flex items-center justify-between px-3 py-3 rounded-xl transition-all border ${isSelected ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-slate-900/40 border-transparent text-slate-400 hover:bg-slate-800'}`}>
                                      <div className="flex items-center gap-3 min-w-0">
                                          {isSelected && isPlaying ? <Pause size={14} fill="currentColor"/> : isSelected ? <BookOpen size={14}/> : <div className="w-3.5 h-3.5 flex items-center justify-center opacity-40"><div className="w-1.5 h-1.5 rounded-full border border-current"></div></div>}
                                          <span className="text-[11px] font-bold truncate tracking-tight">{sub.title}</span>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                          {status === 'checking' ? <Loader2 size={12} className="animate-spin text-slate-600" /> : status === 'local' ? <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div> : status === 'cloud' ? <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]"></div> : status === 'static' ? <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]" title="Static Node"></div> : <div className="w-1.5 h-1.5 rounded-full bg-slate-700 opacity-20"></div>}
                                      </div>
                                  </button>
                              );
                          })}
                      </div>
                  </div>
              ))}
          </div>
          <div className="p-4 border-t border-slate-800 bg-slate-950/40 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                  <button onClick={handleBatchSynthesize} disabled={isBatchSynthesizing} className="py-3 bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border border-slate-700 flex items-center justify-center gap-2">
                      {isBatchSynthesizing ? <Loader2 size={14} className="animate-spin" /> : <CloudUpload size={14}/>}
                      {isBatchSynthesizing ? `Refracting ${batchProgress.current}` : 'Refract Vault'}
                  </button>
                  <button onClick={handleDownloadTextScript} disabled={isExportingText} className="py-3 bg-slate-800 hover:bg-blue-600 text-slate-400 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border border-slate-700 flex items-center justify-center gap-2">
                      {isExportingText ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14}/>}
                      Export Text
                  </button>
                  <button onClick={handleGenerateBook} disabled={isExportingBook} className="col-span-2 py-3 bg-slate-800 hover:bg-emerald-600 text-slate-400 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border border-slate-700 flex items-center justify-center gap-2">
                      {isExportingBook ? <Loader2 size={14} className="animate-spin" /> : <BookText size={14}/>}
                      {isExportingBook ? bookProgress : 'Synthesize Full PDF Book'}
                  </button>
              </div>
              <button onClick={() => handlePlayActiveLecture(currentSectionIndex === -1 ? 0 : currentSectionIndex)} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-900/40 transition-all active:scale-95 flex items-center justify-center gap-2">
                  {isPlaying ? <Pause size={18} fill="currentColor"/> : <PlayCircle size={18}/>} 
                  {isPlaying ? 'Pause Session' : 'Begin Activity'}
              </button>
          </div>
      </aside>

      <main className="flex-1 flex flex-col min-0 relative bg-slate-950">
          {activeLecture ? (
              <div className="h-full flex flex-col bg-slate-950 animate-fade-in pb-32">
                  <header className="h-16 border-b border-white/5 bg-slate-900/50 flex items-center justify-between px-8 backdrop-blur-xl shrink-0 z-20">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-600/10 rounded-lg"><BrainCircuit size={20} className="text-indigo-400" /></div>
                        <div>
                            <h2 className="text-sm font-black text-white uppercase tracking-widest">{activeLecture.topic}</h2>
                            <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-[0.2em]">Node 0{currentSubTopicIndex + 1} • Socratic Refraction</p>
                        </div>
                      </div>
                      <button onClick={() => stopAllAudio('Header Close')} className="p-2 hover:bg-red-600/20 text-slate-500 hover:text-red-400 rounded-xl transition-all" title="Exit View"><X/></button>
                  </header>
                  <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-10 scrollbar-hide">
                      <div className="max-w-3xl mx-auto space-y-16 pb-[30vh]">
                          {activeLecture.sections.map((section, idx) => {
                              const isCurrent = idx === currentSectionIndex;
                              const isTeacher = section.speaker === 'Teacher';
                              return (
                                  <div key={idx} ref={el => { sectionRefs.current[idx] = el; }} className={`flex flex-col ${isTeacher ? 'items-start' : 'items-end'} transition-all duration-1000 ${currentSectionIndex === -1 || isCurrent ? 'opacity-100 scale-100' : 'opacity-20 scale-95 blur-[1px]'}`}>
                                      <div className="flex items-center gap-2 mb-3 px-6"><span className={`text-[10px] font-black uppercase tracking-widest ${isTeacher ? 'text-indigo-400' : 'text-slate-400'}`}>{isTeacher ? activeLecture.professorName : activeLecture.studentName}</span>{isCurrent && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"></div>}</div>
                                      <div className={`max-w-[90%] px-10 py-8 rounded-[3rem] text-2xl leading-relaxed shadow-2xl relative transition-all duration-700 ${isCurrent ? 'ring-2 ring-indigo-500/50 bg-slate-900 border border-indigo-500/20' : 'bg-slate-900/40'} ${isTeacher ? 'text-slate-100 rounded-tl-sm' : 'text-indigo-50 rounded-tr-sm'}`}><p className="whitespace-pre-wrap font-medium">{section.text}</p></div>
                                  </div>
                              );
                          })}
                      </div>
                  </div>
                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 z-50">
                      <div className="bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-4 flex items-center justify-between shadow-2xl shadow-indigo-950/40">
                          <div className="flex items-center gap-4">
                              <button onClick={handlePrev} disabled={currentSubTopicIndex <= 0} className="p-3 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-all disabled:opacity-20"><SkipBack size={20}/></button>
                              <button onClick={() => handlePlayActiveLecture(currentSectionIndex === -1 ? 0 : currentSectionIndex)} className="w-14 h-14 bg-white text-slate-950 rounded-full flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all">{isBuffering ? <Loader2 size={24} className="animate-spin" /> : isPlaying ? <Pause size={24} fill="currentColor"/> : <Play size={24} fill="currentColor" className="ml-1"/>}</button>
                              <button onClick={handleNext} disabled={currentSubTopicIndex >= flatCurriculum.length - 1} className="p-3 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-all disabled:opacity-20"><SkipForward size={20}/></button>
                          </div>
                          <div className="flex-1 px-6 min-w-0 text-center">
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest truncate">{flatCurriculum[currentSubTopicIndex]?.title}</p>
                                <div className="flex items-center gap-2 mt-1.5"><div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 transition-all duration-700" style={{ width: `${((currentSectionIndex + 1) / (activeLecture?.sections.length || 1)) * 100}%` }}/></div><span className="text-[9px] font-mono text-slate-500">{currentSectionIndex + 1}/{activeLecture?.sections.length || 0}</span></div>
                          </div>
                          <div className="w-20 h-10 overflow-hidden rounded-full bg-slate-950/60 flex items-center justify-center shrink-0 ml-2"><Visualizer volume={isPlaying ? 0.6 : 0} isActive={isPlaying} color="#818cf8"/></div>
                      </div>
                  </div>
              </div>
          ) : isSyncingContent ? (
              <div className="h-full flex flex-col items-center justify-center gap-8 bg-slate-950">
                  <div className="relative">
                      <div className="w-24 h-24 border-4 border-indigo-500/10 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        {syncPhase === 'vault' ? <Archive size={32} className="text-emerald-400 animate-bounce" /> : <Zap size={32} className="text-indigo-400 animate-pulse" />}
                      </div>
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">
                        {syncPhase === 'registry' ? 'Paging Registry' : syncPhase === 'vault' ? 'Securing Vault' : 'Neural Synthesis'}
                    </h3>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                        {syncPhase === 'registry' ? 'Handshaking Knowledge Database...' : syncPhase === 'vault' ? 'Writing JSON context to Cloud Storage...' : 'Refracting linguistic logic gates...'}
                    </p>
                  </div>
              </div>
          ) : (
              <div className="h-full flex flex-col p-10 md:p-16 overflow-y-auto scrollbar-hide bg-slate-950">
                  <div className="max-w-4xl mx-auto w-full space-y-12">
                      <div className="space-y-6">
                          <div className="flex items-center gap-3"><span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] px-1">Knowledge Node</span><div className="h-px bg-slate-800 flex-1"></div></div>
                          <h1 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">{channel.title}</h1>
                          <p className="text-slate-400 text-xl font-medium leading-relaxed max-w-3xl">{channel.description}</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
                          <button onClick={() => handlePlayActiveLecture(0)} className="bg-indigo-900/10 border border-indigo-500/20 p-8 rounded-[2.5rem] space-y-4 text-left group hover:bg-indigo-900/20 transition-all shadow-xl">
                              <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest">Begin learning path</h4>
                              <p className="text-white font-bold text-xl line-clamp-1">{flatCurriculum[0]?.title || "Resume Activity"}</p>
                              <div className="text-[10px] font-black text-indigo-400 group-hover:text-white uppercase tracking-widest flex items-center gap-2 transition-colors">Launch Module <ChevronRight size={14}/></div>
                          </button>
                      </div>
                  </div>
              </div>
          )}
      </main>
    </div>
  );
};

export default PodcastDetail;
