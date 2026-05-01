/**
 * @module perplexity.adapter
 * @description Implements ChatSiteAdapter for perplexity.ai. Extracts messages via data-testid conversation-turn selectors and includes a broad .break-words fallback for cases where the primary selectors yield no results, reflecting Perplexity's less stable DOM structure.
 * @dependencies adapter.interface, types
 * @public PerplexityAdapter
 */
import type { ChatSiteAdapter } from './adapter.interface';
import type { ChatMessage } from '@/types';

export class PerplexityAdapter implements ChatSiteAdapter {
  readonly hostnames = ['perplexity.ai'] as const;

  findHeaderAnchor(): Element | null {
    return (
      document.querySelector('header') ??
      document.querySelector('[class*="sticky top-0"]') ??
      null
    );
  }

  extractMessages(): ChatMessage[] {
    const messages: ChatMessage[] = [];

    // Each conversation block has a user query followed by an answer
    document.querySelectorAll<HTMLElement>('[data-testid="conversation-turn"]').forEach((turn) => {
      const queryEl = turn.querySelector<HTMLElement>('[data-testid="user-query"]');
      const answerEl = turn.querySelector<HTMLElement>('[data-testid="answer-text"]');

      if (queryEl?.textContent?.trim()) {
        messages.push({ role: 'user', content: queryEl.textContent.trim() });
      }
      if (answerEl?.textContent?.trim()) {
        messages.push({ role: 'assistant', content: answerEl.textContent.trim() });
      }
    });

    // Fallback: broad text content selectors
    if (messages.length === 0) {
      document.querySelectorAll<HTMLElement>('.break-words').forEach((el) => {
        const content = el.textContent?.trim() ?? '';
        if (content.length > 10) messages.push({ role: 'user', content });
      });
    }

    return messages;
  }

  extractPrompts(): string[] {
    return this.extractMessages()
      .filter((m) => m.role === 'user')
      .map((m) => m.content);
  }
}
