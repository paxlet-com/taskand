import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const r = spawnSync("node", [join(__dirname, "bin.mjs")], { input: JSON.stringify({ action: "health" }), encoding: "utf8" });
if (r.status !== 0) { console.error("✗ status:", r.status); process.exit(1); }
const out = JSON.parse(r.stdout);
if (out.status !== "ok") { console.error("✗ output:", out); process.exit(1); }
console.log("✓ PASS");
