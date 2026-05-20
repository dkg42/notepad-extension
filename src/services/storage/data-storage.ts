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

export const dataStorage = {
  /**
   * Removes all user data keys (snippets, folders, tags, export history, podcast episodes)
   * from local storage. Does not touch settings.
   */
  async clearAllData(): Promise<void> {
    await chrome.storage.local.remove([
      SNIPPETS_KEY,
      FOLDERS_KEY,
      TAGS_META_KEY,
      EXPORT_HISTORY_KEY,
      PODCAST_EPISODES_KEY,
    ]);
  },
};
