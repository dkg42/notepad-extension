/**
 * @module notebook-handler
 * @description Handles notebook chrome.runtime messages for the background service worker.
 * @dependencies notebooklm-api, notebook-sync-service, auth-storage-service, shared
 * @public handleNotebookMessage, syncNotebooks
 */
import {
  fetchNotebooks,
  deleteNotebook,
  fetchNotebookSources,
  fetchSourceCounts,
  fetchNotebookSourcesDetailed,
  fetchNotebookFullData,
  summarizeNotebook,
  fetchNotebookNotes,
} from '@/services/notebooklm-api';
import { notebookSyncService } from '@/services/notebook-sync-service';
import { authStorageService } from '@/services/auth-storage-service';
import { ensureSignedIn } from './shared';

/**
 * Fetches the current user's notebooks from NotebookLM and persists them via
 * `notebookSyncService`, clearing stale data first when the stored owner UID
 * does not match the signed-in user.
 */
export async function syncNotebooks(): Promise<void> {
  const profile = await authStorageService.getAuthProfile();
  if (!profile) return;
  const uid: string | null = profile.uid;
  // Clear stale data before syncing if the stored data belongs to a different
  // user or was written before ownerUid tracking was introduced.
  if (uid) {
    const syncMeta = await notebookSyncService.getSyncMeta();
    if (syncMeta && (!syncMeta.ownerUid || syncMeta.ownerUid !== uid)) {
      console.warn('[SYNC] Stale or untagged notebook data — clearing before re-sync', { stored: syncMeta.ownerUid, current: uid });
      await notebookSyncService.clear();
    }
  }
  try {
    const notebooks = await fetchNotebooks();
    if (notebooks.length > 0) {
      await notebookSyncService.upsertMany(notebooks);
    }
    await notebookSyncService.setSyncMeta({ lastSyncedAt: Date.now(), ownerUid: uid ?? undefined });
  } catch (error) {
    await notebookSyncService.setSyncMeta({
      lastSyncedAt: Date.now(),
      ownerUid: uid ?? undefined,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function handleNotebookMessage(
  message: { type: string } & Record<string, unknown>,
  sendResponse: (response: unknown) => void,
): boolean | undefined {
  // ── Notebooks ─────────────────────────────────────────────────────────

  if (message.type === 'SYNC_NOTEBOOKS') {
    ensureSignedIn()
      .then(() => syncNotebooks())
      .then(() => sendResponse({ ok: true }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true; // keep channel open for async
  }

  if (message.type === 'FETCH_SOURCE_COUNTS') {
    const { notebookIds } = message as { type: string; notebookIds: string[] };
    ensureSignedIn()
      .then(() => fetchSourceCounts(notebookIds))
      .then((counts) => sendResponse({ ok: true, counts }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  if (message.type === 'FETCH_NOTEBOOK_SOURCES') {
    const { notebookId } = message as { type: string; notebookId: string };
    ensureSignedIn()
      .then(() => fetchNotebookSources(notebookId))
      .then((sources) => sendResponse({ ok: true, sources, count: sources.length }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  if (message.type === 'DELETE_NOTEBOOK') {
    const { notebookId } = message as { type: string; notebookId: string };
    ensureSignedIn()
      .then(() => deleteNotebook(notebookId))
      .then(() => notebookSyncService.remove(notebookId))
      .then(() => sendResponse({ ok: true }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true; // keep channel open for async
  }

  if (message.type === 'FETCH_NOTEBOOK_SOURCES_DETAILED') {
    const { notebookId } = message as { type: string; notebookId: string };
    ensureSignedIn()
      .then(() => fetchNotebookSourcesDetailed(notebookId))
      .then((sources) => sendResponse({ ok: true, sources }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  if (message.type === 'FETCH_NOTEBOOK_FULL_DATA') {
    const { notebookId } = message as { type: string; notebookId: string };
    ensureSignedIn()
      .then(() => fetchNotebookFullData(notebookId))
      .then((data) => sendResponse({ ok: true, ...data }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  if (message.type === 'SUMMARIZE_NOTEBOOK') {
    const { notebookId } = message as { type: string; notebookId: string };
    ensureSignedIn()
      .then(() => summarizeNotebook(notebookId))
      .then((summary) => sendResponse({ ok: true, summary }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  if (message.type === 'FETCH_NOTEBOOK_NOTES') {
    const { notebookId } = message as { type: string; notebookId: string };
    ensureSignedIn()
      .then(() => fetchNotebookNotes(notebookId))
      .then((notes) => sendResponse({ ok: true, notes }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  return undefined; // not handled
}
