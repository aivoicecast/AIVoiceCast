
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import "firebase/compat/storage";
import { firebaseKeys } from './private_keys';

/**
 * Initialize the Firebase App instance.
 */
const initializeApp = () => {
    if (!firebase || typeof firebase.initializeApp !== 'function') {
        console.error("[Firebase] library not found or initializeApp is not a function.");
        return null;
    }

    try {
        if (firebase.apps && firebase.apps.length > 0) {
            return firebase.app();
        }

        if (firebaseKeys && firebaseKeys.apiKey && firebaseKeys.apiKey !== "YOUR_FIREBASE_API_KEY") {
            // Dynamically determine authDomain
            const currentHostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
            
            // Standard known domains for the project
            const authorizedDomains = [
                "localhost",
                "fir-cfb5e.firebaseapp.com",
                "fir-cfb5e.web.app",
                "aivoicecast-platform-836641670384.us-west1.run.app",
                "dev.aivoicecast.com"
            ];

            let dynamicAuthDomain = "fir-cfb5e.firebaseapp.com";
            if (authorizedDomains.includes(currentHostname)) {
                dynamicAuthDomain = currentHostname;
            }

            const configWithDynamicAuthDomain = {
                ...firebaseKeys,
                authDomain: dynamicAuthDomain
            };

            return firebase.initializeApp(configWithDynamicAuthDomain);
        } else {
            console.warn("[Firebase] Configuration missing or using placeholder key.");
        }
    } catch (err) {
        console.error("[Firebase] Initialization failed:", err);
    }
    return null;
};

// Internal instance
let _app: any = initializeApp();

/**
 * Service instance resolution with validation.
 */
export const getAuth = () => {
    try {
        if (!_app) _app = initializeApp();
        return _app ? _app.auth() : null;
    } catch (e) {
        console.error("[Firebase] getAuth failed", e);
        return null;
    }
};

export const getDb = () => {
    try {
        if (!_app) _app = initializeApp();
        return _app ? _app.firestore() : null;
    } catch (e) {
        console.error("[Firebase] getDb failed", e);
        return null;
    }
};

export const getStorage = () => {
    try {
        if (!_app) _app = initializeApp();
        return _app ? _app.storage() : null;
    } catch (e) {
        console.error("[Firebase] getStorage failed", e);
        return null;
    }
};

/**
 * Flag used by UI to determine status.
 */
export const isFirebaseConfigured = !!(firebaseKeys && firebaseKeys.apiKey && firebaseKeys.apiKey !== "YOUR_FIREBASE_API_KEY");

// Export named instances. 
// Note: These are initialized once here. If they are null, consumers will see the "Database Offline" UI.
export const auth = getAuth();
export const db = getDb();
export const storage = getStorage();

/**
 * Returns diagnostic information.
 */
export const getFirebaseDiagnostics = () => {
    return {
        isInitialized: !!_app,
        hasAuth: !!auth,
        hasFirestore: !!db,
        projectId: firebaseKeys?.projectId || "Missing",
        apiKeyPresent: !!firebaseKeys?.apiKey && firebaseKeys.apiKey !== "YOUR_FIREBASE_API_KEY"
    };
};

export { firebase };
export default firebase;
