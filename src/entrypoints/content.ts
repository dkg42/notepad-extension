import { defineContentScript } from 'wxt/sandbox';
import { getAdapter } from '@/adapters/adapter-registry';
import { setupSelectionSave } from '@/content/selection-save';
import { setupHeaderButtons } from '@/content/header-injector';

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
    // Feature: floating "Save snippet" button on text selection
    setupSelectionSave();

    // Feature: "Export chat" + "Save prompts" buttons injected into the page header
    const adapter = getAdapter(location.hostname);
    if (adapter) {
      setupHeaderButtons(adapter);
    }
  },
});
