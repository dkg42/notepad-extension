/**
 * @module utils/subscription
 * @description Pure helpers for deriving subscription tier from stored claims.
 *   No React, safe to import from the background service worker.
 * @public isProClaims
 */
import type { AuthClaims, SubscriptionPlan } from '@/types';

const PRO_PLAN_IDS: readonly SubscriptionPlan[] = ['pro_monthly', 'pro_yearly'];

/** Single source of truth for Pro tier derivation. */
export function isProClaims(claims: AuthClaims | null | undefined): boolean {
  if (!claims) return false;
  if (claims.subscriptionStatus !== 'active') return false;
  return PRO_PLAN_IDS.includes(claims.subscriptionPlan as SubscriptionPlan);
}
