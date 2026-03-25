const DB_NAME = 'nlm-audio-cache';
const DB_VERSION = 1;
const STORE_NAME = 'audio';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface AudioCacheEntry {
  artifactId: string;
  blob: Blob;
  mimeType: string;
  cachedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'artifactId' });
        store.createIndex('cachedAt', 'cachedAt', { unique: false });
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

export const audioCacheService = {
  async get(artifactId: string): Promise<AudioCacheEntry | null> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(artifactId);
      req.onsuccess = () => {
        const entry = req.result as AudioCacheEntry | undefined;
        if (!entry) {
          resolve(null);
          return;
        }
        // Read-time expiry check — delete and return null if stale
        if (Date.now() - entry.cachedAt > MAX_AGE_MS) {
          store.delete(artifactId);
          resolve(null);
          return;
        }
        resolve(entry);
      };
      req.onerror = () => reject(req.error);
    });
  },

  async put(artifactId: string, blob: Blob, mimeType: string): Promise<void> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const entry: AudioCacheEntry = { artifactId, blob, mimeType, cachedAt: Date.now() };
      const req = tx.objectStore(STORE_NAME).put(entry);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    });
  },

  async remove(artifactId: string): Promise<void> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).delete(artifactId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  /** Deletes all entries older than maxAgeMs (default 24h). Returns count deleted. */
  async cleanup(maxAgeMs: number = MAX_AGE_MS): Promise<number> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const index = tx.objectStore(STORE_NAME).index('cachedAt');
      const upperBound = IDBKeyRange.upperBound(Date.now() - maxAgeMs);
      const req = index.openCursor(upperBound);
      let count = 0;
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          cursor.delete();
          count++;
          cursor.continue();
        } else {
          resolve(count);
        }
      };
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
