/**
 * @module adapter.interface
 * @description Defines the ChatSiteAdapter contract that every LLM chat-site adapter must fulfil. It extends SiteAdapter with chat-specific capability — extracting the full conversation messages from the current page — keeping each site's DOM logic isolated from the rest of the extension.
 * @dependencies site-adapter.interface, types
 * @public ChatSiteAdapter
 */
import type { ChatMessage } from '@/types';
import type { SiteAdapter } from './site-adapter.interface';

export interface ChatSiteAdapter extends SiteAdapter {
  /** Extracts every message (user + assistant) from the current chat session. */
  extractMessages(): ChatMessage[];
}
