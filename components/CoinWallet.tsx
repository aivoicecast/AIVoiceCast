import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Wallet, Send, Clock, Sparkles, Loader2, User, Search, ArrowUpRight, ArrowDownLeft, Gift, Coins, Info, DollarSign, Zap, Crown, RefreshCw, X, CheckCircle, Smartphone, HardDrive, AlertTriangle, ChevronRight } from 'lucide-react';
import { UserProfile, CoinTransaction } from '../types';
import { getCoinTransactions, transferCoins, checkAndGrantMonthlyCoins, getAllUsers, getUserProfile } from '../services/firestoreService';
import { auth } from '../services/firebaseConfig';

interface CoinWalletProps {
  onBack: () => void;
  user: UserProfile | null;
}

export const CoinWallet: React.FC<CoinWalletProps> = ({ onBack, user: initialUser }) => {
  const [user, setUser] = useState<UserProfile | null>(initialUser);
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [granting, setGranting] = useState(false);
  
  // Transfer State
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferMemo, setTransferMemo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  // Load user profile and fetch transactions
  const initWallet = useCallback(async () => {
    setLoading(true);
    try {
        let activeUser = user || initialUser;
        const currentUid = auth?.currentUser?.uid;
        
        // 1. If we don't have a user object yet but we have a UID, fetch it
        if (!activeUser && currentUid) {
            const profile = await getUserProfile(currentUid);
            if (profile) {
                setUser(profile);
                activeUser = profile;
            }
        }

        // 2. Fetch transactions if we have a user
        if (activeUser?.uid) {
            const data = await getCoinTransactions(activeUser.uid);
            setTransactions(data);
        }
    } catch (e) {
        console.error("Wallet initialization failed", e);
    } finally {
        setLoading(false);
    }
  }, [initialUser, user?.uid]);

  useEffect(() => {
    initWallet();
  }, [initWallet]);

  const handleRefresh = async () => {
      setIsRefreshing(true);
      try {
          const currentUid = auth?.currentUser?.uid;
          if (currentUid) {
              const [data, freshProfile] = await Promise.all([
                  getCoinTransactions(currentUid),
                  getUserProfile(currentUid)
              ]);
              setTransactions(data);
              if (freshProfile) setUser(freshProfile);
          }
      } catch(e) {
          console.error("Refresh failed", e);
      } finally {
          setIsRefreshing(false);
      }
  };

  const handleClaimGrant = async () => {
      if (!user) return;
      setGranting(true);
      try {
          const granted = await checkAndGrantMonthlyCoins(user.uid);
          if (granted > 0) {
              alert(`Successfully claimed your monthly grant of ${granted} coins!`);
              await handleRefresh();
          } else {
              alert("You have already claimed your grant for this month. Please come back in 30 days!");
          }
      } catch(e) {
          alert("Failed to claim grant.");
      } finally {
          setGranting(false);
      }
  };

  const handleTransfer = async () => {
      if (!selectedUser || !transferAmount || !user) return;
      const amount = parseInt(transferAmount);
      if (isNaN(amount) || amount <= 0) return alert("Enter valid amount.");
      if (amount > user.coinBalance) return alert("Insufficient balance.");

      setIsTransferring(true);
      try {
          await transferCoins(selectedUser.uid, selectedUser.displayName, amount, transferMemo);
          alert(`Sent ${amount} coins to ${selectedUser.displayName}!`);
          setShowTransfer(false);
          setSelectedUser(null);
          setTransferAmount('');
          setTransferMemo('');
          await handleRefresh();
      } catch(e: any) {
          alert("Transfer failed: " + e.message);
      } finally {
          setIsTransferring(false);
      }
  };

  const handleSearchUsers = async () => {
      try {
          const users = await getAllUsers();
          const currentUid = auth?.currentUser?.uid;
          setAllUsers(users.filter(u => u.uid !== currentUid));
      } catch(e) {}
  };

  useEffect(() => {
      if (showTransfer) handleSearchUsers();
  }, [showTransfer]);

  const filteredUsers = allUsers.filter(u => 
      u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const formatCurrency = (coins: number) => {
      return (coins / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };

  // Spinner while we attempt initial connection
  if (loading && !user) return (
      <div className="h-full flex items-center justify-center bg-slate-950">
          <div className="text-center space-y-6">
              <div className="relative">
                <Loader2 className="animate-spin text-indigo-500 mx-auto" size={48}/>
                <Coins className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-amber-500/50" size={20}/>
              </div>
              <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] animate-pulse">Accessing Neural Ledger...</p>
          </div>
      </div>
  );

  // Handle case where auth/profile load completely failed
  if (!user) return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-950 text-center p-8">
          <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center mb-6 border border-amber-500/20">
            <AlertTriangle className="text-amber-500" size={40} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Wallet Disconnected</h2>
          <p className="text-slate-400 text-sm max-w-xs mx-auto mb-8 leading-relaxed">We couldn't synchronize your local profile with the neural network. Please check your connection or sign in again.</p>
          <div className="flex gap-4">
            <button onClick={onBack} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all border border-slate-700">Go Back</button>
            <button onClick={initWallet} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20">Retry Sync</button>
          </div>
      </div>
  );

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden animate-fade-in">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-20">
          <div className="flex items-center gap-4">
              <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                  <ArrowLeft size={20} />
              </button>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                  <Coins className="text-amber-400" />
                  Voice Wallet
              </h1>
          </div>
          <button onClick={handleRefresh} disabled={isRefreshing} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
              <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''}/>
          </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 max-w-4xl mx-auto w-full scrollbar-thin scrollbar-thumb-slate-800">
          
          {/* Balance Card */}
          <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-32 bg-white/10 blur-[80px] rounded-full group-hover:bg-white/20 transition-all"></div>
              <div className="relative z-10">
                  <div className="flex justify-between items-start mb-8">
                      <div>
                          <p className="text-indigo-100 text-xs font-bold uppercase tracking-[0.2em] mb-1 opacity-80">Available Balance</p>
                          <div className="flex items-center gap-3">
                              <h2 className="text-5xl font-black text-white tracking-tighter">{user.coinBalance || 0}</h2>
                              <div className="bg-white/20 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] font-bold text-white uppercase border border-white/10">VC</div>
                          </div>
                          <p className="text-indigo-200 text-sm mt-2 opacity-80 font-mono tracking-tighter">Est. Value: {formatCurrency(user.coinBalance || 0)}</p>
                      </div>
                      <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl">
                          <Coins size={32} className="text-amber-300" />
                      </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={() => setShowTransfer(true)}
                        className="bg-white text-indigo-900 font-bold py-3.5 rounded-2xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                          <Send size={18} className="rotate-[-20deg]" />
                          <span>Send Coins</span>
                      </button>
                      <button 
                        onClick={handleClaimGrant}
                        disabled={granting}
                        className="bg-indigo-500/30 text-white font-bold py-3.5 rounded-2xl border border-white/20 hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                      >
                          {granting ? <Loader2 size={18} className="animate-spin"/> : <Sparkles size={18} />}
                          <span>Claim Grant</span>
                      </button>
                  </div>
              </div>
          </div>

          {/* Monthly Allowance Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-start gap-4">
                  <div className="p-2.5 bg-indigo-900/30 rounded-xl text-indigo-400"><Info size={20}/></div>
                  <div>
                      <h4 className="text-sm font-bold text-white mb-1">Standard Allowance</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">Basic members receive 100 free coins every 30 days to support peer learning.</p>
                  </div>
              </div>
              <div className="bg-slate-900 border border-indigo-500/20 p-5 rounded-2xl flex items-start gap-4 relative overflow-hidden">
                  {user.subscriptionTier === 'pro' && <div className="absolute top-2 right-2"><Crown size={12} className="text-amber-400 fill-amber-400"/></div>}
                  <div className="p-2.5 bg-amber-900/30 rounded-xl text-amber-400"><Zap size={20}/></div>
                  <div>
                      <h4 className="text-sm font-bold text-white mb-1">Pro Member Benefit</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">Pro members receive 2,900 coins monthly. Upgrade to fuel high-intensity mentoring.</p>
                  </div>
              </div>
          </div>

          {/* Recent Activity */}
          <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2"><Clock size={16}/> Transaction Ledger</h3>
                  <button onClick={handleRefresh} className="text-[10px] text-indigo-400 font-bold hover:text-white transition-colors uppercase tracking-widest">Sync Ledger</button>
              </div>
              
              <div className="bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden divide-y divide-slate-800 shadow-2xl">
                  {isRefreshing && transactions.length === 0 ? (
                      <div className="p-20 text-center text-slate-500 flex flex-col items-center gap-4">
                          <Loader2 className="animate-spin text-indigo-500" size={32} />
                          <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-50">Syncing Block History...</p>
                      </div>
                  ) : transactions.length === 0 ? (
                      <div className="p-20 text-center space-y-5">
                          <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto opacity-20">
                              <HardDrive size={32} className="text-slate-400" />
                          </div>
                          <p className="text-slate-500 italic text-sm">No ledger entries found on this account.</p>
                          <button onClick={handleClaimGrant} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded-lg text-xs font-bold transition-all">Claim Initial Grant</button>
                      </div>
                  ) : (
                      transactions.map(tx => {
                          const isIncoming = tx.toId === user.uid;
                          const icon = tx.type === 'grant' ? <Sparkles size={16}/> : tx.type === 'check' ? <Smartphone size={16}/> : tx.type === 'mentoring' ? <User size={16}/> : <Send size={16}/>;
                          
                          return (
                              <div key={tx.id} className="p-5 flex items-center justify-between hover:bg-slate-800/40 transition-all group">
                                  <div className="flex items-center gap-4">
                                      <div className={`p-3 rounded-2xl transition-transform group-hover:scale-110 ${isIncoming ? 'bg-emerald-900/20 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                                          {isIncoming ? <ArrowDownLeft size={24}/> : <ArrowUpRight size={24}/>}
                                      </div>
                                      <div>
                                          <p className="text-sm font-bold text-white flex items-center gap-2">
                                              {tx.type === 'grant' ? 'Neural Grant' : isIncoming ? `From ${tx.fromName}` : `To ${tx.toName}`}
                                              <span className="text-[9px] bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-500 uppercase font-black tracking-tighter flex items-center gap-1.5">{icon} {tx.type}</span>
                                          </p>
                                          <p className="text-[10px] text-slate-500 mt-1 font-medium">{tx.memo || new Date(tx.timestamp).toLocaleString()}</p>
                                      </div>
                                  </div>
                                  <div className={`text-xl font-black ${isIncoming ? 'text-emerald-400' : 'text-slate-200'}`}>
                                      {isIncoming ? '+' : '-'}{tx.amount}
                                  </div>
                              </div>
                          );
                      })
                  )}
              </div>
          </div>

      </div>

      {/* Transfer Modal */}
      {showTransfer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
              <div className="bg-slate-900 border border-slate-700 rounded-[2rem] w-full max-w-md overflow-hidden flex flex-col shadow-2xl">
                  <div className="p-6 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
                      <h3 className="font-bold text-white flex items-center gap-2"><Send size={18} className="text-indigo-400 rotate-[-20deg]"/> Send Coins</h3>
                      <button onClick={() => { setShowTransfer(false); setSelectedUser(null); }} className="p-1.5 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white transition-colors"><X size={20}/></button>
                  </div>
                  
                  <div className="p-6 space-y-6">
                      {!selectedUser ? (
                          <div className="space-y-4">
                              <div className="relative">
                                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                                  <input 
                                    autoFocus
                                    type="text" 
                                    placeholder="Find member..." 
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                  />
                              </div>
                              <div className="max-h-64 overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                                  {filteredUsers.length === 0 ? (
                                      <p className="text-center py-8 text-slate-600 text-sm">No members found.</p>
                                  ) : filteredUsers.map(u => (
                                      <button 
                                        key={u.uid}
                                        onClick={() => setSelectedUser(u)}
                                        className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-800 transition-all text-left group"
                                      >
                                          <img src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}`} className="w-10 h-10 rounded-full border border-slate-700 group-hover:border-indigo-500" />
                                          <div className="min-w-0">
                                              <p className="text-sm font-bold text-white truncate">{u.displayName}</p>
                                              <p className="text-[10px] text-slate-500 uppercase font-bold">Verified Member</p>
                                          </div>
                                          <ChevronRight size={16} className="ml-auto text-slate-700 group-hover:text-indigo-400"/>
                                      </button>
                                  ))}
                              </div>
                          </div>
                      ) : (
                          <div className="space-y-6 animate-fade-in">
                              <div className="flex items-center gap-4 bg-indigo-900/10 p-5 rounded-3xl border border-indigo-500/20">
                                  <img src={selectedUser.photoURL || `https://ui-avatars.com/api/?name=${selectedUser.displayName}`} className="w-14 h-14 rounded-full border-2 border-indigo-500" />
                                  <div className="min-w-0">
                                      <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-[0.2em] mb-1">Recipient</p>
                                      <p className="text-xl font-bold text-white truncate">{selectedUser.displayName}</p>
                                  </div>
                                  <button onClick={() => setSelectedUser(null)} className="ml-auto p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors"><RefreshCw size={14}/></button>
                              </div>
                              
                              <div className="space-y-4">
                                  <div>
                                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2 px-1">Amount to Transfer</label>
                                      <div className="relative">
                                          <Coins className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500" size={24}/>
                                          <input 
                                            type="number" 
                                            value={transferAmount}
                                            onChange={e => setTransferAmount(e.target.value)}
                                            placeholder="0"
                                            className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-6 py-5 text-4xl font-black text-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 transition-all placeholder-slate-800"
                                          />
                                      </div>
                                      <div className="flex justify-between items-center mt-2 px-1">
                                          <p className="text-[10px] text-slate-600 font-bold">Balance: {user.coinBalance} VC</p>
                                          <button 
                                            onClick={() => setTransferAmount(user.coinBalance.toString())}
                                            className="text-[10px] text-indigo-400 hover:text-white font-bold uppercase tracking-wider"
                                          >
                                              Max Amount
                                          </button>
                                      </div>
                                  </div>
                                  <div>
                                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2 px-1">Attachment Memo</label>
                                      <input 
                                        type="text" 
                                        value={transferMemo}
                                        onChange={e => setTransferMemo(e.target.value)}
                                        placeholder="Add a message..."
                                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                                      />
                                  </div>
                              </div>

                              <button 
                                onClick={handleTransfer}
                                disabled={isTransferring || !transferAmount || parseInt(transferAmount) <= 0}
                                className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-black uppercase tracking-widest rounded-2xl shadow-2xl shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95"
                              >
                                  {isTransferring ? <Loader2 size={24} className="animate-spin mx-auto"/> : 'Execute Transfer'}
                              </button>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};