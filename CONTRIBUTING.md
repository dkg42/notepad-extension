# Contributing to Notehublm

Thanks for taking the time to look at the code. This document covers how to get
set up, the conventions the codebase follows, and what makes a pull request easy
to merge.

> [!IMPORTANT]
> Notehublm is **source-available, not open source** ([LICENSE](./LICENSE)). By
> submitting a contribution you grant the copyright holder a perpetual,
> worldwide, royalty-free license to use it as part of this software. If you are
> not comfortable with that, please open an issue rather than a pull request.

## Getting set up

See [README → Installing from source](./README.md#installing-from-source). In
short:

```bash
npm install
cp .env.example .env.development.local   # fill in your own Firebase values
npm run dev
```

Load `.output-dev/chrome-mv3/` via **Load unpacked** at `chrome://extensions/`.

You will need your own Firebase project and Cloud Functions deployment — the
backend is not part of this repository. Features that do not touch auth (export
strategies, adapters, most UI work) can be developed without a full backend.

## Before you open a pull request

Run these locally. CI runs the same checks.

```bash
npm run typecheck   # must pass with zero errors
npm run build       # must complete
```

Then load the built extension and exercise the flow you changed. There is no
automated test suite yet, so manual verification is the bar — say in the PR
description what you actually clicked through.

## Conventions

These are enforced by review, not by a linter, so please follow them closely.

### Component structure

A component is a **folder** containing up to three files, one per concern:

```
src/components/dashboard/NotebooksPage/
├── NotebooksPage.tsx    ← JSX and component logic
└── NotebooksPage.css    ← all styling for this component
```

Do not inline styles, and do not put a component's CSS in a shared stylesheet.
Shared design tokens live in `src/styles/tokens.css` — use those variables
rather than hard-coded colors or spacing.

### Naming

- **Variables, functions, props** — `camelCase`
- **Components, types, interfaces** — `PascalCase`
- **Files** — match the component name (`NotebooksPage.tsx`), or `kebab-case`
  for non-component modules (`drive-sync-service.ts`)
- **CSS selectors, HTML elements, DOM ids** — `kebab-case`

### Module headers

Every non-component module starts with a JSDoc block. Match the existing style:

```ts
/**
 * @module pipeline-service
 * @description CRUD and run-log persistence for automation pipeline rules. …
 * @dependencies token-lifecycle-service, drive/drive-sync-service
 * @public pipelineService
 */
```

Keep `@public` accurate — it is how readers find a module's entry points.

### Architecture rules

- **Storage access goes through a service.** Never call `chrome.storage.*`
  directly from a component. Use the modules in `src/services/storage/`.
- **Adding a site** means adding `src/adapters/<site>.adapter.ts`, registering it
  in `adapter-registry.ts`, and adding the URL pattern to both `host_permissions`
  in `wxt.config.ts` and `matches` in `src/entrypoints/content.ts`. Nothing else
  should need to change.
- **Adding an export format** means implementing `ExportStrategy` in a new file
  and registering it. Do not edit existing strategies.
- **Content scripts use vanilla TypeScript and shadow DOM**, not React, so
  extension CSS cannot leak into or be affected by the host page.
- **Gate unfinished features** behind a flag in `src/config/feature-flags.ts`
  rather than leaving them half-wired or commented out.

### Secrets

Never commit a filled-in `.env` file. If you add a new configuration value, add
it to `.env.example` with an empty value and a comment, and document it in the
README's configuration table.

## Commit messages

Short, imperative, and specific about the user-visible effect:

```
Add RSS feed import with per-item source mapping
Fix source panel filter losing state on SPA navigation
```

## Pull requests

- One logical change per PR. Split refactors away from behavior changes.
- Target `main`.
- Describe **what** changed, **why**, and **how you verified it**.
- Include a screenshot or short clip for any UI change.
- Call out anything that touches auth, billing, storage schemas, or Drive sync —
  those get a closer review.

## Reporting bugs

Open an issue with:

- What you expected versus what happened
- Steps to reproduce
- Browser and version, extension version, and which site it happened on
- Relevant console output from the service worker (`chrome://extensions/` →
  **Inspect views: service worker**)

If a feature broke on one specific site, it is very likely a DOM selector change
in that site's adapter — mentioning the site up front speeds up the fix.

## Security issues

Do not open a public issue. See [SECURITY.md](./SECURITY.md).
