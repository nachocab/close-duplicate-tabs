const COMPARE_KEYS = ["ignorePort", "ignoreParams", "matchTitle"];
const RULE_KEYS = new Set(["match", "closeAlways", ...COMPARE_KEYS]);
const GLOB_SPECIALS = /[.*+?^${}()|[\]\\]/g;

export function canonicalWebsiteUrl(rawUrl) {
  if (!rawUrl) return null;

  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;

    url.hash = "";
    // Query order carries no meaning for the pages people open twice, so sorting
    // makes ?a=1&b=2 and ?b=2&a=1 land in the same group.
    url.searchParams.sort();
    return url.href;
  } catch {
    return null;
  }
}

// `*` is the only metacharacter, so a pattern can be pasted from an address bar
// without escaping anything.
export function globToRegExp(pattern) {
  const source = pattern
    .split("*")
    .map((part) => part.replace(GLOB_SPECIALS, "\\$&"))
    .join(".*");
  return new RegExp(`^${source}$`, "i");
}

export function parseRules(text) {
  const trimmed = text.trim();
  if (trimmed === "") return { rules: [], errors: [] };

  let parsed;

  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    return { rules: [], errors: [`Not valid JSON: ${error.message}`] };
  }

  return compileRules(parsed);
}

export function compileRules(rules) {
  const errors = [];

  if (!Array.isArray(rules)) {
    return { rules: [], errors: ["Rules must be a JSON array."] };
  }

  const compiled = [];

  rules.forEach((rule, index) => {
    const label = `Rule ${index + 1}`;
    const fail = (message) => errors.push(`${label}: ${message}`);

    if (rule === null || typeof rule !== "object" || Array.isArray(rule)) {
      fail("must be an object.");
      return;
    }

    for (const key of Object.keys(rule)) {
      if (!RULE_KEYS.has(key)) {
        fail(`unknown field "${key}".`);
        return;
      }
    }

    if (typeof rule.match !== "string" || rule.match === "") {
      fail('"match" must be a non-empty string.');
      return;
    }

    for (const key of ["ignorePort", "matchTitle", "closeAlways"]) {
      if (key in rule && typeof rule[key] !== "boolean") {
        fail(`"${key}" must be true or false.`);
        return;
      }
    }

    if (rule.closeAlways === true) {
      const unused = COMPARE_KEYS.filter((key) => key in rule);

      if (unused.length > 0) {
        fail(
          `"closeAlways" closes every match without comparing tabs, so ` +
            `${unused.map((key) => `"${key}"`).join(", ")} would do nothing. ` +
            `Remove ${unused.length === 1 ? "it" : "them"}.`,
        );
        return;
      }

      compiled.push({ pattern: globToRegExp(rule.match), closeAlways: true });
      return;
    }

    const ignoreParams = rule.ignoreParams ?? [];
    const ignoreAllParams = ignoreParams === "*";

    if (
      !ignoreAllParams &&
      (!Array.isArray(ignoreParams) ||
        ignoreParams.some((name) => typeof name !== "string"))
    ) {
      fail('"ignoreParams" must be "*" or an array of parameter names.');
      return;
    }

    compiled.push({
      pattern: globToRegExp(rule.match),
      closeAlways: false,
      ignorePort: rule.ignorePort === true,
      ignoreAllParams,
      ignoreParams: ignoreAllParams ? [] : ignoreParams,
      matchTitle: rule.matchTitle === true,
    });
  });

  return { rules: compiled, errors };
}

function classifyTab(tab, rules) {
  const canonicalUrl = canonicalWebsiteUrl(tab.url ?? tab.pendingUrl);
  if (!canonicalUrl) return { closeAlways: false, key: null };

  const rule = rules.find((candidate) => candidate.pattern.test(canonicalUrl));
  if (!rule) return { closeAlways: false, key: canonicalUrl };
  if (rule.closeAlways) return { closeAlways: true, key: null };

  const url = new URL(canonicalUrl);
  if (rule.ignorePort) url.port = "";

  if (rule.ignoreAllParams) url.search = "";
  else for (const name of rule.ignoreParams) url.searchParams.delete(name);

  if (!rule.matchTitle) return { closeAlways: false, key: url.href };

  // A title joins the key rather than replacing the URL, so a rule can loosen a
  // port or a parameter but can never group two different origins or paths. A
  // tab that has not reported a title yet stays out of every group.
  const title = tab.title ?? "";
  return {
    closeAlways: false,
    key: title === "" ? null : `${url.href}\n${title}`,
  };
}

// The value two tabs must share to count as duplicates, or null for a tab that
// no group can contain.
export function tabDuplicateKey(tab, rules = []) {
  return classifyTab(tab, rules).key;
}

export function findClosableTabIds(tabs, activeTabId, rules = []) {
  const closableIds = [];
  const groups = new Map();

  for (const tab of tabs) {
    if (!Number.isInteger(tab.id)) continue;

    const { closeAlways, key } = classifyTab(tab, rules);

    if (closeAlways) {
      closableIds.push(tab.id);
      continue;
    }

    if (!key) continue;

    const group = groups.get(key) ?? [];
    group.push(tab);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue;

    const keeper =
      group.find((tab) => tab.id === activeTabId) ??
      group.find((tab) => tab.pinned) ??
      group[0];

    for (const tab of group) {
      if (tab.id !== keeper.id) closableIds.push(tab.id);
    }
  }

  return closableIds;
}

export function formatCountBadge(count) {
  if (count < 1) return "";
  return count > 999 ? "999+" : String(count);
}
