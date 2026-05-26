/**
 * @module all-sources-cache-service
 * @description Persists the aggregated all-sources list in chrome.storage.local so the
 * AllSourcesPage can display data instantly without re-querying the NotebookLM API on every
 * navigation. TTL matches the background notebook sync interval (30 min).
 * @dependencies (none — uses only chrome.storage.local)
 * @public allSourcesCacheService, AllSourcesCache
 */
import type { AggregatedSource } from '@/types';
import { scopedStorage } from './storage/scoped-storage';

const ALL_SOURCES_KEY = 'allSourcesCache';
const TTL_MS = 30 * 60 * 1000;

export interface AllSourcesCache {
  sources: AggregatedSource[];
  cachedAt: number;
}

export const allSourcesCacheService = {
  async get(): Promise<{ sources: AggregatedSource[]; isStale: boolean } | null> {
    const result = await scopedStorage.get<AllSourcesCache>(ALL_SOURCES_KEY);
    const cache = result[ALL_SOURCES_KEY];
    if (!cache) return null;
    return { sources: cache.sources, isStale: Date.now() - cache.cachedAt > TTL_MS };
  },

  async set(sources: AggregatedSource[]): Promise<void> {
    const cache: AllSourcesCache = { sources, cachedAt: Date.now() };
    await scopedStorage.set({ [ALL_SOURCES_KEY]: cache });
  },

  async clear(): Promise<void> {
    await scopedStorage.remove(ALL_SOURCES_KEY);
  },
};
