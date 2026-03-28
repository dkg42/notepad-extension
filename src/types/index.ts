export * from './dashboard';
export * from './import';
export * from './chat-history';
export * from './pipeline';

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
  color?: string;
  parentId?: string;
  sortOrder?: number;
}

export interface TagMeta {
  name: string;
  color?: string;
}

export interface Snippet {
  id: string;
  text: string;
  /** Full URL of the page where the snippet was saved */
  source: string;
  savedAt: number;
  folderId?: string;
  tags?: string[];
  isFavorite?: boolean;
}

export interface ChatMessage {
  /**
   * 'user' — a human turn
   * 'assistant' — the AI response turn
   * 'system' — injected metadata (e.g. notebook source list); rendered as a
   *             preamble block with no role label in all export formats
   */
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/** Sentinel ID used to represent snippets with no folder assigned */
export const UNCATEGORIZED_ID = '__uncategorized__';

/** A single NotebookLM source entry used for source list exports. */
export interface SourceRecord {
  title: string;
  type: string; // matches SourceType from source-panel-adapter.interface.ts
}

/** A source with an ID, needed for deletion and detail display. */
export interface SourceDetailRecord extends SourceRecord {
  /** Source ID from the API (src[0] in the response array). */
  id: string;
}

/** An artifact (audio overview, etc.) from NotebookLM. */
export interface ArtifactRecord {
  id: string;
  title: string;
  /** Artifact type enum from the API. */
  typeCode: number;
  /** Direct media URL for audio playback, if available. */
  mediaUrl?: string;
  /** Unix ms creation timestamp. */
  createdAt?: number;
  /** Status: 1 = processing, 2 = pending, 3 = completed. */
  status?: number;
}

/** A note with an ID for the detail page. */
export interface NoteDetailRecord extends NoteRecord {
  id: string;
}

/** A single NotebookLM note entry used for notes exports. */
export interface NoteRecord {
  title: string;
  /** Body text of the note. Empty string if the editor content could not be read. */
  content: string;
}

/** A user-defined collection for grouping notebooks. */
export interface NotebookCollection {
  id: string;
  name: string;
  color?: string;
  createdAt: number;
}

/** User annotations for a single notebook: tags and optional collection assignment. Stored separately from NotebookMeta so API syncs never clobber user data. */
export interface NotebookAnnotation {
  notebookId: string;
  tags: string[];
  collectionId?: string;
  /** Set by the 'archive-notebook' pipeline action. Hides the notebook from the default notebooks view. */
  archived?: boolean;
}

// ── Podcast types ─────────────────────────────────────────────────────────────

/** Source of an episode track — either a NotebookLM artifact or a user-uploaded file. */
export type EpisodeTrackSource =
  | { kind: 'artifact'; artifactId: string; mediaUrl: string; notebookId: string; notebookTitle: string }
  | { kind: 'custom'; customAudioId: string };

/** A single audio track within a podcast episode. */
export interface EpisodeTrack {
  trackId: string;
  title: string;
  /** Populated after first play via audio element's loadedmetadata event. */
  durationSeconds?: number;
  source: EpisodeTrackSource;
  addedAt: number;
}

/** A user-created podcast episode containing an ordered list of tracks. */
export interface PodcastEpisode {
  id: string;
  title: string;
  description?: string;
  tracks: EpisodeTrack[];
  createdAt: number;
  updatedAt: number;
}

/** Custom audio blob entry stored in the podcast-audio-store IndexedDB. */
export interface CustomAudioEntry {
  id: string;
  filename: string;
  mimeType: string;
  blob: Blob;
  addedAt: number;
}

// ── Notebook types ─────────────────────────────────────────────────────────────

/** Metadata for a NotebookLM notebook, synced via chrome.storage.sync for cross-device access. */
export interface NotebookMeta {
  /** Notebook ID from the batchexecute API response. */
  id: string;
  title: string;
  /** Canonical URL: https://notebooklm.google.com/notebook/<id> */
  url: string;
  /** Unix ms — creation timestamp from the API. */
  createdAt: number;
  /** Unix ms — when the extension last fetched this notebook's data. */
  lastSyncedAt: number;
  /** true = user owns this notebook; false = shared with user. */
  isOwner: boolean;
}