import { createApp } from "../server/app.mjs";
import schema from "../server/audit-schema.json" with { type: "json" };

export const ORIGIN = "https://spbu-test.netlify.app";
export const ELEMENT = schema.elements[0];
export const JPEG = new Uint8Array([255, 216, 255, 224, 0, 16, 74, 70, 73, 70, 255, 217]);
export class MemoryStore {
  values = new Map(); counter = 0; fail = false;
  check() { if (this.fail) throw new Error("simulated-provider-internal-detail"); }
  async getWithMetadata(key, options = {}) {
    this.check(); const found = this.values.get(key); if (!found) return null;
    const result = structuredClone(found);
    if (options.type === "arrayBuffer") result.data = found.data.buffer.slice(found.data.byteOffset, found.data.byteOffset + found.data.byteLength);
    return result;
  }
  async getMetadata(key) { this.check(); const found = this.values.get(key); return found ? { metadata: structuredClone(found.metadata), etag: found.etag } : null; }
  async setJSON(key, data, options = {}) { return this.set(key, data, options); }
  async set(key, data, options = {}) {
    this.check(); const old = this.values.get(key);
    if (options.onlyIfNew && old || options.onlyIfMatch && options.onlyIfMatch !== old?.etag) return { modified: false };
    const etag = '"' + (++this.counter) + '"'; this.values.set(key, { data: structuredClone(data), etag, metadata: structuredClone(options.metadata || {}) });
    return { modified: true, etag };
  }
  async list({ prefix = "" } = {}) { this.check(); return { blobs: [...this.values.keys()].filter(key => key.startsWith(prefix)).map(key => ({ key, etag: this.values.get(key).etag })), directories: [] }; }
  async delete(key) { this.check(); this.values.delete(key); }
}
export function harness(password = "01234567") {
  const accounts = new MemoryStore(), data = new MemoryStore(); let now = 1793851200000;
  const env = { ADMIN_USERNAME: "bapal6", ADMIN_PASSWORD: password, GEMINI_API_KEY: "test-only-provider-key" };
  const h = { accounts, data, env, tick: () => now += 1000 };
  h.make = () => createApp({ getEnv: () => env, getStore: () => accounts, getAuditStore: () => data, clock: () => now }); h.app = h.make();
  h.request = (path, options = {}) => {
    const method = options.method || (options.json !== undefined || options.form || options.bytes ? "POST" : "GET");
    const headers = { accept: "application/json", ...(options.cookie ? { cookie: options.cookie } : {}), ...(method === "POST" ? { origin: options.origin || ORIGIN } : {}), ...options.headers };
    let body;
    if (options.json !== undefined) { headers["content-type"] = "application/json"; body = JSON.stringify(options.json); }
    if (options.form) { headers["content-type"] = "application/x-www-form-urlencoded"; body = new URLSearchParams(options.form); }
    if (options.bytes) body = options.bytes;
    return h.app(new Request(ORIGIN + path, { method, headers, body }), { ip: options.ip || "192.0.2.40" });
  };
  h.login = async (username = "bapal6", password = env.ADMIN_PASSWORD, ip) => {
    const response = await h.request("/auth/login", { form: { username, password }, ip });
    return { response, cookie: response.headers.get("set-cookie")?.split(";")[0] };
  };
  h.staff = async (admin, username, station = "64.701.10") => {
    const response = await h.request("/auth/users", { cookie: admin, form: { username, name: username, password: "87654321", stationNumber: station } });
    if (response.status !== 201) throw new Error("Staff fixture failed: " + await response.text());
    return h.login(username, "87654321", "192.0.2.41");
  };
  return h;
}
export function audit(auditID = "s1", number = "64.701.10", rating = "") {
  return { id: auditID, station: "SPBU uji", number, city: "Banjarmasin", date: "2026-11-05", items: rating ? { "1.1.1.a": { rating } } : {}, evidence: {}, aiEvidence: {} };
}
export const path = a => "/api/audits/" + a.number.replace(/\D/g, "") + "/" + a.id;
let mutation = 0;
export const save = (h, cookie, a, baseRevision = 0, mutationID = "m" + (++mutation)) => h.request(path(a), { cookie, json: { audit: a, baseRevision, mutationID } });
