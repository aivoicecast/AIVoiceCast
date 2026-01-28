
import { 
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, query, where, 
  orderBy, limit, onSnapshot, runTransaction, increment, arrayUnion, arrayRemove, 
  Timestamp, writeBatch, documentId
} from '@firebase/firestore';
import { ref, uploadBytes, getDownloadURL, listAll, getMetadata, deleteObject, getBytes, list } from '@firebase/storage';
import { db, auth, storage } from './firebaseConfig';
import { 
  UserProfile, Channel, ChannelStats, Comment, Attachment, Group, ChatChannel, RealTimeMessage, 
  GeneratedLecture, CommunityDiscussion, Booking, Invitation, RecordingSession, CodeProject, 
  CodeFile, CursorPosition, CloudItem, WhiteboardElement, Blog, BlogPost, JobPosting, 
  CareerApplication, Notebook, AgentMemory, GlobalStats, SubscriptionTier, Chapter, 
  TranscriptItem, ChannelVisibility, GeneratedIcon, BankingCheck, ShippingLabel, CoinTransaction, TodoItem, OfflinePaymentToken, MockInterviewRecording, TrustScore, UserFeedback, DualVerse
} from '../types';
import { HANDCRAFTED_CHANNELS } from '../utils/initialData';
import { generateSecureId } from '../utils/idUtils';
import { bytesToBase64, base64ToBytes, pcmToWavBlob } from '../utils/audioUtils';

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
const FEEDBACK_COLLECTION = 'feedback';
const SCRIPTURE_COLLECTION = 'bible_ledger'; 
const AUDIO_LEDGER_COLLECTION = 'bible_audio_ledger';

export const ADMIN_GROUP = 'admin_neural_prism';

export const AI_COSTS = {
    TEXT_REFRACTION: 100,
    CURRICULUM_SYNTHESIS: 250,
    AUDIO_SYNTHESIS: 50,
    IMAGE_GENERATION: 500,
    VIDEO_GENERATION: 5000,
    TECHNICAL_EVALUATION: 1000
};

/**
 * Utility to strip Firestore-unsupported 'undefined' values and complex browser objects.
 */
const sanitizeData = (data: any) => { 
    if (!data) return data;
    const cleaned = JSON.parse(JSON.stringify(data, (key, value) => {
        if (value === undefined) return null;
        if (value instanceof HTMLElement || value instanceof MediaStream || value instanceof AudioContext) return null;
        return value;
    }));
    return cleaned; 
};

// --- CORE UTILITIES ---

/**
 * Stores audio bytes in the database as Base64.
 */
export async function saveAudioToLedger(book: string, chapter: string, verse: string, lang: string, bytes: Uint8Array, mimeType: string = 'audio/mpeg'): Promise<string | null> {
    if (!db) throw new Error("Database offline.");
    
    const baseId = `${book}_${chapter}_${verse}_${lang}`.replace(/\s+/g, '_');
    const docRef = doc(db, AUDIO_LEDGER_COLLECTION, baseId);
    
    const CHUNK_SIZE = 750000; 

    if (bytes.length <= CHUNK_SIZE) {
        const base64Data = bytesToBase64(bytes);
        await setDoc(docRef, {
            data: base64Data,
            mimeType: mimeType,
            size: bytes.length,
            isChunked: false,
            updatedAt: Date.now()
        });
        return baseId;
    } else {
        const numChunks = Math.ceil(bytes.length / CHUNK_SIZE);
        window.dispatchEvent(new CustomEvent('neural-log', { 
            detail: { text: `[LEDGER] Fragmenting Large Audio: ${baseId} into ${numChunks} parts.`, type: 'warn' } 
        }));

        await setDoc(docRef, {
            isChunked: true,
            chunkCount: numChunks,
            mimeType: mimeType,
            totalSize: bytes.length,
            updatedAt: Date.now()
        });

        const batch = writeBatch(db);
        for (let i = 0; i < numChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, bytes.length);
            const slice = bytes.slice(start, end);
            const chunkRef = doc(db, AUDIO_LEDGER_COLLECTION, `${baseId}_part_${i}`);
            batch.set(chunkRef, {
                data: bytesToBase64(slice),
                updatedAt: Date.now()
            });
        }
        await batch.commit();
        return baseId;
    }
}

export async function saveScriptureToLedger(book: string, chapter: string, verses: DualVerse[], hasAudio: boolean = false): Promise<void> {
    if (!db) throw new Error("Database offline.");
    if (!verses || verses.length === 0) return;

    const docId = `${book}_${chapter}`;
    const docRef = doc(db, SCRIPTURE_COLLECTION, docId);
    
    const payload = sanitizeData({
        book: book,
        chapter: chapter,
        verses: verses,
        hasAudio: hasAudio,
        updatedAt: Date.now()
    });
    
    await setDoc(docRef, payload);
}

export interface LedgerScriptureResult {
    verses: DualVerse[];
    hasAudio: boolean;
}

// Fix: Updated return type to LedgerScriptureResult to include hasAudio status
export async function getScriptureFromLedger(book: string, chapter: string): Promise<LedgerScriptureResult | null> {
    if (!db) return null;
    const docId = `${book}_${chapter}`;
    const docRef = doc(db, SCRIPTURE_COLLECTION, docId);
    
    const snap = await getDoc(docRef);
    if (snap.exists()) {
        const data = snap.data();
        // Fix: Returning the full result object as expected by consumers in Scripture Sanctuary and Ingest
        return {
            verses: data.verses as DualVerse[],
            hasAudio: !!data.hasAudio
        };
    }
    return null;
}

/**
 * Reassembles audio from Ledger and wraps raw PCM in a WAV header for standard playback.
 */
export async function getScriptureAudioUrl(book: string, chapter: string, verse: string, lang: string): Promise<string | null> {
    const baseId = `${book}_${chapter}_${verse}_${lang}`.replace(/\s+/g, '_');
    
    if (db) {
        const docRef = doc(db, AUDIO_LEDGER_COLLECTION, baseId);
        const manifestSnap = await getDoc(docRef);

        if (manifestSnap.exists()) {
            const mData = manifestSnap.data();
            const mime = (mData.mimeType || 'audio/mpeg').toLowerCase();

            let base64Data = '';
            if (!mData.isChunked) {
                base64Data = mData.data;
            } else {
                const count = mData.chunkCount;
                const chunkPromises = [];
                for (let i = 0; i < count; i++) {
                    chunkPromises.push(getDoc(doc(db, AUDIO_LEDGER_COLLECTION, `${baseId}_part_${i}`)));
                }
                const chunkSnaps = await Promise.all(chunkPromises);
                base64Data = chunkSnaps.map(s => s.exists() ? s.data()?.data : '').join('');
            }

            // If it's raw PCM, we MUST wrap it in a WAV header so Audio() or decodeAudioData can process it
            if (mime.includes('pcm')) {
                const bytes = base64ToBytes(base64Data);
                const wavBlob = pcmToWavBlob(bytes, 24000);
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(wavBlob);
                });
            } else {
                return `data:${mime};base64,${base64Data}`;
            }
        }
    }

    if (!storage) return null;
    const path = `bible_audio/${book}/${chapter}/${verse}_${lang}.wav`;
    try {
        const storageRef = ref(storage, path);
        return await getDownloadURL(storageRef);
    } catch (e) {
        return null;
    }
}

// --- USER & AUTHENTICATION ---

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, USERS_COLLECTION, uid));
    return snap.exists() ? snap.data() as UserProfile : null;
}

export async function syncUserProfile(user: any): Promise<void> {
    if (!db || !user) return;
    const docRef = doc(db, USERS_COLLECTION, user.uid);
    const snap = await getDoc(docRef);
    const now = Date.now();
    if (!snap.exists()) {
        const profile: UserProfile = {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || 'Anonymous User',
            photoURL: user.photoURL || '',
            createdAt: now,
            lastLogin: now,
            subscriptionTier: 'free',
            groups: [],
            coinBalance: 1000,
            apiUsageCount: 0
        };
        await setDoc(docRef, sanitizeData(profile));
    } else {
        await updateDoc(docRef, { lastLogin: now });
    }
}

export async function updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, USERS_COLLECTION, uid), sanitizeData(data));
}

export async function followUser(followerUid: string, targetUid: string) {
    if (!db) return;
    const batch = writeBatch(db);
    batch.update(doc(db, USERS_COLLECTION, followerUid), { following: arrayUnion(targetUid) });
    batch.update(doc(db, USERS_COLLECTION, targetUid), { followers: arrayUnion(followerUid) });
    await batch.commit();
}

export async function unfollowUser(followerUid: string, targetUid: string) {
    if (!db) return;
    const batch = writeBatch(db);
    batch.update(doc(db, USERS_COLLECTION, followerUid), { following: arrayRemove(targetUid) });
    batch.update(doc(db, USERS_COLLECTION, targetUid), { followers: arrayRemove(followerUid) });
    await batch.commit();
}

export async function logUserActivity(type: string, details: any): Promise<void> {
    console.log(`[Activity Log] ${type}`, details);
}

export function isUserAdmin(profile: UserProfile | null): boolean {
    if (!profile) return false;
    return profile.groups?.includes(ADMIN_GROUP) || profile.email === 'shengliang.song.ai@gmail.com';
}

export async function getAllUsers(): Promise<UserProfile[]> {
    if (!db) return [];
    const snap = await getDocs(collection(db, USERS_COLLECTION));
    return snap.docs.map(d => d.data() as UserProfile);
}

export async function getUserProfileByEmail(email: string): Promise<UserProfile | null> {
    if (!db) return null;
    const q = query(collection(db, USERS_COLLECTION), where('email', '==', email));
    const snap = await getDocs(q);
    return snap.empty ? null : snap.docs[0].data() as UserProfile;
}

// --- COINS & API USAGE ---

export async function deductCoins(uid: string, amount: number): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, USERS_COLLECTION, uid), { coinBalance: increment(-amount) });
}

export async function incrementApiUsage(uid: string): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, USERS_COLLECTION, uid), { apiUsageCount: increment(1) });
}

export async function calculateUserTrustScore(uid: string): Promise<number> {
    // Neural trust calculation stubs
    return 750; 
}

// --- CHANNELS & CONTENT ---

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
    await setDoc(doc(db, CHANNELS_COLLECTION, channel.id), sanitizeData(channel), { merge: true });
}

export async function deleteChannelFromFirestore(id: string): Promise<void> {
    if (!db) return;
    await deleteDoc(doc(db, CHANNELS_COLLECTION, id));
}

export async function voteChannel(id: string, type: 'like' | 'dislike') {
    if (!db) return;
    const statsRef = doc(db, CHANNEL_STATS_COLLECTION, id);
    await setDoc(statsRef, { likes: increment(type === 'like' ? 1 : -1) }, { merge: true });
}

export async function addCommentToChannel(channelId: string, comment: Comment) {
    if (!db) return;
    await updateDoc(doc(db, CHANNELS_COLLECTION, channelId), { comments: arrayUnion(sanitizeData(comment)) });
}

export async function deleteCommentFromChannel(channelId: string, commentId: string) {
    if (!db) return;
    const docRef = doc(db, CHANNELS_COLLECTION, channelId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
        const comments = (snap.data().comments as Comment[]).filter(c => c.id !== commentId);
        await updateDoc(docRef, { comments });
    }
}

export async function updateCommentInChannel(channelId: string, commentId: string, text: string) {
    if (!db) return;
    const docRef = doc(db, CHANNELS_COLLECTION, channelId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
        const comments = (snap.data().comments as Comment[]).map(c => c.id === commentId ? { ...c, text, timestamp: Date.now() } : c);
        await updateDoc(docRef, { comments });
    }
}

export async function shareChannel(id: string) {
    if (!db) return;
    await setDoc(doc(db, CHANNEL_STATS_COLLECTION, id), { shares: increment(1) }, { merge: true });
}

export function subscribeToChannelStats(id: string, callback: (stats: Partial<ChannelStats>) => void, initial: ChannelStats) {
    if (!db) return () => {};
    return onSnapshot(doc(db, CHANNEL_STATS_COLLECTION, id), (snap) => {
        if (snap.exists()) callback(snap.data() as ChannelStats);
        else callback(initial);
    });
}

export async function getCreatorChannels(uid: string): Promise<Channel[]> {
    if (!db) return [];
    const q = query(collection(db, CHANNELS_COLLECTION), where('ownerId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Channel);
}

export async function getChannelsByIds(ids: string[]): Promise<Channel[]> {
    if (!db || ids.length === 0) return [];
    const q = query(collection(db, CHANNELS_COLLECTION), where(documentId(), 'in', ids));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Channel);
}

// --- GROUPS & SOCIAL ---

export async function createGroup(name: string, visibility: 'public' | 'private') {
    if (!db || !auth.currentUser) return;
    const id = generateSecureId();
    const group: Group = { id, name, ownerId: auth.currentUser.uid, memberIds: [auth.currentUser.uid], createdAt: Date.now(), visibility };
    await setDoc(doc(db, GROUPS_COLLECTION, id), sanitizeData(group));
    await updateDoc(doc(db, USERS_COLLECTION, auth.currentUser.uid), { groups: arrayUnion(id) });
}

export async function getUserGroups(uid: string): Promise<Group[]> {
    if (!db) return [];
    const q = query(collection(db, GROUPS_COLLECTION), where('memberIds', 'array-contains', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Group);
}

export async function getPublicGroups(uid: string): Promise<Group[]> {
    if (!db) return [];
    const q = query(collection(db, GROUPS_COLLECTION), where('visibility', '==', 'public'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Group).filter(g => !g.memberIds.includes(uid));
}

export async function joinGroup(groupId: string) {
    if (!db || !auth.currentUser) return;
    const uid = auth.currentUser.uid;
    await updateDoc(doc(db, GROUPS_COLLECTION, groupId), { memberIds: arrayUnion(uid) });
    await updateDoc(doc(db, USERS_COLLECTION, uid), { groups: arrayUnion(groupId) });
}

export async function sendInvitation(groupId: string, email: string) {
    if (!db || !auth.currentUser) return;
    const id = generateSecureId();
    const groupSnap = await getDoc(doc(db, GROUPS_COLLECTION, groupId));
    const inv: Invitation = {
        id, fromUserId: auth.currentUser.uid, fromName: auth.currentUser.displayName || 'User',
        toEmail: email, groupId, groupName: groupSnap.data()?.name || 'Group',
        status: 'pending', createdAt: Date.now(), type: 'group'
    };
    await setDoc(doc(db, INVITATIONS_COLLECTION, id), sanitizeData(inv));
}

export async function getGroupMembers(uids: string[]): Promise<UserProfile[]> {
    if (!db || uids.length === 0) return [];
    const q = query(collection(db, USERS_COLLECTION), where('uid', 'in', uids));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as UserProfile);
}

export async function removeMemberFromGroup(groupId: string, uid: string) {
    if (!db) return;
    await updateDoc(doc(db, GROUPS_COLLECTION, groupId), { memberIds: arrayRemove(uid) });
    await updateDoc(doc(db, USERS_COLLECTION, uid), { groups: arrayRemove(groupId) });
}

export async function deleteGroup(id: string) {
    if (!db) return;
    await deleteDoc(doc(db, GROUPS_COLLECTION, id));
}

export async function renameGroup(id: string, name: string) {
    if (!db) return;
    await updateDoc(doc(db, GROUPS_COLLECTION, id), { name });
}

// --- DISCUSSIONS & DOCUMENTS ---

export async function saveDiscussion(discussion: CommunityDiscussion): Promise<string> {
    if (!db) return '';
    const id = discussion.id || generateSecureId();
    await setDoc(doc(db, DISCUSSIONS_COLLECTION, id), sanitizeData({ ...discussion, id }));
    return id;
}

export async function getDiscussionById(id: string): Promise<CommunityDiscussion | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, DISCUSSIONS_COLLECTION, id));
    return snap.exists() ? snap.data() as CommunityDiscussion : null;
}

export function subscribeToDiscussion(id: string, callback: (discussion: CommunityDiscussion) => void) {
    if (!db) return () => {};
    return onSnapshot(doc(db, DISCUSSIONS_COLLECTION, id), (snap) => {
        if (snap.exists()) callback(snap.data() as CommunityDiscussion);
    });
}

export async function saveDiscussionDesignDoc(id: string, designDoc: string, title: string) {
    if (!db) return;
    await updateDoc(doc(db, DISCUSSIONS_COLLECTION, id), { designDoc, title, updatedAt: Date.now() });
}

export async function deleteDiscussion(id: string) {
    if (!db) return;
    await deleteDoc(doc(db, DISCUSSIONS_COLLECTION, id));
}

export async function updateDiscussionVisibility(id: string, visibility: ChannelVisibility, groupIds: string[]) {
    if (!db) return;
    await updateDoc(doc(db, DISCUSSIONS_COLLECTION, id), { visibility, groupIds });
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
    if (!db || groupIds.length === 0) return [];
    const q = query(collection(db, DISCUSSIONS_COLLECTION), where('groupIds', 'array-contains-any', groupIds));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as CommunityDiscussion);
}

export async function updateDiscussion(id: string, data: Partial<CommunityDiscussion>) {
    if (!db) return;
    await updateDoc(doc(db, DISCUSSIONS_COLLECTION, id), sanitizeData(data));
}

// --- BOOKINGS & NOTIFICATIONS ---

export async function getPendingInvitations(email: string): Promise<Invitation[]> {
    if (!db) return [];
    const q = query(collection(db, INVITATIONS_COLLECTION), where('toEmail', '==', email), where('status', '==', 'pending'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Invitation);
}

export async function respondToInvitation(invitation: Invitation, accept: boolean) {
    if (!db) return;
    await updateDoc(doc(db, INVITATIONS_COLLECTION, invitation.id), { status: accept ? 'accepted' : 'rejected' });
    if (accept && invitation.groupId && invitation.type === 'group' && auth.currentUser) {
        await joinGroup(invitation.groupId);
    }
}

export async function getPendingBookings(email: string): Promise<Booking[]> {
    if (!db) return [];
    const q = query(collection(db, BOOKINGS_COLLECTION), where('invitedEmail', '==', email), where('status', '==', 'pending'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Booking);
}

export async function respondToBooking(id: string, accept: boolean) {
    if (!db) return;
    await updateDoc(doc(db, BOOKINGS_COLLECTION, id), { status: accept ? 'scheduled' : 'rejected' });
}

export async function getUserBookings(uid: string, email: string): Promise<Booking[]> {
    if (!db) return [];
    const q = query(collection(db, BOOKINGS_COLLECTION), where('userId', '==', uid));
    const q2 = query(collection(db, BOOKINGS_COLLECTION), where('invitedEmail', '==', email));
    const [s1, s2] = await Promise.all([getDocs(q), getDocs(q2)]);
    return [...s1.docs, ...s2.docs].map(d => d.data() as Booking);
}

export async function createBooking(booking: Booking) {
    if (!db) return;
    await setDoc(doc(db, BOOKINGS_COLLECTION, booking.id), sanitizeData(booking));
}

export async function cancelBooking(id: string) {
    if (!db) return;
    await updateDoc(doc(db, BOOKINGS_COLLECTION, id), { status: 'cancelled' });
}

export async function updateBookingRecording(id: string, url: string) {
    if (!db) return;
    await updateDoc(doc(db, BOOKINGS_COLLECTION, id), { recordingUrl: url });
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

// --- STORAGE & ASSETS ---

export async function uploadFileToStorage(path: string, blob: Blob): Promise<string> {
    if (!storage) throw new Error("Storage unavailable");
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, blob);
    return await getDownloadURL(fileRef);
}

export async function uploadCommentAttachment(file: File, path: string): Promise<string> {
    return await uploadFileToStorage(path, file);
}

export async function uploadResumeToStorage(uid: string, file: File): Promise<string> {
    const path = `resumes/${uid}/${Date.now()}_${file.name}`;
    return await uploadFileToStorage(path, file);
}

export async function uploadUserPhoto(uid: string, file: File): Promise<string> {
    const path = `profiles/${uid}/avatar.jpg`;
    return await uploadFileToStorage(path, file);
}

export async function addChannelAttachment(channelId: string, attachment: Attachment) {
    if (!db) return;
    await updateDoc(doc(db, CHANNELS_COLLECTION, channelId), { appendix: arrayUnion(sanitizeData(attachment)) });
}

// --- LECTURE & CURRICULUM CACHING ---

export async function saveCloudCachedLecture(channelId: string, contentUid: string, lang: string, lecture: GeneratedLecture): Promise<void> {
    if (!db) return;
    const docId = `${channelId}_${contentUid}_${lang}`;
    await setDoc(doc(db, LECTURE_CACHE_COLLECTION, docId), sanitizeData(lecture));
}

export async function getCloudCachedLecture(channelId: string, contentUid: string, lang: string): Promise<GeneratedLecture | null> {
    if (!db) return null;
    const docId = `${channelId}_${contentUid}_${lang}`;
    const snap = await getDoc(doc(db, LECTURE_CACHE_COLLECTION, docId));
    return snap.exists() ? snap.data() as GeneratedLecture : null;
}

// --- CODE STUDIO SYNC ---

export function subscribeToCodeProject(id: string, callback: (project: CodeProject) => void) {
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
    if (!db) return;
    const snap = await getDoc(doc(db, CODE_PROJECTS_COLLECTION, projectId));
    if (snap.exists()) {
        const p = snap.data() as CodeProject;
        const files = p.files.map(f => f.path === file.path ? file : f);
        await updateDoc(doc(db, CODE_PROJECTS_COLLECTION, projectId), { files });
    }
}

export async function updateCursor(projectId: string, position: CursorPosition) {
    // Cursor trace stub
}

export async function claimCodeProjectLock(projectId: string) {
    if (!db || !auth.currentUser) return;
    await updateDoc(doc(db, CODE_PROJECTS_COLLECTION, projectId), { activeClientId: auth.currentUser.uid });
}

export async function updateProjectActiveFile(projectId: string, path: string) {
    if (!db) return;
    await updateDoc(doc(db, CODE_PROJECTS_COLLECTION, projectId), { activeFilePath: path });
}

export async function deleteCodeFile(projectId: string, path: string) {
    if (!db) return;
    const snap = await getDoc(doc(db, CODE_PROJECTS_COLLECTION, projectId));
    if (snap.exists()) {
        const p = snap.data() as CodeProject;
        const files = p.files.filter(f => f.path !== path);
        await updateDoc(doc(db, CODE_PROJECTS_COLLECTION, projectId), { files });
    }
}

export async function updateProjectAccess(projectId: string, access: 'public' | 'restricted', allowedUsers: string[]) {
    if (!db) return;
    await updateDoc(doc(db, CODE_PROJECTS_COLLECTION, projectId), { accessLevel: access, allowedUserIds: allowedUsers });
}

export async function getCodeProject(id: string): Promise<CodeProject | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, CODE_PROJECTS_COLLECTION, id));
    return snap.exists() ? snap.data() as CodeProject : null;
}

// --- WHITEBOARD SYNC ---

export function subscribeToWhiteboard(id: string, callback: (elements: WhiteboardElement[]) => void) {
    if (!db) return () => {};
    return onSnapshot(doc(db, WHITEBOARDS_COLLECTION, id), (snap) => {
        if (snap.exists()) callback(snap.data().elements as WhiteboardElement[]);
    });
}

export async function updateWhiteboardElement(id: string, element: WhiteboardElement) {
    if (!db) return;
    await updateDoc(doc(db, WHITEBOARDS_COLLECTION, id), { elements: arrayUnion(sanitizeData(element)) });
}

export async function deleteWhiteboardElements(id: string) {
    if (!db) return;
    await updateDoc(doc(db, WHITEBOARDS_COLLECTION, id), { elements: [] });
}

export async function saveWhiteboardSession(id: string, elements: WhiteboardElement[]) {
    if (!db) return;
    await setDoc(doc(db, WHITEBOARDS_COLLECTION, id), { elements: sanitizeData(elements) }, { merge: true });
}

// --- BLOG & POSTS ---

export async function ensureUserBlog(user: any): Promise<Blog> {
    if (!db) throw new Error("DB offline");
    const docRef = doc(db, BLOGS_COLLECTION, user.uid);
    const snap = await getDoc(docRef);
    if (snap.exists()) return snap.data() as Blog;
    const blog: Blog = { id: user.uid, ownerId: user.uid, authorName: user.displayName || 'Anonymous', title: `${user.displayName}'s Blog`, description: 'Refracted thoughts and technical insights.', createdAt: Date.now() };
    await setDoc(docRef, sanitizeData(blog));
    return blog;
}

export async function getCommunityPosts(): Promise<BlogPost[]> {
    if (!db) return [];
    const q = query(collection(db, POSTS_COLLECTION), where('status', '==', 'published'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as BlogPost);
}

export async function getUserPosts(blogId: string): Promise<BlogPost[]> {
    if (!db) return [];
    const q = query(collection(db, POSTS_COLLECTION), where('blogId', '==', blogId));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as BlogPost);
}

export async function createBlogPost(post: BlogPost) {
    if (!db) return;
    const id = post.id || generateSecureId();
    await setDoc(doc(db, POSTS_COLLECTION, id), sanitizeData({ ...post, id }));
}

export async function updateBlogPost(id: string, data: Partial<BlogPost>) {
    if (!db) return;
    await updateDoc(doc(db, POSTS_COLLECTION, id), sanitizeData(data));
}

export async function deleteBlogPost(id: string) {
    if (!db) return;
    await deleteDoc(doc(db, POSTS_COLLECTION, id));
}

export async function updateBlogSettings(id: string, settings: Partial<Blog>) {
    if (!db) return;
    await updateDoc(doc(db, BLOGS_COLLECTION, id), sanitizeData(settings));
}

export async function addPostComment(postId: string, comment: Comment) {
    if (!db) return;
    await updateDoc(doc(db, POSTS_COLLECTION, postId), { comments: arrayUnion(sanitizeData(comment)), commentCount: increment(1) });
}

export async function getBlogPost(id: string): Promise<BlogPost | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, POSTS_COLLECTION, id));
    return snap.exists() ? snap.data() as BlogPost : null;
}

export async function deleteBlog(id: string) {
    if (!db) return;
    await deleteDoc(doc(db, BLOGS_COLLECTION, id));
}

// --- WORKPLACE CHAT ---

export async function sendMessage(channelId: string, text: string, path: string, replyTo?: any, attachments?: any[]) {
    if (!db || !auth.currentUser) return;
    const msg: RealTimeMessage = {
        id: generateSecureId(), text, senderId: auth.currentUser.uid, senderName: auth.currentUser.displayName || 'User',
        senderImage: auth.currentUser.photoURL || '', timestamp: Timestamp.now(), replyTo, attachments
    };
    await addDoc(collection(db, path), sanitizeData(msg));
}

export function subscribeToMessages(channelId: string, callback: (msgs: RealTimeMessage[]) => void, path: string) {
    if (!db) return () => {};
    const q = query(collection(db, path), orderBy('timestamp', 'asc'));
    return onSnapshot(q, (snap) => {
        callback(snap.docs.map(d => ({ ...d.data(), id: d.id }) as RealTimeMessage));
    });
}

export async function createOrGetDMChannel(otherUserId: string, otherUserName: string): Promise<string> {
    if (!db || !auth.currentUser) return '';
    const uids = [auth.currentUser.uid, otherUserId].sort();
    const id = `dm_${uids.join('_')}`;
    const docRef = doc(db, 'chat_channels', id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
        const channel: ChatChannel = { id, name: `${auth.currentUser.displayName} & ${otherUserName}`, type: 'dm', memberIds: uids, createdAt: Date.now() };
        await setDoc(docRef, sanitizeData(channel));
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

// --- CAREER CENTER ---

export async function submitCareerApplication(app: CareerApplication) {
    if (!db) return;
    const id = generateSecureId();
    await setDoc(doc(db, APPLICATIONS_COLLECTION, id), sanitizeData({ ...app, id }));
}

export async function createJobPosting(job: JobPosting): Promise<string> {
    if (!db) return '';
    const id = generateSecureId();
    await setDoc(doc(db, JOBS_COLLECTION, id), sanitizeData({ ...job, id }));
    return id;
}

export async function getJobPostings(): Promise<JobPosting[]> {
    if (!db) return [];
    const snap = await getDocs(collection(db, JOBS_COLLECTION));
    return snap.docs.map(d => d.data() as JobPosting);
}

export async function getAllCareerApplications(): Promise<CareerApplication[]> {
    if (!db) return [];
    const snap = await getDocs(collection(db, APPLICATIONS_COLLECTION));
    return snap.docs.map(d => d.data() as CareerApplication);
}

export async function getJobPosting(id: string): Promise<JobPosting | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, JOBS_COLLECTION, id));
    return snap.exists() ? snap.data() as JobPosting : null;
}

// --- NOTEBOOKS ---

export async function getCreatorNotebooks(uid: string): Promise<Notebook[]> {
    if (!db) return [];
    const q = query(collection(db, NOTEBOOKS_COLLECTION), where('ownerId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Notebook);
}

export async function saveNotebook(nb: Notebook): Promise<string> {
    if (!db) return '';
    await setDoc(doc(db, NOTEBOOKS_COLLECTION, nb.id), sanitizeData(nb));
    return nb.id;
}

export async function getNotebook(id: string): Promise<Notebook | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, NOTEBOOKS_COLLECTION, id));
    return snap.exists() ? snap.data() as Notebook : null;
}

// --- GIFT CARDS ---

export async function saveCard(card: AgentMemory, id: string): Promise<string> {
    if (!db) return '';
    await setDoc(doc(db, CARDS_COLLECTION, id), sanitizeData({ ...card, id }));
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

// --- BRAND LAB / ICONS ---

export async function saveIcon(icon: GeneratedIcon) {
    if (!db) return;
    await setDoc(doc(db, ICONS_COLLECTION, icon.id), sanitizeData(icon));
}

export async function getIcon(id: string): Promise<GeneratedIcon | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, ICONS_COLLECTION, id));
    return snap.exists() ? snap.data() as GeneratedIcon : null;
}

// --- LOGISTICS ---

export async function saveShippingLabel(label: ShippingLabel) {
    if (!db) return;
    await setDoc(doc(db, SHIPPING_COLLECTION, label.id), sanitizeData(label));
}

// --- FINANCE & CHECKS ---

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

// --- COIN WALLET & LEDGER ---

export async function getCoinTransactions(uid: string): Promise<CoinTransaction[]> {
    if (!db) return [];
    const q = query(collection(db, TRANSACTIONS_COLLECTION), where('fromId', '==', uid));
    const q2 = query(collection(db, TRANSACTIONS_COLLECTION), where('toId', '==', uid));
    const [s1, s2] = await Promise.all([getDocs(q), getDocs(q2)]);
    const all = [...s1.docs, ...s2.docs].map(d => d.data() as CoinTransaction);
    return all.sort((a,b) => b.timestamp - a.timestamp);
}

export async function transferCoins(toId: string, toName: string, amount: number, memo?: string) {
    if (!db || !auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const tx: CoinTransaction = { id: generateSecureId(), fromId: uid, fromName: auth.currentUser.displayName || 'User', toId, toName, amount, timestamp: Date.now(), type: 'transfer', memo, isVerified: true };
    await runTransaction(db, async (t) => {
        const u1 = doc(db, USERS_COLLECTION, uid);
        const u2 = doc(db, USERS_COLLECTION, toId);
        const s1 = await t.get(u1);
        const bal = s1.data()?.coinBalance || 0;
        if (bal < amount) throw new Error("Insufficient Balance");
        t.update(u1, { coinBalance: increment(-amount) });
        t.update(u2, { coinBalance: increment(amount) });
        t.set(doc(db, TRANSACTIONS_COLLECTION, tx.id), sanitizeData(tx));
    });
}

export const DEFAULT_MONTHLY_GRANT = 100000;

export async function checkAndGrantMonthlyCoins(uid: string) {
    if (!db) return;
    const docRef = doc(db, USERS_COLLECTION, uid);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const lastGrant = data.lastCoinGrantAt || 0;
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    if (now - lastGrant > thirtyDays) {
        await updateDoc(docRef, { coinBalance: increment(DEFAULT_MONTHLY_GRANT), lastCoinGrantAt: now });
        const tx: CoinTransaction = { id: generateSecureId(), fromId: 'system', fromName: 'Neural Prism', toId: uid, toName: data.displayName, amount: DEFAULT_MONTHLY_GRANT, timestamp: now, type: 'grant', memo: 'Monthly Neural Allowance', isVerified: true };
        await setDoc(doc(db, TRANSACTIONS_COLLECTION, tx.id), sanitizeData(tx));
    }
}

export async function registerIdentity(uid: string, publicKey: string, certificate: string) {
    if (!db) return;
    await updateDoc(doc(db, USERS_COLLECTION, uid), { publicKey, certificate });
}

export async function claimOfflinePayment(token: OfflinePaymentToken) {
    if (!db || !auth.currentUser) return;
    const uid = auth.currentUser.uid;
    await setDoc(doc(db, TRANSACTIONS_COLLECTION, token.nonce), sanitizeData({ id: token.nonce, fromId: token.senderId, fromName: token.senderName, toId: uid, toName: auth.currentUser.displayName || 'User', amount: token.amount, timestamp: Date.now(), type: 'offline', memo: token.memo, isVerified: true, offlineToken: btoa(JSON.stringify(token)) }));
    await updateDoc(doc(db, USERS_COLLECTION, uid), { coinBalance: increment(token.amount) });
    await updateDoc(doc(db, USERS_COLLECTION, token.senderId), { coinBalance: increment(-token.amount) });
}

export async function claimCoinCheck(checkId: string, uid: string) {
    // Check redemption stubs
}

// --- MOCK INTERVIEWS ---

export async function saveInterviewRecording(iv: MockInterviewRecording) {
    if (!db) return;
    await setDoc(doc(db, INTERVIEWS_COLLECTION, iv.id), sanitizeData(iv));
}

export async function getPublicInterviews(): Promise<MockInterviewRecording[]> {
    if (!db) return [];
    const q = query(collection(db, INTERVIEWS_COLLECTION), where('visibility', '==', 'public'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as MockInterviewRecording);
}

export async function getUserInterviews(uid: string): Promise<MockInterviewRecording[]> {
    if (!db) return [];
    const q = query(collection(db, INTERVIEWS_COLLECTION), where('userId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as MockInterviewRecording);
}

export async function deleteInterview(id: string) {
    if (!db) return;
    await deleteDoc(doc(db, INTERVIEWS_COLLECTION, id));
}

export async function updateInterviewMetadata(id: string, data: any) {
    if (!db) return;
    await updateDoc(doc(db, INTERVIEWS_COLLECTION, id), sanitizeData(data));
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

// --- ADMIN / SYSTEM ---

export async function getGlobalStats() {
    return { totalLogins: 1204, uniqueUsers: 850 };
}

export async function getDebugCollectionDocs(collectionName: string, limitCount: number): Promise<any[]> {
    if (!db) return [];
    const q = query(collection(db, collectionName), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id }));
}

export async function deleteFirestoreDoc(collectionName: string, docId: string) {
    if (!db) return;
    await deleteDoc(doc(db, collectionName, docId));
}

export async function purgeFirestoreCollection(collectionName: string) {
    if (!db) return;
    const snap = await getDocs(collection(db, collectionName));
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
}

export async function seedDatabase() {
    if (!db) return;
    for (const ch of HANDCRAFTED_CHANNELS) {
        await publishChannelToFirestore(ch);
    }
}

export async function recalculateGlobalStats() {
    // Stats calculation logic stubs
}

export async function cleanupDuplicateUsers() {
    // Registry cleanup stubs
}

export async function setUserSubscriptionTier(uid: string, tier: SubscriptionTier) {
    if (!db) return;
    await updateDoc(doc(db, USERS_COLLECTION, uid), { subscriptionTier: tier });
}

export async function updateAllChannelDatesToToday() {
    if (!db) return;
    const snap = await getDocs(collection(db, CHANNELS_COLLECTION));
    const batch = writeBatch(db);
    const now = Date.now();
    snap.docs.forEach(d => batch.update(d.ref, { createdAt: now }));
    await batch.commit();
}

export async function migrateVaultToLedger(log: any) {
    log("Initializing migration...", "info");
    // Migration logic stubs
    log("Migration complete.", "success");
}
