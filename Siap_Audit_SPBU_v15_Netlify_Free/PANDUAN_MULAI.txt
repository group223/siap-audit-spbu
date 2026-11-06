# Panduan pembaruan v16.0.3 — Siap Audit SPBU

Untuk aplikasi yang sudah berada di https://siap-audit-spbu.netlify.app/. Gunakan proyek Netlify dan repository GitHub yang sama agar akun lama serta penyimpanan server tetap tersedia.

## Kamera HP — pembaruan v16.0.3

1. Perbarui folder yang sama di GitHub, tunggu Netlify Published, lalu muat ulang aplikasi satu kali. Tidak perlu mengganti environment variables.
2. Buka audit → Checklist → pilih elemen → **Ambil satu foto**.
3. Browser akan meminta kamera belakang HP. Gunakan zoom dan ketuk fokus jika disediakan pada antarmuka kamera tersebut.
4. Setelah memotret, pilih **Gunakan foto / OK / Selesai** sesuai HP Anda. Foto akan disiapkan, disimpan, dan diperiksa AI otomatis.
5. Tekan **Ambil satu foto** lagi untuk foto berikutnya. Tidak perlu menunggu AI menyelesaikan foto sebelumnya.
6. Jika kamera HP tidak terbuka atau foto tidak dapat dibaca, gunakan **Kamera web**.

Pada sebagian browser, pilihan galeri/berkas masih dapat muncul karena pengaturan antarmuka berasal dari HP/browser. Aplikasi web tidak dapat menguncinya 100%. Gunakan **Kamera web** bila pengambilan langsung tanpa galeri diwajibkan. Komputer biasanya membuka pemilih berkas pada tombol utama. Zoom/fokus fisik belum diuji pada HP Anda.

Pembatalan kamera tidak menambahkan foto dan tidak menghapus foto sebelumnya. Jika foto sudah diterima lalu Anda menekan Keluar, aplikasi menyelesaikan penyimpanan lokalnya terlebih dahulu; hasil AI dapat dilanjutkan setelah masuk kembali.

## Optimasi Keluar v16.0.2

Data yang sudah tersimpan di HP tidak ditulis ulang ketika Keluar ditekan. Jika masih ada perubahan yang belum tersimpan, aplikasi mengamankan perubahan terakhir terlebih dahulu. Tidak perlu menunggu AI atau seluruh foto selesai diunggah untuk logout; data yang belum terkirim tetap berada di HP asal. Gunakan akun yang sama pada perangkat itu untuk melanjutkan pengiriman.

Koneksi ke server tetap dibutuhkan untuk menghapus sesi. Waktu sebenarnya bergantung pada jaringan dan hosting; optimasi ini belum diukur pada Netlify produksi Anda.

## Perbaikan Keluar dan tombol Kembali

Paket ini sudah berisi perbaikan v16.0.3. Perbarui folder yang sama melalui GitHub dan tunggu Netlify Published. Tidak perlu membuat proyek baru atau mengubah environment variables.

Setelah Published:

1. Di aplikasi yang masih terbuka, muat ulang satu kali agar memakai kode terbaru. Jangan hapus data browser.
2. Masuk, buka audit, masuk ke salah satu butir, lalu tekan Kembali pada HP: kembali ke daftar elemen audit. Tekan Kembali lagi: kembali ke Jadwal; akun tetap masuk selama sesi aktif.
3. Tekan Keluar di bagian atas: tunggu proses selesai dan halaman login muncul. Jika koneksi gagal, pesan ditampilkan dan tombol bisa dicoba lagi.
4. Setelah Keluar, tombol Kembali tidak boleh memberikan akses ke audit tanpa masuk kembali.

Sesi berlaku 12 jam. Berakhirnya masa sesi, perubahan password, atau pencabutan akses petugas tetap dapat meminta login kembali.

## 1. Simpan cadangan sebelum memperbarui

1. Dari HP/browser yang menyimpan audit lama, masuk aplikasi.
2. Pada Jadwal, tekan **Cadangkan semua audit** dan simpan JSON hasil unduhan.
3. Jangan hapus data browser. Lakukan ini pada setiap perangkat yang mempunyai data audit berbeda.

## 2. Ekstrak dan unggah pembaruan ke GitHub

1. Unduh **Siap_Audit_SPBU_v16_0_3_Kamera_HP.zip** lalu ekstrak.
2. Di dalam hasil ekstrak ada folder **Siap_Audit_SPBU_v15_Netlify_Free**. Nama folder tetap sama agar cocok dengan hosting yang sudah terpasang; program di dalamnya sudah v16.
3. Buka https://github.com/group223/siap-audit-spbu pada branch **main**.
4. Pastikan berada di halaman utama repository, lalu pilih **Add file → Upload files**.
5. Seret **folder Siap_Audit_SPBU_v15_Netlify_Free beserta seluruh isinya** dari hasil ekstrak ke halaman unggah. Jangan unggah berkas ZIP. Jangan masuk ke folder repository lalu menyeret folder yang sama, karena akan membuat folder bertingkat.
6. Klik **Commit changes**. Jika muncul konfirmasi mengganti berkas, gunakan berkas baru. Selesaikan commit ke main.
7. Buka folder tersebut di GitHub: package.json harus menunjukkan versi **16.0.3**, dan server/ harus berisi **audits.mjs** serta **audit-schema.json**.

Paket tidak berisi password atau API key operasional. Tidak perlu mengubah tiga variabel Netlify yang sudah berhasil dipakai.

## 3. Tunggu deployment Netlify

1. Buka https://app.netlify.com/ dan pilih proyek **siap-audit-spbu**.
2. Buka **Deploys**. Commit GitHub akan memicu deployment otomatis bila auto publishing aktif.
3. Jika belum berjalan, pilih **Trigger deploy → Deploy project**.
4. Tunggu deployment terbaru berstatus **Published**, lalu buka alamat aplikasi.

Jika build gagal atau halaman tidak ditemukan, periksa **Project configuration → Developer settings → Build settings**:

| Pengaturan | Isi |
|---|---|
| Base directory | Siap_Audit_SPBU_v15_Netlify_Free |
| Build command | npm run build |
| Publish directory | public |
| Functions directory | netlify/functions |

Publish dan Functions dihitung relatif terhadap Base directory. Pada tampilan ringkasan Netlify, jalur dapat terlihat lengkap dengan nama Base directory. Pastikan deployment menyertakan Function bernama **app**. Deploy statis saja tidak memasang login dan penyimpanan pusat.

## 4. Pindahkan audit lama ke server

1. Pada **browser dan alamat aplikasi yang sama** dengan data lama, muat ulang aplikasi lalu masuk sebagai admin.
2. Di atas aplikasi muncul informasi jumlah audit versi lama beserta tombol **Pindahkan ke server**.
3. Tekan tombol tersebut dan setujui pemindahan. Audit masuk antrean pengiriman; data sumber browser tetap dipertahankan.
4. Biarkan halaman terbuka dan internet tersambung sampai status **Audit dan foto tersimpan di server** muncul.
5. Jika nomor SPBU belum valid, buka audit → **Capaian → Ubah data audit**, lengkapi nomor tujuh angka (contoh 64.701.10), lalu sinkronkan.
6. Dari HP/laptop kedua, buka aplikasi dan masuk dengan akun yang berhak. Tekan **Perbarui daftar** dan periksa satu audit beserta fotonya.

Jika data berasal dari alamat aplikasi lain atau tombol pemindahan tidak muncul, gunakan **Pulihkan cadangan**, pilih JSON yang sudah disimpan, lalu tunggu sinkronisasi. Pemulihan membuat audit baru dan tidak menimpa audit server. Mengimpor data yang sama berulang kali akan menghasilkan salinan tambahan. Setelah seluruh audit dan fotonya diperiksa dari perangkat kedua serta cadangan terpisah disimpan, salinan browser lama boleh dibersihkan melalui pengaturan data situs browser. Login kembali untuk mengambil audit dari server. Jangan lakukan ini ketika masih ada perubahan menunggu sinkronisasi.

Untuk data di HP petugas lama, unduh cadangan lalu minta admin memulihkannya, atau gunakan pemulihan pada akun petugas setelah penugasan SPBU disimpan. Petugas hanya boleh memulihkan audit SPBU yang ditugaskan.

## 5. Atur petugas untuk setiap SPBU

1. Masuk admin → **Akun petugas**.
2. Pada akun petugas yang sudah ada, isi **No. SPBU yang boleh diakses**, lalu klik **Simpan SPBU**.
3. Untuk akun baru, isi nama, nama pengguna, nomor SPBU, dan password **minimal 8 karakter**, lalu **Buat akun petugas**.
4. Petugas masuk kembali setelah penugasannya diubah.

Admin dapat membuka semua SPBU. Satu akun petugas ditugaskan ke satu SPBU; beberapa petugas dapat ditugaskan ke SPBU yang sama. Petugas tidak memerlukan akun Netlify atau GitHub. Mengganti password, penugasan, atau menonaktifkan akun mengakhiri sesi lama petugas tersebut.

## 6. Jika ingin password admin tepat 8 karakter

1. Lakukan ini **sesudah v16 Published dan aplikasi bisa dibuka**.
2. Di Netlify, buka **Project configuration → Environment variables**.
3. Pada **ADMIN_PASSWORD**, pilih **Options → Edit**.
4. Isi password baru delapan karakter pada **Value Production**, bukan pada kolom Key. Delapan angka diterima; simpan sendiri dan jangan kirim lewat chat.
5. Pastikan cakupan mencakup **Functions**, lalu **Save variable**. Pertahankan pengaturan scope yang sudah berfungsi; tidak perlu upgrade paket.
6. Buka **Deploys → Trigger deploy → Deploy project**, tunggu Published, lalu masuk dengan password baru.

GEMINI_API_KEY dan ADMIN_USERNAME tidak perlu diganti. Password petugas diganti melalui halaman Akun petugas di aplikasi, bukan variabel hosting. Tidak ada akun baru yang dibuat otomatis oleh ZIP ini.

## 7. Pemakaian sehari-hari

- Buat audit terpisah untuk setiap SPBU dan tanggal pemeriksaan.
- Foto satu per satu dari kamera. AI tetap memeriksa otomatis; Anda dapat memotret lagi atau berpindah halaman aplikasi saat antrean bekerja.
- Status mengirim/offline berarti masih ada perubahan di perangkat asal. Jangan membersihkan data browser sampai sinkron selesai.
- Foto yang sudah tersimpan di server akan ditampilkan saat dibutuhkan, sehingga tidak semuanya harus menetap di browser HP.
- Pada perangkat lain, **Perbarui daftar**, lalu buka audit. Untuk menghindari konflik, usahakan satu petugas mengubah audit yang sama pada satu waktu.
- Jika ada konflik, pilih **Simpan sebagai salinan** untuk mempertahankan perubahan HP. Gunakan **Muat versi server** setelah salinan aman tersinkron bila versi server ingin dipakai.
- **Riwayat server** menyediakan lima versi sebelumnya. Admin dapat membuka **Audit dihapus** untuk memulihkan audit yang dihapus.
- Tetap unduh **Cadangkan audit (dengan foto)** atau **Cadangkan semua audit** secara berkala. Riwayat server berada pada penyedia yang sama dan bukan pengganti cadangan terpisah.

## Paket gratis dan pemeriksaan setelah pemasangan

Tidak perlu menambah kartu atau layanan database lain untuk pembaruan ini. Netlify Blobs terhubung melalui Function di proyek yang sama. Pemakaian tetap mengikuti kredit/kuota Netlify Free; pantau **Usage & billing**. Kuota Gemini dihitung terpisah.

Setelah Published, periksa:

1. Login admin, buka satu audit, tambahkan satu foto, dan tunggu sinkron selesai.
2. Buka dari HP kedua; audit dan foto yang sama harus terlihat.
3. Login petugas; hanya SPBU yang ditugaskan harus terlihat.
4. Ubah catatan saat koneksi putus pada halaman yang sudah terbuka; sambungkan kembali dan tunggu tersimpan.
5. Cadangkan satu audit, lalu periksa berkas unduhannya tersedia.

Bila ada kegagalan, catat pesan dan tahapnya. Tangkapan layar pengaturan cukup menampilkan nama variabel serta status; sembunyikan nilai password dan API key.
