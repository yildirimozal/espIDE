# ⚡ ESP32 Web IDE

Tarayıcıdan, **kurulum yapmadan** ESP32 programlamak için web tabanlı bir IDE.
Öğrenci kartı USB ile takar, bu sayfayı Chrome'da açar, **"Bağlan"a** tıklar — hepsi bu.

> Kod yaz → `Ctrl+Enter` → kart üzerinde **anında** çalışır. Derleme yok, IP yok, WiFi yok.

<!-- İstersen bir ekran görüntüsü ekle: docs/screenshot.png ve burada ![ekran](docs/screenshot.png) ile göster. -->

## ✨ Özellikler
- 🔌 **Web Serial** ile USB üzerinden doğrudan bağlantı (kurulum gerektirmez)
- ⚙️ **Tarayıcıdan firmware yükleme** — boş kart bile tek tuşla MicroPython'a kavuşur
- 🐍 **MicroPython** — canlı çalıştırma, tüm program tek tuşla
- ⚡ **Raw-paste protokolü** — büyük dosyaları akış kontrollü, hızlı transfer
- 🗂 **Cihaz dosya sistemi** — flash'taki dosyaları gez, aç, düzenle, sil, çalıştır, "karta kaydet"
- 🔄 **Yerel klasör senkronu** (File System Access API) — projeyi karta gönder / karttan al
- 🖥 **Etkileşimli terminal** (xterm.js) — ANSI destekli canlı REPL, `input()` çalışır
- 📈 **Canlı plotter** — akan çıktıdaki sayıları gerçek zamanlı çizer (çoklu seri; `temp:23.5 hum:40` veya CSV/boşluk), zaman damgalı **CSV export**
- 🎛 **Donanım kontrolü** — Reset, yapılandırılabilir baud, otomatik kopma algılama
- 🎨 Python söz dizimi renklendirmeli editör (CodeMirror)
- 🧠 **Akıllı pinout** — kartı tanır, çip ailesine göre doğru pin diyagramını gösterir
- 📊 Kart bilgisi paneli (çip, frekans, flash, RAM, kimlik) + flash kullanımı
- 📲 **PWA** — kurulabilir, **tamamen çevrimdışı** çalışır (firmware dahil önbellekte)
- 🔌 **Vendored bağımlılıklar** — CDN yok; izole/kurumsal ağlarda çalışır

> Profesyonel iş akışı: dosyaları cihazda yönet, yerel klasörle senkronla, raw-paste ile
> hızlı yükle, terminalde canlı REPL. **File System Access API** Chrome/Edge gerektirir.

---

## 👨‍🎓 Öğrenciler için — Hızlı Başlangıç

1. **Chrome** veya **Edge** tarayıcısını aç (Safari/Firefox desteklemez).
2. Öğretmenin verdiği adresi aç: `https://KULLANICI-ADI.github.io/esp32-web-ide/`
3. ESP32 kartını **veri destekli USB kablo** ile bilgisayara tak.
4. **🔌 Bağlan** → açılan listeden kartın portunu seç.
   - Liste boşsa veya "bağlanamadı" derse → kart yeni olabilir, önce **⚙️ Firmware Yükle**'ye bas (bir kerelik).
5. Editöre kod yaz, **▶ Çalıştır** (veya `Ctrl+Enter`).
6. Çıktıyı alttaki **Çıktı** penceresinde gör. 🎉

> 💡 macOS'ta kart görünmüyorsa, USB-seri sürücüsü gerekebilir: çoğu kartta **CP2102** (Silicon Labs) ya da **CH340** (WCH). Sürücüyü kurup tarayıcıyı yeniden başlat.

---

## 👩‍🏫 Öğretmenler için — Dağıtım (GitHub Pages)

1. Bu repoyu **fork'la** (veya kendi hesabına kopyala).
2. GitHub'da **Settings → Pages** → "Build and deployment" → Source: **Deploy from a branch** → Branch: **main** / **/(root)** → Save.
3. Birkaç dakika sonra siten yayında: `https://KULLANICI-ADI.github.io/esp32-web-ide/`
4. Bu adresi öğrencilerle paylaş. Hepsi bu — sunucu, backend, kurulum yok.

Tüm dosyalar statik (HTML/JS/CSS). Firmware binleri repoda gömülü olduğundan
öğrenciler boş kartı bile tarayıcıdan flashlayabilir.

---

## 🧩 Desteklenen kartlar

| Çip | Firmware (pakette) | Pinout şablonu |
|-----|--------------------|----------------|
| ESP32 (klasik, WROOM-32) | ✅ | DevKitC 38-pin · DevKit V1 30-pin |
| ESP32-S3 | ✅ | S3 DevKitC |
| ESP32-C3 | ✅ | C3 SuperMini |

IDE, `os.uname()` ile çipi tanır ve uygun şablonu otomatik seçer. Şablonu üstteki
açılır menüden elle de değiştirebilirsin.

### Yeni kart/firmware eklemek
1. `firmware/` klasörüne ilgili `.bin` dosyasını koy.
2. `js/flash.js` içindeki `FIRMWARE` tablosuna çip → dosya + offset ekle.
3. `js/boards.js` içine yeni bir pinout şablonu ekle (mevcutları örnek al).

---

## 📲 PWA / Çevrimdışı / Güncelleme
- Site ilk açıldığında **service worker** tüm uygulamayı + firmware'leri önbelleğe alır → sonrasında **internetsiz** çalışır (kurumsal/izole ağlar için ideal).
- Tarayıcıdan **"Uygulamayı yükle"** ile masaüstü/dock uygulaması gibi kurulabilir.
- Tüm bağımlılıklar `vendor/` altında **yerel** (CDN yok).
- **Güncelleme yayınlarken:** `sw.js` içindeki `APP_VERSION`'ı artır (ör. `v1.0.1`). Eski önbellek
  silinir, yeni varlıklar çekilir; kullanıcılar bir sonraki açılışta güncel sürümü alır.

## 🌐 Tarayıcı gereksinimi
Web Serial API gerektirir: **Chrome, Edge, Opera** (masaüstü). Safari ve Firefox desteklemez.
HTTPS (GitHub Pages) veya `localhost` üzerinden çalışır.

## 🛠 Yerel geliştirme
```bash
# Modüller (type="module") file:// ile çalışmaz, basit bir sunucu gerekir:
python3 -m http.server 8000
# sonra Chrome'da: http://localhost:8000
```

## 📁 Proje yapısı
```
esp32-web-ide/
├── index.html          # arayüz
├── css/style.css       # tasarım
├── js/
│   ├── app.js          # orkestra: tum parcalari baglar
│   ├── serial.js       # Web Serial + MicroPython raw REPL protokolu
│   ├── flash.js        # esptool-js ile firmware yukleme
│   ├── boards.js       # pinout sablonlari + kart tanima
│   ├── pinout.js       # pin diyagrami cizimi
│   └── editor.js       # CodeMirror editor
├── firmware/           # MicroPython .bin dosyalari
└── README.md
```

## 🐞 Sorun giderme
| Belirti | Çözüm |
|--------|-------|
| "Bağlan"a basınca port listesi boş | USB kabloyu/portu değiştir; sürücü kur |
| Bağlandı ama hata/sessiz | Kart boş olabilir → **Firmware Yükle** |
| "Web Serial yok" uyarısı | Chrome/Edge kullan |
| Firmware yükleme takılıyor | Karttaki **BOOT** düğmesini basılı tutup tekrar dene |
| Sonsuz döngü kartı kilitledi | **⏹ Durdur** (Ctrl-C) veya kartı resetle |

## 📜 Lisans
MIT — özgürce kullan, değiştir, dağıt.

MicroPython firmware'leri [micropython.org](https://micropython.org) (MIT),
flashlama [esptool-js](https://github.com/espressif/esptool-js) (Apache-2.0),
editör [CodeMirror](https://codemirror.net) (MIT) ile sağlanır.
