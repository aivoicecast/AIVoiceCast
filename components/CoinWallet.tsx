
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ArrowLeft, Wallet, Send, Clock, Sparkles, Loader2, User, Search, ArrowUpRight, ArrowDownLeft, Gift, Coins, Info, DollarSign, Zap, Crown, RefreshCw, X, CheckCircle, Smartphone, HardDrive, AlertTriangle, ChevronRight, Key, ShieldCheck, QrCode, Download, Upload, Shield, Eye, Lock, Copy, Check, Heart, Globe, WifiOff, Camera, Share2, Link, FileText, ChevronDown, Edit3, HeartHandshake, Percent, Filter, History, Signature, UserPlus, QrCode as QrIcon, SendHorizonal } from 'lucide-react';
import { UserProfile, CoinTransaction, OfflinePaymentToken, PendingClaim } from '../types';
import { getCoinTransactions, transferCoins, checkAndGrantMonthlyCoins, getAllUsers, getUserProfile, registerIdentity, claimOfflinePayment, DEFAULT_MONTHLY_GRANT } from '../services/firestoreService';
import { auth, db } from '../services/firebaseConfig';
import { onAuthStateChanged } from '@firebase/auth';
import { generateMemberIdentity, requestIdentityCertificate, verifyCertificateOffline, verifySignature, signPayment, AIVOICECAST_TRUST_PUBLIC_KEY } from '../utils/cryptoUtils';
import { generateSecureId } from '../utils/idUtils';
import { getLocalPrivateKey, saveLocalPrivateKey } from '../utils/db';
import { Visualizer } from './Visualizer';

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
  const [showSendModal, setShowSendModal] = useState(false);
  const [transferType, setTransferType] = useState<'online' | 'offline'>('online');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferMemo, setTransferMemo] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'input' | 'processing' | 'receipt'>('input');
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState<UserProfile | null>(null);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  // Identity & Offline States
  const [isCreatingIdentity, setIsCreatingIdentity] = useState(false);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [pastedToken, setPastedToken] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedToken, setVerifiedToken] = useState<OfflinePaymentToken | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);

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
          getAllUsers().then(users => setAllUsers(users.filter(u => u.uid !== user.uid)));
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

  const handleSendOnline = async () => {
      if (!user || !selectedRecipient || !transferAmount) return;
      const amt = parseInt(transferAmount);
      if (isNaN(amt) || amt <= 0) return alert("Invalid amount.");
      if (amt > (user.coinBalance || 0)) return alert("Insufficient balance.");

      setPaymentStep('processing');
      try {
          await transferCoins(selectedRecipient.uid, selectedRecipient.displayName, amt, transferMemo);
          setPaymentStep('receipt');
          handleRefresh();
      } catch (e: any) {
          alert("Transfer failed: " + e.message);
          setPaymentStep('input');
      }
  };

  const handleGenerateOfflineToken = async () => {
      if (!user || !transferAmount || !privateKey || !user.certificate) return;
      const amt = parseInt(transferAmount);
      if (isNaN(amt) || amt <= 0) return alert("Invalid amount.");
      
      setPaymentStep('processing');
      try {
          const nonce = generateSecureId().substring(0, 12);
          const timestamp = Date.now();
          const paymentData = {
              senderId: user.uid,
              senderName: user.displayName,
              recipientId: 'any', // Anyone with the token can claim
              amount: amt,
              timestamp,
              nonce,
              memo: transferMemo
          };

          const signature = await signPayment(privateKey, paymentData);
          const token: OfflinePaymentToken = {
              ...paymentData,
              signature,
              certificate: user.certificate
          };

          const encoded = btoa(JSON.stringify(token));
          setGeneratedToken(encoded);
          setPaymentStep('receipt');
      } catch (e: any) {
          alert("Signing failed: " + e.message);
          setPaymentStep('input');
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
          setVerifiedToken(null);
          setPastedToken('');
          setShowTokenInput(false);
          handleRefresh();
          alert(`Successfully claimed ${verifiedToken.amount} VoiceCoins!`);
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

  const filteredRecipients = useMemo(() => {
      if (!userSearch.trim()) return [];
      const q = userSearch.toLowerCase();
      return allUsers.filter(u => u.displayName.toLowerCase().includes(q) || (u.email && u.email.toLowerCase().includes(q))).slice(0, 5);
  }, [allUsers, userSearch]);

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
                          <button onClick={() => setShowTokenInput(true)} className="px-6 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-2xl text-xs font-black uppercase tracking-widest text-white transition-all active:scale-95">Receive</button>
                          <button onClick={() => { setShowSendModal(true); setPaymentStep('input'); }} className="px-8 py-3 bg-white text-indigo-600 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all">Send Coins</button>
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

      {/* Send Modal */}
      {showSendModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
              <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in-up">
                  <div className="p-6 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <SendHorizonal className="text-indigo-400" size={18}/> Send Sovereign Assets
                      </h3>
                      <button onClick={() => setShowSendModal(false)} className="p-2 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white transition-colors"><X size={20}/></button>
                  </div>

                  <div className="p-8">
                      {paymentStep === 'input' && (
                          <div className="space-y-6">
                              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                                  <button onClick={() => setTransferType('online')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${transferType === 'online' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500'}`}>Online Transfer</button>
                                  <button onClick={() => setTransferType('offline')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${transferType === 'offline' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500'}`}>Neural Token</button>
                              </div>

                              {transferType === 'online' ? (
                                  <div className="space-y-4">
                                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block px-1">Recipient</label>
                                      {selectedRecipient ? (
                                          <div className="flex items-center justify-between bg-indigo-900/20 border border-indigo-500/30 p-3 rounded-xl animate-fade-in">
                                              <div className="flex items-center gap-3">
                                                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold">{selectedRecipient.displayName[0]}</div>
                                                  <span className="text-sm font-bold">@{selectedRecipient.displayName}</span>
                                              </div>
                                              <button onClick={() => setSelectedRecipient(null)} className="p-1 hover:bg-white/10 rounded-full text-slate-400"><X size={14}/></button>
                                          </div>
                                      ) : (
                                          <div className="relative">
                                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={16}/>
                                              <input 
                                                type="text" 
                                                value={userSearch}
                                                onChange={e => setUserSearch(e.target.value)}
                                                placeholder="Search members by name or email..."
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                              />
                                              {filteredRecipients.length > 0 && (
                                                  <div className="absolute top-full left-0 w-full bg-slate-800 border border-slate-700 rounded-xl mt-1 shadow-2xl z-20 overflow-hidden divide-y divide-slate-700">
                                                      {filteredRecipients.map(r => (
                                                          <button key={r.uid} onClick={() => { setSelectedRecipient(r); setUserSearch(''); }} className="w-full text-left px-4 py-3 hover:bg-slate-700 flex items-center gap-3 transition-colors">
                                                              <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-bold">{r.displayName[0]}</div>
                                                              <span className="text-xs text-white">@{r.displayName}</span>
                                                          </button>
                                                      ))}
                                                  </div>
                                              )}
                                          </div>
                                      )}
                                  </div>
                              ) : (
                                  <div className="p-4 bg-indigo-900/20 border border-indigo-500/20 rounded-2xl space-y-2">
                                      <div className="flex items-center gap-2 text-indigo-300">
                                          <Shield size={16}/>
                                          <span className="text-xs font-bold uppercase">Sovereign Signing</span>
                                      </div>
                                      <p className="text-[10px] text-slate-400 leading-relaxed">This will generate an encrypted token using your local private key. Anyone with the token can claim the coins. Useful for gifting or offline exchange.</p>
                                      {!privateKey && <p className="text-[10px] text-amber-500 font-bold">Register your identity first to sign tokens.</p>}
                                  </div>
                              )}

                              <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Amount</label>
                                      <div className="flex bg-slate-950 border border-slate-800 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                                          <input 
                                            type="number" 
                                            value={transferAmount}
                                            onChange={e => setTransferAmount(e.target.value)}
                                            className="w-full bg-transparent px-4 py-3 text-white text-lg font-black outline-none"
                                            placeholder="0"
                                          />
                                          <div className="bg-slate-800 p-3 text-amber-400"><Coins size={18}/></div>
                                      </div>
                                  </div>
                                  <div className="space-y-2">
                                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Purpose</label>
                                      <input 
                                        type="text" 
                                        value={transferMemo}
                                        onChange={e => setTransferMemo(e.target.value)}
                                        placeholder="Optional memo..."
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                      />
                                  </div>
                              </div>

                              <button 
                                onClick={transferType === 'online' ? handleSendOnline : handleGenerateOfflineToken}
                                disabled={isTransferring || !transferAmount || (transferType === 'online' && !selectedRecipient) || (transferType === 'offline' && !privateKey)}
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                              >
                                  {transferType === 'online' ? <Send size={18}/> : <Signature size={18}/>}
                                  {transferType === 'online' ? 'Authorize Ledger Update' : 'Generate Signed Token'}
                              </button>
                          </div>
                      )}

                      {paymentStep === 'processing' && (
                          <div className="py-20 text-center space-y-6 animate-pulse">
                              <div className="relative mx-auto w-24 h-24">
                                  <div className="absolute inset-0 border-4 border-indigo-500/10 rounded-full"></div>
                                  <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                  <div className="absolute inset-0 flex items-center justify-center"><Sparkles className="text-indigo-400" size={32}/></div>
                              </div>
                              <div className="space-y-2">
                                <h4 className="text-xl font-black text-white italic uppercase tracking-tighter">Handshaking...</h4>
                                <p className="text-xs text-slate-500 uppercase tracking-widest">Validating with Neural Network</p>
                              </div>
                          </div>
                      )}

                      {paymentStep === 'receipt' && (
                          <div className="space-y-8 animate-fade-in-up">
                              <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-[2.5rem] p-8 text-center space-y-4">
                                  <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-900/30">
                                      <Check size={32} strokeWidth={4}/>
                                  </div>
                                  <div>
                                      <h4 className="text-2xl font-black text-white italic uppercase tracking-tighter">Transaction Verified</h4>
                                      <p className="text-sm text-emerald-400 font-bold">-{transferAmount} VoiceCoins</p>
                                  </div>
                              </div>

                              {generatedToken ? (
                                  <div className="space-y-4">
                                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Offline Redemption Link</p>
                                      <div className="flex gap-2">
                                          <input readOnly value={generatedToken} className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-[10px] font-mono text-indigo-300 truncate outline-none" />
                                          <button onClick={() => { navigator.clipboard.writeText(generatedToken); alert("Token Copied!"); }} className="p-3 bg-slate-800 hover:bg-indigo-600 rounded-xl text-white transition-all"><Copy size={18}/></button>
                                      </div>
                                      <p className="text-[9px] text-slate-600 italic">This token is unique and one-time use. Send it to your recipient to claim.</p>
                                  </div>
                              ) : (
                                  <div className="p-6 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                                      <div className="flex justify-between text-xs"><span className="text-slate-500">Recipient:</span><span className="text-white font-bold">@{selectedRecipient?.displayName}</span></div>
                                      <div className="flex justify-between text-xs"><span className="text-slate-500">Network Fee:</span><span className="text-emerald-400 font-bold">0.00 VC</span></div>
                                      <div className="flex justify-between text-xs border-t border-slate-800 pt-3"><span className="text-slate-500">Status:</span><span className="text-indigo-400 font-black uppercase tracking-widest">Broadcasted</span></div>
                                  </div>
                              )}

                              <button onClick={() => setShowSendModal(false)} className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white font-black uppercase rounded-2xl transition-all">Close</button>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* Redemption Modal */}
      {showTokenInput && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
              <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in-up">
                  <div className="p-6 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2"><Key className="text-indigo-400" size={18}/> Redemption Center</h3>
                      <button onClick={() => { setShowTokenInput(false); setVerifiedToken(null); setPastedToken(''); }} className="p-2 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white transition-colors"><X size={20}/></button>
                  </div>
                  <div className="p-8 space-y-6">
                      {!verifiedToken ? (
                        <>
                          <div className="space-y-4">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block px-1">Neural Payment Token</label>
                              <textarea 
                                value={pastedToken}
                                onChange={e => setPastedToken(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-indigo-300 outline-none focus:ring-2 focus:ring-indigo-500 h-32 resize-none"
                                placeholder="Paste encrypted token string here..."
                              />
                              {verificationError && <p className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle size={12}/> {verificationError}</p>}
                          </div>
                          <button 
                              onClick={handleVerifyToken}
                              disabled={isVerifying || !pastedToken.trim()}
                              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                          >
                              {isVerifying ? <Loader2 size={18} className="animate-spin"/> : <ShieldCheck size={18}/>}
                              Decrypt & Verify
                          </button>
                        </>
                      ) : (
                        <div className="space-y-6 animate-fade-in">
                            <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-2xl p-6 text-center">
                                <CheckCircle size={48} className="text-emerald-400 mx-auto mb-4" />
                                <h4 className="text-xl font-bold text-white">Token Authenticated</h4>
                                <p className="text-3xl font-black text-emerald-400 mt-2">+{verifiedToken.amount} VC</p>
                                <div className="mt-4 pt-4 border-t border-emerald-500/20 text-left space-y-2">
                                    <p className="text-[10px] text-slate-500 uppercase font-bold">Source: <span className="text-white">@{verifiedToken.senderName}</span></p>
                                    <p className="text-[10px] text-slate-500 uppercase font-bold">Signed: <span className="text-white">{new Date(verifiedToken.timestamp).toLocaleString()}</span></p>
                                    {verifiedToken.memo && <p className="text-[10px] text-slate-500 uppercase font-bold">Memo: <span className="text-white italic">"{verifiedToken.memo}"</span></p>}
                                </div>
                            </div>
                            <button 
                                onClick={handleClaim}
                                disabled={isClaiming}
                                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase rounded-2xl shadow-xl transition-all"
                            >
                                {isClaiming ? <Loader2 size={18} className="animate-spin mx-auto"/> : 'Redeem into Wallet'}
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
