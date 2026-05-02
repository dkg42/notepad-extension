/**
 * @module tab-groups
 * @description Types for the Tab Manager feature — user-defined groups of open browser tabs
 *   with optional context notes and persistence across browser sessions.
 * @public TabGroup, GroupColor
 */

export type GroupColor = 'primary' | 'green' | 'sky' | 'rose' | 'violet';

export interface TabGroup {
  id: string;
  name: string;
  color: GroupColor;
  pinned: boolean;
  context: string;
  aiContext: boolean;
  tabIds: number[];
  tabUrls: string[];
  createdAt: number;
  updatedAt: number;
}
