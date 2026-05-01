/**
 * @module token-crypto-service
 * @description Provides AES-GCM encryption and decryption for OAuth tokens stored on disk, using a PBKDF2 key derived from the extension ID and a random per-install salt persisted in chrome.storage.local. This raises the bar against passive disk-scanning attacks on the browser profile without requiring user interaction. Available in all browser extension contexts (background, offscreen, popup, dashboard) since the Web Crypto API is universally supported.
 * @dependencies (none — uses only Web Crypto API and chrome.storage.local)
 * @public encryptToken, decryptToken, AudioCacheEntry
 */
/**
 * Token encryption service using the Web Crypto API (AES-GCM + PBKDF2).
 *
 * The encryption key is derived from the extension ID and a random per-install
 * salt stored in chrome.storage.local. This prevents trivial disk-scanning
 * attacks on the stored ciphertext without requiring user input.
 *
 * Security note: This is not keychain-grade security. A determined attacker who
 * knows the extension ID and has the stored data can brute-force the key. The
 * benefit is raising the bar against passive attacks on the browser profile directory.
 *
 * Available in: background service worker, offscreen documents, popup, dashboard.
 * (Web Crypto API is supported in all browser extension contexts.)
 */

import type { EncryptedTokenBlob } from '@/types';

const INSTALL_SALT_KEY = 'authInstallSalt';

async function getOrCreateSalt(): Promise<Uint8Array<ArrayBuffer>> {
  const stored = await chrome.storage.local.get(INSTALL_SALT_KEY);
  if (stored[INSTALL_SALT_KEY]) {
    const base64 = stored[INSTALL_SALT_KEY] as string;
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;
  }
  const salt = crypto.getRandomValues(new Uint8Array(16)) as Uint8Array<ArrayBuffer>;
  const saltBase64 = btoa(String.fromCharCode(...salt));
  await chrome.storage.local.set({ [INSTALL_SALT_KEY]: saltBase64 });
  return salt;
}

async function deriveKey(salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(chrome.runtime.id),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function toBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function fromBase64(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

export async function encryptToken(plaintext: string): Promise<EncryptedTokenBlob> {
  const salt = await getOrCreateSalt();
  const key = await deriveKey(salt);
  const iv = crypto.getRandomValues(new Uint8Array(12)) as Uint8Array<ArrayBuffer>;
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return {
    ciphertext: toBase64(ciphertext),
    iv: toBase64(iv.buffer as ArrayBuffer),
    salt: toBase64(salt.buffer as ArrayBuffer),
  };
}

export async function decryptToken(blob: EncryptedTokenBlob): Promise<string> {
  const salt = fromBase64(blob.salt) as Uint8Array<ArrayBuffer>;
  const key = await deriveKey(salt);
  const iv = fromBase64(blob.iv) as Uint8Array<ArrayBuffer>;
  const ciphertext = fromBase64(blob.ciphertext) as Uint8Array<ArrayBuffer>;
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}
