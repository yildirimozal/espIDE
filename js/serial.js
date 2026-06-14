// serial.js — Web Serial + MicroPython raw / raw-paste REPL + dosya sistemi.
// Profesyonel cekirdek: hizli transfer (raw-paste), tam fs, reset/bootloader, terminal passthrough.

const enc = new TextEncoder();
const dec = new TextDecoder();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function concat(a, b) {
  const o = new Uint8Array(a.length + b.length);
  o.set(a, 0); o.set(b, a.length); return o;
}
function indexOf(buf, tok) {
  outer: for (let i = 0; i <= buf.length - tok.length; i++) {
    for (let j = 0; j < tok.length; j++) if (buf[i + j] !== tok[j]) continue outer;
    return i;
  }
  return -1;
}
// base64 (Uint8Array <-> string), tarayici atob/btoa ile
function b64encode(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function b64decode(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export class SerialREPL {
  constructor() {
    this.port = null;
    this.reader = null;
    this.writer = null;
    this.connected = false;
    this.baud = 115200;
    this._buf = new Uint8Array(0);
    this._pump = null;
    this.capturing = false;     // true: structured op (buffer'a yaz), false: terminal'e akit
    this.onData = null;         // terminal cikti dinleyicisi
    this.onDisconnect = null;   // beklenmedik kopma
    this.useRawPaste = true;
    this._chain = Promise.resolve(); // exec sira kilidi
  }

  async requestPort() { this.port = await navigator.serial.requestPort(); return this.port; }

  async open(baud = this.baud) {
    this.baud = baud;
    if (!this.port) await this.requestPort();
    await this.port.open({ baudRate: baud });
    this.writer = this.port.writable.getWriter();
    this.reader = this.port.readable.getReader();
    this.connected = true;
    this._buf = new Uint8Array(0);
    this._pump = this._readLoop();
  }

  async _readLoop() {
    try {
      while (this.reader) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value && value.length) {
          if (this.capturing) this._buf = concat(this._buf, value);
          else if (this.onData) this.onData(dec.decode(value));
          else this._buf = concat(this._buf, value);
        }
      }
    } catch (e) { /* iptal/kopma */ }
    if (this.connected && this.onDisconnect) { this.connected = false; this.onDisconnect(); }
  }

  async close() {
    this.connected = false;
    try { if (this.reader) { await this.reader.cancel(); this.reader.releaseLock(); } } catch (e) {}
    try { if (this.writer) { await this.writer.close(); this.writer.releaseLock(); } } catch (e) {}
    try { if (this._pump) await this._pump; } catch (e) {}
    try { if (this.port && this.port.readable) await this.port.close(); } catch (e) {}
    this.reader = this.writer = null;
  }

  async _write(data) { await this.writer.write(typeof data === 'string' ? enc.encode(data) : data); }
  _flush() { this._buf = new Uint8Array(0); }

  async _waitFor(token, timeoutMs = 10000) {
    const tok = enc.encode(token);
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const idx = indexOf(this._buf, tok);
      if (idx !== -1) { const r = this._buf.slice(0, idx + tok.length); this._buf = this._buf.slice(idx + tok.length); return r; }
      await sleep(6);
    }
    throw new Error('Zaman asimi ("' + token.replace(/[\x00-\x1f]/g, '?') + '" beklendi)');
  }

  async _readN(n, timeoutMs = 5000) {
    const deadline = Date.now() + timeoutMs;
    while (this._buf.length < n) {
      if (Date.now() > deadline) throw new Error('Zaman asimi (' + n + ' byte beklendi)');
      await sleep(4);
    }
    const r = this._buf.slice(0, n); this._buf = this._buf.slice(n); return r;
  }

  // --- RAW REPL ---
  async enterRaw(retries = 3) {
    this.capturing = true;
    for (let i = 0; i < retries; i++) {
      try {
        this._flush();
        await this._write('\r\x03\x03');
        await sleep(50);
        this._flush();
        await this._write('\r\x01');
        await this._waitFor('raw REPL; CTRL-B to exit\r\n>', 1500);
        return;
      } catch (e) { if (i === retries - 1) { this.capturing = false; throw e; } await sleep(250); }
    }
  }

  async exitRaw() {
    try { this._flush(); await this._write('\r\x02'); await sleep(40); } catch (e) {}
    this.capturing = false;
  }

  // stdout/stderr cercevesi: <stdout>\x04<stderr>\x04
  // onChunk verilirse stdout CANLI akar (idle-timeout ile uzun donguler desteklenir).
  async _follow(timeoutMs, onChunk) {
    let stdout;
    if (onChunk) stdout = await this._readUntilEmit(0x04, timeoutMs, onChunk);
    else { const o = await this._waitFor('\x04', timeoutMs); stdout = dec.decode(o.slice(0, -1)); }
    const e = await this._waitFor('\x04', 4000);
    return { stdout, stderr: dec.decode(e.slice(0, -1)) };
  }

  // \x04 gelene kadar oku; her yeni veriyi onChunk'a aktar. idleMs sessizlik sonrasi timeout.
  async _readUntilEmit(tokByte, idleMs, onChunk) {
    let collected = '';
    let deadline = Date.now() + idleMs;
    while (true) {
      if (Date.now() > deadline) throw new Error('Akış zaman aşımı (' + (idleMs / 1000) + ' sn sessizlik)');
      let i = -1;
      for (let k = 0; k < this._buf.length; k++) if (this._buf[k] === tokByte) { i = k; break; }
      if (i !== -1) {
        const c = this._buf.slice(0, i); this._buf = this._buf.slice(i + 1);
        if (c.length) { const t = dec.decode(c); collected += t; onChunk(t); }
        return collected;
      }
      if (this._buf.length) {
        const t = dec.decode(this._buf); this._buf = new Uint8Array(0);
        collected += t; onChunk(t); deadline = Date.now() + idleMs;
      }
      await sleep(12);
    }
  }

  // Normal raw exec (yedek yol)
  async _execNormal(code, timeoutMs, onChunk) {
    this._flush();
    await this._write(code);
    await this._write('\x04');
    await this._waitFor('OK', 4000);
    return this._follow(timeoutMs, onChunk);
  }

  // Raw-paste exec (hizli, akis kontrollu) — desteklenmezse normal'e duser
  async _execRawPaste(codeBytes, timeoutMs, onChunk) {
    this._flush();
    await this._write(new Uint8Array([0x05, 0x41, 0x01])); // \x05 A \x01
    const resp = await this._readN(2);
    if (!(resp[0] === 0x52 /* R */ && resp[1] === 0x01)) {
      // R\x00 (desteksiz) veya beklenmedik -> normal yola dus
      this.useRawPaste = false;
      // R\x00 ise cihaz raw moddadir; normal exec ile devam
      return this._execNormal(codeBytes, timeoutMs, onChunk);
    }
    const win = await this._readN(2);
    const window = win[0] | (win[1] << 8);
    let remain = window, i = 0;
    while (i < codeBytes.length) {
      while (remain === 0 || this._buf.length > 0) {
        if (this._buf.length === 0) { await sleep(2); continue; }
        const b = this._buf[0]; this._buf = this._buf.slice(1);
        if (b === 0x01) remain += window;
        else if (b === 0x04) { await this._write('\x04'); return this._follow(timeoutMs); }
      }
      const n = Math.min(remain, codeBytes.length - i);
      await this._write(codeBytes.slice(i, i + n));
      remain -= n; i += n;
    }
    await this._write('\x04');         // veri sonu
    await this._waitFor('\x04', 4000); // device ack
    return this._follow(timeoutMs, onChunk);
  }

  // Ana exec: raw REPL'e gir, raw-paste ile gonder, ciktiyi dondur.
  // onChunk verilirse stdout canli akar. Cagrilar siraya sokulur.
  async exec(code, timeoutMs = 30000, onChunk = null) {
    const bytes = typeof code === 'string' ? enc.encode(code) : code;
    const op = async () => {
      await this.enterRaw();
      try {
        return this.useRawPaste ? await this._execRawPaste(bytes, timeoutMs, onChunk) : await this._execNormal(bytes, timeoutMs, onChunk);
      } finally {
        await this.exitRaw(); // friendly REPL'e don -> terminal kullanilabilir kalir
      }
    };
    const p = this._chain.then(op, op);
    this._chain = p.then(() => {}, () => {});
    return p;
  }

  // Kullanici kodunu calistir (onChunk ile canli akis)
  async run(code, timeoutMs = 60000, onChunk = null) { return this.exec(code, timeoutMs, onChunk); }

  // Python ifadesini calistirip stdout (trim) dondur
  async evalPy(code, timeoutMs = 8000) {
    const { stdout, stderr } = await this.exec(code, timeoutMs);
    if (stderr.trim()) throw new Error(stderr.trim());
    return stdout;
  }

  // --- DOSYA SISTEMI ---
  async fsList(path = '/') {
    const code =
      'import os,ujson\n' +
      'p=' + JSON.stringify(path) + '\n' +
      'r=[]\n' +
      'try:\n' +
      ' for e in os.ilistdir(p):\n' +
      '  r.append([e[0], "dir" if e[1] & 0x4000 else "file", e[3] if len(e)>3 else 0])\n' +
      'except OSError as ex:\n' +
      ' print("ERR",ex); raise SystemExit\n' +
      'print(ujson.dumps(r))\n';
    const out = await this.evalPy(code);
    const line = out.trim().split('\n').pop();
    return JSON.parse(line).map(([name, type, size]) => ({ name, type, size }));
  }

  async fsRead(path) {
    const code =
      'import ubinascii\n' +
      'with open(' + JSON.stringify(path) + ',"rb") as f:\n' +
      ' print(ubinascii.b2a_base64(f.read()).decode().strip())\n';
    const out = await this.evalPy(code, 20000);
    return b64decode(out.trim().split('\n').pop());
  }
  async fsReadText(path) { return dec.decode(await this.fsRead(path)); }

  async fsWrite(path, data) {
    const bytes = typeof data === 'string' ? enc.encode(data) : data;
    const b64 = b64encode(bytes);
    const CH = 2048; // base64 parca
    let code = 'import ubinascii\nf=open(' + JSON.stringify(path) + ',"wb")\n';
    for (let i = 0; i < b64.length; i += CH) {
      code += 'f.write(ubinascii.a2b_base64(' + JSON.stringify(b64.slice(i, i + CH)) + '))\n';
    }
    code += 'f.close()\nprint("OK")\n';
    const out = await this.evalPy(code, 30000);
    if (!out.includes('OK')) throw new Error('Yazma dogrulanamadi');
  }

  async fsDelete(path, isDir = false) {
    await this.evalPy('import os\nos.' + (isDir ? 'rmdir' : 'remove') + '(' + JSON.stringify(path) + ')\nprint("OK")');
  }
  async fsMkdir(path) { await this.evalPy('import os\nos.mkdir(' + JSON.stringify(path) + ')\nprint("OK")'); }
  async fsRename(a, b) { await this.evalPy('import os\nos.rename(' + JSON.stringify(a) + ',' + JSON.stringify(b) + ')\nprint("OK")'); }
  async fsStat(path) {
    const out = await this.evalPy('import os,ujson\nprint(ujson.dumps(list(os.stat(' + JSON.stringify(path) + '))))');
    return JSON.parse(out.trim().split('\n').pop());
  }
  async fsDf() {
    const out = await this.evalPy('import os,ujson\ns=os.statvfs("/")\nprint(ujson.dumps([s[0]*s[2], s[0]*s[3]]))');
    const [total, free] = JSON.parse(out.trim().split('\n').pop());
    return { total, free, used: total - free };
  }

  // --- DONANIM KONTROLU ---
  async hardReset() { // EN pinini RTS ile dürt
    try {
      await this.port.setSignals({ dataTerminalReady: false, requestToSend: true });
      await sleep(120);
      await this.port.setSignals({ requestToSend: false });
    } catch (e) {}
  }

  async terminalReady() {
    // friendly REPL'e don, prompt'u terminale aktar
    await this.exitRaw();
    try { await this._write('\r\n'); } catch (e) {}
  }

  // Terminal modunda kullanici girisi
  async sendKeys(str) { try { await this._write(str); } catch (e) {} }
  async interrupt() { try { await this._write('\x03'); } catch (e) {} }
}
