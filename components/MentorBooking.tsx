
import React, { useState, useEffect, useMemo } from 'react';
import { Channel, Booking, UserProfile, UserAvailability } from '../types';
import { Calendar, Clock, User, ArrowLeft, Search, Briefcase, Sparkles, CheckCircle, X, Loader2, Play, Users, Mail, Video, Mic, FileText, Download, Trash2, Monitor, UserPlus, Grid, List, ArrowDown, ArrowUp, Heart, Share2, Info, ShieldAlert, ChevronRight, Coins, Check as CheckIcon, HeartHandshake, Edit3, Timer, Coffee, Sunrise, Sun, Sunset } from 'lucide-react';
import { auth } from '../services/firebaseConfig';
// Fix: removed updateBookingInvite which is not exported by firestoreService
import { createBooking, getUserBookings, cancelBooking, deleteBookingRecording, getAllUsers, getUserProfileByEmail, getUserProfile } from '../services/firestoreService';
import { getDriveToken, signInWithGoogle } from '../services/authService';
import { sendBookingEmail } from '../services/gmailService';

interface MentorBookingProps {
  currentUser: any;
  userProfile?: UserProfile | null;
  channels: Channel[]; 
  onStartLiveSession: (channel: Channel, context?: string, recordingEnabled?: boolean, bookingId?: string, videoEnabled?: boolean, cameraEnabled?: boolean, activeSegment?: { index: number, lectureId: string }) => void;
}

interface Slot {
    start: string;
    end: string;
    duration: 25 | 55;
    isBusy: boolean;
}

const DEFAULT_AVAILABILITY: UserAvailability = {
    enabled: true,
    startHour: 9,
    endHour: 18,
    days: [0, 1, 2, 3, 4, 5, 6]
};

export const MentorBooking: React.FC<MentorBookingProps> = ({ currentUser, userProfile, channels, onStartLiveSession }) => {
  const [activeTab, setActiveTab] = useState<'members' | 'ai_mentors' | 'my_bookings'>('members');
  const [selectedMentor, setSelectedMentor] = useState<Channel | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [topic, setTopic] = useState('');
  const [isBooking, setIsBooking] = useState(false);
  const [bookingMember, setBookingMember] = useState<UserProfile | null>(null);
  
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [mentorBookings, setMentorBookings] = useState<Booking[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [duration, setDuration] = useState<25 | 55>(25);

  useEffect(() => {
    if (activeTab === 'my_bookings') loadBookings();
    if (activeTab === 'members') loadMembers();
  }, [activeTab, currentUser]);

  useEffect(() => {
    const targetUid = bookingMember?.uid || selectedMentor?.id;
    const targetEmail = bookingMember?.email || 'ai-mentor@aivoicecast.com';

    if (targetUid && selectedDate) {
        setIsLoadingBookings(true);
        getUserBookings(targetUid, targetEmail).then(data => {
            setMentorBookings(data);
            setIsLoadingBookings(false);
        });
    }
  }, [bookingMember, selectedMentor, selectedDate]);

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
      // Keep everyone including current user so they can test their own booking page
      setMembers(users);
    } catch(e) { console.error(e); } finally { setLoadingMembers(false); }
  };

  const filteredMembers = useMemo(() => {
    return members.filter(m => m.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || m.email?.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [members, searchQuery]);

  // Reactive Availability: Deep merge defaults to avoid :00 - :00 display
  const currentTargetAvailability = useMemo(() => {
      const isSelf = currentUser && bookingMember?.uid === currentUser.uid;
      const target = isSelf ? userProfile : bookingMember;
      
      if (!bookingMember && selectedMentor) {
          return { ...DEFAULT_AVAILABILITY, startHour: 0, endHour: 23 };
      }

      const rawAvail = target?.availability;
      if (!rawAvail) return DEFAULT_AVAILABILITY;

      // Deep Merge: ensure properties like startHour exist even if object is partial
      return {
          enabled: rawAvail.enabled ?? DEFAULT_AVAILABILITY.enabled,
          startHour: typeof rawAvail.startHour === 'number' ? rawAvail.startHour : DEFAULT_AVAILABILITY.startHour,
          endHour: typeof rawAvail.endHour === 'number' ? rawAvail.endHour : DEFAULT_AVAILABILITY.endHour,
          days: Array.isArray(rawAvail.days) ? rawAvail.days : DEFAULT_AVAILABILITY.days
      };
  }, [bookingMember, selectedMentor, userProfile, currentUser]);

  const availableSlots = useMemo(() => {
      if (!selectedDate) return [];
      
      const dateParts = selectedDate.split('-');
      const d = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]), 12, 0, 0);
      const dayOfWeek = d.getDay();
      
      const availability = currentTargetAvailability;
      const activeDays = availability.days || [0, 1, 2, 3, 4, 5, 6];
      
      if (!availability.enabled || !activeDays.includes(dayOfWeek)) return [];

      const slots: Slot[] = [];
      const startH = availability.startHour;
      const endH = availability.endHour;

      for (let h = startH; h < endH; h++) {
          const hourStr = h.toString().padStart(2, '0');
          if (duration === 25) {
              slots.push({ start: `${hourStr}:05`, end: `${hourStr}:30`, duration: 25, isBusy: false });
              slots.push({ start: `${hourStr}:35`, end: `${(h + (35+25 >= 60 ? 1 : 0)).toString().padStart(2, '0')}:00`, duration: 25, isBusy: false });
          } else {
              slots.push({ start: `${hourStr}:05`, end: `${(h + 1).toString().padStart(2, '0')}:00`, duration: 55, isBusy: false });
              slots.push({ start: `${hourStr}:35`, end: `${(h + 1).toString().padStart(2, '0')}:30`, duration: 55, isBusy: false });
          }
      }

      return slots.map(s => {
          const isBusy = mentorBookings.some(b => b.date === selectedDate && b.time === s.start);
          return { ...s, isBusy };
      });
  }, [currentTargetAvailability, selectedDate, duration, mentorBookings]);

  const groupedSlots = useMemo(() => {
      const groups = { morning: [] as Slot[], afternoon: [] as Slot[], evening: [] as Slot[] };
      availableSlots.forEach(s => {
          const h = parseInt(s.start.split(':')[0]);
          if (h < 12) groups.morning.push(s);
          else if (h < 17) groups.afternoon.push(s);
          else groups.evening.push(s);
      });
      return groups;
  }, [availableSlots]);

  const handleOpenBooking = (member: UserProfile) => {
      setBookingMember(member);
      setSelectedMentor(null);
      setSelectedSlot(null);
  };

  const handleBookSession = async () => {
    if (!currentUser || !selectedDate || !selectedSlot || !topic.trim()) {
        alert("Please select a date, time slot, and provide a topic.");
        return;
    }
    const isP2P = !!bookingMember;
    
    setIsBooking(true);
    try {
        const newBooking: Booking = {
            id: '', userId: currentUser.uid, hostName: currentUser.displayName || currentUser.email,
            mentorId: isP2P ? bookingMember!.uid : selectedMentor!.id,
            mentorName: isP2P ? bookingMember!.displayName : selectedMentor!.title,
            mentorImage: isP2P ? (bookingMember!.photoURL || `https://ui-avatars.com/api/?name=${bookingMember!.displayName}`) : selectedMentor!.imageUrl,
            date: selectedDate, time: selectedSlot.start, duration: selectedSlot.duration, endTime: selectedSlot.end, topic: topic, 
            invitedEmail: isP2P ? bookingMember!.email : undefined,
            status: isP2P ? 'pending' : 'scheduled', type: isP2P ? 'p2p' : 'ai', createdAt: Date.now(),
            coinPrice: isP2P ? 50 : 0
        };
        const bookingId = await createBooking(newBooking);
        newBooking.id = bookingId;

        const token = getDriveToken();
        if (token) {
            // SEND TO HOST
            await sendBookingEmail(token, newBooking, currentUser.email, currentUser.displayName || 'Host', true);
            
            // SEND TO MENTOR (If Peer-to-Peer)
            if (isP2P && bookingMember?.email) {
                await sendBookingEmail(token, newBooking, bookingMember.email, bookingMember.displayName, false);
            }
        }

        alert(isP2P ? "Request sent! Notification emails dispatched to both parties." : "AI session booked! Confirmation sent to your inbox.");
        setActiveTab('my_bookings');
        setSelectedMentor(null); setBookingMember(null); setTopic(''); setSelectedSlot(null);
    } catch(e) { 
        console.error(e);
        alert("Booking failed."); 
    } finally { setIsBooking(false); }
  };

  const handleCancel = async (id: string) => {
      if (!confirm("Cancel this session?")) return;
      await cancelBooking(id);
      loadBookings();
  };

  if (bookingMember || selectedMentor) {
      const isSelf = currentUser && bookingMember?.uid === currentUser.uid;
      const activeDaysArray = currentTargetAvailability.days || [0, 1, 2, 3, 4, 5, 6];
      const daysStr = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].filter((_, i) => activeDaysArray.includes(i)).join(', ');
      
      // Formatting hours for display to avoid ":00"
      const startDisplay = `${currentTargetAvailability.startHour}:00`;
      const endDisplay = `${currentTargetAvailability.endHour}:00`;

      return (
        <div className="max-w-5xl mx-auto my-8 animate-fade-in-up">
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden">
                <div className="p-8 border-b border-slate-800 flex items-center gap-6 bg-slate-950/50">
                    <button onClick={() => { setSelectedMentor(null); setBookingMember(null); }} className="p-3 hover:bg-slate-800 rounded-2xl text-slate-400 transition-colors"><ArrowLeft size={24} /></button>
                    <img src={bookingMember ? (bookingMember.photoURL || `https://ui-avatars.com/api/?name=${bookingMember.displayName}`) : selectedMentor!.imageUrl} className="w-20 h-20 rounded-[2rem] border-4 border-indigo-500 shadow-xl object-cover" />
                    <div className="flex-1">
                        <div className="flex items-center gap-3">
                            <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">{bookingMember ? (isSelf ? 'My Availability (Live)' : bookingMember.displayName) : selectedMentor!.title}</h2>
                            {isSelf && <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase shadow-lg shadow-emerald-900/40">Synced</span>}
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                            <p className="text-sm font-bold text-indigo-400 uppercase tracking-widest">{bookingMember ? (isSelf ? 'Member Profile Preview' : 'Domain Expert') : 'AI Strategic Mentor'}</p>
                            <div className="h-4 w-px bg-slate-800"></div>
                            <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                <Clock size={12} className="text-emerald-500"/>
                                <span>{startDisplay} - {endDisplay} ({daysStr})</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="p-8 md:p-12 space-y-10">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                        <div className="lg:col-span-7 space-y-10">
                            <div>
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><Calendar size={14}/> 1. Select Date</h3>
                                <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
                                    {[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14].map(i => { 
                                        const d = new Date(); d.setDate(d.getDate() + i); 
                                        const ds = d.toISOString().split('T')[0]; 
                                        return (
                                            <button key={ds} onClick={() => { setSelectedDate(ds); setSelectedSlot(null); }} className={`flex-shrink-0 w-24 p-5 rounded-[1.5rem] border-2 flex flex-col items-center transition-all ${selectedDate === ds ? 'bg-indigo-600 border-indigo-500 text-white shadow-2xl shadow-indigo-500/20 scale-105' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                                                <span className="text-[10px] font-black uppercase mb-1">{d.toLocaleDateString(undefined, {weekday:'short'})}</span>
                                                <span className="text-xl font-black">{d.getDate()}</span>
                                                <span className="text-[8px] font-bold uppercase mt-1 opacity-60">{d.toLocaleDateString(undefined, {month:'short'})}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            
                            <div className="space-y-6">
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2"><Timer size={14}/> 2. Session Type</h3>
                                <div className="flex p-1.5 bg-slate-950 rounded-2xl border border-slate-800 shadow-inner max-w-sm">
                                    <button onClick={() => setDuration(25)} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all ${duration === 25 ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Focus (25m)</button>
                                    <button onClick={() => setDuration(55)} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all ${duration === 55 ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Deep Dive (55m)</button>
                                </div>
                                
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2"><Clock size={14}/> 3. Select Time Slot</h3>
                                
                                {isLoadingBookings ? (
                                    <div className="py-20 flex flex-col items-center justify-center gap-4">
                                        <Loader2 className="animate-spin text-indigo-400" size={32} />
                                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Checking Availability...</span>
                                    </div>
                                ) : availableSlots.length === 0 ? (
                                    <div className="text-xs text-slate-500 italic p-12 text-center border-2 border-dashed border-slate-800 rounded-[2rem] bg-slate-900/20">
                                        <div className="flex flex-col items-center gap-3">
                                            <ShieldAlert size={32} className="text-slate-700"/>
                                            <p>Member is currently away or outside office hours on this date.</p>
                                            <div className="mt-4 p-4 bg-slate-950 rounded-2xl border border-slate-800">
                                                <p className="text-[10px] font-black uppercase text-indigo-400 tracking-widest mb-1">Current detected availability:</p>
                                                <p className="text-xs text-slate-300 uppercase font-bold">{daysStr}</p>
                                                <p className="text-xl font-black text-white mt-1">{startDisplay} - {endDisplay}</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-8 animate-fade-in">
                                        {[
                                            { id: 'morning', label: 'Morning', icon: Sunrise, slots: groupedSlots.morning },
                                            { id: 'afternoon', label: 'Afternoon', icon: Sun, slots: groupedSlots.afternoon },
                                            { id: 'evening', label: 'Evening', icon: Sunset, slots: groupedSlots.evening }
                                        ].map(group => group.slots.length > 0 && (
                                            <div key={group.id} className="space-y-4">
                                                <div className="flex items-center gap-2 px-1">
                                                    <group.icon size={14} className="text-slate-500" />
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{group.label}</span>
                                                </div>
                                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                                                    {group.slots.map(slot => (
                                                        <button 
                                                            key={slot.start} 
                                                            disabled={slot.isBusy}
                                                            onClick={() => setSelectedSlot(slot)} 
                                                            className={`py-3 rounded-xl text-[10px] font-black border transition-all ${slot.isBusy ? 'bg-slate-900 border-slate-800 text-slate-700 cursor-not-allowed grayscale' : selectedSlot?.start === slot.start ? 'bg-emerald-600 border-emerald-500 text-white shadow-xl shadow-emerald-500/20 scale-105' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-indigo-500 hover:text-white hover:bg-slate-700'}`}
                                                        >
                                                            {slot.isBusy ? 'BUSY' : slot.start}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                
                                <div className="flex flex-wrap items-center gap-6 text-[10px] font-bold uppercase tracking-widest text-slate-600 pt-4">
                                    <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-md bg-emerald-500"></div> Available</span>
                                    <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-md bg-slate-900 border border-slate-800"></div> Busy</span>
                                    <span className="flex items-center gap-2"><Coffee size={12} className="text-amber-500"/> 5m Cooldown period enforced</span>
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-5 space-y-8">
                            <div className="bg-slate-950 p-8 rounded-[2rem] border border-slate-800 shadow-inner space-y-6">
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2"><Edit3 size={14}/> 4. Session Context</h3>
                                <textarea 
                                    value={topic} 
                                    onChange={e => setTopic(e.target.value)} 
                                    className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-6 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none shadow-2xl h-64 transition-all" 
                                    placeholder="What are the specific goals or technical problems you want to address in this session?"
                                />
                                
                                {bookingMember && !isSelf && (
                                    <div className="bg-amber-900/10 border border-amber-500/20 p-5 rounded-2xl flex items-center gap-4 animate-fade-in">
                                        <div className="p-3 bg-amber-500 text-white rounded-xl shadow-lg shadow-amber-500/20">
                                            <Coins size={20} fill="currentColor"/>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-white">Peer Honorarium: 50 Coins</p>
                                            <p className="text-[10px] text-amber-500 font-bold uppercase tracking-tighter">VoiceCoin Ledger Secure Transfer</p>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-4 pt-4">
                                    <button 
                                        onClick={handleBookSession} 
                                        disabled={isBooking || !selectedDate || !selectedSlot || !topic} 
                                        className="w-full py-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-2xl shadow-indigo-900/40 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:grayscale"
                                    >
                                        {isBooking ? <Loader2 className="animate-spin mx-auto" /> : isSelf ? 'Lock Personal Focus Slot' : 'Authorize & Book Session'}
                                    </button>
                                    <p className="text-[9px] text-slate-500 text-center uppercase font-black tracking-widest">
                                        By clicking, you initiate the neural handshake protocol
                                    </p>
                                </div>
                            </div>
                        </div>
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
                        {userProfile && (
                            <button onClick={() => handleOpenBooking(userProfile)} className="mt-4 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg transition-all active:scale-95">Set My Own Availability</button>
                        )}
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
                                <button onClick={() => handleOpenBooking(m)} className="w-full py-4 bg-slate-950 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all border border-slate-800 hover:border-indigo-500 shadow-lg flex items-center justify-center gap-2 active:scale-95"><Coins size={14}/> View Availability</button>
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
                            <button onClick={() => { setSelectedMentor(m); setBookingMember(null); setSelectedSlot(null); }} className="w-full py-4 bg-purple-600/10 hover:bg-purple-600 text-purple-400 hover:text-white rounded-2xl text-xs font-black uppercase tracking-widest border border-purple-500/30 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-xl shadow-purple-500/5"><Sparkles size={16}/> Start AI Mentorship</button>
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
                                    <p className="text-[10px] text-indigo-400 font-bold uppercase mt-1">{b.duration}m Session (Ends {b.endTime})</p>
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
