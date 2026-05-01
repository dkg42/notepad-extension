/**
 * @module format-picker
 * @description Renders a transient format-selection panel inside a shadow DOM root, letting the user pick an export strategy (e.g. Markdown, JSON) and optionally include notebook sources. The panel is promise-based — it resolves with the chosen strategy and options on confirm, or null on cancel/Escape.
 * @dependencies @/export/export-strategy.interface
 * @public FormatPickerResult, showFormatPicker
 */
import type { ExportStrategy } from '@/export/export-strategy.interface';
import pickerHtml from './format-picker.html?raw';

export interface FormatPickerResult {
  strategy: ExportStrategy;
  /** True only when the "Include notebook sources" checkbox is shown and checked. */
  includeSources: boolean;
}

/**
 * Renders the format-picker panel into the given shadow root.
 * Resolves with the chosen strategy (and options), or null if the user cancels.
 *
 * @param options.includeSourcesToggle - When true, shows an "Include notebook sources"
 *   checkbox (NotebookLM only). Defaults to false.
 */
export function showFormatPicker(
  shadow: ShadowRoot,
  strategies: ExportStrategy[],
  options: { includeSourcesToggle?: boolean } = {},
): Promise<FormatPickerResult | null> {
  return new Promise((resolve) => {
    if (shadow.querySelector('#format-picker-panel')) return;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = pickerHtml;
    const panel = wrapper.firstElementChild as HTMLElement;
    shadow.appendChild(panel);

    const optionsList     = panel.querySelector<HTMLDivElement>('#format-options-list')!;
    const cancelBtn       = panel.querySelector<HTMLButtonElement>('#format-picker-cancel')!;
    const confirmBtn      = panel.querySelector<HTMLButtonElement>('#format-picker-confirm')!;
    const sourcesOption   = panel.querySelector<HTMLLabelElement>('#include-sources-option')!;
    const sourcesCheckbox = panel.querySelector<HTMLInputElement>('#include-sources-checkbox')!;

    // Show the sources toggle only when explicitly requested.
    if (options.includeSourcesToggle) {
      sourcesOption.classList.remove('hidden');
    }

    let selectedType = strategies[0]?.type ?? '';

    strategies.forEach((strategy, index) => {
      const label = document.createElement('label');
      label.className = 'format-option';

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'export-format';
      radio.value = strategy.type;
      radio.checked = index === 0;

      radio.addEventListener('change', () => {
        selectedType = strategy.type;
      });

      label.appendChild(radio);
      label.appendChild(document.createTextNode(strategy.label));
      optionsList.appendChild(label);
    });

    const dismiss = () => panel.remove();

    cancelBtn.addEventListener('click', () => {
      dismiss();
      resolve(null);
    });

    confirmBtn.addEventListener('click', () => {
      const chosen = strategies.find((s) => s.type === selectedType) ?? null;
      dismiss();
      if (!chosen) { resolve(null); return; }
      resolve({ strategy: chosen, includeSources: sourcesCheckbox.checked });
    });

    panel.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dismiss();
        resolve(null);
      }
    });

    setTimeout(() => confirmBtn.focus(), 50);
  });
}
