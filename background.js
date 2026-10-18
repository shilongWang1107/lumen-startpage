/**
 * LUMEN · 光屿
 * A tiny service worker with two responsibilities:
 *  - Open the start page when the toolbar icon is clicked.
 *  - Welcome the user once after the extension is installed.
 *
 * No permissions are required for chrome.tabs.create().
 */

const START_PAGE = "index.html";

function openLumen() {
  chrome.tabs.create({ url: chrome.runtime.getURL(START_PAGE) });
}

chrome.action.onClicked.addListener(openLumen);

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    openLumen();
  }
});
