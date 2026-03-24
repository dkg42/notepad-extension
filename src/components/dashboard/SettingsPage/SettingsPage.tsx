import React, { useRef } from 'react';
import type { DashboardSettings, SortColumn, SortDirection } from '@/types/dashboard';
import { useTheme } from '@/components/dashboard/ThemeProvider/useTheme';
import { useSettingsPage } from './useSettingsPage';
import DomainRouterSettings from '@/components/dashboard/DomainRouterSettings/DomainRouterSettings';
import './SettingsPage.css';

interface SettingsPageProps {
  settings: DashboardSettings;
  onSettingsChange: (s: Partial<DashboardSettings>) => void;
}

const ROWS_OPTIONS = [10, 25, 50, 100];
const SORT_COLUMNS: Array<{ value: SortColumn; label: string }> = [
  { value: 'savedAt', label: 'Date Saved' },
  { value: 'text', label: 'Prompt Text' },
  { value: 'source', label: 'Source' },
  { value: 'folder', label: 'Folder' },
];

export default function SettingsPage({ settings, onSettingsChange }: SettingsPageProps) {
  const { theme, toggleTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    importError,
    importSuccess,
    showClearConfirm,
    setShowClearConfirm,
    handleExport,
    handleImport,
    handleClearAll,
  } = useSettingsPage(settings, onSettingsChange);

  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1 className="settings-page__heading">Settings</h1>
        <p className="settings-page__subheading">Customise the dashboard experience.</p>
      </div>

      <div className="settings-page__sections">
        {/* Appearance */}
        <section className="settings-section">
          <h2 className="settings-section__title">Appearance</h2>
          <div className="settings-row">
            <div className="settings-row__label">
              <span className="settings-row__name">Theme</span>
              <span className="settings-row__description">
                Switch between light and dark mode.
              </span>
            </div>
            <button
              className="settings-page__theme-btn"
              onClick={() => {
                toggleTheme();
                const next = theme === 'light' ? 'dark' : 'light';
                onSettingsChange({ theme: next });
              }}
            >
              {theme === 'light' ? '☀ Light' : '☽ Dark'}
            </button>
          </div>
        </section>

        {/* Table Defaults */}
        <section className="settings-section">
          <h2 className="settings-section__title">Table Defaults</h2>
          <div className="settings-row">
            <div className="settings-row__label">
              <span className="settings-row__name">Rows per page</span>
            </div>
            <select
              className="settings-page__select"
              value={settings.rowsPerPage}
              onChange={(e) => onSettingsChange({ rowsPerPage: Number(e.target.value) })}
            >
              {ROWS_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="settings-row">
            <div className="settings-row__label">
              <span className="settings-row__name">Default sort column</span>
            </div>
            <select
              className="settings-page__select"
              value={settings.defaultSortColumn}
              onChange={(e) =>
                onSettingsChange({ defaultSortColumn: e.target.value as SortColumn })
              }
            >
              {SORT_COLUMNS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="settings-row">
            <div className="settings-row__label">
              <span className="settings-row__name">Default sort direction</span>
            </div>
            <select
              className="settings-page__select"
              value={settings.defaultSortDirection}
              onChange={(e) =>
                onSettingsChange({ defaultSortDirection: e.target.value as SortDirection })
              }
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>
        </section>

        {/* Data */}
        <section className="settings-section">
          <h2 className="settings-section__title">Data</h2>

          <div className="settings-row">
            <div className="settings-row__label">
              <span className="settings-row__name">Export all data</span>
              <span className="settings-row__description">
                Download a JSON backup of all prompts, folders, tags and settings.
              </span>
            </div>
            <button className="settings-page__btn" onClick={handleExport}>
              Export JSON
            </button>
          </div>

          <div className="settings-row">
            <div className="settings-row__label">
              <span className="settings-row__name">Import data</span>
              <span className="settings-row__description">
                Restore from a previously exported JSON file.
              </span>
            </div>
            <button
              className="settings-page__btn"
              onClick={() => fileInputRef.current?.click()}
            >
              Import JSON
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImport(file);
                e.target.value = '';
              }}
            />
          </div>

          {importError && <p className="settings-page__error">{importError}</p>}
          {importSuccess && <p className="settings-page__success">{importSuccess}</p>}

          <div className="settings-row">
            <div className="settings-row__label">
              <span className="settings-row__name">Clear all prompts</span>
              <span className="settings-row__description">
                Permanently delete all saved prompts. Folders and settings are kept.
              </span>
            </div>
            {showClearConfirm ? (
              <div className="settings-page__confirm">
                <span className="settings-page__confirm-text">Are you sure?</span>
                <button
                  className="settings-page__btn settings-page__btn--danger"
                  onClick={handleClearAll}
                >
                  Yes, delete all
                </button>
                <button
                  className="settings-page__btn"
                  onClick={() => setShowClearConfirm(false)}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                className="settings-page__btn settings-page__btn--danger"
                onClick={() => setShowClearConfirm(true)}
              >
                Clear all
              </button>
            )}
          </div>
        </section>

        {/* Domain Router */}
        <section className="settings-section">
          <h2 className="settings-section__title">Source Import</h2>
          <DomainRouterSettings />
        </section>

        {/* About */}
        <section className="settings-section">
          <h2 className="settings-section__title">About</h2>
          <div className="settings-page__about">
            <p>
              <strong>LLM Chat Enhancer</strong> — v1.0.0
            </p>
            <p>Save prompts from ChatGPT, Claude, Gemini, Perplexity and more.</p>
            <p className="settings-page__shortcuts-hint">
              Press <kbd>?</kbd> anywhere in the dashboard for keyboard shortcuts.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
