import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import "firebase/compat/storage";
import { firebaseKeys } from './private_keys';

// 1. Resolve configuration
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

export const isFirebaseConfigured = !!configToUse && !!configToUse.apiKey;

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

/**
 * SAFE PROXY GENERATOR
 * This creates an object that won't throw 'not a function' errors even if the 
 * underlying Firebase module fails to load. It returns a no-op function for 
 * any missing property.
 */
const createSafeService = (name: 'auth' | 'firestore' | 'storage', dummyObj: any) => {
    return new Proxy({} as any, {
        get: (target, prop) => {
            // 1. Check if the app instance has the service function
            if (firebaseAppInstance && typeof (firebaseAppInstance as any)[name] === 'function') {
                const service = (firebaseAppInstance as any)[name]();
                return service[prop];
            }
            // 2. Fallback to global firebase namespace
            if (typeof (firebase as any)[name] === 'function') {
                const service = (firebase as any)[name]();
                return service[prop];
            }
            // 3. Use the dummy object if still unavailable
            if (prop in dummyObj) return dummyObj[prop];
            
            // 4. Ultimate fallback: return a no-op function to prevent crashes
            return () => {
                console.warn(`Firebase ${name} method '${String(prop)}' called but service is not hydrated.`);
                return typeof dummyObj.onAuthStateChanged === 'function' && prop === 'onAuthStateChanged' 
                    ? () => {} 
                    : undefined;
            };
        }
    });
};

// Dummy implementations for initial/failed states
const authDummy = {
    onAuthStateChanged: (cb: any) => { cb(null); return () => {}; },
    signInWithPopup: async () => { throw new Error("Auth unavailable"); },
    signOut: async () => {},
    currentUser: null
};

const dbDummy = {
    collection: () => ({
        doc: () => ({
            get: async () => ({ exists: false }),
            onSnapshot: (cb: any) => { cb({ docs: [] }); return () => {}; },
            set: async () => {},
            update: async () => {}
        }),
        where: () => ({ get: async () => ({ empty: true, docs: [] }), onSnapshot: (cb: any) => { cb({ docs: [] }); return () => {}; } }),
        limit: () => ({ get: async () => ({ docs: [] }) }),
        orderBy: () => ({ limitToLast: () => ({ onSnapshot: () => () => {} }) })
    })
};

const storageDummy = {
    ref: () => ({
        put: async () => ({}),
        getDownloadURL: async () => "",
        listAll: async () => ({ items: [], prefixes: [] }),
        getMetadata: async () => ({})
    })
};

export const app = firebaseAppInstance;
export const auth = createSafeService('auth', authDummy);
export const db = createSafeService('firestore', dbDummy);
export const storage = createSafeService('storage', storageDummy);

export { firebase };
export default firebase;