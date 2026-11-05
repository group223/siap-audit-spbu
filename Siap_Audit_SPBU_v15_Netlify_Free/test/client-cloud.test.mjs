import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { webcrypto } from "node:crypto";
import vm from "node:vm";
import { harness, audit, path, ELEMENT, JPEG, ORIGIN } from "./cloud-helpers.mjs";

const html = await readFile(new URL("../frontend/index.html", import.meta.url), "utf8");
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>(.*?)<\/script>/gs)].map(x => x[1]);
const hook = "load().then(()=>{render();pumpPhotoReviews()});";
const exposure = "globalThis.client={state:()=>S,setState:v=>{S=v},ui:()=>ui,cloud,db:DB,load,persistState,markAuditChanged,syncCloud,refreshCatalog,openCloudAudit,importLegacyAudits,downloadBackup,restoreFile,copyConflictingAudit,pullServerVersion,deleteCloudAudit,parseBackup,render};";
const flush = async () => { await new Promise(setImmediate); await new Promise(setImmediate); };

function browser(h, cookie, profile = { username: "bapal6", name: "Pengelola", role: "admin", stationNumber: "" }, storage = new Map()) {
  let timerID = 0, fetchOverride = null; const timers = new Map(), downloads = [], objects = new Map(), handlers = new Map();
  const app = { innerHTML: "", addEventListener() {} }, cloudStatus = { innerHTML: "" }, printdoc = { innerHTML: "" }, toast = { textContent: "", classList: { add() {}, remove() {} } };
  const document = { getElementById: id => id === "app" ? app : id === "cloud-status" ? cloudStatus : id === "printdoc" ? printdoc : toast, querySelectorAll: () => [],
    addEventListener(name, fn) { const a = handlers.get(name) || []; a.push(fn); handlers.set(name, a); },
    createElement: tag => tag === "a" ? { href: "", download: "", click() { downloads.push({ name: this.download, blob: objects.get(this.href) }); } } : { width: 0, height: 0, getContext: () => ({ drawImage() {} }), toDataURL: () => "data:image/jpeg;base64," + Buffer.from(JPEG).toString("base64") },
    body: { classList: { add() {}, remove() {} } }
  };
  const indexedDB = { open(name) { const request = {}; queueMicrotask(() => {
    request.result = { objectStoreNames: { contains: () => true }, close() {}, createObjectStore() {}, transaction() {
      const tx = { objectStore: () => ({
        put(value, key) { storage.set(name + ":" + key, structuredClone(value)); queueMicrotask(() => tx.oncomplete?.()); },
        get(key) { const r = {}; queueMicrotask(() => { r.result = structuredClone(storage.get(name + ":" + key)); r.onsuccess?.(); }); return r; }
      }) }; return tx;
    } }; request.onsuccess?.();
  }); return request; } };
  class FileReader {
    readAsDataURL(blob) { blob.arrayBuffer().then(value => { this.result = "data:" + blob.type + ";base64," + Buffer.from(value).toString("base64"); this.onload?.(); }, () => this.onerror?.()); }
  }
  class ObjectURL extends URL { static createObjectURL(blob) { const name = "blob:test-" + objects.size; objects.set(name, blob); return name; } static revokeObjectURL() {} }
  const context = vm.createContext({ console, document, indexedDB, navigator: { onLine: true }, location: { protocol: "https:", href: ORIGIN }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, SPBU_USER: structuredClone(profile),
    Date, Intl, structuredClone, AbortController, Request, Response, Blob, Headers, FileReader, URLSearchParams, URL: ObjectURL, crypto: webcrypto, atob, btoa, TextEncoder, TextDecoder,
    setTimeout: (fn, delay) => { const id = ++timerID; timers.set(id, { fn, delay }); return id; }, clearTimeout: id => timers.delete(id), confirm: () => true, scrollTo() {}, addEventListener() {},
    fetch: async (url, options = {}) => {
      if (!context.navigator.onLine) throw new TypeError("Failed to fetch");
      const real = async () => {
        const headers = new Headers(options.headers); headers.set("cookie", cookie); if ((options.method || "GET") === "POST") headers.set("origin", ORIGIN);
        return h.app(new Request(new URL(url, ORIGIN), { ...options, headers }), { ip: "192.0.2.50" });
      };
      return fetchOverride ? fetchOverride(url, options, real) : real();
    }
  });
  context.window = context;
  for (const script of scripts) new vm.Script(script.replace(hook, exposure)).runInContext(context);
  const api = context.client;
  return { api, storage, context, downloads, cloudStatus, toast, handlers, override: fn => { fetchOverride = fn; }, async load() { await api.load(); await flush(); }, async sync() { await api.syncCloud(); await flush(); } };
}
function photo(photoID = "p1") { return { id: photoID, name: "bukti.jpg", type: "image/jpeg", data: "data:image/jpeg;base64," + Buffer.from(JPEG).toString("base64"), uploadedAt: "2026-11-05T07:00:00Z", aiReview: { status: "done", attempts: 1 } }; }
function state(a) { a.evidence[ELEMENT] = [photo()]; return { sessions: [a] }; }
async function uploaded(h) {
  const owner = await h.login(), b = browser(h, owner.cookie); const a = audit("s-browser", "64.701.10", "A");
  b.api.setState(state(a)); b.api.markAuditChanged(b.api.state().sessions[0]); await b.sync();
  return { b, owner, id: a.id };
}

test("a real client uploads separate photos and another device reads the same audit", async () => {
  const h = harness(), { b, owner, id } = await uploaded(h);
  const first = b.api.state().sessions[0]; assert.equal(first._cloud.dirty, false); assert.equal(first._cloud.revision, 2); assert.ok(first.evidence[ELEMENT][0].cloudHash);
  assert.equal(first.evidence[ELEMENT][0].data, undefined, "confirmed server photo is released from device storage");
  const other = browser(h, owner.cookie); await other.load();
  assert.equal(other.api.state().sessions.length, 1); assert.equal(other.api.state().sessions[0]._remoteOnly, true);
  await other.api.openCloudAudit(id);
  const opened = other.api.state().sessions[0]; assert.equal(opened.items["1.1.1.a"].rating, "A"); assert.ok(opened.evidence[ELEMENT][0].remoteUrl); assert.equal(opened.evidence[ELEMENT][0].data, undefined);
});
test("offline changes survive browser reload and synchronize after reconnection", async () => {
  const h = harness(), owner = await h.login(), b = browser(h, owner.cookie); b.context.navigator.onLine = false;
  b.api.setState(state(audit())); b.api.markAuditChanged(b.api.state().sessions[0]); await b.api.persistState(); await b.sync();
  assert.equal(h.data.values.size, 0); assert.ok(b.storage.get(b.api.db + ":state").sessions[0].evidence[ELEMENT][0].data);
  const reloaded = browser(h, owner.cookie, undefined, b.storage); await reloaded.load(); await reloaded.sync();
  assert.equal(reloaded.api.state().sessions[0]._cloud.dirty, false); assert.ok(h.data.values.has("photos/6470110/s1/p1"));
});
test("a lost final save response is replayed with its durable mutation ID after reload", async () => {
  const h = harness(), owner = await h.login(), b = browser(h, owner.cookie); let dropped = false;
  b.override(async (url, options, real) => {
    const response = await real();
    if (!dropped && options.method === "POST" && options.headers["content-type"] === "application/json" && JSON.parse(options.body).complete) { dropped = true; throw new TypeError("Lost response"); }
    return response;
  });
  b.api.setState(state(audit())); b.api.markAuditChanged(b.api.state().sessions[0]); await b.sync();
  assert.ok(b.api.state().sessions[0]._cloud.pending); assert.equal(h.data.values.get("audits/6470110/s1.json").data.revision, 2);
  assert.ok(b.api.state().sessions[0].evidence[ELEMENT][0].data, "unacknowledged photo stays on the device");
  const reloaded = browser(h, owner.cookie, undefined, b.storage); await reloaded.load(); await reloaded.sync();
  assert.equal(reloaded.api.state().sessions[0]._cloud.dirty, false); assert.equal(h.data.values.get("audits/6470110/s1.json").data.revision, 2);
});
test("new photos and checklist edits during an upload remain dirty until the next save", async () => {
  const h = harness(), owner = await h.login(), b = browser(h, owner.cookie); let release, blocked = false;
  b.override(async (url, options, real) => { if (!blocked && /\/photos\//.test(url) && options.method === "POST") { blocked = true; await new Promise(resolve => { release = resolve; }); } return real(); });
  b.api.setState(state(audit("s1", "64.701.10", "A"))); const s = b.api.state().sessions[0]; b.api.markAuditChanged(s);
  const syncing = b.api.syncCloud(); await flush(); assert.ok(release);
  s.items["1.1.1.a"].rating = "F"; s.evidence[ELEMENT].push(photo("p2")); b.api.markAuditChanged(s); release(); await syncing;
  assert.equal(s._cloud.dirty, true); await b.sync(); assert.equal(s._cloud.dirty, false);
  const record = h.data.values.get("audits/6470110/s1.json").data.audit; assert.equal(record.items["1.1.1.a"].rating, "F"); assert.equal(record.evidence[ELEMENT].length, 2);
});
test("stale edits become a visible conflict and can be preserved as a new audit copy", async () => {
  const h = harness(), { b, owner, id } = await uploaded(h); const other = browser(h, owner.cookie); await other.load(); await other.api.openCloudAudit(id);
  const winner = b.api.state().sessions[0]; winner.items["1.1.1.a"].rating = "F"; b.api.markAuditChanged(winner); await b.sync();
  const stale = other.api.state().sessions[0]; stale.items["1.1.1.a"].comment = "Perubahan pada HP kedua"; other.api.markAuditChanged(stale); await other.sync();
  assert.equal(stale._cloud.conflict, true); assert.match(other.cloudStatus.innerHTML, /Simpan sebagai salinan/);
  assert.equal(h.data.values.get("audits/6470110/" + id + ".json").data.audit.items["1.1.1.a"].comment, "");
  await other.api.copyConflictingAudit(stale); await other.sync();
  const copies = [...h.data.values].filter(([key]) => key.startsWith("audits/")); assert.equal(copies.length, 2);
  assert.ok(copies.some(([, value]) => value.data.audit.items["1.1.1.a"].comment === "Perubahan pada HP kedua"));
  assert.equal(stale._cloud.conflict, true);
});
test("cache namespaces separate accounts and station reassignments on the same browser", async () => {
  const h = harness(), owner = await h.login(), s1 = await h.staff(owner.cookie, "staff1"), s2 = await h.staff(owner.cookie, "staff2", "64.702.02"), storage = new Map();
  const b1 = browser(h, s1.cookie, { username: "staff1", role: "staff", stationNumber: "6470110" }, storage);
  b1.api.setState(state(audit())); b1.api.markAuditChanged(b1.api.state().sessions[0]); await b1.api.persistState();
  const b2 = browser(h, s2.cookie, { username: "staff2", role: "staff", stationNumber: "6470202" }, storage); await b2.load();
  assert.notEqual(b1.api.db, b2.api.db); assert.equal(b2.api.state().sessions.length, 0);
  const reassigned = browser(h, s1.cookie, { username: "staff1", role: "staff", stationNumber: "6470202" }, storage);
  assert.notEqual(b1.api.db, reassigned.api.db);
});
test("backup downloads materialize authenticated server photos into the portable JSON file", async () => {
  const h = harness(), { owner, id } = await uploaded(h), other = browser(h, owner.cookie); await other.load(); await other.api.openCloudAudit(id);
  await other.api.downloadBackup([other.api.state().sessions[0]], "cadangan.json");
  assert.equal(other.downloads.length, 1); const backup = JSON.parse(await other.downloads[0].blob.text());
  assert.equal(backup.sessions[0].evidence[ELEMENT][0].data, photo().data); assert.equal(backup.sessions[0]._cloud, undefined);
});
test("backup restore creates a new audit and never overwrites a server revision", async () => {
  const h = harness(), { b } = await uploaded(h); await b.api.downloadBackup([b.api.state().sessions[0]], "cadangan.json");
  const blob = b.downloads[0].blob; await b.api.restoreFile({ size: blob.size, text: () => blob.text() }); await b.sync();
  const records = [...h.data.values.keys()].filter(key => key.startsWith("audits/")); assert.equal(records.length, 2);
  assert.equal(h.data.values.get("audits/6470110/s-browser.json").data.revision, 2);
});
test("staff cannot import another station's backup into their device workspace", async () => {
  const h = harness(), owner = await h.login(), staff = await h.staff(owner.cookie, "staff2", "64.702.02"), b = browser(h, staff.cookie, { username: "staff2", role: "staff", stationNumber: "6470202" });
  const backup = JSON.stringify({ format: "siap-audit-spbu-cadangan", sessions: state(audit()).sessions });
  await b.api.restoreFile({ size: backup.length, text: async () => backup }); assert.equal(b.api.state().sessions.length, 0); assert.match(b.toast.textContent, /SPBU lain/); assert.equal(h.data.values.size, 0);
});
test("legacy browser data is only imported explicitly by admin and the original is retained", async () => {
  const h = harness(), owner = await h.login(), storage = new Map(), original = state(audit("legacy1")); storage.set("siap-audit-spbu-v2:state", structuredClone(original));
  const b = browser(h, owner.cookie, undefined, storage); await b.load(); assert.equal(b.api.state().sessions.length, 0); assert.equal(b.api.cloud.legacy.length, 1); assert.equal(h.data.values.size, 0);
  await b.api.importLegacyAudits(); await b.sync();
  assert.equal(b.api.state().sessions.length, 1); assert.notEqual(b.api.state().sessions[0].id, "legacy1"); assert.equal(b.api.state().sessions[0]._cloud.dirty, false); assert.deepEqual(storage.get("siap-audit-spbu-v2:state"), original);
  const reloaded = browser(h, owner.cookie, undefined, storage); await reloaded.load(); assert.equal(reloaded.api.cloud.legacy.length, 0);
});
test("staff do not load shared v15 browser data into their new account workspace", async () => {
  const h = harness(), owner = await h.login(), staff = await h.staff(owner.cookie, "staff2", "64.702.02"), storage = new Map(); storage.set("siap-audit-spbu-v2:state", state(audit("old-private")));
  const b = browser(h, staff.cookie, { username: "staff2", role: "staff", stationNumber: "6470202" }, storage); await b.load(); assert.equal(b.api.state().sessions.length, 0); assert.equal(b.api.cloud.legacy.length, 0);
});
test("deleting during an upload completes safely and keeps the server recovery record", async () => {
  const h = harness(), owner = await h.login(), b = browser(h, owner.cookie); let release, blocked = false;
  b.override(async (url, options, real) => { if (!blocked && /\/photos\//.test(url) && options.method === "POST") { blocked = true; await new Promise(resolve => { release = resolve; }); } return real(); });
  b.api.setState(state(audit())); const s = b.api.state().sessions[0]; b.api.markAuditChanged(s); const pending = b.api.syncCloud(); await flush();
  b.api.deleteCloudAudit(s); release(); await pending; await b.sync(); assert.equal(b.api.state().sessions.length, 0);
  assert.equal((await h.request(path(audit()), { cookie: owner.cookie })).status, 404);
  assert.equal((await (await h.request("/api/audits?deleted=1", { cookie: owner.cookie })).json()).audits.length, 1);
  assert.ok(h.data.values.has("photos/6470110/s1/p1"));
});

test("a temporarily incomplete catalog does not discard a confirmed device audit", async () => {
  const h = harness(), { b, owner } = await uploaded(h);
  b.override(async (url, options, real) => url === "/api/audits" ? Response.json({ audits: [], nextCursor: null }) : real());
  await b.api.refreshCatalog(); assert.equal(b.api.state().sessions.length, 1);
  const response = await h.request(path(audit("s-browser")) + "/delete", { cookie: owner.cookie, method: "POST", json: { baseRevision: 2 } });
  assert.equal(response.status, 200);
  await b.api.refreshCatalog(); assert.equal(b.api.state().sessions.length, 0);
});

test("backup parsing rejects photo strings containing HTML or unsupported image payloads", () => {
  const h = harness(), b = browser(h, ""); const a = audit();
  a.evidence[ELEMENT] = [photo(), { ...photo("attack"), data: 'data:image/jpeg;base64,AAAA\" onerror=\"alert(1)' }, { ...photo("svg"), data: "data:image/svg+xml,<svg onload=alert(1)>" }];
  const result = b.api.parseBackup(JSON.stringify({ format: "siap-audit-spbu-cadangan", sessions: [a] }), []);
  assert.equal(result.sessions[0].evidence[ELEMENT].length, 1);
});
