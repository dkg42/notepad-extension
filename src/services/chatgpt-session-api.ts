/**
 * @module chatgpt-session-api
 * @description HTTP client for ChatGPT's private backend API, used to list and fetch full conversation content for the chat history sync feature. Authenticates by reading the Bearer token from ChatGPT's session endpoint (which honours the user's existing browser cookies). All requests use credentials: 'include' so no separate login is required — the user must be signed in to ChatGPT in the same browser profile.
 * @dependencies (none — pure HTTP, no internal src/ imports)
 * @public getChatGptAccessToken, fetchChatGptConversationList, fetchChatGptConversationContent
 */
import type { ConversationMessage, ConversationMeta } from '@/types';

const CHATGPT_ORIGIN = 'https://chatgpt.com';

/**
 * Fetches the Bearer access token from the ChatGPT session endpoint using the
 * user's existing browser cookies (`credentials: 'include'`).
 * @returns The access token string, or `null` when the user is not signed in
 *   or the session endpoint returns a non-OK status.
 * @remarks Never throws — all errors are caught and coerced to `null`.
 */
export async function getChatGptAccessToken(): Promise<string | null> {
  try {
    const res = await fetch(`${CHATGPT_ORIGIN}/api/auth/session`, {
      credentials: 'include',
    });
    if (!res.ok) return null;
    const json = await res.json() as { accessToken?: string };
    return json.accessToken ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetches a paginated slice of the signed-in user's ChatGPT conversations,
 * sorted by most recently updated.
 * @param token - A valid Bearer token obtained from `getChatGptAccessToken`.
 * @param limit - Maximum number of conversations to return (default: 100).
 * @param offset - Zero-based index of the first item to return (default: 0).
 * @returns An array of `ConversationMeta` objects, empty when there are no results.
 * @throws `Error` with the HTTP status code when the conversations API returns
 *   a non-OK response.
 */
export async function fetchChatGptConversationList(
  token: string,
  limit = 100,
  offset = 0,
): Promise<ConversationMeta[]> {
  const res = await fetch(
    `${CHATGPT_ORIGIN}/backend-api/conversations?offset=${offset}&limit=${limit}&order=updated`,
    {
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!res.ok) throw new Error(`ChatGPT conversations API failed: HTTP ${res.status}`);

  const json = await res.json() as {
    items?: Array<{
      id: string;
      title?: string;
      create_time?: number;
      update_time?: number;
    }>;
  };

  const now = Date.now();
  return (json.items ?? []).map((item) => ({
    id: item.id,
    platform: 'chatgpt' as const,
    title: item.title?.trim() || 'Untitled',
    createdAt: item.create_time ? item.create_time * 1000 : now,
    updatedAt: item.update_time ? item.update_time * 1000 : now,
    url: `${CHATGPT_ORIGIN}/c/${item.id}`,
    lastSyncedAt: now,
  }));
}

/**
 * Fetches the full message tree for a single ChatGPT conversation and returns
 * it as a flat, time-ordered array of user/assistant turns.
 * @param token - A valid Bearer token obtained from `getChatGptAccessToken`.
 * @param id - The ChatGPT conversation UUID.
 * @returns An ordered array of `ConversationMessage` objects; empty when the
 *   conversation has no mappable message nodes or all messages are system-only.
 * @throws `Error` with the HTTP status code when the conversation endpoint
 *   returns a non-OK response.
 */
export async function fetchChatGptConversationContent(
  token: string,
  id: string,
): Promise<ConversationMessage[]> {
  const res = await fetch(`${CHATGPT_ORIGIN}/backend-api/conversation/${id}`, {
    credentials: 'include',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`ChatGPT conversation fetch failed: HTTP ${res.status}`);

  const json = await res.json() as {
    mapping?: Record<string, {
      message?: {
        author?: { role?: string };
        content?: { parts?: unknown[] };
        create_time?: number;
      };
    }>;
  };

  if (!json.mapping) return [];

  // Flatten the tree: filter nodes with real messages, sort by create_time
  const messages: ConversationMessage[] = [];

  const nodes = Object.values(json.mapping)
    .filter((node) => node.message?.author?.role && node.message.content?.parts?.length)
    .sort((a, b) => (a.message!.create_time ?? 0) - (b.message!.create_time ?? 0));

  for (const node of nodes) {
    const msg = node.message!;
    const role = msg.author?.role;
    if (!role || role === 'system') continue;

    const parts = (msg.content?.parts ?? [])
      .filter((p): p is string => typeof p === 'string' && p.trim().length > 0);
    if (parts.length === 0) continue;

    messages.push({
      role: role === 'user' ? 'user' : 'assistant',
      content: parts.join('\n'),
      createdAt: msg.create_time ? msg.create_time * 1000 : undefined,
    });
  }

  return messages;
}
