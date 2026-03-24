import type { CrawlConfig } from '@/types';

/**
 * BFS web crawler that discovers linked URLs from a seed page.
 * Designed to run in the background service worker where fetch() bypasses CORS
 * for domains in the extension's host_permissions.
 */
export async function crawlUrls(config: CrawlConfig): Promise<string[]> {
  const { seedUrl, depth, sameDomainOnly, maxUrls } = config;
  const cap = Math.min(maxUrls, 200);

  let seedOrigin: string;
  try {
    seedOrigin = new URL(seedUrl).origin;
  } catch {
    throw new Error('Invalid seed URL');
  }

  const visited = new Set<string>();
  const discovered: string[] = [];

  // BFS queue: [url, currentDepth]
  let queue: Array<[string, number]> = [[normalizeUrl(seedUrl), 0]];
  visited.add(normalizeUrl(seedUrl));
  discovered.push(normalizeUrl(seedUrl));

  while (queue.length > 0 && discovered.length < cap) {
    const nextQueue: Array<[string, number]> = [];

    for (const [url, currentDepth] of queue) {
      if (discovered.length >= cap) break;
      if (currentDepth >= depth) continue;

      let links: string[];
      try {
        links = await extractLinks(url);
      } catch {
        // Skip pages that fail to fetch
        continue;
      }

      for (const link of links) {
        if (discovered.length >= cap) break;

        const normalized = normalizeUrl(link);
        if (visited.has(normalized)) continue;

        // Apply same-domain filter
        try {
          const linkOrigin = new URL(normalized).origin;
          if (sameDomainOnly && linkOrigin !== seedOrigin) continue;
        } catch {
          continue;
        }

        visited.add(normalized);
        discovered.push(normalized);
        nextQueue.push([normalized, currentDepth + 1]);
      }
    }

    queue = nextQueue;
  }

  return discovered;
}

/** Fetches a page and extracts all absolute HTTP(S) links. */
async function extractLinks(url: string): Promise<string[]> {
  const response = await fetch(url, {
    headers: { 'Accept': 'text/html' },
    credentials: 'omit',
  });

  if (!response.ok) return [];

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html')) return [];

  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const anchors = doc.querySelectorAll('a[href]');
  const links: string[] = [];

  for (const anchor of anchors) {
    const href = anchor.getAttribute('href');
    if (!href) continue;

    try {
      // Resolve relative URLs against the page URL
      const resolved = new URL(href, url);
      // Only keep http/https links
      if (resolved.protocol === 'http:' || resolved.protocol === 'https:') {
        links.push(resolved.href);
      }
    } catch {
      // Skip malformed URLs
    }
  }

  return links;
}

/** Normalizes a URL by removing fragments and trailing slashes. */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    // Remove trailing slash from pathname (except for root)
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.href;
  } catch {
    return url;
  }
}
