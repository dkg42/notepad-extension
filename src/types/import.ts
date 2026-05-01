/**
 * @module import
 * @description Type definitions for the bulk URL import and web-crawl features — crawler configuration, RSS feed entries, browser tabs for selection, domain-routing rules, bulk import job progress tracking, and the aggregated source/artifact views that span multiple notebooks in the dashboard.
 * @dependencies none
 * @public CrawlConfig, RssFeedEntry, BrowserTab, DomainRouterRule, BulkImportProgress, AggregatedSource, AggregatedArtifact, BulkImportJob
 */
/** Configuration for the web crawler import. */
export interface CrawlConfig {
  seedUrl: string;
  /** Crawl depth: 0 = seed only, 1 = links on seed page, etc. Max 3. */
  depth: number;
  /** When true, only follow links on the same domain as the seed URL. */
  sameDomainOnly: boolean;
  /** Maximum number of URLs to discover. Default 50, max 200. */
  maxUrls: number;
}

/** A single entry parsed from an RSS/Atom feed. */
export interface RssFeedEntry {
  title: string;
  url: string;
  /** Unix ms publication timestamp, or null if unavailable. */
  publishedAt: number | null;
}

/** A browser tab returned for import selection. */
export interface BrowserTab {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
}

/** A user-configured domain routing rule for auto-routing imported URLs to notebooks. */
export interface DomainRouterRule {
  id: string;
  /** The pattern to match against URLs. */
  pattern: string;
  /** How the pattern is interpreted. */
  patternType: 'domain' | 'glob' | 'regex';
  /** Target notebook ID to route matching URLs to. */
  notebookId: string;
  /** Cached notebook title for display purposes. */
  notebookTitle: string;
  createdAt: number;
  enabled: boolean;
}

/** Progress state for a bulk import job. */
export interface BulkImportProgress {
  total: number;
  completed: number;
  failed: number;
  errors: Array<{ url: string; error: string }>;
  currentUrl: string | null;
}

/** A source record enriched with notebook context for the aggregated all-sources view. */
export interface AggregatedSource {
  id: string;
  title: string;
  type: string;
  /** Source URL extracted from the API, if available (website/youtube). */
  sourceUrl?: string;
  notebookId: string;
  notebookTitle: string;
}

/** An artifact record enriched with notebook context for the aggregated all-artifacts view. */
export interface AggregatedArtifact {
  id: string;
  title: string;
  typeCode: number;
  mediaUrl?: string;
  createdAt?: number;
  status?: number;
  notebookId: string;
  notebookTitle: string;
}

/** A bulk import job managed by the background service worker. */
export interface BulkImportJob {
  id: string;
  notebookId: string;
  urls: string[];
  status: 'pending' | 'running' | 'completed' | 'cancelled';
  progress: BulkImportProgress;
  createdAt: number;
}
