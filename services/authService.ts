
import { firebase, auth } from './firebaseConfig';

/**
 * Safely retrieves the active Auth instance.
 * Priority: 
 * 1. The exported 'auth' constant from firebaseConfig
 * 2. Directly calling .auth() on the firebase namespace
 */
function getActiveAuth() {
    if (auth) return auth;
    
    const fb = (firebase as any).default || firebase;
    if (fb && typeof fb.auth === 'function' && fb.apps.length > 0) {
        return fb.auth();
    }
    
    return null;
}

/**
 * Safely creates a Google Auth Provider instance.
 */
function getGoogleProvider() {
  const fb = (firebase as any).default || firebase;
  
  // Search in the namespace first
  if (fb && fb.auth && fb.auth.GoogleAuthProvider) {
    return new fb.auth.GoogleAuthProvider();
  }

  // Fallback to searching the instance if needed (some versions/wrappers)
  const activeAuth = getActiveAuth();
  if (activeAuth && (activeAuth as any).constructor && (activeAuth as any).constructor.GoogleAuthProvider) {
      return new (activeAuth as any).constructor.GoogleAuthProvider();
  }

  throw new Error("GoogleAuthProvider not found. Ensure the Firebase Auth compat library is loaded.");
}

/**
 * Trigger Google Sign-In popup.
 */
export async function signInWithGoogle(): Promise<any> {
  const activeAuth = getActiveAuth();
  
  if (!activeAuth) {
      throw new Error("Firebase Auth is not initialized. Please ensure your Firebase configuration is correct.");
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
