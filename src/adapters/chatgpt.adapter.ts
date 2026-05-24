/**
 * @module chatgpt.adapter
 * @description Implements ChatSiteAdapter for chatgpt.com and chat.openai.com. Extracts messages via the data-message-author-role attribute pattern used by ChatGPT's React-rendered DOM.
 * @dependencies adapter.interface, types
 * @public ChatGPTAdapter
 */
import type { ChatSiteAdapter } from './adapter.interface';
import type { ChatMessage } from '@/types';

export class ChatGPTAdapter implements ChatSiteAdapter {
  readonly hostnames = ['chatgpt.com', 'chat.openai.com'] as const;

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
}
