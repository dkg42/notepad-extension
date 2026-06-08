const WEBSITE_URL = import.meta.env.VITE_EXTERNAL_AUTH_ORIGIN as string;

/** Opens the marketing/upgrade website in a new browser tab. */
export function openUpgradePage(): void {
  void chrome.tabs.create({ url: WEBSITE_URL });
}
