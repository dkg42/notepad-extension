/**
 * drive-write-queue.ts
 *
 * Debounced write queue for Drive AppData files.
 *
 * Prevents hammering the Drive API during rapid edit sequences
 * (e.g., bulk tagging 50 snippets, reordering folders, pipeline runs).
 *
 * Design:
 *   - Each filename gets its own debounce timer.
 *   - Enqueueing the same filename within the debounce window replaces the
 *     pending payload (only the latest state is written — no partial states).
 *   - A semaphore caps concurrent outbound Drive HTTP calls at MAX_CONCURRENT.
 *   - flushAll() drains all pending writes immediately (called from onSuspend).
 *   - cancelAll() discards all pending writes without flushing (called on sign-out).
 *
 * Local-first guarantee:
 *   The caller is responsible for writing to chrome.storage.local BEFORE calling
 *   enqueue(). The Drive write is best-effort: if the service worker is killed
 *   before the debounce fires, data is safe in local storage and will be re-synced
 *   on the next drive-init-service.initialize() call.
 *
 * Debounce defaults by file type:
 *   Structural JSON files (folders, tags, settings, pipelines): 2000 ms
 *   snippets-meta.json:                                          1000 ms
 *   snippet-text-*.txt / chat-content-*.txt:                    500 ms
 *   pipeline-runs.json / export-history.json:                   3000 ms
 *   manifest.json:                                              0 ms (immediate)
 */

import { createFile, updateFile } from './drive-io-service';
import { upsertEntry, getEntry, getManifest, load as loadManifest } from './drive-manifest-service';
import { DRIVE_SCHEMA_VERSION } from './types/drive-schemas';

// ── Configuration ──────────────────────────────────────────────────────────────

const MAX_CONCURRENT = 3;

/** Default debounce durations in milliseconds, keyed by filename pattern. */
const DEBOUNCE_DEFAULTS: Array<{ pattern: RegExp; ms: number }> = [
  { pattern: /^manifest\.json$/, ms: 0 },
  { pattern: /^(pipeline-runs|export-history)\.json$/, ms: 3000 },
  { pattern: /^snippets-meta\.json$/, ms: 1000 },
  { pattern: /^snippet-text-|^chat-content-/, ms: 500 },
  // Default for all other JSON files (folders, tags, settings, pipelines, etc.)
  { pattern: /\.json$/, ms: 2000 },
];

function defaultDebounceMs(filename: string): number {
  for (const { pattern, ms } of DEBOUNCE_DEFAULTS) {
    if (pattern.test(filename)) return ms;
  }
  return 2000;
}

// ── Internal state ─────────────────────────────────────────────────────────────

interface PendingWrite {
  payload: string;
  token: string;
  timer: ReturnType<typeof setTimeout> | null;
  /** Resolvers waiting for this write to complete (from flush() callers). */
  flushResolvers: Array<() => void>;
}

/** Map from filename → pending write state. */
const queue = new Map<string, PendingWrite>();

/** Number of Drive HTTP calls currently in flight. */
let inFlight = 0;
/** Queue of thunks waiting for a semaphore slot. */
const semaphoreWaiters: Array<() => void> = [];

/**
 * When true, enqueue() is a no-op. Set during driveInitService.initialize()
 * to prevent fire-and-forget sync-backs from overwriting Drive with empty
 * local data before applyDriveData() has populated chrome.storage.local.
 */
let _initInProgress = false;

export function setInitializing(active: boolean): void {
  _initInProgress = active;
}

// ── Semaphore ──────────────────────────────────────────────────────────────────

async function acquireSemaphore(): Promise<void> {
  if (inFlight < MAX_CONCURRENT) {
    inFlight++;
    return;
  }
  await new Promise<void>((resolve) => semaphoreWaiters.push(resolve));
  inFlight++;
}

function releaseSemaphore(): void {
  inFlight = Math.max(0, inFlight - 1);
  const next = semaphoreWaiters.shift();
  if (next) next();
}

// ── Core write execution ───────────────────────────────────────────────────────

async function executeWrite(filename: string, payload: string, token: string): Promise<void> {
  await acquireSemaphore();
  try {
    // If the service worker was restarted (MV3 lifecycle), inMemoryManifest will be
    // null. Load from session cache (fast) or Drive (browser restart) before proceeding
    // so getEntry returns the correct existing file ID and upsertEntry can persist.
    if (!getManifest()) {
      await loadManifest(token);
    }

    const mimeType = filename.endsWith('.txt') ? 'text/plain' : 'application/json';
    const existingEntry = getEntry(filename);

    let fileId: string | null = existingEntry?.driveFileId ?? null;
    let version: number | undefined;

    if (fileId) {
      const result = await updateFile(fileId, payload, token);
      if (result.ok) {
        version = result.data.version;
      } else if (result.status === 404) {
        // File was deleted externally — recreate it
        fileId = null;
      } else {
        console.warn(`[DRIVE-QUEUE] updateFile failed for ${filename}:`, result.error);
        return;
      }
    }

    if (!fileId) {
      const result = await createFile(filename, mimeType, payload, token);
      if (!result.ok) {
        console.warn(`[DRIVE-QUEUE] createFile failed for ${filename}:`, result.error);
        return;
      }
      fileId = result.data.id;
      version = result.data.version;
    }

    // Update manifest entry with the new file ID and version
    if (filename !== 'manifest.json') {
      await upsertEntry(filename, {
        driveFileId: fileId,
        filename,
        schemaVersion: DRIVE_SCHEMA_VERSION,
        syncedAt: Date.now(),
        version,
      }, token);
    }
  } finally {
    releaseSemaphore();
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Enqueues a Drive write for the given filename.
 * If a write for this filename is already pending, replaces the payload
 * and resets the debounce timer.
 *
 * @param filename   Drive filename (e.g. 'folders.json', 'snippet-text-{id}.txt')
 * @param payload    String content to write (JSON or plain text)
 * @param token      Valid Google OAuth access token
 * @param debounceMs Override the default debounce duration
 */
export function enqueue(
  filename: string,
  payload: string,
  token: string,
  debounceMs?: number,
): void {
  if (_initInProgress) {
    console.debug(`[DRIVE-QUEUE] Skipping enqueue for ${filename} — init in progress`);
    return;
  }

  const ms = debounceMs ?? defaultDebounceMs(filename);
  const existing = queue.get(filename);

  // Cancel any existing timer for this filename
  if (existing?.timer !== null && existing?.timer !== undefined) {
    clearTimeout(existing!.timer);
  }

  const pending: PendingWrite = {
    payload,
    token,
    timer: null,
    flushResolvers: existing?.flushResolvers ?? [],
  };

  if (ms === 0) {
    // Immediate write — no debounce
    pending.timer = null;
    queue.set(filename, pending);
    void executeWrite(filename, payload, token).finally(() => {
      const current = queue.get(filename);
      if (current === pending) queue.delete(filename);
      pending.flushResolvers.forEach((r) => r());
      pending.flushResolvers.length = 0;
    });
  } else {
    pending.timer = setTimeout(() => {
      queue.delete(filename);
      void executeWrite(filename, payload, token).finally(() => {
        pending.flushResolvers.forEach((r) => r());
        pending.flushResolvers.length = 0;
      });
    }, ms);
    queue.set(filename, pending);
  }
}

/**
 * Immediately executes any pending write for the given filename,
 * bypassing the remaining debounce delay.
 * Returns a promise that resolves when the Drive write completes.
 */
export async function flush(filename: string): Promise<void> {
  const pending = queue.get(filename);
  if (!pending) return;

  if (pending.timer !== null) {
    clearTimeout(pending.timer);
    pending.timer = null;
  }

  queue.delete(filename);

  await new Promise<void>((resolve) => {
    pending.flushResolvers.push(resolve);
    void executeWrite(filename, pending.payload, pending.token).finally(() => {
      pending.flushResolvers.forEach((r) => r());
      pending.flushResolvers.length = 0;
    });
  });
}

/**
 * Immediately executes all pending writes, bypassing remaining debounce delays.
 * Called from chrome.runtime.onSuspend — Chrome gives ~5 seconds before
 * killing the service worker, so this is best-effort.
 */
export async function flushAll(): Promise<void> {
  const filenames = Array.from(queue.keys());
  await Promise.all(filenames.map((f) => flush(f)));
}

/**
 * Cancels all pending writes without executing them.
 * Called on sign-out so stale writes do not fire after the user logs out.
 */
export function cancelAll(): void {
  for (const [, pending] of queue) {
    if (pending.timer !== null && pending.timer !== undefined) {
      clearTimeout(pending.timer);
    }
    // Resolve any flush() waiters so they do not hang
    pending.flushResolvers.forEach((r) => r());
  }
  queue.clear();
}

/**
 * Returns true if there is a pending write for the given filename.
 */
export function hasPending(filename: string): boolean {
  return queue.has(filename);
}

export const driveWriteQueue = {
  enqueue,
  flush,
  flushAll,
  cancelAll,
  hasPending,
  setInitializing,
};
