/**
 * @module clipboard-session-service
 * @description Manages clipboard entries in chrome.storage.session (cleared when the browser closes), providing add (with duplicate suppression and a 50-entry cap), remove, getAll, and clear operations.
 * @dependencies @/types (ClipboardEntry)
 * @public clipboardSessionService
 */
import type { ClipboardEntry } from '@/types';

const SESSION_KEY = 'clipboardEntries';
const MAX_ENTRIES = 50;

export const clipboardSessionService = {
  async getAll(): Promise<ClipboardEntry[]> {
    const result = await chrome.storage.session.get(SESSION_KEY);
    return (result[SESSION_KEY] as ClipboardEntry[]) ?? [];
  },

  async add(entry: Omit<ClipboardEntry, 'id' | 'copiedAt'>): Promise<void> {
    console.log('[clipboard-session-service] add() called', entry.type);
    const entries = await this.getAll();
    console.log('[clipboard-session-service] existing entries:', entries.length);

    // Skip duplicate: same text as the most recent entry
    if (entry.type === 'text' && entries[0]?.type === 'text' && entries[0].text === entry.text) {
      console.log('[clipboard-session-service] duplicate skipped');
      return;
    }

    const newEntry: ClipboardEntry = {
      ...entry,
      id: crypto.randomUUID(),
      copiedAt: Date.now(),
    };

    const updated = [newEntry, ...entries].slice(0, MAX_ENTRIES);
    await chrome.storage.session.set({ [SESSION_KEY]: updated });
    console.log('[clipboard-session-service] written to session storage, total:', updated.length);
  },

  async remove(id: string): Promise<void> {
    const entries = await this.getAll();
    await chrome.storage.session.set({ [SESSION_KEY]: entries.filter((e) => e.id !== id) });
  },

  async clear(): Promise<void> {
    await chrome.storage.session.remove(SESSION_KEY);
  },
};
