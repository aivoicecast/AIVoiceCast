
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Channel, Booking, UserProfile, UserAvailability } from '../types';
import { Calendar, Clock, User, ArrowLeft, Search, Briefcase, Sparkles, CheckCircle, X, Loader2, Play, Users, Mail, Video, Mic, FileText, Download, Trash2, Monitor, UserPlus, Grid, List, ArrowDown, ArrowUp, Heart, Share2, Info, ShieldAlert, ChevronRight, Coins, Check as CheckIcon, HeartHandshake, Edit3, Timer, Coffee, Sunrise, Sun, Sunset, Hash, Star, ShieldCheck, MoreHorizontal, Zap, Bot, ChevronLeft, RefreshCw } from 'lucide-react';
import { auth } from '../services/firebaseConfig';
import { createBooking, getUserBookings, cancelBooking, getAllUsers, getUserProfile } from '../services/firestoreService';
import { getDriveToken, connectGoogleDrive } from '../services/authService';
import { sendBookingEmail } from '../services/gmailService';
import { generateSecureId } from '../utils/idUtils';

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

const SafeAvatar = ({ src, name, icon: Icon = User }: { src?: string, name: string, icon?: any }) => {
    const isThirdParty = (url?: string) => {
        if (!url) return true;
        const lowUrl = url.toLowerCase();
        return (
            lowUrl.includes('ui-avatars.com') || 
            lowUrl.includes('placehold.co') || 
            lowUrl.includes('placeholder') || 
            lowUrl.includes('dummyimage.com') ||
            lowUrl.includes('pravatar.cc')
        );
    };

    const initials = (name || 'U').split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const hasValidSrc = src && !isThirdParty(src);

    return (
        <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-lg">
            {hasValidSrc ? (
                <img src={src} alt={name} className="w-full h-full object-cover" />
            ) : (
                <span className="text-xs font-black text-indigo-400">{initials}</span>
            )}
        </div>
    );
};

export const MentorBooking: React.FC<MentorBookingProps> = ({ 
  currentUser, userProfile, channels, onStartLiveSession 
}) => {
    const [view, setView] = useState<'mentors' | 'calendar' | 'bookings'>('mentors');
    const [mentors, setMentors] = useState<UserProfile[]>([]);
    const [selectedMentor, setSelectedMentor] = useState<UserProfile | null>(null);
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [userBookings, setUserBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(false);
    const [bookingInProgress, setBookingInProgress] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const loadData = useCallback(async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            const [users, bookings] = await Promise.all([
                getAllUsers(),
                getUserBookings(currentUser.uid, currentUser.email)
            ]);
            setMentors(users.filter(u => u.uid !== currentUser.uid));
            setUserBookings(bookings.sort((a, b) => b.createdAt - a.createdAt));
        } catch (e) {
            console.error("Failed to load mentorship data", e);
        } finally {
            setLoading(false);
        }
    }, [currentUser]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const filteredMentors = useMemo(() => {
        if (!searchQuery.trim()) return mentors;
        const q = searchQuery.toLowerCase();
        return mentors.filter(m => 
            (m.displayName || '').toLowerCase().includes(q) || 
            (m.headline || '').toLowerCase().includes(q) ||
            (m.interests || []).some(i => (i || '').toLowerCase().includes(q))
        );
    }, [mentors, searchQuery]);

    const slots = useMemo(() => {
        if (!selectedMentor) return [];
        const avail = selectedMentor.availability || DEFAULT_AVAILABILITY;
        const dayOfWeek = new Date(selectedDate).getDay();
        
        if (!avail.enabled || !avail.days.includes(dayOfWeek)) return [];

        const daySlots: Slot[] = [];
        const existing = userBookings.filter(b => b.date === selectedDate && b.mentorId === selectedMentor.uid && b.status !== 'cancelled');

        for (let h = avail.startHour; h < avail.endHour; h++) {
            ['00', '30'].forEach(m => {
                const time = `${h.toString().padStart(2, '0')}:${m}`;
                const isBusy = existing.some(b => b.time === time);
                daySlots.push({ start: time, end: '', duration: 25, isBusy });
            });
        }
        return daySlots;
    }, [selectedMentor, selectedDate, userBookings]);

    const handleBookSlot = async (slot: Slot) => {
        if (!selectedMentor || !currentUser) return;
        setBookingInProgress(true);
        
        const bookingId = generateSecureId();
        const endTimeStr = (time: string, dur: number) => {
            const [h, m] = time.split(':').map(Number);
            const total = h * 60 + m + dur;
            return `${Math.floor(total/60).toString().padStart(2, '0')}:${(total%60).toString().padStart(2, '0')}`;
        };

        const newBooking: Booking = {
            id: bookingId,
            userId: currentUser.uid,
            hostName: currentUser.displayName || 'Learner',
            mentorId: selectedMentor.uid,
            mentorName: selectedMentor.displayName,
            mentorImage: selectedMentor.photoURL,
            date: selectedDate,
            time: slot.start,
            duration: slot.duration,
            endTime: endTimeStr(slot.start, slot.duration),
            topic: `Mentorship with ${selectedMentor.displayName}`,
            invitedEmail: selectedMentor.email,
            status: 'pending',
            type: 'p2p',
            createdAt: Date.now()
        };

        try {
            await createBooking(newBooking);
            
            // Gmail Notification
            const token = getDriveToken();
            if (token) {
                await sendBookingEmail(token, newBooking, selectedMentor.email, selectedMentor.displayName, false);
                await sendBookingEmail(token, newBooking, currentUser.email, currentUser.displayName, true);
            }

            alert("Handshake dispatched to neural ledger. Awaiting mentor confirmation.");
            setView('bookings');
            loadData();
        } catch (e) {
            alert("Booking failed. Please check ledger balance.");
        } finally {
            setBookingInProgress(false);
        }
    };

    const handleCancel = async (id: string) => {
        if (!confirm("Cancel this session?")) return;
        try {
            await cancelBooking(id);
            loadData();
        } catch (e) {
            alert("Cancellation failed.");
        }
    };

    const handleStartSession = (booking: Booking) => {
        // Find a matching channel for the persona, or use default
        const mentorChannel = channels.find(c => c.ownerId === booking.mentorId) || channels[0];
        onStartLiveSession(mentorChannel, `Context: Mentorship session about ${booking.topic}`, true, booking.id);
    };

    return (
        <div className="h-full bg-slate-950 text-slate-100 flex flex-col font-sans animate-fade-in">
            <header className="p-6 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md flex items-center justify-between shrink-0 z-10">
                <div className="flex items-center gap-4">
                    {view !== 'mentors' ? (
                        <button onClick={() => setView('mentors')} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
                            <ArrowLeft size={20} />
                        </button>
                    ) : (
                        <div className="p-2 bg-indigo-600/10 rounded-lg text-indigo-400 border border-indigo-500/20">
                            <Users size={20}/>
                        </div>
                    )}
                    <div>
                        <h1 className="text-xl font-black italic uppercase tracking-tighter text-white">Expert Hub</h1>
                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Connect & Refract Knowledge</p>
                    </div>
                </div>
                <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
                    <button onClick={() => setView('mentors')} className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${view === 'mentors' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Explore</button>
                    <button onClick={() => setView('bookings')} className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${view === 'bookings' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Schedule</button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                <div className="max-w-6xl mx-auto h-full">
                    {view === 'mentors' && (
                        <div className="space-y-8 animate-fade-in-up">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                                <input 
                                    type="text" 
                                    placeholder="Search by expertise, name, or stack..." 
                                    className="w-full bg-slate-900 border border-slate-800 rounded-3xl pl-12 pr-6 py-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-inner"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {loading ? (
                                    <div className="col-span-full py-20 flex flex-col items-center gap-4 text-indigo-400">
                                        <Loader2 className="animate-spin" size={32}/>
                                        <p className="text-[10px] font-black uppercase tracking-widest">Scanning Directory...</p>
                                    </div>
                                ) : filteredMentors.length === 0 ? (
                                    <div className="col-span-full py-20 text-center text-slate-600 italic">No experts found matching your query.</div>
                                ) : (
                                    filteredMentors.map(mentor => (
                                        <div key={mentor.uid} className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 hover:border-indigo-500/40 transition-all group relative overflow-hidden shadow-xl">
                                            <div className="absolute top-0 right-0 p-12 bg-indigo-500/5 blur-3xl rounded-full group-hover:bg-indigo-500/10 transition-colors"></div>
                                            <div className="relative z-10 flex flex-col h-full">
                                                <div className="flex items-start justify-between mb-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-16 h-16 rounded-3xl bg-slate-800 border-2 border-slate-700 overflow-hidden shadow-lg group-hover:scale-105 transition-transform duration-500">
                                                            {mentor.photoURL ? <img src={mentor.photoURL} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl font-black text-indigo-400">{(mentor.displayName || 'U')[0]}</div>}
                                                        </div>
                                                        <div>
                                                            <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">@{mentor.displayName}</h3>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                                                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Available</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button className="p-2 text-slate-600 hover:text-white transition-colors"><MoreHorizontal/></button>
                                                </div>
                                                <p className="text-xs text-slate-400 font-medium leading-relaxed mb-6 line-clamp-2">{mentor.headline || mentor.resumeText || 'Expert Mentor at Neural Prism'}</p>
                                                <div className="flex flex-wrap gap-2 mb-8">
                                                    {(mentor.interests || ['General AI', 'Software']).slice(0, 3).map(tag => (
                                                        <span key={tag} className="px-3 py-1 bg-slate-950 border border-slate-800 rounded-full text-[9px] font-black uppercase text-slate-500 tracking-tighter">#{tag}</span>
                                                    ))}
                                                </div>
                                                <button 
                                                    onClick={() => { setSelectedMentor(mentor); setView('calendar'); }}
                                                    className="mt-auto w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-900/30 transition-all active:scale-95"
                                                >
                                                    View Calendar
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {view === 'calendar' && selectedMentor && (
                        <div className="max-w-2xl mx-auto space-y-10 animate-fade-in-up">
                            <div className="flex items-center gap-6">
                                <div className="w-20 h-20 rounded-[2rem] bg-slate-900 border-2 border-indigo-500/30 overflow-hidden shadow-2xl">
                                    {selectedMentor.photoURL ? <img src={selectedMentor.photoURL} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-3xl font-black text-indigo-400">{(selectedMentor.displayName || 'U')[0]}</div>}
                                </div>
                                <div>
                                    <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">Book with @{ (selectedMentor.displayName || '').split(' ')[0]}</h2>
                                    <p className="text-indigo-400 text-xs font-bold uppercase tracking-[0.3em] mt-2">Neural Handshake Protocol Active</p>
                                </div>
                            </div>

                            <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-8 shadow-2xl space-y-8">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Select Date</label>
                                        <div className="relative">
                                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400" size={18}/>
                                            <input 
                                                type="date" 
                                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-4 py-4 text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                                                value={selectedDate}
                                                onChange={e => setSelectedDate(e.target.value)}
                                                min={new Date().toISOString().split('T')[0]}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Duration</label>
                                        <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
                                            <button className="flex-1 py-3 rounded-xl text-xs font-black bg-indigo-600 text-white shadow-lg">25 MIN</button>
                                            <button className="flex-1 py-3 rounded-xl text-xs font-black text-slate-500 hover:text-white transition-colors">55 MIN</button>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1 flex items-center gap-2">
                                        <Clock size={14} className="text-indigo-400"/> Available Time Windows
                                    </label>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                        {slots.length === 0 ? (
                                            <div className="col-span-full py-10 text-center bg-slate-950/50 rounded-2xl border border-slate-800">
                                                <p className="text-xs text-slate-600 font-bold uppercase tracking-widest italic">No slots available for this date</p>
                                            </div>
                                        ) : (
                                            slots.map((slot, i) => (
                                                <button 
                                                    key={i} 
                                                    disabled={slot.isBusy || bookingInProgress}
                                                    onClick={() => handleBookSlot(slot)}
                                                    className={`py-4 rounded-2xl text-xs font-black tracking-tighter border transition-all active:scale-95 ${slot.isBusy ? 'bg-slate-950 border-slate-800 text-slate-800 cursor-not-allowed' : 'bg-slate-900 border-slate-800 text-indigo-400 hover:bg-indigo-600 hover:text-white hover:border-indigo-400 shadow-md'}`}
                                                >
                                                    {slot.start}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {view === 'bookings' && (
                        <div className="space-y-8 animate-fade-in-up h-full flex flex-col">
                            <div className="flex items-center justify-between">
                                <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">Your Agenda</h2>
                                <button onClick={loadData} className="p-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 hover:text-white transition-all"><RefreshCw size={20}/></button>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-4 overflow-y-auto pr-2 scrollbar-hide">
                                {userBookings.length === 0 ? (
                                    <div className="py-32 flex flex-col items-center justify-center text-slate-600 gap-6">
                                        <Timer size={64} className="opacity-10"/>
                                        <p className="text-sm font-bold uppercase tracking-widest">No scheduled activities</p>
                                    </div>
                                ) : (
                                    userBookings.map(b => (
                                        <div key={b.id} className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 flex flex-col sm:flex-row items-center justify-between gap-8 hover:border-indigo-500/30 transition-all shadow-xl relative overflow-hidden group">
                                            <div className="flex items-center gap-6 flex-1 min-w-0">
                                                <div className="w-16 h-16 rounded-[1.5rem] bg-slate-950 border border-slate-800 overflow-hidden shadow-lg shrink-0">
                                                    {b.mentorImage ? <img src={b.mentorImage} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xl font-black text-indigo-400">{(b.mentorName || 'M')[0]}</div>}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h3 className="text-lg font-bold text-white truncate">{b.topic}</h3>
                                                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${b.status === 'scheduled' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-500/30' : b.status === 'pending' ? 'bg-amber-900/30 text-amber-400 border-amber-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>{b.status}</span>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                                                        <span className="flex items-center gap-1.5"><Calendar size={14} className="text-indigo-400"/> {b.date}</span>
                                                        <span className="flex items-center gap-1.5"><Clock size={14} className="text-indigo-400"/> {b.time}</span>
                                                        <span className="hidden sm:inline text-[10px] text-slate-600 font-mono">ID: {b.id.substring(0,8)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0">
                                                {b.status === 'scheduled' && (
                                                    <button onClick={() => handleStartSession(b)} className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 flex items-center gap-2">
                                                        <Play size={16} fill="currentColor"/> Launch Studio
                                                    </button>
                                                )}
                                                <button onClick={() => handleCancel(b.id)} className="p-3 bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-400 rounded-xl transition-all"><Trash2 size={20}/></button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
