# Close Duplicate Tabs

![Close Duplicate Tabs icon](icons/icon-128.png)

A tiny Manifest V3 extension for Brave and other Chromium browsers. It closes duplicate website tabs across all browser windows and treats URLs that differ only by their `#fragment`, or by the order of their query parameters, as duplicates.

For example, these count as the same page:

- `https://example.com/docs#introduction`
- `https://example.com/docs#installation`
- `https://example.com/docs?a=1&b=2` and `https://example.com/docs?b=2&a=1`

Query values still matter, so `https://example.com/docs?lang=en` and `https://example.com/docs?lang=es` are not duplicates. To loosen that for specific URLs, see [Matching rules](#matching-rules).

## Install in Brave

1. Open `brave://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder.

The extension icon shows the number of tabs that would be closed. Click the icon to close them, or press `Ctrl+Shift+D`—on macOS that is `Control+Shift+D`, not `Command+Shift+D`, because Brave keeps `Command+Shift+D` for its own **Bookmark all tabs** command. Within a group of duplicates the currently active tab is kept; otherwise a pinned tab is kept, then the first matching tab.

Empty **New Tab** pages are closed too, even a lone one, except the New Tab you are currently on and any pinned New Tab.

Open `brave://extensions/shortcuts` to see which key the command actually got, or to assign a different one. A suggested shortcut is dropped silently when something else already holds it, so an unassigned command there is the first thing to check if the keystroke does nothing.

Reloading matters during development: after editing any file in this folder, click the reload icon on the extension's card in `brave://extensions`. Brave keeps running the old service worker until you do.

## Matching rules

Some pages carry throwaway values in their URLs. A tool that waits for an OAuth redirect listens on a random high port and receives a single-use code, so two tabs from two sign-in attempts share nothing but their title:

- `http://127.0.0.1:55803/oauth/callback?code=eyJhbGciOi…`
- `http://127.0.0.1:54583/oauth/callback?code=eyJraWQiOi…`

Rules change how URLs you name are treated: they loosen the comparison, or mark a URL as closable on sight. The extension ships with none, because dropping part of a URL is only ever safe for URLs you recognize. Add your own on the options page: `brave://extensions`, **Details** under Close Duplicate Tabs, then **Extension options**. `⌘S` or `Ctrl+S` saves.

Rules are a JSON array. Each rule has a required `match` plus any of four fields:

| Field | Meaning |
| --- | --- |
| `match` | Which URLs the rule applies to. `*` stands for any run of characters, including `/`, and is the only special character. The whole URL must match. |
| `ignorePort` | Group tabs that differ only by port number. |
| `ignoreParams` | A list of query parameter names to drop before comparing, or `"*"` to drop the query string entirely. |
| `matchTitle` | Also require equal tab titles. |
| `closeAlways` | Close every matching tab, duplicate or not. |

The first rule whose `match` fits a URL is the one that applies.

`matchTitle` exists because a rule can strip away everything that told two pages apart. It narrows a rule and never widens it: two tabs still need the same origin and path to group, so a rule cannot merge unrelated pages that happen to share a title. A tab that has not reported a title yet joins no group.

The callback tabs above:

```json
[
  {
    "match": "http://127.0.0.1:*/oauth/callback*",
    "ignorePort": true,
    "ignoreParams": "*",
    "matchTitle": true
  }
]
```

Dropping one noisy parameter, such as a banner message that differs per redirect:

```json
[
  {
    "match": "https://*.console.aws.amazon.com/*",
    "ignoreParams": ["warningMsg"]
  }
]
```

### closeAlways

Some pages hold nothing once you have read them—a callback that exists to say _you may close this window_. Keeping one of them is one too many, so `closeAlways` closes every match rather than all but one:

```json
[
  {
    "match": "http://127.0.0.1:*/oauth/callback*",
    "closeAlways": true
  }
]
```

This is the one field that can close the tab you are looking at, and it ignores pinning, so keep its `match` narrow. It compares nothing, which is why it cannot be combined with `ignorePort`, `ignoreParams` or `matchTitle`—those would silently do nothing, so the options page rejects the combination instead.

An earlier rule wins, so a narrower rule above a `closeAlways` rule carves out URLs to keep:

```json
[
  { "match": "http://127.0.0.1:*/oauth/callback/manual*", "ignorePort": true },
  { "match": "http://127.0.0.1:*/oauth/callback*", "closeAlways": true }
]
```

## Development

Run the tests and syntax checks:

```sh
npm test
npm run check
```
