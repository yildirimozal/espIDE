// serial.js — Web Serial API + MicroPython "raw REPL" protokolu
// Karta USB uzerinden baglanir, kod calistirir, ciktiyi okur.

const enc = new TextEncoder();
const dec = new TextDecoder();

function concat(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function indexOf(buf, token) {
  outer: for (let i = 0; i <= buf.length - token.length; i++) {
    for (let j = 0; j < token.length; j++) {
      if (buf[i + j] !== token[j]) continue outer;
    }
    return i;
  }
  return -1;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class SerialREPL {
  constructor() {
    this.port = null;
    this.reader = null;
    this.writer = null;
    this.connected = false;
    this._buf = new Uint8Array(0);
    this._pump = null;
    this.onData = null; // canli cikti dinleyicisi (opsiyonel)
  }

  // Mevcut bir portu paylas (firmware yukleme ile ayni portu kullanmak icin)
  async requestPort() {
    this.port = await navigator.serial.requestPort();
    return this.port;
  }

  async open(baud = 115200) {
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
      while (this.port && this.port.readable && this.reader) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value && value.length) {
          this._buf = concat(this._buf, value);
          if (this.onData) this.onData(dec.decode(value));
        }
      }
    } catch (e) {
      // okuma iptal edildi / port kapandi
    }
  }

  async close() {
    this.connected = false;
    try { if (this.reader) { await this.reader.cancel(); this.reader.releaseLock(); } } catch (e) {}
    try { if (this.writer) { await this.writer.close(); this.writer.releaseLock(); } } catch (e) {}
    try { if (this._pump) await this._pump; } catch (e) {}
    try { if (this.port && this.port.readable) await this.port.close(); } catch (e) {}
    this.reader = null;
    this.writer = null;
  }

  async _write(data) {
    await this.writer.write(typeof data === 'string' ? enc.encode(data) : data);
  }

  // Tampon icinde token gorunene kadar bekle, o ana kadarki veriyi dondur (token dahil)
  async _waitFor(token, timeoutMs = 10000) {
    const tok = enc.encode(token);
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const idx = indexOf(this._buf, tok);
      if (idx !== -1) {
        const upto = this._buf.slice(0, idx + tok.length);
        this._buf = this._buf.slice(idx + tok.length);
        return upto;
      }
      await sleep(8);
    }
    throw new Error('Zaman asimi: karttan yanit gelmedi ("' + token + '" beklendi)');
  }

  _flush() { this._buf = new Uint8Array(0); }

  // Ham (raw) REPL moduna gir — calisan programi durdurur
  async enterRaw(retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        this._flush();
        await this._write('\r\x03\x03'); // Ctrl-C x2: programi durdur
        await sleep(60);
        this._flush();
        await this._write('\r\x01');       // Ctrl-A: raw REPL
        await this._waitFor('raw REPL; CTRL-B to exit\r\n>', 1500);
        return;
      } catch (e) {
        if (i === retries - 1) throw e;
        await sleep(300);
      }
    }
  }

  // Friendly (normal) REPL'e don
  async exitRaw() {
    try {
      this._flush();
      await this._write('\r\x02'); // Ctrl-B
      await sleep(50);
    } catch (e) {}
  }

  // Kod calistir. { stdout, stderr } dondurur.
  async run(code, timeoutMs = 30000) {
    await this.enterRaw();
    this._flush();
    await this._write(code);
    await this._write('\x04'); // Ctrl-D: calistir
    await this._waitFor('OK', 4000);            // calistirma onayi
    const o = await this._waitFor('\x04', timeoutMs); // stdout ... \x04
    const e = await this._waitFor('\x04', 4000);      // stderr ... \x04
    const stdout = dec.decode(o.slice(0, -1));
    const stderr = dec.decode(e.slice(0, -1));
    return { stdout, stderr };
  }

  // Tek satirlik ifade calistirip sonucu (repr) almak icin kisayol
  async eval(expr, timeoutMs = 8000) {
    const { stdout, stderr } = await this.run('print(repr(' + expr + '))', timeoutMs);
    if (stderr.trim()) throw new Error(stderr.trim());
    return stdout.trim();
  }
}
