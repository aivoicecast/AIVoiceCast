
import { 
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, query, where, 
  orderBy, limit, onSnapshot, runTransaction, increment, arrayUnion, arrayRemove, 
  Timestamp, writeBatch, documentId
} from '@firebase/firestore';
import { ref, uploadBytes, getDownloadURL, listAll, getMetadata, deleteObject } from '@firebase/storage';
import { db, auth, storage } from './firebaseConfig';
import { 
  UserProfile, Channel, ChannelStats, Comment, Attachment, Group, ChatChannel, RealTimeMessage, 
  GeneratedLecture, CommunityDiscussion, Booking, Invitation, RecordingSession, CodeProject, 
  CodeFile, CursorPosition, CloudItem, WhiteboardElement, Blog, BlogPost, JobPosting, 
  CareerApplication, Notebook, AgentMemory, GlobalStats, SubscriptionTier, Chapter, 
  TranscriptItem, ChannelVisibility, GeneratedIcon, BankingCheck, ShippingLabel, CoinTransaction, TodoItem, OfflinePaymentToken, MockInterviewRecording, TrustScore
} from '../types';
import { HANDCRAFTED_CHANNELS } from '../utils/initialData';
import { generateSecureId } from '../utils/idUtils';

// Collections
const USERS_COLLECTION = 'users';
const CHANNELS_COLLECTION = 'channels';
const CHANNEL_STATS_COLLECTION = 'channel_stats';
const GROUPS_COLLECTION = 'groups';
const MESSAGES_COLLECTION = 'messages';
const BOOKINGS_COLLECTION = 'bookings';
const RECORDINGS_COLLECTION = 'recordings';
const DISCUSSIONS_COLLECTION = 'discussions';
const BLOGS_COLLECTION = 'blogs';
const POSTS_COLLECTION = 'blog_posts';
const JOBS_COLLECTION = 'job_postings';
const APPLICATIONS_COLLECTION = 'career_applications';
const CODE_PROJECTS_COLLECTION = 'code_projects';
const WHITEBOARDS_COLLECTION = 'whiteboards';
const SAVED_WORDS_COLLECTION = 'saved_words';
const CARDS_COLLECTION = 'cards';
const ICONS_COLLECTION = 'icons';
const CHECKS_COLLECTION = 'checks';
const SHIPPING_COLLECTION = 'shipping';
const TRANSACTIONS_COLLECTION = 'coin_transactions';
const TASKS_COLLECTION = 'tasks';
const NOTEBOOKS_COLLECTION = 'notebooks';
const INVITATIONS_COLLECTION = 'invitations';
const INTERVIEWS_COLLECTION = 'mock_interviews';
const LECTURE_CACHE_COLLECTION = 'lecture_cache';

export const ADMIN_GROUP = 'admin_neural_prism';

/**
 * AI SERVICE COSTS
 */
export const AI_COSTS = {
    TEXT_REFRACTION: 100,
    CURRICULUM_SYNTHESIS: 250,
    AUDIO_SYNTHESIS: 50,
    IMAGE_GENERATION: 500,
    VIDEO_GENERATION: 5000,
    TECHNICAL_EVALUATION: 1000
};

/**
 * Helper to check if a profile belongs to the admin group.
 */
export const isUserAdmin = (profile: UserProfile | null): boolean => {
    if (!profile || !profile.groups || !Array.isArray(profile.groups)) return false;
    return profile.groups.includes(ADMIN_GROUP);
};

/**
 * Atomically deducts coins for an AI action.
 */
export async function deductCoins(uid: string, amount: number): Promise<void> {
    if (!db || !uid) return;
    try {
        const userRef = doc(db, USERS_COLLECTION, uid);
        await updateDoc(userRef, {
            coinBalance: increment(-amount)
        });
    } catch (e) {
        console.error("[Ledger] Deduction failed:", e);
    }
}

/**
 * Persists synthesized scripture to Firebase Storage for high-speed community access.
 */
export async function saveScriptureToVault(book: string, chapter: string, data: any[]): Promise<void> {
    if (!storage) throw new Error("Storage unreachable.");
    const path = `bible_corpus/${book}/${chapter}.json`;
    const storageRef = ref(storage, path);
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    await uploadBytes(storageRef, blob);
}

/**
 * Retrieves a direct download URL for a scripture audio file if it exists.
 */
export async function getScriptureAudioUrl(book: string, chapter: string, verse: string, lang: string): Promise<string | null> {
    if (!storage) return null;
    const path = `bible_audio/${book}/${chapter}/${verse}_${lang}.wav`;
    try {
        const storageRef = ref(storage, path);
        return await getDownloadURL(storageRef);
    } catch (e) {
        return null;
    }
}

/**
 * Uploads generated audio bytes to the community vault.
 */
export async function uploadScriptureAudio(book: string, chapter: string, verse: string, lang: string, audioBlob: Blob): Promise<string> {
    if (!storage) throw new Error("Storage unreachable.");
    const path = `bible_audio/${book}/${chapter}/${verse}_${lang}.wav`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, audioBlob);
    return await getDownloadURL(storageRef);
}

/**
 * Robustly sanitizes data for Firestore, stripping non-serializable fields
 * and preventing circular reference errors.
 */
const sanitizeData = (data: any) => { 
    if (!data) return data;
    const cleaned = JSON.parse(JSON.stringify(data, (key, value) => {
        if (value instanceof HTMLElement || value instanceof MediaStream || value instanceof AudioContext) return undefined;
        return value;
    }));
    return cleaned; 
};

// --- Lecture Caching ---

export async function getCloudCachedLecture(channelId: string, subTopicId: string, lang: string): Promise<GeneratedLecture | null> {
    if (!db) return null;
    // Sanitize subTopicId to prevent path issues if it's complex
    const docId = `${channelId}_${subTopicId}_${lang}`.replace(/\//g, '_');
    const snap = await getDoc(doc(db, LECTURE_CACHE_COLLECTION, docId));
    return snap.exists() ? (snap.data() as GeneratedLecture) : null;
}

export async function saveCloudCachedLecture(channelId: string, subTopicId: string, lang: string, lecture: GeneratedLecture): Promise<void> {
    if (!db) return;
    const docId = `${channelId}_${subTopicId}_${lang}`.replace(/\//g, '_');
    await setDoc(doc(db, LECTURE_CACHE_COLLECTION, docId), sanitizeData({
        ...lecture,
        cachedAt: Date.now()
    }));
}

// --- Admin & Cleanup ---

/**
 * Generic delete for any collection in the Inspector.
 */
export async function deleteFirestoreDoc(collectionName: string, docId: string): Promise<void> {
    if (!db) throw new Error("Database offline.");
    await deleteDoc(doc(db, collectionName, docId));
}

/**
 * Destructive Purge: Deletes documents in batches.
 * Limited to 500 docs per call for safety.
 */
export async function purgeFirestoreCollection(collectionName: string): Promise<number> {
    if (!db) throw new Error("Database offline.");
    
    try {
        const q = query(collection(db, collectionName), limit(500));
        const snap = await getDocs(q);
        
        if (snap.empty) return 0;
        
        const batch = writeBatch(db);
        snap.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
        return snap.size;
    } catch (e) {
        console.error(`[Admin] Purge of ${collectionName} failed:`, e);
        throw e;
    }
}

/**
 * Scans the users collection for multiple documents sharing the same email.
 * Keeps only the one with the latest 'lastLogin'.
 */
export async function cleanupDuplicateUsers(): Promise<number> {
    if (!db) return 0;
    
    try {
        const snap = await getDocs(collection(db, USERS_COLLECTION));
        const users = snap.docs.map(d => ({ ...d.data(), uid: d.id } as UserProfile));
        
        const emailGroups: Record<string, UserProfile[]> = {};
        
        users.forEach(u => {
            if (!u.email) return;
            const email = u.email.toLowerCase().trim();
            if (!emailGroups[email]) emailGroups[email] = [];
            emailGroups[email].push(u);
        });

        let deletedCount = 0;
        const batch = writeBatch(db);

        Object.keys(emailGroups).forEach(email => {
            const group = emailGroups[email];
            if (group.length > 1) {
                // Sort by lastLogin descending to keep the most active one
                group.sort((a, b) => (b.lastLogin || 0) - (a.lastLogin || 0));
                
                // Keep the first one (index 0), delete the rest
                for (let i = 1; i < group.length; i++) {
                    const docRef = doc(db, USERS_COLLECTION, group[i].uid);
                    batch.delete(docRef);
                    deletedCount++;
                }
            }
        });

        if (deletedCount > 0) {
            await batch.commit();
        }
        
        return deletedCount;
    } catch (e) {
        console.error("[Cleanup] Duplicate purge failed:", e);
        throw e;
    }
}

// --- Mock Interviews ---
export async function saveInterviewRecording(recording: MockInterviewRecording): Promise<string> {
    if (!db) return recording.id;
    const id = recording.id || generateSecureId();
    const cleanTranscript = recording.transcript?.map(t => ({ role: t.role, text: t.text, timestamp: t.timestamp })) || [];
    const payload = { ...recording, id, transcript: cleanTranscript, visibility: recording.visibility || 'public' };
    await setDoc(doc(db, INTERVIEWS_COLLECTION, id), sanitizeData(payload));
    return id;
}

export async function updateInterviewMetadata(id: string, data: Partial<MockInterviewRecording>): Promise<void> {
    if (!db || !id) return;
    await updateDoc(doc(db, INTERVIEWS_COLLECTION, id), sanitizeData(data));
}

export async function getPublicInterviews(): Promise<MockInterviewRecording[]> {
    if (!db) return [];
    try {
        const q = query(collection(db, INTERVIEWS_COLLECTION), where('visibility', '==', 'public'), limit(100));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ ...d.data(), id: d.id } as MockInterviewRecording)).sort((a, b) => b.timestamp - a.timestamp);
    } catch (e) {
        console.error("Public interviews fetch error", e);
        return [];
    }
}

export async function getUserInterviews(uid: string): Promise<MockInterviewRecording[]> {
    if (!db) return [];
    try {
        const q = query(collection(db, INTERVIEWS_COLLECTION), where('userId', '==', uid));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ ...d.data(), id: d.id } as MockInterviewRecording)).sort((a, b) => b.timestamp - a.timestamp);
    } catch (e) {
        console.error("User interviews fetch error", e);
        return [];
    }
}

export async function deleteInterview(id: string): Promise<void> {
    if (!db) throw new Error("Database offline.");
    if (!id || typeof id !== 'string' || id.trim() === "") {
        console.error("[Firestore] Attempted to delete interview with invalid ID:", id);
        return; 
    }
    
    try {
        const docRef = doc(db, INTERVIEWS_COLLECTION, id);
        await deleteDoc(docRef);
    } catch (e: any) {
        if (e.code === 'permission-denied') {
            throw new Error("You do not have permission to delete this record.");
        }
        throw e;
    }
}

// --- Trust and Insurance ---

/**
 * Calculates a real-time trust score based on verified check issuance.
 */
export async function calculateUserTrustScore(uid: string): Promise<TrustScore> {
    if (!db) throw new Error("DB offline");
    const q = query(collection(db, CHECKS_COLLECTION), where('ownerId', '==', uid), where('isVerified', '==', true));
    const snap = await getDocs(q);
    
    let totalVal = 0;
    let count = 0;
    const last3Months = Date.now() - (86400000 * 90);
    let recentVal = 0;

    snap.forEach(d => {
        const data = d.data() as BankingCheck;
        totalVal += data.amount || 0;
        count++;
        if (new Date(data.date).getTime() > last3Months) {
            recentVal += data.amount || 0;
        }
    });

    const averageAmount = count > 0 ? totalVal / count : 0;
    // Simple score logic: volume-based trust
    const score = Math.min(1000, Math.floor((count * 10) + (totalVal / 1000)));
    
    const trust: TrustScore = {
        score,
        totalChecksIssued: count,
        averageAmount,
        verifiedVolume: totalVal,
        lastActivity: Date.now()
    };

    await updateDoc(doc(db, USERS_COLLECTION, uid), { trustScore: trust });
    return trust;
}

// --- User Profile & Identity ---

export async function syncUserProfile(user: any) {
    if (!db) return;
    const userRef = doc(db, USERS_COLLECTION, user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
        const profile: UserProfile = {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || 'Anonymous',
            photoURL: user.photoURL || '',
            createdAt: Date.now(),
            lastLogin: Date.now(),
            subscriptionTier: 'free',
            apiUsageCount: 0,
            groups: [],
            coinBalance: 500
        };
        await setDoc(userRef, profile);
    } else {
        await updateDoc(userRef, { lastLogin: Date.now() });
    }
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, USERS_COLLECTION, uid));
    return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function updateUserProfile(uid: string, data: Partial<UserProfile>) {
    if (!db) return;
    await updateDoc(doc(db, USERS_COLLECTION, uid), sanitizeData(data));
}

export async function setUserSubscriptionTier(uid: string, tier: SubscriptionTier) {
    if (!db) return;
    await updateDoc(doc(db, USERS_COLLECTION, uid), { subscriptionTier: tier });
}

export async function getUserProfileByEmail(email: string): Promise<UserProfile | null> {
    if (!db) return null;
    const q = query(collection(db, USERS_COLLECTION), where('email', '==', email.toLowerCase().trim()), limit(1));
    const snap = await getDocs(q);
    return !snap.empty ? (snap.docs[0].data() as UserProfile) : null;
}

export async function getAllUsers(): Promise<UserProfile[]> {
    if (!db) return [];
    const snap = await getDocs(collection(db, USERS_COLLECTION));
    return snap.docs.map(d => ({ ...d.data(), uid: d.id } as UserProfile));
}

export async function registerIdentity(uid: string, publicKey: string, certificate: string) {
    if (!db) return;
    await updateDoc(doc(db, USERS_COLLECTION, uid), { publicKey, certificate });
}

export async function logUserActivity(action: string, metadata: any) {
    if (!db || !auth?.currentUser) return;
    try {
        await addDoc(collection(db, 'user_activity'), {
            uid: auth.currentUser.uid,
            action,
            metadata,
            timestamp: Date.now()
        });
    } catch (e) {}
}

export async function incrementApiUsage(uid: string) {
    if (!db || !uid) return;
    await updateDoc(doc(db, USERS_COLLECTION, uid), {
        apiUsageCount: increment(1)
    });
}

// --- Groups & Social ---

export async function createGroup(name: string, visibility: 'public' | 'private'): Promise<string> {
    if (!db || !auth?.currentUser) throw new Error("Auth required");
    const id = generateSecureId();
    const group: Group = {
        id, name, ownerId: auth.currentUser.uid,
        memberIds: [auth.currentUser.uid],
        createdAt: Date.now(),
        visibility
    };
    await setDoc(doc(db, GROUPS_COLLECTION, id), group);
    await updateDoc(doc(db, USERS_COLLECTION, auth.currentUser.uid), {
        groups: arrayUnion(id)
    });
    return id;
}

export async function getUserGroups(uid: string): Promise<Group[]> {
    if (!db) return [];
    const q = query(collection(db, GROUPS_COLLECTION), where('memberIds', 'array-contains', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Group);
}

export async function getPublicGroups(excludeUid?: string): Promise<Group[]> {
    if (!db) return [];
    let q = query(collection(db, GROUPS_COLLECTION), where('visibility', '==', 'public'));
    const snap = await getDocs(q);
    let groups = snap.docs.map(d => d.data() as Group);
    if (excludeUid) groups = groups.filter(g => !g.memberIds.includes(excludeUid));
    return groups;
}

export async function joinGroup(groupId: string) {
    if (!db || !auth?.currentUser) return;
    const uid = auth.currentUser.uid;
    await updateDoc(doc(db, GROUPS_COLLECTION, groupId), { memberIds: arrayUnion(uid) });
    await updateDoc(doc(db, USERS_COLLECTION, uid), { groups: arrayUnion(groupId) });
}

export async function getGroupMembers(memberIds: string[]): Promise<UserProfile[]> {
    if (!db || memberIds.length === 0) return [];
    // Firestore in queries are limited to 10 items. For simplicity in demo, we chunk.
    const chunks = [];
    for (let i = 0; i < memberIds.length; i += 10) {
        chunks.push(memberIds.slice(i, i + 10));
    }
    const results: UserProfile[] = [];
    for (const chunk of chunks) {
        const q = query(collection(db, USERS_COLLECTION), where(documentId(), 'in', chunk));
        const snap = await getDocs(q);
        snap.forEach(d => results.push(d.data() as UserProfile));
    }
    return results;
}

export async function renameGroup(groupId: string, name: string) {
    if (!db) return;
    await updateDoc(doc(db, GROUPS_COLLECTION, groupId), { name });
}

export async function deleteGroup(groupId: string) {
    if (!db) return;
    await deleteDoc(doc(db, GROUPS_COLLECTION, groupId));
}

export async function removeMemberFromGroup(groupId: string, uid: string) {
    if (!db) return;
    await updateDoc(doc(db, GROUPS_COLLECTION, groupId), { memberIds: arrayRemove(uid) });
    await updateDoc(doc(db, USERS_COLLECTION, uid), { groups: arrayRemove(groupId) });
}

export async function followUser(uid: string, targetUid: string) {
    if (!db) return;
    await updateDoc(doc(db, USERS_COLLECTION, uid), { following: arrayUnion(targetUid) });
    await updateDoc(doc(db, USERS_COLLECTION, targetUid), { followers: arrayUnion(uid) });
}

export async function unfollowUser(uid: string, targetUid: string) {
    if (!db) return;
    await updateDoc(doc(db, USERS_COLLECTION, uid), { following: arrayRemove(targetUid) });
    await updateDoc(doc(db, USERS_COLLECTION, targetUid), { followers: arrayRemove(uid) });
}

// --- Messaging & Chat ---

export async function sendMessage(channelId: string, text: string, path: string, replyTo?: any, attachments?: any[]) {
    if (!db || !auth?.currentUser) return;
    const msg: any = {
        id: generateSecureId(),
        text,
        senderId: auth.currentUser.uid,
        senderName: auth.currentUser.displayName || 'User',
        senderImage: auth.currentUser.photoURL || '',
        timestamp: Timestamp.now(),
        replyTo,
        attachments
    };
    await addDoc(collection(db, path), sanitizeData(msg));
}

export function subscribeToMessages(channelId: string, callback: (msgs: RealTimeMessage[]) => void, path: string) {
    if (!db) return () => {};
    const q = query(collection(db, path), orderBy('timestamp', 'asc'), limit(100));
    return onSnapshot(q, snap => {
        callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as RealTimeMessage)));
    });
}

export async function deleteMessage(channelId: string, msgId: string, path: string) {
    if (!db) return;
    await deleteDoc(doc(db, path, msgId));
}

export async function createOrGetDMChannel(otherUserId: string, otherUserName: string): Promise<string> {
    if (!db || !auth?.currentUser) throw new Error("Auth required");
    const myUid = auth.currentUser.uid;
    const participants = [myUid, otherUserId].sort();
    const channelId = `dm_${participants[0]}_${participants[1]}`;
    
    const channelRef = doc(db, 'chat_channels', channelId);
    const snap = await getDoc(channelRef);
    
    if (!snap.exists()) {
        const channel: ChatChannel = {
            id: channelId,
            name: `${auth.currentUser.displayName} & ${otherUserName}`,
            type: 'dm',
            memberIds: participants,
            createdAt: Date.now()
        };
        await setDoc(channelRef, channel);
    }
    return channelId;
}

export async function getUserDMChannels(): Promise<ChatChannel[]> {
    if (!db || !auth?.currentUser) return [];
    const q = query(collection(db, 'chat_channels'), where('memberIds', 'array-contains', auth.currentUser.uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as ChatChannel);
}

// --- Files & Storage ---

export async function uploadFileToStorage(path: string, blob: Blob): Promise<string> {
    if (!storage) throw new Error("Storage offline");
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
}

export async function uploadCommentAttachment(file: File, path: string): Promise<string> {
    return uploadFileToStorage(path, file);
}

export async function uploadResumeToStorage(uid: string, file: File): Promise<string> {
    return uploadFileToStorage(`resumes/${uid}/${file.name}`, file);
}

// --- Channels & Feed ---

export async function getPublicChannels(): Promise<Channel[]> {
    if (!db) return [];
    const q = query(collection(db, CHANNELS_COLLECTION), where('visibility', '==', 'public'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Channel));
}

export async function getCreatorChannels(ownerId: string): Promise<Channel[]> {
    if (!db) return [];
    const q = query(collection(db, CHANNELS_COLLECTION), where('ownerId', '==', ownerId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Channel));
}

export async function getChannelsByIds(ids: string[]): Promise<Channel[]> {
    if (!db || ids.length === 0) return [];
    const chunks = [];
    for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));
    const results: Channel[] = [];
    for (const chunk of chunks) {
        const q = query(collection(db, CHANNELS_COLLECTION), where(documentId(), 'in', chunk));
        const snap = await getDocs(q);
        snap.forEach(d => results.push({ ...d.data(), id: d.id } as Channel));
    }
    return results;
}

export function subscribeToPublicChannels(callback: (channels: Channel[]) => void) {
    if (!db) return () => {};
    // REMOVED orderBy('createdAt', 'desc') to avoid composite index requirement
    const q = query(collection(db, CHANNELS_COLLECTION), where('visibility', '==', 'public'));
    return onSnapshot(q, snap => {
        callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as Channel)));
    });
}

export async function publishChannelToFirestore(channel: Channel) {
    if (!db) return;
    await setDoc(doc(db, CHANNELS_COLLECTION, channel.id), sanitizeData(channel));
}

export async function deleteChannelFromFirestore(id: string) {
    if (!db) return;
    await deleteDoc(doc(db, CHANNELS_COLLECTION, id));
}

export async function voteChannel(id: string, type: 'like' | 'dislike') {
    if (!db || !auth?.currentUser) return;
    const ref = doc(db, CHANNEL_STATS_COLLECTION, id);
    const inc = type === 'like' ? 1 : -1;
    await setDoc(ref, { likes: increment(inc) }, { merge: true });
    
    // Update user liked list
    const userRef = doc(db, USERS_COLLECTION, auth.currentUser.uid);
    if (type === 'like') await updateDoc(userRef, { likedChannelIds: arrayUnion(id) });
    else await updateDoc(userRef, { likedChannelIds: arrayRemove(id) });
}

export async function shareChannel(id: string) {
    if (!db) return;
    const ref = doc(db, CHANNEL_STATS_COLLECTION, id);
    await setDoc(ref, { shares: increment(1) }, { merge: true });
}

export function subscribeToChannelStats(id: string, callback: (stats: ChannelStats) => void, initial: ChannelStats) {
    if (!db) return () => {};
    const ref = doc(db, CHANNEL_STATS_COLLECTION, id);
    return onSnapshot(ref, snap => {
        if (snap.exists()) callback(snap.data() as ChannelStats);
        else callback(initial);
    });
}

export async function addCommentToChannel(channelId: string, comment: Comment) {
    if (!db) return;
    await updateDoc(doc(db, CHANNELS_COLLECTION, channelId), {
        comments: arrayUnion(sanitizeData(comment))
    });
}

export async function deleteCommentFromChannel(channelId: string, commentId: string) {
    if (!db) return;
    const snap = await getDoc(doc(db, CHANNELS_COLLECTION, channelId));
    if (snap.exists()) {
        const comments = (snap.data().comments || []) as Comment[];
        await updateDoc(doc(db, CHANNELS_COLLECTION, channelId), {
            comments: comments.filter(c => c.id !== commentId)
        });
    }
}

export async function updateCommentInChannel(channelId: string, commentId: string, newText: string, attachments: Attachment[]) {
    if (!db) return;
    const snap = await getDoc(doc(db, CHANNELS_COLLECTION, channelId));
    if (snap.exists()) {
        const comments = (snap.data().comments || []) as Comment[];
        await updateDoc(doc(db, CHANNELS_COLLECTION, channelId), {
            comments: comments.map(c => c.id === commentId ? { ...c, text: newText, attachments } : c)
        });
    }
}

export async function seedDatabase() {
    if (!db) return;
    const batch = writeBatch(db);
    HANDCRAFTED_CHANNELS.forEach(c => {
        const d = doc(db, CHANNELS_COLLECTION, c.id);
        batch.set(d, { ...c, visibility: 'public' });
    });
    await batch.commit();
}

export async function updateAllChannelDatesToToday(): Promise<number> {
    if (!db) return 0;
    const snap = await getDocs(collection(db, CHANNELS_COLLECTION));
    const batch = writeBatch(db);
    const now = Date.now();
    snap.forEach(d => batch.update(d.ref, { createdAt: now }));
    await batch.commit();
    return snap.size;
}

// --- Bookings ---

export async function createBooking(booking: Booking): Promise<string> {
    if (!db) throw new Error("DB offline");
    const ref = await addDoc(collection(db, BOOKINGS_COLLECTION), sanitizeData(booking));
    return ref.id;
}

export async function getUserBookings(uid: string, email: string): Promise<Booking[]> {
    if (!db) return [];
    const q1 = query(collection(db, BOOKINGS_COLLECTION), where('userId', '==', uid));
    const q2 = query(collection(db, BOOKINGS_COLLECTION), where('invitedEmail', '==', email.toLowerCase()));
    const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    const map = new Map<string, Booking>();
    s1.forEach(d => map.set(d.id, { ...d.data(), id: d.id } as Booking));
    s2.forEach(d => map.set(d.id, { ...d.data(), id: d.id } as Booking));
    return Array.from(map.values());
}

export async function getPendingBookings(email: string): Promise<Booking[]> {
    if (!db) return [];
    const q = query(collection(db, BOOKINGS_COLLECTION), where('invitedEmail', '==', email.toLowerCase()), where('status', '==', 'pending'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Booking));
}

export async function respondToBooking(id: string, accept: boolean) {
    if (!db) return;
    await updateDoc(doc(db, BOOKINGS_COLLECTION, id), { status: accept ? 'scheduled' : 'rejected' });
}

export async function cancelBooking(id: string) {
    if (!db) return;
    await updateDoc(doc(db, BOOKINGS_COLLECTION, id), { status: 'cancelled' });
}

export async function updateBookingRecording(id: string, url: string, transcriptUrl: string) {
    if (!db) return;
    await updateDoc(doc(db, BOOKINGS_COLLECTION, id), { recordingUrl: url, transcriptUrl, status: 'completed' });
}

export async function getPendingInvitations(email: string): Promise<Invitation[]> {
    if (!db) return [];
    const q = query(collection(db, INVITATIONS_COLLECTION), where('toEmail', '==', email.toLowerCase()), where('status', '==', 'pending'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Invitation));
}

export async function sendInvitation(groupId: string, email: string) {
    if (!db || !auth?.currentUser) return;
    const invite: any = {
        id: generateSecureId(),
        fromUserId: auth.currentUser.uid,
        fromName: auth.currentUser.displayName || 'User',
        toEmail: email.toLowerCase().trim(),
        groupId,
        status: 'pending',
        createdAt: Date.now(),
        type: 'group'
    };
    await addDoc(collection(db, INVITATIONS_COLLECTION), invite);
}

export async function respondToInvitation(invite: Invitation, accept: boolean) {
    if (!db || !auth?.currentUser) return;
    const uid = auth.currentUser.uid;
    await updateDoc(doc(db, INVITATIONS_COLLECTION, invite.id), { status: accept ? 'accepted' : 'rejected' });
    if (accept && invite.type === 'group' && invite.groupId) {
        await joinGroup(invite.groupId);
    }
}

// --- Recordings & Discussions ---

export async function saveRecordingReference(recording: RecordingSession) {
    if (!db) return;
    await setDoc(doc(db, RECORDINGS_COLLECTION, recording.id), sanitizeData(recording));
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

export async function saveDiscussion(discussion: CommunityDiscussion): Promise<string> {
    if (!db) throw new Error("DB offline");
    const ref = await addDoc(collection(db, DISCUSSIONS_COLLECTION), sanitizeData(discussion));
    return ref.id;
}

export async function updateDiscussion(id: string, data: Partial<CommunityDiscussion>) {
    if (!db) return;
    await updateDoc(doc(db, DISCUSSIONS_COLLECTION, id), sanitizeData(data));
}

export async function getDiscussionById(id: string): Promise<CommunityDiscussion | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, DISCUSSIONS_COLLECTION, id));
    return snap.exists() ? (snap.data() as CommunityDiscussion) : null;
}

export function subscribeToDiscussion(id: string, callback: (d: CommunityDiscussion) => void) {
    if (!db) return () => {};
    return onSnapshot(doc(db, DISCUSSIONS_COLLECTION, id), snap => {
        if (snap.exists()) callback(snap.data() as CommunityDiscussion);
    });
}

export async function saveDiscussionDesignDoc(id: string, docText: string, title: string) {
    if (!db) return;
    await updateDoc(doc(db, DISCUSSIONS_COLLECTION, id), { designDoc: docText, title, updatedAt: Date.now() });
}

export async function updateDiscussionVisibility(id: string, visibility: ChannelVisibility, groupIds: string[]) {
    if (!db) return;
    await updateDoc(doc(db, DISCUSSIONS_COLLECTION, id), { visibility, groupIds });
}

export async function getUserDesignDocs(uid: string): Promise<CommunityDiscussion[]> {
    if (!db) return [];
    const q = query(collection(db, DISCUSSIONS_COLLECTION), where('userId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as CommunityDiscussion));
}

export async function getPublicDesignDocs(): Promise<CommunityDiscussion[]> {
    if (!db) return [];
    const q = query(collection(db, DISCUSSIONS_COLLECTION), where('visibility', '==', 'public'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as CommunityDiscussion));
}

export async function getGroupDesignDocs(groupIds: string[]): Promise<CommunityDiscussion[]> {
    if (!db || groupIds.length === 0) return [];
    const chunks = [];
    for (let i = 0; i < groupIds.length; i += 10) chunks.push(groupIds.slice(i, i + 10));
    const results: CommunityDiscussion[] = [];
    for (const chunk of chunks) {
        const q = query(collection(db, DISCUSSIONS_COLLECTION), where('groupIds', 'array-contains-any', chunk));
        const snap = await getDocs(q);
        snap.forEach(d => results.push({ ...d.data(), id: d.id } as CommunityDiscussion));
    }
    return results;
}

export async function deleteDiscussion(id: string) {
    if (!db) return;
    await deleteDoc(doc(db, DISCUSSIONS_COLLECTION, id));
}

// --- Specialized Tools (Projects, Whiteboard, Blog, Careers, Coins) ---

export async function saveCodeProject(project: CodeProject) {
    if (!db) return;
    await setDoc(doc(db, CODE_PROJECTS_COLLECTION, project.id), sanitizeData(project));
}

export async function getCodeProject(id: string): Promise<CodeProject | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, CODE_PROJECTS_COLLECTION, id));
    return snap.exists() ? (snap.data() as CodeProject) : null;
}

export function subscribeToCodeProject(id: string, callback: (p: CodeProject) => void) {
    if (!db) return () => {};
    return onSnapshot(doc(db, CODE_PROJECTS_COLLECTION, id), snap => {
        if (snap.exists()) callback(snap.data() as CodeProject);
    });
}

export async function updateCodeFile(projectId: string, file: CodeFile) {
    if (!db) return;
    const snap = await getDoc(doc(db, CODE_PROJECTS_COLLECTION, projectId));
    if (snap.exists()) {
        const files = (snap.data().files || []) as CodeFile[];
        const next = files.map(f => f.path === file.path ? file : f);
        await updateDoc(doc(db, CODE_PROJECTS_COLLECTION, projectId), { files: next, lastModified: Date.now() });
    }
}

export async function deleteCodeFile(projectId: string, filePath: string) {
    if (!db) return;
    const snap = await getDoc(doc(db, CODE_PROJECTS_COLLECTION, projectId));
    if (snap.exists()) {
        const files = (snap.data().files || []) as CodeFile[];
        await updateDoc(doc(db, CODE_PROJECTS_COLLECTION, projectId), { files: files.filter(f => f.path !== filePath), lastModified: Date.now() });
    }
}

export async function updateProjectActiveFile(projectId: string, filePath: string) {
    if (!db) return;
    await updateDoc(doc(db, CODE_PROJECTS_COLLECTION, projectId), { activeFilePath: filePath });
}

export async function updateProjectAccess(projectId: string, level: 'public' | 'restricted', allowedUsers: string[]) {
    if (!db) return;
    await updateDoc(doc(db, CODE_PROJECTS_COLLECTION, projectId), { accessLevel: level, allowedUserIds: allowedUsers });
}

export async function claimCodeProjectLock(projectId: string, clientId: string) {
    if (!db) return;
    await updateDoc(doc(db, CODE_PROJECTS_COLLECTION, projectId), { activeClientId: clientId });
}

export async function updateCursor(projectId: string, cursor: CursorPosition) {
    if (!db) return;
    const ref = doc(db, CODE_PROJECTS_COLLECTION, projectId, 'cursors', cursor.clientId);
    await setDoc(ref, sanitizeData(cursor));
}

export function subscribeToWhiteboard(id: string, callback: (els: WhiteboardElement[]) => void) {
    if (!db) return () => {};
    return onSnapshot(doc(db, WHITEBOARDS_COLLECTION, id), snap => {
        if (snap.exists()) callback(snap.data().elements || []);
    });
}

export async function updateWhiteboardElement(id: string, el: WhiteboardElement) {
    if (!db) return;
    await updateDoc(doc(db, WHITEBOARDS_COLLECTION, id), { elements: arrayUnion(sanitizeData(el)) });
}

export async function deleteWhiteboardElements(id: string) {
    if (!db) return;
    await updateDoc(doc(db, WHITEBOARDS_COLLECTION, id), { elements: [] });
}

export async function saveWhiteboardSession(id: string, elements: WhiteboardElement[]) {
    if (!db) return;
    await setDoc(doc(db, WHITEBOARDS_COLLECTION, id), { elements: sanitizeData(elements) });
}

export async function ensureUserBlog(user: any): Promise<Blog> {
    if (!db) throw new Error("Offline");
    const blogId = `blog_${user.uid}`;
    const ref = doc(db, BLOGS_COLLECTION, blogId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
        const blog: Blog = {
            id: blogId, ownerId: user.uid, authorName: user.displayName || 'Anonymous',
            title: `${user.displayName}'s Blog`, description: 'Neural observations and insights.', createdAt: Date.now()
        };
        await setDoc(ref, blog);
        return blog;
    }
    return snap.data() as Blog;
}

export async function getCommunityPosts(): Promise<BlogPost[]> {
    if (!db) return [];
    // REMOVED orderBy('publishedAt', 'desc') to avoid composite index requirement
    const q = query(collection(db, POSTS_COLLECTION), where('status', '==', 'published'), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as BlogPost));
}

export async function getUserPosts(blogId: string): Promise<BlogPost[]> {
    if (!db) return [];
    const q = query(collection(db, POSTS_COLLECTION), where('blogId', '==', blogId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as BlogPost));
}

export async function createBlogPost(post: BlogPost): Promise<string> {
    if (!db) throw new Error("Offline");
    const ref = await addDoc(collection(db, POSTS_COLLECTION), sanitizeData(post));
    return ref.id;
}

export async function updateBlogPost(id: string, post: Partial<BlogPost>) {
    if (!db) return;
    await updateDoc(doc(db, POSTS_COLLECTION, id), sanitizeData(post));
}

export async function deleteBlogPost(id: string) {
    if (!db) return;
    await deleteDoc(doc(db, POSTS_COLLECTION, id));
}

export async function updateBlogSettings(blogId: string, settings: { title: string, description: string }) {
    if (!db) return;
    await updateDoc(doc(db, BLOGS_COLLECTION, blogId), settings);
}

export async function deleteBlog(id: string) {
    if (!db) return;
    await deleteDoc(doc(db, BLOGS_COLLECTION, id));
}

export async function addPostComment(postId: string, comment: Comment) {
    if (!db) return;
    await updateDoc(doc(db, POSTS_COLLECTION, postId), {
        comments: arrayUnion(sanitizeData(comment)),
        commentCount: increment(1)
    });
}

export async function getBlogPost(id: string): Promise<BlogPost | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, POSTS_COLLECTION, id));
    return snap.exists() ? ({ ...snap.data(), id: snap.id } as BlogPost) : null;
}

export async function submitCareerApplication(app: CareerApplication) {
    if (!db) return;
    await addDoc(collection(db, APPLICATIONS_COLLECTION), sanitizeData(app));
}

export async function createJobPosting(job: JobPosting): Promise<string> {
    if (!db) throw new Error("Offline");
    const ref = await addDoc(collection(db, JOBS_COLLECTION), sanitizeData(job));
    return ref.id;
}

export async function getJobPostings(): Promise<JobPosting[]> {
    if (!db) return [];
    const q = query(collection(db, JOBS_COLLECTION), orderBy('postedAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as JobPosting));
}

export async function getAllCareerApplications(): Promise<CareerApplication[]> {
    if (!db) return [];
    const snap = await getDocs(collection(db, APPLICATIONS_COLLECTION));
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as CareerApplication));
}

export async function getJobPosting(id: string): Promise<JobPosting | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, JOBS_COLLECTION, id));
    return snap.exists() ? ({ ...snap.data(), id: snap.id } as JobPosting) : null;
}

export async function saveBankingCheck(check: BankingCheck) {
    if (!db) return;
    await setDoc(doc(db, CHECKS_COLLECTION, check.id), sanitizeData(check));
}

export async function getCheckById(id: string): Promise<BankingCheck | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, CHECKS_COLLECTION, id));
    return snap.exists() ? (snap.data() as BankingCheck) : null;
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
    if (!db || !auth?.currentUser) return;
    const checkRef = doc(db, CHECKS_COLLECTION, id);
    const snap = await getDoc(checkRef);
    if (snap.exists() && snap.data().isCoinCheck && !snap.data().isClaimed) {
        const amount = snap.data().coinAmount || 0;
        await updateDoc(checkRef, { isClaimed: true });
        await updateDoc(doc(db, USERS_COLLECTION, auth.currentUser.uid), { coinBalance: increment(amount) });
    }
}

export async function saveIcon(icon: GeneratedIcon): Promise<string> {
    if (!db) throw new Error("Offline");
    await setDoc(doc(db, ICONS_COLLECTION, icon.id), sanitizeData(icon));
    return icon.id;
}

export async function getIcon(id: string): Promise<GeneratedIcon | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, ICONS_COLLECTION, id));
    return snap.exists() ? (snap.data() as GeneratedIcon) : null;
}

export async function saveShippingLabel(label: ShippingLabel) {
    if (!db) return;
    await setDoc(doc(db, SHIPPING_COLLECTION, label.id), sanitizeData(label));
}

export async function saveCard(memory: AgentMemory, id: string): Promise<string> {
    if (!db) throw new Error("Offline");
    const payload = { ...memory, id, ownerId: auth?.currentUser?.uid || 'guest' };
    await setDoc(doc(db, CARDS_COLLECTION, id), sanitizeData(payload));
    return id;
}

export async function getCard(id: string): Promise<AgentMemory | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, CARDS_COLLECTION, id));
    return snap.exists() ? (snap.data() as AgentMemory) : null;
}

export async function getUserCards(uid: string): Promise<AgentMemory[]> {
    if (!db) return [];
    const q = query(collection(db, CARDS_COLLECTION), where('ownerId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as AgentMemory);
}

export async function deleteCard(id: string) {
    if (!db) return;
    await deleteObject(ref(storage!, `cards/${id}/cover.jpg`)).catch(() => {});
    await deleteDoc(doc(db, CARDS_COLLECTION, id));
}

export async function saveNotebook(nb: Notebook): Promise<string> {
    if (!db) throw new Error("Offline");
    await setDoc(doc(db, NOTEBOOKS_COLLECTION, nb.id), sanitizeData(nb));
    return nb.id;
}

export async function getNotebook(id: string): Promise<Notebook | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, NOTEBOOKS_COLLECTION, id));
    return snap.exists() ? (snap.data() as Notebook) : null;
}

export async function getCreatorNotebooks(uid: string): Promise<Notebook[]> {
    if (!db) return [];
    const q = query(collection(db, NOTEBOOKS_COLLECTION), where('ownerId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Notebook);
}

export async function saveSavedWord(uid: string, word: any) {
    if (!db) return;
    await setDoc(doc(db, SAVED_WORDS_COLLECTION, uid), sanitizeData(word));
}

export async function getSavedWordForUser(uid: string): Promise<any> {
    if (!db) return null;
    const snap = await getDoc(doc(db, SAVED_WORDS_COLLECTION, uid));
    return snap.exists() ? snap.data() : null;
}

// --- Coin Transactions ---

export async function getCoinTransactions(uid: string): Promise<CoinTransaction[]> {
    if (!db) return [];
    const q1 = query(collection(db, TRANSACTIONS_COLLECTION), where('fromId', '==', uid));
    const q2 = query(collection(db, TRANSACTIONS_COLLECTION), where('toId', '==', uid));
    const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    const map = new Map<string, CoinTransaction>();
    s1.forEach(d => map.set(d.id, { ...d.data(), id: d.id } as CoinTransaction));
    s2.forEach(d => map.set(d.id, { ...d.data(), id: d.id } as CoinTransaction));
    return Array.from(map.values()).sort((a,b) => b.timestamp - a.timestamp);
}

export async function transferCoins(toId: string, toName: string, amount: number, memo: string) {
    if (!db || !auth?.currentUser) return;
    const fromId = auth.currentUser.uid;
    const fromName = auth.currentUser.displayName || 'Sender';
    const tx: CoinTransaction = {
        id: generateSecureId(), fromId, fromName, toId, toName, amount,
        type: 'transfer', memo, timestamp: Date.now(), isVerified: true
    };
    await addDoc(collection(db, TRANSACTIONS_COLLECTION), sanitizeData(tx));
    await updateDoc(doc(db, USERS_COLLECTION, fromId), { coinBalance: increment(-amount) });
    await updateDoc(doc(db, USERS_COLLECTION, toId), { coinBalance: increment(amount) });
}

export const DEFAULT_MONTHLY_GRANT = 10000;

export async function checkAndGrantMonthlyCoins(uid: string) {
    if (!db) return;
    const userRef = doc(db, USERS_COLLECTION, uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
        const profile = snap.data() as UserProfile;
        const lastGrant = profile.lastCoinGrantAt || 0;
        const oneMonth = 30 * 86400000;
        if (Date.now() - lastGrant > oneMonth) {
            await updateDoc(userRef, { 
                coinBalance: increment(DEFAULT_MONTHLY_GRANT), 
                lastCoinGrantAt: Date.now() 
            });
        }
    }
}

export async function claimOfflinePayment(token: OfflinePaymentToken) {
    if (!db || !auth?.currentUser) return;
    const uid = auth.currentUser.uid;
    const userRef = doc(db, USERS_COLLECTION, uid);
    await updateDoc(userRef, { coinBalance: increment(token.amount) });
    await updateDoc(doc(db, USERS_COLLECTION, token.senderId), { coinBalance: increment(-token.amount) });
    
    const tx: CoinTransaction = {
        id: generateSecureId(), fromId: token.senderId, fromName: token.senderName,
        toId: uid, toName: auth.currentUser.displayName || 'Receiver', amount: token.amount,
        type: 'offline', memo: token.memo, timestamp: Date.now(), isVerified: true,
        offlineToken: token.nonce
    };
    await addDoc(collection(db, TRANSACTIONS_COLLECTION), sanitizeData(tx));
}

// --- Admin Utilities ---

export async function getDebugCollectionDocs(name: string, limitNum: number): Promise<any[]> {
    if (!db) return [];
    const q = query(collection(db, name), limit(limitNum));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id }));
}

export async function getGlobalStats(): Promise<GlobalStats> {
    if (!db) return { totalLogins: 0, uniqueUsers: 0 };
    const snap = await getDoc(doc(db, 'system', 'stats'));
    return snap.exists() ? (snap.data() as GlobalStats) : { totalLogins: 0, uniqueUsers: 0 };
}

export async function recalculateGlobalStats(): Promise<number> {
    if (!db) return 0;
    const snap = await getDocs(collection(db, USERS_COLLECTION));
    const count = snap.size;
    await setDoc(doc(db, 'system', 'stats'), { uniqueUsers: count }, { merge: true });
    return count;
}

export async function addChannelAttachment(channelId: string, attachment: Attachment) {
    if (!db) return;
    await updateDoc(doc(db, CHANNELS_COLLECTION, channelId), {
        appendix: arrayUnion(sanitizeData(attachment))
    });
}
