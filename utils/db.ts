import { Channel, RecordingSession } from '../types';
import { safeJsonStringify } from './idUtils';

const DB_NAME = 'NeuralPrism_Cache';
const STORE_NAME = 'audio_segments';
const TEXT_STORE_NAME = 'lecture_scripts';
const CHANNELS_STORE_NAME = 'user_channels'; 
const RECORDINGS_STORE_NAME = 'local_recordings';
const IDENTITY_STORE_NAME = 'identity_keys';
const TRUSTED_IDENTITIES_STORE = 'trusted_identities';
const ASSETS_STORE_NAME = 'neural_assets'; 
const VERSION = 10; 

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * High-Density Handshake Protocol for IndexedDB
 * Hardened for v7.0.0-ULTRA to handle 100MB+ video blobs.
 */
function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    // 30s Watchdog: Generous window for the browser to allocate space for large video fragments.
    const watchdog = setTimeout(() => {
        dbPromise = null; 
        reject(new Error("IDB_TIMEOUT_LIMIT_EXCEEDED"));
    }, 30000);

    try {
        const request = indexedDB.open(DB_NAME, VERSION);

        request.onblocked = () => {
            clearTimeout(watchdog);
            window.dispatchEvent(new CustomEvent('neural-log', { 
                detail: { text: `[Vault] CONFLICT: Close other tabs to permit high-mass write.`, type: 'warn' } 
            }));
            dbPromise = null;
            reject(new Error("IDB_BLOCKED"));
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
          if (!db.objectStoreNames.contains(TEXT_STORE_NAME)) db.createObjectStore(TEXT_STORE_NAME);
          if (!db.objectStoreNames.contains(CHANNELS_STORE_NAME)) db.createObjectStore(CHANNELS_STORE_NAME, { keyPath: 'id' });
          if (!db.objectStoreNames.contains(RECORDINGS_STORE_NAME)) db.createObjectStore(RECORDINGS_STORE_NAME, { keyPath: 'id' });
          if (!db.objectStoreNames.contains(IDENTITY_STORE_NAME)) db.createObjectStore(IDENTITY_STORE_NAME);
          if (!db.objectStoreNames.contains(TRUSTED_IDENTITIES_STORE)) db.createObjectStore(TRUSTED_IDENTITIES_STORE);
          if (!db.objectStoreNames.contains(ASSETS_STORE_NAME)) db.createObjectStore(ASSETS_STORE_NAME);
        };

        request.onsuccess = () => {
            clearTimeout(watchdog);
            resolve(request.result);
        };
        
        request.onerror = () => { 
            clearTimeout(watchdog);
            dbPromise = null; 
            reject(request.error || new Error("IDB_HANDSHAKE_FAILED")); 
        };
    } catch (e: any) {
        clearTimeout(watchdog);
        dbPromise = null;
        reject(e);
    }
  });

  return dbPromise;
}

export async function getLocalRecordings(): Promise<RecordingSession[]> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            try {
                const tx = db.transaction(RECORDINGS_STORE_NAME, 'readonly');
                const store = tx.objectStore(RECORDINGS_STORE_NAME);
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => reject(req.error);
            } catch (e: any) { 
                dbPromise = null; 
                reject(e); 
            }
        });
    } catch (e: any) {
        console.warn("[Vault] Bypassing scan:", e.message);
        return []; 
    }
}

/**
 * Vaults a recording session into local storage.
 * Atomic write ensures large blobs don't corrupt the ledger.
 */
export async function saveLocalRecording(session: RecordingSession & { blob: Blob }): Promise<void> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(RECORDINGS_STORE_NAME, 'readwrite');
            const store = tx.objectStore(RECORDINGS_STORE_NAME);
            
            // Handle catastrophic aborts (e.g. out of disk space)
            tx.onabort = (e) => {
                dbPromise = null;
                reject(new Error("VAULT_ABORTED: Likely Insufficient Disk Space"));
            };

            const req = store.put(session);
            req.onsuccess = () => resolve();
            req.onerror = () => {
                dbPromise = null;
                reject(req.error);
            };
        });
    } catch(e: any) {
        dbPromise = null;
        window.dispatchEvent(new CustomEvent('neural-log', { 
            detail: { text: `[Vault] High-Mass Save Failure: ${e.message}`, type: 'error' } 
        }));
        throw e;
    }
}

export async function deleteLocalRecording(id: string): Promise<void> {
    try {
        const db = await openDB();
        const tx = db.transaction(RECORDINGS_STORE_NAME, 'readwrite');
        tx.objectStore(RECORDINGS_STORE_NAME).delete(id);
    } catch(e) {
        dbPromise = null;
    }
}

export async function getCachedAudioBuffer(key: string): Promise<ArrayBuffer | undefined> {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(key);
        return new Promise(r => { req.onsuccess = () => r(req.result); });
    } catch(e) { return undefined; }
}

export async function cacheAudioBuffer(key: string, buffer: ArrayBuffer): Promise<void> {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(buffer, key);
    } catch(e) {}
}

export async function getAudioKeys(): Promise<string[]> {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).getAllKeys();
        return new Promise(r => { req.onsuccess = () => r(req.result as string[]); });
    } catch(e) { return []; }
}

export async function getCachedLectureScript(key: string): Promise<any | undefined> {
    try {
        const db = await openDB();
        const tx = db.transaction(TEXT_STORE_NAME, 'readonly');
        const req = tx.objectStore(TEXT_STORE_NAME).get(key);
        return new Promise(r => { req.onsuccess = () => r(req.result); });
    } catch(e) { return undefined; }
}

export async function cacheLectureScript(key: string, data: any): Promise<void> {
    try {
        const db = await openDB();
        const tx = db.transaction(TEXT_STORE_NAME, 'readwrite');
        tx.objectStore(TEXT_STORE_NAME).put(data, key);
    } catch(e) {}
}

export async function getUserChannels(): Promise<Channel[]> {
    try {
        const db = await openDB();
        const tx = db.transaction(CHANNELS_STORE_NAME, 'readonly');
        const req = tx.objectStore(CHANNELS_STORE_NAME).getAll();
        return new Promise(r => { req.onsuccess = () => r(req.result || []); });
    } catch(e) { return []; }
}

export async function saveUserChannel(channel: Channel): Promise<void> {
    try {
        const db = await openDB();
        const tx = db.transaction(CHANNELS_STORE_NAME, 'readwrite');
        tx.objectStore(CHANNELS_STORE_NAME).put(channel);
    } catch(e) {}
}

export async function deleteUserChannel(id: string): Promise<void> {
    try {
        const db = await openDB();
        const tx = db.transaction(CHANNELS_STORE_NAME, 'readwrite');
        tx.objectStore(CHANNELS_STORE_NAME).delete(id);
    } catch(e) {}
}

export async function getLocalPrivateKey(uid: string): Promise<CryptoKey | undefined> {
    try {
        const db = await openDB();
        const tx = db.transaction(IDENTITY_STORE_NAME, 'readonly');
        const req = tx.objectStore(IDENTITY_STORE_NAME).get(uid);
        return new Promise(r => { req.onsuccess = () => r(req.result); });
    } catch(e) { return undefined; }
}

export async function saveLocalPrivateKey(uid: string, key: CryptoKey): Promise<void> {
    try {
        const db = await openDB();
        const tx = db.transaction(IDENTITY_STORE_NAME, 'readwrite');
        tx.objectStore(IDENTITY_STORE_NAME).put(key, uid);
    } catch(e) {}
}

export async function getTrustedIdentity(uid: string): Promise<string | undefined> {
    try {
        const db = await openDB();
        const tx = db.transaction(TRUSTED_IDENTITIES_STORE, 'readonly');
        const req = tx.objectStore(TRUSTED_IDENTITIES_STORE).get(uid);
        return new Promise(r => { req.onsuccess = () => r(req.result); });
    } catch(e) { return undefined; }
}

export async function saveTrustedIdentity(uid: string, certificate: string): Promise<void> {
    try {
        const db = await openDB();
        const tx = db.transaction(TRUSTED_IDENTITIES_STORE, 'readwrite');
        tx.objectStore(TRUSTED_IDENTITIES_STORE).put(certificate, uid);
    } catch(e) {}
}

export async function getAllTrustedIdentities(): Promise<Record<string, string>> {
    try {
        const db = await openDB();
        const tx = db.transaction(TRUSTED_IDENTITIES_STORE, 'readonly');
        const store = tx.objectStore(TRUSTED_IDENTITIES_STORE);
        const req = store.openCursor();
        const result: Record<string, string> = {};
        return new Promise((resolve) => {
            req.onsuccess = (e) => {
                const cursor = (e.target as IDBRequest).result;
                if (cursor) {
                    result[cursor.key as string] = cursor.value;
                    cursor.continue();
                } else resolve(result);
            };
            req.onerror = () => resolve({});
        });
    } catch(e) { return {}; }
}

export async function purgeStaleLectures(): Promise<{ purgedCount: number }> {
    try {
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
                    const fullText = safeJsonStringify(lecture);
                    if (BANNED.test(fullText)) {
                        store.delete(cursor.key);
                        purgedCount++;
                    }
                    cursor.continue();
                } else resolve({ purgedCount });
            };
            request.onerror = () => reject(request.error);
        });
    } catch(e) { return { purgedCount: 0 }; }
}

export async function saveLocalAsset(key: string, data: string): Promise<void> {
    try {
        const db = await openDB();
        const tx = db.transaction(ASSETS_STORE_NAME, 'readwrite');
        tx.objectStore(ASSETS_STORE_NAME).put(data, key);
    } catch(e) {}
}

export async function getLocalAsset(key: string): Promise<string | undefined> {
    try {
        const db = await openDB();
        const tx = db.transaction(ASSETS_STORE_NAME, 'readonly');
        const req = tx.objectStore(ASSETS_STORE_NAME).get(key);
        return new Promise(r => { req.onsuccess = () => r(req.result); });
    } catch(e) { return undefined; }
}

export async function exportFullDatabase(): Promise<string> {
    try {
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
        return safeJsonStringify(exportData);
    } catch(e) { return "{}"; }
}

export async function importFullDatabase(jsonData: string): Promise<void> {
    try {
        const data = JSON.parse(jsonData);
        const db = await openDB();
        if (data.lectures) {
            const tx = db.transaction(TEXT_STORE_NAME, 'readwrite');
            const store = tx.objectStore(TEXT_STORE_NAME);
            for (const item of data.lectures) store.put(item.value, item.key);
        }
        if (data.customChannels) {
            const tx = db.transaction(CHANNELS_STORE_NAME, 'readwrite');
            const store = tx.objectStore(CHANNELS_STORE_NAME);
            for (const item of data.customChannels) store.put(item.value);
        }
    } catch(e) {}
}

export interface DebugEntry { store: string; key: string; size: number; }

export async function getAllDebugEntries(): Promise<DebugEntry[]> {
    try {
        const db = await openDB();
        const entries: DebugEntry[] = [];
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
                            else size = safeJsonStringify(val).length;
                        } catch (e) { size = 0; }
                        entries.push({ store: storeName, key: cursor.key as string, size });
                        cursor.continue();
                    } else resolve();
                };
                request.onerror = () => resolve(); 
            });
        }
        return entries;
    } catch(e) { return []; }
}

export async function deleteDebugEntry(storeName: string, key: string): Promise<void> {
    try {
        const db = await openDB();
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).delete(key);
    } catch(e) {}
}

export async function clearDebugStore(storeName: string): Promise<void> {
    try {
        const db = await openDB();
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).clear();
    } catch(e) {}
}