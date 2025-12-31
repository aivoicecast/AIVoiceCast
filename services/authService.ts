
import { firebase, auth, isFirebaseConfigured } from './firebaseConfig';

/**
 * Safely retrieves an Auth Provider from the firebase compat namespace.
 * In some ESM environments, side-effect modules (like compat/auth) might attach 
 * to the firebase object in slightly different ways.
 */
function getAuthProvider(providerName: 'GoogleAuthProvider' | 'GitHubAuthProvider') {
  // 1. Check the standard firebase.auth namespace (standard for compat/auth side-effects)
  // In many ESM builds, firebase.auth is both the function to get the instance 
  // and the container for provider constructors.
  const authNamespace = (firebase as any).auth;
  
  if (authNamespace && typeof authNamespace[providerName] === 'function') {
    return new authNamespace[providerName]();
  }
  
  // 2. Fallback: Try the default export's auth property if it exists separately
  const defaultAuth = (firebase as any).default?.auth;
  if (defaultAuth && typeof defaultAuth[providerName] === 'function') {
    return new defaultAuth[providerName]();
  }

  // 3. Fallback: Try to find it on the window object (global fallthrough)
  const windowFirebase = (window as any).firebase?.auth;
  if (windowFirebase && typeof windowFirebase[providerName] === 'function') {
      return new windowFirebase[providerName]();
  }

  throw new Error(
    `Firebase Auth provider ${providerName} is not initialized. ` +
    `This usually happens if the Firebase Auth module failed to load or ` +
    `if the Firebase configuration is invalid/missing.`
  );
}

export async function signInWithGoogle(): Promise<any> {
  // We still need a configuration to initialize the underlying network requests for OAuth.
  if (!isFirebaseConfigured) {
    throw new Error("Application is not configured with a Firebase Project. Please set your Firebase Config in Connection Settings first.");
  }

  if (window.location.protocol === 'file:') {
    const error: any = new Error("Firebase Auth cannot run on 'file://' protocol. Please serve the app using a local web server.");
    error.code = 'auth/operation-not-supported-in-this-environment';
    throw error;
  }

  try {
    const provider = getAuthProvider('GoogleAuthProvider');
    
    // Configure provider
    if (typeof (provider as any).setCustomParameters === 'function') {
        (provider as any).setCustomParameters({
          prompt: 'select_account'
        });
    }
    
    // We use the 'auth' instance which might be our resilient proxy or the real thing.
    // Both implement signInWithPopup.
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
  if (typeof (provider as any).addScope === 'function') {
    (provider as any).addScope('https://www.googleapis.com/auth/drive.file');
  }
  
  if (!auth?.currentUser) throw new Error("Must be logged in to connect services.");

  try {
    const result = await auth.currentUser.reauthenticateWithPopup(provider);
    const credential = result.credential as any;
    
    if (!credential || !credential.accessToken) throw new Error("Failed to retrieve Google Access Token.");
    return credential.accessToken;
  } catch (error) {
    console.error("Drive connection failed:", error);
    throw error;
  }
}

export async function reauthenticateWithGitHub(): Promise<{ user: any, token: string | null }> {
    const provider = getAuthProvider('GitHubAuthProvider');
    if (typeof (provider as any).addScope === 'function') {
        (provider as any).addScope('repo');
        (provider as any).addScope('user');
    }
    
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
  if (typeof (provider as any).addScope === 'function') {
    (provider as any).addScope('repo');
    (provider as any).addScope('user');
  }

  if (!isFirebaseConfigured) throw new Error("Application configuration missing.");

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
            throw new Error("This GitHub account is already linked to another user profile.");
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
