import type { ChatMessage } from '@/types';

export interface ChatSiteAdapter {
  /** Hostname substrings this adapter handles (e.g. ['chatgpt.com', 'chat.openai.com']) */
  readonly hostnames: readonly string[];

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
