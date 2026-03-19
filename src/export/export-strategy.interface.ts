import type { ChatMessage } from '@/types';

/**
 * Strategy interface for exporting a chat session.
 * Implement this interface to add new export formats without modifying existing ones.
 *
 * To add a new format:
 *   1. Create src/export/<format>.export.ts implementing this interface.
 *   2. Register it in src/export/export-registry.ts — nothing else changes.
 *
 * For PDF: install `jspdf`, implement PdfExportStrategy, register it.
 * For DOCX: install `docx`, implement DocxExportStrategy, register it.
 */
export interface ExportStrategy {
  /** Internal identifier (e.g. 'markdown'). */
  readonly type: string;
  /** Human-readable label shown in the format picker (e.g. 'Markdown (.md)'). */
  readonly label: string;
  /** File extension without the dot (e.g. 'md'). */
  readonly fileExtension: string;
  export(messages: ChatMessage[], filename?: string): Promise<void>;
}
