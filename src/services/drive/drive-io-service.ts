/**
 * @module drive-io-service
 * @description Raw Google Drive REST API primitives — the single point of contact
 * between the extension and https://www.googleapis.com/drive/v3/. All methods return
 * a discriminated union `DriveIOResult<T>` and never throw; callers must handle the
 * `ok: false` case. Files are stored in the Drive AppData space (app-private,
 * invisible to the user) unless `USE_VISIBLE_DEBUG_FOLDER` is enabled for local QA.
 * @dependencies ./types/drive-schemas (DriveFileRef)
 * @public DriveIOResult, createFile, updateFile, readFile, deleteFile, findFileByName, listAppDataFiles, getPodcastAudioFolderId, createBinaryFile, readBinaryFile
 */

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
 *
 * DEBUG MODE: Set USE_VISIBLE_DEBUG_FOLDER = true to store files in a visible
 * Drive folder named DEBUG_FOLDER_NAME instead of appDataFolder. This allows
 * inspection of stored files via the Drive UI. Revert to false before release.
 */

import type { DriveFileRef } from './types/drive-schemas';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

// ── Debug: visible folder mode ─────────────────────────────────────────────────
// Set to true only for local validation. Revert to false before release.
const USE_VISIBLE_DEBUG_FOLDER = true;
const DEBUG_FOLDER_NAME = 'NotepadExtension-Debug';

/** Cached folder ID so we only create/find it once per service-worker lifetime. */
let debugFolderIdCache: string | null = null;

/**
 * Finds or creates the debug folder in the user's Drive root.
 * The result is cached in `debugFolderIdCache` for the lifetime of the service worker.
 */
async function getDebugFolderId(token: string): Promise<string> {
  if (debugFolderIdCache) return debugFolderIdCache;

  const escapedName = DEBUG_FOLDER_NAME.replace(/'/g, "\\'");
  const query = encodeURIComponent(
    `name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
  );
  const listUrl = `${DRIVE_API}/files?spaces=drive&q=${query}&fields=${encodeURIComponent('files(id,name)')}`;

  const listResp = await fetch(listUrl, { headers: authHeader(token) });
  if (listResp.ok) {
    const json = await listResp.json() as { files: Array<{ id: string }> };
    if (json.files && json.files.length > 0) {
      debugFolderIdCache = json.files[0].id;
      return debugFolderIdCache;
    }
  }

  // Folder not found — create it
  const createResp = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: DEBUG_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  });

  if (!createResp.ok) {
    const text = await createResp.text().catch(() => '');
    throw new Error(`Failed to create debug folder (${createResp.status}): ${text}`);
  }

  const folder = await createResp.json() as { id: string };
  debugFolderIdCache = folder.id;
  return debugFolderIdCache;
}

// ── User-visible podcast-audio folder ─────────────────────────────────────────
//
// Unlike AppData (app-private, invisible), custom podcast-audio uploads go into a
// regular Drive folder the app creates so the user can see/manage them directly
// in their Drive UI. This is intentional and always on — it is NOT gated on the
// debug flag above. Requires the already-requested `drive.file` scope (the app
// can manage files/folders it creates).

const PODCAST_AUDIO_FOLDER_NAME = 'NoteHubLM Podcast Audio';

/** Cached folder id for the lifetime of the service worker. */
let podcastAudioFolderIdCache: string | null = null;

/**
 * Finds or creates the user-visible podcast-audio folder in the user's Drive
 * root. Cached in `podcastAudioFolderIdCache`. Returns null on failure (callers
 * treat audio sync as best-effort).
 */
export async function getPodcastAudioFolderId(token: string): Promise<string | null> {
  if (podcastAudioFolderIdCache) return podcastAudioFolderIdCache;

  const escapedName = PODCAST_AUDIO_FOLDER_NAME.replace(/'/g, "\\'");
  const query = encodeURIComponent(
    `name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
  );
  const listUrl = `${DRIVE_API}/files?spaces=drive&q=${query}&fields=${encodeURIComponent('files(id,name)')}`;

  try {
    const listResp = await fetch(listUrl, { headers: authHeader(token) });
    if (listResp.ok) {
      const json = (await listResp.json()) as { files: Array<{ id: string }> };
      if (json.files && json.files.length > 0) {
        podcastAudioFolderIdCache = json.files[0].id;
        return podcastAudioFolderIdCache;
      }
    }

    const createResp = await fetch(`${DRIVE_API}/files`, {
      method: 'POST',
      headers: { ...authHeader(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: PODCAST_AUDIO_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });
    if (!createResp.ok) return null;

    const folder = (await createResp.json()) as { id: string };
    podcastAudioFolderIdCache = folder.id;
    return podcastAudioFolderIdCache;
  } catch {
    return null;
  }
}

// ── Result type ────────────────────────────────────────────────────────────────

export type DriveIOResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

// ── Internal helpers ───────────────────────────────────────────────────────────

function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
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
  const parent = USE_VISIBLE_DEBUG_FOLDER ? await getDebugFolderId(token) : 'appDataFolder';
  const metadata = { name: filename, parents: [parent] };
  const multipart = buildMultipartBody(metadata, body, mimeType, boundary);

  try {
    const resp = await fetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,size,version`, {
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

    const json = await resp.json() as { id: string; name: string; size: string; version?: string };
    const ref: DriveFileRef = {
      id: json.id,
      name: json.name,
      version: parseInt(json.version ?? '0', 10),
      size: parseInt(json.size ?? '0', 10),
    };
    return { ok: true, data: ref };
  } catch (err) {
    return { ok: false, status: 0, error: `Drive createFile network error: ${String(err)}` };
  }
}

/**
 * Creates a new binary file (e.g. audio) under an explicit parent folder.
 * Uses multipart/related with a Blob body so raw bytes are sent intact (the
 * string multipart builder used by createFile cannot carry binary safely).
 */
export async function createBinaryFile(
  filename: string,
  mimeType: string,
  body: Blob,
  parentId: string,
  token: string,
): Promise<DriveIOResult<DriveFileRef>> {
  const boundary = `boundary_${crypto.randomUUID().replace(/-/g, '')}`;
  const metadata = { name: filename, parents: [parentId] };
  const preamble =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`;
  const epilogue = `\r\n--${boundary}--`;
  const multipart = new Blob([preamble, body, epilogue]);

  try {
    const resp = await fetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,size,version`, {
      method: 'POST',
      headers: {
        ...authHeader(token),
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipart,
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      return { ok: false, status: resp.status, error: `Drive createBinaryFile failed (${resp.status}): ${text}` };
    }

    const json = (await resp.json()) as { id: string; name: string; size: string; version?: string };
    return {
      ok: true,
      data: {
        id: json.id,
        name: json.name,
        version: parseInt(json.version ?? '0', 10),
        size: parseInt(json.size ?? '0', 10),
      },
    };
  } catch (err) {
    return { ok: false, status: 0, error: `Drive createBinaryFile network error: ${String(err)}` };
  }
}

/**
 * Updates the content of an existing Drive file by its file ID.
 * Uses simple media upload (content only — metadata is unchanged).
 * Returns updated file metadata including the new version number.
 */
export async function updateFile(
  fileId: string,
  body: string,
  token: string,
): Promise<DriveIOResult<DriveFileRef>> {
  try {
    const resp = await fetch(
      `${DRIVE_UPLOAD_API}/files/${encodeURIComponent(fileId)}?uploadType=media&fields=id,name,size,version`,
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

    const json = await resp.json() as { id: string; name: string; size: string; version?: string };
    const ref: DriveFileRef = {
      id: json.id,
      name: json.name,
      version: parseInt(json.version ?? '0', 10),
      size: parseInt(json.size ?? '0', 10),
    };
    return { ok: true, data: ref };
  } catch (err) {
    return { ok: false, status: 0, error: `Drive updateFile network error: ${String(err)}` };
  }
}

/**
 * Reads the raw string content of a Drive file by its file ID.
 *
 * Drive API v3 removed ETags from resource responses, so conditional GETs
 * are not supported. The file content is always downloaded.
 */
export async function readFile(
  fileId: string,
  token: string,
): Promise<DriveIOResult<string>> {
  try {
    const resp = await fetch(
      `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`,
      { headers: authHeader(token) },
    );

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      return { ok: false, status: resp.status, error: `Drive readFile failed (${resp.status}): ${text}` };
    }

    const content = await resp.text();
    return { ok: true, data: content };
  } catch (err) {
    return { ok: false, status: 0, error: `Drive readFile network error: ${String(err)}` };
  }
}

/**
 * Reads a Drive file's raw bytes as a Blob (e.g. for downloading custom audio
 * back into IndexedDB on a device that doesn't have the blob yet).
 */
export async function readBinaryFile(
  fileId: string,
  token: string,
): Promise<DriveIOResult<Blob>> {
  try {
    const resp = await fetch(
      `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`,
      { headers: authHeader(token) },
    );

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      return { ok: false, status: resp.status, error: `Drive readBinaryFile failed (${resp.status}): ${text}` };
    }

    const blob = await resp.blob();
    return { ok: true, data: blob };
  } catch (err) {
    return { ok: false, status: 0, error: `Drive readBinaryFile network error: ${String(err)}` };
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
  const escapedName = filename.replace(/'/g, "\\'");
  let queryStr = `name = '${escapedName}' and trashed = false`;
  let spaces = 'appDataFolder';

  if (USE_VISIBLE_DEBUG_FOLDER) {
    spaces = 'drive';
    const folderId = await getDebugFolderId(token);
    queryStr += ` and '${folderId}' in parents`;
  }

  const query = encodeURIComponent(queryStr);
  const fields = encodeURIComponent('files(id,name,size,version)');

  try {
    const resp = await fetch(
      `${DRIVE_API}/files?spaces=${spaces}&q=${query}&fields=${fields}`,
      { headers: authHeader(token) },
    );

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      return { ok: false, status: resp.status, error: `Drive findFileByName failed (${resp.status}): ${text}` };
    }

    const json = await resp.json() as { files: Array<{ id: string; name: string; size: string; version?: string }> };
    if (!json.files || json.files.length === 0) {
      return { ok: true, data: null };
    }

    const f = json.files[0];
    return {
      ok: true,
      data: { id: f.id, name: f.name, version: parseInt(f.version ?? '0', 10), size: parseInt(f.size ?? '0', 10) },
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
  const fields = encodeURIComponent('files(id,name,size,version)');
  let url: string;

  if (USE_VISIBLE_DEBUG_FOLDER) {
    const folderId = await getDebugFolderId(token);
    const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    url = `${DRIVE_API}/files?spaces=drive&q=${query}&fields=${fields}&pageSize=100`;
  } else {
    url = `${DRIVE_API}/files?spaces=appDataFolder&fields=${fields}&pageSize=100`;
  }

  try {
    const resp = await fetch(url, { headers: authHeader(token) });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      return { ok: false, status: resp.status, error: `Drive listAppDataFiles failed (${resp.status}): ${text}` };
    }

    const json = await resp.json() as { files: Array<{ id: string; name: string; size: string; version?: string }> };
    const files: DriveFileRef[] = (json.files ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      version: parseInt(f.version ?? '0', 10),
      size: parseInt(f.size ?? '0', 10),
    }));
    return { ok: true, data: files };
  } catch (err) {
    return { ok: false, status: 0, error: `Drive listAppDataFiles network error: ${String(err)}` };
  }
}
