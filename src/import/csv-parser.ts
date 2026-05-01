/**
 * @module csv-parser
 * @description RFC 4180-compliant CSV parser with automatic delimiter detection (comma, semicolon, tab), BOM stripping, and intelligent URL column detection by both header name heuristics and value density sampling. Designed for the bulk URL import flow where users paste or upload a spreadsheet export containing a column of URLs to add to NotebookLM.
 * @dependencies none
 * @public CsvParseResult, parseCsv, extractUrlsFromColumn
 */

const URL_PATTERN = /^https?:\/\/.+/i;
const URL_HEADER_NAMES = ['url', 'link', 'href', 'uri', 'website', 'address'];

export interface CsvParseResult {
  /** All headers found in the CSV. */
  headers: string[];
  /** Index of the auto-detected URL column (-1 if none detected). */
  detectedColumnIndex: number;
  /** All rows (excluding header), with each row being an array of cell values. */
  rows: string[][];
}

/**
 * Parses CSV text into headers and rows.
 * Supports quoted fields (RFC 4180), handles BOM, and auto-detects delimiters.
 */
export function parseCsv(text: string): CsvParseResult {
  // Strip BOM
  const cleaned = text.replace(/^\uFEFF/, '');

  // Auto-detect delimiter (comma vs semicolon vs tab)
  const delimiter = detectDelimiter(cleaned);

  const lines = splitCsvLines(cleaned, delimiter);
  if (lines.length === 0) {
    return { headers: [], detectedColumnIndex: -1, rows: [] };
  }

  const headers = lines[0];
  const rows = lines.slice(1).filter((row) => row.some((cell) => cell.trim() !== ''));

  const detectedColumnIndex = detectUrlColumn(headers, rows);

  return { headers, detectedColumnIndex, rows };
}

/** Extracts validated URLs from a specific column of parsed CSV rows. */
export function extractUrlsFromColumn(rows: string[][], columnIndex: number): string[] {
  const urls: string[] = [];
  for (const row of rows) {
    const value = row[columnIndex]?.trim();
    if (value && URL_PATTERN.test(value)) {
      urls.push(value);
    }
  }
  return urls;
}

/** Detects the most likely delimiter in the CSV text. */
function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] ?? '';
  const commas = (firstLine.match(/,/g) ?? []).length;
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const tabs = (firstLine.match(/\t/g) ?? []).length;

  if (tabs > commas && tabs > semicolons) return '\t';
  if (semicolons > commas) return ';';
  return ',';
}

/**
 * Splits CSV text into rows of cells, handling quoted fields correctly.
 */
function splitCsvLines(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          // Escaped quote
          currentCell += '"';
          i += 2;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
        }
      } else {
        currentCell += char;
        i++;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
      } else if (char === delimiter) {
        currentRow.push(currentCell.trim());
        currentCell = '';
        i++;
      } else if (char === '\r' || char === '\n') {
        currentRow.push(currentCell.trim());
        currentCell = '';
        rows.push(currentRow);
        currentRow = [];
        // Handle \r\n
        if (char === '\r' && i + 1 < text.length && text[i + 1] === '\n') {
          i += 2;
        } else {
          i++;
        }
      } else {
        currentCell += char;
        i++;
      }
    }
  }

  // Push final cell and row
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Auto-detects the URL column by:
 * 1. Checking header names for common URL-related terms.
 * 2. Scanning column values for the highest URL density.
 */
function detectUrlColumn(headers: string[], rows: string[][]): number {
  // Check headers first
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].toLowerCase().replace(/[^a-z]/g, '');
    if (URL_HEADER_NAMES.includes(header)) return i;
  }

  // Fall back to scanning column values
  let bestColumn = -1;
  let bestCount = 0;

  for (let col = 0; col < headers.length; col++) {
    let urlCount = 0;
    const sampleSize = Math.min(rows.length, 20);
    for (let row = 0; row < sampleSize; row++) {
      if (URL_PATTERN.test(rows[row]?.[col]?.trim() ?? '')) {
        urlCount++;
      }
    }
    if (urlCount > bestCount) {
      bestCount = urlCount;
      bestColumn = col;
    }
  }

  return bestCount > 0 ? bestColumn : -1;
}
