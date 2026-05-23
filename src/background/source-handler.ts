/**
 * @module source-handler
 * @description Handles source chrome.runtime messages for the background service worker.
 * @dependencies notebooklm-api, notebook-sync-service, import-job-service, shared
 * @public handleSourceMessage, prefetchAndCacheAllData
 */
import {
  addSourceUrl,
  deleteSource,
  fetchNotebookSourcesDetailed,
  fetchNotebookFullData,
} from '@/services/notebooklm-api';
import type { NotebookMeta, AggregatedSource, AggregatedArtifact } from '@/types';
import { notebookSyncService } from '@/services/notebook-sync-service';
import { allSourcesCacheService } from '@/services/all-sources-cache-service';
import { allArtifactsCacheService } from '@/services/all-artifacts-cache-service';
import { importJobService } from '@/services/import-job-service';
import { ensureSignedIn } from './shared';

const CONCURRENCY = 5;

/**
 * Fetches full data for every notebook in a single parallelised pass (concurrency 5),
 * building the aggregated sources and artifacts arrays simultaneously so the API is
 * called only once per notebook. Writes both caches on completion.
 *
 * Called by syncNotebooks after a successful notebook sync so that AllSourcesPage and
 * AllArtifactsPage can display data instantly without further API calls.
 */
export async function prefetchAndCacheAllData(notebooks: NotebookMeta[]): Promise<void> {
  const allSources: AggregatedSource[] = [];
  const allArtifacts: AggregatedArtifact[] = [];

  for (let i = 0; i < notebooks.length; i += CONCURRENCY) {
    const batch = notebooks.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((nb) => fetchNotebookFullData(nb.id).then((data) => ({ nb, data }))),
    );
    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      const { nb, data } = r.value;
      for (const src of data.sources) {
        allSources.push({ id: src.id, title: src.title, type: src.type, notebookId: nb.id, notebookTitle: nb.title });
      }
      for (const art of data.artifacts) {
        allArtifacts.push({ ...art, notebookId: nb.id, notebookTitle: nb.title });
      }
    }
  }

  await Promise.all([
    allSourcesCacheService.set(allSources),
    allArtifactsCacheService.set(allArtifacts),
  ]);
}

export function handleSourceMessage(
  message: { type: string } & Record<string, unknown>,
  sendResponse: (response: unknown) => void,
): boolean | undefined {
  // ── Sources ───────────────────────────────────────────────────────────

  if (message.type === 'ADD_SOURCE_URL') {
    const { notebookId, url } = message as { type: string; notebookId: string; url: string };
    (async () => {
      await ensureSignedIn();
      await addSourceUrl(notebookId, url);
      return { ok: true };
    })()
      .then((result) => sendResponse(result))
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
      const allSources: AggregatedSource[] = [];

      for (let i = 0; i < notebooks.length; i += CONCURRENCY) {
        const batch = notebooks.slice(i, i + CONCURRENCY);
        const results = await Promise.allSettled(
          batch.map((nb) => fetchNotebookFullData(nb.id).then((data) => ({ nb, data }))),
        );
        for (const r of results) {
          if (r.status !== 'fulfilled') continue;
          const { nb, data } = r.value;
          for (const src of data.sources) {
            allSources.push({ id: src.id, title: src.title, type: src.type, notebookId: nb.id, notebookTitle: nb.title });
          }
        }
      }

      await allSourcesCacheService.set(allSources);
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
      const allArtifacts: AggregatedArtifact[] = [];

      for (let i = 0; i < notebooks.length; i += CONCURRENCY) {
        const batch = notebooks.slice(i, i + CONCURRENCY);
        const results = await Promise.allSettled(
          batch.map((nb) => fetchNotebookFullData(nb.id).then((data) => ({ nb, data }))),
        );
        for (const r of results) {
          if (r.status !== 'fulfilled') continue;
          const { nb, data } = r.value;
          for (const art of data.artifacts) {
            allArtifacts.push({ ...art, notebookId: nb.id, notebookTitle: nb.title });
          }
        }
      }

      await allArtifactsCacheService.set(allArtifacts);
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
