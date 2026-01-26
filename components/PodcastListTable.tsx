
import React, { useState, useEffect } from 'react';
import { Channel, UserProfile } from '../types';
import { ArrowUp, ArrowDown, Play, MessageSquare, Heart, Calendar, Hash, RefreshCcw, Loader2, ShieldCheck, Edit3, Clock, Globe, Lock, Users, Zap, Activity } from 'lucide-react';
import { isUserAdmin } from '../services/firestoreService';

export type SortKey = 'title' | 'voiceName' | 'likes' | 'createdAt' | 'author';

interface SortConfig {
  key: SortKey;
  direction: 'asc' | 'desc';
}

interface PodcastListTableProps {
  channels: Channel[];
  onChannelClick: (id: string) => void;
  sortConfig: SortConfig;
  onSort: (key: SortKey) => void;
  globalVoice: string;
  onRegenerate?: (channel: Channel) => Promise<void>;
  onEdit?: (channel: Channel) => void;
  onUpdateChannel?: (channel: Channel) => Promise<void>;
  currentUser?: any;
  userProfile?: UserProfile | null;
}

const SafeTableThumb = ({ src, title }: { src: string, title: string }) => {
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

    if (src && !isThirdParty(src)) {
        return <img src={src} alt="" className="w-8 h-8 rounded object-cover bg-slate-800 border border-slate-700"/>;
    }

    return (
        <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-[10px] font-black text-indigo-400 border border-slate-700 uppercase">
            {title.substring(0, 1)}
        </div>
    );
};

export const PodcastListTable: React.FC<PodcastListTableProps> = ({ 
  channels, onChannelClick, sortConfig, onSort, globalVoice, onRegenerate, onEdit, currentUser, userProfile
}) => {
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  const isSuperAdmin = isUserAdmin(userProfile || null);

  const renderSortIcon = (key: SortKey) => {
    if (sortConfig.key !== key) return <div className="w-4 h-4 opacity-0 group-hover:opacity-30"><ArrowDown size={14} /></div>;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp size={14} className="text-indigo-400" /> 
      : <ArrowDown size={14} className="text-indigo-400" />;
  };

  const HeaderCell = ({ label, sortKey, className = "" }: { label: string, sortKey: SortKey, className?: string }) => (
    <th 
      className={`px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white hover:bg-slate-800/50 transition-colors group ${className}`}
      onClick={(e) => { e.stopPropagation(); onSort(sortKey); }}
    >
      <div className="flex items-center gap-2">
        <span>{label}</span>
        {renderSortIcon(sortKey)}
      </div>
    </th>
  );

  const handleRegenClick = async (e: React.MouseEvent, channel: Channel) => {
      e.stopPropagation();
      if (!onRegenerate) return;
      
      setRegeneratingId(channel.id);
      try {
          await onRegenerate(channel);
      } finally {
          setRegeneratingId(null);
      }
  };

  const handleEditClick = (e: React.MouseEvent, channel: Channel) => {
      e.stopPropagation();
      if (onEdit) onEdit(channel);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden shadow-2xl animate-fade-in mb-20">
      {isSuperAdmin && (
          <div className="bg-indigo-600/20 border-b border-indigo-500/30 p-2 px-6 flex items-center gap-2">
              <ShieldCheck size={14} className="text-indigo-400" />
              <span className="text-[9px] font-black text-indigo-300 uppercase tracking-widest">Admin Control Plane: Heuristic Override Active</span>
          </div>
      )}
      <div className="overflow-x-auto scrollbar-hide">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-950 border-b border-slate-800">
            <tr>
              <HeaderCell label="Podcast Channel" sortKey="title" className="min-w-[300px]" />
              <HeaderCell label="Neural Persona" sortKey="voiceName" />
              <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest hidden lg:table-cell">
                 <div className="flex items-center gap-2"><Hash size={14} /> Tags</div>
              </th>
              <HeaderCell label="Engagement" sortKey="likes" />
              <th className="px-6 py-4 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {channels.map((channel) => {
              const isOwner = currentUser && (channel.ownerId === currentUser.uid || isSuperAdmin);
              const isThisRegenerating = regeneratingId === channel.id;

              return (
                <tr 
                  key={channel.id} 
                  onClick={() => onChannelClick(channel.id)}
                  className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <SafeTableThumb src={channel.imageUrl} title={channel.title} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h4 className="text-sm font-black text-white group-hover:text-indigo-400 transition-colors truncate max-w-[200px] md:max-w-xs uppercase tracking-tight">
                            {channel.title}
                            </h4>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate max-w-[200px] md:max-w-xs mt-0.5 font-medium">
                          {channel.description}
                        </p>
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-slate-950 rounded-lg border border-slate-800">
                            <Zap size={12} className="text-indigo-400" fill={channel.voiceName.includes('gen-') ? 'currentColor' : 'none'}/>
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${globalVoice === channel.voiceName ? 'text-indigo-300' : 'text-slate-400'}`}>
                        {channel.voiceName.split(' gen-')[0]}
                        </span>
                    </div>
                  </td>

                  <td className="px-6 py-4 hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {channel.tags.slice(0, 2).map(tag => (
                        <span key={tag} className="text-[9px] font-black text-slate-500 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded uppercase tracking-tighter">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3 text-[10px] font-mono font-black">
                      <div className="flex items-center gap-1.5 text-emerald-400">
                         <Heart size={12} fill="currentColor" /> {channel.likes}
                      </div>
                      <div className="flex items-center gap-1.5 text-indigo-400">
                         <MessageSquare size={12} /> {channel.comments?.length || 0}
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 text-right">
                     <div className="flex items-center justify-end gap-2">
                        {isOwner && (
                            <>
                                <button 
                                  onClick={(e) => handleEditClick(e, channel)}
                                  className="p-2 bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white rounded-xl shadow-lg border border-slate-700 transition-all active:scale-95"
                                  title="Edit Workspace Settings"
                                >
                                   <Edit3 size={16} />
                                </button>
                                <button 
                                  onClick={(e) => handleRegenClick(e, channel)}
                                  disabled={isThisRegenerating}
                                  className={`p-2 bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white rounded-xl shadow-lg border border-slate-700 transition-all active:scale-95 ${isThisRegenerating ? 'animate-pulse' : ''}`}
                                  title="Neural Re-synthesis"
                                >
                                   {isThisRegenerating ? <Loader2 size={16} className="animate-spin"/> : <RefreshCcw size={16} />}
                                </button>
                            </>
                        )}
                        <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 active:scale-95 transition-all">
                           <Play size={12} fill="currentColor" /> Open
                        </button>
                     </div>
                  </td>
                </tr>
              );
            })}
            
            {channels.length === 0 && (
                <tr>
                    <td colSpan={5} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-3 opacity-20">
                            <Activity size={48} />
                            <p className="text-xs font-black uppercase tracking-widest">No activities detected in current spectrum</p>
                        </div>
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
