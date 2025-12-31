
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import "firebase/compat/storage";
import { firebaseKeys as defaultKeys } from './private_keys';

/**
 * Resiliently resolves the Firebase Compat namespace.
 */
function resolveFirebaseNamespace(obj: any): any {
    if (!obj) return null;
    let current = obj;
    // Standard ESM resolution
    if (current.default && typeof current.default.auth === 'function') {
        return current.default;
    }
    // Deep resolution for some proxy environments
    for (let i = 0; i < 3; i++) {
        if (typeof current.auth === 'function') return current;
        if (current.default && current.default !== current) {
            current = current.default;
        } else {
            break;
        }
    }
    return current;
}

const fb = resolveFirebaseNamespace(firebase);

// 1. Determine which keys to use (Priority: LocalStorage > private_keys.ts)
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

// 2. Initialize the Firebase app instance
const hasValidKey = activeConfig.apiKey && !activeConfig.apiKey.includes("YOUR_FIREBASE");

if (fb && hasValidKey && !fb.apps.length) {
    try {
        fb.initializeApp(activeConfig);
        console.log("[Firebase] Initialized with", usingStoredConfig ? "LocalStorage" : "private_keys.ts");
    } catch (err) {
        console.error("[Firebase] Initialization error:", err);
    }
}

// 3. Export instances of the core services with defensive checks.
// If fb.auth is not yet attached as a function, return null to allow App.tsx to handle it gracefully via its 'if (auth)' checks.
export const auth = (fb && fb.apps.length > 0 && typeof fb.auth === 'function') ? fb.auth() : null;
export const db = (fb && fb.apps.length > 0 && typeof fb.firestore === 'function') ? fb.firestore() : null;
export const storage = (fb && fb.apps.length > 0 && typeof fb.storage === 'function') ? fb.storage() : null;

/**
 * isFirebaseConfigured is true if valid keys are present.
 */
export const isFirebaseConfigured = hasValidKey;

export { fb as firebase };
export default fb;
