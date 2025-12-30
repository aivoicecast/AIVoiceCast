
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Channel, GeneratedLecture, Chapter, SubTopic, Attachment } from '../types';
import { ArrowLeft, BookOpen, FileText, Download, Loader2, ChevronDown, ChevronRight, ChevronLeft, Check, Printer, FileDown, Info, Sparkles, Book, CloudDownload, Music, Package, FileAudio, Zap, Radio } from 'lucide-react';
import { generateLectureScript } from '../services/lectureGenerator';
import { synthesizeSpeech } from '../services/tts';
import { OFFLINE_CHANNEL_ID, OFFLINE_CURRICULUM, OFFLINE_LECTURES } from '../utils/offlineContent';
import { SPOTLIGHT_DATA } from '../utils/spotlightContent';
import { cacheLectureScript, getCachedLectureScript } from '../utils/db';
import { uploadFileToStorage, publishChannelToFirestore } from '../services/firestoreService';
import { getGlobalAudioContext, audioBufferToWavBlob, concatAudioBuffers } from '../utils/audioUtils';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';

interface PodcastDetailProps {
  channel: Channel;
  onBack: () => void;
  onStartLiveSession: (context?: string, lectureId?: string, recordingEnabled?: boolean, videoEnabled?: boolean, activeSegment?: { index: number, lectureId: string }, cameraEnabled?: boolean) => void;
  language: 'en' | 'zh';
  onEditChannel?: () => void; 
  onViewComments?: () => void;
  currentUser: any; 
}

const UI_TEXT = {
  en: {
    back: "Back",
    curriculum: "Curriculum",
    selectTopic: "Select a lesson to begin reading",
    generating: "Preparing Material...",
    genDesc: "Our AI is drafting the lecture script.",
    lectureTitle: "Lecture Script",
    downloadPdf: "Download PDF",
    downloadBook: "Synthesize Book",
    downloadAudioBook: "Synthesize + Audio",
    downloadExisting: "Download Cloud Copy",
    exporting: "Drafting PDF...",
    preparingBook: "Assembling Course Book...",
    typesetting: "Typesetting Pages...",
    syncing: "Saving to Cloud...",
    toc: "Table of Contents",
    prev: "Prev Lesson",
    next: "Next Lesson",
    noLesson: "No Lesson Selected",
    chooseChapter: "Choose a chapter and lesson from the menu.",
    synthesizingAudio: "Synthesizing Audio..."
  },
  zh: {
    back: "返回",
    curriculum: "课程大纲",
    selectTopic: "选择一个课程开始阅读",
    generating: "正在准备材料...",
    genDesc: "AI 正在编写讲座脚本。",
    lectureTitle: "讲座文稿",
    downloadPdf: "下载 PDF",
    downloadBook: "全书合成",
    downloadAudioBook: "合成 + 音频",
    downloadExisting: "下载云端备份",
    exporting: "正在生成 PDF...",
    preparingBook: "正在汇编课程书籍...",
    typesetting: "正在排版页面...",
    syncing: "正在同步到云端...",
    toc: "目录",
    prev: "上一节",
    next: "下一节",
    noLesson: "未选择课程",
    chooseChapter: "请从菜单中选择章节和课程。",
    synthesizingAudio: "正在合成音频..."
  }
};

export const PodcastDetail: React.FC<PodcastDetailProps> = ({ channel, onBack, language, currentUser }) => {
  const t = UI_TEXT[language];
  const [activeLecture, setActiveLecture] = useState<GeneratedLecture | null>(null);
  const [isLoadingLecture, setIsLoadingLecture] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingBook, setIsExportingBook] = useState(false);
  const [isExportingAudioPackage, setIsExportingAudioPackage] = useState(false);
  const [bookLectures, setBookLectures] = useState<GeneratedLecture[]>([]);
  const [exportProgress, setExportProgress] = useState('');
  
  // Real-time channel state to reflect new bookUrl
  const [currentChannel, setCurrentChannel] = useState<Channel>(channel);

  // TTS Model State
  const [provider, setProvider] = useState<'system' | 'gemini' | 'openai'>(() => {
    const hasOpenAI = !!(localStorage.getItem('openai_api_key'));
    if (hasOpenAI) return 'openai';
    return 'gemini';
  });

  const [chapters, setChapters] = useState<Chapter[]>(() => {
    if (channel.chapters && channel.chapters.length > 0) return channel.chapters;
    if (channel.id === OFFLINE_CHANNEL_ID) return OFFLINE_CURRICULUM;
    if (SPOTLIGHT_DATA[channel.id]) return SPOTLIGHT_DATA[channel.id].curriculum;
    return [];
  });
  
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);
  const [activeSubTopicId, setActiveSubTopicId] = useState<string | null>(null);
  
  const lectureContentRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  const flatCurriculum = useMemo(() => {
    return chapters.flatMap((ch) => 
        (ch.subTopics || []).map((sub) => ({
            id: sub.id,
            title: sub.title,
            chapterTitle: ch.title
        }))
    );
  }, [chapters]);

  const currentLectureIndex = useMemo(() => {
    return flatCurriculum.findIndex(t => t.id === activeSubTopicId);
  }, [flatCurriculum, activeSubTopicId]);

  useEffect(() => {
      mountedRef.current = true;
      setCurrentChannel(channel);
      return () => { mountedRef.current = false; };
  }, [channel]);

  const toggleTtsMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    let newMode: 'system' | 'gemini' | 'openai' = 'system';
    if (provider === 'gemini') newMode = 'openai';
    else if (provider === 'openai') newMode = 'system';
    else newMode = 'gemini';
    setProvider(newMode);
  };

  const handleTopicClick = async (topicTitle: string, subTopicId?: string) => {
    setActiveSubTopicId(subTopicId || null);
    setActiveLecture(null);
    setIsLoadingLecture(true);
    
    try {
        if (OFFLINE_LECTURES[topicTitle]) { 
            setActiveLecture(OFFLINE_LECTURES[topicTitle]); 
            return; 
        }
        const cacheKey = `lecture_${channel.id}_${subTopicId}_${language}`;
        const cached = await getCachedLectureScript(cacheKey);
        if (cached) { 
            setActiveLecture(cached); 
            return; 
        }
        
        const script = await generateLectureScript(topicTitle, channel.description, language);
        if (script && mountedRef.current) {
          setActiveLecture(script);
          await cacheLectureScript(cacheKey, script);
        }
    } catch (e: any) { 
        console.error(e); 
    } finally { 
        if (mountedRef.current) setIsLoadingLecture(false); 
    }
  };

  const handleExportPDF = async () => {
      if (!activeLecture || !lectureContentRef.current) return;
      
      setIsExporting(true);
      try {
          const element = lectureContentRef.current;
          const canvas = await html2canvas(element, {
              scale: 2,
              useCORS: true,
              backgroundColor: '#ffffff'
          });
          
          const imgData = canvas.toDataURL('image/jpeg', 1.0);
          const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' });
          const imgProps = pdf.getImageProperties(imgData);
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
          
          pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
          pdf.save(`${activeLecture.topic.replace(/\s+/g, '_')}.pdf`);
      } catch (e) {
          console.error("PDF Export failed", e);
          alert("Failed to generate PDF.");
      } finally {
          setIsExporting(false);
      }
  };

  const handleDownloadFullBook = async (withAudio = false) => {
      if (flatCurriculum.length === 0) return;
      
      const setLoader = withAudio ? setIsExportingAudioPackage : setIsExportingBook;
      setLoader(true);
      setBookLectures([]);
      setExportProgress(t.preparingBook);

      try {
          const allLectures: GeneratedLecture[] = [];
          const zip = withAudio ? new JSZip() : null;
          const audioCtx = withAudio ? getGlobalAudioContext() : null;
          
          for (let i = 0; i < flatCurriculum.length; i++) {
              const item = flatCurriculum[i];
              setExportProgress(`${withAudio ? t.synthesizingAudio : t.preparingBook} (${i + 1}/${flatCurriculum.length})`);
              
              let lecture: GeneratedLecture | null = null;
              if (OFFLINE_LECTURES[item.title]) {
                  lecture = OFFLINE_LECTURES[item.title];
              } else if (SPOTLIGHT_DATA[channel.id]?.lectures?.[item.title]) {
                  lecture = SPOTLIGHT_DATA[channel.id].lectures[item.title];
              } else {
                  const cacheKey = `lecture_${channel.id}_${item.id}_${language}`;
                  lecture = await getCachedLectureScript(cacheKey);
                  if (!lecture) {
                      lecture = await generateLectureScript(item.title, channel.description, language);
                      if (lecture) await cacheLectureScript(cacheKey, lecture);
                  }
              }

              if (lecture) {
                  allLectures.push(lecture);
                  
                  // Generate Audio for this lecture if requested
                  if (withAudio && zip && audioCtx) {
                      const audioBuffers: AudioBuffer[] = [];
                      for (const section of lecture.sections) {
                          const res = await synthesizeSpeech(section.text, section.speaker === 'Teacher' ? channel.voiceName : 'Zephyr', audioCtx, provider);
                          if (res.buffer) {
                             audioBuffers.push(res.buffer);
                          } else if (provider === 'system') {
                             // System voice doesn't return a buffer for file export unfortunately
                             console.warn("System voice selected for package export. Only cloud providers return file buffers.");
                          }
                      }
                      
                      const fullAudioBuffer = concatAudioBuffers(audioBuffers, audioCtx);
                      if (fullAudioBuffer) {
                          const wavBlob = audioBufferToWavBlob(fullAudioBuffer);
                          const safeTopicName = lecture.topic.replace(/[^a-z0-9]/gi, '_');
                          zip.file(`audio/Lesson_${i + 1}_${safeTopicName}.wav`, wavBlob);
                      }
                  }
              }
          }

          setBookLectures(allLectures);
          await new Promise(r => setTimeout(r, 2000));
          setExportProgress(t.typesetting);

          const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' });
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();

          const addPageToPdf = async (elementId: string) => {
              const el = document.getElementById(elementId);
              if (!el) return;
              const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
              const imgData = canvas.toDataURL('image/jpeg', 0.9);
              pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
          };

          await addPageToPdf('book-lecture-cover');
          pdf.addPage();
          await addPageToPdf('book-lecture-toc');
          pdf.addPage();

          for (let i = 0; i < allLectures.length; i++) {
              if (i > 0) pdf.addPage();
              await addPageToPdf(`book-lecture-${i}`);
          }

          const safeTitle = channel.title.replace(/\s+/g, '_');
          const pdfBlob = pdf.output('blob');

          if (withAudio && zip) {
              zip.file(`${safeTitle}_AIVoiceCast_Book.pdf`, pdfBlob);
              setExportProgress("Finalizing Package...");
              const zipContent = await zip.generateAsync({ type: "blob" });
              const zipUrl = URL.createObjectURL(zipContent);
              const a = document.createElement('a'); a.href = zipUrl; a.download = `${safeTitle}_Media_Package.zip`; a.click();
              URL.revokeObjectURL(zipUrl);
          } else {
              pdf.save(`${safeTitle}_AIVoiceCast_Book.pdf`);
          }

          if (currentUser && !withAudio) {
              setExportProgress(t.syncing);
              const storagePath = `books/${channel.id}/${language}_book.pdf`;
              const downloadUrl = await uploadFileToStorage(storagePath, pdfBlob, { contentType: 'application/pdf' });
              const updatedChannel = { ...currentChannel, bookUrl: downloadUrl, bookGeneratedAt: Date.now() };
              await publishChannelToFirestore(updatedChannel);
              setCurrentChannel(updatedChannel);
          }
      } catch (e) {
          console.error("Export failed", e);
          alert("Failed to assemble the full course book package.");
      } finally {
          setLoader(false);
          setBookLectures([]);
          setExportProgress('');
      }
  };

  const handleDownloadCloudCopy = () => {
      if (currentChannel.bookUrl) {
          window.open(currentChannel.bookUrl, '_blank');
      }
  };

  const handlePrevLesson = () => { 
    if (currentLectureIndex > 0) { 
      const prev = flatCurriculum[currentLectureIndex - 1]; 
      handleTopicClick(prev.title, prev.id); 
    } 
  };

  const handleNextLesson = () => { 
    if (currentLectureIndex !== -1 && currentLectureIndex < flatCurriculum.length - 1) { 
      const next = flatCurriculum[currentLectureIndex + 1]; 
      handleTopicClick(next.title, next.id); 
    } 
  };

  return (
    <div className="h-full bg-slate-950 text-slate-100 flex flex-col relative overflow-y-auto pb-24">
      <div className="relative h-48 md:h-64 w-full shrink-0">
        <div className="absolute inset-0">
            <img src={channel.imageUrl} alt={channel.title} className="w-full h-full object-cover opacity-40"/>
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
        </div>
        <div className="absolute top-4 left-4 z-20 flex items-center gap-3">
            <button onClick={onBack} className="flex items-center space-x-2 px-4 py-2 bg-black/40 backdrop-blur-md rounded-full hover:bg-white/10 transition-colors border border-white/10 text-sm font-medium">
                <ArrowLeft size={16} />
                <span>{t.back}</span>
            </button>
        </div>

        {/* Floating TTS Selector & Status - Similar to Feed Design */}
        <div className="absolute top-4 right-4 z-30 flex flex-col items-end gap-2">
            <button 
                onClick={toggleTtsMode} 
                className={`backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border text-[10px] font-bold shadow-lg transition-all active:scale-95 ${provider === 'openai' ? 'bg-emerald-900/60 border-emerald-500/50 text-emerald-300' : provider === 'gemini' ? 'bg-indigo-900/60 border-indigo-500/50 text-indigo-300' : 'bg-slate-800/60 border-slate-600 text-slate-300'}`}
                title="Change TTS Engine"
            >
                {provider === 'openai' ? <Sparkles size={12} fill="currentColor"/> : provider === 'gemini' ? <Zap size={12} fill="currentColor"/> : <Radio size={12} />}
                <span>{provider === 'openai' ? 'OpenAI' : provider === 'gemini' ? 'Gemini' : 'System'}</span>
            </button>
            
            {(exportProgress) && (
                <div className="backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border shadow-lg bg-black/60 border-white/10 animate-fade-in">
                    <Loader2 size={12} className="animate-spin text-indigo-400" />
                    <span className="text-[9px] font-bold text-white uppercase tracking-wider">{exportProgress}</span>
                </div>
            )}
        </div>

        <div className="absolute bottom-0 left-0 w-full p-6 md:p-8 max-w-7xl mx-auto">
           <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{channel.title}</h1>
           <p className="text-sm md:text-base text-slate-300 max-w-2xl line-clamp-2">{channel.description}</p>
        </div>
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-800 bg-indigo-900/10 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2 whitespace-nowrap">
                        <BookOpen size={16} className="text-indigo-400" />
                        {t.curriculum}
                    </h3>
                    
                    <div className="flex gap-1 overflow-x-auto no-scrollbar">
                        {currentChannel.bookUrl && (
                            <button 
                                onClick={handleDownloadCloudCopy}
                                className="text-[10px] font-bold text-emerald-100 hover:text-white flex items-center gap-1.5 transition-all px-2.5 py-1.5 bg-emerald-600 rounded-lg shadow-lg shadow-emerald-500/20 active:scale-95"
                                title="Download the existing cloud backup"
                            >
                                <CloudDownload size={12}/>
                                <span className="hidden sm:inline">Cloud</span>
                            </button>
                        )}
                        
                        <button 
                            onClick={() => handleDownloadFullBook(false)}
                            disabled={isExportingBook || isExportingAudioPackage}
                            className={`text-[10px] font-bold text-indigo-100 hover:text-white flex items-center gap-1.5 transition-all px-2.5 py-1.5 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-500/20 active:scale-95 ${isExportingBook ? 'opacity-50' : ''}`}
                            title="Synthesize Book (PDF)"
                        >
                            {isExportingBook ? <Loader2 size={12} className="animate-spin"/> : <FileText size={12}/>}
                            <span>Book</span>
                        </button>

                        <button 
                            onClick={() => handleDownloadFullBook(true)}
                            disabled={isExportingBook || isExportingAudioPackage}
                            className={`text-[10px] font-bold text-pink-100 hover:text-white flex items-center gap-1.5 transition-all px-2.5 py-1.5 bg-pink-600 rounded-lg shadow-lg shadow-pink-500/20 active:scale-95 ${isExportingAudioPackage ? 'opacity-50' : ''}`}
                            title="Synthesize Book + Audio (ZIP)"
                        >
                            {isExportingAudioPackage ? <Loader2 size={12} className="animate-spin"/> : <Package size={12}/>}
                            <span>Book+Audio</span>
                        </button>
                    </div>
                </div>
                <div className="divide-y divide-slate-800">
                    {chapters.map((ch) => (
                        <div key={ch.id}>
                            <button 
                                onClick={() => setExpandedChapterId(expandedChapterId === ch.id ? null : ch.id)} 
                                className="w-full flex items-center justify-between p-4 hover:bg-slate-800 transition-colors text-left"
                            >
                                <span className="font-semibold text-sm text-slate-200">{ch.title}</span>
                                {expandedChapterId === ch.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                            {expandedChapterId === ch.id && (
                                <div className="bg-slate-950/50 py-1">
                                    {ch.subTopics.map((sub) => (
                                        <button 
                                            key={sub.id} 
                                            onClick={() => handleTopicClick(sub.title, sub.id)} 
                                            className={`w-full flex items-start space-x-3 px-6 py-3 text-left transition-colors ${activeSubTopicId === sub.id ? 'bg-indigo-900/30 border-l-4 border-indigo-500' : 'hover:bg-slate-800'}`}
                                        >
                                            <span className={`text-sm ${activeSubTopicId === sub.id ? 'text-indigo-200 font-bold' : 'text-slate-400'}`}>
                                                {sub.title}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>

        <div className="col-span-12 lg:col-span-8">
          {isLoadingLecture ? (
             <div className="h-64 flex flex-col items-center justify-center p-12 text-center bg-slate-900/50 rounded-2xl border border-slate-800 animate-pulse">
                <Loader2 size={40} className="text-indigo-500 animate-spin mb-4" />
                <h3 className="text-lg font-bold text-white">{t.generating}</h3>
                <p className="text-slate-400 text-sm mt-1">{t.genDesc}</p>
             </div>
          ) : activeLecture ? (
            <div className="space-y-6 animate-fade-in">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-white">{activeLecture.topic}</h2>
                        <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mt-1">{t.lectureTitle}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handleExportPDF} 
                            disabled={isExporting}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800 text-white rounded-lg text-sm font-bold border border-slate-700 transition-all"
                        >
                            {isExporting ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
                            <span>{isExporting ? t.exporting : t.downloadPdf}</span>
                        </button>
                    </div>
                </div>

                <div ref={lectureContentRef} className="bg-white rounded-2xl p-8 md:p-12 shadow-2xl text-slate-900 space-y-8">
                    <div className="border-b border-slate-200 pb-6 mb-8">
                        <h1 className="text-3xl font-black text-slate-900 mb-2">{activeLecture.topic}</h1>
                        <div className="flex gap-4 text-xs font-bold text-slate-500 uppercase tracking-widest">
                            <span>Speaker A: {activeLecture.professorName}</span>
                            <span>•</span>
                            <span>Speaker B: {activeLecture.studentName}</span>
                        </div>
                    </div>
                    <div className="space-y-10">
                        {activeLecture.sections.map((section, idx) => (
                            <div key={idx} className="flex gap-6">
                                <div className="shrink-0 w-12 flex flex-col items-center">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-black border-2 ${section.speaker === 'Teacher' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                                        {section.speaker === 'Teacher' ? 'PRO' : 'STU'}
                                    </div>
                                    <div className="w-0.5 flex-1 bg-slate-100 mt-2"></div>
                                </div>
                                <div className="flex-1 pb-4">
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2">
                                        {section.speaker === 'Teacher' ? activeLecture.professorName : activeLecture.studentName}
                                    </p>
                                    <p className="text-lg leading-relaxed font-serif text-slate-800">{section.text}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="pt-12 border-t border-slate-100 flex justify-between items-center opacity-50">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Generated by AIVoiceCast Publishing</span>
                        <span className="text-[10px] font-bold text-slate-400">{new Date().toLocaleDateString()}</span>
                    </div>
                </div>

                <div className="flex justify-between items-center py-4 px-2">
                    <button onClick={handlePrevLesson} disabled={currentLectureIndex <= 0} className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white disabled:opacity-20 transition-colors">
                        <ChevronLeft size={20} /> {t.prev}
                    </button>
                    <button onClick={handleNextLesson} disabled={currentLectureIndex === -1 || currentLectureIndex >= flatCurriculum.length - 1} className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white disabled:opacity-20 transition-colors">
                        {t.next} <ChevronRight size={20} />
                    </button>
                </div>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-800 rounded-2xl bg-slate-900/30">
                <Info size={32} className="mb-2 opacity-20" />
                <h3 className="text-lg font-bold text-slate-400">{t.selectTopic}</h3>
                <p className="text-xs text-slate-600 mt-1">{t.chooseChapter}</p>
            </div>
          )}
        </div>
      </main>

      {/* Off-screenhidden elements for PDF generation */}
      {(isExportingBook || isExportingAudioPackage) && bookLectures.length > 0 && (
          <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '595px' }}>
              <div className="bg-slate-950 relative overflow-hidden flex flex-col items-center justify-center text-center" id="book-lecture-cover" style={{ width: '595px', height: '842px' }}>
                  <div className="absolute inset-0">
                      <img src={channel.imageUrl} className="w-full h-full object-cover opacity-20 blur-sm" alt=""/>
                      <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/80 via-slate-950/90 to-slate-950"></div>
                  </div>
                  
                  <div className="relative z-10 p-12 flex flex-col items-center justify-between h-full w-full">
                      <div className="mt-12 flex flex-col items-center">
                          <div className="w-24 h-24 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl mb-8 transform rotate-3">
                              <Sparkles size={48} className="text-white" fill="white"/>
                          </div>
                          <span className="text-indigo-400 font-bold tracking-[0.3em] text-xs uppercase mb-4">A Generative Publication</span>
                          <h1 className="text-5xl font-black text-white leading-tight max-w-md">{channel.title}</h1>
                          <div className="w-20 h-1.5 bg-indigo-500 mt-8 rounded-full"></div>
                      </div>

                      <div className="space-y-4">
                          <p className="text-xl text-slate-300 font-medium">Synthetic Curriculum & Technical Lectures</p>
                          <p className="text-sm text-slate-500 uppercase tracking-widest font-bold">Curated by {channel.author}</p>
                      </div>

                      <div className="mb-12 pt-12 border-t border-white/10 w-full flex justify-between items-center px-12">
                          <div className="text-left">
                              <p className="text-[10px] text-slate-500 font-bold uppercase">Version</p>
                              <p className="text-xs text-white font-mono">v3.85.1-AUTO</p>
                          </div>
                          <div className="text-right">
                              <p className="text-[10px] text-slate-500 font-bold uppercase">Date</p>
                              <p className="text-xs text-white font-mono">{new Date().getFullYear()}</p>
                          </div>
                      </div>
                  </div>
              </div>

              <div className="bg-white p-16 flex flex-col" id="book-lecture-toc" style={{ width: '595px', height: '842px' }}>
                  <h2 className="text-3xl font-black text-slate-900 border-b-4 border-indigo-600 pb-4 mb-12 uppercase tracking-tight">{t.toc}</h2>
                  <div className="space-y-6 overflow-hidden">
                      {chapters.map((ch, idx) => (
                          <div key={ch.id} className="space-y-2">
                              <div className="flex items-baseline gap-2">
                                  <span className="text-indigo-600 font-black text-sm">CH {idx + 1}</span>
                                  <h3 className="text-lg font-bold text-slate-800">{ch.title}</h3>
                                  <div className="flex-1 border-b border-dotted border-slate-300 mb-1"></div>
                              </div>
                              <div className="pl-10 space-y-1">
                                  {ch.subTopics.map((sub, sIdx) => (
                                      <div key={sub.id} className="flex justify-between items-center text-sm text-slate-500">
                                          <span>{sub.title}</span>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      ))}
                  </div>
                  <div className="mt-auto pt-12 text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">© AIVoiceCast Publishing • Knowledge Operating System</p>
                  </div>
              </div>

              {bookLectures.map((lec, lIdx) => (
                  <div key={lIdx} id={`book-lecture-${lIdx}`} className="bg-white p-16 flex flex-col" style={{ width: '595px', height: '842px' }}>
                      <div className="flex justify-between items-start mb-8 border-b-2 border-slate-100 pb-4">
                          <div className="flex-1">
                              <span className="text-indigo-600 text-xs font-black uppercase tracking-wider">Lesson {lIdx + 1}</span>
                              <h2 className="text-2xl font-black text-slate-900 mt-1">{lec.topic}</h2>
                          </div>
                          <div className="text-right">
                              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Transcript Archive</p>
                              <p className="text-[10px] font-mono text-slate-500">#{lIdx + 101}</p>
                          </div>
                      </div>
                      
                      <div className="space-y-10 flex-1 overflow-hidden">
                          {lec.sections.map((sec, sIdx) => (
                              <div key={sIdx} className="flex gap-6">
                                  <div className="shrink-0 w-16 text-right">
                                      <p className="text-[9px] font-black text-indigo-600 uppercase leading-none">{sec.speaker === 'Teacher' ? lec.professorName : lec.studentName}</p>
                                      <p className="text-[8px] text-slate-400 uppercase mt-1 tracking-tighter">{sec.speaker === 'Teacher' ? 'Expert' : 'Learner'}</p>
                                  </div>
                                  <div className="flex-1">
                                      <p className="text-sm font-serif text-slate-800 leading-relaxed text-justify">{sec.text}</p>
                                  </div>
                              </div>
                          ))}
                      </div>

                      <div className="mt-12 pt-8 border-t border-slate-100 flex justify-between items-center">
                          <span className="text-[8px] font-bold text-slate-400 uppercase">Page {lIdx + 3}</span>
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{channel.title}</span>
                          
                          {/* Audio Indicator if package generated with audio */}
                          {isExportingAudioPackage && (
                              <div className="flex items-center gap-1 text-[8px] font-bold text-indigo-600">
                                  <FileAudio size={8}/> Audio Embedded in Package
                              </div>
                          )}
                      </div>
                  </div>
              ))}
          </div>
      )}
    </div>
  );
};
