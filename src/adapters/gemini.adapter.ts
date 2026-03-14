import type { ChatSiteAdapter } from './adapter.interface';
import type { ChatMessage } from '@/types';

export class GeminiAdapter implements ChatSiteAdapter {
  readonly hostnames = ['gemini.google.com'] as const;

  findHeaderAnchor(): Element | null {
    // Gemini uses Angular Material — the top toolbar
    return (
      document.querySelector('mat-toolbar') ??
      document.querySelector('.top-app-bar') ??
      document.querySelector('header') ??
      null
    );
  }

  extractMessages(): ChatMessage[] {
    const messages: ChatMessage[] = [];

    document.querySelectorAll<HTMLElement>('.conversation-turn').forEach((turn) => {
      const queryEl = turn.querySelector<HTMLElement>('.query-text');
      const responseEl = turn.querySelector<HTMLElement>('.model-response-text');

      if (queryEl?.textContent?.trim()) {
        messages.push({ role: 'user', content: queryEl.textContent.trim() });
      }
      if (responseEl?.textContent?.trim()) {
        messages.push({ role: 'assistant', content: responseEl.textContent.trim() });
      }
    });

    // Fallback: try user-query-bubble and model-response selectors
    if (messages.length === 0) {
      document.querySelectorAll<HTMLElement>('user-query-bubble').forEach((el) => {
        const content = el.textContent?.trim() ?? '';
        if (content) messages.push({ role: 'user', content });
      });
      document.querySelectorAll<HTMLElement>('model-response').forEach((el) => {
        const content = el.querySelector('.markdown')?.textContent?.trim() ?? el.textContent?.trim() ?? '';
        if (content) messages.push({ role: 'assistant', content });
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
