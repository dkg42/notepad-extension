/**
 * @module audio-handler
 * @description Handles audio/artifact chrome.runtime messages for the background service worker.
 * @dependencies notebooklm-api, audio-cache-service, podcast-audio-service, shared
 * @public handleAudioMessage
 */
import {
  createAudioOverview,
  listArtifacts,
  fetchAudioBlob,
  type AudioOverviewOptions,
} from '@/services/notebooklm-api';
import { audioCacheService } from '@/services/audio-cache-service';
import { ensureSignedIn } from './shared';
import { logger } from '@/utils/logger';

/**
 * chrome.runtime.sendMessage serializes its payload as JSON in some Chrome
 * channels, which silently turns ArrayBuffer into `{}`. Encoding to base64
 * up-front means the bytes survive the round-trip intact.
 */
async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function handleAudioMessage(
  message: { type: string } & Record<string, unknown>,
  sendResponse: (response: unknown) => void,
): boolean | undefined {
  // ── Audio / Artifacts ─────────────────────────────────────────────────

  if (message.type === 'CREATE_AUDIO_OVERVIEW') {
    const { notebookId, options } = message as {
      type: string;
      notebookId: string;
      options?: AudioOverviewOptions;
    };
    ensureSignedIn()
      .then(() => createAudioOverview(notebookId, options))
      .then(() => sendResponse({ ok: true }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  if (message.type === 'LIST_ARTIFACTS') {
    const { notebookId } = message as { type: string; notebookId: string };
    ensureSignedIn()
      .then(() => listArtifacts(notebookId))
      .then((artifacts) => sendResponse({ ok: true, artifacts }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  if (message.type === 'FETCH_AUDIO_FOR_PLAYBACK') {
    const { url, artifactId } = message as { type: string; url: string; artifactId: string };
    (async () => {
      await ensureSignedIn();
      // Return early if already cached in IndexedDB
      const cached = await audioCacheService.get(artifactId);
      if (cached) {
        logger.debug('[NLM-EXT BG] FETCH_AUDIO_FOR_PLAYBACK: cache hit for', artifactId);
        return;
      }

      // Fetch directly from the background service worker.
      // host_permissions for the Google CDN domains allows cookies to be sent
      // and CORS to be bypassed — no content script relay needed.
      logger.debug('[NLM-EXT BG] FETCH_AUDIO_FOR_PLAYBACK: fetching', url);
      const { blob, mimeType } = await fetchAudioBlob(url);
      await audioCacheService.put(artifactId, blob, mimeType);
      logger.debug('[NLM-EXT BG] FETCH_AUDIO_FOR_PLAYBACK: cached', artifactId, blob.size, 'bytes');
    })()
      .then(() => sendResponse({ ok: true }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  if (message.type === 'DOWNLOAD_ARTIFACT_AUDIO') {
    const { url } = message as { type: string; url: string; artifactId: string };
    (async () => {
      await ensureSignedIn();
      const { blob, mimeType, suggestedFilename } = await fetchAudioBlob(url);
      const base64 = await blobToBase64(blob);
      return { base64, mimeType, suggestedFilename };
    })()
      .then(({ base64, mimeType, suggestedFilename }) =>
        sendResponse({ ok: true, base64, mimeType, suggestedFilename }),
      )
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  if (message.type === 'CLEAR_AUDIO_CACHE') {
    audioCacheService.clear()
      .then(() => sendResponse({ ok: true }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  return undefined; // not handled
}
