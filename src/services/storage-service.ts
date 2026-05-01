/**
 * @module storage-service
 * @description Barrel re-export that assembles the legacy storageService object from domain modules.
 *   Import from domain modules directly (snippet-storage, folder-storage, etc.) for new code.
 *   Existing code importing storageService continues to work without changes.
 * @dependencies storage/snippet-storage, storage/folder-storage, storage/tag-storage, storage/settings-storage, storage/export-history-storage, storage/podcast-storage, storage/data-storage
 * @public storageService, snippetStorage, folderStorage, tagStorage, settingsStorage, exportHistoryStorage, podcastStorage, dataStorage
 */
export { snippetStorage } from './storage/snippet-storage';
export { folderStorage } from './storage/folder-storage';
export { tagStorage } from './storage/tag-storage';
export { settingsStorage } from './storage/settings-storage';
export { exportHistoryStorage } from './storage/export-history-storage';
export { podcastStorage } from './storage/podcast-storage';
export { dataStorage } from './storage/data-storage';

import { snippetStorage } from './storage/snippet-storage';
import { folderStorage } from './storage/folder-storage';
import { tagStorage } from './storage/tag-storage';
import { settingsStorage } from './storage/settings-storage';
import { exportHistoryStorage } from './storage/export-history-storage';
import { podcastStorage } from './storage/podcast-storage';
import { dataStorage } from './storage/data-storage';

export const storageService = {
  ...snippetStorage,
  ...folderStorage,
  ...tagStorage,
  ...settingsStorage,
  ...exportHistoryStorage,
  ...podcastStorage,
  ...dataStorage,
};
