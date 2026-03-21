import type { SiteAdapter } from './site-adapter.interface';

export type SourceType =
  | 'all'
  | 'pdf'
  | 'youtube'
  | 'gdoc'
  | 'gslide'
  | 'website'
  | 'audio'
  | 'text'
  | 'unknown';

export interface SourcePanelAdapter extends SiteAdapter {
  /**
   * Returns the element to insert the enhancer UI before.
   * Returns null if the source panel has not rendered yet.
   */
  findSourcePanelInjectionPoint(): Element | null;

  /** Returns the container element that holds all source items. Used for mutation watching. */
  findSourceItemsContainer(): Element | null;

  /** Returns all current source item elements. */
  findSourceItems(): Element[];

  /** Extracts the display title from a source item element. */
  getSourceTitle(item: Element): string;

  /** Determines the source type from a source item element. */
  getSourceType(item: Element): SourceType;

  /**
   * Triggers the site's native delete flow for a single source item element.
   * Implementations should find the overflow menu, click "Remove source", and
   * auto-confirm any confirmation dialog. Resolves when the deletion has been
   * initiated (or silently fails if the UI cannot be found).
   *
   * NOTE: Relies on live DOM selectors — update notebooklm.adapter.ts if the
   * site changes its UI structure.
   */
  triggerSourceDelete(item: Element): Promise<void>;
}

export function isSourcePanelAdapter(adapter: unknown): adapter is SourcePanelAdapter {
  return (
    typeof adapter === 'object' &&
    adapter !== null &&
    'findSourcePanelInjectionPoint' in adapter
  );
}
