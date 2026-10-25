# Explain This 💡

A tiny, privacy-first browser extension that explains anything you select — a
confusing acronym, a Latin abbreviation, a technical term, a person, a concept —
in plain language, right where you're reading.

Select text → click the **Explain** bubble (or press <kbd>Ctrl/⌘ Shift E</kbd>, or
right-click) → get a clear explanation in a little card. No accounts, no API keys,
no tracking.

![icon](icons/icon-128.png)

## Why it's different

- **Offline-first.** A built-in glossary of ~70 common acronyms and abbreviations
  (API, EBITDA, i.e., RSVP, VPN, ICU…) answers instantly with **zero network calls**.
- **Three smart sources, in order:** your own glossary → the built-in glossary →
  a free dictionary (for single words) → Wikipedia (for phrases, people, concepts).
- **Genuinely private.** Text leaves your device **only when you explicitly ask**
  and the offline glossary didn't already have the answer — and then only the single
  selected word or phrase is sent. No analytics, no accounts, no keys. You can turn
  the online sources off entirely and run 100% offline.
- **Your own glossary.** Add team acronyms, project names, or anything else from the
  options page. These are checked first and override everything.
- **Cross-browser.** Manifest V3, works in Chrome, Edge, Brave, Arc, Opera, and
  Firefox (121+).
- **Zero dependencies.** Plain JS, no build step, no bundler.

## How to use

- **Select** any word or phrase on a page, then click the floating **Explain** bubble.
- **Right-click** a selection → *Explain "…"*.
- **Keyboard:** select text and press <kbd>Ctrl+Shift+E</kbd> (<kbd>⌘+Shift+E</kbd> on Mac).
- **Toolbar popup:** click the extension icon and type any term — no selection needed.

## Install (developer / unpacked)

### Chrome · Edge · Brave · Arc · Opera
1. Go to `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select this `explain-this` folder.

### Firefox (121+)
1. Go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**
3. Select the `manifest.json` file inside this folder.

> Temporary add-ons in Firefox are removed when you restart the browser. For a
> permanent install, package and sign via [addons.mozilla.org](https://addons.mozilla.org).

## Settings

Open the options page (right-click the icon → *Options*, or the **Settings** link in
the popup) to:

- Toggle the on-selection bubble.
- Enable/disable the dictionary and Wikipedia sources.
- Choose the Wikipedia language (11 languages included).
- Manage your personal glossary.

## Privacy

- Your glossary and settings are stored **locally** (`storage.local`) and never leave
  your device.
- The dictionary ([dictionaryapi.dev](https://dictionaryapi.dev)) and Wikipedia
  ([wikipedia.org](https://www.wikipedia.org)) are queried **only** when you ask for an
  explanation that the offline glossary can't provide, and only the selected term is
  sent.
- No telemetry, no analytics, no accounts, no API keys. Requires only the two host
  permissions needed for those two lookups.

## Project layout

```
explain-this/
├── manifest.json        # MV3, cross-browser
├── icons/               # 16/32/48/128 px PNGs
└── src/
    ├── background.js     # lookup pipeline, context menu, keyboard command
    ├── content.js        # selection bubble + explanation card (Shadow DOM)
    ├── popup.html/.js     # toolbar popup (type a term)
    └── options.html/.js   # settings + custom glossary editor
```

## License

MIT © Thierry Ravelomaharavo
