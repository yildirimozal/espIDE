// flash.js — Bos karta tarayicidan MicroPython yukler (esptool-js).
// Cipi otomatik tespit eder, dogru firmware'i ve offset'i secer.

const ESPTOOL_URL = 'https://unpkg.com/esptool-js@0.4.5/bundle.js';

// Cip ailesine gore firmware ve flash offset'i
// (ESP32 ve S2 -> 0x1000, S3/C3/C6 -> 0x0)
export const FIRMWARE = {
  'ESP32':    { file: 'firmware/ESP32_GENERIC-v1.28.0.bin',    offset: 0x1000, ad: 'ESP32 (klasik)' },
  'ESP32-S3': { file: 'firmware/ESP32_GENERIC_S3-v1.28.0.bin', offset: 0x0,    ad: 'ESP32-S3' },
  'ESP32-C3': { file: 'firmware/ESP32_GENERIC_C3-v1.28.0.bin', offset: 0x0,    ad: 'ESP32-C3' },
};

function normalizeChip(desc) {
  const d = (desc || '').toUpperCase();
  if (d.includes('S3')) return 'ESP32-S3';
  if (d.includes('C3')) return 'ESP32-C3';
  if (d.includes('S2')) return 'ESP32-S2';
  if (d.includes('C6')) return 'ESP32-C6';
  return 'ESP32';
}

async function fetchBinaryString(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('Firmware dosyasi bulunamadi: ' + url);
  const bytes = new Uint8Array(await resp.arrayBuffer());
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  }
  return s;
}

// Ana islem: porta baglan, cipi bul, uygun firmware'i yaz, resetle.
// port: paylasilan Web Serial portu (REPL ile ayni). Cagirmadan once REPL kapali olmali.
export async function flashFirmware(port, { onLog = () => {}, onProgress = () => {} } = {}) {
  const { ESPLoader, Transport } = await import(ESPTOOL_URL);

  const terminal = {
    clean() {},
    writeLine(d) { onLog(d + '\n'); },
    write(d) { onLog(d); },
  };

  const transport = new Transport(port, false);
  const esploader = new ESPLoader({ transport, baudrate: 460800, terminal });

  onLog('Karta baglaniliyor (bootloader)...\n');
  const chipDesc = await esploader.main();          // cipe baglanir, aciklama dondurur
  const chip = normalizeChip(chipDesc);
  onLog('Tespit edilen cip: ' + chipDesc + ' -> ' + chip + '\n');

  const fw = FIRMWARE[chip];
  if (!fw) {
    await safeReset(esploader, transport);
    throw new Error('Bu cip icin pakette firmware yok: ' + chip +
      '. firmware/ klasorune uygun .bin ekleyip flash.js icindeki FIRMWARE listesini guncelle.');
  }

  onLog('Firmware indiriliyor: ' + fw.file + '\n');
  const data = await fetchBinaryString(fw.file);

  onLog('Flash yaziliyor (0x' + fw.offset.toString(16) + ')... bu ~30 sn surebilir.\n');
  await esploader.writeFlash({
    fileArray: [{ data, address: fw.offset }],
    flashSize: 'keep',
    eraseAll: true,
    compress: true,
    reportProgress: (idx, written, total) => onProgress(written / total),
  });

  onLog('\nYazma tamam. Kart resetleniyor...\n');
  await safeReset(esploader, transport);
  await transport.disconnect();           // portu serbest birak (REPL alabilsin)
  onProgress(1);
  return { chip, chipDesc, firmware: fw };
}

async function safeReset(esploader, transport) {
  try {
    if (esploader.hardReset) { await esploader.hardReset(); return; }
  } catch (e) {}
  // Yedek: DTR/RTS ile manuel reset
  try {
    await transport.setDTR(false);
    await transport.setRTS(true);
    await new Promise((r) => setTimeout(r, 100));
    await transport.setRTS(false);
  } catch (e) {}
}
