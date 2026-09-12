import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const r = spawnSync("node", [join(__dirname, "bin.mjs")], {
  input: JSON.stringify({ task: "zbuduj system monitoringu z alertami na Telegram i dashboardem" }),
  encoding: "utf8"
});

if (r.status !== 0) process.exit(1);
const out = JSON.parse(r.stdout);
if (!out.blueprint || !Array.isArray(out.blueprint.steps)) process.exit(1);
console.log("✓ PASS");
