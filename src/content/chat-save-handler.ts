/**
 * @module chat-save-handler
 * @description Registers a content-script listener that extracts the current chat's
 *   metadata and messages from the DOM on demand. After SPA navigation the new
 *   chat's message elements take time to render, so the handler polls the DOM until
 *   they appear (up to 5 s) before responding. Platform identity + URL parsing live
 *   in the CHAT_PLATFORMS registry so adding a site is one entry there.
 * @dependencies @/adapters/adapter.interface, @/types
 * @public setupChatSaveHandler
 */
import type { ChatSiteAdapter } from '@/adapters/adapter.interface';
import type { ConversationFull, ConversationMessage } from '@/types';
import {
  extractConversationId,
  getPlatformFromUrl,
  isConversationUrl,
} from '@/types';

const POLL_INTERVAL_MS = 400;
const POLL_TIMEOUT_MS = 5000;

export function setupChatSaveHandler(adapter: ChatSiteAdapter): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type !== 'EXTRACT_CURRENT_CHAT_INFO') return false;

    void (async () => {
      const url = location.href;
      const platform = getPlatformFromUrl(url);
      if (!platform) {
        sendResponse({ ok: false, error: 'Not on a supported LLM platform' });
        return;
      }

      const id = extractConversationId(platform, url);

      // Poll for messages to appear in the DOM. After SPA navigation the new
      // conversation's React component needs time to mount and fetch its data,
      // so extractMessages() may return [] immediately after the URL change.
      // Only poll when we're on a specific conversation URL (not the home page).
      let rawMessages = adapter.extractMessages();
      if (rawMessages.length === 0 && isConversationUrl(platform, url)) {
        const deadline = Date.now() + POLL_TIMEOUT_MS;
        while (rawMessages.length === 0 && Date.now() < deadline) {
          await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
          // Bail out if the user navigated away while we were waiting
          if (location.href !== url) break;
          rawMessages = adapter.extractMessages();
        }
      }

      const messages: ConversationMessage[] = rawMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const title = document.title.replace(/\s*[-|].*$/, '').trim() || 'Untitled conversation';
      const now = Date.now();

      const conversation: ConversationFull = {
        meta: {
          id,
          platform,
          title,
          createdAt: now,
          updatedAt: now,
          messageCount: messages.length,
          url,
          lastSyncedAt: now,
        },
        messages,
        fetchedAt: now,
      };

      sendResponse({ ok: true, conversation });
    })();

    return true; // keep the message channel open for the async response
  });
}
