
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
try {
    const savedConfig = localStorage.getItem('firebase_config');
    if (savedConfig) {
        activeConfig = JSON.parse(savedConfig);
        console.log("[Firebase] Using configuration from LocalStorage.");
    }
} catch (e) {
    console.warn("[Firebase] Failed to parse saved config from LocalStorage", e);
}

// 2. Initialize the Firebase app instance
if (fb && fb.apps && !fb.apps.length && activeConfig.apiKey) {
    try {
        fb.initializeApp(activeConfig);
    } catch (err) {
        console.error("[Firebase] Initialization error:", err);
    }
}

// 3. Export instances of the core services.
// We use a safe check to see if the services were successfully augmented by compat imports.
export const auth = (fb && typeof fb.auth === 'function') ? fb.auth() : null;
export const db = (fb && typeof fb.firestore === 'function') ? fb.firestore() : null;
export const storage = (fb && typeof fb.storage === 'function') ? fb.storage() : null;

// isFirebaseConfigured should be true if essential services are ready
export const isFirebaseConfigured = !!(fb && fb.apps && fb.apps.length > 0 && auth);

export { fb as firebase };
export default fb;
