import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ArrowLeft, Wallet, Send, Clock, Sparkles, Loader2, User, Search, ArrowUpRight, ArrowDownLeft, Gift, Coins, Info, DollarSign, Zap, Crown, RefreshCw, X, CheckCircle, Smartphone, HardDrive, AlertTriangle, ChevronRight, Key, ShieldCheck, QrCode, Download, Upload, Shield, Eye, Lock, Copy, Check, Heart, Globe, WifiOff, Camera, Share2, Link, FileText, ChevronDown, Edit3, HeartHandshake, Percent, Filter, History, Signature } from 'lucide-react';
import { UserProfile, CoinTransaction, OfflinePaymentToken, PendingClaim } from '../types';
import { getCoinTransactions, transferCoins, checkAndGrantMonthlyCoins, getAllUsers, getUserProfile, registerIdentity, claimOfflinePayment, DEFAULT_MONTHLY_GRANT } from '../services/firestoreService';
import { auth, db, getDb } from '../services/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
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
  const [databaseInstance, setDatabaseInstance] = useState(db);
  
  // Ledger Search & Filter
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'in' | 'out'>('all');
  const [showLedgerInPayment, setShowLedgerInPayment] = useState(false);

  // Transfer States
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferMemo, setTransferMemo] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [pastedPayUri, setPastedPayUri] = useState('');
  const [tipPercent, setTipPercent] = useState(0);

  // Receive Form States
  const [receiveAmount, setReceiveAmount] = useState('');
  const [receiveMemo, setReceiveMemo] = useState('');
  const [isDonationMode, setIsDonationMode] = useState(false);
  const [minAmount, setMinAmount] = useState('1');
  const [maxAmount, setMaxAmount] = useState('');
  const [allowTips, setAllowTips] = useState(false);
  const [showReceiveForm, setShowReceiveForm] = useState(true);

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

  // Public Payment View
  const [publicPaymentTarget, setPublicPaymentTarget] = useState<{ 
      uid: string, 
      name: string, 
      img?: string,
      amount?: string, 
      memo?: string,
      min?: string,
      max?: string,
      tips?: boolean
  } | null>(null);

  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  const initAttempted = useRef(false);

  // Constants for Range Clamping
  const { minVal, effectiveMax, walletBalance, isDonationRange, isAffordable } = useMemo(() => {
    const balance = user?.coinBalance || 0;
    const isDonRange = !!(publicPaymentTarget?.min || publicPaymentTarget?.max);
    const min = Math.max(1, parseInt(publicPaymentTarget?.min || '1'));
    const iMax = parseInt(publicPaymentTarget?.max || '1000000');
    
    // THE FIX: Upper bound is the minimum of the Invoice Max and current Wallet Balance
    const effMax = Math.min(iMax, balance);
    const affordable = balance >= min;

    return { minVal: min, effectiveMax: effMax, walletBalance: balance, isDonationRange: isDonRange, isAffordable: affordable };
  }, [publicPaymentTarget, user?.coinBalance]);

  // Force clamp input whenever dependencies change
  useEffect(() => {
    if (isDonationRange && transferAmount) {
        const val = parseInt(transferAmount);
        if (val > effectiveMax) {
            setTransferAmount(effectiveMax.toString());
        } else if (val < minVal && transferAmount !== '') {
            // Only clamp lower bound if they have enough balance, otherwise let validation error show
            if (isAffordable) setTransferAmount(minVal.toString());
        }
    }
  }, [effectiveMax, minVal, isDonationRange, isAffordable]);

  // UseMemo for total calculation to ensure it reacts to input changes
  const totalWithTip = useMemo(() => {
    const base = parseInt(transferAmount) || 0;
    const tipVal = Math.floor(base * (tipPercent / 100));
    return base + tipVal;
  }, [transferAmount, tipPercent]);

  // Sync user profile from auth if prop is missing
  useEffect(() => {
    if (propUser) {
        setUser(propUser);
    } else if (auth?.currentUser) {
        getUserProfile(auth.currentUser.uid).then(setUser);
    }
  }, [propUser]);

  // Try to restore Private Key from IndexedDB
  useEffect(() => {
      if (user?.uid) {
          getLocalPrivateKey(user.uid).then(key => {
              if (key) setPrivateKey(key);
          });
      }
  }, [user?.uid]);

  // Handle donation range defaults
  useEffect(() => {
    if (publicPaymentTarget && isDonationRange) {
        if (!transferAmount) {
            setTransferAmount(minVal.toString());
        }
    }
  }, [publicPaymentTarget, isDonationRange, minVal]);

  // Filtered Ledger Logic
  const filteredLedger = useMemo(() => {
      let result = transactions;
      if (ledgerFilter === 'in') result = result.filter(tx => tx.toId === user?.uid);
      if (ledgerFilter === 'out') result = result.filter(tx => tx.fromId === user?.uid);
      
      if (ledgerSearch.trim()) {
          const q = ledgerSearch.toLowerCase();
          result = result.filter(tx => 
              tx.fromName.toLowerCase().includes(q) || 
              tx.toName.toLowerCase().includes(q) || 
              (tx.memo && tx.memo.toLowerCase().includes(q)) ||
              tx.type.toLowerCase().includes(q) ||
              tx.amount.toString().includes(q)
          );
      }
      return result;
  }, [transactions, ledgerSearch, ledgerFilter, user?.uid]);

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
                console.error("Auto-claim failed", e);
                item.status = 'failed';
                item.error = e.message;
            }
        }
        localStorage.setItem(`pending_claims_${user.uid}`, JSON.stringify(nextQueue));
        setIsAutoSyncing(false);
        if (nextQueue.some(q => q.status === 'success')) handleRefresh();
    };
    const interval = setInterval(processQueue, 30000); 
    processQueue();
    return () => clearInterval(interval);
  }, [user]);

  // Deep Link URI Handler
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payUid = params.get('pay');
    const payName = params.get('name');
    const payImg = params.get('img');
    const tokenStr = params.get('token');
    const amt = params.get('amount');
    const mmo = params.get('memo');
    const min = params.get('min');
    const max = params.get('max');
    const tips = params.get('tips') === 'true';

    if (tokenStr) {
        setPastedToken(tokenStr);
        setShowTokenInput(true);
        handleVerifyPastedToken(tokenStr);
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('token');
        window.history.replaceState({}, '', newUrl.toString());
    } else if (payUid && payName) {
        setPublicPaymentTarget({ 
            uid: payUid, 
            name: payName, 
            img: payImg || undefined,
            amount: amt || undefined, 
            memo: mmo || undefined,
            min: min || undefined,
            max: max || undefined,
            tips: tips
        });
        
        if (amt) setTransferAmount(amt);
        else if (min) setTransferAmount(min);
        if (mmo) setTransferMemo(mmo);
        
        const newUrl = new URL(window.location.href);
        ['pay','name','img','amount','memo','min','max','tips'].forEach(p => newUrl.searchParams.delete(p));
        window.history.replaceState({}, '', newUrl.toString());
    }
  }, []);

  const initWallet = useCallback(async (force = false) => {
    const activeDb = databaseInstance || getDb();
    if (!activeDb) { setLoading(false); return; }
    if (!databaseInstance) setDatabaseInstance(activeDb);
    if (!force && initAttempted.current && user) { setLoading(false); return; }
    
    setLoading(true);
    try {
        const uid = auth?.currentUser?.uid;
        if (!uid) {
            setLoading(false);
            return;
        }
        const [profile, txs] = await Promise.all([ getUserProfile(uid), getCoinTransactions(uid) ]);
        if (profile) setUser(profile);
        setTransactions(txs || []);
        initAttempted.current = true;
    } catch (e) { console.error("Wallet initialization failed", e); } finally { setLoading(false); }
  }, [user, databaseInstance]);

  useEffect(() => {
    initWallet(true);
    if (auth) {
        const unsubscribe = onAuthStateChanged(auth, (u) => { if (u) initWallet(true); });
        return () => unsubscribe();
    }
  }, [initWallet]);

  const handleRefresh = async () => {
      setIsRefreshing(true);
      try {
          const uid = auth?.currentUser?.uid;
          if (uid) {
              const [data, freshProfile] = await Promise.all([ getCoinTransactions(uid), getUserProfile(uid) ]);
              setTransactions(data || []);
              if (freshProfile) setUser(freshProfile);
          }
      } catch(e) { console.error("Refresh failed", e); } finally { setIsRefreshing(false); }
  };

  const handleCreateIdentity = async () => {
      if (!user) return;
      setIsCreatingIdentity(true);
      try {
          const { publicKey, privateKey } = await generateMemberIdentity();
          const certificate = await requestIdentityCertificate(publicKey);
          await registerIdentity(user.uid, publicKey, certificate);
          setPrivateKey(privateKey);
          await saveLocalPrivateKey(user.uid, privateKey);
          await handleRefresh();
          alert("Cryptographic Identity Created! You can now pay offline.");
      } catch (e) { alert("Failed to create identity."); } finally { setIsCreatingIdentity(false); }
  };

  const handleAuthorizePayment = async () => {
      const amount = totalWithTip;
      const memo = transferMemo || publicPaymentTarget?.memo || '';

      if (!user || !privateKey || !user.certificate) {
          return alert("Identity Required: You must 'Sign Identity' on this device before authorizing payments.");
      }
      if (amount <= 0 || amount > user.coinBalance) {
          return alert(`Balance Issue: You only have ${user.coinBalance} VC.`);
      }

      setIsTransferring(true);
      try {
          // 1. Generate Nonce and Payment Base
          const nonce = generateSecureId().substring(0, 12);
          const paymentBase = {
              senderId: user.uid,
              senderName: user.displayName,
              recipientId: publicPaymentTarget?.uid || 'any',
              amount,
              timestamp: Date.now(),
              nonce,
              memo
          };

          // 2. Cryptographic Signing (The Evidence)
          const signature = await signPayment(privateKey, paymentBase);
          const token: OfflinePaymentToken = { ...paymentBase, signature, certificate: user.certificate };
          const tokenStr = btoa(JSON.stringify(token));
          setGeneratedToken(tokenStr);

          // 3. Online Ledger Sync (Attempted if online)
          if (navigator.onLine && publicPaymentTarget?.uid) {
              try {
                  await transferCoins(publicPaymentTarget.uid, publicPaymentTarget.name, amount, memo);
                  console.log("Online ledger sync successful.");
              } catch (e) {
                  console.warn("Ledger sync failed, proceeding with Bearer Token evidence only.", e);
              }
          }

          // 4. Show the Confirmation "Digital Check" QR
          setShowOfflineToken(true);
          await handleRefresh();
      } catch (e: any) {
          alert("Authorization failed: " + e.message);
      } finally {
          setIsTransferring(false);
      }
  };

  const handleVerifyPastedToken = async (strOverride?: string) => {
      const tokenToVerify = strOverride || pastedToken;
      if (!tokenToVerify.trim()) return;
      setIsVerifying(true);
      setVerificationError(null);
      setVerifiedToken(null);
      try {
          const token: OfflinePaymentToken = JSON.parse(atob(tokenToVerify));
          const isCertValid = verifyCertificateOffline(token.certificate);
          if (!isCertValid) throw new Error("Certificate invalid.");
          const senderCert = JSON.parse(atob(token.certificate));
          const isSigValid = await verifySignature(senderCert.publicKey, token.signature, {
              senderId: token.senderId,
              senderName: token.senderName,
              recipientId: token.recipientId,
              amount: token.amount,
              timestamp: token.timestamp,
              nonce: token.nonce,
              memo: (token as any).memo
          });
          if (!isSigValid) throw new Error("Invalid signature.");
          setVerifiedToken(token);
      } catch (e: any) { setVerificationError(e.message || "Invalid token."); } finally { setIsVerifying(false); }
  };

  const handleClaimVerifiedToken = async () => {
      if (!verifiedToken || !user) return;
      setIsClaiming(true);
      try {
          if (navigator.onLine) {
              await claimOfflinePayment(verifiedToken);
              alert("Payment cleared on global ledger!");
              handleRefresh();
          } else {
              const claim: PendingClaim = { tokenStr: btoa(JSON.stringify(verifiedToken)), timestamp: Date.now(), status: 'pending' };
              const queueRaw = localStorage.getItem(`pending_claims_${user.uid}`) || '[]';
              const queue = JSON.parse(queueRaw);
              queue.push(claim);
              localStorage.setItem(`pending_claims_${user.uid}`, JSON.stringify(queue));
              alert("Recipient is offline. Token added to local claim queue. Coins will settle when online.");
          }
          setShowTokenInput(false);
          setVerifiedToken(null);
          setPastedToken('');
      } catch (e: any) { alert("Claim failed: " + e.message); } finally { setIsClaiming(false); }
  };

  const handlePastePayUri = () => {
      try {
          const url = new URL(pastedPayUri);
          const payUid = url.searchParams.get('pay');
          const payName = url.searchParams.get('name');
          const payImg = url.searchParams.get('img');
          const amt = url.searchParams.get('amount');
          const min = url.searchParams.get('min');
          const max = url.searchParams.get('max');
          const tips = url.searchParams.get('tips') === 'true';
          const mmo = url.searchParams.get('memo');
          
          if (payUid && payName) {
              setPublicPaymentTarget({ uid: payUid, name: payName, img: payImg || undefined, amount: amt || undefined, memo: mmo || undefined, min: min || undefined, max: max || undefined, tips: tips });
              if (amt) setTransferAmount(amt);
              else if (min) setTransferAmount(min);
              if (mmo) setTransferMemo(mmo);
              setShowTransfer(false);
              setPastedPayUri('');
          } else { alert("Invalid Payment URI."); }
      } catch(e) { alert("Invalid URL format."); }
  };

  const qrImageUrl = (data: string) => `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(data)}`;

  const buildReceiveUri = (uid: string, name: string, photoURL?: string) => {
      let uri = `${window.location.origin}${window.location.pathname}?view=coin_wallet&pay=${uid}&name=${encodeURIComponent(name)}`;
      if (photoURL) uri += `&img=${encodeURIComponent(photoURL)}`;
      if (isDonationMode) {
          if (minAmount) uri += `&min=${minAmount}`;
          if (maxAmount) uri += `&max=${maxAmount}`;
      } else {
          if (receiveAmount) uri += `&amount=${receiveAmount}`;
          if (allowTips) uri += `&tips=true`;
      }
      if (receiveMemo) uri += `&memo=${encodeURIComponent(receiveMemo)}`;
      return uri;
  };

  const buildTokenUri = (token: string) => {
      return `${window.location.origin}${window.location.pathname}?view=coin_wallet&token=${encodeURIComponent(token)}`;
  };

  const renderLedgerItems = (txList: CoinTransaction[]) => {
      if (txList.length === 0) return (<div className="p-20 text-center space-y-5"><div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto opacity-20"><HardDrive size={32} className="text-slate-400" /></div><p className="text-slate-500 italic text-sm">No matching ledger entries.</p></div>);
      
      return txList.map(tx => {
          const isIncoming = tx.toId === user?.uid;
          const isPending = !tx.isVerified && tx.type === 'transfer';
          return (
              <div key={tx.id} className="p-5 flex items-center justify-between hover:bg-slate-800/40 transition-all group">
                  <div className="flex items-center gap-4 min-w-0">
                      <div className={`p-3 rounded-2xl transition-transform group-hover:scale-110 ${isIncoming ? 'bg-emerald-900/20 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>{isIncoming ? <ArrowDownLeft size={24}/> : <ArrowUpRight size={24}/>}</div>
                      <div className="min-w-0">
                          <p className="text-sm font-bold text-white flex items-center gap-2 truncate">{tx.type === 'grant' ? 'Monthly Neural Grant' : tx.type === 'contribution' ? 'Contribution Award' : isIncoming ? `From ${tx.fromName}` : `To ${tx.toName}`} <span className={`hidden sm:flex text-[9px] px-2 py-0.5 rounded border uppercase font-black tracking-tighter items-center gap-1.5 shrink-0 ${isPending ? 'bg-amber-900/30 text-amber-400 border-amber-500/30 animate-pulse' : 'bg-slate-950 text-slate-500 border-slate-800'}`}>{isPending ? 'PENDING' : tx.type}</span></p>
                          <p className="text-[10px] text-slate-500 mt-1 font-medium truncate">{tx.memo || new Date(tx.timestamp).toLocaleString()}</p>
                      </div>
                  </div>
                  <div className={`text-xl font-black shrink-0 ${isIncoming ? 'text-emerald-400' : 'text-slate-200'} ${isPending && isIncoming ? 'opacity-40' : ''}`}>{isIncoming ? '+' : '-'}{tx.amount}</div>
              </div>
          );
      });
  };

  if (publicPaymentTarget) {
      const isAutoMode = !!publicPaymentTarget.amount;
      const currentVal = parseInt(transferAmount) || 0;
      const isRangeValid = !isDonationRange || (currentVal >= minVal && currentVal <= effectiveMax);

      return (
          <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden animate-fade-in">
              <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center px-6 shrink-0 z-20">
                  <button onClick={() => setPublicPaymentTarget(null)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors mr-4"><ArrowLeft size={20} /></button>
                  <h1 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Authorize Payment</h1>
              </header>
              <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
                  <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-[2.5rem] p-8 shadow-2xl flex flex-col animate-fade-in-up mt-8">
                      <div className="flex flex-col items-center text-center mb-8">
                        <div className="w-20 h-20 bg-indigo-600/10 rounded-full flex items-center justify-center mb-4 border border-indigo-500/20 overflow-hidden">
                            {publicPaymentTarget.img ? (
                                <img src={publicPaymentTarget.img} className="w-full h-full object-cover" alt={publicPaymentTarget.name}/>
                            ) : (
                                <User size={40} className="text-indigo-400" />
                            )}
                        </div>
                        <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">{publicPaymentTarget.name}</h2>
                        <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-[0.2em] mt-1">
                            {isDonationRange ? 'Requesting Donation' : 'Requesting VoiceCoins'}
                        </p>
                      </div>

                      <div className="space-y-6">
                        <div className="space-y-4">
                            <div>
                                <label className={`text-[10px] font-bold uppercase tracking-widest block mb-2 ${isRangeValid ? 'text-slate-500' : 'text-red-500 animate-pulse'}`}>
                                    {isDonationRange ? `Affordable Range: ${minVal} - ${effectiveMax}` : 'Base Amount'}
                                </label>
                                <div className="relative">
                                    <Coins className={`absolute left-4 top-1/2 -translate-y-1/2 ${isRangeValid ? 'text-amber-500' : 'text-red-500'}`} size={24}/>
                                    <input 
                                        type="number" 
                                        value={transferAmount}
                                        max={effectiveMax}
                                        onChange={e => setTransferAmount(e.target.value)}
                                        placeholder="0"
                                        readOnly={isAutoMode}
                                        className={`w-full bg-slate-950 border ${!isRangeValid ? 'border-red-500 text-red-200 ring-2 ring-red-500/20' : (isAutoMode ? 'border-indigo-500/30 text-indigo-200' : 'border-slate-800 text-white')} rounded-2xl pl-12 pr-6 py-5 text-4xl font-black focus:outline-none focus:border-amber-500 transition-all`}
                                    />
                                </div>
                                {!isAffordable && (
                                    <div className="mt-2 text-[10px] text-red-400 font-bold uppercase flex items-center gap-1">
                                        <AlertTriangle size={12}/> Insufficient Balance. (Min: {minVal}, Yours: {walletBalance})
                                    </div>
                                )}
                                {isAffordable && !isRangeValid && (
                                    <div className="mt-2 text-[10px] text-red-400 font-bold uppercase flex items-center gap-1">
                                        <AlertTriangle size={12}/> Out of Range. (Limit: {effectiveMax})
                                    </div>
                                )}
                                {isDonationRange && isAffordable && (
                                    <input 
                                        type="range" min={minVal} max={effectiveMax} step="1"
                                        value={currentVal < minVal ? minVal : (currentVal > effectiveMax ? effectiveMax : currentVal)}
                                        onChange={e => setTransferAmount(e.target.value)}
                                        className="w-full mt-4 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                    />
                                )}
                            </div>

                            {publicPaymentTarget.tips && (
                                <div className="p-4 bg-emerald-900/10 border border-emerald-500/20 rounded-2xl animate-fade-in">
                                    <div className="flex justify-between items-center mb-3">
                                        <label className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                                            <Percent size={12}/> Optional Tip ({tipPercent}%)
                                        </label>
                                        <span className="text-xs font-mono text-emerald-300">+{Math.floor((parseInt(transferAmount)||0)*(tipPercent/100))} VC</span>
                                    </div>
                                    <input 
                                        type="range" min="0" max="300" step="5"
                                        value={tipPercent}
                                        onChange={e => setTipPercent(parseInt(e.target.value))}
                                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                    />
                                    <div className="flex justify-between mt-2 px-1">
                                        {['0%', '100%', '200%', '300%'].map(p => <span key={p} className="text-[8px] text-slate-600 font-bold">{p}</span>)}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Reference/Reason</label>
                                <input 
                                    type="text" 
                                    value={transferMemo || publicPaymentTarget.memo || ''}
                                    onChange={e => setTransferMemo(e.target.value)}
                                    placeholder="Add a reason..."
                                    readOnly={!!publicPaymentTarget.memo}
                                    className={`w-full bg-slate-950 border ${!!publicPaymentTarget.memo ? 'border-indigo-500/30 text-indigo-200' : 'border-slate-800 text-white'} rounded-xl px-4 py-3 text-sm focus:outline-none`}
                                />
                            </div>
                        </div>

                        <div className="bg-slate-950 p-4 rounded-2xl border border-indigo-500/20 flex items-center justify-between shadow-inner">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Charge</span>
                            <div className="flex items-center gap-2">
                                <span className={`text-3xl font-black ${totalWithTip > walletBalance ? 'text-red-500' : 'text-white'}`}>{totalWithTip}</span>
                                <span className="text-[10px] font-black text-indigo-400">VC</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            {!privateKey ? (
                                <div className="p-4 bg-amber-900/20 border border-amber-500/30 rounded-2xl flex flex-col items-center text-center gap-3">
                                    <Shield size={24} className="text-amber-500"/>
                                    <p className="text-xs text-amber-200">You need to sign your identity on this device before paying.</p>
                                    <button onClick={handleCreateIdentity} className="px-6 py-2 bg-amber-600 text-white font-bold rounded-lg text-xs uppercase tracking-widest">Sign Identity</button>
                                </div>
                            ) : (
                                <button 
                                    onClick={handleAuthorizePayment}
                                    disabled={isTransferring || totalWithTip <= 0 || !isRangeValid || totalWithTip > walletBalance}
                                    className="py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all flex flex-col items-center justify-center gap-1 active:scale-95 disabled:opacity-50"
                                >
                                    <div className="flex items-center gap-2">
                                        {isTransferring ? <Loader2 size={20} className="animate-spin" /> : <Signature size={20}/>}
                                        <span>{isTransferring ? 'Signing...' : (totalWithTip > walletBalance ? 'Insufficient Funds' : 'Pay Now')}</span>
                                    </div>
                                    <span className="text-[8px] opacity-70 tracking-widest">Secured by Neural Identity</span>
                                </button>
                            )}
                        </div>
                      </div>
                  </div>

                  {/* Context Summary for Payment View */}
                  <div className="w-full max-w-md mt-6 space-y-4">
                      <button 
                        onClick={() => setShowLedgerInPayment(!showLedgerInPayment)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between group transition-all"
                      >
                          <div className="flex items-center gap-3">
                              <History size={18} className="text-indigo-400"/>
                              <span className="text-sm font-bold text-slate-300">My Balance & Recent History</span>
                          </div>
                          <div className="flex items-center gap-3">
                              <span className="text-sm font-black text-white">{user?.coinBalance || 0} VC</span>
                              {showLedgerInPayment ? <X size={14} className="text-slate-500"/> : <ChevronDown size={14} className="text-slate-500"/>}
                          </div>
                      </button>

                      {showLedgerInPayment && (
                          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden divide-y divide-slate-800 shadow-2xl animate-fade-in-up max-h-64 overflow-y-auto scrollbar-hide">
                              {renderLedgerItems(transactions.slice(0, 10))}
                          </div>
                      )}
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden animate-fade-in">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-20">
          <div className="flex items-center gap-4">
              <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"><ArrowLeft size={20} /></button>
              <h1 className="text-lg font-bold text-white flex items-center gap-2"><Coins className="text-amber-400" />Voice Wallet</h1>
          </div>
          <div className="flex items-center gap-2">
              <button onClick={() => setShowTokenInput(true)} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded-lg text-xs font-bold border border-slate-700 transition-all flex items-center gap-2"><Download size={14}/>Import</button>
              <button onClick={handleRefresh} disabled={isRefreshing} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"><RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''}/></button>
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
                          <p className="text-indigo-200 text-sm mt-2 opacity-80 font-mono tracking-tighter">Est. Value: {((user?.coinBalance || 0) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
                      </div>
                      <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl"><Coins size={32} className="text-amber-300" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <button onClick={() => setShowTransfer(true)} className="bg-white text-indigo-900 font-bold py-3.5 rounded-2xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"><Smartphone size={18} className="rotate-[-20deg]" /><span>Scan to Pay</span></button>
                      <button onClick={() => { setShowReceiveForm(true); setShowReceiveQR(true); }} className="bg-indigo-500/30 text-white font-bold py-3.5 rounded-2xl border border-white/20 hover:bg-white/10 transition-all flex items-center justify-center gap-2"><QrCode size={18} /><span>Receive</span></button>
                  </div>
              </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row items-center gap-6 shadow-xl">
              <div className={`p-5 rounded-[2rem] border-2 transition-all ${user?.certificate ? 'bg-emerald-950/20 border-emerald-500/50 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>{user?.certificate ? <ShieldCheck size={40} /> : <Shield size={40} />}</div>
              <div className="flex-1 text-center md:text-left">
                  <h3 className="text-lg font-bold text-white mb-1 flex items-center justify-center md:justify-start gap-2">Identity Protocol {user?.certificate && <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full uppercase tracking-widest font-black">Trusted</span>}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">Initialize your cryptographic identity to support verified offline payments and peer-to-peer trust.</p>
              </div>
              {!privateKey && (<button onClick={handleCreateIdentity} disabled={isCreatingIdentity} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 whitespace-nowrap active:scale-95">{isCreatingIdentity ? <Loader2 size={18} className="animate-spin"/> : <Key size={18}/>}{user?.certificate ? 'Restore Key' : 'Sign Identity'}</button>)}
              {privateKey && <div className="text-[10px] font-black text-emerald-500 border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 rounded-lg uppercase tracking-widest">Active Session Key</div>}
          </div>

          {/* Enhanced Ledger with Lookup */}
          <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2"><Clock size={16}/> Transaction Ledger</h3>
                  
                  <div className="flex items-center gap-2 flex-1 md:max-w-md">
                      <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14}/>
                          <input 
                            type="text" 
                            placeholder="Search history..." 
                            value={ledgerSearch}
                            onChange={e => setLedgerSearch(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-all shadow-inner"
                          />
                      </div>
                      <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800 shrink-0">
                          <button onClick={() => setLedgerFilter('all')} className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${ledgerFilter === 'all' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>All</button>
                          <button onClick={() => setLedgerFilter('in')} className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${ledgerFilter === 'in' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>In</button>
                          <button onClick={() => setLedgerFilter('out')} className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${ledgerFilter === 'out' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>Out</button>
                      </div>
                  </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden divide-y divide-slate-800 shadow-2xl">
                  {renderLedgerItems(filteredLedger)}
              </div>
          </div>
      </div>

      {/* Receive Modal (Request Form) */}
      {showReceiveQR && user && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
              <div className="bg-slate-900 border border-slate-700 rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden animate-fade-in-up">
                  {showReceiveForm ? (
                      <div className="p-8 space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-black text-white uppercase tracking-tight italic">Generate Invoice</h3>
                            <button onClick={() => setShowReceiveQR(false)} className="text-slate-500 hover:text-white"><X/></button>
                        </div>
                        
                        <div className="flex p-1 bg-slate-950 rounded-xl border border-slate-800 mb-6">
                            <button onClick={() => setIsDonationMode(false)} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${!isDonationMode ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>Fixed Price</button>
                            <button onClick={() => setIsDonationMode(true)} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${isDonationMode ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>Donation Range</button>
                        </div>

                        <div className="space-y-4">
                            {!isDonationMode ? (
                                <>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2 px-1">Amount</label>
                                        <div className="relative">
                                            <Coins className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500" size={24}/>
                                            <input type="number" value={receiveAmount} onChange={e => setReceiveAmount(e.target.value)} placeholder="0" className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-6 py-5 text-4xl font-black text-white focus:outline-none focus:border-amber-500 transition-all placeholder-slate-900"/>
                                        </div>
                                    </div>
                                    <div onClick={() => setAllowTips(!allowTips)} className={`p-4 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${allowTips ? 'bg-emerald-900/20 border-emerald-500/50' : 'bg-slate-950 border-slate-800'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${allowTips ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-800 text-slate-500'}`}><Heart size={16}/></div>
                                            <div><p className={`text-xs font-bold ${allowTips ? 'text-emerald-200' : 'text-slate-400'}`}>Enable Tips</p><p className="text-[9px] text-slate-500">Payer can add 0-300% tip.</p></div>
                                        </div>
                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${allowTips ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-700'}`}>{allowTips && <Check size={12}/>}</div>
                                    </div>
                                </>
                            ) : (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2 px-1">Min VC (Min 1)</label>
                                        <input 
                                            type="number" 
                                            min="1"
                                            value={minAmount} 
                                            onChange={e => setMinAmount(e.target.value)} 
                                            placeholder="1" 
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white text-xl font-bold focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2 px-1">Max VC</label>
                                        <input type="number" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} placeholder="1000" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white text-xl font-bold focus:outline-none focus:border-indigo-500"/>
                                    </div>
                                </div>
                            )}
                            
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2 px-1">Memo</label>
                                <input type="text" value={receiveMemo} onChange={e => setReceiveMemo(e.target.value)} placeholder="Consultation fee, Donation for channel..." className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500"/>
                            </div>
                        </div>

                        <div className="bg-slate-950/50 p-4 rounded-xl border border-indigo-500/20 flex items-center gap-3">
                            <WifiOff size={16} className="text-indigo-400"/>
                            <p className="text-[10px] text-indigo-200">Invoice URI works without internet access.</p>
                        </div>

                        <button 
                            onClick={() => {
                                if (isDonationMode && parseInt(minAmount) < 1) {
                                    alert("Minimum donation must be at least 1 VoiceCoin.");
                                    return;
                                }
                                setShowReceiveForm(false);
                            }} 
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all active:scale-95"
                        >
                            Generate Invoice QR
                        </button>
                      </div>
                  ) : (
                      <div className="p-8 flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-indigo-500/10 text-indigo-400 rounded-full flex items-center justify-center mb-6 border border-indigo-500/20 shadow-xl shadow-indigo-500/10"><QrCode size={32}/></div>
                        <h3 className="text-2xl font-black text-white mb-1 uppercase tracking-tighter italic">
                            {isDonationMode ? `Donation Range` : `Invoice: ${receiveAmount} VC`}
                        </h3>
                        <p className="text-xs text-slate-400 mb-8 max-w-xs">
                            {isDonationMode ? `${minAmount || '1'} to ${maxAmount || '∞'} VC` : (allowTips ? 'Fixed Price + Tips' : 'Exact Amount')}
                        </p>
                        
                        <div className="w-full bg-white p-6 rounded-[2rem] border-8 border-slate-800 mb-8 shadow-inner flex flex-col items-center">
                            <img src={qrImageUrl(buildReceiveUri(user.uid, user.displayName, user.photoURL))} className="w-48 h-48" alt="Receive QR"/>
                            <p className="text-[10px] font-black text-slate-400 uppercase mt-4 tracking-widest">@{user.displayName.replace(/\s+/g, '_').toLowerCase()}</p>
                        </div>

                        <div className="flex gap-2 w-full mb-4">
                            <button onClick={() => { navigator.clipboard.writeText(buildReceiveUri(user.uid, user.displayName, user.photoURL)); alert("Link Copied!"); }} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all"><Copy size={14}/> Copy Link</button>
                            <button onClick={() => setShowReceiveForm(true)} className="p-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all"><Edit3 size={18}/></button>
                        </div>
                        <button onClick={() => setShowReceiveQR(false)} className="w-full py-4 bg-slate-950 text-slate-500 rounded-2xl font-bold hover:text-white transition-all">Dismiss</button>
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* Send Modal (URI Input) */}
      {showTransfer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-900 border border-slate-700 rounded-[2rem] w-full max-w-md overflow-hidden flex flex-col shadow-2xl animate-fade-in-up">
                  <div className="p-6 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
                      <h3 className="font-bold text-white flex items-center gap-2"><Send size={18} className="text-indigo-400 rotate-[-20deg]"/> Analyze Invoice URI</h3>
                      <button onClick={() => setShowTransfer(false)} className="p-1.5 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white transition-colors"><X size={20}/></button>
                  </div>
                  <div className="p-6 space-y-6">
                    <p className="text-sm text-slate-400">Paste the Payment Request URI from another member to start a transfer.</p>
                    <div className="space-y-4">
                        <textarea value={pastedPayUri} onChange={e => setPastedPayUri(e.target.value)} className="w-full h-24 bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs font-mono text-indigo-300 focus:ring-2 focus:ring-indigo-500 outline-none resize-none" placeholder="https://aivoicecast.com/?view=coin_wallet&pay=..."/>
                        <button onClick={handlePastePayUri} disabled={!pastedPayUri.trim()} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 active:scale-95">Analyze Request</button>
                    </div>
                  </div>
              </div>
          </div>
      )}

      {/* Offline Token Modal (Now the Digital Receipt) */}
      {showOfflineToken && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
              <div className="bg-slate-900 border border-slate-700 rounded-[2.5rem] w-full max-w-lg p-8 shadow-2xl flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mb-6 border border-emerald-500/20 shadow-xl shadow-emerald-500/20"><ShieldCheck size={32}/></div>
                  <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter italic">Payment Proof Ready</h3>
                  <p className="text-sm text-slate-400 mb-8 max-w-xs">Scan or share this proof to finalized the transfer. This token is cryptographically signed and serves as digital evidence of your agreement to pay.</p>
                  <div className="w-full bg-white p-6 rounded-3xl border-8 border-slate-800 mb-8 flex flex-col items-center">
                      <img src={qrImageUrl(buildTokenUri(generatedToken!))} className="w-48 h-48" alt="Payment Token QR"/>
                      <p className="text-[10px] font-black text-slate-400 uppercase mt-4 tracking-widest">Bearer Token (Evidence)</p>
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(buildTokenUri(generatedToken!)); alert("Token URI copied!"); }} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold mb-2 flex items-center justify-center gap-2"><Copy size={16}/> Copy Evidence URI</button>
                  <button onClick={() => { setShowOfflineToken(false); setPublicPaymentTarget(null); }} className="w-full py-4 bg-slate-800 text-slate-300 rounded-2xl font-bold transition-all hover:bg-slate-700">Dismiss</button>
              </div>
          </div>
      )}

      {/* Import Token Modal */}
      {showTokenInput && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md p-8 shadow-2xl animate-fade-in-up">
                  <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-white flex items-center gap-2"><Download size={20} className="text-indigo-400"/> Verify Token</h3><button onClick={() => { setShowTokenInput(false); setVerifiedToken(null); setPastedToken(''); }} className="p-1.5 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white transition-colors"><X size={20}/></button></div>
                  {!verifiedToken ? (
                      <div className="space-y-6">
                          <textarea value={pastedToken} onChange={e => setPastedToken(e.target.value)} className="w-full h-32 bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs font-mono text-indigo-300 focus:ring-2 focus:ring-indigo-500 outline-none resize-none" placeholder="Paste token string here..."/>
                          {verificationError && (<div className="p-3 bg-red-900/20 border border-red-900/50 rounded-xl flex items-center gap-2 text-red-400 text-xs"><AlertTriangle size={14}/> {verificationError}</div>)}
                          <div className="grid grid-cols-2 gap-2">
                             <button className="py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold flex items-center justify-center gap-2"><Camera size={18}/> Scan QR</button>
                             <button onClick={() => handleVerifyPastedToken()} disabled={isVerifying || !pastedToken.trim()} className="py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-bold rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2">{isVerifying ? <Loader2 size={18} className="animate-spin"/> : <ShieldCheck size={18}/>}Verify</button>
                          </div>
                      </div>
                  ) : (
                      <div className="space-y-6 animate-fade-in">
                          <div className="bg-emerald-950/20 border border-emerald-500/30 p-6 rounded-3xl text-center">
                              <CheckCircle size={48} className="text-emerald-400 mx-auto mb-3"/><h4 className="text-lg font-bold text-white mb-1">Authentic Payment</h4><p className="text-xs text-slate-400">Signed by {verifiedToken.senderName} and trusted by Authority.</p>
                          </div>
                          <div className="p-6 bg-slate-950 rounded-2xl border border-slate-800">
                              <div className="flex justify-between items-center mb-4"><span className="text-xs text-slate-500 font-bold uppercase tracking-widest">Amount</span><span className="text-3xl font-black text-white">{verifiedToken.amount} VC</span></div>
                              <div className="flex justify-between items-center text-xs"><span className="text-slate-500 font-bold uppercase tracking-widest">Status</span><span className="text-indigo-400 font-bold flex items-center gap-1">{navigator.onLine ? <Globe size={12}/> : <WifiOff size={12}/>} {navigator.onLine ? 'Online (Instant)' : 'Offline (Queued)'}</span></div>
                          </div>
                          <button onClick={handleClaimVerifiedToken} disabled={isClaiming} className={`w-full py-4 ${navigator.onLine ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-800 hover:bg-slate-700'} text-white font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2`}>
                              {isClaiming ? <Loader2 size={20} className="animate-spin"/> : navigator.onLine ? 'Sync to Ledger' : 'Pocket Evidence'}
                          </button>
                      </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};
