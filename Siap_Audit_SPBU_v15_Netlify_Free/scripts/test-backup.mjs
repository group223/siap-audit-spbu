import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../frontend/index.html", import.meta.url), "utf8");
const code = html.slice(html.indexOf("/*backup:start*/"), html.indexOf("/*backup:end*/"));
const { makeBackup, parseBackup } = new Function(code + "; return { makeBackup, parseBackup };")();
const img = "data:image/jpeg;base64,/9j/AAAA";
const s1 = { id: "s1", station: "SPBU A", number: "64.1", items: { x: { rating: "A" } }, evidence: { "Elemen 1": [{ data: img }, { data: "javascript:alert(1)" }, null] }, aiEvidence: {} };
let n = 0;
// Cadangan lalu pulihkan: data sama, bukti non-gambar dibuang.
let r = parseBackup(makeBackup([s1]), []);
assert.equal(r.sessions.length, 1); assert.equal(r.sessions[0].id, "s1"); assert.equal(r.sessions[0].items.x.rating, "A");
assert.deepEqual(r.sessions[0].evidence["Elemen 1"], [{ data: img }]); n++;
// Id yang sudah ada tidak ditimpa: dipulihkan sebagai salinan.
r = parseBackup(makeBackup([s1]), ["s1"]);
assert.equal(r.copies, 1); assert.notEqual(r.sessions[0].id, "s1"); assert.match(r.sessions[0].station, /pulihan/); n++;
// Berkas yang bukan cadangan ditolak.
assert.throws(() => parseBackup('{"a":1}', [])); assert.throws(() => parseBackup("bukan json", [])); n++;
// Item sampah dilewati, bagian yang hilang diisi kosong.
r = parseBackup(JSON.stringify({ format: "siap-audit-spbu-cadangan", versi: 1, sessions: [null, 5, { number: "9" }] }), []);
assert.equal(r.sessions.length, 1); assert.deepEqual(r.sessions[0].items, {}); assert.deepEqual(r.sessions[0].evidence, {}); n++;
console.log(`Backup checks passed (${n} scenarios).`);
