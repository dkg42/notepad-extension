/**
 * @module source-panel-enhancer
 * @description Injects a search bar and type-filter chip row above the NotebookLM sources panel using a shadow-DOM host, enabling real-time filtering of source items without modifying the host page's DOM. Also exposes Export and Delete buttons that open their respective modals; re-injects after Angular SPA re-renders and watches for source list mutations to keep filters current.
 * @dependencies @/utils/dom, @/adapters/source-panel-adapter.interface, @/content/source-export-modal/source-export-modal, @/content/source-delete-modal/source-delete-modal
 * @public setupSourcePanelEnhancer
 */
import { onElementRemoved, onUrlChange } from '@/utils/dom';
import type { SourcePanelAdapter, SourceType } from '@/adapters/source-panel-adapter.interface';
import { showSourceExportModal } from '@/content/source-export-modal/source-export-modal';
import { showSourceDeleteModal } from '@/content/source-delete-modal/source-delete-modal';
import enhancerHtml from './source-panel-enhancer.html?raw';
import enhancerCss from './source-panel-enhancer.css?raw';

const MARKER_ID = 'nlm-enhancer-source-panel';

export function setupSourcePanelEnhancer(adapter: SourcePanelAdapter): void {
  tryInject(adapter);

  onUrlChange(() => {
    // Allow the Angular SPA to settle after navigation before re-injecting.
    setTimeout(() => tryInject(adapter), 800);
  });
}

function tryInject(adapter: SourcePanelAdapter): void {
  if (document.getElementById(MARKER_ID)) return;

  const injectionPoint = adapter.findSourcePanelInjectionPoint();
  if (!injectionPoint) {
    // Source panel not yet rendered — retry.
    setTimeout(() => tryInject(adapter), 500);
    return;
  }

  const host = document.createElement('div');
  host.id = MARKER_ID;
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = enhancerCss;
  shadow.appendChild(style);

  const wrapper = document.createElement('div');
  wrapper.innerHTML = enhancerHtml;
  shadow.appendChild(wrapper.firstElementChild!);

  injectionPoint.parentElement!.insertBefore(host, injectionPoint);

  setupInteractivity(shadow, adapter);

  // Re-inject if Angular re-renders and discards our node.
  onElementRemoved(MARKER_ID, () => setTimeout(() => tryInject(adapter), 500));
}

function setupInteractivity(shadow: ShadowRoot, adapter: SourcePanelAdapter): void {
  const searchInput = shadow.querySelector<HTMLInputElement>('#source-search-input')!;
  const clearBtn = shadow.querySelector<HTMLButtonElement>('#clear-search-btn')!;
  const exportBtn = shadow.querySelector<HTMLButtonElement>('#export-sources-btn')!;
  const deleteBtn = shadow.querySelector<HTMLButtonElement>('#delete-sources-btn')!;
  const chips = shadow.querySelectorAll<HTMLButtonElement>('.filter-chip');

  exportBtn.addEventListener('click', () => showSourceExportModal(adapter));
  deleteBtn.addEventListener('click', () => showSourceDeleteModal(adapter));

  let activeFilter: SourceType = 'all';

  const applyCurrentFilters = (): void => {
    applyFilters(adapter, searchInput.value, activeFilter);
  };

  searchInput.addEventListener('input', () => {
    clearBtn.classList.toggle('hidden', searchInput.value === '');
    applyCurrentFilters();
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.classList.add('hidden');
    applyCurrentFilters();
    searchInput.focus();
  });

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      chips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilter = chip.dataset.filter as SourceType;
      applyCurrentFilters();
    });
  });

  // Watch for sources being added/removed and re-apply the current filter state.
  watchSourceListMutations(adapter, applyCurrentFilters);
}

function applyFilters(adapter: SourcePanelAdapter, searchText: string, activeFilter: SourceType): void {
  const query = searchText.toLowerCase().trim();
  const items = adapter.findSourceItems();

  items.forEach((item) => {
    const title = adapter.getSourceTitle(item).toLowerCase();
    const type = adapter.getSourceType(item);

    const matchesSearch = query === '' || title.includes(query);
    const matchesFilter = activeFilter === 'all' || type === activeFilter;

    (item as HTMLElement).style.display = matchesSearch && matchesFilter ? '' : 'none';
  });
}

function watchSourceListMutations(adapter: SourcePanelAdapter, callback: () => void): void {
  const container = adapter.findSourceItemsContainer();
  if (!container) return;

  const observer = new MutationObserver(callback);
  observer.observe(container, { childList: true });
}
