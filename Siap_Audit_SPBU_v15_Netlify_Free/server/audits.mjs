import { createHash } from "node:crypto";
import schema from "./audit-schema.json" with { type: "json" };
import { AuthError, stationKey } from "./auth.mjs";
import { createVideos, VIDEO_TYPES, VIDEO_LIMIT, videoManifestKey, videoURL } from "./videos.mjs";

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const HASH = /^[a-f0-9]{64}$/;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const TYPES = new Set([...IMAGE_TYPES, ...VIDEO_TYPES]);
const ELEMENTS = new Set(schema.elements);
const HISTORY_LIMIT = 5;
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const MAX_METADATA_BYTES = 3 * 1024 * 1024;
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json; charset=utf-8" } });
const id = value => { if (!ID.test(String(value || ""))) throw new AuthError("Identitas audit/foto tidak valid."); return String(value); };
const text = (value, limit = 120) => String(value ?? "").trim().slice(0, limit);
const hash = value => createHash("sha256").update(value).digest("hex");
const keyFor = (station, auditID) => `audits/${station}/${auditID}.json`;
const photoKey = (station, auditID, photoID) => `photos/${station}/${auditID}/${photoID}`;
const historyPrefix = (station, auditID) => `history/${station}/${auditID}/`;
const photoURL = (station, auditID, photoID) => `/api/audits/${station}/${encodeURIComponent(auditID)}/photos/${encodeURIComponent(photoID)}`;

function permitted(user, station) {
  if (!/^\d{7}$/.test(station)) throw new AuthError("Nomor SPBU tidak valid.");
  if (user.role !== "admin" && !stationKey(user.stationNumber)) throw new AuthError("Akun Anda belum ditugaskan ke SPBU. Hubungi admin.", 403, "STATION_REQUIRED");
  if (user.role !== "admin" && stationKey(user.stationNumber) !== station) throw new AuthError("Audit/foto ini tidak tersedia untuk akun Anda.", 403, "STATION_FORBIDDEN");
}

function cleanJSON(value) {
  let count = 0;
  function walk(v, depth) {
    if (++count > 150000 || depth > 16) throw new AuthError("Data audit terlalu rumit.");
    if (v === null || typeof v === "boolean") return v;
    if (typeof v === "number") { if (!Number.isFinite(v)) throw new AuthError("Angka audit tidak valid."); return v; }
    if (typeof v === "string") { if (v.length > 16000) throw new AuthError("Catatan terlalu panjang."); return v; }
    if (Array.isArray(v)) return v.map(x => walk(x, depth + 1));
    if (v && typeof v === "object") {
      const result = {};
      for (const [k, x] of Object.entries(v)) {
        if (["__proto__", "constructor", "prototype"].includes(k)) throw new AuthError("Kunci data audit tidak valid.");
        result[k] = walk(x, depth + 1);
      }
      return result;
    }
    throw new AuthError("Data audit tidak valid.");
  }
  return walk(value, 0);
}

function sanitize(input, station, auditID) {
  if (!input || typeof input !== "object" || Array.isArray(input) || input.id !== auditID || stationKey(input.number) !== station) throw new AuthError("Nomor SPBU/identitas audit tidak sesuai.");
  const items = {};
  for (const [code, item] of Object.entries(input.items || {})) {
    const allowed = Object.hasOwn(schema.criteria, code) ? schema.criteria[code] : null;
    if (!allowed || !item || typeof item !== "object" || Array.isArray(item)) throw new AuthError("Butir penilaian tidak valid.");
    const rating = text(item.rating, 8);
    if (rating && !allowed.includes(rating)) throw new AuthError("Nilai tidak tersedia untuk butir " + code + ".");
    items[code] = { rating, comment: text(item.comment, 10000), plan: text(item.plan, 10000), owner: text(item.owner, 120), due: text(item.due, 20), actionDone: item.actionDone === true };
  }
  const evidence = {}, photos = new Set();
  for (const [element, list] of Object.entries(input.evidence || {})) {
    if (!ELEMENTS.has(element) || !Array.isArray(list)) throw new AuthError("Elemen bukti tidak valid.");
    evidence[element] = list.map(photo => {
      const photoID = id(photo?.id);
      if (photos.has(photoID)) throw new AuthError("Identitas foto terduplikasi.");
      photos.add(photoID);
      if (photos.size > 600 || !HASH.test(photo.cloudHash || "") || !TYPES.has(photo.type)) throw new AuthError("Foto belum tersimpan di server atau jenis foto tidak didukung.", 400, "PHOTO_NOT_UPLOADED");
      if (VIDEO_TYPES.has(photo.type) && (!Number.isSafeInteger(photo.size) || photo.size < 12 || photo.size > VIDEO_LIMIT || !Number.isFinite(photo.duration) || photo.duration <= 0 || photo.duration > 60.5)) throw new AuthError("Ukuran/durasi video tidak valid.", 400, "VIDEO_INPUT");
      const sourceCode = photo.sourceCode == null || photo.sourceCode === "" ? "" : String(photo.sourceCode);
      if (sourceCode && (!Object.hasOwn(schema.criterionElements, sourceCode) || schema.criterionElements[sourceCode] !== element)) throw new AuthError("Butir tujuan foto tidak sesuai dengan elemen.", 400, "INVALID_PHOTO_SOURCE");
      return { id: photoID, name: text(photo.name, 160), type: photo.type, cloudHash: photo.cloudHash, uploadedAt: text(photo.uploadedAt, 50), ...(VIDEO_TYPES.has(photo.type) ? { size: photo.size, duration: photo.duration, width: Number(photo.width)||1, height: Number(photo.height)||1 } : {}), ...(sourceCode ? { sourceCode } : {}), ...(photo.aiReview ? { aiReview: cleanJSON(photo.aiReview) } : {}) };
    });
  }
  const aiEvidence = cleanJSON(input.aiEvidence || {});
  if (Object.keys(aiEvidence).some(element => !ELEMENTS.has(element))) throw new AuthError("Hasil AI memuat elemen tidak dikenal.");
  const audit = { id: auditID, station: text(input.station), number: text(input.number, 24), city: text(input.city, 100), date: text(input.date, 10), items, evidence, aiEvidence };
  if (!audit.station || !/^\d{4}-\d{2}-\d{2}$/.test(audit.date)) throw new AuthError("Isi nama SPBU dan tanggal pemeriksaan.");
  if (Buffer.byteLength(JSON.stringify(audit)) > MAX_METADATA_BYTES) throw new AuthError("Data penilaian terlalu besar. Unduh cadangan dan hubungi pengelola.", 413, "AUDIT_TOO_LARGE");
  return audit;
}

function summary(record) {
  const a = record.audit;
  const ratings = Object.values(a.items || {}).map(x => x.rating).filter(Boolean);
  return { id: a.id, station: a.station, number: a.number, city: a.city, date: a.date, stationKey: record.stationKey, revision: record.revision, updatedAt: record.updatedAt, updatedBy: record.updatedBy, done: ratings.length, issues: ratings.filter(x => x !== "A" && x !== "X").length, photos: Object.values(a.evidence || {}).reduce((n, p) => n + p.length, 0), deleted: !!record.deletedAt };
}

function publicAudit(record) {
  const audit = structuredClone(record.audit);
  for (const photos of Object.values(audit.evidence || {})) for (const photo of photos) { photo.remoteUrl = VIDEO_TYPES.has(photo.type) ? videoURL(record.stationKey, audit.id, photo.id) : photoURL(record.stationKey, audit.id, photo.id); if (VIDEO_TYPES.has(photo.type)) {photo.posterUrl = photo.remoteUrl + "/poster"; photo._linkedHash = photo.cloudHash;} }
  return { audit, revision: record.revision, updatedAt: record.updatedAt, updatedBy: record.updatedBy };
}

async function pooled(values, limit, operation) {
  const results = new Array(values.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    for (;;) { const at = next++; if (at >= values.length) return; results[at] = await operation(values[at]); }
  }));
  return results;
}

export function createAudits({ getStore, readBody, clock = () => Date.now() }) {
  const store = () => getStore();
  const read = key => store().getWithMetadata(key, { type: "json", consistency: "strong" });
  const metadata = key => store().getMetadata(key, { consistency: "strong" });
  const videos = createVideos({ getStore: store, entry, readBody, bodyJSON, id });
  async function bodyJSON(request) {
    if ((request.headers.get("content-type") || "").split(";")[0] !== "application/json") throw new AuthError("Gunakan format JSON.", 415);
    try { return JSON.parse(new TextDecoder().decode(await readBody(request, 4 * 1024 * 1024))); }
    catch (error) { if (error instanceof AuthError) throw error; throw new AuthError("JSON audit tidak valid."); }
  }
  async function entry(user, station, auditID, allowDeleted = false) {
    permitted(user, station); id(auditID);
    const found = await read(keyFor(station, auditID));
    if (!found?.data?.audit || found.data.stationKey !== station || found.data.audit.id !== auditID || (found.data.deletedAt && !allowDeleted)) throw new AuthError("Audit tidak ditemukan.", 404, "AUDIT_NOT_FOUND");
    return found;
  }
  async function reserveID(station, auditID) {
    const key = "ids/" + auditID;
    const result = await store().setJSON(key, { station }, { onlyIfNew: true });
    if (!result.modified && (await read(key))?.data?.station !== station) throw new AuthError("Identitas audit sudah dipakai. Simpan sebagai salinan baru.", 409, "AUDIT_ID_EXISTS");
  }
  async function archive(station, auditID, record) {
    await store().setJSON(historyPrefix(station, auditID) + String(record.revision).padStart(10, "0") + ".json", record, { onlyIfNew: true, metadata: { summary: summary(record) } });
  }
  async function prune(station, auditID) {
    try {
      const { blobs } = await store().list({ prefix: historyPrefix(station, auditID) });
      for (const b of blobs.sort((a, b) => b.key.localeCompare(a.key)).slice(HISTORY_LIMIT)) await store().delete(b.key);
    } catch { console.warn(JSON.stringify({ event: "audit_history_cleanup_delayed" })); }
  }
  async function commit(station, auditID, previous, record) {
    if (previous) await archive(station, auditID, previous.data);
    const result = await store().setJSON(keyFor(station, auditID), record, { ...(previous ? { onlyIfMatch: previous.etag } : { onlyIfNew: true }), metadata: { summary: summary(record) } });
    if (!result.modified) throw new AuthError("Audit diubah dari perangkat lain. Simpan salinan atau muat versi server.", 409, "AUDIT_CONFLICT");
    await prune(station, auditID);
    return json({ ok: true, revision: record.revision, updatedAt: record.updatedAt });
  }
  async function save(user, station, auditID, input) {
    permitted(user, station); id(auditID);
    const audit = sanitize(input.audit, station, auditID);
    const mutationID = id(input.mutationID);
    const fingerprint = hash(JSON.stringify(audit));
    const previous = await read(keyFor(station, auditID));
    if (previous?.data?.lastMutation?.id === mutationID && previous.data.lastMutation.user === user.username && previous.data.lastMutation.hash === fingerprint) return json({ ok: true, revision: previous.data.revision, updatedAt: previous.data.updatedAt });
    if (previous?.data?.deletedAt) throw new AuthError("Audit ini telah dihapus di server. Simpan salinan baru atau pulihkan melalui Riwayat server.", 409, "AUDIT_DELETED");
    if (!Number.isSafeInteger(input.baseRevision) || input.baseRevision !== (previous?.data?.revision || 0)) throw new AuthError("Versi audit di server lebih baru. Simpan salinan atau muat versi server.", 409, "AUDIT_CONFLICT");
    const oldPhotos = new Map(Object.values(previous?.data?.audit?.evidence || {}).flat().map(p => [p.id, p.cloudHash]));
    await pooled(Object.values(audit.evidence).flat().filter(p => oldPhotos.get(p.id) !== p.cloudHash), 8, async photo => {
      const found = await metadata(VIDEO_TYPES.has(photo.type) ? videoManifestKey(station, auditID, photo.id) : photoKey(station, auditID, photo.id));
      if (found?.metadata?.hash !== photo.cloudHash || found.metadata.type !== photo.type) throw new AuthError("Foto belum selesai dikirim ke server.", 400, "PHOTO_NOT_UPLOADED");
    });
    if (!previous) await reserveID(station, auditID);
    const now = new Date(clock()).toISOString();
    const record = { version: 16, stationKey: station, revision: (previous?.data?.revision || 0) + 1, audit, createdAt: previous?.data?.createdAt || now, createdBy: previous?.data?.createdBy || user.username, updatedAt: now, updatedBy: user.username, lastMutation: { id: mutationID, user: user.username, hash: fingerprint } };
    return commit(station, auditID, previous, record);
  }
  async function list(user, url) {
    const ownStation = stationKey(user.stationNumber);
    if (user.role !== "admin" && !ownStation) throw new AuthError("Akun Anda belum ditugaskan ke SPBU. Hubungi admin.", 403, "STATION_REQUIRED");
    const deleted = url.searchParams.get("deleted") === "1";
    if (deleted && user.role !== "admin") throw new AuthError("Arsip penghapusan hanya untuk admin.", 403);
    const prefix = user.role === "admin" ? "audits/" : `audits/${ownStation}/`;
    const { blobs } = await store().list({ prefix });
    const keys = blobs.map(x => x.key).filter(k => /^audits\/\d{7}\/[A-Za-z0-9][A-Za-z0-9._-]{0,99}\.json$/.test(k)).sort((a, b) => b.split("/").at(-1).localeCompare(a.split("/").at(-1)) || b.localeCompare(a));
    const after = url.searchParams.get("cursor");
    const start = after ? keys.indexOf(after) + 1 : 0;
    if (after && !start) throw new AuthError("Daftar audit berubah. Muat ulang daftar.", 400, "CATALOG_CHANGED");
    const selected = keys.slice(start, start + 25);
    const results = await pooled(selected, 8, async key => {
      const found = await metadata(key);
      let result = found?.metadata?.summary;
      if (!result) { const record = (await read(key))?.data; if (record?.audit) result = summary(record); }
      if (!result || result.deleted !== deleted || (user.role !== "admin" && result.stationKey !== ownStation)) return null;
      return result;
    });
    return json({ audits: results.filter(Boolean), nextCursor: start + selected.length < keys.length ? selected.at(-1) : null });
  }
  async function putPhoto(user, station, auditID, photoID, request) {
    await entry(user, station, auditID); id(photoID);
    const type = (request.headers.get("content-type") || "").split(";")[0];
    if (!IMAGE_TYPES.has(type)) throw new AuthError("Foto harus JPEG, PNG, atau WebP.", 415, "PHOTO_TYPE");
    const data = Buffer.from(await readBody(request, MAX_PHOTO_BYTES));
    const jpeg = data[0] === 255 && data[1] === 216 && data[2] === 255;
    const png = data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const webp = data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP";
    if ((type === "image/jpeg" && !jpeg) || (type === "image/png" && !png) || (type === "image/webp" && !webp)) throw new AuthError("Isi berkas tidak sesuai jenis foto.", 400, "PHOTO_TYPE");
    const fingerprint = hash(data), key = photoKey(station, auditID, photoID);
    const written = await store().set(key, data, { onlyIfNew: true, metadata: { hash: fingerprint, type, size: data.length } });
    if (!written.modified && (await metadata(key))?.metadata?.hash !== fingerprint) throw new AuthError("Identitas foto sudah dipakai berkas lain. Simpan audit sebagai salinan.", 409, "PHOTO_CONFLICT");
    return json({ ok: true, cloudHash: fingerprint, remoteUrl: photoURL(station, auditID, photoID) });
  }
  async function getPhoto(user, station, auditID, photoID, request) {
    const found = await entry(user, station, auditID); id(photoID);
    if (!Object.values(found.data.audit.evidence).flat().some(p => p.id === photoID)) throw new AuthError("Foto tidak ditemukan.", 404);
    const stored = await store().getWithMetadata(photoKey(station, auditID, photoID), { type: "arrayBuffer", consistency: "strong" });
    if (!stored || !IMAGE_TYPES.has(stored.metadata?.type)) throw new AuthError("Foto belum tersedia.", 404);
    const headers = { "content-type": stored.metadata.type, etag: '"' + stored.metadata.hash + '"' };
    return new Response(request.headers.get("if-none-match") === headers.etag ? null : stored.data, { status: request.headers.get("if-none-match") === headers.etag ? 304 : 200, headers });
  }
  async function history(user, station, auditID) {
    await entry(user, station, auditID, user.role === "admin");
    const { blobs } = await store().list({ prefix: historyPrefix(station, auditID) });
    const versions = await pooled(blobs.sort((a, b) => b.key.localeCompare(a.key)).slice(0, HISTORY_LIMIT), 8, async item => (await metadata(item.key))?.metadata?.summary);
    return json({ versions: versions.filter(Boolean) });
  }
  async function change(user, station, auditID, input, action) {
    const previous = await entry(user, station, auditID, user.role === "admin" || action === "delete");
    if (action === "delete" && previous.data.deletedAt) return json({ ok: true, revision: previous.data.revision, updatedAt: previous.data.updatedAt });
    if (input.baseRevision !== previous.data.revision) throw new AuthError("Versi audit telah berubah. Muat ulang daftar.", 409, "AUDIT_CONFLICT");
    let audit = previous.data.audit;
    if (action === "restore") {
      if (input.historyRevision !== undefined) {
        if (!Number.isSafeInteger(input.historyRevision) || input.historyRevision < 1) throw new AuthError("Versi cadangan tidak valid.");
        const old = await read(historyPrefix(station, auditID) + String(input.historyRevision).padStart(10, "0") + ".json");
        if (!old?.data?.audit || old.data.stationKey !== station || old.data.audit.id !== auditID) throw new AuthError("Cadangan tidak ditemukan.", 404);
        audit = old.data.audit;
      } else if (!previous.data.deletedAt) throw new AuthError("Pilih versi cadangan yang akan dipulihkan.");
    }
    const now = new Date(clock()).toISOString();
    const record = { ...previous.data, audit, revision: previous.data.revision + 1, updatedAt: now, updatedBy: user.username };
    delete record.lastMutation;
    if (action === "delete") record.deletedAt = now; else delete record.deletedAt;
    return commit(station, auditID, previous, record);
  }
  const handle = async function handle(request, user) {
    const url = new URL(request.url);
    if (url.pathname === "/api/audits" && request.method === "GET") return list(user, url);
    let parts;
    try { parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent); } catch { throw new AuthError("Alamat audit tidak valid."); }
    if (parts[0] !== "api" || parts[1] !== "audits" || parts.length < 4) throw new AuthError("Alamat audit tidak ditemukan.", 404);
    const [, , station, auditID, action, photoID] = parts;
    permitted(user, station); id(auditID);
    if (parts.length === 4 && request.method === "GET") return json(publicAudit((await entry(user, station, auditID)).data));
    if (parts.length === 4 && request.method === "POST") return save(user, station, auditID, await bodyJSON(request));
    if (parts.length >= 6 && action === "videos") return videos.handle(request, user, station, auditID, photoID, parts.slice(6));
    if (parts.length === 6 && action === "photos" && request.method === "POST") return putPhoto(user, station, auditID, photoID, request);
    if (parts.length === 6 && action === "photos" && ["GET", "HEAD"].includes(request.method)) return getPhoto(user, station, auditID, photoID, request);
    if (parts.length === 5 && action === "history" && request.method === "GET") return history(user, station, auditID);
    if (parts.length === 5 && ["delete", "restore"].includes(action) && request.method === "POST") return change(user, station, auditID, await bodyJSON(request), action);
    throw new AuthError("Metode/alamat audit tidak didukung.", 405);
  };
  handle.videoForAI = videos.forAI;
  return handle;
}
