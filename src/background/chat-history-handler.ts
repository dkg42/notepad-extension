/**
 * @module chat-history-handler
 * @description Handles chat history chrome.runtime messages for the background service worker.
 * @dependencies chat-history-storage, drive-sync-service, token-lifecycle-service, shared
 * @public handleChatHistoryMessage
 */
import type { ChatPlatform, ConversationMeta, ConversationFull } from '@/types';
import { chatHistoryStorage } from '@/services/chat-history-storage';
import { driveSyncService } from '@/services/drive/drive-sync-service';
import { getValidToken } from '@/services/token-lifecycle-service';
import { ensureSignedIn } from './shared';

/**
 * Sends a message to a tab's content script, retrying if the content script
 * hasn't registered its listener yet (common on newly created tabs).
 */
async function sendMessageToTab<T = unknown>(
  tabId: number,
  message: unknown,
  maxRetries = 5,
  delayMs = 500,
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[NLM-EXT BG] sendMessageToTab attempt ${attempt + 1}/${maxRetries + 1}, tabId=${tabId}`);
      const result = await chrome.tabs.sendMessage(tabId, message) as T;
      console.log('[NLM-EXT BG] sendMessageToTab succeeded:', result);
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[NLM-EXT BG] sendMessageToTab attempt ${attempt + 1} failed:`, msg);
      const isNoReceiver = msg.includes('Receiving end does not exist') ||
        msg.includes('Could not establish connection');
      if (!isNoReceiver || attempt === maxRetries) throw err;
      // Wait for the content script to initialize
      console.log(`[NLM-EXT BG] Retrying in ${delayMs}ms...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('Failed to reach content script');
}

export function handleChatHistoryMessage(
  message: { type: string } & Record<string, unknown>,
  sendResponse: (response: unknown) => void,
): boolean | undefined {
  // ── Chat History Sync ─────────────────────────────────────────────────

  if (message.type === 'SYNC_CHAT_CONVERSATIONS') {
    const { conversations } = message as {
      type: string;
      platform: ChatPlatform;
      conversations: ConversationMeta[];
    };
    ensureSignedIn()
      .then(() => chatHistoryStorage.upsertConversations(conversations))
      .then(() => sendResponse({ ok: true }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  if (message.type === 'SYNC_CHAT_CONVERSATION_CONTENT') {
    const { conversation } = message as {
      type: string;
      conversation: ConversationFull;
    };
    ensureSignedIn()
      .then(() => chatHistoryStorage.saveConversationContent(conversation))
      .then(() => sendResponse({ ok: true }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  if (message.type === 'UPDATE_CHAT_SYNC_META') {
    const { platform, ...meta } = message as {
      type: string;
      platform: ChatPlatform;
      lastSyncedAt?: number;
      conversationCount?: number;
      error?: string;
    };
    chatHistoryStorage.setSyncMeta(platform, meta)
      .then(() => sendResponse({ ok: true }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

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
    const { platform, id } = message as {
      type: string;
      platform: ChatPlatform;
      id: string;
    };
    (async () => {
      await ensureSignedIn();
      // Return cached content if available
      const cached = await chatHistoryStorage.getConversationContent(platform, id);
      if (cached) return { ok: true, conversation: cached };

      // Drive fallback: if not in local storage, check Drive before opening a tab
      const driveTokenResult = await getValidToken();
      if (driveTokenResult.ok && driveTokenResult.hasDriveScope) {
        const driveConversation = await driveSyncService.getChatConversationContent(
          platform, id, driveTokenResult.accessToken,
        );
        if (driveConversation) {
          await chatHistoryStorage.saveConversationContent(driveConversation);
          return { ok: true, conversation: driveConversation };
        }
      }

      // For ChatGPT/Claude: any authenticated tab works (REST APIs, fetch by ID).
      // For Gemini: no REST API exists — content must be extracted from the rendered DOM.
      //   First check if the specific conversation is already open in a tab.
      //   If not, open it in a background tab, extract, then close it.
      if (platform === 'gemini') {
        const conversationUrl = `https://gemini.google.com/app/${id}`;
        const existingTabs = await chrome.tabs.query({ url: conversationUrl });
        const { tabId, created } = existingTabs.length > 0 && existingTabs[0].id
          ? { tabId: existingTabs[0].id, created: false }
          : await (async () => {
              const tab = await chrome.tabs.create({ url: conversationUrl, active: false });
              await new Promise<void>((resolve, reject) => {
                const listener = (updatedId: number, info: chrome.tabs.TabChangeInfo) => {
                  if (updatedId === tab.id && info.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    chrome.tabs.get(tab.id!).then((t) => {
                      if (t.url?.startsWith('https://gemini.google.com')) {
                        resolve();
                      } else {
                        chrome.tabs.remove(tab.id!).catch(() => {});
                        reject(new Error('Gemini requires authentication. Please open Gemini and sign in.'));
                      }
                    }).catch(reject);
                  }
                };
                chrome.tabs.onUpdated.addListener(listener);
              });
              return { tabId: tab.id!, created: true };
            })();

        try {
          const result = await sendMessageToTab<{ ok: boolean; conversation?: ConversationFull; error?: string }>(
            tabId,
            { type: 'FETCH_CONVERSATION_FOR_SYNC', id },
          );
          if (result?.ok && result.conversation) {
            await chatHistoryStorage.saveConversationContent(result.conversation);
            return { ok: true, conversation: result.conversation };
          }
          return { ok: false, error: result?.error ?? 'Failed to extract Gemini conversation from DOM' };
        } finally {
          if (created) chrome.tabs.remove(tabId).catch(() => {});
        }
      }

      // ChatGPT / Claude: find any authenticated tab and fetch via REST API
      const urlPatterns: Record<string, string> = {
        chatgpt: 'https://chatgpt.com/*',
        claude: 'https://claude.ai/*',
      };
      const pattern = urlPatterns[platform];
      if (!pattern) return { ok: false, error: 'Unknown platform' };

      const tabs = await chrome.tabs.query({ url: pattern });
      if (tabs.length === 0 || !tabs[0].id) {
        return { ok: false, error: `Please open ${platform} in a tab to sync this conversation` };
      }

      const result = await sendMessageToTab<{ ok: boolean; conversation?: ConversationFull; error?: string }>(
        tabs[0].id,
        { type: 'FETCH_CONVERSATION_FOR_SYNC', id },
      );

      if (result?.ok && result.conversation) {
        await chatHistoryStorage.saveConversationContent(result.conversation);
        return { ok: true, conversation: result.conversation };
      }
      return { ok: false, error: result?.error ?? 'Failed to fetch conversation content' };
    })()
      .then((result) => sendResponse(result))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  if (message.type === 'GET_CHAT_SYNC_META') {
    chatHistoryStorage.getSyncMeta()
      .then((meta) => sendResponse({ ok: true, meta }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  return undefined; // not handled
}
