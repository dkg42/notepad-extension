import type { ChatSiteAdapter } from '@/adapters/adapter.interface';
import { exportStrategies } from '@/export/export-registry';
import { showFormatPicker } from './format-picker';
import { storageService } from '@/services/storage-service';
import type { Folder } from '@/types';
import { onElementRemoved, onUrlChange } from '@/utils/dom';

const INJECTED_MARKER_ID = 'llm-enhancer-header-buttons';
const INJECT_RETRY_DELAY_MS = 500;
const NAV_SETTLE_DELAY_MS = 1000;

export function setupHeaderButtons(adapter: ChatSiteAdapter): void {
  tryInject(adapter);

  // Re-inject after SPA navigation (new chat = new URL, header re-renders)
  onUrlChange(() => {
    setTimeout(() => tryInject(adapter), NAV_SETTLE_DELAY_MS);
  });
}

function tryInject(adapter: ChatSiteAdapter): void {
  // Avoid duplicate injection if buttons are already present
  if (document.getElementById(INJECTED_MARKER_ID)) return;

  const anchor = adapter.findHeaderAnchor();
  if (!anchor) {
    // Header not rendered yet — retry after a short delay
    setTimeout(() => tryInject(adapter), INJECT_RETRY_DELAY_MS);
    return;
  }

  const { container, shadow } = createButtonContainer();
  container.id = INJECTED_MARKER_ID;
  anchor.appendChild(container);

  // ChatGPT (and other React SPAs) may replace the header node after hydration,
  // silently discarding our injected buttons. Re-inject as soon as that happens.
  onElementRemoved(INJECTED_MARKER_ID, () => tryInject(adapter));

  const exportBtn = addButton('Export chat', '#2563eb', shadow);
  const savePromptsBtn = addButton('Save prompts', '#7c3aed', shadow);

  exportBtn.addEventListener('click', async () => {
    const messages = adapter.extractMessages();
    if (messages.length === 0) {
      showFeedback(exportBtn, 'Nothing to export', '#6b7280');
      return;
    }

    exportBtn.disabled = true;
    const strategy = await showFormatPicker(shadow, exportStrategies);
    exportBtn.disabled = false;

    if (!strategy) return;

    const filename = `chat-${new Date().toISOString().slice(0, 10)}`;

    // Set loading state directly — do NOT use showFeedback here because it
    // captures btn.textContent as the restore value, and a subsequent
    // showFeedback call while 'Exporting…' is visible would restore back to
    // 'Exporting…' instead of the original label.
    exportBtn.textContent = 'Exporting…';
    exportBtn.style.background = '#6b7280';
    exportBtn.disabled = true;

    try {
      await strategy.export(messages, filename);
      restoreButton(exportBtn);
      showFeedback(exportBtn, 'Exported!', '#16a34a');
    } catch (err) {
      restoreButton(exportBtn);
      const msg = err instanceof Error ? err.message : 'Export failed';
      showFeedback(exportBtn, msg.slice(0, 30), '#ef4444');
    }
  });

  savePromptsBtn.addEventListener('click', async () => {
    const prompts = adapter.extractPrompts();
    if (prompts.length === 0) {
      showFeedback(savePromptsBtn, 'No prompts found', '#6b7280');
      return;
    }

    savePromptsBtn.disabled = true;

    try {
      const folders = await storageService.getFolders();
      const result = await showFolderPicker(shadow, folders);

      if (result === null) {
        // User cancelled — re-enable and bail out
        savePromptsBtn.disabled = false;
        return;
      }

      await storageService.saveMany(prompts, location.href, result.folderId);
      showFeedback(savePromptsBtn, `Saved ${prompts.length}!`, '#16a34a');
    } catch {
      showFeedback(savePromptsBtn, 'Error saving', '#ef4444');
    }
  });
}

// ---------------------------------------------------------------------------
// Folder picker — rendered inside the shadow DOM
// ---------------------------------------------------------------------------

/**
 * Shows a compact folder-selection panel anchored below the Save prompts button.
 * Resolves with `{ folderId }` on confirm (folderId may be undefined = no folder),
 * or `null` when the user cancels.
 */
function showFolderPicker(
  shadow: ShadowRoot,
  folders: Folder[],
): Promise<{ folderId?: string } | null> {
  return new Promise((resolve) => {
    // Guard against duplicate pickers (e.g. rapid double-click)
    if (shadow.querySelector('.folder-picker')) return;

    let selectedFolderId: string | undefined = undefined;

    const panel = document.createElement('div');
    panel.className = 'folder-picker';

    // Title
    const title = document.createElement('p');
    title.className = 'picker-title';
    title.textContent = 'Save to folder';
    panel.appendChild(title);

    // "No folder" radio — selected by default
    const noFolderLabel = buildRadioOption('No folder', 'folder-pick', '');
    const noFolderRadio = noFolderLabel.querySelector('input') as HTMLInputElement;
    noFolderRadio.checked = true;
    noFolderRadio.addEventListener('change', () => {
      selectedFolderId = undefined;
      newFolderInput.value = '';
    });
    panel.appendChild(noFolderLabel);

    // Existing folder radios
    for (const folder of folders) {
      const label = buildRadioOption(folder.name, 'folder-pick', folder.id);
      const radio = label.querySelector('input') as HTMLInputElement;
      radio.addEventListener('change', () => {
        selectedFolderId = folder.id;
        newFolderInput.value = '';
      });
      panel.appendChild(label);
    }

    // Divider
    const divider = document.createElement('hr');
    divider.className = 'picker-divider';
    panel.appendChild(divider);

    // New folder input
    const newFolderInput = document.createElement('input');
    newFolderInput.type = 'text';
    newFolderInput.className = 'picker-input';
    newFolderInput.placeholder = 'Or create new folder...';
    newFolderInput.addEventListener('input', () => {
      pickerError.hidden = true;
      newFolderInput.classList.remove('picker-input--error');
      if (newFolderInput.value.trim()) {
        // Deselect all radios when typing a new name
        panel.querySelectorAll<HTMLInputElement>('input[type=radio]').forEach((r) => {
          r.checked = false;
        });
        selectedFolderId = undefined;
      } else {
        noFolderRadio.checked = true;
      }
    });
    newFolderInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        panel.remove();
        resolve(null);
      }
    });
    panel.appendChild(newFolderInput);

    // Error message (hidden until a duplicate-name attempt occurs)
    const pickerError = document.createElement('p');
    pickerError.className = 'picker-error';
    pickerError.hidden = true;
    panel.appendChild(pickerError);

    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'picker-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'picker-btn-cancel';
    cancelBtn.addEventListener('click', () => {
      panel.remove();
      resolve(null);
    });

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.className = 'picker-btn-save';
    saveBtn.addEventListener('click', async () => {
      const newName = newFolderInput.value.trim();
      let folderId: string | undefined;

      if (newName) {
        try {
          const folder = await storageService.createFolder(newName);
          folderId = folder.id;
        } catch (err) {
          pickerError.textContent = err instanceof Error ? err.message : 'Failed to create folder.';
          pickerError.hidden = false;
          newFolderInput.classList.add('picker-input--error');
          return; // Keep picker open so the user can correct the name
        }
      } else {
        folderId = selectedFolderId;
      }

      panel.remove();
      resolve({ folderId });
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    panel.appendChild(actions);

    shadow.appendChild(panel);

    // Auto-focus so keyboard users can immediately type a new folder name
    setTimeout(() => newFolderInput.focus(), 50);
  });
}

function buildRadioOption(label: string, name: string, value: string): HTMLLabelElement {
  const el = document.createElement('label');
  el.className = 'folder-option';

  const radio = document.createElement('input');
  radio.type = 'radio';
  radio.name = name;
  radio.value = value;

  el.appendChild(radio);
  el.appendChild(document.createTextNode(label));
  return el;
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function createButtonContainer(): { container: HTMLElement; shadow: ShadowRoot } {
  const container = document.createElement('div');
  // all:initial resets host styles so the site's CSS doesn't bleed in.
  // position:relative is required so the folder-picker panel (position:absolute)
  // anchors correctly to this container. margin-left:auto right-aligns within
  // flex parents (used by the Claude adapter).
  container.style.cssText =
    'all: initial; display: inline-flex; margin-left: auto; position: relative; z-index: 9999;';

  const shadow = container.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 0 8px;
    }

    /* ── Header buttons ── */
    button {
      padding: 5px 12px;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      font-family: system-ui, -apple-system, sans-serif;
      cursor: pointer;
      white-space: nowrap;
      transition: opacity 0.15s;
    }
    button:hover   { opacity: 0.85; }
    button:disabled { opacity: 0.6; cursor: default; }

    /* ── Format picker panel ── */
    .format-picker {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.14);
      padding: 12px;
      min-width: 210px;
      z-index: 10000;
      font-family: system-ui, -apple-system, sans-serif;
    }

    .format-options {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-bottom: 10px;
    }

    .format-option {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 2px;
      font-size: 12px;
      color: #374151;
      cursor: pointer;
      border-radius: 4px;
    }

    .format-option:hover {
      background: #f3f4f6;
    }

    .picker-btn-export {
      padding: 3px 10px;
      font-size: 11px;
      background: #2563eb;
    }

    /* ── Folder picker panel ── */
    .folder-picker {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.14);
      padding: 12px;
      min-width: 210px;
      z-index: 10000;
      font-family: system-ui, -apple-system, sans-serif;
    }

    .picker-title {
      margin: 0 0 8px;
      font-size: 12px;
      font-weight: 600;
      color: #374151;
    }

    .folder-option {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 3px 0;
      font-size: 12px;
      color: #374151;
      cursor: pointer;
      white-space: normal;
    }

    .picker-divider {
      border: none;
      border-top: 1px solid #e5e7eb;
      margin: 8px 0;
    }

    .picker-input {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      padding: 4px 7px;
      font-size: 12px;
      font-family: system-ui, -apple-system, sans-serif;
      outline: none;
      margin-bottom: 8px;
      color: #111827;
    }
    .picker-input:focus { border-color: #7c3aed; }
    .picker-input--error { border-color: #ef4444; }

    .picker-error {
      font-size: 11px;
      color: #ef4444;
      margin: 0 0 8px;
    }

    .picker-actions {
      display: flex;
      justify-content: flex-end;
      gap: 6px;
    }

    .picker-btn-cancel {
      padding: 3px 10px;
      font-size: 11px;
      background: #6b7280;
    }

    .picker-btn-save {
      padding: 3px 10px;
      font-size: 11px;
      background: #7c3aed;
    }
  `;
  shadow.appendChild(style);

  return { container, shadow };
}

function addButton(label: string, bg: string, shadow: ShadowRoot): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.textContent = label;
  btn.style.background = bg;
  btn.dataset.originalLabel = label;
  btn.dataset.originalBg = bg;
  shadow.appendChild(btn);
  return btn;
}

function restoreButton(btn: HTMLButtonElement): void {
  btn.textContent = btn.dataset.originalLabel ?? '';
  btn.style.background = btn.dataset.originalBg ?? '';
  btn.disabled = false;
}

function showFeedback(btn: HTMLButtonElement, message: string, bg: string): void {
  const originalLabel = btn.textContent ?? '';
  const originalBg = btn.style.background;
  btn.textContent = message;
  btn.style.background = bg;
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = originalLabel;
    btn.style.background = originalBg;
    btn.disabled = false;
  }, 1500);
}