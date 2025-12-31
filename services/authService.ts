
import { firebase, auth } from './firebaseConfig';

/**
 * Safely creates a Google Auth Provider instance.
 */
function getGoogleProvider() {
  // Try to find the provider on the resolved firebase object
  const fb = (firebase as any);
  
  if (fb && fb.auth && fb.auth.GoogleAuthProvider) {
    return new fb.auth.GoogleAuthProvider();
  }

  // Fallback check on the global window if standard resolution fails
  if ((window as any).firebase && (window as any).firebase.auth && (window as any).firebase.auth.GoogleAuthProvider) {
      return new (window as any).firebase.auth.GoogleAuthProvider();
  }

  throw new Error("GoogleAuthProvider not found. Ensure the Firebase Auth compat library is loaded.");
}

/**
 * Trigger Google Sign-In popup.
 */
export async function signInWithGoogle(): Promise<any> {
  // Re-check auth at runtime in case of initialization delay
  const activeAuth = auth || (firebase as any)?.auth?.();
  
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
  const activeAuth = auth || (firebase as any)?.auth?.();
  if (!activeAuth) throw new Error("Firebase Auth is not initialized.");
  
  const fb = (firebase as any);
  if (!fb.auth || !fb.auth.GithubAuthProvider) {
    throw new Error("GithubAuthProvider is not available.");
  }
  
  const provider = new fb.auth.GithubAuthProvider();
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
  const activeAuth = auth || (firebase as any)?.auth?.();
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
  const activeAuth = auth || (firebase as any)?.auth?.();
  if (activeAuth) {
    await activeAuth.signOut();
  }
}

export function getCurrentUser(): any {
  return auth?.currentUser || (firebase as any)?.auth?.()?.currentUser || null;
}
