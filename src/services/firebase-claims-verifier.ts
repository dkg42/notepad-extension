/**
 * @module firebase-claims-verifier
 * @description Verifies Firebase ID token (RS256 JWT) signatures using the Web Crypto API
 *   and extracts subscription claims from the verified payload. Firebase's RSA public keys
 *   are fetched from the JWK endpoint and cached in chrome.storage.session by kid and TTL.
 *   Uses only standard Web APIs: crypto.subtle, TextEncoder/TextDecoder, fetch.
 * @dependencies @/types (AuthClaims, SubscriptionStatus, SubscriptionPlan)
 * @public verifyFirebaseIdToken, ClaimsVerifyResult
 */

import type { AuthClaims, SubscriptionStatus, SubscriptionPlan } from '@/types';

// VITE_FIREBASE_PROJECT_ID must be set in .env.local (e.g., my-project-12345).
// It is used to validate the `iss` and `aud` claims in the Firebase ID token.
const FIREBASE_PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID as string ?? '';

const KEYS_JWK_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const KEYS_CACHE_KEY = 'firebasePublicKeyCache';
const DEFAULT_CACHE_TTL_MS = 3_600_000; // 1 hour fallback if no Cache-Control header

// The DOM's JsonWebKey type omits `kid` — extend it for the Firebase response shape.
type FirebaseJwk = JsonWebKey & { kid: string };

interface KeysCache {
  jwks: Record<string, FirebaseJwk>;
  expiresAt: number;
}

export type ClaimsVerifyResult =
  | { ok: true; claims: AuthClaims }
  | { ok: false; reason: 'invalid_signature' | 'expired' | 'invalid_claims' | 'fetch_error' };

// ── Base64url helpers (Web API — no custom decoders) ──────────────────────────

function base64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64.padEnd(b64.length + (4 - (b64.length % 4)) % 4, '=');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

function base64urlToJson(b64url: string): unknown {
  return JSON.parse(new TextDecoder().decode(base64urlToBytes(b64url)));
}

// ── Public key cache (chrome.storage.session, keyed by kid) ──────────────────

async function getPublicKey(kid: string): Promise<CryptoKey> {
  const session = chrome.storage.session as typeof chrome.storage.local;
  const stored = await session.get(KEYS_CACHE_KEY);
  const cache = stored[KEYS_CACHE_KEY] as KeysCache | undefined;

  if (cache && Date.now() < cache.expiresAt && cache.jwks[kid]) {
    return importJwk(cache.jwks[kid]);
  }

  // Fetch fresh JWKs from Google
  let resp: Response;
  try {
    resp = await fetch(KEYS_JWK_URL);
  } catch {
    throw new Error('Network error fetching Firebase public keys');
  }
  if (!resp.ok) throw new Error(`Firebase public key fetch failed: HTTP ${resp.status}`);

  const data = await resp.json() as { keys: FirebaseJwk[] };
  const jwks: Record<string, FirebaseJwk> = {};
  for (const jwk of data.keys) {
    if (typeof jwk.kid === 'string') jwks[jwk.kid] = jwk;
  }

  const cc = resp.headers.get('cache-control') ?? '';
  const maxAgeMatch = /max-age=(\d+)/i.exec(cc);
  const ttlMs = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) * 1000 : DEFAULT_CACHE_TTL_MS;
  await session.set({ [KEYS_CACHE_KEY]: { jwks, expiresAt: Date.now() + ttlMs } as KeysCache });

  const jwk = jwks[kid];
  if (!jwk) throw new Error(`No Firebase public key for kid: ${kid}`);
  return importJwk(jwk);
}

async function importJwk(jwk: FirebaseJwk): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
}

// ── Claim type guards ─────────────────────────────────────────────────────────

const VALID_STATUSES = new Set<string>(['active', 'cancelled', 'expired', 'on_hold', 'none']);
const VALID_PLANS = new Set<string>(['pro_monthly', 'pro_yearly']);

function toStatus(v: unknown): SubscriptionStatus {
  return typeof v === 'string' && VALID_STATUSES.has(v) ? (v as SubscriptionStatus) : 'none';
}

function toPlan(v: unknown): SubscriptionPlan | null {
  return typeof v === 'string' && VALID_PLANS.has(v) ? (v as SubscriptionPlan) : null;
}

function toNullableString(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

// ── Main verifier ─────────────────────────────────────────────────────────────

/**
 * Verifies a Firebase ID token JWT signature and validates its standard claims.
 * On success returns the subscription claims embedded by the Firebase Admin SDK.
 * On failure returns a typed error reason without throwing.
 *
 * Verification steps:
 *   1. Decode header → get kid and assert alg === RS256
 *   2. Fetch/cache Firebase RSA public key for kid (JWK, chrome.storage.session)
 *   3. crypto.subtle.verify (RSASSA-PKCS1-v1_5 / SHA-256)
 *   4. Validate exp, iat, iss, aud
 *   5. Extract AuthClaims from payload with safe defaults
 */
export async function verifyFirebaseIdToken(idToken: string): Promise<ClaimsVerifyResult> {
  const parts = idToken.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'invalid_claims' };
  const [headerB64, payloadB64, signatureB64] = parts;

  // 1. Decode header
  let header: { alg: string; kid: string };
  try {
    header = base64urlToJson(headerB64) as { alg: string; kid: string };
  } catch {
    return { ok: false, reason: 'invalid_claims' };
  }
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') {
    return { ok: false, reason: 'invalid_claims' };
  }

  // 2. Get public key
  let publicKey: CryptoKey;
  try {
    publicKey = await getPublicKey(header.kid);
  } catch {
    return { ok: false, reason: 'fetch_error' };
  }

  // 3. Verify signature
  const message = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  let isValid: boolean;
  try {
    isValid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      publicKey,
      base64urlToBytes(signatureB64).buffer as ArrayBuffer,
      message,
    );
  } catch {
    return { ok: false, reason: 'invalid_signature' };
  }
  if (!isValid) return { ok: false, reason: 'invalid_signature' };

  // 4. Decode payload
  let payload: Record<string, unknown>;
  try {
    payload = base64urlToJson(payloadB64) as Record<string, unknown>;
  } catch {
    return { ok: false, reason: 'invalid_claims' };
  }

  // 5. Validate standard Firebase claims
  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp <= nowSec) {
    return { ok: false, reason: 'expired' };
  }
  // Allow up to 5 minutes of clock skew for iat
  if (typeof payload.iat !== 'number' || payload.iat > nowSec + 300) {
    return { ok: false, reason: 'invalid_claims' };
  }
  if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) {
    return { ok: false, reason: 'invalid_claims' };
  }
  if (payload.aud !== FIREBASE_PROJECT_ID) {
    return { ok: false, reason: 'invalid_claims' };
  }

  // 6. Extract subscription claims with safe defaults
  const claims: AuthClaims = {
    subscriptionStatus: toStatus(payload.subscriptionStatus),
    subscriptionPlan: toPlan(payload.subscriptionPlan),
    subscriptionId: toNullableString(payload.subscriptionId),
    customerId: toNullableString(payload.customerId),
    currentPeriodEnd: toNullableString(payload.currentPeriodEnd),
  };

  return { ok: true, claims };
}
