import type { SourceExportStrategy } from './source-export-strategy.interface';
import type { SourceRecord } from '@/types';

const TYPE_LABELS: Record<string, string> = {
  pdf: 'PDF',
  youtube: 'YouTube',
  gdoc: 'Google Doc',
  gslide: 'Google Slides',
  website: 'Website',
  audio: 'Audio',
  text: 'Text',
  unknown: 'Unknown',
};

export class SourcePlainTextExportStrategy implements SourceExportStrategy {
  readonly type = 'source-plain-text';
  readonly label = 'Plain Text (.txt)';
  readonly fileExtension = 'txt';

  async export(sources: SourceRecord[], filename = 'notebooklm-sources'): Promise<void> {
    const content = this.format(sources);
    try {
      await this.downloadFile(content, filename);
    } catch {
      await navigator.clipboard.writeText(content);
    }
  }

  private format(sources: SourceRecord[]): string {
    const divider = '='.repeat(50);
    const header = [
      'NOTEBOOKLM SOURCES EXPORT',
      `Exported on ${new Date().toLocaleString()}`,
      `${sources.length} source${sources.length === 1 ? '' : 's'}`,
      divider,
      '',
    ].join('\n');

    // Pad type column for alignment
    const maxTypeLen = Math.max(...sources.map((s) => (TYPE_LABELS[s.type] ?? 'Unknown').length));

    const rows = sources
      .map((s, i) => {
        const idx = String(i + 1).padStart(3);
        const label = (TYPE_LABELS[s.type] ?? 'Unknown').padEnd(maxTypeLen);
        return `${idx}.  [${label}]  ${s.title}`;
      })
      .join('\n');

    return header + rows + '\n';
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
