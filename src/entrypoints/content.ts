/**
 * @module content
 * @description Thin content-script orchestrator that runs on all supported LLM and NotebookLM pages. It bootstraps platform-specific features (send-to-chat, source panel enhancer, studio panel enhancer, chat history sync) by resolving the correct adapter from the registry and delegating setup to the appropriate feature modules.
 * @dependencies @/adapters/adapter-registry, @/adapters/source-panel-adapter.interface, @/adapters/studio-panel-adapter.interface, @/content/send-to-chat, @/content/source-panel-enhancer/source-panel-enhancer, @/content/studio-panel-enhancer/studio-panel-enhancer, @/content/chat-history-sync
 * @public default (WXT content script definition)
 */
import { defineContentScript } from 'wxt/sandbox';
import { getAdapter } from '@/adapters/adapter-registry';
import { isSourcePanelAdapter } from '@/adapters/source-panel-adapter.interface';
import { isStudioPanelAdapter } from '@/adapters/studio-panel-adapter.interface';
import { setupSendToChat } from '@/content/send-to-chat';
import { setupSourcePanelEnhancer } from '@/content/source-panel-enhancer/source-panel-enhancer';
import { setupStudioPanelEnhancer } from '@/content/studio-panel-enhancer/studio-panel-enhancer';
import { setupChatHistorySync } from '@/content/chat-history-sync';

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
    console.log('[NLM-EXT] Content script loaded on:', location.hostname, location.href);

    // Feature: send saved prompts from sidebar into the active chat input
    setupSendToChat();

    const adapter = getAdapter(location.hostname);
    if (!adapter) return;

    // Feature: source panel search + type filters (NotebookLM)
    if (isSourcePanelAdapter(adapter)) {
      setupSourcePanelEnhancer(adapter);
    }

    // Feature: "Export notes" button in the studio panel (NotebookLM)
    if (isStudioPanelAdapter(adapter)) {
      setupStudioPanelEnhancer(adapter);
    }

    // Feature: sync chat history from ChatGPT, Claude, and Gemini
    setupChatHistorySync();
  },
});
