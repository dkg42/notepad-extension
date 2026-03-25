import type { ConversationMessage, ConversationMeta } from '@/types';

const CHATGPT_ORIGIN = 'https://chatgpt.com';

/** Fetches the Bearer access token from the ChatGPT session endpoint. */
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

/** Fetches the user's conversation list from ChatGPT. */
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

/** Fetches the full message content of a single ChatGPT conversation. */
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
