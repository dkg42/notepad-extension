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
}

export function isSourcePanelAdapter(adapter: unknown): adapter is SourcePanelAdapter {
  return (
    typeof adapter === 'object' &&
    adapter !== null &&
    'findSourcePanelInjectionPoint' in adapter
  );
}
