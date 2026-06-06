/**
 * @module billing-service
 * @description Opens the Dodo Payments customer portal for the signed-in user.
 *   Invokes the createDodoPortalSession Callable Cloud Function via the Firebase
 *   Functions SDK (which attaches the caller's Firebase ID token automatically,
 *   populating request.auth server-side), then opens the returned time-bound URL
 *   in a new tab. The Cloud Function holds the Dodo API key server-side.
 * @dependencies firebase-app, firebase-token-service
 * @public openCustomerPortal, OpenCustomerPortalResult
 */

import { httpsCallable, FunctionsError } from 'firebase/functions';
import { getFirebaseFunctions } from './firebase-app';
import { getFirebaseIdToken } from './firebase-token-service';

export type OpenCustomerPortalResult =
  | { ok: true }
  | { ok: false; reason: 'auth' | 'no_subscription' | 'network' | 'server'; error?: string };

interface PortalCFResult {
  link?: string;
}

export async function openCustomerPortal(): Promise<OpenCustomerPortalResult> {
  // Guard up front so a signed-out user gets a clean `auth` reason rather than
  // a generic callable error.
  const idTokenResult = await getFirebaseIdToken();
  if (!idTokenResult.ok) {
    return { ok: false, reason: 'auth', error: idTokenResult.reason };
  }

  let link: string | undefined;
  try {
    const callPortal = httpsCallable<Record<string, never>, PortalCFResult>(
      getFirebaseFunctions(),
      'createDodoPortalSession',
    );
    const { data } = await callPortal({});
    link = data.link;
  } catch (err) {
    const code = err instanceof FunctionsError ? err.code : '';
    const error = err instanceof Error ? err.message : String(err);
    if (code === 'functions/unauthenticated') return { ok: false, reason: 'auth', error };
    if (code === 'functions/permission-denied' || code === 'functions/failed-precondition') {
      return { ok: false, reason: 'no_subscription', error };
    }
    // Transport-level failures surface as unavailable / deadline-exceeded.
    if (code === 'functions/unavailable' || code === 'functions/deadline-exceeded') {
      return { ok: false, reason: 'network', error };
    }
    return { ok: false, reason: 'server', error };
  }

  if (!link) {
    return { ok: false, reason: 'server', error: 'Missing portal link in response' };
  }

  chrome.tabs.create({ url: link });
  return { ok: true };
}
