// Background script - handles dynamic script injection for blocked sites
chrome.runtime.onInstalled.addListener(() => {
  // Set default settings if not set
  chrome.storage.sync.get(["blockedSites", "difficulty"], (data) => {
    if (!data.blockedSites) {
      chrome.storage.sync.set({ blockedSites: ["youtube.com", "facebook.com", "instagram.com", "linkedin.com"] });
    }
    if (!data.difficulty) {
      chrome.storage.sync.set({ difficulty: "easy" });
    }
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url) {
    chrome.storage.sync.get(["blockedSites"], (data) => {
      const blockedSites = data.blockedSites || [];
      const url = new URL(tab.url);
      if (blockedSites.some(site => url.hostname.includes(site))) {
        chrome.scripting.executeScript({
          target: { tabId },
          files: ["challenge.js"]
        });
      }
    });
  }
});