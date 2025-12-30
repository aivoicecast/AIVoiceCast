
import React, { useState, useEffect, useMemo } from 'react';
import { Channel, Booking, UserProfile } from '../types';
import { Calendar, Clock, User, ArrowLeft, Search, Briefcase, Sparkles, CheckCircle, X, Loader2, Play, Users, Mail, Video, Mic, FileText, Download, Trash2, Monitor, UserPlus, Grid, List, ArrowDown, ArrowUp, Heart, Share2, Info, ShieldAlert } from 'lucide-react';
import { auth } from '../services/firebaseConfig';
import { createBooking, getUserBookings, cancelBooking, sendInvitation, getPendingInvitations, updateBookingInvite, deleteBookingRecording, getAllUsers, getUserProfileByEmail } from '../services/firestoreService';

interface MentorBookingProps {
  currentUser: any;
  channels: Channel[]; // Using channels as the source for "Mentors"
  onStartLiveSession: (channel: Channel, context?: string, recordingEnabled?: boolean, bookingId?: string, videoEnabled?: boolean, cameraEnabled?: boolean) => void;
}

const TIME_SLOTS = [
  '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '19:00', '20:00'
];

type SortKey = 'displayName' | 'email' | 'createdAt';

export const MentorBooking: React.FC<MentorBookingProps> = ({ currentUser, channels, onStartLiveSession }) => {
  const [activeTab, setActiveTab] = useState<'members' | 'ai_mentors' | 'my_bookings'>('members');
  const [selectedMentor, setSelectedMentor] = useState<Channel | null>(null);
  
  // Booking Form State
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [topic, setTopic] = useState('');
  const [inviteEmail, setInviteEmail] = useState(''); // Used for Guest in AI or Invitee in P2P
  const [isBooking, setIsBooking] = useState(false);
  const [bookingMember, setBookingMember] = useState<UserProfile | null>(null);
  
  // My Bookings State
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);
  const [playingBookingId, setPlayingBookingId] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Members Directory State
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  // View mode removed - defaulting to Table view always
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'createdAt', direction: 'desc' });
  const [isSearchingServer, setIsSearchingServer] = useState(false);

  // Session Start Modal State
  const [sessionStartBooking, setSessionStartBooking] = useState<Booking | null>(null);
  const [recordMeeting, setRecordMeeting] = useState(false);
  const [recordScreen, setRecordScreen] = useState(false);
  const [recordCamera, setRecordCamera] = useState(false);
  const [extraGuestEmail, setExtraGuestEmail] = useState('');
  const [isSendingInvite, setIsSendingInvite] = useState(false);

  // Filter AI mentors (handcrafted only to ensure quality, or high rated)
  const aiMentors = channels.filter(c => c.likes > 20 || !Number.isNaN(Number(c.id)) === false); 

  // Privacy Check: Only super admin can see emails list or search by email
  const isAdmin = currentUser?.email === 'shengliang.song@gmail.com';

  useEffect(() => {
    if (activeTab === 'my_bookings' && currentUser) {
      loadBookings();
    }
    if (activeTab === 'members') {
      loadMembers();
    }
  }, [activeTab, currentUser]);

  // Server-side search debouncer
  useEffect(() => {
      const delayDebounceFn = setTimeout(async () => {
        // Privacy: Only admins can search by email to probe the database
        if (isAdmin && searchQuery.includes('@') && searchQuery.length > 5) {
             // Check if already in list
             const exists = members.some(m => m.email.toLowerCase() === searchQuery.toLowerCase());
             if (!exists) {
                 setIsSearchingServer(true);
                 const user = await getUserProfileByEmail(searchQuery);
                 if (user) {
                     setMembers(prev => {
                         if (prev.some(m => m.uid === user.uid)) return prev;
                         return [user, ...prev];
                     });
                 }
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
    } catch(e) {
      console.error(e);
    } finally {
      setIsLoadingBookings(false);
    }
  };

  const loadMembers = async () => {
    setLoadingMembers(true);
    try {
      const users = await getAllUsers();
      // Filter out self if logged in
      const filtered = currentUser ? users.filter(u => u.uid !== currentUser.uid) : users;
      setMembers(filtered);
    } catch(e) {
      console.error(e);
    } finally {
      setLoadingMembers(false);
    }
  };

  const filteredMembers = useMemo(() => {
    let result = [...members];
    
    // SKIP INVALID EMAILS (Must contain '@')
    result = result.filter(m => m.email && m.email.includes('@'));

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(m => 
        (m.displayName && m.displayName.toLowerCase().includes(q)) || 
        // Only search locally by email if admin, otherwise block it
        (isAdmin && m.email && m.email.toLowerCase().includes(q))
      );
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

  const handleSort = (key: SortKey) => {
    setSortConfig(current => ({
        key,
        direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const handleBookSession = async () => {
    if (!currentUser) {
        alert("Please sign in to book a session.");
        return;
    }
    if (!selectedDate || !selectedTime || !topic.trim()) {
        alert("Please fill in all fields.");
        return;
    }

    // Determine type (AI Mentor or P2P)
    const isP2P = !!bookingMember;
    const targetEmail = isP2P ? bookingMember!.email : inviteEmail;
    
    if (isP2P && !targetEmail) {
        alert("Selected member has no email address.");
        return;
    }

    setIsBooking(true);
    try {
        const newBooking: Booking = {
            id: '', // set by firestore
            userId: currentUser.uid,
            hostName: currentUser.displayName || currentUser.email,
            mentorId: isP2P ? 'p2p-meeting' : selectedMentor!.id,
            mentorName: isP2P ? `Meeting with ${bookingMember!.displayName}` : selectedMentor!.title,
            mentorImage: isP2P ? (bookingMember!.photoURL || 'https://ui-avatars.com/api/?name=' + bookingMember!.displayName) : selectedMentor!.imageUrl,
            date: selectedDate,
            time: selectedTime,
            topic: topic,
            invitedEmail: targetEmail,
            status: isP2P ? 'pending' : 'scheduled',
            type: isP2P ? 'p2p' : 'ai',
            createdAt: Date.now()
        };
        
        await createBooking(newBooking);
        alert(isP2P ? "Meeting request sent! Waiting for acceptance." : "Session Booked Successfully!");
        setActiveTab('my_bookings');
        
        // Reset
        setSelectedMentor(null);
        setBookingMember(null);
        setTopic('');
        setInviteEmail('');
        setSelectedDate('');
        setSelectedTime('');
    } catch(e) {
        alert("Failed to book session.");
        console.error(e);
    } finally {
        setIsBooking(false);
    }
  };

  const handleOpenBooking = (member: UserProfile) => {
      setBookingMember(member);
      // We pass the email to state for booking logic, but UI might hide it
      setInviteEmail(member.email);
      setTopic('');
      setSelectedDate('');
      setSelectedTime('');
  };

  const handleCancel = async (id: string) => {
      if(!confirm("Cancel this session?")) return;
      try {
          await cancelBooking(id);
          loadBookings();
      } catch(e) {
          alert("Failed to cancel.");
      }
  };

  const handleDeleteRecording = async (booking: Booking) => {
      if (!confirm("Are you sure you want to delete this recording?")) return;
      try {
          await deleteBookingRecording(booking.id, booking.recordingUrl, booking.transcriptUrl);
          loadBookings();
      } catch(e) {
          console.error(e);
          alert("Failed to delete recording.");
      }
  };

  const handleOpenStartModal = (booking: Booking) => {
      setSessionStartBooking(booking);
      setRecordMeeting(false);
      setRecordScreen(false);
      setRecordCamera(false);
      setExtraGuestEmail('');
  };

  const handleSendExtraInvite = async () => {
      if (!extraGuestEmail || !extraGuestEmail.includes('@')) {
          alert("Please enter a valid email.");
          return;
      }
      if (!sessionStartBooking) return;

      setIsSendingInvite(true);
      try {
          await updateBookingInvite(sessionStartBooking.id, extraGuestEmail);
          const updatedBooking = { ...sessionStartBooking, invitedEmail: extraGuestEmail };
          setSessionStartBooking(updatedBooking);
          setMyBookings(prev => prev.map(b => b.id === updatedBooking.id ? updatedBooking : b));
          alert(`Invitation sent to ${extraGuestEmail}!`);
          setExtraGuestEmail('');
      } catch(e) {
          console.error(e);
          alert("Failed to send invite.");
      } finally {
          setIsSendingInvite(false);
      }
  };

  const handleConfirmStart = () => {
      if (!sessionStartBooking) return;
      
      let channel: Channel | undefined;
      
      if (sessionStartBooking.type === 'p2p') {
          channel = {
              id: sessionStartBooking.id, 
              title: sessionStartBooking.topic || "Peer Meeting",
              description: "Peer to Peer Meeting",
              author: "System",
              voiceName: "Zephyr",
              systemInstruction: "You are a professional meeting scribe. Transcribe the conversation accurately.",
              likes: 0,
              dislikes: 0,
              comments: [],
              tags: ['Meeting'],
              imageUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&q=80',
              createdAt: Date.now()
          };
          onStartLiveSession(channel, sessionStartBooking.topic, true, sessionStartBooking.id, recordScreen, recordCamera);
      } else {
          channel = channels.find(c => c.id === sessionStartBooking.mentorId);
          if (channel) {
              onStartLiveSession(channel, sessionStartBooking.topic, recordMeeting, sessionStartBooking.id, recordScreen, recordCamera);
          }
      }
      setSessionStartBooking(null);
  };

  // Helper to generate next 7 days
  const getNextDays = () => {
      const days = [];
      for(let i=1; i<=7; i++) {
          const d = new Date();
          d.setDate(d.getDate() + i);
          days.push(d.toISOString().split('T')[0]);
      }
      return days;
  };

  const pendingBookings = myBookings.filter(b => b.status === 'pending');
  const upcomingBookings = myBookings.filter(b => b.status === 'scheduled');
  const pastBookings = myBookings.filter(b => b.status === 'completed');

  // If a booking is initiated (either AI or P2P), show the form
  if (bookingMember || selectedMentor) {
      return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden max-w-4xl mx-auto animate-fade-in">
            <div className="p-6 border-b border-slate-800 flex items-center space-x-4 bg-slate-950/50">
                <button onClick={() => { setSelectedMentor(null); setBookingMember(null); }} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white">
                    <ArrowLeft size={20} />
                </button>
                {bookingMember ? (
                    <div className="flex items-center gap-3">
                        {bookingMember.photoURL ? (
                            <img src={bookingMember.photoURL} className="w-12 h-12 rounded-full border-2 border-indigo-500" />
                        ) : (
                            <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center border-2 border-indigo-500"><User size={24}/></div>
                        )}
                        <div>
                            <h2 className="text-xl font-bold text-white">Book {bookingMember.displayName}</h2>
                            <p className="text-sm text-indigo-400">Community Peer</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        <img src={selectedMentor!.imageUrl} className="w-12 h-12 rounded-full border-2 border-purple-500" />
                        <div>
                            <h2 className="text-xl font-bold text-white">{selectedMentor!.title}</h2>
                            <p className="text-sm text-purple-400">AI Mentor</p>
                        </div>
                    </div>
                )}
            </div>
            
            <div className="p-8 space-y-8">
                {/* 1. Pick Date */}
                <div>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center space-x-2">
                        <Calendar size={16} /> <span>Select Date</span>
                    </h3>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {getNextDays().map(date => {
                            const dObj = new Date(date);
                            const isSelected = selectedDate === date;
                            return (
                                <button 
                                    key={date}
                                    onClick={() => setSelectedDate(date)}
                                    className={`flex-shrink-0 w-24 p-3 rounded-xl border flex flex-col items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'}`}
                                >
                                    <span className="text-xs font-bold uppercase">{dObj.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                                    <span className="text-lg font-bold">{dObj.getDate()}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 2. Pick Time */}
                <div>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center space-x-2">
                        <Clock size={16} /> <span>Select Time (EST)</span>
                    </h3>
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 gap-2">
                        {TIME_SLOTS.map(time => (
                            <button 
                                key={time}
                                onClick={() => setSelectedTime(time)}
                                className={`py-2 rounded-lg text-sm font-medium border transition-all ${selectedTime === time ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white'}`}
                            >
                                {time}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 3. Topic & Invite */}
                <div>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center space-x-2">
                        <Sparkles size={16} /> <span>Discussion Topic</span>
                    </h3>
                    <textarea 
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                        rows={4}
                        placeholder="What would you like to discuss or learn?"
                    />
                </div>
                
                {/* AI Mentor allows extra invite */}
                {!bookingMember && (
                    <div>
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center space-x-2">
                            <Users size={16} /> <span>Invite a Friend (Optional)</span>
                        </h3>
                        <div className="flex items-center space-x-2 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 max-w-md">
                            <Mail size={16} className="text-slate-400" />
                            <input 
                                type="email"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                className="bg-transparent text-sm text-white w-full focus:outline-none"
                                placeholder="friend@email.com"
                            />
                        </div>
                    </div>
                )}

                {/* Submit */}
                <div className="pt-4 flex justify-end">
                    <button 
                        onClick={handleBookSession}
                        disabled={isBooking || !selectedDate || !selectedTime || !topic}
                        className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg flex items-center space-x-2 transition-transform hover:scale-105"
                    >
                        {isBooking ? <Loader2 className="animate-spin" /> : <CheckCircle />}
                        <span>Confirm Request</span>
                    </button>
                </div>
            </div>
        </div>
      );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in relative">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <div>
                <h1 className="text-3xl font-bold text-white flex items-center space-x-2">
                    <Briefcase className="text-indigo-400" />
                    <span>Mentorship Hub</span>
                </h1>
                <p className="text-slate-400 mt-1">Connect, teach, and grow together.</p>
            </div>
            <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                <button 
                    onClick={() => setActiveTab('members')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-1 ${activeTab === 'members' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                    <UserPlus size={14} />
                    <span>Community</span>
                </button>
                <button 
                    onClick={() => setActiveTab('ai_mentors')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-1 ${activeTab === 'ai_mentors' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                    <Sparkles size={14} />
                    <span>AI Mentors</span>
                </button>
                <button 
                    onClick={() => setActiveTab('my_bookings')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'my_bookings' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                    My Schedule
                </button>
            </div>
        </div>

        {/* --- MEMBER DIRECTORY TAB --- */}
        {activeTab === 'members' && (
            <div className="space-y-6">
                
                {/* Mission Banner */}
                <div className="bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border border-indigo-500/30 rounded-xl p-6 flex items-start gap-4">
                    <div className="p-3 bg-indigo-500/20 rounded-full text-indigo-300">
                        <Heart size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white mb-1">Our Mentorship Mission</h3>
                        <p className="text-sm text-indigo-200 leading-relaxed max-w-2xl">
                            We encourage every member to teach and help each other grow. 
                            Use this directory to find peers with shared interests, book learning sessions, 
                            and build a stronger community together.
                        </p>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                    <div className="relative w-full md:w-96">
                        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${isSearchingServer ? 'text-indigo-400 animate-pulse' : 'text-slate-500'}`} size={16}/>
                        <input 
                            type="text" 
                            placeholder="Find member by name..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        />
                        {isSearchingServer && <div className="absolute right-3 top-1/2 -translate-y-1/2"><Loader2 size={14} className="animate-spin text-indigo-400"/></div>}
                    </div>
                    {!isAdmin && (
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 opacity-70">
                            <ShieldAlert size={12} /> Privacy: Emails are hidden for safety.
                        </div>
                    )}
                </div>

                {loadingMembers && !isSearchingServer ? (
                    <div className="py-12 text-center text-indigo-400"><Loader2 className="animate-spin mx-auto" size={32}/></div>
                ) : filteredMembers.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 bg-slate-900/30 rounded-xl border border-dashed border-slate-800">
                        <p>No members found.</p>
                    </div>
                ) : (
                    // TABLE VIEW
                    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg animate-fade-in">
                        <table className="w-full text-left">
                            <thead className="bg-slate-950 text-xs text-slate-400 uppercase font-bold border-b border-slate-800">
                                <tr>
                                    <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('displayName')}>
                                        <div className="flex items-center gap-1">Member {sortConfig.key === 'displayName' && (sortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}</div>
                                    </th>
                                    {isAdmin && (
                                    <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('email')}>
                                        <div className="flex items-center gap-1">Email {sortConfig.key === 'email' && (sortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}</div>
                                    </th>
                                    )}
                                    <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors hidden md:table-cell" onClick={() => handleSort('createdAt')}>
                                        <div className="flex items-center gap-1">Joined {sortConfig.key === 'createdAt' && (sortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}</div>
                                    </th>
                                    <th className="px-6 py-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800 bg-slate-900/50">
                                {filteredMembers.map(member => (
                                    <tr key={member.uid} className="hover:bg-slate-800/80 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                {member.photoURL ? (
                                                    <img src={member.photoURL} alt={member.displayName} className="w-8 h-8 rounded-full border border-slate-700" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700"><User size={14} className="text-slate-400"/></div>
                                                )}
                                                <span className="font-bold text-slate-200 group-hover:text-white transition-colors">{member.displayName}</span>
                                            </div>
                                        </td>
                                        {isAdmin && (
                                        <td className="px-6 py-4 text-sm text-slate-400 group-hover:text-indigo-300 transition-colors">{member.email}</td>
                                        )}
                                        <td className="px-6 py-4 text-xs text-slate-500 font-mono hidden md:table-cell">
                                            {member.createdAt ? new Date(member.createdAt).toLocaleDateString() : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={() => handleOpenBooking(member)}
                                                className="px-3 py-1.5 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition-colors border border-slate-700"
                                            >
                                                Book
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        )}

        {/* --- AI MENTORS TAB --- */}
        {activeTab === 'ai_mentors' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg animate-fade-in-up">
                <table className="w-full text-left">
                    <thead className="bg-slate-950 text-xs text-slate-400 uppercase font-bold border-b border-slate-800">
                        <tr>
                            <th className="px-6 py-4">AI Mentor</th>
                            <th className="px-6 py-4">Persona Voice</th>
                            <th className="px-6 py-4 hidden md:table-cell">Focus Area</th>
                            <th className="px-6 py-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 bg-slate-900/50">
                        {aiMentors.map(channel => (
                            <tr key={channel.id} className="hover:bg-slate-800/80 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <img src={channel.imageUrl} className="w-10 h-10 rounded-full object-cover border border-purple-500/50" />
                                            <div className="absolute -bottom-1 -right-1 bg-purple-600 rounded-full p-0.5 border border-slate-900">
                                                <Sparkles size={8} className="text-white" />
                                            </div>
                                        </div>
                                        <span className="font-bold text-slate-200 group-hover:text-white transition-colors">{channel.title}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-xs font-mono font-bold text-purple-300 bg-purple-900/20 px-2 py-1 rounded border border-purple-500/20">
                                        {channel.voiceName}
                                    </span>
                                </td>
                                <td className="px-6 py-4 hidden md:table-cell">
                                    <p className="text-sm text-slate-400 line-clamp-1 max-w-md">{channel.description}</p>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button 
                                        onClick={() => setSelectedMentor(channel)}
                                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-colors shadow-lg shadow-purple-500/20"
                                    >
                                        Book Session
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}

        {/* --- MY SCHEDULE TAB --- */}
        {activeTab === 'my_bookings' && (
            <div className="space-y-8 animate-fade-in">
                {!currentUser ? (
                    <div className="text-center py-12 text-slate-500 bg-slate-900/50 rounded-2xl border border-slate-800 border-dashed">
                        <User size={48} className="mx-auto mb-4 opacity-50" />
                        <p>Please sign in to view your schedule.</p>
                    </div>
                ) : isLoadingBookings ? (
                    <div className="text-center py-12 text-indigo-400">
                        <Loader2 size={32} className="animate-spin mx-auto mb-2" />
                        <p>Loading schedule...</p>
                    </div>
                ) : (
                    <>
                    {/* Pending Requests (Sent) */}
                    {pendingBookings.length > 0 && (
                        <div className="space-y-4">
                            <h2 className="text-lg font-bold text-amber-400 border-b border-slate-800 pb-2">Pending Requests</h2>
                            {pendingBookings.map(booking => (
                                <div key={booking.id} className="bg-slate-900 border border-amber-500/30 rounded-xl p-4 flex flex-col md:flex-row items-center gap-4 opacity-80">
                                    <div className="flex items-center gap-3 flex-1">
                                        <div className="p-3 bg-amber-900/30 rounded-full text-amber-400">
                                            <Clock size={20} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white">Pending: {booking.topic}</h3>
                                            <p className="text-xs text-slate-400">Sent to: {booking.invitedEmail} • {booking.date} @ {booking.time}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => handleCancel(booking.id)} className="px-4 py-2 bg-slate-800 text-slate-400 rounded-lg text-xs hover:text-white border border-slate-700">Cancel Request</button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Upcoming */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Upcoming Sessions</h2>
                        {upcomingBookings.length === 0 ? (
                            <p className="text-slate-500 text-sm italic">No upcoming sessions.</p>
                        ) : (
                            upcomingBookings.map(booking => {
                                const bookingDate = new Date(`${booking.date}T${booking.time}`);
                                const isToday = new Date().toDateString() === bookingDate.toDateString();
                                const isInvited = booking.userId !== currentUser.uid;
                                // For P2P, create a fake channel to allow StartModal to work
                                const channel = booking.type === 'p2p' ? { id: 'p2p' } as Channel : channels.find(c => c.id === booking.mentorId);

                                return (
                                    <div key={booking.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col md:flex-row items-center gap-6 hover:border-indigo-500/30 transition-all">
                                        <div className="flex-shrink-0 text-center bg-slate-800 rounded-xl p-4 min-w-[100px] border border-slate-700">
                                            <p className="text-xs text-slate-400 uppercase font-bold">{bookingDate.toLocaleDateString('en-US', { month: 'short' })}</p>
                                            <p className="text-3xl font-bold text-white my-1">{bookingDate.getDate()}</p>
                                            <p className="text-sm font-mono text-indigo-300">{booking.time}</p>
                                        </div>
                                        
                                        <div className="flex-1 text-center md:text-left">
                                            <div className="flex items-center justify-center md:justify-start space-x-3 mb-2">
                                                <img src={booking.mentorImage} className="w-8 h-8 rounded-full object-cover" />
                                                <h3 className="text-xl font-bold text-white">
                                                    {booking.type === 'p2p' 
                                                        ? (isInvited ? `Meeting with ${booking.hostName}` : `Meeting with ${booking.invitedEmail}`)
                                                        : booking.mentorName
                                                    }
                                                </h3>
                                                {isInvited && <span className="text-[10px] bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded border border-purple-700">Guest</span>}
                                                {booking.type === 'p2p' && <span className="text-[10px] bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded border border-blue-700">Peer</span>}
                                            </div>
                                            <p className="text-slate-400 text-sm mb-2"><span className="text-slate-500 font-bold uppercase text-xs mr-2">Topic:</span> {booking.topic}</p>
                                            <div className="flex items-center justify-center md:justify-start space-x-2">
                                                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${isToday ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-800' : 'bg-slate-800 text-slate-500'}`}>
                                                    {isToday ? 'Happening Today' : 'Upcoming'}
                                                </span>
                                                {booking.invitedEmail && !isInvited && booking.type !== 'p2p' && <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">Invited: {booking.invitedEmail}</span>}
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2 w-full md:w-auto">
                                            <button 
                                                onClick={() => channel && handleOpenStartModal(booking)}
                                                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-lg shadow-indigo-500/20 flex items-center justify-center space-x-2"
                                            >
                                                <Play size={16} fill="currentColor" />
                                                <span>Start Session</span>
                                            </button>
                                            {!isInvited && (
                                                <button 
                                                    onClick={() => handleCancel(booking.id)}
                                                    className="px-6 py-2 bg-slate-800 hover:bg-red-900/20 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-900/50 rounded-lg text-sm transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Past & Recorded */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Past Sessions & Recordings</h2>
                        {pastBookings.length === 0 ? (
                            <p className="text-slate-500 text-sm italic">No past sessions found.</p>
                        ) : (
                            pastBookings.map(booking => {
                                const bookingDate = new Date(`${booking.date}T${booking.time}`);
                                return (
                                    <div key={booking.id} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-slate-400 font-bold border border-slate-700">
                                                    {bookingDate.getDate()}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-200">{booking.topic}</h4>
                                                    <p className="text-xs text-slate-500">with {booking.mentorName} • {bookingDate.toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                {booking.transcriptUrl && (
                                                    <a 
                                                        href={booking.transcriptUrl} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg border border-slate-700"
                                                        title="Download Transcript"
                                                    >
                                                        <FileText size={16} />
                                                    </a>
                                                )}
                                                {booking.recordingUrl ? (
                                                    <button 
                                                        onClick={() => {
                                                            setPlayingBookingId(playingBookingId === booking.id ? null : booking.id);
                                                            setAudioError(null);
                                                        }}
                                                        className={`p-2 rounded-lg border flex items-center gap-2 text-xs font-bold ${playingBookingId === booking.id ? 'bg-red-500 text-white border-red-500' : 'bg-slate-800 text-indigo-400 border-slate-700 hover:border-indigo-500'}`}
                                                    >
                                                        {playingBookingId === booking.id ? <X size={16}/> : <Play size={16}/>}
                                                        <span>{playingBookingId === booking.id ? 'Stop' : 'Listen'}</span>
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-slate-500 italic p-2">Recording not available</span>
                                                )}
                                                
                                                {/* Delete Recording Button */}
                                                {(booking.recordingUrl || booking.transcriptUrl) && (
                                                    <button 
                                                        onClick={() => handleDeleteRecording(booking)}
                                                        className="p-2 text-slate-400 hover:text-red-400 bg-slate-800 rounded-lg border border-slate-700 hover:border-red-500/50 transition-colors"
                                                        title="Delete Recording"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {/* Video/Audio Player */}
                                        {playingBookingId === booking.id && booking.recordingUrl && (
                                            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 animate-fade-in">
                                                {audioError ? (
                                                    <div className="flex items-center justify-between text-xs text-red-400 px-2 py-1 bg-red-900/10 rounded border border-red-900/30">
                                                        <div className="flex items-center gap-2">
                                                            <Loader2 size={14} className="animate-spin" /> {/* Or alert icon */}
                                                            <span>Playback error (Codec mismatch).</span>
                                                        </div>
                                                        <a 
                                                            href={booking.recordingUrl} 
                                                            target="_blank" 
                                                            rel="noreferrer" 
                                                            className="underline font-bold hover:text-red-300"
                                                        >
                                                            Download File
                                                        </a>
                                                    </div>
                                                ) : (
                                                    <video 
                                                        controls 
                                                        autoPlay 
                                                        src={booking.recordingUrl} 
                                                        className="w-full max-h-96 rounded-lg bg-black" 
                                                        onError={() => setAudioError("Format not supported")}
                                                    />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                    </>
                )}
            </div>
        )}

        {/* Start Session Modal */}
        {sessionStartBooking && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-6 animate-fade-in-up">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-white">Start Meeting</h3>
                        <button onClick={() => setSessionStartBooking(null)} className="text-slate-400 hover:text-white"><X size={20}/></button>
                    </div>

                    <div className="space-y-6">
                        {/* Invite More */}
                        {sessionStartBooking.type !== 'p2p' && (
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                            <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2 mb-2">
                                <Users size={14}/> Invite Another Member
                            </label>
                            <div className="flex gap-2">
                                <input 
                                    type="email" 
                                    placeholder="colleague@email.com" 
                                    value={extraGuestEmail}
                                    onChange={(e) => setExtraGuestEmail(e.target.value)}
                                    className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                />
                                <button 
                                    onClick={handleSendExtraInvite}
                                    disabled={isSendingInvite}
                                    className="px-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold"
                                >
                                    {isSendingInvite ? <Loader2 size={14} className="animate-spin"/> : 'Add'}
                                </button>
                            </div>
                            {sessionStartBooking.invitedEmail && (
                                <div className="mt-2 text-xs text-emerald-400 flex items-center gap-1">
                                    <CheckCircle size={12} />
                                    <span>Invited: {sessionStartBooking.invitedEmail}</span>
                                </div>
                            )}
                        </div>
                        )}

                        {/* Record Toggle */}
                        <div className="space-y-2">
                            <div 
                                onClick={() => setRecordMeeting(!recordMeeting)}
                                className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${recordMeeting ? 'bg-red-900/20 border-red-500/50' : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-full ${recordMeeting ? 'bg-red-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                                        {recordMeeting ? <Video size={20} /> : <Mic size={20} />}
                                    </div>
                                    <div>
                                        <p className={`font-bold ${recordMeeting ? 'text-red-400' : 'text-slate-300'}`}>Record Meeting</p>
                                        <p className="text-xs text-slate-500">Save audio & transcript to cloud</p>
                                    </div>
                                </div>
                                <div className={`w-6 h-6 rounded-full border flex items-center justify-center ${recordMeeting ? 'border-red-500 bg-red-500 text-white' : 'border-slate-500'}`}>
                                    {recordMeeting && <CheckCircle size={14} />}
                                </div>
                            </div>

                            {/* Record Screen Toggle (Only if recording is enabled) */}
                            {recordMeeting && (
                                <div 
                                    onClick={() => setRecordScreen(!recordScreen)}
                                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ml-4 ${recordScreen ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-slate-800/30 border-slate-700 hover:bg-slate-800'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-1.5 rounded-full ${recordScreen ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                                            <Monitor size={16} />
                                        </div>
                                        <div>
                                            <p className={`font-bold text-sm ${recordScreen ? 'text-indigo-400' : 'text-slate-400'}`}>Include Screen Share</p>
                                        </div>
                                    </div>
                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${recordScreen ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-500'}`}>
                                        {recordScreen && <CheckCircle size={12} />}
                                    </div>
                                </div>
                            )}

                            {/* Record Camera Toggle (Only if recording is enabled) */}
                            {recordMeeting && (
                                <div 
                                    onClick={() => setRecordCamera(!recordCamera)}
                                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ml-4 ${recordCamera ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-slate-800/30 border-slate-700 hover:bg-slate-800'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-1.5 rounded-full ${recordCamera ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                                            <Video size={16} />
                                        </div>
                                        <div>
                                            <p className={`font-bold text-sm ${recordCamera ? 'text-indigo-400' : 'text-slate-400'}`}>Include Camera Video</p>
                                        </div>
                                    </div>
                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${recordCamera ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-500'}`}>
                                        {recordCamera && <CheckCircle size={12} />}
                                    </div>
                                </div>
                            )}
                        </div>

                        <button 
                            onClick={handleConfirmStart}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-transform hover:scale-[1.02]"
                        >
                            <Play size={18} fill="currentColor"/>
                            <span>Join Now</span>
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
