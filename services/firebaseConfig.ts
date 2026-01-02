
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { initializeFirestore, Firestore, enableMultiTabIndexedDbPersistence } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { firebaseKeys } from './private_keys';

/**
 * Standard Firebase Initialization
 */
const initializeFirebase = (): FirebaseApp | null => {
    try {
        // Return existing app if already initialized
        if (getApps().length > 0) {
            return getApp();
        }

        // Initialize new app with configuration
        if (firebaseKeys && firebaseKeys.apiKey && firebaseKeys.apiKey !== "YOUR_FIREBASE_API_KEY") {
            return initializeApp(firebaseKeys);
        } else {
            console.warn("[Firebase] Configuration missing or using placeholder key.");
        }
    } catch (err) {
        console.error("[Firebase] Initialization failed:", err);
    }
    return null;
};

// Internal single app instance
const appInstance = initializeFirebase();

/**
 * Robust Firestore Initialization
 * experimentalForceLongPolling: true fixes connectivity in environments with restricted WebSockets.
 */
const initDb = (): Firestore | null => {
    if (!appInstance) return null;
    
    const firestore = initializeFirestore(appInstance, {
        experimentalForceLongPolling: true,
    });

    // Enable local persistence for better offline/flaky connection handling
    enableMultiTabIndexedDbPersistence(firestore).catch((err) => {
        if (err.code === 'failed-precondition') {
            // Multiple tabs open, persistence can only be enabled in one tab at a time.
            console.warn("[Firestore] Persistence failed: Multiple tabs open.");
        } else if (err.code === 'unimplemented') {
            // The current browser does not support all of the features required to enable persistence
            console.warn("[Firestore] Persistence failed: Browser not supported.");
        }
    });

    return firestore;
};

/**
 * Exported service instances using standard modular pattern.
 */
export const auth: Auth | null = appInstance ? getAuth(appInstance) : null;
export const db: Firestore | null = initDb();
export const storage: FirebaseStorage | null = appInstance ? getStorage(appInstance) : null;

/**
 * Robust service getters for dynamic access if needed.
 */
export const getAuthInstance = (): Auth | null => auth;
export const getDb = (): Firestore | null => db;
export const getStorageInstance = (): FirebaseStorage | null => storage;

/**
 * Flag used by UI to determine status.
 */
export const isFirebaseConfigured = !!(firebaseKeys && firebaseKeys.apiKey && firebaseKeys.apiKey !== "YOUR_FIREBASE_API_KEY");

/**
 * Returns diagnostic information for troubleshooting.
 */
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
