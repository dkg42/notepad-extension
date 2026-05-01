/**
 * @module chat-history
 * @description Type definitions for the chat history sync feature, covering the three supported LLM platforms (ChatGPT, Claude, Gemini), lightweight conversation metadata for list views, full message content for detail views, and per-platform sync status tracking.
 * @dependencies none
 * @public ChatPlatform, ConversationMeta, ConversationMessage, ConversationFull, ChatSyncMeta
 */
/** Which LLM platform a synced conversation belongs to. */
export type ChatPlatform = 'chatgpt' | 'claude' | 'gemini';

/** Lightweight conversation metadata — synced on page load. */
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
  createdAt?: number;      // Unix ms, if available from API
}

/** Full conversation including all messages. */
export interface ConversationFull {
  meta: ConversationMeta;
  messages: ConversationMessage[];
  fetchedAt: number;
}

/** Sync status for a single platform. */
export interface ChatSyncMeta {
  platform: ChatPlatform;
  lastSyncedAt: number;
  error?: string;
  conversationCount: number;
}
