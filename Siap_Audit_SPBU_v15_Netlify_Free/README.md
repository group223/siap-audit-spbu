# Siap Audit SPBU v16.1.2 — tampilan ringkas

Pembaruan untuk aplikasi pra-audit SPBU pada Netlify. Audit, penilaian, hasil AI, foto, dan video disimpan di Netlify Blobs setelah sinkronisasi selesai. Buka **PANDUAN_MULAI.md** untuk langkah memperbarui aplikasi yang sudah terpasang.

## Pembaruan v16.1.2

- Pada elemen dan butir, ketuk ikon kamera **+** dalam kotak garis putus untuk mengambil foto atau video. Keduanya tetap memakai satu tombol.
- Pertanyaan, bukti, status AI, dan nilai tampil langsung. Buka **Panduan bukti** atau **Catatan AI** saat memerlukan rincian.
- Pada **Capaian**, tombol cetak tampil langsung. Rincian poin dan pengelolaan audit bisa dibuka sesuai kebutuhan. Cadangan seluruh audit ada di **Jadwal → Cadangan**.

## Fitur yang tetap tersedia

### Cetak laporan dan foto

- Tombol **Cetak + foto/video** membuka pratinjau laporan. Aplikasi memuat gambar, membuat salinan gambar untuk cetak, dan menunggu gambar pada dokumen selesai dimuat sebelum mengaktifkan **Cetak / Simpan PDF**.
- Dialog cetak dipanggil langsung dari tombol pada pratinjau yang sudah siap. Tidak ada pemanggilan cetak otomatis setelah pengunduhan panjang. Laporan tetap tersedia setelah dialog ditutup.
- Jika bukti gagal dimuat, cetak diblokir dengan pesan dan tombol **Coba muat lagi**. Foto tidak dihilangkan diam-diam dari laporan. Saat offline, bukti yang hanya tersedia di server perlu koneksi internet untuk dicetak.
- **Unduh laporan HTML** membuat laporan mandiri dengan gambar tertanam. Buka file itu di Chrome/Safari dan gunakan menu Cetak bila dialog di browser aplikasi tidak muncul.
- Gambar memakai rasio asli dan tidak dipotong. Setiap bukti memiliki keterangan kode butir asal. Video dicetak sebagai cuplikan gambar dan durasi; rekaman lengkap diputar di aplikasi.
- Pratinjau dan berkas laporan memakai salinan data, sehingga penyiapan laporan tidak menambah data foto ke penyimpanan audit atau mengubah penilaian.

### Kamera HP dan video

- Elemen dan setiap butir memiliki satu ikon kamera **+**. Satu input kamera menerima foto dan video, kemudian meneruskan hasil sesuai jenis bukti.
- Di Android, panel **Kamera HP** menyediakan pilihan mode **Foto** dan **Video** dengan satu tombol **Buka kamera**. Browser Android memerlukan satu jenis media agar dapat membuka mode kamera bawaan yang tepat. Pada perangkat yang mendukung kedua jenis media sekaligus, ikon kamera **+** langsung meminta pemilih bawaan untuk foto/video. Tombol Kembali menutup panel mode tanpa berpindah butir.
- Video MP4, MOV, dan WebM didukung jika dapat diputar browser. Batas per video: **60 detik dan 12 MiB (ditampilkan sebagai 12 MB)**. Disarankan rekaman singkat dengan resolusi 720p. Batas ukuran/durasi tersedia di **Panduan bukti**.
- Rekaman ditautkan ke butir asal, memiliki sampul, dan dapat diputar dengan kontrol video. Petugas tetap dapat mengambil bukti lain atau berpindah halaman selama proses berjalan.
- Video dikirim dalam bagian 1 MiB dan dilanjutkan dari bagian yang belum terkirim. Server memeriksa jenis berkas, ukuran, durasi, hash setiap bagian, dan hash seluruh rekaman sebelum video dapat direferensikan dalam audit.
- Video dan sampul hanya tersedia bagi akun yang boleh mengakses audit tersebut. Pemutaran memakai respons streaming serta HTTP Range untuk seek, dengan akses terikat akun dan tanpa cache CDN bersama.
- AI otomatis menunggu video selesai tersimpan dan ditautkan pada audit server. Permintaan dari browser hanya mengirim referensi video; server memeriksa izin SPBU lalu mengirim rekaman ke Gemini. Pemeriksaan foto sebelumnya tetap memakai alur yang sama. Nilai A–F tetap ditentukan petugas.
- Rekaman yang belum terkirim disimpan sebagai Blob pada IndexedDB. Jika penyimpanan ini gagal, aplikasi tidak mengeklaim video sudah aman melalui JSON/localStorage yang akan membuang isi Blob. Biarkan aplikasi terbuka sampai status tersimpan di server; logout tidak melanjutkan bila penyimpanan lokal belum aman.
- Cadangan JSON mencakup foto dan rekaman lengkap. Cadangan yang memuat video dapat berukuran besar. Akun, hak akses, namespace penyimpanan v16, dan audit lama tetap digunakan.

**Kompatibilitas kamera:** capture merupakan permintaan kepada browser, bukan pengunci sumber rekaman. HP/browser tertentu tetap dapat menawarkan galeri; komputer biasanya membuka pemilih berkas. Zoom, fokus, format video, dan kontrol kamera mengikuti perangkat. Kamera fisik HP serta dialog cetak perangkat pengguna belum diuji di sesi ini.

Bagian v16.0.x di bawah merupakan riwayat pengembangan. Pilihan kamera web yang disebut pada riwayat tersebut sudah dihapus pada v16.1.0.

## Riwayat v16.0.4

- Setiap halaman subelemen/butir penilaian sekarang memiliki tombol **Tambah foto** dan **Kamera web**. Petugas dapat membuka butir, mengambil foto, lalu melanjutkan ke butir lain.
- Foto menyimpan kode asalnya, misalnya **3.1.3.a**, dan ditampilkan di halaman butir tersebut. Kaitan ini ikut tersimpan di server, cadangan JSON, dan perangkat kedua. Server menolak kode yang tidak ada atau berada pada elemen lain.
- AI menerima kode butir yang sedang diperiksa sebagai fokus, lalu tetap memeriksa butir lain pada elemen yang sama. Jika satu foto relevan untuk beberapa butir, hasilnya dapat dipakai bersama tanpa mengunggah salinan foto tersebut.
- Foto umum elemen dan foto dari versi sebelumnya tetap tersedia. Foto yang diperiksa AI sebagai relevan untuk suatu butir juga ditampilkan pada halaman butir tersebut. Nilai A–F tetap dipilih petugas.
- Pengambilan foto tidak mengembalikan petugas ke daftar elemen. Foto tetap ditautkan ke butir asal meskipun petugas berpindah halaman saat gambar diproses, dan foto berikutnya dapat diambil saat AI masih memeriksa.
- Tombol umum pada halaman Elemen audit tetap dapat digunakan. Semua foto elemen dapat dilihat melalui **Lihat semua foto elemen** pada halaman butir.

## Riwayat v16.0.3

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

Folder pembungkus ZIP v16 sengaja tetap bernama **Siap_Audit_SPBU_v15_Netlify_Free** agar jalur Base directory proyek Netlify yang sudah ada tetap cocok. Versi program di package.json adalah 16.1.2. Untuk pemasangan di root repository, Base directory boleh kosong.

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

Pengujian otomatis lulus: **141 skenario** (32 skenario inti dan 109 skenario integrasi). Mencakup alur lama, perizinan SPBU, unggahan video bertahap, kelanjutan unggahan, verifikasi hash, pemutaran Range, akses poster, AI melalui referensi video, cadangan/pemulihan rekaman, penyiapan gambar cetak, kegagalan jaringan, ekspor HTML, dan penutupan pratinjau saat memuat. Pengujian kamera memverifikasi pemilih foto/video yang sama, panel mode Android, pembatalan, dan navigasi Kembali. Paket Function beserta SDK dan modul video berhasil dibundel.

QA Chrome desktop v16.1.2 memverifikasi ikon kamera pada elemen dan butir, tampilan contoh foto/video, panduan yang bisa dibuka, dan posisi tombol cetak di Capaian.

QA Chrome desktop untuk v16.1.0 menggunakan data contoh, penyimpanan tiruan, dan respons Gemini tiruan: video MP4 tiga detik berhasil diunggah melalui pemilih berkas, ditautkan ke butir asal, tersimpan, masuk antrean AI hingga selesai, dan diputar sampai akhir. Pratinjau laporan memuat satu foto dan dua sampul video, seluruh gambar selesai dimuat, tombol cetak aktif, dan unduhan HTML selesai. Browser uji tidak menampilkan dialog cetak sistem, sehingga hasil PDF fisik belum diverifikasi. Pembukaan kamera fisik HP, zoom/fokus, layanan Netlify/Blobs produksi, dan API Gemini nyata perlu diperiksa setelah deploy. Paket ini belum diterapkan ke akun Netlify pengguna.

## Dokumentasi resmi

- https://docs.netlify.com/build/data-and-storage/netlify-blobs/
- https://docs.netlify.com/build/environment-variables/overview/
- https://docs.netlify.com/build/functions/configuration/
- https://www.netlify.com/pricing/
- https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository

Dokumentasi kamera browser: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture

Dokumentasi video Gemini: https://ai.google.dev/gemini-api/docs/video-understanding
Dokumentasi batas Function: https://docs.netlify.com/build/functions/configuration/
