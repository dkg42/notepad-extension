/**
 * @module drive-handler
 * @description Handles Drive chrome.runtime messages for the background service worker.
 * @dependencies drive-init-service, token-lifecycle-service, auth-storage-service
 * @public handleDriveMessage
 */
import { driveInitService } from '@/services/drive/drive-init-service';
import { getValidToken } from '@/services/token-lifecycle-service';
import { authStorageService } from '@/services/auth-storage-service';

export function handleDriveMessage(
  message: { type: string } & Record<string, unknown>,
  sendResponse: (response: unknown) => void,
): boolean | undefined {
  // ── Drive ─────────────────────────────────────────────────────────────

  if (message.type === 'DRIVE_INITIALIZE') {
    (async () => {
      const [tokenResult, profile] = await Promise.all([
        getValidToken(),
        authStorageService.getAuthProfile(),
      ]);
      if (!tokenResult.ok || !tokenResult.hasDriveScope || !profile?.uid) {
        sendResponse({ ok: true, skipped: true });
        return;
      }
      const result = await driveInitService.initialize(tokenResult.accessToken, profile.uid);
      sendResponse({ ok: true, ...result });
    })().catch((err: unknown) =>
      sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
    );
    return true; // keep channel open for async response
  }

  if (message.type === 'DRIVE_RESOLVE_CONFLICT') {
    const { decision } = message as { type: string; decision: 'merge' | 'overwrite' };
    (async () => {
      const [tokenResult, profile] = await Promise.all([
        getValidToken(),
        authStorageService.getAuthProfile(),
      ]);
      if (!tokenResult.ok || !tokenResult.hasDriveScope || !profile?.uid) {
        sendResponse({ ok: false, error: 'not_signed_in' });
        return;
      }
      const result = await driveInitService.initialize(tokenResult.accessToken, profile.uid, decision);
      sendResponse({ ok: true, ...result });
    })().catch((err: unknown) =>
      sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
    );
    return true; // keep channel open for async response
  }

  return undefined; // not handled
}
