/**
 * @module gemini.adapter
 * @description Implements ChatSiteAdapter for gemini.google.com. Walks .conversation-container elements to pair user-query and model-response nodes, reconstructing conversation order from the DOM.
 * @dependencies adapter.interface, types
 * @public GeminiAdapter
 */
import type { ChatSiteAdapter } from './adapter.interface';
import type { ChatMessage } from '@/types';

export class GeminiAdapter implements ChatSiteAdapter {
  readonly hostnames = ['gemini.google.com'] as const;

  extractMessages(): ChatMessage[] {
    const messages: ChatMessage[] = [];

    // Each turn is wrapped in .conversation-container with a user-query and model-response child.
    // User text:      user-query .query-text            (div.query-text gds-body-l query-text-animated)
    // Assistant text: model-response .markdown          (div.markdown.markdown-main-panel)
    document.querySelectorAll<HTMLElement>('.conversation-container').forEach((turn) => {
      const userEl = turn.querySelector<HTMLElement>('user-query .query-text');
      const assistantEl = turn.querySelector<HTMLElement>('model-response .markdown');

      const userText = userEl?.textContent?.trim() ?? '';
      const assistantText = assistantEl?.textContent?.trim() ?? '';

      if (userText) messages.push({ role: 'user', content: userText });
      if (assistantText) messages.push({ role: 'assistant', content: assistantText });
    });

    return messages;
  }
}
