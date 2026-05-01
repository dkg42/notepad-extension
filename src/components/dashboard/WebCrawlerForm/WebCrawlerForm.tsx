/**
 * @module WebCrawlerForm
 * @description Renders a URL crawling form where users can enter a seed URL, configure depth and domain constraints, preview discovered URLs, and select them for import.
 * @dependencies useWebCrawlerForm
 * @public WebCrawlerForm
 */
import React from 'react';
import { useWebCrawlerForm } from './useWebCrawlerForm';
import './WebCrawlerForm.css';

interface WebCrawlerFormProps {
  onImport: (urls: string[]) => void;
  disabled?: boolean;
}

export default function WebCrawlerForm({ onImport, disabled }: WebCrawlerFormProps) {
  const {
    seedUrl,
    setSeedUrl,
    depth,
    setDepth,
    sameDomainOnly,
    setSameDomainOnly,
    maxUrls,
    setMaxUrls,
    discoveredUrls,
    selectedUrls,
    isCrawling,
    error,
    startCrawl,
    toggleUrl,
    toggleAll,
    getSelectedUrls,
  } = useWebCrawlerForm();

  const selected = getSelectedUrls();
  const allSelected = discoveredUrls.length > 0 && discoveredUrls.every((u) => selectedUrls.has(u));

  return (
    <div className="crawler-form">
      <div className="crawler-form__input-row">
        <input
          type="url"
          className="crawler-form__url-input"
          placeholder="Enter seed URL to crawl…"
          value={seedUrl}
          onChange={(e) => setSeedUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && seedUrl.trim()) void startCrawl();
          }}
          disabled={isCrawling || disabled}
        />
        <button
          className="crawler-form__crawl-btn"
          onClick={() => void startCrawl()}
          disabled={isCrawling || !seedUrl.trim() || disabled}
        >
          {isCrawling ? 'Crawling…' : 'Start Crawl'}
        </button>
      </div>

      <div className="crawler-form__options">
        <div className="crawler-form__option">
          <label className="crawler-form__option-label">Depth:</label>
          <input
            type="range"
            className="crawler-form__slider"
            min={0}
            max={3}
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
            disabled={isCrawling}
          />
          <span className="crawler-form__option-value">{depth}</span>
        </div>
        <div className="crawler-form__option">
          <label className="crawler-form__option-label">Max URLs:</label>
          <input
            type="number"
            className="crawler-form__number-input"
            min={1}
            max={200}
            value={maxUrls}
            onChange={(e) => setMaxUrls(Math.min(200, Math.max(1, Number(e.target.value))))}
            disabled={isCrawling}
          />
        </div>
        <label className="crawler-form__checkbox-label">
          <input
            type="checkbox"
            checked={sameDomainOnly}
            onChange={(e) => setSameDomainOnly(e.target.checked)}
            disabled={isCrawling}
          />
          Same domain only
        </label>
      </div>

      {error && <div className="crawler-form__error">{error}</div>}

      {discoveredUrls.length > 0 && (
        <>
          <div className="crawler-form__results-header">
            <label className="crawler-form__select-all">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
              />
              Select all ({discoveredUrls.length} discovered)
            </label>
          </div>

          <div className="crawler-form__results">
            {discoveredUrls.map((url) => (
              <label key={url} className="crawler-form__result-row">
                <input
                  type="checkbox"
                  checked={selectedUrls.has(url)}
                  onChange={() => toggleUrl(url)}
                />
                <span className="crawler-form__result-url">{url}</span>
              </label>
            ))}
          </div>

          <div className="crawler-form__footer">
            <span className="crawler-form__count">
              {selected.length} URL{selected.length !== 1 ? 's' : ''} selected
            </span>
            <button
              className="crawler-form__import-btn"
              onClick={() => onImport(selected)}
              disabled={disabled || selected.length === 0}
            >
              Import {selected.length} URL{selected.length !== 1 ? 's' : ''}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
