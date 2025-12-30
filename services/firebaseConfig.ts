import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import "firebase/compat/storage";
import { firebaseKeys } from './private_keys';

// Directly use the keys from the private file.
// We removed all complex Env var detection to prevent build errors.
const configToUse = firebaseKeys;

// Flag to tell UI if we are running on meaningful config
export const isFirebaseConfigured = !!configToUse.apiKey;

// Initialize Firebase
// Check if apps are already initialized to prevent hot-reload errors
export const app = !firebase.apps.length ? firebase.initializeApp(configToUse) : firebase.app();

export const auth = firebase.auth();
export const db = firebase.firestore();
export const storage = firebase.storage();