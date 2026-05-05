/**
 * @module all-artifacts-cache-service
 * @description Persists the aggregated all-artifacts list in chrome.storage.local so the
 * AllArtifactsPage can display data instantly without re-querying the NotebookLM API on every
 * navigation. TTL matches the background notebook sync interval (30 min).
 * @dependencies (none — uses only chrome.storage.local)
 * @public allArtifactsCacheService, AllArtifactsCache
 */
import type { AggregatedArtifact } from '@/types';

const ALL_ARTIFACTS_KEY = 'allArtifactsCache';
const TTL_MS = 30 * 60 * 1000;

export interface AllArtifactsCache {
  artifacts: AggregatedArtifact[];
  cachedAt: number;
}

export const allArtifactsCacheService = {
  async get(): Promise<{ artifacts: AggregatedArtifact[]; isStale: boolean } | null> {
    const result = await chrome.storage.local.get(ALL_ARTIFACTS_KEY);
    const cache = result[ALL_ARTIFACTS_KEY] as AllArtifactsCache | undefined;
    if (!cache) return null;
    return { artifacts: cache.artifacts, isStale: Date.now() - cache.cachedAt > TTL_MS };
  },

  async set(artifacts: AggregatedArtifact[]): Promise<void> {
    const cache: AllArtifactsCache = { artifacts, cachedAt: Date.now() };
    await chrome.storage.local.set({ [ALL_ARTIFACTS_KEY]: cache });
  },

  async clear(): Promise<void> {
    await chrome.storage.local.remove(ALL_ARTIFACTS_KEY);
  },
};
