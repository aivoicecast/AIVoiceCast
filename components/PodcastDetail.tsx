
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Channel, GeneratedLecture, Chapter, SubTopic, Attachment } from '../types';
import { ArrowLeft, BookOpen, FileText, Download, Loader2, ChevronDown, ChevronRight, ChevronLeft, Check, Printer, FileDown, Info, Sparkles, Book, CloudDownload, Music, Package, FileAudio, Zap, Radio, CheckCircle, ListTodo, Share2 } from 'lucide-react';
import { generateLectureScript } from '../services/lectureGenerator';
import { synthesizeSpeech } from '../services/tts';
import { OFFLINE_CHANNEL_ID, OFFLINE_CURRICULUM, OFFLINE_LECTURES } from '../utils/offlineContent';
import { SPOTLIGHT_DATA } from '../utils/spotlightContent';
import { cacheLectureScript, getCachedLectureScript } from '../utils/db';
import { publishChannelToFirestore } from '../services/firestoreService';
import { getDriveToken } from '../services/authService';
import { ensureCodeStudioFolder, uploadToDrive, getDriveFileSharingLink } from '../services/googleDriveService';
import { getGlobalAudioContext, audioBufferToWavBlob, concatAudioBuffers } from '../utils/audioUtils';
import { MarkdownView } from './MarkdownView';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { ShareModal } from './ShareModal';

interface PodcastDetailProps {
  channel: Channel;
  onBack: () => void;
  onStartLiveSession: (channel: Channel, context?: string, recordingEnabled?: boolean, bookingId?: string, videoEnabled?: boolean, cameraEnabled?: boolean, activeSegment?: { index: number, lectureId: string }) => void;
  language: 'en' | 'zh';
  onEditChannel?: () => void; 
  onViewComments?: () => void;
  currentUser: any; 
}

const UI_TEXT = {
  en: {
    back: "Back", curriculum: "Curriculum", selectTopic: "Select a lesson to begin reading",
    generating: "Preparing Material...", genDesc: "Our AI is drafting the lecture script.",
    lectureTitle: "Lecture Script", downloadPdf: "Download PDF", downloadBook: "Synthesize Book",
    downloadAudioBook: "Synthesize + Audio", downloadExisting: "Open in Drive",
    exporting: "Drafting PDF...", preparingBook: "Assembling Course Book...",
    typesetting: "Typesetting Pages...", syncing: "Saving to Drive...",
    toc: "Table of Contents", prev: "Prev Lesson", next: "Next Lesson",
    noLesson: "No Lesson Selected", chooseChapter: "Choose a chapter and lesson from the menu.",
    synthesizingAudio: "Synthesizing Audio...", reading: "Reading Material", homework: "Homework & Exercises"
  },
  zh: {
    back: "返回", curriculum: "课程大纲", selectTopic: "选择一个课程开始阅读",
    generating: "正在准备材料...", genDesc: "AI 正在编写讲座脚本。",
    lectureTitle: "讲座文稿", downloadPdf: "下载 PDF", downloadBook: "全书合成",
    downloadAudioBook: "合成 + 音频", downloadExisting: "在 Drive 中打开",
    exporting: "正在生成 PDF...", preparingBook: "正在汇编课程书籍...",
    typesetting: "正在排版页面...", syncing: "正在同步到 Drive...",
    toc: "目录", prev: "上一节", next: "下一节",
    noLesson: "未选择课程", chooseChapter: "请从菜单中选择章节和课程。",
    synthesizingAudio: "正在合成音频...", reading: "延伸阅读", homework: "课后作业"
  }
};

export const PodcastDetail: React.FC<PodcastDetailProps> = ({ channel, onBack, language, currentUser, onStartLiveSession }) => {
  const t = UI_TEXT[language];
  const [activeLecture, setActiveLecture] = useState<GeneratedLecture | null>(null);
  const [isLoadingLecture, setIsLoadingLecture] = useState(false);
  const [activeSubTopicId, setActiveSubTopicId] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  const [chapters, setChapters] = useState<Chapter[]>(() => {
    if (channel.chapters && channel.chapters.length > 0) return channel.chapters;
    if (channel.id === OFFLINE_CHANNEL_ID) return OFFLINE_CURRICULUM;
    if (SPOTLIGHT_DATA[channel.id]) return SPOTLIGHT_DATA[channel.id].curriculum;
    return [];
  });
  
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);

  const handleTopicClick = async (topicTitle: string, subTopicId?: string) => {
    setActiveSubTopicId(subTopicId || null);
    setActiveLecture(null);
    setIsLoadingLecture(true);
    try {
        const cacheKey = `lecture_${channel.id}_${subTopicId}_${language}`;
        const cached = await getCachedLectureScript(cacheKey);
        if (cached) { setActiveLecture(cached); return; }
        const script = await generateLectureScript(topicTitle, channel.description, language);
        if (script) { setActiveLecture(script); await cacheLectureScript(cacheKey, script); }
    } finally { setIsLoadingLecture(false); }
  };

  const handleShareLecture = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!activeSubTopicId) return;
      const url = `${window.location.origin}?view=podcast_detail&channelId=${channel.id}&lectureId=${activeSubTopicId}`;
      setShareUrl(url);
      setShowShareModal(true);
  };

  return (
    <div className="h-full bg-slate-950 text-slate-100 flex flex-col relative overflow-y-auto pb-24">
      <div className="relative h-48 md:h-64 w-full shrink-0">
        <div className="absolute inset-0">
            <img src={channel.imageUrl} className="w-full h-full object-cover opacity-40"/>
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
        </div>
        <div className="absolute top-4 left-4 z-20 flex items-center gap-3">
            <button onClick={onBack} className="flex items-center space-x-2 px-4 py-2 bg-black/40 backdrop-blur-md rounded-full hover:bg-white/10 transition-colors border border-white/10 text-sm font-medium"><ArrowLeft size={16} /><span>{t.back}</span></button>
        </div>
      </div>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-800 bg-indigo-900/10 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2"><BookOpen size={16} className="text-indigo-400" />{t.curriculum}</h3>
                </div>
                <div className="divide-y divide-slate-800">
                    {chapters.map((ch) => (
                        <div key={ch.id}>
                            <button onClick={() => setExpandedChapterId(expandedChapterId === ch.id ? null : ch.id)} className="w-full flex items-center justify-between p-4 hover:bg-slate-800 transition-colors text-left font-semibold text-sm text-slate-200">{ch.title}{expandedChapterId === ch.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
                            {expandedChapterId === ch.id && (<div className="bg-slate-950/50 py-1">{ch.subTopics.map((sub) => (<button key={sub.id} onClick={() => handleTopicClick(sub.title, sub.id)} className={`w-full flex items-start space-x-3 px-6 py-3 text-left transition-colors ${activeSubTopicId === sub.id ? 'bg-indigo-900/30 border-l-4 border-indigo-500' : 'hover:bg-slate-800'}`}><span className={`text-sm ${activeSubTopicId === sub.id ? 'text-indigo-200 font-bold' : 'text-slate-400'}`}>{sub.title}</span></button>))}</div>)}
                        </div>
                    ))}
                </div>
            </div>
        </div>
        <div className="col-span-12 lg:col-span-8">
          {isLoadingLecture ? (<div className="h-64 flex flex-col items-center justify-center p-12 text-center bg-slate-900/50 rounded-2xl animate-pulse"><Loader2 size={40} className="text-indigo-500 animate-spin mb-4" /><h3 className="text-lg font-bold text-white">{t.generating}</h3></div>) : activeLecture ? (
            <div className="space-y-6 animate-fade-in">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div><h2 className="text-xl font-bold text-white">{activeLecture.topic}</h2><p className="text-xs text-slate-500 uppercase font-bold tracking-widest mt-1">{t.lectureTitle}</p></div>
                    <button onClick={handleShareLecture} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs flex items-center gap-2 transition-all shadow-lg"><Share2 size={14}/> Share Lecture URI</button>
                </div>
                <div className="bg-white rounded-2xl p-8 md:p-12 shadow-2xl text-slate-900 space-y-8">
                    <div className="border-b border-slate-200 pb-6 mb-8"><h1 className="text-3xl font-black text-slate-900 mb-2 uppercase tracking-tighter italic">{activeLecture.topic}</h1></div>
                    <div className="space-y-10">{activeLecture.sections.map((section, idx) => (<div key={idx} className="flex gap-6"><div className="shrink-0 w-12 flex flex-col items-center"><div className={`w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-black border-2 ${section.speaker === 'Teacher' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>{section.speaker === 'Teacher' ? 'PRO' : 'STU'}</div><div className="w-0.5 flex-1 bg-slate-100 mt-2"></div></div><div className="flex-1 pb-4"><p className="text-[10px] font-black text-slate-400 uppercase mb-2">{section.speaker === 'Teacher' ? activeLecture.professorName : activeLecture.studentName}</p><p className="text-lg leading-relaxed font-serif text-slate-800 whitespace-pre-wrap">{section.text}</p></div></div>))}</div>
                </div>
            </div>
          ) : (<div className="h-64 flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-800 rounded-2xl bg-slate-900/30"><Info size={32} className="mb-2 opacity-20" /><h3 className="text-lg font-bold text-slate-400">{t.selectTopic}</h3></div>)}
        </div>
      </main>

      {showShareModal && (
          <ShareModal isOpen={true} onClose={() => setShowShareModal(false)} link={shareUrl} title={activeLecture?.topic || 'Lecture'} onShare={async () => {}} currentUserUid={currentUser?.uid}/>
      )}
    </div>
  );
};
