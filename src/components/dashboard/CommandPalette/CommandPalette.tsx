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
  selectableItems: PaletteItem[];
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
  selectableItems,
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
    const activeId = selectableItems[activeIndex]?.id;
    if (!activeId || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-id="${activeId}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, selectableItems]);

  if (!isOpen) return null;

  const hasContent = items.some((i) => i.type !== 'section');

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

        {!hasContent ? (
          <div className="command-palette__empty">No results</div>
        ) : (
          <ul ref={listRef} className="command-palette__list">
            {items.map((item, i) => {
              if (item.type === 'section') {
                return (
                  <li key={item.id} className="command-palette__section">
                    {item.label}
                  </li>
                );
              }

              const selectableIndex = selectableItems.findIndex((s) => s.id === item.id);
              const isActive = selectableIndex === activeIndex;

              return (
                <li
                  key={item.id}
                  data-id={item.id}
                  className={`command-palette__item${isActive ? ' command-palette__item--active' : ''}`}
                  onMouseEnter={() => onSetActiveIndex(selectableIndex)}
                  onClick={() => onSelectItem(item)}
                >
                  <span className="command-palette__item-label">{item.label}</span>
                  {item.sublabel && (
                    <span className="command-palette__item-sublabel">{item.sublabel}</span>
                  )}
                </li>
              );
            })}
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
