/**
 * @module adapter.interface
 * @description Defines the ChatSiteAdapter contract that every LLM chat-site adapter must fulfil. It extends SiteAdapter with chat-specific capabilities — finding the header injection anchor, extracting full conversation messages, and extracting user prompts only — keeping each site's DOM logic isolated from the rest of the extension.
 * @dependencies site-adapter.interface, types
 * @public ChatSiteAdapter
 */
import type { ChatMessage } from '@/types';
import type { SiteAdapter } from './site-adapter.interface';

export interface ChatSiteAdapter extends SiteAdapter {

  /**
   * Returns the DOM element to append the export button group to.
   * Returns null if the header has not rendered yet.
   */
  findHeaderAnchor(): Element | null;

  /** Extracts every message (user + assistant) from the current chat session. */
  extractMessages(): ChatMessage[];

  /** Extracts only the user's prompts from the current chat session. */
  extractPrompts(): string[];
}
