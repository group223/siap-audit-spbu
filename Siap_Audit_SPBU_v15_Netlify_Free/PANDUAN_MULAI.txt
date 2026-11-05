# Langkah pemasangan — Siap Audit SPBU v15 Netlify Free

Kerjakan melalui laptop/PC. Jalur ini menggunakan akun GitHub personal dan Netlify Free. Anda tidak perlu memasang PHP, Laravel, VS Code, atau Cloudflare Zero Trust.

## 1. Ekstrak paket

1. Unduh dan ekstrak Siap_Audit_SPBU_v15_Netlify_Free.zip.
2. Buka folder hasil ekstrak.
3. Pastikan berkas **package.json** dan **netlify.toml** terlihat, beserta folder frontend, netlify, public, scripts, server, test, dan worker.

## 2. Buat repository GitHub

1. Buka https://github.com/ dan masuk/daftar memakai akun pribadi Anda.
2. Pilih **New repository**.
3. Beri nama **siap-audit-spbu**.
4. Pilih **Private** dan aktifkan pembuatan README agar menu unggah mudah terlihat.
5. Klik **Create repository**.
6. Buka **Add file → Upload files**.
7. Dari komputer, buka folder hasil ekstrak, pilih **seluruh isi di dalamnya**, lalu seret ke halaman unggah GitHub. Pertahankan folder beserta isinya.
8. Klik **Commit changes**. Jika GitHub menampilkan Propose changes, selesaikan pengajuan dan penggabungannya ke branch main.
9. Periksa halaman repository: **package.json** dan **netlify.toml** harus terlihat langsung di halaman utama repository. Jika berada di dalam satu folder pembungkus tambahan, pindahkan isinya ke root repository sebelum melanjutkan.

API key dan kata sandi pengelola dimasukkan nanti pada Netlify, tidak diunggah ke repository.

## 3. Hubungkan ke Netlify Free

1. Buka https://app.netlify.com/ dan masuk/daftar. Memakai **GitHub** sebagai cara masuk memudahkan tahap impor.
2. Pilih paket **Free ($0)**.
3. Pada dashboard, pilih **Add new project → Import an existing project**.
4. Pilih **GitHub**. Jika diminta memberi akses repository, pilih hanya repository **siap-audit-spbu** yang digunakan.
5. Pilih repository tersebut dan branch **main**.
6. Isi/cek pengaturan:

| Pengaturan | Isi |
|---|---|
| Base directory | Kosong, jika package.json dan netlify.toml berada di root |
| Build command | npm run build |
| Publish directory | public |
| Functions directory | netlify/functions (sudah di netlify.toml) |

Jika Netlify sudah membaca konfigurasi otomatis, gunakan nilai yang sama.

## 4. Masukkan tiga environment variables

Pada halaman konfigurasi sebelum Deploy, buka bagian **Environment variables / Add environment variables**. Tambahkan:

| Key | Value |
|---|---|
| GEMINI_API_KEY | API key Gemini Anda |
| ADMIN_USERNAME | Nama pengguna yang Anda pilih, misalnya pengelola |
| ADMIN_PASSWORD | Kata sandi buatan Anda sendiri, minimal 12 dan maksimal 128 karakter |

ADMIN_USERNAME menggunakan huruf kecil, angka, titik, garis bawah, atau tanda hubung; panjang 3–40 karakter.

Jika pilihan scope tersedia, pastikan nilai tersedia untuk **Functions**. Opsi **All scopes** juga mencakup Functions. Jangan memakai nilai yang hanya tersedia untuk Build.

Jika variabel belum bisa diisi sebelum deploy pertama:

1. Selesaikan pembuatan proyek dan build awal.
2. Buka **Project configuration → Environment variables**, tambahkan ketiga nilai di atas, lalu simpan.
3. Buka **Deploys → Trigger deploy → Deploy project**.

Halaman “Pengelola perlu melengkapi pengaturan akun” sebelum ketiga nilai terpasang merupakan penanda pengaturan akun belum selesai. Akses aplikasi dan AI tetap dibatasi.

## 5. Terbitkan dan uji

1. Klik **Deploy / Deploy project**, lalu tunggu build selesai.
2. Pada rincian deploy, pastikan ada **Function bernama app**. Paket ini memakai satu Function untuk login, halaman aplikasi, dan backend AI.
3. Jika proyek baru ditandai **Private**, selesaikan tindakan **Publish** di Netlify agar petugas bisa mengakses alamat aplikasinya. Login aplikasi tetap berlaku setelah proyek dipublikasikan.
4. Buka alamat **.netlify.app** yang diberikan Netlify.
5. Masuk dengan ADMIN_USERNAME dan ADMIN_PASSWORD yang Anda tentukan.
6. Buat satu sesi pemeriksaan SPBU. Buka dari HP, izinkan kamera, ambil satu foto, dan tunggu hasil AI.
7. Coba buka kamera lagi saat AI bekerja. Foto berikutnya harus tetap bisa diambil dan masuk antrean.
8. Coba alamat aplikasi di jendela privat/incognito: halaman masuk harus muncul, dan API pemeriksaan tidak dapat dipakai tanpa akun.

## 6. Tambah akun petugas

1. Masuk memakai akun pengelola.
2. Di bagian atas aplikasi, pilih **Akun petugas**.
3. Isi nama, nama pengguna, dan kata sandi awal petugas (minimal 12 karakter).
4. Klik **Buat akun petugas**.
5. Petugas membuka alamat aplikasi yang sama dan masuk dengan akunnya.

Petugas tidak perlu menjadi anggota tim hosting Netlify dan tidak perlu membuat akun GitHub. Akun petugas disimpan otomatis oleh aplikasi pada Netlify Blobs. Dari halaman yang sama pengelola dapat menonaktifkan akun atau mengganti kata sandinya.

## 7. Pindahkan data lama

1. Buka aplikasi lama: https://siap-audit-spbu.inayahgroup3.chatgpt.site
2. Pada halaman Jadwal, tekan **Cadangkan semua audit**.
3. Simpan JSON hasil unduhan.
4. Buka aplikasi Netlify yang baru, masuk akun, lalu pilih **Pulihkan cadangan**.
5. Pilih JSON tersebut dan periksa kembali SPBU, tanggal, foto, serta nilainya.

Riwayat pada alamat lama tidak otomatis berpindah. Simpan cadangan lama sampai pemulihan selesai diperiksa.

## 8. Pasang di HP

- Android / Chrome: buka alamat aplikasi, masuk akun, lalu **menu ⋮ → Instal aplikasi / Tambahkan ke layar utama**, jika tersedia.
- iPhone / Safari: buka alamat aplikasi, lalu **Bagikan → Tambahkan ke Layar Utama**.

## Setelah selesai pemeriksaan

- Gunakan sesi terpisah untuk setiap SPBU dan tanggal pemeriksaan.
- Buat cadangan setelah pemeriksaan selesai. Foto dan data audit masih tersimpan pada browser/perangkat masing-masing, bukan tersinkron antar-HP.
- Halaman yang sudah terbuka dapat menyimpan foto ketika internet terputus; pemeriksaan AI menunggu koneksi. Untuk membuka ulang halaman atau masuk akun diperlukan internet.
- Tetap gunakan paket Free dan pantau Usage & billing. Kuota hosting Netlify serta API Gemini dihitung terpisah.

Jika ada kendala, catat tahap dan pesan errornya. Tangkapan layar pengaturan cukup menampilkan nama variabel dan statusnya; sembunyikan API key serta kata sandi.
