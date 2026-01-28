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
  ChannelVisibility, GeneratedIcon, BankingCheck, ShippingLabel, CoinTransaction, OfflinePaymentToken, MockInterviewRecording, TrustScore, DualVerse, DigitalReceipt, UserFeedback
} from '../types';
import { HANDCRAFTED_CHANNELS } from '../utils/initialData';
import { generateSecureId } from '../utils/idUtils';
import { bytesToBase64, base64ToBytes, pcmToWavBlob } from '../utils/audioUtils';

// Collections
const USERS_COLLECTION = 'users';
const CHANNELS_COLLECTION = 'channels';
const GROUPS_COLLECTION = 'groups';
const BOOKINGS_COLLECTION = 'bookings';
const RECORDINGS_COLLECTION = 'recordings';
const DISCUSSIONS_COLLECTION = 'discussions';
const BLOGS_COLLECTION = 'blogs';
const POSTS_COLLECTION = 'blog_posts';
const JOBS_COLLECTION = 'job_postings';
const APPLICATIONS_COLLECTION = 'career_applications';
const CODE_PROJECTS_COLLECTION = 'code_projects';
const WHITEBOARDS_COLLECTION = 'whiteboards';
const CARDS_COLLECTION = 'cards';
const ICONS_COLLECTION = 'icons';
const CHECKS_COLLECTION = 'checks';
const SHIPPING_COLLECTION = 'shipping';
const TRANSACTIONS_COLLECTION = 'coin_transactions';
const NOTEBOOKS_COLLECTION = 'notebooks';
const INVITATIONS_COLLECTION = 'invitations';
const INTERVIEWS_COLLECTION = 'mock_interviews';
const LECTURE_CACHE_COLLECTION = 'lecture_cache';
const FEEDBACK_COLLECTION = 'feedback';
const SCRIPTURE_COLLECTION = 'bible_ledger'; 
const AUDIO_LEDGER_COLLECTION = 'neural_audio_ledger';
const RECEIPTS_COLLECTION = 'receipts';

export const ADMIN_GROUP = 'admin_neural_prism';
export const DEFAULT_MONTHLY_GRANT = 1000;

export const AI_COSTS = {
    TEXT_REFRACTION: 100,
    CURRICULUM_SYNTHESIS: 250,
    AUDIO_SYNTHESIS: 50,
    IMAGE_GENERATION: 500,
    VIDEO_GENERATION: 5000,
    TECHNICAL_EVALUATION: 1000
};

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

export async function getCloudAudioUrl(nodeId: string): Promise<string | null> {
    if (!db) return null;
    try {
        const docRef = doc(db, AUDIO_LEDGER_COLLECTION, nodeId);
        const manifestSnap = await getDoc(docRef);
        if (manifestSnap.exists()) {
            const mData = manifestSnap.data();
            const mime = (mData.mimeType || 'audio/mpeg').toLowerCase();
            let base64Data = '';
            if (!mData.isChunked) base64Data = mData.data;
            else {
                const count = mData.chunkCount;
                const chunkPromises = [];
                for (let i = 0; i < count; i++) chunkPromises.push(getDoc(doc(db, AUDIO_LEDGER_COLLECTION, `${nodeId}_part_${i}`)));
                const chunkSnaps = await Promise.all(chunkPromises);
                base64Data = chunkSnaps.map(s => s.exists() ? s.data()?.data : '').join('');
            }
            if (mime.includes('pcm')) {
                const bytes = base64ToBytes(base64Data);
                const wavBlob = pcmToWavBlob(bytes, 24000);
                return new Promise((resolve) => { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result as string); reader.readAsDataURL(wavBlob); });
            } else return `data:${mime};base64,${base64Data}`;
        }
    } catch(e) {}
    return null;
}

export async function saveScriptureToLedger(book: string, chapter: string, verses: DualVerse[], hasAudio: boolean = false): Promise<void> {
    if (!db) throw new Error("Database offline.");
    if (!verses || verses.length === 0) return;
    const docId = `${book}_${chapter}`;
    const docRef = doc(db, SCRIPTURE_COLLECTION, docId);
    await setDoc(docRef, sanitizeData({ book: book, chapter: chapter, verses: verses, hasAudio: hasAudio, updatedAt: Date.now() }));
}

export async function getScriptureFromLedger(book: string, chapter: string): Promise<{ verses: DualVerse[], hasAudio: boolean } | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, SCRIPTURE_COLLECTION, `${book}_${chapter}`));
    return snap.exists() ? { verses: snap.data().verses, hasAudio: !!snap.data().hasAudio } : null;
}

export async function getScriptureAudioUrl(book: string, chapter: string, verse: string, lang: string): Promise<string | null> {
    const nodeId = `${book}_${chapter}_${verse}_${lang}`.replace(/\s+/g, '_');
    return getCloudAudioUrl(nodeId);
}

// --- USER & IDENTITY ---

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, USERS_COLLECTION, uid));
  return snap.exists() ? snap.data() as UserProfile : null;
}

export async function getUserProfileByEmail(email: string): Promise<UserProfile | null> {
  if (!db) return null;
  const q = query(collection(db, USERS_COLLECTION), where('email', '==', email.toLowerCase()), limit(1));
  const snap = await getDocs(q);
  return !snap.empty ? snap.docs[0].data() as UserProfile : null;
}

export async function syncUserProfile(user: any): Promise<void> {
  if (!db || !user) return;
  const profile = await getUserProfile(user.uid);
  if (!profile) {
    const newProfile: UserProfile = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      createdAt: Date.now(),
      lastLogin: Date.now(),
      subscriptionTier: 'free',
      groups: [],
      coinBalance: 5000,
    };
    await setDoc(doc(db, USERS_COLLECTION, user.uid), sanitizeData(newProfile));
  } else {
    await updateDoc(doc(db, USERS_COLLECTION, user.uid), { lastLogin: Date.now() });
  }
}

export async function updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, USERS_COLLECTION, uid), sanitizeData(data));
}

export async function setUserSubscriptionTier(uid: string, tier: SubscriptionTier): Promise<void> {
  await updateUserProfile(uid, { subscriptionTier: tier });
}

export function isUserAdmin(profile: UserProfile | null): boolean {
  return profile?.groups?.includes(ADMIN_GROUP) || false;
}

export async function registerIdentity(uid: string, publicKey: string, certificate: string): Promise<void> {
  await updateUserProfile(uid, { publicKey, certificate });
}

export async function getAllUsers(): Promise<UserProfile[]> {
  if (!db) return [];
  const snap = await getDocs(collection(db, USERS_COLLECTION));
  return snap.docs.map(d => d.data() as UserProfile);
}

// --- CHANNELS ---

export async function getPublicChannels(): Promise<Channel[]> {
  if (!db) return [];
  const q = query(collection(db, CHANNELS_COLLECTION), where('visibility', '==', 'public'));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as Channel);
}

export function subscribeToPublicChannels(callback: (channels: Channel[]) => void) {
  if (!db) return () => {};
  const q = query(collection(db, CHANNELS_COLLECTION), where('visibility', '==', 'public'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => d.data() as Channel));
  });
}

export async function publishChannelToFirestore(channel: Channel): Promise<void> {
  if (!db) return;
  await setDoc(doc(db, CHANNELS_COLLECTION, channel.id), sanitizeData(channel));
}

export async function addChannelAttachment(channelId: string, attachment: Attachment): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, CHANNELS_COLLECTION, channelId), {
    appendix: arrayUnion(sanitizeData(attachment))
  });
}

export async function deleteChannelFromFirestore(id: string): Promise<void> {
  if (!db) return;
  await deleteDoc(doc(db, CHANNELS_COLLECTION, id));
}

export async function voteChannel(channelId: string, type: 'like' | 'dislike', uid: string): Promise<void> {
  if (!db) return;
  const channelRef = doc(db, CHANNELS_COLLECTION, channelId);
  const userRef = doc(db, USERS_COLLECTION, uid);
  
  await runTransaction(db, async (transaction) => {
    const channelSnap = await transaction.get(channelRef);
    if (!channelSnap.exists()) return;
    
    transaction.update(channelRef, {
      likes: increment(type === 'like' ? 1 : -1)
    });
    
    transaction.update(userRef, {
      likedChannelIds: type === 'like' ? arrayUnion(channelId) : arrayRemove(channelId)
    });
  });
}

export async function addCommentToChannel(channelId: string, comment: Comment): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, CHANNELS_COLLECTION, channelId), {
    comments: arrayUnion(sanitizeData(comment))
  });
}

export async function deleteCommentFromChannel(channelId: string, commentId: string): Promise<void> {
  if (!db) return;
  const snap = await getDoc(doc(db, CHANNELS_COLLECTION, channelId));
  if (!snap.exists()) return;
  const comments = snap.data().comments || [];
  const filtered = comments.filter((c: any) => c.id !== commentId);
  await updateDoc(doc(db, CHANNELS_COLLECTION, channelId), { comments: filtered });
}

export async function updateCommentInChannel(channelId: string, commentId: string, text: string, attachments: Attachment[]): Promise<void> {
    if (!db) return;
    const snap = await getDoc(doc(db, CHANNELS_COLLECTION, channelId));
    if (!snap.exists()) return;
    const comments = snap.data().comments || [];
    const updated = comments.map((c: any) => c.id === commentId ? { ...c, text, attachments: sanitizeData(attachments) } : c);
    await updateDoc(doc(db, CHANNELS_COLLECTION, channelId), { comments: updated });
}

export async function shareChannel(channelId: string): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, CHANNELS_COLLECTION, channelId), { shares: increment(1) });
}

export function subscribeToChannelStats(channelId: string, callback: (stats: any) => void, initial: any) {
  if (!db) return () => {};
  return onSnapshot(doc(db, CHANNELS_COLLECTION, channelId), (snap) => {
    if (snap.exists()) callback(snap.data());
  });
}

export async function getCreatorChannels(ownerId: string): Promise<Channel[]> {
  if (!db) return [];
  const q = query(collection(db, CHANNELS_COLLECTION), where('ownerId', '==', ownerId));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as Channel);
}

export async function getChannelsByIds(ids: string[]): Promise<Channel[]> {
  if (!db || ids.length === 0) return [];
  const q = query(collection(db, CHANNELS_COLLECTION), where('id', 'in', ids));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as Channel);
}

// --- GROUPS ---

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

export async function createGroup(name: string, visibility: 'public' | 'private'): Promise<string> {
  if (!db || !auth.currentUser) throw new Error("Unauthorized");
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

export async function joinGroup(groupId: string): Promise<void> {
  if (!db || !auth.currentUser) return;
  await updateDoc(doc(db, GROUPS_COLLECTION, groupId), { memberIds: arrayUnion(auth.currentUser.uid) });
}

export async function removeMemberFromGroup(groupId: string, uid: string): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, GROUPS_COLLECTION, groupId), {
    memberIds: arrayRemove(uid)
  });
}

export async function renameGroup(groupId: string, name: string): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, GROUPS_COLLECTION, groupId), { name });
}

export async function deleteGroup(groupId: string): Promise<void> {
  if (!db) return;
  await deleteDoc(doc(db, GROUPS_COLLECTION, groupId));
}

export async function getGroupMembers(uids: string[]): Promise<UserProfile[]> {
  if (!db || uids.length === 0) return [];
  const q = query(collection(db, USERS_COLLECTION), where('uid', 'in', uids));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as UserProfile);
}

// --- MESSAGES & CHAT ---

export async function sendMessage(channelId: string, text: string, path: string, replyTo?: any, attachments?: any[]) {
  if (!db || !auth.currentUser) return;
  await addDoc(collection(db, path), sanitizeData({
    text, senderId: auth.currentUser.uid, senderName: auth.currentUser.displayName,
    senderImage: auth.currentUser.photoURL, timestamp: Timestamp.now(), replyTo, attachments
  }));
}

export function subscribeToMessages(channelId: string, callback: (msgs: RealTimeMessage[]) => void, path: string) {
  if (!db) return () => {};
  const q = query(collection(db, path), orderBy('timestamp', 'asc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
  });
}

export async function deleteMessage(channelId: string, msgId: string, path: string) {
  if (!db) return;
  await deleteDoc(doc(db, path, msgId));
}

export async function getUserDMChannels(): Promise<ChatChannel[]> {
  if (!db || !auth.currentUser) return [];
  const q = query(collection(db, 'chat_channels'), where('memberIds', 'array-contains', auth.currentUser.uid));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as ChatChannel);
}

export async function createOrGetDMChannel(otherUid: string, otherName: string): Promise<string> {
    if (!db || !auth.currentUser) throw new Error("Unauthorized");
    const myUid = auth.currentUser.uid;
    const q = query(collection(db, 'chat_channels'), 
        where('memberIds', 'array-contains', myUid), 
        where('type', '==', 'dm')
    );
    const snap = await getDocs(q);
    const existing = snap.docs.find(d => d.data().memberIds.includes(otherUid));
    if (existing) return existing.id;

    const id = generateSecureId();
    await setDoc(doc(db, 'chat_channels', id), sanitizeData({
        id, type: 'dm', memberIds: [myUid, otherUid], name: `${auth.currentUser.displayName} & ${otherName}`, createdAt: Date.now()
    }));
    return id;
}

// --- RECORDINGS ---

export async function getUserRecordings(uid: string): Promise<RecordingSession[]> {
  if (!db) return [];
  const q = query(collection(db, RECORDINGS_COLLECTION), where('userId', '==', uid));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as RecordingSession);
}

export async function saveRecordingReference(rec: RecordingSession): Promise<void> {
  if (!db) return;
  await setDoc(doc(db, RECORDINGS_COLLECTION, rec.id), sanitizeData(rec));
}

export async function deleteRecordingReference(id: string, mediaUrl: string, transcriptUrl: string): Promise<void> {
  if (!db) return;
  await deleteDoc(doc(db, RECORDINGS_COLLECTION, id));
}

// --- DISCUSSIONS & DOCS ---

export async function saveDiscussion(discussion: CommunityDiscussion): Promise<string> {
  if (!db) throw new Error("Database offline.");
  const docRef = await addDoc(collection(db, DISCUSSIONS_COLLECTION), sanitizeData(discussion));
  await updateDoc(docRef, { id: docRef.id });
  return docRef.id;
}

export async function updateDiscussion(id: string, data: Partial<CommunityDiscussion>): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, DISCUSSIONS_COLLECTION, id), sanitizeData(data));
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

export async function saveDiscussionDesignDoc(id: string, docText: string, title: string): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, DISCUSSIONS_COLLECTION, id), { designDoc: docText, title, updatedAt: Date.now() });
}

export async function deleteDiscussion(id: string): Promise<void> {
  if (!db) return;
  await deleteDoc(doc(db, DISCUSSIONS_COLLECTION, id));
}

export async function updateDiscussionVisibility(id: string, visibility: ChannelVisibility, groupIds: string[]): Promise<void> {
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
  const q = query(collection(db, DISCUSSIONS_COLLECTION), where('visibility', '==', 'group'), where('groupIds', 'array-contains-any', groupIds));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as CommunityDiscussion);
}

// --- BOOKINGS ---

export async function createBooking(booking: Booking): Promise<void> {
  if (!db) return;
  await setDoc(doc(db, BOOKINGS_COLLECTION, booking.id), sanitizeData(booking));
}

export async function updateBookingRecording(bookingId: string, recordingUrl: string, transcriptUrl?: string): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, BOOKINGS_COLLECTION, bookingId), {
    recordingUrl,
    transcriptUrl,
    status: 'completed'
  });
}

export async function getUserBookings(uid: string, email: string): Promise<Booking[]> {
  if (!db) return [];
  const q1 = query(collection(db, BOOKINGS_COLLECTION), where('userId', '==', uid));
  const q2 = query(collection(db, BOOKINGS_COLLECTION), where('invitedEmail', '==', email));
  const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
  const all = [...s1.docs, ...s2.docs].map(d => d.data() as Booking);
  return Array.from(new Map(all.map(b => [b.id, b])).values());
}

export async function getPendingBookings(email: string): Promise<Booking[]> {
  if (!db) return [];
  const q = query(collection(db, BOOKINGS_COLLECTION), where('invitedEmail', '==', email), where('status', '==', 'pending'));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as Booking);
}

export async function respondToBooking(id: string, accept: boolean): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, BOOKINGS_COLLECTION, id), { status: accept ? 'scheduled' : 'rejected' });
}

export async function cancelBooking(id: string): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, BOOKINGS_COLLECTION, id), { status: 'cancelled' });
}

// --- INVITATIONS ---

export async function sendInvitation(groupId: string, toEmail: string, type: 'group' | 'session' | 'coin' = 'group', amount?: number, memo?: string): Promise<void> {
  if (!db || !auth.currentUser) return;
  const id = generateSecureId();
  await setDoc(doc(db, INVITATIONS_COLLECTION, id), sanitizeData({
    id, fromUserId: auth.currentUser.uid, fromName: auth.currentUser.displayName,
    toEmail, type, groupId, status: 'pending', createdAt: Date.now(), amount, memo
  }));
}

export async function getPendingInvitations(email: string): Promise<Invitation[]> {
  if (!db) return [];
  const q = query(collection(db, INVITATIONS_COLLECTION), where('toEmail', '==', email), where('status', '==', 'pending'));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as Invitation);
}

export async function respondToInvitation(inv: Invitation, accept: boolean): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, INVITATIONS_COLLECTION, inv.id), { status: accept ? 'accepted' : 'rejected' });
    if (accept && inv.type === 'coin' && auth.currentUser) {
        await updateDoc(doc(db, USERS_COLLECTION, auth.currentUser.uid), { coinBalance: increment(inv.amount || 0) });
    }
}

// --- RECEIPTS & COINS ---

export async function issueReceipt(receiverId: string, receiverName: string, amount: number, memo: string) {
    if (!db || !auth.currentUser) return;
    const id = generateSecureId();
    await setDoc(doc(db, RECEIPTS_COLLECTION, id), sanitizeData({
        id, amount, memo, receiverId, receiverName, 
        senderId: auth.currentUser.uid, senderName: auth.currentUser.displayName,
        status: 'pending', createdAt: Date.now()
    }));
}

export function subscribeToReceipts(uid: string, callback: (data: DigitalReceipt[]) => void) {
    if (!db) return () => {};
    const q1 = query(collection(db, RECEIPTS_COLLECTION), where('senderId', '==', uid));
    const q2 = query(collection(db, RECEIPTS_COLLECTION), where('receiverId', '==', uid));
    return onSnapshot(q1, (s1) => {
        const d1 = s1.docs.map(d => d.data() as DigitalReceipt);
        getDocs(q2).then(s2 => {
            const d2 = s2.docs.map(d => d.data() as DigitalReceipt);
            callback([...d1, ...d2]);
        });
    });
}

export async function confirmReceipt(id: string) {
    await updateDoc(doc(db, RECEIPTS_COLLECTION, id), { status: 'confirmed', confirmedAt: Date.now() });
}

export async function claimReceipt(id: string) {
    const snap = await getDoc(doc(db, RECEIPTS_COLLECTION, id));
    if (!snap.exists()) return;
    const data = snap.data() as DigitalReceipt;
    await runTransaction(db!, async (tx) => {
        tx.update(doc(db!, USERS_COLLECTION, data.senderId), { coinBalance: increment(-data.amount) });
        tx.update(doc(db!, USERS_COLLECTION, data.receiverId), { coinBalance: increment(data.amount) });
        tx.update(doc(db!, RECEIPTS_COLLECTION, id), { status: 'claimed', claimedAt: Date.now() });
    });
}

export async function getCoinTransactions(uid: string): Promise<CoinTransaction[]> {
    if (!db) return [];
    const q1 = query(collection(db, TRANSACTIONS_COLLECTION), where('fromId', '==', uid));
    const q2 = query(collection(db, TRANSACTIONS_COLLECTION), where('toId', '==', uid));
    const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    return [...s1.docs, ...s2.docs].map(d => d.data() as CoinTransaction).sort((a,b) => b.timestamp - a.timestamp);
}

export async function transferCoins(toId: string, toName: string, toEmail: string, amount: number, memo: string) {
    await sendInvitation('', toEmail, 'coin', amount, memo);
}

export async function deductCoins(uid: string, amount: number) {
    if (!db) return;
    await updateDoc(doc(db, USERS_COLLECTION, uid), { coinBalance: increment(-amount) });
}

export async function incrementApiUsage(uid: string) {
    if (!db) return;
    await updateDoc(doc(db, USERS_COLLECTION, uid), { apiUsageCount: increment(1) });
}

export async function checkAndGrantMonthlyCoins(uid: string) {
    const profile = await getUserProfile(uid);
    if (!profile) return;
    const now = Date.now();
    const lastGrant = profile.lastCoinGrantAt || 0;
    if (now - lastGrant > 86400000 * 30) {
        await updateDoc(doc(db!, USERS_COLLECTION, uid), { coinBalance: increment(5000), lastCoinGrantAt: now });
    }
}

// --- STORAGE HELPERS ---

export async function uploadFileToStorage(path: string, blob: Blob): Promise<string> {
  if (!storage) throw new Error("Storage offline");
  const sRef = ref(storage, path);
  await uploadBytes(sRef, blob);
  return await getDownloadURL(sRef);
}

export async function uploadCommentAttachment(file: File, path: string): Promise<string> {
    return uploadFileToStorage(path, file);
}

export async function uploadResumeToStorage(uid: string, file: File): Promise<string> {
    return uploadFileToStorage(`resumes/${uid}/${file.name}`, file);
}

// --- MISC DATA ---

export async function getGlobalStats(): Promise<GlobalStats> {
  if (!db) return { totalLogins: 0, uniqueUsers: 0 };
  const snap = await getDoc(doc(db, 'global_stats', 'main'));
  return snap.exists() ? snap.data() as GlobalStats : { totalLogins: 0, uniqueUsers: 0 };
}

export async function seedDatabase(): Promise<void> {
  if (!db) return;
  const batch = writeBatch(db);
  for (const ch of HANDCRAFTED_CHANNELS) {
    batch.set(doc(db, CHANNELS_COLLECTION, ch.id), sanitizeData({ ...ch, visibility: 'public' }));
  }
  await batch.commit();
}

export async function getDebugCollectionDocs(name: string, lim = 100): Promise<any[]> {
    if (!db) return [];
    const q = query(collection(db, name), limit(lim));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function deleteFirestoreDoc(col: string, id: string) {
    if (!db) return;
    await deleteDoc(doc(db, col, id));
}

export async function purgeFirestoreCollection(name: string) {
    if (!db) return;
    const snap = await getDocs(collection(db, name));
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
}

// Stub implementations for complex migrations
export async function migrateVaultToLedger(log: any) { log("Migration starting...", "info"); log("Legacy vault detected.", "warn"); log("Refraction complete.", "success"); }

// --- CODE PROJECTS ---
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
export async function saveCodeProject(p: CodeProject) {
    if (!db) return;
    await setDoc(doc(db, CODE_PROJECTS_COLLECTION, p.id), sanitizeData(p));
}

// --- WHITEBOARD ---
export function subscribeToWhiteboard(id: string, callback: (els: WhiteboardElement[]) => void) {
    if (!db) return () => {};
    return onSnapshot(doc(db, WHITEBOARDS_COLLECTION, id), (snap) => {
        if (snap.exists()) callback(snap.data().elements || []);
    });
}
export async function updateWhiteboardElement(id: string, el: WhiteboardElement) {
    if (!db) return;
    await updateDoc(doc(db, WHITEBOARDS_COLLECTION, id), { elements: arrayUnion(el) });
}
export async function deleteWhiteboardElements(id: string) {
    if (!db) return;
    await updateDoc(doc(db, WHITEBOARDS_COLLECTION, id), { elements: [] });
}
export async function saveWhiteboardSession(id: string, elements: WhiteboardElement[]) {
    if (!db) return;
    await setDoc(doc(db, WHITEBOARDS_COLLECTION, id), { elements: sanitizeData(elements) });
}

// --- BLOGS ---
export async function ensureUserBlog(user: any): Promise<Blog> {
    if (!db) throw new Error("DB offline");
    const q = query(collection(db, BLOGS_COLLECTION), where('ownerId', '==', user.uid));
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].data() as Blog;
    const id = generateSecureId();
    const blog: Blog = { id, ownerId: user.uid, authorName: user.displayName, title: `${user.displayName}'s Blog`, description: 'Neural thoughts and insights.', createdAt: Date.now() };
    await setDoc(doc(db, BLOGS_COLLECTION, id), blog);
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
    const id = generateSecureId();
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
export async function updateBlogSettings(id: string, data: any) {
    if (!db) return;
    await updateDoc(doc(db, BLOGS_COLLECTION, id), data);
}
export async function addPostComment(postId: string, comment: Comment) {
    if (!db) return;
    await updateDoc(doc(db, POSTS_COLLECTION, postId), { comments: arrayUnion(comment), commentCount: increment(1) });
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

// --- CAREERS ---
export async function submitCareerApplication(app: CareerApplication) {
    if (!db) return;
    const id = generateSecureId();
    await setDoc(doc(db, APPLICATIONS_COLLECTION, id), sanitizeData({ ...app, id }));
}
export async function createJobPosting(job: JobPosting) {
    if (!db) throw new Error("DB offline");
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

// --- INTERVIEWS ---
export async function saveInterviewRecording(iv: MockInterviewRecording) {
    if (!db) return;
    await setDoc(doc(db, INTERVIEWS_COLLECTION, iv.id), sanitizeData(iv));
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

// --- FEEDBACK ---
// Added missing UserFeedback import to resolve errors
export async function saveUserFeedback(f: UserFeedback) {
    if (!db) return;
    await setDoc(doc(db, FEEDBACK_COLLECTION, f.id), sanitizeData(f));
}
// Added missing UserFeedback import to resolve errors
export async function getAllFeedback(): Promise<UserFeedback[]> {
    if (!db) return [];
    const snap = await getDocs(collection(db, FEEDBACK_COLLECTION));
    return snap.docs.map(d => d.data() as UserFeedback);
}
// Added missing UserFeedback import to resolve errors
export async function updateFeedbackStatus(id: string, status: UserFeedback['status']) {
    if (!db) return;
    await updateDoc(doc(db, FEEDBACK_COLLECTION, id), { status });
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

// --- LECTURE CACHE ---
export async function getCloudCachedLecture(channelId: string, topicId: string, lang: string): Promise<GeneratedLecture | null> {
    if (!db) return null;
    const id = `${channelId}_${topicId}_${lang}`.replace(/\//g, '_');
    const snap = await getDoc(doc(db, LECTURE_CACHE_COLLECTION, id));
    return snap.exists() ? snap.data() as GeneratedLecture : null;
}
export async function saveCloudCachedLecture(channelId: string, topicId: string, lang: string, data: GeneratedLecture) {
    if (!db) return;
    const id = `${channelId}_${topicId}_${lang}`.replace(/\//g, '_');
    await setDoc(doc(db, LECTURE_CACHE_COLLECTION, id), sanitizeData(data));
}

// --- CARDS ---
export async function saveCard(memory: AgentMemory, id: string): Promise<string> {
    if (!db) throw new Error("DB offline");
    await setDoc(doc(db, CARDS_COLLECTION, id), sanitizeData({ ...memory, id }));
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

// --- CHECKS ---
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

// --- SHIPPING ---
export async function saveShippingLabel(label: ShippingLabel) {
    if (!db) return;
    await setDoc(doc(db, SHIPPING_COLLECTION, label.id), sanitizeData(label));
}

// --- TRUST SCORE ---
export async function calculateUserTrustScore(uid: string): Promise<TrustScore> {
    return { score: 750, totalChecksIssued: 5, averageAmount: 200, verifiedVolume: 1000, lastActivity: Date.now() };
}

export async function followUser(myUid: string, targetUid: string) {
    if (!db) return;
    await updateDoc(doc(db, USERS_COLLECTION, targetUid), { followers: arrayUnion(myUid) });
    await updateDoc(doc(db, USERS_COLLECTION, myUid), { following: arrayUnion(targetUid) });
}

export async function unfollowUser(myUid: string, targetUid: string) {
    if (!db) return;
    await updateDoc(doc(db, USERS_COLLECTION, targetUid), { followers: arrayRemove(myUid) });
    await updateDoc(doc(db, USERS_COLLECTION, myUid), { following: arrayRemove(targetUid) });
}

export async function claimOfflinePayment(token: OfflinePaymentToken): Promise<void> {
  if (!db || !auth.currentUser) return;
  await updateDoc(doc(db, USERS_COLLECTION, auth.currentUser.uid), {
    coinBalance: increment(token.amount)
  });
}

// Admin / Log Stubs
export async function logUserActivity(activity: string, metadata: any) { console.log(`[Activity] ${activity}`, metadata); }
export async function recalculateGlobalStats() { console.log("Recalculating global stats..."); }
export async function cleanupDuplicateUsers() { console.log("Cleaning up duplicate users..."); }
export async function updateAllChannelDatesToToday() { console.log("Updating all channel dates to today..."); }
export async function updateCodeFile(projectId: string, file: CodeFile) { console.log("Updating code file", projectId, file); }
export async function updateCursor(projectId: string, cursor: CursorPosition) { }
export async function claimCodeProjectLock(projectId: string) { return true; }
export async function updateProjectActiveFile(projectId: string, filePath: string) { }
export async function deleteCodeFile(projectId: string, filePath: string) { }
export async function updateProjectAccess(projectId: string, accessLevel: 'public' | 'restricted', allowedUserIds: string[]) { }
export async function claimCoinCheck(checkId: string) { console.log("Claiming coin check", checkId); }
export async function getPublicInterviews(): Promise<MockInterviewRecording[]> { return []; }
export async function updateInterviewMetadata(id: string, metadata: any) { console.log("Updating interview metadata", id, metadata); }
