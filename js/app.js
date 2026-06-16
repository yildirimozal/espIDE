// app.js — Pro v2 orkestra: editor + terminal + dosya agaci + senkron + kart + plotter + i18n.
import { SerialREPL } from './serial.js';
import { flashFirmware, flashCustom } from './flash.js';
import { BOARDS, boardsForChip, getBoard, INFO_SCRIPT, chipFromInfo } from './boards.js';
import { renderPinout } from './pinout.js';
import { initEditor } from './editor.js';
import { initTerminal } from './terminal.js';
import { DeviceFiles, pickLocalFolder, pushToDevice, pullFromDevice } from './files.js';
import { Plotter } from './plotter.js';
import { Wireless } from './wireless.js';
import { CSI } from './csi.js';
import { Room } from './room.js';
import { t, applyI18n, getLang, setLang } from './i18n.js';

const $ = (id) => document.getElementById(id);
// Cihazdan gelen string'leri innerHTML'e gomerken kacis (XSS korumasi).
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const repl = new SerialREPL();
let cm, term, dfiles, plotter, wireless, csi, room, currentChip = 'ESP32', lastInfo = null;
let curFile = null, folderHandle = null;
const csiTap = (txt) => { if (csi) csi.feed(txt); };
const roomTap = (txt) => { if (room) room.feed(txt); };

// Ornek kodlar (id -> kod). Etiket t('ex_'+id) ile.
const EXAMPLES = {
  blink: `from machine import Pin\nimport time\nled = Pin(2, Pin.OUT)\nwhile True:\n    led.value(not led.value())\n    time.sleep(0.3)`,
  boardinfo: `import machine, gc, os\nprint("freq:", machine.freq()//10**6, "MHz")\nprint("free:", gc.mem_free(), "B")\nprint(os.uname())`,
  wifi: `import network\nw=network.WLAN(network.STA_IF); w.active(True)\nfor a in w.scan(): print(a[0].decode(), a[2], a[3])`,
  i2c: `from machine import I2C, Pin\ni2c=I2C(0, scl=Pin(22), sda=Pin(21))\nprint("addresses:", [hex(x) for x in i2c.scan()])`,
};

function out(text, cls = '') {
  const o = $('output');
  const s = document.createElement('span'); if (cls) s.className = cls; s.textContent = text;
  o.appendChild(s);
  // Sinirsiz DOM buyumesini engelle: en eski span'leri at.
  const MAX = 4000;
  while (o.childElementCount > MAX) o.removeChild(o.firstChild);
  o.scrollTop = o.scrollHeight;
}
function statusConnected() { setStatus(t('st_connected', { chip: currentChip }), 'ok'); }
function setStatus(text, st) { $('status-text').textContent = text; $('status-dot').className = 'dot ' + (st || ''); }
function setConnectedUI(c) {
  $('btn-connect').classList.toggle('hidden', c);
  $('btn-disconnect').classList.toggle('hidden', !c);
  ['btn-run', 'btn-stop', 'btn-save', 'f-refresh', 'f-new', 'f-del', 'f-run', 'f-open'].forEach((id) => $(id).disabled = !c);
}
function bottomTab(name) {
  document.querySelectorAll('.tab[data-bottom]').forEach((b) => b.classList.toggle('active', b.dataset.bottom === name));
  $('terminal').classList.toggle('active', name === 'terminal');
  $('output').classList.toggle('active', name === 'output');
  $('plotter').classList.toggle('active', name === 'plotter');
  $('wireless').classList.toggle('active', name === 'wireless');
  $('csi').classList.toggle('active', name === 'csi');
  $('room').classList.toggle('active', name === 'room');
  if (name === 'terminal' && term) term.fit();
  if (name === 'plotter' && plotter) plotter.resize();
  if (name === 'wireless' && wireless) wireless.scan();
  repl.removeTap(csiTap); repl.removeTap(roomTap);         // ham akışı yalnızca ilgili sekmedeyken dinle
  if (name === 'csi' && csi) { repl.addTap(csiTap); csi.resize(); }
  if (name === 'room' && room) { repl.addTap(roomTap); room.resize(); }
}

// --- Baglan ---
async function connect() {
  if (!navigator.serial) { alert(t('msg_need_serial')); return; }
  try {
    setStatus(t('st_selecting'), 'busy');
    await repl.requestPort();
    repl.onDisconnect = () => { if (wireless) wireless.stop(); setConnectedUI(false); setStatus(t('st_dropped'), 'err'); out(t('msg_dropped'), 'err'); };
    await repl.open(parseInt($('baud').value, 10));
    setConnectedUI(true);
    out(t('msg_connected'), 'sys');
    setStatus(t('st_reading'), 'busy');
    try {
      await refreshInfo();
      await refreshFiles();
      await repl.terminalReady();
      if (term) term.write(t('msg_repl_ready'));
      statusConnected();
    } catch (probe) {
      // MicroPython yanıt vermedi (ör. CSI / C / ESP-IDF firmware) -> ham seri modunda kal.
      // Terminal ve CSI gibi ham-akış araçları yine çalışır.
      out('MicroPython yanıtı yok — ham seri modu (terminal / CSI çalışır).\n', 'sys');
      setStatus('ham seri', 'ok');
    }
  } catch (e) {
    setStatus(t('st_connfail'), 'err'); out(t('msg_conn_error', { e: e.message }), 'err');
    out(t('msg_flash_hint'), 'sys');
    try { await repl.close(); } catch (_) {}
    setConnectedUI(false);
  }
}
async function disconnect() { if (wireless) wireless.stop(); await repl.close(); repl.port = null; setConnectedUI(false); setStatus(t('st_disconnected')); out(t('msg_disconnected'), 'sys'); }

// --- Kart bilgisi + pinout ---
function renderInfo(info) {
  if (!info) return;
  $('info').innerHTML = `
    <div><b>${t('info_chip')}</b><span>${esc(currentChip)}</span></div>
    <div><b>${t('info_model')}</b><span>${esc(info.machine)}</span></div>
    <div><b>${t('info_mpy')}</b><span>${esc(info.release)}</span></div>
    <div><b>${t('info_freq')}</b><span>${(info.freq / 1e6) | 0} MHz</span></div>
    <div><b>${t('info_flash')}</b><span>${(info.flash / 1048576) | 0} MB</span></div>
    <div><b>${t('info_freeram')}</b><span>${(info.mem_free / 1024) | 0} KB</span></div>
    <div><b>${t('info_uid')}</b><span>${esc(info.uid)}</span></div>`;
}
async function refreshInfo() {
  const { stdout, stderr } = await repl.exec(INFO_SCRIPT, 8000);
  if (stderr.trim()) throw new Error(stderr.trim());
  const info = JSON.parse(stdout.trim().split('\n').pop());
  lastInfo = info; currentChip = chipFromInfo(info);
  renderInfo(info);
  const sel = $('board-select'); sel.innerHTML = '';
  BOARDS.forEach((b) => { const o = document.createElement('option'); o.value = b.id; o.textContent = b.name + (b.chip === currentChip ? ' ✓' : ''); sel.appendChild(o); });
  sel.value = boardsForChip(currentChip)[0].id;
  drawBoard(sel.value);
}
function drawBoard(id) { renderPinout($('pinout'), getBoard(id), (g, a) => out(`GPIO${g} ${a ? '1' : '0'} (sim)\n`, 'sys')); }

// --- Dosya agaci ---
async function refreshFiles() {
  await dfiles.refresh();
  try { const d = await repl.fsDf(); $('df').textContent = t('df_usage', { used: (d.used / 1024) | 0, total: (d.total / 1024) | 0 }); } catch (e) {}
}
// Editorde kaydedilmemis degisiklik varsa kullaniciya sor (setValue oncesi).
function confirmDiscard() { return !cm.isDirty() || confirm(t('confirm_discard')); }
async function openFile(path, skipGuard = false) {
  if (!skipGuard && !confirmDiscard()) return;
  setStatus(t('st_opening'), 'busy');
  try {
    const text = await repl.fsReadText(path);
    cm.setValue(text); cm.markSaved(); curFile = path; $('cur-file').textContent = path;
    statusConnected();
  } catch (e) { out(t('msg_open_fail', { e: e.message }), 'err'); setStatus(t('st_error'), 'err'); }
}
async function saveToDevice() {
  let path = curFile;
  if (!path) { path = prompt(t('prompt_path'), '/main.py'); if (!path) return; }
  setStatus(t('st_saving'), 'busy');
  try {
    await repl.fsWrite(path, cm.getValue());
    cm.markSaved();
    curFile = path; $('cur-file').textContent = path;
    out(t('msg_saved', { path }), 'sys');
    await refreshFiles(); statusConnected();
  } catch (e) { out(t('msg_open_fail', { e: e.message }), 'err'); setStatus(t('st_error'), 'err'); }
}
async function newFile() {
  const path = prompt(t('prompt_newfile'), '/new.py'); if (!path) return;
  if (!confirmDiscard()) return;
  await repl.fsWrite(path, '# ' + path + '\n'); await refreshFiles(); openFile(path, true);
}
async function delSelected() {
  if (!dfiles.selected) { out(t('msg_pick_file'), 'sys'); return; }
  if (!confirm(t('confirm_delete', { path: dfiles.selected }))) return;
  try { await repl.fsDelete(dfiles.selected, dfiles.selectedType === 'dir'); await refreshFiles(); }
  catch (e) { out(t('msg_open_fail', { e: e.message }), 'err'); }
}
async function runSelected() {
  if (!dfiles.selected || dfiles.selectedType !== 'file') { out(t('msg_pick_file'), 'sys'); return; }
  await runCode(`exec(open(${JSON.stringify(dfiles.selected)}).read())`);
}

// --- Calistir ---
async function runCode(code) {
  if (!repl.connected) return;
  if (!$('plotter').classList.contains('active')) bottomTab('output');
  setStatus(t('st_running'), 'busy');
  out('\n▶ ' + new Date().toLocaleTimeString() + '\n', 'sys');
  try {
    const onChunk = (txt) => { out(txt); if (plotter) plotter.feed(txt); };
    const { stderr } = await repl.run(code, 60000, onChunk);
    if (stderr && !stderr.includes('KeyboardInterrupt')) out(stderr, 'err');
    out(t('run_done'), 'sys'); statusConnected();
  } catch (e) { out(t('run_error', { e: e.message }), 'err'); setStatus(t('st_error'), 'err'); }
}
const run = () => runCode(cm.getValue());
async function stop() { await repl.interrupt(); out(t('stopped'), 'sys'); }
async function resetBoard() { await repl.hardReset(); out(t('reset_done'), 'sys'); }

// --- Firmware ---
async function flash() {
  if (!navigator.serial) return alert(t('msg_need_serial'));
  if (!confirm(t('confirm_flash'))) return;
  $('flash-progress').classList.remove('hidden');
  try {
    if (repl.connected) await repl.close();
    if (!repl.port) await repl.requestPort();
    setStatus(t('st_firmware'), 'busy'); bottomTab('output');
    const res = await flashFirmware(repl.port, { onLog: (txt) => out(txt), onProgress: (p) => { $('flash-bar').style.width = ((p * 100) | 0) + '%'; } });
    out(t('flash_done', { name: res.firmware.ad }), 'sys');
    await new Promise((r) => setTimeout(r, 2500));
    await repl.open(parseInt($('baud').value, 10));
    setConnectedUI(true); await refreshInfo(); await refreshFiles(); await repl.terminalReady();
    statusConnected();
  } catch (e) { out(t('flash_error', { e: e.message }), 'err'); setStatus(t('st_error'), 'err'); }
  finally { setTimeout(() => $('flash-progress').classList.add('hidden'), 1500); }
}

// --- CSI firmware (özel .bin) yükleme ---
async function flashCsi(e) {
  const file = e.target.files[0]; e.target.value = ''; if (!file) return;
  const offset = parseInt($('csi-offset').value, 16) || 0;
  if (!navigator.serial) return alert(t('msg_need_serial'));
  if (!confirm(file.name + ' → 0x' + offset.toString(16) + ' ?')) return;
  $('flash-progress').classList.remove('hidden'); bottomTab('output');
  try {
    if (repl.connected) await repl.close();
    if (!repl.port) await repl.requestPort();
    setStatus(t('st_firmware'), 'busy');
    const res = await flashCustom(repl.port, file, offset, {
      onLog: (txt) => out(txt),
      onProgress: (p) => { $('flash-bar').style.width = ((p * 100) | 0) + '%'; },
    });
    out('\n✅ ' + file.name + ' (' + res.chipDesc + ')\n', 'sys');
    out('CSI firmware yüklendi. "Bağlan" → CSI sekmesinden akışı izle.\n', 'sys');
    setStatus(t('st_disconnected'));
  } catch (err) { out(t('flash_error', { e: err.message }), 'err'); setStatus(t('st_error'), 'err'); }
  finally { setTimeout(() => $('flash-progress').classList.add('hidden'), 1500); }
}

// --- Yerel senkron ---
async function pickFolder() {
  try { folderHandle = await pickLocalFolder(); $('s-folder').textContent = '📂 ' + folderHandle.name; $('s-push').disabled = $('s-pull').disabled = false; }
  catch (e) { /* iptal */ }
}
async function pushFolder() {
  if (!folderHandle || !repl.connected) return; bottomTab('output'); out(t('sync_push'), 'sys');
  try { await pushToDevice(repl, folderHandle, (txt) => out(txt)); await refreshFiles(); } catch (e) { out(t('sync_error', { e: e.message }), 'err'); }
}
async function pullFolder() {
  if (!folderHandle || !repl.connected) return; bottomTab('output'); out(t('sync_pull'), 'sys');
  try { await pullFromDevice(repl, folderHandle, (txt) => out(txt)); } catch (e) { out(t('sync_error', { e: e.message }), 'err'); }
}

// --- Ornek menusu ---
function buildExamples() {
  const exSel = $('examples');
  exSel.innerHTML = `<option value="">${t('examples')}</option>`;
  Object.keys(EXAMPLES).forEach((id) => { const o = document.createElement('option'); o.value = id; o.textContent = t('ex_' + id); exSel.appendChild(o); });
}

// --- Dil degisimi ---
function changeLang(l) {
  setLang(l);
  applyI18n();
  buildExamples();
  renderInfo(lastInfo);
  drawBoard($('board-select').value || BOARDS[0].id);
  if (repl.connected) statusConnected(); else setStatus(t('st_disconnected'));
  if (wireless && $('wireless').classList.contains('active')) wireless.scan();
}

// --- Baslat ---
function init() {
  cm = initEditor($('editor'), run);
  try { term = initTerminal($('terminal'), repl); }
  catch (e) { console.error('Terminal:', e); $('terminal').innerHTML = '<div class="err small" style="padding:8px">xterm.js?</div>'; }
  dfiles = new DeviceFiles($('tree'), repl, { openFile });
  plotter = new Plotter($('plot-canvas'), $('plot-legend'));
  wireless = new Wireless(repl, { results: $('wl-results'), auto: $('wl-auto') });
  csi = new CSI({ amp: $('csi-amp'), wf: $('csi-wf'), motion: $('csi-motion'), stats: $('csi-stats') });
  room = new Room({ room: $('room-canvas'), wave: $('room-wave'), timeline: $('room-timeline'),
    badge: $('room-badge'), motion: $('room-motion'), bpm: $('room-bpm'), stats: $('room-stats') });

  applyI18n();
  $('lang').value = getLang();
  buildExamples();

  $('examples').addEventListener('change', (e) => { if (EXAMPLES[e.target.value]) { if (confirmDiscard()) { cm.setValue(EXAMPLES[e.target.value]); cm.markSaved(); } e.target.value = ''; } });
  $('lang').addEventListener('change', (e) => changeLang(e.target.value));

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
  $('plot-clear').onclick = () => plotter.clear();
  $('plot-csv').onclick = () => plotter.downloadCSV();
  document.querySelectorAll('.wl-sub').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.wl-sub').forEach((x) => x.classList.toggle('active', x === b));
    wireless.setMode(b.dataset.wl);
  }));
  $('wl-scan').onclick = () => wireless.scan();
  $('wl-auto').addEventListener('change', (e) => wireless.setAuto(e.target.checked));
  $('csi-clear').onclick = () => csi.clear();
  $('csi-flash').onclick = () => $('csi-file').click();
  $('csi-file').addEventListener('change', flashCsi);
  $('room-calib').onclick = () => room.startCalibration();
  $('room-clear').onclick = () => room.clear();
  $('baud').addEventListener('change', async () => { if (repl.connected) { await repl.close(); await repl.open(parseInt($('baud').value, 10)); await repl.terminalReady(); } });

  drawBoard(BOARDS[0].id);
  if (!navigator.serial) { setStatus(t('st_disconnected'), 'err'); out(t('msg_serial_missing'), 'err'); }
  else { setStatus(t('st_disconnected')); out(t('msg_hint_connect'), 'sys'); }
}
init();
