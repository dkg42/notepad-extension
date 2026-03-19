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
