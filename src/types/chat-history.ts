/**
 * @module chat-history
 * @description Type definitions and the single source of truth for the chat history manual save feature. Owns the ChatPlatform union, the CHAT_PLATFORMS registry (display metadata + URL matchers per platform), and the helpers consumed by the background handler, content script save handler, and UI views so adding a new LLM site is one entry in this file.
 * @dependencies none
 * @public ChatPlatform, ChatPlatformInfo, CHAT_PLATFORMS, getPlatformFromUrl, extractConversationId, isConversationUrl, ConversationMeta, ConversationMessage, ConversationFull
 */

/**
 * Which LLM platform a saved conversation belongs to.
 *
 * To add a new platform: add the key here AND a matching entry to
 * CHAT_PLATFORMS below. Everything else (background URL matcher, content
 * script platform detection, sidebar + dashboard UI, platform filter
 * chips, badge dots) reads from this registry.
 */
export type ChatPlatform = 'chatgpt' | 'claude' | 'gemini' | 'perplexity' | 'copilot' | 'deepseek' | 'mistral' | 'grok';

/** Display + URL-matching metadata for one chat platform. */
export interface ChatPlatformInfo {
  /** Full display name shown in lists, filter chips, and badges. */
  label: string;
  /** Short badge text (1–3 chars) shown in the sidebar's circular avatar. */
  letter: string;
  /** Platform brand colour as an oklch() value. */
  color: string;
  /** Tested against `new URL(url).hostname`. */
  hostnamePattern: RegExp;
  /**
   * Tested against `new URL(url).pathname`. Capture group 1 must be the
   * conversation ID. Used both to detect that the user is on a specific
   * conversation page (vs. the home/new-chat view) and to extract the
   * stable ID under which the conversation is stored.
   */
  conversationPath: RegExp;
}

export const CHAT_PLATFORMS: Record<ChatPlatform, ChatPlatformInfo> = {
  chatgpt: {
    label: 'ChatGPT',
    letter: 'G',
    color: 'oklch(0.65 0.15 160)',
    hostnamePattern: /^(www\.)?(chatgpt\.com|chat\.openai\.com)$/i,
    conversationPath: /^\/c\/([a-z0-9-]+)/i,
  },
  claude: {
    label: 'Claude',
    letter: 'C',
    color: 'oklch(0.62 0.16 35)',
    hostnamePattern: /^(www\.)?claude\.ai$/i,
    conversationPath: /^\/chat\/([a-z0-9-]+)/i,
  },
  gemini: {
    label: 'Gemini',
    letter: 'Gem',
    color: 'oklch(0.62 0.18 270)',
    hostnamePattern: /^gemini\.google\.com$/i,
    conversationPath: /^\/app\/([a-z0-9]+)/i,
  },
  perplexity: {
    label: 'Perplexity',
    letter: 'P',
    color: 'oklch(0.65 0.13 200)',
    hostnamePattern: /^(www\.)?perplexity\.ai$/i,
    conversationPath: /^\/search\/([a-z0-9-]+)/i,
  },
  copilot: {
    label: 'Copilot',
    letter: 'Co',
    color: 'oklch(0.62 0.18 240)',
    hostnamePattern: /^copilot\.microsoft\.com$/i,
    // Conversation IDs are mixed-case alphanumeric (e.g. /chats/M6nK2D8DgBu3VU5pKwkth)
    conversationPath: /^\/chats\/([A-Za-z0-9_-]+)/,
  },
  deepseek: {
    label: 'DeepSeek',
    letter: 'Ds',
    color: 'oklch(0.6 0.2 265)',
    hostnamePattern: /^chat\.deepseek\.com$/i,
    // Conversation paths look like /a/chat/s/{uuid}
    conversationPath: /^\/a\/chat\/s\/([a-z0-9-]+)/i,
  },
  mistral: {
    label: 'Mistral',
    letter: 'M',
    color: 'oklch(0.65 0.2 35)',
    hostnamePattern: /^chat\.mistral\.ai$/i,
    // Conversation paths look like /chat/{uuid}
    conversationPath: /^\/chat\/([a-z0-9-]+)/i,
  },
  grok: {
    label: 'Grok',
    letter: 'Gk',
    color: 'oklch(0.35 0.02 270)',
    hostnamePattern: /^(www\.)?grok\.com$/i,
    // Conversation paths look like /c/{uuid}
    conversationPath: /^\/c\/([a-z0-9-]+)/i,
  },
};

/** All registered platforms, in insertion order — used by UI filter rows. */
export const CHAT_PLATFORM_KEYS = Object.keys(CHAT_PLATFORMS) as ChatPlatform[];

/**
 * Returns the platform that owns this URL, or null if the URL is not on
 * any registered LLM site. Invalid URLs return null rather than throwing.
 */
export function getPlatformFromUrl(url: string): ChatPlatform | null {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return null;
  }
  for (const key of CHAT_PLATFORM_KEYS) {
    if (CHAT_PLATFORMS[key].hostnamePattern.test(hostname)) return key;
  }
  return null;
}

/**
 * Extracts the platform-specific conversation ID from a URL. Falls back to
 * a timestamp string when the URL is the platform's home/new-chat view —
 * matches the prior behaviour so callers that store unsaved drafts keep a
 * stable-ish key.
 */
export function extractConversationId(platform: ChatPlatform, url: string): string {
  try {
    const { pathname } = new URL(url);
    return CHAT_PLATFORMS[platform].conversationPath.exec(pathname)?.[1] ?? String(Date.now());
  } catch {
    return String(Date.now());
  }
}

/** True iff the URL points to a specific conversation, not the home page. */
export function isConversationUrl(platform: ChatPlatform, url: string): boolean {
  try {
    return CHAT_PLATFORMS[platform].conversationPath.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

/** Lightweight conversation metadata stored in the list index. */
export interface ConversationMeta {
  id: string;
  platform: ChatPlatform;
  title: string;
  createdAt: number;       // Unix ms
  updatedAt: number;       // Unix ms
  messageCount?: number;
  /** Direct link to open the conversation in the originating site. */
  url: string;
  lastSyncedAt: number;
}

/** A single turn within a conversation. */
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: number;      // Unix ms, if available
}

/** Full conversation including all messages. */
export interface ConversationFull {
  meta: ConversationMeta;
  messages: ConversationMessage[];
  fetchedAt: number;
}
