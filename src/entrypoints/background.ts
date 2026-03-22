import { defineBackground } from 'wxt/sandbox';
import { fetchNotebooks } from '@/services/notebooklm-api';
import { notebookSyncService } from '@/services/notebook-sync-service';

const ALARM_NAME = 'notebooklm-sync';
const SYNC_INTERVAL_MINUTES = 30;

async function syncNotebooks(): Promise<void> {
  try {
    const notebooks = await fetchNotebooks();
    if (notebooks.length > 0) {
      await notebookSyncService.upsertMany(notebooks);
    }
    await notebookSyncService.setSyncMeta({ lastSyncedAt: Date.now() });
  } catch (error) {
    await notebookSyncService.setSyncMeta({
      lastSyncedAt: Date.now(),
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function isMessage(value: unknown): value is { type: string } {
  return typeof value === 'object' && value !== null && 'type' in value;
}

export default defineBackground(() => {
  // Sync on extension install / update
  chrome.runtime.onInstalled.addListener(() => {
    void syncNotebooks();
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: SYNC_INTERVAL_MINUTES });
  });

  // Sync on browser startup
  chrome.runtime.onStartup.addListener(() => {
    void syncNotebooks();
  });

  // Periodic sync via alarms
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
      void syncNotebooks();
    }
  });

  // Manual sync triggered from dashboard
  chrome.runtime.onMessage.addListener(
    (message: unknown, _sender, sendResponse: (r: unknown) => void) => {
      if (!isMessage(message)) return false;
      if (message.type === 'SYNC_NOTEBOOKS') {
        syncNotebooks().then(() => sendResponse({ ok: true }));
        return true; // keep channel open for async
      }
      return false;
    },
  );
});
