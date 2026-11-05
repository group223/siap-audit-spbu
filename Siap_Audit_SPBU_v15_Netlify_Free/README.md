# Siap Audit SPBU v15 — Netlify Free

Paket pemasangan mandiri untuk aplikasi pra-audit SPBU. Pilihan ini menggunakan paket Netlify Free dan login petugas di dalam aplikasi. Pengelola dan petugas tidak perlu mengaktifkan Cloudflare Access.

**Mulai dari PANDUAN_MULAI.md.** Gunakan paket Netlify ini untuk langkah di dalam panduan tersebut.

## Yang disediakan

- Checklist 120 butir dalam 5 elemen, penilaian dan laporan dari versi 14.
- Foto langsung dari kamera, satu per satu, dan pemeriksaan AI otomatis melalui server.
- Antrean tetap berjalan ketika pengguna membuka kamera atau berpindah halaman aplikasi.
- Foto yang gagal diperiksa tetap disimpan; foto yang perlu diulang ditandai.
- Login pengelola dan akun petugas terpisah, tanpa PIN AI bersama.
- Pengelola dapat menambahkan petugas, mengaktifkan/menonaktifkan akun, dan mengganti kata sandi petugas.
- Cookie sesi HttpOnly/Secure selama 12 jam; kata sandi petugas disimpan sebagai hash scrypt.
- Akun petugas disimpan pada Netlify Blobs secara otomatis. Petugas tidak memerlukan akun Netlify atau GitHub.
- Data audit dan foto tetap tersimpan di browser/perangkat masing-masing, dengan fitur cadangan dan pemulihan.

## Tiga pengaturan di Netlify

| Nama environment variable | Isi |
|---|---|
| GEMINI_API_KEY | API key Gemini Anda yang sudah digunakan |
| ADMIN_USERNAME | Nama pengguna pengelola, contoh: pengelola |
| ADMIN_PASSWORD | Kata sandi buatan Anda sendiri, 12–128 karakter |

Masukkan nilainya langsung di pengaturan Netlify. Paket ini tidak memuat API key atau kata sandi operasional.

Nama pengguna memakai 3–40 karakter: huruf kecil, angka, titik, garis bawah, atau tanda hubung. Mengganti ADMIN_PASSWORD pada hosting mengakhiri seluruh sesi lama setelah versi dengan pengaturan baru diterbitkan.

## Pemasangan

Panduan utama memakai repository pribadi pada akun GitHub personal, kemudian **Import an existing project** di Netlify. Build dan Functions akan dipasang bersama. Pengaturannya sudah disertakan dalam netlify.toml:

- Build command: npm run build
- Publish directory: public
- Functions directory: netlify/functions
- Node.js: 22

Netlify juga menyediakan alur unggah proyek yang menjalankan build ketika pengguna sudah masuk akun. Jika memakai alur itu, pastikan proses build benar-benar berjalan dan hasil deploy memuat Function bernama app. Mengunggah hasil statis saja tidak memasang seluruh backend dan login paket ini.

## Batas yang relevan

- Netlify Free untuk akun baru menggunakan 300 kredit/bulan pada pemeriksaan dokumentasi 5 November 2026. Deploy produksi, komputasi, transfer data, dan permintaan menggunakan kredit. Paket Free memiliki batas keras; proyek dapat dijeda jika kredit habis. Periksa nilai aktif pada Usage & billing.
- API Gemini memakai kuota proyek tersendiri. Paket ini tetap memakai Gemini 3.5 Flash-Lite sebagai model utama dan Gemini 3.8 Flash sebagai cadangan, mengikuti ketersediaan akun.
- Antrean dan foto yang sudah disimpan dipertahankan ketika jaringan/AI gagal. Muat ulang halaman dan masuk kembali bila sesi berakhir.
- Halaman aplikasi dan hasil AI tidak disimpan di cache service worker. Halaman baru perlu koneksi untuk memeriksa sesi. Halaman yang sudah terbuka tetap bisa menyimpan foto saat koneksi terputus; AI melanjutkan setelah tersambung.
- Data audit/foto belum disinkronkan ke server. Semua akun yang diizinkan pada browser/perangkat yang sama dapat membuka data audit yang tersimpan di browser tersebut. Gunakan cadangan untuk berpindah perangkat atau alamat aplikasi.

## Struktur

- frontend/: sumber tampilan, checklist, ikon, dan service worker
- worker/handler.js: logika pemeriksaan AI dan aset aplikasi
- worker/index.js: hasil build aset dan backend inti
- server/: login, pengelolaan akun, dan pembatas akses server
- netlify/functions/app.mjs: pintu masuk Netlify Function untuk seluruh rute
- public/index.html: halaman netral jika konfigurasi Function belum terpasang
- scripts/: build, pengujian antrean, skor, cadangan, dan pemeriksaan bundel
- test/: pengujian akses akun dan integrasi adapter Netlify

## Verifikasi

Sudah dijalankan secara lokal:

1. npm run build
2. npm run validate: 32 skenario inti + 16 skenario login/integrasi = 48 skenario
3. npm run check:bundle: bundel Netlify API v2 berhasil, seluruh rute melalui login, aset statis tidak melewati pembatas akses, dan aturan rate limit masuk dalam metadata deploy

Pengujian Netlify memakai penyimpanan akun tiruan dan respons Gemini tiruan untuk memverifikasi izin serta seluruh 56 butir Elemen 3. Koneksi akun Netlify nyata dan penyimpanan Blobs produksi perlu diuji setelah pengguna memasang paket pada hostingnya sendiri. Paket ini belum diterbitkan ke akun Netlify pengguna.

Asal versi inti: commit 0f96976359d78dea93046f75680f0e3c3a50faaf dari versi 14. Pembaruan v15 berada pada adaptasi Netlify, login, pengelolaan petugas, dan kebijakan cache.

## Dokumentasi resmi

- Paket dan kuota: https://www.netlify.com/pricing/
- Paket Free tanpa kartu: https://www.netlify.com/blog/introducing-netlify-free-plan/
- Mengimpor proyek: https://docs.netlify.com/manage/projects/add-new-project/
- Environment variables: https://docs.netlify.com/build/environment-variables/overview/
- Netlify Functions: https://docs.netlify.com/build/functions/configuration/
- Netlify Blobs: https://docs.netlify.com/build/data-and-storage/netlify-blobs/
- Mengunggah berkas GitHub: https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository
