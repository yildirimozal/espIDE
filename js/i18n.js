// i18n.js — Cok dilli destek (TR + EN). t(key, vars) ile metin, applyI18n() ile statik DOM.
const DICT = {
  tr: {
    connect: 'Bağlan', disconnect: 'Kes', reset: 'Reset', firmware: 'Firmware', baud: 'baud',
    tab_files: 'Dosyalar', tab_board: 'Kart',
    f_refresh: 'Yenile', f_new: 'Yeni dosya', f_del: 'Sil', f_run: 'Seçili dosyayı çalıştır', f_open: 'Seçili dosyayı editöre aç',
    tree_placeholder: 'Bağlanınca cihaz dosyaları listelenir.',
    local_sync: 'Yerel klasör senkronu', pick_folder: '📂 Klasör seç', push_board: '→ Karta gönder', pull_board: '← Karttan al', no_folder: 'klasör seçilmedi',
    board_info: 'Kart Bilgisi', pinout: 'Pin Düzeni',
    leg_gpio: 'GPIO', leg_power: 'Güç', leg_gnd: 'GND', leg_input: 'Giriş', leg_flash: 'Flash',
    pin_sim_hint: 'GPIO pinine tıkla → simülasyon (ileride gerçek pin durumuna bağlanacak).',
    run: 'Çalıştır', stop: 'Durdur', save_board: 'Karta kaydet', save_board_t: 'Editörü karta kaydet', examples: 'Örnekler…', clear_t: 'Çıktıyı/terminali temizle',
    tab_terminal: 'Terminal', tab_output: 'Çıktı', tab_plotter: 'Plotter',
    plot_clear: '🧹 Temizle', plot_csv: '⭳ CSV indir',
    // durum
    st_disconnected: 'bağlı değil', st_selecting: 'port seçiliyor…', st_reading: 'kart okunuyor…',
    st_connected: 'bağlı · {chip}', st_running: 'çalışıyor…', st_error: 'hata', st_connfail: 'bağlanamadı',
    st_dropped: 'kart koptu', st_firmware: 'firmware…', st_opening: 'açılıyor…', st_saving: 'kaydediliyor…',
    // mesajlar
    msg_need_serial: 'Web Serial gerekli — Chrome/Edge kullan.',
    msg_serial_missing: '⚠️ Bu tarayıcı Web Serial API desteklemiyor.\nLütfen Google Chrome veya Microsoft Edge kullan.\n',
    msg_hint_connect: 'Kartı USB ile tak, "Bağlan"a tıkla. Boş kart → "Firmware".\n',
    msg_connected: '🔌 Karta bağlanıldı.\n',
    msg_repl_ready: '\r\n\x1b[36m# Bağlandı — etkileşimli REPL hazır. Ctrl-C ile durdur.\x1b[0m\r\n',
    msg_conn_error: 'Bağlantı hatası: {e}\n',
    msg_flash_hint: 'Kart boşsa "Firmware" ile MicroPython yükle.\n',
    msg_dropped: '\n⚠️ Bağlantı koptu.\n', msg_disconnected: 'Bağlantı kesildi.\n',
    info_chip: 'Çip', info_model: 'Model', info_mpy: 'MicroPython', info_freq: 'Frekans', info_flash: 'Flash', info_freeram: 'Boş RAM', info_uid: 'UID',
    df_usage: 'flash: {used} / {total} KB kullanılıyor',
    msg_open_fail: 'Açılamadı: {e}\n', msg_saved: '💾 {path} karta kaydedildi.\n', msg_pick_file: 'Önce bir dosya seç.\n',
    prompt_path: 'Cihazdaki dosya yolu:', prompt_newfile: 'Yeni dosya yolu:',
    confirm_delete: '{path} silinsin mi?', confirm_flash: 'Karta MicroPython yüklenecek, her şey SİLİNİR. Devam?',
    confirm_discard: 'Editörde kaydedilmemiş değişiklikler var. Yine de devam edilsin mi?',
    run_done: '✓ bitti\n', run_error: 'Hata: {e}\n', stopped: '\n⏹ Ctrl-C\n', reset_done: '⟲ reset\n',
    flash_done: '\n✅ {name} yüklendi.\n', flash_error: 'Firmware hatası: {e}\n',
    sync_push: '\n→ Karta gönderiliyor…\n', sync_pull: '\n← Karttan alınıyor…\n', sync_error: 'Senkron hatası: {e}\n',
    fs_loading: 'yükleniyor…', fs_list_err: 'Liste alınamadı: {e}',
    fs_count_push: '{n} dosya gönderilecek…\n', fs_push_done: '✓ Karta gönderme tamam.\n',
    fs_count_pull: '{n} dosya alınacak…\n', fs_pull_done: '✓ Karttan alma tamam.\n',
    fs_no_fsa: 'Tarayıcı klasör erişimini desteklemiyor (Chrome/Edge gerekir).',
    plot_waiting: 'Veri bekleniyor — sayı yazdıran bir kod çalıştır (örn. print sıcaklık).', plot_samples: '{n} örnek',
    tab_wireless: 'Telsiz', w_scan: 'Tara', w_auto: 'otomatik', w_scanning: 'taranıyor…',
    w_no_results: 'sonuç yok', w_not_connected: 'Önce karta bağlan.', w_ch_usage: 'Kanal yoğunluğu',
    w_found: '{n} bulundu', col_ssid: 'Ağ', col_signal: 'Sinyal', col_channel: 'Kanal', col_security: 'Güvenlik',
    col_name: 'Ad', col_mac: 'MAC', w_hidden: '‹gizli›', w_noname: '‹adsız›',
    w_ble_note: 'Klasik Bluetooth desteklenmez — yalnızca BLE (Bluetooth Low Energy).',
    ex_blink: 'Blink', ex_boardinfo: 'Kart bilgisi', ex_wifi: 'WiFi tara', ex_i2c: 'I2C tara',
  },
  en: {
    connect: 'Connect', disconnect: 'Disconnect', reset: 'Reset', firmware: 'Firmware', baud: 'baud',
    tab_files: 'Files', tab_board: 'Board',
    f_refresh: 'Refresh', f_new: 'New file', f_del: 'Delete', f_run: 'Run selected file', f_open: 'Open selected file in editor',
    tree_placeholder: 'Device files appear here once connected.',
    local_sync: 'Local folder sync', pick_folder: '📂 Pick folder', push_board: '→ Push to board', pull_board: '← Pull from board', no_folder: 'no folder selected',
    board_info: 'Board Info', pinout: 'Pinout',
    leg_gpio: 'GPIO', leg_power: 'Power', leg_gnd: 'GND', leg_input: 'Input', leg_flash: 'Flash',
    pin_sim_hint: 'Click a GPIO pin → simulation (will reflect real pin state later).',
    run: 'Run', stop: 'Stop', save_board: 'Save to board', save_board_t: 'Save editor to board', examples: 'Examples…', clear_t: 'Clear output/terminal',
    tab_terminal: 'Terminal', tab_output: 'Output', tab_plotter: 'Plotter',
    plot_clear: '🧹 Clear', plot_csv: '⭳ Download CSV',
    st_disconnected: 'not connected', st_selecting: 'selecting port…', st_reading: 'reading board…',
    st_connected: 'connected · {chip}', st_running: 'running…', st_error: 'error', st_connfail: 'connection failed',
    st_dropped: 'board disconnected', st_firmware: 'firmware…', st_opening: 'opening…', st_saving: 'saving…',
    msg_need_serial: 'Web Serial required — use Chrome/Edge.',
    msg_serial_missing: '⚠️ This browser does not support the Web Serial API.\nPlease use Google Chrome or Microsoft Edge.\n',
    msg_hint_connect: 'Plug in the board via USB and click "Connect". Blank board → "Firmware".\n',
    msg_connected: '🔌 Connected to board.\n',
    msg_repl_ready: '\r\n\x1b[36m# Connected — interactive REPL ready. Stop with Ctrl-C.\x1b[0m\r\n',
    msg_conn_error: 'Connection error: {e}\n',
    msg_flash_hint: 'If the board is blank, flash MicroPython via "Firmware".\n',
    msg_dropped: '\n⚠️ Connection lost.\n', msg_disconnected: 'Disconnected.\n',
    info_chip: 'Chip', info_model: 'Model', info_mpy: 'MicroPython', info_freq: 'Freq', info_flash: 'Flash', info_freeram: 'Free RAM', info_uid: 'UID',
    df_usage: 'flash: {used} / {total} KB used',
    msg_open_fail: 'Could not open: {e}\n', msg_saved: '💾 {path} saved to board.\n', msg_pick_file: 'Select a file first.\n',
    prompt_path: 'File path on device:', prompt_newfile: 'New file path:',
    confirm_delete: 'Delete {path}?', confirm_flash: 'MicroPython will be flashed; everything on the board will be ERASED. Continue?',
    confirm_discard: 'The editor has unsaved changes. Discard them and continue?',
    run_done: '✓ done\n', run_error: 'Error: {e}\n', stopped: '\n⏹ Ctrl-C\n', reset_done: '⟲ reset\n',
    flash_done: '\n✅ {name} flashed.\n', flash_error: 'Firmware error: {e}\n',
    sync_push: '\n→ Pushing to board…\n', sync_pull: '\n← Pulling from board…\n', sync_error: 'Sync error: {e}\n',
    fs_loading: 'loading…', fs_list_err: 'Could not list: {e}',
    fs_count_push: '{n} files to push…\n', fs_push_done: '✓ Push complete.\n',
    fs_count_pull: '{n} files to pull…\n', fs_pull_done: '✓ Pull complete.\n',
    fs_no_fsa: 'Browser does not support folder access (Chrome/Edge required).',
    plot_waiting: 'Waiting for data — run code that prints numbers (e.g. print a temperature).', plot_samples: '{n} samples',
    tab_wireless: 'Wireless', w_scan: 'Scan', w_auto: 'auto', w_scanning: 'scanning…',
    w_no_results: 'no results', w_not_connected: 'Connect to a board first.', w_ch_usage: 'Channel usage',
    w_found: '{n} found', col_ssid: 'Network', col_signal: 'Signal', col_channel: 'Ch', col_security: 'Security',
    col_name: 'Name', col_mac: 'MAC', w_hidden: '‹hidden›', w_noname: '‹no name›',
    w_ble_note: 'Classic Bluetooth not supported — BLE (Bluetooth Low Energy) only.',
    ex_blink: 'Blink', ex_boardinfo: 'Board info', ex_wifi: 'WiFi scan', ex_i2c: 'I2C scan',
  },
};

let lang = localStorage.getItem('esp32ide_lang') || ((navigator.language || 'en').toLowerCase().startsWith('tr') ? 'tr' : 'en');

export function getLang() { return lang; }
export function setLang(l) {
  lang = DICT[l] ? l : 'en';
  localStorage.setItem('esp32ide_lang', lang);
  document.documentElement.lang = lang;
}

export function t(key, vars) {
  let s = (DICT[lang] && DICT[lang][key]) ?? (DICT.en[key] ?? key);
  if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
  return s;
}

// data-i18n="key" -> textContent ; data-i18n-title -> title ; data-i18n-ph -> placeholder
export function applyI18n(root = document) {
  document.documentElement.lang = lang;
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  root.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
}
