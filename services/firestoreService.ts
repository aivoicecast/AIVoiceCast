
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
  TranscriptItem, ChannelVisibility, GeneratedIcon, BankingCheck, ShippingLabel, CoinTransaction, TodoItem, OfflinePaymentToken, MockInterviewRecording
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

export const ADMIN_GROUP = 'admin_neural_prism';

/**
 * Helper to check if a profile belongs to the admin group.
 * Defensive against undefined groups array.
 */
export const isUserAdmin = (profile: UserProfile | null): boolean => {
    if (!profile || !profile.groups || !Array.isArray(profile.groups)) return false;
    return profile.groups.includes(ADMIN_GROUP);
};

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

// --- Coins & Wallet ---
export const DEFAULT_MONTHLY_GRANT = 1000000;

export async function registerIdentity(uid: string, publicKey: string, certificate: string) {
    if (!db || !uid) return;
    await updateDoc(doc(db, USERS_COLLECTION, uid), { publicKey, certificate });
}

export async function transferCoins(toId: string, toName: string, amount: number, memo?: string): Promise<void> {
    if (!db || !auth?.currentUser) throw new Error("Database unavailable");
    const fromId = auth.currentUser.uid;
    const fromName = auth.currentUser.displayName || 'Sender';
    const fromRef = doc(db, USERS_COLLECTION, fromId);
    const toRef = doc(db, USERS_COLLECTION, toId);
    const txId = generateSecureId();
    const txRef = doc(db, TRANSACTIONS_COLLECTION, txId);
    
    await runTransaction(db, async (transaction) => {
        const fromSnap = await transaction.get(fromRef);
        if (!fromSnap.exists()) throw new Error("Sender not found");
        const fromData = fromSnap.data() as UserProfile;
        if ((fromData.coinBalance || 0) < amount) throw new Error("Insufficient coin balance");
        
        const toSnap = await transaction.get(toRef);
        if (!toSnap.exists()) throw new Error("Recipient not found");
        const toData = toSnap.data() as UserProfile;

        const tx: CoinTransaction = { 
          id: txId, fromId, fromName, toId, toName, amount, type: 'transfer', memo, timestamp: Date.now(), isVerified: false 
        };
        
        const invRef = doc(collection(db, INVITATIONS_COLLECTION), generateSecureId());
        const notification: Invitation = {
            id: invRef.id, fromUserId: fromId, fromName: fromName, toEmail: toData.email || '',
            groupId: txId, groupName: 'VoiceCoin Transfer', status: 'pending', createdAt: Date.now(),
            type: 'coin', amount: amount, link: `${window.location.origin}${window.location.pathname}?view=coin_wallet`
        };

        transaction.update(fromRef, { coinBalance: increment(-amount) });
        transaction.set(txRef, sanitizeData(tx));
        transaction.set(invRef, sanitizeData(notification));
    });
}

export async function claimOnlineTransfer(txId: string): Promise<void> {
    if (!db || !auth?.currentUser) throw new Error("Auth required");
    const txRef = doc(db, TRANSACTIONS_COLLECTION, txId);
    const recipientRef = doc(db, USERS_COLLECTION, auth.currentUser.uid);

    await runTransaction(db, async (t) => {
        const txSnap = await t.get(txRef);
        if (!txSnap.exists()) throw new Error("Transfer record not found.");
        const txData = txSnap.data() as CoinTransaction;
        if (txData.isVerified) throw new Error("Transfer already claimed.");
        if (txData.toId !== auth.currentUser?.uid) throw new Error("Unauthorized claim.");
        t.update(recipientRef, { coinBalance: increment(txData.amount) });
        t.update(txRef, { isVerified: true, memo: (txData.memo || "") + " (Claimed)" });
    });
}

export async function claimOfflinePayment(token: OfflinePaymentToken): Promise<void> {
    if (!db || !auth?.currentUser) throw new Error("Auth required");
    const txRef = doc(db, TRANSACTIONS_COLLECTION, `offline-${token.nonce}`);
    const recipientRef = doc(db, USERS_COLLECTION, token.recipientId === 'any' ? auth.currentUser.uid : token.recipientId);
    const senderRef = doc(db, USERS_COLLECTION, token.senderId);

    await runTransaction(db, async (t) => {
        const txSnap = await t.get(txRef);
        if (txSnap.exists()) throw new Error("Payment already claimed.");
        const senderSnap = await t.get(senderRef);
        if (!senderSnap.exists()) throw new Error("Sender not found.");
        const senderData = senderSnap.data() as UserProfile;
        if ((senderData.coinBalance || 0) < token.amount) throw new Error("Sender has insufficient funds.");

        const tx: CoinTransaction = {
            id: txRef.id, fromId: token.senderId, fromName: token.senderName, toId: auth.currentUser?.uid || '',
            toName: auth.currentUser?.displayName || 'Recipient', amount: token.amount, type: 'offline',
            memo: "Verified Offline Payment", timestamp: token.timestamp, isVerified: true,
            offlineToken: btoa(JSON.stringify(token))
        };

        t.update(senderRef, { coinBalance: increment(-token.amount) });
        t.update(recipientRef, { coinBalance: increment(token.amount) });
        t.set(txRef, sanitizeData(tx));
    });
}

export async function getCoinTransactions(uid: string): Promise<CoinTransaction[]> {
    if (!db) return [];
    try {
        const qFrom = query(collection(db, TRANSACTIONS_COLLECTION), where('fromId', '==', uid), limit(100));
        const qTo = query(collection(db, TRANSACTIONS_COLLECTION), where('toId', '==', uid), limit(100));
        const [fromSnap, toSnap] = await Promise.all([getDocs(qFrom), getDocs(qTo)]);
        const all = [ ...fromSnap.docs.map(d => ({ ...d.data(), id: d.id })), ...toSnap.docs.map(d => ({ ...d.data(), id: d.id })) ] as CoinTransaction[];
        return all.sort((a, b) => b.timestamp - a.timestamp);
    } catch(e) { return []; }
}

export async function checkAndGrantMonthlyCoins(uid: string): Promise<number> {
    if (!db) return 0;
    const ref = doc(db, USERS_COLLECTION, uid);
    let granted = 0;
    await runTransaction(db, async (t) => {
        const snap = await t.get(ref);
        if (!snap.exists()) return;
        const data = snap.data() as UserProfile;
        const now = Date.now();
        const lastGrant = data.lastCoinGrantAt || 0;
        if (now - lastGrant > 86400000 * 30) {
            granted = DEFAULT_MONTHLY_GRANT;
            const txId = generateSecureId();
            const txRef = doc(db, TRANSACTIONS_COLLECTION, txId);
            const tx: CoinTransaction = { id: txId, fromId: 'system', fromName: 'AIVoiceCast', toId: uid, toName: data.displayName, amount: granted, type: 'grant', timestamp: now, isVerified: true };
            t.update(ref, { coinBalance: increment(granted), lastCoinGrantAt: now });
            t.set(txRef, sanitizeData(tx));
        }
    });
    return granted;
}

export async function awardContributionBonus(ownerId: string, type: 'podcast' | 'blog' | 'doc', sourceId: string): Promise<void> {
    if (!db || !ownerId) return;
    const reward = 1000;
    const userRef = doc(db, USERS_COLLECTION, ownerId);
    const txId = generateSecureId();
    const txRef = doc(db, TRANSACTIONS_COLLECTION, txId);
    
    await runTransaction(db, async (t) => {
        const tx: CoinTransaction = { 
            id: txId, fromId: 'system', fromName: 'Contribution Pool', 
            toId: ownerId, toName: 'Creator', amount: reward, 
            type: 'contribution', memo: `Reward for high quality ${type} engagement`, 
            timestamp: Date.now(), isVerified: true
        };
        t.update(userRef, { coinBalance: increment(reward) });
        t.set(txRef, sanitizeData(tx));
    });
}

export async function claimCoinCheck(checkId: string): Promise<number> {
    if (!db || !auth?.currentUser) throw new Error("Database unavailable");
    const uid = auth.currentUser.uid;
    const checkRef = doc(db, CHECKS_COLLECTION, checkId);
    let amount = 0;
    await runTransaction(db, async (t) => {
        const snap = await t.get(checkRef);
        if (!snap.exists()) throw new Error("Check not found");
        const checkData = snap.data() as BankingCheck;
        if (!checkData.isCoinCheck || checkData.isClaimed) throw new Error("Invalid or claimed check");
        amount = checkData.coinAmount || 0;
        const userRef = doc(db, USERS_COLLECTION, uid);
        const txId = generateSecureId();
        const txRef = doc(db, TRANSACTIONS_COLLECTION, txId);
        const tx: CoinTransaction = { id: txId, fromId: checkData.ownerId || 'unknown', fromName: checkData.senderName, toId: uid, toName: auth.currentUser?.displayName || 'Recipient', amount, type: 'check', memo: `Claimed Check #${checkData.checkNumber}`, timestamp: Date.now(), isVerified: true };
        t.update(checkRef, { isClaimed: true });
        t.update(userRef, { coinBalance: increment(amount) });
        t.set(txRef, sanitizeData(tx));
    });
    return amount;
}

// --- Universal Creators ---
export async function saveIcon(icon: GeneratedIcon): Promise<string> {
    if (!db) return icon.id;
    const id = icon.id || generateSecureId();
    await setDoc(doc(db, ICONS_COLLECTION, id), sanitizeData({ ...icon, id }));
    return id;
}

export async function getIcon(id: string): Promise<GeneratedIcon | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, ICONS_COLLECTION, id));
    return snap.exists() ? (snap.data() as GeneratedIcon) : null;
}

export async function saveBankingCheck(check: BankingCheck): Promise<string> {
    if (!db) return check.id || 'local';
    const id = check.id || generateSecureId();
    const ref = doc(db, CHECKS_COLLECTION, id);
    if (check.isCoinCheck && check.coinAmount && auth?.currentUser) {
        const userRef = doc(db, USERS_COLLECTION, auth.currentUser.uid);
        await runTransaction(db, async (t) => {
            const userSnap = await t.get(userRef);
            if (!userSnap.exists()) throw new Error("User not found");
            const userData = userSnap.data() as UserProfile;
            if ((userData.coinBalance || 0) < check.coinAmount!) throw new Error("Insufficient balance.");
            t.update(userRef, { coinBalance: increment(-check.coinAmount!) });
            t.set(ref, sanitizeData({ ...check, id }));
        });
    } else {
        await setDoc(ref, sanitizeData({ ...check, id }));
    }
    return id;
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
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as BankingCheck)).sort((a, b) => b.date.localeCompare(a.date));
}

export async function deleteCheck(id: string): Promise<void> {
    if (!db || !id) return;
    await deleteDoc(doc(db, CHECKS_COLLECTION, id));
}

export async function saveShippingLabel(label: ShippingLabel): Promise<string> {
    if (!db) return label.id || 'local';
    const id = label.id || generateSecureId();
    await setDoc(doc(db, SHIPPING_COLLECTION, id), sanitizeData({ ...label, id }));
    return id;
}

export async function saveCodeProject(project: CodeProject): Promise<string> {
    if (!db) return '';
    const id = project.id === 'init' ? generateSecureId() : project.id;
    await setDoc(doc(db, CODE_PROJECTS_COLLECTION, id), sanitizeData({ ...project, id }));
    return id;
}

export async function getCodeProject(id: string): Promise<CodeProject | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, CODE_PROJECTS_COLLECTION, id));
    return snap.exists() ? (snap.data() as CodeProject) : null;
}

export async function createBooking(booking: Booking): Promise<string> {
    if (!db) return '';
    const id = generateSecureId();
    await setDoc(doc(db, BOOKINGS_COLLECTION, id), sanitizeData({ ...booking, id }));
    return id;
}

export async function saveDiscussion(discussion: CommunityDiscussion): Promise<string> {
    if (!db) return 'no-db';
    const id = generateSecureId();
    await setDoc(doc(db, DISCUSSIONS_COLLECTION, id), sanitizeData({ ...discussion, id }));
    return id;
}

export async function updateDiscussion(id: string, data: Partial<CommunityDiscussion>) {
    if (!db || !id) return;
    await updateDoc(doc(db, DISCUSSIONS_COLLECTION, id), sanitizeData(data));
}

export async function saveCard(card: AgentMemory, id?: string): Promise<string> {
    if (!db) return id || 'local';
    const finalId = id || generateSecureId();
    await setDoc(doc(db, CARDS_COLLECTION, finalId), sanitizeData({ ...card, id: finalId, ownerId: auth?.currentUser?.uid }));
    return finalId;
}

export async function deleteCard(id: string): Promise<void> {
    if (!db || !id) return;
    await deleteDoc(doc(db, CARDS_COLLECTION, id));
}

export async function createBlogPost(post: BlogPost): Promise<string> {
    if (!db) return '';
    const id = generateSecureId();
    await setDoc(doc(db, POSTS_COLLECTION, id), sanitizeData({ ...post, id }));
    return id;
}

export async function saveTask(task: TodoItem): Promise<string> {
    if (!db || !auth?.currentUser) return task.id;
    const id = task.id || generateSecureId();
    await setDoc(doc(db, TASKS_COLLECTION, id), sanitizeData({ ...task, id, ownerId: auth.currentUser.uid }));
    return id;
}

export async function getUserTasks(uid: string): Promise<TodoItem[]> {
    if (!db) return [];
    const q = query(collection(db, TASKS_COLLECTION), where('ownerId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as TodoItem));
}

// --- User Profile ---
export async function syncUserProfile(user: any): Promise<void> {
  if (!user || !db) return;
  const userRef = doc(db, USERS_COLLECTION, user.uid);
  try {
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, { uid: user.uid, email: user.email, displayName: user.displayName, photoURL: user.photoURL, createdAt: Date.now(), lastLogin: Date.now(), subscriptionTier: 'free', apiUsageCount: 0, groups: [], coinBalance: DEFAULT_MONTHLY_GRANT, lastCoinGrantAt: Date.now() });
        await setDoc(doc(db, 'stats', 'global'), { uniqueUsers: increment(1) }, { merge: true });
      } else {
        await updateDoc(userRef, { uid: user.uid, lastLogin: Date.now(), photoURL: user.photoURL || snap.data()?.photoURL, displayName: user.displayName || snap.data()?.displayName });
      }
      await updateDoc(doc(db, 'stats', 'global'), { totalLogins: increment(1) });
  } catch (e) {}
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (!db || !uid) return null;
  const snap = await getDoc(doc(db, USERS_COLLECTION, uid));
  return snap.exists() ? ({ ...snap.data(), uid: snap.id } as UserProfile) : null;
}

export async function updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
    if (!db || !uid) return;
    await updateDoc(doc(db, USERS_COLLECTION, uid), sanitizeData(data));
}

export async function deleteUser(uid: string): Promise<void> {
    if (!db || !uid) return;
    await deleteDoc(doc(db, USERS_COLLECTION, uid));
}

export async function getAllUsers(): Promise<UserProfile[]> {
    if (!db) return [];
    const snap = await getDocs(collection(db, USERS_COLLECTION));
    return snap.docs.map(d => ({ ...d.data(), uid: d.id } as UserProfile));
}

export async function getUserProfileByEmail(email: string): Promise<UserProfile | null> {
    if (!db || !email) return null;
    const q = query(collection(db, USERS_COLLECTION), where('email', '==', email), limit(1));
    const snap = await getDocs(q);
    return snap.empty ? null : ({ ...snap.docs[0].data(), uid: snap.docs[0].id } as UserProfile);
}

// --- Groups ---
export async function createGroup(name: string): Promise<string> {
    if (!db || !auth?.currentUser) throw new Error("Auth required");
    const uid = auth.currentUser.uid;
    const id = generateSecureId();
    const group: Group = { id, name, ownerId: uid, memberIds: [uid], createdAt: Date.now() };
    await setDoc(doc(db, GROUPS_COLLECTION, id), sanitizeData(group));
    return id;
}

export async function getUserGroups(uid: string): Promise<Group[]> {
    if (!db || !uid) return [];
    const q = query(collection(db, GROUPS_COLLECTION), where('memberIds', 'array-contains', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Group));
}

export async function getGroupMembers(uids: string[]): Promise<UserProfile[]> {
    if (!db || uids.length === 0) return [];
    const q = query(collection(db, USERS_COLLECTION), where(documentId(), 'in', uids.slice(0, 10)));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), uid: d.id } as UserProfile));
}

export async function removeMemberFromGroup(groupId: string, memberId: string): Promise<void> {
    if (!db || !groupId) return;
    await updateDoc(doc(db, GROUPS_COLLECTION, groupId), { memberIds: arrayRemove(memberId) });
}

export async function deleteGroup(groupId: string): Promise<void> {
    if (!db || !groupId) return;
    await deleteDoc(doc(db, GROUPS_COLLECTION, groupId));
}

export async function renameGroup(groupId: string, name: string): Promise<void> {
    if (!db || !groupId) return;
    await updateDoc(doc(db, GROUPS_COLLECTION, groupId), { name });
}

export async function sendInvitation(groupId: string, toEmail: string): Promise<void> {
    if (!db || !auth?.currentUser || !groupId) return;
    const groupSnap = await getDoc(doc(db, GROUPS_COLLECTION, groupId));
    if (!groupSnap.exists()) return;
    const inv: Invitation = { 
        id: '', 
        fromUserId: auth.currentUser.uid, 
        fromName: auth.currentUser.displayName || 'Friend', 
        toEmail, 
        groupId, 
        groupName: groupSnap.data()?.name, 
        status: 'pending', 
        createdAt: Date.now(),
        type: 'group' 
    };
    await addDoc(collection(db, INVITATIONS_COLLECTION), sanitizeData(inv));
}

export async function getPendingInvitations(email: string): Promise<Invitation[]> {
    if (!db || !email) return [];
    const q = query(collection(db, INVITATIONS_COLLECTION), where('toEmail', '==', email), where('status', '==', 'pending'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Invitation));
}

export async function respondToInvitation(invitation: Invitation, accept: boolean): Promise<void> {
    if (!db || !auth?.currentUser || !invitation.id) return;
    if (invitation.type === 'coin' && accept && invitation.groupId) {
        await claimOnlineTransfer(invitation.groupId);
    }
    await updateDoc(doc(db, INVITATIONS_COLLECTION, invitation.id), { status: accept ? 'accepted' : 'rejected' });
    
    if (accept && (invitation.type === 'group' || (!invitation.type && invitation.groupId && !invitation.groupId.startsWith('local-')))) {
        await updateDoc(doc(db, GROUPS_COLLECTION, invitation.groupId), { memberIds: arrayUnion(auth.currentUser.uid) });
    }
}

// --- Bookings ---
export async function getUserBookings(uid: string, email: string): Promise<Booking[]> {
    if (!db) return [];
    const q1 = uid ? query(collection(db, BOOKINGS_COLLECTION), where('userId', '==', uid)) : null;
    const q2 = email ? query(collection(db, BOOKINGS_COLLECTION), where('invitedEmail', '==', email)) : null;
    const [snap1, snap2] = await Promise.all([ q1 ? getDocs(q1) : Promise.resolve({ docs: [] }), q2 ? getDocs(q2) : Promise.resolve({ docs: [] }) ]);
    const combined = [...snap1.docs, ...snap2.docs];
    return Array.from(new Map(combined.map(d => [d.id, { ...d.data(), id: d.id } as Booking])).values());
}

export async function getPendingBookings(email: string): Promise<Booking[]> {
    if (!db || !email) return [];
    const q = query(collection(db, BOOKINGS_COLLECTION), where('invitedEmail', '==', email), where('status', '==', 'pending'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Booking));
}

export async function respondToBooking(bookingId: string, accept: boolean): Promise<void> {
    if (!db || !bookingId) return;
    await updateDoc(doc(db, BOOKINGS_COLLECTION, bookingId), { status: accept ? 'scheduled' : 'rejected' });
}

export async function cancelBooking(id: string): Promise<void> {
    if (!db || !id) return;
    await updateDoc(doc(db, BOOKINGS_COLLECTION, id), { status: 'cancelled' });
}

export async function updateBookingRecording(bookingId: string, recordingUrl: string, transcriptUrl: string): Promise<void> {
    if (!db || !bookingId) return;
    await updateDoc(doc(db, BOOKINGS_COLLECTION, bookingId), { recordingUrl, transcriptUrl, status: 'completed' });
}

export async function deleteBookingRecording(id: string): Promise<void> {
    if (!db || !id) return;
    await updateDoc(doc(db, BOOKINGS_COLLECTION, id), { recordingUrl: null, transcriptUrl: null });
}

// --- Channels ---
export async function getPublicChannels(): Promise<Channel[]> {
    if (!db) return [];
    const q = query(collection(db, CHANNELS_COLLECTION), where('visibility', '==', 'public'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Channel));
}

export async function getChannelsByIds(ids: string[]): Promise<Channel[]> {
    if (!db || ids.length === 0) return [];
    const q = query(collection(db, CHANNELS_COLLECTION), where(documentId(), 'in', ids.slice(0, 10)));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Channel));
}

export async function getCreatorChannels(uid: string): Promise<Channel[]> {
    if (!db || !uid) return [];
    const q = query(collection(db, CHANNELS_COLLECTION), where('ownerId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Channel));
}

export async function subscribeToPublicChannels(callback: (channels: Channel[]) => void) {
    if (!db) return () => {};
    const q = query(collection(db, CHANNELS_COLLECTION), where('visibility', '==', 'public'));
    return onSnapshot(q, (snap) => {
        callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as Channel)));
    });
}

export async function publishChannelToFirestore(channel: Channel) {
  if (!db) return;
  await setDoc(doc(db, CHANNELS_COLLECTION, channel.id), sanitizeData(channel));
}

export async function deleteChannelFromFirestore(id: string): Promise<void> {
    if (!db || !id) return;
    await deleteDoc(doc(db, CHANNELS_COLLECTION, id));
}

export async function addChannelAttachment(channelId: string, attachment: Attachment): Promise<void> {
    if (!db || !channelId) return;
    await updateDoc(doc(db, CHANNELS_COLLECTION, channelId), { appendix: arrayUnion(attachment) });
}

// --- Engagement & Stats ---
export async function voteChannel(ch: Channel, type: 'like' | 'dislike') {
    if (!db) return;
    const incrementVal = type === 'like' ? 1 : -1;
    await updateDoc(doc(db, CHANNELS_COLLECTION, ch.id), { likes: increment(incrementVal) });
    await setDoc(doc(db, CHANNEL_STATS_COLLECTION, ch.id), { likes: increment(incrementVal) }, { merge: true });
    if (type === 'like' && ch.ownerId) {
        awardContributionBonus(ch.ownerId, 'podcast', ch.id).catch(console.error);
    }
}

export async function shareChannel(id: string) {
    if (!db || !id) return;
    await setDoc(doc(db, CHANNEL_STATS_COLLECTION, id), { shares: increment(1) }, { merge: true });
}

export function subscribeToChannelStats(id: string, callback: (stats: Partial<ChannelStats>) => void, defaults: ChannelStats) {
    if (!db || !id) return () => {};
    return onSnapshot(doc(db, CHANNEL_STATS_COLLECTION, id), (snap) => {
        if (snap.exists()) callback(snap.data() as ChannelStats);
        else callback(defaults);
    });
}

// --- Comments ---
export async function addCommentToChannel(channelId: string, comment: Comment) {
    if (!db || !channelId) return;
    await updateDoc(doc(db, CHANNELS_COLLECTION, channelId), { comments: arrayUnion(sanitizeData(comment)) });
}

export async function deleteCommentFromChannel(channelId: string, commentId: string) {
    if (!db || !channelId) return;
    const snap = await getDoc(doc(db, CHANNELS_COLLECTION, channelId));
    if (!snap.exists()) return;
    const comments = (snap.data()?.comments || []) as Comment[];
    const next = comments.filter(c => c.id !== commentId);
    await updateDoc(doc(db, CHANNELS_COLLECTION, channelId), { comments: next });
}

export async function updateCommentInChannel(channelId: string, updated: Comment) {
    if (!db || !channelId) return;
    const snap = await getDoc(doc(db, CHANNELS_COLLECTION, channelId));
    if (!snap.exists()) return;
    const comments = (snap.data()?.comments || []) as Comment[];
    const next = comments.map(c => c.id === updated.id ? sanitizeData(updated) : c);
    await updateDoc(doc(db, CHANNELS_COLLECTION, channelId), { comments: next });
}

export async function uploadCommentAttachment(file: File, path: string): Promise<string> {
    if (!storage) throw new Error("Storage unavailable");
    const r = ref(storage, path);
    await uploadBytes(r, file);
    return await getDownloadURL(r);
}

// --- Activity & Usage ---
export async function incrementApiUsage(uid: string) {
    if (!db || !uid) return;
    await updateDoc(doc(db, USERS_COLLECTION, uid), { apiUsageCount: increment(1) });
}

export async function logUserActivity(type: string, data: any) {
    if (!db || !auth?.currentUser) return;
    await addDoc(collection(db, 'activity_logs'), { uid: auth.currentUser.uid, type, data, timestamp: Date.now() });
}

// --- Admin ---
export async function seedDatabase() {
    if (!db) return;
    for (const ch of HANDCRAFTED_CHANNELS) {
        await setDoc(doc(db, CHANNELS_COLLECTION, ch.id), sanitizeData(ch));
    }
}

export async function recalculateGlobalStats(): Promise<number> {
    if (!db) return 0;
    const snap = await getDocs(collection(db, USERS_COLLECTION));
    const count = snap.size;
    await setDoc(doc(db, 'stats', 'global'), { uniqueUsers: count }, { merge: true });
    return count;
}

export async function claimSystemChannels(email: string): Promise<number> {
    if (!db) return 0;
    const q = query(collection(db, CHANNELS_COLLECTION), where('ownerId', '==', null));
    const snap = await getDocs(q);
    const user = await getUserProfileByEmail(email);
    if (!user) throw new Error("User not found");
    let count = 0;
    for (const d of snap.docs) {
        await updateDoc(d.ref, { ownerId: user.uid, author: user.displayName });
        count++;
    }
    return count;
}

export async function setUserSubscriptionTier(uid: string, tier: SubscriptionTier) {
    if (!db || !uid) return;
    await updateDoc(doc(db, USERS_COLLECTION, uid), { subscriptionTier: tier });
}

export async function getDebugCollectionDocs(name: string, count: number) {
    if (!db) return [];
    const q = query(collection(db, name), limit(count));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id }));
}

export async function getGlobalStats(): Promise<GlobalStats> {
    if (!db) return { totalLogins: 0, uniqueUsers: 0 };
    const snap = await getDoc(doc(db, 'stats', 'global'));
    return snap.exists() ? (snap.data() as GlobalStats) : { totalLogins: 0, uniqueUsers: 0 };
}

// --- Recordings ---
export async function saveRecordingReference(data: RecordingSession): Promise<void> {
    if (!db) return;
    await setDoc(doc(db, RECORDINGS_COLLECTION, data.id), sanitizeData(data));
}

export async function getUserRecordings(uid: string): Promise<RecordingSession[]> {
    if (!db || !uid) return [];
    const q = query(collection(db, RECORDINGS_COLLECTION), where('userId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as RecordingSession));
}

export async function deleteRecordingReference(id: string, mediaUrl: string, transcriptUrl: string): Promise<void> {
    if (!db || !id) return;
    await deleteDoc(doc(db, RECORDINGS_COLLECTION, id));
}

// --- Discussions/Docs ---
export async function getDiscussionById(id: string): Promise<CommunityDiscussion | null> {
    if (!db || !id) return null;
    const snap = await getDoc(doc(db, DISCUSSIONS_COLLECTION, id));
    return snap.exists() ? ({ ...snap.data(), id: snap.id } as CommunityDiscussion) : null;
}

export function subscribeToDiscussion(id: string, callback: (d: CommunityDiscussion) => void) {
    if (!db || !id) return () => {};
    return onSnapshot(doc(db, DISCUSSIONS_COLLECTION, id), (snap) => {
        if (snap.exists()) callback({ ...snap.data(), id: snap.id } as CommunityDiscussion);
    });
}

export async function saveDiscussionDesignDoc(id: string, designDoc: string, title: string) {
    if (!db || !id) return;
    await updateDoc(doc(db, DISCUSSIONS_COLLECTION, id), { designDoc, title, updatedAt: Date.now() });
}

export async function deleteDiscussion(id: string) {
    if (!db || !id) return;
    await deleteDoc(doc(db, DISCUSSIONS_COLLECTION, id));
}

export async function updateDiscussionVisibility(id: string, visibility: ChannelVisibility, groupIds: string[]) {
    if (!db || !id) return;
    await updateDoc(doc(db, DISCUSSIONS_COLLECTION, id), { visibility, groupIds });
}

export async function getUserDesignDocs(uid: string): Promise<CommunityDiscussion[]> {
    if (!db || !uid) return [];
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
    const q = query(collection(db, DISCUSSIONS_COLLECTION), where('visibility', '==', 'group'), where('groupIds', 'array-contains-any', groupIds));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as CommunityDiscussion));
}

// --- Cloud Storage / Projects ---
export async function listCloudDirectory(path: string): Promise<CloudItem[]> {
    if (!storage || !path) return [];
    const r = ref(storage, path);
    const res = await listAll(r);
    const folders = res.prefixes.map(p => ({ name: p.name, fullPath: p.fullPath, isFolder: true }));
    const files = await Promise.all(res.items.map(async (i) => {
        const meta = await getMetadata(i);
        return { name: i.name, fullPath: i.fullPath, isFolder: false, size: meta.size, url: await getDownloadURL(i) };
    }));
    return [...folders, ...files];
}

export async function saveProjectToCloud(path: string, filename: string, content: string): Promise<string | undefined> {
    if (!storage || !path || !filename) return;
    const r = ref(storage, `${path}/${filename}`);
    const blob = new Blob([content], { type: 'text/plain' });
    await uploadBytes(r, blob);
    return await getDownloadURL(r);
}

export async function deleteCloudItem(path: string) {
    if (!storage || !path) return;
    await deleteObject(ref(storage, path));
}

export async function createCloudFolder(path: string, name: string) {
    if (!storage || !path || !name) return;
    await saveProjectToCloud(`${path}/${name}`, '.keep', '');
}

export function subscribeToCodeProject(id: string, callback: (p: CodeProject) => void) {
    if (!db || !id) return () => {};
    return onSnapshot(doc(db, CODE_PROJECTS_COLLECTION, id), (snap) => {
        if (snap.exists()) callback({ ...snap.data(), id: snap.id } as CodeProject);
    });
}

export async function updateCodeFile(id: string, file: CodeFile) {
    if (!db || !id) return;
    const snap = await getDoc(doc(db, CODE_PROJECTS_COLLECTION, id));
    if (!snap.exists()) return;
    const files = (snap.data()?.files || []) as CodeFile[];
    let exists = false;
    const next = files.map(f => {
        if (f.path === file.path) {
            exists = true;
            return sanitizeData(file);
        }
        return f;
    });
    const finalFiles = exists ? next : [...next, sanitizeData(file)];
    await updateDoc(doc(db, CODE_PROJECTS_COLLECTION, id), { files: finalFiles, lastModified: Date.now() });
}

export async function updateCursor(id: string, cursor: CursorPosition) {
    if (!db || !id) return;
    await updateDoc(doc(db, CODE_PROJECTS_COLLECTION, id), { [`cursors.${cursor.clientId}`]: sanitizeData(cursor) });
}

export async function claimCodeProjectLock(id: string, activeClientId: string) {
    if (!db || !id) return;
    await updateDoc(doc(db, CODE_PROJECTS_COLLECTION, id), { activeClientId });
}

export async function updateProjectActiveFile(id: string, path: string) {
    if (!db || !id) return;
    await updateDoc(doc(db, CODE_PROJECTS_COLLECTION, id), { activeFilePath: path });
}

export async function deleteCodeFile(id: string, path: string) {
    if (!db || !id) return;
    const snap = await getDoc(doc(db, CODE_PROJECTS_COLLECTION, id));
    if (!snap.exists()) return;
    const files = (snap.data()?.files || []) as CodeFile[];
    const next = files.filter(f => f.path !== path);
    await updateDoc(doc(db, CODE_PROJECTS_COLLECTION, id), { files: next });
}

export async function updateProjectAccess(id: string, accessLevel: 'public' | 'restricted', allowedUserIds: string[]) {
    if (!db || !id) return;
    await updateDoc(doc(db, CODE_PROJECTS_COLLECTION, id), { accessLevel, allowedUserIds });
}

export async function sendShareNotification(toUid: string, invite: Invitation) {
    if (!db || !toUid) return;
    await addDoc(collection(db, INVITATIONS_COLLECTION), sanitizeData(invite));
}

export async function deleteCloudFolderRecursive(path: string) {
    if (!storage || !path) return;
    const r = ref(storage, path);
    const res = await listAll(r);
    for (const item of res.items) await deleteObject(item);
    for (const prefix of res.prefixes) await deleteCloudFolderRecursive(prefix.fullPath);
}

// --- Whiteboard ---
export function subscribeToWhiteboard(id: string, callback: (elements: WhiteboardElement[]) => void) {
    if (!db || !id) return () => {};
    return onSnapshot(doc(db, WHITEBOARDS_COLLECTION, id), (snap) => {
        if (snap.exists()) callback(snap.data()?.elements || []);
    });
}

export async function saveWhiteboardSession(id: string, elements: WhiteboardElement[]) {
    if (!db || !id) return;
    await setDoc(doc(db, WHITEBOARDS_COLLECTION, id), { elements: sanitizeData(elements) }, { merge: true });
}

export async function updateWhiteboardElement(id: string, element: WhiteboardElement) {
    if (!db || !id) return;
    await updateDoc(doc(db, WHITEBOARDS_COLLECTION, id), { elements: arrayUnion(sanitizeData(element)) });
}

export async function deleteWhiteboardElements(id: string) {
    if (!db || !id) return;
    await updateDoc(doc(db, WHITEBOARDS_COLLECTION, id), { elements: [] });
}

// --- Blog ---
export async function ensureUserBlog(user: any): Promise<Blog> {
    if (!db || !user) throw new Error("DB offline or user missing");
    const q = query(collection(db, BLOGS_COLLECTION), where('ownerId', '==', user.uid));
    const snap = await getDocs(q);
    if (!snap.empty) return { ...snap.docs[0].data(), id: snap.docs[0].id } as Blog;
    const id = generateSecureId();
    const blog: Blog = { id, ownerId: user.uid, authorName: user.displayName || 'Author', title: `${user.displayName}'s Blog`, description: 'My thoughts on AI and the future.', createdAt: Date.now() };
    await setDoc(doc(db, BLOGS_COLLECTION, id), sanitizeData(blog));
    return blog;
}

export async function getCommunityPosts(): Promise<BlogPost[]> {
    if (!db) return [];
    const q = query(collection(db, POSTS_COLLECTION), where('status', '==', 'published'));
    const snap = await getDocs(q);
    const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as BlogPost));
    return data.sort((a, b) => (b.publishedAt || b.createdAt) - (a.publishedAt || a.createdAt));
}

export async function getUserPosts(blogId: string): Promise<BlogPost[]> {
    if (!db || !blogId) return [];
    const q = query(collection(db, POSTS_COLLECTION), where('blogId', '==', blogId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as BlogPost));
}

export async function getBlogPost(id: string): Promise<BlogPost | null> {
    if (!db || !id) return null;
    const snap = await getDoc(doc(db, POSTS_COLLECTION, id));
    return snap.exists() ? ({ ...snap.data(), id: snap.id } as BlogPost) : null;
}

export async function updateBlogPost(id: string, data: Partial<BlogPost>) {
    if (!db || !id) return;
    await updateDoc(doc(db, POSTS_COLLECTION, id), sanitizeData(data));
}

export async function deleteBlogPost(id: string) {
    if (!db || !id) return;
    await deleteDoc(doc(db, POSTS_COLLECTION, id));
}

export async function updateBlogSettings(id: string, data: Partial<Blog>) {
    if (!db || !id) return;
    await updateDoc(doc(db, BLOGS_COLLECTION, id), { ...sanitizeData(data), ownerId: auth?.currentUser?.uid });
}

export async function addPostComment(postId: string, comment: Comment) {
    if (!db || !postId) return;
    await updateDoc(doc(db, POSTS_COLLECTION, postId), { comments: arrayUnion(sanitizeData(comment)), commentCount: increment(1) });
}

// --- Chat ---
export async function sendMessage(channelId: string, text: string, path: string, replyTo?: any, attachments?: any[]) {
    if (!db || !auth?.currentUser || !path) return;
    const msg: RealTimeMessage = { id: '', text, senderId: auth.currentUser.uid, senderName: auth.currentUser.displayName || 'Anonymous', senderImage: auth.currentUser.photoURL || '', timestamp: Timestamp.now(), replyTo };
    if (attachments) (msg as any).attachments = sanitizeData(attachments);
    await addDoc(collection(db, path), sanitizeData(msg));
}

export function subscribeToMessages(channelId: string, callback: (msgs: RealTimeMessage[]) => void, path: string) {
    if (!db || !path) return () => {};
    const q = query(collection(db, path), orderBy('timestamp', 'asc'), limit(100));
    return onSnapshot(q, (snap) => {
        callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as RealTimeMessage)));
    });
}

export async function deleteMessage(channelId: string, msgId: string, path: string) {
    if (!db || !path || !msgId) return;
    await deleteDoc(doc(db, path, msgId));
}

export async function uploadFileToStorage(path: string, file: Blob): Promise<string> {
    if (!storage || !path) throw new Error("Storage unavailable or path missing");
    const r = ref(storage, path);
    await uploadBytes(r, file);
    return await getDownloadURL(r);
}

export async function createOrGetDMChannel(otherUserId: string, otherUserName: string): Promise<string> {
    if (!db || !auth?.currentUser) throw new Error("Login required");
    const myUid = auth.currentUser.uid;
    const myName = auth.currentUser.displayName || 'Me';
    const q = query(collection(db, 'chat_channels'), where('type', '==', 'dm'), where('memberIds', 'array-contains', myUid));
    const snap = await getDocs(q);
    const existing = snap.docs.find(d => (d.data()?.memberIds || []).includes(otherUserId));
    if (existing) return existing.id;
    const id = generateSecureId();
    await setDoc(doc(db, 'chat_channels', id), { id, name: `${myName} & ${otherUserName}`, type: 'dm', memberIds: [myUid, otherUserId], createdAt: Date.now() });
    return id;
}

export async function getUserDMChannels(): Promise<ChatChannel[]> {
    if (!db || !auth?.currentUser) return [];
    const q = query(collection(db, 'chat_channels'), where('memberIds', 'array-contains', auth.currentUser.uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as ChatChannel));
}

// --- Career ---
export async function submitCareerApplication(app: CareerApplication) {
    if (!db) return;
    await addDoc(collection(db, APPLICATIONS_COLLECTION), sanitizeData(app));
}

export async function uploadResumeToStorage(uid: string, file: File): Promise<string> {
    if (!uid) throw new Error("User ID missing");
    return uploadCommentAttachment(file, `resumes/${uid}/${file.name}`);
}

export async function createJobPosting(job: JobPosting) {
    if (!db) return;
    const id = job.id || generateSecureId();
    await setDoc(doc(db, JOBS_COLLECTION, id), sanitizeData({ ...job, id }));
    return id;
}

export async function getJobPostings(): Promise<JobPosting[]> {
    if (!db) return [];
    const snap = await getDocs(query(collection(db, JOBS_COLLECTION), orderBy('postedAt', 'desc')));
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as JobPosting));
}

export async function getJobPosting(id: string): Promise<JobPosting | null> {
    if (!db || !id) return null;
    const snap = await getDoc(doc(db, JOBS_COLLECTION, id));
    return snap.exists() ? ({ ...snap.data(), id: snap.id } as JobPosting) : null;
}

export async function getAllCareerApplications(): Promise<CareerApplication[]> {
    if (!db) return [];
    const snap = await getDocs(query(collection(db, APPLICATIONS_COLLECTION), orderBy('createdAt', 'desc')));
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as CareerApplication));
}

// --- Social ---
export async function followUser(myUid: string, targetUid: string) {
    if (!db || !myUid || !targetUid) return;
    await updateDoc(doc(db, USERS_COLLECTION, myUid), { following: arrayUnion(targetUid) });
    await updateDoc(doc(db, USERS_COLLECTION, targetUid), { followers: arrayUnion(myUid) });
}

export async function unfollowUser(myUid: string, targetUid: string) {
    if (!db || !myUid || !targetUid) return;
    await updateDoc(doc(db, USERS_COLLECTION, myUid), { following: arrayRemove(targetUid) });
    await updateDoc(doc(db, USERS_COLLECTION, targetUid), { followers: arrayRemove(myUid) });
}

// --- Notebooks ---
export async function saveNotebook(nb: Notebook): Promise<string> {
    if (!db) return nb.id;
    const id = nb.id.startsWith('nb-') && nb.id.length > 20 ? nb.id : generateSecureId();
    await setDoc(doc(db, NOTEBOOKS_COLLECTION, id), sanitizeData({ ...nb, id }));
    return id;
}

export async function getNotebook(id: string): Promise<Notebook | null> {
    if (!db || !id) return null;
    const snap = await getDoc(doc(db, NOTEBOOKS_COLLECTION, id));
    return snap.exists() ? ({ ...snap.data(), id: snap.id } as Notebook) : null;
}

export async function getCreatorNotebooks(uid: string): Promise<Notebook[]> {
    if (!db || !uid) return [];
    const q = query(collection(db, NOTEBOOKS_COLLECTION), where('ownerId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Notebook));
}

// --- Cards ---
export async function getCard(id: string): Promise<AgentMemory | null> {
    if (!db || !id) return null;
    const snap = await getDoc(doc(db, CARDS_COLLECTION, id));
    return snap.exists() ? (snap.data() as AgentMemory) : null;
}

export async function getUserCards(uid: string): Promise<AgentMemory[]> {
    if (!db || !uid) return [];
    const q = query(collection(db, CARDS_COLLECTION), where('ownerId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as AgentMemory));
}

// --- Saved Words ---
export async function saveSavedWord(uid: string, word: any) {
    if (!db || !uid) return;
    await setDoc(doc(db, SAVED_WORDS_COLLECTION, uid), { words: arrayUnion(word) }, { merge: true });
}

export async function getSavedWordForUser(uid: string) {
    if (!db || !uid) return null;
    const snap = await getDoc(doc(db, SAVED_WORDS_COLLECTION, uid));
    return snap.exists() ? snap.data() : null;
}
