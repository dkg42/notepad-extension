/**
 * @module site-adapter.interface
 * @description Provides the minimal base contract shared by every site-specific adapter in the extension. All higher-level adapter interfaces (ChatSiteAdapter, SourcePanelAdapter, StudioPanelAdapter) extend SiteAdapter so that hostname matching is universally available through one interface.
 * @dependencies (none)
 * @public SiteAdapter
 */
/**
 * Base adapter interface shared by all site-specific adapters.
 * Both ChatSiteAdapter and SourcePanelAdapter extend this.
 */
export interface SiteAdapter {
  /** Hostname substrings this adapter handles (e.g. ['chatgpt.com', 'chat.openai.com']) */
  readonly hostnames: readonly string[];
}