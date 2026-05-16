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
  createNotebook,
  addSourceUrl,
  addSourceText,
  addSourcePdf,
  generateArtifact,
  type ArtifactKind,
} from '@/services/notebooklm-api';
import type { NotebookAnnotation, NotebookMeta } from '@/types';
import { notebookSyncService } from '@/services/notebook-sync-service';
import { notebookAnnotationService } from '@/services/notebook-annotation-service';
import { sourceCountCacheService } from '@/services/source-count-cache-service';
import { authStorageService } from '@/services/auth-storage-service';
import { ensureSignedIn } from './shared';
import { prefetchAndCacheAllData } from './source-handler';

type AddSourceKind = 'url' | 'youtube' | 'text' | 'pdf';

/**
 * Orchestrates a merge: creates a new notebook, then copies the URL-based
 * sources of every selected source notebook into it via addSourceUrl. Sources
 * without a recoverable URL (pasted text, PDF, Drive) are counted as skipped
 * and surfaced to the UI so the user knows manual reattachment is needed.
 */
async function mergeNotebooks(
  sourceNotebookIds: string[],
  newTitle: string,
  deleteOriginals: boolean,
): Promise<{ newNotebook: NotebookMeta; copied: number; skipped: number }> {
  const newNotebook = await createNotebook(newTitle);

  let copied = 0;
  let skipped = 0;

  for (const id of sourceNotebookIds) {
    let sources;
    try {
      sources = await fetchNotebookSourcesDetailed(id);
    } catch (err) {
      console.warn('[MERGE] Failed to read sources from', id, err);
      continue;
    }
    for (const src of sources) {
      if (!src.url) {
        skipped += 1;
        continue;
      }
      try {
        await addSourceUrl(newNotebook.id, src.url);
        copied += 1;
      } catch (err) {
        console.warn('[MERGE] Failed to copy source', src.id, err);
        skipped += 1;
      }
    }
  }

  if (deleteOriginals) {
    for (const id of sourceNotebookIds) {
      try {
        await deleteNotebook(id);
        await notebookSyncService.remove(id);
        await notebookAnnotationService.removeAnnotation(id);
      } catch (err) {
        console.warn('[MERGE] Failed to delete original notebook', id, err);
      }
    }
  }

  // Refresh local meta so the new notebook shows up on the dashboard.
  await syncNotebooks();

  return { newNotebook, copied, skipped };
}

/** Dispatches an add-source call to the correct API by kind. */
async function dispatchAddSource(
  notebookId: string,
  kind: AddSourceKind,
  payload: { url?: string; title?: string; content?: string; file?: File },
): Promise<void> {
  switch (kind) {
    case 'url':
    case 'youtube':
      if (!payload.url) throw new Error('add-source: url is required');
      await addSourceUrl(notebookId, payload.url);
      return;
    case 'text':
      if (!payload.content) throw new Error('add-source: content is required');
      await addSourceText(notebookId, payload.title ?? 'Untitled', payload.content);
      return;
    case 'pdf':
      if (!payload.file) throw new Error('add-source: file is required');
      await addSourcePdf(notebookId, payload.file);
      return;
  }
}

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
      // Pre-fetch source counts, all sources, and all artifacts so dashboard pages
      // show data instantly. Both calls are non-blocking and fire in parallel.
      fetchSourceCounts(notebooks.map((n) => n.id))
        .then((counts) => sourceCountCacheService.set(counts))
        .catch(() => {});
      prefetchAndCacheAllData(notebooks).catch(() => {});
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
      .then(async (counts) => {
        await sourceCountCacheService.set(counts);
        sendResponse({ ok: true, counts });
      })
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

  if (message.type === 'CREATE_NOTEBOOK') {
    const { title } = message as { type: string; title: string };
    ensureSignedIn()
      .then(() => createNotebook(title))
      .then(async (notebook) => {
        await notebookSyncService.upsertMany([notebook]);
        // Best-effort full re-sync so caches stay coherent; not awaited by the caller.
        syncNotebooks().catch(() => {});
        sendResponse({ ok: true, notebook });
      })
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  if (message.type === 'ADD_NOTEBOOK_SOURCE') {
    const { notebookId, kind, payload } = message as {
      type: string;
      notebookId: string;
      kind: AddSourceKind;
      payload: { url?: string; title?: string; content?: string; file?: File };
    };
    ensureSignedIn()
      .then(() => dispatchAddSource(notebookId, kind, payload))
      .then(() => sendResponse({ ok: true }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  if (message.type === 'MERGE_NOTEBOOKS') {
    const { sourceNotebookIds, title, deleteOriginals } = message as {
      type: string;
      sourceNotebookIds: string[];
      title: string;
      deleteOriginals?: boolean;
    };
    ensureSignedIn()
      .then(() => mergeNotebooks(sourceNotebookIds, title, deleteOriginals ?? false))
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  if (message.type === 'BULK_DELETE_NOTEBOOKS') {
    const { notebookIds } = message as { type: string; notebookIds: string[] };
    ensureSignedIn()
      .then(async () => {
        const results: { id: string; ok: boolean; error?: string }[] = [];
        for (const id of notebookIds) {
          try {
            await deleteNotebook(id);
            await notebookSyncService.remove(id);
            await notebookAnnotationService.removeAnnotation(id);
            results.push({ id, ok: true });
          } catch (err) {
            results.push({
              id,
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
        return results;
      })
      .then((results) => sendResponse({ ok: true, results }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  if (message.type === 'BULK_MOVE_NOTEBOOKS') {
    const { notebookIds, folderId } = message as {
      type: string;
      notebookIds: string[];
      /** undefined or null clears the folder assignment. */
      folderId?: string | null;
    };
    (async () => {
      try {
        const existing = await notebookAnnotationService.getAllAnnotations();
        const byId = new Map(existing.map((a) => [a.notebookId, a]));
        for (const id of notebookIds) {
          const prev: NotebookAnnotation = byId.get(id) ?? { notebookId: id, tags: [] };
          const next: NotebookAnnotation = {
            ...prev,
            folderId: folderId ?? undefined,
          };
          await notebookAnnotationService.setAnnotation(next);
        }
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    })();
    return true;
  }

  if (message.type === 'GENERATE_NOTEBOOK_ARTIFACT') {
    const { notebookId, kind, options } = message as {
      type: string;
      notebookId: string;
      kind: ArtifactKind;
      options?: Record<string, unknown>;
    };
    ensureSignedIn()
      .then(() => generateArtifact(notebookId, kind, options))
      .then((triggered) => sendResponse({ ok: true, kind: triggered }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  return undefined; // not handled
}
