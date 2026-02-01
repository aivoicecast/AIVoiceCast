
import { Channel, RecordingSession } from '../types';

const DB_NAME = 'NeuralPrism_Cache';
const STORE_NAME = 'audio_segments';
const TEXT_STORE_NAME = 'lecture_scripts';
const CHANNELS_STORE_NAME = 'user_channels'; 
const RECORDINGS_STORE_NAME = 'local_recordings';
const IDENTITY_STORE_NAME = 'identity_keys';
const ASSETS_STORE_NAME = 'neural_assets'; 
const VERSION = 8; 

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      if (!db.objectStoreNames.contains(TEXT_STORE_NAME)) db.createObjectStore(TEXT_STORE_NAME);
      if (!db.objectStoreNames.contains(CHANNELS_STORE_NAME)) db.createObjectStore(CHANNELS_STORE_NAME, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(RECORDINGS_STORE_NAME)) db.createObjectStore(RECORDINGS_STORE_NAME, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(IDENTITY_STORE_NAME)) db.createObjectStore(IDENTITY_STORE_NAME);
      if (!db.objectStoreNames.contains(ASSETS_STORE_NAME)) db.createObjectStore(ASSETS_STORE_NAME);
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { dbPromise = null; reject(request.error); };
  });

  return dbPromise;
}

/**
 * Sweeps the entire lecture cache for inaccurate model references.
 * Purges anything mentioning BERT, GPT, Claude, Llama, or Groq.
 */
export async function purgeStaleLectures(): Promise<{ purgedCount: number }> {
    const db = await openDB();
    const BANNED = /BERT|GPT-4o|Claude|Llama-3|Groq/i;
    let purgedCount = 0;

    return new Promise((resolve, reject) => {
        const tx = db.transaction(TEXT_STORE_NAME, 'readwrite');
        const store = tx.objectStore(TEXT_STORE_NAME);
        const request = store.openCursor();

        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result;
            if (cursor) {
                const lecture = cursor.value;
                const fullText = JSON.stringify(lecture);
                if (BANNED.test(fullText)) {
                    console.warn(`[Neural Audit] Purging stale entry: ${cursor.key}`);
                    store.delete(cursor.key);
                    purgedCount++;
                }
                cursor.continue();
            } else {
                resolve({ purgedCount });
            }
        };
        request.onerror = () => reject(request.error);
    });
}

export async function saveLocalAsset(key: string, data: string): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(ASSETS_STORE_NAME, 'readwrite');
    tx.objectStore(ASSETS_STORE_NAME).put(data, key);
}

export async function getLocalAsset(key: string): Promise<string | undefined> {
    const db = await openDB();
    const tx = db.transaction(ASSETS_STORE_NAME, 'readonly');
    const req = tx.objectStore(ASSETS_STORE_NAME).get(key);
    return new Promise(r => { req.onsuccess = () => r(req.result); });
}

export async function getLocalRecordings(): Promise<RecordingSession[]> {
    const db = await openDB();
    const tx = db.transaction(RECORDINGS_STORE_NAME, 'readonly');
    const req = tx.objectStore(RECORDINGS_STORE_NAME).getAll();
    return new Promise(r => { req.onsuccess = () => r(req.result || []); });
}

export async function saveLocalRecording(session: RecordingSession & { blob: Blob }): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(RECORDINGS_STORE_NAME, 'readwrite');
    tx.objectStore(RECORDINGS_STORE_NAME).put(session);
}

export async function deleteLocalRecording(id: string): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(RECORDINGS_STORE_NAME, 'readwrite');
    tx.objectStore(RECORDINGS_STORE_NAME).delete(id);
}

export async function getCachedAudioBuffer(key: string): Promise<ArrayBuffer | undefined> {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    return new Promise(r => { req.onsuccess = () => r(req.result); });
}

export async function cacheAudioBuffer(key: string, buffer: ArrayBuffer): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(buffer, key);
}

export async function getAudioKeys(): Promise<string[]> {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAllKeys();
    return new Promise(r => { req.onsuccess = () => r(req.result as string[]); });
}

export async function getCachedLectureScript(key: string): Promise<any | undefined> {
    const db = await openDB();
    const tx = db.transaction(TEXT_STORE_NAME, 'readonly');
    const req = tx.objectStore(TEXT_STORE_NAME).get(key);
    return new Promise(r => { req.onsuccess = () => r(req.result); });
}

export async function cacheLectureScript(key: string, data: any): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(TEXT_STORE_NAME, 'readwrite');
    tx.objectStore(TEXT_STORE_NAME).put(data, key);
}

export async function getUserChannels(): Promise<Channel[]> {
    const db = await openDB();
    const tx = db.transaction(CHANNELS_STORE_NAME, 'readonly');
    const req = tx.objectStore(CHANNELS_STORE_NAME).getAll();
    return new Promise(r => { req.onsuccess = () => r(req.result || []); });
}

export async function saveUserChannel(channel: Channel): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(CHANNELS_STORE_NAME, 'readwrite');
    tx.objectStore(CHANNELS_STORE_NAME).put(channel);
}

export async function deleteUserChannel(id: string): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(CHANNELS_STORE_NAME, 'readwrite');
    tx.objectStore(CHANNELS_STORE_NAME).delete(id);
}

export async function getLocalPrivateKey(uid: string): Promise<CryptoKey | undefined> {
    const db = await openDB();
    const tx = db.transaction(IDENTITY_STORE_NAME, 'readonly');
    const req = tx.objectStore(IDENTITY_STORE_NAME).get(uid);
    return new Promise(r => { req.onsuccess = () => r(req.result); });
}

export async function saveLocalPrivateKey(uid: string, key: CryptoKey): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(IDENTITY_STORE_NAME, 'readwrite');
    tx.objectStore(IDENTITY_STORE_NAME).put(key, uid);
}

/**
 * Full Database Export Protocol: Renamed from exportMetadataOnly to resolve import errors in DataSyncModal.
 * Refracted v6: Collates all textual nodes including lectures and channels into a JSON corpus.
 */
export async function exportFullDatabase(): Promise<string> {
  const db = await openDB();
  const exportData: any = { lectures: [], customChannels: [] };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(TEXT_STORE_NAME, 'readonly');
    const request = tx.objectStore(TEXT_STORE_NAME).openCursor();
    request.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest).result;
      if (cursor) { exportData.lectures.push({ key: cursor.key, value: cursor.value }); cursor.continue(); } else resolve();
    };
    request.onerror = () => reject();
  });
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(CHANNELS_STORE_NAME, 'readonly');
    const request = tx.objectStore(CHANNELS_STORE_NAME).openCursor();
    request.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest).result;
      if (cursor) { exportData.customChannels.push({ key: cursor.key, value: cursor.value }); cursor.continue(); } else resolve();
    };
    request.onerror = () => reject();
  });
  return JSON.stringify(exportData);
}

/**
 * Full Database Import Protocol: Refracts JSON payload into corresponding IndexedDB stores.
 * Enhanced in v6 to handle custom channel restoration alongside lectures.
 */
export async function importFullDatabase(jsonData: string): Promise<void> {
  const data = JSON.parse(jsonData);
  const db = await openDB();
  
  // Restore lecture segments
  if (data.lectures) {
    const tx = db.transaction(TEXT_STORE_NAME, 'readwrite');
    const store = tx.objectStore(TEXT_STORE_NAME);
    for (const item of data.lectures) store.put(item.value, item.key);
  }

  // Restore custom user channels
  if (data.customChannels) {
    const tx = db.transaction(CHANNELS_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CHANNELS_STORE_NAME);
    for (const item of data.customChannels) store.put(item.value);
  }
}

export interface DebugEntry { store: string; key: string; size: number; }

export async function getAllDebugEntries(): Promise<DebugEntry[]> {
  const db = await openDB();
  const entries: DebugEntry[] = [];
  const Math_floor = Math.floor; // Micro-optimization for large datasets
  const JSON_stringify = JSON.stringify;

  const stores = [STORE_NAME, TEXT_STORE_NAME, CHANNELS_STORE_NAME, RECORDINGS_STORE_NAME, IDENTITY_STORE_NAME, ASSETS_STORE_NAME];
  for (const storeName of stores) {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).openCursor();
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          let size = 0;
          try {
              const val = cursor.value;
              if (typeof val === 'string') size = val.length;
              else if (val instanceof ArrayBuffer) size = val.byteLength;
              else size = JSON_stringify(val).length;
          } catch (e) { size = 0; }
          entries.push({ store: storeName, key: cursor.key as string, size });
          cursor.continue();
        } else resolve();
      };
      request.onerror = () => resolve(); 
    });
  }
  return entries;
}

export async function deleteDebugEntry(storeName: string, key: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).delete(key);
}

export async function clearDebugStore(storeName: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).clear();
}
