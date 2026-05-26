/**
 * @module billing-service
 * @description Opens the Dodo Payments customer portal for the signed-in user.
 *   Calls the createDodoPortalSession Cloud Function (which holds the Dodo API
 *   key server-side), then opens the returned time-bound URL in a new tab.
 * @dependencies firebase-token-service
 * @public openCustomerPortal, OpenCustomerPortalResult
 */

import { getFirebaseIdToken } from './firebase-token-service';

const CF_BASE_URL = import.meta.env.VITE_CLOUD_FUNCTIONS_BASE_URL as string ?? '';
const PORTAL_URL = `${CF_BASE_URL}/createDodoPortalSession`;

export type OpenCustomerPortalResult =
  | { ok: true }
  | { ok: false; reason: 'auth' | 'no_subscription' | 'network' | 'server'; error?: string };

interface PortalCFResponse {
  link?: string;
  error?: string;
  message?: string;
}

export async function openCustomerPortal(): Promise<OpenCustomerPortalResult> {
  const idTokenResult = await getFirebaseIdToken();
  if (!idTokenResult.ok) {
    return { ok: false, reason: 'auth', error: idTokenResult.reason };
  }

  let response: Response;
  try {
    response = await fetch(PORTAL_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idTokenResult.idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
  } catch (err) {
    return {
      ok: false,
      reason: 'network',
      error: err instanceof Error ? err.message : String(err),
    };
  }

  let body: PortalCFResponse;
  try {
    body = await response.json() as PortalCFResponse;
  } catch {
    body = {};
  }

  if (!response.ok) {
    if (response.status === 401) return { ok: false, reason: 'auth', error: body.error };
    if (response.status === 403) return { ok: false, reason: 'no_subscription', error: body.error };
    return { ok: false, reason: 'server', error: body.message ?? body.error ?? `HTTP ${response.status}` };
  }

  if (!body.link) {
    return { ok: false, reason: 'server', error: 'Missing portal link in response' };
  }

  chrome.tabs.create({ url: body.link });
  return { ok: true };
}
