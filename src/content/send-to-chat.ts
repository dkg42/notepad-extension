/**
 * @module send-to-chat
 * @description Tracks the last focused text input or contenteditable element on the page and inserts text into it when the background sends a SEND_TO_CHAT message. This enables the sidebar to push saved prompts or snippets directly into the active chat input without the user needing to copy-paste.
 * @dependencies none
 * @public setupSendToChat
 */
export function setupSendToChat() {
  let lastFocusedEditable: HTMLElement | null = null;

  document.addEventListener(
    'focusin',
    (e) => {
      const el = e.target as HTMLElement;
      if (
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLInputElement ||
        el.isContentEditable
      ) {
        lastFocusedEditable = el;
      }
    },
    true,
  );

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type !== 'SEND_TO_CHAT') return false;

    const target = lastFocusedEditable;
    if (!target || !document.body.contains(target)) {
      sendResponse({ ok: false, error: 'no_target' });
      return false;
    }

    try {
      target.focus();

      if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
        const text = msg.text as string;
        const start = target.selectionStart ?? target.value.length;
        const end = target.selectionEnd ?? target.value.length;
        target.value = target.value.slice(0, start) + text + target.value.slice(end);
        target.selectionStart = target.selectionEnd = start + text.length;
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        // contenteditable — execCommand fires React/Vue synthetic input events correctly
        document.execCommand('insertText', false, msg.text as string);
      }

      sendResponse({ ok: true });
    } catch (err) {
      sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }

    return false;
  });
}
