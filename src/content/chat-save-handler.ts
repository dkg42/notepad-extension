/**
 * @module chat-save-handler
 * @description Registers a content-script listener that extracts the current chat's
 *   metadata and messages from the DOM on demand. After SPA navigation the new
 *   chat's message elements take time to render, so the handler polls the DOM until
 *   they appear (up to 5 s) before responding.
 * @dependencies @/adapters/adapter.interface, @/types
 * @public setupChatSaveHandler
 */
import type { ChatSiteAdapter } from '@/adapters/adapter.interface';
import type { ChatPlatform, ConversationFull, ConversationMessage } from '@/types';

const POLL_INTERVAL_MS = 400;
const POLL_TIMEOUT_MS = 5000;

function detectPlatform(): ChatPlatform | null {
  const h = location.hostname;
  if (h.includes('chatgpt.com') || h.includes('chat.openai.com')) return 'chatgpt';
  if (h.includes('claude.ai')) return 'claude';
  if (h.includes('gemini.google.com')) return 'gemini';
  return null;
}

function extractConversationId(platform: ChatPlatform, url: string): string {
  if (platform === 'chatgpt') return url.match(/\/c\/([a-z0-9-]+)/i)?.[1] ?? String(Date.now());
  if (platform === 'claude') return url.match(/\/chat\/([a-z0-9-]+)/i)?.[1] ?? String(Date.now());
  if (platform === 'gemini') return url.match(/\/app\/([a-z0-9]+)/i)?.[1] ?? String(Date.now());
  return String(Date.now());
}

/** Returns true if the URL points to a specific conversation (not the home/new-chat page). */
function isConversationUrl(platform: ChatPlatform, url: string): boolean {
  if (platform === 'chatgpt') return /\/c\/[a-z0-9-]+/i.test(url);
  if (platform === 'claude') return /\/chat\/[a-z0-9-]+/i.test(url);
  if (platform === 'gemini') return /\/app\/[a-z0-9]+/i.test(url);
  return false;
}

export function setupChatSaveHandler(adapter: ChatSiteAdapter): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type !== 'EXTRACT_CURRENT_CHAT_INFO') return false;

    void (async () => {
      const platform = detectPlatform();
      if (!platform) {
        sendResponse({ ok: false, error: 'Not on a supported LLM platform' });
        return;
      }

      const url = location.href;
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
