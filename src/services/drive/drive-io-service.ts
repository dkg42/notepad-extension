/**
 * drive-io-service.ts
 *
 * Raw Google Drive REST API primitives.
 * This is the ONLY file in the extension that calls fetch() against
 * https://www.googleapis.com/drive/v3/. All other Drive services go through here.
 *
 * All methods return a discriminated union DriveIOResult<T> — they never throw.
 * Callers are responsible for handling the ok: false case.
 *
 * Drive AppData space: files are created with `parents: ['appDataFolder']` and
 * listed with `spaces: appDataFolder`. This folder is app-private and invisible
 * to the user in their Drive UI.
 */

import type { DriveFileRef } from './types/drive-schemas';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

// ── Result type ────────────────────────────────────────────────────────────────

export type DriveIOResult<T> =
  | { ok: true; data: T; etag?: string }
  | { ok: false; status: number; error: string };

// ── Internal helpers ───────────────────────────────────────────────────────────

function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/**
 * Parses the ETag from a Drive API response.
 * Drive returns ETag in the response body field `etag` (not as an HTTP header
 * in the files.get media endpoint), so we accept both locations.
 */
function extractEtag(response: Response, bodyEtag?: string): string | undefined {
  return bodyEtag ?? response.headers.get('etag') ?? undefined;
}

/**
 * Builds a multipart/related request body for Drive file create/update.
 * The boundary separates the JSON metadata part from the media body part.
 */
function buildMultipartBody(
  metadata: object,
  mediaBody: string,
  mimeType: string,
  boundary: string,
): string {
  return [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    '',
    mediaBody,
    `--${boundary}--`,
  ].join('\r\n');
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Creates a new file in the Drive AppData folder.
 * Uses multipart upload (metadata + media in a single request).
 */
export async function createFile(
  filename: string,
  mimeType: 'application/json' | 'text/plain',
  body: string,
  token: string,
): Promise<DriveIOResult<DriveFileRef>> {
  const boundary = `boundary_${crypto.randomUUID().replace(/-/g, '')}`;
  const metadata = { name: filename, parents: ['appDataFolder'] };
  const multipart = buildMultipartBody(metadata, body, mimeType, boundary);

  try {
    const resp = await fetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,size`, {
      method: 'POST',
      headers: {
        ...authHeader(token),
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipart,
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      return { ok: false, status: resp.status, error: `Drive createFile failed (${resp.status}): ${text}` };
    }

    const json = await resp.json() as { id: string; name: string; size: string };
    const etag = extractEtag(resp);
    const ref: DriveFileRef = {
      id: json.id,
      name: json.name,
      etag: etag ?? '',
      size: parseInt(json.size ?? '0', 10),
    };
    return { ok: true, data: ref, etag: ref.etag };
  } catch (err) {
    return { ok: false, status: 0, error: `Drive createFile network error: ${String(err)}` };
  }
}

/**
 * Updates the content of an existing Drive file by its file ID.
 * Uses simple media upload (content only — metadata is unchanged).
 * Returns updated file metadata including the new ETag.
 */
export async function updateFile(
  fileId: string,
  body: string,
  token: string,
): Promise<DriveIOResult<DriveFileRef>> {
  try {
    const resp = await fetch(
      `${DRIVE_UPLOAD_API}/files/${encodeURIComponent(fileId)}?uploadType=media&fields=id,name,size`,
      {
        method: 'PATCH',
        headers: {
          ...authHeader(token),
          'Content-Type': 'application/octet-stream',
        },
        body,
      },
    );

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      return { ok: false, status: resp.status, error: `Drive updateFile failed (${resp.status}): ${text}` };
    }

    const json = await resp.json() as { id: string; name: string; size: string };
    const etag = extractEtag(resp);
    const ref: DriveFileRef = {
      id: json.id,
      name: json.name,
      etag: etag ?? '',
      size: parseInt(json.size ?? '0', 10),
    };
    return { ok: true, data: ref, etag: ref.etag };
  } catch (err) {
    return { ok: false, status: 0, error: `Drive updateFile network error: ${String(err)}` };
  }
}

/**
 * Reads the raw string content of a Drive file by its file ID.
 *
 * Supports ETag-based conditional GET: pass the previously stored ETag to
 * avoid re-downloading unchanged files. When the server returns 304, the
 * result has ok: true with data: null — callers should use their cached value.
 */
export async function readFile(
  fileId: string,
  token: string,
  etag?: string,
): Promise<DriveIOResult<string | null>> {
  const headers: Record<string, string> = { ...authHeader(token) };
  if (etag) {
    headers['If-None-Match'] = etag;
  }

  try {
    const resp = await fetch(
      `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`,
      { headers },
    );

    if (resp.status === 304) {
      // Not modified — caller should use cached value
      return { ok: true, data: null, etag };
    }

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      return { ok: false, status: resp.status, error: `Drive readFile failed (${resp.status}): ${text}` };
    }

    const content = await resp.text();
    const responseEtag = extractEtag(resp);
    return { ok: true, data: content, etag: responseEtag };
  } catch (err) {
    return { ok: false, status: 0, error: `Drive readFile network error: ${String(err)}` };
  }
}

/**
 * Deletes a file from Drive by its file ID.
 * Returns ok: true even if the file was already deleted (404 is treated as success).
 */
export async function deleteFile(
  fileId: string,
  token: string,
): Promise<DriveIOResult<void>> {
  try {
    const resp = await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
      headers: authHeader(token),
    });

    if (resp.status === 204 || resp.status === 404) {
      return { ok: true, data: undefined };
    }

    const text = await resp.text().catch(() => '');
    return { ok: false, status: resp.status, error: `Drive deleteFile failed (${resp.status}): ${text}` };
  } catch (err) {
    return { ok: false, status: 0, error: `Drive deleteFile network error: ${String(err)}` };
  }
}

/**
 * Finds a file in the AppData folder by its exact name.
 * Returns null if no matching file is found.
 * If multiple files with the same name exist (should not happen), returns the first.
 */
export async function findFileByName(
  filename: string,
  token: string,
): Promise<DriveIOResult<DriveFileRef | null>> {
  const query = encodeURIComponent(`name = '${filename.replace(/'/g, "\\'")}' and trashed = false`);
  const fields = encodeURIComponent('files(id,name,size)');

  try {
    const resp = await fetch(
      `${DRIVE_API}/files?spaces=appDataFolder&q=${query}&fields=${fields}`,
      { headers: authHeader(token) },
    );

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      return { ok: false, status: resp.status, error: `Drive findFileByName failed (${resp.status}): ${text}` };
    }

    const json = await resp.json() as { files: Array<{ id: string; name: string; size: string }> };
    if (!json.files || json.files.length === 0) {
      return { ok: true, data: null };
    }

    const f = json.files[0];
    // ETag is not available from list responses in Drive v3 — it will be populated
    // on the first readFile() call via the HTTP response header.
    return {
      ok: true,
      data: { id: f.id, name: f.name, etag: '', size: parseInt(f.size ?? '0', 10) },
    };
  } catch (err) {
    return { ok: false, status: 0, error: `Drive findFileByName network error: ${String(err)}` };
  }
}

/**
 * Lists all files in the AppData folder.
 * Used during initialization to discover existing Drive files.
 */
export async function listAppDataFiles(token: string): Promise<DriveIOResult<DriveFileRef[]>> {
  const fields = encodeURIComponent('files(id,name,size)');

  try {
    const resp = await fetch(
      `${DRIVE_API}/files?spaces=appDataFolder&fields=${fields}&pageSize=100`,
      { headers: authHeader(token) },
    );

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      return { ok: false, status: resp.status, error: `Drive listAppDataFiles failed (${resp.status}): ${text}` };
    }

    const json = await resp.json() as { files: Array<{ id: string; name: string; size: string }> };
    // ETag is not available from list responses in Drive v3.
    const files: DriveFileRef[] = (json.files ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      etag: '',
      size: parseInt(f.size ?? '0', 10),
    }));
    return { ok: true, data: files };
  } catch (err) {
    return { ok: false, status: 0, error: `Drive listAppDataFiles network error: ${String(err)}` };
  }
}
