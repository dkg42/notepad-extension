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

  async triggerSourceDelete(item: Element): Promise<void> {
    // Dispatch hover events so Angular reveals the hidden overflow menu button.
    item.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    item.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    await this.delay(150);

    const moreBtn = this.findSourceMoreButton(item);
    if (!moreBtn) {
      console.warn('[NLM Enhancer] Source overflow button not found — selectors may need updating');
      return;
    }

    moreBtn.click();

    const menuPanel = await this.waitForMenuPanel(2000);
    if (!menuPanel) {
      console.warn('[NLM Enhancer] Source menu panel did not appear');
      return;
    }

    // Find the "Remove source" / "Delete" menu item.
    const menuItems = Array.from(
      menuPanel.querySelectorAll<HTMLElement>('button, [role="menuitem"]'),
    );
    const removeBtn = menuItems.find((el) =>
      /remove|delete/i.test(el.textContent?.trim() ?? ''),
    );

    if (!removeBtn) {
      // Close the open menu and bail.
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      console.warn('[NLM Enhancer] Remove option not found in source menu');
      return;
    }

    removeBtn.click();

    // Auto-confirm any confirmation dialog (e.g. "Are you sure?").
    await this.delay(400);
    this.autoConfirmDeleteDialog();

    // Allow NotebookLM time to animate and process the deletion.
    await this.delay(400);
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private findSourceMoreButton(item: Element): HTMLElement | null {
    // Try aria-label patterns first (most reliable across UI versions).
    const byLabel = (
      item.querySelector<HTMLElement>('button[aria-label*="More" i]') ??
      item.querySelector<HTMLElement>('button[aria-label*="options" i]') ??
      item.querySelector<HTMLElement>('button[aria-label*="menu" i]')
    );
    if (byLabel) return byLabel;

    // Fallback: any button whose mat-icon contains more_vert / more_horiz.
    return (
      Array.from(item.querySelectorAll<HTMLElement>('button')).find((btn) => {
        const iconText = btn.querySelector('mat-icon')?.textContent?.trim();
        return iconText === 'more_vert' || iconText === 'more_horiz';
      }) ?? null
    );
  }

  private waitForMenuPanel(timeout: number): Promise<Element | null> {
    const SELECTORS = ['.mat-mdc-menu-panel', '.mat-menu-panel', '[role="menu"]'];

    const findPanel = (): Element | null => {
      for (const sel of SELECTORS) {
        const el = document.querySelector(sel);
        if (el) return el;
      }
      return null;
    };

    const existing = findPanel();
    if (existing) return Promise.resolve(existing);

    return new Promise((resolve) => {
      const observer = new MutationObserver(() => {
        const found = findPanel();
        if (found) {
          observer.disconnect();
          resolve(found);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        resolve(findPanel());
      }, timeout);
    });
  }

  private autoConfirmDeleteDialog(): void {
    const overlay = document.querySelector('.cdk-overlay-container');
    if (!overlay) return;
    const confirmBtn = Array.from(overlay.querySelectorAll<HTMLElement>('button')).find((btn) =>
      /remove|delete|confirm|yes/i.test(btn.textContent?.trim() ?? ''),
    );
    if (confirmBtn) confirmBtn.click();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
