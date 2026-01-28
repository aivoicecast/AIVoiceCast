
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Bell, Check, X, Loader2, Users, Calendar, Link, ExternalLink, Coins, MessageSquare, Receipt } from 'lucide-react';
import { getPendingInvitations, respondToInvitation, getPendingBookings, respondToBooking, subscribeToReceipts, confirmReceipt, claimReceipt } from '../services/firestoreService';
import { Invitation, Booking, DigitalReceipt } from '../types';
import { auth } from '../services/firebaseConfig';
import { onAuthStateChanged } from '@firebase/auth';

export const Notifications: React.FC = () => {
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [receipts, setReceipts] = useState<DigitalReceipt[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(auth?.currentUser);

  const dispatchLog = useCallback((text: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
      window.dispatchEvent(new CustomEvent('neural-log', { 
          detail: { text: `[Notifications] ${text}`, type } 
      }));
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
  }, []);

  const fetchData = async () => {
    if (!user || !user.email) return;
    try {
      const [invData, bookData] = await Promise.all([
          getPendingInvitations(user.email),
          getPendingBookings(user.email)
      ]);
      setInvites(invData);
      setBookings(bookData);
      
      if (invData.length > 0 || bookData.length > 0) {
          dispatchLog(`Audit: Found ${invData.length} Invites, ${bookData.length} Bookings.`, 'info');
      }
    } catch (e) {
      console.error("Failed to fetch notifications", e);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
      const unsubReceipts = subscribeToReceipts(user.uid, (data) => {
          setReceipts(data);
          if (data.length > 0) {
              dispatchLog(`Ledger Update: ${data.length} receipts synced from cloud.`, 'info');
          }
      });
      const interval = setInterval(fetchData, 30000);
      return () => {
          clearInterval(interval);
          unsubReceipts();
      };
    } else {
      setInvites([]);
      setBookings([]);
      setReceipts([]);
    }
  }, [user, dispatchLog]);

  // Sync totalCount logic with actual filtering in render
  const actionableReceipts = useMemo(() => {
      if (!user) return [];
      return receipts.filter(r => {
          const isSender = r.senderId === user.uid;
          const canConfirm = isSender && r.status === 'pending';
          const canClaim = !isSender && r.status === 'confirmed';
          return canConfirm || canClaim;
      });
  }, [receipts, user]);

  const totalCount = invites.length + bookings.length + actionableReceipts.length;

  const handleRespondInvite = async (invitation: Invitation, accept: boolean) => {
    setProcessingId(invitation.id);
    try {
      if (invitation.type === 'coin') {
          await respondToInvitation(invitation, accept);
          setInvites(prev => prev.filter(i => i.id !== invitation.id));
          if (accept) {
              window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: "Coins claimed. Ledger updated.", type: 'success' } }));
          }
      } else if (invitation.type === 'session') {
          await respondToInvitation(invitation, accept);
          setInvites(prev => prev.filter(i => i.id !== invitation.id));
          if (accept && invitation.link) window.open(invitation.link, '_blank');
      } else {
          await respondToInvitation(invitation, accept);
          setInvites(prev => prev.filter(i => i.id !== invitation.id));
          if (accept) {
             window.location.reload();
          }
      }
    } catch (e: any) {
      alert("Error: " + (e.message || "Unknown error"));
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirm = async (id: string) => {
      setProcessingId(id);
      try {
          await confirmReceipt(id);
          window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: "Payment authorized.", type: 'success' } }));
      } catch (e: any) {
          alert(e.message);
      } finally {
          setProcessingId(null);
      }
  };

  const handleClaim = async (id: string) => {
      setProcessingId(id);
      try {
          await claimReceipt(id);
          window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: "Funds claimed successfully!", type: 'success' } }));
      } catch (e: any) {
          alert(e.message);
      } finally {
          setProcessingId(null);
      }
  };

  if (!user) return null;

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
      >
        <Bell size={20} />
        {totalCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse border border-slate-900 text-[10px] flex items-center justify-center text-white font-bold">
              {totalCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in-up">
            <div className="p-3 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
               <h3 className="text-sm font-bold text-white">Notifications</h3>
               {totalCount > 0 && <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{totalCount} Actionable</span>}
            </div>
            
            <div className="max-h-96 overflow-y-auto">
               {totalCount === 0 ? (
                 <div className="p-8 text-center text-slate-500 text-sm italic">
                    No pending activities.
                 </div>
               ) : (
                 <div className="divide-y divide-slate-800">
                    
                    {/* MEETING REQUESTS */}
                    {bookings.map(booking => (
                        <div key={booking.id} className="p-4 hover:bg-slate-800/30 transition-colors border-l-2 border-blue-500">
                            <div className="flex items-start space-x-3">
                                <div className="p-2 bg-blue-900/30 rounded-full text-blue-400 shrink-0">
                                    <Calendar size={16} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-slate-200">
                                        <span className="font-bold">{booking.hostName}</span> wants to meet.
                                    </p>
                                    <p className="text-[10px] text-indigo-300 font-bold mt-1 truncate">{booking.topic}</p>
                                    <div className="flex gap-2 mt-3">
                                        <button onClick={() => respondToBooking(booking.id, true)} className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded">Accept</button>
                                        <button onClick={() => respondToBooking(booking.id, false)} className="flex-1 py-1.5 bg-slate-800 text-slate-400 rounded border border-slate-700 text-[10px]">Decline</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* DIGITAL RECEIPTS (ACTIONABLE ONLY) */}
                    {actionableReceipts.map(r => {
                        const isSender = r.senderId === user.uid;
                        const canConfirm = isSender && r.status === 'pending';
                        const canClaim = !isSender && r.status === 'confirmed';

                        return (
                            <div key={r.id} className={`p-4 hover:bg-slate-800/30 transition-colors border-l-2 ${canClaim ? 'border-emerald-500' : 'border-indigo-500'}`}>
                                <div className="flex items-start space-x-3">
                                    <div className={`p-2 rounded-full shrink-0 ${canClaim ? 'bg-emerald-900/30 text-emerald-400' : 'bg-indigo-900/30 text-indigo-400'}`}>
                                        <Receipt size={16} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-slate-200">
                                            {isSender ? (
                                                <><span className="font-bold">{r.receiverName}</span> requested <span className="text-indigo-400 font-bold">{r.amount} VC</span></>
                                            ) : (
                                                <><span className="font-bold">{r.senderName}</span> confirmed your <span className="text-emerald-400 font-bold">{r.amount} VC</span> request!</>
                                            )}
                                        </p>
                                        {r.memo && <p className="text-[10px] text-slate-500 mt-1 italic truncate">"{r.memo}"</p>}
                                        <div className="flex gap-2 mt-3">
                                            {canConfirm && (
                                                <button 
                                                    onClick={() => handleConfirm(r.id)} 
                                                    disabled={processingId === r.id}
                                                    className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded shadow-lg flex items-center justify-center"
                                                >
                                                    {processingId === r.id ? <Loader2 size={12} className="animate-spin"/> : 'Authorize Payment'}
                                                </button>
                                            )}
                                            {canClaim && (
                                                <button 
                                                    onClick={() => handleClaim(r.id)} 
                                                    disabled={processingId === r.id}
                                                    className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded shadow-lg flex items-center justify-center"
                                                >
                                                    {processingId === r.id ? <Loader2 size={12} className="animate-spin"/> : 'Claim Ledger'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* COIN INVITES & GROUP INVITES */}
                    {invites.map(invite => (
                       <div key={invite.id} className={`p-4 hover:bg-slate-800/30 transition-colors border-l-2 ${invite.type === 'coin' ? 'border-amber-500' : 'border-indigo-500'}`}>
                          <div className="flex items-start space-x-3">
                             <div className={`p-2 rounded-full shrink-0 ${invite.type === 'coin' ? 'bg-amber-900/30 text-amber-400' : 'bg-indigo-900/30 text-indigo-400'}`}>
                                {invite.type === 'coin' ? <Coins size={16} /> : <Users size={16} />}
                             </div>
                             <div className="flex-1 min-w-0">
                                {invite.type === 'coin' ? (
                                    <>
                                        <p className="text-sm text-slate-200">
                                            <span className="font-bold">{invite.fromName}</span> sent you <span className="text-amber-400 font-bold">{invite.amount} VoiceCoins</span>!
                                        </p>
                                        <button 
                                            onClick={() => handleRespondInvite(invite, true)}
                                            disabled={processingId === invite.id}
                                            className="w-full mt-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold rounded shadow-lg flex items-center justify-center gap-2"
                                        >
                                            {processingId === invite.id ? <Loader2 size={12} className="animate-spin"/> : <Check size={12}/>}
                                            Claim Coins
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-sm text-slate-200">
                                            <span className="font-bold">{invite.fromName}</span> invited you to {invite.type === 'session' ? 'collaborate' : 'join'}: <span className="font-bold text-indigo-300">{invite.groupName}</span>.
                                        </p>
                                        <div className="flex space-x-2 mt-3">
                                            <button onClick={() => handleRespondInvite(invite, true)} className="flex-1 py-1.5 bg-indigo-600 text-white text-[10px] font-bold rounded">Join</button>
                                            <button onClick={() => handleRespondInvite(invite, false)} className="flex-1 py-1.5 bg-slate-800 text-slate-400 rounded border border-slate-700 text-[10px]">Ignore</button>
                                        </div>
                                    </>
                                )}
                             </div>
                          </div>
                       </div>
                    ))}
                 </div>
               )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
