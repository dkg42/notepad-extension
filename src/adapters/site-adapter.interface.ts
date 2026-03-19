/**
 * Base adapter interface shared by all site-specific adapters.
 * Both ChatSiteAdapter and SourcePanelAdapter extend this.
 */
export interface SiteAdapter {
  /** Hostname substrings this adapter handles (e.g. ['chatgpt.com', 'chat.openai.com']) */
  readonly hostnames: readonly string[];
}