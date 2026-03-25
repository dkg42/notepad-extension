import { defineContentScript } from 'wxt/sandbox';
import { getAdapter } from '@/adapters/adapter-registry';
import { isSourcePanelAdapter } from '@/adapters/source-panel-adapter.interface';
import { isStudioPanelAdapter } from '@/adapters/studio-panel-adapter.interface';
import { setupSelectionSave } from '@/content/selection-save';
import { setupHeaderButtons } from '@/content/header-injector';
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

    // ── Audio fetch relay (NotebookLM only) ──────────────────────────────────
    // The background service worker cannot fetch audio from Google CDN due to
    // CORS restrictions. The content script runs in the page's origin context,
    // so fetch() here sends cookies and passes CORS checks automatically.
    if (location.hostname === 'notebooklm.google.com') {
      console.log('[NLM-EXT] Registering FETCH_AUDIO_IN_PAGE listener');
      chrome.runtime.onMessage.addListener(
        (message: unknown, _sender, sendResponse: (r: unknown) => void) => {
          console.log('[NLM-EXT] Content script received message:', message);
          if (
            typeof message === 'object' && message !== null &&
            (message as { type?: string }).type === 'FETCH_AUDIO_IN_PAGE'
          ) {
            const { url } = message as { type: string; url: string };
            console.log('[NLM-EXT] Fetching audio URL:', url);
            (async () => {
              const res = await fetch(url, { credentials: 'include' });
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const ct = res.headers.get('content-type') ?? '';
              if (ct.startsWith('text/html')) throw new Error('Auth redirect (HTML response)');
              const blob = await res.blob();
              if (blob.size === 0) throw new Error('Empty response');
              return await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
            })()
              .then((dataUrl) => sendResponse({ ok: true, dataUrl }))
              .catch((err: unknown) =>
                sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
              );
            return true; // keep channel open for async response
          }
          return undefined;
        },
      );
    }

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

    // Feature: "Export notes" button in the studio panel (NotebookLM)
    if (isStudioPanelAdapter(adapter)) {
      setupStudioPanelEnhancer(adapter);
    }

    // Feature: sync chat history from ChatGPT, Claude, and Gemini
    setupChatHistorySync();
  },
});
