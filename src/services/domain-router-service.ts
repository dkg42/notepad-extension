/**
 * @module domain-router-service
 * @description Manages user-configured domain router rules that map URL patterns (domain, glob, or regex) to target NotebookLM notebooks. Provides CRUD operations persisted in chrome.storage.local with best-effort Drive sync on each write. Also exports pure utility functions matchUrl (finds the first matching rule for a URL) and routeUrls (groups a list of URLs by their target notebook, falling back to a default notebook ID) that run without any I/O and can be used synchronously in the background worker.
 * @dependencies token-lifecycle-service, drive/drive-sync-service
 * @public domainRouterService, matchUrl, routeUrls
 */
import type { DomainRouterRule } from '@/types';
import { driveSyncService } from './drive/drive-sync-service';
import { getValidToken } from './token-lifecycle-service';
import { scopedStorage } from './storage/scoped-storage';

const STORAGE_KEY = 'domainRouterRules';

async function getDriveToken(): Promise<string | null> {
  const result = await getValidToken();
  if (!result.ok || !result.hasDriveScope) return null;
  return result.accessToken;
}

function syncToDrive(callback: (token: string) => void): void {
  void getDriveToken().then((t) => { if (t) callback(t); });
}

/**
 * Manages domain router rules — user-configured URL pattern → notebook mappings.
 * Rules are persisted in chrome.storage.local.
 */
export const domainRouterService = {
  async getRules(): Promise<DomainRouterRule[]> {
    const result = await scopedStorage.get<DomainRouterRule[]>(STORAGE_KEY);
    return result[STORAGE_KEY] ?? [];
  },

  async saveRule(rule: DomainRouterRule): Promise<void> {
    const existing = await this.getRules();
    const index = existing.findIndex((r) => r.id === rule.id);
    if (index >= 0) {
      existing[index] = rule;
    } else {
      existing.push(rule);
    }
    await scopedStorage.set({ [STORAGE_KEY]:existing });
    syncToDrive((t) => driveSyncService.saveDomainRouterRules(existing, t));
  },

  async deleteRule(ruleId: string): Promise<void> {
    const existing = await this.getRules();
    const updated = existing.filter((r) => r.id !== ruleId);
    await scopedStorage.set({ [STORAGE_KEY]:updated });
    syncToDrive((t) => driveSyncService.saveDomainRouterRules(updated, t));
  },

  async toggleRule(ruleId: string): Promise<void> {
    const existing = await this.getRules();
    const updated = existing.map((r) =>
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r,
    );
    await scopedStorage.set({ [STORAGE_KEY]:updated });
    syncToDrive((t) => driveSyncService.saveDomainRouterRules(updated, t));
  },

  async clearAllData(): Promise<void> {
    await scopedStorage.remove(STORAGE_KEY);
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
