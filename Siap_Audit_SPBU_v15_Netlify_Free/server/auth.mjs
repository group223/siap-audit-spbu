import { createHmac, createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const COOKIE = "__Host-spbu_session";
const SESSION_SECONDS = 12 * 60 * 60;
const LOGIN_WINDOW = 10 * 60 * 1000;
const LOGIN_LIMIT = 10;
const USERNAME = /^[a-z0-9][a-z0-9._-]{2,39}$/;
const digest = value => createHash("sha256").update(String(value)).digest();
const equal = (a, b) => timingSafeEqual(digest(a), digest(b));
const normalize = value => String(value || "").trim().toLowerCase();

export class AuthError extends Error {
  constructor(message, status = 400, code = "AUTH_ERROR", retryAfter = 0) {
    super(message);
    Object.assign(this, { status, code, retryAfter });
  }
}

export function authConfiguration(env) {
  const username = normalize(env.ADMIN_USERNAME);
  const password = String(env.ADMIN_PASSWORD || "");
  if (!USERNAME.test(username) || password.length < 12 || password.length > 128) return null;
  // Changing the admin password also invalidates every existing session.
  const signingKey = createHmac("sha256", password).update("siap-audit-netlify-v15:" + username).digest();
  return { username, password, signingKey };
}

export async function passwordHash(password) {
  if (typeof password !== "string" || password.length < 12 || password.length > 128) {
    throw new AuthError("Kata sandi harus terdiri dari 12–128 karakter.");
  }
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return "scrypt$" + salt + "$" + key.toString("hex");
}

async function passwordMatches(password, encoded) {
  const parts = String(encoded || "").split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt" || !/^[0-9a-f]{32}$/.test(parts[1]) || !/^[0-9a-f]{128}$/.test(parts[2])) return false;
  const key = await scrypt(password, parts[1], 64, { N: 16384, r: 8, p: 1 });
  return timingSafeEqual(key, Buffer.from(parts[2], "hex"));
}

function publicUser(user) {
  return { username: user.username, name: user.name || user.username, role: user.role, version: user.version };
}

export function createAuth({ configuration, store, clock = () => Date.now() }) {
  const cfg = configuration;
  const admin = { username: cfg.username, name: "Pengelola", role: "admin", version: "admin-v15" };
  const sign = text => createHmac("sha256", cfg.signingKey).update(text).digest("base64url");
  const read = key => store().getWithMetadata(key, { type: "json", consistency: "strong" });

  async function userRecords() {
    const entry = await read("users.json");
    if (!entry) return { users: [], etag: null };
    if (!entry.data || !Array.isArray(entry.data.users)) throw new AuthError("Data akun belum dapat dibaca. Hubungi pengelola.", 503, "AUTH_STORE");
    return { users: entry.data.users, etag: entry.etag };
  }

  async function mutateUsers(transform) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const snapshot = await userRecords();
      const users = structuredClone(snapshot.users);
      transform(users);
      const result = await store().setJSON("users.json", { users }, snapshot.etag ? { onlyIfMatch: snapshot.etag } : { onlyIfNew: true });
      if (result.modified) return;
    }
    throw new AuthError("Akun sedang diperbarui petugas lain. Muat ulang dan coba lagi.", 409, "AUTH_CONFLICT");
  }

  async function reserveLogin(ip) {
    // A site-wide durable counter, including across cold starts. Raw IPs are not stored.
    const key = "login/" + sign("ip:" + String(ip || "unknown").slice(0, 200));
    for (let attempt = 0; attempt < 4; attempt++) {
      const now = clock();
      const previous = await read(key);
      const old = previous?.data;
      const active = old && Number.isFinite(old.started) && now >= old.started && now - old.started < LOGIN_WINDOW;
      const state = active ? { started: old.started, count: Number(old.count) || 0 } : { started: now, count: 0 };
      if (state.count >= LOGIN_LIMIT) {
        throw new AuthError("Terlalu banyak percobaan masuk. Tunggu beberapa menit lalu coba lagi.", 429, "LOGIN_RATE_LIMIT", Math.max(1, Math.ceil((state.started + LOGIN_WINDOW - now) / 1000)));
      }
      state.count++;
      const result = await store().setJSON(key, state, previous ? { onlyIfMatch: previous.etag } : { onlyIfNew: true });
      if (result.modified) return;
    }
    throw new AuthError("Layanan masuk sedang sibuk. Coba lagi sebentar.", 503, "AUTH_STORE", 5);
  }

  async function login(username, password, ip) {
    await reserveLogin(ip);
    const name = normalize(username);
    const secret = typeof password === "string" ? password : "";
    if (secret.length > 128 || !USERNAME.test(name)) return null;
    if (name === cfg.username) return equal(secret, cfg.password) ? publicUser(admin) : null;
    const { users } = await userRecords();
    const user = users.find(item => item.username === name && item.active !== false);
    // Do equivalent password work for unknown names; never disclose which account exists.
    const dummy = "scrypt$00000000000000000000000000000000$" + "0".repeat(128);
    const matched = await passwordMatches(secret, user?.passwordHash || dummy);
    return matched && user ? publicUser({ ...user, role: "staff" }) : null;
  }

  function cookie(user, origin) {
    const issued = Math.floor(clock() / 1000);
    const payload = Buffer.from(JSON.stringify({ sub: user.username, v: user.version, iat: issued, exp: issued + SESSION_SECONDS, aud: origin, nonce: randomUUID() })).toString("base64url");
    return COOKIE + "=" + payload + "." + sign(payload) + "; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=" + SESSION_SECONDS;
  }

  async function currentUser(request) {
    const token = (request.headers.get("cookie") || "").split(";").map(x => x.trim()).find(x => x.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1);
    if (!token || token.length > 4096) return null;
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra || !/^[A-Za-z0-9_-]+$/.test(payload) || !/^[A-Za-z0-9_-]{43}$/.test(signature) || !equal(signature, sign(payload))) return null;
    let claims;
    try { claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch { return null; }
    const now = Math.floor(clock() / 1000);
    if (!claims || !Number.isFinite(claims.iat) || !Number.isFinite(claims.exp) || claims.iat > now + 30 || claims.exp <= now || claims.exp <= claims.iat || claims.exp - claims.iat > SESSION_SECONDS || claims.aud !== new URL(request.url).origin) return null;
    if (claims.sub === cfg.username && claims.v === admin.version) return publicUser(admin);
    const { users } = await userRecords();
    const user = users.find(item => item.username === claims.sub && item.active !== false && item.version === claims.v);
    return user ? publicUser({ ...user, role: "staff" }) : null;
  }

  async function listUsers() {
    const { users } = await userRecords();
    return users.map(user => ({ username: user.username, name: user.name, active: user.active !== false }));
  }

  async function createUser(input) {
    const username = normalize(input.username);
    const name = String(input.name || "").trim().slice(0, 80);
    if (!USERNAME.test(username)) throw new AuthError("Nama pengguna: 3–40 karakter, gunakan huruf kecil, angka, titik, garis bawah, atau tanda hubung.");
    if (username === cfg.username) throw new AuthError("Nama pengguna sudah dipakai.");
    if (!name) throw new AuthError("Isi nama petugas.");
    const encoded = await passwordHash(input.password);
    await mutateUsers(users => {
      if (users.length >= 50) throw new AuthError("Batas 50 akun petugas telah tercapai.");
      if (users.some(user => user.username === username)) throw new AuthError("Nama pengguna sudah dipakai.");
      users.push({ username, name, role: "staff", active: true, passwordHash: encoded, version: randomUUID() });
    });
  }

  async function updateUser(input) {
    const username = normalize(input.username);
    const action = input.action;
    if (username === cfg.username) throw new AuthError("Akun pengelola diatur dari pengaturan hosting.");
    if (!["enable", "disable", "password"].includes(action)) throw new AuthError("Perubahan akun tidak dikenal.");
    const encoded = action === "password" ? await passwordHash(input.password) : null;
    await mutateUsers(users => {
      const user = users.find(item => item.username === username);
      if (!user) throw new AuthError("Akun petugas tidak ditemukan.", 404);
      if (encoded) user.passwordHash = encoded;
      else user.active = action === "enable";
      user.version = randomUUID();
    });
  }

  return { login, cookie, currentUser, listUsers, createUser, updateUser };
}

export function clearSessionCookie() {
  return COOKIE + "=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0";
}
