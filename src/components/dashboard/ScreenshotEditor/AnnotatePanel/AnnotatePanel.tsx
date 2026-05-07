import React from 'react';
import type { Annotation, AnnotationTool, EditorSettings } from '../useScreenshotEditor';
import './AnnotatePanel.css';

const TOOLS: { id: AnnotationTool; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'text', label: 'Text' },
  { id: 'arrow', label: 'Arrow' },
  { id: 'line', label: 'Line' },
  { id: 'circle', label: 'Circle' },
  { id: 'highlight', label: 'Highlight' },
  { id: 'redact', label: 'Redact / Blur' },
];

interface Props {
  settings: EditorSettings;
  annotations: Annotation[];
  history: Annotation[][];
  future: Annotation[][];
  onSettingChange: <K extends keyof EditorSettings>(key: K, value: EditorSettings[K]) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClearAll: () => void;
}

export default function AnnotatePanel({
  settings,
  annotations,
  history,
  future,
  onSettingChange,
  onUndo,
  onRedo,
  onClearAll,
}: Props) {
  return (
    <div className="annotate-panel">
      {/* Tool selection */}
      <section className="annotate-panel__section">
        <h3 className="annotate-panel__section-title">TOOL</h3>
        <div className="annotate-panel__tools">
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              className={`annotate-panel__tool-btn${settings.activeTool === tool.id ? ' annotate-panel__tool-btn--active' : ''}`}
              onClick={() => onSettingChange('activeTool', tool.id)}
            >
              {tool.label}
            </button>
          ))}
        </div>
        {settings.activeTool !== 'none' && (
          <p className="annotate-panel__hint">
            Select a tool, then draw directly on the image.
          </p>
        )}
      </section>

      {/* Appearance */}
      <section className="annotate-panel__section">
        <h3 className="annotate-panel__section-title">APPEARANCE</h3>

        <div className="annotate-panel__color-row">
          <label className="annotate-panel__color-label-wrap">
            <span
              className="annotate-panel__color-preview"
              style={{ background: settings.annotationColor }}
            />
            <input
              type="color"
              value={settings.annotationColor}
              onChange={(e) => onSettingChange('annotationColor', e.target.value)}
              className="annotate-panel__color-input"
            />
          </label>
          <span className="annotate-panel__size-label">SIZE</span>
          <input
            type="range"
            className="annotate-panel__range"
            min={2}
            max={24}
            value={settings.annotationSize}
            onChange={(e) => onSettingChange('annotationSize', Number(e.target.value))}
          />
          <span className="annotate-panel__size-value">{settings.annotationSize}px</span>
        </div>
      </section>

      {/* Actions */}
      <section className="annotate-panel__section">
        <h3 className="annotate-panel__section-title">ACTIONS</h3>

        <div className="annotate-panel__action-row">
          <button
            className="annotate-panel__action-btn"
            onClick={onUndo}
            disabled={history.length === 0}
          >
            Undo
          </button>
          <button
            className="annotate-panel__action-btn"
            onClick={onRedo}
            disabled={future.length === 0}
          >
            Redo
          </button>
        </div>

        <div className="annotate-panel__action-row">
          <button
            className="annotate-panel__action-btn annotate-panel__action-btn--danger"
            onClick={onClearAll}
            disabled={annotations.length === 0}
          >
            Clear all
          </button>
        </div>

        <p className="annotate-panel__hint annotate-panel__hint--sm">
          Undo / Redo restores whole annotation layers, not each intermediate edit.
        </p>
      </section>
    </div>
  );
}
