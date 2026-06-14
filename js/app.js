// app.js — Tum parcalari birlestirir.
import { SerialREPL } from './serial.js';
import { flashFirmware } from './flash.js';
import { BOARDS, boardsForChip, getBoard, INFO_SCRIPT, chipFromInfo } from './boards.js';
import { renderPinout, setLed, clearPins } from './pinout.js';
import { initEditor } from './editor.js';

const $ = (id) => document.getElementById(id);
const repl = new SerialREPL();
let cm = null;
let currentChip = 'ESP32';

// --- Ornek kodlar ---
const ORNEKLER = {
  'LED yak/söndür': `from machine import Pin\nimport time\nled = Pin(2, Pin.OUT)\nfor i in range(10):\n    led.value(i % 2)\n    time.sleep(0.3)\n    print("durum:", i % 2)\nprint("bitti")`,
  'Kart bilgisi': `import machine, gc, os\nprint("Cip frekansi:", machine.freq() // 1_000_000, "MHz")\nprint("Bos hafiza :", gc.mem_free(), "byte")\nprint("uname      :", os.uname().machine)`,
  'WiFi tara': `import network\nwlan = network.WLAN(network.STA_IF)\nwlan.active(True)\nfor a in wlan.scan():\n    print(a[0].decode(), "| kanal", a[2], "| sinyal", a[3])`,
  'Buton oku (GPIO0)': `from machine import Pin\nbtn = Pin(0, Pin.IN, Pin.PULL_UP)\nprint("BOOT butonu durumu:", btn.value(), "(0 = basili)")`,
  'Dahili sicaklik': `import esp32\nprint("Cip sicakligi:", esp32.mcu_temperature(), "C")`,
};

function out(text, cls = '') {
  const o = $('output');
  const span = document.createElement('span');
  if (cls) span.className = cls;
  span.textContent = text;
  o.appendChild(span);
  o.scrollTop = o.scrollHeight;
}

function setStatus(text, state) {
  $('status-text').textContent = text;
  $('status-dot').className = 'dot ' + (state || '');
}

function setConnectedUI(connected) {
  $('btn-connect').classList.toggle('hidden', connected);
  $('btn-disconnect').classList.toggle('hidden', !connected);
  $('btn-run').disabled = !connected;
  $('btn-stop').disabled = !connected;
}

// --- Kart bilgisini oku, paneli ve pinout'u guncelle ---
async function refreshInfo() {
  setStatus('kart okunuyor...', 'busy');
  const { stdout, stderr } = await repl.run(INFO_SCRIPT, 8000);
  if (stderr.trim()) throw new Error(stderr.trim());
  const info = JSON.parse(stdout.trim().split('\n').pop());
  currentChip = chipFromInfo(info);

  $('info').innerHTML = `
    <div><b>Çip</b><span>${currentChip}</span></div>
    <div><b>Model</b><span>${info.machine}</span></div>
    <div><b>MicroPython</b><span>${info.release}</span></div>
    <div><b>Frekans</b><span>${(info.freq / 1e6) | 0} MHz</span></div>
    <div><b>Flash</b><span>${(info.flash / 1048576) | 0} MB</span></div>
    <div><b>Boş RAM</b><span>${(info.mem_free / 1024) | 0} KB</span></div>
    <div><b>Kimlik (UID)</b><span>${info.uid}</span></div>`;

  // Cipe uygun sablonlari doldur, ilkini sec
  const liste = boardsForChip(currentChip);
  const sel = $('board-select');
  sel.innerHTML = '';
  BOARDS.forEach((b) => {
    const opt = document.createElement('option');
    opt.value = b.id;
    opt.textContent = b.name + (b.chip === currentChip ? '  ✓' : '');
    sel.appendChild(opt);
  });
  sel.value = liste[0].id;
  drawBoard(liste[0].id);
  setStatus('bağlı · ' + currentChip, 'ok');
}

function drawBoard(id) {
  const board = getBoard(id);
  renderPinout($('pinout'), board, (gpio, active) => {
    out(`pin GPIO${gpio} ${active ? 'AÇIK (1)' : 'KAPALI (0)'} olarak işaretlendi (simülasyon)\n`, 'sys');
  });
}

// --- Baglan ---
async function connect() {
  if (!navigator.serial) {
    alert('Bu tarayıcı Web Serial desteklemiyor. Lütfen Chrome veya Edge kullan.');
    return;
  }
  try {
    setStatus('port seçiliyor...', 'busy');
    await repl.requestPort();
    await repl.open(115200);
    setConnectedUI(true);
    out('🔌 Karta bağlanıldı.\n', 'sys');
    await refreshInfo();
  } catch (e) {
    setStatus('bağlanamadı', 'err');
    out('Bağlantı hatası: ' + e.message + '\n', 'err');
    out('İpucu: Kart boşsa önce "Firmware Yükle" ile MicroPython yükle.\n', 'sys');
    try { await repl.close(); } catch (_) {}
    setConnectedUI(false);
  }
}

async function disconnect() {
  await repl.close();
  repl.port = null;
  setConnectedUI(false);
  setStatus('bağlı değil', '');
  out('🔌 Bağlantı kesildi.\n', 'sys');
}

// --- Kod calistir ---
async function run() {
  if (!repl.connected) return;
  setStatus('çalışıyor...', 'busy');
  out('\n▶ ' + new Date().toLocaleTimeString() + '\n', 'sys');
  try {
    const { stdout, stderr } = await repl.run(cm.getValue(), 60000);
    if (stdout) out(stdout);
    if (stderr) out(stderr, 'err');
    out('✓ bitti\n', 'sys');
    setStatus('bağlı · ' + currentChip, 'ok');
  } catch (e) {
    out('Hata: ' + e.message + '\n', 'err');
    setStatus('hata', 'err');
  }
}

async function stop() {
  try { await repl._write('\r\x03\x03'); out('\n⏹ durduruldu (Ctrl-C)\n', 'sys'); } catch (e) {}
}

// --- Firmware yukle ---
async function flash() {
  if (!navigator.serial) {
    alert('Web Serial gerekli (Chrome/Edge).');
    return;
  }
  if (!confirm('Karta MicroPython yüklenecek. Karttaki her şey SİLİNİR. Devam?')) return;
  const bar = $('flash-bar');
  $('flash-progress').classList.remove('hidden');
  try {
    if (repl.connected) await repl.close();
    if (!repl.port) await repl.requestPort();
    setStatus('firmware yükleniyor...', 'busy');
    out('\n⚙️ Firmware yükleme başladı...\n', 'sys');
    const res = await flashFirmware(repl.port, {
      onLog: (t) => out(t),
      onProgress: (p) => { bar.style.width = Math.round(p * 100) + '%'; },
    });
    out(`\n✅ ${res.firmware.ad} için MicroPython yüklendi!\n`, 'sys');
    out('Kart yeniden başlatılıyor, 2 sn sonra bağlanılıyor...\n', 'sys');
    await new Promise((r) => setTimeout(r, 2500));
    await repl.open(115200);
    setConnectedUI(true);
    await refreshInfo();
  } catch (e) {
    out('Firmware hatası: ' + e.message + '\n', 'err');
    setStatus('firmware hatası', 'err');
  } finally {
    setTimeout(() => $('flash-progress').classList.add('hidden'), 1500);
  }
}

// --- Baslat ---
function init() {
  cm = initEditor($('editor'), run);

  // Ornekler menusu
  const exSel = $('examples');
  Object.keys(ORNEKLER).forEach((k) => {
    const o = document.createElement('option');
    o.value = k; o.textContent = k;
    exSel.appendChild(o);
  });
  exSel.addEventListener('change', () => {
    if (exSel.value && ORNEKLER[exSel.value]) {
      cm.setValue(ORNEKLER[exSel.value]);
      exSel.value = '';
    }
  });

  $('board-select').addEventListener('change', (e) => drawBoard(e.target.value));
  $('btn-connect').addEventListener('click', connect);
  $('btn-disconnect').addEventListener('click', disconnect);
  $('btn-run').addEventListener('click', run);
  $('btn-stop').addEventListener('click', stop);
  $('btn-flash').addEventListener('click', flash);
  $('btn-clear').addEventListener('click', () => { $('output').innerHTML = ''; });

  // Baslangicta varsayilan kart cizimi
  drawBoard(BOARDS[0].id);

  if (!navigator.serial) {
    setStatus('Web Serial yok — Chrome/Edge kullan', 'err');
    out('⚠️ Bu tarayıcı Web Serial API desteklemiyor.\nLütfen Google Chrome veya Microsoft Edge ile aç.\n', 'err');
  } else {
    setStatus('bağlı değil', '');
    out('Hoş geldin! Kartı USB ile tak, "Bağlan"a tıkla.\nKart boşsa önce "Firmware Yükle".\n', 'sys');
  }
}

init();
