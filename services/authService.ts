
import { 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut as firebaseSignOut,
    User
} from 'firebase/auth';
import { auth } from './firebaseConfig';

/**
 * Standard Google OAuth via Firebase
 * Handles both platform login and Google Drive token acquisition.
 */
export async function signInWithGoogle(): Promise<User | null> {
    if (!auth) return null;

    const provider = new GoogleAuthProvider();
    // Add scopes for Google Drive and Profile
    provider.addScope('https://www.googleapis.com/auth/drive.file');
    provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
    provider.addScope('https://www.googleapis.com/auth/userinfo.email');

    try {
        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const token = credential?.accessToken;

        if (token) {
            localStorage.setItem('google_drive_token', token);
            localStorage.setItem('token_expiry', (Date.now() + 3500 * 1000).toString());
        }

        // Store a copy for components that still look in localStorage
        const userSummary = {
            uid: result.user.uid,
            displayName: result.user.displayName,
            email: result.user.email,
            photoURL: result.user.photoURL
        };
        localStorage.setItem('drive_user', JSON.stringify(userSummary));

        return result.user;
    } catch (error) {
        console.error("Firebase Auth Error:", error);
        throw error;
    }
}

export function getDriveToken(): string | null {
    const token = localStorage.getItem('google_drive_token');
    const expiry = localStorage.getItem('token_expiry');
    if (token && expiry && Date.now() < parseInt(expiry)) {
        return token;
    }
    return null;
}

export async function connectGoogleDrive(): Promise<string> {
    const token = getDriveToken();
    if (token) return token;
    
    // If no token or expired, trigger re-auth
    await signInWithGoogle();
    const newToken = getDriveToken();
    if (!newToken) throw new Error("Failed to obtain Drive token");
    return newToken;
}

export async function signInWithGitHub(): Promise<string> {
    return new Promise((resolve) => {
        const token = 'ghp_mock_token_' + Math.random().toString(36).substring(7);
        localStorage.setItem('github_token', token);
        setTimeout(() => resolve(token), 1000);
    });
}

export async function signOut(): Promise<void> {
    if (auth) {
        await firebaseSignOut(auth);
    }
    localStorage.removeItem('google_drive_token');
    localStorage.removeItem('token_expiry');
    localStorage.removeItem('drive_user');
    window.location.reload();
}

export function getCurrentUser(): any {
    // If Firebase is initialized, that's our source of truth
    if (auth?.currentUser) return auth.currentUser;
    
    // Fallback for initial load before Firebase initializes
    const data = localStorage.getItem('drive_user');
    return data ? JSON.parse(data) : null;
}
