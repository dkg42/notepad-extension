import type { ClipboardEntry } from '@/types';

const TAG = '[clipboard-monitor]';

export function setupClipboardMonitor(): void {
  console.log(TAG, 'initialized on', location.href);
  document.addEventListener('copy', handleCopyEvent);
}

async function handleCopyEvent(e: ClipboardEvent): Promise<void> {
  console.log(TAG, 'copy event fired');

  if (!e.clipboardData) {
    console.warn(TAG, 'clipboardData is null — skipping');
    return;
  }

  const items = Array.from(e.clipboardData.items);
  const imageItem = items.find((item) => item.kind === 'file' && item.type.startsWith('image/'));

  if (imageItem) {
    const blob = imageItem.getAsFile();
    if (blob) {
      try {
        const thumbnailDataUrl = await createThumbnail(blob);
        sendToBackground({ type: 'image', thumbnailDataUrl, mimeType: imageItem.type, source: location.href });
      } catch (err) {
        console.error(TAG, 'thumbnail creation failed:', err);
      }
      return;
    }
  }

  const fromData = e.clipboardData.getData('text/plain').trim();
  const fromSelection = window.getSelection()?.toString().trim() ?? '';
  console.log(TAG, 'text sources:', { fromData, fromSelection });

  const text = fromData || fromSelection;
  if (text) {
    sendToBackground({ type: 'text', text, source: location.href });
  } else {
    console.warn(TAG, 'no text to save — both sources empty');
  }
}

function sendToBackground(entry: Omit<ClipboardEntry, 'id' | 'copiedAt'>): void {
  chrome.runtime.sendMessage({ type: 'CLIPBOARD_COPY', entry }).catch((err: unknown) => {
    console.error(TAG, 'sendMessage failed:', err);
  });
}

async function createThumbnail(blob: Blob): Promise<string> {
  const MAX_WIDTH = 280;
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, MAX_WIDTH / bitmap.width);
  const canvas = new OffscreenCanvas(
    Math.round(bitmap.width * scale),
    Math.round(bitmap.height * scale),
  );
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const thumbnailBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 });
  return blobToBase64(thumbnailBlob);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
