/**
 * @module capture-strip.content
 * @description Content script that renders a compact 56px capture strip on the right edge of
 *   the active page when screenshot capture mode is started from the sidebar. The strip is
 *   built with vanilla DOM inside a shadow root for full style isolation. Activated by the
 *   SHOW_CAPTURE_STRIP message from the background; exits via CAPTURE_STRIP_CLOSED.
 * @dependencies none
 * @public (WXT content script default export)
 */
import { defineContentScript } from 'wxt/sandbox';

// ─── SVG icon strings (Lucide paths, 24×24 viewBox) ──────────────────────────

const SVG = {
  monitor: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>`,
  maximize: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`,
  crop: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>`,
  pointer: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m4 4 7.07 17 2.51-7.39L21 11.07z"/></svg>`,
  x: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
};

// ─── Mode config ──────────────────────────────────────────────────────────────

interface ModeConfig {
  id: string;
  label: string;
  sub: string;
  svg: string;
}

const MODES: ModeConfig[] = [
  { id: 'visible',   label: 'Visible area', sub: 'What you see now',        svg: SVG.monitor  },
  { id: 'full',      label: 'Full page',    sub: 'Entire scrollable page',  svg: SVG.maximize },
  { id: 'selection', label: 'Selection',    sub: 'Draw a region',           svg: SVG.crop     },
  { id: 'element',   label: 'Element',      sub: 'Pick a DOM node',         svg: SVG.pointer  },
];

// ─── Inline strip CSS (injected into shadow root) ─────────────────────────────

const STRIP_CSS = `
  :host {
    all: initial;
    position: fixed !important;
    right: 0 !important;
    top: 0 !important;
    bottom: 0 !important;
    width: 56px !important;
    z-index: 2147483647 !important;
    pointer-events: auto !important;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  .strip {
    width: 56px;
    height: 100%;
    background: #fafaf9;
    border-left: 1px solid #e5e5e3;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 12px 0;
    font-family: -apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif;
    box-shadow: -4px 0 16px rgba(30,30,40,0.06);
  }

  .strip.dark {
    background: #1e1e28;
    border-left-color: #303040;
    box-shadow: -4px 0 16px rgba(0,0,0,0.35);
  }

  .brand {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    background: oklch(0.585 0.18 270);
    color: #fff;
    display: grid;
    place-items: center;
    font-family: "JetBrains Mono", "SF Mono", monospace;
    font-size: 13px;
    font-weight: 700;
    flex-shrink: 0;
    margin-bottom: 6px;
    user-select: none;
  }

  .mode-label {
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    font-family: "JetBrains Mono", "SF Mono", monospace;
    color: #888;
    font-weight: 600;
    margin-bottom: 6px;
    user-select: none;
  }

  .strip.dark .mode-label { color: #666; }

  .divider {
    width: 28px;
    height: 1px;
    background: #e5e5e3;
    margin: 6px 0;
    flex-shrink: 0;
    border: none;
  }

  .strip.dark .divider { background: #303040; }

  .tools {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    width: 100%;
  }

  .tool-wrap {
    position: relative;
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .tool-btn {
    position: relative;
    width: 38px;
    height: 36px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: #888;
    display: grid;
    place-items: center;
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
    outline: none;
  }

  .tool-btn:hover {
    background: #f0f0ee;
    color: #444;
  }

  .strip.dark .tool-btn:hover {
    background: #2a2a38;
    color: #ccc;
  }

  .tool-btn.active {
    background: oklch(0.945 0.040 270);
    color: oklch(0.585 0.18 270);
  }

  .strip.dark .tool-btn.active {
    background: oklch(0.295 0.060 270);
    color: oklch(0.700 0.17 270);
  }

  .tool-btn.active::before {
    content: '';
    position: absolute;
    left: 0;
    top: 7px;
    bottom: 7px;
    width: 3px;
    border-radius: 0 2px 2px 0;
    background: oklch(0.585 0.18 270);
  }

  .strip.dark .tool-btn.active::before {
    background: oklch(0.700 0.17 270);
  }

  .tool-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .tooltip {
    position: absolute;
    left: calc(100% + 8px);
    top: 50%;
    transform: translateY(-50%);
    background: #1a1a24;
    color: #fff;
    padding: 5px 9px;
    border-radius: 8px;
    white-space: nowrap;
    pointer-events: none;
    z-index: 1;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    min-width: 100px;
  }

  .strip.dark .tooltip {
    background: #f0f0ee;
    color: #1a1a24;
  }

  .tooltip-label {
    display: block;
    font-size: 11.5px;
    font-weight: 600;
  }

  .tooltip-sub {
    display: block;
    font-size: 9.5px;
    opacity: 0.7;
    font-family: "JetBrains Mono", "SF Mono", monospace;
    margin-top: 1px;
  }

  .thumb {
    width: 38px;
    height: 38px;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid #e0e0dd;
    flex-shrink: 0;
    margin-top: 2px;
    background-image:
      linear-gradient(45deg, #ebebea 25%, transparent 25%),
      linear-gradient(-45deg, #ebebea 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #ebebea 75%),
      linear-gradient(-45deg, transparent 75%, #ebebea 75%);
    background-size: 8px 8px;
    background-position: 0 0, 0 4px, 4px -4px, -4px 0;
    background-color: #f5f5f3;
  }

  .strip.dark .thumb {
    border-color: #303040;
    background-color: #252530;
    background-image:
      linear-gradient(45deg, #2a2a38 25%, transparent 25%),
      linear-gradient(-45deg, #2a2a38 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #2a2a38 75%),
      linear-gradient(-45deg, transparent 75%, #2a2a38 75%);
  }

  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .usage {
    margin-top: 5px;
    padding: 2px 6px;
    border-radius: 999px;
    font-size: 9.5px;
    font-family: "JetBrains Mono", "SF Mono", monospace;
    font-weight: 600;
    background: oklch(0.955 0.045 75);
    color: oklch(0.420 0.12 75);
    user-select: none;
  }

  .usage.warn {
    background: oklch(0.760 0.16 75);
    color: oklch(0.250 0.05 75);
  }

  .strip.dark .usage {
    background: oklch(0.310 0.060 75);
    color: oklch(0.800 0.15 75);
  }

  .spacer { flex: 1; }

  .exit-btn {
    width: 30px;
    height: 30px;
    border-radius: 6px;
    border: 1px solid #e0e0dd;
    background: #f5f5f3;
    color: #888;
    display: grid;
    place-items: center;
    cursor: pointer;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
    outline: none;
    flex-shrink: 0;
  }

  .exit-btn:hover {
    background: #ebebea;
    color: #333;
    border-color: #ccc;
  }

  .strip.dark .exit-btn {
    background: #252530;
    border-color: #303040;
    color: #666;
  }

  .strip.dark .exit-btn:hover {
    background: #2a2a38;
    color: #ccc;
    border-color: #404050;
  }
`;

// ─── Strip controller ─────────────────────────────────────────────────────────

let hostEl: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let activeMode = 'visible';
let windowId = 0;
let isCapturing = false;

function getStripEl(): HTMLElement | null {
  return shadowRoot?.querySelector('.strip') ?? null;
}

function setActiveMode(mode: string) {
  activeMode = mode;
  if (!shadowRoot) return;
  shadowRoot.querySelectorAll('.tool-btn').forEach((btn) => {
    const el = btn as HTMLElement;
    el.classList.toggle('active', el.dataset.mode === mode);
  });
}

function updateUsage(used: number, limit: number) {
  if (!shadowRoot) return;
  const badge = shadowRoot.querySelector('.usage') as HTMLElement | null;
  if (!badge) return;
  badge.textContent = `${used}/${limit}`;
  badge.classList.toggle('warn', used / limit >= 0.8);
}

function updateThumbnail(dataUrl: string) {
  if (!shadowRoot) return;
  const thumb = shadowRoot.querySelector('.thumb') as HTMLElement | null;
  if (!thumb) return;
  thumb.innerHTML = `<img src="${dataUrl}" alt="Last capture" />`;
}

function setButtonsDisabled(disabled: boolean) {
  if (!shadowRoot) return;
  shadowRoot.querySelectorAll('.tool-btn').forEach((btn) => {
    (btn as HTMLButtonElement).disabled = disabled;
  });
}

async function doCapture(mode: string) {
  if (isCapturing || !hostEl) return;
  isCapturing = true;
  setButtonsDisabled(true);

  // Hide strip and remove margin so they don't appear in the screenshot
  hostEl.style.opacity = '0';
  hostEl.style.pointerEvents = 'none';
  document.documentElement.style.removeProperty('margin-right');

  // Wait for reflow + render cycle before capture
  await new Promise<void>((resolve) => setTimeout(resolve, 160));

  try {
    const res = (await chrome.runtime.sendMessage({ type: 'DO_CAPTURE', mode })) as {
      ok: boolean;
      capture?: { dataUrl: string };
      usedToday?: number;
      dailyLimit?: number;
      error?: string;
    };

    if (res?.ok && res.capture) {
      updateThumbnail(res.capture.dataUrl);
      if (res.usedToday != null && res.dailyLimit != null) {
        updateUsage(res.usedToday, res.dailyLimit);
      }
    }
  } finally {
    // Restore margin and strip visibility
    document.documentElement.style.setProperty('margin-right', '56px', 'important');
    hostEl.style.opacity = '1';
    hostEl.style.pointerEvents = 'auto';
    isCapturing = false;
    setButtonsDisabled(false);
    setActiveMode(mode);
  }
}

function destroyStrip() {
  if (!hostEl) return;
  document.documentElement.style.removeProperty('margin-right');
  hostEl.remove();
  hostEl = null;
  shadowRoot = null;
}

function buildStrip(initialMode: string, used: number, limit: number, dark: boolean): HTMLElement {
  const strip = document.createElement('div');
  strip.className = `strip${dark ? ' dark' : ''}`;

  // Brand
  const brand = document.createElement('div');
  brand.className = 'brand';
  brand.textContent = 'n';
  strip.appendChild(brand);

  // Mode label
  const label = document.createElement('div');
  label.className = 'mode-label';
  label.textContent = 'Capture mode';
  strip.appendChild(label);

  // Divider
  strip.appendChild(Object.assign(document.createElement('hr'), { className: 'divider' }));

  // Tools
  const toolsEl = document.createElement('div');
  toolsEl.className = 'tools';

  MODES.forEach((m) => {
    const wrap = document.createElement('div');
    wrap.className = 'tool-wrap';

    const btn = document.createElement('button');
    btn.className = `tool-btn${m.id === initialMode ? ' active' : ''}`;
    btn.dataset.mode = m.id;
    btn.innerHTML = m.svg;
    btn.title = m.label;

    // Tooltip (shown via mouseenter)
    const tip = document.createElement('div');
    tip.className = 'tooltip';
    tip.innerHTML = `<span class="tooltip-label">${m.label}</span><span class="tooltip-sub">${m.sub}</span>`;
    tip.style.display = 'none';

    btn.addEventListener('mouseenter', () => {
      if (!btn.classList.contains('active')) tip.style.display = 'block';
    });
    btn.addEventListener('mouseleave', () => {
      tip.style.display = 'none';
    });
    btn.addEventListener('click', () => {
      tip.style.display = 'none';
      void doCapture(m.id);
    });

    wrap.appendChild(btn);
    wrap.appendChild(tip);
    toolsEl.appendChild(wrap);
  });

  strip.appendChild(toolsEl);

  // Divider
  strip.appendChild(Object.assign(document.createElement('hr'), { className: 'divider' }));

  // Thumbnail
  const thumb = document.createElement('div');
  thumb.className = 'thumb';
  strip.appendChild(thumb);

  // Usage badge
  const usageBadge = document.createElement('div');
  usageBadge.className = `usage${used / limit >= 0.8 ? ' warn' : ''}`;
  usageBadge.textContent = `${used}/${limit}`;
  strip.appendChild(usageBadge);

  // Spacer
  const spacer = document.createElement('div');
  spacer.className = 'spacer';
  strip.appendChild(spacer);

  // Exit button
  const exitBtn = document.createElement('button');
  exitBtn.className = 'exit-btn';
  exitBtn.innerHTML = SVG.x;
  exitBtn.title = 'Exit capture mode';
  exitBtn.addEventListener('click', () => {
    destroyStrip();
    void chrome.runtime.sendMessage({ type: 'CAPTURE_STRIP_CLOSED', windowId });
  });
  strip.appendChild(exitBtn);

  return strip;
}

function showStrip(payload: {
  mode: string;
  windowId: number;
  usedToday: number;
  dailyLimit: number;
  dark: boolean;
}) {
  // Remove any stale strip instance
  document.getElementById('nh-capture-strip-host')?.remove();

  activeMode = payload.mode;
  windowId = payload.windowId;

  // Create shadow host
  const host = document.createElement('div');
  host.id = 'nh-capture-strip-host';
  shadowRoot = host.attachShadow({ mode: 'open' });

  // Inject styles
  const styleEl = document.createElement('style');
  styleEl.textContent = STRIP_CSS;
  shadowRoot.appendChild(styleEl);

  // Build and append strip
  const stripEl = buildStrip(payload.mode, payload.usedToday, payload.dailyLimit, payload.dark);
  shadowRoot.appendChild(stripEl);

  hostEl = host;
  document.body.appendChild(host);

  // Push page content left so the strip doesn't overlap it.
  // setProperty(..., 'important') sets an inline !important style — the absolute highest
  // CSS priority, guaranteed to beat any stylesheet rule including other !important rules.
  document.documentElement.style.setProperty('margin-right', '56px', 'important');
}

// ─── WXT entrypoint ──────────────────────────────────────────────────────────

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'SHOW_CAPTURE_STRIP') {
        showStrip({
          mode:       message.mode       ?? 'visible',
          windowId:   message.windowId   ?? 0,
          usedToday:  message.usedToday  ?? 0,
          dailyLimit: message.dailyLimit ?? 5,
          dark:       message.dark       ?? false,
        });
      }
    });
  },
});
