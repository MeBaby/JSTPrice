let panelWindow = null;
let panelBounds = { width: 400, height: 600 };

function getOptimalPosition() {
  return new Promise((resolve) => {
    chrome.windows.getCurrent(function(currentWindow) {
      if (!currentWindow) {
        resolve({ left: 100, top: 100 });
        return;
      }
      const screenWidth = currentWindow.width || 1920;
      const preferredLeft = screenWidth - panelBounds.width - 50;
      resolve({
        left: Math.max(50, preferredLeft),
        top: 80,
        width: panelBounds.width,
        height: panelBounds.height
      });
    });
  });
}

async function createPanel() {
  if (panelWindow) {
    try {
      chrome.windows.update(panelWindow.id, { focused: true });
    } catch (e) {
      panelWindow = null;
    }
    return;
  }

  try {
    const pos = await getOptimalPosition();

    chrome.windows.create({
      url: 'panel.html',
      type: 'popup',
      width: pos.width,
      height: pos.height,
      left: pos.left,
      top: pos.top,
      focused: true
    }, function(window) {
      if (window) {
        panelWindow = window;
        chrome.windows.update(window.id, { setAlwaysOnTop: true });
      }
    });
  } catch (e) {
    console.error('Create panel error:', e);
  }
}

chrome.windows.onRemoved.addListener(function(windowId) {
  if (panelWindow && panelWindow.id === windowId) {
    panelWindow = null;
  }
});

chrome.action.onClicked.addListener(function() {
  createPanel();
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'refreshData') {
    if (panelWindow) {
      try {
        chrome.windows.update(panelWindow.id, { focused: true });
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false });
      }
    }
  } else if (request.action === 'getPanelState') {
    sendResponse({ exists: !!panelWindow });
  }
});

chrome.runtime.onInstalled.addListener(function() {
  chrome.action.setIcon({
    path: {
      "16": "icon16.png",
      "48": "icon48.png",
      "128": "icon128.png"
    }
  });
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete' && panelWindow) {
    chrome.runtime.sendMessage({ action: 'tabUpdated', url: tab.url });
  }
});