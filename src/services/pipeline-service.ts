/**
 * @module pipeline-service
 * @description CRUD and run-log persistence for automation pipeline rules. Manages pipeline definitions, their execution run history (capped at 200 entries), and the polling baselines used by source-added and audio-generated triggers. All data lives in chrome.storage.local (not sync) because run logs are device-specific and pipeline configs can exceed sync item size limits. Each write also fires a best-effort Drive sync if the user has Drive scope.
 * @dependencies token-lifecycle-service, drive/drive-sync-service
 * @public pipelineService
 */
import type { Pipeline, PipelineRun } from '@/types';
import { driveSyncService } from './drive/drive-sync-service';
import { getValidToken } from './token-lifecycle-service';
import { scopedStorage } from './storage/scoped-storage';

const PIPELINES_KEY = 'pipelines';
const PIPELINE_RUNS_KEY = 'pipelineRuns';
const SOURCE_BASELINE_KEY = 'pipelineSourceBaseline';
const ARTIFACT_BASELINE_KEY = 'pipelineArtifactBaseline';

/** Maximum number of run log entries kept in local storage. */
const MAX_RUNS = 200;

async function getDriveToken(): Promise<string | null> {
  const result = await getValidToken();
  if (!result.ok || !result.hasDriveScope) return null;
  return result.accessToken;
}

function syncToDrive(callback: (token: string) => void): void {
  void getDriveToken().then((t) => { if (t) callback(t); });
}

/**
 * Manages pipeline rules, their run log, and polling baselines.
 * All data is persisted in chrome.storage.local (not sync — run logs are
 * device-specific and pipeline configs can exceed sync item size limits).
 */
export const pipelineService = {
  // ── Pipeline CRUD ────────────────────────────────────────────────────────

  async getAll(): Promise<Pipeline[]> {
    const result = await scopedStorage.get<Pipeline[]>(PIPELINES_KEY);
    return result[PIPELINES_KEY] ?? [];
  },

  /** Upserts a pipeline by id. */
  async save(pipeline: Pipeline): Promise<void> {
    const existing = await this.getAll();
    const index = existing.findIndex((p) => p.id === pipeline.id);
    if (index >= 0) {
      existing[index] = pipeline;
    } else {
      existing.push(pipeline);
    }
    await scopedStorage.set({ [PIPELINES_KEY]:existing });
    syncToDrive((t) => driveSyncService.savePipelines(existing, t));
  },

  async remove(id: string): Promise<void> {
    const existing = await this.getAll();
    const updated = existing.filter((p) => p.id !== id);
    await scopedStorage.set({ [PIPELINES_KEY]:updated });
    syncToDrive((t) => driveSyncService.savePipelines(updated, t));
  },

  async toggleEnabled(id: string): Promise<void> {
    const existing = await this.getAll();
    const updated = existing.map((p) =>
      p.id === id ? { ...p, enabled: !p.enabled, updatedAt: Date.now() } : p,
    );
    await scopedStorage.set({ [PIPELINES_KEY]:updated });
    syncToDrive((t) => driveSyncService.savePipelines(updated, t));
  },

  /**
   * Records the timestamp at which a pipeline last fired for a specific notebook.
   * Used to implement one-shot semantics for min-sources and audio-generated triggers.
   */
  async updateLastFiredAt(id: string, notebookId: string, ts: number): Promise<void> {
    const existing = await this.getAll();
    const updated = existing.map((p) => {
      if (p.id !== id) return p;
      return {
        ...p,
        lastFiredAt: { ...(p.lastFiredAt ?? {}), [notebookId]: ts },
      };
    });
    await scopedStorage.set({ [PIPELINES_KEY]:updated });
    syncToDrive((t) => driveSyncService.savePipelines(updated, t));
  },

  // ── Run log ──────────────────────────────────────────────────────────────

  async getRuns(pipelineId?: string): Promise<PipelineRun[]> {
    const result = await scopedStorage.get<PipelineRun[]>(PIPELINE_RUNS_KEY);
    const all = result[PIPELINE_RUNS_KEY] ?? [];
    return pipelineId ? all.filter((r) => r.pipelineId === pipelineId) : all;
  },

  /** Prepends a run to the log and trims to MAX_RUNS entries (newest first). */
  async appendRun(run: PipelineRun): Promise<void> {
    const result = await scopedStorage.get<PipelineRun[]>(PIPELINE_RUNS_KEY);
    const existing = result[PIPELINE_RUNS_KEY] ?? [];
    const updated = [run, ...existing].slice(0, MAX_RUNS);
    await scopedStorage.set({ [PIPELINE_RUNS_KEY]: updated });
    syncToDrive((t) => driveSyncService.appendPipelineRun(run, t));
  },

  async clearRuns(): Promise<void> {
    await scopedStorage.set({ [PIPELINE_RUNS_KEY]: [] });
  },

  async clearAllData(): Promise<void> {
    await scopedStorage.remove([
      PIPELINES_KEY,
      PIPELINE_RUNS_KEY,
      SOURCE_BASELINE_KEY,
      ARTIFACT_BASELINE_KEY,
    ]);
  },

  // ── Source count baseline (for 'source-added' trigger) ───────────────────

  /** Returns a map of notebookId → source count from the last poll. */
  async getSourceBaseline(): Promise<Record<string, number>> {
    const result = await scopedStorage.get<Record<string, number>>(SOURCE_BASELINE_KEY);
    return result[SOURCE_BASELINE_KEY] ?? {};
  },

  async setSourceBaseline(baseline: Record<string, number>): Promise<void> {
    await scopedStorage.set({ [SOURCE_BASELINE_KEY]: baseline });
  },

  // ── Artifact baseline (for 'audio-generated' trigger) ────────────────────

  /** Returns a map of notebookId → artifact id array from the last poll. */
  async getArtifactBaseline(): Promise<Record<string, string[]>> {
    const result = await scopedStorage.get<Record<string, string[]>>(ARTIFACT_BASELINE_KEY);
    return result[ARTIFACT_BASELINE_KEY] ?? {};
  },

  async setArtifactBaseline(baseline: Record<string, string[]>): Promise<void> {
    await scopedStorage.set({ [ARTIFACT_BASELINE_KEY]: baseline });
  },
};
