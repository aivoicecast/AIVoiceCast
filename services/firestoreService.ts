
import { 
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, query, where, 
  orderBy, limit, onSnapshot, runTransaction, increment, arrayUnion, arrayRemove, 
  writeBatch, documentId, Timestamp
} from 'firebase/firestore';
import { 
  ref, uploadBytes, getDownloadURL, listAll, getMetadata, deleteObject 
} from 'firebase/storage';
import { db, auth, storage } from './firebaseConfig';
import { 
  UserProfile, Channel, Comment, Attachment, Group, 
  CommunityDiscussion, Booking, Invitation, RecordingSession, 
  Blog, BlogPost, JobPosting, CareerApplication, Notebook, 
  GeneratedIcon, BankingCheck, ShippingLabel, CoinTransaction, 
  MockInterviewRecording, ChannelStats, ChannelVisibility,
  AgentMemory, SubscriptionTier, TodoItem, WhiteboardElement, OfflinePaymentToken, CodeProject, CodeFile, CursorPosition, RealTimeMessage, ChatChannel
} from '../types';
import { HANDCRAFTED_CHANNELS } from '../utils/initialData';
import { generateSecureId } from '../utils/idUtils';

// Collections
const USERS_COLLECTION = 'users';
const CHANNELS_COLLECTION = 'channels';
const CHANNEL_STATS_COLLECTION = 'channel_stats';
const GROUPS_COLLECTION = 'groups';
const BOOKINGS_COLLECTION = 'bookings';
const DISCUSSIONS_COLLECTION = 'discussions';
const BLOGS_COLLECTION = 'blogs';
const POSTS_COLLECTION = 'blog_posts';
const JOBS_COLLECTION = 'job_postings';
const APPLICATIONS_COLLECTION = 'career_applications';
const CARDS_COLLECTION = 'cards';
const ICONS_COLLECTION = 'icons';
const CHECKS_COLLECTION = 'checks';
const SHIPPING_COLLECTION = 'shipping';
const TRANSACTIONS_COLLECTION = 'coin_transactions';
const NOTEBOOKS_COLLECTION = 'notebooks';
const INVITATIONS_COLLECTION = 'invitations';
const INTERVIEWS_COLLECTION = 'mock_interviews';
const RECORDINGS_COLLECTION = 'recordings';
const PROJECTS_COLLECTION = 'projects';
const WHITEBOARD_COLLECTION = 'whiteboards';

const ADMIN_EMAIL = 'shengliang.song.ai@gmail.com';

const sanitizeData = (data: any) => { 
    if (!data) return data;
    const cleaned = JSON.parse(JSON.stringify(data, (key, value) => {
        if (value instanceof HTMLElement || value instanceof MediaStream || value instanceof AudioContext) return undefined;
        return value;
    }));
    cleaned.adminOwnerEmail = ADMIN_EMAIL; 
    return cleaned; 
};

// --- Mock Interviews ---
export async function saveInterviewRecording(recording: MockInterviewRecording): Promise<string> {
    if (!db) return recording.id;
    const id = recording.id || generateSecureId();
    const payload = { ...recording, id, visibility: recording.visibility || 'public' };
    await setDoc(doc(db, INTERVIEWS_COLLECTION, id), sanitizeData(payload));
    return id;
}

export async function getPublicInterviews(): Promise<MockInterviewRecording[]> {
    if (!db) return [];
    const q = query(collection(db, INTERVIEWS_COLLECTION), where('visibility', '==', 'public'), orderBy('timestamp', 'desc'), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as MockInterviewRecording);
}

export async function getUserInterviews(uid: string): Promise<MockInterviewRecording[]> {
    if (!db) return [];
    const q = query(collection(db, INTERVIEWS_COLLECTION), where('userId', '==', uid), orderBy('timestamp', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as MockInterviewRecording);
}

export async function deleteInterview(id: string): Promise<void> {
    if (!db) return;
    await deleteDoc(doc(db, INTERVIEWS_COLLECTION, id));
}

export async function updateInterviewMetadata(id: string, data: Partial<MockInterviewRecording>): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, INTERVIEWS_COLLECTION, id), sanitizeData(data));
}

// --- Storage Utilities ---
export async function uploadFileToStorage(path: string, file: Blob): Promise<string> {
    if (!storage) throw new Error("Storage unavailable");
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
}

export async function uploadCommentAttachment(file: File, path: string): Promise<string> {
    return uploadFileToStorage(path, file);
}

export async function uploadResumeToStorage(uid: string, file: File): Promise<string> {
    return uploadFileToStorage(`resumes/${uid}/${Date.now()}_${file.name}`, file);
}

// --- User Profile & Identity ---
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, USERS_COLLECTION, uid));
    return snap.exists() ? snap.data() as UserProfile : null;
}

export async function syncUserProfile(user: any): Promise<void> {
    if (!db) return;
    const userRef = doc(db, USERS_COLLECTION, user.uid);
    const snap = await getDoc(userRef);
    const now = Date.now();
    if (!snap.exists()) {
        const profile: UserProfile = {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || 'Anonymous',
            photoURL: user.photoURL || '',
            createdAt: now,
            lastLogin: now,
            subscriptionTier: 'free',
            apiUsageCount: 0,
            groups: [],
            coinBalance: 1000 // Initial bonus
        };
        await setDoc(userRef, profile);
    } else {
        await updateDoc(userRef, { lastLogin: now });
    }
}

export async function updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, USERS_COLLECTION, uid), sanitizeData(data));
}

export async function getAllUsers(): Promise<UserProfile[]> {
    if (!db) return [];
    const snap = await getDocs(collection(db, USERS_COLLECTION));
    return snap.docs.map(d => d.data() as UserProfile);
}

export async function getUserProfileByEmail(email: string): Promise<UserProfile | null> {
    if (!db) return null;
    const q = query(collection(db, USERS_COLLECTION), where('email', '==', email), limit(1));
    const snap = await getDocs(q);
    return snap.empty ? null : snap.docs[0].data() as UserProfile;
}

// --- Blogs & Posts ---
export async function ensureUserBlog(user: any): Promise<Blog> {
    if (!db) throw new Error("DB unavailable");
    const q = query(collection(db, BLOGS_COLLECTION), where('ownerId', '==', user.uid), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].data() as Blog;

    const blog: Blog = {
        id: generateSecureId(),
        ownerId: user.uid,
        authorName: user.displayName || 'Author',
        title: `${user.displayName}'s Blog`,
        description: 'Thoughts and research on AI.',
        createdAt: Date.now()
    };
    await setDoc(doc(db, BLOGS_COLLECTION, blog.id), blog);
    return blog;
}

export async function getCommunityPosts(): Promise<BlogPost[]> {
    if (!db) return [];
    const q = query(collection(db, POSTS_COLLECTION), where('status', '==', 'published'), orderBy('publishedAt', 'desc'), limit(20));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as BlogPost);
}

export async function getUserPosts(blogId: string): Promise<BlogPost[]> {
    if (!db) return [];
    const q = query(collection(db, POSTS_COLLECTION), where('blogId', '==', blogId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as BlogPost);
}

export async function createBlogPost(post: BlogPost): Promise<void> {
    if (!db) return;
    const id = generateSecureId();
    await setDoc(doc(db, POSTS_COLLECTION, id), { ...post, id });
}

export async function updateBlogPost(id: string, data: Partial<BlogPost>): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, POSTS_COLLECTION, id), sanitizeData(data));
}

export async function deleteBlogPost(id: string): Promise<void> {
    if (!db) return;
    await deleteDoc(doc(db, POSTS_COLLECTION, id));
}

export async function updateBlogSettings(id: string, data: Partial<Blog>): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, BLOGS_COLLECTION, id), sanitizeData(data));
}

export async function addPostComment(postId: string, comment: Comment): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, POSTS_COLLECTION, postId), {
        comments: arrayUnion(comment),
        commentCount: increment(1)
    });
}

// Fix: Adding getBlogPost for single post view
export async function getBlogPost(id: string): Promise<BlogPost | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, POSTS_COLLECTION, id));
    return snap.exists() ? snap.data() as BlogPost : null;
}

// --- Career Center ---
export async function createJobPosting(job: JobPosting): Promise<string> {
    if (!db) return '';
    const id = generateSecureId();
    await setDoc(doc(db, JOBS_COLLECTION, id), { ...job, id });
    return id;
}

export async function getJobPostings(): Promise<JobPosting[]> {
    if (!db) return [];
    const q = query(collection(db, JOBS_COLLECTION), orderBy('postedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as JobPosting);
}

export async function getJobPosting(id: string): Promise<JobPosting | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, JOBS_COLLECTION, id));
    return snap.exists() ? snap.data() as JobPosting : null;
}

export async function submitCareerApplication(app: CareerApplication): Promise<void> {
    if (!db) return;
    const id = generateSecureId();
    await setDoc(doc(db, APPLICATIONS_COLLECTION, id), { ...app, id });
}

export async function getAllCareerApplications(): Promise<CareerApplication[]> {
    if (!db) return [];
    const q = query(collection(db, APPLICATIONS_COLLECTION), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as CareerApplication);
}

// --- Conversations & Discussions ---
export async function saveDiscussion(discussion: CommunityDiscussion): Promise<string> {
    if (!db) return '';
    const id = generateSecureId();
    await setDoc(doc(db, DISCUSSIONS_COLLECTION, id), { ...discussion, id, visibility: discussion.visibility || 'private' });
    return id;
}

export async function getDiscussionById(id: string): Promise<CommunityDiscussion | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, DISCUSSIONS_COLLECTION, id));
    return snap.exists() ? snap.data() as CommunityDiscussion : null;
}

export function subscribeToDiscussion(id: string, callback: (d: CommunityDiscussion) => void) {
    if (!db) return () => {};
    return onSnapshot(doc(db, DISCUSSIONS_COLLECTION, id), snap => {
        if (snap.exists()) callback(snap.data() as CommunityDiscussion);
    });
}

export async function saveDiscussionDesignDoc(id: string, docText: string, title?: string): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, DISCUSSIONS_COLLECTION, id), { designDoc: docText, title: title || 'Untitled Spec', updatedAt: Date.now() });
}

export async function deleteDiscussion(id: string): Promise<void> {
    if (!db) return;
    await deleteDoc(doc(db, DISCUSSIONS_COLLECTION, id));
}

export async function updateDiscussionVisibility(id: string, visibility: ChannelVisibility, groupIds?: string[]): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, DISCUSSIONS_COLLECTION, id), { visibility, groupIds: groupIds || [] });
}

export async function getPublicDesignDocs(): Promise<CommunityDiscussion[]> {
    if (!db) return [];
    const q = query(collection(db, DISCUSSIONS_COLLECTION), where('visibility', '==', 'public'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as CommunityDiscussion);
}

export async function getUserDesignDocs(uid: string): Promise<CommunityDiscussion[]> {
    if (!db) return [];
    const q = query(collection(db, DISCUSSIONS_COLLECTION), where('userId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as CommunityDiscussion);
}

export async function getGroupDesignDocs(groupIds: string[]): Promise<CommunityDiscussion[]> {
    if (!db || groupIds.length === 0) return [];
    const q = query(collection(db, DISCUSSIONS_COLLECTION), where('visibility', '==', 'group'), where('groupIds', 'array-contains-any', groupIds));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as CommunityDiscussion);
}

// --- Peer Mentorship & Bookings ---
export async function createBooking(booking: Booking): Promise<string> {
    if (!db) return '';
    const id = generateSecureId();
    await setDoc(doc(db, BOOKINGS_COLLECTION, id), { ...booking, id });
    return id;
}

export async function getUserBookings(uid: string, email?: string): Promise<Booking[]> {
    if (!db) return [];
    const q1 = query(collection(db, BOOKINGS_COLLECTION), where('userId', '==', uid));
    const snap1 = await getDocs(q1);
    let all = snap1.docs.map(d => d.data() as Booking);
    
    if (email) {
        const q2 = query(collection(db, BOOKINGS_COLLECTION), where('invitedEmail', '==', email));
        const snap2 = await getDocs(q2);
        all = [...all, ...snap2.docs.map(d => d.data() as Booking)];
    }
    
    // Fix: Explicitly typed Map to resolve inference errors
    const unique = Array.from(new Map<string, Booking>(all.map(b => [b.id, b] as [string, Booking])).values());
    return unique.sort((a,b) => b.createdAt - a.createdAt);
}

export async function respondToBooking(id: string, accept: boolean): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, BOOKINGS_COLLECTION, id), { status: accept ? 'scheduled' : 'rejected' });
}

export async function cancelBooking(id: string): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, BOOKINGS_COLLECTION, id), { status: 'cancelled' });
}

// Fix: Adding missing booking-related functions
export async function updateBookingInvite(bookingId: string, data: Partial<Booking>): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, BOOKINGS_COLLECTION, bookingId), sanitizeData(data));
}

export async function updateBookingRecording(bookingId: string, recordingUrl: string): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, BOOKINGS_COLLECTION, bookingId), { recordingUrl, status: 'completed' });
}

export async function deleteBookingRecording(bookingId: string): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, BOOKINGS_COLLECTION, bookingId), { recordingUrl: null });
}

// --- Groups ---
export async function createGroup(name: string): Promise<string> {
    if (!db || !auth?.currentUser) throw new Error("Auth required");
    const id = generateSecureId();
    const group: Group = { id, name, ownerId: auth.currentUser.uid, memberIds: [auth.currentUser.uid], createdAt: Date.now() };
    await setDoc(doc(db, GROUPS_COLLECTION, id), group);
    await updateDoc(doc(db, USERS_COLLECTION, auth.currentUser.uid), { groups: arrayUnion(id) });
    return id;
}

export async function getUserGroups(uid: string): Promise<Group[]> {
    if (!db) return [];
    const q = query(collection(db, GROUPS_COLLECTION), where('memberIds', 'array-contains', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Group);
}

// Fix: Adding group management functions
export async function sendInvitation(groupId: string, toEmail: string): Promise<void> {
    if (!db || !auth?.currentUser) return;
    const id = generateSecureId();
    const groupSnap = await getDoc(doc(db, GROUPS_COLLECTION, groupId));
    const groupName = groupSnap.exists() ? groupSnap.data().name : 'Unknown Group';
    
    const invitation: Invitation = {
        id,
        fromUserId: auth.currentUser.uid,
        fromName: auth.currentUser.displayName || 'Anonymous',
        toEmail,
        groupId,
        groupName,
        status: 'pending',
        createdAt: Date.now(),
        type: 'group'
    };
    await setDoc(doc(db, INVITATIONS_COLLECTION, id), invitation);
}

export async function getGroupMembers(memberIds: string[]): Promise<UserProfile[]> {
    if (!db || memberIds.length === 0) return [];
    const q = query(collection(db, USERS_COLLECTION), where('uid', 'in', memberIds.slice(0, 10)));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as UserProfile);
}

export async function removeMemberFromGroup(groupId: string, memberId: string): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, GROUPS_COLLECTION, groupId), {
        memberIds: arrayRemove(memberId)
    });
    await updateDoc(doc(db, USERS_COLLECTION, memberId), {
        groups: arrayRemove(groupId)
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

export async function getPendingInvitations(email: string): Promise<Invitation[]> {
    if (!db) return [];
    const q = query(collection(db, INVITATIONS_COLLECTION), where('toEmail', '==', email), where('status', '==', 'pending'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Invitation);
}

export async function getPendingBookings(email: string): Promise<Booking[]> {
    if (!db) return [];
    const q = query(collection(db, BOOKINGS_COLLECTION), where('invitedEmail', '==', email), where('status', '==', 'pending'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Booking);
}

export async function respondToInvitation(invitation: Invitation, accept: boolean): Promise<void> {
    if (!db) return;
    const status = accept ? 'accepted' : 'rejected';
    await updateDoc(doc(db, INVITATIONS_COLLECTION, invitation.id), { status });
    
    if (accept && invitation.type === 'group' && invitation.groupId && auth?.currentUser) {
        await updateDoc(doc(db, GROUPS_COLLECTION, invitation.groupId), {
            memberIds: arrayUnion(auth.currentUser.uid)
        });
        await updateDoc(doc(db, USERS_COLLECTION, auth.currentUser.uid), {
            groups: arrayUnion(invitation.groupId)
        });
    }
}

// --- Channels & Registry ---
export async function publishChannelToFirestore(channel: Channel): Promise<void> {
    if (!db) return;
    await setDoc(doc(db, CHANNELS_COLLECTION, channel.id), sanitizeData(channel));
}

export async function getPublicChannels(): Promise<Channel[]> {
    if (!db) return [];
    const q = query(collection(db, CHANNELS_COLLECTION), where('visibility', '==', 'public'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Channel);
}

export function subscribeToPublicChannels(callback: (channels: Channel[]) => void) {
    if (!db) return () => {};
    const q = query(collection(db, CHANNELS_COLLECTION), where('visibility', '==', 'public'));
    return onSnapshot(q, snap => {
        callback(snap.docs.map(d => d.data() as Channel));
    });
}

// Fix: Adding channel-related logic
export async function deleteChannelFromFirestore(id: string): Promise<void> {
    if (!db) return;
    await deleteDoc(doc(db, CHANNELS_COLLECTION, id));
}

export async function voteChannel(channel: Channel, type: 'like' | 'dislike'): Promise<void> {
    if (!db || !auth?.currentUser) return;
    const userRef = doc(db, USERS_COLLECTION, auth.currentUser.uid);
    const statsRef = doc(db, CHANNEL_STATS_COLLECTION, channel.id);

    await runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) return;
        const likedIds = userSnap.data().likedChannelIds || [];
        const alreadyLiked = likedIds.includes(channel.id);

        if (type === 'like' && !alreadyLiked) {
            transaction.update(userRef, { likedChannelIds: arrayUnion(channel.id) });
            transaction.update(statsRef, { likes: increment(1) });
        } else if (type === 'dislike' && alreadyLiked) {
            transaction.update(userRef, { likedChannelIds: arrayRemove(channel.id) });
            transaction.update(statsRef, { likes: increment(-1) });
        }
    });
}

export async function addCommentToChannel(channelId: string, comment: Comment): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, CHANNELS_COLLECTION, channelId), {
        comments: arrayUnion(comment)
    });
}

export async function deleteCommentFromChannel(channelId: string, commentId: string): Promise<void> {
    if (!db) return;
    const chanSnap = await getDoc(doc(db, CHANNELS_COLLECTION, channelId));
    if (chanSnap.exists()) {
        const comments = chanSnap.data().comments as Comment[];
        const target = comments.find(c => c.id === commentId);
        if (target) await updateDoc(doc(db, CHANNELS_COLLECTION, channelId), { comments: arrayRemove(target) });
    }
}

export async function updateCommentInChannel(channelId: string, updatedComment: Comment): Promise<void> {
    if (!db) return;
    const chanSnap = await getDoc(doc(db, CHANNELS_COLLECTION, channelId));
    if (chanSnap.exists()) {
        const comments = chanSnap.data().comments as Comment[];
        const nextComments = comments.map(c => c.id === updatedComment.id ? updatedComment : c);
        await updateDoc(doc(db, CHANNELS_COLLECTION, channelId), { comments: nextComments });
    }
}

export async function getChannelsByIds(ids: string[]): Promise<Channel[]> {
    if (!db || ids.length === 0) return [];
    const q = query(collection(db, CHANNELS_COLLECTION), where('id', 'in', ids.slice(0, 10)));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Channel);
}

export async function getCreatorChannels(uid: string): Promise<Channel[]> {
    if (!db) return [];
    const q = query(collection(db, CHANNELS_COLLECTION), where('ownerId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Channel);
}

export function subscribeToChannelStats(channelId: string, callback: (stats: any) => void, defaultStats: any) {
    if (!db) return () => {};
    const statsRef = doc(db, CHANNEL_STATS_COLLECTION, channelId);
    return onSnapshot(statsRef, snap => {
        if (snap.exists()) callback(snap.data());
        else callback(defaultStats);
    });
}

export async function shareChannel(channelId: string): Promise<void> {
    if (!db) return;
    await setDoc(doc(db, CHANNEL_STATS_COLLECTION, channelId), { shares: increment(1) }, { merge: true });
}

// --- Shared Assets ---
export async function saveCard(card: AgentMemory, id: string): Promise<string> {
    if (!db) return id;
    await setDoc(doc(db, CARDS_COLLECTION, id), sanitizeData(card));
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

export async function saveIcon(icon: GeneratedIcon): Promise<void> {
    if (!db) return;
    await setDoc(doc(db, ICONS_COLLECTION, icon.id), icon);
}

export async function getIcon(id: string): Promise<GeneratedIcon | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, ICONS_COLLECTION, id));
    return snap.exists() ? snap.data() as GeneratedIcon : null;
}

// --- Banking & Finance ---
export async function saveBankingCheck(check: BankingCheck): Promise<void> {
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
    const q = query(collection(db, CHECKS_COLLECTION), where('ownerId', '==', uid), orderBy('checkNumber', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as BankingCheck);
}

export async function deleteCheck(id: string): Promise<void> {
    if (!db) return;
    await deleteDoc(doc(db, CHECKS_COLLECTION, id));
}

export async function claimCoinCheck(checkId: string): Promise<number> {
    if (!db || !auth?.currentUser) throw new Error("Auth required");
    const checkRef = doc(db, CHECKS_COLLECTION, checkId);
    const userRef = doc(db, USERS_COLLECTION, auth.currentUser.uid);
    
    return await runTransaction(db, async (transaction) => {
        const checkSnap = await transaction.get(checkRef);
        if (!checkSnap.exists()) throw new Error("Check not found");
        const data = checkSnap.data();
        if (data.isClaimed) throw new Error("Check already claimed");
        
        const amount = data.coinAmount || 0;
        transaction.update(checkRef, { isClaimed: true });
        transaction.update(userRef, { coinBalance: increment(amount) });
        return amount;
    });
}

// --- Coin Transactions ---
export const DEFAULT_MONTHLY_GRANT = 1000;

export async function getCoinTransactions(uid: string): Promise<CoinTransaction[]> {
    if (!db) return [];
    const qIn = query(collection(db, TRANSACTIONS_COLLECTION), where('toId', '==', uid), orderBy('timestamp', 'desc'), limit(50));
    const qOut = query(collection(db, TRANSACTIONS_COLLECTION), where('fromId', '==', uid), orderBy('timestamp', 'desc'), limit(50));
    const [s1, s2] = await Promise.all([getDocs(qIn), getDocs(qOut)]);
    const all = [...s1.docs.map(d => d.data() as CoinTransaction), ...s2.docs.map(d => d.data() as CoinTransaction)];
    return all.sort((a,b) => b.timestamp - a.timestamp);
}

export async function transferCoins(toId: string, toName: string, amount: number, memo: string): Promise<void> {
    if (!db || !auth?.currentUser) return;
    const fromId = auth.currentUser.uid;
    const fromName = auth.currentUser.displayName || 'Anonymous';
    const txId = generateSecureId();
    const tx: CoinTransaction = { id: txId, fromId, fromName, toId, toName, amount, type: 'transfer', memo, timestamp: Date.now(), isVerified: true };
    
    await runTransaction(db, async (transaction) => {
        const fromRef = doc(db, USERS_COLLECTION, fromId);
        const toRef = doc(db, USERS_COLLECTION, toId);
        const fSnap = await transaction.get(fromRef);
        if (!fSnap.exists() || (fSnap.data().coinBalance || 0) < amount) throw new Error("Insufficient funds");
        transaction.update(fromRef, { coinBalance: increment(-amount) });
        transaction.update(toRef, { coinBalance: increment(amount) });
        transaction.set(doc(db, TRANSACTIONS_COLLECTION, txId), tx);
    });
}

export async function checkAndGrantMonthlyCoins(uid: string): Promise<void> {
    if (!db) return;
    const userRef = doc(db, USERS_COLLECTION, uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const lastGrant = data.lastCoinGrantAt || 0;
    const now = Date.now();
    if (now - lastGrant > 86400000 * 30) {
        await updateDoc(userRef, { 
            coinBalance: increment(DEFAULT_MONTHLY_GRANT),
            lastCoinGrantAt: now 
        });
    }
}

export async function registerIdentity(uid: string, publicKey: string, certificate: string): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, USERS_COLLECTION, uid), { publicKey, certificate });
}

export async function claimOfflinePayment(token: OfflinePaymentToken): Promise<void> {
    if (!db) return;
    await transferCoins(token.recipientId, 'Recipient', token.amount, token.memo || 'Offline claim');
}

// --- Code & Whiteboard Collaboration ---
export async function subscribeToCodeProject(projectId: string, callback: (project: CodeProject) => void) {
    if (!db) return () => {};
    return onSnapshot(doc(db, PROJECTS_COLLECTION, projectId), snap => {
        if (snap.exists()) callback(snap.data() as CodeProject);
    });
}

export async function saveCodeProject(project: CodeProject): Promise<void> {
    if (!db) return;
    await setDoc(doc(db, PROJECTS_COLLECTION, project.id), sanitizeData(project));
}

export async function updateCodeFile(projectId: string, file: CodeFile): Promise<void> {
    if (!db) return;
    const projRef = doc(db, PROJECTS_COLLECTION, projectId);
    const snap = await getDoc(projRef);
    if (snap.exists()) {
        const files = (snap.data().files as CodeFile[]).map(f => f.path === file.path ? file : f);
        await updateDoc(projRef, { files, lastModified: Date.now() });
    }
}

export async function updateCursor(projectId: string, cursor: CursorPosition): Promise<void> {
    if (!db) return;
    await setDoc(doc(db, PROJECTS_COLLECTION, projectId, 'cursors', cursor.clientId), cursor);
}

export async function claimCodeProjectLock(projectId: string, clientId: string): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, PROJECTS_COLLECTION, projectId), { activeClientId: clientId });
}

export async function updateProjectActiveFile(projectId: string, filePath: string): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, PROJECTS_COLLECTION, projectId), { activeFilePath: filePath });
}

export async function deleteCodeFile(projectId: string, filePath: string): Promise<void> {
    if (!db) return;
    const projRef = doc(db, PROJECTS_COLLECTION, projectId);
    const snap = await getDoc(projRef);
    if (snap.exists()) {
        const files = (snap.data().files as CodeFile[]).filter(f => f.path !== filePath);
        await updateDoc(projRef, { files });
    }
}

export async function updateProjectAccess(projectId: string, accessLevel: 'public' | 'restricted', allowedUserIds?: string[]): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, PROJECTS_COLLECTION, projectId), { accessLevel, allowedUserIds: allowedUserIds || [] });
}

export async function saveWhiteboardSession(sessionId: string, elements: WhiteboardElement[]): Promise<void> {
    if (!db) return;
    await setDoc(doc(db, WHITEBOARD_COLLECTION, sessionId), { elements, createdAt: Date.now() });
}

export function subscribeToWhiteboard(sessionId: string, callback: (elements: WhiteboardElement[]) => void) {
    if (!db) return () => {};
    return onSnapshot(doc(db, WHITEBOARD_COLLECTION, sessionId), snap => {
        if (snap.exists()) callback(snap.data().elements as WhiteboardElement[]);
    });
}

export async function updateWhiteboardElement(sessionId: string, element: WhiteboardElement): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, WHITEBOARD_COLLECTION, sessionId), {
        elements: arrayUnion(element)
    });
}

export async function deleteWhiteboardElements(sessionId: string): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, WHITEBOARD_COLLECTION, sessionId), { elements: [] });
}

// --- Admin & Global Stats ---
export async function getGlobalStats(): Promise<any> {
    if (!db) return { totalLogins: 0, uniqueUsers: 0 };
    const snap = await getDoc(doc(db, 'stats', 'global'));
    return snap.exists() ? snap.data() : { totalLogins: 0, uniqueUsers: 0 };
}

export async function incrementApiUsage(uid: string): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, USERS_COLLECTION, uid), { apiUsageCount: increment(1) });
}

export async function setUserSubscriptionTier(uid: string, tier: SubscriptionTier): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, USERS_COLLECTION, uid), { subscriptionTier: tier });
}

export async function getDebugCollectionDocs(collectionName: string, limitVal: number = 20): Promise<any[]> {
    if (!db) return [];
    const q = query(collection(db, collectionName), limit(limitVal));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function recalculateGlobalStats(): Promise<number> {
    if (!db) return 0;
    const usersSnap = await getDocs(collection(db, USERS_COLLECTION));
    const count = usersSnap.size;
    await setDoc(doc(db, 'stats', 'global'), { uniqueUsers: count }, { merge: true });
    return count;
}

export async function claimSystemChannels(email: string): Promise<number> {
    if (!db) return 0;
    const userProfile = await getUserProfileByEmail(email);
    if (!userProfile) throw new Error("Target user not found");
    
    const q = query(collection(db, CHANNELS_COLLECTION), where('author', '==', 'Gemini Professional'));
    const snap = await getDocs(q);
    let count = 0;
    for (const d of snap.docs) {
        await updateDoc(d.ref, { ownerId: userProfile.uid });
        count++;
    }
    return count;
}

// --- Chat & Messaging ---
export async function sendMessage(channelId: string, text: string, path: string, replyTo?: any, attachments?: any[]): Promise<void> {
    if (!db || !auth?.currentUser) return;
    const msg: RealTimeMessage = {
        id: generateSecureId(),
        text,
        senderId: auth.currentUser.uid,
        senderName: auth.currentUser.displayName || 'Anonymous',
        senderImage: auth.currentUser.photoURL || undefined,
        timestamp: Timestamp.now(),
        replyTo,
        attachments
    };
    await addDoc(collection(db, path), sanitizeData(msg));
}

export function subscribeToMessages(channelId: string, callback: (messages: RealTimeMessage[]) => void, path: string) {
    if (!db) return () => {};
    const q = query(collection(db, path), orderBy('timestamp', 'asc'));
    return onSnapshot(q, snap => {
        callback(snap.docs.map(d => d.data() as RealTimeMessage));
    });
}

export async function createOrGetDMChannel(otherUserId: string, otherUserName: string): Promise<string> {
    if (!db || !auth?.currentUser) throw new Error("Auth required");
    const myId = auth.currentUser.uid;
    const myName = auth.currentUser.displayName || 'Me';
    const channelId = myId < otherUserId ? `${myId}_${otherUserId}` : `${otherUserId}_${myId}`;
    
    const chanRef = doc(db, 'chat_channels', channelId);
    const snap = await getDoc(chanRef);
    if (!snap.exists()) {
        await setDoc(chanRef, {
            id: channelId,
            name: `${myName} & ${otherUserName}`,
            type: 'dm',
            memberIds: [myId, otherUserId],
            createdAt: Date.now()
        });
    }
    return channelId;
}

export async function getUserDMChannels(): Promise<ChatChannel[]> {
    if (!db || !auth?.currentUser) return [];
    const q = query(collection(db, 'chat_channels'), where('memberIds', 'array-contains', auth.currentUser.uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as ChatChannel);
}

export async function deleteMessage(channelId: string, msgId: string, path: string): Promise<void> {
    if (!db) return;
    await deleteDoc(doc(db, path, msgId));
}

// --- Social Interactions ---
export async function followUser(uid: string, targetUid: string): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, USERS_COLLECTION, uid), { following: arrayUnion(targetUid) });
    await updateDoc(doc(db, USERS_COLLECTION, targetUid), { followers: arrayUnion(uid) });
}

export async function unfollowUser(uid: string, targetUid: string): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, USERS_COLLECTION, uid), { following: arrayRemove(targetUid) });
    await updateDoc(doc(db, USERS_COLLECTION, targetUid), { followers: arrayRemove(uid) });
}

// --- Utility ---
export async function logUserActivity(activity: string, metadata: any): Promise<void> {
    if (!db || !auth?.currentUser) return;
    await addDoc(collection(db, 'activity_logs'), {
        userId: auth.currentUser.uid,
        activity,
        metadata,
        timestamp: Timestamp.now()
    });
}

export async function getBillingHistory(uid: string): Promise<any[]> {
    return [
        { date: '2024-03-01', amount: 29.00 },
        { date: '2024-02-01', amount: 29.00 }
    ];
}

export async function createStripePortalSession(uid: string): Promise<string> {
    return 'https://billing.stripe.com/p/session/test_123';
}

export async function getCreatorNotebooks(uid: string): Promise<Notebook[]> {
    if (!db) return [];
    const q = query(collection(db, NOTEBOOKS_COLLECTION), where('ownerId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Notebook);
}

export async function saveNotebook(notebook: Notebook): Promise<string> {
    if (!db) return notebook.id;
    await setDoc(doc(db, NOTEBOOKS_COLLECTION, notebook.id), sanitizeData(notebook));
    return notebook.id;
}

export async function getNotebook(id: string): Promise<Notebook | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, NOTEBOOKS_COLLECTION, id));
    return snap.exists() ? snap.data() as Notebook : null;
}

export async function saveShippingLabel(label: ShippingLabel): Promise<void> {
    if (!db) return;
    await setDoc(doc(db, SHIPPING_COLLECTION, label.id), sanitizeData(label));
}

export async function getUserRecordings(uid: string): Promise<RecordingSession[]> {
    if (!db) return [];
    const q = query(collection(db, RECORDINGS_COLLECTION), where('userId', '==', uid), orderBy('timestamp', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as RecordingSession);
}

export async function saveRecordingReference(session: RecordingSession): Promise<void> {
    if (!db) return;
    await setDoc(doc(db, RECORDINGS_COLLECTION, session.id), sanitizeData(session));
}

export async function deleteRecordingReference(id: string, mediaUrl: string, tUrl: string): Promise<void> {
    if (!db) return;
    await deleteDoc(doc(db, RECORDINGS_COLLECTION, id));
    // Firebase storage cleanup would happen here
}

export async function listCloudDirectory(path: string): Promise<any[]> {
    return [];
}

export async function saveProjectToCloud(path: string, fileName: string, content: string): Promise<void> {
    return;
}

export async function deleteCloudItem(fullPath: string): Promise<void> {
    return;
}

export async function createCloudFolder(path: string, folderName: string): Promise<void> {
    return;
}

export async function sendShareNotification(toEmail: string, data: any): Promise<void> {
    return;
}

export async function deleteCloudFolderRecursive(path: string): Promise<void> {
    return;
}

// --- Cleanup & Internal ---
export async function seedDatabase(): Promise<void> {
    if (!db) return;
    for (const channel of HANDCRAFTED_CHANNELS) {
        await setDoc(doc(db, CHANNELS_COLLECTION, channel.id), { ...channel, visibility: 'public' });
    }
}
