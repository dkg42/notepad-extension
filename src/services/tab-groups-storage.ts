/**
 * @module tab-groups-storage
 * @description Thin wrapper around chrome.storage.local for persisting tab groups.
 * @public tabGroupsStorage
 */
import type { TabGroup } from '@/types/tab-groups';

const STORAGE_KEY = 'tabGroups';

export const tabGroupsStorage = {
  async getGroups(): Promise<TabGroup[]> {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const raw = result[STORAGE_KEY];
    return Array.isArray(raw) ? (raw as TabGroup[]) : [];
  },

  async saveGroups(groups: TabGroup[]): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEY]: groups });
  },
};
