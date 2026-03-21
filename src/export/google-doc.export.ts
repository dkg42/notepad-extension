import type { ExportStrategy } from './export-strategy.interface';
import type { ChatMessage } from '@/types';
import { storageService } from '@/services/storage-service';

/**
 * Exports the chat as an HTML-based .doc file.
 * Microsoft Word and Google Docs both open this format natively —
 * users can import it into Google Drive to get a live Google Doc.
 *
 * ── Future: direct Google Docs sync ──────────────────────────────────────────
 * When Google Drive sync is added:
 *   1. Add `identity` permission + `oauth2.client_id` to wxt.config.ts manifest.
 *   2. Uncomment the identity handler in src/entrypoints/background.ts.
 *   3. Replace `this.downloadFile()` below with `this.syncToGoogleDocs()`, which:
 *        - Sends { type: 'GET_GOOGLE_AUTH_TOKEN' } to the background service worker
 *        - POSTs a multipart/related body to https://www.googleapis.com/upload/drive/v3/files
 *          with mimeType: 'application/vnd.google-apps.document'
 *        - Opens the returned doc URL in a new tab
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class GoogleDocExportStrategy implements ExportStrategy {
  readonly type = 'google-doc';
  readonly label = 'Google Doc (.doc)';
  readonly fileExtension = 'doc';

  async export(messages: ChatMessage[], filename = 'chat-export'): Promise<void> {
    const content = this.formatAsHtml(messages, filename);
    await this.downloadFile(content, filename);
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

  private formatAsHtml(messages: ChatMessage[], title: string): string {
    const blocks = messages
      .map((m) => {
        if (m.role === 'system') {
          const escapedContent = this.escapeHtml(m.content).replace(/\n/g, '<br>');
          return `
        <div style="margin-bottom:20px; padding:10px 14px; background:#f8f9fa;
                    border:1px solid #e8eaed; border-radius:6px;">
          <p style="margin:0; font-size:10pt; color:#5f6368; line-height:1.6;">${escapedContent}</p>
        </div>`;
        }
        const roleLabel = m.role === 'user' ? 'You' : 'Assistant';
        const roleColor = m.role === 'user' ? '#2563eb' : '#7c3aed';
        const escapedContent = this.escapeHtml(m.content).replace(/\n/g, '<br>');
        return `
        <div style="margin-bottom:20px; padding:10px 14px; border-left:4px solid ${roleColor};">
          <p style="margin:0 0 6px; font-size:10pt; font-weight:bold; color:${roleColor};
                    text-transform:uppercase; letter-spacing:0.05em;">${roleLabel}</p>
          <p style="margin:0; font-size:11pt; line-height:1.6;">${escapedContent}</p>
        </div>`;
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
  </style>
</head>
<body>
  <h1>${this.escapeHtml(title)}</h1>
  <p class="meta">Exported on ${new Date().toLocaleString()}</p>
  ${blocks}
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