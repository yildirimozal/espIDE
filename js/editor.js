// editor.js — CodeMirror tabanli kod editoru (Python renklendirme).
// CodeMirror, index.html'de CDN'den global olarak yuklenir.

const VARSAYILAN = `# ESP32 Web IDE'ye hos geldin!
# Kodu yaz, Ctrl+Enter ile karta gonder ve calistir.

from machine import Pin
import time

led = Pin(2, Pin.OUT)   # dahili LED (klasik ESP32'de GPIO2)

for i in range(5):
    led.value(1)
    time.sleep(0.2)
    led.value(0)
    time.sleep(0.2)
    print("yanip sondu:", i + 1)

print("Bitti! Soldaki pinout'a ve cikti penceresine bak.")
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
  return cm;
}
