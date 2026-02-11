
import { 
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, query, where, 
  orderBy, limit, onSnapshot, runTransaction, increment, arrayUnion, arrayRemove, 
  Timestamp, writeBatch
} from '@firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from '@firebase/storage';
import { db, auth, storage } from './firebaseConfig';
import { 
  UserProfile, Channel, Comment, Attachment, Group, ChatChannel, RealTimeMessage, 
  GeneratedLecture, CommunityDiscussion, Booking, Invitation, RecordingSession, CodeProject, 
  CodeFile, CursorPosition, WhiteboardElement, Blog, BlogPost, JobPosting, 
  CareerApplication, Notebook, AgentMemory, GlobalStats, SubscriptionTier, 
  ChannelVisibility, GeneratedIcon, BankingCheck, ShippingLabel, CoinTransaction, OfflinePaymentToken, MockInterviewRecording, TrustScore, DualVerse, DigitalReceipt, UserFeedback, BadgeData, SignedDocument,
  BookData, CloudItem 
} from '../types';
import { SYSTEM_BLOG_POSTS } from '../utils/blogContent';
import { HANDCRAFTED_CHANNELS } from '../utils/initialData';
import { generateSecureId, safeJsonStringify } from '../utils/idUtils';
import { logger } from './logger';

// Collections
const USERS_COLLECTION = 'users';
const CHANNELS_COLLECTION = 'channels';
const CUSTOM_BOOKS_COLLECTION = 'custom_books';
const SYSTEM_BOOK_METADATA_COLLECTION = 'system_book_metadata';
const DISCUSSIONS_COLLECTION = 'discussions';
const LECTURE_CACHE_COLLECTION = 'lecture_cache';
const FEEDBACK_COLLECTION = 'feedback';
const RECEIPTS_COLLECTION = 'receipts';
const AUDIO_LEDGER_COLLECTION = 'neural_audio_ledger';
const RECORDINGS_COLLECTION = 'recordings';
const BLOGS_COLLECTION = 'blogs';
const BLOG_POSTS_COLLECTION = 'blog_posts';
const JOB_POSTINGS_COLLECTION = 'job_postings';
const CAREER_APPS_COLLECTION = 'career_applications';
const CODE_PROJECTS_COLLECTION = 'code_projects';
const WHITEBOARDS_COLLECTION = 'whiteboards';
const NOTEBOOKS_COLLECTION = 'notebooks';
const CARDS_COLLECTION = 'cards';
const ICONS_COLLECTION = 'icons';
const CHECKS_COLLECTION = 'checks';
const SHIPPING_COLLECTION = 'shipping';
const TRANSACTIONS_COLLECTION = 'coin_transactions';
const BIBLE_LEDGER_COLLECTION = 'bible_ledger';
const MOCK_INTERVIEWS_COLLECTION = 'mock_interviews';
const BADGES_COLLECTION = 'badges';
const SIGNED_DOCS_COLLECTION = 'signed_documents';
const CLOUD_FILES_COLLECTION = 'user_cloud_files';

// --- CONSTANTS ---
export const ADMIN_GROUP = 'architects';
export const DEFAULT_MONTHLY_GRANT = 100000;
export const AI_COSTS = {
  TEXT_REFRACTION: 50,
  AUDIO_SYNTHESIS: 200,
  IMAGE_GENERATION: 1000,
  CURRICULUM_SYNTHESIS: 500,
  TECHNICAL_EVALUATION: 2000
};

export const sanitizeData = (data: any): any => {
    if (data === null || data === undefined) return null;
    if (typeof data !== 'object') return data;
    try {
        const json = safeJsonStringify(data);
        const parsed = JSON.parse(json);
        if (typeof parsed !== 'object' || parsed === null) return { __refracted_value: String(parsed) };
        return parsed;
    } catch (e) {
        console.warn("[Firestore] Sanitization fault:", e);
        return { __sanitization_error: String(e), __serialized_at: Date.now() };
    }
};

// --- AUDIO LEDGER (BCP: Binary Chunking Protocol) ---
export async function saveAudioToLedger(channelId: string, topicId: string, nodeId: string, base64: string, mime: string) {
    if (!db) return;

    // BCP Implementation: Bypassing the 1MB wall by sharding into 750KB chunks.
    const CHUNK_SIZE = 750000;
    const chunks = [];
    for (let i = 0; i < base64.length; i += CHUNK_SIZE) {
        chunks.push(base64.substring(i, i + CHUNK_SIZE));
    }

    const batch = writeBatch(db);
    
    // Register the Manifest Node
    batch.set(doc(db, AUDIO_LEDGER_COLLECTION, nodeId), {
        id: nodeId,
        channelId,
        topicId,
        storageType: 'firestore_sharded',
        chunkCount: chunks.length,
        mimeType: mime,
        timestamp: Date.now()
    });

    // Register the Data Shards
    chunks.forEach((data, idx) => {
        batch.set(doc(db, AUDIO_LEDGER_COLLECTION, `${nodeId}_chunk_${idx}`), { data });
    });

    await batch.commit();
}

export async function getCloudAudioUrl(channelId: string, topicId: string, nodeId: string, lang: string): Promise<string | null> {
    if (!db) return null;
    const manifestSnap = await getDoc(doc(db, AUDIO_LEDGER_COLLECTION, nodeId));
    if (!manifestSnap.exists()) return null;
    
    const manifest = manifestSnap.data() as any;
    const chunkCount = manifest.chunkCount;
    if (!chunkCount) return null;

    // Sequential Re-hydration (Bypassing network burst limits)
    let fullBase64 = "";
    for (let i = 0; i < chunkCount; i++) {
        const chunkSnap = await getDoc(doc(db, AUDIO_LEDGER_COLLECTION, `${nodeId}_chunk_${i}`));
        const chunkData = chunkSnap.data() as any;
        if (chunkSnap.exists() && chunkData) fullBase64 += chunkData.data;
    }
    
    return `data:${manifest.mimeType};base64,${fullBase64}`;
}

// --- REMAINING FIRESTORE SERVICES ---
export async function uploadFileToStorage(path: string, file: Blob | File): Promise<string> {
    if (!storage) throw new Error("Storage unavailable");
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, USERS_COLLECTION, uid));
    return snap.exists() ? snap.data() as UserProfile : null;
}

export async function syncUserProfile(user: any): Promise<void> {
    if (!db || !user) return;
    const userRef = doc(db, USERS_COLLECTION, user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
        const profile: UserProfile = {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || 'New Member',
            photoURL: user.photoURL || '',
            createdAt: Date.now(),
            lastLogin: Date.now(),
            subscriptionTier: 'free',
            groups: [],
            coinBalance: 5000 
        };
        await setDoc(userRef, profile);
    } else {
        await updateDoc(userRef, { lastLogin: Date.now() });
    }
}

export async function updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, USERS_COLLECTION, uid), sanitizeData(data));
}

export function isUserAdmin(profile: UserProfile | null): boolean {
    return !!profile?.groups?.includes(ADMIN_GROUP) || profile?.email === 'shengliang.song.ai@gmail.com';
}

export async function getAllUsers(): Promise<UserProfile[]> {
    if (!db) return [];
    const snap = await getDocs(collection(db, USERS_COLLECTION));
    return (snap as any).docs.map((d: any) => d.data() as UserProfile);
}

export async function incrementApiUsage(uid: string) {
    if (!db) return;
    await updateDoc(doc(db, USERS_COLLECTION, uid), { apiUsageCount: increment(1) });
}

export async function logUserActivity(type: string, data: any) {
    if (!db || !auth.currentUser) return;
    const logRef = collection(db, 'activity_logs');
    await addDoc(logRef, sanitizeData({
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName,
        type,
        data,
        timestamp: Date.now()
    }));
}

export function subscribeToPublicChannels(callback: (channels: Channel[]) => void) {
    if (!db) return () => {};
    const q = query(collection(db, CHANNELS_COLLECTION), where('visibility', '==', 'public'));
    return onSnapshot(q, (snap) => {
        callback(snap.docs.map(d => d.data() as Channel));
    });
}

export async function getPublicChannels(): Promise<Channel[]> {
    if (!db) return [];
    const q = query(collection(db, CHANNELS_COLLECTION), where('visibility', '==', 'public'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Channel);
}

export async function publishChannelToFirestore(channel: Channel): Promise<void> {
    if (!db) return;
    await setDoc(doc(db, CHANNELS_COLLECTION, channel.id), sanitizeData(channel));
}

export async function deleteChannelFromFirestore(id: string): Promise<void> {
    if (!db) return;
    await deleteDoc(doc(db, CHANNELS_COLLECTION, id));
}

export async function getCreatorChannels(uid: string): Promise<Channel[]> {
    if (!db) return [];
    const q = query(collection(db, CHANNELS_COLLECTION), where('ownerId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Channel);
}

export async function getChannelsByIds(ids: string[]): Promise<Channel[]> {
    if (!db || !ids.length) return [];
    const q = query(collection(db, CHANNELS_COLLECTION), where('id', 'in', ids.slice(0, 10)));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Channel);
}

export function subscribeToChannelStats(id: string, callback: (stats: any) => void, initial: any) {
    if (!db) return () => {};
    return onSnapshot(doc(db, 'channel_stats', id), (snap) => {
        if (snap.exists()) callback(snap.data());
        else callback(initial);
    });
}

async function ensureChannelExists(id: string) {
    if (!db) return;
    const channelRef = doc(db, CHANNELS_COLLECTION, id);
    const snap = await getDoc(channelRef);
    if (!snap.exists()) {
        const base = HANDCRAFTED_CHANNELS.find(c => c.id === id);
        if (base) {
            await setDoc(channelRef, sanitizeData({ ...base, visibility: 'public' }));
        }
    }
}

export async function shareChannel(id: string) {
    if (!db) return;
    await setDoc(doc(db, 'channel_stats', id), { shares: increment(1) }, { merge: true });
}

export async function voteChannel(id: string, type: 'like' | 'dislike') {
    if (!db) return;
    await ensureChannelExists(id);
    const statsRef = doc(db, 'channel_stats', id);
    const channelRef = doc(db, CHANNELS_COLLECTION, id);
    const delta = type === 'like' ? 1 : -1;
    await setDoc(statsRef, { likes: increment(delta) }, { merge: true });
    await updateDoc(channelRef, { likes: increment(delta) });
}

export async function addCommentToChannel(id: string, comment: Comment) {
    if (!db) return;
    await ensureChannelExists(id);
    const channelRef = doc(db, CHANNELS_COLLECTION, id);
    const statsRef = doc(db, 'channel_stats', id);
    await runTransaction(db, async (transaction) => {
        transaction.update(channelRef, { comments: arrayUnion(sanitizeData(comment)) });
        transaction.set(statsRef, { comments: increment(1) }, { merge: true });
    });
}

export async function deleteCommentFromChannel(channelId: string, commentId: string) {
    if (!db) return;
    const snap = await getDoc(doc(db, CHANNELS_COLLECTION, channelId));
    if (snap.exists()) {
        const data = snap.data() as any;
        const comments = data?.comments as Comment[];
        const filtered = comments.filter(c => c.id !== commentId);
        await updateDoc(doc(db, CHANNELS_COLLECTION, channelId), { comments: filtered });
        const statsRef = doc(db, 'channel_stats', channelId);
        await setDoc(statsRef, { comments: increment(-1) }, { merge: true });
    }
}

export async function updateCommentInChannel(channelId: string, commentId: string, text: string, attachments: Attachment[]) {
    if (!db) return;
    const snap = await getDoc(doc(db, CHANNELS_COLLECTION, channelId));
    if (snap.exists()) {
        const data = snap.data() as any;
        const comments = data?.comments as Comment[];
        const updated = comments.map(c => c.id === commentId ? { ...c, text, attachments: sanitizeData(attachments) } : c);
        await updateDoc(doc(db, CHANNELS_COLLECTION, channelId), { comments: updated });
    }
}

export async function addChannelAttachment(channelId: string, attachment: Attachment) {
    if (!db) return;
    await updateDoc(doc(db, CHANNELS_COLLECTION, channelId), { appendix: arrayUnion(sanitizeData(attachment)) });
}

export async function seedDatabase(): Promise<void> {
    if (!db) return;
    const batch = writeBatch(db);
    HANDCRAFTED_CHANNELS.forEach(c => {
        batch.set(doc(db, CHANNELS_COLLECTION, c.id), sanitizeData({ ...c, visibility: 'public' }));
    });
    await batch.commit();
}

export async function transferCoins(toUid: string, toName: string, toEmail: string, amount: number, memo: string) {
    if (!db || !auth.currentUser) return;
    const fromUid = auth.currentUser.uid;
    const fromName = auth.currentUser.displayName || 'Sender';
    await runTransaction(db, async (tx) => {
        const fromRef = doc(db, USERS_COLLECTION, fromUid);
        const fromSnap = await tx.get(fromRef);
        if (!fromSnap.exists() || fromSnap.data().coinBalance < amount) throw new Error("Insufficient balance for handshake.");
        tx.update(fromRef, { coinBalance: increment(-amount) });
        const txRef = doc(collection(db, TRANSACTIONS_COLLECTION));
        tx.set(txRef, sanitizeData({
            id: txRef.id, fromId: fromUid, fromName: fromName, toId: 'system', toName: 'AIVoiceCast Escrow', amount: amount, type: 'escrow_hold', memo: `Escrow for ${toName}: ${memo}`, timestamp: Date.now(), isVerified: true
        }));
        const inviteRef = doc(collection(db, 'invitations'));
        tx.set(inviteRef, sanitizeData({
            id: inviteRef.id, fromUserId: fromUid, fromName: fromName, toEmail: toEmail, toUserId: toUid, amount: amount, memo: memo, status: 'pending', type: 'coin', createdAt: Date.now()
        }));
    });
}

export async function getCoinTransactions(uid: string): Promise<CoinTransaction[]> {
    if (!db) return [];
    const q1 = query(collection(db, TRANSACTIONS_COLLECTION), where('fromId', '==', uid));
    const q2 = query(collection(db, TRANSACTIONS_COLLECTION), where('toId', '==', uid));
    const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    const all = [...s1.docs, ...s2.docs].map(d => d.data() as CoinTransaction);
    return Array.from(new Map(all.map(tx => [tx.id, tx])).values()).sort((a, b) => b.timestamp - a.timestamp);
}

export async function checkAndGrantMonthlyCoins(uid: string) {
    if (!db) return;
    const userRef = doc(db, USERS_COLLECTION, uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return;
    const data = snap.data() as any;
    const lastGrant = data?.lastCoinGrantAt || 0;
    const oneMonth = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - lastGrant > oneMonth) {
        await updateDoc(userRef, { coinBalance: increment(DEFAULT_MONTHLY_GRANT), lastCoinGrantAt: Date.now() });
    }
}

export async function deductCoins(uid: string, amount: number): Promise<UserProfile | null> {
    if (!db) return null;
    const userRef = doc(db, USERS_COLLECTION, uid);
    
    // Capture pre-balance for telemetry
    const preSnap = await getDoc(userRef);
    const preBalance = preSnap.data()?.coinBalance || 0;
    
    await updateDoc(userRef, { coinBalance: increment(-amount) });
    const postProfile = await getUserProfile(uid);
    const postBalance = postProfile?.coinBalance || 0;

    // Dispatched to Diagnostic Console
    logger.info(`Neural Ledger Update: ${amount} VC Refracted.`, {
        category: 'LEDGER',
        preBalance,
        postBalance,
        cost: amount
    });

    return postProfile;
}

export async function saveCustomBook(book: BookData): Promise<string> {
    if (!db || !auth.currentUser) throw new Error("Auth required.");
    const id = book.id || generateSecureId();
    const finalBook = { ...book, id, ownerId: auth.currentUser.uid, isCustom: true, updatedAt: Date.now() };
    await setDoc(doc(db, CUSTOM_BOOKS_COLLECTION, id), sanitizeData(finalBook));
    return id;
}

export async function getCustomBooks(): Promise<BookData[]> {
    if (!db) return [];
    const snap = await getDocs(collection(db, CUSTOM_BOOKS_COLLECTION));
    return snap.docs.map(d => d.data() as BookData);
}

export async function deleteCustomBook(id: string) {
    if (!db) return;
    await deleteDoc(doc(db, CUSTOM_BOOKS_COLLECTION, id));
}

export async function getSystemBookMetadata(bookId: string): Promise<{ coverImage?: string } | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, SYSTEM_BOOK_METADATA_COLLECTION, bookId));
    return snap.exists() ? snap.data() as { coverImage?: string } : null;
}

export async function findUserByEmail(email: string): Promise<UserProfile | null> {
    if (!db) return null;
    const q = query(collection(db, USERS_COLLECTION), where('email', '==', email), limit(1));
    const snap = await getDocs(q);
    return snap.empty ? null : snap.docs[0].data() as UserProfile;
}

export async function saveSystemBookMetadata(bookId: string, metadata: { coverImage: string }) {
    if (!db) return;
    await setDoc(doc(db, SYSTEM_BOOK_METADATA_COLLECTION, bookId), sanitizeData(metadata), { merge: true });
}

export async function getCloudCachedLecture(channelId: string, contentUid: string, language: string): Promise<GeneratedLecture | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, LECTURE_CACHE_COLLECTION, `${channelId}_${contentUid}_${language}`));
    return snap.exists() ? snap.data() as GeneratedLecture : null;
}

export async function saveCloudCachedLecture(channelId: string, contentUid: string, language: string, lecture: GeneratedLecture) {
    if (!db) return;
    await setDoc(doc(db, LECTURE_CACHE_COLLECTION, `${channelId}_${contentUid}_${language}`), sanitizeData(lecture));
}

export async function getJobPostings(): Promise<JobPosting[]> {
    if (!db) return [];
    const snap = await getDocs(collection(db, JOB_POSTINGS_COLLECTION));
    return snap.docs.map(d => ({ ...d.data() as any, id: d.id } as JobPosting));
}

export async function getAllCareerApplications(): Promise<CareerApplication[]> {
    if (!db) return [];
    const snap = await getDocs(collection(db, CAREER_APPS_COLLECTION));
    return snap.docs.map(d => ({ ...d.data() as any, id: d.id } as CareerApplication));
}

export async function getJobPosting(id: string): Promise<JobPosting | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, JOB_POSTINGS_COLLECTION, id));
    return snap.exists() ? { ...snap.data() as any, id: snap.id } as JobPosting : null;
}

export async function createJobPosting(job: JobPosting): Promise<string> {
    if (!db) throw new Error("DB offline");
    const docRef = await addDoc(collection(db, JOB_POSTINGS_COLLECTION), sanitizeData(job));
    return docRef.id;
}

export async function submitCareerApplication(app: CareerApplication) {
    if (!db) return;
    await addDoc(collection(db, CAREER_APPS_COLLECTION), sanitizeData(app));
}

export async function getCreatorNotebooks(uid: string): Promise<Notebook[]> {
    if (!db) return [];
    const q = query(collection(db, NOTEBOOKS_COLLECTION), where('ownerId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Notebook);
}

export async function saveNotebook(nb: Notebook): Promise<string> {
    if (!db) throw new Error("DB offline");
    await setDoc(doc(db, NOTEBOOKS_COLLECTION, nb.id), sanitizeData(nb));
    return nb.id;
}

export async function getNotebook(id: string): Promise<Notebook | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, NOTEBOOKS_COLLECTION, id));
    return snap.exists() ? snap.data() as Notebook : null;
}

export async function deleteCard(id: string) {
    if (!db) return;
    await deleteDoc(doc(db, CARDS_COLLECTION, id));
}

export async function getUserCards(uid: string): Promise<AgentMemory[]> {
    if (!db) return [];
    const q = query(collection(db, CARDS_COLLECTION), where('ownerId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as AgentMemory);
}

export async function getCard(id: string): Promise<AgentMemory | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, CARDS_COLLECTION, id));
    return snap.exists() ? snap.data() as AgentMemory : null;
}

export async function saveCard(card: AgentMemory, id: string): Promise<string> {
    if (!db || !auth.currentUser) throw new Error("Auth required");
    const finalCard = { ...card, id, ownerId: auth.currentUser.uid, generatedAt: new Date().toISOString() };
    await setDoc(doc(db, CARDS_COLLECTION, id), sanitizeData(finalCard));
    return id;
}

export async function saveUserFeedback(feedback: UserFeedback) {
    if (!db) return;
    await setDoc(doc(db, FEEDBACK_COLLECTION, feedback.id), sanitizeData(feedback));
}

export async function getAllFeedback(): Promise<UserFeedback[]> {
    if (!db) return [];
    const snap = await getDocs(collection(db, FEEDBACK_COLLECTION));
    return snap.docs.map(d => d.data() as UserFeedback);
}

export async function updateFeedbackStatus(id: string, status: UserFeedback['status']) {
    if (!db) return;
    await updateDoc(doc(db, FEEDBACK_COLLECTION, id), { status });
}

export async function saveBankingCheck(check: BankingCheck) {
    if (!db) return;
    await setDoc(doc(db, CHECKS_COLLECTION, check.id), sanitizeData(check));
}

export async function getCheckById(id: string): Promise<BankingCheck | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, CHECKS_COLLECTION, id));
    return snap.exists() ? snap.data() as BankingCheck : null;
}

export async function getUserChecks(uid: string): Promise<BankingCheck[]> {
    if (!db) return [];
    const q = query(collection(db, CHECKS_COLLECTION), where('ownerId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as BankingCheck);
}

export async function deleteCheck(id: string) {
    if (!db) return;
    await deleteDoc(doc(db, CHECKS_COLLECTION, id));
}

export async function claimCoinCheck(id: string) {
    if (!db || !auth.currentUser) return;
    const snap = await getDoc(doc(db, CHECKS_COLLECTION, id));
    if (!snap.exists()) throw new Error("Check not found.");
    const data = snap.data() as any;
    if (!data.isCoinCheck) throw new Error("Not a coin check.");
    await transferCoins('system', 'System', 'system@neuralprism.io', data.coinAmount, `Coin Check Redemption: ${id}`);
}

export async function calculateUserTrustScore(uid: string): Promise<TrustScore> {
    if (!db) return { score: 600, totalChecksIssued: 0, averageAmount: 0, verifiedVolume: 0, lastActivity: Date.now() };
    const q = query(collection(db, CHECKS_COLLECTION), where('ownerId', '==', uid), where('isVerified', '==', true));
    const snap = await getDocs(q);
    const checks = snap.docs.map(d => d.data() as BankingCheck);
    const total = checks.length;
    const volume = checks.reduce((acc, c) => acc + c.amount, 0);
    const avg = total > 0 ? volume / total : 0;
    const score = Math.min(850, 600 + (total * 5) + Math.floor(volume / 1000));
    return { score, totalChecksIssued: total, averageAmount: avg, verifiedVolume: volume, lastActivity: Date.now() };
}

export function subscribeToCodeProject(id: string, callback: (p: CodeProject) => void) {
    if (!db) return () => {};
    return onSnapshot(doc(db, CODE_PROJECTS_COLLECTION, id), (snap) => {
        if (snap.exists()) callback(snap.data() as CodeProject);
    });
}

export async function getCodeProject(id: string): Promise<CodeProject | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, CODE_PROJECTS_COLLECTION, id));
    return snap.exists() ? snap.data() as CodeProject : null;
}

export async function saveCodeProject(project: CodeProject) {
    if (!db) return;
    await setDoc(doc(db, CODE_PROJECTS_COLLECTION, project.id), sanitizeData(project));
}

export async function updateCodeFile(projectId: string, file: CodeFile) {
    if (!db) return;
    const p = await getCodeProject(projectId);
    if (p) {
        const nextFiles = p.files.map(f => f.path === file.path ? file : f);
        await updateDoc(doc(db, CODE_PROJECTS_COLLECTION, projectId), { files: sanitizeData(nextFiles), lastModified: Date.now() });
    }
}

export async function updateCursor(projectId: string, cursor: CursorPosition) {
    if (!db) return;
    await setDoc(doc(db, CODE_PROJECTS_COLLECTION, projectId, 'cursors', cursor.clientId), sanitizeData(cursor));
}

export async function claimCodeProjectLock(projectId: string, clientId: string) {
    if (!db) return;
    await updateDoc(doc(db, CODE_PROJECTS_COLLECTION, projectId), { activeClientId: clientId });
}

// Fix: Removed duplicate implementations of updateProjectActiveFile
export async function updateProjectActiveFile(projectId: string, filePath: string) {
    if (!db) return;
    await updateDoc(doc(db, CODE_PROJECTS_COLLECTION, projectId), { activeFilePath: filePath });
}

// Fix: Removed duplicate implementations of updateProjectAccess
export async function updateProjectAccess(projectId: string, level: 'public' | 'restricted', allowedUserIds?: string[]) {
    if (!db) return;
    await updateDoc(doc(db, CODE_PROJECTS_COLLECTION, projectId), { accessLevel: level, allowedUserIds: allowedUserIds || [] });
}

export function subscribeToWhiteboard(id: string, callback: (elements: WhiteboardElement[]) => void) {
    if (!db) return () => {};
    return onSnapshot(doc(db, WHITEBOARDS_COLLECTION, id), (snap) => {
        if (snap.exists()) callback((snap.data() as any).elements || []);
    });
}

export async function updateWhiteboardElement(id: string, el: WhiteboardElement) {
    if (!db) return;
    await updateDoc(doc(db, WHITEBOARDS_COLLECTION, id), { elements: arrayUnion(sanitizeData(el)) });
}

export async function saveWhiteboardSession(id: string, elements: WhiteboardElement[]) {
    if (!db) return;
    await setDoc(doc(db, WHITEBOARDS_COLLECTION, id), { elements: sanitizeData(elements), updatedAt: Date.now() }, { merge: true });
}

export async function deleteWhiteboardElements(id: string) {
    if (!db) return;
    await updateDoc(doc(db, WHITEBOARDS_COLLECTION, id), { elements: [] });
}

export async function ensureUserBlog(user: any): Promise<Blog> {
    if (!db) throw new Error("DB offline");
    const q = query(collection(db, BLOGS_COLLECTION), where('ownerId', '==', user.uid));
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].data() as Blog;
    const id = generateSecureId();
    const blog: Blog = {
        id, ownerId: user.uid, authorName: user.displayName || 'Anonymous', title: `${user.displayName}'s Neural Stream`, description: 'Reflections from the Neural Prism.', createdAt: Date.now()
    };
    await setDoc(doc(db, BLOGS_COLLECTION, id), blog);
    return blog;
}

export async function getCommunityPosts(): Promise<BlogPost[]> {
    if (!db) return [];
    try {
        const q = query(collection(db, BLOG_POSTS_COLLECTION), where('status', '==', 'published'), orderBy('publishedAt', 'desc'), limit(50));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as BlogPost);
    } catch (e) {
        const qSimple = query(collection(db, BLOG_POSTS_COLLECTION), where('status', '==', 'published'), limit(50));
        const snap = await getDocs(qSimple);
        const data = snap.docs.map(d => d.data() as BlogPost);
        return data.sort((a, b) => (b.publishedAt || b.createdAt) - (a.publishedAt || a.createdAt));
    }
}

export async function getUserPosts(blogId: string): Promise<BlogPost[]> {
    if (!db) return [];
    const q = query(collection(db, BLOG_POSTS_COLLECTION), where('blogId', '==', blogId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as BlogPost);
}

export async function createBlogPost(post: BlogPost) {
    if (!db) return;
    await setDoc(doc(db, BLOG_POSTS_COLLECTION, post.id || generateSecureId()), sanitizeData(post));
}

export async function updateBlogPost(id: string, data: Partial<BlogPost>) {
    if (!db) return;
    await updateDoc(doc(db, BLOG_POSTS_COLLECTION, id), sanitizeData(data));
}

export async function deleteBlogPost(id: string) {
    if (!db) return;
    await deleteDoc(doc(db, BLOG_POSTS_COLLECTION, id));
}

export async function updateBlogSettings(id: string, data: Partial<Blog>) {
    if (!db) return;
    await updateDoc(doc(db, BLOGS_COLLECTION, id), sanitizeData(data));
}

export async function addPostComment(postId: string, comment: Comment) {
    if (!db) return;
    await updateDoc(doc(db, BLOG_POSTS_COLLECTION, postId), { comments: arrayUnion(sanitizeData(comment)), commentCount: increment(1) });
}

export async function getBlogPost(id: string): Promise<BlogPost | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, BLOG_POSTS_COLLECTION, id));
    return snap.exists() ? snap.data() as BlogPost : null;
}

export async function deleteBlog(id: string) {
    if (!db) return;
    await deleteDoc(doc(db, BLOGS_COLLECTION, id));
}

export async function seedBlogPosts(): Promise<void> {
    if (!db) return;
    const batch = writeBatch(db);
    SYSTEM_BLOG_POSTS.forEach(p => { batch.set(doc(db, BLOG_POSTS_COLLECTION, p.id), sanitizeData(p)); });
    await batch.commit();
}

export async function sendMessage(channelId: string, text: string, path: string, replyTo?: any, attachments?: any[]) {
    if (!db || !auth.currentUser) return;
    const msgRef = doc(collection(db, path));
    const message: RealTimeMessage = {
        id: msgRef.id, text, senderId: auth.currentUser.uid, senderName: auth.currentUser.displayName || 'Anonymous', senderImage: auth.currentUser.photoURL || '', timestamp: Timestamp.now(), replyTo, attachments
    };
    await setDoc(msgRef, sanitizeData(message));
}

export function subscribeToMessages(channelId: string, callback: (msgs: RealTimeMessage[]) => void, path: string) {
    if (!db) return () => {};
    const q = query(collection(db, path), orderBy('timestamp', 'asc'), limit(100));
    return onSnapshot(q, (snap) => { callback(snap.docs.map(d => d.data() as RealTimeMessage)); });
}

export async function createOrGetDMChannel(otherUid: string, otherName: string): Promise<string> {
    if (!db || !auth.currentUser) return 'general';
    const myUid = auth.currentUser.uid;
    const channelId = [myUid, otherUid].sort().join('_');
    const chanRef = doc(db, 'chat_channels', channelId);
    const snap = await getDoc(chanRef);
    if (!snap.exists()) {
        await setDoc(chanRef, { id: channelId, name: `${auth.currentUser.displayName} & ${otherName}`, type: 'dm', memberIds: [myUid, otherUid], createdAt: Date.now() });
    }
    return channelId;
}

export async function getUserDMChannels(): Promise<ChatChannel[]> {
    if (!db || !auth.currentUser) return [];
    const q = query(collection(db, 'chat_channels'), where('memberIds', 'array-contains', auth.currentUser.uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as ChatChannel);
}

export async function deleteMessage(channelId: string, msgId: string, path: string) {
    if (!db) return;
    await deleteDoc(doc(db, path, msgId));
}

export async function saveRecordingReference(rec: RecordingSession) {
    if (!db) return;
    await setDoc(doc(db, RECORDINGS_COLLECTION, rec.id), sanitizeData(rec));
}

export async function getUserRecordings(uid: string): Promise<RecordingSession[]> {
    if (!db) return [];
    const q = query(collection(db, RECORDINGS_COLLECTION), where('userId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as RecordingSession);
}

export async function deleteRecordingReference(id: string, mediaUrl: string, transcriptUrl: string) {
    if (!db) return;
    await deleteDoc(doc(db, RECORDINGS_COLLECTION, id));
}

export async function updateBookingRecording(bookingId: string, recordingUrl: string) {
    if (!db) return;
    await updateDoc(doc(db, 'bookings', bookingId), { recordingUrl, status: 'completed' });
}

export async function getUserGroups(uid: string): Promise<Group[]> {
    if (!db) return [];
    const q = query(collection(db, 'groups'), where('memberIds', 'array-contains', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Group);
}

export async function getPublicGroups(uid: string): Promise<Group[]> {
    if (!db) return [];
    const q = query(collection(db, 'groups'), where('visibility', '==', 'public'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Group).filter(g => !g.memberIds.includes(uid));
}

export async function createGroup(name: string, visibility: 'public' | 'private'): Promise<string> {
    if (!db || !auth.currentUser) throw new Error("Auth required");
    const id = generateSecureId();
    const group: Group = { id, name, visibility, ownerId: auth.currentUser.uid, memberIds: [auth.currentUser.uid], createdAt: Date.now() };
    await setDoc(doc(db, 'groups', id), group);
    await updateDoc(doc(db, USERS_COLLECTION, auth.currentUser.uid), { groups: arrayUnion(id) });
    return id;
}

export async function joinGroup(groupId: string) {
    if (!db || !auth.currentUser) return;
    const uid = auth.currentUser.uid;
    await updateDoc(doc(db, 'groups', groupId), { memberIds: arrayUnion(uid) });
    await updateDoc(doc(db, USERS_COLLECTION, uid), { groups: arrayUnion(groupId) });
}

export async function removeMemberFromGroup(groupId: string, uid: string) {
    if (!db) return;
    await updateDoc(doc(db, 'groups', groupId), { memberIds: arrayRemove(uid) });
    await updateDoc(doc(db, USERS_COLLECTION, uid), { groups: arrayRemove(groupId) });
}

export async function renameGroup(id: string, name: string) {
    if (!db) return;
    await updateDoc(doc(db, 'groups', id), { name });
}

export async function deleteGroup(id: string) {
    if (!db) return;
    await deleteDoc(doc(db, 'groups', id));
}

export async function sendInvitation(groupId: string, toEmail: string) {
    if (!db || !auth.currentUser) return;
    const groupSnap = await getDoc(doc(db, 'groups', groupId));
    const data = groupSnap.data() as any;
    const groupName = groupSnap.exists() && data ? data.name : 'Group';
    await addDoc(collection(db, 'invitations'), { fromUserId: auth.currentUser.uid, fromName: auth.currentUser.displayName, toEmail, groupId, groupName, status: 'pending', type: 'group', createdAt: Date.now() });
}

export async function respondToInvitation(invite: Invitation, accept: boolean) {
    if (!db || !auth.currentUser) return;
    const inviteRef = doc(db, 'invitations', invite.id);
    if (invite.type === 'coin') {
        if (accept) {
            await runTransaction(db, async (tx) => {
                const userRef = doc(db, USERS_COLLECTION, auth.currentUser.uid);
                const invSnap = await tx.get(inviteRef);
                if (invSnap.data()?.status !== 'pending') throw new Error("Neural Check: Invitation already processed.");
                tx.update(userRef, { coinBalance: increment(invite.amount || 0) });
                tx.update(inviteRef, { status: 'accepted' });
                const txRef = doc(collection(db, TRANSACTIONS_COLLECTION));
                // Fix: Define missing variables by using data from the invitation and current user
                tx.set(txRef, sanitizeData({
                    id: txRef.id, 
                    fromId: 'system', 
                    fromName: 'AIVoiceCast Escrow', 
                    toId: auth.currentUser.uid, 
                    toName: auth.currentUser.displayName || 'Recipient', 
                    amount: invite.amount || 0, 
                    type: 'transfer', 
                    memo: `Escrow Release: ${invite.memo}`, 
                    timestamp: Date.now(), 
                    isVerified: true
                }));
            });
        } else {
            await runTransaction(db, async (tx) => {
                const senderRef = doc(db, USERS_COLLECTION, invite.fromUserId);
                const invSnap = await tx.get(inviteRef);
                if (invSnap.data()?.status !== 'pending') throw new Error("Neural Check: Invitation already processed.");
                tx.update(senderRef, { coinBalance: increment(invite.amount || 0) });
                tx.update(inviteRef, { status: 'rejected' });
                const txRef = doc(collection(db, TRANSACTIONS_COLLECTION));
                tx.set(txRef, sanitizeData({
                    id: txRef.id, fromId: 'system', fromName: 'AIVoiceCast Escrow', toId: invite.fromUserId, toName: invite.fromName, amount: invite.amount, type: 'transfer', memo: `Escrow Refund (Rejected by Recipient): ${invite.memo}`, timestamp: Date.now(), isVerified: true
                }));
            });
        }
        return;
    }
    await updateDoc(inviteRef, { status: accept ? 'accepted' : 'rejected' });
    if (accept && invite.groupId) await joinGroup(invite.groupId);
}

export async function getGroupMembers(uids: string[]): Promise<UserProfile[]> {
    if (!db || !uids.length) return [];
    const q = query(collection(db, USERS_COLLECTION), where('uid', 'in', uids.slice(0, 10)));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as UserProfile);
}

export async function getPendingInvitations(uid: string, email: string): Promise<Invitation[]> {
    if (!db) return [];
    const q1 = query(collection(db, 'invitations'), where('toUserId', '==', uid), where('status', '==', 'pending'));
    const q2 = query(collection(db, 'invitations'), where('toEmail', '==', email), where('status', '==', 'pending'));
    const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    const all = [...(s1 as any).docs, ...(s2 as any).docs].map((d: any) => ({ ...d.data() as any, id: d.id } as Invitation));
    return Array.from(new Map(all.map(item => [item.id, item])).values());
}

export async function createBooking(booking: Booking) {
    if (!db) return;
    await setDoc(doc(db, 'bookings', booking.id), sanitizeData(booking));
}

export async function getPendingBookings(uid: string, email: string): Promise<Booking[]> {
    if (!db) return [];
    const q1 = query(collection(db, 'bookings'), where('mentorId', '==', uid), where('status', '==', 'pending'));
    const q2 = query(collection(db, 'bookings'), where('toEmail', '==', email), where('status', '==', 'pending'));
    const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    const all = [...(s1 as any).docs, ...(s2 as any).docs].map((d: any) => ({ ...d.data() as any, id: d.id } as Booking));
    return Array.from(new Map(all.map(item => [item.id, item])).values());
}

export async function getUserBookings(uid: string, email: string): Promise<Booking[]> {
    if (!db) return [];
    const q1 = query(collection(db, 'bookings'), where('userId', '==', uid));
    const q2 = query(collection(db, 'bookings'), where('mentorId', '==', uid));
    const q3 = query(collection(db, 'bookings'), where('invitedEmail', '==', email));
    const [s1, s2, s3] = await Promise.all([getDocs(q1), getDocs(q2), getDocs(q3)]);
    const all = [...(s1 as any).docs, ...(s2 as any).docs, ...(s3 as any).docs].map((d: any) => ({ ...d.data() as any, id: d.id } as Booking));
    return Array.from(new Map(all.map(b => [b.id, b])).values());
}

export async function respondToBooking(id: string, accept: boolean) {
    if (!db) return;
    await updateDoc(doc(db, 'bookings', id), { status: accept ? 'scheduled' : 'rejected' });
}

export async function cancelBooking(id: string) {
    if (!db) return;
    await updateDoc(doc(db, 'bookings', id), { status: 'cancelled' });
}

export async function claimReceipt(id: string) {
    if (!db || !auth.currentUser) return;
    await runTransaction(db, async (tx) => {
        const receiptRef = doc(db, RECEIPTS_COLLECTION, id);
        const receiptSnap = await tx.get(receiptRef);
        if (!receiptSnap.exists()) throw new Error("Registry Error: Receipt not found.");
        const data = receiptSnap.data() as any;
        if (data.status !== 'confirmed') throw new Error("Authorization Required: Payer has not confirmed this request.");
        const payerRef = doc(db, USERS_COLLECTION, data.receiverId);
        const requesterRef = doc(db, USERS_COLLECTION, data.senderId);
        const payerSnap = await tx.get(payerRef);
        if (!payerSnap.exists() || payerSnap.data().coinBalance < data.amount) throw new Error("Insufficient Payer Balance: Handshake failed.");
        tx.update(payerRef, { coinBalance: increment(-data.amount) });
        tx.update(requesterRef, { coinBalance: increment(data.amount) });
        tx.update(receiptRef, { status: 'claimed', claimedAt: Date.now() });
        const txRef = doc(collection(db, TRANSACTIONS_COLLECTION));
        tx.set(txRef, sanitizeData({
            id: txRef.id, fromId: data.receiverId, fromName: data.receiverName, toId: data.senderId, toName: data.senderName, amount: data.amount, type: 'receipt_claim', memo: data.memo, timestamp: Date.now(), isVerified: true
        }));
    });
}

export async function confirmReceipt(id: string) {
    if (!db) return;
    await updateDoc(doc(db, RECEIPTS_COLLECTION, id), { status: 'confirmed', confirmedAt: Date.now() });
}

export async function issueReceipt(receiverId: string, receiverName: string, amount: number, memo: string) {
    if (!db || !auth.currentUser) return;
    await addDoc(collection(db, RECEIPTS_COLLECTION), { senderId: auth.currentUser.uid, senderName: auth.currentUser.displayName, receiverId, receiverName, amount, memo, status: 'pending', createdAt: Date.now() });
}

export function subscribeToReceipts(uid: string, callback: (receipts: DigitalReceipt[]) => void) {
    if (!db) return () => {};
    const q1 = query(collection(db, RECEIPTS_COLLECTION), where('receiverId', '==', uid));
    const q2 = query(collection(db, RECEIPTS_COLLECTION), where('senderId', '==', uid));
    const unsub1 = onSnapshot(q1, (s1) => { const r1 = s1.docs.map(d => ({ ...d.data(), id: d.id } as DigitalReceipt)); callback(r1); });
    const unsub2 = onSnapshot(q2, (s2) => { const r2 = s2.docs.map(d => ({ ...d.data(), id: d.id } as DigitalReceipt)); callback(r2); });
    return () => { unsub1(); unsub2(); };
}

export async function getDiscussionById(id: string): Promise<CommunityDiscussion | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, DISCUSSIONS_COLLECTION, id));
    return snap.exists() ? snap.data() as CommunityDiscussion : null;
}

export function subscribeToDiscussion(id: string, callback: (d: CommunityDiscussion) => void) {
    if (!db) return () => {};
    return onSnapshot(doc(db, DISCUSSIONS_COLLECTION, id), (snap) => { if (snap.exists()) callback(snap.data() as CommunityDiscussion); });
}

export async function saveDiscussionDesignDoc(id: string, designDoc: string, title?: string) {
    if (!db) return;
    const update: any = { designDoc, updatedAt: Date.now() };
    if (title) update.title = title;
    await updateDoc(doc(db, DISCUSSIONS_COLLECTION, id), update);
}

export async function saveDiscussion(discussion: CommunityDiscussion): Promise<string> {
    if (!db) throw new Error("DB offline");
    const id = discussion.id === 'new' ? generateSecureId() : (discussion.id || generateSecureId());
    const finalDoc = { ...discussion, id };
    await setDoc(doc(db, DISCUSSIONS_COLLECTION, id), sanitizeData(finalDoc));
    return id;
}

export async function deleteDiscussion(id: string) {
    if (!db) return;
    await deleteDoc(doc(db, DISCUSSIONS_COLLECTION, id));
}

export async function updateDiscussionVisibility(id: string, visibility: ChannelVisibility, groupIds?: string[]) {
    if (!db) return;
    await updateDoc(doc(db, DISCUSSIONS_COLLECTION, id), { visibility, groupIds: groupIds || [] });
}

export async function getUserDesignDocs(uid: string): Promise<CommunityDiscussion[]> {
    if (!db) return [];
    const q = query(collection(db, DISCUSSIONS_COLLECTION), where('userId', '==', uid));
    const snap = await getDocs(q);
    return (snap as any).docs.map((d: any) => ({ ...d.data() as any, id: d.id } as CommunityDiscussion));
}

export async function getPublicDesignDocs(): Promise<CommunityDiscussion[]> {
    if (!db) return [];
    const q = query(collection(db, DISCUSSIONS_COLLECTION), where('visibility', '==', 'public'));
    const snap = await getDocs(q);
    return (snap as any).docs.map((d: any) => d.data() as CommunityDiscussion);
}

export async function getGroupDesignDocs(groups: string[]): Promise<CommunityDiscussion[]> {
    if (!db || !groups.length) return [];
    const q = query(collection(db, DISCUSSIONS_COLLECTION), where('visibility', '==', 'group'), where('groupIds', 'array-contains-any', groups.slice(0, 10)));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as CommunityDiscussion);
}

export async function deleteInterview(id: string) {
    if (!db) return;
    await deleteDoc(doc(db, MOCK_INTERVIEWS_COLLECTION, id));
}

export async function getUserInterviews(uid: string): Promise<MockInterviewRecording[]> {
    if (!db) return [];
    const q = query(collection(db, MOCK_INTERVIEWS_COLLECTION), where('userId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as MockInterviewRecording);
}

export async function saveInterviewRecording(rec: MockInterviewRecording) {
    if (!db) return;
    await setDoc(doc(db, MOCK_INTERVIEWS_COLLECTION, rec.id), sanitizeData(rec));
}

export async function saveScriptureToLedger(book: string, chapter: string, verses: DualVerse[], hasAudio = false) {
    if (!db) return;
    await setDoc(doc(db, BIBLE_LEDGER_COLLECTION, `${book}_${chapter}`), { book, chapter, verses: sanitizeData(verses), hasAudio, updatedAt: Date.now() });
}

export async function getScriptureFromLedger(book: string, chapter: string): Promise<{ verses: DualVerse[], hasAudio: boolean } | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, BIBLE_LEDGER_COLLECTION, `${book}_${chapter}`));
    return snap.exists() ? snap.data() as any : null;
}

export async function getScriptureAudioUrl(book: string, chapter: string, verseNum: string, lang: 'en' | 'zh'): Promise<string | null> {
    const nodeId = `node_${book}_${chapter}_${verseNum}_${lang}`;
    return await getCloudAudioUrl(book, chapter, nodeId, lang);
}

export async function saveIcon(icon: GeneratedIcon) {
    if (!db) return;
    await setDoc(doc(db, ICONS_COLLECTION, icon.id), sanitizeData(icon));
}

export async function getIcon(id: string): Promise<GeneratedIcon | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, ICONS_COLLECTION, id));
    return snap.exists() ? snap.data() as GeneratedIcon : null;
}

export async function saveShippingLabel(label: ShippingLabel) {
    if (!db) return;
    await setDoc(doc(db, SHIPPING_COLLECTION, label.id), sanitizeData(label));
}

export async function registerIdentity(uid: string, publicKey: string, certificate: string) {
    if (!db) return;
    await updateDoc(doc(db, USERS_COLLECTION, uid), { publicKey, certificate });
}

export async function claimOfflinePayment(token: OfflinePaymentToken) {
    if (!db || !auth.currentUser) return;
    await addDoc(collection(db, TRANSACTIONS_COLLECTION), sanitizeData({
        senderId: token.senderId, senderName: token.senderName, toId: auth.currentUser.uid, toName: auth.currentUser.displayName, amount: token.amount, type: 'offline', memo: token.memo, timestamp: Date.now(), isVerified: true, offlineToken: token.nonce
    }));
    await updateDoc(doc(db, USERS_COLLECTION, auth.currentUser.uid), { coinBalance: increment(token.amount) });
}

export async function saveBadge(badge: BadgeData) {
    if (!db) return;
    await setDoc(doc(db, BADGES_COLLECTION, badge.id), sanitizeData(badge));
}

export async function getBadge(id: string): Promise<BadgeData | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, BADGES_COLLECTION, id));
    return snap.exists() ? snap.data() as BadgeData : null;
}

export async function getUserBadges(uid: string): Promise<BadgeData[]> {
    if (!db) return [];
    const q = query(collection(db, BADGES_COLLECTION), where('ownerId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as BadgeData);
}

export async function saveSignedDoc(docObj: SignedDocument) {
    if (!db) return;
    await setDoc(doc(db, SIGNED_DOCS_COLLECTION, docObj.id), sanitizeData(docObj));
}

export async function getSignedDoc(id: string): Promise<SignedDocument | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, SIGNED_DOCS_COLLECTION, id));
    return snap.exists() ? snap.data() as SignedDocument : null;
}

export async function deleteSignedDoc(id: string) {
    if (!db) return;
    await deleteDoc(doc(db, SIGNED_DOCS_COLLECTION, id));
}

export async function followUser(myUid: string, targetUid: string) {
    if (!db) return;
    await updateDoc(doc(db, USERS_COLLECTION, myUid), { following: arrayUnion(targetUid) });
    await updateDoc(doc(db, USERS_COLLECTION, targetUid), { followers: arrayUnion(myUid) });
}

export async function unfollowUser(myUid: string, targetUid: string) {
    if (!db) return;
    await updateDoc(doc(db, USERS_COLLECTION, myUid), { following: arrayRemove(targetUid) });
    await updateDoc(doc(db, USERS_COLLECTION, targetUid), { followers: arrayRemove(myUid) });
}

export async function getGlobalStats(): Promise<GlobalStats> {
    if (!db) return { totalLogins: 0, uniqueUsers: 0 };
    const snap = await getDoc(doc(db, 'global_stats', 'counters'));
    return snap.exists() ? snap.data() as GlobalStats : { totalLogins: 0, uniqueUsers: 0 };
}

export async function recalculateGlobalStats() {
    if (!db) return;
    const snap = await getDocs(collection(db, USERS_COLLECTION));
    const count = (snap as any).size;
    await setDoc(doc(db, 'global_stats', 'counters'), { uniqueUsers: count, totalLogins: increment(0) }, { merge: true });
}

export async function purgeFirestoreCollection(col: string) {
    if (!db) return;
    const snap = await getDocs(collection(db, col));
    const batch = writeBatch(db);
    (snap as any).docs.forEach((d: any) => batch.delete(d.ref));
    await batch.commit();
}

export async function updateAllChannelDatesToToday() {
    if (!db) return;
    const snap = await getDocs(collection(db, CHANNELS_COLLECTION));
    const batch = writeBatch(db);
    const now = Date.now();
    (snap as any).docs.forEach((d: any) => batch.update(d.ref, { createdAt: now }));
    await batch.commit();
}

export async function deleteFirestoreDoc(col: string, id: string) {
    if (!db) return;
    await deleteDoc(doc(db, col, id));
}

export async function getDebugCollectionDocs(col: string, l: number = 50): Promise<any[]> {
    if (!db) return [];
    const q = query(collection(db, col), limit(l));
    const snap = await getDocs(q);
    return (snap as any).docs.map((d: any) => ({ ...d.data() as any, id: d.id }));
}

export async function setUserSubscriptionTier(uid: string, tier: SubscriptionTier) {
    if (!db) return;
    await updateDoc(doc(db, USERS_COLLECTION, uid), { subscriptionTier: tier });
}

// --- CLOUD FILE SYSTEM (VFS) ---

/**
 * Lists items in a cloud directory, filtered by sessionId.
 */
export async function listCloudDirectory(path: string, sessionId: string): Promise<CloudItem[]> {
    if (!db) return [];
    
    // VFS Sector: Filter exclusively by sessionId to group project files
    const q = query(collection(db, CLOUD_FILES_COLLECTION), where('sessionId', '==', sessionId));
    const snap = await getDocs(q);
    const files = snap.docs.map(d => d.data() as any);
    
    // Simple path-based filtering for directory simulation
    return files.filter(f => {
        const parentPath = f.fullPath.includes('/') ? f.fullPath.substring(0, f.fullPath.lastIndexOf('/')) : '';
        return parentPath === path;
    }).map(f => ({
        name: f.name,
        fullPath: f.fullPath,
        isFolder: f.isFolder,
        size: f.size,
        contentType: f.contentType,
        status: f.status
    }));
}

/**
 * Saves a code file to the cloud vault with a 128KB sharding threshold.
 * Matches standard Gemini Flash context window (128K tokens).
 */
export async function saveProjectToCloud(path: string, name: string, content: string, sessionId: string) {
    if (!db) throw new Error("Database offline");
    const fullPath = path ? `${path}/${name}` : name;
    
    // SHARED ID: Deriving file ID from Session ID + Path
    const fileId = btoa(sessionId + fullPath).replace(/=/g, '');
    
    // REFRATION LIMIT: 128KB. 
    // Matches Gemini Flash standard context window for zero-overflow inference.
    const CHUNK_SIZE = 128000; 
    const chunks = [];
    if (content.length > CHUNK_SIZE) {
        for (let i = 0; i < content.length; i += CHUNK_SIZE) {
            chunks.push(content.substring(i, i + CHUNK_SIZE));
        }
    }

    const batch = writeBatch(db);
    const mainDocRef = doc(db, CLOUD_FILES_COLLECTION, fileId);

    const fileMeta = {
        userId: auth?.currentUser?.uid || 'guest',
        sessionId: sessionId,
        name,
        fullPath,
        isFolder: false,
        lastModified: Date.now(),
        size: content.length,
        isSharded: chunks.length > 0,
        chunkCount: chunks.length
    };

    if (chunks.length > 0) {
        batch.set(mainDocRef, { ...fileMeta, content: "[SHARDED_CONTENT]" }, { merge: true });
        chunks.forEach((chunk, idx) => {
            batch.set(doc(db, CLOUD_FILES_COLLECTION, `${fileId}_chunk_${idx}`), { 
                data: chunk, 
                sessionId: sessionId
            });
        });
    } else {
        batch.set(mainDocRef, { ...fileMeta, content }, { merge: true });
    }
    
    await batch.commit();
}

/**
 * Re-hydrates sharded content from the cloud vault using the session-derived ID.
 */
export async function getCloudFileContent(fullPath: string, sessionId: string): Promise<string> {
    if (!db) throw new Error("Database offline");
    const fileId = btoa(sessionId + fullPath).replace(/=/g, '');
    
    const snap = await getDoc(doc(db, CLOUD_FILES_COLLECTION, fileId));
    if (!snap.exists()) throw new Error("File not found in session registry.");
    
    const data = snap.data() as any;
    if (!data.isSharded) return data.content || '';

    // Sequential Re-hydration (Bypassing network burst limits)
    let fullContent = "";
    for (let i = 0; i < data.chunkCount; i++) {
        const chunkSnap = await getDoc(doc(db, CLOUD_FILES_COLLECTION, `${fileId}_chunk_${i}`));
        if (chunkSnap.exists()) {
            fullContent += chunkSnap.data()?.data || '';
        }
    }
    return fullContent;
}

/**
 * Deletes an item from the cloud (and its shards)
 */
export async function deleteCloudItem(path: string, sessionId: string) {
    if (!db) return;
    const fileId = btoa(sessionId + path).replace(/=/g, '');
    const snap = await getDoc(doc(db, CLOUD_FILES_COLLECTION, fileId));
    
    const batch = writeBatch(db);
    batch.delete(doc(db, CLOUD_FILES_COLLECTION, fileId));

    if (snap.exists()) {
        const data = snap.data() as any;
        if (data.isSharded) {
            for (let i = 0; i < data.chunkCount; i++) {
                batch.delete(doc(db, CLOUD_FILES_COLLECTION, `${fileId}_chunk_${i}`));
            }
        }
    }
    await batch.commit();
}

/**
 * Creates a folder in the cloud
 */
export async function createCloudFolder(path: string, sessionId: string) {
    if (!db) return;
    const fileId = btoa(sessionId + path).replace(/=/g, '');
    await setDoc(doc(db, CLOUD_FILES_COLLECTION, fileId), {
        userId: auth?.currentUser?.uid || 'guest',
        sessionId: sessionId,
        name: path.split('/').pop(),
        fullPath: path,
        isFolder: true,
        lastModified: Date.now()
    }, { merge: true });
}

/**
 * Deletes a file from a code project
 */
export async function deleteCodeFile(projectId: string, filePath: string) {
    if (!db) return;
    const p = await getCodeProject(projectId);
    if (p) {
        const nextFiles = p.files.filter(f => f.path !== filePath);
        await updateDoc(doc(db, CODE_PROJECTS_COLLECTION, projectId), { files: sanitizeData(nextFiles), lastModified: Date.now() });
    }
}

/**
 * Moves/renames a file in a code project
 */
export async function moveCloudFile(projectId: string, oldPath: string, newPath: string) {
    if (!db) return;
    const p = await getCodeProject(projectId);
    if (p) {
        const nextFiles = p.files.map(f => f.path === oldPath ? { ...f, path: newPath, name: newPath.split('/').pop() || f.name } : f);
        await updateDoc(doc(db, CODE_PROJECTS_COLLECTION, projectId), { files: sanitizeData(nextFiles), lastModified: Date.now() });
    }
}

/**
 * Sends a share notification to users (via invitations)
 */
export async function sendShareNotification(uids: string[], docName: string, link: string, fromName: string) {
    if (!db || !auth.currentUser) return;
    for (const uid of uids) {
        const inviteId = generateSecureId();
        await setDoc(doc(db, 'invitations', inviteId), sanitizeData({
            id: inviteId,
            fromUserId: auth.currentUser.uid,
            fromName: fromName,
            toUserId: uid,
            groupName: docName,
            status: 'pending',
            type: 'session',
            link,
            createdAt: Date.now()
        }));
    }
}

/**
 * Deletes a folder and all its contents recursively in a code project
 */
export async function deleteCloudFolderRecursive(projectId: string, folderPath: string) {
    if (!db) return;
    const p = await getCodeProject(projectId);
    if (p) {
        const nextFiles = p.files.filter(f => !f.path.startsWith(folderPath));
        await updateDoc(doc(db, CODE_PROJECTS_COLLECTION, projectId), { files: sanitizeData(nextFiles), lastModified: Date.now() });
    }
}
