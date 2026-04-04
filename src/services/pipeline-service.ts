import type { Pipeline, PipelineRun } from '@/types';

const PIPELINES_KEY = 'pipelines';
const PIPELINE_RUNS_KEY = 'pipelineRuns';
const SOURCE_BASELINE_KEY = 'pipelineSourceBaseline';
const ARTIFACT_BASELINE_KEY = 'pipelineArtifactBaseline';

/** Maximum number of run log entries kept in local storage. */
const MAX_RUNS = 200;

/**
 * Manages pipeline rules, their run log, and polling baselines.
 * All data is persisted in chrome.storage.local (not sync — run logs are
 * device-specific and pipeline configs can exceed sync item size limits).
 */
export const pipelineService = {
  // ── Pipeline CRUD ────────────────────────────────────────────────────────

  async getAll(): Promise<Pipeline[]> {
    const result = await chrome.storage.local.get(PIPELINES_KEY);
    return (result[PIPELINES_KEY] as Pipeline[]) ?? [];
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
    await chrome.storage.local.set({ [PIPELINES_KEY]: existing });
  },

  async remove(id: string): Promise<void> {
    const existing = await this.getAll();
    await chrome.storage.local.set({
      [PIPELINES_KEY]: existing.filter((p) => p.id !== id),
    });
  },

  async toggleEnabled(id: string): Promise<void> {
    const existing = await this.getAll();
    await chrome.storage.local.set({
      [PIPELINES_KEY]: existing.map((p) =>
        p.id === id ? { ...p, enabled: !p.enabled, updatedAt: Date.now() } : p,
      ),
    });
  },

  /**
   * Records the timestamp at which a pipeline last fired for a specific notebook.
   * Used to implement one-shot semantics for min-sources and audio-generated triggers.
   */
  async updateLastFiredAt(id: string, notebookId: string, ts: number): Promise<void> {
    const existing = await this.getAll();
    await chrome.storage.local.set({
      [PIPELINES_KEY]: existing.map((p) => {
        if (p.id !== id) return p;
        return {
          ...p,
          lastFiredAt: { ...(p.lastFiredAt ?? {}), [notebookId]: ts },
        };
      }),
    });
  },

  // ── Run log ──────────────────────────────────────────────────────────────

  async getRuns(pipelineId?: string): Promise<PipelineRun[]> {
    const result = await chrome.storage.local.get(PIPELINE_RUNS_KEY);
    const all = (result[PIPELINE_RUNS_KEY] as PipelineRun[]) ?? [];
    return pipelineId ? all.filter((r) => r.pipelineId === pipelineId) : all;
  },

  /** Prepends a run to the log and trims to MAX_RUNS entries (newest first). */
  async appendRun(run: PipelineRun): Promise<void> {
    const result = await chrome.storage.local.get(PIPELINE_RUNS_KEY);
    const existing = (result[PIPELINE_RUNS_KEY] as PipelineRun[]) ?? [];
    const updated = [run, ...existing].slice(0, MAX_RUNS);
    await chrome.storage.local.set({ [PIPELINE_RUNS_KEY]: updated });
  },

  async clearRuns(): Promise<void> {
    await chrome.storage.local.set({ [PIPELINE_RUNS_KEY]: [] });
  },

  async clearAllData(): Promise<void> {
    await chrome.storage.local.remove([
      PIPELINES_KEY,
      PIPELINE_RUNS_KEY,
      SOURCE_BASELINE_KEY,
      ARTIFACT_BASELINE_KEY,
    ]);
  },

  // ── Source count baseline (for 'source-added' trigger) ───────────────────

  /** Returns a map of notebookId → source count from the last poll. */
  async getSourceBaseline(): Promise<Record<string, number>> {
    const result = await chrome.storage.local.get(SOURCE_BASELINE_KEY);
    return (result[SOURCE_BASELINE_KEY] as Record<string, number>) ?? {};
  },

  async setSourceBaseline(baseline: Record<string, number>): Promise<void> {
    await chrome.storage.local.set({ [SOURCE_BASELINE_KEY]: baseline });
  },

  // ── Artifact baseline (for 'audio-generated' trigger) ────────────────────

  /** Returns a map of notebookId → artifact id array from the last poll. */
  async getArtifactBaseline(): Promise<Record<string, string[]>> {
    const result = await chrome.storage.local.get(ARTIFACT_BASELINE_KEY);
    return (result[ARTIFACT_BASELINE_KEY] as Record<string, string[]>) ?? {};
  },

  async setArtifactBaseline(baseline: Record<string, string[]>): Promise<void> {
    await chrome.storage.local.set({ [ARTIFACT_BASELINE_KEY]: baseline });
  },
};
