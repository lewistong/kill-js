async function getJsSetting(url) {
  return new Promise((resolve) => {
    chrome.contentSettings.javascript.get({ primaryUrl: url }, (details) => {
      resolve(details ? details.setting : "allow");
    });
  });
}

async function updateTabState(tabId, url) {
  if (!url || !url.startsWith("http")) {
    chrome.action.setBadgeText({ text: "", tabId });
    chrome.action.setPopup({ tabId, popup: "" });
    return;
  }

  const setting = await getJsSetting(url);
  const blocked = setting === "block";

  if (blocked) {
    chrome.action.setBadgeBackgroundColor({ color: "#e64553", tabId });
    chrome.action.setBadgeText({ text: "OFF", tabId });
    chrome.action.setPopup({ tabId, popup: "popup.html" });
  } else {
    chrome.action.setBadgeText({ text: "", tabId });
    chrome.action.setPopup({ tabId, popup: "" });
  }
}

// One-click: disable JS for domain + reload
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.url || !tab.url.startsWith("http")) return;

  const { hostname, protocol } = new URL(tab.url);

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
