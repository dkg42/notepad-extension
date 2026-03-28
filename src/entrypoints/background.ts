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
  fetchAudioBlob,
} from '@/services/notebooklm-api';
import { audioCacheService } from '@/services/audio-cache-service';
import { notebookSyncService } from '@/services/notebook-sync-service';
import { notebookAnnotationService } from '@/services/notebook-annotation-service';
import { chatHistoryStorage } from '@/services/chat-history-storage';
import { importJobService } from '@/services/import-job-service';
import { crawlUrls } from '@/services/web-crawler-service';
import { fetchAndParseRssFeed } from '@/services/rss-parser-service';
import { pipelineService } from '@/services/pipeline-service';
import { evaluateAndRun } from '@/services/pipeline-executor';
import type { CrawlConfig, NotebookAnnotation, Pipeline } from '@/types';

const ALARM_NAME = 'notebooklm-sync';
const SYNC_INTERVAL_MINUTES = 30;
const AUDIO_CLEANUP_ALARM = 'audio-cache-cleanup';
const AUDIO_CLEANUP_INTERVAL_MINUTES = 60;
const PIPELINE_CHECK_ALARM = 'pipeline-check';
const PIPELINE_CHECK_INTERVAL_MINUTES = 15;

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

/**
 * Returns true if the pipeline has any trigger that requires periodic polling
 * (source counts, artifact lists) rather than storage-change events.
 */
function needsPolling(pipeline: Pipeline): boolean {
  return ['source-added', 'audio-generated', 'min-sources'].includes(pipeline.trigger.type);
}

/**
 * Periodic pipeline check — evaluates source-added, audio-generated, and
 * min-sources triggers by comparing current API data to stored baselines.
 */
async function runPipelineCheck(): Promise<void> {
  try {
    const pipelines = await pipelineService.getAll();
    const pollable = pipelines.filter((p) => p.enabled && needsPolling(p));
    if (pollable.length === 0) return;

    const [notebooks, annotations, collections, sourceBaseline, artifactBaseline] =
      await Promise.all([
        notebookSyncService.getAll(),
        notebookAnnotationService.getAllAnnotations(),
        notebookAnnotationService.getAllCollections(),
        pipelineService.getSourceBaseline(),
        pipelineService.getArtifactBaseline(),
      ]);

    if (notebooks.length === 0) return;

    // Fetch current source counts in batch
    const sourceCounts = await fetchSourceCounts(notebooks.map((n) => n.id));

    // Fetch artifact IDs per notebook (only those needed by pipelines)
    const artifactIds: Record<string, string[]> = {};
    const needsArtifacts = pollable.some((p) => p.trigger.type === 'audio-generated');
    if (needsArtifacts) {
      await Promise.all(
        notebooks.map(async (nb) => {
          try {
            const arts = await listArtifacts(nb.id);
            artifactIds[nb.id] = arts.map((a) => a.id);
          } catch {
            // Skip — partial data is fine for trigger diffing
          }
        }),
      );
    }

    const runs = await evaluateAndRun(pollable, {
      notebooks,
      annotations,
      collections,
      sourceCounts,
      sourceBaseline,
      artifactIds,
      artifactBaseline,
    });

    for (const run of runs) {
      await pipelineService.appendRun(run);
      // Update lastFiredAt for one-shot triggers
      const pipeline = pollable.find((p) => p.id === run.pipelineId);
      if (pipeline && ['min-sources', 'audio-generated'].includes(pipeline.trigger.type)) {
        await pipelineService.updateLastFiredAt(pipeline.id, run.notebookId, run.triggeredAt);
      }
    }

    // Update baselines for next cycle
    await pipelineService.setSourceBaseline(sourceCounts);
    if (needsArtifacts) {
      await pipelineService.setArtifactBaseline(artifactIds);
    }
  } catch (err) {
    console.warn('[NLM-EXT BG] Pipeline check failed:', err);
  }
}

/**
 * Fires annotation-driven triggers (notebook-tag-added, moved-to-collection,
 * title-contains) when storage.sync annotation data changes.
 */
async function runPipelineAnnotationTriggers(
  newAnnotations: NotebookAnnotation[],
  oldAnnotations: NotebookAnnotation[],
): Promise<void> {
  try {
    const pipelines = await pipelineService.getAll();
    const eventDriven = pipelines.filter(
      (p) =>
        p.enabled &&
        ['notebook-tag-added', 'moved-to-collection', 'title-contains'].includes(p.trigger.type),
    );
    if (eventDriven.length === 0) return;

    const [notebooks, collections] = await Promise.all([
      notebookSyncService.getAll(),
      notebookAnnotationService.getAllCollections(),
    ]);

    // Find annotations that changed
    const changedPairs: Array<{ current: NotebookAnnotation; previous?: NotebookAnnotation }> = [];
    for (const current of newAnnotations) {
      const previous = oldAnnotations.find((a) => a.notebookId === current.notebookId);
      if (JSON.stringify(current) !== JSON.stringify(previous)) {
        changedPairs.push({ current, previous });
      }
    }
    // Also handle newly added annotations (no previous entry)
    for (const current of newAnnotations) {
      if (!oldAnnotations.find((a) => a.notebookId === current.notebookId)) {
        changedPairs.push({ current, previous: undefined });
      }
    }

    for (const { current, previous } of changedPairs) {
      const runs = await evaluateAndRun(eventDriven, {
        notebooks,
        annotations: newAnnotations,
        collections,
        changedNotebookId: current.notebookId,
        changedAnnotation: current,
        previousAnnotation: previous,
      });

      for (const run of runs) {
        await pipelineService.appendRun(run);
      }
    }

    // Also run title-contains for any notebook if this is the first sync
    const titlePipelines = eventDriven.filter((p) => p.trigger.type === 'title-contains');
    if (titlePipelines.length > 0) {
      const runs = await evaluateAndRun(titlePipelines, {
        notebooks,
        annotations: newAnnotations,
        collections,
      });
      for (const run of runs) {
        await pipelineService.appendRun(run);
      }
    }
  } catch (err) {
    console.warn('[NLM-EXT BG] Pipeline annotation trigger failed:', err);
  }
}

function isMessage(value: unknown): value is { type: string } {
  return typeof value === 'object' && value !== null && 'type' in value;
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
    chrome.alarms.create(AUDIO_CLEANUP_ALARM, { periodInMinutes: AUDIO_CLEANUP_INTERVAL_MINUTES });
    chrome.alarms.create(PIPELINE_CHECK_ALARM, { periodInMinutes: PIPELINE_CHECK_INTERVAL_MINUTES });
  });

  // Sync on browser startup
  chrome.runtime.onStartup.addListener(() => {
    void syncNotebooks();
    void audioCacheService.cleanup();
    void runPipelineCheck();
  });

  // Periodic sync via alarms
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
      void syncNotebooks();
    } else if (alarm.name === AUDIO_CLEANUP_ALARM) {
      void audioCacheService.cleanup();
    } else if (alarm.name === PIPELINE_CHECK_ALARM) {
      void runPipelineCheck();
    }
  });

  // Storage change listener for annotation-driven pipeline triggers
  chrome.storage.sync.onChanged.addListener((changes) => {
    if ('notebookAnnotations' in changes) {
      const newAnnotations = (changes.notebookAnnotations.newValue as NotebookAnnotation[]) ?? [];
      const oldAnnotations = (changes.notebookAnnotations.oldValue as NotebookAnnotation[]) ?? [];
      void runPipelineAnnotationTriggers(newAnnotations, oldAnnotations);
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
          // Return early if already cached in IndexedDB
          const cached = await audioCacheService.get(artifactId);
          if (cached) {
            console.log('[NLM-EXT BG] FETCH_AUDIO_FOR_PLAYBACK: cache hit for', artifactId);
            return;
          }

          // Fetch directly from the background service worker.
          // host_permissions for the Google CDN domains allows cookies to be sent
          // and CORS to be bypassed — no content script relay needed.
          console.log('[NLM-EXT BG] FETCH_AUDIO_FOR_PLAYBACK: fetching', url);
          const { blob, mimeType } = await fetchAudioBlob(url);
          await audioCacheService.put(artifactId, blob, mimeType);
          console.log('[NLM-EXT BG] FETCH_AUDIO_FOR_PLAYBACK: cached', artifactId, blob.size, 'bytes');
        })()
          .then(() => sendResponse({ ok: true }))
          .catch((err: unknown) =>
            sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
          );
        return true;
      }

      // ── Chat history sync handlers ─────────────────────────────────────────

      if (message.type === 'SYNC_CHAT_CONVERSATIONS') {
        const { platform, conversations } = message as {
          type: string;
          platform: import('@/types').ChatPlatform;
          conversations: import('@/types').ConversationMeta[];
        };
        chatHistoryStorage.upsertConversations(conversations)
          .then(() => sendResponse({ ok: true }))
          .catch((err: unknown) =>
            sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
          );
        return true;
      }

      if (message.type === 'SYNC_CHAT_CONVERSATION_CONTENT') {
        const { conversation } = message as {
          type: string;
          conversation: import('@/types').ConversationFull;
        };
        chatHistoryStorage.saveConversationContent(conversation)
          .then(() => sendResponse({ ok: true }))
          .catch((err: unknown) =>
            sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
          );
        return true;
      }

      if (message.type === 'UPDATE_CHAT_SYNC_META') {
        const { platform, ...meta } = message as {
          type: string;
          platform: import('@/types').ChatPlatform;
          lastSyncedAt?: number;
          conversationCount?: number;
          error?: string;
        };
        chatHistoryStorage.setSyncMeta(platform, meta)
          .then(() => sendResponse({ ok: true }))
          .catch((err: unknown) =>
            sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
          );
        return true;
      }

      if (message.type === 'GET_CHAT_CONVERSATIONS') {
        const { platform } = message as { type: string; platform?: import('@/types').ChatPlatform };
        chatHistoryStorage.getConversations(platform)
          .then((conversations) => sendResponse({ ok: true, conversations }))
          .catch((err: unknown) =>
            sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
          );
        return true;
      }

      if (message.type === 'GET_CHAT_CONVERSATION_CONTENT') {
        const { platform, id } = message as {
          type: string;
          platform: import('@/types').ChatPlatform;
          id: string;
        };
        (async () => {
          // Return cached content if available
          const cached = await chatHistoryStorage.getConversationContent(platform, id);
          if (cached) return { ok: true, conversation: cached };

          // For ChatGPT/Claude: any authenticated tab works (REST APIs, fetch by ID).
          // For Gemini: no REST API exists — content must be extracted from the rendered DOM.
          //   First check if the specific conversation is already open in a tab.
          //   If not, open it in a background tab, extract, then close it.
          if (platform === 'gemini') {
            const conversationUrl = `https://gemini.google.com/app/${id}`;
            const existingTabs = await chrome.tabs.query({ url: conversationUrl });
            const { tabId, created } = existingTabs.length > 0 && existingTabs[0].id
              ? { tabId: existingTabs[0].id, created: false }
              : await (async () => {
                  const tab = await chrome.tabs.create({ url: conversationUrl, active: false });
                  await new Promise<void>((resolve, reject) => {
                    const listener = (updatedId: number, info: chrome.tabs.TabChangeInfo) => {
                      if (updatedId === tab.id && info.status === 'complete') {
                        chrome.tabs.onUpdated.removeListener(listener);
                        chrome.tabs.get(tab.id!).then((t) => {
                          if (t.url?.startsWith('https://gemini.google.com')) {
                            resolve();
                          } else {
                            chrome.tabs.remove(tab.id!).catch(() => {});
                            reject(new Error('Gemini requires authentication. Please open Gemini and sign in.'));
                          }
                        }).catch(reject);
                      }
                    };
                    chrome.tabs.onUpdated.addListener(listener);
                  });
                  return { tabId: tab.id!, created: true };
                })();

            try {
              const result = await sendMessageToTab<{ ok: boolean; conversation?: import('@/types').ConversationFull; error?: string }>(
                tabId,
                { type: 'FETCH_CONVERSATION_FOR_SYNC', id },
              );
              if (result?.ok && result.conversation) {
                await chatHistoryStorage.saveConversationContent(result.conversation);
                return { ok: true, conversation: result.conversation };
              }
              return { ok: false, error: result?.error ?? 'Failed to extract Gemini conversation from DOM' };
            } finally {
              if (created) chrome.tabs.remove(tabId).catch(() => {});
            }
          }

          // ChatGPT / Claude: find any authenticated tab and fetch via REST API
          const urlPatterns: Record<string, string> = {
            chatgpt: 'https://chatgpt.com/*',
            claude: 'https://claude.ai/*',
          };
          const pattern = urlPatterns[platform];
          if (!pattern) return { ok: false, error: 'Unknown platform' };

          const tabs = await chrome.tabs.query({ url: pattern });
          if (tabs.length === 0 || !tabs[0].id) {
            return { ok: false, error: `Please open ${platform} in a tab to sync this conversation` };
          }

          const result = await sendMessageToTab<{ ok: boolean; conversation?: import('@/types').ConversationFull; error?: string }>(
            tabs[0].id,
            { type: 'FETCH_CONVERSATION_FOR_SYNC', id },
          );

          if (result?.ok && result.conversation) {
            await chatHistoryStorage.saveConversationContent(result.conversation);
            return { ok: true, conversation: result.conversation };
          }
          return { ok: false, error: result?.error ?? 'Failed to fetch conversation content' };
        })()
          .then((result) => sendResponse(result))
          .catch((err: unknown) =>
            sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
          );
        return true;
      }

      if (message.type === 'GET_CHAT_SYNC_META') {
        chatHistoryStorage.getSyncMeta()
          .then((meta) => sendResponse({ ok: true, meta }))
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
        audioCacheService.clear()
          .then(() => sendResponse({ ok: true }))
          .catch((err: unknown) =>
            sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
          );
        return true;
      }

      // ── Delete all sources (rate-limited, used by pipeline executor) ───────

      if (message.type === 'DELETE_ALL_SOURCES') {
        const { notebookId } = message as { type: string; notebookId: string };
        (async () => {
          const sources = await fetchNotebookSourcesDetailed(notebookId);
          for (const src of sources) {
            await deleteSource(src.id);
            // Match the rate-limiting pattern from import-job-service
            await new Promise((r) => setTimeout(r, 500));
          }
        })()
          .then(() => sendResponse({ ok: true }))
          .catch((err: unknown) =>
            sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
          );
        return true;
      }

      // ── Pipeline CRUD handlers ─────────────────────────────────────────────

      if (message.type === 'GET_PIPELINES') {
        pipelineService.getAll()
          .then((pipelines) => sendResponse({ ok: true, pipelines }))
          .catch((err: unknown) =>
            sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
          );
        return true;
      }

      if (message.type === 'SAVE_PIPELINE') {
        const { pipeline } = message as { type: string; pipeline: Pipeline };
        pipelineService.save(pipeline)
          .then(() => sendResponse({ ok: true }))
          .catch((err: unknown) =>
            sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
          );
        return true;
      }

      if (message.type === 'DELETE_PIPELINE') {
        const { id } = message as { type: string; id: string };
        pipelineService.remove(id)
          .then(() => sendResponse({ ok: true }))
          .catch((err: unknown) =>
            sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
          );
        return true;
      }

      if (message.type === 'TOGGLE_PIPELINE') {
        const { id } = message as { type: string; id: string };
        pipelineService.toggleEnabled(id)
          .then(() => sendResponse({ ok: true }))
          .catch((err: unknown) =>
            sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
          );
        return true;
      }

      if (message.type === 'GET_PIPELINE_RUNS') {
        const { pipelineId } = message as { type: string; pipelineId?: string };
        pipelineService.getRuns(pipelineId)
          .then((runs) => sendResponse({ ok: true, runs }))
          .catch((err: unknown) =>
            sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
          );
        return true;
      }

      if (message.type === 'CLEAR_PIPELINE_RUNS') {
        pipelineService.clearRuns()
          .then(() => sendResponse({ ok: true }))
          .catch((err: unknown) =>
            sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
          );
        return true;
      }

      if (message.type === 'RUN_PIPELINE_NOW') {
        const { pipeline } = message as { type: string; pipeline: Pipeline };
        (async () => {
          const [notebooks, annotations, collections] = await Promise.all([
            notebookSyncService.getAll(),
            notebookAnnotationService.getAllAnnotations(),
            notebookAnnotationService.getAllCollections(),
          ]);
          const runs = await evaluateAndRun([pipeline], {
            notebooks,
            annotations,
            collections,
          });
          for (const run of runs) {
            await pipelineService.appendRun(run);
          }
          return runs;
        })()
          .then((runs) => sendResponse({ ok: true, runs }))
          .catch((err: unknown) =>
            sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
          );
        return true;
      }

      return false;
    },
  );
});
