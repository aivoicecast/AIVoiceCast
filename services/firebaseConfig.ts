import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
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
 * Exported service instances using standard modular pattern.
 * We explicitly pass the appInstance to ensure they attach to the correct registry.
 */
export const auth: Auth | null = appInstance ? getAuth(appInstance) : null;
export const db: Firestore | null = appInstance ? getFirestore(appInstance) : null;
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