import { initializeApp, getApps, getApp } from "firebase/app";
import type { FirebaseApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import type { Auth } from "firebase/auth";
import { initializeFirestore, enableMultiTabIndexedDbPersistence, getFirestore } from "firebase/firestore";
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
        }
    } catch (err) {
        console.error("[Firebase] Initialization failed:", err);
    }
    return null;
};

const appInstance = initializeFirebase();

/**
 * Robust Firestore Initialization
 */
const initDb = (): Firestore | null => {
    if (!appInstance) return null;
    
    try {
        const firestore = getFirestore(appInstance);
        enableMultiTabIndexedDbPersistence(firestore).catch((err) => {
            if (err.code === 'failed-precondition') {
                console.warn("[Firestore] Persistence failed: Multiple tabs open.");
            } else if (err.code === 'unimplemented') {
                console.warn("[Firestore] Persistence failed: Browser not supported.");
            }
        });
        return firestore;
    } catch (e) {
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
        apiKeyPresent: !!firebaseKeys?.apiKey && firebaseKeys.apiKey !== "YOUR_FIREBASE_API_KEY"
    };
};

export default appInstance;