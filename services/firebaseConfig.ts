
import firebase_raw from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import "firebase/compat/storage";
import { firebaseKeys as defaultKeys } from './private_keys';

/**
 * Retrieves the effective Firebase configuration.
 * Static configuration from private_keys.ts.
 */
const getFirebaseConfig = () => defaultKeys;

const firebaseKeys = getFirebaseConfig();

/**
 * Resolves the true Firebase compat namespace.
 * Handles variations in how ESM loaders wrap the package.
 */
const resolveFirebase = () => {
    // 1. Try the global window object first (Standard for browser scripts)
    const winFb = (window as any).firebase;
    if (winFb) return winFb;

    // 2. Check the raw module import
    const raw: any = firebase_raw;
    if (raw?.initializeApp) return raw;

    // 3. Check for .default property (Common in ESM)
    if (raw?.default?.initializeApp) return raw.default;

    return raw;
};

// The resolved Firebase namespace
export const firebase: any = resolveFirebase();

/**
 * Initialize the Firebase App instance.
 */
const initializeApp = () => {
    if (!firebase || typeof firebase.initializeApp !== 'function') {
        console.error("[Firebase] Firebase core library not correctly loaded.");
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
 * Service instance resolution.
 */
const resolveService = (name: 'auth' | 'firestore' | 'storage') => {
    try {
        // Try the app instance first (Standard way)
        if (app && typeof (app as any)[name] === 'function') {
            return (app as any)[name]();
        }
        // Fallback to root namespace (Some legacy compat setups)
        if (firebase && typeof firebase[name] === 'function') {
            return firebase[name]();
        }
    } catch (e) {
        console.warn(`[Firebase] Service ${name} not yet available:`, e);
    }
    return null;
};

// Export core service instances
export const auth = resolveService('auth');
export const db = resolveService('firestore');
export const storage = resolveService('storage');

// Functional getters for a safer access pattern
export const getAuth = () => auth || resolveService('auth');
export const getDb = () => db || resolveService('firestore');
export const getStorage = () => storage || resolveService('storage');

/**
 * Flag used by UI to determine status.
 */
export const isFirebaseConfigured = !!(firebaseKeys && firebaseKeys.apiKey);

/**
 * Returns diagnostic information for the system status tools.
 */
export const getFirebaseDiagnostics = () => {
    const activeKeys = getFirebaseConfig();
    return {
        isInitialized: !!app,
        configSource: 'private_keys.ts',
        activeConfig: {
            ...activeKeys,
            apiKey: activeKeys.apiKey ? activeKeys.apiKey.substring(0, 6) + "..." : "None"
        },
        projectId: activeKeys.projectId,
        hasAuthMethod: !!(firebase?.auth || app?.auth),
        hasFirestoreMethod: !!(firebase?.firestore || app?.firestore)
    };
};

export default firebase;
