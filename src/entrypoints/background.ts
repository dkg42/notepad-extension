/**
 * @module background
 * @description The Manifest V3 background service worker — the single message-routing hub for the entire extension. Handles notebook sync (on install/startup/alarm), periodic pipeline evaluation, Firebase OAuth via offscreen document, Drive AppData sync, chat history storage, bulk source import, audio caching, and all CRUD operations exposed to the dashboard and content scripts.
 * @dependencies @/services/notebooklm-api, @/services/storage-service, @/services/chat-history-storage, @/services/pipeline-service, @/services/pipeline-executor, @/services/auth-storage-service, @/services/token-lifecycle-service, @/services/drive/drive-init-service, @/services/drive/drive-sync-service, @/types
 * @public default (WXT background definition)
 */
import { defineBackground } from 'wxt/sandbox';
import { audioCacheService } from '@/services/audio-cache-service';
import { podcastAudioService } from '@/services/podcast-audio-service';
import { storageService } from '@/services/storage-service';
import { domainRouterService } from '@/services/domain-router-service';
import { notebookSyncService } from '@/services/notebook-sync-service';
import { notebookAnnotationService } from '@/services/notebook-annotation-service';
import { sourceCountCacheService } from '@/services/source-count-cache-service';
import { allSourcesCacheService } from '@/services/all-sources-cache-service';
import { allArtifactsCacheService } from '@/services/all-artifacts-cache-service';
import { chatHistoryStorage } from '@/services/chat-history-storage';
import { pipelineService } from '@/services/pipeline-service';
import { ensureGoogleSession, invalidateSessionCache } from '@/services/google-session-service';
import type { AuthError } from 'firebase/auth/web-extension';
import { signInWithCustomToken, signOut } from 'firebase/auth/web-extension';
import type { NotebookAnnotation } from '@/types';
import { authStorageService, type OAuthCredentialPayload } from '@/services/auth-storage-service';
import { getFirebaseAuth } from '@/services/firebase-app';
import { dataStorage } from '@/services/storage/data-storage';
import { isProClaims } from '@/utils/subscription';
import { verifyFirebaseIdToken } from '@/services/firebase-claims-verifier';
import {
  TOKEN_REFRESH_ALARM,
  handleRefreshAlarm,
  scheduleRefreshAlarm,
  cancelRefreshAlarm,
  revokeToken,
  getValidToken,
} from '@/services/token-lifecycle-service';
import { driveInitService } from '@/services/drive/drive-init-service';
import { driveWriteQueue } from '@/services/drive/drive-write-queue';
import { tabGroupsSyncService } from '@/services/tab-groups-sync-service';
import { clipboardSessionService } from '@/services/clipboard-session-service';
import { isAuthCancellation } from '@/utils/auth-errors';
import { scopedStorage } from '@/services/storage/scoped-storage';
import { logger } from '@/utils/logger';

import { isMessage, ensureSignedIn } from '@/background/shared';
import { syncNotebooks } from '@/background/notebook-handler';
import { handleNotebookMessage } from '@/background/notebook-handler';
import { handleSourceMessage } from '@/background/source-handler';
import { handleAudioMessage } from '@/background/audio-handler';
import { handleChatHistoryMessage } from '@/background/chat-history-handler';
import { handleImportMessage } from '@/background/import-handler';
import {
  handlePipelineMessage,
  runPipelineCheck,
  runPipelineAnnotationTriggers,
} from '@/background/pipeline-handler';
import { handleDriveMessage } from '@/background/drive-handler';
import { handleScreenshotMessage } from '@/background/screenshot-handler';

const ALARM_NAME = 'notebooklm-sync';
const OFFSCREEN_DOCUMENT_PATH = '/offscreen.html';
const SYNC_INTERVAL_MINUTES = 30;
const AUDIO_CLEANUP_ALARM = 'audio-cache-cleanup';
const AUDIO_CLEANUP_INTERVAL_MINUTES = 60;
const PIPELINE_CHECK_ALARM = 'pipeline-check';
const PIPELINE_CHECK_INTERVAL_MINUTES = 15;
const TAB_GROUPS_SYNC_ALARM = 'tab-groups-sync';
const TAB_GROUPS_SYNC_INTERVAL_MINUTES = 5;

// ── Offscreen document helpers (following official Chrome extension auth guide) ──

// Global promise guards against concurrent createDocument calls
let creatingOffscreenDocument: Promise<void> | null = null;

/** Returns `true` when the offscreen document at `OFFSCREEN_DOCUMENT_PATH` is currently active. */
async function hasDocument(): Promise<boolean> {
  // Use clients.matchAll() with an exact URL match — the pattern from the
  // official Firebase Chrome extension authentication guide.
  type ClientsAPI = { matchAll(): Promise<Array<{ url: string }>> };
  const clientsAPI = (self as unknown as { clients: ClientsAPI }).clients;
  const matchedClients = await clientsAPI.matchAll();
  return matchedClients.some(
    (c) => c.url === chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH),
  );
}

/**
 * Ensures the offscreen document at `path` is running, creating it only when
 * absent and serialising concurrent creation attempts via a module-level guard.
 */
async function setupOffscreenDocument(path: string): Promise<void> {
  // Reuse the existing document if it's already running — the iframe inside it
  // will already be loaded, avoiding the race condition where postMessage to
  // the iframe arrives before the external page's listener is registered.
  if (!(await hasDocument())) {
    if (creatingOffscreenDocument) {
      logger.debug('[AUTH][BG] Waiting for in-progress offscreen document creation');
      await creatingOffscreenDocument;
    } else {
      logger.debug('[AUTH][BG] Creating offscreen document:', path);
      creatingOffscreenDocument = chrome.offscreen.createDocument({
        url: path,
        reasons: [chrome.offscreen.Reason.DOM_SCRAPING],
        justification: 'authentication',
      });
      await creatingOffscreenDocument;
      creatingOffscreenDocument = null;
      logger.debug('[AUTH][BG] Offscreen document created');
    }
  } else {
    logger.debug('[AUTH][BG] Reusing existing offscreen document');
  }
}

/** Closes the offscreen document if one is currently active; no-ops otherwise. */
async function closeOffscreenDocument(): Promise<void> {
  if (!(await hasDocument())) {
    return;
  }
  logger.debug('[AUTH][BG] Closing offscreen document');
  await chrome.offscreen.closeDocument();
  logger.debug('[AUTH][BG] Offscreen document closed');
}

/**
 * Initiates Firebase auth via the offscreen document and returns a Promise that
 * resolves with the UserCredential once the Google sign-in popup completes.
 *
 * The offscreen document ACKs the initial `firebase-auth` message immediately
 * (so Chrome never sees an unclosed channel), then sends a separate `AUTH_RESULT`
 * message when the iframe finishes the auth flow. This listener captures that
 * second message to resolve/reject the Promise.
 */
function requestFirebaseAuth(): Promise<OAuthCredentialPayload> {
  return new Promise<OAuthCredentialPayload>((resolve, reject) => {
    // Register the AUTH_RESULT listener BEFORE sending the initiation message
    // to guarantee we never miss the response.
    const authResultListener = (message: unknown): void => {
      if (!isMessage(message)) return;
      const msg = message as { type: string; ok?: boolean; result?: OAuthCredentialPayload; error?: string };
      if (msg.type !== 'AUTH_RESULT') return;

      chrome.runtime.onMessage.removeListener(authResultListener);

      if (msg.ok && msg.result) {
        resolve(msg.result);
      } else {
        reject(new Error(msg.error ?? 'Authentication failed'));
      }
    };

    chrome.runtime.onMessage.addListener(authResultListener);

    // Send the initiation message. The offscreen document ACKs this synchronously,
    // so the Promise returned by sendMessage resolves quickly (no channel timeout).
    chrome.runtime.sendMessage({ type: 'firebase-auth', target: 'offscreen' })
      .catch((err: unknown) => {
        chrome.runtime.onMessage.removeListener(authResultListener);
        reject(err instanceof Error ? err : new Error(String(err)));
      });
  });
}

/**
 * Brings any popup-type window created during the call to the foreground.
 * On macOS, the Google OAuth popup spawned by GIS inside our offscreen iframe
 * opens behind the main browser window because the user-activation chain is
 * broken by the service-worker hop. Returns an unsubscribe function.
 */
function focusPopupsDuringAuth(): () => void {
  const handleCreated = (win: chrome.windows.Window): void => {
    if (win.type !== 'popup' || win.id === undefined) return;
    chrome.windows.update(win.id, { focused: true, drawAttention: true })
      .catch((err: unknown) => {
        console.warn('[AUTH][BG] Failed to focus OAuth popup:', err);
      });
  };
  chrome.windows.onCreated.addListener(handleCreated);
  return () => chrome.windows.onCreated.removeListener(handleCreated);
}

/**
 * Orchestrates the full Firebase OAuth flow: creates the offscreen document,
 * delegates to `requestFirebaseAuth`, and ensures the document is closed on
 * both success and failure.
 * @returns The resolved `OAuthCredentialPayload` from the Google sign-in popup.
 * @throws `AuthError` when the popup is cancelled, blocked, or the provider is
 *   not enabled in the Firebase console.
 */
async function firebaseAuth(): Promise<OAuthCredentialPayload> {
  await setupOffscreenDocument(OFFSCREEN_DOCUMENT_PATH);
  const stopFocusingPopups = focusPopupsDuringAuth();

  try {
    const credential = await requestFirebaseAuth();
    logger.debug('[AUTH][BG] OAuth credential received, providerId:', credential.providerId);
    return credential;
  } catch (err) {
    const authErr = err as AuthError;
    const message = err instanceof Error ? err.message : String(err);
    if (authErr.code === 'auth/popup-closed-by-user' || isAuthCancellation(message)) {
      logger.info('[AUTH][BG] sign-in cancelled by user');
    } else if (authErr.code === 'auth/operation-not-allowed') {
      console.error(
        '[AUTH][BG] You must enable an OAuth provider in the Firebase console' +
          ' in order to use signInWithPopup.',
      );
    } else {
      console.error('[AUTH][BG] Authentication error:', err);
    }
    // Re-throw so the message handler's .catch() sends { ok: false } to the caller.
    // Returning undefined here would cause the .then() branch to run and incorrectly
    // report success while storing nothing in chrome.storage.
    throw err;
  } finally {
    stopFocusingPopups();
    await closeOffscreenDocument();
  }
}

/**
 * Establishes a live Firebase Auth SDK session from the custom token minted by
 * the storeGoogleToken Cloud Function (forwarded in the BFF sign-in payload), so
 * the Functions SDK (httpsCallable) attaches the caller's ID token automatically,
 * populating request.auth server-side.
 *
 * Required, not best-effort: every Callable Function (token refresh/revoke, etc.)
 * depends on this session, so a failure here must fail the sign-in rather than
 * leave a silently broken state. The thrown error propagates to the firebase-auth
 * handler's .catch, which reports { ok: false } to the popup.
 */
async function establishFirebaseSdkSession(credential: OAuthCredentialPayload): Promise<void> {
  if (!credential.customToken) {
    throw new Error('No custom token in auth payload — cannot establish Firebase SDK session');
  }
  await signInWithCustomToken(getFirebaseAuth(), credential.customToken);
  logger.debug('[AUTH][BG] Firebase SDK session established (signInWithCustomToken)');
}

/**
 * Handles auth/session and clipboard messages that are tightly coupled to the
 * service worker lifecycle (offscreen document, Firebase auth, clipboard).
 * Kept inline in background.ts — do not extract to a handler module.
 */
function handleAuthSessionMessage(
  message: { type: string } & Record<string, unknown>,
  sendResponse: (response: unknown) => void,
): boolean | undefined {
  // ── Auth / Session ────────────────────────────────────────────────────

  if (message.type === 'ensure-google-session') {
    ensureSignedIn()
      .then(() => ensureGoogleSession())
      .then(() => sendResponse({ ok: true }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  if (message.type === 'firebase-auth') {
    logger.debug('[AUTH][BG] Received firebase-auth message from popup');
    firebaseAuth()
      .then(async (credential) => {
        // Guard: a FirebaseError object ({ code, name }) must never reach storage.
        // This can happen if the offscreen filter fails to catch a cancellation.
        const raw = credential as unknown as Record<string, unknown>;
        if (typeof raw.code === 'string' && raw.code.startsWith('auth/')) {
          console.warn('[AUTH][BG] Received FirebaseError as credential — rejecting:', raw.code);
          sendResponse({ ok: false, error: String(raw.code) });
          return;
        }
        // Clear all user data if a different user is signing in, or if there
        // is no prior local auth record (stale sync data may remain from a
        // previous session that was signed out on another device).
        const existingProfile = await authStorageService.getAuthProfile();
        const existingUid: string | null = existingProfile?.uid ?? null;
        const incomingUid: string | null = credential.user.uid;
        const syncMeta = await notebookSyncService.getSyncMeta();
        const isUserSwitch = existingUid && incomingUid && existingUid !== incomingUid;
        const hasOrphanedSyncData = !existingUid && syncMeta?.ownerUid;
        if (isUserSwitch || hasOrphanedSyncData) {
          logger.debug('[AUTH][BG] User switch or orphaned data detected — clearing', { existingUid, incomingUid, syncOwner: syncMeta?.ownerUid });
          invalidateSessionCache();
          await Promise.all([
            storageService.clearAllData(),
            chatHistoryStorage.clearAllData(),
            pipelineService.clearAllData(),
            notebookSyncService.clear(),
            notebookAnnotationService.clearAllData(),
            audioCacheService.clear(),
            podcastAudioService.clear(),
            domainRouterService.clearAllData(),
            sourceCountCacheService.clear(),
            allSourcesCacheService.clear(),
            allArtifactsCacheService.clear(),
          ]);
        }
        // Establish the Firebase SDK session FIRST. It is required for every
        // Callable Function below (ensureGoogleSession / getValidToken proxy
        // through it); a failure here throws and fails the sign-in via the
        // .catch, so we never persist a saved-but-broken profile.
        await establishFirebaseSdkSession(credential);
        // Verify the Firebase ID token and persist subscription claims BEFORE
        // writing the profile below. Writing the profile is what reactive UIs
        // (e.g. the side panel's onProfileChanged listener) key off to fire
        // DRIVE_INITIALIZE, and the background's own Drive init runs right after.
        // Both gate on the stored claims via isProUser(), so the claims must be
        // in storage first — otherwise a Pro user is briefly seen as free-tier
        // and Drive sync is skipped until something re-triggers it.
        // Awaited but non-fatal: a verification failure does not block sign-in
        // (the user is treated as free-tier until the next claims refresh).
        try {
          const claimsResult = await verifyFirebaseIdToken(credential._tokenResponse.idToken);
          if (claimsResult.ok) {
            await authStorageService.saveAuthClaims(claimsResult.claims);
          } else {
            console.warn('[AUTH][BG] ID token claim verification failed:', claimsResult.reason);
          }
        } catch (err: unknown) {
          console.warn('[AUTH][BG] Unexpected error verifying ID token claims:', err);
        }
        logger.debug('[AUTH][BG] Auth complete, storing profile and session token');
        await authStorageService.saveAuthData(credential);
        void scheduleRefreshAlarm();
        logger.debug('[AUTH][BG] Auth complete, sending ok to popup');
        sendResponse({ ok: true });
        // Proactively establish the NotebookLM Google session so batchRPC
        // calls work immediately after sign-in. Fire-and-forget — any failure
        // here is handled gracefully on the first actual API call.
        ensureGoogleSession().catch((err: unknown) => {
          console.warn('[AUTH][BG] Proactive NotebookLM session setup failed:', err);
        });
        // Initialize Drive AppData sync — migrate local data or validate
        // ETag-based freshness for returning users. Fire-and-forget.
        getValidToken().then((tokenResult) => {
          if (!tokenResult.ok || !tokenResult.hasDriveScope) return;
          void driveInitService.initialize(tokenResult.accessToken, credential.user.uid ?? '').catch((err: unknown) => {
            console.warn('[AUTH][BG] Drive init failed (non-fatal):', err);
          });
        }).catch(() => {});
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (isAuthCancellation(msg)) {
          logger.info('[AUTH][BG] Auth flow cancelled by user');
        } else {
          console.error('[AUTH][BG] Auth flow error:', err);
        }
        sendResponse({ ok: false, error: msg });
      });
    return true;
  }

  if (message.type === 'firebase-sign-out') {
    setupOffscreenDocument(OFFSCREEN_DOCUMENT_PATH)
      .then(() => new Promise<void>((resolve, reject) => {
        const signOutResultListener = (msg: unknown): void => {
          if (!isMessage(msg)) return;
          const m = msg as { type: string; ok?: boolean; error?: string };
          if (m.type !== 'SIGN_OUT_RESULT') return;
          chrome.runtime.onMessage.removeListener(signOutResultListener);
          if (m.ok) {
            resolve();
          } else {
            reject(new Error(m.error ?? 'Sign-out failed'));
          }
        };
        chrome.runtime.onMessage.addListener(signOutResultListener);
        chrome.runtime.sendMessage({ type: 'firebase-sign-out', target: 'offscreen' })
          .catch((err: unknown) => {
            chrome.runtime.onMessage.removeListener(signOutResultListener);
            reject(err instanceof Error ? err : new Error(String(err)));
          });
      }))
      .then(async () => {
        invalidateSessionCache();

        // Cancel the refresh alarm first so no stale refresh fires during clean-up.
        await cancelRefreshAlarm();

        // Revoke the Google OAuth token server-side (Cloud Function reads + revokes
        // the refresh token from Firestore and deletes the Firestore doc).
        // Best-effort: a failure must not block sign-out.
        await revokeToken().catch((err: unknown) => {
          console.warn('[AUTH][BG] Token revocation failed (non-fatal):', err);
        });

        // Clear the Firebase SDK session (currentUser + IndexedDB persistence)
        // after revocation, which needs the session to authenticate its call.
        await signOut(getFirebaseAuth()).catch((err: unknown) => {
          console.warn('[AUTH][BG] Firebase SDK signOut failed (non-fatal):', err);
        });

        // Tear down Drive sync: cancel pending writes and clear session cache
        // before clearing auth data so no stale writes fire after sign-out.
        await driveInitService.teardown();

        // Storage is per-uid via scoped-storage. Free users keep their
        // `u:<uid>:*` data so it restores on re-sign-in without a Drive round
        // trip. Pro users' data is wiped on sign-out so it cannot leak to the
        // next account that signs in on this device.
        const [profile, claims] = await Promise.all([
          authStorageService.getAuthProfile(),
          authStorageService.getAuthClaims(),
        ]);
        if (profile?.uid && isProClaims(claims)) {
          await dataStorage.clearScopedDataForUid(profile.uid);
        }
        return authStorageService.clearAll();
      })
      .then(() => sendResponse({ ok: true }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      )
      .finally(() => void closeOffscreenDocument());
    return true;
  }

  // ── Clipboard ─────────────────────────────────────────────────────────

  if (message.type === 'CLIPBOARD_COPY') {
    const { entry } = message as { type: string; entry: Parameters<typeof clipboardSessionService.add>[0] };
    clipboardSessionService.add(entry).catch(() => {});
    return false;
  }

  return undefined; // not handled
}

// ── Content-script bootstrap for already-open LLM tabs ────────────────────
// Chrome only auto-injects content scripts on fresh navigations, so tabs that
// were already open when the extension is installed / updated / the browser
// starts up will never receive the script (and thus cannot extract chat
// messages on demand). Manually inject into matching tabs to bridge that gap.

const LLM_CONTENT_SCRIPT_PATTERNS = [
  'https://chatgpt.com/*',
  'https://chat.openai.com/*',
  'https://claude.ai/*',
  'https://gemini.google.com/*',
  'https://www.perplexity.ai/*',
  'https://copilot.microsoft.com/*',
  'https://notebooklm.google.com/*',
];

async function injectContentScriptIntoExistingTabs(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ url: LLM_CONTENT_SCRIPT_PATTERNS });
    await Promise.all(
      tabs.map(async (tab) => {
        if (!tab.id) return;
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content-scripts/content.js'],
          });
        } catch { /* tab closed, restricted URL, or already injected — ignore */ }
      }),
    );
  } catch (err) {
    console.warn('[BG] LLM tab bootstrap failed (non-fatal):', err);
  }
}

export default defineBackground(() => {
  // Sync on extension install / update
  chrome.runtime.onInstalled.addListener(() => {
    void syncNotebooks();
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: SYNC_INTERVAL_MINUTES });
    chrome.alarms.create(AUDIO_CLEANUP_ALARM, { periodInMinutes: AUDIO_CLEANUP_INTERVAL_MINUTES });
    chrome.alarms.create(PIPELINE_CHECK_ALARM, { periodInMinutes: PIPELINE_CHECK_INTERVAL_MINUTES });
    chrome.alarms.create(TAB_GROUPS_SYNC_ALARM, { periodInMinutes: TAB_GROUPS_SYNC_INTERVAL_MINUTES });
    // Re-arm token refresh alarm in case the extension was updated while signed in.
    void scheduleRefreshAlarm();
    void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    void injectContentScriptIntoExistingTabs();
  });

  // Sync on browser startup
  chrome.runtime.onStartup.addListener(() => {
    void syncNotebooks();
    void audioCacheService.cleanup();
    void runPipelineCheck();
    // Re-arm token refresh alarm. chrome.storage.session is cleared on browser close,
    // so this no-ops when signed out; the first Drive call will do a just-in-time refresh.
    void scheduleRefreshAlarm();
    void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    void injectContentScriptIntoExistingTabs();
    // Re-initialize Drive sync. chrome.storage.session is cleared on browser close so the
    // manifest session cache is gone — reload from Drive for signed-in users with Drive scope.
    void (async () => {
      const [tokenResult, profile] = await Promise.all([
        getValidToken(),
        authStorageService.getAuthProfile(),
      ]);
      if (!tokenResult.ok || !tokenResult.hasDriveScope || !profile?.uid) return;
      await driveInitService.initialize(tokenResult.accessToken, profile.uid);
    })().catch((err: unknown) => {
      console.warn('[STARTUP] Drive re-init failed (non-fatal):', err);
    });
  });

  // Periodic sync via alarms
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
      void syncNotebooks();
    } else if (alarm.name === AUDIO_CLEANUP_ALARM) {
      void audioCacheService.cleanup();
    } else if (alarm.name === PIPELINE_CHECK_ALARM) {
      void runPipelineCheck();
    } else if (alarm.name === TAB_GROUPS_SYNC_ALARM) {
      void tabGroupsSyncService.syncTabGroupsIfChanged();
    } else if (alarm.name === TOKEN_REFRESH_ALARM) {
      void handleRefreshAlarm();
    }
  });

  // Storage change listener for annotation-driven pipeline triggers
  scopedStorage.onChanged<NotebookAnnotation[]>('notebookAnnotations', (changes) => {
    const newAnnotations = changes.notebookAnnotations?.newValue ?? [];
    const oldAnnotations = changes.notebookAnnotations?.oldValue ?? [];
    void runPipelineAnnotationTriggers(newAnnotations, oldAnnotations);
  });

  // Manual sync triggered from dashboard
  chrome.runtime.onMessage.addListener(
    (message: unknown, _sender, sendResponse: (r: unknown) => void) => {
      if (!isMessage(message)) return false;

      return (
        handleDriveMessage(message, sendResponse) ??
        handleNotebookMessage(message, sendResponse) ??
        handleSourceMessage(message, sendResponse) ??
        handleAudioMessage(message, sendResponse) ??
        handleChatHistoryMessage(message, sendResponse) ??
        handleImportMessage(message, sendResponse) ??
        handlePipelineMessage(message, sendResponse) ??
        handleScreenshotMessage(message, sendResponse) ??
        handleAuthSessionMessage(message, sendResponse) ??
        false
      );
    },
  );

  // Flush any pending Drive writes before the service worker is terminated.
  // Chrome gives ~5 seconds on this event, so this is best-effort.
  chrome.runtime.onSuspend.addListener(() => {
    // Snapshot tab groups (if changed) so the latest state is enqueued, then
    // drain all pending Drive writes before the worker is killed.
    void tabGroupsSyncService
      .syncTabGroupsIfChanged()
      .finally(() => void driveWriteQueue.flushAll());
  });
});
