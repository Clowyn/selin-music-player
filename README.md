# Selin Music Player PWA 💖 ♪

Selin'e özel olarak tasarlanmış ve geliştirilmiş kişisel müzik çalar web uygulaması (PWA).

## Öne Çıkan Özellikler

1. **Arayüz ve Tasarım (YouTube Music & Glassmorphism Aesthetic)**
   - Gül/pembe (`#ec4899`, `#f472b6`) ve mor (`#a855f7`) tonlarında karanlık mod cam efekti (glassmorphic layer).
   - Özel Hello Kitty (🐱) seekbar slider başlığı.
   - Framer Motion ile pürüzsüz geçiş animasyonları ve yumuşak şarkı bilgi ekranı.

2. **Görsel Katmanlar**
   - **Floating Sprites (Uçuşan Karakterler):** Ekranın altından yukarı doğru süzülen aktif karakter görselleri / emojileri.
   - **Arkaplan Slaytı:** Her çalma listesine özel fotoğraf ve videoların 8 saniyede bir yumuşak geçişle (crossfade) değişmesi.
   - **Doğum Günü Karşılama:** İlk girişte konfeti efekti (hearts & stars) ile gösterilen romantic karşılama ekranı.

3. **Mobil ve iOS PWA Uyumluluğu**
   - Tam ekran PWA desteği (iOS Safari `apple-mobile-web-app-capable`).
   - Çentikli iPhone'lar için Safe Area (`env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`) uyumu.
   - Media Session API ile iOS kilit ekranı ve bildirim merkezinden şarkı kontrolü (Oynat/Duraklat, İleri/Geri).

4. **Yönetim Paneli (`/admin`)**
   - Şifre korumalı yönetim arayüzü (`ADMIN_PASSWORD`).
   - Çalma listeleri, şarkı yükleme (`.mp3`/`.m4a`), arkaplan medya yükleme (`.jpg`/`.mp4`) ve uçuşan karakter yönetimi.

---

## Kurulum ve Çalıştırma

### 1. Bağımlılıkları Yükleyin
```bash
npm install
```

### 2. Ortam Değişkenlerini Ayarlayın
`.env.local` dosyasını oluşturun:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
ADMIN_PASSWORD=selin2026
```

### 3. Supabase Veritabanı Kurulumu
Proje kökündeki `supabase-migration.sql` dosyasındaki SQL komutlarını Supabase Dashboard > SQL Editor alanında çalıştırın.
Supabase Storage üzerinde şu 3 public bucket'ı oluşturun:
- `audio-files`
- `photos-videos`
- `sprites`

### 4. Geliştirme Sunucusunu Başlatın
```bash
npm run dev
```

### 5. Production Build
```bash
npm run build
npm run start
```
