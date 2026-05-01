/**
 * @module import-handler
 * @description Handles import/crawl chrome.runtime messages for the background service worker.
 * @dependencies import-job-service, web-crawler-service, rss-parser-service
 * @public handleImportMessage
 */
import { importJobService } from '@/services/import-job-service';
import { crawlUrls } from '@/services/web-crawler-service';
import { fetchAndParseRssFeed } from '@/services/rss-parser-service';
import type { CrawlConfig } from '@/types';

export function handleImportMessage(
  message: { type: string } & Record<string, unknown>,
  sendResponse: (response: unknown) => void,
): boolean | undefined {
  // ── Import Jobs ───────────────────────────────────────────────────────

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

  return undefined; // not handled
}
