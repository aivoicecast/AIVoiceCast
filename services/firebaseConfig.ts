
import { initializeApp, getApps } from "@firebase/app";
import type { FirebaseApp } from "@firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "@firebase/auth";
import type { Auth } from "@firebase/auth";
import { initializeFirestore, getFirestore, enableIndexedDbPersistence, CACHE_SIZE_UNLIMITED } from "@firebase/firestore";
import type { Firestore } from "@firebase/firestore";
import { getStorage } from "@firebase/storage";
import type { FirebaseStorage } from "@firebase/storage";
import { firebaseKeys } from './private_keys';

/**
 * Standard Firebase Initialization
 */
const initializeFirebase = (): FirebaseApp | null => {
    try {
        const existingApps = getApps();
        if (existingApps.length > 0) {
            return existingApps[0];
        }

        if (firebaseKeys && firebaseKeys.apiKey && firebaseKeys.apiKey !== "YOUR_BASE_API_KEY") {
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
 * CRITICAL CONNECTIVITY FIX:
 * Forces long-polling and disables fetch streams to bypass environment-level WebSocket blocking.
 */
const initDb = (): Firestore | null => {
    if (!appInstance) return null;
    
    let firestore: Firestore;
    try {
        // initializeFirestore MUST be called before any other getFirestore call
        firestore = initializeFirestore(appInstance, {
            experimentalForceLongPolling: true,
            cacheSizeBytes: CACHE_SIZE_UNLIMITED
        });
        console.log("[Firestore] Relational Plane: Long-Polling Force Engaged.");
    } catch (e) {
        console.warn("[Firestore] Re-initialization skipped, falling back to existing instance.");
        firestore = getFirestore(appInstance);
    }

    enableIndexedDbPersistence(firestore).catch((err) => {
        if (err.code !== 'failed-precondition') {
            console.warn("[Firestore] Persistence fault:", err.message);
        }
    });

    return firestore;
};

const authInstance: Auth | null = appInstance ? getAuth(appInstance) : null;

if (authInstance) {
    setPersistence(authInstance, browserLocalPersistence).catch(console.error);
}

export const auth = authInstance;
export const db: Firestore | null = initDb();
export const storage: FirebaseStorage | null = appInstance ? getStorage(appInstance, firebaseKeys.storageBucket) : null;

export const getFirebaseDiagnostics = () => {
    return {
        isInitialized: !!appInstance,
        hasAuth: !!auth,
        hasFirestore: !!db,
        projectId: firebaseKeys?.projectId || "Missing",
        configSource: localStorage.getItem('firebase_config') ? 'LocalStorage' : 'Static Keys'
    };
};

export default appInstance;
