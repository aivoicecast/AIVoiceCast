
import React, { useState, useMemo, useEffect } from 'react';
import { Channel, Booking, TodoItem } from '../types';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Briefcase, Plus, Video, CheckCircle, X, Users, Loader2, Mic, Play, Mail, Sparkles, ArrowLeft, Monitor, Filter, LayoutGrid, List, Languages, CloudSun, Wind, BookOpen, CheckSquare, Square, Trash2, StopCircle, Download, FileText, Check, Podcast, RefreshCw, Share2, Target, ExternalLink, Circle, Edit3, Timer, Lock } from 'lucide-react';
import { ChannelCard } from './ChannelCard';
// Fix: removed updateBookingInvite which is not exported by firestoreService
import { getUserBookings, createBooking, saveSavedWord, getSavedWordForUser } from '../services/firestoreService';
import { fetchLocalWeather, getWeatherDescription, WeatherData } from '../utils/weatherService';
import { getLunarDate, getDailyWord, getSeasonContext, DailyWord } from '../utils/lunarService';
import { generateSecureId } from '../utils/idUtils';
import { ShareModal } from './ShareModal';

interface CalendarViewProps {
  channels: Channel[];
  handleChannelClick: (id: string) => void;
  handleVote: (id: string, type: 'like' | 'dislike', e: React.MouseEvent) => void;
  currentUser: any;
  setChannelToEdit: (channel: Channel) => void;
  setIsSettingsModalOpen: (open: boolean) => void;
  globalVoice: string;
  t: any;
  onCommentClick: (channel: Channel) => void;
  onStartLiveSession: (channel: Channel, context?: string, recordingEnabled?: boolean, bookingId?: string, videoEnabled?: boolean, cameraEnabled?: boolean, activeSegment?: { index: number, lectureId: string }) => void;
  onCreateChannel: (channel: Channel) => void;
  onSchedulePodcast: (date: Date) => void;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const getDateKey = (date: Date | number | string) => { 
    const d = new Date(date); 
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; 
};

export const CalendarView: React.FC<CalendarViewProps> = ({
  channels, handleChannelClick, handleVote, currentUser, setChannelToEdit, setIsSettingsModalOpen, globalVoice, t, onCommentClick, onStartLiveSession, onCreateChannel, onSchedulePodcast
}) => {
  const [displayDate, setDisplayDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [shareUrl, setShareUrl] = useState('');
  const [shareTitle, setShareTitle] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [dailyWord, setDailyWord] = useState<DailyWord | null>(null);

  useEffect(() => { loadData(); }, [currentUser]);
  useEffect(() => {
      fetchLocalWeather().then(setWeather);
      setDailyWord(getDailyWord(new Date()));
  }, []);

  const loadData = async () => {
    if (!currentUser) return;
    setIsRefreshing(true);
    try {
        const bData = await getUserBookings(currentUser.uid, currentUser.email);
        setBookings(bData.filter(b => b.status !== 'cancelled' && b.status !== 'rejected'));
        setTodos(JSON.parse(localStorage.getItem(`todos_${currentUser.uid}`) || '[]'));
    } catch(e) { console.error(e); } finally { setIsRefreshing(false); }
  };

  const handleAddTodo = () => {
      if (!newTodo.trim() || !currentUser) return;
      const todo: TodoItem = {
          id: generateSecureId(),
          text: newTodo,
          isCompleted: false,
          date: selectedDate.toISOString()
      };
      const next = [...todos, todo];
      setTodos(next);
      localStorage.setItem(`todos_${currentUser.uid}`, JSON.stringify(next));
      setNewTodo('');
  };

  const toggleTodo = (id: string) => {
      const next = todos.map(t => t.id === id ? { ...t, isCompleted: !t.isCompleted } : t);
      setTodos(next);
      localStorage.setItem(`todos_${currentUser.uid}`, JSON.stringify(next));
  };

  const deleteTodo = (id: string) => {
      const next = todos.filter(t => t.id !== id);
      setTodos(next);
      localStorage.setItem(`todos_${currentUser.uid}`, JSON.stringify(next));
  };

  const eventsByDate = useMemo(() => {
    const map: Record<string, { channels: Channel[], bookings: Booking[], todos: TodoItem[] }> = {};
    channels.forEach(c => {
      if (c.createdAt) {
        const key = getDateKey(c.createdAt);
        if (!map[key]) map[key] = { channels: [], bookings: [], todos: [] };
        map[key].channels.push(c);
      }
    });
    bookings.forEach(b => {
        const key = getDateKey(b.date); 
        if (!map[key]) map[key] = { channels: [], bookings: [], todos: [] };
        map[key].bookings.push(b);
    });
    todos.forEach(t => {
        const key = getDateKey(t.date);
        if (!map[key]) map[key] = { channels: [], bookings: [], todos: [] };
        map[key].todos.push(t);
    });
    return map;
  }, [channels, bookings, todos]);

  const calendarDays = useMemo(() => {
      const year = displayDate.getFullYear();
      const month = displayDate.getMonth();
      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const prevMonthDays = new Date(year, month, 0).getDate();
      
      const grid = [];
      for (let i = firstDay - 1; i >= 0; i--) {
          grid.push({ date: new Date(year, month - 1, prevMonthDays - i), current: false });
      }
      for (let i = 1; i <= daysInMonth; i++) {
          grid.push({ date: new Date(year, month, i), current: true });
      }
      const total = 42;
      const remaining = total - grid.length;
      for (let i = 1; i <= remaining; i++) {
          grid.push({ date: new Date(year, month + 1, i), current: false });
      }
      return grid;
  }, [displayDate]);

  const activeDayData = useMemo(() => {
      const key = getDateKey(selectedDate);
      return eventsByDate[key] || { channels: [], bookings: [], todos: [] };
  }, [eventsByDate, selectedDate]);

  return (
    <div className="h-full flex flex-col p-6 space-y-6 overflow-hidden max-w-7xl mx-auto w-full animate-fade-in">
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 shrink-0">
          <div className="lg:col-span-2 bg-indigo-600 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 p-24 bg-white/10 blur-3xl rounded-full"></div>
              <div className="relative z-10">
                  <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">{MONTHS[displayDate.getMonth()]} {displayDate.getFullYear()}</h2>
                        <p className="text-indigo-100 font-bold opacity-80 mt-1 flex items-center gap-2">
                           <Target size={14}/> 
                           {bookings.length} Sessions scheduled this month
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setDisplayDate(new Date())} className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-xl text-xs font-black text-white border border-white/20 transition-all">TODAY</button>
                    </div>
                  </div>
              </div>
              <div className="relative z-10 flex gap-4 mt-8">
                  <button onClick={() => setDisplayDate(new Date(displayDate.getFullYear(), displayDate.getMonth() - 1, 1))} className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl border border-white/20 transition-all"><ChevronLeft size={24} className="text-white"/></button>
                  <button onClick={() => setDisplayDate(new Date(displayDate.getFullYear(), displayDate.getMonth() + 1, 1))} className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl border border-white/20 transition-all"><ChevronRight size={24} className="text-white"/></button>
              </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-8 flex flex-col justify-between shadow-xl">
               {weather ? (
                   <div className="flex items-center gap-6">
                       <div className="text-5xl">{getWeatherDescription(weather.weatherCode).icon}</div>
                       <div>
                           <p className="text-3xl font-black text-white">{weather.temperature}°C</p>
                           <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{getWeatherDescription(weather.weatherCode).label}</p>
                       </div>
                   </div>
               ) : <div className="animate-pulse flex gap-4"><div className="w-12 h-12 bg-slate-800 rounded-xl"></div><div className="w-24 h-4 bg-slate-800 rounded mt-4"></div></div>}
               <div className="mt-6 pt-6 border-t border-slate-800">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-2">Daily Neural Word</p>
                    <h3 className="text-2xl font-bold text-white leading-tight">{dailyWord?.word}</h3>
                    <p className="text-xs text-slate-500 mt-1 italic line-clamp-2">"{dailyWord?.meaning}"</p>
               </div>
          </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
          <div className="flex-[2] bg-slate-900 border border-slate-800 rounded-[2.5rem] flex flex-col shadow-2xl overflow-hidden">
              <div className="grid grid-cols-7 border-b border-slate-800">
                  {DAYS.map(d => <div key={d} className="py-4 text-center text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">{d}</div>)}
              </div>
              <div className="flex-1 grid grid-cols-7 grid-rows-6">
                  {calendarDays.map((day, i) => {
                      const key = getDateKey(day.date);
                      const isSelected = isSameDate(day.date, selectedDate);
                      const isToday = isSameDate(day.date, new Date());
                      const hasData = eventsByDate[key];
                      
                      return (
                          <div 
                            key={i} 
                            onClick={() => setSelectedDate(day.date)}
                            className={`relative border-r border-b border-slate-800 p-2 cursor-pointer transition-all hover:bg-slate-800/50 flex flex-col items-center justify-center group ${!day.current ? 'opacity-20' : ''} ${isSelected ? 'bg-indigo-600/10' : ''}`}
                          >
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${isToday ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : isSelected ? 'bg-white text-slate-950 scale-110' : 'text-slate-400 group-hover:text-white'}`}>
                                  {day.date.getDate()}
                              </div>
                              <div className="flex gap-1 mt-1 h-1.5 items-center">
                                  {hasData?.bookings.length > 0 && <div className="w-1 h-1 rounded-full bg-indigo-500 animate-pulse"></div>}
                                  {hasData?.channels.length > 0 && <div className="w-1 h-1 rounded-full bg-emerald-500"></div>}
                                  {hasData?.todos.length > 0 && <div className="w-1 h-1 rounded-full bg-amber-500"></div>}
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>

          <div className="flex-1 bg-slate-900 border border-slate-800 rounded-[2.5rem] flex flex-col shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
                  <div>
                      <h3 className="font-bold text-white text-lg">Daily Agenda</h3>
                      <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">{selectedDate.toLocaleDateString(undefined, {weekday:'long', month:'short', day:'numeric'})}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => onSchedulePodcast(selectedDate)} className="p-3 bg-indigo-600 rounded-2xl text-white hover:bg-indigo-500 transition-all shadow-lg active:scale-95" title="New Podcast Episode"><Plus size={20}/></button>
                  </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
                  {activeDayData.bookings.length === 0 && activeDayData.channels.length === 0 && activeDayData.todos.length === 0 && (
                      <div className="py-20 text-center text-slate-600 flex flex-col items-center gap-4">
                          <Wind size={40} className="opacity-20"/>
                          <p className="text-xs font-bold uppercase tracking-widest">No activities recorded</p>
                      </div>
                  )}

                  {activeDayData.bookings.sort((a,b) => a.time.localeCompare(b.time)).map(b => {
                      const isParticipant = currentUser?.uid === b.userId || currentUser?.email === b.invitedEmail;
                      return (
                      <div key={b.id} className="bg-slate-950 border border-slate-800 p-4 rounded-2xl flex items-center gap-4 group hover:border-indigo-500/50 transition-all relative overflow-hidden">
                          {isParticipant && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>}
                          <div className={`p-3 rounded-xl transition-transform group-hover:scale-110 ${isParticipant ? 'bg-indigo-900/20 text-indigo-400' : 'bg-slate-800 text-slate-600'}`}>
                             {isParticipant ? <Clock size={20}/> : <Lock size={20}/>}
                          </div>
                          <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-black text-indigo-400 uppercase tracking-widest">{b.time} - {b.endTime}</p>
                                <span className="text-[9px] font-bold text-slate-600">{b.duration}m</span>
                              </div>
                              <h4 className={`font-bold text-sm truncate ${isParticipant ? 'text-white' : 'text-slate-600 italic'}`}>
                                  {isParticipant ? b.topic : 'Restricted Focus Slot'}
                              </h4>
                              <p className="text-[10px] text-slate-500 uppercase font-bold truncate">
                                  {isParticipant ? `with ${b.mentorName}` : `Private Member Session`}
                              </p>
                          </div>
                          {isParticipant && b.status === 'scheduled' && (
                              <button onClick={() => onStartLiveSession(channels.find(c => c.id === b.mentorId) || channels[0], b.topic, true, b.id)} className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-all shadow-lg"><Play size={14} fill="currentColor"/></button>
                          )}
                      </div>
                  )})}

                  {activeDayData.channels.map(c => (
                      <div key={c.id} onClick={() => handleChannelClick(c.id)} className="bg-emerald-950/10 border border-emerald-900/30 p-4 rounded-2xl flex items-center gap-4 cursor-pointer hover:border-emerald-500/50 transition-all">
                          <img src={c.imageUrl} className="w-10 h-10 rounded-lg object-cover border border-emerald-900/50" />
                          <div className="flex-1 min-w-0">
                              <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Podcast Release</p>
                              <h4 className="font-bold text-white text-sm truncate">{c.title}</h4>
                          </div>
                      </div>
                  ))}

                  <div className="space-y-2 pt-4">
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2 mb-3">Today's Tasks</h4>
                      {activeDayData.todos.map(todo => (
                          <div key={todo.id} className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/50 flex items-center gap-3 group">
                              <button onClick={() => toggleTodo(todo.id)} className={`p-0.5 rounded transition-all ${todo.isCompleted ? 'text-emerald-400 bg-emerald-400/10' : 'text-slate-600 hover:text-white'}`}>
                                  {todo.isCompleted ? <CheckCircle size={16}/> : <Circle size={16}/>}
                              </button>
                              <span className={`text-xs flex-1 truncate ${todo.isCompleted ? 'text-slate-600 line-through' : 'text-slate-300'}`}>{todo.text}</span>
                              <button onClick={() => deleteTodo(todo.id)} className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-opacity"><Trash2 size={14}/></button>
                          </div>
                      ))}
                      <div className="flex gap-2 p-2 bg-slate-950 rounded-xl border border-slate-800 mt-2">
                          <input 
                            value={newTodo} 
                            onChange={e => setNewTodo(e.target.value)} 
                            onKeyDown={e => e.key === 'Enter' && handleAddTodo()}
                            placeholder="Add task..." 
                            className="bg-transparent text-xs font-bold text-white outline-none flex-1 px-1"
                          />
                          <button onClick={handleAddTodo} className="text-indigo-400 hover:text-white"><Plus size={16}/></button>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {showShareModal && (
          <ShareModal isOpen={true} onClose={() => setShowShareModal(false)} link={shareUrl} title={shareTitle} onShare={async () => {}} currentUserUid={currentUser?.uid} />
      )}
    </div>
  );
};

function isSameDate(d1: Date, d2: Date) {
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}
