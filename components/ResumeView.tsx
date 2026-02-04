
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Mail, Phone, MapPin, Building, Calendar, Award, Code, Globe, ShieldCheck, Cpu, Sparkles, BookOpen, ExternalLink, Linkedin, Github, UserCheck, ChevronRight, Activity, FileCode, Scale, Sliders, Target, Check, X, User as UserIcon, Loader2, IdCard } from 'lucide-react';
import { UserProfile } from '../types';
import { getBadge } from '../services/firestoreService';

interface ResumeViewProps {
  onBack: () => void;
  currentUser?: any;
  userProfile?: UserProfile | null;
}

export const ResumeView: React.FC<ResumeViewProps> = ({ onBack, currentUser, userProfile }) => {
  // Persistence for the photo position refraction
  const [photoOffset, setPhotoOffset] = useState(() => {
    return parseInt(localStorage.getItem('resume_photo_offset') || '50');
  });
  const [showControls, setShowControls] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [badgePhoto, setBadgePhoto] = useState<string | null>(null);
  const [isFetchingBadge, setIsFetchingBadge] = useState(false);

  // The specific badge ID provided by the architect
  const ARCHITECT_BADGE_ID = 'Tua24XaN4_tNCBW61NGzsYPu6pmtAvO5sU4s1ehqSHE';
  const BADGE_LINK = `${window.location.origin}/?view=badge_viewer&id=${ARCHITECT_BADGE_ID}`;

  useEffect(() => {
    const fetchArchitectPhoto = async () => {
        // If we don't have a specific profile photo yet, fetch the architect's badge photo
        if (!userProfile?.photoURL && !currentUser?.photoURL) {
            setIsFetchingBadge(true);
            try {
                const badge = await getBadge(ARCHITECT_BADGE_ID);
                if (badge && badge.photoUrl) {
                    setBadgePhoto(badge.photoUrl);
                }
            } catch (e) {
                console.warn("Could not refract badge photo artifact.");
            } finally {
                setIsFetchingBadge(false);
            }
        }
    };
    fetchArchitectPhoto();
  }, [userProfile?.photoURL, currentUser?.photoURL]);

  const handleOffsetChange = (val: number) => {
    setPhotoOffset(val);
    localStorage.setItem('resume_photo_offset', val.toString());
  };

  const experiences = [
    {
      company: 'Meta',
      role: 'Senior Software Engineer',
      period: 'Jan 2025 - Dec 2025',
      location: 'Burlingame, CA',
      bullets: [
        'Designed and implemented a memory management component for the embedded Connectivity Framework, optimizing memory footprint across multiple device profiles.',
        'Developed the Stream file transfer service over the DataX transport layer for AR/VR devices, enabling efficient coredump uploads and OTA software updates.',
        'Implemented Constellation Profile Arbitration, supporting Hands-Free Profile integration for seamless Bluetooth coexistence and user experience.',
        'Hackathon: Co-created LectureMate, an AI-driven podcast agent integrated with Metamate and Deep Research, built in just 3 days as part of a two-person team.'
      ]
    },
    {
      company: 'TikTok',
      role: 'Senior Software Engineer',
      period: 'May 2022 - Dec 2024',
      location: 'San Jose, CA',
      bullets: [
        'Led the design and development of DDL query execution in a MySQL cluster with N-shard writers, improving distributed schema change reliability and scalability.',
        'Implemented a proof-of-concept for distributed query processing, demonstrating performance gains for cross-shard analytics.',
        'Designed and implemented adaptive autoscaling for buffer pool and heap memory, extending beyond CPU-based scaling to optimize resource utilization.',
        'Built a continuous code coverage pipeline that generated daily reports, increasing test visibility and improving regression detection efficiency.',
        'Authored the “ByteNDB Compile & Run Cookbook,” standardizing internal build workflows and accelerating onboarding for new engineers.',
        'Mentored interns and led technical interviews, contributing to talent development and building a high-performing, collaborative engineering culture.'
      ]
    },
    {
      company: 'Microsoft',
      role: 'Senior Software Engineer',
      period: 'Jan 2020 - March 2022',
      location: 'Mountain View, CA',
      bullets: [
        'Implemented asynchronous DDL physical replication within a replica group for MySQL8, resulting in improved replication speed and overall user experience.',
        'Participated in on-call support for Azure databases, including MySQL and PostgreSQL products, ensuring timely and effective resolution of customer issues.'
      ]
    },
    {
      company: 'Amazon',
      role: 'Aurora Software Engineer',
      period: 'Dec 2016 - Jan 2020',
      location: 'East Palo Alto, CA',
      bullets: [
        'Trained Primary-On-Call engineers on DDL Recovery and MySQL Metadata Lock issues through hands-on exercises, enhancing their technical proficiency.',
        'Contributed to various projects including Aurora Fast DDL features, Porting from MySQL 5.6 to 5.7, Parallel-Query processing, and multi-master DDL features.'
      ]
    },
    {
      company: 'Google',
      role: 'Senior Software Engineer',
      period: 'March 2014 - June 2016',
      location: 'Mountain View, CA',
      bullets: [
        'Designed and implemented battery firmware over-the-air update for Chromebook, resulting in significant cost savings.',
        'Conducted over 200 interviews and served on the Hire Committee, playing a key role in hiring top talent.',
        'Taught interviewer training classes to 400+ googlers and firmware classes to 200+ googlers in the g2g program.'
      ]
    },
    {
      company: 'Broadcom Corporation',
      role: 'Sr. Staff Software Engineer',
      period: 'May 2011 - Nov 2013',
      location: 'Santa Clara, CA',
      bullets: [
        'Improved DDR3 memory controller frequency from 666MHz to 800MHz through implementing Read Training and Write Leveling.',
        'Collaborated with a team of 10+ engineers to bring up XLPII multicore processors.',
        'Conducted openocd/gdb debug training sessions for 15 RTL verification and software team members.'
      ]
    }
  ];

  // Resolve final photo source with precedence: 
  // 1. Explicit Profile Photo -> 2. Badge Photo (if architect) -> 3. Fallback Placeholder
  const photoToUse = userProfile?.photoURL || currentUser?.photoURL || badgePhoto || 'https://lh3.googleusercontent.com/a/ACg8ocL2qjG599q2Nn1uE-p4zBfD3_P_v-v_X_P_v_X_P_v_X_P=s288-c-no';

  return (
    <div className="h-full bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30">
      <header className="p-6 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-xl font-black italic uppercase tracking-tighter text-white">Chief Architect Profile</h1>
            <p className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.3em]">Sovereign Personnel File // verified</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a href={BADGE_LINK} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 bg-indigo-900/30 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-xl border border-indigo-500/30 transition-all shadow-lg group">
            <IdCard size={18} className="group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Digital Badge</span>
          </a>
          <a href="mailto:shengliang.song@gmail.com" className="p-2.5 bg-slate-800 hover:bg-indigo-600 rounded-xl text-slate-400 hover:text-white transition-all"><Mail size={18}/></a>
          <a href="https://www.linkedin.com/in/shenglia" target="_blank" rel="noreferrer" className="p-2.5 bg-slate-800 hover:bg-indigo-600 rounded-xl text-slate-400 hover:text-white transition-all"><Linkedin size={18}/></a>
          <a href="https://github.com/aivoicecast/AIVoiceCast" target="_blank" rel="noreferrer" className="p-2.5 bg-slate-800 hover:bg-indigo-600 rounded-xl text-slate-400 hover:text-white transition-all"><Github size={18}/></a>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-hide pb-32">
        <div className="max-w-4xl mx-auto px-6 pt-12 space-y-16">
          
          {/* Hero Section */}
          <section className="flex flex-col md:flex-row items-center gap-10 animate-fade-in-up">
            <div className="relative group">
                <div className="absolute -inset-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full blur opacity-25 group-hover:opacity-60 transition duration-1000 group-hover:duration-200"></div>
                <div className="w-48 h-48 rounded-full border-4 border-slate-900 overflow-hidden bg-slate-800 relative z-10 shadow-2xl flex items-center justify-center">
                    {isFetchingBadge ? (
                        <Loader2 className="animate-spin text-indigo-500" size={32} />
                    ) : !imageError && photoToUse ? (
                      <img 
                        src={photoToUse} 
                        onError={() => setImageError(true)}
                        className="w-full h-full object-cover transition-all duration-300 transform scale-110" 
                        style={{ objectPosition: `center ${photoOffset}%` }}
                        alt={userProfile?.displayName || "Sheng-Liang Song"} 
                      />
                    ) : (
                      <UserIcon size={64} className="text-slate-600" />
                    )}
                </div>
                <div className="absolute -bottom-2 -right-2 bg-indigo-600 p-3 rounded-2xl border-4 border-slate-950 z-20 shadow-xl flex flex-col gap-2">
                    <button 
                      onClick={() => setShowControls(!showControls)}
                      className={`p-1.5 rounded-lg transition-all ${showControls ? 'bg-white text-indigo-600' : 'text-white hover:bg-indigo-500'}`}
                      title="Adjust Photo Refraction"
                    >
                      <Sliders size={18} />
                    </button>
                    <ShieldCheck size={20} className="text-indigo-200 mx-auto" />
                </div>

                {showControls && (
                  <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 bg-slate-900/95 backdrop-blur-xl border border-indigo-500/30 p-4 rounded-3xl shadow-2xl z-50 w-48 animate-fade-in-right space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Photo Offset</span>
                      <button onClick={() => setShowControls(false)} className="text-slate-500 hover:text-white"><X size={14}/></button>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[9px] font-mono text-slate-500"><span>UP</span><span>DOWN</span></div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={photoOffset} 
                        onChange={(e) => handleOffsetChange(parseInt(e.target.value))}
                        className="w-full h-1 bg-slate-800 rounded-full appearance-none accent-indigo-500 cursor-pointer"
                      />
                    </div>
                    <p className="text-[8px] text-slate-500 font-bold uppercase text-center leading-tight">Adjust to align face within the neural portal.</p>
                    <button onClick={() => setShowControls(false)} className="w-full py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                      <Check size={12}/> Locked
                    </button>
                  </div>
                )}
            </div>
            <div className="flex-1 text-center md:text-left space-y-4">
                <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
                    {userProfile?.displayName ? (
                      <>
                        {userProfile.displayName.split(' ')[0]} <br/> <span className="text-indigo-400 font-black">{userProfile.displayName.split(' ').slice(1).join(' ')}</span>
                      </>
                    ) : (
                      <>
                        Sheng-Liang <br/> <span className="text-indigo-400 font-black">Song</span>
                      </>
                    )}
                </h2>
                <div className="flex flex-wrap justify-center md:justify-start gap-4 text-xs font-black uppercase text-slate-500 tracking-widest">
                    <span className="flex items-center gap-1.5"><MapPin size={14} className="text-red-500"/> Fremont, CA</span>
                    <span className="flex items-center gap-1.5"><Code size={14} className="text-indigo-400"/> 20+ Years C++ / Systems</span>
                </div>
                <p className="text-slate-400 text-lg leading-relaxed font-medium">
                    {userProfile?.headline || 'Designing, developing, and launching innovative software products at scale. Expert in computer architecture, distributed systems, and cloud databases.'}
                </p>
                <div className="pt-2">
                   <a href={BADGE_LINK} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-indigo-400 hover:text-white transition-colors group">
                      <span className="text-xs font-black uppercase tracking-widest">Verify Technical Identity</span>
                      <ExternalLink size={14} className="group-hover:translate-x-1 transition-transform" />
                   </a>
                </div>
            </div>
          </section>

          {/* Vibe Coding / Hackathon Synthesis Card */}
          <section className="bg-gradient-to-br from-indigo-900/40 to-slate-900 border border-indigo-500/30 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-32 bg-indigo-500/10 blur-[120px] rounded-full group-hover:scale-110 transition-all duration-1000"></div>
              <div className="relative z-10 space-y-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-xl">
                        <span className="text-2xl">🪄</span>
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Neural Synthesis: v7.0.0-ULTRA</h3>
                        <p className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.4em]">Hackathon Narrative</p>
                    </div>
                </div>
                <p className="text-slate-300 text-lg leading-relaxed">
                    This entire platform was created in <span className="text-white font-bold">40 days</span> using 100% <span className="text-indigo-400 font-bold italic">"Vibe Coding"</span> methodology. By leveraging Google AI Studio and Gemini 3, I refracted complex systems into a beautifully accessible spectrum of tools.
                </p>
                
                <div className="bg-slate-950/50 p-6 rounded-2xl border border-white/5 space-y-4">
                    <div className="flex items-center gap-3">
                        <FileCode className="text-indigo-400" size={20}/>
                        <span className="text-sm font-bold uppercase tracking-wider">Open Source Manifest</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        Neural Prism is a fully open-source project licensed under the <span className="text-indigo-300 font-bold">MIT License</span>. I believe in organizing the world's information and making it universally accessible.
                    </p>
                    <a href="https://github.com/aivoicecast/AIVoiceCast" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all shadow-lg active:scale-95">
                        <Github size={14}/> View Source on GitHub
                    </a>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                    {[
                        { label: 'Time', val: '40 Days' },
                        { label: 'Method', val: 'AI Studio' },
                        { label: 'License', val: 'MIT' },
                        { label: 'Soul', val: 'Gemini 3' }
                    ].map(stat => (
                        <div key={stat.label} className="bg-slate-950/50 p-4 rounded-2xl border border-white/5 text-center">
                            <p className="text-[9px] font-black text-slate-500 uppercase mb-1">{stat.label}</p>
                            <p className="text-sm font-black text-indigo-300 uppercase">{stat.val}</p>
                        </div>
                    ))}
                </div>
              </div>
          </section>

          {/* Experience Timeline */}
          <section className="space-y-10">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] px-2 flex items-center gap-4">
                <div className="w-8 h-px bg-slate-800"></div> Technical Trace History
              </h3>
              <div className="space-y-12">
                  {experiences.map((exp, idx) => (
                      <div key={idx} className="relative pl-12 border-l-2 border-slate-800 group hover:border-indigo-500 transition-colors">
                          <div className="absolute -left-3 top-0 w-6 h-6 rounded-full bg-slate-950 border-2 border-slate-800 group-hover:border-indigo-500 transition-all flex items-center justify-center">
                              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                          </div>
                          <div className="space-y-4">
                              <div className="flex flex-col md:flex-row md:items-end justify-between gap-2">
                                  <div>
                                      <h4 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">{exp.company}</h4>
                                      <p className="text-indigo-400 text-sm font-bold uppercase mt-2">{exp.role}</p>
                                  </div>
                                  <div className="text-right">
                                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{exp.period}</p>
                                      <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">{exp.location}</p>
                                  </div>
                              </div>
                              <ul className="space-y-3">
                                  {exp.bullets.map((bullet, bIdx) => (
                                      <li key={bIdx} className="flex items-start gap-3 text-sm text-slate-400 leading-relaxed group-hover:text-slate-200 transition-colors">
                                          <ChevronRight size={14} className="text-indigo-500 shrink-0 mt-1"/>
                                          <span>{bullet}</span>
                                      </li>
                                  ))}
                              </ul>
                          </div>
                      </div>
                  ))}
              </div>
          </section>

          {/* Education & Skills */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-12 border-t border-slate-800">
              <section className="space-y-6">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-3"><Award size={18} className="text-amber-500" /> Education</h3>
                <div className="space-y-6">
                    <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl">
                        <p className="text-[10px] font-black text-indigo-400 uppercase mb-1">Master of Computer Science</p>
                        <h4 className="text-lg font-bold text-white">San Jose State University</h4>
                        <p className="text-xs text-slate-500 mt-1">2005 - 2008 (Concurrent with Full-time)</p>
                    </div>
                    <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl">
                        <p className="text-[10px] font-black text-indigo-400 uppercase mb-1">BS Electrical Engineering & CS</p>
                        <h4 className="text-lg font-bold text-white">UC Berkeley</h4>
                        <p className="text-xs text-slate-500 mt-1">1998 - 2000</p>
                    </div>
                </div>
              </section>

              <section className="space-y-6">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-3"><Cpu size={18} className="text-indigo-400" /> Skills Spectrum</h3>
                <div className="flex flex-wrap gap-2">
                    {['C/C++', 'SystemC', 'Architectural Modeling', 'Embedded Systems', 'DDR/SSD', 'Storage Systems', 'Cloud Databases', 'Kubernetes', 'TypeScript', 'React', 'AI Orchestration'].map(skill => (
                        <span key={skill} className="px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-black uppercase text-slate-300 hover:border-indigo-500 transition-all hover:text-white cursor-default">
                            {skill}
                        </span>
                    ))}
                </div>
              </section>
          </div>

          <footer className="pt-20 text-center space-y-6">
              <div className="flex flex-col items-center">
                  <div className="w-12 h-px bg-indigo-500 mb-6"></div>
                  <p className="text-2xl font-serif italic text-slate-500">"Building bridges between local silicon and neural souls."</p>
              </div>
              <div className="flex items-center justify-center gap-6 text-slate-700">
                  <UserCheck size={20} />
                  <Activity size={20} />
                  <Globe size={20} />
              </div>
              <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.5em]">Neural Prism v7.0.0-ULTRA • Sovereign Portfolio</p>
          </footer>

        </div>
      </div>
    </div>
  );
};

export default ResumeView;
