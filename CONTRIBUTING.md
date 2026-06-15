# Contributing to ESP32 Web IDE

Thanks for your interest in improving espIDE! Contributions of every size are welcome —
bug fixes, new board pinouts, examples, translations, and docs all help the project grow.

## Ways to contribute

- ⭐ **Star the repo** so more people discover it.
- 🐛 **Open an issue** for bugs or feature requests (include board model, browser, and steps).
- 🔧 **Send a pull request** for fixes and features.
- 💡 **Share ideas** to help shape the roadmap.

### Good first contributions
- **New board pinouts** — add a template to `js/boards.js` (copy an existing one).
- **Firmware** — drop a `.bin` into `firmware/` and add a chip → file/offset entry in `js/flash.js`.
- **Examples** — extend the `EXAMPLES` list in `js/app.js`.
- **Translations** — add a language to `js/i18n.js` (`DICT`) and an option to the `#lang` selector in `index.html`.
- **Docs** — improve the README or this guide.

## Development setup

The app is plain HTML/CSS/JavaScript (ES modules) — **no build step**. You just need a
static server, because ES modules and the service worker don't run from `file://`:

```bash
python3 -m http.server 8000      # then open http://localhost:8000 in Chrome/Edge
# or double-click serve.command on macOS
```

> Heads-up: the service worker caches assets, so during development you may see stale files
> after edits. Enable DevTools → *Application → Service Workers → "Update on reload"*, or
> bump `APP_VERSION` in `sw.js`.

A real ESP32 helps for testing serial features, but UI/i18n/pinout work can be done without one.

## Project layout

See the **Project structure** section in the [README](README.md). In short, each concern
lives in its own `js/` module (`serial.js`, `flash.js`, `boards.js`, `terminal.js`,
`files.js`, `plotter.js`, `wireless.js`, `editor.js`, `i18n.js`), wired together by `app.js`.

## Pull request guidelines

- Keep changes focused; one logical change per PR.
- Match the existing code style (vanilla JS, no frameworks, no build tooling).
- Keep dependencies **vendored** under `vendor/` — no runtime CDN calls.
- If you add a file the app loads, add it to the precache list in `sw.js` and bump `APP_VERSION`.
- Add any new user-facing strings to **both** languages in `js/i18n.js`.
- Test in Chrome or Edge before submitting.

## Code of conduct

Be respectful and constructive. We're here to learn and build together.

Thank you for helping make embedded development more accessible! ⚡
