import type { SiteAdapter } from './site-adapter.interface';
import type { NoteRecord } from '@/types';

export interface StudioPanelAdapter extends SiteAdapter {
  /**
   * Returns the element after which the studio panel enhancer should be inserted.
   * Typically the <nav> in section.studio-panel .panel-header.
   * Returns null if the studio panel has not rendered yet.
   */
  findStudioPanelInjectionPoint(): Element | null;

  /** Returns all artifact-library-note elements currently rendered in the studio panel. */
  findNoteItems(): Element[];

  /** Extracts the display title from a note item element. */
  getNoteTitle(item: Element): string;

  /**
   * Opens the given note item in the studio editor, reads its content, then
   * navigates back to the notes list.
   *
   * NOTE: The note editor DOM selectors are best-effort — update
   * readNoteContent() in notebooklm.adapter.ts once the editor DOM is confirmed.
   * Falls back to title-only if the editor content cannot be located.
   */
  readNoteContent(item: Element): Promise<NoteRecord>;
}

export function isStudioPanelAdapter(adapter: unknown): adapter is StudioPanelAdapter {
  return (
    typeof adapter === 'object' &&
    adapter !== null &&
    'findStudioPanelInjectionPoint' in adapter
  );
}
