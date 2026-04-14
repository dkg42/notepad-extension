import type { ChatPlatform, ChatSyncMeta, ConversationFull, ConversationMeta } from '@/types';
import { driveSyncService } from './drive/drive-sync-service';
import { getValidToken } from './token-lifecycle-service';

const CONVERSATIONS_KEY = 'chatConversations';
const SYNC_META_KEY = 'chatSyncMeta';

async function getDriveToken(): Promise<string | null> {
  const result = await getValidToken();
  if (!result.ok || !result.hasDriveScope) return null;
  return result.accessToken;
}

/** Storage key for a single conversation's full content. */
function contentKey(platform: ChatPlatform, id: string): string {
  return `chatContent_${platform}_${id}`;
}

/**
 * Service for persisting chat session metadata and content in chrome.storage.local.
 *
 * Conversation metadata (titles, dates) is stored as a single array for fast listing.
 * Full conversation content is stored per-key to avoid loading all messages into memory.
 */
export const chatHistoryStorage = {
  /** Returns all synced conversations, optionally filtered by platform. */
  async getConversations(platform?: ChatPlatform): Promise<ConversationMeta[]> {
    const result = await chrome.storage.local.get(CONVERSATIONS_KEY);
    const all: ConversationMeta[] = result[CONVERSATIONS_KEY] ?? [];
    if (!platform) return all.sort((a, b) => b.updatedAt - a.updatedAt);
    return all.filter((c) => c.platform === platform).sort((a, b) => b.updatedAt - a.updatedAt);
  },

  /**
   * Upserts a batch of conversation metadata.
   * Existing entries are updated; new entries are appended.
   * Keyed by `platform + id` composite to avoid cross-platform collisions.
   */
  async upsertConversations(incoming: ConversationMeta[]): Promise<void> {
    const result = await chrome.storage.local.get(CONVERSATIONS_KEY);
    const existing: ConversationMeta[] = result[CONVERSATIONS_KEY] ?? [];

    const map = new Map(existing.map((c) => [`${c.platform}:${c.id}`, c]));
    for (const conv of incoming) {
      map.set(`${conv.platform}:${conv.id}`, conv);
    }

    const merged = Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt);
    await chrome.storage.local.set({ [CONVERSATIONS_KEY]: merged });
    void getDriveToken().then(async (t) => {
      if (!t) return;
      const syncMeta = await this.getSyncMeta();
      driveSyncService.saveChatConversationsMeta(merged, syncMeta, t);
    });
  },

  /** Returns the full content for a single conversation, or null if not cached. */
  async getConversationContent(platform: ChatPlatform, id: string): Promise<ConversationFull | null> {
    const key = contentKey(platform, id);
    const result = await chrome.storage.local.get(key);
    return (result[key] as ConversationFull) ?? null;
  },

  /** Stores full conversation content under its own key. */
  async saveConversationContent(full: ConversationFull): Promise<void> {
    const key = contentKey(full.meta.platform, full.meta.id);
    await chrome.storage.local.set({ [key]: full });

    // Also update messageCount on the metadata entry
    const result = await chrome.storage.local.get(CONVERSATIONS_KEY);
    const all: ConversationMeta[] = result[CONVERSATIONS_KEY] ?? [];
    const updated = all.map((c) =>
      c.platform === full.meta.platform && c.id === full.meta.id
        ? { ...c, messageCount: full.messages.length }
        : c,
    );
    await chrome.storage.local.set({ [CONVERSATIONS_KEY]: updated });
    void getDriveToken().then(async (t) => {
      if (!t) return;
      void driveSyncService.saveChatConversationContent(full, t);
      const syncMeta = await this.getSyncMeta();
      driveSyncService.saveChatConversationsMeta(updated, syncMeta, t);
    });
  },

  /** Returns sync metadata for all platforms. */
  async getSyncMeta(): Promise<ChatSyncMeta[]> {
    const result = await chrome.storage.local.get(SYNC_META_KEY);
    return (result[SYNC_META_KEY] as ChatSyncMeta[]) ?? [];
  },

  /** Updates (merges) sync metadata for a single platform. */
  async setSyncMeta(platform: ChatPlatform, meta: Partial<Omit<ChatSyncMeta, 'platform'>>): Promise<void> {
    const all = await this.getSyncMeta();
    const idx = all.findIndex((m) => m.platform === platform);
    const current: ChatSyncMeta = idx >= 0
      ? all[idx]
      : { platform, lastSyncedAt: Date.now(), conversationCount: 0 };
    const updated: ChatSyncMeta = { ...current, ...meta, platform };
    if (idx >= 0) {
      all[idx] = updated;
    } else {
      all.push(updated);
    }
    await chrome.storage.local.set({ [SYNC_META_KEY]: all });
    void getDriveToken().then(async (t) => {
      if (!t) return;
      const conversations = await this.getConversations();
      driveSyncService.saveChatConversationsMeta(conversations, all, t);
    });
  },

  async clearAllData(): Promise<void> {
    const allData = await chrome.storage.local.get(null);
    const dynamicKeys = Object.keys(allData).filter((k) => k.startsWith('chatContent_'));
    await chrome.storage.local.remove([CONVERSATIONS_KEY, SYNC_META_KEY, ...dynamicKeys]);
  },
};
