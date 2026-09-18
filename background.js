import { findDuplicateTabIds, formatDuplicateCountBadge } from "./duplicate-tabs.js";

const COMMAND_NAME = "close-duplicate-tabs";
const BADGE_COLOR = "#DC2626";
const UPDATE_DELAY_MS = 100;

let updateTimer;
let refreshVersion = 0;

async function refreshDuplicateCount() {
  const version = ++refreshVersion;
  const tabs = await chrome.tabs.query({});
  const count = findDuplicateTabIds(tabs).length;

  if (version !== refreshVersion) return;

  await Promise.all([
    chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR }),
    chrome.action.setBadgeText({ text: formatDuplicateCountBadge(count) }),
    chrome.action.setTitle({
      title:
        count > 0
          ? `${count} duplicate tab${count === 1 ? "" : "s"} — click to close`
          : "No duplicate tabs",
    }),
  ]);
}

function runRefresh() {
  void refreshDuplicateCount().catch((error) => {
    console.error("Could not update duplicate tab count", error);
  });
}

function scheduleRefresh() {
  clearTimeout(updateTimer);
  updateTimer = setTimeout(runRefresh, UPDATE_DELAY_MS);
}

async function closeDuplicateTabs() {
  const [tabs, activeTabs] = await Promise.all([
    chrome.tabs.query({}),
    chrome.tabs.query({ active: true, lastFocusedWindow: true }),
  ]);
  const activeTabId = activeTabs[0]?.id;
  const duplicateIds = findDuplicateTabIds(tabs, activeTabId);

  if (duplicateIds.length > 0) await chrome.tabs.remove(duplicateIds);
  await refreshDuplicateCount();
}

chrome.commands.onCommand.addListener((command) => {
  if (command === COMMAND_NAME) {
    void closeDuplicateTabs().catch((error) => {
      console.error("Could not close duplicate tabs", error);
    });
  }
});

chrome.action.onClicked.addListener(() => {
  void closeDuplicateTabs().catch((error) => {
    console.error("Could not close duplicate tabs", error);
  });
});

chrome.tabs.onCreated.addListener(scheduleRefresh);
chrome.tabs.onRemoved.addListener(scheduleRefresh);
chrome.tabs.onReplaced.addListener(scheduleRefresh);
chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.url) scheduleRefresh();
});

chrome.runtime.onInstalled.addListener(runRefresh);
chrome.runtime.onStartup.addListener(runRefresh);

runRefresh();
