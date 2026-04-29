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
