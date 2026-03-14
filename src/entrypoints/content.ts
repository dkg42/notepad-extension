import { defineContentScript } from 'wxt/sandbox';
import { storageService } from '@/services/storage-service';

export default defineContentScript({
  matches: [
    'https://chatgpt.com/*',
    'https://chat.openai.com/*',
    'https://claude.ai/*',
    'https://gemini.google.com/*',
    'https://www.perplexity.ai/*',
    'https://copilot.microsoft.com/*',
  ],
  main() {
    const ui = createFloatingSaveButton();
    document.body.appendChild(ui.container);

    document.addEventListener('mouseup', (e) => {
      // Ignore clicks originating from our own button
      if (ui.button.contains(e.target as Node)) return;

      const selection = window.getSelection();
      const text = selection?.toString().trim() ?? '';

      if (text.length > 0) {
        const rect = selection!.getRangeAt(0).getBoundingClientRect();
        ui.show(rect);
      } else {
        ui.hide();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') ui.hide();
    });

    ui.button.addEventListener('click', async () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim() ?? '';
      if (!text) return;

      await storageService.save(text, location.href);
      selection?.removeAllRanges();
      ui.showFeedback();
    });
  },
});

// ---------------------------------------------------------------------------
// DOM factory — isolated in a shadow root to avoid CSS collisions with the host
// ---------------------------------------------------------------------------

interface FloatingSaveButton {
  container: HTMLElement;
  button: HTMLButtonElement;
  show(rect: DOMRect): void;
  hide(): void;
  showFeedback(): void;
}

function createFloatingSaveButton(): FloatingSaveButton {
  const container = document.createElement('div');
  container.id = 'llm-enhancer-root';
  // Reset all inherited styles; position:fixed lets child button use viewport coords
  container.style.cssText = 'all: initial; position: fixed; z-index: 2147483647;';

  const shadow = container.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    button {
      display: none;
      position: fixed;
      padding: 5px 12px;
      background: #2563eb;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-family: system-ui, -apple-system, sans-serif;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
      transition: background 0.15s;
    }
    button:hover { background: #1d4ed8; }
    button.saved  { background: #16a34a; }
  `;
  shadow.appendChild(style);

  const button = document.createElement('button');
  button.textContent = 'Save snippet';
  shadow.appendChild(button);

  let feedbackTimer: ReturnType<typeof setTimeout> | undefined;

  return {
    container,
    button,
    show(rect: DOMRect) {
      button.style.display = 'block';
      // Anchor just below the selection; getBoundingClientRect gives viewport coords
      button.style.top = `${rect.bottom + 6}px`;
      button.style.left = `${rect.left}px`;
    },
    hide() {
      clearTimeout(feedbackTimer);
      button.style.display = 'none';
      button.textContent = 'Save snippet';
      button.classList.remove('saved');
    },
    showFeedback() {
      button.textContent = 'Saved!';
      button.classList.add('saved');
      feedbackTimer = setTimeout(() => this.hide(), 1200);
    },
  };
}
