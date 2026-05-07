import React from 'react';
import type { EditorSettings } from '../useScreenshotEditor';
import './GeneralPanel.css';

const COLOR_PRESETS = [
  '#FFBF00', '#F97316', '#EF4444', '#EC4899', '#A855F7',
  '#06B6D4', '#3B82F6', '#10B981', '#84CC16', '#F59E0B',
  '#6366F1', '#8B5CF6', '#14B8A6', '#22C55E', '#000000',
  '#374151', '#6B7280', '#D1D5DB', '#F9FAFB', '#1E293B',
];

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}

function SliderRow({ label, value, min, max, onChange }: SliderRowProps) {
  return (
    <div className="general-panel__slider-row">
      <div className="general-panel__slider-label">
        <span>{label}</span>
        <span className="general-panel__slider-value">{value}px</span>
      </div>
      <input
        type="range"
        className="general-panel__range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

interface AngleDial {
  angle: number;
  onChange: (v: number) => void;
}

function AngleDial({ angle, onChange }: AngleDial) {
  const rad = ((angle - 90) * Math.PI) / 180;
  const cx = 18, cy = 18, r = 12;
  const nx = cx + r * Math.cos(rad);
  const ny = cy + r * Math.sin(rad);

  return (
    <div className="general-panel__angle-row">
      <svg
        className="general-panel__angle-dial"
        width="36" height="36" viewBox="0 0 36 36"
      >
        <circle cx={cx} cy={cy} r={r} className="general-panel__dial-track" />
        <line x1={cx} y1={cy} x2={nx} y2={ny} className="general-panel__dial-needle" />
        <circle cx={nx} cy={ny} r={2.5} className="general-panel__dial-dot" />
      </svg>
      <input
        type="range"
        className="general-panel__range general-panel__range--angle"
        min={0}
        max={360}
        value={angle}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="general-panel__slider-value">{angle}°</span>
    </div>
  );
}

interface ColorSwatchProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

function ColorSwatch({ label, value, onChange }: ColorSwatchProps) {
  return (
    <label className="general-panel__color-swatch">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="general-panel__color-input"
      />
      <span className="general-panel__color-preview" style={{ background: value }} />
      <span className="general-panel__color-label">{label}</span>
      <span className="general-panel__color-hex">{value.toUpperCase()}</span>
    </label>
  );
}

interface Props {
  settings: EditorSettings;
  filename: string;
  onSettingChange: <K extends keyof EditorSettings>(key: K, value: EditorSettings[K]) => void;
  onFilenameChange: (v: string) => void;
  onDownload: () => void;
  onCopy: () => void;
  copied: boolean;
}

export default function GeneralPanel({
  settings,
  filename,
  onSettingChange,
  onFilenameChange,
  onDownload,
  onCopy,
  copied,
}: Props) {
  return (
    <div className="general-panel">
      {/* BACKGROUND */}
      <section className="general-panel__section">
        <h3 className="general-panel__section-title">BACKGROUND</h3>

        <div className="general-panel__toggle-row">
          <button
            className={`general-panel__toggle${settings.backgroundType === 'gradient' ? ' general-panel__toggle--active' : ''}`}
            onClick={() => onSettingChange('backgroundType', 'gradient')}
          >
            Gradient
          </button>
          <button
            className={`general-panel__toggle${settings.backgroundType === 'solid' ? ' general-panel__toggle--active' : ''}`}
            onClick={() => onSettingChange('backgroundType', 'solid')}
          >
            Solid
          </button>
        </div>

        {settings.backgroundType === 'gradient' && (
          <>
            <div className="general-panel__toggle-row general-panel__toggle-row--sm">
              <button
                className={`general-panel__toggle${settings.gradientStyle === 'linear' ? ' general-panel__toggle--active' : ''}`}
                onClick={() => onSettingChange('gradientStyle', 'linear')}
              >
                Linear
              </button>
              <button
                className={`general-panel__toggle${settings.gradientStyle === 'radial' ? ' general-panel__toggle--active' : ''}`}
                onClick={() => onSettingChange('gradientStyle', 'radial')}
              >
                Radial
              </button>
            </div>

            {settings.gradientStyle === 'linear' && (
              <AngleDial
                angle={settings.gradientAngle}
                onChange={(v) => onSettingChange('gradientAngle', v)}
              />
            )}
          </>
        )}

        <div className="general-panel__colors">
          <ColorSwatch
            label="START"
            value={settings.colorStart}
            onChange={(v) => onSettingChange('colorStart', v)}
          />
          {settings.backgroundType === 'gradient' && (
            <ColorSwatch
              label="END"
              value={settings.colorEnd}
              onChange={(v) => onSettingChange('colorEnd', v)}
            />
          )}
        </div>

        <div className="general-panel__presets">
          {COLOR_PRESETS.map((color) => (
            <button
              key={color}
              className={`general-panel__preset-swatch${settings.colorStart === color ? ' general-panel__preset-swatch--active' : ''}`}
              style={{ background: color }}
              onClick={() => onSettingChange('colorStart', color)}
              title={color}
            />
          ))}
        </div>
      </section>

      {/* EFFECTS */}
      <section className="general-panel__section">
        <h3 className="general-panel__section-title">EFFECTS</h3>
        <SliderRow
          label="Padding"
          value={settings.padding}
          min={0}
          max={120}
          onChange={(v) => onSettingChange('padding', v)}
        />
        <SliderRow
          label="Frame Roundness"
          value={settings.frameRoundness}
          min={0}
          max={32}
          onChange={(v) => onSettingChange('frameRoundness', v)}
        />
        <SliderRow
          label="Shadow"
          value={settings.shadowAmount}
          min={0}
          max={60}
          onChange={(v) => onSettingChange('shadowAmount', v)}
        />
      </section>

      {/* EXPORT */}
      <section className="general-panel__section general-panel__section--export">
        <div className="general-panel__filename-wrap">
          <span className="general-panel__filename-icon">✎</span>
          <input
            type="text"
            className="general-panel__filename"
            placeholder="screenshot"
            value={filename}
            onChange={(e) => onFilenameChange(e.target.value)}
          />
        </div>
        <div className="general-panel__export-btns">
          <button className="general-panel__btn general-panel__btn--download" onClick={onDownload}>
            ↓ Download
          </button>
          <button className="general-panel__btn general-panel__btn--copy" onClick={onCopy}>
            {copied ? '✓ Copied!' : '⎘ Copy'}
          </button>
        </div>
      </section>
    </div>
  );
}
