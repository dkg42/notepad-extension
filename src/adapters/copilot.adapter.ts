/**
 * @module copilot.adapter
 * @description Implements ChatSiteAdapter for copilot.microsoft.com. Targets the .cib-header element for injection and extracts messages by walking .cib-chat-turn containers, querying the .cib-chat-message-user and .cib-chat-message-bot children used by Microsoft's Copilot web shell.
 * @dependencies adapter.interface, types
 * @public CopilotAdapter
 */
import type { ChatSiteAdapter } from './adapter.interface';
import type { ChatMessage } from '@/types';

export class CopilotAdapter implements ChatSiteAdapter {
  readonly hostnames = ['copilot.microsoft.com'] as const;

  findHeaderAnchor(): Element | null {
    return (
      document.querySelector('.cib-header') ??
      document.querySelector('header') ??
      document.querySelector('[class*="sticky top-0"]') ??
      null
    );
  }

  extractMessages(): ChatMessage[] {
    const messages: ChatMessage[] = [];

    document.querySelectorAll<HTMLElement>('.cib-chat-turn').forEach((turn) => {
      const userEl = turn.querySelector<HTMLElement>('.cib-chat-message-user');
      const botEl = turn.querySelector<HTMLElement>('.cib-chat-message-bot');

      if (userEl?.textContent?.trim()) {
        messages.push({ role: 'user', content: userEl.textContent.trim() });
      }
      if (botEl?.textContent?.trim()) {
        messages.push({ role: 'assistant', content: botEl.textContent.trim() });
      }
    });

    return messages;
  }

  extractPrompts(): string[] {
    return this.extractMessages()
      .filter((m) => m.role === 'user')
      .map((m) => m.content);
  }
}
