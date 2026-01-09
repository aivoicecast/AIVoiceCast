import { initializeApp, getApps, getApp } from "firebase/app";
import type { FirebaseApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence, Auth } from "firebase/auth";
import { getFirestore, enableMultiTabIndexedDbPersistence, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { firebaseKeys } from './private_keys';

const firebaseConfig = {
  ...firebaseKeys,
  authDomain: firebaseKeys.projectId ? `${firebaseKeys.projectId}.firebaseapp.com` : ""
};

const isConfigValid = !!(firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_FIREBASE_API_KEY" && firebaseConfig.apiKey !== "");

let appInstance: FirebaseApp | null = null;
export let auth: Auth | null = null;
export let db: Firestore | null = null;
export let storage: FirebaseStorage | null = null;
export let appInitialized = false;

const initializeFirebase = () => {
    try {
        if (!isConfigValid) {
            console.warn("[Firebase] Neural Config missing. Local Mode active.");
            return;
        }

        const apps = getApps();
        appInstance = apps.length > 0 ? getApp() : initializeApp(firebaseConfig);
        
        if (appInstance) {
            // Components register themselves when these functions are called
            // In ESM environments, ensure we only call these once per app instance
            auth = getAuth(appInstance);
            db = getFirestore(appInstance);
            storage = getStorage(appInstance);
            appInitialized = true;

            console.log("[Firebase] Neural Core: LINKED");

            setPersistence(auth, browserLocalPersistence).catch(e => console.error("[Auth] Device persistence failed", e));
            
            enableMultiTabIndexedDbPersistence(db).catch(e => {
                if (e.code === 'failed-precondition') {
                    console.warn("[Firestore] Multiple tabs open - offline ledger limited.");
                }
            });
        }
    } catch (error) {
        console.error("[Firebase] Fatal Neural Handshake Error:", error);
    }
};

initializeFirebase();

export const isFirebaseConfigured = isConfigValid;

export const getFirebaseDiagnostics = () => {
    return {
        isInitialized: appInitialized,
        hasAuth: !!auth,
        hasFirestore: !!db,
        projectId: firebaseKeys?.projectId || "None",
        apiKeyPresent: isConfigValid,
        instanceCount: getApps().length,
        configSource: isConfigValid ? 'private_keys.ts' : 'none',
        activeConfig: {
            apiKey: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 6)}...` : 'None'
        }
    };
};

export default appInstance;