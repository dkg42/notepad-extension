/**
 * @module chat-history-storage
 * @description Persistence layer for manually saved chat conversations. Conversation metadata
 *   (titles, dates, message counts) is stored as a single sorted array for fast listing;
 *   full message content is stored per-conversation under isolated keys. A composite
 *   platform+id key prevents collisions between platforms. Each write fires a best-effort
 *   Drive sync tail-call.
 * @dependencies token-lifecycle-service, drive/drive-sync-service
 * @public chatHistoryStorage
 */
import type { ChatPlatform, ConversationFull, ConversationMeta } from '@/types';
import { driveSyncService } from './drive/drive-sync-service';
import { getValidToken } from './token-lifecycle-service';
import { scopedStorage } from './storage/scoped-storage';

const CONVERSATIONS_KEY = 'chatConversations';

async function getDriveToken(): Promise<string | null> {
  const result = await getValidToken();
  if (!result.ok || !result.hasDriveScope) return null;
  return result.accessToken;
}

function syncToDrive(callback: (token: string) => void | Promise<void>): void {
  void getDriveToken().then((t) => { if (t) void callback(t); });
}

/** Storage key for a single conversation's full content. */
function contentKey(platform: ChatPlatform, id: string): string {
  return `chatContent_${platform}_${id}`;
}

export const chatHistoryStorage = {
  /** Returns all saved conversations, optionally filtered by platform, sorted newest first. */
  async getConversations(platform?: ChatPlatform): Promise<ConversationMeta[]> {
    const result = await scopedStorage.get<ConversationMeta[]>(CONVERSATIONS_KEY);
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
    const result = await scopedStorage.get<ConversationMeta[]>(CONVERSATIONS_KEY);
    const existing: ConversationMeta[] = result[CONVERSATIONS_KEY] ?? [];

    const map = new Map(existing.map((c) => [`${c.platform}:${c.id}`, c]));
    for (const conv of incoming) {
      map.set(`${conv.platform}:${conv.id}`, conv);
    }

    const merged = Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt);
    await scopedStorage.set({ [CONVERSATIONS_KEY]: merged });
    syncToDrive((t) => {
      driveSyncService.saveChatConversationsMeta(merged, t);
    });
  },

  /**
   * Returns the full content for a single conversation.
   * Reads local scoped storage first; on miss, falls back to Drive (when a
   * Drive-scoped token is available) and back-fills the local cache so future
   * reads are offline-friendly. Returns null only when both local and Drive miss.
   */
  async getConversationContent(platform: ChatPlatform, id: string): Promise<ConversationFull | null> {
    const key = contentKey(platform, id);
    const result = await scopedStorage.get<ConversationFull>(key);
    if (result[key]) return result[key];

    const token = await getDriveToken();
    if (!token) return null;

    const fromDrive = await driveSyncService.getChatConversationContent(platform, id, token);
    if (!fromDrive) return null;

    // Cache-fill: write directly to scoped storage to avoid re-enqueuing a Drive
    // write or rewriting metadata via saveConversationContent.
    await scopedStorage.set({ [key]: fromDrive });
    return fromDrive;
  },

  /** Stores full conversation content and updates the message count in the metadata index. */
  async saveConversationContent(full: ConversationFull): Promise<void> {
    const key = contentKey(full.meta.platform, full.meta.id);
    await scopedStorage.set({ [key]: full });

    const result = await scopedStorage.get<ConversationMeta[]>(CONVERSATIONS_KEY);
    const all: ConversationMeta[] = result[CONVERSATIONS_KEY] ?? [];
    const updated = all.map((c) =>
      c.platform === full.meta.platform && c.id === full.meta.id
        ? { ...c, messageCount: full.messages.length }
        : c,
    );
    await scopedStorage.set({ [CONVERSATIONS_KEY]: updated });
    syncToDrive((t) => {
      void driveSyncService.saveChatConversationContent(full, t);
      driveSyncService.saveChatConversationsMeta(updated, t);
    });
  },

  /** Removes a single conversation's metadata and content from storage. */
  async deleteConversation(platform: ChatPlatform, id: string): Promise<void> {
    const result = await scopedStorage.get<ConversationMeta[]>(CONVERSATIONS_KEY);
    const all: ConversationMeta[] = result[CONVERSATIONS_KEY] ?? [];
    const filtered = all.filter((c) => !(c.platform === platform && c.id === id));
    await scopedStorage.set({ [CONVERSATIONS_KEY]: filtered });
    await scopedStorage.remove(contentKey(platform, id));
    syncToDrive((t) => {
      driveSyncService.saveChatConversationsMeta(filtered, t);
    });
  },

  async clearAllData(): Promise<void> {
    const dynamicKeys = await scopedStorage.listLogicalKeys('chatContent_');
    await scopedStorage.remove([CONVERSATIONS_KEY, ...dynamicKeys]);
  },
};
