/**
 * @module chat-history-handler
 * @description Handles chat history chrome.runtime messages for the background service worker.
 *   Supports on-demand extraction of the currently open LLM chat, manual save, and reading
 *   saved conversations. Auto-sync has been removed — saves are user-initiated only.
 * @dependencies chat-history-storage
 * @public handleChatHistoryMessage
 */
import type { ChatPlatform, ConversationFull } from '@/types';
import { chatHistoryStorage } from '@/services/chat-history-storage';
import { usageLimitService } from '@/services/usage-limit-service';
import { isProUser } from './shared';

const SUPPORTED_LLM_PATTERNS = [
  { pattern: /chatgpt\.com|chat\.openai\.com/, platform: 'chatgpt' as ChatPlatform },
  { pattern: /claude\.ai/, platform: 'claude' as ChatPlatform },
  { pattern: /gemini\.google\.com/, platform: 'gemini' as ChatPlatform },
];

function getLLMPlatform(url: string): ChatPlatform | null {
  for (const { pattern, platform } of SUPPORTED_LLM_PATTERNS) {
    if (pattern.test(url)) return platform;
  }
  return null;
}

function extractIdFromUrl(platform: ChatPlatform, url: string): string {
  if (platform === 'chatgpt') return url.match(/\/c\/([a-z0-9-]+)/i)?.[1] ?? String(Date.now());
  if (platform === 'claude') return url.match(/\/chat\/([a-z0-9-]+)/i)?.[1] ?? String(Date.now());
  if (platform === 'gemini') return url.match(/\/app\/([a-z0-9]+)/i)?.[1] ?? String(Date.now());
  return String(Date.now());
}

/** Builds a minimal conversation stub from tab metadata when the content script is unavailable. */
function buildFallbackConversation(platform: ChatPlatform, tab: chrome.tabs.Tab): ConversationFull {
  const now = Date.now();
  const url = tab.url ?? '';
  const rawTitle = (tab.title ?? '').replace(/\s*[-|].*$/, '').trim();
  return {
    meta: {
      id: extractIdFromUrl(platform, url),
      platform,
      title: rawTitle || 'Untitled conversation',
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      url,
      lastSyncedAt: now,
    },
    messages: [],
    fetchedAt: now,
  };
}

export function handleChatHistoryMessage(
  message: { type: string } & Record<string, unknown>,
  sendResponse: (response: unknown) => void,
): boolean | undefined {
  // ── Get current LLM tab info ──────────────────────────────────────────────

  if (message.type === 'GET_CURRENT_CHAT_INFO') {
    (async () => {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (!tab?.id || !tab.url) return { ok: false, available: false };

      const platform = getLLMPlatform(tab.url);
      if (!platform) return { ok: false, available: false };

      // Prefer rich extraction from content script (includes messages + accurate title).
      // Fall back to tab metadata if the content script is not yet loaded in that tab.
      try {
        const result = await chrome.tabs.sendMessage(tab.id, {
          type: 'EXTRACT_CURRENT_CHAT_INFO',
        }) as { ok: boolean; conversation?: ConversationFull; error?: string };

        if (result?.ok && result.conversation) {
          return { ok: true, available: true, conversation: result.conversation };
        }
      } catch {
        // Content script not loaded — fall through to tab-metadata fallback.
      }

      // Fallback: build basic conversation info from the tab's URL and title.
      const conversation = buildFallbackConversation(platform, tab);
      return { ok: true, available: true, conversation };
    })()
      .then((result) => sendResponse(result))
      .catch(() => sendResponse({ ok: false, available: false }));
    return true;
  }

  // ── Save a manually triggered chat ───────────────────────────────────────

  if (message.type === 'SAVE_CURRENT_CHAT') {
    const { conversation } = message as { type: string; conversation: ConversationFull };

    // If the conversation was built from tab metadata (no messages), try one more time
    // to enrich it with DOM-extracted messages from the content script.
    (async () => {
      let toSave = conversation;

      if (conversation.messages.length === 0) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tab = tabs[0];
        if (tab?.id) {
          try {
            const result = await chrome.tabs.sendMessage(tab.id, {
              type: 'EXTRACT_CURRENT_CHAT_INFO',
            }) as { ok: boolean; conversation?: ConversationFull };

            if (result?.ok && result.conversation && result.conversation.messages.length > 0) {
              toSave = result.conversation;
            }
          } catch { /* content script still not available — save as-is */ }
        }
      }

      const pro = await isProUser();
      const allowed = await usageLimitService.canUse('chat_history', pro);
      if (!allowed) return { ok: false, reason: 'daily_limit' };

      await chatHistoryStorage.upsertConversations([toSave.meta]);
      if (pro) {
        await chatHistoryStorage.saveConversationContent(toSave);
      }
      if (!pro) await usageLimitService.increment('chat_history');
      return { ok: true };
    })()
      .then((result) => sendResponse(result))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  // ── Read saved conversations ──────────────────────────────────────────────

  if (message.type === 'GET_CHAT_CONVERSATIONS') {
    const { platform } = message as { type: string; platform?: ChatPlatform };
    chatHistoryStorage.getConversations(platform)
      .then((conversations) => sendResponse({ ok: true, conversations }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  if (message.type === 'GET_CHAT_CONVERSATION_CONTENT') {
    const { platform, id } = message as { type: string; platform: ChatPlatform; id: string };
    chatHistoryStorage.getConversationContent(platform, id)
      .then((conversation) => {
        if (conversation) return sendResponse({ ok: true, conversation });
        sendResponse({ ok: false, error: 'Conversation not found in local storage' });
      })
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  if (message.type === 'DELETE_CHAT_CONVERSATION') {
    const { platform, id } = message as { type: string; platform: ChatPlatform; id: string };
    chatHistoryStorage.deleteConversation(platform, id)
      .then(() => sendResponse({ ok: true }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  return undefined;
}
