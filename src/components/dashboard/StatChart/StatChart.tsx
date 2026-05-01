/**
 * @module StatChart
 * @description Horizontal bar chart that visualises a ranked list of labelled numeric entries, capping display to a configurable number of visible rows.
 * @dependencies (none from src/ — stateless presentational component)
 * @public StatChart, StatChartEntry
 */
import React from 'react';
import './StatChart.css';

export interface StatChartEntry {
  label: string;
  value: number;
  color?: string;
}

interface StatChartProps {
  title: string;
  entries: StatChartEntry[];
  maxVisible?: number;
}

export default function StatChart({ title, entries, maxVisible = 8 }: StatChartProps) {
  const visible = entries.slice(0, maxVisible);
  const maxValue = Math.max(...entries.map((e) => e.value), 1);

  return (
    <div className="stat-chart">
      <h3 className="stat-chart__title">{title}</h3>
      {visible.length === 0 ? (
        <p className="stat-chart__empty">No data yet.</p>
      ) : (
        <div className="stat-chart__bars">
          {visible.map((entry) => {
            const pct = Math.round((entry.value / maxValue) * 100);
            return (
              <div key={entry.label} className="stat-chart__row">
                <span className="stat-chart__label" title={entry.label}>
                  {entry.label.length > 22 ? `${entry.label.slice(0, 22)}…` : entry.label}
                </span>
                <div className="stat-chart__bar-track">
                  <div
                    className="stat-chart__bar"
                    style={{
                      width: `${pct}%`,
                      background: entry.color ?? 'var(--color-primary)',
                    }}
                  />
                </div>
                <span className="stat-chart__value">{entry.value}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
