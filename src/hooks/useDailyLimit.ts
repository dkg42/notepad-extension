/**
 * @module useDailyLimit
 * @description React hook exposing daily usage state for a feature. Mirrors
 *   useUsageLimit's shape but tracks a per-day counter (resets at midnight)
 *   rather than a lifetime count cap. Pro users always get canUse=true and
 *   remaining=null (unlimited). Free users see today's count and a gate.
 * @dependencies daily-limit-service, SubscriptionContext
 * @public useDailyLimit
 */
import { useState, useEffect, useCallback } from 'react';
import {
  dailyLimitService,
  DAILY_LIMITS,
  DAILY_STORAGE_KEY,
  type DailyFeature,
} from '@/services/daily-limit-service';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { scopedStorage } from '@/services/storage/scoped-storage';

interface DailyLimitState {
  /** Whether the user may use the feature again today. */
  canUse: boolean;
  /** Remaining uses today, or null for pro users (unlimited). */
  remaining: number | null;
  /** Today's count, or null for pro users (unlimited). */
  count: number | null;
}

export function useDailyLimit(feature: DailyFeature): DailyLimitState {
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
    const c = await dailyLimitService.getCountToday(feature);
    const limit = DAILY_LIMITS[feature];
    setCount(c);
    setRemaining(Math.max(0, limit - c));
    setCanUse(c < limit);
  }, [feature, isPro]);

  useEffect(() => {
    void refresh();
    return scopedStorage.onChanged(DAILY_STORAGE_KEY, () => {
      void refresh();
    });
  }, [refresh]);

  return { canUse, remaining, count };
}
