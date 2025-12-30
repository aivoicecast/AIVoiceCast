
import { db, storage, auth } from './firebaseConfig';
import firebase from 'firebase/compat/app';
import { exportFullDatabase, importFullDatabase, exportMetadataOnly, getAudioKeys, getCachedAudioBuffer, cacheAudioBuffer } from '../utils/db';
import { hashString } from '../utils/audioUtils';

const CLOUD_FOLDER = 'backups';

// Get User ID: Priority is Auth User -> 'public'
function getUserId() {
  // 1. Authenticated User (Secure)
  if (auth.currentUser) {
    return auth.currentUser.uid;
  }
  
  // 2. Guest User (Public Read-Only)
  return 'public';
}

export async function uploadToCloud(): Promise<{ count: number, size: number, time: number }> {
  if (!auth.currentUser) {
    throw new Error("Guest users cannot upload to cloud. Please sign in to save your data.");
  }

  const startTime = Date.now();
  const uid = getUserId();
  
  // 1. Export Metadata (Lectures + Channels, no Audio)
  const metadataJson = await exportMetadataOnly();
  const metadataBlob = new Blob([metadataJson], { type: 'application/json' });
  
  await storage.ref(`${CLOUD_FOLDER}/${uid}/metadata.json`).put(metadataBlob);

  // 2. Incremental Audio Sync
  let totalSize = metadataBlob.size;
  let itemCount = 0;
  try {
      const data = JSON.parse(metadataJson);
      itemCount = (data.lectures?.length || 0) + (data.customChannels?.length || 0);
  } catch(e) {}

  // Fetch remote manifest (key -> hash mapping)
  let remoteManifest: Record<string, string> = {};
  try {
     const url = await storage.ref(`${CLOUD_FOLDER}/${uid}/manifest.json`).getDownloadURL();
     const res = await fetch(url);
     remoteManifest = await res.json();
  } catch(e) {
     // Manifest doesn't exist yet, that's fine
  }

  const localKeys = await getAudioKeys();
  const updatedManifest: Record<string, string> = { ...remoteManifest };
  
  let newUploads = 0;

  for (const key of localKeys) {
     // If we don't have a record of this key in the cloud manifest
     if (!updatedManifest[key]) {
        const hash = await hashString(key);
        // Only upload if we haven't mapped this hash yet
        const buffer = await getCachedAudioBuffer(key);
        if (buffer) {
           await storage.ref(`${CLOUD_FOLDER}/${uid}/audio/${hash}`).put(new Blob([buffer]));
           updatedManifest[key] = hash; // Update manifest
           totalSize += buffer.byteLength;
           newUploads++;
        }
     } else {
        // Already in cloud, just count it
        itemCount++;
     }
  }
  
  // 3. Upload Updated Manifest
  const manifestBlob = new Blob([JSON.stringify(updatedManifest)], { type: 'application/json' });
  await storage.ref(`${CLOUD_FOLDER}/${uid}/manifest.json`).put(manifestBlob);

  const durationMs = Date.now() - startTime;

  // 4. Update Metadata in Firestore
  const userDocRef = db.collection('users').doc(uid);
  await userDocRef.set({
    email: auth.currentUser?.email || 'guest',
    lastBackup: firebase.firestore.Timestamp.now(),
    device: navigator.userAgent,
    backupSize: totalSize,
    itemCount: itemCount + localKeys.length,
    isAnonymous: false
  }, { merge: true });

  // Update local timestamp
  localStorage.setItem('last_cloud_sync', new Date().toISOString());

  return {
    count: itemCount + localKeys.length,
    size: totalSize,
    time: durationMs
  };
}

export async function getCloudBackupMetadata() {
  const uid = getUserId();
  const fileRef = storage.ref(`${CLOUD_FOLDER}/${uid}/metadata.json`);
  try {
    const metadata = await fileRef.getMetadata();
    return metadata;
  } catch (e) {
    return null;
  }
}

export async function downloadFromCloud(): Promise<{ count: number, size: number, time: number }> {
  const startTime = Date.now();
  const uid = getUserId();
  
  // 1. Download Metadata
  const metaUrl = await storage.ref(`${CLOUD_FOLDER}/${uid}/metadata.json`).getDownloadURL();
  const metaRes = await fetch(metaUrl);
  if (!metaRes.ok) throw new Error("Failed to download metadata");
  
  const metadataJson = await metaRes.text();
  await importFullDatabase(metadataJson); // Imports lectures and channels
  
  let totalSize = new Blob([metadataJson]).size;
  let count = 0;
  
  // 2. Download Audio using Manifest
  try {
     const manifestUrl = await storage.ref(`${CLOUD_FOLDER}/${uid}/manifest.json`).getDownloadURL();
     const manifestRes = await fetch(manifestUrl);
     const manifest: Record<string, string> = await manifestRes.json();
     
     const keys = Object.keys(manifest);
     count = keys.length;
     
     // Check what we are missing
     for (const key of keys) {
        const hash = manifest[key];
        // Check if we have it locally
        const existing = await getCachedAudioBuffer(key);
        if (!existing) {
           // Download it
           try {
              const audioUrl = await storage.ref(`${CLOUD_FOLDER}/${uid}/audio/${hash}`).getDownloadURL();
              const audioRes = await fetch(audioUrl);
              const audioBuffer = await audioRes.arrayBuffer();
              
              await cacheAudioBuffer(key, audioBuffer);
              totalSize += audioBuffer.byteLength;
           } catch(err) {
              console.warn(`Failed to download audio segment ${hash} for key ${key}`);
           }
        }
     }
  } catch(e) {
     console.warn("No audio manifest found, skipping audio download");
  }

  const durationMs = Date.now() - startTime;
  
  // Update local timestamp
  localStorage.setItem('last_cloud_sync', new Date().toISOString());

  return {
    count,
    size: totalSize,
    time: durationMs
  };
}

export async function getLastBackupTime(): Promise<Date | null> {
  // Check local first for immediate UI update
  const local = localStorage.getItem('last_cloud_sync');
  if (local) return new Date(local);

  const uid = getUserId();
  
  // Guests don't have a user doc usually, unless we write one for 'public'
  if (uid === 'public') return null;

  const userDocRef = db.collection('users').doc(uid);
  try {
    const snap = await userDocRef.get();
    if (snap.exists) {
      const data = snap.data();
      return data?.lastBackup?.toDate() || null;
    }
  } catch (e) {
    // console.warn("Could not fetch last backup time", e);
  }
  return null;
}

// --- Debugging / Admin Functions ---

export interface CloudFileEntry {
  name: string;
  fullPath: string;
  size: number;
  timeCreated: string;
  contentType?: string;
  isFolder: boolean;
}

export async function listUserBackups(subPath: string = ''): Promise<CloudFileEntry[]> {
  const uid = getUserId();
  // Ensure we don't double slash
  const path = subPath ? `${CLOUD_FOLDER}/${uid}/${subPath}` : `${CLOUD_FOLDER}/${uid}`;
  const folderRef = storage.ref(path);
  
  try {
    const res = await folderRef.listAll();
    
    // 1. Folders (Prefixes)
    const folders = res.prefixes.map(p => ({
      name: p.name,
      fullPath: p.fullPath,
      size: 0,
      timeCreated: '',
      isFolder: true
    }));

    // 2. Files (Items)
    const files = await Promise.all(res.items.map(async (itemRef) => {
      try {
        const meta = await itemRef.getMetadata();
        return {
          name: itemRef.name,
          fullPath: itemRef.fullPath,
          size: meta.size,
          timeCreated: meta.timeCreated,
          contentType: meta.contentType,
          isFolder: false
        };
      } catch (e) {
        return null;
      }
    }));
    
    return [...folders, ...(files.filter(Boolean) as CloudFileEntry[])];
  } catch (e) {
    console.error("Error listing cloud backups", e);
    return [];
  }
}

export async function deleteCloudFile(fullPath: string): Promise<void> {
  await storage.ref(fullPath).delete();
}
