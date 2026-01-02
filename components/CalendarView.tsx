
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Channel, Booking, TodoItem } from '../types';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Briefcase, Plus, Video, CheckCircle, X, Users, Loader2, Mic, Play, Mail, Sparkles, ArrowLeft, Monitor, Filter, LayoutGrid, List, Languages, CloudSun, Wind, BookOpen, CheckSquare, Square, Trash2, StopCircle, Download, FileText, Check, Podcast, RefreshCw, Share2 } from 'lucide-react';
import { ChannelCard } from './ChannelCard';
import { getUserBookings, createBooking, updateBookingInvite, saveSavedWord, getSavedWordForUser } from '../services/firestoreService';
import { fetchLocalWeather, getWeatherDescription, WeatherData } from '../utils/weatherService';
import { getLunarDate, getDailyWord, getSeasonContext, DailyWord } from '../utils/lunarService';
import { GoogleGenAI } from '@google/genai';
import { synthesizeSpeech } from '../services/tts';
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
const TIME_SLOTS = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '19:00', '20:00'];
const getStartOfDay = (date: Date) => { const d = new Date(date); d.setHours(0,0,0,0); return d; };
const getDateKey = (date: Date | number | string) => { const d = new Date(date); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
const isSameDate = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

export const CalendarView: React.FC<CalendarViewProps> = ({
  channels, handleChannelClick, handleVote, currentUser, setChannelToEdit, setIsSettingsModalOpen, globalVoice, t, onCommentClick, onStartLiveSession, onCreateChannel, onSchedulePodcast
}) => {
  const [displayDate, setDisplayDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');
  
  // Share States
  const [shareUrl, setShareUrl] = useState('');
  const [shareTitle, setShareTitle] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  
  // Sub-components State (Weather, etc)
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [dailyWord, setDailyWord] = useState<DailyWord | null>(null);

  useEffect(() => { loadData(); }, [currentUser]);

  const loadData = async () => {
    if (!currentUser) return;
    setIsRefreshing(true);
    const [bData, tData] = await Promise.all([
        getUserBookings(currentUser.uid, currentUser.email),
        Promise.resolve(JSON.parse(localStorage.getItem(`todos_${currentUser.uid}`) || '[]'))
    ]);
    setBookings(bData.filter(b => b.status !== 'cancelled' && b.status !== 'rejected'));
    setTodos(tData);
    setIsRefreshing(false);
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

  const handleShareItem = (type: 'event' | 'task', id: string, name: string) => {
      const url = `${window.location.origin}?view=calendar&${type}Id=${id}`;
      setShareUrl(url);
      setShareTitle(name);
      setShowShareModal(true);
  };

  // Memoized Grid Indicators
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
        const key = getDateKey(b.date + 'T' + b.time); 
        if (!map[key]) map[key] = { channels: [], bookings: [], todos: [] };
        map[key].bookings.push(b);
    });
    todos.forEach(t => {
        const key = getDateKey(new Date(t.date));
        if (!map[key]) map[key] = { channels: [], bookings: [], todos: [] };
        map[key].todos.push(t);
    });
    return map;
  }, [channels, bookings, todos]);

  const activeDayData = useMemo(() => {
      const key = getDateKey(selectedDate);
      return eventsByDate[key] || { channels: [], bookings: [], todos: [] };
  }, [eventsByDate, selectedDate]);

  return (
    <div className="space-y-8 animate-fade-in relative">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row">
        {/* Simplified Calendar Left Rail */}
        <div className="p-4 bg-slate-950/50 border-b md:border-b-0 md:border-r border-slate-800 md:w-64 flex flex-col gap-6">
            <div className="flex items-center justify-between bg-slate-900 p-2 rounded-xl border border-slate-800 text-sm font-bold">
                <button onClick={() => setDisplayDate(new Date(displayDate.getFullYear(), displayDate.getMonth() - 1, 1))}><ChevronLeft/></button>
                <span>{MONTHS[displayDate.getMonth()]}</span>
                <button onClick={() => setDisplayDate(new Date(displayDate.getFullYear(), displayDate.getMonth() + 1, 1))}><ChevronRight/></button>
            </div>
            <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Daily Tasks</h4>
                <div className="space-y-2">
                    {activeDayData.todos.map(t => (
                        <div key={t.id} className="flex items-center gap-2 group p-1 hover:bg-slate-800/50 rounded-lg">
                            <span className={`text-sm flex-1 truncate ${t.isCompleted ? 'line-through opacity-50' : ''}`}>{t.text}</span>
                            <button onClick={() => handleShareItem('task', t.id, t.text)} className="opacity-0 group-hover:opacity-100 text-indigo-400 p-1"><Share2 size={12}/></button>
                        </div>
                    ))}
                    <div className="flex gap-2 items-center px-1">
                        <Plus size={14} className="text-slate-600"/>
                        <input value={newTodo} onChange={e => setNewTodo(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddTodo()} placeholder="New task..." className="bg-transparent text-sm outline-none w-full"/>
                    </div>
                </div>
            </div>
        </div>

        {/* Main Grid Placeholder (Reusing Logic from Existing) */}
        <div className="flex-1 p-6">
            <div className="grid grid-cols-7 gap-2">
                {/* Visual grid rendering here... */}
                <p className="text-xs text-slate-500 italic">Select a day to view agenda and share items.</p>
            </div>
        </div>
      </div>

      <div className="space-y-4">
          <h3 className="font-bold text-white uppercase text-xs tracking-widest">Selected Day Events</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeDayData.bookings.map(b => (
                  <div key={b.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                          <div className="bg-slate-800 p-2 rounded-lg text-indigo-400"><Clock size={20}/></div>
                          <div><p className="text-sm font-bold text-white">{b.topic}</p><p className="text-[10px] text-slate-500 uppercase">{b.time} with {b.mentorName}</p></div>
                      </div>
                      <button onClick={() => handleShareItem('event', b.id, b.topic)} className="p-2 bg-indigo-600/10 text-indigo-400 rounded-lg opacity-0 group-hover:opacity-100 transition-all"><Share2 size={16}/></button>
                  </div>
              ))}
          </div>
      </div>

      {showShareModal && (
          <ShareModal 
            isOpen={true} onClose={() => setShowShareModal(false)} link={shareUrl} title={shareTitle}
            onShare={async () => {}} currentUserUid={currentUser?.uid}
          />
      )}
    </div>
  );
};
