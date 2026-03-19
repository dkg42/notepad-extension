import type { ExportStrategy } from './export-strategy.interface';
import { MarkdownExportStrategy } from './markdown.export';
import { PlainTextExportStrategy } from './plain-text.export';
import { PdfExportStrategy } from './pdf.export';
import { GoogleDocExportStrategy } from './google-doc.export';

/**
 * All registered export strategies — shown in the format picker in this order.
 * To add a new format: implement ExportStrategy and append the instance here.
 */
export const exportStrategies: ExportStrategy[] = [
  new MarkdownExportStrategy(),
  new PlainTextExportStrategy(),
  new PdfExportStrategy(),
  new GoogleDocExportStrategy(),
];
