
import { firebase, getAuth } from './firebaseConfig';

/**
 * Safely retrieves the active Auth instance.
 */
function getActiveAuth() {
    return getAuth();
}

/**
 * Safely creates a Google Auth Provider instance.
 */
function getGoogleProvider() {
  const fb = (firebase as any).default || firebase;
  if (fb && fb.auth && fb.auth.GoogleAuthProvider) {
    return new fb.auth.GoogleAuthProvider();
  }
  throw new Error("GoogleAuthProvider not found. Check Firebase Auth library.");
}

/**
 * Trigger Google Sign-In popup.
 */
export async function signInWithGoogle(): Promise<any> {
  const activeAuth = getActiveAuth();
  if (!activeAuth) {
      throw new Error("Firebase Auth is not initialized. Please check your configuration.");
  }
  
  try {
    const provider = getGoogleProvider();
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
  const activeAuth = getActiveAuth();
  if (!activeAuth) throw new Error("Firebase Auth is not initialized.");
  
  const fb = (firebase as any).default || firebase;
  const GithubProvider = fb.auth?.GithubAuthProvider;
  
  if (!GithubProvider) {
    throw new Error("GithubAuthProvider is not available.");
  }
  
  const provider = new GithubProvider();
  try {
    const result = await activeAuth.signInWithPopup(provider);
    const credential = result.credential as any;
    return { user: result.user, token: credential?.accessToken || null };
  } catch (error: any) {
    console.error("GitHub Auth Error:", error);
    throw error;
  }
}

export async function connectGoogleDrive(): Promise<string> {
  const activeAuth = getActiveAuth();
  if (!activeAuth) throw new Error("Firebase Auth is not initialized.");
  
  const provider = getGoogleProvider();
  if (typeof (provider as any).addScope === 'function') {
    (provider as any).addScope('https://www.googleapis.com/auth/drive.file');
  }
  
  if (!activeAuth.currentUser) throw new Error("Must be logged in to connect services.");

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
  const activeAuth = getActiveAuth();
  if (activeAuth) {
    await activeAuth.signOut();
  }
}

export function getCurrentUser(): any {
  return getActiveAuth()?.currentUser || null;
}
