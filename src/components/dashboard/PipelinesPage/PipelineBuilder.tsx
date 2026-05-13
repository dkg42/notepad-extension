/**
 * @module PipelineBuilder
 * @description Renders a multi-step wizard for creating or editing automation pipelines, covering trigger configuration, action sequencing, and scope selection.
 * @dependencies @/types (Pipeline, PipelineAction, PipelineScope, PipelineTrigger, TriggerType, ActionType, NotebookCollection)
 * @public PipelineBuilder
 */
import React, { useState, useCallback } from 'react';
import { X, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import type {
  Folder,
  Pipeline,
  PipelineAction,
  PipelineScope,
  PipelineTrigger,
  TriggerType,
  ActionType,
} from '@/types';

interface PipelineBuilderProps {
  initial?: Pipeline | null;
  folders: Folder[];
  onSave: (pipeline: Pipeline) => void;
  onClose: () => void;
}

const TRIGGER_LABELS: Record<TriggerType, string> = {
  'notebook-tag-added': 'Notebook tag added',
  'moved-to-folder': 'Moved to folder',
  'title-contains': 'Title contains text',
  'source-added': 'Source is added',
  'audio-generated': 'Audio is generated',
  'min-sources': 'Min sources condition',
};

const ACTION_LABELS: Record<ActionType, string> = {
  'move-to-folder': 'Move to folder',
  'add-tag': 'Add tag',
  'remove-tag': 'Remove tag',
  'generate-audio': 'Generate audio',
  'add-source-url': 'Add source URL',
  'delete-all-sources': 'Delete all sources',
  'archive-notebook': 'Archive notebook',
};

const AUDIO_FORMAT_LABELS: Record<number, string> = {
  1: 'Deep Dive',
  2: 'Brief',
  3: 'Critique',
  4: 'Debate',
};

function makeTrigger(type: TriggerType): PipelineTrigger {
  switch (type) {
    case 'notebook-tag-added': return { type, tag: '' };
    case 'moved-to-folder': return { type, folderId: '' };
    case 'title-contains': return { type, substring: '' };
    case 'source-added': return { type };
    case 'audio-generated': return { type };
    case 'min-sources': return { type, threshold: 5 };
  }
}

function makeAction(type: ActionType): PipelineAction {
  switch (type) {
    case 'move-to-folder': return { type, folderId: '' };
    case 'add-tag': return { type, tag: '' };
    case 'remove-tag': return { type, tag: '' };
    case 'generate-audio': return { type, format: 1 };
    case 'add-source-url': return { type, url: '' };
    case 'delete-all-sources': return { type };
    case 'archive-notebook': return { type };
  }
}

export default function PipelineBuilder({ initial, folders, onSave, onClose }: PipelineBuilderProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [trigger, setTrigger] = useState<PipelineTrigger>(
    initial?.trigger ?? { type: 'notebook-tag-added', tag: '' },
  );
  const [actions, setActions] = useState<PipelineAction[]>(
    initial?.actions ?? [{ type: 'add-tag', tag: '' }],
  );
  const [scope, setScope] = useState<PipelineScope>(initial?.scope ?? { kind: 'all' });

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  const handleTriggerTypeChange = useCallback((type: TriggerType) => {
    setTrigger(makeTrigger(type));
  }, []);

  const addAction = useCallback(() => {
    setActions((prev) => [...prev, { type: 'add-tag', tag: '' }]);
  }, []);

  const removeAction = useCallback((idx: number) => {
    setActions((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const updateAction = useCallback((idx: number, updated: PipelineAction) => {
    setActions((prev) => prev.map((a, i) => (i === idx ? updated : a)));
  }, []);

  const handleActionTypeChange = useCallback((idx: number, type: ActionType) => {
    setActions((prev) => prev.map((a, i) => (i === idx ? makeAction(type) : a)));
  }, []);

  const handleSave = useCallback(() => {
    const now = Date.now();
    const pipeline: Pipeline = {
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim() || 'Unnamed Pipeline',
      description: description.trim() || undefined,
      enabled,
      trigger,
      actions,
      scope,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
      lastFiredAt: initial?.lastFiredAt,
    };
    onSave(pipeline);
  }, [initial, name, description, enabled, trigger, actions, scope, onSave]);

  const steps = ['Trigger', 'Scope', 'Actions', 'Name & Save'];

  return (
    <div className="pipeline-builder__overlay" onClick={handleOverlayClick}>
      <div className="pipeline-builder">
        {/* Header */}
        <div className="pipeline-builder__header">
          <h2 className="pipeline-builder__title">
            {initial ? 'Edit Pipeline' : 'New Pipeline'}
          </h2>
          <button className="pipeline-builder__close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Step indicators */}
        <div className="pipeline-builder__steps">
          {steps.map((s, i) => (
            <button
              key={s}
              className={`pipeline-builder__step ${i === step ? 'pipeline-builder__step--active' : ''} ${i < step ? 'pipeline-builder__step--done' : ''}`}
              onClick={() => setStep(i)}
            >
              <span className="pipeline-builder__step-num">{i + 1}</span>
              <span className="pipeline-builder__step-label">{s}</span>
            </button>
          ))}
        </div>

        {/* Step content */}
        <div className="pipeline-builder__body">
          {step === 0 && (
            <TriggerStep trigger={trigger} folders={folders} onTypeChange={handleTriggerTypeChange} onChange={setTrigger} />
          )}
          {step === 1 && (
            <ScopeStep scope={scope} folders={folders} onChange={setScope} />
          )}
          {step === 2 && (
            <ActionsStep
              actions={actions}
              folders={folders}
              onAdd={addAction}
              onRemove={removeAction}
              onUpdate={updateAction}
              onTypeChange={handleActionTypeChange}
            />
          )}
          {step === 3 && (
            <NameStep
              name={name}
              description={description}
              enabled={enabled}
              onNameChange={setName}
              onDescriptionChange={setDescription}
              onEnabledChange={setEnabled}
            />
          )}
        </div>

        {/* Footer */}
        <div className="pipeline-builder__footer">
          <button
            className="pipeline-builder__nav-btn"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            <ChevronLeft size={16} /> Back
          </button>
          {step < steps.length - 1 ? (
            <button
              className="pipeline-builder__nav-btn pipeline-builder__nav-btn--primary"
              onClick={() => setStep((s) => s + 1)}
            >
              Next <ChevronRight size={16} />
            </button>
          ) : (
            <button
              className="pipeline-builder__nav-btn pipeline-builder__nav-btn--primary"
              onClick={handleSave}
              disabled={actions.length === 0}
            >
              Save Pipeline
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Step sub-components ────────────────────────────────────────────────────────

function TriggerStep({
  trigger,
  folders,
  onTypeChange,
  onChange,
}: {
  trigger: PipelineTrigger;
  folders: Folder[];
  onTypeChange: (t: TriggerType) => void;
  onChange: (t: PipelineTrigger) => void;
}) {
  return (
    <div className="pipeline-builder__step-content">
      <label className="pipeline-builder__label">Trigger type</label>
      <select
        className="pipeline-builder__select"
        value={trigger.type}
        onChange={(e) => onTypeChange(e.target.value as TriggerType)}
      >
        {(Object.keys(TRIGGER_LABELS) as TriggerType[]).map((t) => (
          <option key={t} value={t}>{TRIGGER_LABELS[t]}</option>
        ))}
      </select>

      {trigger.type === 'notebook-tag-added' && (
        <div className="pipeline-builder__field">
          <label className="pipeline-builder__label">Tag name</label>
          <input
            className="pipeline-builder__input"
            placeholder="e.g. ready"
            value={trigger.tag}
            onChange={(e) => onChange({ ...trigger, tag: e.target.value })}
          />
        </div>
      )}

      {trigger.type === 'moved-to-folder' && (
        <div className="pipeline-builder__field">
          <label className="pipeline-builder__label">Target folder</label>
          <select
            className="pipeline-builder__select"
            value={trigger.folderId}
            onChange={(e) => onChange({ ...trigger, folderId: e.target.value })}
          >
            <option value="">— Select folder —</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
      )}

      {trigger.type === 'title-contains' && (
        <div className="pipeline-builder__field">
          <label className="pipeline-builder__label">Substring (case-insensitive)</label>
          <input
            className="pipeline-builder__input"
            placeholder="e.g. research"
            value={trigger.substring}
            onChange={(e) => onChange({ ...trigger, substring: e.target.value })}
          />
        </div>
      )}

      {trigger.type === 'min-sources' && (
        <div className="pipeline-builder__field">
          <label className="pipeline-builder__label">Minimum source count</label>
          <input
            className="pipeline-builder__input pipeline-builder__input--number"
            type="number"
            min={1}
            value={trigger.threshold}
            onChange={(e) => onChange({ ...trigger, threshold: Number(e.target.value) })}
          />
          <p className="pipeline-builder__hint">Fires once per notebook when this threshold is reached.</p>
        </div>
      )}

      {(trigger.type === 'source-added' || trigger.type === 'audio-generated') && (
        <p className="pipeline-builder__hint">
          This trigger is evaluated every 15 minutes by polling the NotebookLM API.
        </p>
      )}
    </div>
  );
}

function ScopeStep({
  scope,
  folders,
  onChange,
}: {
  scope: PipelineScope;
  folders: Folder[];
  onChange: (s: PipelineScope) => void;
}) {
  return (
    <div className="pipeline-builder__step-content">
      <label className="pipeline-builder__label">Apply to</label>
      <div className="pipeline-builder__radio-group">
        {(['all', 'folder', 'notebook'] as const).map((kind) => (
          <label key={kind} className="pipeline-builder__radio">
            <input
              type="radio"
              name="scope-kind"
              value={kind}
              checked={scope.kind === kind}
              onChange={() => {
                if (kind === 'all') onChange({ kind: 'all' });
                else if (kind === 'folder') onChange({ kind: 'folder', folderId: '' });
                else onChange({ kind: 'notebook', notebookId: '' });
              }}
            />
            {kind === 'all' ? 'All notebooks' : kind === 'folder' ? 'Specific folder' : 'Specific notebook ID'}
          </label>
        ))}
      </div>

      {scope.kind === 'folder' && (
        <div className="pipeline-builder__field">
          <label className="pipeline-builder__label">Folder</label>
          <select
            className="pipeline-builder__select"
            value={scope.folderId}
            onChange={(e) => onChange({ kind: 'folder', folderId: e.target.value })}
          >
            <option value="">— Select folder —</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
      )}

      {scope.kind === 'notebook' && (
        <div className="pipeline-builder__field">
          <label className="pipeline-builder__label">Notebook ID</label>
          <input
            className="pipeline-builder__input"
            placeholder="Paste notebook ID from URL"
            value={scope.notebookId}
            onChange={(e) => onChange({ kind: 'notebook', notebookId: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}

function ActionsStep({
  actions,
  folders,
  onAdd,
  onRemove,
  onUpdate,
  onTypeChange,
}: {
  actions: PipelineAction[];
  folders: Folder[];
  onAdd: () => void;
  onRemove: (idx: number) => void;
  onUpdate: (idx: number, action: PipelineAction) => void;
  onTypeChange: (idx: number, type: ActionType) => void;
}) {
  return (
    <div className="pipeline-builder__step-content">
      <p className="pipeline-builder__hint" style={{ marginBottom: 12 }}>
        Actions run in order. A failed action does not stop the chain.
      </p>
      {actions.map((action, idx) => (
        <div key={idx} className="pipeline-builder__action-row">
          <span className="pipeline-builder__action-num">{idx + 1}</span>
          <select
            className="pipeline-builder__select pipeline-builder__select--inline"
            value={action.type}
            onChange={(e) => onTypeChange(idx, e.target.value as ActionType)}
          >
            {(Object.keys(ACTION_LABELS) as ActionType[]).map((t) => (
              <option key={t} value={t}>{ACTION_LABELS[t]}</option>
            ))}
          </select>

          {/* Action-specific params */}
          {action.type === 'add-tag' && (
            <input
              className="pipeline-builder__input pipeline-builder__input--inline"
              placeholder="Tag name"
              value={action.tag}
              onChange={(e) => onUpdate(idx, { ...action, tag: e.target.value })}
            />
          )}
          {action.type === 'remove-tag' && (
            <input
              className="pipeline-builder__input pipeline-builder__input--inline"
              placeholder="Tag to remove"
              value={action.tag}
              onChange={(e) => onUpdate(idx, { ...action, tag: e.target.value })}
            />
          )}
          {action.type === 'move-to-folder' && (
            <select
              className="pipeline-builder__select pipeline-builder__select--inline"
              value={action.folderId}
              onChange={(e) => onUpdate(idx, { ...action, folderId: e.target.value })}
            >
              <option value="">— Select —</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          )}
          {action.type === 'add-source-url' && (
            <input
              className="pipeline-builder__input pipeline-builder__input--inline"
              placeholder="https://..."
              type="url"
              value={action.url}
              onChange={(e) => onUpdate(idx, { ...action, url: e.target.value })}
            />
          )}
          {action.type === 'generate-audio' && (
            <select
              className="pipeline-builder__select pipeline-builder__select--inline"
              value={action.format ?? 1}
              onChange={(e) => onUpdate(idx, { ...action, format: Number(e.target.value) })}
            >
              {Object.entries(AUDIO_FORMAT_LABELS).map(([k, label]) => (
                <option key={k} value={Number(k)}>{label}</option>
              ))}
            </select>
          )}

          <button
            className="pipeline-builder__action-delete"
            onClick={() => onRemove(idx)}
            aria-label="Remove action"
            disabled={actions.length === 1}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      <button className="pipeline-builder__add-action-btn" onClick={onAdd}>
        <Plus size={14} /> Add action
      </button>
    </div>
  );
}

function NameStep({
  name,
  description,
  enabled,
  onNameChange,
  onDescriptionChange,
  onEnabledChange,
}: {
  name: string;
  description: string;
  enabled: boolean;
  onNameChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onEnabledChange: (v: boolean) => void;
}) {
  return (
    <div className="pipeline-builder__step-content">
      <div className="pipeline-builder__field">
        <label className="pipeline-builder__label">Pipeline name</label>
        <input
          className="pipeline-builder__input"
          placeholder="e.g. Auto-tag research notebooks"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
        />
      </div>
      <div className="pipeline-builder__field">
        <label className="pipeline-builder__label">Description (optional)</label>
        <textarea
          className="pipeline-builder__textarea"
          rows={3}
          placeholder="What does this pipeline do?"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
        />
      </div>
      <label className="pipeline-builder__toggle-row">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
        />
        Enable pipeline immediately after saving
      </label>
    </div>
  );
}
