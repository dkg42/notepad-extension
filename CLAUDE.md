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

## Commands

```bash
npm install        # Install dependencies and run WXT prepare (via postinstall)
npm run dev        # Start dev server with HMR — load .output/chrome-mv3 in Chrome
npm run build      # Production build → .output/chrome-mv3/
npm run zip        # Build + zip for Chrome Web Store submission
npm run typecheck  # Type-check without emitting
```

### Loading the extension in Chrome
1. Run `npm run dev` (or `npm run build`)
2. Open `chrome://extensions/` → enable Developer mode
3. Click **Load unpacked** → select `.output/chrome-mv3/`
4. After code changes in dev mode the extension auto-reloads; for the popup just close and reopen it

## Architecture

```
src/
├── entrypoints/
│   ├── content.ts          # Content script injected into LLM chatbot pages
│   └── popup/
│       ├── index.html      # Popup shell
│       ├── main.tsx        # React root mount
│       └── App.tsx         # Popup root component
├── components/
│   ├── SnippetList.tsx     # Renders the list of saved snippets
│   └── SnippetItem.tsx     # Single snippet card (copy / delete)
├── services/
│   └── storage-service.ts  # All chrome.storage.local reads/writes
└── types/
    └── index.ts            # Shared TypeScript interfaces (Snippet)
```

### Key architectural decisions

**Content script (`content.ts`)** — Vanilla TypeScript, no React. Creates a shadow-DOM container so its CSS is fully isolated from the host page. Listens for `mouseup` to detect text selections; shows a floating **Save snippet** button anchored below the selection using `getBoundingClientRect()` (viewport coords → `position: fixed`). Saves via `storageService` and shows brief "Saved!" feedback.

**Storage service (`storage-service.ts`)** — Single module that owns all `chrome.storage.local` access. The popup and content script both import this; no direct storage calls elsewhere.

**Popup** — React + TypeScript. Loads all snippets on mount, updates local state optimistically on delete.

### Supported LLM hosts (declared in `wxt.config.ts` as `host_permissions`)
- chatgpt.com / chat.openai.com
- claude.ai
- gemini.google.com
- perplexity.ai
- copilot.microsoft.com

To add a new host, add its pattern to both `host_permissions` in `wxt.config.ts` **and** the `matches` array in `src/entrypoints/content.ts`.
