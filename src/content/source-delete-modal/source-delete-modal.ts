/**
 * @module source-delete-modal
 * @description Renders a full-page shadow-DOM modal that lets users select and bulk-delete NotebookLM sources with search and type-filter controls. Deletion is performed sequentially via the adapter's triggerSourceDelete, with live progress feedback; the modal closes automatically when all sources have been deleted.
 * @dependencies @/adapters/source-panel-adapter.interface
 * @public showSourceDeleteModal
 */
import type { SourcePanelAdapter, SourceType } from '@/adapters/source-panel-adapter.interface';
import modalHtml from './source-delete-modal.html?raw';
import modalCss from './source-delete-modal.css?raw';

const MODAL_HOST_ID = 'nlm-source-delete-modal-host';

const TYPE_LABELS: Record<string, string> = {
  pdf:     'PDF',
  youtube: 'YouTube',
  gdoc:    'Google Doc',
  gslide:  'Slides',
  website: 'Website',
  audio:   'Audio',
  text:    'Text',
  unknown: 'Unknown',
};

interface SourceEntry {
  /** Reference to the live NotebookLM DOM element — used for triggerSourceDelete. */
  element: Element;
  title: string;
  type: SourceType;
}

export function showSourceDeleteModal(adapter: SourcePanelAdapter): void {
  if (document.getElementById(MODAL_HOST_ID)) return;

  const sources: SourceEntry[] = adapter.findSourceItems().map((el) => ({
    element: el,
    title: adapter.getSourceTitle(el),
    type: adapter.getSourceType(el),
  }));

  const host = document.createElement('div');
  host.id = MODAL_HOST_ID;
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = modalCss;
  shadow.appendChild(style);

  const wrapper = document.createElement('div');
  wrapper.innerHTML = modalHtml;
  shadow.appendChild(wrapper.firstElementChild!);

  document.body.appendChild(host);

  wireModal(shadow, sources, adapter, () => host.remove());
}

function wireModal(
  shadow: ShadowRoot,
  sources: SourceEntry[],
  adapter: SourcePanelAdapter,
  close: () => void,
): void {
  const searchInput   = shadow.querySelector<HTMLInputElement>('#modal-search-input')!;
  const searchClear   = shadow.querySelector<HTMLButtonElement>('#modal-search-clear')!;
  const filterChips   = shadow.querySelectorAll<HTMLButtonElement>('.filter-chip');
  const selectAll     = shadow.querySelector<HTMLInputElement>('#modal-select-all')!;
  const visibleCount  = shadow.querySelector<HTMLSpanElement>('#visible-count')!;
  const selectedCount = shadow.querySelector<HTMLSpanElement>('#selected-count')!;
  const sourceList    = shadow.querySelector<HTMLDivElement>('#modal-source-list')!;
  const deleteBtn     = shadow.querySelector<HTMLButtonElement>('#modal-delete-btn')!;
  const cancelBtn     = shadow.querySelector<HTMLButtonElement>('#modal-cancel-btn')!;
  const closeBtn      = shadow.querySelector<HTMLButtonElement>('#modal-close-btn')!;
  const backdrop      = shadow.querySelector<HTMLDivElement>('#source-delete-modal')!;

  let activeFilter: SourceType = 'all';

  // ── Build source rows ──────────────────────────────────────────────────────
  const checkboxes: HTMLInputElement[] = sources.map((source) => {
    const item = document.createElement('div');
    item.className = 'source-item';
    item.setAttribute('role', 'listitem');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.setAttribute('aria-label', source.title);

    const badge = document.createElement('span');
    badge.className = `source-badge type-${source.type}`;
    badge.textContent = TYPE_LABELS[source.type] ?? 'Unknown';

    const title = document.createElement('span');
    title.className = 'source-item-title';
    title.textContent = source.title;
    title.title = source.title;

    item.appendChild(checkbox);
    item.appendChild(badge);
    item.appendChild(title);

    // Clicking anywhere in the row toggles the checkbox.
    item.addEventListener('click', (e) => {
      if (e.target !== checkbox) checkbox.checked = !checkbox.checked;
      syncState();
    });

    sourceList.appendChild(item);
    return checkbox;
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getItemEl = (index: number): HTMLElement =>
    sourceList.querySelectorAll<HTMLElement>('.source-item')[index];

  const isVisible = (index: number): boolean => {
    const el = getItemEl(index);
    return !!el && !el.classList.contains('hidden') && !el.classList.contains('deleted');
  };

  const applyFilters = (): void => {
    const query = searchInput.value.toLowerCase().trim();
    sources.forEach((source, i) => {
      const el = getItemEl(i);
      if (!el || el.classList.contains('deleted')) return;
      const matchesSearch = query === '' || source.title.toLowerCase().includes(query);
      const matchesFilter = activeFilter === 'all' || source.type === activeFilter;
      el.classList.toggle('hidden', !matchesSearch || !matchesFilter);
    });
    syncState();
  };

  const syncState = (): void => {
    const visibleIndices = sources.map((_, i) => i).filter(isVisible);
    const visibleCheckedCount = visibleIndices.filter((i) => checkboxes[i].checked).length;
    const totalChecked = checkboxes.filter(
      (cb, i) => cb.checked && !getItemEl(i).classList.contains('deleted'),
    ).length;

    visibleCount.textContent = `(${visibleIndices.length})`;
    selectedCount.textContent = totalChecked > 0 ? `${totalChecked} selected` : '';

    selectAll.checked =
      visibleIndices.length > 0 && visibleCheckedCount === visibleIndices.length;
    selectAll.indeterminate =
      visibleCheckedCount > 0 && visibleCheckedCount < visibleIndices.length;

    deleteBtn.disabled = totalChecked === 0;
    deleteBtn.textContent =
      totalChecked > 0
        ? `Delete ${totalChecked} source${totalChecked === 1 ? '' : 's'}`
        : 'Delete';
  };

  // ── Search ─────────────────────────────────────────────────────────────────
  searchInput.addEventListener('input', () => {
    searchClear.classList.toggle('hidden', searchInput.value === '');
    applyFilters();
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchClear.classList.add('hidden');
    applyFilters();
    searchInput.focus();
  });

  // ── Filter chips ───────────────────────────────────────────────────────────
  filterChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      filterChips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilter = chip.dataset.filter as SourceType;
      applyFilters();
    });
  });

  // ── Select all (applies only to visible items) ─────────────────────────────
  selectAll.addEventListener('change', () => {
    sources.map((_, i) => i).filter(isVisible).forEach((i) => {
      checkboxes[i].checked = selectAll.checked;
    });
    syncState();
  });

  // ── Delete ─────────────────────────────────────────────────────────────────
  deleteBtn.addEventListener('click', async () => {
    const toDelete = sources
      .map((source, i) => ({ source, index: i }))
      .filter(({ index }) => checkboxes[index].checked && !getItemEl(index).classList.contains('deleted'));

    if (toDelete.length === 0) return;

    setInteractionsDisabled(true, shadow);

    let done = 0;
    for (const { source, index } of toDelete) {
      deleteBtn.textContent = `Deleting ${done + 1} of ${toDelete.length}…`;

      try {
        await adapter.triggerSourceDelete(source.element);
        getItemEl(index).classList.add('deleted');
        checkboxes[index].checked = false;
      } catch (err) {
        console.warn('[NLM Enhancer] Failed to delete source:', source.title, err);
      }

      done++;
    }

    // Close if all sources have been deleted; otherwise re-enable and sync.
    const hasRemaining = sources.some((_, i) => !getItemEl(i).classList.contains('deleted'));
    if (!hasRemaining) {
      close();
      return;
    }

    setInteractionsDisabled(false, shadow);
    syncState();
  });

  // ── Close handlers ─────────────────────────────────────────────────────────
  cancelBtn.addEventListener('click', close);
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', onKeyDown);
    }
  };
  document.addEventListener('keydown', onKeyDown);

  // ── Initial render ─────────────────────────────────────────────────────────
  if (sources.length === 0) {
    sourceList.innerHTML = '<p class="empty-message">No sources found in this notebook.</p>';
  }

  syncState();
  setTimeout(() => searchInput.focus(), 50);
}

function setInteractionsDisabled(disabled: boolean, shadow: ShadowRoot): void {
  const ids = [
    '#modal-delete-btn',
    '#modal-cancel-btn',
    '#modal-close-btn',
    '#modal-select-all',
    '#modal-search-input',
    '#modal-search-clear',
  ];
  ids.forEach((id) => {
    const el = shadow.querySelector<HTMLElement>(id);
    if (el) (el as HTMLButtonElement | HTMLInputElement).disabled = disabled;
  });
  shadow.querySelectorAll<HTMLButtonElement>('.filter-chip').forEach((chip) => {
    chip.disabled = disabled;
  });
  shadow.querySelectorAll<HTMLInputElement>('.source-item input[type="checkbox"]').forEach(
    (cb) => { cb.disabled = disabled; },
  );
}