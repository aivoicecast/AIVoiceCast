import { initializeApp, getApps, getApp } from "firebase/app";
import type { FirebaseApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import type { Auth } from "firebase/auth";
import { initializeFirestore, enableMultiTabIndexedDbPersistence } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import type { FirebaseStorage } from "firebase/storage";
import { firebaseKeys } from './private_keys';

/**
 * Standard Firebase Initialization
 */
const initializeFirebase = (): FirebaseApp | null => {
    try {
        if (getApps().length > 0) {
            return getApp();
        }

        if (firebaseKeys && firebaseKeys.apiKey && firebaseKeys.apiKey !== "YOUR_FIREBASE_API_KEY") {
            const config = {
                ...firebaseKeys,
                authDomain: `${firebaseKeys.projectId}.firebaseapp.com`
            };
            return initializeApp(config);
        } else {
            console.warn("[Firebase] Configuration missing or using placeholder key.");
        }
    } catch (err) {
        console.error("[Firebase] Initialization failed:", err);
    }
    return null;
};

const appInstance = initializeFirebase();

/**
 * Robust Firestore Initialization
 * Configured to handle proxy/firewall environments that block WebSockets.
 */
const initDb = (): Firestore | null => {
    if (!appInstance) return null;
    
    try {
        const firestore = initializeFirestore(appInstance, {
            experimentalForceLongPolling: true, // Use HTTP instead of WebSockets
            experimentalAutoDetectLongPolling: true,
            host: "firestore.googleapis.com",
            ssl: true,
        });

        // Initialize persistence asynchronously to prevent blocking the main handshake
        enableMultiTabIndexedDbPersistence(firestore).catch((err) => {
            if (err.code === 'failed-precondition') {
                console.warn("[Firestore] Persistence failed: Multiple tabs open.");
            } else if (err.code === 'unimplemented') {
                console.warn("[Firestore] Persistence failed: Browser not supported.");
            } else {
                console.error("[Firestore] Persistence error:", err);
            }
        });

        return firestore;
    } catch (e) {
        console.error("[Firestore] Initialization critical failure:", e);
        return null;
    }
};

const authInstance: Auth | null = appInstance ? getAuth(appInstance) : null;

if (authInstance) {
    setPersistence(authInstance, browserLocalPersistence).catch((err) => {
        console.error("[Auth] Persistence setup failed:", err);
    });
}

export const auth = authInstance;
export const db: Firestore | null = initDb();
export const storage: FirebaseStorage | null = appInstance ? getStorage(appInstance) : null;

export const getAuthInstance = (): Auth | null => auth;
export const getDb = (): Firestore | null => db;
export const getStorageInstance = (): FirebaseStorage | null => storage;

export const isFirebaseConfigured = !!(firebaseKeys && firebaseKeys.apiKey && firebaseKeys.apiKey !== "YOUR_FIREBASE_API_KEY");

export const getFirebaseDiagnostics = () => {
    return {
        isInitialized: !!appInstance,
        hasAuth: !!auth,
        hasFirestore: !!db,
        projectId: firebaseKeys?.projectId || "Missing",
        apiKeyPresent: !!firebaseKeys?.apiKey && firebaseKeys.apiKey !== "YOUR_FIREBASE_API_KEY",
        configSource: localStorage.getItem('firebase_config') ? 'LocalStorage' : 'Static Keys'
    };
};

export default appInstance;