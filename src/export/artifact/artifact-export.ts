/**
 * @module artifact-export
 * @description Per-artifact export dispatcher. Audio overviews (typeCode 1) download the media file via the background service worker; every other artifact type opens its notebook in NotebookLM since the extension has no API to fetch their content yet.
 * @public exportArtifact, getArtifactActionMeta
 */

const AUDIO_TYPE_CODE = 1;
const STATUS_COMPLETED = 3;

/** Minimal shape required to export an artifact — satisfied by both ArtifactRecord (+ explicit notebookId) and AggregatedArtifact. */
export interface ExportableArtifact {
  id: string;
  title: string;
  typeCode: number;
  status?: number;
  mediaUrl?: string;
  notebookId: string;
}

const MIME_TO_EXT: Record<string, string> = {
  'audio/mp4': 'mp4',
  'audio/x-m4a': 'mp4',
  'audio/aac': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
};

/**
 * NotebookLM's audio CDN returns either `audio/mp4; codecs="..."` or a generic
 * `application/octet-stream`, so an exact-match lookup misses both. Strip mime
 * parameters first; default to `mp4` (same MP4 container as `.m4a` but with
 * far wider player support) because this code path only runs for Audio Overview
 * artifacts and fetchAudioBlob already rejects non-audio responses.
 */
function pickExtension(mimeType: string): string {
  const essence = mimeType.split(';')[0].trim().toLowerCase();
  return MIME_TO_EXT[essence] ?? 'mp4';
}

/**
 * Server-provided filenames may end in `.m4a`, which is technically correct
 * (audio-only MP4) but inconsistently supported across players and OSes.
 * Rewriting the extension to `.mp4` doesn't touch a byte of the file — both
 * extensions describe the same MP4 container — and makes it open everywhere.
 */
function rewriteUnfriendlyExtension(filename: string): string {
  return filename.replace(/\.m4a$/i, '.mp4');
}

interface DownloadResponse {
  ok: boolean;
  /** Base64-encoded audio bytes (raw ArrayBuffer doesn't survive sendMessage JSON serialization). */
  base64?: string;
  mimeType?: string;
  suggestedFilename?: string;
  error?: string;
}

export interface ArtifactActionMeta {
  /** 'download' for audio overviews, 'open' for everything else. */
  kind: 'download' | 'open';
  label: string;
  /** Set when the action is unavailable; UI should disable the button and show this as a tooltip. */
  disabledReason?: string;
}

export function getArtifactActionMeta(
  typeCode: number,
  status: number | undefined,
  mediaUrl: string | undefined,
): ArtifactActionMeta {
  if (typeCode === AUDIO_TYPE_CODE) {
    if (status !== STATUS_COMPLETED) {
      return { kind: 'download', label: 'Download', disabledReason: 'Audio is still processing' };
    }
    if (!mediaUrl) {
      return { kind: 'download', label: 'Download', disabledReason: 'No audio URL available' };
    }
    return { kind: 'download', label: 'Download' };
  }
  return { kind: 'open', label: 'Open' };
}

export interface ExportArtifactResult {
  ok: boolean;
  error?: string;
}

export async function exportArtifact(artifact: ExportableArtifact): Promise<ExportArtifactResult> {
  const meta = getArtifactActionMeta(artifact.typeCode, artifact.status, artifact.mediaUrl);
  if (meta.disabledReason) {
    return { ok: false, error: meta.disabledReason };
  }

  if (meta.kind === 'download') {
    return downloadAudio(artifact);
  }
  return openInNotebookLM(artifact.notebookId);
}

async function downloadAudio(artifact: ExportableArtifact): Promise<ExportArtifactResult> {
  try {
    const response = (await chrome.runtime.sendMessage({
      type: 'DOWNLOAD_ARTIFACT_AUDIO',
      url: artifact.mediaUrl,
      artifactId: artifact.id,
    })) as DownloadResponse | undefined;

    if (!response?.ok || !response.base64 || !response.mimeType) {
      return { ok: false, error: response?.error ?? 'Download failed' };
    }

    const filename = resolveFilename(response.suggestedFilename, artifact.title, response.mimeType);
    const blob = base64ToBlob(response.base64, response.mimeType);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function openInNotebookLM(notebookId: string): Promise<ExportArtifactResult> {
  try {
    await chrome.tabs.create({ url: `https://notebooklm.google.com/notebook/${notebookId}` });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

function sanitizeFilename(input: string): string {
  return input.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120);
}

function resolveFilename(
  suggested: string | undefined,
  title: string,
  mimeType: string,
): string {
  if (suggested) {
    const clean = sanitizeFilename(suggested);
    if (clean) return rewriteUnfriendlyExtension(clean);
  }
  const base = sanitizeFilename(title) || 'audio';
  return `${base}.${pickExtension(mimeType)}`;
}
