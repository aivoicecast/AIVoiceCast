
import React from 'react';
import { Channel } from '../types';
import { ArrowUp, ArrowDown, Play, MessageSquare, Heart, Calendar, Hash } from 'lucide-react';

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
}

export const PodcastListTable: React.FC<PodcastListTableProps> = ({ 
  channels, onChannelClick, sortConfig, onSort, globalVoice 
}) => {
  
  const renderSortIcon = (key: SortKey) => {
    if (sortConfig.key !== key) return <div className="w-4 h-4 opacity-0 group-hover:opacity-30"><ArrowDown size={14} /></div>;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp size={14} className="text-indigo-400" /> 
      : <ArrowDown size={14} className="text-indigo-400" />;
  };

  const HeaderCell = ({ label, sortKey, className = "" }: { label: string, sortKey: SortKey, className?: string }) => (
    <th 
      className={`px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white hover:bg-slate-800/50 transition-colors group ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-2">
        <span>{label}</span>
        {renderSortIcon(sortKey)}
      </div>
    </th>
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl animate-fade-in">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-950 border-b border-slate-800">
            <tr>
              <HeaderCell label="Podcast" sortKey="title" className="min-w-[300px]" />
              <HeaderCell label="Host Voice" sortKey="voiceName" />
              <HeaderCell label="Creator" sortKey="author" className="hidden md:table-cell" />
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider hidden lg:table-cell">
                 <div className="flex items-center gap-2"><Hash size={14} /> Tags</div>
              </th>
              <HeaderCell label="Engagement" sortKey="likes" />
              <HeaderCell label="Date" sortKey="createdAt" className="hidden sm:table-cell" />
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-900/50">
            {channels.map((channel) => (
              <tr 
                key={channel.id} 
                onClick={() => onChannelClick(channel.id)}
                className="hover:bg-slate-800/80 transition-colors cursor-pointer group"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-4">
                    <div className="relative w-12 h-12 flex-shrink-0">
                      <img 
                        src={channel.imageUrl} 
                        alt={channel.title} 
                        className="w-full h-full object-cover rounded-lg border border-slate-700 shadow-sm"
                        onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            if (!target.src.includes('placehold.co')) target.src = `https://placehold.co/100x100/1e293b/white?text=IMG`;
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-lg">
                         <Play size={16} className="text-white fill-white" />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors truncate max-w-[200px] md:max-w-xs">
                        {channel.title}
                      </h4>
                      <p className="text-xs text-slate-500 truncate max-w-[200px] md:max-w-xs mt-0.5">
                        {channel.description}
                      </p>
                    </div>
                  </div>
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`text-xs font-medium px-2 py-1 rounded border ${globalVoice === channel.voiceName ? 'bg-indigo-900/30 text-indigo-300 border-indigo-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                    {channel.voiceName}
                  </span>
                </td>

                <td className="px-6 py-4 whitespace-nowrap hidden md:table-cell">
                   <div className="text-xs text-slate-300">{channel.author}</div>
                </td>

                <td className="px-6 py-4 hidden lg:table-cell">
                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {channel.tags.slice(0, 2).map(tag => (
                      <span key={tag} className="text-[10px] text-slate-500 bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded">
                        #{tag}
                      </span>
                    ))}
                    {channel.tags.length > 2 && <span className="text-[10px] text-slate-600">+{channel.tags.length - 2}</span>}
                  </div>
                </td>

                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3 text-xs font-mono">
                    <div className="flex items-center gap-1 text-emerald-400/80">
                       <Heart size={12} fill="currentColor" /> {channel.likes}
                    </div>
                    <div className="flex items-center gap-1 text-indigo-400/80">
                       <MessageSquare size={12} /> {channel.comments?.length || 0}
                    </div>
                  </div>
                </td>

                <td className="px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                     <Calendar size={12} />
                     <span>{channel.createdAt ? new Date(channel.createdAt).toLocaleDateString() : '-'}</span>
                  </div>
                </td>

                <td className="px-6 py-4 text-right">
                   <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded shadow-lg flex items-center gap-1 ml-auto">
                         <Play size={12} fill="currentColor" /> Play
                      </button>
                   </div>
                </td>
              </tr>
            ))}
            
            {channels.length === 0 && (
                <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500 italic">
                        No podcasts found matching your criteria.
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
