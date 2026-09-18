import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalWebsiteUrl,
  findDuplicateTabIds,
  formatDuplicateCountBadge,
} from "../duplicate-tabs.js";

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

test("canonicalWebsiteUrl ignores non-web and invalid URLs", () => {
  assert.equal(canonicalWebsiteUrl("brave://settings"), null);
  assert.equal(canonicalWebsiteUrl("chrome-extension://abc/page.html"), null);
  assert.equal(canonicalWebsiteUrl("not a URL"), null);
});

test("findDuplicateTabIds treats fragment-only differences as duplicates", () => {
  const tabs = [
    { id: 1, url: "https://example.com/docs#first" },
    { id: 2, url: "https://example.com/docs#second" },
    { id: 3, url: "https://example.com/docs?mode=print#first" },
  ];

  assert.deepEqual(findDuplicateTabIds(tabs), [2]);
});

test("findDuplicateTabIds keeps the active tab in a duplicate group", () => {
  const tabs = [
    { id: 1, url: "https://example.com/#old" },
    { id: 2, url: "https://example.com/#current" },
    { id: 3, url: "https://example.com/#other" },
  ];

  assert.deepEqual(findDuplicateTabIds(tabs, 2), [1, 3]);
});

test("findDuplicateTabIds keeps a pinned tab when the active tab is unrelated", () => {
  const tabs = [
    { id: 1, url: "https://example.com/#first" },
    { id: 2, url: "https://example.com/#pinned", pinned: true },
    { id: 3, url: "https://other.example/", active: true },
  ];

  assert.deepEqual(findDuplicateTabIds(tabs, 3), [1]);
});

test("findDuplicateTabIds uses pendingUrl for a loading tab", () => {
  const tabs = [
    { id: 1, pendingUrl: "https://example.com/page#loading" },
    { id: 2, url: "https://example.com/page#loaded" },
  ];

  assert.deepEqual(findDuplicateTabIds(tabs), [2]);
});

test("formatDuplicateCountBadge hides zero and caps large counts", () => {
  assert.equal(formatDuplicateCountBadge(0), "");
  assert.equal(formatDuplicateCountBadge(7), "7");
  assert.equal(formatDuplicateCountBadge(999), "999");
  assert.equal(formatDuplicateCountBadge(1000), "999+");
});
