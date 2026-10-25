# Privacy Policy — Explain This

_Last updated: 2026-10-25_

Explain This is designed to be private by default. This policy explains exactly
what the extension does and does not do with your data.

## What we collect

**Nothing.** Explain This has no servers, no accounts, no analytics, no tracking,
and no advertising identifiers. We never see your data.

## Data stored on your device

- **Your settings** (which sources are enabled, chosen Wikipedia language, whether
  the selection bubble is shown).
- **Your custom glossary** (terms and definitions you add yourself).

Both are stored locally using the browser's extension storage (`storage.local`) and
never leave your device. Removing the extension removes this data.

## When text leaves your device

Explain This looks up explanations in this order: your custom glossary → the built-in
offline glossary → a dictionary → Wikipedia.

The first two are fully offline. An external request is made **only** when:

1. you **explicitly** ask for an explanation (click the bubble, use the right-click
   menu, the keyboard shortcut, or type in the popup), **and**
2. the offline glossaries did not already answer it.

In that case, and only then, the extension sends **the single selected word or
phrase** (nothing else — no page content, no URL, no identifiers) to:

- **Free Dictionary API** — `https://api.dictionaryapi.dev` (for single words)
- **Wikipedia** — `https://*.wikipedia.org` (for phrases, names, and concepts)

Those services receive the query term and your IP address as part of a normal web
request, and are governed by their own privacy policies. The extension sends no
cookies, account information, or tracking data with these requests.

You can disable both online sources in the extension's options to run it **100%
offline**, in which case no data ever leaves your device.

## Permissions and why they are needed

- **`contextMenus`** — to add the right-click "Explain" menu item.
- **`storage`** — to save your settings and custom glossary locally.
- **Host access to `*.wikipedia.org` and `api.dictionaryapi.dev`** — to fetch
  explanations when you ask for them.
- **Content script on pages you visit** — to show the "Explain" bubble next to text
  you select and display the explanation card. It reads a selection only when you
  make one; it does not read, store, or transmit page contents otherwise.

## Children's privacy

The extension collects no personal data from anyone, including children.

## Changes

Any change to this policy will be published with the extension's source.

## Contact

Questions? Open an issue on the project's repository.
