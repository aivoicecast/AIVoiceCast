
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ArrowLeft, Wallet, Send, Clock, Sparkles, Loader2, User, Search, ArrowUpRight, ArrowDownLeft, Gift, Coins, Info, DollarSign, Zap, Crown, RefreshCw, X, CheckCircle, Smartphone, HardDrive, AlertTriangle, ChevronRight, Key, ShieldCheck, QrCode, Download, Upload, Shield, Eye, Lock, Copy, Check, Heart, Globe, WifiOff, Camera, Share2, Link, FileText, ChevronDown, Edit3, HeartHandshake, Percent, Filter, History, Signature } from 'lucide-react';
import { UserProfile, CoinTransaction, OfflinePaymentToken, PendingClaim } from '../types';
import { getCoinTransactions, transferCoins, checkAndGrantMonthlyCoins, getAllUsers, getUserProfile, registerIdentity, claimOfflinePayment, DEFAULT_MONTHLY_GRANT } from '../services/firestoreService';
import { auth, db } from '../services/firebaseConfig';
import { onAuthStateChanged } from '@firebase/auth';
import { generateMemberIdentity, requestIdentityCertificate, verifyCertificateOffline, verifySignature, signPayment, AIVOICECAST_TRUST_PUBLIC_KEY } from '../utils/cryptoUtils';
import { generateSecureId } from '../utils/idUtils';
import { getLocalPrivateKey, saveLocalPrivateKey } from '../utils/db';

interface CoinWalletProps {
  onBack: () => void;
  user: UserProfile | null;
}

export const CoinWallet: React.FC<CoinWalletProps> = ({ onBack, user: propUser }) => {
  const [user, setUser] = useState<UserProfile | null>(propUser);
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Ledger Search & Filter
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'in' | 'out'>('all');

  // Transfer States
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferMemo, setTransferMemo] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'input' | 'processing' | 'receipt'>('input');

  // Identity & Offline States
  const [isCreatingIdentity, setIsCreatingIdentity] = useState(false);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [pastedToken, setPastedToken] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedToken, setVerifiedToken] = useState<OfflinePaymentToken | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);

  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);

  useEffect(() => {
    if (propUser) {
        setUser(propUser);
    } else if (auth?.currentUser) {
        getUserProfile(auth.currentUser.uid).then(setUser);
    }
  }, [propUser]);

  useEffect(() => {
      if (user?.uid) {
          getLocalPrivateKey(user.uid).then(key => {
              if (key) setPrivateKey(key);
          });
          loadTransactions();
      }
  }, [user?.uid]);

  const loadTransactions = async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
        const data = await getCoinTransactions(user.uid);
        setTransactions(data);
    } catch(e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  const handleRefresh = async () => {
      if (!user?.uid) return;
      setIsRefreshing(true);
      try {
          await checkAndGrantMonthlyCoins(user.uid);
          const [profile, txs] = await Promise.all([
              getUserProfile(user.uid),
              getCoinTransactions(user.uid)
          ]);
          if (profile) setUser(profile);
          setTransactions(txs);
      } finally {
          setIsRefreshing(false);
      }
  };

  const handleCreateIdentity = async () => {
      if (!user || isCreatingIdentity) return;
      if (!confirm("Generate a new Cryptographic Identity? This will store a unique Private Key in this browser's local database. This key is used to sign offline payments.")) return;
      
      setIsCreatingIdentity(true);
      try {
          const { publicKey, privateKey } = await generateMemberIdentity();
          const certificate = await requestIdentityCertificate(publicKey);
          
          await registerIdentity(user.uid, publicKey, certificate);
          await saveLocalPrivateKey(user.uid, privateKey);
          
          setPrivateKey(privateKey);
          const updated = await getUserProfile(user.uid);
          if (updated) setUser(updated);
          
          alert("Neural Identity Registered! You can now participate in peer-to-peer VoiceCoin transactions.");
      } catch (e: any) {
          alert("Identity registration failed: " + e.message);
      } finally {
          setIsCreatingIdentity(false);
      }
  };

  const handleVerifyToken = async () => {
      if (!pastedToken.trim()) return;
      setIsVerifying(true);
      setVerificationError(null);
      try {
          const token: OfflinePaymentToken = JSON.parse(atob(pastedToken));
          const isValid = await verifySignature(token.certificate, token.signature, {
              senderId: token.senderId,
              recipientId: token.recipientId,
              amount: token.amount,
              nonce: token.nonce,
              timestamp: token.timestamp
          });

          if (!isValid) throw new Error("Cryptographic signature mismatch. Token may be forged.");
          if (!verifyCertificateOffline(token.certificate)) throw new Error("Identity certificate not recognized by AIVoiceCast Trust Root.");

          setVerifiedToken(token);
      } catch (e: any) {
          setVerificationError(e.message);
      } finally {
          setIsVerifying(false);
      }
  };

  const handleClaim = async () => {
      if (!verifiedToken || !user) return;
      setIsClaiming(true);
      try {
          await claimOfflinePayment(verifiedToken);
          alert(`Successfully claimed ${verifiedToken.amount} VoiceCoins!`);
          setVerifiedToken(null);
          setPastedToken('');
          handleRefresh();
      } catch (e: any) {
          alert("Claim failed: " + e.message);
      } finally {
          setIsClaiming(false);
      }
  };

  const filteredLedger = useMemo(() => {
      let result = transactions;
      if (ledgerFilter === 'in') result = result.filter(tx => tx.toId === user?.uid);
      if (ledgerFilter === 'out') result = result.filter(tx => tx.fromId === user?.uid);
      
      if (ledgerSearch.trim()) {
          const q = ledgerSearch.toLowerCase();
          result = result.filter(tx => 
              tx.fromName.toLowerCase().includes(q) || 
              tx.toName.toLowerCase().includes(q) || 
              (tx.memo && tx.memo.toLowerCase().includes(q))
          );
      }
      return result;
  }, [transactions, ledgerSearch, ledgerFilter, user?.uid]);

  return (
    <div className="h-full bg-slate-950 text-slate-100 flex flex-col overflow-hidden animate-fade-in">
      {/* Header */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-20">
          <div className="flex items-center gap-4">
              <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"><ArrowLeft size={20} /></button>
              <h1 className="text-lg font-bold text-white flex items-center gap-2"><Wallet className="text-amber-500" /> Neural Wallet</h1>
          </div>
          <button onClick={handleRefresh} disabled={isRefreshing} className="p-2 text-slate-400 hover:text-white">
              <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
      </header>

      <main className="flex-1 overflow-y-auto p-6 md:p-8 scrollbar-hide">
          <div className="max-w-4xl mx-auto space-y-8 pb-20">
              
              {/* Balance Card */}
              <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-32 bg-white/10 blur-[100px] rounded-full pointer-events-none transition-transform group-hover:scale-110 duration-700"></div>
                  <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                      <div className="text-center md:text-left">
                          <p className="text-indigo-100/60 text-xs font-black uppercase tracking-[0.3em] mb-2">Available Balance</p>
                          <div className="flex items-center justify-center md:justify-start gap-4">
                              <Coins className="text-amber-400" size={48} />
                              <span className="text-6xl font-black text-white tracking-tighter tabular-nums">{user?.coinBalance || 0}</span>
                          </div>
                      </div>
                      <div className="flex gap-3">
                          <button onClick={() => setShowTokenInput(true)} className="px-6 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-2xl text-xs font-black uppercase tracking-widest text-white transition-all active:scale-95">Claim Offline</button>
                          <button className="px-8 py-3 bg-white text-indigo-600 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all">Send Coins</button>
                      </div>
                  </div>
              </div>

              {/* Status Bar */}
              {!user?.publicKey && (
                  <div className="bg-amber-900/20 border border-amber-500/30 p-6 rounded-3xl flex flex-col md:flex-row items-center gap-6 animate-fade-in">
                      <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-xl shadow-amber-900/30"><Shield size={24}/></div>
                      <div className="flex-1 text-center md:text-left">
                          <h3 className="font-bold text-white uppercase tracking-wider">Identity Unverified</h3>
                          <p className="text-xs text-slate-400 mt-1">Register your cryptographic identity to enable peer-to-peer transfers and secure signing.</p>
                      </div>
                      <button onClick={handleCreateIdentity} disabled={isCreatingIdentity} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg">
                          {isCreatingIdentity ? <Loader2 size={16} className="animate-spin" /> : 'Register Now'}
                      </button>
                  </div>
              )}

              {/* Transactions Ledger */}
              <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <h2 className="text-xl font-bold text-white flex items-center gap-2"><History className="text-slate-500" size={20}/> Neural Ledger</h2>
                      <div className="flex gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
                          <button onClick={() => setLedgerFilter('all')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${ledgerFilter === 'all' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}>All</button>
                          <button onClick={() => setLedgerFilter('in')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${ledgerFilter === 'in' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}>In</button>
                          <button onClick={() => setLedgerFilter('out')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${ledgerFilter === 'out' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}>Out</button>
                      </div>
                  </div>

                  <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={16}/>
                      <input 
                        type="text" 
                        placeholder="Search ledger by name, memo, or amount..."
                        value={ledgerSearch}
                        onChange={e => setLedgerSearch(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-4 py-3 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-inner"
                      />
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden shadow-2xl">
                      {loading ? (
                          <div className="py-20 flex flex-col items-center justify-center gap-4 text-indigo-400">
                              <Loader2 className="animate-spin" size={32}/>
                              <span className="text-[10px] font-black uppercase tracking-widest">Scanning Blockchain...</span>
                          </div>
                      ) : filteredLedger.length === 0 ? (
                          <div className="py-20 text-center text-slate-600 italic text-sm">No ledger entries found.</div>
                      ) : (
                          <div className="divide-y divide-slate-800">
                              {filteredLedger.map((tx) => {
                                  const isIncoming = tx.toId === user?.uid;
                                  return (
                                      <div key={tx.id} className="p-5 flex items-center justify-between hover:bg-slate-800/30 transition-colors group">
                                          <div className="flex items-center gap-4">
                                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isIncoming ? 'bg-emerald-900/20 text-emerald-400' : 'bg-red-900/20 text-red-400'}`}>
                                                  {isIncoming ? <ArrowDownLeft size={20}/> : <ArrowUpRight size={20}/>}
                                              </div>
                                              <div>
                                                  <h4 className="font-bold text-white text-sm">
                                                      {isIncoming ? `From @${tx.fromName}` : `To @${tx.toName}`}
                                                  </h4>
                                                  <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-0.5">
                                                      {new Date(tx.timestamp).toLocaleDateString()} • {tx.type}
                                                  </p>
                                              </div>
                                          </div>
                                          <div className="text-right">
                                              <p className={`text-lg font-black tabular-nums ${isIncoming ? 'text-emerald-400' : 'text-red-400'}`}>
                                                  {isIncoming ? '+' : '-'}{tx.amount}
                                              </p>
                                              <p className="text-[10px] text-slate-600 truncate max-w-[150px] italic">"{tx.memo || 'Neural Transfer'}"</p>
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                      )}
                  </div>
              </div>
          </div>
      </main>

      {/* Offline Claim Modal */}
      {showTokenInput && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
              <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in-up">
                  <div className="p-6 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2"><Key className="text-indigo-400" size={18}/> Offline Redemption</h3>
                      <button onClick={() => { setShowTokenInput(false); setVerifiedToken(null); setPastedToken(''); }} className="p-2 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white transition-colors"><X size={20}/></button>
                  </div>
                  <div className="p-8 space-y-6">
                      {!verifiedToken ? (
                        <>
                          <div className="space-y-4">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block px-1">Neural Payment Token (Base64)</label>
                              <textarea 
                                value={pastedToken}
                                onChange={e => setPastedToken(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-indigo-300 outline-none focus:ring-2 focus:ring-indigo-500 h-32 resize-none"
                                placeholder="Paste the encrypted token here..."
                              />
                              {verificationError && <p className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle size={12}/> {verificationError}</p>}
                          </div>
                          <button 
                              onClick={handleVerifyToken}
                              disabled={isVerifying || !pastedToken.trim()}
                              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                          >
                              {isVerifying ? <Loader2 size={18} className="animate-spin"/> : <ShieldCheck size={18}/>}
                              Verify Authenticity
                          </button>
                        </>
                      ) : (
                        <div className="space-y-6 animate-fade-in">
                            <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-2xl p-6 text-center">
                                <CheckCircle size={48} className="text-emerald-400 mx-auto mb-4" />
                                <h4 className="text-xl font-bold text-white">Token Verified</h4>
                                <p className="text-3xl font-black text-emerald-400 mt-2">+{verifiedToken.amount} Coins</p>
                                <div className="mt-4 pt-4 border-t border-emerald-500/20 text-left space-y-2">
                                    <p className="text-[10px] text-slate-500 uppercase font-bold">Issuer: <span className="text-white">@{verifiedToken.senderName}</span></p>
                                    <p className="text-[10px] text-slate-500 uppercase font-bold">Timestamp: <span className="text-white">{new Date(verifiedToken.timestamp).toLocaleString()}</span></p>
                                    <p className="text-[10px] text-slate-500 uppercase font-bold">Memo: <span className="text-white italic">"{verifiedToken.memo || 'None'}"</span></p>
                                </div>
                            </div>
                            <button 
                                onClick={handleClaim}
                                disabled={isClaiming}
                                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase rounded-2xl shadow-xl transition-all"
                            >
                                {isClaiming ? <Loader2 size={18} className="animate-spin mx-auto"/> : 'Redeem to Wallet'}
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

export default CoinWallet;
