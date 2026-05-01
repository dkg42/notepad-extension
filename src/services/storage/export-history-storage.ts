/**
 * @module export-history-storage
 * @description Domain storage module for export history records: append, list, and clear. Prepend-with-cap strategy keeps at most 200 records. Appends fire a best-effort Drive sync tail-call.
 * @dependencies storage/shared, @/types/dashboard, drive/drive-sync-service
 * @public exportHistoryStorage
 */
import type { ExportRecord } from '@/types/dashboard';
import { EXPORT_HISTORY_KEY, syncToDrive, driveSyncService } from './shared';

export const exportHistoryStorage = {
  // ── Export History ─────────────────────────────────────────────────────────

  /**
   * Returns all stored export records, newest first.
   * @returns Array of ExportRecord objects; empty array if none saved.
   */
  async getExportHistory(): Promise<ExportRecord[]> {
    const result = await chrome.storage.local.get(EXPORT_HISTORY_KEY);
    return (result[EXPORT_HISTORY_KEY] as ExportRecord[]) ?? [];
  },

  /**
   * Prepends a new export record (auto-assigning an id) and caps the list at 200 entries, then appends it to Drive.
   * @param record ExportRecord fields excluding `id` (generated internally).
   * @sideEffect Drive sync
   */
  async addExportRecord(record: Omit<ExportRecord, 'id'>): Promise<void> {
    const existing = await exportHistoryStorage.getExportHistory();
    const newRecord: ExportRecord = { id: crypto.randomUUID(), ...record };
    // Keep at most 200 records (most recent first)
    await chrome.storage.local.set({
      [EXPORT_HISTORY_KEY]: [newRecord, ...existing].slice(0, 200),
    });
    syncToDrive((t) => driveSyncService.appendExportRecord(newRecord, t));
  },

  /**
   * Empties the export history list in local storage. No Drive sync is triggered.
   */
  async clearExportHistory(): Promise<void> {
    await chrome.storage.local.set({ [EXPORT_HISTORY_KEY]: [] });
  },
};
