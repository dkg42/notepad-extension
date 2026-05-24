/**
 * @module copilot.adapter
 * @description Implements ChatSiteAdapter for copilot.microsoft.com. Extracts messages by walking [data-content="user-message"] and [data-content="ai-message"] elements in DOM order — the stable data-attribute hooks Copilot's own SPA uses to identify turns. Assistant text is read from a clone with every [data-copy="false"] descendant removed, which is Copilot's native convention for marking inline citation chips, the citation cards row, action buttons, and other in-message chrome.
 * @dependencies adapter.interface, types
 * @public CopilotAdapter
 */
import type { ChatSiteAdapter } from './adapter.interface';
import type { ChatMessage } from '@/types';

export class CopilotAdapter implements ChatSiteAdapter {
  readonly hostnames = ['copilot.microsoft.com'] as const;

  extractMessages(): ChatMessage[] {
    // Querying both selectors together preserves DOM order across turns.
    const turnElements = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-content="user-message"], [data-content="ai-message"]',
      ),
    );

    return turnElements.reduce<ChatMessage[]>((acc, el) => {
      const isUser = el.getAttribute('data-content') === 'user-message';
      const role: 'user' | 'assistant' = isUser ? 'user' : 'assistant';
      const content = isUser
        ? (el.textContent?.trim() ?? '')
        : this.extractAssistantText(el);
      if (content) acc.push({ role, content });
      return acc;
    }, []);
  }

  // Copilot marks all in-message UI chrome (citation chips, citation cards row,
  // action buttons, image carousels, etc.) with data-copy="false". Removing
  // those from a clone before reading textContent yields just the response body.
  private extractAssistantText(el: HTMLElement): string {
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('[data-copy="false"]').forEach((n) => n.remove());
    return clone.textContent?.trim() ?? '';
  }
}
