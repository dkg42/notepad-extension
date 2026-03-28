import type {
  NotebookAnnotation,
  NotebookCollection,
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
  collections: NotebookCollection[];
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

function notebooksInScope(pipeline: Pipeline, ctx: ExecutionContext): NotebookMeta[] {
  const { scope } = pipeline;
  switch (scope.kind) {
    case 'all':
      return ctx.notebooks;
    case 'notebook':
      return ctx.notebooks.filter((n) => n.id === scope.notebookId);
    case 'collection': {
      const inCollection = new Set(
        ctx.annotations
          .filter((a) => a.collectionId === scope.collectionId)
          .map((a) => a.notebookId),
      );
      return ctx.notebooks.filter((n) => inCollection.has(n.id));
    }
  }
}

// ── Trigger evaluation ─────────────────────────────────────────────────────────

/**
 * Returns the subset of notebookIds in `candidates` for which this pipeline's
 * trigger fires given the current ExecutionContext.
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

    case 'moved-to-collection': {
      if (!ctx.changedAnnotation || !ctx.changedNotebookId) return [];
      const inScope = candidates.some((n) => n.id === ctx.changedNotebookId);
      if (!inScope) return [];
      const wasInCollection = ctx.previousAnnotation?.collectionId === trigger.collectionId;
      const isInCollection = ctx.changedAnnotation.collectionId === trigger.collectionId;
      return !wasInCollection && isInCollection ? [ctx.changedNotebookId] : [];
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
 * Executes a single action for a given notebook.
 *
 * Annotation mutations (add-tag, remove-tag, move-to-collection, archive-notebook)
 * call the annotation service directly — these are local storage writes.
 *
 * API-heavy actions (generate-audio, add-source-url, delete-all-sources) dispatch
 * via chrome.runtime.sendMessage to the background worker so that auth token
 * extraction and rate-limiting are handled in one place.
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

      case 'move-to-collection': {
        const ann = getAnnotation(notebookId, ctx);
        await notebookAnnotationService.setAnnotation({
          ...ann,
          collectionId: action.collectionId,
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
 * Evaluates all provided pipelines against the current execution context and
 * runs actions for any triggered notebook + pipeline combinations.
 *
 * Returns a PipelineRun for every (pipeline, notebook) pair that fired.
 * Callers are responsible for persisting runs via pipelineService.appendRun().
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
