/**
 * @module shared
 * @description Shared utilities for storage domain modules: storage key constants, Drive sync helper, and OAuth token accessor.
 * @dependencies token-lifecycle-service, drive/drive-sync-service
 * @public syncToDrive, getDriveToken, SNIPPETS_KEY, FOLDERS_KEY, SETTINGS_KEY, TAGS_META_KEY, EXPORT_HISTORY_KEY, PODCAST_EPISODES_KEY, RECENT_ACTIONS_KEY, DEFAULT_SETTINGS
 */
import type { DashboardSettings } from '@/types/dashboard';
import { driveSyncService } from '../drive/drive-sync-service';
import { getValidToken } from '../token-lifecycle-service';

export const SNIPPETS_KEY = 'snippets';
export const FOLDERS_KEY = 'folders';
export const SETTINGS_KEY = 'dashboardSettings';
export const TAGS_META_KEY = 'tagsMeta';
export const EXPORT_HISTORY_KEY = 'exportHistory';
export const PODCAST_EPISODES_KEY = 'podcastEpisodes';
export const RECENT_ACTIONS_KEY = 'recentActions';

export const DEFAULT_SETTINGS: DashboardSettings = {
  theme: 'light',
  rowsPerPage: 25,
  defaultSortColumn: 'savedAt',
  defaultSortDirection: 'desc',
};

/**
 * Returns the current OAuth access token if Drive scope is granted.
 * Returns null if the user is not signed in or Drive scope is missing.
 * Used for fire-and-forget Drive sync tail calls — failures are silent.
 */
export async function getDriveToken(): Promise<string | null> {
  const result = await getValidToken();
  if (!result.ok || !result.hasDriveScope) return null;
  return result.accessToken;
}

/**
 * Fire-and-forget Drive sync. Fetches a token and, if available, runs callback.
 * Failures are intentionally silent — Drive sync is best-effort.
 * @param callback Receives the OAuth token and performs one or more driveSyncService calls.
 */
export function syncToDrive(callback: (token: string) => void): void {
  void getDriveToken().then((t) => { if (t) callback(t); });
}

export { driveSyncService };
