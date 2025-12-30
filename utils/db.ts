
import { Channel } from '../types';

const DB_NAME = 'AIVoiceCast_AudioCache';
const STORE_NAME = 'audio_segments';
const TEXT_STORE_NAME = 'lecture_scripts';
const CHANNELS_STORE_NAME = 'user_channels'; // New store for custom podcasts
const VERSION = 4; // Bump version to 4

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBRequest).result;
      
      // Store 1: Audio Blobs
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      
      // Store 2: Text Scripts (Course Content)
      if (!db.objectStoreNames.contains(TEXT_STORE_NAME)) {
        db.createObjectStore(TEXT_STORE_NAME);
      }

      // Store 3: User Created Channels
      if (!db.objectStoreNames.contains(CHANNELS_STORE_NAME)) {
        db.createObjectStore(CHANNELS_STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    
    request.onerror = () => {
      dbPromise = null;
      console.error("IndexedDB Error:", request.error);
      reject(request.error);
    };

    request.onblocked = () => {
        dbPromise = null;
        const msg = "Database upgrade blocked. Please close other tabs/windows of this app and reload.";
        console.warn(msg);
        reject(new Error(msg));
    };
  });

  return dbPromise;
}

// --- Audio Functions ---

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
  } catch (error) {
    console.warn("Error reading from audio cache DB:", error);
    return undefined;
  }
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
  } catch (error) {
    console.warn("Error writing to audio cache DB:", error);
  }
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
  } catch (error) {
    console.warn("Error reading audio keys:", error);
    return [];
  }
}

// --- Text Content Functions (Lectures) ---

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
  } catch (error) {
    console.warn("Error reading text cache:", error);
    return undefined;
  }
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
  } catch (error) {
    console.warn("Error writing text cache:", error);
  }
}

export async function deleteCachedLectureScript(key: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(TEXT_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(TEXT_STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("Error deleting text cache:", error);
  }
}

// --- User Channels Functions ---

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
  } catch (error) {
    console.warn("Error getting user channels:", error);
    return [];
  }
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
  } catch (error) {
    console.warn("Error saving user channel:", error);
  }
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
  } catch (error) {
    console.warn("Error deleting user channel:", error);
  }
}

// --- Backup & Restore Functions ---

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
      } else {
        resolve();
      }
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
      } else {
        resolve();
      }
    };
    request.onerror = () => reject(request.error);
  });

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(CHANNELS_STORE_NAME, 'readonly');
    const store = transaction.objectStore(CHANNELS_STORE_NAME);
    const request = store.openCursor();
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        exportData.customChannels.push(cursor.value);
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = () => reject(request.error);
  });

  return JSON.stringify(exportData);
}

export async function exportMetadataOnly(): Promise<string> {
  const db = await openDB();
  const exportData: any = {
    lectures: [],
    customChannels: [],
    audio: []
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
      } else {
        resolve();
      }
    };
    request.onerror = () => reject(request.error);
  });

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(CHANNELS_STORE_NAME, 'readonly');
    const store = transaction.objectStore(CHANNELS_STORE_NAME);
    const request = store.openCursor();
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        exportData.customChannels.push(cursor.value);
        cursor.continue();
      } else {
        resolve();
      }
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
    for (const item of data.lectures) {
      store.put(item.value, item.key);
    }
    await new Promise((resolve) => { transaction.oncomplete = resolve; });
  }

  if (data.audio && Array.isArray(data.audio)) {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    for (const item of data.audio) {
      const buffer = base64ToArrayBuffer(item.value);
      store.put(buffer, item.key);
    }
    await new Promise((resolve) => { transaction.oncomplete = resolve; });
  }
  
  if (data.customChannels && Array.isArray(data.customChannels)) {
      const transaction = db.transaction(CHANNELS_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(CHANNELS_STORE_NAME);
      for (const ch of data.customChannels) {
          store.put(ch);
      }
      await new Promise((resolve) => { transaction.oncomplete = resolve; });
  }
}

export interface DebugEntry {
  store: string;
  key: string;
  size: number;
}

export async function getAllDebugEntries(): Promise<DebugEntry[]> {
  const db = await openDB();
  const entries: DebugEntry[] = [];
  const stores = [STORE_NAME, TEXT_STORE_NAME, CHANNELS_STORE_NAME];

  for (const storeName of stores) {
    try {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.openCursor();
        
        request.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest).result;
          if (cursor) {
            let size = 0;
            if (storeName === STORE_NAME) { 
               size = (cursor.value as ArrayBuffer).byteLength;
            } else {
               size = JSON.stringify(cursor.value).length;
            }
            entries.push({
              store: storeName,
              key: cursor.key as string,
              size: size
            });
            cursor.continue();
          } else {
            resolve();
          }
        };
        request.onerror = () => resolve(); 
      });
    } catch(e) {
      console.warn(`Could not read store ${storeName}`, e);
    }
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
