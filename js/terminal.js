// terminal.js — xterm.js tabanli etkilesimli REPL terminali.
// Cihaz friendly REPL'i ile cift yonlu: device cikti -> terminal, tus -> device.
// xterm, index.html'de CDN'den global olarak yuklenir.

export function initTerminal(el, repl) {
  const term = new window.Terminal({
    fontFamily: 'SF Mono, Menlo, Consolas, monospace',
    fontSize: 13,
    theme: {
      background: '#010409', foreground: '#adbac7', cursor: '#58a6ff',
      black: '#21262d', red: '#f85149', green: '#3fb950', yellow: '#d29922',
      blue: '#58a6ff', magenta: '#a371f7', cyan: '#39c5cf', white: '#c9d1d9',
    },
    convertEol: true,
    cursorBlink: true,
  });
  let fit = null;
  try { fit = new window.FitAddon.FitAddon(); term.loadAddon(fit); } catch (e) {}
  term.open(el);
  if (fit) try { fit.fit(); } catch (e) {}

  // device -> terminal (yalnizca terminal modunda; structured op sirasinda capturing=true)
  repl.onData = (s) => term.write(s);

  // terminal -> device (structured op sirasinda yok say)
  term.onData((key) => { if (!repl.capturing) repl.sendKeys(key); });

  window.addEventListener('resize', () => { if (fit) try { fit.fit(); } catch (e) {} });

  return {
    term,
    fit: () => { if (fit) try { fit.fit(); } catch (e) {} },
    focus: () => term.focus(),
    clear: () => term.clear(),
    write: (s) => term.write(s),
    writeln: (s) => term.writeln(s),
  };
}
