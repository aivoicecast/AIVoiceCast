
import { auth } from './firebaseConfig';
import firebase from 'firebase/compat/app';

export async function signInWithGoogle(): Promise<firebase.User | null> {
  // Proactive check for file protocol which is a common cause of "operation not supported"
  if (window.location.protocol === 'file:') {
    const error: any = new Error("Firebase Auth cannot run on 'file://' protocol. Please serve the app using a local web server (e.g., http://localhost).");
    error.code = 'auth/operation-not-supported-in-this-environment';
    throw error;
  }

  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    // Force the account selection screen to allow switching users
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    
    const result = await auth.signInWithPopup(provider);
    return result.user;
  } catch (error) {
    console.error("Login failed:", error);
    throw error;
  }
}

export async function connectGoogleDrive(): Promise<string> {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/drive.file');
  
  // Re-authenticate or Link to get the credential with the new scope
  if (!auth.currentUser) throw new Error("Must be logged in");

  try {
    // We use linkWithPopup or reauthenticateWithPopup to get the credential containing the Google Access Token
    const result = await auth.currentUser.reauthenticateWithPopup(provider);
    const credential = result.credential as firebase.auth.OAuthCredential;
    
    if (!credential.accessToken) throw new Error("Failed to get Google Access Token");
    return credential.accessToken;
  } catch (error) {
    console.error("Drive connection failed:", error);
    throw error;
  }
}

export async function reauthenticateWithGitHub(): Promise<{ user: firebase.User | null, token: string | null }> {
    const provider = new firebase.auth.GithubAuthProvider();
    provider.addScope('repo');
    provider.addScope('user');
    
    if (!auth.currentUser) throw new Error("No user logged in to re-authenticate.");

    try {
        const result = await auth.currentUser.reauthenticateWithPopup(provider);
        const credential = result.credential as firebase.auth.OAuthCredential;
        return { user: result.user, token: credential?.accessToken || null };
    } catch (error) {
        console.error("Re-auth failed:", error);
        throw error;
    }
}

export async function signInWithGitHub(): Promise<{ user: firebase.User | null, token: string | null }> {
  const provider = new firebase.auth.GithubAuthProvider();
  // Request repo scope to allow reading and writing private/public repositories
  provider.addScope('repo');
  provider.addScope('user');

  try {
    // SCENARIO 1: User is already logged in (Link Account)
    if (auth.currentUser) {
       try {
         // Attempt to link first to associate GitHub with the current account
         const result = await auth.currentUser.linkWithPopup(provider);
         const credential = result.credential as firebase.auth.OAuthCredential;
         return { user: result.user, token: credential?.accessToken || null };
       } catch (linkError: any) {
         // Case A: GitHub account is ALREADY linked to THIS Firebase account.
         // We must retrieve a fresh OAuth Access Token. 
         // Using signInWithPopup while logged in (with the same provider/account) effectively refreshes the credentials
         // and returns the token we need without signing the user out.
         if (linkError.code === 'auth/provider-already-linked') {
             try {
                const result = await auth.signInWithPopup(provider);
                const credential = result.credential as firebase.auth.OAuthCredential;
                return { user: result.user, token: credential?.accessToken || null };
             } catch (signInError: any) {
                // If signIn fails here, bubble it up
                throw signInError;
             }
         }
         
         // Case B: GitHub account is linked to a DIFFERENT Firebase account.
         if (linkError.code === 'auth/credential-already-in-use') {
            // RECOVERY STRATEGY:
            // If the GitHub account is valid but linked to another user, we can still extract
            // the OAuth Access Token from the error object to allow "Session-Only" access
            // to GitHub features without formally linking the accounts in Firebase.
            if (linkError.credential && (linkError.credential as any).accessToken) {
                console.warn("GitHub account linked to another user. Using temporary session token.");
                return { 
                    user: auth.currentUser, 
                    token: (linkError.credential as any).accessToken 
                };
            }

            const error: any = new Error("This GitHub account is already linked to another user. Please sign out and sign in with GitHub directly.");
            error.code = linkError.code;
            error.originalMessage = linkError.message;
            throw error;
         }
         
         // Other linking errors
         throw linkError;
       }
    } 
    
    // SCENARIO 2: Not logged in (Fresh Sign In)
    // Attempt to sign in with GitHub directly.
    const result = await auth.signInWithPopup(provider);
    const credential = result.credential as firebase.auth.OAuthCredential;
    return { user: result.user, token: credential?.accessToken || null };

  } catch (error: any) {
    console.error("GitHub Auth Error:", error);
    if (error.code === 'auth/popup-closed-by-user') throw new Error("Sign-in cancelled.");
    if (error.code === 'auth/popup-blocked') throw new Error("Popup blocked. Please allow popups for this site.");
    throw error;
  }
}

export async function signOut(): Promise<void> {
  try {
    await auth.signOut();
  } catch (error) {
    console.error("Logout failed:", error);
  }
}

export function getCurrentUser(): firebase.User | null {
  return auth.currentUser;
}
