import type { DomainRouterRule } from '@/types';
import { driveSyncService } from './drive/drive-sync-service';
import { getValidToken } from './token-lifecycle-service';

const STORAGE_KEY = 'domainRouterRules';

async function getDriveToken(): Promise<string | null> {
  const result = await getValidToken();
  if (!result.ok || !result.hasDriveScope) return null;
  return result.accessToken;
}

/**
 * Manages domain router rules — user-configured URL pattern → notebook mappings.
 * Rules are persisted in chrome.storage.local.
 */
export const domainRouterService = {
  async getRules(): Promise<DomainRouterRule[]> {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return (result[STORAGE_KEY] as DomainRouterRule[]) ?? [];
  },

  async saveRule(rule: DomainRouterRule): Promise<void> {
    const existing = await this.getRules();
    const index = existing.findIndex((r) => r.id === rule.id);
    if (index >= 0) {
      existing[index] = rule;
    } else {
      existing.push(rule);
    }
    await chrome.storage.local.set({ [STORAGE_KEY]: existing });
    void getDriveToken().then((t) => { if (t) driveSyncService.saveDomainRouterRules(existing, t); });
  },

  async deleteRule(ruleId: string): Promise<void> {
    const existing = await this.getRules();
    const updated = existing.filter((r) => r.id !== ruleId);
    await chrome.storage.local.set({ [STORAGE_KEY]: updated });
    void getDriveToken().then((t) => { if (t) driveSyncService.saveDomainRouterRules(updated, t); });
  },

  async toggleRule(ruleId: string): Promise<void> {
    const existing = await this.getRules();
    const updated = existing.map((r) =>
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r,
    );
    await chrome.storage.local.set({ [STORAGE_KEY]: updated });
    void getDriveToken().then((t) => { if (t) driveSyncService.saveDomainRouterRules(updated, t); });
  },

  async clearAllData(): Promise<void> {
    await chrome.storage.local.remove(STORAGE_KEY);
  },
};

/**
 * Matches a URL against the enabled domain router rules.
 * Returns the target notebook ID for the first matching rule, or null.
 */
export function matchUrl(url: string, rules: DomainRouterRule[]): string | null {
  for (const rule of rules) {
    if (!rule.enabled) continue;

    try {
      switch (rule.patternType) {
        case 'domain': {
          const hostname = new URL(url).hostname;
          if (hostname === rule.pattern || hostname.endsWith('.' + rule.pattern)) {
            return rule.notebookId;
          }
          break;
        }
        case 'glob': {
          const regex = new RegExp(
            '^' +
              rule.pattern
                .replace(/[.+^${}()|[\]\\]/g, '\\$&')
                .replace(/\*/g, '.*')
                .replace(/\?/g, '.') +
              '$',
          );
          if (regex.test(url)) return rule.notebookId;
          break;
        }
        case 'regex': {
          if (new RegExp(rule.pattern).test(url)) return rule.notebookId;
          break;
        }
      }
    } catch {
      // Skip invalid patterns
    }
  }
  return null;
}

/**
 * Groups URLs by their target notebook using domain router rules.
 * URLs that don't match any rule are grouped under the defaultNotebookId.
 */
export function routeUrls(
  urls: string[],
  rules: DomainRouterRule[],
  defaultNotebookId: string,
): Map<string, string[]> {
  const groups = new Map<string, string[]>();

  for (const url of urls) {
    const targetId = matchUrl(url, rules) ?? defaultNotebookId;
    const existing = groups.get(targetId) ?? [];
    existing.push(url);
    groups.set(targetId, existing);
  }

  return groups;
}
