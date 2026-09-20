# Architecture

Notehublm is a Manifest V3 Chrome extension built on [WXT](https://wxt.dev/)
with React 18 and TypeScript. This document describes how the pieces fit
together and the invariants worth preserving when changing them.

## Contents

- [Execution contexts](#execution-contexts)
- [Directory layout](#directory-layout)
- [Message flow](#message-flow)
- [Storage and sync](#storage-and-sync)
- [Authentication](#authentication)
- [NotebookLM integration](#notebooklm-integration)
- [Extension points](#extension-points)
- [Build configuration](#build-configuration)
- [Maintenance notes](#maintenance-notes)

## Execution contexts

MV3 splits an extension across several isolated JavaScript contexts. Notehublm
uses five, each with different capabilities:

| Context | Entry point | Role |
| --- | --- | --- |
| **Background service worker** | `src/entrypoints/background.ts` | The message-routing hub. Owns all privileged work: NotebookLM sync, Drive I/O, OAuth token lifecycle, pipeline evaluation, alarms. |
| **Side panel** | `src/entrypoints/sidepanel/` | The primary React UI — home, notebooks, prompt hub, snippets, tab manager, screenshots, chat history. |
| **Dashboard** | `src/entrypoints/dashboard/` | Full-page React app (also the `options_ui`) — the heavyweight views: all sources, analytics, pipelines, podcasts, settings. |
| **Content scripts** | `src/entrypoints/content.ts`, `capture-strip.content.ts`, `clipboard-monitor.content.ts` | Injected into pages. Vanilla TypeScript in shadow DOM. |
| **Offscreen document** | `src/entrypoints/offscreen/` | Hosts the auth iframe. Exists because a service worker cannot open a sign-in popup. |

The key consequence: **UI contexts are deliberately thin.** They do not import
the Firebase SDK and they do not touch `chrome.storage` directly. They send
messages to the background worker and read state back. This keeps Firebase out
of the UI bundle entirely and keeps privileged logic in one auditable place.

## Directory layout

```
src/
├── adapters/       Per-site integration
│   ├── adapter.interface.ts             ChatSiteAdapter contract
│   ├── source-panel-adapter.interface.ts  NotebookLM source panel capability
│   ├── studio-panel-adapter.interface.ts  NotebookLM studio panel capability
│   ├── adapter-registry.ts              hostname → adapter (single registration point)
│   └── <site>.adapter.ts                chatgpt, claude, gemini, perplexity,
│                                        copilot, deepseek, mistral, grok, notebooklm
│
├── background/     Service-worker message handlers, split by domain
│   └── audio-, chat-history-, drive-, import-, notebook-, pipeline-,
│       screenshot-, source-handler.ts
│
├── components/     React UI
│   ├── dashboard/  One folder per component (.tsx + .css)
│   ├── sidebar/    Side-panel views
│   ├── shared/     Used by both surfaces
│   └── ui/         Primitives
│
├── content/        Content-script features
│   ├── source-panel-enhancer/    NotebookLM source search + type filters
│   ├── studio-panel-enhancer/    "Export notes" in the studio panel
│   ├── source-export-modal/, source-delete-modal/
│   └── send-to-chat.ts, chat-save-handler.ts
│
├── config/         feature-flags.ts
├── contexts/       React context: Navigation, Snippets, Subscription
├── export/         Export strategies + registries
├── hooks/          useGlobalAudio, useKeyboardShortcuts, useUsageLimit, …
├── import/         csv-parser.ts
├── services/       All business logic (see below)
├── styles/         tokens.css — the design-token source of truth
├── types/          Shared TypeScript types
└── utils/          logger, dom, folder-utils, subscription, …
```

### The services layer

`src/services/` holds everything that is not UI. Roughly grouped:

| Group | Modules |
| --- | --- |
| **Storage** | `storage/scoped-storage.ts` (the base), plus per-domain stores: snippet, folder, tag, settings, podcast, export-history, recent-actions, onboarding |
| **Drive sync** | `drive/drive-sync-service.ts` (facade), `drive-io-service`, `drive-manifest-service`, `drive-cache-service`, `drive-write-queue`, `drive-init-service` |
| **Auth** | `auth-service` (UI facade), `auth-storage-service`, `firebase-app`, `firebase-token-service`, `firebase-claims-verifier`, `token-lifecycle-service`, `token-proxy-service`, `google-session-service` |
| **NotebookLM** | `notebooklm-api`, `notebook-sync-service`, `notebook-folder-service`, `notebook-annotation-service`, and the `*-cache-service` modules |
| **Automation** | `pipeline-service`, `pipeline-executor`, `pipeline-templates`, `domain-router-service`, `import-job-service` |
| **Ingestion** | `web-crawler-service`, `rss-parser-service`, `clipboard-session-service`, `tab-groups-*` |
| **Commercial** | `billing-service`, `usage-limit-service`, `daily-limit-service` |

Every module carries a JSDoc header with `@module`, `@description`,
`@dependencies`, and `@public`. Read those first — they are kept accurate and
are the fastest way to orient in an unfamiliar area.

## Message flow

Everything privileged goes through the background worker.

```
┌──────────────┐   chrome.runtime   ┌──────────────────┐
│  Side panel  │ ─────sendMessage──▶│                  │
│  Dashboard   │ ◀────response───── │   Background     │
└──────────────┘                    │  service worker  │
                                    │                  │
┌──────────────┐                    │  • routes by     │
│Content script│ ─────sendMessage──▶│    message type  │
└──────────────┘                    │  • delegates to  │
                                    │    background/   │
                                    │    *-handler.ts  │
                                    └────────┬─────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    ▼                        ▼                        ▼
            ┌───────────────┐      ┌──────────────────┐     ┌─────────────────┐
            │ chrome.storage│      │  NotebookLM      │     │  Google Drive   │
            │    .local     │      │  batchexecute    │     │    AppData      │
            └───────────────┘      └──────────────────┘     └─────────────────┘
```

Message types are defined in `src/types/messages.ts`. `background/shared.ts`
provides `isMessage` for narrowing and `ensureSignedIn` as an auth guard.
`background.ts` itself is a router; the real work lives in the per-domain
handlers so the worker file stays readable.

## Storage and sync

### Local first

`chrome.storage.local` is the source of truth for the running UI. Reads are
synchronous from the caller's perspective and never wait on the network.

### Account scoping

`scoped-storage.ts` namespaces every key under `u:<uid>:` so several signed-in
accounts can share a device without clobbering each other. Auth keys and a
small set of device-global keys bypass the prefix via an allowlist. When nobody
is signed in, keys land under `u:anon:` so the pre-auth content-script flow
still works.

> [!IMPORTANT]
> `scoped-storage.ts` must not import from any other storage module — that would
> create an import cycle. It is the bottom of the storage stack.

### Drive AppData

If the user grants Drive access, `drive-sync-service.ts` mirrors data into the
Google Drive **AppData** folder — a private, app-scoped area invisible in the
user's Drive UI and unreadable by other applications.

- **Reads** are cache-first: session cache hit returns immediately; on miss the
  file is fetched and the cache is populated.
- **Writes** are local-first: the cache updates synchronously, then a debounced
  write is enqueued through `drive-write-queue.ts`.

The UI is therefore never blocked by Drive API latency, and a failed sync
degrades to local-only rather than losing data.

## Authentication

Sign-in is unusual because MV3 service workers cannot open popups:

1. UI calls `authService` → sends a message to the background worker.
2. The worker creates an **offscreen document**.
3. The offscreen document embeds an **externally hosted sign-in page**
   (`VITE_EXTERNAL_AUTH_ORIGIN`) in a hidden iframe. That page can load Firebase
   Auth and open the Google sign-in popup.
4. The credential is relayed back via `postMessage` → offscreen →
   `AUTH_RESULT` message → background worker.
5. The worker signs in with `signInWithCustomToken`, verifies claims
   (`firebase-claims-verifier`), and writes the profile to storage.
6. `token-lifecycle-service` schedules a `chrome.alarms` refresh ahead of expiry
   and is the **single entry point** for any code that needs a valid access
   token. It deduplicates concurrent refreshes and handles `invalid_grant` by
   clearing auth state.

Billing runs through Firebase Callable Functions. The Dodo Payments API key is
held server-side; the client only ever receives a time-bound portal URL.

## NotebookLM integration

> [!WARNING]
> NotebookLM has no public API. `services/notebooklm-api.ts` calls the internal
> `batchexecute` RPC endpoint using the user's own signed-in session. This is
> the most fragile part of the codebase.

How it works: `google-session-service` extracts CSRF/session tokens from the
NotebookLM homepage (respecting account-specific `authuser` indices), then the
API module builds and parses `batchexecute` envelopes keyed by RPC id. Auth
failures invalidate the session cache and trigger exactly one automatic retry.

No credentials are proxied through or stored on any Notehublm server.

## Extension points

Two patterns carry the extensibility, both applications of the Open/Closed
principle — add a file, do not edit existing ones.

### Adding a chat site

1. Create `src/adapters/<site>.adapter.ts` implementing `ChatSiteAdapter`
   (`findHeaderAnchor`, `extractMessages`, `extractPrompts`).
2. Register the hostname in `adapter-registry.ts`.
3. Add the URL pattern to `host_permissions` in `wxt.config.ts` **and**
   `matches` in `src/entrypoints/content.ts`.

Nothing else changes. Adapters may additionally implement
`SourcePanelAdapter` or `StudioPanelAdapter`; `content.ts` feature-detects those
with `isSourcePanelAdapter` / `isStudioPanelAdapter` and wires the matching
enhancer.

### Adding an export format

Implement `ExportStrategy` (or `SourceExportStrategy`) in a new file under
`src/export/` and register it in the corresponding registry. Existing strategies
stay untouched. Current formats: Markdown, PDF, plain text, Google Docs.

## Build configuration

`wxt.config.ts` resolves the active mode from the `--mode` CLI flag, loads the
matching `.env.<mode>` via Vite's `loadEnv`, and derives from it:

- the output directory (`.output-dev/` vs `.output/`), so dev and production
  builds can be installed side by side without extension-ID collisions
- `host_permissions` and the CSP `connect-src` list, both of which must include
  the configured auth origin
- a hard failure if `VITE_EXTERNAL_AUTH_ORIGIN` is missing, rather than
  producing a silently broken build

### The jsPDF CDN workaround

jsPDF bakes a remote PDFObject CDN `<script>` loader into its
`output('pdfobjectnewwindow')` branch. Notehublm only calls `doc.save()`, so
that path is dead code — but the literal CDN URL survives bundling and trips the
Chrome Web Store's "remotely hosted code" static scan for MV3. The
`stripJsPdfRemoteCode` Vite plugin rewrites that URL to `about:blank` in the
final chunks so no remote-host reference remains.

## Maintenance notes

- **Site breakage is the normal failure mode.** Chat sites and NotebookLM
  redesign regularly. When a feature stops working on one site, check that
  site's adapter's CSS selectors first; when NotebookLM features break, check
  `notebooklm-api.ts` RPC ids.
- **SPA navigation** does not reload the page. `utils/dom.ts` provides
  `onUrlChange` to re-inject after a settle delay, and marker element ids
  prevent duplicate injection.
- **Shadow DOM everywhere in content scripts** — extension CSS must never leak
  into a host page, and host CSS must never affect injected UI.
- **Design tokens** live in `src/styles/tokens.css`. Use the variables; do not
  hard-code colors or spacing in component CSS.
- **Gate unstable work** behind `src/config/feature-flags.ts` rather than
  shipping it half-wired.
