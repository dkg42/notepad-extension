/**
 * @module usage-limit-service
 * @description Tracks daily per-feature usage counts for free-tier users.
 *   Counts are stored in chrome.storage.local keyed by date (YYYY-MM-DD).
 *   Old entries are pruned on each write (kept for 7 days).
 *   Pro users bypass all limits.
 * @public usageLimitService, DAILY_LIMITS, UsageFeature
 */

export type UsageFeature =
  | 'prompt_hub'
  | 'chat_history'
  | 'notebooklm_add'
  | 'pipeline_run'
  | 'screenshot_editor';

export const DAILY_LIMITS: Record<UsageFeature, number> = {
  prompt_hub: 5,
  chat_history: 2,
  notebooklm_add: 3,
  pipeline_run: 5,
  screenshot_editor: 2,
};

const STORAGE_KEY = 'dailyUsage';

interface DailyUsageStore {
  [date: string]: Partial<Record<UsageFeature, number>>;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

async function readStore(): Promise<DailyUsageStore> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as DailyUsageStore | undefined) ?? {};
}

async function writeStore(store: DailyUsageStore): Promise<void> {
  // Prune entries older than 7 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  for (const date of Object.keys(store)) {
    if (date < cutoffKey) delete store[date];
  }
  await chrome.storage.local.set({ [STORAGE_KEY]: store });
}

export const usageLimitService = {
  async getCount(feature: UsageFeature): Promise<number> {
    const store = await readStore();
    return store[todayKey()]?.[feature] ?? 0;
  },

  async canUse(feature: UsageFeature, isPro: boolean): Promise<boolean> {
    if (isPro) return true;
    const count = await this.getCount(feature);
    return count < DAILY_LIMITS[feature];
  },

  async increment(feature: UsageFeature): Promise<void> {
    const store = await readStore();
    const today = todayKey();
    if (!store[today]) store[today] = {};
    store[today][feature] = (store[today][feature] ?? 0) + 1;
    await writeStore(store);
  },

  async getRemaining(feature: UsageFeature, isPro: boolean): Promise<number | null> {
    if (isPro) return null;
    const count = await this.getCount(feature);
    return Math.max(0, DAILY_LIMITS[feature] - count);
  },
};
