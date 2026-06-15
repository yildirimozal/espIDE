# ⚡ ESP32 Web IDE

ESP32 / MicroPython için profesyonel, tarayıcı tabanlı bir IDE. Kartı USB'ye tak, uygulamayı
Chrome veya Edge'de aç — karşında tam bir geliştirme ortamı: **kurulum yok, araç zinciri yok,
bulut yok.** Her şey Web Serial API ile yerelde çalışır.

**🔗 Canlı: https://yildirimozal.github.io/espIDE/**

*Diller: [English](README.md) · **Türkçe***

---

## Özellikler

- **Doğrudan USB bağlantısı** (Web Serial API) — sürücü betiği, arka plan ajanı, yükleme sunucusu yok.
- **Tarayıcıdan firmware yükleme** (esptool-js) — boş bir kartı tek tıkla MicroPython'a kavuştur.
- **Hızlı dosya transferi** — MicroPython raw-paste protokolü, akış kontrollü.
- **Cihaz dosya sistemi** — karttaki dosyaları gez, aç, düzenle, çalıştır, sil; editörü doğrudan karta kaydet.
- **Yerel klasör senkronu** (File System Access API) — projeyi karta gönder veya karttan al, alt klasörler dahil.
- **Etkileşimli terminal** (xterm.js) — canlı ANSI REPL; `input()` çalışır.
- **Canlı plotter** — karttan akan sayıları gerçek zamanlı çizer (çoklu seri; `temp:23.5 hum:40`, CSV veya boşluk), zaman damgalı **CSV export**.
- **Telsiz monitörü** — yakındaki **WiFi** ağlarını (SSID, sinyal, kanal, güvenlik) kanal-yoğunluğu grafiğiyle ve **BLE** cihazlarını (ad, MAC, sinyal) tarar; isteğe bağlı otomatik yenileme.
- **Akıllı pinout** — çipi tanır ve uygun pin diyagramını gösterir (ESP32 / S3 / C3).
- **Kart bilgisi** — çip, frekans, flash, boş RAM, benzersiz kimlik, flash kullanımı.
- **Kod editörü** — Python söz dizimi renklendirme ve örnek kod kütüphanesi.
- **PWA / tam çevrimdışı** — kurulabilir; uygulama ve firmware imajları önbelleğe alınır, izole/kısıtlı ağlarda çalışır.
- **Kendi kendine yeterli** — tüm bağımlılıklar yerelde; uygulama **sıfır dış istek** yapar.
- **Çift dilli arayüz** — İngilizce / Türkçe, tarayıcıdan otomatik algılanır, elle değiştirilebilir.

## Hızlı başlangıç

1. Uygulamayı **Chrome** veya **Edge** ile (masaüstü) aç.
2. ESP32 kartını **veri destekli USB kablo** ile bağla.
3. **Bağlan**'a tıkla ve seri portu seç.
   - Yeni/boş kart mı? Önce **Firmware** ile MicroPython yükle (bir kerelik).
4. Kodu yaz, **Çalıştır** (`Ctrl/Cmd+Enter`); Terminal, Plotter ve Telsiz panellerini gerektiğinde kullan.

> Kartta yalnızca MicroPython olması yeterli. macOS portu görmüyorsa, kartının köprü çipine
> (CP2102 / CH340) uygun USB-UART sürücüsünü kur ve tarayıcıyı yeniden başlat.

## Tarayıcı desteği

**Web Serial API** ve **File System Access API** gerekir: Chrome, Edge, Opera (masaüstü).
Safari ve Firefox desteklenmez. HTTPS veya `localhost` üzerinden sunulur.

## Desteklenen çipler

| Çip | Pakette firmware | Pinout şablonu |
|-----|------------------|----------------|
| ESP32 (klasik, WROOM-32) | ✅ | DevKitC 38-pin · DevKit V1 30-pin |
| ESP32-S3 | ✅ | S3 DevKitC |
| ESP32-C3 | ✅ | C3 SuperMini |

Çip `os.uname()` ile algılanır ve uygun pinout otomatik seçilir; şablonu elle de değiştirebilirsin.

### Çip veya firmware ekleme
1. `.bin` dosyasını `firmware/` içine koy.
2. `js/flash.js` içindeki `FIRMWARE` tablosuna çip → dosya + offset ekle.
3. `js/boards.js` içine bir pinout şablonu ekle (mevcutları örnek al).

## PWA / çevrimdışı / güncelleme

- İlk açılışta **service worker** tüm uygulamayı ve firmware imajlarını önbelleğe alır; sonrasında
  **tam çevrimdışı** çalışır — kısıtlı/izole ortamlar için idealdir.
- Tarayıcıdan **masaüstü uygulaması** olarak kurulabilir.
- Tüm bağımlılıklar `vendor/` altındadır — çalışma anında CDN yok.
- **Güncelleme yayınlarken:** `sw.js` içindeki `APP_VERSION`'ı artır. Eski önbellek silinir, istemciler
  bir sonraki açılışta yeni sürümü alır.

## Kendi sunucunda barındırma

Uygulama tamamen statiktir. HTTPS üzerinden dosya sunan herhangi bir yerde barındırabilirsin:

- **GitHub Pages:** fork'la, ardından *Settings → Pages → Deploy from a branch → `main` / `/(root)`*.
- **Statik host / kendi sunucun:** repo kökünü sun.

## Yerel geliştirme

ES modülleri ve service worker bir HTTP kaynağı gerektirir (`file://` olmaz):

```bash
python3 -m http.server 8000      # sonra Chrome'da http://localhost:8000
# veya macOS'ta serve.command dosyasına çift tıkla
```

> Geliştirme sırasında service worker düzenlemeden sonra eski dosyaları sunabilir — DevTools →
> *Application → Service Workers → "Update on reload"*, ya da `sw.js`'de `APP_VERSION`'ı artır.

## Proje yapısı

```
esp32-web-ide/
├── index.html
├── css/style.css
├── js/
│   ├── app.js          # orkestra
│   ├── serial.js       # Web Serial + raw / raw-paste REPL + dosya sistemi + akış
│   ├── flash.js        # firmware yükleme (esptool-js)
│   ├── boards.js       # pinout şablonları + çip algılama
│   ├── terminal.js     # etkileşimli terminal (xterm.js)
│   ├── files.js        # cihaz dosya ağacı + yerel klasör senkronu
│   ├── plotter.js      # canlı plotter + CSV export
│   ├── wireless.js     # WiFi / BLE monitörü
│   ├── editor.js       # CodeMirror editörü
│   └── i18n.js         # İngilizce / Türkçe
├── firmware/           # MicroPython .bin imajları
├── vendor/             # yerel bağımlılıklar (CDN yok)
├── sw.js               # service worker (çevrimdışı + cache-busting)
└── manifest.webmanifest
```

## Lisans

MIT — bkz. [LICENSE](LICENSE).

Şunlarla yapıldı: [MicroPython](https://micropython.org) (MIT), [esptool-js](https://github.com/espressif/esptool-js)
(Apache-2.0), [CodeMirror](https://codemirror.net) (MIT), [xterm.js](https://xtermjs.org) (MIT).
