import type { ConversationMessage, ConversationMeta } from '@/types';

const CLAUDE_ORIGIN = 'https://claude.ai';

/** Fetches the active organization ID for the signed-in Claude user. */
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

/** Fetches the user's conversation list from Claude. */
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

/** Fetches the full message content of a single Claude conversation. */
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
