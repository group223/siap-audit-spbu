import worker from "../worker/index.js";
import { authConfiguration, createAuth, AuthError, clearSessionCookie } from "./auth.mjs";
import { loginPage, usersPage, appAccountBar } from "./pages.mjs";
import { createAudits } from "./audits.mjs";

const PUBLIC_ASSETS = new Set(["/icon-192.png", "/icon-512.png", "/manifest.webmanifest"]);
const SECURITY = {
  "cache-control": "private, no-store",
  "netlify-cdn-cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "same-origin",
  "vary": "Cookie",
  "content-security-policy": "default-src 'self' data: blob:; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'self' data:; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
};
function secure(response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY)) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
const html = (body, status = 200, extra = {}) => new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", ...extra } });
const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", ...extra } });
const redirect = (location, extra = {}) => new Response(null, { status: 303, headers: { location, ...extra } });
const wantsJSON = request => (request.headers.get("accept") || "").includes("application/json");

async function limitedBody(request, limit) {
  if (Number(request.headers.get("content-length")) > limit) throw new AuthError("Berkas terlalu besar untuk dikirim. Foto tetap tersimpan; ambil foto yang lebih terarah.", 413, "PHOTO_TOO_LARGE");
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > limit) {
        await reader.cancel();
        throw new AuthError("Berkas terlalu besar untuk dikirim. Foto tetap tersimpan; ambil foto yang lebih terarah.", 413, "PHOTO_TOO_LARGE");
      }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}
async function form(request) {
  const type = (request.headers.get("content-type") || "").split(";")[0];
  if (type !== "application/x-www-form-urlencoded") throw new AuthError("Format formulir tidak sesuai.", 415);
  const body = await limitedBody(request, 8192);
  return Object.fromEntries(new URLSearchParams(new TextDecoder().decode(body)));
}

export function createApp({ getEnv = () => process.env, getStore, getAuditStore = getStore, core = worker, clock = () => Date.now() }) {
  if (typeof getStore !== "function") throw new Error("A server-side account store is required.");
  const auditService = createAudits({ getStore: getAuditStore, readBody: limitedBody, clock });
  return async function handle(request, context = {}) {
    const url = new URL(request.url);
    const path = url.pathname;
    const api = path.startsWith("/api/") || wantsJSON(request);
    const env = getEnv();
    const cfg = authConfiguration(env);
    let storage;
    const store = () => storage ||= getStore();
    const auth = cfg && createAuth({ configuration: cfg, store, clock });
    let response;
    let user = null;
    try {
      if (PUBLIC_ASSETS.has(path) && ["GET", "HEAD"].includes(request.method)) {
        return secure(await core.fetch(request, env, {}));
      }
      if (!cfg) {
        return secure(api
          ? json({ error: "Akun pengelola belum dikonfigurasi. Hubungi pengelola aplikasi.", code: "AUTH_NOT_CONFIGURED", retryable: false }, 503)
          : html(loginPage({ configured: false }), 503));
      }
      if (!["GET", "HEAD", "POST"].includes(request.method)) {
        return secure(json({ error: "Metode tidak didukung.", code: "METHOD_NOT_ALLOWED", retryable: false }, 405));
      }
      if (request.method === "POST" && request.headers.get("origin") !== url.origin) {
        return secure(json({ error: "Permintaan berasal dari situs lain.", code: "INVALID_ORIGIN", retryable: false }, 403));
      }
      if (path === "/auth/login" && request.method === "POST") {
        const input = await form(request);
        const user = await auth.login(input.username, input.password, context.ip);
        if (!user) return secure(api ? json({ error: "Nama pengguna atau kata sandi tidak sesuai.", code: "LOGIN_FAILED" }, 401) : html(loginPage({ message: "Nama pengguna atau kata sandi tidak sesuai." }), 401));
        const headers = { "set-cookie": auth.cookie(user, url.origin) };
        return secure(api ? json({ ok: true, user: { username: user.username, name: user.name, role: user.role, stationNumber: user.stationNumber } }, 200, headers) : redirect("/", headers));
      }
      user = await auth.currentUser(request);
      if (path === "/auth/login" && ["GET", "HEAD"].includes(request.method)) {
        return secure(user ? redirect("/") : html(loginPage({ message: url.searchParams.get("notice") === "logged-out" ? "Anda sudah keluar. Masuk kembali untuk melanjutkan." : "" })));
      }
      if (path === "/auth/logout") {
        if (request.method !== "POST") return secure(json({ error: "Gunakan tombol Keluar.", code: "METHOD_NOT_ALLOWED" }, 405));
        const headers = { "set-cookie": clearSessionCookie(), "clear-site-data": '"cache"' };
        return secure(api ? json({ ok: true }, 200, headers) : redirect("/auth/login?notice=logged-out", headers));
      }
      if (!user) {
        return secure(api || request.method === "POST"
          ? json({ error: "Sesi akun telah berakhir. Muat ulang aplikasi dan masuk kembali. Foto tetap tersimpan.", code: "AUTH_REQUIRED", retryable: false }, 401)
          : redirect("/auth/login"));
      }
      if (path === "/auth/session") {
        return secure(json({ user: { username: user.username, name: user.name, role: user.role, stationNumber: user.stationNumber } }));
      }
      if (path === "/akun" || path.startsWith("/auth/users")) {
        if (user.role !== "admin") return secure(json({ error: "Halaman ini hanya untuk pengelola.", code: "FORBIDDEN" }, 403));
        if (path === "/akun" && request.method === "GET") {
          return secure(html(usersPage(await auth.listUsers(), url.searchParams.get("notice") === "saved" ? "Perubahan akun berhasil disimpan." : "")));
        }
        if (path === "/auth/users" && request.method === "POST") {
          await auth.createUser(await form(request));
          return secure(api ? json({ ok: true }, 201) : redirect("/akun?notice=saved"));
        }
        if (path === "/auth/users/update" && request.method === "POST") {
          await auth.updateUser(await form(request));
          return secure(api ? json({ ok: true }) : redirect("/akun?notice=saved"));
        }
        return secure(json({ error: "Halaman tidak ditemukan.", code: "NOT_FOUND" }, 404));
      }
      if (path.startsWith("/auth/")) return secure(json({ error: "Halaman tidak ditemukan.", code: "NOT_FOUND" }, 404));
      if (path === "/api/audits" || path.startsWith("/api/audits/")) {
        const result = await auditService(request, user);
        const protectedResponse = secure(result);
        // Private, cookie-specific browser cache avoids re-downloading every photo
        // on each checklist render. The shared CDN is always forbidden to cache it.
        if (/\/photos\//.test(path) && [200, 304].includes(result.status)) protectedResponse.headers.set("cache-control", "private, max-age=3600");
        return request.method === "HEAD" ? new Response(null, { status: protectedResponse.status, headers: protectedResponse.headers }) : protectedResponse;
      }
      if (path === "/api/evidence/analyze" && user.role !== "admin" && !user.stationNumber) throw new AuthError("Akun Anda belum ditugaskan ke SPBU. Hubungi admin.", 403, "STATION_REQUIRED");
      let forwarded = request;
      if (path === "/api/evidence/analyze" && request.method === "POST") {
        const body = await limitedBody(request, 4 * 1024 * 1024);
        forwarded = new Request(request.url, { method: "POST", headers: request.headers, body });
      }
      response = await core.fetch(forwarded, { GEMINI_API_KEY: env.GEMINI_API_KEY }, {});
      if ((response.headers.get("content-type") || "").includes("text/html") && response.ok) {
        const body = (await response.text()).replace('<div id="app">', appAccountBar(user) + '<div id="app">');
        response = new Response(body, { status: response.status, headers: response.headers });
        response.headers.delete("content-length");
      }
      if (request.method === "HEAD") response = new Response(null, { status: response.status, headers: response.headers });
      return secure(response);
    } catch (error) {
      const known = error instanceof AuthError;
      const status = known ? error.status : 503;
      const auditRequest = path === "/api/audits" || path.startsWith("/api/audits/");
      const message = known ? error.message : auditRequest ? "Penyimpanan server belum tersedia. Perubahan di HP tetap disimpan dan dapat dikirim ulang." : "Layanan akun belum tersedia. Coba lagi sebentar atau hubungi pengelola. Data pemeriksaan tetap tersimpan.";
      const extra = error.retryAfter ? { "retry-after": String(error.retryAfter) } : {};
      if (!known) console.error(JSON.stringify({ event: auditRequest ? "audit_store_unavailable" : "account_store_unavailable" }));
      if (api || path.startsWith("/api/")) return secure(json({ error: message, code: known ? error.code : auditRequest ? "AUDIT_STORE" : "AUTH_STORE", retryable: auditRequest && !known }, status, extra));
      const adminPage = user?.role === "admin" && (path === "/akun" || path.startsWith("/auth/users"));
      return secure(html(adminPage ? usersPage(await auth.listUsers().catch(() => []), message) : loginPage({ message, configured: !!cfg }), status, extra));
    }
  };
}
