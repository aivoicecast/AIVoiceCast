
import { 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut as firebaseSignOut,
    User
} from 'firebase/auth';
import { auth } from './firebaseConfig';

const GITHUB_CLIENT_ID = 'Ov23liwzhjDQN6DGl6Cx';

/**
 * Standard Google OAuth via Firebase
 */
export async function signInWithGoogle(): Promise<User | null> {
    if (!auth) return null;

    const provider = new GoogleAuthProvider();
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

/**
 * Initiates GitHub OAuth Flow
 * Redirects the user to GitHub to authorize the app.
 */
export function signInWithGitHub(): void {
    const root = window.location.origin + window.location.pathname;
    const scope = 'repo,user';
    const state = Math.random().toString(36).substring(7);
    localStorage.setItem('gh_auth_state', state);

    const url = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=${scope}&state=${state}&redirect_uri=${encodeURIComponent(root)}`;
    window.location.assign(url);
}

/**
 * Exchanges OAuth Code for Access Token
 * NOTE: GitHub's token exchange endpoint does not support CORS for pure browser requests
 * because it requires a Client Secret. In production, this call should go through a 
 * backend or a CORS proxy/Gatekeeper.
 */
export async function exchangeGitHubCode(code: string): Promise<string> {
    // In a real-world app, you'd call your own backend here:
    // const res = await fetch('your-backend.com/github/token', { body: { code } });
    
    // For this implementation, we simulate the token acquisition 
    // or assume a proxy is being used.
    console.log("Exchanging GitHub code:", code);
    
    // Placeholder: In an ideal flow, the backend returns the token.
    // Since we are pure frontend, we advise the user that the 'code' is the first step.
    return code; 
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
