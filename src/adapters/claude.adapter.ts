/**
 * @module claude.adapter
 * @description Implements ChatSiteAdapter for claude.ai. Extracts messages from data-testid="user-message" and data-is-streaming elements in a single DOM pass to preserve turn order.
 * @dependencies adapter.interface, types
 * @public ClaudeAdapter
 */
import type { ChatSiteAdapter } from './adapter.interface';
import type { ChatMessage } from '@/types';

export class ClaudeAdapter implements ChatSiteAdapter {
  readonly hostnames = ['claude.ai'] as const;

  extractMessages(): ChatMessage[] {
    // Query both turn types in a single pass to preserve DOM order.
    // User turns:  [data-testid="user-message"]  — text in p.whitespace-pre-wrap
    // AI turns:    [data-is-streaming]            — text in .font-claude-response
    const turnElements = Array.from(
      document.querySelectorAll<HTMLElement>('[data-testid="user-message"], [data-is-streaming]'),
    );

    return turnElements.reduce<ChatMessage[]>((acc, el) => {
      const isUser = el.getAttribute('data-testid') === 'user-message';
      const role: 'user' | 'assistant' = isUser ? 'user' : 'assistant';
      const content = isUser
        ? (el.querySelector('p.whitespace-pre-wrap')?.textContent?.trim() ?? el.textContent?.trim() ?? '')
        : (el.querySelector('.font-claude-response')?.textContent?.trim() ?? el.textContent?.trim() ?? '');
      if (content) acc.push({ role, content });
      return acc;
    }, []);
  }
}
