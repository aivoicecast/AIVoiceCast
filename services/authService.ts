
import { firebase, getAuth } from './firebaseConfig';

/**
 * Trigger Google Sign-In popup.
 */
export async function signInWithGoogle(): Promise<any> {
  const activeAuth = getAuth();
  
  if (!activeAuth) {
      throw new Error("Firebase Auth is not initialized. Please ensure your Firebase Configuration (API Keys) are set in private_keys.ts and that authorized domains are configured in the Firebase console.");
  }
  
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    // Force account selection to prevent auto-login with wrong account during testing
    provider.setCustomParameters({ prompt: 'select_account' });
    
    const result = await activeAuth.signInWithPopup(provider);
    return result.user;
  } catch (error: any) {
    console.error("Google Sign-In Error:", error.code, error.message);
    throw error;
  }
}

/**
 * Trigger GitHub Sign-In.
 */
export async function signInWithGitHub(): Promise<{ user: any, token: string | null }> {
  const activeAuth = getAuth();
  if (!activeAuth) throw new Error("Firebase Auth is not initialized.");
  
  try {
    const provider = new firebase.auth.GithubAuthProvider();
    const result = await activeAuth.signInWithPopup(provider);
    const credential = result.credential as any;
    return { user: result.user, token: credential?.accessToken || null };
  } catch (error: any) {
    console.error("GitHub Auth Error:", error);
    throw error;
  }
}

/**
 * Request additional scopes for Google Drive.
 */
export async function connectGoogleDrive(): Promise<string> {
  const activeAuth = getAuth();
  if (!activeAuth || !activeAuth.currentUser) throw new Error("Must be logged in to connect services.");

  const provider = new firebase.auth.GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/drive.file');

  try {
    const result = await activeAuth.currentUser.reauthenticateWithPopup(provider);
    const credential = result.credential as any;
    return credential.accessToken;
  } catch (error) {
    console.error("Drive connection failed:", error);
    throw error;
  }
}

export async function signOut(): Promise<void> {
  const activeAuth = getAuth();
  if (activeAuth) {
    await activeAuth.signOut();
  }
}

export function getCurrentUser(): any {
  const activeAuth = getAuth();
  return activeAuth ? activeAuth.currentUser : null;
}
