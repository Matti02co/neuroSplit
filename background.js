// background.js
// -----------------------------------------------------------------------------
// This is the extension's "service worker" — a tiny background script that
// Chrome wakes up when needed. Here it has exactly one job: make clicking the
// toolbar icon open the side panel.
// -----------------------------------------------------------------------------

// setPanelBehavior is a one-time setting. Running it on install is enough, but
// running it whenever the worker starts is harmless and guarantees it's set.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("Could not set side panel behavior:", error));
