import { t } from './i18n.js';
// room.js — WiFi-sensing "Oda Algılama" paneli (ML yok, sadece DSP).
// CSI akışından: varlık (Boş/Dolu/Hareket) + hareket yoğunluğu + nefes hızı (FFT).
// Dürüst kapsam: insan/hareket sensingi. Konum/nesne değil.

const N = 256;            // FFT / geçmiş penceresi (2'nin kuvveti)
const MOTION_WIN = 48;    // hareket için kayan pencere

// İteratif radix-2 FFT (yerinde). re,im uzunluğu 2'nin kuvveti.
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { const tr = re[i]; re[i] = re[j]; re[j] = tr; const ti = im[i]; im[i] = im[j]; im[j] = ti; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cwr = 1, cwi = 0;
      for (let k = 0; k < len >> 1; k++) {
        const a = i + k, b = a + (len >> 1);
        const tr = re[b] * cwr - im[b] * cwi, ti = re[b] * cwi + im[b] * cwr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const n2 = cwr * wr - cwi * wi; cwi = cwr * wi + cwi * wr; cwr = n2;
      }
    }
  }
}

export class Room {
  constructor(els) {
    this.roomC = els.room; this.rctx = this.roomC.getContext('2d');
    this.waveC = els.wave; this.wctx = this.waveC.getContext('2d');
    this.tlC = els.timeline; this.tctx = this.tlC.getContext('2d');
    this.badge = els.badge; this.motionEl = els.motion; this.bpmEl = els.bpm; this.statsEl = els.stats;
    this._line = '';
    this.nsub = 0; this.count = 0;
    this.hist = []; this.times = [];     // ring (N): amplitude dizileri + zaman
    this.win = [];                       // hareket penceresi
    this.motion = 0; this.max = 1;
    this.baseline = null; this.baseScale = 1; this.calibrating = 0; this._calibBuf = [];
    this.bpm = null; this.bpmConf = 0; this.waveSig = null;
    this.motionTL = [];                  // hareket zaman çizgisi (son ~300)
    this.state = 'idle';
    this._t0 = null; this._rate = 0; this._rc = 0; this._rt = null;
    this._lastCalc = 0;
    this.resize(); this._loop();
  }

  feed(text) {
    this._line += text; let nl;
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
    const n = nums.length >> 1, amp = new Float32Array(n);
    let mx = 0;
    for (let k = 0; k < n; k++) {
      const im = +nums[2 * k] || 0, re = +nums[2 * k + 1] || 0;
      const a = Math.sqrt(im * im + re * re); amp[k] = a; if (a > mx) mx = a;
    }
    this.nsub = n; this.count++; this.max = Math.max(mx, this.max * 0.995, 1);
    this.hist.push(amp); this.times.push(Date.now());
    if (this.hist.length > N) { this.hist.shift(); this.times.shift(); }
    this.win.push(amp); if (this.win.length > MOTION_WIN) this.win.shift();
    if (this.calibrating) { this._calibBuf.push(amp); }
    this._motion();
    const now = Date.now();
    if (this._t0 === null) { this._t0 = now; this._rt = now; }
    this._rc++; if (now - this._rt > 1000) { this._rate = this._rc * 1000 / (now - this._rt); this._rc = 0; this._rt = now; }
    if (now - this._lastCalc > 500) { this._lastCalc = now; this._analyze(); }
  }

  _motion() {
    const W = this.win.length; if (W < 4) { this.motion = 0; return; }
    const n = this.nsub; let acc = 0;
    for (let k = 0; k < n; k++) {
      let s = 0, ss = 0;
      for (let i = 0; i < W; i++) { const v = this.win[i][k] || 0; s += v; ss += v * v; }
      const m = s / W; acc += Math.max(0, ss / W - m * m);
    }
    this.motion = Math.max(0, Math.min(1, Math.sqrt(acc / n) / (this.max * 0.05)));
    this.motionTL.push(this.motion); if (this.motionTL.length > 300) this.motionTL.shift();
  }

  startCalibration() { this.calibrating = Date.now(); this._calibBuf = []; }

  _finishCalib() {
    const buf = this._calibBuf; if (!buf.length) { this.calibrating = 0; return; }
    const n = this.nsub, base = new Float32Array(n);
    for (const a of buf) for (let k = 0; k < n; k++) base[k] += a[k] || 0;
    let sum = 0; for (let k = 0; k < n; k++) { base[k] /= buf.length; sum += base[k]; }
    this.baseline = base; this.baseScale = Math.max(1, sum / n);
    this.calibrating = 0; this._calibBuf = [];
  }

  _analyze() {
    if (this.calibrating && Date.now() - this.calibrating > 3000) this._finishCalib();
    // varlık durumu
    let dev = 0;
    if (this.baseline && this.hist.length) {
      const cur = this.hist[this.hist.length - 1], n = this.nsub; let d = 0;
      for (let k = 0; k < n; k++) d += Math.abs((cur[k] || 0) - (this.baseline[k] || 0));
      dev = (d / n) / this.baseScale;
    }
    if (this.calibrating) this.state = 'calibrating';
    else if (this.motion > 0.32) this.state = 'motion';
    else if (this.baseline && dev > 0.05) this.state = 'occupied';
    else if (!this.baseline) this.state = this.motion > 0.12 ? 'motion' : 'idle';
    else this.state = 'empty';
    // nefes (FFT)
    this._breathing();
  }

  _breathing() {
    if (this.hist.length < N) { this.bpm = null; this.bpmConf = 0; return; }
    const n = this.nsub;
    // en değişken subcarrier'ı seç
    let kBest = 0, vBest = -1;
    for (let k = 0; k < n; k++) {
      let s = 0, ss = 0;
      for (let i = 0; i < N; i++) { const v = this.hist[i][k] || 0; s += v; ss += v * v; }
      const varr = ss / N - (s / N) ** 2; if (varr > vBest) { vBest = varr; kBest = k; }
    }
    const re = new Float64Array(N), im = new Float64Array(N);
    let mean = 0; for (let i = 0; i < N; i++) mean += this.hist[i][kBest] || 0; mean /= N;
    for (let i = 0; i < N; i++) { const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)); re[i] = ((this.hist[i][kBest] || 0) - mean) * w; }
    this.waveSig = re.slice(0, N);
    fft(re, im);
    const fs = 1000 / Math.max(1, (this.times[N - 1] - this.times[0]) / (N - 1)); // Hz
    const lo = 0.1, hi = 0.5;
    let peak = -1, peakBin = -1, total = 1e-9;
    for (let kb = 1; kb < N / 2; kb++) {
      const f = kb * fs / N, p = re[kb] * re[kb] + im[kb] * im[kb];
      if (f >= 0.05 && f <= 1.0) total += p;
      if (f >= lo && f <= hi && p > peak) { peak = p; peakBin = kb; }
    }
    const conf = peakBin > 0 ? peak / total : 0;
    if (peakBin > 0 && conf > 0.18 && fs > 1) {
      // parabolik interpolasyon -> alt-bin frekans çözünürlüğü (daha doğru BPM)
      let bf = peakBin;
      if (peakBin > 1 && peakBin < N / 2 - 1) {
        const a = re[peakBin - 1] * re[peakBin - 1] + im[peakBin - 1] * im[peakBin - 1];
        const cc = re[peakBin + 1] * re[peakBin + 1] + im[peakBin + 1] * im[peakBin + 1];
        const den = a - 2 * peak + cc;
        if (den !== 0) { const d = 0.5 * (a - cc) / den; if (Math.abs(d) < 1) bf = peakBin + d; }
      }
      this.bpm = Math.round(bf * fs / N * 60); this.bpmConf = conf;
    } else { this.bpm = null; this.bpmConf = conf; }
  }

  _loop() {
    const tick = () => {
      // Yalnizca panel goruntulenirken ciz: sekme gizliyken (#room display:none)
      // offsetParent null olur -> ~60fps bos canvas cizimi israfini onler.
      if (this.roomC.offsetParent !== null) this._draw();
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  _stateInfo() {
    return ({
      idle: ['#6e7681', t('room_idle')],
      empty: ['#3fb950', t('room_empty')],
      occupied: ['#d29922', t('room_occupied')],
      motion: ['#f85149', t('room_motion')],
      calibrating: ['#58a6ff', t('room_calibrating')],
    })[this.state] || ['#6e7681', '—'];
  }

  _draw() {
    const [col, label] = this._stateInfo();
    // rozet + metrikler
    if (this.badge) { this.badge.textContent = label; this.badge.style.color = col; this.badge.style.borderColor = col; }
    if (this.motionEl) this.motionEl.innerHTML = `${t('room_motion_lbl')}: <b>${Math.round(this.motion * 100)}%</b>`;
    if (this.bpmEl) this.bpmEl.innerHTML = `${t('room_breath')}: <b>${this.bpm ? this.bpm + ' BPM' : '—'}</b>`;
    if (this.statsEl) this.statsEl.textContent = t('csi_stats', { n: this.count, sub: this.nsub, rate: Math.round(this._rate) });
    this._drawRoom(col);
    this._drawWave(col);
    this._drawTimeline();
  }

  _drawRoom(col) {
    const c = this.rctx, W = this.roomC.clientWidth, H = this.roomC.clientHeight;
    c.clearRect(0, 0, W, H);
    const m = 14, rw = W - 2 * m, rh = H - 2 * m;
    c.strokeStyle = '#30363d'; c.lineWidth = 2;
    c.strokeRect(m, m, rw, rh);
    c.fillStyle = '#6e7681'; c.font = '10px monospace'; c.fillText('oda / room', m + 4, m + 14);
    if (!this.count) {
      c.fillStyle = '#8b949e'; c.font = '12px monospace'; c.fillText(t('csi_waiting'), m + 6, H / 2);
      return;
    }
    // varlık blobu (merkez) — boyut/parlaklık = hareket+varlık
    const cx = W / 2, cy = H / 2;
    const present = this.state === 'occupied' || this.state === 'motion';
    const intensity = this.state === 'motion' ? 0.5 + this.motion * 0.5 : present ? 0.45 : 0.15;
    const pulse = this.bpm ? 1 + 0.12 * Math.sin(Date.now() / 1000 * (this.bpm / 60) * 2 * Math.PI) : 1;
    const r = Math.min(rw, rh) * 0.22 * (0.6 + intensity) * pulse;
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, col + 'cc'); g.addColorStop(1, col + '00');
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill();
    c.fillStyle = col; c.beginPath(); c.arc(cx, cy, 5, 0, 7); c.fill();
  }

  _drawWave(col) {
    const c = this.wctx, W = this.waveC.clientWidth, H = this.waveC.clientHeight;
    c.clearRect(0, 0, W, H);
    c.fillStyle = '#6e7681'; c.font = '9px monospace'; c.fillText(t('room_breath'), 4, 11);
    if (!this.waveSig) return;
    const s = this.waveSig; let mx = 1e-6; for (const v of s) mx = Math.max(mx, Math.abs(v));
    c.strokeStyle = this.bpm ? col : '#30363d'; c.lineWidth = 1.5; c.beginPath();
    for (let i = 0; i < s.length; i++) {
      const x = i / (s.length - 1) * W, y = H / 2 - (s[i] / mx) * (H / 2 - 6);
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.stroke();
  }

  _drawTimeline() {
    const c = this.tctx, W = this.tlC.clientWidth, H = this.tlC.clientHeight;
    c.clearRect(0, 0, W, H);
    c.fillStyle = '#6e7681'; c.font = '9px monospace'; c.fillText(t('room_motion_lbl'), 4, 11);
    const tl = this.motionTL; if (!tl.length) return;
    c.fillStyle = '#1f6feb44';
    const bw = W / 300;
    for (let i = 0; i < tl.length; i++) {
      const h = tl[i] * (H - 4), x = (300 - tl.length + i) * bw;
      c.fillStyle = tl[i] > 0.32 ? '#f8514988' : '#3fb95066';
      c.fillRect(x, H - h, Math.ceil(bw), h);
    }
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    for (const cv of [this.roomC, this.waveC, this.tlC]) {
      cv.width = cv.clientWidth * dpr; cv.height = cv.clientHeight * dpr;
      cv.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  clear() {
    this.hist = []; this.times = []; this.win = []; this.motionTL = []; this.count = 0;
    this.motion = 0; this.max = 1; this.bpm = null; this.bpmConf = 0; this.baseline = null; this.state = 'idle';
    this.calibrating = 0; this._calibBuf = []; this.waveSig = null; this.nsub = 0;
    this._line = ''; this._t0 = null; this._rate = 0; this._rc = 0; this._lastCalc = 0;
  }
}
