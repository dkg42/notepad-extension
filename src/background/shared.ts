/**
 * @module shared
 * @description Shared utilities for background message handler modules.
 * @dependencies auth-storage-service, token-lifecycle-service
 * @public ensureSignedIn, isMessage, isProUser
 */
import { authStorageService } from '@/services/auth-storage-service';

/** Type guard that narrows an unknown runtime value to a typed message object. */
export function isMessage(value: unknown): value is { type: string } {
  return typeof value === 'object' && value !== null && 'type' in value;
}

/** Throws if there is no signed-in auth profile, acting as a pre-condition guard for handlers that require authentication. */
export async function ensureSignedIn(): Promise<void> {
  if (!await authStorageService.getAuthProfile()) throw new Error('Not signed in');
}

/** Returns true when the signed-in user has an active pro subscription. */
export async function isProUser(): Promise<boolean> {
  const claims = await authStorageService.getAuthClaims();
  return (
    claims?.subscriptionStatus === 'active' &&
    (claims.subscriptionPlan === 'pro_monthly' || claims.subscriptionPlan === 'pro_yearly')
  );
}
