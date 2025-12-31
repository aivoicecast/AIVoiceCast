
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
let usingStoredConfig = false;

try {
    const savedConfig = localStorage.getItem('firebase_config');
    if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        if (parsed.apiKey && !parsed.apiKey.includes("YOUR_FIREBASE")) {
            activeConfig = parsed;
            usingStoredConfig = true;
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
        console.log("[Firebase] Initialized with", usingStoredConfig ? "LocalStorage" : "private_keys.ts");
    } catch (err) {
        console.error("[Firebase] Initialization error:", err);
    }
}

/**
 * 3. Export service instances as getters to avoid initialization race conditions.
 * Module-level constants are evaluated once at load time. If the compat modules 
 * (auth, firestore, storage) are still loading, fb.auth() might return null or throw.
 */
export const getAuth = () => (fb && fb.apps.length > 0 && typeof fb.auth === 'function') ? fb.auth() : null;
export const getDb = () => (fb && fb.apps.length > 0 && typeof fb.firestore === 'function') ? fb.firestore() : null;
export const getStorage = () => (fb && fb.apps.length > 0 && typeof fb.storage === 'function') ? fb.storage() : null;

// Legacy constant exports for components that don't use the getters yet
// We initialize them but they may be null if accessed too early.
export const auth = getAuth();
export const db = getDb();
export const storage = getStorage();

/**
 * isFirebaseConfigured is true if valid keys are present and the app is ready.
 */
export const isFirebaseConfigured = hasValidKey && fb && fb.apps.length > 0;

export { fb as firebase };
export default fb;
