import type { NotebookMeta } from '@/types';

const NOTEBOOKLM_ORIGIN = 'https://notebooklm.google.com';
const BATCHEXECUTE_PATH = '/_/LabsTailwindUi/data/batchexecute';
const LIST_NOTEBOOKS_RPC_ID = 'wXbhsf';

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

  const envelope = [[[LIST_NOTEBOOKS_RPC_ID, '[null,1,null,[2]]', null, 'generic']]];
  const body =
    `f.req=${encodeURIComponent(JSON.stringify(envelope))}` +
    `&at=${encodeURIComponent(csrfToken)}&`;

  const params = new URLSearchParams({
    rpcids: LIST_NOTEBOOKS_RPC_ID,
    'source-path': '/',
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
    throw new Error(`batchexecute failed: ${response.status}`);
  }

  const text = await response.text();
  const rpcResult = parseBatchexecuteResponse(text, LIST_NOTEBOOKS_RPC_ID);
  if (!rpcResult) return [];

  return mapToNotebookMeta(rpcResult);
}

// ── Token extraction ──────────────────────────────────────────────────────────

interface Tokens {
  csrfToken: string | null;
  sessionId: string | null;
}

async function extractTokens(): Promise<Tokens> {
  const response = await fetch(`${NOTEBOOKLM_ORIGIN}/`, { credentials: 'include' });
  if (!response.ok) return { csrfToken: null, sessionId: null };

  const html = await response.text();
  const csrfMatch = html.match(/"SNlM0e":"([^"]+)"/);
  const sidMatch = html.match(/"FdrFJe":"([^"]+)"/);

  return {
    csrfToken: csrfMatch?.[1] ?? null,
    sessionId: sidMatch?.[1] ?? null,
  };
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
