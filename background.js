import {
  findClosableTabIds,
  formatCountBadge,
  parseRules,
} from "./duplicate-tabs.js";
import { RULES_STORAGE_KEY, readRulesText } from "./rules-storage.js";

const COMMAND_NAME = "close-duplicate-tabs";
const BADGE_COLOR = "#DC2626";
const UPDATE_DELAY_MS = 100;

let updateTimer;
let refreshVersion = 0;
let compiledRulesPromise;

function loadCompiledRules() {
  compiledRulesPromise ??= (async () => {
    try {
      const { rules, errors } = parseRules(await readRulesText());

      for (const error of errors) {
        console.warn(`Skipping matching rule — ${error}`);
      }

      return rules;
    } catch (error) {
      console.error("Could not read matching rules", error);
      return [];
    }
  })();

  return compiledRulesPromise;
}

// The tab kept is the active tab of the last focused window, the same one a
// click or the shortcut acts from, so the badge matches what would be closed.
async function findClosableTabIdsNow() {
  const [tabs, activeTabs, rules] = await Promise.all([
    chrome.tabs.query({}),
    chrome.tabs.query({ active: true, lastFocusedWindow: true }),
    loadCompiledRules(),
  ]);
  return findClosableTabIds(tabs, activeTabs[0]?.id, rules);
}

async function refreshClosableCount() {
  const version = ++refreshVersion;
  const count = (await findClosableTabIdsNow()).length;

  if (version !== refreshVersion) return;

  await Promise.all([
    chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR }),
    chrome.action.setBadgeText({ text: formatCountBadge(count) }),
    chrome.action.setTitle({
      title:
        count > 0
          ? `${count} tab${count === 1 ? "" : "s"} to close — click to close ${count === 1 ? "it" : "them"}`
          : "No tabs to close",
    }),
  ]);
}

function runRefresh() {
  void refreshClosableCount().catch((error) => {
    console.error("Could not update the closable tab count", error);
  });
}

function scheduleRefresh() {
  clearTimeout(updateTimer);
  updateTimer = setTimeout(runRefresh, UPDATE_DELAY_MS);
}

async function closeTabs() {
  const closableIds = await findClosableTabIdsNow();

  if (closableIds.length > 0) await chrome.tabs.remove(closableIds);
  await refreshClosableCount();
}

chrome.commands.onCommand.addListener((command) => {
  if (command === COMMAND_NAME) {
    void closeTabs().catch((error) => {
      console.error("Could not close tabs", error);
    });
  }
});

chrome.action.onClicked.addListener(() => {
  void closeTabs().catch((error) => {
    console.error("Could not close tabs", error);
  });
});

chrome.tabs.onCreated.addListener(scheduleRefresh);
chrome.tabs.onRemoved.addListener(scheduleRefresh);
chrome.tabs.onReplaced.addListener(scheduleRefresh);
// The active tab is spared when it is a New Tab page, so switching tabs or
// windows can change the count.
chrome.tabs.onActivated.addListener(scheduleRefresh);
chrome.windows.onFocusChanged.addListener(scheduleRefresh);
chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  // A rule with "matchTitle" reads tab titles, so a title arriving late can
  // change the count on its own.
  if (changeInfo.url || changeInfo.title) scheduleRefresh();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && RULES_STORAGE_KEY in changes) {
    compiledRulesPromise = undefined;
    scheduleRefresh();
  }
});

chrome.runtime.onInstalled.addListener(runRefresh);
chrome.runtime.onStartup.addListener(runRefresh);

runRefresh();
