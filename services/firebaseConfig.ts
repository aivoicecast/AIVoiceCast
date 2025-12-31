import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import "firebase/compat/storage";
import { firebaseKeys as defaultKeys } from './private_keys';

/**
 * In ESM environments, the default export is the firebase namespace.
 */
const fb = firebase;

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
if (hasValidKey && !fb.apps.length) {
    try {
        fb.initializeApp(activeConfig);
        console.log("[Firebase] Initialized with", configSource);
    } catch (err) {
        console.error("[Firebase] Initialization error:", err);
    }
}

/**
 * Service instance getters
 */
export const getAuth = () => {
    if (fb.apps.length > 0 && typeof fb.auth === 'function') return fb.auth();
    return null;
};

export const getDb = () => {
    if (fb.apps.length > 0 && typeof fb.firestore === 'function') return fb.firestore();
    return null;
};

export const getStorage = () => {
    if (fb.apps.length > 0 && typeof fb.storage === 'function') return fb.storage();
    return null;
};

/**
 * Proxy exports that always call the getter.
 */
export const auth = {
    get currentUser() { return getAuth()?.currentUser || null; },
    onAuthStateChanged: (cb: any) => {
        const a = getAuth();
        if (a) return a.onAuthStateChanged(cb);
        return () => {};
    },
    signInWithPopup: (p: any) => {
        const a = getAuth();
        if (!a) throw new Error("Auth not initialized");
        return a.signInWithPopup(p);
    },
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

export const isFirebaseConfigured = hasValidKey && fb.apps.length > 0;

// Added getFirebaseDiagnostics to fix missing export error in components/FirebaseConfigModal.tsx
/**
 * Returns diagnostic information about the Firebase initialization.
 * Used by FirebaseConfigModal.tsx
 */
export const getFirebaseDiagnostics = () => {
    return {
        isInitialized: fb.apps.length > 0,
        configSource: configSource,
        activeConfig: {
            ...activeConfig,
            apiKey: activeConfig.apiKey ? activeConfig.apiKey.substring(0, 6) + "..." : "None"
        },
        projectId: activeConfig.projectId
    };
};

export { fb as firebase };
export default fb;
