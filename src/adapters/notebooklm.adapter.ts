import type { ChatSiteAdapter } from './adapter.interface';
import type { SourcePanelAdapter, SourceType } from './source-panel-adapter.interface';
import type { StudioPanelAdapter } from './studio-panel-adapter.interface';
import type { ChatMessage, NoteRecord } from '@/types';

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

export class NotebookLMAdapter implements ChatSiteAdapter, SourcePanelAdapter, StudioPanelAdapter {
  readonly hostnames = ['notebooklm.google.com'] as const;

  // ── ChatSiteAdapter ──────────────────────────────────────────────────────────
  //
  // NOTE: NotebookLM uses Angular components whose exact tag names and class names
  // may change with product updates. All selectors below are documented with their
  // intent so they are easy to update if a feature stops working.
  // Inspect: DevTools → Elements panel on notebooklm.google.com → search for the
  // relevant component names listed in each comment.

  findHeaderAnchor(): Element | null {
    // The chat panel header's right-side button group.
    // DOM path: section.chat-panel > div.panel-header > span.chat-header-buttons
    // This span already contains the "Configure notebook" (tune) and "Chat options"
    // (more_vert) icon buttons — our buttons are appended alongside them.
    //
    // IMPORTANT: do NOT use document.querySelector('header') here — the emoji picker
    // component on the page also renders a <header> element that appears earlier in the
    // DOM and will capture the selector first.
    return (
      document.querySelector<Element>('section.chat-panel .chat-header-buttons') ??
      document.querySelector<Element>('section.chat-panel .panel-header') ??
      null
    );
  }

  extractMessages(): ChatMessage[] {
    const messages: ChatMessage[] = [];

    // The chat panel shows an AI-generated summary of the notebook sources above
    // the conversation. It lives in .chat-panel-empty-state > .notebook-summary > .summary-content
    // and is visible even when chat messages exist.
    const summaryEl = document.querySelector<HTMLElement>(
      'section.chat-panel .summary-content',
    );
    if (summaryEl) {
      const summaryText = summaryEl.textContent?.trim();
      if (summaryText) {
        messages.push({ role: 'system', content: `Notebook Summary\n\n${summaryText}` });
      }
    }

    // Each message is rendered as a `chat-message` Angular component.
    // User turns contain a .from-user-container child.
    // Model turns contain a .to-user-container child.
    // Both are siblings inside .chat-message-pair grouping divs, in DOM order.
    const chatMessages = Array.from(
      document.querySelectorAll<HTMLElement>('chat-message.individual-message'),
    );

    for (const msg of chatMessages) {
      const isUser = msg.querySelector('.from-user-container') !== null;
      const content = this.extractMessageText(msg, isUser);
      if (content) messages.push({ role: isUser ? 'user' : 'assistant', content });
    }

    return messages;
  }

  extractPrompts(): string[] {
    return this.extractMessages()
      .filter((m) => m.role === 'user')
      .map((m) => m.content);
  }

  private extractMessageText(msg: HTMLElement, isUser: boolean): string {
    if (isUser) {
      // User text lives inside:
      // .from-user-container > mat-card > mat-card-content > .message-text-content
      // The text itself is in a .is-rich-chat-ui div > <p> element(s).
      const container = msg.querySelector<HTMLElement>(
        '.from-user-container .message-text-content',
      );
      return container?.textContent?.trim() ?? '';
    }

    // Model response text lives inside:
    // .to-user-container > mat-card > mat-card-content > .message-text-content
    //   > element-list-renderer > labs-tailwind-structural-element-view-v2
    //   > div.paragraph
    //
    // Multiple .paragraph divs are used for multi-paragraph responses.
    // Joining them with double newlines reconstructs the paragraph structure.
    const container = msg.querySelector<HTMLElement>(
      '.to-user-container .message-text-content',
    );
    if (!container) return '';

    const paragraphs = Array.from(container.querySelectorAll<HTMLElement>('.paragraph'));
    if (paragraphs.length > 0) {
      return paragraphs
        .map((p) => p.textContent?.trim())
        .filter(Boolean)
        .join('\n\n');
    }

    // Fallback: full text content of the container
    return container.textContent?.trim() ?? '';
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

  // ── StudioPanelAdapter ───────────────────────────────────────────────────────

  findStudioPanelInjectionPoint(): Element | null {
    // The <nav> inside the studio panel header.
    // We insert the enhancer container immediately after the nav, placing our
    // "Export notes" button between the "Studio" heading and the collapse toggle.
    return (
      document.querySelector<Element>('section.studio-panel .panel-header nav') ?? null
    );
  }

  findNoteItems(): Element[] {
    // artifact-library-note is the Angular component for each saved note.
    // Confirmed selector from live DOM: section.studio-panel artifact-library-note
    return Array.from(
      document.querySelectorAll<Element>('section.studio-panel artifact-library-note'),
    );
  }

  getNoteTitle(item: Element): string {
    // Confirmed from live DOM: .artifact-title.mat-title-small holds the note name.
    return (
      item.querySelector<HTMLElement>('.artifact-title')?.textContent?.trim() ?? ''
    );
  }

  async readNoteContent(item: Element): Promise<NoteRecord> {
    const title = this.getNoteTitle(item);

    // Click the note's primary button to open it in the studio editor.
    // Confirmed selector: button.artifact-stretched-button inside the note item.
    const openBtn = item.querySelector<HTMLElement>('.artifact-stretched-button');
    if (!openBtn) return { title, content: '' };

    openBtn.click();

    // Wait for the note editor to render.
    // NOTE: These selectors are best-effort — update once the note editor DOM
    // is confirmed from DevTools on notebooklm.google.com.
    await this.delay(800);
    const editorContent = await this.waitForNoteEditor(1500);
    const content = editorContent?.textContent?.trim() ?? '';

    // Navigate back to the notes list.
    // Try a dedicated back button first; fall back to Escape key.
    const backBtn = document.querySelector<HTMLElement>(
      'button[aria-label="Back"], button[aria-label="Close"], .note-editor-back, .note-back-button',
    );
    if (backBtn) {
      backBtn.click();
    } else {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    }
    await this.delay(400);

    return { title, content };
  }

  private waitForNoteEditor(timeout: number): Promise<Element | null> {
    // NOTE: Update these selectors once the note editor DOM is known.
    // Common Angular rich-text editor patterns used in Google products:
    const SELECTORS = [
      '.note-editor-content',
      '.note-body',
      'studio-panel [contenteditable="true"]',
      '.studio-panel-content [contenteditable]',
      '.ProseMirror',
    ];

    const findEditor = (): Element | null => {
      for (const sel of SELECTORS) {
        const el = document.querySelector(sel);
        if (el) return el;
      }
      return null;
    };

    const existing = findEditor();
    if (existing) return Promise.resolve(existing);

    return new Promise((resolve) => {
      const observer = new MutationObserver(() => {
        const found = findEditor();
        if (found) {
          observer.disconnect();
          resolve(found);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        resolve(findEditor());
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
