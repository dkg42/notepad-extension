/**
 * @module source-count-cache-service
 * @description Persists notebook source counts in chrome.storage.local so they survive popup
 * navigations without re-fetching from the NotebookLM API. Uses a 30-minute TTL to match the
 * background notebook sync interval. chrome.storage.local (not sync) is used because source
 * counts are derived/ephemeral data with a 10 MB quota vs sync's 100 KB.
 * @dependencies (none — uses only chrome.storage.local)
 * @public sourceCountCacheService, SourceCountsCache
 */

import { scopedStorage } from './storage/scoped-storage';

const SOURCE_COUNTS_KEY = 'sourceCountsCache';
/** Matches the background notebook sync interval so cache stays coherent with notebook list. */
const TTL_MS = 30 * 60 * 1000;

export interface SourceCountsCache {
  counts: Record<string, number>;
  cachedAt: number;
}

export const sourceCountCacheService = {
  async get(): Promise<{ counts: Record<string, number>; isStale: boolean } | null> {
    const result = await scopedStorage.get<SourceCountsCache>(SOURCE_COUNTS_KEY);
    const cache = result[SOURCE_COUNTS_KEY];
    if (!cache) return null;
    return { counts: cache.counts, isStale: Date.now() - cache.cachedAt > TTL_MS };
  },

  async set(counts: Record<string, number>): Promise<void> {
    const cache: SourceCountsCache = { counts, cachedAt: Date.now() };
    await scopedStorage.set({ [SOURCE_COUNTS_KEY]: cache });
  },

  async clear(): Promise<void> {
    await scopedStorage.remove(SOURCE_COUNTS_KEY);
  },
};
