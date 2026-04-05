import type { ArtifactRecord, NoteDetailRecord, NotebookMeta, SourceDetailRecord, SourceRecord } from '@/types';
import { ensureGoogleSession, getSignedInGoogleAccountEmail, invalidateSessionCache } from './google-session-service';

const NOTEBOOKLM_ORIGIN = 'https://notebooklm.google.com';
const BATCHEXECUTE_PATH = '/_/LabsTailwindUi/data/batchexecute';
const LIST_NOTEBOOKS_RPC_ID = 'wXbhsf';
/**
 * RPC ID for fetching a notebook's full data including its source list.
 * Reference: https://github.com/teng-lin/notebooklm-py — docs/rpc-reference.md
 */
const GET_NOTEBOOK_RPC_ID = 'rLM1Ne';

/** Maps the numeric type code in the API response to the SourceType string used in the extension. */
const SOURCE_TYPE_CODE_MAP: Record<number, string> = {
  1: 'gdoc',
  2: 'gslide',
  3: 'pdf',
  5: 'website',
  9: 'youtube',
};
/**
 * RPC ID for the delete-notebook mutation.
 * Reference: https://github.com/teng-lin/notebooklm-py — docs/rpc-reference.md
 */
const DELETE_NOTEBOOK_RPC_ID = 'WWINqb';

const SUMMARIZE_NOTEBOOK_RPC_ID = 'VfAZjd';
const ADD_SOURCE_URL_RPC_ID = 'izAoDd';
const DELETE_SOURCE_RPC_ID = 'tGMBJ';
const CREATE_ARTIFACT_RPC_ID = 'R7cb6c';
const LIST_ARTIFACTS_RPC_ID = 'gArtLc';
const GET_NOTES_RPC_ID = 'cFji9';

// ── Shared batchexecute helper ───────────────────────────────────────────────

interface Tokens {
  csrfToken: string | null;
  sessionId: string | null;
}

async function fetchTokensFromHomepage(): Promise<Tokens> {
  const response = await fetch(`${NOTEBOOKLM_ORIGIN}/`, {
    credentials: 'include',
    redirect: 'manual',
  });

  // redirect: 'manual' prevents the browser from following any redirect to
  // accounts.google.com, which would violate the extension's CSP connect-src.
  // An opaqueredirect response means the NotebookLM session is absent or stale.
  if (response.type === 'opaqueredirect') {
    invalidateSessionCache();
    return { csrfToken: null, sessionId: null };
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      invalidateSessionCache();
    }
    return { csrfToken: null, sessionId: null };
  }

  const html = await response.text();
  const csrfMatch = html.match(/"SNlM0e":"([^"]+)"/);
  const sidMatch = html.match(/"FdrFJe":"([^"]+)"/);

  return {
    csrfToken: csrfMatch?.[1] ?? null,
    sessionId: sidMatch?.[1] ?? null,
  };
}

/**
 * Verifies that the Google account currently signed into the browser matches
 * the Firebase-authenticated user. Throws if they differ, preventing RPC calls
 * from running against the wrong Google account's NotebookLM data.
 *
 * Skips the check when either email is unavailable (e.g. ListAccounts fails or
 * no Firebase user is signed in) to avoid blocking legitimate use.
 */
async function assertSessionOwnership(): Promise<void> {
  const sessionEmail = await getSignedInGoogleAccountEmail();
  if (!sessionEmail) return;
  const authResult = await chrome.storage.local.get('authUser');
  const expectedEmail: string | undefined = authResult['authUser']?.user?.email;
  if (!expectedEmail) return;
  if (sessionEmail.toLowerCase() !== expectedEmail.toLowerCase()) {
    invalidateSessionCache();
    throw new Error(
      `Account mismatch: the browser is signed into Google as ${sessionEmail} ` +
      `but the extension is authenticated as ${expectedEmail}. ` +
      `Please sign in to NotebookLM with your ${expectedEmail} account.`,
    );
  }
}

/**
 * Ensures a Google session exists, then extracts the CSRF and session tokens
 * from the NotebookLM homepage. If the first attempt returns no CSRF token
 * (session expired/invalid), invalidates the cache, re-establishes the session,
 * and retries once.
 *
 * Also asserts that the Google session belongs to the Firebase-authenticated
 * user before returning, so no RPC call fires against the wrong account.
 */
async function extractTokens(): Promise<Tokens> {
  await ensureGoogleSession();
  await assertSessionOwnership();

  const tokens = await fetchTokensFromHomepage();

  if (!tokens.csrfToken) {
    // Session appeared valid (SID cookie present) but the homepage returned
    // no tokens — likely a stale session. Force re-authentication by bypassing
    // the SID cookie check so the user sees the sign-in tab.
    invalidateSessionCache();
    await ensureGoogleSession(true);
    return fetchTokensFromHomepage();
  }

  return tokens;
}

/** Executes a single batchexecute RPC call and returns the parsed result. */
async function executeBatchRpc(
  rpcId: string,
  payload: string,
  sourcePath: string,
  csrfToken: string,
  sessionId: string | null,
): Promise<unknown[] | null> {
  const envelope = [[[rpcId, payload, null, 'generic']]];
  const body =
    `f.req=${encodeURIComponent(JSON.stringify(envelope))}` +
    `&at=${encodeURIComponent(csrfToken)}&`;

  const params = new URLSearchParams({
    rpcids: rpcId,
    'source-path': sourcePath,
    rt: 'c',
  });
  if (sessionId) params.set('f.sid', sessionId);

  const response = await fetch(`${NOTEBOOKLM_ORIGIN}${BATCHEXECUTE_PATH}?${params}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body,
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      invalidateSessionCache();
      throw new Error(`Google session expired (HTTP ${response.status}) — please sign in again`);
    }
    throw new Error(`batchexecute ${rpcId} failed: HTTP ${response.status}`);
  }

  const text = await response.text();
  return parseBatchexecuteResponse(text, rpcId);
}

/**
 * Convenience: extract tokens + execute RPC in one call.
 * On auth failure (401/403 or missing CSRF token), invalidates the session cache
 * and retries once after re-establishing the Google session.
 */
async function executeAuthenticatedRpc(
  rpcId: string,
  payload: string,
  sourcePath: string,
): Promise<unknown[] | null> {
  const attempt = async () => {
    const { csrfToken, sessionId } = await extractTokens();
    if (!csrfToken) throw new Error('Not signed in to NotebookLM');
    return executeBatchRpc(rpcId, payload, sourcePath, csrfToken, sessionId);
  };

  try {
    return await attempt();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isAuthError =
      message.includes('Google session expired') || message.includes('Not signed in');

    if (!isAuthError) throw err;

    // Single retry after session re-establishment
    invalidateSessionCache();
    return attempt();
  }
}

// ── Existing public API ──────────────────────────────────────────────────────

/**
 * Fetches the user's NotebookLM notebooks via the internal batchexecute RPC.
 *
 * Relies on the user's Google session cookies being sent automatically
 * (the extension must have host_permissions for notebooklm.google.com).
 *
 * Returns an empty array if the user is not signed in or the API fails.
 */
export async function fetchNotebooks(): Promise<NotebookMeta[]> {
  const { csrfToken, sessionId } = await extractTokens();
  if (!csrfToken) return [];

  const rpcResult = await executeBatchRpc(
    LIST_NOTEBOOKS_RPC_ID,
    '[null,1,null,[2]]',
    '/',
    csrfToken,
    sessionId,
  );
  if (!rpcResult) return [];

  return mapToNotebookMeta(rpcResult);
}

/**
 * Permanently deletes a NotebookLM notebook via the internal batchexecute RPC.
 *
 * Throws if the user is not signed in or the request fails.
 */
export async function deleteNotebook(notebookId: string): Promise<void> {
  const payload = JSON.stringify([[notebookId], [2]]);
  await executeAuthenticatedRpc(DELETE_NOTEBOOK_RPC_ID, payload, '/');
}

/**
 * Fetches the source list for a single NotebookLM notebook via the GET_NOTEBOOK RPC.
 *
 * Returns an empty array if the notebook is not found or the user is not signed in.
 */
export async function fetchNotebookSources(notebookId: string): Promise<SourceRecord[]> {
  const { csrfToken, sessionId } = await extractTokens();
  if (!csrfToken) throw new Error('Not signed in to NotebookLM');
  return fetchNotebookSourcesInternal(notebookId, csrfToken, sessionId);
}

/**
 * Fetches source counts for multiple notebooks in one pass, reusing a single
 * token extraction to avoid N homepage fetches. Notebooks that fail are omitted
 * from the result (the UI can treat missing keys as unknown).
 */
export async function fetchSourceCounts(
  notebookIds: string[],
): Promise<Record<string, number>> {
  const { csrfToken, sessionId } = await extractTokens();
  if (!csrfToken) throw new Error('Not signed in to NotebookLM');

  const counts: Record<string, number> = {};
  for (const id of notebookIds) {
    try {
      const sources = await fetchNotebookSourcesInternal(id, csrfToken, sessionId);
      counts[id] = sources.length;
    } catch {
      // Skip notebooks that fail — UI will show "—"
    }
  }
  return counts;
}

/** Shared implementation that accepts pre-extracted tokens. */
async function fetchNotebookSourcesInternal(
  notebookId: string,
  csrfToken: string,
  sessionId: string | null,
): Promise<SourceRecord[]> {
  const payload = JSON.stringify([notebookId, null, [2], null, 0]);
  const rpcResult = await executeBatchRpc(
    GET_NOTEBOOK_RPC_ID,
    payload,
    `/notebook/${notebookId}`,
    csrfToken,
    sessionId,
  );
  if (!rpcResult) return [];

  return mapToSourceRecords(rpcResult);
}

// ── New public API — Notebook detail ─────────────────────────────────────────

/** Full notebook data returned from the GET_NOTEBOOK RPC. */
export interface NotebookFullData {
  sources: SourceDetailRecord[];
  notes: NoteDetailRecord[];
  artifacts: ArtifactRecord[];
}

/**
 * Fetches complete notebook data (sources, notes, artifacts) by making
 * three dedicated RPC calls in parallel with a single token extraction.
 *
 * - Sources: GET_NOTEBOOK (`rLM1Ne`)
 * - Notes: GET_NOTES_AND_MIND_MAPS (`cFji9`)
 * - Artifacts: LIST_ARTIFACTS (`gArtLc`)
 */
export async function fetchNotebookFullData(notebookId: string): Promise<NotebookFullData> {
  const { csrfToken, sessionId } = await extractTokens();
  if (!csrfToken) return { sources: [], notes: [], artifacts: [] };

  const sourcePath = `/notebook/${notebookId}`;

  // Run all three RPCs in parallel, sharing a single auth token
  const [sourcesResult, notesResult, artifactsResult] = await Promise.all([
    executeBatchRpc(
      GET_NOTEBOOK_RPC_ID,
      JSON.stringify([notebookId, null, [2], null, 0]),
      sourcePath,
      csrfToken,
      sessionId,
    ),
    executeBatchRpc(
      GET_NOTES_RPC_ID,
      JSON.stringify([notebookId]),
      sourcePath,
      csrfToken,
      sessionId,
    ),
    executeBatchRpc(
      LIST_ARTIFACTS_RPC_ID,
      JSON.stringify([[2], notebookId, 'NOT artifact.status = "ARTIFACT_STATUS_SUGGESTED"']),
      sourcePath,
      csrfToken,
      sessionId,
    ),
  ]);

  return {
    sources: sourcesResult ? mapToSourceDetailRecords(sourcesResult) : [],
    notes: notesResult ? mapToNoteDetailRecords(notesResult) : [],
    artifacts: artifactsResult ? mapToArtifactRecords(artifactsResult) : [],
  };
}

/** Fetches sources with IDs for the detail page (needed for deletion). */
export async function fetchNotebookSourcesDetailed(notebookId: string): Promise<SourceDetailRecord[]> {
  const payload = JSON.stringify([notebookId, null, [2], null, 0]);
  const rpcResult = await executeAuthenticatedRpc(
    GET_NOTEBOOK_RPC_ID,
    payload,
    `/notebook/${notebookId}`,
  );
  if (!rpcResult) return [];
  return mapToSourceDetailRecords(rpcResult);
}

/** Generates a text summary/brief for a notebook. */
export async function summarizeNotebook(notebookId: string): Promise<string> {
  const payload = JSON.stringify([notebookId, [2]]);
  const rpcResult = await executeAuthenticatedRpc(
    SUMMARIZE_NOTEBOOK_RPC_ID,
    payload,
    `/notebook/${notebookId}`,
  );
  if (!rpcResult) return '';

  // The summary text is typically at rpcResult[0] or nested within
  if (typeof rpcResult[0] === 'string') return rpcResult[0];
  if (Array.isArray(rpcResult[0]) && typeof rpcResult[0][0] === 'string') return rpcResult[0][0];
  return JSON.stringify(rpcResult);
}

/** Adds a URL source to a notebook. */
export async function addSourceUrl(notebookId: string, url: string): Promise<void> {
  const isYoutube = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(url);

  let sourceEntry: unknown[];
  if (isYoutube) {
    // YouTube: URL at position [7], trailing 1 at position [10]
    sourceEntry = [null, null, null, null, null, null, null, [url], null, null, 1];
  } else {
    // Website/article: URL at position [2] as a single-element array
    sourceEntry = [null, null, [url], null, null, null, null, null];
  }

  const params: unknown[] = [
    [sourceEntry],
    notebookId,
    [2],
    null,
    null,
  ];

  // YouTube sources include additional metadata
  if (isYoutube) {
    params[3] = [1, null, null, null, null, null, null, null, null, null, [1]];
  }

  const payload = JSON.stringify(params);
  await executeAuthenticatedRpc(
    ADD_SOURCE_URL_RPC_ID,
    payload,
    `/notebook/${notebookId}`,
  );
}

/** Deletes a single source from a notebook. */
export async function deleteSource(sourceId: string): Promise<void> {
  const payload = JSON.stringify([[[sourceId]]]);
  await executeAuthenticatedRpc(DELETE_SOURCE_RPC_ID, payload, '/');
}

/** Audio overview generation options matching the NotebookLM customization dialog. */
export interface AudioOverviewOptions {
  /** Format: 1 = Deep Dive, 2 = Brief, 3 = Critique, 4 = Debate. Default: 1. */
  format?: number;
  /** Language code (e.g. "en", "es", "fr"). Default: "en". */
  language?: string;
  /** Episode length: 1 = Short, 2 = Default, 3 = Long. Default: 2. */
  length?: number;
  /** Custom focus prompt for the AI hosts. */
  focus?: string;
}

/** Creates an audio overview artifact for a notebook with customization options. */
export async function createAudioOverview(
  notebookId: string,
  options?: AudioOverviewOptions,
): Promise<void> {
  const format = options?.format ?? 1;
  const language = options?.language ?? 'en';
  const length = options?.length ?? 2;
  const focus = options?.focus ?? '';

  // Build the RPC payload with customization parameters
  const payload = JSON.stringify([
    notebookId,
    null,
    format,
    focus || null,
    null,
    language,
    length,
  ]);
  await executeAuthenticatedRpc(
    CREATE_ARTIFACT_RPC_ID,
    payload,
    `/notebook/${notebookId}`,
  );
}

/**
 * Allowed audio CDN domain suffixes — mirrors the notebooklm-py security validation.
 * Reference: https://github.com/teng-lin/notebooklm-py
 */
const AUDIO_DOMAIN_ALLOWLIST = ['.google.com', '.googleusercontent.com', '.googleapis.com'];

/**
 * Downloads an audio artifact blob directly from the background service worker.
 * Works because the extension has host_permissions for these Google domains,
 * so CORS is bypassed and cookies are sent automatically via credentials: 'include'.
 *
 * Validates the URL domain against an allowlist before fetching.
 */
export async function fetchAudioBlob(mediaUrl: string): Promise<{ blob: Blob; mimeType: string }> {
  const url = new URL(mediaUrl);
  const isAllowed = AUDIO_DOMAIN_ALLOWLIST.some((suffix) => url.hostname.endsWith(suffix));
  if (!isAllowed) {
    throw new Error(`Audio URL domain not permitted: ${url.hostname}`);
  }

  await ensureGoogleSession();

  const response = await fetch(mediaUrl, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`Audio fetch failed: HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.startsWith('text/html')) {
    throw new Error('Authentication required — received HTML redirect instead of audio. Please open NotebookLM and sign in.');
  }

  const blob = await response.blob();
  if (blob.size === 0) {
    throw new Error('Empty audio response');
  }

  return { blob, mimeType: contentType || 'audio/mp4' };
}

/**
 * Lists artifacts (audio overviews, etc.) for a notebook.
 * Uses the dedicated LIST_ARTIFACTS RPC (`gArtLc`).
 *
 * Reference: https://github.com/teng-lin/notebooklm-py — rpc-reference
 * Payload: [[2], notebook_id, filter_string]
 * Response: [[artifact1, artifact2, ...]]
 */
export async function listArtifacts(notebookId: string): Promise<ArtifactRecord[]> {
  const payload = JSON.stringify([
    [2],
    notebookId,
    'NOT artifact.status = "ARTIFACT_STATUS_SUGGESTED"',
  ]);
  const rpcResult = await executeAuthenticatedRpc(
    LIST_ARTIFACTS_RPC_ID,
    payload,
    `/notebook/${notebookId}`,
  );
  if (!rpcResult) return [];

  return mapToArtifactRecords(rpcResult);
}

/**
 * Fetches notes (and mind maps) for a notebook.
 * Uses the dedicated GET_NOTES_AND_MIND_MAPS RPC (`cFji9`).
 *
 * Reference: https://github.com/teng-lin/notebooklm-py — rpc-reference
 * Payload: [notebook_id]
 * Response: [[item1, item2, ...]] where:
 *   item[0] = note ID
 *   item[1] = content string (for notes) or array (for mind maps)
 *   item[2] = status flag (2 = soft-deleted)
 */
export async function fetchNotebookNotes(notebookId: string): Promise<NoteDetailRecord[]> {
  const payload = JSON.stringify([notebookId]);
  const rpcResult = await executeAuthenticatedRpc(
    GET_NOTES_RPC_ID,
    payload,
    `/notebook/${notebookId}`,
  );
  if (!rpcResult) return [];

  return mapToNoteDetailRecords(rpcResult);
}

// ── Response parsing ──────────────────────────────────────────────────────────

/**
 * Parses the batchexecute chunked response format.
 *
 * The response starts with an anti-XSSI prefix `)]}'` followed by alternating
 * lines of byte-counts and JSON payloads. We scan for the RPC result matching
 * the given rpcId.
 */
function parseBatchexecuteResponse(raw: string, rpcId: string): unknown[] | null {
  // Strip anti-XSSI prefix
  const cleaned = raw.replace(/^\)]\}'\n?/, '');
  const lines = cleaned.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || /^\d+$/.test(line)) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }

    if (!Array.isArray(parsed)) continue;

    // Each parsed chunk is an array of items; scan for our RPC result
    for (const item of parsed) {
      if (!Array.isArray(item)) continue;
      if (item[0] === 'wrb.fr' && item[1] === rpcId && typeof item[2] === 'string') {
        try {
          return JSON.parse(item[2]) as unknown[];
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

// ── Mapping ───────────────────────────────────────────────────────────────────

function mapToNotebookMeta(rpcResult: unknown[]): NotebookMeta[] {
  const entries = rpcResult[0];
  if (!Array.isArray(entries)) return [];

  const now = Date.now();
  const notebooks: NotebookMeta[] = [];

  for (const entry of entries) {
    if (!Array.isArray(entry)) continue;

    const rawTitle: unknown = entry[0];
    const notebookId: unknown = entry[2];
    if (typeof notebookId !== 'string' || !notebookId) continue;

    let title = typeof rawTitle === 'string' ? rawTitle : 'Untitled';
    // Strip the "thought\n" prefix some notebooks have
    if (title.startsWith('thought\n')) {
      title = title.slice('thought\n'.length);
    }
    title = title.trim() || 'Untitled';

    // Ownership: entry[5][1] === false means owner
    let isOwner = true;
    try {
      const meta = entry[5];
      if (Array.isArray(meta) && meta[1] === true) {
        isOwner = false;
      }
    } catch {
      // Keep default isOwner = true
    }

    // Creation timestamp: entry[5][5][0] in seconds
    let createdAt = now;
    try {
      const meta = entry[5];
      if (Array.isArray(meta) && Array.isArray(meta[5]) && typeof meta[5][0] === 'number') {
        createdAt = meta[5][0] * 1000; // convert seconds to ms
      }
    } catch {
      // Keep default
    }

    notebooks.push({
      id: notebookId,
      title,
      url: `${NOTEBOOKLM_ORIGIN}/notebook/${notebookId}`,
      createdAt,
      lastSyncedAt: now,
      isOwner,
    });
  }

  return notebooks;
}

function mapToSourceRecords(rpcResult: unknown[]): SourceRecord[] {
  // GET_NOTEBOOK response: rpcResult[0] = notebook info, rpcResult[0][1] = source list
  const notebookInfo = rpcResult[0];
  if (!Array.isArray(notebookInfo)) return [];

  const sourcesList = notebookInfo[1];
  if (!Array.isArray(sourcesList)) return [];

  const sources: SourceRecord[] = [];

  for (const src of sourcesList) {
    if (!Array.isArray(src)) continue;

    const title = typeof src[1] === 'string' ? src[1].trim() || 'Untitled' : 'Untitled';

    let type = 'unknown';
    try {
      const meta = src[2];
      if (Array.isArray(meta) && typeof meta[4] === 'number') {
        type = SOURCE_TYPE_CODE_MAP[meta[4]] ?? 'unknown';
      }
    } catch {
      // Keep default 'unknown'
    }

    sources.push({ title, type });
  }

  return sources;
}

function mapToSourceDetailRecords(rpcResult: unknown[]): SourceDetailRecord[] {
  const notebookInfo = rpcResult[0];
  if (!Array.isArray(notebookInfo)) return [];

  const sourcesList = notebookInfo[1];
  if (!Array.isArray(sourcesList)) return [];

  const sources: SourceDetailRecord[] = [];

  for (let idx = 0; idx < sourcesList.length; idx++) {
    const src = sourcesList[idx];
    if (!Array.isArray(src)) continue;

    // Source ID: try src[0] as string, then look in nested arrays, then fallback to index
    let id = '';
    if (typeof src[0] === 'string' && src[0]) {
      id = src[0];
    } else if (Array.isArray(src[0]) && typeof src[0][0] === 'string') {
      id = src[0][0];
    } else {
      id = `source-${idx}`;
    }

    const title = typeof src[1] === 'string' ? src[1].trim() || 'Untitled' : 'Untitled';

    let type = 'unknown';
    try {
      const meta = src[2];
      if (Array.isArray(meta) && typeof meta[4] === 'number') {
        type = SOURCE_TYPE_CODE_MAP[meta[4]] ?? 'unknown';
      }
    } catch {
      // Keep default 'unknown'
    }

    sources.push({ id, title, type });
  }

  return sources;
}

/**
 * Parses the GET_NOTES_AND_MIND_MAPS (`cFji9`) response.
 *
 * Response: [[item1, item2, ...]]
 *   item[0] = note ID (string)
 *   item[1] = content string (for notes) or structured data (for mind maps)
 *   item[2] = status flag (2 = soft-deleted, skip these)
 *
 * Reference: https://github.com/teng-lin/notebooklm-py — rpc-reference
 */
function mapToNoteDetailRecords(rpcResult: unknown[]): NoteDetailRecord[] {
  // Response is wrapped: [[item1, item2, ...]]
  let items: unknown[] = [];
  if (Array.isArray(rpcResult[0])) {
    items = rpcResult[0] as unknown[];
  } else {
    items = rpcResult;
  }

  const notes: NoteDetailRecord[] = [];

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    if (!Array.isArray(item)) continue;

    // Skip deleted items: item[2] === 2 means soft-deleted
    if (item[2] === 2) continue;

    // Skip items where content is null (deleted)
    if (item[1] === null || item[1] === undefined) continue;

    // Extract ID
    let id = '';
    if (typeof item[0] === 'string' && item[0]) {
      id = item[0];
    } else {
      id = `note-${idx}`;
    }

    // For notes, item[1] is a string (the content)
    // For mind maps, item[1] is an array: [id, content_json, metadata, null, title]
    let title = 'Untitled Note';
    let content = '';

    if (typeof item[1] === 'string') {
      // Plain note: content is the string; derive title from first line
      content = item[1];
      const firstLine = content.split('\n')[0].trim();
      title = firstLine.length > 80 ? firstLine.slice(0, 80) + '…' : firstLine || 'Untitled Note';
    } else if (Array.isArray(item[1])) {
      // Mind map or structured note
      const inner = item[1];
      if (typeof inner[4] === 'string') {
        title = inner[4].trim() || 'Mind Map';
      }
      if (typeof inner[1] === 'string') {
        content = inner[1];
      }
    } else {
      continue; // Unrecognized format, skip
    }

    notes.push({ id, title, content });
  }

  return notes;
}

/**
 * Parses the LIST_ARTIFACTS (`gArtLc`) response.
 *
 * Response: [[artifact1, artifact2, ...]]
 *   artifact[0] = artifact ID (string)
 *   artifact[2] = artifact_type (int enum)
 *   artifact[4] = status_code (1=processing, 2=pending, 3=completed)
 *
 * Reference: https://github.com/teng-lin/notebooklm-py — rpc-reference
 */
function mapToArtifactRecords(rpcResult: unknown[]): ArtifactRecord[] {
  // Response is wrapped: [[artifact1, artifact2, ...]]
  let items: unknown[] = [];
  if (Array.isArray(rpcResult[0])) {
    items = rpcResult[0] as unknown[];
  } else {
    items = rpcResult;
  }

  const artifacts: ArtifactRecord[] = [];

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    if (!Array.isArray(item)) continue;

    // Extract ID
    let id = '';
    if (typeof item[0] === 'string' && item[0]) {
      id = item[0];
    } else {
      id = `artifact-${idx}`;
    }

    // artifact[2] = artifact_type enum
    let typeCode = 0;
    if (typeof item[2] === 'number') {
      typeCode = item[2];
    }

    // artifact[4] = status (1=processing, 2=pending, 3=completed)
    let status = 0;
    if (typeof item[4] === 'number') {
      status = item[4];
    }

    // Title: try item[1] as string, or derive from type
    let title = 'Audio Overview';
    if (typeof item[1] === 'string' && item[1].trim()) {
      title = item[1].trim();
    }

    // Extract media URL from artifact metadata at art[6][5]
    // Reference: notebooklm-py — art[6] is metadata, art[6][5] is media URL list
    // Each entry in media list: [url, unknown, mimeType, ...]
    let mediaUrl: string | undefined;
    try {
      const metadata = item[6];
      if (Array.isArray(metadata)) {
        const mediaList = metadata[5];
        if (Array.isArray(mediaList)) {
          // Look for audio/mp4 entry first
          for (const entry of mediaList) {
            if (Array.isArray(entry) && typeof entry[0] === 'string' && entry[2] === 'audio/mp4') {
              mediaUrl = entry[0];
              break;
            }
          }
          // Fallback: use the first entry's URL
          if (!mediaUrl && Array.isArray(mediaList[0]) && typeof mediaList[0][0] === 'string') {
            mediaUrl = mediaList[0][0];
          }
        }
      }
      // Final fallback: scan nested arrays for any http URL
      if (!mediaUrl) {
        for (let i = 5; i < item.length; i++) {
          mediaUrl = findHttpUrl(item[i]);
          if (mediaUrl) break;
        }
      }
    } catch {
      // No media URL
    }

    // Extract creation timestamp
    let createdAt: number | undefined;
    try {
      // Timestamps are often in arrays at various positions
      for (let i = 3; i < Math.min(item.length, 10); i++) {
        const val = item[i];
        if (Array.isArray(val) && typeof val[0] === 'number' && val[0] > 1_000_000_000) {
          createdAt = val[0] > 1e12 ? val[0] : val[0] * 1000;
          break;
        }
      }
    } catch {
      // Keep undefined
    }

    artifacts.push({ id, title, typeCode, mediaUrl, createdAt, status });
  }

  return artifacts;
}

/** Recursively searches for an HTTP URL string in nested arrays (max depth 3). */
function findHttpUrl(value: unknown, depth = 0): string | undefined {
  if (depth > 3) return undefined;
  if (typeof value === 'string' && value.startsWith('http')) return value;
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = findHttpUrl(child, depth + 1);
      if (found) return found;
    }
  }
  return undefined;
}
