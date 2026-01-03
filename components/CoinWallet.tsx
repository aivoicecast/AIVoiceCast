
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ArrowLeft, Wallet, Send, Clock, Sparkles, Loader2, User, Search, ArrowUpRight, ArrowDownLeft, Gift, Coins, Info, DollarSign, Zap, Crown, RefreshCw, X, CheckCircle, Smartphone, HardDrive, AlertTriangle, ChevronRight, Key, ShieldCheck, QrCode, Download, Upload, Shield, Eye, Lock, Copy, Check, Heart, Globe, WifiOff, Camera, Share2, Link } from 'lucide-react';
import { UserProfile, CoinTransaction, OfflinePaymentToken, PendingClaim } from '../types';
import { getCoinTransactions, transferCoins, checkAndGrantMonthlyCoins, getAllUsers, getUserProfile, registerIdentity, claimOfflinePayment, DEFAULT_MONTHLY_GRANT } from '../services/firestoreService';
import { auth, db, getDb } from '../services/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { generateMemberIdentity, requestIdentityCertificate, verifyCertificateOffline, verifySignature, signPayment, AIVOICECAST_TRUST_PUBLIC_KEY } from '../utils/cryptoUtils';
import { generateSecureId } from '../utils/idUtils';

interface CoinWalletProps {
  onBack: () => void;
  user: UserProfile | null;
}

export const CoinWallet: React.FC<CoinWalletProps> = ({ onBack, user: propUser }) => {
  const [user, setUser] = useState<UserProfile | null>(propUser);
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [granting, setGranting] = useState(false);
  
  const [databaseInstance, setDatabaseInstance] = useState(db);
  
  // Transfer States
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferMemo, setTransferMemo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  // Identity & Offline States
  const [isCreatingIdentity, setIsCreatingIdentity] = useState(false);
  const [showOfflineToken, setShowOfflineToken] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [pastedToken, setPastedToken] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedToken, setVerifiedToken] = useState<OfflinePaymentToken | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [showReceiveQR, setShowReceiveQR] = useState(false);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);

  // Public Payment View (For scanning/opening receive links)
  const [publicPaymentTarget, setPublicPaymentTarget] = useState<{ uid: string, name: string } | null>(null);

  // Local storage for the private key (normally should be highly protected)
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  
  const filteredUsers = useMemo(() => {
    return allUsers.filter(u => 
      u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [allUsers, searchQuery]);

  const initAttempted = useRef(false);

  // Auto-Claim Effect
  useEffect(() => {
    const processQueue = async () => {
        if (!navigator.onLine || !user) return;
        const queueRaw = localStorage.getItem(`pending_claims_${user.uid}`);
        if (!queueRaw) return;
        
        const queue: PendingClaim[] = JSON.parse(queueRaw);
        const pending = queue.filter(q => q.status === 'pending');
        if (pending.length === 0) return;

        setIsAutoSyncing(true);
        const nextQueue = [...queue];

        for (let i = 0; i < nextQueue.length; i++) {
            const item = nextQueue[i];
            if (item.status !== 'pending') continue;

            try {
                const token: OfflinePaymentToken = JSON.parse(atob(item.tokenStr));
                await claimOfflinePayment(token);
                item.status = 'success';
            } catch (e: any) {
                console.error("Auto-claim failed for token", e);
                item.status = 'failed';
                item.error = e.message;
            }
        }

        localStorage.setItem(`pending_claims_${user.uid}`, JSON.stringify(nextQueue));
        setIsAutoSyncing(false);
        if (nextQueue.some(q => q.status === 'success')) handleRefresh();
    };

    const interval = setInterval(processQueue, 30000); // Check every 30s
    processQueue();
    return () => clearInterval(interval);
  }, [user]);

  // Pay URI Handler - Now shows Public Payment Profile instead of just the send modal
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payUid = params.get('pay');
    const payName = params.get('name');
    if (payUid && payName) {
        setPublicPaymentTarget({ uid: payUid, name: payName });
        // Clean URL after capturing state
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('pay');
        newUrl.searchParams.delete('name');
        window.history.replaceState({}, '', newUrl.toString());
    }
  }, []);

  useEffect(() => {
    if (propUser) {
        setUser(propUser);
        setLoading(false);
    }
  }, [propUser]);

  const initWallet = useCallback(async (force = false) => {
    const activeDb = databaseInstance || getDb();
    if (!activeDb) {
        setLoading(false);
        return;
    }
    if (!databaseInstance) setDatabaseInstance(activeDb);

    if (!force && initAttempted.current && user) return;
    
    setLoading(true);
    try {
        const currentUid = auth?.currentUser?.uid;
        if (!currentUid) {
            await new Promise(r => setTimeout(r, 1500));
            if (!auth?.currentUser?.uid) {
                setLoading(false);
                return;
            }
        }

        const uid = auth?.currentUser?.uid!;
        
        const [profile, txs] = await Promise.all([
            getUserProfile(uid),
            getCoinTransactions(uid)
        ]);

        if (profile) setUser(profile);
        setTransactions(txs || []);
        initAttempted.current = true;
    } catch (e) {
        console.error("Wallet initialization failed", e);
    } finally {
        setLoading(false);
    }
  }, [user, databaseInstance]);

  useEffect(() => {
    initWallet();
    
    if (auth) {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            if (u) initWallet(true);
        });
        return () => unsubscribe();
    }
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
              setTransactions(data || []);
              if (freshProfile) setUser(freshProfile);
          }
      } catch(e) {
          console.error("Refresh failed", e);
      } finally {
          setIsRefreshing(false);
      }
  };

  const handleCreateIdentity = async () => {
      if (!user) return;
      setIsCreatingIdentity(true);
      try {
          const { publicKey, privateKey } = await generateMemberIdentity();
          const certificate = await requestIdentityCertificate(publicKey);
          await registerIdentity(user.uid, publicKey, certificate);
          setPrivateKey(privateKey);
          await handleRefresh();
          alert("Cryptographic Identity Created & Verified by AIVoiceCast!");
      } catch (e) {
          alert("Failed to create identity.");
      } finally {
          setIsCreatingIdentity(false);
      }
  };

  const handleGenerateOfflineToken = async () => {
      if (!user || !transferAmount || !privateKey || !user.certificate) return alert("Fill amount and ensure identity is active.");
      const amount = parseInt(transferAmount);
      if (amount <= 0 || amount > user.coinBalance) return alert("Invalid amount.");

      try {
          const nonce = generateSecureId().substring(0, 12);
          const paymentBase = {
              senderId: user.uid,
              senderName: user.displayName,
              recipientId: selectedUser?.uid || 'any',
              amount,
              timestamp: Date.now(),
              nonce
          };

          const signature = await signPayment(privateKey, paymentBase);
          const token: OfflinePaymentToken = {
              ...paymentBase,
              signature,
              certificate: user.certificate
          };

          const tokenStr = btoa(JSON.stringify(token));
          setGeneratedToken(tokenStr);
          setShowOfflineToken(true);
      } catch (e) {
          alert("Signing failed.");
      }
  };

  const handleVerifyPastedToken = async () => {
      if (!pastedToken.trim()) return;
      setIsVerifying(true);
      setVerificationError(null);
      setVerifiedToken(null);
      try {
          const token: OfflinePaymentToken = JSON.parse(atob(pastedToken));
          const isCertValid = verifyCertificateOffline(token.certificate);
          if (!isCertValid) throw new Error("Certificate not signed by AIVoiceCast Trust.");
          const senderCert = JSON.parse(atob(token.certificate));
          const isSigValid = await verifySignature(senderCert.publicKey, token.signature, {
              senderId: token.senderId,
              senderName: token.senderName,
              recipientId: token.recipientId,
              amount: token.amount,
              timestamp: token.timestamp,
              nonce: token.nonce
          });
          if (!isSigValid) throw new Error("Invalid transaction signature.");
          setVerifiedToken(token);
      } catch (e: any) {
          setVerificationError(e.message || "Invalid token format.");
      } finally {
          setIsVerifying(false);
      }
  };

  const handleClaimVerifiedToken = async () => {
      if (!verifiedToken || !user) return;
      setIsClaiming(true);
      try {
          if (navigator.onLine) {
              await claimOfflinePayment(verifiedToken);
              alert("Offline payment cleared and added to your balance!");
              handleRefresh();
          } else {
              const claim: PendingClaim = { tokenStr: btoa(JSON.stringify(verifiedToken)), timestamp: Date.now(), status: 'pending' };
              const queueRaw = localStorage.getItem(`pending_claims_${user.uid}`) || '[]';
              const queue = JSON.parse(queueRaw);
              queue.push(claim);
              localStorage.setItem(`pending_claims_${user.uid}`, JSON.stringify(queue));
              alert("You are offline. Token added to local claim queue and will sync automatically when online.");
          }
          setShowTokenInput(false);
          setVerifiedToken(null);
          setPastedToken('');
      } catch (e: any) {
          alert("Claim failed: " + e.message);
      } finally {
          setIsClaiming(false);
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

  const formatCurrency = (coins: number) => {
      return (coins / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };

  const qrImageUrl = (data: string) => `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(data)}`;

  const buildReceiveUri = (uid: string, name: string) => {
      return `${window.location.origin}${window.location.pathname}?view=coin_wallet&pay=${uid}&name=${encodeURIComponent(name)}`;
  };

  if (publicPaymentTarget) {
      const targetUri = buildReceiveUri(publicPaymentTarget.uid, publicPaymentTarget.name);
      return (
          <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden animate-fade-in">
              <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center px-6 shrink-0 z-20">
                  <button onClick={() => setPublicPaymentTarget(null)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors mr-4">
                      <ArrowLeft size={20} />
                  </button>
                  <h1 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Personal Payment Page</h1>
              </header>
              <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center">
                  <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-[2.5rem] p-8 shadow-2xl flex flex-col items-center text-center animate-fade-in-up">
                      <div className="w-20 h-20 bg-indigo-600/10 rounded-full flex items-center justify-center mb-6 border border-indigo-500/20 shadow-xl shadow-indigo-500/5">
                          <User size={40} className="text-indigo-400" />
                      </div>
                      <h2 className="text-2xl font-black text-white mb-1 italic uppercase tracking-tighter">{publicPaymentTarget.name}</h2>
                      <p className="text-xs text-indigo-400 font-bold uppercase tracking-[0.2em] mb-8">Verified AIVoiceCast Member</p>

                      <div className="w-full bg-white p-6 rounded-[2rem] border-8 border-slate-800 mb-8 shadow-inner flex flex-col items-center">
                          <img src={qrImageUrl(targetUri)} className="w-48 h-48" alt="Recipient QR"/>
                          <p className="text-[10px] font-black text-slate-400 uppercase mt-4 tracking-widest">Scan to Pay</p>
                      </div>

                      <div className="grid grid-cols-1 w-full gap-3">
                          <button 
                            onClick={() => { setSelectedUser({ uid: publicPaymentTarget.uid, displayName: publicPaymentTarget.name } as UserProfile); setShowTransfer(true); setPublicPaymentTarget(null); }}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 active:scale-95"
                          >
                              <Send size={18} className="rotate-[-20deg]"/>
                              Send VoiceCoins
                          </button>
                          <button 
                            onClick={() => setPublicPaymentTarget(null)}
                            className="w-full py-4 bg-slate-800 text-slate-400 font-bold rounded-2xl border border-slate-700 hover:bg-slate-700 transition-all"
                          >
                              Cancel
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      );
  }

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
          <div className="flex items-center gap-2">
              {isAutoSyncing && <div className="flex items-center gap-2 px-3 py-1 bg-emerald-900/20 text-emerald-400 rounded-full text-[10px] font-bold uppercase animate-pulse border border-emerald-500/30"><RefreshCw size={10} className="animate-spin"/> Syncing Ledger</div>}
              <button onClick={() => setShowTokenInput(true)} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded-lg text-xs font-bold border border-slate-700 transition-all flex items-center gap-2">
                  <Download size={14}/>
                  Import Token
              </button>
              <button onClick={handleRefresh} disabled={isRefreshing} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
                  <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''}/>
              </button>
          </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 max-w-4xl mx-auto w-full scrollbar-thin scrollbar-thumb-slate-800">
          
          {/* Main Card */}
          <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-32 bg-white/10 blur-[80px] rounded-full group-hover:bg-white/20 transition-all"></div>
              <div className="relative z-10">
                  <div className="flex justify-between items-start mb-8">
                      <div>
                          <p className="text-indigo-100 text-xs font-bold uppercase tracking-[0.2em] mb-1 opacity-80">Available Balance</p>
                          <div className="flex items-center gap-3">
                              <h2 className="text-5xl font-black text-white tracking-tighter">{user?.coinBalance || 0}</h2>
                              <div className="bg-white/20 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] font-bold text-white uppercase border border-white/10">VC</div>
                          </div>
                          <p className="text-indigo-200 text-sm mt-2 opacity-80 font-mono tracking-tighter">Est. Value: {formatCurrency(user?.coinBalance || 0)}</p>
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
                        onClick={() => setShowReceiveQR(true)}
                        className="bg-indigo-500/30 text-white font-bold py-3.5 rounded-2xl border border-white/20 hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                      >
                          <QrCode size={18} />
                          <span>Receive</span>
                      </button>
                  </div>
              </div>
          </div>

          {/* Identity Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row items-center gap-6 shadow-xl">
              <div className={`p-5 rounded-[2rem] border-2 transition-all ${user?.certificate ? 'bg-emerald-950/20 border-emerald-500/50 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                  {user?.certificate ? <ShieldCheck size={40} /> : <Shield size={40} />}
              </div>
              <div className="flex-1 text-center md:text-left">
                  <h3 className="text-lg font-bold text-white mb-1 flex items-center justify-center md:justify-start gap-2">
                      Identity Protocol
                      {user?.certificate && <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full uppercase tracking-widest font-black">Trusted</span>}
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                      {user?.certificate 
                        ? "Your decentralized identity is verified by AIVoiceCast. You can issue cryptographically signed offline tokens." 
                        : "Initialize your cryptographic identity to support verified offline payments and peer-to-peer trust."}
                  </p>
              </div>
              {!user?.certificate && (
                <button 
                    onClick={handleCreateIdentity}
                    disabled={isCreatingIdentity}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 whitespace-nowrap active:scale-95"
                >
                    {isCreatingIdentity ? <Loader2 size={18} className="animate-spin"/> : <Key size={18}/>}
                    Sign Identity
                </button>
              )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-start gap-4">
                  <div className="p-2.5 bg-indigo-900/30 rounded-xl text-indigo-400"><Info size={20}/></div>
                  <div>
                      <h4 className="text-sm font-bold text-white mb-1">Monthly Allowance</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">All members receive {DEFAULT_MONTHLY_GRANT.toLocaleString()} free VoiceCoins monthly to power the shared network of learning.</p>
                  </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-start gap-4">
                  <div className="p-2.5 bg-emerald-900/30 rounded-xl text-emerald-400"><Heart size={20}/></div>
                  <div>
                      <h4 className="text-sm font-bold text-white mb-1">Contribution Rewards</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">Earn 1000 coins for every "Like" your podcasts, blogs, or documents receive from the community.</p>
                  </div>
              </div>
          </div>

          {/* Ledger Section */}
          <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2"><Clock size={16}/> Transaction Ledger</h3>
                  <button onClick={handleRefresh} className="text-[10px] text-indigo-400 font-bold hover:text-white transition-colors uppercase tracking-widest">Sync Ledger</button>
              </div>
              
              <div className="bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden divide-y divide-slate-800 shadow-2xl">
                  {transactions.length === 0 ? (
                      <div className="p-20 text-center space-y-5">
                          <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto opacity-20">
                              <HardDrive size={32} className="text-slate-400" />
                          </div>
                          <p className="text-slate-500 italic text-sm">No entries found.</p>
                      </div>
                  ) : (
                      transactions.map(tx => {
                          const isIncoming = tx.toId === user?.uid;
                          const icon = tx.type === 'grant' ? <Sparkles size={16}/> : tx.type === 'check' ? <Smartphone size={16}/> : tx.type === 'contribution' ? <Heart size={16}/> : tx.type === 'offline' ? <ShieldCheck size={16}/> : <Send size={16}/>;
                          
                          return (
                              <div key={tx.id} className="p-5 flex items-center justify-between hover:bg-slate-800/40 transition-all group">
                                  <div className="flex items-center gap-4">
                                      <div className={`p-3 rounded-2xl transition-transform group-hover:scale-110 ${isIncoming ? 'bg-emerald-900/20 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                                          {isIncoming ? <ArrowDownLeft size={24}/> : <ArrowUpRight size={24}/>}
                                      </div>
                                      <div>
                                          <p className="text-sm font-bold text-white flex items-center gap-2">
                                              {tx.type === 'grant' ? 'Neural Grant' : tx.type === 'contribution' ? 'Contribution Award' : isIncoming ? `From ${tx.fromName}` : `To ${tx.toName}`}
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

      {/* Receive Modal */}
      {showReceiveQR && user && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
              <div className="bg-slate-900 border border-slate-700 rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-indigo-500/10 text-indigo-400 rounded-full flex items-center justify-center mb-6 border border-indigo-500/20 shadow-xl shadow-indigo-500/10">
                      <QrCode size={32}/>
                  </div>
                  <h3 className="text-2xl font-black text-white mb-1 uppercase tracking-tighter italic">Receive VoiceCoins</h3>
                  <p className="text-sm text-slate-400 mb-8 max-w-xs leading-relaxed">
                      Other members can scan this code to transfer coins to you instantly or issue an offline payment.
                  </p>
                  
                  <div className="w-full bg-white p-6 rounded-[2rem] border-8 border-slate-800 mb-8 shadow-inner flex flex-col items-center">
                      <img src={qrImageUrl(buildReceiveUri(user.uid, user.displayName))} className="w-48 h-48" alt="Receive QR"/>
                      <p className="text-[10px] font-black text-slate-400 uppercase mt-4 tracking-widest">@{user.displayName.replace(/\s+/g, '_').toLowerCase()}</p>
                  </div>

                  <div className="flex gap-2 w-full mb-4">
                      <button onClick={() => { navigator.clipboard.writeText(buildReceiveUri(user.uid, user.displayName)); alert("Payment Link Copied!"); }} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all">
                          <Copy size={14}/> Copy Link
                      </button>
                      <button onClick={() => { if(navigator.share) navigator.share({ title: 'Receive VoiceCoins', url: buildReceiveUri(user.uid, user.displayName) }); }} className="p-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all">
                          <Share2 size={18}/>
                      </button>
                  </div>
                  <button onClick={() => setShowReceiveQR(false)} className="w-full py-4 bg-slate-950 text-slate-500 rounded-2xl font-bold hover:text-white transition-all">Close</button>
              </div>
          </div>
      )}

      {/* Transfer Modal */}
      {showTransfer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
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
                                  </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                  <button 
                                    onClick={handleTransfer}
                                    disabled={isTransferring || !transferAmount || parseInt(transferAmount) <= 0}
                                    className="py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                                  >
                                      <Globe size={18}/>
                                      Online
                                  </button>
                                  <button 
                                    onClick={handleGenerateOfflineToken}
                                    disabled={!user?.certificate || !privateKey || !transferAmount || parseInt(transferAmount) <= 0}
                                    className="py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 border border-slate-700"
                                    title={!user?.certificate ? "Create Identity First" : "Sign Offline Token"}
                                  >
                                      <WifiOff size={18}/>
                                      Offline
                                  </button>
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* Offline Token Modal */}
      {showOfflineToken && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
              <div className="bg-slate-900 border border-slate-700 rounded-[2.5rem] w-full max-w-lg p-8 shadow-2xl flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mb-6 border border-emerald-500/20">
                      <ShieldCheck size={32}/>
                  </div>
                  <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter italic">Payment Ready</h3>
                  <p className="text-sm text-slate-400 mb-8 max-w-xs">
                      The recipient should scan this QR code to claim their VoiceCoins once they are back online.
                  </p>
                  
                  <div className="w-full bg-white p-6 rounded-3xl border-8 border-slate-800 mb-8 flex flex-col items-center">
                      <img src={qrImageUrl(generatedToken!)} className="w-48 h-48" alt="Payment Token QR"/>
                      <code className="text-[10px] font-mono text-indigo-400 break-all bg-slate-900 p-3 rounded-xl border border-slate-800 w-full mt-4 max-h-20 overflow-y-auto">
                          {generatedToken}
                      </code>
                  </div>

                  <button onClick={() => { navigator.clipboard.writeText(generatedToken!); alert("Token copied!"); }} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold mb-2 flex items-center justify-center gap-2"><Copy size={16}/> Copy Token String</button>
                  <button onClick={() => setShowOfflineToken(false)} className="w-full py-4 bg-slate-800 text-slate-300 rounded-2xl font-bold transition-all hover:bg-slate-700">Dismiss</button>
              </div>
          </div>
      )}

      {/* Import Token Modal */}
      {showTokenInput && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md p-8 shadow-2xl animate-fade-in-up">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-white flex items-center gap-2"><Download size={20} className="text-indigo-400"/> Verify Token</h3>
                      <button onClick={() => { setShowTokenInput(false); setVerifiedToken(null); setPastedToken(''); }} className="p-1 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white transition-colors"><X size={20}/></button>
                  </div>
                  
                  {!verifiedToken ? (
                      <div className="space-y-6">
                          <p className="text-sm text-slate-400">Paste the VoiceCoin token string below or use your camera to scan a payment QR code.</p>
                          <textarea 
                            value={pastedToken}
                            onChange={e => setPastedToken(e.target.value)}
                            className="w-full h-32 bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs font-mono text-indigo-300 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                            placeholder="Paste token string here..."
                          />
                          {verificationError && (
                              <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-xl flex items-center gap-2 text-red-400 text-xs">
                                  <AlertTriangle size={14}/> {verificationError}
                              </div>
                          )}
                          <div className="grid grid-cols-2 gap-2">
                             <button className="py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold flex items-center justify-center gap-2"><Camera size={18}/> Scan QR</button>
                             <button 
                                onClick={handleVerifyPastedToken}
                                disabled={isVerifying || !pastedToken.trim()}
                                className="py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-bold rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2"
                              >
                                {isVerifying ? <Loader2 size={18} className="animate-spin"/> : <ShieldCheck size={18}/>}
                                Verify
                             </button>
                          </div>
                      </div>
                  ) : (
                      <div className="space-y-6 animate-fade-in">
                          <div className="bg-emerald-950/20 border border-emerald-500/30 p-6 rounded-3xl text-center">
                              <CheckCircle size={48} className="text-emerald-400 mx-auto mb-3"/>
                              <h4 className="text-lg font-bold text-white mb-1">Authentic Payment</h4>
                              <p className="text-xs text-slate-400">Signed by {verifiedToken.senderName} and trusted by Authority.</p>
                          </div>

                          <div className="p-6 bg-slate-950 rounded-2xl border border-slate-800">
                              <div className="flex justify-between items-center mb-4">
                                  <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">Amount</span>
                                  <span className="text-3xl font-black text-white">{verifiedToken.amount} VC</span>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                  <span className="text-slate-500 font-bold uppercase tracking-widest">Recipient</span>
                                  <span className="text-indigo-400 font-bold">{verifiedToken.recipientId === 'any' ? 'Bearer (Anyone)' : 'Restricted to You'}</span>
                              </div>
                          </div>

                          <button 
                            onClick={handleClaimVerifiedToken}
                            disabled={isClaiming}
                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2"
                          >
                              {isClaiming ? <Loader2 size={20} className="animate-spin"/> : navigator.onLine ? 'Clear Payment to Ledger' : 'Queue Claim (Offline)'}
                          </button>
                      </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};
