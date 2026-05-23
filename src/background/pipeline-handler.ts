/**
 * @module pipeline-handler
 * @description Handles pipeline chrome.runtime messages for the background service worker.
 * @dependencies pipeline-service, pipeline-executor, notebook-sync-service, notebook-annotation-service, auth-storage-service, shared
 * @public handlePipelineMessage, runPipelineCheck, runPipelineAnnotationTriggers
 */
import type { NotebookAnnotation, Pipeline } from '@/types';
import { pipelineService } from '@/services/pipeline-service';
import { evaluateAndRun } from '@/services/pipeline-executor';
import { notebookSyncService } from '@/services/notebook-sync-service';
import { notebookAnnotationService } from '@/services/notebook-annotation-service';
import { notebookFolderService } from '@/services/notebook-folder-service';
import { authStorageService } from '@/services/auth-storage-service';
import { fetchSourceCounts, listArtifacts } from '@/services/notebooklm-api';
import { ensureSignedIn, isProUser } from './shared';
import { usageLimitService } from '@/services/usage-limit-service';

/**
 * Returns true if the pipeline has any trigger that requires periodic polling
 * (source counts, artifact lists) rather than storage-change events.
 */
function needsPolling(pipeline: Pipeline): boolean {
  return ['source-added', 'audio-generated', 'min-sources'].includes(pipeline.trigger.type);
}

/**
 * Periodic pipeline check — evaluates source-added, audio-generated, and
 * min-sources triggers by comparing current API data to stored baselines.
 */
export async function runPipelineCheck(): Promise<void> {
  if (!await authStorageService.getAuthProfile()) return;
  try {
    const pipelines = await pipelineService.getAll();
    const pollable = pipelines.filter((p) => p.enabled && needsPolling(p));
    if (pollable.length === 0) return;

    const [notebooks, annotations, folders, sourceBaseline, artifactBaseline] =
      await Promise.all([
        notebookSyncService.getAll(),
        notebookAnnotationService.getAllAnnotations(),
        notebookFolderService.getFolders(),
        pipelineService.getSourceBaseline(),
        pipelineService.getArtifactBaseline(),
      ]);

    if (notebooks.length === 0) return;

    // Fetch current source counts in batch
    const sourceCounts = await fetchSourceCounts(notebooks.map((n) => n.id));

    // Fetch artifact IDs per notebook (only those needed by pipelines)
    const artifactIds: Record<string, string[]> = {};
    const needsArtifacts = pollable.some((p) => p.trigger.type === 'audio-generated');
    if (needsArtifacts) {
      await Promise.all(
        notebooks.map(async (nb) => {
          try {
            const arts = await listArtifacts(nb.id);
            artifactIds[nb.id] = arts.map((a) => a.id);
          } catch {
            // Skip — partial data is fine for trigger diffing
          }
        }),
      );
    }

    const runs = await evaluateAndRun(pollable, {
      notebooks,
      annotations,
      folders,
      sourceCounts,
      sourceBaseline,
      artifactIds,
      artifactBaseline,
    });

    for (const run of runs) {
      await pipelineService.appendRun(run);
      // Update lastFiredAt for one-shot triggers
      const pipeline = pollable.find((p) => p.id === run.pipelineId);
      if (pipeline && ['min-sources', 'audio-generated'].includes(pipeline.trigger.type)) {
        await pipelineService.updateLastFiredAt(pipeline.id, run.notebookId, run.triggeredAt);
      }
    }

    // Update baselines for next cycle
    await pipelineService.setSourceBaseline(sourceCounts);
    if (needsArtifacts) {
      await pipelineService.setArtifactBaseline(artifactIds);
    }
  } catch (err) {
    console.warn('[NLM-EXT BG] Pipeline check failed:', err);
  }
}

/**
 * Fires annotation-driven triggers (notebook-tag-added, moved-to-collection,
 * title-contains) when storage.sync annotation data changes.
 */
export async function runPipelineAnnotationTriggers(
  newAnnotations: NotebookAnnotation[],
  oldAnnotations: NotebookAnnotation[],
): Promise<void> {
  if (!await authStorageService.getAuthProfile()) return;
  try {
    const pipelines = await pipelineService.getAll();
    const eventDriven = pipelines.filter(
      (p) =>
        p.enabled &&
        ['notebook-tag-added', 'moved-to-folder', 'title-contains'].includes(p.trigger.type),
    );
    if (eventDriven.length === 0) return;

    const [notebooks, folders] = await Promise.all([
      notebookSyncService.getAll(),
      notebookFolderService.getFolders(),
    ]);

    // Find annotations that changed
    const changedPairs: Array<{ current: NotebookAnnotation; previous?: NotebookAnnotation }> = [];
    for (const current of newAnnotations) {
      const previous = oldAnnotations.find((a) => a.notebookId === current.notebookId);
      if (JSON.stringify(current) !== JSON.stringify(previous)) {
        changedPairs.push({ current, previous });
      }
    }
    // Also handle newly added annotations (no previous entry)
    for (const current of newAnnotations) {
      if (!oldAnnotations.find((a) => a.notebookId === current.notebookId)) {
        changedPairs.push({ current, previous: undefined });
      }
    }

    for (const { current, previous } of changedPairs) {
      const runs = await evaluateAndRun(eventDriven, {
        notebooks,
        annotations: newAnnotations,
        folders,
        changedNotebookId: current.notebookId,
        changedAnnotation: current,
        previousAnnotation: previous,
      });

      for (const run of runs) {
        await pipelineService.appendRun(run);
      }
    }

    // Also run title-contains for any notebook if this is the first sync
    const titlePipelines = eventDriven.filter((p) => p.trigger.type === 'title-contains');
    if (titlePipelines.length > 0) {
      const runs = await evaluateAndRun(titlePipelines, {
        notebooks,
        annotations: newAnnotations,
        folders,
      });
      for (const run of runs) {
        await pipelineService.appendRun(run);
      }
    }
  } catch (err) {
    console.warn('[NLM-EXT BG] Pipeline annotation trigger failed:', err);
  }
}

export function handlePipelineMessage(
  message: { type: string } & Record<string, unknown>,
  sendResponse: (response: unknown) => void,
): boolean | undefined {
  // ── Pipelines ─────────────────────────────────────────────────────────

  if (message.type === 'GET_PIPELINES') {
    pipelineService.getAll()
      .then((pipelines) => sendResponse({ ok: true, pipelines }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  if (message.type === 'SAVE_PIPELINE') {
    const { pipeline } = message as { type: string; pipeline: Pipeline };
    (async () => {
      // Free users may hold only one pipeline. Editing an existing pipeline is
      // always allowed; the cap applies only to creating/installing a new one.
      const existing = await pipelineService.getAll();
      const isNew = !existing.some((p) => p.id === pipeline.id);
      if (isNew && !(await usageLimitService.canCreate('pipeline', await isProUser()))) {
        return { ok: false, reason: 'cap_reached' };
      }
      await pipelineService.save(pipeline);
      return { ok: true };
    })()
      .then((result) => sendResponse(result))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  if (message.type === 'DELETE_PIPELINE') {
    const { id } = message as { type: string; id: string };
    pipelineService.remove(id)
      .then(() => sendResponse({ ok: true }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  if (message.type === 'TOGGLE_PIPELINE') {
    const { id } = message as { type: string; id: string };
    pipelineService.toggleEnabled(id)
      .then(() => sendResponse({ ok: true }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  if (message.type === 'GET_PIPELINE_RUNS') {
    const { pipelineId } = message as { type: string; pipelineId?: string };
    pipelineService.getRuns(pipelineId)
      .then((runs) => sendResponse({ ok: true, runs }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  if (message.type === 'CLEAR_PIPELINE_RUNS') {
    pipelineService.clearRuns()
      .then(() => sendResponse({ ok: true }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  if (message.type === 'RUN_PIPELINE_NOW') {
    const { pipeline } = message as { type: string; pipeline: Pipeline };
    (async () => {
      await ensureSignedIn();

      const [notebooks, annotations, folders] = await Promise.all([
        notebookSyncService.getAll(),
        notebookAnnotationService.getAllAnnotations(),
        notebookFolderService.getFolders(),
      ]);
      const runs = await evaluateAndRun([pipeline], {
        notebooks,
        annotations,
        folders,
      });
      for (const run of runs) {
        await pipelineService.appendRun(run);
      }
      return { ok: true, runs };
    })()
      .then((result) => sendResponse(result))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  return undefined; // not handled
}
