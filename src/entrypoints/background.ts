import { defineBackground } from 'wxt/sandbox';
import {
  fetchNotebooks,
  deleteNotebook,
  fetchNotebookSources,
  fetchSourceCounts,
  fetchNotebookSourcesDetailed,
  fetchNotebookFullData,
  summarizeNotebook,
  addSourceUrl,
  deleteSource,
  createAudioOverview,
  listArtifacts,
  fetchNotebookNotes,
} from '@/services/notebooklm-api';
import { notebookSyncService } from '@/services/notebook-sync-service';
import { importJobService } from '@/services/import-job-service';
import { crawlUrls } from '@/services/web-crawler-service';
import { fetchAndParseRssFeed } from '@/services/rss-parser-service';
import type { CrawlConfig } from '@/types';

const ALARM_NAME = 'notebooklm-sync';
const SYNC_INTERVAL_MINUTES = 30;

async function syncNotebooks(): Promise<void> {
  try {
    const notebooks = await fetchNotebooks();
    if (notebooks.length > 0) {
      await notebookSyncService.upsertMany(notebooks);
    }
    await notebookSyncService.setSyncMeta({ lastSyncedAt: Date.now() });
  } catch (error) {
    await notebookSyncService.setSyncMeta({
      lastSyncedAt: Date.now(),
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function isMessage(value: unknown): value is { type: string } {
  return typeof value === 'object' && value !== null && 'type' in value;
}

// In-memory audio data URL cache — survives service worker lifetime,
// cleared on manual refresh or service worker restart.
const audioCache = new Map<string, string>();

/** Ensures a notebooklm.google.com tab is loaded and returns its tab ID. */
async function ensureNotebookLmTab(): Promise<{ tabId: number; created: boolean }> {
  const tabs = await chrome.tabs.query({ url: 'https://notebooklm.google.com/*' });
  console.log('[NLM-EXT BG] tabs.query result:', tabs.map((t) => ({ id: t.id, url: t.url, status: t.status })));
  if (tabs.length > 0 && tabs[0].id) {
    console.log('[NLM-EXT BG] Reusing existing tab:', tabs[0].id, tabs[0].url);
    return { tabId: tabs[0].id, created: false };
  }
  // Create a background tab — closes after audio fetch
  console.log('[NLM-EXT BG] No existing tab found, creating new one');
  const tab = await chrome.tabs.create({
    url: 'https://notebooklm.google.com/',
    active: false,
  });
  // Wait for page to finish loading and verify it stayed on notebooklm.google.com
  // (may redirect to accounts.google.com if not authenticated)
  await new Promise<void>((resolve, reject) => {
    const listener = (updatedTabId: number, info: chrome.tabs.TabChangeInfo) => {
      if (updatedTabId === tab.id && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        // Verify the tab URL is still on the expected origin
        chrome.tabs.get(tab.id!).then((t) => {
          if (t.url?.startsWith('https://notebooklm.google.com')) {
            console.log('[NLM-EXT BG] New tab loaded successfully:', t.id, t.url);
            resolve();
          } else {
            console.log('[NLM-EXT BG] Tab redirected away:', t.url);
            // Tab redirected away (e.g. to login) — clean up and reject
            chrome.tabs.remove(tab.id!).catch(() => {});
            reject(new Error(
              'NotebookLM requires authentication. Please open https://notebooklm.google.com in a browser tab and sign in first.',
            ));
          }
        }).catch(reject);
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
  return { tabId: tab.id!, created: true };
}

/**
 * Sends a message to a tab's content script, retrying if the content script
 * hasn't registered its listener yet (common on newly created tabs).
 */
async function sendMessageToTab<T = unknown>(
  tabId: number,
  message: unknown,
  maxRetries = 5,
  delayMs = 500,
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[NLM-EXT BG] sendMessageToTab attempt ${attempt + 1}/${maxRetries + 1}, tabId=${tabId}`);
      const result = await chrome.tabs.sendMessage(tabId, message) as T;
      console.log('[NLM-EXT BG] sendMessageToTab succeeded:', result);
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[NLM-EXT BG] sendMessageToTab attempt ${attempt + 1} failed:`, msg);
      const isNoReceiver = msg.includes('Receiving end does not exist') ||
        msg.includes('Could not establish connection');
      if (!isNoReceiver || attempt === maxRetries) throw err;
      // Wait for the content script to initialize
      console.log(`[NLM-EXT BG] Retrying in ${delayMs}ms...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('Failed to reach content script');
}

export default defineBackground(() => {
  // Sync on extension install / update
  chrome.runtime.onInstalled.addListener(() => {
    void syncNotebooks();
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: SYNC_INTERVAL_MINUTES });
  });

  // Sync on browser startup
  chrome.runtime.onStartup.addListener(() => {
    void syncNotebooks();
  });

  // Periodic sync via alarms
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
      void syncNotebooks();
    }
  });

  // Manual sync triggered from dashboard
  chrome.runtime.onMessage.addListener(
    (message: unknown, _sender, sendResponse: (r: unknown) => void) => {
      if (!isMessage(message)) return false;
      if (message.type === 'SYNC_NOTEBOOKS') {
        syncNotebooks().then(() => sendResponse({ ok: true }));
        return true; // keep channel open for async
      }

      if (message.type === 'FETCH_SOURCE_COUNTS') {
        const { notebookIds } = message as { type: string; notebookIds: string[] };
        fetchSourceCounts(notebookIds)
          .then((counts) => sendResponse({ ok: true, counts }))
          .catch((err: unknown) =>
            sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
          );
        return true;
      }

      if (message.type === 'FETCH_NOTEBOOK_SOURCES') {
        const { notebookId } = message as { type: string; notebookId: string };
        fetchNotebookSources(notebookId)
          .then((sources) => sendResponse({ ok: true, sources, count: sources.length }))
          .catch((err: unknown) =>
            sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
          );
        return true;
      }

      if (message.type === 'DELETE_NOTEBOOK') {
        const { notebookId } = message as { type: string; notebookId: string };
        deleteNotebook(notebookId)
          .then(() => notebookSyncService.remove(notebookId))
          .then(() => sendResponse({ ok: true }))
          .catch((err: unknown) =>
            sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
          );
        return true; // keep channel open for async
      }

      if (message.type === 'FETCH_NOTEBOOK_SOURCES_DETAILED') {
        const { notebookId } = message as { type: string; notebookId: string };
        fetchNotebookSourcesDetailed(notebookId)
          .then((sources) => sendResponse({ ok: true, sources }))
          .catch((err: unknown) =>
            sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
          );
        return true;
      }

      if (message.type === 'FETCH_NOTEBOOK_FULL_DATA') {
        const { notebookId } = message as { type: string; notebookId: string };
        fetchNotebookFullData(notebookId)
          .then((data) => sendResponse({ ok: true, ...data }))
          .catch((err: unknown) =>
            sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
          );
        return true;
      }

      if (message.type === 'SUMMARIZE_NOTEBOOK') {
        const { notebookId } = message as { type: string; notebookId: string };
        summarizeNotebook(notebookId)
          .then((summary) => sendResponse({ ok: true, summary }))
          .catch((err: unknown) =>
            sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
          );
        return true;
      }

      if (message.type === 'ADD_SOURCE_URL') {
        const { notebookId, url } = message as { type: string; notebookId: string; url: string };
        addSourceUrl(notebookId, url)
          .then(() => sendResponse({ ok: true }))
          .catch((err: unknown) =>
            sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
          );
        return true;
      }

      if (message.type === 'DELETE_SOURCE') {
        const { sourceId } = message as { type: string; sourceId: string };
        deleteSource(sourceId)
          .then(() => sendResponse({ ok: true }))
          .catch((err: unknown) =>
            sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
          );
        return true;
      }

      if (message.type === 'CREATE_AUDIO_OVERVIEW') {
        const { notebookId, options } = message as {
          type: string;
          notebookId: string;
          options?: import('@/services/notebooklm-api').AudioOverviewOptions;
        };
        createAudioOverview(notebookId, options)
          .then(() => sendResponse({ ok: true }))
          .catch((err: unknown) =>
            sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
          );
        return true;
      }

      if (message.type === 'LIST_ARTIFACTS') {
        const { notebookId } = message as { type: string; notebookId: string };
        listArtifacts(notebookId)
          .then((artifacts) => sendResponse({ ok: true, artifacts }))
          .catch((err: unknown) =>
            sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
          );
        return true;
      }

      if (message.type === 'FETCH_NOTEBOOK_NOTES') {
        const { notebookId } = message as { type: string; notebookId: string };
        fetchNotebookNotes(notebookId)
          .then((notes) => sendResponse({ ok: true, notes }))
          .catch((err: unknown) =>
            sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
          );
        return true;
      }

      if (message.type === 'FETCH_AUDIO_FOR_PLAYBACK') {
        const { url, artifactId } = message as { type: string; url: string; artifactId: string };
        (async () => {
          // Return from in-memory cache if available
          if (artifactId && audioCache.has(artifactId)) {
            return audioCache.get(artifactId)!;
          }

          // Fetch audio via the content script running on a notebooklm.google.com tab.
          // The content script's fetch() runs with the page's origin, so Google CDN
          // cookies are sent and CORS passes — unlike the service worker's fetch().
          console.log('[NLM-EXT BG] FETCH_AUDIO_FOR_PLAYBACK: finding NLM tab...');
          const { tabId, created } = await ensureNotebookLmTab();
          console.log('[NLM-EXT BG] FETCH_AUDIO_FOR_PLAYBACK: tabId=', tabId, 'created=', created);
          try {
            const result = await sendMessageToTab<{ ok: boolean; dataUrl?: string; error?: string }>(
              tabId,
              { type: 'FETCH_AUDIO_IN_PAGE', url },
            );

            if (!result?.ok || !result.dataUrl) {
              throw new Error(result?.error ?? 'Content script returned no audio data');
            }

            // Cache the data URL
            if (artifactId) {
              audioCache.set(artifactId, result.dataUrl);
            }
            return result.dataUrl;
          } finally {
            if (created) {
              chrome.tabs.remove(tabId).catch(() => {});
            }
          }
        })()
          .then((dataUrl) => sendResponse({ ok: true, dataUrl }))
          .catch((err: unknown) =>
            sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
          );
        return true;
      }

      // ── Aggregated sources/artifacts handlers ──────────────────────────────

      if (message.type === 'FETCH_ALL_SOURCES') {
        (async () => {
          const notebooks = await notebookSyncService.getAll();
          const allSources: Array<{
            id: string; title: string; type: string; sourceUrl?: string;
            notebookId: string; notebookTitle: string;
          }> = [];

          for (const nb of notebooks) {
            try {
              const data = await fetchNotebookFullData(nb.id);
              for (const src of data.sources) {
                allSources.push({
                  id: src.id,
                  title: src.title,
                  type: src.type,
                  notebookId: nb.id,
                  notebookTitle: nb.title,
                });
              }
            } catch {
              // Skip notebooks that fail — partial results are fine
            }
          }

          return allSources;
        })()
          .then((sources) => sendResponse({ ok: true, sources }))
          .catch((err: unknown) =>
            sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
          );
        return true;
      }

      if (message.type === 'FETCH_ALL_ARTIFACTS') {
        (async () => {
          const notebooks = await notebookSyncService.getAll();
          const allArtifacts: Array<{
            id: string; title: string; typeCode: number; mediaUrl?: string;
            createdAt?: number; status?: number;
            notebookId: string; notebookTitle: string;
          }> = [];

          for (const nb of notebooks) {
            try {
              const data = await fetchNotebookFullData(nb.id);
              for (const art of data.artifacts) {
                allArtifacts.push({
                  ...art,
                  notebookId: nb.id,
                  notebookTitle: nb.title,
                });
              }
            } catch {
              // Skip notebooks that fail
            }
          }

          return allArtifacts;
        })()
          .then((artifacts) => sendResponse({ ok: true, artifacts }))
          .catch((err: unknown) =>
            sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
          );
        return true;
      }

      // ── Source import handlers ─────────────────────────────────────────────

      if (message.type === 'BULK_ADD_SOURCES') {
        const { notebookId, urls } = message as { type: string; notebookId: string; urls: string[] };
        const jobId = importJobService.createAndStart(notebookId, urls);
        sendResponse({ ok: true, jobId });
        return false; // sync response
      }

      if (message.type === 'GET_IMPORT_JOB_PROGRESS') {
        const { jobId } = message as { type: string; jobId: string };
        const progress = importJobService.getProgress(jobId);
        sendResponse(progress ? { ok: true, progress } : { ok: false, error: 'Job not found' });
        return false;
      }

      if (message.type === 'CANCEL_IMPORT_JOB') {
        const { jobId } = message as { type: string; jobId: string };
        importJobService.cancel(jobId);
        sendResponse({ ok: true });
        return false;
      }

      if (message.type === 'CRAWL_URL') {
        const { config } = message as { type: string; config: CrawlConfig };
        crawlUrls(config)
          .then((urls) => sendResponse({ ok: true, urls }))
          .catch((err: unknown) =>
            sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
          );
        return true;
      }

      if (message.type === 'FETCH_RSS_FEED') {
        const { feedUrl } = message as { type: string; feedUrl: string };
        fetchAndParseRssFeed(feedUrl)
          .then((entries) => sendResponse({ ok: true, entries }))
          .catch((err: unknown) =>
            sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
          );
        return true;
      }

      if (message.type === 'GET_BROWSER_TABS') {
        chrome.tabs.query({}).then((allTabs) => {
          const filtered = allTabs
            .filter((t) => t.url && (t.url.startsWith('http://') || t.url.startsWith('https://')))
            .map((t) => ({
              id: t.id ?? 0,
              title: t.title ?? '',
              url: t.url!,
              favIconUrl: t.favIconUrl,
            }));
          sendResponse({ ok: true, tabs: filtered });
        }).catch((err: unknown) =>
          sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
        );
        return true;
      }

      if (message.type === 'CLEAR_AUDIO_CACHE') {
        audioCache.clear();
        sendResponse({ ok: true });
        return false;
      }

      return false;
    },
  );
});
