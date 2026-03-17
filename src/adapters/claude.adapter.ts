import type { ChatSiteAdapter } from './adapter.interface';
import type { ChatMessage } from '@/types';

export class ClaudeAdapter implements ChatSiteAdapter {
  readonly hostnames = ['claude.ai'] as const;

  findHeaderAnchor(): Element | null {
    // The Share button lives *outside* the <header> element but is absolutely
    // positioned (md:absolute right-0 top-0 z-20) so it visually overlaps the
    // header's right edge. Injecting into the header root or the right-side slot
    // still collides with it.
    //
    // Instead we inject into the flex-1 title div (first child of the inner flex
    // row). That div has pr-[100px] which reserves 100 px of right padding as a
    // safe zone for the Share button. Our container uses margin-left:auto so it
    // right-aligns within the title div's content box — visually adjacent to the
    // Share button but never behind it.
    const header = document.querySelector<HTMLElement>('header[data-testid="page-header"]');
    if (header) {
      // Skip the first child (gradient overlay, position:absolute) and grab the
      // actual flex row which carries the justify-between layout.
      const innerRow = header.querySelector<HTMLElement>(':scope > div.flex.w-full');
      const titleDiv = innerRow?.querySelector<HTMLElement>(':scope > div:first-child');
      if (titleDiv) return titleDiv;
      return header;
    }
    return document.querySelector('[class*="sticky top-0"]') ?? null;
  }

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

  extractPrompts(): string[] {
    return this.extractMessages()
      .filter((m) => m.role === 'user')
      .map((m) => m.content);
  }
}
