/**
 * @module claude-session-api
 * @description HTTP client for Claude.ai's private REST API, used to list and fetch full conversation content for the chat history sync feature. Authenticates by first resolving the user's active organization ID, which is required as a path parameter for all conversation endpoints. All requests use credentials: 'include' so no separate login is required — the user must be signed in to Claude.ai in the same browser profile.
 * @dependencies (none — pure HTTP, no internal src/ imports)
 * @public getClaudeOrganizationId, fetchClaudeConversationList, fetchClaudeConversationContent
 */
import type { ConversationMessage, ConversationMeta } from '@/types';

const CLAUDE_ORIGIN = 'https://claude.ai';

/**
 * Resolves the active organization UUID for the signed-in Claude user by
 * calling the `/api/organizations` endpoint with browser cookies.
 * @returns The UUID string of the first organization, or `null` when the user
 *   is not signed in or the endpoint returns a non-OK status.
 * @remarks Never throws — all errors are caught and coerced to `null`.
 */
export async function getClaudeOrganizationId(): Promise<string | null> {
  try {
    const res = await fetch(`${CLAUDE_ORIGIN}/api/organizations`, {
      credentials: 'include',
    });
    if (!res.ok) return null;
    const json = await res.json() as Array<{ uuid?: string }>;
    return json[0]?.uuid ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetches all conversations for the given Claude organization, returning them
 * as `ConversationMeta` objects with a `claude` platform tag.
 * @param orgId - The organization UUID obtained from `getClaudeOrganizationId`.
 * @returns An array of `ConversationMeta` objects, filtered to exclude items
 *   with empty IDs. Returns an empty array when the response body is not an array.
 * @throws `Error` with the HTTP status code when the conversations endpoint
 *   returns a non-OK response.
 */
export async function fetchClaudeConversationList(orgId: string): Promise<ConversationMeta[]> {
  const res = await fetch(
    `${CLAUDE_ORIGIN}/api/organizations/${orgId}/chat_conversations`,
    { credentials: 'include' },
  );
  if (!res.ok) throw new Error(`Claude conversations API failed: HTTP ${res.status}`);

  const json = await res.json() as Array<{
    uuid?: string;
    name?: string;
    created_at?: string;
    updated_at?: string;
  }>;

  const now = Date.now();
  return (Array.isArray(json) ? json : []).map((item) => ({
    id: item.uuid ?? '',
    platform: 'claude' as const,
    title: item.name?.trim() || 'Untitled',
    createdAt: item.created_at ? new Date(item.created_at).getTime() : now,
    updatedAt: item.updated_at ? new Date(item.updated_at).getTime() : now,
    url: `${CLAUDE_ORIGIN}/chat/${item.uuid}`,
    lastSyncedAt: now,
  })).filter((c) => c.id);
}

/**
 * Fetches the full message history for a single Claude conversation and
 * normalises it to an array of user/assistant `ConversationMessage` objects.
 * @param orgId - The organization UUID obtained from `getClaudeOrganizationId`.
 * @param uuid - The conversation UUID.
 * @returns An ordered array of non-empty `ConversationMessage` objects; only
 *   `human` and `assistant` sender roles are included.
 * @throws `Error` with the HTTP status code when the conversation endpoint
 *   returns a non-OK response.
 * @remarks Content may be provided as a plain `text` string or as a structured
 *   `content` array; both forms are handled transparently.
 */
export async function fetchClaudeConversationContent(
  orgId: string,
  uuid: string,
): Promise<ConversationMessage[]> {
  const res = await fetch(
    `${CLAUDE_ORIGIN}/api/organizations/${orgId}/chat_conversations/${uuid}`,
    { credentials: 'include' },
  );
  if (!res.ok) throw new Error(`Claude conversation fetch failed: HTTP ${res.status}`);

  const json = await res.json() as {
    chat_messages?: Array<{
      sender?: string;
      text?: string;
      content?: Array<{ type?: string; text?: string }>;
      created_at?: string;
    }>;
  };

  const rawMessages = json.chat_messages ?? [];

  return rawMessages
    .filter((msg) => msg.sender === 'human' || msg.sender === 'assistant')
    .map((msg) => {
      // Content may be a string field or a structured array
      let content = '';
      if (typeof msg.text === 'string') {
        content = msg.text;
      } else if (Array.isArray(msg.content)) {
        content = msg.content
          .filter((c) => c.type === 'text')
          .map((c) => c.text ?? '')
          .join('\n');
      }

      return {
        role: msg.sender === 'human' ? ('user' as const) : ('assistant' as const),
        content: content.trim(),
        createdAt: msg.created_at ? new Date(msg.created_at).getTime() : undefined,
      };
    })
    .filter((m) => m.content.length > 0);
}
