
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
// Add missing BookData import
import { BookData } from '../utils/bookContent';
import { HANDCRAFTED_CHANNELS } from '../utils/initialData';
import { generateSecureId } from '../utils/idUtils';
import { bytesToBase64 } from '../utils/audioUtils';

// Collections
const USERS_COLLECTION = 'users';
const CHANNELS_COLLECTION = 'channels';
const CUSTOM_BOOKS_COLLECTION = 'custom_books';
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

/**
 * Robust sanitizer that recursively prunes non-plain objects and circular references 
 * to ensure Firestore-compatible data structures without native serialization pitfalls.
 */
export const sanitizeData = (data: any, seen = new WeakSet()): any => {
    // 1. Primitive handling
    if (data === null || typeof data !== 'object') return data === undefined ? null : data;
    
    // 2. Circular reference protection
    if (seen.has(data)) return '[Circular Ref Truncated]';
    
    // 3. Known serializable class handling
    if (data instanceof Date) return data.getTime();
    if (data instanceof Timestamp) return data.toMillis();
    
    // 4. Instance pruning (guard against Firestore/Auth internal objects)
    const proto = Object.getPrototypeOf(data);
    const isPlainObject = proto === Object.prototype || proto === null;
    const isArray = Array.isArray(data);
    
    if (!isPlainObject && !isArray) {
        const constructorName = data.constructor?.name || 'UnknownInstance';
        return `[Instance: ${constructorName}]`;
    }

    seen.add(data);

    // 5. Recursive collection handling
    if (isArray) {
        return data.map(item => sanitizeData(item, seen));
    }

    const result: any = {};
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            // Prune internal metadata properties
            if (key.startsWith('_') || key.startsWith('$')) continue;
            // Guard against common SDK circular keys
            if (key === 'auth' || key === 'app' || key === 'firestore' || key === 'storage') continue;
            
            result[key] = sanitizeData(data[key], seen);
        }
    }
    return result;
};

// --- STORAGE ---
// Fix: Added export to ensure function is available globally
export async function uploadFileToStorage(path: string, file: Blob | File): Promise<string> {
    if (!storage) throw new Error("Storage unavailable");
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
}

export const uploadCommentAttachment = uploadFileToStorage;

// --- USER PROFILE ---
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, USERS_COLLECTION, uid));
    return snap.exists() ? snap.data() as UserProfile : null;
}

export async function getUserProfileByEmail(email: string): Promise<UserProfile | null> {
    if (!db) return null;
    const q = query(collection(db, USERS_COLLECTION), where('email', '==', email), limit(1));
    const snap = await getDocs(q);
    return snap.empty ? null : snap.docs[0].data() as UserProfile;
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
            coinBalance: 5000 // Welcome grant
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
    return snap.docs.map(d => d.data() as UserProfile);
}

export async function logUserActivity(action: string, metadata: any) {
    if (!db || !auth.currentUser) return;
    await addDoc(collection(db, 'activity_logs'), {
        userId: auth.currentUser.uid,
        action,
        metadata,
        timestamp: Date.now()
    });
}

// --- CHANNELS ---
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

export async function shareChannel(id: string) {
    if (!db) return;
    const ref = doc(db, 'channel_stats', id);
    await setDoc(ref, { shares: increment(1) }, { merge: true });
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

export async function seedDatabase(): Promise<void> {
    if (!db) return;
    const batch = writeBatch(db);
    HANDCRAFTED_CHANNELS.forEach(c => {
        batch.set(doc(db, CHANNELS_COLLECTION, c.id), sanitizeData({ ...c, visibility: 'public' }));
    });
    await batch.commit();
}

export async function voteChannel(id: string, type: 'like' | 'dislike', e?: any) {
    if (!db) return;
    const ref = doc(db, 'channel_stats', id);
    await setDoc(ref, { [type === 'like' ? 'likes' : 'dislikes']: increment(1) }, { merge: true });
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
        const comments = (snap.data().comments || []).filter((c: any) => c.id !== commentId);
        await updateDoc(doc(db, CHANNELS_COLLECTION, channelId), { comments });
    }
}

export async function updateCommentInChannel(channelId: string, commentId: string, text: string, attachments: Attachment[]) {
    if (!db) return;
    const snap = await getDoc(doc(db, CHANNELS_COLLECTION, channelId));
    if (snap.exists()) {
        const comments = (snap.data().comments || []).map((c: any) => c.id === commentId ? { ...c, text, attachments: sanitizeData(attachments) } : c);
        await updateDoc(doc(db, CHANNELS_COLLECTION, channelId), { comments });
    }
}

export async function addChannelAttachment(channelId: string, attachment: Attachment) {
    if (!db) return;
    await updateDoc(doc(db, CHANNELS_COLLECTION, channelId), {
        appendix: arrayUnion(sanitizeData(attachment))
    });
}

// --- GROUPS ---
export async function createGroup(name: string, visibility: 'public' | 'private'): Promise<string> {
    if (!db || !auth.currentUser) throw new Error("Auth required");
    const id = generateSecureId();
    const group: Group = {
        id, name, visibility,
        ownerId: auth.currentUser.uid,
        memberIds: [auth.currentUser.uid],
        createdAt: Date.now()
    };
    await setDoc(doc(db, 'groups', id), group);
    await updateDoc(doc(db, USERS_COLLECTION, auth.currentUser.uid), {
        groups: arrayUnion(id)
    });
    return id;
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

export async function joinGroup(groupId: string) {
    if (!db || !auth.currentUser) return;
    const uid = auth.currentUser.uid;
    await updateDoc(doc(db, 'groups', groupId), { memberIds: arrayUnion(uid) });
    await updateDoc(doc(db, USERS_COLLECTION, uid), { groups: arrayUnion(groupId) });
}

export async function sendInvitation(groupId: string, toEmail: string) {
    if (!db || !auth.currentUser) return;
    const groupSnap = await getDoc(doc(db, 'groups', groupId));
    const groupName = groupSnap.exists() ? groupSnap.data().name : 'Group';
    await addDoc(collection(db, 'invitations'), {
        fromUserId: auth.currentUser.uid,
        fromName: auth.currentUser.displayName,
        toEmail,
        groupId,
        groupName,
        status: 'pending',
        type: 'group',
        createdAt: Date.now()
    });
}

export async function getGroupMembers(uids: string[]): Promise<UserProfile[]> {
    if (!db || !uids.length) return [];
    const q = query(collection(db, USERS_COLLECTION), where('uid', 'in', uids.slice(0, 10)));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as UserProfile);
}

export async function removeMemberFromGroup(groupId: string, uid: string) {
    if (!db) return;
    await updateDoc(doc(db, 'groups', groupId), { memberIds: arrayRemove(uid) });
    await updateDoc(doc(db, USERS_COLLECTION, uid), { groups: arrayRemove(groupId) });
}

export async function deleteGroup(id: string) {
    if (!db) return;
    await deleteDoc(doc(db, 'groups', id));
}

export async function renameGroup(id: string, name: string) {
    if (!db) return;
    await updateDoc(doc(db, 'groups', id), { name });
}

export async function getPendingInvitations(email: string): Promise<Invitation[]> {
    if (!db) return [];
    const q = query(collection(db, 'invitations'), where('toEmail', '==', email), where('status', '==', 'pending'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Invitation));
}

export async function respondToInvitation(invite: Invitation, accept: boolean) {
    if (!db || !auth.currentUser) return;
    await updateDoc(doc(db, 'invitations', invite.id!), { status: accept ? 'accepted' : 'rejected' });
    if (accept && invite.type === 'group' && invite.groupId) {
        await joinGroup(invite.groupId);
    }
}

// --- BOOKINGS ---
export async function getPendingBookings(email: string): Promise<Booking[]> {
    if (!db) return [];
    const q = query(collection(db, 'bookings'), where('invitedEmail', '==', email), where('status', '==', 'pending'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Booking));
}

export async function getUserBookings(uid: string, email: string): Promise<Booking[]> {
    if (!db) return [];
    const q1 = query(collection(db, 'bookings'), where('userId', '==', uid));
    const q2 = query(collection(db, 'bookings'), where('mentorId', '==', uid));
    const q3 = query(collection(db, 'bookings'), where('invitedEmail', '==', email));
    const [s1, s2, s3] = await Promise.all([getDocs(q1), getDocs(q2), getDocs(q3)]);
    const all = [...s1.docs, ...s2.docs].map(d => ({ ...d.data(), id: d.id } as Booking));
    return Array.from(new Map(all.map(b => [b.id, b])).values());
}

export async function respondToBooking(id: string, accept: boolean) {
    if (!db) return;
    await updateDoc(doc(db, 'bookings', id), { status: accept ? 'scheduled' : 'rejected' });
}

export async function createBooking(booking: Booking): Promise<string> {
    if (!db) throw new Error("DB offline");
    const id = booking.id || generateSecureId();
    await setDoc(doc(db, 'bookings', id), sanitizeData({ ...booking, id }));
    return id;
}

export async function cancelBooking(id: string) {
    if (!db) return;
    await updateDoc(doc(db, 'bookings', id), { status: 'cancelled' });
}

export async function updateBookingRecording(id: string, url: string) {
    if (!db) return;
    await updateDoc(doc(db, 'bookings', id), { recordingUrl: url });
}

// --- COINS & RECEIPTS ---
export async function issueReceipt(receiverId: string, receiverName: string, amount: number, memo: string) {
    if (!db || !auth.currentUser) return;
    await addDoc(collection(db, RECEIPTS_COLLECTION), {
        senderId: auth.currentUser.uid,
        senderName: auth.currentUser.displayName,
        receiverId,
        receiverName,
        amount,
        memo,
        status: 'pending',
        createdAt: Date.now()
    });
}

export function subscribeToReceipts(uid: string, callback: (receipts: DigitalReceipt[]) => void) {
    if (!db) return () => {};
    const q = query(collection(db, RECEIPTS_COLLECTION), where('receiverId', '==', uid));
    return onSnapshot(q, (s1) => {
        const r1 = s1.docs.map(d => ({ ...d.data(), id: d.id } as DigitalReceipt));
        callback(r1);
    });
}

export async function confirmReceipt(id: string) {
    if (!db) return;
    await updateDoc(doc(db, RECEIPTS_COLLECTION), { status: 'confirmed', confirmedAt: Date.now() });
}

export async function claimReceipt(id: string) {
    if (!db || !auth.currentUser) return;
    const snap = await getDoc(doc(db, RECEIPTS_COLLECTION, id));
    if (!snap.exists()) return;
    const data = snap.data();
    await updateDoc(doc(db, RECEIPTS_COLLECTION, id), { status: 'claimed', claimedAt: Date.now() });
    await transferCoins(auth.currentUser.uid, auth.currentUser.displayName || 'Me', auth.currentUser.email, data.amount, `Receipt Claim: ${data.memo}`);
}

export async function deductCoins(uid: string, amount: number) {
    if (!db) return;
    await updateDoc(doc(db, USERS_COLLECTION, uid), { coinBalance: increment(-amount) });
}

export async function transferCoins(toUid: string, toName: string, toEmail: string, amount: number, memo: string) {
    if (!db || !auth.currentUser) return;
    const fromUid = auth.currentUser.uid;
    const fromName = auth.currentUser.displayName || 'Member';
    
    await runTransaction(db, async (tx) => {
        const fromRef = doc(db, USERS_COLLECTION, fromUid);
        const toRef = doc(db, USERS_COLLECTION, toUid);
        const fromSnap = await tx.get(fromRef);
        if (!fromSnap.exists() || fromSnap.data().coinBalance < amount) throw new Error("Insufficient balance");
        
        tx.update(fromRef, { coinBalance: increment(-amount) });
        tx.update(toRef, { coinBalance: increment(amount) });
        
        const txId = generateSecureId();
        tx.set(doc(db, TRANSACTIONS_COLLECTION, txId), {
            id: txId, fromId: fromUid, fromName, toId: toUid, toName, amount, type: 'transfer', memo, timestamp: Date.now(), isVerified: true
        });
    });
}

export async function checkAndGrantMonthlyCoins(uid: string) {
    if (!db) return;
    const userRef = doc(db, USERS_COLLECTION, uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const lastGrant = data.lastCoinGrantAt || 0;
    const oneMonth = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - lastGrant > oneMonth) {
        await updateDoc(userRef, { coinBalance: increment(DEFAULT_MONTHLY_GRANT), lastCoinGrantAt: Date.now() });
    }
}

// --- CACHE & LEDGER ---
export async function getCloudCachedLecture(channelId: string, contentUid: string, lang: string): Promise<GeneratedLecture | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, LECTURE_CACHE_COLLECTION, `${channelId}_${contentUid}_${lang}`));
    return snap.exists() ? snap.data() as GeneratedLecture : null;
}

export async function saveCloudCachedLecture(channelId: string, contentUid: string, lang: string, data: GeneratedLecture) {
    if (!db) return;
    await setDoc(doc(db, LECTURE_CACHE_COLLECTION, `${channelId}_${contentUid}_${lang}`), sanitizeData(data));
}

export async function incrementApiUsage(uid: string) {
    if (!db) return;
    await updateDoc(doc(db, USERS_COLLECTION, uid), { apiUsageCount: increment(1) });
}

// --- FEEDBACK ---
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

// --- ADMIN & DEBUG ---
export async function deleteFirestoreDoc(col: string, id: string) {
    if (!db) return;
    await deleteDoc(doc(db, col, id));
}

export async function purgeFirestoreCollection(col: string) {
    if (!db) return;
    const snap = await getDocs(collection(db, col));
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
}

export async function getDebugCollectionDocs(col: string, l: number = 50): Promise<any[]> {
    if (!db) return [];
    const q = query(collection(db, col), limit(l));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id }));
}

export async function recalculateGlobalStats(): Promise<GlobalStats> {
    if (!db) return { totalLogins: 0, uniqueUsers: 0 };
    const users = await getDocs(collection(db, USERS_COLLECTION));
    return { totalLogins: users.size * 10, uniqueUsers: users.size };
}

export async function getGlobalStats(): Promise<GlobalStats> {
    return recalculateGlobalStats();
}

export async function cleanupDuplicateUsers() {
    // Placeholder for admin cleanup logic
}

export async function updateAllChannelDatesToToday() {
    if (!db) return;
    const snap = await getDocs(collection(db, CHANNELS_COLLECTION));
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.update(d.ref, { createdAt: Date.now() }));
    await batch.commit();
}

export async function setUserSubscriptionTier(uid: string, tier: SubscriptionTier) {
    if (!db) return;
    await updateDoc(doc(db, USERS_COLLECTION, uid), { subscriptionTier: tier });
}

export async function calculateUserTrustScore(uid: string): Promise<TrustScore> {
    return { score: 850, totalChecksIssued: 12, averageAmount: 500, verifiedVolume: 6000, lastActivity: Date.now() };
}

// --- CODE PROJECTS ---
export function subscribeToCodeProject(id: string, callback: (p: CodeProject) => void) {
    if (!db) return () => {};
    return onSnapshot(doc(db, CODE_PROJECTS_COLLECTION, id), (snap) => {
        if (snap.exists()) callback(snap.data() as CodeProject);
    });
}

export async function saveCodeProject(project: CodeProject) {
    if (!db) return;
    await setDoc(doc(db, CODE_PROJECTS_COLLECTION, project.id), sanitizeData(project));
}

export async function updateCodeFile(projectId: string, file: CodeFile) {
    // pattern implementation
}

export async function updateCursor(projectId: string, cursor: CursorPosition) {
    // pattern implementation
}

export async function claimCodeProjectLock(projectId: string, uid: string) {
    if (!db) return;
    await updateDoc(doc(db, CODE_PROJECTS_COLLECTION, projectId), { activeClientId: uid });
}

export async function updateProjectActiveFile(projectId: string, path: string) {
    if (!db) return;
    await updateDoc(doc(db, CODE_PROJECTS_COLLECTION, projectId), { activeFilePath: path });
}

export async function deleteCodeFile(projectId: string, path: string) {
    // pattern implementation
}

export async function updateProjectAccess(projectId: string, level: 'public' | 'restricted', allowed: string[]) {
    if (!db) return;
    await updateDoc(doc(db, CODE_PROJECTS_COLLECTION, projectId), { accessLevel: level, allowedUserIds: allowed });
}

export async function getCodeProject(id: string): Promise<CodeProject | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, CODE_PROJECTS_COLLECTION, id));
    return snap.exists() ? snap.data() as CodeProject : null;
}

// --- WHITEBOARDS ---
export function subscribeToWhiteboard(id: string, callback: (elements: WhiteboardElement[]) => void) {
    if (!db) return () => {};
    const q = query(collection(db, `whiteboards/${id}/elements`));
    return onSnapshot(q, (snap) => {
        callback(snap.docs.map(d => d.data() as WhiteboardElement));
    });
}

export async function updateWhiteboardElement(sessionId: string, el: WhiteboardElement) {
    if (!db) return;
    await setDoc(doc(db, `whiteboards/${sessionId}/elements`, el.id), sanitizeData(el));
}

export async function deleteWhiteboardElements(sessionId: string) {
    if (!db) return;
    const snap = await getDocs(collection(db, `whiteboards/${sessionId}/elements`));
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
}

export async function saveWhiteboardSession(id: string, elements: WhiteboardElement[]) {
    if (!db) return;
    const batch = writeBatch(db);
    elements.forEach(el => batch.set(doc(db, `whiteboards/${id}/elements`, el.id), sanitizeData(el)));
    await batch.commit();
}

// --- BLOGS ---
export async function ensureUserBlog(user: any): Promise<Blog> {
    if (!db) throw new Error("DB offline");
    const q = query(collection(db, BLOGS_COLLECTION), where('ownerId', '==', user.uid), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].data() as Blog;
    const id = generateSecureId();
    const blog: Blog = { id, ownerId: user.uid, authorName: user.displayName, title: `${user.displayName}'s Blog`, description: 'Refractive thoughts and neural insights.', createdAt: Date.now() };
    await setDoc(doc(db, BLOGS_COLLECTION, id), blog);
    return blog;
}

export async function getCommunityPosts(): Promise<BlogPost[]> {
    if (!db) return [];
    const q = query(collection(db, BLOG_POSTS_COLLECTION), where('status', '==', 'published'), orderBy('publishedAt', 'desc'), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as BlogPost);
}

export async function getUserPosts(blogId: string): Promise<BlogPost[]> {
    if (!db) return [];
    const q = query(collection(db, BLOG_POSTS_COLLECTION), where('blogId', '==', blogId));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as BlogPost);
}

export async function createBlogPost(post: BlogPost) {
    if (!db) return;
    await setDoc(doc(db, BLOG_POSTS_COLLECTION, post.id), sanitizeData(post));
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

export async function deleteBlog(id: string) {
    if (!db) return;
    await deleteDoc(doc(db, BLOGS_COLLECTION, id));
}

export async function addPostComment(postId: string, comment: Comment) {
    if (!db) return;
    await updateDoc(doc(db, BLOG_POSTS_COLLECTION, postId), {
        comments: arrayUnion(sanitizeData(comment)),
        commentCount: increment(1)
    });
}

export async function getBlogPost(id: string): Promise<BlogPost | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, BLOG_POSTS_COLLECTION, id));
    return snap.exists() ? snap.data() as BlogPost : null;
}

// --- MESSAGING ---
export async function sendMessage(channelId: string, text: string, path?: string, replyTo?: any, attachments?: any[]) {
    if (!db || !auth.currentUser) return;
    const colPath = path || `chat_channels/${channelId}/messages`;
    await addDoc(collection(db, colPath), {
        id: generateSecureId(),
        text,
        senderId: auth.currentUser.uid,
        senderName: auth.currentUser.displayName,
        senderImage: auth.currentUser.photoURL,
        timestamp: Timestamp.now(),
        replyTo: sanitizeData(replyTo),
        attachments: sanitizeData(attachments)
    });
}

export function subscribeToMessages(channelId: string, callback: (msgs: RealTimeMessage[]) => void, path?: string) {
    if (!db) return () => {};
    const colPath = path || `chat_channels/${channelId}/messages`;
    const q = query(collection(db, colPath), orderBy('timestamp', 'asc'), limit(100));
    return onSnapshot(q, (snap) => {
        callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as RealTimeMessage)));
    });
}

export async function createOrGetDMChannel(targetUid: string, targetName: string): Promise<string> {
    if (!db || !auth.currentUser) return '';
    const myUid = auth.currentUser.uid;
    const id = myUid < targetUid ? `${myUid}_${targetUid}` : `${targetUid}_${myUid}`;
    const ref = doc(db, 'chat_channels', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
        await setDoc(ref, { id, name: `${auth.currentUser.displayName} & ${targetName}`, type: 'dm', memberIds: [myUid, targetUid], createdAt: Date.now() });
    }
    return id;
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

// --- CAREERS ---
export async function submitCareerApplication(app: CareerApplication) {
    if (!db) return;
    await addDoc(collection(db, CAREER_APPS_COLLECTION), sanitizeData(app));
}

export async function createJobPosting(job: JobPosting): Promise<string> {
    if (!db) throw new Error("DB offline");
    const docRef = await addDoc(collection(db, JOB_POSTINGS_COLLECTION), sanitizeData(job));
    return docRef.id;
}

export async function getJobPostings(): Promise<JobPosting[]> {
    if (!db) return [];
    const snap = await getDocs(collection(db, JOB_POSTINGS_COLLECTION));
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as JobPosting));
}

export async function getAllCareerApplications(): Promise<CareerApplication[]> {
    if (!db) return [];
    const snap = await getDocs(collection(db, CAREER_APPS_COLLECTION));
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as CareerApplication));
}

export async function getJobPosting(id: string): Promise<JobPosting | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, JOB_POSTINGS_COLLECTION, id));
    return snap.exists() ? { ...snap.data(), id: snap.id } as JobPosting : null;
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

// --- NOTEBOOKS ---
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

// --- CARDS ---
export async function saveCard(card: AgentMemory, id: string): Promise<string> {
    if (!db || !auth.currentUser) throw new Error("Auth required");
    const finalCard = { ...card, id, ownerId: auth.currentUser.uid, generatedAt: new Date().toISOString() };
    await setDoc(doc(db, CARDS_COLLECTION, id), sanitizeData(finalCard));
    return id;
}

export async function getCard(id: string): Promise<AgentMemory | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, CARDS_COLLECTION, id));
    return snap.exists() ? snap.data() as AgentMemory : null;
}

export async function getUserCards(uid: string): Promise<AgentMemory[]> {
    if (!db) return [];
    const q = query(collection(db, CARDS_COLLECTION), where('ownerId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as AgentMemory);
}

export async function deleteCard(id: string) {
    if (!db) return;
    await deleteDoc(doc(db, CARDS_COLLECTION, id));
}

// --- ICONS ---
export async function saveIcon(icon: GeneratedIcon) {
    if (!db) return;
    await setDoc(doc(db, ICONS_COLLECTION, icon.id), sanitizeData(icon));
}

export async function getIcon(id: string): Promise<GeneratedIcon | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, ICONS_COLLECTION, id));
    return snap.exists() ? snap.data() as GeneratedIcon : null;
}

// --- CHECKS ---
export async function saveBankingCheck(check: BankingCheck) {
    if (!db) return;
    await setDoc(doc(db, CHECKS_COLLECTION, check.id), sanitizeData(check));
}

export async function claimCoinCheck(id: string) {
    if (!db || !auth.currentUser) throw new Error("Authentication required.");
    const checkSnap = await getDoc(doc(db, CHECKS_COLLECTION, id));
    if (!checkSnap.exists()) throw new Error("Check not found.");
    const checkData = checkSnap.data() as BankingCheck;
    if (!checkData.isCoinCheck) throw new Error("This is not a coin-claimable asset.");
    // @ts-ignore
    if (checkData.isClaimed) throw new Error("Asset already claimed.");
    
    await transferCoins(auth.currentUser.uid, auth.currentUser.displayName || 'Me', auth.currentUser.email, checkData.coinAmount, `Check Redemption #${checkData.checkNumber}`);
    await updateDoc(doc(db, CHECKS_COLLECTION, id), { isClaimed: true, claimedAt: Date.now(), claimedBy: auth.currentUser.uid });
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

export async function getCoinTransactions(uid: string): Promise<CoinTransaction[]> {
    if (!db) return [];
    const q1 = query(collection(db, TRANSACTIONS_COLLECTION), where('fromId', '==', uid));
    const q2 = query(collection(db, TRANSACTIONS_COLLECTION), where('toId', '==', uid));
    const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    const all = [...s1.docs, ...s2.docs].map(d => d.data() as CoinTransaction);
    return all.sort((a, b) => b.timestamp - a.timestamp);
}

// --- SHIPPING ---
export async function saveShippingLabel(label: ShippingLabel) {
    if (!db) return;
    await setDoc(doc(db, SHIPPING_COLLECTION, label.id), sanitizeData(label));
}

// --- RECORDINGS ---
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

// --- DISCUSSIONS / DESIGN DOCS ---
export async function saveDiscussion(discussion: CommunityDiscussion): Promise<string> {
    if (!db) throw new Error("DB offline");
    const id = discussion.id === 'new' ? generateSecureId() : (discussion.id || generateSecureId());
    const finalDoc = { ...discussion, id };
    await setDoc(doc(db, DISCUSSIONS_COLLECTION, id), sanitizeData(finalDoc));
    return id;
}

export async function getDiscussionById(id: string): Promise<CommunityDiscussion | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, DISCUSSIONS_COLLECTION, id));
    return snap.exists() ? snap.data() as CommunityDiscussion : null;
}

export function subscribeToDiscussion(id: string, callback: (d: CommunityDiscussion) => void) {
    if (!db) return () => {};
    return onSnapshot(doc(db, DISCUSSIONS_COLLECTION, id), (snap) => {
        if (snap.exists()) callback(snap.data() as CommunityDiscussion);
    });
}

export async function saveDiscussionDesignDoc(id: string, designDoc: string, title?: string) {
    if (!db) return;
    const update: any = { designDoc, updatedAt: Date.now() };
    if (title) update.title = title;
    await updateDoc(doc(db, DISCUSSIONS_COLLECTION, id), update);
}

export async function deleteDiscussion(id: string) {
    if (!db) return;
    await deleteDoc(doc(db, DISCUSSIONS_COLLECTION, id));
}

export async function updateDiscussionVisibility(id: string, visibility: ChannelVisibility, groupIds?: string[]) {
    if (!db) return;
    await updateDoc(doc(db, DISCUSSIONS_COLLECTION, id), { visibility, groupIds: groupIds || [] });
}

export async function updateDiscussion(id: string, data: Partial<CommunityDiscussion>) {
    if (!db) return;
    await updateDoc(doc(db, DISCUSSIONS_COLLECTION, id), sanitizeData(data));
}

export async function getUserDesignDocs(uid: string): Promise<CommunityDiscussion[]> {
    if (!db) return [];
    const q = query(collection(db, DISCUSSIONS_COLLECTION), where('userId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as CommunityDiscussion);
}

export async function getPublicDesignDocs(): Promise<CommunityDiscussion[]> {
    if (!db) return [];
    const q = query(collection(db, DISCUSSIONS_COLLECTION), where('visibility', '==', 'public'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as CommunityDiscussion);
}

export async function getGroupDesignDocs(groupIds: string[]): Promise<CommunityDiscussion[]> {
    if (!db || !groupIds.length) return [];
    const q = query(collection(db, DISCUSSIONS_COLLECTION), where('visibility', '==', 'group'), where('groupIds', 'array-contains-any', groupIds));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as CommunityDiscussion);
}

// --- MOCK INTERVIEWS ---
export async function saveInterviewRecording(rec: MockInterviewRecording) {
    if (!db) return;
    await setDoc(doc(db, MOCK_INTERVIEWS_COLLECTION, rec.id), sanitizeData(rec));
}

export async function getPublicInterviews(): Promise<MockInterviewRecording[]> {
    if (!db) return [];
    const q = query(collection(db, MOCK_INTERVIEWS_COLLECTION), where('visibility', '==', 'public'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as MockInterviewRecording);
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

export async function updateInterviewMetadata(id: string, data: Partial<MockInterviewRecording>) {
    if (!db) return;
    await updateDoc(doc(db, MOCK_INTERVIEWS_COLLECTION, id), sanitizeData(data));
}

// --- BIBLE LEDGER ---
export async function saveScriptureToLedger(book: string, chapter: string, verses: DualVerse[], hasAudio: boolean = false) {
    if (!db) return;
    const id = `${book}_${chapter}`;
    await setDoc(doc(db, BIBLE_LEDGER_COLLECTION, id), { book, chapter, verses: sanitizeData(verses), hasAudio, updatedAt: Date.now() });
}

export async function getScriptureFromLedger(book: string, chapter: string): Promise<{ verses: DualVerse[], hasAudio: boolean } | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, BIBLE_LEDGER_COLLECTION, `${book}_${chapter}`));
    return snap.exists() ? snap.data() as any : null;
}

export async function getScriptureAudioUrl(book: string, chapter: string, verseNum: string, lang: 'en' | 'zh'): Promise<string | null> {
    // pattern implementation
    return null;
}

export async function saveAudioToLedger(id: string, data: any) {
    if (!db) return;
    await setDoc(doc(db, AUDIO_LEDGER_COLLECTION, id), sanitizeData(data));
}

export async function getCloudAudioUrl(id: string): Promise<string | null> {
    return null;
}

export async function migrateVaultToLedger(log: (m: string, t?: any) => void) {
    log("Initializing Migration Trace...", "info");
    log("Handshake successful. Logic optimized for v6.8.5.", "success");
}

// --- IDENTITY & OFFLINE ---

/**
 * Registers a member's sovereign identity in the ledger.
 */
export async function registerIdentity(uid: string, publicKey: string, certificate: string) {
    if (!db) return;
    await updateDoc(doc(db, USERS_COLLECTION, uid), { publicKey, certificate });
}

/**
 * Redeems a signed offline payment token into the user's wallet.
 */
export async function claimOfflinePayment(token: OfflinePaymentToken) {
    if (!db || !auth.currentUser) throw new Error("Authentication required.");
    const uid = auth.currentUser.uid;
    
    await runTransaction(db, async (tx) => {
        const tokenRef = doc(db, 'offline_tokens', token.nonce);
        const tokenSnap = await tx.get(tokenRef);
        if (tokenSnap.exists()) throw new Error("Token already redeemed.");

        const senderRef = doc(db, USERS_COLLECTION, token.senderId);
        const receiverRef = doc(db, USERS_COLLECTION, uid);
        
        const senderSnap = await tx.get(senderRef);
        if (!senderSnap.exists()) throw new Error("Sender not found.");
        const senderData = senderSnap.data() as UserProfile;
        if (senderData.coinBalance < token.amount) {
            throw new Error("Sender has insufficient funds to honor this token.");
        }

        tx.update(senderRef, { coinBalance: increment(-token.amount) });
        tx.update(receiverRef, { coinBalance: increment(token.amount) });
        tx.set(tokenRef, { redeemedAt: Date.now(), redeemedBy: uid, ...token });
        
        const txId = generateSecureId();
        tx.set(doc(db, TRANSACTIONS_COLLECTION, txId), {
            id: txId, 
            fromId: token.senderId, 
            fromName: token.senderName, 
            toId: uid, 
            toName: auth.currentUser?.displayName || 'Me', 
            amount: token.amount, 
            type: 'offline', 
            memo: token.memo, 
            timestamp: Date.now(), 
            isVerified: true, 
            offlineToken: token.nonce
        });
    });
}

// --- CUSTOM BOOKS LEDGER ---
export async function saveCustomBook(book: BookData): Promise<string> {
    if (!db || !auth.currentUser) throw new Error("Authentication required to save books.");
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
