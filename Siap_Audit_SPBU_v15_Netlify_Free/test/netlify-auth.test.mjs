import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { createApp } from "../server/app.mjs";

const ORIGIN = "https://spbu-test.netlify.app";
const ENV = { ADMIN_USERNAME: "pengelola", ADMIN_PASSWORD: "test-only-long-owner-password", GEMINI_API_KEY: "test-provider-key" };
const CONTEXT = { ip: "192.0.2.10" };

class MemoryStore {
  values = new Map();
  counter = 0;
  async getWithMetadata(key) {
    const value = this.values.get(key);
    return value ? structuredClone(value) : null;
  }
  async setJSON(key, data, options = {}) {
    const previous = this.values.get(key);
    if (options.onlyIfNew && previous) return { modified: false };
    if (options.onlyIfMatch && options.onlyIfMatch !== previous?.etag) return { modified: false };
    const etag = '"' + (++this.counter) + '"';
    this.values.set(key, { data: structuredClone(data), etag, metadata: {} });
    return { modified: true, etag };
  }
}
function harness() {
  const store = new MemoryStore();
  const env = { ...ENV };
  let now = 1793851200000;
  const make = () => createApp({ getEnv: () => env, getStore: () => store, clock: () => now });
  return { store, env, make, app: make(), advance: ms => { now += ms; } };
}
function request(path, { cookie, method = "GET", data, jsonBody, origin = ORIGIN, accept = "application/json" } = {}) {
  const headers = { accept };
  if (cookie) headers.cookie = cookie;
  if (method === "POST") headers.origin = origin;
  let body;
  if (data) { body = new URLSearchParams(data); headers["content-type"] = "application/x-www-form-urlencoded"; }
  if (jsonBody !== undefined) { body = typeof jsonBody === "string" ? jsonBody : JSON.stringify(jsonBody); headers["content-type"] = "application/json"; }
  return new Request(ORIGIN + path, { method, headers, body });
}
async function login(h, username = ENV.ADMIN_USERNAME, password = ENV.ADMIN_PASSWORD, ip = CONTEXT.ip) {
  const response = await h.app(request("/auth/login", { method: "POST", data: { username, password } }), { ip });
  return { response, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
async function addUser(h, cookie, username = "petugas1", password = "test-only-staff-password", name = "Petugas satu") {
  return h.app(request("/auth/users", { cookie, method: "POST", data: { username, password, name, stationNumber: "64.701.10", role: "admin" } }), CONTEXT);
}

test("missing or weak admin credentials fail closed and never call AI", async () => {
  const h = harness();
  for (const password of ["", "short"]) {
    h.env.ADMIN_PASSWORD = password;
    const response = await h.app(request("/api/evidence/analyze", { method: "POST", jsonBody: {} }), CONTEXT);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, "AUTH_NOT_CONFIGURED");
  }
  assert.equal((await h.app(request("/", { accept: "text/html" }))).status, 503);
});

test("anonymous app access redirects to login; API, service worker and core files are protected", async () => {
  const h = harness();
  for (const path of ["/", "/index.html", "/sw.js", "/worker/index.js", "/netlify/functions/app.mjs"]) {
    const response = await h.app(request(path, { accept: "text/html" }), CONTEXT);
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "/auth/login");
  }
  const api = await h.app(request("/api/evidence/analyze", { method: "POST", jsonBody: {} }), CONTEXT);
  assert.equal(api.status, 401);
  assert.equal((await api.json()).code, "AUTH_REQUIRED");
  assert.equal((await h.app(request("/icon-192.png"))).status, 200);
  assert.equal((await h.app(request("/manifest.webmanifest"))).status, 200);
});

test("login creates a secure HttpOnly session; app output never includes secrets", async () => {
  const h = harness();
  const { response, cookie } = await login(h);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie"), /HttpOnly; Secure; SameSite=Strict/);
  const page = await h.app(request("/", { cookie, accept: "text/html" }), CONTEXT);
  assert.equal(page.status, 200);
  const body = await page.text();
  assert.match(body, /Akun petugas/);
  assert.match(body, /Cadangkan semua audit/);
  assert.ok(!body.includes(ENV.ADMIN_PASSWORD));
  assert.ok(!body.includes(ENV.GEMINI_API_KEY));
  assert.match(page.headers.get("cache-control"), /no-store/);
  assert.match(page.headers.get("netlify-cdn-cache-control"), /no-store/);
});

test("HTML login has no open redirect and never echoes a submitted password", async () => {
  const h = harness();
  const success = await h.app(request("/auth/login?next=https://outside.example", { method: "POST", data: { username: ENV.ADMIN_USERNAME, password: ENV.ADMIN_PASSWORD }, accept: "text/html" }), CONTEXT);
  assert.equal(success.status, 303);
  assert.equal(success.headers.get("location"), "/");
  const failed = await h.app(request("/auth/login", { method: "POST", data: { username: "missing", password: "private-incorrect-password" }, accept: "text/html" }), CONTEXT);
  assert.equal(failed.status, 401);
  assert.ok(!(await failed.text()).includes("private-incorrect-password"));
});

test("forged, expired, cross-domain and password-rotated cookies are rejected", async () => {
  const h = harness();
  const { cookie } = await login(h);
  const changed = cookie.slice(0, -1) + (cookie.endsWith("A") ? "B" : "A");
  assert.equal((await h.app(request("/auth/session", { cookie: changed }))).status, 401);
  const otherDomain = new Request("https://other.netlify.app/auth/session", { headers: { cookie, accept: "application/json" } });
  assert.equal((await h.app(otherDomain)).status, 401);
  h.advance(12 * 60 * 60 * 1000 + 1);
  assert.equal((await h.app(request("/auth/session", { cookie }))).status, 401);
  const fresh = await login(h);
  h.env.ADMIN_PASSWORD = "changed-owner-password-for-tests";
  assert.equal((await h.app(request("/auth/session", { cookie: fresh.cookie }))).status, 401);
});

test("login throttling persists across function instances and recovers after the window", async () => {
  const h = harness();
  for (let i = 0; i < 10; i++) assert.equal((await login(h, "pengelola", "wrong-password")).response.status, 401);
  h.app = h.make();
  const blocked = await login(h);
  assert.equal(blocked.response.status, 429);
  assert.equal((await blocked.response.json()).code, "LOGIN_RATE_LIMIT");
  assert.ok(Number(blocked.response.headers.get("retry-after")) > 0);
  assert.equal((await login(h, "pengelola", ENV.ADMIN_PASSWORD, "192.0.2.11")).response.status, 200);
  h.advance(10 * 60 * 1000 + 1);
  assert.equal((await login(h)).response.status, 200);
});

test("cross-origin mutations and oversized credential forms are rejected", async () => {
  const h = harness();
  const blocked = await h.app(request("/auth/login", { method: "POST", origin: "https://outside.example", data: { username: ENV.ADMIN_USERNAME, password: ENV.ADMIN_PASSWORD } }), CONTEXT);
  assert.equal(blocked.status, 403);
  const big = await h.app(request("/auth/login", { method: "POST", data: { username: "a".repeat(9000), password: "x" } }), CONTEXT);
  assert.equal(big.status, 413);
  assert.equal(h.store.values.size, 0);
});

test("staff accounts persist as salted hashes, cannot create admins, and cannot manage users", async () => {
  const h = harness();
  const owner = await login(h);
  assert.equal((await addUser(h, owner.cookie)).status, 201);
  const records = h.store.values.get("users.json").data.users;
  assert.equal(records[0].role, "staff");
  assert.match(records[0].passwordHash, /^scrypt\$/);
  assert.ok(!JSON.stringify(records).includes("test-only-staff-password"));
  const staff = await login(h, "petugas1", "test-only-staff-password");
  assert.equal(staff.response.status, 200);
  h.app = h.make();
  const session = await h.app(request("/auth/session", { cookie: staff.cookie }), CONTEXT);
  assert.equal((await session.json()).user.role, "staff");
  assert.equal((await h.app(request("/akun", { cookie: staff.cookie }))).status, 403);
  assert.equal((await addUser(h, staff.cookie, "injected")).status, 403);
  const page = await h.app(request("/", { cookie: staff.cookie, accept: "text/html" }));
  const body = await page.text();
  assert.ok(!body.includes('href="/akun"'));
  assert.ok(!body.includes(records[0].passwordHash));
});

test("staff disable, re-enable and password reset revoke old sessions", async () => {
  const h = harness();
  const owner = await login(h);
  await addUser(h, owner.cookie);
  const staff = await login(h, "petugas1", "test-only-staff-password");
  const update = data => h.app(request("/auth/users/update", { cookie: owner.cookie, method: "POST", data }), CONTEXT);
  assert.equal((await update({ username: "petugas1", action: "disable" })).status, 200);
  assert.equal((await h.app(request("/auth/session", { cookie: staff.cookie }))).status, 401);
  assert.equal((await login(h, "petugas1", "test-only-staff-password")).response.status, 401);
  await update({ username: "petugas1", action: "enable" });
  assert.equal((await h.app(request("/auth/session", { cookie: staff.cookie }))).status, 401);
  const enabled = await login(h, "petugas1", "test-only-staff-password");
  await update({ username: "petugas1", action: "password", password: "new-staff-password-for-test" });
  assert.equal((await h.app(request("/auth/session", { cookie: enabled.cookie }))).status, 401);
  assert.equal((await login(h, "petugas1", "test-only-staff-password")).response.status, 401);
  assert.equal((await login(h, "petugas1", "new-staff-password-for-test")).response.status, 200);
});

test("concurrent account additions do not overwrite each other", async () => {
  const h = harness();
  const owner = await login(h);
  const responses = await Promise.all([addUser(h, owner.cookie, "petugas1"), addUser(h, owner.cookie, "petugas2")]);
  assert.deepEqual(responses.map(r => r.status), [201, 201]);
  assert.equal(h.store.values.get("users.json").data.users.length, 2);
});

test("admin pages escape user names and never show password hashes", async () => {
  const h = harness();
  const owner = await login(h);
  await addUser(h, owner.cookie, "petugas1", "test-only-staff-password", '<img src=x onerror="alert(1)">');
  const response = await h.app(request("/akun", { cookie: owner.cookie, accept: "text/html" }), CONTEXT);
  const body = await response.text();
  assert.match(body, /&lt;img/);
  assert.ok(!body.includes('<img src=x'));
  assert.ok(!body.includes("scrypt$"));
  const maliciousName = '</script><script>alert("profile")</script>&';
  await addUser(h, owner.cookie, "petugas2", "test-only-staff-password", maliciousName);
  const staff = await login(h, "petugas2", "test-only-staff-password");
  const staffBody = await (await h.app(request("/", { cookie: staff.cookie, accept: "text/html" }), CONTEXT)).text();
  const bootstrap = staffBody.match(/<script>(window\.SPBU_USER=.*?;)<\/script>/s)?.[1];
  assert.ok(bootstrap); assert.ok(!bootstrap.includes("</script>"));
  const context = { window: {} }; new vm.Script(bootstrap).runInNewContext(context);
  assert.equal(context.window.SPBU_USER.name, maliciousName);
});

test("authenticated photo reaches Gemini and all 56 criteria return through the Netlify adapter", async () => {
  const h = harness();
  const owner = await login(h);
  const html = await readFile(new URL("../frontend/index.html", import.meta.url), "utf8");
  const seed = JSON.parse(html.match(/window\.CHECKLIST_DATA = (\[.*?\]);/s)[1]);
  const items = seed.filter(x => x.element.startsWith("Elemen 3:"));
  const criteria = items.map(({ code, text, subElement }) => ({ code, text, subElement }));
  const previousFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    calls++;
    assert.equal(options.headers["x-goog-api-key"], ENV.GEMINI_API_KEY);
    return new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify({ photoCheck: { status: "layak", reason: "Bukti relevan terlihat." }, summary: "Selesai.", results: criteria.map(x => ({ code: x.code, status: "terdukung", reason: "Terlihat." })) }) }] } }] }));
  };
  try {
    const data = { element: items[0].element, criteria, photos: [{ data: "data:image/jpeg;base64,YQ==" }] };
    const anonymous = await h.app(request("/api/evidence/analyze", { method: "POST", jsonBody: data }), CONTEXT);
    assert.equal(anonymous.status, 401);
    assert.equal(calls, 0);
    const result = await h.app(request("/api/evidence/analyze", { cookie: owner.cookie, method: "POST", jsonBody: data }), CONTEXT);
    assert.equal(result.status, 200);
    assert.equal((await result.json()).results.length, 56);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = previousFetch; }
});

test("oversized image payload is rejected before provider calls", async () => {
  const h = harness();
  const owner = await login(h);
  const response = await h.app(request("/api/evidence/analyze", { cookie: owner.cookie, method: "POST", jsonBody: "x".repeat(4 * 1024 * 1024 + 1) }), CONTEXT);
  assert.equal(response.status, 413);
  assert.equal((await response.json()).code, "PHOTO_TOO_LARGE");
});

test("logout clears only cache and session, retaining audit browser storage", async () => {
  const h = harness();
  const owner = await login(h);
  assert.equal((await h.app(request("/auth/logout", { cookie: owner.cookie }))).status, 405);
  const response = await h.app(request("/auth/logout", { cookie: owner.cookie, method: "POST" }), CONTEXT);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie"), /Max-Age=0/);
  assert.equal(response.headers.get("clear-site-data"), '"cache"');
  assert.ok(!(await response.text()).includes("indexedDB.deleteDatabase"));
});

test("service worker never caches or replays authenticated HTML or account/API requests", async () => {
  const handlers = new Map();
  const source = await readFile(new URL("../frontend/sw.js", import.meta.url), "utf8");
  new vm.Script(source).runInNewContext({ self: { location: { origin: ORIGIN }, addEventListener: (name, fn) => handlers.set(name, fn) }, Set, URL });
  for (const path of ["/", "/index.html", "/akun", "/auth/login", "/api/evidence/analyze", "/sw.js"]) {
    let intercepted = false;
    handlers.get("fetch")({ request: { url: ORIGIN + path, method: "GET" }, respondWith() { intercepted = true; } });
    assert.equal(intercepted, false, path);
  }
});

test("account storage outages fail closed without leaking internal errors", async () => {
  const app = createApp({ getEnv: () => ENV, getStore() { throw new Error("internal-sensitive-key"); } });
  const result = await app(request("/auth/login", { method: "POST", data: { username: ENV.ADMIN_USERNAME, password: ENV.ADMIN_PASSWORD } }), CONTEXT);
  assert.equal(result.status, 503);
  const body = await result.text();
  assert.ok(!body.includes("internal-sensitive-key"));
  assert.match(body, /AUTH_STORE/);
});
