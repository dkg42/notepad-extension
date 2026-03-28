import React from 'react';
import { Zap, Play, Pencil, Trash2, CheckCircle, XCircle, AlertCircle, Plus } from 'lucide-react';
import type { Pipeline, PipelineRun, PipelineRunStatus } from '@/types';
import { usePipelinesPage } from './usePipelinesPage';
import PipelineBuilder from './PipelineBuilder';
import './PipelinesPage.css';

const STATUS_ICONS: Record<PipelineRunStatus, React.ReactNode> = {
  success: <CheckCircle size={14} className="run-status run-status--success" />,
  partial: <AlertCircle size={14} className="run-status run-status--partial" />,
  error: <XCircle size={14} className="run-status run-status--error" />,
};

function triggerSummary(pipeline: Pipeline): string {
  const { trigger } = pipeline;
  switch (trigger.type) {
    case 'notebook-tag-added': return `Tag "${trigger.tag}" added`;
    case 'moved-to-collection': return 'Moved to collection';
    case 'title-contains': return `Title contains "${trigger.substring}"`;
    case 'source-added': return 'Source added';
    case 'audio-generated': return 'Audio generated';
    case 'min-sources': return `≥ ${trigger.threshold} sources`;
  }
}

function formatTs(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function PipelinesPage() {
  const {
    pipelines,
    runs,
    collections,
    templates,
    isLoading,
    error,
    runningId,
    selectedPipeline,
    isBuilderOpen,
    handleToggle,
    handleDelete,
    handleSave,
    handleRunNow,
    handleInstallTemplate,
    handleClearRuns,
    openBuilder,
    closeBuilder,
  } = usePipelinesPage();

  if (isLoading) {
    return (
      <div className="pipelines-page">
        <p className="pipelines-page__loading">Loading pipelines…</p>
      </div>
    );
  }

  return (
    <div className="pipelines-page">
      {/* Page header */}
      <div className="pipelines-page__header">
        <div>
          <h1 className="pipelines-page__title">Pipelines</h1>
          <p className="pipelines-page__subtitle">
            Automate notebook workflows — connect triggers to sequential actions.
          </p>
        </div>
        <button className="pipelines-page__new-btn" onClick={() => openBuilder()}>
          <Plus size={16} /> New Pipeline
        </button>
      </div>

      {error && <p className="pipelines-page__error">{error}</p>}

      {/* ── Active Pipelines ─────────────────────────────────────────────── */}
      <section className="pipelines-section">
        <h2 className="pipelines-section__title">
          <Zap size={16} /> Active Pipelines
          <span className="pipelines-section__count">{pipelines.length}</span>
        </h2>

        {pipelines.length === 0 ? (
          <p className="pipelines-page__empty">
            No pipelines yet. Create one or install a template below.
          </p>
        ) : (
          <table className="pipelines-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Trigger</th>
                <th>Actions</th>
                <th>Enabled</th>
                <th>Last run</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pipelines.map((p) => {
                const lastRun = runs.find((r) => r.pipelineId === p.id);
                return (
                  <tr key={p.id}>
                    <td className="pipelines-table__name">
                      <span>{p.name}</span>
                      {p.description && (
                        <span className="pipelines-table__desc">{p.description}</span>
                      )}
                    </td>
                    <td>
                      <span className="pipelines-table__trigger">{triggerSummary(p)}</span>
                    </td>
                    <td className="pipelines-table__actions-count">
                      {p.actions.length} action{p.actions.length !== 1 ? 's' : ''}
                    </td>
                    <td>
                      <label className="pipelines-toggle">
                        <input
                          type="checkbox"
                          checked={p.enabled}
                          onChange={() => void handleToggle(p.id)}
                        />
                        <span className="pipelines-toggle__slider" />
                      </label>
                    </td>
                    <td className="pipelines-table__last-run">
                      {lastRun ? (
                        <span className="pipelines-table__run-info">
                          {STATUS_ICONS[lastRun.status]}
                          {formatTs(lastRun.triggeredAt)}
                        </span>
                      ) : (
                        <span className="pipelines-table__never">Never</span>
                      )}
                    </td>
                    <td className="pipelines-table__row-actions">
                      <button
                        className="pipelines-table__action-btn"
                        title="Run now"
                        disabled={runningId === p.id}
                        onClick={() => void handleRunNow(p)}
                      >
                        <Play size={14} />
                      </button>
                      <button
                        className="pipelines-table__action-btn"
                        title="Edit"
                        onClick={() => openBuilder(p)}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="pipelines-table__action-btn pipelines-table__action-btn--danger"
                        title="Delete"
                        onClick={() => void handleDelete(p.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* ── Recent Runs ─────────────────────────────────────────────────── */}
      <section className="pipelines-section">
        <div className="pipelines-section__row">
          <h2 className="pipelines-section__title">Recent Runs</h2>
          {runs.length > 0 && (
            <button className="pipelines-section__clear-btn" onClick={() => void handleClearRuns()}>
              Clear
            </button>
          )}
        </div>

        {runs.length === 0 ? (
          <p className="pipelines-page__empty">No runs recorded yet.</p>
        ) : (
          <table className="pipelines-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Pipeline</th>
                <th>Notebook</th>
                <th>Time</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <RunRow key={run.id} run={run} />
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ── Template Gallery ─────────────────────────────────────────────── */}
      <section className="pipelines-section">
        <h2 className="pipelines-section__title">Template Gallery</h2>
        <p className="pipelines-section__subtitle">
          Pre-built rules to install in one click. You can customise them in the builder before activating.
        </p>
        <div className="pipelines-templates">
          {templates.map((t) => (
            <div key={t.id} className="pipeline-template-card">
              <div className="pipeline-template-card__icon">
                <Zap size={18} />
              </div>
              <div className="pipeline-template-card__body">
                <h3 className="pipeline-template-card__name">{t.name}</h3>
                <p className="pipeline-template-card__desc">{t.description}</p>
                <div className="pipeline-template-card__meta">
                  <span className="pipeline-template-card__trigger">{triggerSummary(t)}</span>
                  <span className="pipeline-template-card__actions-count">
                    {t.actions.length} action{t.actions.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              <button
                className="pipeline-template-card__install-btn"
                onClick={() => void handleInstallTemplate(t)}
              >
                Install
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Builder modal */}
      {isBuilderOpen && (
        <PipelineBuilder
          initial={selectedPipeline}
          collections={collections}
          onSave={(pipeline) => void handleSave(pipeline)}
          onClose={closeBuilder}
        />
      )}
    </div>
  );
}

function RunRow({ run }: { run: PipelineRun }) {
  const [expanded, setExpanded] = React.useState(false);
  return (
    <>
      <tr
        className="pipelines-table__run-row"
        onClick={() => setExpanded((v) => !v)}
        style={{ cursor: 'pointer' }}
      >
        <td>{STATUS_ICONS[run.status]}</td>
        <td>{run.pipelineName}</td>
        <td>{run.notebookTitle}</td>
        <td className="pipelines-table__last-run">{formatTs(run.triggeredAt)}</td>
        <td>{run.actionResults.length}</td>
      </tr>
      {expanded && (
        <tr className="pipelines-table__run-detail">
          <td colSpan={5}>
            <ul className="run-detail-list">
              {run.actionResults.map((r, i) => (
                <li key={i} className={`run-detail-list__item ${r.ok ? 'run-detail-list__item--ok' : 'run-detail-list__item--err'}`}>
                  {r.ok ? <CheckCircle size={12} /> : <XCircle size={12} />}
                  <span>{r.actionType}</span>
                  {r.error && <span className="run-detail-list__error"> — {r.error}</span>}
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}
