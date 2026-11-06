# Siap Audit SPBU v16.0.3 — pengambilan foto melalui kamera HP

Pembaruan untuk aplikasi pra-audit SPBU pada Netlify. Audit, penilaian, hasil AI, dan foto disimpan di Netlify Blobs setelah sinkronisasi selesai. Buka **PANDUAN_MULAI.md** untuk langkah memperbarui aplikasi yang sudah terpasang.

## Perbaikan v16.0.3

- Tombol utama **Ambil satu foto** meminta antarmuka kamera HP melalui input file dengan `capture="environment"`, satu foto setiap kali. Zoom, ketuk fokus, dan kontrol lain mengikuti antarmuka yang disediakan HP/browser; aplikasi tidak menjamin fitur tertentu tersedia di semua perangkat.
- Tombol **Kamera web** mempertahankan kamera langsung di halaman sebagai alternatif. Mode ini memakai getUserMedia dan tidak menyediakan pemilihan galeri.
- Aplikasi tidak menambahkan tombol galeri. Namun `capture` adalah permintaan kepada browser, bukan penguncian sumber foto. Beberapa perangkat dapat menawarkan berkas yang sudah ada, dan komputer umumnya membuka pemilih berkas. Bila wajib foto langsung tanpa galeri, gunakan Kamera web. Tidak ada pemeriksaan metadata yang mengklaim dapat membuktikan foto pasti baru diambil.
- Setelah foto kamera diterima, aplikasi mengubahnya ke JPEG dengan sisi terpanjang maksimal 1800 piksel dan menjaga ukuran agar dapat diterima API. Berkas masukan maksimal 40 MiB; JPEG, PNG, WebP, HEIC/HEIF dapat diproses jika browser mampu membacanya. Foto yang gagal dibaca diarahkan untuk diambil ulang menggunakan Kamera web.
- Foto diteruskan otomatis ke antrean AI. Tombol kamera berikutnya tidak menunggu pemeriksaan AI selesai. Membatalkan kamera tidak menghapus foto lama.
- Input kamera berada di luar bagian halaman yang sering dirender ulang. Foto tetap masuk ke audit/elemen asal jika pengguna berpindah halaman ketika gambar sedang diproses.
- Sebelum logout, gambar yang sudah diterima dan sedang disiapkan disimpan ke perangkat terlebih dahulu. Pemeriksaan AI tidak perlu ditunggu; antrean dapat dilanjutkan setelah masuk kembali.

## Perbaikan v16.0.2

- Keluar tidak menyalin ulang semua data/foto ke penyimpanan HP bila perubahan terbaru sudah tersimpan. Penulisan lokal yang masih berjalan dipakai kembali; perubahan yang lebih baru tetap disimpan sebelum logout.
- Kejadian perubahan fokus pada catatan dengan isi yang sama tidak memicu penulisan ulang.
- Logout hanya menunggu penyimpanan lokal terakhir bila diperlukan, lalu permintaan menghapus cookie sesi. Proses tidak menunggu hasil AI atau seluruh unggahan foto. Foto yang belum terkirim tetap di perangkat asal dan dilanjutkan ketika masuk kembali dengan akun yang sama.
- Server menghapus cookie sesi tanpa membaca daftar akun petugas. Pemeriksaan POST dan Origin tetap berlaku; operasi audit/foto tetap memerlukan akun yang berhak.
- Halaman login baru tidak mengirim permintaan verifikasi sesi tambahan. Halaman yang dipulihkan dari cache riwayat tetap memeriksa sesi.
- Jika IndexedDB gagal sementara, penyimpanan lokal cadangan terbaru diutamakan saat masuk kembali agar catatan tidak tertutupi salinan IndexedDB yang lebih lama.
- Koneksi ke hosting tetap diperlukan untuk mengakhiri sesi. Tidak ada janji waktu tetap; latensi Netlify dan jaringan HP belum diukur dalam akun produksi pengguna.

## Perbaikan v16.0.1

- Tombol Keluar memiliki area sentuh minimal 44 px, status proses, dan pesan jika pengiriman gagal. Logout memanggil server untuk menghapus cookie sesi dan mengganti halaman dengan login. Formulir logout biasa tetap berfungsi jika JavaScript tidak tersedia.
- Setelah berhasil masuk, halaman login diganti dalam riwayat browser. Login yang dipulihkan dari cache memeriksa sesi; akun yang masih aktif kembali ke aplikasi.
- Tombol Kembali/Maju browser mengikuti halaman jadwal, audit, dan butir penilaian. Pergeseran antarbutir mengganti satu entri agar pengguna tidak perlu menekan Kembali 120 kali. Kembali juga menutup kamera/pratinjau/formulir dan menghentikan stream kamera bila ditutup.
- Catatan dikirim ke penyimpanan lokal ketika diketik, termasuk sebelum menekan tombol Kembali tanpa berpindah fokus terlebih dahulu.
- Sebelum logout, perubahan terbaru disimpan di perangkat dan antrean dijeda. Jika penyimpanan lokal gagal, aplikasi meminta cadangan sebelum keluar. Setelah logout, pemulihan halaman aplikasi dari cache memeriksa sesi lagi.
- Masa berlaku sesi tetap 12 jam. Tombol Kembali tidak mengakhiri sesi; sesi yang kedaluwarsa atau dicabut tetap memerlukan login kembali.

## Perubahan v16

- Data audit dan foto dapat dibuka kembali dari HP/laptop lain setelah masuk akun yang berhak.
- Admin mengakses semua SPBU. Setiap akun petugas ditugaskan ke satu nomor SPBU dan dapat membaca/mengubah audit SPBU tersebut. Pembatasan berlaku di server, termasuk untuk foto dan riwayat.
- Password admin dan petugas menerima **8–128 karakter**, termasuk 8 angka. Password diperlakukan sebagai teks sehingga angka nol di depan tetap dipertahankan.
- Status pengiriman terlihat di atas aplikasi. Perubahan saat offline tetap di IndexedDB akun/perangkat itu dan dicoba kembali saat internet tersambung.
- Foto yang sudah dikonfirmasi tersimpan di server dan tidak sedang menunggu AI dilepas dari cache data browser. Foto diambil kembali dari server ketika diperlukan.
- Perubahan bersamaan dari dua perangkat menghasilkan konflik yang dapat disimpan sebagai salinan; aplikasi tidak otomatis menimpa versi server.
- Lima versi metadata sebelumnya tersedia melalui Riwayat server. Penghapusan audit dapat dipulihkan admin melalui Audit dihapus. Foto yang menjadi rujukan riwayat tetap disimpan.
- Ada pemindahan data browser v15 yang dipilih secara eksplisit oleh admin, serta cadangan JSON portabel beserta foto.
- Jarak tombol bawah tetap disesuaikan untuk badge Netlify.

Checklist 120 butir, lima elemen, foto kamera satu per satu, pemeriksaan AI otomatis, antrean, pratinjau foto, penilaian manual, dan laporan tetap tersedia. Foto yang gagal diperiksa AI tetap disimpan.

## Pengaturan hosting

| Environment variable | Isi |
|---|---|
| GEMINI_API_KEY | API key Gemini, dimasukkan langsung di Netlify |
| ADMIN_USERNAME | Nama pengguna admin yang sudah dipakai |
| ADMIN_PASSWORD | Password admin, 8–128 karakter |

Tidak ada environment variable baru untuk penyimpanan. Netlify Functions menghubungkan Netlify Blobs melalui konteks runtime Netlify secara otomatis. Jangan memasukkan API key atau password operasional ke GitHub.

Nama pengguna memakai 3–40 karakter: huruf kecil, angka, titik, garis bawah, atau tanda hubung. Mengganti password admin mengakhiri sesi lama setelah deployment dengan nilai baru terbit. Ganti ADMIN_PASSWORD menjadi 8 karakter **setelah v16 berhasil dipasang**, lalu deploy kembali.

| Pengaturan build untuk repository yang sudah ada | Isi |
|---|---|
| Base directory | Siap_Audit_SPBU_v15_Netlify_Free |
| Build command | npm run build |
| Publish directory | public, relatif terhadap Base directory |
| Functions directory | netlify/functions, relatif terhadap Base directory |
| Node.js | 22 |

Folder pembungkus ZIP v16 sengaja tetap bernama **Siap_Audit_SPBU_v15_Netlify_Free** agar jalur Base directory proyek Netlify yang sudah ada tetap cocok. Versi program di package.json adalah 16.0.3. Untuk pemasangan di root repository, Base directory boleh kosong.

## Penyimpanan dan akses

- Akun petugas lama tetap memakai store `siap-audit-accounts-v15`; data audit/foto memakai store terpisah `siap-audit-data-v16`. Store ini bersifat site-wide dan tetap ada pada deployment berikutnya di proyek Netlify yang sama.
- Petugas v15 yang belum memiliki penugasan SPBU harus ditugaskan oleh admin lewat Akun petugas sebelum bisa mengakses audit pusat atau AI.
- Sesi memakai cookie HttpOnly, Secure, SameSite=Strict selama 12 jam. Password petugas di-hash dengan scrypt. Penonaktifan, penggantian password, dan penggantian SPBU petugas mencabut sesi lama.
- Daftar audit berisi ringkasan; isi dan foto diambil sesuai kebutuhan. Foto tidak memiliki tautan publik tanpa autentikasi. Cache foto bersifat privat; keluar akun membersihkan cache HTTP.
- Namespace IndexedDB dipisahkan menurut akun dan penugasan SPBU. Ini membantu pemisahan pemakaian aplikasi, bukan enkripsi disk HP. Data yang belum tersinkron masih bergantung pada perangkat asal.
- Sampai status **Audit dan foto tersimpan di server** muncul, jangan menghapus data browser atau mengganti perangkat untuk melanjutkan perubahan tersebut.
- Membuka halaman baru atau masuk akun memerlukan internet. Halaman yang sudah terbuka dapat menampung perubahan offline; ini bukan jaminan aplikasi dapat dibuka sepenuhnya offline.
- Riwayat lima versi berada di penyimpanan Netlify yang sama, bukan cadangan terpisah dari penyedia. Tetap unduh cadangan beserta foto secara berkala. Audit yang dihapus serta foto riwayat tetap memakai ruang.
- Batas aplikasi: metadata satu audit 3 MiB, satu foto 3 MiB, maksimal 600 foto per audit dan 50 akun petugas. Kamera aplikasi mengompresi foto sebelum pemeriksaan/pengiriman.

## Paket gratis

Netlify Blobs dan Functions tersedia pada paket Free. Paket tetap memiliki kuota/kredit pemakaian; penyimpanan pusat ini tidak menjamin pemakaian tanpa batas. Pada pemeriksaan dokumentasi 5 November 2026, Free memuat 300 kredit/bulan dengan batas keras. Periksa Usage & billing akun Anda, terutama transfer foto. Tidak perlu menambah layanan atau akun database lain.

Kuota API Gemini dihitung terpisah. Model utama tetap `gemini-3.5-flash-lite`, cadangan `gemini-3.8-flash`, mengikuti ketersediaan pada akun Gemini.

## Struktur dan verifikasi

- frontend/: tampilan, checklist, antrean AI, sinkronisasi, cache, migrasi, cadangan, service worker
- worker/handler.js: backend inti pemeriksaan AI
- worker/index.js: bundel hasil build tampilan dan backend inti
- server/auth.mjs, server/pages.mjs: autentikasi dan pengelolaan akun
- server/audits.mjs, server/audit-schema.json: API audit/foto, validasi, izin SPBU, revisi, riwayat
- netlify/functions/app.mjs: satu Netlify Function untuk seluruh aplikasi
- scripts/ dan test/: pengujian inti, akun, penyimpanan, dan sinkronisasi

Perintah lokal:

```sh
npm ci
npm run build
npm run validate
npm run check:bundle
```

Pengujian otomatis lulus: 32 skenario inti dan 83 skenario integrasi, total **115 skenario**. Mencakup password 8 karakter, izin lintas SPBU, penyimpanan terpisah, perangkat kedua, offline, respons terputus, konflik, migrasi, pemulihan, cache, dan escaping profil. Pengujian memakai penyimpanan tiruan serta respons Gemini tiruan; paket Function beserta SDK dan skema berhasil dibundel. Alur Keluar dan Kembali v16.0.1 sebelumnya diuji pada Chrome dengan server dan akun uji sementara. Optimasi v16.0.2 diperiksa dengan pengujian otomatis yang memastikan tidak ada penulisan ulang yang tidak perlu, perubahan saat penulisan berlangsung tetap tersimpan, dan logout tidak membaca penyimpanan akun. Alur input foto v16.0.3 juga diperiksa di Chrome desktop menggunakan dua PNG contoh yang dikonversi menjadi JPEG, penyimpanan server tiruan, dan respons AI tiruan; foto kedua dapat ditambahkan saat pemeriksaan pertama berlangsung, lalu kedua foto berstatus AI selesai dan tersimpan. Pembukaan kamera fisik HP, zoom/fokusnya, Netlify/Blobs produksi, dan API Gemini nyata perlu diperiksa setelah deploy. Paket pembaruan ini belum terbit ke akun Netlify pengguna.

## Dokumentasi resmi

- https://docs.netlify.com/build/data-and-storage/netlify-blobs/
- https://docs.netlify.com/build/environment-variables/overview/
- https://docs.netlify.com/build/functions/configuration/
- https://www.netlify.com/pricing/
- https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository

Dokumentasi kamera browser: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture
