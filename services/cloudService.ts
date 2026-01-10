import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  getMetadata, 
  deleteObject, 
  listAll 
} from '@firebase/storage';
import { 
  doc, 
  setDoc, 
  getDoc, 
  Timestamp 
} from '@firebase/firestore';
import { db, storage, auth } from './firebaseConfig';
import { 
  importFullDatabase, 
  exportMetadataOnly, 
  getAudioKeys, 
  getCachedAudioBuffer, 
  cacheAudioBuffer 
} from '../utils/db';
import { hashString } from '../utils/audioUtils';

const CLOUD_FOLDER = 'backups';

function getUserId() {
  if (auth?.currentUser) return auth.currentUser.uid;
  return 'public';
}

export async function uploadToCloud(): Promise<{ count: number, size: number, time: number }> {
  if (!auth?.currentUser || !db || !storage) throw new Error("Cloud unavailable.");

  const startTime = Date.now();
  const uid = getUserId();
  
  const metadataJson = await exportMetadataOnly();
  const metadataBlob = new Blob([metadataJson], { type: 'application/json' });
  const metaRef = ref(storage, `${CLOUD_FOLDER}/${uid}/metadata.json`);
  await uploadBytes(metaRef, metadataBlob);

  let totalSize = metadataBlob.size;
  let itemCount = 0;
  try {
      const data = JSON.parse(metadataJson);
      itemCount = (data.lectures?.length || 0) + (data.customChannels?.length || 0);
  } catch(e) {}

  let remoteManifest: Record<string, string> = {};
  try {
     const manifestRef = ref(storage, `${CLOUD_FOLDER}/${uid}/manifest.json`);
     const url = await getDownloadURL(manifestRef);
     const res = await fetch(url);
     remoteManifest = await res.json();
  } catch(e) {}

  const localKeys = await getAudioKeys();
  const updatedManifest: Record<string, string> = { ...remoteManifest };
  
  for (const key of localKeys) {
     if (!updatedManifest[key]) {
        const hash = await hashString(key);
        const buffer = await getCachedAudioBuffer(key);
        if (buffer) {
           const audioRef = ref(storage, `${CLOUD_FOLDER}/${uid}/audio/${hash}`);
           await uploadBytes(audioRef, new Blob([buffer]));
           updatedManifest[key] = hash;
           totalSize += buffer.byteLength;
        }
     } else { itemCount++; }
  }
  
  const manifestBlob = new Blob([JSON.stringify(updatedManifest)], { type: 'application/json' });
  await uploadBytes(ref(storage, `${CLOUD_FOLDER}/${uid}/manifest.json`), manifestBlob);

  await setDoc(doc(db, 'users', uid), {
    lastBackup: Timestamp.now(),
    backupSize: totalSize,
    itemCount: itemCount + localKeys.length
  }, { merge: true });

  localStorage.setItem('last_cloud_sync', new Date().toISOString());

  return { count: itemCount + localKeys.length, size: totalSize, time: Date.now() - startTime };
}

export async function getCloudBackupMetadata() {
  if (!storage) return null;
  try {
    return await getMetadata(ref(storage, `${CLOUD_FOLDER}/${getUserId()}/metadata.json`));
  } catch (e) { return null; }
}

export async function downloadFromCloud(): Promise<{ count: number, size: number, time: number }> {
  if (!storage) throw new Error("Storage unavailable");
  const startTime = Date.now();
  const uid = getUserId();
  
  const metaUrl = await getDownloadURL(ref(storage, `${CLOUD_FOLDER}/${uid}/metadata.json`));
  const metaRes = await fetch(metaUrl);
  const metadataJson = await metaRes.text();
  await importFullDatabase(metadataJson);
  
  let totalSize = new Blob([metadataJson]).size;
  let count = 0;
  
  try {
     const manifestUrl = await getDownloadURL(ref(storage, `${CLOUD_FOLDER}/${uid}/manifest.json`));
     const manifestRes = await fetch(manifestUrl);
     const manifest: Record<string, string> = await manifestRes.json();
     const keys = Object.keys(manifest);
     count = keys.length;
     
     for (const key of keys) {
        const hash = manifest[key];
        const existing = await getCachedAudioBuffer(key);
        if (!existing) {
           try {
              const audioUrl = await getDownloadURL(ref(storage, `${CLOUD_FOLDER}/${uid}/audio/${hash}`));
              const audioRes = await fetch(audioUrl);
              const audioBuffer = await audioRes.arrayBuffer();
              await cacheAudioBuffer(key, audioBuffer);
              totalSize += audioBuffer.byteLength;
           } catch(err) {}
        }
     }
  } catch(e) {}

  localStorage.setItem('last_cloud_sync', new Date().toISOString());
  return { count, size: totalSize, time: Date.now() - startTime };
}

export async function getLastBackupTime(): Promise<Date | null> {
  const local = localStorage.getItem('last_cloud_sync');
  if (local) return new Date(local);
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, 'users', getUserId()));
    if (snap.exists()) return snap.data()?.lastBackup?.toDate() || null;
  } catch (e) {}
  return null;
}

export interface CloudFileEntry {
  name: string;
  fullPath: string;
  size: number;
  timeCreated: string;
  contentType?: string;
  isFolder: boolean;
}

export async function listUserBackups(subPath: string = ''): Promise<CloudFileEntry[]> {
  if (!storage) return [];
  const uid = getUserId();
  const path = subPath ? `${CLOUD_FOLDER}/${uid}/${subPath}` : `${CLOUD_FOLDER}/${uid}`;
  const folderRef = ref(storage, path);
  
  try {
    const res = await listAll(folderRef);
    const folders = res.prefixes.map(p => ({ name: p.name, fullPath: p.fullPath, size: 0, timeCreated: '', isFolder: true }));
    const files = await Promise.all(res.items.map(async (itemRef) => {
      try {
        const meta = await getMetadata(itemRef);
        return { name: itemRef.name, fullPath: itemRef.fullPath, size: meta.size, timeCreated: meta.timeCreated, contentType: meta.contentType, isFolder: false };
      } catch (e) { return null; }
    }));
    return [...folders, ...(files.filter(Boolean) as CloudFileEntry[])];
  } catch (e) { return []; }
}

export async function deleteCloudFile(fullPath: string): Promise<void> {
  if (!storage) return;
  await deleteObject(ref(storage, fullPath));
}