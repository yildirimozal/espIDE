// editor.js — CodeMirror tabanli kod editoru (Python renklendirme).
// CodeMirror, index.html'de CDN'den global olarak yuklenir.

const VARSAYILAN = `# Welcome to ESP32 Web IDE!
# Write code, press Ctrl+Enter to send & run it on the board.

from machine import Pin
import time

led = Pin(2, Pin.OUT)   # onboard LED (GPIO2 on classic ESP32)

for i in range(5):
    led.value(1)
    time.sleep(0.2)
    led.value(0)
    time.sleep(0.2)
    print("blink:", i + 1)

print("Done! Check the pinout and the output panel.")
`;

export function initEditor(el, onRun) {
  const cm = window.CodeMirror(el, {
    value: localStorage.getItem('esp32ide_kod') || VARSAYILAN,
    mode: 'python',
    theme: 'material-darker',
    lineNumbers: true,
    indentUnit: 4,
    tabSize: 4,
    indentWithTabs: false,
    matchBrackets: true,
    autofocus: true,
    extraKeys: {
      'Ctrl-Enter': () => onRun && onRun(),
      'Cmd-Enter': () => onRun && onRun(),
      'Tab': (cmi) => cmi.replaceSelection('    '),
    },
  });
  // Yazdikca tarayicida sakla (kaybolmasin)
  cm.on('change', () => localStorage.setItem('esp32ide_kod', cm.getValue()));
  // Kirli-durum takibi (CodeMirror generation API): setValue ile kaydedilmemis
  // degisiklik ezilmeden once app.js confirm sorabilsin diye.
  let savedGen = cm.changeGeneration(true);
  cm.markSaved = () => { savedGen = cm.changeGeneration(true); };
  cm.isDirty = () => !cm.isClean(savedGen);
  return cm;
}
