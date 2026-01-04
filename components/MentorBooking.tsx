
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

export const MentorBooking: React.FC<MentorBookingProps> = ({ currentUser, channels, onStartLiveSession }) => {
  const [activeTab, setActiveTab] = useState<'members' | 'ai_mentors' | 'my_bookings'>('members');
  const [selectedMentor, setSelectedMentor] = useState<Channel | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [topic, setTopic] = useState('');
  const [isBooking, setIsBooking] = useState(false);
  const [bookingMember, setBookingMember] = useState<UserProfile | null>(null);
  
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [sessionStartBooking, setSessionStartBooking] = useState<Booking | null>(null);
  const [recordMeeting, setRecordMeeting] = useState(true);

  useEffect(() => {
    if (activeTab === 'my_bookings') loadBookings();
    if (activeTab === 'members') loadMembers();
  }, [activeTab, currentUser]);

  const loadBookings = async () => {
    if (!currentUser) return;
    setIsLoadingBookings(true);
    try {
      const data = await getUserBookings(currentUser.uid, currentUser.email);
      setMyBookings(data.filter(b => b.status !== 'cancelled' && b.status !== 'rejected').sort((a,b) => b.createdAt - a.createdAt)); 
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
    return members.filter(m => m.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || m.email?.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [members, searchQuery]);

  const handleBookSession = async () => {
    if (!currentUser || !selectedDate || !selectedTime || !topic.trim()) return alert("Please fill in all fields.");
    const isP2P = !!bookingMember;
    
    setIsBooking(true);
    try {
        const newBooking: Booking = {
            id: '', userId: currentUser.uid, hostName: currentUser.displayName || currentUser.email,
            mentorId: isP2P ? 'p2p-meeting' : selectedMentor!.id,
            mentorName: isP2P ? bookingMember!.displayName : selectedMentor!.title,
            mentorImage: isP2P ? (bookingMember!.photoURL || `https://ui-avatars.com/api/?name=${bookingMember!.displayName}`) : selectedMentor!.imageUrl,
            date: selectedDate, time: selectedTime, topic: topic, invitedEmail: isP2P ? bookingMember!.email : undefined,
            status: isP2P ? 'pending' : 'scheduled', type: isP2P ? 'p2p' : 'ai', createdAt: Date.now(),
            coinPrice: isP2P ? 50 : 0
        };
        await createBooking(newBooking);
        alert(isP2P ? "Request sent to mentor!" : "AI session booked!");
        setActiveTab('my_bookings');
        setSelectedMentor(null); setBookingMember(null); setTopic(''); setSelectedDate(''); setSelectedTime('');
    } catch(e) { alert("Booking failed."); } finally { setIsBooking(false); }
  };

  const handleCancel = async (id: string) => {
      if (!confirm("Cancel this session?")) return;
      await cancelBooking(id);
      loadBookings();
  };

  if (bookingMember || selectedMentor) {
      return (
        <div className="max-w-4xl mx-auto my-8 animate-fade-in-up">
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden">
                <div className="p-8 border-b border-slate-800 flex items-center gap-6 bg-slate-950/50">
                    <button onClick={() => { setSelectedMentor(null); setBookingMember(null); }} className="p-3 hover:bg-slate-800 rounded-2xl text-slate-400 transition-colors"><ArrowLeft size={24} /></button>
                    <img src={bookingMember ? (bookingMember.photoURL || `https://ui-avatars.com/api/?name=${bookingMember.displayName}`) : selectedMentor!.imageUrl} className="w-20 h-20 rounded-[2rem] border-4 border-indigo-500 shadow-xl" />
                    <div>
                        <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">{bookingMember ? bookingMember.displayName : selectedMentor!.title}</h2>
                        <p className="text-sm font-bold text-indigo-400 uppercase tracking-widest">{bookingMember ? 'Domain Expert' : 'AI Strategic Mentor'}</p>
                    </div>
                </div>
                <div className="p-10 space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-6">
                            <div><h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><Calendar size={14}/> Select Date</h3><div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">{[1,2,3,4,5,6,7].map(i => { const d = new Date(); d.setDate(d.getDate() + i); const ds = d.toISOString().split('T')[0]; return <button key={ds} onClick={() => setSelectedDate(ds)} className={`flex-shrink-0 w-20 p-4 rounded-2xl border flex flex-col items-center transition-all ${selectedDate === ds ? 'bg-indigo-600 border-indigo-500 text-white shadow-xl shadow-indigo-500/20 scale-105' : 'bg-slate-800 border-slate-700 text-slate-400'}`}><span className="text-[10px] font-black uppercase mb-1">{d.toLocaleDateString(undefined, {weekday:'short'})}</span><span className="text-lg font-black">{d.getDate()}</span></button>; })}</div></div>
                            <div><h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><Clock size={14}/> Select Time</h3><div className="grid grid-cols-4 gap-2">{TIME_SLOTS.map(time => <button key={time} onClick={() => setSelectedTime(time)} className={`py-3 rounded-xl text-xs font-black border transition-all ${selectedTime === time ? 'bg-emerald-600 border-emerald-500 text-white shadow-xl shadow-emerald-500/20' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'}`}>{time}</button>)}</div></div>
                        </div>
                        <div className="space-y-6">
                            <div><h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><Edit3 size={14}/> Session Topic</h3><textarea value={topic} onChange={e => setTopic(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-6 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none shadow-inner h-48" placeholder="What are your goals for this session?"/></div>
                            {bookingMember && <div className="bg-amber-900/20 border border-amber-500/30 p-4 rounded-2xl flex items-center gap-3"><Coins className="text-amber-400" size={20}/><div className="flex-1"><p className="text-xs font-bold text-white">Peer Session Fee: 50 Coins</p><p className="text-[9px] text-amber-200 opacity-60">Verified transfer via VoiceCoin Protocol.</p></div></div>}
                        </div>
                    </div>
                    <div className="pt-6 border-t border-slate-800 flex justify-end items-center gap-6">
                        <span className="text-xs text-slate-500 font-bold uppercase italic">Finalizing Neural Link...</span>
                        <button onClick={handleBookSession} disabled={isBooking || !selectedDate || !selectedTime || !topic} className="px-10 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-2xl transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:grayscale">{isBooking ? <Loader2 className="animate-spin" /> : 'Authorize Session'}</button>
                    </div>
                </div>
            </div>
        </div>
      );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 animate-fade-in space-y-10">
        <div className="flex flex-col md:flex-row justify-between items-end gap-6">
            <div>
                <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-2 flex items-center gap-3"><Briefcase className="text-indigo-500" size={36} /> Mentorship Hub</h1>
                <p className="text-slate-400 font-medium max-w-xl">Accelerate your growth. Connect with domain experts or leverage high-intelligence AI personas for technical guidance.</p>
            </div>
            <div className="flex bg-slate-900 rounded-2xl p-1 border border-slate-800 shadow-lg">
                <button onClick={() => setActiveTab('members')} className={`px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'members' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-white'}`}>Community</button>
                <button onClick={() => setActiveTab('ai_mentors')} className={`px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'ai_mentors' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-white'}`}>AI Mentors</button>
                <button onClick={() => setActiveTab('my_bookings')} className={`px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'my_bookings' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-white'}`}>Schedule</button>
            </div>
        </div>

        {activeTab === 'members' && (
            <div className="space-y-8">
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-xl flex flex-col md:flex-row items-center gap-8 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-12 bg-indigo-500/10 blur-[80px] rounded-full group-hover:bg-indigo-500/20 transition-all"></div>
                    <div className="p-6 bg-indigo-950/40 rounded-[2rem] border border-indigo-500/30 text-indigo-400 shrink-0"><HeartHandshake size={48} /></div>
                    <div className="flex-1 text-center md:text-left relative z-10">
                        <h3 className="text-xl font-bold text-white mb-2">Build a Shared Learning Network</h3>
                        <p className="text-slate-400 text-sm leading-relaxed max-w-2xl">AIVoiceCast is more than a player—it's an exchange of wisdom. Connect with experts across the community, join live coding sessions, and earn VoiceCoins by sharing your unique expertise.</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                        <input type="text" placeholder="Search by name, expertise, or keyword..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-12 pr-6 py-4 text-white focus:ring-2 focus:ring-indigo-500 outline-none shadow-inner"/>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {loadingMembers ? <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin mx-auto text-indigo-400" size={48}/></div> : filteredMembers.map(m => (
                        <div key={m.uid} className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] hover:border-indigo-500/50 transition-all group relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-16 bg-white/5 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="relative z-10 flex flex-col items-center text-center">
                                <div className="relative mb-6">
                                    {m.photoURL ? <img src={m.photoURL} className="w-20 h-20 rounded-[2rem] border-4 border-slate-800 shadow-xl object-cover" /> : <div className="w-20 h-20 rounded-[2rem] bg-slate-800 flex items-center justify-center text-slate-600 border-4 border-slate-800"><User size={40}/></div>}
                                    <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-1.5 rounded-full border-4 border-slate-900 shadow-lg"><CheckIcon size={12} strokeWidth={4}/></div>
                                </div>
                                <h3 className="text-xl font-bold text-white group-hover:text-indigo-400 transition-colors">{m.displayName}</h3>
                                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1 mb-6">Verified Creator</p>
                                <div className="flex flex-wrap justify-center gap-2 mb-8 h-10 overflow-hidden">{(m.interests || ['General AI', 'Research']).map(i => <span key={i} className="text-[9px] font-black uppercase bg-slate-950 text-slate-400 px-3 py-1 rounded-full border border-slate-800">#{i}</span>)}</div>
                                <button onClick={() => handleOpenBooking(m)} className="w-full py-4 bg-slate-950 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all border border-slate-800 hover:border-indigo-500 shadow-lg flex items-center justify-center gap-2 active:scale-95"><Coins size={14}/> Book Peer Session</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'ai_mentors' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {channels.filter(c => c.likes > 10).map(m => (
                    <div key={m.id} className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden hover:border-purple-500/50 transition-all group flex flex-col shadow-xl">
                        <div className="aspect-video relative"><img src={m.imageUrl} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" /><div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent" /></div>
                        <div className="p-8 flex-1 flex flex-col">
                            <h3 className="text-2xl font-bold text-white mb-2 italic uppercase tracking-tighter">{m.title}</h3>
                            <p className="text-sm text-slate-400 line-clamp-3 mb-8 flex-1 leading-relaxed">{m.description}</p>
                            <button onClick={() => { setSelectedMentor(m); setBookingMember(null); }} className="w-full py-4 bg-purple-600/10 hover:bg-purple-600 text-purple-400 hover:text-white rounded-2xl text-xs font-black uppercase tracking-widest border border-purple-500/30 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-xl shadow-purple-500/5"><Sparkles size={16}/> Start AI Mentorship</button>
                        </div>
                    </div>
                ))}
            </div>
        )}

        {activeTab === 'my_bookings' && (
            <div className="max-w-4xl mx-auto space-y-6">
                {isLoadingBookings ? <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-indigo-400" size={48}/></div> : myBookings.length === 0 ? (
                    <div className="py-32 text-center text-slate-500 bg-slate-900/30 border-2 border-dashed border-slate-800 rounded-[3rem] space-y-6">
                        <div className="w-20 h-20 bg-slate-900 rounded-[2rem] flex items-center justify-center mx-auto opacity-20"><Calendar size={40}/></div>
                        <div className="space-y-1"><p className="text-lg font-bold text-slate-400">Empty Schedule</p><p className="text-sm opacity-60">You haven't booked any interactive sessions yet.</p></div>
                        <button onClick={() => setActiveTab('members')} className="text-indigo-400 font-bold uppercase tracking-widest text-xs hover:underline">Browse Domain Experts</button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {myBookings.map(b => (
                            <div key={b.id} className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] flex flex-col md:flex-row items-center gap-6 group hover:border-indigo-500/30 transition-all shadow-xl">
                                <div className="bg-slate-950 p-5 rounded-[1.5rem] text-center min-w-[120px] border border-slate-800 shadow-inner">
                                    <span className="block text-2xl font-black text-white">{b.time}</span>
                                    <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{new Date(b.date).toLocaleDateString(undefined, {weekday:'short', month:'short', day:'numeric'})}</span>
                                </div>
                                <div className="flex-1 text-center md:text-left min-w-0">
                                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-1">
                                        <h4 className="text-lg font-bold text-white truncate">{b.mentorName}</h4>
                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest border ${b.status === 'scheduled' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-900/50' : 'bg-amber-900/30 text-amber-400 border-amber-900/50'}`}>{b.status}</span>
                                    </div>
                                    <p className="text-sm text-slate-400 truncate italic">"{b.topic}"</p>
                                </div>
                                <div className="flex gap-2">
                                    {b.status === 'scheduled' ? (
                                        <button onClick={() => onStartLiveSession(channels.find(c => c.id === b.mentorId) || channels[0], b.topic, true, b.id)} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-xl shadow-indigo-500/20 transition-all flex items-center gap-2 active:scale-95"><Play size={14} fill="currentColor"/> Join Session</button>
                                    ) : (
                                        <div className="text-xs text-slate-500 font-bold italic px-4">Pending Peer Acceptance...</div>
                                    )}
                                    <button onClick={() => handleCancel(b.id)} className="p-3 bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-400 rounded-xl border border-slate-700 transition-colors"><Trash2 size={18}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}
    </div>
  );
};
