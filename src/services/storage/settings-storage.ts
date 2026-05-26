/**
 * @module settings-storage
 * @description Domain storage module for dashboard settings: read with defaults merge and partial-update writes. All writes fire a best-effort Drive sync tail-call.
 * @dependencies storage/shared, @/types/dashboard, drive/drive-sync-service
 * @public settingsStorage
 */
import type { DashboardSettings } from '@/types/dashboard';
import { SETTINGS_KEY, DEFAULT_SETTINGS, syncToDrive, driveSyncService } from './shared';
import { scopedStorage } from './scoped-storage';

export const settingsStorage = {
  // ── Settings ──────────────────────────────────────────────────────────────

  /**
   * Returns the current dashboard settings, merging stored values with defaults for any missing keys.
   * @returns A complete DashboardSettings object; never returns undefined.
   */
  async getSettings(): Promise<DashboardSettings> {
    const result = await scopedStorage.get<Partial<DashboardSettings>>(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...(result[SETTINGS_KEY] ?? {}) };
  },

  /**
   * Merges partial settings over the current stored values and syncs the result to Drive.
   * @param settings Partial DashboardSettings; only the provided keys are updated.
   * @sideEffect Drive sync
   */
  async saveSettings(settings: Partial<DashboardSettings>): Promise<void> {
    const current = await settingsStorage.getSettings();
    const merged = { ...current, ...settings };
    await scopedStorage.set({ [SETTINGS_KEY]: merged });
    syncToDrive((t) => driveSyncService.saveSettings(merged, t));
  },
};
