/**
 * @module chat-history-sync
 * @description Automatically syncs conversation lists and message content from ChatGPT, Claude, and Gemini to the extension's background storage. Detects the current platform, batch-fetches recent conversations via platform-specific session APIs, and re-syncs on SPA navigation. Also registers an on-demand fetch listener so the dashboard can lazily load individual conversation content without a full re-sync.
 * @dependencies @/types, @/utils/dom, @/services/chatgpt-session-api, @/services/claude-session-api, @/services/gemini-session-api
 * @public setupChatHistorySync
 */
import type { ChatPlatform, ConversationFull, ConversationMessage, ConversationMeta } from '@/types';
import { onUrlChange } from '@/utils/dom';
import {
  getChatGptAccessToken,
  fetchChatGptConversationList,
  fetchChatGptConversationContent,
} from '@/services/chatgpt-session-api';
import {
  getClaudeOrganizationId,
  fetchClaudeConversationList,
  fetchClaudeConversationContent,
} from '@/services/claude-session-api';
import {
  extractGeminiConversationListFromDom,
  extractGeminiCurrentConversationContent,
  getGeminiCurrentConversationId,
} from '@/services/gemini-session-api';

// Number of the most-recent conversations for which full message content is
// eagerly fetched on each sync. Kept small (10) to avoid hammering the
// platform APIs on page load — the dashboard can lazy-load older conversations
// on demand via the FETCH_CONVERSATION_FOR_SYNC message.
const RECENT_CONTENT_BATCH = 10;

// Minimum pause between successive content-fetch requests within a batch.
// Prevents triggering platform-side rate limiting (ChatGPT / Claude impose
// per-second request quotas on their session APIs).
const BATCH_DELAY_MS = 500;

// How long to wait after the Gemini page loads before reading the conversation
// list from the DOM. Gemini is a heavy Angular SPA — the sidebar needs time to
// complete its initial render before the conversation elements are present.
const GEMINI_SIDEBAR_SETTLE_MS = 2000;

// Delay before triggering the initial full conversation-list sync on page load.
// Allows the platform's own scripts (auth, session restore, SPA bootstrap) to
// finish so that session cookies / access tokens are available when we call the
// session APIs.
const INITIAL_SYNC_DELAY_MS = 2000;

// How long to wait after a SPA URL change before syncing the newly-opened
// conversation. The conversation component needs time to mount and fetch its
// messages from the platform backend before our extractor can read the DOM.
const SPA_NAV_SYNC_DELAY_MS = 3000;

function detectPlatform(): ChatPlatform | null {
  const h = location.hostname;
  if (h.includes('chatgpt.com') || h.includes('chat.openai.com')) return 'chatgpt';
  if (h.includes('claude.ai')) return 'claude';
  if (h.includes('gemini.google.com')) return 'gemini';
  return null;
}

function getConversationIdFromUrl(platform: ChatPlatform, url: string): string | null {
  try {
    const path = new URL(url).pathname;
    if (platform === 'chatgpt') {
      const m = path.match(/^\/c\/([a-zA-Z0-9_-]+)/);
      return m ? m[1] : null;
    }
    if (platform === 'claude') {
      const m = path.match(/^\/chat\/([a-zA-Z0-9_-]+)/);
      return m ? m[1] : null;
    }
    if (platform === 'gemini') {
      const m = path.match(/^\/app\/([a-zA-Z0-9_-]+)/);
      return m ? m[1] : null;
    }
  } catch {
    // Ignore invalid URLs
  }
  return null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendToBackground(type: string, data: Record<string, unknown>): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type, ...data });
  } catch {
    // Extension may be reloading — ignore
  }
}

// ── Per-platform list fetchers ─────────────────────────────────────────────

async function fetchChatGptList(): Promise<{ conversations: ConversationMeta[]; token: string | null }> {
  const token = await getChatGptAccessToken();
  if (!token) return { conversations: [], token: null };
  const conversations = await fetchChatGptConversationList(token);
  return { conversations, token };
}

async function fetchClaudeList(): Promise<{ conversations: ConversationMeta[]; orgId: string | null }> {
  const orgId = await getClaudeOrganizationId();
  if (!orgId) return { conversations: [], orgId: null };
  const conversations = await fetchClaudeConversationList(orgId);
  return { conversations, orgId };
}

// ── Per-platform content fetchers ─────────────────────────────────────────

async function fetchContentForConversation(
  platform: ChatPlatform,
  meta: ConversationMeta,
  context: { token?: string | null; orgId?: string | null },
): Promise<ConversationFull | null> {
  try {
    let messages: ConversationMessage[] = [];
    if (platform === 'chatgpt' && context.token) {
      messages = await fetchChatGptConversationContent(context.token, meta.id);
    } else if (platform === 'claude' && context.orgId) {
      messages = await fetchClaudeConversationContent(context.orgId, meta.id);
    } else if (platform === 'gemini') {
      // For Gemini, only extract content for the currently viewed conversation
      const currentId = getGeminiCurrentConversationId();
      if (currentId !== meta.id) return null;
      messages = extractGeminiCurrentConversationContent();
    }
    if (messages.length === 0) return null;
    return { meta: { ...meta, messageCount: messages.length }, messages, fetchedAt: Date.now() };
  } catch {
    return null;
  }
}

// ── Main sync functions ────────────────────────────────────────────────────

async function syncConversationList(platform: ChatPlatform): Promise<void> {
  try {
    let conversations: ConversationMeta[] = [];
    const context: { token?: string | null; orgId?: string | null } = {};

    if (platform === 'chatgpt') {
      const result = await fetchChatGptList();
      conversations = result.conversations;
      context.token = result.token;
    } else if (platform === 'claude') {
      const result = await fetchClaudeList();
      conversations = result.conversations;
      context.orgId = result.orgId;
    } else if (platform === 'gemini') {
      // Wait for sidebar to render
      await delay(GEMINI_SIDEBAR_SETTLE_MS);
      conversations = extractGeminiConversationListFromDom();
    }

    if (conversations.length === 0) return;

    // Send metadata list to background
    await sendToBackground('SYNC_CHAT_CONVERSATIONS', { platform, conversations });

    // Batch-fetch content for the most recent conversations
    const recent = conversations.slice(0, RECENT_CONTENT_BATCH);
    for (const meta of recent) {
      const full = await fetchContentForConversation(platform, meta, context);
      if (full) {
        await sendToBackground('SYNC_CHAT_CONVERSATION_CONTENT', { conversation: full });
      }
      await delay(BATCH_DELAY_MS);
    }

    // Update sync meta
    await sendToBackground('UPDATE_CHAT_SYNC_META', {
      platform,
      lastSyncedAt: Date.now(),
      conversationCount: conversations.length,
    });
  } catch (err) {
    await sendToBackground('UPDATE_CHAT_SYNC_META', {
      platform,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function syncCurrentConversation(platform: ChatPlatform, url: string): Promise<void> {
  const id = getConversationIdFromUrl(platform, url);
  if (!id) return;

  try {
    const context: { token?: string | null; orgId?: string | null } = {};
    let metaStub: ConversationMeta | null = null;

    if (platform === 'chatgpt') {
      const token = await getChatGptAccessToken();
      context.token = token;
      if (!token) return;
      metaStub = {
        id, platform, title: document.title || 'Untitled',
        createdAt: Date.now(), updatedAt: Date.now(),
        url, lastSyncedAt: Date.now(),
      };
    } else if (platform === 'claude') {
      const orgId = await getClaudeOrganizationId();
      context.orgId = orgId;
      if (!orgId) return;
      metaStub = {
        id, platform, title: document.title || 'Untitled',
        createdAt: Date.now(), updatedAt: Date.now(),
        url, lastSyncedAt: Date.now(),
      };
    } else if (platform === 'gemini') {
      metaStub = {
        id, platform, title: document.title || 'Untitled',
        createdAt: Date.now(), updatedAt: Date.now(),
        url, lastSyncedAt: Date.now(),
      };
    }

    if (!metaStub) return;

    const full = await fetchContentForConversation(platform, metaStub, context);
    if (!full) return;

    await sendToBackground('SYNC_CHAT_CONVERSATIONS', { platform, conversations: [metaStub] });
    await sendToBackground('SYNC_CHAT_CONVERSATION_CONTENT', { conversation: full });
  } catch {
    // Silent — current conversation sync is best-effort
  }
}

// ── On-demand fetch handler (for dashboard lazy loading) ──────────────────

function registerFetchOnDemandListener(platform: ChatPlatform): void {
  chrome.runtime.onMessage.addListener(
    (message: unknown, _sender, sendResponse: (r: unknown) => void) => {
      if (
        typeof message !== 'object' || message === null ||
        (message as { type?: string }).type !== 'FETCH_CONVERSATION_FOR_SYNC'
      ) {
        return undefined;
      }

      const { id } = message as { type: string; id: string };

      (async () => {
        const context: { token?: string | null; orgId?: string | null } = {};
        const metaStub: ConversationMeta = {
          id, platform, title: document.title || 'Untitled',
          createdAt: Date.now(), updatedAt: Date.now(),
          url: location.href, lastSyncedAt: Date.now(),
        };

        if (platform === 'chatgpt') {
          context.token = await getChatGptAccessToken();
        } else if (platform === 'claude') {
          context.orgId = await getClaudeOrganizationId();
        }

        const full = await fetchContentForConversation(platform, metaStub, context);
        if (full) {
          return { ok: true, conversation: full };
        }
        return { ok: false, error: 'Could not fetch conversation content' };
      })()
        .then((result) => sendResponse(result))
        .catch((err: unknown) =>
          sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
        );

      return true; // Keep channel open for async response
    },
  );
}

// ── Entry point ────────────────────────────────────────────────────────────

/**
 * Sets up automatic chat session syncing for the current platform.
 * Called from the content script on ChatGPT, Claude, and Gemini.
 */
export function setupChatHistorySync(): void {
  const platform = detectPlatform();
  if (!platform) return;

  // Register on-demand fetch listener for dashboard lazy loading
  registerFetchOnDemandListener(platform);

  // Sync conversation list after page initializes
  setTimeout(() => void syncConversationList(platform), INITIAL_SYNC_DELAY_MS);

  // Watch for SPA navigation to new conversations
  onUrlChange((url) => {
    const id = getConversationIdFromUrl(platform, url);
    if (id) {
      // Wait for conversation to fully render
      setTimeout(() => void syncCurrentConversation(platform, url), SPA_NAV_SYNC_DELAY_MS);
    }
  });
}
