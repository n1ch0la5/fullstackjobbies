// Right-click any selected job text, anywhere (LinkedIn, Indeed, email…), to rate it.
// Uses activeTab, so it only touches the page you're on, and only when you click.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'fsj-rate-selection',
    title: 'Rate this job with Full Stack Jobbies',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'fsj-rate-selection' || !tab?.id) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [String(info.selectionText ?? '').slice(0, 30000)],
      func: async (text) => {
        const { showBadge } = await import(chrome.runtime.getURL('badge.js'));
        const title = text.trim().split('\n')[0].slice(0, 140);
        showBadge({ title, text }, { from: 'selection' });
      },
    });
  } catch {
    // Some pages (the Chrome Web Store, chrome:// pages) don't allow extensions. The popup still works there.
    chrome.action.openPopup?.();
  }
});

// The card on a job page asks for the preferences page; content scripts can't open it themselves.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'open-options') chrome.runtime.openOptionsPage();
});
