
import { 
    GoogleAuthProvider, 
    GithubAuthProvider,
    signInWithPopup, 
    signOut as firebaseSignOut,
    User
} from 'firebase/auth';
import { auth } from './firebaseConfig';

/**
 * Standard Google OAuth via Firebase
 */
export async function signInWithGoogle(): Promise<User | null> {
    if (!auth) return null;

    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive.file');
    provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
    provider.addScope('https://www.googleapis.com/auth/userinfo.email');
    
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
 * Initiates GitHub OAuth Flow using Firebase SDK
 * This method handles state and initial_state missing errors automatically.
 */
export async function signInWithGitHub(): Promise<string | null> {
    if (!auth) return null;

    const provider = new GithubAuthProvider();
    // Request scopes needed for Code Studio
    provider.addScope('repo');
    provider.addScope('user');

    try {
        const result = await signInWithPopup(auth, provider);
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

/**
 * Common Error Handler for Auth Flows
 */
function handleAuthError(error: any) {
    console.error("Firebase Auth Error:", error);
    if (error.code === 'auth/unauthorized-domain') {
        alert("This domain is not authorized in the Firebase Console. Add 'dev.aivoicecast.com' to Authorized Domains.");
    } else if (error.code === 'auth/web-storage-unsupported') {
        alert("Your browser is blocking storage required for login. Please disable private mode or allow third-party cookies.");
    } else if (error.code === 'auth/popup-blocked') {
        alert("Login popup was blocked by your browser. Please allow popups for this site.");
    } else if (error.message?.includes('missing initial state') || error.code === 'auth/internal-error') {
        alert("Auth connection issue. Please ensure your browser allows third-party cookies and try again.");
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
    await signInWithGoogle();
    const newToken = getDriveToken();
    if (!newToken) throw new Error("Failed to obtain Drive token");
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
    window.location.reload();
}

export function getCurrentUser(): any {
    if (auth?.currentUser) return auth.currentUser;
    const data = localStorage.getItem('drive_user');
    return data ? JSON.parse(data) : null;
}
