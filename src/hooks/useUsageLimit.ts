/**
 * @module useUsageLimit
 * @description React hook exposing free-tier count-cap state for a feature.
 *   Pro users always get canCreate=true and remaining=null (unlimited).
 *   Free users see their current count, remaining slots and a creation gate.
 *   Listens for changes to the feature's entity storage so all views stay in sync.
 * @dependencies usage-limit-service, SubscriptionContext
 * @public useUsageLimit
 */
import { useState, useEffect, useCallback } from 'react';
import {
  usageLimitService,
  FREE_CAPS,
  STORAGE_KEYS,
  type CappedFeature,
} from '@/services/usage-limit-service';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { scopedStorage } from '@/services/storage/scoped-storage';

interface UsageLimitState {
  /** Whether the user may create another entity of this feature. */
  canCreate: boolean;
  /** Remaining free slots, or null for pro users (unlimited). */
  remaining: number | null;
  /** Current stored count, or null for pro users (unlimited). */
  count: number | null;
}

export function useUsageLimit(feature: CappedFeature): UsageLimitState {
  const { isPro } = useSubscription();
  const [count, setCount] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [canCreate, setCanCreate] = useState(true);

  const refresh = useCallback(async () => {
    if (isPro) {
      setCount(null);
      setRemaining(null);
      setCanCreate(true);
      return;
    }
    const c = await usageLimitService.getCount(feature);
    const cap = FREE_CAPS[feature];
    setCount(c);
    setRemaining(Math.max(0, cap - c));
    setCanCreate(c < cap);
  }, [feature, isPro]);

  useEffect(() => {
    void refresh();
    const key = STORAGE_KEYS[feature];
    return scopedStorage.onChanged(key, () => {
      void refresh();
    });
  }, [feature, refresh]);

  return { canCreate, remaining, count };
}
