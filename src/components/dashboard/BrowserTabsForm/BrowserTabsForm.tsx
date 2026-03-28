import React from 'react';
import { useBrowserTabsForm } from './useBrowserTabsForm';
import SearchBar from '@/components/dashboard/SearchBar/SearchBar';
import './BrowserTabsForm.css';

interface BrowserTabsFormProps {
  onImport: (urls: string[]) => void;
  disabled?: boolean;
}

export default function BrowserTabsForm({ onImport, disabled }: BrowserTabsFormProps) {
  const {
    filteredTabs,
    isLoading,
    error,
    selectedUrls,
    searchQuery,
    setSearchQuery,
    toggleTab,
    toggleAll,
    getSelectedUrls,
    refresh,
  } = useBrowserTabsForm();

  const selected = getSelectedUrls();
  const allSelected = filteredTabs.length > 0 && filteredTabs.every((t) => selectedUrls.has(t.url));

  if (isLoading) {
    return (
      <div className="tabs-form">
        <div className="tabs-form__loading">Loading open tabs…</div>
      </div>
    );
  }

  return (
    <div className="tabs-form">
      {error && <div className="tabs-form__error">{error}</div>}

      <div className="tabs-form__controls">
        <SearchBar
          className="tabs-form__search"
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search tabs…"
        />
        <button className="tabs-form__refresh-btn" onClick={() => void refresh()} title="Refresh tab list">
          Refresh
        </button>
      </div>

      {filteredTabs.length > 0 && (
        <label className="tabs-form__select-all">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
          />
          Select all ({filteredTabs.length} tabs)
        </label>
      )}

      <div className="tabs-form__list">
        {filteredTabs.length === 0 ? (
          <div className="tabs-form__empty">No open tabs found.</div>
        ) : (
          filteredTabs.map((tab) => (
            <label key={`${tab.id}-${tab.url}`} className="tabs-form__tab-row">
              <input
                type="checkbox"
                checked={selectedUrls.has(tab.url)}
                onChange={() => toggleTab(tab.url)}
              />
              {tab.favIconUrl && (
                <img
                  src={tab.favIconUrl}
                  alt=""
                  className="tabs-form__favicon"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
              <div className="tabs-form__tab-info">
                <span className="tabs-form__tab-title">{tab.title || 'Untitled'}</span>
                <span className="tabs-form__tab-url">{tab.url}</span>
              </div>
            </label>
          ))
        )}
      </div>

      {filteredTabs.length > 0 && (
        <div className="tabs-form__footer">
          <span className="tabs-form__count">
            {selected.length} tab{selected.length !== 1 ? 's' : ''} selected
          </span>
          <button
            className="tabs-form__import-btn"
            onClick={() => onImport(selected)}
            disabled={disabled || selected.length === 0}
          >
            Import {selected.length} Tab{selected.length !== 1 ? 's' : ''}
          </button>
        </div>
      )}
    </div>
  );
}
