import type { SourceExportStrategy } from './source-export-strategy.interface';
import { SourceMarkdownExportStrategy } from './source-markdown.export';
import { SourcePlainTextExportStrategy } from './source-plain-text.export';
import { SourcePdfExportStrategy } from './source-pdf.export';
import { SourceGoogleDocExportStrategy } from './source-google-doc.export';

/**
 * All registered source export strategies — shown in the modal format picker in this order.
 * To add a new format: implement SourceExportStrategy and append the instance here.
 */
export const sourceExportStrategies: SourceExportStrategy[] = [
  new SourceMarkdownExportStrategy(),
  new SourcePlainTextExportStrategy(),
  new SourcePdfExportStrategy(),
  new SourceGoogleDocExportStrategy(),
];
