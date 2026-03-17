/**
 * Resolves with the first element matching selector once it appears in the DOM.
 * Resolves with null if the timeout elapses before a match is found.
 */
export function waitForElement(selector: string, timeout = 10_000): Promise<Element | null> {
  return new Promise((resolve) => {
    const existing = document.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

/**
 * Calls callback once when the element with the given ID is removed from the DOM.
 * Useful for detecting when a host SPA re-renders and discards injected nodes.
 */
export function onElementRemoved(id: string, callback: () => void): () => void {
  const observer = new MutationObserver(() => {
    if (!document.getElementById(id)) {
      observer.disconnect();
      callback();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

/**
 * Calls callback whenever the page URL changes (handles SPA client-side navigation).
 * Returns a cleanup function to stop observing.
 */
export function onUrlChange(callback: (url: string) => void): () => void {
  let lastUrl = location.href;

  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      callback(lastUrl);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}
