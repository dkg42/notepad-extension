/**
 * @module clipboard-monitor.content
 * @description WXT content script entrypoint that activates clipboard monitoring on every page. Runs at document_end in all frames and delegates setup logic to the clipboard-monitor content module.
 * @dependencies @/content/clipboard-monitor
 * @public (default WXT content script export)
 */
import { defineContentScript } from 'wxt/sandbox';
import { setupClipboardMonitor } from '@/content/clipboard-monitor';

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  runAt: 'document_end',
  main() {
    setupClipboardMonitor();
  },
});
