/**
 * @module studio-panel-enhancer
 * @description Injects an "Export notes" button into the NotebookLM Studio panel header via a shadow-DOM host. On click, it reads each note's content sequentially through the adapter (with progress shown in the button label), then delegates export to the user-selected format strategy from the format picker.
 * @dependencies @/utils/dom, @/adapters/studio-panel-adapter.interface, @/content/format-picker, @/export/export-registry, @/types
 * @public setupStudioPanelEnhancer
 */
import { onElementRemoved, onUrlChange } from '@/utils/dom';
import type { StudioPanelAdapter } from '@/adapters/studio-panel-adapter.interface';
import { showFormatPicker } from '@/content/format-picker';
import { exportStrategies } from '@/export/export-registry';
import type { ChatMessage, NoteRecord } from '@/types';
import enhancerHtml from './studio-panel-enhancer.html?raw';
import enhancerCss from './studio-panel-enhancer.css?raw';

const MARKER_ID = 'nlm-enhancer-studio-panel';

export function setupStudioPanelEnhancer(adapter: StudioPanelAdapter): void {
  tryInject(adapter);

  onUrlChange(() => {
    setTimeout(() => tryInject(adapter), 800);
  });
}

function tryInject(adapter: StudioPanelAdapter): void {
  if (document.getElementById(MARKER_ID)) return;

  const injectionPoint = adapter.findStudioPanelInjectionPoint();
  if (!injectionPoint) {
    setTimeout(() => tryInject(adapter), 500);
    return;
  }

  const host = document.createElement('div');
  host.id = MARKER_ID;
  // position:relative lets the format-picker panel (absolute) anchor to this container.
  host.style.cssText = 'all: initial; display: inline-flex; position: relative;';
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = enhancerCss;
  shadow.appendChild(style);

  const wrapper = document.createElement('div');
  wrapper.innerHTML = enhancerHtml;
  shadow.appendChild(wrapper.firstElementChild!);

  // Insert after the <nav> — between the "Studio" heading and the collapse button.
  injectionPoint.parentElement!.insertBefore(host, injectionPoint.nextSibling);

  wireExportButton(shadow, adapter);

  onElementRemoved(MARKER_ID, () => setTimeout(() => tryInject(adapter), 500));
}

function wireExportButton(shadow: ShadowRoot, adapter: StudioPanelAdapter): void {
  const exportBtn = shadow.querySelector<HTMLButtonElement>('#export-notes-btn')!;

  exportBtn.addEventListener('click', async () => {
    const noteItems = adapter.findNoteItems();
    if (noteItems.length === 0) {
      showFeedback(exportBtn, 'No notes found');
      return;
    }

    exportBtn.disabled = true;
    const result = await showFormatPicker(shadow, exportStrategies);
    exportBtn.disabled = false;

    if (!result) return;

    // Read each note sequentially, showing progress in the button label.
    const notes: NoteRecord[] = [];
    for (let i = 0; i < noteItems.length; i++) {
      exportBtn.textContent = `Reading ${i + 1} / ${noteItems.length}…`;
      exportBtn.disabled = true;
      notes.push(await adapter.readNoteContent(noteItems[i]));
    }

    const messages = buildNoteMessages(notes);
    if (messages.length === 0) {
      restoreBtn(exportBtn);
      showFeedback(exportBtn, 'Nothing to export');
      return;
    }

    const filename = `notes-${new Date().toISOString().slice(0, 10)}`;
    try {
      await result.strategy.export(messages, filename);
      restoreBtn(exportBtn);
      showFeedback(exportBtn, 'Exported!');
    } catch {
      restoreBtn(exportBtn);
      showFeedback(exportBtn, 'Export failed');
    }
  });
}

/**
 * Converts a list of NoteRecords into ChatMessage[] for use with existing
 * export strategies.  Each note becomes a 'system' message block rendered
 * without a role label — a neutral section in all export formats.
 *
 * Notes with no readable content still export their title as a placeholder
 * so the user knows the note exists even if the editor DOM wasn't accessible.
 */
function buildNoteMessages(notes: NoteRecord[]): ChatMessage[] {
  return notes
    .filter((n) => n.title)
    .map((n) => ({
      role: 'system' as const,
      content: n.content ? `${n.title}\n\n${n.content}` : `${n.title}\n\n(content unavailable — open note to view)`,
    }));
}

function restoreBtn(btn: HTMLButtonElement): void {
  btn.textContent = 'Export notes';
  btn.disabled = false;
}

function showFeedback(btn: HTMLButtonElement, message: string): void {
  btn.textContent = message;
  btn.disabled = true;
  setTimeout(() => restoreBtn(btn), 1800);
}