import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const r = spawnSync("node", [join(__dirname, "bin.mjs")], {
  input: JSON.stringify({ device: "localhost" }),
  encoding: "utf8"
});

if (r.status !== 0) process.exit(1);
const out = JSON.parse(r.stdout);
if (!out.ok || typeof out.cpu_pct !== "number") process.exit(1);
console.log("✓ PASS");
