import type { ExportStrategy } from './export-strategy.interface';
import type { ChatMessage } from '@/types';

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
