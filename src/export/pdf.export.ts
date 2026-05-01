/**
 * @module pdf.export
 * @description Implements ExportStrategy to render a chat session as a paginated A4 PDF using jsPDF. Applies role-coloured heading bars, grey metadata blocks for system messages, word-wrapped body text, and page-number footers. Records the export to chrome.storage via storageService after saving.
 * @dependencies export-strategy.interface, types, services/storage-service
 * @public PdfExportStrategy
 */
import { jsPDF } from 'jspdf';
import type { ExportStrategy } from './export-strategy.interface';
import type { ChatMessage } from '@/types';
import { storageService } from '@/services/storage-service';

const PAGE_WIDTH_MM = 210; // A4 page width in millimetres
const PAGE_HEIGHT_MM = 297; // A4 page height in millimetres
const MARGIN_MM = 20; // uniform page margin (left, right, top, bottom)
const TEXT_WIDTH_MM = PAGE_WIDTH_MM - MARGIN_MM * 2; // usable text column width

// Points → mm conversion factor
const PT_TO_MM = 0.352778; // 1 typographic point = 0.352778 mm (exact by definition)

// ── Typography ────────────────────────────────────────────────────────────────
const LINE_HEIGHT_RATIO = 1.4; // leading multiplier applied to font size in pt
const TITLE_FONT_SIZE_PT = 18; // document title ("Chat Export")
const SUBTITLE_FONT_SIZE_PT = 10; // export timestamp below title
const ROLE_FONT_SIZE_PT = 13; // "You" / "Assistant" role label
const BODY_FONT_SIZE_PT = 11; // message body text
const META_FONT_SIZE_PT = 10; // system-message metadata block text
const FOOTER_FONT_SIZE_PT = 9; // page-number footer

// ── Spacing (mm) ──────────────────────────────────────────────────────────────
const TITLE_BOTTOM_NUDGE_MM = 2; // gap between title line and subtitle
const HEADER_BOTTOM_GAP_MM = 8; // gap between subtitle and first message
const ROLE_UNDERLINE_THICKNESS_MM = 0.5; // height of the coloured rule below role label
const ROLE_UNDERLINE_Y_OFFSET_MM = 1; // vertical nudge to align rule with text baseline
const ROLE_LABEL_BOTTOM_NUDGE_MM = 1; // gap between role underline and body text
const MESSAGE_BOTTOM_GAP_MM = 6; // vertical gap between successive messages
const BLOCK_PADDING_MM = 8; // horizontal padding inside system-message box
const BLOCK_INNER_GAP_MM = 4; // extra space check before starting a system block
const BLOCK_CORNER_RADIUS_MM = 2; // rounded-rect corner radius for system block
const BLOCK_Y_OFFSET_MM = 2; // upward shift so block border aligns with text top
const BLOCK_BOTTOM_GAP_MM = 6; // gap after system-message block
const FOOTER_BOTTOM_OFFSET_MM = 10; // distance of footer text from bottom page edge

// ── Colours (R, G, B) ─────────────────────────────────────────────────────────
const COLOR_BLACK: [number, number, number] = [0, 0, 0]; // default text
const COLOR_USER_ROLE: [number, number, number] = [37, 99, 235]; // blue-600 — user role label bar
const COLOR_ASSISTANT_ROLE: [number, number, number] = [124, 58, 237]; // violet-600 — assistant role label bar
const COLOR_META_TEXT: [number, number, number] = [95, 99, 104]; // Google grey-700 — system block text
const COLOR_META_BG: [number, number, number] = [248, 249, 250]; // Google grey-50 — system block fill
const COLOR_META_BORDER: [number, number, number] = [218, 220, 224]; // Google grey-300 — system block stroke
const COLOR_FOOTER: [number, number, number] = [156, 163, 175]; // Tailwind gray-400 — page number

export class PdfExportStrategy implements ExportStrategy {
  readonly type = 'pdf';
  readonly label = 'PDF (.pdf)';
  readonly fileExtension = 'pdf';

  async export(messages: ChatMessage[], filename = 'chat-export'): Promise<void> {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    let y = MARGIN_MM;

    const lineHeight = (sizePt: number) => sizePt * PT_TO_MM * LINE_HEIGHT_RATIO;

    const ensureSpace = (neededMm: number) => {
      if (y + neededMm > PAGE_HEIGHT_MM - MARGIN_MM) {
        doc.addPage();
        y = MARGIN_MM;
      }
    };

    const writeLine = (text: string, sizePt: number, style: 'normal' | 'bold' | 'italic') => {
      doc.setFontSize(sizePt);
      doc.setFont('helvetica', style);
      const lh = lineHeight(sizePt);
      const lines = doc.splitTextToSize(text, TEXT_WIDTH_MM) as string[];
      for (const line of lines) {
        ensureSpace(lh);
        doc.text(line, MARGIN_MM, y);
        y += lh;
      }
    };

    // ── Header ──────────────────────────────────────────────────────────────
    writeLine('Chat Export', TITLE_FONT_SIZE_PT, 'bold');
    y += TITLE_BOTTOM_NUDGE_MM;
    writeLine(`Exported on ${new Date().toLocaleString()}`, SUBTITLE_FONT_SIZE_PT, 'italic');
    y += HEADER_BOTTOM_GAP_MM;

    // ── Messages ────────────────────────────────────────────────────────────
    for (const message of messages) {
      if (message.role === 'system') {
        // Render as a metadata block: light grey box, no role label
        ensureSpace(lineHeight(META_FONT_SIZE_PT) + BLOCK_INNER_GAP_MM);
        doc.setFillColor(...COLOR_META_BG);
        doc.setDrawColor(...COLOR_META_BORDER);
        const contentLines = doc.splitTextToSize(message.content, TEXT_WIDTH_MM - BLOCK_PADDING_MM) as string[];
        const blockHeight = contentLines.length * lineHeight(META_FONT_SIZE_PT) + BLOCK_PADDING_MM;
        ensureSpace(blockHeight);
        doc.roundedRect(MARGIN_MM, y - BLOCK_Y_OFFSET_MM, TEXT_WIDTH_MM, blockHeight, BLOCK_CORNER_RADIUS_MM, BLOCK_CORNER_RADIUS_MM, 'FD');
        doc.setTextColor(...COLOR_META_TEXT);
        writeLine(message.content, META_FONT_SIZE_PT, 'italic');
        doc.setTextColor(...COLOR_BLACK);
        y += BLOCK_BOTTOM_GAP_MM;
        continue;
      }

      const roleLabel = message.role === 'user' ? 'You' : 'Assistant';

      // Role label with coloured underline bar
      const roleColor: [number, number, number] =
        message.role === 'user' ? COLOR_USER_ROLE : COLOR_ASSISTANT_ROLE;

      ensureSpace(lineHeight(ROLE_FONT_SIZE_PT) + ROLE_LABEL_BOTTOM_NUDGE_MM);
      doc.setFillColor(...roleColor);
      doc.rect(MARGIN_MM, y - lineHeight(ROLE_FONT_SIZE_PT) + ROLE_UNDERLINE_Y_OFFSET_MM, TEXT_WIDTH_MM, ROLE_UNDERLINE_THICKNESS_MM, 'F');
      writeLine(roleLabel, ROLE_FONT_SIZE_PT, 'bold');
      y += ROLE_LABEL_BOTTOM_NUDGE_MM;

      writeLine(message.content, BODY_FONT_SIZE_PT, 'normal');
      y += MESSAGE_BOTTOM_GAP_MM;
    }

    // ── Page numbers ─────────────────────────────────────────────────────────
    const totalPages = (doc.internal as unknown as { getNumberOfPages(): number }).getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(FOOTER_FONT_SIZE_PT);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLOR_FOOTER);
      doc.text(`${i} / ${totalPages}`, PAGE_WIDTH_MM - MARGIN_MM, PAGE_HEIGHT_MM - FOOTER_BOTTOM_OFFSET_MM, {
        align: 'right',
      });
      doc.setTextColor(...COLOR_BLACK);
    }

    doc.save(`${filename}.${this.fileExtension}`);
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
}
