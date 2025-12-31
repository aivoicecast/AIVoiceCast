
import firebase_raw from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import "firebase/compat/storage";
import { firebaseKeys } from './private_keys';

/**
 * Resolves the true Firebase compat namespace.
 * Handles variations in how ESM loaders like esm.sh wrap the package.
 */
const resolveFirebase = () => {
    if (typeof window !== 'undefined' && (window as any).firebase) {
        return (window as any).firebase;
    }
    return (firebase_raw as any).default || firebase_raw;
};

export const firebase: any = resolveFirebase();

/**
 * Initialize the Firebase App instance.
 */
const initializeApp = () => {
    if (!firebase || typeof firebase.initializeApp !== 'function') {
        console.error("[Firebase] Core library not correctly loaded.");
        return null;
    }

    try {
        if (firebase.apps && firebase.apps.length > 0) {
            return firebase.app();
        }
        
        if (firebaseKeys && firebaseKeys.apiKey) {
            return firebase.initializeApp(firebaseKeys);
        }
    } catch (err) {
        console.error("[Firebase] Initialization error:", err);
    }
    return null;
};

const app = initializeApp();

/**
 * Service instance resolution with graceful fallback and validation.
 */
export const getAuth = () => {
    try {
        const instance = app ? app.auth() : (firebase.auth ? firebase.auth() : null);
        if (!instance) {
            // Last resort: try initializing a default if global firebase exists
            return firebase.auth ? firebase.auth() : null;
        }
        return instance;
    } catch (e) {
        console.warn("[Firebase] Auth service retrieval failed", e);
        return null;
    }
};

export const getDb = () => {
    try {
        return app ? app.firestore() : (firebase.firestore ? firebase.firestore() : null);
    } catch (e) {
        return null;
    }
};

export const getStorage = () => {
    try {
        return app ? app.storage() : (firebase.storage ? firebase.storage() : null);
    } catch (e) {
        return null;
    }
};

// Export core service instances immediately for convenience
export const auth = getAuth();
export const db = getDb();
export const storage = getStorage();

/**
 * Flag used by UI to determine status.
 */
export const isFirebaseConfigured = !!(firebaseKeys && firebaseKeys.apiKey);

/**
 * Returns diagnostic information for the system status tools.
 */
export const getFirebaseDiagnostics = () => {
    return {
        isInitialized: !!app,
        hasAuth: !!(auth || getAuth()),
        hasFirestore: !!(db || getDb()),
        projectId: firebaseKeys?.projectId || "Missing",
        configSource: "private_keys.ts"
    };
};

export default firebase;
