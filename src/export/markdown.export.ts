import type { ExportStrategy } from './export-strategy.interface';
import type { ChatMessage } from '@/types';

export class MarkdownExportStrategy implements ExportStrategy {
  readonly type = 'markdown';
  readonly label = 'Markdown (.md)';
  readonly fileExtension = 'md';

  async export(messages: ChatMessage[], filename = 'chat-export'): Promise<void> {
    const content = this.formatAsMarkdown(messages);
    try {
      await this.downloadFile(content, filename);
    } catch {
      // Fallback: copy to clipboard if file download is blocked
      await navigator.clipboard.writeText(content);
    }
  }

  private formatAsMarkdown(messages: ChatMessage[]): string {
    const header = [
      '# Chat Export',
      `_Exported on ${new Date().toLocaleString()}_`,
      '',
      '---',
      '',
    ].join('\n');

    const body = messages
      .map((m) => {
        if (m.role === 'system') return m.content;
        return `## ${m.role === 'user' ? 'You' : 'Assistant'}\n\n${m.content}`;
      })
      .join('\n\n---\n\n');

    return header + body;
  }

  private async downloadFile(content: string, filename: string): Promise<void> {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
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
