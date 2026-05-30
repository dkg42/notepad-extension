/**
 * @module SubscriptionContext
 * @description React context exposing subscription claims read from chrome.storage.local.
 *   Claims are written by the background after verifying the Firebase ID token (RS256).
 *   Root components (DashboardApp, App) call useSubscriptionState() to drive the provider;
 *   all other components consume useSubscription().
 * @dependencies @/services/auth-storage-service, @/types
 * @public SubscriptionProvider, useSubscription, useSubscriptionState, SubscriptionContextValue
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authStorageService } from '@/services/auth-storage-service';
import { isProClaims } from '@/utils/subscription';
import type { AuthClaims } from '@/types';

export interface SubscriptionContextValue {
  claims: AuthClaims | null;
  isLoading: boolean;
  /** True when subscriptionStatus is 'active'. */
  isActive: boolean;
  /** True when plan is pro_monthly or pro_yearly AND isActive. */
  isPro: boolean;
  /** True when any paid plan is active. */
  hasSubscription: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({
  value,
  children,
}: {
  value: SubscriptionContextValue;
  children: React.ReactNode;
}) {
  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
}

/**
 * Drives the SubscriptionProvider. Call this once in a root component (DashboardApp, App)
 * and pass the result as `value` to SubscriptionProvider.
 */
export function useSubscriptionState(): SubscriptionContextValue {
  const [claims, setClaims] = useState<AuthClaims | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    authStorageService.getAuthClaims().then((c) => {
      setClaims(c);
      setIsLoading(false);
    });
    return authStorageService.onClaimsChanged(setClaims);
  }, []);

  const isActive = claims?.subscriptionStatus === 'active';
  const isPro = isProClaims(claims);

  return useMemo(
    () => ({
      claims,
      isLoading,
      isActive: !!isActive,
      isPro: !!isPro,
      hasSubscription: !!isActive,
    }),
    [claims, isLoading, isActive, isPro],
  );
}
