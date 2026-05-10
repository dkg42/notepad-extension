/**
 * @module useUsageLimit
 * @description React hook that exposes daily usage limit state for a feature.
 *   Pro users always get canUse=true and remaining=null (unlimited).
 *   Free users see remaining count and a boolean gate.
 *   Listens for storage changes so all open views stay in sync.
 * @dependencies usage-limit-service, SubscriptionContext
 * @public useUsageLimit
 */
import { useState, useEffect, useCallback } from 'react';
import { usageLimitService, DAILY_LIMITS, type UsageFeature } from '@/services/usage-limit-service';
import { useSubscription } from '@/contexts/SubscriptionContext';

interface UsageLimitState {
  canUse: boolean;
  remaining: number | null;
  count: number | null;  // null = pro (unlimited); free users get today's use count
  use(): Promise<void>;
}

export function useUsageLimit(feature: UsageFeature): UsageLimitState {
  const { isPro } = useSubscription();
  const [count, setCount] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [canUse, setCanUse] = useState(true);

  const refresh = useCallback(async () => {
    if (isPro) {
      setCount(null);
      setRemaining(null);
      setCanUse(true);
      return;
    }
    const c = await usageLimitService.getCount(feature);
    const limit = DAILY_LIMITS[feature];
    setCount(c);
    setRemaining(Math.max(0, limit - c));
    setCanUse(c < limit);
  }, [feature, isPro]);

  useEffect(() => {
    void refresh();

    const handler = (changes: Record<string, chrome.storage.StorageChange>) => {
      if ('dailyUsage' in changes) void refresh();
    };
    chrome.storage.local.onChanged.addListener(handler);
    return () => chrome.storage.local.onChanged.removeListener(handler);
  }, [refresh]);

  const use = useCallback(async () => {
    if (!isPro) {
      await usageLimitService.increment(feature);
      await refresh();
    }
  }, [feature, isPro, refresh]);

  return { canUse, remaining, count, use };
}
