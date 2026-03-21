import React, { useEffect } from 'react';
import './KeyboardShortcutsPanel.css';

export interface ShortcutEntry {
  keys: string[];
  description: string;
}

const SHORTCUTS: ShortcutEntry[] = [
  { keys: ['Ctrl/⌘', 'K'], description: 'Open command palette' },
  { keys: ['?'], description: 'Show keyboard shortcuts' },
  { keys: ['Escape'], description: 'Close modal / deselect' },
  { keys: ['↑', '↓'], description: 'Navigate list (in command palette)' },
  { keys: ['Enter'], description: 'Select item (in command palette)' },
  { keys: ['J'], description: 'Navigate to next row in table' },
  { keys: ['K'], description: 'Navigate to previous row in table' },
  { keys: ['X'], description: 'Toggle row selection' },
  { keys: ['Delete'], description: 'Delete selected rows' },
];

interface KeyboardShortcutsPanelProps {
  onClose: () => void;
}

export default function KeyboardShortcutsPanel({ onClose }: KeyboardShortcutsPanelProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="shortcuts-panel-overlay" onClick={onClose}>
      <div className="shortcuts-panel" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-panel__header">
          <h2 className="shortcuts-panel__title">Keyboard Shortcuts</h2>
          <button className="shortcuts-panel__close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="shortcuts-panel__body">
          {SHORTCUTS.map((s) => (
            <div key={s.description} className="shortcuts-panel__row">
              <div className="shortcuts-panel__keys">
                {s.keys.map((k, i) => (
                  <React.Fragment key={k}>
                    {i > 0 && <span className="shortcuts-panel__plus">+</span>}
                    <kbd className="shortcuts-panel__kbd">{k}</kbd>
                  </React.Fragment>
                ))}
              </div>
              <span className="shortcuts-panel__desc">{s.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
