export function canonicalWebsiteUrl(rawUrl) {
  if (!rawUrl) return null;

  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;

    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

export function findDuplicateTabIds(tabs, activeTabId) {
  const groups = new Map();

  for (const tab of tabs) {
    if (!Number.isInteger(tab.id)) continue;

    const canonicalUrl = canonicalWebsiteUrl(tab.url ?? tab.pendingUrl);
    if (!canonicalUrl) continue;

    const group = groups.get(canonicalUrl) ?? [];
    group.push(tab);
    groups.set(canonicalUrl, group);
  }

  const duplicateIds = [];

  for (const group of groups.values()) {
    if (group.length < 2) continue;

    const keeper =
      group.find((tab) => tab.id === activeTabId) ??
      group.find((tab) => tab.pinned) ??
      group[0];

    for (const tab of group) {
      if (tab.id !== keeper.id) duplicateIds.push(tab.id);
    }
  }

  return duplicateIds;
}
