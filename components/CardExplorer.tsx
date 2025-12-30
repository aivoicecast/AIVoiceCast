
import React, { useState, useEffect } from 'react';
import { AgentMemory } from '../types';
import { getUserCards } from '../services/firestoreService';
import { auth } from '../services/firebaseConfig';
import { ArrowLeft, Gift, Loader2, Calendar, User, Music, ImageIcon, Plus } from 'lucide-react';

interface CardExplorerProps {
  onBack: () => void;
  onOpenCard: (cardId: string) => void;
  onCreateNew: () => void;
}

export const CardExplorer: React.FC<CardExplorerProps> = ({ onBack, onOpenCard, onCreateNew }) => {
  const [cards, setCards] = useState<AgentMemory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCards = async () => {
        if (!auth.currentUser) return;
        setLoading(true);
        try {
            const data = await getUserCards(auth.currentUser.uid);
            setCards(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };
    loadCards();
  }, []);

  if (!auth.currentUser) {
      return (
          <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-8">
              <Gift size={48} className="text-slate-700 mb-4"/>
              <p className="text-slate-500">Please sign in to view your saved cards.</p>
              <button onClick={onBack} className="mt-4 text-indigo-400 hover:text-white underline">Go Back</button>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col animate-fade-in">
        {/* Header */}
        <div className="p-6 border-b border-slate-900 flex items-center justify-between sticky top-0 bg-slate-950/90 backdrop-blur-md z-20">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-xl font-holiday font-bold text-white flex items-center gap-2">
                    <Gift className="text-red-500" /> My Holiday Cards
                </h1>
            </div>
            <button 
                onClick={onCreateNew}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-sm shadow-lg transition-transform hover:scale-105"
            >
                <Plus size={16}/> Create New
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8">
            {loading ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                    <Loader2 size={32} className="animate-spin mb-2"/>
                    <p>Loading your cards...</p>
                </div>
            ) : cards.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">
                    <Gift size={48} className="mb-4 opacity-20"/>
                    <p>You haven't created any cards yet.</p>
                    <button onClick={onCreateNew} className="mt-4 text-indigo-400 font-bold hover:text-white">Start Designing</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {cards.map((card) => (
                        <div 
                            key={card.id} 
                            onClick={() => card.id && onOpenCard(card.id)}
                            className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-indigo-500/50 hover:shadow-xl transition-all cursor-pointer group flex flex-col"
                        >
                            {/* Cover Preview */}
                            <div className="aspect-[2/3] bg-slate-800 relative overflow-hidden">
                                {card.coverImageUrl ? (
                                    <img 
                                        src={card.coverImageUrl} 
                                        alt={card.occasion} 
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 bg-slate-950">
                                        <ImageIcon size={32} className="mb-2 opacity-50"/>
                                        <span className="text-xs">No Cover Art</span>
                                    </div>
                                )}
                                <div className="absolute top-2 right-2 flex flex-col gap-1">
                                    {card.voiceMessageUrl && <div className="bg-black/50 backdrop-blur p-1 rounded-full text-white"><Music size={12}/></div>}
                                </div>
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"></div>
                                <div className="absolute bottom-3 left-3 right-3 text-white">
                                    <h3 className="font-holiday font-bold text-lg leading-tight">{card.occasion}</h3>
                                    <p className="text-xs text-slate-300 line-clamp-1">To: {card.recipientName}</p>
                                </div>
                            </div>
                            
                            {/* Metadata */}
                            <div className="p-4 flex-1 flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                                        <Calendar size={12}/>
                                        <span>{new Date(card.generatedAt).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-xs text-slate-400 line-clamp-2 italic">"{card.cardMessage}"</p>
                                </div>
                                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
                                    <span className="flex items-center gap-1"><User size={12}/> From: {card.senderName}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    </div>
  );
};
