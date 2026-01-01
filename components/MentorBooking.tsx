
import React, { useState, useEffect, useMemo } from 'react';
import { Channel, Booking, UserProfile } from '../types';
import { Calendar, Clock, User, ArrowLeft, Search, Briefcase, Sparkles, CheckCircle, X, Loader2, Play, Users, Mail, Video, Mic, FileText, Download, Trash2, Monitor, UserPlus, Grid, List, ArrowDown, ArrowUp, Heart, Share2, Info, ShieldAlert, ChevronRight, Coins, Check as CheckIcon } from 'lucide-react';
import { auth } from '../services/firebaseConfig';
import { createBooking, getUserBookings, cancelBooking, updateBookingInvite, deleteBookingRecording, getAllUsers, getUserProfileByEmail } from '../services/firestoreService';

interface MentorBookingProps {
  currentUser: any;
  channels: Channel[]; 
  onStartLiveSession: (channel: Channel, context?: string, recordingEnabled?: boolean, bookingId?: string, videoEnabled?: boolean, cameraEnabled?: boolean, activeSegment?: { index: number, lectureId: string }) => void;
}

const TIME_SLOTS = [
  '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '19:00', '20:00'
];

type SortKey = 'displayName' | 'email' | 'createdAt';

export const MentorBooking: React.FC<MentorBookingProps> = ({ currentUser, channels, onStartLiveSession }) => {
  const [activeTab, setActiveTab] = useState<'members' | 'ai_mentors' | 'my_bookings'>('members');
  const [selectedMentor, setSelectedMentor] = useState<Channel | null>(null);
  
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [topic, setTopic] = useState('');
  const [inviteEmail, setInviteEmail] = useState(''); 
  const [isBooking, setIsBooking] = useState(false);
  const [bookingMember, setBookingMember] = useState<UserProfile | null>(null);
  
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);

  const [members, setMembers] = useState<UserProfile[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'createdAt', direction: 'desc' });
  const [isSearchingServer, setIsSearchingServer] = useState(false);

  const [sessionStartBooking, setSessionStartBooking] = useState<Booking | null>(null);
  const [recordMeeting, setRecordMeeting] = useState(false);
  const [recordScreen, setRecordScreen] = useState(false);
  const [recordCamera, setRecordCamera] = useState(false);

  const aiMentors = useMemo(() => channels.filter(c => c.likes > 20 || !Number.isNaN(Number(c.id)) === false), [channels]);
  const isAdmin = currentUser?.email === 'shengliang.song.ai@gmail.com';

  useEffect(() => {
    if (activeTab === 'my_bookings' && currentUser) loadBookings();
    if (activeTab === 'members') loadMembers();
  }, [activeTab, currentUser]);

  useEffect(() => {
      const delayDebounceFn = setTimeout(async () => {
        if (isAdmin && searchQuery.includes('@') && searchQuery.length > 5) {
             const exists = members.some(m => m.email.toLowerCase() === searchQuery.toLowerCase());
             if (!exists) {
                 setIsSearchingServer(true);
                 const user = await getUserProfileByEmail(searchQuery);
                 if (user) setMembers(prev => prev.some(m => m.uid === user.uid) ? prev : [user, ...prev]);
                 setIsSearchingServer(false);
             }
        }
      }, 800);
      return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, members, isAdmin]);

  const loadBookings = async () => {
    if (!currentUser) return;
    setIsLoadingBookings(true);
    try {
      const data = await getUserBookings(currentUser.uid, currentUser.email);
      setMyBookings(data.filter(b => b.status !== 'cancelled' && b.status !== 'rejected')); 
    } catch(e) { console.error(e); } finally { setIsLoadingBookings(false); }
  };

  const loadMembers = async () => {
    setLoadingMembers(true);
    try {
      const users = await getAllUsers();
      setMembers(currentUser ? users.filter(u => u.uid !== currentUser.uid) : users);
    } catch(e) { console.error(e); } finally { setLoadingMembers(false); }
  };

  const filteredMembers = useMemo(() => {
    let result = members.filter(m => m.email && m.email.includes('@'));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(m => (m.displayName && m.displayName.toLowerCase().includes(q)) || (isAdmin && m.email && m.email.toLowerCase().includes(q)));
    }
    result.sort((a, b) => {
        const valA = sortConfig.key === 'createdAt' ? (a.createdAt || 0) : (a[sortConfig.key] || '');
        const valB = sortConfig.key === 'createdAt' ? (b.createdAt || 0) : (b[sortConfig.key] || '');
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });
    return result;
  }, [members, searchQuery, sortConfig, isAdmin]);

  const handleBookSession = async () => {
    if (!currentUser || !selectedDate || !selectedTime || !topic.trim()) return alert("Please fill in all fields.");
    const isP2P = !!bookingMember;
    const targetEmail = isP2P ? bookingMember!.email : inviteEmail;
    if (isP2P && !targetEmail) return alert("Selected member has no email address.");
    
    setIsBooking(true);
    try {
        const newBooking: Booking = {
            id: '', userId: currentUser.uid, hostName: currentUser.displayName || currentUser.email,
            mentorId: isP2P ? 'p2p-meeting' : selectedMentor!.id,
            mentorName: isP2P ? `Meeting with ${bookingMember!.displayName}` : selectedMentor!.title,
            mentorImage: isP2P ? (bookingMember!.photoURL || 'https://ui-avatars.com/api/?name=' + bookingMember!.displayName) : selectedMentor!.imageUrl,
            date: selectedDate, time: selectedTime, topic: topic, invitedEmail: targetEmail,
            status: isP2P ? 'pending' : 'scheduled', type: isP2P ? 'p2p' : 'ai', createdAt: Date.now(),
            coinPrice: isP2P ? 50 : 0 // Peer sessions cost 50 coins by default
        };
        await createBooking(newBooking);
        alert(isP2P ? "Meeting request sent! 50 coins will be transferred upon session start." : "Session Booked!");
        setActiveTab('my_bookings');
        setSelectedMentor(null); setBookingMember(null); setTopic(''); setInviteEmail(''); setSelectedDate(''); setSelectedTime('');
    } catch(e) { alert("Failed to book session."); } finally { setIsBooking(false); }
  };

  const handleOpenBooking = (member: UserProfile) => {
      setBookingMember(member);
      setSelectedMentor(null);
  };

  const handleOpenStartModal = (booking: Booking) => {
      setSessionStartBooking(booking);
      setRecordMeeting(false);
      setRecordScreen(false);
      setRecordCamera(false);
  };

  const handleCancel = async (bookingId: string) => {
      if (!confirm("Are you sure you want to cancel this session?")) return;
      try {
          await cancelBooking(bookingId);
          setMyBookings(prev => prev.filter(b => b.id !== bookingId));
      } catch (e) {
          alert("Failed to cancel booking.");
      }
  };

  const handleConfirmStart = () => {
      if (!sessionStartBooking) return;
      let channel: Channel | undefined;
      if (sessionStartBooking.type === 'p2p') {
          channel = {
              id: sessionStartBooking.id, title: sessionStartBooking.topic || "Peer Meeting",
              description: "Peer to Peer Meeting", author: "System", voiceName: "Zephyr",
              systemInstruction: "You are a professional meeting scribe. Transcribe the conversation accurately.",
              likes: 0, dislikes: 0, comments: [], tags: ['Meeting'], imageUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&q=80', createdAt: Date.now()
          };
          onStartLiveSession(channel, sessionStartBooking.topic, true, sessionStartBooking.id, recordScreen, recordCamera, undefined);
      } else {
          channel = channels.find(c => c.id === sessionStartBooking.mentorId);
          if (channel) onStartLiveSession(channel, sessionStartBooking.topic, recordMeeting, sessionStartBooking.id, recordScreen, recordCamera, undefined);
      }
      setSessionStartBooking(null);
  };

  if (bookingMember || selectedMentor) {
      return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden max-w-4xl mx-auto animate-fade-in my-8">
            <div className="p-6 border-b border-slate-800 flex items-center space-x-4 bg-slate-950/50">
                <button onClick={() => { setSelectedMentor(null); setBookingMember(null); }} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white"><ArrowLeft size={20} /></button>
                <div className="flex items-center gap-3">
                    <img src={bookingMember ? (bookingMember.photoURL || `https://ui-avatars.com/api/?name=${bookingMember.displayName}`) : selectedMentor!.imageUrl} className="w-12 h-12 rounded-full border-2 border-indigo-500" />
                    <div><h2 className="text-xl font-bold text-white">Book {bookingMember ? bookingMember.displayName : selectedMentor!.title}</h2><p className="text-sm text-indigo-400">{bookingMember ? 'Community Peer' : 'AI Mentor'}</p></div>
                </div>
            </div>
            <div className="p-8 space-y-8">
                {bookingMember && (
                    <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Coins className="text-amber-400" size={24}/>
                            <div>
                                <p className="text-sm font-bold text-white">Session Fee: 50 Coins</p>
                                <p className="text-xs text-amber-200/60">Coins are transferred to mentor upon session completion.</p>
                            </div>
                        </div>
                    </div>
                )}
                <div><h3 className="text-sm font-bold text-slate-400 uppercase mb-3 flex items-center space-x-2"><Calendar size={16} /> <span>Select Date</span></h3><div className="flex gap-2 overflow-x-auto pb-2">{[1,2,3,4,5,6,7].map(i => { const d = new Date(); d.setDate(d.getDate() + i); const ds = d.toISOString().split('T')[0]; return <button key={ds} onClick={() => setSelectedDate(ds)} className={`flex-shrink-0 w-24 p-3 rounded-xl border flex flex-col items-center transition-all ${selectedDate === ds ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}><span className="text-[10px] font-bold uppercase">{d.toLocaleDateString('en-US', { weekday: 'short' })}</span><span className="text-lg font-bold">{d.getDate()}</span></button>; })}</div></div>
                <div><h3 className="text-sm font-bold text-slate-400 uppercase mb-3 flex items-center space-x-2"><Clock size={16} /> <span>Select Time</span></h3><div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 gap-2">{TIME_SLOTS.map(time => <button key={time} onClick={() => setSelectedTime(time)} className={`py-2 rounded-lg text-sm font-medium border transition-all ${selectedTime === time ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'}`}>{time}</button>)}</div></div>
                <div><h3 className="text-sm font-bold text-slate-400 uppercase mb-3 flex items-center space-x-2"><Sparkles size={16} /> <span>Topic</span></h3><textarea value={topic} onChange={e => setTopic(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none" rows={4} placeholder="What would you like to discuss?"/></div>
                <div className="pt-4 flex justify-end"><button onClick={handleBookSession} disabled={isBooking || !selectedDate || !selectedTime || !topic} className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl shadow-lg transition-transform hover:scale-105 disabled:opacity-50">{isBooking ? <Loader2 className="animate-spin" /> : <CheckCircle />}<span>Confirm Request</span></button></div>
            </div>
        </div>
      );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <div><h1 className="text-3xl font-bold text-white flex items-center space-x-2"><Briefcase className="text-indigo-400" /><span>Mentorship Hub</span></h1><p className="text-slate-400 mt-1">Connect, teach, and grow together.</p></div>
            <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                <button onClick={() => setActiveTab('members')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-1 ${activeTab === 'members' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}><UserPlus size={14} /><span>Community</span></button>
                <button onClick={() => setActiveTab('ai_mentors')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-1 ${activeTab === 'ai_mentors' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}><Sparkles size={14} /><span>AI Mentors</span></button>
                <button onClick={() => setActiveTab('my_bookings')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'my_bookings' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>My Schedule</button>
            </div>
        </div>

        {activeTab === 'members' && (
            <div className="space-y-6">
                <div className="bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border border-indigo-500/30 rounded-xl p-6 flex items-start gap-4">
                    <div className="p-3 bg-indigo-500/20 rounded-full text-indigo-300"><Heart size={24} /></div>
                    <div><h3 className="text-lg font-bold text-white mb-1">Our Mentorship Mission</h3><p className="text-sm text-indigo-200 max-w-2xl">We encourage every member to teach and help each other grow. Find peers, book learning sessions, and earn VoiceCoins by providing expert advice.</p></div>
                </div>
                <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                    <div className="relative w-full md:w-96"><Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${isSearchingServer ? 'text-indigo-400 animate-pulse' : 'text-slate-500'}`} size={16}/><input type="text" placeholder="Find member by name..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"/></div>
                    {!isAdmin && <div className="text-[10px] text-slate-500 flex items-center gap-1 opacity-70"><ShieldAlert size={12} /> Privacy: Emails are hidden for safety.</div>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loadingMembers ? <div className="col-span-full py-12 text-center text-indigo-400"><Loader2 className="animate-spin mx-auto" size={32}/></div> : filteredMembers.map(m => (
                        <div key={m.uid} className="bg-slate-900 border border-slate-800 p-6 rounded-xl hover:border-indigo-500/50 transition-all group">
                            <div className="flex items-center gap-4 mb-4">
                                {m.photoURL ? <img src={m.photoURL} className="w-14 h-14 rounded-full border-2 border-slate-700" /> : <div className="w-14 h-14 rounded-full bg-slate-700 flex items-center justify-center text-slate-500 border-2 border-slate-700"><User size={24}/></div>}
                                <div><h3 className="font-bold text-white group-hover:text-indigo-400 transition-colors">{m.displayName}</h3><p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Community Member</p></div>
                            </div>
                            <div className="flex flex-wrap gap-2 mb-6 h-12 overflow-hidden">{(m.interests || []).map(i => <span key={i} className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">#{i}</span>)}</div>
                            <button onClick={() => handleOpenBooking(m)} className="w-full py-2.5 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition-all border border-slate-700 flex items-center justify-center gap-2">
                                <Coins size={14}/>
                                Book Peer Session
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'ai_mentors' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-fade-in">
                {aiMentors.map(m => (
                    <div key={m.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-purple-500/50 transition-all group flex flex-col">
                        <div className="aspect-video relative"><img src={m.imageUrl} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" /><div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent" /></div>
                        <div className="p-6 flex-1 flex flex-col"><h3 className="text-xl font-bold text-white mb-2">{m.title}</h3><p className="text-sm text-slate-400 line-clamp-3 mb-6 flex-1">{m.description}</p><button onClick={() => { setSelectedMentor(m); setBookingMember(null); }} className="w-full py-3 bg-purple-600/20 hover:bg-purple-600 text-purple-400 hover:text-white rounded-xl text-sm font-bold border border-purple-500/30 transition-all flex items-center justify-center gap-2"><Sparkles size={16}/> Book AI Session</button></div>
                    </div>
                ))}
            </div>
        )}

        {activeTab === 'my_bookings' && (
            <div className="space-y-8 animate-fade-in">
                {isLoadingBookings ? <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-indigo-400" size={48}/></div> : myBookings.length === 0 ? <div className="py-20 text-center text-slate-500 border-2 border-dashed border-slate-800 rounded-3xl"><Calendar size={48} className="mx-auto mb-4 opacity-20"/><p>You have no scheduled sessions.</p></div> : (
                    <div className="space-y-6">
                        {myBookings.map(b => (
                            <div key={b.id} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center gap-6 relative group hover:border-indigo-500/30 transition-all">
                                <div className="bg-slate-800 p-4 rounded-xl text-center min-w-[100px] border border-slate-700"><span className="block text-2xl font-bold text-white">{b.time}</span><span className="text-[10px] text-slate-400 uppercase font-black">{new Date(b.date).toLocaleDateString(undefined, {weekday:'short', month:'short', day:'numeric'})}</span></div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="text-lg font-bold text-white">{b.mentorName}</h4>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${b.status === 'scheduled' ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-900/50' : b.status === 'pending' ? 'bg-amber-900/30 text-amber-400 border border-amber-900/50' : 'bg-slate-800 text-slate-400'}`}>{b.status}</span>
                                        {b.coinPrice && <div className="flex items-center gap-1 text-[10px] font-black text-amber-400 border border-amber-400/20 px-1.5 py-0.5 rounded bg-amber-400/10"><Coins size={10}/> {b.coinPrice}</div>}
                                    </div>
                                    <p className="text-sm text-slate-400 mb-2 italic">"{b.topic}"</p>
                                    <div className="flex items-center gap-3">
                                        {(b.recordingUrl || b.status === 'completed') ? <span className="text-xs text-emerald-500 flex items-center gap-1 font-bold"><CheckCircle size={14}/> Completed</span> : <div className="flex gap-2"><button onClick={() => handleOpenStartModal(b)} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-lg flex items-center gap-1 transition-all"><Play size={12} fill="currentColor"/> Start Session</button><button onClick={() => handleCancel(b.id)} className="px-4 py-1.5 bg-slate-800 hover:bg-red-900/30 text-slate-400 hover:text-red-400 text-xs font-bold rounded-lg border border-slate-700 transition-colors">Cancel</button></div>}
                                    </div>
                                </div>
                                <img src={b.mentorImage} className="w-16 h-16 rounded-full border-2 border-slate-700 hidden md:block" />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

        {sessionStartBooking && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
                <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md p-8 shadow-2xl animate-fade-in-up">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-white">Initialize Session</h3>
                        <button onClick={() => setSessionStartBooking(null)}><X/></button>
                    </div>
                    <div className="space-y-6">
                        <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700 flex items-center gap-4">
                            <img src={sessionStartBooking.mentorImage} className="w-12 h-12 rounded-full" />
                            <div><p className="text-sm font-bold text-white">{sessionStartBooking.mentorName}</p><p className="text-xs text-slate-500 truncate w-40">{sessionStartBooking.topic}</p></div>
                        </div>
                        {sessionStartBooking.coinPrice && (
                            <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-4 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Coins className="text-amber-400" size={16}/>
                                    <span className="text-sm font-bold text-white">Confirm Transfer: {sessionStartBooking.coinPrice} Coins</span>
                                </div>
                                <CheckIcon className="text-amber-400" size={16}/>
                            </div>
                        )}
                        <div className="space-y-3">
                            <label className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-2xl cursor-pointer hover:border-indigo-500 transition-all"><div className="flex items-center gap-3"><div className={`p-2 rounded-lg ${recordMeeting ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500'}`}><Mic size={18}/></div><div className="text-left"><p className="text-sm font-bold text-white">Record Audio</p><p className="text-[10px] text-slate-500">Save transcript & audio to history.</p></div></div><input type="checkbox" checked={recordMeeting} onChange={e => setRecordMeeting(e.target.checked)} className="hidden" /></label>
                            <label className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-2xl cursor-pointer hover:border-indigo-500 transition-all"><div className="flex items-center gap-3"><div className={`p-2 rounded-lg ${recordScreen ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500'}`}><Monitor size={18}/></div><div className="text-left"><p className="text-sm font-bold text-white">Screen Share</p><p className="text-[10px] text-slate-500">AI can see your screen content.</p></div></div><input type="checkbox" checked={recordScreen} onChange={e => setRecordScreen(e.target.checked)} className="hidden" /></label>
                        </div>
                        <button onClick={handleConfirmStart} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2">Join Studio Session</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
