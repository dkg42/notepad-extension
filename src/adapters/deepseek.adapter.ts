/**
 * @module deepseek.adapter
 * @description Implements ChatSiteAdapter for chat.deepseek.com. Extracts messages by walking .ds-message turn containers in DOM order; a turn is identified as assistant when it contains a .ds-assistant-message-main-content descendant, user otherwise. Assistant text is read from a clone of .ds-assistant-message-main-content with citation chips (.ds-markdown-cite) removed so the response body is free of UI markers.
 * @dependencies adapter.interface, types
 * @public DeepSeekAdapter
 */
import type { ChatSiteAdapter } from './adapter.interface';
import type { ChatMessage } from '@/types';

export class DeepSeekAdapter implements ChatSiteAdapter {
  readonly hostnames = ['chat.deepseek.com'] as const;

  extractMessages(): ChatMessage[] {
    const turnElements = Array.from(
      document.querySelectorAll<HTMLElement>('.ds-message'),
    );

    return turnElements.reduce<ChatMessage[]>((acc, el) => {
      const assistantBody = el.querySelector<HTMLElement>(
        '.ds-assistant-message-main-content',
      );
      if (assistantBody) {
        const content = this.extractAssistantText(assistantBody);
        if (content) acc.push({ role: 'assistant', content });
      } else {
        const content = el.textContent?.trim() ?? '';
        if (content) acc.push({ role: 'user', content });
      }
      return acc;
    }, []);
  }

  // DeepSeek's web-search responses inline citation chips as .ds-markdown-cite
  // (small "1"/"5" superscripts). Removing them from a clone yields just the
  // response body, free of citation noise that would otherwise appear mid-word.
  private extractAssistantText(el: HTMLElement): string {
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.ds-markdown-cite').forEach((n) => n.remove());
    return clone.textContent?.trim() ?? '';
  }
}
