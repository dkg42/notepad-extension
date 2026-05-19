/**
 * @module drive-schemas
 * @description Defines the TypeScript wire-format contracts (interfaces and enums) for every JSON and plain-text file persisted in Google Drive AppData. All Drive services must conform to these types when serializing or deserializing data; incrementing DRIVE_SCHEMA_VERSION and adding a migration path in drive-init-service.ts is required for any breaking field change. Audio Blob payloads are intentionally excluded from sync — only Drive-safe representations are defined here.
 * @dependencies @/types, @/types/dashboard, @/types/pipeline, @/types/import, @/types/chat-history, @/types/tab-groups
 * @public DRIVE_SCHEMA_VERSION, DriveFilename, DriveFileRef, DriveManifest, DriveManifestEntry, DriveSnippetMeta, DriveSnippetsMetaFile, DriveCoreDataFile, DriveHistoryDataFile, DriveNotebookRef, DriveNotebookAnnotationsFile, DrivePipelinesFile, DriveSafePodcastEpisode, DriveSafeEpisodeTrack, DriveSafeEpisodeTrackSource, DriveChatConversationsMetaFile, DriveConversationMetaLine, DriveCustomAudioIndexFile, DriveCustomAudioEntry, DriveTabGroup, DriveTabGroupsFile, snippetTextFilename, chatContentFilename, toDriveSafeEpisode
 */

/**
 * drive-schemas.ts
 *
 * TypeScript contracts (interfaces) for every file stored in Google Drive AppData.
 * These types define the JSON structure written to and read from Drive — treat them
 * as a versioned wire-format contract. Increment DRIVE_SCHEMA_VERSION and add a
 * migration path in drive-init-service.ts whenever a breaking field change is made.
 *
 * Drive AppData file layout (flat — AppData has no real subdirectory support):
 *
 *   manifest.json                      ← file-ID registry + versions + schema versions
 *   snippets-meta.json                 ← snippet metadata (text bodies excluded)
 *   snippet-text-{id}.txt              ← one plain-text file per snippet body
 *   core-data.json                     ← folders + tags + settings + domain-router-rules
 *   history-data.json                  ← export-history + pipeline-runs + podcast-episodes
 *   notebook-annotations.json          ← NotebookAnnotation[] + Folder[] + minimal {id,name} refs
 *   pipelines.json
 *   chat-conversations-meta.json       ← ConversationMeta[] only
 *   chat-content-{platform}-{id}.txt   ← NDJSON per conversation
 *   custom-audio-index.json            ← customAudioId → Drive file-id map for podcast uploads
 *   tab-groups.json                    ← durable tab-group defs (no live tabIds)
 *
 * Note: the actual custom-audio media files are NOT in AppData — they live in a
 * user-visible app-created Drive folder so the user can manage them directly.
 * This index only maps the in-app customAudioId to that file's Drive id.
 */

import type {
  Folder,
  TagMeta,
  NotebookAnnotation,
  PodcastEpisode,
  EpisodeTrack,
  EpisodeTrackSource,
} from '@/types';
import type { DashboardSettings, ExportRecord } from '@/types/dashboard';
import type { Pipeline, PipelineRun } from '@/types/pipeline';
import type { DomainRouterRule } from '@/types/import';
import type { ConversationMeta, ConversationMessage } from '@/types/chat-history';
import type { GroupColor, StashedTab } from '@/types/tab-groups';

// ── Schema version ─────────────────────────────────────────────────────────────

/**
 * Increment when a breaking field change is made to any Drive file format.
 * drive-init-service.ts must handle migration from (version - 1) to this version.
 */
export const DRIVE_SCHEMA_VERSION = 2;

// ── Known filenames (strongly typed to prevent typos) ─────────────────────────

export type DriveFilename =
  | 'manifest.json'
  | 'snippets-meta.json'
  | 'core-data.json'
  | 'history-data.json'
  | 'notebook-annotations.json'
  | 'pipelines.json'
  | 'chat-conversations-meta.json'
  | 'custom-audio-index.json'
  | 'tab-groups.json';

/** Returns the Drive filename for a per-snippet text file. */
export function snippetTextFilename(snippetId: string): string {
  return `snippet-text-${snippetId}.txt`;
}

/** Returns the Drive filename for a per-conversation content file. */
export function chatContentFilename(platform: string, conversationId: string): string {
  return `chat-content-${platform}-${conversationId}.txt`;
}

// ── DriveFileRef — returned by drive-io-service after every create/update ─────

export interface DriveFileRef {
  id: string;
  name: string;
  /** Monotonically increasing version number from Drive API v3. */
  version: number;
  size: number;
}

// ── Manifest ───────────────────────────────────────────────────────────────────

/** One entry per Drive file tracked by the manifest. */
export interface DriveManifestEntry {
  driveFileId: string;
  filename: string;
  schemaVersion: number;
  /** Unix ms of the last successful write to Drive for this file. */
  syncedAt: number;
  /** Drive version number from the last read or write. Used for change detection. */
  version?: number;
  /** File size in bytes (informational). */
  size?: number;
}

/**
 * Root manifest file stored in AppData as `manifest.json`.
 *
 * Acts as the initialization sentinel — if this file exists the user is a
 * returning user; if absent, first-time migration from chrome.storage.local
 * is performed by drive-init-service.ts.
 *
 * Also stores Drive file IDs for every known file so subsequent writes go
 * directly to PATCH /files/{id} without a list-by-name lookup.
 */
export interface DriveManifest {
  schemaVersion: number;
  /** Unix ms when the manifest was first created (i.e. when Drive sync was set up). */
  createdAt: number;
  /** Unix ms of the most recent manifest update. */
  updatedAt: number;
  /** Firebase UID of the account that owns this AppData — guards cross-account reads. */
  ownerUid: string;
  files: Record<string, DriveManifestEntry>;
}

// ── Common file envelope ───────────────────────────────────────────────────────

/** Every JSON file in Drive AppData wraps its payload in this envelope. */
interface DriveFileEnvelope {
  schemaVersion: number;
  /** Unix ms when this file was last written to Drive. Used for conflict resolution. */
  updatedAt: number;
}

// ── snippets-meta.json ─────────────────────────────────────────────────────────

/**
 * Snippet metadata stored in the index file.
 * The text body is excluded — it lives in a separate `snippet-text-{id}.txt` file.
 */
export interface DriveSnippetMeta {
  id: string;
  /** User-authored title (Prompt Hub). Extension-specific — must round-trip. */
  title?: string;
  source: string;
  savedAt: number;
  folderId?: string;
  tags?: string[];
  isFavorite?: boolean;
  /** Times the prompt/snippet has been used. Extension-specific — must round-trip. */
  usageCount?: number;
  /**
   * Drive file ID for this snippet's `.txt` file.
   * Null means the text file has not been uploaded yet (e.g., created offline).
   */
  textFileId: string | null;
}

export interface DriveSnippetsMetaFile extends DriveFileEnvelope {
  snippets: DriveSnippetMeta[];
}

// ── core-data.json ────────────────────────────────────────────────────────────

/** Consolidates folders, tags, settings, and domain-router-rules into one file. */
export interface DriveCoreDataFile extends DriveFileEnvelope {
  folders: Folder[];
  tags: TagMeta[];
  settings: DashboardSettings | null;
  domainRouterRules: DomainRouterRule[];
}

// ── history-data.json ─────────────────────────────────────────────────────────

/** Consolidates export-history, pipeline-runs, and podcast-episodes into one file. */
export interface DriveHistoryDataFile extends DriveFileEnvelope {
  /** Capped at 200 entries, newest first. */
  exportHistory: ExportRecord[];
  /** Capped at 200 entries, newest first. */
  pipelineRuns: PipelineRun[];
  podcastEpisodes: DriveSafePodcastEpisode[];
}

// ── notebook-annotations.json ─────────────────────────────────────────────────

/**
 * Minimal notebook reference. The full NotebookMeta (title, url, createdAt,
 * isOwner, lastSyncedAt) is NOT synced — it is re-fetched from NotebookLM. Only
 * the stable NotebookLM id (survives upstream rename) plus a last-known display
 * name are synced, so annotated/foldered notebooks render with a name on a new
 * device before the NotebookLM API sync repopulates full metadata.
 */
export interface DriveNotebookRef {
  /** Stable NotebookLM notebook id — the cross-device link. */
  id: string;
  /** Last-known notebook name; refreshed from NotebookLM when available. */
  name: string;
}

export interface DriveNotebookAnnotationsFile extends DriveFileEnvelope {
  annotations: NotebookAnnotation[];
  /** Notebook folders (nested tree). Replaces legacy flat `collections` field. */
  folders: Folder[];
  /** Minimal {id,name} refs for pre-sync display. Absent in v1 files (default []). */
  notebooks: DriveNotebookRef[];
}

// ── pipelines.json ────────────────────────────────────────────────────────────

export interface DrivePipelinesFile extends DriveFileEnvelope {
  pipelines: Pipeline[];
}

// ── podcast-episodes.json ─────────────────────────────────────────────────────

/**
 * Podcast episode track safe for Drive sync.
 *
 * Custom audio tracks store a `Blob` in `EpisodeTrackSource` which is not
 * JSON-serializable and can be megabytes in size. For custom tracks we strip
 * the blob reference and only keep the identifying fields. The actual audio
 * data remains in IndexedDB (podcast-audio-service) and is NOT synced to Drive.
 */
export type DriveSafeEpisodeTrackSource =
  | { kind: 'artifact'; artifactId: string; mediaUrl: string; notebookId: string; notebookTitle: string }
  | { kind: 'custom'; customAudioId: string }; // blob intentionally excluded

export interface DriveSafeEpisodeTrack extends Omit<EpisodeTrack, 'source'> {
  source: DriveSafeEpisodeTrackSource;
}

export interface DriveSafePodcastEpisode extends Omit<PodcastEpisode, 'tracks'> {
  tracks: DriveSafeEpisodeTrack[];
}

// ── chat-conversations-meta.json ──────────────────────────────────────────────

export interface DriveChatConversationsMetaFile extends DriveFileEnvelope {
  conversations: ConversationMeta[];
}

/**
 * Per-conversation text file format: `chat-content-{platform}-{id}.txt`
 *
 * Format: newline-delimited JSON (NDJSON).
 * - First line: `{ "_meta": ConversationMeta, "fetchedAt": number }`
 * - Subsequent lines: one `ConversationMessage` JSON object per line
 *
 * This keeps the file streamable and human-readable.
 */
export interface DriveConversationMetaLine {
  _meta: ConversationMeta;
  fetchedAt: number;
}

// ── custom-audio-index.json ───────────────────────────────────────────────────

/**
 * Maps an in-app customAudioId to the Drive file that holds its audio blob.
 * The blob itself lives in a user-visible app-created Drive folder (not AppData)
 * so the user can see/manage uploads directly in their Drive.
 */
export interface DriveCustomAudioEntry {
  customAudioId: string;
  /** Drive file id of the uploaded audio in the visible media folder. */
  driveFileId: string;
  filename: string;
  mimeType: string;
}

export interface DriveCustomAudioIndexFile extends DriveFileEnvelope {
  entries: DriveCustomAudioEntry[];
}

// ── tab-groups.json ───────────────────────────────────────────────────────────

/**
 * Durable, device-agnostic tab-group definition. Excludes `tabIds` (live Chrome
 * tab ids, meaningless on another device — re-derived from `tabUrls` on load)
 * and the in-model `updatedAt` (poisoned by automatic live reconciliation; the
 * file envelope's `updatedAt` is the last-write-wins timestamp instead).
 */
export interface DriveTabGroup {
  id: string;
  name: string;
  color: GroupColor;
  pinned: boolean;
  context: string;
  aiContext: boolean;
  createdAt: number;
  tabUrls: string[];
  stashedTabs: StashedTab[];
}

export interface DriveTabGroupsFile extends DriveFileEnvelope {
  groups: DriveTabGroup[];
}

// ── Helper: strip podcast blobs before sync ───────────────────────────────────

/**
 * Converts a PodcastEpisode to a Drive-safe version by stripping audio Blob
 * references from custom tracks. Called before any Drive write involving episodes.
 */
export function toDriveSafeEpisode(episode: PodcastEpisode): DriveSafePodcastEpisode {
  return {
    ...episode,
    tracks: episode.tracks.map((track): DriveSafeEpisodeTrack => {
      const src = track.source;
      if (src.kind === 'custom') {
        // Strip the blob — only keep the ID for re-association with IndexedDB
        const safeSrc: DriveSafeEpisodeTrackSource = { kind: 'custom', customAudioId: src.customAudioId };
        return { ...track, source: safeSrc };
      }
      return track as DriveSafeEpisodeTrack;
    }),
  };
}
