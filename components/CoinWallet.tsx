
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Wallet, Send, Clock, Sparkles, Loader2, User, Search, ArrowUpRight, ArrowDownLeft, Gift, Coins, Info, DollarSign, Zap, Crown, RefreshCw, X, CheckCircle, Smartphone } from 'lucide-react';
import { UserProfile, CoinTransaction } from '../types';
import { getCoinTransactions, transferCoins, checkAndGrantMonthlyCoins, getAllUsers } from '../services/firestoreService';
import { auth } from '../services/firebaseConfig';

interface CoinWalletProps {
  onBack: () => void;
  user: UserProfile | null;
}

export const CoinWallet: React.FC<CoinWalletProps> = ({ onBack, user }) => {
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

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getCoinTransactions(user.uid);
      setTransactions(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
      setIsRefreshing(true);
      await loadData();
      setIsRefreshing(false);
  };

  const handleClaimGrant = async () => {
      if (!user) return;
      setGranting(true);
      try {
          const granted = await checkAndGrantMonthlyCoins(user.uid);
          if (granted > 0) {
              alert(`Successfully claimed your monthly grant of ${granted} coins!`);
              await loadData();
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
          await loadData();
      } catch(e: any) {
          alert("Transfer failed: " + e.message);
      } finally {
          setIsTransferring(false);
      }
  };

  const handleSearchUsers = async () => {
      setLoading(true);
      try {
          const users = await getAllUsers();
          setAllUsers(users.filter(u => u.uid !== user?.uid));
      } catch(e) {} finally { setLoading(false); }
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

  if (!user) return null;

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
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
          <button onClick={handleRefresh} disabled={isRefreshing} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400">
              <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''}/>
          </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 max-w-4xl mx-auto w-full scrollbar-thin">
          
          {/* Balance Card */}
          <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-32 bg-white/10 blur-[80px] rounded-full group-hover:bg-white/20 transition-all"></div>
              <div className="relative z-10">
                  <div className="flex justify-between items-start mb-8">
                      <div>
                          <p className="text-indigo-100 text-xs font-bold uppercase tracking-[0.2em] mb-1">Available Coins</p>
                          <div className="flex items-center gap-3">
                              <h2 className="text-5xl font-black text-white">{user.coinBalance || 0}</h2>
                              <div className="bg-white/20 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] font-bold text-white uppercase">VC</div>
                          </div>
                          <p className="text-indigo-200 text-sm mt-2 opacity-80">≈ {formatCurrency(user.coinBalance || 0)} USD</p>
                      </div>
                      <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
                          <Coins size={32} className="text-amber-300" />
                      </div>
                  </div>
                  
                  <div className="flex gap-4">
                      <button 
                        onClick={() => setShowTransfer(true)}
                        className="flex-1 bg-white text-indigo-900 font-bold py-3 rounded-xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                          <Send size={18} />
                          <span>Transfer</span>
                      </button>
                      <button 
                        onClick={handleClaimGrant}
                        disabled={granting}
                        className="flex-1 bg-indigo-500/30 text-white font-bold py-3 rounded-xl border border-white/20 hover:bg-white/10 transition-all flex items-center justify-center gap-2"
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
                  <div className="p-2 bg-indigo-900/30 rounded-lg text-indigo-400"><Info size={20}/></div>
                  <div>
                      <h4 className="text-sm font-bold text-white mb-1">Free Allowance</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">Basic members receive 100 free coins ($1.00) every 30 days to support learning and peer interaction.</p>
                  </div>
              </div>
              <div className="bg-slate-900 border border-indigo-500/30 p-5 rounded-2xl flex items-start gap-4 relative overflow-hidden">
                  {user.subscriptionTier === 'pro' && <div className="absolute top-2 right-2"><Crown size={14} className="text-amber-400 fill-amber-400"/></div>}
                  <div className="p-2 bg-amber-900/30 rounded-lg text-amber-400"><Zap size={20}/></div>
                  <div>
                      <h4 className="text-sm font-bold text-white mb-1">Pro Member Perk</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">Pro members receive a massive 2,900 coin allowance ($29.00) monthly. Upgrade to fuel your mentoring journey.</p>
                  </div>
              </div>
          </div>

          {/* Recent Activity */}
          <div className="space-y-4">
              <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Clock size={16}/> Recent Transactions</h3>
                  <button className="text-xs text-indigo-400 font-bold hover:underline">View All</button>
              </div>
              
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800 shadow-xl">
                  {loading ? (
                      <div className="p-12 text-center text-slate-500"><Loader2 className="animate-spin mx-auto mb-2" /> Loading ledger...</div>
                  ) : transactions.length === 0 ? (
                      <div className="p-12 text-center text-slate-500 italic">No transactions found.</div>
                  ) : (
                      transactions.map(tx => {
                          const isIncoming = tx.toId === user.uid;
                          const icon = tx.type === 'grant' ? <Sparkles size={16}/> : tx.type === 'check' ? <Smartphone size={16}/> : tx.type === 'mentoring' ? <User size={16}/> : <Send size={16}/>;
                          
                          return (
                              <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                                  <div className="flex items-center gap-4">
                                      <div className={`p-2 rounded-xl ${isIncoming ? 'bg-emerald-900/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                                          {isIncoming ? <ArrowDownLeft size={20}/> : <ArrowUpRight size={20}/>}
                                      </div>
                                      <div>
                                          <p className="text-sm font-bold text-white flex items-center gap-2">
                                              {tx.type === 'grant' ? 'Monthly Allowance' : isIncoming ? `From ${tx.fromName}` : `To ${tx.toName}`}
                                              <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 uppercase font-bold tracking-tighter flex items-center gap-1">{icon} {tx.type}</span>
                                          </p>
                                          <p className="text-xs text-slate-500 mt-0.5">{tx.memo || new Date(tx.timestamp).toLocaleString()}</p>
                                      </div>
                                  </div>
                                  <div className={`text-sm font-black ${isIncoming ? 'text-emerald-400' : 'text-white'}`}>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl">
                  <div className="p-5 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
                      <h3 className="font-bold text-white flex items-center gap-2"><Send size={18} className="text-indigo-400"/> Send Coins</h3>
                      <button onClick={() => { setShowTransfer(false); setSelectedUser(null); }} className="text-slate-500 hover:text-white"><X/></button>
                  </div>
                  
                  <div className="p-6 space-y-6">
                      {!selectedUser ? (
                          <div className="space-y-4">
                              <div className="relative">
                                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16}/>
                                  <input 
                                    autoFocus
                                    type="text" 
                                    placeholder="Search member by name..." 
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                                  />
                              </div>
                              <div className="max-h-60 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                                  {filteredUsers.map(u => (
                                      <button 
                                        key={u.uid}
                                        onClick={() => setSelectedUser(u)}
                                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800 transition-colors text-left"
                                      >
                                          <img src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}`} className="w-10 h-10 rounded-full border border-slate-700" />
                                          <div>
                                              <p className="text-sm font-bold text-white">{u.displayName}</p>
                                              <p className="text-[10px] text-slate-500 uppercase font-bold">Community Member</p>
                                          </div>
                                      </button>
                                  ))}
                              </div>
                          </div>
                      ) : (
                          <div className="space-y-6 animate-fade-in">
                              <div className="flex items-center gap-4 bg-indigo-900/10 p-4 rounded-2xl border border-indigo-500/20">
                                  <img src={selectedUser.photoURL || `https://ui-avatars.com/api/?name=${selectedUser.displayName}`} className="w-12 h-12 rounded-full" />
                                  <div>
                                      <p className="text-xs text-indigo-400 font-bold uppercase tracking-widest">Recipient</p>
                                      <p className="text-lg font-bold text-white">{selectedUser.displayName}</p>
                                  </div>
                                  <button onClick={() => setSelectedUser(null)} className="ml-auto text-[10px] font-bold text-slate-500 hover:text-white underline uppercase">Change</button>
                              </div>
                              
                              <div className="space-y-4">
                                  <div>
                                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Amount (Coins)</label>
                                      <div className="relative">
                                          <Coins className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-500" size={20}/>
                                          <input 
                                            type="number" 
                                            value={transferAmount}
                                            onChange={e => setTransferAmount(e.target.value)}
                                            placeholder="0"
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-4 text-2xl font-black text-white focus:outline-none focus:border-amber-500"
                                          />
                                      </div>
                                      <p className="text-[10px] text-slate-600 mt-1">Balance: {user.coinBalance} coins</p>
                                  </div>
                                  <div>
                                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Memo (Optional)</label>
                                      <input 
                                        type="text" 
                                        value={transferMemo}
                                        onChange={e => setTransferMemo(e.target.value)}
                                        placeholder="Thanks for the tip!..."
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                                      />
                                  </div>
                              </div>

                              <button 
                                onClick={handleTransfer}
                                disabled={isTransferring || !transferAmount}
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all disabled:opacity-50"
                              >
                                  {isTransferring ? <Loader2 className="animate-spin mx-auto"/> : 'Confirm Transfer'}
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
