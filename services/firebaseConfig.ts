import { initializeApp, getApps, getApp } from "@firebase/app";
import type { FirebaseApp } from "@firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "@firebase/auth";
import type { Auth } from "@firebase/auth";
import { initializeFirestore, enableIndexedDbPersistence } from "@firebase/firestore";
import type { Firestore } from "@firebase/firestore";
import { getStorage } from "@firebase/storage";
import type { FirebaseStorage } from "@firebase/storage";
import { firebaseKeys } from './private_keys';

/**
 * Standard Firebase Initialization
 */
const initializeFirebase = (): FirebaseApp | null => {
    try {
        if (getApps().length > 0) {
            return getApp();
        }

        if (firebaseKeys && firebaseKeys.apiKey && firebaseKeys.apiKey !== "YOUR_FIREBASE_API_KEY") {
            // Ensure authDomain is strictly the firebaseapp.com version to minimize cross-origin issues
            const config = {
                ...firebaseKeys,
                authDomain: `${firebaseKeys.projectId}.firebaseapp.com`
            };
            return initializeApp(config);
        } else {
            console.warn("[Firebase] Configuration missing or using placeholder key.");
        }
    } catch (err) {
        console.error("[Firebase] Initialization failed:", err);
    }
    return null;
};

const appInstance = initializeFirebase();

/**
 * Robust Firestore Initialization
 * Configured specifically to bypass WebSocket blocks in restricted environments.
 */
const initDb = (): Firestore | null => {
    if (!appInstance) return null;
    
    const firestore = initializeFirestore(appInstance, {
        // CRITICAL FIX: Force long polling to bypass WebSocket timeout/blocks
        experimentalForceLongPolling: true,
        // Disable fetch streams for maximum compatibility
        useFetchStreams: false
    });

    // Simplify persistence for iframe environments which often block multi-tab logic
    enableIndexedDbPersistence(firestore).catch((err) => {
        if (err.code === 'failed-precondition') {
            console.warn("[Firestore] Persistence disabled: Multiple tabs detected.");
        } else if (err.code === 'unimplemented') {
            console.warn("[Firestore] Persistence disabled: Browser environment not supported.");
        }
    });

    return firestore;
};

const authInstance: Auth | null = appInstance ? getAuth(appInstance) : null;

// Explicitly set persistence to Local to survive session storage clearing
if (authInstance) {
    setPersistence(authInstance, browserLocalPersistence).catch((err) => {
        console.error("[Auth] Persistence setup failed:", err);
    });
}

export const auth = authInstance;
export const db: Firestore | null = initDb();
// Explicitly define the storage bucket URL to prevent retry-limit issues
export const storage: FirebaseStorage | null = appInstance ? getStorage(appInstance, firebaseKeys.storageBucket) : null;

export const getAuthInstance = (): Auth | null => auth;
export const getDb = (): Firestore | null => db;
export const getStorageInstance = (): FirebaseStorage | null => storage;

export const isFirebaseConfigured = !!(firebaseKeys && firebaseKeys.apiKey && firebaseKeys.apiKey !== "YOUR_FIREBASE_API_KEY");

export const getFirebaseDiagnostics = () => {
    return {
        isInitialized: !!appInstance,
        hasAuth: !!auth,
        hasFirestore: !!db,
        projectId: firebaseKeys?.projectId || "Missing",
        apiKeyPresent: !!firebaseKeys?.apiKey && firebaseKeys.apiKey !== "YOUR_FIREBASE_API_KEY",
        configSource: localStorage.getItem('firebase_config') ? 'LocalStorage' : 'Static Keys'
    };
};

export default appInstance;