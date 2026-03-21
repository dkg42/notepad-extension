export interface Folder {
  id: string;
  name: string;
  createdAt: number;
}

export interface Snippet {
  id: string;
  text: string;
  /** Full URL of the page where the snippet was saved */
  source: string;
  savedAt: number;
  folderId?: string;
  tags?: string[];
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