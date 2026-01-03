
import React, { useState, useEffect } from 'react';
import { Bell, Check, X, Loader2, Users, Calendar, Link, ExternalLink, Coins } from 'lucide-react';
import { getPendingInvitations, respondToInvitation, getPendingBookings, respondToBooking } from '../services/firestoreService';
import { Invitation, Booking } from '../types';
import { auth } from '../services/firebaseConfig';

export const Notifications: React.FC = () => {
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const currentUser = auth?.currentUser;

  const fetchData = async () => {
    if (!currentUser || !currentUser.email) return;
    try {
      const [invData, bookData] = await Promise.all([
          getPendingInvitations(currentUser.email),
          getPendingBookings(currentUser.email)
      ]);
      setInvites(invData);
      setBookings(bookData);
    } catch (e) {
      console.error("Failed to fetch notifications", e);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchData();
      // Poll every 30 seconds
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    } else {
      setInvites([]);
      setBookings([]);
    }
  }, [currentUser]);

  const handleRespondInvite = async (invitation: Invitation, accept: boolean) => {
    setProcessingId(invitation.id);
    try {
      // For session invites, 'accept' simply means clearing the notification and opening the link
      // For group invites, it executes logic to add user to group DB
      
      if (invitation.type === 'session' || invitation.type === 'coin') {
          // Just mark as accepted/rejected to remove from list
          // NOTE: For coin types, respondToInvitation now triggers claimOnlineTransfer internally
          await respondToInvitation(invitation, accept);
          setInvites(prev => prev.filter(i => i.id !== invitation.id));
          
          if (accept && invitation.link) {
              // Redirect to wallet to see the update
              window.location.href = invitation.link;
          }
      } else {
          // Standard Group Invite
          await respondToInvitation(invitation, accept);
          setInvites(prev => prev.filter(i => i.id !== invitation.id));
          if (accept) {
             alert(`You joined ${invitation.groupName}! Refreshing...`);
             window.location.reload();
          }
      }
    } catch (e: any) {
      console.error(e);
      alert("Error processing invitation: " + (e.message || "Unknown error"));
    } finally {
      setProcessingId(null);
    }
  };

  const handleRespondBooking = async (booking: Booking, accept: boolean) => {
      setProcessingId(booking.id);
      try {
          await respondToBooking(booking.id, accept);
          setBookings(prev => prev.filter(b => b.id !== booking.id));
          if (accept) alert("Meeting Accepted! Added to your schedule.");
      } catch(e) {
          alert("Error processing booking.");
      } finally {
          setProcessingId(null);
      }
  };

  if (!currentUser) return null;

  const totalCount = invites.length + bookings.length;

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
            <div className="p-3 border-b border-slate-800 bg-slate-950/50">
               <h3 className="text-sm font-bold text-white">Notifications</h3>
            </div>
            
            <div className="max-h-96 overflow-y-auto">
               {totalCount === 0 ? (
                 <div className="p-8 text-center text-slate-500 text-sm">
                    No pending notifications.
                 </div>
               ) : (
                 <div className="divide-y divide-slate-800">
                    
                    {/* Meeting Requests */}
                    {bookings.map(booking => (
                        <div key={booking.id} className="p-4 hover:bg-slate-800/30 transition-colors border-l-2 border-blue-500">
                            <div className="flex items-start space-x-3">
                                <div className="p-2 bg-blue-900/30 rounded-full text-blue-400">
                                    <Calendar size={16} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm text-slate-200">
                                        <span className="font-bold">{booking.hostName}</span> wants to meet.
                                    </p>
                                    <p className="text-xs text-indigo-300 font-bold mt-1">{booking.topic}</p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {booking.date} @ {booking.time}
                                    </p>
                                    
                                    <div className="flex space-x-2 mt-3">
                                        <button 
                                            onClick={() => handleRespondBooking(booking, true)}
                                            disabled={processingId === booking.id}
                                            className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded flex items-center justify-center space-x-1"
                                        >
                                            {processingId === booking.id ? <Loader2 size={12} className="animate-spin"/> : <Check size={12}/>}
                                            <span>Confirm</span>
                                        </button>
                                        <button 
                                            onClick={() => handleRespondBooking(booking, false)}
                                            disabled={processingId === booking.id}
                                            className="flex-1 py-1.5 bg-slate-800 hover:bg-red-900/30 text-slate-300 hover:text-red-400 text-xs font-bold rounded border border-slate-700"
                                        >
                                            <X size={12}/>
                                            <span>Decline</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Group, Session & Coin Invites */}
                    {invites.map(invite => (
                       <div key={invite.id} className={`p-4 hover:bg-slate-800/30 transition-colors border-l-2 ${invite.type === 'session' ? 'border-emerald-500' : invite.type === 'coin' ? 'border-amber-500' : 'border-indigo-500'}`}>
                          <div className="flex items-start space-x-3">
                             <div className={`p-2 rounded-full ${invite.type === 'session' ? 'bg-emerald-900/30 text-emerald-400' : invite.type === 'coin' ? 'bg-amber-900/30 text-amber-400' : 'bg-indigo-900/30 text-indigo-400'}`}>
                                {invite.type === 'session' ? <Link size={16} /> : invite.type === 'coin' ? <Coins size={16} /> : <Users size={16} />}
                             </div>
                             <div className="flex-1">
                                {invite.type === 'coin' ? (
                                    <>
                                        <p className="text-sm text-slate-200">
                                            <span className="font-bold">{invite.fromName}</span> sent you <span className="text-amber-400 font-bold">{invite.amount} VoiceCoins</span>!
                                        </p>
                                        <div className="flex space-x-2 mt-3">
                                            <button 
                                                onClick={() => handleRespondInvite(invite, true)}
                                                disabled={processingId === invite.id}
                                                className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded flex items-center justify-center space-x-1 shadow-lg shadow-amber-900/20 active:scale-95 transition-all"
                                            >
                                                {processingId === invite.id ? <Loader2 size={12} className="animate-spin"/> : <Check size={12}/>}
                                                <span>Claim Coins</span>
                                            </button>
                                            <button 
                                                onClick={() => handleRespondInvite(invite, false)}
                                                disabled={processingId === invite.id}
                                                className="flex-1 py-1.5 bg-slate-800 hover:bg-red-900/30 text-slate-300 hover:text-red-400 text-xs font-bold rounded border border-slate-700"
                                            >
                                                <X size={12}/>
                                                <span>Ignore</span>
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-sm text-slate-200">
                                            <span className="font-bold">{invite.fromName}</span> invited you to {invite.type === 'session' ? 'collaborate' : 'join'}: <span className={`font-bold ${invite.type === 'session' ? 'text-emerald-300' : 'text-indigo-300'}`}>{invite.groupName}</span>.
                                        </p>
                                        <div className="flex space-x-2 mt-3">
                                            <button 
                                                onClick={() => handleRespondInvite(invite, true)}
                                                disabled={processingId === invite.id}
                                                className={`flex-1 py-1.5 text-white text-xs font-bold rounded flex items-center justify-center space-x-1 ${invite.type === 'session' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}
                                            >
                                                {processingId === invite.id ? <Loader2 size={12} className="animate-spin"/> : (invite.type === 'session' ? <ExternalLink size={12}/> : <Check size={12}/>)}
                                                <span>{invite.type === 'session' ? 'Open' : 'Join'}</span>
                                            </button>
                                            <button 
                                                onClick={() => handleRespondInvite(invite, false)}
                                                disabled={processingId === invite.id}
                                                className="flex-1 py-1.5 bg-slate-800 hover:bg-red-900/30 text-slate-300 hover:text-red-400 text-xs font-bold rounded border border-slate-700"
                                            >
                                                <X size={12}/>
                                                <span>Ignore</span>
                                            </button>
                                        </div>
                                    </>
                                )}
                                <p className="text-xs text-slate-500 mt-1">
                                   {new Date(invite.createdAt).toLocaleDateString()}
                                </p>
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
