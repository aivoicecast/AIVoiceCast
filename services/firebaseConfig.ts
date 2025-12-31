import firebase_raw from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import "firebase/compat/storage";
import { firebaseKeys } from './private_keys';

/**
 * Robust Firebase instance resolution.
 * ESM loaders (like esm.sh) often wrap the Firebase compat namespace in a .default property.
 * Additionally, side-effect imports for Auth/Firestore/Storage usually register themselves 
 * on the global window.firebase object in compat mode.
 */
const resolveFirebase = () => {
    // 1. Try global window instance first (most reliable for compat plugins in ESM)
    const winFb = (window as any).firebase;
    if (winFb && typeof winFb.auth === 'function' && typeof winFb.initializeApp === 'function') {
        return winFb;
    }
    // 2. Check if the raw import has the methods
    const raw: any = firebase_raw;
    if (raw && typeof raw.auth === 'function') {
        return raw;
    }
    // 3. Check for .default wrapper
    if (raw && raw.default && typeof raw.default.auth === 'function') {
        return raw.default;
    }
    // Fallback
    return raw?.default || raw;
};

const firebase: any = resolveFirebase();

/**
 * Initialize the default Firebase app if not already present.
 */
const app = (() => {
    try {
        if (firebase.apps && firebase.apps.length > 0) {
            return firebase.app();
        }
        return firebase.initializeApp(firebaseKeys);
    } catch (err) {
        console.error("[Firebase] Initialization error:", err);
        return null;
    }
})();

/**
 * Service instance getters.
 * In Firebase compat, services can be accessed via firebase.auth() or app.auth().
 */
const getAuthInstance = () => {
    try {
        if (typeof firebase.auth === 'function') return firebase.auth();
        if (app && typeof app.auth === 'function') return app.auth();
    } catch (e) { console.warn("Auth service not ready"); }
    return null;
};

const getDbInstance = () => {
    try {
        if (typeof firebase.firestore === 'function') return firebase.firestore();
        if (app && typeof app.firestore === 'function') return app.firestore();
    } catch (e) { console.warn("Firestore service not ready"); }
    return null;
};

const getStorageInstance = () => {
    try {
        if (typeof firebase.storage === 'function') return firebase.storage();
        if (app && typeof app.storage === 'function') return app.storage();
    } catch (e) { console.warn("Storage service not ready"); }
    return null;
};

// Export core service instances
export const auth = getAuthInstance();
export const db = getDbInstance();
export const storage = getStorageInstance();

// Compatibility getters for functional service layers
export const getAuth = () => getAuthInstance();
export const getDb = () => getDbInstance();
export const getStorage = () => getStorageInstance();

/**
 * Flag used by the UI to determine if initialization was successful.
 */
export const isFirebaseConfigured = !!app && !!auth;

/**
 * Returns diagnostic information for the system status tools.
 */
export const getFirebaseDiagnostics = () => {
    return {
        isInitialized: isFirebaseConfigured,
        configSource: 'file',
        activeConfig: {
            ...firebaseKeys,
            apiKey: firebaseKeys.apiKey ? firebaseKeys.apiKey.substring(0, 6) + "..." : "None"
        },
        projectId: firebaseKeys.projectId
    };
};

export { firebase };
export default firebase;