
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import "firebase/compat/storage";
import { firebaseKeys as defaultKeys } from './private_keys';

/**
 * Robustly resolves the Firebase namespace for compat mode.
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
 * 3. Export service instances as dynamic getters to avoid initialization race conditions.
 */
export const getAuth = () => {
    const activeFb = (firebase as any).default || firebase;
    return (activeFb && activeFb.apps.length > 0 && typeof activeFb.auth === 'function') ? activeFb.auth() : null;
};

export const getDb = () => {
    const activeFb = (firebase as any).default || firebase;
    return (activeFb && activeFb.apps.length > 0 && typeof activeFb.firestore === 'function') ? activeFb.firestore() : null;
};

export const getStorage = () => {
    const activeFb = (firebase as any).default || firebase;
    return (activeFb && activeFb.apps.length > 0 && typeof activeFb.storage === 'function') ? activeFb.storage() : null;
};

// Exporting as getters ensures that these are always fresh and never stale 'null' values.
export const auth = getAuth();
export const db = getDb();
export const storage = getStorage();

export const isFirebaseConfigured = hasValidKey && fb && fb.apps.length > 0;

export { fb as firebase };
export default fb;
