/**
 * @module screenshot
 * @description Type definitions for the Screenshot capture feature.
 * @dependencies none
 * @public CaptureMode, CaptureRecord, ScreenshotStore
 */

/** The four capture modes available in the screenshot strip. */
export type CaptureMode = 'scrollable' | 'visible' | 'selection' | 'element';

/** A single captured screenshot persisted in chrome.storage.local. */
export interface CaptureRecord {
  id: string;
  mode: CaptureMode;
  /** JPEG data URL produced after compressing the raw PNG from captureVisibleTab. */
  dataUrl: string;
  tabTitle: string;
  pageUrl: string;
  capturedAt: number; // Unix ms
}

/** Top-level shape stored under STORAGE_KEY in chrome.storage.local. */
export interface ScreenshotStore {
  /** Ordered newest-first. */
  captures: CaptureRecord[];
}
