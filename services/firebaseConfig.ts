
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import "firebase/compat/storage";
import { firebaseKeys as defaultKeys } from './private_keys';

/**
 * Robustly resolves the Firebase namespace for compat mode.
 * Handles different ESM bundling behaviors (like esm.sh).
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

// 2. Initialize the app
// We must initialize before we attempt to export the service instances.
if (fb && hasValidKey && !fb.apps.length) {
    try {
        fb.initializeApp(activeConfig);
        console.log("[Firebase] Initialized with", usingStoredConfig ? "LocalStorage" : "private_keys.ts");
    } catch (err) {
        console.error("[Firebase] Initialization error:", err);
    }
}

/**
 * 3. Export service instances.
 * We use getter-style evaluation or ensure initialization has happened.
 * In compat mode, fb.auth(), fb.firestore(), and fb.storage() return
 * the service instance for the default initialized app.
 * We defensively check if the functions exist before calling them to avoid TypeErrors.
 */
export const auth = (fb && fb.apps.length > 0 && typeof fb.auth === 'function') ? fb.auth() : null;
export const db = (fb && fb.apps.length > 0 && typeof fb.firestore === 'function') ? fb.firestore() : null;
export const storage = (fb && fb.apps.length > 0 && typeof fb.storage === 'function') ? fb.storage() : null;

/**
 * isFirebaseConfigured is true if valid keys are present and the app is ready.
 */
export const isFirebaseConfigured = hasValidKey && fb && fb.apps.length > 0;

export { fb as firebase };
export default fb;
