import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalWebsiteUrl,
  compileRules,
  findClosableTabIds,
  formatCountBadge,
  globToRegExp,
  isNewTabUrl,
  parseRules,
  tabDuplicateKey,
} from "../duplicate-tabs.js";

function rulesFor(...rules) {
  const { rules: compiled, errors } = compileRules(rules);
  assert.deepEqual(errors, []);
  return compiled;
}

test("canonicalWebsiteUrl removes fragments and preserves the rest of the URL", () => {
  assert.equal(
    canonicalWebsiteUrl("https://example.com/article?q=one#heading-name"),
    "https://example.com/article?q=one",
  );
  assert.equal(
    canonicalWebsiteUrl("https://example.com/article?q=two#heading-name"),
    "https://example.com/article?q=two",
  );
});

test("canonicalWebsiteUrl sorts query parameters", () => {
  assert.equal(
    canonicalWebsiteUrl("https://example.com/p?b=2&a=1"),
    canonicalWebsiteUrl("https://example.com/p?a=1&b=2"),
  );
  assert.equal(
    canonicalWebsiteUrl("https://example.com/p?"),
    "https://example.com/p",
  );
});

test("canonicalWebsiteUrl ignores non-web and invalid URLs", () => {
  assert.equal(canonicalWebsiteUrl("brave://settings"), null);
  assert.equal(canonicalWebsiteUrl("chrome-extension://abc/page.html"), null);
  assert.equal(canonicalWebsiteUrl("not a URL"), null);
});

test("findClosableTabIds treats a trailing slash as a duplicate", () => {
  const tabs = [
    { id: 1, url: "https://github.com/evinova/tenant-pipeline-bms-terminology" },
    { id: 2, url: "https://github.com/evinova/tenant-pipeline-bms-terminology/" },
    { id: 3, url: "https://github.com/" },
    { id: 4, url: "https://github.com" },
  ];

  assert.deepEqual(findClosableTabIds(tabs, 1), [2, 4]);
  assert.equal(
    tabDuplicateKey({ url: "https://example.com/docs/?a=1#top" }),
    tabDuplicateKey({ url: "https://example.com/docs?a=1" }),
  );
});

test("rule patterns see the trailing slash", () => {
  const rules = rulesFor({ match: "https://example.com/docs/*", ignoreParams: "*" });

  assert.equal(
    tabDuplicateKey({ url: "https://example.com/docs/?a=1" }, rules),
    "https://example.com/docs",
  );
});

test("findClosableTabIds treats fragment-only differences as duplicates", () => {
  const tabs = [
    { id: 1, url: "https://example.com/docs#first" },
    { id: 2, url: "https://example.com/docs#second" },
    { id: 3, url: "https://example.com/docs?mode=print#first" },
  ];

  assert.deepEqual(findClosableTabIds(tabs), [2]);
});

test("findClosableTabIds keeps the active tab in a duplicate group", () => {
  const tabs = [
    { id: 1, url: "https://example.com/#old" },
    { id: 2, url: "https://example.com/#current" },
    { id: 3, url: "https://example.com/#other" },
  ];

  assert.deepEqual(findClosableTabIds(tabs, 2), [1, 3]);
});

test("findClosableTabIds keeps a pinned tab when the active tab is unrelated", () => {
  const tabs = [
    { id: 1, url: "https://example.com/#first" },
    { id: 2, url: "https://example.com/#pinned", pinned: true },
    { id: 3, url: "https://other.example/", active: true },
  ];

  assert.deepEqual(findClosableTabIds(tabs, 3), [1]);
});

test("findClosableTabIds uses pendingUrl for a loading tab", () => {
  const tabs = [
    { id: 1, pendingUrl: "https://example.com/page#loading" },
    { id: 2, url: "https://example.com/page#loaded" },
  ];

  assert.deepEqual(findClosableTabIds(tabs), [2]);
});

test("isNewTabUrl recognizes New Tab pages and nothing else", () => {
  assert.ok(isNewTabUrl("chrome://newtab/"));
  assert.ok(isNewTabUrl("brave://newtab/"));
  assert.ok(isNewTabUrl("chrome://new-tab-page/"));
  assert.equal(isNewTabUrl("brave://settings/"), false);
  assert.equal(isNewTabUrl("https://newtab/"), false);
  assert.equal(isNewTabUrl(undefined), false);
});

test("findClosableTabIds closes every New Tab page except the active one", () => {
  const tabs = [
    { id: 1, url: "chrome://newtab/", title: "New Tab" },
    { id: 2, url: "chrome://newtab/", title: "New Tab" },
    { id: 3, pendingUrl: "chrome://newtab/" },
    { id: 4, url: "https://example.com/" },
  ];

  assert.deepEqual(findClosableTabIds(tabs, 2), [1, 3]);
  assert.deepEqual(findClosableTabIds([tabs[0]]), [1]);
});

test("findClosableTabIds keeps a pinned New Tab page", () => {
  const tabs = [
    { id: 1, url: "chrome://newtab/", pinned: true },
    { id: 2, url: "chrome://newtab/" },
  ];

  assert.deepEqual(findClosableTabIds(tabs), [2]);
});

test("globToRegExp treats only * as a wildcard", () => {
  const pattern = globToRegExp("http://127.0.0.1:*/oauth/callback*");

  assert.ok(pattern.test("http://127.0.0.1:55803/oauth/callback?code=eyJ"));
  assert.ok(pattern.test("http://127.0.0.1:1/oauth/callback"));
  // A * spans slashes, so a trailing one covers deeper paths as well as queries.
  assert.ok(pattern.test("http://127.0.0.1:1/oauth/callback/done"));
  assert.ok(!pattern.test("http://127.0.0.1:1/oauth/other"));
  assert.ok(!pattern.test("https://example.com/http://127.0.0.1:1/oauth/callback"));

  // ? and . are literal rather than regular expression metacharacters.
  const literals = globToRegExp("https://a.example/p?x=1");
  assert.ok(literals.test("https://a.example/p?x=1"));
  assert.ok(!literals.test("https://a.example/pAx=1"));
  assert.ok(!globToRegExp("https://a.example/*").test("https://aXexample/p"));
});

test("compileRules reports unusable rules without dropping the usable ones", () => {
  assert.deepEqual(compileRules({ match: "*" }), {
    rules: [],
    errors: ["Rules must be a JSON array."],
  });

  const { rules, errors } = compileRules([
    { match: "https://a.example/*" },
    { match: "" },
    { match: "https://b.example/*", ignoreParam: ["typo"] },
    { match: "https://c.example/*", ignorePort: "yes" },
    { match: "https://d.example/*", ignoreParams: [1] },
    "not an object",
  ]);

  assert.equal(rules.length, 1);
  assert.deepEqual(errors, [
    'Rule 2: "match" must be a non-empty string.',
    'Rule 3: unknown field "ignoreParam".',
    'Rule 4: "ignorePort" must be true or false.',
    'Rule 5: "ignoreParams" must be "*" or an array of parameter names.',
    "Rule 6: must be an object.",
  ]);
});

test("compileRules accepts an ignoreParams wildcard", () => {
  const { rules, errors } = compileRules([
    { match: "https://a.example/*", ignoreParams: "*" },
  ]);

  assert.deepEqual(errors, []);
  assert.equal(rules[0].ignoreAllParams, true);
});

test("a rule groups local OAuth callbacks on random ports by title", () => {
  const rules = rulesFor({
    match: "http://127.0.0.1:*/oauth/callback*",
    ignorePort: true,
    ignoreParams: "*",
    matchTitle: true,
  });
  const tabs = [
    {
      id: 1,
      url: "http://127.0.0.1:55803/oauth/callback?code=eyJhbGciOi",
      title: "Amazon Web Services Sign-In",
    },
    {
      id: 2,
      url: "http://127.0.0.1:54583/oauth/callback?code=eyJraWQiOi",
      title: "Amazon Web Services Sign-In",
    },
    {
      id: 3,
      url: "http://127.0.0.1:54999/oauth/callback?code=eyJ0eXAiOi",
      title: "Google Accounts",
    },
  ];

  assert.deepEqual(findClosableTabIds(tabs, undefined, rules), [2]);
});

test("a rule drops named parameters that differ between duplicates", () => {
  const rules = rulesFor({
    match: "https://*.console.aws.amazon.com/*",
    ignoreParams: ["warningMsg"],
  });
  const tabs = [
    { id: 1, url: "https://eu-west-1.console.aws.amazon.com/ec2/?warningMsg=abc" },
    { id: 2, url: "https://eu-west-1.console.aws.amazon.com/ec2/?warningMsg=def" },
    { id: 3, url: "https://eu-west-1.console.aws.amazon.com/s3/?warningMsg=abc" },
  ];

  assert.deepEqual(findClosableTabIds(tabs, undefined, rules), [2]);
});

test("matchTitle narrows a rule and never groups different origins or paths", () => {
  const rules = rulesFor({
    match: "http://127.0.0.1:*/*",
    ignorePort: true,
    ignoreParams: "*",
    matchTitle: true,
  });
  const tabs = [
    { id: 1, url: "http://127.0.0.1:3000/app", title: "Same Title" },
    { id: 2, url: "http://127.0.0.1:3000/other", title: "Same Title" },
    { id: 3, url: "http://localhost:3000/app", title: "Same Title" },
  ];

  assert.deepEqual(findClosableTabIds(tabs, undefined, rules), []);
});

test("a tab with no title yet stays out of every title-matched group", () => {
  const rules = rulesFor({
    match: "http://127.0.0.1:*/*",
    ignorePort: true,
    ignoreParams: "*",
    matchTitle: true,
  });
  const tabs = [
    { id: 1, url: "http://127.0.0.1:55803/oauth/callback?code=a" },
    { id: 2, url: "http://127.0.0.1:54583/oauth/callback?code=b" },
  ];

  assert.deepEqual(findClosableTabIds(tabs, undefined, rules), []);
  assert.equal(tabDuplicateKey(tabs[0], rules), null);
});

test("the first matching rule applies", () => {
  const rules = rulesFor(
    { match: "https://a.example/keep*", ignoreParams: ["one"] },
    { match: "https://a.example/*", ignoreParams: "*" },
  );

  assert.equal(
    tabDuplicateKey({ id: 1, url: "https://a.example/keep?one=1&two=2" }, rules),
    "https://a.example/keep?two=2",
  );
  assert.equal(
    tabDuplicateKey({ id: 2, url: "https://a.example/other?one=1&two=2" }, rules),
    "https://a.example/other",
  );
});

test("tabDuplicateKey leaves unmatched tabs on the plain canonical URL", () => {
  const rules = rulesFor({ match: "http://127.0.0.1:*/*", ignoreParams: "*" });

  assert.equal(
    tabDuplicateKey({ id: 1, url: "https://example.com/p?b=2&a=1#x" }, rules),
    "https://example.com/p?a=1&b=2",
  );
});

test("closeAlways closes every matching tab, including a lone one", () => {
  const rules = rulesFor({
    match: "http://127.0.0.1:*/oauth/callback*",
    closeAlways: true,
  });
  const tabs = [
    { id: 1, url: "http://127.0.0.1:55803/oauth/callback?code=a", title: "Sign-In" },
    { id: 2, url: "http://127.0.0.1:54583/oauth/callback?code=b", title: "Sign-In" },
    { id: 3, url: "http://127.0.0.1:3000/app", title: "Local App" },
  ];

  assert.deepEqual(findClosableTabIds(tabs, undefined, rules), [1, 2]);
  assert.deepEqual(findClosableTabIds([tabs[0]], undefined, rules), [1]);
  assert.equal(tabDuplicateKey(tabs[0], rules), null);
});

test("closeAlways spares neither the active tab nor a pinned tab", () => {
  const rules = rulesFor({ match: "https://a.example/dismiss*", closeAlways: true });
  const tabs = [
    { id: 1, url: "https://a.example/dismiss" },
    { id: 2, url: "https://a.example/dismiss", pinned: true },
  ];

  assert.deepEqual(findClosableTabIds(tabs, 1, rules), [1, 2]);
});

test("closeAlways counts a matching tab once", () => {
  const rules = rulesFor({ match: "https://a.example/*", closeAlways: true });
  const tabs = [
    { id: 1, url: "https://a.example/same" },
    { id: 2, url: "https://a.example/same" },
  ];

  assert.deepEqual(findClosableTabIds(tabs, undefined, rules), [1, 2]);
});

test("an earlier rule keeps a URL that a later closeAlways rule would close", () => {
  const rules = rulesFor(
    { match: "https://a.example/keep*", ignoreParams: ["noise"] },
    { match: "https://a.example/*", closeAlways: true },
  );
  const tabs = [
    { id: 1, url: "https://a.example/keep?noise=1" },
    { id: 2, url: "https://a.example/keep?noise=2" },
    { id: 3, url: "https://a.example/other" },
  ];

  assert.deepEqual(findClosableTabIds(tabs, undefined, rules), [3, 2]);
});

test("compileRules rejects closeAlways next to the comparison fields", () => {
  const { rules, errors } = compileRules([
    { match: "https://a.example/*", closeAlways: true, matchTitle: true },
    {
      match: "https://b.example/*",
      closeAlways: true,
      ignorePort: true,
      ignoreParams: "*",
    },
    { match: "https://c.example/*", closeAlways: "yes" },
    { match: "https://d.example/*", closeAlways: false, matchTitle: true },
  ]);

  assert.equal(rules.length, 1);
  assert.deepEqual(errors, [
    'Rule 1: "closeAlways" closes every match without comparing tabs, so ' +
      '"matchTitle" would do nothing. Remove it.',
    'Rule 2: "closeAlways" closes every match without comparing tabs, so ' +
      '"ignorePort", "ignoreParams" would do nothing. Remove them.',
    'Rule 3: "closeAlways" must be true or false.',
  ]);
});

test("parseRules reads rule text and reports bad JSON as one error", () => {
  const { rules, errors } = parseRules(
    '[{ "match": "http://127.0.0.1:*/oauth/callback*", "closeAlways": true }]',
  );

  assert.deepEqual(errors, []);
  assert.equal(rules.length, 1);
  assert.equal(rules[0].closeAlways, true);

  assert.deepEqual(parseRules("  ").errors, []);
  assert.deepEqual(parseRules("").rules, []);

  const broken = parseRules("[{ oops }]");
  assert.deepEqual(broken.rules, []);
  assert.equal(broken.errors.length, 1);
  assert.match(broken.errors[0], /^Not valid JSON: /);
});

test("parseRules accepts rule fields in any order", () => {
  const written = `[
  {
    "match": "http://127.0.0.1:*/oauth/callback*",
    "closeAlways": true
  }
]`;
  const reordered = `[
  {
    "closeAlways": true,
    "match": "http://127.0.0.1:*/oauth/callback*"
  }
]`;
  const tab = {
    id: 1,
    url: "http://127.0.0.1:49718/oauth/callback?code=eyJraWQiOi",
  };

  for (const text of [written, reordered]) {
    const { rules, errors } = parseRules(text);
    assert.deepEqual(errors, []);
    assert.deepEqual(findClosableTabIds([tab], undefined, rules), [1]);
  }
});

test("formatCountBadge hides zero and caps large counts", () => {
  assert.equal(formatCountBadge(0), "");
  assert.equal(formatCountBadge(7), "7");
  assert.equal(formatCountBadge(999), "999");
  assert.equal(formatCountBadge(1000), "999+");
});
