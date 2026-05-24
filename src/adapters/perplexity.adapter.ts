/**
 * @module perplexity.adapter
 * @description Implements ChatSiteAdapter for perplexity.ai. Extracts messages by walking h1.group/query elements (user prompts) and [id^="markdown-content-"] containers (assistant answers) in DOM order, stripping inline citation chips so chip labels do not leak into the exported transcript.
 * @dependencies adapter.interface, types
 * @public PerplexityAdapter
 */
import type { ChatSiteAdapter } from './adapter.interface';
import type { ChatMessage } from '@/types';

export class PerplexityAdapter implements ChatSiteAdapter {
  readonly hostnames = ['perplexity.ai'] as const;

  extractMessages(): ChatMessage[] {
    // User turns:      <h1 class="group/query ...">  → prompt text
    // Assistant turns: <div id="markdown-content-N"> → rendered markdown answer
    // Both selectors are queried together so the resulting NodeList is in
    // document order, preserving turn sequence for multi-turn threads.
    const turnElements = Array.from(
      document.querySelectorAll<HTMLElement>(
        'h1[class*="group/query"], [id^="markdown-content-"]',
      ),
    );

    return turnElements.reduce<ChatMessage[]>((acc, el) => {
      const isUser = el.tagName === 'H1';
      const role: 'user' | 'assistant' = isUser ? 'user' : 'assistant';
      const content = isUser
        ? (el.textContent?.trim() ?? '')
        : this.extractAssistantText(el);
      if (content) acc.push({ role, content });
      return acc;
    }, []);
  }

  // Inline citation chips render as span[class*="group/trigger"] wrappers
  // containing source-domain labels (e.g. "deepsilver+1"). Stripping them
  // from a clone before reading textContent keeps the source DOM untouched
  // while removing chip noise from the exported transcript.
  private extractAssistantText(el: HTMLElement): string {
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('[class*="group/trigger"]').forEach((n) => n.remove());
    return clone.textContent?.trim() ?? '';
  }
}
