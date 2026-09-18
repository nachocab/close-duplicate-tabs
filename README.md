# Close Duplicate Tabs

A tiny Manifest V3 extension for Brave and other Chromium browsers. It closes duplicate website tabs across all browser windows and treats URLs that differ only by their `#fragment` as duplicates.

For example, these count as the same page:

- `https://example.com/docs#introduction`
- `https://example.com/docs#installation`

Query strings still matter, so `https://example.com/docs?lang=en` and `https://example.com/docs?lang=es` are not duplicates.

## Install in Brave

1. Open `brave://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder.

The extension icon shows the number of duplicate tabs that would be closed. Use `Ctrl+Shift+D` to close them, or click the icon. The currently active matching tab is kept; otherwise a pinned tab is kept, then the first matching tab.

Brave may reserve `Ctrl+Shift+D` for its own **Bookmark all tabs** command. If the shortcut is not assigned after installation, open `brave://extensions/shortcuts` and assign any available shortcut to **Close duplicate tabs**.

## Development

Run the tests and syntax checks:

```sh
npm test
npm run check
```
