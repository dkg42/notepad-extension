import type { Snippet } from '@/types';

const STORAGE_KEY = 'snippets';

/**
 * Single-responsibility service for persisting snippets via chrome.storage.local.
 * All reads and writes go through this module so storage concerns stay isolated.
 */
export const storageService = {
  async getAll(): Promise<Snippet[]> {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return (result[STORAGE_KEY] as Snippet[]) ?? [];
  },

  async save(text: string, source: string): Promise<Snippet> {
    const snippet: Snippet = {
      id: crypto.randomUUID(),
      text,
      source,
      savedAt: Date.now(),
    };
    const existing = await this.getAll();
    await chrome.storage.local.set({ [STORAGE_KEY]: [snippet, ...existing] });
    return snippet;
  },

  async remove(id: string): Promise<void> {
    const existing = await this.getAll();
    await chrome.storage.local.set({
      [STORAGE_KEY]: existing.filter((s) => s.id !== id),
    });
  },

  async clear(): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEY]: [] });
  },
};
