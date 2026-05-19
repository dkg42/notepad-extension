/**
 * @module tab-groups-sync-service
 * @description Periodic-snapshot Drive sync for the Tab Manager. The Tab Manager
 * rewrites `tabGroups` on every live chrome.tabs event, so per-change Drive
 * writes are infeasible. Instead a background alarm (and onSuspend) calls
 * `syncTabGroupsIfChanged()`, which snapshots the durable group definition
 * (excluding device-local `tabIds` and the churn-poisoned `updatedAt`), diffs it
 * against a device-local signature, and only writes to Drive when the durable
 * content actually changed. The write itself goes through the debounced
 * write-queue and is a no-op for free-tier users.
 * @dependencies @/services/tab-groups-storage, @/services/token-lifecycle-service, @/services/drive/drive-sync-service
 * @public tabGroupsSyncService
 */
import type { TabGroup } from '@/types/tab-groups';
import { tabGroupsStorage } from './tab-groups-storage';
import { getValidToken } from './token-lifecycle-service';
import { driveSyncService } from './drive/drive-sync-service';

/** Device-local marker of the last durable snapshot pushed to Drive. */
const SYNC_SIG_KEY = 'tabGroupsSyncSig';

/**
 * Stable, device-agnostic signature of the durable group definition. Excludes
 * `tabIds` (live, device-local) and `updatedAt` (bumped by automatic live
 * reconciliation, not just real edits) so live churn does not look like a
 * content change. Groups sorted by id for order-independence.
 */
function signature(groups: TabGroup[]): string {
  const normalized = [...groups]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((g) => ({
      id: g.id,
      name: g.name,
      color: g.color,
      pinned: g.pinned,
      context: g.context,
      aiContext: g.aiContext,
      createdAt: g.createdAt,
      tabUrls: g.tabUrls,
      stashedTabs: g.stashedTabs,
    }));
  return JSON.stringify(normalized);
}

export const tabGroupsSyncService = {
  /**
   * Snapshots tab groups and pushes to Drive only if the durable content
   * changed since the last sync. Best-effort: no-ops when signed out / no Drive
   * scope (and internally for free-tier users via the write facade).
   */
  async syncTabGroupsIfChanged(): Promise<void> {
    const tokenResult = await getValidToken();
    if (!tokenResult.ok || !tokenResult.hasDriveScope) return;

    const groups = await tabGroupsStorage.getGroups();
    const sig = signature(groups);

    const stored = await chrome.storage.local.get(SYNC_SIG_KEY);
    if (stored[SYNC_SIG_KEY] === sig) return;

    driveSyncService.saveTabGroups(groups, tokenResult.accessToken);
    await chrome.storage.local.set({ [SYNC_SIG_KEY]: sig });
  },

  /**
   * Clears the sync signature so the next sync force-pushes. Called on sign-out
   * so a subsequent (possibly different-account) login re-uploads cleanly.
   */
  async clearSyncSignature(): Promise<void> {
    await chrome.storage.local.remove(SYNC_SIG_KEY);
  },
};
