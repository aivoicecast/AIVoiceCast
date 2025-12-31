
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import "firebase/compat/storage";
import { firebaseKeys } from './private_keys';

// 1. Resolve configuration (Priority: LocalStorage -> PrivateKeys)
let configToUse = firebaseKeys;
const savedConfig = localStorage.getItem('firebase_config');
if (savedConfig) {
    try {
        const parsed = JSON.parse(savedConfig);
        if (parsed && parsed.apiKey) configToUse = parsed;
    } catch (e) {
        console.error("Failed to parse saved firebase config", e);
    }
}

export const isFirebaseConfigured = !!configToUse && !!configToUse.apiKey && !!configToUse.projectId;

/**
 * Initialize the Firebase app instance safely.
 */
let firebaseAppInstance: firebase.app.App | null = null;
if (isFirebaseConfigured) {
    try {
        firebaseAppInstance = firebase.apps.length 
            ? firebase.app() 
            : firebase.initializeApp(configToUse);
    } catch (err) {
        console.error("Firebase initialization failed:", err);
    }
}

// Dummy implementations to prevent runtime crashes if Firebase is unconfigured
const authDummy = {
    onAuthStateChanged: (cb: any) => { cb(null); return () => {}; },
    signInWithPopup: async () => { throw new Error("Auth not configured. Go to 'Connection Settings' and paste your Firebase config."); },
    signOut: async () => {},
    currentUser: null
};

const dbDummy = {
    collection: () => ({
        doc: () => ({
            get: async () => ({ exists: false }),
            onSnapshot: (cb: any) => { cb({ docs: [] }); return () => {}; },
            set: async () => {},
            update: async () => {},
            delete: async () => {}
        }),
        where: () => ({ get: async () => ({ empty: true, docs: [] }), onSnapshot: (cb: any) => { cb({ docs: [] }); return () => {}; } }),
        limit: () => ({ get: async () => ({ empty: true, docs: [] }), onSnapshot: (cb: any) => { cb({ docs: [] }); return () => {}; } }),
        orderBy: () => ({ limitToLast: () => ({ onSnapshot: () => () => {} }) })
    }),
    batch: () => ({ set: () => {}, commit: async () => {} }),
    runTransaction: async (fn: any) => { return await fn({ get: async () => ({ exists: false }), update: () => {}, set: () => {} }); }
};

const storageDummy = {
    ref: () => ({
        put: async () => ({}),
        getDownloadURL: async () => "",
        listAll: async () => ({ items: [], prefixes: [] }),
        getMetadata: async () => ({}),
        delete: async () => {}
    })
};

/**
 * SERVICE PROXY GENERATOR
 * Intercepts property access to the Firebase services. 
 * If the real service isn't ready (app unconfigured or module loading), it returns the dummy.
 */
const createResilientService = (name: 'auth' | 'firestore' | 'storage', dummy: any) => {
    return new Proxy({} as any, {
        get: (target, prop) => {
            let service: any = null;
            try {
                if (firebaseAppInstance && typeof (firebase as any)[name] === 'function') {
                    service = (firebase as any)[name]();
                }
            } catch (e) {
                // Service not ready yet
            }

            const activeSource = service || dummy;
            const value = activeSource[prop];
            
            // Ensure functions stay bound to their original context (real service or dummy)
            if (typeof value === 'function') {
                return value.bind(activeSource);
            }
            return value;
        }
    });
};

export const app = firebaseAppInstance;
export const auth: firebase.auth.Auth = createResilientService('auth', authDummy);
export const db: firebase.firestore.Firestore = createResilientService('firestore', dbDummy);
export const storage: firebase.storage.Storage = createResilientService('storage', storageDummy);

export { firebase };
export default firebase;
