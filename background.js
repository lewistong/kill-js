async function getJsSetting(url) {
  return new Promise((resolve) => {
    chrome.contentSettings.javascript.get({ primaryUrl: url }, (details) => {
      resolve(details ? details.setting : "allow");
    });
  });
}

async function getSessionAllowed() {
  const { sessionAllowed = {} } = await chrome.storage.session.get("sessionAllowed");
  return sessionAllowed;
}

async function setSessionAllowed(sessionAllowed) {
  await chrome.storage.session.set({ sessionAllowed });
}

async function blockDomain(hostname) {
  await Promise.all([
    new Promise((resolve) =>
      chrome.contentSettings.javascript.set(
        { primaryPattern: `https://${hostname}/*`, setting: "block" },
        resolve
      )
    ),
    new Promise((resolve) =>
      chrome.contentSettings.javascript.set(
        { primaryPattern: `http://${hostname}/*`, setting: "block" },
        resolve
      )
    ),
  ]);
}

async function updateTabState(tabId, url) {
  if (!url || !url.startsWith("http")) {
    chrome.action.setBadgeText({ text: "", tabId });
    chrome.action.setPopup({ tabId, popup: "" });
    return;
  }

  const { hostname } = new URL(url);
  const setting = await getJsSetting(url);
  const blocked = setting === "block";

  if (blocked) {
    chrome.action.setBadgeBackgroundColor({ color: "#e64553", tabId });
    chrome.action.setBadgeText({ text: "OFF", tabId });
    chrome.action.setPopup({ tabId, popup: "popup.html" });
  } else {
    const sessionAllowed = await getSessionAllowed();
    const isSessionTab = (sessionAllowed[hostname] || []).includes(tabId);

    if (isSessionTab) {
      chrome.action.setBadgeBackgroundColor({ color: "#f9a825", tabId });
      chrome.action.setBadgeText({ text: "TAB", tabId });
    } else {
      chrome.action.setBadgeText({ text: "", tabId });
    }
    chrome.action.setPopup({ tabId, popup: "" });
  }
}

// One-click: disable JS for domain + reload
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.url || !tab.url.startsWith("http")) return;

  const { hostname } = new URL(tab.url);

  // Clear any session entries for this domain
  const sessionAllowed = await getSessionAllowed();
  if (sessionAllowed[hostname]) {
    delete sessionAllowed[hostname];
    await setSessionAllowed(sessionAllowed);
  }

  await blockDomain(hostname);
  chrome.tabs.reload(tab.id);
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  updateTabState(tabId, tab.url);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    updateTabState(tabId, tab.url);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const sessionAllowed = await getSessionAllowed();
  let changed = false;

  for (const [hostname, tabIds] of Object.entries(sessionAllowed)) {
    if (!tabIds.includes(tabId)) continue;

    changed = true;
    const remaining = tabIds.filter((id) => id !== tabId);

    if (remaining.length === 0) {
      await blockDomain(hostname);
      delete sessionAllowed[hostname];
    } else {
      sessionAllowed[hostname] = remaining;
    }
    break; // a tabId can only belong to one hostname
  }

  if (changed) await setSessionAllowed(sessionAllowed);
});
