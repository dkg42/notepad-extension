/**
 * @module data-storage
 * @description Domain storage module for bulk data operations: versioned JSON export, validated import, and full wipe of all user data keys. Import and export delegate to domain modules. Clear removes all data keys except settings.
 * @dependencies storage/shared, storage/snippet-storage, storage/folder-storage, storage/tag-storage, storage/settings-storage, storage/export-history-storage
 * @public dataStorage
 */
import type { DashboardSettings } from '@/types/dashboard';
import {
  SNIPPETS_KEY,
  FOLDERS_KEY,
  SETTINGS_KEY,
  TAGS_META_KEY,
  EXPORT_HISTORY_KEY,
  PODCAST_EPISODES_KEY,
  DEFAULT_SETTINGS,
} from './shared';
import { snippetStorage } from './snippet-storage';
import { folderStorage } from './folder-storage';
import { tagStorage } from './tag-storage';
import { settingsStorage } from './settings-storage';
import { exportHistoryStorage } from './export-history-storage';

export const dataStorage = {
  // ── Data Import / Export ──────────────────────────────────────────────────

  /**
   * Reads all persisted data stores and returns a versioned snapshot suitable for JSON export.
   * @returns Plain object with `version`, `exportedAt` ISO timestamp, and all data arrays.
   */
  async exportAllData(): Promise<object> {
    const [snippets, folders, tagsMeta, settings, exportHistory] = await Promise.all([
      snippetStorage.getAll(),
      folderStorage.getFolders(),
      tagStorage.getTagsMeta(),
      settingsStorage.getSettings(),
      exportHistoryStorage.getExportHistory(),
    ]);
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      snippets,
      folders,
      tagsMeta,
      settings,
      exportHistory,
    };
  },

  /**
   * Writes a validated backup payload into local storage, skipping any keys that are absent or the wrong type. Does not trigger Drive sync.
   * @param data Parsed JSON object from an `exportAllData` snapshot; unknown or malformed keys are ignored.
   */
  async importAllData(data: Record<string, unknown>): Promise<void> {
    const updates: Record<string, unknown> = {};
    if (Array.isArray(data.snippets)) updates[SNIPPETS_KEY] = data.snippets;
    if (Array.isArray(data.folders)) updates[FOLDERS_KEY] = data.folders;
    if (Array.isArray(data.tagsMeta)) updates[TAGS_META_KEY] = data.tagsMeta;
    if (data.settings && typeof data.settings === 'object') {
      updates[SETTINGS_KEY] = { ...DEFAULT_SETTINGS, ...(data.settings as Partial<DashboardSettings>) };
    }
    if (Array.isArray(data.exportHistory)) updates[EXPORT_HISTORY_KEY] = data.exportHistory;
    await chrome.storage.local.set(updates);
  },

  /**
   * Removes all user data keys (snippets, folders, tags, export history, podcast episodes) from local storage. Does not touch settings.
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
