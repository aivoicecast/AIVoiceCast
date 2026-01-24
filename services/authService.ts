import { 
    GoogleAuthProvider, 
    GithubAuthProvider,
    signInWithPopup, 
    linkWithPopup,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut
} from '@firebase/auth';
import type { User } from '@firebase/auth';
import { auth } from './firebaseConfig';
import { UserProfile } from '../types';

/**
 * Hackathon Judge Credentials (Real Firebase Account)
 */
export const JUDGE_EMAIL = 'judge@aivoicecast.com';

const ADMIN_GROUP = 'admin_neural_prism';

/**
 * Standard Google OAuth via Firebase
 */
export async function signInWithGoogle(): Promise<User | null> {
    if (!auth) return null;

    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive.file');
    provider.addScope('https://www.googleapis.com/auth/youtube.upload'); 
    provider.addScope('https://www.googleapis.com/auth/youtube.force-ssl'); 
    provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
    provider.addScope('https://www.googleapis.com/auth/userinfo.email');
    provider.addScope('https://www.googleapis.com/auth/gmail.send');
    
    provider.setCustomParameters({
        prompt: 'select_account'
    });

    try {
        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const token = credential?.accessToken;

        if (token) {
            localStorage.setItem('google_drive_token', token); 
            localStorage.setItem('token_expiry', (Date.now() + 3500 * 1000).toString());
        }

        const userSummary = {
            uid: result.user.uid,
            displayName: result.user.displayName,
            email: result.user.email,
            photoURL: result.user.photoURL
        };
        localStorage.setItem('drive_user', JSON.stringify(userSummary));

        return result.user;
    } catch (error: any) {
        handleAuthError(error);
        throw error;
    }
}

/**
 * Judge Login via real Firebase Email/Password
 */
export async function signInAsJudge(username: string, password: string): Promise<boolean> {
    if (!auth) return false;
    
    const email = username.includes('@') ? username.toLowerCase().trim() : `${username.toLowerCase().trim()}@aivoicecast.com`;
    
    try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        const userSummary = {
            uid: result.user.uid,
            displayName: 'DeepMind Judge',
            email: result.user.email,
            photoURL: 'https://ui-avatars.com/api/?name=DeepMind+Judge&background=6366f1&color=fff'
        };
        localStorage.setItem('drive_user', JSON.stringify(userSummary));
        console.log("[Auth] Judge handshake successful.");
        return true;
    } catch (error: any) {
        console.error("Judge Auth Failed:", error.message);
        return false;
    }
}

/**
 * Helper to check for active Judge Session based on authenticated email or cache
 */
export function isJudgeSession(): boolean {
    const firebaseUser = auth?.currentUser;
    if (firebaseUser && firebaseUser.email?.toLowerCase() === JUDGE_EMAIL.toLowerCase()) return true;
    
    // Check cached session in localStorage for early boot detection
    const cached = localStorage.getItem('drive_user');
    if (cached) {
        try {
            const parsed = JSON.parse(cached);
            return parsed.email?.toLowerCase() === JUDGE_EMAIL.toLowerCase();
        } catch(e) { return false; }
    }
    return false;
}

/**
 * Synchronous session resolver for App boot
 */
export function getSovereignSession(): { user: any, profile: UserProfile | null } {
    const data = localStorage.getItem('drive_user');
    const user = data ? JSON.parse(data) : null;
    
    if (user && user.email?.toLowerCase() === JUDGE_EMAIL.toLowerCase()) {
        const profile: UserProfile = {
            ...user,
            subscriptionTier: 'pro',
            coinBalance: 10000000,
            groups: [ADMIN_GROUP],
            createdAt: 1734825600000,
            lastLogin: Date.now(),
            apiUsageCount: 0
        };
        return { user, profile };
    }
    
    return { user, profile: null };
}

/**
 * Initiates GitHub OAuth Flow using Firebase SDK
 */
export async function signInWithGitHub(): Promise<string | null> {
    if (!auth) return null;

    const provider = new GithubAuthProvider();
    provider.addScope('repo');
    provider.addScope('user');

    try {
        let result;
        if (auth.currentUser) {
            result = await linkWithPopup(auth.currentUser, provider);
        } else {
            result = await signInWithPopup(auth, provider);
        }

        const credential = GithubAuthProvider.credentialFromResult(result);
        const token = credential?.accessToken;

        if (token) {
            localStorage.setItem('github_token', token);
            return token;
        }
        return null;
    } catch (error: any) {
        handleAuthError(error);
        throw error;
    }
}

export function clearGitHubToken() {
    localStorage.removeItem('github_token');
}

function handleAuthError(error: any) {
    console.error("Firebase Auth Error:", error);
    if (error.code === 'auth/unauthorized-domain') {
        alert("Domain Not Authorized: Add this URL to 'Authorized Domains' in Firebase Console.");
    } else if (error.code === 'auth/popup-blocked') {
        alert("Popup Blocked: Please allow popups for this site.");
    }
}

export function getDriveToken(): string | null {
    if (isJudgeSession()) return null; 
    const token = localStorage.getItem('google_drive_token');
    const expiry = localStorage.getItem('token_expiry');
    if (token && expiry && Date.now() < parseInt(expiry)) {
        return token;
    }
    return null;
}

export async function connectGoogleDrive(): Promise<string> {
    if (isJudgeSession()) throw new Error("Google Drive access is disabled for Judge accounts.");
    const token = getDriveToken();
    if (token) return token;
    await signInWithGoogle();
    const newToken = getDriveToken();
    if (!newToken) throw new Error("Failed to obtain Google token");
    return newToken;
}

export async function signOut(): Promise<void> {
    if (auth) {
        await firebaseSignOut(auth);
    }
    localStorage.removeItem('google_drive_token');
    localStorage.removeItem('token_expiry');
    localStorage.removeItem('drive_user');
    localStorage.removeItem('github_token');
    localStorage.removeItem('judge_access_token');
    window.location.assign(window.location.origin);
}

export function getCurrentUser(): any {
    if (auth?.currentUser) return auth.currentUser;
    const { user } = getSovereignSession();
    return user;
}