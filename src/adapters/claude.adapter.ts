import type { ChatSiteAdapter } from './adapter.interface';
import type { ChatMessage } from '@/types';

export class ClaudeAdapter implements ChatSiteAdapter {
  readonly hostnames = ['claude.ai'] as const;

  findHeaderAnchor(): Element | null {
    // Top navigation bar with the conversation title
    return (
      document.querySelector('header') ??
      document.querySelector('[class*="sticky top-0"]') ??
      null
    );
  }

  extractMessages(): ChatMessage[] {
    const messages: ChatMessage[] = [];

    // Human turns
    document.querySelectorAll<HTMLElement>('[data-testid="human-turn"]').forEach((el) => {
      const content =
        el.querySelector('.whitespace-pre-wrap')?.textContent?.trim() ??
        el.textContent?.trim() ??
        '';
      if (content) messages.push({ role: 'user', content });
    });

    // AI turns — collect separately to maintain turn order
    const turns: Array<{ role: 'user' | 'assistant'; content: string; index: number }> = [];

    document.querySelectorAll<HTMLElement>('[data-testid="human-turn"]').forEach((el, i) => {
      const content = el.querySelector('.whitespace-pre-wrap')?.textContent?.trim() ?? el.textContent?.trim() ?? '';
      if (content) turns.push({ role: 'user', content, index: i });
    });

    document.querySelectorAll<HTMLElement>('[data-testid="ai-turn"]').forEach((el, i) => {
      const content = el.querySelector('.whitespace-pre-wrap')?.textContent?.trim() ?? el.textContent?.trim() ?? '';
      if (content) turns.push({ role: 'assistant', content, index: i });
    });

    // Sort by DOM position
    const allTurnElements = Array.from(
      document.querySelectorAll('[data-testid="human-turn"], [data-testid="ai-turn"]'),
    );

    return allTurnElements.reduce<ChatMessage[]>((acc, el) => {
      const role = el.getAttribute('data-testid') === 'human-turn' ? 'user' : 'assistant';
      const content =
        el.querySelector('.whitespace-pre-wrap')?.textContent?.trim() ??
        el.textContent?.trim() ??
        '';
      if (content) acc.push({ role, content });
      return acc;
    }, []);
  }

  extractPrompts(): string[] {
    return this.extractMessages()
      .filter((m) => m.role === 'user')
      .map((m) => m.content);
  }
}
