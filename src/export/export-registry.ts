/**
 * @module export-registry
 * @description Central registry of all available chat export format strategies, ordered as they appear in the format picker UI. Adding a new chat export format requires only implementing ExportStrategy and appending an instance here — no other files need modification.
 * @dependencies export-strategy.interface, markdown.export, plain-text.export, pdf.export, google-doc.export
 * @public exportStrategies
 */
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
