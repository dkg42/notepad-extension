/**
 * @module source-handler
 * @description Handles source chrome.runtime messages for the background service worker.
 * @dependencies notebooklm-api, notebook-sync-service, import-job-service, shared
 * @public handleSourceMessage
 */
import {
  addSourceUrl,
  deleteSource,
  fetchNotebookSourcesDetailed,
  fetchNotebookFullData,
} from '@/services/notebooklm-api';
import { notebookSyncService } from '@/services/notebook-sync-service';
import { importJobService } from '@/services/import-job-service';
import { ensureSignedIn } from './shared';

export function handleSourceMessage(
  message: { type: string } & Record<string, unknown>,
  sendResponse: (response: unknown) => void,
): boolean | undefined {
  // ── Sources ───────────────────────────────────────────────────────────

  if (message.type === 'ADD_SOURCE_URL') {
    const { notebookId, url } = message as { type: string; notebookId: string; url: string };
    ensureSignedIn()
      .then(() => addSourceUrl(notebookId, url))
      .then(() => sendResponse({ ok: true }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  if (message.type === 'DELETE_SOURCE') {
    const { sourceId } = message as { type: string; sourceId: string };
    ensureSignedIn()
      .then(() => deleteSource(sourceId))
      .then(() => sendResponse({ ok: true }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  // ── Sources (aggregated fetch + bulk import) ───────────────────────────

  if (message.type === 'FETCH_ALL_SOURCES') {
    (async () => {
      await ensureSignedIn();
      const notebooks = await notebookSyncService.getAll();
      const allSources: Array<{
        id: string; title: string; type: string; sourceUrl?: string;
        notebookId: string; notebookTitle: string;
      }> = [];

      for (const nb of notebooks) {
        try {
          const data = await fetchNotebookFullData(nb.id);
          for (const src of data.sources) {
            allSources.push({
              id: src.id,
              title: src.title,
              type: src.type,
              notebookId: nb.id,
              notebookTitle: nb.title,
            });
          }
        } catch {
          // Skip notebooks that fail — partial results are fine
        }
      }

      return allSources;
    })()
      .then((sources) => sendResponse({ ok: true, sources }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  if (message.type === 'FETCH_ALL_ARTIFACTS') {
    (async () => {
      await ensureSignedIn();
      const notebooks = await notebookSyncService.getAll();
      const allArtifacts: Array<{
        id: string; title: string; typeCode: number; mediaUrl?: string;
        createdAt?: number; status?: number;
        notebookId: string; notebookTitle: string;
      }> = [];

      for (const nb of notebooks) {
        try {
          const data = await fetchNotebookFullData(nb.id);
          for (const art of data.artifacts) {
            allArtifacts.push({
              ...art,
              notebookId: nb.id,
              notebookTitle: nb.title,
            });
          }
        } catch {
          // Skip notebooks that fail
        }
      }

      return allArtifacts;
    })()
      .then((artifacts) => sendResponse({ ok: true, artifacts }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  if (message.type === 'BULK_ADD_SOURCES') {
    const { notebookId, urls } = message as { type: string; notebookId: string; urls: string[] };
    ensureSignedIn()
      .then(() => {
        const jobId = importJobService.createAndStart(notebookId, urls);
        sendResponse({ ok: true, jobId });
      })
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  // ── Sources (bulk delete, rate-limited, used by pipeline executor) ──────

  if (message.type === 'DELETE_ALL_SOURCES') {
    const { notebookId } = message as { type: string; notebookId: string };
    (async () => {
      await ensureSignedIn();
      const sources = await fetchNotebookSourcesDetailed(notebookId);
      for (const src of sources) {
        await deleteSource(src.id);
        // Match the rate-limiting pattern from import-job-service
        await new Promise((r) => setTimeout(r, 500));
      }
    })()
      .then(() => sendResponse({ ok: true }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  return undefined; // not handled
}
