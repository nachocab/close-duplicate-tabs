import { findDuplicateTabIds } from "./duplicate-tabs.js";

const COMMAND_NAME = "close-duplicate-tabs";

async function showResult(closedCount) {
  const text = closedCount > 0 ? String(closedCount) : "✓";
  const title =
    closedCount > 0
      ? `Closed ${closedCount} duplicate tab${closedCount === 1 ? "" : "s"}`
      : "No duplicate tabs found";

  await Promise.all([
    chrome.action.setBadgeBackgroundColor({ color: closedCount > 0 ? "#2563EB" : "#64748B" }),
    chrome.action.setBadgeText({ text }),
    chrome.action.setTitle({ title }),
  ]);

  setTimeout(() => {
    chrome.action.setBadgeText({ text: "" });
    chrome.action.setTitle({ title: "Close duplicate tabs" });
  }, 1800);
}

async function closeDuplicateTabs() {
  const [tabs, activeTabs] = await Promise.all([
    chrome.tabs.query({}),
    chrome.tabs.query({ active: true, lastFocusedWindow: true }),
  ]);
  const activeTabId = activeTabs[0]?.id;
  const duplicateIds = findDuplicateTabIds(tabs, activeTabId);

  if (duplicateIds.length > 0) await chrome.tabs.remove(duplicateIds);
  await showResult(duplicateIds.length);
}

chrome.commands.onCommand.addListener((command) => {
  if (command === COMMAND_NAME) void closeDuplicateTabs();
});

chrome.action.onClicked.addListener(() => {
  void closeDuplicateTabs();
});
