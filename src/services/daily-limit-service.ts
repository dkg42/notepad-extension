/**
 * @module daily-limit-service
 * @description Per-feature daily usage counter for limits that should reset at
 *   midnight (distinct from the lifetime caps in usage-limit-service).
 *   Counts are stored in chrome.storage.local keyed by date (YYYY-MM-DD).
 *   Old entries are pruned on each write (kept for 7 days). Pro users bypass.
 * @public dailyLimitService, DAILY_LIMITS, DailyFeature
 */

export type DailyFeature = 'notebook_add';

export const DAILY_LIMITS: Record<DailyFeature, number> = {
  notebook_add: 3,
};

export const DAILY_STORAGE_KEY = 'dailyUsage';

interface DailyUsageStore {
  [date: string]: Partial<Record<DailyFeature, number>>;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

async function readStore(): Promise<DailyUsageStore> {
  const result = await chrome.storage.local.get(DAILY_STORAGE_KEY);
  return (result[DAILY_STORAGE_KEY] as DailyUsageStore | undefined) ?? {};
}

async function writeStore(store: DailyUsageStore): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  for (const date of Object.keys(store)) {
    if (date < cutoffKey) delete store[date];
  }
  await chrome.storage.local.set({ [DAILY_STORAGE_KEY]: store });
}

export const dailyLimitService = {
  async getCountToday(feature: DailyFeature): Promise<number> {
    const store = await readStore();
    return store[todayKey()]?.[feature] ?? 0;
  },

  async canUseToday(feature: DailyFeature, isPro: boolean): Promise<boolean> {
    if (isPro) return true;
    const count = await this.getCountToday(feature);
    return count < DAILY_LIMITS[feature];
  },

  async incrementToday(feature: DailyFeature): Promise<void> {
    const store = await readStore();
    const today = todayKey();
    if (!store[today]) store[today] = {};
    store[today][feature] = (store[today][feature] ?? 0) + 1;
    await writeStore(store);
  },

  async getRemainingToday(feature: DailyFeature, isPro: boolean): Promise<number | null> {
    if (isPro) return null;
    const count = await this.getCountToday(feature);
    return Math.max(0, DAILY_LIMITS[feature] - count);
  },
};
