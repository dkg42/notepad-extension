import type { ChatSiteAdapter } from './adapter.interface';
import type { SourcePanelAdapter, SourceType } from './source-panel-adapter.interface';
import type { ChatMessage } from '@/types';

/**
 * Maps NotebookLM's Material Symbols icon names (read from mat-icon.source-item-source-icon
 * text content) to our internal SourceType enum.
 *
 * If NotebookLM adds new source types, add the icon name → SourceType mapping here.
 */
const ICON_TYPE_MAP: Record<string, SourceType> = {
  video_youtube: 'youtube',
  picture_as_pdf: 'pdf',
  article: 'gdoc',
  description: 'gdoc',
  slideshow: 'gslide',
  present_to_all: 'gslide',
  web: 'website',
  language: 'website',
  public: 'website',
  link: 'website',
  headphones: 'audio',
  audio_file: 'audio',
  music_note: 'audio',
  markdown: 'text',
  text_snippet: 'text',
  sticky_note_2: 'text',
  note: 'text',
};

export class NotebookLMAdapter implements ChatSiteAdapter, SourcePanelAdapter {
  readonly hostnames = ['notebooklm.google.com'] as const;

  // ── ChatSiteAdapter ─────────────────────────────────────────────────────────
  // Chat export / prompt saving are not yet implemented for NotebookLM.
  // Returning safe no-op values keeps the adapter registry working without errors.

  findHeaderAnchor(): Element | null {
    return null;
  }

  extractMessages(): ChatMessage[] {
    return [];
  }

  extractPrompts(): string[] {
    return [];
  }

  // ── SourcePanelAdapter ──────────────────────────────────────────────────────

  findSourcePanelInjectionPoint(): Element | null {
    // The "Select all sources" row — we inject our enhancer UI immediately before it.
    // DOM path: source-picker > .contents > .row
    return document.querySelector('source-picker .contents .row') ?? null;
  }

  findSourceItemsContainer(): Element | null {
    return document.querySelector('.scroll-area-desktop') ?? null;
  }

  findSourceItems(): Element[] {
    return Array.from(document.querySelectorAll('.single-source-container'));
  }

  getSourceTitle(item: Element): string {
    // Most reliable: aria-label on the full-width stretched button
    const stretchedBtn = item.querySelector<HTMLElement>('.source-stretched-button');
    const ariaLabel = stretchedBtn?.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;

    // Fallback: visible title span inside .source-title
    const span = item.querySelector<HTMLElement>('.source-title span[aria-hidden="true"]');
    return span?.textContent?.trim() ?? '';
  }

  getSourceType(item: Element): SourceType {
    // The source-item-source-icon mat-icon's text content is the Material Symbol name.
    const icon = item.querySelector<HTMLElement>('mat-icon.source-item-source-icon');
    if (!icon) return 'unknown';

    const iconName = icon.textContent?.trim() ?? '';
    return ICON_TYPE_MAP[iconName] ?? 'unknown';
  }
}
