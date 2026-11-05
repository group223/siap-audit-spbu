import { zipFunctions } from "@netlify/zip-it-and-ship-it";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
const out = await mkdtemp(join(tmpdir(), "spbu-netlify-"));
try {
  const functions = await zipFunctions("netlify/functions", out, { config: { "*": { nodeBundler: "esbuild" } } });
  assert.equal(functions.length, 1);
  assert.equal(functions[0].name, "app");
  assert.equal(functions[0].runtime, "js");
  assert.equal(functions[0].runtimeAPIVersion, 2);
  assert.equal(functions[0].config.preferStatic, false);
  assert.deepEqual(functions[0].config.path, ["/*"]);
  assert.equal(functions[0].routes[0].pattern, "/*");
  assert.equal(functions[0].trafficRules.action.type, "rate_limit");
  console.log("Netlify function packaged successfully with all server imports and account storage SDK.");
} finally { await rm(out, { recursive: true, force: true }); }
