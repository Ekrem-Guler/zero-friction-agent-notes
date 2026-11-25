# ZeroNote — Zero-Friction AI Note & Research Agent

Kullanıcıların aceleyle aldığı tek kelimelik veya yarım notları (`"Semrush"`, `"yarın bütçe sunumu"`) ve **45 saniyelik sesli notları** niyet analiziyle otomatik sınıflandıran, web araştırmasıyla zenginleştiren ve düzenli tablolara/listelere dönüştüren minimalist **PWA Not & Araştırma Ajanı**.

## Öne Çıkan Özellikler

* **Sıfır Sürtünmeli Giriş (Zero-Friction):** Açılışta doğrudan odaklanan metin kutusu (`/` veya `Ctrl/Cmd + K` kısayolu) ve mobil/masaüstü uyumlu **45 sn sesli not kaydedici**.
* **Otomatik Niyet Analizi & Web Araştırması:**
  * **Araçlar & Kaynaklar Tablosu:** Tek kelimelik araçları/kavramları araştırır, kategorisini belirler ve **kişisel bağlamınıza göre** kullanım senaryosunu özetler.
  * **Yapılacaklar Listesi:** Yarım bırakılan iş notlarını net görevlere ve tıklanabilir alt adımlara dönüştürür.
  * **Fikirler & Özel Başlıklar:** Başlık karmaşasını önlemek için yeni başlıkları kullanıcı elle açar; AI yalnızca gerekirse yeni başlık önerisinde bulunur.
* **Güvenlik & Maliyet Kalkanı (Anti-Abuse + BYOK):**
  * **Katı JSON Şeması (`Structured Output`):** Prompt injection ile genel sohbet botuna (ChatGPT proxy) dönüştürülemez; maksimum girdi (`500 krk`) ve çıktı (`350 token`) sınırlarıyla korunur.
  * **Kendi AI Anahtarını Bağla (BYOK) + Bütçe Sigortası:** Kullanıcılar kendi Gemini veya OpenAI anahtarlarını **AES-256-GCM** şifrelemesiyle bağlayarak sınırsız kullanabilir; sistem anahtarı için aylık sert USD tavanı (Circuit Breaker) bulunur.
  * **Ortak Araştırma Önbelleği (`entity_cache`):** Daha önce araştırılan araçlar veritabanında önbelleğe alınarak tekrar eden arama maliyetini sıfırlar.

## Yerel Kurulum (Bilgisayarda Hemen Çalıştırma)

```bash
npm install
npm run dev
```

Tarayıcıda `http://localhost:3000` adresini açın. Yerel veritabanı (`data/local.db`) ve varsayılan 3 başlık (*Yapılacaklar*, *Araçlar & Kaynaklar*, *Fikirler*) sıfır kurulumla otomatik oluşturulur. Sağ üstteki **Bağlam & AI** butonundan Gemini veya OpenAI API anahtarınızı girebilirsiniz.

## Telefon + Bilgisayar Senkronizasyonu (Bulut / PWA Kurulumu)

1. Ücretsiz bir **Turso** (LibSQL) veritabanı oluşturun ve `DATABASE_URL` ile `DATABASE_AUTH_TOKEN` bilgilerini alın.
2. Projeyi GitHub deponuz üzerinden **Vercel**'e bağlayın ve `.env.example` içindeki ortam değişkenlerini (`APP_PASSWORD`, `ENCRYPTION_SECRET`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN`) tanımlayın.
3. Telefonunuzda siteyi açıp **"Ana Ekrana Ekle"** (PWA) seçeneğiyle tam ekran uygulama olarak kullanın.
