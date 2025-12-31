
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import "firebase/compat/storage";
import { firebaseKeys as defaultKeys } from './private_keys';

/**
 * Robustly resolves the Firebase namespace.
 * In some environments (like esm.sh), the default export is the namespace itself.
 */
const fb = (firebase as any).default || firebase;

// 1. Determine configuration
let activeConfig = defaultKeys;
let configSource: 'file' | 'localstorage' = 'file';

try {
    const savedConfig = localStorage.getItem('firebase_config');
    if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        if (parsed.apiKey && !parsed.apiKey.includes("YOUR_FIREBASE")) {
            activeConfig = parsed;
            configSource = 'localstorage';
        }
    }
} catch (e) {
    console.warn("[Firebase] Failed to parse saved config", e);
}

const hasValidKey = activeConfig.apiKey && !activeConfig.apiKey.includes("YOUR_FIREBASE");

// 2. Initialize the app if valid keys are present
if (fb && hasValidKey && !fb.apps.length) {
    try {
        fb.initializeApp(activeConfig);
        console.log("[Firebase] Initialized with", configSource);
    } catch (err) {
        console.error("[Firebase] Initialization error:", err);
    }
}

/**
 * Diagnostic helper for UI components
 */
export const getFirebaseDiagnostics = () => {
    return {
        isInitialized: fb && fb.apps.length > 0,
        configSource,
        hasApiKey: !!activeConfig.apiKey,
        isDefaultKey: activeConfig.apiKey === defaultKeys.apiKey,
        projectId: activeConfig.projectId,
        authDomain: activeConfig.authDomain,
        activeConfig: {
            ...activeConfig,
            apiKey: activeConfig.apiKey ? `${activeConfig.apiKey.substring(0, 8)}...` : null
        }
    };
};

/**
 * Service instance getters - Ensure these check for existence of service functions
 */
export const getAuth = () => {
    if (fb && fb.apps.length > 0 && typeof fb.auth === 'function') return fb.auth();
    return null;
};

export const getDb = () => {
    if (fb && fb.apps.length > 0 && typeof fb.firestore === 'function') return fb.firestore();
    return null;
};

export const getStorage = () => {
    if (fb && fb.apps.length > 0 && typeof fb.storage === 'function') return fb.storage();
    return null;
};

/**
 * Proxy exports that always call the getter.
 * This prevents the "null on first load" issue when other modules import these constants.
 */
export const auth = {
    get currentUser() { return getAuth()?.currentUser || null; },
    onAuthStateChanged: (cb: any) => getAuth()?.onAuthStateChanged(cb) || (() => {}),
    signInWithPopup: (p: any) => getAuth()?.signInWithPopup(p),
    signOut: () => getAuth()?.signOut()
} as any;

export const db = {
    collection: (p: string) => getDb()?.collection(p),
    doc: (p: string) => getDb()?.doc(p),
    runTransaction: (cb: any) => getDb()?.runTransaction(cb),
    batch: () => getDb()?.batch()
} as any;

export const storage = {
    ref: (p: string) => getStorage()?.ref(p)
} as any;

export const isFirebaseConfigured = hasValidKey && fb && fb.apps.length > 0;

export { fb as firebase };
export default fb;
