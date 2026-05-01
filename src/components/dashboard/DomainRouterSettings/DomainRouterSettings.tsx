/**
 * @module DomainRouterSettings
 * @description Settings panel for managing URL-pattern routing rules that auto-assign bulk-imported URLs to specific notebooks; supports domain, glob, and regex pattern types.
 * @dependencies ./useDomainRouterSettings
 * @public DomainRouterSettings
 */
import React, { useState } from 'react';
import { useDomainRouterSettings } from './useDomainRouterSettings';
import './DomainRouterSettings.css';

interface DomainRouterSettingsProps {
  compact?: boolean;
}

export default function DomainRouterSettings({ compact }: DomainRouterSettingsProps) {
  const {
    rules,
    notebooks,
    isLoading,
    editingRule,
    pattern,
    setPattern,
    patternType,
    setPatternType,
    selectedNotebookId,
    setSelectedNotebookId,
    error,
    startAdding,
    startEditing,
    cancelEdit,
    saveRule,
    deleteRule,
    toggleRule,
  } = useDomainRouterSettings();

  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  if (isLoading) {
    return <div className="router-settings__loading">Loading rules…</div>;
  }

  return (
    <div className={`router-settings${compact ? ' router-settings--compact' : ''}`}>
      {!compact && (
        <div className="router-settings__header">
          <div>
            <h3 className="router-settings__title">Domain Router</h3>
            <p className="router-settings__desc">
              Auto-route imported URLs to specific notebooks based on URL patterns.
              Rules only apply to bulk imports (CSV, RSS, Crawler, Tabs).
            </p>
          </div>
          <button
            className="router-settings__add-btn"
            onClick={() => {
              startAdding();
              setShowForm(true);
            }}
          >
            + Add Rule
          </button>
        </div>
      )}
      {compact && (
        <div className="router-settings__compact-header">
          <span className="router-settings__compact-title">
            Domain Router Rules ({rules.length})
          </span>
          <button
            className="router-settings__add-btn router-settings__add-btn--small"
            onClick={() => {
              startAdding();
              setShowForm(true);
            }}
          >
            + Add
          </button>
        </div>
      )}

      {(showForm || editingRule) && (
        <div className="router-settings__form">
          <div className="router-settings__form-row">
            <select
              className="router-settings__type-select"
              value={patternType}
              onChange={(e) => setPatternType(e.target.value as 'domain' | 'glob' | 'regex')}
            >
              <option value="domain">Domain</option>
              <option value="glob">Glob</option>
              <option value="regex">Regex</option>
            </select>
            <input
              className="router-settings__pattern-input"
              type="text"
              placeholder={
                patternType === 'domain'
                  ? 'example.com'
                  : patternType === 'glob'
                    ? 'https://example.com/blog/*'
                    : '^https://example\\.com/.*'
              }
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
            />
          </div>
          <div className="router-settings__form-row">
            <label className="router-settings__form-label">Route to:</label>
            <select
              className="router-settings__notebook-select"
              value={selectedNotebookId}
              onChange={(e) => setSelectedNotebookId(e.target.value)}
            >
              <option value="">Select notebook…</option>
              {notebooks.map((nb) => (
                <option key={nb.id} value={nb.id}>
                  {nb.title}
                </option>
              ))}
            </select>
          </div>
          {error && <div className="router-settings__form-error">{error}</div>}
          <div className="router-settings__form-actions">
            <button
              className="router-settings__save-btn"
              onClick={() => {
                void saveRule().then(() => setShowForm(false));
              }}
            >
              {editingRule ? 'Update' : 'Add Rule'}
            </button>
            <button
              className="router-settings__cancel-btn"
              onClick={() => {
                cancelEdit();
                setShowForm(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {rules.length === 0 && !showForm ? (
        <div className="router-settings__empty">
          No routing rules configured. URLs will be imported to the current notebook.
        </div>
      ) : (
        <div className="router-settings__rules">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`router-settings__rule${!rule.enabled ? ' router-settings__rule--disabled' : ''}`}
            >
              <div className="router-settings__rule-info">
                <span className="router-settings__rule-type">{rule.patternType}</span>
                <span className="router-settings__rule-pattern">{rule.pattern}</span>
                <span className="router-settings__rule-arrow">→</span>
                <span className="router-settings__rule-notebook">{rule.notebookTitle}</span>
              </div>
              <div className="router-settings__rule-actions">
                <button
                  className="router-settings__rule-toggle"
                  onClick={() => void toggleRule(rule.id)}
                  title={rule.enabled ? 'Disable' : 'Enable'}
                >
                  {rule.enabled ? 'On' : 'Off'}
                </button>
                <button
                  className="router-settings__rule-edit"
                  onClick={() => {
                    startEditing(rule);
                    setShowForm(true);
                  }}
                >
                  Edit
                </button>
                {confirmDelete === rule.id ? (
                  <>
                    <button
                      className="router-settings__rule-delete-confirm"
                      onClick={() => {
                        void deleteRule(rule.id);
                        setConfirmDelete(null);
                      }}
                    >
                      Delete
                    </button>
                    <button
                      className="router-settings__rule-cancel"
                      onClick={() => setConfirmDelete(null)}
                    >
                      No
                    </button>
                  </>
                ) : (
                  <button
                    className="router-settings__rule-delete"
                    onClick={() => setConfirmDelete(rule.id)}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
