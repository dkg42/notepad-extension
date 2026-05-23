/**
 * @module ImportSourcesModal
 * @description Renders a tabbed modal dialog for importing sources into a notebook via URL, web crawler, CSV upload, RSS feed, or browser tabs.
 * @dependencies useImportSources, BulkImportProgress, CsvUploadForm, RssFeedForm, WebCrawlerForm, BrowserTabsForm
 * @public ImportSourcesModal
 */
import React from 'react';
import { useImportSources } from './useImportSources';
import type { ImportTab } from './useImportSources';
import BulkImportProgress from '@/components/dashboard/BulkImportProgress/BulkImportProgress';
import CsvUploadForm from '@/components/dashboard/CsvUploadForm/CsvUploadForm';
import RssFeedForm from '@/components/dashboard/RssFeedForm/RssFeedForm';
import WebCrawlerForm from '@/components/dashboard/WebCrawlerForm/WebCrawlerForm';
import BrowserTabsForm from '@/components/dashboard/BrowserTabsForm/BrowserTabsForm';
import SubscriptionGuard from '@/components/ui/SubscriptionGuard/SubscriptionGuard';
import './ImportSourcesModal.css';

interface ImportSourcesModalProps {
  notebookId: string;
  onClose: () => void;
  onSourcesChanged: () => void;
}

const TABS: Array<{ key: ImportTab; label: string }> = [
  { key: 'url', label: 'URL' },
  { key: 'crawler', label: 'Web Crawler' },
  { key: 'csv', label: 'CSV Upload' },
  { key: 'rss', label: 'RSS Feed' },
  { key: 'tabs', label: 'Browser Tabs' },
];

export default function ImportSourcesModal({
  notebookId,
  onClose,
  onSourcesChanged,
}: ImportSourcesModalProps) {
  const {
    activeTab,
    setActiveTab,
    progress,
    isImporting,
    singleUrl,
    setSingleUrl,
    singleUrlError,
    isAddingSingle,
    startBulkImport,
    cancelImport,
    addSingleUrl,
    reset,
  } = useImportSources(notebookId);

  const handleSingleUrlAdd = async () => {
    if (!singleUrl.trim()) return;
    const ok = await addSingleUrl(singleUrl.trim());
    if (ok) {
      setSingleUrl('');
      onSourcesChanged();
    }
  };

  const handleBulkImport = (urls: string[]) => {
    void startBulkImport(urls);
  };

  const handleImportDone = () => {
    reset();
    onSourcesChanged();
  };

  // If an import is in progress, show the progress view
  if (isImporting || progress) {
    return (
      <div className="import-modal__overlay" onClick={(e) => {
        if (e.target === e.currentTarget && !isImporting) onClose();
      }}>
        <div className="import-modal">
          <div className="import-modal__header">
            <span className="import-modal__title">Importing Sources</span>
            {!isImporting && (
              <button className="import-modal__close-btn" onClick={onClose}>
                ✕
              </button>
            )}
          </div>
          <div className="import-modal__body">
            {progress && (
              <BulkImportProgress
                progress={progress}
                status={progress.status}
                onCancel={() => void cancelImport()}
                onDone={handleImportDone}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="import-modal__overlay" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="import-modal">
        <div className="import-modal__header">
          <span className="import-modal__title">Import Sources</span>
          <button className="import-modal__close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="import-modal__tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`import-modal__tab${activeTab === tab.key ? ' import-modal__tab--active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="import-modal__body">
          {activeTab === 'url' && (
            <div className="import-modal__single-url">
              <input
                type="url"
                className="import-modal__url-input"
                placeholder="Enter URL to add as source…"
                value={singleUrl}
                onChange={(e) => setSingleUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && singleUrl.trim()) void handleSingleUrlAdd();
                }}
                disabled={isAddingSingle}
                autoFocus
              />
              <button
                className="import-modal__url-add-btn"
                onClick={() => void handleSingleUrlAdd()}
                disabled={isAddingSingle || !singleUrl.trim()}
              >
                {isAddingSingle ? 'Adding…' : 'Add Source'}
              </button>
              {singleUrlError && (
                <div className="import-modal__url-error">{singleUrlError}</div>
              )}
            </div>
          )}

          {activeTab === 'crawler' && (
            <SubscriptionGuard requiredPlan="any" showBlurred>
              <WebCrawlerForm onImport={handleBulkImport} disabled={isImporting} />
            </SubscriptionGuard>
          )}

          {activeTab === 'csv' && (
            <SubscriptionGuard requiredPlan="any" showBlurred>
              <CsvUploadForm onImport={handleBulkImport} disabled={isImporting} />
            </SubscriptionGuard>
          )}

          {activeTab === 'rss' && (
            <SubscriptionGuard requiredPlan="any" showBlurred>
              <RssFeedForm onImport={handleBulkImport} disabled={isImporting} />
            </SubscriptionGuard>
          )}

          {activeTab === 'tabs' && (
            <SubscriptionGuard requiredPlan="any" showBlurred>
              <BrowserTabsForm onImport={handleBulkImport} disabled={isImporting} />
            </SubscriptionGuard>
          )}
        </div>
      </div>
    </div>
  );
}
