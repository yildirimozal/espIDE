# ⚡ ESP32 Web IDE

A professional, browser-based IDE for ESP32 / MicroPython. Plug a board into USB, open the
app in Chrome or Edge, and you have a full development environment — **no install, no toolchain,
no cloud**. Everything runs locally over the Web Serial API.

**🔗 Live: https://yildirimozal.github.io/espIDE/**

*Read this in: **English** · [Türkçe](README.tr.md)*

---

## Features

- **Direct USB connection** via the Web Serial API — no drivers to script, no agents, no upload servers.
- **In-browser firmware flashing** (esptool-js) — bring up a blank board with MicroPython in one click.
- **Fast file transfer** using MicroPython's raw-paste protocol with flow control.
- **On-device file system** — browse, open, edit, run, delete files on the board's flash and save the editor straight to the device.
- **Local folder sync** (File System Access API) — push a project to the board or pull it back, subdirectories included.
- **Interactive terminal** (xterm.js) — a live ANSI REPL; `input()` works.
- **Live plotter** — charts numbers streamed from the board in real time (multi-series; `temp:23.5 hum:40`, CSV, or whitespace), with timestamped **CSV export**.
- **Wireless monitor** — scan nearby **WiFi** networks (SSID, signal, channel, security) with a channel-usage chart, and **BLE** devices (name, MAC, signal), with optional auto-refresh.
- **Smart pinout** — detects the chip and shows the matching pin diagram (ESP32 / S3 / C3).
- **Board info** — chip, frequency, flash, free RAM, unique ID, flash usage.
- **Code editor** with Python syntax highlighting and an examples library.
- **PWA / fully offline** — installable; the app and firmware images are cached for use on air-gapped or restricted networks.
- **Self-contained** — all dependencies are vendored locally; the app makes **zero external requests**.
- **Bilingual UI** — English / Turkish, auto-detected from the browser with a manual switch.

## Quick start

1. Open the app in **Chrome** or **Edge** (desktop).
2. Connect an ESP32 board with a **data-capable USB cable**.
3. Click **Connect** and pick the serial port.
   - New/blank board? Click **Firmware** first to flash MicroPython (one time).
4. Write code and press **Run** (`Ctrl/Cmd+Enter`); use the Terminal, Plotter, and Wireless panels as needed.

> The board only needs MicroPython on it. If macOS doesn't list the port, install the USB-to-UART
> driver for your board's bridge chip (CP2102 / CH340) and restart the browser.

## Browser support

Requires the **Web Serial API** and **File System Access API**: Chrome, Edge, and Opera (desktop).
Safari and Firefox are not supported. Served over HTTPS or `localhost`.

## Supported chips

| Chip | Bundled firmware | Pinout template |
|------|------------------|-----------------|
| ESP32 (classic, WROOM-32) | ✅ | DevKitC 38-pin · DevKit V1 30-pin |
| ESP32-S3 | ✅ | S3 DevKitC |
| ESP32-C3 | ✅ | C3 SuperMini |

The chip is detected via `os.uname()` and the matching pinout is selected automatically; you can
also switch templates manually.

### Adding a chip or firmware
1. Drop the `.bin` into `firmware/`.
2. Add a chip → file + offset entry to `FIRMWARE` in `js/flash.js`.
3. Map the detected chip string to that key in `normalizeChip()` (`js/flash.js`) — unknown chips are rejected rather than defaulting to ESP32, so a new family must be added here explicitly.
4. Add a pinout template to `js/boards.js` (use the existing ones as a reference); the chip-family detection used for auto-selection lives in `chipFromInfo()` there.

## PWA / offline / updates

- On first load a **service worker** caches the entire app and the firmware images, so it then works
  **fully offline** — ideal for restricted or air-gapped environments.
- It can be **installed** as a desktop app from the browser.
- All dependencies live under `vendor/` — no CDN at runtime.
- **Releasing an update:** bump `APP_VERSION` in `sw.js`. The old cache is dropped and clients pick up
  the new build on their next load.

## Self-hosting

The app is fully static. Host it anywhere that serves files over HTTPS:

- **GitHub Pages:** fork, then *Settings → Pages → Deploy from a branch → `main` / `/(root)`*.
- **Any static host / your own server:** serve the repository root.

## Local development

ES modules and the service worker require an HTTP origin (not `file://`):

```bash
python3 -m http.server 8000      # then open http://localhost:8000 in Chrome
# or just double-click serve.command on macOS
```

> During development the service worker can serve stale files after edits — use DevTools →
> *Application → Service Workers → "Update on reload"*, or bump `APP_VERSION` in `sw.js`.

## Project structure

```
esp32-web-ide/
├── index.html
├── css/style.css
├── js/
│   ├── app.js          # orchestrator
│   ├── serial.js       # Web Serial + raw / raw-paste REPL + file system + streaming
│   ├── flash.js        # firmware flashing (esptool-js)
│   ├── boards.js       # pinout templates + chip detection
│   ├── pinout.js       # renders the clickable pin diagram
│   ├── terminal.js     # interactive terminal (xterm.js)
│   ├── files.js        # device file tree + local folder sync
│   ├── plotter.js      # live plotter + CSV export
│   ├── wireless.js     # WiFi / BLE monitor
│   ├── editor.js       # CodeMirror editor
│   └── i18n.js         # English / Turkish
├── firmware/           # MicroPython .bin images
├── vendor/             # vendored dependencies (no CDN)
├── sw.js               # service worker (offline + cache-busting)
└── manifest.webmanifest
```

## Contributing

espIDE is open source and growing — contributions of every size are welcome. Great places
to start: new **board pinouts** (`js/boards.js`), **examples** (`js/app.js`),
**translations** (`js/i18n.js`), and docs. See **[CONTRIBUTING.md](CONTRIBUTING.md)** for
the development setup and guidelines.

- ⭐ Star the repo · 🐛 Open an issue · 🔧 Send a pull request · 💡 Share ideas

## License

MIT — see [LICENSE](LICENSE).

Built with [MicroPython](https://micropython.org) (MIT), [esptool-js](https://github.com/espressif/esptool-js)
(Apache-2.0), [CodeMirror](https://codemirror.net) (MIT), and [xterm.js](https://xtermjs.org) (MIT).
