import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Coins, ArrowUpRight, ArrowDownLeft, RefreshCw, Send, 
  QrCode, Copy, Check, Loader2, History, Wallet, 
  ArrowLeft, Search, AlertCircle, Info, ShieldCheck,
  Zap, TrendingUp, CreditCard, ExternalLink, Smartphone, 
  Clock, CheckCircle, Database
} from 'lucide-react';
import { UserProfile, CoinTransaction } from '../types';
import { getCoinTransactions, transferCoins, getUserProfile } from '../services/firestoreService';
import { auth } from '../services/firebaseConfig';

interface CoinWalletProps {
  onBack: () => void;
  user: UserProfile | null;
  // Added onOpenManual prop to fix type error in App.tsx
  onOpenManual?: () => void;
}

export const CoinWallet: React.FC<CoinWalletProps> = ({ onBack, user, onOpenManual }) => {
  const [activeTab, setActiveTab] = useState<'history' | 'send' | 'receive'>('history');
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copyStatus, setCopyStatus] = useState(false);
  
  // Transfer State
  const [recipientId, setRecipientId] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [memo, setMemo] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState(false);

  const currentUser = auth?.currentUser;

  const loadData = useCallback(async () => {
    if (!currentUser) return;
    setIsRefreshing(true);
    try {
      const data = await getCoinTransactions(currentUser.uid);
      setTransactions(data);
    } catch (e) {
      console.error("Wallet sync failed", e);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCopyAddress = () => {
    if (!currentUser) return;
    navigator.clipboard.writeText(currentUser.uid);
    setCopyStatus(true);
    setTimeout(() => setCopyStatus(false), 2000);
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !amount || isProcessing) return;
    
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert("Invalid amount");
      return;
    }

    if (numAmount > (user?.coinBalance || 0)) {
      alert("Insufficient neural assets for this handshake.");
      return;
    }

    setIsProcessing(true);
    try {
      // Note: transferCoins handles the escrow/invitation creation in firestoreService
      await transferCoins(
        recipientId || 'unknown',
        'Recipient', // Display name placeholder, service looks it up or uses email
        recipientEmail,
        numAmount,
        memo || 'Neural Prism Transfer'
      );
      
      setTransferSuccess(true);
      setAmount('');
      setRecipientEmail('');
      setRecipientId('');
      setMemo('');
      
      loadData();
      
      setTimeout(() => setTransferSuccess(false), 5000);
    } catch (e: any) {
      alert("Handshake Refused: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const qrCodeUrl = useMemo(() => {
    if (!currentUser) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&bgcolor=ffffff&data=${encodeURIComponent(currentUser.uid)}`;
  }, [currentUser]);

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-20">
          <div className="flex items-center gap-4">
              <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-lg font-bold text-white flex items-center gap-2 italic uppercase tracking-tighter">
                    <Wallet className="text-amber-400" /> 
                    Neural Wallet
                </h1>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">VoiceCoin Ledger v6.9.8</p>
              </div>
          </div>
          <div className="flex items-center gap-3">
              <button 
                onClick={loadData} 
                className="p-2 text-slate-500 hover:text-white transition-all"
                title="Sync Ledger"
              >
                <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
              </button>
              {onOpenManual && <button onClick={onOpenManual} className="p-2 text-slate-400 hover:text-white" title="Wallet Manual"><Info size={18}/></button>}
          </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 md:p-8 scrollbar-hide">
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
          
          {/* Main Balance Card */}
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-[2.5rem] p-10 shadow-2xl shadow-amber-900/20 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-32 bg-white/10 blur-[100px] rounded-full group-hover:scale-110 transition-transform duration-1000"></div>
              <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                  <div className="space-y-2 text-center md:text-left">
                      <p className="text-amber-100/60 text-xs font-black uppercase tracking-[0.3em]">Total Neural Assets</p>
                      <div className="flex items-center gap-4 justify-center md:justify-start">
                        <h2 className="text-6xl font-black text-white tracking-tighter tabular-nums">
                            {user?.coinBalance?.toLocaleString() || '0'}
                        </h2>
                        <span className="text-2xl font-black text-amber-200/80 italic tracking-tighter">VC</span>
                      </div>
                  </div>
                  <div className="flex gap-3">
                      <button onClick={() => setActiveTab('send')} className="px-8 py-4 bg-white text-orange-600 font-black uppercase tracking-widest rounded-2xl shadow-xl hover:scale-105 transition-all active:scale-95 text-xs">Send</button>
                      <button onClick={() => setActiveTab('receive')} className="px-8 py-4 bg-black/20 text-white font-black uppercase tracking-widest rounded-2xl border border-white/20 hover:bg-black/30 transition-all active:scale-95 text-xs">Receive</button>
                  </div>
              </div>
          </div>

          <div className="flex bg-slate-900 p-1 rounded-2xl border border-slate-800 shadow-xl max-w-sm mx-auto">
              <button onClick={() => setActiveTab('history')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>History</button>
              <button onClick={() => setActiveTab('send')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === 'send' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>Dispatch</button>
              <button onClick={() => setActiveTab('receive')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === 'receive' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>Address</button>
          </div>

          {activeTab === 'history' && (
              <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                        <History size={14} className="text-indigo-400"/> Transaction Registry
                    </h3>
                  </div>

                  {loading ? (
                      <div className="py-20 flex flex-col items-center gap-4 text-indigo-400">
                          <Loader2 className="animate-spin" size={32}/>
                          <p className="text-[10px] font-black uppercase tracking-widest">Paging Ledger...</p>
                      </div>
                  ) : transactions.length === 0 ? (
                      <div className="py-20 flex flex-col items-center justify-center text-slate-700 bg-slate-900/20 rounded-[2.5rem] border-2 border-dashed border-slate-800 gap-4">
                          <Coins size={48} className="opacity-10"/>
                          <p className="text-sm font-bold uppercase tracking-widest">No activities recorded</p>
                      </div>
                  ) : (
                      <div className="grid grid-cols-1 gap-3">
                          {transactions.map(tx => (
                              <div key={tx.id} className="bg-slate-900 border border-slate-800 p-5 rounded-[2rem] flex items-center justify-between hover:border-indigo-500/30 transition-all group">
                                  <div className="flex items-center gap-5">
                                      <div className={`p-3 rounded-2xl ${tx.fromId === currentUser?.uid ? 'bg-red-900/20 text-red-400' : 'bg-emerald-900/20 text-emerald-400'}`}>
                                          {tx.fromId === currentUser?.uid ? <ArrowUpRight size={20}/> : <ArrowDownLeft size={20}/>}
                                      </div>
                                      <div>
                                          <h4 className="font-bold text-white uppercase tracking-tight">
                                              {tx.fromId === currentUser?.uid ? `Sent to ${tx.toName}` : `Received from ${tx.fromName}`}
                                          </h4>
                                          <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500 uppercase font-black">
                                              <span className="flex items-center gap-1"><Clock size={12}/> {new Date(tx.timestamp).toLocaleDateString()}</span>
                                              <span className="flex items-center gap-1"><Database size={12}/> {tx.type}</span>
                                          </div>
                                          {tx.memo && <p className="text-[10px] text-slate-600 mt-2 italic line-clamp-1">"{tx.memo}"</p>}
                                      </div>
                                  </div>
                                  <div className="text-right">
                                      <p className={`text-xl font-black tracking-tighter ${tx.fromId === currentUser?.uid ? 'text-red-400' : 'text-emerald-400'}`}>
                                          {tx.fromId === currentUser?.uid ? '-' : '+'}{tx.amount.toLocaleString()}
                                      </p>
                                      {tx.isVerified && (
                                          <div className="flex items-center justify-end gap-1 mt-1 text-indigo-400">
                                              <ShieldCheck size={10}/>
                                              <span className="text-[8px] font-black uppercase">Notarized</span>
                                          </div>
                                      )}
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          )}

          {activeTab === 'send' && (
              <div className="max-w-xl mx-auto w-full animate-fade-in-up">
                  <form onSubmit={handleTransfer} className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl space-y-8 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-16 bg-indigo-500/5 blur-3xl rounded-full"></div>
                      
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Recipient Ledger URI / Email</label>
                        <input 
                            required
                            type="text" 
                            placeholder="member@email.com or UID..." 
                            className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white focus:ring-2 focus:ring-indigo-500 outline-none shadow-inner"
                            value={recipientEmail}
                            onChange={e => setRecipientEmail(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Asset Mass (Amount)</label>
                        <div className="relative">
                            <input 
                                required
                                type="number" 
                                placeholder="0.00" 
                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-6 py-5 text-2xl font-black text-white focus:ring-2 focus:ring-amber-500 outline-none shadow-inner"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                            />
                            <Coins className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500" size={24}/>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Neural Memo</label>
                        <textarea 
                            rows={3}
                            placeholder="Context for this transfer..." 
                            className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-sm text-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none resize-none shadow-inner"
                            value={memo}
                            onChange={e => setMemo(e.target.value)}
                        />
                      </div>

                      {transferSuccess ? (
                          <div className="p-6 bg-emerald-900/20 border border-emerald-500/30 rounded-2xl flex flex-col items-center gap-3 animate-fade-in">
                              <CheckCircle className="text-emerald-500" size={32}/>
                              <p className="text-sm font-bold text-emerald-400 uppercase tracking-widest">Handshake Finalized</p>
                          </div>
                      ) : (
                          <button 
                            type="submit" 
                            disabled={isProcessing || !amount || !recipientEmail}
                            className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-[0.2em] rounded-[2rem] shadow-2xl shadow-indigo-900/40 transition-all active:scale-95 disabled:opacity-30 flex items-center justify-center gap-3"
                          >
                            {isProcessing ? <Loader2 className="animate-spin" size={24}/> : <Zap size={20} fill="currentColor"/>}
                            <span>Execute Dispatch</span>
                          </button>
                      )}
                  </form>
              </div>
          )}

          {activeTab === 'receive' && (
              <div className="max-w-xl mx-auto w-full animate-fade-in-up">
                  <div className="bg-slate-900 border border-slate-800 rounded-[3.5rem] p-12 text-center shadow-2xl space-y-10 relative overflow-hidden">
                      <div className="absolute top-0 left-0 p-24 bg-amber-500/5 blur-[80px] rounded-full"></div>
                      
                      <div className="space-y-2">
                        <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Your Public URI</h2>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em]">Scan to initiate neural handshake</p>
                      </div>

                      <div className="bg-white p-8 rounded-[3rem] shadow-2xl relative inline-block group">
                          <div className="absolute inset-0 bg-indigo-600/5 group-hover:bg-indigo-600/10 transition-colors pointer-events-none rounded-[3rem]"></div>
                          <img src={qrCodeUrl} className="w-48 h-48" alt="Wallet QR" />
                      </div>

                      <div className="space-y-4">
                          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-inner">
                              <code className="text-[10px] font-mono text-indigo-300 truncate max-w-[200px]">{currentUser?.uid}</code>
                              <button onClick={handleCopyAddress} className="p-2 hover:bg-slate-800 rounded-xl text-slate-500 hover:text-white transition-all">
                                  {copyStatus ? <Check size={18} className="text-emerald-400"/> : <Copy size={18}/>}
                              </button>
                          </div>
                          <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest leading-relaxed">
                              This is your sovereign ledger address. Share it to receive VoiceCoins from other activity nodes.
                          </p>
                      </div>
                  </div>
              </div>
          )}

        </div>
      </div>

      <footer className="p-4 text-center border-t border-slate-800 bg-slate-950 shrink-0">
          <p className="text-[9px] font-black text-slate-700 uppercase tracking-[0.5em]">Neural Ledger Stability: 100.0%</p>
      </footer>
    </div>
  );
};

export default CoinWallet;