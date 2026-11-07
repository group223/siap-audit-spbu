import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { webcrypto } from "node:crypto";
import vm from "node:vm";
import { harness, audit, path, ELEMENT, JPEG, ORIGIN } from "./cloud-helpers.mjs";

const html = await readFile(new URL("../frontend/index.html", import.meta.url), "utf8");
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>(.*?)<\/script>/gs)].map(x => x[1]);
const hook = "load().then(async()=>{await startNavigation();render();pumpPhotoReviews()});";
const exposure = "globalThis.client={state:()=>S,setState:v=>{S=v},ui:()=>ui,cloud,db:DB,load,persistState,markAuditChanged,syncCloud,refreshCatalog,openCloudAudit,importLegacyAudits,downloadBackup,restoreFile,copyConflictingAudit,pullServerVersion,deleteCloudAudit,parseBackup,startNavigation,navigation,closeCamera,openNativeCamera,nativePhotoJPEG,nativePhotoTasks,render,itemPhotos,itemEvidenceHtml,seed,elements,openCamera,takeCameraPhoto};";
const flush = async () => { await new Promise(setImmediate); await new Promise(setImmediate); };

function browser(h, cookie, profile = { username: "bapal6", name: "Pengelola", role: "admin", stationNumber: "" }, storage = new Map()) {
  let timerID = 0, fetchOverride = null, writeCount = 0, writeGate = null, imageGate = null; const timers = new Map(), downloads = [], objects = new Map(), handlers = new Map(), windowHandlers = new Map(), canvasSizes = [], revokedURLs = [];
  const entries = [{ state: null, url: ORIGIN + "/" }]; let position = 0;
  const history = { get state() { return entries[position].state; },
    replaceState(state, _, url) { entries[position] = { state: structuredClone(state), url: String(url) }; },
    pushState(state, _, url) { entries.splice(position + 1); entries.push({ state: structuredClone(state), url: String(url) }); position++; },
    back() { moveHistory(-1); }
  };
  const nativeInput={id:'native-camera',files:[],value:'',clicks:0,click(){this.clicks++},matches:()=>false};
  const app = { innerHTML: "", addEventListener() {} }, cloudStatus = { innerHTML: "" }, printdoc = { innerHTML: "" }, video = { srcObject: null, play: async () => {} }, toast = { textContent: "", classList: { add() {}, remove() {} } };
  const document = { getElementById: id => id === "app" ? app : id === "cloud-status" ? cloudStatus : id === "printdoc" ? printdoc : id === "camera-video" ? video : id === "native-camera" ? nativeInput : toast, querySelectorAll: () => [],
    addEventListener(name, fn) { const a = handlers.get(name) || []; a.push(fn); handlers.set(name, a); },
    createElement: tag => tag === "a" ? { href: "", download: "", click() { downloads.push({ name: this.download, blob: objects.get(this.href) }); } } : { width: 0, height: 0, getContext() { return { drawImage: (...args) => canvasSizes.push({width:this.width,height:this.height,args:args.slice(1)}) }; }, toDataURL: () => "data:image/jpeg;base64," + Buffer.from(JPEG).toString("base64") },
    body: { classList: { add() {}, remove() {} } }
  };
  const indexedDB = { open(name) { const request = {}; queueMicrotask(() => {
    request.result = { objectStoreNames: { contains: () => true }, close() {}, createObjectStore() {}, transaction() {
      const tx = { objectStore: () => ({
        put(value, key) { writeCount++;storage.set(name + ":" + key, structuredClone(value)); Promise.resolve(writeGate).then(() => tx.oncomplete?.()); },
        get(key) { const r = {}; queueMicrotask(() => { r.result = structuredClone(storage.get(name + ":" + key)); r.onsuccess?.(); }); return r; }
      }) }; return tx;
    } }; request.onsuccess?.();
  }); return request; } };
  class FileReader {
    readAsDataURL(blob) { blob.arrayBuffer().then(value => { this.result = "data:" + blob.type + ";base64," + Buffer.from(value).toString("base64"); this.onload?.(); }, () => this.onerror?.()); }
  }
  class ObjectURL extends URL { static createObjectURL(blob) { const name = "blob:test-" + objects.size; objects.set(name, blob); return name; } static revokeObjectURL(url) { revokedURLs.push(url);objects.delete(url); } }
  class Image {
    set src(url) { const file=objects.get(url);this.naturalWidth=file?.width||4000;this.naturalHeight=file?.height||3000;Promise.resolve(imageGate).then(()=>file?.decodeError?this.onerror?.():this.onload?.()); }
  }
  const context = vm.createContext({ console, document, indexedDB, navigator: { onLine: true }, location: { protocol: "https:", href: ORIGIN }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, SPBU_USER: structuredClone(profile),
    Date, Intl, structuredClone, AbortController, Request, Response, Blob, Headers, FileReader, Image, URLSearchParams, URL: ObjectURL, crypto: webcrypto, atob, btoa, TextEncoder, TextDecoder, history,
    setTimeout: (fn, delay) => { const id = ++timerID; timers.set(id, { fn, delay }); return id; }, clearTimeout: id => timers.delete(id), confirm: () => true, scrollTo() {}, addEventListener(name, fn) { const a = windowHandlers.get(name) || []; a.push(fn); windowHandlers.set(name, a); },
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
  async function moveHistory(delta) { const at = position + delta; if (at < 0 || at >= entries.length) return; position = at; for (const fn of windowHandlers.get("popstate") || []) await fn({ state: entries[position].state }); await flush(); }
  async function selectNative(files) { nativeInput.files=files;const pending=(handlers.get('change')||[]).map(fn=>fn({target:nativeInput}));await Promise.all(pending);await flush(); }
  return { api, storage, context, nativeInput, selectNative, canvasSizes, revokedURLs, video, app, holdImages:promise=>{imageGate=promise}, downloads, cloudStatus, toast, handlers, entries, writes: () => writeCount, holdWrites: promise => { writeGate = promise; }, position: () => position, back: () => moveHistory(-1), forward: () => moveHistory(1), override: fn => { fetchOverride = fn; }, async load() { await api.load(); await flush(); }, async sync() { await api.syncCloud(); await flush(); } };
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

test('phone Back returns from a checklist item to its audit and then home without ending login',async()=>{
 const h=harness(),{b,owner,id}=await uploaded(h);b.api.ui().view='jadwal';b.api.ui().sid=null;await b.api.startNavigation();b.api.render();
 await b.api.openCloudAudit(id);const ui=b.api.ui();ui.view='item';ui.idx=0;b.api.render();const count=b.entries.length;
 ui.idx=1;b.api.render();ui.idx=2;b.api.render();assert.equal(b.entries.length,count,'criterion swipes replace one item entry');
 await b.back();assert.equal(ui.view,'sess');assert.equal(ui.sid,id);await b.back();assert.equal(ui.view,'jadwal');assert.equal(ui.sid,null);
 assert.equal((await h.request('/auth/session',{cookie:owner.cookie})).status,200);
 await b.forward();assert.equal(ui.view,'sess');assert.equal(ui.sid,id);
});
test('phone Back closes a form on home and Forward can reopen that form',async()=>{
 const h=harness(),owner=await h.login(),b=browser(h,owner.cookie);await b.api.startNavigation();const ui=b.api.ui();ui.sheet=true;b.api.render();
 await b.back();assert.equal(ui.sheet,false);assert.equal(ui.view,'jadwal');await b.forward();assert.equal(ui.sheet,true);
});
test('phone Back closes the active camera and stops its stream before returning to the audit',async()=>{
 const h=harness(),{b,id}=await uploaded(h);await b.api.startNavigation();await b.api.openCloudAudit(id);let stopped=0;
 b.api.ui().camera={sid:id,ei:0,stream:{getTracks:()=>[{stop:()=>stopped++}]}};b.api.render();await b.back();assert.equal(b.api.ui().camera,null);assert.equal(stopped,1);assert.equal(b.api.ui().view,'sess');
});
test('typing a comment is saved before phone Back even without a blur event',async()=>{
 const h=harness(),{b,id}=await uploaded(h);await b.api.startNavigation();await b.api.openCloudAudit(id);const ui=b.api.ui();ui.view='item';ui.idx=0;b.api.render();
 const target={value:'Catatan sebelum menekan kembali',matches:selector=>selector==='[data-comment]'};
 for(const fn of b.handlers.get('input')||[])fn({target});await b.back();await b.api.persistState();
 assert.equal(b.storage.get(b.api.db+':state').sessions[0].items['1.1.1.a'].comment,target.value);assert.equal(ui.view,'sess');
});
test('logout preparation keeps unsent changes on the device and pauses further synchronization',async()=>{
 const h=harness(),owner=await h.login(),b=browser(h,owner.cookie);b.api.setState(state(audit()));b.api.markAuditChanged(b.api.state().sessions[0]);
 assert.equal(await b.context.SPBU_BEFORE_LOGOUT(),true);assert.equal(b.api.cloud.paused,true);await b.sync();assert.equal(h.data.values.size,0);assert.ok(b.storage.get(b.api.db+':state').sessions[0].evidence[ELEMENT][0].data);
 b.context.SPBU_LOGOUT_FAILED();assert.equal(b.api.cloud.paused,false);
});

test('closing a camera normally does not make phone Back reopen that camera',async()=>{
 const h=harness(),{b,id}=await uploaded(h);await b.api.startNavigation();await b.api.openCloudAudit(id);
 b.api.ui().camera={sid:id,ei:0,stream:{getTracks:()=>[{stop(){}}]}};b.api.render();
 b.api.closeCamera();b.api.render();await flush();assert.equal(b.api.ui().camera,null);assert.equal(b.api.ui().view,'sess');
 await b.back();assert.equal(b.api.ui().view,'jadwal');assert.equal(b.api.ui().camera,null);
});

test('logout does not rewrite already-saved data, including an unchanged blur event',async()=>{
 const h=harness(),{b,id}=await uploaded(h);await b.api.openCloudAudit(id);b.api.ui().idx=0;
 const target={value:'Catatan tersimpan',matches:s=>s==='[data-comment]'};
 for(const fn of b.handlers.get('input')||[])fn({target});await b.api.persistState();const writes=b.writes();
 for(const fn of b.handlers.get('change')||[])await fn({target});
 assert.equal(await b.context.SPBU_BEFORE_LOGOUT(),true);assert.equal(b.writes(),writes,'logout must not copy all photos again');
});
test('logout reuses an in-progress local save instead of starting another full write',async()=>{
 const h=harness(),{b}=await uploaded(h);const s=b.api.state().sessions[0];s.items['1.1.1.a'].comment='Belum selesai disimpan';b.api.markAuditChanged(s);
 let release;b.holdWrites(new Promise(resolve=>release=resolve));const saving=b.api.persistState();await flush();const writes=b.writes();let completed=false;
 const leaving=b.context.SPBU_BEFORE_LOGOUT().then(result=>{completed=true;return result});await flush();assert.equal(completed,false);assert.equal(b.writes(),writes);
 release();await saving;assert.equal(await leaving,true);assert.equal(b.writes(),writes);assert.equal(b.storage.get(b.api.db+':state').sessions[0].items['1.1.1.a'].comment,'Belum selesai disimpan');
});
test('edits made after an earlier save snapshot are flushed before logout',async()=>{
 const h=harness(),{b}=await uploaded(h);const s=b.api.state().sessions[0];s.items['1.1.1.a'].comment='Versi pertama';b.api.markAuditChanged(s);
 let release;b.holdWrites(new Promise(resolve=>release=resolve));const saving=b.api.persistState();await flush();const writes=b.writes();
 s.items['1.1.1.a'].comment='Versi terbaru';b.api.markAuditChanged(s);const leaving=b.context.SPBU_BEFORE_LOGOUT();release();await saving;assert.equal(await leaving,true);
 assert.equal(b.writes(),writes+1);assert.equal(b.storage.get(b.api.db+':state').sessions[0].items['1.1.1.a'].comment,'Versi terbaru');
});
test('local storage failure never reports unsaved edits as safe for logout',async()=>{
 const h=harness(),{b}=await uploaded(h);const s=b.api.state().sessions[0];s.items['1.1.1.a'].comment='Perubahan belum aman';b.api.markAuditChanged(s);
 b.context.indexedDB.open=()=>{throw new Error('Storage unavailable')};b.context.localStorage.setItem=()=>{throw new Error('Quota exceeded')};
 assert.equal(await b.context.SPBU_BEFORE_LOGOUT(),false);assert.equal(s.items['1.1.1.a'].comment,'Perubahan belum aman');
});

test('a fallback save used for logout restores the newest edits ahead of an older IndexedDB copy',async()=>{
 const h=harness(),{b,owner}=await uploaded(h),local=new Map(),ls={getItem:key=>local.get(key)||null,setItem:(key,value)=>local.set(key,value),removeItem:key=>local.delete(key)};
 b.context.localStorage=ls;const s=b.api.state().sessions[0];s.items['1.1.1.a'].comment='Tersimpan lewat cadangan lokal';b.api.markAuditChanged(s);
 b.context.indexedDB.open=()=>{throw new Error('Write temporarily unavailable')};assert.equal(await b.context.SPBU_BEFORE_LOGOUT(),true);
 const reloaded=browser(h,owner.cookie,undefined,b.storage);reloaded.context.localStorage=ls;await reloaded.load();
 assert.equal(reloaded.api.state().sessions[0].items['1.1.1.a'].comment,'Tersimpan lewat cadangan lokal');assert.equal(reloaded.storage.get(reloaded.api.db+':state').sessions[0].items['1.1.1.a'].comment,'Tersimpan lewat cadangan lokal');assert.equal(local.has(b.api.db),false);
});

function nativeFile(extra={}){const file=new Blob([JPEG],{type:'image/jpeg'});return Object.assign(file,{name:'kamera.jpg',...extra})}
function allowAI(b,gate){let calls=0;b.override(async(url,options,real)=>{
 if(url!=='/api/evidence/analyze')return real();const input=JSON.parse(options.body);calls++;if(calls===1&&gate)await gate;
 return Response.json({model:'kamera-test',photoCheck:{status:'layak',reason:'Bukti terlihat'},results:input.criteria.map(x=>({code:x.code,status:'terdukung',reason:'Terlihat'}))});
});return()=>calls;}

test('the primary photo button opens the stable rear-camera picker within the user gesture',async()=>{
 const h=harness(),owner=await h.login(),b=browser(h,owner.cookie);const a=audit();b.api.setState({sessions:[a]});b.api.ui().sid=a.id;b.api.ui().view='sess';b.api.ui().activeReviews.push({photoId:'existing-ai'});
 const input=html.match(/<input id="native-camera"[^>]+>/)?.[0];assert.ok(input);assert.match(input,/capture="environment"/);assert.match(input,/accept="image\/\*"/);assert.ok(!/\bmultiple\b/.test(input));
 b.api.openNativeCamera(0);assert.equal(b.nativeInput.clicks,1);assert.equal(b.api.ui().camera,null);
 b.api.render(true);assert.match(html,/data-act="open-native-camera"/);assert.equal(b.nativeInput.clicks,1);
});
test('one native photo is resized, persisted, and automatically sent to AI without an analyze button',async()=>{
 const h=harness(),owner=await h.login(),b=browser(h,owner.cookie);const a=audit();b.api.setState({sessions:[a]});b.api.ui().sid=a.id;b.api.ui().view='sess';const calls=allowAI(b);
 b.api.openNativeCamera(0);await b.selectNative([nativeFile({width:6000,height:4000})]);await flush();
 assert.equal(a.evidence[ELEMENT].length,1);assert.equal(a.evidence[ELEMENT][0].type,'image/jpeg');assert.equal(a.evidence[ELEMENT][0].aiReview.status,'done');assert.equal(calls(),1);
 assert.equal(b.canvasSizes[0].width,1800);assert.equal(b.canvasSizes[0].height,1200);assert.equal(b.nativeInput.value,'');assert.equal(b.revokedURLs.length,1);assert.equal(b.api.nativePhotoTasks.size,0);
 assert.equal(b.storage.get(b.api.db+':state').sessions[0].evidence[ELEMENT].length,1);
});
test('another native photo can be captured while the previous AI request is still running',async()=>{
 const h=harness(),owner=await h.login(),b=browser(h,owner.cookie);const a=audit();b.api.setState({sessions:[a]});b.api.ui().sid=a.id;b.api.ui().view='sess';let release;
 const calls=allowAI(b,new Promise(resolve=>release=resolve));b.api.openNativeCamera(0);await b.selectNative([nativeFile()]);assert.equal(calls(),1);
 b.api.openNativeCamera(0);assert.equal(b.nativeInput.clicks,2);await b.selectNative([nativeFile()]);assert.equal(a.evidence[ELEMENT].length,2);assert.equal(a.evidence[ELEMENT][1].aiReview.status,'queued');
 release();await flush();await flush();assert.equal(calls(),2);assert.ok(a.evidence[ELEMENT].every(p=>p.aiReview.status==='done'));
});
test('cancelling the native camera keeps existing photos and allows the camera to open again',async()=>{
 const h=harness(),owner=await h.login(),b=browser(h,owner.cookie);const a=state(audit()).sessions[0];b.api.setState({sessions:[a]});b.api.ui().sid=a.id;b.api.openNativeCamera(0);
 for(const fn of b.handlers.get('cancel')||[])fn({target:b.nativeInput});assert.equal(a.evidence[ELEMENT].length,1);
 b.api.openNativeCamera(0);assert.equal(b.nativeInput.clicks,2);await b.selectNative([]);assert.equal(a.evidence[ELEMENT].length,1);assert.equal(b.api.nativePhotoTasks.size,0);
});
test('invalid, corrupt, oversized and multiple native files never create evidence or AI requests',async()=>{
 const h=harness(),owner=await h.login(),b=browser(h,owner.cookie);const a=audit();b.api.setState({sessions:[a]});b.api.ui().sid=a.id;const calls=allowAI(b);
 const invalid=[new Blob(['<svg/>'],{type:'image/svg+xml'}),new Blob(['pdf'],{type:'application/pdf'}),{size:41*1024*1024,type:'image/jpeg'},nativeFile({decodeError:true})];
 for(const file of invalid){b.api.openNativeCamera(0);await b.selectNative([file]);assert.equal(Object.values(a.evidence).flat().length,0)}
 b.api.openNativeCamera(0);await b.selectNative([nativeFile(),nativeFile()]);assert.equal(Object.values(a.evidence).flat().length,0);assert.equal(calls(),0);assert.equal(b.nativeInput.value,'');
});
test('a native photo stays attached to its original audit if the user opens another audit',async()=>{
 const h=harness(),owner=await h.login(),b=browser(h,owner.cookie);const a=audit('original'),other=audit('other');b.api.setState({sessions:[a,other]});b.api.ui().sid=a.id;b.api.ui().view='sess';allowAI(b);
 b.api.openNativeCamera(0);b.api.ui().sid=other.id;await b.selectNative([nativeFile()]);assert.equal(a.evidence[ELEMENT].length,1);assert.equal(Object.values(other.evidence).flat().length,0);assert.equal(b.api.ui().sid,other.id);assert.equal(other._cloud,undefined);
});
test('a photo whose audit was deleted during decoding is not attached to another audit',async()=>{
 const h=harness(),owner=await h.login(),b=browser(h,owner.cookie);const a=audit();b.api.setState({sessions:[a]});b.api.ui().sid=a.id;let release;b.holdImages(new Promise(resolve=>release=resolve));
 b.api.openNativeCamera(0);const receiving=b.selectNative([nativeFile()]);await flush();b.api.setState({sessions:[]});release();await receiving;assert.equal(b.api.state().sessions.length,0);assert.match(b.toast.textContent,/tidak tersedia/);assert.equal(b.revokedURLs.length,1);
});
test('logout waits for an accepted native photo to finish local processing, leaving AI queued for next login',async()=>{
 const h=harness(),owner=await h.login(),b=browser(h,owner.cookie);const a=audit();b.api.setState({sessions:[a]});b.api.ui().sid=a.id;b.api.ui().view='sess';let release;b.holdImages(new Promise(resolve=>release=resolve));
 b.api.openNativeCamera(0);const receiving=b.selectNative([nativeFile()]);await flush();let left=false;const leaving=b.context.SPBU_BEFORE_LOGOUT().then(result=>{left=true;return result});await flush();assert.equal(left,false);
 release();await receiving;assert.equal(await leaving,true);const saved=b.storage.get(b.api.db+':state').sessions[0].evidence[ELEMENT][0];assert.ok(saved.data);assert.equal(saved.aiReview.status,'queued');assert.equal(b.api.cloud.paused,true);
});

test('a detail-page photo button captures for that criterion and keeps the current page and manual rating',async()=>{
 const h=harness(),owner=await h.login(),b=browser(h,owner.cookie),a=audit();const x=b.api.seed.find(x=>x.code==='3.1.3.a'),ei=b.api.elements.indexOf(x.element);let input;
 b.api.setState({sessions:[a]});Object.assign(b.api.ui(),{sid:a.id,view:'item',idx:b.api.seed.indexOf(x)});b.api.render();
 assert.match(b.app.innerHTML,/data-act="open-native-camera"[^>]+data-source="3\.1\.3\.a"/);
 b.override(async(url,options,real)=>{if(url!=='/api/evidence/analyze')return real();input=JSON.parse(options.body);return Response.json({photoCheck:{status:'layak',reason:'Terlihat'},results:input.criteria.map(c=>({code:c.code,status:c.code===x.code?'terdukung':'tidak_terlihat',reason:'Bukti uji'}))});});
 const button={dataset:{act:'open-native-camera',el:String(ei),source:x.code}};for(const fn of b.handlers.get('click')||[])await fn({target:{closest:()=>button}});
 assert.equal(b.nativeInput.clicks,1);await b.selectNative([nativeFile()]);await flush();
 assert.equal(a.evidence[x.element][0].sourceCode,x.code);assert.equal(input.focusCode,x.code);assert.equal(b.api.ui().view,'item');assert.equal(b.api.ui().idx,b.api.seed.indexOf(x));assert.equal(Object.keys(a.items).length,0);
});
test('two different criteria can capture while AI is pending and retain both review results',async()=>{
 const h=harness(),owner=await h.login(),b=browser(h,owner.cookie),a=audit(),xs=['3.1.3.a','3.1.4.a'].map(code=>b.api.seed.find(x=>x.code===code));let release;const gate=new Promise(resolve=>release=resolve),requests=[];
 b.api.setState({sessions:[a]});Object.assign(b.api.ui(),{sid:a.id,view:'item',idx:b.api.seed.indexOf(xs[0])});
 b.override(async(url,options,real)=>{if(url!=='/api/evidence/analyze')return real();const input=JSON.parse(options.body);requests.push(input);if(requests.length===1)await gate;return Response.json({photoCheck:{status:'layak',reason:'Relevan'},results:input.criteria.map(x=>({code:x.code,status:x.code===input.focusCode?'terdukung':'tidak_terlihat',reason:'Bukti uji'}))});});
 for(const x of xs){b.api.ui().idx=b.api.seed.indexOf(x);b.api.openNativeCamera(b.api.elements.indexOf(x.element),x.code);await b.selectNative([nativeFile()]);}
 assert.equal(a.evidence[xs[0].element][1].aiReview.status,'queued');assert.equal(requests.length,1);release();await flush();await flush();
 assert.equal(requests.length,2);for(const x of xs){assert.equal(b.api.itemPhotos(a,x).length,1);assert.equal(b.api.itemPhotos(a,x)[0].photo.sourceCode,x.code);assert.equal(a.aiEvidence[x.element].results.find(r=>r.code===x.code).status,'terdukung');}
 assert.equal(b.api.ui().idx,b.api.seed.indexOf(xs[1]));
});
test('one photo can support another criterion and its source survives server sync and a second device',async()=>{
 const h=harness(),owner=await h.login(),b=browser(h,owner.cookie),a=audit(),x=b.api.seed[0],other=b.api.seed[1];
 b.api.setState({sessions:[a]});Object.assign(b.api.ui(),{sid:a.id,view:'item',idx:0});allowAI(b);b.api.openNativeCamera(0,x.code);await b.selectNative([nativeFile()]);await flush();await b.sync();
 const second=browser(h,owner.cookie);await second.load();await second.api.openCloudAudit(a.id);const opened=second.api.state().sessions.find(s=>s.id===a.id),photos=opened.evidence[x.element];
 assert.equal(photos.length,1);assert.equal(photos[0].sourceCode,x.code);assert.equal(second.api.itemPhotos(opened,other)[0].photo.id,photos[0].id);assert.equal([...h.data.values.keys()].filter(k=>k.startsWith('photos/')).length,1);
 await second.api.downloadBackup([opened],'sumber-foto.json');const restored=second.api.parseBackup(await second.downloads[0].blob.text(),[]).sessions[0];assert.equal(restored.evidence[x.element][0].sourceCode,x.code);
});
test('a delayed native photo retains its original criterion when the user opens a different criterion',async()=>{
 const h=harness(),owner=await h.login(),b=browser(h,owner.cookie),a=audit(),x=b.api.seed[0];let release;b.holdImages(new Promise(resolve=>release=resolve));
 b.api.setState({sessions:[a]});Object.assign(b.api.ui(),{sid:a.id,view:'item',idx:0});allowAI(b);b.api.openNativeCamera(0,x.code);const receiving=b.selectNative([nativeFile()]);await flush();b.api.ui().idx=1;release();await receiving;
 assert.equal(a.evidence[ELEMENT][0].sourceCode,x.code);assert.equal(b.api.ui().idx,1);assert.equal(b.api.ui().view,'item');
});
test('an invalid or cross-element criterion never opens either camera',async()=>{
 const h=harness(),owner=await h.login(),b=browser(h,owner.cookie),a=audit();b.api.setState({sessions:[a]});b.api.ui().sid=a.id;
 for(const code of ['unknown','3.1.3.a']){b.api.openNativeCamera(0,code);await b.api.openCamera(0,code);}
 assert.equal(b.nativeInput.clicks,0);assert.ok(!b.api.ui().camera);assert.equal(Object.values(a.evidence).flat().length,0);
});
test('the web-camera fallback also attaches the criterion and keeps its detail page',async()=>{
 const h=harness(),owner=await h.login(),b=browser(h,owner.cookie),a=audit();let stopped=0;
 b.api.setState({sessions:[a]});Object.assign(b.api.ui(),{sid:a.id,view:'item',idx:0});b.context.navigator.mediaDevices={getUserMedia:async()=>({getTracks:()=>[{stop(){stopped++}}]})};Object.assign(b.video,{videoWidth:640,videoHeight:480});allowAI(b);
 await b.api.openCamera(0,'1.1.1.a');assert.equal(b.api.ui().camera.sourceCode,'1.1.1.a');b.api.takeCameraPhoto();await flush();
 assert.equal(a.evidence[ELEMENT][0].sourceCode,'1.1.1.a');assert.equal(stopped,1);assert.equal(b.api.ui().camera,null);assert.equal(b.api.ui().view,'item');
});
