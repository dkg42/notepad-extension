/**
 * @module gemini-session-api
 * @description DOM-scraping adapter for Gemini conversation data, used where no REST API is available. Conversation list discovery reads sidebar anchor tags rendered by Gemini's SPA; conversation content is extracted from the live DOM using CSS selectors that mirror the GeminiAdapter pattern. All functions are wrapped in try/catch since selectors may break on UI updates.
 * @dependencies (none — pure DOM access, no internal src/ imports)
 * @public extractGeminiConversationListFromDom, extractGeminiCurrentConversationContent, getGeminiCurrentConversationId
 */
import type { ConversationMessage, ConversationMeta } from '@/types';

const GEMINI_ORIGIN = 'https://gemini.google.com';

/**
 * Extracts the conversation list from Gemini's sidebar DOM by reading
 * `/app/{id}` anchor tags rendered by the SPA.
 * @returns An array of `ConversationMeta` objects with `gemini` platform tags;
 *   `createdAt`/`updatedAt` are set to `Date.now()` because Gemini's DOM
 *   does not expose timestamps. Returns an empty array on selector failure.
 * @remarks Wrapped in try/catch — returns `[]` if DOM selectors have changed.
 *   Gemini has no public REST API for listing conversations.
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
 * Extracts user and assistant messages for the currently open Gemini
 * conversation by querying `.conversation-container` elements in the live DOM.
 * @returns An ordered array of `ConversationMessage` objects with `user` and
 *   `assistant` roles. Returns an empty array when no conversation containers
 *   are found or on selector failure.
 * @remarks Mirrors the `GeminiAdapter.extractMessages()` CSS selector pattern;
 *   update both if Gemini changes its DOM structure.
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
 * Extracts the Gemini conversation ID from the current page URL pathname.
 * @returns The alphanumeric conversation ID string when the current pathname
 *   matches `/app/{id}`, or `null` when not on a Gemini conversation page.
 */
export function getGeminiCurrentConversationId(): string | null {
  const match = location.pathname.match(/^\/app\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}
