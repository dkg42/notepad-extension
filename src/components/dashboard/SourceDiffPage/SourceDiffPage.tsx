/**
 * @module SourceDiffPage
 * @description Dashboard page that compares the sources of two user-selected notebooks
 *   and renders three sections — Only in A, Only in B, and In both — based on a
 *   URL-with-title-fallback set diff. Reuses the all-sources cache; no new RPC.
 * @dependencies ./useSourceDiffPage, @/types
 * @public SourceDiffPage
 */
import React from 'react';
import { ArrowLeftRight, GitCompare } from 'lucide-react';
import type { AggregatedSource } from '@/types';
import { useSourceDiffPage } from './useSourceDiffPage';
import './SourceDiffPage.css';

const SOURCE_TYPE_LABELS: Record<string, string> = {
  website: 'Website',
  youtube: 'YouTube',
  pdf: 'PDF',
  gdoc: 'Google Doc',
  gslide: 'Google Slides',
  unknown: 'Unknown',
};

function SourceRow({ source }: { source: AggregatedSource }) {
  const label = SOURCE_TYPE_LABELS[source.type] ?? source.type;
  const content = (
    <>
      <span className="source-diff__row-title">{source.title}</span>
      <span className="source-diff__row-type">{label}</span>
    </>
  );
  if (source.sourceUrl) {
    return (
      <a
        className="source-diff__row source-diff__row--link"
        href={source.sourceUrl}
        target="_blank"
        rel="noreferrer noopener"
      >
        {content}
      </a>
    );
  }
  return <div className="source-diff__row">{content}</div>;
}

interface DiffSectionProps {
  title: string;
  variant: 'a' | 'b' | 'both';
  items: AggregatedSource[];
  emptyText: string;
}

function DiffSection({ title, variant, items, emptyText }: DiffSectionProps) {
  return (
    <section className={`source-diff__section source-diff__section--${variant}`}>
      <header className="source-diff__section-header">
        <h2 className="source-diff__section-title">{title}</h2>
        <span className="source-diff__count">{items.length}</span>
      </header>
      {items.length === 0 ? (
        <p className="source-diff__section-empty">{emptyText}</p>
      ) : (
        <div className="source-diff__section-body">
          {items.map((s) => <SourceRow key={s.id} source={s} />)}
        </div>
      )}
    </section>
  );
}

export default function SourceDiffPage() {
  const {
    isLoading,
    error,
    setError,
    notebookOptions,
    notebookAId,
    notebookBId,
    setNotebookAId,
    setNotebookBId,
    handleSwap,
    onlyInA,
    onlyInB,
    inBoth,
    handleRefresh,
  } = useSourceDiffPage();

  const notebookATitle = notebookOptions.find((n) => n.id === notebookAId)?.title ?? 'Notebook A';
  const notebookBTitle = notebookOptions.find((n) => n.id === notebookBId)?.title ?? 'Notebook B';
  const bothPicked = notebookAId && notebookBId && notebookAId !== notebookBId;

  return (
    <div className="source-diff-page">
      <header className="source-diff-page__header">
        <div>
          <h1 className="source-diff-page__title">
            <GitCompare size={20} className="source-diff-page__title-icon" />
            Source Diff
          </h1>
          <p className="source-diff-page__subtitle">
            Compare the sources of two notebooks. Matches by URL, falling back to title.
          </p>
        </div>
        <button
          className="source-diff-page__refresh-btn"
          onClick={handleRefresh}
          disabled={isLoading}
        >
          {isLoading ? 'Loading…' : 'Refresh'}
        </button>
      </header>

      {error && (
        <div className="source-diff-page__error">
          {error}
          <button
            className="source-diff-page__error-dismiss"
            onClick={() => setError(null)}
            aria-label="Dismiss"
          >
            &#x2715;
          </button>
        </div>
      )}

      <div className="source-diff__picker">
        <label className="source-diff__picker-field">
          <span className="source-diff__picker-label">Notebook A</span>
          <select
            className="source-diff__picker-select"
            value={notebookAId}
            onChange={(e) => setNotebookAId(e.target.value)}
            disabled={isLoading && notebookOptions.length === 0}
          >
            <option value="">Select a notebook…</option>
            {notebookOptions.map((n) => (
              <option key={n.id} value={n.id} disabled={n.id === notebookBId}>
                {n.title}
              </option>
            ))}
          </select>
        </label>

        <button
          className="source-diff__swap-btn"
          onClick={handleSwap}
          disabled={!bothPicked}
          aria-label="Swap A and B"
          title="Swap A and B"
        >
          <ArrowLeftRight size={16} />
        </button>

        <label className="source-diff__picker-field">
          <span className="source-diff__picker-label">Notebook B</span>
          <select
            className="source-diff__picker-select"
            value={notebookBId}
            onChange={(e) => setNotebookBId(e.target.value)}
            disabled={isLoading && notebookOptions.length === 0}
          >
            <option value="">Select a notebook…</option>
            {notebookOptions.map((n) => (
              <option key={n.id} value={n.id} disabled={n.id === notebookAId}>
                {n.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!bothPicked ? (
        <div className="source-diff__placeholder">
          {isLoading && notebookOptions.length === 0
            ? 'Loading sources…'
            : 'Pick two notebooks above to see the diff.'}
        </div>
      ) : (
        <div className="source-diff__results">
          <DiffSection
            title={`Only in ${notebookATitle}`}
            variant="a"
            items={onlyInA}
            emptyText="No sources unique to this notebook."
          />
          <DiffSection
            title={`Only in ${notebookBTitle}`}
            variant="b"
            items={onlyInB}
            emptyText="No sources unique to this notebook."
          />
          <DiffSection
            title="In both"
            variant="both"
            items={inBoth}
            emptyText="No sources are shared between these notebooks."
          />
        </div>
      )}
    </div>
  );
}
