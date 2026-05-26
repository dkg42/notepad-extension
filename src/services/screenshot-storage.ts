/**
 * @module screenshot-storage
 * @description Persistence layer for screenshot captures using chrome.storage.local.
 *   Captures are stored newest-first with no enforced cap — users manage storage
 *   by deleting captures from the sidebar.
 * @dependencies @/types
 * @public screenshotStorage
 */
import type { CaptureRecord, ScreenshotStore } from '@/types';
import { scopedStorage } from './storage/scoped-storage';

const STORAGE_KEY = 'screenshotStore';

export const screenshotStorage = {
  async getStore(): Promise<ScreenshotStore> {
    const result = await scopedStorage.get<{ captures?: CaptureRecord[] }>(STORAGE_KEY);
    const raw = result[STORAGE_KEY];
    return { captures: raw?.captures ?? [] };
  },

  async addCapture(capture: CaptureRecord): Promise<void> {
    const store = await screenshotStorage.getStore();
    const captures = [capture, ...store.captures];
    await scopedStorage.set({ [STORAGE_KEY]: { captures } });
  },

  async deleteCapture(id: string): Promise<void> {
    const store = await screenshotStorage.getStore();
    const captures = store.captures.filter((c) => c.id !== id);
    await scopedStorage.set({ [STORAGE_KEY]: { captures } });
  },

  async clearAll(): Promise<void> {
    await scopedStorage.remove(STORAGE_KEY);
  },
};
