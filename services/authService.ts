import { firebase, auth } from './firebaseConfig';

/**
 * Safely creates a Google Auth Provider instance.
 */
function getGoogleProvider() {
  const fb = (firebase as any);
  
  if (fb.auth && fb.auth.GoogleAuthProvider) {
    return new fb.auth.GoogleAuthProvider();
  }

  throw new Error("GoogleAuthProvider is not available. Ensure 'firebase/compat/auth' is loaded correctly.");
}

/**
 * Trigger Google Sign-In popup for any public Google user.
 */
export async function signInWithGoogle(): Promise<any> {
  if (!auth) throw new Error("Firebase Auth is not initialized.");
  try {
    const provider = getGoogleProvider();
    // Allow any google user to sign in
    const result = await auth.signInWithPopup(provider);
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
  if (!auth) throw new Error("Firebase Auth is not initialized.");
  const fb = (firebase as any);
  
  if (!fb.auth || !fb.auth.GithubAuthProvider) {
    throw new Error("GithubAuthProvider is not available.");
  }
  const provider = new fb.auth.GithubAuthProvider();
  try {
    const result = await auth.signInWithPopup(provider);
    const credential = result.credential as any;
    return { user: result.user, token: credential?.accessToken || null };
  } catch (error: any) {
    console.error("GitHub Auth Error:", error);
    throw error;
  }
}

export async function connectGoogleDrive(): Promise<string> {
  if (!auth) throw new Error("Firebase Auth is not initialized.");
  const provider = getGoogleProvider();
  if (typeof (provider as any).addScope === 'function') {
    (provider as any).addScope('https://www.googleapis.com/auth/drive.file');
  }
  
  if (!auth.currentUser) throw new Error("Must be logged in to connect services.");

  try {
    const result = await auth.currentUser.reauthenticateWithPopup(provider);
    const credential = result.credential as any;
    return credential.accessToken;
  } catch (error) {
    console.error("Drive connection failed:", error);
    throw error;
  }
}

export async function signOut(): Promise<void> {
  if (auth) {
    await auth.signOut();
  }
}

export function getCurrentUser(): any {
  return auth?.currentUser || null;
}