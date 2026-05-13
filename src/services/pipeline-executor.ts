/**
 * @module pipeline-executor
 * @description Pure execution engine for the automation pipeline system. Given a set of Pipeline rules and an ExecutionContext snapshot, it evaluates each pipeline's scope and trigger conditions then sequentially executes all matching actions, returning PipelineRun records for every fired (pipeline, notebook) pair. Annotation mutations are applied via the annotation service directly; API-heavy actions (generate-audio, add-source-url, delete-all-sources) are dispatched to the background worker via chrome.runtime.sendMessage so auth and rate-limiting stay centralised.
 * @dependencies notebook-annotation-service
 * @public evaluateAndRun, ExecutionContext
 */
import type {
  Folder,
  NotebookAnnotation,
  NotebookMeta,
  Pipeline,
  PipelineAction,
  PipelineActionResult,
  PipelineRun,
  PipelineRunStatus,
} from '@/types';
import { notebookAnnotationService } from './notebook-annotation-service';

// ── Execution context ──────────────────────────────────────────────────────────

/**
 * Snapshot of state passed to evaluateAndRun for a single execution cycle.
 * Storage-change-driven runs populate the `changed*` fields.
 * Poll-driven runs populate the `sourceCounts` / `artifactIds` fields.
 */
export interface ExecutionContext {
  notebooks: NotebookMeta[];
  annotations: NotebookAnnotation[];
  folders: Folder[];
  /** Source count per notebookId from the most recent API poll. */
  sourceCounts?: Record<string, number>;
  /** Source count per notebookId from the previous poll (baseline). */
  sourceBaseline?: Record<string, number>;
  /** Artifact IDs per notebookId from the most recent API poll. */
  artifactIds?: Record<string, string[]>;
  /** Artifact IDs per notebookId from the previous poll (baseline). */
  artifactBaseline?: Record<string, string[]>;
  /** Set for storage-change-driven cycles (annotation triggers). */
  changedNotebookId?: string;
  changedAnnotation?: NotebookAnnotation;
  previousAnnotation?: NotebookAnnotation;
}

// ── Scope resolution ───────────────────────────────────────────────────────────

/**
 * Returns the subset of notebooks from `ctx.notebooks` that fall within the
 * pipeline's configured scope.
 *
 * @param pipeline - The pipeline whose `scope` field is evaluated.
 * @param ctx - Current execution context containing the full notebook list and annotations.
 * @returns Notebooks matching the scope: all notebooks (`all`), a single notebook by ID
 *   (`notebook`), or all notebooks whose annotation belongs to a given collection (`collection`).
 * @remarks The `collection` scope resolves membership via `ctx.annotations`, so any
 *   annotation changes made earlier in the same cycle are already reflected.
 */
function notebooksInScope(pipeline: Pipeline, ctx: ExecutionContext): NotebookMeta[] {
  const { scope } = pipeline;
  switch (scope.kind) {
    case 'all':
      return ctx.notebooks;
    case 'notebook':
      return ctx.notebooks.filter((n) => n.id === scope.notebookId);
    case 'folder': {
      const inFolder = new Set(
        ctx.annotations
          .filter((a) => a.folderId === scope.folderId)
          .map((a) => a.notebookId),
      );
      return ctx.notebooks.filter((n) => inFolder.has(n.id));
    }
  }
}

// ── Trigger evaluation ─────────────────────────────────────────────────────────

/**
 * Returns the IDs of notebooks within `candidates` for which the pipeline's
 * trigger condition is satisfied in the current execution cycle.
 *
 * @param pipeline - Pipeline containing the `trigger` to evaluate.
 * @param candidates - Notebooks already filtered by `notebooksInScope`.
 * @param ctx - Execution context snapshot; change-driven triggers inspect `changedAnnotation`
 *   / `previousAnnotation`; poll-driven triggers inspect `sourceCounts` / `artifactIds`.
 * @returns Array of notebookIds that should have the pipeline's actions executed.
 *   An empty array means no notebooks fired this cycle.
 * @remarks Trigger types: `notebook-tag-added`, `moved-to-collection` (annotation-change events);
 *   `title-contains` (static match, fires every cycle the title qualifies);
 *   `source-added`, `audio-generated` (poll deltas); `min-sources` (one-shot threshold).
 */
function evaluateTrigger(
  pipeline: Pipeline,
  candidates: NotebookMeta[],
  ctx: ExecutionContext,
): string[] {
  const { trigger } = pipeline;

  switch (trigger.type) {
    case 'notebook-tag-added': {
      // Only fires for the specific notebook whose annotation changed.
      if (!ctx.changedAnnotation || !ctx.changedNotebookId) return [];
      const inScope = candidates.some((n) => n.id === ctx.changedNotebookId);
      if (!inScope) return [];
      const hadTag = (ctx.previousAnnotation?.tags ?? []).includes(trigger.tag);
      const hasTag = ctx.changedAnnotation.tags.includes(trigger.tag);
      return !hadTag && hasTag ? [ctx.changedNotebookId] : [];
    }

    case 'moved-to-folder': {
      if (!ctx.changedAnnotation || !ctx.changedNotebookId) return [];
      const inScope = candidates.some((n) => n.id === ctx.changedNotebookId);
      if (!inScope) return [];
      const wasInFolder = ctx.previousAnnotation?.folderId === trigger.folderId;
      const isInFolder = ctx.changedAnnotation.folderId === trigger.folderId;
      return !wasInFolder && isInFolder ? [ctx.changedNotebookId] : [];
    }

    case 'title-contains': {
      const lower = trigger.substring.toLowerCase();
      return candidates
        .filter((n) => n.title.toLowerCase().includes(lower))
        .map((n) => n.id);
    }

    case 'source-added': {
      if (!ctx.sourceCounts || !ctx.sourceBaseline) return [];
      return candidates
        .filter((n) => (ctx.sourceCounts![n.id] ?? 0) > (ctx.sourceBaseline![n.id] ?? 0))
        .map((n) => n.id);
    }

    case 'audio-generated': {
      if (!ctx.artifactIds || !ctx.artifactBaseline) return [];
      return candidates
        .filter((n) => {
          const current = ctx.artifactIds![n.id] ?? [];
          const previous = new Set(ctx.artifactBaseline![n.id] ?? []);
          return current.some((id) => !previous.has(id));
        })
        .map((n) => n.id);
    }

    case 'min-sources': {
      if (!ctx.sourceCounts) return [];
      return candidates
        .filter((n) => {
          if ((ctx.sourceCounts![n.id] ?? 0) < trigger.threshold) return false;
          // One-shot: skip if already fired for this notebook
          return !pipeline.lastFiredAt?.[n.id];
        })
        .map((n) => n.id);
    }
  }
}

// ── Action execution ───────────────────────────────────────────────────────────

/**
 * Executes a single action against a target notebook and returns a result record.
 *
 * @param action - The action descriptor; its `type` discriminator selects the execution path.
 * @param notebookId - Drive notebook ID to act upon.
 * @param ctx - Execution context providing the current annotation state for mutation actions.
 * @returns `{ actionType, ok: true }` on success or `{ actionType, ok: false, error }` on failure;
 *   never throws — all exceptions are caught and surfaced in the result.
 * @remarks Annotation mutations (`add-tag`, `remove-tag`, `move-to-collection`, `archive-notebook`)
 *   write directly to `notebookAnnotationService` (local storage). API-heavy actions
 *   (`generate-audio`, `add-source-url`, `delete-all-sources`) are dispatched to the background
 *   worker via `chrome.runtime.sendMessage` so auth-token handling stays centralised.
 */
async function executeAction(
  action: PipelineAction,
  notebookId: string,
  ctx: ExecutionContext,
): Promise<PipelineActionResult> {
  const { type } = action;

  try {
    switch (action.type) {
      case 'add-tag': {
        const ann = getAnnotation(notebookId, ctx);
        const tags = ann.tags.includes(action.tag) ? ann.tags : [...ann.tags, action.tag];
        await notebookAnnotationService.setAnnotation({ ...ann, tags });
        break;
      }

      case 'remove-tag': {
        const ann = getAnnotation(notebookId, ctx);
        const tags = ann.tags.filter((t) => t !== action.tag);
        await notebookAnnotationService.setAnnotation({ ...ann, tags });
        break;
      }

      case 'move-to-folder': {
        const ann = getAnnotation(notebookId, ctx);
        await notebookAnnotationService.setAnnotation({
          ...ann,
          folderId: action.folderId,
        });
        break;
      }

      case 'archive-notebook': {
        const ann = getAnnotation(notebookId, ctx);
        await notebookAnnotationService.setAnnotation({ ...ann, archived: true });
        break;
      }

      case 'generate-audio': {
        const { format, language, length, focus } = action;
        await chrome.runtime.sendMessage({
          type: 'CREATE_AUDIO_OVERVIEW',
          notebookId,
          options: { format, language, length, focus },
        });
        break;
      }

      case 'add-source-url': {
        await chrome.runtime.sendMessage({
          type: 'ADD_SOURCE_URL',
          notebookId,
          url: action.url,
        });
        break;
      }

      case 'delete-all-sources': {
        await chrome.runtime.sendMessage({
          type: 'DELETE_ALL_SOURCES',
          notebookId,
        });
        break;
      }
    }

    return { actionType: type, ok: true };
  } catch (err) {
    return {
      actionType: type,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Returns the current annotation for a notebookId, or a fresh empty one. */
function getAnnotation(notebookId: string, ctx: ExecutionContext): NotebookAnnotation {
  return (
    ctx.annotations.find((a) => a.notebookId === notebookId) ?? {
      notebookId,
      tags: [],
    }
  );
}

function deriveRunStatus(results: PipelineActionResult[]): PipelineRunStatus {
  const failed = results.filter((r) => !r.ok).length;
  if (failed === 0) return 'success';
  if (failed === results.length) return 'error';
  return 'partial';
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Main entry point — evaluates all pipelines against the execution context snapshot
 * and runs every matching (pipeline, notebook) combination sequentially.
 *
 * @param pipelines - Full list of persisted pipelines; disabled pipelines are skipped immediately.
 * @param ctx - Immutable snapshot of notebooks, annotations, and change-delta fields for this cycle.
 * @returns One `PipelineRun` record per (pipeline, notebook) pair that fired, including
 *   per-action results and a derived `status` of `'success'`, `'partial'`, or `'error'`.
 *   An empty array is returned when no triggers matched.
 * @remarks The caller is responsible for persisting the returned runs via
 *   `pipelineService.appendRun()` and updating `pipeline.lastFiredAt` for one-shot triggers.
 *   Actions within a single notebook run are executed in declaration order; a failure in one
 *   action does not abort subsequent actions for the same notebook.
 */
export async function evaluateAndRun(
  pipelines: Pipeline[],
  ctx: ExecutionContext,
): Promise<PipelineRun[]> {
  const runs: PipelineRun[] = [];

  for (const pipeline of pipelines) {
    if (!pipeline.enabled) continue;

    const candidates = notebooksInScope(pipeline, ctx);
    const triggeredIds = evaluateTrigger(pipeline, candidates, ctx);

    for (const notebookId of triggeredIds) {
      const notebook = ctx.notebooks.find((n) => n.id === notebookId);
      const actionResults: PipelineActionResult[] = [];

      for (const action of pipeline.actions) {
        const result = await executeAction(action, notebookId, ctx);
        actionResults.push(result);
      }

      const run: PipelineRun = {
        id: crypto.randomUUID(),
        pipelineId: pipeline.id,
        pipelineName: pipeline.name,
        notebookId,
        notebookTitle: notebook?.title ?? notebookId,
        triggeredAt: Date.now(),
        status: deriveRunStatus(actionResults),
        actionResults,
      };

      runs.push(run);
    }
  }

  return runs;
}
