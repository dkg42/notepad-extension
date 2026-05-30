/**
 * @module data-storage
 * @description Bulk wipe of all user data keys. Used during sign-out and user-switch flows.
 * @public dataStorage
 */
import {
  SNIPPETS_KEY,
  FOLDERS_KEY,
  TAGS_META_KEY,
  EXPORT_HISTORY_KEY,
  PODCAST_EPISODES_KEY,
} from './shared';
import { scopedStorage } from './scoped-storage';

export const dataStorage = {
  /**
   * Removes all user data keys (snippets, folders, tags, export history, podcast episodes)
   * from the current user's namespace. Does not touch settings.
   */
  async clearAllData(): Promise<void> {
    await scopedStorage.remove([
      SNIPPETS_KEY,
      FOLDERS_KEY,
      TAGS_META_KEY,
      EXPORT_HISTORY_KEY,
      PODCAST_EPISODES_KEY,
    ]);
  },

  /**
   * Wipes every key in the given uid's namespace (`u:<uid>:*`). Operates
   * directly on chrome.storage.local — does not depend on the live currentUid
   * inside scopedStorage, so it is safe to call mid-sign-out when the auth
   * profile is about to be (or has just been) removed.
   */
  async clearScopedDataForUid(uid: string): Promise<void> {
    if (!uid) return;
    const prefix = `u:${uid}:`;
    const all = await chrome.storage.local.get(null);
    const keys = Object.keys(all).filter((k) => k.startsWith(prefix));
    if (keys.length === 0) return;
    await chrome.storage.local.remove(keys);
  },
};
