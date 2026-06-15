import { t } from './i18n.js';
// csi.js — WiFi CSI (Channel State Information) görselleştirici.
// CSI firmware'inin (ör. ESP32-CSI-Tool / esp-csi) seri porttan akıttığı
// "CSI_DATA,...,[im re im re ...]" satırlarını ayrıştırır:
//   genlik_k = sqrt(im_k^2 + re_k^2)
// Gösterim: anlık genlik grafiği + scrolling waterfall ısı haritası + hareket metriği.

const MOTION_WIN = 64; // hareket için kayan pencere (paket)

// genlik 0..1 -> renk (koyu lacivert → camgöbeği → yeşil → sarı → kırmızı)
const STOPS = [[13,17,40],[31,111,235],[57,197,187],[63,185,80],[210,153,34],[248,81,73]];
function ampColor(v) {
  v = Math.max(0, Math.min(1, v)) * (STOPS.length - 1);
  const i = Math.floor(v), f = v - i, a = STOPS[i], b = STOPS[Math.min(i + 1, STOPS.length - 1)];
  return `rgb(${a[0]+(b[0]-a[0])*f|0},${a[1]+(b[1]-a[1])*f|0},${a[2]+(b[2]-a[2])*f|0})`;
}

export class CSI {
  constructor(els) {
    this.amp = els.amp; this.actx = this.amp.getContext('2d');
    this.wf = els.wf;   this.wctx = this.wf.getContext('2d');
    this.motionEl = els.motion; this.statsEl = els.stats;
    this._line = '';
    this.latest = null;     // son paketin genlikleri
    this.nsub = 0;
    this.count = 0;
    this.max = 1;           // dinamik genlik tavanı (renk ölçeği)
    this.pending = [];      // waterfall için bekleyen satırlar
    this.win = [];          // hareket penceresi (genlik dizileri)
    this.motion = 0;        // 0..1
    this._t0 = null; this._rate = 0; this._rcount = 0; this._rt = null;
    this._dirty = false;
    this.resize();
    this._loop();
  }

  feed(text) {
    this._line += text;
    let nl;
    while ((nl = this._line.indexOf('\n')) !== -1) {
      const line = this._line.slice(0, nl); this._line = this._line.slice(nl + 1);
      this._parse(line);
    }
    if (this._line.length > 65536) this._line = this._line.slice(-8192);
  }

  _parse(line) {
    if (line.indexOf('CSI_DATA') === -1) return;
    const lb = line.indexOf('['), rb = line.indexOf(']', lb);
    if (lb === -1 || rb === -1) return;
    const nums = line.slice(lb + 1, rb).trim().split(/[\s,]+/);
    if (nums.length < 4) return;
    const n = nums.length >> 1;
    const amp = new Float32Array(n);
    let mx = 0;
    for (let k = 0; k < n; k++) {
      const im = +nums[2 * k] || 0, re = +nums[2 * k + 1] || 0;
      const a = Math.sqrt(im * im + re * re);
      amp[k] = a; if (a > mx) mx = a;
    }
    this.latest = amp; this.nsub = n; this.count++;
    // dinamik tavan (yumuşak takip)
    this.max = Math.max(mx, this.max * 0.995, 1);
    this.pending.push(amp); if (this.pending.length > 240) this.pending.shift();
    // hareket: kayan pencerede subcarrier başına varyans
    this.win.push(amp); if (this.win.length > MOTION_WIN) this.win.shift();
    this._motion();
    // paket hızı
    const now = Date.now();
    if (this._t0 === null) { this._t0 = now; this._rt = now; }
    this._rcount++;
    if (now - this._rt > 1000) { this._rate = this._rcount * 1000 / (now - this._rt); this._rcount = 0; this._rt = now; }
    this._dirty = true;
  }

  _motion() {
    const W = this.win.length; if (W < 4) { this.motion = 0; return; }
    const n = this.nsub; let acc = 0;
    for (let k = 0; k < n; k++) {
      let s = 0, ss = 0;
      for (let i = 0; i < W; i++) { const v = this.win[i][k] || 0; s += v; ss += v * v; }
      const mean = s / W; acc += Math.max(0, ss / W - mean * mean); // varyans
    }
    const std = Math.sqrt(acc / n);
    // normalize: tavanın ~%6'sı tam hareket sayılır (deneysel)
    this.motion = Math.max(0, Math.min(1, std / (this.max * 0.06)));
  }

  _loop() {
    const tick = () => {
      // waterfall: bekleyenleri kaydırarak çiz (kare başına en çok 6)
      let drawn = 0;
      while (this.pending.length && drawn < 6) { this._wfRow(this.pending.shift()); drawn++; }
      if (this._dirty) { this._drawAmp(); this._stats(); this._dirty = false; }
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  _wfRow(amp) {
    const W = this.wf.width, H = this.wf.height, n = amp.length || 1;
    // 1px yukarı kaydır
    this.wctx.drawImage(this.wf, 0, -1);
    // en alt satıra yeni paketi çiz
    const cw = W / n;
    for (let k = 0; k < n; k++) {
      this.wctx.fillStyle = ampColor(amp[k] / this.max);
      this.wctx.fillRect(k * cw, H - 1, Math.ceil(cw), 1);
    }
  }

  _drawAmp() {
    const c = this.actx, W = this.amp.clientWidth, H = this.amp.clientHeight;
    c.clearRect(0, 0, W, H);
    if (!this.latest) {
      c.fillStyle = '#8b949e'; c.font = '13px monospace';
      c.fillText(t('csi_waiting'), 14, H / 2); return;
    }
    const n = this.nsub, mx = this.max;
    c.strokeStyle = '#21262d'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, H - 1); c.lineTo(W, H - 1); c.stroke();
    c.strokeStyle = '#58a6ff'; c.lineWidth = 1.5; c.beginPath();
    for (let k = 0; k < n; k++) {
      const x = (k / (n - 1)) * W, y = H - (this.latest[k] / mx) * (H - 6) - 3;
      k ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.stroke();
  }

  _stats() {
    if (this.motionEl) {
      const pct = Math.round(this.motion * 100);
      const on = this.motion > 0.35;
      const dots = '●'.repeat(Math.round(this.motion * 5)) + '○'.repeat(5 - Math.round(this.motion * 5));
      this.motionEl.innerHTML = `<span class="csi-dot ${on ? 'on' : ''}"></span>` +
        `${t('csi_motion')}: <b style="color:${on ? '#f85149' : '#3fb950'}">${dots} ${pct}%</b>`;
    }
    if (this.statsEl)
      this.statsEl.textContent = t('csi_stats', { n: this.count, sub: this.nsub, rate: Math.round(this._rate) });
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.amp.width = this.amp.clientWidth * dpr; this.amp.height = this.amp.clientHeight * dpr;
    this.actx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // waterfall: raw piksel (kaydırma hassasiyeti için), içerik korunur
    const nw = this.wf.clientWidth * dpr, nh = this.wf.clientHeight * dpr;
    if (nw && nh && (this.wf.width !== nw || this.wf.height !== nh)) {
      this.wf.width = nw; this.wf.height = nh;
      this.wctx.fillStyle = '#0d1117'; this.wctx.fillRect(0, 0, nw, nh);
    }
    this._dirty = true;
  }

  clear() {
    this.latest = null; this.count = 0; this.max = 1; this.pending = []; this.win = []; this.motion = 0;
    this._line = ''; this._t0 = null; this._rate = 0; this._rcount = 0;
    this.wctx.fillStyle = '#0d1117'; this.wctx.fillRect(0, 0, this.wf.width, this.wf.height);
    this._dirty = true; this._stats();
  }
}
