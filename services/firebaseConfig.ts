
import firebase from "firebase/app";
import "firebase/auth";
import "firebase/firestore";
import "firebase/storage";
import { firebaseKeys } from './private_keys';

const configToUse = firebaseKeys;

// Flag to tell UI if we are running on meaningful config
export const isFirebaseConfigured = !!configToUse.apiKey;

// Initialize Firebase
// Check if apps are already initialized to prevent hot-reload errors
export const app = !firebase.apps.length ? firebase.initializeApp(configToUse) : firebase.app();

export const auth = firebase.auth();
export const db = firebase.firestore();
export const storage = firebase.storage();

export default firebase;
