export async function openDashboard(): Promise<void> {
  try {
    const win = await chrome.windows.getCurrent();
    if (win.id != null) {
      await (chrome.sidePanel as unknown as {
        close: (opts: { windowId: number }) => Promise<void>;
      }).close({ windowId: win.id });
    }
  } catch {
    // older Chrome without sidePanel.close, or no current window — ignore
  }
  chrome.runtime.openOptionsPage();
}
