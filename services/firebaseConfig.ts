import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import "firebase/compat/storage";
import { firebaseKeys } from './private_keys';

/**
 * Resiliently resolves the Firebase Compat namespace.
 * Side-effect imports (like compat/auth) augment the base firebase object.
 * In some ESM environments, the augmented object may be nested or circular.
 * This iterative approach safely traverses the 'default' chain.
 */
function resolveFirebaseNamespace(obj: any): any {
    let current = obj;
    // Limit traversal depth to prevent infinite loops from proxies or circularity
    for (let i = 0; i < 5; i++) {
        if (!current) break;
        
        // If this object has the auth method, it's the augmented compat namespace we need.
        if (typeof current.auth === 'function') return current;
        
        // If there's a default property and it's not a self-reference, unwrap it.
        if (current.default && current.default !== current) {
            current = current.default;
        } else {
            break;
        }
    }
    // Return the most likely candidate or the original object
    return current || obj;
}

const fb = resolveFirebaseNamespace(firebase);

// Initialize the Firebase app instance if not already done.
if (fb && fb.apps && !fb.apps.length) {
    fb.initializeApp(firebaseKeys);
}

// Export instances of the core services.
// We use optional chaining and fallback to null to prevent crash if resolution failed
export const auth = fb?.auth ? fb.auth() : null;
export const db = fb?.firestore ? fb.firestore() : null;
export const storage = fb?.storage ? fb.storage() : null;

// isFirebaseConfigured should only be true if the essential 'auth' service is resolved.
export const isFirebaseConfigured = !!(fb && fb.apps && auth);

// Re-export the resolved namespace
export { fb as firebase };
export default fb;