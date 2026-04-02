async function enable(pattern) {
  return new Promise((resolve) =>
    chrome.contentSettings.javascript.set({ primaryPattern: pattern, setting: "allow" }, resolve)
  );
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const content = document.getElementById("content");

  if (!tab || !tab.url || !tab.url.startsWith("http")) {
    content.innerHTML = '<div id="error">Not available on this page.</div>';
    return;
  }

  const { hostname } = new URL(tab.url);

  content.innerHTML = `
    <button id="btn-domain">
      <span class="btn-title">Re-enable for this domain</span>
      <span class="btn-sub">${hostname}</span>
    </button>
  `;

  document.getElementById("btn-domain").addEventListener("click", async () => {
    await Promise.all([
      enable(`https://${hostname}/*`),
      enable(`http://${hostname}/*`),
    ]);
    chrome.tabs.reload(tab.id);
    window.close();
  });
}

init();
