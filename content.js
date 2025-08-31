let lastHref = location.href;

function logIfChanged() {
  const currentHref = location.href;
  if (currentHref !== lastHref) {
    lastHref = currentHref;
    console.log("URL changed to:", currentHref);
  }
}

// Detect URL changes for SPA
const observer = new MutationObserver(() => {
  logIfChanged();
});
observer.observe(document, { childList: true, subtree: true });

// Fallback polling
setInterval(logIfChanged, 500);

// Respond to popup.js asking for current path
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "get-url") {
    const url = new URL(window.location.href);
    sendResponse({ pathname: url.pathname });
  }
});