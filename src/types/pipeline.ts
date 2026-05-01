/**
 * @module pipeline
 * @description Type definitions for the automation pipeline system — discriminated union types for triggers (e.g. notebook-tag-added, min-sources) and actions (e.g. add-tag, generate-audio), the Pipeline record that composes them with a scope and scheduling metadata, and run-log types for auditing execution history.
 * @dependencies none
 * @public TriggerType, PipelineTrigger, ActionType, PipelineAction, PipelineScope, Pipeline, PipelineRunStatus, PipelineActionResult, PipelineRun
 */
// ── Trigger types ──────────────────────────────────────────────────────────────

export type TriggerType =
  | 'notebook-tag-added'
  | 'moved-to-collection'
  | 'title-contains'
  | 'source-added'
  | 'audio-generated'
  | 'min-sources';

export type PipelineTrigger =
  | { type: 'notebook-tag-added'; tag: string }
  | { type: 'moved-to-collection'; collectionId: string }
  | { type: 'title-contains'; substring: string }
  | { type: 'source-added' }
  | { type: 'audio-generated' }
  | { type: 'min-sources'; threshold: number };

// ── Action types ───────────────────────────────────────────────────────────────

export type ActionType =
  | 'move-to-collection'
  | 'add-tag'
  | 'remove-tag'
  | 'generate-audio'
  | 'add-source-url'
  | 'delete-all-sources'
  | 'archive-notebook';

export type PipelineAction =
  | { type: 'move-to-collection'; collectionId: string }
  | { type: 'add-tag'; tag: string }
  | { type: 'remove-tag'; tag: string }
  | { type: 'generate-audio'; format?: number; language?: string; length?: number; focus?: string }
  | { type: 'add-source-url'; url: string }
  | { type: 'delete-all-sources' }
  | { type: 'archive-notebook' };

// ── Scope ──────────────────────────────────────────────────────────────────────

/** Narrows which notebooks a pipeline applies to. */
export type PipelineScope =
  | { kind: 'all' }
  | { kind: 'collection'; collectionId: string }
  | { kind: 'notebook'; notebookId: string };

// ── Pipeline record ────────────────────────────────────────────────────────────

export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: PipelineTrigger;
  /** Actions executed in order; failure of one does not stop the chain. */
  actions: PipelineAction[];
  scope: PipelineScope;
  createdAt: number;
  updatedAt: number;
  /**
   * Tracks last fire timestamp per notebookId. Used to implement one-shot
   * semantics for 'min-sources' and 'audio-generated' triggers so they don't
   * re-fire every poll cycle once satisfied.
   */
  lastFiredAt?: Record<string, number>;
  /** True when installed from a pre-built template. */
  isTemplate?: boolean;
}

// ── Run log ────────────────────────────────────────────────────────────────────

export type PipelineRunStatus = 'success' | 'partial' | 'error';

export interface PipelineActionResult {
  actionType: ActionType;
  ok: boolean;
  error?: string;
}

export interface PipelineRun {
  id: string;
  pipelineId: string;
  pipelineName: string;
  notebookId: string;
  notebookTitle: string;
  triggeredAt: number;
  status: PipelineRunStatus;
  actionResults: PipelineActionResult[];
}
