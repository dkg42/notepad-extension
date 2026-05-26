/**
 * @module tab-groups-storage
 * @description Thin wrapper around chrome.storage.local for persisting tab groups.
 * @public tabGroupsStorage
 */
import type { TabGroup } from '@/types/tab-groups';
import { scopedStorage } from './storage/scoped-storage';

const STORAGE_KEY = 'tabGroups';

export const tabGroupsStorage = {
  async getGroups(): Promise<TabGroup[]> {
    const result = await scopedStorage.get<TabGroup[]>(STORAGE_KEY);
    const raw = result[STORAGE_KEY];
    return Array.isArray(raw) ? raw : [];
  },

  async saveGroups(groups: TabGroup[]): Promise<void> {
    await scopedStorage.set({ [STORAGE_KEY]: groups });
  },
};
