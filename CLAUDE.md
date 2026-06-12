# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview
- This is a browser extension that will be used to enhance the user experience of users using LLM chatbots.
- Claude will be acting as a senior developer from google when working on this project.
- Claude must use coding best practices when making changes to the code base so that the code is production ready.
- - Analyze the code and provide various approaches as suggestions before making any changes in code.

## Coding guidelines
- The code will use wxt as a framework for extension with react for the UI.
- Structure the code appropriately so that it follows SOLID principles.
- Use camelCase for variable names and kebab-case for selectors and html elements.
- Practise separation of concerns. All HTML elements should go into a .html file for that component. Similarly all CSS classes should go to a .css file for that component. All logic will remain in a .ts file. A folder containing these three files is classified as a component which will result in a UI rendered component.

## Commands

```bash
npm install        # Install dependencies and run WXT prepare (via postinstall)
npm run dev        # Dev profile + HMR → .output-dev/chrome-mv3/ ("Notehublm Dev")
npm run build      # Prod profile build  → .output/chrome-mv3/      ("Notehublm")
npm run build:dev  # Dev-profile production build (no HMR) for smoke-testing
npm run zip        # Prod build + zip for Chrome Web Store submission
npm run typecheck  # Type-check without emitting
```

### Build profiles

Two profiles are checked into the repo: `.env.development` and `.env.production`.
Local overrides go in `.env.<mode>.local` (gitignored). Required keys (see
`.env.example`):

- `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_API_KEY` — Firebase project that
  signs the user in.
- `VITE_CLOUD_FUNCTIONS_BASE_URL` — Cloud Functions deployment that proxies
  Google OAuth + Dodo billing.
- `VITE_EXTERNAL_AUTH_ORIGIN` — origin of the externally hosted auth page
  loaded by the offscreen iframe. Dev: `https://localhost:3000`. Prod:
  `https://www.notehublm.com`.
- `VITE_ENABLE_GEMINI_NANO` — feature toggle (`true`/`false`, default off) for
  on-device Gemini Nano (Chrome Prompt API). See **Feature toggles** below.

### Feature toggles

Build-time feature flags live in `src/config/feature-flags.ts`. Each flag is a
typed boolean that defaults OFF and can be enabled per build profile via its
`VITE_ENABLE_*` env var. Gate unfinished or unstable features here, then check
`isFeatureEnabled('<flag>')` at the call site to hide the UI. Currently
`geminiNano` gates "Enhance with AI" (Prompt Hub) and "Generate AI summary"
(Tab Manager), which depend on a Chrome browser setup that isn't yet stable.

`wxt.config.ts` reads these via `loadEnv()` and builds the manifest name
(`Notehublm Dev` vs `Notehublm`), `host_permissions`, and CSP `connect-src`
from the active profile, so dev and prod builds can be installed side-by-side
in Chrome without ID collision.

### Loading the extension in Chrome
1. `npm run dev` (dev profile) or `npm run build` (prod profile)
2. Open `chrome://extensions/` → enable Developer mode
3. Click **Load unpacked** → select `.output-dev/chrome-mv3/` for dev, or
   `.output/chrome-mv3/` for prod
4. After code changes in dev mode the extension auto-reloads; for the popup just close and reopen it

## Architecture

```
src/
├── adapters/
│   ├── adapter.interface.ts      ← ChatSiteAdapter (findHeaderAnchor, extractMessages, extractPrompts)
│   ├── adapter-registry.ts       ← getAdapter(hostname) — single place to register adapters
│   ├── chatgpt.adapter.ts
│   ├── claude.adapter.ts
│   ├── gemini.adapter.ts
│   ├── perplexity.adapter.ts
│   └── copilot.adapter.ts
├── content/
│   ├── selection-save.ts         ← Floating "Save snippet" button on text selection
│   └── header-injector.ts        ← "Export chat" + "Save prompts" buttons in page header
├── export/
│   ├── export-strategy.interface.ts  ← ExportStrategy (type, export(messages, filename))
│   └── markdown.export.ts            ← MarkdownExportStrategy: downloads .md, clipboard fallback
├── entrypoints/
│   ├── content.ts          ← Thin orchestrator: calls setupSelectionSave + setupHeaderButtons
│   └── popup/
│       ├── index.html
│       ├── main.tsx
│       └── App.tsx
├── components/
│   ├── SnippetList.tsx
│   └── SnippetItem.tsx
├── services/
│   └── storage-service.ts  ← All chrome.storage.local reads/writes (getAll, save, remove, clear)
├── utils/
│   └── dom.ts              ← waitForElement, onUrlChange (SPA navigation helper)
└── types/
    └── index.ts            ← Snippet, ChatMessage
```

### Key architectural decisions

**Adapter pattern** — Each LLM site has its own adapter implementing `ChatSiteAdapter`. The registry maps hostnames to adapters. Adding a new site means creating one new file and registering it in `adapter-registry.ts`; nothing else changes (Open/Closed principle).

**Export Strategy pattern** — `ExportStrategy` interface makes adding new formats (PDF, Google Docs) a matter of implementing a new class without modifying existing code. `MarkdownExportStrategy` downloads a `.md` file and falls back to clipboard on failure.

**Content script (`content.ts`)** — Thin orchestrator. Feature logic lives in `src/content/`. Uses vanilla TypeScript (no React) with shadow DOM so extension CSS is fully isolated from host pages.

**Header injection** — Buttons are appended to the adapter's `findHeaderAnchor()` element inside a shadow-DOM container. `onUrlChange()` watches for SPA navigation and re-injects after a settle delay. The marker ID `notehublm-header-buttons` prevents duplicate injection.

**Storage service** — Single module owning all `chrome.storage.local` access. Popup and content script both import it; no direct storage calls elsewhere.

### Supported LLM hosts
- chatgpt.com / chat.openai.com
- claude.ai
- gemini.google.com
- perplexity.ai
- copilot.microsoft.com

To add a new host: create `src/adapters/{site}.adapter.ts`, register it in `adapter-registry.ts`, and add the URL pattern to both `host_permissions` in `wxt.config.ts` and `matches` in `src/entrypoints/content.ts`.

### DOM selector maintenance
Each adapter's `findHeaderAnchor()` and `extractMessages()` target live DOM elements via CSS selectors. These sites update their UI regularly — if a feature stops working on a specific site, check that site's adapter file first.
