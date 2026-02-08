import { initializeApp, getApps, getApp } from "@firebase/app";
import type { FirebaseApp } from "@firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "@firebase/auth";
import type { Auth } from "@firebase/auth";
import { initializeFirestore, getFirestore, enableIndexedDbPersistence, CACHE_SIZE_UNLIMITED } from "@firebase/firestore";
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

        if (firebaseKeys && firebaseKeys.apiKey && firebaseKeys.apiKey !== "YOUR_BASE_API_KEY") {
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
 * Uses experimentalForceLongPolling to bypass environment restrictions on WebSockets 
 * which frequently causes the "Could not reach Cloud Firestore backend" timeout.
 */
const initDb = (): Firestore | null => {
    if (!appInstance) return null;
    
    let firestore: Firestore;
    try {
        console.log("[Firestore] Initializing refractive data plane with Enhanced Long-Polling...");
        // Use experimentalForceLongPolling to handle environments where WebSockets are blocked/unstable
        firestore = initializeFirestore(appInstance, {
            experimentalForceLongPolling: true,
            experimentalAutoDetectLongPolling: true,
            cacheSizeBytes: CACHE_SIZE_UNLIMITED
        });
    } catch (e) {
        console.warn("[Firestore] initializeFirestore failed, falling back to getFirestore:", e);
        firestore = getFirestore(appInstance);
    }

    // Persistence initialization shouldn't block the connection.
    enableIndexedDbPersistence(firestore).catch((err) => {
        if (err.code === 'failed-precondition') {
            console.debug("[Firestore] Persistence: Multiple tabs open. Local cache active.");
        } else if (err.code === 'unimplemented') {
            console.debug("[Firestore] Persistence: Browser environment lacks IndexedDB support.");
        } else {
            console.warn("[Firestore] Persistence failed to initialize:", err.message);
        }
    });

    return firestore;
};

// CRITICAL: Ensure Auth is initialized with the explicit app instance
const authInstance: Auth | null = appInstance ? getAuth(appInstance) : null;

if (authInstance) {
    setPersistence(authInstance, browserLocalPersistence).catch((err) => {
        console.error("[Auth] Persistence setup failed:", err);
    });
}

export const auth = authInstance;
export const db: Firestore | null = initDb();
export const storage: FirebaseStorage | null = appInstance ? getStorage(appInstance, firebaseKeys.storageBucket) : null;

export const getAuthInstance = (): Auth | null => auth;
export const getDb = (): Firestore | null => db;
export const getStorageInstance = (): FirebaseStorage | null => storage;

export const isFirebaseConfigured = !!(firebaseKeys && firebaseKeys.apiKey && firebaseKeys.apiKey !== "YOUR_BASE_API_KEY");

export const getFirebaseDiagnostics = () => {
    return {
        isInitialized: !!appInstance,
        hasAuth: !!auth,
        hasFirestore: !!db,
        projectId: firebaseKeys?.projectId || "Missing",
        apiKeyPresent: !!firebaseKeys?.apiKey && firebaseKeys.apiKey !== "YOUR_BASE_API_KEY",
        configSource: localStorage.getItem('firebase_config') ? 'LocalStorage' : 'Static Keys'
    };
};

export default appInstance;
