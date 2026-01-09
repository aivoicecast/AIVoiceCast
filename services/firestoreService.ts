// FIXED: Ensuring standard modular imports for Firestore
import { 
    doc, setDoc, getDoc, updateDoc, deleteDoc, 
    query, collection, where, orderBy, limit, 
    getDocs, onSnapshot, runTransaction, increment, 
    Timestamp, arrayUnion, arrayRemove, addDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, auth, storage } from './firebaseConfig';
import { 
  UserProfile, Channel, ChannelStats, Comment, Attachment, Group, ChatChannel, RealTimeMessage, 
  CommunityDiscussion, Booking, Invitation, RecordingSession, CodeProject, 
  CodeFile, CursorPosition, WhiteboardElement, Blog, BlogPost, JobPosting, 
  CareerApplication, Notebook, BankingCheck, ShippingLabel, CoinTransaction, MockInterviewRecording, SubscriptionTier,
  ChannelVisibility, AgentMemory, CloudItem 
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
const CARDS_COLLECTION = 'cards';
const ICONS_COLLECTION = 'icons';
const CHECKS_COLLECTION = 'checks';
const SHIPPING_COLLECTION = 'shipping';
const TRANSACTIONS_COLLECTION = 'coin_transactions';
const NOTEBOOKS_COLLECTION = 'notebooks';
const INVITATIONS_COLLECTION = 'invitations';
const INTERVIEWS_COLLECTION = 'mock_interviews';

export const ADMIN_EMAILS = ['shengliang.song.ai@gmail.com'];
export const ADMIN_EMAIL = ADMIN_EMAILS[0];

// FIXED: Defined missing constant used for monthly coin grants
export const DEFAULT_MONTHLY_GRANT = 100;

/**
 * Robustly sanitizes data for Firestore, stripping non-serializable fields
 * and preventing circular reference errors.
 */
const sanitizeData = (data: any) => { 
    if (!data) return data;
    return JSON.parse(JSON.stringify(data, (key, value) => {
        if (value instanceof HTMLElement || value instanceof MediaStream || (typeof AudioContext !== 'undefined' && value instanceof AudioContext)) return undefined;
        return value;
    }));
};

// --- API Usage & Stats ---
export async function incrementApiUsage(uid: string): Promise<void> {
    if (!db) return;
    const userRef = doc(db, USERS_COLLECTION, uid);
    try {
        await updateDoc(userRef, { apiUsageCount: increment(1) });
    } catch (e) {
        console.warn("Could not increment API usage", e);
    }
}

export async function getGlobalStats() {
    if (!db) return { totalLogins: 0, uniqueUsers: 0 };
    const snap = await getDoc(doc(db, 'stats', 'global'));
    return snap.exists() ? snap.data() : { totalLogins: 0, uniqueUsers: 0 };
}

// --- User Profile & Auth Sync ---
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, USERS_COLLECTION, uid));
    return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function getUserProfileByEmail(email: string): Promise<UserProfile | null> {
    if (!db) return null;
    const q = query(collection(db, USERS_COLLECTION), where('email', '==', email.toLowerCase()), limit(1));
    const snap = await getDocs(q);
    return !snap.empty ? (snap.docs[0].data() as UserProfile) : null;
}

export async function syncUserProfile(user: any): Promise<UserProfile | null> {
    if (!db) return null;
    const userRef = doc(db, USERS_COLLECTION, user.uid);
    const snap = await getDoc(userRef);
    const now = Date.now();
    
    const profileUpdate: any = {
        uid: user.uid,
        email: user.email?.toLowerCase(),
        displayName: user.displayName,
        photoURL: user.photoURL,
        lastLogin: now,
    };

    if (!snap.exists()) {
        const newProfile: UserProfile = {
            ...profileUpdate,
            createdAt: now,
            subscriptionTier: 'free',
            apiUsageCount: 0,
            groups: [],
            coinBalance: 100, 
        } as UserProfile;
        await setDoc(userRef, newProfile);
        await updateDoc(doc(db, 'stats', 'global'), { uniqueUsers: increment(1) });
        return newProfile;
    } else {
        await updateDoc(userRef, profileUpdate);
        return { ...snap.data(), ...profileUpdate } as UserProfile;
    }
}

export async function updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, USERS_COLLECTION, uid), sanitizeData(data));
}

export async function registerIdentity(uid: string, publicKey: string, certificate: string): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, USERS_COLLECTION, uid), { publicKey, certificate });
}

export async function setUserSubscriptionTier(uid: string, tier: SubscriptionTier): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, USERS_COLLECTION, uid), { subscriptionTier: tier });
}

export async function getAllUsers(): Promise<UserProfile[]> {
    if (!db) return [];
    const snap = await getDocs(collection(db, USERS_COLLECTION));
    return snap.docs.map(d => d.data() as UserProfile);
}

// --- Channel Management ---
export function subscribeToPublicChannels(callback: (channels: Channel[]) => void) {
    if (!db) return () => {};
    const q = query(collection(db, CHANNELS_COLLECTION), where('visibility', '==', 'public'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
        callback(snapshot.docs.map(d => ({ ...d.data(), id: d.id }) as Channel));
    });
}

export async function publishChannelToFirestore(channel: Channel): Promise<void> {
    if (!db) return;
    await setDoc(doc(db, CHANNELS_COLLECTION, channel.id), sanitizeData({ ...channel, visibility: 'public' }));
}

export async function getPublicChannels(): Promise<Channel[]> {
    if (!db) return [];
    const q = query(collection(db, CHANNELS_COLLECTION), where('visibility', '==', 'public'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id }) as Channel);
}

export async function getCreatorChannels(uid: string): Promise<Channel[]> {
    if (!db) return [];
    const q = query(collection(db, CHANNELS_COLLECTION), where('ownerId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id }) as Channel);
}

export async function getChannelsByIds(ids: string[]): Promise<Channel[]> {
    if (!db || ids.length === 0) return [];
    const results: Channel[] = [];
    for (let i = 0; i < ids.length; i += 10) {
        const chunk = ids.slice(i, i + 10);
        const q = query(collection(db, CHANNELS_COLLECTION), where('id', 'in', chunk));
        const snap = await getDocs(q);
        results.push(...snap.docs.map(d => d.data() as Channel));
    }
    return results;
}

export async function deleteChannelFromFirestore(id: string): Promise<void> {
    if (!db) return;
    await deleteDoc(doc(db, CHANNELS_COLLECTION, id));
}

export async function voteChannel(channel: Channel, type: 'like' | 'dislike'): Promise<void> {
    if (!db || !auth?.currentUser) return;
    const uid = auth.currentUser.uid;
    const channelRef = doc(db, CHANNELS_COLLECTION, channel.id);
    const userRef = doc(db, USERS_COLLECTION, uid);

    await runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) return;
        const userData = userSnap.data() as UserProfile;
        const likedIds = userData.likedChannelIds || [];

        if (type === 'like' && !likedIds.includes(channel.id)) {
            transaction.update(channelRef, { likes: increment(1) });
            transaction.update(userRef, { likedChannelIds: arrayUnion(channel.id) });
        } else if (type === 'dislike' && likedIds.includes(channel.id)) {
            transaction.update(channelRef, { likes: increment(-1) });
            transaction.update(userRef, { likedChannelIds: arrayRemove(channel.id) });
        }
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
    if (snap.exists()) {
        const comments = snap.data().comments || [];
        const filtered = comments.filter((c: Comment) => c.id !== commentId);
        await updateDoc(doc(db, CHANNELS_COLLECTION, channelId), { comments: filtered });
    }
}

export async function updateCommentInChannel(channelId: string, updatedComment: Comment): Promise<void> {
    if (!db) return;
    const snap = await getDoc(doc(db, CHANNELS_COLLECTION, channelId));
    if (snap.exists()) {
        const comments = snap.data().comments || [];
        const next = comments.map((c: Comment) => c.id === updatedComment.id ? sanitizeData(updatedComment) : c);
        await updateDoc(doc(db, CHANNELS_COLLECTION, channelId), { comments: next });
    }
}

export async function shareChannel(channelId: string): Promise<void> {
    if (!db) return;
    const statsRef = doc(db, CHANNEL_STATS_COLLECTION, channelId);
    await setDoc(statsRef, { shares: increment(1) }, { merge: true });
}

export function subscribeToChannelStats(channelId: string, callback: (stats: Partial<ChannelStats>) => void, initial: ChannelStats) {
    if (!db) return () => {};
    return onSnapshot(doc(db, CHANNEL_STATS_COLLECTION, channelId), (snap) => {
        if (snap.exists()) callback(snap.data());
        else callback(initial);
    });
}

// --- Discussions & Documents ---
export async function saveDiscussion(discussion: CommunityDiscussion): Promise<string> {
    if (!db) return discussion.id;
    const id = discussion.id || generateSecureId();
    await setDoc(doc(db, DISCUSSIONS_COLLECTION, id), sanitizeData({ ...discussion, id }));
    return id;
}

export async function updateDiscussion(id: string, data: Partial<CommunityDiscussion>): Promise<void> {
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
    return onSnapshot(doc(db, DISCUSSIONS_COLLECTION, id), (snap) => {
        if (snap.exists()) callback(snap.data() as CommunityDiscussion);
    });
}

export async function saveDiscussionDesignDoc(id: string, designDoc: string, title: string): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, DISCUSSIONS_COLLECTION, id), { designDoc, title, updatedAt: Date.now() });
}

export async function getUserDesignDocs(uid: string): Promise<CommunityDiscussion[]> {
    if (!db) return [];
    const q = query(collection(db, DISCUSSIONS_COLLECTION), where('userId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as CommunityDiscussion);
}

export async function getPublicDesignDocs(): Promise<CommunityDiscussion[]> {
    if (!db) return [];
    const q = query(collection(db, DISCUSSIONS_COLLECTION), where('visibility', '==', 'public'), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as CommunityDiscussion);
}

export async function getGroupDesignDocs(groupIds: string[]): Promise<CommunityDiscussion[]> {
    if (!db || groupIds.length === 0) return [];
    const q = query(collection(db, DISCUSSIONS_COLLECTION), where('groupIds', 'array-contains-any', groupIds.slice(0, 10)));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as CommunityDiscussion);
}

export async function deleteDiscussion(id: string): Promise<void> {
    if (!db) return;
    await deleteDoc(doc(db, DISCUSSIONS_COLLECTION, id));
}

export async function updateDiscussionVisibility(id: string, visibility: ChannelVisibility, groupIds?: string[]): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, DISCUSSIONS_COLLECTION, id), { visibility, groupIds: groupIds || [] });
}

export async function linkDiscussionToLectureSegment(channelId: string, lectureId: string, segmentIndex: number, discussionId: string): Promise<void> {
    if (!db) return;
    const path = `${CHANNELS_COLLECTION}/${channelId}/lectures/${lectureId}`;
    await setDoc(doc(db, path), { [`segment_${segmentIndex}_discussion`]: discussionId }, { merge: true });
}

// --- Groups & Invitations ---
export async function createGroup(name: string): Promise<string> {
    if (!db || !auth?.currentUser) throw new Error("Database unavailable");
    const id = generateSecureId();
    const group: Group = {
        id, name, ownerId: auth.currentUser.uid,
        memberIds: [auth.currentUser.uid], createdAt: Date.now()
    };
    await setDoc(doc(db, GROUPS_COLLECTION, id), sanitizeData(group));
    return id;
}

export async function getUserGroups(uid: string): Promise<Group[]> {
    if (!db) return [];
    const q = query(collection(db, GROUPS_COLLECTION), where('memberIds', 'array-contains', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Group);
}

export async function getGroupMembers(uids: string[]): Promise<UserProfile[]> {
    if (!db || uids.length === 0) return [];
    const results: UserProfile[] = [];
    for (let i = 0; i < uids.length; i += 10) {
        const chunk = uids.slice(i, i + 10);
        const q = query(collection(db, USERS_COLLECTION), where('uid', 'in', chunk));
        const snap = await getDocs(q);
        results.push(...snap.docs.map(d => d.data() as UserProfile));
    }
    return results;
}

export async function removeMemberFromGroup(groupId: string, uid: string): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, GROUPS_COLLECTION, groupId), {
        memberIds: arrayRemove(uid)
    });
}

export async function deleteGroup(id: string): Promise<void> {
    if (!db) return;
    await deleteDoc(doc(db, GROUPS_COLLECTION, id));
}

export async function renameGroup(id: string, name: string): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, GROUPS_COLLECTION, id), { name });
}

export async function sendInvitation(groupId: string, toEmail: string): Promise<void> {
    if (!db || !auth?.currentUser) return;
    const groupSnap = await getDoc(doc(db, GROUPS_COLLECTION, groupId));
    if (!groupSnap.exists()) throw new Error("Group not found");
    const group = groupSnap.data() as Group;

    const id = generateSecureId();
    const inv: Invitation = {
        id, fromUserId: auth.currentUser.uid, fromName: auth.currentUser.displayName || 'Friend',
        toEmail: toEmail.toLowerCase(), groupId, groupName: group.name, status: 'pending', createdAt: Date.now(), type: 'group'
    };
    await setDoc(doc(db, INVITATIONS_COLLECTION, id), sanitizeData(inv));
}

export async function getPendingInvitations(email: string): Promise<Invitation[]> {
    if (!db) return [];
    const q = query(collection(db, INVITATIONS_COLLECTION), where('toEmail', '==', email.toLowerCase()), where('status', '==', 'pending'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Invitation);
}

export async function respondToInvitation(invite: Invitation, accept: boolean): Promise<void> {
    if (!db || !auth?.currentUser) return;
    const uid = auth.currentUser.uid;
    const invRef = doc(db, INVITATIONS_COLLECTION, invite.id);
    
    if (accept && invite.groupId && invite.type === 'group') {
        await updateDoc(doc(db, GROUPS_COLLECTION, invite.groupId), {
            memberIds: arrayUnion(uid)
        });
    }
    await updateDoc(invRef, { status: accept ? 'accepted' : 'rejected' });
}

// --- Realtime Chat ---
export function subscribeToMessages(channelId: string, callback: (msgs: RealTimeMessage[]) => void, customPath?: string) {
    if (!db) return () => {};
    const path = customPath || `chat_channels/${channelId}/messages`;
    const q = query(collection(db, path), orderBy('timestamp', 'asc'), limit(100));
    return onSnapshot(q, (snapshot) => {
        callback(snapshot.docs.map(d => ({ ...d.data(), id: d.id }) as RealTimeMessage));
    });
}

export async function sendMessage(channelId: string, text: string, customPath?: string, replyTo?: any, attachments?: any[]): Promise<void> {
    if (!db || !auth?.currentUser) return;
    const path = customPath || `chat_channels/${channelId}/messages`;
    await addDoc(collection(db, path), sanitizeData({
        text, senderId: auth.currentUser.uid, senderName: auth.currentUser.displayName,
        senderImage: auth.currentUser.photoURL, timestamp: Timestamp.now(), replyTo, attachments
    }));
}

export async function deleteMessage(channelId: string, msgId: string, customPath?: string): Promise<void> {
    if (!db) return;
    const path = customPath || `chat_channels/${channelId}/messages`;
    await deleteDoc(doc(db, path, msgId));
}

export async function createOrGetDMChannel(otherUserId: string, otherUserName: string): Promise<string> {
    if (!db || !auth?.currentUser) throw new Error("Auth required");
    const myId = auth.currentUser.uid;
    const myName = auth.currentUser.displayName;
    const participants = [myId, otherUserId].sort();
    const channelId = `dm-${participants.join('-')}`;
    
    const channelRef = doc(db, 'chat_channels', channelId);
    const snap = await getDoc(channelRef);
    
    if (!snap.exists()) {
        const newChannel: ChatChannel = {
            id: channelId, name: `${myName} & ${otherUserName}`, type: 'dm',
            memberIds: participants, createdAt: Date.now()
        };
        await setDoc(channelRef, sanitizeData(newChannel));
    }
    return channelId;
}

export async function getUserDMChannels(): Promise<ChatChannel[]> {
    if (!db || !auth?.currentUser) return [];
    const q = query(collection(db, 'chat_channels'), where('memberIds', 'array-contains', auth.currentUser.uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as ChatChannel);
}

// --- Bookings ---
export async function createBooking(booking: Booking): Promise<string> {
    if (!db) return '';
    const id = generateSecureId();
    await setDoc(doc(db, BOOKINGS_COLLECTION, id), sanitizeData({ ...booking, id }));
    return id;
}

export async function getUserBookings(uid: string, email?: string): Promise<Booking[]> {
    if (!db) return [];
    const q1 = query(collection(db, BOOKINGS_COLLECTION), where('userId', '==', uid));
    const snap1 = await getDocs(q1);
    let all = snap1.docs.map(d => ({ ...d.data(), id: d.id } as Booking));
    if (email) {
        const q2 = query(collection(db, BOOKINGS_COLLECTION), where('invitedEmail', '==', email.toLowerCase()));
        const snap2 = await getDocs(q2);
        all = [...all, ...snap2.docs.map(d => ({ ...d.data(), id: d.id } as Booking))];
    }
    const uniqueMap = new Map<string, Booking>(all.map(b => [b.id, b]));
    return Array.from(uniqueMap.values());
}

export async function getPendingBookings(email: string): Promise<Booking[]> {
    if (!db) return [];
    const q = query(collection(db, BOOKINGS_COLLECTION), where('invitedEmail', '==', email.toLowerCase()), where('status', '==', 'pending'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Booking));
}

export async function respondToBooking(id: string, accept: boolean): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, BOOKINGS_COLLECTION, id), { status: accept ? 'scheduled' : 'rejected' });
}

export async function cancelBooking(id: string): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, BOOKINGS_COLLECTION, id), { status: 'cancelled' });
}

export async function updateBookingRecording(bookingId: string, recordingUrl: string, transcriptUrl: string): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, BOOKINGS_COLLECTION, bookingId), { recordingUrl, transcriptUrl, status: 'completed' });
}

export async function deleteBookingRecording(bookingId: string): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, BOOKINGS_COLLECTION, bookingId), { recordingUrl: null, transcriptUrl: null });
}

// --- Code Projects ---
export function subscribeToCodeProject(projectId: string, callback: (project: CodeProject) => void) {
    if (!db) return () => {};
    return onSnapshot(doc(db, CODE_PROJECTS_COLLECTION, projectId), (snap) => {
        if (snap.exists()) callback(snap.data() as CodeProject);
    });
}

export async function saveCodeProject(project: CodeProject): Promise<string> {
    if (!db) return project.id;
    await setDoc(doc(db, CODE_PROJECTS_COLLECTION, project.id), sanitizeData(project));
    return project.id;
}

export async function getCodeProject(id: string): Promise<CodeProject | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, CODE_PROJECTS_COLLECTION, id));
    return snap.exists() ? (snap.data() as CodeProject) : null;
}

export async function updateCodeFile(projectId: string, file: CodeFile): Promise<void> {
    if (!db) return;
    const snap = await getDoc(doc(db, CODE_PROJECTS_COLLECTION, projectId));
    if (snap.exists()) {
        const files = (snap.data().files || []) as CodeFile[];
        const next = files.map(f => f.path === file.path ? sanitizeData(file) : f);
        if (!files.some(f => f.path === file.path)) next.push(sanitizeData(file));
        await updateDoc(doc(db, CODE_PROJECTS_COLLECTION, projectId), { files: next, lastModified: Date.now() });
    }
}

export async function deleteCodeFile(projectId: string, filePath: string): Promise<void> {
    if (!db) return;
    const snap = await getDoc(doc(db, CODE_PROJECTS_COLLECTION, projectId));
    if (snap.exists()) {
        const files = snap.data().files || [];
        const next = files.filter((f: any) => f.path !== filePath);
        await updateDoc(doc(db, CODE_PROJECTS_COLLECTION, projectId), { files: next });
    }
}

export async function updateCursor(projectId: string, cursor: CursorPosition): Promise<void> {
    if (!db) return;
    await setDoc(doc(db, `${CODE_PROJECTS_COLLECTION}/${projectId}/cursors/${cursor.clientId}`), sanitizeData(cursor));
}

export async function updateProjectAccess(projectId: string, accessLevel: 'public' | 'restricted', allowedUids: string[]): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, CODE_PROJECTS_COLLECTION, projectId), { accessLevel, allowedUserIds: allowedUids });
}

export async function updateProjectActiveFile(projectId: string, path: string): Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 585: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 586: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 586: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 587: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 588: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 588: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 589: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 590: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 591: Property 'pre' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 591: Property 'pre' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 592: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 595: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 595: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 602: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 603: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 604: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 605: Property 'img' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 606: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 607: Property 'h2' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 607: Property 'h2' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 608: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 608: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 609: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 610: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 611: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 613: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 614: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 615: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 615: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 616: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 618: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 620: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 621: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 621: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 622: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 623: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 626: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 627: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 629: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 629: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 630: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 631: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 632: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 634: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 635: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 635: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 636: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 637: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 641: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 642: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 644: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 645: Property 'video' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 652: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 656: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 657: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 658: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 658: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 659: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 659: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 660: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 661: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 663: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 663: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 665: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 666: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 666: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 667: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 667: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 668: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 670: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 671: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 675: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 677: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 679: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 679: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 680: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 683: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 683: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 684: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 685: Property 'h3' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 685: Property 'h3' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 686: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 686: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 687: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 688: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 688: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 689: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 689: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 690: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 691: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 692: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 692: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 695: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 697: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 699: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 699: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 700: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 700: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 700: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 700: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 701: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 703: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 705: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 706: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 707: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 708: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 713: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 713: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 714: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 715: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 716: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 716: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 717: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 717: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 718: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 719: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 722: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 723: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 725: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 725: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 726: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 728: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 733: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 733: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 734: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 736: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 739: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 740: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 742: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 743: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 743: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 744: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 746: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 747: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 747: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 748: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 749: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 751: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 754: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 756: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 757: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 758: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 760: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 762: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 763: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 763: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 764: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 765: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 766: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 768: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 769: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 771: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 772: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 775: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 776: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 776: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 777: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 779: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 779: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 780: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 781: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 783: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 784: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 785: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 785: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 785: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 785: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 786: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 788: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 790: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 792: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 792: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 793: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 793: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 794: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 794: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 795: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 796: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 797: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/LiveSession.tsx on line 799: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 146: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 147: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 148: Property 'h2' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 148: Property 'h2' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 149: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 149: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 150: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 150: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 151: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 152: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 158: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 159: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 159: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 160: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 161: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 162: Property 'h2' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 164: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 164: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 165: Property 'h2' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 166: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 166: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 167: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 169: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 170: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 170: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 171: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 171: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 171: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 171: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 172: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 174: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 176: Property 'form' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 177: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 178: Property 'label' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 178: Property 'label' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 179: Property 'input' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 180: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 181: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 182: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 183: Property 'label' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 183: Property 'label' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 184: Property 'input' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 185: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 186: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 187: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 188: Property 'label' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 188: Property 'label' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 189: Property 'textarea' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 190: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 192: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 193: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 194: Property 'label' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 194: Property 'label' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 195: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 195: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 196: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 197: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 198: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 198: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 198: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 198: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 199: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 199: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 199: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 199: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 200: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 200: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 200: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 200: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 201: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 202: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 204: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 205: Property 'label' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 205: Property 'label' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 206: Property 'textarea' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 207: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 209: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 210: Property 'label' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 210: Property 'label' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 211: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 213: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 215: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 225: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 226: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 228: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 229: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 230: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 230: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 231: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 231: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 232: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 233: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 234: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 235: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 235: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 236: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 237: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 239: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 241: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 242: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 242: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 243: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 243: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 244: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 247: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 249: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 260: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 260: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 261: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 263: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 264: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 265: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 266: Property 'form' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 268: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 269: Property 'textarea' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 270: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 272: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 272: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 273: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 274: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 276: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 279: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 280: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 280: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 281: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 283: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CreateChannelModal.tsx on line 284: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 41: Module '"firebase/auth"' has no exported member 'onAuthStateChanged'.
- Error in file App.tsx on line 42: Module '"firebase/firestore"' has no exported member 'onSnapshot'.
- Error in file App.tsx on line 42: Module '"firebase/firestore"' has no exported member 'doc'.
- Error in file App.tsx on line 77: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 78: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 79: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 81: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 82: Property 'h1' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 82: Property 'h1' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 83: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 83: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 84: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 86: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 87: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 88: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 88: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 89: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 90: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 91: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 94: Property 'props' does not exist on type 'ErrorBoundary'.
- Error in file App.tsx on line 351: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 353: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 354: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 356: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 356: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 357: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 358: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 359: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 359: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 360: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 361: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 362: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 373: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 374: Property 'header' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 375: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 376: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 376: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 377: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 379: Property 'h1' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 379: Property 'h1' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 380: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 381: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 384: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 385: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 387: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 389: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 389: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 390: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 392: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 393: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 396: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 398: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 399: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 399: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 400: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 403: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 403: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 404: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 405: Property 'img' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 406: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 407: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 408: Property 'header' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 410: Property 'main' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 416: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 416: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 421: Property 'main' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 429: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 429: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 430: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 430: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file App.tsx on line 432: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 127: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 128: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 129: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 130: Property 'img' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 131: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 132: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 133: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 134: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 134: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 134: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 134: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 135: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 136: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 137: Property 'main' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 138: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 139: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 140: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 141: Property 'h3' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 141: Property 'h3' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 142: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 143: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 145: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 146: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 146: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 147: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 147: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 147: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 147: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 147: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 147: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 148: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 150: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 151: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 152: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 153: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 155: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 156: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 158: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 159: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 160: Property 'h3' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 160: Property 'h3' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 161: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 161: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 162: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 163: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 168: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 169: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 171: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 173: Property 'h3' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 173: Property 'h3' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 174: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 176: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 177: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 178: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 178: Property 'h2' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 178: Property 'h2' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 178: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 178: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 178: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 179: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 179: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 180: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 187: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 189: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 191: Property 'h3' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 191: Property 'h3' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 192: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 194: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 195: Property 'main' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PodcastDetail.tsx on line 200: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 152: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 153: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 155: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 156: Property 'h2' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 158: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 158: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 159: Property 'h2' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 160: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 162: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 163: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 165: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 167: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 168: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 169: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 169: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 170: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 172: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 173: Property 'code' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 175: Property 'code' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 176: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 182: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 183: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 184: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 186: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 187: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 189: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 190: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 191: Property 'h3' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 191: Property 'h3' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 192: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 192: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 193: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 194: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 195: Property 'h3' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 195: Property 'h3' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 196: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 198: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 199: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 200: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 202: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 203: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 205: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 205: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 206: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 207: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 208: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 214: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 214: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 215: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 216: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 222: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 222: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 223: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 224: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 225: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 227: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 229: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 230: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 232: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 232: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 233: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 234: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 235: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 241: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 241: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 242: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 243: Property 'label' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 247: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 247: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 248: Property 'input' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 249: Property 'label' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 250: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 251: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 254: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 262: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 262: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 263: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 266: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 267: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 268: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 273: Property 'svg' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 273: Property 'path' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 273: Property 'polyline' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 273: Property 'line' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 273: Property 'svg' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 276: Property 'svg' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 276: Property 'path' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 276: Property 'polyline' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 276: Property 'line' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DataSyncModal.tsx on line 276: Property 'svg' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 55: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 56: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 58: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 59: Property 'h2' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 61: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 61: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 62: Property 'h2' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 63: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 65: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 66: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 68: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 69: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 71: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 74: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 75: Property 'label' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 76: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 76: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 77: Property 'a' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 77: Property 'a' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 78: Property 'label' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 79: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 80: Property 'input' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 87: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 92: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 93: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 94: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 94: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 95: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 98: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 99: Property 'label' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 100: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 100: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 101: Property 'a' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 101: Property 'a' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 102: Property 'label' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 103: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 104: Property 'input' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 111: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 116: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 117: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 118: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 118: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 119: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 122: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 124: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 124: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 125: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 129: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 131: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 131: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 132: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 135: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 136: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 141: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 141: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 142: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 144: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 150: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 151: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 153: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 154: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ApiKeyModal.tsx on line 155: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file services/firebaseConfig.ts on line 3: Module '"firebase/auth"' has no exported member 'getAuth'.
- Error in file services/firebaseConfig.ts on line 3: Module '"firebase/auth"' has no exported member 'setPersistence'.
- Error in file services/firebaseConfig.ts on line 3: Module '"firebase/auth"' has no exported member 'browserLocalPersistence'.
- Error in file services/firebaseConfig.ts on line 3: Module '"firebase/auth"' has no exported member 'Auth'.
- Error in file services/firebaseConfig.ts on line 4: Module '"firebase/firestore"' has no exported member 'getFirestore'.
- Error in file services/firebaseConfig.ts on line 4: Module '"firebase/firestore"' has no exported member 'enableMultiTabIndexedDbPersistence'.
- Error in file services/firebaseConfig.ts on line 4: Module '"firebase/firestore"' has no exported member 'Firestore'.
- Error in file services/cloudService.ts on line 12: Module '"firebase/firestore"' has no exported member 'doc'.
- Error in file services/cloudService.ts on line 13: Module '"firebase/firestore"' has no exported member 'setDoc'.
- Error in file services/cloudService.ts on line 14: Module '"firebase/firestore"' has no exported member 'getDoc'.
- Error in file services/cloudService.ts on line 15: Module '"firebase/firestore"' has no exported member 'Timestamp'.
- Error in file components/DebugView.tsx on line 54: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 55: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 58: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 59: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 60: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 62: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 63: Property 'h1' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 63: Property 'h1' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 64: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 65: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 67: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 67: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 68: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 69: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 72: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 73: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 74: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 75: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 75: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 76: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 76: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 77: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 77: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 78: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 80: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 81: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 82: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 83: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 83: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 84: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 84: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 85: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 85: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 86: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 88: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 89: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 90: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 91: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 91: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 92: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 92: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 93: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 93: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 94: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 96: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 97: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 100: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 102: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 108: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 110: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 113: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 114: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 115: Property 'table' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 116: Property 'thead' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 117: Property 'tr' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 118: Property 'th' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 118: Property 'th' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 119: Property 'th' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 119: Property 'th' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 120: Property 'th' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 120: Property 'th' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 121: Property 'th' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 121: Property 'th' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 122: Property 'tr' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 123: Property 'thead' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 124: Property 'tbody' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 126: Property 'tr' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 127: Property 'td' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 127: Property 'td' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 128: Property 'td' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 128: Property 'td' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 129: Property 'td' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 129: Property 'td' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 130: Property 'td' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 131: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 136: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 137: Property 'td' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 138: Property 'tr' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 141: Property 'tr' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 142: Property 'td' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 142: Property 'td' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 143: Property 'tr' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 145: Property 'tbody' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 146: Property 'table' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 147: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 148: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 151: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 152: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 157: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 158: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 163: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 164: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 166: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/DebugView.tsx on line 167: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 61: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 62: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 65: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 66: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 67: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 69: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 70: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 71: Property 'h1' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 73: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 73: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 74: Property 'h1' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 75: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 75: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 76: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 77: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 78: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 80: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 80: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 81: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 82: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 85: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 86: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 86: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 89: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 89: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 90: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 95: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 98: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 101: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 102: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 103: Property 'table' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 104: Property 'thead' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 105: Property 'tr' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 106: Property 'th' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 106: Property 'th' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 107: Property 'th' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 107: Property 'th' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 108: Property 'th' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 108: Property 'th' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 109: Property 'th' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 109: Property 'th' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 110: Property 'tr' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 111: Property 'thead' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 112: Property 'tbody' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 114: Property 'tr' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 115: Property 'td' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 116: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 118: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 118: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 119: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 120: Property 'td' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 121: Property 'tr' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 125: Property 'tr' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 126: Property 'td' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 127: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 138: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 138: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 139: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 140: Property 'td' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 141: Property 'td' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 143: Property 'td' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 144: Property 'td' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 144: Property 'td' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 145: Property 'td' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 147: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 153: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 155: Property 'td' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 156: Property 'tr' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 160: Property 'tr' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 161: Property 'td' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 163: Property 'td' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 164: Property 'tr' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 166: Property 'tbody' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 167: Property 'table' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 168: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 169: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 171: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CloudDebugView.tsx on line 172: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file services/authService.ts on line 3: Module '"firebase/auth"' has no exported member 'GoogleAuthProvider'.
- Error in file services/authService.ts on line 4: Module '"firebase/auth"' has no exported member 'GithubAuthProvider'.
- Error in file services/authService.ts on line 5: Module '"firebase/auth"' has no exported member 'signInWithPopup'.
- Error in file services/authService.ts on line 6: Module '"firebase/auth"' has no exported member 'linkWithPopup'.
- Error in file services/authService.ts on line 7: Module '"firebase/auth"' has no exported member 'signOut'.
- Error in file services/authService.ts on line 9: Module '"firebase/auth"' has no exported member 'User'.
- Error in file components/UserAuth.tsx on line 4: Module '"firebase/auth"' has no exported member 'onAuthStateChanged'.
- Error in file components/UserAuth.tsx on line 49: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/UserAuth.tsx on line 51: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/UserAuth.tsx on line 56: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/UserAuth.tsx on line 57: Property 'img' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/UserAuth.tsx on line 62: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/UserAuth.tsx on line 68: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/UserAuth.tsx on line 69: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/UserAuth.tsx on line 74: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/UserAuth.tsx on line 79: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/UserAuth.tsx on line 79: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/UserAuth.tsx on line 80: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file services/firestoreService.ts on line 3: Module '"firebase/firestore"' has no exported member 'doc'.
- Error in file services/firestoreService.ts on line 3: Module '"firebase/firestore"' has no exported member 'setDoc'.
- Error in file services/firestoreService.ts on line 3: Module '"firebase/firestore"' has no exported member 'getDoc'.
- Error in file services/firestoreService.ts on line 3: Module '"firebase/firestore"' has no exported member 'updateDoc'.
- Error in file services/firestoreService.ts on line 3: Module '"firebase/firestore"' has no exported member 'deleteDoc'.
- Error in file services/firestoreService.ts on line 4: Module '"firebase/firestore"' has no exported member 'query'.
- Error in file services/firestoreService.ts on line 4: Module '"firebase/firestore"' has no exported member 'collection'.
- Error in file services/firestoreService.ts on line 4: Module '"firebase/firestore"' has no exported member 'where'.
- Error in file services/firestoreService.ts on line 4: Module '"firebase/firestore"' has no exported member 'orderBy'.
- Error in file services/firestoreService.ts on line 4: Module '"firebase/firestore"' has no exported member 'limit'.
- Error in file services/firestoreService.ts on line 5: Module '"firebase/firestore"' has no exported member 'getDocs'.
- Error in file services/firestoreService.ts on line 5: Module '"firebase/firestore"' has no exported member 'onSnapshot'.
- Error in file services/firestoreService.ts on line 5: Module '"firebase/firestore"' has no exported member 'runTransaction'.
- Error in file services/firestoreService.ts on line 5: Module '"firebase/firestore"' has no exported member 'increment'.
- Error in file services/firestoreService.ts on line 6: Module '"firebase/firestore"' has no exported member 'Timestamp'.
- Error in file services/firestoreService.ts on line 6: Module '"firebase/firestore"' has no exported member 'arrayUnion'.
- Error in file services/firestoreService.ts on line 6: Module '"firebase/firestore"' has no exported member 'arrayRemove'.
- Error in file services/firestoreService.ts on line 6: Module '"firebase/firestore"' has no exported member 'addDoc'.
- Error in file components/GroupManager.tsx on line 161: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 163: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 164: Property 'h2' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 166: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 166: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 167: Property 'h2' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 168: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 170: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 171: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 174: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 176: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 180: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 181: Property 'h3' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 181: Property 'h3' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 182: Property 'form' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 183: Property 'input' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 190: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 196: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 197: Property 'form' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 198: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 200: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 202: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 202: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 204: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 212: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 213: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 214: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 216: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 217: Property 'input' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 222: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 222: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 223: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 223: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 224: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 226: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 227: Property 'h4' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 227: Property 'h4' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 228: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 228: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 229: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 231: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 231: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 232: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 233: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 234: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 236: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 238: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 240: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 242: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 243: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 246: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 248: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 249: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 251: Property 'input' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 258: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 259: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 264: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 265: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 266: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 266: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 269: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 270: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 270: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 271: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 273: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 274: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 275: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 276: Property 'img' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 277: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 278: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 279: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 279: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 280: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 280: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 281: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 282: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 284: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 284: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 286: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 288: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 289: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 290: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 292: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 295: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 297: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/GroupManager.tsx on line 298: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 108: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 109: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 111: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 112: Property 'h2' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 113: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 113: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 114: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 115: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 115: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 116: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 116: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 117: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 118: Property 'h2' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 119: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 119: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 120: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 122: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 126: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 127: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 129: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 130: Property 'h3' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 130: Property 'h3' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 131: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 131: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 132: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 134: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 136: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 138: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 138: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 139: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 142: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 143: Property 'textarea' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 144: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 146: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 148: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 148: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 149: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 150: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 155: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 156: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 157: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 157: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 158: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 158: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 159: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 160: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 161: Property 'h3' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 161: Property 'h3' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 162: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 162: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 163: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 164: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 168: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 169: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 170: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 171: Property 'img' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 172: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 172: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 173: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 174: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 175: Property 'h3' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 175: Property 'h3' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 176: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 176: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 177: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 179: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 180: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 181: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 183: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 184: Property 'label' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 184: Property 'label' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 185: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 186: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 186: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 187: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 187: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 188: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 189: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 191: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 192: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 192: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 193: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 195: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 195: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 196: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 197: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 198: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 202: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 204: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 204: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 205: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 208: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 209: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/VoiceCreateModal.tsx on line 210: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 88: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 89: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 95: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 97: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 99: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 103: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 103: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 104: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 105: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 106: Property 'h3' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 106: Property 'h3' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 107: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 109: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 111: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 113: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 115: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 119: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 120: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 121: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 123: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 124: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 125: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 126: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 126: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 127: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 128: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 128: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 129: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 131: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 133: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 134: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 140: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 140: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 141: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 142: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 148: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 148: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 149: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 150: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 151: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 152: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 153: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 158: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 159: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 160: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 162: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 163: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 166: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 167: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 167: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 167: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 167: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 168: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 169: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 170: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 176: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 176: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 177: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 178: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 184: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 184: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 185: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 186: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 190: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 191: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 191: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 191: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 191: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 192: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 193: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 194: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 200: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 200: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 201: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 202: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 208: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 208: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 209: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 210: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 213: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 215: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 216: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 217: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 218: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 220: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 222: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 223: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/Notifications.tsx on line 226: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 103: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 104: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 105: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 106: Property 'h2' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 106: Property 'h2' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 107: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 107: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 108: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 110: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 111: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 111: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 111: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 111: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 112: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 112: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 112: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 112: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 113: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 115: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 117: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 118: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 119: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 120: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 121: Property 'label' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 121: Property 'label' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 122: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 122: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 123: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 124: Property 'input' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 125: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 126: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 127: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 128: Property 'label' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 128: Property 'label' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 129: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 129: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 130: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 131: Property 'textarea' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 132: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 133: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 134: Property 'label' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 134: Property 'label' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 135: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 137: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 143: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 143: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 144: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 146: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 147: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 148: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 150: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 151: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 152: Property 'label' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 152: Property 'label' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 153: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 154: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 154: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 154: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 154: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 155: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 155: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 155: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 155: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 156: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 156: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 156: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 156: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 157: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 158: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 159: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 161: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 162: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 163: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 165: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 165: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 166: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 167: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 167: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 168: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 169: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 171: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 173: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 174: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 174: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 175: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 177: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 177: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 178: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 179: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 180: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelSettingsModal.tsx on line 181: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 62: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 63: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 66: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 67: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 68: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 70: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 71: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 72: Property 'h1' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 74: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 74: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 75: Property 'h1' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 76: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 76: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 77: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 78: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 80: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 82: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 84: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 84: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 85: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 88: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 90: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 90: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 91: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 92: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 93: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 96: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 97: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 98: Property 'table' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 99: Property 'thead' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 100: Property 'tr' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 101: Property 'th' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 101: Property 'th' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 102: Property 'th' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 102: Property 'th' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 103: Property 'th' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 103: Property 'th' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 104: Property 'th' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 104: Property 'th' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 105: Property 'th' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 105: Property 'th' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 106: Property 'tr' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 107: Property 'thead' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 108: Property 'tbody' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 110: Property 'tr' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 111: Property 'td' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 112: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 113: Property 'img' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 114: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 114: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 115: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 116: Property 'td' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 117: Property 'td' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 118: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 119: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 119: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 120: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 120: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 121: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 122: Property 'td' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 123: Property 'td' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 125: Property 'td' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 126: Property 'td' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 128: Property 'td' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 129: Property 'td' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 132: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 138: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 140: Property 'td' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 141: Property 'tr' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 144: Property 'tr' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 145: Property 'td' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 147: Property 'td' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 148: Property 'tr' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 150: Property 'tbody' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 151: Property 'table' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 152: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 153: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 154: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/PublicChannelInspector.tsx on line 155: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 94: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 98: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 99: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 99: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 100: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 100: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 101: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 101: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 102: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 105: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 106: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 108: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 108: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 109: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 110: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 115: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 116: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 126: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 127: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 130: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 131: Property 'img' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 143: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 144: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 146: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 147: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 148: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 150: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 151: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 152: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 153: Property 'h3' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 153: Property 'h3' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 154: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 155: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 155: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 155: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 155: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 156: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 165: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 165: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 166: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 167: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 168: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 169: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 171: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 173: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 175: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 177: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 179: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 181: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 183: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 184: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 185: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 190: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 190: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 191: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 193: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 201: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 201: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 202: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 204: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 209: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 209: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 210: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 211: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 213: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 218: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 219: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 220: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/ChannelCard.tsx on line 221: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 64: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 64: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 65: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 66: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 67: Property 'img' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 68: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 68: Property 'h3' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 68: Property 'h3' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 68: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 68: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 68: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 69: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 71: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 72: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 73: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 73: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 73: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 73: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 74: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 75: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 75: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 75: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 75: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 75: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 75: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 76: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 77: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 77: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 77: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 77: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 77: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 77: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 77: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 77: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 78: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 78: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 78: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 78: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 79: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 79: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 79: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 79: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 80: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 80: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 80: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 80: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 81: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 81: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 81: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 81: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 81: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 82: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 83: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 83: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 83: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 83: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 83: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 83: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/StudioMenu.tsx on line 84: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CommentsModal.tsx on line 184: Property 'img' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CommentsModal.tsx on line 186: Property 'video' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CommentsModal.tsx on line 188: Property 'audio' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CommentsModal.tsx on line 191: Property 'a' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CommentsModal.tsx on line 192: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CommentsModal.tsx on line 194: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CommentsModal.tsx on line 195: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CommentsModal.tsx on line 196: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CommentsModal.tsx on line 196: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CommentsModal.tsx on line 197: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CommentsModal.tsx on line 197: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CommentsModal.tsx on line 198: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CommentsModal.tsx on line 199: Property 'a' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CommentsModal.tsx on line 206: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CommentsModal.tsx on line 207: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CommentsModal.tsx on line 210: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CommentsModal.tsx on line 211: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CommentsModal.tsx on line 213: Property 'h2' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CommentsModal.tsx on line 213: Property 'h2' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CommentsModal.tsx on line 214: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CommentsModal.tsx on line 216: Property 'span' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CommentsModal.tsx on line 217: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CommentsModal.tsx on line 218: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CommentsModal.tsx on line 220: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CommentsModal.tsx on line 221: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CommentsModal.tsx on line 224: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CommentsModal.tsx on line 226: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CommentsModal.tsx on line 228: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CommentsModal.tsx on line 228: Property 'p' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CommentsModal.tsx on line 229: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CommentsModal.tsx on line 232: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CommentsModal.tsx on line 236: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CommentsModal.tsx on line 237: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CommentsModal.tsx on line 243: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CommentsModal.tsx on line 244: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CommentsModal.tsx on line 252: Property 'button' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CommentsModal.tsx on line 253: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CommentsModal.tsx on line 256: Property 'div' does not exist on type 'JSX.IntrinsicElements'.
- Error in file components/CommentsModal.tsx