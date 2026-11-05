import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
await mkdir("public", { recursive: true });
await writeFile(resolve("public/index.html"), '<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Siap Audit SPBU</title><body><h1>Aplikasi belum tersedia</h1><p>Hubungi pengelola untuk melanjutkan.</p></body></html>');
const source = await readFile("netlify/functions/app.mjs", "utf8");
if (!source.includes('path: "/*"') || !source.includes("preferStatic: false")) throw new Error("All application routes must pass the account gate.");
console.log("Netlify build ready: one protected function, application assets bundled, no client-side credentials.");
