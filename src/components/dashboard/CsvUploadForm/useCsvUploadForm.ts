/**
 * @module useCsvUploadForm
 * @description React hook that handles CSV file uploading, parsing, and column selection for URL extraction. Reads the file with FileReader, delegates parsing to csv-parser utilities, and exposes the selected URL list for downstream processing.
 * @dependencies @/import/csv-parser
 * @public useCsvUploadForm
 */
import { useCallback, useState } from 'react';
import { parseCsv, extractUrlsFromColumn } from '@/import/csv-parser';
import type { CsvParseResult } from '@/import/csv-parser';

export function useCsvUploadForm() {
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<number>(-1);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = useCallback((file: File) => {
    setError(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text !== 'string') {
        setError('Could not read file.');
        return;
      }

      try {
        const result = parseCsv(text);
        if (result.headers.length === 0) {
          setError('CSV file appears to be empty.');
          return;
        }
        setParseResult(result);
        setSelectedColumn(result.detectedColumnIndex);
      } catch {
        setError('Failed to parse CSV file.');
      }
    };
    reader.onerror = () => setError('Failed to read file.');
    reader.readAsText(file);
  }, []);

  const getUrls = useCallback((): string[] => {
    if (!parseResult || selectedColumn < 0) return [];
    return extractUrlsFromColumn(parseResult.rows, selectedColumn);
  }, [parseResult, selectedColumn]);

  const reset = useCallback(() => {
    setParseResult(null);
    setSelectedColumn(-1);
    setError(null);
    setFileName(null);
  }, []);

  return {
    parseResult,
    selectedColumn,
    setSelectedColumn,
    error,
    fileName,
    handleFile,
    getUrls,
    reset,
  };
}
