/**
 * @module recent-actions-storage
 * @description Local-only domain storage for the side-panel "Recent Actions" log: append, list, and clear. Prepend-with-cap at 30 records; collapses bursts of the same action within 2 seconds. Not synced to Drive.
 * @dependencies storage/shared, storage/scoped-storage
 * @public recentActionsStorage, RecentAction, RecentActionKind
 */
import { RECENT_ACTIONS_KEY } from './shared';
import { scopedStorage } from './scoped-storage';

export type RecentActionKind =
  | 'tile_open'
  | 'prompt_used'
  | 'snippet_copied'
  | 'chat_exported'
  | 'screenshot_saved'
  | 'tabs_grouped'
  | 'notebook_source_added';

export interface RecentAction {
  id: string;
  featureId: string;
  kind: RecentActionKind;
  label: string;
  timestamp: number;
}

const MAX_RECORDS = 30;
const DEDUP_WINDOW_MS = 2000;

export const recentActionsStorage = {
  async getRecentActions(): Promise<RecentAction[]> {
    const result = await scopedStorage.get<RecentAction[]>(RECENT_ACTIONS_KEY);
    return result[RECENT_ACTIONS_KEY] ?? [];
  },

  async addRecentAction(action: Omit<RecentAction, 'id' | 'timestamp'>): Promise<void> {
    const existing = await recentActionsStorage.getRecentActions();
    const now = Date.now();
    const newRecord: RecentAction = { id: crypto.randomUUID(), timestamp: now, ...action };

    const head = existing[0];
    const isBurstDuplicate =
      head &&
      head.featureId === action.featureId &&
      head.kind === action.kind &&
      head.label === action.label &&
      now - head.timestamp < DEDUP_WINDOW_MS;

    const next = isBurstDuplicate
      ? [newRecord, ...existing.slice(1)]
      : [newRecord, ...existing].slice(0, MAX_RECORDS);

    await scopedStorage.set({ [RECENT_ACTIONS_KEY]: next });
  },

  async clearRecentActions(): Promise<void> {
    await scopedStorage.set({ [RECENT_ACTIONS_KEY]: [] });
  },
};
