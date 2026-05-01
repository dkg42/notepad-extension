/**
 * @module ColorPicker
 * @description Renders a grid of preset color swatches plus a "no color" option, calling onChange with the selected hex string or undefined when cleared.
 * @dependencies none
 * @public ColorPicker
 */
import React from 'react';
import './ColorPicker.css';

const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#ec4899', // pink
  '#64748b', // slate
  '#78716c', // stone
];

interface ColorPickerProps {
  value?: string;
  onChange: (color: string | undefined) => void;
}

export default function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="color-picker">
      <button
        className={`color-picker__swatch color-picker__swatch--none${!value ? ' color-picker__swatch--active' : ''}`}
        onClick={() => onChange(undefined)}
        title="No color"
      >
        ✕
      </button>
      {PRESET_COLORS.map((color) => (
        <button
          key={color}
          className={`color-picker__swatch${value === color ? ' color-picker__swatch--active' : ''}`}
          style={{ background: color }}
          onClick={() => onChange(color)}
          title={color}
        />
      ))}
    </div>
  );
}
