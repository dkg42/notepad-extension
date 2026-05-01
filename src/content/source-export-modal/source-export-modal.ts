/**
 * @module source-export-modal
 * @description Renders a full-page shadow-DOM modal that lets users select NotebookLM sources and export them in a chosen format (e.g. CSV, Markdown). Sources are read from the live DOM via the adapter, and the export is delegated to the selected SourceExportStrategy; hidden items remain counted but excluded from the visible selection.
 * @dependencies @/adapters/source-panel-adapter.interface, @/types, @/export/source-export-strategy.interface, @/export/source-export-registry
 * @public showSourceExportModal
 */
import type { SourcePanelAdapter } from '@/adapters/source-panel-adapter.interface';
import type { SourceRecord } from '@/types';
import type { SourceExportStrategy } from '@/export/source-export-strategy.interface';
import { sourceExportStrategies } from '@/export/source-export-registry';
import modalHtml from './source-export-modal.html?raw';
import modalCss from './source-export-modal.css?raw';

const MODAL_HOST_ID = 'nlm-source-export-modal-host';

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

export function showSourceExportModal(adapter: SourcePanelAdapter): void {
  if (document.getElementById(MODAL_HOST_ID)) return;

  // Build source records from the live DOM
  const allSources: SourceRecord[] = adapter.findSourceItems().map((item) => ({
    title: adapter.getSourceTitle(item),
    type: adapter.getSourceType(item),
  }));

  // Inject shadow root at body level for full-page overlay
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

  wireModal(shadow, allSources, () => host.remove());
}

function wireModal(
  shadow: ShadowRoot,
  allSources: SourceRecord[],
  close: () => void,
): void {
  const searchInput    = shadow.querySelector<HTMLInputElement>('#modal-search-input')!;
  const searchClear    = shadow.querySelector<HTMLButtonElement>('#modal-search-clear')!;
  const selectAll      = shadow.querySelector<HTMLInputElement>('#modal-select-all')!;
  const visibleCount   = shadow.querySelector<HTMLSpanElement>('#visible-count')!;
  const selectedCount  = shadow.querySelector<HTMLSpanElement>('#selected-count')!;
  const sourceList     = shadow.querySelector<HTMLDivElement>('#modal-source-list')!;
  const formatOptions  = shadow.querySelector<HTMLDivElement>('#format-options')!;
  const exportBtn      = shadow.querySelector<HTMLButtonElement>('#modal-export-btn')!;
  const cancelBtn      = shadow.querySelector<HTMLButtonElement>('#modal-cancel-btn')!;
  const closeBtn       = shadow.querySelector<HTMLButtonElement>('#modal-close-btn')!;
  const backdrop       = shadow.querySelector<HTMLDivElement>('#source-export-modal')!;

  // ── Build source rows ──────────────────────────────────────────────────────
  const checkboxes: HTMLInputElement[] = allSources.map((source) => {
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

    // Clicking anywhere in the row toggles the checkbox
    item.addEventListener('click', (e) => {
      if (e.target !== checkbox) checkbox.checked = !checkbox.checked;
      syncState();
    });

    sourceList.appendChild(item);
    return checkbox;
  });

  // ── Build format options ───────────────────────────────────────────────────
  let selectedStrategy: SourceExportStrategy = sourceExportStrategies[0];

  sourceExportStrategies.forEach((strategy, index) => {
    const label = document.createElement('label');
    label.className = 'format-option';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'source-export-format';
    radio.value = strategy.type;
    radio.checked = index === 0;
    radio.addEventListener('change', () => {
      selectedStrategy = strategy;
    });

    label.appendChild(radio);
    label.appendChild(document.createTextNode(strategy.label));
    formatOptions.appendChild(label);
  });

  // ── State sync ────────────────────────────────────────────────────────────
  const getVisibleItems = (): Array<{ checkbox: HTMLInputElement; source: SourceRecord }> => {
    return checkboxes
      .map((cb, i) => ({ checkbox: cb, source: allSources[i] }))
      .filter(({ checkbox }) => !checkbox.closest('.source-item')!.classList.contains('hidden'));
  };

  const syncState = (): void => {
    const visible = getVisibleItems();
    const visibleChecked = visible.filter(({ checkbox }) => checkbox.checked);
    const totalChecked = checkboxes.filter((cb) => cb.checked).length;

    // Visible count label
    visibleCount.textContent = `(${visible.length})`;

    // Selected count badge
    if (totalChecked > 0) {
      selectedCount.textContent = `${totalChecked} selected`;
    } else {
      selectedCount.textContent = '';
    }

    // Select-all checkbox state
    selectAll.checked = visible.length > 0 && visibleChecked.length === visible.length;
    selectAll.indeterminate =
      visibleChecked.length > 0 && visibleChecked.length < visible.length;

    // Export button
    exportBtn.disabled = totalChecked === 0;
    exportBtn.textContent =
      totalChecked > 0
        ? `Export ${totalChecked} source${totalChecked === 1 ? '' : 's'}`
        : 'Export';
  };

  // ── Search filtering ───────────────────────────────────────────────────────
  const applySearch = (): void => {
    const query = searchInput.value.toLowerCase().trim();
    searchClear.classList.toggle('hidden', query === '');

    const items = sourceList.querySelectorAll<HTMLDivElement>('.source-item');
    items.forEach((item, i) => {
      const title = allSources[i].title.toLowerCase();
      item.classList.toggle('hidden', query !== '' && !title.includes(query));
    });

    // If previously selected items are now hidden, keep them checked but update counts
    syncState();
  };

  searchInput.addEventListener('input', applySearch);

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    applySearch();
    searchInput.focus();
  });

  // ── Select all (applies only to visible items) ─────────────────────────────
  selectAll.addEventListener('change', () => {
    getVisibleItems().forEach(({ checkbox }) => {
      checkbox.checked = selectAll.checked;
    });
    syncState();
  });

  // ── Export ─────────────────────────────────────────────────────────────────
  exportBtn.addEventListener('click', async () => {
    const selected = checkboxes
      .map((cb, i) => ({ checked: cb.checked, source: allSources[i] }))
      .filter(({ checked }) => checked)
      .map(({ source }) => source);

    if (selected.length === 0) return;

    exportBtn.disabled = true;
    exportBtn.textContent = 'Exporting...';

    try {
      await selectedStrategy.export(selected, 'notebooklm-sources');
      close();
    } catch {
      exportBtn.textContent = 'Export failed';
      setTimeout(syncState, 2000);
    }
  });

  // ── Close handlers ─────────────────────────────────────────────────────────
  cancelBtn.addEventListener('click', close);
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  document.addEventListener('keydown', function onKeyDown(e) {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', onKeyDown);
    }
  });

  // ── Initial render ─────────────────────────────────────────────────────────
  if (allSources.length === 0) {
    sourceList.innerHTML = '<p class="empty-message">No sources found in this notebook.</p>';
  }

  syncState();
  setTimeout(() => searchInput.focus(), 50);
}
