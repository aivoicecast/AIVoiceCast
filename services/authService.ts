
/**
 * Standalone Google OAuth Service
 * Handles login and token management without Firebase.
 */

const CLIENT_ID = '836641670384-ebjnbgl55jateddfort3atops7onoipk.apps.googleusercontent.com';
const SCOPES = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email'
].join(' ');

/**
 * Normalizes the redirect URI to match Google Cloud Console expectations.
 * Most environments prefer the origin without a trailing slash.
 */
function getRedirectUri(): string {
    // Standardize to origin. Remove trailing slashes.
    let origin = window.location.origin;
    if (origin.endsWith('/')) {
        origin = origin.slice(0, -1);
    }
    return origin;
}

export async function signInWithGoogle(): Promise<any> {
    return new Promise((resolve, reject) => {
        const redirectUri = getRedirectUri();
        
        // Log for developer troubleshooting in browser console
        console.log(`[OAuth] Attempting login with Redirect URI: ${redirectUri}`);
        console.log(`[OAuth] Ensure this URI is whitelisted in Google Cloud Console for Client ID: ${CLIENT_ID}`);

        const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(SCOPES)}&prompt=select_account`;
        
        const popup = window.open(url, 'google-login', 'width=500,height=600');
        
        if (!popup) {
            reject(new Error("Popup blocked! Please allow popups for this site."));
            return;
        }

        const checkHash = setInterval(async () => {
            try {
                if (popup && popup.location.hash) {
                    const hash = popup.location.hash.substring(1);
                    const params = new URLSearchParams(hash);
                    const token = params.get('access_token');
                    
                    if (token) {
                        clearInterval(checkHash);
                        popup.close();
                        localStorage.setItem('google_drive_token', token);
                        localStorage.setItem('token_expiry', (Date.now() + 3500 * 1000).toString());
                        
                        // Fetch user info
                        const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        const profile = await userRes.json();
                        
                        const user = {
                            uid: profile.sub,
                            displayName: profile.name,
                            email: profile.email,
                            photoURL: profile.picture
                        };
                        
                        localStorage.setItem('drive_user', JSON.stringify(user));
                        resolve(user);
                    }
                }
            } catch (e) {
                // Cross-origin errors are expected until the redirect happens back to our domain
            }
            
            if (popup && popup.closed) {
                clearInterval(checkHash);
                reject(new Error("Login window was closed"));
            }
        }, 500);
    });
}

export function getDriveToken(): string | null {
    const token = localStorage.getItem('google_drive_token');
    const expiry = localStorage.getItem('token_expiry');
    if (token && expiry && Date.now() < parseInt(expiry)) {
        return token;
    }
    return null;
}

/* Fixed: Exported connectGoogleDrive helper to return accessToken */
export async function connectGoogleDrive(): Promise<string> {
    const user = await signInWithGoogle();
    const token = getDriveToken();
    if (!token) throw new Error("Failed to obtain Drive token");
    return token;
}

/* Fixed: Exported signInWithGitHub mock for demo mode */
export async function signInWithGitHub(): Promise<string> {
    return new Promise((resolve) => {
        const token = 'ghp_mock_token_' + Math.random().toString(36).substring(7);
        localStorage.setItem('github_token', token);
        setTimeout(() => resolve(token), 1000);
    });
}

export async function signOut(): Promise<void> {
    localStorage.removeItem('google_drive_token');
    localStorage.removeItem('token_expiry');
    localStorage.removeItem('drive_user');
    window.location.reload();
}

export function getCurrentUser(): any {
    const data = localStorage.getItem('drive_user');
    return data ? JSON.parse(data) : null;
}
