/**
 * @module chat-history-handler
 * @description Handles chat history chrome.runtime messages for the background service worker.
 *   Supports on-demand extraction of the currently open LLM chat, manual save, and reading
 *   saved conversations. Auto-sync has been removed — saves are user-initiated only.
 * @dependencies chat-history-storage, @/types (CHAT_PLATFORMS registry)
 * @public handleChatHistoryMessage
 */
import type { ChatPlatform, ConversationFull } from '@/types';
import { extractConversationId, getPlatformFromUrl } from '@/types';
import { chatHistoryStorage } from '@/services/chat-history-storage';
import { usageLimitService } from '@/services/usage-limit-service';
import { isProUser } from './shared';

/**
 * Asks the content script to extract the current chat. If the content script
 * is not loaded (e.g. tab was open before the extension was installed/reloaded),
 * inject it on demand and retry once. Returns null when extraction is not
 * possible in this tab.
 */
async function extractFromTab(tabId: number): Promise<ConversationFull | null> {
  const send = async () => {
    const result = await chrome.tabs.sendMessage(tabId, {
      type: 'EXTRACT_CURRENT_CHAT_INFO',
    }) as { ok: boolean; conversation?: ConversationFull; error?: string };
    return result?.ok && result.conversation ? result.conversation : null;
  };

  try {
    return await send();
  } catch {
    // Content script not registered in this tab — inject and retry once.
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content-scripts/content.js'],
      });
      await new Promise<void>((r) => setTimeout(r, 100));
      return await send();
    } catch {
      return null;
    }
  }
}

/** Builds a minimal conversation stub from tab metadata when the content script is unavailable. */
function buildFallbackConversation(platform: ChatPlatform, tab: chrome.tabs.Tab): ConversationFull {
  const now = Date.now();
  const url = tab.url ?? '';
  const rawTitle = (tab.title ?? '').replace(/\s*[-|].*$/, '').trim();
  return {
    meta: {
      id: extractConversationId(platform, url),
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

      const platform = getPlatformFromUrl(tab.url);
      if (!platform) return { ok: false, available: false };

      // Prefer rich extraction from content script (includes messages + accurate title).
      // The helper injects the content script on demand if it isn't loaded yet,
      // covering tabs that were open before the extension was installed/reloaded.
      const extracted = await extractFromTab(tab.id);
      if (extracted) {
        return { ok: true, available: true, conversation: extracted };
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
          const extracted = await extractFromTab(tab.id);
          if (extracted && extracted.messages.length > 0) {
            toSave = extracted;
          }
        }
      }

      const pro = await isProUser();
      // Re-saving an already-stored conversation is an update, not a new save —
      // it must not be blocked even when the free cap is reached.
      const existing = await chatHistoryStorage.getConversations();
      const alreadySaved = existing.some(
        (c) => c.platform === toSave.meta.platform && c.id === toSave.meta.id,
      );
      if (!alreadySaved && !(await usageLimitService.canCreate('chat_history', pro))) {
        return { ok: false, reason: 'cap_reached' };
      }

      await chatHistoryStorage.upsertConversations([toSave.meta]);
      await chatHistoryStorage.saveConversationContent(toSave);
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
