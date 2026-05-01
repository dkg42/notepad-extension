/**
 * @module CommandPalette
 * @description Renders a keyboard-driven command palette overlay with fuzzy search input and an arrow-key-navigable results list; auto-focuses on open and scrolls the active item into view.
 * @dependencies useCommandPalette (PaletteItem type)
 * @public CommandPalette
 */
import React, { useEffect, useRef } from 'react';
import type { PaletteItem } from './useCommandPalette';
import './CommandPalette.css';

interface CommandPaletteProps {
  isOpen: boolean;
  query: string;
  items: PaletteItem[];
  activeIndex: number;
  onQueryChange: (q: string) => void;
  onSelectItem: (item: PaletteItem) => void;
  onSetActiveIndex: (i: number) => void;
  onClose: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

export default function CommandPalette({
  isOpen,
  query,
  items,
  activeIndex,
  onQueryChange,
  onSelectItem,
  onSetActiveIndex,
  onClose,
  onKeyDown,
}: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  useEffect(() => {
    const activeEl = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!isOpen) return null;

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div
        className="command-palette"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="command-palette__search">
          <span className="command-palette__search-icon">⌘</span>
          <input
            ref={inputRef}
            className="command-palette__input"
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search prompts, folders, tags or navigate…"
          />
          <kbd className="command-palette__esc">Esc</kbd>
        </div>

        {items.length === 0 ? (
          <div className="command-palette__empty">No results</div>
        ) : (
          <ul ref={listRef} className="command-palette__list">
            {items.map((item, i) => (
              <li
                key={item.id}
                className={`command-palette__item${i === activeIndex ? ' command-palette__item--active' : ''}`}
                onMouseEnter={() => onSetActiveIndex(i)}
                onClick={() => onSelectItem(item)}
              >
                <span className="command-palette__item-label">{item.label}</span>
                {item.sublabel && (
                  <span className="command-palette__item-sublabel">{item.sublabel}</span>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="command-palette__footer">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>Esc close</span>
          <span className="command-palette__footer-hint">Cmd/Ctrl+K to open</span>
        </div>
      </div>
    </div>
  );
}
