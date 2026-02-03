import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  ArrowLeft, FileSignature, Upload, Loader2, Save, Download, 
  Trash2, HardDrive, Cloud, ShieldCheck, X, Check, MousePointer2, 
  Maximize2, PenTool, Type as TypeIcon, RefreshCw, ChevronRight, FileText, Info, Search,
  AlertCircle, SearchCode, ChevronLeft, FileCheck, FileCode, Droplet,
  Fingerprint, Stamp, Move, CheckCircle2, Minus, ShieldAlert, Shield, ShieldQuestion, HelpCircle, Lock, Zap,
  User, Database, ArrowRight, QrCode, Scan, Smartphone, Activity, Send, Link, MessageSquare, Heart
} from 'lucide-react';
import { PDFDocument, rgb, StandardFonts, PDFRawStream, PDFArray } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { auth } from '../services/firebaseConfig';
import { getDriveToken, signInWithGoogle, connectGoogleDrive } from '../services/authService';
import { ensureCodeStudioFolder, ensureFolder, uploadToDrive } from '../services/googleDriveService';
import { UserProfile, SignedDocument, ChannelVisibility } from '../types';
import { generateSecureId } from '../utils/idUtils';
import { getLocalPrivateKey, saveTrustedIdentity, getAllTrustedIdentities } from '../utils/db';
import { signPayment, verifySignature, verifyCertificateOffline } from '../utils/cryptoUtils';
import { getUserProfile, uploadFileToStorage, saveSignedDoc, getSignedDoc, getAllUsers, sendMessage, isUserAdmin } from '../services/firestoreService';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface PdfPageData {
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
}

interface TextPlacement {
    id: string;
    x: number;
    y: number;
    page: number;
    text: string;
}

interface SignaturePlacement {
    id: string;
    x: number;
    y: number;
    page: number;
}

interface VerificationResult {
    isValid: boolean;
    reason?: 'signature' | 'hashes' | 'untrusted' | 'parsing' | 'unregistered';
    signerName?: string;
    signerId?: string;
    timestamp?: number;
    pageMatches: boolean[];
    error?: string;
    isOfflineTrusted?: boolean;
    trustSource?: 'registry' | 'ledger' | 'embedded';
}

interface PdfSignerProps {
  onBack: () => void;
  currentUser: any;
  userProfile: UserProfile | null;
}

export const PdfSigner: React.FC<PdfSignerProps> = ({ onBack, currentUser, userProfile }) => {
  // Fix: Added useMemo import and corrected usage for URLSearchParams
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const docIdFromUrl = params.get('id');
  
  const [activeTab, setActiveTab] = useState<'sign' | 'verify' | 'request'>('sign');
  const [activeMode, setActiveMode] = useState<'sign' | 'text' | 'watermark' | 'move'>('sign');
  const [signatureType, setSignatureType] = useState<'drawn' | 'typed'>('drawn');
  const [typedName, setTypedName] = useState(userProfile?.displayName || '');
  const [overlayText, setOverlayText] = useState('');
  
  // Watermark State
  const [watermarkText] = useState('SOVEREIGN ARTIFACT');
  const [watermarkOpacity] = useState(0.12);

  const [textPlacements, setTextPlacements] = useState<TextPlacement[]>([]);
  const [signaturePlacements, setSignaturePlacements] = useState<SignaturePlacement[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [activePdf, setActivePdf] = useState<{ blob: Blob, name: string, dataUrl: string, remoteId?: string } | null>(null);
  const [pages, setPages] = useState<PdfPageData[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isRendering, setIsRendering] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isStaging, setIsStaging] = useState(false);
  
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null);

  // Sovereign Verification State
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerificationResult | null>(null);
  const [auditTargetDoc, setAuditTargetDoc] = useState<{ blob: Blob, name: string } | null>(null);
  const [auditCertificate, setAuditCertificate] = useState<{ blob: Blob, name: string } | null>(null);

  // Sovereign Signing States
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  const [keyLookupStatus, setKeyLookupStatus] = useState<'idle' | 'checking' | 'found' | 'missing'>('idle');
  const [trustedIdentities, setTrustedIdentities] = useState<Record<string, string>>({});
  
  // Request Workflow States
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<UserProfile | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [requestMemo, setRequestMemo] = useState('');
  const [stagedDocId, setStagedDocId] = useState<string | null>(null);

  // UI for Identity Sharing
  const [showIdentityExport, setShowIdentityExport] = useState(false);
  const [showIdentityImport, setShowIdentityImport] = useState(false);
  const [pastedCert, setPastedCert] = useState('');

  const [profile] = useState<UserProfile | null>(userProfile);

  const dispatchLog = useCallback((text: string, type: 'info' | 'error' | 'success' | 'warn' = 'info') => {
      window.dispatchEvent(new CustomEvent('neural-log', { detail: { text: `[PDF Audit] ${text}`, type } }));
  }, []);

  const refreshRegistry = useCallback(async () => {
    const targetUid = currentUser?.uid || userProfile?.uid;
    if (!targetUid) {
        setKeyLookupStatus('idle');
        return;
    }
    
    setKeyLookupStatus('checking');
    try {
        const [key, trusted] = await Promise.all([
            getLocalPrivateKey(targetUid),
            getAllTrustedIdentities()
        ]);
        setTrustedIdentities(trusted);
        if (key) {
            setPrivateKey(key);
            setKeyLookupStatus('found');
        } else {
            setPrivateKey(null);
            setKeyLookupStatus('missing');
        }
    } catch (e: any) {
        setKeyLookupStatus('missing');
    }
  }, [currentUser?.uid, userProfile?.uid]);

  const renderPdf = async (blob: Blob) => {
      setIsRendering(true);
      try {
          const arrayBuffer = await blob.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
          const renderedPages: PdfPageData[] = [];

          for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const viewport = page.getViewport({ scale: 1.5 });
              const canvas = document.createElement('canvas');
              const context = canvas.getContext('2d');
              canvas.height = viewport.height;
              canvas.width = viewport.width;
              
              if (context) {
                  await page.render({ canvasContext: context, viewport, canvas }).promise;
                  renderedPages.push({ canvas, width: viewport.width, height: viewport.height });
              }
          }
          setPages(renderedPages);
          setCurrentPage(1);
          setSignaturePlacements([]);
          setTextPlacements([]);
      } catch (e) {
          dispatchLog("PDF Rasterization failed.", "error");
      } finally {
          setIsRendering(false);
      }
  };

  useEffect(() => {
    if (docIdFromUrl) {
        setIsLoading(true);
        getSignedDoc(docIdFromUrl).then(async (data) => {
            if (data) {
                try {
                    const response = await fetch(data.originalUrl);
                    const blob = await response.blob();
                    setActivePdf({ blob, name: data.name, dataUrl: URL.createObjectURL(blob), remoteId: data.id });
                    await renderPdf(blob);
                    
                    if (data.status === 'signed') {
                        setActiveTab('verify');
                        dispatchLog("Loaded notarized document from registry.", "info");
                    } else {
                        setActiveTab('sign');
                        dispatchLog("Loaded signature request from registry.", "info");
                    }
                } catch (err) {
                    dispatchLog("Failed to fetch remote PDF binary.", "error");
                }
            }
            setIsLoading(false);
        });
    }
    getAllUsers().then(users => setAllUsers(users.filter(u => u.uid !== currentUser?.uid)));
  }, [docIdFromUrl, currentUser?.uid, dispatchLog]);

  useEffect(() => {
      refreshRegistry();
      window.addEventListener('focus', refreshRegistry);
      return () => window.removeEventListener('focus', refreshRegistry);
  }, [refreshRegistry]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) {
          const file = e.target.files[0];
          setActivePdf({ blob: file, name: file.name, dataUrl: URL.createObjectURL(file) });
          renderPdf(file);
      }
  };

  const computeSha256 = async (bytes: Uint8Array): Promise<string> => {
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
  };

  const computeDeterministicPageHash = async (doc: PDFDocument, pageIdx: number): Promise<string> => {
      const page = doc.getPage(pageIdx);
      const { width, height } = page.getSize();
      const contentsNode = (page as any).node.Contents();
      const streams = contentsNode instanceof PDFArray 
        ? contentsNode.asArray().map((s: any) => doc.context.lookup(s))
        : [doc.context.lookup(contentsNode)];
      const contentParts: Uint8Array[] = [];
      streams.forEach(s => { if (s instanceof PDFRawStream) contentParts.push(s.getContents()); });
      const totalLength = contentParts.reduce((acc, p) => acc + p.length, 0);
      const rawBytes = new Uint8Array(totalLength);
      let offset = 0;
      contentParts.forEach(p => { rawBytes.set(p, offset); offset += p.length; });
      const geometryString = `W:${width.toFixed(0)}H:${height.toFixed(0)}`;
      const geometryBytes = new TextEncoder().encode(geometryString);
      const combined = new Uint8Array(rawBytes.length + geometryBytes.length);
      combined.set(rawBytes); combined.set(geometryBytes, rawBytes.length);
      return await computeSha256(combined);
  };

  const handleStageForSignature = async () => {
    if (!activePdf || !currentUser) return;
    setIsStaging(true);
    try {
        const id = generateSecureId();
        const path = `handshakes/${currentUser.uid}/${id}.pdf`;
        const url = await uploadFileToStorage(path, activePdf.blob);
        
        const docObj: SignedDocument = {
            id,
            name: activePdf.name,
            originalUrl: url,
            ownerId: currentUser.uid,
            ownerName: currentUser.displayName || 'Anonymous',
            status: 'pending',
            createdAt: Date.now(),
            memo: requestMemo,
            requestedSignerId: selectedRecipient?.uid,
            requestedSignerName: selectedRecipient?.displayName
        };
        
        await saveSignedDoc(docObj);
        setStagedDocId(id);
        dispatchLog("Document staged for remote signature.", "success");
        setActiveTab('request');
    } catch (e: any) {
        alert("Staging failed: " + e.message);
    } finally {
        setIsStaging(false);
    }
  };

  const handleSendToChat = async () => {
      if (!stagedDocId || !currentUser) return;
      try {
          const link = `${window.location.origin}${window.location.pathname}?view=pdf_signer&id=${stagedDocId}`;
          const message = `[NEURAL SIGNER REQUEST] Please sign "${activePdf?.name}": ${link}`;
          
          if (selectedRecipient) {
              const channelId = [currentUser.uid, selectedRecipient.uid].sort().join('_');
              // Fix: Added sendMessage call to notify recipient via DM
              await sendMessage(channelId, message, `chat_channels/${channelId}/messages`);
              alert("Signature request dispatched to recipient via DM.");
          } else {
              // Fix: Added sendMessage call to share request to public chat
              await sendMessage('general', message, `chat_channels/general/messages`);
              alert("Signature request shared to General chat.");
          }
          setStagedDocId(null);
      } catch (e: any) {
          alert("Dispatch failed: " + e.message);
      }
  };

  const handleProcessDocument = async () => {
    if (!activePdf || !userProfile || !privateKey) return;
    setIsSaving(true);
    try {
        const existingPdfBytes = await activePdf.blob.arrayBuffer();
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const standardFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const serifFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
        const now = new Date(); const timestampValue = Date.now();
        const timestampStr = `Verified: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
        let sigImage: any = null;
        
        if (signaturePlacements.length > 0) {
            let sigBytes: ArrayBuffer;
            if (signatureType === 'drawn') {
                const sigRes = await fetch(userProfile.savedSignatureUrl!);
                sigBytes = await sigRes.arrayBuffer();
            } else {
                const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 120;
                const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#000000'; ctx.font = 'italic 54px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(typedName || 'Signed', canvas.width / 2, canvas.height / 2);
                sigBytes = await (await fetch(canvas.toDataURL('image/png'))).arrayBuffer();
            }
            sigImage = await pdfDoc.embedPng(sigBytes);
        }
        
        for (let pIdx = 0; pIdx < pdfDoc.getPageCount(); pIdx++) {
            const page = pdfDoc.getPage(pIdx);
            const { width: pW, height: pH } = page.getSize();
            page.drawText(' ', { x: 0, y: 0, size: 1, opacity: 0 }); // Anchor Bake
            
            signaturePlacements.filter(s => s.page === pIdx).forEach(sig => {
                const htmlPage = pages[pIdx]; const sX = pW / htmlPage.width; const sY = pH / htmlPage.height;
                const sigWidth = 120; const sigHeight = (sigImage.height / sigImage.width) * sigWidth;
                page.drawImage(sigImage, { x: sig.x * sX, y: pH - (sig.y * sY), width: sigWidth, height: sigHeight });
                page.drawText(timestampStr, { x: sig.x * sX, y: pH - (sig.y * sY) - 12, size: 7, font: serifFont, color: rgb(0.2, 0.2, 0.2) });
            });
            
            textPlacements.filter(tp => tp.page === pIdx).forEach(tp => {
                const htmlPage = pages[pIdx]; const sX = pW / htmlPage.width; const sY = pH / htmlPage.height;
                page.drawText(tp.text, { x: tp.x * sX, y: pH - (tp.y * sY), size: 10, font: standardFont, color: rgb(0, 0, 0) });
            });
        }
        
        const signedBytes = await pdfDoc.save();
        const signedBlob = new Blob([signedBytes], { type: 'application/pdf' });
        const signedName = activePdf.name.replace('.pdf', '_Signed.pdf');
        
        // Hashes
        const finalizedDocForHash = await PDFDocument.load(signedBytes);
        const hashesList: string[] = [];
        for (let i = 0; i < finalizedDocForHash.getPageCount(); i++) {
            hashesList.push(`P${i + 1}:${await computeDeterministicPageHash(finalizedDocForHash, i)}`);
        }
        const hashesManifest = hashesList.join(',');
        const canonicalPayload = `${hashesManifest.replace(/\s+/g, '')}|${timestampValue}|${currentUser.uid}`;
        const sovereignSignature = await signPayment(privateKey, canonicalPayload);
        
        // Cert Generation
        const certDoc = await PDFDocument.create();
        const auditPage = certDoc.addPage([600, 800]);
        auditPage.drawText("NEURAL AUDIT CERTIFICATE", { x: 50, y: 710, size: 28, font: boldFont });
        auditPage.drawText(`AUTH ID: ${currentUser.uid}`, { x: 50, y: 650, size: 10, font: standardFont });
        auditPage.drawText(`NONCE TS: ${timestampValue}`, { x: 50, y: 630, size: 10, font: standardFont });
        auditPage.drawText(`PAGE HASHES: ${hashesManifest}`, { x: 50, y: 600, size: 6, font: standardFont, maxWidth: 500 });
        auditPage.drawText(`SOVEREIGN SIGNATURE: ${sovereignSignature}`, { x: 50, y: 500, size: 6, font: standardFont, maxWidth: 500 });
        if (userProfile.certificate) {
            auditPage.drawText(`CERT SHARD: ${userProfile.certificate}`, { x: 50, y: 400, size: 3, font: standardFont, opacity: 0.05, maxWidth: 500 });
        }
        auditPage.drawText("VERIFIED NEURAL ARTIFACT", { x: 210, y: 100, size: 14, font: boldFont });
        
        const certBytes = await certDoc.save();
        const certBlob = new Blob([certBytes], { type: 'application/pdf' });
        // Fix: Defined certName before usage
        const certName = activePdf.name.replace('.pdf', '_AuditCert.pdf');
        
        if (activePdf.remoteId) {
            // REMOTE WORKFLOW COMPLETION
            const signedUrl = await uploadFileToStorage(`signed/${currentUser.uid}/${activePdf.remoteId}_signed.pdf`, signedBlob);
            const certUrl = await uploadFileToStorage(`signed/${currentUser.uid}/${activePdf.remoteId}_cert.pdf`, certBlob);
            await saveSignedDoc({ 
                ... (await getSignedDoc(activePdf.remoteId))!, 
                status: 'signed', 
                signedUrl, 
                certificateUrl: certUrl,
                updatedAt: Date.now(),
                hashes: hashesManifest
            });
            
            // SEND COMPLETION MESSAGE
            const docData = await getSignedDoc(activePdf.remoteId);
            if (docData) {
                const link = `${window.location.origin}${window.location.pathname}?view=pdf_signer&id=${activePdf.remoteId}`;
                const channelId = [currentUser.uid, docData.ownerId].sort().join('_');
                const message = `[NEURAL SIGNER COMPLETE] I've signed "${docData.name}". Verification here: ${link}`;
                // Fix: Corrected sendMessage usage
                await sendMessage(channelId, message, `chat_channels/${channelId}/messages`);
                alert("Signature complete. Link sent back to requester.");
            }
        } else {
            // LOCAL DOWNLOAD WORKFLOW
            const a = document.createElement('a'); a.href = URL.createObjectURL(signedBlob); a.download = signedName; a.click();
            const b = document.createElement('a'); b.href = URL.createObjectURL(certBlob); b.download = certName; b.click();
        }
        
        setActivePdf({ blob: signedBlob, name: signedName, dataUrl: URL.createObjectURL(signedBlob) });
        await renderPdf(signedBlob);
    } catch (e: any) { alert(e.message); } finally { setIsSaving(false); }
  };

  const handleMouseDown = (e: React.MouseEvent, pageIdx: number) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (activeMode === 'move') {
          const hitSig = signaturePlacements.find(sp => sp.page === pageIdx && x >= sp.x && x <= sp.x + 120 && y >= sp.y - 40 && y <= sp.y);
          if (hitSig) { setSelectedElementId(hitSig.id); setIsDrawing(true); setDragStart({ x, y }); return; }
          const hitText = textPlacements.find(tp => tp.page === pageIdx && x >= tp.x && x <= tp.x + tp.text.length * 7 && y >= tp.y - 15 && y <= tp.y);
          if (hitText) { setSelectedElementId(hitText.id); setIsDrawing(true); setDragStart({ x, y }); return; }
          setSelectedElementId(null); return;
      }
      setIsDrawing(true); setDragStart({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDrawing || !dragStart) return;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left; const y = e.clientY - rect.top;
      if (activeMode === 'move' && selectedElementId) {
          const dx = x - dragStart.x; const dy = y - dragStart.y;
          const isSig = signaturePlacements.some(s => s.id === selectedElementId);
          if (isSig) setSignaturePlacements(prev => prev.map(s => s.id === selectedElementId ? { ...s, x: s.x + dx, y: s.y + dy } : s));
          else setTextPlacements(prev => prev.map(tp => tp.id === selectedElementId ? { ...tp, x: tp.x + dx, y: tp.y + dy } : tp));
          setDragStart({ x, y });
      }
  };

  const handleMouseUp = (e: React.MouseEvent, pageIdx: number) => {
      if (!isDrawing || !dragStart) { setIsDrawing(false); setDragStart(null); return; }
      if (activeMode === 'move') { setIsDrawing(false); setDragStart(null); return; }
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left; const y = e.clientY - rect.top;
      if (activeMode === 'sign') { setSignaturePlacements(prev => [...prev, { id: generateSecureId(), x, y, page: pageIdx }]); }
      else if (activeMode === 'text') {
          if (!overlayText.trim()) { setIsDrawing(false); setDragStart(null); return; }
          setTextPlacements(prev => [...prev, { id: generateSecureId(), x, y, page: pageIdx, text: overlayText }]);
          setOverlayText('');
      }
      setIsDrawing(false); setDragStart(null);
  };

  // Fix: Implemented handleVerifyDualFile to perform document audit
  const handleVerifyDualFile = async () => {
    if (!auditTargetDoc || !auditCertificate) return;
    setIsVerifying(true);
    setVerifyResult(null);

    try {
        const certArrayBuffer = await auditCertificate.blob.arrayBuffer();
        const certPdf = await pdfjsLib.getDocument({ data: certArrayBuffer }).promise;
        const certPage = await certPdf.getPage(1);
        const textContent = await certPage.getTextContent();
        // @ts-ignore
        const rawText = textContent.items.map(item => item.str).join(' ');

        const authIdMatch = rawText.match(/AUTH ID: ([a-zA-Z0-9-]+)/);
        const hashesMatch = rawText.match(/PAGE HASHES: ([^S]+)/);
        const sigMatch = rawText.match(/SOVEREIGN SIGNATURE: ([a-zA-Z0-9+/=]+)/);
        const tsMatch = rawText.match(/NONCE TS: (\d+)/);

        if (!authIdMatch || !hashesMatch || !sigMatch) {
            throw new Error("Certificate metadata corrupted or missing.");
        }

        const signerId = authIdMatch[1];
        const hashesManifest = hashesMatch[1].trim().replace(/,$/, '');
        const sovereignSignature = sigMatch[1];
        const timestamp = tsMatch ? parseInt(tsMatch[1]) : Date.now();

        const targetArrayBuffer = await auditTargetDoc.blob.arrayBuffer();
        const targetPdfDoc = await PDFDocument.load(targetArrayBuffer);
        const expectedHashes = hashesManifest.split(',');
        const pageMatches: boolean[] = [];

        for (let i = 0; i < targetPdfDoc.getPageCount(); i++) {
            const actualHash = await computeDeterministicPageHash(targetPdfDoc, i);
            const expectedEntry = expectedHashes.find(h => h.startsWith(`P${i + 1}:`));
            const expectedHash = expectedEntry?.split(':')[1];
            pageMatches.push(actualHash === expectedHash);
        }

        if (!pageMatches.every(m => m)) {
            throw new Error("Sector Parity Check Failed: Content has been modified.");
        }

        let publicKey = '';
        const localTrustedCert = trustedIdentities[signerId];
        if (localTrustedCert) {
            publicKey = JSON.parse(atob(localTrustedCert)).publicKey;
        } else {
            const shardMatch = rawText.match(/CERT SHARD: ([a-zA-Z0-9+/=]+)/);
            if (shardMatch) publicKey = JSON.parse(atob(shardMatch[1])).publicKey;
        }

        if (!publicKey) throw new Error("Signer not in trusted ledger.");

        const canonicalPayload = `${hashesManifest.replace(/\s+/g, '')}|${timestamp}|${signerId}`;
        const isValid = await verifySignature(publicKey, sovereignSignature, canonicalPayload);

        if (!isValid) throw new Error("Signature failed cryptographic handshake.");

        const signerProfile = await getUserProfile(signerId);

        setVerifyResult({
            isValid: true,
            signerName: signerProfile?.displayName || 'Sovereign Signatory',
            signerId,
            timestamp,
            pageMatches,
            trustSource: localTrustedCert ? 'registry' : 'embedded'
        });
        
        dispatchLog("Neural Audit Complete: Authenticity Verified.", "success");
    } catch (e: any) {
        setVerifyResult({
            isValid: false,
            reason: 'hashes',
            pageMatches: [],
            error: e.message
        });
        dispatchLog(`Audit Interrupted: ${e.message}`, "error");
    } finally {
        setIsVerifying(false);
    }
  };

  // Fix: Implemented handleImportIdentity to ingest peer certificates
  const handleImportIdentity = async () => {
    if (!pastedCert.trim()) return;
    try {
        const decoded = JSON.parse(atob(pastedCert));
        if (verifyCertificateOffline(pastedCert)) {
            await saveTrustedIdentity(decoded.uid, pastedCert);
            await refreshRegistry();
            dispatchLog(`Peer identity @${decoded.displayName} verified and registered.`, "success");
            setShowIdentityImport(false);
            setPastedCert('');
        } else {
            throw new Error("Certificate root untrusted.");
        }
    } catch (e: any) {
        alert("Verification failed: " + e.message);
    }
  };

  const handleImportIdentityFromShard = () => {
    setShowIdentityImport(true);
  };

  const isSuperAdminUser = isUserAdmin(userProfile);

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md shrink-0 z-20">
          <div className="flex items-center gap-4">
              <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"><ArrowLeft size={20} /></button>
              <h1 className="text-lg font-bold text-white flex items-center gap-2 uppercase tracking-tighter italic"><FileSignature className="text-indigo-400" /> Neural Signer</h1>
          </div>
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button onClick={() => setActiveTab('sign')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'sign' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Sign</button>
              <button onClick={() => setActiveTab('verify')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'verify' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Verify</button>
              <button onClick={() => setActiveTab('request')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'request' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Request</button>
          </div>
          <div className="flex items-center gap-3">
              {activeTab === 'sign' && activePdf && (
                  <button onClick={handleProcessDocument} disabled={isSaving || !privateKey} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase shadow-xl disabled:opacity-30">
                      {isSaving ? <Loader2 size={16} className="animate-spin"/> : <ShieldCheck size={16}/>}<span>{activePdf.remoteId ? 'Sign & Return' : 'Commit & Notarize'}</span>
                  </button>
              )}
          </div>
      </header>

      <div className="flex-1 flex overflow-hidden flex-col lg:flex-row">
          <aside className="w-full lg:w-[350px] border-r border-slate-800 bg-slate-900/30 flex flex-col shrink-0 overflow-y-auto p-6 space-y-8 scrollbar-hide">
              {activeTab === 'sign' && (
                  <div className="space-y-6">
                      <div className={`p-4 rounded-2xl border flex flex-col gap-4 ${privateKey ? 'bg-indigo-900/20 border-indigo-500/30' : 'bg-red-900/10 border-red-500/30'}`}>
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-xl ${privateKey ? 'bg-indigo-600' : 'bg-red-600'} text-white shadow-lg`}>{privateKey ? <ShieldCheck size={20}/> : <ShieldAlert size={20}/>}</div>
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase">Signing Identity</p>
                                <p className="text-xs font-bold text-white">{privateKey ? 'Authority Verified' : 'Handshake Required'}</p>
                            </div>
                          </div>
                      </div>

                      {!activePdf ? (
                          <label className="w-full py-10 border-2 border-dashed border-slate-800 rounded-[2rem] flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-indigo-500/50 transition-all group">
                              <input type="file" className="hidden" accept=".pdf" onChange={handleUpload}/>
                              <Upload size={32} className="text-indigo-400"/>
                              <p className="text-sm font-bold text-white uppercase tracking-tight">Upload PDF</p>
                          </label>
                      ) : (
                          <div className="space-y-6 animate-fade-in">
                              <div className="grid grid-cols-4 gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800">
                                  <button onClick={() => setActiveMode('sign')} className={`py-2 rounded-lg transition-all ${activeMode === 'sign' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}><PenTool size={16}/></button>
                                  <button onClick={() => setActiveMode('text')} className={`py-2 rounded-lg transition-all ${activeMode === 'text' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-50'}`}><TypeIcon size={16}/></button>
                                  <button onClick={() => setActiveMode('watermark')} className={`py-2 rounded-lg transition-all ${activeMode === 'watermark' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-50'}`}><Droplet size={16}/></button>
                                  <button onClick={() => setActiveMode('move')} className={`py-2 rounded-lg transition-all ${activeMode === 'move' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-50'}`}><Move size={16}/></button>
                              </div>
                              
                              <button onClick={handleStageForSignature} disabled={isStaging} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold uppercase border border-slate-700 transition-all flex items-center justify-center gap-2">
                                  {isStaging ? <Loader2 size={16} className="animate-spin"/> : <MessageSquare size={16}/>} Request Signature
                              </button>
                          </div>
                      )}
                  </div>
              )}

              {activeTab === 'request' && (
                  <div className="space-y-6 animate-fade-in">
                      <div className="space-y-4">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block px-1">1. Recipient</label>
                          <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14}/>
                              <input type="text" placeholder="Search members..." value={userSearch} onChange={e => setUserSearch(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none"/>
                              {userSearch && (
                                  <div className="absolute top-full left-0 w-full bg-slate-800 border border-slate-700 rounded-xl mt-1 shadow-2xl z-20 overflow-hidden divide-y divide-slate-700">
                                      {allUsers.filter(u => u.displayName.toLowerCase().includes(userSearch.toLowerCase())).slice(0, 5).map(u => (
                                          <button key={u.uid} onClick={() => { setSelectedRecipient(u); setUserSearch(''); }} className="w-full text-left px-4 py-3 hover:bg-slate-700 flex items-center gap-3 transition-colors">
                                              <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-bold">{(u.displayName || 'U')[0]}</div>
                                              <span className="text-xs text-white">@{u.displayName}</span>
                                          </button>
                                      ))}
                                  </div>
                              )}
                          </div>
                          {selectedRecipient && (
                              <div className="flex items-center justify-between bg-indigo-900/20 border border-indigo-500/30 p-3 rounded-xl">
                                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-300"><User size={14}/> @{selectedRecipient.displayName}</div>
                                  <button onClick={() => setSelectedRecipient(null)} className="text-slate-500 hover:text-white"><X size={14}/></button>
                              </div>
                          )}
                      </div>

                      <div className="space-y-4">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block px-1">2. Memo</label>
                          <textarea value={requestMemo} onChange={e => setRequestMemo(e.target.value)} placeholder="Why do you need this signature?" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-300 h-24 resize-none outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner"/>
                      </div>

                      {!stagedDocId ? (
                        <button onClick={handleStageForSignature} disabled={isStaging || !activePdf} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95 disabled:opacity-30">
                            {isStaging ? <Loader2 size={18} className="animate-spin"/> : <Cloud size={18}/>} Stage for Signature
                        </button>
                      ) : (
                        <div className="space-y-3">
                            <div className="p-4 bg-emerald-900/20 border border-emerald-500/30 rounded-2xl text-[10px] font-bold uppercase text-emerald-400 text-center">Document is Staged</div>
                            <button onClick={handleSendToChat} className="w-full py-4 bg-white text-slate-900 rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95">
                                <Send size={18}/> Dispatch to Chat
                            </button>
                        </div>
                      )}
                  </div>
              )}

              {activeTab === 'verify' && (
                  <div className="space-y-6 animate-fade-in">
                      <div className="space-y-4">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">1. Notarized Document</label>
                          <label className={`w-full py-8 border-2 border-dashed rounded-[2rem] flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${auditTargetDoc ? 'border-emerald-500/50 bg-emerald-900/10' : 'border-slate-800 hover:border-indigo-500/50'}`}>
                              <input type="file" className="hidden" accept=".pdf" onChange={e => e.target.files?.[0] && setAuditTargetDoc({ blob: e.target.files[0], name: e.target.files[0].name })}/>
                              {auditTargetDoc ? <FileCheck size={24} className="text-emerald-400"/> : <FileText size={24} className="text-slate-500"/>}
                              <p className="text-[10px] font-black uppercase text-white truncate max-w-[200px]">{auditTargetDoc ? auditTargetDoc.name : 'Target PDF'}</p>
                          </label>
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">2. Audit Certificate</label>
                          <label className={`w-full py-8 border-2 border-dashed rounded-[2rem] flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${auditCertificate ? 'border-emerald-500/50 bg-emerald-900/10' : 'border-slate-800 hover:border-indigo-500/50'}`}>
                              <input type="file" className="hidden" accept=".pdf" onChange={e => e.target.files?.[0] && setAuditCertificate({ blob: e.target.files[0], name: e.target.files[0].name })}/>
                              {auditCertificate ? <ShieldCheck size={24} className="text-indigo-400"/> : <FileCode size={24} className="text-slate-500"/>}
                              <p className="text-[10px] font-black uppercase text-white truncate max-w-[200px]">{auditCertificate ? auditCertificate.name : 'Certificate PDF'}</p>
                          </label>
                      </div>
                      {/* Fix: Added handleVerifyDualFile call to execute audit */}
                      <button onClick={handleVerifyDualFile} disabled={isVerifying || !auditTargetDoc || !auditCertificate} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 disabled:opacity-30 transition-all">
                          {isVerifying ? <Loader2 size={18} className="animate-spin"/> : <SearchCode size={18}/>} Execute Full Audit
                      </button>
                  </div>
              )}
          </aside>

          <main className="flex-1 bg-slate-950 overflow-y-auto p-10 relative flex flex-col items-center scrollbar-hide">
              {isRendering && <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex flex-col items-center justify-center gap-4"><Loader2 size={40} className="animate-spin text-indigo-500"/><span className="text-xs font-black text-indigo-200 uppercase tracking-widest animate-pulse">Rasterizing Shards...</span></div>}
              
              {!activePdf && !verifyResult ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-800 space-y-8 opacity-20"><FileSignature size={120} /><h3 className="text-2xl font-black uppercase italic tracking-tighter">Signer Portal Active</h3></div>
              ) : verifyResult ? (
                  <div className="max-w-4xl w-full animate-fade-in space-y-8 pb-32">
                       <div className={`p-10 rounded-[3.5rem] border flex flex-col items-center text-center gap-6 shadow-2xl relative overflow-hidden ${verifyResult.isValid ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-red-950/20 border-red-500/30'}`}>
                           <div className="absolute top-0 right-0 p-32 bg-white/5 blur-[100px] rounded-full pointer-events-none"></div>
                           <div className={`w-20 h-20 rounded-3xl flex items-center justify-center shadow-xl border-4 ${verifyResult.isValid ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-red-600 border-red-500 text-white'}`}>
                               {verifyResult.isValid ? <ShieldCheck size={40}/> : <ShieldAlert size={40}/>}
                           </div>
                           <div className="space-y-2 relative z-10">
                               <h2 className={`text-4xl font-black italic uppercase tracking-tighter leading-none ${verifyResult.isValid ? 'text-emerald-400' : 'text-red-400'}`}>
                                   Audit: {verifyResult.isValid ? 'Authentic' : 'Compromised'}
                               </h2>
                               <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em]">
                                   {verifyResult.isValid ? 'IDENTITY & CONTENT INTEGRITY CONFIRMED' : 'SECURITY HANDSHAKE INTERRUPTED'}
                               </p>
                           </div>
                           
                           {verifyResult.isValid && (
                               <button 
                                  onClick={async () => {
                                      const channelId = [currentUser.uid, verifyResult.signerId].sort().join('_');
                                      const message = `[NEURAL ACK] Thank you for signing the document. Signature verified and archived.`;
                                      // Fix: use correctly imported sendMessage to acknowledge signer
                                      await sendMessage(channelId, message, `chat_channels/${channelId}/messages`);
                                      alert("Thank you message sent to signatory.");
                                  }}
                                  className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 flex items-center gap-2"
                               >
                                   {/* Fix: Added Heart icon import */}
                                   <Heart size={16}/> Send Thanks
                               </button>
                           )}

                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mt-4">
                                <div className="bg-slate-900/60 border border-slate-800 rounded-[2rem] p-6 text-left space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><User size={14} className="text-indigo-400"/> Signatory</h4>
                                    <div>
                                        <p className="text-lg font-black text-white">@{verifyResult.signerName || 'Unknown'}</p>
                                        <p className="text-[9px] font-mono text-slate-500 truncate">{verifyResult.signerId}</p>
                                    </div>
                                    <div className={`flex items-center gap-2 text-[10px] font-bold uppercase ${verifyResult.isValid ? 'text-emerald-400' : 'text-red-400'}`}>
                                        <Check size={14}/> Signature Validated
                                    </div>
                                </div>
                                <div className="bg-slate-900/60 border border-slate-800 rounded-[2rem] p-6 text-left space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Database size={14} className="text-indigo-400"/> Sector Parity</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {verifyResult.pageMatches.map((m, i) => (
                                            <div key={i} className={`px-2 py-1 rounded text-[9px] font-black border transition-all ${m ? 'bg-emerald-900/20 border-emerald-500/30 text-emerald-400' : 'bg-red-950/20 border-red-500/30 text-red-400'}`}>
                                                P${i+1}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                           </div>
                       </div>
                  </div>
              ) : activePdf ? (
                  <div className="space-y-8 w-full flex flex-col items-center pb-32">
                      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 p-4 rounded-[2rem] flex justify-between items-center shadow-xl shadow-black/40">
                          <div className="flex items-center gap-4"><div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-2xl shadow-inner"><FileText size={20}/></div><div><p className="text-sm font-black text-white truncate max-w-xs">{activePdf.name}</p><p className="text-[10px] text-slate-500 font-black uppercase">Page {currentPage} / {pages.length}</p></div></div>
                          <div className="flex items-center gap-3"><button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"><ChevronLeft size={20}/></button><div className="bg-slate-950 px-4 py-1 rounded-xl text-[10px] font-black text-indigo-300 uppercase tracking-widest border border-white/5">{currentPage} / {pages.length}</div><button onClick={() => setCurrentPage(p => Math.min(pages.length, p + 1))} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"><ChevronRight size={20}/></button></div>
                      </div>
                      <div className="relative shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] rounded-lg overflow-hidden border border-slate-800 bg-white group/canvas-host">
                          {pages.map((p, i) => (
                              <div key={i} className={currentPage === i + 1 ? 'block relative' : 'hidden'}>
                                  <canvas 
                                    className={`block shadow-inner ${activeTab === 'sign' ? (activeMode === 'text' ? 'cursor-text' : activeMode === 'move' ? 'cursor-move' : 'cursor-crosshair') : 'cursor-default'}`} 
                                    onMouseDown={e => activeTab === 'sign' && handleMouseDown(e, i)} 
                                    onMouseMove={activeTab === 'sign' ? handleMouseMove : undefined} 
                                    onMouseUp={e => activeTab === 'sign' && handleMouseUp(e, i)} 
                                    ref={el => { if (el) { const ctx = el.getContext('2d'); if (ctx) { el.width = p.canvas.width; el.height = p.canvas.height; ctx.drawImage(p.canvas, 0, 0); } } }} 
                                  />
                                  {signaturePlacements.filter(s => s.page === i).map(sig => (
                                      <div key={sig.id} className={`absolute border-2 animate-fade-in group/node ${selectedElementId === sig.id ? 'border-amber-400 ring-4 ring-amber-400/20' : 'border-indigo-500 bg-indigo-500/5'} ${activeMode === 'move' ? 'cursor-move' : 'pointer-events-none'}`} style={{ left: sig.x, top: sig.y - 40, width: '120px', height: '40px' }} >
                                          <div className="absolute -top-5 left-0 bg-indigo-600 text-white text-[7px] font-black uppercase px-2 py-0.5 rounded shadow-lg whitespace-nowrap">AUTHORITY NODE</div>
                                          <div className="w-full h-full flex flex-col items-center justify-center overflow-hidden p-1">{signatureType === 'drawn' ? (userProfile?.savedSignatureUrl && <img src={userProfile.savedSignatureUrl} className="max-h-full max-w-full object-contain mix-blend-multiply" alt="Sig"/>) : <span className="text-black italic font-serif text-xs truncate px-1">{typedName || 'Signatory'}</span>}</div>
                                      </div>
                                  ))}
                                  {textPlacements.filter(p => p.page === i).map(tp => (
                                      <div key={tp.id} className={`absolute border px-1 animate-fade-in group/node ${selectedElementId === tp.id ? 'border-amber-400 ring-4 ring-amber-400/20' : 'border-emerald-500 bg-emerald-500/5'} ${activeMode === 'move' ? 'cursor-move' : 'pointer-events-none'}`} style={{ left: tp.x, top: tp.y - 12 }}>
                                          <span className="text-black text-[10px] font-sans font-medium whitespace-nowrap">{tp.text}</span>
                                      </div>
                                  ))}
                                  {activeMode === 'watermark' && (
                                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden opacity-50 select-none">
                                          <div className="text-slate-900/10 text-4xl font-black uppercase rotate-45 whitespace-nowrap">{watermarkText}</div>
                                      </div>
                                  )}
                              </div>
                          ))}
                      </div>
                  </div>
              ) : null}
          </main>
      </div>
      
      {/* Identity Share Modal */}
      {showIdentityExport && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/95 backdrop-blur-xl animate-fade-in">
              <div className="bg-slate-900 border border-slate-700 rounded-[3.5rem] w-full max-w-md p-10 shadow-2xl space-y-8 text-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-32 bg-indigo-600/10 blur-[100px] rounded-full"></div>
                  <div className="space-y-2 relative z-10">
                      <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">Identity Shard</h2>
                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em]">Neural Authority Certificate</p>
                  </div>
                  <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl relative z-10">
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(userProfile?.certificate || '')}`} alt="Identity QR" className="w-full aspect-square" />
                  </div>
                  <div className="flex flex-col gap-3 relative z-10">
                      <button onClick={() => { navigator.clipboard.writeText(userProfile?.certificate || ''); alert("Copied!"); }} className="w-full py-4 bg-slate-800 text-white rounded-2xl text-xs font-bold uppercase">Copy Base64 Shard</button>
                      <button onClick={() => setShowIdentityExport(false)} className="w-full py-2 text-slate-500 hover:text-white uppercase text-[10px] font-black tracking-widest">Close</button>
                  </div>
              </div>
          </div>
      )}

      {/* Identity Import Modal */}
      {showIdentityImport && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/95 backdrop-blur-xl animate-fade-in">
              <div className="bg-slate-900 border border-slate-700 rounded-[3.5rem] w-full max-w-md p-10 shadow-2xl space-y-8 text-center relative">
                  <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">Ingest Peer</h2>
                  <textarea value={pastedCert} onChange={e => setPastedCert(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-[9px] font-mono text-indigo-300 h-32 focus:ring-2 focus:ring-indigo-500 outline-none resize-none shadow-inner" placeholder="Paste certificate string..."/>
                  <div className="flex flex-col gap-3">
                      {/* Fix: Added handleImportIdentity implementation for peer certificate ingestion */}
                      <button onClick={handleImportIdentity} disabled={!pastedCert.trim()} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl">Verify & Register</button>
                      <button onClick={() => setShowIdentityImport(false)} className="w-full py-2 text-slate-500 hover:text-white uppercase text-[10px] font-black tracking-widest">Cancel</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default PdfSigner;