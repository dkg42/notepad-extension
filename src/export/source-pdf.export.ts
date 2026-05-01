/**
 * @module source-pdf.export
 * @description Implements SourceExportStrategy to render a NotebookLM source list as a paginated A4 PDF using jsPDF. Each row features an alternating-row background, a colour-coded type badge pill matching the modal UI colours, and a page-number footer. Type colours are defined per SourceType to match the in-extension badge palette.
 * @dependencies source-export-strategy.interface, types
 * @public SourcePdfExportStrategy
 */
import { jsPDF } from 'jspdf';
import type { SourceExportStrategy } from './source-export-strategy.interface';
import type { SourceRecord } from '@/types';

const PAGE_WIDTH_MM = 210; // A4
const PAGE_HEIGHT_MM = 297; // A4
const MARGIN_MM = 20;
const TEXT_WIDTH_MM = PAGE_WIDTH_MM - MARGIN_MM * 2;
const PT_TO_MM = 0.352778;

// Type badge colours (RGB) matching the modal badge colours
const TYPE_COLORS: Record<string, [number, number, number]> = {
  pdf:     [220, 38,  38 ],
  youtube: [220, 38,  38 ],
  gdoc:    [37,  99,  235],
  gslide:  [161, 107, 8  ],
  website: [22,  163, 74 ],
  audio:   [124, 58,  237],
  text:    [75,  85,  99 ],
  unknown: [107, 114, 128],
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

export class SourcePdfExportStrategy implements SourceExportStrategy {
  readonly type = 'source-pdf';
  readonly label = 'PDF (.pdf)';
  readonly fileExtension = 'pdf';

  async export(sources: SourceRecord[], filename = 'notebooklm-sources'): Promise<void> {
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
    writeLine('NotebookLM Sources Export', 18, 'bold');
    y += 2;
    writeLine(`Exported on ${new Date().toLocaleString()}`, 10, 'italic');
    y += 2;
    writeLine(`${sources.length} source${sources.length === 1 ? '' : 's'}`, 10, 'normal');
    y += 8;

    // ── Source rows ──────────────────────────────────────────────────────────
    const rowHeight = lineHeight(11) + 3;
    const typeBadgeWidth = 28;
    const indexColWidth = 10;

    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      ensureSpace(rowHeight + 1);

      // Alternating row background
      if (i % 2 === 0) {
        doc.setFillColor(248, 249, 250);
        doc.rect(MARGIN_MM, y - lineHeight(11) + 1, TEXT_WIDTH_MM, rowHeight, 'F');
      }

      // Index number
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 114, 128);
      doc.text(String(i + 1), MARGIN_MM + 2, y);

      // Type badge (coloured background pill)
      const color = TYPE_COLORS[source.type] ?? TYPE_COLORS.unknown;
      const label = TYPE_LABELS[source.type] ?? 'Unknown';
      const badgeX = MARGIN_MM + indexColWidth;
      const badgeY = y - lineHeight(9) + 0.5;

      doc.setFillColor(color[0], color[1], color[2]);
      doc.roundedRect(badgeX, badgeY, typeBadgeWidth, lineHeight(9) + 1.5, 1, 1, 'F');

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(label, badgeX + typeBadgeWidth / 2, y - 0.5, { align: 'center' });

      // Title
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(31, 41, 55);
      const titleX = MARGIN_MM + indexColWidth + typeBadgeWidth + 4;
      const titleWidth = TEXT_WIDTH_MM - indexColWidth - typeBadgeWidth - 4;
      const titleLines = doc.splitTextToSize(source.title, titleWidth) as string[];
      doc.text(titleLines[0], titleX, y);

      doc.setTextColor(0, 0, 0);
      y += rowHeight;
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
    }

    doc.save(`${filename}.${this.fileExtension}`);
  }
}
