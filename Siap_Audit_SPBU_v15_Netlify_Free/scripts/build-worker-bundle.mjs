import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
const root = process.cwd();
const files = [
  ["/index.html", "frontend/index.html", "text/html; charset=utf-8"],
  ["/manifest.webmanifest", "frontend/manifest.webmanifest", "application/manifest+json; charset=utf-8"],
  ["/sw.js", "frontend/sw.js", "text/javascript; charset=utf-8"],
  ["/icon-192.png", "frontend/icon-192.png", "image/png"],
  ["/icon-512.png", "frontend/icon-512.png", "image/png"],
];
const assets = {};
for (const [url, file, type] of files) assets[url] = { type, data: (await readFile(path.join(root, file))).toString("base64") };
let source = await readFile(path.join(root, "worker/handler.js"), "utf8");
source = source.replace("__ASSET_MAP__", JSON.stringify(assets));
await mkdir(path.join(root, "worker"), { recursive: true });
await writeFile(path.join(root, "worker/index.js"), source);
console.log(`Bundled ${files.length} client assets into worker/index.js`);
