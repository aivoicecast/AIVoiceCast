import { Channel, RecordingSession } from '../types';

const DB_NAME = 'NeuralPrism_Cache';
const STORE_NAME = 'audio_segments';
const TEXT_STORE_NAME = 'lecture_scripts';
const CHANNELS_STORE_NAME = 'user_channels'; 
const RECORDINGS_STORE_NAME = 'local_recordings';
const IDENTITY_STORE_NAME = 'identity_keys';
const VERSION = 7; 

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    console.log(`[IDB] Opening Neural Cache: ${DB_NAME} v${VERSION}`);
    const request = indexedDB.open(DB_NAME, VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBRequest).result;
      console.log("[IDB] Prism Refraction Upgrade...");
      
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      if (!db.objectStoreNames.contains(TEXT_STORE_NAME)) db.createObjectStore(TEXT_STORE_NAME);
      if (!db.objectStoreNames.contains(CHANNELS_STORE_NAME)) db.createObjectStore(CHANNELS_STORE_NAME, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(RECORDINGS_STORE_NAME)) db.createObjectStore(RECORDINGS_STORE_NAME, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(IDENTITY_STORE_NAME)) db.createObjectStore(IDENTITY_STORE_NAME);
    };

    request.onsuccess = () => {
        resolve(request.result);
    };
    
    request.onerror = () => {
      console.error("[IDB] Neural cache error:", request.error);
      dbPromise = null;
      reject(request.error);
    };

    request.onblocked = () => {
        console.warn("[IDB] Upgrade blocked by another Prism instance.");
        dbPromise = null;
    };
  });

  return dbPromise;
}

export async function getLocalRecordings(): Promise<RecordingSession[]> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(RECORDINGS_STORE_NAME, 'readonly');
            const store = transaction.objectStore(RECORDINGS_STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    } catch(e) { 
        return []; 
    }
}

export async function saveLocalRecording(session: RecordingSession & { blob: Blob }): Promise<void> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(RECORDINGS_STORE_NAME, 'readwrite');
            const store = transaction.objectStore(RECORDINGS_STORE_NAME);
            const request = store.put(session);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch(e) {}
}

export async function deleteLocalRecording(id: string): Promise<void> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(RECORDINGS_STORE_NAME, 'readwrite');
            const store = transaction.objectStore(RECORDINGS_STORE_NAME);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch(e) {}
}

export async function getCachedAudioBuffer(key: string): Promise<ArrayBuffer | undefined> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) { return undefined; }
}

export async function cacheAudioBuffer(key: string, buffer: ArrayBuffer): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(buffer, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {}
}

export async function getAudioKeys(): Promise<string[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAllKeys();
      request.onsuccess = () => resolve(request.result as string[]);
      request.onerror = () => reject(request.error);
    });
  } catch (error) { return []; }
}

export async function getCachedLectureScript(key: string): Promise<any | undefined> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(TEXT_STORE_NAME, 'readonly');
      const store = transaction.objectStore(TEXT_STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) { return undefined; }
}

export async function cacheLectureScript(key: string, data: any): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(TEXT_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(TEXT_STORE_NAME);
      const request = store.put(data, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {}
}

export async function getUserChannels(): Promise<Channel[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CHANNELS_STORE_NAME, 'readonly');
      const store = transaction.objectStore(CHANNELS_STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) { return []; }
}

export async function saveUserChannel(channel: Channel): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CHANNELS_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(CHANNELS_STORE_NAME);
      const request = store.put(channel);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {}
}

export async function deleteUserChannel(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CHANNELS_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(CHANNELS_STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {}
}

export async function getLocalPrivateKey(uid: string): Promise<CryptoKey | undefined> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(IDENTITY_STORE_NAME, 'readonly');
            const store = transaction.objectStore(IDENTITY_STORE_NAME);
            const request = store.get(uid);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch(e) { return undefined; }
}

export async function saveLocalPrivateKey(uid: string, key: CryptoKey): Promise<void> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(IDENTITY_STORE_NAME, 'readwrite');
            const store = transaction.objectStore(IDENTITY_STORE_NAME);
            const request = store.put(key, uid);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch(e) {}
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function exportFullDatabase(): Promise<string> {
  const db = await openDB();
  const exportData: any = {
    lectures: [],
    audio: [],
    customChannels: []
  };

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(TEXT_STORE_NAME, 'readonly');
    const store = transaction.objectStore(TEXT_STORE_NAME);
    const request = store.openCursor();
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        exportData.lectures.push({ key: cursor.key, value: cursor.value });
        cursor.continue();
      } else { resolve(); }
    };
    request.onerror = () => reject(request.error);
  });

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.openCursor();
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        const base64 = arrayBufferToBase64(cursor.value);
        exportData.audio.push({ key: cursor.key, value: base64 });
        cursor.continue();
      } else { resolve(); }
    };
    request.onerror = () => reject(request.error);
  });

  return JSON.stringify(exportData);
}

export async function exportMetadataOnly(): Promise<string> {
  const db = await openDB();
  const exportData: any = { lectures: [], customChannels: [] };
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(TEXT_STORE_NAME, 'readonly');
    const store = transaction.objectStore(TEXT_STORE_NAME);
    const request = store.openCursor();
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) { exportData.lectures.push({ key: cursor.key, value: cursor.value }); cursor.continue(); } else { resolve(); }
    };
    request.onerror = () => reject(request.error);
  });
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(CHANNELS_STORE_NAME, 'readonly');
    const store = transaction.objectStore(CHANNELS_STORE_NAME);
    const request = store.openCursor();
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) { exportData.customChannels.push({ key: cursor.key, value: cursor.value }); cursor.continue(); } else { resolve(); }
    };
    request.onerror = () => reject(request.error);
  });
  return JSON.stringify(exportData);
}

export async function importFullDatabase(jsonData: string): Promise<void> {
  const data = JSON.parse(jsonData);
  const db = await openDB();
  if (data.lectures && Array.isArray(data.lectures)) {
    const transaction = db.transaction(TEXT_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(TEXT_STORE_NAME);
    for (const item of data.lectures) store.put(item.value, item.key);
    await new Promise((resolve) => { transaction.oncomplete = resolve; });
  }
  if (data.audio && Array.isArray(data.audio)) {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    for (const item of data.audio) { const buffer = base64ToArrayBuffer(item.value); store.put(buffer, item.key); }
    await new Promise((resolve) => { transaction.oncomplete = resolve; });
  }
}

export interface DebugEntry { store: string; key: string; size: number; }

export async function getAllDebugEntries(): Promise<DebugEntry[]> {
  const db = await openDB();
  const entries: DebugEntry[] = [];
  const stores = [STORE_NAME, TEXT_STORE_NAME, CHANNELS_STORE_NAME, RECORDINGS_STORE_NAME, IDENTITY_STORE_NAME];
  for (const storeName of stores) {
    try {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.openCursor();
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            let size = 0;
            if (storeName === STORE_NAME) size = (cursor.value as ArrayBuffer).byteLength;
            else size = JSON.stringify(cursor.value).length;
            entries.push({ store: storeName, key: cursor.key as string, size: size });
            cursor.continue();
          } else { resolve(); }
        };
        request.onerror = () => resolve(); 
      });
    } catch(e) {}
  }
  return entries;
}

export async function deleteDebugEntry(storeName: string, key: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).delete(key);
  return new Promise((resolve) => { tx.oncomplete = () => resolve(); });
}

export async function clearDebugStore(storeName: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).clear();
  return new Promise((resolve) => { tx.oncomplete = () => resolve(); });
}