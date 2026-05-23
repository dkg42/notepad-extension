/**
 * @module usage-limit-service
 * @description Enforces free-tier count caps. A free user may hold a fixed total
 *   number of prompts, saved chats and pipelines — there is no daily reset, and
 *   deleting an item frees a slot. Counts are derived from the live entity
 *   storage, so no separate counter is kept. Pro users bypass all caps.
 * @public usageLimitService, FREE_CAPS, CappedFeature
 */

export type CappedFeature = 'prompt_hub' | 'chat_history' | 'pipeline';

export const FREE_CAPS: Record<CappedFeature, number> = {
  prompt_hub: 10,
  chat_history: 5,
  pipeline: 1,
};

/** chrome.storage.local key holding the entity array for each capped feature. */
export const STORAGE_KEYS: Record<CappedFeature, string> = {
  prompt_hub: 'snippets',
  chat_history: 'chatConversations',
  pipeline: 'pipelines',
};

export const usageLimitService = {
  /** Current number of stored entities for a capped feature. */
  async getCount(feature: CappedFeature): Promise<number> {
    const key = STORAGE_KEYS[feature];
    const result = await chrome.storage.local.get(key);
    const items = result[key] as unknown[] | undefined;
    return Array.isArray(items) ? items.length : 0;
  },

  /** Whether the user may create another entity of this feature. */
  async canCreate(feature: CappedFeature, isPro: boolean): Promise<boolean> {
    if (isPro) return true;
    const count = await this.getCount(feature);
    return count < FREE_CAPS[feature];
  },

  /** Remaining free slots, or null for pro users (unlimited). */
  async getRemaining(feature: CappedFeature, isPro: boolean): Promise<number | null> {
    if (isPro) return null;
    const count = await this.getCount(feature);
    return Math.max(0, FREE_CAPS[feature] - count);
  },
};
