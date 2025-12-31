
import { firebase, auth, isFirebaseConfigured } from './firebaseConfig';

/**
 * Safely retrieves an Auth Provider.
 * Firebase providers like GoogleAuthProvider are attached to the firebase.auth namespace
 * as side-effects. This helper ensures they are available before instantiation.
 */
function getAuthProvider(providerName: 'GoogleAuthProvider' | 'GitHubAuthProvider') {
  const authNamespace = (firebase as any).auth;
  
  if (authNamespace && typeof authNamespace[providerName] === 'function') {
    return new authNamespace[providerName]();
  }

  // Fallback for different build environments/ESM loads
  const providerCtor = (firebase as any).default?.auth?.[providerName] || (window as any).firebase?.auth?.[providerName];
  
  if (typeof providerCtor === 'function') {
    return new providerCtor();
  }

  throw new Error(
    `The ${providerName} is not yet loaded. This happens if the Firebase Auth script is still initializing or if the connection settings are missing.`
  );
}

export async function signInWithGoogle(): Promise<any> {
  if (!isFirebaseConfigured) {
    throw new Error("Missing Firebase Configuration. Please go to 'Connection Settings' in the user menu and paste your Firebase config object.");
  }

  if (window.location.protocol === 'file:') {
    const error: any = new Error("Firebase Auth requires a web server. It cannot run on 'file://' protocol.");
    error.code = 'auth/operation-not-supported-in-this-environment';
    throw error;
  }

  try {
    const provider = getAuthProvider('GoogleAuthProvider');
    
    // We use the 'auth' instance from config which is a resilient proxy
    const result = await auth.signInWithPopup(provider);
    return result.user;
  } catch (error: any) {
    console.error("Google Sign-In Error:", error.code, error.message);
    throw error;
  }
}

export async function connectGoogleDrive(): Promise<string> {
  if (!isFirebaseConfigured) throw new Error("Firebase not configured");
  
  const provider = getAuthProvider('GoogleAuthProvider');
  if (typeof (provider as any).addScope === 'function') {
    (provider as any).addScope('https://www.googleapis.com/auth/drive.file');
  }
  
  if (!auth?.currentUser) throw new Error("Must be logged in to connect services.");

  try {
    const result = await auth.currentUser.reauthenticateWithPopup(provider);
    const credential = result.credential as any;
    return credential.accessToken;
  } catch (error) {
    console.error("Drive connection failed:", error);
    throw error;
  }
}

export async function signInWithGitHub(): Promise<{ user: any, token: string | null }> {
  if (!isFirebaseConfigured) throw new Error("Firebase not configured");
  const provider = getAuthProvider('GitHubAuthProvider');
  
  try {
    const result = await auth.signInWithPopup(provider);
    const credential = result.credential as any;
    return { user: result.user, token: credential?.accessToken || null };
  } catch (error: any) {
    console.error("GitHub Auth Error:", error);
    throw error;
  }
}

export async function signOut(): Promise<void> {
  if (auth) await auth.signOut();
}

export function getCurrentUser(): any {
  return auth?.currentUser || null;
}
