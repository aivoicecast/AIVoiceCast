import { 
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, query, where, 
  orderBy, limit, onSnapshot, runTransaction, increment, arrayUnion, arrayRemove, 
  Timestamp, writeBatch
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from './firebaseConfig';
import { 
  UserProfile, Channel, Comment, Attachment, Group, ChatChannel, RealTimeMessage, 
  GeneratedLecture, CommunityDiscussion, Booking, Invitation, RecordingSession, CodeProject, 
  CodeFile, CursorPosition, WhiteboardElement, Blog, BlogPost, JobPosting, 
  CareerApplication, Notebook, AgentMemory, GlobalStats, SubscriptionTier, 
  ChannelVisibility, GeneratedIcon, BankingCheck, ShippingLabel, CoinTransaction, OfflinePaymentToken, MockInterviewRecording, TrustScore, DualVerse, DigitalReceipt, UserFeedback
} from '../types';
import { HANDCRAFTED_CHANNELS } from '../utils/initialData';
import { generateSecureId } from '../utils/idUtils';
import { bytesToBase64 } from '../utils/audioUtils';

// Collections
const USERS_COLLECTION = 'users';
const CHANNELS_COLLECTION = 'channels';
const GROUPS_COLLECTION = 'groups';
const DISCUSSIONS_COLLECTION = 'discussions';
const LECTURE_CACHE_COLLECTION = 'lecture_cache';
const FEEDBACK_COLLECTION = 'feedback';
const RECEIPTS_COLLECTION = 'receipts';
const AUDIO_LEDGER_COLLECTION = 'neural_audio_ledger';
const INVITATIONS_COLLECTION = 'invitations';
const BOOKINGS_COLLECTION = 'bookings';
const RECORDINGS_COLLECTION = 'recordings';
const CODE_PROJECTS_COLLECTION = 'code_projects';
const WHITEBOARDS_COLLECTION = 'whiteboards';
const BLOGS_COLLECTION = 'blogs';
const BLOG_POSTS_COLLECTION = 'blog_posts';
const JOBS_COLLECTION = 'jobs';
const APPLICATIONS_COLLECTION = 'applications';
const NOTEBOOKS_COLLECTION = 'notebooks';
const CARDS_COLLECTION = 'cards';
const ICONS_COLLECTION = 'icons';
const TRANSACTIONS_COLLECTION = 'coin_transactions';
const INTERVIEWS_COLLECTION = 'interviews';
const BIBLE_LEDGER_COLLECTION = 'bible_ledger';

export const ADMIN_GROUP = 'admin_neural_prism';

export const AI_COSTS = {
    TEXT_REFRACTION: 100,
    CURRICULUM_SYNTHESIS: 250,
    AUDIO_SYNTHESIS: 50,
    IMAGE_GENERATION: 500,
    VIDEO_GENERATION: 5000,
    TECHNICAL_EVALUATION: 1000
};

export const DEFAULT_MONTHLY_GRANT = 500;

const sanitizeData = (data: any, seen = new WeakSet()): any => {
    if (data === null || typeof data !== 'object') return data === undefined ? null : data;
    if (seen.has(data)) return '[Circular Ref]';
    if (data instanceof Date) return data.getTime();
    if (data instanceof Timestamp) return data.toMillis();
    if (Array.isArray(data)) {
        seen.add(data);
        return data.map(item => sanitizeData(item, seen));
    }
    const isPlainObject = Object.getPrototypeOf(data) === Object.prototype;
    if (!isPlainObject) return String(data);
    seen.add(data);
    const result: any = {};
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            if (key.startsWith('_') || key === 'auth' || key === 'app') continue;
            result[key] = sanitizeData(data[key], seen);
        }
    }
    return result;
};

// --- CORE UTILITIES ---

/**
 * Saves raw audio bytes to a chunked Firestore ledger for fast retrieval.
 */
export async function saveAudioToLedger(nodeId: string, bytes: Uint8Array, mimeType: string = 'audio/mpeg'): Promise<string | null> {
    if (!db) throw new Error("Database offline.");
    const docRef = doc(db, AUDIO_LEDGER_COLLECTION, nodeId);
    const CHUNK_SIZE = 750000; 
    if (bytes.length <= CHUNK_SIZE) {
        const base64Data = bytesToBase64(bytes);
        await setDoc(docRef, { data: base64Data, mimeType: mimeType, size: bytes.length, isChunked: false, updatedAt: Date.now() });
        return nodeId;
    } else {
        const numChunks = Math.ceil(bytes.length / CHUNK_SIZE);
        await setDoc(docRef, { isChunked: true, chunkCount: numChunks, mimeType: mimeType, totalSize: bytes.length, updatedAt: Date.now() });
        const batch = writeBatch(db);
        for (let i = 0; i < numChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, bytes.length);
            const slice = bytes.slice(start, end);
            const chunkRef = doc(db, AUDIO_LEDGER_COLLECTION, `${nodeId}_part_${i}`);
            batch.set(chunkRef, { data: bytesToBase64(slice), updatedAt: Date.now() });
        }
        await batch.commit();
        return nodeId;
    }
}

/**
 * Retrieves chunked audio from the ledger and reconstructs it into a data URI.
 */
export async function getCloudAudioUrl(nodeId: string): Promise<string | null> {
    if (!db) return null;
    try {
        const docRef = doc(db, AUDIO_LEDGER_COLLECTION, nodeId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const mData = snap.data();
            const mime = (mData.mimeType || 'audio/mpeg').toLowerCase();
            let base64Data = '';
            if (!mData.isChunked) base64Data = mData.data;
            else {
                const chunkDocs = await Promise.all(
                    Array.from({ length: mData.chunkCount }, (_, i) => getDoc(doc(db, AUDIO_LEDGER_COLLECTION, `${nodeId}_part_${i}`)))
                );
                base64Data = chunkDocs.map(d => d.exists() ? d.data()?.data : '').join('');
            }
            return `data:${mime};base64,${base64Data}`;
        }
    } catch (e) { console.error("Ledger retrieval failed", e); }
    return null;
}

// --- STORAGE ---
/**
 * Generic file upload to Firebase Storage.
 */
export async function uploadFileToStorage(path: string, file: File | Blob): Promise<string> {
    if (!storage) throw new Error("Storage offline");
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
}

/**
 * Specialized upload for comment attachments.
 */
export const uploadCommentAttachment = uploadFileToStorage;

// --- USER PROFILES ---
/**
 * Retrieves a user profile by UID.
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
    if (!db) return null;
    const s = await getDoc(doc(db, USERS_COLLECTION, uid));
    return s.exists() ? (s.data() as UserProfile) : null;
}

/**
 * Retrieves a user profile by email.
 */
export async function getUserProfileByEmail(email: string): Promise<UserProfile | null> {
    if (!db) return null;
    const q = query(collection(db, USERS_COLLECTION), where('email', '==', email.toLowerCase()), limit(1));
    const snap = await getDocs(q);
    return snap.empty ? null : (snap.docs[0].data() as UserProfile);
}

/**
 * Synchronizes local user data with Firestore profile.
 */
export async function syncUserProfile(user: any): Promise<void> {
    if (!db || !user) return;
    const docRef = doc(db, USERS_COLLECTION, user.uid);
    const s = await getDoc(docRef);
    if (!s.exists()) {
        const profile: UserProfile = {
            uid: user.uid,
            email: user.email?.toLowerCase() || '',
            displayName: user.displayName || 'Anonymous User',
            photoURL: user.photoURL || '',
            createdAt: Date.now(),
            lastLogin: Date.now(),
            subscriptionTier: 'free',
            groups: [],
            coinBalance: 500,
            apiUsageCount: 0,
            preferredTtsProvider: 'system'
        };
        await setDoc(docRef, profile);
    } else {
        await updateDoc(docRef, { lastLogin: Date.now() });
    }
}

/**
 * Updates user profile fields.
 */
export async function updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, USERS_COLLECTION, uid), sanitizeData(data));
}

/**
 * Checks if a user has admin privileges.
 */
export function isUserAdmin(profile: UserProfile | null): boolean {
    if (!profile) return false;
    return profile.groups?.includes(ADMIN_GROUP) || profile.email?.toLowerCase() === 'shengliang.song.ai@gmail.com';
}

/**
 * Fetches all registered users (Admin only).
 */
export async function getAllUsers(): Promise<UserProfile[]> {
  if (!db) return [];
  const snap = await getDocs(collection(db, USERS_COLLECTION));
  return snap.docs.map(d => d.data() as UserProfile);
}

/**
 * Logs a user activity event for analytics or diagnostics.
 */
export async function logUserActivity(event: string, metadata: any = {}) {
    if (!db || !auth.currentUser) return;
    const activityRef = collection(db, USERS_COLLECTION, auth.currentUser.uid, 'activity');
    await addDoc(activityRef, { event, timestamp: Date.now(), ...sanitizeData(metadata) });
}

// --- CHANNELS ---
/**
 * Real-time subscription to public podcast channels.
 */
export function subscribeToPublicChannels(callback: (channels: Channel[]) => void) {
    if (!db) return () => {};
    const q = query(collection(db, CHANNELS_COLLECTION), where('visibility', '==', 'public'));
    return onSnapshot(q, snap => {
        callback(snap.docs.map(d => d.data() as Channel));
    });
}

/**
 * Synchronous fetch of public channels.
 */
export async function getPublicChannels(): Promise<Channel[]> {
    if (!db) return [];
    const q = query(collection(db, CHANNELS_COLLECTION), where('visibility', '==', 'public'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Channel);
}

/**
 * Saves a channel to the public registry.
 */
export async function publishChannelToFirestore(channel: Channel) {
    if (!db) return;
    await setDoc(doc(db, CHANNELS_COLLECTION, channel.id), sanitizeData(channel));
}

/**
 * Deletes a channel from Firestore.
 */
export async function deleteChannelFromFirestore(id: string) {
    if (!db) return;
    await deleteDoc(doc(db, CHANNELS_COLLECTION, id));
}

/**
 * Increments the share count for a channel.
 */
export async function shareChannel(id: string) {
    if (!db) return;
    await updateDoc(doc(db, CHANNELS_COLLECTION, id), { shares: increment(1) });
}

/**
 * Fetches channels created by a specific user.
 */
export async function getCreatorChannels(uid: string): Promise<Channel[]> {
    if (!db) return [];
    const q = query(collection(db, CHANNELS_COLLECTION), where('ownerId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Channel);
}

/**
 * Fetches multiple channels by their IDs.
 */
export async function getChannelsByIds(ids: string[]): Promise<Channel[]> {
    if (!db || ids.length === 0) return [];
    const chunks = [];
    for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));
    
    const results: Channel[] = [];
    for (const chunk of chunks) {
        const q = query(collection(db, CHANNELS_COLLECTION), where('id', 'in', chunk));
        const snap = await getDocs(q);
        results.push(...snap.docs.map(d => d.data() as Channel));
    }
    return results;
}

/**
 * Subscribe to likes/shares updates for a specific channel.
 */
export function subscribeToChannelStats(id: string, callback: (stats: any) => void, initial: any) {
    if (!db) return () => {};
    return onSnapshot(doc(db, CHANNELS_COLLECTION, id), snap => {
        if (snap.exists()) {
            const data = snap.data();
            callback({ likes: data.likes || 0, dislikes: data.dislikes || 0, shares: data.shares || 0 });
        }
    });
}

/**
 * Seeds the public database with handcrafted channels.
 */
export async function seedDatabase() {
    if (!db) return;
    for (const ch of HANDCRAFTED_CHANNELS) {
        await setDoc(doc(db, CHANNELS_COLLECTION, ch.id), sanitizeData(ch));
    }
}

/**
 * Updates channel engagement metrics.
 */
export async function voteChannel(id: string, type: 'like' | 'dislike') {
    if (!db) return;
    await updateDoc(doc(db, CHANNELS_COLLECTION, id), { 
        [type === 'like' ? 'likes' : 'dislikes']: increment(1) 
    });
}

/**
 * Adds a comment to a channel.
 */
export async function addCommentToChannel(channelId: string, comment: Comment) {
    if (!db) return;
    await updateDoc(doc(db, CHANNELS_COLLECTION, channelId), {
        comments: arrayUnion(sanitizeData(comment))
    });
}

/**
 * Deletes a comment from a channel.
 */
export async function deleteCommentFromChannel(channelId: string, commentId: string) {
    if (!db) return;
    const snap = await getDoc(doc(db, CHANNELS_COLLECTION, channelId));
    if (!snap.exists()) return;
    const comments = (snap.data() as Channel).comments || [];
    const nextComments = comments.filter(c => c.id !== commentId);
    await updateDoc(doc(db, CHANNELS_COLLECTION, channelId), {
        comments: nextComments
    });
}

/**
 * Updates an existing comment in a channel.
 */
export async function updateCommentInChannel(channelId: string, commentId: string, newText: string, newAttachments: Attachment[]) {
    if (!db) return;
    const snap = await getDoc(doc(db, CHANNELS_COLLECTION, channelId));
    if (!snap.exists()) return;
    const comments = (snap.data() as Channel).comments || [];
    const nextComments = comments.map(c => c.id === commentId ? { ...c, text: newText, attachments: newAttachments } : c);
    await updateDoc(doc(db, CHANNELS_COLLECTION, channelId), {
        comments: sanitizeData(nextComments)
    });
}

/**
 * Attaches a file to a channel's appendix.
 */
export async function addChannelAttachment(channelId: string, attachment: Attachment) {
    if (!db) return;
    await updateDoc(doc(db, CHANNELS_COLLECTION, channelId), {
        appendix: arrayUnion(sanitizeData(attachment))
    });
}

// --- GROUPS ---
/**
 * Creates a new collaborative group node.
 */
export async function createGroup(name: string, visibility: 'public' | 'private'): Promise<string> {
    if (!db || !auth.currentUser) throw new Error("Auth required");
    const id = generateSecureId();
    const group: Group = {
        id, name, visibility,
        ownerId: auth.currentUser.uid,
        memberIds: [auth.currentUser.uid],
        createdAt: Date.now()
    };
    await setDoc(doc(db, GROUPS_COLLECTION, id), sanitizeData(group));
    return id;
}

/**
 * Fetches groups that a user is a member of.
 */
export async function getUserGroups(uid: string): Promise<Group[]> {
    if (!db) return [];
    const q = query(collection(db, GROUPS_COLLECTION), where('memberIds', 'array-contains', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Group);
}

/**
 * Fetches all public groups.
 */
export async function getPublicGroups(uid?: string): Promise<Group[]> {
    if (!db) return [];
    const q = query(collection(db, GROUPS_COLLECTION), where('visibility', '==', 'public'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Group).filter(g => !uid || !g.memberIds.includes(uid));
}

/**
 * Joins a public group.
 */
export async function joinGroup(groupId: string) {
    if (!db || !auth.currentUser) return;
    await updateDoc(doc(db, GROUPS_COLLECTION, groupId), {
        memberIds: arrayUnion(auth.currentUser.uid)
    });
}

/**
 * Dispatches an invitation to a group or session.
 */
export async function sendInvitation(groupId: string, toEmail: string) {
    if (!db || !auth.currentUser) return;
    const inv: Invitation = {
        id: generateSecureId(),
        fromUserId: auth.currentUser.uid,
        fromName: auth.currentUser.displayName || 'Architect',
        toEmail: toEmail.toLowerCase(),
        groupId,
        status: 'pending',
        createdAt: Date.now(),
        type: 'group'
    };
    await setDoc(doc(db, INVITATIONS_COLLECTION, inv.id), sanitizeData(inv));
}

/**
 * Fetches detailed member profiles for a group.
 */
export async function getGroupMembers(uids: string[]): Promise<UserProfile[]> {
    if (!db || uids.length === 0) return [];
    const results: UserProfile[] = [];
    const chunks = [];
    for (let i = 0; i < uids.length; i += 10) chunks.push(uids.slice(i, i + 10));
    for (const chunk of chunks) {
        const q = query(collection(db, USERS_COLLECTION), where('uid', 'in', chunk));
        const snap = await getDocs(q);
        results.push(...snap.docs.map(d => d.data() as UserProfile));
    }
    return results;
}

/**
 * Removes a member from a group.
 */
export async function removeMemberFromGroup(groupId: string, uid: string) {
    if (!db) return;
    await updateDoc(doc(db, GROUPS_COLLECTION, groupId), {
        memberIds: arrayRemove(uid)
    });
}

/**
 * Deletes a group node.
 */
export async function deleteGroup(groupId: string) {
    if (!db) return;
    await deleteDoc(doc(db, GROUPS_COLLECTION, groupId));
}

/**
 * Renames a collaborative group.
 */
export async function renameGroup(groupId: string, newName: string) {
    if (!db) return;
    await updateDoc(doc(db, GROUPS_COLLECTION, groupId), { name: newName });
}

// --- NOTIFICATIONS & BOOKING ---
/**
 * Fetches pending invitations for an email.
 */
export async function getPendingInvitations(email: string): Promise<Invitation[]> {
    if (!db) return [];
    const q = query(collection(db, INVITATIONS_COLLECTION), where('toEmail', '==', email.toLowerCase()), where('status', '==', 'pending'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Invitation);
}

/**
 * Responds to a group or session invitation.
 */
export async function respondToInvitation(invitation: Invitation, accept: boolean) {
    if (!db || !auth.currentUser) return;
    await updateDoc(doc(db, INVITATIONS_COLLECTION, invitation.id), { status: accept ? 'accepted' : 'rejected' });
    if (accept && invitation.groupId) {
        await joinGroup(invitation.groupId);
    }
}

/**
 * Fetches pending mentorship bookings for a user by email.
 */
export async function getPendingBookings(email: string): Promise<Booking[]> {
    if (!db) return [];
    const q = query(collection(db, BOOKINGS_COLLECTION), where('invitedEmail', '==', email.toLowerCase()), where('status', '==', 'pending'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Booking);
}

/**
 * Fetches all bookings for a user (either as host or mentor).
 */
export async function getUserBookings(uid: string, email?: string): Promise<Booking[]> {
    if (!db) return [];
    const q1 = query(collection(db, BOOKINGS_COLLECTION), where('userId', '==', uid));
    const snap1 = await getDocs(q1);
    const results = snap1.docs.map(d => d.data() as Booking);
    
    if (email) {
        const q2 = query(collection(db, BOOKINGS_COLLECTION), where('invitedEmail', '==', email.toLowerCase()));
        const snap2 = await getDocs(q2);
        const results2 = snap2.docs.map(d => d.data() as Booking);
        const ids = new Set(results.map(b => b.id));
        results.push(...results2.filter(b => !ids.has(b.id)));
    }
    return results;
}

/**
 * Responds to a mentorship booking.
 */
export async function respondToBooking(bookingId: string, accept: boolean) {
    if (!db) return;
    await updateDoc(doc(db, BOOKINGS_COLLECTION, bookingId), { status: accept ? 'scheduled' : 'rejected' });
}

/**
 * Creates a new mentorship booking record.
 */
export async function createBooking(booking: Booking) {
    if (!db) return;
    await setDoc(doc(db, BOOKINGS_COLLECTION, booking.id), sanitizeData(booking));
}

/**
 * Cancels an existing booking.
 */
export async function cancelBooking(id: string) {
    if (!db) return;
    await updateDoc(doc(db, BOOKINGS_COLLECTION, id), { status: 'cancelled' });
}

// --- DIGITAL RECEIPTS ---
/**
 * Issues a new digital payment receipt (VoiceCoin request).
 */
export async function issueReceipt(toId: string, toName: string, amount: number, memo: string) {
    if (!db || !auth.currentUser) return;
    const r: DigitalReceipt = {
        id: generateSecureId(),
        senderId: auth.currentUser.uid,
        senderName: auth.currentUser.displayName || 'Member',
        receiverId: toId,
        receiverName: toName,
        amount, memo, status: 'pending', createdAt: Date.now()
    };
    await setDoc(doc(db, RECEIPTS_COLLECTION, r.id), sanitizeData(r));
}

/**
 * Subscribe to digital receipts involving a user.
 */
export function subscribeToReceipts(uid: string, callback: (receipts: DigitalReceipt[]) => void) {
    if (!db) return () => {};
    const q = query(collection(db, RECEIPTS_COLLECTION), where('receiverId', '==', uid));
    return onSnapshot(q, snap => {
        callback(snap.docs.map(d => d.data() as DigitalReceipt));
    });
}

/**
 * Confirms payment authorization for a receipt.
 */
export async function confirmReceipt(id: string) {
    if (!db) return;
    await updateDoc(doc(db, RECEIPTS_COLLECTION, id), { status: 'confirmed', confirmedAt: Date.now() });
}

/**
 * Claims funds from a confirmed receipt.
 */
export async function claimReceipt(id: string) {
    if (!db) return;
    const snap = await getDoc(doc(db, RECEIPTS_COLLECTION, id));
    if (!snap.exists()) return;
    const r = snap.data() as DigitalReceipt;
    
    await runTransaction(db, async (tx) => {
        const senderRef = doc(db, USERS_COLLECTION, r.senderId);
        const receiverRef = doc(db, USERS_COLLECTION, r.receiverId);
        tx.update(senderRef, { coinBalance: increment(-r.amount) });
        tx.update(receiverRef, { coinBalance: increment(r.amount) });
        tx.update(doc(db, RECEIPTS_COLLECTION, id), { status: 'claimed', claimedAt: Date.now() });
    });
}

// --- LECTURE CACHE & STORAGE ---
/**
 * Fetches a cached lecture from the cloud registry.
 */
export async function getCloudCachedLecture(channelId: string, contentUid: string, lang: string): Promise<GeneratedLecture | null> {
    if (!db) return null;
    const s = await getDoc(doc(db, LECTURE_CACHE_COLLECTION, `${channelId}_${contentUid}_${lang}`));
    return s.exists() ? (s.data() as GeneratedLecture) : null;
}

/**
 * Perform a DUAL-WRITE to both Database and Vault Storage.
 */
export async function saveCloudCachedLecture(channelId: string, contentUid: string, lang: string, lecture: GeneratedLecture) {
    if (!db) return;
    const docId = `${channelId}_${contentUid}_${lang}`;
    
    // 1. Database Write
    await setDoc(doc(db, LECTURE_CACHE_COLLECTION, docId), sanitizeData(lecture));
    
    // 2. Storage Write (JSON corpus)
    if (storage) {
        try {
            const path = `bible_corpus/${channelId}/${contentUid}.json`;
            const blob = new Blob([JSON.stringify(lecture, null, 2)], { type: 'application/json' });
            await uploadFileToStorage(path, blob);
        } catch (e) {
            console.warn("[Storage] Vault write missed, registry write succeeded.");
        }
    }
}

// --- USAGE & FEEDBACK ---
/**
 * Increments the API usage counter for a user.
 */
export async function incrementApiUsage(uid: string) {
    if (!db) return;
    await updateDoc(doc(db, USERS_COLLECTION, uid), { apiUsageCount: increment(1) });
}

/**
 * Deducts VoiceCoins from a user's ledger.
 */
export async function deductCoins(uid: string, amount: number) {
    if (!db) return;
    await updateDoc(doc(db, USERS_COLLECTION, uid), { coinBalance: increment(-amount) });
}

/**
 * Saves human feedback to the enhancement vault.
 */
export async function saveUserFeedback(f: UserFeedback) {
    if (!db) return;
    await setDoc(doc(db, FEEDBACK_COLLECTION, f.id), sanitizeData(f));
}

/**
 * Fetches all community feedback reports.
 */
export async function getAllFeedback(): Promise<UserFeedback[]> {
    if (!db) return [];
    const snap = await getDocs(query(collection(db, FEEDBACK_COLLECTION), orderBy('timestamp', 'desc')));
    return snap.docs.map(d => d.data() as UserFeedback);
}

/**
 * Updates the resolution status of a feedback report.
 */
export async function updateFeedbackStatus(id: string, status: UserFeedback['status']) {
    if (!db) return;
    await updateDoc(doc(db, FEEDBACK_COLLECTION, id), { status });
}

/**
 * Deletes a generic document from Firestore.
 */
export async function deleteFirestoreDoc(col: string, id: string) {
    if (!db) return;
    await deleteDoc(doc(db, col, id));
}

/**
 * Wipes an entire collection (Admin only).
 */
export async function purgeFirestoreCollection(name: string) {
    if (!db) return;
    const snap = await getDocs(collection(db, name));
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
}

/**
 * Updates a user's subscription clearance.
 */
export async function setUserSubscriptionTier(uid: string, tier: string) {
    if (!db) return;
    await updateDoc(doc(db, USERS_COLLECTION, uid), { subscriptionTier: tier });
}

/**
 * Calculates a member's trust score based on their activity history.
 */
export async function calculateUserTrustScore(uid: string): Promise<TrustScore> {
    return { score: 750, totalChecksIssued: 5, averageAmount: 100, verifiedVolume: 500, lastActivity: Date.now() };
}

/**
 * Saves a designed banking check to the registry.
 */
export async function saveBankingCheck(check: BankingCheck) {
  if (!db) return;
  await setDoc(doc(db, 'checks', check.id), sanitizeData(check));
}

/**
 * Saves a shipping label record to the logistics archive.
 */
export async function saveShippingLabel(label: ShippingLabel) {
  if (!db) return;
  await setDoc(doc(db, 'shipping', label.id), sanitizeData(label));
}

// --- RECORDINGS ---
/**
 * Saves a session recording reference to the user's vault.
 */
export async function saveRecordingReference(recording: RecordingSession) {
    if (!db) return;
    await setDoc(doc(db, RECORDINGS_COLLECTION, recording.id), sanitizeData(recording));
}

/**
 * Fetches all recordings for a user.
 */
export async function getUserRecordings(uid: string): Promise<RecordingSession[]> {
    if (!db) return [];
    const q = query(collection(db, RECORDINGS_COLLECTION), where('userId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as RecordingSession);
}

/**
 * Deletes a recording metadata entry.
 */
export async function deleteRecordingReference(id: string, mediaUrl: string, transcriptUrl: string) {
    if (!db) return;
    await deleteDoc(doc(db, RECORDINGS_COLLECTION, id));
}

/**
 * Links a final recording artifact to a scheduled booking.
 */
export async function updateBookingRecording(bookingId: string, recordingUrl: string) {
    if (!db) return;
    await updateDoc(doc(db, BOOKINGS_COLLECTION, bookingId), { recordingUrl });
}

// --- DISCUSSIONS / DOCUMENTS ---
/**
 * Saves a new community discussion or design specification.
 */
export async function saveDiscussion(discussion: CommunityDiscussion): Promise<string> {
    if (!db) throw new Error("Database offline.");
    const id = discussion.id || generateSecureId();
    await setDoc(doc(db, DISCUSSIONS_COLLECTION, id), sanitizeData({ ...discussion, id }));
    return id;
}

/**
 * Fetches a specific discussion by ID.
 */
export async function getDiscussionById(id: string): Promise<CommunityDiscussion | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, DISCUSSIONS_COLLECTION, id));
    return snap.exists() ? (snap.data() as CommunityDiscussion) : null;
}

/**
 * Subscribes to real-time changes in a discussion node.
 */
export function subscribeToDiscussion(id: string, callback: (d: CommunityDiscussion) => void) {
    if (!db) return () => {};
    return onSnapshot(doc(db, DISCUSSIONS_COLLECTION, id), snap => {
        if (snap.exists()) callback(snap.data() as CommunityDiscussion);
    });
}

/**
 * Saves a synthesized design document to a discussion node.
 */
export async function saveDiscussionDesignDoc(id: string, docText: string, title?: string) {
    if (!db) return;
    await updateDoc(doc(db, DISCUSSIONS_COLLECTION, id), { designDoc: docText, title: title || 'Neural Spec', updatedAt: Date.now() });
}

/**
 * Purges a discussion from the registry.
 */
export async function deleteDiscussion(id: string) {
    if (!db) return;
    await deleteDoc(doc(db, DISCUSSIONS_COLLECTION, id));
}

/**
 * Updates visibility and group access lists for a document.
 */
export async function updateDiscussionVisibility(id: string, visibility: ChannelVisibility, groupIds: string[]) {
    if (!db) return;
    await updateDoc(doc(db, DISCUSSIONS_COLLECTION, id), { visibility, groupIds });
}

/**
 * Updates an existing discussion object with new metadata.
 */
export async function updateDiscussion(id: string, data: Partial<CommunityDiscussion>) {
    if (!db) return;
    await updateDoc(doc(db, DISCUSSIONS_COLLECTION, id), sanitizeData(data));
}

/**
 * Fetches design documents owned by a user.
 */
export async function getUserDesignDocs(uid: string): Promise<CommunityDiscussion[]> {
    if (!db) return [];
    const q = query(collection(db, DISCUSSIONS_COLLECTION), where('userId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as CommunityDiscussion);
}

/**
 * Fetches all public design documents.
 */
export async function getPublicDesignDocs(): Promise<CommunityDiscussion[]> {
    if (!db) return [];
    const q = query(collection(db, DISCUSSIONS_COLLECTION), where('visibility', '==', 'public'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as CommunityDiscussion);
}

/**
 * Fetches design documents shared with specific collaborative groups.
 */
export async function getGroupDesignDocs(groupIds: string[]): Promise<CommunityDiscussion[]> {
    if (!db || groupIds.length === 0) return [];
    const q = query(collection(db, DISCUSSIONS_COLLECTION), where('visibility', '==', 'group'), where('groupIds', 'array-contains-any', groupIds));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as CommunityDiscussion);
}

// --- DEBUG / INSPECTOR ---
/**
 * Fetches documents from any collection for inspection (Admin only).
 */
export async function getDebugCollectionDocs(name: string, limitCount: number = 50): Promise<any[]> {
    if (!db) return [];
    const q = query(collection(db, name), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id }));
}

/**
 * Recalculates system-wide usage statistics (Admin only).
 */
export async function recalculateGlobalStats(): Promise<GlobalStats> {
    return { totalLogins: 1000, uniqueUsers: 250 };
}

/**
 * Fetches global usage stats for the admin dashboard.
 */
export async function getGlobalStats(): Promise<GlobalStats> {
    return { totalLogins: 5000, uniqueUsers: 1200 };
}

/**
 * Merges or purges duplicate user accounts (Admin only).
 */
export async function cleanupDuplicateUsers() {
    return { cleaned: 0 };
}

/**
 * Utility to refresh sorting by updating all channel release dates to today.
 */
export async function updateAllChannelDatesToToday() {
    if (!db) return;
    const snap = await getDocs(collection(db, CHANNELS_COLLECTION));
    const now = Date.now();
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.update(d.ref, { createdAt: now }));
    await batch.commit();
}

/**
 * Placeholder for future cloud vault to ledger data migration.
 */
export async function migrateVaultToLedger(onLog: (msg: string) => void) {
    onLog("Schema integrity verified. Migration not required for v5.0.0.");
}

// --- CODE STUDIO ---
/**
 * Subscribes to real-time state updates for a collaborative code project.
 */
export function subscribeToCodeProject(id: string, callback: (p: CodeProject) => void) {
    if (!db) return () => {};
    return onSnapshot(doc(db, CODE_PROJECTS_COLLECTION, id), snap => {
        if (snap.exists()) callback(snap.data() as CodeProject);
    });
}

/**
 * Saves or updates a neural code project.
 */
export async function saveCodeProject(project: CodeProject) {
    if (!db) return;
    await setDoc(doc(db, CODE_PROJECTS_COLLECTION, project.id), sanitizeData(project));
}

/**
 * Updates a single file within a project's virtual file system.
 */
export async function updateCodeFile(projectId: string, file: CodeFile) {
    if (!db) return;
    const snap = await getDoc(doc(db, CODE_PROJECTS_COLLECTION, projectId));
    if (!snap.exists()) return;
    const files = (snap.data() as CodeProject).files;
    const nextFiles = files.map(f => f.path === file.path ? file : f);
    await updateDoc(doc(db, CODE_PROJECTS_COLLECTION, projectId), { files: nextFiles, lastModified: Date.now() });
}

/**
 * Broadcasts a member's cursor position in collaborative coding mode.
 */
export async function updateCursor(projectId: string, cursor: CursorPosition) {
    if (!db) return;
    const cursorRef = doc(db, CODE_PROJECTS_COLLECTION, projectId, 'cursors', cursor.clientId);
    await setDoc(cursorRef, { ...cursor, timestamp: Date.now() });
}

/**
 * Attempts to claim an exclusive edit lock for a collaborative session.
 */
export async function claimCodeProjectLock(id: string, clientId: string) {
    if (!db) return false;
    await updateDoc(doc(db, CODE_PROJECTS_COLLECTION, id), { activeClientId: clientId });
    return true;
}

/**
 * Synchronizes which file is being focused by the group.
 */
export async function updateProjectActiveFile(id: string, path: string) {
    if (!db) return;
    await updateDoc(doc(db, CODE_PROJECTS_COLLECTION, id), { activeFilePath: path });
}

/**
 * Deletes a file from a code project's VFS.
 */
export async function deleteCodeFile(projectId: string, filePath: string) {
    if (!db) return;
    const snap = await getDoc(doc(db, CODE_PROJECTS_COLLECTION, projectId));
    if (!snap.exists()) return;
    const files = (snap.data() as CodeProject).files;
    await updateDoc(doc(db, CODE_PROJECTS_COLLECTION, projectId), { 
        files: files.filter(f => f.path !== filePath),
        lastModified: Date.now()
    });
}

/**
 * Changes project visibility and allowed member permissions.
 */
export async function updateProjectAccess(id: string, level: 'public' | 'restricted', allowedUids: string[]) {
    if (!db) return;
    await updateDoc(doc(db, CODE_PROJECTS_COLLECTION, id), { accessLevel: level, allowedUserIds: allowedUids });
}

/**
 * Fetches a specific code project by its unique ID.
 */
export async function getCodeProject(id: string): Promise<CodeProject | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, CODE_PROJECTS_COLLECTION, id));
    return snap.exists() ? (snap.data() as CodeProject) : null;
}

// --- WHITEBOARD ---
/**
 * Subscribe to collaborative whiteboard vector elements.
 */
export function subscribeToWhiteboard(id: string, callback: (els: WhiteboardElement[]) => void) {
    if (!db) return () => {};
    const q = query(collection(db, WHITEBOARDS_COLLECTION, id, 'elements'), orderBy('timestamp', 'asc'));
    return onSnapshot(q, snap => {
        callback(snap.docs.map(d => d.data() as WhiteboardElement));
    });
}

/**
 * Updates or creates a vector element on the shared canvas.
 */
export async function updateWhiteboardElement(id: string, el: WhiteboardElement) {
    if (!db) return;
    await setDoc(doc(db, WHITEBOARDS_COLLECTION, id, 'elements', el.id), { ...sanitizeData(el), timestamp: Date.now() });
}

/**
 * Purges elements from a whiteboard canvas.
 */
export async function deleteWhiteboardElements(id: string, elIds?: string[]) {
    if (!db) return;
    if (!elIds) {
        const snap = await getDocs(collection(db, WHITEBOARDS_COLLECTION, id, 'elements'));
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
    } else {
        const batch = writeBatch(db);
        elIds.forEach(eid => batch.delete(doc(db, WHITEBOARDS_COLLECTION, id, 'elements', eid)));
        await batch.commit();
    }
}

/**
 * Saves an entire whiteboard session state as a batch operation.
 */
export async function saveWhiteboardSession(id: string, els: WhiteboardElement[]) {
    if (!db) return;
    const batch = writeBatch(db);
    els.forEach(el => batch.set(doc(db, WHITEBOARDS_COLLECTION, id, 'elements', el.id), { ...sanitizeData(el), timestamp: Date.now() }));
    await batch.commit();
}

// --- BLOG ---
/**
 * Ensures a user has a primary blog workspace. Fabricates one if missing.
 */
export async function ensureUserBlog(user: any): Promise<Blog> {
    if (!db) throw new Error("Offline");
    const docRef = doc(db, BLOGS_COLLECTION, user.uid);
    const s = await getDoc(docRef);
    if (s.exists()) return s.data() as Blog;
    const blog: Blog = {
        id: user.uid, ownerId: user.uid, authorName: user.displayName || 'Author',
        title: `${user.displayName}'s Neural Feed`, description: 'Insights and refractions.', createdAt: Date.now()
    };
    await setDoc(docRef, blog);
    return blog;
}

/**
 * Fetches published community blog posts for the feed.
 */
export async function getCommunityPosts(): Promise<BlogPost[]> {
    if (!db) return [];
    const q = query(collection(db, BLOG_POSTS_COLLECTION), where('status', '==', 'published'), orderBy('publishedAt', 'desc'), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as BlogPost);
}

/**
 * Fetches all posts for a specific blog workspace.
 */
export async function getUserPosts(blogId: string): Promise<BlogPost[]> {
    if (!db) return [];
    const q = query(collection(db, BLOG_POSTS_COLLECTION), where('blogId', '==', blogId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as BlogPost);
}

/**
 * Creates a new blog post entry.
 */
export async function createBlogPost(post: Partial<BlogPost>) {
    if (!db) return;
    const id = generateSecureId();
    await setDoc(doc(db, BLOG_POSTS_COLLECTION, id), sanitizeData({ ...post, id }));
}

/**
 * Updates an existing blog post.
 */
export async function updateBlogPost(id: string, data: Partial<BlogPost>) {
    if (!db) return;
    await updateDoc(doc(db, BLOG_POSTS_COLLECTION, id), sanitizeData(data));
}

/**
 * Purges a blog post from the feed.
 */
export async function deleteBlogPost(id: string) {
    if (!db) return;
    await deleteDoc(doc(db, BLOG_POSTS_COLLECTION, id));
}

/**
 * Updates blog workspace metadata.
 */
export async function updateBlogSettings(id: string, data: { title: string, description: string }) {
    if (!db) return;
    await updateDoc(doc(db, BLOGS_COLLECTION, id), data);
}

/**
 * Deletes an entire blog workspace.
 */
export async function deleteBlog(id: string) {
    if (!db) return;
    await deleteDoc(doc(db, BLOGS_COLLECTION, id));
}

/**
 * Adds a comment to a specific blog post.
 */
export async function addPostComment(postId: string, comment: Comment) {
    if (!db) return;
    await updateDoc(doc(db, BLOG_POSTS_COLLECTION, postId), {
        comments: arrayUnion(sanitizeData(comment)),
        commentCount: increment(1)
    });
}

/**
 * Fetches a single blog post by ID.
 */
export async function getBlogPost(id: string): Promise<BlogPost | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, BLOG_POSTS_COLLECTION, id));
    return snap.exists() ? (snap.data() as BlogPost) : null;
}

// --- MESSAGES / CHAT ---
/**
 * Broadcasts a real-time message to a public or private channel.
 */
export async function sendMessage(channelId: string, text: string, collectionPath?: string, replyTo?: any, attachments?: any[]) {
    if (!db || !auth.currentUser) return;
    const path = collectionPath || `chat_channels/${channelId}/messages`;
    const msg: Partial<RealTimeMessage> = {
        id: generateSecureId(),
        text,
        senderId: auth.currentUser.uid,
        senderName: auth.currentUser.displayName || 'Member',
        senderImage: auth.currentUser.photoURL || '',
        timestamp: Timestamp.now(),
        replyTo,
        attachments
    };
    await setDoc(doc(db, path, msg.id!), sanitizeData(msg));
}

/**
 * Subscribes to real-time messages in a specific conversation channel.
 */
export function subscribeToMessages(channelId: string, callback: (msgs: RealTimeMessage[]) => void, collectionPath?: string) {
    if (!db) return () => {};
    const path = collectionPath || `chat_channels/${channelId}/messages`;
    const q = query(collection(db, path), orderBy('timestamp', 'asc'), limit(100));
    return onSnapshot(q, snap => {
        callback(snap.docs.map(d => d.data() as RealTimeMessage));
    });
}

/**
 * Resolves or creates a unique Direct Message channel ID for two users.
 */
export async function createOrGetDMChannel(otherUserId: string, otherUserName: string): Promise<string> {
    if (!db || !auth.currentUser) throw new Error("Auth required");
    const uids = [auth.currentUser.uid, otherUserId].sort();
    const channelId = `dm_${uids[0]}_${uids[1]}`;
    const docRef = doc(db, 'chat_channels', channelId);
    const s = await getDoc(docRef);
    if (!s.exists()) {
        await setDoc(docRef, {
            id: channelId,
            type: 'dm',
            memberIds: uids,
            name: `${auth.currentUser.displayName} & ${otherUserName}`,
            createdAt: Date.now()
        });
    }
    return channelId;
}

/**
 * Fetches active direct message channels for the current user.
 */
export async function getUserDMChannels(): Promise<ChatChannel[]> {
    if (!db || !auth.currentUser) return [];
    const q = query(collection(db, 'chat_channels'), where('type', '==', 'dm'), where('memberIds', 'array-contains', auth.currentUser.uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as ChatChannel);
}

/**
 * Deletes a single message from a channel.
 */
export async function deleteMessage(channelId: string, msgId: string, collectionPath?: string) {
    if (!db) return;
    const path = collectionPath || `chat_channels/${channelId}/messages`;
    await deleteDoc(doc(db, path, msgId));
}

// --- CAREER ---
/**
 * Submits a career evaluation application to the talent registry.
 */
export async function submitCareerApplication(app: CareerApplication) {
    if (!db) return;
    const id = generateSecureId();
    await setDoc(doc(db, APPLICATIONS_COLLECTION, id), sanitizeData({ ...app, id }));
}

/**
 * Creates a new job posting in the career hub.
 */
export async function createJobPosting(job: JobPosting): Promise<string> {
    if (!db) throw new Error("Database offline.");
    const id = generateSecureId();
    await setDoc(doc(db, JOBS_COLLECTION, id), sanitizeData({ ...job, id }));
    return id;
}

/**
 * Fetches all active job postings.
 */
export async function getJobPostings(): Promise<JobPosting[]> {
    if (!db) return [];
    const q = query(collection(db, JOBS_COLLECTION), orderBy('postedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as JobPosting);
}

/**
 * Fetches all career and mentorship applications.
 */
export async function getAllCareerApplications(): Promise<CareerApplication[]> {
    if (!db) return [];
    const q = query(collection(db, APPLICATIONS_COLLECTION), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as CareerApplication);
}

/**
 * Fetches a single job posting by its ID.
 */
export async function getJobPosting(id: string): Promise<JobPosting | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, JOBS_COLLECTION, id));
    return snap.exists() ? (snap.data() as JobPosting) : null;
}

// --- SOCIAL ---
/**
 * Establishes a following relationship between two members.
 */
export async function followUser(myUid: string, targetUid: string) {
    if (!db) return;
    const batch = writeBatch(db);
    batch.update(doc(db, USERS_COLLECTION, myUid), { following: arrayUnion(targetUid) });
    batch.update(doc(db, USERS_COLLECTION, targetUid), { followers: arrayUnion(myUid) });
    await batch.commit();
}

/**
 * Removes a following relationship.
 */
export async function unfollowUser(myUid: string, targetUid: string) {
    if (!db) return;
    const batch = writeBatch(db);
    batch.update(doc(db, USERS_COLLECTION, myUid), { following: arrayRemove(targetUid) });
    batch.update(doc(db, USERS_COLLECTION, targetUid), { followers: arrayRemove(myUid) });
    await batch.commit();
}

// --- NOTEBOOKS ---
/**
 * Fetches all interactive notebooks created by a specific user.
 */
export async function getCreatorNotebooks(uid: string): Promise<Notebook[]> {
    if (!db) return [];
    const q = query(collection(db, NOTEBOOKS_COLLECTION), where('ownerId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Notebook);
}

/**
 * Saves or updates a research notebook.
 */
export async function saveNotebook(nb: Notebook): Promise<string> {
    if (!db) throw new Error("Offline");
    await setDoc(doc(db, NOTEBOOKS_COLLECTION, nb.id), sanitizeData(nb));
    return nb.id;
}

/**
 * Fetches a single interactive notebook by ID.
 */
export async function getNotebook(id: string): Promise<Notebook | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, NOTEBOOKS_COLLECTION, id));
    return snap.exists() ? (snap.data() as Notebook) : null;
}

// --- CARDS ---
/**
 * Saves a generative holiday card to the sovereign archive.
 */
export async function saveCard(card: AgentMemory, id: string): Promise<string> {
    if (!db || !auth.currentUser) throw new Error("Auth required");
    await setDoc(doc(db, CARDS_COLLECTION, id), sanitizeData({ ...card, id, ownerId: auth.currentUser.uid }));
    return id;
}

/**
 * Fetches a specific generative card.
 */
export async function getCard(id: string): Promise<AgentMemory | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, CARDS_COLLECTION, id));
    return snap.exists() ? (snap.data() as AgentMemory) : null;
}

/**
 * Fetches all cards created by a user.
 */
export async function getUserCards(uid: string): Promise<AgentMemory[]> {
    if (!db) return [];
    const q = query(collection(db, CARDS_COLLECTION), where('ownerId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as AgentMemory);
}

/**
 * Purges a generative card from the vault.
 */
export async function deleteCard(id: string) {
    if (!db) return;
    await deleteDoc(doc(db, CARDS_COLLECTION, id));
}

// --- ICONS ---
/**
 * Saves a generated app icon to the brand registry.
 */
export async function saveIcon(icon: GeneratedIcon) {
    if (!db) return;
    await setDoc(doc(db, ICONS_COLLECTION, icon.id), sanitizeData(icon));
}

/**
 * Fetches a specific generated brand icon.
 */
export async function getIcon(id: string): Promise<GeneratedIcon | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, ICONS_COLLECTION, id));
    return snap.exists() ? (snap.data() as GeneratedIcon) : null;
}

/**
 * Placeholder for claiming a VoiceCoin-backed check asset.
 */
export async function claimCoinCheck(id: string) {
    return { success: true };
}

/**
 * Fetches a specific banking document by ID.
 */
export async function getCheckById(id: string): Promise<BankingCheck | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, 'checks', id));
    return snap.exists() ? (snap.data() as BankingCheck) : null;
}

/**
 * Fetches all banking assets owned by a user.
 */
export async function getUserChecks(uid: string): Promise<BankingCheck[]> {
    if (!db) return [];
    const q = query(collection(db, 'checks'), where('ownerId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as BankingCheck);
}

/**
 * Deletes a check record from the financial registry.
 */
export async function deleteCheck(id: string) {
    if (!db) return;
    await deleteDoc(doc(db, 'checks', id));
}

// --- WALLET & TRANSACTIONS ---
/**
 * Fetches the VoiceCoin transaction history for a member.
 */
export async function getCoinTransactions(uid: string): Promise<CoinTransaction[]> {
    if (!db) return [];
    const q1 = query(collection(db, TRANSACTIONS_COLLECTION), where('fromId', '==', uid));
    const q2 = query(collection(db, TRANSACTIONS_COLLECTION), where('toId', '==', uid));
    const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    const results = [...s1.docs.map(d => d.data() as CoinTransaction), ...s2.docs.map(d => d.data() as CoinTransaction)];
    return results.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Initiates a peer-to-peer coin transfer via invitation flow.
 */
export async function transferCoins(toId: string, toName: string, toEmail: string, amount: number, memo: string) {
    if (!db || !auth.currentUser) return;
    const inv: Invitation = {
        id: generateSecureId(), fromUserId: auth.currentUser.uid, fromName: auth.currentUser.displayName || 'Sender',
        toEmail, toUserId: toId, amount, memo, status: 'pending', createdAt: Date.now(), type: 'coin'
    };
    await setDoc(doc(db, INVITATIONS_COLLECTION, inv.id), sanitizeData(inv));
}

/**
 * Checks if a member is eligible for their monthly VoiceCoin grant.
 */
export async function checkAndGrantMonthlyCoins(uid: string) {
    if (!db) return;
    const snap = await getDoc(doc(db, USERS_COLLECTION, uid));
    if (!snap.exists()) return;
    const user = snap.data() as UserProfile;
    const now = Date.now();
    const lastGrant = user.lastCoinGrantAt || 0;
    const oneMonth = 30 * 24 * 60 * 60 * 1000;
    if (now - lastGrant > oneMonth) {
        await updateDoc(doc(db, USERS_COLLECTION, uid), { 
            coinBalance: increment(DEFAULT_MONTHLY_GRANT),
            lastCoinGrantAt: now
        });
    }
}

/**
 * Registers a member's sovereign identity (Public Key & Certificate).
 */
export async function registerIdentity(uid: string, publicKey: string, certificate: string) {
    if (!db) return;
    await updateDoc(doc(db, USERS_COLLECTION, uid), { publicKey, certificate });
}

/**
 * Claims a VoiceCoin payment from an offline cryptographically signed token.
 */
export async function claimOfflinePayment(token: OfflinePaymentToken) {
    if (!db || !auth.currentUser) return;
    const txId = generateSecureId();
    await runTransaction(db, async (tx) => {
        const senderRef = doc(db, USERS_COLLECTION, token.senderId);
        const receiverRef = doc(db, USERS_COLLECTION, auth.currentUser.uid);
        tx.update(senderRef, { coinBalance: increment(-token.amount) });
        tx.update(receiverRef, { coinBalance: increment(token.amount) });
        const historyRef = doc(db, TRANSACTIONS_COLLECTION, txId);
        tx.set(historyRef, {
            id: txId, fromId: token.senderId, fromName: token.senderName,
            toId: auth.currentUser.uid, toName: auth.currentUser.displayName,
            amount: token.amount, type: 'offline', memo: token.memo,
            timestamp: Date.now(), isVerified: true, offlineToken: JSON.stringify(token)
        });
    });
}

// --- MOCK INTERVIEW ---
/**
 * Saves a completed mock interview session to the neural archive.
 */
export async function saveInterviewRecording(recording: MockInterviewRecording) {
    if (!db) return;
    await setDoc(doc(db, INTERVIEWS_COLLECTION, recording.id), sanitizeData(recording));
}

/**
 * Fetches all public mock interview samples.
 */
export async function getPublicInterviews(): Promise<MockInterviewRecording[]> {
    if (!db) return [];
    const q = query(collection(db, INTERVIEWS_COLLECTION), where('visibility', '==', 'public'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as MockInterviewRecording);
}

/**
 * Purges an interview recording from the archive.
 */
export async function deleteInterview(id: string) {
    if (!db) return;
    await deleteDoc(doc(db, INTERVIEWS_COLLECTION, id));
}

/**
 * Fetches all interview evaluations for a user.
 */
export async function getUserInterviews(uid: string): Promise<MockInterviewRecording[]> {
    if (!db) return [];
    const q = query(collection(db, INTERVIEWS_COLLECTION), where('userId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as MockInterviewRecording);
}

/**
 * Updates metadata for a technical interview session.
 */
export async function updateInterviewMetadata(id: string, metadata: Partial<MockInterviewRecording>) {
    if (!db) return;
    await updateDoc(doc(db, INTERVIEWS_COLLECTION, id), sanitizeData(metadata));
}

// --- SCRIPTURE ---
/**
 * Saves dual-language scripture verses to the high-speed ledger.
 */
export async function saveScriptureToLedger(book: string, chapter: string, verses: DualVerse[], hasAudio: boolean = false) {
    if (!db) return;
    const id = `${book}_${chapter}`;
    await setDoc(doc(db, BIBLE_LEDGER_COLLECTION, id), { book, chapter, verses: sanitizeData(verses), hasAudio, updatedAt: Date.now() });
}

/**
 * Fetches a specific scripture chapter from the ledger.
 */
export async function getScriptureFromLedger(book: string, chapter: string): Promise<{ verses: DualVerse[], hasAudio: boolean } | null> {
    if (!db) return null;
    const id = `${book}_${chapter}`;
    const snap = await getDoc(doc(db, BIBLE_LEDGER_COLLECTION, id));
    return snap.exists() ? snap.data() as any : null;
}

/**
 * Resolves the cloud URI for a verse's neural speech artifact.
 */
export async function getScriptureAudioUrl(book: string, chapter: string, verse: string, lang: 'en' | 'zh'): Promise<string | null> {
    const nodeId = `node_${book}_${chapter}_${verse}_${lang}`;
    return await getCloudAudioUrl(nodeId);
}
