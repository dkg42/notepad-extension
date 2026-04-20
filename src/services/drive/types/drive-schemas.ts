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
 *   folders.json
 *   tags.json
 *   settings.json
 *   export-history.json                ← max 200 records, newest first
 *   notebooks-meta.json                ← NotebookLM metadata + syncMeta
 *   notebook-annotations.json          ← NotebookAnnotation[] + NotebookCollection[]
 *   pipelines.json
 *   pipeline-runs.json                 ← max 200 records, newest first
 *   podcast-episodes.json              ← PodcastEpisode[] — audio blobs NEVER synced
 *   domain-router-rules.json
 *   chat-conversations-meta.json       ← ConversationMeta[] only
 *   chat-content-{platform}-{id}.txt   ← NDJSON per conversation
 */

import type {
  Folder,
  TagMeta,
  NotebookAnnotation,
  NotebookCollection,
  PodcastEpisode,
  EpisodeTrack,
  EpisodeTrackSource,
} from '@/types';
import type { DashboardSettings, ExportRecord } from '@/types/dashboard';
import type { Pipeline, PipelineRun } from '@/types/pipeline';
import type { DomainRouterRule } from '@/types/import';
import type { ConversationMeta, ConversationMessage, ChatSyncMeta } from '@/types/chat-history';

// ── Schema version ─────────────────────────────────────────────────────────────

/**
 * Increment when a breaking field change is made to any Drive file format.
 * drive-init-service.ts must handle migration from (version - 1) to this version.
 */
export const DRIVE_SCHEMA_VERSION = 1;

// ── Known filenames (strongly typed to prevent typos) ─────────────────────────

export type DriveFilename =
  | 'manifest.json'
  | 'snippets-meta.json'
  | 'folders.json'
  | 'tags.json'
  | 'settings.json'
  | 'export-history.json'
  | 'notebook-annotations.json'
  | 'pipelines.json'
  | 'pipeline-runs.json'
  | 'podcast-episodes.json'
  | 'domain-router-rules.json'
  | 'chat-conversations-meta.json';

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
  source: string;
  savedAt: number;
  folderId?: string;
  tags?: string[];
  isFavorite?: boolean;
  /**
   * Drive file ID for this snippet's `.txt` file.
   * Null means the text file has not been uploaded yet (e.g., created offline).
   */
  textFileId: string | null;
}

export interface DriveSnippetsMetaFile extends DriveFileEnvelope {
  snippets: DriveSnippetMeta[];
}

// ── folders.json ──────────────────────────────────────────────────────────────

export interface DriveFoldersFile extends DriveFileEnvelope {
  folders: Folder[];
}

// ── tags.json ─────────────────────────────────────────────────────────────────

export interface DriveTagsFile extends DriveFileEnvelope {
  tags: TagMeta[];
}

// ── settings.json ─────────────────────────────────────────────────────────────

export interface DriveSettingsFile extends DriveFileEnvelope {
  settings: DashboardSettings;
}

// ── export-history.json ───────────────────────────────────────────────────────

export interface DriveExportHistoryFile extends DriveFileEnvelope {
  /** Capped at 200 entries, newest first. */
  records: ExportRecord[];
}

// ── notebook-annotations.json ─────────────────────────────────────────────────

export interface DriveNotebookAnnotationsFile extends DriveFileEnvelope {
  annotations: NotebookAnnotation[];
  collections: NotebookCollection[];
}

// ── pipelines.json ────────────────────────────────────────────────────────────

export interface DrivePipelinesFile extends DriveFileEnvelope {
  pipelines: Pipeline[];
}

// ── pipeline-runs.json ────────────────────────────────────────────────────────

export interface DrivePipelineRunsFile extends DriveFileEnvelope {
  /** Capped at 200 entries, newest first. */
  runs: PipelineRun[];
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

export interface DrivePodcastEpisodesFile extends DriveFileEnvelope {
  episodes: DriveSafePodcastEpisode[];
}

// ── domain-router-rules.json ──────────────────────────────────────────────────

export interface DriveDomainRouterFile extends DriveFileEnvelope {
  rules: DomainRouterRule[];
}

// ── chat-conversations-meta.json ──────────────────────────────────────────────

export interface DriveChatConversationsMetaFile extends DriveFileEnvelope {
  conversations: ConversationMeta[];
  syncMeta: ChatSyncMeta[];
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
