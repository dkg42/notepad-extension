/**
 * @module screenshot-storage
 * @description Persistence layer for screenshot captures using chrome.storage.local.
 *   Captures are stored newest-first with no enforced cap — users manage storage
 *   by deleting captures from the sidebar.
 * @dependencies @/types
 * @public screenshotStorage
 */
import type { CaptureRecord, ScreenshotStore } from '@/types';

const STORAGE_KEY = 'screenshotStore';

export const screenshotStorage = {
  async getStore(): Promise<ScreenshotStore> {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const raw = result[STORAGE_KEY] as { captures?: CaptureRecord[] } | undefined;
    return { captures: raw?.captures ?? [] };
  },

  async addCapture(capture: CaptureRecord): Promise<void> {
    const store = await screenshotStorage.getStore();
    const captures = [capture, ...store.captures];
    await chrome.storage.local.set({ [STORAGE_KEY]: { captures } });
  },

  async deleteCapture(id: string): Promise<void> {
    const store = await screenshotStorage.getStore();
    const captures = store.captures.filter((c) => c.id !== id);
    await chrome.storage.local.set({ [STORAGE_KEY]: { captures } });
  },

  async clearAll(): Promise<void> {
    await chrome.storage.local.remove(STORAGE_KEY);
  },
};
