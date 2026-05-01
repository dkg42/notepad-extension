/**
 * @module CsvUploadForm
 * @description Renders a file-drop zone for CSV upload, a column selector to identify the URL column, a preview of the first five rows, and a confirm button to import the selected URLs.
 * @dependencies useCsvUploadForm
 * @public CsvUploadForm
 */
import React, { useRef } from 'react';
import { useCsvUploadForm } from './useCsvUploadForm';
import './CsvUploadForm.css';

interface CsvUploadFormProps {
  onImport: (urls: string[]) => void;
  disabled?: boolean;
}

export default function CsvUploadForm({ onImport, disabled }: CsvUploadFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    parseResult,
    selectedColumn,
    setSelectedColumn,
    error,
    fileName,
    handleFile,
    getUrls,
    reset,
  } = useCsvUploadForm();

  const urls = getUrls();
  const previewRows = parseResult?.rows.slice(0, 5) ?? [];

  return (
    <div className="csv-form">
      {!parseResult ? (
        <div className="csv-form__drop-zone">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="csv-form__file-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = '';
            }}
          />
          <button
            className="csv-form__upload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
          >
            Choose CSV File
          </button>
          <span className="csv-form__hint">
            Upload a CSV file containing URLs to import
          </span>
        </div>
      ) : (
        <>
          <div className="csv-form__file-info">
            <span className="csv-form__file-name">{fileName}</span>
            <span className="csv-form__file-stats">
              {parseResult.rows.length} rows, {parseResult.headers.length} columns
            </span>
            <button className="csv-form__reset-btn" onClick={reset}>
              Choose different file
            </button>
          </div>

          <div className="csv-form__column-select">
            <label className="csv-form__label">URL column:</label>
            <select
              className="csv-form__select"
              value={selectedColumn}
              onChange={(e) => setSelectedColumn(Number(e.target.value))}
            >
              <option value={-1}>Select a column…</option>
              {parseResult.headers.map((header, i) => (
                <option key={i} value={i}>
                  {header || `Column ${i + 1}`}
                </option>
              ))}
            </select>
          </div>

          {selectedColumn >= 0 && previewRows.length > 0 && (
            <div className="csv-form__preview">
              <div className="csv-form__preview-label">
                Preview (first {previewRows.length} rows):
              </div>
              <div className="csv-form__preview-list">
                {previewRows.map((row, i) => {
                  const value = row[selectedColumn] ?? '';
                  const isUrl = /^https?:\/\/.+/i.test(value.trim());
                  return (
                    <div
                      key={i}
                      className={`csv-form__preview-row${isUrl ? '' : ' csv-form__preview-row--invalid'}`}
                    >
                      {value || '(empty)'}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="csv-form__footer">
            <span className="csv-form__url-count">
              {urls.length} valid URL{urls.length !== 1 ? 's' : ''} found
            </span>
            <button
              className="csv-form__import-btn"
              onClick={() => onImport(urls)}
              disabled={disabled || urls.length === 0}
            >
              Import {urls.length} URL{urls.length !== 1 ? 's' : ''}
            </button>
          </div>
        </>
      )}
      {error && <div className="csv-form__error">{error}</div>}
    </div>
  );
}
