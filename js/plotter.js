import { t } from './i18n.js';
// plotter.js — Canli coklu-seri grafik + zaman damgali log + CSV export.
// Seri ciktidan sayilari ayristirir:
//   "23.5"            -> tek seri
//   "23.5, 40, 1012"  -> coklu seri (s0,s1,s2)
//   "temp:23.5 hum:40"-> isimli seri (label:value)

const PALETTE = ['#58a6ff', '#3fb950', '#d29922', '#f85149', '#a371f7', '#39c5cf', '#db6d28', '#ec6cb9'];

export class Plotter {
  constructor(canvas, legendEl, { maxPoints = 600, maxLog = 200000 } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.legendEl = legendEl;
    this.maxPoints = maxPoints;
    this.maxLog = maxLog;
    this.series = new Map();   // name -> { color, values:[] }
    this.count = 0;            // toplam ornek sayisi
    this.log = [];             // { t, vals:{name:val} }
    this._line = '';
    this._dirty = false;
    this._t0 = null;
    this._loop();
  }

  feed(text) {
    this._line += text;
    let nl;
    while ((nl = this._line.indexOf('\n')) !== -1) {
      const line = this._line.slice(0, nl).replace(/\r$/, '');
      this._line = this._line.slice(nl + 1);
      this._parse(line);
    }
  }

  _parse(line) {
    line = line.trim();
    if (!line) return;
    const vals = {};
    // once label:value / label=value
    const pairRe = /([A-Za-z_][\w]*)\s*[:=]\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
    let m, hasPair = false;
    while ((m = pairRe.exec(line))) { vals[m[1]] = parseFloat(m[2]); hasPair = true; }
    if (!hasPair) {
      const nums = line.match(/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g);
      if (!nums) return; // sayisal degil -> yoksay
      nums.forEach((n, i) => { vals['s' + i] = parseFloat(n); });
    }
    this._addSample(vals);
  }

  _addSample(vals) {
    if (this._t0 === null) this._t0 = Date.now();
    // yeni seri varsa olustur + gecmisi NaN ile doldur
    for (const name of Object.keys(vals)) {
      if (!this.series.has(name)) {
        const color = PALETTE[this.series.size % PALETTE.length];
        const values = new Array(this.count).fill(NaN);
        this.series.set(name, { color, values });
      }
    }
    // her seriye degerini (yoksa NaN) ekle
    for (const [name, s] of this.series) {
      s.values.push(name in vals ? vals[name] : NaN);
      if (s.values.length > this.maxPoints) s.values.shift();
    }
    this.count++;
    // log
    if (this.log.length < this.maxLog) this.log.push({ t: (Date.now() - this._t0) / 1000, vals: { ...vals } });
    this._dirty = true;
  }

  _loop() {
    const tick = () => {
      if (this._dirty) { this._draw(); this._dirty = false; }
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.canvas.width = w * dpr; this.canvas.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._dirty = true;
  }

  _draw() {
    const ctx = this.ctx;
    const W = this.canvas.clientWidth, H = this.canvas.clientHeight;
    ctx.clearRect(0, 0, W, H);
    const padL = 48, padR = 8, padT = 10, padB = 18;
    const plotW = W - padL - padR, plotH = H - padT - padB;

    // min/max
    let min = Infinity, max = -Infinity, n = 0;
    for (const s of this.series.values()) for (const v of s.values) {
      if (Number.isFinite(v)) { if (v < min) min = v; if (v > max) max = v; n++; }
    }
    if (!n) {
      ctx.fillStyle = '#8b949e'; ctx.font = '13px monospace';
      ctx.fillText(t('plot_waiting'), padL, H / 2);
      return;
    }
    if (min === max) { min -= 1; max += 1; }
    const range = max - min;
    const y = (v) => padT + plotH - ((v - min) / range) * plotH;

    // izgara + eksen etiketleri
    ctx.strokeStyle = '#21262d'; ctx.fillStyle = '#6e7681'; ctx.font = '10px monospace'; ctx.lineWidth = 1;
    for (let g = 0; g <= 4; g++) {
      const val = min + (range * g) / 4;
      const yy = y(val);
      ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(W - padR, yy); ctx.stroke();
      ctx.fillText(val.toFixed(range < 10 ? 2 : 0), 4, yy + 3);
    }

    // seriler
    const maxLen = Math.max(...[...this.series.values()].map((s) => s.values.length), 1);
    const x = (i) => padL + (maxLen <= 1 ? 0 : (i / (maxLen - 1)) * plotW);
    for (const s of this.series.values()) {
      ctx.strokeStyle = s.color; ctx.lineWidth = 1.5; ctx.beginPath();
      let started = false;
      s.values.forEach((v, i) => {
        if (!Number.isFinite(v)) { started = false; return; }
        const px = x(i), py = y(v);
        if (started) ctx.lineTo(px, py); else { ctx.moveTo(px, py); started = true; }
      });
      ctx.stroke();
    }
    this._legend();
  }

  _legend() {
    if (!this.legendEl) return;
    let html = '';
    for (const [name, s] of this.series) {
      const last = [...s.values].reverse().find((v) => Number.isFinite(v));
      html += `<span class="ls"><i style="background:${s.color}"></i>${name}: <b>${last !== undefined ? last : '—'}</b></span>`;
    }
    html += `<span class="ls muted">${t('plot_samples', { n: this.count })}</span>`;
    this.legendEl.innerHTML = html;
  }

  clear() {
    this.series = new Map(); this.count = 0; this.log = []; this._line = ''; this._t0 = null; this._dirty = true;
    if (this.legendEl) this.legendEl.innerHTML = '';
  }

  exportCSV() {
    const names = [...this.series.keys()];
    let csv = 'time_s,' + names.join(',') + '\n';
    for (const row of this.log) {
      csv += row.t.toFixed(3) + ',' + names.map((nm) => (nm in row.vals ? row.vals[nm] : '')).join(',') + '\n';
    }
    return csv;
  }

  downloadCSV(filename = 'esp32-log.csv') {
    const blob = new Blob([this.exportCSV()], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
}
