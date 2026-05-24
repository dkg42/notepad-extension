/**
 * @module grok.adapter
 * @description Implements ChatSiteAdapter for grok.com. Walks elements carrying data-testid="user-message" or data-testid="assistant-message" — the stable hooks Grok exposes on each turn container. Assistant text is read from a clone with the .thinking-container removed (the "Thought for Xs" reasoning preview rendered above the actual response is UI chrome, not the answer the user wants saved).
 * @dependencies adapter.interface, types
 * @public GrokAdapter
 */
import type { ChatSiteAdapter } from './adapter.interface';
import type { ChatMessage } from '@/types';

export class GrokAdapter implements ChatSiteAdapter {
  readonly hostnames = ['grok.com'] as const;

  extractMessages(): ChatMessage[] {
    const turns = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-testid="user-message"], [data-testid="assistant-message"]',
      ),
    );

    return turns.reduce<ChatMessage[]>((acc, el) => {
      const isUser = el.getAttribute('data-testid') === 'user-message';
      const role: 'user' | 'assistant' = isUser ? 'user' : 'assistant';
      const content = isUser
        ? (el.textContent?.trim() ?? '')
        : this.extractAssistantText(el);
      if (content) acc.push({ role, content });
      return acc;
    }, []);
  }

  // Grok renders a collapsible "Thought for Xs" reasoning preview as a sibling of
  // the answer markdown inside the assistant message. Removing .thinking-container
  // from a clone yields just the response body.
  private extractAssistantText(el: HTMLElement): string {
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.thinking-container').forEach((n) => n.remove());
    return clone.textContent?.trim() ?? '';
  }
}
