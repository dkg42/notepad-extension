/**
 * @module messages
 * @description Centralised registry of all chrome.runtime message type constants.
 *   Import MSG in any file that sends or handles chrome.runtime messages so
 *   string literals are never duplicated.  Background.ts dispatches on these
 *   in its onMessage handler.  Content scripts and popup pages send them.
 * @dependencies none
 * @public MSG, MsgType
 */

/**
 * All chrome.runtime.sendMessage type constants used across the extension.
 *
 * Grouped by functional domain to match the handler blocks in background.ts.
 * Offscreen ↔ background messages are listed under AUTH.
 * Content-script ↔ background messages are listed under CHAT_SYNC.
 *
 * Legacy hyphenated keys (firebase-auth etc.) are kept as-is to avoid
 * breaking the offscreen iframe contract — do not rename them.
 */
export const MSG = {
  // ── Google Drive ────────────────────────────────────────────────────────────
  /** Initialise Drive connection and fetch remote manifest */
  DRIVE_INITIALIZE: 'DRIVE_INITIALIZE',
  /** User chose keep-local or keep-remote for a detected conflict */
  DRIVE_RESOLVE_CONFLICT: 'DRIVE_RESOLVE_CONFLICT',

  // ── Notebooks ───────────────────────────────────────────────────────────────
  /** Pull latest notebook list from NotebookLM and persist locally */
  SYNC_NOTEBOOKS: 'SYNC_NOTEBOOKS',
  /** Return the source counts for each stored notebook */
  FETCH_SOURCE_COUNTS: 'FETCH_SOURCE_COUNTS',
  /** Return the lightweight source list for a notebook */
  FETCH_NOTEBOOK_SOURCES: 'FETCH_NOTEBOOK_SOURCES',
  /** Return the full source list with metadata for a notebook */
  FETCH_NOTEBOOK_SOURCES_DETAILED: 'FETCH_NOTEBOOK_SOURCES_DETAILED',
  /** Return notebook metadata + sources + notes in one payload */
  FETCH_NOTEBOOK_FULL_DATA: 'FETCH_NOTEBOOK_FULL_DATA',
  /** Trigger AI summarisation of a notebook */
  SUMMARIZE_NOTEBOOK: 'SUMMARIZE_NOTEBOOK',
  /** Delete a notebook and all its stored data */
  DELETE_NOTEBOOK: 'DELETE_NOTEBOOK',

  // ── Sources ─────────────────────────────────────────────────────────────────
  /** Return all sources across all notebooks */
  FETCH_ALL_SOURCES: 'FETCH_ALL_SOURCES',
  /** Add a URL as a new source to a notebook */
  ADD_SOURCE_URL: 'ADD_SOURCE_URL',
  /** Delete a single source from a notebook */
  DELETE_SOURCE: 'DELETE_SOURCE',
  /** Delete every source from a notebook */
  DELETE_ALL_SOURCES: 'DELETE_ALL_SOURCES',
  /** Bulk-add multiple sources (from CSV / RSS / browser tabs) */
  BULK_ADD_SOURCES: 'BULK_ADD_SOURCES',

  // ── Audio / Artifacts ───────────────────────────────────────────────────────
  /** Trigger generation of an Audio Overview for a notebook */
  CREATE_AUDIO_OVERVIEW: 'CREATE_AUDIO_OVERVIEW',
  /** Return all stored audio artifacts */
  FETCH_ALL_ARTIFACTS: 'FETCH_ALL_ARTIFACTS',
  /** List artifacts for a specific notebook */
  LIST_ARTIFACTS: 'LIST_ARTIFACTS',
  /** Fetch and decode a podcast episode audio for the in-extension player */
  FETCH_AUDIO_FOR_PLAYBACK: 'FETCH_AUDIO_FOR_PLAYBACK',
  /** Clear the decoded audio blob cache in the service worker */
  CLEAR_AUDIO_CACHE: 'CLEAR_AUDIO_CACHE',

  // ── Notebook Notes ──────────────────────────────────────────────────────────
  /** Return the notes/annotations stored for a notebook */
  FETCH_NOTEBOOK_NOTES: 'FETCH_NOTEBOOK_NOTES',

  // ── Chat History (manual save) ───────────────────────────────────────────────
  /** Sidebar → background: get info about the currently open LLM chat */
  GET_CURRENT_CHAT_INFO: 'GET_CURRENT_CHAT_INFO',
  /** Background → content script: extract current chat info from the DOM */
  EXTRACT_CURRENT_CHAT_INFO: 'EXTRACT_CURRENT_CHAT_INFO',
  /** Sidebar → background: persist a manually saved conversation */
  SAVE_CURRENT_CHAT: 'SAVE_CURRENT_CHAT',
  /** Popup → background: return all stored conversations */
  GET_CHAT_CONVERSATIONS: 'GET_CHAT_CONVERSATIONS',
  /** Popup → background: return full message list for one conversation */
  GET_CHAT_CONVERSATION_CONTENT: 'GET_CHAT_CONVERSATION_CONTENT',

  // ── Import Jobs ─────────────────────────────────────────────────────────────
  /** Return the progress/status of the active import job */
  GET_IMPORT_JOB_PROGRESS: 'GET_IMPORT_JOB_PROGRESS',
  /** Abort the active import job */
  CANCEL_IMPORT_JOB: 'CANCEL_IMPORT_JOB',
  /** Crawl a URL and return its text content */
  CRAWL_URL: 'CRAWL_URL',
  /** Fetch and parse an RSS feed, returning its entries */
  FETCH_RSS_FEED: 'FETCH_RSS_FEED',
  /** Return the list of open browser tabs (for tab-import flow) */
  GET_BROWSER_TABS: 'GET_BROWSER_TABS',

  // ── Pipelines ───────────────────────────────────────────────────────────────
  /** Return all stored pipelines */
  GET_PIPELINES: 'GET_PIPELINES',
  /** Persist a new or updated pipeline */
  SAVE_PIPELINE: 'SAVE_PIPELINE',
  /** Delete a pipeline by id */
  DELETE_PIPELINE: 'DELETE_PIPELINE',
  /** Enable or disable a pipeline by id */
  TOGGLE_PIPELINE: 'TOGGLE_PIPELINE',
  /** Return the run history log for all pipelines */
  GET_PIPELINE_RUNS: 'GET_PIPELINE_RUNS',
  /** Clear the pipeline run history */
  CLEAR_PIPELINE_RUNS: 'CLEAR_PIPELINE_RUNS',
  /** Immediately execute a pipeline outside its schedule */
  RUN_PIPELINE_NOW: 'RUN_PIPELINE_NOW',

  // ── Clipboard Monitor ───────────────────────────────────────────────────────
  /** Content script → background: store a clipboard copy event */
  CLIPBOARD_COPY: 'CLIPBOARD_COPY',

  // ── Prompt Hub / Send-to-Chat ───────────────────────────────────────────────
  /** Sidebar → content script: inject a prompt into the active chat input */
  SEND_TO_CHAT: 'SEND_TO_CHAT',

  // ── Auth ────────────────────────────────────────────────────────────────────
  /** Background → UI: the current token is expired and user must re-login */
  REAUTH_REQUIRED: 'REAUTH_REQUIRED',
  /** Offscreen → background: sign-out flow result */
  SIGN_OUT_RESULT: 'SIGN_OUT_RESULT',
  /** Offscreen → background: Firebase sign-in result */
  AUTH_RESULT: 'AUTH_RESULT',
  /** Background → UI: local data was migrated after account switch */
  LOCAL_DATA_MIGRATED: 'local-data-migrated',

  // ── Session ─────────────────────────────────────────────────────────────────
  /** Request background to ensure a valid Google session cookie exists */
  ENSURE_GOOGLE_SESSION: 'ensure-google-session',

  // ── Offscreen (legacy hyphenated — do not rename) ───────────────────────────
  /** Background → offscreen: trigger Firebase sign-in via iframe */
  FIREBASE_AUTH: 'firebase-auth',
  /** Background → offscreen: trigger Firebase sign-out via iframe */
  FIREBASE_SIGN_OUT: 'firebase-sign-out',

  // ── Screenshot ───────────────────────────────────────────────────────────────
  /** Sidebar → background: start capture mode; background injects the content strip */
  START_CAPTURE_MODE: 'START_CAPTURE_MODE',
  /** Background → content script: show the compact capture strip on the page */
  SHOW_CAPTURE_STRIP: 'SHOW_CAPTURE_STRIP',
  /** Content script → background: take the actual screenshot (only background can call captureVisibleTab) */
  DO_CAPTURE: 'DO_CAPTURE',
  /** Content script → background: user exited the strip; reopen the sidebar */
  CAPTURE_STRIP_CLOSED: 'CAPTURE_STRIP_CLOSED',
  /** Sidebar → background: fetch the persisted screenshot store */
  GET_SCREENSHOT_STORE: 'GET_SCREENSHOT_STORE',
  /** Sidebar → background: delete a stored capture by id */
  DELETE_CAPTURE: 'DELETE_CAPTURE',
} as const;

/** Union of all valid message type strings. */
export type MsgType = (typeof MSG)[keyof typeof MSG];
