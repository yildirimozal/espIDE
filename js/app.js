// app.js — Pro v2 orkestra: editor + terminal + dosya agaci + senkron + kart.
import { SerialREPL } from './serial.js';
import { flashFirmware } from './flash.js';
import { BOARDS, boardsForChip, getBoard, INFO_SCRIPT, chipFromInfo } from './boards.js';
import { renderPinout } from './pinout.js';
import { initEditor } from './editor.js';
import { initTerminal } from './terminal.js';
import { DeviceFiles, pickLocalFolder, pushToDevice, pullFromDevice } from './files.js';

const $ = (id) => document.getElementById(id);
const repl = new SerialREPL();
let cm, term, dfiles, currentChip = 'ESP32';
let curFile = null;            // editordeki dosyanin cihaz yolu
let folderHandle = null;       // yerel senkron klasoru

const ORNEKLER = {
  'Blink': `from machine import Pin\nimport time\nled = Pin(2, Pin.OUT)\nwhile True:\n    led.value(not led.value())\n    time.sleep(0.3)`,
  'Kart bilgisi': `import machine, gc, os\nprint("freq:", machine.freq()//10**6, "MHz")\nprint("free:", gc.mem_free(), "B")\nprint(os.uname())`,
  'WiFi tara': `import network\nw=network.WLAN(network.STA_IF); w.active(True)\nfor a in w.scan(): print(a[0].decode(), a[2], a[3])`,
  'I2C tara': `from machine import I2C, Pin\ni2c=I2C(0, scl=Pin(22), sda=Pin(21))\nprint("bulunan adresler:", [hex(x) for x in i2c.scan()])`,
};

function out(t, cls = '') {
  const s = document.createElement('span'); if (cls) s.className = cls; s.textContent = t;
  $('output').appendChild(s); $('output').scrollTop = $('output').scrollHeight;
}
function setStatus(t, st) { $('status-text').textContent = t; $('status-dot').className = 'dot ' + (st || ''); }
function setConnectedUI(c) {
  $('btn-connect').classList.toggle('hidden', c);
  $('btn-disconnect').classList.toggle('hidden', !c);
  ['btn-run', 'btn-stop', 'btn-save', 'f-refresh', 'f-new', 'f-del', 'f-run', 'f-open'].forEach((id) => $(id).disabled = !c);
}
function bottomTab(name) {
  document.querySelectorAll('.tab[data-bottom]').forEach((b) => b.classList.toggle('active', b.dataset.bottom === name));
  $('terminal').classList.toggle('active', name === 'terminal');
  $('output').classList.toggle('active', name === 'output');
  if (name === 'terminal' && term) term.fit();
}

// --- Baglan ---
async function connect() {
  if (!navigator.serial) { alert('Web Serial gerekli — Chrome/Edge kullan.'); return; }
  try {
    setStatus('port seçiliyor…', 'busy');
    await repl.requestPort();
    repl.onDisconnect = () => { setConnectedUI(false); setStatus('kart koptu', 'err'); out('\n⚠️ Bağlantı koptu.\n', 'err'); };
    await repl.open(parseInt($('baud').value, 10));
    setConnectedUI(true);
    setStatus('kart okunuyor…', 'busy');
    await refreshInfo();
    await refreshFiles();
    await repl.terminalReady();
    if (term) term.write('\r\n\x1b[36m# Bağlandı — etkileşimli REPL hazır. Ctrl-C ile durdur.\x1b[0m\r\n');
    setStatus('bağlı · ' + currentChip, 'ok');
  } catch (e) {
    setStatus('bağlanamadı', 'err'); out('Bağlantı hatası: ' + e.message + '\n', 'err');
    out('Kart boşsa "Firmware" ile MicroPython yükle.\n', 'sys');
    try { await repl.close(); } catch (_) {}
    setConnectedUI(false);
  }
}
async function disconnect() { await repl.close(); repl.port = null; setConnectedUI(false); setStatus('bağlı değil'); out('Bağlantı kesildi.\n', 'sys'); }

// --- Kart bilgisi + pinout ---
async function refreshInfo() {
  const { stdout, stderr } = await repl.exec(INFO_SCRIPT, 8000);
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
    <div><b>UID</b><span>${info.uid}</span></div>`;
  const sel = $('board-select'); sel.innerHTML = '';
  BOARDS.forEach((b) => { const o = document.createElement('option'); o.value = b.id; o.textContent = b.name + (b.chip === currentChip ? ' ✓' : ''); sel.appendChild(o); });
  sel.value = boardsForChip(currentChip)[0].id;
  drawBoard(sel.value);
}
function drawBoard(id) { renderPinout($('pinout'), getBoard(id), (g, a) => out(`GPIO${g} ${a ? '1' : '0'} (sim)\n`, 'sys')); }

// --- Dosya agaci ---
async function refreshFiles() {
  await dfiles.refresh();
  try { const d = await repl.fsDf(); $('df').textContent = `flash: ${(d.used / 1024) | 0} / ${(d.total / 1024) | 0} KB kullanılıyor`; } catch (e) {}
}
async function openFile(path) {
  setStatus('açılıyor…', 'busy');
  try {
    const text = await repl.fsReadText(path);
    cm.setValue(text); curFile = path; $('cur-file').textContent = path;
    setStatus('bağlı · ' + currentChip, 'ok');
  } catch (e) { out('Açılamadı: ' + e.message + '\n', 'err'); setStatus('hata', 'err'); }
}
async function saveToDevice() {
  let path = curFile;
  if (!path) { path = prompt('Cihazdaki dosya yolu:', '/main.py'); if (!path) return; }
  setStatus('kaydediliyor…', 'busy');
  try {
    await repl.fsWrite(path, cm.getValue());
    curFile = path; $('cur-file').textContent = path;
    out(`💾 ${path} karta kaydedildi.\n`, 'sys');
    await refreshFiles(); setStatus('bağlı · ' + currentChip, 'ok');
  } catch (e) { out('Kaydedilemedi: ' + e.message + '\n', 'err'); setStatus('hata', 'err'); }
}
async function newFile() {
  const path = prompt('Yeni dosya yolu:', '/yeni.py'); if (!path) return;
  await repl.fsWrite(path, '# ' + path + '\n'); await refreshFiles(); openFile(path);
}
async function delSelected() {
  if (!dfiles.selected) { out('Önce bir dosya seç.\n', 'sys'); return; }
  if (!confirm(dfiles.selected + ' silinsin mi?')) return;
  try { await repl.fsDelete(dfiles.selected, dfiles.selectedType === 'dir'); await refreshFiles(); }
  catch (e) { out('Silinemedi: ' + e.message + '\n', 'err'); }
}
async function runSelected() {
  if (!dfiles.selected || dfiles.selectedType !== 'file') { out('Önce bir dosya seç.\n', 'sys'); return; }
  await runCode(`exec(open(${JSON.stringify(dfiles.selected)}).read())`);
}

// --- Calistir ---
async function runCode(code) {
  if (!repl.connected) return;
  bottomTab('output'); setStatus('çalışıyor…', 'busy');
  out('\n▶ ' + new Date().toLocaleTimeString() + '\n', 'sys');
  try {
    const { stdout, stderr } = await repl.run(code, 120000);
    if (stdout) out(stdout); if (stderr) out(stderr, 'err');
    out('✓ bitti\n', 'sys'); setStatus('bağlı · ' + currentChip, 'ok');
  } catch (e) { out('Hata: ' + e.message + '\n', 'err'); setStatus('hata', 'err'); }
}
const run = () => runCode(cm.getValue());
async function stop() { await repl.interrupt(); out('\n⏹ Ctrl-C\n', 'sys'); }
async function resetBoard() { await repl.hardReset(); out('⟲ reset\n', 'sys'); }

// --- Firmware ---
async function flash() {
  if (!navigator.serial) return alert('Web Serial gerekli.');
  if (!confirm('Karta MicroPython yüklenecek, her şey SİLİNİR. Devam?')) return;
  $('flash-progress').classList.remove('hidden');
  try {
    if (repl.connected) await repl.close();
    if (!repl.port) await repl.requestPort();
    setStatus('firmware…', 'busy'); bottomTab('output');
    const res = await flashFirmware(repl.port, { onLog: (t) => out(t), onProgress: (p) => { $('flash-bar').style.width = ((p * 100) | 0) + '%'; } });
    out(`\n✅ ${res.firmware.ad} yüklendi.\n`, 'sys');
    await new Promise((r) => setTimeout(r, 2500));
    await repl.open(parseInt($('baud').value, 10));
    setConnectedUI(true); await refreshInfo(); await refreshFiles(); await repl.terminalReady();
    setStatus('bağlı · ' + currentChip, 'ok');
  } catch (e) { out('Firmware hatası: ' + e.message + '\n', 'err'); setStatus('hata', 'err'); }
  finally { setTimeout(() => $('flash-progress').classList.add('hidden'), 1500); }
}

// --- Yerel senkron ---
async function pickFolder() {
  try { folderHandle = await pickLocalFolder(); $('s-folder').textContent = '📂 ' + folderHandle.name; $('s-push').disabled = $('s-pull').disabled = false; }
  catch (e) { /* iptal */ }
}
async function pushFolder() {
  if (!folderHandle || !repl.connected) return; bottomTab('output');
  out('\n→ Karta gönderiliyor…\n', 'sys');
  try { await pushToDevice(repl, folderHandle, (t) => out(t)); await refreshFiles(); } catch (e) { out('Senkron hatası: ' + e.message + '\n', 'err'); }
}
async function pullFolder() {
  if (!folderHandle || !repl.connected) return; bottomTab('output');
  out('\n← Karttan alınıyor…\n', 'sys');
  try { await pullFromDevice(repl, folderHandle, (t) => out(t)); } catch (e) { out('Senkron hatası: ' + e.message + '\n', 'err'); }
}

// --- Baslat ---
function init() {
  cm = initEditor($('editor'), run);
  try { term = initTerminal($('terminal'), repl); }
  catch (e) { console.error('Terminal yüklenemedi:', e); $('terminal').innerHTML = '<div class="err small" style="padding:8px">Terminal yüklenemedi (xterm.js). Çıktı sekmesini kullan.</div>'; }
  dfiles = new DeviceFiles($('tree'), repl, { openFile });

  const exSel = $('examples');
  Object.keys(ORNEKLER).forEach((k) => { const o = document.createElement('option'); o.value = k; o.textContent = k; exSel.appendChild(o); });
  exSel.addEventListener('change', () => { if (ORNEKLER[exSel.value]) { cm.setValue(ORNEKLER[exSel.value]); exSel.value = ''; } });

  // Sekmeler
  document.querySelectorAll('.tab[data-tab]').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.tab[data-tab]').forEach((x) => x.classList.toggle('active', x === b));
    $('pane-files').classList.toggle('active', b.dataset.tab === 'files');
    $('pane-board').classList.toggle('active', b.dataset.tab === 'board');
  }));
  document.querySelectorAll('.tab[data-bottom]').forEach((b) => b.addEventListener('click', () => bottomTab(b.dataset.bottom)));

  $('board-select').addEventListener('change', (e) => drawBoard(e.target.value));
  $('btn-connect').onclick = connect; $('btn-disconnect').onclick = disconnect;
  $('btn-run').onclick = run; $('btn-stop').onclick = stop; $('btn-reset').onclick = resetBoard;
  $('btn-flash').onclick = flash; $('btn-save').onclick = saveToDevice;
  $('btn-clear').onclick = () => { $('output').innerHTML = ''; term && term.clear(); };
  $('f-refresh').onclick = refreshFiles; $('f-new').onclick = newFile; $('f-del').onclick = delSelected;
  $('f-run').onclick = runSelected; $('f-open').onclick = () => dfiles.selected && openFile(dfiles.selected);
  $('s-pick').onclick = pickFolder; $('s-push').onclick = pushFolder; $('s-pull').onclick = pullFolder;
  $('baud').addEventListener('change', async () => { if (repl.connected) { await repl.close(); await repl.open(parseInt($('baud').value, 10)); await repl.terminalReady(); } });

  drawBoard(BOARDS[0].id);
  if (!navigator.serial) { setStatus('Web Serial yok — Chrome/Edge', 'err'); out('⚠️ Chrome veya Edge kullan.\n', 'err'); }
  else { setStatus('bağlı değil'); out('Kartı tak, "Bağlan"a tıkla. Boş kart → "Firmware".\n', 'sys'); }
}
init();
