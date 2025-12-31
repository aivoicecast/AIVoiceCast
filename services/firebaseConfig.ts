
import firebase_raw from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import "firebase/compat/storage";
import { firebaseKeys } from './private_keys';

/**
 * Resolves the true Firebase compat namespace.
 */
const resolveFirebase = () => {
    if (typeof window !== 'undefined' && (window as any).firebase) {
        return (window as any).firebase;
    }
    const resolved = (firebase_raw as any).default || firebase_raw;
    return resolved;
};

export const firebase: any = resolveFirebase();

/**
 * Initialize the Firebase App instance.
 */
const initializeApp = () => {
    if (!firebase || typeof firebase.initializeApp !== 'function') {
        return null;
    }

    try {
        if (firebase.apps && firebase.apps.length > 0) {
            return firebase.app();
        }

        if (firebaseKeys && firebaseKeys.apiKey && firebaseKeys.apiKey !== "YOUR_FIREBASE_API_KEY") {
            // Dynamically determine authDomain
            const currentHostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
            
            // Fallback default
            let dynamicAuthDomain = "fir-cfb5e.firebaseapp.com";

            // List of explicitly authorized domains for this project
            const authorizedDomains = [
                "localhost",
                "fir-cfb5e.firebaseapp.com",
                "fir-cfb5e.web.app",
                "aivoicecast-platform-836641670384.us-west1.run.app",
                "dev.aivoicecast.com"
            ];

            if (authorizedDomains.includes(currentHostname)) {
                dynamicAuthDomain = currentHostname;
            }

            const configWithDynamicAuthDomain = {
                ...firebaseKeys,
                authDomain: dynamicAuthDomain
            };

            return firebase.initializeApp(configWithDynamicAuthDomain);
        }
    } catch (err) {
        console.warn("[Firebase] Initialization skipped or failed:", err);
    }
    return null;
};

// Internal instance
let _app: any = null;

const getApp = () => {
    if (!_app) _app = initializeApp();
    return _app;
};

/**
 * Service instance resolution with validation.
 */
export const getAuth = () => {
    try {
        const app = getApp();
        return app ? app.auth() : null;
    } catch (e) {
        return null;
    }
};

export const getDb = () => {
    try {
        const app = getApp();
        return app ? app.firestore() : null;
    } catch (e) {
        return null;
    }
};

export const getStorage = () => {
    try {
        const app = getApp();
        return app ? app.storage() : null;
    } catch (e) {
        return null;
    }
};

/**
 * Flag used by UI to determine status.
 */
export const isFirebaseConfigured = !!(firebaseKeys && firebaseKeys.apiKey && firebaseKeys.apiKey !== "YOUR_FIREBASE_API_KEY");

// Export named instances to resolve external import errors across the application.
export const auth = getAuth();
export const db = getDb();
export const storage = getStorage();

/**
 * Returns diagnostic information.
 */
export const getFirebaseDiagnostics = () => {
    const app = getApp();
    const authInstance = getAuth();
    return {
        isInitialized: !!app,
        hasAuth: !!authInstance,
        hasFirestore: !!getDb(),
        projectId: firebaseKeys?.projectId || "Missing",
        configSource: "private_keys.ts",
        activeConfig: firebaseKeys ? { ...firebaseKeys, apiKey: firebaseKeys.apiKey ? "PRESENT" : "MISSING" } : null
    };
};

export default firebase;
