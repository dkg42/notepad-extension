/**
 * @module podcast-audio-drive-service
 * @description Syncs user-uploaded custom podcast audio to a user-visible Drive
 * folder (not AppData) so the user can see/manage uploads directly in their
 * Drive. The blob lives in the visible folder; a customAudioId → driveFileId map
 * is kept in AppData (`custom-audio-index.json`). Upload/delete are fired as
 * best-effort tail-calls from the podcast UI; on a device missing the blob,
 * `ensureLocal` downloads it back into IndexedDB on play. Wired at the podcast
 * call sites (not inside podcast-audio-service) to keep that module dependency-
 * free and avoid an import cycle.
 * @dependencies podcast-audio-service, drive-io-service, drive-sync-service, token-lifecycle-service, auth-storage-service
 * @public podcastAudioDriveService
 */
import type { CustomAudioEntry } from '@/types';
import { podcastAudioService } from '@/services/podcast-audio-service';
import { getValidToken } from '@/services/token-lifecycle-service';
import { authStorageService } from '@/services/auth-storage-service';
import {
  getPodcastAudioFolderId,
  createBinaryFile,
  readBinaryFile,
  deleteFile,
} from './drive-io-service';
import { getCustomAudioIndex, saveCustomAudioIndex } from './drive-sync-service';

/** Drive sync is a Pro-tier feature (mirrors drive-sync-service's gate). */
async function isDriveSyncEnabled(): Promise<boolean> {
  const claims = await authStorageService.getAuthClaims();
  return (
    claims?.subscriptionStatus === 'active' &&
    (claims.subscriptionPlan === 'pro_monthly' || claims.subscriptionPlan === 'pro_yearly')
  );
}

/** Returns an OAuth token only if Drive scope is granted, else null. */
async function getDriveToken(): Promise<string | null> {
  const result = await getValidToken();
  if (!result.ok || !result.hasDriveScope) return null;
  return result.accessToken;
}

export const podcastAudioDriveService = {
  /**
   * Uploads a custom-audio blob to the visible Drive folder and records the
   * customAudioId → driveFileId mapping. Best-effort: silently no-ops for
   * free-tier users or when Drive scope/token is unavailable.
   */
  async uploadCustomAudio(entry: CustomAudioEntry): Promise<void> {
    if (!(await isDriveSyncEnabled())) return;
    const token = await getDriveToken();
    if (!token) return;

    const folderId = await getPodcastAudioFolderId(token);
    if (!folderId) return;

    const res = await createBinaryFile(entry.filename, entry.mimeType, entry.blob, folderId, token);
    if (!res.ok) {
      console.warn('[PODCAST-AUDIO-DRIVE] upload failed:', res.error);
      return;
    }

    const index = await getCustomAudioIndex(token);
    const next = [
      ...index.filter((e) => e.customAudioId !== entry.id),
      { customAudioId: entry.id, driveFileId: res.data.id, filename: entry.filename, mimeType: entry.mimeType },
    ];
    saveCustomAudioIndex(next, token);
  },

  /**
   * Returns the local IndexedDB entry, downloading it from Drive first if this
   * device doesn't have the blob yet (e.g. uploaded on another device).
   */
  async ensureLocal(customAudioId: string): Promise<CustomAudioEntry | null> {
    const local = await podcastAudioService.get(customAudioId);
    if (local) return local;

    const token = await getDriveToken();
    if (!token) return null;

    const index = await getCustomAudioIndex(token);
    const mapping = index.find((e) => e.customAudioId === customAudioId);
    if (!mapping) return null;

    const res = await readBinaryFile(mapping.driveFileId, token);
    if (!res.ok) {
      console.warn('[PODCAST-AUDIO-DRIVE] download failed:', res.error);
      return null;
    }

    await podcastAudioService.put(customAudioId, mapping.filename, res.data, mapping.mimeType);
    return podcastAudioService.get(customAudioId);
  },

  /**
   * Deletes the Drive file and its index entry for a custom-audio id.
   * Best-effort; safe to call even when the id was never synced.
   */
  async deleteCustomAudio(customAudioId: string): Promise<void> {
    const token = await getDriveToken();
    if (!token) return;

    const index = await getCustomAudioIndex(token);
    const mapping = index.find((e) => e.customAudioId === customAudioId);
    if (!mapping) return;

    await deleteFile(mapping.driveFileId, token);
    saveCustomAudioIndex(index.filter((e) => e.customAudioId !== customAudioId), token);
  },
};
