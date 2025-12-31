
import { firebase, auth, isFirebaseConfigured } from './firebaseConfig';

/**
 * Safely retrieves an Auth Provider from the firebase compat namespace.
 * In some ESM environments, side-effect modules (like compat/auth) might attach 
 * to the firebase object in slightly different ways.
 */
function getAuthProvider(providerName: 'GoogleAuthProvider' | 'GitHubAuthProvider') {
  // 1. Check the standard firebase.auth namespace (mutation from compat/auth)
  const authModule = (firebase as any).auth;
  if (authModule && authModule[providerName]) {
    return new authModule[providerName]();
  }
  
  // 2. Fallback: try accessing via the auth instance constructor if available
  // (Standard compat doesn't always put it here, but some shims do)
  if (auth && (auth as any).constructor && (auth as any).constructor[providerName]) {
      return new (auth as any).constructor[providerName]();
  }

  throw new Error(`Firebase Auth provider ${providerName} is not initialized. Please ensure your Firebase configuration is valid and the Auth module is properly loaded.`);
}

export async function signInWithGoogle(): Promise<any> {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase is not configured. Please update your settings.");
  }

  if (window.location.protocol === 'file:') {
    const error: any = new Error("Firebase Auth cannot run on 'file://' protocol. Please serve the app using a local web server.");
    error.code = 'auth/operation-not-supported-in-this-environment';
    throw error;
  }

  try {
    const provider = getAuthProvider('GoogleAuthProvider');
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    
    // Use the auth instance for the popup call
    const result = await auth.signInWithPopup(provider);
    return result.user;
  } catch (error: any) {
    console.error("Login failed:", error.code, error.message);
    throw error;
  }
}

export async function connectGoogleDrive(): Promise<string> {
  if (!isFirebaseConfigured) throw new Error("Firebase not configured");
  
  const provider = getAuthProvider('GoogleAuthProvider');
  provider.addScope('https://www.googleapis.com/auth/drive.file');
  
  if (!auth?.currentUser) throw new Error("Must be logged in");

  try {
    const result = await auth.currentUser.reauthenticateWithPopup(provider);
    const credential = result.credential as any;
    
    if (!credential || !credential.accessToken) throw new Error("Failed to get Google Access Token");
    return credential.accessToken;
  } catch (error) {
    console.error("Drive connection failed:", error);
    throw error;
  }
}

export async function reauthenticateWithGitHub(): Promise<{ user: any, token: string | null }> {
    const provider = getAuthProvider('GitHubAuthProvider');
    provider.addScope('repo');
    provider.addScope('user');
    
    if (!auth?.currentUser) throw new Error("No user logged in to re-authenticate.");

    try {
        const result = await auth.currentUser.reauthenticateWithPopup(provider);
        const credential = result.credential as any;
        return { user: result.user, token: credential?.accessToken || null };
    } catch (error) {
        console.error("Re-auth failed:", error);
        throw error;
    }
}

export async function signInWithGitHub(): Promise<{ user: any, token: string | null }> {
  const provider = getAuthProvider('GitHubAuthProvider');
  provider.addScope('repo');
  provider.addScope('user');

  if (!isFirebaseConfigured) throw new Error("Auth service unavailable");

  try {
    if (auth.currentUser) {
       try {
         const result = await auth.currentUser.linkWithPopup(provider);
         const credential = result.credential as any;
         return { user: result.user, token: credential?.accessToken || null };
       } catch (linkError: any) {
         if (linkError.code === 'auth/provider-already-linked') {
             const result = await auth.signInWithPopup(provider);
             const credential = result.credential as any;
             return { user: result.user, token: credential?.accessToken || null };
         }
         
         if (linkError.code === 'auth/credential-already-in-use') {
            if (linkError.credential && (linkError.credential as any).accessToken) {
                return { 
                    user: auth.currentUser, 
                    token: (linkError.credential as any).accessToken 
                };
            }
            throw new Error("This GitHub account is already linked to another user.");
         }
         throw linkError;
       }
    } 
    
    const result = await auth.signInWithPopup(provider);
    const credential = result.credential as any;
    return { user: result.user, token: credential?.accessToken || null };

  } catch (error: any) {
    console.error("GitHub Auth Error:", error);
    if (error.code === 'auth/popup-closed-by-user') throw new Error("Sign-in cancelled.");
    throw error;
  }
}

export async function signOut(): Promise<void> {
  try {
    if (auth) await auth.signOut();
  } catch (error) {
    console.error("Logout failed:", error);
  }
}

export function getCurrentUser(): any {
  return auth?.currentUser || null;
}
