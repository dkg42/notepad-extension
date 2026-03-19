import { defineContentScript } from 'wxt/sandbox';
import { getAdapter } from '@/adapters/adapter-registry';
import { isSourcePanelAdapter } from '@/adapters/source-panel-adapter.interface';
import { setupSelectionSave } from '@/content/selection-save';
import { setupHeaderButtons } from '@/content/header-injector';
import { setupSourcePanelEnhancer } from '@/content/source-panel-enhancer/source-panel-enhancer';

export default defineContentScript({
  matches: [
    'https://chatgpt.com/*',
    'https://chat.openai.com/*',
    'https://claude.ai/*',
    'https://gemini.google.com/*',
    'https://www.perplexity.ai/*',
    'https://copilot.microsoft.com/*',
    'https://notebooklm.google.com/*',
  ],
  main() {
    // Feature: floating "Save snippet" button on text selection
    setupSelectionSave();

    const adapter = getAdapter(location.hostname);
    if (!adapter) return;

    // Feature: "Export chat" + "Save prompts" buttons injected into the page header
    setupHeaderButtons(adapter);

    // Feature: source panel search + type filters (NotebookLM)
    if (isSourcePanelAdapter(adapter)) {
      setupSourcePanelEnhancer(adapter);
    }
  },
});
