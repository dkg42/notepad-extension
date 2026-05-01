/**
 * @module rss-parser-service
 * @description Fetches and parses RSS 2.0 and Atom feeds, returning a normalised list of entries (title, URL, publishedAt). Designed to run in the background service worker where fetch() has broader access. Detects feed format by presence of <item> vs <entry> elements and delegates to dedicated parsers for each format. All network and XML parse errors are surfaced as thrown Errors so callers can handle them appropriately.
 * @dependencies (none — pure fetch + DOMParser, no internal src/ imports)
 * @public fetchAndParseRssFeed
 */
import type { RssFeedEntry } from '@/types';

/**
 * Fetches and parses an RSS 2.0 or Atom feed, returning a list of entries.
 * Designed to run in the background service worker.
 */
export async function fetchAndParseRssFeed(feedUrl: string): Promise<RssFeedEntry[]> {
  const response = await fetch(feedUrl, {
    headers: { 'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml' },
    credentials: 'omit',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch feed: ${response.status} ${response.statusText}`);
  }

  const xml = await response.text();
  const doc = new DOMParser().parseFromString(xml, 'text/xml');

  // Check for parse errors
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Invalid XML: could not parse the feed');
  }

  // Detect feed type and parse accordingly
  const rssItems = doc.querySelectorAll('item');
  if (rssItems.length > 0) {
    return parseRss2Items(rssItems);
  }

  const atomEntries = doc.querySelectorAll('entry');
  if (atomEntries.length > 0) {
    return parseAtomEntries(atomEntries);
  }

  return [];
}

/** Parses RSS 2.0 <item> elements. */
function parseRss2Items(items: NodeListOf<Element>): RssFeedEntry[] {
  const entries: RssFeedEntry[] = [];

  for (const item of items) {
    const title = item.querySelector('title')?.textContent?.trim() ?? 'Untitled';
    const link = item.querySelector('link')?.textContent?.trim();
    const pubDate = item.querySelector('pubDate')?.textContent?.trim();

    if (!link) continue;

    entries.push({
      title,
      url: link,
      publishedAt: pubDate ? new Date(pubDate).getTime() : null,
    });
  }

  return entries;
}

/** Parses Atom <entry> elements. */
function parseAtomEntries(entryElements: NodeListOf<Element>): RssFeedEntry[] {
  const entries: RssFeedEntry[] = [];

  for (const entry of entryElements) {
    const title = entry.querySelector('title')?.textContent?.trim() ?? 'Untitled';

    // Atom links use <link href="..." /> — try rel="alternate" first, then any link
    const altLink = entry.querySelector('link[rel="alternate"]');
    const anyLink = entry.querySelector('link[href]');
    const linkEl = altLink ?? anyLink;
    const url = linkEl?.getAttribute('href')?.trim();

    const published =
      entry.querySelector('published')?.textContent?.trim() ??
      entry.querySelector('updated')?.textContent?.trim();

    if (!url) continue;

    entries.push({
      title,
      url,
      publishedAt: published ? new Date(published).getTime() : null,
    });
  }

  return entries;
}
