export const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

const css = [
  ":root{font-family:Segoe UI,system-ui,sans-serif;color:#14222f;background:#f1f5fa;color-scheme:light}*{box-sizing:border-box}body{margin:0}a{color:#075ab6}main{max-width:760px;margin:32px auto;padding:0 18px 36px}.login{max-width:440px;margin:8vh auto}.brand{display:flex;gap:12px;align-items:center;margin-bottom:24px}.brand img{width:48px;height:48px}.brand strong{font-size:19px}.brand small{display:block;color:#667789;margin-top:3px}",
  ".card{padding:24px;background:#fff;border:1px solid #e1e8f0;border-radius:16px;margin-bottom:18px}h1{font-size:23px;margin:0 0 8px}h2{font-size:18px;margin:0 0 15px}p{line-height:1.55}.muted,small{color:#667789}label{display:block;font-size:14px;font-weight:600;margin:16px 0 7px}input{width:100%;border:1px solid #ccd7e3;border-radius:10px;padding:12px;font:inherit}button,.button{cursor:pointer;border:0;border-radius:10px;background:#0a63c9;color:#fff;font:inherit;font-weight:600;padding:12px 16px;display:inline-block;text-decoration:none}button:focus-visible,input:focus-visible,a:focus-visible{outline:3px solid #91bbef;outline-offset:3px}.wide{width:100%;margin-top:22px}.notice{padding:12px 15px;border-radius:10px;background:#fff3dc;color:#805515;line-height:1.5}.success{background:#e7f6ee;color:#216440}.toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:24px}.row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.secondary{background:#e6eef8;color:#14538e}.danger{background:#9c3530}.user{border-top:1px solid #e1e8f0;padding:17px 0}.user strong{display:block}.user form{margin-top:10px}.user .row input{flex:1;min-width:160px}.user button{font-size:13px;padding:10px}.badge{display:inline-block;border-radius:20px;padding:3px 9px;background:#e7f6ee;color:#216440;font-size:12px}.inactive{background:#f9e5e5;color:#973d38}form{margin:0}@media(max-width:480px){main{margin-top:20px}.login{margin-top:5vh}.card{padding:20px}h1{font-size:21px}.user .row button{width:100%}}",
].join("");

function sessionScript(mode) {
  return '<script>/* session-navigation:start */\n(' + accountSession.toString() + ')(' + JSON.stringify(mode) + ');\n/* session-navigation:end */</script>';
}

function accountSession(mode) {
  let busy = false, checking = false;
  function message(form, text) {
    let box = form.querySelector('[data-session-message]');
    if (!box) { box = document.createElement('p'); box.dataset.sessionMessage = ''; box.setAttribute('role', 'status'); box.className = 'notice'; form.append(box); }
    box.textContent = text;
  }
  async function verifySession() {
    if (checking || busy) return;
    checking = true;
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch('/auth/session', { credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json' }, signal: controller.signal });
      if (mode === 'login' && response.ok) window.location.replace('/');
      else if (mode === 'app' && response.status === 401) window.location.replace('/auth/login');
    } catch { /* An offline history restore does not end the account session. */ }
    finally { clearTimeout(timer); checking = false; }
  }
  window.addEventListener('pageshow', event => { if (mode === 'login' || event.persisted) verifySession(); });
  document.addEventListener('submit', async event => {
    const form = event.target.closest('form');
    if (!form) return;
    const action = new URL(form.action, window.location.href).pathname;
    if (action !== '/auth/logout' && !(mode === 'login' && action === '/auth/login')) return;
    event.preventDefault();
    if (busy) return;
    busy = true;
    const logout = action === '/auth/logout', button = form.querySelector('button[type="submit"],button:not([type])');
    const label = button?.textContent;
    if (button) { button.disabled = true; button.textContent = logout ? 'Keluar…' : 'Memeriksa…'; }
    form.setAttribute('aria-busy', 'true');
    message(form, logout ? 'Mengakhiri sesi…' : 'Memeriksa akun…');
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000);
    try {
      if (logout && window.SPBU_BEFORE_LOGOUT && await window.SPBU_BEFORE_LOGOUT() === false) throw new Error('Perubahan di HP belum dapat disimpan. Cadangkan audit sebelum keluar.');
      const body = logout ? '' : new URLSearchParams(new FormData(form)).toString();
      const response = await fetch(action, { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' }, body, signal: controller.signal });
      let payload = {}; try { payload = await response.json(); } catch {}
      if (!response.ok || payload.ok !== true) throw new Error(payload.error || 'Permintaan belum berhasil. Coba lagi.');
      if (!logout) form.reset();
      window.location.replace(logout ? '/auth/login?notice=logged-out' : '/');
    } catch (error) {
      if (logout) window.SPBU_LOGOUT_FAILED?.();
      message(form, error.name === 'AbortError' ? 'Koneksi terlalu lama. Coba lagi saat internet tersedia.' : error.name === 'TypeError' ? 'Belum terhubung. Coba lagi saat internet tersedia.' : error.message || 'Permintaan belum berhasil. Coba lagi.');
      busy = false;
      if (button) { button.disabled = false; button.textContent = label; }
      form.removeAttribute('aria-busy');
    } finally { clearTimeout(timer); }
  });
}

function shell(title, body, login = false) {
  return '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0a63c9"><title>' + escape(title) + ' · Siap Audit SPBU</title><link rel="icon" href="/icon-192.png"><style>' + css + '</style></head><body><main' + (login ? ' class="login"' : "") + '>' + body + '</main>' + sessionScript(login ? 'login' : 'app') + '</body></html>';
}

export function loginPage({ message = "", configured = true } = {}) {
  const body = [
    '<div class="brand"><img src="/icon-192.png" alt=""><div><strong>Siap Audit SPBU</strong><small>Persiapan pemeriksaan internal</small></div></div>',
    '<section class="card"><h1>Masuk ke aplikasi</h1><p class="muted">Gunakan akun pengelola atau petugas Anda.</p>',
    message ? '<p class="notice" role="alert">' + escape(message) + "</p>" : "",
    configured ? '<form method="post" action="/auth/login"><label for="username">Nama pengguna</label><input id="username" name="username" autocomplete="username" required maxlength="40" autocapitalize="none" spellcheck="false"><label for="password">Kata sandi</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="128"><button class="wide" type="submit">Masuk</button></form>' : '<p class="notice">Pengelola perlu melengkapi pengaturan akun pada hosting sebelum aplikasi dapat digunakan.</p>',
    '</section><p class="muted">Belum punya akun? Hubungi pengelola SPBU Anda.</p>',
  ].join("");
  return shell("Masuk", body, true);
}

export function usersPage(users, message = "") {
  const userList = users.length ? users.map(user => [
    '<article class="user"><div class="row"><div><strong>' + escape(user.name) + '</strong><small>' + escape(user.username) + " · SPBU " + escape(user.stationNumber || "belum ditugaskan") + '</small></div><span class="badge ' + (user.active ? "" : "inactive") + '">' + (user.active ? "Aktif" : "Nonaktif") + "</span></div>",
    '<form method="post" action="/auth/users/update"><input type="hidden" name="username" value="' + escape(user.username) + '"><input type="hidden" name="action" value="' + (user.active ? "disable" : "enable") + '"><button class="' + (user.active ? "danger" : "secondary") + '" type="submit">' + (user.active ? "Nonaktifkan akun" : "Aktifkan akun") + "</button></form>",
    '<form method="post" action="/auth/users/update"><input type="hidden" name="username" value="' + escape(user.username) + '"><input type="hidden" name="action" value="station"><label>No. SPBU yang boleh diakses<div class="row"><input name="stationNumber" required maxlength="24" inputmode="numeric" value="' + escape(user.stationNumber || "") + '" placeholder="64.701.10"><button class="secondary" type="submit">Simpan SPBU</button></div></label></form>',
    '<form method="post" action="/auth/users/update"><input type="hidden" name="username" value="' + escape(user.username) + '"><input type="hidden" name="action" value="password"><label>Kata sandi baru<div class="row"><input name="password" type="password" autocomplete="new-password" required minlength="8" maxlength="128" placeholder="Minimal 8 karakter"><button class="secondary" type="submit">Ganti kata sandi</button></div></label></form></article>',
  ].join("")).join("") : '<p class="muted">Belum ada akun petugas. Tambahkan akun pertama di bawah.</p>';
  return shell("Akun petugas", [
    '<div class="toolbar"><a href="/">← Kembali ke pemeriksaan</a><form method="post" action="/auth/logout"><button class="secondary">Keluar</button></form></div>',
    "<h1>Akun petugas</h1><p class=\"muted\">Buat akun untuk setiap petugas. Menonaktifkan akun atau mengganti kata sandinya mengakhiri akses sesi lama petugas tersebut.</p>",
    message ? '<p class="notice success" role="status">' + escape(message) + "</p>" : "",
    '<section class="card"><h2>Petugas terdaftar</h2>' + userList + "</section>",
    '<section class="card"><h2>Tambah petugas</h2><form method="post" action="/auth/users"><label for="name">Nama petugas</label><input id="name" name="name" autocomplete="name" required maxlength="80"><label for="new-user">Nama pengguna</label><input id="new-user" name="username" required minlength="3" maxlength="40" pattern="[a-z0-9][a-z0-9._-]{2,39}" autocapitalize="none" spellcheck="false" autocomplete="off"><small>3–40 karakter: huruf kecil, angka, titik, garis bawah, atau tanda hubung.</small><label for="stationNumber">No. SPBU yang boleh diakses</label><input id="stationNumber" name="stationNumber" required maxlength="24" inputmode="numeric" placeholder="64.701.10"><small>Petugas hanya dapat membaca dan mengubah audit SPBU ini.</small><label for="new-pass">Kata sandi awal (minimal 8 karakter)</label><input id="new-pass" name="password" type="password" minlength="8" maxlength="128" required autocomplete="new-password"><button class="wide" type="submit">Buat akun petugas</button></form></section>',
    '<p class="muted">Akun pengelola diatur melalui pengaturan hosting. Audit dan foto tersimpan di server setelah status sinkron selesai. Data yang belum terkirim tetap berada di perangkat petugas. Perubahan penugasan SPBU mengakhiri sesi lama.</p>',
  ].join(""));
}

export function logoutPage() {
  return shell("Keluar", '<section class="card"><h1>Anda sudah keluar</h1><p>Audit yang sudah tersinkron tetap tersimpan di server. Perubahan yang belum terkirim tetap di perangkat akun ini. Masuk kembali untuk melanjutkan.</p><a class="button" href="/auth/login">Masuk kembali</a></section>', true);
}

export function appAccountBar(user) {
  const profile = JSON.stringify({ username: user.username, name: user.name, role: user.role, stationNumber: user.stationNumber || "" }).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
  return '<script>window.SPBU_USER=' + profile + ';</script><style>.audit-accountbar,.cloud-status{max-width:520px;margin:auto;padding:8px 16px;background:var(--card);border-bottom:1px solid var(--line);font-size:12px}.audit-accountbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.audit-accountbar span{flex:1;min-width:90px}.audit-accountbar a,.audit-accountbar button{font:inherit;color:var(--blue);text-decoration:none}.audit-accountbar form{margin:0}.audit-accountbar button[type="submit"]{min-width:64px;min-height:44px;padding:10px 12px;border-radius:8px;background:var(--sky);touch-action:manipulation}.audit-accountbar button:disabled{opacity:.65}.audit-accountbar .notice{max-width:240px;margin:6px 0;font-size:12px}.cloud-status p{margin:4px 0}.cloud-status button,.cloud-status a{margin:4px 7px 0 0;font:inherit;color:var(--blue)}.cloud-status .cloud-warn{color:var(--warn)}@media print{.audit-accountbar,.cloud-status{display:none!important}}</style><div class="audit-accountbar"><span>' + escape(user.name) + (user.role === "admin" ? ' · Admin' : ' · SPBU ' + escape(user.stationNumber || 'belum ditugaskan')) + "</span>" + (user.role === "admin" ? '<a href="/akun">Akun petugas</a>' : "") + '<form action="/auth/logout" method="post"><button type="submit">Keluar</button></form></div><div id="cloud-status" class="cloud-status" role="status">Menghubungkan penyimpanan server…</div>' + sessionScript("app");
}
