import type { SourceExportStrategy } from './source-export-strategy.interface';
import type { SourceRecord } from '@/types';

const TYPE_COLORS: Record<string, string> = {
  pdf:     '#dc2626',
  youtube: '#dc2626',
  gdoc:    '#2563eb',
  gslide:  '#a16207',
  website: '#16a34a',
  audio:   '#7c3aed',
  text:    '#4b5563',
  unknown: '#6b7280',
};

const TYPE_LABELS: Record<string, string> = {
  pdf:     'PDF',
  youtube: 'YouTube',
  gdoc:    'Google Doc',
  gslide:  'Google Slides',
  website: 'Website',
  audio:   'Audio',
  text:    'Text',
  unknown: 'Unknown',
};

export class SourceGoogleDocExportStrategy implements SourceExportStrategy {
  readonly type = 'source-google-doc';
  readonly label = 'Google Doc (.doc)';
  readonly fileExtension = 'doc';

  async export(sources: SourceRecord[], filename = 'notebooklm-sources'): Promise<void> {
    const content = this.formatAsHtml(sources, filename);
    await this.downloadFile(content, filename);
  }

  private formatAsHtml(sources: SourceRecord[], title: string): string {
    const rows = sources
      .map((s, i) => {
        const color = TYPE_COLORS[s.type] ?? TYPE_COLORS.unknown;
        const label = TYPE_LABELS[s.type] ?? 'Unknown';
        const bg = i % 2 === 0 ? '#f9fafb' : '#ffffff';
        return `
        <tr style="background:${bg};">
          <td style="width:32px; padding:8px 10px; color:#9ca3af; font-size:10pt; text-align:right;">${i + 1}</td>
          <td style="width:96px; padding:8px 6px;">
            <span style="display:inline-block; padding:2px 8px; border-radius:12px;
                         background:${color}; color:#fff; font-size:9pt; font-weight:bold;
                         white-space:nowrap;">${this.escapeHtml(label)}</span>
          </td>
          <td style="padding:8px 10px; font-size:11pt; color:#111827;">${this.escapeHtml(s.title)}</td>
        </tr>`;
      })
      .join('\n');

    return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40" lang="en">
<head>
  <meta charset="UTF-8">
  <meta name=ProgId content=Word.Document>
  <meta name=Generator content="LLM Chat Enhancer">
  <title>${this.escapeHtml(title)}</title>
  <style>
    body  { font-family: Arial, sans-serif; font-size: 11pt; color: #111827; margin: 2cm; }
    h1    { font-size: 18pt; font-weight: bold; margin-bottom: 4pt; }
    .meta { font-size: 10pt; color: #6b7280; margin-bottom: 24pt; }
    table { border-collapse: collapse; width: 100%; }
    th    { background: #f3f4f6; padding: 8px 10px; font-size: 10pt;
            font-weight: bold; color: #374151; text-align: left; }
  </style>
</head>
<body>
  <h1>NotebookLM Sources Export</h1>
  <p class="meta">
    Exported on ${new Date().toLocaleString()} &mdash;
    ${sources.length} source${sources.length === 1 ? '' : 's'}
  </p>
  <table>
    <thead>
      <tr>
        <th style="width:32px;">#</th>
        <th style="width:96px;">Type</th>
        <th>Title</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private async downloadFile(content: string, filename: string): Promise<void> {
    const blob = new Blob([content], { type: 'application/msword;charset=utf-8' });
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
