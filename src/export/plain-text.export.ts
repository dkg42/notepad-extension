import type { ExportStrategy } from './export-strategy.interface';
import type { ChatMessage } from '@/types';
import { storageService } from '@/services/storage-service';

export class PlainTextExportStrategy implements ExportStrategy {
  readonly type = 'plain-text';
  readonly label = 'Plain Text (.txt)';
  readonly fileExtension = 'txt';

  async export(messages: ChatMessage[], filename = 'chat-export'): Promise<void> {
    const content = this.formatAsPlainText(messages);
    try {
      await this.downloadFile(content, filename);
    } catch {
      await navigator.clipboard.writeText(content);
    }
    try {
      await storageService.addExportRecord({
        exportedAt: Date.now(),
        format: this.type,
        itemCount: messages.length,
        source: document.location.hostname,
        filename: `${filename}.${this.fileExtension}`,
      });
    } catch {
      // Non-critical: ignore logging errors
    }
  }

  private formatAsPlainText(messages: ChatMessage[]): string {
    const header = [
      'CHAT EXPORT',
      `Exported on ${new Date().toLocaleString()}`,
      '='.repeat(40),
      '',
    ].join('\n');

    const body = messages
      .map((m) => {
        if (m.role === 'system') {
          const divider = '='.repeat(40);
          return `${divider}\n${m.content}\n${divider}`;
        }
        const role = m.role === 'user' ? 'YOU' : 'ASSISTANT';
        const divider = '-'.repeat(40);
        return `${role}\n${divider}\n${m.content}`;
      })
      .join('\n\n');

    return header + body;
  }

  private async downloadFile(content: string, filename: string): Promise<void> {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${filename}.${this.fileExtension}`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }
}
