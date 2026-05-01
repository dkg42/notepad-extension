/**
 * @module source-markdown.export
 * @description Implements SourceExportStrategy to serialize a NotebookLM source list as a Markdown (.md) file with a GFM-compatible table of index, type, and title columns. Falls back to clipboard copy if the Blob download is blocked by the browser.
 * @dependencies source-export-strategy.interface, types
 * @public SourceMarkdownExportStrategy
 */
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

export class SourceMarkdownExportStrategy implements SourceExportStrategy {
  readonly type = 'source-markdown';
  readonly label = 'Markdown (.md)';
  readonly fileExtension = 'md';

  async export(sources: SourceRecord[], filename = 'notebooklm-sources'): Promise<void> {
    const content = this.format(sources);
    try {
      await this.downloadFile(content, filename);
    } catch {
      await navigator.clipboard.writeText(content);
    }
  }

  private format(sources: SourceRecord[]): string {
    const header = [
      '# NotebookLM Sources Export',
      `_Exported on ${new Date().toLocaleString()}_`,
      '',
      `_${sources.length} source${sources.length === 1 ? '' : 's'}_`,
      '',
      '---',
      '',
    ].join('\n');

    const tableHeader = ['| # | Type | Title |', '|---|------|-------|'].join('\n');

    const rows = sources
      .map((s, i) => {
        const label = TYPE_LABELS[s.type] ?? 'Unknown';
        return `| ${i + 1} | ${label} | ${s.title} |`;
      })
      .join('\n');

    return header + tableHeader + '\n' + rows + '\n';
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
