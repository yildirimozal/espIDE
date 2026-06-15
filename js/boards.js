// boards.js — Kart pinout sablonlari + cipe gore otomatik secim.
// Her pin: { gpio, label, type, fns }
//   type: power | gnd | io | inputonly | flash | en
//   gpio: GPIO numarasi (yoksa null) — simulasyonda bu pinler kontrol edilebilir.
//   fns : ek yetenekler (ADC, Touch, UART, strapping vb.) — etikette gosterilir.

const P = (gpio, label, type, fns = []) => ({ gpio, label, type, fns });

// --- ESP32 (klasik, WROOM-32) DevKitC 38-pin ---
const ESP32_38 = {
  id: 'esp32-devkit-38',
  chip: 'ESP32',
  name: 'ESP32 DevKitC (38-pin)',
  led: 2,
  left: [
    P(null, '3V3', 'power'),
    P(null, 'EN', 'en', ['RESET']),
    P(36, 'GPIO36', 'inputonly', ['ADC1_0', 'input only']),
    P(39, 'GPIO39', 'inputonly', ['ADC1_3', 'input only']),
    P(34, 'GPIO34', 'inputonly', ['ADC1_6', 'input only']),
    P(35, 'GPIO35', 'inputonly', ['ADC1_7', 'input only']),
    P(32, 'GPIO32', 'io', ['ADC1_4', 'Touch9']),
    P(33, 'GPIO33', 'io', ['ADC1_5', 'Touch8']),
    P(25, 'GPIO25', 'io', ['ADC2_8', 'DAC1']),
    P(26, 'GPIO26', 'io', ['ADC2_9', 'DAC2']),
    P(27, 'GPIO27', 'io', ['ADC2_7', 'Touch7']),
    P(14, 'GPIO14', 'io', ['ADC2_6', 'Touch6', 'HSPI_CLK']),
    P(12, 'GPIO12', 'io', ['ADC2_5', 'Touch5', 'strapping']),
    P(null, 'GND', 'gnd'),
    P(13, 'GPIO13', 'io', ['ADC2_4', 'Touch4', 'HSPI_MOSI']),
    P(9, 'GPIO9', 'flash', ['flash (do not use)']),
    P(10, 'GPIO10', 'flash', ['flash (do not use)']),
    P(11, 'GPIO11', 'flash', ['flash (do not use)']),
    P(null, '5V / VIN', 'power'),
  ],
  right: [
    P(null, 'GND', 'gnd'),
    P(23, 'GPIO23', 'io', ['VSPI_MOSI']),
    P(22, 'GPIO22', 'io', ['I2C_SCL']),
    P(1, 'GPIO1', 'io', ['UART0_TX', 'console']),
    P(3, 'GPIO3', 'io', ['UART0_RX', 'console']),
    P(21, 'GPIO21', 'io', ['I2C_SDA']),
    P(null, 'GND', 'gnd'),
    P(19, 'GPIO19', 'io', ['VSPI_MISO']),
    P(18, 'GPIO18', 'io', ['VSPI_CLK']),
    P(5, 'GPIO5', 'io', ['VSPI_CS', 'strapping']),
    P(17, 'GPIO17', 'io', ['UART2_TX']),
    P(16, 'GPIO16', 'io', ['UART2_RX']),
    P(4, 'GPIO4', 'io', ['ADC2_0', 'Touch0']),
    P(0, 'GPIO0', 'io', ['BOOT', 'strapping']),
    P(2, 'GPIO2', 'io', ['onboard LED', 'ADC2_2', 'Touch2']),
    P(15, 'GPIO15', 'io', ['ADC2_3', 'Touch3', 'strapping']),
    P(8, 'GPIO8', 'flash', ['flash (do not use)']),
    P(7, 'GPIO7', 'flash', ['flash (do not use)']),
    P(6, 'GPIO6', 'flash', ['flash (do not use)']),
  ],
};

// --- ESP32 (klasik) DOIT DevKit V1 30-pin ---
const ESP32_30 = {
  id: 'esp32-devkit-30',
  chip: 'ESP32',
  name: 'ESP32 DevKit V1 (30-pin)',
  led: 2,
  left: [
    P(null, 'EN', 'en', ['RESET']),
    P(36, 'GPIO36', 'inputonly', ['ADC1_0', 'input only']),
    P(39, 'GPIO39', 'inputonly', ['ADC1_3', 'input only']),
    P(34, 'GPIO34', 'inputonly', ['ADC1_6', 'input only']),
    P(35, 'GPIO35', 'inputonly', ['ADC1_7', 'input only']),
    P(32, 'GPIO32', 'io', ['ADC1_4', 'Touch9']),
    P(33, 'GPIO33', 'io', ['ADC1_5', 'Touch8']),
    P(25, 'GPIO25', 'io', ['DAC1']),
    P(26, 'GPIO26', 'io', ['DAC2']),
    P(27, 'GPIO27', 'io', ['Touch7']),
    P(14, 'GPIO14', 'io', ['Touch6', 'HSPI_CLK']),
    P(12, 'GPIO12', 'io', ['Touch5', 'strapping']),
    P(13, 'GPIO13', 'io', ['Touch4', 'HSPI_MOSI']),
    P(null, 'GND', 'gnd'),
    P(null, 'VIN / 5V', 'power'),
  ],
  right: [
    P(23, 'GPIO23', 'io', ['VSPI_MOSI']),
    P(22, 'GPIO22', 'io', ['I2C_SCL']),
    P(1, 'GPIO1', 'io', ['UART0_TX']),
    P(3, 'GPIO3', 'io', ['UART0_RX']),
    P(21, 'GPIO21', 'io', ['I2C_SDA']),
    P(null, 'GND', 'gnd'),
    P(19, 'GPIO19', 'io', ['VSPI_MISO']),
    P(18, 'GPIO18', 'io', ['VSPI_CLK']),
    P(5, 'GPIO5', 'io', ['VSPI_CS', 'strapping']),
    P(17, 'GPIO17', 'io', ['UART2_TX']),
    P(16, 'GPIO16', 'io', ['UART2_RX']),
    P(4, 'GPIO4', 'io', ['Touch0']),
    P(0, 'GPIO0', 'io', ['BOOT', 'strapping']),
    P(2, 'GPIO2', 'io', ['onboard LED', 'Touch2']),
    P(null, '3V3', 'power'),
  ],
};

// --- ESP32-S3 DevKitC ---
const ESP32_S3 = {
  id: 'esp32-s3-devkitc',
  chip: 'ESP32-S3',
  name: 'ESP32-S3 DevKitC',
  led: 48,
  left: [
    P(null, '3V3', 'power'),
    P(null, '3V3', 'power'),
    P(null, 'RST', 'en', ['RESET']),
    P(4, 'GPIO4', 'io', ['ADC1_3', 'Touch4']),
    P(5, 'GPIO5', 'io', ['ADC1_4', 'Touch5']),
    P(6, 'GPIO6', 'io', ['ADC1_5', 'Touch6']),
    P(7, 'GPIO7', 'io', ['ADC1_6', 'Touch7']),
    P(15, 'GPIO15', 'io', ['ADC2_4']),
    P(16, 'GPIO16', 'io', ['ADC2_5']),
    P(17, 'GPIO17', 'io', ['ADC2_6']),
    P(18, 'GPIO18', 'io', ['ADC2_7']),
    P(8, 'GPIO8', 'io', ['ADC1_7', 'I2C_SDA']),
    P(3, 'GPIO3', 'io', ['ADC1_2', 'strapping']),
    P(46, 'GPIO46', 'io', ['strapping']),
    P(9, 'GPIO9', 'io', ['ADC1_8', 'I2C_SCL']),
    P(10, 'GPIO10', 'io', ['ADC1_9']),
    P(11, 'GPIO11', 'io', ['ADC2_0']),
    P(12, 'GPIO12', 'io', ['ADC2_1']),
    P(13, 'GPIO13', 'io', ['ADC2_2']),
    P(14, 'GPIO14', 'io', ['ADC2_3']),
    P(null, '5V', 'power'),
    P(null, 'GND', 'gnd'),
  ],
  right: [
    P(null, 'GND', 'gnd'),
    P(null, 'TX', 'io', ['UART0_TX']),
    P(null, 'RX', 'io', ['UART0_RX']),
    P(1, 'GPIO1', 'io', ['ADC1_0']),
    P(2, 'GPIO2', 'io', ['ADC1_1']),
    P(42, 'GPIO42', 'io', []),
    P(41, 'GPIO41', 'io', []),
    P(40, 'GPIO40', 'io', []),
    P(39, 'GPIO39', 'io', []),
    P(38, 'GPIO38', 'io', []),
    P(37, 'GPIO37', 'io', []),
    P(36, 'GPIO36', 'io', []),
    P(35, 'GPIO35', 'io', []),
    P(0, 'GPIO0', 'io', ['BOOT', 'strapping']),
    P(45, 'GPIO45', 'io', ['strapping']),
    P(48, 'GPIO48', 'io', ['RGB LED']),
    P(47, 'GPIO47', 'io', []),
    P(21, 'GPIO21', 'io', []),
    P(20, 'GPIO20', 'io', ['ADC2_9', 'USB D+']),
    P(19, 'GPIO19', 'io', ['ADC2_8', 'USB D-']),
    P(null, 'GND', 'gnd'),
  ],
};

// --- ESP32-C3 SuperMini / DevKit ---
const ESP32_C3 = {
  id: 'esp32-c3-supermini',
  chip: 'ESP32-C3',
  name: 'ESP32-C3 SuperMini',
  led: 8,
  left: [
    P(5, 'GPIO5', 'io', ['ADC2_0']),
    P(6, 'GPIO6', 'io', []),
    P(7, 'GPIO7', 'io', []),
    P(8, 'GPIO8', 'io', ['onboard LED', 'strapping']),
    P(9, 'GPIO9', 'io', ['BOOT', 'strapping']),
    P(10, 'GPIO10', 'io', []),
    P(20, 'GPIO20', 'io', ['UART0_RX']),
    P(21, 'GPIO21', 'io', ['UART0_TX']),
  ],
  right: [
    P(4, 'GPIO4', 'io', ['ADC1_4']),
    P(3, 'GPIO3', 'io', ['ADC1_3']),
    P(2, 'GPIO2', 'io', ['ADC1_2', 'strapping']),
    P(1, 'GPIO1', 'io', ['ADC1_1']),
    P(0, 'GPIO0', 'io', ['ADC1_0']),
    P(null, '5V', 'power'),
    P(null, 'GND', 'gnd'),
    P(null, '3V3', 'power'),
  ],
};

export const BOARDS = [ESP32_38, ESP32_30, ESP32_S3, ESP32_C3];

export function boardsForChip(chip) {
  const list = BOARDS.filter((b) => b.chip === chip);
  return list.length ? list : BOARDS.filter((b) => b.chip === 'ESP32');
}

export function getBoard(id) {
  return BOARDS.find((b) => b.id === id) || BOARDS[0];
}

// Karttan bilgi okumak icin calistirilan MicroPython betigi.
// Tek JSON satiri dondurur.
export const INFO_SCRIPT = `
import os, gc, sys
try:
    import machine
    freq = machine.freq()
    uid = ''.join('%02X' % b for b in machine.unique_id())
except Exception:
    freq = 0; uid = '?'
try:
    import esp
    flash = esp.flash_size()
except Exception:
    flash = 0
u = os.uname()
print('{"sysname":"%s","machine":"%s","release":"%s","version":"%s","freq":%d,"uid":"%s","flash":%d,"mem_free":%d,"mem_alloc":%d}' % (u.sysname, u.machine, u.release, u.version, freq, uid, flash, gc.mem_free(), gc.mem_alloc()))
`;

// uname.machine / sysname -> cip ailesi
export function chipFromInfo(info) {
  const s = ((info.machine || '') + ' ' + (info.sysname || '')).toUpperCase();
  if (s.includes('S3')) return 'ESP32-S3';
  if (s.includes('C3')) return 'ESP32-C3';
  if (s.includes('S2')) return 'ESP32-S2';
  if (s.includes('C6')) return 'ESP32-C6';
  return 'ESP32';
}
