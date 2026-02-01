import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, Video, Play, FileText, Loader2, Sparkles, 
  Target, ShieldCheck, Timer, Award, Activity, Search,
  Plus, History, ChevronRight, Zap, Bot, Microscope,
  MessageSquare, AlertCircle, CheckCircle, GraduationCap,
  Briefcase, Trash2, Layout, BookOpen, Share2,
  Calendar, Code, RefreshCw, X
} from 'lucide-react';
import { MockInterviewRecording, UserProfile, Channel } from '../types';
import { 
  getUserInterviews, 
  saveInterviewRecording, 
  deleteInterview, 
  deductCoins, 
  AI_COSTS 
} from '../services/firestoreService';
import { auth } from '../services/firebaseConfig';
import { GoogleGenAI } from '@google/genai';
import { generateSecureId } from '../utils/idUtils';
import { MarkdownView } from './MarkdownView';

interface MockInterviewProps {
  onBack: () => void;
  userProfile: UserProfile | null;
  onStartLiveSession: (
    channel: Channel, 
    context?: string, 
    recordingEnabled?: boolean, 
    bookingId?: string, 
    recordScreen?: boolean, 
    recordCamera?: boolean, 
    activeSegment?: any, 
    recordingDuration?: number, 
    interactionEnabled?: boolean
  ) => void;
  isProMember: boolean;
}

export const MockInterview: React.FC<MockInterviewProps> = ({ 
  onBack, userProfile, onStartLiveSession, isProMember 
}) => {
  const [view, setView] = useState<'setup' | 'history' | 'report'>('setup');
  const [loading, setLoading] = useState(false);
  const [recordings, setRecordings] = useState<MockInterviewRecording[]>([]);
  const [activeReport, setActiveReport] = useState<MockInterviewRecording | null>(null);

  // Setup Form State
  const [targetRole, setTargetRole] = useState('Senior Software Engineer');
  const [jobDescription, setJobDescription] = useState('');
  const [mode, setMode] = useState<'coding' | 'system_design' | 'behavioral'>('coding');
  const [difficulty, setDifficulty] = useState<'standard' | 'staff' | 'principal'>('standard');

  const currentUser = auth?.currentUser;

  useEffect(() => {
    if (currentUser) {
      loadHistory();
    }
  }, [currentUser]);

  const loadHistory = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const data = await getUserInterviews(currentUser.uid);
      setRecordings(data.sort((a, b) => b.timestamp - a.timestamp));
    } catch (e) {
      console.error("Failed to load interview history", e);
    } finally {
      setLoading(false);
    }
  };

  const handleStartInterview = () => {
    if (!targetRole.trim() || !jobDescription.trim()) {
      alert("Please provide the target role and job description to calibrate the interviewer.");
      return;
    }

    const modeLabels = {
        coding: 'Algorithms and Data Structures',
        system_design: 'High-Level System Architecture',
        behavioral: 'Leadership and Cultural Alignment'
    };

    const instruction = `
      You are a world-class Socratic Interrogator conducting a ${difficulty.toUpperCase()} level technical interview for a ${targetRole} position.
      
      TARGET ROLE CONTEXT:
      ${jobDescription}

      INTERVIEW MODE: ${modeLabels[mode]}

      CRITICAL BEHAVIORS:
      1. Priority: Logical Purity. If the candidate suggests an sub-optimal solution, identify the bottleneck and demand a Staff-level architectural explanation.
      2. No Flattery: You are not an assistant. You are a Peer Evaluator. Maintain technical friction.
      3. Socratic Method: Ask "Why" and "How" instead of giving answers.
      4. Workspace Visibility: You can see the candidate's code. If you see a bug, hint at the logical inconsistency rather than pointing at the line.
      
      Start by introducing yourself as the Socratic Interrogator and state the focus of this ${difficulty} level evaluation.
    `;

    const interviewChannel: Channel = {
      id: 'custom-interview-' + Date.now(),
      title: `${targetRole} - ${modeLabels[mode]}`,
      description: `Socratic evaluation for ${targetRole} focusing on ${modeLabels[mode]}.`,
      author: 'Neural Interrogator',
      voiceName: 'Software Interview Voice gen-lang-client-0648937375',
      systemInstruction: instruction,
      likes: 0,
      dislikes: 0,
      comments: [],
      tags: ['Evaluation', mode, difficulty],
      imageUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&q=80',
      welcomeMessage: `Handshake verified. calibarting interrogation parameters for ${targetRole}...`,
      starterPrompts: ["I am ready for the first question.", "Explain the Staff-level expectations.", "Audit my current mental model."]
    };

    onStartLiveSession(
      interviewChannel, 
      `Job: ${targetRole}\n\nContext: ${jobDescription}`,
      true, // recordingEnabled
      undefined, 
      true, // recordScreen
      true, // recordCamera
      undefined,
      2700, // 45 minute cap
      true // interactionEnabled
    );
  };

  const generateEvaluationReport = async (recording: MockInterviewRecording) => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const transcriptText = recording.transcript.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n');
      
      const prompt = `
        As a Staff-Level Technical Auditor, analyze this technical interview transcript and synthesize a 10-Week Refraction Plan (Study Plan) to "Shorten the Gap" between the candidate's current performance and the ${recording.mode} level requirements for a ${recording.jobDescription.substring(0, 100)} role.

        TRANSCRIPT:
        ${transcriptText}

        OUTPUT STRUCTURE (Markdown):
        # Neural Evaluation: ${recording.mode.toUpperCase()}
        
        ## 📊 Scorecard (1-10)
        - Technical Depth: [Score]
        - Communication Clarity: [Score]
        - Architectural Resilience: [Score]

        ## 🔍 Identified Unknowns
        [Detail specific logical gaps identified in the session]

        ## 🚀 10-Week Refraction Plan
        [Weekly breakdown of specific topics to master, referencing the Neural Prism tools like 'Podcast Lab' and 'Builder Studio']

        ## 🛡️ Closing Audit Summary
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt
      });

      const feedback = response.text || "Evaluation synthesis failed.";
      
      const updated: MockInterviewRecording = { ...recording, feedback };
      await saveInterviewRecording(updated);
      
      deductCoins(currentUser.uid, AI_COSTS.TECHNICAL_EVALUATION);
      
      setActiveReport(updated);
      setView('report');
      loadHistory();
    } catch (e: any) {
      alert("Synthesis failed: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this evaluation artifact?")) return;
    try {
      await deleteInterview(id);
      loadHistory();
    } catch (e) {}
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-20">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"><ArrowLeft size={20} /></button>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2 italic uppercase tracking-tighter">
              <Video className="text-red-500" /> Career Eval Studio
            </h1>
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Socratic Interrogation Lab v6.8.5</p>
          </div>
        </div>
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-inner">
          <button onClick={() => setView('setup')} className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${view === 'setup' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Setup</button>
          <button onClick={() => setView('history')} className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${view === 'history' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Archive</button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="max-w-4xl mx-auto p-8 md:p-12 h-full">
          
          {view === 'setup' && (
            <div className="space-y-10 animate-fade-in-up">
               <div className="text-center space-y-4">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-900/30 border border-indigo-500/30 text-indigo-300 text-xs font-bold uppercase tracking-widest mb-2">
                    <GraduationCap size={16} className="text-indigo-400"/> Calibrate Socratic Interrogator
                  </div>
                  <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">Calibrate Evaluation</h2>
                  <p className="text-slate-400 max-w-xl mx-auto leading-relaxed"> calibrating interrogation parameters for a high-intensity technical session. Gemini 3 Pro will evaluate your speech and logic flow.</p>
               </div>

               <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl space-y-8 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-32 bg-indigo-500/5 blur-[100px] rounded-full group-hover:bg-indigo-500/10 transition-colors"></div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Target Position</label>
                      <div className="relative group">
                        <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400" size={18}/>
                        <input 
                          type="text" 
                          value={targetRole}
                          onChange={e => setTargetRole(e.target.value)}
                          placeholder="e.g. Staff Backend Engineer"
                          className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-4 py-4 text-white text-sm outline-none focus:ring-2 focus:ring-red-500 shadow-inner"
                        />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Evaluation Difficulty</label>
                      <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-950 border border-slate-800 rounded-2xl">
                        {(['standard', 'staff', 'principal'] as const).map(d => (
                          <button key={d} onClick={() => setDifficulty(d)} className={`py-2 rounded-xl text-[10px] font-black uppercase transition-all ${difficulty === d ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500'}`}>{d}</button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 relative z-10">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Job Description / Requirements Context</label>
                      <textarea 
                        rows={6}
                        value={jobDescription}
                        onChange={e => setJobDescription(e.target.value)}
                        placeholder="Paste the job requirements or specific context you want to be evaluated against..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-3xl p-6 text-sm text-slate-300 outline-none focus:ring-2 focus:ring-red-500 resize-none shadow-inner leading-relaxed"
                      />
                  </div>

                  <div className="space-y-4 relative z-10">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Focus Sector</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {(['coding', 'system_design', 'behavioral'] as const).map(m => (
                            <button 
                                key={m}
                                onClick={() => setMode(m)}
                                className={`flex flex-col items-center gap-3 p-6 rounded-3xl border transition-all ${mode === m ? 'bg-indigo-600 border-indigo-400 text-white shadow-xl scale-105' : 'bg-slate-950 border-slate-800 text-slate-500 hover:bg-slate-800'}`}
                            >
                                {m === 'coding' ? <Code size={24}/> : m === 'system_design' ? <Layout size={24}/> : <MessageSquare size={24}/>}
                                <span className="text-[10px] font-black uppercase tracking-widest">{m.replace('_', ' ')}</span>
                            </button>
                        ))}
                    </div>
                  </div>

                  <button 
                    onClick={handleStartInterview}
                    className="w-full py-5 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-[0.3em] rounded-3xl shadow-2xl shadow-red-900/40 transition-all active:scale-95 flex items-center justify-center gap-3 relative z-10"
                  >
                    <Zap size={20} fill="currentColor"/> Begin Interrogation
                  </button>
               </div>
            </div>
          )}

          {view === 'history' && (
            <div className="space-y-8 animate-fade-in-up">
              <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">Evaluation Archive</h2>
                  <button onClick={loadHistory} className="p-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 hover:text-white transition-all"><RefreshCw size={20} className={loading ? 'animate-spin' : ''}/></button>
              </div>

              {loading ? (
                <div className="py-32 flex flex-col items-center justify-center gap-4 text-red-400">
                    <Loader2 className="animate-spin" size={48} />
                    <p className="text-[10px] font-black uppercase tracking-widest">Scanning Archive Nodes...</p>
                </div>
              ) : recordings.length === 0 ? (
                <div className="py-40 text-center space-y-6">
                    <div className="w-24 h-24 bg-slate-900 rounded-[2.5rem] flex items-center justify-center mx-auto opacity-10"><History size={48}/></div>
                    <p className="text-sm font-bold text-slate-600 uppercase tracking-widest">No evaluation records found in ledger.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  {recordings.map(rec => (
                    <div key={rec.id} className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 flex flex-col sm:flex-row items-center justify-between gap-8 hover:border-red-500/30 transition-all shadow-xl relative overflow-hidden group">
                      <div className="flex items-center gap-6 flex-1 min-w-0">
                        <div className="w-16 h-16 rounded-[1.5rem] bg-slate-950 border border-slate-800 flex items-center justify-center shadow-lg shrink-0">
                          <Award className={rec.feedback ? 'text-emerald-400' : 'text-slate-700'} size={32}/>
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-xl font-bold text-white truncate">{rec.jobDescription.split('\n')[0] || 'Neural Session'}</h3>
                          <div className="flex items-center gap-4 text-xs font-medium text-slate-500 uppercase tracking-widest mt-2">
                             <span className="flex items-center gap-1.5"><Calendar size={14} className="text-red-400"/> {new Date(rec.timestamp).toLocaleDateString()}</span>
                             <span className="flex items-center gap-1.5 font-mono text-[10px]">{rec.mode.toUpperCase()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {rec.feedback ? (
                          <button onClick={() => { setActiveReport(rec); setView('report'); }} className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 flex items-center gap-2">
                            <Microscope size={16}/> View Report
                          </button>
                        ) : (
                          <button onClick={() => generateEvaluationReport(rec)} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 flex items-center gap-2">
                            <Sparkles size={16}/> Synthesize Eval
                          </button>
                        )}
                        <button onClick={() => handleDelete(rec.id)} className="p-3 bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-400 rounded-2xl transition-all"><Trash2 size={20}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {view === 'report' && activeReport && (
            <div className="space-y-12 animate-fade-in-up pb-20">
               <div className="flex items-center justify-between border-b border-slate-800 pb-8">
                  <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-emerald-500 text-white rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-emerald-500/20">
                          <Award size={32} />
                      </div>
                      <div>
                          <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">Neural Audit</h2>
                          <p className="text-emerald-400 text-xs font-bold uppercase tracking-[0.3em] mt-3">Shorten the Gap Plan v1.0</p>
                      </div>
                  </div>
                  <button onClick={() => setView('history')} className="p-4 bg-slate-900 border border-slate-800 rounded-3xl text-slate-400 hover:text-white transition-all"><X size={24}/></button>
               </div>

               <div className="bg-white rounded-[3rem] p-10 md:p-16 shadow-2xl shadow-black/50">
                  <div className="prose prose-slate prose-lg max-w-none antialiased">
                      <MarkdownView content={activeReport.feedback} initialTheme="light" showThemeSwitcher={false} />
                  </div>
                  
                  <div className="mt-16 pt-10 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-8 opacity-40">
                      <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xs">NP</div>
                          <div className="flex flex-col">
                              <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Sovereign Artifact</span>
                              <span className="text-[8px] font-bold text-slate-400 uppercase">Registry Trace: {activeReport.id.substring(0, 12)}</span>
                          </div>
                      </div>
                      <p className="text-[10px] font-black text-slate-900 uppercase tracking-[0.4em]">Neural Handshake Protocol v6.8.5</p>
                  </div>
               </div>

               <div className="flex justify-center gap-4">
                  <button className="px-10 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest border border-slate-800 transition-all flex items-center gap-2"><Share2 size={16}/> Share Artifact</button>
                  <button onClick={() => setView('history')} className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl transition-all">Close Report</button>
               </div>
            </div>
          )}

        </div>
      </div>
      
      {loading && (
        <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm z-[100] flex flex-col items-center justify-center gap-6 animate-fade-in">
           <Loader2 className="animate-spin text-indigo-500" size={48} />
           <span className="text-sm font-black text-white uppercase tracking-[0.3em]">Refracting Neural Data...</span>
        </div>
      )}
    </div>
  );
};

export default MockInterview;