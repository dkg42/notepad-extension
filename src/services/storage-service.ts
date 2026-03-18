import type { Folder, Snippet } from '@/types';

const SNIPPETS_KEY = 'snippets';
const FOLDERS_KEY = 'folders';

/**
 * Single-responsibility service for persisting snippets and folders via chrome.storage.local.
 * All reads and writes go through this module so storage concerns stay isolated.
 */
export const storageService = {
  // ── Snippets ──────────────────────────────────────────────────────────────

  async getAll(): Promise<Snippet[]> {
    const result = await chrome.storage.local.get(SNIPPETS_KEY);
    return (result[SNIPPETS_KEY] as Snippet[]) ?? [];
  },

  async save(text: string, source: string, folderId?: string): Promise<Snippet> {
    const snippet: Snippet = {
      id: crypto.randomUUID(),
      text,
      source,
      savedAt: Date.now(),
      folderId,
    };
    const existing = await this.getAll();
    await chrome.storage.local.set({ [SNIPPETS_KEY]: [snippet, ...existing] });
    return snippet;
  },

  /**
   * Saves multiple texts in a single read-write cycle to avoid race conditions.
   * Use this instead of calling save() in a Promise.all loop.
   */
  async saveMany(texts: string[], source: string, folderId?: string): Promise<Snippet[]> {
    const now = Date.now();
    const newSnippets: Snippet[] = texts.map((text) => ({
      id: crypto.randomUUID(),
      text,
      source,
      savedAt: now,
      folderId,
    }));
    const existing = await this.getAll();
    await chrome.storage.local.set({ [SNIPPETS_KEY]: [...newSnippets, ...existing] });
    return newSnippets;
  },

  async remove(id: string): Promise<void> {
    const existing = await this.getAll();
    await chrome.storage.local.set({
      [SNIPPETS_KEY]: existing.filter((s) => s.id !== id),
    });
  },

  async moveToFolder(snippetId: string, folderId: string | undefined): Promise<void> {
    const existing = await this.getAll();
    await chrome.storage.local.set({
      [SNIPPETS_KEY]: existing.map((s) =>
        s.id === snippetId ? { ...s, folderId } : s,
      ),
    });
  },

  async updateTags(snippetId: string, tags: string[]): Promise<void> {
    const existing = await this.getAll();
    await chrome.storage.local.set({
      [SNIPPETS_KEY]: existing.map((s) =>
        s.id === snippetId ? { ...s, tags } : s,
      ),
    });
  },

  async clear(): Promise<void> {
    await chrome.storage.local.set({ [SNIPPETS_KEY]: [] });
  },

  // ── Folders ───────────────────────────────────────────────────────────────

  async getFolders(): Promise<Folder[]> {
    const result = await chrome.storage.local.get(FOLDERS_KEY);
    return (result[FOLDERS_KEY] as Folder[]) ?? [];
  },

  async createFolder(name: string): Promise<Folder> {
    const trimmed = name.trim();
    const existing = await this.getFolders();
    if (existing.some((f) => f.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error(`A folder named "${trimmed}" already exists.`);
    }
    const folder: Folder = {
      id: crypto.randomUUID(),
      name: trimmed,
      createdAt: Date.now(),
    };
    await chrome.storage.local.set({ [FOLDERS_KEY]: [...existing, folder] });
    return folder;
  },

  async renameFolder(id: string, name: string): Promise<void> {
    const trimmed = name.trim();
    const existing = await this.getFolders();
    if (existing.some((f) => f.id !== id && f.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error(`A folder named "${trimmed}" already exists.`);
    }
    await chrome.storage.local.set({
      [FOLDERS_KEY]: existing.map((f) => (f.id === id ? { ...f, name: trimmed } : f)),
    });
  },

  async deleteFolder(id: string): Promise<void> {
    const [folders, snippets] = await Promise.all([this.getFolders(), this.getAll()]);
    // Unassign snippets from the deleted folder rather than deleting them
    const updatedSnippets = snippets.map((s) =>
      s.folderId === id ? { ...s, folderId: undefined } : s,
    );
    await chrome.storage.local.set({
      [FOLDERS_KEY]: folders.filter((f) => f.id !== id),
      [SNIPPETS_KEY]: updatedSnippets,
    });
  },
};