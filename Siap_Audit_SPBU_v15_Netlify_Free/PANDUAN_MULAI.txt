# Panduan pembaruan v16.1.1 — Siap Audit SPBU

Untuk aplikasi yang sudah berada di https://siap-audit-spbu.netlify.app/. Gunakan repository dan proyek Netlify yang sama agar akun serta penyimpanan server tetap tersedia.

## 1. Simpan cadangan

1. Masuk ke aplikasi dari HP/browser yang menyimpan audit.
2. Pada Jadwal, pilih **Cadangkan semua audit** dan simpan berkas JSON.
3. Jangan menghapus data browser, terutama bila masih ada bukti yang belum terkirim. Cadangan yang memuat video dapat berukuran besar.

## 2. Perbarui aplikasi

1. Ekstrak ZIP. Nama folder di dalamnya tetap **Siap_Audit_SPBU_v15_Netlify_Free**.
2. Buka halaman utama repository **group223/siap-audit-spbu** di GitHub.
3. Pilih **Add file → Upload files**, lalu seret folder hasil ekstrak tersebut. Unggah folder/isinya, bukan ZIP. Gunakan jalur folder yang sama dengan versi sebelumnya.
4. Pilih **Commit changes**.
5. Buka Netlify → proyek yang sama → **Deploys**. Tunggu status **Published**.
6. Pastikan package.json di GitHub menunjukkan versi **16.1.1** dan file baru **server/videos.mjs** ikut terunggah.
7. Muat ulang aplikasi sekali pada HP/browser. Jangan hapus data browser dan jangan membuat proyek hosting baru.

Pengaturan tetap:

| Pengaturan | Nilai |
| --- | --- |
| Base directory | Siap_Audit_SPBU_v15_Netlify_Free |
| Build command | npm run build |
| Publish directory | public, relatif terhadap Base directory |
| Functions directory | netlify/functions, relatif terhadap Base directory |
| Branch produksi | main |
| Node | 22 atau lebih baru |

Tidak perlu mengganti environment variables yang sudah berfungsi: **ADMIN_USERNAME**, **ADMIN_PASSWORD**, dan **GEMINI_API_KEY**. Password minimal 8 karakter. Jangan memasukkan kunci/password ke file yang diunggah ke GitHub.

## 3. Foto dan video

1. Buka audit → Checklist → pilih elemen → pilih subelemen/butir.
2. Tekan **Kamera**. Pada Android, pilih mode **Foto** atau **Video** di panel yang sama, lalu tekan **Buka kamera**. Pada perangkat yang mendukung pilihan gabungan, pilih mode langsung pada kamera atau pemilih bawaan HP.
3. Selesaikan pengambilan di kamera, lalu pilih Gunakan/OK/Selesai pada HP.
4. Foto langsung masuk antrean AI. Video masuk pemeriksaan AI setelah pengiriman ke server selesai.
5. Anda bisa mengambil bukti lain atau berpindah butir tanpa menunggu AI. Foto/video tetap ditandai untuk butir asal.
6. Ketuk sampul video untuk memutar rekaman. Satu bukti dapat mendukung beberapa butir terkait bila hasil pemeriksaannya relevan. Nilai A–F tetap dipilih petugas.

**Batas video:** maksimal **60 detik dan 12 MB**. Disarankan video singkat dengan resolusi 720p. Format: MP4, MOV, atau WebM yang dapat diputar di browser. Jika terlalu besar, rekam ulang lebih singkat atau turunkan resolusi kamera.

Antarmuka kamera berasal dari HP/browser. Beberapa perangkat masih dapat menawarkan galeri atau berkas. Komputer biasanya membuka pemilih berkas. Kontrol zoom dan fokus mengikuti kamera bawaan HP.

Tunggu status **tersimpan di server** sebelum menutup aplikasi atau membersihkan data HP. Video belum terkirim tetap memerlukan HP asal. Jika penyimpanan HP penuh, biarkan aplikasi terbuka sampai bukti selesai dikirim, lalu unduh cadangan.

## 4. Cetak laporan + foto/video

1. Buka audit → **Capaian**.
2. Pilih **Cetak laporan + foto/video**.
3. Tunggu status **Laporan siap**. Seluruh foto/sampul harus selesai dimuat sebelum tombol cetak aktif.
4. Pilih **Cetak / Simpan PDF**, lalu pilih printer atau Simpan sebagai PDF pada dialog perangkat.
5. Video ditampilkan sebagai cuplikan gambar beserta durasi dan kode butir. Rekaman lengkap tetap diputar di aplikasi.
6. Jika bukti gagal dimuat, periksa internet lalu pilih **Coba muat lagi**.
7. Jika dialog cetak tidak muncul, pilih **Unduh laporan HTML**. Buka hasilnya melalui Chrome/Safari lalu gunakan menu **Cetak**. Gambar sudah tertanam di file HTML tersebut.
8. Pilih **Kembali ke audit** untuk menutup pratinjau. Tombol Kembali HP juga menutupnya.

**Cetak ringkas** membuka pratinjau tanpa gambar. Berkas HTML dan PDF yang Anda unduh berisi data audit; bagikan sesuai kebutuhan operasional Anda.

## 5. Akun dan data lama

- Admin melihat seluruh SPBU. Petugas hanya melihat SPBU yang ditugaskan melalui **Akun petugas → No. SPBU yang boleh diakses**.
- Beberapa petugas pada SPBU yang sama dapat mengerjakan audit bersama. Foto/video mengikuti izin audit yang sama.
- Akun lama, password, audit, dan foto lama tetap menggunakan penyimpanan yang sama. Tidak perlu membuat akun atau audit ulang.
- Cadangan JSON menyimpan foto dan video lengkap; laporan HTML menampilkan foto serta sampul video.

## Verifikasi

141 pengujian otomatis dan bundel Netlify Function lulus. Pengujian mencakup satu tombol untuk kedua jenis bukti, pemilihan mode Android, dan tombol Kembali pada panel kamera. Foto, video MP4 contoh, pemutaran, antrean AI, serta unduhan/pratinjau laporan diperiksa di Chrome desktop dengan penyimpanan dan respons AI tiruan. Kamera fisik HP, dialog cetak/PDF perangkat pengguna, dan layanan produksi belum diverifikasi. Perubahan pada tautan aktif baru berlaku setelah paket ini diunggah dan Netlify Published.
