/**
 * @module TagFilter
 * @description Dropdown filter control that renders a checkbox list of all available tags, allowing users to narrow displayed items to one or more selected tags.
 * @dependencies ./useTagFilter
 * @public TagFilter
 */
import React, { useEffect, useRef } from 'react';
import { useTagFilter } from './useTagFilter';
import './TagFilter.css';

interface Props {
  allTags: string[];
  selectedTags: Set<string>;
  onChange: (tags: Set<string>) => void;
}

export default function TagFilter({ allTags, selectedTags, onChange }: Props) {
  const { open, setOpen, containerRef, handleToggle } = useTagFilter(selectedTags, onChange);
  const panelRef = useRef<HTMLDivElement>(null);

  const hasOptions = allTags.length > 0;
  const label =
    selectedTags.size === 0
      ? 'All tags'
      : `${selectedTags.size} tag${selectedTags.size > 1 ? 's' : ''} selected`;

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || !open) return;

    const emptyEl = panel.querySelector<HTMLParagraphElement>('#tag-filter-empty');
    const clearBtn = panel.querySelector<HTMLButtonElement>('#tag-filter-clear');
    const list = panel.querySelector<HTMLUListElement>('#tag-filter-list');

    if (!emptyEl || !clearBtn || !list) return;

    emptyEl.style.display = hasOptions ? 'none' : 'block';
    clearBtn.style.display = selectedTags.size > 0 ? 'block' : 'none';

    list.innerHTML = allTags
      .map(
        (tag) => `
        <li class="tag-filter__option" role="option" data-tag="${tag}">
          <input type="checkbox" ${selectedTags.has(tag) ? 'checked' : ''} data-tag="${tag}" />
          <span>#${tag}</span>
        </li>`,
      )
      .join('');

    const onClear = () => onChange(new Set());
    clearBtn.addEventListener('click', onClear);

    const onCheck = (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target.matches('input[type="checkbox"][data-tag]')) {
        handleToggle(target.dataset.tag!);
      }
    };
    list.addEventListener('change', onCheck);

    return () => {
      clearBtn.removeEventListener('click', onClear);
      list.removeEventListener('change', onCheck);
    };
  }, [open, allTags, selectedTags, hasOptions, onChange, handleToggle]);

  return (
    <div ref={containerRef} className="tag-filter">
      <button
        onClick={() => setOpen((o) => !o)}
        className="tag-filter__trigger"
        disabled={!hasOptions}
        title={hasOptions ? 'Filter by tag' : 'No tags yet'}
      >
        <span>🏷️ {label}</span>
        <span className="tag-filter__trigger-arrow">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div
          ref={panelRef}
          className="tag-filter__dropdown"
          dangerouslySetInnerHTML={{
            __html: `
              <button class="tag-filter__clear-btn" id="tag-filter-clear" style="display:none">Clear filter</button>
              <ul class="tag-filter__list" id="tag-filter-list"></ul>
              <p class="tag-filter__empty" id="tag-filter-empty" style="display:none">No tags yet</p>
            `,
          }}
        />
      )}
    </div>
  );
}
