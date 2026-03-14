import type { ChatMessage } from '@/types';

/**
 * Strategy interface for exporting a chat session.
 * Implement this interface to add new export formats (PDF, Google Docs, etc.)
 * without modifying existing strategies.
 */
export interface ExportStrategy {
  readonly type: string;
  export(messages: ChatMessage[], filename?: string): Promise<void>;
}
