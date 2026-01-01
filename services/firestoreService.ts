
import { firebase, auth, db, storage } from './firebaseConfig';
import { 
  UserProfile, Channel, ChannelStats, Comment, Attachment, 
  Group, ChatChannel, RealTimeMessage, 
  GeneratedLecture, CommunityDiscussion, 
  Booking, Invitation, RecordingSession, 
  CodeProject, CodeFile, CursorPosition, CloudItem, 
  WhiteboardElement, 
  Blog, BlogPost, 
  JobPosting, CareerApplication, 
  Notebook, AgentMemory,
  GlobalStats,
  SubscriptionTier,
  Chapter,
  TranscriptItem,
  ChannelVisibility,
  GeneratedIcon,
  BankingCheck,
  ShippingLabel
} from '../types';
import { HANDCRAFTED_CHANNELS } from '../utils/initialData';

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

export const ADMIN_EMAILS = ['shengliang.song.ai@gmail.com'];
export const ADMIN_EMAIL = ADMIN_EMAILS[0];

const sanitizeData = (data: any) => {
    const cleaned = JSON.parse(JSON.stringify(data));
    cleaned.adminOwnerEmail = ADMIN_EMAIL;
    return cleaned;
};

// --- Icons ---
export async function saveIcon(icon: GeneratedIcon): Promise<string> {
    if (!db) return icon.id;
    const ref = db.collection(ICONS_COLLECTION).doc(icon.id);
    await ref.set(sanitizeData(icon));
    return icon.id;
}
export async function getIcon(id: string): Promise<GeneratedIcon | null> {
    if (!db) return null;
    const doc = await db.collection(ICONS_COLLECTION).doc(id).get();
    return doc.exists ? (doc.data() as GeneratedIcon) : null;
}

// --- Checks ---
export async function saveBankingCheck(check: BankingCheck): Promise<string> {
    if (!db) return check.id || 'local';
    const id = check.id || crypto.randomUUID();
    const ref = db.collection(CHECKS_COLLECTION).doc(id);
    await ref.set(sanitizeData({ ...check, id }));
    return id;
}
export async function getBankingCheck(id: string): Promise<BankingCheck | null> {
    if (!db) return null;
    const doc = await db.collection(CHECKS_COLLECTION).doc(id).get();
    return doc.exists ? (doc.data() as BankingCheck) : null;
}

// --- Shipping ---
export async function saveShippingLabel(label: ShippingLabel): Promise<string> {
    if (!db) return label.id || 'local';
    const id = label.id || crypto.randomUUID();
    const ref = db.collection(SHIPPING_COLLECTION).doc(id);
    await ref.set(sanitizeData({ ...label, id }));
    return id;
}
export async function getShippingLabel(id: string): Promise<ShippingLabel | null> {
    if (!db) return null;
    const doc = await db.collection(SHIPPING_COLLECTION).doc(id).get();
    return doc.exists ? (doc.data() as ShippingLabel) : null;
}

// --- Initialization Check ---

export async function isRegistryEmpty(): Promise<boolean> {
    if (!db) return true;
    try {
        const snap = await db.collection(CHANNELS_COLLECTION).limit(1).get();
        return snap.empty;
    } catch (e) {
        return true;
    }
}

export async function seedDatabase() {
    if (!db) return;
    console.log("Seeding initial database content...");
    const batch = db.batch();
    for (const channel of HANDCRAFTED_CHANNELS) {
        const ref = db.collection(CHANNELS_COLLECTION).doc(channel.id);
        batch.set(ref, sanitizeData({
            ...channel,
            visibility: 'public',
            ownerId: 'system'
        }), { merge: true });
        
        const statsRef = db.collection(CHANNEL_STATS_COLLECTION).doc(channel.id);
        batch.set(statsRef, { likes: channel.likes, dislikes: 0, shares: 0, adminOwnerEmail: ADMIN_EMAIL }, { merge: true });
    }
    
    const statsRef = db.collection('stats').doc('global');
    batch.set(statsRef, { 
        totalLogins: firebase.firestore.FieldValue.increment(1), 
        uniqueUsers: firebase.firestore.FieldValue.increment(0),
        adminOwnerEmail: ADMIN_EMAIL
    }, { merge: true });

    await batch.commit();
}

// --- Users & Auth ---

export async function syncUserProfile(user: any): Promise<void> {
  if (!user || !db) return;
  const userRef = db.collection(USERS_COLLECTION).doc(user.uid);
  
  try {
      const snap = await userRef.get();
      if (!snap.exists) {
        await userRef.set({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          createdAt: Date.now(),
          lastLogin: Date.now(),
          subscriptionTier: 'free',
          apiUsageCount: 0,
          groups: [],
          adminOwnerEmail: ADMIN_EMAIL 
        });
        
        await db.collection('stats').doc('global').set({
            uniqueUsers: firebase.firestore.FieldValue.increment(1),
            adminOwnerEmail: ADMIN_EMAIL
        }, { merge: true });

      } else {
        await userRef.update({
          lastLogin: Date.now(),
          photoURL: user.photoURL || snap.data()?.photoURL,
          displayName: user.displayName || snap.data()?.displayName
        });
      }
      
      await db.collection('stats').doc('global').set({
          totalLogins: firebase.firestore.FieldValue.increment(1),
          adminOwnerEmail: ADMIN_EMAIL
      }, { merge: true });

  } catch (e) {
      console.warn("Profile sync error (Firestore):", e);
  }
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (!db) return null;
  try {
    const doc = await db.collection(USERS_COLLECTION).doc(uid).get();
    return doc.exists ? (doc.data() as UserProfile) : null;
  } catch(e) { return null; }
}

export async function updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  if (!db) return;
  await db.collection(USERS_COLLECTION).doc(uid).update(data);
}

export async function getAllUsers(): Promise<UserProfile[]> {
  if (!db) return [];
  const snap = await db.collection(USERS_COLLECTION).get();
  return snap.docs.map(d => d.data() as UserProfile);
}

export async function getUserProfileByEmail(email: string): Promise<UserProfile | null> {
  if (!db) return null;
  const snap = await db.collection(USERS_COLLECTION).where('email', '==', email).limit(1).get();
  if (snap.empty) return null;
  return snap.docs[0].data() as UserProfile;
}

export function logUserActivity(action: string, details: any) {
  if (!db) return;
  db.collection('activity_logs').add({
    action,
    details,
    adminOwnerEmail: ADMIN_EMAIL,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  }).catch(() => {});
}

export async function followUser(followerId: string, targetId: string) {
  if (!db) return;
  const batch = db.batch();
  const followerRef = db.collection(USERS_COLLECTION).doc(followerId);
  const targetRef = db.collection(USERS_COLLECTION).doc(targetId);
  batch.update(followerRef, { following: firebase.firestore.FieldValue.arrayUnion(targetId) });
  batch.update(targetRef, { followers: firebase.firestore.FieldValue.arrayUnion(followerId) });
  await batch.commit();
}

export async function unfollowUser(followerId: string, targetId: string) {
  if (!db) return;
  const batch = db.batch();
  const followerRef = db.collection(USERS_COLLECTION).doc(followerId);
  const targetRef = db.collection(USERS_COLLECTION).doc(targetId);
  batch.update(followerRef, { following: firebase.firestore.FieldValue.arrayRemove(targetId) });
  batch.update(targetRef, { followers: firebase.firestore.FieldValue.arrayRemove(followerId) });
  await batch.commit();
}

export function setupSubscriptionListener(uid: string, callback: (tier: SubscriptionTier) => void) {
  if (!db) return () => {};
  return db.collection(USERS_COLLECTION).doc(uid).onSnapshot(doc => {
    const data = doc.data();
    if (data) callback(data.subscriptionTier || 'free');
  }, () => {});
}

export async function setUserSubscriptionTier(uid: string, tier: 'free' | 'pro') {
    if (!db) return;
    await db.collection(USERS_COLLECTION).doc(uid).update({ subscriptionTier: tier });
}

// --- API Usage ---
export async function incrementApiUsage(uid: string) {
    if (!db) return;
    const ref = db.collection(USERS_COLLECTION).doc(uid);
    await ref.update({
        apiUsageCount: firebase.firestore.FieldValue.increment(1)
    });
}

// --- Channels ---

export async function getPublicChannels(): Promise<Channel[]> {
  if (!db) return [];
  const snap = await db.collection(CHANNELS_COLLECTION).where('visibility', '==', 'public').get();
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as Channel));
}

export function subscribeToPublicChannels(onUpdate: (channels: Channel[]) => void, onError?: (error: any) => void) {
  if (!db) {
    onUpdate([]);
    return () => {};
  }
  return db.collection(CHANNELS_COLLECTION)
    .where('visibility', '==', 'public')
    .onSnapshot(
      snap => onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as Channel))),
      err => onError && onError(err)
    );
}

export async function publishChannelToFirestore(channel: Channel) {
  if (!db) return;
  await db.collection(CHANNELS_COLLECTION).doc(channel.id).set(sanitizeData(channel));
}

export async function deleteChannelFromFirestore(channelId: string) {
    if (!db) return;
    await db.collection(CHANNELS_COLLECTION).doc(channelId).delete();
}

export async function voteChannel(channel: Channel, type: 'like' | 'dislike') {
  if (!db) return;
  const statsRef = db.collection(CHANNEL_STATS_COLLECTION).doc(channel.id);
  const update: any = type === 'like' 
    ? { likes: firebase.firestore.FieldValue.increment(1) }
    : { dislikes: firebase.firestore.FieldValue.increment(1) };
  
  update.adminOwnerEmail = ADMIN_EMAIL;
  await statsRef.set(update, { merge: true });
}

export function subscribeToChannelStats(channelId: string, callback: (stats: ChannelStats) => void, initialStats: ChannelStats) {
    if (!db) {
        callback(initialStats);
        return () => {};
    }
    return db.collection(CHANNEL_STATS_COLLECTION).doc(channelId).onSnapshot(doc => {
        if (doc.exists) {
            callback(doc.data() as ChannelStats);
        } else {
            callback(initialStats);
        }
    }, () => callback(initialStats));
}

export async function shareChannel(channelId: string) {
    if (!db) return;
    const statsRef = db.collection(CHANNEL_STATS_COLLECTION).doc(channelId);
    await statsRef.set({ 
        shares: firebase.firestore.FieldValue.increment(1),
        adminOwnerEmail: ADMIN_EMAIL 
    }, { merge: true });
}

export async function addCommentToChannel(channelId: string, comment: Comment) {
  if (!db) return;
  const ref = db.collection(CHANNELS_COLLECTION).doc(channelId);
  await ref.update({
    comments: firebase.firestore.FieldValue.arrayUnion(sanitizeData(comment))
  });
}

export async function updateCommentInChannel(channelId: string, comment: Comment) {
    if (!db) return;
    const ref = db.collection(CHANNELS_COLLECTION).doc(channelId);
    await db.runTransaction(async (t) => {
        const doc = await t.get(ref);
        if (!doc.exists) return;
        const data = doc.data() as Channel;
        const comments = data.comments.map(c => c.id === comment.id ? comment : c);
        t.update(ref, { comments });
    });
}

export async function deleteCommentFromChannel(channelId: string, commentId: string) {
    if (!db) return;
    const ref = db.collection(CHANNELS_COLLECTION).doc(channelId);
    await db.runTransaction(async (t) => {
        const doc = await t.get(ref);
        if (!doc.exists) return;
        const data = doc.data() as Channel;
        const comments = data.comments.filter(c => c.id !== commentId);
        t.update(ref, { comments });
    });
}

export async function addChannelAttachment(channelId: string, attachment: Attachment) {
    if (!db) return;
    const ref = db.collection(CHANNELS_COLLECTION).doc(channelId);
    await ref.update({
        appendix: firebase.firestore.FieldValue.arrayUnion(sanitizeData(attachment))
    });
}

export async function getChannelsByIds(ids: string[]): Promise<Channel[]> {
    if (!db || ids.length === 0) return [];
    const safeIds = ids.slice(0, 10);
    const snap = await db.collection(CHANNELS_COLLECTION).where(firebase.firestore.FieldPath.documentId(), 'in', safeIds).get();
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Channel));
}

export async function getCreatorChannels(ownerId: string): Promise<Channel[]> {
    if (!db) return [];
    const snap = await db.collection(CHANNELS_COLLECTION).where('ownerId', '==', ownerId).limit(20).get();
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Channel));
}

export async function getGroupChannels(groupIds: string[]): Promise<Channel[]> {
    if (!db || !groupIds || groupIds.length === 0) return [];
    const snap = await db.collection(CHANNELS_COLLECTION).where('groupId', 'in', groupIds).get();
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Channel));
}

export async function claimSystemChannels(ownerEmail: string): Promise<number> {
    if (!db) return 0;
    const user = await getUserProfileByEmail(ownerEmail);
    if (!user) throw new Error("User not found");
    const snap = await db.collection(CHANNELS_COLLECTION).get();
    let count = 0;
    const batch = db.batch();
    snap.docs.forEach(doc => {
        const data = doc.data();
        if (!data.ownerId || data.ownerId === 'system') {
            batch.update(doc.ref, { ownerId: user.uid, adminOwnerEmail: ADMIN_EMAIL });
            count++;
        }
    });
    await batch.commit();
    return count;
}

// --- Lectures & Curriculum ---

export async function saveLectureToFirestore(channelId: string, subTopicId: string, lecture: GeneratedLecture) {
    if (!db) return;
    await db.collection(CHANNELS_COLLECTION).doc(channelId).collection('lectures').doc(subTopicId).set(sanitizeData(lecture));
}

export async function getLectureFromFirestore(channelId: string, subTopicId: string): Promise<GeneratedLecture | null> {
    if (!db) return null;
    const doc = await db.collection(CHANNELS_COLLECTION).doc(channelId).collection('lectures').doc(subTopicId).get();
    return doc.exists ? (doc.data() as GeneratedLecture) : null;
}

export async function deleteLectureFromFirestore(channelId: string, subTopicId: string) {
    if (!db) return;
    await db.collection(CHANNELS_COLLECTION).doc(channelId).collection('lectures').doc(subTopicId).delete();
}

export async function saveCurriculumToFirestore(channelId: string, chapters: Chapter[]) {
    if (!db) return;
    await db.collection(CHANNELS_COLLECTION).doc(channelId).update({ chapters: sanitizeData(chapters) });
}

export async function getCurriculumFromFirestore(channelId: string): Promise<Chapter[] | null> {
    if (!db) return null;
    const doc = await db.collection(CHANNELS_COLLECTION).doc(channelId).get();
    return doc.exists ? (doc.data()?.chapters as Chapter[]) : null;
}

// --- Discussions & Design Docs ---

export async function saveDiscussion(discussion: CommunityDiscussion): Promise<string> {
    if (!db) return 'no-db';
    const data = sanitizeData(discussion);
    const ref = await db.collection(DISCUSSIONS_COLLECTION).add(data);
    return ref.id;
}

export async function updateDiscussion(id: string, transcript: TranscriptItem[]) {
    if (!db) return;
    await db.collection(DISCUSSIONS_COLLECTION).doc(id).update({
        transcript: sanitizeData(transcript),
        updatedAt: Date.now()
    });
}

export async function getDiscussionById(id: string): Promise<CommunityDiscussion | null> {
    if (!db) return null;
    const doc = await db.collection(DISCUSSIONS_COLLECTION).doc(id).get();
    return doc.exists ? ({ ...doc.data(), id: doc.id } as CommunityDiscussion) : null;
}

export function subscribeToDiscussion(id: string, callback: (doc: CommunityDiscussion) => void) {
    if (!db) return () => {};
    return db.collection(DISCUSSIONS_COLLECTION).doc(id).onSnapshot(snap => {
        if (snap.exists) callback({ ...snap.data(), id: snap.id } as CommunityDiscussion);
    }, () => {});
}

export async function saveDiscussionDesignDoc(id: string, doc: string, title?: string) {
    if (!db) return;
    const update: any = { designDoc: doc };
    if (title) update.title = title;
    await db.collection(DISCUSSIONS_COLLECTION).doc(id).update(update);
}

export async function deleteDiscussion(id: string) {
    if (!db) return;
    await db.collection(DISCUSSIONS_COLLECTION).doc(id).delete();
}

export async function getUserDesignDocs(uid: string): Promise<CommunityDiscussion[]> {
    if (!db) return [];
    const snap = await db.collection(DISCUSSIONS_COLLECTION).where('userId', '==', uid).get();
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as CommunityDiscussion));
}

export async function getPublicDesignDocs(): Promise<CommunityDiscussion[]> {
    if (!db) return [];
    const snap = await db.collection(DISCUSSIONS_COLLECTION).where('visibility', '==', 'public').get();
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as CommunityDiscussion));
}

export async function getGroupDesignDocs(groupIds: string[]): Promise<CommunityDiscussion[]> {
    if (!db || !groupIds || groupIds.length === 0) return [];
    const snap = await db.collection(DISCUSSIONS_COLLECTION).where('visibility', '==', 'group').where('groupIds', 'array-contains-any', groupIds).get();
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as CommunityDiscussion));
}

export async function updateDiscussionVisibility(id: string, visibility: ChannelVisibility, groupIds?: string[]) {
    if (!db) return;
    await db.collection(DISCUSSIONS_COLLECTION).doc(id).update({
        visibility,
        groupIds: groupIds || []
    });
}

export async function linkDiscussionToLectureSegment(channelId: string, lectureId: string, index: number, discussionId: string) {
    if (!db) return;
    const ref = db.collection(CHANNELS_COLLECTION).doc(channelId).collection('lectures').doc(lectureId);
    await db.runTransaction(async (t) => {
        const doc = await t.get(ref);
        if (!doc.exists) return;
        const data = doc.data() as GeneratedLecture;
        if (data.sections[index]) {
            data.sections[index].discussionId = discussionId;
            t.update(ref, { sections: data.sections });
        }
    });
}

// --- Bookings & Invitations ---

export async function getUserBookings(uid: string, email: string): Promise<Booking[]> {
    if (!db) return [];
    const snap1 = await db.collection(BOOKINGS_COLLECTION).where('userId', '==', uid).get();
    const snap2 = await db.collection(BOOKINGS_COLLECTION).where('invitedEmail', '==', email).get();
    const all = [...snap1.docs, ...snap2.docs].map(d => ({ ...d.data(), id: d.id } as Booking));
    return Array.from(new Map(all.map(b => [b.id, b])).values());
}

export async function createBooking(booking: Booking): Promise<string> {
    if (!db) return 'no-db';
    const ref = await db.collection(BOOKINGS_COLLECTION).add(sanitizeData(booking));
    return ref.id;
}

export async function cancelBooking(id: string) {
    if (!db) return;
    await db.collection(BOOKINGS_COLLECTION).doc(id).update({ status: 'cancelled' });
}

export async function updateBookingInvite(id: string, email: string) {
    if (!db) return;
    await db.collection(BOOKINGS_COLLECTION).doc(id).update({ invitedEmail: email });
}

export async function respondToBooking(id: string, accept: boolean) {
    if (!db) return;
    await db.collection(BOOKINGS_COLLECTION).doc(id).update({ status: accept ? 'scheduled' : 'rejected' });
}

export async function getPendingBookings(email: string): Promise<Booking[]> {
    if (!db) return [];
    const snap = await db.collection(BOOKINGS_COLLECTION).where('invitedEmail', '==', email).where('status', '==', 'pending').get();
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Booking));
}

export async function getPendingInvitations(email: string): Promise<Invitation[]> {
    if (!db) return [];
    const snap = await db.collection('invitations').where('toEmail', '==', email).where('status', '==', 'pending').get();
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Invitation));
}

export async function respondToInvitation(invite: Invitation, accept: boolean) {
    if (!db) return;
    const status = accept ? 'accepted' : 'rejected';
    await db.collection('invitations').doc(invite.id).update({ status });
    if (accept && invite.type !== 'session') {
        await db.collection(GROUPS_COLLECTION).doc(invite.groupId).update({
            memberIds: firebase.firestore.FieldValue.arrayUnion(auth?.currentUser?.uid)
        });
    }
}

export async function sendInvitation(groupId: string, email: string) {
    if (!db) return;
    const group = await db.collection(GROUPS_COLLECTION).doc(groupId).get();
    await db.collection('invitations').add({
        groupId,
        groupName: group.data()?.name,
        fromUserId: auth?.currentUser?.uid,
        fromName: auth?.currentUser?.displayName,
        toEmail: email,
        status: 'pending',
        createdAt: Date.now(),
        adminOwnerEmail: ADMIN_EMAIL
    });
}

export async function updateBookingRecording(id: string, mediaUrl: string, transcriptUrl: string) {
    if (!db) return;
    await db.collection(BOOKINGS_COLLECTION).doc(id).update({
        recordingUrl: mediaUrl,
        transcriptUrl: transcriptUrl,
        status: 'completed'
    });
}

// --- Recordings ---

export async function saveRecordingReference(session: RecordingSession) {
    if (!db) return;
    await db.collection(RECORDINGS_COLLECTION).add(sanitizeData(session));
}

export async function getUserRecordings(uid: string): Promise<RecordingSession[]> {
    if (!db) return [];
    const snap = await db.collection(RECORDINGS_COLLECTION).where('userId', '==', uid).get();
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as RecordingSession));
}

export async function deleteRecordingReference(id: string, mediaUrl: string, transcriptUrl: string) {
    if (!db) return;
    await db.collection(RECORDINGS_COLLECTION).doc(id).delete();
}

export async function deleteBookingRecording(id: string, mediaUrl?: string, transcriptUrl?: string) {
    if (!db) return;
    await db.collection(BOOKINGS_COLLECTION).doc(id).update({
        recordingUrl: firebase.firestore.FieldValue.delete(),
        transcriptUrl: firebase.firestore.FieldValue.delete()
    });
}

// --- Storage ---

export async function uploadFileToStorage(path: string, file: Blob | File, metadata?: any): Promise<string> {
    if (!storage) return 'no-storage';
    const ref = storage.ref(path);
    await ref.put(file, { ...metadata, customMetadata: { adminOwnerEmail: ADMIN_EMAIL } });
    return await ref.getDownloadURL();
}

export async function uploadCommentAttachment(file: File, path: string): Promise<string> {
    return uploadFileToStorage(path, file);
}

export async function uploadResumeToStorage(uid: string, file: File): Promise<string> {
    const path = `resumes/${uid}/${Date.now()}_${file.name}`;
    return uploadFileToStorage(path, file);
}

// --- Cloud Directory (Code Studio) ---

export async function listCloudDirectory(path: string): Promise<CloudItem[]> {
    if (!storage) return [];
    const ref = storage.ref(path);
    try {
        const res = await ref.listAll();
        const items = await Promise.all(res.items.map(async (i) => {
            const meta = await i.getMetadata();
            return { name: i.name, fullPath: i.fullPath, url: await i.getDownloadURL(), isFolder: false, size: meta.size };
        }));
        const folders = res.prefixes.map(p => ({ name: p.name, fullPath: p.fullPath, isFolder: true }));
        return [...folders, ...items];
    } catch(e) { return []; }
}

export async function saveProjectToCloud(path: string, name: string, content: string) {
    if (!storage) return;
    const ref = storage.ref(`${path}/${name}`);
    await ref.putString(content, 'raw', { customMetadata: { adminOwnerEmail: ADMIN_EMAIL } });
}

export async function deleteCloudItem(itemOrPath: CloudItem | string) {
    if (!storage) return;
    const path = typeof itemOrPath === 'string' ? itemOrPath : itemOrPath.fullPath;
    await storage.ref(path).delete();
}

export async function deleteCloudFolderRecursive(path: string, onProgress?: (msg: string) => void) {
    if (!storage) return;
    const ref = storage.ref(path);
    const res = await ref.listAll();
    for (const item of res.items) {
        if (onProgress) onProgress(`Deleting file: ${item.fullPath}`);
        await item.delete();
    }
    for (const prefix of res.prefixes) {
        await deleteCloudFolderRecursive(prefix.fullPath, onProgress);
    }
}

export async function createCloudFolder(path: string, name: string) {
    if (!storage) return;
    const ref = storage.ref(`${path}/${name}/.keep`);
    await ref.putString('', 'raw', { customMetadata: { adminOwnerEmail: ADMIN_EMAIL } });
}

export async function moveCloudFile(oldPath: string, newPath: string) {
    if (!storage) return;
    const oldRef = storage.ref(oldPath);
    const newRef = storage.ref(newPath);
    const url = await oldRef.getDownloadURL();
    const res = await fetch(url);
    const blob = await res.blob();
    await newRef.put(blob, { customMetadata: { adminOwnerEmail: ADMIN_EMAIL } });
    await oldRef.delete();
}

// --- Code Projects (Collaboration) ---

export function subscribeToCodeProject(id: string, callback: (project: CodeProject) => void) {
    if (!db) return () => {};
    return db.collection(CODE_PROJECTS_COLLECTION).doc(id).onSnapshot(doc => {
        if (doc.exists) callback({ ...doc.data(), id: doc.id } as CodeProject);
    }, () => {});
}

export async function saveCodeProject(project: CodeProject) {
    if (!db) return;
    await db.collection(CODE_PROJECTS_COLLECTION).doc(project.id).set(sanitizeData(project), { merge: true });
}

export async function updateCodeFile(projectId: string, file: CodeFile) {
    if (!db) return;
    const ref = db.collection(CODE_PROJECTS_COLLECTION).doc(projectId);
    await db.runTransaction(async (t) => {
        const doc = await t.get(ref);
        if (!doc.exists) return;
        const project = doc.data() as CodeProject;
        const files = project.files.map(f => (f.path || f.name) === (file.path || f.name) ? file : f);
        if (!files.some(f => (f.path || f.name) === (file.path || f.name))) files.push(file);
        t.update(ref, { files, lastModified: Date.now() });
    });
}

export async function updateCursor(projectId: string, cursor: CursorPosition) {
    if (!db) return;
    const ref = db.collection(CODE_PROJECTS_COLLECTION).doc(projectId);
    await ref.set({ cursors: { [cursor.clientId]: sanitizeData(cursor) } }, { merge: true });
}

export async function claimCodeProjectLock(projectId: string, clientId: string, userName: string) {
    if (!db) return;
    await db.collection(CODE_PROJECTS_COLLECTION).doc(projectId).update({
        activeClientId: clientId,
        activeWriterName: userName,
        lastModified: Date.now()
    });
}

export async function updateProjectActiveFile(projectId: string, path: string) {
    if (!db) return;
    await db.collection(CODE_PROJECTS_COLLECTION).doc(projectId).update({ activeFilePath: path });
}

export async function deleteCodeFile(projectId: string, fileName: string) {
    if (!db) return;
    const ref = db.collection(CODE_PROJECTS_COLLECTION).doc(projectId);
    await db.runTransaction(async (t) => {
        const doc = await t.get(ref);
        if (!doc.exists) return;
        const project = doc.data() as CodeProject;
        const files = project.files.filter(f => f.name !== fileName);
        t.update(ref, { files });
    });
}

export async function updateProjectAccess(projectId: string, level: 'public' | 'restricted', allowedIds: string[]) {
    if (!db) return;
    await db.collection(CODE_PROJECTS_COLLECTION).doc(projectId).update({ accessLevel: level, allowedUserIds: allowedIds });
}

export async function sendShareNotification(uid: string, type: string, link: string, fromName: string) {
    if (!db) return;
    await db.collection('invitations').add({
        toUserId: uid,
        type: 'session',
        groupName: type,
        link,
        fromName,
        status: 'pending',
        createdAt: Date.now(),
        toEmail: (await getUserProfile(uid))?.email,
        adminOwnerEmail: ADMIN_EMAIL
    });
}

// --- Whiteboard ---

export async function saveWhiteboardSession(id: string, elements: WhiteboardElement[]) {
    if (!db) return;
    await db.collection(WHITEBOARDS_COLLECTION).doc(id).set({ 
        elements: sanitizeData(elements),
        adminOwnerEmail: ADMIN_EMAIL 
    });
}

export function subscribeToWhiteboard(id: string, callback: (elements: WhiteboardElement[]) => void) {
    if (!db) {
        callback([]);
        return () => {};
    }
    return db.collection(WHITEBOARDS_COLLECTION).doc(id).onSnapshot(doc => {
        if (doc.exists) callback(doc.data()?.elements || []);
    }, () => {});
}

export async function updateWhiteboardElement(id: string, element: WhiteboardElement) {
    if (!db) return;
    const ref = db.collection(WHITEBOARDS_COLLECTION).doc(id);
    await db.runTransaction(async (t) => {
        const doc = await t.get(ref);
        const elements = doc.exists ? (doc.data()?.elements as WhiteboardElement[]) : [];
        const idx = elements.findIndex(e => e.id === element.id);
        if (idx > -1) elements[idx] = element; else elements.push(element);
        t.set(ref, { 
            elements: sanitizeData(elements),
            adminOwnerEmail: ADMIN_EMAIL 
        });
    });
}

export async function deleteWhiteboardElements(id: string, elementIds: string[]) {
    if (!db) return;
    const ref = db.collection(WHITEBOARDS_COLLECTION).doc(id);
    await db.runTransaction(async (t) => {
        const doc = await t.get(ref);
        if (!doc.exists) return;
        const elements = (doc.data()?.elements as WhiteboardElement[]).filter(e => !elementIds.includes(e.id));
        t.update(ref, { elements });
    });
}

// --- Blog ---

export async function ensureUserBlog(user: any): Promise<Blog> {
    if (!db) throw new Error("Database unavailable");
    const snap = await db.collection(BLOGS_COLLECTION).where('ownerId', '==', user.uid).get();
    if (!snap.empty) return { ...snap.docs[0].data(), id: snap.docs[0].id } as Blog;
    
    const blog: any = {
        ownerId: user.uid,
        authorName: user.displayName || 'Author',
        title: `${user.displayName}'s Blog`,
        description: "Welcome to my creative space.",
        createdAt: Date.now(),
        adminOwnerEmail: ADMIN_EMAIL
    };
    const ref = await db.collection(BLOGS_COLLECTION).add(blog);
    return { ...blog, id: ref.id };
}

export async function getCommunityPosts(): Promise<BlogPost[]> {
    if (!db) return [];
    const snap = await db.collection(POSTS_COLLECTION).where('status', '==', 'published').limit(50).get();
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as BlogPost));
}

export async function getUserPosts(blogId: string): Promise<BlogPost[]> {
    if (!db) return [];
    const snap = await db.collection(POSTS_COLLECTION).where('blogId', '==', blogId).get();
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as BlogPost));
}

export async function createBlogPost(post: BlogPost) {
    if (!db) return;
    await db.collection(POSTS_COLLECTION).add(sanitizeData(post));
}

export async function updateBlogPost(id: string, post: BlogPost) {
    if (!db) return;
    await db.collection(POSTS_COLLECTION).doc(id).set(sanitizeData(post), { merge: true });
}

export async function deleteBlogPost(id: string) {
    if (!db) return;
    await db.collection(POSTS_COLLECTION).doc(id).delete();
}

export async function updateBlogSettings(blogId: string, data: Partial<Blog>) {
    if (!db) return;
    await db.collection(BLOGS_COLLECTION).doc(blogId).update(data);
}

export async function addPostComment(postId: string, comment: Comment) {
  if (!db) return;
  const ref = db.collection(POSTS_COLLECTION).doc(postId);
  await ref.update({
    comments: firebase.firestore.FieldValue.arrayUnion(sanitizeData(comment)),
    commentCount: firebase.firestore.FieldValue.increment(1)
  });
}

export async function getBlogPost(id: string): Promise<BlogPost | null> {
    if (!db) return null;
    const doc = await db.collection(POSTS_COLLECTION).doc(id).get();
    return doc.exists ? ({ ...doc.data(), id: doc.id } as BlogPost) : null;
}

export async function createStripePortalSession(uid: string): Promise<string> {
    return "https://billing.stripe.com/p/session/test_123";
}

export async function createStripeCheckoutSession(uid: string): Promise<string> {
    return "https://checkout.stripe.com/c/pay/test_123";
}

export async function getBillingHistory(uid: string): Promise<any[]> {
    if (!db) return [];
    try {
        const snap = await db.collection('customers').doc(uid).collection('payments').orderBy('created', 'desc').get();
        return snap.docs.map(d => ({
            amount: d.data().amount / 100,
            date: new Date(d.data().created * 1000).toLocaleDateString(),
            ...d.data()
        }));
    } catch (e) {
        return [{ amount: 0.01, date: new Date().toLocaleDateString() }];
    }
}

export async function forceUpgradeDebug(uid: string): Promise<void> {
    if (!db) return;
    await db.collection(USERS_COLLECTION).doc(uid).update({ subscriptionTier: 'pro' });
}

// --- Groups & Members ---

export async function getUserGroups(uid: string): Promise<Group[]> {
  if (!db) return [];
  const snap = await db.collection(GROUPS_COLLECTION).where('memberIds', 'array-contains', uid).get();
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as Group));
}

export async function createGroup(name: string): Promise<string> {
  if (!db) return 'no-db';
  const group: any = {
    name,
    ownerId: auth?.currentUser?.uid,
    memberIds: [auth?.currentUser?.uid],
    createdAt: Date.now(),
    adminOwnerEmail: ADMIN_EMAIL
  };
  const ref = await db.collection(GROUPS_COLLECTION).add(group);
  return ref.id;
}

export async function deleteGroup(groupId: string): Promise<void> {
  if (!db) return;
  await db.collection(GROUPS_COLLECTION).doc(groupId).delete();
}

export async function renameGroup(groupId: string, newName: string): Promise<void> {
  if (!db) return;
  await db.collection(GROUPS_COLLECTION).doc(groupId).update({ name: newName });
}

export async function getGroupMembers(uids: string[]): Promise<UserProfile[]> {
  if (!db || !uids || uids.length === 0) return [];
  const snap = await db.collection(USERS_COLLECTION).where('uid', 'in', uids.slice(0, 10)).get();
  return snap.docs.map(d => d.data() as UserProfile);
}

export async function removeMemberFromGroup(groupId: string, memberId: string) {
  if (!db) return;
  await db.collection(GROUPS_COLLECTION).doc(groupId).update({
    memberIds: firebase.firestore.FieldValue.arrayRemove(memberId)
  });
}

export async function getUniqueGroupMembers(groupId: string): Promise<UserProfile[]> {
  if (!db) return [];
  const group = await db.collection(GROUPS_COLLECTION).doc(groupId).get();
  if (!group.exists) return [];
  return getGroupMembers(group.data()?.memberIds || []);
}

// --- Direct Messages ---

export async function getUserDMChannels(): Promise<ChatChannel[]> {
    if (!db || !auth?.currentUser) return [];
    const uid = auth.currentUser.uid;
    const snap = await db.collection('chat_channels').where('type', '==', 'dm').where('memberIds', 'array-contains', uid).get();
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as ChatChannel));
}

export async function createOrGetDMChannel(otherId: string, otherName: string): Promise<string> {
    if (!db || !auth?.currentUser) return 'no-db';
    const uid = auth.currentUser.uid;
    const combinedId = [uid, otherId].sort().join('_');
    const ref = db.collection('chat_channels').doc(combinedId);
    const snap = await ref.get();
    
    if (!snap.exists) {
        await ref.set({
            id: combinedId,
            name: `${auth.currentUser.displayName} & ${otherName}`,
            type: 'dm',
            memberIds: [uid, otherId],
            createdAt: Date.now(),
            adminOwnerEmail: ADMIN_EMAIL
        });
    }
    return combinedId;
}

// --- Chat Messages ---

export async function sendMessage(channelId: string, text: string, collectionPath: string, replyTo?: any, attachments?: any[]) {
    if (!db || !auth?.currentUser) return;
    const msg: any = {
        text,
        senderId: auth.currentUser.uid,
        senderName: auth.currentUser.displayName,
        senderImage: auth.currentUser.photoURL,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        replyTo,
        attachments,
        adminOwnerEmail: ADMIN_EMAIL
    };
    await db.collection(collectionPath).add(sanitizeData(msg));
}

export function subscribeToMessages(channelId: string, callback: (msgs: any[]) => void, collectionPath: string) {
    if (!db) {
        callback([]);
        return () => {};
    }
    return db.collection(collectionPath).orderBy('timestamp', 'asc').limitToLast(50).onSnapshot(snap => {
        callback(snap.docs.map(d => ({ ...d.data(), id: d.id })));
    }, () => {});
}

export async function deleteMessage(channelId: string, messageId: string, collectionPath: string) {
    if (!db) return;
    await db.collection(collectionPath).doc(messageId).delete();
}

// --- Career Center ---

export async function submitCareerApplication(app: CareerApplication) {
    if (!db) return;
    await db.collection(APPLICATIONS_COLLECTION).add(sanitizeData(app));
}

export async function createJobPosting(job: JobPosting) {
    if (!db) return;
    await db.collection(JOBS_COLLECTION).add(sanitizeData(job));
}

export async function getJobPostings(): Promise<JobPosting[]> {
    if (!db) return [];
    const snap = await db.collection(JOBS_COLLECTION).orderBy('postedAt', 'desc').get();
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as JobPosting));
}

export async function getAllCareerApplications(): Promise<CareerApplication[]> {
    if (!db) return [];
    const snap = await db.collection(APPLICATIONS_COLLECTION).orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as CareerApplication));
}

// --- Notebooks ---

export async function getCreatorNotebooks(ownerId: string): Promise<Notebook[]> {
    if (!db) return [];
    return db.collection('notebooks').where('author', '==', ownerId).get().then(snap => snap.docs.map(d => d.data() as Notebook));
}

// --- Cards ---

export async function saveCard(memory: AgentMemory, id: string): Promise<string> {
    if (!db || !auth?.currentUser) return id;
    const ref = db.collection(CARDS_COLLECTION).doc(id);
    await ref.set({ ...sanitizeData(memory), id, ownerId: auth.currentUser.uid }, { merge: true });
    return id;
}

export async function getCard(id: string): Promise<AgentMemory | null> {
    if (!db) return null;
    const doc = await db.collection(CARDS_COLLECTION).doc(id).get();
    return doc.exists ? (doc.data() as AgentMemory) : null;
}

export async function getUserCards(uid: string): Promise<AgentMemory[]> {
    if (!db) return [];
    const snap = await db.collection(CARDS_COLLECTION).where('ownerId', '==', uid).get();
    return snap.docs.map(d => d.data() as AgentMemory);
}

// --- Stats & Debug ---

export async function getGlobalStats(): Promise<GlobalStats> {
    if (!db) return { totalLogins: 0, uniqueUsers: 0 };
    try {
        const doc = await db.collection('stats').doc('global').get();
        return doc.exists ? (doc.data() as GlobalStats) : { totalLogins: 0, uniqueUsers: 0 };
    } catch(e) { return { totalLogins: 0, uniqueUsers: 0 }; }
}

export async function recalculateGlobalStats(): Promise<number> {
    if (!db) return 0;
    const userSnap = await db.collection(USERS_COLLECTION).get();
    const count = userSnap.size;
    await db.collection('stats').doc('global').set({
        uniqueUsers: count,
        totalLogins: firebase.firestore.FieldValue.increment(0),
        adminOwnerEmail: ADMIN_EMAIL
    }, { merge: true });
    return count;
}

export async function getDebugCollectionDocs(collectionName: string, limitCount: number = 20): Promise<any[]> {
    if (!db) return [];
    const snap = await db.collection(collectionName).limit(limitCount).get();
    return snap.docs.map(d => ({ ...d.data(), id: d.id }));
}

// --- Saved Words ---

export async function saveSavedWord(uid: string, wordData: any) {
    if (!db) return;
    await db.collection(USERS_COLLECTION).doc(uid).collection(SAVED_WORDS_COLLECTION).doc(wordData.word).set({
        ...wordData,
        adminOwnerEmail: ADMIN_EMAIL
    });
}

export async function getSavedWordForUser(uid: string, word: string) {
    if (!db) return null;
    const doc = await db.collection(USERS_COLLECTION).doc(uid).collection(SAVED_WORDS_COLLECTION).doc(word).get();
    return doc.exists ? doc.data() : null;
}
