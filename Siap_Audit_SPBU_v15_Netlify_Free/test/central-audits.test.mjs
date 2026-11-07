import test from "node:test";
import assert from "node:assert/strict";
import { harness, audit, path, save, ELEMENT, JPEG } from "./cloud-helpers.mjs";

test("photo sources are retained and must refer to a real criterion in their own element", async () => {
  const h=harness(),owner=await h.login(),a=audit();await save(h,owner.cookie,a);
  const uploaded=await h.request(path(a)+"/photos/criterion-photo",{cookie:owner.cookie,bytes:JPEG,headers:{"content-type":"image/jpeg"}});
  assert.equal(uploaded.status,200);const ref=await uploaded.json();
  a.evidence[ELEMENT]=[{id:"criterion-photo",type:"image/jpeg",cloudHash:ref.cloudHash,sourceCode:"1.1.1.a"}];
  assert.equal((await save(h,owner.cookie,a,1)).status,200);
  const saved=await (await h.request(path(a),{cookie:owner.cookie})).json();assert.equal(saved.audit.evidence[ELEMENT][0].sourceCode,"1.1.1.a");
  for(const sourceCode of ["unknown","3.1.3.a","__proto__"]){a.evidence[ELEMENT][0].sourceCode=sourceCode;const bad=await save(h,owner.cookie,a,2);assert.equal(bad.status,400);assert.equal((await bad.json()).code,"INVALID_PHOTO_SOURCE");}
  a.evidence[ELEMENT][0].sourceCode="";assert.equal((await save(h,owner.cookie,a,2)).status,200);
  const legacy=await (await h.request(path(a),{cookie:owner.cookie})).json();assert.equal(legacy.audit.evidence[ELEMENT][0].sourceCode,undefined);
});

test("eight numeric characters including a leading zero work for admin; seven fail closed", async () => {
  const h = harness(); assert.equal((await h.login("BAPAL6", "01234567")).response.status, 200);
  h.env.ADMIN_PASSWORD = "1234567";
  assert.equal((await h.request("/auth/login", { form: { username: "bapal6", password: "1234567" } })).status, 503);
});
test("staff creation and reset accept eight characters and reject seven", async () => {
  const h = harness(), owner = await h.login();
  const staff = await h.staff(owner.cookie, "staff1"); assert.equal(staff.response.status, 200);
  assert.equal((await h.request("/auth/users/update", { cookie: owner.cookie, form: { username: "staff1", action: "password", password: "1234567" } })).status, 400);
  assert.equal((await h.request("/auth/users/update", { cookie: owner.cookie, form: { username: "staff1", action: "password", password: "00001111" } })).status, 200);
  assert.equal((await h.login("staff1", "00001111")).response.status, 200);
  assert.equal((await h.request("/auth/session", { cookie: staff.cookie })).status, 401);
});
test("staff require a station assignment, including existing unassigned v15 accounts", async () => {
  const h = harness(), owner = await h.login();
  assert.equal((await h.request("/auth/users", { cookie: owner.cookie, form: { username: "unassigned", name: "Staf", password: "12345678" } })).status, 400);
  const staff = await h.staff(owner.cookie, "staff1");
  const users = h.accounts.values.get("users.json").data.users; delete users[0].stationNumber;
  assert.equal((await h.request("/api/audits", { cookie: staff.cookie })).status, 403);
  assert.equal((await h.request("/api/evidence/analyze", { cookie: staff.cookie, json: {} })).status, 403);
});
test("anonymous requests cannot read or write audit metadata, photos, history or deleted records", async () => {
  const h = harness();
  for (const address of ["/api/audits", "/api/audits?deleted=1", "/api/audits/6470110/s1", "/api/audits/6470110/s1/photos/p1", "/api/audits/6470110/s1/history"]) assert.equal((await h.request(address)).status, 401);
  assert.equal((await save(h, undefined, audit())).status, 401);
  assert.equal(h.data.values.size, 0);
});
test("audits persist across cold starts and can be read on a second authenticated device", async () => {
  const h = harness(), owner = await h.login(), a = audit();
  assert.equal((await save(h, owner.cookie, a)).status, 200);
  h.app = h.make(); const second = await h.login();
  const result = await h.request(path(a), { cookie: second.cookie });
  assert.equal(result.status, 200); assert.equal((await result.json()).audit.number, "64.701.10");
  assert.match(result.headers.get("cache-control"), /no-store/);
});
test("station-scoped accounts only list their station; admin lists every station", async () => {
  const h = harness(), owner = await h.login(), s1 = await h.staff(owner.cookie, "staff1"), s2 = await h.staff(owner.cookie, "staff2", "64.702.02");
  assert.equal((await save(h, s1.cookie, audit("a1"))).status, 200);
  assert.equal((await save(h, s2.cookie, audit("a2", "64.702.02"))).status, 200);
  const own = await (await h.request("/api/audits?station=6470202", { cookie: s1.cookie })).json();
  assert.deepEqual(own.audits.map(x => x.id), ["a1"]);
  assert.equal((await (await h.request("/api/audits", { cookie: owner.cookie })).json()).audits.length, 2);
});
test("cross-station metadata reads, writes, photos, history and deletions are denied", async () => {
  const h = harness(), owner = await h.login(), staff = await h.staff(owner.cookie, "staff1"); const other = audit("other", "64.702.02");
  await save(h, owner.cookie, other);
  for (const suffix of ["", "/photos/p1", "/history"]) assert.equal((await h.request(path(other) + suffix, { cookie: staff.cookie })).status, 403);
  assert.equal((await save(h, staff.cookie, other, 1)).status, 403);
  for (const action of ["delete", "restore"]) assert.equal((await h.request(path(other) + "/" + action, { cookie: staff.cookie, json: { baseRevision: 1 } })).status, 403);
});
test("assignment changes revoke old sessions and remove access to the old station", async () => {
  const h = harness(), owner = await h.login(), staff = await h.staff(owner.cookie, "staff1");
  await save(h, staff.cookie, audit());
  assert.equal((await h.request("/auth/users/update", { cookie: owner.cookie, form: { username: "staff1", action: "station", stationNumber: "64.702.02" } })).status, 200);
  assert.equal((await h.request("/api/audits", { cookie: staff.cookie })).status, 401);
  const changed = await h.login("staff1", "87654321");
  assert.equal((await (await changed.response.json()).user).stationNumber, "6470202");
  assert.equal((await h.request(path(audit()), { cookie: changed.cookie })).status, 403);
});
test("cross-origin audit and photo mutations never reach storage", async () => {
  const h = harness(), owner = await h.login();
  const response = await h.request(path(audit()), { cookie: owner.cookie, origin: "https://evil.example", json: { audit: audit(), baseRevision: 0, mutationID: "m1" } });
  assert.equal(response.status, 403); assert.equal(h.data.values.size, 0);
});
test("metadata cannot change route identity, station, creator or version", async () => {
  const h = harness(), owner = await h.login(), a = audit();
  assert.equal((await h.request(path(a), { cookie: owner.cookie, json: { audit: audit("different"), baseRevision: 0, mutationID: "m1" } })).status, 400);
  assert.equal((await h.request(path(a), { cookie: owner.cookie, json: { audit: audit("s1", "64.702.02"), baseRevision: 0, mutationID: "m2" } })).status, 400);
  a.createdBy = "forged"; a.revision = 999;
  await save(h, owner.cookie, a);
  const record = h.data.values.get("audits/6470110/s1.json").data;
  assert.equal(record.createdBy, "bapal6"); assert.equal(record.revision, 1);
});
test("stale concurrent writes return a conflict and keep the winning revision", async () => {
  const h = harness(), owner = await h.login(); await save(h, owner.cookie, audit());
  const results = await Promise.all([save(h, owner.cookie, audit("s1", "64.701.10", "A"), 1), save(h, owner.cookie, audit("s1", "64.701.10", "F"), 1)]);
  assert.deepEqual(results.map(x => x.status).sort(), [200, 409]);
  const current = await (await h.request(path(audit()), { cookie: owner.cookie })).json(); assert.equal(current.revision, 2);
  assert.ok(["A", "F"].includes(current.audit.items["1.1.1.a"].rating));
});
test("lost save responses can be retried idempotently without duplicate revisions", async () => {
  const h = harness(), owner = await h.login(), a = audit();
  assert.equal((await save(h, owner.cookie, a, 0, "stable-mutation")).status, 200);
  const again = await save(h, owner.cookie, a, 0, "stable-mutation");
  assert.equal(again.status, 200); assert.equal((await again.json()).revision, 1);
  assert.equal([...h.data.values.keys()].filter(x => x.startsWith("history/")).length, 0);
});
test("audit identifiers cannot be reused across stations", async () => {
  const h = harness(), owner = await h.login(); await save(h, owner.cookie, audit());
  const result = await save(h, owner.cookie, audit("s1", "64.702.02"));
  assert.equal(result.status, 409); assert.equal((await result.json()).code, "AUDIT_ID_EXISTS");
});
test("photos are stored separately, immutable, authenticated and referenced before download", async () => {
  const h = harness(), owner = await h.login(), a = audit(); await save(h, owner.cookie, a);
  const url = path(a) + "/photos/p1";
  const uploaded = await h.request(url, { cookie: owner.cookie, bytes: JPEG, headers: { "content-type": "image/jpeg" } });
  assert.equal(uploaded.status, 200); const ref = await uploaded.json();
  assert.equal((await h.request(url, { cookie: owner.cookie })).status, 404);
  a.evidence[ELEMENT] = [{ id: "p1", type: "image/jpeg", name: "bukti.jpg", cloudHash: ref.cloudHash, data: "data:image/jpeg;base64,private", remoteUrl: "https://evil.example/photo" }];
  assert.equal((await save(h, owner.cookie, a, 1)).status, 200);
  const record = h.data.values.get("audits/6470110/s1.json").data;
  assert.ok(!JSON.stringify(record).includes("data:image")); assert.ok(!JSON.stringify(record).includes("evil.example"));
  const photo = await h.request(url, { cookie: owner.cookie });
  assert.equal(photo.status, 200); assert.deepEqual(new Uint8Array(await photo.arrayBuffer()), JPEG);
  assert.match(photo.headers.get("cache-control"), /private/); assert.equal(photo.headers.get("netlify-cdn-cache-control"), "no-store"); assert.match(photo.headers.get("vary"), /Cookie/);
  assert.equal((await h.request(url, { cookie: owner.cookie, headers: { "if-none-match": photo.headers.get("etag") } })).status, 304);
  const second = await h.request(url, { cookie: owner.cookie, bytes: JPEG, headers: { "content-type": "image/jpeg" } }); assert.equal(second.status, 200);
  assert.equal((await h.request(url, { cookie: owner.cookie, bytes: new Uint8Array([...JPEG, 1]), headers: { "content-type": "image/jpeg" } })).status, 409);
});
test("photo types, actual magic bytes, missing blobs and forged references are rejected", async () => {
  const h = harness(), owner = await h.login(), a = audit(); await save(h, owner.cookie, a);
  assert.equal((await h.request(path(a) + "/photos/p1", { cookie: owner.cookie, bytes: JPEG, headers: { "content-type": "image/svg+xml" } })).status, 415);
  assert.equal((await h.request(path(a) + "/photos/p1", { cookie: owner.cookie, bytes: new TextEncoder().encode("<html>"), headers: { "content-type": "image/jpeg" } })).status, 400);
  a.evidence[ELEMENT] = [{ id: "p1", type: "image/jpeg", cloudHash: "a".repeat(64) }];
  assert.equal((await save(h, owner.cookie, a, 1)).status, 400);
});
test("another station cannot download or upload an existing photo", async () => {
  const h = harness(), owner = await h.login(), other = await h.staff(owner.cookie, "staff2", "64.702.02"), a = audit(); await save(h, owner.cookie, a);
  const url = path(a) + "/photos/p1";
  assert.equal((await h.request(url, { cookie: other.cookie, bytes: JPEG, headers: { "content-type": "image/jpeg" } })).status, 403);
  assert.equal((await h.request(url, { cookie: other.cookie })).status, 403);
});
test("five recent snapshots remain available and restoration creates a new revision", async () => {
  const h = harness(), owner = await h.login(); let revision = 0;
  for (let i = 0; i < 9; i++) { h.tick(); const result = await save(h, owner.cookie, audit("s1", "64.701.10", i % 2 ? "F" : "A"), revision); revision = (await result.json()).revision; }
  const history = await (await h.request(path(audit()) + "/history", { cookie: owner.cookie })).json();
  assert.deepEqual(history.versions.map(x => x.revision), [8, 7, 6, 5, 4]);
  const restored = await h.request(path(audit()) + "/restore", { cookie: owner.cookie, json: { baseRevision: revision, historyRevision: 8 } });
  assert.equal(restored.status, 200); assert.equal((await restored.json()).revision, 10);
  assert.equal((await (await h.request(path(audit()), { cookie: owner.cookie })).json()).audit.items["1.1.1.a"].rating, "F");
});
test("deleted audits are hidden, recoverable by admin, and deletion retries are harmless", async () => {
  const h = harness(), owner = await h.login(), staff = await h.staff(owner.cookie, "staff1"), a = audit(); await save(h, staff.cookie, a);
  const address = path(a) + "/delete";
  assert.equal((await h.request(address, { cookie: staff.cookie, json: { baseRevision: 1 } })).status, 200);
  assert.equal((await h.request(address, { cookie: staff.cookie, json: { baseRevision: 1 } })).status, 200);
  assert.equal((await h.request(path(a), { cookie: owner.cookie })).status, 404);
  assert.equal((await (await h.request("/api/audits", { cookie: owner.cookie })).json()).audits.length, 0);
  assert.equal((await h.request("/api/audits?deleted=1", { cookie: staff.cookie })).status, 403);
  assert.equal((await (await h.request("/api/audits?deleted=1", { cookie: owner.cookie })).json()).audits.length, 1);
  assert.equal((await h.request(path(a) + "/restore", { cookie: owner.cookie, json: { baseRevision: 2 } })).status, 200);
  assert.equal((await h.request(path(a), { cookie: staff.cookie })).status, 200);
});
test("metadata pagination visits every audit without exposing photos or private internals", async () => {
  const h = harness(), owner = await h.login();
  for (let i = 0; i < 28; i++) await save(h, owner.cookie, audit("s" + String(i).padStart(3, "0")));
  const first = await (await h.request("/api/audits", { cookie: owner.cookie })).json(); assert.equal(first.audits.length, 25); assert.ok(first.nextCursor);
  const second = await (await h.request("/api/audits?cursor=" + encodeURIComponent(first.nextCursor), { cookie: owner.cookie })).json(); assert.equal(second.audits.length, 3);
  assert.equal(new Set([...first.audits, ...second.audits].map(x => x.id)).size, 28);
  assert.ok(!JSON.stringify(first).includes("lastMutation")); assert.ok(!JSON.stringify(first).includes("password"));
});
test("invalid criteria, prohibited grades, traversal and prototype keys fail without writes", async () => {
  const h = harness(), owner = await h.login();
  const a = audit(); a.items["1.1.1.a"] = { rating: "B" }; assert.equal((await save(h, owner.cookie, a)).status, 400);
  a.items = JSON.parse('{"__proto__":{"polluted":true}}'); assert.equal((await save(h, owner.cookie, a)).status, 400);
  a.items = {}; a.aiEvidence = JSON.parse('{"__proto__":{"polluted":true}}'); assert.equal((await save(h, owner.cookie, a)).status, 400);
  assert.equal(({}).polluted, undefined);
  assert.equal((await h.request("/api/audits/6470110/s%2Fevil", { cookie: owner.cookie })).status, 400);
  assert.equal(h.data.values.size, 0);
});
test("storage outages return a safe retryable error while login still works", async () => {
  const h = harness(), owner = await h.login(); h.data.fail = true;
  const result = await h.request("/api/audits", { cookie: owner.cookie });
  assert.equal(result.status, 503); const body = await result.json(); assert.equal(body.code, "AUDIT_STORE"); assert.equal(body.retryable, true); assert.ok(!JSON.stringify(body).includes("provider-internal"));
  assert.equal((await h.request("/auth/session", { cookie: owner.cookie })).status, 200);
});
