/**
 * @module chat-history
 * @description Type definitions for the chat history manual save feature, covering the three supported LLM platforms (ChatGPT, Claude, Gemini), lightweight conversation metadata for list views, and full message content for detail views.
 * @dependencies none
 * @public ChatPlatform, ConversationMeta, ConversationMessage, ConversationFull
 */
/** Which LLM platform a saved conversation belongs to. */
export type ChatPlatform = 'chatgpt' | 'claude' | 'gemini';

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
