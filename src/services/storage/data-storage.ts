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
};
