import { createHash } from "node:crypto";
import { AuthError } from "./auth.mjs";

export const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
export const VIDEO_LIMIT = 12 * 1024 * 1024;
export const VIDEO_CHUNK = 1024 * 1024;
export const videoManifestKey = (station, audit, media) => `videos/${station}/${audit}/${media}/ready.json`;
export const videoURL = (station, audit, media) => `/api/audits/${station}/${encodeURIComponent(audit)}/videos/${encodeURIComponent(media)}`;
const uploadKey = (station, audit, media) => `videos/${station}/${audit}/${media}/upload.json`;
const chunkKey = (station, audit, media, index) => `videos/${station}/${audit}/${media}/chunks/${index}`;
const posterKey = (station, audit, media) => `videos/${station}/${audit}/${media}/poster.jpg`;
const digest = data => createHash("sha256").update(data).digest("hex");
const json = value => new Response(JSON.stringify(value), { headers: { "content-type": "application/json; charset=utf-8" } });
const mediaResponse = (station, audit, media, info) => ({ ok: true, cloudHash: info.hash, remoteUrl: videoURL(station, audit, media), posterUrl: videoURL(station, audit, media) + "/poster", size: info.size, duration: info.duration });

export function createVideos({ getStore, entry, readBody, bodyJSON, id }) {
  const read = key => getStore().getWithMetadata(key, { type: "json", consistency: "strong" });
  const metadata = key => getStore().getMetadata(key, { consistency: "strong" });
  async function reference(user, station, audit, media) {
    const record = await entry(user, station, audit); id(media);
    const pair = Object.entries(record.data.audit.evidence || {}).find(([, list]) => list.some(p => p.id === media && VIDEO_TYPES.has(p.type)));
    if (!pair) throw new AuthError("Video tidak ditemukan.", 404, "VIDEO_NOT_FOUND");
    const photo = pair[1].find(p => p.id === media);
    const ready = await read(videoManifestKey(station, audit, media));
    if (!ready?.data || ready.data.hash !== photo.cloudHash) throw new AuthError("Video belum selesai dikirim.", 404, "VIDEO_NOT_READY");
    return { info: ready.data, element: pair[0] };
  }
  async function start(user, station, audit, media, input) {
    await entry(user, station, audit); id(media);
    const { hash, type, size, duration, width, height } = input || {};
    if (!/^[a-f0-9]{64}$/.test(hash || "") || !VIDEO_TYPES.has(type) || !Number.isSafeInteger(size) || size < 12 || size > VIDEO_LIMIT || !Number.isFinite(duration) || duration <= 0 || duration > 60.5 || !Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width > 16384 || height > 16384) throw new AuthError("Video harus MP4, MOV, atau WebM, maksimal 60 detik dan 12 MB.", 400, "VIDEO_INPUT");
    const match = String(input.poster || "").match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
    if (!match || match[1].length > 180000) throw new AuthError("Gambar sampul video belum tersedia.", 400, "VIDEO_POSTER");
    const poster = Buffer.from(match[1], "base64");
    if (poster.length > 128 * 1024 || poster[0] !== 255 || poster[1] !== 216 || poster[2] !== 255) throw new AuthError("Gambar sampul video tidak valid.", 400, "VIDEO_POSTER");
    const ready = await read(videoManifestKey(station, audit, media));
    if (ready) {
      if (ready.data.hash !== hash || ready.data.type !== type || ready.data.size !== size) throw new AuthError("Identitas video sudah dipakai berkas lain.", 409, "VIDEO_CONFLICT");
      return json({ ...mediaResponse(station, audit, media, ready.data), complete: true });
    }
    const info = { hash, type, size, duration, width, height, chunkCount: Math.ceil(size / VIDEO_CHUNK), name: String(input.name || "video").slice(0, 160), poster: match[1] };
    const key = uploadKey(station, audit, media);
    const created = await getStore().setJSON(key, info, { onlyIfNew: true });
    const current = created.modified ? info : (await read(key))?.data;
    if (!current || current.hash !== hash || current.size !== size || current.type !== type) throw new AuthError("Identitas video sudah dipakai berkas lain.", 409, "VIDEO_CONFLICT");
    const missing = [];
    for (let index = 0; index < info.chunkCount; index++) if (!(await metadata(chunkKey(station, audit, media, index)))) missing.push(index);
    return json({ ok: true, complete: false, chunkSize: VIDEO_CHUNK, chunkCount: info.chunkCount, missing });
  }
  async function chunk(user, station, audit, media, index, request) {
    await entry(user, station, audit); id(media);
    const upload = (await read(uploadKey(station, audit, media)))?.data;
    if (!upload || !Number.isSafeInteger(index) || index < 0 || index >= upload.chunkCount) throw new AuthError("Bagian video tidak valid.", 400, "VIDEO_CHUNK");
    const bytes = Buffer.from(await readBody(request, VIDEO_CHUNK));
    if (bytes.length !== Math.min(VIDEO_CHUNK, upload.size - index * VIDEO_CHUNK)) throw new AuthError("Ukuran bagian video tidak lengkap.", 400, "VIDEO_CHUNK");
    const key = chunkKey(station, audit, media, index), hash = digest(bytes);
    const result = await getStore().set(key, bytes, { onlyIfNew: true, metadata: { hash, size: bytes.length } });
    if (!result.modified && (await metadata(key))?.metadata?.hash !== hash) throw new AuthError("Bagian video berbeda dari unggahan sebelumnya.", 409, "VIDEO_CONFLICT");
    return json({ ok: true, index });
  }
  async function finish(user, station, audit, media) {
    await entry(user, station, audit); id(media);
    const previous = await read(videoManifestKey(station, audit, media));
    if (previous) return json(mediaResponse(station, audit, media, previous.data));
    const upload = (await read(uploadKey(station, audit, media)))?.data;
    if (!upload) throw new AuthError("Unggahan video belum dimulai.", 400, "VIDEO_NOT_READY");
    const hasher = createHash("sha256"); let size = 0;
    for (let index = 0; index < upload.chunkCount; index++) {
      const part = await getStore().getWithMetadata(chunkKey(station, audit, media, index), { type: "arrayBuffer", consistency: "strong" });
      if (!part) throw new AuthError("Sebagian video belum terkirim. Pengiriman akan dilanjutkan.", 409, "VIDEO_NOT_READY");
      const bytes = Buffer.from(part.data); size += bytes.length; hasher.update(bytes);
      if (index === 0) {
        const mp4 = bytes.toString("ascii", 4, 8) === "ftyp";
        const webm = bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
        if (!(upload.type === "video/webm" ? webm : mp4)) throw new AuthError("Isi video tidak sesuai jenis berkas.", 400, "VIDEO_TYPE");
      }
    }
    if (size !== upload.size || hasher.digest("hex") !== upload.hash) throw new AuthError("Video tidak lengkap atau berubah. Ambil ulang video.", 400, "VIDEO_HASH");
    const poster = Buffer.from(upload.poster, "base64");
    await getStore().set(posterKey(station, audit, media), poster, { onlyIfNew: true, metadata: { hash: digest(poster), type: "image/jpeg" } });
    const info = { ...upload }; delete info.poster;
    const written = await getStore().setJSON(videoManifestKey(station, audit, media), info, { onlyIfNew: true, metadata: { hash: info.hash, type: info.type, size: info.size } });
    if (!written.modified && (await read(videoManifestKey(station, audit, media)))?.data?.hash !== info.hash) throw new AuthError("Identitas video berubah.", 409, "VIDEO_CONFLICT");
    return json(mediaResponse(station, audit, media, info));
  }
  async function get(user, station, audit, media, request, poster = false) {
    const { info } = await reference(user, station, audit, media);
    if (poster) {
      const stored = await getStore().getWithMetadata(posterKey(station, audit, media), { type: "arrayBuffer", consistency: "strong" });
      if (!stored) throw new AuthError("Sampul video belum tersedia.", 404);
      const etag = '"' + stored.metadata.hash + '"', fresh = request.headers.get("if-none-match") === etag;
      return new Response(fresh || request.method === "HEAD" ? null : stored.data, { status: fresh ? 304 : 200, headers: { "content-type": "image/jpeg", etag } });
    }
    const headers = { "content-type": info.type, "accept-ranges": "bytes", "content-length": String(info.size), etag: '"' + info.hash + '"' };
    if (request.headers.get("if-none-match") === headers.etag) return new Response(null, { status: 304, headers });
    if (request.method === "HEAD") return new Response(null, { headers });
    let start = 0, end = info.size - 1, status = 200;
    const range = request.headers.get("range"), ifRange = request.headers.get("if-range");
    if (range && (!ifRange || ifRange === headers.etag)) {
      const match = range.match(/^bytes=(\d*)-(\d*)$/);
      if (!match || (!match[1] && !match[2])) return invalidRange();
      if (!match[1]) { const suffix = Number(match[2]); if (!Number.isSafeInteger(suffix) || suffix < 1) return invalidRange(); start = Math.max(0, info.size - suffix); }
      else { start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), end) : end; }
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= info.size || end < start) return invalidRange();
      status = 206; headers["content-range"] = `bytes ${start}-${end}/${info.size}`; headers["content-length"] = String(end - start + 1);
    }
    function invalidRange() { return new Response(null, { status: 416, headers: { ...headers, "content-range": `bytes */${info.size}`, "content-length": "0" } }); }
    let index = Math.floor(start / VIDEO_CHUNK);
    const stream = new ReadableStream({
      async pull(controller) {
        try {
          const part = await getStore().getWithMetadata(chunkKey(station, audit, media, index), { type: "arrayBuffer", consistency: "strong" });
          if (!part) throw new Error("Video chunk unavailable");
          const bytes = new Uint8Array(part.data), from = Math.max(0, start - index * VIDEO_CHUNK), to = Math.min(bytes.length, end - index * VIDEO_CHUNK + 1);
          controller.enqueue(bytes.subarray(from, to));
          if (++index > Math.floor(end / VIDEO_CHUNK)) controller.close();
        } catch (error) { controller.error(error); }
      },
    });
    return new Response(stream, { status, headers });
  }
  async function forAI(user, ref, element) {
    if (!ref || typeof ref !== "object") throw new AuthError("Tujuan video tidak valid.", 400);
    const station = String(ref.station || ""), audit = id(ref.auditID), media = id(ref.mediaID);
    const { info, element: actual } = await reference(user, station, audit, media);
    if (actual !== element) throw new AuthError("Video tidak sesuai elemen pemeriksaan.", 403, "VIDEO_ELEMENT");
    const parts = [];
    for (let index = 0; index < info.chunkCount; index++) {
      const part = await getStore().getWithMetadata(chunkKey(station, audit, media, index), { type: "arrayBuffer", consistency: "strong" });
      if (!part) throw new AuthError("Video belum dapat dibaca. Coba lagi.", 503, "VIDEO_NOT_READY");
      parts.push(Buffer.from(part.data));
    }
    return { name: info.name, type: info.type, data: `data:${info.type};base64,${Buffer.concat(parts).toString("base64")}` };
  }
  async function handle(request, user, station, audit, media, tail) {
    id(media);
    if (!tail.length && ["GET", "HEAD"].includes(request.method)) return get(user, station, audit, media, request);
    if (tail[0] === "poster" && tail.length === 1 && ["GET", "HEAD"].includes(request.method)) return get(user, station, audit, media, request, true);
    if (tail[0] === "start" && tail.length === 1 && request.method === "POST") return start(user, station, audit, media, await bodyJSON(request));
    if (tail[0] === "complete" && tail.length === 1 && request.method === "POST") return finish(user, station, audit, media);
    if (tail[0] === "chunks" && tail.length === 2 && /^\d+$/.test(tail[1]) && request.method === "POST") return chunk(user, station, audit, media, Number(tail[1]), request);
    throw new AuthError("Alamat video tidak didukung.", 405);
  }
  return { handle, forAI };
}
