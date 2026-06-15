import { t } from './i18n.js';
// wireless.js — Telsiz izleme: WiFi tarayıcı + kanal grafiği + BLE tarayıcı.
// Karttaki taramayı exec ile çalıştırır, JSON sonucu canlı tabloya döker.

const WIFI_SCAN = `
import network, ujson
w = network.WLAN(network.STA_IF); w.active(True)
res = []
for n in w.scan():
    ssid = n[0].decode('utf-8','ignore') if isinstance(n[0],(bytes,bytearray)) else str(n[0])
    res.append([ssid, ':'.join('%02X'%b for b in n[1]), n[2], n[3], n[4], n[5]])
print(ujson.dumps(res))
`;

const BLE_SCAN = `
import bluetooth, ujson, time
ble = bluetooth.BLE(); ble.active(True)
found = {}
def _irq(ev, data):
    if ev == 5:
        at, addr, adt, rssi, adv = data
        mac = ':'.join('%02X'%b for b in addr)
        ad = bytes(adv); name=''; i=0
        while i < len(ad):
            ln = ad[i]
            if ln == 0: break
            if i+1 < len(ad) and ad[i+1] in (8,9):
                name = bytes(ad[i+2:i+1+ln]).decode('utf-8','ignore')
            i += 1+ln
        cur = found.get(mac)
        if (cur is None) or (name and not cur[0]):
            found[mac] = [name, mac, rssi]
        else:
            cur[2] = rssi
ble.irq(_irq)
ble.gap_scan(3000, 30000, 30000)
time.sleep_ms(3400)
try: ble.gap_scan(None)
except: pass
print(ujson.dumps(list(found.values())))
`;

const AUTH = ['Open', 'WEP', 'WPA', 'WPA2', 'WPA/WPA2', 'WPA2-ENT', 'WPA3', 'WPA2/WPA3', 'WAPI'];
const authLabel = (n) => AUTH[n] || ('auth' + n);
const rssiPct = (r) => Math.max(3, Math.min(100, Math.round(2 * (r + 100)))); // -100..-50 -> 0..100
const rssiColor = (r) => (r > -60 ? '#3fb950' : r > -75 ? '#d29922' : '#f85149');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function bar(rssi) {
  return `<span class="rssi"><span class="rssi-fill" style="width:${rssiPct(rssi)}%;background:${rssiColor(rssi)}"></span></span><span class="rssi-n">${rssi} dBm</span>`;
}

export class Wireless {
  constructor(repl, els) {
    this.repl = repl;
    this.results = els.results;   // #wl-results
    this.autoBox = els.auto || null;  // #wl-auto (durumu UI ile esitlemek icin)
    this.mode = 'wifi';
    this.busy = false;
    this.auto = false;
    this.timer = null;
  }

  setMode(m) { this.mode = m; this.results.innerHTML = ''; this.scan(); }

  setAuto(on) {
    this.auto = on;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (on) this.timer = setInterval(() => this.scan(), this.mode === 'ble' ? 6000 : 4500);
  }

  stop() {
    this.auto = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.autoBox) this.autoBox.checked = false;   // UI'yi durumla esitle
  }

  async scan() {
    if (!this.repl.connected) { this.results.innerHTML = `<div class="muted small">${t('w_not_connected')}</div>`; return; }
    if (this.busy) return;
    this.busy = true;
    const mode = this.mode;
    try {
      const { stdout, stderr } = await this.repl.exec(mode === 'ble' ? BLE_SCAN : WIFI_SCAN, mode === 'ble' ? 9000 : 8000);
      if (stderr.trim()) throw new Error(stderr.trim());
      const data = JSON.parse(stdout.trim().split('\n').pop());
      if (mode !== this.mode) return; // arada sekme degisti
      mode === 'ble' ? this._renderBle(data) : this._renderWifi(data);
    } catch (e) {
      this.results.innerHTML = `<div class="err small">${esc(e.message)}</div>`;
    } finally { this.busy = false; }
  }

  _renderWifi(list) {
    list.sort((a, b) => b[3] - a[3]);
    // kanal histogrami (1-13)
    const ch = new Array(14).fill(0);
    list.forEach((n) => { if (n[2] >= 1 && n[2] <= 13) ch[n[2]]++; });
    const maxc = Math.max(1, ...ch);
    let chart = `<div class="wl-chart"><div class="wl-chart-title">${t('w_ch_usage')}</div><div class="wl-bars">`;
    for (let c = 1; c <= 13; c++) {
      const h = ch[c] ? Math.round((ch[c] / maxc) * 100) : 0;
      const hot = [1, 6, 11].includes(c);
      chart += `<div class="wl-cbar" title="ch ${c}: ${ch[c]}"><span style="height:${h}%;background:${ch[c] ? (hot ? '#58a6ff' : '#6e7681') : 'transparent'}"></span><b class="${hot ? 'hot' : ''}">${c}</b></div>`;
    }
    chart += '</div></div>';

    let rows = list.map((n) => {
      const [ssid, mac, channel, rssi, auth] = n;
      const secure = auth > 0;
      return `<tr>
        <td class="nm">${ssid ? esc(ssid) : '<i class="muted">' + t('w_hidden') + '</i>'}<div class="sub">${mac}</div></td>
        <td class="sig">${bar(rssi)}</td>
        <td class="ch">${channel}</td>
        <td class="sec">${secure ? '🔒' : '🔓'} ${authLabel(auth)}</td>
      </tr>`;
    }).join('');

    this.results.innerHTML = `${chart}
      <div class="wl-count">${t('w_found', { n: list.length })}</div>
      <table class="wl-table"><thead><tr>
        <th>${t('col_ssid')}</th><th>${t('col_signal')}</th><th>${t('col_channel')}</th><th>${t('col_security')}</th>
      </tr></thead><tbody>${rows || `<tr><td colspan="4" class="muted">${t('w_no_results')}</td></tr>`}</tbody></table>`;
  }

  _renderBle(list) {
    list.sort((a, b) => b[2] - a[2]);
    let rows = list.map((d) => {
      const [name, mac, rssi] = d;
      return `<tr>
        <td class="nm">${name ? esc(name) : '<i class="muted">' + t('w_noname') + '</i>'}</td>
        <td class="mac">${mac}</td>
        <td class="sig">${bar(rssi)}</td>
      </tr>`;
    }).join('');
    this.results.innerHTML = `<div class="wl-note muted small">${t('w_ble_note')}</div>
      <div class="wl-count">${t('w_found', { n: list.length })}</div>
      <table class="wl-table"><thead><tr>
        <th>${t('col_name')}</th><th>${t('col_mac')}</th><th>${t('col_signal')}</th>
      </tr></thead><tbody>${rows || `<tr><td colspan="3" class="muted">${t('w_no_results')}</td></tr>`}</tbody></table>`;
  }
}
