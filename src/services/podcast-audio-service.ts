/**
 * @module podcast-audio-service
 * @description IndexedDB-backed store for user-uploaded custom audio entries in the podcast feature. Provides get/put/remove/clear operations against the 'podcast-audio-store' database, storing audio Blobs alongside metadata (filename, mimeType, addedAt) under a stable ID key. Kept separate from audioCacheService because custom uploads are user-owned and should not be subject to the 24-hour TTL eviction applied to cached NotebookLM artifacts.
 * @dependencies (none — pure IndexedDB, no internal src/ imports)
 * @public podcastAudioService
 */
import type { CustomAudioEntry } from '@/types';

const DB_NAME = 'podcast-audio-store';
const DB_VERSION = 1;
const STORE_NAME = 'custom-audio';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

export const podcastAudioService = {
  async get(id: string): Promise<CustomAudioEntry | null> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = () => resolve((req.result as CustomAudioEntry) ?? null);
      req.onerror = () => reject(req.error);
    });
  },

  async put(id: string, filename: string, blob: Blob, mimeType: string): Promise<void> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const entry: CustomAudioEntry = { id, filename, mimeType, blob, addedAt: Date.now() };
      const req = tx.objectStore(STORE_NAME).put(entry);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    });
  },

  async remove(id: string): Promise<void> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async clear(): Promise<void> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },
};
