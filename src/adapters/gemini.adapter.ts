import type { ChatSiteAdapter } from './adapter.interface';
import type { ChatMessage } from '@/types';

export class GeminiAdapter implements ChatSiteAdapter {
  readonly hostnames = ['gemini.google.com'] as const;

  findHeaderAnchor(): Element | null {
    return (
      document.querySelector('.top-bar-actions .right-section') ??
      document.querySelector('.top-bar-actions') ??
      null
    );
  }

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

  extractPrompts(): string[] {
    return this.extractMessages()
      .filter((m) => m.role === 'user')
      .map((m) => m.content);
  }
}
