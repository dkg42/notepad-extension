import type { ChatSiteAdapter } from '@/adapters/adapter.interface';
import { MarkdownExportStrategy } from '@/export/markdown.export';
import { storageService } from '@/services/storage-service';
import { onElementRemoved, onUrlChange } from '@/utils/dom';

const INJECTED_MARKER_ID = 'llm-enhancer-header-buttons';
const INJECT_RETRY_DELAY_MS = 500;
const NAV_SETTLE_DELAY_MS = 1000;

const exporter = new MarkdownExportStrategy();

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
    const filename = `chat-${new Date().toISOString().slice(0, 10)}`;
    await exporter.export(messages, filename);
    showFeedback(exportBtn, 'Exported!', '#16a34a');
  });

  savePromptsBtn.addEventListener('click', async () => {
    const prompts = adapter.extractPrompts();
    if (prompts.length === 0) {
      showFeedback(savePromptsBtn, 'No prompts found', '#6b7280');
      return;
    }
    await storageService.saveMany(prompts, location.href);
    showFeedback(savePromptsBtn, `Saved ${prompts.length}!`, '#16a34a');
  });
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function createButtonContainer(): { container: HTMLElement; shadow: ShadowRoot } {
  const container = document.createElement('div');
  // Reset host styles so the site's CSS doesn't bleed in
  // margin-left:auto right-aligns the container within its flex parent
  // (used by the Claude adapter which injects into the flex-1 title div).
  container.style.cssText = 'all: initial; display: inline-flex; margin-left: auto;';

  const shadow = container.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 0 8px;
    }
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
  `;
  shadow.appendChild(style);

  return { container, shadow };
}

function addButton(label: string, bg: string, shadow: ShadowRoot): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.textContent = label;
  btn.style.background = bg;
  shadow.appendChild(btn);
  return btn;
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
