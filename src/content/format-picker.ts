import type { ExportStrategy } from '@/export/export-strategy.interface';
import pickerHtml from './format-picker.html?raw';

/**
 * Renders the format-picker panel into the given shadow root.
 * Resolves with the chosen ExportStrategy, or null if the user cancels.
 */
export function showFormatPicker(
  shadow: ShadowRoot,
  strategies: ExportStrategy[],
): Promise<ExportStrategy | null> {
  return new Promise((resolve) => {
    if (shadow.querySelector('#format-picker-panel')) return;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = pickerHtml;
    const panel = wrapper.firstElementChild as HTMLElement;
    shadow.appendChild(panel);

    const optionsList = panel.querySelector<HTMLDivElement>('#format-options-list')!;
    const cancelBtn = panel.querySelector<HTMLButtonElement>('#format-picker-cancel')!;
    const confirmBtn = panel.querySelector<HTMLButtonElement>('#format-picker-confirm')!;

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
      resolve(chosen);
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
