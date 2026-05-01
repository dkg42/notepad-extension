/**
 * @module chatgpt.adapter
 * @description Implements ChatSiteAdapter for chatgpt.com and chat.openai.com. Locates the sticky main-area header (explicitly scoped to <main> to avoid the sidebar), and extracts messages via the data-message-author-role attribute pattern used by ChatGPT's React-rendered DOM.
 * @dependencies adapter.interface, types
 * @public ChatGPTAdapter
 */
import type { ChatSiteAdapter } from './adapter.interface';
import type { ChatMessage } from '@/types';

export class ChatGPTAdapter implements ChatSiteAdapter {
  readonly hostnames = ['chatgpt.com', 'chat.openai.com'] as const;

  findHeaderAnchor(): Element | null {
    // Scope to `main` to avoid matching the sidebar's sticky header,
    // which also uses "sticky top-0" and appears earlier in the DOM.
    return (
      document.querySelector('main div[class*="sticky top-0"]') ??
      document.querySelector('main header') ??
      document.querySelector('header:not(nav header)') ??
      null
    );
  }

  extractMessages(): ChatMessage[] {
    const messages: ChatMessage[] = [];

    document.querySelectorAll<HTMLElement>('[data-message-author-role]').forEach((el) => {
      const role = el.getAttribute('data-message-author-role');
      if (role !== 'user' && role !== 'assistant') return;

      // Try the markdown prose container first, fall back to the element's own text
      const content =
        el.querySelector('.whitespace-pre-wrap')?.textContent?.trim() ??
        el.textContent?.trim() ??
        '';

      if (content) messages.push({ role, content });
    });

    return messages;
  }

  extractPrompts(): string[] {
    return this.extractMessages()
      .filter((m) => m.role === 'user')
      .map((m) => m.content);
  }
}
