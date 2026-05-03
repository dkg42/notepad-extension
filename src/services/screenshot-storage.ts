/**
 * @module screenshot-storage
 * @description Persistence layer for screenshot captures and daily usage tracking.
 *   Captures are stored in chrome.storage.local, newest-first, capped at MAX_STORED_CAPTURES.
 *   Usage resets lazily at midnight: the first read after a date change returns a fresh counter.
 * @dependencies @/types
 * @public screenshotStorage, FREE_DAILY_LIMIT, MAX_STORED_CAPTURES
 */
import type { CaptureRecord, ScreenshotStore, ScreenshotUsage } from '@/types';

const STORAGE_KEY = 'screenshotStore';
export const FREE_DAILY_LIMIT = 5;
export const MAX_STORED_CAPTURES = 10;

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function freshUsage(): ScreenshotUsage {
  return { date: todayKey(), count: 0 };
}

export const screenshotStorage = {
  async getStore(): Promise<ScreenshotStore> {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const raw = result[STORAGE_KEY] as ScreenshotStore | undefined;
    if (!raw) return { captures: [], usage: freshUsage() };
    const usage: ScreenshotUsage =
      raw.usage?.date === todayKey() ? raw.usage : freshUsage();
    return { captures: raw.captures ?? [], usage };
  },

  async getUsage(): Promise<ScreenshotUsage> {
    const store = await screenshotStorage.getStore();
    return store.usage;
  },

  async addCapture(capture: CaptureRecord): Promise<void> {
    const store = await screenshotStorage.getStore();
    const today = todayKey();
    const usage: ScreenshotUsage =
      store.usage.date === today
        ? { date: today, count: store.usage.count + 1 }
        : { date: today, count: 1 };
    const captures = [capture, ...store.captures].slice(0, MAX_STORED_CAPTURES);
    await chrome.storage.local.set({ [STORAGE_KEY]: { captures, usage } });
  },

  async deleteCapture(id: string): Promise<void> {
    const store = await screenshotStorage.getStore();
    const captures = store.captures.filter((c) => c.id !== id);
    await chrome.storage.local.set({ [STORAGE_KEY]: { ...store, captures } });
  },

  async clearAll(): Promise<void> {
    await chrome.storage.local.remove(STORAGE_KEY);
  },
};
