# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

- Notehublm is a Chrome extension (Manifest V3) that supercharges NotebookLM and
  enhances the experience of using LLM chatbots.
- Claude acts as a senior engineer on this project: production-ready code,
  no shortcuts, no half-wired features.
- Analyze the code and propose approaches before making changes.

## Repository status

This repository is **public and source-available** (see `LICENSE`). Treat
everything you write here as publicly readable:

- Never commit credentials, tokens, or filled-in `.env` files. Only
  `.env.example` is tracked.
- Never commit generated output (`.output/`, `.output-dev/`, `graphify-out/`)
  or machine-local config (`.claude/settings.local.json`).
- Keep `README.md`, `docs/ARCHITECTURE.md`, and `.env.example` in sync with code
  changes — new config values must be documented in all three places.

## Coding guidelines

- WXT as the extension framework, React 18 for UI, TypeScript throughout.
- Follow SOLID principles; the adapter and strategy registries exist so new
  sites and export formats are additive, not edits to existing files.
- `camelCase` for variables/functions, `PascalCase` for components/types,
  `kebab-case` for CSS selectors and DOM elements.
- **Separation of concerns per component**: a component is a folder containing
  its `.tsx` (markup + component logic) and `.css` (all styling). No inline
  styles; no component CSS in shared stylesheets.
- Use design tokens from `src/styles/tokens.css`. Never hard-code colors or
  spacing.
- Every non-component module gets a JSDoc header with `@module`,
  `@description`, `@dependencies`, `@public`. Keep `@public` accurate.
- Never call `chrome.storage.*` directly from a component — go through
  `src/services/storage/`.
- Gate unfinished or unstable features behind `src/config/feature-flags.ts`.

## Commands

```bash
npm install        # Install dependencies and run WXT prepare (via postinstall)
npm run dev        # Dev profile + HMR → .output-dev/chrome-mv3/
npm run build      # Prod profile build  → .output/chrome-mv3/
npm run build:dev  # Dev-profile production build (no HMR) for smoke-testing
npm run zip        # Prod build + zip for Chrome Web Store submission
npm run typecheck  # Type-check without emitting
```

There is no automated test suite. `npm run typecheck` and a manual pass through
the changed flow in a loaded build are the verification bar.

### Build profiles

`.env.development` and `.env.production` are **gitignored**. Create them locally
from `.env.example`, or use `.env.<mode>.local` overrides. Required keys are
documented in the README's configuration table.

`wxt.config.ts` reads these via `loadEnv()` and derives the output directory,
`host_permissions`, and CSP `connect-src` from the active profile, so dev and
prod builds install side by side in Chrome without ID collision.

### Loading the extension in Chrome

1. `npm run dev` (dev profile) or `npm run build` (prod profile)
2. Open `chrome://extensions/` → enable Developer mode
3. **Load unpacked** → `.output-dev/chrome-mv3/` (dev) or `.output/chrome-mv3/` (prod)
4. Dev mode auto-reloads on change; for the popup, close and reopen it

## Architecture

**Read `docs/ARCHITECTURE.md` before making structural changes.** It is the
authoritative description of execution contexts, message flow, the storage and
Drive-sync model, the auth flow, and the extension points.

Orientation summary:

```
src/
├── adapters/     Per-site DOM adapters + registry (hostname → adapter)
├── background/   Service-worker message handlers, split by domain
├── components/   React UI — dashboard/, sidebar/, shared/, ui/
├── content/      Content-script features (vanilla TS, shadow DOM)
├── config/       feature-flags.ts
├── contexts/     Navigation, Snippets, Subscription
├── export/       Export strategies + registries
├── hooks/        Shared React hooks
├── services/     Storage, auth, Drive sync, NotebookLM API, billing, pipelines
├── styles/       tokens.css
├── types/        Shared types (incl. messages.ts)
└── utils/        logger, dom, folder-utils, …
```

Five execution contexts: background service worker (`entrypoints/background.ts`,
the message-routing hub and the only context doing privileged work), side panel,
dashboard, content scripts, and an offscreen document hosting the auth iframe.
UI contexts are deliberately thin — no Firebase SDK imports, no direct storage
access; they message the background worker.

### Key invariants

- **Adapter pattern** — adding a site = new `src/adapters/<site>.adapter.ts` +
  one line in `adapter-registry.ts` + the URL pattern in both `host_permissions`
  (`wxt.config.ts`) and `matches` (`src/entrypoints/content.ts`).
- **Strategy pattern** — adding an export format = new class implementing
  `ExportStrategy`, registered in the registry. Do not edit existing strategies.
- **Storage is local-first, account-scoped.** `scoped-storage.ts` namespaces
  keys under `u:<uid>:`; it must not import from any other storage module
  (cycle risk). Drive AppData sync is cache-first on read, debounced-queue on
  write, and degrades to local-only on failure.
- **Auth goes through the offscreen document** because MV3 workers cannot open
  popups. `token-lifecycle-service` is the single entry point for obtaining a
  valid OAuth token.
- **Content scripts use shadow DOM** so extension CSS is fully isolated from
  host pages.

### Supported LLM hosts

chatgpt.com / chat.openai.com, claude.ai, gemini.google.com, www.perplexity.ai,
copilot.microsoft.com, chat.deepseek.com, chat.mistral.ai, grok.com, and
notebooklm.google.com (source + studio panel enhancements).

### Fragility to expect

- **NotebookLM has no public API.** `services/notebooklm-api.ts` calls the
  internal `batchexecute` endpoint with the user's own session. RPC ids and
  response shapes can change without notice.
- **Adapter selectors break.** `findHeaderAnchor()` and `extractMessages()`
  target live DOM. If a feature stops working on one site, check that site's
  adapter first.
- **SPA navigation** does not reload the page — use `onUrlChange` from
  `utils/dom.ts` and guard against duplicate injection with marker ids.
