import { jsPDF } from 'jspdf';
import type { ExportStrategy } from './export-strategy.interface';
import type { ChatMessage } from '@/types';

const PAGE_WIDTH_MM = 210; // A4
const PAGE_HEIGHT_MM = 297; // A4
const MARGIN_MM = 20;
const TEXT_WIDTH_MM = PAGE_WIDTH_MM - MARGIN_MM * 2;

// Points → mm conversion factor
const PT_TO_MM = 0.352778;

export class PdfExportStrategy implements ExportStrategy {
  readonly type = 'pdf';
  readonly label = 'PDF (.pdf)';
  readonly fileExtension = 'pdf';

  async export(messages: ChatMessage[], filename = 'chat-export'): Promise<void> {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    let y = MARGIN_MM;

    const lineHeight = (sizePt: number) => sizePt * PT_TO_MM * 1.4;

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
    writeLine('Chat Export', 18, 'bold');
    y += 2;
    writeLine(`Exported on ${new Date().toLocaleString()}`, 10, 'italic');
    y += 8;

    // ── Messages ────────────────────────────────────────────────────────────
    for (const message of messages) {
      if (message.role === 'system') {
        // Render as a metadata block: light grey box, no role label
        ensureSpace(lineHeight(10) + 4);
        doc.setFillColor(248, 249, 250);
        doc.setDrawColor(218, 220, 224);
        const contentLines = doc.splitTextToSize(message.content, TEXT_WIDTH_MM - 8) as string[];
        const blockHeight = contentLines.length * lineHeight(10) + 8;
        ensureSpace(blockHeight);
        doc.roundedRect(MARGIN_MM, y - 2, TEXT_WIDTH_MM, blockHeight, 2, 2, 'FD');
        doc.setTextColor(95, 99, 104);
        writeLine(message.content, 10, 'italic');
        doc.setTextColor(0, 0, 0);
        y += 6;
        continue;
      }

      const roleLabel = message.role === 'user' ? 'You' : 'Assistant';

      // Role label with coloured underline bar
      const roleColor: [number, number, number] =
        message.role === 'user' ? [37, 99, 235] : [124, 58, 237];

      ensureSpace(lineHeight(13) + 2);
      doc.setFillColor(...roleColor);
      doc.rect(MARGIN_MM, y - lineHeight(13) + 1, TEXT_WIDTH_MM, 0.5, 'F');
      writeLine(roleLabel, 13, 'bold');
      y += 1;

      writeLine(message.content, 11, 'normal');
      y += 6;
    }

    // ── Page numbers ─────────────────────────────────────────────────────────
    const totalPages = (doc.internal as unknown as { getNumberOfPages(): number }).getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(156, 163, 175);
      doc.text(`${i} / ${totalPages}`, PAGE_WIDTH_MM - MARGIN_MM, PAGE_HEIGHT_MM - 10, {
        align: 'right',
      });
      doc.setTextColor(0, 0, 0);
    }

    doc.save(`${filename}.${this.fileExtension}`);
  }
}
