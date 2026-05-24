/**
 * @module mistral.adapter
 * @description Implements ChatSiteAdapter for chat.mistral.ai (Le Chat). Walks elements carrying data-message-author-role, which Le Chat sets to "user" or "assistant" on each turn container. The assistant body lives inside [data-message-part-type="answer"] and inline citation chips are wrapped in [data-exclude-copy="true"] — exactly the convention Le Chat's own copy-to-clipboard uses — so a clone with those nodes removed yields just the response prose.
 * @dependencies adapter.interface, types
 * @public MistralAdapter
 */
import type { ChatSiteAdapter } from './adapter.interface';
import type { ChatMessage } from '@/types';

export class MistralAdapter implements ChatSiteAdapter {
  readonly hostnames = ['chat.mistral.ai'] as const;

  extractMessages(): ChatMessage[] {
    const turns = Array.from(
      document.querySelectorAll<HTMLElement>('[data-message-author-role]'),
    );

    return turns.reduce<ChatMessage[]>((acc, el) => {
      const roleAttr = el.getAttribute('data-message-author-role');
      if (roleAttr !== 'user' && roleAttr !== 'assistant') return acc;
      const content =
        roleAttr === 'assistant'
          ? this.extractAssistantText(el)
          : this.extractUserText(el);
      if (content) acc.push({ role: roleAttr, content });
      return acc;
    }, []);
  }

  private extractAssistantText(el: HTMLElement): string {
    const body = el.querySelector<HTMLElement>('[data-message-part-type="answer"]');
    if (!body) return '';
    const clone = body.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('[data-exclude-copy="true"]').forEach((n) => n.remove());
    return clone.textContent?.trim() ?? '';
  }

  // Le Chat wraps the raw user prompt in <span class="whitespace-pre-wrap">.
  // Targeting that span avoids picking up the action-button row (Edit/Delete/
  // Copy) and the timestamp ("1:37am") that share the turn container.
  private extractUserText(el: HTMLElement): string {
    const parts = Array.from(
      el.querySelectorAll<HTMLElement>('.whitespace-pre-wrap'),
    );
    if (parts.length === 0) return '';
    return parts
      .map((p) => p.textContent ?? '')
      .join('\n')
      .trim();
  }
}
