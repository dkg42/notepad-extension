import type { ConversationMessage, ConversationMeta } from '@/types';

const GEMINI_ORIGIN = 'https://gemini.google.com';

/**
 * Extracts the conversation list from Gemini's sidebar DOM.
 *
 * Gemini does not have a public REST API for listing conversations.
 * The sidebar renders conversation links that we can read directly.
 * Wrapped in try/catch since DOM selectors may change.
 */
export function extractGeminiConversationListFromDom(): ConversationMeta[] {
  try {
    const now = Date.now();
    const conversations: ConversationMeta[] = [];

    // Gemini sidebar conversation links have URLs like /app/{conversationId}
    const links = document.querySelectorAll<HTMLAnchorElement>('a[href*="/app/"]');

    for (const link of links) {
      const href = link.getAttribute('href') ?? '';
      const match = href.match(/\/app\/([a-zA-Z0-9_-]+)/);
      if (!match) continue;

      const id = match[1];
      // Avoid duplicate IDs
      if (conversations.some((c) => c.id === id)) continue;

      // Extract title from link text content
      const title = link.textContent?.trim() || 'Untitled';

      conversations.push({
        id,
        platform: 'gemini',
        title,
        createdAt: now,   // Not available from DOM
        updatedAt: now,   // Not available from DOM
        url: `${GEMINI_ORIGIN}/app/${id}`,
        lastSyncedAt: now,
      });
    }

    return conversations;
  } catch {
    return [];
  }
}

/**
 * Extracts messages for the current Gemini conversation from the page DOM.
 * Mirrors the GeminiAdapter.extractMessages() pattern.
 */
export function extractGeminiCurrentConversationContent(): ConversationMessage[] {
  try {
    const messages: ConversationMessage[] = [];
    const containers = document.querySelectorAll('.conversation-container');

    for (const container of containers) {
      const userEl = container.querySelector('user-query .query-text');
      if (userEl) {
        const content = userEl.textContent?.trim() ?? '';
        if (content) {
          messages.push({ role: 'user', content });
        }
      }

      const assistantEl = container.querySelector('model-response .markdown');
      if (assistantEl) {
        const content = assistantEl.textContent?.trim() ?? '';
        if (content) {
          messages.push({ role: 'assistant', content });
        }
      }
    }

    return messages;
  } catch {
    return [];
  }
}

/**
 * Extracts the conversation ID from the current Gemini URL.
 * Returns null if not on a conversation page.
 */
export function getGeminiCurrentConversationId(): string | null {
  const match = location.pathname.match(/^\/app\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}
