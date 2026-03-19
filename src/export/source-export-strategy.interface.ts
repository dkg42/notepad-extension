import type { SourceRecord } from '@/types';

/**
 * Strategy interface for exporting a NotebookLM source list.
 * Parallel to ExportStrategy but operates on SourceRecord[] instead of ChatMessage[].
 *
 * To add a new format:
 *   1. Create src/export/source-<format>.export.ts implementing this interface.
 *   2. Register it in src/export/source-export-registry.ts — nothing else changes.
 */
export interface SourceExportStrategy {
  /** Internal identifier (e.g. 'source-markdown'). */
  readonly type: string;
  /** Human-readable label shown in the format picker (e.g. 'Markdown (.md)'). */
  readonly label: string;
  /** File extension without the dot (e.g. 'md'). */
  readonly fileExtension: string;
  export(sources: SourceRecord[], filename?: string): Promise<void>;
}
