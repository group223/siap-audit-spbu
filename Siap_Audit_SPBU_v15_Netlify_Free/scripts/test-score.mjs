import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../frontend/index.html", import.meta.url), "utf8");
const seed = JSON.parse(html.match(/window\.CHECKLIST_DATA = (\[.*?\]);\n/s)[1]);
const src = html.slice(html.indexOf("function score(s){"), html.indexOf("\n}\n", html.indexOf("function score(s){")) + 3);
const maxOf = s => { const m = String(s).match(/\((\d+(?:\.\d+)?)\)\s*$/); return m ? Number(m[1]) : 0 };
const num = v => Number(v) || 0, factor = { A: 1, B: .8, C: .6, D: .4, E: .2, F: 0 };
const groups = [...new Set(seed.map(x => x.subElement))];
const run = ratings => { const get = (s, id) => ({ rating: ratings[id] || "" }); return new Function("seed", "groups", "factor", "num", "maxOf", "get", src + "; return score({});")(seed, groups, factor, num, maxOf, get) };
let n = 0;
// 1. Contoh nilai dari RUMUS_AUDIT.xlsx (semua 120 butir) harus menghasilkan skor subelemen yang sama.
const ratings = {"1.1.1.a":"A","1.1.1.b":"A","1.1.1.c":"A","1.1.1.d":"C","1.1.1.e":"A","1.1.1.f":"A","1.1.2.a":"C","1.1.2.b":"A","1.1.2.c":"A","1.2.1.a":"C","1.2.1.b":"C","1.2.1.c":"A","1.2.1.d":"B","1.2.1.e":"C","1.2.1.f":"C","1.2.1.g":"A","1.3.a":"A","1.3.b":"A","1.3.c":"X","2.1.a":"A","2.1.b":"A","2.1.c":"A","2.1.d":"A","2.2.a":"A","2.2.b":"A","2.2.c":"A","2.2.d":"A","2.2.e":"A","2.2.f":"A","2.2.g":"F","2.2.h":"X","2.2.i":"A","2.2.j":"F","2.2.k":"A","2.2.l":"A","2.2.m":"A","2.2.n":"A","2.2.o":"A","3.1.1.a":"C","3.1.1.b":"B","3.1.1.c":"C","3.1.1.d":"C","3.1.1.e":"A","3.1.1.f":"B","3.1.1.g":"C","3.1.1.h":"B","3.1.1.I":"B","3.1.1.j":"B","3.1.1.k":"B","3.1.1.l":"A","3.1.1.m":"A","3.1.1.n":"C","3.1.1.o":"C","3.1.1.p":"B","3.1.2.a":"B","3.1.2.b":"B","3.1.2.c":"B","3.1.3.a":"A","3.1.3.b":"A","3.1.3.c":"A","3.1.3.d":"A","3.1.3.e":"A","3.1.4.a":"A","3.1.4.b":"A","3.1.4.c":"A","3.1.5.a":"A","3.1.5.b":"A","3.1.5.c":"A","3.1.5.d":"A","3.1.5.e":"B","3.1.5.f":"A","3.1.5.g":"A","3.1.5.h":"A","3.1.5.i":"A","3.1.5.j":"A","3.1.5.k":"A","3.1.7.a":"B","3.1.7.b":"B","3.1.7.c":"B","3.1.7.d":"B","3.2.a":"A","3.2.b":"A","3.2.c":"A","3.2.d":"B","3.2.e":"B","3.2.f":"B","3.2.g":"B","3.2.h":"B","3.2.i":"B","3.2.j":"A","3.4.a":"A","3.4.b":"A","3.4.c":"X","3.4.d":"A","4.1.a":"B","4.1.b":"A","4.1.c":"A","4.1.d":"A","4.1.e":"A","4.2.a":"A","4.2.b":"A","4.3.a":"A","4.3.b":"A","4.3.c":"A","4.3.d":"A","4.3.e":"A","4.3.f":"A","5.1.a":"A","5.1.b":"F","5.1.c":"A","5.1.d":"A","5.1.e":"F","5.1.f":"C","5.1.g":"C","5.2.a":"B","5.2.b":"B","5.2.c":"A","5.2.d":"F","5.2.e":"F","5.2.f":"A"};
const expected = {"Sub-Elemen 1.1.: Kebersihan (10)": 9.2, "Sub-Elemen 1.2 Prosedur Pelayanan (18)": 13.25, "Sub-Elemen 1.3 Penanganan Keluhan Pelanggan (2)": 2, "Sub-Elemen 2.1: Peralatan (10)": 10, "Sub-Elemen 2.2 Prosedur Monitoring (20)": 17.894736842105264, "Sub-Elemen 3.1: Kebersihan harian (14)": 12.1, "Sub-Elemen 4.1: Identitas Visual Ritel (2)": 1.92, "Sub-Elemen 5.1: Penawaran BBM (2)": 1.218};
const r = run(ratings);
for (const [name, value] of Object.entries(expected)) assert.ok(Math.abs(r.det.find(g => g.name === name).score - value) < 1e-6, name);
n++;
// 2. Subelemen 5.2: bobot butir hanya 10,6 dari 13, skor diskalakan proporsional (5,84 / 10,6 x 13).
assert.ok(Math.abs(r.det.find(g => g.name.includes("5.2")).score - 5.84 / 10.6 * 13) < 1e-6); n++;
// 3. Semua butir bernilai A harus menghasilkan tepat 100 poin.
const all = {}; for (const x of seed) all[x.id] = "A";
assert.ok(Math.abs(run(all).points - 100) < 1e-6); n++;
// 4. Pilihan nilai: 52 butir hanya A/F, sesuai Excel; setiap butir punya A dan F.
assert.equal(seed.filter(x => x.allowed.join("") === "AF").length, 52);
assert.ok(seed.every(x => x.allowed.includes("A") && x.allowed.includes("F"))); n++;
console.log(`Score and data checks passed (${n} scenarios).`);
